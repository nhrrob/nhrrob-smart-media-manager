<?php
/**
 * Media usage detection.
 *
 * @package Nhrsmm\SmartMediaManager
 */

namespace Nhrsmm\SmartMediaManager\Core;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Finds where an attachment is referenced and flags attachments with no known reference.
 */
class Usage {

	/**
	 * Returns the places that reference the given attachment.
	 *
	 * Checks featured images, post content (URL, any generated size, block and class
	 * references), post meta (page builders, custom fields, WooCommerce galleries) and
	 * the site icon / logo. A file referenced only from theme files or CSS is not found.
	 *
	 * @param int $attachment_id Attachment post ID.
	 * @param int $limit         Maximum rows per source.
	 * @return array
	 */
	public function get( int $attachment_id, int $limit = 20 ): array {
		global $wpdb;

		$usages = [];
		$add    = static function ( $row, string $via ) use ( &$usages ) {
			$key = (int) $row->ID;
			if ( isset( $usages[ $key ] ) ) {
				return;
			}
			$usages[ $key ] = [
				'id'    => $key,
				'title' => ( '' !== $row->post_title ) ? $row->post_title : __( '(no title)', 'nhrrob-smart-media-manager' ),
				'type'  => $row->post_type,
				'url'   => get_permalink( $key ),
				'via'   => $via,
			];
		};

		// phpcs:disable WordPress.DB.DirectDatabaseQuery.DirectQuery,WordPress.DB.DirectDatabaseQuery.NoCaching
		$featured = $wpdb->get_results(
			$wpdb->prepare(
				"SELECT p.ID, p.post_title, p.post_type FROM {$wpdb->posts} p
				 INNER JOIN {$wpdb->postmeta} pm ON p.ID = pm.post_id
				 WHERE pm.meta_key = '_thumbnail_id' AND pm.meta_value = %d AND p.post_status != 'trash'
				 LIMIT %d",
				$attachment_id,
				$limit
			)
		);
		foreach ( $featured as $row ) {
			$add( $row, 'featured_image' );
		}
		// The unused-files scan only asks "is it used at all": skip the slower searches once it is.
		if ( 1 === $limit && $usages ) {
			return array_values( $usages );
		}

		$base    = $this->path_base( $attachment_id );
		$by_id   = '%' . $wpdb->esc_like( 'wp-image-' . $attachment_id . '"' ) . '%';
		$by_path = '' !== $base ? '%' . $wpdb->esc_like( $base . '.' ) . '%' : $by_id;
		$by_size = '' !== $base ? '%' . $wpdb->esc_like( $base . '-' ) . '%' : $by_id;

		$content = $wpdb->get_results(
			$wpdb->prepare(
				"SELECT ID, post_title, post_type FROM {$wpdb->posts}
				 WHERE post_status != 'trash' AND post_type NOT IN ( 'attachment', 'revision' )
				 AND ( post_content LIKE %s OR post_content LIKE %s OR post_content LIKE %s
				       OR post_content LIKE %s OR post_content LIKE %s OR post_content LIKE %s )
				 LIMIT %d",
				$by_path,
				$by_size,
				$by_id,
				'%' . $wpdb->esc_like( 'wp-image-' . $attachment_id . ' ' ) . '%',
				'%' . $wpdb->esc_like( '"id":' . $attachment_id . ',' ) . '%',
				'%' . $wpdb->esc_like( '"id":' . $attachment_id . '}' ) . '%',
				$limit
			)
		);
		foreach ( $content as $row ) {
			$add( $row, 'content' );
		}
		if ( 1 === $limit && $usages ) {
			return array_values( $usages );
		}

		if ( '' !== $base ) {
			$meta = $wpdb->get_results(
				$wpdb->prepare(
					"SELECT DISTINCT p.ID, p.post_title, p.post_type FROM {$wpdb->postmeta} pm
					 INNER JOIN {$wpdb->posts} p ON p.ID = pm.post_id
					 WHERE p.post_status != 'trash' AND p.post_type NOT IN ( 'attachment', 'revision' )
					 AND ( pm.meta_value LIKE %s OR pm.meta_value LIKE %s )
					 LIMIT %d",
					'%' . $wpdb->esc_like( $base ) . '%',
					'%' . $wpdb->esc_like( str_replace( '/', '\/', $base ) ) . '%',
					$limit
				)
			);
			foreach ( $meta as $row ) {
				$add( $row, 'meta' );
			}
		}

		$gallery = $wpdb->get_results(
			$wpdb->prepare(
				"SELECT p.ID, p.post_title, p.post_type FROM {$wpdb->postmeta} pm
				 INNER JOIN {$wpdb->posts} p ON p.ID = pm.post_id
				 WHERE pm.meta_key = '_product_image_gallery' AND FIND_IN_SET( %d, pm.meta_value ) AND p.post_status != 'trash'
				 LIMIT %d",
				$attachment_id,
				$limit
			)
		);
		// phpcs:enable WordPress.DB.DirectDatabaseQuery.DirectQuery,WordPress.DB.DirectDatabaseQuery.NoCaching
		foreach ( $gallery as $row ) {
			$add( $row, 'gallery' );
		}

		$usages = array_values( $usages );

		if ( (int) get_option( 'site_icon' ) === $attachment_id || (int) get_theme_mod( 'custom_logo' ) === $attachment_id ) {
			$usages[] = [
				'id'    => 0,
				'title' => __( 'Site icon / logo', 'nhrrob-smart-media-manager' ),
				'type'  => 'setting',
				'url'   => admin_url( 'customize.php' ),
				'via'   => 'setting',
			];
		}

		return $usages;
	}

