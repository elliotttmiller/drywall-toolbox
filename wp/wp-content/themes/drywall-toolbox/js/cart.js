/**
 * Drywall Toolbox - Cart Manager
 * Manages the localStorage cart: add, remove, update quantity, render cart page & checkout summary.
 */
(function () {
  'use strict';

  var CART_KEY = 'dtb_cart';

  /* ─── CART MANAGER OBJECT ─────────────────────────────────────────── */
  window.CartManager = {
    getCart: function () {
      try { return JSON.parse(localStorage.getItem(CART_KEY) || '[]'); } catch (e) { return []; }
    },
    saveCart: function (cart) {
      localStorage.setItem(CART_KEY, JSON.stringify(cart));
      if (window.updateCartCounts) window.updateCartCounts();
    },
    addToCart: function (product) {
      var cart = this.getCart();
      var existing = cart.find(function (i) { return i.sku === product.sku; });
      if (existing) {
        existing.quantity = (parseInt(existing.quantity) || 1) + (parseInt(product.quantity) || 1);
      } else {
        cart.push({
          sku: product.sku || '',
          name: product.name || '',
          price: parseFloat(product.price) || 0,
          image: product.image || '',
          brand: product.brand || '',
          quantity: parseInt(product.quantity) || 1
        });
      }
      this.saveCart(cart);
      if (window.showToast) window.showToast((product.name || 'Item') + ' added to cart!');
    },
    removeFromCart: function (sku) {
      var cart = this.getCart().filter(function (i) { return i.sku !== sku; });
      this.saveCart(cart);
    },
    updateQuantity: function (sku, qty) {
      var cart = this.getCart();
      var item = cart.find(function (i) { return i.sku === sku; });
      if (item) {
        item.quantity = Math.max(1, parseInt(qty) || 1);
        this.saveCart(cart);
      }
    },
    clearCart: function () {
      localStorage.removeItem(CART_KEY);
      if (window.updateCartCounts) window.updateCartCounts();
    },
    getCartTotal: function () {
      return this.getCart().reduce(function (sum, item) {
        return sum + ((parseFloat(item.price) || 0) * (parseInt(item.quantity) || 1));
      }, 0);
    },
    getCartCount: function () {
      return this.getCart().reduce(function (sum, item) {
        return sum + (parseInt(item.quantity) || 1);
      }, 0);
    }
  };

  /* ─── CART PAGE RENDERING ─────────────────────────────────────────── */
  function escH(str) {
    return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function renderCartPage() {
    var container = document.getElementById('cart-page-items');
    if (!container) return;

    var cart = window.CartManager.getCart();
    var emptyState = document.getElementById('cart-empty-state');
    var cartContent = document.getElementById('cart-content');
    var countEl = document.getElementById('cart-item-count');

    var count = cart.reduce(function (s, i) { return s + (parseInt(i.quantity) || 1); }, 0);
    if (countEl) countEl.textContent = count + ' item' + (count !== 1 ? 's' : '') + ' in your cart';

    if (cart.length === 0) {
      if (emptyState) emptyState.style.display = '';
      if (cartContent) cartContent.style.display = 'none';
      return;
    }

    if (emptyState) emptyState.style.display = 'none';
    if (cartContent) cartContent.style.display = '';

    var subtotal = 0;
    container.innerHTML = cart.map(function (item) {
      var price = parseFloat(item.price) || 0;
      var qty = parseInt(item.quantity) || 1;
      subtotal += price * qty;
      return (
        '<div class="cart-item" style="display:grid;grid-template-columns:80px 1fr auto;gap:16px;align-items:start;padding:20px;border-bottom:1px solid var(--machined-border);" data-sku="' + escH(item.sku) + '">' +
        '<div style="width:80px;height:80px;background:#f8fafc;border-radius:4px;display:flex;align-items:center;justify-content:center;overflow:hidden;">' +
        (item.image ? '<img src="' + escH(item.image) + '" style="width:100%;height:100%;object-fit:contain;" loading="lazy">' : '') +
        '</div>' +
        '<div>' +
        '<div style="font-size:0.72rem;color:rgba(15,23,42,0.5);margin-bottom:2px;">' + escH(item.brand || '') + '</div>' +
        '<div style="font-weight:700;font-size:0.9rem;color:black;margin-bottom:4px;">' + escH(item.name) + '</div>' +
        '<div style="font-size:0.72rem;color:rgba(15,23,42,0.4);margin-bottom:10px;">SKU: ' + escH(item.sku) + '</div>' +
        '<div class="quantity-control">' +
        '<button class="quantity-btn" onclick="cartChangeQty(\'' + escH(item.sku) + '\', -1)">&#8722;</button>' +
        '<input type="number" class="quantity-input" value="' + qty + '" min="1" onchange="cartSetQty(\'' + escH(item.sku) + '\', this.value)">' +
        '<button class="quantity-btn" onclick="cartChangeQty(\'' + escH(item.sku) + '\', 1)">+</button>' +
        '</div>' +
        '</div>' +
        '<div style="text-align:right;">' +
        '<div style="font-weight:800;font-size:1rem;color:var(--color-primary-600);margin-bottom:6px;">$' + (price * qty).toFixed(2) + '</div>' +
        '<div style="font-size:0.72rem;color:rgba(15,23,42,0.4);margin-bottom:8px;">$' + price.toFixed(2) + ' ea.</div>' +
        '<button onclick="window.CartManager.removeFromCart(\'' + escH(item.sku) + '\');renderCartPage();" style="font-size:0.72rem;color:rgba(15,23,42,0.4);background:none;border:none;cursor:pointer;padding:0;">Remove</button>' +
        '</div>' +
        '</div>'
      );
    }).join('');

    var shipping = subtotal >= 500 ? 0 : 25;
    var tax = subtotal * 0.08;
    var total = subtotal + shipping + tax;

    var sd = document.getElementById('cart-subtotal-display');
    var shd = document.getElementById('cart-shipping-display');
    var td = document.getElementById('cart-tax-display');
    var totEl = document.getElementById('cart-total');
    var notice = document.getElementById('shipping-notice');
    var noticeText = document.getElementById('shipping-notice-text');

    if (sd) sd.textContent = '$' + subtotal.toFixed(2);
    if (shd) shd.innerHTML = shipping === 0 ? '<span style="color:#16a34a;font-weight:700;">FREE</span>' : '$' + shipping.toFixed(2);
    if (td) td.textContent = '$' + tax.toFixed(2);
    if (totEl) totEl.textContent = '$' + total.toFixed(2);

    if (notice && noticeText) {
      if (subtotal >= 500) {
        notice.style.background = '#f0fdf4';
        notice.style.borderColor = '#86efac';
        noticeText.textContent = 'You qualify for free shipping!';
        noticeText.style.color = '#15803d';
      } else {
        notice.style.background = '#fefce8';
        notice.style.borderColor = '#fcd34d';
        noticeText.textContent = 'Add $' + (500 - subtotal).toFixed(2) + ' more to qualify for free shipping';
        noticeText.style.color = '#b45309';
      }
    }
  }

  window.renderCartPage = renderCartPage;

  window.cartChangeQty = function (sku, delta) {
    var cart = window.CartManager.getCart();
    var item = cart.find(function (i) { return i.sku === sku; });
    if (item) {
      item.quantity = Math.max(1, (parseInt(item.quantity) || 1) + delta);
      window.CartManager.saveCart(cart);
      renderCartPage();
    }
  };

  window.cartSetQty = function (sku, val) {
    window.CartManager.updateQuantity(sku, val);
    renderCartPage();
  };

  /* ─── CHECKOUT SUMMARY ─────────────────────────────────────────────── */
  function renderCheckoutSummary() {
    var container = document.getElementById('checkout-order-items');
    if (!container) return;

    var cart = window.CartManager.getCart();
    var subtotal = 0;

    container.innerHTML = cart.map(function (item) {
      var price = parseFloat(item.price) || 0;
      var qty = parseInt(item.quantity) || 1;
      subtotal += price * qty;
      return (
        '<div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid var(--machined-border);">' +
        '<div>' +
        '<div style="font-size:0.85rem;font-weight:600;color:black;">' + escH(item.name) + '</div>' +
        '<div style="font-size:0.72rem;color:rgba(15,23,42,0.5);">Qty: ' + qty + '</div>' +
        '</div>' +
        '<div style="font-weight:700;color:var(--color-primary-600);">$' + (price * qty).toFixed(2) + '</div>' +
        '</div>'
      );
    }).join('');

    var shipping = subtotal >= 500 ? 0 : 25;
    var tax = subtotal * 0.08;
    var total = subtotal + shipping + tax;

    var sub = document.getElementById('co_subtotal');
    var sh = document.getElementById('co_shipping');
    var tx = document.getElementById('co_tax');
    var totEl = document.getElementById('checkout-total');
    if (sub) sub.textContent = '$' + subtotal.toFixed(2);
    if (sh) sh.innerHTML = shipping === 0 ? '<span style="color:#16a34a;">FREE</span>' : '$' + shipping.toFixed(2);
    if (tx) tx.textContent = '$' + tax.toFixed(2);
    if (totEl) totEl.textContent = '$' + total.toFixed(2);
  }

  document.addEventListener('DOMContentLoaded', function () {
    renderCartPage();
    renderCheckoutSummary();
  });

})();
