<!-- markdownlint-disable MD013 MD032 -->

# Drywall Toolbox MU-Plugin Architecture and Runtime Contract

Last verified against source: 2026-07-18.

This document is the canonical operational map for:

```text
drywalltoolbox/wp/wp-content/mu-plugins/
```

Source code and the active loader remain authoritative. When this document and implementation diverge, correct this document in the same change.

## 1. Runtime model

WordPress automatically loads top-level PHP files in `mu-plugins/`. Drywall Toolbox uses `00-dtb-loader.php` as an explicit composition root so dependencies load in a deterministic order before WordPress reaches remaining top-level compatibility files.

Canonical module order:

1. `dtb-platform/bootstrap.php`
2. `dtb-catalog-platform/bootstrap.php`
3. `dtb-commerce/bootstrap.php`
4. `dtb-order-platform/bootstrap.php`
5. `dtb-schematics/bootstrap.php`
6. `dtb-media/bootstrap.php`
7. `dtb-marketing/bootstrap.php`
8. `dtb-repair-service/bootstrap.php`
9. `dtb-integrations/bootstrap.php`
10. `dtb-support/bootstrap.php`
11. `dtb-returns/bootstrap.php`

`00-dtb-loader.php` also owns shared feature-flag, origin, and security-log helpers. New bounded business logic belongs inside the relevant module subtree. Root-level compatibility files may delegate to modules but must not become the home for new domain behavior.

## 2. Module responsibilities

### `dtb-platform`

- runtime configuration and feature flags;
- support primitives;
- origin/CORS/API/admin security;
- JWT/cookie authentication and account/session policy;
- cache, health, logging, metrics, and diagnostics;
- operator operations dashboards;
- shared admin-workbench services;
- account/history and shared platform REST controllers;
- Command Center and System Manager.

### `dtb-catalog-platform`

- catalog product, variation, brand, tool-family, and toolset domain models;
- WooCommerce/product repositories and product meta;
- category/brand normalization and catalog facets;
- variation read models and default variation resolution;
- product mapping and relationships;
- compatible/universal parts projections;
- inventory intelligence and Veeqo stock projection;
- catalog validation, health, REST, CLI, and admin tools.

### `dtb-commerce`

- WooCommerce Store API cart extension data;
- toolset/order-line metadata persistence;
- WooCommerce Checkout Block handoff and DTB-branded checkout shell/styling;
- WooPayments readiness notices, same-origin provider-owned express checkout surfaces, and checkout-order metadata tagging;
- order-type and order-admin query services;
- branded WooCommerce email integration;
- commerce-facing order REST/admin surfaces.

### `dtb-order-platform`

- order lifecycle statuses and transitions;
- append-only order event ledger;
- integration-state persistence;
- Action Scheduler queue and bounded retry;
- order write boundary and duplicate containment;
- WooCommerce payment lifecycle observation for DTB-tagged checkout orders;
- customer/operator tracking projections;
- order REST controllers and operator dashboards.

### `dtb-schematics` and `dtb-media`

- schematic mapping, editor, media-manifest, and product-linking workflows;
- image/media synchronization, validation, registration, and repair tools.

### `dtb-marketing`

- coming-soon/subscriber and SEO support surfaces.

### `dtb-repair-service`

- repair domain statuses/transitions/events;
- repair persistence, media, public tokens, quotes, SLA, queue, and notifications;
- customer and operator timelines;
- repair REST controllers and wp-admin workbench.

### `dtb-integrations`

- WooCommerce integration adapters;
- Veeqo inventory/fulfillment integration;
- QuickBooks accounting projection;
- order-pipeline contracts and webhook echo guards;
- notification rendering/dispatch;
- marketplace shared infrastructure, Amazon, and eBay modules.

Rewards integration files remain intentionally omitted from the launch bootstrap. Frontend feature flags do not make rewards operational unless the backend services/jobs/controllers are explicitly restored and validated.

### `dtb-support`

- support ticket domain, repository, SLA, priority, workflow, assignment, replies, email outbox, customer history, REST, and operator workbench.

### `dtb-returns`

- return domain/status model, repository, workflow transition map, customer/admin REST, and wp-admin page.

## 3. Request and trust boundaries

```text
React SPA
  -> domain-root /wp-json alias
  -> WordPress REST server
  -> DTB controller/service/repository
  -> WooCommerce, DTB persistence, Action Scheduler, or external integration
```

Checkout is the intentional exception to React rendering ownership:

```text
React cart/cart sidebar/product surfaces
  -> provider-owned WooPayments express iframe where eligible, or full-document navigation to /checkout/
  -> .htaccess routes /checkout/ to WordPress
  -> WooCommerce Checkout Block
  -> WooPayments
  -> WooCommerce order/payment lifecycle
  -> DTB order observation and downstream queues
```

