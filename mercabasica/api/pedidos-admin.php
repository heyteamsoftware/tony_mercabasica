<?php
// Panel de pedidos por zona: Panadería, Fabricación y montaje, Madera y Almacén.
// Cada zona ve las líneas de sus productos (por el prefijo del código del sheet).
declare(strict_types=1);
require __DIR__ . '/auth.php';
require __DIR__ . '/catalogo-lib.php';

$self = 'pedidos-admin.php';
$csrf = admin_gate($self, 'ped');
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$zona = (string)($_GET['zona'] ?? 'PAS');
if ($zona !== 'todos' && !isset(ZONAS[$zona])) $zona = 'PAS';
$ver = ($_GET['ver'] ?? '') === 'todo' ? 'todo' : 'activos';
$url = fn(array $p = []) => $self . '?' . http_build_query(array_merge(['zona' => $zona, 'ver' => $ver], $p));

// --- Acciones
if ($method === 'POST') {
    $act = (string)($_POST['accion'] ?? '');
    $back = (string)($_POST['volver'] ?? $self);
    if (!str_starts_with($back, $self)) $back = $self;
    $id = (string)($_POST['id'] ?? '');
    if ($act === 'estado') {
        $i = (int)($_POST['linea'] ?? -1);
        $st = (string)($_POST['estado'] ?? '');
        if (isset(ESTADOS[$st])) {
            update_json(PED_FILE, function (array $orders) use ($id, $i, $st) {
                foreach ($orders as &$o) if ($o['id'] === $id && isset($o['lineas'][$i])) $o['lineas'][$i]['estado'] = $st;
                return [$orders, null];
            });
        }
        go($back . '#p-' . rawurlencode($id) . '-' . $i);
    }
    if ($act === 'entregado') {
        update_json(PED_FILE, function (array $orders) use ($id) {
            foreach ($orders as &$o) if ($o['id'] === $id) foreach ($o['lineas'] as &$l) if ($l['estado'] !== 'no_disponible') $l['estado'] = 'entregado';
            return [$orders, null];
        });
        go($back . '#p-' . rawurlencode($id));
    }
    if ($act === 'borrar') {
        update_json(PED_FILE, fn(array $orders) => [array_values(array_filter($orders, fn($o) => $o['id'] !== $id)), null]);
        go($back);
    }
    if ($act === 'quitar') {
        // Quita una línea; si el pedido se queda vacío, se borra entero. Las unidades vuelven al stock.
        $i = (int)($_POST['linea'] ?? -1);
        update_json(PED_FILE, function (array $orders) use ($id, $i) {
            foreach ($orders as $k => &$o) {
                if ($o['id'] !== $id || !isset($o['lineas'][$i])) continue;
                array_splice($o['lineas'], $i, 1);
                if (!$o['lineas']) { unset($orders[$k]); break; }
                $o['total'] = array_sum(array_map(fn($l) => (int)$l['precio'] * (int)$l['cantidad'], $o['lineas']));
            }
            unset($o);
            return [array_values($orders), null];
        });
        go($back);
    }
    if ($act === 'fotos') { sync_fotos(true); go($back); }
    if ($act === 'sheet') { catalog(true); go($back); }
    go($back);
}

$orders = read_json(PED_FILE);
$cat = catalog();
$prods = $cat['productos'] ?? [];
$fstate = fotos_state();
$used = reserved($orders);

// --- CSV de líneas (de la zona o de todo)
if (isset($_GET['csv'])) {
    header('Content-Type: text/csv; charset=utf-8');
    header('Content-Disposition: attachment; filename="pedidos-' . ($zona === 'todos' ? 'todos' : strtolower(ZONAS[$zona])) . '-' . date('Y-m-d') . '.csv"');
    $out = fopen('php://output', 'w');
    fwrite($out, "\xEF\xBB\xBF");
    fputcsv($out, ['Pedido', 'Fecha', 'Cliente', 'Teléfono', 'Correo', 'Dirección', 'Zona', 'Código', 'Producto', 'Cantidad', 'Precio unidad', 'Importe', 'Personalización', 'Observaciones', 'Estado'], ';', '"', '');
    foreach ($orders as $o) foreach ($o['lineas'] as $l) {
        if ($zona !== 'todos' && $l['zona'] !== $zona) continue;
        $row = [$o['codigo'], date('d/m/Y H:i', strtotime($o['fecha'])), $o['cliente']['nombre'], $o['cliente']['telefono'], $o['cliente']['email'], $o['cliente']['direccion'],
            ZONAS[$l['zona']] ?? $l['zona'], $l['codigo'], $l['descripcion'], $l['cantidad'], number_format($l['precio'] / 100, 2, ',', ''), number_format($l['precio'] * $l['cantidad'] / 100, 2, ',', ''),
            $l['personalizacion'], $o['observaciones'], ESTADOS[$l['estado']] ?? $l['estado']];
        fputcsv($out, array_map(fn($v) => preg_match('/^[=+\-@]/', (string)$v) ? "'" . $v : $v, $row), ';', '"', '');
    }
    exit;
}

