<?php
/**
 * Plugin Name: Cleexs Teo — Rank Math REST
 * Description: Expone campos SEO de Rank Math vía REST API para publicaciones automáticas de Teo (Agente Cleexs).
 * Version: 1.0.0
 * Author: Cleexs
 *
 * Instalación:
 * 1. Instalar y activar Rank Math SEO en WordPress.
 * 2. Copiar este archivo a: wp-content/mu-plugins/cleexs-teo-rankmath-rest.php
 *    (crear carpeta mu-plugins si no existe)
 * 3. En Easypanel API: WORDPRESS_SEO_PLUGIN=rankmath
 */

if (!defined('ABSPATH')) {
    exit;
}

add_action('init', function () {
    $keys = [
        'rank_math_title',
        'rank_math_description',
        'rank_math_focus_keyword',
    ];

    foreach ($keys as $key) {
        register_post_meta('post', $key, [
            'show_in_rest'  => true,
            'single'        => true,
            'type'          => 'string',
            'auth_callback' => function () {
                return current_user_can('edit_posts');
            },
        ]);
    }
});
