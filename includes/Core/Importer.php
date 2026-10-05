<?php
/**
 * Folder import from other media folder plugins.
 *
 * @package Nhrsmm\SmartMediaManager
 */

namespace Nhrsmm\SmartMediaManager\Core;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Copies folder structures and file assignments left by other plugins into this plugin's folders.
 * The source data is only read, never changed.
 */
class Importer {

	/**
	 * Files assigned per request.
	 */
	const BATCH = 500;

	/**
	 * Returns the known sources: taxonomy-based (list of taxonomy names) or table-based
	 * (folder table and relation table).
	 *
	 * @return array
	 */
	private function definitions(): array {
		return [
			'filebird'          => [
				'label'  => 'FileBird',
				'tables' => [ 'fbv', 'fbv_attachment_folder' ],
			],
			'rml'               => [
				'label'  => 'Real Media Library',
				'tables' => [ 'realmedialibrary', 'realmedialibrary_posts' ],
			],
			'catfolders'        => [
				'label'  => 'CatFolders',
				'tables' => [ 'catfolders', 'catfolders_posts' ],
			],
			'folders'           => [
				'label'      => 'Folders (Premio)',
				'taxonomies' => [ 'media_folder' ],
			],
			'eml'               => [
				'label'      => 'Enhanced Media Library',
				'taxonomies' => [ 'media_category' ],
			],
			'wicked'            => [
				'label'      => 'Wicked Folders',
				'taxonomies' => [ 'wf_attachment_folders' ],
			],
			'mlo'               => [
				'label'      => 'Media Library Organizer',
				'taxonomies' => [ 'mlo-category' ],
			],
			'mediamatic'        => [
				'label'  => 'Mediamatic',
				'tables' => [ 'mediamatic_folders', 'mediamatic_relationships' ],
			],
			'mediamatic_legacy' => [
				'label'      => 'Mediamatic (older versions)',
				'taxonomies' => [ 'mediamatic_wpfolder' ],
			],
			'happyfiles'        => [
				'label'      => 'HappyFiles',
				'taxonomies' => [ 'happyfiles_category' ],
			],
			'wpmf'              => [
				'label'      => 'WP Media Folder',
				'taxonomies' => [ 'wpmf-category' ],
			],
		];
	}

	/**
	 * Returns the sources that have folders on this site.
	 *
	 * @return array
	 */
	public function sources(): array {
		$found = [];
		foreach ( $this->definitions() as $key => $def ) {
			$count = count( $this->get_folders( $key ) );
			if ( $count ) {
				$found[] = [
					'key'     => $key,
					'label'   => $def['label'],
					'folders' => $count,
				];
			}
		}
		return $found;
	}

	/**
	 * Runs one import step. The first step (offset 0) creates the folders; every step
	 * assigns one batch of files.
	 *
	 * @param string $key    Source key.
	 * @param int    $offset Relation offset to continue from.
	 * @return array|\WP_Error
	 */
	public function run( string $key, int $offset = 0 ) {
		if ( ! isset( $this->definitions()[ $key ] ) ) {
			return new \WP_Error( 'invalid_source', __( 'Unknown import source.', 'nhrrob-smart-media-manager' ), [ 'status' => 400 ] );
		}

		$transient = 'nhrsmm_import_' . $key;
		$created   = 0;

		if ( 0 === $offset ) {
			$map     = $this->create_folders( $this->get_folders( $key ) );
			$created = count( $map );
			set_transient( $transient, $map, HOUR_IN_SECONDS );
		} else {
			$map = get_transient( $transient );
		}

		if ( ! is_array( $map ) || ! $map ) {
			return new \WP_Error( 'import_expired', __( 'Nothing to import, or the import expired. Please start again.', 'nhrrob-smart-media-manager' ), [ 'status' => 400 ] );
		}

		$relations = $this->get_relations( $key, $offset );
		$assigned  = 0;
		foreach ( $relations as $row ) {
			$folder = $map[ (int) $row->folder ] ?? 0;
			if ( $folder && 'attachment' === get_post_type( (int) $row->attachment ) ) {
				wp_set_object_terms( (int) $row->attachment, $folder, 'nhrsmm_media_folder', true );
				++$assigned;
			}
		}

		$done = count( $relations ) < self::BATCH;
		if ( $done ) {
			delete_transient( $transient );
		}

		return [
			'folders' => $created,
			'files'   => $assigned,
			'next'    => $done ? null : $offset + self::BATCH,
		];
	}

