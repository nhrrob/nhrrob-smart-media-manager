<?php
/**
 * Media attachment query and update operations.
 *
 * @package Nhrsmm\SmartMediaManager
 */

namespace Nhrsmm\SmartMediaManager\Core;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Handles WP_Query-based media listing, single-item retrieval, updates, moves, and bulk operations.
 */
class Media {

	/**
	 * Returns a paginated list of attachments matching the given parameters.
	 *
	 * @param array $params Query parameters (page, per_page, folder, search, type, orderby, order).
	 * @return array
	 */
	public function get_list( array $params ): array {
		$settings  = Options::get();
		$per_page  = min( 200, max( 1, absint( $params['per_page'] ?? $settings['items_per_page'] ) ) );
		$page      = max( 1, absint( $params['page'] ?? 1 ) );
		$folder    = isset( $params['folder'] ) ? absint( $params['folder'] ) : null;
		$search    = sanitize_text_field( $params['search'] ?? '' );
		$file_type = sanitize_key( $params['type'] ?? '' );
		$orderby   = sanitize_key( $params['orderby'] ?? 'date' );
		$order     = 'ASC' === strtoupper( sanitize_key( $params['order'] ?? 'DESC' ) ) ? 'ASC' : 'DESC';
		// 500 is the cap on a user's starred list, the largest ID list the app sends.
		$ids   = isset( $params['ids'] ) ? array_slice( array_filter( array_map( 'absint', (array) $params['ids'] ) ), 0, 500 ) : [];
		$trash = 'trash' === ( $params['status'] ?? '' );

		if ( ! empty( $ids ) ) {
			$args  = [
				'post_type'      => 'attachment',
				'post_status'    => 'inherit',
				'posts_per_page' => count( $ids ),
				'post__in'       => $ids,
				'orderby'        => 'post__in',
				'no_found_rows'  => true,
			];
			$query = new \WP_Query( $args );
			$items = [];
			foreach ( $query->posts as $post ) {
				$items[] = $this->format_attachment( $post );
			}
			return [
				'items'    => $items,
				'total'    => count( $items ),
				'pages'    => 1,
				'page'     => 1,
				'per_page' => $per_page,
			];
		}

		$args = [
			'post_type'      => 'attachment',
			'post_status'    => $trash ? 'trash' : 'inherit',
			'posts_per_page' => $per_page,
			'paged'          => $page,
			'order'          => $order,
		];

		$size_filter = null;
		if ( 'size' === $orderby ) {
			// A meta_key sort would drop files whose size is not cached yet, so join the meta instead.
			$size_filter = $this->size_order_filter( $order );
			add_filter( 'posts_clauses', $size_filter );
		} elseif ( 'menu_order' === $orderby ) {
			$args['orderby'] = [
				'menu_order' => 'ASC',
				'date'       => 'DESC',
			];
		} else {
			$args['orderby'] = in_array( $orderby, [ 'date', 'modified', 'title', 'name', 'author' ], true ) ? $orderby : 'date';
		}

		if ( ! empty( $search ) ) {
			$args['s'] = $search;
		}

		if ( ! empty( $params['author'] ) ) {
			$args['author'] = absint( $params['author'] );
		}

		$date_query = [];
		foreach ( [
			'date_from' => 'after',
			'date_to'   => 'before',
		] as $param => $key ) {
			if ( ! empty( $params[ $param ] ) && preg_match( '/^\d{4}-\d{2}-\d{2}$/', $params[ $param ] ) ) {
				$date_query[ $key ] = $params[ $param ];
			}
		}
		if ( $date_query ) {
			$date_query['inclusive'] = true;
			$args['date_query']      = [ $date_query ];
		}

		$meta_query = [];
		if ( 'missing' === ( $params['alt'] ?? '' ) ) {
			$file_type    = 'image';
			$meta_query[] = [
				'relation' => 'OR',
				[
					'key'     => '_wp_attachment_image_alt',
					'compare' => 'NOT EXISTS',
				],
				[
					'key'   => '_wp_attachment_image_alt',
					'value' => '',
				],
			];
		}
		if ( ! empty( $params['unused'] ) ) {
			$meta_query[] = [
				'key'   => '_nhrsmm_unused',
				'value' => '1',
			];
		}
		if ( $meta_query ) {
			// phpcs:ignore WordPress.DB.SlowDBQuery.slow_db_query_meta_query
			$args['meta_query'] = $meta_query;
		}

		if ( null !== $folder && ! $trash ) {
			if ( 0 === $folder ) {
				// Uncategorized: no folder term assigned.
				// phpcs:ignore WordPress.DB.SlowDBQuery.slow_db_query_tax_query
				$args['tax_query'] = [
					[
						'taxonomy' => 'nhrsmm_media_folder',
						'operator' => 'NOT EXISTS',
					],
				];
			} else {
				// phpcs:ignore WordPress.DB.SlowDBQuery.slow_db_query_tax_query
				$args['tax_query'] = [
					[
						'taxonomy'         => 'nhrsmm_media_folder',
						'field'            => 'term_id',
						'terms'            => $folder,
						'include_children' => false,
					],
				];
			}
		}

		if ( ! empty( $file_type ) ) {
			$mime_map = [
				'image'       => 'image',
				'video'       => 'video',
				'audio'       => 'audio',
				'document'    => [ 'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain' ],
				'spreadsheet' => [ 'text/csv', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/csv' ],
				'other'       => [ 'application/zip', 'application/x-rar-compressed', 'application/x-zip-compressed' ],
			];
			if ( isset( $mime_map[ $file_type ] ) ) {
				$args['post_mime_type'] = $mime_map[ $file_type ];
			}
		}

		$search_filter = null;
		if ( ! empty( $search ) ) {
			$search_filter = $this->search_filter( $search );
			add_filter( 'posts_search', $search_filter );
		}

		$query = new \WP_Query( $args );

		if ( $search_filter ) {
			remove_filter( 'posts_search', $search_filter );
		}
		if ( $size_filter ) {
			remove_filter( 'posts_clauses', $size_filter );
		}

		$items = [];
		foreach ( $query->posts as $post ) {
			$items[] = $this->format_attachment( $post );
		}

		return [
			'items'    => $items,
			'total'    => (int) $query->found_posts,
			'pages'    => (int) $query->max_num_pages,
			'page'     => $page,
			'per_page' => $per_page,
		];
	}

	/**
	 * Builds a posts_search filter that also matches alt text and the file name.
	 *
	 * @param string $search Search term.
	 * @return \Closure
	 */
	private function search_filter( string $search ): \Closure {
		return static function ( $sql ) use ( $search ) {
			global $wpdb;
			if ( '' === trim( (string) $sql ) ) {
				return $sql;
			}
			$extra = $wpdb->prepare(
				" OR EXISTS ( SELECT 1 FROM {$wpdb->postmeta} nhrsmm_pm
				 WHERE nhrsmm_pm.post_id = {$wpdb->posts}.ID
				 AND nhrsmm_pm.meta_key IN ( '_wp_attachment_image_alt', '_wp_attached_file' )
				 AND nhrsmm_pm.meta_value LIKE %s )",
				'%' . $wpdb->esc_like( $search ) . '%'
			);
			// Core emits " AND ((…))"; widen it to " AND ( ((…)) OR EXISTS (…) )".
			return preg_replace( '/^\s*AND\s*/', ' AND ( ', $sql, 1 ) . $extra . ' ) ';
		};
	}

