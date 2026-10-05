<?php
/**
 * REST API controller for media operations.
 *
 * @package Nhrsmm\SmartMediaManager
 */

namespace Nhrsmm\SmartMediaManager\Api;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

use Nhrsmm\SmartMediaManager\Core\Media;
use Nhrsmm\SmartMediaManager\Core\Usage;

/**
 * Handles REST routes for media listing, retrieval, update, move, bulk operations, and usage.
 */
class RestMedia extends RestController {

	/**
	 * Registers all media REST routes.
	 *
	 * @return void
	 */
	public function register_routes(): void {
		register_rest_route(
			$this->namespace,
			'/media',
			[
				[
					'methods'             => 'GET',
					'callback'            => [ $this, 'get_list' ],
					'permission_callback' => [ $this, 'check_permission' ],
				],
			]
		);

		register_rest_route(
			$this->namespace,
			'/media/bulk-move',
			[
				[
					'methods'             => 'POST',
					'callback'            => [ $this, 'bulk_move' ],
					'permission_callback' => [ $this, 'check_permission' ],
				],
			]
		);

		register_rest_route(
			$this->namespace,
			'/media/bulk-delete',
			[
				[
					'methods'             => 'DELETE',
					'callback'            => [ $this, 'bulk_delete' ],
					'permission_callback' => [ $this, 'check_permission' ],
				],
			]
		);

		$this->route( '/media/bulk-restore', 'POST', 'bulk_restore' );
		$this->route( '/media/bulk-update', 'POST', 'bulk_update' );
		$this->route( '/media/reorder', 'POST', 'reorder' );
		$this->route( '/media/scan-unused', 'POST', 'scan_unused' );
		$this->route( '/media/(?P<id>\d+)/replace', 'POST', 'replace' );
		$this->route( '/user-state', 'POST', 'save_user_state' );

		register_rest_route(
			$this->namespace,
			'/media/(?P<id>\d+)',
			[
				[
					'methods'             => 'GET',
					'callback'            => [ $this, 'get_single' ],
					'permission_callback' => [ $this, 'check_permission' ],
				],
				[
					'methods'             => 'PUT',
					'callback'            => [ $this, 'update_media' ],
					'permission_callback' => [ $this, 'check_permission' ],
				],
			]
		);

		register_rest_route(
			$this->namespace,
			'/media/(?P<id>\d+)/move',
			[
				[
					'methods'             => 'POST',
					'callback'            => [ $this, 'move_to_folder' ],
					'permission_callback' => [ $this, 'check_permission' ],
				],
			]
		);

		register_rest_route(
			$this->namespace,
			'/media/(?P<id>\d+)/usage',
			[
				[
					'methods'             => 'GET',
					'callback'            => [ $this, 'get_usage' ],
					'permission_callback' => [ $this, 'check_permission' ],
				],
			]
		);
	}

	/**
	 * Returns a paginated list of media attachments.
	 *
	 * @param \WP_REST_Request $request REST request.
	 * @return \WP_REST_Response
	 */
	public function get_list( \WP_REST_Request $request ): \WP_REST_Response {
		$media  = new Media();
		$result = $media->get_list(
			[
				'page'      => absint( $request->get_param( 'page' ) ?? 1 ),
				'per_page'  => null !== $request->get_param( 'per_page' ) ? absint( $request->get_param( 'per_page' ) ) : null,
				'folder'    => null !== $request->get_param( 'folder' ) ? absint( $request->get_param( 'folder' ) ) : null,
				'search'    => sanitize_text_field( $request->get_param( 'search' ) ?? '' ),
				'type'      => sanitize_key( $request->get_param( 'type' ) ?? '' ),
				'orderby'   => sanitize_key( $request->get_param( 'orderby' ) ?? 'date' ),
				'order'     => sanitize_key( $request->get_param( 'order' ) ?? 'DESC' ),
				'ids'       => $request->get_param( 'ids' )
					? array_filter( array_map( 'absint', explode( ',', $request->get_param( 'ids' ) ) ) )
					: [],
				'alt'       => sanitize_key( $request->get_param( 'alt' ) ?? '' ),
				'status'    => sanitize_key( $request->get_param( 'status' ) ?? '' ),
				'unused'    => (bool) $request->get_param( 'unused' ),
				'author'    => absint( $request->get_param( 'author' ) ?? 0 ),
				'date_from' => sanitize_text_field( $request->get_param( 'date_from' ) ?? '' ),
				'date_to'   => sanitize_text_field( $request->get_param( 'date_to' ) ?? '' ),
			]
		);
		return rest_ensure_response( $result );
	}

