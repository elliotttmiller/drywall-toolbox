<?php
/**
 * WooPayments-native embedded checkout integration.
 *
 * WooCommerce owns cart/session/customer/address validation and order creation.
 * WooPayments owns embedded payment methods, express wallets, tokenization,
 * payment processing, and webhook-backed payment status. DTB owns only the
 * branded same-domain checkout shell, readiness diagnostics, checkout-order
 * tagging, and verified payment lifecycle observation for downstream queues.
 *
 * @package drywall-toolbox
 */

defined( 'ABSPATH' ) || exit;

final class DTB_WooPaymentsNativeCheckout {
	public const CHECKOUT_GATEWAY = 'woo_native_woopayments';
	public const CONTRACT_VERSION = 'woo-payments-v1';

	private const WOOPAYMENTS_GATEWAY_ID = 'woocommerce_payments';
	private const ASSET_VERSION          = '2026.07.18.2';

	public static function register(): void {
		add_action( 'rest_api_init', [ __CLASS__, 'register_rest_routes' ] );
		add_action( 'wp_enqueue_scripts', [ __CLASS__, 'enqueue_checkout_assets' ], 20 );
		add_filter( 'body_class', [ __CLASS__, 'body_class' ] );
		add_action( 'template_redirect', [ __CLASS__, 'maybe_render_checkout_shell' ], 20 );
		add_action( 'woocommerce_checkout_create_order', [ __CLASS__, 'tag_checkout_order' ], 20, 2 );
		add_action( 'woocommerce_store_api_checkout_order_processed', [ __CLASS__, 'tag_store_api_order' ], 20 );
		add_action( 'woocommerce_payment_complete', [ __CLASS__, 'mirror_verified_woopayments_payment' ], 9 );
		add_action( 'woocommerce_order_status_processing', [ __CLASS__, 'mirror_verified_woopayments_payment' ], 9 );
		add_action( 'woocommerce_order_status_completed', [ __CLASS__, 'mirror_verified_woopayments_payment' ], 9 );
		add_action( 'admin_notices', [ __CLASS__, 'admin_notices' ] );
	}

	public static function register_rest_routes(): void {
		register_rest_route(
			'dtb/v1',
			'/checkout/capabilities',
			[
				'methods'             => WP_REST_Server::READABLE,
				'callback'            => [ __CLASS__, 'checkout_capabilities' ],
				'permission_callback' => '__return_true',
			]
		);
	}

	public static function checkout_capabilities(): WP_REST_Response {
		$gateways = [];
		foreach ( self::payment_gateways() as $gateway ) {
			$id = sanitize_key( (string) ( $gateway->id ?? '' ) );
			if ( self::WOOPAYMENTS_GATEWAY_ID !== $id ) {
				continue;
			}
			$enabled = isset( $gateway->enabled ) && 'yes' === (string) $gateway->enabled;
			$gateways[] = [
				'id'              => $id,
				'title'           => sanitize_text_field( (string) ( $gateway->method_title ?? $gateway->title ?? 'WooPayments' ) ),
				'enabled'         => $enabled,
				'provider'        => 'woopayments',
				'contract'        => self::CONTRACT_VERSION,
				'payment_methods' => [
					[
						'id'       => $id,
						'title'    => sanitize_text_field( (string) ( $gateway->title ?? 'WooPayments' ) ),
						'enabled'  => $enabled,
						'provider' => 'woopayments',
					],
				],
			];
		}

		return rest_ensure_response(
			[
				'checkout' => 'woo_native',
				'contract' => self::CONTRACT_VERSION,
				'provider' => 'woopayments',
				'gateways' => $gateways,
			]
		);
	}

	public static function enqueue_checkout_assets(): void {
		if ( ! self::is_primary_checkout_request() ) {
			return;
		}
		wp_enqueue_style(
			'dtb-woo-native-checkout',
			content_url( 'mu-plugins/dtb-commerce/assets/woo-native-checkout.css' ),
			[],
			self::ASSET_VERSION
		);
	}

	public static function body_class( array $classes ): array {
		if ( self::is_primary_checkout_request() ) {
			$classes[] = 'dtb-woo-native-checkout';
			$classes[] = 'dtb-woopayments-checkout';
			$classes[] = 'dtb-checkout-embedded-flow';
		}
		return $classes;
	}

	public static function maybe_render_checkout_shell(): void {
		if ( ! self::is_primary_checkout_request() ) {
			return;
		}

		self::render_checkout_shell();
		exit;
	}

	public static function tag_checkout_order( WC_Order $order, array $data = [] ): void {
		self::tag_order( $order, 'woocommerce_checkout' );
	}

