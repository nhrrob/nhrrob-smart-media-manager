<?php
/**
 * Base REST controller.
 *
 * @package Nhrsmm\SmartMediaManager\Api
 */

namespace Nhrsmm\SmartMediaManager\Api;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Shared namespace and default permission check for all REST controllers.
 */
abstract class RestController {

	/**
	 * REST API namespace.
	 *
	 * @var string
	 */
	protected string $namespace = 'nhrsmm/v1';

	/**
	 * Returns true when the current user can upload files.
	 *
	 * @return bool
	 */
	public function check_permission(): bool {
		return current_user_can( 'manage_categories' );
	}

	/**
	 * Registers a single-method route guarded by check_permission().
	 *
	 * @param string $path     Route path.
	 * @param string $method   HTTP method.
	 * @param string $callback Name of the handler method on this controller.
	 * @return void
	 */
	protected function route( string $path, string $method, string $callback ): void {
		register_rest_route(
			$this->namespace,
			$path,
			[
				[
					'methods'             => $method,
					'callback'            => [ $this, $callback ],
					'permission_callback' => [ $this, 'check_permission' ],
				],
			]
		);
	}

	/**
	 * Returns the sanitised attachment IDs sent in the JSON body.
	 *
	 * @param \WP_REST_Request $request REST request.
	 * @return array
	 */
	protected function body_ids( \WP_REST_Request $request ): array {
		$params = $request->get_json_params() ?? [];
		return array_values( array_filter( array_map( 'absint', (array) ( $params['ids'] ?? [] ) ) ) );
	}
}
