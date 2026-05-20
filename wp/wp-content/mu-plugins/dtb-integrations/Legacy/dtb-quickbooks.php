<?php
/**
 * DTB QuickBooks Online Integration — Must-Use Plugin
 *
 * OAuth2 token management, API request helper, sync functions, REST routes,
 * AJAX handlers, and scheduled cron for QuickBooks Online accounting sync.
 *
 * Sections:
 *   1.  Constants & configuration
 *   2.  Token storage (encrypted in wp_options)
 *   3.  OAuth2 flow: authorization URL + callback
 *   4.  Token refresh
 *   5.  API request helper
 *   6.  REST routes (dtb/v1/qbo/*)
 *   7.  Sync functions (invoices, customers, payments)
 *   8.  Cron: daily sync
 *
 * Token storage uses openssl_encrypt with WP_AUTH_KEY as the encryption key.
 * All sensitive operations are guarded by manage_options capability.
 *
 * @package drywall-toolbox
 */

defined( 'ABSPATH' ) || exit;

// =============================================================================
// SECTION 1 — CONSTANTS & CONFIGURATION
// =============================================================================

if ( ! defined( 'DTB_QBO_API_BASE' ) )    define( 'DTB_QBO_API_BASE',    'https://quickbooks.api.intuit.com/v3/company' );
if ( ! defined( 'DTB_QBO_SANDBOX_BASE' ) ) define( 'DTB_QBO_SANDBOX_BASE', 'https://sandbox-quickbooks.api.intuit.com/v3/company' );
if ( ! defined( 'DTB_QBO_AUTH_URL' ) )    define( 'DTB_QBO_AUTH_URL',    'https://appcenter.intuit.com/connect/oauth2' );
if ( ! defined( 'DTB_QBO_TOKEN_URL' ) )   define( 'DTB_QBO_TOKEN_URL',   'https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer' );
if ( ! defined( 'DTB_QBO_SCOPE' ) )       define( 'DTB_QBO_SCOPE',       'com.intuit.quickbooks.accounting' );

/**
 * Return the QuickBooks integration configuration.
 *
 * @return array {
 *   client_id:     string,
 *   client_secret: string,
 *   realm_id:      string,
 *   sandbox:       bool
 * }
 */
function dtb_qbo_config(): array {
	static $cfg = null;
	if ( null !== $cfg ) {
		return $cfg;
	}

	$cfg = [
		'client_id'     => defined( 'DTB_QBO_CLIENT_ID' )     ? DTB_QBO_CLIENT_ID     : '',
		'client_secret' => defined( 'DTB_QBO_CLIENT_SECRET' )  ? DTB_QBO_CLIENT_SECRET : '',
		'realm_id'      => defined( 'DTB_QBO_REALM_ID' )       ? DTB_QBO_REALM_ID      : (string) get_option( 'dtb_qbo_realm_id', '' ),
		'sandbox'       => dtb_feature_enabled( 'DTB_QBO_SANDBOX', false ),
	];

	return $cfg;
}

/**
 * Return true when QuickBooks integration is fully configured.
 *
 * @return bool
 */
function dtb_qbo_enabled(): bool {
	$cfg = dtb_qbo_config();
	return '' !== $cfg['client_id']
		&& '' !== $cfg['client_secret']
		&& '' !== $cfg['realm_id'];
}

/**
 * Return the QBO API base URL (production or sandbox).
 *
 * @return string
 */
function dtb_qbo_api_base(): string {
	$cfg = dtb_qbo_config();
	return $cfg['sandbox'] ? DTB_QBO_SANDBOX_BASE : DTB_QBO_API_BASE;
}

// =============================================================================
// SECTION 2 — TOKEN STORAGE
// =============================================================================

/**
 * Encryption cipher for stored QBO tokens.
 */
define( 'DTB_QBO_CIPHER', 'aes-256-cbc' );

/**
 * Derive the encryption key from WP_AUTH_KEY (32-byte SHA-256 hash).
 *
 * @return string 32-byte binary key.
 */
