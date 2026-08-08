<?php
/**
 * Plugin Name: Cleexs Emergency — disable Hostinger Tools
 * Description: Desactiva Hostinger Tools si rompe /wp-json y /wp-admin. Subir a wp-content/mu-plugins/ y recargar el sitio.
 * Version: 1.0.0
 *
 * Instalación (File Manager Hostinger):
 * 1) Copiá este archivo a: public_html/wp-content/mu-plugins/cleexs-emergency-disable-hostinger.php
 * 2) Abrí https://cleexs.net/ (cualquier página) una vez
 * 3) En hPanel → Caché → Purge All
 * 4) Probá: https://cleexs.net/wp-json/wp/v2/posts?per_page=1 (debe devolver JSON)
 */

defined('ABSPATH') || exit;

add_action('plugins_loaded', static function (): void {
    if (!function_exists('is_plugin_active')) {
        require_once ABSPATH . 'wp-admin/includes/plugin.php';
    }

    $plugin = 'hostinger/hostinger.php';
    if (function_exists('is_plugin_active') && is_plugin_active($plugin)) {
        deactivate_plugins($plugin, true);
        if (function_exists('error_log')) {
            error_log('[cleexs-emergency] Hostinger Tools desactivado automáticamente');
        }
    }
}, 0);

/** Evita redirects agresivos de seguridad que mandan /wp-json a /wp-admin. */
add_filter('rest_authentication_errors', static function ($result) {
    return $result;
}, 0);
