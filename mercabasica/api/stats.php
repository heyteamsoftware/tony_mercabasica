<?php
// Panel de estadísticas anónimas de MercaBásica 2026.
// Acceso: stats.php?k=<clave>. La clave vive solo en el servidor (data/token.txt), nunca en el código público.
declare(strict_types=1);

header('Content-Type: text/html; charset=utf-8');
header('Cache-Control: no-store');
header('X-Robots-Tag: noindex, nofollow');
header("Content-Security-Policy: default-src 'none'; style-src 'unsafe-inline'; frame-ancestors 'none'");

$dataDir = __DIR__ . '/data';
date_default_timezone_set('Atlantic/Canary');
$token = is_file("$dataDir/token.txt") ? trim((string)file_get_contents("$dataDir/token.txt")) : '';
$given = (string)($_GET['k'] ?? '');
if ($token === '' || strlen($given) < 20 || !hash_equals($token, $given)) {
    usleep(400000);
    http_response_code(404);
    exit('No encontrado');
}

$days = [];
foreach (glob("$dataDir/stats-*.json") ?: [] as $f) {
    $d = json_decode((string)file_get_contents($f), true);
    if (is_array($d)) $days += $d;
}
krsort($days);

$sum = ['views' => 0, 'paths' => [], 'refs' => [], 'dev' => [], 'events' => []];
foreach ($days as $x) {
    $sum['views'] += $x['views'] ?? 0;
    foreach (['paths', 'refs', 'dev', 'events'] as $k) {
        foreach ($x[$k] ?? [] as $name => $n) $sum[$k][$name] = ($sum[$k][$name] ?? 0) + $n;
    }
}
foreach (['paths', 'refs', 'dev', 'events'] as $k) arsort($sum[$k]);
$devNames = ['m' => 'Móvil', 't' => 'Tableta', 'd' => 'Ordenador', '?' => 'Desconocido'];
$e = fn($s) => htmlspecialchars((string)$s, ENT_QUOTES, 'UTF-8');

function table(string $title, array $rows, callable $label, callable $e): string {
    if (!$rows) return "<h2>$title</h2><p class='muted'>Sin datos todavía.</p>";
    $h = "<h2>$title</h2><table>";
    foreach (array_slice($rows, 0, 15, true) as $k => $n) $h .= '<tr><td>' . $e($label($k)) . '</td><td class="n">' . (int)$n . '</td></tr>';
    return $h . '</table>';
}
?><!doctype html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex, nofollow">
<title>Estadísticas · MercaBásica 2026</title>
<style>
  body { margin: 0; padding: 32px 18px 60px; background: #FBF6EC; color: #0A2150; font: 16px/1.5 system-ui, sans-serif; }
  main { max-width: 760px; margin: 0 auto; }
  h1 { font: 800 2rem/1.1 Georgia, serif; margin: 0 0 .3rem; }
  h2 { font: 700 1.15rem/1.2 Georgia, serif; margin: 2rem 0 .6rem; }
  .muted { opacity: .7; }
  .big { display: flex; gap: 14px; flex-wrap: wrap; margin-top: 1.4rem; }
  .big div { flex: 1 1 160px; padding: 14px 16px; background: #FFFDF6; border-top: 6px solid #CC544C; }
  .big b { display: block; font: 800 2.2rem/1 Georgia, serif; }
  table { width: 100%; border-collapse: collapse; background: #FFFDF6; }
  td, th { padding: 7px 12px; border-bottom: 1px solid #e7dfcf; text-align: left; }
  .n { text-align: right; font-variant-numeric: tabular-nums; }
</style></head><body><main>
<h1>Estadísticas de MercaBásica 2026</h1>
<p class="muted">Solo visitas de quienes aceptaron el contador. Sin cookies ni IPs: totales por día, hora de Canarias.</p>
<div class="big">
  <div><b><?= (int)$sum['views'] ?></b>visitas en total</div>
  <div><b><?= (int)($days[date('Y-m-d')]['views'] ?? 0) ?></b>visitas hoy</div>
  <div><b><?= (int)($sum['events']['cta-calendario'] ?? 0) ?></b>clics en «Apúntalo en tu calendario»</div>
</div>
<h2>Últimos 30 días</h2>
<?php if (!$days): ?><p class="muted">Sin datos todavía.</p><?php else: ?>
<table><tr><th>Día</th><th class="n">Visitas</th><th class="n">Calendario</th><th class="n">Mapa</th></tr>
<?php foreach (array_slice($days, 0, 30, true) as $day => $x): ?>
<tr><td><?= $e($day) ?></td><td class="n"><?= (int)($x['views'] ?? 0) ?></td><td class="n"><?= (int)($x['events']['cta-calendario'] ?? 0) ?></td><td class="n"><?= (int)($x['events']['mapa'] ?? 0) ?></td></tr>
<?php endforeach; ?></table><?php endif; ?>
<?= table('De dónde llegan', $sum['refs'], fn($k) => $k, $e) ?>
<?= table('Dispositivo', $sum['dev'], fn($k) => $devNames[$k] ?? $k, $e) ?>
<?= table('Páginas', $sum['paths'], fn($k) => $k, $e) ?>
<?= table('Clics', $sum['events'], fn($k) => ['cta-calendario' => 'Apúntalo en tu calendario', 'mapa' => 'Cómo llegar en el mapa', 'google-calendar' => 'Google Calendar'][$k] ?? $k, $e) ?>
</main></body></html>
