<?php

declare( strict_types=1 );

namespace Nhrsmm\SmartMediaManager\Tests\Unit\Core;

use Brain\Monkey\Functions;
use Nhrsmm\SmartMediaManager\Core\Options;
use Nhrsmm\SmartMediaManager\Tests\Unit\TestCase;

class OptionsTest extends TestCase {

	public function test_get_merges_saved_settings_over_defaults(): void {
		Functions\when( 'get_option' )->alias(
			fn( $name, $fallback = false ) => 'nhrsmm_settings' === $name ? [ 'default_view' => 'list', 'default_upload_folder' => 7 ] : $fallback
		);

		$settings = Options::get();

		$this->assertSame( 'list', $settings['default_view'] );
		$this->assertSame( 7, $settings['default_upload_folder'] );
		$this->assertSame( 125, $settings['ai_alt_length'] );
		$this->assertFalse( $settings['auto_alt'] );
	}

	public function test_get_falls_back_to_the_legacy_upload_folder_option(): void {
		Functions\when( 'get_option' )->alias(
			fn( $name, $fallback = false ) => 'nhrsmm_default_upload_folder' === $name ? '12' : []
		);

		$this->assertSame( 12, Options::get()['default_upload_folder'] );
	}

	public function test_get_survives_a_corrupt_settings_value(): void {
		Functions\when( 'get_option' )->justReturn( 'not-an-array' );

		$this->assertSame( 'grid', Options::get()['default_view'] );
	}

	public function test_save_rejects_invalid_values_and_clamps_numbers(): void {
		$saved = null;
		Functions\when( 'get_option' )->justReturn( [] );
		Functions\when( 'absint' )->alias( fn( $v ) => abs( (int) $v ) );
		Functions\when( 'sanitize_text_field' )->returnArg();
		Functions\when( 'sanitize_textarea_field' )->returnArg();
		Functions\when( 'term_exists' )->justReturn( null );
		Functions\when( 'delete_option' )->justReturn( true );
		Functions\when( 'update_option' )->alias(
			function ( $name, $value ) use ( &$saved ) {
				$saved = $value;
				return true;
			}
		);

		$result = Options::save(
			[
				'default_view'          => 'carousel',
				'items_per_page'        => 7,
				'startup_folder'        => 'somewhere',
				'default_upload_folder' => 99,
				'auto_alt'              => 1,
				'ai_alt_length'         => 5000,
				'ai_prompt'             => str_repeat( 'x', 900 ),
			]
		);

		$this->assertSame( $saved, $result );
		$this->assertSame( 'grid', $result['default_view'] );
		$this->assertSame( 40, $result['items_per_page'] );
		$this->assertSame( 'all', $result['startup_folder'] );
		$this->assertSame( 0, $result['default_upload_folder'], 'A folder that does not exist must not be saved.' );
		$this->assertTrue( $result['auto_alt'] );
		$this->assertSame( 300, $result['ai_alt_length'] );
		$this->assertSame( 500, strlen( $result['ai_prompt'] ) );
	}
}
