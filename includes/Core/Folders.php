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
			'total'         => $this->get_status_count( 'inherit' ),
			'missing_alt'   => $this->get_missing_alt_count(),
			'trash'         => $this->get_trash_count(),
		];
	}

	/**
	 * Returns the count of images that have no alt text.
	 *
	 * @return int
	 */
	private function get_missing_alt_count(): int {
		global $wpdb;

		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery,WordPress.DB.DirectDatabaseQuery.NoCaching
		$count = $wpdb->get_var(
			'SELECT COUNT(p.ID)
			 FROM ' . $wpdb->posts . ' p
			 LEFT JOIN ' . $wpdb->postmeta . ' pm
			     ON pm.post_id = p.ID AND pm.meta_key = \'_wp_attachment_image_alt\'
			 WHERE p.post_type = \'attachment\'
			 AND p.post_status = \'inherit\'
			 AND p.post_mime_type LIKE \'image/%\'
			 AND ( pm.meta_id IS NULL OR pm.meta_value = \'\' )'
		);

		return (int) $count;
	}

	/**
	 * Returns the count of attachments in the trash.
	 *
	 * @return int
	 */
	private function get_trash_count(): int {
		return $this->get_status_count( 'trash' );
	}

	/**
	 * Returns the count of attachments with the given post status.
	 *
	 * @param string $status Post status.
	 * @return int
	 */
	private function get_status_count( string $status ): int {
		global $wpdb;

		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery,WordPress.DB.DirectDatabaseQuery.NoCaching
		return (int) $wpdb->get_var(
			$wpdb->prepare( "SELECT COUNT(ID) FROM {$wpdb->posts} WHERE post_type = 'attachment' AND post_status = %s", $status )
		);
	}

	/**
	 * Returns the count of attachments not assigned to any folder.
	 *
	 * @return int
	 */
	private function get_uncategorized_count(): int {
		global $wpdb;

		// NOT EXISTS rather than a LEFT JOIN: an attachment that also has terms in another
		// taxonomy (for example another folder plugin's) must not be counted as uncategorized.
		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery,WordPress.DB.DirectDatabaseQuery.NoCaching
		$count = $wpdb->get_var(
			'SELECT COUNT(p.ID)
			 FROM ' . $wpdb->posts . ' p
			 WHERE p.post_type = \'attachment\'
			 AND p.post_status = \'inherit\'
			 AND NOT EXISTS (
			     SELECT 1 FROM ' . $wpdb->term_relationships . ' tr
			     INNER JOIN ' . $wpdb->term_taxonomy . ' tt ON tt.term_taxonomy_id = tr.term_taxonomy_id
			     WHERE tr.object_id = p.ID AND tt.taxonomy = \'nhrsmm_media_folder\'
			 )'
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

		$placeholders = implode( ', ', array_fill( 0, count( $ids ), '%d' ) );
		$tr           = $wpdb->term_relationships;
		$tt           = $wpdb->term_taxonomy;
		$posts        = $wpdb->posts;
		// Table names and $placeholders ('%d, %d, …') cannot be parameterised — safe because
		// $tr/$tt/$posts are WP globals and $ids is a cast-integer array with no user input.
		// phpcs:disable WordPress.DB.DirectDatabaseQuery.DirectQuery,WordPress.DB.DirectDatabaseQuery.NoCaching,WordPress.DB.PreparedSQL.InterpolatedNotPrepared,WordPress.DB.PreparedSQLPlaceholders.UnfinishedPrepare
		$rows = $wpdb->get_results(
			$wpdb->prepare(
				"SELECT tt.term_id, COUNT(tr.object_id) AS c
				 FROM $tr tr
				 INNER JOIN $tt tt ON tr.term_taxonomy_id = tt.term_taxonomy_id
				 WHERE tt.term_id IN ($placeholders)
				 GROUP BY tt.term_id",
				...$ids
			)
		);
		// phpcs:enable WordPress.DB.DirectDatabaseQuery.DirectQuery,WordPress.DB.DirectDatabaseQuery.NoCaching,WordPress.DB.PreparedSQL.InterpolatedNotPrepared,WordPress.DB.PreparedSQLPlaceholders.UnfinishedPrepare

		foreach ( $rows as $row ) {
			$counts[ (int) $row->term_id ] = (int) $row->c;
		}

		return $counts;
	}

	/**
	 * Recursively builds a nested folder array from a flat term list.
	 *
	 * @param array          $terms         Flat array of WP_Term objects.
	 * @param int            $folder_parent Parent term ID to start from.
	 * @param array<int,int> $counts      Map of term_id => attachment count.
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
				'color'    => (string) get_term_meta( $term->term_id, 'nhrsmm_color', true ),
				'order'    => (int) get_term_meta( $term->term_id, 'nhrsmm_order', true ),
				'children' => $this->build_tree( $terms, $term->term_id, $counts ),
			];
		}
		// Manual order first, then name.
		usort(
			$tree,
			static function ( $a, $b ) {
				return $a['order'] === $b['order'] ? strcasecmp( $a['name'], $b['name'] ) : $a['order'] <=> $b['order'];
			}
		);
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
		if ( ! $term || is_wp_error( $term ) ) {
			return new \WP_Error( 'term_error', __( 'Could not retrieve created folder.', 'nhrrob-smart-media-manager' ) );
		}
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
		if ( ! $term || is_wp_error( $term ) ) {
			return new \WP_Error( 'term_error', __( 'Could not retrieve renamed folder.', 'nhrrob-smart-media-manager' ) );
		}
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
		if ( ! is_wp_error( $attachments ) ) {
			foreach ( $attachments as $att_id ) {
				wp_remove_object_terms( $att_id, $term_id, 'nhrsmm_media_folder' );
			}
		}

		$children = get_term_children( $term_id, 'nhrsmm_media_folder' );
		if ( ! is_wp_error( $children ) ) {
			foreach ( $children as $child_id ) {
				$this->delete( $child_id );
			}
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
		if ( 0 !== $new_parent ) {
			$descendants = get_term_children( $term_id, 'nhrsmm_media_folder' );
			if ( is_array( $descendants ) && in_array( $new_parent, $descendants, true ) ) {
				return new \WP_Error( 'circular_parent', __( 'Cannot move a folder into its own descendant.', 'nhrrob-smart-media-manager' ), [ 'status' => 400 ] );
			}
		}

		$result = wp_update_term( $term_id, 'nhrsmm_media_folder', [ 'parent' => $new_parent ] );
		if ( is_wp_error( $result ) ) {
			return $result;
		}
		$term = get_term( $result['term_id'], 'nhrsmm_media_folder' );
		if ( ! $term || is_wp_error( $term ) ) {
			return new \WP_Error( 'term_error', __( 'Could not retrieve moved folder.', 'nhrrob-smart-media-manager' ) );
		}
		return [
			'id'     => $term->term_id,
			'name'   => $term->name,
			'slug'   => $term->slug,
			'parent' => (int) $term->parent,
			'count'  => (int) $term->count,
		];
	}

	/**
	 * Sets or clears the colour of a folder.
	 *
	 * @param int    $term_id Term ID.
	 * @param string $color   Hex colour, or an empty string to clear it.
	 * @return bool
	 */
	public function set_color( int $term_id, string $color ): bool {
		$color = (string) sanitize_hex_color( $color );
		if ( '' === $color ) {
			delete_term_meta( $term_id, 'nhrsmm_color' );
			return true;
		}
		return false !== update_term_meta( $term_id, 'nhrsmm_color', $color );
	}

	/**
	 * Saves the manual order of sibling folders, moving them under the given parent.
	 *
	 * @param int   $folder_parent Parent term ID (0 for top-level).
	 * @param array $ids           Sibling term IDs in display order.
	 * @return bool|\WP_Error
	 */
	public function reorder( int $folder_parent, array $ids ) {
		$position = 0;
		foreach ( $ids as $id ) {
			$id   = absint( $id );
			$term = get_term( $id, 'nhrsmm_media_folder' );
			if ( ! $term || is_wp_error( $term ) ) {
				continue;
			}
			if ( (int) $term->parent !== $folder_parent ) {
				$moved = $this->move( $id, $folder_parent );
				if ( is_wp_error( $moved ) ) {
					return $moved;
				}
			}
			update_term_meta( $id, 'nhrsmm_order', ++$position );
		}
		return true;
	}

	/**
	 * Returns the ID of the folder at the given path, creating missing levels.
	 *
	 * @param array $names         Folder names from the top level down.
	 * @param int   $folder_parent Term ID the path starts under (0 for top-level).
	 * @return int|\WP_Error
	 */
	public function ensure_path( array $names, int $folder_parent = 0 ) {
		foreach ( array_slice( $names, 0, 10 ) as $name ) {
			$name = sanitize_text_field( $name );
			if ( '' === $name ) {
				continue;
			}
			$existing = term_exists( $name, 'nhrsmm_media_folder', $folder_parent );
			if ( $existing ) {
				$folder_parent = (int) ( is_array( $existing ) ? $existing['term_id'] : $existing );
				continue;
			}
			$created = wp_insert_term( $name, 'nhrsmm_media_folder', [ 'parent' => $folder_parent ] );
			if ( is_wp_error( $created ) ) {
				return $created;
			}
			$folder_parent = (int) $created['term_id'];
		}
		return $folder_parent;
	}

	/**
	 * Returns the folder structure (names and colours only) for export.
	 *
	 * @param array|null $tree Tree to strip; defaults to the full folder tree.
	 * @return array
	 */
	public function export( $tree = null ): array {
		if ( null === $tree ) {
			$tree = $this->get_tree()['tree'];
		}
		$out = [];
		foreach ( $tree as $node ) {
			$out[] = [
				'name'     => $node['name'],
				'color'    => $node['color'],
				'children' => $this->export( $node['children'] ),
			];
		}
		return $out;
	}

	/**
	 * Recreates an exported folder structure, reusing folders that already exist.
	 *
	 * @param array $nodes         Exported nodes (name, color, children).
	 * @param int   $folder_parent Term ID to import under.
	 * @param int   $depth         Current nesting depth.
	 * @return int Number of folders processed.
	 */
	public function import_tree( array $nodes, int $folder_parent = 0, int $depth = 0 ): int {
		$done = 0;
		if ( $depth > 10 ) {
			return $done;
		}
		foreach ( array_slice( $nodes, 0, 500 ) as $node ) {
			if ( ! is_array( $node ) || empty( $node['name'] ) || ! is_string( $node['name'] ) ) {
				continue;
			}
			$id = $this->ensure_path( [ $node['name'] ], $folder_parent );
			if ( is_wp_error( $id ) || ! $id ) {
				continue;
			}
			++$done;
			if ( ! empty( $node['color'] ) && is_string( $node['color'] ) ) {
				$this->set_color( $id, $node['color'] );
			}
			if ( ! empty( $node['children'] ) && is_array( $node['children'] ) ) {
				$done += $this->import_tree( $node['children'], $id, $depth + 1 );
			}
		}
		return $done;
	}

	/**
	 * Returns every folder as a flat, depth-annotated list in display order.
	 *
	 * @param array|null $tree  Tree to flatten; defaults to the full folder tree.
	 * @param int        $depth Current nesting depth.
	 * @return array
	 */
	public function flat( $tree = null, int $depth = 0 ): array {
		if ( null === $tree ) {
			$tree = $this->get_tree()['tree'];
		}
		$out = [];
		foreach ( $tree as $node ) {
			$out[] = [
				'id'    => (int) $node['id'],
				'name'  => $node['name'],
				'depth' => $depth,
			];
			$out   = array_merge( $out, $this->flat( $node['children'], $depth + 1 ) );
		}
		return $out;
	}

	/**
	 * Lists the files of a folder and its subfolders with their path inside the folder.
	 *
	 * @param int    $term_id Folder term ID.
	 * @param string $prefix  Path prefix for nested folders.
	 * @param int    $depth   Current nesting depth.
	 * @return array List of url/path pairs, capped at 2000 files.
	 */
	public function files( int $term_id, string $prefix = '', int $depth = 0 ): array {
		$term = get_term( $term_id, 'nhrsmm_media_folder' );
		if ( ! $term || is_wp_error( $term ) || $depth > 10 ) {
			return [];
		}

		$path  = $prefix . sanitize_file_name( $term->name ) . '/';
		$files = [];
		$ids   = get_objects_in_term( $term_id, 'nhrsmm_media_folder' );
		foreach ( is_wp_error( $ids ) ? [] : $ids as $id ) {
			$file = get_attached_file( (int) $id );
			$url  = wp_get_attachment_url( (int) $id );
			if ( $file && $url && 'inherit' === get_post_field( 'post_status', (int) $id ) ) {
				$files[] = [
					'url'  => $url,
					'path' => $path . basename( $file ),
				];
			}
		}

		$children = get_terms(
			[
				'taxonomy'   => 'nhrsmm_media_folder',
				'hide_empty' => false,
				'parent'     => $term_id,
				'fields'     => 'ids',
			]
		);
		foreach ( is_wp_error( $children ) ? [] : $children as $child ) {
			$files = array_merge( $files, $this->files( (int) $child, $path, $depth + 1 ) );
		}

		return array_slice( $files, 0, 2000 );
	}
}
