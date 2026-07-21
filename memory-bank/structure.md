# Structure

Last verified against active source: 2026-07-20 (current `main` head observed at `763a58779b75951ae96fd5c65c65b3e965af06f8`).

## Architecture truth

Drywall Toolbox is a headless commerce and operations platform with four primary repository layers:

1. `frontend/` — React SPA and customer-facing route/UI implementation.
2. `drywalltoolbox/` — tracked production deployment mirror; WordPress/WooCommerce application code lives under `drywalltoolbox/wp/`.
3. `products/` — production catalog, taxonomy, image, schematic, pricing, compatibility, source, launch, and audit data.
4. `scripts/` — deterministic catalog/media/checkout/operational tooling.

There is no canonical root-level `wp/` application directory. Backend edits belong under `drywalltoolbox/wp/` unless a task explicitly targets deployment documentation or runtime/generated state.

Generated `dist/` output is not a source editing target.

## Repository map

```text
drywall-toolbox/
├─ .github/
│  ├─ copilot-instructions.md
│  └─ workflows/
│     ├─ ci-build.yml
│     └─ deploy.yml
├─ dist/                                  generated frontend build output
├─ docs/                                  current architecture/operations/reference docs
├─ drywalltoolbox/                        tracked HostGator deployment mirror
│  ├─ .htaccess                           domain-root routing/security/cache policy
│  ├─ logos/
│  └─ wp/
│     ├─ .htaccess                        WordPress-subdirectory routing policy
│     ├─ index.php
│     └─ wp-content/
│        ├─ mu-plugins/                    canonical DTB backend platform
│        └─ themes/                        headless/backend-support themes
├─ frontend/                              React storefront source
├─ memory-bank/                           durable project context
│  ├─ product.md
│  ├─ structure.md
│  └─ tech.md
├─ products/                              catalog/media/source/launch operations workspace
├─ scripts/                               operational and validation tooling
├─ AGENTS.md                              repository engineering authority contract
├─ coming-soon.html
└─ README.md
```

## Production topology

```text
/public_html/drywalltoolbox/              public document root
├─ index.html                             React application shell
├─ assets/                                compiled React assets
├─ .htaccess                              HTTPS, WP/REST aliases, native checkout routing, SPA fallback
├─ logos/
├─ staging/{id}/                          staging React build roots where deployed
└─ wp/                                    WordPress + WooCommerce runtime
   ├─ wp-admin/
   ├─ wp-includes/
   ├─ wp-content/
   └─ wp-config.php                       runtime-only; never deployed from Git
```

Repository `dist/` contents are the frontend payload source for the document root. Tracked `drywalltoolbox/wp/wp-content/mu-plugins/` and theme trees are deployment-source code for the live `/wp/wp-content/` runtime.

Uploads, runtime cache, WordPress core, `wp-config.php`, upgrade state, and secrets are server-owned/runtime-managed and must not be included in normal deployment payloads.

## Request flow

```text
Browser
  -> domain-root drywalltoolbox/.htaccess
     -> native Woo/WP routes before SPA fallback
        /wp-json/*
        /wp-admin/*
        /checkout/
        /checkout/order-pay/*
        /checkout/order-received/*
        WooCommerce wc-api callbacks
     -> existing static file / React index.html for SPA routes
  -> React route in frontend/src/App.jsx
  -> frontend/src/api/*, hooks, contexts, analytics
  -> /wp-json/dtb/v1/*
     /wp-json/drywall/v1/*
     /wp-json/headless/v1/*
     /wp-json/wc/store/v1/*
  -> WordPress REST server / WooCommerce Store API
  -> DTB controller/service/repository or WooCommerce runtime
  -> WooCommerce, DTB persistence, Action Scheduler, Veeqo, QuickBooks
```

React owns public rendering and browser interaction state. Backend modules own authorization, authoritative validation, persistence, lifecycle transitions, integration policy, and operational side effects.

Checkout is intentionally a native WordPress/WooCommerce document, not a React payment runtime.

## Frontend structure

