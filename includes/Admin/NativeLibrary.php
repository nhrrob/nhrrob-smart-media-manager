<?php
/**
 * Folder filter for the native Media Library and the media modal.
 *
 * @package Nhrsmm\SmartMediaManager
 */

namespace Nhrsmm\SmartMediaManager\Admin;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

use Nhrsmm\SmartMediaManager\Core\Folders;

/**
 * Adds a folder dropdown to Media → Library (grid and list) and to the media modal
 * used by the block editor and page builders, and uploads into the selected folder.
 */
class NativeLibrary {

	/**
	 * Registers WordPress hooks.
	 *
	 * @return void
	 */
	public function register_hooks(): void {
		add_action( 'wp_enqueue_media', [ $this, 'enqueue_modal_script' ] );
		add_filter( 'ajax_query_attachments_args', [ $this, 'filter_modal_query' ] );
		add_action( 'restrict_manage_posts', [ $this, 'render_list_dropdown' ] );
		add_action( 'pre_get_posts', [ $this, 'filter_list_query' ] );
	}

	/**
	 * Enqueues the folder filter wherever the media modal is loaded.
	 *
	 * @return void
	 */
	public function enqueue_modal_script(): void {
		if ( ! current_user_can( 'upload_files' ) || wp_script_is( 'nhrsmm-media-modal', 'enqueued' ) ) {
			return;
		}

		$folders = ( new Folders() )->flat();
		if ( ! $folders ) {
			return;
		}

		wp_enqueue_script(
			'nhrsmm-media-modal',
			NHRSMM_URL . '/admin/js/nhrsmm-media-modal.js',
			[ 'media-views' ],
			NHRSMM_VERSION,
			[ 'in_footer' => true ]
		);
		// Layout for the folder tree inside the modal; below 900px the tree gives way to the dropdown.
		wp_add_inline_style(
			'media-views',
			'.nhrsmm-tree{display:none;position:absolute;top:0;bottom:0;inset-inline-start:0;width:200px;margin:0;padding:8px 0;overflow:auto;box-sizing:border-box;background:#f6f7f7;border-inline-end:1px solid #dcdcde;z-index:1}'
			. '.nhrsmm-tree li{margin:0}'
			. '.nhrsmm-tree button{display:block;width:100%;padding:6px 12px;border:0;background:none;text-align:start;font-size:13px;line-height:1.4;color:#1d2327;cursor:pointer;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}'
			. '.nhrsmm-tree button:hover{background:#f0f0f1}'
			. '.nhrsmm-tree button.is-active{background:#2271b1;color:#fff}'
			. '@media (min-width:901px){.nhrsmm-has-tree .nhrsmm-tree{display:block}'
			. '.attachments-browser.nhrsmm-has-tree .media-toolbar,.attachments-browser.nhrsmm-has-tree .attachments-wrapper,.attachments-browser.nhrsmm-has-tree .attachments,.attachments-browser.nhrsmm-has-tree .uploader-inline{inset-inline-start:200px}'
			. '.nhrsmm-has-tree .nhrsmm-folder-filter,.nhrsmm-has-tree label[for^="nhrsmm-folder-filter"]{display:none}}'
		);

		wp_localize_script(
			'nhrsmm-media-modal',
			'nhrsmmModal',
			[
				'folders' => $folders,
				'all'     => __( 'All folders', 'nhrrob-smart-media-manager' ),
				'none'    => __( 'Uncategorized', 'nhrrob-smart-media-manager' ),
				'label'   => __( 'Filter by folder', 'nhrrob-smart-media-manager' ),
			]
		);
	}

	/**
	 * Applies the folder chosen in the media modal / grid view to the attachment query.
	 *
	 * @param array $query WP_Query arguments.
	 * @return array
	 */
	public function filter_modal_query( $query ) {
		// Core strips unknown keys from the query, so read the raw request. This runs inside
		// wp_ajax_query_attachments(), which already requires the upload_files capability.
		// phpcs:ignore WordPress.Security.NonceVerification.Recommended
		$folder = isset( $_REQUEST['query']['nhrsmm_folder'] ) ? sanitize_key( wp_unslash( $_REQUEST['query']['nhrsmm_folder'] ) ) : '';
		return $this->apply_folder( (array) $query, $folder );
	}

	/**
	 * Prints the folder dropdown above the Media Library list table.
	 *
	 * @param string $post_type Post type of the current list table.
	 * @return void
	 */
	public function render_list_dropdown( $post_type ): void {
		if ( 'attachment' !== $post_type ) {
			return;
		}
		// phpcs:ignore WordPress.Security.NonceVerification.Recommended
		$selected = isset( $_GET['nhrsmm_folder'] ) ? sanitize_key( wp_unslash( $_GET['nhrsmm_folder'] ) ) : '';

		echo '<label for="nhrsmm-folder-filter" class="screen-reader-text">' . esc_html__( 'Filter by folder', 'nhrrob-smart-media-manager' ) . '</label>';
		echo '<select name="nhrsmm_folder" id="nhrsmm-folder-filter">';
		echo '<option value="">' . esc_html__( 'All folders', 'nhrrob-smart-media-manager' ) . '</option>';
		echo '<option value="none"';
		selected( $selected, 'none' );
		echo '>' . esc_html__( 'Uncategorized', 'nhrrob-smart-media-manager' ) . '</option>';
		foreach ( ( new Folders() )->flat() as $folder ) {
			echo '<option value="' . esc_attr( $folder['id'] ) . '"';
			selected( $selected, (string) $folder['id'] );
			echo '>' . esc_html( str_repeat( '— ', $folder['depth'] ) . $folder['name'] ) . '</option>';
		}
		echo '</select>';
	}

	/**
	 * Applies the folder chosen above the Media Library list table to the main query.
	 *
	 * @param \WP_Query $query Current query.
	 * @return void
	 */
	public function filter_list_query( $query ): void {
		global $pagenow;
		// phpcs:ignore WordPress.Security.NonceVerification.Recommended
		if ( ! is_admin() || 'upload.php' !== $pagenow || ! $query->is_main_query() || empty( $_GET['nhrsmm_folder'] ) ) {
			return;
		}
		// phpcs:ignore WordPress.Security.NonceVerification.Recommended
		$args = $this->apply_folder( [], sanitize_key( wp_unslash( $_GET['nhrsmm_folder'] ) ) );
		if ( isset( $args['tax_query'] ) ) {
			$query->set( 'tax_query', $args['tax_query'] );
		}
	}

	/**
	 * Adds the folder tax query for a folder value ('' = all, 'none' = uncategorized, or a term ID).
	 *
	 * @param array  $args   WP_Query arguments.
	 * @param string $folder Folder value from the request.
	 * @return array
	 */
	private function apply_folder( array $args, string $folder ): array {
		if ( 'none' === $folder ) {
			// phpcs:ignore WordPress.DB.SlowDBQuery.slow_db_query_tax_query
			$args['tax_query'] = [
				[
					'taxonomy' => 'nhrsmm_media_folder',
					'operator' => 'NOT EXISTS',
				],
			];
		} elseif ( absint( $folder ) ) {
			// phpcs:ignore WordPress.DB.SlowDBQuery.slow_db_query_tax_query
			$args['tax_query'] = [
				[
					'taxonomy'         => 'nhrsmm_media_folder',
					'field'            => 'term_id',
					'terms'            => absint( $folder ),
					'include_children' => false,
				],
			];
		}
		return $args;
	}
}
