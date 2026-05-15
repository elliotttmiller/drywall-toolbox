<?php
/**
 * WordPress Configuration — Drywall Toolbox (Sample / Template)
 *
 * Copy this file to wp-config.php and fill in real values.
 * This file is safe to commit — it contains NO real credentials.
 *
 * Headless WooCommerce storefront.
 * WordPress lives at /wp/ (subdirectory install).
 * React SPA served from the domain root.
 *
 * Sections
 * ────────
 *   1. Database
 *   2. Authentication keys & salts
 *   3. Table prefix
 *   4. Environment & debugging
 *   5. URLs & subdirectory install
 *   6. Performance & memory
 *   7. Security hardening
 *   8. Cookie paths (subdirectory fix)
 *   9. DTB application constants  ← all mu-plugin constants live here
 *  10. WordPress bootstrap
 *
 * @link https://developer.wordpress.org/advanced-administration/wordpress/wp-config/
 * @package WordPress
 */

// ============================================================================
// 1. DATABASE
// ============================================================================

define( 'DB_NAME',     'database_name_here' );
define( 'DB_USER',     'username_here' );
define( 'DB_PASSWORD', 'password_here' );
define( 'DB_HOST',     'localhost' );
define( 'DB_CHARSET',  'utf8mb4' );
define( 'DB_COLLATE',  '' );

// ============================================================================
// 2. AUTHENTICATION KEYS & SALTS
//    Regenerate at: https://api.wordpress.org/secret-key/1.1/salt/
// ============================================================================

define( 'AUTH_KEY',         'put your unique phrase here' );
define( 'SECURE_AUTH_KEY',  'put your unique phrase here' );
define( 'LOGGED_IN_KEY',    'put your unique phrase here' );
define( 'NONCE_KEY',        'put your unique phrase here' );
define( 'AUTH_SALT',        'put your unique phrase here' );
define( 'SECURE_AUTH_SALT', 'put your unique phrase here' );
define( 'LOGGED_IN_SALT',   'put your unique phrase here' );
define( 'NONCE_SALT',       'put your unique phrase here' );

// ============================================================================
// 3. TABLE PREFIX
// ============================================================================

$table_prefix = 'wp_';

// ============================================================================
// 4. ENVIRONMENT & DEBUGGING
//
//    WP_ENVIRONMENT_TYPE drives wp_get_environment_type() — used by WP core,
//    WooCommerce, and plugins to gate dev-only behaviour.
//    Values: 'production' | 'staging' | 'development' | 'local'
//
//    WP_DEBUG_LOG writes to wp-content/debug.log silently (never shown to
//    visitors because WP_DEBUG_DISPLAY is false).
//    Set WP_DEBUG to true temporarily when diagnosing issues; always false
//    on a live storefront.
// ============================================================================

define( 'WP_ENVIRONMENT_TYPE', 'production' );

define( 'WP_DEBUG',         false );  // Set true temporarily to trace issues.
define( 'WP_DEBUG_LOG',     true  );  // Log to wp-content/debug.log silently.
define( 'WP_DEBUG_DISPLAY', false );  // Never echo errors to the browser.
define( 'SCRIPT_DEBUG',     false );  // Use minified core JS/CSS in production.

// ============================================================================
// 5. URLS — SUBDIRECTORY INSTALL
//
//    WP lives at /wp/ on the server; the public-facing URL has no /wp/ prefix.
//    WP_HOME    = what visitors type (domain root).
//    WP_SITEURL = where WordPress core files actually live.
//
//    WP_CONTENT_DIR / WP_CONTENT_URL are explicit because the CI/CD workflow
//    tracks wp-content in the repo and deploys it to /wp/wp-content/ on the
//    server.  Without explicit constants WP would resolve them from WP_SITEURL,
//    which is correct, but being explicit avoids surprises if WP_SITEURL ever
//    changes.
// ============================================================================

define( 'WP_HOME',    'https://yourdomain.com' );
define( 'WP_SITEURL', 'https://yourdomain.com/wp' );

define( 'WP_CONTENT_DIR', __DIR__ . '/wp-content' );
define( 'WP_CONTENT_URL', 'https://yourdomain.com/wp/wp-content' );

// ============================================================================
// 6. PERFORMANCE & MEMORY
//
//    WP_MEMORY_LIMIT      PHP memory cap for front-end requests.
//    WP_MAX_MEMORY_LIMIT  Raised cap for wp-admin / WP-CLI / WC importer.
//    WP_CACHE             Signals caching plugins that object caching is
//                         desired; does NOT activate caching by itself.
//    WP_POST_REVISIONS    Caps revision rows per post (5 is sensible for a
//                         headless store where post body rarely changes).
//    AUTOSAVE_INTERVAL    Seconds between autosaves (default 60).  300 reduces
//                         unnecessary DB writes on a primarily WC site.
//    DISABLE_WP_CRON      false = use standard WP-Cron triggered by page loads.
//                         HostGator shared hosting handles this fine.
//                         Switch to true + a real cron job only if WC scheduled
//                         actions start missing (Action Scheduler will warn).
// ============================================================================

