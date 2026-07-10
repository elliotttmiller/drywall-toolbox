<?php
defined( 'ABSPATH' ) || exit;

/**
 * DTB REST API — Must-Use Plugin
 *
 * Single authoritative source for ALL custom REST routes registered by the
 * Drywall Toolbox suite.  Consolidates what was previously spread across:
 *
 *   • drywall-api-proxy.php   (drywall/v1 namespace — product proxy, orders, etc.)
 *   • dtb-woocommerce.php     (dtb/v1 config, catalog, products-csv, import-catalog)
 *   • dtb-app-passwords.php   (dtb/v1 create-app-password)
 *
 * Namespaces
 * ──────────
 *   drywall/v1   Server-side WC REST proxy (products, categories, orders, …)
 *   dtb/v1       Site-management endpoints  (config, catalog, import, auth, …)
 *
 * Depends on (loaded before this file via 00-dtb-loader.php)
 * ────────────────────────────────────────────────────
 *   00-dtb-loader.php  → dtb_allowed_origins(), dtb_check_origin()
 *   dtb-utils.php      → dtb_get_config(), dtb_get_wc_credentials(),
 *                         dtb_error_envelope(), dtb_get_client_ip()
 *   dtb-auth.php       → dtb_jwt_permission()
 *   dtb-cache.php      → dtb_cached_proxy(), dtb_invalidate_product_cache(),
 *                         dtb_log_cache_event()
 *
 * Non-REST concerns (WC config, webhooks, schematics, coming-soon) remain
 * in their dedicated files. REST/CORS policy lives in dtb-api-security.php.
 *
 * @package drywall-toolbox
 */


// =============================================================================
// ROUTE REGISTRATION
// =============================================================================

add_action( 'rest_api_init', 'dtb_register_all_routes', 10 );
add_filter( 'dtb_variations_diagnostics_enabled', '__return_true' );

function dtb_register_all_routes(): void {
	dtb_register_proxy_routes();
	dtb_register_config_routes();
}

/**
 * WP REST-safe numeric validator callback.
 *
 * WP passes ( $value, $request, $param ) to validate callbacks, so built-ins
 * like is_numeric() cannot be used directly as callback strings.
 */
function dtb_rest_validate_numeric( $value, $request = null, $param = null ): bool {
	return is_numeric( $value );
}

// =============================================================================
// A. drywall/v1 — WooCommerce Proxy
//    Server-side proxy that forwards requests to WC REST API v3.
//    Consumer credentials (WC_PROXY_CONSUMER_KEY / SECRET) live exclusively
//    in wp-config.php and are never returned to the client.
// =============================================================================

function dtb_register_proxy_routes(): void {
	$ns = 'drywall/v1';

	// ── Public product / catalog routes ──────────────────────────────────────

	register_rest_route( $ns, '/products', [
		'methods'             => 'GET',
		'callback'            => 'dtb_proxy_products',
		'permission_callback' => '__return_true',
	] );

	// Slug route BEFORE the generic {id} route so WP matches it first.
	register_rest_route( $ns, '/products/slug/(?P<slug>[a-zA-Z0-9_-]+)', [
		'methods'             => 'GET',
		'callback'            => 'dtb_proxy_product_by_slug',
		'permission_callback' => '__return_true',
	] );

	// Product detail endpoint — returns parent + all variations + computed state
	// in a single normalized response optimised for the React product-detail page.
	// Must be registered BEFORE /products/slug/{slug} but is differentiated by
	// the '/detail' suffix so there is no ambiguity.
	register_rest_route( $ns, '/products/slug/(?P<slug>[a-zA-Z0-9_-]+)/detail', [
		'methods'             => 'GET',
		'callback'            => 'dtb_proxy_product_detail',
		'permission_callback' => '__return_true',
	] );

	// resolve-sku MUST be registered before the generic /{id} numeric route
	// so WordPress matches the literal prefix before the digit pattern.
	register_rest_route( $ns, '/products/resolve-sku/(?P<sku>[a-zA-Z0-9._-]+)', [
		'methods'             => 'GET',
		'callback'            => 'dtb_proxy_resolve_sku',
		'permission_callback' => '__return_true',
	] );

	register_rest_route( $ns, '/products/(?P<id>\d+)', [
		'methods'             => 'GET',
		'callback'            => 'dtb_proxy_product_by_id',
		'permission_callback' => '__return_true',
		'args'                => [ 'id' => [ 'validate_callback' => 'dtb_rest_validate_numeric' ] ],
	] );

	register_rest_route( $ns, '/products/(?P<id>\d+)/variations', [
		'methods'             => 'GET',
		'callback'            => 'dtb_proxy_product_variations',
		'permission_callback' => '__return_true',
		'args'                => [ 'id' => [ 'validate_callback' => 'dtb_rest_validate_numeric' ] ],
	] );

	register_rest_route( $ns, '/products/(?P<parent_id>\d+)/variations/(?P<id>\d+)', [
		'methods'             => 'GET',
		'callback'            => 'dtb_proxy_product_variation_by_id',
		'permission_callback' => '__return_true',
		'args'                => [
			'parent_id' => [ 'validate_callback' => 'dtb_rest_validate_numeric' ],
			'id'        => [ 'validate_callback' => 'dtb_rest_validate_numeric' ],
		],
	] );

	register_rest_route( $ns, '/categories', [
		'methods'             => 'GET',
		'callback'            => 'dtb_proxy_categories',
		'permission_callback' => '__return_true',
	] );

	register_rest_route( $ns, '/attributes', [
		'methods'             => 'GET',
		'callback'            => 'dtb_proxy_attributes',
		'permission_callback' => '__return_true',
	] );

	register_rest_route( $ns, '/search', [
		'methods'             => 'GET',
		'callback'            => 'dtb_proxy_search',
		'permission_callback' => '__return_true',
	] );

	register_rest_route( $ns, '/search/variation-sku', [
		'methods'             => 'GET',
		'callback'            => 'dtb_proxy_search_variation_sku',
		'permission_callback' => '__return_true',
	] );

	// ── JWT-gated order routes ────────────────────────────────────────────────

	register_rest_route( $ns, '/orders', [
		'methods'             => 'POST',
		'callback'            => 'dtb_proxy_create_order',
		'permission_callback' => 'dtb_jwt_permission',
	] );

	register_rest_route( $ns, '/orders/(?P<id>\d+)', [
		'methods'             => 'GET',
		'callback'            => 'dtb_proxy_get_order',
		'permission_callback' => 'dtb_jwt_permission',
		'args'                => [ 'id' => [ 'validate_callback' => 'dtb_rest_validate_numeric' ] ],
	] );

	// ── GET /drywall/v1/orders — customer's own order list (JWT-gated) ────────
	register_rest_route( $ns, '/orders', [
		'methods'             => 'GET',
		'callback'            => 'dtb_proxy_get_orders',
		'permission_callback' => 'dtb_jwt_permission',
	] );

	// ── Coupons ───────────────────────────────────────────────────────────────

	register_rest_route( $ns, '/coupons/(?P<code>[a-zA-Z0-9_-]+)', [
		'methods'             => 'GET',
		'callback'            => 'dtb_proxy_coupon',
		'permission_callback' => '__return_true',
	] );

	// ── Customer routes ───────────────────────────────────────────────────────

	register_rest_route( $ns, '/customers', [
		'methods'             => 'POST',
		'callback'            => 'dtb_proxy_create_customer',
		'permission_callback' => '__return_true',
	] );

	register_rest_route( $ns, '/customers/(?P<id>\d+)', [
		'methods'             => 'GET',
		'callback'            => 'dtb_proxy_get_customer',
		'permission_callback' => 'dtb_jwt_permission',
		'args'                => [ 'id' => [ 'validate_callback' => 'dtb_rest_validate_numeric' ] ],
	] );

	// ── Cache-invalidation webhook receiver ───────────────────────────────────

	register_rest_route( $ns, '/webhooks/products', [
		'methods'             => 'POST',
		'callback'            => 'dtb_proxy_webhook_products',
		'permission_callback' => '__return_true',
	] );
}

// =============================================================================
// B. dtb/v1 — Site Management Endpoints
// =============================================================================

function dtb_register_config_routes(): void {
	$ns = 'dtb/v1';

	// ── GET /dtb/v1/config — runtime WC credentials for the SPA ──────────────
	register_rest_route( $ns, '/config', [
		'methods'             => 'GET',
		'callback'            => 'dtb_route_config',
		'permission_callback' => '__return_true',
	] );

	// ── GET /dtb/v1/catalog — CSV proxy URL ───────────────────────────────────
	register_rest_route( $ns, '/catalog', [
		'methods'             => 'GET',
		'callback'            => 'dtb_route_catalog',
		'permission_callback' => '__return_true',
	] );

	// ── GET /dtb/v1/products-csv — stream the catalog CSV ────────────────────
	register_rest_route( $ns, '/products-csv', [
		'methods'             => 'GET',
		'callback'            => 'dtb_route_products_csv',
		'permission_callback' => '__return_true',
	] );

	// ── POST /dtb/v1/import-catalog — trigger WC CSV import ──────────────────
	register_rest_route( $ns, '/import-catalog', [
		'methods'             => 'POST',
		'callback'            => 'dtb_route_import_catalog',
		// Access control enforced inside the callback via hash_equals().
		'permission_callback' => '__return_true',
	] );

	// ── POST /dtb/v1/create-app-password ─────────────────────────────────────
	register_rest_route( $ns, '/create-app-password', [
		'methods'             => 'POST',
		'callback'            => 'dtb_route_create_app_password',
		'permission_callback' => '__return_true',
		'args'                => [
			'username' => [
				'required'          => true,
				'sanitize_callback' => 'sanitize_user',
				'description'       => 'WordPress username.',
			],
			'password' => [
				'required'          => true,
				'sanitize_callback' => 'sanitize_text_field',
				'description'       => 'WordPress password.',
			],
			'app_name' => [
				'required'          => false,
				'sanitize_callback' => 'sanitize_text_field',
				'default'           => 'Drywall Toolbox',
				'description'       => 'Application name for the generated password.',
			],
		],
	] );

	// ── POST /dtb/v1/webhooks/ensure — create any missing DTB product webhooks ─
	register_rest_route( $ns, '/webhooks/ensure', [
		'methods'             => [ 'GET', 'POST' ],
		'callback'            => 'dtb_route_ensure_webhooks',
		'permission_callback' => 'dtb_route_ensure_webhooks_permission',
		'args'                => [
			'secret' => [
				'required'          => false,
				'sanitize_callback' => 'sanitize_text_field',
				'description'       => 'Optional webhook secret for non-cookie auth.',
			],
		],
	] );

	// ── POST /dtb/v1/admin/cache/products/flush — admin cache flush ───────────
	register_rest_route( $ns, '/admin/cache/products/flush', [
		'methods'             => 'POST',
		'callback'            => 'dtb_route_admin_cache_flush',
		'permission_callback' => 'dtb_admin_cache_flush_permission',
	] );

	// ── Diagnostic: GET /dtb/v1/cors-test — CORS debugging endpoint ──────────
	register_rest_route( $ns, '/cors-test', [
		'methods'             => 'GET',
		'callback'            => 'dtb_route_cors_test',
		'permission_callback' => '__return_true',
	] );

	// ── WC-Admin onboarding profile shim (suppresses core-profiler crash) ────
	register_rest_route( 'wc-admin', '/profile', [
		'methods'             => 'GET',
		'callback'            => 'dtb_route_wc_admin_profile',
		'permission_callback' => '__return_true',
	] );

	// ── POST /dtb/v1/contact — public contact form submission ─────────────────
	register_rest_route( $ns, '/contact', [
		'methods'             => 'POST',
		'callback'            => 'dtb_contact_form_handler',
		'permission_callback' => '__return_true',
		'args'                => [
			'name'         => [
				'required'          => true,
				'sanitize_callback' => 'sanitize_text_field',
				'description'       => 'Sender full name.',
			],
			'email'        => [
				'required'          => true,
				'sanitize_callback' => 'sanitize_email',
				'description'       => 'Sender e-mail address.',
			],
			'inquiry_type' => [
				'required'          => false,
				'sanitize_callback' => 'sanitize_text_field',
				'default'           => 'General Question',
				'description'       => 'Category of inquiry.',
			],
			'message'      => [
				'required'          => true,
				'sanitize_callback' => 'sanitize_textarea_field',
				'description'       => 'Message body.',
			],
		],
	] );

	// ── Gateway-agnostic checkout abstraction ─────────────────────────────────
	register_rest_route( $ns, '/checkout/capabilities', [
		'methods'             => 'GET',
		'callback'            => 'dtb_checkout_capabilities_route',
		'permission_callback' => '__return_true',
	] );

	register_rest_route( $ns, '/checkout/session', [
		'methods'             => 'POST',
		'callback'            => 'dtb_checkout_session_route',
		'permission_callback' => '__return_true',
	] );

	register_rest_route( $ns, '/checkout/confirm', [
		'methods'             => 'POST',
		'callback'            => 'dtb_checkout_confirm_route',
		'permission_callback' => '__return_true',
	] );

	register_rest_route( $ns, '/checkout/finalize', [
		'methods'             => 'POST',
		'callback'            => 'dtb_checkout_finalize_route',
		'permission_callback' => '__return_true',
	] );

	register_rest_route( $ns, '/checkout/tax-preview', [
		'methods'             => 'POST',
		'callback'            => 'dtb_checkout_tax_preview_route',
		'permission_callback' => '__return_true',
	] );
}

/**
 * Return registered checkout gateway adapters.
 *
 * Gateway contract:
 *  - create_session( array $context, WP_REST_Request $request ): array|WP_Error
 *  - confirm( array $context, WP_REST_Request $request ): array|WP_Error
 *  - finalize( array $context, WP_REST_Request $request ): array|WP_Error
 *  - capabilities(): array
 */
function dtb_checkout_gateway_registry(): array {
	$registry = [
		'woo_native' => [
			'id'             => 'woo_native',
			'label'          => 'WooCommerce Native Checkout',
			'create_session' => 'dtb_checkout_woo_native_create_session',
			'confirm'        => 'dtb_checkout_woo_native_confirm',
			'finalize'       => 'dtb_checkout_woo_native_finalize',
			'capabilities'   => 'dtb_checkout_woo_native_capabilities',
		],
	];

	return apply_filters( 'dtb_checkout_gateway_registry', $registry );
}

function dtb_checkout_signing_key(): string {
	$key = wp_salt( 'auth' );
	if ( ! is_string( $key ) || '' === $key ) {
		$key = wp_salt();
	}
	return (string) $key;
}

function dtb_checkout_build_session_token( array $claims ): string {
	$payload = wp_json_encode( $claims );
	if ( ! is_string( $payload ) || '' === $payload ) {
		return '';
	}
	$payload_b64 = rtrim( strtr( base64_encode( $payload ), '+/', '-_' ), '=' ); // phpcs:ignore WordPress.PHP.DiscouragedPHPFunctions.obfuscation_base64_encode
	$sig_raw     = hash_hmac( 'sha256', $payload_b64, dtb_checkout_signing_key(), true );
	$sig_b64     = rtrim( strtr( base64_encode( $sig_raw ), '+/', '-_' ), '=' ); // phpcs:ignore WordPress.PHP.DiscouragedPHPFunctions.obfuscation_base64_encode
	return $payload_b64 . '.' . $sig_b64;
}

function dtb_checkout_parse_session_token( string $token ): array|WP_Error {
	$parts = explode( '.', $token, 2 );
	if ( 2 !== count( $parts ) ) {
		return new WP_Error( 'dtb_checkout_invalid_session', 'Invalid session token.', [ 'status' => 400 ] );
	}
	$payload_b64 = (string) $parts[0];
	$sig_b64     = (string) $parts[1];

	$expected_sig_raw = hash_hmac( 'sha256', $payload_b64, dtb_checkout_signing_key(), true );
	$expected_sig_b64 = rtrim( strtr( base64_encode( $expected_sig_raw ), '+/', '-_' ), '=' ); // phpcs:ignore WordPress.PHP.DiscouragedPHPFunctions.obfuscation_base64_encode
	if ( ! hash_equals( $expected_sig_b64, $sig_b64 ) ) {
		return new WP_Error( 'dtb_checkout_invalid_session', 'Session token signature mismatch.', [ 'status' => 400 ] );
	}

	$payload_raw = base64_decode( strtr( $payload_b64, '-_', '+/' ), true ); // phpcs:ignore WordPress.PHP.DiscouragedPHPFunctions.obfuscation_base64_decode
	if ( ! is_string( $payload_raw ) || '' === $payload_raw ) {
		return new WP_Error( 'dtb_checkout_invalid_session', 'Session token payload invalid.', [ 'status' => 400 ] );
	}

	$claims = json_decode( $payload_raw, true );
	if ( ! is_array( $claims ) ) {
		return new WP_Error( 'dtb_checkout_invalid_session', 'Session token payload malformed.', [ 'status' => 400 ] );
	}
	return $claims;
}

