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

The frontend does not own payment rendering, Stripe Elements, wallet controls, Stripe Checkout Sessions, PaymentIntents, or order creation. Payment UI is rendered by the official WooCommerce Stripe Payment Gateway inside the native WooCommerce checkout/order-pay surfaces.

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
- DTB order platform: lifecycle events, idempotency, integration state, write boundary, queue, and customer/operator projections;
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
- PowerShell scripts remain operational diagnostics and are not generic CI gates.

Frontend validation gates are dependency installation, source lint, production build, and credential-artifact safety guard. The package has no standalone automated test, smoke-test, or ad hoc checkout-audit script wired into the production live-server workflow.

## Frontend build contract

`frontend/webpack.config.cjs` controls:

- environment-specific `.env` loading;
- compile-time injection of public `REACT_APP_*` values;
- production output to repository `dist/` and staging output to `dist-staging/`;
- stable JS/CSS entry names, deterministic chunks, and asset manifests;
- static public asset copying with operational-data exclusions;
- generated HTTP error pages;
- service-worker precache/runtime caching;
- development proxying to the WordPress backend.

Only public configuration may use a `REACT_APP_*` variable. Forbidden browser values include WooCommerce application passwords, consumer keys/secrets, Stripe secret keys, Stripe webhook secrets, Veeqo keys, webhook secrets, private keys, and server integration credentials.

## Environment model

### Browser-safe values

Examples include:

- public site/API base URLs;
- Store API path;
- feature flags;
- environment identifier;
- public launch dates.

Do not put Stripe secret keys, webhook secrets, PaymentIntent client secrets, wallet tokens, or gateway credentials in `REACT_APP_*` values. Publishable-key exposure is allowed only when an official documented browser integration requires it; the current production storefront does not need a React-owned Stripe integration.

### Server-only values

Defined in `wp-config.php` or secure hosting/CI configuration:

- `WC_PROXY_CONSUMER_KEY`, `WC_PROXY_CONSUMER_SECRET`;
- `DTB_WC_AUTH_USER`, `DTB_WC_AUTH_PASS`;
- `WC_WEBHOOK_SECRET`, `DTB_IMPORT_SECRET`;
- official Stripe gateway secret/webhook configuration managed by the plugin/runtime;
- `DRYWALL_JWT_SECRET`;
- `DTB_VEEQO_*` secrets and authority IDs;
- `DTB_QBO_*` credentials;
- marketplace credentials;
- `DTB_EXTERNAL_ORDER_WRITE_SECRET`.

`wp-config.php`, uploads, cache, and runtime secrets are never included in deploy payloads.

## Frontend API model

Canonical browser communication uses:

- `frontend/src/api/client.js` for DTB/proxy requests;
- `frontend/src/api/cart.js` for WooCommerce Store API cart/session operations;
- domain-specific modules under `frontend/src/api/`;
- cookie credentials for same-origin authenticated requests;
- optional bearer tokens from the in-memory `tokenStore` only.

Legacy frontend service facades must call DTB proxy/Store API endpoints and must not collect or persist WooCommerce credentials in localStorage, sessionStorage, source, environment bundles, or UI settings forms.

## Checkout UI architecture

React owns the customer-facing cart page, cart drawer, and checkout CTA/handoff behavior only. React route `/checkout` is a compatibility handoff that performs full-document navigation into the domain-root `/checkout/` WordPress route.

The actual checkout UI is the assigned WordPress WooCommerce Checkout page containing the WooCommerce Checkout Block. The official WooCommerce Stripe Payment Gateway renders payment methods, Link, eligible wallets, tokenization, and 3DS/SCA inside that Woo checkout runtime. DTB may scope CSS, body classes, readiness diagnostics, order tagging, and verified lifecycle observation through `dtb-commerce/Payment/OfficialStripeNativeCheckout.php`.

Frontend checkout work must not reintroduce a React checkout form, Stripe Elements wrapper, Stripe Checkout Session flow, payment iframe, copied plugin build component, DOM observer checkout runtime, or fake Apple Pay / Google Pay / Link buttons.

## Backend API surface

### `dtb/v1`

Platform and domain APIs including authentication, account, checkout capability metadata, catalog/platform routes, schematics/media, repairs, returns, support, Veeqo availability/webhooks/admin operations, QuickBooks, health, cache, and operator endpoints.

`GET /dtb/v1/config` is a public-safe capability/bootstrap endpoint only. It must never return WooCommerce credentials.

### `drywall/v1`

Server-side read proxy for public product/catalog data. Legacy authenticated order/customer read routes are customer-bound and deprecated. Legacy raw order creation is retired; storefront orders use the WooCommerce Checkout Block and official Stripe gateway contract.

### `headless/v1`

Theme-level headless support endpoints.

### `wc/store/v1`

Public WooCommerce Store API for cart/session operations. Storefront inventory validation additionally uses `POST /dtb/v1/veeqo/cart-availability`; bulk Veeqo inventory access is administrative.

