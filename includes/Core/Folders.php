<?php
/**
 * Folder (taxonomy term) CRUD operations.
 *
 * @package Nhrsmm\SmartMediaManager
 */

namespace Nhrsmm\SmartMediaManager\Core;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Manages virtual media folders stored as nhrsmm_media_folder taxonomy terms.
 */
class Folders {

	/**
	 * Returns the full hierarchical folder tree.
	 *
	 * @return array
	 */
	public function get_tree(): array {
		$terms = get_terms(
			[
				'taxonomy'   => 'nhrsmm_media_folder',
				'hide_empty' => false,
				'orderby'    => 'meta_value_num',
				'meta_key'   => 'nhrsmm_order', // phpcs:ignore WordPress.DB.SlowDBQuery.slow_db_query_meta_key
				'order'      => 'ASC',
			]
		);

		if ( is_wp_error( $terms ) ) {
			return [];
		}

		return $this->build_tree( $terms, 0 ); // folder_parent = 0 = top-level.
	}

	/**
	 * Recursively builds a nested folder array from a flat term list.
	 *
	 * @param array $terms         Flat array of WP_Term objects.
	 * @param int   $folder_parent Parent term ID to start from.
	 * @return array
	 */
	private function build_tree( array $terms, int $folder_parent ): array {
		$tree = [];
		foreach ( $terms as $term ) {
			if ( (int) $term->parent !== $folder_parent ) {
				continue;
			}
			$tree[] = [
				'id'       => $term->term_id,
				'name'     => $term->name,
				'slug'     => $term->slug,
				'parent'   => $term->parent,
				'count'    => (int) $term->count,
				'children' => $this->build_tree( $terms, $term->term_id ),
			];
		}
		return $tree;
	}

	/**
	 * Creates a new folder term.
	 *
	 * @param string $name          Folder display name.
	 * @param int    $folder_parent Parent term ID (0 for top-level).
	 * @return array|\WP_Error
	 */
	public function create( string $name, int $folder_parent = 0 ) {
		$name = sanitize_text_field( $name );
		if ( empty( $name ) ) {
			return new \WP_Error( 'empty_name', __( 'Folder name cannot be empty.', 'nhrrob-smart-media-manager' ) );
		}

		$args   = [ 'parent' => $folder_parent ];
		$result = wp_insert_term( $name, 'nhrsmm_media_folder', $args );

		if ( is_wp_error( $result ) ) {
			return $result;
		}

		$term = get_term( $result['term_id'], 'nhrsmm_media_folder' );
		return [
			'id'       => $term->term_id,
			'name'     => $term->name,
			'slug'     => $term->slug,
			'parent'   => (int) $term->parent,
			'count'    => 0,
			'children' => [],
		];
	}

	/**
	 * Renames an existing folder term.
	 *
	 * @param int    $term_id Term ID.
	 * @param string $name    New display name.
	 * @return array|\WP_Error
	 */
	public function rename( int $term_id, string $name ) {
		$name = sanitize_text_field( $name );
		if ( empty( $name ) ) {
			return new \WP_Error( 'empty_name', __( 'Folder name cannot be empty.', 'nhrrob-smart-media-manager' ) );
		}

		$result = wp_update_term( $term_id, 'nhrsmm_media_folder', [ 'name' => $name ] );
		if ( is_wp_error( $result ) ) {
			return $result;
		}

		$term = get_term( $result['term_id'], 'nhrsmm_media_folder' );
		return [
			'id'     => $term->term_id,
			'name'   => $term->name,
			'slug'   => $term->slug,
			'parent' => (int) $term->parent,
			'count'  => (int) $term->count,
		];
	}

	/**
	 * Deletes a folder and recursively removes all child folders.
	 *
	 * @param int $term_id Term ID.
	 * @return bool|\WP_Error
	 */
	public function delete( int $term_id ) {
		// Move files to Uncategorized (remove from this folder, not delete them).
		$attachments = get_objects_in_term( $term_id, 'nhrsmm_media_folder' );
		foreach ( $attachments as $att_id ) {
			wp_remove_object_terms( $att_id, $term_id, 'nhrsmm_media_folder' );
		}

		// Also delete children recursively.
		$children = get_term_children( $term_id, 'nhrsmm_media_folder' );
		foreach ( $children as $child_id ) {
			$this->delete( $child_id );
		}

		$result = wp_delete_term( $term_id, 'nhrsmm_media_folder' );
		return is_wp_error( $result ) ? $result : (bool) $result;
	}

	/**
	 * Moves a folder under a new parent term.
	 *
	 * @param int $term_id    Term ID to move.
	 * @param int $new_parent New parent term ID (0 for top-level).
	 * @return array|\WP_Error
	 */
	public function move( int $term_id, int $new_parent ) {
		$result = wp_update_term( $term_id, 'nhrsmm_media_folder', [ 'parent' => $new_parent ] );
		if ( is_wp_error( $result ) ) {
			return $result;
		}
		$term = get_term( $result['term_id'], 'nhrsmm_media_folder' );
		return [
			'id'     => $term->term_id,
			'name'   => $term->name,
			'slug'   => $term->slug,
			'parent' => (int) $term->parent,
			'count'  => (int) $term->count,
		];
	}
}
