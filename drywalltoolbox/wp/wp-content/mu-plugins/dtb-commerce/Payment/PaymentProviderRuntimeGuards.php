<?php
/**
 * Runtime guardrails around Payment Plugins for Stripe WooCommerce.
 *
 * The provider plugin owns its public REST routes, Stripe webhook endpoint,
 * credentials, PaymentIntent lifecycle, refunds, disputes, and WooCommerce
 * payment completion. DTB only adds operational diagnostics and prevents DTB
 * code paths from treating provider REST routes as authenticated DTB APIs.
 *
 * @package drywall-toolbox
 */

defined( 'ABSPATH' ) || exit;

final class DTB_PaymentProviderRuntimeGuards {
	private const PROVIDER                         = 'payment_plugins_stripe';
	private const PROVIDER_NAMESPACE              = '/wc-stripe/v1';
	private const PROVIDER_WEBHOOK_ROUTE          = '/wc-stripe/v1/webhook';
	private const WEBHOOK_DIAGNOSTICS_OPTION      = 'dtb_stripe_webhook_diagnostics';
	private const PROVIDER_REST_BOUNDARY_HEADERS  = [
		'x-dtb-auth',
		'x-dtb-checkout-session',
		'x-dtb-idempotency-key',
		'x-dtb-internal',
		'x-dtb-payment-surface-token',
	];
	private const PROVIDER_REST_BOUNDARY_PARAMS   = [
		'_dtb_internal',
		'_dtb_provider_proxy',
	];
	private const PREFERRED_STRIPE_GATEWAY_IDS     = [
		'stripe_upm',
		'stripe_cc',
		'stripe_applepay',
		'stripe_googlepay',
		'stripe_link_checkout',
		'stripe',
	];

	public static function register(): void {
		add_filter( 'rest_pre_dispatch', [ __CLASS__, 'guard_provider_rest_boundary' ], 4, 3 );
		add_filter( 'wc_stripe_webhook_response', [ __CLASS__, 'record_verified_webhook_response' ], 20, 3 );
		add_action( 'wc_stripe_webhook_payment_intent_succeeded', [ __CLASS__, 'record_payment_intent_webhook' ], 30, 3 );
	}

	/**
	 * Reject DTB-marked traffic aimed at provider-owned public REST routes.
	 *
	 * Payment Plugins exposes several public frontend REST endpoints by design. DTB
	 * must not proxy or call those routes with DTB session/idempotency/auth headers
	 * as if they were authenticated Drywall Toolbox APIs. Normal provider browser
	 * traffic and the signed Stripe webhook route are left untouched.
	 */
	public static function guard_provider_rest_boundary( $result, WP_REST_Server $server, WP_REST_Request $request ) {
		if ( null !== $result ) {
			return $result;
		}

		$route = self::normalize_route( (string) $request->get_route() );
		if ( ! self::is_provider_rest_route( $route ) || self::PROVIDER_WEBHOOK_ROUTE === $route ) {
			return $result;
		}

		if ( ! self::has_dtb_boundary_marker( $request ) ) {
			return $result;
		}

		return new WP_Error(
			'dtb_payment_provider_rest_boundary',
			'Payment provider REST routes are provider-owned and must not be used as authenticated DTB application APIs.',
			[ 'status' => 403 ]
		);
	}

