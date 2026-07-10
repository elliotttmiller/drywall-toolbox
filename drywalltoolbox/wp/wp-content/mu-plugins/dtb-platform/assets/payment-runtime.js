(function () {
  function applyWooPaymentsAppearance(event) {
    var detail = event && event.detail;
    var appearance = detail && detail.appearance;
    if (!appearance) return;

    appearance.theme = 'stripe';
    appearance.labels = 'above';
    appearance.variables = Object.assign({}, appearance.variables || {}, {
      colorPrimary: '#2563eb',
      colorBackground: '#ffffff',
      colorText: '#172033',
      colorDanger: '#b42318',
      colorTextSecondary: '#526077',
      colorTextPlaceholder: '#7a879c',
      fontFamily: 'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      fontSizeBase: '16px',
      borderRadius: '10px',
      spacingUnit: '4px'
    });

    appearance.rules = Object.assign({}, appearance.rules || {}, {
      '.AccordionItem': {
        backgroundColor: '#ffffff',
        border: '1px solid #d9e2ec',
        borderRadius: '12px',
        boxShadow: 'none'
      },
      '.Block': {
        backgroundColor: '#ffffff',
        border: '1px solid #d9e2ec',
        borderRadius: '12px',
        boxShadow: 'none'
      },
      '.Input': {
        backgroundColor: '#ffffff',
        border: '1px solid #b8c5d6',
        borderRadius: '10px',
        boxShadow: '0 1px 2px rgba(15, 23, 42, 0.04)',
        color: '#172033',
        padding: '12px'
      },
      '.Input:focus': {
        border: '1px solid #2563eb',
        boxShadow: '0 0 0 3px rgba(37, 99, 235, 0.14)',
        outline: 'none'
      },
      '.Input--invalid': {
        border: '1px solid #d92d20',
        boxShadow: '0 0 0 3px rgba(217, 45, 32, 0.1)'
      },
      '.Label': {
        color: '#344054',
        fontSize: '14px',
        fontWeight: '600'
      },
      '.Tab': {
        backgroundColor: '#ffffff',
        border: '1px solid #d9e2ec',
        borderRadius: '10px',
        boxShadow: 'none',
        color: '#344054'
      },
      '.Tab:hover': {
        backgroundColor: '#f7fafc',
        border: '1px solid #9fb0c3',
        color: '#172033'
      },
      '.Tab--selected': {
        backgroundColor: '#eff6ff',
        border: '1px solid #2563eb',
        boxShadow: '0 0 0 2px rgba(37, 99, 235, 0.12)',
        color: '#1e3a8a'
      },
      '.Text': {
        color: '#526077'
      }
    });
  }

  document.addEventListener('wcpay_elements_appearance', applyWooPaymentsAppearance);

  function compactText(value) {
    return String(value || '').replace(/\s+/g, ' ').trim().toLowerCase();
  }

  function readableText(value) {
    return String(value || '').replace(/\s+/g, ' ').trim();
  }

  function escapeHtml(value) {
    return readableText(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function signatureFor(element) {
    if (!element || element.nodeType !== 1) return '';

    var attrs = [
      element.id,
      element.className,
      element.getAttribute('aria-label'),
      element.getAttribute('title'),
      element.getAttribute('name'),
      element.getAttribute('data-testid'),
      element.getAttribute('data-payment-method'),
      element.getAttribute('src'),
      element.textContent
    ];

    var media = element.querySelectorAll ? element.querySelectorAll('img, svg, iframe') : [];
    Array.prototype.forEach.call(media, function (item) {
      attrs.push(item.getAttribute('alt'));
      attrs.push(item.getAttribute('aria-label'));
      attrs.push(item.getAttribute('title'));
      attrs.push(item.getAttribute('src'));
      attrs.push(item.className);
      attrs.push(item.id);
      attrs.push(item.textContent);
    });

    return compactText(attrs.join(' '));
  }

  function providerKeyFor(element) {
    var signature = signatureFor(element);

    if (signature.indexOf('apple pay') !== -1 || signature.indexOf('applepay') !== -1) return 'apple-pay';
    if (signature.indexOf('google pay') !== -1 || signature.indexOf('gpay') !== -1 || signature.indexOf('g pay') !== -1) return 'google-pay';
    if (signature.indexOf('woo pay') !== -1 || signature.indexOf('woopay') !== -1) return 'disabled-woopay';
    if (signature.indexOf('afterpay') !== -1 || signature.indexOf('cash app afterpay') !== -1) return 'afterpay';
    if (signature.indexOf('affirm') !== -1) return 'affirm';
    if (signature.indexOf('klarna') !== -1) return 'klarna';
    if (signature.indexOf('link') !== -1 && signature.indexOf('pay') !== -1) return 'link';

    return '';
  }

  function walletKeyFor(element) {
    var key = providerKeyFor(element);
    return ['apple-pay', 'google-pay', 'disabled-woopay', 'link'].indexOf(key) !== -1 ? key : '';
  }

  function rowLabelText(row) {
    var label = row && row.querySelector('label');
    if (!label) return '';
    return compactText(label.textContent);
  }

  function isCardMethodRow(row) {
    if (!row) return false;
    var text = rowLabelText(row);
    var input = row.querySelector('input[type="radio"]');
    var inputSignature = compactText([
      input && input.id,
      input && input.name,
      input && input.value,
      input && input.getAttribute('data-payment-method'),
      input && input.getAttribute('aria-label'),
      row.className
    ].join(' '));

    if (
      inputSignature.indexOf('affirm') !== -1 ||
      inputSignature.indexOf('klarna') !== -1 ||
      inputSignature.indexOf('afterpay') !== -1 ||
      inputSignature.indexOf('paypal') !== -1 ||
      inputSignature.indexOf('apple') !== -1 ||
      inputSignature.indexOf('google') !== -1 ||
      inputSignature.indexOf('link') !== -1
    ) {
      return false;
    }

    return text === 'card' ||
      text === 'credit card' ||
      text === 'secure card payment' ||
      text === 'credit / debit card' ||
      text === 'credit or debit card' ||
      inputSignature.indexOf('payment_method_woocommerce_payments') !== -1 ||
      inputSignature.indexOf('payment_method_stripe') !== -1 ||
      inputSignature.indexOf('woocommerce_payments') !== -1 ||
      inputSignature.indexOf('stripe') !== -1 ||
      inputSignature.indexOf('card') !== -1;
  }

  function paymentLogoCandidates(fileName) {
    var origin = window.location.origin.replace(/\/+$/, '');
    var candidates = [];
    var referrer = '';

    try {
      referrer = document.referrer ? new URL(document.referrer).pathname : '';
    } catch (error) {
      referrer = '';
    }

    var stagingMatch = referrer.match(/^\/staging\/\d+(?:\/|$)/);
    if (stagingMatch) {
      candidates.push(origin + stagingMatch[0].replace(/\/+$/, '') + '/payment_logos/' + fileName);
    }

    candidates.push(origin + '/payment_logos/' + fileName);
    candidates.push(origin + '/wp/payment_logos/' + fileName);

    return candidates;
  }

  function cardLogoImg(fileName) {
    var candidates = paymentLogoCandidates(fileName);
    return '<img src="' + candidates[0] + '" data-dtb-logo-candidates="' + candidates.join('|') + '" data-dtb-logo-index="0" alt="" loading="lazy" decoding="async">';
  }

  function bindCardLogoFallbacks(root) {
    Array.prototype.forEach.call((root || document).querySelectorAll('.dtb-payment-card-brands img[data-dtb-logo-candidates]'), function (img) {
      if (img.dataset.dtbLogoFallbackReady === '1') return;
      img.dataset.dtbLogoFallbackReady = '1';
      img.addEventListener('error', function () {
        var candidates = String(img.dataset.dtbLogoCandidates || '').split('|').filter(Boolean);
        var nextIndex = (parseInt(img.dataset.dtbLogoIndex || '0', 10) || 0) + 1;
        if (nextIndex >= candidates.length) return;
        img.dataset.dtbLogoIndex = String(nextIndex);
        img.src = candidates[nextIndex];
      });
    });
  }

  function normalizeCardMethodLabel(row) {
    var label = row && row.querySelector('label');
    var input = row && row.querySelector('input[type="radio"]');
    if (!label || !input) return;

    row.classList.add('dtb-payment-method--card-brands');
    if (!input.getAttribute('aria-label')) input.setAttribute('aria-label', 'Secure card payment');

    if (!label.querySelector('.dtb-payment-card-visual')) {
      var visual = document.createElement('span');
      visual.className = 'dtb-payment-card-visual';
      visual.setAttribute('aria-hidden', 'true');
      visual.innerHTML = [
        '<span class="dtb-payment-card-icon">',
          '<svg viewBox="0 0 24 24" focusable="false">',
            '<rect x="3" y="5" width="18" height="14" rx="2"></rect>',
            '<path d="M3 10h18"></path>',
            '<path d="M7 15h3"></path>',
            '<path d="M13 15h4"></path>',
          '</svg>',
        '</span>',
        '<span class="dtb-payment-card-brands">',
          cardLogoImg('visa.svg'),
          cardLogoImg('mastercard.svg'),
          cardLogoImg('american-express.svg'),
        '</span>'
      ].join('');
      label.insertBefore(visual, label.querySelector('.dtb-payment-method-radio') ? label.querySelector('.dtb-payment-method-radio').nextSibling : label.firstChild);
    }

    bindCardLogoFallbacks(label);

    if (!label.querySelector('.dtb-payment-card-accessible-label')) {
      var accessible = document.createElement('span');
      accessible.className = 'dtb-payment-card-accessible-label dtb-sr-only';
      accessible.textContent = 'Secure card payment. Accepted cards: Visa, Mastercard, American Express.';
      label.appendChild(accessible);
    }

  }

  function nearestWalletContainer(element) {
    var interactiveContainer = element.closest(
      '.wc-stripe-payment-request-button,' +
      '.wcpay-payment-request-button,' +
      'button,' +
      'a'
    );

    if (interactiveContainer) return interactiveContainer;

    return element.closest(
      '.wcpay-express-checkout-wrapper,' +
      '.wcpay-payment-request-wrapper,' +
      '.wc-stripe-payment-request-wrapper,' +
      '.wc-stripe-payment-request-button,' +
      '.wc-block-components-express-payment,' +
      '.ppc-button-wrapper,' +
      '.gpay-card-info-container,' +
      '[id*="apple-pay"],' +
      '[class*="apple-pay"],' +
      '[id*="google-pay"],' +
      '[class*="google-pay"],' +
      '[id*="express-checkout"],' +
      '[id*="payment-request"],' +
      '[class*="express-checkout"],' +
      '[class*="payment-request"],' +
      'button,' +
      'iframe'
    );
  }

  function isOrSeparator(element) {
    if (!element || !element.textContent) return false;

    var text = compactText(element.textContent).replace(/[-—–]/g, '').trim();
    var hasControls = element.querySelector('button, input, select, textarea, iframe, a');

    return !hasControls && text === 'or';
  }

  function hideAdjacentSeparators(container) {
    var parent = container && container.parentElement;
    if (!parent) return;

    var previous = container.previousElementSibling;
    var next = container.nextElementSibling;

    if (isOrSeparator(previous)) previous.classList.add('dtb-wallet-separator-hidden');
    if (isOrSeparator(next)) next.classList.add('dtb-wallet-separator-hidden');
    if (parent.children.length <= 3 && isOrSeparator(parent.previousElementSibling)) parent.previousElementSibling.classList.add('dtb-wallet-separator-hidden');
    if (parent.children.length <= 3 && isOrSeparator(parent.nextElementSibling)) parent.nextElementSibling.classList.add('dtb-wallet-separator-hidden');
  }

  function nodeHasProviderLogo(node) {
    if (!node || node.nodeType !== 1) return false;
    return node.matches('img, svg, iframe') || Boolean(node.querySelector('img, svg, iframe'));
  }

  function hideDuplicateProviderText(label) {
    Array.prototype.forEach.call(label.childNodes, function (node) {
      if (node.nodeType === 3 && readableText(node.textContent)) {
        var span = document.createElement('span');
        span.className = 'dtb-payment-provider-text dtb-sr-only';
        span.textContent = node.textContent;
        label.replaceChild(span, node);
        return;
      }

      if (node.nodeType !== 1) return;
      if (node.classList.contains('dtb-payment-method-radio')) return;
      if (nodeHasProviderLogo(node)) return;
      if (!readableText(node.textContent)) return;
      if (node.querySelector('input, select, textarea, button')) return;

      node.classList.add('dtb-payment-provider-text', 'dtb-sr-only');
    });
  }

  function normalizeProviderLogoLabel(row) {
    var label = row && row.querySelector('label');
    var input = row && row.querySelector('input[type="radio"]');
    if (!label || label.classList.contains('dtb-provider-label-ready')) return;

    var providerKey = providerKeyFor(row);
    if (!providerKey || providerKey === 'disabled-woopay' || providerKey === 'link') return;

    row.classList.add('dtb-payment-method--' + providerKey);

    var hasLogo = Boolean(label.querySelector('img, svg'));
    if (!hasLogo) return;

    var accessibleLabel = readableText(label.textContent) || providerKey.replace('-', ' ');
    if (input && !input.getAttribute('aria-label')) input.setAttribute('aria-label', accessibleLabel);

    label.classList.add('dtb-provider-label-ready', 'dtb-payment-provider-label', 'dtb-payment-provider-label--logo-only', 'dtb-payment-provider-label--' + providerKey);
    hideDuplicateProviderText(label);
  }

  function normalizePaymentMethodRows() {
    var methods = document.querySelector('#payment ul.payment_methods');
    if (!methods) return;

    methods.classList.add('dtb-payment-methods-ready');

    Array.prototype.forEach.call(methods.querySelectorAll('li'), function (row) {
      if (walletKeyFor(row) === 'disabled-woopay') {
        row.classList.add('dtb-wallet-disabled');
        return;
      }

      var label = row.querySelector('label');
      var input = row.querySelector('input[type="radio"]');
      if (!label || !input) return;

      if (!label.querySelector('.dtb-payment-method-radio')) {
        var marker = document.createElement('span');
        marker.className = 'dtb-payment-method-radio';
        marker.setAttribute('aria-hidden', 'true');
        label.insertBefore(marker, label.firstChild);
      }

      if (isCardMethodRow(row)) normalizeCardMethodLabel(row);

      normalizeProviderLogoLabel(row);
    });
  }

  function triggerPaymentInputChange(input) {
    if (window.jQuery) {
      window.jQuery(input).trigger('change');
      return;
    }

    input.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function selectPaymentRow(row, forceChange) {
    var input = row && row.querySelector('input[type="radio"]');
    if (!input) return;

    if (input.checked) {
      if (forceChange) triggerPaymentInputChange(input);
      return;
    }

    input.checked = true;
    triggerPaymentInputChange(input);
  }

  function syncActivePaymentRows() {
    var methods = document.querySelector('#payment ul.payment_methods');
    if (!methods) return;

    Array.prototype.forEach.call(methods.querySelectorAll('li'), function (row) {
      var input = row.querySelector('input[type="radio"]');
      var label = row.querySelector('label');
      var box = row.querySelector('.payment_box');
      var isActive = Boolean(input && input.checked);

      row.classList.toggle('is-active', isActive);
      if (label) {
        label.setAttribute('aria-expanded', isActive ? 'true' : 'false');
      }

      if (!box || box.classList.contains('dtb-payment-box-empty')) return;

      box.setAttribute('aria-hidden', isActive ? 'false' : 'true');
      if (isActive) {
        box.hidden = false;
        box.removeAttribute('hidden');
        box.style.removeProperty('display');
      } else {
        box.hidden = true;
        box.style.setProperty('display', 'none', 'important');
      }
    });
  }

  function hideDuplicateCardMethodRows() {
    var methods = document.querySelector('#payment ul.payment_methods');
    if (!methods) return;

    var rows = Array.prototype.slice.call(methods.querySelectorAll('li'));
    var explicitCardRow = rows.find(isCardMethodRow);
    if (!explicitCardRow) return;

    rows.forEach(function (row) {
      if (row === explicitCardRow) return;

      var text = rowLabelText(row);
      var looksLikeGenericCard = (
        text === 'payment methods' ||
        text === 'payment method' ||
        text === 'credit / debit card' ||
        text === 'credit or debit card'
      );

      if (!looksLikeGenericCard) return;

      if (row.querySelector('input[type="radio"]:checked')) selectPaymentRow(explicitCardRow, true);
      row.classList.add('dtb-payment-method-duplicate');
    });
  }

  function hasMeaningfulPaymentBoxContent(box, row) {
    if (!box) return false;
    if (isCardMethodRow(row)) return true;

    var providerKey = providerKeyFor(row || box);
    var text = readableText(box.textContent);
    var nonFieldProvider = ['afterpay', 'affirm', 'klarna', 'apple-pay', 'google-pay', 'link'].indexOf(providerKey) !== -1;

    if (nonFieldProvider) return true;
    if (text.length > 1) return true;

    var usefulControl = box.querySelector(
      '.StripeElement,' +
      '.wcpay-upe-element,' +
      'iframe[src],' +
      'select,' +
      'textarea,' +
      'button,' +
      'input:not([type="hidden"]):not([aria-hidden="true"])'
    );

    if (!usefulControl) return false;

    if (usefulControl.matches && usefulControl.matches('input:not([type="hidden"])')) {
      var placeholder = usefulControl.getAttribute('placeholder') || '';
      var label = usefulControl.getAttribute('aria-label') || usefulControl.getAttribute('name') || usefulControl.getAttribute('id') || '';
      return readableText(placeholder + ' ' + label).length > 1;
    }

    return true;
  }

  function normalizePaymentBoxes() {
    Array.prototype.forEach.call(document.querySelectorAll('#payment ul.payment_methods li'), function (row) {
      var box = row.querySelector('.payment_box');
      if (!box) return;

      var hasContent = hasMeaningfulPaymentBoxContent(box, row);
      box.classList.toggle('dtb-payment-box-empty', !hasContent);
      row.classList.toggle('dtb-payment-box-row-empty', !hasContent);
    });
  }

  function hideOrderSummaryPaymentMethodRows() {
    Array.prototype.forEach.call(document.querySelectorAll('table.shop_table tr'), function (row) {
      var firstCell = row.querySelector('th, td');
      if (!firstCell) return;

      var label = compactText(firstCell.textContent).replace(/:+$/, '').trim();
      if (label === 'payment method' || row.classList.contains('payment-method')) {
        row.classList.add('dtb-order-summary-payment-method-row');
      }
    });
  }

  function paymentOrderContext() {
    var match = window.location.pathname.match(/\/order-pay\/(\d+)\/?/);
    var params = new URLSearchParams(window.location.search || '');
    return {
      orderId: match ? match[1] : '',
      key: params.get('key') || ''
    };
  }

  function restBaseUrl() {
    if (window.wpApiSettings && window.wpApiSettings.root) {
      return String(window.wpApiSettings.root).replace(/\/+$/, '') + '/dtb/v1';
    }
    return window.location.origin.replace(/\/+$/, '') + '/wp-json/dtb/v1';
  }

  function quantityFromRow(row) {
    var quantityNode = row.querySelector('td.product-quantity, .product-quantity');
    var text = quantityNode ? quantityNode.textContent : row.textContent;
    var match = String(text || '').match(/(\d+)/);
    var quantity = match ? parseInt(match[1], 10) : 1;
    return Number.isFinite(quantity) && quantity > 0 ? quantity : 1;
  }

  function itemIdFromRow(row) {
    var product = row.querySelector('.dtb-order-product[data-dtb-order-item-id]');
    return product ? product.getAttribute('data-dtb-order-item-id') : '';
  }

  function quantityTargetForRow(row) {
    var target = row.querySelector('td.product-quantity');
    if (target) return target;

    var existing = row.querySelector('.dtb-order-product-quantity-cell');
    if (existing) return existing;

    target = document.createElement('td');
    target.className = 'product-quantity dtb-order-product-quantity-cell';
    row.appendChild(target);
    return target;
  }

  function setQuantityControlsBusy(row, isBusy) {
    row.classList.toggle('dtb-order-product-row--syncing', isBusy);
    Array.prototype.forEach.call(row.querySelectorAll('.dtb-order-qty-btn'), function (button) {
      button.disabled = isBusy;
    });
  }

  function totalLabelForRow(row) {
    var heading = row && row.querySelector('th, td');
    return compactText(heading ? heading.textContent : '').replace(/:+$/, '').trim();
  }

  function updateOrderTotalRows(totals) {
    if (!totals) return;

    Array.prototype.forEach.call(document.querySelectorAll('table.shop_table tfoot tr'), function (row) {
      var label = totalLabelForRow(row);
      var valueCell = row.querySelector('td');
      if (!valueCell) return;

      if (label === 'subtotal' && totals.subtotal_html) valueCell.innerHTML = totals.subtotal_html;
      if (label === 'shipping' && totals.shipping_html) valueCell.innerHTML = totals.shipping_html;
      if (label === 'tax' && totals.tax_html) valueCell.innerHTML = totals.tax_html;
      if (label === 'total' && totals.total_html) valueCell.innerHTML = totals.total_html;
    });
  }

  function updateOrderItemRows(payload, activeRow) {
    var data = payload && payload.data ? payload.data : payload;
    if (!data) return;

    if (Number(data.quantity) === 0 && activeRow) {
      activeRow.remove();
    }

    var items = Array.isArray(data.items) ? data.items : [];
    items.forEach(function (item) {
      var productNode = document.querySelector('.dtb-order-product[data-dtb-order-item-id="' + item.item_id + '"]');
      var row = productNode ? productNode.closest('tr') : null;
      if (!row) return;

      var totalCell = row.querySelector('td.product-total');
      if (totalCell && item.line_total_html) totalCell.innerHTML = item.line_total_html;
    });

    updateOrderTotalRows(data.totals);
  }

  function updateOrderItemQuantity(row, nextQuantity) {
    var context = paymentOrderContext();
    var itemId = itemIdFromRow(row);
    if (!context.orderId || !context.key || !itemId) return;

    setQuantityControlsBusy(row, true);

    window.fetch(restBaseUrl() + '/payment-runtime/orders/' + encodeURIComponent(context.orderId) + '/items/' + encodeURIComponent(itemId), {
      method: 'POST',
      credentials: 'same-origin',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        key: context.key,
        quantity: Math.max(0, Math.min(99, parseInt(nextQuantity, 10) || 0))
      })
    })
      .then(function (response) {
        if (!response.ok) {
          return response.json().catch(function () { return {}; }).then(function (payload) {
            throw new Error(payload.message || 'Could not update order quantity.');
          });
        }
        return response.json();
      })
      .then(function (payload) {
        updateOrderItemRows(payload, row);
        setQuantityControlsBusy(row, false);
      })
      .catch(function (error) {
        setQuantityControlsBusy(row, false);
        window.alert(error && error.message ? error.message : 'Could not update order quantity.');
      });
  }

  function renderOrderQuantityControls(row, force) {
    var itemId = itemIdFromRow(row);
    if (!itemId) return;

    var target = quantityTargetForRow(row);
    if (!target || (!force && target.dataset.dtbOrderQtyReady === '1')) return;

    var quantity = quantityFromRow(row);
    var lineCount = document.querySelectorAll('table.shop_table tbody tr.dtb-order-product-row').length;
    var canRemove = quantity > 1 || lineCount > 1;
    var productName = readableText((row.querySelector('.dtb-order-product-name') || {}).textContent) || 'item';
    var escapedProductName = escapeHtml(productName);
    target.dataset.dtbOrderQtyReady = '1';
    target.innerHTML = [
      '<div class="dtb-order-qty-row" role="group" aria-label="Quantity for ' + escapedProductName + '">',
        '<button type="button" class="dtb-order-qty-btn dtb-order-qty-btn--decrease" aria-label="' + (quantity === 1 ? 'Remove ' + escapedProductName : 'Decrease quantity') + '"' + (!canRemove ? ' disabled' : '') + '>',
          quantity === 1 ? '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v5"/><path d="M14 11v5"/></svg>' : '<span aria-hidden="true">-</span>',
        '</button>',
        '<span class="dtb-order-qty-display" aria-live="polite">' + quantity + '</span>',
        '<button type="button" class="dtb-order-qty-btn dtb-order-qty-btn--increase" aria-label="Increase quantity"' + (quantity >= 99 ? ' disabled' : '') + '><span aria-hidden="true">+</span></button>',
      '</div>'
    ].join('');

    var decrease = target.querySelector('.dtb-order-qty-btn--decrease');
    var increase = target.querySelector('.dtb-order-qty-btn--increase');
    if (decrease) {
      decrease.addEventListener('click', function () {
        updateOrderItemQuantity(row, quantity - 1);
      });
    }
    if (increase) {
      increase.addEventListener('click', function () {
        updateOrderItemQuantity(row, quantity + 1);
      });
    }
  }

  function enhanceOrderQuantityControls() {
    Array.prototype.forEach.call(document.querySelectorAll('table.shop_table tbody tr.dtb-order-product-row'), renderOrderQuantityControls);
  }

  function normalizePaymentLayout() {
    var table = document.querySelector('form#order_review table.shop_table');
    if (!table) return;

    if (!table.closest('.dtb-order-summary-card')) {
      var wrapper = document.createElement('section');
      wrapper.className = 'dtb-order-summary-card';
      table.parentNode.insertBefore(wrapper, table);
      wrapper.appendChild(table);
    }

    if (!table.querySelector('caption.dtb-order-summary-caption')) {
      var caption = table.createCaption();
      caption.className = 'dtb-order-summary-caption';
      caption.textContent = 'Order Summary';
    }

    Array.prototype.forEach.call(table.querySelectorAll('tbody tr'), function (row) {
      row.classList.add('dtb-order-product-row');
    });

    Array.prototype.forEach.call(table.querySelectorAll('tfoot tr'), function (row) {
      row.classList.add('dtb-order-total-row');
    });
  }

  /**
   * Identifies Apple Pay and Google Pay payment-method rows rendered by WooPayments,
   * physically moves them into a dedicated "Express Checkout" section as the first
   * child of form#order_review, and reveals that section. Safe to call multiple times
   * (idempotent — rows already inside the section are skipped).
   */
  function mountExpressCheckoutTop() {
    var methods = document.querySelector('#payment ul.payment_methods');
    if (!methods) return;

    // Collect Apple Pay and Google Pay rows that are still in the payment list
    var expressRows = [];
    Array.prototype.forEach.call(methods.querySelectorAll('li'), function (row) {
      var key = walletKeyFor(row);
      if (key === 'apple-pay' || key === 'google-pay') {
        expressRows.push({ row: row, key: key });
      }
    });

    if (expressRows.length === 0) return;

    // Locate the form on each call — it is a stable, singleton element.
    var form = document.querySelector('form#order_review');
    if (!form) return;

    // Create or reuse the express checkout top section (may be a pre-rendered placeholder div)
    var topSection = form.querySelector('.dtb-express-checkout-top');
    if (!topSection) {
      topSection = document.createElement('section');
      topSection.className = 'dtb-express-checkout-top';
      // Insert as the very first child of the form
      form.insertBefore(topSection, form.firstChild);
    }

    // Populate the section if it hasn't been set up yet
    if (!topSection.querySelector('.dtb-express-checkout-top__label')) {
      topSection.setAttribute('aria-label', 'Express checkout');
      topSection.removeAttribute('aria-hidden');

      var headerEl = document.createElement('p');
      headerEl.className = 'dtb-express-checkout-top__label';
      headerEl.setAttribute('aria-hidden', 'true');
      headerEl.textContent = 'Express Checkout';
      topSection.insertBefore(headerEl, topSection.firstChild);

      var buttonsUl = document.createElement('ul');
      buttonsUl.className = 'dtb-express-buttons';
      topSection.appendChild(buttonsUl);
    }

    // Reveal the section now that it has content
    topSection.style.display = '';

    var expressButtonsUl = topSection.querySelector('.dtb-express-buttons');
    if (!expressButtonsUl) return;

    // Move each express row into the top section
    expressRows.forEach(function (item) {
      var expressRow = item.row;
      // Skip if already in the top section
      if (expressRow.closest('.dtb-express-checkout-top')) return;
      expressRow.classList.add('dtb-express-moved', 'dtb-express-moved--' + item.key);
      expressButtonsUl.appendChild(expressRow);
    });
  }

  function dedupeWalletButtons() {
    var seen = Object.create(null);
    var selector = [
      '.wcpay-express-checkout-wrapper',
      '.wcpay-payment-request-wrapper',
      '.wc-stripe-payment-request-wrapper',
      '.wc-stripe-payment-request-button',
      '.wc-block-components-express-payment',
      '.gpay-card-info-container',
      '[id*="apple-pay"]',
      '[class*="apple-pay"]',
      '[id*="google-pay"]',
      '[class*="google-pay"]',
      '[id*="express-checkout"]',
      '[id*="payment-request"]',
      '[class*="express-checkout"]',
      '[class*="payment-request"]',
      'button',
      'iframe'
    ].join(',');

    Array.prototype.forEach.call(document.querySelectorAll(selector), function (element) {
      var key = walletKeyFor(element);
      if (!key) return;

      var container = nearestWalletContainer(element);
      if (!container || container.classList.contains('dtb-wallet-duplicate')) return;

      if (key === 'disabled-woopay') {
        container.classList.add('dtb-wallet-disabled');
        hideAdjacentSeparators(container);
        return;
      }

      if (seen[key] && seen[key] !== container) {
        container.classList.add('dtb-wallet-duplicate');
        hideAdjacentSeparators(container);
        return;
      }

      seen[key] = container;
    });
  }

  function enhancePaymentRuntime() {
    normalizePaymentLayout();
    mountExpressCheckoutTop();
    hideOrderSummaryPaymentMethodRows();
    normalizePaymentMethodRows();
    hideDuplicateCardMethodRows();
    normalizePaymentBoxes();
    syncActivePaymentRows();
    dedupeWalletButtons();
  }

  function scheduleEnhancements() {
    enhancePaymentRuntime();
    window.setTimeout(enhancePaymentRuntime, 250);
    window.setTimeout(enhancePaymentRuntime, 700);
    window.setTimeout(enhancePaymentRuntime, 1400);
    window.setTimeout(enhancePaymentRuntime, 2600);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', scheduleEnhancements);
  } else {
    scheduleEnhancements();
  }

  document.addEventListener('change', function (event) {
    if (event.target && event.target.matches('#payment input[type="radio"]')) {
      window.setTimeout(enhancePaymentRuntime, 180);
    }
  });

  document.addEventListener('click', function (event) {
    var row = event.target && event.target.closest
      ? event.target.closest('#payment ul.payment_methods > li')
      : null;
    if (!row || event.target.closest('.payment_box')) return;

    var label = event.target.closest('label');
    var input = row.querySelector('input[type="radio"]');
    if (!input || input.disabled) return;

    if (label) {
      return;
    }

    if (!event.target.closest('a, button, input, select, textarea')) {
      selectPaymentRow(row, true);
      window.setTimeout(enhancePaymentRuntime, 0);
    }
  });

  if ('MutationObserver' in window) {
    var observer = new MutationObserver(function (mutations) {
      var structuralPaymentChange = mutations.some(function (mutation) {
        return Array.prototype.some.call(mutation.addedNodes || [], function (node) {
          return node.nodeType === 1 && (
            node.matches && node.matches('li, .payment_box, table.shop_table') ||
            node.querySelector && node.querySelector('li, .payment_box, table.shop_table')
          );
        });
      });

      if (!structuralPaymentChange) return;

      window.clearTimeout(observer._dtbTimer);
      observer._dtbTimer = window.setTimeout(enhancePaymentRuntime, 220);
    });

    var paymentRoot = document.querySelector('form#order_review');
    if (paymentRoot) {
      // subtree:true is required because WooPayments re-injects payment-method <li> rows
      // at arbitrary depths inside form#order_review (e.g. inside #payment > ul), not
      // just as direct children. Without deep observation the debounce would miss those
      // injections and express buttons would never be moved.
      observer.observe(paymentRoot, {
        childList: true,
        subtree: true
      });
    }
  }
})();
