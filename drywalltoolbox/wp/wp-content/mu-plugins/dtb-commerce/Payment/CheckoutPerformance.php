<?php
/**
 * Checkout performance, stability telemetry, and non-critical asset policy.
 *
 * WooCommerce and the official WooCommerce Stripe extension remain authoritative
 * for checkout/payment runtime behavior. This layer only prewarms DTB-owned
 * static assets, suppresses known non-essential marketing/tracking resources on
 * checkout, and records bounded non-secret runtime diagnostics.
 *
 * @package drywall-toolbox
 */

defined( 'ABSPATH' ) || exit;

final class DTB_CheckoutPerformance {
	private const ASSET_VERSION = '2026.07.21.1';
	private const TELEMETRY_NONCE_ACTION = 'dtb_checkout_runtime_telemetry';
	private const PAYMENT_SURFACE_TIMEOUT_MS = 15000;
	private const TELEMETRY_EVENT_TTL = 10 * MINUTE_IN_SECONDS;

	/**
	 * These versions intentionally mirror the owning enqueue sites. A mismatch is
	 * fail-soft: it only forfeits a speculative cache hit and never changes runtime
	 * payment behavior.
	 */
	private const CORE_CHECKOUT_ASSET_VERSION = '2026.07.20.16';
	private const PAYMENT_SHEET_ASSET_VERSION = '2026.07.20.1';
	private const PROFILE_REFINEMENT_ASSET_VERSION = '2026.07.20.2';

	private const NONCRITICAL_HANDLE_TOKENS = [
		'google-analytics',
		'google_analytics',
		'googletagmanager',
		'google-tag-manager',
		'gtag',
		'facebook-pixel',
		'facebook_pixel',
		'fb-pixel',
		'meta-pixel',
		'hotjar',
		'clarity',
		'tiktok-pixel',
		'pinterest-tag',
		'linkedin-insight',
		'optimizely',
		'visual-website-optimizer',
		'vwo',
		'hubspot',
		'intercom',
		'mailchimp-popup',
		'loyalty-widget',
		'rewards-widget',
	];

	private const NONCRITICAL_HOSTS = [
		'www.googletagmanager.com',
		'googletagmanager.com',
		'www.google-analytics.com',
		'google-analytics.com',
		'connect.facebook.net',
		'static.hotjar.com',
		'script.hotjar.com',
		'www.clarity.ms',
		'clarity.ms',
		'bat.bing.com',
		'snap.licdn.com',
		'analytics.tiktok.com',
		's.pinimg.com',
		'cdn.optimizely.com',
		'dev.visualwebsiteoptimizer.com',
		'static.ads-twitter.com',
		'js.hs-scripts.com',
		'widget.intercom.io',
	];

	public static function register(): void {
		add_action( 'rest_api_init', [ __CLASS__, 'register_rest_routes' ] );
		add_action( 'wp_enqueue_scripts', [ __CLASS__, 'enqueue_runtime_asset' ], 40 );
		add_action( 'wp_enqueue_scripts', [ __CLASS__, 'suppress_noncritical_checkout_assets' ], 9990 );
		add_action( 'wp_head', [ __CLASS__, 'print_early_resource_hints' ], 1 );
		add_filter( 'rest_request_after_callbacks', [ __CLASS__, 'augment_checkout_capabilities' ], 20, 3 );
	}

	public static function register_rest_routes(): void {
		register_rest_route(
			'dtb/v1',
			'/checkout/runtime-telemetry',
			[
				'methods'             => WP_REST_Server::CREATABLE,
				'callback'            => [ __CLASS__, 'record_runtime_telemetry' ],
				'permission_callback' => [ __CLASS__, 'telemetry_permission' ],
			]
		);
	}

	public static function enqueue_runtime_asset(): void {
		if ( ! self::is_primary_checkout_request() ) {
			return;
		}

		wp_enqueue_script(
			'dtb-woo-native-checkout-performance',
			content_url( 'mu-plugins/dtb-commerce/assets/woo-native-checkout-performance.js' ),
			[ 'dtb-woo-native-checkout-ui' ],
			self::ASSET_VERSION,
			true
		);
		wp_script_add_data( 'dtb-woo-native-checkout-performance', 'strategy', 'defer' );
		wp_localize_script(
			'dtb-woo-native-checkout-performance',
			'DTB_CHECKOUT_PERFORMANCE',
			[
				'telemetryUrl'            => esc_url_raw( rest_url( 'dtb/v1/checkout/runtime-telemetry' ) ),
				'telemetryNonce'          => wp_create_nonce( self::TELEMETRY_NONCE_ACTION ),
				'paymentSurfaceTimeoutMs' => self::PAYMENT_SURFACE_TIMEOUT_MS,
			]
		);
	}

