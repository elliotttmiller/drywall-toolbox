<?php
/**
 * Minimal same-origin surface for the official WooCommerce Stripe Express
 * Checkout Element used by the React mobile cart and cart drawer.
 *
 * The official gateway owns wallet eligibility, Stripe Elements rendering,
 * address/shipping collection, WooCommerce order creation, payment processing,
 * nonces, and webhook reconciliation. DTB only provides a frameable shell.
 *
 * @package drywall-toolbox
 */

defined( 'ABSPATH' ) || exit;

final class DTB_WooStripeExpressCheckoutSurface {
	private const QUERY_FLAG       = 'dtb_express_surface';
	private const SURFACE_ID_PARAM = 'dtb_surface_id';
	private const MESSAGE_TYPE     = 'dtb:express-checkout-surface';
	private const ASSET_VERSION    = '2026.07.18.2';

	private static bool $surface_enabled = false;

	public static function register(): void {
		add_action( 'template_redirect', [ __CLASS__, 'maybe_render' ], 99 );
	}

	public static function maybe_render(): void {
		if ( ! self::is_surface_request() ) {
			return;
		}

		if ( ! function_exists( 'is_checkout' ) || ! is_checkout() || self::is_checkout_endpoint() ) {
			status_header( 404 );
			nocache_headers();
			exit;
		}

		self::$surface_enabled = self::prepare_gateway_context();
		self::render_surface();
	}

	/**
	 * Limit the official ECE surface to Apple Pay / Google Pay and align its
	 * provider-owned button height with the mobile cart layout.
	 *
	 * @param array<string,mixed> $params Official gateway script parameters.
	 * @return array<string,mixed>
	 */
	public static function filter_gateway_params( array $params ): array {
		if ( ! self::$surface_enabled ) {
			return $params;
		}

		if ( isset( $params['stripe'] ) && is_array( $params['stripe'] ) ) {
			$params['stripe']['is_link_enabled']       = false;
			$params['stripe']['is_amazon_pay_enabled'] = false;
		}

		if ( isset( $params['button'] ) && is_array( $params['button'] ) ) {
			$params['button']['height'] = '52';
			$params['button']['radius'] = '8';
		}

		return $params;
	}

	private static function is_surface_request(): bool {
		// Public presentation flag only. Payment actions remain protected by the
		// official gateway's own WooCommerce/Stripe nonces and session validation.
		return isset( $_GET[ self::QUERY_FLAG ] )
			&& '1' === sanitize_text_field( wp_unslash( $_GET[ self::QUERY_FLAG ] ) ); // phpcs:ignore WordPress.Security.NonceVerification.Recommended
	}

	private static function is_checkout_endpoint(): bool {
		return function_exists( 'is_wc_endpoint_url' )
			&& ( is_wc_endpoint_url( 'order-pay' ) || is_wc_endpoint_url( 'order-received' ) );
	}

	/**
	 * The frame is visually embedded in a cart surface but is served from the
	 * existing Woo checkout route. Map cart-enabled express checkout to this
	 * request only so the official gateway can use its checkout-safe order path.
	 * Persistent Stripe settings and vendor source remain untouched.
	 */
	private static function prepare_gateway_context(): bool {
		if ( ! class_exists( 'WC_Stripe_Express_Checkout_Element' ) ) {
			return false;
		}

		$element = WC_Stripe_Express_Checkout_Element::instance();
		if ( ! is_object( $element ) || ! isset( $element->express_checkout_helper ) ) {
			return false;
		}

		$helper = $element->express_checkout_helper;
		if ( ! is_object( $helper ) || ! method_exists( $helper, 'get_button_locations' ) ) {
			return false;
		}

		$locations = $helper->get_button_locations( 'payment_request' );
		if ( ! is_array( $locations ) ) {
			return false;
		}

		if ( ! in_array( 'cart', $locations, true ) && ! in_array( 'checkout', $locations, true ) ) {
			return false;
		}

		if ( ! in_array( 'checkout', $locations, true ) ) {
			$locations[] = 'checkout';
		}

		$settings = isset( $helper->stripe_settings ) && is_array( $helper->stripe_settings )
			? $helper->stripe_settings
			: [];
		$settings['express_checkout_button_locations'] = array_values( array_unique( $locations ) );
		$helper->stripe_settings                        = $settings;

		if ( isset( $element->stripe_settings ) && is_array( $element->stripe_settings ) ) {
			$element->stripe_settings['express_checkout_button_locations'] = $settings['express_checkout_button_locations'];
		}

		if ( method_exists( $helper, 'is_apple_google_pay_enabled' ) && ! $helper->is_apple_google_pay_enabled() ) {
			return false;
		}

		add_filter( 'wc_stripe_express_checkout_params', [ __CLASS__, 'filter_gateway_params' ], 99 );
		return true;
	}

