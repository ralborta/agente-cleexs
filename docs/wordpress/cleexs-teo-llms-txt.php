<?php
/**
 * Plugin Name: Cleexs Teo — llms.txt + IndexNow
 * Description: Sirve /llms.txt y {IndexNowKey}.txt en text/plain; sincroniza archivos en la raíz.
 * Version: 1.1.0
 * Author: Cleexs
 */
if (!defined('ABSPATH')) {
    exit;
}

/* ========== llms.txt ========== */

function cleexs_teo_llms_extract_text($page) {
    $raw = $page->post_content;
    if (preg_match('/<pre[^>]*class="[^"]*cleexs-llms[^"]*"[^>]*>(.*?)<\/pre>/is', $raw, $m)) {
        return trim(html_entity_decode(wp_strip_all_tags($m[1]), ENT_QUOTES | ENT_HTML5, 'UTF-8'));
    }
    return trim(html_entity_decode(wp_strip_all_tags($raw), ENT_QUOTES | ENT_HTML5, 'UTF-8'));
}

function cleexs_teo_llms_sync_file($page = null) {
    if (!$page) {
        $page = get_page_by_path('llms-txt');
    }
    if (!$page || $page->post_status !== 'publish') {
        return false;
    }
    $text = cleexs_teo_llms_extract_text($page);
    $path = ABSPATH . 'llms.txt';
    return file_put_contents($path, $text . "\n") !== false;
}

function cleexs_teo_serve_llms_txt() {
    $uri = $_SERVER['REQUEST_URI'] ?? '';
    $path = parse_url($uri, PHP_URL_PATH);
    if (!is_string($path)) {
        return;
    }
    $path = rtrim($path, '/');
    if ($path !== '/llms.txt') {
        return;
    }

    $page = get_page_by_path('llms-txt');
    if (!$page || $page->post_status !== 'publish') {
        status_header(404);
        header('Content-Type: text/plain; charset=utf-8');
        echo "llms.txt not found. Publish the llms-txt page from Cleexs backoffice.\n";
        exit;
    }

    $text = cleexs_teo_llms_extract_text($page);
    @file_put_contents(ABSPATH . 'llms.txt', $text . "\n");

    nocache_headers();
    header('Content-Type: text/plain; charset=utf-8');
    header('X-Robots-Tag: noindex');
    header('X-Cleexs-Llms: teo');
    status_header(200);
    echo $text . "\n";
    exit;
}

add_action('init', 'cleexs_teo_serve_llms_txt', 0);
add_action('template_redirect', 'cleexs_teo_serve_llms_txt', 0);

/* ========== IndexNow key ========== */

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
    return file_put_contents(ABSPATH . $key . '.txt', $key) !== false;
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
    header('X-Cleexs-IndexNow: teo');
    status_header(200);
    echo $key;
    exit;
}

add_action('init', 'cleexs_teo_serve_indexnow_key', 0);
add_action('template_redirect', 'cleexs_teo_serve_indexnow_key', 0);

add_action('save_post_page', function ($post_id, $post) {
    if (wp_is_post_revision($post_id)) {
        return;
    }
    if ($post->post_name === 'llms-txt' && $post->post_status === 'publish') {
        cleexs_teo_llms_sync_file($post);
    }
    if ($post->post_name === 'indexnow-key' && $post->post_status === 'publish') {
        cleexs_teo_indexnow_sync_file($post);
    }
}, 20, 2);

add_action('init', function () {
    if (!get_option('cleexs_teo_llms_synced_v110')) {
        cleexs_teo_llms_sync_file();
        cleexs_teo_indexnow_sync_file();
        update_option('cleexs_teo_llms_synced_v110', gmdate('c'), false);
    }
}, 5);