	/**
	 * Flags a batch of attachments that have no known reference.
	 *
	 * @param int $after_id Only scan attachments with a higher ID (0 to start).
	 * @param int $limit    Batch size.
	 * @return array
	 */
	public function scan( int $after_id, int $limit = 10 ): array {
		global $wpdb;

		// phpcs:disable WordPress.DB.DirectDatabaseQuery.DirectQuery,WordPress.DB.DirectDatabaseQuery.NoCaching
		$ids   = $wpdb->get_col(
			$wpdb->prepare(
				"SELECT ID FROM {$wpdb->posts}
				 WHERE post_type = 'attachment' AND post_status = 'inherit' AND ID > %d
				 ORDER BY ID ASC LIMIT %d",
				$after_id,
				$limit
			)
		);
		$total = 0 === $after_id
			? (int) $wpdb->get_var( "SELECT COUNT(ID) FROM {$wpdb->posts} WHERE post_type = 'attachment' AND post_status = 'inherit'" )
			: null;
		// phpcs:enable WordPress.DB.DirectDatabaseQuery.DirectQuery,WordPress.DB.DirectDatabaseQuery.NoCaching

		$unused = 0;
		foreach ( $ids as $id ) {
			$id = (int) $id;
			if ( $this->get( $id, 1 ) ) {
				delete_post_meta( $id, '_nhrsmm_unused' );
			} else {
				update_post_meta( $id, '_nhrsmm_unused', 1 );
				++$unused;
			}
			$after_id = $id;
		}

		return [
			'last_id'   => $after_id,
			'processed' => count( $ids ),
			'unused'    => $unused,
			'total'     => $total,
			'done'      => count( $ids ) < $limit,
		];
	}

	/**
	 * Returns the upload-relative path of an attachment without extension or "-scaled" suffix.
	 *
	 * Matching on this base also finds every generated size (name-300x200.jpg).
	 *
	 * @param int $attachment_id Attachment post ID.
	 * @return string
	 */
	private function path_base( int $attachment_id ): string {
		$file = (string) get_post_meta( $attachment_id, '_wp_attached_file', true );
		if ( '' === $file ) {
			return '';
		}
		$base = preg_replace( '/\.[^.\/]+$/', '', $file );
		return (string) preg_replace( '/-scaled$/', '', $base );
	}
}
