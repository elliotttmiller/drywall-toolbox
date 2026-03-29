# Drywall Toolbox

Professional frontend and WordPress theme for Drywall Toolbox — a responsive storefront and product catalog for professional drywall tools.

This repository contains:

- A React-based storefront and admin UI (in `src/`) used for the public site and internal tools.

- A Vite-based ReactPress app (in `reactpress-app/`) deployed as an embedded React app inside WordPress using the [ReactPress](https://wordpress.org/plugins/reactpress/) plugin.

- WordPress theme and plugin code under `wp/wp-content/` that are deployed to production.

- GitHub Actions workflows to deploy both the WordPress theme/plugin assets and the ReactPress React app to HostGator via FTPS.

This README explains how to run the project locally, what lives where, and how to deploy to HostGator safely.

Table of contents

- Quick start (local development)

- Repository layout

- ReactPress deployment (React → WordPress)

- WordPress deployment (HostGator)

- CI/CD (GitHub Actions)

- Troubleshooting & support

## Quick start — local development

### Requirements

- Node.js 20+ and npm

Commands

```bash
# install dependencies (main React app)
npm install

# start dev server (React)
npm run dev

# build for production
npm run build

# preview production build
npm run preview
```

```bash
# install dependencies (ReactPress app)
cd reactpress-app
npm install

# start Vite dev server
npm run dev

# build for ReactPress deployment (outputs to reactpress-app/dist/)
npm run build
```

## Repository layout

Key folders and files:

- `wp/wp-content/` — WordPress theme and plugin code targeted for production.

- `reactpress-app/` — Vite React app (app name: **contacts**) deployed via the ReactPress plugin. Only the generated `dist/` contents are uploaded to the live server.

- `src/`, `public/` — Main React site source and static assets (webpack-based).

- `.github/workflows/deploy.yml` — GitHub Actions workflow with two jobs:
  1. Deploy `wp/wp-content` (theme + plugin) to HostGator.
  2. Build `reactpress-app` with Vite and deploy the `dist/` folder to `wp-content/reactpress/apps/contacts/` on HostGator.

- `css/styles.css` — Centralized site CSS used by both React and WordPress frontends.

## ReactPress deployment (React → WordPress)

### Overview

[ReactPress](https://wordpress.org/plugins/reactpress/) is a WordPress plugin that lets you embed a built React app (a Vite or CRA `dist/` folder) inside any WordPress page.  The plugin looks for apps under `wp-content/reactpress/apps/<appname>/`.

### One-time server setup

1. Install and activate the **ReactPress** plugin in WordPress admin (`Plugins → Add New → Search "ReactPress"`).

2. In WordPress admin navigate to **ReactPress → Apps** and confirm the plugin is ready.

### Local development

```bash
cd reactpress-app
npm install
npm run dev          # Vite dev server at http://localhost:5173/
```

During development the `base` URL in `vite.config.js` is only used for the production build — local `npm run dev` always serves from `/`.

### Building for production

```bash
cd reactpress-app
npm run build        # outputs to reactpress-app/dist/
```

The built `dist/` folder contains `index.html` and an `assets/` sub-folder.  All asset URLs are automatically prefixed with `/wp-content/reactpress/apps/contacts/` (configured via the `base` option in `vite.config.js`).

### Manual deployment

If you need to deploy manually instead of using CI/CD:

1. Build the app (`npm run build` inside `reactpress-app/`).
2. Connect to HostGator with FileZilla (explicit FTPS, port 21).
3. Upload **only the contents of `reactpress-app/dist/`** to `public_html/wp-content/reactpress/apps/contacts/` on the server.  Do **not** upload `reactpress-app/src/`, `node_modules/`, or any other source files.
4. In WordPress admin go to **ReactPress → Apps**, click **Reload**, and confirm **contacts** appears in the list.
5. Assign the **contacts** app to a WordPress page (ReactPress settings panel).
6. Visit the assigned page URL to verify the React app renders correctly.

### File permissions

After uploading, ensure the server can read all files:

```
chmod 644 wp-content/reactpress/apps/contacts/index.html
chmod 644 wp-content/reactpress/apps/contacts/assets/*
chmod 755 wp-content/reactpress/apps/contacts/
chmod 755 wp-content/reactpress/apps/contacts/assets/
```

### Adding a new ReactPress app

To add another app (e.g. `repairs`):

1. Duplicate `reactpress-app/` (or run `npm create vite@latest repairs -- --template react`).
2. Update the `base` in `vite.config.js` to `/wp-content/reactpress/apps/repairs/`.
3. Build and upload `dist/` to the new server directory.
4. Register in ReactPress admin and assign to a page.

## WordPress deployment (HostGator)

### Overview

- We deploy theme and plugin assets (the `wp/wp-content` subtree) to HostGator using a GitHub Action (FTPS).

- The action uploads only `wp/wp-content/themes/...` and `wp/wp-content/plugins/...` to the server — it does not modify WordPress core files.

### Before you deploy

1. Create a full backup of the remote site (cPanel → File Manager or ZIP of `public_html/`).

2. Add repository secrets in GitHub: `HOSTGATOR_FTP_HOST`, `HOSTGATOR_FTP_USER`, `HOSTGATOR_FTP_PASS`.

3. Verify the FTP account in cPanel (username, host, password) and test with a client (FileZilla) using explicit FTPS on port 21.

### Manual deploy options

- FileZilla / WinSCP: connect with explicit FTPS, upload `wp/wp-content/themes/drywall-toolbox/` and the plugin folder to the remote `public_html/wp-content/` path.

- cPanel File Manager: upload and extract ZIP archives when convenient.

## Automated deploy (GitHub Actions)

The repository includes a GitHub Actions workflow (`.github/workflows/deploy.yml`) with **two independent jobs** that run on pushes to `main`.

### Job 1 — Deploy WordPress theme & plugin

Triggers when files under `wp/wp-content/**` change.  Uses `SamKirkland/FTP-Deploy-Action` to upload over FTPS to `public_html/wp-content/`.

### Job 2 — Build & deploy ReactPress app

Triggers when files under `reactpress-app/**` change.

Steps:
1. Installs Node 20 and runs `npm ci` inside `reactpress-app/`.
2. Runs `npm run build` (Vite) to produce `reactpress-app/dist/`.
3. Uploads **only** the `dist/` contents to `public_html/wp-content/reactpress/apps/contacts/` via FTPS.

### Recommended workflow steps

1. Set secrets in the GitHub repository (no credentials in code).

2. Set `dry-run: true` in the workflow for both jobs first to validate connectivity.

3. When satisfied, set `dry-run: false` and trigger the workflow to perform the real upload.

4. After the ReactPress job completes, go to WordPress admin → **ReactPress → Apps**, click **Reload**, and assign the **contacts** app to a page if not already done.

## Troubleshooting

- Connection errors (ENOTFOUND): verify `HOSTGATOR_FTP_HOST` value and DNS.
- Authentication failures (530): verify username and password, test locally with FileZilla, reset the FTP password in cPanel if needed.
- If FTPS is not available for your account, ask HostGator to enable SFTP or switch the workflow to SFTP with the correct server path.

## Support & contact

If you need help with deployment or credentials, contact the site administrator or the developer listed in `package.json`.

## License

MIT — see LICENSE file (if present) for details.

If you'd like, I can expand any section (detailed cPanel steps, troubleshooting flow, or contributor guidelines) or commit this README change and push it for you.


- Verify the three GitHub Secrets (`HOSTGATOR_FTP_HOST`, `HOSTGATOR_FTP_USER`, `HOSTGATOR_FTP_PASS`) are set correctly.
- In cPanel → **FTP Accounts**, confirm the account is active and test credentials with an FTP client (FileZilla).
- Check that the FTP port (21) is not blocked; try SFTP on port 22 if available.

### Site Shows "Installation Failed" or 500 Error After Deploy

- Check HostGator **Error Logs** in cPanel → **Metrics → Errors**.
- Confirm `wp-config.php` is present in `public_html/` (it won't be deployed by CI/CD — you added it manually).
- Confirm `.htaccess` is present in `public_html/`.

### Styles Not Loading (Child Theme)

- In wp-admin → **Appearance → Themes**, confirm the **parent theme (Twenty Twenty-Four)** is installed (not just activated — it must be present).
- Check wp-admin → **Appearance → Theme File Editor** is disabled (expected — `DISALLOW_FILE_EDIT true` is set).
- Hard-refresh the browser (`Ctrl+Shift+R` / `Cmd+Shift+R`).

### WordPress Login Redirect Loop

- This usually means `WP_HOME` / `WP_SITEURL` do not match the actual URL.
- In cPanel File Manager, edit `wp-config.php` and confirm both values are `https://drywalltoolbox.com` (no trailing slash).

### HTTPS Redirect Not Working

- Confirm the SSL certificate is active in cPanel → **SSL/TLS → Manage SSL Sites**.
- Confirm the `.htaccess` `RewriteRule` for HTTPS is in place (Phase 4).
- On HostGator shared hosting, `mod_rewrite` is enabled by default; if it still fails, contact HostGator support.

### Custom Post Type (Tools) Returns 404

- Navigate to wp-admin → **Settings → Permalinks** and click **Save Changes** without changing anything — this flushes the rewrite rules.

### CI/CD Not Triggering

- Confirm you pushed to the `main` branch (not `master` or another branch).
- Confirm the changed files are inside `themes/**` or `plugins/**` (the workflow's `paths` filter).
- Use the **workflow_dispatch** manual trigger to force a run.

---

## 🛠️ Tech Stack

| Layer | Technology |
| ------- | ----------- |
| Frontend SPA | React 19, React Router, Lucide React, Tailwind CSS, Vite/Webpack |
| WordPress Theme | Child theme of Twenty Twenty-Four, PHP 8+, CSS custom properties |
| WordPress Plugin | Vanilla PHP, Custom Post Type (dtb_tool), Custom Taxonomy (dtb_brand) |
| CI/CD | GitHub Actions (GitHub Pages + HostGator FTP deploy) |
| Hosting | HostGator Shared Hosting, cPanel, Softaculous WordPress |

---

## 🔒 Security

- No credentials, passwords, or API keys committed to the repository.
- `wp-config.php` and `.htaccess` are git-ignored; configuration is managed manually in cPanel.
- XML-RPC disabled via WordPress filter and `.htaccess` block.
- Security headers set in both PHP (`functions.php`) and `.htaccess`.
- Author enumeration protection in child theme `functions.php`.
- WordPress version number removed from HTML output.

---

## 📄 License

ISC

---

Built with ❤️ for professional contractors.
