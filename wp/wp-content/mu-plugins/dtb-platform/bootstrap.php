<?php
/**
 * DTB Platform bootstrap.
 *
 * Transitional composition module that centralizes core platform wiring while
 * legacy root files are incrementally migrated into layered module internals.
 *
 * @package drywall-toolbox
 */

defined( 'ABSPATH' ) || exit;

dtb_module_require( 'dtb-utils.php' );
dtb_module_require( 'dtb-auth.php' );
dtb_module_require( 'dtb-cache.php' );
dtb_module_require( 'dtb-cache-admin.php' );
dtb_module_require( 'dtb-rest-api.php' );
dtb_module_require( 'dtb-api-security.php' );
dtb_module_require( 'dtb-frontend-security.php' );
dtb_module_require( 'dtb-admin-security.php' );
dtb_module_require( 'dtb-api-health-monitor.php' );
dtb_module_require( 'dtb-admin-performance.php' );
dtb_module_require( 'dtb-ops-dashboard.php' );
dtb_module_require( 'dtb-config-reference.php' );
