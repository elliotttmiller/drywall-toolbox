# DTB Production Launch Source Package

`dtb-production/` is a curated copy of the source and production data required to build, operate, validate, and deploy Drywall Toolbox for launch. Canonical source remains in the existing repository paths; this directory is a deliberately smaller production capsule.

## Included

- `AGENTS.md` — engineering/architecture authority contract.
- `memory-bank/product.md`, `structure.md`, `tech.md` — durable production architecture context.
- `.github/workflows/ci-build.yml` and `deploy.yml` — production validation/release workflow definitions.
- `frontend/` — production storefront source, public assets, build configuration, lockfile, and only the build-safety scripts directly required by `npm run build`.
- `wp/` — tracked WordPress application code only: routing files, DTB must-use plugins, and themes.
- `products/` — curated production catalog/taxonomy/compatibility data, excluding research/audit/source-history clutter.
- root `.htaccess` and `logos/` required by the production web-root contract.

## Product-data boundary

The package keeps production-authoritative/useful catalog material under `products/Production/catalogs/`, while excluding report, source-scrape, miscellaneous audit, backup, temporary, and research subtrees. It also preserves the canonical production taxonomy/category configuration, the schematic tool crosswalk when present, and canonical universal-part CSV/JSON data when present.

## Intentionally excluded

- root `scripts/` operational/development workspace
- `docs/`, research/reference plans, scraped results, reports, audit output, historical exports, scratch/temp data
- generated `dist/` and `dist-staging/`
- `node_modules/`, build caches, local/staging env files
- `wp-config.php`, secrets, WordPress core, regular `wp-content/plugins/`, uploads, cache, upgrade/runtime state
- logs, backups, uncontrolled database dumps, local IDE/editor state

The two files retained under `frontend/scripts/` are an explicit exception to the root-script exclusion because `frontend/package.json` invokes them as mandatory production build-safety steps.

`.github/workflows/build-dtb-production.yml` regenerates and validates this package from canonical source. Do not hand-edit copied production content inside this directory.