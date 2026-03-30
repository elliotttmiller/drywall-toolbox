<?php
/**
 * WordPress — /wp/ subdirectory entry point.
 *
 * WordPress is installed here (/wp/) while the site URL is the domain root
 * (https://drywalltoolbox.com).  This file bootstraps the WordPress application.
 *
 * WordPress core files (wp-includes/, wp-admin/, etc.) are NOT tracked in this
 * repository — they are installed on the server via cPanel / WP-CLI / FTP.
 * Only the wp-content/ directory (custom themes and must-use plugins) is tracked.
 *
 * Server-side setup:
 *   WP_HOME    = https://drywalltoolbox.com        (site public URL — domain root)
 *   WP_SITEURL = https://drywalltoolbox.com/wp     (where WP is installed)
 *
 * @see wp-config-sample.php for the full configuration template.
 */

/** Loads the WordPress environment and template. */
require __DIR__ . '/wp-blog-header.php';