	private static function render_surface(): void {
		$surface_id = isset( $_GET[ self::SURFACE_ID_PARAM ] ) // phpcs:ignore WordPress.Security.NonceVerification.Recommended
			? sanitize_key( wp_unslash( $_GET[ self::SURFACE_ID_PARAM ] ) ) // phpcs:ignore WordPress.Security.NonceVerification.Recommended
			: '';

		status_header( 200 );
		nocache_headers();
		header( 'X-Robots-Tag: noindex, nofollow, noarchive', true );
		header( 'X-Frame-Options: SAMEORIGIN', true );
		header( "Content-Security-Policy: frame-ancestors 'self'", true );
		header( 'Referrer-Policy: same-origin', true );

		wp_enqueue_style(
			'dtb-woo-stripe-express-surface',
			content_url( 'mu-plugins/dtb-commerce/assets/woo-stripe-express-surface.css' ),
			[],
			self::ASSET_VERSION
		);

		$surface_payload = [
			'type'      => self::MESSAGE_TYPE,
			'surfaceId' => $surface_id,
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
<body class="dtb-woo-stripe-express-surface">
	<?php
	if ( function_exists( 'wp_body_open' ) ) {
		wp_body_open();
	}
	?>
	<main class="dtb-woo-stripe-express-surface__root" aria-label="Express checkout methods">
		<?php self::render_gateway_element(); ?>
	</main>
	<?php wp_footer(); ?>
	<script>
	(function () {
		'use strict';
		var basePayload = <?php echo wp_json_encode( $surface_payload ); ?>;
		var root = document.querySelector('.dtb-woo-stripe-express-surface__root');
		var element = document.getElementById('wc-stripe-express-checkout-element');
		var unavailableMarker = document.getElementById('dtb-express-checkout-unavailable');
		var state = 'loading';
		var timeoutId = null;

		function post(nextState) {
			if (window.parent === window) {
				return;
			}
			state = nextState;
			var height = Math.max(52, Math.ceil((root || document.documentElement).scrollHeight || 52));
			window.parent.postMessage(Object.assign({}, basePayload, {
				state: nextState,
				height: height
			}), window.location.origin);
		}

		function inspect() {
			if (unavailableMarker) {
				post('unavailable');
				return;
			}

			element = element || document.getElementById('wc-stripe-express-checkout-element');
			if (!element) {
				return;
			}

			var styles = window.getComputedStyle(element);
			var rect = element.getBoundingClientRect();
			var ready = element.childElementCount > 0
				&& styles.display !== 'none'
				&& styles.visibility !== 'hidden'
				&& rect.width > 1
				&& rect.height > 1;

			if (ready) {
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
			attributeFilter: ['class', 'style', 'hidden']
		});

		window.addEventListener('load', inspect);
		window.addEventListener('resize', function () {
			if (state === 'ready') {
				post('ready');
			}
		});

		timeoutId = window.setTimeout(function () {
			if (state !== 'ready') {
				post('unavailable');
			}
		}, 7000);

		inspect();
	}());
	</script>
</body>
</html>
		<?php
		exit;
	}

	private static function render_gateway_element(): void {
		if ( ! self::$surface_enabled || ! class_exists( 'WC_Stripe_Express_Checkout_Element' ) ) {
			echo '<span id="dtb-express-checkout-unavailable" hidden></span>';
			return;
		}

		$element = WC_Stripe_Express_Checkout_Element::instance();
		if ( ! is_object( $element ) || ! method_exists( $element, 'display_express_checkout_button_html' ) ) {
			echo '<span id="dtb-express-checkout-unavailable" hidden></span>';
			return;
		}

		ob_start();
		$element->display_express_checkout_button_html();
		$markup = (string) ob_get_clean();
		if ( '' === trim( $markup ) ) {
			echo '<span id="dtb-express-checkout-unavailable" hidden></span>';
			return;
		}

		echo $markup; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- Trusted official gateway markup.
	}
}

DTB_WooStripeExpressCheckoutSurface::register();
