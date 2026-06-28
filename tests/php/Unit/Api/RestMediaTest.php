<?php

declare( strict_types=1 );

namespace Nhrsmm\SmartMediaManager\Tests\Unit\Api;

use Brain\Monkey\Functions;
use Mockery;
use Nhrsmm\SmartMediaManager\Api\RestMedia;
use Nhrsmm\SmartMediaManager\Tests\Unit\TestCase;

class RestMediaTest extends TestCase {

	private RestMedia $controller;

	protected function setUp(): void {
		parent::setUp();
		$this->controller = new RestMedia();
	}

	private function make_request( ?int $id = null ): \WP_REST_Request {
		$request = Mockery::mock( \WP_REST_Request::class );
		$request->shouldReceive( 'get_param' )->with( 'id' )->andReturn( $id );
		return $request;
	}

	// check_permission — gates all media routes on upload_files.

	public function test_check_permission_returns_false_without_upload_files(): void {
		Functions\when( 'current_user_can' )->justReturn( false );

		$this->assertFalse( $this->controller->check_permission() );
	}

	public function test_check_permission_returns_true_with_upload_files(): void {
		Functions\when( 'current_user_can' )->justReturn( true );

		$this->assertTrue( $this->controller->check_permission() );
	}

	// check_usage_permission — gates /media/{id}/usage on upload_files + edit_post on the attachment.

	public function test_check_usage_permission_returns_false_without_upload_files(): void {
		Functions\when( 'current_user_can' )->justReturn( false );

		$this->assertFalse( $this->controller->check_usage_permission( $this->make_request( 5 ) ) );
	}

	public function test_check_usage_permission_returns_false_when_id_is_zero(): void {
		Functions\when( 'current_user_can' )->justReturn( true );
		Functions\when( 'absint' )->alias( 'intval' );

		$this->assertFalse( $this->controller->check_usage_permission( $this->make_request( 0 ) ) );
	}

	public function test_check_usage_permission_returns_false_when_user_cannot_edit_attachment(): void {
		Functions\when( 'current_user_can' )->alias(
			function ( $cap ) {
				return 'upload_files' === $cap;
			}
		);
		Functions\when( 'absint' )->alias( 'intval' );

		$this->assertFalse( $this->controller->check_usage_permission( $this->make_request( 5 ) ) );
	}

	public function test_check_usage_permission_returns_true_when_user_can_edit_attachment(): void {
		Functions\when( 'current_user_can' )->alias(
			function ( $cap ) {
				return 'upload_files' === $cap || 'edit_post' === $cap;
			}
		);
		Functions\when( 'absint' )->alias( 'intval' );

		$this->assertTrue( $this->controller->check_usage_permission( $this->make_request( 5 ) ) );
	}
}
