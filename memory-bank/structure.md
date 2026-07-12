# Structure

Last verified against source: 2026-07-12.

## Architecture truth

Drywall Toolbox is a headless commerce and operations platform with four primary repository layers:

1. `frontend/` — React SPA and customer-facing route/UI implementation.
2. `drywalltoolbox/` — tracked production deployment mirror. WordPress/WooCommerce application code lives under `drywalltoolbox/wp/`.
3. `products/` — production catalog, taxonomy, image, schematic, pricing, and audit data.
4. `scripts/` — deterministic catalog, media, smoke-test, and operational tooling.

There is no canonical root-level `wp/` application directory. Backend edits belong under `drywalltoolbox/wp/` unless a task explicitly targets deployment documentation or generated/runtime state.

## Repository map

```text
drywall-toolbox/
├─ .github/
│  ├─ copilot-instructions.md
│  └─ workflows/
│     ├─ ci-build.yml
│     └─ deploy.yml
├─ dist/                                  generated production frontend output
├─ docs/                                  architecture, operations, plans, company, references
├─ drywalltoolbox/                        tracked live-server deployment mirror
│  ├─ .htaccess                           domain-root routing/security policy
│  ├─ logos/
│  └─ wp/
│     ├─ .htaccess                        WordPress-subdirectory routing policy
│     ├─ index.php
│     └─ wp-content/
│        ├─ mu-plugins/                    DTB backend platform
│        └─ themes/                        headless/backend-support themes
├─ frontend/                              React storefront source
├─ memory-bank/                           durable architecture context
│  ├─ product.md
│  ├─ structure.md
│  └─ tech.md
├─ products/                              catalog/media/production operations workspace
├─ scripts/                               Python and PowerShell operational tooling
├─ AGENTS.md                              repository agent operating contract
├─ coming-soon.html
└─ README.md
```

Generated build output is not a source-of-truth editing target. Modify `frontend/`, build into `dist/`, and deploy the generated payload.

## Production topology

```text
/public_html/drywalltoolbox/              public document root
├─ index.html                             React application shell
├─ assets/                                compiled React assets
├─ .htaccess                              HTTPS, REST aliases, WP aliases, SPA fallback
├─ logos/
├─ staging/2972/                          staging SPA build target
└─ wp/                                    WordPress + WooCommerce runtime
   ├─ wp-admin/
   ├─ wp-includes/
   ├─ wp-content/
   └─ wp-config.php                       runtime-only; never deployed from Git
```

The contents of repository `dist/` are uploaded to `/public_html/drywalltoolbox/`. The tracked `drywalltoolbox/wp/wp-content/mu-plugins/` and `themes/` trees are deployed into the live `/wp/wp-content/` runtime. Uploads, cache, WordPress core, and `wp-config.php` are server-owned runtime state and are excluded from deployment packages.

## Request flow

```text
Browser
  -> domain-root .htaccess
     -> existing static file / React application shell
     -> /wp-json/* alias -> /wp/index.php
     -> /wp-admin/* alias -> /wp/wp-admin/*
     -> WooCommerce order-pay endpoint -> /wp/index.php
  -> React route in frontend/src/App.jsx
  -> frontend/src/api/*, hooks, and providers
  -> /wp-json/dtb/v1/*
     /wp-json/drywall/v1/*
     /wp-json/headless/v1/*
     /wp-json/wc/store/v1/*
  -> WordPress REST server
  -> DTB mu-plugin controller/service/repository or WooCommerce Store API
  -> WooCommerce, DTB tables/post meta, Action Scheduler, Veeqo, QuickBooks
```

React owns public rendering and interaction state. Backend modules own authorization, validation, persistence, lifecycle transitions, integration policy, and operational side effects.

## Frontend structure

```text
frontend/
├─ public/                        copied static assets
├─ scripts/                       frontend build-safety scripts
├─ server/                        local reviews/dev support
├─ src/
│  ├─ analytics/
│  ├─ api/                        canonical data-access layer
│  ├─ assets/
│  ├─ auth/                       auth provider and in-memory token store
│  ├─ components/
│  │  ├─ account/
│  │  ├─ catalog/
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
│  ├─ services/                   legacy compatibility/facade layer; do not expand
│  ├─ styles/
│  ├─ utils/
│  ├─ App.jsx                     provider and route composition
│  └─ main.jsx                    browser bootstrap
├─ package.json
└─ webpack.config.cjs
```

Frontend ownership rules:

- Place public route registration in `frontend/src/App.jsx`.
- Place server communication in `frontend/src/api/`.
- Keep optional legacy facades in `frontend/src/services/` credential-free and proxy-backed.
- Use `frontend/src/auth/tokenStore.js` for optional in-memory bearer tokens; never persist credentials or JWTs in browser storage.
- Use WooCommerce Store API only for public cart/session operations. WooCommerce admin REST credentials remain server-side.

## Public route groups