```text
frontend/
├─ public/                        copied static/public assets
├─ scripts/                       build-safety and artifact-cleanup scripts
├─ server/                        local review/dev support
├─ src/
│  ├─ analytics/                  ecommerce/client instrumentation
│  ├─ api/                        canonical browser data-access layer
│  ├─ assets/
│  ├─ auth/                       auth provider/session/token behavior
│  ├─ components/
│  │  ├─ account/
│  │  ├─ calculators/
│  │  │  └─ report/               canonical calculator report/PDF presentation
│  │  ├─ cart/
│  │  ├─ catalog/
│  │  ├─ dashboard/
│  │  ├─ errors/
│  │  ├─ product/
│  │  ├─ repairs/
│  │  ├─ routing/
│  │  ├─ schematics/
│  │  ├─ shared/
│  │  ├─ shell/
│  │  ├─ storefront/
│  │  ├─ system/
│  │  └─ ui/
│  ├─ constants/
│  ├─ context/
│  ├─ data/
│  ├─ hooks/
│  ├─ motion/
│  ├─ pages/                      route-level screens
│  ├─ services/                   compatibility/facade layer; do not expand
│  ├─ styles/
│  ├─ utils/
│  │  ├─ checkoutPrewarm.js       low-priority static checkout asset prewarm
│  │  └─ checkoutUrl.js           native checkout URL/handoff helpers
│  ├─ App.jsx                     providers and route composition
│  └─ main.jsx                    browser bootstrap
├─ package.json
└─ webpack.config.cjs
```

### Frontend ownership rules

- Register public routes in `frontend/src/App.jsx`.
- Put new server communication in `frontend/src/api/`.
- Keep `frontend/src/services/` credential-free and compatibility-only.
- Use auth/session primitives under `frontend/src/auth/` and `frontend/src/api/client.js`.
- Use WooCommerce Store API for public cart/session operations; admin Woo credentials stay server-side.
- React `/checkout` is a compatibility handoff route only and must force full-document navigation to native Woo checkout.
- Do not mount a second payment runtime in React.
- Do not edit `dist/` as source.

## Public route groups

Current `frontend/src/App.jsx` includes these route families:

### Storefront/catalog

- `/`
- `/products`
- `/products/brands`
- `/products/brands/:brandSlug`
- `/products/brands/:brandSlug/categories/:categorySlug`
- `/products/:slug`
- `/products/:slug/variations/:variationId`
- `/category/:slug`
- compatibility redirect `/all-products`

### Parts/schematics

- `/parts`
- `/product/:partNumber`
- `/schematics`

### Repairs

- `/repairs`
- `/repairs/start`
- `/repairs/packages`
- `/repairs/track`
- `/repairs/status/:id`
- authenticated `/dashboard/repairs/:id`

### Commerce

- `/cart`
- `/checkout` — compatibility handoff only
- `/checkout/complete`
- `/checkout/payment-failed`
- `/checkout/payment-cancelled`
- `/checkout/order-received/:id`
- `/order/:id`
- `/order-tracking/:id`

Native `/checkout/`, order-pay, order-received, and provider callback routes are owned by WordPress/WooCommerce routing before SPA fallback.

### Returns/support

- `/returns`
- `/returns/status/:id`
- `/return-policy`
- `/contact`
- `/support/status/:id`

### Account/auth

- `/login`
- `/register`
- `/forgot-password`
- `/reset-password`
- `/dashboard`
- `/orders` -> dashboard tab redirect
- `/rewards` -> gated dashboard redirect
- `/account-settings` -> dashboard tab redirect
- `/addresses` -> dashboard tab redirect
- `/notifications` -> dashboard tab redirect
- protected `/settings/woocommerce`

### Content/tools

- `/calculators`
- `/faq`
- `/shipping-policy`
- `/policies`
- `/preview/technical-specifications`

The public toolset-builder route remains commented out/disabled in `App.jsx`.

## Calculator report structure

Canonical customer-facing report/export code:

```text
frontend/src/components/calculators/report/
├─ CalculatorReport.jsx
├─ calculatorReportModel.js
├─ calculator-report.css
└─ README.md
```

`calculatorReportModel.js` is the canonical presentation mapper from calculator summary state into the report model. Summary and printable output must consume that model rather than maintaining parallel export calculations.

The report layer formats existing calculator outputs. It does not own calculation authority.

The PDF workflow uses browser print/Save-as-PDF with scoped print isolation. It does not add a WordPress PDF endpoint or external PDF service.

The historical `calc-pdf/files/` reference directory has been removed from current source.

## Backend composition

Composition root:

```text
drywalltoolbox/wp/wp-content/mu-plugins/00-dtb-loader.php
```

Canonical loader-managed order:

1. `dtb-platform/`
2. `dtb-catalog-platform/`
3. `dtb-commerce/`
4. `dtb-order-platform/`
5. `dtb-schematics/`
6. `dtb-media/`
7. `dtb-marketing/`
8. `dtb-repair-service/`
9. `dtb-integrations/`
10. `dtb-support/`
11. `dtb-returns/`

### `dtb-platform/`

Shared configuration, support primitives, origin/CORS policy, API security, authentication/session behavior, cache/health/observability, account/history APIs, Command Center, System Manager, and platform administration.

### `dtb-catalog-platform/`

