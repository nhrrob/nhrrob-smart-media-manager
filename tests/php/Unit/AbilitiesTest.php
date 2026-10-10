<?php

declare( strict_types=1 );

namespace Nhrsmm\SmartMediaManager\Tests\Unit;

use Brain\Monkey\Functions;
use Nhrsmm\SmartMediaManager\Abilities;

/**
 * What AI agents and MCP clients may do is a fixed, reviewed list: adding an
 * ability (or loosening one) must be a deliberate change to this test.
 */
class AbilitiesTest extends TestCase {

	private const READ_ONLY = [ 'nhrsmm/list-folders', 'nhrsmm/list-media', 'nhrsmm/get-media-usage' ];
	private const WRITES    = [ 'nhrsmm/create-folder', 'nhrsmm/move-media', 'nhrsmm/update-media' ];

	private Abilities $abilities;

	protected function setUp(): void {
		parent::setUp();
		Functions\when( '__' )->returnArg();
		$this->abilities = new Abilities();
	}

	public function test_the_ability_list_is_exactly_the_reviewed_one(): void {
		$this->assertSame( array_merge( self::READ_ONLY, self::WRITES ), array_keys( $this->abilities->definitions() ) );
	}

	public function test_every_ability_is_behind_the_rest_gate_and_none_is_destructive(): void {
		foreach ( $this->abilities->definitions() as $name => $args ) {
			$this->assertSame( [ $this->abilities, 'check_permission' ], $args['permission_callback'], $name );
			$this->assertSame( in_array( $name, self::READ_ONLY, true ), $args['meta']['annotations']['readonly'], $name );
			$this->assertFalse( $args['meta']['annotations']['destructive'], $name );
		}

		Functions\when( 'current_user_can' )->justReturn( false );
		$this->assertFalse( $this->abilities->check_permission() );
	}

	public function test_update_refuses_a_post_that_is_not_a_media_file(): void {
		Functions\when( 'absint' )->alias( 'intval' );
		Functions\when( 'get_post_type' )->justReturn( 'post' );
		Functions\when( 'current_user_can' )->justReturn( true );

		$this->assertInstanceOf( \WP_Error::class, $this->abilities->update_media( [ 'id' => 5, 'title' => 'x' ] ) );
		$this->assertInstanceOf( \WP_Error::class, $this->abilities->get_media_usage( [ 'id' => 5 ] ) );
	}
}
