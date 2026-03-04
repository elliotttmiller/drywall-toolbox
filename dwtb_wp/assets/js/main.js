(function() {
  'use strict';

  document.addEventListener('DOMContentLoaded', function() {

    // === MOBILE MENU ===
    var mobileMenuToggle = document.getElementById('mobile-menu-toggle');
    var mobileMenu = document.getElementById('mobile-menu');
    var hamburgerIcon = document.getElementById('hamburger-icon');
    var closeIcon = document.getElementById('close-icon');

    if (mobileMenuToggle && mobileMenu) {
      mobileMenuToggle.addEventListener('click', function() {
        var isOpen = mobileMenu.style.display === 'block';
        mobileMenu.style.display = isOpen ? 'none' : 'block';
        if (hamburgerIcon) hamburgerIcon.style.display = isOpen ? 'block' : 'none';
        if (closeIcon) closeIcon.style.display = isOpen ? 'none' : 'block';
        this.setAttribute('aria-expanded', String(!isOpen));
      });
    }

    // === SHOP DROPDOWN ===
    var shopDropdownBtn = document.querySelector('.shop-dropdown-btn');
    var shopDropdownMenu = document.querySelector('.shop-dropdown-menu');
    var dropdownTimeout;

    if (shopDropdownBtn && shopDropdownMenu) {
      function openDropdown() {
        clearTimeout(dropdownTimeout);
        shopDropdownMenu.style.display = 'block';
        shopDropdownMenu.style.opacity = '1';
        shopDropdownMenu.style.transform = 'translateY(0)';
        var chevron = shopDropdownBtn.querySelector('.chevron-icon');
        if (chevron) chevron.style.transform = 'rotate(180deg)';
      }
      function closeDropdown() {
        dropdownTimeout = setTimeout(function() {
          shopDropdownMenu.style.display = 'none';
          var chevron = shopDropdownBtn.querySelector('.chevron-icon');
          if (chevron) chevron.style.transform = 'rotate(0deg)';
        }, 150);
      }

      shopDropdownBtn.addEventListener('mouseenter', openDropdown);
      shopDropdownBtn.addEventListener('mouseleave', closeDropdown);
      shopDropdownMenu.addEventListener('mouseenter', function() { clearTimeout(dropdownTimeout); });
      shopDropdownMenu.addEventListener('mouseleave', closeDropdown);
      shopDropdownBtn.addEventListener('click', function() {
        var isVisible = shopDropdownMenu.style.display === 'block';
        if (isVisible) { closeDropdown(); } else { openDropdown(); }
      });
    }

    // === MOBILE SHOP DROPDOWN ===
    var mobileShopBtn = document.querySelector('.mobile-shop-btn');
    var mobileShopMenu = document.querySelector('.mobile-shop-submenu');
    if (mobileShopBtn && mobileShopMenu) {
      mobileShopBtn.addEventListener('click', function() {
        var isOpen = mobileShopMenu.style.display === 'block';
        mobileShopMenu.style.display = isOpen ? 'none' : 'block';
        var chevron = this.querySelector('.chevron-icon');
        if (chevron) chevron.style.transform = isOpen ? 'rotate(0deg)' : 'rotate(180deg)';
      });
    }

    // === HEADER SCROLL SHADOW ===
    var siteHeader = document.querySelector('.site-header');
    if (siteHeader) {
      window.addEventListener('scroll', function() {
        siteHeader.style.boxShadow = window.scrollY > 10
          ? '0 4px 24px rgba(0,0,0,0.06)'
          : 'none';
      }, { passive: true });
    }

    // === ACTIVE NAV LINKS ===
    var navLinks = document.querySelectorAll('.nav-link, .nav-link-mobile');
    var currentPath = window.location.pathname;
    navLinks.forEach(function(link) {
      var href = link.getAttribute('href');
      if (href && href !== '/' && currentPath.includes(href)) {
        link.classList.add('active');
        link.style.color = 'var(--tension-accent)';
      } else if (href === '/' && currentPath === '/') {
        link.classList.add('active');
      }
    });

    // === FOOTER ACCORDION (mobile) ===
    var footerAccordionBtns = document.querySelectorAll('.footer-accordion-btn');
    footerAccordionBtns.forEach(function(btn) {
      var list = btn.nextElementSibling;
      var chevron = btn.querySelector('.footer-chevron');

      if (window.innerWidth < 768 && list) {
        list.style.display = 'none';
      }

      btn.addEventListener('click', function() {
        if (!list || window.innerWidth >= 768) return;
        var isOpen = list.style.display === 'block' || list.style.display === '';
        list.style.display = isOpen ? 'none' : 'block';
        if (chevron) {
          chevron.style.transform = isOpen ? 'rotate(0deg)' : 'rotate(180deg)';
        }
      });
    });

    // === CART SIDEBAR ===
    var cartOverlay = document.getElementById('cart-overlay');
    var cartPanel = document.getElementById('cart-panel');
    var cartToggleBtns = document.querySelectorAll('.cart-toggle');
    var cartPanelClose = document.getElementById('cart-panel-close');

    function openCart() {
      if (cartOverlay) { cartOverlay.classList.add('open'); }
      if (cartPanel) { cartPanel.classList.add('open'); }
      document.body.style.overflow = 'hidden';
    }

    function closeCart() {
      if (cartOverlay) { cartOverlay.classList.remove('open'); }
      if (cartPanel) { cartPanel.classList.remove('open'); }
      document.body.style.overflow = '';
    }

    cartToggleBtns.forEach(function(btn) {
      btn.addEventListener('click', function(e) {
        e.stopPropagation();
        var isOpen = cartPanel && cartPanel.classList.contains('open');
        if (isOpen) { closeCart(); } else { openCart(); }
      });
    });

    if (cartOverlay) {
      cartOverlay.addEventListener('click', closeCart);
    }

    if (cartPanelClose) {
      cartPanelClose.addEventListener('click', closeCart);
    }

    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape') { closeCart(); }
    });

    // === SECTION ENTER ANIMATIONS ===
    if ('IntersectionObserver' in window) {
      var sections = document.querySelectorAll('.animate-on-scroll');
      var observer = new IntersectionObserver(function(entries) {
        entries.forEach(function(entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add('section-enter');
            observer.unobserve(entry.target);
          }
        });
      }, { threshold: 0.1 });
      sections.forEach(function(section) { observer.observe(section); });
    }

    // === SHOP PAGE - BRAND SELECTOR ===
    var brandCards = document.querySelectorAll('.brand-card[data-brand]');
    brandCards.forEach(function(card) {
      card.addEventListener('click', function() {
        var brand = this.getAttribute('data-brand');
        if (brand) {
          window.location.href = window.location.pathname + '?brand=' + encodeURIComponent(brand);
        }
      });
    });

    // === SHOP PAGE - FILTER INTERACTIONS ===
    var filterForm = document.getElementById('shop-filter-form');
    if (filterForm) {
      var checkboxes = filterForm.querySelectorAll('input[type="checkbox"]');
      var priceRangeFilter = filterForm.querySelector('#price-range');

      checkboxes.forEach(function(cb) {
        cb.addEventListener('change', function() {
          filterForm.submit();
        });
      });

      if (priceRangeFilter) {
        var priceRangeDisplay = document.getElementById('price-range-display');
        priceRangeFilter.addEventListener('input', function() {
          if (priceRangeDisplay) { priceRangeDisplay.textContent = '$' + this.value; }
        });
      }
    }

    // === PRICE RANGE SLIDER ===
    var priceSlider = document.getElementById('price-range');
    var priceDisplay = document.getElementById('price-display');
    if (priceSlider && priceDisplay) {
      priceSlider.addEventListener('input', function() {
        priceDisplay.textContent = '$' + parseInt(this.value).toLocaleString();
      });
    }

  }); // end DOMContentLoaded

})();