Catalog domain models, Woo/product repositories, normalization, facets, variation read models, product relationships, compatible/universal parts, inventory intelligence, validation, REST controllers, CLI/admin tools.

Current repository layering includes the active product repository implementation under:

```text
dtb-catalog-platform/Infrastructure/CatalogProductRepository.php
```

A historical duplicate `Services/CatalogProductRepository.php` was removed. Do not recreate parallel repository authorities.

Primary React PDP read model remains:

```text
GET /wp-json/dtb/v1/catalog/products/{slug}/detail
```

### `dtb-commerce/`

Owns:

- WooCommerce Store API cart extension data;
- checkout validation/field policy;
- native Woo checkout runtime exception for the headless theme;
- storefront return-context routing metadata;
- official Stripe checkout readiness/capability metadata;
- native checkout presentation and supported Stripe Appearance configuration;
- mobile payment-sheet presentation/accessibility hardening;
- checkout performance/static prewarm metadata/runtime telemetry;
- checkout order tagging and non-secret paid-reference mirroring;
- DTB shipping method/policy;
- order-type/query and branded email support;
- commerce-facing REST/admin surfaces.

Key checkout files:

```text
dtb-commerce/Payment/WooNativeCheckoutRuntime.php
dtb-commerce/Payment/StorefrontReturnContext.php
dtb-commerce/Payment/OfficialStripeNativeCheckout.php
dtb-commerce/Payment/MobilePaymentSheet.php
dtb-commerce/Payment/CheckoutPerformance.php
dtb-commerce/Templates/WooNativeCheckoutPage.php
```

Key checkout assets:

```text
dtb-commerce/assets/woo-native-checkout.css
dtb-commerce/assets/woo-native-checkout-steps.js
dtb-commerce/assets/woo-native-checkout-ui.js
dtb-commerce/assets/woo-native-checkout-payment-sheet.css
dtb-commerce/assets/woo-native-checkout-payment-sheet.js
dtb-commerce/assets/woo-native-checkout-profile-refinements.css
dtb-commerce/assets/woo-native-checkout-profile-refinements.js
dtb-commerce/assets/woo-native-checkout-performance.js
```

### `dtb-order-platform/`

Owns:

- order lifecycle/status domain;
- append-only event ledger;
- integration-state persistence;
- `dtb-orders` Action Scheduler queue/retry;
- order write boundary and duplicate containment;
- captured-payment lifecycle observation;
- atomic initial downstream-dispatch barrier;
- refund lifecycle keyed by concrete Woo `refund_id`;
- customer/operator tracking projections and order REST/admin surfaces.

The retired custom checkout-session repository is not part of the active native Checkout Block runtime.

### `dtb-schematics/` and `dtb-media/`

Schematic mapping/editor/runtime APIs plus image/media synchronization, validation, registration, repair, and operator workflows.

### `dtb-repair-service/`, `dtb-support/`, `dtb-returns/`

Independent bounded lifecycle modules. Each owns its domain statuses, persistence, authorization, customer endpoints, operator queues/workbench, notifications, and lifecycle events.

### `dtb-integrations/`

Server-side integration adapters/orchestration for WooCommerce, Veeqo, QuickBooks, notifications, and marketplace channels.

Order-related external side effects must respect the order-platform queue/write-boundary/idempotency contracts.

## Checkout and fulfillment flow

```text
React cart / cart drawer
  -> WooCommerce Store API cookie-backed cart session + Nonce
  -> successful cart engagement may schedule low-priority static prewarm
  -> canonical full-document /checkout/
  -> root .htaccess routes request to WordPress
  -> WooNativeCheckoutRuntime preserves native Woo/plugin runtime
  -> assigned WooCommerce Checkout page
  -> WooCommerce Checkout Block
  -> official WooCommerce Stripe Payment Gateway
  -> WooCommerce order/payment lifecycle
  -> DTB verified captured-payment event
  -> dtb-orders Action Scheduler queue
  -> Veeqo inventory/fulfillment synchronization
  -> QuickBooks accounting projection
  -> notifications/customer tracking projections
```

Only WooCommerce Checkout Block may create storefront orders.

Legacy raw Woo order creation, DTB-owned checkout session/finalization, browser-created Stripe payment flows, and competing parallel gateways remain retired/disallowed.

## Mobile payment-sheet boundary

The mobile bottom sheet is a presentation shell over the existing Woo Checkout Block payment section.

It may manage dialog chrome, focus containment, viewport adaptation, and a read-only total sourced from `wc/store/cart`.

It must not:

- move/clone provider payment controls;
- create payment objects;
- calculate authoritative totals;
- replace Woo Place Order submission;
- become a second checkout route or payment authority.

