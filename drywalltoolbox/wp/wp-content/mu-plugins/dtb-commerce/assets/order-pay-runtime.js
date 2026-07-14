/* global MutationObserver */
(function () {
	'use strict';

	var rootSelector = 'body.dtb-order-pay-runtime';
	var frame = 0;
	var observer = null;

	function root() {
		return document.querySelector(rootSelector);
	}

	function paymentRoot() {
		return document.querySelector('.dtb-op-card');
	}

	function compactText(node) {
		return String((node && node.textContent) || '').replace(/\s+/g, ' ').trim();
	}

	function methodKey(method) {
		var input = method ? method.querySelector('input[type="radio"]') : null;
		var label = method ? method.querySelector('label') : null;
		return String(
			(method ? method.className : '') + ' ' +
			(input ? input.id + ' ' + input.value + ' ' + input.name : '') + ' ' +
			(label ? label.textContent : '')
		).toLowerCase();
	}

	function paymentBoxHasDetail(method) {
		var box = method && method.querySelector('.payment_box');
		if (!box) {
			return false;
		}

		var clone = box.cloneNode(true);
		Array.prototype.slice.call(clone.querySelectorAll('.dtb-sheet-close')).forEach(function (node) {
			node.remove();
		});

		return Boolean(
			compactText(clone) ||
			clone.querySelector('input, select, textarea, iframe, button:not(.dtb-sheet-close), .StripeElement, .wcpay-upe-element, .wcpay-payment-element')
		);
	}

	function classifyGateway(method) {
		var key = methodKey(method);
		method.classList.remove('dtb-op-gateway-express', 'dtb-op-gateway-paylater', 'dtb-op-gateway-card');
		method.removeAttribute('data-dtb-gateway-kind');

		if (/apple|google|paypal|wallet/.test(key)) {
			method.classList.add('dtb-op-gateway-express');
			method.setAttribute('data-dtb-gateway-kind', 'express');
			return;
		}

		if (/affirm|klarna|afterpay|cash app|pay later|paylater/.test(key)) {
			method.classList.add('dtb-op-gateway-paylater');
			method.setAttribute('data-dtb-gateway-kind', 'paylater');
			return;
		}

		method.classList.add('dtb-op-gateway-card');
		method.setAttribute('data-dtb-gateway-kind', 'card');
	}

	function orderTotalText() {
		var total = document.querySelector('.dtb-op-card table.shop_table tfoot tr.order-total td');
		if (!total) {
			total = document.querySelector('.dtb-op-card table.shop_table tfoot tr:last-child td');
		}

		var text = compactText(total);
		var match = text.match(/\$\s?[\d,]+(?:\.\d{2})?/);
		return match ? match[0].replace(/\$\s+/, '$') : '';
	}

	function syncPayButton() {
		var button = document.querySelector('.dtb-op-card #place_order');
		if (!button) {
			return;
		}

		var total = orderTotalText();
		var label = total ? 'Pay ' + total + ' securely' : 'Pay securely';

		if (!button.dataset.dtbOriginalText) {
			button.dataset.dtbOriginalText = compactText(button);
		}
		if (compactText(button) !== label) {
			button.textContent = label;
		}
		button.setAttribute('aria-label', label);

		var placeOrder = button.closest('.place-order');
		if (placeOrder && !placeOrder.querySelector('.dtb-op-cta-trust')) {
			var trust = document.createElement('div');
			trust.className = 'dtb-op-cta-trust';
			trust.textContent = 'Encrypted payment. No charge until gateway confirmation.';
			placeOrder.appendChild(trust);
		}
	}

	function repairLogoFallback() {
		var logo = document.querySelector('.dtb-op-logo');
		if (!logo) {
			return;
		}

		var wordmark = logo.parentElement && logo.parentElement.querySelector('.dtb-op-wordmark');
		if (!wordmark) {
			return;
		}

		var useFallback = function () {
			if (!logo.naturalWidth) {
				logo.style.display = 'none';
				wordmark.style.display = 'inline-flex';
			}
		};

		logo.addEventListener('error', useFallback, { once: true });
		window.setTimeout(useFallback, 400);
	}

	function clearLegacySheetState() {
		var body = root();
		if (body) {
			body.classList.remove('dtb-payment-sheet-open');
		}

		Array.prototype.slice.call(document.querySelectorAll('.dtb-payment-sheet-current')).forEach(function (node) {
			node.classList.remove('dtb-payment-sheet-current');
		});
	}

	function syncMethods() {
		var host = paymentRoot();
		if (!host) {
			return;
		}

		Array.prototype.slice.call(host.querySelectorAll('.wc_payment_method')).forEach(function (method) {
			classifyGateway(method);

			var input = method.querySelector('input[type="radio"]');
			var label = method.querySelector('label');
			var active = Boolean(input && input.checked);
			var hasDetail = paymentBoxHasDetail(method);

			method.classList.toggle('dtb-op-payment-active', active);
			method.classList.toggle('dtb-op-payment-has-detail', hasDetail);
			method.setAttribute('data-dtb-payment-active', active ? 'true' : 'false');
			method.setAttribute('data-dtb-payment-has-detail', hasDetail ? 'true' : 'false');

			if (label && !label.getAttribute('aria-label')) {
				var name = compactText(label);
				if (name) {
					label.setAttribute('aria-label', name);
				}
			}
		});
	}

	function sync() {
		frame = 0;
		if (!root()) {
			return;
		}

		clearLegacySheetState();
		repairLogoFallback();
		syncMethods();
		syncPayButton();
	}

	function schedule() {
		if (frame) {
			return;
		}
		frame = window.requestAnimationFrame(sync);
	}

	function bind() {
		if (!root()) {
			return;
		}

		document.addEventListener('change', function (event) {
			if (event.target && event.target.matches('.wc_payment_method input[type="radio"]')) {
				schedule();
			}
		});

		document.addEventListener('click', function (event) {
			if (event.target && event.target.closest && event.target.closest('.dtb-op-card .wc_payment_method > label')) {
				window.setTimeout(schedule, 40);
			}
		});

		window.addEventListener('load', schedule, { passive: true });
		window.addEventListener('resize', schedule, { passive: true });
		window.setTimeout(schedule, 500);

		var observed = paymentRoot() || document.body;
		if (observed && typeof MutationObserver !== 'undefined') {
			observer = new MutationObserver(schedule);
			observer.observe(observed, {
				childList: true,
				subtree: true,
				characterData: true,
				attributes: true,
				attributeFilter: ['class', 'checked', 'style'],
			});
		}

		schedule();
	}

	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', bind, { once: true });
	} else {
		bind();
	}

	window.addEventListener('pagehide', function () {
		if (observer) {
			observer.disconnect();
			observer = null;
		}
	});
}());
