# DTB MU-Plugins Next Migration Wave: Platform Hardening + Catalog Platform Completion

## 1. Objective

This document defines the next migration wave for `wp/wp-content/mu-plugins/`, focused on:

1. final-hardening the already migrated `dtb-platform/` module; and
2. completing the true production migration of `dtb-catalog-platform/`.

The prior migration wave substantially completed true code ownership transfer for:

```text
wp/wp-content/mu-plugins/dtb-platform/
wp/wp-content/mu-plugins/dtb-order-platform/
wp/wp-content/mu-plugins/dtb-repair-service/
```

This next wave must not reintroduce root-file implementation ownership, `Legacy/` runtime delegation, wrapper-only files, duplicate route registration, or placeholder files.

The required end state is:

```text
00-dtb-loader.php
  -> module bootstrap
    -> real module-layer files
      -> production implementation
```

Forbidden end state:

```text
module bootstrap
  -> module-layer file
    -> Legacy/*.php
      -> production implementation
```

---

## 2. Current Audit Summary

### 2.1 Composition Root

`00-dtb-loader.php` is already operating as the composition root and loads module bootstraps in bounded-module order.

Required invariant:

```text
00-dtb-loader.php may load module bootstraps only.
It must not directly load business files, root legacy files, or order-operation shims.
```

### 2.2 `dtb-platform/` Current State

`dtb-platform/bootstrap.php` currently loads internal files directly across:

```text
Config/
Support/
Security/
Auth/
Cache/
Health/
Observability/
Rest/
```

This is the correct module bootstrap shape.

Platform is considered **production-aligned**, but this wave must harden it by verifying:

```text
no Legacy/ dependency exists inside dtb-platform/
no root dtb-*.php dependency exists inside dtb-platform/
all platform root shims are no-op only
all platform routes/admin pages still register once
Ops Dashboard behavior is preserved
Order Operations behavior is preserved
```

### 2.3 `dtb-catalog-platform/` Current State

`dtb-catalog-platform/bootstrap.php` is partially modular and already loads many internal files directly.

Current real module areas include:

```text
Domain/ProductMeta.php
Domain/ToolFamilies.php
Domain/ToolsetData.php
Services/BrandNormalizer.php
Services/CategoryNormalizer.php
Services/ToolFamilyResolver.php
Services/CatalogProductNormalizer.php
Infrastructure/CatalogProductRepository.php
Services/VariationReadModelService.php
Services/DefaultVariationResolver.php
Services/CatalogFacetService.php
Services/ToolsetEligibilityService.php
Services/ToolsetValidationService.php
Rest/CatalogFacetsController.php
Rest/CatalogProductsController.php
Rest/ProductDetailController.php
Rest/CompatiblePartsController.php
Rest/ToolsetTemplatesController.php
Rest/ToolsetOptionsController.php
Rest/ToolsetValidationController.php
Validation/*
Admin/MetaBackfillTool.php
Admin/CatalogHealthPage.php
Application/ResolveCompatibleParts.php
```

However, the catalog platform is still **not final-production migrated** because major admin tools and procedural logic are still concentrated in large files and are not split into the final layered ownership model.

Primary issues:

```text
CatalogHealthPage.php is still a large procedural admin implementation.
ResolveCompatibleParts.php is still a large procedural Product Mapping implementation.
dtb-catalog-platform/bootstrap.php still owns runtime hook wiring directly.
Root shims dtb-catalog-health.php and dtb-product-mapping.php still load catalog bootstrap.
Catalog Admin/Application/Infrastructure boundaries are incomplete.
CatalogHealthPage and Product Mapping logic require further extraction into real module-layer files.
```

This is acceptable as transitional state only. This next wave must complete the catalog-platform extraction.

---

## 3. Migration Rules

### 3.1 Preserve Behavior Exactly

Do not change public behavior while moving code.

Preserve:

```text
REST route paths
REST response shapes
AJAX action names
admin menu slugs
submenu parent slugs
nonce names
capability checks
registered product meta keys
WooCommerce REST `dtb_meta` injection shape
catalog cache invalidation hooks
toolset template seed behavior
product mapping behavior
catalog health diagnostics behavior
catalog CSV export behavior
variable product diagnostics
DTB meta diagnostics
facet/cache rebuild behavior
compatible parts behavior
upsells/cross-sells mapping behavior
```

