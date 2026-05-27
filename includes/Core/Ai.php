<?php
/**
 * AI alt text generation.
 *
 * @package Nhrsmm\SmartMediaManager
 */

namespace Nhrsmm\SmartMediaManager\Core;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Generates alt text for image attachments via the WordPress AI client.
 */
class Ai {

	/**
	 * Generates alt text for an image attachment using the configured AI provider.
	 *
	 * @param int $attachment_id Attachment post ID.
	 * @return array|\WP_Error
	 */
	public function generate_alt_text( int $attachment_id ) {
		if ( ! wp_attachment_is_image( $attachment_id ) ) {
			return new \WP_Error( 'not_image', __( 'Alt text generation is only available for image files.', 'nhrrob-smart-media-manager' ) );
		}

		if ( ! function_exists( 'wp_ai_client_prompt' ) || ! is_supported_for_text_generation() ) {
			return new \WP_Error( 'no_ai_provider', __( 'No AI provider configured. Go to Settings → Connectors to set up an AI provider.', 'nhrrob-smart-media-manager' ), [ 'status' => 400 ] );
		}

		$image_path = get_attached_file( $attachment_id );
		if ( ! $image_path ) {
			return new \WP_Error( 'no_file', __( 'Could not retrieve image file.', 'nhrrob-smart-media-manager' ) );
		}

		$mime = get_post_mime_type( $attachment_id );
		if ( ! $mime ) {
			$mime = 'image/jpeg';
		}
		$start = microtime( true );

		$result = wp_ai_client_prompt()
			->with_file( $image_path, $mime )
			->with_system( 'You are an accessibility expert.' )
			->generate_text( 'Write a concise alt text under 125 characters for this image. Return only the alt text, nothing else.' );

		$latency = round( ( microtime( true ) - $start ) * 1000 );

		if ( is_wp_error( $result ) ) {
			return $result;
		}

		$text = trim( $result->get_text() );
		if ( empty( $text ) ) {
			return new \WP_Error( 'empty_response', __( 'AI returned an empty response.', 'nhrrob-smart-media-manager' ) );
		}

		return [
			'alt_text' => $text,
			'model'    => 'wp-ai-client',
			'latency'  => $latency,
			'chars'    => mb_strlen( $text ),
		];
	}
}