- Storefront: `/`, `/products`, brand/category selectors, product and variation detail.
- Parts/schematics: `/parts`, `/product/:partNumber`, `/schematics`.
- Repairs: intake, packages, tracking, status, authenticated dashboard detail.
- Commerce: `/cart`, `/checkout`, checkout return states, order confirmation and tracking.
- Returns/support: return portal/status and support contact/status.
- Account: login, register, password recovery, dashboard tabs.
- Content: calculators, FAQ, shipping policy, policies.
- Disabled: toolset-builder public route remains commented out until explicitly launched.

## Backend composition

Composition root:

```text
drywalltoolbox/wp/wp-content/mu-plugins/00-dtb-loader.php
```

Canonical loader-managed module order:

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

Shared configuration, support primitives, origin/CORS policy, API security, authentication, cache, health, observability, operator dashboards, account/history REST controllers, and platform administration.

### `dtb-catalog-platform/`

Catalog domain models, Woo/product repositories, normalization, facets, variation read models, product relationships, compatible/universal parts, inventory intelligence, validation, REST controllers, and catalog admin tools.

### `dtb-commerce/`

WooCommerce Store API cart extensions, toolset/order-line metadata, order type/query services, branded WooCommerce email integration, and commerce-facing order REST/admin surfaces.

### `dtb-order-platform/`

Order lifecycle domain, event ledger, integration state, Action Scheduler queue, write boundary, duplicate containment, payment webhooks, customer/operator tracking projections, order REST controllers, and operations UI.

### `dtb-schematics/` and `dtb-media/`

Schematic mapping/editor/runtime APIs and image/media synchronization, validation, and operator workflows.

### `dtb-repair-service/`, `dtb-support/`, and `dtb-returns/`

Independent lifecycle modules for repair requests, support tickets, and returns. Each owns its domain statuses, persistence, validation, customer endpoints, operator queues, and admin workbench.

### `dtb-integrations/`

Server-side adapters and orchestration for WooCommerce, Veeqo, QuickBooks, notifications, and marketplace channels. External side effects are queued through the order platform where an order lifecycle is involved.

## Order and fulfillment flow

```text
React cart
  -> WooCommerce Store API cart session
  -> DTB checkout session / confirmation / finalization
  -> WooCommerce order and payment runtime
  -> DTB order event ledger
  -> dtb-orders Action Scheduler queue
  -> Veeqo inventory/fulfillment synchronization
  -> QuickBooks accounting projection
  -> notification and customer tracking projections
```

Only the DTB checkout/finalization pipeline may create storefront orders. Legacy raw WooCommerce order creation is blocked/retired. Customer order reads must bind requested records to the authenticated customer, not caller-supplied customer IDs.

## Data and operations structure

`products/` and `scripts/` are production-relevant application assets.

Primary authorities:

- Production catalog: `products/Production/catalogs/official/woocommerce_catalog_production_optimized.csv`
- Taxonomy policy: `products/Production/catalogs/config/production_taxonomy_policy.json`
- Catalog validation and SKU audits: `scripts/*.py`
- Loader/API smoke checks: `scripts/smoke-dtb-mu-modules.ps1`, `scripts/smoke-dtb-catalog-api.ps1`
- Veeqo and production-catalog tooling: `scripts/veeqo/`, `scripts/production_catalog/`

Treat SKUs, MPNs, part numbers, taxonomy slugs, image mappings, schematic paths, and external-system IDs as stable business identifiers.

## CI/CD structure

- `.github/workflows/ci-build.yml` validates pull requests targeting `main`, pushes to `main`, and manual dispatches.
- `.github/workflows/deploy.yml` performs controlled HostGator backup, deploy/restore, production smoke checks, and rollback.
- Production deployment packages `dist/`, routing files, logos, mu-plugins, and themes.
- Runtime secrets, `wp-config.php`, uploads, cache, upgrade state, and full WordPress core are forbidden in deployment payloads.

## Engineering navigation

- UI/route issue: `frontend/src/pages/`, `frontend/src/components/`, `frontend/src/App.jsx`
- Frontend API/session issue: `frontend/src/api/`, `frontend/src/auth/`, providers/hooks
- Backend route/business rule: owning subtree in `drywalltoolbox/wp/wp-content/mu-plugins/`
- Order side effect or duplicate issue: `dtb-order-platform/Infrastructure/OrderWriteBoundary.php`, `OrderQueue.php`, integration pipeline files
- Catalog correctness: `dtb-catalog-platform/`, `products/Production/`, `scripts/`
- Deployment/routing: `drywalltoolbox/.htaccess`, `drywalltoolbox/wp/.htaccess`, `.github/workflows/`

## Source precedence

When documentation and implementation disagree:

1. live source code and active workflow configuration win;
2. `drywalltoolbox/wp/wp-content/mu-plugins/README.md` documents the backend runtime contract;
3. `memory-bank/*` records durable cross-system context and must be updated when architecture changes.