	/**
	 * Remove only known non-essential marketing/analytics assets from checkout.
	 * Unknown plugin assets are left untouched; payment and Woo dependencies are
	 * never heuristically dequeued.
	 */
	public static function suppress_noncritical_checkout_assets(): void {
		if ( ! self::is_primary_checkout_request() ) {
			return;
		}

		$explicit_handles = apply_filters( 'dtb_checkout_noncritical_asset_handles', [] );
		$explicit_handles = is_array( $explicit_handles )
			? array_map( 'sanitize_key', $explicit_handles )
			: [];

		global $wp_scripts, $wp_styles;

		if ( isset( $wp_scripts->queue, $wp_scripts->registered ) && is_array( $wp_scripts->queue ) ) {
			foreach ( array_values( $wp_scripts->queue ) as $handle ) {
				$registered = $wp_scripts->registered[ $handle ] ?? null;
				$src = is_object( $registered ) ? (string) ( $registered->src ?? '' ) : '';
				if ( self::is_noncritical_asset( (string) $handle, $src, $explicit_handles ) ) {
					wp_dequeue_script( $handle );
				}
			}
		}

		if ( isset( $wp_styles->queue, $wp_styles->registered ) && is_array( $wp_styles->queue ) ) {
			foreach ( array_values( $wp_styles->queue ) as $handle ) {
				$registered = $wp_styles->registered[ $handle ] ?? null;
				$src = is_object( $registered ) ? (string) ( $registered->src ?? '' ) : '';
				if ( self::is_noncritical_asset( (string) $handle, $src, $explicit_handles ) ) {
					wp_dequeue_style( $handle );
				}
			}
		}
	}

	/**
	 * Restore the most useful resource hints that the headless theme intentionally
	 * removes for normal SPA pages. Checkout is a separate native runtime.
	 */
	public static function print_early_resource_hints(): void {
		if ( ! self::is_primary_checkout_request() ) {
			return;
		}

		foreach ( [ 'https://js.stripe.com', 'https://m.stripe.network' ] as $origin ) {
			printf( '<link rel="preconnect" href="%s" crossorigin>\n', esc_url( $origin ) );
		}
		echo '<link rel="dns-prefetch" href="//js.stripe.com">' . "\n";

		foreach ( self::prewarm_manifest()['styles'] as $href ) {
			printf( '<link rel="preload" href="%s" as="style">\n', esc_url( $href ) );
		}
	}

	/**
	 * Add read-only performance/prewarm metadata to the existing capabilities
	 * route. This performs no external calls and exposes no credentials.
	 *
	 * @param WP_REST_Response|WP_HTTP_Response|WP_Error $response REST response.
	 * @param array                                      $handler  Route handler.
	 * @param WP_REST_Request                            $request  Request object.
	 * @return WP_REST_Response|WP_HTTP_Response|WP_Error
	 */
	public static function augment_checkout_capabilities( $response, array $handler, WP_REST_Request $request ) {
		if ( '/dtb/v1/checkout/capabilities' !== $request->get_route() || is_wp_error( $response ) || ! $response instanceof WP_REST_Response ) {
			return $response;
		}

		$data = $response->get_data();
		if ( ! is_array( $data ) ) {
			return $response;
		}

		$data['performance'] = [
			'asset_prewarm'              => self::prewarm_manifest(),
			'noncritical_asset_policy'   => 'known_marketing_tracking_suppressed',
			'checkout_runtime_telemetry' => true,
			'payment_surface_timeout_ms' => self::PAYMENT_SURFACE_TIMEOUT_MS,
			'below_fold_image_policy'    => 'viewport_aware_lazy_async',
			'checkout_document_cache'    => 'private_no_store',
		];
		$response->set_data( $data );
		return $response;
	}

	/** @return true|WP_Error */
	public static function telemetry_permission( WP_REST_Request $request ) {
		$nonce = (string) $request->get_header( 'X-DTB-Checkout-Telemetry' );
		if ( '' === $nonce ) {
			$nonce = sanitize_text_field( (string) $request->get_param( 'nonce' ) );
		}
		if ( ! wp_verify_nonce( $nonce, self::TELEMETRY_NONCE_ACTION ) ) {
			return new WP_Error( 'dtb_checkout_telemetry_forbidden', 'Invalid checkout telemetry nonce.', [ 'status' => 403 ] );
		}

		if ( ! self::request_origin_is_same_site() ) {
			return new WP_Error( 'dtb_checkout_telemetry_origin', 'Invalid checkout telemetry origin.', [ 'status' => 403 ] );
		}

		if ( class_exists( 'DTB_RateLimiter' ) ) {
			return DTB_RateLimiter::check( 'checkout_runtime_telemetry', 18, 5 * MINUTE_IN_SECONDS );
		}
		return true;
	}

