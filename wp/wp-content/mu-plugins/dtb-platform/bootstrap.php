<?php
/**
 * DTB Platform Bootstrap
 *
 * Loads all platform modules in dependency order.
 * This file is required by dtb-platform.php (via 00-dtb-loader.php).
 *
 * Load order:
 *   1. Config      — constants, feature flags, runtime config
 *   2. Support     — low-level utility functions (no WP hook registrations)
 *   3. Security    — CORS, API security, frontend/admin security
 *   4. Auth        — JWT, session, auth routes
 *   5. Cache       — transient cache, headers, invalidation
 *   6. Health      — API health monitor
 *   7. Observability — metrics, ops dashboard, order operations
 *   8. Rest        — route registration, proxy routes
 *
 * @package drywall-toolbox
 */

defined( 'ABSPATH' ) || exit;

$_dtb_platform = __DIR__;

// =============================================================================
// 1. CONFIG
// =============================================================================
require_once $_dtb_platform . '/Config/Constants.php';
require_once $_dtb_platform . '/Config/Environment.php';
require_once $_dtb_platform . '/Config/FeatureFlags.php';
require_once $_dtb_platform . '/Config/RuntimeConfig.php';

// =============================================================================
// 2. SUPPORT
// =============================================================================
require_once $_dtb_platform . '/Support/Http.php';
require_once $_dtb_platform . '/Support/Arr.php';
require_once $_dtb_platform . '/Support/Json.php';
require_once $_dtb_platform . '/Support/Sanitize.php';
require_once $_dtb_platform . '/Support/Url.php';
require_once $_dtb_platform . '/Support/Str.php';
require_once $_dtb_platform . '/Support/DateTime.php';
require_once $_dtb_platform . '/Support/Money.php';

// =============================================================================
// 3. SECURITY
// =============================================================================
require_once $_dtb_platform . '/Security/OriginAllowlist.php';
require_once $_dtb_platform . '/Security/ApiSecurity.php';
require_once $_dtb_platform . '/Security/FrontendSecurity.php';
require_once $_dtb_platform . '/Security/AdminSecurity.php';
require_once $_dtb_platform . '/Security/CorsPolicy.php';
require_once $_dtb_platform . '/Security/RateLimiter.php';
require_once $_dtb_platform . '/Security/CapabilityService.php';
require_once $_dtb_platform . '/Security/NonceController.php';
require_once $_dtb_platform . '/Security/NonceGuard.php';
require_once $_dtb_platform . '/Security/PermissionGuard.php';
require_once $_dtb_platform . '/Security/RequestFingerprint.php';

// =============================================================================
// 4. AUTH
// =============================================================================
require_once $_dtb_platform . '/Auth/JwtService.php';
require_once $_dtb_platform . '/Auth/SessionService.php';
require_once $_dtb_platform . '/Auth/CurrentUserResolver.php';
require_once $_dtb_platform . '/Auth/TokenService.php';
require_once $_dtb_platform . '/Auth/AuthController.php';
require_once $_dtb_platform . '/Auth/AuthRoutes.php';

// =============================================================================
// 5. CACHE
// =============================================================================
require_once $_dtb_platform . '/Cache/CacheKeyBuilder.php';
require_once $_dtb_platform . '/Cache/CacheService.php';
require_once $_dtb_platform . '/Cache/CacheHeaders.php';
require_once $_dtb_platform . '/Cache/CacheInvalidationService.php';
require_once $_dtb_platform . '/Cache/CacheAdminPage.php';

// =============================================================================
// 6. HEALTH
// =============================================================================
require_once $_dtb_platform . '/Health/HealthRegistry.php';
require_once $_dtb_platform . '/Health/DependencyHealthCheck.php';
require_once $_dtb_platform . '/Health/ApiHealthController.php';
require_once $_dtb_platform . '/Health/ApiHealthMonitor.php';

// =============================================================================
// 7. OBSERVABILITY
// =============================================================================
require_once $_dtb_platform . '/Observability/Logger.php';
require_once $_dtb_platform . '/Observability/EventLogger.php';
require_once $_dtb_platform . '/Observability/Diagnostics.php';
require_once $_dtb_platform . '/Observability/AdminNoticeService.php';
require_once $_dtb_platform . '/Observability/Metrics.php';
require_once $_dtb_platform . '/Observability/OpsAuditLog.php';
require_once $_dtb_platform . '/Observability/OrderOperationsPermissionService.php';
require_once $_dtb_platform . '/Observability/OrderOperationsAssetManager.php';
require_once $_dtb_platform . '/Observability/OrderOperationsQueueInspector.php';
require_once $_dtb_platform . '/Observability/OrderOperationsDashboard.php';
require_once $_dtb_platform . '/Observability/OrderOperationsController.php';
require_once $_dtb_platform . '/Observability/OrderOperationsAuditService.php';
require_once $_dtb_platform . '/Observability/OpsDashboard.php';
require_once $_dtb_platform . '/Observability/OrderOperationsKpiService.php';

// =============================================================================
// 8. REST
// =============================================================================
require_once $_dtb_platform . '/Rest/AbstractRestController.php';
require_once $_dtb_platform . '/Rest/RestSchema.php';
require_once $_dtb_platform . '/Rest/RestResponseFactory.php';
require_once $_dtb_platform . '/Rest/RestRouteRegistrar.php';
require_once $_dtb_platform . '/Rest/OpsAuditController.php';
require_once $_dtb_platform . '/Rest/OpsOrderOverviewController.php';
require_once $_dtb_platform . '/Rest/OpsLocalQueueController.php';
require_once $_dtb_platform . '/Rest/OpsProductOrdersController.php';
require_once $_dtb_platform . '/Rest/OpsRepairOrdersController.php';
require_once $_dtb_platform . '/Rest/OpsSettingsController.php';
require_once $_dtb_platform . '/Rest/ProxyRoutes.php';

unset( $_dtb_platform );
