<?php

declare( strict_types=1 );

namespace Nhrsmm\SmartMediaManager\Tests\Unit\Api;

use Brain\Monkey\Functions;
use Mockery;
use Nhrsmm\SmartMediaManager\Api\RestAi;
use Nhrsmm\SmartMediaManager\Tests\Unit\TestCase;

class RestAiTest extends TestCase {

	private RestAi $controller;

	protected function setUp(): void {
		parent::setUp();
		$this->controller = new RestAi();
	}

	private function make_request( array $body = [] ): \WP_REST_Request {
		$request = Mockery::mock( \WP_REST_Request::class );
		$request->shouldReceive( 'get_json_params' )->andReturn( $body );
		return $request;
	}

	public function test_check_permission_returns_false_without_upload_files(): void {
		Functions\when( 'current_user_can' )->justReturn( false );

		$this->assertFalse( $this->controller->check_permission( $this->make_request() ) );
	}

	public function test_check_permission_returns_true_when_body_has_no_attachment_id(): void {
		Functions\when( 'current_user_can' )->justReturn( true );
		Functions\when( 'absint' )->alias( 'intval' );

		$this->assertTrue( $this->controller->check_permission( $this->make_request() ) );
	}

	public function test_check_permission_returns_true_when_attachment_id_is_zero(): void {
		Functions\when( 'current_user_can' )->justReturn( true );
		Functions\when( 'absint' )->alias( 'intval' );

		$this->assertTrue( $this->controller->check_permission( $this->make_request( [ 'attachment_id' => 0 ] ) ) );
	}

	public function test_check_permission_returns_true_when_user_can_edit_attachment(): void {
		Functions\when( 'current_user_can' )->alias(
			function ( $cap ) {
				return 'upload_files' === $cap || 'edit_post' === $cap;
			}
		);
		Functions\when( 'absint' )->alias( 'intval' );

		$this->assertTrue( $this->controller->check_permission( $this->make_request( [ 'attachment_id' => 10 ] ) ) );
	}

	public function test_check_permission_returns_false_when_user_cannot_edit_attachment(): void {
		Functions\when( 'current_user_can' )->alias(
			function ( $cap ) {
				return 'upload_files' === $cap;
			}
		);
		Functions\when( 'absint' )->alias( 'intval' );

		$this->assertFalse( $this->controller->check_permission( $this->make_request( [ 'attachment_id' => 10 ] ) ) );
	}
}
