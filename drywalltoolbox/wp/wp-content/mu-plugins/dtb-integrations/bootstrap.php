<?php
/**
 * DTB Integrations bootstrap.
 *
 * Composition root for external-system integrations.
 *
 * Loads module-layer files in explicit dependency order:
 *   1. Base bridges/clients (contract owners)
 *   2. Module config + services + controllers
 *   3. Health-check adapters
 *   4. Cross-integration notifications
 *
 * @package drywall-toolbox
 */

defined( 'ABSPATH' ) || exit;

if ( ! function_exists( 'dtb_integrations_require_files' ) ) {
	/**
	 * Require a list of integration module files in-order.
	 *
	 * @param string[] $relative_paths Paths relative to wp-content/mu-plugins.
	 */
	function dtb_integrations_require_files( array $relative_paths ): void {
		foreach ( $relative_paths as $path ) {
			dtb_module_require( $path );
		}
	}
}

if ( ! function_exists( 'dtb_integrations_register_health_checks' ) ) {
	/** Register all major integration health checks with DTB health registry. */
	function dtb_integrations_register_health_checks(): void {
		if ( class_exists( 'DTB_WooCommerceHealthCheck' ) ) {
			DTB_WooCommerceHealthCheck::register();
		}
		if ( class_exists( 'DTB_VeeqoHealthCheck' ) ) {
			DTB_VeeqoHealthCheck::register();
		}
		if ( class_exists( 'DTB_QuickBooksHealthCheck' ) ) {
			DTB_QuickBooksHealthCheck::register();
		}
		if ( class_exists( 'DTB_RewardsHealthCheck' ) ) {
			DTB_RewardsHealthCheck::register();
		}
		if ( class_exists( 'DTB_AmazonHealthCheck' ) ) {
			DTB_AmazonHealthCheck::register();
		}
		if ( class_exists( 'DTB_EbayHealthCheck' ) ) {
			DTB_EbayHealthCheck::register();
		}
	}
}

// 1) Core bridges/clients first (runtime hooks/routes).
dtb_integrations_require_files( [
	'dtb-integrations/WooCommerce/WooCommerceBridge.php',
	'dtb-integrations/Veeqo/VeeqoClient.php',
	'dtb-integrations/QuickBooks/QuickBooksClient.php',
	'dtb-integrations/Rewards/RewardsService.php',
] );

// 2) WooCommerce module-layer files.
dtb_integrations_require_files( [
	'dtb-integrations/WooCommerce/ProductLookupService.php',
	'dtb-integrations/WooCommerce/WooWebhookManager.php',
	'dtb-integrations/WooCommerce/ProductWebhookHandler.php',
	'dtb-integrations/WooCommerce/RepairOrderService.php',
	'dtb-integrations/WooCommerce/WooCommerceHealthCheck.php',
] );

// 3) Veeqo module-layer files.
dtb_integrations_require_files( [
	'dtb-integrations/Veeqo/VeeqoConfig.php',
	'dtb-integrations/Veeqo/VeeqoInventoryService.php',
	'dtb-integrations/Veeqo/VeeqoShippingService.php',
	'dtb-integrations/Veeqo/VeeqoSyncJob.php',
	'dtb-integrations/Veeqo/VeeqoWebhookController.php',
	'dtb-integrations/Veeqo/VeeqoHealthCheck.php',
] );

// 4) QuickBooks module-layer files.
dtb_integrations_require_files( [
	'dtb-integrations/QuickBooks/QuickBooksConfig.php',
	'dtb-integrations/QuickBooks/QuickBooksCustomerMapper.php',
	'dtb-integrations/QuickBooks/QuickBooksInvoiceService.php',
	'dtb-integrations/QuickBooks/QuickBooksOAuthController.php',
	'dtb-integrations/QuickBooks/QuickBooksSyncJob.php',
	'dtb-integrations/QuickBooks/QuickBooksHealthCheck.php',
] );

// 5) Rewards module-layer files.
dtb_integrations_require_files( [
	'dtb-integrations/Rewards/RewardsIssueJob.php',
	'dtb-integrations/Rewards/RewardsAdjustmentController.php',
	'dtb-integrations/Rewards/RewardsBalanceController.php',
	'dtb-integrations/Rewards/RewardsHealthCheck.php',
] );