### 3.2 No Rewrite From Scratch

Existing working PHP code is official source behavior. Extract it, split it, and re-house it. Do not replace it with a new platform unless every existing contract is preserved.

### 3.3 No Legacy Runtime Ownership

After this wave:

```text
dtb-platform/ must not load Legacy/.
dtb-catalog-platform/ must not load Legacy/.
No production catalog/platform file may require a root dtb-*.php file.
```

### 3.4 No Duplicate Registration

Each hook, route, admin menu, AJAX action, and meta registration must be registered once.

Avoid duplicate registrations caused by:

```text
root shim + module bootstrap both loading implementation
CatalogHealthPage and new extracted files both registering same AJAX actions
Product Mapping monolith and extracted files both registering same AJAX actions
multiple bootstrap calls from root shims
```

### 3.5 Root Shims Are No-Op Only

Root files such as:

```text
dtb-catalog-health.php
dtb-product-mapping.php
```

must become no-op deployment-compatibility shims after the implementation is fully owned by module-layer files.

Accepted shim pattern:

```php
<?php
/**
 * Legacy shim. Real implementation moved to dtb-catalog-platform/bootstrap.php.
 * Remove after deployment verification window.
 */
defined( 'ABSPATH' ) || exit;
```

Root shims must not call module bootstraps long-term because WordPress MU loading can cause redundant include attempts if root files are auto-loaded by the host environment.

---

## 4. `dtb-platform/` Hardening Scope

`dtb-platform/` does not need a full rewrite. It needs final migration hardening.

### 4.1 Required Validation

Verify the following files contain real implementation and no pass-through legacy delegation:

```text
Auth/AuthController.php
Auth/AuthRoutes.php
Auth/CurrentUserResolver.php
Auth/JwtService.php
Auth/SessionService.php
Auth/TokenService.php
Cache/CacheAdminPage.php
Cache/CacheHeaders.php
Cache/CacheInvalidationService.php
Cache/CacheKeyBuilder.php
Cache/CacheService.php
Config/Constants.php
Config/Environment.php
Config/FeatureFlags.php
Config/RuntimeConfig.php
Health/ApiHealthController.php
Health/ApiHealthMonitor.php
Health/DependencyHealthCheck.php
Health/HealthRegistry.php
Observability/AdminNoticeService.php
Observability/Diagnostics.php
Observability/EventLogger.php
Observability/Logger.php
Observability/Metrics.php
Observability/OpsAuditLog.php
Observability/OpsDashboard.php
Observability/OrderOperationsAssetManager.php
Observability/OrderOperationsAuditService.php
Observability/OrderOperationsController.php
Observability/OrderOperationsDashboard.php
Observability/OrderOperationsKpiService.php
Observability/OrderOperationsPermissionService.php
Observability/OrderOperationsQueueInspector.php
Rest/AbstractRestController.php
Rest/OpsAuditController.php
Rest/OpsLocalQueueController.php
Rest/OpsOrderOverviewController.php
Rest/OpsProductOrdersController.php
Rest/OpsRepairOrdersController.php
Rest/OpsSettingsController.php
Rest/ProxyRoutes.php
Rest/RestResponseFactory.php
Rest/RestRouteRegistrar.php
Rest/RestSchema.php
Security/*
Support/*
```

### 4.2 Ops Dashboard Preservation Requirements

Preserve:

```text
admin slug: dtb-ops
nonce: dtb_ops_nonce
AJAX actions: wp_ajax_dtb_ops_kpis, wp_ajax_dtb_ops_audit_log
Order Operations dashboard route/page behavior
Ops audit log table/install behavior
KPI response shape
capability checks
asset enqueue behavior
polling behavior
operator audit writes
queue inspection behavior
```

### 4.3 Platform Acceptance Criteria

`dtb-platform/` is complete when:

```text
[ ] bootstrap loads only internal platform files.
[ ] no platform file contains `/Legacy/`.
[ ] no platform file requires root dtb-*.php files.
[ ] root platform shims are no-op only.
[ ] DTB Ops dashboard loads.
[ ] Order Operations dashboard loads.
[ ] platform REST routes register.
[ ] auth/session/JWT behavior remains compatible.
[ ] CORS/origin/rate-limit/security behavior remains compatible.
[ ] cache admin and cache invalidation behavior remain compatible.
```

---

## 5. `dtb-catalog-platform/` Completion Scope

