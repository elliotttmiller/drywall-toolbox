<?php
defined( 'ABSPATH' ) || exit;

function dtb_marketing_export_subscribers_csv(): void {
	if ( function_exists( 'dtb_export_subscribers_csv' ) ) {
		dtb_export_subscribers_csv();
	}
}
