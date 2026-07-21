( function () {
	'use strict';

	const mobileViewport = window.matchMedia( '(max-width: 767px)' );
	const checkoutRootSelector = '.wc-block-checkout';
	const dialogChromeClass = 'dtb-payment-sheet-dialog-chrome';
	const dialogTitleId = 'dtb-payment-sheet-dialog-title';
	const totalSelector = '[data-dtb-payment-sheet-total]';
	const focusableSelector = [
		'a[href]',
		'button:not([disabled])',
		'input:not([disabled]):not([type="hidden"])',
		'select:not([disabled])',
		'textarea:not([disabled])',
		'iframe',
		'[tabindex]:not([tabindex="-1"])',
	].join( ',' );
	const providerFrameHosts = [
		'stripe.com',
		'stripe.network',
		'pay.google.com',
		'payments.google.com',
	];

	let bodyObserver = null;
	let mainObserver = null;
	let observedMain = null;
	let cartUnsubscribe = null;
	let previousFormattedTotal = '';
	let reconcileQueued = false;

	function checkoutRoot() {
		return document.querySelector( checkoutRootSelector );
	}

	function checkoutMain() {
		return checkoutRoot()?.querySelector( '.wc-block-components-main, .wc-block-checkout__main' ) || null;
	}

	function isSheetOpen() {
		return mobileViewport.matches && document.body.classList.contains( 'dtb-payment-sheet-open' );
	}

	function legacyCloseButton() {
		return document.querySelector( '.dtb-payment-sheet-close' );
	}

	function legacyBackdrop() {
		return document.querySelector( '.dtb-payment-sheet-backdrop' );
	}

	function requestClose() {
		const closeButton = legacyCloseButton();
		if ( closeButton instanceof HTMLButtonElement ) {
			closeButton.click();
			return;
		}

		const backdrop = legacyBackdrop();
		if ( backdrop instanceof HTMLButtonElement ) {
			backdrop.click();
		}
	}

	function createDialogChrome() {
		const chrome = document.createElement( 'section' );
		chrome.className = dialogChromeClass;
		chrome.setAttribute( 'data-dtb-payment-sheet-dialog-chrome', '1' );

		const topbar = document.createElement( 'div' );
		topbar.className = 'dtb-payment-sheet-dialog-chrome__topbar';

		const heading = document.createElement( 'div' );
		heading.className = 'dtb-payment-sheet-dialog-chrome__heading';

		const eyebrow = document.createElement( 'span' );
		eyebrow.className = 'dtb-payment-sheet-dialog-chrome__eyebrow';
		eyebrow.textContent = 'Secure checkout';

		const title = document.createElement( 'h2' );
		title.id = dialogTitleId;
		title.className = 'dtb-payment-sheet-dialog-chrome__title';
		title.textContent = 'Payment';
		title.tabIndex = -1;

		heading.append( eyebrow, title );

		const close = document.createElement( 'button' );
		close.type = 'button';
		close.className = 'dtb-payment-sheet-dialog-chrome__close';
		close.setAttribute( 'aria-label', 'Close payment sheet' );
		close.innerHTML = '<span aria-hidden="true">&times;</span>';
		close.addEventListener( 'click', requestClose );

		topbar.append( heading, close );

		const context = document.createElement( 'div' );
		context.className = 'dtb-payment-sheet-dialog-chrome__context';
		context.hidden = true;

		const totalGroup = document.createElement( 'div' );
		totalGroup.className = 'dtb-payment-sheet-dialog-chrome__total-group';

		const totalLabel = document.createElement( 'span' );
		totalLabel.className = 'dtb-payment-sheet-dialog-chrome__total-label';
		totalLabel.textContent = 'Total due';

		const total = document.createElement( 'strong' );
		total.className = 'dtb-payment-sheet-dialog-chrome__total';
		total.setAttribute( 'data-dtb-payment-sheet-total', '1' );
		total.setAttribute( 'aria-live', 'polite' );
		total.setAttribute( 'aria-atomic', 'true' );

		totalGroup.append( totalLabel, total );

		const trust = document.createElement( 'span' );
		trust.className = 'dtb-payment-sheet-dialog-chrome__trust';
		trust.textContent = 'Drywall Toolbox · Secure payment powered by Stripe';

		context.append( totalGroup, trust );
		chrome.append( topbar, context );
		return chrome;
	}

	function ensureDialogChrome( main ) {
		let chrome = main.querySelector( `:scope > .${ dialogChromeClass }` );
		if ( ! chrome ) {
			chrome = createDialogChrome();
			main.insertBefore( chrome, main.firstChild );
		}
		return chrome;
	}

	function suppressLegacyChrome() {
		const legacyHeader = document.querySelector( '.dtb-payment-sheet-header' );
		if ( legacyHeader ) {
			legacyHeader.setAttribute( 'aria-hidden', 'true' );
			legacyHeader.classList.add( 'is-dtb-payment-sheet-legacy-chrome-suppressed' );
		}

		const close = legacyCloseButton();
		if ( close instanceof HTMLElement ) {
			close.tabIndex = -1;
			close.setAttribute( 'aria-hidden', 'true' );
		}

		const backdrop = legacyBackdrop();
		if ( backdrop instanceof HTMLElement ) {
			backdrop.tabIndex = -1;
			backdrop.setAttribute( 'aria-hidden', 'true' );
		}
	}

	function setDialogSemantics( main ) {
		main.setAttribute( 'role', 'dialog' );
		main.setAttribute( 'aria-modal', 'true' );
		main.setAttribute( 'aria-labelledby', dialogTitleId );
		main.removeAttribute( 'aria-label' );
	}

	function clearDialogSemantics() {
		const main = checkoutMain();
		if ( main ) {
			main.removeAttribute( 'role' );
			main.removeAttribute( 'aria-modal' );
			main.removeAttribute( 'aria-labelledby' );
		}
		mainObserver?.disconnect();
		mainObserver = null;
		observedMain = null;
	}

	function isProviderFrame( element ) {
		if ( ! ( element instanceof HTMLIFrameElement ) ) {
			return false;
		}
		const rawSource = element.getAttribute( 'src' );
		if ( ! rawSource ) {
			return false;
		}
		try {
			const host = new URL( rawSource, window.location.href ).hostname.toLowerCase();
			return providerFrameHosts.some( ( allowedHost ) => host === allowedHost || host.endsWith( `.${ allowedHost }` ) );
		} catch ( error ) {
			return false;
		}
	}

	function isProviderOwnedFocusTarget( target ) {
		if ( ! ( target instanceof Element ) ) {
			return false;
		}
		if ( isProviderFrame( target ) ) {
			return true;
		}
		const providerFrame = target.closest( 'iframe' );
		return isProviderFrame( providerFrame );
	}

	function isElementVisible( element ) {
		if ( ! ( element instanceof HTMLElement ) ) {
			return element instanceof HTMLIFrameElement;
		}
		if ( element.closest( '[inert], [aria-hidden="true"]' ) ) {
			return false;
		}
		const style = window.getComputedStyle( element );
		return style.display !== 'none' && style.visibility !== 'hidden';
	}

	function focusableElements( main ) {
		return Array.from( main.querySelectorAll( focusableSelector ) ).filter( isElementVisible );
	}

	function internalCloseButton( main = checkoutMain() ) {
		return main?.querySelector( '.dtb-payment-sheet-dialog-chrome__close' ) || null;
	}

	function focusInitialControl( main ) {
		window.requestAnimationFrame( () => {
			window.requestAnimationFrame( () => {
				if ( ! isSheetOpen() ) {
					return;
				}
				const close = internalCloseButton( main );
				if ( close instanceof HTMLElement && ! main.contains( document.activeElement ) && ! isProviderOwnedFocusTarget( document.activeElement ) ) {
					close.focus( { preventScroll: true } );
				}
			} );
		} );
	}

	function handleKeydown( event ) {
		if ( event.key !== 'Tab' || ! isSheetOpen() ) {
			return;
		}

		const main = checkoutMain();
		if ( ! main || isProviderOwnedFocusTarget( event.target ) || isProviderOwnedFocusTarget( document.activeElement ) ) {
			return;
		}

		const focusables = focusableElements( main );
		if ( focusables.length === 0 ) {
			event.preventDefault();
			internalCloseButton( main )?.focus( { preventScroll: true } );
			return;
		}

		const first = focusables[ 0 ];
		const last = focusables[ focusables.length - 1 ];
		const active = document.activeElement;

		if ( event.shiftKey && ( active === first || ! main.contains( active ) ) ) {
			event.preventDefault();
			last.focus();
			return;
		}

		if ( ! event.shiftKey && ( active === last || ! main.contains( active ) ) ) {
			event.preventDefault();
			first.focus();
		}
	}

	function handleFocusIn( event ) {
		if ( ! isSheetOpen() ) {
			return;
		}
		const main = checkoutMain();
		if ( ! main || main.contains( event.target ) || isProviderOwnedFocusTarget( event.target ) ) {
			return;
		}
		const close = internalCloseButton( main );
		if ( close instanceof HTMLElement ) {
			close.focus( { preventScroll: true } );
		}
	}

	function formatCartTotal( totals ) {
		const rawTotal = Number( totals?.total_price );
		const minorUnit = Number( totals?.currency_minor_unit ?? 2 );
		if ( ! Number.isFinite( rawTotal ) || ! Number.isInteger( minorUnit ) || minorUnit < 0 || minorUnit > 6 ) {
			return '';
		}

		const amount = rawTotal / ( 10 ** minorUnit );
		const currency = String( totals?.currency_code || '' ).toUpperCase();
		if ( currency ) {
			try {
				return new Intl.NumberFormat( undefined, {
					style: 'currency',
					currency,
					minimumFractionDigits: minorUnit,
					maximumFractionDigits: minorUnit,
				} ).format( amount );
			} catch ( error ) {
				// Fall through to WooCommerce's supplied prefix/suffix formatting.
			}
		}

		const prefix = String( totals?.currency_prefix || totals?.currency_symbol || '' );
		const suffix = String( totals?.currency_suffix || '' );
		return `${ prefix }${ amount.toFixed( minorUnit ) }${ suffix }`;
	}

	function updateAuthoritativeTotal() {
		const data = window.wp?.data;
		const cartStore = window.wc?.wcBlocksData?.cartStore;
		if ( ! data?.select || ! cartStore ) {
			return false;
		}

		const store = data.select( cartStore );
		const totals = typeof store?.getCartTotals === 'function' ? store.getCartTotals() : null;
		const formattedTotal = formatCartTotal( totals );
		const totalNodes = Array.from( document.querySelectorAll( totalSelector ) );
		const needsDomUpdate = formattedTotal !== previousFormattedTotal || totalNodes.some( ( node ) => node.textContent !== formattedTotal );
		previousFormattedTotal = formattedTotal;
		if ( ! needsDomUpdate ) {
			return true;
		}

		totalNodes.forEach( ( node ) => {
			node.textContent = formattedTotal;
			const context = node.closest( '.dtb-payment-sheet-dialog-chrome__context' );
			if ( context instanceof HTMLElement ) {
				context.hidden = formattedTotal === '';
			}
		} );
		return true;
	}

	function bindCartStore( attempt = 0 ) {
		if ( cartUnsubscribe ) {
			return;
		}
		const data = window.wp?.data;
		const cartStore = window.wc?.wcBlocksData?.cartStore;
		if ( ! data?.subscribe || ! data?.select || ! cartStore ) {
			if ( attempt < 20 ) {
				window.setTimeout( () => bindCartStore( attempt + 1 ), 250 );
			}
			return;
		}

		updateAuthoritativeTotal();
		cartUnsubscribe = data.subscribe( updateAuthoritativeTotal, cartStore );
	}

	function syncVisualViewport() {
		const viewportHeight = window.visualViewport?.height || window.innerHeight;
		if ( Number.isFinite( viewportHeight ) && viewportHeight > 0 ) {
			document.documentElement.style.setProperty( '--dtb-payment-sheet-visual-height', `${ Math.round( viewportHeight ) }px` );
		}
	}

	function observeMain( main ) {
		if ( observedMain === main && mainObserver ) {
			return;
		}
		mainObserver?.disconnect();
		observedMain = main;
		mainObserver = new MutationObserver( () => {
			if ( isSheetOpen() && ! main.querySelector( `:scope > .${ dialogChromeClass }` ) ) {
				queueReconcile();
			}
		} );
		mainObserver.observe( main, { childList: true } );
	}

	function reconcile() {
		reconcileQueued = false;
		syncVisualViewport();
		if ( ! isSheetOpen() ) {
			document.body.classList.remove( 'dtb-payment-sheet-hardened' );
			clearDialogSemantics();
			return;
		}

		const main = checkoutMain();
		if ( ! main ) {
			return;
		}

		document.body.classList.add( 'dtb-payment-sheet-hardened' );
		ensureDialogChrome( main );
		suppressLegacyChrome();
		setDialogSemantics( main );
		observeMain( main );
		updateAuthoritativeTotal();
		focusInitialControl( main );
	}

	function queueReconcile() {
		if ( reconcileQueued ) {
			return;
		}
		reconcileQueued = true;
		window.requestAnimationFrame( reconcile );
	}

	function initialize() {
		document.addEventListener( 'keydown', handleKeydown, true );
		document.addEventListener( 'focusin', handleFocusIn, true );
		mobileViewport.addEventListener( 'change', queueReconcile );
		window.visualViewport?.addEventListener( 'resize', syncVisualViewport );
		window.visualViewport?.addEventListener( 'scroll', syncVisualViewport );
		window.addEventListener( 'orientationchange', syncVisualViewport );

		bodyObserver = new MutationObserver( queueReconcile );
		bodyObserver.observe( document.body, { attributes: true, attributeFilter: [ 'class' ] } );

		bindCartStore();
		syncVisualViewport();
		queueReconcile();
	}

	if ( document.readyState === 'loading' ) {
		document.addEventListener( 'DOMContentLoaded', initialize, { once: true } );
	} else {
		initialize();
	}
} )();
