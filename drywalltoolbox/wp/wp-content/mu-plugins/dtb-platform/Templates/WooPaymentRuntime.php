<?php
/**
 * Native WooCommerce order-payment runtime template.
 *
 * This file intentionally avoids custom checkout UI, asset suppression, and
 * gateway markup. Payment fields, wallet buttons, scripts, nonces, and notices
 * must be rendered by WooCommerce and the active payment gateway plugins.
 *
 * @package drywall-toolbox
 */

defined( 'ABSPATH' ) || exit;

if ( ! function_exists( 'dtb_payment_runtime_render_native_checkout' ) ) {
	function dtb_payment_runtime_render_native_checkout(): void {
		$order_pay_id = function_exists( 'dtb_wc_payment_runtime_order_pay_id' )
			? dtb_wc_payment_runtime_order_pay_id()
			: 0;

		if ( $order_pay_id > 0 && function_exists( 'dtb_wc_payment_runtime_prepare_payable_order' ) ) {
			dtb_wc_payment_runtime_prepare_payable_order( $order_pay_id );
		}

		if (
			$order_pay_id > 0
			&& class_exists( 'WC_Shortcode_Checkout' )
			&& is_callable( [ 'WC_Shortcode_Checkout', 'order_pay' ] )
		) {
			call_user_func( [ 'WC_Shortcode_Checkout', 'order_pay' ], $order_pay_id );
			return;
		}

		if ( shortcode_exists( 'woocommerce_checkout' ) ) {
			echo do_shortcode( '[woocommerce_checkout]' );
			return;
		}

		echo '<main class="woocommerce"><p>Secure payment is temporarily unavailable. Please contact support.</p></main>';
	}
}

if ( ! function_exists( 'dtb_payment_runtime_logo_url' ) ) {
	function dtb_payment_runtime_logo_url(): string {
		$logo_path = ABSPATH . '../logos/drywall-logo-white.png';
		$logo_url  = home_url( '/logos/drywall-logo-white.png' );

		if ( file_exists( $logo_path ) ) {
			return esc_url( $logo_url );
		}

		return '';
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
<body <?php body_class( 'dtb-payment-runtime woocommerce-checkout woocommerce-order-pay' ); ?>>
<?php wp_body_open(); ?>
<header class="dtb-payment-header">
	<div class="dtb-payment-header-inner">
		<a class="dtb-payment-brand" href="<?php echo esc_url( home_url( '/' ) ); ?>" aria-label="<?php echo esc_attr( get_bloginfo( 'name' ) ?: 'Drywall Toolbox' ); ?>">
			<?php $dtb_payment_logo_url = dtb_payment_runtime_logo_url(); ?>
			<?php if ( $dtb_payment_logo_url ) : ?>
				<img class="dtb-payment-logo" src="<?php echo esc_url( $dtb_payment_logo_url ); ?>" alt="<?php echo esc_attr( get_bloginfo( 'name' ) ); ?>">
			<?php else : ?>
				<strong><?php echo esc_html( get_bloginfo( 'name' ) ?: 'Drywall Toolbox' ); ?></strong>
			<?php endif; ?>
		</a>
		<span class="dtb-payment-secure-pill"><?php esc_html_e( 'Secure Payment', 'drywall-toolbox' ); ?></span>
	</div>
</header>
<main class="dtb-payment-shell">
	<section class="dtb-payment-card" aria-labelledby="dtb-payment-title">
		<a class="dtb-payment-return-link" href="<?php echo esc_url( home_url( '/cart' ) ); ?>"><?php esc_html_e( 'Back to Cart', 'drywall-toolbox' ); ?></a>
		<div id="dtb-express-checkout-top" class="dtb-express-checkout-top" style="display:none" aria-hidden="true"></div>
		<div class="dtb-payment-content woocommerce">
			<?php dtb_payment_runtime_render_native_checkout(); ?>
		</div>
	</section>
</main>
<?php wp_footer(); ?>
</body>
</html>