The catalog platform is the main target of this wave.

### 5.1 Required Final Structure

The target structure is:

```text
dtb-catalog-platform/
├─ bootstrap.php
├─ Admin/
│  ├─ CatalogAdminMenu.php
│  ├─ CatalogHealthActions.php
│  ├─ CatalogHealthPage.php
│  ├─ CatalogHealthRenderer.php
│  ├─ CatalogToolsPage.php
│  ├─ MetaBackfillTool.php
│  ├─ ProductMappingActions.php
│  ├─ ProductMappingPage.php
│  └─ ProductMappingRenderer.php
├─ Application/
│  ├─ BackfillProductMeta.php
│  ├─ BuildCatalogFacets.php
│  ├─ NormalizeCatalogProduct.php
│  ├─ RegisterCatalogHooks.php
│  ├─ RegisterCatalogMeta.php
│  ├─ RegisterCatalogRoutes.php
│  ├─ ResolveCompatibleParts.php
│  ├─ ResolveDefaultVariation.php
│  ├─ RunCatalogHealthScan.php
│  ├─ RunProductMappingMutation.php
│  └─ ValidateCatalogProduct.php
├─ Domain/
│  ├─ Brand.php
│  ├─ CatalogProduct.php
│  ├─ CatalogHealthIssue.php
│  ├─ ProductMeta.php
│  ├─ ProductVariation.php
│  ├─ ToolFamily.php
│  ├─ ToolFamilies.php
│  └─ ToolsetData.php
├─ Infrastructure/
│  ├─ CatalogCache.php
│  ├─ CatalogHealthRepository.php
│  ├─ CatalogProductRepository.php
│  ├─ ProductRelationshipRepository.php
│  ├─ ProductVariationRepository.php
│  ├─ WooProductRepository.php
│  └─ WordPressProductMetaStore.php
├─ Rest/
│  ├─ CatalogFacetsController.php
│  ├─ CatalogProductsController.php
│  ├─ CompatiblePartsController.php
│  ├─ ProductDetailController.php
│  ├─ ToolsetOptionsController.php
│  ├─ ToolsetTemplatesController.php
│  └─ ToolsetValidationController.php
├─ Services/
│  ├─ BrandNormalizer.php
│  ├─ CatalogFacetService.php
│  ├─ CatalogHealthService.php
│  ├─ CatalogProductNormalizer.php
│  ├─ CategoryNormalizer.php
│  ├─ CompatiblePartsService.php
│  ├─ DefaultVariationResolver.php
│  ├─ ProductLookupService.php
│  ├─ ProductMappingService.php
│  ├─ ProductRelationshipService.php
│  ├─ ToolFamilyResolver.php
│  ├─ ToolsetEligibilityService.php
│  ├─ ToolsetValidationService.php
│  └─ VariationReadModelService.php
└─ Validation/
   ├─ CatalogValidationService.php
   ├─ ImageValidator.php
   ├─ PricingValidator.php
   ├─ ProductMappingValidator.php
   ├─ ProductMetaValidator.php
   ├─ SeoValidator.php
   ├─ ToolsetEligibilityValidator.php
   └─ VariationValidator.php
```

Do not create empty placeholders. Create a file only when it owns extracted real behavior.

---

## 6. Catalog Health Migration

### 6.1 Current Source

Current source file:

```text
wp/wp-content/mu-plugins/dtb-catalog-platform/Admin/CatalogHealthPage.php
```

Current responsibilities include:

```text
admin menu registration
admin asset enqueueing
inline JavaScript for scan/meta scan/cache flush
page rendering
AJAX action registration
variable product health scan
DTB meta health scan
cache flush action
CSV export action
HTML result rendering
CSV generation
capability checks
nonce checks
WooCommerce product queries
issue severity classification
```

### 6.2 Target Extraction

Extract into:

```text
Admin/CatalogHealthPage.php
  Owns page registration and top-level page callback only.

Admin/CatalogHealthActions.php
  Owns AJAX action registration and request dispatch.

Admin/CatalogHealthRenderer.php
  Owns HTML rendering helpers and CSV rendering helpers.

Application/RunCatalogHealthScan.php
  Owns scan orchestration use-case.

Domain/CatalogHealthIssue.php
  Owns issue shape/severity constants if useful.

Infrastructure/CatalogHealthRepository.php
  Owns WooCommerce/WP queries used by health scans.

Services/CatalogHealthService.php
  Owns issue detection, severity classification, and scan summaries.

Validation/ProductMetaValidator.php
Validation/VariationValidator.php
  Own detailed validation rules where applicable.
```

