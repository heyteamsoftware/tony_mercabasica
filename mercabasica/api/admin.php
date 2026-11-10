<?php
// Panel privado de inscripciones de MercaBásica 2026.
// La contraseña solo existe en el servidor, cifrada con Argon2id en data/admin.hash.
declare(strict_types=1);
require __DIR__ . '/auth.php';

$self = 'admin.php';
admin_gate($self, 'ins');
$e = fn($s) => h($s);
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

// --- Acciones (siempre con token anti-CSRF)
if ($method === 'POST') {
    $act = (string)($_POST['accion'] ?? '');
    $back = $self . (isset($_POST['q']) && $_POST['q'] !== '' ? '?q=' . rawurlencode((string)$_POST['q']) : '');
    if ($act === 'asistio' || $act === 'borrar') {
        $id = (string)($_POST['id'] ?? '');
        update_json(INS_FILE, function (array $list) use ($act, $id) {
            foreach ($list as $k => $r) {
                if (($r['id'] ?? '') !== $id) continue;
                if ($act === 'asistio') $list[$k]['asistio'] = empty($r['asistio']);
                else unset($list[$k]);
            }
            return [array_values($list), null];
        });
        go($back . ($act === 'asistio' ? '#r-' . rawurlencode($id) : ''));
    }
    if ($act === 'config') {
        $aforo = max(0, min(5000, (int)($_POST['aforo'] ?? 0)));
        $abierto = ($_POST['abierto'] ?? '') === '1';
        update_json(CONF_FILE, fn($c) => [['abierto' => $abierto, 'aforo' => $aforo], null]);
        go($self);
    }
    go($self);
}

$list = read_json(INS_FILE);
$conf = config();

// --- Exportar CSV (Excel en español: separador ; y BOM)
if (isset($_GET['csv'])) {
    header('Content-Type: text/csv; charset=utf-8');
    header('Content-Disposition: attachment; filename="inscripciones-mercabasica-' . date('Y-m-d') . '.csv"');
    $out = fopen('php://output', 'w');
    fwrite($out, "\xEF\xBB\xBF");
    fputcsv($out, ['Código', 'Fecha', 'Nombre', 'Correo', 'Teléfono', 'Tipo', 'Institución / entidad', 'Personas', 'Comentario', 'Asistió'], ';', '"', '');
    foreach ($list as $r) {
        $row = [$r['codigo'], date('d/m/Y H:i', strtotime($r['fecha'])), $r['nombre'], $r['email'], $r['telefono'], TIPOS[$r['tipo']] ?? $r['tipo'], $r['entidad'], $r['personas'], $r['comentario'], !empty($r['asistio']) ? 'Sí' : 'No'];
        // evita que Excel interprete fórmulas
        $row = array_map(fn($v) => preg_match('/^[=+\-@]/', (string)$v) ? "'" . $v : $v, $row);
        fputcsv($out, $row, ';', '"', '');
    }
    exit;
}

// --- Confirmación de borrado
$confirm = null;
if (isset($_GET['borrar'])) {
    foreach ($list as $r) if ($r['id'] === $_GET['borrar']) $confirm = $r;
}

