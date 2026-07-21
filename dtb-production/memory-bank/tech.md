# Tech

Last verified against active source: 2026-07-20 (current `main` head observed at `763a58779b75951ae96fd5c65c65b3e965af06f8`).

## Runtime stack

### Frontend (`frontend/`)

Current package-level runtime profile includes:

- React `19.2.x`;
- React DOM `19.2.x`;
- React Router DOM `7.13.x`;
- Axios `1.7.x` plus fetch-based wrappers;
- Framer Motion `11.x`;
- React Helmet Async `3.x`;
- React Markdown `10.x`, `remark-gfm`, and DOMPurify;
- `lucide-react` icons;
- `socket.io` / `socket.io-client` for local/dev-support pathways;
- Stripe client packages (`@stripe/react-stripe-js`, `@stripe/stripe-js`) remain installed in `package.json`.

Important authority rule: installed Stripe client packages do **not** mean React owns storefront payment rendering. The active storefront checkout/payment runtime is WooCommerce Checkout Block plus the official WooCommerce Stripe Payment Gateway. React must not create a parallel PaymentIntent/Checkout Session/Elements/wallet authority.

### Backend (`drywalltoolbox/wp/`)

- WordPress in headless usage;
- WooCommerce;
- official WooCommerce Stripe Payment Gateway as the only storefront card/wallet authority;
- custom DTB must-use plugin suite under `drywalltoolbox/wp/wp-content/mu-plugins/`;
- explicit composition root `00-dtb-loader.php` loading 11 bounded modules;
- Action Scheduler for order/integration/other asynchronous work;
- headless/backend-support themes under `drywalltoolbox/wp/wp-content/themes/`.

### Backend module chain

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

New business logic belongs inside the owning module subtree, not a root-level compatibility wrapper.

## System authorities

### WooCommerce

Authoritative for:

- products/customers;
- Store API cart/session state;
- checkout customer/address/shipping/tax/discount/total state;
- Checkout Block/order creation;
- operational orders/refunds;
- authoritative order/payment status record.

### Official WooCommerce Stripe Payment Gateway

Authoritative for:

- embedded Stripe payment-method rendering;
- supported card/local payment methods;
- Link and eligible express wallets;
- tokenization;
- 3DS/SCA and redirects/challenges;
- payment execution/capture behavior;
- Stripe webhook reconciliation into WooCommerce.

### DTB

Authoritative for:

- headless/native checkout routing integration;
- checkout presentation/readiness/performance diagnostics that do not mutate payment authority;
- domain validation/policy;
- verified order/payment/refund lifecycle observation;
- order event ledger, write boundary, idempotency, integration state, queue, projections;
- catalog read models and compatibility intelligence;
- schematics/media/repair/return/support/operator workflows;
- Veeqo/QuickBooks/notifications/marketplace integration policy.

### Veeqo

Authoritative for inventory, warehouse availability, allocation, fulfillment, labels, shipment execution/status, carrier, and tracking.

Current checkout shipping rates are Woo/DTB policy rates, not live Veeqo carrier quotes.

### QuickBooks

Accounting projection after eligible payment/refund lifecycle events. Never storefront order creation.

## Build and tooling

### Frontend

- Node.js 20 in CI;
- locked dependency install via `npm ci --include=dev`;
- Webpack 5;
- Babel (`babel-loader`, `@babel/preset-env`, `@babel/preset-react`);
- Tailwind CSS v4, PostCSS, Autoprefixer;
- ESLint 9 flat config;
- Workbox `GenerateSW`;
- Terser and CSS minimization;
- optional bundle analysis through `ANALYZE=true`;
- `sharp` for build/media tooling where used.

Current `frontend/package.json` scripts:

```text
dev
build
build:staging
clean:build-cache
reviews-server
lint
preview
```

`build` runs public-environment safety checks before/after the production build and cleans generated build artifacts before Webpack.

`build:staging` uses `APP_ENV=staging` and `PUBLIC_URL=/staging/2972` in the current package script.

### Operational tooling

