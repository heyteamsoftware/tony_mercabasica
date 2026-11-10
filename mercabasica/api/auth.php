<?php
// Acceso del equipo a los paneles (inscripciones y pedidos). Una sola contraseña,
// guardada solo en el servidor como hash Argon2id en data/admin.hash.
// No se sirve por web (api/.htaccess).
declare(strict_types=1);
require_once __DIR__ . '/inc.php';

const IDLE = 4 * 3600;

function h(mixed $s): string { return htmlspecialchars((string)$s, ENT_QUOTES, 'UTF-8'); }
function go(string $to): never { header('Location: ' . $to, true, 303); exit; }

/** Muestra el login si no hay sesión. Devuelve el token anti-CSRF y gestiona «Salir». */
function admin_gate(string $self, string $scope): string {
    header('Content-Type: text/html; charset=utf-8');
    header('Cache-Control: no-store');
    header('X-Robots-Tag: noindex, nofollow');
    header("Content-Security-Policy: default-src 'none'; style-src 'self' 'unsafe-inline'; font-src 'self'; img-src 'self' data:; form-action 'self'; frame-ancestors 'none'; base-uri 'none'");
    ensure_data_dir();
    purge_if_expired();

    $sessDir = DATA_DIR . '/sess';
    if (!is_dir($sessDir)) mkdir($sessDir, 0770, true);
    session_save_path($sessDir);
    session_name('MB26ADM');
    ini_set('session.gc_maxlifetime', (string)IDLE);
    ini_set('session.gc_probability', '1');
    ini_set('session.gc_divisor', '50');
    ini_set('session.use_strict_mode', '1');
    session_set_cookie_params(['lifetime' => 0, 'path' => '/mercabasica/api/', 'secure' => true, 'httponly' => true, 'samesite' => 'Strict']);
    session_start();

    if (!empty($_SESSION['ok']) && time() - (int)($_SESSION['t'] ?? 0) > IDLE) { $_SESSION = []; session_regenerate_id(true); }
    $method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
    $error = '';
    $has = fn() => !empty($_SESSION['ok']) && in_array($scope, (array)($_SESSION['scopes'] ?? []), true);

    if (!$has() && $method === 'POST' && isset($_POST['clave'])) {
        // admin.hash = contraseña general (todo); pedidos.hash = solo el panel de pedidos
        $clave = (string)$_POST['clave'];
        $check = fn(string $f) => is_file(DATA_DIR . "/$f") && password_verify($clave, trim((string)file_get_contents(DATA_DIR . "/$f")));
        $grant = [];
        if (!rate_ok('rll', 900, 8, 200)) $error = 'Demasiados intentos. Espera unos minutos.';
        elseif ($check('admin.hash')) $grant = ['ins', 'ped'];
        elseif ($check('pedidos.hash')) $grant = ['ped'];
        if ($grant && in_array($scope, $grant, true)) {
            $prev = !empty($_SESSION['ok']) ? (array)($_SESSION['scopes'] ?? []) : [];
            session_regenerate_id(true);
            $_SESSION = ['ok' => 1, 't' => time(), 'csrf' => bin2hex(random_bytes(16)), 'scopes' => array_values(array_unique(array_merge($prev, $grant)))];
            go($self);
        }
        if (!$error) { usleep(600000); $error = $grant ? 'Esta contraseña no da acceso a esta sección.' : 'Contraseña incorrecta.'; }
    } elseif (!$has() && !empty($_SESSION['ok'])) {
        $error = 'Esta sección necesita otra contraseña.';
    }

    if (!$has()) {
        $sub = $scope === 'ped' ? 'MercaBásica 2026 · pedidos por zonas' : 'MercaBásica 2026 · inscripciones';
        echo '<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex, nofollow">'
            . '<title>Acceso · Equipo MercaBásica 2026</title><link rel="stylesheet" href="../assets/css/fonts.css"><style>'
            . 'body{margin:0;min-height:100vh;display:grid;place-items:center;padding:24px;background:#FBF6EC;color:#0A2150;font:16px/1.5 "Bricolage Grotesque",system-ui,sans-serif}'
            . 'form{width:min(380px,100%);padding:32px 28px;background:#FFFEFA;border:2px solid #0A2150;border-radius:18px;box-shadow:6px 6px 0 #0A2150}'
            . 'h1{margin:0 0 .2rem;font:700 2rem/1.05 Fraunces,Georgia,serif}p{margin:0 0 1.4rem;opacity:.75}'
            . 'label{display:block;font:500 .72rem/1 "DM Mono",monospace;letter-spacing:.12em;text-transform:uppercase;margin-bottom:.5rem}'
            . 'input{width:100%;box-sizing:border-box;padding:.8rem .9rem;border:2px solid #0A2150;border-radius:10px;font:inherit;background:#fff}'
            . 'button{margin-top:1.1rem;width:100%;padding:.85rem;border:0;border-radius:999px;background:#0A2150;color:#FFFBF3;font:500 .8rem/1 "DM Mono",monospace;letter-spacing:.1em;text-transform:uppercase;cursor:pointer;box-shadow:3px 3px 0 #CC544C}'
            . '.err{margin:.9rem 0 0;color:#A63A31;font-weight:600;opacity:1}</style></head><body>'
            . '<form method="post" action="' . h($self) . '"><h1>Equipo</h1><p>' . h($sub) . '</p>'
            . '<label for="clave">Contraseña</label><input id="clave" name="clave" type="password" autocomplete="current-password" required autofocus>'
            . '<button type="submit">Entrar</button>' . ($error ? '<p class="err" role="alert">' . h($error) . '</p>' : '') . '</form></body></html>';
        exit;
    }

    $_SESSION['t'] = time();
    if ($method === 'POST') {
        if (!hash_equals((string)$_SESSION['csrf'], (string)($_POST['csrf'] ?? ''))) { http_response_code(400); exit('Token no válido. Vuelve atrás y recarga.'); }
        if (($_POST['accion'] ?? '') === 'salir') { $_SESSION = []; session_destroy(); go($self); }
    }
    return (string)$_SESSION['csrf'];
}

/** Barra superior común de los paneles. */
function admin_top(string $title, string $csrf, string $self, string $active, string $extra = ''): string {
    $tab = fn($href, $label, $key) => in_array($key, (array)($_SESSION['scopes'] ?? []), true) ? '<a href="' . $href . '"' . ($active === $key ? ' aria-current="page"' : '') . '>' . $label . '</a>' : '';
    return '<header class="top"><h1>' . h($title) . '</h1><nav class="tabs">' . $tab('admin.php', 'Inscripciones', 'ins') . $tab('pedidos-admin.php', 'Pedidos', 'ped') . '</nav><span class="sp"></span>'
        . $extra . '<a href="../" target="_blank" rel="noopener">Ver la web</a>'
        . '<form method="post" action="' . h($self) . '" class="inline"><input type="hidden" name="csrf" value="' . h($csrf) . '"><input type="hidden" name="accion" value="salir"><button type="submit">Salir</button></form></header>';
}