	public static function tag_store_api_order( $order ): void {
		if ( $order instanceof WC_Order ) {
			self::tag_order( $order, 'woocommerce_store_api_checkout' );
		}
	}

	public static function mirror_verified_woopayments_payment( $order_id ): void {
		$order = wc_get_order( (int) $order_id );
		if ( ! $order instanceof WC_Order || ! self::is_woopayments_order( $order ) ) {
			return;
		}

		self::tag_order( $order, 'woocommerce_woopayments_lifecycle' );
		$reference = self::gateway_reference( $order );
		if ( '' !== $reference ) {
			$order->update_meta_data( '_dtb_payment_provider', 'woopayments' );
			$order->update_meta_data( '_dtb_payment_ref', $reference );
			$order->update_meta_data( '_dtb_payment_captured', null !== $order->get_date_paid() ? '1' : '0' );
			$order->save_meta_data();
		}
	}

	public static function admin_notices(): void {
		if ( ! is_admin() || ! current_user_can( 'manage_woocommerce' ) || ! class_exists( 'WooCommerce' ) ) {
			return;
		}

		if ( ! self::is_woopayments_gateway_enabled() ) {
			echo '<div class="notice notice-warning"><p>'
				. esc_html__( 'Drywall Toolbox checkout is configured for WooCommerce Checkout + WooPayments. Enable, connect, and test WooPayments before accepting live checkout payments.', 'drywall-toolbox' )
				. '</p></div>';
		}

		if ( self::is_gateway_enabled( 'stripe' ) ) {
			echo '<div class="notice notice-warning"><p>'
				. esc_html__( 'Drywall Toolbox checkout should have one active storefront card/wallet authority. Disable the official WooCommerce Stripe gateway when WooPayments is the active payment provider.', 'drywall-toolbox' )
				. '</p></div>';
		}
	}