- Python for catalog/source reconciliation, validation, normalization, pricing, image/media, and audit work;
- PowerShell for checkout static contracts, performance audit helpers, and targeted operational tooling;
- repository CSV/JSON/PDF/source datasets under `products/`.

Do not assume historical script names still exist. At this verification point, root paths `scripts/smoke-dtb-mu-modules.ps1` and `scripts/smoke-dtb-catalog-api.ps1` are not present in active source; do not claim those checks ran unless a current equivalent is located and executed.

## Frontend build contract

`frontend/webpack.config.cjs` controls:

- environment loading/compile-time public configuration;
- development/production/staging output behavior;
- hashed asset emission/chunking;
- copied public assets;
- service-worker generation;
- minimization;
- development proxying;
- build cache/source-map behavior.

Production/staging build behavior currently disables Webpack/Babel disk caches and source maps by default unless explicitly opted into for diagnostics. Build scripts clean generated output and matching stale cache; `npm run clean:build-cache` clears frontend build caches.

Only public configuration may be injected through `REACT_APP_*`.

The current production storefront does not require a React Stripe publishable key for checkout authority because Stripe configuration/payment rendering is owned by the official WooCommerce Stripe extension.

## Environment model

### Browser-safe public values

Examples:

- public site/API base URLs;
- Woo Store API path;
- public feature flags;
- environment identifier;
- public launch dates.

### Server-only values

Examples defined through `wp-config.php`, secured host configuration, Woo/Stripe plugin settings, or other protected runtime storage:

- WooCommerce application credentials/consumer secrets;
- `DTB_WC_AUTH_*` credentials;
- JWT signing secrets;
- import/webhook/external-write secrets;
- official Stripe account/secret/webhook configuration;
- Veeqo credentials/authority IDs;
- QuickBooks credentials;
- marketplace credentials;
- private keys/payment secrets.

Never place server-only values in `REACT_APP_*`, browser storage, public REST output, logs, documentation, screenshots, or generated assets.

`wp-config.php`, uploads, cache, WordPress core/runtime state, and secrets are not normal deploy payloads.

## Frontend API/session model

Canonical browser communication uses:

- `frontend/src/api/client.js` for DTB/proxy requests;
- `frontend/src/api/cart.js` for WooCommerce Store API cart/session operations;
- domain-specific modules under `frontend/src/api/`;
- same-origin cookie credentials where required;
- optional bearer compatibility tokens from the in-memory token store only.

Preferred authentication uses HttpOnly `dtb_auth` cookies. Confirmed auth failures fan out through the application `auth:expired` behavior.

For same-origin production/staging cart traffic:

- WooCommerce cookie-backed session is the cart/checkout continuity authority;
- Store API mutations use `Nonce`;
- `Cart-Token` is compatibility-only for genuinely cross-origin clients;
- do not maintain a second persisted same-origin Cart-Token cart that diverges from native `/checkout/`;
- never decode unsigned Cart-Token payloads or query arbitrary Woo session rows to recover browser state.

## Checkout runtime architecture

### React handoff

React owns cart page/drawer and the checkout CTA/handoff only.

`frontend/src/pages/WooNativeCheckout.jsx` is a compatibility route. If React Router reaches `/checkout`, it performs full-document navigation to native Woo checkout and uses a sessionStorage handoff marker only to detect/recover a routing loop. It does not render payment controls.

### Native Woo runtime exception

The headless WordPress theme normally routes public rendering toward the React SPA. `dtb-commerce/Payment/WooNativeCheckoutRuntime.php` is the explicit native-checkout exception that preserves WooCommerce/plugin runtime behavior for checkout/endpoints.

The assigned WooCommerce Checkout page is hosted through the native checkout template support and contains the Checkout Block.

### Official Stripe integration

`dtb-commerce/Payment/OfficialStripeNativeCheckout.php` owns DTB-side integration with the official gateway:

- public non-secret checkout capability/readiness metadata;
- native checkout assets/presentation;
- supported Stripe Appearance API configuration;
- official-gateway verification;
- checkout-order tagging;
- non-secret paid-reference mirroring after verified Woo paid lifecycle hooks;
- operator readiness notices.

