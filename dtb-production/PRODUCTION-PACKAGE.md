# DTB Production Launch Package

This directory is reserved for the generated, deployment-ready production launch payload defined by the active deployment contract.

Required contents after generation:

- compiled React production output at the directory root
- `logos/`
- root `.htaccess`
- `wp/.htaccess`
- `wp/index.php`
- `wp/wp-content/mu-plugins/`
- `wp/wp-content/themes/`

Intentionally excluded:

- `wp-config.php` and all secrets
- WordPress core
- regular `wp-content/plugins/`
- `wp-content/uploads/`
- caches, upgrade/runtime state, logs, backups, and database dumps
- frontend source, `node_modules`, build caches, local/staging env files, docs, product workspaces, and development tooling

The canonical source remains the existing repository paths. `.github/workflows/build-dtb-production.yml` deterministically builds, validates, and materializes this directory from those sources. Do not hand-edit generated build assets.
