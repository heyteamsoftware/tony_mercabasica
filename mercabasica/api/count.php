<?php
// Contador público de visitas de MercaBásica 2026 (el número que se ve arriba a la derecha).
// GET  -> devuelve el total.
// POST -> suma 1 (como mucho una vez cada 30 minutos por conexión) y devuelve el total.
// Sin cookies y sin guardar IP ni identificadores: solo un número.
declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');
header('X-Robots-Tag: noindex, nofollow');

const ALLOWED_HOST = 'myappsserver.duckdns.org';
const WINDOW = 1800;      // 30 minutos
const MAX_TOTAL = 20000;  // sumas máximas por ventana (freno global)

$dataDir = __DIR__ . '/data';
$file = $dataDir . '/counter.json';
date_default_timezone_set('Atlantic/Canary');

function out(int $total, int $code = 200): never {
    http_response_code($code);
    echo json_encode(['total' => $total]);
    exit;
}
function read_total(string $file): int {
    if (!is_file($file)) return 0;
    $d = json_decode((string)file_get_contents($file), true);
    return (int)($d['total'] ?? 0);
}

$method = $_SERVER['REQUEST_METHOD'] ?? '';
if ($method === 'GET') {
    header('Cache-Control: public, max-age=30');
    out(read_total($file));
}
if ($method !== 'POST') { http_response_code(405); exit; }
header('Cache-Control: no-store');

// Solo desde la propia web
$src = $_SERVER['HTTP_ORIGIN'] ?? ($_SERVER['HTTP_REFERER'] ?? '');
if (parse_url($src, PHP_URL_HOST) !== ALLOWED_HOST) out(read_total($file), 403);
if (!is_dir($dataDir) && !mkdir($dataDir, 0770, true)) out(0, 500);

// Huella temporal e irreversible de la conexión (sal diaria aleatoria), solo para no contar dos veces
$saltFile = $dataDir . '/salt-' . date('Ymd');
if (!is_file($saltFile)) {
    foreach (glob($dataDir . '/salt-*') ?: [] as $old) @unlink($old);
    file_put_contents($saltFile, bin2hex(random_bytes(32)), LOCK_EX);
}
$conn = substr(hash_hmac('sha256', ($_SERVER['REMOTE_ADDR'] ?? '') . '|' . ($_SERVER['HTTP_USER_AGENT'] ?? ''), (string)file_get_contents($saltFile)), 0, 16);
$win = intdiv(time(), WINDOW);
foreach (glob($dataDir . '/seen-*.json') ?: [] as $f) {
    if ((int)substr(basename($f, '.json'), 5) < $win) @unlink($f);
}

$h = fopen($dataDir . "/seen-$win.json", 'c+');
flock($h, LOCK_EX);
$seen = json_decode((string)stream_get_contents($h), true);
if (!is_array($seen)) $seen = [];
$isNew = !isset($seen[$conn]) && count($seen) < MAX_TOTAL;
if ($isNew) {
    $seen[$conn] = 1;
    ftruncate($h, 0); rewind($h); fwrite($h, json_encode($seen)); fflush($h);
}
flock($h, LOCK_UN); fclose($h);

if (!$isNew) out(read_total($file));

$c = fopen($file, 'c+');
flock($c, LOCK_EX);
$d = json_decode((string)stream_get_contents($c), true);
$total = (int)($d['total'] ?? 0) + 1;
ftruncate($c, 0); rewind($c); fwrite($c, json_encode(['total' => $total, 'desde' => $d['desde'] ?? date('Y-m-d')])); fflush($c);
flock($c, LOCK_UN); fclose($c);
out($total);