function dtb_qbo_encryption_key(): string {
	$key = defined( 'WP_AUTH_KEY' ) ? WP_AUTH_KEY : wp_salt( 'auth' );
	return hash( 'sha256', $key, true );
}

/**
 * Encrypt a string using AES-256-CBC.
 *
 * @param string $plaintext Data to encrypt.
 * @return string Base64-encoded "iv:ciphertext" string, or empty on failure.
 */
function dtb_qbo_encrypt( string $plaintext ): string {
	if ( ! function_exists( 'openssl_encrypt' ) ) {
		return '';
	}

	$iv_len = openssl_cipher_iv_length( DTB_QBO_CIPHER );
	$iv     = openssl_random_pseudo_bytes( $iv_len );

	$ciphertext = openssl_encrypt( $plaintext, DTB_QBO_CIPHER, dtb_qbo_encryption_key(), OPENSSL_RAW_DATA, $iv );

	if ( false === $ciphertext ) {
		return '';
	}

	return base64_encode( $iv . $ciphertext ); // phpcs:ignore WordPress.PHP.DiscouragedPHPFunctions.obfuscation_base64_encode
}

/**
 * Decrypt a string previously encrypted with dtb_qbo_encrypt().
 *
 * @param string $encrypted Base64-encoded "iv:ciphertext" string.
 * @return string Decrypted plaintext, or empty string on failure.
 */
function dtb_qbo_decrypt( string $encrypted ): string {
	if ( ! function_exists( 'openssl_decrypt' ) || '' === $encrypted ) {
		return '';
	}

	$raw    = base64_decode( $encrypted, true ); // phpcs:ignore WordPress.PHP.DiscouragedPHPFunctions.obfuscation_base64_decode
	if ( false === $raw ) {
		return '';
	}

	$iv_len     = openssl_cipher_iv_length( DTB_QBO_CIPHER );
	$iv         = substr( $raw, 0, $iv_len );
	$ciphertext = substr( $raw, $iv_len );

	$plaintext = openssl_decrypt( $ciphertext, DTB_QBO_CIPHER, dtb_qbo_encryption_key(), OPENSSL_RAW_DATA, $iv );

	return ( false === $plaintext ) ? '' : $plaintext;
}

/**
 * Persist QBO OAuth2 tokens to wp_options (encrypted).
 *
 * @param array $tokens { access_token, refresh_token, expires_in, realm_id, obtained_at? }
 */
function dtb_qbo_save_tokens( array $tokens ): void {
	$tokens['obtained_at'] = $tokens['obtained_at'] ?? time();
	$json                  = (string) wp_json_encode( $tokens );
	$encrypted             = dtb_qbo_encrypt( $json );

	update_option( 'dtb_qbo_tokens', $encrypted, false );

	// Persist realm_id separately so dtb_qbo_config() can read it without decryption.
	if ( ! empty( $tokens['realm_id'] ) ) {
		update_option( 'dtb_qbo_realm_id', sanitize_text_field( $tokens['realm_id'] ), false );
	}
}

/**
 * Load and decrypt stored QBO tokens.
 *
 * @return array|null Decoded token array, or null if not stored / decryption fails.
 */
function dtb_qbo_load_tokens(): ?array {
	$encrypted = (string) get_option( 'dtb_qbo_tokens', '' );
	if ( '' === $encrypted ) {
		return null;
	}

	$json   = dtb_qbo_decrypt( $encrypted );
	$tokens = json_decode( $json, true );

	return is_array( $tokens ) ? $tokens : null;
}

/**
 * Clear all stored QBO tokens (called on disconnect / de-auth).
 */
function dtb_qbo_clear_tokens(): void {
	delete_option( 'dtb_qbo_tokens' );
}

// =============================================================================
// SECTION 3 — OAUTH2 FLOW: AUTHORIZATION URL + CALLBACK
// =============================================================================

add_action( 'admin_menu', 'dtb_qbo_register_settings_page', 20 );