// --- Filtros y totales
$q = mb_strtolower(trim((string)($_GET['q'] ?? '')));
$rows = array_reverse($list);
if ($q !== '') {
    $rows = array_filter($rows, fn($r) => str_contains(mb_strtolower(implode(' ', [$r['codigo'], $r['nombre'], $r['email'], $r['entidad'], $r['telefono']])), $q));
}
$personas = total_personas($list);
$asistentes = array_sum(array_map(fn($r) => !empty($r['asistio']) ? (int)$r['personas'] : 0, $list));
$porTipo = [];
foreach ($list as $r) $porTipo[$r['tipo']] = ($porTipo[$r['tipo']] ?? 0) + (int)$r['personas'];
arsort($porTipo);
$quedan = $conf['aforo'] > 0 ? max(0, $conf['aforo'] - $personas) : null;
$csrf = $e($_SESSION['csrf']);
$qs = $e((string)($_GET['q'] ?? ''));
?><!doctype html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex, nofollow">
<title>Inscripciones · MercaBásica 2026</title><link rel="stylesheet" href="../assets/css/fonts.css">
<style>
  :root { --navy: #0A2150; --tomato: #CC544C; --paper: #FBF6EC; --cream: #FFFEFA; --line: #E6DCC8; --holly: #2F6A4F; }
  * { box-sizing: border-box; }
  body { margin: 0; background: var(--paper); color: var(--navy); font: 15px/1.5 "Bricolage Grotesque", system-ui, sans-serif; }
  header.top { position: sticky; top: 0; z-index: 2; display: flex; align-items: center; gap: 16px; flex-wrap: wrap; padding: 12px 24px; background: var(--navy); color: #FFFBF3; }
  header.top h1 { margin: 0; font: 700 1.25rem/1 Fraunces, Georgia, serif; }
  header.top .sp { flex: 1; }
  header.top .tabs { display: flex; gap: 6px; }
  header.top .tabs a { border-color: transparent; opacity: .75; }
  header.top .tabs a[aria-current] { background: #FBE36F; color: #0A2150; opacity: 1; }
  header.top a, header.top button { color: #FFFBF3; font: 500 .72rem/1 "DM Mono", monospace; letter-spacing: .1em; text-transform: uppercase; text-decoration: none; background: none; border: 1px solid rgba(255,251,243,.4); border-radius: 999px; padding: .5rem .8rem; cursor: pointer; }
  main { max-width: 1280px; margin: 0 auto; padding: 24px; }
  .cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); gap: 14px; }
  .card { padding: 14px 16px; background: var(--cream); border: 2px solid var(--navy); border-radius: 14px; }
  .card b { display: block; font: 800 2.2rem/1 Fraunces, Georgia, serif; }
  .card span { font: 500 .7rem/1.3 "DM Mono", monospace; letter-spacing: .1em; text-transform: uppercase; opacity: .75; }
  .card.warn { border-color: var(--tomato); }
  .row { display: flex; flex-wrap: wrap; gap: 14px; margin: 18px 0; align-items: stretch; }
  .panel { flex: 1 1 320px; padding: 14px 16px; background: var(--cream); border: 1px solid var(--line); border-radius: 14px; }
  .panel h2 { margin: 0 0 .6rem; font: 700 1.05rem/1.2 Fraunces, Georgia, serif; }
  .tipos { margin: 0; padding: 0; list-style: none; columns: 2; }
  .tipos li { display: flex; justify-content: space-between; gap: 10px; padding: 2px 10px 2px 0; break-inside: avoid; }
  form.inline { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; }
  label.small { font: 500 .7rem/1 "DM Mono", monospace; letter-spacing: .08em; text-transform: uppercase; }
  input[type=search], input[type=number] { padding: .55rem .7rem; border: 2px solid var(--navy); border-radius: 10px; font: inherit; background: #fff; }
  input[type=search] { flex: 1 1 220px; }
  input[type=number] { width: 110px; }
  .btn { display: inline-block; padding: .55rem .9rem; border: 2px solid var(--navy); border-radius: 999px; background: var(--navy); color: #FFFBF3; font: 500 .72rem/1 "DM Mono", monospace; letter-spacing: .08em; text-transform: uppercase; text-decoration: none; cursor: pointer; }
  .btn.ghost { background: transparent; color: var(--navy); }
  .btn.red { background: #A63A31; border-color: #A63A31; }
  .state { font-weight: 700; } .state.on { color: var(--holly); } .state.off { color: #A63A31; }
  .tbl { overflow-x: auto; background: var(--cream); border: 1px solid var(--line); border-radius: 14px; }
  table { width: 100%; border-collapse: collapse; min-width: 980px; }
  th, td { padding: 9px 10px; border-bottom: 1px solid var(--line); text-align: left; vertical-align: top; }
  th { position: sticky; top: 0; background: #F4ECDB; font: 500 .68rem/1.2 "DM Mono", monospace; letter-spacing: .08em; text-transform: uppercase; }
  td.code { font: 500 .85rem/1.3 "DM Mono", monospace; white-space: nowrap; }
  td.n { text-align: center; font-weight: 800; font-size: 1.05rem; }
  td small { display: block; opacity: .7; }
  tr.yes { background: #E8F1E9; }
  .chk { min-width: 92px; padding: .4rem .6rem; border-radius: 8px; border: 2px solid var(--holly); background: #fff; color: var(--holly); font: 600 .78rem/1 inherit; cursor: pointer; }
  tr.yes .chk { background: var(--holly); color: #fff; }
  .del { background: none; border: 0; color: #A63A31; text-decoration: underline; cursor: pointer; font: inherit; font-size: .82rem; padding: 0; }
  .empty { padding: 32px; text-align: center; opacity: .7; }
  .confirm { padding: 18px 20px; margin-bottom: 18px; background: #FBE9E5; border: 2px solid #A63A31; border-radius: 14px; }
  .confirm form { display: inline; }
  @media print {
    header.top, .row, form, .del, .chk, .noprint { display: none !important; }
    body { background: #fff; } main { padding: 0; } .tbl { border: 0; } table { min-width: 0; font-size: 11px; }
    th { position: static; }
  }
</style></head><body>
<?= admin_top('Inscripciones · MercaBásica 2026', $_SESSION['csrf'], $self, 'ins', '<a href="' . $self . '?csv=1">Descargar Excel (CSV)</a>') ?>
<main>
<?php if ($confirm): ?>
  <div class="confirm" role="alert">
    <p><b>¿Borrar la inscripción <?= $e($confirm['codigo']) ?> de <?= $e($confirm['nombre']) ?> (<?= (int)$confirm['personas'] ?> pers.)?</b> No se puede deshacer.</p>
    <form method="post" action="<?= $self ?>"><input type="hidden" name="csrf" value="<?= $csrf ?>"><input type="hidden" name="accion" value="borrar"><input type="hidden" name="id" value="<?= $e($confirm['id']) ?>"><button class="btn red" type="submit">Sí, borrar</button></form>
    <a class="btn ghost" href="<?= $self ?>">Cancelar</a>
  </div>
<?php endif; ?>

  <section class="cards" aria-label="Resumen">
    <div class="card"><b><?= count($list) ?></b><span>Inscripciones</span></div>
    <div class="card"><b><?= $personas ?></b><span>Personas inscritas</span></div>
    <div class="card<?= $quedan === 0 ? ' warn' : '' ?>"><b><?= $quedan === null ? '∞' : $quedan ?></b><span><?= $quedan === null ? 'Sin límite de aforo' : 'Plazas libres de ' . (int)$conf['aforo'] ?></span></div>
    <div class="card"><b><?= $asistentes ?></b><span>Han llegado (día del evento)</span></div>
  </section>

  <div class="row">
    <section class="panel">
      <h2>Por tipo (personas)</h2>
      <?php if ($porTipo): ?><ul class="tipos"><?php foreach ($porTipo as $t => $n): ?><li><span><?= $e(TIPOS[$t] ?? $t) ?></span><b><?= (int)$n ?></b></li><?php endforeach; ?></ul>
      <?php else: ?><p>Todavía no hay inscripciones.</p><?php endif; ?>
    </section>
    <section class="panel">
      <h2>Formulario: <span class="state <?= $conf['abierto'] ? 'on">abierto' : 'off">cerrado' ?></span></h2>
      <form method="post" action="<?= $self ?>" class="inline">
        <input type="hidden" name="csrf" value="<?= $csrf ?>"><input type="hidden" name="accion" value="config">
        <label class="small" for="aforo">Aforo máximo (0 = sin límite)</label>
        <input id="aforo" name="aforo" type="number" min="0" max="5000" value="<?= (int)$conf['aforo'] ?>">
        <input type="hidden" name="abierto" value="<?= $conf['abierto'] ? '1' : '0' ?>">
        <button class="btn" type="submit">Guardar aforo</button>
      </form>
      <form method="post" action="<?= $self ?>" class="inline" style="margin-top:10px">
        <input type="hidden" name="csrf" value="<?= $csrf ?>"><input type="hidden" name="accion" value="config">
        <input type="hidden" name="aforo" value="<?= (int)$conf['aforo'] ?>"><input type="hidden" name="abierto" value="<?= $conf['abierto'] ? '0' : '1' ?>">
        <button class="btn <?= $conf['abierto'] ? 'ghost' : '' ?>" type="submit"><?= $conf['abierto'] ? 'Cerrar inscripciones' : 'Abrir inscripciones' ?></button>
      </form>
    </section>
  </div>

  <form method="get" action="<?= $self ?>" class="inline" style="margin-bottom:14px" role="search">
    <input type="search" name="q" value="<?= $qs ?>" placeholder="Buscar por nombre, correo, entidad, teléfono o código" aria-label="Buscar inscripciones">
    <button class="btn" type="submit">Buscar</button>
    <?php if ($q !== ''): ?><a class="btn ghost" href="<?= $self ?>">Ver todas</a><?php endif; ?>
    <span class="noprint" style="opacity:.7">Consejo: el día del evento, busca por código o nombre y marca «Ha llegado».</span>
  </form>

  <div class="tbl">
  <?php if (!$rows): ?><p class="empty"><?= $q !== '' ? 'Nada coincide con la búsqueda.' : 'Todavía no hay inscripciones.' ?></p>
  <?php else: ?>
    <table>
      <thead><tr><th>Código</th><th>Nombre</th><th>Institución / entidad</th><th>Tipo</th><th>Pers.</th><th>Contacto</th><th>Comentario</th><th>Fecha</th><th>Llegada</th><th class="noprint"></th></tr></thead>
      <tbody>
      <?php foreach ($rows as $r): $yes = !empty($r['asistio']); ?>
        <tr id="r-<?= $e($r['id']) ?>" class="<?= $yes ? 'yes' : '' ?>">
          <td class="code"><?= $e($r['codigo']) ?></td>
          <td><b><?= $e($r['nombre']) ?></b></td>
          <td><?= $e($r['entidad'] ?: '—') ?></td>
          <td><?= $e(TIPOS[$r['tipo']] ?? $r['tipo']) ?></td>
          <td class="n"><?= (int)$r['personas'] ?></td>
          <td><a href="mailto:<?= $e($r['email']) ?>"><?= $e($r['email']) ?></a><?php if ($r['telefono']): ?><small><a href="tel:<?= $e(preg_replace('/\s+/', '', $r['telefono'])) ?>"><?= $e($r['telefono']) ?></a></small><?php endif; ?></td>
          <td><?= $e($r['comentario'] ?: '') ?></td>
          <td><small><?= $e(date('d/m/Y H:i', strtotime($r['fecha']))) ?></small></td>
          <td><form method="post" action="<?= $self ?>"><input type="hidden" name="csrf" value="<?= $csrf ?>"><input type="hidden" name="accion" value="asistio"><input type="hidden" name="id" value="<?= $e($r['id']) ?>"><input type="hidden" name="q" value="<?= $qs ?>"><button class="chk" type="submit" aria-pressed="<?= $yes ? 'true' : 'false' ?>"><?= $yes ? '✓ Ha llegado' : 'Ha llegado' ?></button></form></td>
          <td class="noprint"><a class="del" href="<?= $self ?>?borrar=<?= rawurlencode($r['id']) ?>">Borrar</a></td>
        </tr>
      <?php endforeach; ?>
      </tbody>
    </table>
  <?php endif; ?>
  </div>
  <p class="noprint" style="margin-top:14px;opacity:.65;font-size:.85rem">Los datos se borran automáticamente después del 31 de enero de 2027. Para imprimir la lista de la puerta, usa Ctrl+P.</p>
</main></body></html>
