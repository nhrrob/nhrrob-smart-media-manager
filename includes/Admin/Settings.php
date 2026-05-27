<?php
/**
 * Plugin settings admin page.
 *
 * @package Nhrsmm\SmartMediaManager
 */

namespace Nhrsmm\SmartMediaManager\Admin;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Registers the NHR Smart Media settings page under Settings.
 */
class Settings {

	/**
	 * Registers WordPress hooks.
	 *
	 * @return void
	 */
	public function register_hooks(): void {
		add_action( 'admin_menu', [ $this, 'register_menu' ] );
	}

	/**
	 * Adds the settings page under the Settings menu.
	 *
	 * @return void
	 */
	public function register_menu(): void {
		add_options_page(
			__( 'NHR Smart Media', 'nhrrob-smart-media-manager' ),
			__( 'NHR Smart Media', 'nhrrob-smart-media-manager' ),
			'manage_options',
			'nhrsmm-settings',
			[ $this, 'render_page' ]
		);
	}

	/**
	 * Renders the React app mount point for the settings page.
	 *
	 * @return void
	 */
	public function render_page(): void {
		if ( ! current_user_can( 'manage_options' ) ) {
			wp_die( esc_html__( 'You do not have permission to access this page.', 'nhrrob-smart-media-manager' ) );
		}
		echo '<div class="nhrsmm-settings" id="nhrsmm-settings-app"></div>';
	}
}
