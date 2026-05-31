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
}
