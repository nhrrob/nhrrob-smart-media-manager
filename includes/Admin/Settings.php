<?php

namespace Nhrsmm\SmartMediaManager\Admin;

if ( ! defined( 'ABSPATH' ) ) exit;

class Settings {

	public function register_hooks(): void {
		add_action( 'admin_menu', [ $this, 'register_menu' ] );
	}

	public function register_menu(): void {
		add_options_page(
			__( 'NHR Smart Media', 'nhrrob-smart-media-manager' ),
			__( 'NHR Smart Media', 'nhrrob-smart-media-manager' ),
			'manage_options',
			'nhr-smart-media',
			[ $this, 'render_page' ]
		);
	}

	public function render_page(): void {
		if ( ! current_user_can( 'manage_options' ) ) {
			wp_die( __( 'You do not have permission to access this page.', 'nhrrob-smart-media-manager' ) );
		}
		echo '<div class="nhrsmm-settings" id="nhrsmm-settings-app"></div>';
	}
}
