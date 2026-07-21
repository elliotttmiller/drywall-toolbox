# Structure

Last verified against source: 2026-07-20.

## Architecture truth

Drywall Toolbox has four primary repository layers:

1. `frontend/` — React SPA and customer-facing UI/routes.
2. `drywalltoolbox/` — tracked production deployment mirror; WordPress/WooCommerce code lives under `drywalltoolbox/wp/`.
3. `products/` — production catalog, taxonomy, identifiers, pricing, media, schematic, compatibility, shipping-specification, and audit data.
4. `scripts/` — deterministic operational, validation, audit, and smoke tooling.

There is no canonical root-level `wp/` application source tree. Generated `dist/` output is not a source editing target.

## Repository map

```text
drywall-toolbox/
├─ .github/workflows/
│  ├─ ci-build.yml
│  └─ deploy.yml
├─ dist/                                  generated frontend output
├─ docs/                                  architecture and operations docs
├─ drywalltoolbox/                        tracked production mirror
│  ├─ .htaccess                           root routing/security/cache policy
│  ├─ logos/
│  └─ wp/
│     ├─ .htaccess
│     ├─ index.php
│     └─ wp-content/
│        ├─ mu-plugins/                    canonical DTB backend
│        └─ themes/                        headless/backend-support themes
├─ frontend/                              React storefront source
├─ memory-bank/
│  ├─ product.md
│  ├─ structure.md
│  └─ tech.md
├─ products/
├─ scripts/
├─ AGENTS.md
└─ README.md
```

## Production topology

```text
/public_html/drywalltoolbox/
├─ index.html
├─ assets/
├─ .htaccess
├─ logos/
├─ staging/2972/
└─ wp/
   ├─ wp-admin/
   ├─ wp-includes/
   ├─ wp-content/
   └─ wp-config.php                       runtime-only
```

Frontend build contents deploy to the document root. Tracked mu-plugins/themes map into `/wp/wp-content/`. Uploads, cache, WordPress core, runtime configuration, and runtime credentials are server-owned state and are excluded from deploy payloads.

## Request flow

```text
Browser
  -> drywalltoolbox/.htaccess
     -> static file / React SPA fallback
     -> REST and wp-admin aliases -> WordPress
     -> checkout/order-pay/order-received/wc-api -> WordPress/WooCommerce
  -> React routes in frontend/src/App.jsx
  -> frontend/src/api/* + hooks/providers
  -> dtb/v1, drywall/v1, headless/v1, wc/store/v1
  -> WordPress/WooCommerce/DTB modules
  -> persistence + Action Scheduler
  -> Veeqo / QuickBooks / notifications / marketplace adapters
```

React owns rendering and interaction state. Backend modules own authoritative validation, authorization, persistence, lifecycle policy, integrations, and side effects. Checkout is a native WooCommerce document, not a React payment surface.

## Frontend structure

```text
frontend/src/
├─ api/                        canonical browser/server access
├─ auth/                       auth/session helpers
├─ components/
│  ├─ account/
│  ├─ calculators/
│  │  └─ report/               calculator report model/template/styles
│  ├─ catalog/
│  ├─ product/
│  ├─ repairs/
│  ├─ routing/
│  ├─ schematics/
│  ├─ shell/
│  ├─ storefront/
│  └─ ui/
├─ context/
├─ hooks/
├─ pages/                      route-level screens
├─ services/                   compatibility-only; do not expand
├─ styles/
├─ utils/
├─ App.jsx                     route/provider composition
└─ main.jsx                    browser bootstrap
```

Frontend rules:

- route registration belongs in `frontend/src/App.jsx`;
- new server communication belongs in `frontend/src/api/`;
- same-origin cart/session state stays with Woo Store API and Woo cookies;
- React does not own payment/order creation;
- calculator reports consume the canonical report model and do not recalculate calculator authority.

## Route groups

- storefront: `/`, `/products`, brand/category selectors, product/variation detail;
- parts/schematics: `/parts`, `/product/:partNumber`, `/schematics`;
- repairs: overview/start/packages/tracking/status;
- commerce: `/cart`, `/checkout` compatibility handoff, checkout return states, order confirmation/tracking;
- returns/support: return portal/status and support contact/status;
- account: login/register/password recovery/dashboard redirects;
- content/tools: calculators, FAQ, shipping/return/store policies, technical-specification preview;
- disabled: public toolset-builder route remains commented out.

