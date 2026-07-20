<?php
/**
 * Standard document host for the assigned WooCommerce Checkout page.
 *
 * This template intentionally delegates checkout rendering to the page content
 * and WooCommerce. It does not manually instantiate Checkout Block, payment
 * methods, Stripe fields, order creation, or endpoint handlers.
 * DTB_OfficialStripeNativeCheckout owns the canonical checkout integration
 * assets and dependencies; this document loads only a presentation companion
 * that keeps authoritative Woo customer fields visible and refines express
 * wallet framing without replacing provider-owned controls.
 *
 * @package drywall-toolbox
 */

defined( 'ABSPATH' ) || exit;

$storefront_base_path = function_exists( 'dtb_detect_storefront_base_path' )
	? dtb_detect_storefront_base_path()
	: '';
$storefront_home_url  = home_url( $storefront_base_path . '/' );
$checkout_refinement_version = '2026.07.20.1';

wp_enqueue_style(
	'dtb-woo-native-checkout-profile-refinements',
	content_url( 'mu-plugins/dtb-commerce/assets/woo-native-checkout-profile-refinements.css' ),
	[ 'dtb-woo-native-checkout' ],
	$checkout_refinement_version
);
wp_enqueue_script(
	'dtb-woo-native-checkout-profile-refinements',
	content_url( 'mu-plugins/dtb-commerce/assets/woo-native-checkout-profile-refinements.js' ),
	[ 'dtb-woo-native-checkout-ui' ],
	$checkout_refinement_version,
	true
);
wp_script_add_data( 'dtb-woo-native-checkout-profile-refinements', 'strategy', 'defer' );
?><!doctype html>
<html <?php language_attributes(); ?>>
<head>
	<meta charset="<?php bloginfo( 'charset' ); ?>">
	<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover, interactive-widget=resizes-content">
	<meta name="robots" content="noindex,nofollow">
	<!-- Critical boot guard must run before deferred checkout assets and fail open after eight seconds. -->
	<script>document.documentElement.classList.add('dtb-native-checkout-booting');window.setTimeout(function(){document.documentElement.classList.remove('dtb-native-checkout-booting');},8000);</script>
	<style>
		.dtb-native-checkout-loader{position:fixed;z-index:2147483000;inset:0;display:none;min-height:100vh;background:#f8fafc;color:#0f172a;align-items:center;justify-content:center;opacity:1;transition:opacity 260ms cubic-bezier(.4,0,.2,1)}
		html.dtb-native-checkout-booting .dtb-native-checkout-loader{display:flex}
		html.dtb-native-checkout-ready .dtb-native-checkout-loader{opacity:0;pointer-events:none}
		html.dtb-native-checkout-booting .dtb-native-woocommerce-document{overflow:hidden}
		html.dtb-native-checkout-booting .dtb-checkout-header,html.dtb-native-checkout-booting .dtb-native-woocommerce-main{opacity:0}
		.dtb-native-checkout-loader__content{display:flex;flex-direction:column;align-items:center;gap:16px;text-align:center}
		.dtb-native-checkout-loader__spinner{display:grid;width:46px;height:46px;border:1px solid #dbe3ee;border-radius:999px;background:#fff;box-shadow:0 12px 34px rgba(15,23,42,.1);place-items:center}
		.dtb-native-checkout-loader__spinner:before{width:20px;height:20px;border:2px solid #bfdbfe;border-top-color:#1d4ed8;border-radius:999px;content:"";animation:dtb-native-checkout-spin .9s cubic-bezier(.45,0,.55,1) infinite}
		.dtb-native-checkout-loader__content p{margin:0;color:#475569;font:650 14px/1.5 system-ui,sans-serif}
		@keyframes dtb-native-checkout-spin{to{transform:rotate(360deg)}}
		@media (prefers-reduced-motion:reduce){.dtb-native-checkout-loader,.dtb-native-checkout-loader__spinner:before{transition-duration:1ms;animation:none}}
	</style>
	<?php wp_head(); ?>
</head>
<body <?php body_class( 'dtb-native-woocommerce-document' ); ?>>
<?php wp_body_open(); ?>
	<div class="dtb-native-checkout-loader" role="status" aria-live="polite">
		<div class="dtb-native-checkout-loader__content">
			<span class="dtb-native-checkout-loader__spinner" aria-hidden="true"></span>
			<p><?php esc_html_e( 'Preparing your secure checkout…', 'drywall-toolbox' ); ?></p>
		</div>
	</div>
	<header class="dtb-checkout-header">
		<div class="dtb-checkout-header__inner">
			<a class="dtb-checkout-header__brand" href="<?php echo esc_url( $storefront_home_url ); ?>" aria-label="<?php esc_attr_e( 'Return to Drywall Toolbox', 'drywall-toolbox' ); ?>">
				<img src="https://drywalltoolbox.com/logos/logo-white.svg" alt="<?php esc_attr_e( 'Drywall Toolbox', 'drywall-toolbox' ); ?>" width="3000" height="917">
			</a>
			<div class="dtb-checkout-header__secure" aria-label="<?php esc_attr_e( 'Secure checkout powered by Stripe', 'drywall-toolbox' ); ?>">
				<svg aria-hidden="true" viewBox="0 0 24 24" focusable="false">
					<path d="M7.5 10V7.5a4.5 4.5 0 0 1 9 0V10m-10 0h11a1.5 1.5 0 0 1 1.5 1.5v7A1.5 1.5 0 0 1 17.5 20h-11A1.5 1.5 0 0 1 5 18.5v-7A1.5 1.5 0 0 1 6.5 10Z" />
				</svg>
				<img class="dtb-checkout-header__stripe" src="https://drywalltoolbox.com/logos/powered_by_stripe.svg" alt="" aria-hidden="true" width="2340" height="540">
			</div>
		</div>
	</header>
	<main id="primary" class="dtb-native-woocommerce-main" role="main">
		<div class="dtb-checkout-intro">
			<h1><?php esc_html_e( 'Checkout', 'drywall-toolbox' ); ?></h1>
		</div>
		<?php
		if ( have_posts() ) {
			while ( have_posts() ) {
				the_post();
				the_content();
			}
		} else {
			status_header( 404 );
			echo '<div class="woocommerce-error" role="alert">'
				. esc_html__( 'Checkout is temporarily unavailable. Please return to your cart and try again.', 'drywall-toolbox' )
				. '</div>';
		}
		?>
	</main>
<?php wp_footer(); ?>
</body>
</html>
