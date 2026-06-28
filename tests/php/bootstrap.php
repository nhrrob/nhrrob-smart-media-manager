<?php

declare( strict_types=1 );

if ( ! defined( 'ABSPATH' ) ) {
	define( 'ABSPATH', dirname( __DIR__, 3 ) . '/' );
}

if ( ! defined( 'NHRSMM_VERSION' ) ) {
	define( 'NHRSMM_VERSION', '1.0.0' );
	define( 'NHRSMM_FILE', dirname( __DIR__, 2 ) . '/nhrrob-smart-media-manager.php' );
	define( 'NHRSMM_PATH', dirname( __DIR__, 2 ) );
	define( 'NHRSMM_PLUGIN_DIR', dirname( __DIR__, 2 ) . '/' );
	define( 'NHRSMM_URL', 'http://localhost:8888/wp-content/plugins/nhrrob-smart-media-manager' );
	define( 'NHRSMM_ASSETS', NHRSMM_URL . '/assets' );
}

require_once dirname( __DIR__, 2 ) . '/vendor/autoload.php';

// Never define WP functions here — Patchwork cannot intercept functions defined before Brain Monkey setUp().
// Class stubs are safe here; WP function stubs must go inside individual test methods via Functions\when().
if ( ! class_exists( 'WP_REST_Request' ) ) {
	// phpcs:ignore Generic.Files.OneClassPerFile.MultipleFound
	class WP_REST_Request {
		public function get_json_params(): array { return []; }
		public function get_param( string $key ) { return null; }
	}
}

if ( ! class_exists( 'WP_Error' ) ) {
	// phpcs:ignore Generic.Files.OneClassPerFile.MultipleFound
	class WP_Error {
		private string $code;
		private string $message;
		private $data;

		public function __construct( string $code = '', string $message = '', $data = '' ) {
			$this->code    = $code;
			$this->message = $message;
			$this->data    = $data;
		}

		public function get_error_code(): string { return $this->code; }
		public function get_error_message( string $code = '' ): string { return $this->message; }
		public function get_error_data( string $code = '' ) { return $this->data; }
	}
}
