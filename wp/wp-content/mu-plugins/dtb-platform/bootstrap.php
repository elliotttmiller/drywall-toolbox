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

dtb_module_require( 'dtb-platform/Support/Arr.php' );
dtb_module_require( 'dtb-platform/Auth/AuthController.php' );
dtb_module_require( 'dtb-platform/Cache/CacheService.php' );
dtb_module_require( 'dtb-platform/Cache/CacheAdminPage.php' );
dtb_module_require( 'dtb-platform/Rest/LegacyProxyRoutes.php' );
dtb_module_require( 'dtb-platform/Security/ApiSecurity.php' );
dtb_module_require( 'dtb-platform/Security/FrontendSecurity.php' );
dtb_module_require( 'dtb-platform/Security/AdminSecurity.php' );
dtb_module_require( 'dtb-platform/Health/ApiHealthMonitor.php' );
dtb_module_require( 'dtb-platform/Observability/Metrics.php' );
dtb_module_require( 'dtb-platform/Observability/OpsDashboard.php' );
dtb_module_require( 'dtb-platform/Config/RuntimeConfig.php' );
