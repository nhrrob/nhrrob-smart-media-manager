<?php

namespace Nhrsmm\SmartMediaManager\Api;

if ( ! defined( 'ABSPATH' ) ) exit;

use Nhrsmm\SmartMediaManager\Core\Media;

class RestMedia {

	protected string $namespace = 'nhrsmm/v1';

	public function register_routes(): void {
		register_rest_route( $this->namespace, '/media', [
			[ 'methods' => 'GET', 'callback' => [ $this, 'get_list' ], 'permission_callback' => [ $this, 'check_permission' ] ],
		] );

		register_rest_route( $this->namespace, '/media/bulk-move', [
			[ 'methods' => 'POST', 'callback' => [ $this, 'bulk_move' ], 'permission_callback' => [ $this, 'check_permission' ] ],
		] );

		register_rest_route( $this->namespace, '/media/bulk-delete', [
			[ 'methods' => 'DELETE', 'callback' => [ $this, 'bulk_delete' ], 'permission_callback' => [ $this, 'check_permission' ] ],
		] );

		register_rest_route( $this->namespace, '/media/(?P<id>\d+)', [
			[ 'methods' => 'GET', 'callback' => [ $this, 'get_single' ],    'permission_callback' => [ $this, 'check_permission' ] ],
			[ 'methods' => 'PUT', 'callback' => [ $this, 'update_media' ],  'permission_callback' => [ $this, 'check_permission' ] ],
		] );

		register_rest_route( $this->namespace, '/media/(?P<id>\d+)/move', [
			[ 'methods' => 'POST', 'callback' => [ $this, 'move_to_folder' ], 'permission_callback' => [ $this, 'check_permission' ] ],
		] );

		register_rest_route( $this->namespace, '/media/(?P<id>\d+)/usage', [
			[ 'methods' => 'GET', 'callback' => [ $this, 'get_usage' ], 'permission_callback' => [ $this, 'check_permission' ] ],
		] );
	}

	public function check_permission(): bool {
		return current_user_can( 'upload_files' );
	}

	public function get_list( \WP_REST_Request $request ): \WP_REST_Response {
		$media  = new Media();
		$result = $media->get_list( [
			'page'     => absint( $request->get_param( 'page' ) ?? 1 ),
			'per_page' => absint( $request->get_param( 'per_page' ) ?? 0 ),
			'folder'   => $request->get_param( 'folder' ) !== null ? absint( $request->get_param( 'folder' ) ) : null,
			'search'   => sanitize_text_field( $request->get_param( 'search' ) ?? '' ),
			'type'     => sanitize_key( $request->get_param( 'type' ) ?? '' ),
			'orderby'  => sanitize_key( $request->get_param( 'orderby' ) ?? 'date' ),
			'order'    => sanitize_key( $request->get_param( 'order' ) ?? 'DESC' ),
		] );
		return rest_ensure_response( $result );
	}

	public function get_single( \WP_REST_Request $request ) {
		$id     = absint( $request->get_param( 'id' ) );
		$media  = new Media();
		$result = $media->get_single( $id );
		if ( ! $result ) {
			return new \WP_Error( 'not_found', __( 'Attachment not found.', 'nhrrob-smart-media-manager' ), [ 'status' => 404 ] );
		}
		return rest_ensure_response( $result );
	}

	public function update_media( \WP_REST_Request $request ) {
		$id    = absint( $request->get_param( 'id' ) );
		if ( ! current_user_can( 'edit_post', $id ) ) {
			return new \WP_Error( 'forbidden', __( 'You cannot edit this attachment.', 'nhrrob-smart-media-manager' ), [ 'status' => 403 ] );
		}
		$media  = new Media();
		$result = $media->update( $id, $request->get_json_params() ?: [] );
		if ( is_wp_error( $result ) ) return $result;
		return rest_ensure_response( $result );
	}

	public function move_to_folder( \WP_REST_Request $request ) {
		$id        = absint( $request->get_param( 'id' ) );
		$folder_id = absint( $request->get_param( 'folder_id' ) ?? 0 );
		if ( ! current_user_can( 'edit_post', $id ) ) {
			return new \WP_Error( 'forbidden', __( 'You cannot edit this attachment.', 'nhrrob-smart-media-manager' ), [ 'status' => 403 ] );
		}
		$media  = new Media();
		$result = $media->move_to_folder( $id, $folder_id );
		if ( is_wp_error( $result ) ) return $result;
		return rest_ensure_response( [ 'moved' => true, 'id' => $id, 'folder_id' => $folder_id ] );
	}

	public function bulk_move( \WP_REST_Request $request ) {
		$params    = $request->get_json_params() ?: [];
		$ids       = array_map( 'absint', (array) ( $params['ids'] ?? [] ) );
		$folder_id = absint( $params['folder_id'] ?? 0 );
		if ( empty( $ids ) ) {
			return new \WP_Error( 'no_ids', __( 'No file IDs provided.', 'nhrrob-smart-media-manager' ), [ 'status' => 400 ] );
		}
		$media  = new Media();
		$result = $media->bulk_move( $ids, $folder_id );
		return rest_ensure_response( $result );
	}

	public function bulk_delete( \WP_REST_Request $request ) {
		$params = $request->get_json_params() ?: [];
		$ids    = array_map( 'absint', (array) ( $params['ids'] ?? [] ) );
		if ( empty( $ids ) ) {
			return new \WP_Error( 'no_ids', __( 'No file IDs provided.', 'nhrrob-smart-media-manager' ), [ 'status' => 400 ] );
		}
		$media  = new Media();
		$result = $media->bulk_delete( $ids );
		return rest_ensure_response( $result );
	}

	public function get_usage( \WP_REST_Request $request ): \WP_REST_Response {
		$id    = absint( $request->get_param( 'id' ) );
		$media = new Media();
		return rest_ensure_response( $media->get_usage( $id ) );
	}
}
