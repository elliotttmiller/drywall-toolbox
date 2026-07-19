# Tech

Last verified against source: 2026-07-19.

## Runtime stack

### Frontend (`frontend/`)

- React 19 and React Router 7;
- Axios and typed-by-contract fetch wrappers;
- Framer Motion with centralized motion configuration;
- React Helmet Async;
- React Markdown, `remark-gfm`, and DOMPurify;
- `lucide-react` icons.

The frontend does not own payment rendering, Stripe Elements, wallet controls, Stripe Checkout Sessions, PaymentIntents, or order creation. Payment UI is rendered by the official WooCommerce Stripe Payment Gateway inside native WooCommerce checkout/payment surfaces.

### Backend (`drywalltoolbox/wp/`)

- WordPress in headless usage;
- WooCommerce and the official WooCommerce Stripe Payment Gateway;
- custom DTB must-use plugin suite under `drywalltoolbox/wp/wp-content/mu-plugins/`;
- composition root `00-dtb-loader.php` loading 11 module bootstraps;
- Action Scheduler for order, integration, import, and other asynchronous jobs;
- headless/backend-support themes `headless-base/` and `drywall-toolbox/`.

### Integration authorities

- WooCommerce: product/customer/cart/checkout/order/payment record system;
- official WooCommerce Stripe Payment Gateway: embedded Stripe payment methods, eligible wallets, Link, tokenization, 3DS/SCA, Stripe webhook synchronization into WooCommerce;
- DTB order platform: lifecycle events, captured-payment gating, idempotency, integration state, write boundary, queue, and customer/operator projections;
- Veeqo: inventory, allocation, fulfillment, labels, shipment status, and tracking;
- QuickBooks: accounting projection after eligible payment/refund events;
- marketplace modules: normalized Amazon/eBay operational ingestion and exception handling.

Checkout shipping rates are currently computed by Woo/DTB policy. They are not live carrier quotes returned by Veeqo.

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

New business logic belongs inside the owning module subtree, not a root-level legacy wrapper.

## Build and tooling

- Node.js 20 for frontend builds;
- locked dependency installation via `npm ci --include=dev`;
- Webpack 5 and Babel;
- Tailwind CSS v4, PostCSS, and Autoprefixer;
- ESLint 9 flat configuration;
- Workbox `GenerateSW` for production service worker generation;
- Terser and CSS minimization;
- optional bundle analysis with `ANALYZE=true`;
- Python scripts for catalog validation, normalization, pricing, image sync, and audits;
- PowerShell scripts for operational diagnostics where present.

Frontend validation gates are dependency installation, source lint, production build, and credential-artifact safety. Do not claim a smoke script passed unless the script exists in the checked-out source and was actually run.

## Frontend build contract

`frontend/webpack.config.cjs` controls environment loading, public `REACT_APP_*` injection, production/staging output, chunking, copied public assets, error pages, service-worker generation, and development proxying.

Only public configuration may use `REACT_APP_*`. The current production storefront does not require a React Stripe publishable key because Stripe configuration and payment rendering are owned by the official WooCommerce Stripe extension.

Forbidden browser values include WooCommerce application passwords, consumer keys/secrets, Stripe secret keys, Stripe webhook secrets, PaymentIntent client secrets, wallet tokens, Veeqo keys, QuickBooks credentials, private keys, and server integration credentials.

## Environment model

### Browser-safe values

- public site/API base URLs;
- Woo Store API path;
- feature flags;
- environment identifier;
- public launch dates.

### Server-only values

Defined in `wp-config.php`, WooCommerce/Stripe plugin settings, or secured host configuration:

- `WC_PROXY_CONSUMER_KEY`, `WC_PROXY_CONSUMER_SECRET`;
- `DTB_WC_AUTH_USER`, `DTB_WC_AUTH_PASS`;
- `WC_WEBHOOK_SECRET`, `DTB_IMPORT_SECRET`;
- official Stripe gateway secret/webhook/account configuration managed by the plugin/runtime;
- `DRYWALL_JWT_SECRET`;
- `DTB_VEEQO_*` credentials/authority IDs;
- `DTB_QBO_*` credentials;
- marketplace credentials;
- `DTB_EXTERNAL_ORDER_WRITE_SECRET`.

`wp-config.php`, uploads, cache, and runtime secrets are never included in deploy payloads.

## Frontend API/session model

Canonical browser communication uses:

- `frontend/src/api/client.js` for DTB/proxy requests;
- `frontend/src/api/cart.js` for WooCommerce Store API cart/session operations;
- domain-specific modules under `frontend/src/api/`;
- cookie credentials for same-origin authenticated/session requests;
- optional bearer tokens from the in-memory `tokenStore` only.

