<?php
defined( 'ABSPATH' ) || exit;

function dtb_marketing_seo_meta_auth(): bool {
	return function_exists( 'dtb_seo_meta_auth' ) ? dtb_seo_meta_auth() : false;
}
