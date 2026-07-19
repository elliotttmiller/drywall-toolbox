<?php
/**
 * DTB Commerce bootstrap.
 *
 * Loads cart metadata, checkout validation, official Stripe native checkout
 * support, shipping, and commerce-facing REST/email integrations.
 *
 * @package drywall-toolbox
 */

defined( 'ABSPATH' ) || exit;

require_once __DIR__ . '/Cart/ToolsetCartItemData.php';
require_once __DIR__ . '/Orders/ToolsetOrderLineMeta.php';
require_once __DIR__ . '/Services/OrderTypeService.php';
require_once __DIR__ . '/Services/OrderAdminQueryService.php';
require_once __DIR__ . '/Validation/CheckoutValidator.php';
require_once __DIR__ . '/Domain/PaymentState.php';
require_once __DIR__ . '/Payment/OfficialStripeNativeCheckout.php';
require_once __DIR__ . '/Shipping/DTBShippingMethod.php';
require_once __DIR__ . '/Email/WooCommerceBrandedEmails.php';
require_once __DIR__ . '/Email/WooCommerceAdminBrandedEmails.php';

if ( is_admin() ) {
	require_once __DIR__ . '/Admin/OrdersPage.php';
}

require_once __DIR__ . '/Rest/OrderRestController.php';

DTB_ToolsetCartItemData::register();
DTB_ToolsetOrderLineMeta::register();
