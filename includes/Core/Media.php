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
		$settings  = get_option( 'nhrsmm_settings', [] );
		$per_page  = absint( $params['per_page'] ?? $settings['items_per_page'] ?? 40 );
		$page      = max( 1, absint( $params['page'] ?? 1 ) );
		$folder    = isset( $params['folder'] ) ? absint( $params['folder'] ) : null;
		$search    = sanitize_text_field( $params['search'] ?? '' );
		$file_type = sanitize_key( $params['type'] ?? '' );
		$orderby   = sanitize_key( $params['orderby'] ?? 'date' );
		$order     = 'ASC' === strtoupper( sanitize_key( $params['order'] ?? 'DESC' ) ) ? 'ASC' : 'DESC';
		$ids       = isset( $params['ids'] ) ? array_filter( array_map( 'absint', (array) $params['ids'] ) ) : [];

		if ( ! empty( $ids ) ) {
			$args  = [
				'post_type'      => 'attachment',
				'post_status'    => 'inherit',
				'posts_per_page' => count( $ids ),
				'post__in'       => $ids,
				'orderby'        => 'post__in',
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
			'post_status'    => 'inherit',
			'posts_per_page' => $per_page,
			'paged'          => $page,
			'order'          => $order,
		];

		if ( 'size' === $orderby ) {
			// phpcs:ignore WordPress.DB.SlowDBQuery.slow_db_query_meta_key
			$args['meta_key'] = '_nhrsmm_filesize';
			$args['orderby']  = 'meta_value_num';
		} else {
			$args['orderby'] = in_array( $orderby, [ 'date', 'title', 'name' ], true ) ? $orderby : 'date';
		}

		if ( ! empty( $search ) ) {
			$args['s'] = $search;
		}

		if ( null !== $folder ) {
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

		$query = new \WP_Query( $args );
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
	 * @param int $attachment_id Attachment post ID.
	 * @param int $folder_id     Target folder term ID (0 = uncategorised).
	 * @return bool|\WP_Error
	 */
	public function move_to_folder( int $attachment_id, int $folder_id ) {
		if ( 0 === $folder_id ) {
			wp_delete_object_term_relationships( $attachment_id, 'nhrsmm_media_folder' );
			return true;
		}

		if ( ! term_exists( $folder_id, 'nhrsmm_media_folder' ) ) {
			return new \WP_Error( 'invalid_folder', __( 'Folder not found.', 'nhrrob-smart-media-manager' ) );
		}

		$result = wp_set_object_terms( $attachment_id, $folder_id, 'nhrsmm_media_folder' );
		return is_wp_error( $result ) ? $result : true;
	}

	/**
	 * Moves multiple attachments to a folder in bulk.
	 *
	 * @param array $ids       Attachment post IDs.
	 * @param int   $folder_id Target folder term ID.
	 * @return array
	 */
	public function bulk_move( array $ids, int $folder_id ): array {
		$moved  = 0;
		$errors = [];
		foreach ( $ids as $id ) {
			$id = absint( $id );
			if ( ! current_user_can( 'edit_post', $id ) ) {
				$errors[] = $id;
				continue;
			}
			$result = $this->move_to_folder( $id, $folder_id );
			if ( is_wp_error( $result ) ) {
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
	 * Permanently deletes multiple attachments.
	 *
	 * @param array $ids Attachment post IDs.
	 * @return array
	 */
	public function bulk_delete( array $ids ): array {
		$deleted = 0;
		$errors  = [];
		foreach ( $ids as $id ) {
			$id = absint( $id );
			if ( ! current_user_can( 'delete_post', $id ) ) {
				$errors[] = $id;
				continue;
			}
			$result = wp_delete_attachment( $id, true );
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
	 * Returns a list of posts that reference the given attachment (featured image or content).
	 *
	 * @param int $attachment_id Attachment post ID.
	 * @return array
	 */
	public function get_usage( int $attachment_id ): array {
		global $wpdb;

		$url    = wp_get_attachment_url( $attachment_id );
		$usages = [];

		// phpcs:disable WordPress.DB.DirectDatabaseQuery.DirectQuery,WordPress.DB.DirectDatabaseQuery.NoCaching
		$featured_in = $wpdb->get_results(
			$wpdb->prepare(
				"SELECT p.ID, p.post_title, p.post_type, p.post_status FROM {$wpdb->posts} p
             INNER JOIN {$wpdb->postmeta} pm ON p.ID = pm.post_id
             WHERE pm.meta_key = '_thumbnail_id' AND pm.meta_value = %d AND p.post_status != 'trash'",
				$attachment_id
			)
		);
		// phpcs:enable WordPress.DB.DirectDatabaseQuery.DirectQuery,WordPress.DB.DirectDatabaseQuery.NoCaching

		foreach ( $featured_in as $row ) {
			$usages[] = [
				'id'    => (int) $row->ID,
				'title' => ( '' !== $row->post_title ) ? $row->post_title : __( '(no title)', 'nhrrob-smart-media-manager' ),
				'type'  => $row->post_type,
				'url'   => get_permalink( $row->ID ),
				'via'   => 'featured_image',
			];
		}

		if ( $url ) {
			$like = $wpdb->esc_like( $url );
			// phpcs:disable WordPress.DB.DirectDatabaseQuery.DirectQuery,WordPress.DB.DirectDatabaseQuery.NoCaching
			$posts_with_url = $wpdb->get_results(
				$wpdb->prepare(
					"SELECT ID, post_title, post_type FROM {$wpdb->posts}
                 WHERE post_content LIKE %s AND post_status != 'trash' AND post_type != 'attachment'
                 LIMIT 20",
					'%' . $like . '%'
				)
			);
			// phpcs:enable WordPress.DB.DirectDatabaseQuery.DirectQuery,WordPress.DB.DirectDatabaseQuery.NoCaching
			foreach ( $posts_with_url as $row ) {
				$usages[] = [
					'id'    => (int) $row->ID,
					'title' => ( '' !== $row->post_title ) ? $row->post_title : __( '(no title)', 'nhrrob-smart-media-manager' ),
					'type'  => $row->post_type,
					'url'   => get_permalink( $row->ID ),
					'via'   => 'content',
				];
			}
		}

		return $usages;
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
		$file_size = $file_path && file_exists( $file_path ) ? filesize( $file_path ) : 0;

		// Lazy-populate filesize meta so it is available for sort-by-size queries.
		if ( $file_size > 0 && ! metadata_exists( 'post', $post->ID, '_nhrsmm_filesize' ) ) {
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

		$folder_terms = wp_get_object_terms( $post->ID, 'nhrsmm_media_folder', [ 'fields' => 'ids' ] );
		$folder_id    = ! empty( $folder_terms ) && ! is_wp_error( $folder_terms ) ? (int) $folder_terms[0] : 0;

		$item = [
			'id'        => $post->ID,
			'title'     => $post->post_title,
			'filename'  => basename( false !== $file_path ? $file_path : '' ),
			'url'       => $url,
			'thumb'     => $thumb,
			'thumb_md'  => $thumb_md,
			'mime'      => $mime,
			'type'      => $this->mime_to_type( $mime ),
			'size'      => $file_size,
			'date'      => $post->post_date,
			'folder_id' => $folder_id,
			'author'    => get_the_author_meta( 'display_name', $post->post_author ),
			'has_alt'   => 0 === strpos( $mime, 'image' )
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
