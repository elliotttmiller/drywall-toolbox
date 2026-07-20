( function () {
	'use strict';

	const mobileViewport = window.matchMedia( '(max-width: 767px)' );
	const checkoutRootSelector = '.wc-block-checkout';
	const inactiveStepClass = 'is-dtb-checkout-step-inactive';
	let checkoutObserver = null;
	let bodyObserver = null;
	let reconcileQueued = false;

	const definitions = {
		contact: {
			marker: 'contact',
			selectors: [
				'.wp-block-woocommerce-checkout-contact-information-block',
				'.wc-block-checkout__contact-fields',
				'[data-block-name="woocommerce/checkout-contact-information-block"]',
			],
			fallbackSelectors: [
				'input[type="email"]',
			],
		},
		shippingAddress: {
			marker: 'shipping-address',
			selectors: [
				'.wp-block-woocommerce-checkout-shipping-address-block',
				'.wc-block-checkout__shipping-fields',
				'[data-block-name="woocommerce/checkout-shipping-address-block"]',
			],
			fallbackSelectors: [
				'#shipping',
				'[id="shipping"]',
			],
		},
		billingAddress: {
			marker: 'billing-address',
			selectors: [
				'.wp-block-woocommerce-checkout-billing-address-block',
				'.wc-block-checkout__billing-fields',
				'[data-block-name="woocommerce/checkout-billing-address-block"]',
			],
			fallbackSelectors: [
				'#billing',
				'[id="billing"]',
			],
		},
		shippingMethod: {
			marker: 'shipping-method',
			selectors: [
				'.wp-block-woocommerce-checkout-shipping-method-block',
				'.wp-block-woocommerce-checkout-shipping-methods-block',
				'.wc-block-checkout__shipping-option',
				'.wc-block-checkout__shipping-method',
				'.wp-block-woocommerce-checkout-pickup-options-block',
				'[data-block-name="woocommerce/checkout-shipping-method-block"]',
			],
			fallbackSelectors: [],
		},
	};

	function checkoutRoot() {
		return document.querySelector( checkoutRootSelector );
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

	function uniqueElements( elements ) {
		return Array.from( new Set( elements.filter( Boolean ) ) );
	}

	function safeSectionRoot( node ) {
		if ( ! ( node instanceof Element ) ) {
			return null;
		}

		const explicitRoot = node.closest( [
			'.wp-block-woocommerce-checkout-contact-information-block',
			'.wp-block-woocommerce-checkout-shipping-address-block',
			'.wp-block-woocommerce-checkout-billing-address-block',
			'.wp-block-woocommerce-checkout-shipping-method-block',
			'.wp-block-woocommerce-checkout-shipping-methods-block',
			'.wc-block-checkout__contact-fields',
			'.wc-block-checkout__shipping-fields',
			'.wc-block-checkout__billing-fields',
			'.wc-block-checkout__shipping-option',
			'.wc-block-checkout__shipping-method',
			'.wc-block-components-checkout-step',
		].join( ',' ) );

		if ( ! explicitRoot ) {
			return null;
		}

		if (
			explicitRoot.matches( '.wc-block-checkout, .wc-block-components-main, .wc-block-checkout__main, .wc-block-components-sidebar-layout' )
		) {
			return null;
		}

		return explicitRoot;
	}

	function definitionRoots( definition ) {
		const root = checkoutRoot();
		if ( ! root ) {
			return [];
		}

		const direct = definition.selectors.flatMap( ( selector ) => Array.from( root.querySelectorAll( selector ) ) );
		const fallback = definition.fallbackSelectors.flatMap( ( selector ) =>
			Array.from( root.querySelectorAll( selector ) ).map( safeSectionRoot )
		);

		return uniqueElements( [ ...direct, ...fallback ] ).filter( ( node ) => {
			if ( ! ( node instanceof Element ) ) {
				return false;
			}
			return ! node.closest( '[data-dtb-payment-sheet-owned]' );
		} );
	}

	function setSectionState( node, marker, visible ) {
		if ( ! ( node instanceof Element ) ) {
			return;
		}

		node.dataset.dtbMobileRefinementStep = marker;
		node.classList.toggle( inactiveStepClass, ! visible );
		node.setAttribute( 'aria-hidden', visible ? 'false' : 'true' );
	}

	function reconcileSections() {
		reconcileQueued = false;
		if ( ! mobileViewport.matches ) {
			document.querySelectorAll( '[data-dtb-mobile-refinement-step]' ).forEach( ( node ) => {
				node.classList.remove( inactiveStepClass );
				node.removeAttribute( 'aria-hidden' );
				delete node.dataset.dtbMobileRefinementStep;
			} );
			return;
		}

		const step = activeStep();
		definitionRoots( definitions.contact ).forEach( ( node ) => {
			setSectionState( node, definitions.contact.marker, step === 'contact' );
		} );

		const shippingVisible = step === 'shipping';
		definitionRoots( definitions.shippingAddress ).forEach( ( node ) => {
			setSectionState( node, definitions.shippingAddress.marker, shippingVisible );
		} );
		definitionRoots( definitions.billingAddress ).forEach( ( node ) => {
			setSectionState( node, definitions.billingAddress.marker, shippingVisible );
		} );
		definitionRoots( definitions.shippingMethod ).forEach( ( node ) => {
			setSectionState( node, definitions.shippingMethod.marker, shippingVisible );
		} );
	}

	function queueReconcile() {
		if ( reconcileQueued ) {
			return;
		}
		reconcileQueued = true;
		window.requestAnimationFrame( reconcileSections );
	}

	function bindObservers() {
		bodyObserver?.disconnect();
		checkoutObserver?.disconnect();

		bodyObserver = new MutationObserver( queueReconcile );
		bodyObserver.observe( document.body, {
			attributes: true,
			attributeFilter: [ 'class' ],
		} );

		const root = checkoutRoot();
		if ( root ) {
			checkoutObserver = new MutationObserver( queueReconcile );
			checkoutObserver.observe( root, {
				childList: true,
				subtree: true,
			} );
		}
	}

	function initialize() {
		bindObservers();
		queueReconcile();
		window.setTimeout( queueReconcile, 250 );
		window.setTimeout( queueReconcile, 1000 );

		mobileViewport.addEventListener( 'change', () => {
			bindObservers();
			queueReconcile();
		} );
	}

	if ( document.readyState === 'loading' ) {
		document.addEventListener( 'DOMContentLoaded', initialize, { once: true } );
	} else {
		initialize();
	}
} )();