`/checkout` in React is compatibility/handoff behavior only. Root routing owns the authoritative native checkout document.

## Backend composition

Composition root:

```text
drywalltoolbox/wp/wp-content/mu-plugins/00-dtb-loader.php
```

Loader order:

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

### Module ownership

- `dtb-platform`: security/origin/auth, shared support, cache/health/logging/metrics, account/history APIs, platform admin.
- `dtb-catalog-platform`: catalog/product/variation/taxonomy models, read models, relationships, compatible/universal parts, inventory intelligence, validation, REST/admin tooling.
- `dtb-commerce`: Store API extensions, native checkout runtime/presentation, official Stripe readiness boundaries, shipping policy, order tagging, commerce-facing REST/admin/email support.
- `dtb-order-platform`: order lifecycle, event ledger, integration state, `dtb-orders` queue, write boundary, duplicate containment, payment/refund observation, customer/operator projections.
- `dtb-schematics` / `dtb-media`: schematic and media mapping/sync/validation/operator tooling.
- `dtb-repair-service`, `dtb-support`, `dtb-returns`: independent domain lifecycles and workbenches.
- `dtb-marketing`: coming-soon/subscriber and SEO support.
- `dtb-integrations`: Woo/Veeqo/QuickBooks/notification/marketplace adapters and orchestration; rewards loading remains intentionally omitted for launch.

## Checkout implementation map

High-signal owning files:

```text
drywalltoolbox/wp/wp-content/mu-plugins/dtb-commerce/
├─ Payment/
│  ├─ WooNativeCheckoutRuntime.php
│  ├─ OfficialStripeNativeCheckout.php
│  ├─ MobilePaymentSheet.php
│  └─ CheckoutPerformance.php
├─ Templates/WooNativeCheckoutPage.php
└─ assets/
   ├─ woo-native-checkout-payment-sheet.js/.css
   └─ woo-native-checkout-performance.js
```

Flow:

```text
React cart
  -> Woo Store API cookie session + mutation nonce
  -> optional low-priority static checkout prewarm
  -> full-document /checkout/
  -> root .htaccess -> WordPress
  -> assigned Woo Checkout page
  -> WooCommerce Checkout Block
  -> official WooCommerce Stripe Payment Gateway
  -> Woo order/payment/refund lifecycle
  -> DTB captured-payment verification/event ledger
  -> dtb-orders Action Scheduler
  -> Veeqo / QuickBooks / notifications / tracking
```

Mobile `Contact -> Shipping -> Payment` and the bottom sheet are presentation-only layers over mounted Woo/Stripe nodes. The sheet total is a read-only Woo Blocks cart projection. Final submission remains Woo Place Order.

Checkout prewarming may request only read-safe capability metadata and approved static assets. Session-owned checkout HTML remains private/no-store.

## Data and operations

`products/` and `scripts/` are production-relevant assets. Preserve stable identifiers, parent/variation relationships, taxonomy, media mappings, shipping specifications, schematic paths, compatibility, and source provenance. Prefer deterministic scripts and explicit audit outputs; reject ambiguous matches instead of guessing.

## CI and deployment

`.github/workflows/ci-build.yml` runs on pushes/PRs to `main` and manual dispatch. Current tracked steps include Node 20 setup, dependency install, lint, build, mobile payment-sheet smoke, checkout performance smoke, and deploy-payload boundary validation.

`.github/workflows/deploy.yml` is manual-only. It currently contains release inputs/confirmation, build/package validation, protected HostGator backup access, and backup snapshot logic, but the tracked file ends at a placeholder after the backup step. It does not currently contain a verified complete upload/deploy/restore/rollback sequence.

Therefore merge is not deployment, and no production deployment should be claimed without direct evidence.

## Navigation guide

- UI/routes -> `frontend/src/App.jsx`, `pages/`, owning `components/`;
- frontend data/session -> `frontend/src/api/`, `auth/`, hooks/providers;
- calculator report/export -> `frontend/src/components/calculators/report/`;
- checkout routing/presentation -> `drywalltoolbox/.htaccess` + `dtb-commerce/Payment/` + checkout template/assets;
- order lifecycle/dispatch -> `dtb-order-platform/` then owning `dtb-integrations/` adapter;
- catalog/API -> `dtb-catalog-platform/`;
- repair/return/support -> owning bounded module;
- catalog/media/schematic operations -> `products/` + `scripts/`;
- release behavior -> `.github/workflows/` + tracked deployment mirror.
