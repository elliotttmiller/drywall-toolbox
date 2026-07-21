# Product

Last verified against active source: 2026-07-20 (current `main` head observed at `763a58779b75951ae96fd5c65c65b3e965af06f8`).

## Product definition

Drywall Toolbox (`drywalltoolbox.com`) is a contractor-focused headless commerce and service-operations platform for professional drywall tools, replacement parts, schematics, and repair/service workflows.

It combines:

- multi-brand ecommerce backed by WooCommerce products, Store API cart/session state, native WooCommerce Checkout Block, and the official WooCommerce Stripe Payment Gateway;
- Veeqo-backed inventory/fulfillment authority and QuickBooks accounting projection;
- schematic-driven part discovery, compatibility, and universal-part intelligence;
- repair intake, quoting, lifecycle tracking, media, SLA, and operator workflows;
- returns and support-ticket workflows with customer-facing status views;
- customer account, address, order-history, tracking, and preference experiences;
- calculator/estimation tools with a structured browser print/Save-as-PDF report workflow;
- catalog, taxonomy, pricing, image, schematic, source-data, and operational tooling in the same repository.

The public browsing/account/cart experience is the React SPA in `frontend/`. WordPress/WooCommerce under `drywalltoolbox/wp/` is the commerce and operational backend.

WooCommerce owns storefront checkout/order creation and the operational order/payment/refund record. The official WooCommerce Stripe Payment Gateway owns embedded payment rendering, supported Stripe methods, eligible wallets/Link, tokenization, 3DS/SCA, payment execution, and webhook synchronization. DTB observes verified Woo lifecycle events and owns domain policy, write boundaries, queues, projections, integrations, and operator workflows. Veeqo is the inventory/fulfillment authority. QuickBooks is an accounting projection target.

## Primary users

### External

- professional drywall contractors and crews;
- buyers ordering tools, parts, accessories, and tool sets;
- customers using schematics to identify replacement parts;
- customers submitting and tracking repairs, returns, and support requests;
- customers reviewing order, shipment, repair, return, and support status;
- contractors using estimation calculators and printable/PDF reports.

### Internal

- operators managing orders, repairs, returns, support, and exceptions through wp-admin workbenches;
- catalog operators maintaining taxonomy, product metadata, pricing, images, compatibility, and schematics;
- administrators managing platform health, the official Stripe gateway, Veeqo, QuickBooks, marketplace channels, routing, and deployment operations.

## Live capability map

### Storefront and product discovery

- catalog browsing, search, brand/category selection, and product detail/variation selection;
- dedicated parts and schematic discovery flows;
- Store API-backed cart with same-origin WooCommerce session continuity;
- account-aware UI, cart drawer/page, product purchase feedback, and order tracking surfaces;
- staging-aware storefront routing support without moving checkout authority into React.

### Native WooCommerce checkout

The active checkout is not a React payment form.

Current path:

```text
React cart / cart drawer
  -> WooCommerce Store API cookie-backed cart session + Nonce
  -> optional low-priority prewarm of DTB static checkout assets
  -> full-document /checkout/
  -> WordPress/WooCommerce Checkout Block
  -> official WooCommerce Stripe Payment Gateway
  -> WooCommerce order/payment lifecycle
  -> DTB captured-payment observation/event ledger
  -> dtb-orders queue
  -> Veeqo / QuickBooks / notifications / tracking
```

Current product behavior includes:

- `/checkout` React compatibility routing that immediately performs full-document navigation to native Woo checkout and guards against rewrite loops;
- root routing that sends checkout/order-pay/order-received/payment callback surfaces to WordPress before SPA fallback;
- WooCommerce Checkout Block as the only storefront order-creation surface;
- official WooCommerce Stripe embedded card/payment methods, Link, eligible express wallets, tokenization, and webhook reconciliation;
- DTB checkout presentation/readiness integration without creating a second payment authority;
- checkout-order tagging, verified paid-reference mirroring, captured-payment gating, and downstream queue dispatch;
- customer order confirmation/tracking return flows after successful checkout;
- canonical root checkout even when the shopper originated from a staging storefront path.

### Mobile checkout payment sheet

DTB now provides a mobile bottom-sheet presentation around the existing native Woo/official-Stripe checkout payment surface.

This is presentation state only. It may provide:

- accessible dialog chrome and focus containment;
- mobile viewport/keyboard handling;
- a read-only total projection from Woo Blocks `wc/store/cart` state;
- supported mobile `Pay now` presentation for the authoritative Woo Place Order action;
- non-secret readiness diagnostics.

