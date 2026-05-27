<?php

namespace Nhrsmm\SmartMediaManager;

if ( ! defined( 'ABSPATH' ) ) exit;

class Deactivator {

	public static function run() {
		flush_rewrite_rules();
	}
}