/**
 * Register the QuickBooks settings submenu under DTB Ops.
 */
function dtb_qbo_register_settings_page(): void {
	if ( ! function_exists( 'add_submenu_page' ) ) {
		return;
	}

	add_submenu_page(
		'dtb-ops',
		__( 'QuickBooks', 'dtb' ),
		__( 'QuickBooks', 'dtb' ),
		'manage_options',
		'dtb-ops-quickbooks',
		'dtb_qbo_render_settings_page'
	);
}

/**
 * Build the OAuth2 authorization URL.
 *
 * @return string Full authorization URL with query parameters, or empty on misconfiguration.
 */
function dtb_qbo_get_auth_url(): string {
	$cfg = dtb_qbo_config();
	if ( '' === $cfg['client_id'] ) {
		return '';
	}

	$state    = wp_create_nonce( 'dtb_qbo_oauth_state' );
	$redirect = admin_url( 'admin-ajax.php?action=dtb_qbo_oauth_callback' );

	return DTB_QBO_AUTH_URL . '?' . http_build_query( [
		'client_id'     => $cfg['client_id'],
		'response_type' => 'code',
		'scope'         => DTB_QBO_SCOPE,
		'redirect_uri'  => $redirect,
		'state'         => $state,
	] );
}

add_action( 'wp_ajax_dtb_qbo_oauth_callback', 'dtb_qbo_handle_oauth_callback' );

/**
 * AJAX callback: exchange the authorization code for tokens.
 */
function dtb_qbo_handle_oauth_callback(): void {
	if ( ! current_user_can( 'manage_options' ) ) {
		wp_die( esc_html__( 'Insufficient permissions.', 'dtb' ), 403 );
	}

	$state = sanitize_text_field( wp_unslash( $_GET['state'] ?? '' ) );
	if ( ! wp_verify_nonce( $state, 'dtb_qbo_oauth_state' ) ) {
		wp_die( esc_html__( 'Invalid OAuth state.', 'dtb' ), 400 );
	}

	$code     = sanitize_text_field( wp_unslash( $_GET['code'] ?? '' ) );
	$realm_id = sanitize_text_field( wp_unslash( $_GET['realmId'] ?? '' ) );

	if ( '' === $code ) {
		wp_die( esc_html__( 'Missing authorization code.', 'dtb' ), 400 );
	}

	$cfg      = dtb_qbo_config();
	$redirect = admin_url( 'admin-ajax.php?action=dtb_qbo_oauth_callback' );

	$response = wp_remote_post( DTB_QBO_TOKEN_URL, [
		'timeout' => 20,
		'headers' => [
			'Authorization' => 'Basic ' . base64_encode( $cfg['client_id'] . ':' . $cfg['client_secret'] ), // phpcs:ignore WordPress.PHP.DiscouragedPHPFunctions.obfuscation_base64_encode
			'Content-Type'  => 'application/x-www-form-urlencoded',
			'Accept'        => 'application/json',
		],
		'body' => [
			'grant_type'   => 'authorization_code',
			'code'         => $code,
			'redirect_uri' => $redirect,
		],
	] );

	if ( is_wp_error( $response ) ) {
		wp_die( esc_html( 'Token exchange failed: ' . $response->get_error_message() ), 500 );
	}

	$body   = json_decode( wp_remote_retrieve_body( $response ), true );
	$status = (int) wp_remote_retrieve_response_code( $response );

	if ( 200 !== $status || empty( $body['access_token'] ) ) {
		wp_die( esc_html( 'Token exchange error: ' . wp_json_encode( $body ) ), 500 );
	}

	$body['realm_id'] = $realm_id;
	dtb_qbo_save_tokens( $body );

	if ( function_exists( 'dtb_ops_audit_log' ) ) {
		dtb_ops_audit_log( 'qbo_oauth_connected', [ 'realm_id' => $realm_id ] );
	}

	wp_safe_redirect( admin_url( 'admin.php?page=dtb-ops-quickbooks&qbo_connected=1' ) );
	exit;
}

