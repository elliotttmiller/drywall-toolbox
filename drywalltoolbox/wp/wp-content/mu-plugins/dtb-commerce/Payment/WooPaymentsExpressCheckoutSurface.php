<?php
/**
 * Same-origin WooPayments express-checkout surface for React cart and product UI.
 *
 * React owns placement and presentation state only. WooCommerce owns cart/session
 * and order creation. WooPayments owns wallet eligibility, button rendering,
 * tokenization, payment processing, and webhook-backed payment status.
 *
 * @package drywall-toolbox
 */

defined( 'ABSPATH' ) || exit;

final class DTB_WooPaymentsExpressCheckoutSurface {
	private const QUERY_FLAG             = 'dtb_wcpay_express_surface';
	private const SURFACE_ID_PARAM       = 'dtb_surface_id';
	private const CONTEXT_PARAM          = 'dtb_context';
	private const MESSAGE_TYPE           = 'dtb:woopayments-express-surface';
	private const ASSET_VERSION          = '2026.07.18.3';
	private const WOOPAYMENTS_GATEWAY_ID = 'woocommerce_payments';

	public static function register(): void {
		add_action( 'wp_enqueue_scripts', [ __CLASS__, 'dequeue_optional_tracking_scripts' ], 9999 );
		add_action( 'template_redirect', [ __CLASS__, 'maybe_render' ], 5 );
	}

	public static function maybe_render(): void {
		if ( ! self::is_surface_request() ) {
			return;
		}

		if ( is_admin() || ! function_exists( 'WC' ) ) {
			status_header( 404 );
			nocache_headers();
			exit;
		}

		self::render_surface();
		exit;
	}

	public static function dequeue_optional_tracking_scripts(): void {
		if ( ! self::is_surface_request() ) {
			return;
		}

		self::dequeue_scripts_matching_sources( [ 'frontend-tracks.js' ] );
	}

	private static function is_surface_request(): bool {
		// Public presentation selector only. Provider actions remain protected by
		// WooCommerce session, WooPayments nonces, gateway eligibility, and webhooks.
		return isset( $_GET[ self::QUERY_FLAG ] )
			&& '1' === sanitize_text_field( wp_unslash( $_GET[ self::QUERY_FLAG ] ) ); // phpcs:ignore WordPress.Security.NonceVerification.Recommended
	}

