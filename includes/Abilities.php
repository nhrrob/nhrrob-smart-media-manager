<?php
/**
 * Registers the plugin's abilities with the WordPress Abilities API.
 *
 * @package Nhrsmm\SmartMediaManager
 */

namespace Nhrsmm\SmartMediaManager;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

use Nhrsmm\SmartMediaManager\Core\Folders;
use Nhrsmm\SmartMediaManager\Core\Media;
use Nhrsmm\SmartMediaManager\Core\Usage;

/**
 * What AI agents and MCP clients may do with the media library.
 *
 * Every ability wraps a method the REST API already uses, behind the same
 * manage_categories gate and the same per-attachment edit_post check. The list
 * is pinned by tests/php/Unit/AbilitiesTest.php. Nothing here deletes or
 * replaces a file, deletes a folder, changes settings or calls the AI provider:
 * an agent writes alt text itself through nhrsmm/update-media.
 *
 * The two hooks only fire when something asks for the abilities registry.
 */
class Abilities {

	const CATEGORY = 'nhrsmm';

	/**
	 * Registers WordPress hooks.
	 *
	 * @return void
	 */
	public function register_hooks(): void {
		add_action( 'wp_abilities_api_categories_init', [ $this, 'register_category' ] );
		add_action( 'wp_abilities_api_init', [ $this, 'register' ] );
	}

	/**
	 * Registers the category every ability belongs to.
	 *
	 * @return void
	 */
	public function register_category(): void {
		wp_register_ability_category(
			self::CATEGORY,
			[
				'label'       => __( 'Smart Media Manager', 'nhrrob-smart-media-manager' ),
				'description' => __( 'Media library folders, files and where files are used.', 'nhrrob-smart-media-manager' ),
			]
		);
	}

	/**
	 * Registers every ability.
	 *
	 * @return void
	 */
	public function register(): void {
		foreach ( $this->definitions() as $name => $args ) {
			wp_register_ability( $name, $args );
		}
	}

	/**
	 * Same gate as the REST API: Editor and above.
	 *
	 * @return bool
	 */
	public function check_permission(): bool {
		return current_user_can( 'manage_categories' );
	}

