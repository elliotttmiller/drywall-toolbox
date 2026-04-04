<?php
/*
 * =============================================================================
 * DTB wp-config.php Constants — Configuration Reference
 * =============================================================================
 *
 * This file contains NO executable code.
 * All content below is a comment-only reference for site administrators.
 *
 * Copy the define() block into your wp-config.php (or a file included by it)
 * and fill in the values for your environment.
 *
 * -----------------------------------------------------------------------------
 * READY-TO-COPY CONSTANTS BLOCK
 * -----------------------------------------------------------------------------
 *
 * define('DRYWALL_ALLOWED_ORIGIN',   'https://drywalltoolbox.com');
 * define('DRYWALL_JWT_SECRET',       '');  // 32+ char random string
 * define('WC_PROXY_CONSUMER_KEY',    'ck_...');
 * define('WC_PROXY_CONSUMER_SECRET', 'cs_...');
 * define('WC_WEBHOOK_SECRET',        '');  // 32+ char random string
 * define('DTB_ADMIN_EMAIL',          'you@drywalltoolbox.com');
 * define('DISALLOW_FILE_EDIT',       true);
 *
 * -----------------------------------------------------------------------------
 * CONSTANT DOCUMENTATION
 * -----------------------------------------------------------------------------
 *
 * DRYWALL_ALLOWED_ORIGIN
 *   What it does : Adds an extra origin to the CORS allowlist maintained by
 *                  dtb_allowed_origins() in 00-dtb-loader.php. Useful for
 *                  staging domains or custom sub-domains.
 *   Where to get : The full scheme + host of your extra origin, e.g.
 *                  'https://staging.drywalltoolbox.com'. No trailing slash.
 *   What breaks  : Without it the extra origin is blocked by CORS; only the
 *                  hard-coded production domain and localhost URLs are allowed.
 *                  Set it only when you need a non-standard origin.
 *
 * DRYWALL_JWT_SECRET
 *   What it does : The HMAC-SHA256 signing secret used by dtb_generate_jwt()
 *                  and dtb_verify_jwt() in dtb-auth.php. Every JWT issued to
 *                  SPA users is signed with this value. Must be at least 32
 *                  characters of cryptographically random data.
 *   Where to get : Generate one with: php -r "echo bin2hex(random_bytes(32));"
 *                  or use a password manager's secure-string generator.
 *   What breaks  : Without it no JWT can be signed or verified — all login
 *                  attempts return a 401 and the SPA cannot authenticate users.
 *
 * WC_PROXY_CONSUMER_KEY
 *   What it does : WooCommerce REST API consumer key used by dtb-rest-api.php
 *                  to make server-side proxy calls to wc/v3/* endpoints. The
 *                  key authenticates WordPress → WooCommerce internal requests.
 *   Where to get : WordPress Admin → WooCommerce → Settings → Advanced →
 *                  REST API → Add Key. Set Read/Write permissions.
 *   What breaks  : Without it all product, category, order, and customer proxy
 *                  routes return 401 from the WC internal API.
 *
 * WC_PROXY_CONSUMER_SECRET
 *   What it does : Paired with WC_PROXY_CONSUMER_KEY to form the Basic Auth
 *                  header for internal WC REST proxy calls.
 *   Where to get : Shown once at key creation (same screen as above). Store it
 *                  immediately — WooCommerce never displays it again.
 *   What breaks  : Same as WC_PROXY_CONSUMER_KEY — all proxy routes fail.
 *
 * WC_WEBHOOK_SECRET
 *   What it does : HMAC secret used to validate incoming WooCommerce product
 *                  webhooks (created/updated/deleted/restored). The webhook
 *                  receiver in dtb-rest-api.php rejects any request whose
 *                  X-WC-Webhook-Signature does not match this secret.
 *   Where to get : Generate one with: php -r "echo bin2hex(random_bytes(32));"
 *                  Set the same value on each webhook in WooCommerce →
 *                  Settings → Advanced → Webhooks.
 *   What breaks  : Without it drywall_ensure_webhooks() silently skips webhook
 *                  creation, and any manually created webhook will be rejected
 *                  with a 401 signature mismatch, so the product cache is never
 *                  invalidated automatically.
 *
 * DTB_ADMIN_EMAIL
 *   What it does : Destination address for admin notification e-mails sent by
 *                  dtb-coming-soon.php on new subscriber sign-ups.
 *   Where to get : Your operational inbox — typically the same address as the
 *                  WordPress admin e-mail in Settings → General.
 *   What breaks  : Without it new-subscriber notifications are silently
 *                  dropped (WordPress falls back to the admin_email option
 *                  value stored in the database, so notifications still send
 *                  if that option is set correctly).
 *
 * DISALLOW_FILE_EDIT
 *   What it does : Removes the Theme/Plugin file editor from the WordPress
 *                  admin UI. Strongly recommended for production sites to
 *                  prevent remote code execution through a compromised admin
 *                  account.
 *   Where to get : No value to fetch — just set to true.
 *   What breaks  : Theme and plugin files can no longer be edited from the
 *                  WordPress admin. Make all code changes via SSH/FTP/git.
 *
 * -----------------------------------------------------------------------------
 * OPTIONAL CONSTANTS (not shown in the ready-to-copy block above)
 * -----------------------------------------------------------------------------
 *
 * define('DTB_WC_CSV_FILENAME', 'product-wp-catalog-c7p3my05pn.csv');
 *   Override the default catalog CSV filename (set in dtb-utils.php).
 *
 * define('DTB_WEBHOOK_DELIVERY_URL', 'https://drywalltoolbox.com/wp-json/drywall/v1/webhooks/products');
 *   Override the WooCommerce webhook delivery URL (drywall_ensure_webhooks).
 *
 * define('DTB_IMPORT_SECRET', '');
 *   Token for CI/CD-triggered catalog imports via POST /dtb/v1/import-catalog.
 *   If omitted, the dtb_import_secret WordPress option is used as fallback.
 *
 * define('DTB_WC_AUTH_USER', '');
 * define('DTB_WC_AUTH_PASS', '');
 *   Application Password username/password pair exposed to trusted browser
 *   origins via GET /dtb/v1/config. Used by the React SPA to authenticate
 *   WooCommerce Store API calls directly from the browser.
 *
 * =============================================================================
 */
