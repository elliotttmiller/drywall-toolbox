<?php
defined( 'ABSPATH' ) || exit;

function dtb_integrations_woo_ensure_webhooks(): void {
	if ( function_exists( 'dtb_wc_ensure_webhooks' ) ) {
		dtb_wc_ensure_webhooks();
	}
}