### 6.3 Preserved Contracts

Preserve exactly:

```text
admin page slug: dtb-catalog-health
parent menu behavior: dtb-ops when available, fallback top-level menu when not
capability: DTB_CAP_CATALOG
nonce action: dtb_catalog_health
AJAX actions:
  wp_ajax_dtb_catalog_health_scan
  wp_ajax_dtb_catalog_health_meta_scan
  wp_ajax_dtb_catalog_health_flush
  wp_ajax_dtb_catalog_health_export_csv
CSV export behavior
button labels and basic admin UX
cache flush behavior using dtb_invalidate_product_cache()
cache event logging using dtb_log_cache_event()
```

---

## 7. Product Mapping / Compatible Parts Migration

### 7.1 Current Source

Current source file:

```text
wp/wp-content/mu-plugins/dtb-catalog-platform/Application/ResolveCompatibleParts.php
```

Despite its filename, it currently owns a large Product Mapping admin tool.

Current responsibilities include:

```text
DTB Tools top-level menu fallback
Product Mapping submenu
product search AJAX
variable product management AJAX
variation creation/linking logic
product attribute management
parts compatibility mapping
upsell/cross-sell mapping
WooCommerce product relationship mutations
admin page rendering
nonce and capability checks
```

### 7.2 Target Extraction

Extract into:

```text
Admin/ProductMappingPage.php
  Owns submenu registration and page callback.

Admin/ProductMappingActions.php
  Owns AJAX action registration and request dispatch.

Admin/ProductMappingRenderer.php
  Owns HTML/CSS/JS page rendering helpers.

Application/ResolveCompatibleParts.php
  Owns compatible-parts resolution use-case only.

Application/RunProductMappingMutation.php
  Owns mutation orchestration for variable/variation/product relationship operations.

Infrastructure/ProductRelationshipRepository.php
  Owns upsell, cross-sell, and compatible-parts relationship persistence.

Infrastructure/ProductVariationRepository.php
  Owns variable product and variation queries/mutations.

Services/CompatiblePartsService.php
  Owns compatible parts mapping logic.

Services/ProductMappingService.php
  Owns product mapping business logic.

Services/ProductRelationshipService.php
  Owns upsell/cross-sell service operations.

Validation/ProductMappingValidator.php
  Owns request validation, IDs, product types, attributes, SKU constraints, and mutation permissions.
```

### 7.3 Preserved Contracts

Preserve exactly:

```text
admin parent slug: dtb-toolbox
admin page slug: dtb-product-mapping
capability: manage_woocommerce
nonce action/name: dtb_mapping_nonce
AJAX action names currently used by the Product Mapping UI
product search response shape
variable product listing response shape
variation mutation response shapes
compatible-parts response shape
upsell/cross-sell response shape
WooCommerce product relationship meta behavior
```

### 7.4 Rename Clarification

`Application/ResolveCompatibleParts.php` should not remain the owner of the entire Product Mapping admin UI.

Final responsibility:

```text
ResolveCompatibleParts.php = compatible-parts use-case only.
ProductMappingPage/Actions/Renderer = admin UI.
ProductMappingService/ProductRelationshipService = business logic.
Repositories = WordPress/WooCommerce persistence.
```

---

## 8. Catalog Bootstrap Refactor

### 8.1 Current Problem

`dtb-catalog-platform/bootstrap.php` currently does too much direct runtime wiring.

It directly registers:

```text
toolset seeding hook
product meta registration hook
WooCommerce REST dtb_meta filters
REST controller registration hook
catalog cache invalidation hooks
WooCommerce product event invalidation hooks
product import invalidation hooks
trash/untrash invalidation hooks
```

This works, but the bootstrap should become a composition file rather than a business hook owner.

### 8.2 Target Refactor

Move direct hook registration into:

```text
Application/RegisterCatalogHooks.php
Application/RegisterCatalogMeta.php
Application/RegisterCatalogRoutes.php
Infrastructure/CatalogCache.php
Infrastructure/WordPressProductMetaStore.php
```

Final bootstrap responsibility:

```text
require files in dependency order
call one module registration function if needed
avoid inline hook business logic
```