function dtb_checkout_build_idempotency_key( array $context ): string {
	$provided = sanitize_text_field( (string) ( $context['idempotency_key'] ?? '' ) );
	if ( '' !== $provided ) {
		return 'checkout:' . $provided;
	}

	$stable = [
		'session_token' => (string) ( $context['session_token'] ?? '' ),
		'payment_ref'   => (string) ( $context['payment_ref'] ?? '' ),
		'email'         => (string) ( $context['billing']['email'] ?? '' ),
	];
	return 'checkout:auto:' . md5( wp_json_encode( $stable ) ?: '' );
}

function dtb_checkout_find_order_by_idempotency_key( string $idempotency_key ): ?WC_Order {
	if ( '' === $idempotency_key || ! function_exists( 'wc_get_orders' ) ) {
		return null;
	}

	$orders = wc_get_orders( [
		'limit'      => 1,
		'orderby'    => 'date',
		'order'      => 'DESC',
		'meta_query' => [
			[
				'key'     => '_dtb_checkout_idempotency_key',
				'value'   => $idempotency_key,
				'compare' => '=',
			],
		],
	] );

	$order = $orders[0] ?? null;
	return $order instanceof WC_Order ? $order : null;
}

function dtb_checkout_acquire_idempotency_lock( string $idempotency_key ): bool {
	if ( '' === $idempotency_key ) {
		return false;
	}

	$option_name = 'dtb_checkout_lock_' . md5( $idempotency_key );
	if ( add_option( $option_name, (string) time(), '', 'no' ) ) {
		return true;
	}

	$locked_at = (int) get_option( $option_name, 0 );
	if ( $locked_at > 0 && ( time() - $locked_at ) < MINUTE_IN_SECONDS ) {
		return false;
	}

	global $wpdb;
	$claimed = $wpdb->query( $wpdb->prepare( "UPDATE {$wpdb->options} SET option_value = %s WHERE option_name = %s AND option_value = %s", (string) time(), $option_name, (string) $locked_at ) ); // phpcs:ignore WordPress.DB.DirectDatabaseQuery
	return 1 === $claimed;
}

function dtb_checkout_release_idempotency_lock( string $idempotency_key ): void {
	if ( '' !== $idempotency_key ) {
		delete_option( 'dtb_checkout_lock_' . md5( $idempotency_key ) );
	}
}

function dtb_checkout_existing_order_response( string $idempotency_key ): ?array {
	$existing_order = dtb_checkout_find_order_by_idempotency_key( $idempotency_key );
	if ( ! $existing_order instanceof WC_Order ) {
		return null;
	}

	set_transient( 'dtb_checkout_idem_' . md5( $idempotency_key ), (int) $existing_order->get_id(), DAY_IN_SECONDS );
	return dtb_checkout_order_response( $existing_order, true );
}

function dtb_checkout_line_signature_from_context( array $context ): array {
	$line_items = [];
	foreach ( (array) ( $context['line_items'] ?? [] ) as $item ) {
		if ( ! is_array( $item ) ) {
			continue;
		}
		$line_items[] = [
			'product_id'   => absint( $item['product_id'] ?? 0 ),
			'variation_id' => absint( $item['variation_id'] ?? 0 ),
			'quantity'     => max( 1, absint( $item['quantity'] ?? 1 ) ),
		];
	}

	usort(
		$line_items,
		static function ( array $a, array $b ): int {
			return ( $a['product_id'] <=> $b['product_id'] )
				?: ( $a['variation_id'] <=> $b['variation_id'] )
				?: ( $a['quantity'] <=> $b['quantity'] );
		}
	);

	return $line_items;
}

function dtb_checkout_line_signature_from_order( WC_Order $order ): array {
	$line_items = [];
	foreach ( $order->get_items() as $item ) {
		if ( ! $item instanceof WC_Order_Item_Product ) {
			continue;
		}
		$line_items[] = [
			'product_id'   => absint( $item->get_product_id() ),
			'variation_id' => absint( $item->get_variation_id() ),
			'quantity'     => max( 1, absint( $item->get_quantity() ) ),
		];
	}

	usort(
		$line_items,
		static function ( array $a, array $b ): int {
			return ( $a['product_id'] <=> $b['product_id'] )
				?: ( $a['variation_id'] <=> $b['variation_id'] )
				?: ( $a['quantity'] <=> $b['quantity'] );
		}
	);

	return $line_items;
}

function dtb_checkout_build_fingerprint( array $context ): string {
	$line_items = dtb_checkout_line_signature_from_context( $context );

	$shipping_lines = [];
	foreach ( (array) ( $context['shipping_lines'] ?? [] ) as $line ) {
		if ( ! is_array( $line ) ) {
			continue;
		}
		$shipping_lines[] = [
			'method_id' => sanitize_text_field( (string) ( $line['method_id'] ?? '' ) ),
			'total'     => wc_format_decimal( (string) ( $line['total'] ?? '0' ) ),
		];
	}

	$coupon_codes = array_map(
		static fn( $code ): string => strtolower( sanitize_text_field( (string) $code ) ),
		(array) ( $context['coupon_codes'] ?? [] )
	);
	sort( $coupon_codes );

	$billing  = is_array( $context['billing'] ?? null ) ? $context['billing'] : [];
	$shipping = is_array( $context['shipping'] ?? null ) ? $context['shipping'] : $billing;

	$fingerprint = [
		'email'          => strtolower( sanitize_email( (string) ( $billing['email'] ?? '' ) ) ),
		'payment_method' => sanitize_key( (string) ( $context['payment_method'] ?? '' ) ),
		'billing'        => dtb_checkout_normalize_address( $billing, true ),
		'shipping'       => dtb_checkout_normalize_address( $shipping ),
		'line_items'     => $line_items,
		'shipping_lines' => $shipping_lines,
		'coupon_codes'   => $coupon_codes,
	];

	return 'checkout-fp:' . md5( wp_json_encode( $fingerprint ) ?: '' );
}

function dtb_checkout_order_response( WC_Order $order, bool $idempotent = false ): array {
	$status                   = (string) $order->get_status();
	$existing_payment_required = in_array( $status, [ 'pending', 'on-hold', 'failed' ], true );
	$existing_payment_url      = $existing_payment_required
		? dtb_checkout_payment_url( $order )
		: '';

	return [
		'order_id'          => (int) $order->get_id(),
		'order_key'         => (string) $order->get_order_key(),
		'status'            => $status,
		'payment_method'    => (string) $order->get_payment_method(),
		'payment_ref'       => (string) $order->get_meta( '_dtb_payment_ref', true ),
		'total'             => (string) $order->get_total(),
		'currency'          => (string) $order->get_currency(),
		'idempotent'        => $idempotent,
		'payment_required'  => $existing_payment_required,
		'payment_url'       => $existing_payment_url,
	];
}

function dtb_checkout_find_unpaid_order_by_fingerprint( string $fingerprint ): ?WC_Order {
	if ( '' === $fingerprint || ! function_exists( 'wc_get_orders' ) ) {
		return null;
	}

	$orders = wc_get_orders( [
		'limit'        => 1,
		'orderby'      => 'date',
		'order'        => 'DESC',
		'status'       => [ 'pending', 'on-hold' ],
		'date_created' => '>' . gmdate( 'Y-m-d H:i:s', time() - DAY_IN_SECONDS ),
		'meta_query'   => [
			[
				'key'   => '_dtb_checkout_fingerprint',
				'value' => $fingerprint,
			],
		],
	] );

	$order = $orders[0] ?? null;
	return $order instanceof WC_Order ? $order : null;
}

function dtb_checkout_find_unpaid_order_by_context( array $context ): ?WC_Order {
	if ( ! function_exists( 'wc_get_orders' ) ) {
		return null;
	}

	$billing        = is_array( $context['billing'] ?? null ) ? $context['billing'] : [];
	$billing_email  = strtolower( sanitize_email( (string) ( $billing['email'] ?? '' ) ) );
	$payment_method = sanitize_key( (string) ( $context['payment_method'] ?? 'cod' ) );
	$line_items     = dtb_checkout_line_signature_from_context( $context );
	if ( empty( $line_items ) ) {
		return null;
	}

	$args = [
		'limit'        => 20,
		'orderby'      => 'date',
		'order'        => 'DESC',
		'status'       => [ 'pending', 'on-hold' ],
		'date_created' => '>' . gmdate( 'Y-m-d H:i:s', time() - DAY_IN_SECONDS ),
		'meta_query'   => [
			'relation' => 'OR',
			[
				'key'   => '_dtb_checkout_gateway',
				'value' => 'woo_native',
			],
			[
				'key'     => '_dtb_checkout_contract_version',
				'compare' => 'EXISTS',
			],
		],
	];

	if ( '' !== $billing_email ) {
		$args['billing_email'] = $billing_email;
	}

	$orders = wc_get_orders( $args );
	foreach ( $orders as $order ) {
		if ( ! $order instanceof WC_Order ) {
			continue;
		}
		if ( '' !== $billing_email && strtolower( (string) $order->get_billing_email() ) !== $billing_email ) {
			continue;
		}
		if ( $payment_method !== (string) $order->get_payment_method() ) {
			continue;
		}
		if ( $line_items !== dtb_checkout_line_signature_from_order( $order ) ) {
			continue;
		}

		return $order;
	}

	return null;
}

function dtb_checkout_payment_url( WC_Order $order ): string {
	if ( ! method_exists( $order, 'get_checkout_payment_url' ) ) {
		return '';
	}

	$url = (string) $order->get_checkout_payment_url();
	if ( '' === $url ) {
		return '';
	}

	$parts = wp_parse_url( $url );
	if ( ! is_array( $parts ) ) {
		return $url;
	}

	$path = (string) ( $parts['path'] ?? '' );
	if ( preg_match( '#^/checkout/order-pay(?:/|$)#', $path ) ) {
		$path = '/wp' . $path;
	} elseif ( preg_match( '#^/order-pay(?:/|$)#', $path ) ) {
		$path = '/wp/checkout' . $path;
	} else {
		return $url;
	}

	$normalized = home_url( $path );
	if ( ! empty( $parts['query'] ) ) {
		$normalized .= '?' . (string) $parts['query'];
	}
	if ( ! empty( $parts['fragment'] ) ) {
		$normalized .= '#' . (string) $parts['fragment'];
	}

	return $normalized;
}

function dtb_checkout_default_gateway(): string {
	return (string) apply_filters( 'dtb_checkout_default_gateway', 'woo_native' );
}

function dtb_checkout_gateway_from_request( WP_REST_Request $request ): string {
	$gateway = sanitize_key( (string) ( $request->get_param( 'gateway' ) ?: dtb_checkout_default_gateway() ) );
	$registry = dtb_checkout_gateway_registry();
	if ( ! isset( $registry[ $gateway ] ) ) {
		return dtb_checkout_default_gateway();
	}
	return $gateway;
}

function dtb_checkout_get_gateway_adapter( string $gateway ): array|WP_Error {
	$registry = dtb_checkout_gateway_registry();
	if ( ! isset( $registry[ $gateway ] ) || ! is_array( $registry[ $gateway ] ) ) {
		return new WP_Error( 'dtb_checkout_gateway_not_found', 'Unsupported checkout gateway.', [ 'status' => 400 ] );
	}
	return $registry[ $gateway ];
}

function dtb_checkout_route_guard(): true|WP_REST_Response {
	if ( ! dtb_check_origin() ) {
		return new WP_REST_Response(
			dtb_error_envelope( 'forbidden_origin', 'Origin not allowed.', 403 ),
			403
		);
	}
	return true;
}

function dtb_checkout_context_from_request( WP_REST_Request $request ): array {
	$payload = $request->get_json_params();
	if ( ! is_array( $payload ) ) {
		$payload = [];
	}
	return $payload;
}

function dtb_checkout_normalize_country_code( string $country ): string {
	$country = strtoupper( trim( sanitize_text_field( $country ) ) );
	if ( 2 === strlen( $country ) ) {
		return $country;
	}

	if ( function_exists( 'WC' ) && WC()->countries ) {
		foreach ( WC()->countries->get_countries() as $code => $name ) {
			if ( 0 === strcasecmp( $country, (string) $name ) ) {
				return strtoupper( (string) $code );
			}
		}
	}

	return 'US';
}

function dtb_checkout_normalize_state_code( string $country, string $state ): string {
	$state = trim( sanitize_text_field( $state ) );
	if ( '' === $state || ! function_exists( 'WC' ) || ! WC()->countries ) {
		return strtoupper( $state );
	}

	$states = WC()->countries->get_states( $country );
	if ( ! is_array( $states ) || empty( $states ) ) {
		return strtoupper( $state );
	}

	foreach ( $states as $code => $name ) {
		if ( 0 === strcasecmp( $state, (string) $code ) || 0 === strcasecmp( $state, (string) $name ) ) {
			return strtoupper( (string) $code );
		}
	}

	return strtoupper( $state );
}

function dtb_checkout_normalize_address( array $address, bool $include_contact = false ): array {
	$country = dtb_checkout_normalize_country_code( (string) ( $address['country'] ?? 'US' ) );
	$mapped  = [
		'first_name' => sanitize_text_field( (string) ( $address['first_name'] ?? '' ) ),
		'last_name'  => sanitize_text_field( (string) ( $address['last_name'] ?? '' ) ),
		'company'    => sanitize_text_field( (string) ( $address['company'] ?? '' ) ),
		'address_1'  => sanitize_text_field( (string) ( $address['address_1'] ?? '' ) ),
		'address_2'  => sanitize_text_field( (string) ( $address['address_2'] ?? '' ) ),
		'city'       => sanitize_text_field( (string) ( $address['city'] ?? '' ) ),
		'state'      => dtb_checkout_normalize_state_code( $country, (string) ( $address['state'] ?? '' ) ),
		'postcode'   => sanitize_text_field( (string) ( $address['postcode'] ?? '' ) ),
		'country'    => $country,
	];

	if ( $include_contact ) {
		$mapped['email'] = sanitize_email( (string) ( $address['email'] ?? '' ) );
		$mapped['phone'] = sanitize_text_field( (string) ( $address['phone'] ?? '' ) );
	}

	return $mapped;
}

function dtb_checkout_capabilities_route( WP_REST_Request $request ): WP_REST_Response {
	$guard = dtb_checkout_route_guard();
	if ( $guard instanceof WP_REST_Response ) {
		return $guard;
	}

	$registry = dtb_checkout_gateway_registry();
	$gateways = [];
	foreach ( $registry as $gateway_id => $adapter ) {
		$capability_cb = $adapter['capabilities'] ?? null;
		$caps = is_callable( $capability_cb ) ? call_user_func( $capability_cb ) : [];
		if ( ! is_array( $caps ) ) {
			$caps = [];
		}
		$gateways[] = array_merge( [
			'id'      => (string) $gateway_id,
			'enabled' => true,
		], $caps );
	}

	return new WP_REST_Response( [
		'default_gateway' => dtb_checkout_default_gateway(),
		'currency'        => function_exists( 'get_woocommerce_currency' ) ? get_woocommerce_currency() : 'USD',
		'gateways'        => $gateways,
	], 200 );
}

