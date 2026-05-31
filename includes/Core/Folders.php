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
				'orderby'    => 'name',
				'order'      => 'ASC',
			]
		);

		$tree = [];
		if ( ! is_wp_error( $terms ) && ! empty( $terms ) ) {
			$counts = $this->get_counts( $terms );
			$tree   = $this->build_tree( $terms, 0, $counts );
		}

		return [
			'tree'          => $tree,
			'uncategorized' => $this->get_uncategorized_count(),
		];
	}

	/**
	 * Returns the count of attachments not assigned to any folder.
	 *
	 * @return int
	 */
	private function get_uncategorized_count(): int {
		global $wpdb;

		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery,WordPress.DB.DirectDatabaseQuery.NoCaching
		$count = $wpdb->get_var(
			'SELECT COUNT(p.ID)
			 FROM ' . $wpdb->posts . ' p
			 LEFT JOIN ' . $wpdb->term_relationships . ' tr ON p.ID = tr.object_id
			 LEFT JOIN ' . $wpdb->term_taxonomy . ' tt
			     ON tr.term_taxonomy_id = tt.term_taxonomy_id
			     AND tt.taxonomy = \'nhrsmm_media_folder\'
			 WHERE p.post_type = \'attachment\'
			 AND p.post_status = \'inherit\'
			 AND tt.term_taxonomy_id IS NULL'
		);

		return (int) $count;
	}

	/**
	 * Returns a map of term_id => attachment count via a single DB query.
	 * Bypasses wp_term_taxonomy.count which only reflects published posts.
	 *
	 * @param array $terms Array of WP_Term objects.
	 * @return array<int,int>
	 */
	private function get_counts( array $terms ): array {
		global $wpdb;

		$ids    = array_map( fn( $t ) => (int) $t->term_id, $terms );
		$counts = array_fill_keys( $ids, 0 );

		if ( empty( $ids ) ) {
			return $counts;
		}

		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery,WordPress.DB.DirectDatabaseQuery.NoCaching
		$rows = $wpdb->get_results(
			// phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared
			'SELECT tt.term_id, COUNT(tr.object_id) AS c
			 FROM ' . $wpdb->term_relationships . ' tr
			 INNER JOIN ' . $wpdb->term_taxonomy . ' tt ON tr.term_taxonomy_id = tt.term_taxonomy_id
			 WHERE tt.term_id IN (' . implode( ',', $ids ) . ')
			 GROUP BY tt.term_id'
		);

		foreach ( $rows as $row ) {
			$counts[ (int) $row->term_id ] = (int) $row->c;
		}

		return $counts;
	}

	/**
	 * Recursively builds a nested folder array from a flat term list.
	 *
	 * @param array $terms         Flat array of WP_Term objects.
	 * @param int   $folder_parent Parent term ID to start from.
	 * @return array
	 */
	private function build_tree( array $terms, int $folder_parent, array $counts = [] ): array {
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
				'count'    => $counts[ (int) $term->term_id ] ?? (int) $term->count,
				'children' => $this->build_tree( $terms, $term->term_id, $counts ),
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
