Below is the final target production architecture tree for wp/wp-content/mu-plugins/.

This is the structure the repo should move toward. The current rebuild document already confirms that the present state is hybrid/root-heavy and that the production target is bounded module folders loaded by 00-dtb-loader.php, not long-term root-level business files.  ￼ The target root policy is that root should contain only the loader, README/index, host-provided mu-plugins, and module folders.  ￼

⸻

Final Production MU-Plugins Architecture Tree

wp/wp-content/mu-plugins/
├─ 00-dtb-loader.php
├─ README.md
├─ index.php
│
├─ dtb-platform/
│  ├─ bootstrap.php
│  │
│  ├─ Auth/
│  │  ├─ AuthController.php
│  │  ├─ AuthRoutes.php
│  │  ├─ CurrentUserResolver.php
│  │  ├─ JwtService.php
│  │  ├─ SessionService.php
│  │  └─ TokenService.php
│  │
│  ├─ Cache/
│  │  ├─ CacheAdminPage.php
│  │  ├─ CacheHeaders.php
│  │  ├─ CacheInvalidationService.php
│  │  ├─ CacheKeyBuilder.php
│  │  └─ CacheService.php
│  │
│  ├─ Config/
│  │  ├─ Constants.php
│  │  ├─ Environment.php
│  │  ├─ FeatureFlags.php
│  │  └─ RuntimeConfig.php
│  │
│  ├─ Health/
│  │  ├─ ApiHealthController.php
│  │  ├─ ApiHealthMonitor.php
│  │  ├─ DependencyHealthCheck.php
│  │  └─ HealthRegistry.php
│  │
│  ├─ Observability/
│  │  ├─ AdminNoticeService.php
│  │  ├─ Diagnostics.php
│  │  ├─ EventLogger.php
│  │  ├─ Logger.php
│  │  ├─ Metrics.php
│  │  ├─ OpsAuditLog.php
│  │  ├─ OpsDashboard.php
│  │  ├─ OrderOperationsDashboard.php
│  │  ├─ OrderOperationsController.php
│  │  ├─ OrderOperationsKpiService.php
│  │  ├─ OrderOperationsAuditService.php
│  │  ├─ OrderOperationsQueueInspector.php
│  │  ├─ OrderOperationsPermissionService.php
│  │  └─ OrderOperationsAssetManager.php
│  │
│  ├─ Rest/
│  │  ├─ AbstractRestController.php
│  │  ├─ LegacyProxyRoutes.php
│  │  ├─ RestResponseFactory.php
│  │  ├─ RestRouteRegistrar.php
│  │  ├─ RestSchema.php
│  │  ├─ OpsOrderOverviewController.php
│  │  ├─ OpsProductOrdersController.php
│  │  ├─ OpsRepairOrdersController.php
│  │  ├─ OpsLocalQueueController.php
│  │  ├─ OpsAuditController.php
│  │  └─ OpsSettingsController.php
│  │
│  ├─ Security/
│  │  ├─ AdminSecurity.php
│  │  ├─ ApiSecurity.php
│  │  ├─ CapabilityService.php
│  │  ├─ CorsPolicy.php
│  │  ├─ FrontendSecurity.php
│  │  ├─ NonceController.php
│  │  ├─ NonceGuard.php
│  │  ├─ OriginAllowlist.php
│  │  ├─ PermissionGuard.php
│  │  ├─ RateLimiter.php
│  │  └─ RequestFingerprint.php
│  │
│  └─ Support/
│     ├─ Arr.php
│     ├─ DateTime.php
│     ├─ Http.php
│     ├─ Json.php
│     ├─ Money.php
│     ├─ Sanitize.php
│     ├─ Str.php
│     └─ Url.php
│
├─ dtb-catalog-platform/
│  ├─ bootstrap.php
│  │
│  ├─ Admin/
│  │  ├─ CatalogAdminMenu.php
│  │  ├─ CatalogHealthPage.php
│  │  ├─ CatalogToolsPage.php
│  │  └─ MetaBackfillTool.php
│  │
│  ├─ Application/
│  │  ├─ BackfillProductMeta.php
│  │  ├─ BuildCatalogFacets.php
│  │  ├─ NormalizeCatalogProduct.php
│  │  ├─ ResolveCompatibleParts.php
│  │  ├─ ResolveDefaultVariation.php
│  │  └─ ValidateCatalogProduct.php
│  │
│  ├─ Domain/
│  │  ├─ Brand.php
│  │  ├─ CatalogProduct.php
│  │  ├─ ProductMeta.php
│  │  ├─ ProductVariation.php
│  │  ├─ ToolFamily.php
│  │  ├─ ToolFamilies.php
│  │  └─ ToolsetData.php
│  │
│  ├─ Infrastructure/
│  │  ├─ CatalogCache.php
│  │  ├─ CatalogProductRepository.php
│  │  ├─ WooProductRepository.php
│  │  └─ WordPressProductMetaStore.php
│  │
│  ├─ Rest/
│  │  ├─ CatalogFacetsController.php
│  │  ├─ CatalogProductsController.php
│  │  ├─ CompatiblePartsController.php
│  │  ├─ ProductDetailController.php
│  │  ├─ ToolsetOptionsController.php
│  │  ├─ ToolsetTemplatesController.php
│  │  └─ ToolsetValidationController.php
│  │
│  ├─ Services/
│  │  ├─ BrandNormalizer.php
│  │  ├─ CatalogFacetService.php
│  │  ├─ CatalogProductNormalizer.php
│  │  ├─ CategoryNormalizer.php
│  │  ├─ DefaultVariationResolver.php
│  │  ├─ ProductLookupService.php
│  │  ├─ ToolFamilyResolver.php
│  │  ├─ ToolsetEligibilityService.php
│  │  ├─ ToolsetValidationService.php
│  │  └─ VariationReadModelService.php
│  │
│  └─ Validation/
│     ├─ CatalogValidationService.php
│     ├─ ImageValidator.php
│     ├─ PricingValidator.php
│     ├─ ProductMetaValidator.php
│     ├─ SeoValidator.php
│     ├─ ToolsetEligibilityValidator.php
│     └─ VariationValidator.php
│
├─ dtb-commerce/
│  ├─ bootstrap.php
│  │
│  ├─ Cart/
│  │  ├─ CartController.php
│  │  ├─ CartItemNormalizer.php
│  │  ├─ CartRepository.php
│  │  ├─ CartService.php
│  │  └─ ToolsetCartItemData.php
│  │
│  ├─ Orders/
│  │  ├─ OrderController.php
│  │  ├─ OrderLineMetaService.php
│  │  ├─ OrderMetaService.php
│  │  ├─ OrderReadModel.php
│  │  ├─ OrderService.php
│  │  └─ ToolsetOrderLineMeta.php
│  │
│  ├─ Domain/
│  │  ├─ CartItem.php
│  │  ├─ CommerceMoney.php
│  │  ├─ Customer.php
│  │  ├─ Order.php
│  │  ├─ OrderLineItem.php
│  │  ├─ PaymentState.php
│  │  └─ ToolsetLineItemMeta.php
│  │
│  ├─ Infrastructure/
│  │  ├─ WooCartStore.php
│  │  ├─ WooCustomerRepository.php
│  │  ├─ WooOrderRepository.php
│  │  └─ WooStoreApiClient.php
│  │
│  ├─ Services/
│  │  ├─ CartMetadataService.php
│  │  └─ OrderMetadataService.php
│  │
│  ├─ Rest/
│  │  ├─ CartRestController.php
│  │  ├─ CheckoutRestController.php
│  │  ├─ CouponRestController.php
│  │  └─ OrderRestController.php
│  │
│  └─ Validation/
│     ├─ CartItemValidator.php
│     ├─ CheckoutValidator.php
│     ├─ CouponValidator.php
│     └─ OrderValidator.php
│
├─ dtb-order-platform/
│  ├─ bootstrap.php
│  │
│  ├─ Admin/
│  │  ├─ OrderAdminColumns.php
│  │  ├─ OrderAdminMenu.php
│  │  ├─ OrderBulkActions.php
│  │  ├─ OrderDashboardPanel.php
│  │  ├─ OrderDetailPage.php
│  │  ├─ OrderQueuePanel.php
│  │  ├─ OrderTimelinePanel.php
│  │  ├─ ProductOrderBulkActions.php
│  │  ├─ ProductOrderDashboardPanel.php
│  │  └─ ProductOrderTimelineDrawer.php
│  │
│  ├─ Application/
│  │  ├─ BuildOrderTrackingProjection.php
│  │  ├─ HandlePaymentWebhook.php
│  │  ├─ RefreshOrderProjection.php
│  │  ├─ TransitionOrderStatus.php
│  │  └─ UpdateOrderTracking.php
│  │
│  ├─ Domain/
│  │  ├─ OrderEvent.php
│  │  ├─ OrderLifecycleStatus.php
│  │  ├─ OrderTrackingProjection.php
│  │  └─ OrderTransition.php
│  │
│  ├─ Infrastructure/
│  │  ├─ OrderEventRepository.php
│  │  ├─ OrderIntegrationStateStore.php
│  │  ├─ OrderQueue.php
│  │  ├─ OrderSchemaInstaller.php
│  │  └─ WooOrderStatusStore.php
│  │
│  ├─ Rest/
│  │  ├─ OrderDetailController.php
│  │  ├─ OrderEventStreamController.php
│  │  ├─ OrderHealthController.php
│  │  ├─ OrderListController.php
│  │  └─ OrderTrackingController.php
│  │
│  ├─ Services/
│  │  ├─ OrderOpsProjectionService.php
│  │  ├─ OrderOpsQueryService.php
│  │  ├─ OrderProjectionService.php
│  │  ├─ OrderTrackingUrlService.php
│  │  └─ OrderWorkflowService.php
│  │
│  ├─ Tracking/
│  │  ├─ OrderCustomerTimeline.php
│  │  ├─ OrderEventStream.php
│  │  ├─ OrderOperatorTimeline.php
│  │  └─ OrderStatusProjector.php
│  │
│  ├─ Webhooks/
│  │  ├─ PaymentWebhookController.php
│  │  ├─ PaymentWebhookIdempotency.php
│  │  └─ PaymentWebhookVerifier.php
│  │
│  └─ Validation/
│     ├─ OrderAccessValidator.php
│     ├─ OrderTransitionValidator.php
│     └─ PaymentWebhookValidator.php
│
├─ dtb-repair-service/
│  ├─ bootstrap.php
│  │
│  ├─ Admin/
│  │  ├─ RepairAdminMenu.php
│  │  ├─ RepairBulkActions.php
│  │  ├─ RepairDashboardPanel.php
│  │  ├─ RepairDetailPage.php
│  │  ├─ RepairIntegrationPanel.php
│  │  ├─ RepairListTable.php
│  │  ├─ RepairMetaBoxes.php
│  │  ├─ RepairOrderBulkActions.php
│  │  ├─ RepairOrderDashboardPanel.php
│  │  ├─ RepairOrderTimelineDrawer.php
│  │  ├─ RepairQueuePanel.php
│  │  ├─ RepairSlaPanel.php
│  │  └─ RepairTimelinePanel.php
│  │
│  ├─ Application/
│  │  ├─ AssignRepairTechnician.php
│  │  ├─ AttachRepairMedia.php
│  │  ├─ BuildRepairStatusProjection.php
│  │  ├─ CloseRepairRequest.php
│  │  ├─ CreateRepairQuote.php
│  │  ├─ SubmitRepairRequest.php
│  │  ├─ TransitionRepairStatus.php
│  │  └─ UpdateRepairTracking.php
│  │
│  ├─ Domain/
│  │  ├─ RepairAccessPolicy.php
│  │  ├─ RepairEvent.php
│  │  ├─ RepairMedia.php
│  │  ├─ RepairPolicy.php
│  │  ├─ RepairQuote.php
│  │  ├─ RepairRequest.php
│  │  ├─ RepairStatus.php
│  │  ├─ RepairTimeline.php
│  │  └─ RepairTransition.php
│  │
│  ├─ Infrastructure/
│  │  ├─ RepairEventRepository.php
│  │  ├─ RepairMediaStorage.php
│  │  ├─ RepairMetaRepository.php
│  │  ├─ RepairNotificationDispatcher.php
│  │  ├─ RepairPostType.php
│  │  ├─ RepairQueue.php
│  │  ├─ RepairSchemaInstaller.php
│  │  └─ RepairStatusStore.php
│  │
│  ├─ Rest/
│  │  ├─ RepairEventStreamController.php
│  │  ├─ RepairHealthController.php
│  │  ├─ RepairMediaController.php
│  │  ├─ RepairStatusController.php
│  │  └─ SubmitRepairController.php
│  │
│  ├─ Services/
│  │  ├─ RepairIdempotencyService.php
│  │  ├─ RepairOpsProjectionService.php
│  │  ├─ RepairOpsQueryService.php
│  │  ├─ RepairProjectionService.php
│  │  ├─ RepairPublicTokenService.php
│  │  ├─ RepairSlaService.php
│  │  ├─ RepairWorkflowService.php
│  │  └─ RepairWorkflowTransitionMap.php
│  │
│  ├─ Tracking/
│  │  ├─ RepairCustomerTimeline.php
│  │  ├─ RepairEventStream.php
│  │  ├─ RepairOperatorTimeline.php
│  │  └─ RepairStatusProjector.php
│  │
│  └─ Validation/
│     ├─ RepairAccessValidator.php
│     ├─ RepairMediaValidator.php
│     ├─ RepairStatusTransitionValidator.php
│     └─ RepairSubmitValidator.php
│
├─ dtb-schematics/
│  ├─ bootstrap.php
│  │
│  ├─ Admin/
│  │  ├─ SchematicAdminMenu.php
│  │  ├─ SchematicEditorPage.php
│  │  ├─ SchematicMediaPage.php
│  │  └─ SchematicSyncPage.php
│  │
│  ├─ Application/
│  │  ├─ BuildSchematicManifest.php
│  │  ├─ ResolveSchematicParts.php
│  │  └─ SyncSchematicMedia.php
│  │
│  ├─ Domain/
│  │  ├─ Schematic.php
│  │  ├─ SchematicAsset.php
│  │  ├─ SchematicBrand.php
│  │  └─ SchematicPart.php
│  │
│  ├─ Infrastructure/
│  │  ├─ SchematicManifestRepository.php
│  │  ├─ SchematicMediaRepository.php
│  │  └─ WordPressMediaStore.php
│  │
│  ├─ Rest/
│  │  ├─ SchematicManifestController.php
│  │  ├─ SchematicMediaController.php
│  │  └─ SchematicPartsController.php
│  │
│  ├─ Services/
│  │  ├─ SchematicFallbackResolver.php
│  │  ├─ SchematicMediaService.php
│  │  └─ SchematicPartResolver.php
│  │
│  └─ Validation/
│     ├─ SchematicBrandValidator.php
│     ├─ SchematicManifestValidator.php
│     └─ SchematicMediaValidator.php
│
├─ dtb-media/
│  ├─ README.md
│  ├─ bootstrap.php
│  │
│  ├─ Admin/
│  │  ├─ ImageSyncAdminPage.php
│  │  └─ MediaDiagnosticsPage.php
│  │
│  ├─ Application/
│  │  ├─ LinkImagesToProducts.php
│  │  ├─ PurgeUnlinkedImages.php
│  │  ├─ RegisterProductImages.php
│  │  ├─ ReleaseImageSyncLock.php
│  │  ├─ ResetImageSync.php
│  │  └─ SyncRemoteImage.php
│  │
│  ├─ Infrastructure/
│  │  ├─ ImageSyncRepository.php
│  │  ├─ MediaAttachmentRepository.php
│  │  └─ RemoteImageFetcher.php
│  │
│  ├─ Rest/
│  │  ├─ ImageSyncController.php
│  │  ├─ ImageSyncProgressController.php
│  │  └─ ImageSyncStatusController.php
│  │
│  ├─ Services/
│  │  ├─ ImageNormalizer.php
│  │  ├─ ImageSyncService.php
│  │  ├─ ImageUrlResolver.php
│  │  └─ ProductImageLinker.php
│  │
│  └─ Validation/
│     ├─ ImageMimeValidator.php
│     ├─ ImagePathValidator.php
│     └─ RemoteImageValidator.php
│
├─ dtb-marketing/
│  ├─ bootstrap.php
│  │
│  ├─ ComingSoon/
│  │  ├─ ComingSoonAdminPage.php
│  │  ├─ ComingSoonController.php
│  │  ├─ ComingSoonSubscriberRepository.php
│  │  └─ SubscriberExportService.php
│  │
│  ├─ Seo/
│  │  ├─ ProductSeoController.php
│  │  ├─ SeoMetaService.php
│  │  └─ SeoRepository.php
│  │
│  └─ Validation/
│     ├─ SeoValidator.php
│     └─ SubscriberValidator.php
│
├─ dtb-integrations/
│  ├─ bootstrap.php
│  │
│  ├─ WooCommerce/
│  │  ├─ ProductLookupService.php
│  │  ├─ ProductWebhookHandler.php
│  │  ├─ RepairOrderService.php
│  │  ├─ WooCommerceBridge.php
│  │  ├─ WooCommerceHealthCheck.php
│  │  └─ WooWebhookManager.php
│  │
│  ├─ Veeqo/
│  │  ├─ VeeqoClient.php
│  │  ├─ VeeqoConfig.php
│  │  ├─ VeeqoHealthCheck.php
│  │  ├─ VeeqoInventoryService.php
│  │  ├─ VeeqoShippingService.php
│  │  ├─ VeeqoSyncJob.php
│  │  └─ VeeqoWebhookController.php
│  │
│  ├─ QuickBooks/
│  │  ├─ QuickBooksClient.php
│  │  ├─ QuickBooksConfig.php
│  │  ├─ QuickBooksCustomerMapper.php
│  │  ├─ QuickBooksHealthCheck.php
│  │  ├─ QuickBooksInvoiceService.php
│  │  ├─ QuickBooksOAuthController.php
│  │  └─ QuickBooksSyncJob.php
│  │
│  ├─ Rewards/
│  │  ├─ ProCareEligibilityService.php
│  │  ├─ RewardsAdjustmentController.php
│  │  ├─ RewardsBalanceController.php
│  │  ├─ RewardsHealthCheck.php
│  │  ├─ RewardsIssueJob.php
│  │  └─ RewardsService.php
│  │
│  └─ Notifications/
│     ├─ EmailTemplateRenderer.php
│     ├─ NotificationDispatcher.php
│     ├─ NotificationJob.php
│     ├─ NotificationTemplateRepository.php
│     └─ SmsGateway.php
│
├─ endurance-page-cache.php
└─ sso.php

