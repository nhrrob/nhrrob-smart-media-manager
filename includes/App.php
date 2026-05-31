<?php
/**
 * Application bootstrap — wires all plugin subsystems.
 *
 * @package Nhrsmm\SmartMediaManager
 */

namespace Nhrsmm\SmartMediaManager;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Registers the taxonomy, enqueue hooks, admin pages, REST routes and attachment callbacks.
 */
class App {

	/**
	 * Initialises the plugin on the current request.
	 *
	 * @return void
	 */
	public static function init() {
		$self = new self();
		$self->register_taxonomy();
		$self->boot();
	}

	/**
	 * Schedules taxonomy registration on the init hook.
	 *
	 * @return void
	 */
	private function register_taxonomy() {
		add_action( 'init', [ $this, 'register_media_folder_taxonomy' ] );
	}

	/**
	 * Instantiates and wires all plugin subsystems.
	 *
	 * @return void
	 */
	private function boot() {
		( new Assets() )->register_hooks();
		( new Admin\MediaPage() )->register_hooks();
		( new Admin\Settings() )->register_hooks();

		add_action( 'rest_api_init', [ $this, 'register_rest_routes' ] );
		add_action( 'add_attachment', [ $this, 'on_attachment_add' ] );
		add_action( 'delete_attachment', [ $this, 'on_attachment_delete' ] );
	}

	/**
	 * Registers the nhrsmm_media_folder hierarchical taxonomy on attachments.
	 *
	 * @return void
	 */
	public function register_media_folder_taxonomy() {
		register_taxonomy(
			'nhrsmm_media_folder',
			'attachment',
			[
				'labels'                => [
					'name'          => __( 'Media Folders', 'nhrrob-smart-media-manager' ),
					'singular_name' => __( 'Media Folder', 'nhrrob-smart-media-manager' ),
				],
				'public'                => false,
				'show_ui'               => false,
				'show_in_rest'          => false,
				'hierarchical'          => true,
				'rewrite'               => false,
				'query_var'             => false,
				'update_count_callback' => '_update_generic_term_count',
			]
		);
	}

	/**
	 * Registers all REST API routes.
	 *
	 * @return void
	 */
	public function register_rest_routes() {
		( new Api\RestFolders() )->register_routes();
		( new Api\RestMedia() )->register_routes();
		( new Api\RestAi() )->register_routes();
		( new Api\RestSettings() )->register_routes();
	}

	/**
	 * Assigns the default upload folder to newly added attachments.
	 *
	 * @param int $attachment_id Attachment post ID.
	 * @return void
	 */
	public function on_attachment_add( $attachment_id ) {
		$default_folder = get_option( 'nhrsmm_default_upload_folder', 0 );
		if ( $default_folder && term_exists( (int) $default_folder, 'nhrsmm_media_folder' ) ) {
			wp_set_object_terms( $attachment_id, (int) $default_folder, 'nhrsmm_media_folder' );
		}
	}

	/**
	 * Removes folder taxonomy relationships when an attachment is deleted.
	 *
	 * @param int $attachment_id Attachment post ID.
	 * @return void
	 */
	public function on_attachment_delete( $attachment_id ) {
		wp_delete_object_term_relationships( $attachment_id, 'nhrsmm_media_folder' );
	}
}