function dtb_checkout_tax_preview_route( WP_REST_Request $request ): WP_REST_Response {
	$guard = dtb_checkout_route_guard();
	if ( $guard instanceof WP_REST_Response ) {
		return $guard;
	}
	if ( ! class_exists( 'WC_Order' ) || ! function_exists( 'wc_get_product' ) ) {
		return new WP_REST_Response( dtb_error_envelope( 'dtb_checkout_wc_unavailable', 'WooCommerce is not available.', 500 ), 500 );
	}

	$context    = dtb_checkout_context_from_request( $request );
	$line_items = $context['line_items'] ?? [];
	if ( ! is_array( $line_items ) || empty( $line_items ) ) {
		return new WP_REST_Response( dtb_error_envelope( 'dtb_checkout_missing_items', 'line_items is required.', 400 ), 400 );
	}

	$shipping = is_array( $context['shipping'] ?? null ) ? $context['shipping'] : [];
	if ( empty( $shipping ) ) {
		return new WP_REST_Response( dtb_error_envelope( 'dtb_checkout_missing_shipping', 'shipping is required.', 400 ), 400 );
	}

	$mapped_shipping = dtb_checkout_normalize_address( $shipping );
	$order           = new WC_Order();
	$order->set_created_via( 'dtb_checkout_tax_preview' );
	$order->set_address( $mapped_shipping, 'shipping' );
	$order->set_address( dtb_checkout_normalize_address( is_array( $context['billing'] ?? null ) ? $context['billing'] : $shipping, true ), 'billing' );

	foreach ( $line_items as $item ) {
		$product_id   = absint( $item['product_id'] ?? 0 );
		$variation_id = absint( $item['variation_id'] ?? 0 );
		$quantity     = max( 1, absint( $item['quantity'] ?? 1 ) );
		if ( $product_id <= 0 ) {
			continue;
		}

		$product = wc_get_product( $variation_id > 0 ? $variation_id : $product_id );
		if ( $product ) {
			$order->add_product( $product, $quantity );
		}
	}

	foreach ( is_array( $context['shipping_lines'] ?? null ) ? $context['shipping_lines'] : [] as $shipping_line ) {
		if ( ! is_array( $shipping_line ) || ! class_exists( 'WC_Order_Item_Shipping' ) ) {
			continue;
		}

		$item = new WC_Order_Item_Shipping();
		$item->set_method_title( sanitize_text_field( (string) ( $shipping_line['method_title'] ?? 'Shipping' ) ) );
		$item->set_method_id( sanitize_text_field( (string) ( $shipping_line['method_id'] ?? 'flat_rate' ) ) );
		$item->set_total( wc_format_decimal( (string) ( $shipping_line['total'] ?? '0' ) ) );
		$order->add_item( $item );
	}

	foreach ( is_array( $context['coupon_codes'] ?? null ) ? $context['coupon_codes'] : [] as $coupon_code ) {
		$code = sanitize_text_field( (string) $coupon_code );
		if ( '' !== $code ) {
			$order->apply_coupon( $code );
		}
	}

	$order->calculate_taxes( [
		'country'  => $mapped_shipping['country'],
		'state'    => $mapped_shipping['state'],
		'postcode' => $mapped_shipping['postcode'],
		'city'     => $mapped_shipping['city'],
	] );
	$order->calculate_totals( false );

	return new WP_REST_Response( [
		'tax'      => (float) $order->get_total_tax(),
		'subtotal' => (float) $order->get_subtotal(),
		'shipping' => (float) $order->get_shipping_total(),
		'total'    => (float) $order->get_total(),
		'currency' => function_exists( 'get_woocommerce_currency' ) ? get_woocommerce_currency() : 'USD',
	], 200 );
}

function dtb_checkout_session_route( WP_REST_Request $request ): WP_REST_Response {
	$guard = dtb_checkout_route_guard();
	if ( $guard instanceof WP_REST_Response ) {
		return $guard;
	}

	$gateway = dtb_checkout_gateway_from_request( $request );
	$adapter = dtb_checkout_get_gateway_adapter( $gateway );
	if ( is_wp_error( $adapter ) ) {
		$status = (int) ( $adapter->get_error_data()['status'] ?? 400 );
		return new WP_REST_Response( dtb_error_envelope( $adapter->get_error_code(), $adapter->get_error_message(), $status ), $status );
	}

	$context = dtb_checkout_context_from_request( $request );
	$create_session_cb = $adapter['create_session'] ?? null;
	if ( ! is_callable( $create_session_cb ) ) {
		return new WP_REST_Response( dtb_error_envelope( 'dtb_checkout_misconfigured', 'Gateway session callback missing.', 500 ), 500 );
	}

	$result = call_user_func( $create_session_cb, $context, $request );
	if ( is_wp_error( $result ) ) {
		$status = (int) ( $result->get_error_data()['status'] ?? 400 );
		return new WP_REST_Response( dtb_error_envelope( $result->get_error_code(), $result->get_error_message(), $status ), $status );
	}

	return new WP_REST_Response( [
		'gateway' => $gateway,
		'session' => $result,
	], 200 );
}

function dtb_checkout_confirm_route( WP_REST_Request $request ): WP_REST_Response {
	$guard = dtb_checkout_route_guard();
	if ( $guard instanceof WP_REST_Response ) {
		return $guard;
	}

	$gateway = dtb_checkout_gateway_from_request( $request );
	$adapter = dtb_checkout_get_gateway_adapter( $gateway );
	if ( is_wp_error( $adapter ) ) {
		$status = (int) ( $adapter->get_error_data()['status'] ?? 400 );
		return new WP_REST_Response( dtb_error_envelope( $adapter->get_error_code(), $adapter->get_error_message(), $status ), $status );
	}

	$context = dtb_checkout_context_from_request( $request );
	$confirm_cb = $adapter['confirm'] ?? null;
	if ( ! is_callable( $confirm_cb ) ) {
		return new WP_REST_Response( dtb_error_envelope( 'dtb_checkout_misconfigured', 'Gateway confirm callback missing.', 500 ), 500 );
	}

	$result = call_user_func( $confirm_cb, $context, $request );
	if ( is_wp_error( $result ) ) {
		$status = (int) ( $result->get_error_data()['status'] ?? 400 );
		return new WP_REST_Response( dtb_error_envelope( $result->get_error_code(), $result->get_error_message(), $status ), $status );
	}

	return new WP_REST_Response( [
		'gateway' => $gateway,
		'confirm' => $result,
	], 200 );
}

function dtb_checkout_finalize_route( WP_REST_Request $request ): WP_REST_Response {
	$guard = dtb_checkout_route_guard();
	if ( $guard instanceof WP_REST_Response ) {
		return $guard;
	}

	$gateway = dtb_checkout_gateway_from_request( $request );
	$adapter = dtb_checkout_get_gateway_adapter( $gateway );
	if ( is_wp_error( $adapter ) ) {
		$status = (int) ( $adapter->get_error_data()['status'] ?? 400 );
		return new WP_REST_Response( dtb_error_envelope( $adapter->get_error_code(), $adapter->get_error_message(), $status ), $status );
	}

	$context = dtb_checkout_context_from_request( $request );
	$finalize_cb = $adapter['finalize'] ?? null;
	if ( ! is_callable( $finalize_cb ) ) {
		return new WP_REST_Response( dtb_error_envelope( 'dtb_checkout_misconfigured', 'Gateway finalize callback missing.', 500 ), 500 );
	}

	$result = call_user_func( $finalize_cb, $context, $request );
	if ( is_wp_error( $result ) ) {
		$status = (int) ( $result->get_error_data()['status'] ?? 400 );
		return new WP_REST_Response( dtb_error_envelope( $result->get_error_code(), $result->get_error_message(), $status ), $status );
	}

	return new WP_REST_Response( [
		'gateway'  => $gateway,
		'finalize' => $result,
	], 200 );
}

function dtb_checkout_offline_payment_method_ids(): array {
	return (array) apply_filters( 'dtb_checkout_offline_payment_method_ids', [ 'cod', 'bacs', 'cheque' ] );
}

function dtb_checkout_is_manual_payment_method( string $payment_method ): bool {
	$method = sanitize_key( $payment_method );
	if ( '' === $method ) {
		return false;
	}
	return in_array( $method, dtb_checkout_offline_payment_method_ids(), true );
}

function dtb_checkout_woo_native_payment_methods(): array {
	$enabled = [];
	if ( ! function_exists( 'WC' ) || ! WC()->payment_gateways() ) {
		return $enabled;
	}

	$gateways = WC()->payment_gateways()->get_available_payment_gateways();
	foreach ( (array) $gateways as $gateway ) {
		if ( ! is_object( $gateway ) ) {
			continue;
		}

		$id = sanitize_key( (string) ( $gateway->id ?? '' ) );
		if ( '' === $id ) {
			continue;
		}

		$supports = [];
		if ( isset( $gateway->supports ) && is_array( $gateway->supports ) ) {
			foreach ( $gateway->supports as $feature ) {
				$feature = sanitize_key( (string) $feature );
				if ( '' !== $feature ) {
					$supports[] = $feature;
				}
			}
		}

		$is_manual = dtb_checkout_is_manual_payment_method( $id );
		$enabled[] = [
			'id'                   => $id,
			'title'                => sanitize_text_field( (string) ( $gateway->title ?? '' ) ),
			'description'          => sanitize_text_field( (string) ( $gateway->description ?? '' ) ),
			'enabled'              => true,
			'is_manual'            => $is_manual,
			'requires_payment_ref' => ! $is_manual,
			'has_fields'           => ! empty( $gateway->has_fields ),
			'supports'             => array_values( array_unique( $supports ) ),
		];
	}

	return $enabled;
}

function dtb_checkout_woo_native_capabilities(): array {
	$enabled = dtb_checkout_woo_native_payment_methods();

	return [
		'label'             => 'Woo Native',
		'currencies'        => [ function_exists( 'get_woocommerce_currency' ) ? get_woocommerce_currency() : 'USD' ],
		'express_checkout'  => false,
		'installments'      => false,
		'required_fields'   => [ 'line_items', 'billing' ],
		'payment_methods'   => $enabled,
	];
}

function dtb_checkout_woo_native_create_session( array $context, WP_REST_Request $request ): array|WP_Error {
	$line_items = $context['line_items'] ?? [];
	if ( ! is_array( $line_items ) || empty( $line_items ) ) {
		return new WP_Error( 'dtb_checkout_missing_items', 'line_items is required.', [ 'status' => 400 ] );
	}

	$available_methods = dtb_checkout_woo_native_payment_methods();
	if ( empty( $available_methods ) ) {
		return new WP_Error( 'dtb_checkout_no_payment_methods', 'No payment methods are currently available.', [ 'status' => 422 ] );
	}

	$gateway = sanitize_key( (string) ( $context['payment_method'] ?? '' ) );
	if ( '' === $gateway ) {
		$gateway = sanitize_key( (string) ( $available_methods[0]['id'] ?? '' ) );
	}

	$selected_method = null;
	foreach ( $available_methods as $method ) {
		if ( $gateway === (string) ( $method['id'] ?? '' ) ) {
			$selected_method = $method;
			break;
		}
	}

	if ( ! is_array( $selected_method ) ) {
		return new WP_Error( 'dtb_checkout_invalid_payment_method', 'Selected payment method is not available.', [ 'status' => 422 ] );
	}

	$token_payload = [
		'sid'        => wp_generate_uuid4(),
		'gateway'    => 'woo_native',
		'method'     => $gateway,
		'issued_at'  => time(),
		'expires_at' => time() + 900,
		'nonce'      => wp_generate_password( 24, false, false ),
	];
	$session_token = dtb_checkout_build_session_token( $token_payload );
	if ( '' === $session_token ) {
		return new WP_Error( 'dtb_checkout_session_create_failed', 'Could not create checkout session.', [ 'status' => 500 ] );
	}

	set_transient(
		'dtb_checkout_session_' . md5( (string) $token_payload['sid'] ),
		[
			'gateway'    => 'woo_native',
			'method'     => $gateway,
			'issued_at'  => (int) $token_payload['issued_at'],
			'expires_at' => (int) $token_payload['expires_at'],
		],
		900
	);

	return [
		'session_id'    => (string) $token_payload['sid'],
		'session_token' => $session_token,
		'expires_at'    => gmdate( 'c', (int) $token_payload['expires_at'] ),
		'status'        => 'created',
		'payment_method'=> $gateway,
		'is_manual'     => ! empty( $selected_method['is_manual'] ),
	];
}

function dtb_checkout_woo_native_confirm( array $context, WP_REST_Request $request ): array|WP_Error {
	$session_token = (string) ( $context['session_token'] ?? '' );
	if ( '' === $session_token ) {
		return new WP_Error( 'dtb_checkout_missing_session', 'session_token is required.', [ 'status' => 400 ] );
	}

	$claims = dtb_checkout_parse_session_token( $session_token );
	if ( is_wp_error( $claims ) ) {
		return $claims;
	}
	if ( time() > (int) ( $claims['expires_at'] ?? 0 ) ) {
		return new WP_Error( 'dtb_checkout_session_expired', 'Session token expired.', [ 'status' => 400 ] );
	}
	$sid = sanitize_text_field( (string) ( $claims['sid'] ?? '' ) );
	if ( '' === $sid ) {
		return new WP_Error( 'dtb_checkout_invalid_session', 'Session id missing.', [ 'status' => 400 ] );
	}
	$session_state = get_transient( 'dtb_checkout_session_' . md5( $sid ) );
	if ( ! is_array( $session_state ) ) {
		return new WP_Error( 'dtb_checkout_session_not_found', 'Session not found or expired.', [ 'status' => 400 ] );
	}

	return [
		'confirmed'       => true,
		'requires_action' => false,
		'payment_ref'     => (string) ( $context['payment_ref'] ?? '' ),
	];
}

