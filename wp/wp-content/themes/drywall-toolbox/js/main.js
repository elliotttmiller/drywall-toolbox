/**
 * Drywall Toolbox - Main JS
 * Core UI: responsive header, mobile menu, shop dropdown, cart sidebar,
 * toast notifications, active nav links, footer toggles, cart count updates.
 */
(function () {
  'use strict';

  /* ─── RESPONSIVE LAYOUT ──────────────────────────────────────────── */
  var DESKTOP_BREAKPOINT = 1025;

  function updateLayout() {
    var w = window.innerWidth;
    var mobileRow = document.getElementById('mobile-header-row');
    var desktopRow = document.getElementById('desktop-header-row');
    if (!mobileRow || !desktopRow) return;

    if (w >= DESKTOP_BREAKPOINT) {
      mobileRow.style.display = 'none';
      desktopRow.style.display = 'flex';
      desktopRow.style.alignItems = 'center';
      desktopRow.style.justifyContent = 'space-between';
      desktopRow.style.width = '100%';
    } else {
      mobileRow.style.display = 'flex';
      mobileRow.style.alignItems = 'center';
      mobileRow.style.justifyContent = 'space-between';
      mobileRow.style.width = '100%';
      desktopRow.style.display = 'none';
    }
  }

  window.addEventListener('resize', updateLayout);
  document.addEventListener('DOMContentLoaded', updateLayout);

  /* ─── MOBILE MENU ─────────────────────────────────────────────────── */
  var mobileMenuOpen = false;

  window.closeMobileMenu = function () {
    mobileMenuOpen = false;
    var menu = document.getElementById('mobile-menu');
    var menuIcon = document.getElementById('menu-icon');
    var closeIcon = document.getElementById('close-icon');
    if (menu) menu.classList.remove('open');
    if (menuIcon) menuIcon.style.display = '';
    if (closeIcon) closeIcon.style.display = 'none';
    document.body.style.overflow = '';
  };

  function toggleMobileMenu() {
    mobileMenuOpen = !mobileMenuOpen;
    var menu = document.getElementById('mobile-menu');
    var menuIcon = document.getElementById('menu-icon');
    var closeIcon = document.getElementById('close-icon');
    if (mobileMenuOpen) {
      if (menu) menu.classList.add('open');
      if (menuIcon) menuIcon.style.display = 'none';
      if (closeIcon) closeIcon.style.display = '';
      document.body.style.overflow = 'hidden';
    } else {
      window.closeMobileMenu();
    }
  }

  document.addEventListener('DOMContentLoaded', function () {
    var btn = document.getElementById('mobile-menu-btn');
    if (btn) btn.addEventListener('click', toggleMobileMenu);
  });

  /* ─── SHOP DROPDOWN ──────────────────────────────────────────────── */
  document.addEventListener('DOMContentLoaded', function () {
    var toggle = document.getElementById('shop-toggle');
    var dropdown = document.getElementById('shop-dropdown');
    var chevron = document.getElementById('shop-chevron');
    if (!toggle || !dropdown) return;

    var dropdownOpen = false;

    function openDropdown() {
      dropdownOpen = true;
      dropdown.classList.add('open');
      if (chevron) chevron.style.transform = 'rotate(180deg)';
    }

    function closeDropdown() {
      dropdownOpen = false;
      dropdown.classList.remove('open');
      if (chevron) chevron.style.transform = 'rotate(0deg)';
    }

    toggle.addEventListener('mouseenter', openDropdown);
    toggle.addEventListener('click', function () {
      dropdownOpen ? closeDropdown() : openDropdown();
    });

    var navItem = toggle.closest('.nav-shop-item') || toggle.parentElement;
    if (navItem) {
      navItem.addEventListener('mouseleave', closeDropdown);
    }

    document.addEventListener('click', function (e) {
      if (navItem && !navItem.contains(e.target)) closeDropdown();
    });
  });

  /* ─── CART SIDEBAR ───────────────────────────────────────────────── */
  window.openCart = function () {
    var sidebar = document.getElementById('cart-sidebar');
    var overlay = document.getElementById('cart-overlay');
    if (sidebar) sidebar.classList.add('open');
    if (overlay) overlay.classList.add('open');
    document.body.style.overflow = 'hidden';
    renderCartSidebar();
  };

  window.closeCart = function () {
    var sidebar = document.getElementById('cart-sidebar');
    var overlay = document.getElementById('cart-overlay');
    if (sidebar) sidebar.classList.remove('open');
    if (overlay) overlay.classList.remove('open');
    document.body.style.overflow = '';
  };

  document.addEventListener('DOMContentLoaded', function () {
    var cartBtnMobile = document.getElementById('cart-btn-mobile');
    var cartBtnDesktop = document.getElementById('cart-btn-desktop');
    var cartOverlay = document.getElementById('cart-overlay');
    if (cartBtnMobile) cartBtnMobile.addEventListener('click', window.openCart);
    if (cartBtnDesktop) cartBtnDesktop.addEventListener('click', window.openCart);
    if (cartOverlay) cartOverlay.addEventListener('click', window.closeCart);
  });

  /* ─── TOAST NOTIFICATIONS ─────────────────────────────────────────── */
  window.showToast = function (message, duration) {
    duration = duration || 3000;
    var toast = document.getElementById('toast-notification');
    var msg = document.getElementById('toast-message');
    if (!toast || !msg) return;
    msg.textContent = message;
    toast.style.opacity = '1';
    toast.style.transform = 'translateY(0)';
    clearTimeout(toast._hideTimeout);
    toast._hideTimeout = setTimeout(function () {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(8px)';
    }, duration);
  };

  /* ─── ACTIVE NAV LINKS ──────────────────────────────────────────── */
  document.addEventListener('DOMContentLoaded', function () {
    var currentPath = window.location.pathname;
    document.querySelectorAll('.nav-link').forEach(function (link) {
      try {
        if (link.href && link.href.includes(window.location.hostname)) {
          var linkPath = new URL(link.href).pathname;
          var isActive = linkPath === currentPath ||
            (currentPath.startsWith(linkPath) && linkPath !== '/' && linkPath.length > 1);
          if (isActive) {
            link.classList.add('active');
            link.style.color = 'var(--color-primary-600)';
          }
        }
      } catch (e) { /* ignore invalid URLs */ }
    });
  });

  /* ─── FOOTER TOGGLES (mobile collapsible) ─────────────────────────── */
  document.addEventListener('DOMContentLoaded', function () {
    var toggleBtns = document.querySelectorAll('.footer-toggle-btn');

    function isDesktop() { return window.innerWidth >= 768; }

    function showAllFooterLists() {
      document.querySelectorAll('.footer-list').forEach(function (list) {
        list.style.display = 'flex';
      });
    }

    function hideAllFooterLists() {
      document.querySelectorAll('.footer-list').forEach(function (list) {
        list.style.display = 'none';
      });
      document.querySelectorAll('.footer-chevron').forEach(function (c) {
        c.style.transform = 'rotate(0deg)';
      });
    }

    toggleBtns.forEach(function (btn) {
      btn.addEventListener('click', function () {
        if (isDesktop()) return;
        var section = btn.dataset.section;
        var list = document.querySelector('.footer-list[data-list="' + section + '"]');
        var chevron = btn.querySelector('.footer-chevron');
        if (!list) return;
        var isOpen = list.style.display === 'flex';
        hideAllFooterLists();
        if (!isOpen) {
          list.style.display = 'flex';
          if (chevron) chevron.style.transform = 'rotate(180deg)';
        }
      });
    });

    function handleResize() {
      if (isDesktop()) showAllFooterLists();
      else hideAllFooterLists();
    }

    window.addEventListener('resize', handleResize);
    handleResize();
  });

  /* ─── CART SIDEBAR RENDER ─────────────────────────────────────────── */
  function renderCartSidebar() {
    var cart = [];
    try { cart = JSON.parse(localStorage.getItem('dtb_cart') || '[]'); } catch (e) {}
    var itemsList = document.getElementById('cart-items-list');
    var emptyMsg = document.getElementById('cart-empty-msg');
    var subtotalEl = document.getElementById('cart-subtotal');

    if (!itemsList) return;

    if (cart.length === 0) {
      if (emptyMsg) emptyMsg.style.display = '';
      itemsList.innerHTML = '';
      if (subtotalEl) subtotalEl.textContent = '$0.00';
      return;
    }

    if (emptyMsg) emptyMsg.style.display = 'none';

    var total = 0;
    itemsList.innerHTML = cart.map(function (item) {
      var price = parseFloat(item.price) || 0;
      var qty = parseInt(item.quantity) || 1;
      total += price * qty;
      var safeSku = String(item.sku || '').replace(/'/g, "\\'").replace(/</g, '&lt;');
      var safeName = String(item.name || '').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      var safeSkuDisplay = String(item.sku || '').replace(/</g, '&lt;');
      return (
        '<div style="display:flex;gap:12px;padding:12px 0;border-bottom:1px solid var(--machined-border);">' +
        '<div style="width:60px;height:60px;background:#f8fafc;border-radius:4px;flex-shrink:0;display:flex;align-items:center;justify-content:center;overflow:hidden;">' +
        (item.image
          ? '<img src="' + item.image + '" style="width:100%;height:100%;object-fit:contain;" loading="lazy">'
          : '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="rgba(15,23,42,0.2)" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9l4-4 4 4 4-4 4 4"/></svg>') +
        '</div>' +
        '<div style="flex:1;min-width:0;">' +
        '<div style="font-size:0.8rem;font-weight:600;color:black;margin-bottom:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + safeName + '</div>' +
        '<div style="font-size:0.72rem;color:rgba(15,23,42,0.5);">' + safeSkuDisplay + '</div>' +
        '<div style="display:flex;align-items:center;justify-content:space-between;margin-top:6px;">' +
        '<span style="font-size:0.875rem;font-weight:700;color:var(--color-primary-600);">$' + price.toFixed(2) + ' &times; ' + qty + '</span>' +
        '<button onclick="removeFromCart(\'' + safeSku + '\')" style="background:none;border:none;cursor:pointer;color:rgba(15,23,42,0.4);font-size:0.75rem;padding:2px 4px;" title="Remove">&times;</button>' +
        '</div>' +
        '</div>' +
        '</div>'
      );
    }).join('');

    if (subtotalEl) subtotalEl.textContent = '$' + total.toFixed(2);
  }

  window.removeFromCart = function (sku) {
    var cart = [];
    try { cart = JSON.parse(localStorage.getItem('dtb_cart') || '[]'); } catch (e) {}
    cart = cart.filter(function (item) { return item.sku !== sku; });
    localStorage.setItem('dtb_cart', JSON.stringify(cart));
    renderCartSidebar();
    window.updateCartCounts();
  };

  /* ─── CART COUNT UPDATES ─────────────────────────────────────────── */
  window.updateCartCounts = function () {
    var cart = [];
    try { cart = JSON.parse(localStorage.getItem('dtb_cart') || '[]'); } catch (e) {}
    var count = cart.reduce(function (sum, item) {
      return sum + (parseInt(item.quantity) || 1);
    }, 0);

    ['cart-count-mobile', 'cart-count-desktop'].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) {
        el.textContent = count;
        el.style.display = count > 0 ? 'flex' : 'none';
      }
    });
  };

  document.addEventListener('DOMContentLoaded', window.updateCartCounts);

})();