### 8.3 Preserved Contracts

Preserve:

```text
DTB_CATALOG_PLATFORM_ENABLED staged rollout behavior
admin/REST/WP-CLI guard behavior
dtb_catalog_register_meta() global wrapper if used externally
dtb_catalog_inject_meta_rest() global wrapper if used externally
dtb_catalog_platform_register_routes() global wrapper if used externally
dtb_catalog_invalidate_all_caches() global wrapper if used externally
WooCommerce REST dtb_meta shape
all cache invalidation hooks
```

---

## 9. Root Shim Policy for This Wave

After catalog extraction, update these files to no-op shims:

```text
wp/wp-content/mu-plugins/dtb-catalog-health.php
wp/wp-content/mu-plugins/dtb-product-mapping.php
```

Accepted contents:

```php
<?php
/**
 * Legacy shim. Real implementation moved to dtb-catalog-platform/bootstrap.php.
 * Remove after deployment verification window.
 */
defined( 'ABSPATH' ) || exit;
```

Do not leave root shim files actively loading `dtb-catalog-platform/bootstrap.php` after final extraction unless a deployment compatibility test proves it is still required.

---

## 10. Required Verification

### 10.1 Platform Verification

```text
[ ] DTB Ops menu appears for authorized operators.
[ ] Order Operations dashboard loads.
[ ] Ops audit log loads.
[ ] Ops dashboard AJAX actions work.
[ ] Ops REST controllers respond with compatible shapes.
[ ] Auth routes still work.
[ ] JWT/session behavior remains compatible.
[ ] CORS/origin/rate limit behavior remains compatible.
[ ] Cache admin page still loads.
```

### 10.2 Catalog Verification

```text
[ ] Catalog REST routes register.
[ ] Product detail route returns compatible response shape.
[ ] Catalog facets route returns compatible response shape.
[ ] Compatible parts route returns compatible response shape.
[ ] Toolset templates/options/validation routes work.
[ ] WooCommerce REST products include dtb_meta.
[ ] DTB product meta fields are registered.
[ ] Product save invalidates catalog caches.
[ ] Product import invalidates catalog caches.
[ ] Catalog Health page loads.
[ ] Catalog Health scan AJAX works.
[ ] DTB Meta scan AJAX works.
[ ] Catalog Health flush AJAX works.
[ ] Catalog Health CSV export works.
[ ] Product Mapping page loads.
[ ] Product search AJAX works.
[ ] Variable product tab works.
[ ] Parts Compatibility tab works.
[ ] Upsells/Cross-sells tab works.
[ ] Variation creation/linking behavior remains compatible.
```

### 10.3 Architecture Verification

```text
[ ] No dtb-platform file references Legacy/.
[ ] No dtb-catalog-platform file references Legacy/.
[ ] No dtb-platform file requires root dtb-*.php.
[ ] No dtb-catalog-platform file requires root dtb-*.php.
[ ] No root catalog shim contains hook/route/admin/business logic.
[ ] No duplicate AJAX actions are registered.
[ ] No duplicate admin pages are registered.
[ ] No duplicate REST routes are registered.
[ ] No placeholder-only files exist.
```

---

## 11. Implementation Sequence

### Phase 1 — Platform Hardening

```text
[ ] Verify all dtb-platform files are real implementation files.
[ ] Verify no Legacy or root require remains.
[ ] Verify platform root shims are no-op.
[ ] Verify Ops Dashboard and Order Operations contracts.
[ ] Keep platform code stable unless a real defect is found.
```

### Phase 2 — Catalog Health Extraction

```text
[ ] Read full Admin/CatalogHealthPage.php.
[ ] Inventory all functions, AJAX actions, page rendering helpers, scan functions, CSV functions, and cache flush functions.
[ ] Extract request/action handling into Admin/CatalogHealthActions.php.
[ ] Extract rendering into Admin/CatalogHealthRenderer.php.
[ ] Extract scan use-case into Application/RunCatalogHealthScan.php.
[ ] Extract query logic into Infrastructure/CatalogHealthRepository.php.
[ ] Extract issue classification into Services/CatalogHealthService.php.
[ ] Keep compatibility wrappers for existing function names.
[ ] Ensure CatalogHealthPage.php only registers/admin-renders page shell.
```

### Phase 3 — Product Mapping Extraction

