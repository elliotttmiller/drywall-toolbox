# Product

Last verified against source: 2026-07-17.

## Product definition

Drywall Toolbox (`drywalltoolbox.com`) is a contractor-focused headless commerce and service-operations platform for professional drywall tools, replacement parts, and repair services.

It combines:

- multi-brand ecommerce backed by WooCommerce operational orders and Stripe Embedded Checkout for storefront checkout/payment workflow;
- schematic-driven part discovery and product compatibility;
- repair intake, quoting, lifecycle tracking, and operator workflows;
- returns and support-ticket workflows with customer-facing status views;
- customer account, address, order-history, and preference experiences;
- catalog, taxonomy, pricing, image, and schematic operations in the same repository.

The public experience is the React SPA in `frontend/`. WordPress/WooCommerce under `drywalltoolbox/wp/` is the commerce and operational backend. Stripe Embedded Checkout owns the checkout UI workflow. DTB bridges verified Stripe Checkout Sessions into WooCommerce orders. Veeqo is the inventory and fulfillment authority. QuickBooks receives accounting projections.

## Primary users

### External

- professional drywall contractors and crews;
- buyers ordering tools, parts, accessories, and tool sets;
- customers submitting repairs, returns, and support requests;
- customers reviewing order, shipment, repair, return, and support status.

### Internal

- operators managing orders, repairs, returns, support, and exceptions through wp-admin workbenches;
- catalog operators maintaining taxonomy, product metadata, pricing, images, and schematics;
- administrators managing platform health, Stripe, Veeqo, QuickBooks, marketplace channels, and deployment operations.

## Live capability map

### Storefront and checkout

- catalog browsing, search, brand/category filtering, and product detail/variation selection;
- Store API-backed cart with a Stripe-first DTB checkout bridge;
- Stripe Embedded Checkout collects contact, billing/shipping address, shipping option context, tax/payment context, payment method, wallets, saved-method UI, and localized checkout UX;
- DTB creates Stripe Checkout Sessions from a server-authoritative WooCommerce cart snapshot;
- DTB verifies Stripe webhooks and materializes WooCommerce orders only after verified paid Checkout Sessions;
- order confirmation, authenticated history, and customer tracking projections from materialized WooCommerce orders;
- checkout shipping options calculated by DTB/Woo policy from destination, subtotal, product type, and weight through the Stripe dynamic-shipping callback;
- Veeqo-backed cart availability and downstream inventory/fulfillment processing.

The current checkout shipping-rate endpoint and Stripe dynamic-shipping callback are not live Veeqo carrier-rating APIs. Veeqo remains authoritative for inventory, allocation, fulfillment, labels, shipment state, and tracking.

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
- Stripe Embedded Checkout Session creation, dynamic shipping update handling, Stripe webhook verification, WooCommerce order materialization, order event ledger, queue, write boundary, duplicate containment, and tracking projections;
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

- React owns customer-facing rendering and interaction state.
- WordPress themes provide backend/headless support and payment/runtime callback surfaces, not the primary storefront renderer.
- Mu-plugin modules are the canonical home for backend business logic.
- Stripe Embedded Checkout owns storefront checkout UI, payment method collection, wallets, saved payment/address UI, and Stripe payment status.
- WooCommerce owns products, customers, materialized orders, and Store API cart state.
- DTB owns checkout orchestration, Stripe session creation, dynamic shipping policy, webhook verification, order materialization, domain workflows, eventing, projections, queues, and integration policy.
- Veeqo owns inventory and fulfillment truth.
- QuickBooks owns accounting projection after qualifying order/refund events.
- Storefront order materialization occurs only through the DTB Stripe Embedded Checkout bridge after verified Stripe payment; raw external WooCommerce order creation is blocked or retired.
- Browser code never receives WooCommerce admin credentials, application passwords, consumer secrets, Stripe secret keys, Stripe webhook secrets, or integration API keys.
- Controlled catalog taxonomy is validated before production import.

## Non-goals

- returning to a classic WordPress theme-first storefront;
- building a separate admin SPA when wp-admin workbenches already own operations;
- treating catalog/media maintenance as unrelated to application engineering;
- using the browser as an integration credential store;
- allowing multiple systems to create or mutate the same order without a write boundary and idempotency contract.

## One-line truth statement

Drywall Toolbox is a headless React and WordPress/WooCommerce contractor platform unifying ecommerce, schematic-driven parts, repairs, returns, support, and operator workflows, with Stripe Embedded Checkout for storefront checkout UI, DTB-controlled Stripe-to-WooCommerce order materialization, Veeqo-controlled inventory/fulfillment, QuickBooks accounting projection, and first-class catalog/media operations.