function dtb_checkout_woo_native_finalize( array $context, WP_REST_Request $request ): array|WP_Error {
	if ( ! function_exists( 'wc_create_order' ) ) {
		return new WP_Error( 'dtb_checkout_wc_unavailable', 'WooCommerce is not available.', [ 'status' => 500 ] );
	}

	$session_token = (string) ( $context['session_token'] ?? '' );
	if ( '' === $session_token ) {
		return new WP_Error( 'dtb_checkout_missing_session', 'session_token is required.', [ 'status' => 400 ] );
	}
	$claims = dtb_checkout_parse_session_token( $session_token );
	if ( is_wp_error( $claims ) ) {
		return $claims;
	}
	if ( time() > (int) ( $claims['expires_at'] ?? 0 ) ) {
		return new WP_Error( 'dtb_checkout_session_expired', 'Session token expired.', [ 'status' => 400 ] );
	}
	$sid = sanitize_text_field( (string) ( $claims['sid'] ?? '' ) );
	if ( '' === $sid ) {
		return new WP_Error( 'dtb_checkout_invalid_session', 'Session id missing.', [ 'status' => 400 ] );
	}

	$line_items = $context['line_items'] ?? [];
	if ( ! is_array( $line_items ) || empty( $line_items ) ) {
		return new WP_Error( 'dtb_checkout_missing_items', 'line_items is required.', [ 'status' => 400 ] );
	}
	$billing = $context['billing'] ?? [];
	if ( ! is_array( $billing ) || empty( $billing ) ) {
		return new WP_Error( 'dtb_checkout_missing_billing', 'billing is required.', [ 'status' => 400 ] );
	}

	$payment_method = sanitize_key( (string) ( $context['payment_method'] ?? 'cod' ) );
	$payment_ref    = sanitize_text_field( (string) ( $context['payment_ref'] ?? '' ) );
	$customer_note  = sanitize_textarea_field( (string) ( $context['customer_note'] ?? '' ) );
	$shipping_lines = is_array( $context['shipping_lines'] ?? null ) ? $context['shipping_lines'] : [];
	$coupon_codes   = is_array( $context['coupon_codes'] ?? null ) ? $context['coupon_codes'] : [];
	$idempotency_key = dtb_checkout_build_idempotency_key( $context );
	$existing_order_id = absint( (string) get_transient( 'dtb_checkout_idem_' . md5( $idempotency_key ) ) );
	if ( $existing_order_id > 0 ) {
		$existing_order = wc_get_order( $existing_order_id );
		if ( $existing_order ) {
			return dtb_checkout_order_response( $existing_order, true );
		}
	}

	$existing_response = dtb_checkout_existing_order_response( $idempotency_key );
	if ( null !== $existing_response ) {
		return $existing_response;
	}

	if ( ! dtb_checkout_acquire_idempotency_lock( $idempotency_key ) ) {
		$existing_response = dtb_checkout_existing_order_response( $idempotency_key );
		if ( null !== $existing_response ) {
			return $existing_response;
		}

		return new WP_Error( 'dtb_checkout_in_progress', 'Checkout is already being finalized. Please retry shortly.', [ 'status' => 409 ] );
	}

	try {
		$existing_response = dtb_checkout_existing_order_response( $idempotency_key );
		if ( null !== $existing_response ) {
			return $existing_response;
		}

	$checkout_fingerprint = dtb_checkout_build_fingerprint( $context );
	$fingerprint_order    = dtb_checkout_find_unpaid_order_by_fingerprint( $checkout_fingerprint );
	if ( $fingerprint_order instanceof WC_Order ) {
		set_transient( 'dtb_checkout_idem_' . md5( $idempotency_key ), (int) $fingerprint_order->get_id(), DAY_IN_SECONDS );
		return dtb_checkout_order_response( $fingerprint_order, true );
	}

	$context_order = dtb_checkout_find_unpaid_order_by_context( $context );
	if ( $context_order instanceof WC_Order ) {
		$context_order->update_meta_data( '_dtb_checkout_fingerprint', $checkout_fingerprint );
		$context_order->update_meta_data( '_dtb_checkout_idempotency_key', $idempotency_key );
		$context_order->save_meta_data();
		set_transient( 'dtb_checkout_idem_' . md5( $idempotency_key ), (int) $context_order->get_id(), DAY_IN_SECONDS );
		return dtb_checkout_order_response( $context_order, true );
	}

	$session_state = get_transient( 'dtb_checkout_session_' . md5( $sid ) );
	if ( ! is_array( $session_state ) ) {
		return new WP_Error( 'dtb_checkout_session_not_found', 'Session not found or expired.', [ 'status' => 400 ] );
	}

	$order = wc_create_order();
	if ( is_wp_error( $order ) ) {
		return $order;
	}

	foreach ( $line_items as $item ) {
		$product_id   = absint( $item['product_id'] ?? 0 );
		$variation_id = absint( $item['variation_id'] ?? 0 );
		$quantity     = max( 1, absint( $item['quantity'] ?? 1 ) );
		if ( $product_id <= 0 ) {
			continue;
		}

		$product = wc_get_product( $variation_id > 0 ? $variation_id : $product_id );
		if ( ! $product ) {
			continue;
		}
		$order->add_product( $product, $quantity );
	}

	$mapped_billing = dtb_checkout_normalize_address( $billing, true );
	$order->set_address( $mapped_billing, 'billing' );

	$shipping = is_array( $context['shipping'] ?? null ) ? $context['shipping'] : $billing;
	$mapped_shipping = dtb_checkout_normalize_address( $shipping );
	$order->set_address( $mapped_shipping, 'shipping' );

	foreach ( $shipping_lines as $shipping_line ) {
		if ( ! is_array( $shipping_line ) ) {
			continue;
		}
		$item = new WC_Order_Item_Shipping();
		$item->set_method_title( sanitize_text_field( (string) ( $shipping_line['method_title'] ?? 'Shipping' ) ) );
		$item->set_method_id( sanitize_text_field( (string) ( $shipping_line['method_id'] ?? 'flat_rate' ) ) );
		$item->set_total( wc_format_decimal( (string) ( $shipping_line['total'] ?? '0' ) ) );
		$order->add_item( $item );
	}

	foreach ( $coupon_codes as $coupon_code ) {
		$code = sanitize_text_field( (string) $coupon_code );
		if ( '' === $code ) {
			continue;
		}
		$order->apply_coupon( $code );
	}

	$order->set_payment_method( $payment_method );
	$order->set_payment_method_title( sanitize_text_field( (string) ( $context['payment_method_title'] ?? strtoupper( $payment_method ) ) ) );
	$order->set_status( 'pending' );
	if ( '' !== $customer_note ) {
		$order->set_customer_note( $customer_note );
	}
	if ( '' !== $payment_ref ) {
		$order->update_meta_data( '_dtb_payment_ref', $payment_ref );
	}

	$order->update_meta_data( '_dtb_checkout_gateway', 'woo_native' );
	$order->update_meta_data( '_dtb_checkout_contract_version', '1' );
	$order->update_meta_data( '_dtb_checkout_session_id', $sid );
	$order->update_meta_data( '_dtb_checkout_idempotency_key', $idempotency_key );
	$order->update_meta_data( '_dtb_checkout_fingerprint', $checkout_fingerprint );
	$order->update_meta_data( '_dtb_order_type', 'product' );
	$order->calculate_taxes( [
		'country'  => $mapped_shipping['country'],
		'state'    => $mapped_shipping['state'],
		'postcode' => $mapped_shipping['postcode'],
		'city'     => $mapped_shipping['city'],
	] );
	$order->calculate_totals( false );
	$order->update_meta_data( '_dtb_tax_calculation_version', '1' );
	$order->save();
	set_transient( 'dtb_checkout_idem_' . md5( $idempotency_key ), (int) $order->get_id(), DAY_IN_SECONDS );
	delete_transient( 'dtb_checkout_session_' . md5( $sid ) );

	$final_status     = 'pending';
	$payment_required = true;
	$payment_url      = dtb_checkout_payment_url( $order );

	return [
		'order_id'        => (int) $order->get_id(),
		'order_key'       => (string) $order->get_order_key(),
		'status'          => $final_status,
		'payment_method'  => $payment_method,
		'payment_ref'     => $payment_ref,
		'total'           => (string) $order->get_total(),
		'currency'        => (string) $order->get_currency(),
		'payment_required' => $payment_required,
		'payment_url'      => $payment_url,
	];
	} finally {
		dtb_checkout_release_idempotency_lock( $idempotency_key );
	}
}

// =============================================================================
// HELPERS — WC HTTP transport
// =============================================================================

/**
 * Build the Basic-auth header for WC REST API v3 server-to-server calls.
 *
 * Priority:
 *   1) WC REST API consumer key/secret (preferred for service-to-service proxying)
 *   2) WordPress Application Password credentials (staging fallback)
 *
 * Returns an empty string when neither credential pair is configured.
 */
function dtb_wc_auth_header(): string {
	$config = dtb_get_config();

	$proxy_key    = trim( (string) ( $config['wc_proxy_key'] ?? '' ) );
	$proxy_secret = trim( (string) ( $config['wc_proxy_secret'] ?? '' ) );
	if ( '' !== $proxy_key && '' !== $proxy_secret ) {
		return 'Basic ' . base64_encode( $proxy_key . ':' . $proxy_secret ); // phpcs:ignore WordPress.PHP.DiscouragedPHPFunctions.obfuscation_base64_encode
	}

	$auth_user = trim( (string) ( $config['wc_auth_user'] ?? '' ) );
	// WP app passwords are often displayed with spaces; strip all whitespace.
	$auth_pass = preg_replace( '/\s+/', '', (string) ( $config['wc_auth_pass'] ?? '' ) );
	if ( '' !== $auth_user && '' !== $auth_pass ) {
		return 'Basic ' . base64_encode( $auth_user . ':' . $auth_pass ); // phpcs:ignore WordPress.PHP.DiscouragedPHPFunctions.obfuscation_base64_encode
	}

	return '';
}

/**
 * Resolve a WC REST path to an absolute URL.
 */
function dtb_wc_url( string $path ): string {
	$normalized = ltrim( $path, '/' );
	$base       = rtrim( home_url( '/wp-json' ), '/' );
	return $base . '/' . $normalized;
}

/**
 * GET a WC endpoint with transient caching via dtb_cached_proxy().
 *
 * Cache key and TTL are managed by dtb_cached_proxy() in dtb-cache.php.
 *
 * @param string $wc_path  WC REST path, e.g. 'wc/v3/products'
 * @param array  $params   Query parameters forwarded verbatim.
 * @return WP_REST_Response
 */
function dtb_cached_wc_get( string $wc_path, array $params ): WP_REST_Response {
	if ( ! dtb_check_origin() ) {
		return new WP_REST_Response( dtb_error_envelope( 'forbidden_origin', 'Origin not allowed.', 403 ), 403 );
	}

	$auth_header = dtb_wc_auth_header();
	if ( '' === $auth_header ) {
		return new WP_REST_Response(
			dtb_error_envelope( 'wc_auth_not_configured', 'Store backend credentials are not configured.', 500 ),
			500
		);
	}

	$rl = dtb_rate_limit_get( $wc_path );
	if ( $rl ) {
		return $rl;
	}

	$result = dtb_cached_proxy( $wc_path, $params, function () use ( $wc_path, $params, $auth_header ) {
		$wc_url = dtb_wc_url( $wc_path );
		if ( ! empty( $params ) ) {
			$wc_url = add_query_arg( $params, $wc_url );
		}

		$raw = wp_remote_get( $wc_url, [
			'headers' => [ 'Authorization' => $auth_header ],
			'timeout' => 15,
		] );

		if ( is_wp_error( $raw ) ) {
			return new WP_Error( 'upstream_error', 'Could not reach the product catalog.', [ 'status' => 502 ] );
		}

		$code = wp_remote_retrieve_response_code( $raw );
		$body = json_decode( wp_remote_retrieve_body( $raw ), true );

		if ( $code < 200 || $code >= 300 ) {
			return new WP_Error( 'upstream_error', 'Product catalog returned an error.', [ 'status' => (int) $code ] );
		}

		return $body;
	} );

	if ( is_wp_error( $result ) ) {
		$status = (int) ( $result->get_error_data()['status'] ?? 502 );
		return new WP_REST_Response(
			dtb_error_envelope( $result->get_error_code(), $result->get_error_message(), $status ),
			$status
		);
	}

	return new WP_REST_Response( $result, 200 );
}

/**
 * POST to a WC endpoint (no caching — mutating).
 */
function dtb_wc_post( string $wc_path, array $body ): WP_REST_Response {
	if ( ! dtb_check_origin() ) {
		return new WP_REST_Response( dtb_error_envelope( 'forbidden_origin', 'Origin not allowed.', 403 ), 403 );
	}

	$auth_header = dtb_wc_auth_header();
	if ( '' === $auth_header ) {
		return new WP_REST_Response(
			dtb_error_envelope( 'wc_auth_not_configured', 'Store backend credentials are not configured.', 500 ),
			500
		);
	}

	$raw = wp_remote_post( dtb_wc_url( $wc_path ), [
		'headers' => [
			'Authorization' => $auth_header,
			'Content-Type'  => 'application/json',
		],
		'body'    => wp_json_encode( $body ),
		'timeout' => 15,
	] );

	if ( is_wp_error( $raw ) ) {
		return new WP_REST_Response(
			dtb_error_envelope( 'upstream_error', 'Could not reach the store backend.', 502 ),
			502
		);
	}

	$code = wp_remote_retrieve_response_code( $raw );
	$data = json_decode( wp_remote_retrieve_body( $raw ), true );

	if ( $code < 200 || $code >= 300 ) {
		return new WP_REST_Response(
			dtb_error_envelope( 'upstream_error', 'Store backend returned an error.', (int) $code ),
			(int) $code
		);
	}

	return new WP_REST_Response( $data, (int) $code );
}

/**
 * GET a WC endpoint without caching (used for order/customer reads).
 */
function dtb_wc_get( string $wc_path, array $params = [] ): WP_REST_Response {
	if ( ! dtb_check_origin() ) {
		return new WP_REST_Response( dtb_error_envelope( 'forbidden_origin', 'Origin not allowed.', 403 ), 403 );
	}

	$auth_header = dtb_wc_auth_header();
	if ( '' === $auth_header ) {
		return new WP_REST_Response(
			dtb_error_envelope( 'wc_auth_not_configured', 'Store backend credentials are not configured.', 500 ),
			500
		);
	}

	$rl = dtb_rate_limit_get( $wc_path );
	if ( $rl ) {
		return $rl;
	}

	$wc_url = dtb_wc_url( $wc_path );
	if ( ! empty( $params ) ) {
		$wc_url = add_query_arg( $params, $wc_url );
	}

	$raw = wp_remote_get( $wc_url, [
		'headers' => [ 'Authorization' => $auth_header ],
		'timeout' => 15,
	] );

	if ( is_wp_error( $raw ) ) {
		return new WP_REST_Response(
			dtb_error_envelope( 'upstream_error', 'Could not reach the store backend.', 502 ),
			502
		);
	}

	$code = wp_remote_retrieve_response_code( $raw );
	$data = json_decode( wp_remote_retrieve_body( $raw ), true );

	if ( $code < 200 || $code >= 300 ) {
		return new WP_REST_Response(
			dtb_error_envelope( 'upstream_error', 'Store backend returned an error.', (int) $code ),
			(int) $code
		);
	}

	return new WP_REST_Response( $data, (int) $code );
}

// =============================================================================
// HELPERS — Rate limiters
// =============================================================================

/**
 * Rate-limit mutating routes: 10 requests per 60 s per IP.
 *
 * @param WP_REST_Request $request Current request (used for context in errors).
 * @param string          $route_key Unique key per route (e.g. 'orders_post').
 * @return WP_REST_Response|null  Response to return immediately, or null to continue.
 */
function dtb_rate_limit( WP_REST_Request $request, string $route_key ): ?WP_REST_Response {
	if ( empty( $_SERVER['REMOTE_ADDR'] ) ) {
		return new WP_REST_Response( dtb_error_envelope( 'bad_request', 'Unable to identify request origin.', 400 ), 400 );
	}
	$ip    = sanitize_text_field( wp_unslash( $_SERVER['REMOTE_ADDR'] ) );
	$key   = 'drywall_rl_' . md5( $ip ) . '_' . md5( $route_key );
	$count = (int) get_transient( $key );
	if ( $count >= 10 ) {
		$resp = new WP_REST_Response(
			dtb_error_envelope( 'rate_limited', 'Too many requests. Please try again later.', 429 ),
			429
		);
		$resp->header( 'Retry-After', '60' );
		return $resp;
	}
	set_transient( $key, $count + 1, 60 );
	return null;
}

/**
 * Rate-limit public GET routes: 100 requests per 60 s per IP.
 *
 * @return WP_REST_Response|null  Response to return immediately, or null to continue.
 */
function dtb_get_public_get_rate_limit_config( string $route_key ): array {
	$normalized = ltrim( strtolower( $route_key ), '/' );

	if ( false !== strpos( $normalized, '/variations' ) ) {
		return [ 'key' => 'products_variations', 'limit' => 300, 'window' => 60 ];
	}

	if ( 0 === strpos( $normalized, 'wc/v3/products/categories' ) ) {
		return [ 'key' => 'products_categories', 'limit' => 180, 'window' => 60 ];
	}

	if ( 0 === strpos( $normalized, 'wc/v3/products/attributes' ) ) {
		return [ 'key' => 'products_attributes', 'limit' => 180, 'window' => 60 ];
	}

	if ( 0 === strpos( $normalized, 'wc/v3/products' ) ) {
		return [ 'key' => 'products', 'limit' => 240, 'window' => 60 ];
	}

	return [ 'key' => 'public_get', 'limit' => 120, 'window' => 60 ];
}

function dtb_rate_limit_get( string $route_key = 'public_get' ): ?WP_REST_Response {
	$ip = dtb_get_client_ip();
	if ( '0.0.0.0' === $ip ) {
		return new WP_REST_Response( dtb_error_envelope( 'bad_request', 'Unable to identify request origin.', 400 ), 400 );
	}

	$config = dtb_get_public_get_rate_limit_config( $route_key );
	$key    = 'drywall_rl_get_' . md5( $ip ) . '_' . md5( $config['key'] );
	$count  = (int) get_transient( $key );
	if ( $count >= $config['limit'] ) {
		$resp = new WP_REST_Response(
			dtb_error_envelope( 'rate_limited', 'Too many requests. Please try again later.', 429 ),
			429
		);
		$resp->header( 'Retry-After', (string) $config['window'] );
		return $resp;
	}
	set_transient( $key, $count + 1, $config['window'] );
	return null;
}

// =============================================================================
// HELPERS — App-password rate limiter
// =============================================================================

/**
 * Rate-limit the create-app-password endpoint: 5 attempts per IP per 5 min.
 *
 * @return WP_REST_Response|null 429 response to return, or null to proceed.
 */
