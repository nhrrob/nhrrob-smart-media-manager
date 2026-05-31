<?php
/**
 * Plugin uninstall handler — removes all plugin data from the database.
 *
 * @package Nhrsmm\SmartMediaManager
 */

if ( ! defined( 'WP_UNINSTALL_PLUGIN' ) ) {
	exit;
}

// Remove all plugin options.
delete_option( 'nhrsmm_settings' );
delete_option( 'nhrsmm_default_upload_folder' );

// Remove lazily-written filesize meta from all attachments.
delete_post_meta_by_key( '_nhrsmm_filesize' );

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

// Remove the nhrsmm_media_folder taxonomy terms.
$nhrsmm_terms = get_terms(
	[
		'taxonomy'   => 'nhrsmm_media_folder',
		'hide_empty' => false,
		'fields'     => 'ids',
	]
);

if ( ! is_wp_error( $nhrsmm_terms ) && is_array( $nhrsmm_terms ) ) {
	foreach ( $nhrsmm_terms as $nhrsmm_term_id ) {
		wp_delete_term( $nhrsmm_term_id, 'nhrsmm_media_folder' );
	}
}