	public static function record_runtime_telemetry( WP_REST_Request $request ): WP_REST_Response {
		$event_id = sanitize_text_field( (string) $request->get_param( 'event_id' ) );
		if ( ! preg_match( '/^[A-Za-z0-9_-]{8,80}$/', $event_id ) ) {
			return new WP_REST_Response( [ 'accepted' => false, 'reason' => 'invalid_event_id' ], 400 );
		}

		$dedupe_key = 'dtb_checkout_rt_' . substr( hash( 'sha256', $event_id ), 0, 32 );
		if ( false !== get_transient( $dedupe_key ) ) {
			return new WP_REST_Response( [ 'accepted' => true, 'duplicate' => true ], 202 );
		}
		set_transient( $dedupe_key, '1', self::TELEMETRY_EVENT_TTL );

		$kind = sanitize_key( (string) $request->get_param( 'kind' ) );
		$allowed_kinds = [
			'js_error',
			'unhandled_rejection',
			'resource_error',
			'payment_surface_timeout',
			'checkout_root_replaced',
			'checkout_vitals',
			'third_party_budget',
		];
		if ( ! in_array( $kind, $allowed_kinds, true ) ) {
			$kind = 'js_error';
		}

		$message = self::bounded_text( (string) $request->get_param( 'message' ), 500 );
		$source  = self::sanitize_source( (string) $request->get_param( 'source' ) );
		$detail  = $request->get_param( 'detail' );
		$detail  = is_array( $detail ) ? self::sanitize_detail( $detail ) : [];

		$context = [
			'kind'       => $kind,
			'event_id'   => $event_id,
			'message'    => $message,
			'source'     => $source,
			'line'       => absint( $request->get_param( 'line' ) ),
			'column'     => absint( $request->get_param( 'column' ) ),
			'viewport_w' => min( 10000, absint( $request->get_param( 'viewport_w' ) ) ),
			'step'       => sanitize_key( (string) $request->get_param( 'step' ) ),
			'detail'     => $detail,
		];

		if ( class_exists( 'DTB_Logger' ) ) {
			DTB_Logger::warning( 'Checkout runtime telemetry', $context );
		} else {
			error_log( wp_json_encode( [ 'source' => 'dtb-checkout', 'level' => 'warning', 'context' => $context ], JSON_UNESCAPED_SLASHES ) );
		}

		return new WP_REST_Response( [ 'accepted' => true ], 202 );
	}

	private static function prewarm_manifest(): array {
		return [
			'styles' => [
				add_query_arg( 'ver', self::CORE_CHECKOUT_ASSET_VERSION, content_url( 'mu-plugins/dtb-commerce/assets/woo-native-checkout.css' ) ),
				add_query_arg( 'ver', self::PAYMENT_SHEET_ASSET_VERSION, content_url( 'mu-plugins/dtb-commerce/assets/woo-native-checkout-payment-sheet.css' ) ),
				add_query_arg( 'ver', self::PROFILE_REFINEMENT_ASSET_VERSION, content_url( 'mu-plugins/dtb-commerce/assets/woo-native-checkout-profile-refinements.css' ) ),
			],
			'scripts' => [
				add_query_arg( 'ver', self::CORE_CHECKOUT_ASSET_VERSION, content_url( 'mu-plugins/dtb-commerce/assets/woo-native-checkout-steps.js' ) ),
				add_query_arg( 'ver', self::CORE_CHECKOUT_ASSET_VERSION, content_url( 'mu-plugins/dtb-commerce/assets/woo-native-checkout-ui.js' ) ),
				add_query_arg( 'ver', self::PAYMENT_SHEET_ASSET_VERSION, content_url( 'mu-plugins/dtb-commerce/assets/woo-native-checkout-payment-sheet.js' ) ),
				add_query_arg( 'ver', self::PROFILE_REFINEMENT_ASSET_VERSION, content_url( 'mu-plugins/dtb-commerce/assets/woo-native-checkout-profile-refinements.js' ) ),
			],
			'preconnect' => [
				'https://js.stripe.com',
				'https://m.stripe.network',
			],
		];
	}

	private static function is_noncritical_asset( string $handle, string $src, array $explicit_handles ): bool {
		$normalized_handle = sanitize_key( $handle );
		if ( in_array( $normalized_handle, $explicit_handles, true ) ) {
			return true;
		}

		$haystack = strtolower( $handle . ' ' . $src );
		foreach ( self::NONCRITICAL_HANDLE_TOKENS as $token ) {
			if ( false !== strpos( $haystack, $token ) ) {
				return true;
			}
		}

		$host = strtolower( (string) wp_parse_url( $src, PHP_URL_HOST ) );
		if ( '' === $host ) {
			return false;
		}
		foreach ( self::NONCRITICAL_HOSTS as $blocked_host ) {
			if ( $host === $blocked_host || str_ends_with( $host, '.' . $blocked_host ) ) {
				return true;
			}
		}
		return false;
	}

