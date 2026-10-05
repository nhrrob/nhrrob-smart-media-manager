<?php
/**
 * Plugin uninstall handler — removes all plugin data from the database.
 *
 * @package Nhrsmm\SmartMediaManager
 */

if ( ! defined( 'WP_UNINSTALL_PLUGIN' ) ) {
	exit;
}

/**
 * Removes all plugin data from the current site.
 *
 * @return void
 */
function nhrsmm_uninstall_site() {
	delete_option( 'nhrsmm_settings' );
	delete_option( 'nhrsmm_default_upload_folder' );

	// Post meta written lazily on attachments.
	delete_post_meta_by_key( '_nhrsmm_filesize' );
	delete_post_meta_by_key( '_nhrsmm_unused' );

	wp_unschedule_hook( 'nhrsmm_auto_alt' );

	// uninstall.php runs outside the normal request lifecycle — no init hook fires,
	// so the taxonomy is never registered. Register it inline before querying terms.
	register_taxonomy(
		'nhrsmm_media_folder',
		'attachment',
		[
			'public'       => false,
			'hierarchical' => true,
			'rewrite'      => false,
			'query_var'    => false,
		]
	);

	// Deleting a term also deletes its term meta (folder colour and order).
	$terms = get_terms(
		[
			'taxonomy'   => 'nhrsmm_media_folder',
			'hide_empty' => false,
			'fields'     => 'ids',
		]
	);

	if ( ! is_wp_error( $terms ) && is_array( $terms ) ) {
		foreach ( $terms as $term_id ) {
			wp_delete_term( $term_id, 'nhrsmm_media_folder' );
		}
	}
}

if ( is_multisite() ) {
	foreach ( get_sites(
		[
			'fields' => 'ids',
			'number' => 0,
		]
	) as $nhrsmm_site_id ) {
		switch_to_blog( $nhrsmm_site_id );
		nhrsmm_uninstall_site();
		restore_current_blog();
	}
} else {
	nhrsmm_uninstall_site();
}

// Per-user starred and recent lists (user meta is network-wide).
delete_metadata( 'user', 0, 'nhrsmm_starred', '', true );
delete_metadata( 'user', 0, 'nhrsmm_recent', '', true );
