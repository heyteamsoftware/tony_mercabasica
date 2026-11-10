<?php
// Contador de visitas anónimo de MercaBásica 2026.
// Sin cookies, sin guardar IP ni identificadores: solo totales por día.
// Solo se llama desde el navegador si la persona acepta en el aviso de privacidad.
declare(strict_types=1);

header('Content-Type: text/plain; charset=utf-8');
header('Cache-Control: no-store');
header('X-Robots-Tag: noindex, nofollow');

const ALLOWED_HOST = 'myappsserver.duckdns.org';
const PATHS   = ['/', '/index.html', '/inscripcion.html', '/politica-privacidad.html', '/terminos.html'];
const EVENTS  = ['cta-calendario', 'mapa', 'google-calendar'];
const DEVICES = ['m', 't', 'd'];
const MAX_BODY = 600;           // bytes
const MAX_PER_CONN = 40;        // envíos por conexión cada 10 minutos
const MAX_TOTAL = 6000;         // envíos totales cada 10 minutos

$dataDir = __DIR__ . '/data';
date_default_timezone_set('Atlantic/Canary');

function finish(int $code): never { http_response_code($code); exit; }

/** Lee, modifica y guarda un JSON con bloqueo exclusivo. */
function update_json(string $file, callable $fn): mixed {
    $h = fopen($file, 'c+');
    if (!$h) finish(500);
    flock($h, LOCK_EX);
    $txt = stream_get_contents($h);
    $data = $txt ? json_decode($txt, true) : [];
    if (!is_array($data)) $data = [];
    [$data, $ret] = $fn($data);
    ftruncate($h, 0);
    rewind($h);
    fwrite($h, json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES));
    fflush($h);
    flock($h, LOCK_UN);
    fclose($h);
    return $ret;
}

// 1. Solo POST, desde la propia web
if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') finish(405);
$src = $_SERVER['HTTP_ORIGIN'] ?? ($_SERVER['HTTP_REFERER'] ?? '');
if (parse_url($src, PHP_URL_HOST) !== ALLOWED_HOST) finish(403);

// 2. Respeta "No rastrear" y Global Privacy Control
if (($_SERVER['HTTP_SEC_GPC'] ?? '') === '1' || ($_SERVER['HTTP_DNT'] ?? '') === '1') finish(204);

// 3. Cuerpo pequeño y con campos cerrados
$raw = file_get_contents('php://input', false, null, 0, MAX_BODY + 1);
if ($raw === false || $raw === '' || strlen($raw) > MAX_BODY) finish(400);
$in = json_decode($raw, true);
if (!is_array($in)) finish(400);

$type = $in['t'] ?? '';
$dev  = in_array($in['d'] ?? '', DEVICES, true) ? $in['d'] : '?';
$path = $ref = $event = null;
if ($type === 'view') {
    $path = (string)($in['p'] ?? '');
    if (!in_array($path, PATHS, true)) finish(400);
    if ($path === '/index.html') $path = '/';
    $ref = strtolower((string)($in['r'] ?? ''));
    if ($ref !== '' && !preg_match('/^[a-z0-9.-]{1,64}$/', $ref)) $ref = 'otro';
    $ref = preg_replace('/^(www\.|m\.|l\.|lm\.)/', '', $ref);
} elseif ($type === 'event') {
    $event = (string)($in['e'] ?? '');
    if (!in_array($event, EVENTS, true)) finish(400);
} else {
    finish(400);
}

if (!is_dir($dataDir) && !mkdir($dataDir, 0770, true)) finish(500);

// 4. Freno contra envíos abusivos: huella irreversible de la conexión,
//    con una sal aleatoria que cambia cada día; se descarta cada 10 minutos.
$saltFile = $dataDir . '/salt-' . date('Ymd');
if (!is_file($saltFile)) {
    foreach (glob($dataDir . '/salt-*') ?: [] as $old) @unlink($old);
    file_put_contents($saltFile, bin2hex(random_bytes(32)), LOCK_EX);
}
$salt = (string)file_get_contents($saltFile);
$conn = substr(hash_hmac('sha256', ($_SERVER['REMOTE_ADDR'] ?? '') . '|' . ($_SERVER['HTTP_USER_AGENT'] ?? ''), $salt), 0, 16);
$window = intdiv(time(), 600);
foreach (glob($dataDir . '/rl-*.json') ?: [] as $f) {
    if ((int)substr(basename($f, '.json'), 3) < $window) @unlink($f);
}
$allowed = update_json($dataDir . "/rl-$window.json", function (array $d) use ($conn) {
    $d['_total'] = ($d['_total'] ?? 0) + 1;
    $d[$conn] = ($d[$conn] ?? 0) + 1;
    return [$d, $d['_total'] <= MAX_TOTAL && $d[$conn] <= MAX_PER_CONN];
});
if (!$allowed) finish(429);

// 5. Suma a los totales del día
$day = date('Y-m-d');
update_json($dataDir . '/stats-' . date('Y-m') . '.json', function (array $d) use ($day, $type, $path, $ref, $event, $dev) {
    $x = $d[$day] ?? ['views' => 0, 'paths' => [], 'refs' => [], 'dev' => [], 'events' => []];
    if ($type === 'view') {
        $x['views']++;
        $x['paths'][$path] = ($x['paths'][$path] ?? 0) + 1;
        $r = $ref === '' ? '(directo)' : $ref;
        $x['refs'][$r] = ($x['refs'][$r] ?? 0) + 1;
        $x['dev'][$dev] = ($x['dev'][$dev] ?? 0) + 1;
    } else {
        $x['events'][$event] = ($x['events'][$event] ?? 0) + 1;
    }
    $d[$day] = $x;
    return [$d, null];
});

finish(204);
