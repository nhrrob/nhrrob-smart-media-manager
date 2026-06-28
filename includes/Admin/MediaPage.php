<?php
/**
 * Smart Media Library admin page.
 *
 * @package Nhrsmm\SmartMediaManager
 */

namespace Nhrsmm\SmartMediaManager\Admin;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Registers the Smart Media Library submenu page under Media.
 */
class MediaPage {

	/**
	 * Registers WordPress hooks.
	 *
	 * @return void
	 */
	public function register_hooks(): void {
		add_action( 'admin_menu', [ $this, 'register_menu' ] );
	}

	/**
	 * Adds the Smart Media Library submenu under the Media menu.
	 *
	 * @return void
	 */
	public function register_menu(): void {
		add_media_page(
			__( 'NHR Smart Media Manager', 'nhrrob-smart-media-manager' ),
			__( 'Smart Library', 'nhrrob-smart-media-manager' ),
			'manage_categories',
			'nhrsmm-media-library',
			[ $this, 'render_page' ]
		);
	}

	/**
	 * Renders the React app mount point for the media library.
	 *
	 * @return void
	 */
	public function render_page(): void {
		if ( ! current_user_can( 'manage_categories' ) ) {
			wp_die( esc_html__( 'You do not have permission to access this page.', 'nhrrob-smart-media-manager' ) );
		}
		echo '<div class="wrap">'
			. '<h1 class="screen-reader-text">' . esc_html__( 'NHR Smart Media Library', 'nhrrob-smart-media-manager' ) . '</h1>'
			. '<hr class="wp-header-end">'
			. '<div class="nhrsmm" id="nhrsmm-app"></div>'
			. '</div>';
	}
}