```text
[ ] Read full Application/ResolveCompatibleParts.php.
[ ] Inventory all AJAX actions and mutation workflows.
[ ] Extract admin page shell into Admin/ProductMappingPage.php.
[ ] Extract action dispatch into Admin/ProductMappingActions.php.
[ ] Extract page rendering into Admin/ProductMappingRenderer.php.
[ ] Extract compatible parts logic into Services/CompatiblePartsService.php and Application/ResolveCompatibleParts.php.
[ ] Extract product relationship logic into Services/ProductRelationshipService.php and Infrastructure/ProductRelationshipRepository.php.
[ ] Extract variable/variation logic into Services/ProductMappingService.php and Infrastructure/ProductVariationRepository.php.
[ ] Extract request validation into Validation/ProductMappingValidator.php.
[ ] Preserve all existing AJAX response shapes.
```

### Phase 4 — Catalog Bootstrap Cleanup

```text
[ ] Move meta registration into Application/RegisterCatalogMeta.php or WordPressProductMetaStore.php.
[ ] Move REST route registration into Application/RegisterCatalogRoutes.php.
[ ] Move cache invalidation hook registration into Application/RegisterCatalogHooks.php.
[ ] Keep global wrappers where required.
[ ] Reduce bootstrap to require-order composition only.
```

### Phase 5 — Root Shim Cleanup

```text
[ ] Convert dtb-catalog-health.php to no-op shim.
[ ] Convert dtb-product-mapping.php to no-op shim.
[ ] Confirm no duplicate bootstrap loading occurs.
```

### Phase 6 — Verification

```text
[ ] Run PHP lint locally.
[ ] Verify platform pages/routes in staging.
[ ] Verify catalog REST routes in staging.
[ ] Verify Product Mapping workflows in staging.
[ ] Verify Catalog Health workflows in staging.
[ ] Confirm no duplicate registration warnings/errors.
```

---

## 12. Acceptance Criteria

This next wave is complete only when:

```text
1. dtb-platform remains production-aligned and has no regression.
2. dtb-catalog-platform has no Legacy/ runtime dependency.
3. dtb-catalog-platform has no root dtb-*.php runtime dependency.
4. CatalogHealthPage.php is no longer a monolithic owner of all catalog health logic.
5. ResolveCompatibleParts.php is no longer a monolithic Product Mapping admin tool.
6. Catalog Health admin workflows still work.
7. Product Mapping admin workflows still work.
8. Catalog REST routes still work.
9. WooCommerce dtb_meta injection still works.
10. Catalog cache invalidation still works.
11. Root catalog shims are no-op only or removed after verification.
12. No placeholders, wrapper-only files, duplicate registrations, or missing compatibility wrappers exist.
```

---

## 13. Agent Implementation Prompt

Use this prompt for the implementation agent:

```text
You are DTB’s principal mu-plugin migration implementation agent. Read docs/mu-plugins-platform-catalog-next-wave.md and docs/mu-plugins-migration.md as binding implementation specifications. Implement code migration only; do not add scripts, reports, or documentation-only changes.

Scope this wave to dtb-platform hardening and dtb-catalog-platform completion. Treat all existing platform/catalog PHP as official working source behavior. Preserve every global function, hook, filter, REST route, AJAX action, admin slug, nonce, capability check, option, meta key, WooCommerce REST response shape, cache invalidation hook, product mapping workflow, catalog health workflow, and runtime behavior.

For dtb-platform, verify and harden the completed module without rewriting stable behavior. Do not reintroduce Legacy/ or root dtb-*.php dependencies.

For dtb-catalog-platform, fully extract monolithic Catalog Health and Product Mapping logic into bounded module-layer files. Split CatalogHealthPage.php into page, actions, renderer, application scan use-case, repository, and service files. Split ResolveCompatibleParts.php into compatible-parts use-case, Product Mapping admin page/actions/renderer, product mapping service, relationship service, repositories, and validators. Refactor catalog bootstrap so it composes files and delegates hook/meta/route/cache registration to module-layer files.

No production file under dtb-platform or dtb-catalog-platform may load Legacy/ or root dtb-*.php files. Root catalog shims must become no-op only after implementation is fully moved. Preserve compatibility wrappers until all call sites are safely migrated. Avoid duplicate hooks, AJAX actions, REST routes, admin pages, and function declarations. Verify zero regressions.
```
