<?php
defined( 'ABSPATH' ) || exit;

function dtb_marketing_output_seo_head_tags(): void {
	if ( function_exists( 'dtb_seo_output_head_tags' ) ) {
		dtb_seo_output_head_tags();
	}
}
