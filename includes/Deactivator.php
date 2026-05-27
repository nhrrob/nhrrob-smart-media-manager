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
	 * Flushes rewrite rules on deactivation.
	 *
	 * @return void
	 */
	public static function run() {
		flush_rewrite_rules();
	}
}
