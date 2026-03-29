# Drywall Toolbox — Professional Tools & Equipment

A modern, fully responsive platform for professional drywall tools and equipment, built with React and deployable to both GitHub Pages (React SPA) and HostGator WordPress (themes/plugins).

---

## Table of Contents

1. [React App — Quick Start](#react-app--quick-start)
2. [Repository Structure](#repository-structure)
3. [WordPress Deployment to HostGator](#wordpress-deployment-to-hostgator)
   - [Prerequisites](#prerequisites)
   - [Phase 1 — GitHub Secrets Setup](#phase-1--github-secrets-setup)
   - [Phase 2 — WordPress Install on HostGator (Manual)](#phase-2--wordpress-install-on-hostgator-manual)
   - [Phase 3 — wp-config.php Additions (Manual, cPanel)](#phase-3--wp-configphp-additions-manual-cpanel)
   - [Phase 4 — .htaccess Configuration (Manual, cPanel)](#phase-4--htaccess-configuration-manual-cpanel)
   - [Phase 5 — DNS Records](#phase-5--dns-records)
   - [Phase 6 — Activate Theme & Plugin](#phase-6--activate-theme--plugin)
4. [Automated CI/CD Deploy (GitHub Actions)](#automated-cicd-deploy-github-actions)
5. [Verification Checklist](#verification-checklist)
6. [Troubleshooting](#troubleshooting)

---

## React App — Quick Start

### Prerequisites

- Node.js 16+ and npm

### Commands

```bash
# Install dependencies
npm install

# Start development server (http://localhost:5173)
npm run dev

# Production build → dist/
npm run build

# Preview production build locally
npm run preview
```

### Live GitHub Pages Site

`https://elliotttmiller.github.io/drywall-toolbox/`

Pushes to `main` trigger automatic GitHub Pages deployment via `.github/workflows/deploy.yml`.

---

## Repository Structure

```
drywall-toolbox/
├── .github/
│   └── workflows/
│       ├── deploy.yml                  # GitHub Pages CI/CD (React SPA)
│       └── deploy-to-hostgator.yml     # HostGator WordPress CI/CD (FTP)
├── themes/
│   └── drywall-toolbox-child/          # WordPress child theme
│       ├── style.css                   # Theme header + Industrial Professional CSS
│       └── functions.php               # Parent enqueue, security hardening
├── plugins/
│   └── dtb-custom-functionality/       # Site-specific plugin
│       └── dtb-custom-functionality.php
├── src/                                # React application source
├── public/                             # Static assets
├── .gitignore
└── README.md                           # ← You are here
```

> **Security note:** `wp-config.php` and `.htaccess` are listed in `.gitignore` and must **never** be committed. Use the snippets in this README to configure them manually in HostGator cPanel.

---

## WordPress Deployment to HostGator

### Prerequisites

| Item | Details |
|------|---------|
| HostGator account | Shared hosting plan with cPanel access |
| Domain | `drywalltoolbox.com` pointed to HostGator nameservers |
| SSL certificate | Free AutoSSL via cPanel → SSL/TLS |
| WordPress | Installed via Softaculous in cPanel |
| GitHub account | With admin access to this repository |

---

### Phase 1 — GitHub Secrets Setup

The automated FTP deploy requires three secrets. Add them at:

**GitHub → Repository → Settings → Secrets and variables → Actions → New repository secret**

| Secret Name | Value | Where to find it |
|-------------|-------|-----------------|
| `HOSTGATOR_FTP_HOST` | Your FTP hostname (e.g., `ftp.drywalltoolbox.com` or the server IP) | cPanel → **FTP Accounts** → click "Configure FTP Client" next to your account |
| `HOSTGATOR_FTP_USER` | Your cPanel username (e.g., `drywalluser`) | cPanel → top-right corner shows your username; or the FTP account username |
| `HOSTGATOR_FTP_PASS` | Your cPanel / FTP account password | The password you set when creating the FTP account in cPanel |

> **Tip:** In cPanel, navigate to **FTP Accounts**, find your main account, and click **Configure FTP Client** to see the exact hostname and username.

---

### Phase 2 — WordPress Install on HostGator (Manual)

1. Log in to cPanel at `https://drywalltoolbox.com/cpanel` (or use the HostGator portal).
2. Scroll to the **Website** section and click **Softaculous Apps Installer**.
3. Click **WordPress** → **Install Now**.
4. Fill in:
   - **Choose Protocol:** `https://`
   - **Choose Domain:** `drywalltoolbox.com`
   - **In Directory:** leave blank (install to root)
   - **Site Name:** Drywall Toolbox
   - **Admin Username:** choose a unique name (avoid "admin")
   - **Admin Password:** strong password (16+ chars, mixed case, numbers, symbols)
   - **Admin Email:** your real email address
5. Click **Install** and wait for confirmation.
6. Note the WordPress admin URL: `https://drywalltoolbox.com/wp-admin`

---

### Phase 3 — wp-config.php Additions (Manual, cPanel)

> **IMPORTANT:** Do NOT commit `wp-config.php` to the repository.

1. In cPanel, open **File Manager** → navigate to `public_html/`.
2. Right-click `wp-config.php` → **Edit**.
3. Find the line that reads:

   ```php
   /* That's all, stop editing! Happy publishing. */
   ```

4. **Paste the following block ABOVE that line:**

```php
/* ============================================================
   DRYWALL TOOLBOX — Custom wp-config.php additions
   Paste above the "stop editing" comment.
   ============================================================ */

// Force HTTPS for all URLs
define( 'WP_HOME',    'https://drywalltoolbox.com' );
define( 'WP_SITEURL', 'https://drywalltoolbox.com' );

// Redirect HTTP → HTTPS at the WordPress level
if ( isset( $_SERVER['HTTP_X_FORWARDED_PROTO'] ) &&
     'https' === $_SERVER['HTTP_X_FORWARDED_PROTO'] ) {
    $_SERVER['HTTPS'] = 'on';
}

// Increase memory limit for shared hosting
define( 'WP_MEMORY_LIMIT', '256M' );

// Disable the file editor in wp-admin (security)
define( 'DISALLOW_FILE_EDIT', true );

// Limit post revisions to save database space (shared hosting)
define( 'WP_POST_REVISIONS', 5 );

// Disable automatic background updates (control updates manually)
define( 'WP_AUTO_UPDATE_CORE', false );

// Disable WP Cron (replace with a real server cron in cPanel for reliability)
define( 'DISABLE_WP_CRON', true );

// Security salts — REPLACE all values below with fresh salts from:
// https://api.wordpress.org/secret-key/1.1/salt/
// (Generate and paste the full block; each value must be unique)
define( 'AUTH_KEY',         'REPLACE_WITH_UNIQUE_RANDOM_STRING' );
define( 'SECURE_AUTH_KEY',  'REPLACE_WITH_UNIQUE_RANDOM_STRING' );
define( 'LOGGED_IN_KEY',    'REPLACE_WITH_UNIQUE_RANDOM_STRING' );
define( 'NONCE_KEY',        'REPLACE_WITH_UNIQUE_RANDOM_STRING' );
define( 'AUTH_SALT',        'REPLACE_WITH_UNIQUE_RANDOM_STRING' );
define( 'SECURE_AUTH_SALT', 'REPLACE_WITH_UNIQUE_RANDOM_STRING' );
define( 'LOGGED_IN_SALT',   'REPLACE_WITH_UNIQUE_RANDOM_STRING' );
define( 'NONCE_SALT',       'REPLACE_WITH_UNIQUE_RANDOM_STRING' );

/* ============================================================ */
```

> **Security:** Visit [https://api.wordpress.org/secret-key/1.1/salt/](https://api.wordpress.org/secret-key/1.1/salt/) to generate fresh salts and replace all `REPLACE_WITH_UNIQUE_RANDOM_STRING` placeholders.

5. Click **Save Changes** and close the editor.

---

### Phase 4 — .htaccess Configuration (Manual, cPanel)

> **IMPORTANT:** Do NOT commit `.htaccess` to the repository.

1. In cPanel **File Manager**, navigate to `public_html/`.
2. If `.htaccess` does not exist, click **+ File** to create it. If it exists, right-click → **Edit**.
3. **Replace the entire file contents** with the block below:

```apache
# ==============================================================
# DRYWALL TOOLBOX — .htaccess
# HostGator Shared Hosting
# ==============================================================

# --------------------------------------------------------------
# 1. HTTPS Redirect (HTTP → HTTPS, non-www → www optional)
# --------------------------------------------------------------
<IfModule mod_rewrite.c>
    RewriteEngine On

    # Redirect all HTTP traffic to HTTPS
    RewriteCond %{HTTPS} off
    RewriteRule ^ https://%{HTTP_HOST}%{REQUEST_URI} [L,R=301]

    # Optional: redirect non-www to www
    # RewriteCond %{HTTP_HOST} !^www\. [NC]
    # RewriteRule ^ https://www.%{HTTP_HOST}%{REQUEST_URI} [L,R=301]
</IfModule>

# --------------------------------------------------------------
# 2. WordPress Standard Rewrite Rules
# --------------------------------------------------------------
<IfModule mod_rewrite.c>
    RewriteEngine On
    RewriteBase /
    RewriteRule ^index\.php$ - [L]
    RewriteCond %{REQUEST_FILENAME} !-f
    RewriteCond %{REQUEST_FILENAME} !-d
    RewriteRule . /index.php [L]
</IfModule>

# --------------------------------------------------------------
# 3. Security Headers
# --------------------------------------------------------------
<IfModule mod_headers.c>
    # Force HTTPS for 1 year; include subdomains
    Header always set Strict-Transport-Security "max-age=31536000; includeSubDomains; preload"

    # Prevent clickjacking
    Header always set X-Frame-Options "SAMEORIGIN"

    # Prevent MIME-type sniffing
    Header always set X-Content-Type-Options "nosniff"

    # Enable XSS filter in older browsers
    Header always set X-XSS-Protection "1; mode=block"

    # Control referrer information
    Header always set Referrer-Policy "strict-origin-when-cross-origin"

    # Restrict browser features
    Header always set Permissions-Policy "geolocation=(), microphone=(), camera=()"

    # Remove server version info
    Header unset X-Powered-By
    Header always unset X-Powered-By

    # Force HTTPS upgrade for mixed content
    Header always set Content-Security-Policy "upgrade-insecure-requests"
</IfModule>

# --------------------------------------------------------------
# 4. Block Common Attack Vectors
# --------------------------------------------------------------
<IfModule mod_rewrite.c>
    RewriteEngine On

    # Block access to wp-config.php
    RewriteRule ^wp-config\.php$ - [F,L]

    # Block access to xmlrpc.php (DDoS / brute-force vector)
    RewriteRule ^xmlrpc\.php$ - [F,L]

    # Block .git directory access
    RewriteRule ^\.git/ - [F,L]
</IfModule>

# Block access to hidden files (dotfiles) except .well-known
<FilesMatch "^\.(?!well-known)">
    Require all denied
</FilesMatch>

# Block access to sensitive file extensions
<FilesMatch "\.(sql|bak|log|env|ini|sh|bash)$">
    Require all denied
</FilesMatch>

# --------------------------------------------------------------
# 5. Browser Caching (Performance)
# --------------------------------------------------------------
<IfModule mod_expires.c>
    ExpiresActive On
    ExpiresByType image/jpeg   "access plus 1 year"
    ExpiresByType image/png    "access plus 1 year"
    ExpiresByType image/gif    "access plus 1 year"
    ExpiresByType image/webp   "access plus 1 year"
    ExpiresByType image/svg+xml "access plus 1 year"
    ExpiresByType text/css     "access plus 1 month"
    ExpiresByType application/javascript "access plus 1 month"
    ExpiresByType application/x-font-woff2 "access plus 1 year"
</IfModule>

# --------------------------------------------------------------
# 6. Gzip Compression (Performance)
# --------------------------------------------------------------
<IfModule mod_deflate.c>
    AddOutputFilterByType DEFLATE text/html text/plain text/xml
    AddOutputFilterByType DEFLATE text/css application/javascript
    AddOutputFilterByType DEFLATE application/json application/xml
    AddOutputFilterByType DEFLATE image/svg+xml application/x-font-woff2
</IfModule>
```

4. Click **Save Changes**.

---

### Phase 5 — DNS Records

Configure these records in HostGator cPanel → **Zone Editor** (or your domain registrar's DNS panel if your domain is registered elsewhere):

| Type | Host/Name | Value / Points To | TTL |
|------|-----------|------------------|-----|
| `A` | `@` (or `drywalltoolbox.com`) | HostGator server IP (find in cPanel → **General Information** → **Shared IP Address**) | 14400 |
| `A` | `www` | Same HostGator server IP | 14400 |
| `CNAME` | `ftp` | `drywalltoolbox.com` | 14400 |
| `MX` | `@` | HostGator mail server (e.g., `mail.drywalltoolbox.com`) | 14400 |

> **Nameservers (if domain registered outside HostGator):**
> Point your domain registrar's nameservers to:
> - `ns1.hostgator.com`
> - `ns2.hostgator.com`
>
> DNS propagation takes up to 48 hours.

---

### Phase 6 — Activate Theme & Plugin

After the GitHub Actions deploy runs successfully:

1. Log in to `https://drywalltoolbox.com/wp-admin`.
2. Navigate to **Appearance → Themes**.
3. Find **Drywall Toolbox Child** and click **Activate**.
4. Navigate to **Plugins → Installed Plugins**.
5. Find **DTB Custom Functionality** and click **Activate**.
6. Navigate to **Settings → Permalinks** and click **Save Changes** (flushes rewrite rules for the custom post type).

---

## Automated CI/CD Deploy (GitHub Actions)

### Workflow: `deploy-to-hostgator.yml`

| Property | Value |
|----------|-------|
| Trigger | Push to `main` branch (only when `themes/**` or `plugins/**` change) |
| Action | FTP deploy via `SamKirkland/FTP-Deploy-Action@v4.3.4` |
| Target | `public_html/wp-content/` on HostGator |
| Excludes | `.git`, `.github`, `node_modules`, `.env`, `logs`, `dist`, `build`, `wp-config.php`, `.htaccess` |

### What gets deployed

```
themes/drywall-toolbox-child/  →  /public_html/wp-content/themes/drywall-toolbox-child/
plugins/dtb-custom-functionality/  →  /public_html/wp-content/plugins/dtb-custom-functionality/
```

### How to trigger a manual deploy

1. Go to **GitHub → Actions → Deploy WordPress Theme & Plugin to HostGator**.
2. Click **Run workflow** → select branch `main` → **Run workflow**.

---

## Verification Checklist

Run through this checklist after completing all phases:

- [ ] **DNS** — `https://drywalltoolbox.com` loads (no ERR_NAME_NOT_RESOLVED)
- [ ] **SSL** — Browser shows padlock; no "Not Secure" warning
- [ ] **HTTPS Redirect** — `http://drywalltoolbox.com` → `https://drywalltoolbox.com` (301)
- [ ] **WordPress Admin** — `https://drywalltoolbox.com/wp-admin` loads and login works
- [ ] **Child Theme Active** — wp-admin → Appearance → Themes shows "Drywall Toolbox Child" active
- [ ] **Plugin Active** — wp-admin → Plugins shows "DTB Custom Functionality" active
- [ ] **GitHub Secrets** — Three FTP secrets are set in GitHub repository settings
- [ ] **CI/CD Deploy** — GitHub Actions run completes without error (green check)
- [ ] **Security Headers** — Visit [https://securityheaders.com](https://securityheaders.com) and scan your domain (target: A or A+)
- [ ] **wp-config Salts** — All `REPLACE_WITH_UNIQUE_RANDOM_STRING` values replaced with real salts
- [ ] **XML-RPC Blocked** — `https://drywalltoolbox.com/xmlrpc.php` returns 403 Forbidden
- [ ] **wp-config.php Protected** — Direct URL access returns 403 Forbidden

---

## Troubleshooting

### FTP Deploy Fails — "Authentication Failed"

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
|-------|-----------|
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

**Built with ❤️ for professional contractors**
