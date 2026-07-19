<?php
/**
 * Standard document host for the assigned WooCommerce Checkout page.
 *
 * This template intentionally delegates checkout rendering to the page content
 * and WooCommerce. It does not manually instantiate Checkout Block, payment
 * methods, Stripe fields, order creation, or endpoint handlers.
 *
 * @package drywall-toolbox
 */

defined( 'ABSPATH' ) || exit;
?><!doctype html>
<html <?php language_attributes(); ?>>
<head>
	<meta charset="<?php bloginfo( 'charset' ); ?>">
	<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
	<meta name="robots" content="noindex,nofollow">
	<?php wp_head(); ?>
</head>
<body <?php body_class( 'dtb-native-woocommerce-document' ); ?>>
<?php wp_body_open(); ?>
<main id="primary" class="dtb-native-woocommerce-main" role="main">
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
