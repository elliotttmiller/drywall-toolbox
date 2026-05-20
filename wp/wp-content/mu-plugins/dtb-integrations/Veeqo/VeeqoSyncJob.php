<?php
defined( 'ABSPATH' ) || exit;

function dtb_integrations_veeqo_log_sync_timestamp( string $type ): void {
	if ( function_exists( 'dtb_veeqo_log_sync_timestamp' ) ) {
		dtb_veeqo_log_sync_timestamp( $type );
	}
}
