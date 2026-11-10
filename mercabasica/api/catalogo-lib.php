<?php
// Catálogo de MercaBásica 2026 leído en vivo del Google Sheet del equipo.
//  - Datos (código, precio, stock, descripción): CSV del sheet, caché de 20 s.
//  - Fotos: van pegadas sobre las celdas, así que se sacan del .xlsx cada 30 min
//    y se guardan como webp ligeros en /catalogo.
// No se sirve por web (api/.htaccess).
declare(strict_types=1);
require_once __DIR__ . '/inc.php';

const SHEET_ID = '1FLKuIc8aaCrX6EfM-m81ACEBnb-F-r0m6sweiBaWvLA';
const SHEET_GID = '0';
const CAT_CACHE = DATA_DIR . '/catalogo-cache.json';
const IMG_STATE = DATA_DIR . '/catalogo-fotos.json';
const IMG_DIR = __DIR__ . '/../catalogo';
const CAT_TTL = 20;          // segundos
const IMG_TTL = 1800;        // segundos
const PED_FILE = DATA_DIR . '/pedidos.json';

const ZONAS = ['PAS' => 'Panadería', 'FAB' => 'Fabricación y montaje', 'MAD' => 'Madera', 'ALM' => 'Almacén'];
const ESTADOS = [
    'pendiente'     => 'Pendiente',
    'confirmado'    => 'Confirmado',
    'listo'         => 'Listo para recoger',
    'entregado'     => 'Entregado',
    'no_disponible' => 'No disponible',
];
const SIN_RESERVA = ['no_disponible'];   // estos no restan stock

function http_get(string $url, ?string $toFile = null, int $timeout = 15): ?string {
    $ch = curl_init($url);
    $fh = $toFile ? fopen($toFile, 'w') : null;
    curl_setopt_array($ch, [
        CURLOPT_FOLLOWLOCATION => true, CURLOPT_MAXREDIRS => 5, CURLOPT_TIMEOUT => $timeout,
        CURLOPT_CONNECTTIMEOUT => 6, CURLOPT_USERAGENT => 'MercaBasica2026/1.0',
    ] + ($fh ? [CURLOPT_FILE => $fh] : [CURLOPT_RETURNTRANSFER => true]));
    $body = curl_exec($ch);
    $code = (int)curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
    curl_close($ch);
    if ($fh) fclose($fh);
    if ($code !== 200 || $body === false) return null;
    return $fh ? $toFile : (string)$body;
}

function write_json_atomic(string $file, array $data): void {
    $tmp = $file . '.' . bin2hex(random_bytes(4)) . '.tmp';
    file_put_contents($tmp, json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES));
    @chmod($tmp, 0660);
    rename($tmp, $file);
}

/** "15€", "6,50 €", "12" → céntimos; null si no es un precio. */
function parse_price(string $s): ?int {
    $s = str_replace(['€', ' ', "\u{00A0}", 'EUR', 'eur'], '', trim($s));
    $s = str_replace(',', '.', $s);
    if (!preg_match('/^\d{1,5}(\.\d{1,2})?$/', $s)) return null;
    return (int)round((float)$s * 100);
}

function norm(string $s): string {
    $s = mb_strtolower(trim($s));
    return strtr($s, ['á' => 'a', 'é' => 'e', 'í' => 'i', 'ó' => 'o', 'ú' => 'u']);
}

/** CSV del sheet → productos por código. Las columnas se localizan por su título. */
function parse_catalog_csv(string $csv): array {
    $h = fopen('php://temp', 'r+');
    fwrite($h, $csv);
    rewind($h);
    $rows = [];
    while (($r = fgetcsv($h, 0, ',', '"', '')) !== false) $rows[] = $r;
    fclose($h);
    if (!$rows) return [];
    $col = ['codigo' => 1, 'precio' => 2, 'stock' => 3, 'descripcion' => 4];
    foreach ($rows[0] as $i => $title) {
        $t = norm((string)$title);
        if (str_contains($t, 'codigo')) $col['codigo'] = $i;
        elseif (str_contains($t, 'precio')) $col['precio'] = $i;
        elseif (str_contains($t, 'stock')) $col['stock'] = $i;
        elseif (str_contains($t, 'descrip')) $col['descripcion'] = $i;
    }
    $out = [];
    foreach ($rows as $idx => $r) {
        if ($idx === 0) continue;
        $code = strtoupper(trim((string)($r[$col['codigo']] ?? '')));
        if (!preg_match('/^(PAS|FAB|MAD|ALM)-[A-Z0-9]{1,8}$/', $code) || isset($out[$code])) continue;
        $price = parse_price((string)($r[$col['precio']] ?? ''));
        $desc = trim(preg_replace('/\s+/u', ' ', (string)($r[$col['descripcion']] ?? '')) ?? '');
        $stockRaw = trim((string)($r[$col['stock']] ?? ''));
        $stock = $stockRaw === '' ? null : (preg_match('/^\d+$/', $stockRaw) ? (int)$stockRaw : 0);
        $out[$code] = [
            'codigo' => $code, 'zona' => substr($code, 0, 3), 'descripcion' => mb_substr($desc, 0, 400),
            'precio' => $price, 'stock' => $stock, 'fila' => $idx + 1,
            'visible' => $price !== null && $desc !== '',
        ];
    }
    return $out;
}

