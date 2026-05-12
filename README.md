# Drywall Toolbox

Headless React storefront for drywalltoolbox.com — powered by WordPress + WooCommerce as the headless CMS/API backend.

**Architecture:** React SPA (`frontend/`) → builds to `dist/` → served from domain root  
**Backend:** WordPress + WooCommerce in `/wp/` subdirectory → REST API only  
**Hosting:** HostGator shared hosting, deployed via GitHub Actions FTPS

---

## Repository Layout

```
drywall-toolbox/
├── frontend/                  ← React SPA (canonical source)
│   ├── src/
│   │   ├── api/               ← Axios API clients (client.js, auth.js, products.js, cart.js, …)
│   │   ├── auth/              ← AuthContext.js, tokenStore.js (in-memory JWT), useAuth.js
│   │   ├── components/
│   │   │   ├── calculators/   ← CalculatorHub + 5 calculators + shared primitives
│   │   │   └── dashboard/     ← AccountHub + tab components
│   │   ├── context/           ← CartContext.jsx, WooCommerceContext.jsx
│   │   ├── data/              ← products.js (WC loader), schematicMappings.js
│   │   ├── hooks/             ← useFetch, useProducts, useProduct, useCategories, useCart, useSchematicMedia
│   │   ├── pages/             ← All route-level pages (lazy-loaded)
│   │   ├── services/          ← Legacy API modules (kept for compat)
│   │   ├── styles/            ← Component-scoped CSS files
│   │   ├── utils/             ← apiError.js, parseProductCsv.js, productSpecifications.js, schema.js
│   │   ├── App.jsx            ← Root component, router, providers
│   │   └── main.jsx           ← Entry point
│   ├── public/                ← Static assets copied verbatim into dist/
│   │   └── brands/            ← Per-brand logos (SVG) and schematic JSON metadata
│   ├── server/                ← Dev-only mock reviews server (not deployed)
│   ├── webpack.config.cjs     ← Primary build config (outputs to ../dist/)
│   ├── tailwind.config.js     ← Tailwind CSS v4 config
│   ├── postcss.config.js      ← PostCSS config
│   ├── eslint.config.js       ← ESLint 9 flat config
│   ├── babel.config.json      ← Babel config
│   ├── .env.development       ← Non-secret dev URLs (committed)
│   ├── .env.production        ← Non-secret prod URLs (committed)
│   └── package.json
├── wp/                        ← WordPress installation at /wp/ subpath
│   └── wp-content/
│       ├── themes/
│       │   ├── headless-base/     ← Active minimal headless theme (zero frontend output)
│       │   └── drywall-toolbox/   ← Legacy theme (kept for reference)
│       └── mu-plugins/
│           ├── dtb-cors.php           ← CORS headers mu-plugin (auto-loaded)
│           └── dtb-schematics-api.php ← Schematic image manifest REST endpoint
├── scripts/                   ← Python utility scripts (catalog, image processing)
├── docs/                      ← Architecture docs, strategy, research
├── dist/                      ← CI build output (gitignored)
├── .github/workflows/
│   └── deploy.yml             ← CI: build → deploy via FTPS to HostGator
├── .htaccess                  ← Root: HTTPS redirect, WP routing, SPA catch-all
└── index.php                  ← Thin passthrough
```


## Quick Start — Local Development

### Requirements

- Node.js 20+ and npm

### Setup

```bash
cd frontend
npm install
```

Dev env vars are pre-configured in `frontend/.env.development`. For WooCommerce API credentials, create `frontend/.env.local` (gitignored):

```
# frontend/.env.local — never commit this file
REACT_APP_WC_AUTH_USER=your_wp_application_password_username
REACT_APP_WC_AUTH_PASS=your_wp_application_password
```

### Commands

```bash
cd frontend

npm run dev             # Webpack dev server → http://localhost:5173
npm run build           # Production build → ../dist/
npm run lint            # ESLint src/
npm run reviews-server  # Start mock reviews server (dev only)

ANALYZE=true npm run build  # Build with bundle analyzer
```

---

## Environment Variables

All prefixed `REACT_APP_*`. Statically replaced at compile time by webpack `DefinePlugin`.

| Variable | Description |
|----------|-------------|
| `REACT_APP_WP_API_BASE` | WordPress REST API base URL |
| `REACT_APP_WC_API_BASE` | WooCommerce REST API base URL |
| `REACT_APP_JWT_ENDPOINT` | JWT token endpoint |
| `REACT_APP_SITE_URL` | Site root URL |
| `REACT_APP_WC_AUTH_USER` | WooCommerce Application Password username (**secret**) |
| `REACT_APP_WC_AUTH_PASS` | WooCommerce Application Password (**secret**) |
| `REACT_APP_STORE_LAUNCH_DATE` | Founding-member promo window date |

Non-secret URLs live in `frontend/.env.production` / `frontend/.env.development`.  
Credentials live in GitHub Actions secrets only — never committed.

---

## API Layer (`frontend/src/api/`)

| File | Description |
|------|-------------|
| `client.js` | Axios instances: `wpClient` (JWT Bearer) and `wcClient` (App Password Basic auth) |
| `auth.js` | `login()`, `logout()`, `refreshToken()`, `getCurrentUser()` |
| `products.js` | `getProducts()`, `getProductById()`, `getProductsByCategory()`, `searchProducts()` |
| `cart.js` | WooCommerce Store API: `getCart()`, `addToCart()`, `updateCartItem()`, `removeCartItem()`, `clearCart()` |
| `schematics.js` | `fetchSchematicMediaManifest()` — WebP image manifest from WP Media Library |
| `orders.js` | Order history and detail |
| `customers.js` | Customer profile management |
| `rewards.js` | Rewards/points system |
| `coupons.js` | Coupon validation |
| `wordpress.js` | Generic WP REST API calls |

