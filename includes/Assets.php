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
		if ( $this->is_media_page_slug( $page ) ) {
			$classes .= ' nhrsmm-media-page';
		}
		return $classes;
	}

	/**
	 * Returns true when the given page slug is the Smart Media Library slug.
	 *
	 * @param string $page Sanitized page slug from $_GET['page'].
	 * @return bool
	 */
	private function is_media_page_slug( string $page ): bool {
		return false !== strpos( $page, 'nhrsmm-media-library' );
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

		wp_set_script_translations( 'nhrsmm-app', 'nhrrob-smart-media-manager', NHRSMM_PLUGIN_DIR . 'languages' );
		wp_set_script_translations( 'nhrsmm-settings', 'nhrrob-smart-media-manager', NHRSMM_PLUGIN_DIR . 'languages' );

		wp_register_style(
			'nhrsmm-icons',
			NHRSMM_URL . '/admin/css/nhrsmm-icons.css',
			[],
			NHRSMM_VERSION
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
					'restUrl'            => esc_url_raw( rest_url( 'nhrsmm/v1' ) ),
					'nonce'              => wp_create_nonce( 'wp_rest' ),
					'mediaUploadNonce'   => wp_create_nonce( 'media-form' ),
					'adminUrl'           => esc_url( admin_url() ),
					'pluginUrl'     => esc_url( NHRSMM_URL ),
					'settingsUrl'   => esc_url( admin_url( 'options-general.php?page=nhrsmm-settings' ) ),
					'connectorsUrl' => esc_url( admin_url( 'options-connectors.php' ) ),
					'defaultView'   => sanitize_key( $settings['default_view'] ?? 'grid' ),
					'thumbSize'     => sanitize_key( $settings['thumbnail_size'] ?? 'medium' ),
					'perPage'       => absint( $settings['items_per_page'] ?? 40 ),
					'version'       => NHRSMM_VERSION,
					'aiConfigured'  => function_exists( 'wp_supports_ai' ) && wp_supports_ai(),
					'aiProvider'    => $this->get_ai_provider_label(),
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
					'connectorsUrl'   => esc_url( admin_url( 'options-connectors.php' ) ),
					'wpMediaUrl'      => esc_url( admin_url( 'upload.php' ) ),
					'version'         => NHRSMM_VERSION,
					'aiConfigured'    => function_exists( 'wp_supports_ai' ) && wp_supports_ai(),
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
		wp_enqueue_style( 'nhrsmm-icons' );
		wp_enqueue_style( 'nhrsmm-admin' );
	}

	/**
	 * Detects the configured AI provider name for display purposes.
	 *
	 * @return string Provider label, or empty string if AI is not configured.
	 */
	private function get_ai_provider_label(): string {
		if ( ! function_exists( 'wp_supports_ai' ) || ! wp_supports_ai() ) {
			return '';
		}
		if ( class_exists( 'WordPress\\AnthropicAiProvider\\Provider\\AnthropicProvider' ) ) {
			return 'Anthropic';
		}
		if ( class_exists( 'WordPress\\OpenAiAiProvider\\Provider\\OpenAiProvider' ) ) {
			return 'OpenAI';
		}
		if ( class_exists( 'WordPress\\GoogleAiProvider\\Provider\\GoogleProvider' ) ) {
			return 'Google';
		}
		return 'AI';
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
