<?php
// Inscripciones de MercaBásica 2026 (control de aforo).
// GET  → {"abierto": bool}  (cerrado a mano o aforo completo)
// POST → guarda una inscripción. Acepta JSON (desde la web) o formulario normal (sin JS).
declare(strict_types=1);
require __DIR__ . '/inc.php';

header('Cache-Control: no-store');
header('X-Robots-Tag: noindex, nofollow');

$isJson = str_contains($_SERVER['CONTENT_TYPE'] ?? '', 'application/json') || ($_SERVER['REQUEST_METHOD'] ?? '') === 'GET';

/** Responde y termina: JSON para la web; página sencilla si se envió sin JavaScript. */
function reply(int $code, array $body): never {
    global $isJson;
    http_response_code($code);
    if ($isJson) {
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode($body, JSON_UNESCAPED_UNICODE);
        exit;
    }
    header('Content-Type: text/html; charset=utf-8');
    $e = fn($s) => htmlspecialchars((string)$s, ENT_QUOTES, 'UTF-8');
    $ok = !empty($body['ok']);
    $title = $ok ? '¡Inscripción hecha!' : 'No se ha podido guardar';
    $msg = $ok
        ? 'Tu código es <b>' . $e($body['codigo']) . '</b>. Guárdalo: te lo podemos pedir en la entrada. ¡Te esperamos el 11 de diciembre!'
        : $e($body['mensaje'] ?? 'Inténtalo de nuevo.');
    echo '<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex">'
        . '<title>' . $title . ' · MercaBásica 2026</title><link rel="stylesheet" href="../assets/css/fonts.css"><link rel="stylesheet" href="../assets/css/styles.css"></head>'
        . '<body><main class="legal"><div class="wrap"><h1>' . $title . '</h1><p>' . $msg . '</p>'
        . '<a class="btn legal__back" href="../' . ($ok ? '' : 'inscripcion.html') . '">' . ($ok ? 'Volver a MercaBásica' : 'Volver al formulario') . '</a></div></main></body></html>';
    exit;
}

try {
    ensure_data_dir();
    purge_if_expired();
    $conf = config();
    $list = read_json(INS_FILE);
    $full = $conf['aforo'] > 0 && total_personas($list) >= $conf['aforo'];

    $method = $_SERVER['REQUEST_METHOD'] ?? '';
    if ($method === 'GET') reply(200, ['abierto' => $conf['abierto'] && !$full]);
    if ($method !== 'POST') reply(405, ['ok' => false, 'mensaje' => 'Método no permitido.']);

    // 1. Solo desde la propia web
    $src = $_SERVER['HTTP_ORIGIN'] ?? ($_SERVER['HTTP_REFERER'] ?? '');
    if (parse_url($src, PHP_URL_HOST) !== ALLOWED_HOST) reply(403, ['ok' => false, 'mensaje' => 'Envío no permitido.']);

    // 2. Datos
    if ($isJson) {
        $raw = file_get_contents('php://input', false, null, 0, 4097);
        if ($raw === false || strlen($raw) > 4096) reply(413, ['ok' => false, 'mensaje' => 'Demasiados datos.']);
        $in = json_decode($raw, true);
        if (!is_array($in)) reply(400, ['ok' => false, 'mensaje' => 'Datos no válidos.']);
    } else {
        $in = $_POST;
    }
    $s = fn($k) => is_string($in[$k] ?? null) ? $in[$k] : (is_scalar($in[$k] ?? null) ? (string)$in[$k] : '');

    // 3. Antispam: campo trampa vacío y tiempo mínimo rellenando (si hay JS)
    if (trim($s('web')) !== '') reply(200, ['ok' => true, 'codigo' => 'MB26-OK', 'nombre' => '', 'personas' => 1]);
    $t = (int)$s('t');
    if ($isJson && $t > 0 && $t < 3000) reply(429, ['ok' => false, 'mensaje' => 'Ve un poco más despacio y vuelve a enviarlo.']);
    if (!rate_ok('rli', 3600, 6, 400)) reply(429, ['ok' => false, 'mensaje' => 'Demasiados envíos seguidos. Prueba dentro de un rato.']);

    // 4. Validación
    $err = [];
    $nombre = clean($s('nombre'), 80);
    $email = mb_strtolower(clean($s('email'), 120));
    $tel = clean($s('telefono'), 20);
    $entidad = clean($s('entidad'), 120);
    $tipo = $s('tipo');
    $personas = filter_var($s('personas'), FILTER_VALIDATE_INT, ['options' => ['min_range' => 1, 'max_range' => 20]]);
    $coment = clean($s('comentario'), 500);
    if (mb_strlen($nombre) < 3) $err['nombre'] = 'Escribe tu nombre y apellidos.';
    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) $err['email'] = 'Revisa el correo electrónico.';
    if ($tel !== '' && !preg_match('/^\+?[0-9 ]{9,18}$/', $tel)) $err['telefono'] = 'Revisa el teléfono (solo números).';
    if (!isset(TIPOS[$tipo])) $err['tipo'] = 'Elige cómo vienes.';
    if (in_array($tipo, ['institucion', 'centro', 'empresa', 'prensa'], true) && mb_strlen($entidad) < 2) $err['entidad'] = 'Indica la institución, centro o empresa.';
    if ($personas === false) $err['personas'] = 'Indica cuántas personas venís (de 1 a 20).';
    if (!in_array($s('acepto'), ['1', 'on', 'true'], true)) $err['acepto'] = 'Necesitamos tu permiso para guardar estos datos.';
    if ($err) reply(422, ['ok' => false, 'mensaje' => 'Revisa los campos marcados.', 'errores' => $err]);

    // 5. Guardado con bloqueo (aforo y duplicados se comprueban dentro)
    $res = update_json(INS_FILE, function (array $list) use ($conf, $nombre, $email, $tel, $entidad, $tipo, $personas, $coment) {
        foreach ($list as $r) {
            if (($r['email'] ?? '') === $email) return [$list, ['dup' => true]];
        }
        if (!$conf['abierto']) return [$list, ['closed' => true]];
        if ($conf['aforo'] > 0 && total_personas($list) + $personas > $conf['aforo']) return [$list, ['full' => true]];
        $code = new_code($list);
        $list[] = [
            'id' => bin2hex(random_bytes(6)), 'codigo' => $code, 'fecha' => date('c'),
            'nombre' => $nombre, 'email' => $email, 'telefono' => $tel, 'entidad' => $entidad,
            'tipo' => $tipo, 'personas' => $personas, 'comentario' => $coment, 'asistio' => false,
        ];
        return [$list, ['code' => $code]];
    });
    if (!empty($res['dup'])) reply(409, ['ok' => false, 'mensaje' => 'Este correo ya tiene una inscripción. Si quieres cambiarla, escríbenos a secretaria-35015887@gobiernodecanarias.org.', 'errores' => ['email' => 'Ya hay una inscripción con este correo.']]);
    if (!empty($res['closed'])) reply(409, ['ok' => false, 'mensaje' => 'Las inscripciones están cerradas.']);
    if (!empty($res['full'])) reply(409, ['ok' => false, 'mensaje' => 'Lo sentimos: ya no quedan plazas para tantas personas.']);

    reply(201, ['ok' => true, 'codigo' => $res['code'], 'nombre' => $nombre, 'personas' => $personas]);
} catch (Throwable $ex) {
    error_log('inscribir.php: ' . $ex->getMessage());
    reply(500, ['ok' => false, 'mensaje' => 'Error del servidor. Inténtalo de nuevo en unos minutos.']);
}
