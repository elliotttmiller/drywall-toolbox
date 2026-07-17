<!-- markdownlint-disable MD013 MD032 -->

# Drywall Toolbox MU-Plugin Architecture and Runtime Contract

Last verified against source: 2026-07-17.

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
- official WooCommerce Stripe gateway readiness notices and checkout-order metadata tagging;
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
React cart/cart sidebar
  -> full-document navigation to /checkout/
  -> .htaccess routes /checkout/ to WordPress
  -> WooCommerce Checkout Block
  -> official WooCommerce Stripe Payment Gateway
  -> WooCommerce order/payment lifecycle
  -> DTB order observation and downstream queues
```

The official WooCommerce Stripe gateway owns payment rendering, payment processing, and Stripe webhook synchronization. DTB must not create parallel Stripe Checkout Sessions or mount copied gateway internals inside the React SPA.