It does not create PaymentIntents, Checkout Sessions, card fields, wallet buttons, or a second order/payment submission path. Provider-owned controls remain mounted and Stripe/WooCommerce retain payment/order authority.

### Checkout performance and resilience

The native checkout has a dedicated performance/stability layer that:

- prewarms only allowlisted DTB static checkout assets after successful cart engagement;
- restores useful Stripe resource hints on native checkout;
- suppresses only known non-essential marketing/tracking assets by explicit policy;
- applies below-fold order-summary image loading policy;
- records bounded checkout runtime diagnostics for JS/resource failures, payment-surface timeout, unexpected checkout-root replacement, layout/performance signals, and third-party budget warnings;
- provides recovery presentation if the official payment surface does not become available within the bounded timeout.

Performance behavior is fail-open. It never prefetches/caches private `/checkout/` HTML, reconstructs authoritative form state, or creates fallback payment objects.

Diagnostics endpoint:

```text
POST /wp-json/dtb/v1/checkout/runtime-telemetry
```

The route is diagnostics-only and protected by a dedicated nonce, same-origin validation when applicable, rate limiting, deduplication, bounded fields, allowlisted event kinds, and sensitive-value redaction.

### Shipping, inventory, and fulfillment

- checkout shipping options are calculated by Woo/DTB policy from configured destination/product/subtotal/weight rules;
- this is not a live Veeqo carrier-rating API;
- Veeqo remains authoritative for sellable inventory, warehouse availability, allocation, labels, fulfillment, shipment state, carrier, and tracking;
- DTB projects verified order lifecycle events into Veeqo asynchronously after the captured-payment contract passes.

### Orders, payment lifecycle, and refunds

DTB order handling includes:

- append-only lifecycle events;
- integration-state persistence;
- `dtb-orders` Action Scheduler jobs;
- order write boundary and duplicate containment;
- atomic initial downstream-dispatch barrier;
- verified official-Stripe paid-reference mirroring;
- customer/operator tracking projections;
- refund projection keyed by concrete WooCommerce `refund_id`.

Refunds are post-payment lifecycle events. Partial refund A and partial refund B are distinct accounting/operational events and must not be collapsed into one cumulative parent-order marker.

### Parts and schematics

- schematic browser and part lookup;
- product/variation/SKU resolution;
- compatible/universal-part projections;
- runtime schematic media and operator mapping/editor tooling;
- stable schematic/part/image relationships treated as business-critical data.

### Repairs

- repair-service overview and package selection;
- intake, media upload, and tracking;
- quote generation and accept/decline actions;
- lifecycle event stream, SLA, notification, queue, and operator workbench behavior in `dtb-repair-service`.

### Returns and support

- return portal and return-status pages;
- support/contact intake and ticket-status pages;
- authenticated histories and customer status views;
- backend lifecycle ownership in `dtb-returns` and `dtb-support`.

### Account and authentication

- login, registration, logout, forgot/reset-password flows;
- tabbed account/dashboard surfaces for orders, repairs, addresses, and settings;
- preferred HttpOnly `dtb_auth` cookie with optional in-memory bearer-token compatibility;
- application-wide `auth:expired` behavior after confirmed authentication failure;
- server-side customer ownership checks for protected records.

### Rewards

Rewards remain launch-gated.

Historical UI/configuration references still exist, and CI currently defines `REACT_APP_REWARDS_ENABLED=1`, but `frontend/src/utils/featureFlags.js` explicitly returns `false` for rewards and documents the initial-production disablement. Treat active source as authoritative: rewards are disabled until the complete backend contract is intentionally restored and validated.

### Calculators and report export

The Calculator Hub provides customer estimation workflows and a structured report/export experience.

Canonical report presentation lives under:

```text
frontend/src/components/calculators/report/
```

Current report contract:

- `calculatorReportModel.js` is the canonical presentation mapper from calculator summary state into the report model;
- summary and printable report consume the same model instead of maintaining separate calculations;
- report rendering formats calculator outputs but does not recalculate quantities;
- project/report state remains compatible with `dwCalc_state`;
- **Export / Save PDF** opens a dedicated report preview;
- **Save / Print PDF** uses browser print/Save-as-PDF with a print-isolated report root;
- report data is not sent to WordPress or an external PDF service.

The earlier `calc-pdf/files/` reference implementation has been removed from active source and must not be treated as architecture authority.