/** Catálogo con caché corta. $fresh fuerza leer el sheet (al hacer un pedido). */
function catalog(bool $fresh = false): array {
    ensure_data_dir();
    $cache = read_json(CAT_CACHE);
    $age = time() - (int)($cache['t'] ?? 0);
    if (!empty($cache['productos']) && $age < ($fresh ? 3 : CAT_TTL)) return $cache;

    $lock = fopen(DATA_DIR . '/catalogo.lock', 'c');
    if (!$fresh && !empty($cache['productos']) && !flock($lock, LOCK_EX | LOCK_NB)) return $cache; // otro ya lo está leyendo
    if ($fresh || empty($cache['productos'])) flock($lock, LOCK_EX);
    $cache = read_json(CAT_CACHE);
    if (!empty($cache['productos']) && time() - (int)($cache['t'] ?? 0) < ($fresh ? 3 : CAT_TTL)) { flock($lock, LOCK_UN); return $cache; }

    $csv = http_get('https://docs.google.com/spreadsheets/d/' . SHEET_ID . '/export?format=csv&gid=' . SHEET_GID);
    $prods = $csv !== null ? parse_catalog_csv($csv) : [];
    if ($csv === null || !$prods) {
        $cache['error'] = time();
        if (!empty($cache['productos'])) write_json_atomic(CAT_CACHE, $cache);
        flock($lock, LOCK_UN);
        return $cache + ['productos' => []];
    }
    $new = ['t' => time(), 'productos' => $prods];
    write_json_atomic(CAT_CACHE, $new);
    flock($lock, LOCK_UN);
    return $new;
}

/** Unidades reservadas por código (todas las líneas salvo «No disponible»). */
function reserved(array $orders): array {
    $n = [];
    foreach ($orders as $o) {
        foreach ($o['lineas'] ?? [] as $l) {
            if (in_array($l['estado'] ?? 'pendiente', SIN_RESERVA, true)) continue;
            $n[$l['codigo']] = ($n[$l['codigo']] ?? 0) + (int)$l['cantidad'];
        }
    }
    return $n;
}

function fotos_state(): array { return read_json(IMG_STATE); }
function fotos_due(): bool { return time() - (int)(fotos_state()['t'] ?? 0) > IMG_TTL; }

function zip_path(string $base, string $target): string {
    if (str_starts_with($target, '/')) return ltrim($target, '/');
    $parts = explode('/', dirname($base) . '/' . $target);
    $out = [];
    foreach ($parts as $p) {
        if ($p === '' || $p === '.') continue;
        if ($p === '..') array_pop($out); else $out[] = $p;
    }
    return implode('/', $out);
}

function rels(ZipArchive $z, string $partPath): array {
    $relPath = dirname($partPath) . '/_rels/' . basename($partPath) . '.rels';
    $xml = $z->getFromName($relPath);
    $map = [];
    if ($xml && preg_match_all('/<Relationship\b[^>]*>/', $xml, $m)) {
        foreach ($m[0] as $tag) {
            if (preg_match('/\bId="([^"]+)"/', $tag, $a) && preg_match('/\bTarget="([^"]+)"/', $tag, $b)) $map[$a[1]] = zip_path($partPath, $b[1]);
        }
    }
    return $map;
}

