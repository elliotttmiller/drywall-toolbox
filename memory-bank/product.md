# Product

Last verified against source: 2026-07-20.

## Product definition

Drywall Toolbox (`drywalltoolbox.com`) is a contractor-focused headless commerce and service-operations platform for professional drywall tools, replacement parts, schematics, repairs, returns, support, and contractor workflow tooling.

It combines:

- multi-brand ecommerce backed by WooCommerce products, Store API cart/session state, native WooCommerce Checkout Block, and the official WooCommerce Stripe Payment Gateway;
- schematic-driven part discovery, compatibility, and universal-part intelligence;
- repair intake, quoting, lifecycle tracking, customer status, and operator workbenches;
- return and support-ticket workflows;
- customer account, address, order-history, repair-history, and preference experiences;
- calculator workflows with structured browser-native report/print-to-PDF output;
- catalog, taxonomy, pricing, identifier, shipping-specification, media, schematic, and audit operations;
- Veeqo inventory/fulfillment orchestration and QuickBooks accounting projection after qualifying commerce events.

The public browsing, product, account, cart, repair, and content experience is the React SPA in `frontend/`. WordPress/WooCommerce under `drywalltoolbox/wp/` is the authoritative commerce and operational backend. WooCommerce owns checkout/order/refund persistence. The official WooCommerce Stripe Payment Gateway owns payment rendering and execution. DTB owns domain policy, lifecycle observation, idempotent downstream orchestration, projections, operator workflows, and integration boundaries.

## Primary users

### External

- professional drywall contractors and crews;
- buyers ordering tools, parts, accessories, and tool sets;
- customers submitting and tracking repairs, returns, and support requests;
- customers reviewing orders, shipments, account data, and calculator reports.

### Internal

- operators managing orders, repairs, returns, support, exceptions, and customer issues through wp-admin workbenches;
- catalog operators maintaining taxonomy, identifiers, product metadata, pricing, shipping specifications, images, schematics, and compatibility;
- administrators managing platform health, WooCommerce/Stripe configuration, Veeqo, QuickBooks, marketplace channels, and deployment operations.

## Live capability map

### Storefront and product discovery

- homepage, catalog browsing, search, brand/category navigation, product detail, and variation selection;
- Store API-backed cart and cart drawer;
- product/variation availability intelligence and related-product projections;
- responsive account hub, navigation/search, and storefront interaction states.

### Checkout and payments

- full-document checkout handoff from React to same-domain `/checkout/`;
- root routing sends checkout, order-pay, order-received, and Woo callback traffic to WordPress before SPA fallback;
- the assigned WooCommerce Checkout page renders native Checkout Block;
- the official WooCommerce Stripe Payment Gateway renders supported payment methods, Link, eligible express wallets, saved methods, validation/errors, tokenization, 3DS/SCA, and payment execution;
- WooCommerce creates the storefront order and owns authoritative payment/refund lifecycle state;
- DTB verifies qualifying paid/captured events, appends order events, and dispatches downstream work through `dtb-orders`;
- Veeqo receives inventory/fulfillment orchestration; QuickBooks receives eligible accounting projections; notifications and tracking follow the same order lifecycle.

The current mobile checkout presents `Contact -> Shipping -> Payment` with a same-page bottom payment sheet. The sheet is presentation only: existing Woo/Stripe payment nodes remain mounted, Woo Blocks cart state remains total authority, and Woo Place Order remains the only final submission action.

Checkout performance/stability hardening adds safe static-asset prewarm, approved provider/resource hints, bounded redacted runtime diagnostics, third-party budget controls, and payment-surface recovery presentation. These optimizations fail open and never create a second cart, checkout, payment, or order authority. Session-owned checkout HTML remains private/no-store and is not a prewarm target.

Checkout shipping options are calculated by Woo/DTB policy. They are not live Veeqo carrier quotes. Veeqo remains authoritative for inventory, warehouse availability, allocation, fulfillment, labels, shipment state, carrier, and tracking.

### Checkout identity and continuity

- same-origin React Store API traffic and native checkout share the WooCommerce cookie-backed session;
- Store API mutation continuity uses Woo session cookies plus Store API `Nonce` semantics;
- verified DTB customer identity is bridged into native Woo checkout;
- staging/native checkout handoff preserves storefront base-path context for return navigation;
- `Cart-Token` is compatibility-only for genuinely cross-origin clients and must not become a second same-origin cart authority.

### Parts and schematics