Current contract identifiers:

```text
CHECKOUT_GATEWAY = woo_native_stripe
CONTRACT_VERSION = woo-stripe-v1
provider = woocommerce_stripe
```

The public capabilities route:

```text
GET /wp-json/dtb/v1/checkout/capabilities
```

is read-safe/local metadata only. It must not expose Stripe keys, webhook secrets, client secrets, tokens, raw provider credentials, or make slow external Stripe calls.

### Mobile payment sheet

Owning source:

```text
dtb-commerce/Payment/MobilePaymentSheet.php
dtb-commerce/assets/woo-native-checkout-payment-sheet.js
dtb-commerce/assets/woo-native-checkout-payment-sheet.css
```

The mobile payment sheet is presentation/accessibility only.

Current technical responsibilities include:

- accessible semantic dialog chrome;
- focus containment while respecting provider-owned Stripe focus/modal/challenge surfaces;
- `visualViewport` adaptation for software keyboards/browser chrome;
- read-only total projection from Woo Blocks `wc/store/cart`;
- non-secret local readiness metadata;
- operator notices for connection/layout/settings-sync/webhook/capture/competing-authority state.

It must not clone/reparent provider payment nodes, create payment objects, independently calculate final payable totals, or replace Woo submission.

Static contract:

```powershell
./scripts/smoke-dtb-mobile-payment-sheet.ps1
```

The smoke script verifies required source/assets, accessibility/runtime tokens, bootstrap wiring, and absence of independent Stripe orchestration tokens.

### Checkout performance/stability

Owning source:

```text
dtb-commerce/Payment/CheckoutPerformance.php
dtb-commerce/assets/woo-native-checkout-performance.js
frontend/src/utils/checkoutPrewarm.js
```

Current behavior:

- checkout-only Stripe preconnect/DNS hints;
- DTB checkout CSS preload;
- server-generated static asset prewarm manifest;
- one low-priority storefront prewarm scheduled after successful cart engagement via `requestIdleCallback` with bounded timeout fallback;
- prewarm fetches capabilities metadata with `credentials: include`, `cache: no-store`, and bounded abort timeout;
- asset URLs restricted to storefront/backend origin; Stripe preconnect restricted to approved Stripe origins;
- private `/checkout/` HTML is never prewarmed/cached;
- known non-essential marketing/tracking assets are suppressed only through explicit handle/host policy;
- unknown plugin assets are left alone to avoid breaking Woo/payment dependencies;
- runtime diagnostics observe errors, resource failures, provider-surface timeout, checkout-root replacement/state-loss suspicion, vitals, and third-party budget issues;
- diagnostics do not capture raw form values or reconstruct authoritative checkout state;
- provider-surface timeout recovery is presentation-only and cannot create fallback payment objects.

Diagnostics route:

```text
POST /wp-json/dtb/v1/checkout/runtime-telemetry
```

Security contract:

- dedicated checkout telemetry nonce;
- same-origin scheme/host/port validation when Origin is present;
- rate limiting;
- event-ID deduplication;
- allowlisted event kinds;
- bounded/sanitized fields;
- query-stripped source URLs;
- sensitive-value redaction;
- no cart/order/payment writes;
- no synchronous external calls.

Static contract:

```powershell
./scripts/smoke-dtb-checkout-performance.ps1
```

The smoke validates source wiring, security/performance tokens, forbidden payment-orchestration tokens, prewarm scheduling, and asset-version synchronization.

Optional PageSpeed shell audit:

```powershell
./scripts/audit-dtb-checkout-pagespeed.ps1 -Url "https://drywalltoolbox.com/checkout/"
```

A public PageSpeed run is only a shell baseline because it cannot reproduce shopper-specific Woo cookie/cart state.

### Storefront return context

`dtb-commerce/Payment/StorefrontReturnContext.php` preserves only a validated public storefront base path through native checkout so successful orders can return to the originating React tracking surface.

Accepted context is root or a validated `/staging/{id}` path.

