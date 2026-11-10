<?php
// Utilidades comunes de las inscripciones de MercaBásica 2026.
// No se sirve por web (api/.htaccess solo deja pasar los endpoints públicos).
declare(strict_types=1);

date_default_timezone_set('Atlantic/Canary');

const ALLOWED_HOST = 'myappsserver.duckdns.org';
const DATA_DIR = __DIR__ . '/data';
const INS_FILE = DATA_DIR . '/inscripciones.json';
const CONF_FILE = DATA_DIR . '/inscripciones-config.json';
// Los datos se borran solos pasada esta fecha (lo dice la política de privacidad)
const PURGE_AFTER = '2027-01-31 23:59:59';

const TIPOS = [
    'institucion' => 'Institución o administración',
    'centro'      => 'Centro educativo',
    'empresa'     => 'Empresa o entidad',
    'familia'     => 'Familia del alumnado',
    'prensa'      => 'Medio de comunicación',
    'particular'  => 'Particular',
];

/** Lee, modifica y guarda un JSON con bloqueo exclusivo. $fn devuelve [datos, retorno]. */
function update_json(string $file, callable $fn): mixed {
    $h = fopen($file, 'c+');
    if (!$h) throw new RuntimeException('No se puede abrir ' . basename($file));
    flock($h, LOCK_EX);
    $txt = stream_get_contents($h);
    $data = $txt ? json_decode($txt, true) : [];
    if (!is_array($data)) $data = [];
    [$data, $ret] = $fn($data);
    ftruncate($h, 0);
    rewind($h);
    fwrite($h, json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT));
    fflush($h);
    flock($h, LOCK_UN);
    fclose($h);
    @chmod($file, 0660);
    return $ret;
}

function read_json(string $file): array {
    if (!is_file($file)) return [];
    $h = fopen($file, 'r');
    if (!$h) return [];
    flock($h, LOCK_SH);
    $d = json_decode((string)stream_get_contents($h), true);
    flock($h, LOCK_UN);
    fclose($h);
    return is_array($d) ? $d : [];
}

function ensure_data_dir(): void {
    if (!is_dir(DATA_DIR) && !mkdir(DATA_DIR, 0770, true)) throw new RuntimeException('Sin carpeta de datos');
}

/** Configuración: abierto (bool) y aforo (personas; 0 = sin límite). */
function config(): array {
    return read_json(CONF_FILE) + ['abierto' => true, 'aforo' => 0];
}

function purge_if_expired(): void {
    if (time() <= strtotime(PURGE_AFTER)) return;
    foreach ([INS_FILE, DATA_DIR . '/pedidos.json'] as $f) if (is_file($f)) @unlink($f);
}

function total_personas(array $list): int {
    return array_sum(array_map(fn($r) => (int)($r['personas'] ?? 0), $list));
}

/** Huella irreversible de la conexión (HMAC con sal diaria); no se guarda la IP. */
function conn_hash(): string {
    $saltFile = DATA_DIR . '/salt-' . date('Ymd');
    if (!is_file($saltFile)) {
        foreach (glob(DATA_DIR . '/salt-*') ?: [] as $old) @unlink($old);
        file_put_contents($saltFile, bin2hex(random_bytes(32)), LOCK_EX);
    }
    $salt = (string)file_get_contents($saltFile);
    return substr(hash_hmac('sha256', ($_SERVER['REMOTE_ADDR'] ?? '') . '|' . ($_SERVER['HTTP_USER_AGENT'] ?? ''), $salt), 0, 16);
}

/** Límite de intentos por conexión y global en una ventana de $secs segundos. */
function rate_ok(string $name, int $secs, int $perConn, int $total): bool {
    $window = intdiv(time(), $secs);
    foreach (glob(DATA_DIR . "/$name-*.json") ?: [] as $f) {
        if ((int)substr(basename($f, '.json'), strlen($name) + 1) < $window) @unlink($f);
    }
    $conn = conn_hash();
    return update_json(DATA_DIR . "/$name-$window.json", function (array $d) use ($conn, $perConn, $total) {
        $d['_total'] = ($d['_total'] ?? 0) + 1;
        $d[$conn] = ($d[$conn] ?? 0) + 1;
        return [$d, $d['_total'] <= $total && $d[$conn] <= $perConn];
    });
}

function clean(string $s, int $max): string {
    $s = preg_replace('/[\x00-\x1F\x7F]+/u', ' ', $s) ?? '';
    $s = trim(preg_replace('/\s+/u', ' ', $s) ?? '');
    return mb_substr($s, 0, $max);
}

function new_code(array $list, string $prefix = 'MB26-'): string {
    $alpha = 'ACDEFGHJKMNPQRTUVWXY34679';
    $used = array_column($list, 'codigo');
    do {
        $c = $prefix;
        for ($i = 0; $i < 4; $i++) $c .= $alpha[random_int(0, strlen($alpha) - 1)];
    } while (in_array($c, $used, true));
    return $c;
}
