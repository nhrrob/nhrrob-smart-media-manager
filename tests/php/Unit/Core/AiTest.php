<?php

declare( strict_types=1 );

namespace Nhrsmm\SmartMediaManager\Tests\Unit\Core;

use Brain\Monkey\Functions;
use Mockery;
use Nhrsmm\SmartMediaManager\Core\Ai;
use Nhrsmm\SmartMediaManager\Tests\Unit\TestCase;

class AiTest extends TestCase {

	private Ai $ai;

	protected function setUp(): void {
		parent::setUp();
		$this->ai = new Ai();
	}

	private function alt_text_builder( $generate_text_return = 'A dog in a park' ): object {
		$b = Mockery::mock();
		$b->shouldReceive( 'using_system_instruction' )->andReturn( $b );
		$b->shouldReceive( 'with_file' )->andReturn( $b );
		$b->shouldReceive( 'with_text' )->andReturn( $b );
		$b->shouldReceive( 'generate_text' )->andReturn( $generate_text_return );
		return $b;
	}

	private function caption_image_builder( $generate_text_return = 'A scenic view' ): object {
		$b = Mockery::mock();
		$b->shouldReceive( 'using_system_instruction' )->andReturn( $b );
		$b->shouldReceive( 'with_file' )->andReturn( $b );
		$b->shouldReceive( 'with_text' )->andReturn( $b );
		$b->shouldReceive( 'generate_text' )->andReturn( $generate_text_return );
		return $b;
	}

	private function caption_text_builder( $generate_text_return = 'A report file' ): object {
		$b = Mockery::mock();
		$b->shouldReceive( 'using_system_instruction' )->andReturn( $b );
		$b->shouldReceive( 'with_text' )->andReturn( $b );
		$b->shouldReceive( 'generate_text' )->andReturn( $generate_text_return );
		return $b;
	}

	public function test_generate_alt_text_returns_error_for_non_image(): void {
		Functions\when( 'wp_attachment_is_image' )->justReturn( false );
		Functions\when( '__' )->returnArg();

		$result = $this->ai->generate_alt_text( 42 );

		$this->assertInstanceOf( \WP_Error::class, $result );
		$this->assertSame( 'not_image', $result->get_error_code() );
	}

	public function test_generate_alt_text_returns_error_when_ai_function_missing(): void {
		Functions\when( 'wp_attachment_is_image' )->justReturn( true );
		Functions\when( '__' )->returnArg();

		$result = $this->ai->generate_alt_text( 42 );

		$this->assertInstanceOf( \WP_Error::class, $result );
		$this->assertSame( 'no_ai_provider', $result->get_error_code() );
	}

	public function test_generate_alt_text_returns_error_when_ai_not_supported(): void {
		Functions\when( 'wp_attachment_is_image' )->justReturn( true );
		Functions\when( 'wp_ai_client_prompt' )->justReturn( null ); // makes function_exists() true
		Functions\when( 'wp_supports_ai' )->justReturn( false );
		Functions\when( '__' )->returnArg();

		$result = $this->ai->generate_alt_text( 42 );

		$this->assertInstanceOf( \WP_Error::class, $result );
		$this->assertSame( 'no_ai_provider', $result->get_error_code() );
	}

	public function test_generate_alt_text_returns_error_when_attached_file_missing(): void {
		Functions\when( 'wp_attachment_is_image' )->justReturn( true );
		Functions\when( 'wp_ai_client_prompt' )->justReturn( null );
		Functions\when( 'wp_supports_ai' )->justReturn( true );
		Functions\when( 'get_attached_file' )->justReturn( false );
		Functions\when( '__' )->returnArg();

		$result = $this->ai->generate_alt_text( 42 );

		$this->assertInstanceOf( \WP_Error::class, $result );
		$this->assertSame( 'no_file', $result->get_error_code() );
	}

	public function test_generate_alt_text_calls_using_system_instruction_not_with_system(): void {
		$builder = Mockery::mock();
		$builder->shouldReceive( 'using_system_instruction' )
			->with( 'You are an accessibility expert.' )
			->once()
			->andReturn( $builder );
		$builder->shouldReceive( 'with_file' )->andReturn( $builder );
		$builder->shouldReceive( 'with_text' )->andReturn( $builder );
		$builder->shouldReceive( 'generate_text' )->andReturn( 'A cat on a mat' );

		Functions\when( 'wp_attachment_is_image' )->justReturn( true );
		Functions\when( 'wp_ai_client_prompt' )->justReturn( $builder );
		Functions\when( 'wp_supports_ai' )->justReturn( true );
		Functions\when( 'get_attached_file' )->justReturn( '/var/www/html/wp-content/uploads/cat.jpg' );
		Functions\when( 'get_post_mime_type' )->justReturn( 'image/jpeg' );
		Functions\when( 'is_wp_error' )->justReturn( false );

		$this->ai->generate_alt_text( 42 );
		// Mockery verifies ->once() on tearDown; reaching here without error is the assertion.
		$this->assertTrue( true );
	}

