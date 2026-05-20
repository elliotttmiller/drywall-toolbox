<?php
/**
 * RuntimeConfig — DTB Platform
 *
 * Single runtime configuration lookup for all DTB wp-config.php constants.
 *
 * @package drywall-toolbox
 */

defined( 'ABSPATH' ) || exit;

/**
 * Return all DTB wp-config.php constants as a single associative array.
 *
 * Calling defined() once here (at first use) is cheaper than scattering
 * individual defined() checks throughout every route callback.  The result
 * is stored in $GLOBALS so the check runs at most once per request.
 *
 * Keys:
 *   wc_proxy_key      WC REST API consumer key  (WC_PROXY_CONSUMER_KEY)
 *   wc_proxy_secret   WC REST API consumer secret (WC_PROXY_CONSUMER_SECRET)
 *   wc_auth_user      App-password username for browser clients (DTB_WC_AUTH_USER)
 *   wc_auth_pass      App-password string for browser clients   (DTB_WC_AUTH_PASS)
 *   webhook_secret    HMAC secret for webhook validation        (WC_WEBHOOK_SECRET)
 *   import_secret     CI/CD catalog-import auth token          (DTB_IMPORT_SECRET)
 *   jwt_secret        JWT signing secret                        (DRYWALL_JWT_SECRET)
 *   csv_filename      Primary resolved catalog CSV filename
 *   csv_filenames     Resolved catalog CSV filename list
 *   csv_source        configured, auto, fallback, or missing
 *   csv_missing       Configured CSV filenames that were not readable
 *   webhook_delivery  Webhook delivery URL                      (DTB_WEBHOOK_DELIVERY_URL)
 *
 * @return array<string,mixed>
 */
function dtb_get_config(): array {
	if ( isset( $GLOBALS['_dtb_config_cache'] ) ) {
		return $GLOBALS['_dtb_config_cache'];
	}

	$csv_config = dtb_resolve_catalog_csv_config();

	$GLOBALS['_dtb_config_cache'] = [
		'wc_proxy_key'     => defined( 'WC_PROXY_CONSUMER_KEY' )    ? WC_PROXY_CONSUMER_KEY    : '',
		'wc_proxy_secret'  => defined( 'WC_PROXY_CONSUMER_SECRET' ) ? WC_PROXY_CONSUMER_SECRET : '',
		'wc_auth_user'     => defined( 'DTB_WC_AUTH_USER' )         ? DTB_WC_AUTH_USER         : '',
		'wc_auth_pass'     => defined( 'DTB_WC_AUTH_PASS' )         ? DTB_WC_AUTH_PASS         : '',
		'webhook_secret'   => defined( 'WC_WEBHOOK_SECRET' )        ? WC_WEBHOOK_SECRET        : '',
		'import_secret'    => defined( 'DTB_IMPORT_SECRET' )        ? DTB_IMPORT_SECRET        : '',
		'jwt_secret'       => defined( 'DRYWALL_JWT_SECRET' )       ? DRYWALL_JWT_SECRET       : '',
		'csv_filename'     => $csv_config['filename'],
		'csv_filenames'    => $csv_config['filenames'],
		'csv_source'       => $csv_config['source'],
		'csv_missing'      => $csv_config['missing'],
		'webhook_delivery' => defined( 'DTB_WEBHOOK_DELIVERY_URL' ) ? DTB_WEBHOOK_DELIVERY_URL : 'https://drywalltoolbox.com/wp-json/drywall/v1/webhooks/products',
	];

	return $GLOBALS['_dtb_config_cache'];
}
