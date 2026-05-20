<!-- markdownlint-disable MD013 MD032 -->

# Drywall Toolbox MU Plugins — Architecture, Wiring, and Operations Blueprint

This document is the **current source-of-truth** for the `wp/wp-content/mu-plugins/` system in this repository.
It reflects the active code in:
- `00-dtb-loader.php`
- all `dtb-*.php` mu-plugins
- `wp/wp-config.php` integration constants

---

## 1) Runtime model and load order

WordPress loads all files in `mu-plugins/` automatically (alphabetical order, no activation UI).

Drywall Toolbox additionally uses `00-dtb-loader.php` to enforce explicit dependency order via `_dtb_require(...)`.

### 1.1 Loader-managed chain (`00-dtb-loader.php`)

`00-dtb-loader.php` is now the composition root and loads only module bootstraps:

1. `dtb-platform/bootstrap.php`
2. `dtb-catalog-platform/bootstrap.php`
3. `dtb-commerce/bootstrap.php`
4. `dtb-order-platform/bootstrap.php`
5. `dtb-schematics/bootstrap.php`
6. `dtb-media/bootstrap.php`
7. `dtb-marketing/bootstrap.php`
8. `dtb-repair-service/bootstrap.php`
9. `dtb-integrations/bootstrap.php`

Each module bootstrap now loads bounded module paths (for example `dtb-platform/Security/ApiSecurity.php` and `dtb-order-platform/Infrastructure/OrderEventRepository.php`).
Where extraction is not yet complete, those module files are temporary compatibility wrappers that delegate to legacy root files.

### 1.2 Compatibility wrappers (temporary)

Wrapper files exist only to preserve runtime behavior while root-heavy files are being extracted into module internals.

Removal criteria:
- The wrapper’s legacy root dependency has been fully moved to module-native code.
- Bootstrap wiring is updated to module-native implementation files.
- Smoke checks confirm routes, admin pages, event ledgers, queues, and tracking projections still function.

Current wrapper-backed legacy roots include:
- `dtb-utils.php`, `dtb-auth.php`, `dtb-cache.php`, `dtb-cache-admin.php`, `dtb-rest-api.php`
- `dtb-api-security.php`, `dtb-frontend-security.php`, `dtb-admin-security.php`
- `dtb-api-health-monitor.php`, `dtb-admin-performance.php`, `dtb-ops-dashboard.php`, `dtb-config-reference.php`
- `dtb-order-events.php`, `dtb-order-workflows.php`, `dtb-order-queue.php`, `dtb-order-tracking.php`, `dtb-payment-webhooks.php`, `dtb-order-admin.php`
- `dtb-repair-events.php`, `dtb-repair-workflows.php`, `dtb-repair-queue.php`, `dtb-repair-notifications.php`, `dtb-repairs.php`, `dtb-repair-admin.php`
- `dtb-image-sync.php`, `dtb-coming-soon.php`, `dtb-seo.php`
- `dtb-woocommerce.php`, `dtb-veeqo.php`, `dtb-quickbooks.php`, `dtb-rewards.php`
- `dtb-product-mapping.php`, `dtb-schematics-api.php`, `dtb-schematics-admin.php`, `dtb-catalog-health.php`
### 1.3 Also auto-loaded by WordPress (outside `_dtb_require` list)

WordPress still scans top-level `*.php` files in `mu-plugins/`. DTB relies on module bootstraps to include legacy files first; subsequent WordPress `include_once` passes are no-ops for already-loaded files.

Host-provided mu-plugins still auto-load directly:

- `endurance-page-cache.php`
- `sso.php`

---

## 2) Core shared primitives

### 2.1 `00-dtb-loader.php`

Defines foundational shared helpers:
- `dtb_feature_enabled(string $constant_name, bool $default = true)`
- `dtb_security_log(string $event, array $context = [])`
- `dtb_allowed_origins()`
- `dtb_check_origin()`

Allowed origins include production, localhost dev origins, and optional `DRYWALL_ALLOWED_ORIGIN` from `wp-config.php`.

### 2.2 `dtb-utils.php`

Primary configuration and helper bridge used throughout suite:
- `dtb_get_config()`
- `dtb_get_wc_credentials()`
- request context helpers (`dtb_is_rest_api_request`, `dtb_is_admin_or_rest_request`, etc.)
- client IP and anonymization helpers
- CSV/catalog resolution (`DTB_WC_CSV_FILENAME` optional override + auto-discovery fallback)

