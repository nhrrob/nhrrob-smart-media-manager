<?php
/**
 * AI text generation for attachments.
 *
 * @package Nhrsmm\SmartMediaManager
 */

namespace Nhrsmm\SmartMediaManager\Core;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Generates alt text, captions, titles and descriptions via the WordPress AI client.
 */
class Ai {

	/**
	 * Returns true when AI is enabled and a provider that can generate text is configured.
	 *
	 * The core wp_supports_ai() check alone is true on every site that has not switched AI off,
	 * even with no connector installed, so the prompt builder is asked as well. This makes no request.
	 *
	 * @return bool
	 */
	public static function is_available(): bool {
		if ( ! function_exists( 'wp_ai_client_prompt' ) || ! function_exists( 'wp_supports_ai' ) || ! wp_supports_ai() ) {
			return false;
		}
		try {
			return (bool) wp_ai_client_prompt( 'ping' )->is_supported_for_text_generation();
		} catch ( \Throwable $e ) {
			return false;
		}
	}

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
			->with_text( 'Write a concise alt text under ' . (int) Options::get()['ai_alt_length'] . ' characters for this image. Return only the alt text, nothing else.' . $this->prompt_extras( $attachment_id ) )
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
			$mime   = get_post_mime_type( $attachment_id ) ? get_post_mime_type( $attachment_id ) : 'image/jpeg';
			$result = wp_ai_client_prompt()
				->using_system_instruction( 'You are a content writer for a website.' )
				->with_file( $image_path, $mime )
				->with_text( 'Write a short, engaging caption for this image suitable for use below the image on a webpage. Under 150 characters. Return only the caption text, nothing else.' . $this->prompt_extras( $attachment_id ) )
				->generate_text();
		} else {
			$post  = get_post( $attachment_id );
			$label = $post ? sanitize_text_field( $post->post_title ) : '';
			if ( ! $label ) {
				$file  = get_attached_file( $attachment_id );
				$label = basename( $file ? $file : '' );
			}
			$result = wp_ai_client_prompt()
				->using_system_instruction( 'You are a content writer for a website.' )
				->with_text( 'Write a short, descriptive caption for a file named "' . $label . '". Under 100 characters. Return only the caption text, nothing else.' )
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

	/**
	 * Generates a title or description for an attachment.
	 *
	 * @param int    $attachment_id Attachment post ID.
	 * @param string $field         Either title or description.
	 * @return array|\WP_Error
	 */
	public function generate_field( int $attachment_id, string $field ) {
		if ( ! function_exists( 'wp_ai_client_prompt' ) || ! wp_supports_ai() ) {
			return new \WP_Error( 'no_ai_provider', __( 'No AI provider configured. Go to Settings → Connectors to set up an AI provider.', 'nhrrob-smart-media-manager' ), [ 'status' => 400 ] );
		}

		$task = 'title' === $field
			? 'Write a short, descriptive title of at most 60 characters'
			: 'Write a one or two sentence description for a media library';

		$builder = wp_ai_client_prompt()->using_system_instruction( 'You are a content writer for a website.' );

		if ( wp_attachment_is_image( $attachment_id ) ) {
			$image_path = get_attached_file( $attachment_id );
			if ( ! $image_path ) {
				return new \WP_Error( 'no_file', __( 'Could not retrieve image file.', 'nhrrob-smart-media-manager' ) );
			}
			$mime    = get_post_mime_type( $attachment_id ) ? get_post_mime_type( $attachment_id ) : 'image/jpeg';
			$builder = $builder->with_file( $image_path, $mime );
			$text    = $task . ' for this image.';
		} else {
			$file = get_attached_file( $attachment_id );
			$text = $task . ' for a file named "' . sanitize_text_field( basename( $file ? $file : '' ) ) . '".';
		}

		$result = $builder
			->with_text( $text . ' Return only the text, nothing else.' . $this->prompt_extras( $attachment_id ) )
			->generate_text();

		if ( is_wp_error( $result ) ) {
			return $result;
		}

		$text = trim( $result );
		if ( empty( $text ) ) {
			return new \WP_Error( 'empty_response', __( 'AI returned an empty response.', 'nhrrob-smart-media-manager' ) );
		}

		return [ 'text' => $text ];
	}

	/**
	 * Generates text for one attachment field and optionally saves it.
	 *
	 * @param int    $attachment_id Attachment post ID.
	 * @param string $field         One of alt, caption, title, description.
	 * @param bool   $save          Save the generated text to the attachment.
	 * @return array|\WP_Error Array with field, text and saved keys.
	 */
	public function generate( int $attachment_id, string $field, bool $save = false ) {
		if ( 'alt' === $field ) {
			$result = $this->generate_alt_text( $attachment_id );
			$text   = is_wp_error( $result ) ? '' : $result['alt_text'];
		} elseif ( 'caption' === $field ) {
			$result = $this->generate_caption( $attachment_id );
			$text   = is_wp_error( $result ) ? '' : $result['caption'];
		} elseif ( 'title' === $field || 'description' === $field ) {
			$result = $this->generate_field( $attachment_id, $field );
			$text   = is_wp_error( $result ) ? '' : $result['text'];
		} else {
			return new \WP_Error( 'invalid_field', __( 'Unknown field.', 'nhrrob-smart-media-manager' ), [ 'status' => 400 ] );
		}

		if ( is_wp_error( $result ) ) {
			return $result;
		}

		if ( $save ) {
			$saved = ( new Media() )->update( $attachment_id, [ $field => $text ] );
			if ( is_wp_error( $saved ) ) {
				return $saved;
			}
		}

		return [
			'field' => $field,
			'text'  => $text,
			'saved' => $save,
		];
	}

	/**
	 * Cron callback: writes alt text for a newly uploaded image when the setting is on.
	 *
	 * @param int $attachment_id Attachment post ID.
	 * @return void
	 */
	public function auto_alt( $attachment_id ): void {
		$attachment_id = absint( $attachment_id );
		if ( empty( Options::get()['auto_alt'] ) || ! wp_attachment_is_image( $attachment_id ) ) {
			return;
		}
		if ( '' !== (string) get_post_meta( $attachment_id, '_wp_attachment_image_alt', true ) ) {
			return;
		}
		$this->generate( $attachment_id, 'alt', true );
	}

	/**
	 * Builds the optional prompt suffix from the AI settings (language, context, extra instructions).
	 *
	 * @param int $attachment_id Attachment post ID.
	 * @return string
	 */
	private function prompt_extras( int $attachment_id ): string {
		$settings = Options::get();
		$extras   = '';

		if ( '' !== $settings['ai_language'] ) {
			$extras .= ' Write in ' . $settings['ai_language'] . '.';
		}

		if ( ! empty( $settings['ai_context'] ) ) {
			$parent = (int) wp_get_post_parent_id( $attachment_id );
			if ( $parent ) {
				$extras .= ' The file appears on a page titled "' . wp_strip_all_tags( get_the_title( $parent ) ) . '".';
				foreach ( [ '_yoast_wpseo_focuskw', 'rank_math_focus_keyword', '_seopress_analysis_target_kw' ] as $key ) {
					$keyphrase = sanitize_text_field( (string) get_post_meta( $parent, $key, true ) );
					if ( '' !== $keyphrase ) {
						$extras .= ' Reflect the topic "' . $keyphrase . '" only if it fits naturally.';
						break;
					}
				}
			}
		}

		if ( '' !== $settings['ai_prompt'] ) {
			$extras .= ' Additional instructions: ' . $settings['ai_prompt'];
		}

		return $extras;
	}
}
