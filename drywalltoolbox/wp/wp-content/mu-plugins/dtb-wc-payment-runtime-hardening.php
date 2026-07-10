<?php
/**
 * Plugin Name: DTB WooCommerce Payment Runtime Hardening
 * Description: Production guardrail for headless checkout order-pay handoff. Keeps keyed, unpaid online orders payable until the gateway actually captures payment.
 * Version: 1.0.0
 * Author: Drywall Toolbox
 */

defined( 'ABSPATH' ) || exit;

if ( ! function_exists( 'dtb_payment_handoff_suppress_frontend_warning_output' ) ) {
	function dtb_payment_handoff_suppress_frontend_warning_output(): void {
		$request_uri = isset( $_SERVER['REQUEST_URI'] )
			? sanitize_text_field( wp_unslash( $_SERVER['REQUEST_URI'] ) )
			: '';

		if ( false !== strpos( $request_uri, '/checkout/order-pay/' ) && false !== strpos( $request_uri, 'key=wc_order_' ) ) {
			@ini_set( 'display_errors', '0' ); // phpcs:ignore WordPress.PHP.NoSilencedErrors.Discouraged
		}
	}

	dtb_payment_handoff_suppress_frontend_warning_output();
}

if ( ! function_exists( 'dtb_payment_handoff_order_pay_id' ) ) {
	function dtb_payment_handoff_order_pay_id(): int {
		$order_pay = function_exists( 'get_query_var' ) ? get_query_var( 'order-pay' ) : 0;
		$order_id  = absint( $order_pay );
		if ( $order_id > 0 ) {
			return $order_id;
		}

		$request_uri = isset( $_SERVER['REQUEST_URI'] )
			? sanitize_text_field( wp_unslash( $_SERVER['REQUEST_URI'] ) )
			: '';
		$path = (string) wp_parse_url( $request_uri, PHP_URL_PATH );

		if ( preg_match( '#/(?:wp/)?checkout/order-pay/(\d+)/?#', $path, $matches ) ) {
			return absint( $matches[1] ?? 0 );
		}

		return 0;
	}
}

if ( ! function_exists( 'dtb_payment_handoff_request_key' ) ) {
	function dtb_payment_handoff_request_key(): string {
		return isset( $_GET['key'] ) ? sanitize_text_field( wp_unslash( $_GET['key'] ) ) : ''; // phpcs:ignore WordPress.Security.NonceVerification.Recommended
	}
}

if ( ! function_exists( 'dtb_payment_handoff_is_payment_request' ) ) {
	function dtb_payment_handoff_is_payment_request(): bool {
		if (
			is_admin()
			|| ( defined( 'REST_REQUEST' ) && REST_REQUEST )
			|| ( defined( 'DOING_CRON' ) && DOING_CRON )
			|| ( defined( 'WP_CLI' ) && WP_CLI )
			|| ( defined( 'DOING_AJAX' ) && DOING_AJAX )
		) {
			return false;
		}

		if ( dtb_payment_handoff_order_pay_id() > 0 ) {
			return true;
		}

		$request_uri = isset( $_SERVER['REQUEST_URI'] )
			? sanitize_text_field( wp_unslash( $_SERVER['REQUEST_URI'] ) )
			: '';

		return false !== strpos( $request_uri, 'pay_for_order=true' ) && false !== strpos( $request_uri, 'key=wc_order_' );
	}
}

if ( ! function_exists( 'dtb_payment_handoff_is_order_like' ) ) {
	function dtb_payment_handoff_is_order_like( $order ): bool {
		return is_object( $order )
			&& method_exists( $order, 'get_id' )
			&& method_exists( $order, 'get_order_key' )
			&& method_exists( $order, 'get_total' )
			&& method_exists( $order, 'get_status' );
	}
}

if ( ! function_exists( 'dtb_payment_handoff_key_matches' ) ) {
	function dtb_payment_handoff_key_matches( $order ): bool {
		if ( ! dtb_payment_handoff_is_order_like( $order ) ) {
			return false;
		}

		$request_order_id = dtb_payment_handoff_order_pay_id();
		if ( $request_order_id > 0 && (int) $order->get_id() !== $request_order_id ) {
			return false;
		}

		$request_key = dtb_payment_handoff_request_key();
		$order_key   = (string) $order->get_order_key();

		return '' !== $request_key && '' !== $order_key && hash_equals( $order_key, $request_key );
	}
}

