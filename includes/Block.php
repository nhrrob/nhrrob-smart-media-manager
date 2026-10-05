<?php
/**
 * Folder gallery shortcode and block.
 *
 * @package Nhrsmm\SmartMediaManager
 */

namespace Nhrsmm\SmartMediaManager;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

use Nhrsmm\SmartMediaManager\Core\Folders;

/**
 * Registers the [nhrsmm_gallery] shortcode and the Folder Gallery block. Both output a
 * core gallery of the images in one folder.
 */
class Block {

	/**
	 * Registers WordPress hooks.
	 *
	 * @return void
	 */
	public function register_hooks(): void {
		add_action( 'init', [ $this, 'register' ] );
		add_action( 'enqueue_block_editor_assets', [ $this, 'localize' ] );
	}

	/**
	 * Registers the shortcode, the editor script and the block type.
	 *
	 * @return void
	 */
	public function register(): void {
		add_shortcode( 'nhrsmm_gallery', [ $this, 'render' ] );

		$asset_file = NHRSMM_PLUGIN_DIR . 'admin/build/block.asset.php';
		if ( ! file_exists( $asset_file ) ) {
			return;
		}
		$asset = require $asset_file;

		wp_register_script( 'nhrsmm-block', NHRSMM_URL . '/admin/build/block.js', $asset['dependencies'], $asset['version'], [ 'in_footer' => true ] );
		wp_set_script_translations( 'nhrsmm-block', 'nhrrob-smart-media-manager', NHRSMM_PLUGIN_DIR . 'languages' );

		register_block_type(
			'nhrsmm/folder-gallery',
			[
				'api_version'           => 3,
				'editor_script_handles' => [ 'nhrsmm-block' ],
				'render_callback'       => [ $this, 'render' ],
				'attributes'            => [
					'folder'  => [
						'type'    => 'integer',
						'default' => 0,
					],
					'columns' => [
						'type'    => 'integer',
						'default' => 3,
					],
					'size'    => [
						'type'    => 'string',
						'default' => 'medium',
					],
					'link'    => [
						'type'    => 'string',
						'default' => 'file',
					],
					'limit'   => [
						'type'    => 'integer',
						'default' => 50,
					],
				],
			]
		);
	}

	/**
	 * Passes the folder list to the block editor script.
	 *
	 * @return void
	 */
	public function localize(): void {
		wp_localize_script( 'nhrsmm-block', 'nhrsmmBlock', [ 'folders' => ( new Folders() )->flat() ] );
	}

	/**
	 * Renders the gallery for the shortcode and the block.
	 *
	 * @param array|string $atts Shortcode or block attributes.
	 * @return string
	 */
	public function render( $atts ): string {
		$atts = shortcode_atts(
			[
				'folder'  => 0,
				'columns' => 3,
				'size'    => 'medium',
				'link'    => 'file',
				'limit'   => 50,
			],
			(array) $atts,
			'nhrsmm_gallery'
		);

		$folder = absint( $atts['folder'] );
		if ( ! $folder ) {
			return '';
		}

		$ids = get_posts(
			[
				'post_type'      => 'attachment',
				'post_status'    => 'inherit',
				'post_mime_type' => 'image',
				'posts_per_page' => min( 200, max( 1, absint( $atts['limit'] ) ) ),
				'fields'         => 'ids',
				'orderby'        => [
					'menu_order' => 'ASC',
					'date'       => 'DESC',
				],
				// phpcs:ignore WordPress.DB.SlowDBQuery.slow_db_query_tax_query
				'tax_query'      => [
					[
						'taxonomy'         => 'nhrsmm_media_folder',
						'field'            => 'term_id',
						'terms'            => $folder,
						'include_children' => false,
					],
				],
			]
		);
		if ( ! $ids ) {
			return '';
		}

		return gallery_shortcode(
			[
				'ids'     => implode( ',', $ids ),
				'columns' => min( 9, max( 1, absint( $atts['columns'] ) ) ),
				'size'    => sanitize_key( $atts['size'] ),
				'link'    => in_array( $atts['link'], [ 'file', 'none', 'post' ], true ) ? $atts['link'] : 'file',
				'orderby' => 'post__in',
			]
		);
	}
}