	/**
	 * Builds a posts_clauses filter that sorts by the cached file size, keeping files that have none.
	 *
	 * @param string $order ASC or DESC.
	 * @return \Closure
	 */
	private function size_order_filter( string $order ): \Closure {
		$order = 'ASC' === $order ? 'ASC' : 'DESC';
		return static function ( $clauses ) use ( $order ) {
			global $wpdb;
			$clauses['join']   .= " LEFT JOIN {$wpdb->postmeta} nhrsmm_size ON nhrsmm_size.post_id = {$wpdb->posts}.ID AND nhrsmm_size.meta_key = '_nhrsmm_filesize'";
			$clauses['orderby'] = "CAST( nhrsmm_size.meta_value AS UNSIGNED ) {$order}, {$wpdb->posts}.ID DESC";
			return $clauses;
		};
	}

	/**
	 * Returns a single attachment by ID, or null if not found.
	 *
	 * @param int $id Attachment post ID.
	 * @return array|null
	 */
	public function get_single( int $id ): ?array {
		$post = get_post( $id );
		if ( ! $post || 'attachment' !== $post->post_type ) {
			return null;
		}
		return $this->format_attachment( $post, true );
	}

	/**
	 * Updates editable fields on an attachment post.
	 *
	 * @param int   $id   Attachment post ID.
	 * @param array $data Map of fields to update (title, caption, description, alt).
	 * @return array|\WP_Error
	 */
	public function update( int $id, array $data ) {
		$update = [ 'ID' => $id ];

		if ( isset( $data['title'] ) ) {
			$update['post_title'] = sanitize_text_field( $data['title'] );
		}
		if ( isset( $data['caption'] ) ) {
			$update['post_excerpt'] = sanitize_text_field( $data['caption'] );
		}
		if ( isset( $data['description'] ) ) {
			$update['post_content'] = wp_kses_post( $data['description'] );
		}

		if ( count( $update ) > 1 ) {
			$result = wp_update_post( $update, true );
			if ( is_wp_error( $result ) ) {
				return $result;
			}
		}

		if ( isset( $data['alt'] ) ) {
			update_post_meta( $id, '_wp_attachment_image_alt', sanitize_text_field( $data['alt'] ) );
		}

		$post = get_post( $id );
		if ( ! $post ) {
			return new \WP_Error( 'not_found', __( 'Attachment not found.', 'nhrrob-smart-media-manager' ) );
		}
		return $this->format_attachment( $post, true );
	}