	private static function render_checkout_shell(): void {
		status_header( 200 );
		if ( function_exists( 'wc_nocache_headers' ) ) {
			wc_nocache_headers();
		} else {
			nocache_headers();
		}
		header( 'X-Robots-Tag: noindex, nofollow, noarchive', true );
		header( 'Referrer-Policy: strict-origin-when-cross-origin', true );

		$body_classes    = implode( ' ', array_map( 'sanitize_html_class', get_body_class( [ 'dtb-woo-native-checkout', 'dtb-woopayments-checkout', 'dtb-checkout-embedded-flow' ] ) ) );
		$checkout_markup = self::render_checkout_runtime();
		$has_markup      = '' !== trim( wp_strip_all_tags( $checkout_markup ) ) || false !== strpos( $checkout_markup, 'wc-block-checkout' ) || false !== strpos( $checkout_markup, 'woocommerce-checkout' );
		?>
<!doctype html>
<html <?php language_attributes(); ?>>
<head>
	<meta charset="<?php bloginfo( 'charset' ); ?>">
	<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
	<meta name="robots" content="noindex,nofollow,noarchive">
	<title><?php esc_html_e( 'Checkout – Drywall Toolbox', 'drywall-toolbox' ); ?></title>
	<?php wp_head(); ?>
</head>
<body class="<?php echo esc_attr( $body_classes ); ?>">
	<?php if ( function_exists( 'wp_body_open' ) ) { wp_body_open(); } ?>
	<!-- dtb-checkout-contract: <?php echo esc_html( self::CONTRACT_VERSION ); ?> -->
	<main class="dtb-woo-checkout-shell" data-dtb-checkout-contract="<?php echo esc_attr( self::CONTRACT_VERSION ); ?>" data-dtb-checkout-provider="woopayments">
		<div class="dtb-checkout-app-shell">
			<header class="dtb-checkout-topbar" aria-label="Drywall Toolbox checkout header">
				<a class="dtb-checkout-brand" href="<?php echo esc_url( home_url( '/' ) ); ?>" aria-label="Drywall Toolbox home">
					<span class="dtb-checkout-brand__mark" aria-hidden="true">DTB</span>
					<span class="dtb-checkout-brand__copy">
						<strong><?php esc_html_e( 'Drywall Toolbox', 'drywall-toolbox' ); ?></strong>
						<small><?php esc_html_e( 'Secure contractor checkout', 'drywall-toolbox' ); ?></small>
					</span>
				</a>
				<div class="dtb-checkout-topbar__actions" aria-label="Checkout assurances">
					<span><?php esc_html_e( 'Embedded WooPayments', 'drywall-toolbox' ); ?></span>
					<span><?php esc_html_e( 'Same-domain checkout', 'drywall-toolbox' ); ?></span>
					<a href="<?php echo esc_url( wc_get_cart_url() ); ?>"><?php esc_html_e( 'Return to cart', 'drywall-toolbox' ); ?></a>
				</div>
			</header>

			<section class="dtb-checkout-hero" aria-labelledby="dtb-checkout-title">
				<div class="dtb-checkout-hero__copy">
					<p class="dtb-woo-checkout-kicker"><?php esc_html_e( 'Fully embedded checkout', 'drywall-toolbox' ); ?></p>
					<h1 id="dtb-checkout-title"><?php esc_html_e( 'Fast, secure payment without leaving Drywall Toolbox.', 'drywall-toolbox' ); ?></h1>
					<p><?php esc_html_e( 'WooCommerce keeps the authoritative cart, customer, shipping, tax, and order workflow synchronized while WooPayments renders the embedded payment form and eligible express methods.', 'drywall-toolbox' ); ?></p>
				</div>
				<div class="dtb-checkout-hero__card" aria-label="Checkout flow summary">
					<span><?php esc_html_e( 'Current step', 'drywall-toolbox' ); ?></span>
					<strong><?php esc_html_e( 'Details + payment', 'drywall-toolbox' ); ?></strong>
					<small><?php esc_html_e( 'Order creation and payment remain provider-owned.', 'drywall-toolbox' ); ?></small>
				</div>
			</section>

			<nav class="dtb-woo-checkout-progress" aria-label="Checkout progress">
				<ol class="dtb-woo-checkout-progress__steps">
					<?php self::render_progress_step( 1, __( 'Cart', 'drywall-toolbox' ), __( 'Reviewed', 'drywall-toolbox' ), 'complete' ); ?>
					<li class="dtb-woo-checkout-progress__connector is-complete" aria-hidden="true"></li>
					<?php self::render_progress_step( 2, __( 'Express', 'drywall-toolbox' ), __( 'Wallet options', 'drywall-toolbox' ), 'active' ); ?>
					<li class="dtb-woo-checkout-progress__connector is-active" aria-hidden="true"></li>
					<?php self::render_progress_step( 3, __( 'Details', 'drywall-toolbox' ), __( 'Contact + delivery', 'drywall-toolbox' ), 'active' ); ?>
					<li class="dtb-woo-checkout-progress__connector" aria-hidden="true"></li>
					<?php self::render_progress_step( 4, __( 'Payment', 'drywall-toolbox' ), __( 'Embedded', 'drywall-toolbox' ), 'active' ); ?>
					<li class="dtb-woo-checkout-progress__connector" aria-hidden="true"></li>
					<?php self::render_progress_step( 5, __( 'Receipt', 'drywall-toolbox' ), __( 'Confirmation', 'drywall-toolbox' ), 'pending' ); ?>
				</ol>
				<div class="dtb-woo-checkout-progress__summary">
					<span><?php esc_html_e( 'One synchronized WooCommerce checkout: express options, contact, delivery, payment, and confirmation.', 'drywall-toolbox' ); ?></span>
					<span class="dtb-woo-checkout-progress__track" role="progressbar" aria-label="Checkout completion" aria-valuemin="1" aria-valuemax="5" aria-valuenow="4"><span></span></span>
				</div>
			</nav>

			<section class="dtb-woo-checkout-card" aria-label="Embedded checkout form">
				<div class="dtb-checkout-card__header">
					<div>
						<p class="dtb-checkout-eyebrow"><?php esc_html_e( 'Checkout', 'drywall-toolbox' ); ?></p>
						<h2><?php esc_html_e( 'Complete your order', 'drywall-toolbox' ); ?></h2>
					</div>
					<div class="dtb-checkout-card__badges" aria-label="Payment safeguards">
						<span><?php esc_html_e( 'WooPayments', 'drywall-toolbox' ); ?></span>
						<span><?php esc_html_e( 'Encrypted', 'drywall-toolbox' ); ?></span>
					</div>
				</div>
				<?php
				if ( $has_markup ) {
					echo $checkout_markup; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- WooCommerce renders trusted checkout markup.
				} else {
					self::render_unavailable_panel();
				}
				?>
			</section>
		</div>
	</main>
	<?php wp_footer(); ?>
</body>
</html>
		<?php
	}

	private static function render_progress_step( int $step, string $label, string $detail, string $state ): void {
		$allowed = [ 'complete', 'active', 'pending' ];
		$state   = in_array( $state, $allowed, true ) ? $state : 'pending';
		$classes = 'dtb-woo-checkout-progress__step is-' . $state;
		?>
		<li class="<?php echo esc_attr( $classes ); ?>"<?php echo 'active' === $state ? ' aria-current="step"' : ''; ?>>
			<span class="dtb-woo-checkout-progress__circle" aria-hidden="true"><?php echo esc_html( (string) $step ); ?></span>
			<span class="dtb-woo-checkout-progress__info"><span><?php echo esc_html( $label ); ?></span><strong><?php echo esc_html( $detail ); ?></strong></span>
		</li>
		<?php
	}