function dtb_app_password_rate_limit(): ?WP_REST_Response {
	if ( empty( $_SERVER['REMOTE_ADDR'] ) ) {
		return new WP_REST_Response(
			dtb_error_envelope( 'bad_request', 'Unable to identify request origin.', 400 ),
			400
		);
	}
	$ip    = sanitize_text_field( wp_unslash( $_SERVER['REMOTE_ADDR'] ) );
	$key   = 'dtb_app_pw_rl_' . md5( $ip );
	$count = (int) get_transient( $key );
	if ( $count >= 5 ) {
		$resp = new WP_REST_Response(
			dtb_error_envelope( 'rate_limited', 'Too many requests. Please try again later.', 429 ),
			429
		);
		$resp->header( 'Retry-After', '300' );
		return $resp;
	}
	set_transient( $key, $count + 1, 300 );
	return null;
}

// =============================================================================
// ROUTE CALLBACKS — drywall/v1 proxy
// =============================================================================

/**
 * Fields to request from the WC REST API for the /detail endpoint response.
 * Extracted as a constant to avoid the 500-character inline string and allow
 * reuse if a similar full-product fetch is needed elsewhere.
 */
const DTB_PRODUCT_DETAIL_FIELDS = 'id,name,slug,permalink,type,status,featured,catalog_visibility,description,short_description,sku,price,regular_price,sale_price,on_sale,purchasable,manage_stock,stock_quantity,backorders,backorders_allowed,backordered,sold_individually,weight,dimensions,shipping_required,shipping_class,shipping_class_id,reviews_allowed,average_rating,rating_count,upsell_ids,cross_sell_ids,parent_id,categories,brands,tags,images,attributes,default_attributes,variations,menu_order,price_html,related_ids,stock_status,has_options,meta_data';

/**
 * Fields returned by the variation endpoints.
 *
 * Limits WooCommerce object hydration to fields the SPA actually needs.
 * Without _fields, WC fully hydrates variations including all meta,
 * shipping classes, and downloadable data — expensive / OOM on shared hosting.
 */
const DTB_VARIATION_FIELDS = 'id,sku,slug,name,type,status,price,regular_price,sale_price,on_sale,purchasable,stock_status,manage_stock,stock_quantity,backorders_allowed,backordered,images,attributes,parent_id';

/** GET /drywall/v1/products */
function dtb_proxy_products( WP_REST_Request $request ): WP_REST_Response {
	$allowed = [ 'page', 'per_page', 'category', 'search', 'orderby', 'order', 'min_price', 'max_price', 'stock_status', 'sku' ];
	$allowed[] = 'parent';
	$params  = [];
	foreach ( $allowed as $k ) {
		$v = $request->get_param( $k );
		if ( null !== $v ) {
			$params[ $k ] = sanitize_text_field( $v );
		}
	}
	return dtb_cached_wc_get( 'wc/v3/products', $params );
}

/** GET /drywall/v1/products/{id} */
function dtb_proxy_product_by_id( WP_REST_Request $request ): WP_REST_Response {
	return dtb_cached_wc_get(
		'wc/v3/products/' . absint( $request->get_param( 'id' ) ),
		[
			// Limit WC object hydration to fields the SPA actually uses.
			// Without _fields, WC fully hydrates the product including all
			// variation-related structures — OOM on shared hosting for variable products.
			'_fields' => 'id,name,slug,permalink,type,status,featured,catalog_visibility,description,short_description,sku,price,regular_price,sale_price,on_sale,purchasable,total_sales,virtual,downloadable,tax_status,tax_class,manage_stock,stock_quantity,backorders,backorders_allowed,backordered,sold_individually,weight,dimensions,shipping_required,shipping_taxable,shipping_class,shipping_class_id,reviews_allowed,average_rating,rating_count,upsell_ids,cross_sell_ids,parent_id,categories,brands,tags,images,attributes,default_attributes,variations,menu_order,price_html,related_ids,stock_status,has_options,meta_data',
		]
	);
}

/** GET /drywall/v1/products/slug/{slug} */
function dtb_proxy_product_by_slug( WP_REST_Request $request ): WP_REST_Response {
	return dtb_cached_wc_get( 'wc/v3/products', [ 'slug' => sanitize_title( $request->get_param( 'slug' ) ) ] );
}

/**
 * GET /drywall/v1/products/resolve-sku/{sku}
 *
 * Resolves any product SKU — including variation SKUs — to its canonical URL
 * components.  Used by the React /product/:sku legacy route to redirect
 * variation SKUs to the correct /products/{parentSlug}?variant={id} URL.
 *
 * Returns:
 *   { "type": "simple",    "id": N, "slug": "..." }
 *   { "type": "variation", "id": N, "parentId": N, "parentSlug": "..." }
 */
function dtb_proxy_resolve_sku( WP_REST_Request $request ): WP_REST_Response {
	$sku = sanitize_text_field( trim( (string) ( $request->get_param( 'sku' ) ?? '' ) ) );

	if ( '' === $sku || ! function_exists( 'wc_get_product_id_by_sku' ) ) {
		return new WP_REST_Response( dtb_error_envelope( 'not_found', 'Product not found.', 404 ), 404 );
	}

	$product_id = (int) wc_get_product_id_by_sku( $sku );
	if ( $product_id <= 0 ) {
		return new WP_REST_Response( dtb_error_envelope( 'not_found', 'Product not found.', 404 ), 404 );
	}

	$post = get_post( $product_id );
	if ( ! $post ) {
		return new WP_REST_Response( dtb_error_envelope( 'not_found', 'Product not found.', 404 ), 404 );
	}

	if ( 'product_variation' === $post->post_type ) {
		$parent_id   = (int) $post->post_parent;
		$parent_post = $parent_id > 0 ? get_post( $parent_id ) : null;
		$parent_slug = $parent_post ? (string) $parent_post->post_name : '';

		if ( '' === $parent_slug ) {
			return new WP_REST_Response( dtb_error_envelope( 'not_found', 'Parent product not found.', 404 ), 404 );
		}

		return new WP_REST_Response( [
			'type'       => 'variation',
			'id'         => $product_id,
			'parentId'   => $parent_id,
			'parentSlug' => $parent_slug,
		], 200 );
	}

	return new WP_REST_Response( [
		'type' => 'simple',
		'id'   => $product_id,
		'slug' => (string) $post->post_name,
	], 200 );
}

/** GET /drywall/v1/products/{parent_id}/variations/{id} */
function dtb_proxy_product_variation_by_id( WP_REST_Request $request ): WP_REST_Response {
	$parent_id    = absint( $request->get_param( 'parent_id' ) );
	$variation_id = absint( $request->get_param( 'id' ) );
	return dtb_cached_wc_get(
		'wc/v3/products/' . $parent_id . '/variations/' . $variation_id,
		[ '_fields' => DTB_VARIATION_FIELDS ]
	);
}

/** GET /drywall/v1/products/{id}/variations */
function dtb_proxy_product_variations( WP_REST_Request $request ): WP_REST_Response {
	$parent_id = absint( $request->get_param( 'id' ) );
	if ( 0 === $parent_id ) {
		return new WP_REST_Response( dtb_error_envelope( 'invalid_id', 'Invalid product ID.', 400 ), 400 );
	}

	if ( ! dtb_check_origin() ) {
		return new WP_REST_Response( dtb_error_envelope( 'forbidden_origin', 'Origin not allowed.', 403 ), 403 );
	}

	$rl = dtb_rate_limit_get( 'wc/v3/products/' . $parent_id . '/variations' );
	if ( $rl ) {
		return $rl;
	}

	$page_param     = absint( (string) ( $request->get_param( 'page' ) ?? 1 ) );
	$per_page_param = absint( (string) ( $request->get_param( 'per_page' ) ?? 100 ) );
	$page           = max( 1, $page_param );
	$per_page       = max( 1, min( 200, $per_page_param ) );
	$result = dtb_variation_repository_fetch( $parent_id, [
		'page'     => $page,
		'per_page' => $per_page,
	] );
	if ( is_wp_error( $result ) ) {
		$status = (int) ( $result->get_error_data()['status'] ?? 500 );
		return new WP_REST_Response(
			dtb_error_envelope( $result->get_error_code(), $result->get_error_message(), $status ),
			$status
		);
	}

	return new WP_REST_Response( $result['items'], 200 );
}

/**
 * Production diagnostics toggle for variation repository logging.
 */
function dtb_variations_diagnostics_enabled(): bool {
	return (bool) apply_filters( 'dtb_variations_diagnostics_enabled', defined( 'WP_DEBUG_LOG' ) && WP_DEBUG_LOG );
}

/**
 * Diagnostic logging for variation repository behavior.
 */
function dtb_variations_diagnostic_log( string $event, array $context = [] ): void {
	if ( ! dtb_variations_diagnostics_enabled() ) {
		return;
	}

	if ( function_exists( 'dtb_log_cache_event' ) ) {
		dtb_log_cache_event( 'variation_repository_' . $event, $context );
		return;
	}

	error_log( '[DTB Variations] ' . $event . ' ' . wp_json_encode( $context ) );
}

/**
 * Variation repository: single-query fetch + normalization.
 */
function dtb_variation_repository_fetch( int $parent_id, array $args = [] ) {
	global $wpdb;

	$page     = max( 1, absint( $args['page'] ?? 1 ) );
	$per_page = max( 1, min( 200, absint( $args['per_page'] ?? 100 ) ) );
	$offset   = ( $page - 1 ) * $per_page;
	$started  = microtime( true );
	$like_attr = $wpdb->esc_like( 'attribute_' ) . '%';

	try {
		$rows = $wpdb->get_results(
			$wpdb->prepare(
				"SELECT v.ID, v.post_parent, v.post_name, v.post_title, v.post_status, pm.meta_key, pm.meta_value
				 FROM (
				 	SELECT ID, post_parent, post_name, post_title, post_status, menu_order
				 	FROM {$wpdb->posts}
				 	WHERE post_parent = %d
				 	  AND post_type = %s
				 	  AND post_status IN ('publish','private')
				 	ORDER BY menu_order ASC, ID ASC
				 	LIMIT %d OFFSET %d
				 ) v
				 LEFT JOIN {$wpdb->postmeta} pm
				   ON pm.post_id = v.ID
				  AND (
				  	pm.meta_key IN ('_sku','_price','_regular_price','_sale_price','_stock_status','_manage_stock','_stock','_backorders','_thumbnail_id')
				  	OR pm.meta_key LIKE %s
				  )
				 ORDER BY v.menu_order ASC, v.ID ASC",
				$parent_id,
				'product_variation',
				$per_page,
				$offset,
				$like_attr
			),
			ARRAY_A
		);
	} catch ( Throwable $e ) {
		dtb_variations_diagnostic_log( 'query_exception', [
			'parent_id' => $parent_id,
			'page'      => $page,
			'per_page'  => $per_page,
			'message'   => $e->getMessage(),
		] );
		return new WP_Error( 'variation_query_failed', 'Unable to load product variations.', [ 'status' => 500 ] );
	}

	$items = dtb_variation_repository_normalize_rows( $parent_id, is_array( $rows ) ? $rows : [] );
	dtb_variations_diagnostic_log( 'fetch', [
		'parent_id'      => $parent_id,
		'page'           => $page,
		'per_page'       => $per_page,
		'rows'           => is_array( $rows ) ? count( $rows ) : 0,
		'items'          => count( $items ),
		'duration_ms'    => (int) round( ( microtime( true ) - $started ) * 1000 ),
		'memory_peak_mb' => round( memory_get_peak_usage( true ) / 1048576, 2 ),
	] );

	return [
		'items'    => $items,
		'page'     => $page,
		'per_page' => $per_page,
	];
}

/**
 * Return a stable label for an attribute key without letting taxonomy/plugin
 * errors abort the entire variation response.
 */
function dtb_proxy_safe_attribute_label( string $raw_name ): string {
	try {
		$label = wc_attribute_label( $raw_name );
	} catch ( Throwable $e ) {
		$label = '';
	}

	if ( ! is_string( $label ) || '' === trim( $label ) ) {
		$label = ucwords( str_replace( [ '-', '_' ], ' ', $raw_name ) );
	}

	return (string) $label;
}

/**
 * Load only variation attribute meta keys (attribute_*) instead of loading the
 * full postmeta payload, which can be extremely large on malformed records.
 */
function dtb_variation_repository_normalize_rows( int $parent_id, array $rows ): array {
	$bucket = [];

	foreach ( $rows as $row ) {
		$variation_id = absint( $row['ID'] ?? 0 );
		if ( $variation_id <= 0 ) {
			continue;
		}
		if ( ! isset( $bucket[ $variation_id ] ) ) {
			$bucket[ $variation_id ] = [
				'id'         => $variation_id,
				'parent_id'  => $parent_id,
				'name'       => (string) ( $row['post_title'] ?? '' ),
				'slug'       => (string) ( $row['post_name'] ?? '' ),
				'type'       => 'variation',
				'status'     => (string) ( $row['post_status'] ?? 'publish' ),
				'meta'       => [],
				'attributes' => [],
			];
		}

		$meta_key = (string) ( $row['meta_key'] ?? '' );
		if ( '' === $meta_key ) {
			continue;
		}

		$meta_value = (string) ( $row['meta_value'] ?? '' );
		if ( 0 === strpos( $meta_key, 'attribute_' ) ) {
			if ( '' !== trim( $meta_value ) ) {
				$bucket[ $variation_id ]['attributes'][] = dtb_proxy_format_variation_attribute_meta( $meta_key, $meta_value );
			}
			continue;
		}

		$bucket[ $variation_id ]['meta'][ $meta_key ] = $meta_value;
	}

	$items = [];
	foreach ( $bucket as $variation ) {
		$meta         = $variation['meta'];
		$sale_price   = (string) ( $meta['_sale_price'] ?? '' );
		$regular      = (string) ( $meta['_regular_price'] ?? '' );
		$stock_status = (string) ( $meta['_stock_status'] ?? 'instock' );
		$stock_raw    = $meta['_stock'] ?? '';
		$stock_qty    = is_numeric( $stock_raw ) ? (float) $stock_raw : null;
		$backorders   = (string) ( $meta['_backorders'] ?? '' );
		$image_id     = absint( $meta['_thumbnail_id'] ?? 0 );
		$images       = [];
		$image        = null;

		if ( $image_id > 0 ) {
			$src = wp_get_attachment_image_url( $image_id, 'full' );
			if ( is_string( $src ) && '' !== $src ) {
				$image = [
					'id'   => $image_id,
					'src'  => $src,
					'name' => basename( (string) wp_parse_url( $src, PHP_URL_PATH ) ),
					'alt'  => (string) get_post_meta( $image_id, '_wp_attachment_image_alt', true ),
				];
				$images[] = $image;
			}
		}

		$status = (string) ( $variation['status'] ?? 'publish' );
		$items[] = [
			'id'                 => (int) $variation['id'],
			'parent_id'          => (int) $variation['parent_id'],
			'name'               => (string) $variation['name'],
			'slug'               => (string) $variation['slug'],
			'type'               => 'variation',
			'status'             => $status,
			'sku'                => (string) ( $meta['_sku'] ?? '' ),
			'price'              => (string) ( $meta['_price'] ?? '' ),
			'regular_price'      => $regular,
			'sale_price'         => $sale_price,
			'on_sale'            => ( '' !== $sale_price && $sale_price !== $regular ),
			'purchasable'        => 'publish' === $status,
			'stock_status'       => '' !== $stock_status ? $stock_status : 'instock',
			'manage_stock'       => 'yes' === (string) ( $meta['_manage_stock'] ?? '' ),
			'stock_quantity'     => $stock_qty,
			'backorders_allowed' => in_array( $backorders, [ 'yes', 'notify' ], true ),
			'backordered'        => 'notify' === $backorders,
			'images'             => $images,
			'image'              => $image,
			'attributes'         => $variation['attributes'],
		];
	}

	return array_values( $items );
}

/**
 * Convert a raw variation attribute meta key/value pair to the storefront shape.
 */