⸻

Loader Contract

00-dtb-loader.php should load only module bootstraps:

wp/wp-content/mu-plugins/00-dtb-loader.php
<?php
defined('ABSPATH') || exit;
$_dtb_dir = __DIR__;
_dtb_require($_dtb_dir . '/dtb-platform/bootstrap.php');
_dtb_require($_dtb_dir . '/dtb-catalog-platform/bootstrap.php');
_dtb_require($_dtb_dir . '/dtb-commerce/bootstrap.php');
_dtb_require($_dtb_dir . '/dtb-order-platform/bootstrap.php');
_dtb_require($_dtb_dir . '/dtb-schematics/bootstrap.php');
_dtb_require($_dtb_dir . '/dtb-media/bootstrap.php');
_dtb_require($_dtb_dir . '/dtb-marketing/bootstrap.php');
_dtb_require($_dtb_dir . '/dtb-repair-service/bootstrap.php');
_dtb_require($_dtb_dir . '/dtb-integrations/bootstrap.php');
unset($_dtb_dir);

This matches the current loader direction, which already loads module bootstraps rather than individual root files.  ￼

⸻

Root-Level File Policy

Allowed at root

00-dtb-loader.php
README.md
index.php
endurance-page-cache.php
sso.php
dtb-platform/
dtb-catalog-platform/
dtb-commerce/
dtb-order-platform/
dtb-repair-service/
dtb-schematics/
dtb-media/
dtb-marketing/
dtb-integrations/