define( 'WP_MEMORY_LIMIT',     '256M' );
define( 'WP_MAX_MEMORY_LIMIT', '512M' );
define( 'WP_CACHE',            true   );
define( 'WP_POST_REVISIONS',   5      );
define( 'AUTOSAVE_INTERVAL',   300    );
define( 'DISABLE_WP_CRON',     false  );

// ============================================================================
// 7. SECURITY HARDENING
//
//    DISALLOW_FILE_EDIT       Removes Appearance > Editor and Plugins > Editor
//                             from wp-admin; prevents code injection via UI.
//    DISALLOW_FILE_MODS       Blocks plugin/theme installs & updates via UI.
//                             Kept false: updates are managed via GitHub CI/CD.
//    AUTOMATIC_UPDATER_DISABLED  All WP core auto-updates off; updates are
//                             applied deliberately through git.
//    FORCE_SSL_ADMIN          Forces wp-admin over HTTPS unconditionally.
//                             Safe to hard-code true on this production host.
//    IMAGE_EDIT_OVERWRITE     Replaces the original image when saving edits in
//                             the media library (avoids unbounded disk growth).
// ============================================================================

define( 'DISALLOW_FILE_EDIT',         true  );
define( 'DISALLOW_FILE_MODS',         false );
define( 'AUTOMATIC_UPDATER_DISABLED', true  );
define( 'FORCE_SSL_ADMIN',            true  );
define( 'IMAGE_EDIT_OVERWRITE',       true  );

// ============================================================================
// 8. COOKIE PATHS — SUBDIRECTORY FIX
//
//    With WordPress at /wp/ the default cookie path resolves to '/wp/',
//    which means the auth cookie is NOT sent on requests to '/wp/wp-admin/'
//    (browsers require the cookie path to be a prefix of the request path,
//    and '/wp/' is not a prefix of '/wp/wp-admin/' in the trailing-slash sense
//    on some browsers).  Setting all path constants to '/' ensures the login
//    cookie is valid across the entire domain.
//
//    ADMIN_COOKIE_PATH stays scoped to '/wp/wp-admin' so the admin session
//    cookie is not inadvertently sent to the React SPA's API routes.
// ============================================================================

define( 'COOKIEPATH',        '/'            );
define( 'SITECOOKIEPATH',    '/'            );
define( 'COOKIE_PATH',       '/'            );
define( 'SITE_COOKIE_PATH',  '/'            );
define( 'ADMIN_COOKIE_PATH', '/wp/wp-admin' );

// ============================================================================
// 9. DTB APPLICATION CONSTANTS
//    All constants consumed by wp-content/mu-plugins/ files.
//    Full reference: wp/wp-content/mu-plugins/README.md
//
//    ╔══════════════════════════════════════════════════════════════════════╗
//    ║  SECURITY NOTE                                                      ║
//    ║  This file is safe to commit — it contains NO real credentials.    ║
//    ║  Copy to wp-config.php and replace all placeholder values.         ║
//    ╚══════════════════════════════════════════════════════════════════════╝
// ============================================================================

// ── 9a. WooCommerce server-side proxy credentials ────────────────────────────
//    Used by dtb-rest-api.php to authenticate server→WC REST API v3 calls.
//    Consumer key/secret never reach the browser.
//    Generate: WP Admin → WooCommerce → Settings → Advanced → REST API
//              → Add Key → Read/Write → copy Key and Secret.
// ─────────────────────────────────────────────────────────────────────────────
define( 'WC_PROXY_CONSUMER_KEY',    'ck_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx' );
define( 'WC_PROXY_CONSUMER_SECRET', 'cs_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx' );

// ── 9b. WooCommerce Application Password (SPA runtime auth) ──────────────────
//    Returned to the React SPA at runtime via GET /wp-json/dtb/v1/config.
//    Only returned to requests carrying an allowed CORS Origin header.
//    Generate: WP Admin → Users → (your user) → Application Passwords.
//    Must match REACT_APP_WC_AUTH_USER / REACT_APP_WC_AUTH_PASS in .env.production
//    and REACT_APP_WC_AUTH_USER / REACT_APP_WC_AUTH_PASS in .env.development.
// ─────────────────────────────────────────────────────────────────────────────
define( 'DTB_WC_AUTH_USER', 'wordpress-username' );
define( 'DTB_WC_AUTH_PASS', 'xxxx xxxx xxxx xxxx xxxx xxxx' );

// ── 9c. Webhook HMAC secret ───────────────────────────────────────────────────
//    Shared secret used by dtb-rest-api.php to validate the
//    X-WC-Webhook-Signature header on incoming webhook deliveries.
//    Must match the secret on every webhook in:
//    WP Admin → WooCommerce → Settings → Advanced → Webhooks.
//    Generate: openssl rand -hex 32
// ─────────────────────────────────────────────────────────────────────────────
define( 'WC_WEBHOOK_SECRET', 'change_me_to_a_long_random_webhook_secret' );

