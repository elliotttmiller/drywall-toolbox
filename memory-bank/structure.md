# Structure

## System Shape

Drywall Toolbox is organized around two runtime layers and two support layers:

1. `frontend/` is the public React SPA.
2. `wp/` is the WordPress + WooCommerce backend and admin system.
3. `scripts/` contains offline maintenance and migration utilities.
4. `products/` contains large local catalog/image/source datasets used to build and maintain the commerce content.

The public site is not rendered by WordPress templates. The browser-facing app is React; WordPress is used as API, admin, media, and commerce infrastructure.

## Top-Level Repository Layout

```text
drywall-toolbox/
├─ .github/        CI/CD workflows
├─ .vscode/        editor settings
├─ docs/           currently empty in the checked-in repo
├─ frontend/       React storefront source and public assets
├─ memory-bank/    project reference docs
├─ products/       scraped catalogs, images, reports, production data
├─ scripts/        Python/SQL operational tooling
├─ wp/             WordPress installation and backend code
├─ .htaccess       root routing/security/SPA fallback rules
├─ coming-soon.html
├─ index.php
└─ README.md
```

## Runtime Request Flow

```text
Browser
  -> React router in frontend/src/App.jsx
  -> frontend/src/api/* and some legacy frontend/src/services/*
  -> WordPress REST endpoints under /wp-json/*
  -> WooCommerce Store API / WC REST API
  -> custom DTB mu-plugin logic

WordPress + WooCommerce
  -> auth/session handling
  -> product/customer/order operations
  -> rewards + membership endpoints
  -> schematic/media delivery
  -> repair request handling
  -> Veeqo integration
```

## Frontend Layout

`frontend/` is the canonical public application.

### Important root files

- `frontend/package.json`: scripts and dependency manifest
- `frontend/webpack.config.cjs`: build/dev-server config
- `frontend/src/main.jsx`: app bootstrap
- `frontend/src/App.jsx`: provider composition, route definitions, lazy page loading, layout shell
- `frontend/src/index.css` and `frontend/src/App.css`: global styling entry points

### `frontend/src/` folders

```text
frontend/src/
├─ api/         current API clients and fetch wrappers
├─ assets/      minimal bundled source assets
├─ auth/        auth context, hook, and in-memory token store
├─ components/  shared UI, dashboard modules, calculator modules
├─ constants/   app constants such as shipping config
├─ context/     cart and WooCommerce providers
├─ data/        schematic mappings and product-related local datasets
├─ hooks/       reusable data and UI hooks
├─ pages/       route-level pages
├─ services/    older compatibility/service modules
├─ styles/      standalone CSS files
├─ utils/       parsing, schema, variation, and helper utilities
├─ App.css
├─ App.jsx
├─ index.css
└─ main.jsx
```

### Frontend composition details

- `auth/` is a real architectural layer, not just a helper folder.
  - `AuthContext.js`
  - `useAuth.js`
  - `tokenStore.js`
- `api/` is the newer browser data-access surface.
  - auth, cart, coupons, customers, membership, orders, products, rewards, schematics, wordpress
- `services/` still exists for older or compatibility-oriented flows.
- `components/` is split between general shared UI and two meaningful feature subtrees:
  - `components/calculators/`
  - `components/dashboard/`

### Public route surfaces

Confirmed in `frontend/src/App.jsx`:

- storefront: `/`, `/products`, `/products/:slug`, `/all-products`, `/category/:slug`
- parts/schematics: `/parts`, `/schematics`, `/product/:partNumber`
- commerce: `/cart`, `/checkout`, `/order/:id`
- auth: `/login`, `/register`, `/forgot-password`, `/reset-password`
- account: `/dashboard`, `/orders`, `/rewards`, `/account-settings`, `/addresses`, `/notifications`
- additional features: `/repairs`, `/calculators`, `/faq`, `/shipping-policy`, `/returns`, `/toolset-builder`, `/contact`
- admin-ish protected page: `/settings/woocommerce`

### Feature-heavy frontend areas

- `pages/Repairs.jsx` is a large self-contained repair intake experience.
- `pages/Schematics.jsx` is a very large schematic/parts browser with extensive static imports and fallback media handling.
- `components/dashboard/AccountHub.jsx` centralizes account tab state and data loading.
- `components/calculators/CalculatorHub.jsx` owns the calculator suite state and UX.

### Frontend assets and public content

`frontend/public/` is not just favicon/static boilerplate. It contains major product content:

- `brands/` with brand logos, product images, and schematic JSON/image trees
- `404.html`, logos, manifest, robots, favicons

This means a meaningful amount of "content" is bundled directly with the frontend build rather than fetched dynamically.

## Backend Layout

`wp/` contains the WordPress runtime. The most important project-specific code lives in `wp/wp-content/`.