// 6) Notifications last (cross-integration consumers).
dtb_integrations_require_files( [
	'dtb-integrations/Notifications/NotificationTemplateRepository.php',
	'dtb-integrations/Notifications/EmailTemplateRenderer.php',
	'dtb-integrations/Notifications/NotificationDispatcher.php',
	'dtb-integrations/Notifications/NotificationJob.php',
	'dtb-integrations/Notifications/SmsGateway.php',
] );

// 7) Marketplace shared infrastructure (schema + contracts + credentials).
dtb_integrations_require_files( [
	'dtb-integrations/Marketplace/Schema/MarketplaceSchemaInstaller.php',
	'dtb-integrations/Marketplace/ChannelContract.php',
	'dtb-integrations/Marketplace/CredentialFacade.php',
	'dtb-integrations/Marketplace/RateLimitState.php',
	'dtb-integrations/Marketplace/OrderNormalizer.php',
	'dtb-integrations/Marketplace/MessageNormalizer.php',
	'dtb-integrations/Marketplace/ActionPolicyValidator.php',
	'dtb-integrations/Marketplace/ExceptionService.php',
	'dtb-integrations/Marketplace/EventService.php',
	'dtb-integrations/Marketplace/AuditService.php',
	'dtb-integrations/Marketplace/ReadModels.php',
] );

// 8) Amazon module.
dtb_integrations_require_files( [
	'dtb-integrations/Amazon/AmazonConfig.php',
	'dtb-integrations/Amazon/AmazonLwaTokenService.php',
	'dtb-integrations/Amazon/AmazonSpApiClient.php',
	'dtb-integrations/Amazon/AmazonOrdersService.php',
	'dtb-integrations/Amazon/AmazonMessagingService.php',
	'dtb-integrations/Amazon/AmazonNotificationsService.php',
	'dtb-integrations/Amazon/AmazonHealthCheck.php',
	'dtb-integrations/Amazon/AmazonWebhookController.php',
] );

// 9) eBay module.
dtb_integrations_require_files( [
	'dtb-integrations/Ebay/EbayConfig.php',
	'dtb-integrations/Ebay/EbayOAuthTokenService.php',
	'dtb-integrations/Ebay/EbayRestClient.php',
	'dtb-integrations/Ebay/EbayFulfillmentService.php',
	'dtb-integrations/Ebay/EbayMessageService.php',
	'dtb-integrations/Ebay/EbayDeletionController.php',
	'dtb-integrations/Ebay/EbayHealthCheck.php',
] );

// 10) Marketplace queue jobs.
dtb_integrations_require_files( [
	'dtb-integrations/Marketplace/Jobs/MarketplaceQueueJobs.php',
] );

// 11) Marketplace REST controllers.
dtb_integrations_require_files( [
	'dtb-integrations/Marketplace/Rest/MarketplaceOverviewController.php',
	'dtb-integrations/Marketplace/Rest/MarketplaceOrdersController.php',
	'dtb-integrations/Marketplace/Rest/MarketplaceMessagesController.php',
	'dtb-integrations/Marketplace/Rest/AmazonMessagingController.php',
	'dtb-integrations/Marketplace/Rest/EbayInboxController.php',
	'dtb-integrations/Marketplace/Rest/MarketplaceExceptionsController.php',
	'dtb-integrations/Marketplace/Rest/MarketplaceSettingsController.php',
] );

// 12) Marketplace admin helpers + pages.
dtb_integrations_require_files( [
	'dtb-integrations/Marketplace/Admin/MarketplaceAdminHelpers.php',
	'dtb-integrations/Marketplace/Admin/MarketplaceOverviewPage.php',
	'dtb-integrations/Marketplace/Admin/MarketplaceOrdersPage.php',
	'dtb-integrations/Marketplace/Admin/MarketplaceMessagesPage.php',
	'dtb-integrations/Marketplace/Admin/AmazonCommunicationPage.php',
	'dtb-integrations/Marketplace/Admin/EbayInboxPage.php',
	'dtb-integrations/Marketplace/Admin/MarketplaceExceptionsPage.php',
	'dtb-integrations/Marketplace/Admin/MarketplaceSettingsPage.php',
] );

// Register structured integration diagnostics with platform health registry.
dtb_integrations_register_health_checks();
