( function () {
	'use strict';

	const mobileViewport = window.matchMedia( '(max-width: 767px)' );
	const inactiveClass = 'is-dtb-checkout-step-inactive';
	const rootSelector = '.wc-block-checkout';

	const sectionDefinitions = {
		contact: [
			'.wp-block-woocommerce-checkout-contact-information-block',
			'.wc-block-checkout__contact-fields',
			'.wp-block-woocommerce-checkout-create-account-block',
		],
		shipping: [
			'.wp-block-woocommerce-checkout-shipping-address-block',
			'.wc-block-checkout__shipping-fields',
			'.wp-block-woocommerce-checkout-billing-address-block',
			'.wc-block-checkout__billing-fields',
			'.wp-block-woocommerce-checkout-shipping-method-block',
			'.wp-block-woocommerce-checkout-shipping-methods-block',
			'.wc-block-checkout__shipping-option',
			'.wc-block-checkout__shipping-method',
			'.wp-block-woocommerce-checkout-pickup-options-block',
		],
	};

	function root() {
		return document.querySelector( rootSelector );
	}

	function owningSection( node ) {
		return node.closest(
			'.wp-block-woocommerce-checkout-contact-information-block,' +
			'.wp-block-woocommerce-checkout-create-account-block,' +
			'.wp-block-woocommerce-checkout-shipping-address-block,' +
			'.wp-block-woocommerce-checkout-billing-address-block,' +
			'.wp-block-woocommerce-checkout-shipping-method-block,' +
			'.wp-block-woocommerce-checkout-shipping-methods-block,' +
			'.wp-block-woocommerce-checkout-pickup-options-block,' +
			'.wc-block-components-checkout-step'
		) || node;
	}

	function sectionsFor( step ) {
		const checkoutRoot = root();
		if ( ! checkoutRoot ) {
			return [];
		}

		return Array.from( new Set(
			sectionDefinitions[ step ].flatMap( ( selector ) =>
				Array.from( checkoutRoot.querySelectorAll( selector ) ).map( owningSection )
			)
		) );
	}

	function activeStep() {
		if ( document.body.classList.contains( 'dtb-checkout-step-shipping' ) ) {
			return 'shipping';
		}
		if ( document.body.classList.contains( 'dtb-checkout-step-payment' ) ) {
			return 'payment';
		}
		return 'contact';
	}

	function normalize() {
		if ( ! mobileViewport.matches ) {
			return;
		}

		const checkoutRoot = root();
		if ( ! checkoutRoot ) {
			return;
		}

		const current = activeStep();
		Object.keys( sectionDefinitions ).forEach( ( step ) => {
			sectionsFor( step ).forEach( ( section ) => {
				section.dataset.dtbCheckoutStep = step;
				const inactive = current !== step;
				section.classList.toggle( inactiveClass, inactive );
				section.setAttribute( 'aria-hidden', inactive ? 'true' : 'false' );

				if ( ! inactive ) {
					section.querySelectorAll( `.${ inactiveClass }` ).forEach( ( child ) => {
						if ( ! child.hasAttribute( 'data-dtb-payment-sheet-owned' ) ) {
							child.classList.remove( inactiveClass );
							child.setAttribute( 'aria-hidden', 'false' );
						}
					} );
				}
			} );
		} );
	}

	let scheduled = 0;
	function scheduleNormalize() {
		window.clearTimeout( scheduled );
		scheduled = window.setTimeout( normalize, 0 );
	}

	function initialize() {
		normalize();
		new MutationObserver( scheduleNormalize ).observe( document.body, {
			attributes: true,
			attributeFilter: [ 'class' ],
			childList: true,
			subtree: true,
		} );
		mobileViewport.addEventListener( 'change', scheduleNormalize );
		document.addEventListener( 'click', scheduleNormalize, true );
	}

	if ( document.readyState === 'loading' ) {
		document.addEventListener( 'DOMContentLoaded', initialize, { once: true } );
	} else {
		initialize();
	}
} )();