	/** Return a non-secret runtime diagnostic envelope for checkout capabilities/admin checks. */
	public static function provider_diagnostics( array $payment_methods = [], array $registered_methods = [] ): array {
		$mode            = self::current_mode();
		$webhook_url     = function_exists( 'get_rest_url' ) ? get_rest_url( null, self::PROVIDER_WEBHOOK_ROUTE ) : '';
		$mode_settings   = self::mode_settings( $mode );
		$all_modes       = [
			'test' => self::mode_settings( 'test' ),
			'live' => self::mode_settings( 'live' ),
		];
		$active_gateways = self::available_stripe_gateway_records( $payment_methods );
		$preferred       = self::preferred_gateway_id( $active_gateways );
		$last_webhook    = self::last_webhook_diagnostics();
		$warnings        = [];

		if ( ! self::provider_loaded() ) {
			$warnings[] = [
				'code'    => 'provider_not_loaded',
				'message' => 'Payment Plugins for Stripe WooCommerce is not loaded in this runtime.',
			];
		}
		if ( '' === $mode || ! isset( $all_modes[ $mode ] ) ) {
			$warnings[] = [
				'code'    => 'provider_mode_unknown',
				'message' => 'Stripe provider mode could not be resolved.',
			];
		}
		if ( empty( $mode_settings['webhook_secret_configured'] ) ) {
			$warnings[] = [
				'code'    => 'webhook_secret_missing',
				'message' => 'The current Stripe mode does not have a configured webhook secret; asynchronous payment, refund, and dispute reconciliation is not production-ready.',
			];
		}
		if ( empty( $mode_settings['webhook_id_configured'] ) ) {
			$warnings[] = [
				'code'    => 'webhook_id_not_recorded',
				'message' => 'The current Stripe mode does not have a recorded provider webhook id. This is acceptable only when the webhook was intentionally configured manually in Stripe.',
			];
		}
		if ( empty( $active_gateways ) ) {
			$warnings[] = [
				'code'    => 'stripe_gateway_unavailable',
				'message' => 'No live available Stripe gateway is currently exposed by WooCommerce for this checkout session.',
			];
		}
		if ( isset( $last_webhook['last_warning'] ) && is_array( $last_webhook['last_warning'] ) ) {
			$warnings[] = $last_webhook['last_warning'];
		}

		return [
			'provider'                         => self::PROVIDER,
			'provider_loaded'                  => self::provider_loaded(),
			'provider_rest_namespace'          => self::PROVIDER_NAMESPACE,
			'provider_webhook_route'           => self::PROVIDER_WEBHOOK_ROUTE,
			'provider_webhook_url'             => esc_url_raw( $webhook_url ),
			'current_mode'                     => $mode,
			'current_mode_settings'            => $mode_settings,
			'mode_settings'                    => $all_modes,
			'gateway_availability_source'      => 'woocommerce_available_payment_gateways',
			'active_gateways'                  => $active_gateways,
			'active_gateway_count'             => count( $active_gateways ),
			'preferred_gateway_id'             => $preferred,
			'registered_blocks_methods'        => self::safe_registered_method_records( $registered_methods ),
			'provider_runtime_ready'           => self::provider_loaded() && ! empty( $mode_settings['webhook_secret_configured'] ) && ! empty( $active_gateways ),
			'webhook_managed_by_provider'      => true,
			'public_provider_rest_boundary'    => [
				'status'          => 'dtb_marked_requests_rejected',
				'guarded_headers' => self::PROVIDER_REST_BOUNDARY_HEADERS,
				'guarded_params'  => self::PROVIDER_REST_BOUNDARY_PARAMS,
			],
			'last_verified_webhook'            => $last_webhook,
			'warnings'                         => $warnings,
		];
	}

	/** Record a verified provider webhook after Payment Plugins validates Stripe signature. */
	public static function record_verified_webhook_response( array $response, $event, WP_REST_Request $request ): array {
		$mode = self::event_mode( $event );
		self::store_webhook_diagnostics( [
			'last_seen_at'        => gmdate( 'c' ),
			'last_event_id'       => sanitize_text_field( (string) ( is_object( $event ) ? ( $event->id ?? '' ) : '' ) ),
			'last_event_type'     => sanitize_text_field( (string) ( is_object( $event ) ? ( $event->type ?? '' ) : '' ) ),
			'last_mode'           => $mode,
			'last_route'          => self::normalize_route( (string) $request->get_route() ),
			'webhook_id_configured'     => (bool) self::mode_settings( $mode )['webhook_id_configured'],
			'webhook_secret_configured' => (bool) self::mode_settings( $mode )['webhook_secret_configured'],
		] );

		return $response;
	}

	/** Record DTB-specific Stripe payment-intent webhook diagnostics without changing payment state. */
	public static function record_payment_intent_webhook( $intent, $request = null, $event = null ): void {
		$metadata = self::metadata_array( is_object( $intent ) && isset( $intent->metadata ) ? $intent->metadata : null );
		if ( (string) ( $metadata['dtb_created_via'] ?? '' ) !== 'dtb_checkout' ) {
			return;
		}

		$has_session = '' !== trim( (string) ( $metadata['dtb_checkout_session_id'] ?? '' ) );
		$has_order   = self::metadata_order_id( $metadata ) > 0;
		if ( $has_session && $has_order ) {
			self::store_webhook_diagnostics( [
				'last_dtb_payment_intent_seen_at' => gmdate( 'c' ),
				'last_dtb_payment_intent_id'      => sanitize_text_field( (string) ( is_object( $intent ) ? ( $intent->id ?? '' ) : '' ) ),
			] );
			return;
		}

		self::record_warning( 'dtb_stripe_webhook_metadata_incomplete', 'A DTB Stripe PaymentIntent webhook was received without complete DTB checkout correlation metadata.', [
			'intent_id'    => sanitize_text_field( (string) ( is_object( $intent ) ? ( $intent->id ?? '' ) : '' ) ),
			'has_session'  => $has_session,
			'has_order_id' => $has_order,
		] );
	}

