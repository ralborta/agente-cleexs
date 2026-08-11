<?php
/**
 * Plugin Name: Cleexs — fix home SEO (one-shot)
 * Description: Corrige título/meta del index.html estático + Rank Math de la home. Subir a mu-plugins, visitar cleexs.net una vez, y borrar este archivo.
 * Path: public_html/wp-content/mu-plugins/cleexs-fix-home-seo.php
 */

if (!defined('ABSPATH')) {
    exit;
}

add_action('init', function () {
    if (get_option('cleexs_home_seo_fixed_v2')) {
        return;
    }

    $title = 'Cleexs - Conseguí clientes desde ChatGPT';
    $desc  = 'Conseguí clientes desde ChatGPT con Cleexs.';

    update_option('blogname', $title);
    update_option('blogdescription', $desc);

    $homeId = (int) get_option('page_on_front');
    if ($homeId > 0) {
        wp_update_post([
            'ID'         => $homeId,
            'post_title' => $title,
        ]);
        update_post_meta($homeId, 'rank_math_title', $title);
        update_post_meta($homeId, 'rank_math_description', $desc);
    }

    $titles = get_option('rank-math-options-titles');
    if (is_array($titles)) {
        $titles['homepage_title']       = $title;
        $titles['homepage_description'] = $desc;
        update_option('rank-math-options-titles', $titles);
    }

    // Home real = index.html estático en la raíz
    $index = ABSPATH . 'index.html';
    if (is_readable($index) && is_writable($index)) {
        $html = file_get_contents($index);
        if ($html !== false) {
            $html = preg_replace('/<title>.*?<\/title>/is', '<title>' . esc_html($title) . '</title>', $html, 1);
            if (preg_match('/<meta\s+name=["\']description["\']/i', $html)) {
                $html = preg_replace(
                    '/<meta\s+name=["\']description["\']\s+content=["\'][^"\']*["\']\s*\/?>/i',
                    '<meta name="description" content="' . esc_attr($desc) . '" />',
                    $html,
                    1
                );
            } else {
                $html = preg_replace(
                    '/<title>.*?<\/title>/is',
                    '<title>' . esc_html($title) . '</title>' . "\n  <meta name=\"description\" content=\"" . esc_attr($desc) . '" />',
                    $html,
                    1
                );
            }
            $html = preg_replace(
                '/property=["\']og:title["\']\s+content=["\'][^"\']*["\']/i',
                'property="og:title" content="' . esc_attr($title) . '"',
                $html
            );
            $html = preg_replace(
                '/content=["\'][^"\']*["\']\s+property=["\']og:title["\']/i',
                'content="' . esc_attr($title) . '" property="og:title"',
                $html
            );
            file_put_contents($index, $html);
        }
    }

    update_option('cleexs_home_seo_fixed_v2', 1);

    if (has_action('litespeed_purge_all')) {
        do_action('litespeed_purge_all');
    }
}, 20);