## Checkout performance/stability boundary

`CheckoutPerformance.php` and `woo-native-checkout-performance.js` own checkout-specific performance/diagnostics behavior.

The storefront prewarm source is:

```text
frontend/src/utils/checkoutPrewarm.js
```

Current rules:

- low-priority/fail-open only;
- server-provided asset manifest;
- same-origin/backend-origin static DTB assets only plus approved Stripe preconnect origins;
- no prefetch/cache of private `/checkout/` HTML;
- explicit noncritical asset suppression only;
- bounded runtime diagnostics;
- no duplicate authoritative form state;
- no fallback payment flow.

Diagnostics route:

```text
POST /wp-json/dtb/v1/checkout/runtime-telemetry
```

## Data and operations structure

`products/` and `scripts/` are production-relevant application/operations assets.

### Current catalog authority anchors

- taxonomy policy: `products/Production/catalogs/config/production_taxonomy_policy.json`;
- production catalog workspace: `products/Production/catalogs/`;
- launch/reference workspace: `products/launch/`;
- scripts must inspect current path layout rather than relying on historical `products/Production/launch/` assumptions.

Recent repository reorganization moved numerous launch/reference assets out of `products/Production/launch/` into `products/launch/` and consolidated catalog/source/report materials under `products/Production/catalogs/`.

Preserve stable business identifiers and provenance during future moves.

## System authority map

- **React:** public rendering, browsing/cart/account/service/calculator UX, checkout handoff, local interaction state.
- **WooCommerce:** products, customers, Store API cart/session, Checkout Block, addresses, shipping/tax/totals, orders, refunds, authoritative order/payment record.
- **Official WooCommerce Stripe Payment Gateway:** card/payment-method rendering, Link, eligible express wallets, tokenization, 3DS/SCA, payment execution, webhook synchronization.
- **DTB:** domain policy, native-checkout routing/presentation/diagnostics, verified order observation, write boundaries, event ledger, queues, projections, catalog/media/schematic/repair/return/support workflows, operator tooling, integrations.
- **Veeqo:** sellable inventory, warehouse availability, allocation, fulfillment, labels, shipment state, carrier, tracking.
- **QuickBooks:** accounting projection after eligible payment/refund events.

## CI and deployment structure

### CI

`.github/workflows/ci-build.yml` runs for:

- pull requests to `main`;
- pushes to `main`;
- manual dispatch.

Current build job:

1. checkout;
2. Node 20 setup;
3. `npm ci --include=dev`;
4. frontend lint;
5. frontend production build;
6. `scripts/smoke-dtb-mobile-payment-sheet.ps1`;
7. `scripts/smoke-dtb-checkout-performance.ps1`;
8. assemble bounded `deploy-root` payload;
9. validate required payload shape and reject forbidden runtime content.

CI does not deploy production.

### Deployment workflow current state

`.github/workflows/deploy.yml` currently defines manual `deploy`/`restore` inputs, confirmation controls, full/selective scope inputs, build/package behavior, a protected `hostgator-production` environment for the pre-deploy backup job, and backup metadata setup.

At the verified current source state, the checked-in workflow ends after a placeholder step:

```text
Continuing existing controlled deployment workflow...
```

The active file does not presently contain a complete executable upload/smoke/rollback/restore sequence after that point.

Therefore:

- merge is not deployment;
- workflow presence is not proof of production release capability;
- do not claim automated deploy/rollback/restore completed unless active workflow source and run evidence prove it;
- the intended controlled release contract must be restored/validated before relying on it operationally.

## Navigation model for engineers

When locating logic:

- UI/UX route bug: `frontend/src/pages/*`, then `frontend/src/components/*`;
- frontend server access: `frontend/src/api/*`;
- cart/session/handoff: `frontend/src/context/CartContext.jsx`, `frontend/src/api/cart.js`, checkout URL/navigation utilities;
- calculator report/export: `frontend/src/components/calculators/report/*`;
- backend business logic/API: `drywalltoolbox/wp/wp-content/mu-plugins/*`;
- native checkout/payment presentation/readiness: `dtb-commerce/Payment/*` and `dtb-commerce/assets/woo-native-checkout*`;
- order lifecycle/queues/idempotency: `dtb-order-platform/*`;
- integrations: `dtb-integrations/*`;
- catalog operational rules/data: `products/Production/catalogs/*`, `products/launch/*`, and `scripts/*`;
- routing/deployment boundaries: `drywalltoolbox/.htaccess`, `drywalltoolbox/wp/.htaccess`, `.github/workflows/*`.

Always inspect the active source before editing; this structure map is durable orientation, not a substitute for source verification.