	public function test_generate_alt_text_calls_generate_text_with_no_arguments(): void {
		$builder = Mockery::mock();
		$builder->shouldReceive( 'using_system_instruction' )->andReturn( $builder );
		$builder->shouldReceive( 'with_file' )->andReturn( $builder );
		$builder->shouldReceive( 'with_text' )->andReturn( $builder );
		$builder->shouldReceive( 'generate_text' )->withNoArgs()->once()->andReturn( 'Alt text' );

		Functions\when( 'wp_attachment_is_image' )->justReturn( true );
		Functions\when( 'wp_ai_client_prompt' )->justReturn( $builder );
		Functions\when( 'wp_supports_ai' )->justReturn( true );
		Functions\when( 'get_attached_file' )->justReturn( '/uploads/photo.png' );
		Functions\when( 'get_post_mime_type' )->justReturn( 'image/png' );
		Functions\when( 'is_wp_error' )->justReturn( false );

		$this->ai->generate_alt_text( 42 );
		$this->assertTrue( true );
	}

	public function test_generate_alt_text_falls_back_to_jpeg_mime_when_type_unknown(): void {
		$builder = Mockery::mock();
		$builder->shouldReceive( 'using_system_instruction' )->andReturn( $builder );
		$builder->shouldReceive( 'with_file' )
			->with( '/uploads/image.bin', 'image/jpeg' )
			->once()
			->andReturn( $builder );
		$builder->shouldReceive( 'with_text' )->andReturn( $builder );
		$builder->shouldReceive( 'generate_text' )->andReturn( 'An image' );

		Functions\when( 'wp_attachment_is_image' )->justReturn( true );
		Functions\when( 'wp_ai_client_prompt' )->justReturn( $builder );
		Functions\when( 'wp_supports_ai' )->justReturn( true );
		Functions\when( 'get_attached_file' )->justReturn( '/uploads/image.bin' );
		Functions\when( 'get_post_mime_type' )->justReturn( false );
		Functions\when( 'is_wp_error' )->justReturn( false );

		$result = $this->ai->generate_alt_text( 42 );
		$this->assertIsArray( $result );
	}

	public function test_generate_alt_text_propagates_wp_error_from_builder(): void {
		$api_error = new \WP_Error( 'api_error', 'Provider request failed' );

		$builder = Mockery::mock();
		$builder->shouldReceive( 'using_system_instruction' )->andReturn( $builder );
		$builder->shouldReceive( 'with_file' )->andReturn( $builder );
		$builder->shouldReceive( 'with_text' )->andReturn( $builder );
		$builder->shouldReceive( 'generate_text' )->andReturn( $api_error );

		Functions\when( 'wp_attachment_is_image' )->justReturn( true );
		Functions\when( 'wp_supports_ai' )->justReturn( true );
		Functions\when( 'wp_ai_client_prompt' )->justReturn( $builder );
		Functions\when( 'get_attached_file' )->justReturn( '/uploads/photo.jpg' );
		Functions\when( 'get_post_mime_type' )->justReturn( 'image/jpeg' );
		Functions\when( 'is_wp_error' )->alias( fn( $v ) => $v instanceof \WP_Error );

		$result = $this->ai->generate_alt_text( 42 );

		$this->assertInstanceOf( \WP_Error::class, $result );
		$this->assertSame( 'api_error', $result->get_error_code() );
	}

	public function test_generate_alt_text_returns_error_on_empty_ai_response(): void {
		$builder = $this->alt_text_builder( '   ' ); // whitespace only

		Functions\when( 'wp_attachment_is_image' )->justReturn( true );
		Functions\when( 'wp_supports_ai' )->justReturn( true );
		Functions\when( 'wp_ai_client_prompt' )->justReturn( $builder );
		Functions\when( 'get_attached_file' )->justReturn( '/uploads/photo.jpg' );
		Functions\when( 'get_post_mime_type' )->justReturn( 'image/jpeg' );
		Functions\when( 'is_wp_error' )->justReturn( false );
		Functions\when( '__' )->returnArg();

		$result = $this->ai->generate_alt_text( 42 );

		$this->assertInstanceOf( \WP_Error::class, $result );
		$this->assertSame( 'empty_response', $result->get_error_code() );
	}

