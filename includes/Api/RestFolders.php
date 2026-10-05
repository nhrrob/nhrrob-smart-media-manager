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
use Nhrsmm\SmartMediaManager\Core\Importer;

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

		$this->route( '/folders/reorder', 'POST', 'reorder' );
		$this->route( '/folders/path', 'POST', 'ensure_path' );
		$this->route( '/folders/export', 'GET', 'export' );
		$this->route( '/folders/import', 'POST', 'import_tree' );
		$this->route( '/folders/(?P<id>\d+)/files', 'GET', 'files' );
		$this->route( '/import/sources', 'GET', 'import_sources' );
		$this->route( '/import', 'POST', 'import_run' );

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
	 * Renames an existing folder and/or sets its colour.
	 *
	 * @param \WP_REST_Request $request REST request.
	 * @return \WP_REST_Response|\WP_Error
	 */
	public function update( \WP_REST_Request $request ) {
		$id      = absint( $request->get_param( 'id' ) );
		$folders = new Folders();

		if ( null !== $request->get_param( 'color' ) ) {
			$folders->set_color( $id, (string) $request->get_param( 'color' ) );
			if ( null === $request->get_param( 'name' ) ) {
				return rest_ensure_response( [ 'id' => $id ] );
			}
		}

		$name   = sanitize_text_field( $request->get_param( 'name' ) ?? '' );
		$result = $folders->rename( $id, $name );

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

	/**
	 * Saves the manual order of sibling folders.
	 *
	 * @param \WP_REST_Request $request REST request.
	 * @return \WP_REST_Response|\WP_Error
	 */
	public function reorder( \WP_REST_Request $request ) {
		$result = ( new Folders() )->reorder( absint( $request->get_param( 'parent' ) ?? 0 ), $this->body_ids( $request ) );
		return is_wp_error( $result ) ? $result : rest_ensure_response( [ 'saved' => true ] );
	}

	/**
	 * Returns the folder at a path, creating missing levels (used by folder uploads).
	 *
	 * @param \WP_REST_Request $request REST request.
	 * @return \WP_REST_Response|\WP_Error
	 */
	public function ensure_path( \WP_REST_Request $request ) {
		$path   = array_map( 'sanitize_text_field', (array) ( $request->get_param( 'path' ) ?? [] ) );
		$result = ( new Folders() )->ensure_path( $path, absint( $request->get_param( 'parent' ) ?? 0 ) );
		return is_wp_error( $result ) ? $result : rest_ensure_response( [ 'id' => $result ] );
	}

	/**
	 * Returns the folder structure for export.
	 *
	 * @return \WP_REST_Response
	 */
	public function export(): \WP_REST_Response {
		return rest_ensure_response( [ 'folders' => ( new Folders() )->export() ] );
	}

	/**
	 * Recreates an exported folder structure.
	 *
	 * @param \WP_REST_Request $request REST request.
	 * @return \WP_REST_Response
	 */
	public function import_tree( \WP_REST_Request $request ): \WP_REST_Response {
		$tree = $request->get_param( 'folders' );
		return rest_ensure_response( [ 'folders' => ( new Folders() )->import_tree( is_array( $tree ) ? $tree : [] ) ] );
	}

	/**
	 * Lists the files of a folder and its subfolders (used by the ZIP download).
	 *
	 * @param \WP_REST_Request $request REST request.
	 * @return \WP_REST_Response
	 */
	public function files( \WP_REST_Request $request ): \WP_REST_Response {
		return rest_ensure_response( ( new Folders() )->files( absint( $request->get_param( 'id' ) ) ) );
	}

	/**
	 * Lists other folder plugins whose data can be imported.
	 *
	 * @return \WP_REST_Response
	 */
	public function import_sources(): \WP_REST_Response {
		return rest_ensure_response( ( new Importer() )->sources() );
	}

	/**
	 * Runs one step of an import from another folder plugin.
	 *
	 * @param \WP_REST_Request $request REST request.
	 * @return \WP_REST_Response|\WP_Error
	 */
	public function import_run( \WP_REST_Request $request ) {
		$result = ( new Importer() )->run( sanitize_key( $request->get_param( 'source' ) ?? '' ), absint( $request->get_param( 'offset' ) ?? 0 ) );
		return is_wp_error( $result ) ? $result : rest_ensure_response( $result );
	}
}
