<?php
/**
 * WordPress Configuration Sample — Drywall Toolbox
 *
 * Copy this file to wp-config.php and fill in the values below.
 * NEVER commit wp-config.php to the repository (it is gitignored).
 *
 * WordPress is installed in the /wp/ subdirectory while the public site URL
 * is the domain root.  The two constants below are the critical difference
 * from a standard WordPress installation:
 *
 *   WP_HOME    — the public-facing URL visitors use (domain root)
 *   WP_SITEURL — the URL where WordPress core files live (/wp/ subdirectory)
 *
 * This separation lets React own the domain root while WordPress acts as a
 * headless REST API backend accessible at /wp/wp-json/.
 */

// ─── Site URLs ────────────────────────────────────────────────────────────────

/** The public-facing site URL — domain root (NOT the /wp/ subdirectory). */
define( 'WP_HOME', 'https://drywalltoolbox.com' );

/** The URL where WordPress is installed. */
define( 'WP_SITEURL', 'https://drywalltoolbox.com/wp' );

// ─── Database ─────────────────────────────────────────────────────────────────

/** Database name — set in cPanel → MySQL Databases. */
define( 'DB_NAME', 'your_database_name' );

/** Database username. */
define( 'DB_USER', 'your_database_user' );

/** Database password. */
define( 'DB_PASSWORD', 'your_database_password' );

/** Database hostname. */
define( 'DB_HOST', 'localhost' );

/** Database charset. */
define( 'DB_CHARSET', 'utf8mb4' );

/** Database table collation. */
define( 'DB_COLLATE', '' );

// ─── Security Keys & Salts ───────────────────────────────────────────────────
// Generate fresh keys at: https://api.wordpress.org/secret-key/1.1/salt/

define( 'AUTH_KEY',         'put your unique phrase here' );
define( 'SECURE_AUTH_KEY',  'put your unique phrase here' );
define( 'LOGGED_IN_KEY',    'put your unique phrase here' );
define( 'NONCE_KEY',        'put your unique phrase here' );
define( 'AUTH_SALT',        'put your unique phrase here' );
define( 'SECURE_AUTH_SALT', 'put your unique phrase here' );
define( 'LOGGED_IN_SALT',   'put your unique phrase here' );
define( 'NONCE_SALT',       'put your unique phrase here' );

// ─── JWT Authentication ───────────────────────────────────────────────────────
// Required for the jwt-authentication-for-wp-rest-api plugin.
// Generate a strong random string (e.g. openssl rand -base64 64).

define( 'JWT_AUTH_SECRET_KEY', 'your-jwt-secret-key-here' );
define( 'JWT_AUTH_CORS_ENABLE', true );

// ─── Table Prefix ─────────────────────────────────────────────────────────────

$table_prefix = 'wp_';

// ─── Environment ──────────────────────────────────────────────────────────────

/** Enable WP_DEBUG only in local development — never on production. */
define( 'WP_DEBUG', false );
define( 'WP_DEBUG_LOG', false );
define( 'WP_DEBUG_DISPLAY', false );

/** Disable the file editor in wp-admin for security. */
define( 'DISALLOW_FILE_EDIT', true );

/** Limit post revisions to save database space. */
define( 'WP_POST_REVISIONS', 5 );

/** Move wp-content to the standard wp/wp-content/ location in this repo. */
define( 'WP_CONTENT_DIR', dirname( __FILE__ ) . '/wp-content' );
define( 'WP_CONTENT_URL', 'https://drywalltoolbox.com/wp/wp-content' );

// ─── Bootstrap ────────────────────────────────────────────────────────────────

/** Absolute path to the WordPress directory. */
if ( ! defined( 'ABSPATH' ) ) {
	define( 'ABSPATH', __DIR__ . '/' );
}

/** Sets up WordPress vars and included files. */
require_once ABSPATH . 'wp-settings.php';
