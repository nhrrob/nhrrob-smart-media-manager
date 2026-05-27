<?php
/**
 * Plugin activation handler.
 *
 * @package Nhrsmm\SmartMediaManager
 */

namespace Nhrsmm\SmartMediaManager;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Runs tasks that must execute once when the plugin is activated.
 */
class Activator {

	/**
	 * Seeds default settings and the Uncategorized folder, then flushes rewrite rules.
	 *
	 * @return void
	 */
	public static function run() {
		if ( ! get_option( 'nhrsmm_settings' ) ) {
			update_option(
				'nhrsmm_settings',
				[
					'default_view'   => 'grid',
					'thumbnail_size' => 'medium',
					'items_per_page' => 40,
				]
			);
		}

		// Ensure the "Uncategorized" default folder exists.
		if ( ! term_exists( 'Uncategorized', 'nhrsmm_media_folder' ) ) {
			wp_insert_term(
				'Uncategorized',
				'nhrsmm_media_folder',
				[
					'slug'   => 'uncategorized',
					'parent' => 0,
				]
			);
		}

		flush_rewrite_rules();
	}
}
