<?php
/**
 * Canonical DTB WooCommerce order-pay runtime template.
 *
 * This template gives the public order-pay page a DTB-branded, mobile-first
 * document shell while rendering WooCommerce's official order-pay form. Payment
 * fields, gateway iframes, nonces, tokenization, callbacks, and payment lifecycle
 * remain owned by WooCommerce and the selected gateway plugin.
 *
 * @package drywall-toolbox
 */

defined( 'ABSPATH' ) || exit;

$order_id = function_exists( 'dtb_wc_payment_runtime_order_pay_id' )
	? dtb_wc_payment_runtime_order_pay_id()
	: absint( function_exists( 'get_query_var' ) ? get_query_var( 'order-pay' ) : 0 );

if ( function_exists( 'dtb_wc_payment_runtime_prime_order_pay_query_vars' ) ) {
	dtb_wc_payment_runtime_prime_order_pay_query_vars();
}
if ( function_exists( 'dtb_wc_payment_runtime_prepare_current_order' ) ) {
	dtb_wc_payment_runtime_prepare_current_order();
}

$order       = $order_id > 0 && function_exists( 'wc_get_order' ) ? wc_get_order( $order_id ) : null;
$request_key = function_exists( 'dtb_wc_payment_runtime_request_order_key' )
	? dtb_wc_payment_runtime_request_order_key()
	: ( isset( $_GET['key'] ) ? sanitize_text_field( wp_unslash( $_GET['key'] ) ) : '' ); // phpcs:ignore WordPress.Security.NonceVerification.Recommended

$error_message      = '';
$available_gateways = [];
$order_button_text  = __( 'Pay securely', 'drywall-toolbox' );

if ( ! $order instanceof WC_Order ) {
	$error_message = __( 'This payment link could not be loaded.', 'drywall-toolbox' );
} elseif ( '' === $request_key || ! hash_equals( (string) $order->get_order_key(), $request_key ) ) {
	$error_message = __( 'This payment link could not be verified.', 'drywall-toolbox' );
} elseif ( ! $order->needs_payment() && ( method_exists( $order, 'is_paid' ) && $order->is_paid() ) ) {
	$error_message = __( 'This order has already been paid.', 'drywall-toolbox' );
} elseif ( ! function_exists( 'WC' ) || ! WC() || ! WC()->payment_gateways() ) {
	$error_message = __( 'Payment gateways are not available. Please contact support.', 'drywall-toolbox' );
} else {
	$available_gateways = WC()->payment_gateways()->get_available_payment_gateways();

	uasort(
		$available_gateways,
		static function ( $left, $right ): int {
			$rank = static function ( $gateway ): int {
				$id    = is_object( $gateway ) && isset( $gateway->id ) ? strtolower( (string) $gateway->id ) : '';
				$title = is_object( $gateway ) && isset( $gateway->title ) ? strtolower( wp_strip_all_tags( (string) $gateway->title ) ) : '';
				$key   = $id . ' ' . $title;

				foreach ( [ 'apple' => 10, 'google' => 20, 'paypal' => 30, 'affirm' => 40, 'afterpay' => 50, 'cash app' => 55, 'klarna' => 60 ] as $needle => $value ) {
					if ( false !== strpos( $key, $needle ) ) {
						return $value;
					}
				}

				return false !== strpos( $key, 'card' ) || false !== strpos( $key, 'woocommerce_payments' ) || false !== strpos( $key, 'woopayments' ) ? 90 : 80;
			};

			return $rank( $left ) <=> $rank( $right );
		}
	);

	if ( method_exists( WC()->payment_gateways(), 'set_current_gateway' ) ) {
		WC()->payment_gateways()->set_current_gateway( $available_gateways );
	}

	if ( empty( $available_gateways ) ) {
		$error_message = __( 'No payment methods are currently available for this order. Please contact support.', 'drywall-toolbox' );
	} else {
		$order_button_text = sprintf(
			/* translators: %s: formatted order total */
			__( 'Pay %s securely', 'drywall-toolbox' ),
			wp_strip_all_tags( $order->get_formatted_order_total() )
		);
	}
}

?><!doctype html>
<html <?php language_attributes(); ?>>
<head>
	<meta charset="<?php bloginfo( 'charset' ); ?>">
	<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
	<meta name="robots" content="noindex,nofollow">
	<?php wp_head(); ?>
</head>
<body <?php body_class( 'dtb-order-pay-runtime woocommerce-checkout woocommerce-order-pay' ); ?>>
<?php wp_body_open(); ?>
<header class="dtb-op-header" role="banner">
	<div class="dtb-op-header__inner">
		<a class="dtb-op-brand" href="<?php echo esc_url( home_url( '/' ) ); ?>" aria-label="<?php esc_attr_e( 'Drywall Toolbox home', 'drywall-toolbox' ); ?>">
			<img class="dtb-op-logo" src="<?php echo esc_url( home_url( '/logos/drywall-logo-white.png' ) ); ?>" alt="Drywall Toolbox">
			<span class="dtb-op-wordmark" aria-hidden="true"><span>Drywall</span><strong>Toolbox</strong></span>
		</a>
		<nav class="dtb-op-steps" aria-label="<?php esc_attr_e( 'Checkout progress', 'drywall-toolbox' ); ?>">
			<span class="dtb-op-step dtb-op-step--done"><span class="dtb-op-step__mark">✓</span><span><?php esc_html_e( 'Shipping', 'drywall-toolbox' ); ?></span></span>
			<span class="dtb-op-step__line dtb-op-step__line--done" aria-hidden="true"></span>
			<span class="dtb-op-step dtb-op-step--current"><span class="dtb-op-step__mark">2</span><span><?php esc_html_e( 'Payment', 'drywall-toolbox' ); ?></span></span>
			<span class="dtb-op-step__line" aria-hidden="true"></span>
			<span class="dtb-op-step"><span class="dtb-op-step__mark">3</span><span><?php esc_html_e( 'Review', 'drywall-toolbox' ); ?></span></span>
		</nav>
		<span class="dtb-op-secure-pill"><?php esc_html_e( 'Secure payment', 'drywall-toolbox' ); ?></span>
	</div>
</header>
<main class="dtb-op-main" role="main">
	<div class="dtb-op-topline">
		<a class="dtb-op-back" href="<?php echo esc_url( home_url( '/cart' ) ); ?>">&larr; <?php esc_html_e( 'Back to cart', 'drywall-toolbox' ); ?></a>
		<p class="dtb-op-microcopy"><?php esc_html_e( 'Final step. Your order is reserved while WooCommerce securely verifies payment.', 'drywall-toolbox' ); ?></p>
	</div>
	<section class="dtb-op-card" aria-label="<?php esc_attr_e( 'Order payment', 'drywall-toolbox' ); ?>">
		<?php if ( '' !== $error_message ) : ?>
			<div class="woocommerce"><div class="woocommerce-error" role="alert"><?php echo esc_html( $error_message ); ?></div></div>
		<?php else : ?>
			<div class="woocommerce">
				<?php
				if ( function_exists( 'wc_print_notices' ) ) {
					wc_print_notices();
				}
				wc_get_template(
					'checkout/form-pay.php',
					[
						'order'              => $order,
						'available_gateways' => $available_gateways,
						'order_button_text'  => $order_button_text,
					]
				);
				?>
			</div>
		<?php endif; ?>
	</section>
</main>
<?php wp_footer(); ?>
</body>
</html>
