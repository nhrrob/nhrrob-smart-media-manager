<?php
/**
 * WP-CLI commands.
 *
 * @package Nhrsmm\SmartMediaManager
 */

namespace Nhrsmm\SmartMediaManager;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

use Nhrsmm\SmartMediaManager\Core\Ai;

/**
 * Smart Media Manager commands.
 */
class Cli {

	/**
	 * Generates AI alt text for images that have none.
	 *
	 * ## OPTIONS
	 *
	 * [--limit=<number>]
	 * : Maximum number of images to process. Default 50.
	 *
	 * [--overwrite]
	 * : Also regenerate alt text for images that already have it.
	 *
	 * [--dry-run]
	 * : List the images that would be processed without calling the AI provider.
	 *
	 * ## EXAMPLES
	 *
	 *     wp nhrsmm alt --limit=200
	 *
	 * @param array $args       Positional arguments.
	 * @param array $assoc_args Associative arguments.
	 * @return void
	 */
	public function alt( $args, $assoc_args ): void {
		$limit     = max( 1, absint( $assoc_args['limit'] ?? 50 ) );
		$overwrite = isset( $assoc_args['overwrite'] );
		$dry_run   = isset( $assoc_args['dry-run'] );

		$query = [
			'post_type'      => 'attachment',
			'post_status'    => 'inherit',
			'post_mime_type' => 'image',
			'posts_per_page' => $limit,
			'fields'         => 'ids',
			'orderby'        => 'ID',
			'order'          => 'DESC',
		];
		if ( ! $overwrite ) {
			// phpcs:ignore WordPress.DB.SlowDBQuery.slow_db_query_meta_query
			$query['meta_query'] = [
				'relation' => 'OR',
				[
					'key'     => '_wp_attachment_image_alt',
					'compare' => 'NOT EXISTS',
				],
				[
					'key'   => '_wp_attachment_image_alt',
					'value' => '',
				],
			];
		}

		$ids  = get_posts( $query );
		$ai   = new Ai();
		$done = 0;

		foreach ( $ids as $id ) {
			if ( $dry_run ) {
				\WP_CLI::log( sprintf( '#%d %s', $id, get_the_title( $id ) ) );
				continue;
			}
			$result = $ai->generate( (int) $id, 'alt', true );
			if ( is_wp_error( $result ) ) {
				\WP_CLI::warning( sprintf( '#%d: %s', $id, $result->get_error_message() ) );
				if ( 'no_ai_provider' === $result->get_error_code() ) {
					break;
				}
				continue;
			}
			++$done;
			\WP_CLI::log( sprintf( '#%d: %s', $id, $result['text'] ) );
		}

		if ( $dry_run ) {
			\WP_CLI::success( sprintf( '%d images would be processed.', count( $ids ) ) );
			return;
		}
		\WP_CLI::success( sprintf( 'Generated alt text for %d of %d images.', $done, count( $ids ) ) );
	}
}
