<?php
/**
 * Asset registration and enqueuing.
 *
 * @package Nhrsmm\SmartMediaManager
 */

namespace Nhrsmm\SmartMediaManager;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Registers and conditionally enqueues scripts and styles for plugin pages.
 */
class Assets {

	/**
	 * Registers WordPress hooks.
	 *
	 * @return void
	 */
	public function register_hooks(): void {
		add_action( 'admin_enqueue_scripts', [ $this, 'register_assets' ] );
		add_action( 'admin_enqueue_scripts', [ $this, 'enqueue_on_page' ] );
		add_filter( 'admin_body_class', [ $this, 'add_body_class' ] );
	}

	/**
	 * Appends the plugin body class on plugin admin pages.
	 *
	 * @param string $classes Space-separated list of body classes.
	 * @return string
	 */
	public function add_body_class( string $classes ): string {
		// phpcs:ignore WordPress.Security.NonceVerification.Recommended
		$page = isset( $_GET['page'] ) ? sanitize_key( $_GET['page'] ) : '';
		if ( false !== strpos( $page, 'nhrsmm-' ) ) {
			$classes .= ' nhrsmm-page';
		}
		return $classes;
	}

	/**
	 * Loads the asset manifest for a built JS bundle.
	 *
	 * @param string $name Bundle name without extension.
	 * @return array
	 */
	private function load_asset( string $name ): array {
		$asset_file = NHRSMM_PLUGIN_DIR . "admin/build/$name.asset.php";
		return file_exists( $asset_file )
			? require $asset_file
			: [
				'dependencies' => [ 'wp-element' ],
				'version'      => NHRSMM_VERSION,
			];
	}

	/**
	 * Registers all plugin scripts and styles.
	 *
	 * @return void
	 */
	public function register_assets(): void {
		$app      = $this->load_asset( 'index' );
		$settings = $this->load_asset( 'settings' );

		wp_register_script(
			'nhrsmm-app',
			NHRSMM_URL . '/admin/build/index.js',
			$app['dependencies'],
			$app['version'],
			[ 'in_footer' => true ]
		);

		wp_register_script(
			'nhrsmm-settings',
			NHRSMM_URL . '/admin/build/settings.js',
			$settings['dependencies'],
			$settings['version'],
			[ 'in_footer' => true ]
		);

		wp_register_style(
			'nhrsmm-admin',
			NHRSMM_URL . '/admin/css/nhrsmm-admin.css',
			[],
			NHRSMM_VERSION
		);
	}

	/**
	 * Enqueues the correct bundle on each plugin admin page.
	 *
	 * @param string $hook Current admin page hook suffix.
	 * @return void
	 */
	public function enqueue_on_page( string $hook ): void {
		if ( $this->is_media_page( $hook ) ) {
			$this->enqueue_common();
			wp_enqueue_script( 'nhrsmm-app' );

			$settings = get_option( 'nhrsmm_settings', [] );
			wp_localize_script(
				'nhrsmm-app',
				'nhrsmmConfig',
				[
					'restUrl'       => esc_url_raw( rest_url( 'nhrsmm/v1' ) ),
					'nonce'         => wp_create_nonce( 'wp_rest' ),
					'adminUrl'      => esc_url( admin_url() ),
					'pluginUrl'     => esc_url( NHRSMM_URL ),
					'settingsUrl'   => esc_url( admin_url( 'options-general.php?page=nhrsmm-settings' ) ),
					'defaultView'   => sanitize_key( $settings['default_view'] ?? 'grid' ),
					'thumbSize'     => sanitize_key( $settings['thumbnail_size'] ?? 'medium' ),
					'perPage'       => absint( $settings['items_per_page'] ?? 40 ),
					'version'       => NHRSMM_VERSION,
					'aiConfigured'  => function_exists( 'is_supported_for_text_generation' ) && is_supported_for_text_generation(),
					'currentUserId' => get_current_user_id(),
				]
			);
		}

		if ( $this->is_settings_page( $hook ) ) {
			$this->enqueue_common();
			wp_enqueue_script( 'nhrsmm-settings' );

			$settings = get_option( 'nhrsmm_settings', [] );
			wp_localize_script(
				'nhrsmm-settings',
				'nhrsmmSettingsConfig',
				[
					'restUrl'         => esc_url_raw( rest_url( 'nhrsmm/v1' ) ),
					'nonce'           => wp_create_nonce( 'wp_rest' ),
					'mediaLibraryUrl' => esc_url( admin_url( 'upload.php?page=nhrsmm-media-library' ) ),
					'connectorsUrl'   => esc_url( admin_url( 'options-general.php#ai-connectors' ) ),
					'aiConfigured'    => function_exists( 'is_supported_for_text_generation' ) && is_supported_for_text_generation(),
					'settings'        => [
						'default_view'   => sanitize_key( $settings['default_view'] ?? 'grid' ),
						'thumbnail_size' => sanitize_key( $settings['thumbnail_size'] ?? 'medium' ),
						'items_per_page' => absint( $settings['items_per_page'] ?? 40 ),
					],
				]
			);
		}
	}

	/**
	 * Enqueues styles shared between media library and settings pages.
	 *
	 * @return void
	 */
	private function enqueue_common(): void {
		wp_enqueue_style( 'nhrsmm-admin' );
		// phpcs:disable WordPress.WP.EnqueuedResourceParameters.MissingVersion
		wp_enqueue_style(
			'nhrsmm-google-fonts',
			'https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=DM+Mono:wght@400;500&display=swap',
			[],
			null
		);
		wp_enqueue_style(
			'nhrsmm-tabler-icons',
			'https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@3.34.0/dist/tabler-icons.min.css',
			[],
			null
		);
		// phpcs:enable WordPress.WP.EnqueuedResourceParameters.MissingVersion
	}

	/**
	 * Returns true when the current page is the Smart Media Library page.
	 *
	 * @param string $hook Admin page hook suffix.
	 * @return bool
	 */
	private function is_media_page( string $hook ): bool {
		return false !== strpos( $hook, 'nhrsmm-media-library' );
	}

	/**
	 * Returns true when the current page is the Settings page.
	 *
	 * @param string $hook Admin page hook suffix.
	 * @return bool
	 */
	private function is_settings_page( string $hook ): bool {
		return false !== strpos( $hook, 'nhrsmm-settings' );
	}
}
