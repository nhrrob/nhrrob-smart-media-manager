<?php

declare( strict_types=1 );

namespace Nhrsmm\SmartMediaManager\Tests\Unit\Api;

use Brain\Monkey\Functions;
use Nhrsmm\SmartMediaManager\Api\RestFolders;
use Nhrsmm\SmartMediaManager\Tests\Unit\TestCase;

class RestFoldersTest extends TestCase {

	private RestFolders $controller;

	protected function setUp(): void {
		parent::setUp();
		$this->controller = new RestFolders();
	}

	public function test_check_permission_returns_false_without_upload_files(): void {
		Functions\when( 'current_user_can' )->justReturn( false );

		$this->assertFalse( $this->controller->check_permission() );
	}

	public function test_check_permission_returns_true_with_upload_files(): void {
		Functions\when( 'current_user_can' )->justReturn( true );

		$this->assertTrue( $this->controller->check_permission() );
	}
}
