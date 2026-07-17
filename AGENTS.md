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
  -> DTB must-use plugin platform
  -> Action Scheduler/domain persistence
  -> Stripe Embedded Checkout for storefront checkout workflow
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

React owns rendering, route behavior, interaction state, loading/empty/success/error states, and client-side usability validation. React does not own authoritative commerce policy, lifecycle transitions, persistence, authorization, integration policy, or administrative workflows.

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

Owns products, customers, Store API cart/session state, and materialized operational orders after DTB creates them from verified Stripe Embedded Checkout Sessions.

### Stripe Embedded Checkout

Owns storefront checkout UI/workflow, payment method collection, wallets, saved payment/address UI, localization, Stripe-hosted checkout iframe behavior, payment status, refund/dispute source events, and Stripe Checkout Session lifecycle.

### DTB platform

Owns checkout orchestration, server-side cart snapshots, Stripe Checkout Session creation, dynamic shipping policy, webhook verification, WooCommerce order materialization, order events, write boundaries, idempotency, duplicate containment, integration state, queues, projections, repairs, returns, support, schematics, media, catalog projections, operator workflows, and integration policy.

### Veeqo

Owns sellable inventory, warehouse availability, allocation, fulfillment, labels, shipment execution/status, carrier, and tracking. DTB checkout shipping options are DTB/Woo policy rates, not live Veeqo carrier quotes.

### QuickBooks

Owns accounting projection after eligible payment/refund lifecycle events. QuickBooks never creates orders.

## 6. Checkout and order contract

The only valid storefront order path is:

```text
WooCommerce Store API cart
  -> React /checkout
  -> GET /wp-json/dtb/v1/checkout/stripe-embedded/config
  -> POST /wp-json/dtb/v1/checkout/stripe-embedded/session
  -> Stripe Embedded Checkout iframe
  -> POST /wp-json/dtb/v1/checkout/stripe-embedded/shipping-options when Stripe requests dynamic shipping
  -> POST /wp-json/dtb/v1/stripe/embedded-checkout/webhook
  -> DTB verifies Stripe-Signature and paid Checkout Session
  -> DTB creates exactly one WooCommerce order from the locked cart snapshot
  -> WooCommerce payment_complete/processing lifecycle
  -> DTB order event ledger
  -> dtb-orders Action Scheduler queue
  -> Veeqo, QuickBooks, notification, and tracking projections
```

Mandatory invariants:

- create no WooCommerce storefront order before Stripe reports a verified paid Checkout Session;
- preserve checkout idempotency and duplicate webhook containment;
- prevent duplicate order materialization, email, accounting, fulfillment, and webhook side effects;
- bind checkout/session/status reads to the same cart/customer ownership proof;
- never authorize ownership using caller-supplied customer IDs alone;
- never restore raw browser or external WooCommerce order creation;
- do not use WooCommerce Stripe gateway plugins, Payment Plugins payment surfaces, order-pay pages, or same-shell iframe fallbacks as the storefront `/checkout` payment authority;
- keep Stripe secret keys and webhook secrets server-only.

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
- Use `$wpdb->prepare()` for dynamic SQL.
- Use timing-safe comparisons for secrets and signatures.
- Never weaken CORS, auth, origin, nonce, signature, or capability controls to make requests succeed.

Security-sensitive changes require negative validation for unauthenticated access, expired/malformed auth, cross-customer IDs, caller-supplied ownership fields, invalid signatures, replayed events, duplicate idempotency keys, malformed bodies, missing integration configuration, and unavailable external services.

## 9. Engineering standards

Make the smallest coherent production change that fully solves the problem. Avoid unrelated refactors, speculative abstractions, mass formatting, deprecated APIs, and dependencies without measurable need.

JavaScript/React:

- ES modules, functional components/hooks, dependency-correct cancelable effects, no stale closures.
- Centralized API/auth behavior under `frontend/src/api/` and auth modules.
- Accessible responsive states.
- No duplicate or fetch-per-item patterns where batching/caching is needed.
- JavaScript is current standard; do not introduce isolated TypeScript without an approved migration.

PHP/WordPress:

- `defined( 'ABSPATH' ) || exit;`
- WordPress REST/HTTP/security conventions.
- Clear Domain/Services/Infrastructure/Rest/Admin/Repository/Validation boundaries.
- No output before headers.
- No unbounded/N+1 queries.
- Transactions or compensation for partial writes.
- Idempotent handlers for webhooks and queues.

Evaluate Big-O, query count/indexes, payload size, external calls, synchronous latency, cache invalidation, queue throughput/retry amplification, memory, and observability.

## 10. Validation matrix

Frontend:

```powershell
cd frontend
npm ci --include=dev
npm run lint
npm run build
```

Backend/module/security:

```powershell
.\scripts\smoke-dtb-mu-modules.ps1
```

Also run targeted PHP syntax checks and negative route tests for changed routes/security boundaries.

Catalog/API:

```powershell
.\scripts\smoke-dtb-catalog-api.ps1
```

CI in `.github/workflows/ci-build.yml` runs for PRs to `main`, pushes to `main`, and manual dispatch. Deployment uses `.github/workflows/deploy.yml` with confirmation, protected approval, backup, smoke tests, rollback, and restore. Merge is not deployment.

## 11. Execution protocol

For engineering tasks:

1. extract acceptance criteria;
2. inspect the smallest relevant source set;
3. identify owning layer/module/system of record;
4. trace request, persistence, events, queues, integrations, and deployment;
5. identify authorization, concurrency, duplicate-side-effect, compatibility, migration, scaling, rollback, and deployability risks;
6. choose the lowest-risk complete design;
7. implement in the owning layer;
8. add guards/tests/smoke checks or deterministic scripts;
9. update durable docs;
10. run applicable validation;
11. inspect final diff for scope creep, secrets, generated files, and deployment hazards;
12. report changed files, validation results, operational actions, and residual risk.

Ask only when product intent, destructive cleanup, irreversible migration, credentials, or authority remains genuinely ambiguous.
