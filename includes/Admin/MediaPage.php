<?php

namespace Nhrsmm\SmartMediaManager\Admin;

if ( ! defined( 'ABSPATH' ) ) exit;

class MediaPage {

	public function register_hooks(): void {
		add_action( 'admin_menu', [ $this, 'register_menu' ] );
	}

	public function register_menu(): void {
		add_media_page(
			__( 'NHR Smart Media Manager', 'nhrrob-smart-media-manager' ),
			__( 'Smart Library', 'nhrrob-smart-media-manager' ),
			'upload_files',
			'nhr-smart-media-library',
			[ $this, 'render_page' ]
		);
	}

	public function render_page(): void {
		if ( ! current_user_can( 'upload_files' ) ) {
			wp_die( __( 'You do not have permission to access this page.', 'nhrrob-smart-media-manager' ) );
		}
		echo '<div class="nhrsmm" id="nhrsmm-app"></div>';
	}
}