/**
 * Render the QuickBooks settings page.
 */
function dtb_qbo_render_settings_page(): void {
	if ( ! current_user_can( 'manage_options' ) ) {
		wp_die( esc_html__( 'Insufficient permissions.', 'dtb' ) );
	}

	$tokens    = dtb_qbo_load_tokens();
	$connected = ( null !== $tokens && ! empty( $tokens['access_token'] ) );
	$auth_url  = dtb_qbo_get_auth_url();

	if ( isset( $_GET['qbo_disconnect'] ) && wp_verify_nonce( sanitize_key( $_GET['_wpnonce'] ?? '' ), 'dtb_qbo_disconnect' ) ) {
		dtb_qbo_clear_tokens();
		if ( function_exists( 'dtb_ops_audit_log' ) ) {
			dtb_ops_audit_log( 'qbo_disconnected', [] );
		}
		$connected = false;
		$tokens    = null;
		echo '<div class="notice notice-success"><p>' . esc_html__( 'QuickBooks disconnected.', 'dtb' ) . '</p></div>';
	}

	if ( isset( $_GET['qbo_connected'] ) ) {
		echo '<div class="notice notice-success"><p>' . esc_html__( 'QuickBooks connected successfully!', 'dtb' ) . '</p></div>';
	}
	?>
	<div class="wrap">
		<h1><?php esc_html_e( 'DTB Ops — QuickBooks Online', 'dtb' ); ?></h1>

		<?php if ( $connected ) : ?>
		<p><?php esc_html_e( '✅ Connected to QuickBooks Online.', 'dtb' ); ?></p>
		<p>
			<strong><?php esc_html_e( 'Realm ID:', 'dtb' ); ?></strong>
			<?php echo esc_html( get_option( 'dtb_qbo_realm_id', '—' ) ); ?>
		</p>
		<?php if ( ! empty( $tokens['obtained_at'] ) ) : ?>
		<p>
			<strong><?php esc_html_e( 'Token obtained:', 'dtb' ); ?></strong>
			<?php echo esc_html( gmdate( 'Y-m-d H:i:s', (int) $tokens['obtained_at'] ) ); ?> UTC
		</p>
		<?php endif; ?>
		<a href="<?php echo esc_url( wp_nonce_url( admin_url( 'admin.php?page=dtb-ops-quickbooks&qbo_disconnect=1' ), 'dtb_qbo_disconnect' ) ); ?>"
		   class="button button-secondary"
		   onclick="return confirm('<?php esc_attr_e( 'Disconnect from QuickBooks Online?', 'dtb' ); ?>');">
			<?php esc_html_e( 'Disconnect', 'dtb' ); ?>
		</a>
		<?php else : ?>
		<?php if ( '' === dtb_qbo_config()['client_id'] ) : ?>
		<div class="notice notice-warning"><p>
			<?php esc_html_e( 'DTB_QBO_CLIENT_ID and DTB_QBO_CLIENT_SECRET are not defined. Add them to wp-config.php to enable the QuickBooks integration.', 'dtb' ); ?>
		</p></div>
		<?php elseif ( $auth_url ) : ?>
		<p><?php esc_html_e( 'Connect your QuickBooks Online account to enable accounting sync.', 'dtb' ); ?></p>
		<a href="<?php echo esc_url( $auth_url ); ?>" class="button button-primary">
			<?php esc_html_e( 'Connect to QuickBooks Online', 'dtb' ); ?>
		</a>
		<?php endif; ?>
		<?php endif; ?>
	</div>
	<?php
}

// =============================================================================
// SECTION 4 — TOKEN REFRESH
// =============================================================================

/**
 * Refresh the QBO access token using the stored refresh token.
 *
 * @return array|WP_Error Updated token array on success; WP_Error on failure.
 */