	private static function request_origin_is_same_site(): bool {
		$origin = get_http_origin();
		if ( ! $origin ) {
			return true;
		}

		$request_origin = self::normalized_origin( $origin );
		$home_origin    = self::normalized_origin( home_url( '/' ) );
		return '' !== $request_origin
			&& '' !== $home_origin
			&& hash_equals( $home_origin, $request_origin );
	}

	private static function normalized_origin( string $url ): string {
		$scheme = strtolower( (string) wp_parse_url( $url, PHP_URL_SCHEME ) );
		$host   = strtolower( (string) wp_parse_url( $url, PHP_URL_HOST ) );
		$port   = absint( wp_parse_url( $url, PHP_URL_PORT ) );
		if ( ! in_array( $scheme, [ 'http', 'https' ], true ) || '' === $host ) {
			return '';
		}

		$default_port = 'https' === $scheme ? 443 : 80;
		$port_suffix  = $port > 0 && $port !== $default_port ? ':' . $port : '';
		return $scheme . '://' . $host . $port_suffix;
	}

	private static function sanitize_source( string $source ): string {
		$source = trim( $source );
		if ( '' === $source ) {
			return '';
		}
		$parts = wp_parse_url( $source );
		if ( false === $parts ) {
			return self::bounded_text( $source, 240 );
		}
		$host = sanitize_text_field( (string) ( $parts['host'] ?? '' ) );
		$path = sanitize_text_field( (string) ( $parts['path'] ?? '' ) );
		return self::bounded_text( trim( $host . $path ), 240 );
	}

	private static function sanitize_detail( array $detail ): array {
		$clean = [];
		foreach ( array_slice( $detail, 0, 16, true ) as $key => $value ) {
			$clean_key = sanitize_key( (string) $key );
			if ( '' === $clean_key ) {
				continue;
			}
			if ( is_bool( $value ) || is_int( $value ) || is_float( $value ) ) {
				$clean[ $clean_key ] = $value;
				continue;
			}
			if ( is_string( $value ) ) {
				$clean[ $clean_key ] = self::bounded_text( $value, 240 );
				continue;
			}
			if ( is_array( $value ) ) {
				$items = [];
				foreach ( array_slice( $value, 0, 12 ) as $item ) {
					if ( is_scalar( $item ) ) {
						$items[] = self::bounded_text( (string) $item, 160 );
					}
				}
				$clean[ $clean_key ] = $items;
			}
		}
		return $clean;
	}

	private static function redact_sensitive_text( string $value ): string {
		$redactions = [
			'/[A-Z0-9._%+\-]+@[A-Z0-9.\-]+\.[A-Z]{2,}/i' => '[redacted-email]',
			'/\b(?:sk|rk)_(?:live|test)_[A-Za-z0-9_\-]+\b/' => '[redacted-stripe-key]',
			'/\bpk_(?:live|test)_[A-Za-z0-9_\-]+\b/' => '[redacted-stripe-key]',
			'/\bwhsec_[A-Za-z0-9_\-]+\b/' => '[redacted-webhook-secret]',
			'/\b(?:pi|seti)_[A-Za-z0-9]+_secret_[A-Za-z0-9_\-]+\b/' => '[redacted-client-secret]',
			'/\bcs_(?:live|test)_[A-Za-z0-9_\-]+\b/' => '[redacted-checkout-secret]',
			'/\bwc_order_[A-Za-z0-9_\-]+\b/' => '[redacted-order-key]',
			'/\bBearer\s+[A-Za-z0-9._~+\/\-]+=*/i' => 'Bearer [redacted-token]',
			'/\beyJ[A-Za-z0-9_\-]{10,}\.[A-Za-z0-9_\-]{10,}\.[A-Za-z0-9_\-]{10,}\b/' => '[redacted-jwt]',
			'/client_secret\s*[=:]\s*[^\s&,;]+/i' => 'client_secret=[redacted]',
		];

		$redacted = preg_replace( array_keys( $redactions ), array_values( $redactions ), $value );
		return is_string( $redacted ) ? $redacted : '[redacted]';
	}

	private static function bounded_text( string $value, int $max_length ): string {
		$value = self::redact_sensitive_text( sanitize_text_field( $value ) );
		if ( function_exists( 'mb_substr' ) ) {
			return mb_substr( $value, 0, $max_length );
		}
		return substr( $value, 0, $max_length );
	}

	private static function is_primary_checkout_request(): bool {
		if ( is_admin() || ! function_exists( 'is_checkout' ) || ! is_checkout() ) {
			return false;
		}
		if ( function_exists( 'is_wc_endpoint_url' ) && ( is_wc_endpoint_url( 'order-pay' ) || is_wc_endpoint_url( 'order-received' ) ) ) {
			return false;
		}
		return true;
	}
}

DTB_CheckoutPerformance::register();
