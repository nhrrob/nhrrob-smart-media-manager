<?php

declare( strict_types=1 );

namespace Nhrsmm\SmartMediaManager\Tests\Unit;

use Brain\Monkey\Functions;
use Nhrsmm\SmartMediaManager\Assets;

class AssetsProviderLabelTest extends TestCase {

	private \ReflectionMethod $method;
	private Assets $assets;

	protected function setUp(): void {
		parent::setUp();
		$this->assets = new Assets();
		$this->method = new \ReflectionMethod( Assets::class, 'get_ai_provider_label' );
		$this->method->setAccessible( true );
	}

	private function invoke(): string {
		return $this->method->invoke( $this->assets );
	}

	public function test_returns_empty_string_when_wp_supports_ai_returns_false(): void {
		Functions\when( 'wp_supports_ai' )->justReturn( false );

		$this->assertSame( '', $this->invoke() );
	}

	/**
	 * @runInSeparateProcess
	 * @preserveGlobalState disabled
	 */
	public function test_returns_anthropic_when_anthropic_provider_class_exists(): void {
		require_once dirname( __DIR__ ) . '/stubs/class-anthropic-provider.php';
		Functions\when( 'wp_supports_ai' )->justReturn( true );

		$this->assertSame( 'Anthropic', $this->invoke() );
	}

	/**
	 * @runInSeparateProcess
	 * @preserveGlobalState disabled
	 */
	public function test_returns_openai_when_openai_provider_class_exists(): void {
		require_once dirname( __DIR__ ) . '/stubs/class-openai-provider.php';
		Functions\when( 'wp_supports_ai' )->justReturn( true );

		$this->assertSame( 'OpenAI', $this->invoke() );
	}

	/**
	 * @runInSeparateProcess
	 * @preserveGlobalState disabled
	 */
	public function test_returns_google_when_google_provider_class_exists(): void {
		require_once dirname( __DIR__ ) . '/stubs/class-google-provider.php';
		Functions\when( 'wp_supports_ai' )->justReturn( true );

		$this->assertSame( 'Google', $this->invoke() );
	}

	/**
	 * @runInSeparateProcess
	 * @preserveGlobalState disabled
	 */
	public function test_returns_generic_ai_as_fallback(): void {
		Functions\when( 'wp_supports_ai' )->justReturn( true );

		$this->assertSame( 'AI', $this->invoke() );
	}
}
