<?php
/**
 * Plugin settings access.
 *
 * @package Nhrsmm\SmartMediaManager
 */

namespace Nhrsmm\SmartMediaManager\Core;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Reads and sanitises the single nhrsmm_settings option.
 */
class Options {

	/**
	 * Returns the hard-coded default settings.
	 *
	 * @return array
	 */
	public static function defaults(): array {
		return [
			'default_view'          => 'grid',
			'thumbnail_size'        => 'medium',
			'items_per_page'        => 40,
			'startup_folder'        => 'all',
			'default_upload_folder' => 0,
			'auto_alt'              => false,
			'ai_language'           => '',
			'ai_model'              => '',
			'ai_alt_length'         => 125,
			'ai_prompt'             => '',
			'ai_context'            => false,
		];
	}

	/**
	 * Returns saved settings merged over the defaults.
	 *
	 * @return array
	 */
	public static function get(): array {
		$saved = get_option( 'nhrsmm_settings', [] );
		$saved = is_array( $saved ) ? $saved : [];
		$all   = array_merge( self::defaults(), $saved );

		// Versions up to 1.0.3 read the default upload folder from its own option.
		if ( ! isset( $saved['default_upload_folder'] ) ) {
			$all['default_upload_folder'] = (int) get_option( 'nhrsmm_default_upload_folder', 0 );
		}

		return $all;
	}

	/**
	 * Validates a partial settings array and merges it into the saved settings.
	 *
	 * @param array $params Raw settings from the request.
	 * @return array The full settings after saving.
	 */
	public static function save( array $params ): array {
		$current = self::get();

		if ( isset( $params['default_view'] ) ) {
			$current['default_view'] = in_array( $params['default_view'], [ 'grid', 'list' ], true ) ? $params['default_view'] : 'grid';
		}
		if ( isset( $params['thumbnail_size'] ) ) {
			$current['thumbnail_size'] = in_array( $params['thumbnail_size'], [ 'small', 'medium', 'large' ], true ) ? $params['thumbnail_size'] : 'medium';
		}
		if ( isset( $params['items_per_page'] ) ) {
			$current['items_per_page'] = in_array( absint( $params['items_per_page'] ), [ 20, 40, 60, 100 ], true ) ? absint( $params['items_per_page'] ) : 40;
		}
		if ( isset( $params['startup_folder'] ) ) {
			$current['startup_folder'] = in_array( $params['startup_folder'], [ 'all', 'last', 'uncategorized' ], true ) ? $params['startup_folder'] : 'all';
		}
		if ( isset( $params['default_upload_folder'] ) ) {
			$folder                           = absint( $params['default_upload_folder'] );
			$current['default_upload_folder'] = $folder && term_exists( $folder, 'nhrsmm_media_folder' ) ? $folder : 0;
		}
		if ( isset( $params['auto_alt'] ) ) {
			$current['auto_alt'] = (bool) $params['auto_alt'];
		}
		if ( isset( $params['ai_context'] ) ) {
			$current['ai_context'] = (bool) $params['ai_context'];
		}
		if ( isset( $params['ai_language'] ) ) {
			$current['ai_language'] = mb_substr( sanitize_text_field( $params['ai_language'] ), 0, 40 );
		}
		if ( isset( $params['ai_model'] ) ) {
			// A model ID such as claude-sonnet-4-5; anything outside the usual ID characters is dropped.
			$current['ai_model'] = substr( (string) preg_replace( '/[^A-Za-z0-9._:\/-]/', '', sanitize_text_field( (string) $params['ai_model'] ) ), 0, 80 );
		}
		if ( isset( $params['ai_alt_length'] ) ) {
			$current['ai_alt_length'] = min( 300, max( 50, absint( $params['ai_alt_length'] ) ) );
		}
		if ( isset( $params['ai_prompt'] ) ) {
			$current['ai_prompt'] = mb_substr( sanitize_textarea_field( $params['ai_prompt'] ), 0, 500 );
		}

		update_option( 'nhrsmm_settings', $current, false );
		delete_option( 'nhrsmm_default_upload_folder' );

		return $current;
	}
}
