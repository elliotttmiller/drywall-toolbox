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

require_once __DIR__ . '/Cart/ToolsetCartItemData.php';
require_once __DIR__ . '/Orders/ToolsetOrderLineMeta.php';
require_once __DIR__ . '/Services/OrderTypeService.php';
require_once __DIR__ . '/Services/OrderAdminQueryService.php';
require_once __DIR__ . '/Validation/CheckoutValidator.php';
require_once __DIR__ . '/Domain/PaymentState.php';
require_once __DIR__ . '/Payment/PaymentRuntime.php';
require_once __DIR__ . '/Payment/OrderPayPresentation.php';
require_once __DIR__ . '/Payment/OrderPayHardening.php';
require_once __DIR__ . '/Payment/UnpaidOrderPayGuard.php';
require_once __DIR__ . '/Payment/PaymentBnplCartFinalization.php';
require_once __DIR__ . '/Payment/CustomerAssociation.php';
require_once __DIR__ . '/Payment/PaymentStatusGuard.php';
require_once __DIR__ . '/Shipping/DTBShippingMethod.php';
require_once __DIR__ . '/Rest/CheckoutRestController.php';
require_once __DIR__ . '/Email/WooCommerceBrandedEmails.php';
require_once __DIR__ . '/Email/WooCommerceAdminBrandedEmails.php';

if ( is_admin() ) {
	require_once __DIR__ . '/Admin/OrdersPage.php';
}

require_once __DIR__ . '/Rest/OrderRestController.php';

DTB_ToolsetCartItemData::register();
DTB_ToolsetOrderLineMeta::register();