	private static function render_checkout_runtime(): string {
		$checkout_page_id = function_exists( 'wc_get_page_id' ) ? (int) wc_get_page_id( 'checkout' ) : 0;
		$page_content     = $checkout_page_id > 0 ? (string) get_post_field( 'post_content', $checkout_page_id ) : '';

		if ( '' !== trim( $page_content ) && ( has_block( 'woocommerce/checkout', $page_content ) || has_shortcode( $page_content, 'woocommerce_checkout' ) ) ) {
			$rendered = apply_filters( 'the_content', $page_content );
			if ( '' !== trim( (string) $rendered ) ) {
				return (string) $rendered;
			}
		}

		if ( function_exists( 'do_blocks' ) && self::has_checkout_block_support() ) {
			$markup = do_blocks( '<!-- wp:woocommerce/checkout {"className":"dtb-woo-checkout-block"} /-->' );
			if ( '' !== trim( (string) $markup ) ) {
				return (string) $markup;
			}
		}

		return do_shortcode( '[woocommerce_checkout]' );
	}

	private static function render_unavailable_panel(): void {
		?>
		<div class="dtb-woo-checkout-unavailable" role="alert">
			<h2><?php esc_html_e( 'Checkout is temporarily unavailable', 'drywall-toolbox' ); ?></h2>
			<p><?php esc_html_e( 'The checkout page did not return a WooCommerce checkout form. Confirm the Checkout page assignment and WooPayments configuration before accepting orders.', 'drywall-toolbox' ); ?></p>
			<a href="<?php echo esc_url( wc_get_cart_url() ); ?>"><?php esc_html_e( 'Return to cart', 'drywall-toolbox' ); ?></a>
		</div>
		<?php
	}

	private static function has_checkout_block_support(): bool {
		return function_exists( 'WC' ) && class_exists( 'Automattic\\WooCommerce\\Blocks\\Package' );
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

	private static function tag_order( WC_Order $order, string $source ): void {
		$order->update_meta_data( '_dtb_checkout_gateway', self::CHECKOUT_GATEWAY );
		$order->update_meta_data( '_dtb_checkout_contract_version', self::CONTRACT_VERSION );
		$order->update_meta_data( '_dtb_checkout_source', sanitize_key( $source ) );
		$order->update_meta_data( '_dtb_order_type', 'product' );
		if ( function_exists( 'dtb_detect_storefront_base_path' ) ) {
			$order->update_meta_data( '_dtb_storefront_base_path', dtb_detect_storefront_base_path() );
		}
	}

	private static function is_woopayments_order( WC_Order $order ): bool {
		$method = sanitize_key( (string) $order->get_payment_method() );
		return self::WOOPAYMENTS_GATEWAY_ID === $method || str_starts_with( $method, self::WOOPAYMENTS_GATEWAY_ID . '_' );
	}

	private static function gateway_reference( WC_Order $order ): string {
		$transaction_id = trim( (string) $order->get_transaction_id() );
		if ( '' !== $transaction_id ) {
			return sanitize_text_field( $transaction_id );
		}

		$meta_keys = [
			'_wcpay_intent_id',
			'_wcpay_payment_intent_id',
			'_wcpay_charge_id',
			'_wcpay_transaction_id',
			'_stripe_intent_id',
			'_stripe_charge_id',
			'_stripe_source_id',
			'_payment_intent_id',
		];
		foreach ( $meta_keys as $meta_key ) {
			$value = trim( (string) $order->get_meta( $meta_key, true ) );
			if ( '' !== $value ) {
				return sanitize_text_field( $value );
			}
		}
		return '';
	}

	private static function payment_gateways(): array {
		if ( ! function_exists( 'WC' ) || ! WC()->payment_gateways() ) {
			return [];
		}
		$gateways = WC()->payment_gateways()->payment_gateways();
		return is_array( $gateways ) ? $gateways : [];
	}

	private static function is_woopayments_gateway_enabled(): bool {
		return self::is_gateway_enabled( self::WOOPAYMENTS_GATEWAY_ID );
	}

	private static function is_gateway_enabled( string $gateway_id ): bool {
		$gateways = self::payment_gateways();
		$gateway  = $gateways[ $gateway_id ] ?? null;
		return is_object( $gateway ) && isset( $gateway->enabled ) && 'yes' === (string) $gateway->enabled;
	}
}

DTB_WooPaymentsNativeCheckout::register();
