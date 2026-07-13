<?php
/**
 * Native WooCommerce order-pay runtime template.
 *
 * Renders WooCommerce's official checkout/order-pay shortcode inside a minimal
 * document shell for the headless storefront. This is used while the custom DTB
 * order-pay UI is disabled so gateway fields, wallet buttons, nonces, and
 * WooCommerce payment scripts render through the vendor-owned checkout runtime.
 *
 * @package drywall-toolbox
 */

defined( 'ABSPATH' ) || exit;

$order_id = function_exists( 'dtb_wc_payment_runtime_order_pay_id' )
	? dtb_wc_payment_runtime_order_pay_id()
	: absint( function_exists( 'get_query_var' ) ? get_query_var( 'order-pay' ) : 0 );

if ( function_exists( 'dtb_wc_payment_runtime_prepare_current_order' ) ) {
	dtb_wc_payment_runtime_prepare_current_order();
}

if ( function_exists( 'wc_clear_notices' ) ) {
	wc_clear_notices();
}
?><!doctype html>
<html <?php language_attributes(); ?>>
<head>
	<meta charset="<?php bloginfo( 'charset' ); ?>">
	<meta name="viewport" content="width=device-width, initial-scale=1">
	<meta name="robots" content="noindex,nofollow">
	<?php wp_head(); ?>
	<style>
		.dtb-native-order-pay-shell {
			min-height: 100vh;
			background: #f7f9fc;
			color: #0f172a;
			font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
		}
		.dtb-native-order-pay-header {
			background: #071226;
			border-bottom: 1px solid rgba(148, 163, 184, 0.2);
			padding: 18px 24px;
		}
		.dtb-native-order-pay-header__inner {
			width: min(1120px, calc(100vw - 32px));
			margin: 0 auto;
			display: flex;
			align-items: center;
			justify-content: space-between;
			gap: 16px;
		}
		.dtb-native-order-pay-logo {
			display: block;
			width: clamp(132px, 18vw, 190px);
			height: auto;
		}
		.dtb-native-order-pay-badge {
			border: 1px solid rgba(191, 219, 254, 0.35);
			border-radius: 999px;
			color: #dbeafe;
			font-size: 11px;
			font-weight: 700;
			letter-spacing: 0.08em;
			padding: 8px 14px;
			text-transform: uppercase;
			white-space: nowrap;
		}
		.dtb-native-order-pay-main {
			width: min(1120px, calc(100vw - 32px));
			margin: 0 auto;
			padding: clamp(24px, 4vw, 48px) 0;
		}
		.dtb-native-order-pay-card {
			background: #ffffff;
			border: 1px solid #dbe4f0;
			border-radius: 24px;
			box-shadow: 0 24px 80px rgba(15, 23, 42, 0.12);
			padding: clamp(18px, 3vw, 34px);
		}
		.dtb-native-order-pay-back {
			display: inline-flex;
			align-items: center;
			gap: 8px;
			margin-bottom: 18px;
			color: #315c88;
			font-weight: 600;
			text-decoration: none;
		}
		.dtb-native-order-pay-back:hover,
		.dtb-native-order-pay-back:focus {
			color: #1d4ed8;
			text-decoration: underline;
		}
		.dtb-native-order-pay-card .woocommerce {
			max-width: none;
		}
		.dtb-native-order-pay-card .woocommerce form,
		.dtb-native-order-pay-card .woocommerce .woocommerce-checkout-payment,
		.dtb-native-order-pay-card .woocommerce #payment {
			border-radius: 18px;
		}
		.dtb-native-order-pay-card .button,
		.dtb-native-order-pay-card button.button,
		.dtb-native-order-pay-card #place_order {
			background: linear-gradient(135deg, #2563eb, #3b82f6) !important;
			border: 0 !important;
			border-radius: 14px !important;
			box-shadow: 0 14px 28px rgba(37, 99, 235, 0.22) !important;
			color: #ffffff !important;
			font-weight: 800 !important;
			min-height: 48px;
			padding: 14px 22px !important;
		}
		@media (max-width: 720px) {
			.dtb-native-order-pay-header { padding: 14px 16px; }
			.dtb-native-order-pay-header__inner,
			.dtb-native-order-pay-main { width: min(100% - 20px, 520px); }
			.dtb-native-order-pay-card { border-radius: 18px; padding: 16px; }
			.dtb-native-order-pay-badge { display: none; }
		}
	</style>
</head>
<body <?php body_class( 'dtb-native-order-pay-shell' ); ?>>
<?php wp_body_open(); ?>
<header class="dtb-native-order-pay-header" role="banner">
	<div class="dtb-native-order-pay-header__inner">
		<a href="<?php echo esc_url( home_url( '/' ) ); ?>" aria-label="Drywall Toolbox home">
			<img class="dtb-native-order-pay-logo" src="<?php echo esc_url( home_url( '/logo-white.svg' ) ); ?>" alt="Drywall Toolbox">
		</a>
		<span class="dtb-native-order-pay-badge">Secure payment</span>
	</div>
</header>
<main class="dtb-native-order-pay-main" role="main">
	<a class="dtb-native-order-pay-back" href="<?php echo esc_url( home_url( '/cart' ) ); ?>">&larr; Back to Cart</a>
	<section class="dtb-native-order-pay-card" aria-label="Order payment">
		<?php
		if ( $order_id <= 0 ) {
			echo '<div class="woocommerce-error">' . esc_html__( 'This payment link is missing an order reference.', 'drywall-toolbox' ) . '</div>';
		} elseif ( function_exists( 'do_shortcode' ) ) {
			echo do_shortcode( '[woocommerce_checkout]' );
		} else {
			echo '<div class="woocommerce-error">' . esc_html__( 'WooCommerce checkout is unavailable.', 'drywall-toolbox' ) . '</div>';
		}
		?>
	</section>
</main>
<?php wp_footer(); ?>
</body>
</html>