if ( ! function_exists( 'dtb_payment_handoff_has_gateway_reference' ) ) {
	function dtb_payment_handoff_has_gateway_reference( $order ): bool {
		if ( ! is_object( $order ) || ! method_exists( $order, 'get_meta' ) ) {
			return false;
		}

		$gateway_meta_keys = [
			'_transaction_id',
			'_wcpay_intent_id',
			'_wcpay_charge_id',
			'_stripe_intent_id',
			'_stripe_charge_id',
			'_payment_intent_id',
			'_paypal_order_id',
			'_paypal_transaction_id',
		];

		foreach ( $gateway_meta_keys as $key ) {
			$value = trim( (string) $order->get_meta( $key, true ) );
			if ( '' !== $value ) {
				return true;
			}
		}

		return false;
	}
}

if ( ! function_exists( 'dtb_payment_handoff_has_captured_payment' ) ) {
	function dtb_payment_handoff_has_captured_payment( $order ): bool {
		if ( ! is_object( $order ) || ! method_exists( $order, 'get_date_paid' ) || ! method_exists( $order, 'get_transaction_id' ) ) {
			return false;
		}

		$date_paid      = $order->get_date_paid();
		$transaction_id = trim( (string) $order->get_transaction_id() );

		return null !== $date_paid && ( '' !== $transaction_id || dtb_payment_handoff_has_gateway_reference( $order ) );
	}
}

if ( ! function_exists( 'dtb_payment_handoff_is_terminal_status' ) ) {
	function dtb_payment_handoff_is_terminal_status( string $status ): bool {
		return in_array( sanitize_key( $status ), [ 'completed', 'cancelled', 'refunded', 'trash' ], true );
	}
}

if ( ! function_exists( 'dtb_payment_handoff_order_should_be_payable' ) ) {
	function dtb_payment_handoff_order_should_be_payable( $order ): bool {
		if ( ! dtb_payment_handoff_is_payment_request() || ! dtb_payment_handoff_key_matches( $order ) ) {
			return false;
		}

		if ( (float) $order->get_total() <= 0 ) {
			return false;
		}

		if ( dtb_payment_handoff_is_terminal_status( (string) $order->get_status() ) ) {
			return false;
		}

		return ! dtb_payment_handoff_has_captured_payment( $order );
	}
}

if ( ! function_exists( 'dtb_payment_handoff_preferred_gateway' ) ) {
	function dtb_payment_handoff_preferred_gateway(): ?object {
		if ( ! function_exists( 'WC' ) || ! WC()->payment_gateways() ) {
			return null;
		}

		$available = WC()->payment_gateways()->get_available_payment_gateways();
		if ( ! is_array( $available ) || empty( $available ) ) {
			return null;
		}

		$preferred_ids = [ 'woocommerce_payments', 'stripe', 'ppcp-gateway' ];
		foreach ( $preferred_ids as $preferred_id ) {
			if ( isset( $available[ $preferred_id ] ) && is_object( $available[ $preferred_id ] ) ) {
				return $available[ $preferred_id ];
			}
		}

		foreach ( $available as $gateway ) {
			if ( ! is_object( $gateway ) ) {
				continue;
			}
			$id = sanitize_key( (string) ( $gateway->id ?? '' ) );
			if ( '' !== $id && ! in_array( $id, [ 'cod', 'bacs', 'cheque' ], true ) ) {
				return $gateway;
			}
		}

		return null;
	}
}

if ( ! function_exists( 'dtb_payment_handoff_prepare_order' ) ) {
	function dtb_payment_handoff_prepare_order( int $order_id = 0 ): void {
		static $running = false;

		if ( $running || ! function_exists( 'wc_get_order' ) ) {
			return;
		}

		$order_id = $order_id > 0 ? $order_id : dtb_payment_handoff_order_pay_id();
		if ( $order_id <= 0 ) {
			return;
		}

		$order = wc_get_order( $order_id );
		if ( ! dtb_payment_handoff_order_should_be_payable( $order ) ) {
			return;
		}

		$changed = false;
		$status  = sanitize_key( (string) $order->get_status() );

		if ( ! in_array( $status, [ 'pending', 'failed', 'on-hold' ], true ) && method_exists( $order, 'set_status' ) ) {
			$order->set_status( 'pending' );
			$changed = true;
		}

		if (
			method_exists( $order, 'get_date_paid' )
			&& method_exists( $order, 'get_transaction_id' )
			&& method_exists( $order, 'set_date_paid' )
			&& null !== $order->get_date_paid()
			&& '' === trim( (string) $order->get_transaction_id() )
			&& ! dtb_payment_handoff_has_gateway_reference( $order )
		) {
			$order->set_date_paid( null );
			$changed = true;
		}

		$method = method_exists( $order, 'get_payment_method' ) ? sanitize_key( (string) $order->get_payment_method() ) : '';
		if ( '' === $method || in_array( $method, [ 'cod', 'bacs', 'cheque' ], true ) ) {
			$gateway = dtb_payment_handoff_preferred_gateway();
			if ( $gateway && method_exists( $order, 'set_payment_method' ) ) {
				$order->set_payment_method( $gateway );
				if ( method_exists( $order, 'set_payment_method_title' ) ) {
					$order->set_payment_method_title( 'Secure Card Payment' );
				}
				$changed = true;
			}
		}

		if ( ! $changed || ! method_exists( $order, 'save' ) ) {
			return;
		}

		$running = true;
		try {
			if ( method_exists( $order, 'add_order_note' ) ) {
				$order->add_order_note( 'DTB payment handoff normalized order for gateway payment form rendering.' );
			}
			$order->save();
		} finally {
			$running = false;
		}
	}
}