Not allowed long term at root

These should be moved into module folders or reduced to temporary compatibility wrappers:

dtb-admin-performance.php
dtb-admin-security.php
dtb-api-health-monitor.php
dtb-api-security.php
dtb-auth.php
dtb-cache-admin.php
dtb-cache.php
dtb-catalog-health.php
dtb-coming-soon.php
dtb-config-reference.php
dtb-frontend-security.php
dtb-image-sync.php
dtb-ops-dashboard.php
dtb-product-mapping.php
dtb-quickbooks.php
dtb-repair-admin.php
dtb-repair-events.php
dtb-repair-notifications.php
dtb-repair-queue.php
dtb-repair-workflows.php
dtb-repairs.php
dtb-rest-api.php
dtb-rewards.php
dtb-schematics-admin.php
dtb-schematics-api.php
dtb-seo.php
dtb-utils.php
dtb-veeqo.php
dtb-woocommerce.php
dtb-order-events.php
dtb-order-workflows.php
dtb-order-queue.php
dtb-order-tracking.php
dtb-payment-webhooks.php
dtb-order-admin.php

The rebuild document explicitly identifies these root-heavy files as the current problem and maps them into bounded modules.  ￼

⸻

Execution note (current repository state)

- The full target directory/file tree above is now present in `wp/wp-content/mu-plugins/`.
- `00-dtb-loader.php` remains the composition root and loads module bootstraps only.
- For legacy runtime parity, module files currently include temporary compatibility wrappers that delegate to existing root DTB files where full extraction is not yet complete.
- Wrapper removal should happen only after each mapped concern is fully implemented in module-native code and smoke checks pass.