	private static function render_surface(): void {
		$surface_id = isset( $_GET[ self::SURFACE_ID_PARAM ] ) // phpcs:ignore WordPress.Security.NonceVerification.Recommended
			? sanitize_key( wp_unslash( $_GET[ self::SURFACE_ID_PARAM ] ) ) // phpcs:ignore WordPress.Security.NonceVerification.Recommended
			: '';
		$context = isset( $_GET[ self::CONTEXT_PARAM ] ) // phpcs:ignore WordPress.Security.NonceVerification.Recommended
			? sanitize_key( wp_unslash( $_GET[ self::CONTEXT_PARAM ] ) ) // phpcs:ignore WordPress.Security.NonceVerification.Recommended
			: 'cart';
		if ( ! in_array( $context, [ 'cart', 'drawer', 'product' ], true ) ) {
			$context = 'cart';
		}

		status_header( 200 );
		if ( function_exists( 'wc_nocache_headers' ) ) {
			wc_nocache_headers();
		} else {
			nocache_headers();
		}
		header( 'X-Robots-Tag: noindex, nofollow, noarchive', true );
		header( 'X-Frame-Options: SAMEORIGIN', true );
		header( "Content-Security-Policy: frame-ancestors 'self'", true );
		header( 'Referrer-Policy: same-origin', true );

		wp_enqueue_style(
			'dtb-woopayments-express-surface',
			content_url( 'mu-plugins/dtb-commerce/assets/woo-payments-express-surface.css' ),
			[],
			self::ASSET_VERSION
		);

		$surface_payload = [
			'type'      => self::MESSAGE_TYPE,
			'surfaceId' => $surface_id,
			'context'   => $context,
		];
		?>
<!doctype html>
<html <?php language_attributes(); ?>>
<head>
	<meta charset="<?php bloginfo( 'charset' ); ?>">
	<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
	<meta name="robots" content="noindex,nofollow,noarchive">
	<title><?php esc_html_e( 'Express checkout', 'drywall-toolbox' ); ?></title>
	<?php wp_head(); ?>
</head>
<body class="dtb-woopayments-express-surface" data-dtb-context="<?php echo esc_attr( $context ); ?>">
	<?php if ( function_exists( 'wp_body_open' ) ) { wp_body_open(); } ?>
	<main class="dtb-woopayments-express-surface__root" aria-label="Express checkout methods">
		<?php self::render_provider_surface( $context ); ?>
	</main>
	<?php wp_footer(); ?>
	<script>
	(function () {
		'use strict';
		var basePayload = <?php echo wp_json_encode( $surface_payload ); ?>;
		var root = document.querySelector('.dtb-woopayments-express-surface__root');
		var unavailableMarker = document.getElementById('dtb-wcpay-express-unavailable');
		var state = 'loading';
		var timeoutId = null;

		function post(nextState) {
			if (window.parent === window) return;
			state = nextState;
			var height = Math.max(54, Math.ceil((root || document.documentElement).scrollHeight || 54));
			window.parent.postMessage(Object.assign({}, basePayload, {
				state: nextState,
				height: height
			}), window.location.origin);
		}

		function hasVisibleExpressNode() {
			if (unavailableMarker) return false;
			var candidates = document.querySelectorAll([
				'.wc-block-components-express-payment',
				'.wc-block-components-express-payment__event-buttons',
				'.wcpay-express-checkout-wrapper',
				'.wcpay-payment-request-wrapper',
				'#wcpay-payment-request-button',
				'[id*="express-checkout"]',
				'[id*="payment-request"]',
				'[data-block-name="woocommerce/cart-express-payment-block"]',
				'[data-block-name="woocommerce/checkout-express-payment-block"]',
				'iframe[allow*="payment"]'
			].join(','));

			for (var i = 0; i < candidates.length; i += 1) {
				var node = candidates[i];
				var styles = window.getComputedStyle(node);
				var rect = node.getBoundingClientRect();
				if (styles.display !== 'none' && styles.visibility !== 'hidden' && rect.width > 1 && rect.height > 1) {
					return true;
				}
			}
			return false;
		}

		function inspect() {
			if (unavailableMarker) {
				post('unavailable');
				return;
			}
			if (hasVisibleExpressNode()) {
				if (timeoutId) {
					window.clearTimeout(timeoutId);
					timeoutId = null;
				}
				post('ready');
			}
		}

		var observer = new MutationObserver(inspect);
		observer.observe(document.body, {
			childList: true,
			subtree: true,
			attributes: true,
			attributeFilter: ['class', 'style', 'hidden', 'aria-hidden']
		});

		window.addEventListener('load', inspect);
		window.addEventListener('resize', function () {
			if (state === 'ready') post('ready');
		});

		timeoutId = window.setTimeout(function () {
			if (state !== 'ready') post('unavailable');
		}, 8000);

		inspect();
	}());
	</script>
</body>
</html>
		<?php
	}

	private static function render_provider_surface( string $context ): void {
		if ( ! self::is_woopayments_gateway_enabled() ) {
			echo '<span id="dtb-wcpay-express-unavailable" hidden></span>';
			return;
		}

		$markup = 'product' === $context
			? self::render_product_surface()
			: self::render_cart_surface();

		if ( '' === trim( wp_strip_all_tags( $markup ) ) && ! self::looks_like_express_markup( $markup ) ) {
			echo '<span id="dtb-wcpay-express-unavailable" hidden></span>';
			return;
		}

		echo $markup; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- WooCommerce/WooPayments render trusted gateway markup.
	}

	private static function render_cart_surface(): string {
		$blocks = [
			'<!-- wp:woocommerce/cart-express-payment-block {"className":"dtb-wcpay-express-block"} /-->',
			'<!-- wp:woocommerce/checkout-express-payment-block {"className":"dtb-wcpay-express-block"} /-->',
		];

		$out = '';
		foreach ( $blocks as $block ) {
			if ( function_exists( 'do_blocks' ) ) {
				$rendered = (string) do_blocks( $block );
				if ( self::looks_like_express_markup( $rendered ) || '' !== trim( wp_strip_all_tags( $rendered ) ) ) {
					$out .= $rendered;
					break;
				}
			}
		}

		if ( '' !== trim( $out ) ) {
			return $out;
		}

		ob_start();
		do_action( 'woocommerce_proceed_to_checkout' );
		return (string) ob_get_clean();
	}

