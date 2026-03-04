(function($) {
  'use strict';

  if (typeof dwtb_ajax === 'undefined') { return; }

  // Update all cart badge elements.
  function updateCartBadge(count) {
    var badges = document.querySelectorAll('.cart-badge');
    badges.forEach(function(badge) {
      badge.textContent = count;
      badge.style.display = count > 0 ? 'inline-flex' : 'none';
    });
  }

  // Escape a plain-text string for safe HTML insertion.
  function esc(str) {
    var d = document.createElement('div');
    d.appendChild(document.createTextNode(String(str)));
    return d.innerHTML;
  }

  // Render cart items inside the slide-out panel.
  function renderCartItems(items, total) {
    var container = document.getElementById('cart-items');
    if (!container) { return; }

    if (!items || items.length === 0) {
      container.innerHTML =
        '<div class="cart-empty-msg">' +
          '<p>Your cart is empty.</p>' +
          '<a href="' + esc(dwtb_ajax.shopUrl) + '" class="alloy-button" style="margin-top:16px;display:inline-flex;">Browse Products</a>' +
        '</div>';
      var totalEl = document.getElementById('cart-total');
      if (totalEl) { totalEl.textContent = '$0.00'; }
      return;
    }

    var html = '';
    items.forEach(function(item) {
      html += '<div class="cart-panel-item" data-key="' + esc(item.key) + '">';
      html +=   '<img class="cart-panel-item-image" src="' + esc(item.image) + '" alt="' + esc(item.name) + '">';
      html +=   '<div class="cart-panel-item-info">';
      html +=     '<div class="cart-panel-item-name">' + esc(item.name) + '</div>';
      html +=     '<div class="cart-panel-item-price">' + esc(item.price) + ' &times; ' + esc(item.quantity) + '</div>';
      html +=   '</div>';
      html +=   '<button class="cart-panel-item-remove" data-key="' + esc(item.key) + '" aria-label="Remove item">&times;</button>';
      html += '</div>';
    });
    container.innerHTML = html;

    var totalEl = document.getElementById('cart-total');
    if (totalEl) { totalEl.textContent = total; }

    // Bind remove buttons after rendering.
    container.querySelectorAll('.cart-panel-item-remove').forEach(function(btn) {
      btn.addEventListener('click', function() {
        removeCartItem(this.getAttribute('data-key'));
      });
    });
  }

  // Fetch and display current cart contents via AJAX.
  function fetchCart() {
    $.ajax({
      url: dwtb_ajax.ajaxurl,
      type: 'POST',
      data: {
        action: 'dwtb_get_cart',
        nonce: dwtb_ajax.nonce
      },
      success: function(response) {
        if (response.success) {
          renderCartItems(response.data.items, response.data.total);
          updateCartBadge(response.data.count);
        }
      }
    });
  }

  // Remove a single item from the cart.
  function removeCartItem(itemKey) {
    $.ajax({
      url: dwtb_ajax.ajaxurl,
      type: 'POST',
      data: {
        action: 'dwtb_remove_cart_item',
        nonce: dwtb_ajax.nonce,
        item_key: itemKey
      },
      success: function(response) {
        if (response.success) {
          renderCartItems(response.data.items, response.data.total);
          updateCartBadge(response.data.count);
        }
      }
    });
  }

  // AJAX add-to-cart for .dwtb-add-to-cart buttons.
  $(document).on('click', '.dwtb-add-to-cart', function(e) {
    e.preventDefault();
    var btn = $(this);
    var productId = btn.data('product-id');
    var quantity = btn.data('quantity') || 1;
    var originalText = btn.text();

    btn.text('Adding...').prop('disabled', true);

    $.ajax({
      url: dwtb_ajax.ajaxurl,
      type: 'POST',
      data: {
        action: 'dwtb_add_to_cart',
        nonce: dwtb_ajax.nonce,
        product_id: productId,
        quantity: quantity
      },
      success: function(response) {
        if (response.success) {
          updateCartBadge(response.data.cart_count);
          btn.text('Added!');

          // Open the cart panel.
          var cartPanel = document.getElementById('cart-panel');
          var cartOverlay = document.getElementById('cart-overlay');
          if (cartPanel) { cartPanel.classList.add('open'); }
          if (cartOverlay) { cartOverlay.classList.add('open'); }
          document.body.style.overflow = 'hidden';

          fetchCart();

          setTimeout(function() {
            btn.text(originalText).prop('disabled', false);
          }, 2000);
        } else {
          btn.text('Error').prop('disabled', false);
          setTimeout(function() { btn.text(originalText); }, 2000);
        }
      },
      error: function() {
        btn.text(originalText).prop('disabled', false);
      }
    });
  });

  // Navigate to checkout.
  $(document).on('click', '#cart-checkout-btn', function() {
    window.location.href = dwtb_ajax.checkoutUrl;
  });

  // Fetch cart contents whenever the cart panel is opened.
  document.addEventListener('DOMContentLoaded', function() {
    document.querySelectorAll('.cart-toggle').forEach(function(btn) {
      btn.addEventListener('click', function() {
        setTimeout(fetchCart, 100);
      });
    });
  });

})(jQuery);