### 2.3 `dtb-cache.php`

Caching and invalidation primitives:
- `dtb_cached_proxy()` read-through transient cache
- `dtb_invalidate_product_cache()`
- cache logging (`dtb_log_cache_event`, `dtb_get_cache_log`)
- ops module cache helpers (`dtb_ops_cache_get`, `dtb_ops_cache_flush`)
- route: `GET /wp-json/dtb/v1/cache/status` (admin/JWT-gated)

---

## 3) REST API surface (current)

### 3.1 `drywall/v1` (from `dtb-rest-api.php`)

Proxy/public-commerce namespace:
- `GET /products`
- `GET /products/slug/{slug}`
- `GET /products/{id}`
- `GET /products/{id}/variations`
- `GET /products/{parent_id}/variations/{id}`
- `GET /categories`
- `GET /attributes`
- `GET /search`
- `POST /orders` (JWT)
- `GET /orders`
- `GET /orders/{id}` (JWT)
- `GET /coupons/{code}`
- `POST /customers`
- `GET /customers/{id}` (JWT)
- `POST /webhooks/products` (webhook receiver)

### 3.2 `dtb/v1` platform routes (multi-module)

From `dtb-rest-api.php`:
- `GET /config`
- `GET /catalog`
- `GET /products-csv`
- `POST /import-catalog`
- `POST /create-app-password`
- `GET|POST /webhooks/ensure`
- `GET /cors-test`
- `POST /contact`

From `dtb-auth.php`:
- `POST /auth/login`
- `DELETE /auth/logout`
- `POST /auth/validate`
- `POST /auth/register`
- `POST /auth/forgot-password`
- `POST /auth/reset-password`

From `dtb-api-security.php`:
- `GET /nonce`

From `dtb-cache.php`:
- `GET /cache/status`

From `dtb-schematics-api.php`:
- `GET /schematics/media`

From `dtb-coming-soon.php`:
- `POST /subscribe`
- `GET /subscribe-nonce`
- `GET /subscribers` (admin)
- `GET /unsubscribe`
- `POST /subscribe/delete` (admin)

From `dtb-image-sync.php`:
- `POST /sync-images`
- `GET /sync-images/status`
- `GET /sync-images/progress`
- `POST /sync-images/link-only`
- `POST /sync-images/reset`
- `POST /sync-images/purge-unlinked`
- `POST /sync-images/fix-renamed`
- `POST /sync-images/release-lock`

From `dtb-rewards.php`:
- `GET /rewards/balance/{id}`
- `GET /rewards/history/{id}`
- `POST /rewards/redeem`
- `POST /rewards/admin/adjust`

From `dtb-veeqo.php`:
- `GET /veeqo/status`
- `POST /veeqo/shipping-rates`
- `GET /veeqo/inventory`
- `POST /veeqo/webhooks/order`
- `POST /repair-request`

From `dtb-quickbooks.php`:
- `GET /qbo/status`
- `POST /qbo/sync`

From `dtb-ops-dashboard.php`:
- `GET /health`

Additional namespace shim:
- `GET /wp-json/wc-admin/profile` (from `dtb-rest-api.php`)

---

## 4) wp-admin wiring blueprint

### 4.1 Admin menus and pages

#### DTB Tools top-level (`dtb-toolbox`)

Provided shared across these tools:
- `dtb-api-health-monitor.php` → **API Health** submenu (`dtb-api-health`)
- `dtb-product-mapping.php` → **Product Mapping** submenu (`dtb-product-mapping`)
- `dtb-schematics-admin.php` → **Schematics** submenu (`dtb-schematics`)

#### DTB Ops top-level (`dtb-ops`)

From `dtb-ops-dashboard.php`:
- Dashboard (`dtb-ops`)
- Audit Log (`dtb-ops-audit`)
- QuickBooks submenu added by `dtb-quickbooks.php` (`dtb-ops-quickbooks`)

#### Other admin pages

- `dtb-cache-admin.php` → Tools → **DTB Cache** (`dtb-cache-settings`)
- `dtb-image-sync.php` → DTB Tools submenu (image sync UI; plus REST/AJAX workflow)

### 4.2 AJAX endpoints (key)

- `dtb-api-health-monitor.php`
  - `wp_ajax_dtb_run_health_checks`
  - `wp_ajax_dtb_test_jwt_roundtrip`
  - `wp_ajax_dtb_save_wc_creds`

