<?php
/**
 * Plugin Name: Cleexs Teo — llms.txt
 * Description: Sirve /llms.txt en text/plain desde la página WP con slug llms-txt (publicada por Teo).
 * Version: 1.0.0
 * Author: Cleexs
 *
 * Instalación:
 * 1. Copiar a public_html/wp-content/mu-plugins/cleexs-teo-llms-txt.php
 * 2. En el backoffice Cleexs → Integraciones → Fundaciones SEO → “Publicar llms.txt”
 * 3. Ajustes → Enlaces permanentes → Guardar (flush rewrite rules) una vez
 */

if (!defined('ABSPATH')) {
    exit;
}

add_action('init', function () {
    add_rewrite_rule('^llms\.txt$', 'index.php?cleexs_llms=1', 'top');
});

add_filter('query_vars', function ($vars) {
    $vars[] = 'cleexs_llms';
    return $vars;
});

add_action('template_redirect', function () {
    if ((int) get_query_var('cleexs_llms') !== 1) {
        return;
    }

    $page = get_page_by_path('llms-txt');
    if (!$page || $page->post_status !== 'publish') {
        status_header(404);
        header('Content-Type: text/plain; charset=utf-8');
        echo "llms.txt not found. Publish the llms-txt page from Cleexs backoffice.\n";
        exit;
    }

    $raw = $page->post_content;
    // Extraer texto de <pre class="cleexs-llms">…</pre> si existe
    if (preg_match('/<pre[^>]*class="[^"]*cleexs-llms[^"]*"[^>]*>(.*?)<\/pre>/is', $raw, $m)) {
        $text = html_entity_decode(wp_strip_all_tags($m[1]), ENT_QUOTES | ENT_HTML5, 'UTF-8');
    } else {
        $text = html_entity_decode(wp_strip_all_tags($raw), ENT_QUOTES | ENT_HTML5, 'UTF-8');
    }

    header('Content-Type: text/plain; charset=utf-8');
    header('X-Robots-Tag: noindex');
    status_header(200);
    echo trim($text) . "\n";
    exit;
});