### Core backend directories

```text
wp/wp-content/
├─ mu-plugins/   custom backend feature modules and admin tooling
├─ plugins/      regular WP plugins placeholder/installed plugins
├─ themes/
│  ├─ drywall-toolbox/  legacy/reference theme
│  └─ headless-base/    active headless-oriented theme
└─ uploads/      media storage placeholder in repo
```

### Theme structure

- `themes/headless-base/` is the active headless theme and should be treated as the current public-theme baseline.
- `themes/drywall-toolbox/` appears to be retained as an older or reference theme.

Neither theme is the main application UI layer; React remains the real frontend.

## MU-Plugin Architecture

`wp/wp-content/mu-plugins/00-dtb-loader.php` is the composition root for the custom backend stack. It defines shared origin helpers and then explicitly loads DTB modules in a controlled order.

### Confirmed load order from `00-dtb-loader.php`

- `dtb-utils.php`
- `dtb-auth.php`
- `dtb-cache.php`
- `dtb-cache-admin.php`
- `dtb-rest-api.php`
- `dtb-rewards.php`
- `dtb-image-sync.php`
- `dtb-woocommerce.php`
- `dtb-veeqo.php`
- `dtb-schematics-api.php`
- `dtb-coming-soon.php`
- `dtb-seo.php`
- `dtb-config-reference.php`

### Other checked-in mu-plugin files not in that explicit load chain

- `dtb-admin-performance.php`
- `dtb-api-health-monitor.php`
- `dtb-product-mapping.php`
- `dtb-schematics-admin.php`
- `endurance-page-cache.php`
- `sso.php`

Because this is WordPress mu-plugin territory, these files still matter structurally even when not listed in the loader's explicit `require_once` chain.

### Backend responsibilities by module

- `dtb-auth.php`: authentication, JWT/session-related flows, auth routes
- `dtb-cache.php`: cache helpers/diagnostics
- `dtb-cache-admin.php`: cache-related admin tools
- `dtb-rest-api.php`: custom REST routes and backend application endpoints
- `dtb-rewards.php`: rewards bridge/endpoints
- `dtb-image-sync.php`: media/image sync workflows
- `dtb-woocommerce.php`: WooCommerce-specific backend behavior
- `dtb-veeqo.php`: Veeqo proxy, order/inventory sync, shipping, repair request backend
- `dtb-schematics-api.php`: schematic media manifest API
- `dtb-coming-soon.php`: subscriber capture/admin handling
- `dtb-seo.php`: product SEO metadata exposure/management
- `dtb-config-reference.php`: config documentation/reference

### Structural takeaway

The WordPress layer is doing much more than "just CORS and a proxy." It is a fairly broad custom application backend with both customer-facing APIs and internal admin/ops tooling.

## Products and Data Workspace

`products/` is an important support layer, not clutter to ignore.

### Confirmed top-level subdirectories

- `catalogs/`
- `logos/`
- `Production/`
- `reports/`
- `scraped_results/`

### Notable `scraped_results/` contents

- `brands/`
- `toolsets/`
- `archive/`
- `new_images/`
- `wc-catalog.csv`
- `seo-tags.csv`

This is a strong signal that the repository doubles as a catalog-production workspace and image-processing workspace.

## Scripts Layer

`scripts/` is heavily catalog- and media-oriented. The file inventory shows several script families:

- scraping: `scrape_*`
- extraction: `extract_*`
- normalization: `normalize_*`
- building catalogs: `build_*`
- migration/fixup: `migrate_*`, `fix_*`, `reshape_*`, `convert_*`
- image maintenance: `cleanup_*`, `dedupe_*`, `sync_*`, `cross_reference_*`
- auditing/reporting: `audit_*`, `generate_*`
- SQL helper: `phpmyadmin-reset.sql`

These scripts are part of the repo's working architecture for maintaining product truth, not just one-off experiments.

## Documentation and Reference Layer

- `memory-bank/` contains the maintained project-reference docs.
- `README.md` is a broad repo overview but is not fully authoritative for every current detail.
- `docs/` is currently empty in the checked-in repository, so current source code is more trustworthy than any expectation that docs live there.

## Current Architectural Realities

- The codebase is intentionally headless.
- The frontend has a newer `api/` layer and an older `services/` layer, so data access is transitional.
- Large schematic/product asset trees live both in `frontend/public/` and `products/`.
- WordPress mu-plugins are the main backend extension mechanism.
- The repo combines runtime code and operational data workflows in one place.

## Best Mental Model

Use this model when navigating the project:

- `frontend/` is the customer experience.
- `wp/wp-content/` is the backend application logic and admin tooling.
- `products/` is the content/categorization/image workspace.
- `scripts/` is the transformation and maintenance toolbox.
- `memory-bank/` is the concise project truth layer we should keep current.
