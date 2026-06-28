<?php

declare( strict_types=1 );

namespace Nhrsmm\SmartMediaManager\Tests\Unit\Api;

use Brain\Monkey\Functions;
use Nhrsmm\SmartMediaManager\Api\RestSettings;
use Nhrsmm\SmartMediaManager\Tests\Unit\TestCase;

class RestSettingsTest extends TestCase {

	private RestSettings $controller;

	protected function setUp(): void {
		parent::setUp();
		$this->controller = new RestSettings();
	}

	public function test_check_permission_returns_false_without_manage_options(): void {
		Functions\when( 'current_user_can' )->justReturn( false );

		$this->assertFalse( $this->controller->check_permission() );
	}

	public function test_check_permission_returns_true_with_manage_options(): void {
		Functions\when( 'current_user_can' )->justReturn( true );

		$this->assertTrue( $this->controller->check_permission() );
	}
}