	/**
	 * Creates this plugin's folders for the given source folders, parents first.
	 *
	 * @param array $rows Source folders (id, name, parent, ord).
	 * @return array<int,int> Map of source folder ID to new term ID.
	 */
	private function create_folders( array $rows ): array {
		$by_parent = [];
		$known     = [];
		foreach ( $rows as $row ) {
			$known[ (int) $row->id ] = true;
		}
		foreach ( $rows as $row ) {
			// Roots are 0 (most plugins) or -1 (Real Media Library); orphans are treated as roots.
			$parent                 = isset( $known[ (int) $row->parent ] ) ? (int) $row->parent : 0;
			$by_parent[ $parent ][] = $row;
		}

		$folders = new Folders();
		$map     = [];
		$queue   = [ [ 0, 0 ] ];
		while ( $queue ) {
			list( $source_parent, $new_parent ) = array_shift( $queue );
			$position                           = 0;
			foreach ( $by_parent[ $source_parent ] ?? [] as $row ) {
				$id = $folders->ensure_path( [ (string) $row->name ], $new_parent );
				if ( is_wp_error( $id ) || ! $id || isset( $map[ (int) $row->id ] ) ) {
					continue;
				}
				update_term_meta( $id, 'nhrsmm_order', ++$position );
				$map[ (int) $row->id ] = $id;
				$queue[]               = [ (int) $row->id, $id ];
			}
		}
		return $map;
	}

	/**
	 * Reads the folders of a source as rows of id, name, parent, ord.
	 *
	 * @param string $key Source key.
	 * @return array
	 */
	private function get_folders( string $key ): array {
		global $wpdb;
		$def = $this->definitions()[ $key ];

		// phpcs:disable WordPress.DB.DirectDatabaseQuery.DirectQuery,WordPress.DB.DirectDatabaseQuery.NoCaching,WordPress.DB.PreparedSQL.InterpolatedNotPrepared,WordPress.DB.PreparedSQLPlaceholders.UnfinishedPrepare,WordPress.DB.PreparedSQLPlaceholders.ReplacementsWrongNumber
		if ( isset( $def['taxonomies'] ) ) {
			$in   = implode( ', ', array_fill( 0, count( $def['taxonomies'] ), '%s' ) );
			$rows = $wpdb->get_results(
				$wpdb->prepare(
					"SELECT t.term_id AS id, t.name, tt.parent, 0 AS ord
					 FROM {$wpdb->terms} t
					 INNER JOIN {$wpdb->term_taxonomy} tt ON tt.term_id = t.term_id
					 WHERE tt.taxonomy IN ($in)
					 ORDER BY t.name ASC",
					...$def['taxonomies']
				)
			);
			return is_array( $rows ) ? $rows : [];
		}

		if ( ! $this->tables_exist( $def['tables'] ) ) {
			return [];
		}

		$table = $wpdb->prefix . $def['tables'][0];
		if ( 'filebird' === $key ) {
			$rows = $wpdb->get_results( $wpdb->prepare( 'SELECT id, name, parent, ord FROM %i WHERE type = 0 ORDER BY ord ASC, id ASC', $table ) );
		} elseif ( 'rml' === $key ) {
			$rows = $wpdb->get_results( $wpdb->prepare( 'SELECT id, name, parent, ord FROM %i ORDER BY ord ASC, id ASC', $table ) );
		} elseif ( 'mediamatic' === $key ) {
			$rows = $wpdb->get_results( $wpdb->prepare( "SELECT id, name, parent_id AS parent, order_index AS ord FROM %i WHERE post_type = 'attachment' ORDER BY order_index ASC, id ASC", $table ) );
		} else {
			$rows = $wpdb->get_results( $wpdb->prepare( "SELECT id, title AS name, parent, ord FROM %i WHERE type = 'attachment' ORDER BY ord ASC, id ASC", $table ) );
		}
		// phpcs:enable WordPress.DB.DirectDatabaseQuery.DirectQuery,WordPress.DB.DirectDatabaseQuery.NoCaching,WordPress.DB.PreparedSQL.InterpolatedNotPrepared,WordPress.DB.PreparedSQLPlaceholders.UnfinishedPrepare,WordPress.DB.PreparedSQLPlaceholders.ReplacementsWrongNumber
		return is_array( $rows ) ? $rows : [];
	}

