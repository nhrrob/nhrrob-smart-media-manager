<?php
/**
 * REST API controller for AI alt text generation.
 *
 * @package Nhrsmm\SmartMediaManager
 */

namespace Nhrsmm\SmartMediaManager\Api;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

use Nhrsmm\SmartMediaManager\Core\Ai;

/**
 * Handles the REST route for generating alt text via the WordPress AI client.
 */
class RestAi {

	/**
	 * REST API namespace.
	 *
	 * @var string
	 */
	protected string $namespace = 'nhrsmm/v1';

	/**
	 * Registers the AI alt text REST route.
	 *
	 * @return void
	 */
	public function register_routes(): void {
		register_rest_route(
			$this->namespace,
			'/ai/alt-text',
			[
				[
					'methods'             => 'POST',
					'callback'            => [ $this, 'generate_alt_text' ],
					'permission_callback' => [ $this, 'check_permission' ],
				],
			]
		);
		register_rest_route(
			$this->namespace,
			'/ai/caption',
			[
				[
					'methods'             => 'POST',
					'callback'            => [ $this, 'generate_caption' ],
					'permission_callback' => [ $this, 'check_permission' ],
				],
			]
		);
	}

	/**
	 * Returns true when the current user can upload files and edit the requested attachment.
	 *
	 * @param \WP_REST_Request $request REST request.
	 * @return bool
	 */
	public function check_permission( \WP_REST_Request $request ): bool {
		if ( ! current_user_can( 'upload_files' ) ) {
			return false;
		}
		$params        = $request->get_json_params() ?? [];
		$attachment_id = absint( $params['attachment_id'] ?? 0 );
		if ( $attachment_id ) {
			return current_user_can( 'edit_post', $attachment_id );
		}
		return true;
	}

	/**
	 * Generates alt text for the given attachment via the AI provider.
	 *
	 * @param \WP_REST_Request $request REST request.
	 * @return \WP_REST_Response|\WP_Error
	 */
	public function generate_alt_text( \WP_REST_Request $request ) {
		$params        = $request->get_json_params() ?? [];
		$attachment_id = absint( $params['attachment_id'] ?? 0 );

		if ( ! $attachment_id ) {
			return new \WP_Error( 'missing_id', __( 'attachment_id is required.', 'nhrrob-smart-media-manager' ), [ 'status' => 400 ] );
		}

		$ai     = new Ai();
		$result = $ai->generate_alt_text( $attachment_id );

		if ( is_wp_error( $result ) ) {
			$data   = $result->get_error_data();
			$status = is_array( $data ) && isset( $data['status'] ) ? $data['status'] : 400;
			return new \WP_Error( $result->get_error_code(), $result->get_error_message(), [ 'status' => $status ] );
		}

		return rest_ensure_response( $result );
	}

	/**
	 * Generates a caption for the given attachment via the AI provider.
	 *
	 * @param \WP_REST_Request $request REST request.
	 * @return \WP_REST_Response|\WP_Error
	 */
	public function generate_caption( \WP_REST_Request $request ) {
		$params        = $request->get_json_params() ?? [];
		$attachment_id = absint( $params['attachment_id'] ?? 0 );

		if ( ! $attachment_id ) {
			return new \WP_Error( 'missing_id', __( 'attachment_id is required.', 'nhrrob-smart-media-manager' ), [ 'status' => 400 ] );
		}

		$ai     = new Ai();
		$result = $ai->generate_caption( $attachment_id );

		if ( is_wp_error( $result ) ) {
			$data   = $result->get_error_data();
			$status = is_array( $data ) && isset( $data['status'] ) ? $data['status'] : 400;
			return new \WP_Error( $result->get_error_code(), $result->get_error_message(), [ 'status' => $status ] );
		}

		return rest_ensure_response( $result );
	}
}