	/**
	 * Every ability: name => wp_register_ability() arguments.
	 *
	 * @return array
	 */
	public function definitions(): array {
		$id_input = [
			'type'        => 'integer',
			'description' => __( 'Attachment ID, as returned by nhrsmm/list-media.', 'nhrrob-smart-media-manager' ),
			'minimum'     => 1,
		];

		$abilities = [
			'nhrsmm/list-folders'    => [
				'label'            => __( 'List media folders', 'nhrrob-smart-media-manager' ),
				'description'      => __( 'Returns the media folder tree (each folder with its id, name, file count and children) and library totals: all files, files in no folder, images without alt text and files in the trash.', 'nhrrob-smart-media-manager' ),
				'execute_callback' => [ $this, 'list_folders' ],
				'output_schema'    => [ 'type' => 'object' ],
				'meta'             => $this->meta( true ),
			],
			'nhrsmm/list-media'      => [
				'label'            => __( 'List media files', 'nhrrob-smart-media-manager' ),
				'description'      => __( 'Returns one page of media files with id, title, alt text, caption, URL, type, size and folders. Filter by folder, search text or file type; alt "missing" lists images without alt text; unused lists files the last unused-files scan flagged.', 'nhrrob-smart-media-manager' ),
				'execute_callback' => [ $this, 'list_media' ],
				'input_schema'     => [
					'type'       => 'object',
					'properties' => [
						'folder'   => [
							'type'        => 'integer',
							'description' => __( 'Folder ID. 0 lists files that are in no folder.', 'nhrrob-smart-media-manager' ),
							'minimum'     => 0,
						],
						'search'   => [ 'type' => 'string' ],
						'type'     => [
							'type'        => 'string',
							'description' => __( 'File type, e.g. image, video, audio.', 'nhrrob-smart-media-manager' ),
						],
						'alt'      => [
							'type' => 'string',
							'enum' => [ 'missing' ],
						],
						'unused'   => [ 'type' => 'boolean' ],
						'page'     => [
							'type'    => 'integer',
							'minimum' => 1,
						],
						'per_page' => [
							'type'    => 'integer',
							'minimum' => 1,
							'maximum' => 100,
						],
					],
					'default'    => [],
				],
				'output_schema'    => [ 'type' => 'object' ],
				'meta'             => $this->meta( true ),
			],
			'nhrsmm/get-media-usage' => [
				'label'            => __( 'Find where a file is used', 'nhrrob-smart-media-manager' ),
				'description'      => __( 'Returns the posts and settings that reference one media file (featured image, post content, post meta, site icon or logo). A file used only from theme files or CSS is not found.', 'nhrrob-smart-media-manager' ),
				'execute_callback' => [ $this, 'get_media_usage' ],
				'input_schema'     => [
					'type'       => 'object',
					'properties' => [ 'id' => $id_input ],
					'required'   => [ 'id' ],
				],
				'output_schema'    => [ 'type' => 'array' ],
				'meta'             => $this->meta( true ),
			],
			'nhrsmm/create-folder'   => [
				'label'            => __( 'Create a media folder', 'nhrrob-smart-media-manager' ),
				'description'      => __( 'Creates a media folder, optionally inside another folder.', 'nhrrob-smart-media-manager' ),
				'execute_callback' => [ $this, 'create_folder' ],
				'input_schema'     => [
					'type'       => 'object',
					'properties' => [
						'name'   => [
							'type'      => 'string',
							'minLength' => 1,
						],
						'parent' => [
							'type'        => 'integer',
							'description' => __( 'Parent folder ID. 0 or omitted creates a top-level folder.', 'nhrrob-smart-media-manager' ),
							'minimum'     => 0,
						],
					],
					'required'   => [ 'name' ],
				],
				'output_schema'    => [ 'type' => 'object' ],
				'meta'             => $this->meta( false ),
			],
			'nhrsmm/move-media'      => [
				'label'            => __( 'Move files to a folder', 'nhrrob-smart-media-manager' ),
				'description'      => __( 'Moves media files into one folder, replacing the folders they were in. folder_id 0 takes them out of every folder. Files are not changed, only their folder. Returns how many were moved and the IDs that could not be.', 'nhrrob-smart-media-manager' ),
				'execute_callback' => [ $this, 'move_media' ],
				'input_schema'     => [
					'type'       => 'object',
					'properties' => [
						'ids'       => [
							'type'     => 'array',
							'items'    => [ 'type' => 'integer' ],
							'minItems' => 1,
							'maxItems' => 200,
						],
						'folder_id' => [
							'type'    => 'integer',
							'minimum' => 0,
						],
					],
					'required'   => [ 'ids', 'folder_id' ],
				],
				'output_schema'    => [ 'type' => 'object' ],
				'meta'             => $this->meta( false, true ),
			],
			'nhrsmm/update-media'    => [
				'label'            => __( 'Update a file\'s text fields', 'nhrrob-smart-media-manager' ),
				'description'      => __( 'Sets the alt text, title, caption and/or description of one media file. Only the fields passed are changed; the previous text is overwritten.', 'nhrrob-smart-media-manager' ),
				'execute_callback' => [ $this, 'update_media' ],
				'input_schema'     => [
					'type'       => 'object',
					'properties' => [
						'id'          => $id_input,
						'alt'         => [ 'type' => 'string' ],
						'title'       => [ 'type' => 'string' ],
						'caption'     => [ 'type' => 'string' ],
						'description' => [ 'type' => 'string' ],
					],
					'required'   => [ 'id' ],
				],
				'output_schema'    => [ 'type' => 'object' ],
				'meta'             => $this->meta( false, true ),
			],
		];

		foreach ( $abilities as $name => $args ) {
			$abilities[ $name ] = $args + [
				'category'            => self::CATEGORY,
				'permission_callback' => [ $this, 'check_permission' ],
			];
		}
		return $abilities;
	}