- `dtb-product-mapping.php`
  - `wp_ajax_dtb_pm_search_products`
  - `wp_ajax_dtb_pm_get_variables`
  - `wp_ajax_dtb_pm_save_variation`
  - `wp_ajax_dtb_pm_delete_variation`
  - compatibility/relationship endpoints (`dtb_pm_*`)

- `dtb-schematics-admin.php`
  - `wp_ajax_dtb_schematics_list`
  - `wp_ajax_dtb_schematics_get`
  - `wp_ajax_dtb_schematics_save`
  - `wp_ajax_dtb_schematics_remove`
  - `wp_ajax_dtb_schematics_purge`
  - `wp_ajax_dtb_schematics_search_products`

- `dtb-ops-dashboard.php`
  - `wp_ajax_dtb_ops_kpis`
  - `wp_ajax_dtb_ops_audit_log`

- `dtb-quickbooks.php`
  - `wp_ajax_dtb_qbo_oauth_callback`

- `dtb-coming-soon.php`
  - `admin_post_dtb_subscribe`
  - `admin_post_nopriv_dtb_subscribe`

---

## 5) Scheduled jobs / asynchronous workflows

- `dtb-rest-api.php`
  - Catalog import trigger `POST /dtb/v1/import-catalog`
  - Uses Action Scheduler if available (`as_schedule_single_action`), with WP-Cron fallback (`dtb_run_catalog_import_wpcron`)

- `dtb-ops-dashboard.php`
  - `dtb_ops_refresh_kpis` every 5 minutes
  - `dtb_ops_audit_purge` daily

- `dtb-veeqo.php`
  - `dtb_veeqo_health_check` daily

- `dtb-quickbooks.php`
  - `dtb_qbo_daily_sync` daily (when integration configured)

---

## 6) Security and trust boundaries

- CORS/origin enforcement centralized via:
  - `dtb_allowed_origins()`
  - `dtb_check_origin()`
  - `dtb-api-security.php` preflight/headers/REST policy

- JWT auth handled by `dtb-auth.php`:
  - HS256 JWT signed with `DRYWALL_JWT_SECRET`
  - HttpOnly cookie `dtb_auth` + Bearer fallback

- Endpoint gating styles in use:
  - public (`__return_true`) for read-safe/public operations
  - `dtb_jwt_permission` for authenticated customer/API flows
  - capability checks (`manage_options`, `manage_woocommerce`) for admin operations

- Webhook HMAC validation used in:
  - Woo/DTB product webhook path (`WC_WEBHOOK_SECRET`)
  - Veeqo webhook path (`DTB_VEEQO_WEBHOOK_SECRET`)

---

## 7) `wp-config.php` contract + audit

This section documents what the mu-plugin suite expects from `wp/wp-config.php`.

### 7.1 Present and configured (current file)

The following constants are currently defined:

- Core DTB/WC/JWT/import:
  - `WC_PROXY_CONSUMER_KEY`
  - `WC_PROXY_CONSUMER_SECRET`
  - `DTB_WC_AUTH_USER`
  - `DTB_WC_AUTH_PASS`
  - `WC_WEBHOOK_SECRET`
  - `DTB_IMPORT_SECRET`
  - `DRYWALL_JWT_SECRET`
  - `DRYWALL_ALLOWED_ORIGIN`
  - `DTB_DISABLE_PRODUCT_WEBHOOKS`

- Veeqo:
  - `DTB_VEEQO_API_KEY`
  - `DTB_VEEQO_WEBHOOK_SECRET`
  - `DTB_VEEQO_WAREHOUSE_ID`
  - `DTB_VEEQO_CHANNEL_ID`

- Platform hardening/perf:
  - `WP_ENVIRONMENT_TYPE`, `WP_DEBUG*`, memory limits, cron mode, SSL admin, file-edit constraints, cookie path overrides

### 7.2 Optional / not currently defined in `wp-config.php`

These are optional (module or feature flags), and plugin code has fallbacks/defaults:

- QuickBooks credentials/constants:
  - `DTB_QBO_CLIENT_ID`, `DTB_QBO_CLIENT_SECRET`, `DTB_QBO_REALM_ID`
  - `DTB_QBO_SANDBOX` (feature flag)

- Optional overrides/feature flags:
  - `DTB_WC_CSV_FILENAME`
  - `DTB_CATALOG_PLATFORM_ENABLED`
  - `DTB_WEBHOOK_DELIVERY_URL`
  - `DTB_ENABLE_CSP`
  - `DTB_ADMIN_EMAIL`
  - `DTB_ADMIN_PERF_DISABLE`
  - `DTB_SECURITY_LOGGING`

