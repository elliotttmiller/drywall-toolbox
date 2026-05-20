<?php
defined( 'ABSPATH' ) || exit;

function dtb_integrations_veeqo_healthcheck(): void {
	if ( function_exists( 'dtb_veeqo_run_health_check' ) ) {
		dtb_veeqo_run_health_check();
	}
}