Without these constants, wp-admin HTML may load while Woo Admin REST calls to `/wp-json/*` receive only storefront/session cookies such as `dtb_auth`, causing WooCommerce permission failures.

Customer-facing record routes must:

1. validate authentication;
2. resolve the authenticated customer ID from the validated token/session;
3. verify record ownership or use a customer-bound repository query;
4. avoid trusting caller-supplied customer IDs;
5. return non-enumerating 403/404 behavior consistent with the owning controller.

A valid JWT alone is not sufficient authorization for an arbitrary order, customer, repair, return, or support-ticket ID.

## 9. Configuration contract

Server-only constants include:

- WooCommerce proxy/application auth and webhook/import secrets;
- JWT and origin configuration;
- Veeqo API/webhook/warehouse/channel/delivery configuration;
- order write-boundary and reviewed external-write exception configuration;
- QuickBooks and marketplace credentials;
- feature flags and operational switches.

`wp-config.php` is runtime-only and must never be committed or packaged. Public React environment variables may contain only public URLs, feature flags, environment labels, and publishable keys.

## 10. Scheduled and asynchronous work

Examples include:

- catalog import through Action Scheduler with WP-Cron fallback;
- order integration/notification/tracking jobs;
- repair queue and notification work;
- Veeqo health/inventory jobs where enabled;
- QuickBooks projection jobs;
- marketplace ingestion/materialization jobs;
- support email outbox processing;
- operations KPI refresh and audit cleanup.

Every new scheduled hook must document ownership, argument contract, queue group, idempotency behavior, retry policy, and operational visibility.

## 11. Admin and observability surfaces

DTB wp-admin provides:

- Command Center and System Manager;
- order operations and product-order dashboards;
- catalog, product mapping, parts, inventory intelligence, schematics, and media tools;
- repair, return, and support workbenches;
- integration health/state and exception surfaces;
- cache, API health, configuration reference, SEO, and cleanup tools.

The wp-admin toolbar cache control is consolidated by `dtb-platform/Admin/AdminCacheToolbar.php`: duplicate host/plugin cache nodes are hidden, and the single **Clear Caches** action delegates to `DTB_CacheOperationsService` for DTB, WooCommerce, WordPress object cache, OPcache, HostGator page cache, and supported host-managed CDN purge targets with per-target skipped/failed reporting.

Operational actions require capability checks, nonces where applicable, input sanitization, escaped output, prepared SQL, and audit/event recording.

## 12. Deployment contract

Live production code is deployed through HostGator cPanel or FTP unless the business explicitly reintroduces another production deployment path.

Live uploads include:

- generated frontend `dist/` contents when React/CSS source changes;
- `drywalltoolbox/.htaccess` to `/public_html/drywalltoolbox/.htaccess`;
- `drywalltoolbox/logos/` to `/public_html/drywalltoolbox/logos/`;
- `drywalltoolbox/wp/.htaccess` and `wp/index.php` to `/public_html/drywalltoolbox/wp/`;
- changed DTB mu-plugin and theme files to the matching `/public_html/drywalltoolbox/wp/wp-content/` paths.

Deployment never overwrites:

- `wp-config.php`;
- WordPress core unless intentionally performing a controlled WordPress update;
- uploads, cache, or upgrade state;
- runtime secrets;
- uncontrolled database dumps.

Order-pay cleanup deployments must remove retired root-level `zz*order-pay*`, `dtb-wc-payment-runtime*`, `dtb-checkout-payment-status-guard.php`, `dtb-checkout-customer-association.php`, and legacy DTB payment-webhook files from the live `mu-plugins/` directory. The clean runtime state is deletion, not coexistence.

## 13. Validation

Frontend changes:

```powershell
cd frontend
npm ci --include=dev
npm run lint
npm run build
```

Loader/module changes:

```powershell
.\scripts\smoke-dtb-mu-modules.ps1
```

Catalog/API changes:

```powershell
.\scripts\smoke-dtb-catalog-api.ps1
```

Security-sensitive route changes additionally require negative tests for unauthenticated access, cross-customer IDs, raw order creation, malformed inputs, and missing integration configuration.

## 14. Maintenance rules

- Keep the 11-module loader order synchronized across `00-dtb-loader.php`, this README, `AGENTS.md`, and `memory-bank/structure.md`.
- Document durable route, constant, scheduler, and authority changes in the same pull request.
- Do not expose credentials through browser environment variables, REST responses, localStorage, sessionStorage, logs, or generated artifacts.
- Do not describe DTB-calculated shipping options as live Veeqo carrier rates.
- Do not add new business logic to legacy root wrappers.
- Preserve write-boundary, idempotency, queue, and webhook protections when modifying order/integration flows.
- Keep order-pay presentation centralized in `dtb-commerce`; do not restore root-level `zz*` order-pay shims or platform-owned payment-runtime assets.
