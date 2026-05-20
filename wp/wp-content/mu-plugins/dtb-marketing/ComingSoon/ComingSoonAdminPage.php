<?php
defined( 'ABSPATH' ) || exit;

function dtb_marketing_render_subscribers_page(): void {
	if ( function_exists( 'dtb_render_subscribers_page' ) ) {
		dtb_render_subscribers_page();
	}
}
