<!-- markdownlint-disable MD013 MD032 -->

# Drywall Toolbox MU-Plugin Architecture and Runtime Contract

Last verified against source: 2026-07-12.

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
- order-type and order-admin query services;
- branded WooCommerce email integration;
- commerce-facing order REST/admin surfaces.

### `dtb-order-platform`

- order lifecycle statuses and transitions;
- append-only order event ledger;
- integration-state persistence;
- Action Scheduler queue and bounded retry;
- order write boundary and duplicate containment;
- payment webhook verification/idempotency;
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
  -> permission callback and input validation
  -> DTB controller/service/repository
  -> WooCommerce or DTB persistence
  -> queued external side effects
```

Security invariants:

- WooCommerce consumer keys, application passwords, webhook secrets, Veeqo keys, QuickBooks credentials, and marketplace credentials are server-only.
- `GET /dtb/v1/config` returns public capability/bootstrap data only; it never returns WooCommerce credentials.
- Browser product/catalog reads use the server-side proxy.
- Browser cart/session operations use WooCommerce Store API.
- Storefront order creation uses the DTB checkout session/confirm/finalize contract only.
- Legacy `POST /drywall/v1/orders` is retired.
- Legacy order/customer reads are deprecated and bind records to the authenticated customer.
- Public endpoints must be intentionally read-safe or protected by a signed token/HMAC/idempotency contract.
- Admin routes require `manage_options`, `manage_woocommerce`, or the owning DTB capability.
- Webhook routes preserve signature verification.

## 4. API surface

### `dtb/v1`

Primary platform/domain namespace. Major route groups include:

- authentication, account, password, and history;
- checkout capabilities/session/confirm/finalize/tax preview;
- catalog import/platform/facets/products/toolsets/inventory intelligence;
- schematics and media synchronization;
- orders, tracking, events, health, and operator actions;
- repairs, quotes, media, comments, customer lists, and operator workbench;
- returns and support customer/admin routes;
- Veeqo status, cart availability, webhook, sync, mapping, and admin operations;
- QuickBooks status/sync/OAuth;
- cache, health, operations, Command Center, and System Manager;
- marketing/subscriber routes.

### `drywall/v1`

Compatibility/read-proxy namespace:

- public product list/detail/slug/variation/category/attribute/search/SKU resolution;
- product cache-invalidation webhook;
- public customer creation compatibility route;
- deprecated, authenticated, customer-bound order/customer reads.

No raw storefront order creation is permitted through this namespace.

### `headless/v1`

Theme-level headless support routes.

### `wc/store/v1`

WooCommerce Store API used for public cart/session operations. Administrative WC REST APIs are not called from browser code.

## 5. Checkout, order, and integration flow

```text
Store API cart
  -> POST /dtb/v1/checkout/session
  -> POST /dtb/v1/checkout/confirm
  -> POST /dtb/v1/checkout/finalize
  -> WooCommerce order/payment runtime
  -> DTB order event ledger
  -> dtb-orders Action Scheduler queue
  -> Veeqo / QuickBooks / notification / tracking jobs
```

The checkout contract uses an idempotency key. The order write boundary blocks raw external order creation, duplicate materialization, email/side-effect loops, and queue work for contained duplicate orders.

External order side effects use `dtb_order_enqueue_job()` and the `dtb-orders` Action Scheduler group. Queue behavior includes scheduled-action deduplication, bounded exponential retry, integration-state recording, event logging, and duplicate side-effect suppression.

## 6. Veeqo contract

Veeqo is authoritative for:

- sellable inventory and warehouse availability;
- allocation and fulfillment;
- labels and shipment execution;
- shipment status, carrier, and tracking.

The storefront uses `POST /dtb/v1/veeqo/cart-availability` for checkout availability. Bulk inventory routes are administrative.

`POST /dtb/v1/veeqo/shipping-rates` currently applies DTB shipping policy based on destination, subtotal, product/service type, and weight. It does not return live Veeqo carrier quotes. Code, documentation, and customer copy must not describe these values as Veeqo live rates until a real rating adapter is implemented.

Veeqo webhook processing must preserve HMAC validation, echo-loop containment, idempotency, order ownership/correlation, and tracking projection updates.

## 7. QuickBooks contract

QuickBooks receives accounting projections after qualifying payment/refund lifecycle events. It is not an order-creation authority. QBO calls are server-side, queued, idempotent, and recorded in order integration state.

When QuickBooks constants are absent, the integration remains explicitly unconfigured and skips safely.

## 8. Authentication and customer ownership

DTB authentication uses an HS256 JWT signed with `DRYWALL_JWT_SECRET` and issued primarily as the HttpOnly `dtb_auth` cookie. Bearer tokens are supported for compatible API clients.

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

Operational actions require capability checks, nonces where applicable, input sanitization, escaped output, prepared SQL, and audit/event recording.

## 12. Deployment contract

Deployment packages:

- generated frontend `dist/` contents;
- `drywalltoolbox/.htaccess`;
- `drywalltoolbox/logos/`;
- `drywalltoolbox/wp/.htaccess` and `wp/index.php`;
- DTB mu-plugins and themes.

Deployment never packages:

- `wp-config.php`;
- WordPress core;
- uploads, cache, or upgrade state;
- runtime secrets;
- database dumps unless an explicitly controlled operational task requires one.

## 13. Validation

Frontend changes:

```powershell
cd frontend
npm ci
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