	/**
	 * Returns a single attachment by ID.
	 *
	 * @param \WP_REST_Request $request REST request.
	 * @return \WP_REST_Response|\WP_Error
	 */
	public function get_single( \WP_REST_Request $request ) {
		$id = absint( $request->get_param( 'id' ) );
		if ( ! current_user_can( 'edit_post', $id ) ) {
			return new \WP_Error( 'forbidden', __( 'You cannot view this attachment.', 'nhrrob-smart-media-manager' ), [ 'status' => 403 ] );
		}
		$media  = new Media();
		$result = $media->get_single( $id );
		if ( ! $result ) {
			return new \WP_Error( 'not_found', __( 'Attachment not found.', 'nhrrob-smart-media-manager' ), [ 'status' => 404 ] );
		}
		return rest_ensure_response( $result );
	}

	/**
	 * Updates editable fields on an attachment.
	 *
	 * @param \WP_REST_Request $request REST request.
	 * @return \WP_REST_Response|\WP_Error
	 */
	public function update_media( \WP_REST_Request $request ) {
		$id = absint( $request->get_param( 'id' ) );
		if ( ! current_user_can( 'edit_post', $id ) ) {
			return new \WP_Error( 'forbidden', __( 'You cannot edit this attachment.', 'nhrrob-smart-media-manager' ), [ 'status' => 403 ] );
		}
		$media  = new Media();
		$result = $media->update( $id, $request->get_json_params() ?? [] );
		if ( is_wp_error( $result ) ) {
			return $result;
		}
		return rest_ensure_response( $result );
	}

	/**
	 * Moves a single attachment to a folder.
	 *
	 * @param \WP_REST_Request $request REST request.
	 * @return \WP_REST_Response|\WP_Error
	 */
	public function move_to_folder( \WP_REST_Request $request ) {
		$id        = absint( $request->get_param( 'id' ) );
		$folder_id = absint( $request->get_param( 'folder_id' ) ?? 0 );
		if ( ! current_user_can( 'edit_post', $id ) ) {
			return new \WP_Error( 'forbidden', __( 'You cannot edit this attachment.', 'nhrrob-smart-media-manager' ), [ 'status' => 403 ] );
		}
		$media  = new Media();
		$result = $media->move_to_folder( $id, $folder_id );
		if ( is_wp_error( $result ) ) {
			return $result;
		}
		return rest_ensure_response(
			[
				'moved'     => true,
				'id'        => $id,
				'folder_id' => $folder_id,
			]
		);
	}

	/**
	 * Moves multiple attachments to a folder.
	 *
	 * @param \WP_REST_Request $request REST request.
	 * @return \WP_REST_Response|\WP_Error
	 */
	public function bulk_move( \WP_REST_Request $request ) {
		$params    = $request->get_json_params() ?? [];
		$ids       = array_map( 'absint', (array) ( $params['ids'] ?? [] ) );
		$folder_id = absint( $params['folder_id'] ?? 0 );
		if ( empty( $ids ) ) {
			return new \WP_Error( 'no_ids', __( 'No file IDs provided.', 'nhrrob-smart-media-manager' ), [ 'status' => 400 ] );
		}
		$mode   = in_array( $params['mode'] ?? '', [ 'add', 'remove' ], true ) ? $params['mode'] : 'move';
		$media  = new Media();
		$result = $media->bulk_move( $ids, $folder_id, $mode );
		return rest_ensure_response( $result );
	}

	/**
	 * Trashes multiple attachments, or deletes them permanently when force is set.
	 *
	 * @param \WP_REST_Request $request REST request.
	 * @return \WP_REST_Response|\WP_Error
	 */
	public function bulk_delete( \WP_REST_Request $request ) {
		$params = $request->get_json_params() ?? [];
		$ids    = array_map( 'absint', (array) ( $params['ids'] ?? [] ) );
		if ( empty( $ids ) ) {
			return new \WP_Error( 'no_ids', __( 'No file IDs provided.', 'nhrrob-smart-media-manager' ), [ 'status' => 400 ] );
		}
		$media  = new Media();
		$result = $media->bulk_delete( $ids, ! empty( $params['force'] ) );
		return rest_ensure_response( $result );
	}

