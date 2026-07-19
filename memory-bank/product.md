# Product

Last verified against source: 2026-07-19.

## Product definition

Drywall Toolbox (`drywalltoolbox.com`) is a contractor-focused headless commerce and service-operations platform for professional drywall tools, replacement parts, and repair services.

It combines:

- multi-brand ecommerce backed by WooCommerce Checkout Block, the official WooCommerce Stripe Payment Gateway, WooCommerce operational orders, and Veeqo fulfillment sync;
- schematic-driven part discovery and product compatibility;
- repair intake, quoting, lifecycle tracking, and operator workflows;
- returns and support-ticket workflows with customer-facing status views;
- customer account, address, order-history, and preference experiences;
- catalog, taxonomy, pricing, image, and schematic operations in the same repository.

The public browsing/account/cart experience is the React SPA in `frontend/`. WordPress/WooCommerce under `drywalltoolbox/wp/` is the commerce and operational backend. WooCommerce owns checkout order creation. The official WooCommerce Stripe Payment Gateway owns embedded payment rendering, supported Stripe payment methods, eligible wallets, payment processing, and webhook synchronization. DTB observes verified Woo order/payment lifecycle events for order projections and downstream queues. Veeqo is the inventory and fulfillment authority. QuickBooks receives accounting projections.

## Primary users

### External

- professional drywall contractors and crews;
- buyers ordering tools, parts, accessories, and tool sets;
- customers submitting repairs, returns, and support requests;
- customers reviewing order, shipment, repair, return, and support status.

### Internal

- operators managing orders, repairs, returns, support, and exceptions through wp-admin workbenches;
- catalog operators maintaining taxonomy, product metadata, pricing, images, and schematics;
- administrators managing platform health, the official Stripe gateway, Veeqo, QuickBooks, marketplace channels, and deployment operations.

## Live capability map

### Storefront and checkout

- catalog browsing, search, brand/category filtering, and product detail/variation selection;
- Store API-backed cart in the React storefront;
- full-document checkout handoff from React cart/cart sidebar to `/checkout/`;
- root `.htaccess` routes `/checkout/` to the WordPress/WooCommerce checkout instead of the React SPA shell;
- WooCommerce renders the assigned Checkout page using the native Checkout Block;
- the official WooCommerce Stripe Payment Gateway renders embedded payment fields, eligible express wallets, Link where enabled, saved-method UI, and payment errors inside Woo checkout;
- WooCommerce creates the storefront order through Checkout Block/Store API;
- the official Stripe gateway and its webhooks synchronize payment status back to WooCommerce;
- DTB tags Woo checkout orders, observes verified paid official-Stripe orders, appends order events, and dispatches downstream jobs through `dtb-orders`;
- order confirmation, authenticated history, and customer tracking projections from WooCommerce orders;
- checkout shipping options calculated by Woo/DTB policy from destination, subtotal, product type, and weight;
- Veeqo-backed cart availability and downstream inventory/fulfillment processing.

The current checkout shipping-rate policy is not a live Veeqo carrier-rating API. Veeqo remains authoritative for inventory, allocation, fulfillment, labels, shipment state, and tracking.

### Parts and schematics

- schematic browser and part lookup;
- product/variation SKU resolution;
- compatible and universal-parts projections;
- runtime schematic media manifest and operator mapping/editor tools.

### Repairs

- repair-service overview, package selection, intake, media upload, and tracking;
- quote generation and public-token/customer accept or decline actions;
- lifecycle event stream, SLA, notification, queue, and operator workbench implementation in `dtb-repair-service`.

### Returns and support

- return portal and customer return-status pages;
- support/contact intake and ticket-status pages;
- authenticated return and support histories;
- backend lifecycle ownership in `dtb-returns` and `dtb-support`.

### Account and authentication

- login, registration, logout, forgot/reset-password flows;
- tabbed account dashboard for orders, repairs, addresses, and settings;
- HttpOnly `dtb_auth` cookie with optional in-memory bearer-token compatibility;
- account profile and password-change APIs;
- application-wide `auth:expired` handling after confirmed authentication failure.

### Rewards

Rewards UI routes and historical compatibility code exist, but the integration bootstrap intentionally omits rewards service/job/controller loading for the initial production launch. Rewards must be treated as disabled unless the backend module is explicitly restored and validated.

### Content and tools

- calculator hub, FAQ, shipping policy, return policy, and store policies;
- technical-specification preview tooling;
- public toolset-builder route remains disabled until launch criteria are met.

## Backend product responsibilities

The WordPress layer is a headless product backend and operator cockpit, not the public storefront renderer. It owns:

- custom REST APIs and Store API extension behavior;
- catalog read models, variation normalization, compatibility, and inventory intelligence;
- WooCommerce checkout routing/styling support, official Stripe gateway readiness notices, Woo checkout order tagging, order event ledger, queue, write boundary, duplicate containment, and tracking projections;
- repair, return, and support persistence and lifecycle policy;
- authentication, authorization, origin policy, rate limiting, and operational health;
- media and schematic administration;
- Veeqo, QuickBooks, notification, and marketplace integrations;
- wp-admin command-center, system-manager, and domain workbench surfaces.

## Operational product reality

This repository is both:

1. the production application source for `drywalltoolbox.com`; and
2. the controlled operations workspace for catalog and media lifecycle management.

`products/` and `scripts/` are core product infrastructure. SKUs, part numbers, brand names, external IDs, image mappings, schematic paths, and taxonomy policy are business-critical identifiers.

## Scope and authority boundaries

- React owns customer-facing browsing, cart shell, account UX, and checkout handoff rendering.
- WordPress/WooCommerce owns the public checkout route and order creation surface.
- Mu-plugin modules are the canonical home for backend business logic.
- The official WooCommerce Stripe Payment Gateway owns embedded payment rendering, supported Stripe methods, eligible wallets, payment processing, and webhook synchronization.
- WooCommerce owns products, customers, Store API cart state, and operational orders.
- DTB owns order observation, downstream eventing/projections/queues, checkout routing support, domain workflows, and integration policy.
- Veeqo owns inventory and fulfillment truth.
- QuickBooks owns accounting projection after qualifying order/refund events.
- Storefront order creation occurs through WooCommerce checkout and the official Stripe gateway; raw external WooCommerce order creation remains blocked or retired.
- Browser code never receives WooCommerce admin credentials, application passwords, consumer secrets, Stripe secret keys, Stripe webhook secrets, wallet tokens, PaymentIntent client secrets, or integration API keys.
- Controlled catalog taxonomy is validated before production import.

## Non-goals

- returning to a classic WordPress theme-first storefront for catalog/account browsing;
- copying or mounting payment plugin private React/build internals inside the React SPA;
- building custom DTB Stripe Checkout Sessions for storefront checkout while the official WooCommerce Stripe Payment Gateway is the payment authority;
- building separate React payment iframe surfaces for Apple Pay / Google Pay / Link;
- building a separate admin SPA when wp-admin workbenches already own operations;
- treating catalog/media maintenance as unrelated to application engineering;
- using the browser as an integration credential store;
- allowing multiple systems to create or mutate the same order without a write boundary and idempotency contract.

## One-line truth statement

Drywall Toolbox is a headless React and WordPress/WooCommerce contractor platform unifying ecommerce, schematic-driven parts, repairs, returns, support, and operator workflows, with WooCommerce Checkout Block and the official WooCommerce Stripe Payment Gateway for same-domain embedded checkout/payment, DTB-controlled order observation/projections, Veeqo-controlled inventory/fulfillment, QuickBooks accounting projection, and first-class catalog/media operations.