### 7.3 Audit findings

1. **Configuration alignment:** Current `wp-config.php` aligns with active DTB proxy/auth/import/Veeqo wiring.
2. **QuickBooks readiness:** QBO module is present in code; without QBO constants it remains effectively unconfigured (expected behavior).
3. **Operational switch active:** `DTB_DISABLE_PRODUCT_WEBHOOKS` is set true; this intentionally suppresses auto-webhook creation in `dtb-woocommerce.php`.
4. **Security risk note:** Secrets are present in plain text in `wp-config.php`. This is normal for WP runtime, but rotate immediately if ever exposed outside secure server boundaries.

---

## 8) Module map (what lives where)

- `dtb-platform/`
  - shared config/auth/cache/security/REST wiring + ops/admin health utilities
  - legacy bridge loads: `dtb-utils.php`, `dtb-auth.php`, `dtb-cache.php`, `dtb-cache-admin.php`, `dtb-rest-api.php`, `dtb-api-security.php`, `dtb-frontend-security.php`, `dtb-admin-security.php`, `dtb-api-health-monitor.php`, `dtb-admin-performance.php`, `dtb-ops-dashboard.php`, `dtb-config-reference.php`
- `dtb-catalog-platform/`
  - canonical catalog product model and toolset APIs
  - legacy bridge also loads: `dtb-catalog-health.php`
- `dtb-commerce/`
  - cart/order line metadata persistence for Store API toolset flows
- `dtb-order-platform/`
  - order lifecycle/event ledger/queue/tracking/payment webhook/admin tooling
  - legacy bridge loads: `dtb-order-events.php`, `dtb-order-workflows.php`, `dtb-order-queue.php`, `dtb-order-tracking.php`, `dtb-payment-webhooks.php`, `dtb-order-admin.php`
- `dtb-schematics/`
  - schematics and product mapping surfaces
  - legacy bridge loads: `dtb-product-mapping.php`, `dtb-schematics-api.php`, `dtb-schematics-admin.php`
- `dtb-media/`
  - media sync operational workflows
  - legacy bridge loads: `dtb-image-sync.php`
- `dtb-marketing/`
  - coming-soon and SEO surfaces
  - legacy bridge loads: `dtb-coming-soon.php`, `dtb-seo.php`
- `dtb-repair-service/`
  - repair lifecycle/event queue/rest/admin tooling
  - legacy bridge loads: `dtb-repair-events.php`, `dtb-repair-workflows.php`, `dtb-repair-queue.php`, `dtb-repair-notifications.php`, `dtb-repairs.php`, `dtb-repair-admin.php`
- `dtb-integrations/`
  - external commerce/integration adapters
  - legacy bridge loads: `dtb-woocommerce.php`, `dtb-veeqo.php`, `dtb-quickbooks.php`, `dtb-rewards.php`

---

## 9) High-value operational workflows

1. **Catalog refresh pipeline**
   - upload/replace CSV in uploads import path
   - trigger `POST /dtb/v1/import-catalog`
   - Action Scheduler/WP-Cron runs importer
   - cache/webhook layers handle visibility consistency

2. **Product invalidation path**
   - Woo product change/webhook event
   - DTB webhook receiver updates/invalidates cache
   - storefront reads fresh proxy data

3. **Auth lifecycle**
   - SPA login → `/dtb/v1/auth/login`
   - JWT HttpOnly cookie issued
   - protected routes use cookie/Bearer validation via `dtb_jwt_permission`

4. **Media sync path**
   - image files scanned/registered by `dtb-image-sync`
   - attachments linked by SKU to WC products
   - admin + REST controls support dry-run/reset/purge/relock operations

---

## 10) Maintenance rules for future edits

- Keep `00-dtb-loader.php` load order comments in sync with actual `_dtb_require(...)` list.
- Run `scripts/smoke-dtb-mu-modules.ps1` after loader/bootstrap edits to verify required module bootstraps and composition order.
- Any new REST route must be documented in section 3.
- Any new `wp-config.php` constant contract must be documented in section 7.
- Any new admin page/AJAX endpoint should be added to section 4.
- Any new cron/scheduler event should be added to section 5.

When this file and source diverge, source code is authoritative and this README must be updated immediately.
