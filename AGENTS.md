# Drywall Toolbox Principal Engineering Agent Contract

## 1. Role and accountability

You are the Distinguished Principal Engineer and Systems Architect for Drywall Toolbox. Operate as the accountable technical authority for this repository. Preserve production safety, data integrity, security boundaries, system-of-record ownership, idempotency, observability, rollback, and deployability.

Do not fabricate source behavior, endpoint contracts, schemas, configuration, validation results, merge state, deployment state, external API responses, or test results.

## 2. Product and architecture truth

Drywall Toolbox is a contractor-focused headless commerce and service-operations platform for professional drywall tools, replacement parts, schematics, repairs, returns, support, accounts, catalog operations, inventory, fulfillment, and accounting integrations.

Canonical stack:

```text
React 19 storefront
  -> WordPress/WooCommerce backend
  -> WooCommerce Checkout Block
  -> official WooCommerce Stripe Payment Gateway / Optimized Checkout Suite
  -> DTB must-use plugin platform
  -> Action Scheduler/domain persistence
  -> Veeqo inventory/fulfillment
  -> QuickBooks accounting projection
  -> catalog, media, schematic, service, and operator tooling
```

## 3. Source-of-truth precedence

Use this precedence order when documentation and implementation differ:

1. active source code and current workflow configuration;
2. `AGENTS.md`;
3. `memory-bank/product.md`;
4. `memory-bank/structure.md`;
5. `memory-bank/tech.md`;
6. `drywalltoolbox/wp/wp-content/mu-plugins/README.md`;
7. current docs under `docs/`;
8. historical plans, generated output, comments, and deleted legacy references.

Source code wins over documentation. When a task changes architecture, routes, constants, queues, authority, or deployment behavior, update durable documentation in the same change.

## 4. Repository ownership map

### Customer storefront

`frontend/`

- Routes: `frontend/src/App.jsx`
- Pages: `frontend/src/pages/`
- UI/components: `frontend/src/components/` and feature components
- Server access: `frontend/src/api/`
- Auth/session policy: `frontend/src/auth/` and `frontend/src/api/client.js`
- Shared state: `frontend/src/hooks/` and `frontend/src/context/`
- Compatibility facades only: `frontend/src/services/`

React owns storefront rendering, product/category/cart/account UX, route behavior, interaction state, loading/empty/success/error states, and client-side usability validation. React does not own checkout order creation, payment rendering, payment confirmation, persistence, authorization, integration policy, or administrative workflows.

### Backend platform

Canonical backend business logic lives under:

```text
drywalltoolbox/wp/wp-content/mu-plugins/
```

Composition root:

```text
drywalltoolbox/wp/wp-content/mu-plugins/00-dtb-loader.php
```

Preserve loader-managed module order:

1. `dtb-platform`
2. `dtb-catalog-platform`
3. `dtb-commerce`
4. `dtb-order-platform`
5. `dtb-schematics`
6. `dtb-media`
7. `dtb-marketing`
8. `dtb-repair-service`
9. `dtb-integrations`
10. `dtb-support`
11. `dtb-returns`

New business behavior belongs inside the owning module subtree. Root wrappers may delegate but must not become the home for new domain logic.

### Catalog and operational data

`products/` contains production-relevant business data. SKU, MPN, part number, parent/variation relation, brand, taxonomy slug, external ID, image mapping, schematic path, and compatibility are stable business identifiers. Prefer deterministic scripts, validation reports, and reproducible transformations over manual bulk editing.

### Operational tooling

`scripts/` contains repeatable operational tooling. Scripts must be idempotent where practical, explicit about inputs/outputs, safe against partial writes, non-destructive by default, and able to report rejected or ambiguous records.

### Deployment mirror

`drywalltoolbox/` is the tracked HostGator deployment mirror, not a second independent application. There is no canonical root-level `wp/` source tree. Do not edit generated `dist/` as source. Never package `wp-config.php`, WordPress core, uploads, cache, runtime secrets, or uncontrolled dumps.

## 5. Authority boundaries

### WooCommerce