On 401: both Axios clients call `clearToken()` and dispatch `window.dispatchEvent(new Event('auth:expired'))`.

---

## WordPress Setup

WordPress lives in `/wp/` on the server (not at the domain root).

- `WP_HOME` = `https://drywalltoolbox.com`
- `WP_SITEURL` = `https://drywalltoolbox.com/wp`

### Required Plugins

- WooCommerce
- JWT Authentication for WP REST API (`jwt-authentication-for-wp-rest-api`)

### Must-Use Plugins

| File | Purpose |
|------|---------|
| `dtb-cors.php` | CORS headers for all REST API responses (auto-loaded) |
| `dtb-schematics-api.php` | `GET /wp-json/dtb/v1/schematics/media` manifest endpoint |

### Headless Theme

`headless-base/` — minimal theme with zero frontend output.  
REST API menu endpoint: `GET /wp-json/headless/v1/menus/<location>`



## Schematic Images — WordPress Media Library

Schematic diagrams are stored as WebP in the WordPress Media Library (not tracked in git).

```bash
# 1. Convert PNG/JPG → WebP
python scripts/convert_schematics_to_webp.py

# 2. Upload to WP Media Library
export WP_BASE_URL=https://drywalltoolbox.com/wp
export WP_AUTH_USER=admin
export WP_AUTH_PASS="xxxx xxxx xxxx xxxx xxxx xxxx"
python scripts/upload_schematics_to_wp.py

# 3. Verify manifest endpoint
curl https://drywalltoolbox.com/wp/wp-json/dtb/v1/schematics/media | python3 -m json.tool
```

The `useSchematicMedia()` hook fetches the manifest at runtime and falls back to static PNG/JPG paths if WP is unavailable.

---

## Production Catalog Hardening

The production WooCommerce catalog is governed by a closed taxonomy policy at
`products/Production/catalogs/config/production_taxonomy_policy.json`.

Use these commands before publishing catalog changes:

```bash
python scripts/production_catalog/normalize_production_catalog.py
python scripts/production_catalog/validate_production_catalog.py
```

The hardening layer enforces:

- one canonical allowed category tree
- exact category alias normalization into canonical values
- explicit brand-to-category allowlists
- deprecated parts labels blocked in controlled taxonomy fields only

`Categories`, `meta:product_family`, and `meta:series` are treated as controlled taxonomy fields.
Tags, descriptions, and SEO copy are intentionally not normalized by this validator.

---

## CI/CD — GitHub Actions

Workflow: `.github/workflows/deploy.yml`  
Trigger: push to `main` when `frontend/**` or `wp/**` changes.

**Steps:** `npm ci` → `npm run build` → validate `dist/index.html` → prune `.map` files → FTPS deploy  
**Deploys:** `dist/` → `drywalltoolbox/dist/` and `wp/wp-content/` → `drywalltoolbox/wp/wp-content/`

### Required GitHub Secrets

| Secret | Description |
|--------|-------------|
| `HOSTGATOR_FTP_HOST` | HostGator FTP hostname |
| `HOSTGATOR_FTP_USER` | HostGator cPanel FTP username |
| `HOSTGATOR_FTP_PASS` | HostGator cPanel FTP password |
| `HOSTGATOR_FTP_PORT` | FTP port (usually `21`) |
| `REACT_APP_WP_API_BASE` | WordPress REST API base URL |
| `REACT_APP_WC_API_BASE` | WooCommerce REST API base URL |
| `REACT_APP_JWT_ENDPOINT` | JWT token endpoint URL |
| `REACT_APP_SITE_URL` | Production site URL |
| `REACT_APP_WC_AUTH_USER` | WooCommerce Application Password username |
| `REACT_APP_WC_AUTH_PASS` | WooCommerce Application Password |

---

## Post-Deploy Verification

- [ ] `https://drywalltoolbox.com` loads React app
- [ ] `https://drywalltoolbox.com/wp/wp-admin/` loads WordPress admin
- [ ] `https://drywalltoolbox.com/wp/wp-json/` returns WP REST API index
- [ ] `https://drywalltoolbox.com/wp/wp-json/wc/v3/products` returns product data
- [ ] `https://drywalltoolbox.com/wp/wp-json/jwt-auth/v1/token` accepts POST, returns token
- [ ] `https://drywalltoolbox.com/wp/wp-json/dtb/v1/schematics/media` returns schematic manifest
- [ ] React Router client-side navigation works on all routes (no 404 on refresh)
- [ ] CORS headers present on all `/wp/wp-json/` responses
- [ ] No `REACT_APP_*` secrets exposed in compiled JS bundle
- [ ] Schematic diagrams load WebP images from WP Media Library

---

## Security

- No credentials committed — all secrets via GitHub Actions secrets only
- `wp-config.php` is gitignored — configure manually on server using `wp-config-sample.php`
- JWT stored in **module-level variable only** (`tokenStore.js`) — never `localStorage` or `sessionStorage`
- Token cleared immediately on any 401 response; `auth:expired` event dispatched globally
- All HTML from WP REST API sanitized with DOMPurify before `dangerouslySetInnerHTML`
- CORS restricted to `drywalltoolbox.com` and `localhost:5173` (dev)
- Security headers set in `.htaccess` (X-Frame-Options, X-Content-Type-Options, etc.)

---

## License

ISC — Built for professional drywall contractors.
