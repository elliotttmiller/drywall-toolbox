<?php
/**
 * The base configuration for WordPress
 *
 * The wp-config.php creation script uses this file during the installation.
 * You don't have to use the website, you can copy this file to "wp-config.php"
 * and fill in the values.
 *
 * This file contains the following configurations:
 *
 * * Database settings
 * * Secret keys
 * * Database table prefix
 * * ABSPATH
 *
 * @link https://developer.wordpress.org/advanced-administration/wordpress/wp-config/
 *
 * @package WordPress
 */

// ** Database settings - You can get this info from your web host ** //
/** The name of the database for WordPress */
define( 'DB_NAME', 'database_name_here' );

/** Database username */
define( 'DB_USER', 'username_here' );

/** Database password */
define( 'DB_PASSWORD', 'password_here' );

/** Database hostname */
define( 'DB_HOST', 'localhost' );

/** Database charset to use in creating database tables. */
define( 'DB_CHARSET', 'utf8mb4' );

/** The database collate type. Don't change this if in doubt. */
define( 'DB_COLLATE', '' );

/**#@+
 * Authentication unique keys and salts.
 *
 * Change these to different unique phrases! You can generate these using
 * the {@link https://api.wordpress.org/secret-key/1.1/salt/ WordPress.org secret-key service}.
 *
 * You can change these at any point in time to invalidate all existing cookies.
 * This will force all users to have to log in again.
 *
 * @since 2.6.0
 */
define( 'AUTH_KEY',         'put your unique phrase here' );
define( 'SECURE_AUTH_KEY',  'put your unique phrase here' );
define( 'LOGGED_IN_KEY',    'put your unique phrase here' );
define( 'NONCE_KEY',        'put your unique phrase here' );
define( 'AUTH_SALT',        'put your unique phrase here' );
define( 'SECURE_AUTH_SALT', 'put your unique phrase here' );
define( 'LOGGED_IN_SALT',   'put your unique phrase here' );
define( 'NONCE_SALT',       'put your unique phrase here' );

/**#@-*/

/**
 * WordPress database table prefix.
 *
 * You can have multiple installations in one database if you give each
 * a unique prefix. Only numbers, letters, and underscores please!
 *
 * At the installation time, database tables are created with the specified prefix.
 * Changing this value after WordPress is installed will make your site think
 * it has not been installed.
 *
 * @link https://developer.wordpress.org/advanced-administration/wordpress/wp-config/#table-prefix
 */
$table_prefix = 'wp_';

/**
 * For developers: WordPress debugging mode.
 *
 * Change this to true to enable the display of notices during development.
 * It is strongly recommended that plugin and theme developers use WP_DEBUG
 * in their development environments.
 *
 * For information on other constants that can be used for debugging,
 * visit the documentation.
 *
 * @link https://developer.wordpress.org/advanced-administration/debug/debug-wordpress/
 */
define( 'WP_DEBUG', false );

/* Add any custom values between this line and the "stop editing" line. */

// =============================================================================
// DTB — Drywall Toolbox custom constants
// =============================================================================
// All secrets below must be set before the site will function correctly.
// Generate secure random values with: openssl rand -hex 32

// ── WooCommerce REST API v3 (server-side proxy only — never exposed to client)
// Generate in WP Admin: WooCommerce → Settings → Advanced → REST API
define( 'WC_PROXY_CONSUMER_KEY',    'ck_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx' );
define( 'WC_PROXY_CONSUMER_SECRET', 'cs_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx' );

// ── WooCommerce Application Password (for browser-client credential endpoint)
// Generate in WP Admin: Users → Your Profile → Application Passwords
define( 'DTB_WC_AUTH_USER', 'wordpress-username' );
define( 'DTB_WC_AUTH_PASS', 'xxxx xxxx xxxx xxxx xxxx xxxx' );

// ── JWT signing secret (used by simple-jwt-login plugin)
// Must match the "JWT Decryption Key" in the plugin's settings page.
define( 'DRYWALL_JWT_SECRET', 'change_me_to_a_long_random_string_min_32_chars' );

// ── WooCommerce webhook HMAC secret (validates incoming product webhooks)
// Must match the "Secret" field set when webhooks are auto-created in WC Admin.
define( 'WC_WEBHOOK_SECRET', 'change_me_to_a_long_random_webhook_secret' );

// ── Catalog import secret (authenticates the CI/CD /dtb/v1/import-catalog endpoint)
define( 'DTB_IMPORT_SECRET', 'change_me_to_a_secure_import_secret' );

// ── Optional overrides (uncomment to activate)
// Additional allowed CORS origin (e.g. staging domain):
// define( 'DRYWALL_ALLOWED_ORIGIN', 'https://staging.drywalltoolbox.com' );
// Custom webhook delivery URL (default: https://drywalltoolbox.com/wp-json/drywall/v1/webhooks/products):
// define( 'DTB_WEBHOOK_DELIVERY_URL', 'https://drywalltoolbox.com/wp-json/drywall/v1/webhooks/products' );
// Optional: override the catalog CSV filename used by /dtb/v1/products-csv and /dtb/v1/import-catalog.
// When omitted, dtb-utils.php auto-discovers the newest product-wc-*.csv file in wc-imports/ via glob.
// Manage catalog CSV files via WooCommerce → Products → Import in WP Admin.
// define( 'DTB_WC_CSV_FILENAME', 'product-wc-catalog-abc123.csv' );

// ── Security hardening
define( 'DISALLOW_FILE_EDIT', true );   // disable theme/plugin editor in WP Admin
define( 'DISALLOW_FILE_MODS', false );  // set true to block plugin/theme installs too



/* That's all, stop editing! Happy publishing. */

/** Absolute path to the WordPress directory. */
if ( ! defined( 'ABSPATH' ) ) {
	define( 'ABSPATH', __DIR__ . '/' );
}

/** Sets up WordPress vars and included files. */
require_once ABSPATH . 'wp-settings.php';