### Content and launch-gated tools

- FAQ, shipping policy, return policy, store policies, contact, and technical-specification preview surfaces;
- public toolset-builder route remains disabled/commented out until launch criteria are explicitly met.

## Backend product responsibilities

The WordPress layer is a headless product backend and operator cockpit, not the public React storefront renderer.

It owns:

- custom REST APIs and Store API extension behavior;
- authentication, authorization, origin policy, rate limiting, health, and diagnostics;
- catalog read models, variation normalization, product relationships, compatibility, and inventory intelligence;
- native checkout routing/runtime exceptions for the headless theme;
- official-Stripe readiness metadata and checkout presentation/performance support that does not own payment state;
- Woo checkout order tagging, event ledger, queue, write boundary, duplicate containment, refund identity, and tracking projections;
- repair, return, and support persistence/lifecycle policy;
- media/schematic administration;
- Veeqo, QuickBooks, notification, and marketplace integrations;
- wp-admin command-center/system-manager/domain workbench surfaces.

## Operational product reality

This repository is both:

1. production application source for `drywalltoolbox.com`; and
2. a controlled operations workspace for catalog/media/source-data lifecycle management.

`products/` and `scripts/` are core product infrastructure, not disposable support folders.

Business-critical identifiers include SKUs, part numbers, variation relationships, brands, taxonomy slugs, external IDs, image mappings, schematic paths, compatibility mappings, and source provenance.

Operational data paths have evolved. Current code/scripts must be inspected before bulk work rather than assuming historical `products/Production/launch/*` locations.

## Scope and authority boundaries

- React owns customer-facing browsing, cart shell, account UX, service intake, calculator UI/report presentation, and checkout handoff state.
- WordPress/WooCommerce owns native checkout/order creation and operational commerce persistence.
- Mu-plugin modules are the canonical home for backend business logic.
- The official WooCommerce Stripe Payment Gateway owns storefront payment-method rendering and payment execution.
- DTB mobile payment-sheet/performance layers are presentation/diagnostics only and cannot become payment authorities.
- WooCommerce owns products, customers, Store API cart/session, orders, and refunds.
- DTB owns domain policy, verified lifecycle observation, eventing, projections, queues, checkout routing support, services, and integration policy.
- Veeqo owns inventory and fulfillment truth.
- QuickBooks owns accounting projection after qualifying payment/refund events.
- Browser code never receives WooCommerce admin credentials, application passwords, consumer secrets, Stripe secret/webhook keys, PaymentIntent client secrets, wallet tokens, or integration API keys.
- Controlled catalog taxonomy is validated operationally before production import.

## Non-goals

- returning catalog/account browsing to a classic WordPress theme-first storefront;
- building a second React checkout/payment authority;
- copying/mounting private payment-plugin React/build internals inside the SPA;
- custom DTB Stripe Checkout Sessions or PaymentIntents for storefront checkout while the official WooCommerce Stripe gateway is authoritative;
- fake or independently orchestrated Apple Pay/Google Pay/Link UI;
- caching/prefetching session-owned checkout HTML for performance;
- reconstructing Woo checkout form/payment state from duplicate browser state;
- building a separate admin SPA when wp-admin workbenches own operations;
- treating catalog/media/source-data maintenance as unrelated to application engineering;
- allowing multiple systems to create or mutate the same order without a write-boundary/idempotency contract.

## Current delivery reality

CI builds/lints the frontend, runs mobile payment-sheet and checkout-performance static smoke contracts, assembles a bounded deployment payload, and rejects forbidden runtime paths.

Merge is not deployment.

The intended production release model is controlled deployment with confirmation, protected approval, backup, smoke validation, rollback, and restore capability. At this verification point, however, checked-in `.github/workflows/deploy.yml` ends after a placeholder continuation in the pre-deploy backup job and does not contain a complete executable upload/restore sequence. Production deployment automation must therefore not be represented as fully wired until active workflow source is restored and validated.

## One-line truth statement

Drywall Toolbox is a headless React + WordPress/WooCommerce contractor platform unifying ecommerce, schematic-driven parts, repairs, returns, support, calculators, and operator workflows, with WooCommerce Checkout Block plus the official WooCommerce Stripe gateway as the single storefront checkout/payment authority, DTB-controlled lifecycle observation/queues/projections, Veeqo-controlled inventory/fulfillment, QuickBooks accounting projection, and first-class catalog/media/source-data operations.