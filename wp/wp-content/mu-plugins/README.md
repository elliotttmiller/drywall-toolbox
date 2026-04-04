# mu-plugins — Drywall Toolbox Must-Use Plugins

All files in this directory are loaded automatically by WordPress on every request,
without any activation step.  They are loaded in **alphabetical order**, so the
`00-dtb-loader.php` bootstrap always runs first and makes its helpers available to
the files that follow.

---

## File inventory

| File | Purpose |
|------|---------|
| `00-dtb-loader.php` | Shared bootstrap — defines `dtb_allowed_origins()` and `dtb_check_origin()` |
| `drywall-api-proxy.php` | Server-side proxy for WooCommerce REST API v3 (`drywall/v1` namespace) |
| `drywall-webhooks.php` | Auto-creates the four WC product-lifecycle webhooks |
| `dtb-app-passwords.php` | REST endpoint to create WP Application Passwords (`dtb/v1/create-app-password`) |
| `dtb-coming-soon.php` | Coming-soon e-mail subscriber handler and admin UI |
| `dtb-cors.php` | Global CORS handler for all REST API responses |
| `dtb-schematics-api.php` | Schematics media manifest endpoint (`dtb/v1/schematics/media`) |
| `dtb-woocommerce.php` | WooCommerce config, onboarding suppression, catalog import trigger |

---

## Required `wp-config.php` constants

Copy the block below into `wp-config.php` **above** the line that reads
`/* That's all, stop editing! Happy publishing. */`.

```php
// ── WooCommerce REST API credentials (server-side proxy) ─────────────────────
define( 'WC_PROXY_CONSUMER_KEY',    'ck_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx' );
// Obtain: WP Admin → WooCommerce → Settings → Advanced → REST API
// Add Key with Read/Write permissions → copy the Consumer Key.

define( 'WC_PROXY_CONSUMER_SECRET', 'cs_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx' );
// Same screen as above — copy the Consumer Secret.
// Treat this like a password: it grants full WooCommerce API access.

// ── WooCommerce Application Password (frontend direct-auth) ──────────────────
define( 'DTB_WC_AUTH_USER', 'your-wp-username' );
// The WordPress username whose Application Password the frontend will use.

define( 'DTB_WC_AUTH_PASS', 'xxxx xxxx xxxx xxxx xxxx xxxx' );
// Generate via: WP Admin → Users → (your user) → Application Passwords.
// This value is returned ONLY to browser requests from an allowed origin.

// ── Webhook HMAC secret ───────────────────────────────────────────────────────
define( 'WC_WEBHOOK_SECRET', 'your-random-high-entropy-string-here' );
// Generate: openssl rand -hex 32
// Must match the secret set on each WooCommerce webhook delivery endpoint.

// ── Catalog import secret ─────────────────────────────────────────────────────
define( 'DTB_IMPORT_SECRET', 'your-random-secret-here' );
// Authenticates POST /wp-json/dtb/v1/import-catalog requests from the CI/CD
// deploy workflow.  Generate: openssl rand -hex 32

// ── Optional overrides ────────────────────────────────────────────────────────

// Override the WooCommerce import CSV filename (default shown):
// define( 'DTB_WC_CSV_FILENAME', 'product-wp-catalog-c7p3my05pn.csv' );

// Override the webhook delivery URL (default shown; change for staging):
// define( 'DTB_WEBHOOK_DELIVERY_URL', 'https://drywalltoolbox.com/wp-json/drywall/v1/webhooks/products' );

// Add a secondary allowed CORS origin (e.g. staging domain):
// define( 'DRYWALL_ALLOWED_ORIGIN', 'https://staging.drywalltoolbox.com' );

// JWT signing secret (must also be set in the JWT plugin settings):
define( 'DRYWALL_JWT_SECRET', 'your-jwt-signing-secret-here' );
// Generate: openssl rand -hex 32
// Must be at least 32 characters; use a cryptographically random string.

// Disable the Theme/Plugin file editor in WP Admin (strongly recommended):
define( 'DISALLOW_FILE_EDIT', true );
```

---

## CORS allowed origins

The following origins are always allowed (hard-coded in `00-dtb-loader.php`):

- `https://drywalltoolbox.com`
- `https://www.drywalltoolbox.com`
- `http://localhost:5173`
- `http://127.0.0.1:5173`

To add a staging or preview domain without modifying code:

```php
define( 'DRYWALL_ALLOWED_ORIGIN', 'https://staging.drywalltoolbox.com' );
```

For programmatic extension (e.g., from another mu-plugin):

```php
add_filter( 'dtb_allowed_origins', function( $origins ) {
    $origins[] = 'https://preview.drywalltoolbox.com';
    return $origins;
} );
```
