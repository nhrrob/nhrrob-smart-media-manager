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

		global $wpdb;
		$wpdb                    = Mockery::mock( 'stdClass' );
		$wpdb->term_relationships = 'wp_term_relationships';
		$wpdb->term_taxonomy      = 'wp_term_taxonomy';
		$wpdb->posts              = 'wp_posts';
		$wpdb->postmeta           = 'wp_postmeta';
		$wpdb->shouldReceive( 'get_results' )->andReturn( [] );
		$wpdb->shouldReceive( 'get_var' )->andReturn( '0' );
		$wpdb->shouldReceive( 'prepare' )->andReturnArg( 0 );

		// Folder colour and manual order are stored as term meta.
		Functions\when( 'get_term_meta' )->justReturn( '' );
	}

	protected function tearDown(): void {
		global $wpdb;
		$wpdb = null;
		parent::tearDown();
	}

	public function test_get_tree_always_returns_tree_and_uncategorized_keys(): void {
		Functions\expect( 'get_terms' )->once()->andReturn( [] );
		Functions\expect( 'is_wp_error' )->once()->andReturn( false );

		$result = $this->folders->get_tree();

		$this->assertIsArray( $result );
		$this->assertArrayHasKey( 'tree', $result );
		$this->assertArrayHasKey( 'uncategorized', $result );
		$this->assertIsArray( $result['tree'] );
		$this->assertIsInt( $result['uncategorized'] );
	}

	public function test_get_tree_returns_empty_tree_when_get_terms_returns_wp_error(): void {
		$error = Mockery::mock( 'WP_Error' );

		Functions\expect( 'get_terms' )->once()->andReturn( $error );
		Functions\expect( 'is_wp_error' )->once()->with( $error )->andReturn( true );

		$result = $this->folders->get_tree();

		$this->assertSame( [], $result['tree'] );
		$this->assertSame( 0, $result['uncategorized'] );
	}

	public function test_get_tree_returns_empty_tree_when_no_terms(): void {
		Functions\expect( 'get_terms' )->once()->andReturn( [] );
		Functions\expect( 'is_wp_error' )->once()->andReturn( false );

		$result = $this->folders->get_tree();

		$this->assertSame( [], $result['tree'] );
	}

	public function test_get_tree_returns_flat_root_terms_as_tree(): void {
		$term          = new \stdClass();
		$term->term_id = 1;
		$term->name    = 'Photos';
		$term->slug    = 'photos';
		$term->parent  = 0;
		$term->count   = 3;

		Functions\expect( 'get_terms' )->once()->andReturn( [ $term ] );
		Functions\expect( 'is_wp_error' )->once()->andReturn( false );

		$result = $this->folders->get_tree();
		$tree   = $result['tree'];

		$this->assertCount( 1, $tree );
		$this->assertSame( 1, $tree[0]['id'] );
		$this->assertSame( 'Photos', $tree[0]['name'] );
		$this->assertSame( 'photos', $tree[0]['slug'] );
		$this->assertSame( 0, $tree[0]['parent'] );
		$this->assertSame( [], $tree[0]['children'] );
	}

	public function test_get_tree_nests_children_under_parent(): void {
		$parent          = new \stdClass();
		$parent->term_id = 1;
		$parent->name    = 'Media';
		$parent->slug    = 'media';
		$parent->parent  = 0;
		$parent->count   = 0;

		$child          = new \stdClass();
		$child->term_id = 2;
		$child->name    = 'Videos';
		$child->slug    = 'videos';
		$child->parent  = 1;
		$child->count   = 5;

		Functions\expect( 'get_terms' )->once()->andReturn( [ $parent, $child ] );
		Functions\expect( 'is_wp_error' )->once()->andReturn( false );

		$result = $this->folders->get_tree();
		$tree   = $result['tree'];

		$this->assertCount( 1, $tree );
		$this->assertCount( 1, $tree[0]['children'] );
		$this->assertSame( 2, $tree[0]['children'][0]['id'] );
		$this->assertSame( 'Videos', $tree[0]['children'][0]['name'] );
	}

	public function test_get_tree_uses_direct_db_count_over_term_count(): void {
		$term          = new \stdClass();
		$term->term_id = 7;
		$term->name    = 'Docs';
		$term->slug    = 'docs';
		$term->parent  = 0;
		$term->count   = 0;

		global $wpdb;
		$row              = new \stdClass();
		$row->term_id     = 7;
		$row->c           = 4;
		$wpdb                     = Mockery::mock( 'stdClass' );
		$wpdb->term_relationships = 'wp_term_relationships';
		$wpdb->term_taxonomy      = 'wp_term_taxonomy';
		$wpdb->posts              = 'wp_posts';
		$wpdb->postmeta           = 'wp_postmeta';
		$wpdb->shouldReceive( 'get_results' )->andReturn( [ $row ] );
		$wpdb->shouldReceive( 'get_var' )->andReturn( '0' );
		$wpdb->shouldReceive( 'prepare' )->andReturnArg( 0 );

		Functions\expect( 'get_terms' )->once()->andReturn( [ $term ] );
		Functions\expect( 'is_wp_error' )->once()->andReturn( false );

		$result = $this->folders->get_tree();

		$this->assertSame( 4, $result['tree'][0]['count'] );
	}

	public function test_create_returns_wp_error_for_empty_name(): void {
		Functions\expect( 'sanitize_text_field' )->once()->with( '' )->andReturn( '' );
		Functions\expect( '__' )->once()->andReturn( 'Folder name cannot be empty.' );

		$result = $this->folders->create( '' );

		$this->assertInstanceOf( \WP_Error::class, $result );
	}

	public function test_create_returns_folder_array_on_success(): void {
		$term          = new \stdClass();
		$term->term_id = 10;
		$term->name    = 'New Folder';
		$term->slug    = 'new-folder';
		$term->parent  = 0;
		$term->count   = 0;

		Functions\expect( 'sanitize_text_field' )->once()->with( 'New Folder' )->andReturn( 'New Folder' );
		Functions\expect( 'wp_insert_term' )->once()->andReturn( [ 'term_id' => 10, 'term_taxonomy_id' => 10 ] );
		// is_wp_error is called twice: once for wp_insert_term result, once for get_term result.
		Functions\when( 'is_wp_error' )->alias( fn( $v ) => $v instanceof \WP_Error );
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
		// is_wp_error is called 3 times: for attachments, children, and wp_delete_term result.
		Functions\when( 'is_wp_error' )->alias( fn( $v ) => $v instanceof \WP_Error );

		$result = $this->folders->delete( 1 );

		$this->assertTrue( $result );
	}

	public function test_delete_continues_when_get_objects_in_term_returns_wp_error(): void {
		$error = new \WP_Error( 'db_error', 'Database error' );

		Functions\when( 'get_objects_in_term' )->justReturn( $error );
		Functions\when( 'get_term_children' )->justReturn( [] );
		Functions\when( 'wp_delete_term' )->justReturn( true );
		Functions\when( 'is_wp_error' )->alias( fn( $v ) => $v instanceof \WP_Error );

		$result = $this->folders->delete( 1 );

		$this->assertTrue( $result );
	}

	public function test_delete_continues_when_get_term_children_returns_wp_error(): void {
		$error = new \WP_Error( 'db_error', 'Database error' );

		Functions\when( 'get_objects_in_term' )->justReturn( [] );
		Functions\when( 'get_term_children' )->justReturn( $error );
		Functions\when( 'wp_delete_term' )->justReturn( true );
		Functions\when( 'is_wp_error' )->alias( fn( $v ) => $v instanceof \WP_Error );

		$result = $this->folders->delete( 1 );

		$this->assertTrue( $result );
	}

	public function test_create_returns_term_error_when_get_term_returns_null(): void {
		Functions\when( 'sanitize_text_field' )->returnArg();
		Functions\when( 'wp_insert_term' )->justReturn( [ 'term_id' => 10, 'term_taxonomy_id' => 10 ] );
		Functions\when( 'get_term' )->justReturn( null );
		Functions\when( 'is_wp_error' )->alias( fn( $v ) => $v instanceof \WP_Error );
		Functions\when( '__' )->returnArg();

		$result = $this->folders->create( 'Test Folder' );

		$this->assertInstanceOf( \WP_Error::class, $result );
		$this->assertSame( 'term_error', $result->get_error_code() );
	}

	public function test_rename_returns_term_error_when_get_term_returns_null(): void {
		Functions\when( 'sanitize_text_field' )->returnArg();
		Functions\when( 'wp_update_term' )->justReturn( [ 'term_id' => 5, 'term_taxonomy_id' => 5 ] );
		Functions\when( 'get_term' )->justReturn( null );
		Functions\when( 'is_wp_error' )->alias( fn( $v ) => $v instanceof \WP_Error );
		Functions\when( '__' )->returnArg();

		$result = $this->folders->rename( 5, 'New Name' );

		$this->assertInstanceOf( \WP_Error::class, $result );
		$this->assertSame( 'term_error', $result->get_error_code() );
	}

	public function test_move_returns_circular_parent_error_when_new_parent_is_descendant(): void {
		Functions\expect( 'get_term_children' )
			->once()
			->with( 1, 'nhrsmm_media_folder' )
			->andReturn( [ 5, 6 ] );
		Functions\when( '__' )->returnArg();

		$result = $this->folders->move( 1, 5 );

		$this->assertInstanceOf( \WP_Error::class, $result );
		$this->assertSame( 'circular_parent', $result->get_error_code() );
	}

	public function test_move_to_top_level_skips_circular_parent_check(): void {
		$term          = new \stdClass();
		$term->term_id = 1;
		$term->name    = 'Folder';
		$term->slug    = 'folder';
		$term->parent  = 0;
		$term->count   = 0;

		// get_term_children must NOT be called when new_parent is 0.
		Functions\expect( 'get_term_children' )->never();
		Functions\when( 'wp_update_term' )->justReturn( [ 'term_id' => 1, 'term_taxonomy_id' => 1 ] );
		Functions\when( 'get_term' )->justReturn( $term );
		Functions\when( 'is_wp_error' )->alias( fn( $v ) => $v instanceof \WP_Error );

		$result = $this->folders->move( 1, 0 );

		$this->assertIsArray( $result );
		$this->assertSame( 1, $result['id'] );
	}

	public function test_move_returns_term_error_when_get_term_returns_null(): void {
		Functions\when( 'get_term_children' )->justReturn( [] );
		Functions\when( 'wp_update_term' )->justReturn( [ 'term_id' => 1, 'term_taxonomy_id' => 1 ] );
		Functions\when( 'get_term' )->justReturn( null );
		Functions\when( 'is_wp_error' )->alias( fn( $v ) => $v instanceof \WP_Error );
		Functions\when( '__' )->returnArg();

		$result = $this->folders->move( 1, 3 );

		$this->assertInstanceOf( \WP_Error::class, $result );
		$this->assertSame( 'term_error', $result->get_error_code() );
	}

	public function test_ensure_path_reuses_existing_folders_and_creates_missing_ones(): void {
		Functions\when( 'sanitize_text_field' )->returnArg();
		Functions\when( 'is_wp_error' )->alias( fn( $v ) => $v instanceof \WP_Error );
		// "Clients" exists under the root; "2026" does not exist under it yet.
		Functions\expect( 'term_exists' )->twice()->andReturn( [ 'term_id' => '5' ], null );
		Functions\expect( 'wp_insert_term' )
			->once()
			->with( '2026', 'nhrsmm_media_folder', [ 'parent' => 5 ] )
			->andReturn( [ 'term_id' => 9 ] );

		$this->assertSame( 9, $this->folders->ensure_path( [ 'Clients', '', '2026' ] ) );
	}

	public function test_ensure_path_returns_the_error_when_a_folder_cannot_be_created(): void {
		$error = new \WP_Error( 'term_exists', 'nope' );
		Functions\when( 'sanitize_text_field' )->returnArg();
		Functions\when( 'is_wp_error' )->alias( fn( $v ) => $v instanceof \WP_Error );
		Functions\when( 'term_exists' )->justReturn( null );
		Functions\when( 'wp_insert_term' )->justReturn( $error );

		$this->assertSame( $error, $this->folders->ensure_path( [ 'A' ] ) );
	}

	public function test_export_keeps_only_name_color_and_children(): void {
		$tree = [
			[
				'id'       => 1,
				'name'     => 'Brand',
				'count'    => 4,
				'color'    => '#e07c4b',
				'children' => [
					[
						'id'       => 2,
						'name'     => 'Logos',
						'count'    => 1,
						'color'    => '',
						'children' => [],
					],
				],
			],
		];

		$this->assertSame(
			[
				[
					'name'     => 'Brand',
					'color'    => '#e07c4b',
					'children' => [
						[
							'name'     => 'Logos',
							'color'    => '',
							'children' => [],
						],
					],
				],
			],
			$this->folders->export( $tree )
		);
	}

	public function test_flat_lists_folders_depth_first_with_depth(): void {
		$tree = [
			[
				'id'       => 1,
				'name'     => 'A',
				'children' => [
					[
						'id'       => 2,
						'name'     => 'A1',
						'children' => [],
					],
				],
			],
			[
				'id'       => 3,
				'name'     => 'B',
				'children' => [],
			],
		];

		$this->assertSame(
			[
				[ 'id' => 1, 'name' => 'A', 'depth' => 0 ],
				[ 'id' => 2, 'name' => 'A1', 'depth' => 1 ],
				[ 'id' => 3, 'name' => 'B', 'depth' => 0 ],
			],
			$this->folders->flat( $tree )
		);
	}

	public function test_get_tree_sorts_by_manual_order_before_name(): void {
		$a = (object) [ 'term_id' => 1, 'name' => 'Alpha', 'slug' => 'alpha', 'parent' => 0, 'count' => 0 ];
		$z = (object) [ 'term_id' => 2, 'name' => 'Zulu', 'slug' => 'zulu', 'parent' => 0, 'count' => 0 ];

		Functions\when( 'get_terms' )->justReturn( [ $a, $z ] );
		Functions\when( 'is_wp_error' )->justReturn( false );
		// Zulu was dragged to position 1, Alpha to position 2.
		Functions\when( 'get_term_meta' )->alias(
			fn( $id, $key ) => 'nhrsmm_order' === $key ? ( 2 === $id ? 1 : 2 ) : ''
		);

		$tree = $this->folders->get_tree()['tree'];

		$this->assertSame( [ 'Zulu', 'Alpha' ], array_column( $tree, 'name' ) );
	}

	public function test_set_color_clears_the_meta_for_an_invalid_color(): void {
		Functions\when( 'sanitize_hex_color' )->justReturn( null );
		Functions\expect( 'delete_term_meta' )->once()->with( 3, 'nhrsmm_color' );
		Functions\expect( 'update_term_meta' )->never();

		$this->assertTrue( $this->folders->set_color( 3, 'javascript:alert(1)' ) );
	}
}
