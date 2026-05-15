<?php
/**
 * DTB Commerce bootstrap.
 *
 * Persists DTB toolset metadata from Store API add-to-cart requests through
 * Woo cart item data and into order line item meta.
 *
 * @package drywall-toolbox
 */

defined( 'ABSPATH' ) || exit;

if (
	! dtb_is_admin_or_rest_request()
	&& ! ( defined( 'WP_CLI' ) && WP_CLI )
) {
	return;
}

require_once __DIR__ . '/Cart/ToolsetCartItemData.php';
require_once __DIR__ . '/Orders/ToolsetOrderLineMeta.php';

DTB_ToolsetCartItemData::register();
DTB_ToolsetOrderLineMeta::register();
