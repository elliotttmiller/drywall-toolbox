<?php
/**
 * DTB Schematics bootstrap.
 *
 * @package drywall-toolbox
 */

defined( 'ABSPATH' ) || exit;

dtb_module_require( 'dtb-schematics/Infrastructure/SchematicManifestRepository.php' );
dtb_module_require( 'dtb-schematics/Rest/SchematicMediaController.php' );
dtb_module_require( 'dtb-schematics/Rest/SchematicManifestController.php' );
dtb_module_require( 'dtb-schematics/Application/SyncSchematicMedia.php' );
dtb_module_require( 'dtb-schematics/Application/BuildSchematicManifest.php' );
dtb_module_require( 'dtb-schematics/Services/SchematicMediaService.php' );
dtb_module_require( 'dtb-schematics/Admin/SchematicAdminMenu.php' );
dtb_module_require( 'dtb-schematics/Admin/SchematicSyncPage.php' );
dtb_module_require( 'dtb-schematics/Admin/SchematicEditorPage.php' );
dtb_module_require( 'dtb-schematics/Admin/SchematicMediaPage.php' );
dtb_module_require( 'dtb-schematics/Application/ResolveSchematicParts.php' );
