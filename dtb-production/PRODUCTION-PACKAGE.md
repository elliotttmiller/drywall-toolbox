# DTB Production Launch Source Package

`dtb-production/` is a curated copy of the current source and production data required to build, operate, validate, and deploy Drywall Toolbox for launch. Canonical source remains in the existing repository paths; this directory is a deliberately smaller production capsule.

## Included

- `AGENTS.md` — current engineering/architecture authority contract.
- `memory-bank/product.md`, `structure.md`, `tech.md` — current durable production architecture context.
- `.github/workflows/ci-build.yml` and `deploy.yml` — current production validation/release workflow definitions.
- `frontend/` — production storefront source, public assets, build configuration, lockfile, and only the build-safety scripts directly required by `npm run build`.
- `wp/` — tracked WordPress application code only: routing files, DTB must-use plugins, and themes.
- `products/launch/official/dtb_woocommerce_official_catalog.csv` — authoritative WooCommerce production/runtime import catalog.
- `products/launch/official/veeqo_inventory_import.csv` — authoritative Veeqo production/runtime inventory import.
- `products/Production/catalogs/config/production_taxonomy_policy.json` and `product_category_map.json` — current machine-readable production catalog governance.
- root `.htaccess` and `logos/` required by the production web-root contract.

## Product-data boundary

Only these two catalog CSV authorities are allowed in the production capsule:

1. `products/launch/official/dtb_woocommerce_official_catalog.csv`
2. `products/launch/official/veeqo_inventory_import.csv`

Older/stage/intermediate catalog CSVs under `products/Production/catalogs/` are intentionally not copied. Reports, scraped/source datasets, audits, reference prose, pipeline tools, historical exports, universal-part research artifacts, and other product workspaces are excluded unless they later become a verified active production runtime/import dependency.

The only additional product files retained are the current machine-readable taxonomy/category governance JSON files needed to preserve launch catalog policy.

## Intentionally excluded

- root `scripts/` operational/development workspace
- `docs/`, legacy/reference plans, scraped results, reports, audit output, historical exports, scratch/temp data
- legacy/stage/intermediate catalog CSV generations outside the two named launch authorities
- generated `dist/` and `dist-staging/`
- `node_modules/`, build caches, local/staging env files
- `wp-config.php`, secrets, WordPress core, regular `wp-content/plugins/`, uploads, cache, upgrade/runtime state
- logs, backups, uncontrolled database dumps, local IDE/editor state

The two files retained under `frontend/scripts/` are an explicit exception to the root-script exclusion because `frontend/package.json` invokes them as mandatory production build-safety steps.

`.github/workflows/build-dtb-production.yml` regenerates and validates this package from canonical source. Do not hand-edit copied production content inside this directory.