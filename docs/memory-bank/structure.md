# Structure

## High-level architecture

Drywall Toolbox is a headless system with four primary layers:

1. `frontend/` — public React SPA
2. `wp/` — WordPress + WooCommerce backend and admin runtime
3. `products/` — catalog/media/production data workspace
4. `scripts/` — operational tooling for data/csv/image workflows

`README.md` is intentionally brief; this file is the deeper internal structure map.

## Repository map (current)

```text
drywall-toolbox/
├─ .github/                     CI workflows
│  └─ workflows/
│     ├─ validate-and-deploy.yml
│     ├─ deploy.yml.archived
│     └─ performance.yml.archived
├─ frontend/                    React SPA (public UI)
├─ docs/memory-bank/            internal architecture docs
├─ products/                    catalog/media/source data
├─ scripts/                     operational scripts
├─ wp/                          WordPress installation
├─ .htaccess                    root routing/security/caching policy
├─ coming-soon.html             root page variant/asset
├─ index.php                    root passthrough note
├─ lighthouserc.json            Lighthouse assertion config
└─ README.md                    short internal workspace note
```

## Request flow

```text
Browser
  -> React routes/components (frontend/src/App.jsx)
  -> frontend/src/api/* (plus some legacy frontend/src/services/*)
  -> /wp-json/* REST endpoints
  -> WooCommerce + DTB mu-plugin business logic

WordPress runtime
  -> custom namespaces (dtb/v1, drywall/v1, headless/v1)
  -> auth/security/cache policy
  -> catalog/rewards/repair/integration modules
```

## Frontend structure (`frontend/`)

### Core files

- `package.json` — scripts/dependencies
- `webpack.config.cjs` — build/dev/prod/service-worker config
- `eslint.config.js` — lint rules
- `.env.example` — environment template
- `.env.staging` — staging-specific env values

### Source layout (`frontend/src/`)

```text
frontend/src/
├─ api/           primary data access layer
├─ auth/          auth context + in-memory token store
├─ components/    shared UI + feature component trees
├─ constants/     shared constants
├─ context/       app-level providers (cart, WooCommerce)
├─ data/          static mappings/datasets
├─ hooks/         reusable hooks
├─ pages/         route-level pages
├─ services/      legacy compatibility service layer
├─ styles/        css modules/files
├─ utils/         utility helpers
├─ App.jsx        route map + providers
└─ main.jsx       bootstrap
```

### Route surface

Primary pages include:

- commerce: `/products`, `/products/:slug`, `/cart`, `/checkout`, `/order/:id`
- parts/schematics: `/parts`, `/schematics`, `/product/:partNumber`
- auth/account: `/login`, `/register`, `/forgot-password`, `/reset-password`, `/dashboard`, `/orders`, `/rewards`, `/addresses`
- service/content: `/repairs`, `/calculators`, `/faq`, `/shipping-policy`, `/returns`, `/policies`, `/toolset-builder`, `/contact`

## Backend structure (`wp/`)

### Theme model

- Active theme: `wp/wp-content/themes/headless-base/`
- Purpose: backend/headless support, REST enrichment, no public template UX ownership

### MU plugin model

Composition root: `wp/wp-content/mu-plugins/00-dtb-loader.php`

This file provides shared helpers and explicit load order for DTB modules.

Confirmed loader chain includes:

- `dtb-utils.php`, `dtb-auth.php`, `dtb-cache.php`, `dtb-cache-admin.php`, `dtb-rest-api.php`
- `dtb-catalog-platform/bootstrap.php`
- `dtb-api-security.php`, `dtb-frontend-security.php`, `dtb-admin-security.php`
- `dtb-rewards.php`, `dtb-image-sync.php`, `dtb-woocommerce.php`
- `dtb-commerce/bootstrap.php`
- `dtb-veeqo.php`, `dtb-ops-dashboard.php`, `dtb-catalog-health.php`, `dtb-quickbooks.php`
- `dtb-schematics-api.php`, `dtb-coming-soon.php`, `dtb-seo.php`, `dtb-config-reference.php`

Also present in `mu-plugins/` are additional auto-loaded/support files (`dtb-api-health-monitor.php`, `dtb-product-mapping.php`, `dtb-schematics-admin.php`, host-provided plugins, etc.).

### Key backend module subtrees

- `mu-plugins/dtb-catalog-platform/` (`Domain/`, `Rest/`, `Services/`, `Validation/`, `Admin/`)
- `mu-plugins/dtb-commerce/` (`Cart/`, `Orders/`)

## Production live mirror (`drywalltoolbox/`)

`drywalltoolbox/` is the repository’s production live-server code mirror.

Current top-level structure:

```text
drywalltoolbox/
├─ .ftpquota
├─ .htaccess
├─ .htaccess.nfd-backup
├─ .user.ini
├─ logos/
└─ wp/
```

Current WordPress subtree highlights:

```text
drywalltoolbox/wp/
├─ wp-content/
│  ├─ mu-plugins/
│  │  ├─ 00-dtb-loader.php
│  │  ├─ dtb-platform/bootstrap.php
│  │  ├─ dtb-catalog-platform/bootstrap.php
│  │  ├─ dtb-commerce/bootstrap.php
│  │  ├─ dtb-order-platform/bootstrap.php
│  │  ├─ dtb-schematics/bootstrap.php
│  │  ├─ dtb-media/bootstrap.php
│  │  ├─ dtb-marketing/bootstrap.php
│  │  ├─ dtb-repair-service/bootstrap.php
│  │  ├─ dtb-integrations/bootstrap.php
│  │  └─ README.md (mu-plugin architecture source of truth)
│  ├─ themes/
│  │  ├─ drywall-toolbox/
│  │  └─ headless-base/
│  └─ uploads/
└─ index.php
```

Engineering rule for maintenance work:

- treat `drywalltoolbox/wp/wp-content/mu-plugins/README.md` as canonical documentation for live mu-plugin runtime/load-order details
- keep repository-level architecture memory in `docs/memory-bank/*` synchronized with live-directory structural reality when production topology changes

## Data and operations structure

### `products/`

Primary folders:

- `catalogs/`
- `Production/`
- `reports/`
- `scraped_results/`
- `logos/`

Production catalog authority currently centers around:

- `products/Production/catalogs/official/woocommerce_catalog_production_optimized.csv`
- taxonomy policy: `products/Production/catalogs/config/production_taxonomy_policy.json`

### `scripts/`

Operational scripts support:

- catalog validation and auditing (`validate_catalog.py`, `sku_audit.py`)
- image URL sync and media maintenance (`sync_catalog_image_urls.py`)
- endpoint smoke checks (`smoke-dtb-catalog-api.ps1`)
- environment/data cleanup utilities (`appdata_audit.py`, `appdata_cleanup.py`)
- DB reset SQL (`scripts/production_catalog/phpmyadmin-production-full-reset.sql`)

## Infrastructure and routing anchors

- Root `.htaccess` controls HTTPS redirects, security headers, REST aliases, and SPA fallback behavior
- Root `index.php` is intentionally minimal and delegates frontend serving to built output/routing policy
- `lighthouserc.json` defines performance assertions used by CI validation workflow

## Navigation model for engineers

When locating logic quickly:

- UI/UX bug: `frontend/src/pages/*` and `frontend/src/components/*`
- frontend API behavior: `frontend/src/api/*` then `frontend/src/services/*`
- backend business logic/API: `wp/wp-content/mu-plugins/*`
- operational data rules: `products/Production/*` and `scripts/*`
