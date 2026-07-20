( function () {
	'use strict';

	const mobileViewport = window.matchMedia( '(max-width: 767px)' );
	const checkoutRootSelector = '.wc-block-checkout';
	const inactiveStepClass = 'is-dtb-checkout-step-inactive';
	const sheetOwnedClass = 'is-dtb-payment-sheet-owned';
	const sheetClosedClass = 'is-dtb-payment-sheet-closed';
	const stepBodyClasses = [ 'dtb-checkout-step-contact', 'dtb-checkout-step-shipping', 'dtb-checkout-step-payment' ];
	const sheetCloseDuration = 240;

	const steps = [
		{
			id: 'contact',
			label: 'Contact',
			selectors: [
				'.wp-block-woocommerce-checkout-contact-information-block',
				'.wc-block-checkout__contact-fields',
				'.wp-block-woocommerce-checkout-create-account-block',
			],
		},
		{
			id: 'shipping',
			label: 'Shipping',
			selectors: [
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
		},
		{
			id: 'payment',
			label: 'Payment',
			selectors: [
				'.wc-block-components-sidebar',
				'.wc-block-checkout__sidebar',
				'.wp-block-woocommerce-checkout-terms-block',
				'.wc-block-checkout__terms',
			],
		},
	];

	const paymentSheetSelectors = [
		'.wp-block-woocommerce-checkout-express-payment-block',
		'.wc-block-components-express-payment',
		'.wp-block-woocommerce-checkout-payment-block',
		'.wc-block-checkout__payment-method',
		'.wp-block-woocommerce-checkout-order-note-block',
		'.wc-block-checkout__order-notes',
		'.wp-block-woocommerce-checkout-actions-block',
		'.wc-block-checkout__actions',
	];

	let activeStep = 0;
	let highestVisitedStep = 0;
	let progress = null;
	let actions = null;
	let paymentSheetBackdrop = null;
	let paymentSheetHeader = null;
	let paymentSheetCloseButton = null;
	let paymentSheetOpen = false;
	let paymentSheetClosing = false;
	let paymentSheetCloseTimer = 0;
	let paymentSheetReturnFocus = null;
	let previousBodyOverflow = '';
	let initialObserver = null;
	let initializationTimer = 0;

	function uniqueElements( elements ) {
		return Array.from( new Set( elements.filter( Boolean ) ) );
	}

	function topLevelElements( elements ) {
		return elements.filter( ( candidate ) => ! elements.some( ( parent ) => parent !== candidate && parent.contains( candidate ) ) );
	}

	function checkoutRoot() {
		return document.querySelector( checkoutRootSelector );
	}

	function checkoutMain() {
		return checkoutRoot()?.querySelector( '.wc-block-components-main, .wc-block-checkout__main' ) || null;
	}

	function stepElements( stepIndex ) {
		const root = checkoutRoot();
		if ( ! root || ! steps[ stepIndex ] ) {
			return [];
		}

		const candidates = uniqueElements(
			steps[ stepIndex ].selectors.flatMap( ( selector ) => Array.from( root.querySelectorAll( selector ) ) )
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

	function paymentSheetElements() {
		const root = checkoutRoot();
		if ( ! root ) {
			return [];
		}

		return topLevelElements( uniqueElements(
			paymentSheetSelectors.flatMap( ( selector ) => Array.from( root.querySelectorAll( selector ) ) )
		) );
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

	function markPaymentSheetElements() {
		paymentSheetElements().forEach( ( node ) => {
			node.classList.add( sheetOwnedClass );
			node.dataset.dtbPaymentSheetOwned = '1';
			node.classList.toggle( sheetClosedClass, ! paymentSheetOpen );
			node.setAttribute( 'aria-hidden', paymentSheetOpen ? 'false' : 'true' );
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
				if ( index <= highestVisitedStep && ! paymentSheetOpen ) {
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

	function createActions() {
		const wrapper = document.createElement( 'div' );
		wrapper.className = 'dtb-mobile-checkout-actions';

		const back = document.createElement( 'button' );
		back.type = 'button';
		back.className = 'dtb-mobile-checkout-actions__back';
		back.textContent = 'Back';
		back.addEventListener( 'click', () => {
			if ( ! paymentSheetOpen ) {
				showStep( Math.max( 0, activeStep - 1 ), true );
			}
		} );

		const next = document.createElement( 'button' );
		next.type = 'button';
		next.className = 'dtb-mobile-checkout-actions__next';
		next.addEventListener( 'click', () => {
			if ( activeStep < steps.length - 1 ) {
				const nextStep = activeStep + 1;
				highestVisitedStep = Math.max( highestVisitedStep, nextStep );
				showStep( nextStep, true );
				return;
			}
			openPaymentSheet( next );
		} );

		wrapper.append( back, next );
		return wrapper;
	}

	function ensurePaymentSheetChrome() {
		if ( paymentSheetBackdrop && paymentSheetHeader ) {
			return;
		}

		paymentSheetBackdrop = document.createElement( 'button' );
		paymentSheetBackdrop.type = 'button';
		paymentSheetBackdrop.className = 'dtb-payment-sheet-backdrop';
		paymentSheetBackdrop.setAttribute( 'aria-label', 'Close payment sheet' );
		paymentSheetBackdrop.addEventListener( 'click', () => closePaymentSheet() );

		paymentSheetHeader = document.createElement( 'div' );
		paymentSheetHeader.className = 'dtb-payment-sheet-header';
		paymentSheetHeader.setAttribute( 'aria-hidden', 'true' );

		const handle = document.createElement( 'span' );
		handle.className = 'dtb-payment-sheet-handle';
		handle.setAttribute( 'aria-hidden', 'true' );

		const title = document.createElement( 'h2' );
		title.className = 'dtb-payment-sheet-title';
		title.textContent = 'Complete payment';

		paymentSheetCloseButton = document.createElement( 'button' );
		paymentSheetCloseButton.type = 'button';
		paymentSheetCloseButton.className = 'dtb-payment-sheet-close';
		paymentSheetCloseButton.setAttribute( 'aria-label', 'Close payment sheet' );
		paymentSheetCloseButton.innerHTML = '<span aria-hidden="true">×</span>';
		paymentSheetCloseButton.addEventListener( 'click', () => closePaymentSheet() );

		paymentSheetHeader.append( handle, title, paymentSheetCloseButton );
		document.body.append( paymentSheetBackdrop, paymentSheetHeader );
	}

	function sheetBackgroundElements() {
		return uniqueElements( [
			document.querySelector( '.dtb-checkout-header' ),
			document.querySelector( '.dtb-checkout-intro' ),
			progress,
			document.querySelector( '.wc-block-components-sidebar, .wc-block-checkout__sidebar' ),
			actions,
		] );
	}

	function setSheetBackgroundInert( inert ) {
		sheetBackgroundElements().forEach( ( node ) => {
			if ( inert ) {
				if ( ! node.hasAttribute( 'inert' ) ) {
					node.dataset.dtbPaymentSheetInert = '1';
					node.setAttribute( 'inert', '' );
				}
			} else if ( node.dataset.dtbPaymentSheetInert === '1' ) {
				node.removeAttribute( 'inert' );
				delete node.dataset.dtbPaymentSheetInert;
			}
		} );
	}

	function finishClosingPaymentSheet( restoreFocus ) {
		window.clearTimeout( paymentSheetCloseTimer );
		paymentSheetCloseTimer = 0;
		paymentSheetOpen = false;
		paymentSheetClosing = false;
		document.body.classList.remove( 'dtb-payment-sheet-open', 'dtb-payment-sheet-closing' );
		markPaymentSheetElements();
		setSheetBackgroundInert( false );
		document.body.style.overflow = previousBodyOverflow;

		const main = checkoutMain();
		if ( main ) {
			main.removeAttribute( 'role' );
			main.removeAttribute( 'aria-modal' );
			main.removeAttribute( 'aria-label' );
		}

		paymentSheetHeader?.setAttribute( 'aria-hidden', 'true' );
		if ( restoreFocus && paymentSheetReturnFocus instanceof HTMLElement ) {
			paymentSheetReturnFocus.focus( { preventScroll: true } );
		}
		paymentSheetReturnFocus = null;
	}

	function closePaymentSheet( options = {} ) {
		const { immediate = false, restoreFocus = true } = options;
		if ( ! paymentSheetOpen && ! paymentSheetClosing ) {
			return;
		}

		if ( immediate ) {
			finishClosingPaymentSheet( restoreFocus );
			return;
		}

		paymentSheetClosing = true;
		document.body.classList.add( 'dtb-payment-sheet-closing' );
		paymentSheetCloseTimer = window.setTimeout( () => finishClosingPaymentSheet( restoreFocus ), sheetCloseDuration );
	}

	function openPaymentSheet( trigger ) {
		if ( ! mobileViewport.matches || activeStep !== steps.length - 1 || paymentSheetOpen ) {
			return;
		}

		const main = checkoutMain();
		if ( ! main || paymentSheetElements().length === 0 ) {
			return;
		}

		ensurePaymentSheetChrome();
		paymentSheetReturnFocus = trigger instanceof HTMLElement ? trigger : document.activeElement;
		previousBodyOverflow = document.body.style.overflow;
		paymentSheetOpen = true;
		paymentSheetClosing = false;
		window.clearTimeout( paymentSheetCloseTimer );
		document.body.classList.remove( 'dtb-payment-sheet-closing' );
		document.body.classList.add( 'dtb-payment-sheet-open' );
		document.body.style.overflow = 'hidden';
		markPaymentSheetElements();
		setSheetBackgroundInert( true );

		main.setAttribute( 'role', 'dialog' );
		main.setAttribute( 'aria-modal', 'true' );
		main.setAttribute( 'aria-label', 'Complete payment' );
		paymentSheetHeader?.setAttribute( 'aria-hidden', 'false' );

		window.requestAnimationFrame( () => {
			paymentSheetCloseButton?.focus( { preventScroll: true } );
		} );
	}

	function updateControls() {
		progress?.querySelectorAll( '[data-step]' ).forEach( ( button ) => {
			const index = Number( button.dataset.step );
			button.classList.toggle( 'is-current', index === activeStep );
			button.classList.toggle( 'is-complete', index < activeStep );
			button.disabled = index > highestVisitedStep || paymentSheetOpen;
			if ( index === activeStep ) {
				button.setAttribute( 'aria-current', 'step' );
			} else {
				button.removeAttribute( 'aria-current' );
			}
		} );

		if ( actions ) {
			const back = actions.querySelector( '.dtb-mobile-checkout-actions__back' );
			const next = actions.querySelector( '.dtb-mobile-checkout-actions__next' );
			back.hidden = activeStep === 0;
			next.textContent = activeStep === 0
				? 'Continue to shipping'
				: activeStep === 1
					? 'Review order'
					: 'Continue to payment';
			next.setAttribute( 'aria-expanded', paymentSheetOpen ? 'true' : 'false' );
		}
	}

	function showStep( requestedStep, shouldScroll = false ) {
		if ( ! mobileViewport.matches ) {
			return;
		}

		if ( paymentSheetOpen || paymentSheetClosing ) {
			closePaymentSheet( { immediate: true, restoreFocus: false } );
		}

		activeStep = Math.max( 0, Math.min( requestedStep, steps.length - 1 ) );
		stepElementMap().forEach( ( owningStep, node ) => {
			const inactive = owningStep !== activeStep;
			node.dataset.dtbCheckoutStep = steps[ owningStep ].id;
			node.classList.toggle( inactiveStepClass, inactive );
			node.setAttribute( 'aria-hidden', inactive ? 'true' : 'false' );
		} );

		markPaymentSheetElements();
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

		const sheetOwned = event.target.closest( '[data-dtb-payment-sheet-owned]' );
		if ( sheetOwned ) {
			if ( activeStep !== steps.length - 1 ) {
				highestVisitedStep = steps.length - 1;
				showStep( steps.length - 1, false );
			}
			if ( ! paymentSheetOpen ) {
				openPaymentSheet( actions?.querySelector( '.dtb-mobile-checkout-actions__next' ) );
			}
			return;
		}

		const section = event.target.closest( '[data-dtb-checkout-step]' );
		if ( ! section?.classList.contains( inactiveStepClass ) ) {
			return;
		}

		const stepIndex = steps.findIndex( ( step ) => step.id === section.dataset.dtbCheckoutStep );
		if ( stepIndex >= 0 ) {
			closePaymentSheet( { immediate: true, restoreFocus: false } );
			highestVisitedStep = Math.max( highestVisitedStep, stepIndex );
			showStep( stepIndex, true );
		}
	}

	function handleGlobalKeydown( event ) {
		if ( event.key === 'Escape' && paymentSheetOpen ) {
			event.preventDefault();
			closePaymentSheet();
		}
	}

	function teardownMobileEnhancement() {
		closePaymentSheet( { immediate: true, restoreFocus: false } );
		document.body.classList.remove( 'dtb-mobile-checkout-enhanced', ...stepBodyClasses );
		document.querySelectorAll( '[data-dtb-checkout-step]' ).forEach( ( node ) => {
			node.classList.remove( inactiveStepClass );
			node.removeAttribute( 'aria-hidden' );
			delete node.dataset.dtbCheckoutStep;
		} );
		document.querySelectorAll( '[data-dtb-payment-sheet-owned]' ).forEach( ( node ) => {
			node.classList.remove( sheetOwnedClass, sheetClosedClass );
			node.removeAttribute( 'aria-hidden' );
			delete node.dataset.dtbPaymentSheetOwned;
		} );
		progress?.remove();
		actions?.remove();
		paymentSheetBackdrop?.remove();
		paymentSheetHeader?.remove();
		progress = null;
		actions = null;
		paymentSheetBackdrop = null;
		paymentSheetHeader = null;
		paymentSheetCloseButton = null;
	}

	function mountMobileEnhancement() {
		const root = checkoutRoot();
		const paymentBlock = root?.querySelector( '.wp-block-woocommerce-checkout-payment-block, .wc-block-checkout__payment-method' );
		const orderActions = root?.querySelector( '.wp-block-woocommerce-checkout-actions-block, .wc-block-checkout__actions' );
		const sidebar = root?.querySelector( '.wc-block-components-sidebar, .wc-block-checkout__sidebar' );
		if ( ! root || ! paymentBlock || ! orderActions || ! sidebar ) {
			return false;
		}

		markDuplicateOrderSummaries();
		if ( ! mobileViewport.matches ) {
			teardownMobileEnhancement();
			return true;
		}

		ensurePaymentSheetChrome();
		markPaymentSheetElements();
		if ( ! progress ) {
			progress = createProgress();
			root.parentNode?.insertBefore( progress, root );
		}
		if ( ! actions ) {
			actions = createActions();
			root.insertAdjacentElement( 'afterend', actions );
		}
		if ( root.dataset.dtbStepperFocusBound !== '1' ) {
			root.dataset.dtbStepperFocusBound = '1';
			root.addEventListener( 'focusin', handleCheckoutFocus );
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
		document.addEventListener( 'keydown', handleGlobalKeydown );
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
