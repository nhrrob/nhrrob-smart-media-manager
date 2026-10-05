<?php

declare( strict_types=1 );

namespace Nhrsmm\SmartMediaManager\Tests\Unit\Core;

use Brain\Monkey\Functions;
use Nhrsmm\SmartMediaManager\Core\Media;
use Nhrsmm\SmartMediaManager\Tests\Unit\TestCase;

class MediaTest extends TestCase {

	/**
	 * update() must return WP_Error('not_found') when the attachment does not exist.
	 * Passing empty $data skips wp_update_post (only 'ID' in $update → count === 1)
	 * and update_post_meta, so get_post is the first and only WP call.
	 */
	public function test_update_returns_not_found_error_when_attachment_does_not_exist(): void {
		Functions\when( 'get_post' )->justReturn( null );
		Functions\when( '__' )->returnArg();

		$media  = new Media();
		$result = $media->update( 99, [] );

		$this->assertInstanceOf( \WP_Error::class, $result );
		$this->assertSame( 'not_found', $result->get_error_code() );
	}

	public function test_bulk_delete_trashes_by_default(): void {
		Functions\when( 'absint' )->alias( fn( $v ) => abs( (int) $v ) );
		Functions\when( 'current_user_can' )->justReturn( true );
		Functions\expect( 'wp_trash_post' )->twice()->andReturn( new \stdClass() );
		Functions\expect( 'wp_delete_attachment' )->never();

		$result = ( new Media() )->bulk_delete( [ 4, 5 ] );

		$this->assertSame( 2, $result['deleted'] );
		$this->assertSame( 0, $result['failed'] );
	}

	public function test_bulk_delete_deletes_permanently_only_when_forced(): void {
		Functions\when( 'absint' )->alias( fn( $v ) => abs( (int) $v ) );
		Functions\when( 'current_user_can' )->justReturn( true );
		Functions\expect( 'wp_delete_attachment' )->once()->with( 4, true )->andReturn( new \stdClass() );
		Functions\expect( 'wp_trash_post' )->never();

		$this->assertSame( 1, ( new Media() )->bulk_delete( [ 4 ], true )['deleted'] );
	}

	public function test_bulk_delete_skips_files_the_user_cannot_delete(): void {
		Functions\when( 'absint' )->alias( fn( $v ) => abs( (int) $v ) );
		Functions\when( 'current_user_can' )->alias( fn( $cap, $id ) => 4 === $id );
		Functions\expect( 'wp_trash_post' )->once()->with( 4 )->andReturn( new \stdClass() );

		$result = ( new Media() )->bulk_delete( [ 4, 5 ] );

		$this->assertSame( 1, $result['deleted'] );
		$this->assertSame( [ 5 ], $result['errors'] );
	}

	public function test_bulk_update_changes_nothing_when_every_field_is_empty(): void {
		Functions\when( 'absint' )->alias( fn( $v ) => abs( (int) $v ) );
		Functions\expect( 'current_user_can' )->never();
		Functions\expect( 'wp_update_post' )->never();
		Functions\expect( 'update_post_meta' )->never();

		$result = ( new Media() )->bulk_update( [ 4, 5 ], [ 'title' => '  ', 'alt' => '' ] );

		$this->assertSame( 0, $result['updated'] );
		$this->assertSame( 2, $result['failed'] );
	}

	public function test_bulk_restore_counts_only_restored_files(): void {
		Functions\when( 'absint' )->alias( fn( $v ) => abs( (int) $v ) );
		Functions\when( 'current_user_can' )->justReturn( true );
		Functions\when( 'wp_untrash_post' )->alias( fn( $id ) => 4 === $id ? new \stdClass() : false );

		$result = ( new Media() )->bulk_restore( [ 4, 5 ] );

		$this->assertSame( 1, $result['restored'] );
		$this->assertSame( 1, $result['failed'] );
	}
}
