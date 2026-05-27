<?php
/**
 * Plugin Name: NHR Smart Media Manager
 * Plugin URI: http://wordpress.org/plugins/nhrrob-smart-media-manager/
 * Description: AI-powered WordPress media manager with virtual folders, smart search, and one-click alt text generation.
 * Author: Nazmul Hasan Robin
 * Author URI: https://profiles.wordpress.org/nhrrob/
 * Version: 1.0.0
 * Requires at least: 6.0
 * Requires PHP: 7.4
 * Text Domain: nhrrob-smart-media-manager
 * License: GPLv2 or later
 * License URI: https://www.gnu.org/licenses/gpl-2.0.html
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

require_once __DIR__ . '/vendor/autoload.php';

final class Nhrsmm_Smart_Media_Manager {

	const version = '1.0.0';

	private function __construct() {
		$this->define_constants();
		add_action( 'plugins_loaded', [ $this, 'init_plugin' ] );
		register_activation_hook( NHRSMM_FILE, [ $this, 'activate' ] );
		register_deactivation_hook( NHRSMM_FILE, [ $this, 'deactivate' ] );
	}

	public static function init(): self {
		static $instance = false;
		if ( ! $instance ) {
			$instance = new self();
		}
		return $instance;
	}

	private function define_constants(): void {
		define( 'NHRSMM_VERSION',    self::version );
		define( 'NHRSMM_FILE',       __FILE__ );
		define( 'NHRSMM_PATH',       __DIR__ );
		define( 'NHRSMM_PLUGIN_DIR', plugin_dir_path( NHRSMM_FILE ) );
		define( 'NHRSMM_URL',        plugins_url( '', NHRSMM_FILE ) );
		define( 'NHRSMM_ASSETS',     NHRSMM_URL . '/assets' );
	}

	public function init_plugin(): void {
		\Nhrsmm\SmartMediaManager\App::init();
	}

	public function activate(): void {
		\Nhrsmm\SmartMediaManager\Activator::run();
	}

	public function deactivate(): void {
		\Nhrsmm\SmartMediaManager\Deactivator::run();
	}
}

function nhrsmm_smart_media_manager() {
	return Nhrsmm_Smart_Media_Manager::init();
}

nhrsmm_smart_media_manager();