function dtb_qbo_refresh_token(): array|WP_Error {
	$tokens = dtb_qbo_load_tokens();

	if ( null === $tokens || empty( $tokens['refresh_token'] ) ) {
		return new WP_Error( 'no_refresh_token', 'No QBO refresh token stored. Re-connect QuickBooks.' );
	}

	$cfg = dtb_qbo_config();

	$response = wp_remote_post( DTB_QBO_TOKEN_URL, [
		'timeout' => 20,
		'headers' => [
			'Authorization' => 'Basic ' . base64_encode( $cfg['client_id'] . ':' . $cfg['client_secret'] ), // phpcs:ignore WordPress.PHP.DiscouragedPHPFunctions.obfuscation_base64_encode
			'Content-Type'  => 'application/x-www-form-urlencoded',
			'Accept'        => 'application/json',
		],
		'body' => [
			'grant_type'    => 'refresh_token',
			'refresh_token' => $tokens['refresh_token'],
		],
	] );

	if ( is_wp_error( $response ) ) {
		return $response;
	}

	$body   = json_decode( wp_remote_retrieve_body( $response ), true );
	$status = (int) wp_remote_retrieve_response_code( $response );

	if ( 200 !== $status || empty( $body['access_token'] ) ) {
		return new WP_Error(
			'qbo_refresh_failed',
			sprintf( 'QBO token refresh failed (HTTP %d): %s', $status, wp_json_encode( $body ) )
		);
	}

	// Preserve realm_id from existing tokens if not returned in refresh response.
	if ( empty( $body['realm_id'] ) && ! empty( $tokens['realm_id'] ) ) {
		$body['realm_id'] = $tokens['realm_id'];
	}

	dtb_qbo_save_tokens( $body );

	if ( function_exists( 'dtb_ops_audit_log' ) ) {
		dtb_ops_audit_log( 'qbo_token_refreshed', [ 'expires_in' => $body['expires_in'] ?? 0 ] );
	}

	return $body;
}

/**
 * Return a valid access token, auto-refreshing if it has expired.
 *
 * Access tokens expire in 3600 seconds; refresh 60 seconds early.
 *
 * @return string Access token, or empty string if unavailable.
 */
function dtb_qbo_get_access_token(): string {
	$tokens = dtb_qbo_load_tokens();
	if ( null === $tokens || empty( $tokens['access_token'] ) ) {
		return '';
	}

	$obtained_at = (int) ( $tokens['obtained_at'] ?? 0 );
	$expires_in  = (int) ( $tokens['expires_in']  ?? 3600 );
	$expires_at  = $obtained_at + $expires_in - 60; // 60s early refresh buffer.

	if ( time() >= $expires_at ) {
		$refreshed = dtb_qbo_refresh_token();
		if ( is_wp_error( $refreshed ) ) {
			error_log( '[DTB QBO] Token refresh failed: ' . $refreshed->get_error_message() ); // phpcs:ignore WordPress.PHP.DevelopmentFunctions.error_log_error_log
			return '';
		}
		return $refreshed['access_token'] ?? '';
	}

	return $tokens['access_token'];
}

// =============================================================================
// SECTION 5 — API REQUEST HELPER
// =============================================================================

/**
 * Make an authenticated request to the QuickBooks Online API.
 *
 * @param string $method    HTTP method: GET|POST|PUT|DELETE.
 * @param string $path      API path (e.g. '/query?query=SELECT ...').
 * @param array  $params    Query parameters appended to the URL.
 * @param array  $body      Request body (JSON-encoded when present).
 * @return array {
 *   ok:     bool,
 *   status: int,
 *   data:   mixed,
 *   error:  string|null
 * }
 */