This value is routing/presentation metadata only. It must not derive payment state, Stripe state, totals, or customer identity.

## Captured-payment and refund technology contracts

Initial downstream effects require the captured-payment contract to pass, including:

```text
_dtb_checkout_gateway = woo_native_stripe
_dtb_checkout_contract_version = woo-stripe-v1
_dtb_payment_provider = woocommerce_stripe
WooCommerce date_paid present
non-secret transaction/payment reference present
```

`_dtb_payment_provider` is mirrored only for orders whose selected gateway instance is verified as the official WooCommerce Stripe extension.

Authorization-only/manual-capture state is not fulfillable.

Initial downstream processing uses an atomic per-order dispatch barrier.

Refunds are keyed by concrete `order_id + refund_id` across events, queue arguments, idempotency, and QuickBooks projection. Multiple partial refunds remain distinct.

## Async and integration execution

Order-related external effects use:

```text
dtb_order_enqueue_job()
Action Scheduler group: dtb-orders
```

New jobs require explicit owner, hook/args, idempotency/deduplication, retry/backoff, terminal failure, observability, recovery/replay, and compensation semantics.

Avoid slow external calls during checkout, authentication, or webhook acknowledgement.

### Veeqo

Veeqo owns inventory/fulfillment truth. DTB adapters may cache/project availability and enqueue fulfillment synchronization, but must preserve Veeqo authority and idempotency.

### QuickBooks

QuickBooks is an accounting projection. Refund projection identity is `order_id + refund_id`; one cumulative parent-order refund marker is insufficient.

## Backend API surface

### `dtb/v1`

Platform/domain APIs including auth/account, checkout capabilities/telemetry, catalog, schematics/media, repairs, returns, support, inventory/integrations, health/cache, and operator endpoints.

Public config/readiness routes must be secret-free and non-mutating except narrowly protected diagnostics writes such as checkout telemetry.

### `drywall/v1`

Compatibility/proxy surfaces. Legacy raw storefront order creation remains retired.

### `headless/v1`

Theme-level headless support endpoints.

### `wc/store/v1`

WooCommerce Store API for public cart/session and Checkout Block runtime operations.

## Authentication and security posture

- preferred HttpOnly `dtb_auth` cookie;
- optional in-memory bearer compatibility only;
- no JWT/application password/consumer secret/API key/payment secret in browser persistence;
- centralized origin/CORS policy;
- explicit route permission callbacks;
- customer record reads bound to authenticated ownership;
- admin routes require capabilities;
- public routes read-safe or narrowly protected;
- official Stripe webhook authentication/reconciliation owned by the official gateway;
- DTB integration webhooks verified by owning modules;
- order write boundary blocks raw external storefront order creation/duplicate side effects;
- checkout telemetry is nonce/origin/rate/dedupe/redaction protected and cannot mutate commerce state.

## Calculator report technology

Canonical report implementation:

```text
frontend/src/components/calculators/report/
├─ CalculatorReport.jsx
├─ calculatorReportModel.js
├─ calculator-report.css
└─ README.md
```

Technical contract:

- one canonical presentation model for Summary and printable report;
- report renderer formats, never recalculates, calculator outputs;
- print isolation uses a temporary `body.dtb-calculator-report-printing` state so normal SPA content does not create extra PDF pages;
- Letter-size preview/print rules are local to the report CSS;
- report data remains browser-local and is not sent to WordPress/external PDF services;
- no server-side PDF dependency or credential surface is added;
- report/project state remains backward-compatible with existing `dwCalc_state`.

Historical `calc-pdf/files/` reference code has been removed from active source.

## Catalog/data technology constraints

Canonical taxonomy policy:

```text
products/Production/catalogs/config/production_taxonomy_policy.json
```

It defines the controlled taxonomy contract and points to a production catalog path under `products/Production/catalogs/official/`.

Operational path layout has changed over time. Many historical `products/Production/launch/*` assets were moved into `products/launch/`, while production catalogs/sources/reports were consolidated under `products/Production/catalogs/`.

Scripts must inspect current paths and preserve stable identifiers/provenance instead of relying on old directory assumptions.

