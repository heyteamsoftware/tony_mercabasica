<?php
// Catálogo público: productos del sheet con lo que queda de stock (JSON).
declare(strict_types=1);
require __DIR__ . '/catalogo-lib.php';

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header('X-Robots-Tag: noindex, nofollow');

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'GET') { http_response_code(405); exit('{}'); }
try {
    purge_if_expired();
    $body = json_encode(['ok' => true] + public_catalog(), JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    if (fotos_due()) respond_then($body, fn() => sync_fotos());
    echo $body;
} catch (Throwable $ex) {
    error_log('catalogo.php: ' . $ex->getMessage());
    http_response_code(500);
    echo '{"ok":false}';
}