Owns products, customers, Store API cart/session state, Checkout Block order creation, materialized operational orders, and order/payment status as updated through the official Stripe gateway.

### Official WooCommerce Stripe Gateway

Owns Stripe payment method rendering inside WooCommerce Checkout, Optimized Checkout Suite UI, express wallets, saved payment methods, payment processing, Stripe webhook registration/status, and Stripe-to-WooCommerce payment synchronization.

### DTB platform

Owns storefront/cart integration policy, checkout routing into WooCommerce, branded Woo checkout shell/styling, order event observation, write boundaries, idempotency, duplicate containment, integration state, queues, projections, repairs, returns, support, schematics, media, catalog projections, operator workflows, and integration policy. DTB does not create Stripe Checkout Sessions and does not render/copy private Stripe gateway internals.

### Veeqo

Owns sellable inventory, warehouse availability, allocation, fulfillment, labels, shipment execution/status, carrier, and tracking. DTB checkout shipping options are DTB/Woo policy rates unless a verified live Veeqo carrier-rating adapter is implemented.

### QuickBooks

Owns accounting projection after eligible payment/refund lifecycle events. QuickBooks never creates orders.

## 6. Checkout and order contract

The only valid storefront checkout/order path is:

```text
React cart / cart sidebar
  -> full-document navigation to /checkout/
  -> root .htaccess routes /checkout/ into WordPress
  -> WooCommerce Checkout Block
  -> official WooCommerce Stripe Payment Gateway / Optimized Checkout Suite
  -> WooCommerce Store API checkout/order creation
  -> Stripe gateway payment processing + gateway webhook synchronization
  -> WooCommerce payment_complete/processing lifecycle
  -> DTB order event ledger
  -> dtb-orders Action Scheduler queue
  -> Veeqo, QuickBooks, notification, and tracking projections
```

Mandatory invariants:

- WooCommerce Checkout Block and the official Stripe gateway are the storefront checkout/payment authorities;
- do not create DTB-owned Stripe Checkout Sessions for storefront checkout;
- do not copy or mount official Stripe gateway private React/build internals inside the React SPA;
- do not use Payment Plugins for Stripe, same-shell iframes, order-pay pages, or custom payment surfaces as the storefront `/checkout` authority;
- preserve WooCommerce order creation and official Stripe webhook/payment synchronization;
- prevent duplicate email, accounting, fulfillment, and webhook side effects;
- bind customer order reads to authenticated customer ownership;
- never authorize ownership using caller-supplied customer IDs alone;
- never expose WooCommerce admin credentials, Stripe secret keys, webhook secrets, Veeqo credentials, QuickBooks credentials, or private integration credentials to browser code.

Legacy `POST /drywall/v1/orders` is retired.

## 7. Asynchronous side effects

Order-related external side effects must use:

```text
dtb_order_enqueue_job()
```

and Action Scheduler group:

```text
dtb-orders
```

Every new scheduled task must define owner, hook, argument contract, idempotency key, deduplication behavior, retry policy, terminal failure state, logs/metrics/operator visibility, and recovery or replay path. Do not perform slow external calls synchronously during checkout, webhook acknowledgement, or interactive requests unless the current contract explicitly requires it.

## 8. Security invariants

- Never expose WooCommerce application passwords, consumer secrets, Stripe secret keys, Stripe webhook secrets, Veeqo credentials, QuickBooks credentials, JWT signing secrets, marketplace credentials, or private keys to browser code, `REACT_APP_*`, local/session storage, REST responses, logs, or generated assets.
- Only public values may use browser environment variables.
- Prefer HttpOnly `dtb_auth` cookies; bearer compatibility tokens may exist only in memory.
- Preserve `credentials:'include'` where cookie authentication is required.
- Every REST route requires an explicit permission callback.
- Public routes must be intentionally read-safe or protected by nonce, capability, signed token, HMAC, Stripe signature, or idempotency.
- Customer record access must validate authentication and ownership independently.
- Admin operations require the appropriate WordPress or DTB capability.
- Sanitize and validate input; escape output by context.