	private static function render_product_surface(): string {
		$product_id = isset( $_GET['product_id'] ) ? absint( $_GET['product_id'] ) : 0; // phpcs:ignore WordPress.Security.NonceVerification.Recommended
		$quantity   = isset( $_GET['quantity'] ) ? max( 1, absint( $_GET['quantity'] ) ) : 1; // phpcs:ignore WordPress.Security.NonceVerification.Recommended
		if ( $product_id <= 0 || ! function_exists( 'wc_get_product' ) ) {
			return '';
		}

		$surface_product = wc_get_product( $product_id );
		if ( ! $surface_product instanceof WC_Product || ! $surface_product->is_purchasable() || ! $surface_product->is_in_stock() ) {
			return '';
		}

		global $post, $product;
		$previous_post    = $post ?? null;
		$previous_product = $product ?? null;
		$post             = get_post( $product_id ); // phpcs:ignore WordPress.WP.GlobalVariablesOverride.Prohibited
		$product          = $surface_product; // phpcs:ignore WordPress.WP.GlobalVariablesOverride.Prohibited
		if ( $post instanceof WP_Post ) {
			setup_postdata( $post );
		}

		ob_start();
		echo '<div class="dtb-wcpay-product-express-context" data-dtb-product-id="' . esc_attr( (string) $product_id ) . '" data-dtb-quantity="' . esc_attr( (string) $quantity ) . '">';
		if ( function_exists( 'woocommerce_template_single_add_to_cart' ) ) {
			woocommerce_template_single_add_to_cart();
		} else {
			do_action( 'woocommerce_before_add_to_cart_form' );
			do_action( 'woocommerce_before_add_to_cart_button' );
			do_action( 'woocommerce_after_add_to_cart_button' );
			do_action( 'woocommerce_after_add_to_cart_form' );
		}
		echo '</div>';
		$markup = (string) ob_get_clean();

		wp_reset_postdata();
		$post    = $previous_post; // phpcs:ignore WordPress.WP.GlobalVariablesOverride.Prohibited
		$product = $previous_product; // phpcs:ignore WordPress.WP.GlobalVariablesOverride.Prohibited

		return $markup;
	}

	private static function dequeue_scripts_matching_sources( array $fragments ): void {
		global $wp_scripts;

		$handles = [ 'wc-tracks', 'woo-tracks', 'woocommerce-tracks', 'wc-frontend-tracks', 'woocommerce-frontend-tracks' ];
		if ( $wp_scripts instanceof WP_Scripts ) {
			foreach ( $wp_scripts->registered as $handle => $dependency ) {
				$src = is_object( $dependency ) && isset( $dependency->src ) ? (string) $dependency->src : '';
				foreach ( $fragments as $fragment ) {
					if ( '' !== $src && false !== stripos( $src, $fragment ) ) {
						$handles[] = (string) $handle;
						break;
					}
				}
			}
		}

		foreach ( array_unique( array_filter( $handles ) ) as $handle ) {
			wp_dequeue_script( $handle );
		}
	}

	private static function looks_like_express_markup( string $markup ): bool {
		return false !== stripos( $markup, 'express' )
			|| false !== stripos( $markup, 'payment-request' )
			|| false !== stripos( $markup, 'wcpay' )
			|| false !== stripos( $markup, 'apple' )
			|| false !== stripos( $markup, 'google' )
			|| false !== stripos( $markup, 'woopay' );
	}

	private static function is_woopayments_gateway_enabled(): bool {
		if ( ! function_exists( 'WC' ) || ! WC()->payment_gateways() ) {
			return false;
		}
		$gateways = WC()->payment_gateways()->payment_gateways();
		$gateway  = is_array( $gateways ) ? ( $gateways[ self::WOOPAYMENTS_GATEWAY_ID ] ?? null ) : null;
		return is_object( $gateway ) && isset( $gateway->enabled ) && 'yes' === (string) $gateway->enabled;
	}
}

DTB_WooPaymentsExpressCheckoutSurface::register();
