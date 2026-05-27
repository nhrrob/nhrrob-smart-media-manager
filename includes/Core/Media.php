<?php

namespace Nhrsmm\SmartMediaManager\Core;

if ( ! defined( 'ABSPATH' ) ) exit;

class Media {

	public function get_list( array $params ): array {
		$settings  = get_option( 'nhrsmm_settings', [] );
		$per_page  = absint( $params['per_page'] ?? $settings['items_per_page'] ?? 40 );
		$page      = max( 1, absint( $params['page'] ?? 1 ) );
		$folder    = isset( $params['folder'] ) ? absint( $params['folder'] ) : null;
		$search    = sanitize_text_field( $params['search'] ?? '' );
		$file_type = sanitize_key( $params['type'] ?? '' );
		$orderby   = sanitize_key( $params['orderby'] ?? 'date' );
		$order     = strtoupper( sanitize_key( $params['order'] ?? 'DESC' ) ) === 'ASC' ? 'ASC' : 'DESC';

		$args = [
			'post_type'      => 'attachment',
			'post_status'    => 'inherit',
			'posts_per_page' => $per_page,
			'paged'          => $page,
			'orderby'        => in_array( $orderby, [ 'date', 'title', 'name' ], true ) ? $orderby : 'date',
			'order'          => $order,
		];

		if ( ! empty( $search ) ) {
			$args['s'] = $search;
		}

		// Folder filter.
		if ( $folder !== null ) {
			if ( $folder === 0 ) {
				// Uncategorized: no folder term assigned.
				$args['tax_query'] = [ [
					'taxonomy' => 'nhrsmm_media_folder',
					'operator' => 'NOT EXISTS',
				] ];
			} else {
				$args['tax_query'] = [ [
					'taxonomy' => 'nhrsmm_media_folder',
					'field'    => 'term_id',
					'terms'    => $folder,
					'include_children' => false,
				] ];
			}
		}

		// File type filter.
		if ( ! empty( $file_type ) ) {
			$mime_map = [
				'image'    => 'image',
				'video'    => 'video',
				'audio'    => 'audio',
				'document' => [ 'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'text/plain' ],
				'other'    => [],
			];
			if ( isset( $mime_map[ $file_type ] ) && is_string( $mime_map[ $file_type ] ) ) {
				$args['post_mime_type'] = $mime_map[ $file_type ];
			} elseif ( isset( $mime_map[ $file_type ] ) && is_array( $mime_map[ $file_type ] ) && ! empty( $mime_map[ $file_type ] ) ) {
				$args['post_mime_type'] = $mime_map[ $file_type ];
			}
		}

		$query = new \WP_Query( $args );
		$items = [];

		foreach ( $query->posts as $post ) {
			$items[] = $this->format_attachment( $post );
		}

		return [
			'items'     => $items,
			'total'     => (int) $query->found_posts,
			'pages'     => (int) $query->max_num_pages,
			'page'      => $page,
			'per_page'  => $per_page,
		];
	}

	public function get_single( int $id ): ?array {
		$post = get_post( $id );
		if ( ! $post || $post->post_type !== 'attachment' ) {
			return null;
		}
		return $this->format_attachment( $post, true );
	}

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

		return $this->format_attachment( get_post( $id ), true );
	}