function dtb_qbo_request( string $method, string $path, array $params = [], array $body = [] ): array {
	if ( ! dtb_qbo_enabled() ) {
		return [ 'ok' => false, 'status' => 0, 'data' => null, 'error' => 'QuickBooks integration not configured.' ];
	}

	$token = dtb_qbo_get_access_token();
	if ( '' === $token ) {
		return [ 'ok' => false, 'status' => 401, 'data' => null, 'error' => 'No valid QBO access token.' ];
	}

	$cfg      = dtb_qbo_config();
	$base_url = dtb_qbo_api_base() . '/' . ltrim( $cfg['realm_id'], '/' );
	$url      = $base_url . '/' . ltrim( $path, '/' );

	if ( ! empty( $params ) ) {
		$url .= '?' . http_build_query( $params );
	}

	$args = [
		'method'  => strtoupper( $method ),
		'timeout' => 20,
		'headers' => [
			'Authorization' => 'Bearer ' . $token,
			'Accept'        => 'application/json',
			'Content-Type'  => 'application/json',
		],
	];

	if ( ! empty( $body ) ) {
		$args['body'] = wp_json_encode( $body );
	}

	$response = wp_remote_request( $url, $args );

	if ( is_wp_error( $response ) ) {
		return [
			'ok'     => false,
			'status' => 0,
			'data'   => null,
			'error'  => $response->get_error_message(),
		];
	}

	$status = (int) wp_remote_retrieve_response_code( $response );
	$data   = json_decode( wp_remote_retrieve_body( $response ), true );
	$ok     = ( $status >= 200 && $status < 300 );

	return [
		'ok'     => $ok,
		'status' => $status,
		'data'   => $data,
		'error'  => $ok ? null : ( wp_remote_retrieve_body( $response ) ?: 'Unknown QBO API error.' ),
	];
}

// =============================================================================
// SECTION 6 — REST ROUTES
// =============================================================================

if ( dtb_is_rest_api_request() ) {
	add_action( 'rest_api_init', 'dtb_qbo_register_rest_routes' );
}

/**
 * Register QBO REST routes.
 */
function dtb_qbo_register_rest_routes(): void {
	$ns = 'dtb/v1';

	// Status: is QBO connected?
	register_rest_route(
		$ns,
		'/qbo/status',
		[
			'methods'             => WP_REST_Server::READABLE,
			'callback'            => 'dtb_qbo_rest_status',
			'permission_callback' => static function () {
				return current_user_can( 'manage_options' );
			},
		]
	);

	// Trigger a manual sync.
	register_rest_route(
		$ns,
		'/qbo/sync',
		[
			'methods'             => WP_REST_Server::CREATABLE,
			'callback'            => 'dtb_qbo_rest_trigger_sync',
			'permission_callback' => static function () {
				return current_user_can( 'manage_options' );
			},
		]
	);
}

/**
 * REST callback: return QBO connection status.
 *
 * @return WP_REST_Response
 */
function dtb_qbo_rest_status(): WP_REST_Response {
	$tokens    = dtb_qbo_load_tokens();
	$connected = ( null !== $tokens && ! empty( $tokens['access_token'] ) );

	return new WP_REST_Response( [
		'connected'    => $connected,
		'realm_id'     => get_option( 'dtb_qbo_realm_id', null ),
		'last_sync_at' => get_option( 'dtb_qbo_last_sync_at', null ),
	], 200 );
}

/**
 * REST callback: trigger an immediate QBO sync.
 *
 * @return WP_REST_Response|WP_Error
 */
function dtb_qbo_rest_trigger_sync(): WP_REST_Response|WP_Error {
	if ( ! dtb_qbo_enabled() ) {
		return new WP_Error( 'qbo_not_configured', 'QuickBooks integration is not configured.', [ 'status' => 503 ] );
	}

	$result = dtb_qbo_run_sync();

	if ( is_wp_error( $result ) ) {
		return $result;
	}

	return new WP_REST_Response( $result, 200 );
}

// =============================================================================
// SECTION 7 — SYNC FUNCTIONS
// =============================================================================

/**
 * Run the QuickBooks sync: push completed WooCommerce orders as QBO invoices.
 *
 * Processes orders completed in the last 24 hours that have not been synced yet.
 *
 * @return array|WP_Error { synced: int, skipped: int, errors: array }
 */