	/**
	 * Assigns an attachment to a folder, or removes all folder assignments when folder_id is 0.
	 *
	 * @param int  $attachment_id Attachment post ID.
	 * @param int  $folder_id     Target folder term ID (0 = uncategorised).
	 * @param bool $append        Keep existing folders and add this one.
	 * @return bool|\WP_Error
	 */
	public function move_to_folder( int $attachment_id, int $folder_id, bool $append = false ) {
		if ( 0 === $folder_id ) {
			wp_delete_object_term_relationships( $attachment_id, 'nhrsmm_media_folder' );
			return true;
		}

		if ( ! term_exists( $folder_id, 'nhrsmm_media_folder' ) ) {
			return new \WP_Error( 'invalid_folder', __( 'Folder not found.', 'nhrrob-smart-media-manager' ) );
		}

		$result = wp_set_object_terms( $attachment_id, $folder_id, 'nhrsmm_media_folder', $append );
		return is_wp_error( $result ) ? $result : true;
	}

	/**
	 * Moves, adds, or removes multiple attachments to or from a folder.
	 *
	 * @param array  $ids       Attachment post IDs.
	 * @param int    $folder_id Target folder term ID.
	 * @param string $mode      One of move, add, remove.
	 * @return array
	 */
	public function bulk_move( array $ids, int $folder_id, string $mode = 'move' ): array {
		$moved  = 0;
		$errors = [];
		foreach ( $ids as $id ) {
			$id = absint( $id );
			if ( ! current_user_can( 'edit_post', $id ) ) {
				$errors[] = $id;
				continue;
			}
			if ( 'remove' === $mode ) {
				$result = wp_remove_object_terms( $id, $folder_id, 'nhrsmm_media_folder' );
			} else {
				$result = $this->move_to_folder( $id, $folder_id, 'add' === $mode );
			}
			if ( is_wp_error( $result ) || false === $result ) {
				$errors[] = $id;
			} else {
				++$moved;
			}
		}
		return [
			'moved'  => $moved,
			'failed' => count( $errors ),
			'errors' => $errors,
		];
	}

	/**
	 * Moves multiple attachments to the trash, or deletes them permanently.
	 *
	 * @param array $ids   Attachment post IDs.
	 * @param bool  $force Delete permanently instead of trashing.
	 * @return array
	 */
	public function bulk_delete( array $ids, bool $force = false ): array {
		$deleted = 0;
		$errors  = [];
		foreach ( $ids as $id ) {
			$id = absint( $id );
			if ( ! current_user_can( 'delete_post', $id ) ) {
				$errors[] = $id;
				continue;
			}
			// wp_trash_post() itself deletes permanently when EMPTY_TRASH_DAYS is 0.
			$result = $force ? wp_delete_attachment( $id, true ) : wp_trash_post( $id );
			if ( false === $result || null === $result ) {
				$errors[] = $id;
			} else {
				++$deleted;
			}
		}
		return [
			'deleted' => $deleted,
			'failed'  => count( $errors ),
			'errors'  => $errors,
		];
	}

	/**
	 * Restores multiple attachments from the trash.
	 *
	 * @param array $ids Attachment post IDs.
	 * @return array
	 */
	public function bulk_restore( array $ids ): array {
		$restored = 0;
		foreach ( $ids as $id ) {
			$id = absint( $id );
			if ( current_user_can( 'delete_post', $id ) && wp_untrash_post( $id ) ) {
				++$restored;
			}
		}
		return [
			'restored' => $restored,
			'failed'   => count( $ids ) - $restored,
		];
	}

