# Tech

Last verified against source: 2026-07-20.

## Runtime stack

### Frontend (`frontend/`)

- React 19.2 and React DOM 19.2;
- React Router 7.13;
- Axios plus fetch-based API wrappers;
- Framer Motion;
- React Helmet Async;
- React Markdown + `remark-gfm` + DOMPurify;
- `lucide-react`;
- Webpack 5/Babel build pipeline;
- Tailwind CSS v4 + PostCSS/Autoprefixer.

The frontend does not own payment execution or storefront order creation. Stripe client packages remain installed, but the active storefront checkout/payment authority is native WooCommerce Checkout Block plus the official WooCommerce Stripe Payment Gateway.

### Backend (`drywalltoolbox/wp/`)

- WordPress in headless usage;
- WooCommerce;
- official WooCommerce Stripe Payment Gateway as storefront payment authority;
- DTB must-use plugin suite under `drywalltoolbox/wp/wp-content/mu-plugins/`;
- `00-dtb-loader.php` composition root with 11 ordered module bootstraps;
- Action Scheduler for queued order/integration work;
- headless/backend-support themes under `drywalltoolbox/wp/wp-content/themes/`.

### External authorities

- WooCommerce: products, customers, cart/session, checkout state, orders, refunds, authoritative operational payment/order state;
- official WooCommerce Stripe gateway: payment-method rendering/eligibility, Link, eligible wallets, saved methods, tokenization, 3DS/SCA, payment execution, webhook reconciliation;
- DTB order platform: lifecycle events, captured-payment gating, idempotency, integration state, write boundary, queue, customer/operator projections;
- Veeqo: inventory, allocation, fulfillment, labels, shipment status, carrier, tracking;
- QuickBooks: accounting projection after eligible payment/refund events;
- marketplace integrations: server-side Amazon/eBay operational ingestion and exception handling.

Checkout shipping rates are Woo/DTB policy rates, not live Veeqo carrier quotes.

## Backend module chain

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

New business logic belongs inside the owning module subtree.

## Build and tooling

Current frontend package/build profile:

- Node.js 20 in CI;
- locked install with `npm ci --include=dev`;
- Webpack 5.106;
- Babel 7;
- ESLint 9 flat config;
- Tailwind CSS 4.1;
- Workbox `GenerateSW`;
- Terser/CSS minimization;
- optional bundle analysis with `ANALYZE=true`;
- `sharp` available for image tooling;
- Python and PowerShell operational scripts elsewhere in the repository.

`frontend/package.json` build commands:

```text
npm run build
npm run build:staging
npm run clean:build-cache
npm run lint
```

Production/staging builds run public-environment safety checks and generated-output cleanup. Current build configuration disables production/staging disk caches and source maps by default unless explicit diagnostic opt-ins are set.

## Environment and browser-safety model

`REACT_APP_*` values are public at build time. They may contain public URLs, route bases, environment identifiers, and feature flags, but never server integration credentials or payment secrets.

Preferred browser auth uses HttpOnly `dtb_auth`; compatibility bearer tokens are memory-only. Same-origin authenticated/session requests preserve credentials.

Current rewards state must be read from source, not environment alone: `isRewardsEnabled()` returns false and rewards services/jobs/controllers are omitted from integration bootstrap.

## Frontend API/session model

Canonical browser communication uses:

- `frontend/src/api/client.js` for DTB/proxy calls;
- `frontend/src/api/cart.js` for Woo Store API cart/session operations;
- domain modules under `frontend/src/api/`;
- cookie credentials for same-origin session/auth requests;
- optional in-memory bearer compatibility only.

Same-origin Woo cart continuity uses the WooCommerce cookie-backed session. Store API mutations use `Nonce` semantics. `Cart-Token` is compatibility-only for genuinely cross-origin clients and must not become a second persisted same-origin cart.

## Checkout runtime architecture

React owns cart UX and checkout handoff. `/checkout` in React is compatibility routing; the authoritative document is WordPress/WooCommerce.

Critical backend files:

```text
dtb-commerce/Payment/WooNativeCheckoutRuntime.php
dtb-commerce/Payment/OfficialStripeNativeCheckout.php
dtb-commerce/Payment/MobilePaymentSheet.php
dtb-commerce/Payment/CheckoutPerformance.php
dtb-commerce/Templates/WooNativeCheckoutPage.php
```

The native runtime exempts checkout/payment endpoints from normal headless-theme SPA forcing and hosts the assigned Woo Checkout page. It does not manually instantiate Checkout Block, provider fields, payment objects, or orders.

### Mobile payment sheet

The mobile `Contact -> Shipping -> Payment` flow is presentation layered over the existing Checkout Block.