function dtb_qbo_run_sync(): array|WP_Error {
	if ( ! dtb_qbo_enabled() ) {
		return new WP_Error( 'qbo_not_configured', 'QuickBooks integration is not configured.' );
	}

	$synced  = 0;
	$skipped = 0;
	$errors  = [];

	$orders = wc_get_orders( [
		'status'       => 'completed',
		'limit'        => 50,
		'return'       => 'objects',
		'date_created' => '>' . ( time() - DAY_IN_SECONDS ),
		'meta_query'   => [
			[
				'key'     => '_dtb_qbo_synced',
				'compare' => 'NOT EXISTS',
			],
		],
	] );

	foreach ( $orders as $order ) {
		$result = dtb_qbo_sync_order( $order );

		if ( is_wp_error( $result ) ) {
			$errors[] = [
				'order_id' => $order->get_id(),
				'error'    => $result->get_error_message(),
			];
		} else {
			$synced++;
		}
	}

	update_option( 'dtb_qbo_last_sync_at', gmdate( 'c' ), false );

	if ( function_exists( 'dtb_ops_audit_log' ) ) {
		dtb_ops_audit_log( 'qbo_sync_complete', [
			'synced'  => $synced,
			'skipped' => $skipped,
			'errors'  => count( $errors ),
		] );
	}

	return [
		'synced'  => $synced,
		'skipped' => $skipped,
		'errors'  => $errors,
	];
}

/**
 * Sync a single WooCommerce order to QuickBooks Online as a sales receipt.
 *
 * Creates a minimal SalesReceipt object; marks the order meta _dtb_qbo_synced
 * on success so the order is not double-synced.
 *
 * @param WC_Order $order WooCommerce order object.
 * @return array|WP_Error QBO API response data on success, WP_Error on failure.
 */
function dtb_qbo_sync_order( WC_Order $order ): array|WP_Error {
	if ( $order->get_meta( '_dtb_qbo_synced' ) ) {
		return new WP_Error( 'already_synced', 'Order already synced to QBO.' );
	}

	$lines = [];

	foreach ( $order->get_items() as $item ) {
		/** @var WC_Order_Item_Product $item */
		$lines[] = [
			'Amount'      => (float) $order->get_line_total( $item, true ),
			'DetailType'  => 'SalesItemLineDetail',
			'SalesItemLineDetail' => [
				'Qty'        => $item->get_quantity(),
				'UnitPrice'  => (float) ( $order->get_line_total( $item, true ) / max( 1, $item->get_quantity() ) ),
				'ItemRef'    => [ 'value' => '1', 'name' => 'Services' ], // Default item; map by SKU in production.
			],
		];
	}

	if ( empty( $lines ) ) {
		return new WP_Error( 'no_line_items', 'Order has no line items to sync.' );
	}

	// Add shipping as a separate line if present.
	$shipping = (float) $order->get_shipping_total();
	if ( $shipping > 0 ) {
		$lines[] = [
			'Amount'     => $shipping,
			'DetailType' => 'SalesItemLineDetail',
			'SalesItemLineDetail' => [
				'Qty'       => 1,
				'UnitPrice' => $shipping,
				'ItemRef'   => [ 'value' => '2', 'name' => 'Shipping' ],
			],
		];
	}

	$payload = [
		'Line'           => $lines,
		'CustomerRef'    => [
			'value' => dtb_qbo_get_or_create_customer( $order ),
		],
		'DocNumber'      => (string) $order->get_order_number(),
		'TxnDate'        => gmdate( 'Y-m-d', $order->get_date_created()->getTimestamp() ),
		'PrivateNote'    => 'WooCommerce Order #' . $order->get_order_number(),
		'CurrencyRef'    => [ 'value' => strtoupper( get_woocommerce_currency() ) ],
	];

	$result = dtb_qbo_request( 'POST', '/salesreceipt', [], $payload );

	if ( ! $result['ok'] ) {
		return new WP_Error( 'qbo_sync_failed', 'QBO API error: ' . $result['error'] );
	}

	$qbo_id = $result['data']['SalesReceipt']['Id'] ?? null;

	$order->update_meta_data( '_dtb_qbo_synced', '1' );
	if ( $qbo_id ) {
		$order->update_meta_data( '_dtb_qbo_receipt_id', $qbo_id );
	}
	$order->save_meta_data();

	return $result['data'];
}