- schematic browser and part lookup;
- product/variation SKU resolution;
- compatible and universal-part projections;
- runtime schematic media mapping;
- wp-admin mapping/editor/repair tooling.

### Repairs, returns, and support

- repair overview, package selection, intake, media upload, quotes, accept/decline, lifecycle tracking, SLA/notifications, and operator workbench;
- return portal/status and authenticated history;
- support/contact intake, public/customer ticket status, history, and operator workflow;
- lifecycle ownership is separated across `dtb-repair-service`, `dtb-returns`, and `dtb-support`.

### Account and authentication

- login, registration, logout, password recovery/reset;
- account dashboard for orders, repairs, addresses, and settings;
- HttpOnly `dtb_auth` cookie as preferred authenticated session mechanism with optional in-memory bearer compatibility;
- account profile/password APIs and application-wide `auth:expired` behavior.

### Rewards

Rewards are intentionally launch-gated. Current frontend source hard-disables rewards through `isRewardsEnabled()`, and `dtb-integrations/bootstrap.php` intentionally omits rewards services/jobs/controllers. Stale environment flags do not override that hard gate.

### Calculators and reports

- calculator hub and specialized drywall estimators;
- canonical summary-to-report presentation model under `frontend/src/components/calculators/report/`;
- structured printable report preview and browser `Save as PDF`/print workflow;
- report values come from calculator outputs; the report layer formats but does not recalculate quantity authority;
- current report generation is client-side presentation only and adds no server PDF service.

### Content and launch-gated tools

- FAQ, shipping policy, return policy, store policies, and technical-specification preview tooling;
- public toolset-builder route remains disabled until explicitly launched and validated.

## Backend product responsibilities

The WordPress layer is a headless product backend and operator cockpit. It owns or coordinates:

- DTB REST APIs and Store API extension behavior;
- catalog read models, normalization, relationships, inventory intelligence, validation, and admin tooling;
- native Woo checkout routing/runtime exceptions for the headless theme;
- official Stripe checkout readiness/presentation boundaries without replacing gateway authority;
- checkout performance/prewarm metadata and diagnostics-only runtime telemetry;
- order tagging, captured-payment verification, event ledger, write boundary, duplicate containment, integration state, queue, and tracking projections;
- repair, return, and support persistence/lifecycle policy;
- authentication, authorization, origin policy, rate limiting, health, and observability;
- media/schematic administration;
- Veeqo, QuickBooks, notification, and marketplace integrations;
- wp-admin Command Center, System Manager, and domain workbenches.

## Operational product reality

This repository is both production application source and a controlled operations workspace for catalog/media/schematic lifecycle management. `products/` and `scripts/` are core product infrastructure. Stable product identifiers, taxonomy, media mappings, shipping specifications, schematic paths, compatibility, and source provenance are business-critical data.

## System-of-record boundaries

- React owns public rendering and interaction state.
- WooCommerce owns products, customers, cart/session, checkout/address/shipping/tax/totals state, orders, refunds, and authoritative operational payment/order state.
- The official WooCommerce Stripe Payment Gateway owns payment-method rendering/eligibility, Link, eligible wallets, saved methods, tokenization, 3DS/SCA, payment execution, and webhook synchronization.
- DTB owns policy, checkout support/presentation boundaries, lifecycle observation, idempotent queues/projections, catalog/media/schematic domains, repairs, returns, support, and operator workflows.
- Veeqo owns inventory and fulfillment truth.
- QuickBooks owns accounting projection after eligible payment/refund events.
- Storefront orders are created only through WooCommerce Checkout Block; raw external storefront order creation remains retired.

## Non-goals

- returning to a classic WordPress theme-first public storefront;
- building a second React checkout/payment authority;
- copying payment-plugin private UI/build internals;
- building independent Stripe checkout/payment flows while the official Woo gateway is authoritative;
- caching or prefetching private/session-owned checkout HTML;
- using browser storage as an integration credential store;
- allowing multiple systems to create/mutate the same order without explicit write-boundary and idempotency contracts;
- using the calculator report renderer as a second calculation engine;
- treating catalog/media/schematic maintenance as unrelated to application engineering.

## One-line truth statement

Drywall Toolbox is a headless React + WordPress/WooCommerce contractor commerce and service platform that unifies product ordering, native official-Stripe checkout, schematics-driven parts, repairs, returns, support, calculator reporting, operator workflows, catalog/media operations, Veeqo fulfillment, and QuickBooks accounting projection under explicit system-of-record and idempotency boundaries.