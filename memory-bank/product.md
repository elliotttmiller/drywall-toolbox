# Product

Last verified against source: 2026-07-12.

## Product definition

Drywall Toolbox (`drywalltoolbox.com`) is a contractor-focused headless commerce and service-operations platform for professional drywall tools, replacement parts, and repair services.

It combines:

- multi-brand ecommerce backed by WooCommerce and WooPayments;
- schematic-driven part discovery and product compatibility;
- repair intake, quoting, lifecycle tracking, and operator workflows;
- returns and support-ticket workflows with customer-facing status views;
- customer account, address, order-history, and preference experiences;
- catalog, taxonomy, pricing, image, and schematic operations in the same repository.

The public experience is the React SPA in `frontend/`. WordPress/WooCommerce under `drywalltoolbox/wp/` is the commerce and operational backend. Veeqo is the inventory and fulfillment authority. QuickBooks receives accounting projections.

## Primary users

### External

- professional drywall contractors and crews;
- buyers ordering tools, parts, accessories, and tool sets;
- customers submitting repairs, returns, and support requests;
- customers reviewing order, shipment, repair, return, and support status.

### Internal

- operators managing orders, repairs, returns, support, and exceptions through wp-admin workbenches;
- catalog operators maintaining taxonomy, product metadata, pricing, images, and schematics;
- administrators managing platform health, Veeqo, QuickBooks, marketplace channels, and deployment operations.

## Live capability map

### Storefront and checkout

- catalog browsing, search, brand/category filtering, and product detail/variation selection;
- Store API-backed cart and a DTB checkout orchestration contract;
- WooPayments/native WooCommerce payment handoff and payment-return states;
- order confirmation, authenticated history, and customer tracking projections;
- checkout shipping options calculated by DTB policy from destination, subtotal, product type, and weight;
- Veeqo-backed cart availability and downstream inventory/fulfillment processing.

The current checkout shipping-rate endpoint is not a live Veeqo carrier-rating API. Veeqo remains authoritative for inventory, allocation, fulfillment, labels, shipment state, and tracking.

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
- checkout finalization, order event ledger, queue, payment webhooks, write boundary, duplicate containment, and tracking projections;
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
- WordPress themes provide backend/headless support and payment runtime templates, not the primary storefront.
- Mu-plugin modules are the canonical home for backend business logic.
- WooCommerce owns orders, payments, customers, products, and Store API cart state.
- DTB owns checkout orchestration, domain workflows, eventing, projections, queues, and integration policy.
- Veeqo owns inventory and fulfillment truth.
- QuickBooks owns accounting projection after qualifying order/refund events.
- Storefront order creation occurs only through the DTB checkout pipeline; raw external WooCommerce order creation is blocked or retired.
- Browser code never receives WooCommerce admin credentials, application passwords, consumer secrets, or integration API keys.
- Controlled catalog taxonomy is validated before production import.

## Non-goals

- returning to a classic WordPress theme-first storefront;
- building a separate admin SPA when wp-admin workbenches already own operations;
- treating catalog/media maintenance as unrelated to application engineering;
- using the browser as an integration credential store;
- allowing multiple systems to create or mutate the same order without a write boundary and idempotency contract.

## One-line truth statement

Drywall Toolbox is a headless React and WordPress/WooCommerce contractor platform unifying ecommerce, schematic-driven parts, repairs, returns, support, and operator workflows, with Veeqo-controlled inventory/fulfillment, QuickBooks accounting projection, and first-class catalog/media operations.
