/* global MutationObserver */
(function () {
	'use strict';

	var rootSelector = 'body.dtb-order-pay-runtime';
	var frame = 0;
	var observer = null;
	var syncing = false;
	var submitting = false;
	var lastNoticeSignature = '';
	var mobileQuery = window.matchMedia ? window.matchMedia('(max-width: 760px)') : null;
	var providerClasses = [
		'dtb-op-provider-apple',
		'dtb-op-provider-google',
		'dtb-op-provider-paypal',
		'dtb-op-provider-wallet',
		'dtb-op-provider-paylater',
		'dtb-op-provider-card'
	];

	function root() {
		return document.querySelector(rootSelector);
	}

	function orderForm() {
		return document.querySelector('.dtb-op-card form#order_review');
	}

	function paymentRoot() {
		return document.querySelector('.dtb-op-card');
	}

	function compactText(node) {
		return String((node && node.textContent) || '').replace(/\s+/g, ' ').trim();
	}

	function isMobile() {
		return !mobileQuery || mobileQuery.matches;
	}

	function el(tag, className, textValue) {
		var node = document.createElement(tag);
		if (className) node.className = className;
		if (textValue !== undefined && textValue !== null) node.textContent = textValue;
		return node;
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
		if (!box) return false;

		var clone = box.cloneNode(true);
		Array.prototype.slice.call(clone.querySelectorAll('.dtb-sheet-close')).forEach(function (node) {
			node.remove();
		});

		return Boolean(
			compactText(clone) ||
			clone.querySelector('input, select, textarea, iframe, button:not(.dtb-sheet-close), .StripeElement, .wcpay-upe-element, .wcpay-payment-element')
		);
	}

	function clearProviderClasses(method) {
		method.classList.remove('dtb-op-gateway-express', 'dtb-op-gateway-paylater', 'dtb-op-gateway-card');
		providerClasses.forEach(function (className) { method.classList.remove(className); });
		method.removeAttribute('data-dtb-gateway-kind');
		method.removeAttribute('data-dtb-provider');
	}

	function classifyGateway(method) {
		var key = methodKey(method);
		clearProviderClasses(method);

		if (/apple/.test(key)) {
			method.classList.add('dtb-op-gateway-express', 'dtb-op-provider-apple');
			method.setAttribute('data-dtb-gateway-kind', 'express');
			method.setAttribute('data-dtb-provider', 'apple');
			return 'express';
		}

		if (/google|gpay|g pay/.test(key)) {
			method.classList.add('dtb-op-gateway-express', 'dtb-op-provider-google');
			method.setAttribute('data-dtb-gateway-kind', 'express');
			method.setAttribute('data-dtb-provider', 'google');
			return 'express';
		}

		if (/paypal/.test(key)) {
			method.classList.add('dtb-op-gateway-express', 'dtb-op-provider-paypal');
			method.setAttribute('data-dtb-gateway-kind', 'express');
			method.setAttribute('data-dtb-provider', 'paypal');
			return 'express';
		}

		if (/wallet|shop pay|woopay/.test(key)) {
			method.classList.add('dtb-op-gateway-express', 'dtb-op-provider-wallet');
			method.setAttribute('data-dtb-gateway-kind', 'express');
			method.setAttribute('data-dtb-provider', 'wallet');
			return 'express';
		}

		if (/affirm|klarna|afterpay|cash app|pay later|paylater/.test(key)) {
			method.classList.add('dtb-op-gateway-paylater', 'dtb-op-provider-paylater');
			method.setAttribute('data-dtb-gateway-kind', 'paylater');
			method.setAttribute('data-dtb-provider', 'paylater');
			return 'paylater';
		}

		method.classList.add('dtb-op-gateway-card', 'dtb-op-provider-card');
		method.setAttribute('data-dtb-gateway-kind', 'card');
		method.setAttribute('data-dtb-provider', 'card');
		return 'card';
	}

	function currencyText(value) {
		var text = String(value || '').replace(/\s+/g, ' ').trim();
		var currency = text.match(/(?:USD\s*)?\$\s?[\d,]+(?:\.\d{2})?|[\d,]+(?:\.\d{2})?\s?(?:USD|EUR|GBP|€|£)/i);
		return currency ? currency[0].replace(/\$\s+/, '$') : text;
	}

	function orderTotalText() {
		var total = document.querySelector('.dtb-op-card table.shop_table tfoot tr.order-total td');
		if (!total) total = document.querySelector('.dtb-op-card table.shop_table tfoot tr:last-child td');
		return currencyText(compactText(total));
	}

	function splitNameAndSku(value) {
		var raw = String(value || '').replace(/×\s*\d+/g, ' ').replace(/\s+/g, ' ').trim();
		var sku = '';
		var skuMatch = raw.match(/SKU\s*:?\s*([^\s]+)/i);
		if (skuMatch) {
			sku = skuMatch[1];
			raw = raw.replace(/SKU\s*:?\s*[^\s]+/i, ' ');
		}
		return { name: raw.replace(/\s+/g, ' ').trim(), sku: sku };
	}

	function tableSignature(table) {
		return compactText(table).slice(0, 2000);
	}

	function buildSummaryCard() {
		var currentForm = orderForm();
		var table = currentForm ? currentForm.querySelector('table.shop_table') : null;
		if (!currentForm || !table) return;

		var signature = tableSignature(table);
		var previous = currentForm.querySelector('.dtb-op-summary-card');
		var wasOpen = previous ? previous.classList.contains('is-open') : !isMobile();

		if (previous && previous.getAttribute('data-dtb-signature') === signature) {
			var amount = previous.querySelector('.dtb-op-summary-card__amount');
			if (amount) amount.textContent = orderTotalText();
			document.body.classList.add('dtb-op-summary-enhanced');
			return;
		}
		if (previous) previous.remove();

		var card = el('section', 'dtb-op-summary-card' + (wasOpen ? ' is-open' : ''));
		card.setAttribute('aria-label', 'Order summary');
		card.setAttribute('data-dtb-signature', signature);

		var header = el('div', 'dtb-op-summary-card__header');
		var toggle = el('button', 'dtb-op-summary-card__toggle');
		toggle.type = 'button';
		toggle.setAttribute('aria-expanded', wasOpen ? 'true' : 'false');
		toggle.append(el('span', 'dtb-op-summary-card__title', 'Order summary'));
		toggle.append(el('span', 'dtb-op-summary-card__amount', orderTotalText()));
		toggle.append(el('span', 'dtb-op-summary-card__chevron'));
		toggle.addEventListener('click', function () {
			var nextOpen = !card.classList.contains('is-open');
			card.classList.toggle('is-open', nextOpen);
			toggle.setAttribute('aria-expanded', nextOpen ? 'true' : 'false');
		});
		header.append(toggle);
		card.append(header);

		var items = el('div', 'dtb-op-summary-items');
		Array.prototype.slice.call(table.querySelectorAll('tbody tr.cart_item, tbody tr.order_item')).forEach(function (row) {
			var nameCell = row.querySelector('td.product-name');
			var priceCell = row.querySelector('td.product-total');
			if (!nameCell) return;

			var clone = nameCell.cloneNode(true);
			Array.prototype.slice.call(clone.querySelectorAll('img')).forEach(function (img) { img.remove(); });
			var qtyText = compactText(clone.querySelector('.product-quantity')) || compactText(nameCell.querySelector('.product-quantity'));
			Array.prototype.slice.call(clone.querySelectorAll('.product-quantity')).forEach(function (qty) { qty.remove(); });
			var parts = splitNameAndSku(compactText(clone));

			var item = el('div', 'dtb-op-summary-item');
			var imageWrap = el('div', 'dtb-op-summary-item__image');
			var sourceImg = nameCell.querySelector('img');
			if (sourceImg && sourceImg.getAttribute('src')) {
				var img = document.createElement('img');
				img.src = sourceImg.getAttribute('src');
				img.alt = sourceImg.getAttribute('alt') || parts.name || 'Order item';
				img.loading = 'lazy';
				imageWrap.append(img);
			}

			var meta = el('div', 'dtb-op-summary-item__meta');
			meta.append(el('p', 'dtb-op-summary-item__name', parts.name || 'Order item'));
			var sub = el('div', 'dtb-op-summary-item__sub');
			if (qtyText) sub.append(el('span', '', qtyText.replace(/×/g, 'Qty ')));
			if (parts.sku) sub.append(el('span', '', 'SKU ' + parts.sku));
			meta.append(sub);

			item.append(imageWrap, meta, el('div', 'dtb-op-summary-item__price', currencyText(compactText(priceCell))));
			items.append(item);
		});
		card.append(items);

		var totals = el('div', 'dtb-op-summary-totals');
		Array.prototype.slice.call(table.querySelectorAll('tfoot tr')).forEach(function (row) {
			var label = compactText(row.querySelector('th')).replace(/:$/, '');
			var value = compactText(row.querySelector('td'));
			if (!label || !value || /payment method/i.test(label)) return;
			var isFinal = row.classList.contains('order-total') || /^total$/i.test(label);
			var totalRow = el('div', 'dtb-op-summary-total-row' + (isFinal ? ' dtb-op-summary-total-row--final' : ''));
			totalRow.append(el('span', 'dtb-op-summary-total-row__label', label));
			totalRow.append(el('span', 'dtb-op-summary-total-row__value', currencyText(value)));
			totals.append(totalRow);
		});
		card.append(totals);

		currentForm.insertBefore(card, table);
		document.body.classList.add('dtb-op-summary-enhanced');
	}

	function syncPaymentLead(counts) {
		var payment = document.querySelector('.dtb-op-card #payment');
		var methods = payment ? payment.querySelector('.wc_payment_methods') : null;
		if (!payment || !methods) return;

		var lead = payment.querySelector('.dtb-op-payment-lead');
		if (!lead) {
			lead = el('div', 'dtb-op-payment-lead');
			lead.append(el('div', 'dtb-op-payment-lead__title'));
			lead.append(el('div', 'dtb-op-payment-lead__copy'));
			payment.insertBefore(lead, methods);
		}

		var title = lead.querySelector('.dtb-op-payment-lead__title');
		var copy = lead.querySelector('.dtb-op-payment-lead__copy');
		var hasFastOptions = counts.express > 0 || counts.paylater > 0;
		if (title) title.textContent = hasFastOptions ? 'Express checkout' : 'Payment method';
		if (copy) {
			copy.textContent = hasFastOptions
				? 'Choose Apple Pay, Google Pay, PayPal, pay later, or continue with card.'
				: 'Choose a secure payment method to complete this order.';
		}
	}

	function syncMethods() {
		var host = paymentRoot();
		if (!host) return;

		var counts = { express: 0, paylater: 0, card: 0 };
		Array.prototype.slice.call(host.querySelectorAll('.wc_payment_method')).forEach(function (method) {
			var kind = classifyGateway(method);
			counts[kind] += 1;

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
				if (name) label.setAttribute('aria-label', name);
			}
		});

		syncPaymentLead(counts);
	}

	function syncPayButton() {
		var button = document.querySelector('.dtb-op-card #place_order');
		if (!button) return;

		var total = orderTotalText();
		var label = total ? 'Pay ' + total : 'Pay securely';
		if (!button.dataset.dtbOriginalText) button.dataset.dtbOriginalText = compactText(button);
		if (!submitting && compactText(button) !== label) button.textContent = label;
		button.setAttribute('aria-label', label);

		var placeOrder = button.closest('.place-order');
		if (!placeOrder) return;

		var amountRow = placeOrder.querySelector('.dtb-op-pay-total');
		if (!amountRow) {
			amountRow = el('div', 'dtb-op-pay-total');
			amountRow.append(el('span', 'dtb-op-pay-total__label', 'Total'));
			amountRow.append(el('span', 'dtb-op-pay-total__value'));
			placeOrder.insertBefore(amountRow, placeOrder.firstChild);
		}
		var value = amountRow.querySelector('.dtb-op-pay-total__value');
		if (value) value.textContent = total || '';

		if (!placeOrder.querySelector('.dtb-op-verify-hint')) {
			placeOrder.append(el('div', 'dtb-op-verify-hint', 'Your bank or wallet may ask for secure verification after you tap Pay.'));
		}
		if (!placeOrder.querySelector('.dtb-op-cta-trust')) {
			placeOrder.append(el('div', 'dtb-op-cta-trust', 'Encrypted payment. No charge is completed until your gateway confirms it.'));
		}
	}

	function setSubmitting(next) {
		var body = root();
		var button = document.querySelector('.dtb-op-card #place_order');
		submitting = Boolean(next);
		if (body) body.classList.toggle('dtb-op-payment-submitting', submitting);
		if (button) {
			if (submitting) {
				button.dataset.dtbProcessingText = compactText(button) || button.dataset.dtbOriginalText || '';
				button.textContent = 'Processing payment…';
				button.setAttribute('aria-busy', 'true');
			} else {
				button.removeAttribute('aria-busy');
				syncPayButton();
			}
		}
	}

	function enhanceNotices() {
		var notices = Array.prototype.slice.call(document.querySelectorAll('.dtb-op-card .woocommerce-error, .dtb-op-card .woocommerce-info, .dtb-op-card .woocommerce-message'));
		if (!notices.length) return;

		var signature = notices.map(compactText).join('|').slice(0, 1200);
		notices.forEach(function (notice) {
			if (!notice.querySelector('.dtb-op-notice-title')) {
				var title = notice.classList.contains('woocommerce-error') ? 'Payment could not be completed' : 'Checkout update';
				notice.insertBefore(el('strong', 'dtb-op-notice-title', title), notice.firstChild);
			}
		});

		if (submitting) setSubmitting(false);
		if (signature && signature !== lastNoticeSignature) {
			lastNoticeSignature = signature;
			if (notices[0] && notices[0].scrollIntoView) {
				window.setTimeout(function () {
					notices[0].scrollIntoView({ block: 'center', behavior: 'smooth' });
				}, 80);
			}
		}
	}

	function repairLogoFallback() {
		var logo = document.querySelector('.dtb-op-logo');
		if (!logo) return;
		var wordmark = logo.parentElement && logo.parentElement.querySelector('.dtb-op-wordmark');
		if (!wordmark) return;
		var useFallback = function () {
			if (!logo.naturalWidth) {
				logo.style.display = 'none';
				wordmark.style.display = 'inline-flex';
			}
		};
		logo.addEventListener('error', useFallback, { once: true });
		window.setTimeout(useFallback, 350);
	}

	function clearLegacySheetState() {
		var body = root();
		if (body) body.classList.remove('dtb-payment-sheet-open');
		Array.prototype.slice.call(document.querySelectorAll('.dtb-payment-sheet-current')).forEach(function (node) {
			node.classList.remove('dtb-payment-sheet-current');
		});
	}

	function sync() {
		if (syncing) return;
		syncing = true;
		frame = 0;
		try {
			if (!root()) return;
			clearLegacySheetState();
			repairLogoFallback();
			buildSummaryCard();
			syncMethods();
			syncPayButton();
			enhanceNotices();
		} finally {
			syncing = false;
		}
	}

	function schedule() {
		if (frame) return;
		frame = window.requestAnimationFrame(sync);
	}

	function bindGatewayFeedback() {
		document.addEventListener('submit', function (event) {
			if (event.target && event.target.matches('.dtb-op-card form#order_review')) {
				setSubmitting(true);
			}
		}, true);

		document.addEventListener('click', function (event) {
			var target = event.target;
			if (target && target.closest && target.closest('.dtb-op-card #place_order')) {
				window.setTimeout(function () { setSubmitting(true); }, 0);
			}
		});

		if (window.jQuery) {
			window.jQuery(document.body).on('updated_checkout checkout_error payment_method_selected', function () {
				setSubmitting(false);
				schedule();
			});
		}
	}

	function bind() {
		if (!root()) return;

		document.addEventListener('change', function (event) {
			if (event.target && event.target.matches('.wc_payment_method input[type="radio"]')) schedule();
		});

		document.addEventListener('click', function (event) {
			if (event.target && event.target.closest && event.target.closest('.dtb-op-card .wc_payment_method > label')) {
				window.setTimeout(schedule, 40);
			}
		});

		bindGatewayFeedback();
		window.addEventListener('load', schedule, { passive: true });
		window.addEventListener('resize', schedule, { passive: true });
		if (mobileQuery && mobileQuery.addEventListener) mobileQuery.addEventListener('change', schedule);
		window.setTimeout(schedule, 450);

		var observed = orderForm() || paymentRoot() || document.body;
		if (observed && typeof MutationObserver !== 'undefined') {
			observer = new MutationObserver(schedule);
			observer.observe(observed, {
				childList: true,
				subtree: true,
				attributes: true,
				attributeFilter: ['class', 'checked', 'disabled'],
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