	/**
	 * Applies the same field values to multiple attachments. Empty values are skipped.
	 *
	 * @param array $ids  Attachment post IDs.
	 * @param array $data Map of fields to set (title, alt, caption, description).
	 * @return array
	 */
	public function bulk_update( array $ids, array $data ): array {
		$fields = [];
		foreach ( [ 'title', 'alt', 'caption', 'description' ] as $key ) {
			if ( isset( $data[ $key ] ) && is_string( $data[ $key ] ) && '' !== trim( $data[ $key ] ) ) {
				$fields[ $key ] = $data[ $key ];
			}
		}

		$updated = 0;
		foreach ( $ids as $id ) {
			$id = absint( $id );
			if ( ! $fields || ! current_user_can( 'edit_post', $id ) ) {
				continue;
			}
			$apply = $fields;
			if ( isset( $apply['alt'] ) && ! wp_attachment_is_image( $id ) ) {
				unset( $apply['alt'] );
			}
			if ( ! is_wp_error( $this->update( $id, $apply ) ) ) {
				++$updated;
			}
		}
		return [
			'updated' => $updated,
			'failed'  => count( $ids ) - $updated,
		];
	}

	/**
	 * Saves a manual file order (used by the "Custom order" sort).
	 *
	 * @param array $ids    Attachment post IDs in display order.
	 * @param int   $offset Position of the first ID (for paginated lists).
	 * @return int Number of attachments updated.
	 */
	public function reorder( array $ids, int $offset = 0 ): int {
		$updated = 0;
		foreach ( array_values( $ids ) as $index => $id ) {
			$id = absint( $id );
			if ( ! current_user_can( 'edit_post', $id ) ) {
				continue;
			}
			$result = wp_update_post(
				[
					'ID'         => $id,
					'menu_order' => $offset + $index + 1,
				]
			);
			if ( $result && ! is_wp_error( $result ) ) {
				++$updated;
			}
		}
		return $updated;
	}

	/**
	 * Replaces the file behind an attachment, keeping its ID and URL.
	 *
	 * @param int   $id   Attachment post ID.
	 * @param array $file Uploaded file entry from $_FILES.
	 * @return array|\WP_Error
	 */
	public function replace_file( int $id, array $file ) {
		require_once ABSPATH . 'wp-admin/includes/file.php';
		require_once ABSPATH . 'wp-admin/includes/image.php';

		$old_path = get_attached_file( $id, true );
		if ( ! $old_path || empty( $file['tmp_name'] ) || empty( $file['name'] ) ) {
			return new \WP_Error( 'no_file', __( 'Could not retrieve the file to replace.', 'nhrrob-smart-media-manager' ), [ 'status' => 400 ] );
		}

		$check = wp_check_filetype_and_ext( $file['tmp_name'], $file['name'] );
		if ( empty( $check['type'] ) || get_post_mime_type( $id ) !== $check['type'] ) {
			return new \WP_Error( 'type_mismatch', __( 'The new file must be the same type as the current file.', 'nhrrob-smart-media-manager' ), [ 'status' => 400 ] );
		}

		$upload = wp_handle_upload( $file, [ 'test_form' => false ] );
		if ( isset( $upload['error'] ) ) {
			return new \WP_Error( 'upload_error', $upload['error'], [ 'status' => 400 ] );
		}

		global $wp_filesystem;
		if ( ! WP_Filesystem() || ! $wp_filesystem ) {
			wp_delete_file( $upload['file'] );
			return new \WP_Error( 'fs_error', __( 'Could not access the filesystem.', 'nhrrob-smart-media-manager' ), [ 'status' => 500 ] );
		}

		$meta   = wp_get_attachment_metadata( $id );
		$dir    = trailingslashit( dirname( $old_path ) );
		$target = $old_path;

		if ( is_array( $meta ) ) {
			foreach ( (array) ( $meta['sizes'] ?? [] ) as $size ) {
				if ( ! empty( $size['file'] ) ) {
					wp_delete_file( $dir . $size['file'] );
				}
			}
			// Big images are stored as "-scaled"; put the new upload where the original was.
			if ( ! empty( $meta['original_image'] ) ) {
				wp_delete_file( $old_path );
				$target = $dir . $meta['original_image'];
			}
		}

		if ( ! $wp_filesystem->move( $upload['file'], $target, true ) ) {
			wp_delete_file( $upload['file'] );
			return new \WP_Error( 'fs_error', __( 'Could not write the new file.', 'nhrrob-smart-media-manager' ), [ 'status' => 500 ] );
		}

		update_attached_file( $id, $target );
		wp_update_attachment_metadata( $id, wp_generate_attachment_metadata( $id, $target ) );
		delete_post_meta( $id, '_nhrsmm_filesize' );
		clean_post_cache( $id );

		return $this->get_single( $id );
	}