⸻

Current-to-Target Mapping

Platform

dtb-utils.php                  -> dtb-platform/Support/*
dtb-auth.php                   -> dtb-platform/Auth/*
dtb-cache.php                  -> dtb-platform/Cache/*
dtb-cache-admin.php            -> dtb-platform/Cache/CacheAdminPage.php
dtb-rest-api.php               -> dtb-platform/Rest/*
dtb-api-security.php           -> dtb-platform/Security/ApiSecurity.php
dtb-frontend-security.php      -> dtb-platform/Security/FrontendSecurity.php
dtb-admin-security.php         -> dtb-platform/Security/AdminSecurity.php
dtb-api-health-monitor.php     -> dtb-platform/Health/*
dtb-admin-performance.php      -> dtb-platform/Observability/Metrics.php
dtb-ops-dashboard.php          -> dtb-platform/Observability/*
dtb-config-reference.php       -> dtb-platform/Config/*

Catalog

dtb-catalog-platform/Admin/*       -> keep
dtb-catalog-platform/Domain/*      -> keep
dtb-catalog-platform/Rest/*        -> keep
dtb-catalog-platform/Services/*    -> keep, but move repositories to Infrastructure/
dtb-catalog-platform/Validation/*  -> keep
dtb-catalog-health.php             -> dtb-catalog-platform/Admin/CatalogHealthPage.php
dtb-product-mapping.php            -> dtb-catalog-platform/Application/ResolveCompatibleParts.php

Commerce

dtb-commerce/Cart/ToolsetCartItemData.php
  -> dtb-commerce/Cart/ToolsetCartItemData.php
dtb-commerce/Orders/ToolsetOrderLineMeta.php
  -> dtb-commerce/Orders/ToolsetOrderLineMeta.php

Product Orders

dtb-order-events.php        -> dtb-order-platform/Infrastructure/OrderEventRepository.php
dtb-order-workflows.php     -> dtb-order-platform/Services/OrderWorkflowService.php
dtb-order-queue.php         -> dtb-order-platform/Infrastructure/OrderQueue.php
dtb-order-tracking.php      -> dtb-order-platform/Tracking/* + Rest/*
dtb-payment-webhooks.php    -> dtb-order-platform/Webhooks/*
dtb-order-admin.php         -> dtb-order-platform/Admin/*

Repairs

dtb-repair-events.php          -> dtb-repair-service/Infrastructure/RepairEventRepository.php
dtb-repair-workflows.php       -> dtb-repair-service/Services/RepairWorkflowService.php
dtb-repair-queue.php           -> dtb-repair-service/Infrastructure/RepairQueue.php
dtb-repair-notifications.php   -> dtb-repair-service/Infrastructure/RepairNotificationDispatcher.php
dtb-repairs.php                -> dtb-repair-service/Infrastructure/RepairPostType.php + Rest/*
dtb-repair-admin.php           -> dtb-repair-service/Admin/*

Schematics

dtb-schematics-api.php      -> dtb-schematics/Rest/*
dtb-schematics-admin.php    -> dtb-schematics/Admin/*

Media

dtb-image-sync.php          -> dtb-media/*
dtb-image-sync.md           -> dtb-media/README.md

Marketing

dtb-coming-soon.php         -> dtb-marketing/ComingSoon/*
dtb-seo.php                 -> dtb-marketing/Seo/*

Integrations

dtb-woocommerce.php         -> dtb-integrations/WooCommerce/*
dtb-veeqo.php               -> dtb-integrations/Veeqo/*
dtb-quickbooks.php          -> dtb-integrations/QuickBooks/*
dtb-rewards.php             -> dtb-integrations/Rewards/*

⸻

Implementation Rule

Final architecture rule:

Root files load modules.
Module bootstraps register hooks.
Admin classes render WP-Admin interfaces.
Rest classes register REST routes.
Application classes coordinate use-cases.
Domain classes define business concepts.
Infrastructure classes touch WordPress/WooCommerce/database/storage.
Services hold reusable business logic.
Tracking classes build customer/operator projections.
Validation classes validate and sanitize inputs.
Webhooks classes receive and verify external callbacks.

This tree is the end-state. If any full business-logic dtb-*.php files remain at root, the migration is incomplete.