/**
 * Look up or create a QBO Customer for the given WC order.
 *
 * Stores the QBO customer ID in user meta (_dtb_qbo_customer_id) to avoid
 * duplicate customer records across multiple syncs.
 *
 * @param WC_Order $order
 * @return string QBO Customer 'value' (ID), or '1' as a safe default.
 */
function dtb_qbo_get_or_create_customer( WC_Order $order ): string {
	$user_id = (int) $order->get_user_id();

	// Check cached QBO customer ID on the WP user.
	if ( $user_id > 0 ) {
		$cached_id = get_user_meta( $user_id, '_dtb_qbo_customer_id', true );
		if ( $cached_id ) {
			return (string) $cached_id;
		}
	}

	$email      = $order->get_billing_email();
	$first_name = $order->get_billing_first_name();
	$last_name  = $order->get_billing_last_name();
	$display    = trim( $first_name . ' ' . $last_name ) ?: $email;

	// Search for existing customer by email.
	// IDS query syntax: escape single quotes by doubling them.
	$safe_email = str_replace( "'", "''", $email );
	$search     = dtb_qbo_request( 'GET', '/query', [
		'query' => "SELECT * FROM Customer WHERE PrimaryEmailAddr = '{$safe_email}' MAXRESULTS 1",
	] );

	if ( $search['ok'] && ! empty( $search['data']['QueryResponse']['Customer'][0]['Id'] ) ) {
		$qbo_customer_id = (string) $search['data']['QueryResponse']['Customer'][0]['Id'];

		if ( $user_id > 0 ) {
			update_user_meta( $user_id, '_dtb_qbo_customer_id', $qbo_customer_id );
		}

		return $qbo_customer_id;
	}

	// Create new customer.
	$create = dtb_qbo_request( 'POST', '/customer', [], [
		'DisplayName'     => $display . ' (' . $email . ')',
		'GivenName'       => $first_name,
		'FamilyName'      => $last_name,
		'PrimaryEmailAddr'=> [ 'Address' => $email ],
	] );

	if ( $create['ok'] && ! empty( $create['data']['Customer']['Id'] ) ) {
		$qbo_customer_id = (string) $create['data']['Customer']['Id'];

		if ( $user_id > 0 ) {
			update_user_meta( $user_id, '_dtb_qbo_customer_id', $qbo_customer_id );
		}

		return $qbo_customer_id;
	}

	// Fall back to generic customer ID '1' to avoid blocking the sync.
	return '1';
}

// =============================================================================
// SECTION 8 — CRON: DAILY SYNC
// =============================================================================

add_action( 'init', 'dtb_qbo_schedule_cron' );

/**
 * Schedule the daily QBO sync event if not already registered.
 */
function dtb_qbo_schedule_cron(): void {
	if ( ! dtb_qbo_enabled() ) {
		return;
	}

	if ( ! wp_next_scheduled( 'dtb_qbo_daily_sync' ) ) {
		wp_schedule_event( time(), 'daily', 'dtb_qbo_daily_sync' );
	}
}

add_action( 'dtb_qbo_daily_sync', 'dtb_qbo_cron_sync' );

/**
 * Cron callback: run the QBO sync and log the result.
 */
function dtb_qbo_cron_sync(): void {
	if ( ! dtb_qbo_enabled() ) {
		return;
	}

	$result = dtb_qbo_run_sync();

	if ( is_wp_error( $result ) ) {
		error_log( '[DTB QBO] Daily sync failed: ' . $result->get_error_message() ); // phpcs:ignore WordPress.PHP.DevelopmentFunctions.error_log_error_log
	}
}
