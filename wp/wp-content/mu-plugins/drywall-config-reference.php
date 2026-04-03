<?php
/**
 * Drywall Config Reference — Must-Use Plugin
 *
 * This file contains NO executable code.
 * It exists solely as a ready-to-copy reference for the constants that must
 * be defined in wp-config.php on the production server.
 *
 * Copy the block below into wp-config.php ABOVE the line that reads:
 *   "That's all, stop editing! Happy publishing."
 *
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * define( 'WC_PROXY_CONSUMER_KEY', 'ck_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx' );
 * // How to obtain: WP Admin → WooCommerce → Settings → Advanced → REST API
 * // Click "Add Key", set Permissions to "Read/Write", copy the Consumer Key.
 *
 * define( 'WC_PROXY_CONSUMER_SECRET', 'cs_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx' );
 * // How to obtain: same screen as WC_PROXY_CONSUMER_KEY — copy the Consumer Secret.
 * // Keep this confidential; it grants full WooCommerce API access.
 *
 * define( 'WC_WEBHOOK_SECRET', 'your-random-high-entropy-string-here' );
 * // How to obtain: generate with `openssl rand -hex 32` or a password manager.
 * // This value is used to sign and verify incoming WooCommerce webhook payloads.
 * // It must match the secret configured on each WC webhook delivery endpoint.
 *
 * define( 'DISALLOW_FILE_EDIT', true );
 * // Disables the Theme/Plugin file editor in WP Admin.
 * // Strongly recommended on production; prevents code injection via the dashboard.
 *
 * define( 'DRYWALL_JWT_SECRET', 'your-jwt-signing-secret-here' );
 * // How to obtain: generate with `openssl rand -hex 32` or a password manager.
 * // This value is used by the active JWT plugin (e.g. simple-jwt-login) to sign
 * // and verify authentication tokens. Set it in the plugin's settings AND here.
 * // Must be at least 32 characters; use a cryptographically random string.
 *
 * define( 'DRYWALL_ALLOWED_ORIGIN', 'https://drywalltoolbox.com' );
 * // The primary allowed CORS origin for the React SPA.
 * // Must match the domain where the compiled React app is served.
 * // For local development, add 'http://localhost:3000' to the allowlist
 * // in drywall-api-proxy.php (hardcoded, not this constant).
 *
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * @package drywall-toolbox
 */

defined( 'ABSPATH' ) || exit;
