<?php

namespace Nhrsmm\SmartMediaManager\Core;

if ( ! defined( 'ABSPATH' ) ) exit;

class Folders {

	public function get_tree(): array {
		$terms = get_terms( [
			'taxonomy'   => 'nhrsmm_media_folder',
			'hide_empty' => false,
			'orderby'    => 'meta_value_num',
			'meta_key'   => 'nhrsmm_order',
			'order'      => 'ASC',
		] );

		if ( is_wp_error( $terms ) ) {
			return [];
		}

		return $this->build_tree( $terms, 0 );
	}

	private function build_tree( array $terms, int $parent ): array {
		$tree = [];
		foreach ( $terms as $term ) {
			if ( (int) $term->parent !== $parent ) {
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

	public function create( string $name, int $parent = 0 ) {
		$name = sanitize_text_field( $name );
		if ( empty( $name ) ) {
			return new \WP_Error( 'empty_name', __( 'Folder name cannot be empty.', 'nhrrob-smart-media-manager' ) );
		}

		$args = [ 'parent' => $parent ];
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
