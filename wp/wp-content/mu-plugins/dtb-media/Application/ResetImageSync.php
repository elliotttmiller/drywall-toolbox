<?php
defined( 'ABSPATH' ) || exit;

// Transitional compatibility wrapper: module-path wiring now resolves through
// the dtb-media module tree, but image sync runtime behavior is still served
// by the legacy root implementation until extraction is completed.
// Remove after native dtb-media image-sync implementation replaces root logic
// and `pwsh -File scripts/smoke-dtb-mu-modules.ps1` passes.
if ( function_exists( 'dtb_module_require' ) ) {
	dtb_module_require( 'dtb-media/Legacy/dtb-image-sync.php' );
	return;
}

$legacy_path = dirname( __DIR__, 2 ) . '/dtb-media/Legacy/dtb-image-sync.php';
if ( file_exists( $legacy_path ) ) {
	require_once $legacy_path;
}
