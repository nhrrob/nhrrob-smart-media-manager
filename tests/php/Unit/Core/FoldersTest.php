<?php

declare( strict_types=1 );

namespace Nhrsmm\SmartMediaManager\Tests\Unit\Core;

use Brain\Monkey\Functions;
use Mockery;
use Nhrsmm\SmartMediaManager\Core\Folders;
use Nhrsmm\SmartMediaManager\Tests\Unit\TestCase;

class FoldersTest extends TestCase {

	private Folders $folders;

	protected function setUp(): void {
		parent::setUp();
		$this->folders = new Folders();
	}

	public function test_get_tree_returns_empty_when_get_terms_returns_wp_error(): void {
		$error = Mockery::mock( 'WP_Error' );

		Functions\expect( 'get_terms' )->once()->andReturn( $error );
		Functions\expect( 'is_wp_error' )->once()->with( $error )->andReturn( true );

		$result = $this->folders->get_tree();

		$this->assertSame( [], $result );
	}

	public function test_get_tree_returns_flat_root_terms_as_tree(): void {
		$term         = new \stdClass();
		$term->term_id = 1;
		$term->name    = 'Photos';
		$term->slug    = 'photos';
		$term->parent  = 0;
		$term->count   = 3;

		Functions\expect( 'get_terms' )->once()->andReturn( [ $term ] );
		Functions\expect( 'is_wp_error' )->once()->andReturn( false );

		$result = $this->folders->get_tree();

		$this->assertCount( 1, $result );
		$this->assertSame( 1, $result[0]['id'] );
		$this->assertSame( 'Photos', $result[0]['name'] );
		$this->assertSame( 'photos', $result[0]['slug'] );
		$this->assertSame( 0, $result[0]['parent'] );
		$this->assertSame( 3, $result[0]['count'] );
		$this->assertSame( [], $result[0]['children'] );
	}

	public function test_get_tree_nests_children_under_parent(): void {
		$parent         = new \stdClass();
		$parent->term_id = 1;
		$parent->name    = 'Media';
		$parent->slug    = 'media';
		$parent->parent  = 0;
		$parent->count   = 0;

		$child         = new \stdClass();
		$child->term_id = 2;
		$child->name    = 'Videos';
		$child->slug    = 'videos';
		$child->parent  = 1;
		$child->count   = 5;

		Functions\expect( 'get_terms' )->once()->andReturn( [ $parent, $child ] );
		Functions\expect( 'is_wp_error' )->once()->andReturn( false );

		$result = $this->folders->get_tree();

		$this->assertCount( 1, $result );
		$this->assertCount( 1, $result[0]['children'] );
		$this->assertSame( 2, $result[0]['children'][0]['id'] );
		$this->assertSame( 'Videos', $result[0]['children'][0]['name'] );
	}

	public function test_create_returns_wp_error_for_empty_name(): void {
		Functions\expect( 'sanitize_text_field' )->once()->with( '' )->andReturn( '' );
		Functions\expect( '__' )->once()->andReturn( 'Folder name cannot be empty.' );

		$result = $this->folders->create( '' );

		$this->assertInstanceOf( \WP_Error::class, $result );
	}

	public function test_create_returns_folder_array_on_success(): void {
		$term         = new \stdClass();
		$term->term_id = 10;
		$term->name    = 'New Folder';
		$term->slug    = 'new-folder';
		$term->parent  = 0;
		$term->count   = 0;

		Functions\expect( 'sanitize_text_field' )->once()->with( 'New Folder' )->andReturn( 'New Folder' );
		Functions\expect( 'wp_insert_term' )->once()->andReturn( [ 'term_id' => 10, 'term_taxonomy_id' => 10 ] );
		Functions\expect( 'is_wp_error' )->once()->andReturn( false );
		Functions\expect( 'get_term' )->once()->andReturn( $term );

		$result = $this->folders->create( 'New Folder' );

		$this->assertIsArray( $result );
		$this->assertSame( 10, $result['id'] );
		$this->assertSame( 'New Folder', $result['name'] );
		$this->assertSame( [], $result['children'] );
	}

	public function test_rename_returns_wp_error_for_empty_name(): void {
		Functions\expect( 'sanitize_text_field' )->once()->with( '' )->andReturn( '' );
		Functions\expect( '__' )->once()->andReturn( 'Folder name cannot be empty.' );

		$result = $this->folders->rename( 1, '' );

		$this->assertInstanceOf( \WP_Error::class, $result );
	}

	public function test_delete_returns_true_on_success(): void {
		Functions\expect( 'get_objects_in_term' )->once()->andReturn( [] );
		Functions\expect( 'get_term_children' )->once()->andReturn( [] );
		Functions\expect( 'wp_delete_term' )->once()->andReturn( true );
		Functions\expect( 'is_wp_error' )->once()->andReturn( false );

		$result = $this->folders->delete( 1 );

		$this->assertTrue( $result );
	}
}
