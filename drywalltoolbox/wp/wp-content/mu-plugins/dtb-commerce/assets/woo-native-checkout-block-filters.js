( function () {
	'use strict';

	const checkoutFilters = window.wc?.blocksCheckout;
	if ( ! checkoutFilters?.registerCheckoutFilters ) {
		return;
	}

	checkoutFilters.registerCheckoutFilters( 'dtb-native-mobile-checkout', {
		placeOrderButtonLabel: ( defaultValue ) => {
			if ( ! window.matchMedia( '(max-width: 767px)' ).matches ) {
				return defaultValue;
			}

			return 'Pay now';
		},
	} );
} )();
