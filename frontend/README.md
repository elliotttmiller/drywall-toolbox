# Drywall Toolbox — Frontend

React SPA source code for [drywalltoolbox.com](https://drywalltoolbox.com).

Built with **React 19 + Webpack**, consuming the headless WordPress + WooCommerce REST API backend.

---

## Local Development

### Prerequisites

- Node.js 20+
- npm 10+

### Install

```bash
# From the frontend/ directory:
npm install
```

### Environment Variables

Non-secret URL configuration is pre-set in `.env.development` (localhost) and `.env.production`.

For local WooCommerce credentials, create `frontend/.env.local` (gitignored):

```
VITE_WC_AUTH_USER=your_wp_application_password_username
VITE_WC_AUTH_PASS=your_application_password_here
```

Application Passwords are generated in:  
**WP Admin → Users → (your user) → Application Passwords**

### Commands

```bash
# Dev server on http://localhost:5173
npm run dev

# Production build → outputs to ../dist/ (repo root)
npm run build

# Lint source
npm run lint
```

---

## Directory Structure

```
frontend/
├── src/
│   ├── api/                 ← API clients and helpers
│   │   ├── client.js        ← wpClient (JWT) + wcClient (App Password) Axios instances
│   │   ├── auth.js          ← login, logout, refreshToken, getCurrentUser
│   │   ├── products.js      ← WooCommerce product endpoints
│   │   └── cart.js          ← WooCommerce Store API cart operations
│   ├── components/          ← Reusable UI components
│   ├── context/             ← React context providers (Cart, WooCommerce, etc.)
│   ├── hooks/               ← Custom React hooks
│   ├── pages/               ← Route-level page components
│   ├── services/            ← Legacy API modules (backward compat)
│   ├── styles/              ← CSS modules and global styles
│   ├── App.jsx              ← Root component with routing
│   └── main.jsx             ← Entry point
├── public/                  ← Static assets (copied to dist/ verbatim)
├── server/                  ← Local reviews dev server
├── webpack.config.cjs       ← Webpack build config
├── vite.config.js           ← Vite config (alternative)
├── .env.development         ← Dev defaults (committed, no secrets)
├── .env.production          ← Production URLs (committed, no secrets)
└── package.json
```

---

## API Architecture

### New API Clients (`src/api/`)

Use these for all new code:

```js
import { wpClient, wcClient } from '@api/client.js';
import { login, logout, getCurrentUser } from '@api/auth.js';
import { getProducts, getProductById } from '@api/products.js';
import { getCart, addToCart } from '@api/cart.js';
```

**`wpClient`** — WordPress REST API, authenticated with JWT from `localStorage`.  
**`wcClient`** — WooCommerce REST API v3, authenticated with Application Password.

### Legacy Services (`src/services/`)

Existing code uses `src/services/api.js` and `src/api/wordpress.js` — these continue to work via webpack DefinePlugin injecting `process.env.REACT_APP_*` vars.

---

## Build Output

Production build (`npm run build`) outputs to `../dist/` (the repo root `dist/` directory):

```
dist/
├── index.html
├── asset-manifest.json
└── assets/
    ├── js/        ← Content-hashed JS chunks
    ├── css/       ← Content-hashed CSS
    └── images/
```

The root `.htaccess` serves `dist/index.html` as the React SPA catch-all for all non-WordPress routes.

---

## Migration Notes

The canonical frontend source is now in `frontend/`. The root-level `src/`, `public/`, and config files (webpack, babel, tailwind) are legacy copies kept for reference until validation is complete. After a successful dry-run deploy:

1. Verify the new `frontend/` build produces identical output to the old root build.
2. Update any documentation or scripts that reference root-level `src/`.
3. Archive root `src/` as `archive/src-legacy/` once confirmed.

---

## Environment Variable Reference

| Variable | Used By | Description |
|----------|---------|-------------|
| `VITE_WP_API_BASE` | `src/api/client.js` | WP REST API base URL |
| `VITE_WC_API_BASE` | `src/api/client.js` | WooCommerce REST API base URL |
| `VITE_JWT_ENDPOINT` | `src/api/auth.js` | JWT token endpoint |
| `VITE_SITE_URL` | `src/api/cart.js` | Site root URL (for Store API) |
| `VITE_WC_AUTH_USER` | `src/api/client.js` | WC Application Password user (**secret**) |
| `VITE_WC_AUTH_PASS` | `src/api/client.js` | WC Application Password (**secret**) |
| `REACT_APP_WC_BASE_URL` | `src/services/api.js` | Legacy WC REST API base |
| `REACT_APP_WC_CONSUMER_KEY` | `src/services/api.js` | Legacy WC consumer key |
| `REACT_APP_WC_CONSUMER_SECRET` | `src/services/api.js` | Legacy WC consumer secret |
| `REACT_APP_WP_BASE_URL` | `src/api/wordpress.js` | Legacy WP root URL |
