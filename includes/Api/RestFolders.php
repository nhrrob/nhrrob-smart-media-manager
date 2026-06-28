<?php
/**
 * REST API controller for folder operations.
 *
 * @package Nhrsmm\SmartMediaManager
 */

namespace Nhrsmm\SmartMediaManager\Api;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

use Nhrsmm\SmartMediaManager\Core\Folders;

/**
 * Handles REST routes for folder CRUD and move operations.
 */
class RestFolders extends RestController {

	/**
	 * Registers all folder REST routes.
	 *
	 * @return void
	 */
	public function register_routes(): void {
		register_rest_route(
			$this->namespace,
			'/folders',
			[
				[
					'methods'             => 'GET',
					'callback'            => [ $this, 'get_tree' ],
					'permission_callback' => [ $this, 'check_permission' ],
				],
				[
					'methods'             => 'POST',
					'callback'            => [ $this, 'create' ],
					'permission_callback' => [ $this, 'check_permission' ],
				],
			]
		);

		register_rest_route(
			$this->namespace,
			'/folders/(?P<id>\d+)',
			[
				[
					'methods'             => 'PUT',
					'callback'            => [ $this, 'update' ],
					'permission_callback' => [ $this, 'check_permission' ],
				],
				[
					'methods'             => 'DELETE',
					'callback'            => [ $this, 'delete' ],
					'permission_callback' => [ $this, 'check_permission' ],
				],
			]
		);

		register_rest_route(
			$this->namespace,
			'/folders/(?P<id>\d+)/move',
			[
				[
					'methods'             => 'POST',
					'callback'            => [ $this, 'move' ],
					'permission_callback' => [ $this, 'check_permission' ],
				],
			]
		);
	}

	/**
	 * Returns the full folder tree.
	 *
	 * @return \WP_REST_Response
	 */
	public function get_tree(): \WP_REST_Response {
		$folders = new Folders();
		return rest_ensure_response( $folders->get_tree() );
	}

	/**
	 * Creates a new folder.
	 *
	 * @param \WP_REST_Request $request REST request.
	 * @return \WP_REST_Response|\WP_Error
	 */
	public function create( \WP_REST_Request $request ) {
		$name   = sanitize_text_field( $request->get_param( 'name' ) ?? '' );
		$parent = absint( $request->get_param( 'parent' ) ?? 0 );

		$folders = new Folders();
		$result  = $folders->create( $name, $parent );

		if ( is_wp_error( $result ) ) {
			return $result;
		}
		return rest_ensure_response( $result );
	}

	/**
	 * Renames an existing folder.
	 *
	 * @param \WP_REST_Request $request REST request.
	 * @return \WP_REST_Response|\WP_Error
	 */
	public function update( \WP_REST_Request $request ) {
		$id   = absint( $request->get_param( 'id' ) );
		$name = sanitize_text_field( $request->get_param( 'name' ) ?? '' );

		$folders = new Folders();
		$result  = $folders->rename( $id, $name );

		if ( is_wp_error( $result ) ) {
			return $result;
		}
		return rest_ensure_response( $result );
	}

	/**
	 * Deletes a folder.
	 *
	 * @param \WP_REST_Request $request REST request.
	 * @return \WP_REST_Response|\WP_Error
	 */
	public function delete( \WP_REST_Request $request ) {
		$id      = absint( $request->get_param( 'id' ) );
		$folders = new Folders();
		$result  = $folders->delete( $id );

		if ( is_wp_error( $result ) ) {
			return $result;
		}
		return rest_ensure_response(
			[
				'deleted' => true,
				'id'      => $id,
			]
		);
	}

	/**
	 * Moves a folder under a new parent.
	 *
	 * @param \WP_REST_Request $request REST request.
	 * @return \WP_REST_Response|\WP_Error
	 */
	public function move( \WP_REST_Request $request ) {
		$id      = absint( $request->get_param( 'id' ) );
		$parent  = absint( $request->get_param( 'parent' ) ?? 0 );
		$folders = new Folders();
		$result  = $folders->move( $id, $parent );

		if ( is_wp_error( $result ) ) {
			return $result;
		}
		return rest_ensure_response( $result );
	}
}