if ( ! function_exists( 'dtb_payment_handoff_prepare_current_order' ) ) {
	function dtb_payment_handoff_prepare_current_order(): void {
		if ( ! dtb_payment_handoff_is_payment_request() ) {
			return;
		}

		$order_id = dtb_payment_handoff_order_pay_id();
		if ( $order_id <= 0 ) {
			return;
		}

		dtb_payment_handoff_prepare_order( $order_id );
	}
}

add_action( 'wp', 'dtb_payment_handoff_prepare_current_order', -1000 );
add_action( 'template_redirect', 'dtb_payment_handoff_prepare_current_order', -1000 );
add_action( 'woocommerce_before_checkout_form', 'dtb_payment_handoff_prepare_current_order', -1000 );
add_action( 'woocommerce_before_template_part', 'dtb_payment_handoff_prepare_current_order', -1000 );

add_filter(
	'user_has_cap',
	static function ( array $allcaps, array $caps, array $args ): array {
		$requested_cap = isset( $args[0] ) ? (string) $args[0] : '';
		if ( 'pay_for_order' !== $requested_cap || ! dtb_payment_handoff_is_payment_request() ) {
			return $allcaps;
		}

		$order_id = isset( $args[2] ) ? absint( $args[2] ) : dtb_payment_handoff_order_pay_id();
		if ( $order_id <= 0 || ! function_exists( 'wc_get_order' ) ) {
			return $allcaps;
		}

		$order = wc_get_order( $order_id );
		if ( ! dtb_payment_handoff_order_should_be_payable( $order ) ) {
			return $allcaps;
		}

		$allcaps['pay_for_order'] = true;
		foreach ( $caps as $cap ) {
			$cap = (string) $cap;
			if ( '' !== $cap ) {
				$allcaps[ $cap ] = true;
			}
		}

		return $allcaps;
	},
	PHP_INT_MAX,
	3
);

add_filter(
	'woocommerce_valid_order_statuses_for_payment',
	static function ( array $statuses, $order ): array {
		if ( ! dtb_payment_handoff_order_should_be_payable( $order ) ) {
			return $statuses;
		}

		return array_values( array_unique( array_merge( $statuses, [ 'pending', 'failed', 'on-hold', 'processing', 'checkout-draft' ] ) ) );
	},
	PHP_INT_MAX,
	2
);

add_filter(
	'woocommerce_order_needs_payment',
	static function ( bool $needs_payment, $order ): bool {
		if ( $needs_payment ) {
			return true;
		}

		return dtb_payment_handoff_order_should_be_payable( $order );
	},
	PHP_INT_MAX,
	2
);

add_filter(
	'woocommerce_get_checkout_payment_url',
	static function ( string $url, $order ): string {
		if ( ! dtb_payment_handoff_is_order_like( $order ) ) {
			return $url;
		}

		$parts = wp_parse_url( $url );
		if ( ! is_array( $parts ) ) {
			return $url;
		}

		$path = (string) ( $parts['path'] ?? '' );
		if ( preg_match( '#^/wp/checkout/order-pay(?:/|$)#', $path ) ) {
			$path = (string) preg_replace( '#^/wp#', '', $path );
		} elseif ( preg_match( '#^/wp/order-pay(?:/|$)#', $path ) ) {
			$path = str_replace( '/wp/order-pay', '/checkout/order-pay', $path );
		} elseif ( preg_match( '#^/order-pay(?:/|$)#', $path ) ) {
			$path = '/checkout' . $path;
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
	},
	PHP_INT_MAX,
	2
);
