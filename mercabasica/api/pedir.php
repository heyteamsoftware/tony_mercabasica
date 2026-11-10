<?php
// Hoja de encargo: recibe un pedido, comprueba precio y stock con el sheet en ese
// momento y reserva las unidades. Precios y stock nunca se toman del navegador.
declare(strict_types=1);
require __DIR__ . '/catalogo-lib.php';

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header('X-Robots-Tag: noindex, nofollow');

function out(int $code, array $body): never {
    http_response_code($code);
    echo json_encode($body, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

try {
    ensure_data_dir();
    purge_if_expired();
    if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') out(405, ['ok' => false, 'mensaje' => 'Método no permitido.']);
    $src = $_SERVER['HTTP_ORIGIN'] ?? ($_SERVER['HTTP_REFERER'] ?? '');
    if (parse_url($src, PHP_URL_HOST) !== ALLOWED_HOST) out(403, ['ok' => false, 'mensaje' => 'Envío no permitido.']);
    $raw = file_get_contents('php://input', false, null, 0, 16385);
    if ($raw === false || strlen($raw) > 16384) out(413, ['ok' => false, 'mensaje' => 'Demasiados datos.']);
    $in = json_decode($raw, true);
    if (!is_array($in)) out(400, ['ok' => false, 'mensaje' => 'Datos no válidos.']);
    $s = fn($k) => is_scalar($in[$k] ?? null) ? (string)$in[$k] : '';

    // Antispam
    if (trim($s('web')) !== '') out(200, ['ok' => true, 'codigo' => 'PED-OK', 'total' => 0, 'lineas' => []]);
    $t = (int)$s('t');
    if ($t > 0 && $t < 4000) out(429, ['ok' => false, 'mensaje' => 'Ve un poco más despacio y vuelve a enviarlo.']);
    if (!rate_ok('rlp', 3600, 8, 500)) out(429, ['ok' => false, 'mensaje' => 'Demasiados encargos seguidos. Prueba dentro de un rato.']);

    // Datos del cliente (sección 1 de la hoja de encargo)
    $err = [];
    $nombre = clean($s('nombre'), 80);
    $tel = clean($s('telefono'), 20);
    $email = mb_strtolower(clean($s('email'), 120));
    $dir = clean($s('direccion'), 160);
    $obs = clean($s('observaciones'), 600);
    if (mb_strlen($nombre) < 3) $err['nombre'] = 'Escribe tu nombre y apellidos.';
    if (!preg_match('/^\+?[0-9 ]{9,18}$/', $tel)) $err['telefono'] = 'Escribe un teléfono de contacto (solo números).';
    if ($email !== '' && !filter_var($email, FILTER_VALIDATE_EMAIL)) $err['email'] = 'Revisa el correo electrónico.';
    if (!in_array($s('acepto'), ['1', 'on', 'true'], true)) $err['acepto'] = 'Necesitamos tu conformidad para hacer el encargo.';

    // Líneas (secciones 2 y 3)
    $lines = [];
    $want = [];
    foreach (is_array($in['lineas'] ?? null) ? array_slice($in['lineas'], 0, 30) : [] as $l) {
        if (!is_array($l)) continue;
        $code = strtoupper(trim((string)($l['codigo'] ?? '')));
        $qty = filter_var($l['cantidad'] ?? null, FILTER_VALIDATE_INT, ['options' => ['min_range' => 1, 'max_range' => 50]]);
        if (!preg_match('/^(PAS|FAB|MAD|ALM)-[A-Z0-9]{1,8}$/', $code) || $qty === false) continue;
        $lines[] = ['codigo' => $code, 'cantidad' => $qty, 'personalizacion' => clean((string)($l['personalizacion'] ?? ''), 200)];
        $want[$code] = ($want[$code] ?? 0) + $qty;
    }
    if (!$lines) $err['lineas'] = 'Añade al menos un producto al encargo.';
    if ($err) out(422, ['ok' => false, 'mensaje' => 'Revisa los campos marcados.', 'errores' => $err]);

    // Precio y stock: el sheet manda, leído ahora mismo
    $cat = catalog(true);
    $prods = $cat['productos'] ?? [];
    if (!$prods) out(503, ['ok' => false, 'mensaje' => 'No podemos consultar el catálogo ahora. Inténtalo en unos minutos.']);

    $res = update_json(PED_FILE, function (array $orders) use ($prods, $lines, $want, $nombre, $tel, $email, $dir, $obs) {
        $used = reserved($orders);
        $problems = [];
        foreach ($want as $code => $qty) {
            $p = $prods[$code] ?? null;
            if (!$p || !$p['visible']) { $problems[$code] = ['quedan' => 0, 'mensaje' => 'Ya no está en el catálogo.']; continue; }
            if ($p['stock'] === null) continue;
            $left = max(0, $p['stock'] - ($used[$code] ?? 0));
            if ($qty > $left) $problems[$code] = ['quedan' => $left, 'mensaje' => $left ? "Solo quedan $left." : 'Agotado.'];
        }
        if ($problems) return [$orders, ['problems' => $problems]];
        $total = 0;
        $out = [];
        foreach ($lines as $l) {
            $p = $prods[$l['codigo']];
            $total += $p['precio'] * $l['cantidad'];
            $out[] = $l + ['descripcion' => $p['descripcion'], 'zona' => $p['zona'], 'precio' => $p['precio'], 'estado' => 'pendiente'];
        }
        $code = new_code($orders, 'PED-');
        $orders[] = [
            'id' => bin2hex(random_bytes(6)), 'codigo' => $code, 'fecha' => date('c'),
            'cliente' => ['nombre' => $nombre, 'telefono' => $tel, 'email' => $email, 'direccion' => $dir],
            'lineas' => $out, 'observaciones' => $obs, 'total' => $total, 'entrega' => '2026-12-11',
        ];
        return [$orders, ['code' => $code, 'total' => $total, 'lineas' => $out]];
    });

    if (!empty($res['problems'])) out(409, ['ok' => false, 'mensaje' => 'El stock ha cambiado mientras hacías el encargo. Revisa los productos marcados.', 'stock' => $res['problems']]);
    out(201, ['ok' => true, 'codigo' => $res['code'], 'total' => $res['total'], 'nombre' => $nombre,
        'lineas' => array_map(fn($l) => ['codigo' => $l['codigo'], 'descripcion' => $l['descripcion'], 'cantidad' => $l['cantidad'], 'precio' => $l['precio'], 'personalizacion' => $l['personalizacion']], $res['lineas'])]);
} catch (Throwable $ex) {
    error_log('pedir.php: ' . $ex->getMessage());
    out(500, ['ok' => false, 'mensaje' => 'Error del servidor. Inténtalo de nuevo en unos minutos.']);
}
