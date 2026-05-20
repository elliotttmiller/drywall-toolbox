<?php
defined( 'ABSPATH' ) || exit;

function dtb_marketing_is_valid_seo_length( string $value, int $max ): bool {
	return mb_strlen( trim( $value ) ) <= $max;
}