/** Descarga el .xlsx, saca la foto de cada fila y la guarda como webp. */
function sync_fotos(bool $wait = false): array {
    ensure_data_dir();
    $lock = fopen(DATA_DIR . '/fotos.lock', 'c');
    if (!flock($lock, $wait ? LOCK_EX : LOCK_EX | LOCK_NB)) return fotos_state();
    @set_time_limit(240);
    @ini_set('memory_limit', '768M');
    $state = fotos_state();
    $tmp = tempnam(DATA_DIR, 'xl');
    try {
        if (!is_dir(IMG_DIR) && !mkdir(IMG_DIR, 0775, true)) throw new RuntimeException('Sin carpeta de fotos');
        if (http_get('https://docs.google.com/spreadsheets/d/' . SHEET_ID . '/export?format=xlsx', $tmp, 180) === null) throw new RuntimeException('No se pudo descargar el sheet');
        $z = new ZipArchive();
        if ($z->open($tmp) !== true) throw new RuntimeException('El .xlsx no se abre');
        // primera hoja del libro
        $wbRels = rels($z, 'xl/workbook.xml');
        $wb = (string)$z->getFromName('xl/workbook.xml');
        if (!preg_match('/<sheet\b[^>]*\br:id="([^"]+)"/', $wb, $m) || !isset($wbRels[$m[1]])) throw new RuntimeException('Sin hoja');
        $sheetPath = $wbRels[$m[1]];
        $byRow = [];
        foreach (rels($z, $sheetPath) as $target) {
            if (!str_contains($target, 'drawings/')) continue;
            $dXml = (string)$z->getFromName($target);
            $dRels = rels($z, $target);
            preg_match_all('/<xdr:(oneCellAnchor|twoCellAnchor)\b.*?<\/xdr:\1>/s', $dXml, $anchors);
            foreach ($anchors[0] as $a) {
                if (!preg_match('/<xdr:from>.*?<xdr:row>(\d+)<\/xdr:row>/s', $a, $r) || !preg_match('/r:embed="([^"]+)"/', $a, $e)) continue;
                $row = (int)$r[1] + 1;
                if (isset($dRels[$e[1]]) && !isset($byRow[$row])) $byRow[$row] = $dRels[$e[1]];
            }
        }
        $cat = catalog();
        $fotos = [];
        foreach ($cat['productos'] ?? [] as $code => $p) {
            $media = $byRow[$p['fila']] ?? null;
            if (!$media) continue;
            $bytes = $z->getFromName($media);
            if (!$bytes) continue;
            $name = $code . '-' . substr(sha1($bytes), 0, 10) . '.webp';
            if (!is_file(IMG_DIR . '/' . $name) && !make_thumb($bytes, IMG_DIR . '/' . $name)) continue;
            $fotos[$code] = $name;
        }
        $z->close();
        // quita las fotos que ya no se usan
        foreach (glob(IMG_DIR . '/*.webp') ?: [] as $f) if (!in_array(basename($f), $fotos, true)) @unlink($f);
        $state = ['t' => time(), 'fotos' => $fotos];
    } catch (Throwable $ex) {
        error_log('sync_fotos: ' . $ex->getMessage());
        $state['t'] = time() - IMG_TTL + 300;   // reintenta en 5 minutos
        $state['error'] = $ex->getMessage();
    } finally {
        @unlink($tmp);
    }
    write_json_atomic(IMG_STATE, $state);
    flock($lock, LOCK_UN);
    return $state;
}

function make_thumb(string $bytes, string $dest, int $max = 720): bool {
    $src = @imagecreatefromstring($bytes);
    if (!$src) return false;
    $w = imagesx($src); $h = imagesy($src);
    $k = min(1, $max / max($w, $h));
    $nw = max(1, (int)round($w * $k)); $nh = max(1, (int)round($h * $k));
    $dst = imagecreatetruecolor($nw, $nh);
    imagealphablending($dst, false);
    imagesavealpha($dst, true);
    imagefill($dst, 0, 0, imagecolorallocatealpha($dst, 255, 255, 255, 127));
    imagecopyresampled($dst, $src, 0, 0, 0, 0, $nw, $nh, $w, $h);
    $tmp = $dest . '.tmp';
    $ok = imagewebp($dst, $tmp, 80);
    imagedestroy($src); imagedestroy($dst);
    if (!$ok) return false;
    @chmod($tmp, 0664);
    return rename($tmp, $dest);
}

/** Envía la respuesta y sigue trabajando después (para refrescar fotos sin hacer esperar a nadie). */
function respond_then(string $body, callable $after): never {
    if (function_exists('apache_setenv')) @apache_setenv('no-gzip', '1');
    ignore_user_abort(true);
    header('Content-Length: ' . strlen($body));
    header('Connection: close');
    echo $body;
    while (ob_get_level()) ob_end_flush();
    flush();
    if (function_exists('fastcgi_finish_request')) fastcgi_finish_request();
    $after();
    exit;
}

/** Productos visibles con lo que queda de stock. */
function public_catalog(): array {
    $cat = catalog();
    $fotos = fotos_state()['fotos'] ?? [];
    $res = reserved(read_json(PED_FILE));
    $list = [];
    foreach ($cat['productos'] ?? [] as $code => $p) {
        if (!$p['visible']) continue;
        $list[] = [
            'codigo' => $code, 'zona' => $p['zona'], 'descripcion' => $p['descripcion'], 'precio' => $p['precio'],
            'stock' => $p['stock'], 'quedan' => $p['stock'] === null ? null : max(0, $p['stock'] - ($res[$code] ?? 0)),
            'foto' => isset($fotos[$code]) ? 'catalogo/' . $fotos[$code] : null,
        ];
    }
    return ['actualizado' => isset($cat['t']) ? date('c', (int)$cat['t']) : null, 'productos' => $list];
}

function euros(int $cents): string {
    return number_format($cents / 100, $cents % 100 ? 2 : 0, ',', '.') . ' €';
}