// ── 9d. Catalog import secret ─────────────────────────────────────────────────
//    Auth token for POST /wp-json/dtb/v1/import-catalog.
//    Set the same value in the CATALOG_IMPORT_SECRET GitHub Actions secret
//    so the deploy workflow can trigger a WC product re-import after uploading
//    a new CSV.
//    Generate: openssl rand -hex 32
// ─────────────────────────────────────────────────────────────────────────────
define( 'DTB_IMPORT_SECRET', 'change_me_to_a_secure_import_secret' );

// ── 9e. JWT signing secret ────────────────────────────────────────────────────
//    Must also be set in the Simple JWT Login plugin:
//    WP Admin → Simple JWT Login → General → Secret Key.
//    Minimum 32 characters; use a cryptographically random value.
//    Generate: openssl rand -hex 32
// ─────────────────────────────────────────────────────────────────────────────
define( 'DRYWALL_JWT_SECRET', 'change_me_to_a_long_random_string_min_32_chars' );

// ── 9f. Product catalog CSV + catalog platform rollout ───────────────────────
//    DTB_WC_CSV_FILENAME:
//      Explicitly pins the CSV basename in wp-content/uploads/wc-imports/.
//      Recommended for controlled production imports.
//
//    DTB_CATALOG_PLATFORM_ENABLED:
//      Runtime switch for the dtb-catalog-platform bootstrap.
//      Keep false during data migration/import validation; enable only after
//      catalog metadata and endpoint smoke checks pass.
//
//    AUTO-DISCOVERY (fallback when DTB_WC_CSV_FILENAME is omitted):
//      Scans wp-content/uploads/wc-imports/ for all product-wc-*.csv files
//      and selects the single most-recently modified one (Last Modified).
//
//    FALLBACK:
//      If no product-wc-*.csv file is found, dtb-utils.php falls back to
//      wp-content/uploads/wc-imports/wp-catalog.csv automatically.
// ─────────────────────────────────────────────────────────────────────────────
define( 'DTB_WC_CSV_FILENAME', 'woocommerce_catalog_production_remapped.csv' );
define( 'DTB_CATALOG_PLATFORM_ENABLED', false );

// ── 9g. Webhook delivery URL (optional override) ──────────────────────────────
//    Default hardcoded in dtb-utils.php:
//      https://drywalltoolbox.com/wp-json/drywall/v1/webhooks/products
//    Only define this constant to override (e.g. on a staging domain).
// ─────────────────────────────────────────────────────────────────────────────
// define( 'DTB_WEBHOOK_DELIVERY_URL', 'https://drywalltoolbox.com/wp-json/drywall/v1/webhooks/products' );

// ── 9h. Additional CORS origin (optional) ────────────────────────────────────
//    Hard-coded allowed origins are in 00-dtb-loader.php.
//    Use this constant to add one extra origin (e.g. a staging domain)
//    without modifying code.
// ─────────────────────────────────────────────────────────────────────────────
// define( 'DRYWALL_ALLOWED_ORIGIN', 'https://staging.yourdomain.com' );

// ── 9i. Veeqo integration ─────────────────────────────────────────────────────
//    Server-side credentials for dtb-veeqo.php.  Without these constants,
//    dtb_veeqo_enabled() returns false and the entire Veeqo integration
//    silently no-ops (no orders synced, no inventory checked, no shipping
//    rates returned).
//
//    DTB_VEEQO_API_KEY
//      Your Veeqo REST API key.
//      Veeqo → Settings → API Keys → "Add new API key".
//      Never share — full read/write access to your Veeqo account.
//
//    DTB_VEEQO_WEBHOOK_SECRET
//      HMAC-SHA256 secret Veeqo uses to sign webhook payloads.
//      Must exactly match the "HMAC Secret" you enter when creating the
//      webhook in Veeqo → Settings → Webhooks.
//      Veeqo sends the signature as a plain lowercase hex digest in the
//      X-Veeqo-Signature header — dtb-veeqo.php validates it accordingly.
//      Generate a strong value: openssl rand -hex 32
//
//    DTB_VEEQO_WAREHOUSE_ID
//      Integer ID of your fulfilment warehouse.
//      Veeqo → Warehouses → click your warehouse → note the ID in the URL
//      (e.g. https://app.veeqo.com/warehouses/12345/edit → 12345).
//
//    DTB_VEEQO_CHANNEL_ID
//      Integer ID of your WooCommerce sales channel in Veeqo.
//      Veeqo → Settings → Channels → click the WooCommerce channel → URL ID.
// ─────────────────────────────────────────────────────────────────────────────
define( 'DTB_VEEQO_API_KEY',        'Vqt/xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx'  );
define( 'DTB_VEEQO_WEBHOOK_SECRET', 'change_me_to_a_long_random_veeqo_webhook_secret' );
define( 'DTB_VEEQO_WAREHOUSE_ID',   0       ); // Veeqo → Warehouses → URL ID
define( 'DTB_VEEQO_CHANNEL_ID',     0       ); // Veeqo → Settings → Channels → URL ID

/* That's all, stop editing! Happy publishing. */

// ============================================================================
// 10. WORDPRESS BOOTSTRAP
// ============================================================================

if ( ! defined( 'ABSPATH' ) ) {
	define( 'ABSPATH', __DIR__ . '/' );
}

require_once ABSPATH . 'wp-settings.php';