function dtb_proxy_format_variation_attribute_meta( string $meta_key, string $raw_option ): array {
	$raw_name = preg_replace( '/^attribute_/', '', $meta_key );
	$raw_name = preg_replace( '/^pa_/', '', (string) $raw_name );

	return [
		'id'        => 0,
		'name'      => dtb_proxy_safe_attribute_label( (string) $raw_name ),
		'slug'      => sanitize_title( (string) $raw_name ),
		'option'    => $raw_option,
		'position'  => 0,
		'visible'   => true,
		'variation' => true,
	];
}

/** GET /drywall/v1/categories */
function dtb_proxy_categories( WP_REST_Request $request ): WP_REST_Response {
	$params = [];
	foreach ( [ 'page', 'per_page', 'parent' ] as $k ) {
		$v = $request->get_param( $k );
		if ( null !== $v ) {
			$params[ $k ] = sanitize_text_field( $v );
		}
	}
	return dtb_cached_wc_get( 'wc/v3/products/categories', $params );
}

/** GET /drywall/v1/attributes */
function dtb_proxy_attributes( WP_REST_Request $request ): WP_REST_Response {
	return dtb_cached_wc_get( 'wc/v3/products/attributes', [] );
}

/** GET /drywall/v1/search?q={query} */
function dtb_proxy_search( WP_REST_Request $request ): WP_REST_Response {
	$q = sanitize_text_field( $request->get_param( 'q' ) ?? '' );
	if ( '' === $q ) {
		return new WP_REST_Response( dtb_error_envelope( 'missing_param', 'Query parameter "q" is required.', 400 ), 400 );
	}
	$params = [ 'search' => $q ];
	foreach ( [ 'page', 'per_page' ] as $k ) {
		$v = $request->get_param( $k );
		if ( null !== $v ) {
			$params[ $k ] = sanitize_text_field( $v );
		}
	}
	return dtb_cached_wc_get( 'wc/v3/products', $params );
}

/** GET /drywall/v1/search/variation-sku?q={query} */
function dtb_proxy_search_variation_sku( WP_REST_Request $request ): WP_REST_Response {
	$q = strtoupper( trim( sanitize_text_field( (string) ( $request->get_param( 'q' ) ?? '' ) ) ) );
	if ( '' === $q ) {
		return new WP_REST_Response( dtb_error_envelope( 'missing_param', 'Query parameter "q" is required.', 400 ), 400 );
	}

	// Guard against expensive wildcard scans on 1-char probes.
	if ( strlen( $q ) < 2 ) {
		return new WP_REST_Response( [], 200 );
	}

	if ( ! dtb_check_origin() ) {
		return new WP_REST_Response( dtb_error_envelope( 'forbidden_origin', 'Origin not allowed.', 403 ), 403 );
	}

	$rl = dtb_rate_limit_get( 'wc/v3/products/variations/sku-search' );
	if ( $rl ) {
		return $rl;
	}

	$limit = absint( $request->get_param( 'limit' ) ?? 24 );
	$limit = max( 1, min( 100, $limit ) );

	global $wpdb;
	$like = '%' . $wpdb->esc_like( $q ) . '%';
	$sql  = $wpdb->prepare(
		"SELECT DISTINCT p.post_parent AS parent_id
		FROM {$wpdb->posts} p
		INNER JOIN {$wpdb->postmeta} pm ON pm.post_id = p.ID AND pm.meta_key = '_sku'
		INNER JOIN {$wpdb->posts} parent ON parent.ID = p.post_parent
		WHERE p.post_type = 'product_variation'
		AND p.post_status IN ('publish', 'private')
		AND parent.post_type = 'product'
		AND parent.post_status = 'publish'
		AND UPPER(pm.meta_value) LIKE %s
		ORDER BY parent_id ASC
		LIMIT %d",
		$like,
		$limit
	);

	$parent_ids = array_values( array_filter( array_map( 'absint', (array) $wpdb->get_col( $sql ) ) ) );
	if ( empty( $parent_ids ) ) {
		return new WP_REST_Response( [], 200 );
	}

	return dtb_cached_wc_get( 'wc/v3/products', [
		'include'  => implode( ',', $parent_ids ),
		'orderby'  => 'include',
		'per_page' => count( $parent_ids ),
		'status'   => 'publish',
	] );
}

/** POST /drywall/v1/orders  (JWT-gated, rate-limited) */
function dtb_proxy_create_order( WP_REST_Request $request ): WP_REST_Response {
	$rl = dtb_rate_limit( $request, 'orders_post' );
	if ( $rl ) {
		return $rl;
	}
	$body = $request->get_json_params();
	if ( empty( $body ) ) {
		return new WP_REST_Response( dtb_error_envelope( 'invalid_body', 'Request body must be valid JSON.', 400 ), 400 );
	}
	return dtb_wc_post( 'wc/v3/orders', $body );
}

/** GET /drywall/v1/orders/{id}  (JWT-gated) */
function dtb_proxy_get_order( WP_REST_Request $request ): WP_REST_Response {
	return dtb_wc_get( 'wc/v3/orders/' . absint( $request->get_param( 'id' ) ) );
}

/**
 * GET /drywall/v1/orders  (JWT-gated — customer's own order list)
 *
 * Supported query params: page, per_page, customer (WC customer ID).
 * The SPA must always pass the authenticated user's customer ID so WC only
 * returns orders belonging to that customer (no cross-customer data leakage).
 */
function dtb_proxy_get_orders( WP_REST_Request $request ): WP_REST_Response {
	$allowed = [ 'page', 'per_page', 'customer', 'status', 'orderby', 'order' ];
	$params  = [];
	foreach ( $allowed as $k ) {
		$v = $request->get_param( $k );
		if ( null !== $v ) {
			$params[ $k ] = sanitize_text_field( $v );
		}
	}

	// Safety guard: require a customer filter — never return an unfiltered order list.
	if ( empty( $params['customer'] ) ) {
		return new WP_REST_Response(
			dtb_error_envelope( 'missing_param', 'customer parameter is required.', 400 ),
			400
		);
	}

	return dtb_wc_get( 'wc/v3/orders', $params );
}

/** GET /drywall/v1/coupons/{code} */
function dtb_proxy_coupon( WP_REST_Request $request ): WP_REST_Response {
	return dtb_wc_get( 'wc/v3/coupons', [ 'code' => sanitize_text_field( $request->get_param( 'code' ) ) ] );
}

/** POST /drywall/v1/customers  (rate-limited) */
function dtb_proxy_create_customer( WP_REST_Request $request ): WP_REST_Response {
	$rl = dtb_rate_limit( $request, 'customers_post' );
	if ( $rl ) {
		return $rl;
	}
	$body = $request->get_json_params();
	if ( empty( $body ) ) {
		return new WP_REST_Response( dtb_error_envelope( 'invalid_body', 'Request body must be valid JSON.', 400 ), 400 );
	}
	return dtb_wc_post( 'wc/v3/customers', $body );
}

/** GET /drywall/v1/customers/{id}  (JWT-gated) */
function dtb_proxy_get_customer( WP_REST_Request $request ): WP_REST_Response {
	return dtb_wc_get( 'wc/v3/customers/' . absint( $request->get_param( 'id' ) ) );
}

/** POST /drywall/v1/webhooks/products — cache-invalidation receiver */
function dtb_proxy_webhook_products( WP_REST_Request $request ): WP_REST_Response {
	$config = dtb_get_config();
	$secret = $config['webhook_secret'];

	if ( '' === $secret ) {
		return new WP_REST_Response( dtb_error_envelope( 'config_error', 'Webhook secret not configured.', 500 ), 500 );
	}

	$raw_body = $request->get_body();
	$sig      = $request->get_header( 'x_wc_webhook_signature' );

	if ( ! $sig ) {
		return new WP_REST_Response( dtb_error_envelope( 'missing_signature', 'Webhook signature is required.', 401 ), 401 );
	}

	$expected = base64_encode( hash_hmac( 'sha256', $raw_body, $secret, true ) ); // phpcs:ignore WordPress.PHP.DiscouragedPHPFunctions.obfuscation_base64_encode
	if ( ! hash_equals( $expected, $sig ) ) {
		return new WP_REST_Response( dtb_error_envelope( 'invalid_signature', 'Webhook signature mismatch.', 401 ), 401 );
	}

	// Invalidate all drywall cache transients and log the event.
	$payload    = json_decode( $raw_body, true );
	$product_id = isset( $payload['id'] ) ? absint( $payload['id'] ) : 0;

	dtb_invalidate_product_cache();
	dtb_log_cache_event( 'webhook_received', [
		'product_id' => $product_id,
		'topic'      => $request->get_header( 'x_wc_webhook_topic' ) ?? 'product.unknown',
	] );

	return new WP_REST_Response( [ 'success' => true ], 200 );
}

// =============================================================================
// ROUTE CALLBACKS — dtb/v1 management
// =============================================================================

/** GET /dtb/v1/config */
function dtb_route_config(): WP_REST_Response {
	$credentials = dtb_get_wc_credentials();

	$response = rest_ensure_response( [
		'wc_auth_user' => $credentials['auth_user'],
		'wc_auth_pass' => $credentials['auth_pass'],
	] );
	$response->header( 'Cache-Control', 'private, no-store' );
	return $response;
}

/** GET /dtb/v1/catalog */
function dtb_route_catalog(): WP_REST_Response {
	$config = dtb_get_config();
	return rest_ensure_response( [
		'csv_url'       => rest_url( 'dtb/v1/products-csv' ),
		'filename'      => $config['csv_filename'],
		'filenames'     => $config['csv_filenames'],
		'source'        => $config['csv_source'] ?? '',
		'missing'       => $config['csv_missing'] ?? [],
	] );
}

/**
 * GET /dtb/v1/products-csv
 *
 * Streams one or more WooCommerce product CSVs to the browser as a single
 * merged CSV.  When multiple files are configured the header row is taken
 * from the first file only; subsequent files have their header rows stripped
 * so the browser receives a single well-formed CSV document.
 */
function dtb_route_products_csv(): void {
	$config      = dtb_get_config();
	$upload_dir  = wp_upload_dir();
	$uploads_dir = trailingslashit( $upload_dir['basedir'] );
	$filenames   = $config['csv_filenames'];

	// Validate every file before we start streaming so we never send a partial response.
	$file_paths = [];
	foreach ( $filenames as $filename ) {
		$file_path = $uploads_dir . 'wc-imports/' . $filename;
		$real_path    = realpath( $file_path );
		$real_uploads = realpath( $uploads_dir );

		if (
			false === $real_path ||
			false === $real_uploads ||
			0 !== strpos( $real_path, trailingslashit( $real_uploads ) ) ||
			! file_exists( $real_path )
		) {
			wp_send_json_error( dtb_error_envelope( 'csv_not_found', 'Product CSV file not found: ' . $filename, 404 ), 404 );
		}
		$file_paths[] = $real_path;
	}

	$raw_origin = isset( $_SERVER['HTTP_ORIGIN'] )
		? (string) wp_unslash( $_SERVER['HTTP_ORIGIN'] ) // phpcs:ignore WordPress.Security.ValidatedSanitizedInput.InputNotSanitized
		: '';

	// Use the first filename for the Content-Disposition header.
	$display_name = count( $filenames ) === 1 ? $filenames[0] : 'wp-catalog-merged.csv';

	header( 'Content-Type: text/csv; charset=UTF-8' );
	header( 'Content-Disposition: inline; filename="' . $display_name . '"' );
	header( 'Cache-Control: public, max-age=3600' );

	if ( $raw_origin && in_array( rtrim( $raw_origin, '/' ), dtb_allowed_origins(), true ) ) {
		header( 'Access-Control-Allow-Origin: ' . esc_url_raw( $raw_origin ) );
		header( 'Vary: Origin' );
	}

	$first = true;
	foreach ( $file_paths as $path ) {
		$handle = fopen( $path, 'rb' ); // phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_fopen
		if ( false === $handle ) {
			continue;
		}
		if ( $first ) {
			// Output the first file in full (header row included).
			// phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_fpassthru
			fpassthru( $handle );
			$first = false;
		} else {
			// Skip the header row of subsequent files so the merged CSV
			// has exactly one header row at the top.
			fgets( $handle ); // discard header line
			// phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_fpassthru
			fpassthru( $handle );
		}
		fclose( $handle ); // phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_fclose
	}
	exit;
}

/** POST /dtb/v1/import-catalog — trigger WC CSV import for all configured files */
function dtb_route_import_catalog( WP_REST_Request $request ) {
	$config   = dtb_get_config();
	$provided = (string) ( $request->get_param( 'secret' ) ?? '' );
	$expected = $config['import_secret'] ?: (string) get_option( 'dtb_import_secret', '' );

	if ( empty( $expected ) || ! hash_equals( $expected, $provided ) ) {
		return new WP_Error( 'forbidden', 'Invalid or missing import secret.', [ 'status' => 403 ] );
	}

	$upload_dir  = wp_upload_dir();
	$uploads_dir = trailingslashit( $upload_dir['basedir'] );
	$filenames   = $config['csv_filenames'];

	// Validate all files exist before scheduling anything.
	$file_paths = [];
	foreach ( $filenames as $filename ) {
		$file_path = $uploads_dir . 'wc-imports/' . $filename;
		if ( ! file_exists( $file_path ) ) {
			return new WP_Error(
				'csv_not_found',
				'Product CSV not found: ' . $filename . '. Ensure the deploy step has uploaded it to wc-imports/.',
				[ 'status' => 404 ]
			);
		}
		$file_paths[] = $file_path;
	}

	// Use Action Scheduler when available — schedule one job per file.
	if ( function_exists( 'as_unschedule_all_actions' ) && function_exists( 'as_schedule_single_action' ) ) {
		as_unschedule_all_actions( 'dtb_run_catalog_import', [], 'dtb-catalog-sync' );
		$action_ids = [];
		foreach ( $file_paths as $file_path ) {
			$action_ids[] = as_schedule_single_action( time(), 'dtb_run_catalog_import', [ $file_path ], 'dtb-catalog-sync' );
		}
		return rest_ensure_response( [
			'status'     => 'scheduled',
			'action_ids' => $action_ids,
			'files'      => array_map( 'basename', $file_paths ),
			'message'    => count( $file_paths ) . ' WooCommerce product import(s) scheduled as background jobs.',
		] );
	}

	// No Action Scheduler — schedule background WP-Cron events instead of
	// running the heavy import synchronously. This keeps the REST route
	// fast and avoids proxy timeouts (Cloudflare 524). Note: WP-Cron must
	// be enabled (either via real traffic or a system cron calling
	// wp-cron.php) for the jobs to run.
	$scheduled = [];
	foreach ( $file_paths as $file_path ) {
		// Avoid duplicate scheduling for the same file.
		if ( ! wp_next_scheduled( 'dtb_run_catalog_import_wpcron', [ $file_path ] ) ) {
			wp_schedule_single_event( time() + 5, 'dtb_run_catalog_import_wpcron', [ $file_path ] );
			$scheduled[] = basename( $file_path );
		}
	}

	return rest_ensure_response( [
		'status'  => 'scheduled',
		'files'   => $scheduled,
		'message' => count( $scheduled ) . ' WooCommerce product import(s) scheduled via WP-Cron. Ensure WP-Cron is running (system cron or background runner).',
	] );
}

/** POST /dtb/v1/create-app-password */
function dtb_route_create_app_password( WP_REST_Request $request ): WP_REST_Response {
	$rl = dtb_app_password_rate_limit();
	if ( $rl ) {
		return $rl;
	}

	try {
		$username = sanitize_user( $request->get_param( 'username' ) );
		$password = $request->get_param( 'password' );
		$app_name = sanitize_text_field( $request->get_param( 'app_name' ) ) ?: 'Drywall Toolbox';

		if ( empty( $username ) || empty( $password ) ) {
			return new WP_REST_Response(
				dtb_error_envelope( 'missing_credentials', 'Username and password are required.', 400 ),
				400
			);
		}

		$user = wp_authenticate( $username, $password );

		if ( ! $user || is_wp_error( $user ) ) {
			return new WP_REST_Response(
				dtb_error_envelope( 'invalid_credentials', 'Invalid username or password.', 401 ),
				401
			);
		}

		if ( ! class_exists( 'WP_Application_Passwords' ) ) {
			require_once ABSPATH . 'wp-includes/class-wp-application-passwords.php';
		}

		$result = WP_Application_Passwords::create_new_application_password(
			$user->ID,
			[ 'name' => $app_name ]
		);

		if ( is_wp_error( $result ) ) {
			return new WP_REST_Response(
				dtb_error_envelope( 'create_failed', $result->get_error_message(), 500 ),
				500
			);
		}

		$password_string = $result[0] ?? '';

		if ( empty( $password_string ) ) {
			return new WP_REST_Response(
				dtb_error_envelope( 'empty_password', 'Application password was created but the string is empty.', 500 ),
				500
			);
		}

		return new WP_REST_Response( [
			'success'  => true,
			'message'  => 'Application password created successfully.',
			'username' => $username,
			'password' => $password_string,
			'app_name' => $app_name,
			'note'     => 'Use these credentials for WooCommerce REST API access. Password will not be shown again.',
		], 200 );

	} catch ( Exception $e ) {
		return new WP_REST_Response(
			dtb_error_envelope( 'server_error', $e->getMessage(), 500 ),
			500
		);
	}
}