For production/staging same-origin cart traffic, WooCommerce's cookie-backed session is the checkout continuity authority and Store API mutations use the `Nonce` header. `Cart-Token` is compatibility-only for genuinely cross-origin clients; same-origin React must not maintain a separate persisted Cart-Token cart that diverges from `/checkout/`.

## Checkout runtime architecture

React owns the cart page, cart drawer, and checkout CTA/handoff only. `/checkout` in React is compatibility routing that immediately performs full-document navigation to the WordPress/WooCommerce checkout.

The active headless WordPress theme normally forces frontend requests into React and strips non-React assets. `dtb-commerce/Payment/WooNativeCheckoutRuntime.php` is the explicit checkout exception: it disables those theme overrides for checkout/endpoints and hosts the assigned Checkout page content without manually rendering payment controls.

The actual checkout is the assigned WooCommerce Checkout page containing the Checkout Block. The official WooCommerce Stripe Payment Gateway renders payment methods, Link, eligible wallets, tokenization, and 3DS/SCA. `DTB_OfficialStripeNativeCheckout` owns only readiness metadata, checkout CSS scoping, order tagging, strict official-gateway detection, and non-secret paid reference mirroring.

Frontend checkout work must not reintroduce React checkout forms, Stripe Elements wrappers, Stripe Checkout Sessions, payment iframes, copied plugin builds, DOM observer payment runtimes, or fake Apple Pay/Google Pay/Link buttons.

## Backend API surface

### `dtb/v1`

Platform/domain APIs including auth/account, checkout capability metadata, catalog, schematics/media, repairs, returns, support, Veeqo, QuickBooks, health/cache, and operator endpoints. `GET /dtb/v1/config` and checkout capability routes must remain public-safe and secret-free.

### `drywall/v1`

Server-side read compatibility/proxy surfaces. Legacy raw storefront order creation is retired; storefront orders are created through WooCommerce Checkout Block.

### `headless/v1`

Theme-level headless support endpoints.

### `wc/store/v1`

WooCommerce Store API for cart/session operations. Storefront inventory validation may additionally use DTB Veeqo availability APIs; bulk inventory authority remains server-side.

## Authentication and security posture

- preferred HttpOnly `dtb_auth` cookie with optional in-memory bearer compatibility;
- no JWT/application password/consumer secret/API key/payment secret persisted in browser storage;
- centralized origin/CORS policy;
- customer record reads bind records to authenticated ownership;
- admin endpoints require explicit capabilities;
- public endpoints are read-safe or narrowly signed/protected;
- official Stripe webhook authentication/reconciliation remains owned by the official gateway;
- Veeqo/other DTB webhook verification remains in owning integrations;
- order write boundary blocks raw external order creation and duplicate side effects.

## Live HostGator deployment

Document root: `/public_html/drywalltoolbox/`; WordPress lives in `/public_html/drywalltoolbox/wp/`.

Root routing sends REST, WooCommerce `wc-api`, `/checkout/`, `order-pay`, and order-received/payment endpoints to WordPress before the React fallback. Checkout/session/payment/callback surfaces are private/no-store. WooCommerce session cookies must be root-scoped in runtime configuration so React Store API cart and native checkout share one browser session.

`drywalltoolbox/.htaccess` must preserve independent WordPress/WooCommerce `Set-Cookie` headers when adding host cache-bypass cookies.

React static assets may be cached/revalidated normally; checkout/payment HTML must never be served from the SPA or public page cache.

## Async and integration execution

External order side effects use `dtb_order_enqueue_job()` and Action Scheduler group `dtb-orders`.

Initial fulfillment/accounting dispatch occurs only after the captured-payment contract passes and is protected by an atomic per-order dispatch barrier. Refund accounting is keyed by concrete Woo `refund_id`; partial refunds must not be collapsed into one cumulative refund identity.

## Engineering conventions

- backend rules stay in bounded mu-plugin modules;
- frontend data access stays in `frontend/src/api/`;
- React remains public renderer and checkout handoff surface, not payment authority;
- all order/integration writes use canonical queue/write-boundary contracts;
- public shipping language distinguishes DTB-calculated rates from Veeqo fulfillment truth;
- checkout/payment rendering stays in WooCommerce Checkout Block and official Stripe extension points;
- update durable docs when authorities/routes/contracts change;
- run `npm ci --include=dev`, lint/build for frontend changes and targeted PHP/source/runtime validation for checkout/backend changes.
