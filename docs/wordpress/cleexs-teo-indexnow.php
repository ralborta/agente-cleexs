<?php
/**
 * Plugin Name: Cleexs Teo — IndexNow key
 * Description: Escribe {key}.txt en la raíz del sitio desde la página WP slug indexnow-key (Teo).
 * Version: 1.0.0
 * Author: Cleexs
 *
 * Instalación: mu-plugins/cleexs-teo-indexnow.php
 * Luego: Integraciones/Publicaciones → publicar IndexNow key (o POST indexing/indexnow-key)
 */
if (!defined('ABSPATH')) {
    exit;
}

function cleexs_teo_indexnow_extract_key($page) {
    $raw = $page->post_content;
    if (preg_match('/<pre[^>]*class="[^"]*cleexs-indexnow[^"]*"[^>]*>(.*?)<\/pre>/is', $raw, $m)) {
        return trim(html_entity_decode(wp_strip_all_tags($m[1]), ENT_QUOTES | ENT_HTML5, 'UTF-8'));
    }
    return trim(html_entity_decode(wp_strip_all_tags($raw), ENT_QUOTES | ENT_HTML5, 'UTF-8'));
}

function cleexs_teo_indexnow_sync_file($page = null) {
    if (!$page) {
        $page = get_page_by_path('indexnow-key');
    }
    if (!$page || $page->post_status !== 'publish') {
        return false;
    }
    $key = cleexs_teo_indexnow_extract_key($page);
    if ($key === '' || !preg_match('/^[A-Za-z0-9\-]{8,128}$/', $key)) {
        return false;
    }
    $path = ABSPATH . $key . '.txt';
    return file_put_contents($path, $key) !== false;
}

function cleexs_teo_serve_indexnow_key() {
    $uri = $_SERVER['REQUEST_URI'] ?? '';
    $path = parse_url($uri, PHP_URL_PATH);
    if (!is_string($path)) {
        return;
    }
    $path = trim($path, '/');
    if (!preg_match('/^([A-Za-z0-9\-]{8,128})\.txt$/', $path, $m)) {
        return;
    }

    $page = get_page_by_path('indexnow-key');
    if (!$page || $page->post_status !== 'publish') {
        return;
    }
    $key = cleexs_teo_indexnow_extract_key($page);
    if ($key === '' || $m[1] !== $key) {
        return;
    }

    @file_put_contents(ABSPATH . $key . '.txt', $key);
    nocache_headers();
    header('Content-Type: text/plain; charset=utf-8');
    header('X-Robots-Tag: noindex');
    status_header(200);
    echo $key;
    exit;
}

add_action('init', 'cleexs_teo_serve_indexnow_key', 0);
add_action('template_redirect', 'cleexs_teo_serve_indexnow_key', 0);

add_action('save_post_page', function ($post_id, $post) {
    if (wp_is_post_revision($post_id) || $post->post_name !== 'indexnow-key') {
        return;
    }
    if ($post->post_status === 'publish') {
        cleexs_teo_indexnow_sync_file($post);
    }
}, 20, 2);

add_action('init', function () {
    if (!get_option('cleexs_teo_indexnow_synced_v100')) {
        if (cleexs_teo_indexnow_sync_file()) {
            update_option('cleexs_teo_indexnow_synced_v100', gmdate('c'), false);
        }
    }
}, 5);
