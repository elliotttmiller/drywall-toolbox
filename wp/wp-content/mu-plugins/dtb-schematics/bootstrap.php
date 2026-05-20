<?php
/**
 * DTB Schematics bootstrap.
 *
 * @package drywall-toolbox
 */

defined( 'ABSPATH' ) || exit;

dtb_module_require( 'dtb-schematics/Application/ResolveSchematicParts.php' );
dtb_module_require( 'dtb-schematics/Rest/SchematicManifestController.php' );
dtb_module_require( 'dtb-schematics/Admin/SchematicAdminMenu.php' );