	public function test_generate_alt_text_returns_correct_shape_on_success(): void {
		$expected_text = 'A dog running in a green field';
		$builder       = $this->alt_text_builder( $expected_text );

		Functions\when( 'wp_attachment_is_image' )->justReturn( true );
		Functions\when( 'wp_supports_ai' )->justReturn( true );
		Functions\when( 'wp_ai_client_prompt' )->justReturn( $builder );
		Functions\when( 'get_attached_file' )->justReturn( '/uploads/dog.jpg' );
		Functions\when( 'get_post_mime_type' )->justReturn( 'image/jpeg' );
		Functions\when( 'is_wp_error' )->justReturn( false );

		$result = $this->ai->generate_alt_text( 42 );

		$this->assertIsArray( $result );
		$this->assertArrayHasKey( 'alt_text', $result );
		$this->assertArrayHasKey( 'model', $result );
		$this->assertArrayHasKey( 'latency', $result );
		$this->assertArrayHasKey( 'chars', $result );
		$this->assertSame( $expected_text, $result['alt_text'] );
		$this->assertSame( 'wp-ai-client', $result['model'] );
		$this->assertIsInt( $result['latency'] );
		$this->assertSame( mb_strlen( $expected_text ), $result['chars'] );
	}

	public function test_generate_caption_returns_error_when_ai_not_supported(): void {
		Functions\when( 'wp_ai_client_prompt' )->justReturn( null );
		Functions\when( 'wp_supports_ai' )->justReturn( false );
		Functions\when( '__' )->returnArg();

		$result = $this->ai->generate_caption( 42 );

		$this->assertInstanceOf( \WP_Error::class, $result );
		$this->assertSame( 'no_ai_provider', $result->get_error_code() );
	}

	public function test_generate_caption_returns_error_when_image_file_missing(): void {
		Functions\when( 'wp_ai_client_prompt' )->justReturn( null );
		Functions\when( 'wp_supports_ai' )->justReturn( true );
		Functions\when( 'wp_attachment_is_image' )->justReturn( true );
		Functions\when( 'get_attached_file' )->justReturn( false );
		Functions\when( '__' )->returnArg();

		$result = $this->ai->generate_caption( 42 );

		$this->assertInstanceOf( \WP_Error::class, $result );
		$this->assertSame( 'no_file', $result->get_error_code() );
	}

	public function test_generate_caption_for_image_calls_with_file(): void {
		$builder = Mockery::mock();
		$builder->shouldReceive( 'using_system_instruction' )
			->with( 'You are a content writer for a website.' )
			->once()
			->andReturn( $builder );
		$builder->shouldReceive( 'with_file' )->once()->andReturn( $builder );
		$builder->shouldReceive( 'with_text' )->once()->andReturn( $builder );
		$builder->shouldReceive( 'generate_text' )->once()->andReturn( 'Sunset over mountains' );

		Functions\when( 'wp_supports_ai' )->justReturn( true );
		Functions\when( 'wp_attachment_is_image' )->justReturn( true );
		Functions\when( 'wp_ai_client_prompt' )->justReturn( $builder );
		Functions\when( 'get_attached_file' )->justReturn( '/uploads/sunset.jpg' );
		Functions\when( 'get_post_mime_type' )->justReturn( 'image/jpeg' );
		Functions\when( 'is_wp_error' )->justReturn( false );

		$result = $this->ai->generate_caption( 42 );

		$this->assertIsArray( $result );
		$this->assertSame( 'Sunset over mountains', $result['caption'] );
		$this->assertSame( 'wp-ai-client', $result['model'] );
	}

	public function test_generate_caption_for_non_image_uses_post_title(): void {
		$post             = new \stdClass();
		$post->post_title = 'Annual Report 2025';

		$builder = Mockery::mock();
		$builder->shouldReceive( 'using_system_instruction' )->andReturn( $builder );
		// No with_file expectation — Mockery will fail if it is called.
		$builder->shouldReceive( 'with_text' )
			->with( Mockery::pattern( '/Annual Report 2025/' ) )
			->once()
			->andReturn( $builder );
		$builder->shouldReceive( 'generate_text' )->andReturn( 'Annual report document' );

		Functions\when( 'wp_supports_ai' )->justReturn( true );
		Functions\when( 'wp_attachment_is_image' )->justReturn( false );
		Functions\when( 'wp_ai_client_prompt' )->justReturn( $builder );
		Functions\when( 'get_post' )->justReturn( $post );
		Functions\when( 'sanitize_text_field' )->returnArg();
		Functions\when( 'esc_html' )->returnArg();
		Functions\when( 'is_wp_error' )->justReturn( false );

		$result = $this->ai->generate_caption( 42 );

		$this->assertIsArray( $result );
		$this->assertSame( 'Annual report document', $result['caption'] );
	}

