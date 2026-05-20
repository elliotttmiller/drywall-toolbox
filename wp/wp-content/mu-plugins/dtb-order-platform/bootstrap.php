<?php
/**
 * DTB Order Platform bootstrap.
 *
 * @package drywall-toolbox
 */

defined( 'ABSPATH' ) || exit;

// Load order: events -> workflows -> queue -> tracking -> webhooks -> admin.
dtb_module_require( 'dtb-order-platform/Infrastructure/OrderEventRepository.php' );
dtb_module_require( 'dtb-order-platform/Services/OrderWorkflowService.php' );
dtb_module_require( 'dtb-order-platform/Infrastructure/OrderQueue.php' );
dtb_module_require( 'dtb-order-platform/Tracking/OrderStatusProjector.php' );
dtb_module_require( 'dtb-order-platform/Webhooks/PaymentWebhookController.php' );
dtb_module_require( 'dtb-order-platform/Admin/OrderAdminMenu.php' );
