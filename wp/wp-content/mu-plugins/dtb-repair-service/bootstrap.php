<?php
/**
 * DTB Repair Service bootstrap.
 *
 * @package drywall-toolbox
 */

defined( 'ABSPATH' ) || exit;

// Load order: events -> workflows -> queue -> notifications -> rest/CPT -> admin.
dtb_module_require( 'dtb-repair-events.php' );
dtb_module_require( 'dtb-repair-workflows.php' );
dtb_module_require( 'dtb-repair-queue.php' );
dtb_module_require( 'dtb-repair-notifications.php' );
dtb_module_require( 'dtb-repairs.php' );
dtb_module_require( 'dtb-repair-admin.php' );