	public function test_generate_caption_non_image_falls_back_to_filename_when_no_title(): void {
		$post             = new \stdClass();
		$post->post_title = '';

		$builder = Mockery::mock();
		$builder->shouldReceive( 'using_system_instruction' )->andReturn( $builder );
		$builder->shouldReceive( 'with_text' )
			->with( Mockery::pattern( '/report\.pdf/' ) )
			->once()
			->andReturn( $builder );
		$builder->shouldReceive( 'generate_text' )->andReturn( 'A financial report' );

		Functions\when( 'wp_supports_ai' )->justReturn( true );
		Functions\when( 'wp_attachment_is_image' )->justReturn( false );
		Functions\when( 'wp_ai_client_prompt' )->justReturn( $builder );
		Functions\when( 'get_post' )->justReturn( $post );
		Functions\when( 'sanitize_text_field' )->returnArg();
		Functions\when( 'get_attached_file' )->justReturn( '/uploads/2025/report.pdf' );
		Functions\when( 'esc_html' )->returnArg();
		Functions\when( 'is_wp_error' )->justReturn( false );

		$result = $this->ai->generate_caption( 42 );

		$this->assertIsArray( $result );
		$this->assertSame( 'A financial report', $result['caption'] );
	}

	public function test_generate_caption_propagates_wp_error_from_builder(): void {
		$api_error = new \WP_Error( 'network_error', 'Connection timed out' );

		$builder = Mockery::mock();
		$builder->shouldReceive( 'using_system_instruction' )->andReturn( $builder );
		$builder->shouldReceive( 'with_file' )->andReturn( $builder );
		$builder->shouldReceive( 'with_text' )->andReturn( $builder );
		$builder->shouldReceive( 'generate_text' )->andReturn( $api_error );

		Functions\when( 'wp_supports_ai' )->justReturn( true );
		Functions\when( 'wp_attachment_is_image' )->justReturn( true );
		Functions\when( 'wp_ai_client_prompt' )->justReturn( $builder );
		Functions\when( 'get_attached_file' )->justReturn( '/uploads/photo.jpg' );
		Functions\when( 'get_post_mime_type' )->justReturn( 'image/jpeg' );
		Functions\when( 'is_wp_error' )->alias( fn( $v ) => $v instanceof \WP_Error );

		$result = $this->ai->generate_caption( 42 );

		$this->assertInstanceOf( \WP_Error::class, $result );
		$this->assertSame( 'network_error', $result->get_error_code() );
	}

	public function test_generate_caption_returns_error_on_empty_ai_response(): void {
		$builder = $this->caption_image_builder( '' );

		Functions\when( 'wp_supports_ai' )->justReturn( true );
		Functions\when( 'wp_attachment_is_image' )->justReturn( true );
		Functions\when( 'wp_ai_client_prompt' )->justReturn( $builder );
		Functions\when( 'get_attached_file' )->justReturn( '/uploads/photo.jpg' );
		Functions\when( 'get_post_mime_type' )->justReturn( 'image/jpeg' );
		Functions\when( 'is_wp_error' )->justReturn( false );
		Functions\when( '__' )->returnArg();

		$result = $this->ai->generate_caption( 42 );

		$this->assertInstanceOf( \WP_Error::class, $result );
		$this->assertSame( 'empty_response', $result->get_error_code() );
	}

	public function test_generate_caption_returns_correct_shape_on_success(): void {
		$expected_text = 'A beautiful sunset over the mountains';
		$builder       = $this->caption_image_builder( $expected_text );

		Functions\when( 'wp_supports_ai' )->justReturn( true );
		Functions\when( 'wp_attachment_is_image' )->justReturn( true );
		Functions\when( 'wp_ai_client_prompt' )->justReturn( $builder );
		Functions\when( 'get_attached_file' )->justReturn( '/uploads/sunset.jpg' );
		Functions\when( 'get_post_mime_type' )->justReturn( 'image/jpeg' );
		Functions\when( 'is_wp_error' )->justReturn( false );

		$result = $this->ai->generate_caption( 42 );

		$this->assertIsArray( $result );
		$this->assertArrayHasKey( 'caption', $result );
		$this->assertArrayHasKey( 'model', $result );
		$this->assertArrayHasKey( 'latency', $result );
		$this->assertArrayHasKey( 'chars', $result );
		$this->assertSame( $expected_text, $result['caption'] );
		$this->assertSame( 'wp-ai-client', $result['model'] );
		$this->assertIsInt( $result['latency'] );
		$this->assertSame( mb_strlen( $expected_text ), $result['chars'] );
	}
}
