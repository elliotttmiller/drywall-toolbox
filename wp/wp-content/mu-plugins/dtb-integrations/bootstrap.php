<?php
/**
 * DTB Integrations bootstrap.
 *
 * Loads external-system bridge modules in dependency order. The legacy client
 * files remain the contract owners for this phase; surrounding module-layer
 * files provide typed facades, health snapshots, and bounded service entrypoints
 * without changing runtime hooks or REST routes.
 *
 * @package drywall-toolbox
 */

defined( 'ABSPATH' ) || exit;

// WooCommerce bridge first so all integration consumers hook against the configured WC runtime.
dtb_module_require( 'dtb-integrations/WooCommerce/WooCommerceBridge.php' );
dtb_module_require( 'dtb-integrations/WooCommerce/WooCommerceHealthCheck.php' );
dtb_module_require( 'dtb-integrations/WooCommerce/ProductLookupService.php' );
dtb_module_require( 'dtb-integrations/WooCommerce/WooWebhookManager.php' );
dtb_module_require( 'dtb-integrations/WooCommerce/ProductWebhookHandler.php' );
dtb_module_require( 'dtb-integrations/WooCommerce/RepairOrderService.php' );

// Veeqo.
dtb_module_require( 'dtb-integrations/Veeqo/VeeqoClient.php' );
dtb_module_require( 'dtb-integrations/Veeqo/VeeqoConfig.php' );
dtb_module_require( 'dtb-integrations/Veeqo/VeeqoHealthCheck.php' );
dtb_module_require( 'dtb-integrations/Veeqo/VeeqoInventoryService.php' );
dtb_module_require( 'dtb-integrations/Veeqo/VeeqoShippingService.php' );
dtb_module_require( 'dtb-integrations/Veeqo/VeeqoSyncJob.php' );
dtb_module_require( 'dtb-integrations/Veeqo/VeeqoWebhookController.php' );

// QuickBooks.
dtb_module_require( 'dtb-integrations/QuickBooks/QuickBooksClient.php' );
dtb_module_require( 'dtb-integrations/QuickBooks/QuickBooksConfig.php' );
dtb_module_require( 'dtb-integrations/QuickBooks/QuickBooksHealthCheck.php' );
dtb_module_require( 'dtb-integrations/QuickBooks/QuickBooksCustomerMapper.php' );
dtb_module_require( 'dtb-integrations/QuickBooks/QuickBooksInvoiceService.php' );
dtb_module_require( 'dtb-integrations/QuickBooks/QuickBooksOAuthController.php' );
dtb_module_require( 'dtb-integrations/QuickBooks/QuickBooksSyncJob.php' );

// Rewards / ProCare.
dtb_module_require( 'dtb-integrations/Rewards/RewardsService.php' );
dtb_module_require( 'dtb-integrations/Rewards/RewardsHealthCheck.php' );
dtb_module_require( 'dtb-integrations/Rewards/RewardsIssueJob.php' );
dtb_module_require( 'dtb-integrations/Rewards/RewardsAdjustmentController.php' );
dtb_module_require( 'dtb-integrations/Rewards/RewardsBalanceController.php' );
dtb_module_require( 'dtb-integrations/Rewards/ProCareEligibilityService.php' );

// Notifications are loaded last because they can be used by order/repair/integration hooks.
dtb_module_require( 'dtb-integrations/Notifications/NotificationTemplateRepository.php' );
dtb_module_require( 'dtb-integrations/Notifications/EmailTemplateRenderer.php' );
dtb_module_require( 'dtb-integrations/Notifications/NotificationDispatcher.php' );
dtb_module_require( 'dtb-integrations/Notifications/NotificationJob.php' );
dtb_module_require( 'dtb-integrations/Notifications/SmsGateway.php' );
