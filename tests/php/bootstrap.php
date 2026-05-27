<?php
/**
 * PHPUnit bootstrap — defines constants so WP-guarded classes can load,
 * then pulls in the Composer autoloader (includes Brain Monkey stubs).
 */

declare( strict_types=1 );

// Satisfy the ABSPATH guard present in every plugin class.
if ( ! defined( 'ABSPATH' ) ) {
	define( 'ABSPATH', dirname( __DIR__, 3 ) . '/' );
}

// Plugin constants required by any class that reads them at load time.
if ( ! defined( 'NHRSMM_VERSION' ) ) {
	define( 'NHRSMM_VERSION', '1.0.0' );
	define( 'NHRSMM_FILE', dirname( __DIR__, 2 ) . '/nhrrob-smart-media-manager.php' );
	define( 'NHRSMM_PATH', dirname( __DIR__, 2 ) );
	define( 'NHRSMM_PLUGIN_DIR', dirname( __DIR__, 2 ) . '/' );
	define( 'NHRSMM_URL', 'http://localhost:8888/wp-content/plugins/nhrrob-smart-media-manager' );
	define( 'NHRSMM_ASSETS', NHRSMM_URL . '/assets' );
}

require_once dirname( __DIR__, 2 ) . '/vendor/autoload.php';
