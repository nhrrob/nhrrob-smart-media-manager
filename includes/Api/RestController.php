<?php
/**
 * Base REST controller.
 *
 * @package Nhrsmm\SmartMediaManager\Api
 */

namespace Nhrsmm\SmartMediaManager\Api;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Shared namespace and default permission check for all REST controllers.
 */
abstract class RestController {

	/**
	 * REST API namespace.
	 *
	 * @var string
	 */
	protected string $namespace = 'nhrsmm/v1';

	/**
	 * Returns true when the current user can upload files.
	 *
	 * @return bool
	 */
	public function check_permission(): bool {
		return current_user_can( 'manage_categories' );
	}
}
