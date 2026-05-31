<?php
/**
 * PSR-4 autoloader: Nhrsmm\SmartMediaManager\ -> includes/.
 *
 * @package Nhrsmm\SmartMediaManager
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

spl_autoload_register(
	static function ( $class_name ) {
		$prefix = 'Nhrsmm\\SmartMediaManager\\';
		$len    = strlen( $prefix );
		if ( strncmp( $prefix, $class_name, $len ) !== 0 ) {
			return;
		}
		$relative = substr( $class_name, $len );
		$file     = __DIR__ . '/' . str_replace( '\\', '/', $relative ) . '.php';
		if ( file_exists( $file ) ) {
			require $file;
		}
	}
);