	/**
	 * Reads one batch of file assignments of a source as rows of folder, attachment.
	 *
	 * @param string $key    Source key.
	 * @param int    $offset Row offset.
	 * @return array
	 */
	private function get_relations( string $key, int $offset ): array {
		global $wpdb;
		$def = $this->definitions()[ $key ];

		// phpcs:disable WordPress.DB.DirectDatabaseQuery.DirectQuery,WordPress.DB.DirectDatabaseQuery.NoCaching,WordPress.DB.PreparedSQL.InterpolatedNotPrepared,WordPress.DB.PreparedSQLPlaceholders.UnfinishedPrepare,WordPress.DB.PreparedSQLPlaceholders.ReplacementsWrongNumber
		if ( isset( $def['taxonomies'] ) ) {
			$in   = implode( ', ', array_fill( 0, count( $def['taxonomies'] ), '%s' ) );
			$args = array_merge( $def['taxonomies'], [ self::BATCH, $offset ] );
			$rows = $wpdb->get_results(
				$wpdb->prepare(
					"SELECT tt.term_id AS folder, tr.object_id AS attachment
					 FROM {$wpdb->term_relationships} tr
					 INNER JOIN {$wpdb->term_taxonomy} tt ON tt.term_taxonomy_id = tr.term_taxonomy_id
					 WHERE tt.taxonomy IN ($in)
					 ORDER BY tr.object_id ASC, tt.term_id ASC
					 LIMIT %d OFFSET %d",
					...$args
				)
			);
			return is_array( $rows ) ? $rows : [];
		}

		if ( ! $this->tables_exist( $def['tables'] ) ) {
			return [];
		}

		$table = $wpdb->prefix . $def['tables'][1];
		if ( 'filebird' === $key ) {
			$rows = $wpdb->get_results( $wpdb->prepare( 'SELECT folder_id AS folder, attachment_id AS attachment FROM %i ORDER BY attachment_id ASC, folder_id ASC LIMIT %d OFFSET %d', $table, self::BATCH, $offset ) );
		} elseif ( 'rml' === $key ) {
			$rows = $wpdb->get_results( $wpdb->prepare( 'SELECT fid AS folder, attachment FROM %i ORDER BY attachment ASC, fid ASC LIMIT %d OFFSET %d', $table, self::BATCH, $offset ) );
		} elseif ( 'mediamatic' === $key ) {
			$rows = $wpdb->get_results( $wpdb->prepare( 'SELECT folder_id AS folder, object_id AS attachment FROM %i ORDER BY object_id ASC, folder_id ASC LIMIT %d OFFSET %d', $table, self::BATCH, $offset ) );
		} else {
			$rows = $wpdb->get_results( $wpdb->prepare( 'SELECT folder_id AS folder, post_id AS attachment FROM %i ORDER BY post_id ASC, folder_id ASC LIMIT %d OFFSET %d', $table, self::BATCH, $offset ) );
		}
		// phpcs:enable WordPress.DB.DirectDatabaseQuery.DirectQuery,WordPress.DB.DirectDatabaseQuery.NoCaching,WordPress.DB.PreparedSQL.InterpolatedNotPrepared,WordPress.DB.PreparedSQLPlaceholders.UnfinishedPrepare,WordPress.DB.PreparedSQLPlaceholders.ReplacementsWrongNumber
		return is_array( $rows ) ? $rows : [];
	}

	/**
	 * Returns true when every given (unprefixed) table exists.
	 *
	 * @param array $tables Table names without the WordPress prefix.
	 * @return bool
	 */
	private function tables_exist( array $tables ): bool {
		global $wpdb;
		foreach ( $tables as $table ) {
			$name = $wpdb->prefix . $table;
			// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery,WordPress.DB.DirectDatabaseQuery.NoCaching
			if ( $wpdb->get_var( $wpdb->prepare( 'SHOW TABLES LIKE %s', $wpdb->esc_like( $name ) ) ) !== $name ) {
				return false;
			}
		}
		return true;
	}
}