	public static function record_warning( string $code, string $message, array $context = [] ): void {
		self::store_webhook_diagnostics( [
			'last_warning' => [
				'code'       => sanitize_key( $code ),
				'message'    => sanitize_text_field( $message ),
				'context'    => self::sanitize_context( $context ),
				'created_at' => gmdate( 'c' ),
			],
		] );
	}

	private static function has_dtb_boundary_marker( WP_REST_Request $request ): bool {
		foreach ( self::PROVIDER_REST_BOUNDARY_HEADERS as $header ) {
			if ( '' !== trim( (string) $request->get_header( $header ) ) ) {
				return true;
			}
		}

		foreach ( self::PROVIDER_REST_BOUNDARY_PARAMS as $param ) {
			if ( null !== $request->get_param( $param ) ) {
				return true;
			}
		}

		return false;
	}

	private static function is_provider_rest_route( string $route ): bool {
		return self::PROVIDER_NAMESPACE === $route || str_starts_with( $route, self::PROVIDER_NAMESPACE . '/' );
	}

	private static function normalize_route( string $route ): string {
		return '/' . trim( untrailingslashit( $route ), '/' );
	}

	private static function provider_loaded(): bool {
		return function_exists( 'stripe_wc' ) || defined( 'WC_STRIPE_PLUGIN_FILE_PATH' ) || class_exists( '\PaymentPlugins\Stripe\Plugin' );
	}

	private static function current_mode(): string {
		if ( function_exists( 'wc_stripe_mode' ) ) {
			try {
				return sanitize_key( (string) wc_stripe_mode() );
			} catch ( Throwable $exception ) {
				return '';
			}
		}
		return '';
	}

	private static function mode_settings( string $mode ): array {
		$mode = sanitize_key( $mode );
		if ( ! in_array( $mode, [ 'test', 'live' ], true ) ) {
			return [
				'mode'                      => $mode,
				'webhook_id_configured'     => false,
				'webhook_secret_configured' => false,
				'publishable_key_configured'=> false,
				'secret_key_configured'     => false,
			];
		}

		return [
			'mode'                       => $mode,
			'webhook_id_configured'      => '' !== self::provider_option( 'webhook_id_' . $mode ),
			'webhook_secret_configured'  => '' !== self::provider_option( 'webhook_secret_' . $mode ),
			'publishable_key_configured' => '' !== self::publishable_key( $mode ),
			'secret_key_configured'      => '' !== self::secret_key( $mode ),
		];
	}

	private static function provider_option( string $key ): string {
		try {
			$stripe = function_exists( 'stripe_wc' ) ? stripe_wc() : null;
			if ( is_object( $stripe ) && isset( $stripe->api_settings ) && is_object( $stripe->api_settings ) && method_exists( $stripe->api_settings, 'get_option' ) ) {
				return trim( (string) $stripe->api_settings->get_option( $key, '' ) );
			}
		} catch ( Throwable $exception ) {
			return '';
		}
		return '';
	}

	private static function publishable_key( string $mode ): string {
		if ( function_exists( 'wc_stripe_get_publishable_key' ) ) {
			try {
				return trim( (string) wc_stripe_get_publishable_key( $mode ) );
			} catch ( Throwable $exception ) {
				return '';
			}
		}
		return self::provider_option( 'publishable_key_' . $mode );
	}

	private static function secret_key( string $mode ): string {
		if ( function_exists( 'wc_stripe_get_secret_key' ) ) {
			try {
				return trim( (string) wc_stripe_get_secret_key( $mode ) );
			} catch ( Throwable $exception ) {
				return '';
			}
		}
		return self::provider_option( 'secret_key_' . $mode );
	}

	private static function available_stripe_gateway_records( array $payment_methods ): array {
		$candidates = $payment_methods;
		if ( empty( $candidates ) && function_exists( 'WC' ) && WC()->payment_gateways() ) {
			try {
				$candidates = WC()->payment_gateways()->get_available_payment_gateways();
			} catch ( Throwable $exception ) {
				$candidates = [];
			}
		}

		$records = [];
		foreach ( $candidates as $key => $gateway ) {
			$record = self::normalize_gateway_record( $key, $gateway );
			if ( null !== $record ) {
				$records[ $record['id'] ] = $record;
			}
		}
		ksort( $records );
		return array_values( $records );
	}