Catalog architecture uses the active repository implementation under:

```text
drywalltoolbox/wp/wp-content/mu-plugins/dtb-catalog-platform/Infrastructure/CatalogProductRepository.php
```

The historical duplicate `Services/CatalogProductRepository.php` has been removed; do not reintroduce competing repository implementations.

## CI contract

Active workflow:

```text
.github/workflows/ci-build.yml
```

Triggers:

- pull requests to `main`;
- pushes to `main`;
- manual dispatch.

Current build job:

1. checkout repository;
2. Node 20;
3. `npm ci --include=dev --prefer-offline --no-audit --no-fund`;
4. `npm run lint --if-present`;
5. production frontend build;
6. `./scripts/smoke-dtb-mobile-payment-sheet.ps1`;
7. `./scripts/smoke-dtb-checkout-performance.ps1`;
8. assemble `deploy-root` from `dist`, root routing/logos, tracked WP entry files, mu-plugins, themes;
9. validate required payload shape;
10. reject `wp-config.php`, uploads, or cache paths.

CI build success is not deployment.

## Deployment current state

Active workflow:

```text
.github/workflows/deploy.yml
```

Current checked-in source defines:

- manual `deploy` / `restore` action choice;
- confirmation input;
- full/selective deploy scope inputs;
- backup-run/artifact inputs for restore intent;
- build/package job;
- bounded payload assembly/validation;
- upload of deployment payload artifact;
- protected `hostgator-production` environment on the pre-deploy backup job;
- backup artifact naming and remote-backup setup.

Critical current-source limitation: the file ends after a placeholder pre-deploy backup continuation step (`Continuing existing controlled deployment workflow...`). The checked-in workflow does not currently contain a complete executable upload-to-production, smoke, rollback, or restore sequence after that point.

Therefore:

- merge is not deployment;
- workflow dispatch is not proof of completed production release;
- do not claim rollback/restore automation is complete until active source contains and validates it;
- production release automation has residual operational risk until the intended controlled deploy/restore sequence is restored.

## Validation baseline

Frontend:

```powershell
cd frontend
npm ci --include=dev
npm run lint
npm run build
```

Checkout static contracts:

```powershell
./scripts/smoke-dtb-mobile-payment-sheet.ps1
./scripts/smoke-dtb-checkout-performance.ps1
```

Targeted PHP syntax should cover each changed PHP file, especially checkout/payment/order/integration code.

Runtime staging acceptance for checkout/payment changes should prove:

- same-origin cart/session continuity;
- native Checkout Block rendering;
- official Stripe single-authority readiness;
- cards and decline paths;
- 3DS/SCA success/cancel/failure;
- eligible/ineligible express methods;
- mobile focus containment and software-keyboard behavior;
- authoritative total parity;
- checkout root/form-state stability;
- payment-surface timeout recovery without a second payment flow;
- exactly-once order creation/downstream dispatch;
- webhook replay tolerance;
- refund identity by `refund_id`;
- Veeqo and QuickBooks exactly-once effects.

Do not claim any smoke, syntax, runtime, payment, webhook, integration, CI, or deployment check passed unless it actually ran and produced evidence.

## Engineering conventions to preserve

- backend business rules stay in bounded mu-plugin modules;
- frontend data access stays in `frontend/src/api/`;
- React remains public renderer/cart/account/service/calculator UX and checkout handoff, not payment authority;
- native checkout/payment rendering stays in WooCommerce Checkout Block plus the official Stripe extension;
- DTB mobile payment-sheet/performance code stays presentation/diagnostics only;
- order/integration writes use canonical queue/write-boundary/idempotency contracts;
- Veeqo remains inventory/fulfillment authority;
- QuickBooks remains accounting projection only;
- shipping language distinguishes DTB/Woo policy rates from live Veeqo carrier truth;
- calculator report rendering consumes canonical calculator outputs and does not recalculate;
- public checkout performance work must fail open and never cache session-owned HTML;
- update durable docs whenever authorities/routes/contracts/queues/deployment behavior change.