# Drywall Toolbox

Headless React storefront for Drywalltoolbox.com — powered by WordPress + WooCommerce as the backend CMS.

**Architecture:** React SPA (webpack) → WooCommerce REST API v3 → HostGator shared hosting

This repository contains:

- A React SPA (`src/`) that fetches all product and category data from the WooCommerce REST API. No static product data is bundled — WordPress is the single source of truth.

- WordPress theme and plugin code under `wp/wp-content/` that are deployed to HostGator.

- GitHub Actions workflows to deploy theme/plugin assets to HostGator via FTPS.

---

## Quick start — local development

### Requirements

- Node.js 18+ and npm

### Environment configuration

Copy `.env.example` to `.env.local` and fill in your WooCommerce credentials.  
**Never commit `.env*` files containing real credentials.**

```
# .env.local
REACT_APP_WC_BASE_URL=https://drywalltoolbox.com/wp-json/wc/v3
REACT_APP_WC_CONSUMER_KEY=ck_your_consumer_key_here
REACT_APP_WC_CONSUMER_SECRET=cs_your_consumer_secret_here
REACT_APP_WP_BASE_URL=https://drywalltoolbox.com
```

WooCommerce API keys are generated in **WP Admin → WooCommerce → Settings → Advanced → REST API** (Read/Write permissions).

### Commands

```bash
# install dependencies
npm install

# start dev server (proxies WooCommerce API from live site)
npm run dev

# production build → outputs to dist/
npm run build

# lint source files
npm run lint
```

---

## Repository layout

Key folders and files:

- `wp/wp-content/` — WordPress theme and plugin code targeted for production.

- `src/`, `public/` — React site source and static assets.

- `src/services/api.js` — Centralized WooCommerce REST API module (single source of truth for all data fetching).

- `src/hooks/useFetch.js` — Shared loading/error/empty-state hook for API calls.

- `.github/workflows/deploy.yml` — GitHub Actions workflow that deploys `wp/wp-content` to HostGator.

- `public/.htaccess` — React Router SPA fallback + WordPress/WooCommerce API pass-through rules.

## React frontend — HostGator deploy (FTP)

The React build is a fully static output — no Node.js runtime is required on HostGator.

### 1. Build locally

```bash
npm run build
```

This produces a `dist/` directory of optimized HTML/CSS/JS.

### 2. Upload to HostGator via FTP

Our FTP connection to HostGator is already configured and operational.

1. Open your FTP client (FileZilla) using the existing HostGator credentials.
2. Navigate to `public_html/` in the remote panel.
3. Navigate to your local `dist/` folder in the local panel.
4. Select **all contents** of `dist/` and upload to `public_html/`.
5. Overwrite existing files when prompted.

> Leave WordPress core files in place — they coexist with the React build. The `public/.htaccess` file routes requests correctly between React and WordPress.

### 3. Verify

- `https://drywalltoolbox.com` → React storefront
- `https://drywalltoolbox.com/wp-admin` → WordPress admin
- `https://drywalltoolbox.com/wp-json/wc/v3/products` → WooCommerce JSON

### Required GitHub Actions secrets

| Secret | Description |
|--------|-------------|
| `REACT_APP_WC_BASE_URL` | `https://drywalltoolbox.com/wp-json/wc/v3` |
| `REACT_APP_WC_CONSUMER_KEY` | WooCommerce consumer key (`ck_…`) |
| `REACT_APP_WC_CONSUMER_SECRET` | WooCommerce consumer secret (`cs_…`) |
| `REACT_APP_WP_BASE_URL` | `https://drywalltoolbox.com` |
| `HOSTGATOR_FTP_HOST` | HostGator FTP hostname |
| `HOSTGATOR_FTP_USER` | HostGator cPanel FTP username |
| `HOSTGATOR_FTP_PASS` | HostGator cPanel FTP password |

## WordPress deployment (HostGator)

Overview

- We deploy theme and plugin assets (the `wp/wp-content` subtree) to HostGator using a GitHub Action (FTPS).

- The action uploads only `wp/wp-content/themes/...` and `wp/wp-content/plugins/...` to the server — it does not modify WordPress core files.

Before you deploy

1. Create a full backup of the remote site (cPanel → File Manager or ZIP of `public_html/`).

2. Add repository secrets in GitHub: `HOSTGATOR_FTP_HOST`, `HOSTGATOR_FTP_USER`, `HOSTGATOR_FTP_PASS`.

3. Verify the FTP account in cPanel (username, host, password) and test with a client (FileZilla) using explicit FTPS on port 21.

### Manual deploy options

- FileZilla / WinSCP: connect with explicit FTPS, upload `wp/wp-content/themes/drywall-toolbox/` and the plugin folder to the remote `public_html/wp-content/` path.

- cPanel File Manager: upload and extract ZIP archives when convenient.

## Automated deploy (GitHub Actions)

The repository includes a GitHub Actions workflow that runs on pushes to `main` when files under `wp/wp-content/**` change. The workflow uses `SamKirkland/FTP-Deploy-Action` to upload files over FTPS.

Recommended workflow steps

1. Set secrets in the GitHub repository (no credentials in code).

2. Run the workflow in `dry-run: true` mode first to validate connectivity.

3. When satisfied, set `dry-run: false` and trigger the workflow to perform the real upload.

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
