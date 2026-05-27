<?php

namespace Nhrsmm\SmartMediaManager\Api;

if ( ! defined( 'ABSPATH' ) ) exit;

class RestSettings {

	protected string $namespace = 'nhrsmm/v1';

	public function register_routes(): void {
		register_rest_route( $this->namespace, '/settings', [
			[
				'methods'             => 'GET',
				'callback'            => [ $this, 'get_settings' ],
				'permission_callback' => [ $this, 'check_permission' ],
			],
			[
				'methods'             => 'POST',
				'callback'            => [ $this, 'save_settings' ],
				'permission_callback' => [ $this, 'check_permission' ],
			],
		] );
	}

	public function check_permission(): bool {
		return current_user_can( 'manage_options' );
	}

	public function get_settings(): \WP_REST_Response {
		return rest_ensure_response( $this->defaults() );
	}

	public function save_settings( \WP_REST_Request $request ) {
		$params  = $request->get_json_params() ?: [];
		$current = get_option( 'nhrsmm_settings', [] );

		if ( isset( $params['default_view'] ) ) {
			$current['default_view'] = in_array( $params['default_view'], [ 'grid', 'list' ], true )
				? sanitize_key( $params['default_view'] ) : 'grid';
		}
		if ( isset( $params['thumbnail_size'] ) ) {
			$current['thumbnail_size'] = in_array( $params['thumbnail_size'], [ 'small', 'medium', 'large' ], true )
				? sanitize_key( $params['thumbnail_size'] ) : 'medium';
		}
		if ( isset( $params['items_per_page'] ) ) {
			$current['items_per_page'] = in_array( absint( $params['items_per_page'] ), [ 20, 40, 60, 100 ], true )
				? absint( $params['items_per_page'] ) : 40;
		}

		update_option( 'nhrsmm_settings', $current );

		return rest_ensure_response( $this->defaults() );
	}

	private function defaults(): array {
		return array_merge(
			[ 'default_view' => 'grid', 'thumbnail_size' => 'medium', 'items_per_page' => 40 ],
			get_option( 'nhrsmm_settings', [] )
		);
	}
}
