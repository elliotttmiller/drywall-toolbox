# Archive

This directory contains legacy source files that were in the repository root
before the codebase was restructured into its current headless
WordPress + React SPA architecture.

These files are preserved for historical reference only.  
**Do not use them for development or deployment.**

## What to use instead

| Legacy path | Current canonical path |
|---|---|
| `src/` | `frontend/src/` |
| `server/` | `frontend/server/` |
| `package.json` | `frontend/package.json` |
| `webpack.config.cjs` | `frontend/webpack.config.cjs` |
| `tailwind.config.js` | `frontend/tailwind.config.js` |
| `eslint.config.js` | `frontend/eslint.config.js` |
| `babel.config.json` | `frontend/babel.config.json` |
| `postcss.config.js` | `frontend/postcss.config.js` |
| `index.html` | `frontend/index.html` |
| `css/` | `frontend/src/styles/` |
| `js/` | `frontend/src/` |
| `coming-soon.html` | *(removed — site uses React SPA)* |

## Architecture overview

The repository was refactored from a WordPress-theme-embedded React build into:

- **`frontend/`** — React SPA (canonical source, builds to `dist/`)  
- **`wp/`** — WordPress installation at `/wp/` subpath (headless CMS / REST API)  
- **`public/`** — Static brand assets (logos, schematics) served by webpack  
- **`dist/`** — CI build output only (gitignored)

See the root `README.md` for current architecture documentation.
