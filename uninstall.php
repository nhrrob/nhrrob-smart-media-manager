<?php

if ( ! defined( 'WP_UNINSTALL_PLUGIN' ) ) {
	exit;
}

// Remove all plugin options
delete_option( 'nhrsmm_settings' );
delete_option( 'nhrsmm_default_upload_folder' );

// Remove the nhrsmm_media_folder taxonomy terms
$terms = get_terms( [
	'taxonomy'   => 'nhrsmm_media_folder',
	'hide_empty' => false,
	'fields'     => 'ids',
] );

if ( ! is_wp_error( $terms ) && is_array( $terms ) ) {
	foreach ( $terms as $term_id ) {
		wp_delete_term( $term_id, 'nhrsmm_media_folder' );
	}
}
