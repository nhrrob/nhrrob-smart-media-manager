<?php

namespace Nhrsmm\SmartMediaManager\Api;

use Nhrsmm\SmartMediaManager\Core\Ai;

if ( ! defined( 'ABSPATH' ) ) exit;

class RestAi {

	protected string $namespace = 'nhrsmm/v1';

	public function register_routes(): void {
		register_rest_route( $this->namespace, '/ai/alt-text', [
			[ 'methods' => 'POST', 'callback' => [ $this, 'generate_alt_text' ], 'permission_callback' => [ $this, 'check_permission' ] ],
		] );
	}

	public function check_permission(): bool {
		return current_user_can( 'upload_files' );
	}

	public function generate_alt_text( \WP_REST_Request $request ) {
		$params        = $request->get_json_params() ?: [];
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

}
