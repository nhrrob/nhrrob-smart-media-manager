<?php
/**
 * Plugin Name: NHR Smart Media Manager
 * Plugin URI: http://wordpress.org/plugins/nhrrob-smart-media-manager/
 * Description: AI-powered WordPress media manager with virtual folders, smart search, and one-click alt text generation.
 * Author: Nazmul Hasan Robin
 * Author URI: https://profiles.wordpress.org/nhrrob/
 * Version: 1.0.0
 * Requires at least: 7.0
 * Requires PHP: 7.4
 * Text Domain: nhrrob-smart-media-manager
 * License: GPLv2 or later
 * License URI: https://www.gnu.org/licenses/gpl-2.0.html
 *
 * @package Nhrsmm\SmartMediaManager
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

// PSR-4 autoloader: Nhrsmm\SmartMediaManager\ -> includes/.
spl_autoload_register(
	static function ( $class_name ) {
		$prefix = 'Nhrsmm\\SmartMediaManager\\';
		$len    = strlen( $prefix );
		if ( strncmp( $prefix, $class_name, $len ) !== 0 ) {
			return;
		}
		$relative = substr( $class_name, $len );
		$file     = __DIR__ . '/includes/' . str_replace( '\\', '/', $relative ) . '.php';
		if ( file_exists( $file ) ) {
			require $file;
		}
	}
);

/**
 * Main plugin class — singleton bootstrap.
 */
final class Nhrsmm_Smart_Media_Manager {

	/**
	 * Plugin version.
	 *
	 * @var string
	 */
	const VERSION = '1.0.0';

	/**
	 * Registers activation/deactivation hooks and defers boot to plugins_loaded.
	 */
	private function __construct() {
		$this->define_constants();
		add_action( 'plugins_loaded', [ $this, 'init_plugin' ] );
		register_activation_hook( NHRSMM_FILE, [ $this, 'activate' ] );
		register_deactivation_hook( NHRSMM_FILE, [ $this, 'deactivate' ] );
	}

	/**
	 * Returns the single plugin instance, creating it on first call.
	 *
	 * @return self
	 */
	public static function init(): self {
		static $instance = false;
		if ( ! $instance ) {
			$instance = new self();
		}
		return $instance;
	}

	/**
	 * Defines all six plugin-wide constants.
	 *
	 * @return void
	 */
	private function define_constants(): void {
		define( 'NHRSMM_VERSION', self::VERSION );
		define( 'NHRSMM_FILE', __FILE__ );
		define( 'NHRSMM_PATH', __DIR__ );
		define( 'NHRSMM_PLUGIN_DIR', plugin_dir_path( NHRSMM_FILE ) );
		define( 'NHRSMM_URL', plugins_url( '', NHRSMM_FILE ) );
		define( 'NHRSMM_ASSETS', NHRSMM_URL . '/assets' );
	}

	/**
	 * Boots the plugin after all plugins are loaded.
	 *
	 * @return void
	 */
	public function init_plugin(): void {
		\Nhrsmm\SmartMediaManager\App::init();
	}

	/**
	 * Runs activation tasks.
	 *
	 * @return void
	 */
	public function activate(): void {
		\Nhrsmm\SmartMediaManager\Activator::run();
	}

	/**
	 * Runs deactivation tasks.
	 *
	 * @return void
	 */
	public function deactivate(): void {
		\Nhrsmm\SmartMediaManager\Deactivator::run();
	}
}

/**
 * Returns the main plugin instance.
 *
 * @return Nhrsmm_Smart_Media_Manager
 */
function nhrsmm_smart_media_manager() {
	return Nhrsmm_Smart_Media_Manager::init();
}

nhrsmm_smart_media_manager();