	/**
	 * Formats a WP_Post attachment as an API response array.
	 *
	 * @param \WP_Post $post Attachment post object.
	 * @param bool     $full Whether to include extended fields (alt, caption, description).
	 * @return array
	 */
	private function format_attachment( \WP_Post $post, bool $full = false ): array {
		$meta      = wp_get_attachment_metadata( $post->ID );
		$mime      = $post->post_mime_type;
		$url       = wp_get_attachment_url( $post->ID );
		$file_path = get_attached_file( $post->ID );

		// Read from cached meta first; only hit the filesystem on first access.
		$file_size = (int) get_post_meta( $post->ID, '_nhrsmm_filesize', true );
		if ( ! $file_size && $file_path && file_exists( $file_path ) ) {
			$file_size = (int) filesize( $file_path );
			update_post_meta( $post->ID, '_nhrsmm_filesize', $file_size );
		}

		$thumb    = '';
		$thumb_md = '';
		if ( 0 === strpos( $mime, 'image' ) ) {
			$thumb_data    = wp_get_attachment_image_src( $post->ID, 'thumbnail' );
			$thumb         = $thumb_data ? $thumb_data[0] : $url;
			$thumb_md_data = wp_get_attachment_image_src( $post->ID, 'medium' );
			$thumb_md      = $thumb_md_data ? $thumb_md_data[0] : $thumb;
		}

		// get_the_terms() reads the term cache WP_Query already filled, so a list costs no query per file.
		$folder_terms = get_the_terms( $post->ID, 'nhrsmm_media_folder' );
		$folder_ids   = ! empty( $folder_terms ) && ! is_wp_error( $folder_terms ) ? array_map( 'intval', wp_list_pluck( $folder_terms, 'term_id' ) ) : [];
		$folder_id    = $folder_ids ? $folder_ids[0] : 0;

		$item = [
			'id'         => $post->ID,
			'title'      => $post->post_title,
			'filename'   => basename( false !== $file_path ? $file_path : '' ),
			'url'        => $url,
			'thumb'      => $thumb,
			'thumb_md'   => $thumb_md,
			'mime'       => $mime,
			'type'       => $this->mime_to_type( $mime ),
			'size'       => $file_size,
			'date'       => $post->post_date,
			'modified'   => $post->post_modified,
			'folder_id'  => $folder_id,
			'folder_ids' => $folder_ids,
			'author'     => get_the_author_meta( 'display_name', $post->post_author ),
			'has_alt'    => 0 === strpos( $mime, 'image' )
							? '' !== get_post_meta( $post->ID, '_wp_attachment_image_alt', true )
							: null,
		];

		if ( 0 === strpos( $mime, 'image' ) ) {
			$item['width']  = $meta['width'] ?? 0;
			$item['height'] = $meta['height'] ?? 0;
		}

		if ( $full ) {
			$item['alt']         = get_post_meta( $post->ID, '_wp_attachment_image_alt', true );
			$item['caption']     = $post->post_excerpt;
			$item['description'] = $post->post_content;
			if ( 0 === strpos( $mime, 'image' ) ) {
				$item['full_url'] = wp_get_attachment_image_src( $post->ID, 'full' )[0] ?? $url;
			}
		}

		return $item;
	}

	/**
	 * Maps a MIME type string to a simplified type label.
	 *
	 * @param string $mime MIME type.
	 * @return string
	 */
	private function mime_to_type( string $mime ): string {
		if ( 0 === strpos( $mime, 'image' ) ) {
			return 'image';
		}
		if ( 0 === strpos( $mime, 'video' ) ) {
			return 'video';
		}
		if ( 0 === strpos( $mime, 'audio' ) ) {
			return 'audio';
		}
		if ( false !== strpos( $mime, 'pdf' ) ) {
			return 'pdf';
		}
		if ( false !== strpos( $mime, 'word' ) || false !== strpos( $mime, 'document' ) ) {
			return 'document';
		}
		if ( false !== strpos( $mime, 'excel' ) || false !== strpos( $mime, 'spreadsheet' ) || false !== strpos( $mime, 'csv' ) ) {
			return 'spreadsheet';
		}
		if ( false !== strpos( $mime, 'zip' ) || false !== strpos( $mime, 'rar' ) ) {
			return 'archive';
		}
		return 'other';
	}
}