// --- Totales por zona (unidades por hacer)
$porHacer = array_fill_keys(array_keys(ZONAS), 0);
$activos = 0;
foreach ($orders as $o) {
    $act = false;
    foreach ($o['lineas'] as $l) {
        if (in_array($l['estado'], ['pendiente', 'confirmado'], true)) $porHacer[$l['zona']] = ($porHacer[$l['zona']] ?? 0) + (int)$l['cantidad'];
        if (in_array($l['estado'], ['pendiente', 'confirmado', 'listo'], true)) $act = true;
    }
    if ($act) $activos++;
}
$confirm = null;
if (isset($_GET['borrar'])) foreach ($orders as $o) if ($o['id'] === $_GET['borrar']) $confirm = $o;
$quitar = null;
if (isset($_GET['quitar'], $_GET['linea'])) foreach ($orders as $o) if ($o['id'] === $_GET['quitar'] && isset($o['lineas'][(int)$_GET['linea']])) $quitar = [$o, (int)$_GET['linea']];
$ago = function (?int $t): string {
    if (!$t) return 'nunca';
    $s = time() - $t;
    return $s < 60 ? "hace $s s" : ($s < 3600 ? 'hace ' . intdiv($s, 60) . ' min' : 'a las ' . date('H:i \d\e\l d/m', $t));
};
$pill = fn(string $st) => '<span class="st st--' . h($st) . '">' . h(ESTADOS[$st] ?? $st) . '</span>';
$back = $url();
?><!doctype html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex, nofollow">
<title>Pedidos · <?= h($zona === 'todos' ? 'Todos' : ZONAS[$zona]) ?> · MercaBásica 2026</title><link rel="stylesheet" href="../assets/css/fonts.css">
<style>
  :root { --navy: #0A2150; --tomato: #CC544C; --paper: #FBF6EC; --cream: #FFFEFA; --line: #E6DCC8; --holly: #2F6A4F; }
  * { box-sizing: border-box; }
  body { margin: 0; background: var(--paper); color: var(--navy); font: 15px/1.5 "Bricolage Grotesque", system-ui, sans-serif; }
  header.top { position: sticky; top: 0; z-index: 3; display: flex; align-items: center; gap: 12px; flex-wrap: wrap; padding: 12px 24px; background: var(--navy); color: #FFFBF3; }
  header.top h1 { margin: 0 8px 0 0; font: 700 1.2rem/1 Fraunces, Georgia, serif; }
  header.top .sp { flex: 1; }
  header.top .tabs { display: flex; gap: 6px; }
  header.top a, header.top button { color: #FFFBF3; font: 500 .72rem/1 "DM Mono", monospace; letter-spacing: .1em; text-transform: uppercase; text-decoration: none; background: none; border: 1px solid rgba(255,251,243,.4); border-radius: 999px; padding: .5rem .8rem; cursor: pointer; }
  header.top .tabs a { border-color: transparent; opacity: .75; }
  header.top .tabs a[aria-current] { background: #FBE36F; color: var(--navy); opacity: 1; }
  form.inline { display: inline-flex; flex-wrap: wrap; gap: 8px; align-items: center; margin: 0; }
  main { max-width: 1320px; margin: 0 auto; padding: 22px 24px 60px; }
  .zones { display: grid; grid-template-columns: repeat(5, 1fr); gap: 10px; margin-bottom: 18px; }
  .zones a { display: block; padding: 12px 14px; border: 2px solid var(--navy); border-radius: 14px; background: var(--cream); color: inherit; text-decoration: none; }
  .zones a[aria-current] { background: var(--navy); color: #FFFBF3; box-shadow: 4px 4px 0 var(--tomato); }
  .zones b { display: block; font: 800 1.9rem/1 Fraunces, Georgia, serif; }
  .zones span { font: 500 .68rem/1.3 "DM Mono", monospace; letter-spacing: .08em; text-transform: uppercase; }
  .zones small { display: block; font-size: .78rem; opacity: .75; margin-top: 2px; }
  .bar { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; margin: 4px 0 16px; }
  .bar .sync { flex: 1 1 380px; font-size: .85rem; opacity: .8; }
  .bar .err { color: #A63A31; font-weight: 600; }
  .btn { display: inline-block; padding: .5rem .85rem; border: 2px solid var(--navy); border-radius: 999px; background: var(--navy); color: #FFFBF3; font: 500 .7rem/1 "DM Mono", monospace; letter-spacing: .08em; text-transform: uppercase; text-decoration: none; cursor: pointer; }
  .btn.ghost { background: transparent; color: var(--navy); }
  .btn.red { background: #A63A31; border-color: #A63A31; }
  h2 { margin: 26px 0 10px; font: 700 1.3rem/1.2 Fraunces, Georgia, serif; }
  h2 a { color: var(--tomato); }
  .tbl { overflow-x: auto; background: var(--cream); border: 1px solid var(--line); border-radius: 14px; }
  table { width: 100%; border-collapse: collapse; }
  th, td { padding: 9px 10px; border-bottom: 1px solid var(--line); text-align: left; vertical-align: top; }
  th { background: #F4ECDB; font: 500 .66rem/1.2 "DM Mono", monospace; letter-spacing: .08em; text-transform: uppercase; }
  td.n, th.n { text-align: center; } td.n { font-weight: 800; font-size: 1.05rem; }
  td.big { font: 800 1.5rem/1 Fraunces, Georgia, serif; text-align: center; }
  td small, .muted { display: block; opacity: .7; font-size: .82rem; }
  .code { font: 500 .82rem/1.3 "DM Mono", monospace; white-space: nowrap; }
  .thumb { width: 44px; height: 44px; object-fit: cover; border-radius: 8px; border: 1px solid var(--line); background: #fff; }
  .warn { color: #A63A31; font-weight: 700; }
  .perso { padding: 2px 8px; border-radius: 6px; background: #FCECB4; }
  .del { display: inline-block; margin-top: 6px; color: #A63A31; font-size: .8rem; }
  .st { display: inline-block; padding: 2px 9px; border-radius: 999px; font: 600 .74rem/1.6 inherit; white-space: nowrap; background: #eee; }
  .st--pendiente { background: #FCECB4; } .st--confirmado { background: #D9E7F6; } .st--listo { background: #DDEFE0; color: #1F4D37; }
  .st--entregado { background: var(--holly); color: #fff; } .st--no_disponible { background: #F6D9D5; color: #8A2C24; }
  tr.done td { opacity: .55; }
  select { padding: .4rem .5rem; border: 2px solid var(--navy); border-radius: 8px; font: inherit; background: #fff; }
  .orders { display: grid; gap: 14px; }
  .order { background: var(--cream); border: 2px solid var(--navy); border-radius: 16px; padding: 14px 16px; }
  .order header { display: flex; flex-wrap: wrap; gap: 8px 18px; align-items: baseline; margin-bottom: 8px; }
  .order header b { font: 700 1.1rem/1 "DM Mono", monospace; }
  .order ul { margin: 6px 0; padding: 0; list-style: none; }
  .order li { display: flex; flex-wrap: wrap; gap: 6px 12px; padding: 6px 0; border-top: 1px dashed var(--line); }
  .order .tot { font: 800 1.2rem/1 Fraunces, Georgia, serif; }
  .order footer { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 8px; }
  .empty { padding: 28px; text-align: center; opacity: .7; }
  .confirm { padding: 16px 18px; margin-bottom: 16px; background: #FBE9E5; border: 2px solid #A63A31; border-radius: 14px; }
  @media (max-width: 900px) { .zones { grid-template-columns: repeat(2, 1fr); } }
  @media print { header.top, .zones, .bar, form, .noprint { display: none !important; } body { background: #fff; } main { padding: 0; } .tbl { border: 0; } }
</style></head><body>
<?= admin_top('Pedidos · MercaBásica 2026', $csrf, $self, 'ped', '<a href="' . h($url(['csv' => 1])) . '">Descargar Excel (CSV)</a>') ?>
<main>
<?php if ($confirm): ?>
  <div class="confirm" role="alert">
    <p><b>¿Borrar el pedido <?= h($confirm['codigo']) ?> de <?= h($confirm['cliente']['nombre']) ?>?</b> Las unidades vuelven al stock disponible. No se puede deshacer.</p>
    <form method="post" action="<?= $self ?>" class="inline"><input type="hidden" name="csrf" value="<?= h($csrf) ?>"><input type="hidden" name="accion" value="borrar"><input type="hidden" name="id" value="<?= h($confirm['id']) ?>"><input type="hidden" name="volver" value="<?= h($back) ?>"><button class="btn red" type="submit">Sí, borrar</button></form>
    <a class="btn ghost" href="<?= h($back) ?>">Cancelar</a>
  </div>
<?php endif; ?>
<?php if ($quitar): [$qo, $qi] = $quitar; $ql = $qo['lineas'][$qi]; ?>
  <div class="confirm" role="alert">
    <p><b>¿Quitar <?= (int)$ql['cantidad'] ?> × <?= h($ql['descripcion']) ?> del encargo <?= h($qo['codigo']) ?> (<?= h($qo['cliente']['nombre']) ?>)?</b>
      Las unidades vuelven al stock de la web.<?= count($qo['lineas']) === 1 ? ' Es el único producto del encargo, así que el encargo se borra entero.' : ' El resto del encargo no cambia.' ?> No se puede deshacer.</p>
    <form method="post" action="<?= $self ?>" class="inline"><input type="hidden" name="csrf" value="<?= h($csrf) ?>"><input type="hidden" name="accion" value="quitar"><input type="hidden" name="id" value="<?= h($qo['id']) ?>"><input type="hidden" name="linea" value="<?= $qi ?>"><input type="hidden" name="volver" value="<?= h($back) ?>"><button class="btn red" type="submit">Sí, quitar</button></form>
    <a class="btn ghost" href="<?= h($back) ?>">Cancelar</a>
  </div>
<?php endif; ?>

  <nav class="zones" aria-label="Zonas">
    <?php foreach (ZONAS as $k => $name): ?>
      <a href="<?= h($self . '?zona=' . $k) ?>"<?= $zona === $k ? ' aria-current="page"' : '' ?>><b><?= (int)$porHacer[$k] ?></b><span><?= h($name) ?></span><small><?= h($k) ?>-XXX · unidades por hacer</small></a>
    <?php endforeach; ?>
    <a href="<?= h($self . '?zona=todos') ?>"<?= $zona === 'todos' ? ' aria-current="page"' : '' ?>><b><?= $activos ?></b><span>Todos los pedidos</span><small><?= count($orders) ?> en total · activos</small></a>
  </nav>

  <div class="bar">
    <p class="sync">Sheet leído <?= h($ago(isset($cat['t']) ? (int)$cat['t'] : null)) ?> · fotos actualizadas <?= h($ago(isset($fstate['t']) && empty($fstate['error']) ? (int)$fstate['t'] : null)) ?>
      <?php if (!empty($cat['error']) && (int)$cat['error'] > (int)($cat['t'] ?? 0)): ?><span class="err"> · no se pudo leer el sheet en el último intento (se muestran los últimos datos buenos)</span><?php endif; ?>
      <?php if (!empty($fstate['error'])): ?><span class="err"> · fotos: <?= h($fstate['error']) ?></span><?php endif; ?></p>
    <form method="post" action="<?= $self ?>" class="inline"><input type="hidden" name="csrf" value="<?= h($csrf) ?>"><input type="hidden" name="volver" value="<?= h($back) ?>">
      <button class="btn ghost" name="accion" value="sheet" type="submit">Releer el sheet</button>
      <button class="btn ghost" name="accion" value="fotos" type="submit">Actualizar fotos ahora</button>
    </form>
  </div>

<?php if ($zona !== 'todos'):
    // Producción de la zona: lo que hay que hacer por producto
    $codes = [];
    foreach ($prods as $c => $p) if ($p['zona'] === $zona && $p['visible']) $codes[$c] = $p['descripcion'];
    $agg = [];
    foreach ($orders as $o) foreach ($o['lineas'] as $l) {
        if ($l['zona'] !== $zona) continue;
        $codes[$l['codigo']] ??= $l['descripcion'];
        $agg[$l['codigo']][$l['estado']] = ($agg[$l['codigo']][$l['estado']] ?? 0) + (int)$l['cantidad'];
    }
    ksort($codes);
    $fotos = $fstate['fotos'] ?? [];
?>
  <h2><?= h(ZONAS[$zona]) ?> · qué hay que preparar</h2>
  <div class="tbl">
  <?php if (!$codes): ?><p class="empty">No hay productos de esta zona en el sheet todavía (códigos <?= h($zona) ?>-XXX con precio y descripción).</p>
  <?php else: ?>
    <table>
      <thead><tr><th></th><th>Producto</th><th class="n">Por hacer</th><th class="n">Listos</th><th class="n">Entregados</th><th class="n">Reservados</th><th class="n">Stock del sheet</th><th class="n">Quedan</th></tr></thead>
      <tbody>
      <?php foreach ($codes as $c => $desc): $a = $agg[$c] ?? []; $p = $prods[$c] ?? null; $stock = $p['stock'] ?? null; $left = $stock === null ? null : $stock - ($used[$c] ?? 0); ?>
        <tr>
          <td><?php if (isset($fotos[$c])): ?><img class="thumb" src="../catalogo/<?= h($fotos[$c]) ?>" alt=""><?php endif; ?></td>
          <td><span class="code"><?= h($c) ?></span> <?= h($desc) ?><?php if (!$p || !$p['visible']): ?><small class="warn">Ya no está a la venta en el sheet</small><?php endif; ?></td>
          <td class="big"><?= (int)(($a['pendiente'] ?? 0) + ($a['confirmado'] ?? 0)) ?></td>
          <td class="n"><?= (int)($a['listo'] ?? 0) ?></td>
          <td class="n"><?= (int)($a['entregado'] ?? 0) ?></td>
          <td class="n"><?= (int)($used[$c] ?? 0) ?></td>
          <td class="n"><?= $stock === null ? '—' : (int)$stock ?></td>
          <td class="n<?= $left !== null && $left <= 0 ? ' warn' : '' ?>"><?= $left === null ? 'Sin límite' : ($left < 0 ? $left . ' ⚠' : $left) ?></td>
        </tr>
      <?php endforeach; ?>
      </tbody>
    </table>
  <?php endif; ?>
  </div>

  <h2>Encargos de <?= h(mb_strtolower(ZONAS[$zona])) ?>
    <span class="noprint" style="font:500 .8rem/1 inherit">· <a href="<?= h($url(['ver' => 'activos'])) ?>"<?= $ver === 'activos' ? ' style="font-weight:800"' : '' ?>>activos</a> · <a href="<?= h($url(['ver' => 'todo'])) ?>"<?= $ver === 'todo' ? ' style="font-weight:800"' : '' ?>>todos</a></span></h2>
  <?php
    $rows = [];
    foreach ($orders as $o) foreach ($o['lineas'] as $i => $l) {
        if ($l['zona'] !== $zona) continue;
        if ($ver === 'activos' && in_array($l['estado'], ['entregado', 'no_disponible'], true)) continue;
        $rows[] = [$o, $i, $l];
    }
  ?>
  <div class="tbl">
  <?php if (!$rows): ?><p class="empty"><?= $ver === 'activos' ? 'No hay encargos pendientes en esta zona.' : 'Todavía no hay encargos en esta zona.' ?></p>
  <?php else: ?>
    <table>
      <thead><tr><th>Pedido</th><th>Cliente</th><th>Producto</th><th class="n">Cant.</th><th>Personalización / observaciones</th><th>Estado</th></tr></thead>
      <tbody>
      <?php foreach ($rows as [$o, $i, $l]): $done = in_array($l['estado'], ['entregado', 'no_disponible'], true); ?>
        <tr id="p-<?= h($o['id']) ?>-<?= $i ?>" class="<?= $done ? 'done' : '' ?>">
          <td><span class="code"><?= h($o['codigo']) ?></span><small><?= h(date('d/m H:i', strtotime($o['fecha']))) ?></small></td>
          <td><b><?= h($o['cliente']['nombre']) ?></b><small><a href="tel:<?= h(preg_replace('/\s+/', '', $o['cliente']['telefono'])) ?>"><?= h($o['cliente']['telefono']) ?></a><?= $o['cliente']['email'] ? ' · ' . h($o['cliente']['email']) : '' ?></small></td>
          <td><span class="code"><?= h($l['codigo']) ?></span> <?= h($l['descripcion']) ?><small><?= h(euros((int)$l['precio'])) ?> / ud.</small></td>
          <td class="big"><?= (int)$l['cantidad'] ?></td>
          <td><?= $l['personalizacion'] ? '<span class="perso">' . h($l['personalizacion']) . '</span>' : '' ?><?= $o['observaciones'] ? '<small>' . h($o['observaciones']) . '</small>' : '' ?></td>
          <td><form method="post" action="<?= $self ?>" class="inline"><input type="hidden" name="csrf" value="<?= h($csrf) ?>"><input type="hidden" name="accion" value="estado"><input type="hidden" name="id" value="<?= h($o['id']) ?>"><input type="hidden" name="linea" value="<?= $i ?>"><input type="hidden" name="volver" value="<?= h($back) ?>">
            <select name="estado" aria-label="Estado de la línea"><?php foreach (ESTADOS as $k => $v): ?><option value="<?= $k ?>"<?= $l['estado'] === $k ? ' selected' : '' ?>><?= h($v) ?></option><?php endforeach; ?></select>
            <button class="btn" type="submit">Guardar</button></form>
            <a class="del noprint" href="<?= h($url(['quitar' => $o['id'], 'linea' => $i])) ?>">Quitar del encargo</a></td>
        </tr>
      <?php endforeach; ?>
      </tbody>
    </table>
  <?php endif; ?>
  </div>

<?php else: ?>
  <h2>Todos los pedidos</h2>
  <?php if (!$orders): ?><div class="tbl"><p class="empty">Todavía no hay pedidos.</p></div>
  <?php else: ?>
  <div class="orders">
    <?php foreach (array_reverse($orders) as $o): ?>
      <article class="order" id="p-<?= h($o['id']) ?>">
        <header><b><?= h($o['codigo']) ?></b><span><?= h(date('d/m/Y H:i', strtotime($o['fecha']))) ?></span>
          <span><b style="font:inherit;font-weight:700"><?= h($o['cliente']['nombre']) ?></b> · <a href="tel:<?= h(preg_replace('/\s+/', '', $o['cliente']['telefono'])) ?>"><?= h($o['cliente']['telefono']) ?></a><?= $o['cliente']['email'] ? ' · <a href="mailto:' . h($o['cliente']['email']) . '">' . h($o['cliente']['email']) . '</a>' : '' ?><?= $o['cliente']['direccion'] ? ' · ' . h($o['cliente']['direccion']) : '' ?></span>
          <span class="tot"><?= h(euros((int)$o['total'])) ?></span></header>
        <ul>
          <?php foreach ($o['lineas'] as $l): ?>
            <li><span class="code"><?= h($l['codigo']) ?></span><span><b><?= (int)$l['cantidad'] ?> ×</b> <?= h($l['descripcion']) ?></span><span class="muted" style="display:inline"><?= h(ZONAS[$l['zona']] ?? $l['zona']) ?> · <?= h(euros((int)$l['precio'] * (int)$l['cantidad'])) ?></span><?= $l['personalizacion'] ? '<span class="perso">' . h($l['personalizacion']) . '</span>' : '' ?><?= $pill($l['estado']) ?></li>
          <?php endforeach; ?>
        </ul>
        <?php if ($o['observaciones']): ?><p class="muted">Observaciones: <?= h($o['observaciones']) ?></p><?php endif; ?>
        <footer class="noprint">
          <form method="post" action="<?= $self ?>" class="inline"><input type="hidden" name="csrf" value="<?= h($csrf) ?>"><input type="hidden" name="accion" value="entregado"><input type="hidden" name="id" value="<?= h($o['id']) ?>"><input type="hidden" name="volver" value="<?= h($back) ?>"><button class="btn" type="submit">Marcar todo entregado</button></form>
          <a class="btn ghost" href="<?= h($url(['borrar' => $o['id']])) ?>">Borrar pedido</a>
        </footer>
      </article>
    <?php endforeach; ?>
  </div>
  <?php endif; ?>
<?php endif; ?>
  <p class="noprint muted" style="margin-top:16px">El stock y los precios salen del Google Sheet. Las unidades de cada encargo quedan reservadas salvo que su estado sea «No disponible». Los datos se borran solos tras el 31 de enero de 2027. Para imprimir, Ctrl+P.</p>
</main></body></html>