/** POST /dtb/v1/webhooks/ensure */
function dtb_route_ensure_webhooks( WP_REST_Request $request ): WP_REST_Response {
	if ( ! function_exists( 'dtb_wc_ensure_webhooks' ) ) {
		return new WP_REST_Response(
			dtb_error_envelope( 'not_available', 'Webhook creation is not available on this site.', 500 ),
			500
		);
	}

	$result = dtb_wc_ensure_webhooks();

	if ( ! is_array( $result ) ) {
		return new WP_REST_Response(
			dtb_error_envelope( 'unexpected_result', 'Webhook creation returned an unexpected result.', 500 ),
			500
		);
	}

	if ( isset( $result['status'] ) && 'completed' !== $result['status'] ) {
		return new WP_REST_Response( [
			'success'  => false,
			'message'  => 'Webhook creation skipped or failed.',
			'result'   => $result,
		], 200 );
	}

	return new WP_REST_Response( [
		'success'  => true,
		'message'  => 'Webhook creation completed.',
		'result'   => $result,
	], 200 );
}

/** Permission callback for POST /dtb/v1/webhooks/ensure */
function dtb_route_ensure_webhooks_permission( WP_REST_Request $request ): bool {
	if ( current_user_can( 'manage_woocommerce' ) || current_user_can( 'manage_options' ) ) {
		return true;
	}

	$secret = $request->get_param( 'secret' );
	if ( ! empty( $secret ) && defined( 'WC_WEBHOOK_SECRET' ) ) {
		return hash_equals( (string) WC_WEBHOOK_SECRET, trim( (string) $secret ) );
	}

	$header_secret = $request->get_header( 'x-wc-webhook-secret' );
	if ( ! empty( $header_secret ) && defined( 'WC_WEBHOOK_SECRET' ) ) {
		return hash_equals( (string) WC_WEBHOOK_SECRET, trim( (string) $header_secret ) );
	}

	return false;
}

/** GET /wc-admin/profile — shim to suppress core-profiler crash */
function dtb_route_wc_admin_profile(): WP_REST_Response {
	return rest_ensure_response( [
		'title'               => 'Drywall Toolbox',
		'industries'          => [ [ 'slug' => 'retail' ] ],
		'products'            => [],
		'business_extensions' => [],
		'completed'           => true,
		'skipped'             => true,
	] );
}

// =============================================================================
// CATALOG IMPORT — Action Scheduler callback + sync runner
// (shared between the REST endpoint and background processing)
// =============================================================================

add_action( 'dtb_run_catalog_import', function ( string $file_path ): void {
	dtb_run_catalog_import_sync( $file_path );
} );

// Fallback WP-Cron action: runs when wp_schedule_single_event fires.
add_action( 'dtb_run_catalog_import_wpcron', function ( string $file_path ): void {
    dtb_run_catalog_import_sync( $file_path );
} );

/**
 * Run a WooCommerce CSV product import synchronously.
 *
 * @param string $file_path Absolute server path to the CSV.
 * @return WP_REST_Response|WP_Error
 */
function dtb_run_catalog_import_sync( string $file_path ) {
	// Raise execution-time and memory limits for large CSV imports.
	// This function is invoked either by Action Scheduler (dtb_run_catalog_import)
	// or directly from dtb_route_import_catalog when Action Scheduler is unavailable.
	// The admin_init hook in dtb-woocommerce.php only covers WC admin AJAX actions
	// and does NOT cover this code path.
	if ( function_exists( 'set_time_limit' ) ) {
		set_time_limit( 300 );
	}
	if ( function_exists( 'ini_set' ) ) {
		ini_set( 'memory_limit', '512M' ); // phpcs:ignore WordPress.PHP.IniSet.memory_limit_Blacklisted
	}

	if ( ! file_exists( $file_path ) ) {
		return new WP_Error( 'csv_not_found', 'CSV file not found: ' . basename( $file_path ), [ 'status' => 404 ] );
	}

	if ( ! defined( 'WC_ABSPATH' ) ) {
		return new WP_Error( 'wc_not_loaded', 'WooCommerce is not loaded.', [ 'status' => 500 ] );
	}

	if ( ! class_exists( 'WC_Product_CSV_Importer' ) ) {
		$importer_file = WC_ABSPATH . 'includes/import/class-wc-product-csv-importer.php';
		if ( ! file_exists( $importer_file ) ) {
			return new WP_Error( 'importer_not_found', 'WooCommerce CSV importer class not available.', [ 'status' => 500 ] );
		}
		require_once $importer_file;
	}

	$importer = new WC_Product_CSV_Importer( $file_path, [
		'update_existing'    => true,
		'character_encoding' => '',
		'lines'              => -1,
		'mapping'            => [],
		'parse'              => true,
	] );
	$results = $importer->import();

	do_action( 'woocommerce_product_import_end' );
	wc_delete_product_transients();

	return rest_ensure_response( [
		'status'   => 'completed',
		'file'     => basename( $file_path ),
		'imported' => (int) ( $results['imported'] ?? 0 ),
		'updated'  => (int) ( $results['updated']  ?? 0 ),
		'skipped'  => (int) ( $results['skipped']  ?? 0 ),
		'failed'   => (int) ( $results['failed']   ?? 0 ),
	] );
}

// =============================================================================
// CONTACT FORM
// =============================================================================

/**
 * POST /dtb/v1/contact
 *
 * Accepts a public contact form submission and delivers it to the support
 * inbox via wp_mail().  Rate-limited to 5 submissions per 60 s per IP to
 * prevent abuse.
 *
 * Expected JSON body:
 *   { name, email, inquiry_type, message }
 *
 * Success: HTTP 200  { success: true, message: '...' }
 * Errors:
 *   422 — validation failure (invalid email, empty message)
 *   429 — rate limit exceeded
 *
 * @param WP_REST_Request $request Incoming request.
 * @return WP_REST_Response
 */
function dtb_contact_form_handler( WP_REST_Request $request ): WP_REST_Response {
	// ── Rate limit: 5 submissions per 60 s per IP ────────────────────────────
	$ip  = dtb_get_client_ip();
	$key = 'dtb_contact_' . md5( $ip );
	$count = (int) get_transient( $key );
	if ( $count >= 5 ) {
		$resp = new WP_REST_Response(
			dtb_error_envelope( 'rate_limited', 'Too many submissions. Please wait a moment and try again.', 429 ),
			429
		);
		$resp->header( 'Retry-After', '60' );
		return $resp;
	}
	set_transient( $key, $count + 1, 60 );

	// ── Input retrieval ───────────────────────────────────────────────────────
	$name         = sanitize_text_field( (string) $request->get_param( 'name' ) );
	$email        = sanitize_email( (string) $request->get_param( 'email' ) );
	$inquiry_type = sanitize_text_field( (string) ( $request->get_param( 'inquiry_type' ) ?: 'General Question' ) );
	$message      = sanitize_textarea_field( (string) $request->get_param( 'message' ) );

	// ── Validation ────────────────────────────────────────────────────────────
	if ( empty( $name ) ) {
		return new WP_REST_Response(
			dtb_error_envelope( 'missing_name', 'Please provide your name.', 422 ),
			422
		);
	}

	if ( ! is_email( $email ) ) {
		return new WP_REST_Response(
			dtb_error_envelope( 'invalid_email', 'Please provide a valid email address.', 422 ),
			422
		);
	}

	if ( empty( $message ) ) {
		return new WP_REST_Response(
			dtb_error_envelope( 'missing_message', 'Please provide a message.', 422 ),
			422
		);
	}

	// ── Build and send email ──────────────────────────────────────────────────
	$site_name = get_bloginfo( 'name' ) ?: 'Drywall Toolbox';
	$to        = 'info@drywalltoolbox.com';
	$subject   = sprintf( '[%s Contact] %s — %s', $site_name, $inquiry_type, $name );

	$body  = "New contact form submission from {$name} <{$email}>.\n\n";
	$body .= "Inquiry type: {$inquiry_type}\n";
	$body .= "---------------------------------------\n\n";
	$body .= $message . "\n\n";
	$body .= "---------------------------------------\n";
	$body .= "Submitted: " . gmdate( 'Y-m-d H:i:s T' ) . "\n";
	$body .= "IP: " . dtb_anonymise_ip( $ip ) . "\n";

	// Strip CR/LF from user-supplied name before using it in a header value to
	// prevent email header injection attacks.
	$safe_name = str_replace( [ "\r", "\n" ], ' ', $name );

	$headers = [
		'Content-Type: text/plain; charset=UTF-8',
		'Reply-To: ' . $safe_name . ' <' . $email . '>',
	];

	if ( function_exists( 'dtb_send_email' ) ) {
		$sent = dtb_send_email(
			[
				'to'           => $to,
				'subject'      => $subject,
				'message'      => $body,
				'headers'      => $headers,
				'content_type' => 'text/plain',
				'context'      => [
					'module' => 'dtb-platform',
					'route'  => 'contact-form',
				],
			]
		);
	} else {
		$sent = wp_mail( $to, $subject, $body, $headers );
	}

	if ( ! $sent ) {
		error_log( '[DTB Contact] wp_mail() failed for submission from ' . dtb_anonymise_ip( $ip ) );
		return new WP_REST_Response(
			dtb_error_envelope( 'mail_failed', 'Unable to send your message. Please email us directly at info@drywalltoolbox.com.', 500 ),
			500
		);
	}

	$response = new WP_REST_Response( [
		'success' => true,
		'message' => 'Your message has been sent. We\'ll get back to you within one business day.',
	], 200 );
	$response->header( 'Cache-Control', 'private, no-store' );
	return $response;
}

// =============================================================================
// PRODUCT DETAIL ENDPOINT — /drywall/v1/products/slug/{slug}/detail
//
// Returns a normalized envelope:
//   { product, variations, computed }
//
// Parent product owns: content, SEO, media, attributes, price range.
// Variations own: price, SKU, stock, image, purchasability, cart identity.
// Computed state: default/first-purchasable variation IDs, price range,
//                 stock summary, available option matrix.
// =============================================================================

/**
 * GET /drywall/v1/products/slug/{slug}/detail
 *
 * Fetches the parent product by slug and all its child variations in two
 * server-side WC REST calls, normalises both into frontend-safe objects,
 * computes derived state, and returns them in a single response.
 *
 * The response is cached at the same TTL as other product proxy routes
 * (600 s default) via dtb_cached_proxy(), with the same webhook-triggered
 * invalidation path that clears all drywall_cache_* transients.
 */
function dtb_proxy_product_detail( WP_REST_Request $request ): WP_REST_Response {
	if ( ! dtb_check_origin() ) {
		return new WP_REST_Response( dtb_error_envelope( 'forbidden_origin', 'Origin not allowed.', 403 ), 403 );
	}

	$rl = dtb_rate_limit_get( 'wc/v3/products' );
	if ( $rl ) {
		return $rl;
	}

	$slug = sanitize_title( $request->get_param( 'slug' ) );
	if ( '' === $slug ) {
		return new WP_REST_Response( dtb_error_envelope( 'invalid_slug', 'Product slug is required.', 400 ), 400 );
	}

	// ── Step 1: Fetch parent product by slug ──────────────────────────────────

	$parent_fields = DTB_PRODUCT_DETAIL_FIELDS;

	$cache_key_parent = 'wc/v3/products_slug_' . $slug;

	$product_data = dtb_cached_proxy( $cache_key_parent, [ 'slug' => $slug, '_fields' => $parent_fields ], function () use ( $slug, $parent_fields ) {
		$wc_url = add_query_arg(
			[ 'slug' => $slug, '_fields' => $parent_fields ],
			dtb_wc_url( 'wc/v3/products' )
		);
		$raw = wp_remote_get( $wc_url, [
			'headers' => [ 'Authorization' => dtb_wc_auth_header() ],
			'timeout' => 15,
		] );
		if ( is_wp_error( $raw ) ) {
			return new WP_Error( 'upstream_error', 'Could not reach the product catalog.', [ 'status' => 502 ] );
		}
		$code = wp_remote_retrieve_response_code( $raw );
		$body = json_decode( wp_remote_retrieve_body( $raw ), true );
		if ( $code < 200 || $code >= 300 ) {
			return new WP_Error( 'upstream_error', 'Product catalog returned an error.', [ 'status' => (int) $code ] );
		}
		return $body;
	} );

	if ( is_wp_error( $product_data ) ) {
		$status = (int) ( $product_data->get_error_data()['status'] ?? 502 );
		return new WP_REST_Response( dtb_error_envelope( $product_data->get_error_code(), $product_data->get_error_message(), $status ), $status );
	}

	if ( ! is_array( $product_data ) || empty( $product_data ) ) {
		return new WP_REST_Response( dtb_error_envelope( 'not_found', 'Product not found.', 404 ), 404 );
	}

	// WC ?slug= returns an array; take the first match.
	$product = is_array( $product_data[0] ?? null ) ? $product_data[0] : ( is_array( $product_data ) && isset( $product_data['id'] ) ? $product_data : null );
	if ( ! $product ) {
		return new WP_REST_Response( dtb_error_envelope( 'not_found', 'Product not found.', 404 ), 404 );
	}

	$product_id   = absint( $product['id'] ?? 0 );
	$product_type = strtolower( $product['type'] ?? 'simple' );

	// ── Step 2: Fetch child variations (only for variable products) ───────────

	$variations = [];

	if ( 'variable' === $product_type && $product_id > 0 ) {
		$var_cache_key = 'variation_repository_product_' . $product_id;
		$variations_raw = dtb_cached_proxy( $var_cache_key, [ 'page' => 1, 'per_page' => 200 ], function () use ( $product_id ) {
			$result = dtb_variation_repository_fetch( $product_id, [ 'page' => 1, 'per_page' => 200 ] );
			if ( is_wp_error( $result ) ) {
				dtb_variations_diagnostic_log( 'detail_repository_error', [
					'product_id' => $product_id,
					'code'       => $result->get_error_code(),
					'message'    => $result->get_error_message(),
				] );
				return [];
			}
			return (array) ( $result['items'] ?? [] );
		} );

		$variations = is_array( $variations_raw ) ? array_values( $variations_raw ) : [];
	}

	// ── Step 3: Normalize product ─────────────────────────────────────────────

	$normalized_product = dtb_normalize_detail_product( $product, $variations );

	// ── Step 4: Normalize variations ──────────────────────────────────────────

	$normalized_variations = array_map( 'dtb_normalize_detail_variation', $variations );

	// ── Step 5: Compute derived state ─────────────────────────────────────────

	$computed = dtb_compute_variation_state( $normalized_product, $normalized_variations );

	$envelope = [
		'product'    => $normalized_product,
		'variations' => $normalized_variations,
		'computed'   => $computed,
	];

	return new WP_REST_Response( $envelope, 200 );
}

/**
 * Normalize a raw WooCommerce product object for the detail endpoint.
 *
 * @param array $p    Raw WC product array.
 * @param array $vars Raw WC variation arrays (used to compute price range).
 * @return array      Normalized product shape.
 */