	/**
	 * Returns a list of posts that use the given attachment.
	 *
	 * @param \WP_REST_Request $request REST request.
	 * @return \WP_REST_Response|\WP_Error
	 */
	public function get_usage( \WP_REST_Request $request ) {
		$id = absint( $request->get_param( 'id' ) );
		if ( ! current_user_can( 'edit_post', $id ) ) {
			return new \WP_Error( 'forbidden', __( 'You cannot view this attachment.', 'nhrrob-smart-media-manager' ), [ 'status' => 403 ] );
		}
		return rest_ensure_response( ( new Usage() )->get( $id ) );
	}

	/**
	 * Restores multiple attachments from the trash.
	 *
	 * @param \WP_REST_Request $request REST request.
	 * @return \WP_REST_Response
	 */
	public function bulk_restore( \WP_REST_Request $request ) {
		return rest_ensure_response( ( new Media() )->bulk_restore( $this->body_ids( $request ) ) );
	}

	/**
	 * Applies the same field values to multiple attachments.
	 *
	 * @param \WP_REST_Request $request REST request.
	 * @return \WP_REST_Response
	 */
	public function bulk_update( \WP_REST_Request $request ) {
		$params = $request->get_json_params() ?? [];
		return rest_ensure_response( ( new Media() )->bulk_update( $this->body_ids( $request ), (array) ( $params['data'] ?? [] ) ) );
	}

	/**
	 * Saves a manual file order.
	 *
	 * @param \WP_REST_Request $request REST request.
	 * @return \WP_REST_Response
	 */
	public function reorder( \WP_REST_Request $request ) {
		$params = $request->get_json_params() ?? [];
		return rest_ensure_response(
			[
				'updated' => ( new Media() )->reorder( $this->body_ids( $request ), absint( $params['offset'] ?? 0 ) ),
			]
		);
	}

	/**
	 * Scans one batch of attachments for files with no known reference.
	 *
	 * @param \WP_REST_Request $request REST request.
	 * @return \WP_REST_Response
	 */
	public function scan_unused( \WP_REST_Request $request ) {
		$params = $request->get_json_params() ?? [];
		return rest_ensure_response( ( new Usage() )->scan( absint( $params['after'] ?? 0 ) ) );
	}

	/**
	 * Replaces the file behind an attachment.
	 *
	 * @param \WP_REST_Request $request REST request.
	 * @return \WP_REST_Response|\WP_Error
	 */
	public function replace( \WP_REST_Request $request ) {
		$id    = absint( $request->get_param( 'id' ) );
		$files = $request->get_file_params();
		if ( ! current_user_can( 'upload_files' ) || ! current_user_can( 'edit_post', $id ) ) {
			return new \WP_Error( 'forbidden', __( 'You cannot edit this attachment.', 'nhrrob-smart-media-manager' ), [ 'status' => 403 ] );
		}
		if ( empty( $files['file'] ) || ! is_array( $files['file'] ) ) {
			return new \WP_Error( 'no_file', __( 'No file was uploaded.', 'nhrrob-smart-media-manager' ), [ 'status' => 400 ] );
		}
		$result = ( new Media() )->replace_file( $id, $files['file'] );
		return is_wp_error( $result ) ? $result : rest_ensure_response( $result );
	}

	/**
	 * Saves the current user's starred and recent file lists.
	 *
	 * @param \WP_REST_Request $request REST request.
	 * @return \WP_REST_Response
	 */
	public function save_user_state( \WP_REST_Request $request ) {
		$params = $request->get_json_params() ?? [];
		$user   = get_current_user_id();
		foreach ( [
			'starred' => 500,
			'recent'  => 20,
		] as $key => $cap ) {
			if ( isset( $params[ $key ] ) && is_array( $params[ $key ] ) ) {
				$ids = array_slice( array_values( array_unique( array_filter( array_map( 'absint', $params[ $key ] ) ) ) ), 0, $cap );
				update_user_meta( $user, 'nhrsmm_' . $key, $ids );
			}
		}
		return rest_ensure_response( [ 'saved' => true ] );
	}
}
