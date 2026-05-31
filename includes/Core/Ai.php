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

		if ( ! function_exists( 'wp_ai_client_prompt' ) || ! wp_supports_ai() ) {
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
			->using_system_instruction( 'You are an accessibility expert.' )
			->with_file( $image_path, $mime )
			->with_text( 'Write a concise alt text under 125 characters for this image. Return only the alt text, nothing else.' )
			->generate_text();

		$latency = (int) round( ( microtime( true ) - $start ) * 1000 );

		if ( is_wp_error( $result ) ) {
			return $result;
		}

		$text = trim( $result );
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

	/**
	 * Generates a caption for an image attachment using the configured AI provider.
	 *
	 * @param int $attachment_id Attachment post ID.
	 * @return array|\WP_Error
	 */
	public function generate_caption( int $attachment_id ) {
		if ( ! function_exists( 'wp_ai_client_prompt' ) || ! wp_supports_ai() ) {
			return new \WP_Error( 'no_ai_provider', __( 'No AI provider configured. Go to Settings → Connectors to set up an AI provider.', 'nhrrob-smart-media-manager' ), [ 'status' => 400 ] );
		}

		$start = microtime( true );

		if ( wp_attachment_is_image( $attachment_id ) ) {
			$image_path = get_attached_file( $attachment_id );
			if ( ! $image_path ) {
				return new \WP_Error( 'no_file', __( 'Could not retrieve image file.', 'nhrrob-smart-media-manager' ) );
			}
			$mime   = get_post_mime_type( $attachment_id ) ?: 'image/jpeg';
			$result = wp_ai_client_prompt()
				->using_system_instruction( 'You are a content writer for a website.' )
				->with_file( $image_path, $mime )
				->with_text( 'Write a short, engaging caption for this image suitable for use below the image on a webpage. Under 150 characters. Return only the caption text, nothing else.' )
				->generate_text();
		} else {
			$post  = get_post( $attachment_id );
			$label = $post ? sanitize_text_field( $post->post_title ) : '';
			if ( ! $label ) {
				$label = basename( get_attached_file( $attachment_id ) ?: '' );
			}
			$result = wp_ai_client_prompt()
				->using_system_instruction( 'You are a content writer for a website.' )
				->with_text( 'Write a short, descriptive caption for a file named "' . esc_html( $label ) . '". Under 100 characters. Return only the caption text, nothing else.' )
				->generate_text();
		}

		$latency = (int) round( ( microtime( true ) - $start ) * 1000 );

		if ( is_wp_error( $result ) ) {
			return $result;
		}

		$text = trim( $result );
		if ( empty( $text ) ) {
			return new \WP_Error( 'empty_response', __( 'AI returned an empty response.', 'nhrrob-smart-media-manager' ) );
		}

		return [
			'caption' => $text,
			'model'   => 'wp-ai-client',
			'latency' => $latency,
			'chars'   => mb_strlen( $text ),
		];
	}
}