	public function move_to_folder( int $attachment_id, int $folder_id ) {
		if ( $folder_id === 0 ) {
			wp_delete_object_term_relationships( $attachment_id, 'nhrsmm_media_folder' );
			return true;
		}

		if ( ! term_exists( $folder_id, 'nhrsmm_media_folder' ) ) {
			return new \WP_Error( 'invalid_folder', __( 'Folder not found.', 'nhrrob-smart-media-manager' ) );
		}

		$result = wp_set_object_terms( $attachment_id, $folder_id, 'nhrsmm_media_folder' );
		return is_wp_error( $result ) ? $result : true;
	}

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
				$moved++;
			}
		}
		return [ 'moved' => $moved, 'failed' => count( $errors ), 'errors' => $errors ];
	}

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
			if ( $result === false || $result === null ) {
				$errors[] = $id;
			} else {
				$deleted++;
			}
		}
		return [ 'deleted' => $deleted, 'failed' => count( $errors ), 'errors' => $errors ];
	}

	public function get_usage( int $attachment_id ): array {
		global $wpdb;

		$url    = wp_get_attachment_url( $attachment_id );
		$guid   = get_post_field( 'guid', $attachment_id );
		$usages = [];

		// Posts that have the attachment as featured image.
		$featured_in = $wpdb->get_results( $wpdb->prepare(
			"SELECT p.ID, p.post_title, p.post_type, p.post_status FROM {$wpdb->posts} p
             INNER JOIN {$wpdb->postmeta} pm ON p.ID = pm.post_id
             WHERE pm.meta_key = '_thumbnail_id' AND pm.meta_value = %d AND p.post_status != 'trash'",
			$attachment_id
		) );

		foreach ( $featured_in as $row ) {
			$usages[] = [
				'id'     => (int) $row->ID,
				'title'  => $row->post_title ?: __( '(no title)', 'nhrrob-smart-media-manager' ),
				'type'   => $row->post_type,
				'url'    => get_permalink( $row->ID ),
				'via'    => 'featured_image',
			];
		}

		// Posts whose content contains the attachment URL.
		if ( $url ) {
			$like = $wpdb->esc_like( $url );
			$posts_with_url = $wpdb->get_results( $wpdb->prepare(
				"SELECT ID, post_title, post_type FROM {$wpdb->posts}
                 WHERE post_content LIKE %s AND post_status != 'trash' AND post_type != 'attachment'
                 LIMIT 20",
				'%' . $like . '%'
			) );
			foreach ( $posts_with_url as $row ) {
				$usages[] = [
					'id'    => (int) $row->ID,
					'title' => $row->post_title ?: __( '(no title)', 'nhrrob-smart-media-manager' ),
					'type'  => $row->post_type,
					'url'   => get_permalink( $row->ID ),
					'via'   => 'content',
				];
			}
		}

		return $usages;
	}

	private function format_attachment( \WP_Post $post, bool $full = false ): array {
		$meta      = wp_get_attachment_metadata( $post->ID );
		$mime      = $post->post_mime_type;
		$url       = wp_get_attachment_url( $post->ID );
		$file_path = get_attached_file( $post->ID );
		$file_size = $file_path && file_exists( $file_path ) ? filesize( $file_path ) : 0;

		$thumb = '';
		if ( strpos( $mime, 'image' ) === 0 ) {
			$thumb_data = wp_get_attachment_image_src( $post->ID, 'thumbnail' );
			$thumb      = $thumb_data ? $thumb_data[0] : $url;
		}

		$folder_terms = wp_get_object_terms( $post->ID, 'nhrsmm_media_folder', [ 'fields' => 'ids' ] );
		$folder_id    = ! empty( $folder_terms ) && ! is_wp_error( $folder_terms ) ? (int) $folder_terms[0] : 0;

		$item = [
			'id'          => $post->ID,
			'title'       => $post->post_title,
			'filename'    => basename( $file_path ?: '' ),
			'url'         => $url,
			'thumb'       => $thumb,
			'mime'        => $mime,
			'type'        => $this->mime_to_type( $mime ),
			'size'        => $file_size,
			'date'        => $post->post_date,
			'folder_id'   => $folder_id,
			'author'      => get_the_author_meta( 'display_name', $post->post_author ),
		];

		if ( strpos( $mime, 'image' ) === 0 ) {
			$item['width']  = $meta['width']  ?? 0;
			$item['height'] = $meta['height'] ?? 0;
		}

		if ( $full ) {
			$item['alt']         = get_post_meta( $post->ID, '_wp_attachment_image_alt', true );
			$item['caption']     = $post->post_excerpt;
			$item['description'] = $post->post_content;
			if ( strpos( $mime, 'image' ) === 0 ) {
				$item['full_url'] = wp_get_attachment_image_src( $post->ID, 'full' )[0] ?? $url;
			}
		}

		return $item;
	}

	private function mime_to_type( string $mime ): string {
		if ( strpos( $mime, 'image' ) === 0 )     return 'image';
		if ( strpos( $mime, 'video' ) === 0 )     return 'video';
		if ( strpos( $mime, 'audio' ) === 0 )     return 'audio';
		if ( strpos( $mime, 'pdf' ) !== false )   return 'pdf';
		if ( strpos( $mime, 'word' ) !== false || strpos( $mime, 'document' ) !== false ) return 'document';
		if ( strpos( $mime, 'excel' ) !== false || strpos( $mime, 'spreadsheet' ) !== false ) return 'spreadsheet';
		if ( strpos( $mime, 'zip' ) !== false || strpos( $mime, 'rar' ) !== false ) return 'archive';
		return 'other';
	}
}