function dtb_normalize_detail_product( array $p, array $vars ): array {
	// Extract brand from brands array (Brands for WooCommerce plugin) or meta_data.
	$brand = '';
	$brands_raw = $p['brands'] ?? [];
	if ( ! empty( $brands_raw ) && is_array( $brands_raw ) ) {
		$brand = $brands_raw[0]['name'] ?? '';
	}
	if ( ! $brand ) {
		foreach ( (array) ( $p['meta_data'] ?? [] ) as $meta ) {
			if ( in_array( $meta['key'] ?? '', [ '_brand', 'pa_brand', 'brand' ], true ) ) {
				$brand = (string) ( $meta['value'] ?? '' );
				break;
			}
		}
	}

	// Price range from variations.
	$prices = [];
	foreach ( $vars as $v ) {
		$price = (string) ( $v['price'] ?? '' );
		if ( '' !== $price && is_numeric( $price ) ) {
			$prices[] = (float) $price;
		}
	}
	// Fall back to product price fields when no variation prices.
	if ( empty( $prices ) ) {
		foreach ( [ 'price', 'regular_price', 'sale_price' ] as $field ) {
			$val = (string) ( $p[ $field ] ?? '' );
			if ( '' !== $val && is_numeric( $val ) ) {
				$prices[] = (float) $val;
			}
		}
	}

	$price_min = ! empty( $prices ) ? (string) number_format( min( $prices ), 2, '.', '' ) : '';
	$price_max = ! empty( $prices ) ? (string) number_format( max( $prices ), 2, '.', '' ) : '';

	// Extract MPN and barcode from meta_data.
	$mpn = '';
	$barcode = '';
	foreach ( (array) ( $p['meta_data'] ?? [] ) as $meta ) {
		switch ( $meta['key'] ?? '' ) {
			case '_mpn':
			case 'mpn':
			case 'schema_mpn':
			case 'meta:schema_mpn':
				if ( ! $mpn ) $mpn = (string) ( $meta['value'] ?? '' );
				break;
			case '_barcode':
			case 'barcode':
			case '_upc':
			case 'upc':
				if ( ! $barcode ) $barcode = (string) ( $meta['value'] ?? '' );
				break;
		}
	}

	// Build stock summary.
	$has_instock    = false;
	$has_backorder  = false;
	$has_outofstock = false;
	foreach ( $vars as $v ) {
		$status = $v['stock_status'] ?? 'outofstock';
		if ( 'instock' === $status )      $has_instock    = true;
		if ( 'onbackorder' === $status )  $has_backorder  = true;
		if ( 'outofstock' === $status )   $has_outofstock = true;
	}

	return [
		'id'                 => (int) ( $p['id'] ?? 0 ),
		'type'               => (string) ( $p['type'] ?? 'simple' ),
		'slug'               => (string) ( $p['slug'] ?? '' ),
		'name'               => (string) ( $p['name'] ?? '' ),
		'brand'              => $brand,
		'sku'                => (string) ( $p['sku'] ?? '' ),
		'mpn'                => $mpn,
		'barcode'            => $barcode,
		'description'        => (string) ( $p['description'] ?? '' ),
		'short_description'  => (string) ( $p['short_description'] ?? '' ),
		'categories'         => (array) ( $p['categories'] ?? [] ),
		'tags'               => (array) ( $p['tags'] ?? [] ),
		'images'             => (array) ( $p['images'] ?? [] ),
		'attributes'         => (array) ( $p['attributes'] ?? [] ),
		'default_attributes' => (array) ( $p['default_attributes'] ?? [] ),
		'price'              => (string) ( $p['price'] ?? '' ),
		'regular_price'      => (string) ( $p['regular_price'] ?? '' ),
		'sale_price'         => (string) ( $p['sale_price'] ?? '' ),
		'on_sale'            => (bool) ( $p['on_sale'] ?? false ),
		'price_min'          => $price_min,
		'price_max'          => $price_max,
		'stock_status'       => (string) ( $p['stock_status'] ?? 'instock' ),
		'stock_quantity'     => isset( $p['stock_quantity'] ) ? (int) $p['stock_quantity'] : null,
		'manage_stock'       => (bool) ( $p['manage_stock'] ?? false ),
		'backorders_allowed' => (bool) ( $p['backorders_allowed'] ?? false ),
		'purchasable'        => (bool) ( $p['purchasable'] ?? true ),
		'related_ids'        => (array) ( $p['related_ids'] ?? [] ),
		'upsell_ids'         => (array) ( $p['upsell_ids'] ?? [] ),
		'cross_sell_ids'     => (array) ( $p['cross_sell_ids'] ?? [] ),
		'average_rating'     => (string) ( $p['average_rating'] ?? '0' ),
		'rating_count'       => (int) ( $p['rating_count'] ?? 0 ),
		'permalink'          => (string) ( $p['permalink'] ?? '' ),
		'meta_data'          => (array) ( $p['meta_data'] ?? [] ),
		'stock_summary'      => [
			'has_instock'    => $has_instock,
			'has_backorder'  => $has_backorder,
			'has_outofstock' => $has_outofstock,
		],
	];
}

/**
 * Normalize a raw WooCommerce variation object for the detail endpoint.
 *
 * @param array $v Raw WC variation array.
 * @return array   Normalized variation shape.
 */
function dtb_normalize_detail_variation( array $v ): array {
	// Extract MPN and barcode from meta_data.
	$mpn = '';
	$barcode = '';
	foreach ( (array) ( $v['meta_data'] ?? [] ) as $meta ) {
		switch ( $meta['key'] ?? '' ) {
			case '_mpn':
			case 'mpn':
			case 'schema_mpn':
				if ( ! $mpn ) $mpn = (string) ( $meta['value'] ?? '' );
				break;
			case '_barcode':
			case 'barcode':
			case '_upc':
			case 'upc':
				if ( ! $barcode ) $barcode = (string) ( $meta['value'] ?? '' );
				break;
		}
	}

	// Build variation_attribute_values for frontend compatibility.
	$attrs     = (array) ( $v['attributes'] ?? [] );
	$attr_vals = array_map( function ( $attr ) {
		return [
			'id'     => (int) ( $attr['id'] ?? 0 ),
			'name'   => (string) ( $attr['name'] ?? '' ),
			'slug'   => (string) ( $attr['slug'] ?? '' ),
			'option' => (string) ( $attr['option'] ?? '' ),
		];
	}, $attrs );

	return [
		'id'                      => (int) ( $v['id'] ?? 0 ),
		'parent_id'               => (int) ( $v['parent_id'] ?? 0 ),
		'sku'                     => (string) ( $v['sku'] ?? '' ),
		'mpn'                     => $mpn,
		'barcode'                 => $barcode,
		'price'                   => (string) ( $v['price'] ?? '' ),
		'regular_price'           => (string) ( $v['regular_price'] ?? '' ),
		'sale_price'              => (string) ( $v['sale_price'] ?? '' ),
		'on_sale'                 => (bool) ( $v['on_sale'] ?? false ),
		'stock_status'            => (string) ( $v['stock_status'] ?? 'outofstock' ),
		'stock_quantity'          => isset( $v['stock_quantity'] ) ? (int) $v['stock_quantity'] : null,
		'manage_stock'            => (bool) ( $v['manage_stock'] ?? false ),
		'backorders_allowed'      => (bool) ( $v['backorders_allowed'] ?? false ),
		'backordered'             => (bool) ( $v['backordered'] ?? false ),
		'purchasable'             => (bool) ( $v['purchasable'] ?? false ),
		'image'                   => $v['image'] ?? null,
		'images'                  => (array) ( $v['images'] ?? [] ),
		'attributes'              => $attrs,
		'variation_attribute_values' => $attr_vals,
		'description'             => (string) ( $v['description'] ?? '' ),
		'weight'                  => (string) ( $v['weight'] ?? '' ),
		'dimensions'              => (array) ( $v['dimensions'] ?? [] ),
		'shipping_class'          => (string) ( $v['shipping_class'] ?? '' ),
		'status'                  => (string) ( $v['status'] ?? 'publish' ),
	];
}

/**
 * Compute derived variation state for the frontend state machine.
 *
 * @param array $product    Normalized parent product.
 * @param array $variations Normalized variation array.
 * @return array            Computed state shape.
 */
function dtb_compute_variation_state( array $product, array $variations ): array {
	if ( empty( $variations ) ) {
		return [
			'default_variation_id'          => null,
			'first_purchasable_variation_id' => null,
			'price_range'                   => [ 'min' => $product['price_min'], 'max' => $product['price_max'] ],
			'has_in_stock_variations'       => false,
			'has_backorder_variations'      => false,
			'has_out_of_stock_variations'   => false,
			'available_option_matrix'       => [],
			'disabled_options'              => [],
		];
	}

	// Resolve default variation from product default_attributes.
	$default_id  = null;
	$default_attrs = (array) ( $product['default_attributes'] ?? [] );
	if ( ! empty( $default_attrs ) ) {
		$default_map = [];
		foreach ( $default_attrs as $da ) {
			$name  = strtolower( (string) ( $da['name'] ?? '' ) );
			$val   = strtolower( (string) ( $da['option'] ?? '' ) );
			if ( $name && $val ) {
				$default_map[ $name ] = $val;
			}
		}
		foreach ( $variations as $var ) {
			$var_map = [];
			foreach ( (array) ( $var['variation_attribute_values'] ?? [] ) as $av ) {
				$n = strtolower( (string) ( $av['name'] ?? '' ) );
				$o = strtolower( (string) ( $av['option'] ?? '' ) );
				if ( $n ) $var_map[ $n ] = $o;
			}
			$match = true;
			foreach ( $default_map as $k => $v ) {
				if ( ( $var_map[ $k ] ?? '' ) !== $v ) {
					$match = false;
					break;
				}
			}
			if ( $match ) {
				$default_id = (int) $var['id'];
				break;
			}
		}
	}

	// First purchasable (in-stock) variation.
	$first_purchasable_id = null;
	foreach ( $variations as $var ) {
		if ( ( $var['purchasable'] ?? false ) && ( $var['stock_status'] ?? '' ) === 'instock' ) {
			$first_purchasable_id = (int) $var['id'];
			break;
		}
	}
	// Fall back: first purchasable regardless of stock (e.g. backorder)
	if ( ! $first_purchasable_id ) {
		foreach ( $variations as $var ) {
			if ( $var['purchasable'] ?? false ) {
				$first_purchasable_id = (int) $var['id'];
				break;
			}
		}
	}

	// Stock summary.
	$has_instock    = false;
	$has_backorder  = false;
	$has_outofstock = false;
	$prices         = [];
	foreach ( $variations as $var ) {
		$status = $var['stock_status'] ?? '';
		if ( 'instock' === $status )      $has_instock    = true;
		if ( 'onbackorder' === $status )  $has_backorder  = true;
		if ( 'outofstock' === $status )   $has_outofstock = true;
		$price = $var['price'] ?? '';
		if ( '' !== $price && is_numeric( $price ) ) {
			$prices[] = (float) $price;
		}
	}

	$price_min = ! empty( $prices ) ? (string) number_format( min( $prices ), 2, '.', '' ) : ( $product['price_min'] ?? '' );
	$price_max = ! empty( $prices ) ? (string) number_format( max( $prices ), 2, '.', '' ) : ( $product['price_max'] ?? '' );

	// Build available option matrix: attr_name -> [ option -> { variation_id, stock_status, purchasable } ]
	$option_matrix = [];
	foreach ( $variations as $var ) {
		foreach ( (array) ( $var['variation_attribute_values'] ?? [] ) as $av ) {
			$name   = (string) ( $av['name'] ?? '' );
			$option = (string) ( $av['option'] ?? '' );
			if ( ! $name || ! $option ) continue;
			if ( ! isset( $option_matrix[ $name ] ) ) {
				$option_matrix[ $name ] = [];
			}
			$status      = $var['stock_status'] ?? 'outofstock';
			$purchasable = (bool) ( $var['purchasable'] ?? false );
			// Track best status for this option (instock > onbackorder > outofstock)
			$existing = $option_matrix[ $name ][ $option ] ?? null;
			$rank      = [ 'instock' => 2, 'onbackorder' => 1, 'outofstock' => 0 ];
			if (
				! $existing ||
				( $rank[ $status ] ?? 0 ) > ( $rank[ $existing['stock_status'] ] ?? 0 ) ||
				( ! $existing['purchasable'] && $purchasable )
			) {
				$option_matrix[ $name ][ $option ] = [
					'variation_id' => (int) $var['id'],
					'stock_status' => $status,
					'purchasable'  => $purchasable,
				];
			}
		}
	}

	// Build disabled options: options that appear on the parent attributes but
	// have no purchasable variation.
	$disabled_options = [];
	foreach ( $option_matrix as $attr_name => $option_map ) {
		foreach ( $option_map as $option => $meta ) {
			if ( ! $meta['purchasable'] ) {
				$disabled_options[] = [
					'attribute' => $attr_name,
					'option'    => $option,
				];
			}
		}
	}

	return [
		'default_variation_id'           => $default_id,
		'first_purchasable_variation_id' => $first_purchasable_id,
		'price_range'                    => [ 'min' => $price_min, 'max' => $price_max ],
		'has_in_stock_variations'        => $has_instock,
		'has_backorder_variations'       => $has_backorder,
		'has_out_of_stock_variations'    => $has_outofstock,
		'available_option_matrix'        => $option_matrix,
		'disabled_options'               => $disabled_options,
	];
}

// =============================================================================
// ADMIN CACHE FLUSH ENDPOINT — POST /dtb/v1/admin/cache/products/flush
// =============================================================================

/**
 * Permission callback for the admin cache flush endpoint.
 * Requires administrator JWT or logged-in WP admin.
 */
function dtb_admin_cache_flush_permission( WP_REST_Request $request ) {
	// Check WordPress logged-in administrator first.
	if ( is_user_logged_in() && current_user_can( 'manage_options' ) ) {
		// Validate nonce if provided (admin-ajax style callers will supply it).
		$nonce = $request->get_header( 'x_dtb_nonce' ) ?: $request->get_param( '_nonce' );
		if ( $nonce && ! wp_verify_nonce( $nonce, 'dtb_admin_cache_flush' ) ) {
			return new WP_Error( 'invalid_nonce', 'Nonce verification failed.', [ 'status' => 403 ] );
		}
		return true;
	}

	// Fall back to JWT administrator check.
	$token = null;
	if ( ! empty( $_COOKIE[ DTB_AUTH_COOKIE ] ) ) {
		$token = sanitize_text_field( wp_unslash( $_COOKIE[ DTB_AUTH_COOKIE ] ) );
	}
	if ( ! $token ) {
		$auth = $request->get_header( 'authorization' );
		if ( $auth && preg_match( '/^Bearer\s+(\S+)$/i', $auth, $m ) ) {
			$token = $m[1];
		}
	}
	if ( ! $token ) {
		return new WP_Error( 'missing_token', 'Authentication required.', [ 'status' => 401 ] );
	}

	$payload = dtb_verify_jwt( $token );
	if ( is_wp_error( $payload ) ) {
		return $payload;
	}

	$roles = isset( $payload->roles ) ? (array) $payload->roles : [];
	if ( ! in_array( 'administrator', $roles, true ) ) {
		return new WP_Error( 'forbidden', 'Administrator access required.', [ 'status' => 403 ] );
	}

	return true;
}

/**
 * POST /dtb/v1/admin/cache/products/flush
 *
 * Clears all drywall_cache_* transients, logs the flush event, and returns
 * the number of transients deleted.  Requires administrator authentication.
 */
function dtb_route_admin_cache_flush( WP_REST_Request $request ): WP_REST_Response {
	global $wpdb;

	// Count before deletion for the audit log.
	$count = (int) $wpdb->get_var(
		$wpdb->prepare(
			"SELECT COUNT(*) FROM {$wpdb->options} WHERE option_name LIKE %s",
			$wpdb->esc_like( '_transient_drywall_cache_' ) . '%'
		)
	);

	dtb_invalidate_product_cache();

	dtb_log_cache_event( 'admin_cache_flush', [
		'user_id'          => get_current_user_id(),
		'transients_cleared' => $count,
	] );

	$response = new WP_REST_Response( [
		'success'            => true,
		'transients_cleared' => $count,
		'message'            => sprintf( 'Product cache flushed. %d transient(s) cleared.', $count ),
	], 200 );
	$response->header( 'Cache-Control', 'private, no-store' );
	return $response;
}
