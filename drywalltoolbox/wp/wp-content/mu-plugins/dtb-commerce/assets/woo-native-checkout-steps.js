( function () {
	'use strict';

	/**
	 * Mechanical checkout boot reveal only.
	 *
	 * WooCommerce Checkout Block and the official WooCommerce Stripe gateway own
	 * checkout sections, validation, navigation, payment controls, eligibility,
	 * and submission. Presentation enhancements live in a separate UI asset so
	 * this mechanical reveal path remains independently rollback-safe.
	 */
	function revealCheckout() {
		window.requestAnimationFrame( () => {
			window.requestAnimationFrame( () => {
				document.documentElement.classList.add( 'dtb-native-checkout-ready' );
				window.setTimeout( () => {
					document.documentElement.classList.remove( 'dtb-native-checkout-booting', 'dtb-native-checkout-ready' );
					document.querySelector( '.dtb-native-checkout-loader' )?.setAttribute( 'aria-hidden', 'true' );
				}, 280 );
			} );
		} );
	}

	if ( document.readyState === 'loading' ) {
		document.addEventListener( 'DOMContentLoaded', revealCheckout, { once: true } );
	} else {
		revealCheckout();
	}
} )();