	private static function normalize_gateway_record( $key, $gateway ): ?array {
		$id = '';
		if ( is_array( $gateway ) ) {
			$id = sanitize_key( (string) ( $gateway['id'] ?? $key ) );
		} elseif ( is_object( $gateway ) && isset( $gateway->id ) ) {
			$id = sanitize_key( (string) $gateway->id );
		} elseif ( is_string( $key ) ) {
			$id = sanitize_key( $key );
		}
		if ( '' === $id || ! self::is_stripe_gateway_id( $id ) ) {
			return null;
		}

		$title = $id;
		if ( is_array( $gateway ) ) {
			$title = sanitize_text_field( (string) ( $gateway['title'] ?? $id ) );
		} elseif ( is_object( $gateway ) && method_exists( $gateway, 'get_title' ) ) {
			try {
				$title = sanitize_text_field( (string) $gateway->get_title() );
			} catch ( Throwable $exception ) {
				$title = $id;
			}
		} elseif ( is_object( $gateway ) && isset( $gateway->title ) ) {
			$title = sanitize_text_field( (string) $gateway->title );
		}

		return [
			'id'       => $id,
			'title'    => $title,
			'class'    => is_object( $gateway ) ? get_class( $gateway ) : '',
			'enabled'  => is_array( $gateway ) ? (bool) ( $gateway['enabled'] ?? true ) : true,
			'supports' => is_object( $gateway ) && isset( $gateway->supports ) ? array_values( array_map( 'sanitize_key', (array) $gateway->supports ) ) : [],
		];
	}

	private static function preferred_gateway_id( array $gateways ): string {
		$available = array_column( $gateways, 'id' );
		foreach ( self::PREFERRED_STRIPE_GATEWAY_IDS as $id ) {
			if ( in_array( $id, $available, true ) ) {
				return $id;
			}
		}
		return (string) ( $available[0] ?? '' );
	}

	private static function safe_registered_method_records( array $registered_methods ): array {
		$records = [];
		foreach ( $registered_methods as $method ) {
			$id = sanitize_key( (string) ( is_array( $method ) ? ( $method['id'] ?? '' ) : '' ) );
			if ( '' === $id || ! self::is_stripe_gateway_id( $id ) ) {
				continue;
			}
			$records[] = [
				'id'             => $id,
				'active'         => ! empty( $method['active'] ),
				'data_available' => ! empty( $method['data_available'] ),
			];
		}
		return $records;
	}

	private static function is_stripe_gateway_id( string $gateway_id ): bool {
		return 'stripe' === $gateway_id || str_starts_with( $gateway_id, 'stripe_' );
	}

	private static function event_mode( $event ): string {
		$livemode = is_object( $event ) && isset( $event->livemode ) ? (bool) $event->livemode : null;
		if ( null === $livemode && is_object( $event ) && isset( $event->data->object->livemode ) ) {
			$livemode = (bool) $event->data->object->livemode;
		}
		if ( null === $livemode ) {
			return self::current_mode();
		}
		return $livemode ? 'live' : 'test';
	}

	private static function store_webhook_diagnostics( array $patch ): void {
		$current = self::last_webhook_diagnostics();
		$next    = array_merge( $current, $patch );
		update_option( self::WEBHOOK_DIAGNOSTICS_OPTION, $next, false );
	}

	private static function last_webhook_diagnostics(): array {
		$value = get_option( self::WEBHOOK_DIAGNOSTICS_OPTION, [] );
		return is_array( $value ) ? $value : [];
	}

	private static function metadata_array( $metadata ): array {
		if ( is_array( $metadata ) ) {
			return $metadata;
		}
		if ( is_object( $metadata ) ) {
			$values = [];
			foreach ( $metadata as $key => $value ) {
				$values[ (string) $key ] = $value;
			}
			if ( empty( $values ) ) {
				$values = get_object_vars( $metadata );
			}
			return $values;
		}
		return [];
	}

	private static function metadata_order_id( array $metadata ): int {
		foreach ( [ 'dtb_order_id', 'dtb_wc_order_id', 'wc_order_id', 'order_id' ] as $key ) {
			if ( isset( $metadata[ $key ] ) ) {
				return absint( $metadata[ $key ] );
			}
		}
		return 0;
	}

	private static function sanitize_context( array $context ): array {
		$sanitized = [];
		foreach ( $context as $key => $value ) {
			$key = sanitize_key( (string) $key );
			if ( is_bool( $value ) || is_int( $value ) || is_float( $value ) ) {
				$sanitized[ $key ] = $value;
			} elseif ( is_scalar( $value ) ) {
				$sanitized[ $key ] = sanitize_text_field( (string) $value );
			}
		}
		return $sanitized;
	}
}

DTB_PaymentProviderRuntimeGuards::register();