## Authentication and security posture

- HS256 JWT signed with `DRYWALL_JWT_SECRET`;
- preferred HttpOnly `dtb_auth` cookie with SameSite policy;
- optional Authorization bearer fallback;
- no JWT, application password, consumer secret, API key, Stripe secret, webhook secret, PaymentIntent client secret, or wallet token persisted in browser storage;
- centralized origin allowlist and CORS policy;
- customer record reads bind requested records to the authenticated customer;
- admin endpoints require explicit capabilities;
- public endpoints are intentionally read-safe or protected by narrow signed-token/HMAC contracts;
- WooCommerce, official Stripe gateway, and Veeqo webhook signature validation remain with their owning systems/modules;
- order write boundary blocks raw external order creation, duplicate side effects, and write loops;
- root and WordPress `.htaccess` preserve authorization headers and enforce routing/security behavior.

## Live HostGator/cPanel deployment

Production/live deployment is a HostGator cPanel or FTP workflow. GitHub workflows are not the operational production deployment path unless explicitly reintroduced.

Live path contract:

- document root: `/public_html/drywalltoolbox/`;
- WordPress subdirectory: `/public_html/drywalltoolbox/wp/`;
- React production build: upload the contents of `dist/` into the document root;
- DTB backend updates: upload changed files under `/public_html/drywalltoolbox/wp/wp-content/mu-plugins/`;
- never overwrite `wp-config.php`, uploads, cache, upgrade/runtime directories, uncontrolled dumps, or secret-bearing files during code uploads.

Live routing/cache policy:

- root and `/wp` `.htaccess` preserve Authorization headers for REST, JWT, and WooCommerce handlers;
- root routing sends `/wp-json/*`, `/dtb/*`, WooCommerce `wc-api`, and checkout/order-pay requests into WordPress before the React SPA fallback;
- runtime `wp-config.php` must root-scope native WordPress cookies with `COOKIEPATH`, `SITECOOKIEPATH`, and `ADMIN_COOKIE_PATH` set to `/` because `/wp-admin`, `/wp-login.php`, and `/wp-json` are exposed at the domain root while WordPress core lives under `/wp`;
- WordPress admin/login, REST, cron/XML-RPC, WooCommerce/session-owned surfaces, callback URLs, and keyed order-pay requests are explicitly private/no-store;
- native WordPress auth cookies (`wordpress_logged_in_`, `wordpress_sec_`, `wp-settings-`) and WooCommerce cart/session cookies (`woocommerce_cart_hash`, `woocommerce_items_in_cart`, `wp_woocommerce_session_`) also trigger no-cache behavior;
- HostGator/Endurance cache is signaled with the short-lived `endurance-no-cache=1` cookie on admin, login, REST, WooCommerce session, callback, and order-payment surfaces;
- React JS/CSS/manifest/JSON assets use short public revalidation; image/font/PDF assets use longer public cache; `index.html` and error HTML are no-store/revalidate;
- keyed order-pay presentation is centralized in `dtb-commerce/Payment/OrderPayPresentation.php` with one template and one CSS/JS asset pair under `dtb-commerce`; gateway fields, nonces, tokenization, callbacks, and payment lifecycle remain WooCommerce/official-Stripe-owned;
- detailed live operator guidance lives in `docs/hostgator-cookie-cache-runtime.md`.

## Async and integration execution

External order side effects use `dtb_order_enqueue_job()` and the `dtb-orders` Action Scheduler group. The queue provides deduplication, bounded exponential retry, integration-state persistence, event logging, and duplicate-order side-effect suppression.

Heavy catalog imports use Action Scheduler with WP-Cron fallback. Operational health jobs and cleanup tasks use scheduled actions/cron according to their module contracts.

## Catalog technology constraints

- canonical taxonomy policy: `products/Production/catalogs/config/production_taxonomy_policy.json`;
- controlled brand/category allowlists and alias normalization;
- deterministic validation/audit scripts preferred over manual bulk edits;
- SKU, MPN, part-number, product relationship, image, and schematic identifiers must remain stable through imports and synchronization.

## Engineering conventions

- backend business rules stay in bounded mu-plugin modules;
- frontend data access stays in `frontend/src/api/` with credential-free service facades;
- React remains the public renderer and checkout handoff surface;
- all order/integration writes use the canonical queue and write boundary;
- public shipping language must distinguish DTB-calculated rates from Veeqo fulfillment data;
- order-pay presentation stays in `dtb-commerce`; do not restore root-level `zz*` order-pay shims or platform-owned payment-runtime assets;
- checkout/payment presentation stays in WooCommerce Checkout Block and official Stripe gateway extension points; do not restore React checkout/payment DOM observer runtimes or iframe payment hosts;
- update `memory-bank/*` and the mu-plugin README whenever durable architecture changes;
- run `npm run lint` and `npm run build` for frontend changes, plus targeted operator validation only when a changed backend/module contract requires it.