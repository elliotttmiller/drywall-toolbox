( function () {
	'use strict';

	const mobileViewport = window.matchMedia( '(max-width: 767px)' );
	const checkoutRootSelector = '.wc-block-checkout';
	const uiStylesheetId = 'dtb-woo-native-checkout-ui';
	const uiVersion = '2026.07.20.1';
	const stepBodyClasses = [ 'dtb-checkout-step-details', 'dtb-checkout-step-payment', 'dtb-checkout-step-review' ];

	const steps = [
		{
			id: 'details',
			label: 'Details',
			selectors: [
				'.wp-block-woocommerce-checkout-express-payment-block',
				'.wc-block-components-express-payment',
				'.wp-block-woocommerce-checkout-contact-information-block',
				'.wp-block-woocommerce-checkout-shipping-address-block',
				'.wp-block-woocommerce-checkout-billing-address-block',
				'.wp-block-woocommerce-checkout-create-account-block',
				'.wp-block-woocommerce-checkout-shipping-method-block',
				'.wp-block-woocommerce-checkout-shipping-methods-block',
				'.wp-block-woocommerce-checkout-pickup-options-block',
			],
		},
		{
			id: 'payment',
			label: 'Payment',
			selectors: [
				'.wp-block-woocommerce-checkout-payment-block',
				'.wp-block-woocommerce-checkout-order-note-block',
			],
		},
		{
			id: 'review',
			label: 'Review',
			selectors: [
				'.wc-block-components-sidebar',
				'.wc-block-checkout__sidebar',
				'.wp-block-woocommerce-checkout-terms-block',
				'.wp-block-woocommerce-checkout-actions-block',
			],
		},
	];

	let activeStep = 0;
	let progress = null;
	let actions = null;
	let initialObserver = null;
	let initializationTimer = 0;

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

	function loadPresentationStyles() {
		return new Promise( ( resolve ) => {
			if ( document.getElementById( uiStylesheetId ) ) {
				resolve();
				return;
			}

			const scriptSrc = document.currentScript?.src || '';
			let href = '/wp-content/mu-plugins/dtb-commerce/assets/woo-native-checkout-ui.css';
			if ( scriptSrc ) {
				try {
					href = new URL( 'woo-native-checkout-ui.css', scriptSrc ).toString();
				} catch {
					// The root content URL fallback remains valid on the tracked deployment.
				}
			}

			const separator = href.includes( '?' ) ? '&' : '?';
			const link = document.createElement( 'link' );
			link.id = uiStylesheetId;
			link.rel = 'stylesheet';
			link.href = `${ href }${ separator }ver=${ encodeURIComponent( uiVersion ) }`;
			link.addEventListener( 'load', resolve, { once: true } );
			link.addEventListener( 'error', resolve, { once: true } );
			document.head.append( link );
			window.setTimeout( resolve, 1500 );
		} );
	}

	function uniqueElements( elements ) {
		return Array.from( new Set( elements.filter( Boolean ) ) );
	}

	function stepElements( stepIndex ) {
		const checkoutRoot = document.querySelector( checkoutRootSelector );
		if ( ! checkoutRoot || ! steps[ stepIndex ] ) {
			return [];
		}

		return uniqueElements(
			steps[ stepIndex ].selectors.flatMap( ( selector ) => Array.from( checkoutRoot.querySelectorAll( selector ) ) )
		).filter( ( node ) => ! node.closest( '.is-dtb-order-summary-duplicate' ) );
	}

	function allStepElements() {
		return uniqueElements( steps.flatMap( ( step, index ) => stepElements( index ) ) );
	}

	function orderSummaryCandidates() {
		const blockSummaries = Array.from( document.querySelectorAll( '.wp-block-woocommerce-checkout-order-summary-block' ) );
		const standaloneSummaries = Array.from( document.querySelectorAll( '.wc-block-components-order-summary' ) )
			.filter( ( node ) => ! node.closest( '.wp-block-woocommerce-checkout-order-summary-block' ) );
		const candidates = uniqueElements( [ ...blockSummaries, ...standaloneSummaries ] );

		return candidates.filter( ( candidate ) => ! candidates.some( ( parent ) => parent !== candidate && parent.contains( candidate ) ) );
	}

	function markDuplicateOrderSummaries() {
		const candidates = orderSummaryCandidates();
		candidates.forEach( ( node ) => node.classList.remove( 'is-dtb-order-summary-duplicate' ) );
		if ( candidates.length < 2 ) {
			return;
		}

		const canonical = candidates.find( ( node ) => node.closest( '.wc-block-components-sidebar, .wc-block-checkout__sidebar' ) ) || candidates[ 0 ];
		candidates.forEach( ( node ) => {
			if ( node !== canonical ) {
				node.classList.add( 'is-dtb-order-summary-duplicate' );
			}
		} );
	}

	function createProgress() {
		const nav = document.createElement( 'nav' );
		nav.className = 'dtb-mobile-checkout-progress';
		nav.setAttribute( 'aria-label', 'Checkout progress' );

		const list = document.createElement( 'ol' );
		list.className = 'dtb-mobile-checkout-progress__track';
		steps.forEach( ( step, index ) => {
			const item = document.createElement( 'li' );
			item.className = 'dtb-mobile-checkout-progress__item';

			const button = document.createElement( 'button' );
			button.type = 'button';
			button.className = 'dtb-mobile-checkout-progress__button';
			button.dataset.step = String( index );
			button.setAttribute( 'aria-label', `Go to ${ step.label }` );

			const number = document.createElement( 'span' );
			number.className = 'dtb-mobile-checkout-progress__number';
			number.textContent = String( index + 1 );

			const label = document.createElement( 'span' );
			label.textContent = step.label;

			button.append( number, label );
			button.addEventListener( 'click', () => showStep( index, true ) );
			item.append( button );
			list.append( item );
		} );

		nav.append( list );
		return nav;
	}

	function createActions() {
		const wrapper = document.createElement( 'div' );
		wrapper.className = 'dtb-mobile-checkout-actions';

		const back = document.createElement( 'button' );
		back.type = 'button';
		back.className = 'dtb-mobile-checkout-actions__back';
		back.textContent = 'Back';
		back.addEventListener( 'click', () => showStep( Math.max( 0, activeStep - 1 ), true ) );

		const next = document.createElement( 'button' );
		next.type = 'button';
		next.className = 'dtb-mobile-checkout-actions__next';
		next.addEventListener( 'click', () => showStep( Math.min( steps.length - 1, activeStep + 1 ), true ) );

		wrapper.append( back, next );
		return wrapper;
	}

	function updateControls() {
		if ( progress ) {
			progress.querySelectorAll( '[data-step]' ).forEach( ( button ) => {
				const index = Number( button.dataset.step );
				button.classList.toggle( 'is-current', index === activeStep );
				button.classList.toggle( 'is-complete', index < activeStep );
				if ( index === activeStep ) {
					button.setAttribute( 'aria-current', 'step' );
				} else {
					button.removeAttribute( 'aria-current' );
				}
			} );
		}

		if ( actions ) {
			const back = actions.querySelector( '.dtb-mobile-checkout-actions__back' );
			const next = actions.querySelector( '.dtb-mobile-checkout-actions__next' );
			actions.hidden = activeStep === steps.length - 1;
			back.hidden = activeStep === 0;
			next.textContent = activeStep === 0 ? 'Continue to payment' : 'Review order';
		}
	}

	function showStep( requestedStep, shouldScroll = false ) {
		if ( ! mobileViewport.matches ) {
			return;
		}

		activeStep = Math.max( 0, Math.min( requestedStep, steps.length - 1 ) );
		allStepElements().forEach( ( node ) => {
			let owningStep = -1;
			steps.some( ( step, index ) => {
				if ( stepElements( index ).includes( node ) ) {
					owningStep = index;
					return true;
				}
				return false;
			} );

			if ( owningStep >= 0 ) {
				node.dataset.dtbCheckoutStep = steps[ owningStep ].id;
				node.hidden = owningStep !== activeStep;
			}
		} );

		document.body.classList.remove( ...stepBodyClasses );
		document.body.classList.add( `dtb-checkout-step-${ steps[ activeStep ].id }` );
		updateControls();

		if ( shouldScroll && progress ) {
			progress.scrollIntoView( {
				behavior: window.matchMedia( '(prefers-reduced-motion: reduce)' ).matches ? 'auto' : 'smooth',
				block: 'start',
			} );
		}
	}

	function teardownMobileEnhancement() {
		document.body.classList.remove( 'dtb-mobile-checkout-enhanced', ...stepBodyClasses );
		document.querySelectorAll( '[data-dtb-checkout-step]' ).forEach( ( node ) => {
			node.hidden = false;
			delete node.dataset.dtbCheckoutStep;
		} );
		progress?.remove();
		actions?.remove();
		progress = null;
		actions = null;
	}

	function mountMobileEnhancement() {
		const checkoutRoot = document.querySelector( checkoutRootSelector );
		const paymentBlock = checkoutRoot?.querySelector( '.wp-block-woocommerce-checkout-payment-block' );
		const orderActions = checkoutRoot?.querySelector( '.wp-block-woocommerce-checkout-actions-block' );
		if ( ! checkoutRoot || ! paymentBlock || ! orderActions ) {
			return false;
		}

		markDuplicateOrderSummaries();
		if ( ! mobileViewport.matches ) {
			teardownMobileEnhancement();
			return true;
		}

		if ( ! progress ) {
			progress = createProgress();
			checkoutRoot.parentNode?.insertBefore( progress, checkoutRoot );
		}
		if ( ! actions ) {
			actions = createActions();
			checkoutRoot.insertAdjacentElement( 'afterend', actions );
		}

		document.body.classList.add( 'dtb-mobile-checkout-enhanced' );
		showStep( activeStep, false );
		return true;
	}

	function initializePresentation() {
		markDuplicateOrderSummaries();
		if ( mountMobileEnhancement() ) {
			revealCheckout();
			return;
		}

		initialObserver = new MutationObserver( () => {
			if ( mountMobileEnhancement() ) {
				initialObserver?.disconnect();
				initialObserver = null;
				window.clearTimeout( initializationTimer );
				revealCheckout();
			}
		} );
		initialObserver.observe( document.body, { childList: true, subtree: true } );

		initializationTimer = window.setTimeout( () => {
			initialObserver?.disconnect();
			initialObserver = null;
			markDuplicateOrderSummaries();
			mountMobileEnhancement();
			revealCheckout();
		}, 5000 );
	}

	function initialize() {
		loadPresentationStyles().finally( initializePresentation );
		mobileViewport.addEventListener( 'change', () => {
			if ( mobileViewport.matches ) {
				mountMobileEnhancement();
			} else {
				teardownMobileEnhancement();
				markDuplicateOrderSummaries();
			}
		} );
	}

	if ( document.readyState === 'loading' ) {
		document.addEventListener( 'DOMContentLoaded', initialize, { once: true } );
	} else {
		initialize();
	}
} )();
