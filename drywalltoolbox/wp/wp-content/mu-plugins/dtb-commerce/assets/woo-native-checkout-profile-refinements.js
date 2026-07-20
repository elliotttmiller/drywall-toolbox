( function () {
	'use strict';

	const checkoutRootSelector = '.wc-block-checkout';
	const inactiveStepClass = 'is-dtb-checkout-step-inactive';
	const addressSectionAttribute = 'data-dtb-profile-address-section';
	const contactFieldAttribute = 'data-dtb-profile-contact-field';
	const shippingFieldAttribute = 'data-dtb-profile-shipping-field';
	const contactSectionAttribute = 'data-dtb-profile-contact-section';
	const editAttemptAttribute = 'data-dtb-profile-edit-attempted';
	const shippingAddressSelectors = [
		'.wp-block-woocommerce-checkout-shipping-address-block',
		'.wc-block-checkout__shipping-fields',
		'[data-block-name="woocommerce/checkout-shipping-address-block"]',
	];
	const contactSectionSelectors = [
		'.wp-block-woocommerce-checkout-contact-information-block',
		'.wc-block-checkout__contact-fields',
		'[data-block-name="woocommerce/checkout-contact-information-block"]',
	];
	let reconcileQueued = false;
	let checkoutObserver = null;
	let bodyObserver = null;

	function checkoutRoot() {
		return document.querySelector( checkoutRootSelector );
	}

	function isSignedInCheckout() {
		return document.body.classList.contains( 'logged-in' ) && Boolean( checkoutRoot() );
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

	function uniqueTopLevelElements( selectorList ) {
		const root = checkoutRoot();
		if ( ! root ) {
			return [];
		}

		const candidates = Array.from( new Set(
			selectorList.flatMap( ( selector ) => Array.from( root.querySelectorAll( selector ) ) )
		) );
		return candidates.filter( ( candidate ) => ! candidates.some( ( parent ) => parent !== candidate && parent.contains( candidate ) ) );
	}

	function fieldWrapper( control, section ) {
		const wrapper = control.closest( [
			'.wc-block-components-text-input',
			'.wc-block-components-combobox',
			'.wc-block-components-address-form__field',
			'.components-base-control',
		].join( ',' ) );
		return wrapper && section.contains( wrapper ) ? wrapper : control.parentElement;
	}

	function controlKind( control ) {
		if ( ! ( control instanceof HTMLInputElement || control instanceof HTMLSelectElement ) ) {
			return '';
		}

		const descriptor = [ control.id, control.name, control.autocomplete, control.getAttribute( 'aria-label' ) ]
			.filter( Boolean )
			.join( ' ' )
			.toLowerCase();
		if ( control instanceof HTMLInputElement && control.type === 'email' ) {
			return 'email';
		}
		if ( /(?:first[_-]?name|given-name)/.test( descriptor ) ) {
			return 'first-name';
		}
		if ( /(?:last[_-]?name|family-name)/.test( descriptor ) ) {
			return 'last-name';
		}
		if ( ( control instanceof HTMLInputElement && control.type === 'tel' ) || /(?:phone|\btel\b)/.test( descriptor ) ) {
			return 'phone';
		}
		return '';
	}

	function editableControls( section ) {
		return Array.from( section.querySelectorAll( 'input:not([type="hidden"]):not([disabled]), select:not([disabled])' ) );
	}

	function findNativeEditButton( section ) {
		const explicit = section.querySelector( [
			'.wc-block-components-address-card__edit',
			'.wc-block-components-address-card__edit-button',
			'button[aria-label*="edit" i]',
			'button[aria-label*="change" i]',
		].join( ',' ) );
		if ( explicit instanceof HTMLButtonElement && ! explicit.disabled ) {
			return explicit;
		}

		return Array.from( section.querySelectorAll( 'button' ) ).find( ( button ) =>
			! button.disabled && /^(?:edit|edit address|change|change address)$/i.test( button.textContent.trim() )
		) || null;
	}

	function requestEditableAddressForm( section ) {
		if ( editableControls( section ).length >= 3 || section.getAttribute( editAttemptAttribute ) === '1' ) {
			return;
		}

		const editButton = findNativeEditButton( section );
		if ( ! editButton ) {
			return;
		}

		section.setAttribute( editAttemptAttribute, '1' );
		editButton.click();
	}

	function markContactSections() {
		uniqueTopLevelElements( contactSectionSelectors ).forEach( ( section ) => {
			section.setAttribute( contactSectionAttribute, '1' );
		} );
	}

	function markAddressFields( section ) {
		section.querySelectorAll( `[${ contactFieldAttribute }], [${ shippingFieldAttribute }]` ).forEach( ( wrapper ) => {
			wrapper.removeAttribute( contactFieldAttribute );
			wrapper.removeAttribute( shippingFieldAttribute );
		} );

		editableControls( section ).forEach( ( control ) => {
			const wrapper = fieldWrapper( control, section );
			if ( ! ( wrapper instanceof Element ) ) {
				return;
			}
			const kind = controlKind( control );
			if ( kind === 'first-name' || kind === 'last-name' || kind === 'phone' ) {
				wrapper.setAttribute( contactFieldAttribute, kind );
			} else {
				wrapper.setAttribute( shippingFieldAttribute, '1' );
			}
		} );
	}

	function reconcileSignedInProfileFields() {
		reconcileQueued = false;
		if ( ! isSignedInCheckout() ) {
			return;
		}

		markContactSections();
		const step = activeStep();
		uniqueTopLevelElements( shippingAddressSelectors ).forEach( ( section ) => {
			section.setAttribute( addressSectionAttribute, '1' );
			if ( step === 'contact' || step === 'shipping' ) {
				section.classList.remove( inactiveStepClass );
				section.setAttribute( 'aria-hidden', 'false' );
				requestEditableAddressForm( section );
			}
			markAddressFields( section );
		} );
	}

	function queueReconcile() {
		if ( reconcileQueued ) {
			return;
		}
		reconcileQueued = true;
		window.requestAnimationFrame( reconcileSignedInProfileFields );
	}

	function observeCheckout() {
		const root = checkoutRoot();
		if ( ! root || checkoutObserver ) {
			return;
		}
		checkoutObserver = new MutationObserver( queueReconcile );
		checkoutObserver.observe( root, { childList: true, subtree: true } );
	}

	function initialize() {
		observeCheckout();
		bodyObserver = new MutationObserver( () => {
			observeCheckout();
			queueReconcile();
		} );
		bodyObserver.observe( document.body, { attributes: true, attributeFilter: [ 'class' ] } );
		document.addEventListener( 'input', queueReconcile );
		document.addEventListener( 'change', queueReconcile );
		queueReconcile();
		window.setTimeout( queueReconcile, 400 );
		window.setTimeout( queueReconcile, 1200 );
	}

	if ( document.readyState === 'loading' ) {
		document.addEventListener( 'DOMContentLoaded', initialize, { once: true } );
	} else {
		initialize();
	}
} )();
