( function () {
	'use strict';

	const mobileViewport = window.matchMedia( '(max-width: 767px)' );
	const checkoutRootSelector = '.wc-block-checkout';
	const inactiveStepClass = 'is-dtb-checkout-step-inactive';
	const stepBodyClasses = [ 'dtb-checkout-step-details', 'dtb-checkout-step-payment', 'dtb-checkout-step-review' ];

	const steps = [
		{
			id: 'details',
			label: 'Details',
			selectors: [
				'.wp-block-woocommerce-checkout-express-payment-block',
				'.wc-block-components-express-payment',
				'.wp-block-woocommerce-checkout-contact-information-block',
				'.wc-block-checkout__contact-fields',
				'.wp-block-woocommerce-checkout-shipping-address-block',
				'.wc-block-checkout__shipping-fields',
				'.wp-block-woocommerce-checkout-billing-address-block',
				'.wc-block-checkout__billing-fields',
				'.wp-block-woocommerce-checkout-create-account-block',
				'.wp-block-woocommerce-checkout-shipping-method-block',
				'.wp-block-woocommerce-checkout-shipping-methods-block',
				'.wc-block-checkout__shipping-option',
				'.wc-block-checkout__shipping-method',
				'.wp-block-woocommerce-checkout-pickup-options-block',
			],
		},
		{
			id: 'payment',
			label: 'Payment',
			selectors: [
				'.wp-block-woocommerce-checkout-payment-block',
				'.wc-block-checkout__payment-method',
				'.wp-block-woocommerce-checkout-order-note-block',
				'.wc-block-checkout__order-notes',
			],
		},
		{
			id: 'review',
			label: 'Review',
			selectors: [
				'.wc-block-components-sidebar',
				'.wc-block-checkout__sidebar',
				'.wp-block-woocommerce-checkout-terms-block',
				'.wc-block-checkout__terms',
				'.wp-block-woocommerce-checkout-actions-block',
				'.wc-block-checkout__actions',
			],
		},
	];

	let activeStep = 0;
	let highestVisitedStep = 0;
	let progress = null;
	let actions = null;
	let initialObserver = null;
	let initializationTimer = 0;

	function uniqueElements( elements ) {
		return Array.from( new Set( elements.filter( Boolean ) ) );
	}

	function topLevelElements( elements ) {
		return elements.filter( ( candidate ) => ! elements.some( ( parent ) => parent !== candidate && parent.contains( candidate ) ) );
	}

	function stepElements( stepIndex ) {
		const checkoutRoot = document.querySelector( checkoutRootSelector );
		if ( ! checkoutRoot || ! steps[ stepIndex ] ) {
			return [];
		}

		const candidates = uniqueElements(
			steps[ stepIndex ].selectors.flatMap( ( selector ) => Array.from( checkoutRoot.querySelectorAll( selector ) ) )
		).filter( ( node ) => ! node.closest( '.is-dtb-order-summary-duplicate' ) );

		return topLevelElements( candidates );
	}

	function stepElementMap() {
		const map = new Map();
		steps.forEach( ( step, index ) => {
			stepElements( index ).forEach( ( node ) => {
				if ( ! map.has( node ) ) {
					map.set( node, index );
				}
			} );
		} );
		return map;
	}

	function orderSummaryCandidates() {
		const blockSummaries = Array.from( document.querySelectorAll( '.wp-block-woocommerce-checkout-order-summary-block' ) );
		const standaloneSummaries = Array.from( document.querySelectorAll( '.wc-block-components-order-summary' ) )
			.filter( ( node ) => ! node.closest( '.wp-block-woocommerce-checkout-order-summary-block' ) );
		return topLevelElements( uniqueElements( [ ...blockSummaries, ...standaloneSummaries ] ) );
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
			button.addEventListener( 'click', () => {
				if ( index <= highestVisitedStep ) {
					showStep( index, true );
				}
			} );

			const number = document.createElement( 'span' );
			number.className = 'dtb-mobile-checkout-progress__number';
			number.textContent = String( index + 1 );

			const label = document.createElement( 'span' );
			label.textContent = step.label;

			button.append( number, label );
			item.append( button );
			list.append( item );
		} );

		nav.append( list );
		return nav;
	}

	function advanceStep() {
		const nextStep = Math.min( steps.length - 1, activeStep + 1 );
		highestVisitedStep = Math.max( highestVisitedStep, nextStep );
		showStep( nextStep, true );
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
		next.addEventListener( 'click', advanceStep );

		wrapper.append( back, next );
		return wrapper;
	}

	function updateControls() {
		progress?.querySelectorAll( '[data-step]' ).forEach( ( button ) => {
			const index = Number( button.dataset.step );
			button.classList.toggle( 'is-current', index === activeStep );
			button.classList.toggle( 'is-complete', index < activeStep );
			button.disabled = index > highestVisitedStep;
			if ( index === activeStep ) {
				button.setAttribute( 'aria-current', 'step' );
			} else {
				button.removeAttribute( 'aria-current' );
			}
		} );

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
		stepElementMap().forEach( ( owningStep, node ) => {
			const inactive = owningStep !== activeStep;
			node.dataset.dtbCheckoutStep = steps[ owningStep ].id;
			node.classList.toggle( inactiveStepClass, inactive );
			node.setAttribute( 'aria-hidden', inactive ? 'true' : 'false' );
		} );

		document.body.classList.remove( ...stepBodyClasses );
		document.body.classList.add( `dtb-checkout-step-${ steps[ activeStep ].id }` );
		markDuplicateOrderSummaries();
		updateControls();

		if ( shouldScroll && progress ) {
			progress.scrollIntoView( {
				behavior: window.matchMedia( '(prefers-reduced-motion: reduce)' ).matches ? 'auto' : 'smooth',
				block: 'start',
			} );
		}
	}

	function handleCheckoutFocus( event ) {
		if ( ! mobileViewport.matches || ! ( event.target instanceof Element ) ) {
			return;
		}

		const section = event.target.closest( '[data-dtb-checkout-step]' );
		if ( ! section?.classList.contains( inactiveStepClass ) ) {
			return;
		}

		const stepIndex = steps.findIndex( ( step ) => step.id === section.dataset.dtbCheckoutStep );
		if ( stepIndex >= 0 ) {
			highestVisitedStep = Math.max( highestVisitedStep, stepIndex );
			showStep( stepIndex, true );
		}
	}

	function teardownMobileEnhancement() {
		document.body.classList.remove( 'dtb-mobile-checkout-enhanced', ...stepBodyClasses );
		document.querySelectorAll( '[data-dtb-checkout-step]' ).forEach( ( node ) => {
			node.classList.remove( inactiveStepClass );
			node.removeAttribute( 'aria-hidden' );
			delete node.dataset.dtbCheckoutStep;
		} );
		progress?.remove();
		actions?.remove();
		progress = null;
		actions = null;
	}

	function mountMobileEnhancement() {
		const checkoutRoot = document.querySelector( checkoutRootSelector );
		const paymentBlock = checkoutRoot?.querySelector( '.wp-block-woocommerce-checkout-payment-block, .wc-block-checkout__payment-method' );
		const orderActions = checkoutRoot?.querySelector( '.wp-block-woocommerce-checkout-actions-block, .wc-block-checkout__actions' );
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
		if ( checkoutRoot.dataset.dtbStepperFocusBound !== '1' ) {
			checkoutRoot.dataset.dtbStepperFocusBound = '1';
			checkoutRoot.addEventListener( 'focusin', handleCheckoutFocus );
		}

		document.body.classList.add( 'dtb-mobile-checkout-enhanced' );
		showStep( activeStep, false );
		return true;
	}

	function handleViewportChange() {
		if ( mobileViewport.matches ) {
			mountMobileEnhancement();
		} else {
			teardownMobileEnhancement();
			markDuplicateOrderSummaries();
		}
	}

	function initialize() {
		mobileViewport.addEventListener( 'change', handleViewportChange );
		markDuplicateOrderSummaries();
		if ( mountMobileEnhancement() ) {
			window.setTimeout( markDuplicateOrderSummaries, 500 );
			window.setTimeout( markDuplicateOrderSummaries, 1500 );
			return;
		}

		initialObserver = new MutationObserver( () => {
			if ( mountMobileEnhancement() ) {
				initialObserver?.disconnect();
				initialObserver = null;
				window.clearTimeout( initializationTimer );
				window.setTimeout( markDuplicateOrderSummaries, 500 );
				window.setTimeout( markDuplicateOrderSummaries, 1500 );
			}
		} );
		initialObserver.observe( document.body, { childList: true, subtree: true } );

		initializationTimer = window.setTimeout( () => {
			initialObserver?.disconnect();
			initialObserver = null;
			markDuplicateOrderSummaries();
			mountMobileEnhancement();
		}, 5000 );
	}

	if ( document.readyState === 'loading' ) {
		document.addEventListener( 'DOMContentLoaded', initialize, { once: true } );
	} else {
		initialize();
	}
} )();