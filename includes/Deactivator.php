<?php
/**
 * Plugin deactivation handler.
 *
 * @package Nhrsmm\SmartMediaManager
 */

namespace Nhrsmm\SmartMediaManager;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Runs cleanup tasks when the plugin is deactivated.
 */
class Deactivator {

	/**
	 * Clears scheduled events and flushes rewrite rules on deactivation.
	 *
	 * @return void
	 */
	public static function run() {
		wp_unschedule_hook( 'nhrsmm_auto_alt' );
		flush_rewrite_rules();
	}
}