- provider-owned payment nodes remain mounted;
- no clone/reparent/recreate behavior;
- final submission remains Woo Place Order;
- mobile `Pay now` labeling uses supported Checkout Block filtering;
- displayed `Total due` is read from Woo Blocks `wc/store/cart` state;
- focus containment must yield to provider-owned challenge/modal focus;
- software-keyboard and viewport handling must not hide provider errors or final action.

### Checkout performance and stability

`CheckoutPerformance.php` and `woo-native-checkout-performance.js` own checkout-only performance/stability policy.

Current capabilities include:

- checkout resource hints and DTB CSS preload;
- low-priority static checkout prewarm after successful cart engagement;
- prewarm manifest returned through read-safe capability metadata;
- explicit suppression of known non-essential checkout marketing/tracking resources;
- order-summary image loading policy;
- bounded runtime diagnostics for JS/resource/provider/root-replacement/layout/performance issues;
- payment-surface timeout recovery presentation.

Prewarm must never fetch or cache session-owned `/checkout/` HTML.

Diagnostics route:

```text
POST /wp-json/dtb/v1/checkout/runtime-telemetry
```

It is diagnostics-only and protected by dedicated nonce/origin/rate-limit/allowlist/bounds/redaction controls. It never mutates authoritative cart/order/payment state and makes no slow external calls during checkout.

## Calculator report architecture

Owning frontend subtree:

```text
frontend/src/components/calculators/report/
├─ calculatorReportModel.js
├─ CalculatorReport.jsx
├─ calculator-report.css
└─ README.md
```

`calculatorReportModel.js` is the canonical presentation mapper from calculator summary state to printable report data. The report renderer formats grouped values but does not recalculate estimator authority.

Export is browser-native preview + print/Save-as-PDF. Print isolation is scoped to calculator report mode. Current workflow adds no server-side PDF endpoint or external PDF service.

## API surface model

### `dtb/v1`

Primary DTB platform/domain APIs: auth/account, catalog, checkout capability/diagnostics, schematics/media, repairs, returns, support, integration/admin/health surfaces.

### `drywall/v1`

Compatibility/proxy surfaces. Raw storefront order creation remains retired.

### `headless/v1`

Theme-level headless support endpoints.

### `wc/store/v1`

WooCommerce Store API for public cart/session operations.

## Security posture

- preferred HttpOnly cookie authentication;
- no integration/payment/server credentials persisted in browser storage;
- centralized origin/CORS policy;
- explicit REST permission callbacks;
- customer ownership validation independent of caller-supplied IDs;
- provider webhook authentication remains with the owning integration/payment plugin;
- order write boundary and idempotent queues protect duplicate side effects;
- checkout diagnostics are bounded and redact sensitive values before persistence.

## Routing and cache contract

`drywalltoolbox/.htaccess` routes these to WordPress before SPA fallback:

- root REST aliases;
- WordPress admin/login aliases;
- `/checkout/`;
- checkout order-pay/order-received variants;
- WooCommerce `wc-api` callbacks;
- staging checkout equivalents.

Checkout/payment/session-owned surfaces must remain private/no-store. React static assets may be cached normally. Root cache-bypass behavior must not destroy independent WordPress/WooCommerce session headers.

## Async and integration execution

Order-related external effects use `dtb_order_enqueue_job()` and Action Scheduler group `dtb-orders`.

Initial fulfillment/accounting dispatch occurs only after the captured-payment contract passes and remains protected against duplicate dispatch. Refund projection preserves concrete Woo `refund_id` identity so multiple partial refunds remain distinct.

## CI and deployment reality

`.github/workflows/ci-build.yml` is active for pushes/PRs to `main` and manual dispatch. It currently performs:

- Node 20 setup;
- frontend dependency install;
- lint;
- production build;
- `scripts/smoke-dtb-mobile-payment-sheet.ps1`;
- `scripts/smoke-dtb-checkout-performance.ps1`;
- deploy-payload assembly/boundary checks.

`.github/workflows/deploy.yml` is manual-only and currently stops after build/package + protected HostGator backup snapshot logic with a placeholder indicating remaining deployment/restore work. Do not treat it as a verified complete deploy/restore/rollback workflow until the missing sequence is implemented and validated.

Current repository gap: historical paths `scripts/smoke-dtb-mu-modules.ps1` and `scripts/smoke-dtb-catalog-api.ps1` are not presently tracked. Do not claim those scripts ran. Use available targeted checks and report the gap when those coverage classes are required.

## Engineering conventions

- backend rules stay in bounded mu-plugin modules;
- new frontend data access stays in `frontend/src/api/`;
- React remains public renderer/cart UX/handoff surface, not payment authority;
- Woo/official Stripe remain checkout/payment authority;
- order/integration side effects use canonical write-boundary/queue/idempotency contracts;
- checkout performance work fails open and never caches private session documents;
- calculator report rendering never becomes a second calculation engine;
- update durable docs whenever authorities, routes, queues, runtime topology, or deployment behavior change;
- never claim validation, merge, deployment, or production health without direct evidence.