	/**
	 * Ability meta: behavior annotations plus exposure to REST and MCP clients.
	 *
	 * @param bool $is_readonly Changes nothing.
	 * @param bool $idempotent  Repeating the call has no further effect.
	 * @return array
	 */
	private function meta( bool $is_readonly, bool $idempotent = false ): array {
		return [
			'annotations'  => [
				'readonly'    => $is_readonly,
				// Nothing on offer deletes a file or a folder.
				'destructive' => false,
				'idempotent'  => $is_readonly || $idempotent,
			],
			'public'       => true,
			// WordPress 6.9 has no `public` flag; the MCP Adapter reads `mcp.public`.
			'show_in_rest' => true,
			'mcp'          => [ 'public' => true ],
		];
	}

	/**
	 * Whether an ID is a media file the current user may edit. Core\Media does
	 * not check the post type itself, and an agent may pass any ID.
	 *
	 * @param int $id Post ID.
	 * @return bool
	 */
	private function can_edit_attachment( int $id ): bool {
		return 'attachment' === get_post_type( $id ) && current_user_can( 'edit_post', $id );
	}

	/**
	 * Returns the folder tree and the library totals.
	 *
	 * @return array
	 */
	public function list_folders(): array {
		return ( new Folders() )->get_tree();
	}

	/**
	 * Returns one page of media files.
	 *
	 * @param mixed $input Ability input.
	 * @return array
	 */
	public function list_media( $input ): array {
		$input = (array) $input;
		return ( new Media() )->get_list(
			[
				'page'     => $input['page'] ?? 1,
				'per_page' => $input['per_page'] ?? 20,
				'folder'   => $input['folder'] ?? null,
				'search'   => $input['search'] ?? '',
				'type'     => $input['type'] ?? '',
				'alt'      => $input['alt'] ?? '',
				'unused'   => ! empty( $input['unused'] ),
			]
		);
	}

	/**
	 * Returns where one file is used.
	 *
	 * @param mixed $input Ability input.
	 * @return array|\WP_Error
	 */
	public function get_media_usage( $input ) {
		$id = absint( $input['id'] );
		if ( ! $this->can_edit_attachment( $id ) ) {
			return new \WP_Error( 'forbidden', __( 'You cannot view this attachment.', 'nhrrob-smart-media-manager' ) );
		}
		return ( new Usage() )->get( $id );
	}

	/**
	 * Creates a folder.
	 *
	 * @param mixed $input Ability input.
	 * @return array|\WP_Error
	 */
	public function create_folder( $input ) {
		return ( new Folders() )->create( sanitize_text_field( $input['name'] ), absint( $input['parent'] ?? 0 ) );
	}

	/**
	 * Moves files into a folder. IDs that are not media files the user may
	 * edit are reported back in `errors` and left alone.
	 *
	 * @param mixed $input Ability input.
	 * @return array
	 */
	public function move_media( $input ): array {
		$ids     = array_map( 'absint', (array) $input['ids'] );
		$allowed = array_values( array_filter( $ids, [ $this, 'can_edit_attachment' ] ) );
		$result  = ( new Media() )->bulk_move( $allowed, absint( $input['folder_id'] ) );

		$result['errors'] = array_values( array_merge( $result['errors'] ?? [], array_diff( $ids, $allowed ) ) );
		$result['failed'] = count( $result['errors'] );
		return $result;
	}

	/**
	 * Updates one file's alt text, title, caption or description.
	 *
	 * @param mixed $input Ability input.
	 * @return array|\WP_Error
	 */
	public function update_media( $input ) {
		$id = absint( $input['id'] );
		if ( ! $this->can_edit_attachment( $id ) ) {
			return new \WP_Error( 'forbidden', __( 'You cannot edit this attachment.', 'nhrrob-smart-media-manager' ) );
		}
		// Media::update() sanitizes each field.
		return ( new Media() )->update( $id, array_intersect_key( (array) $input, array_flip( [ 'alt', 'title', 'caption', 'description' ] ) ) );
	}
}
