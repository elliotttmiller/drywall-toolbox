</main>

<footer class="site-footer" id="site-footer">
    <div class="footer-grid" style="padding:clamp(40px,6vw,80px) clamp(20px,5vw,40px);display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:60px;max-width:1400px;margin:0 auto;width:100%;">

        <!-- Brand Column -->
        <div style="display:flex;flex-direction:column;gap:2px;align-items:center;">
            <a href="<?php echo esc_url( home_url( '/' ) ); ?>">
                <img src="<?php echo esc_url( DTB_THEME_URI . '/assets/logo2.svg' ); ?>" alt="<?php bloginfo( 'name' ); ?>" style="height:80px;width:auto;" onerror="this.parentElement.innerHTML='<span style=\'font-weight:800;font-size:1.2rem;color:var(--color-primary-600);\'>DRYWALL TOOLBOX</span>'">
            </a>
            <div style="display:flex;gap:6px;margin-top:8px;justify-content:center;">
                <a href="https://instagram.com" target="_blank" rel="noopener noreferrer" aria-label="Instagram" style="color:var(--alloy-deep);">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/></svg>
                </a>
                <a href="https://facebook.com" target="_blank" rel="noopener noreferrer" aria-label="Facebook" style="color:var(--alloy-deep);">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/></svg>
                </a>
                <a href="https://twitter.com" target="_blank" rel="noopener noreferrer" aria-label="Twitter / X" style="color:var(--alloy-deep);">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M23 3a10.9 10.9 0 0 1-3.14 1.53 4.48 4.48 0 0 0-7.86 3v1A10.66 10.66 0 0 1 3 4s-4 9 5 13a11.64 11.64 0 0 1-7 2c9 5 20 0 20-11.5a4.5 4.5 0 0 0-.08-.83A7.72 7.72 0 0 0 23 3z"/></svg>
                </a>
            </div>
        </div>

        <!-- Shop Column -->
        <div class="footer-col" style="display:flex;flex-direction:column;align-items:center;gap:16px;">
            <button class="footer-toggle-btn" data-section="shop" style="background:none;border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px;padding:0;text-transform:uppercase;font-size:0.7rem;letter-spacing:0.12em;font-weight:800;color:var(--color-primary-600);width:100%;" aria-expanded="false">
                Shop
                <svg class="footer-chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="transition:transform 0.3s;"><polyline points="6 9 12 15 18 9"/></svg>
            </button>
            <ul class="footer-list" data-list="shop" style="list-style:none;padding:0;margin:0;display:none;flex-direction:column;gap:10px;align-items:center;">
                <li><a href="<?php echo esc_url( home_url( '/products' ) ); ?>" style="text-decoration:none;font-size:0.85rem;color:rgba(15,23,42,0.6);">All Products</a></li>
                <li><a href="<?php echo esc_url( home_url( '/products' ) ); ?>?category=taping" style="text-decoration:none;font-size:0.85rem;color:rgba(15,23,42,0.6);">Taping Tools</a></li>
                <li><a href="<?php echo esc_url( home_url( '/products' ) ); ?>?category=finishing" style="text-decoration:none;font-size:0.85rem;color:rgba(15,23,42,0.6);">Finishing Tools</a></li>
                <li><a href="<?php echo esc_url( home_url( '/products' ) ); ?>?category=sanding" style="text-decoration:none;font-size:0.85rem;color:rgba(15,23,42,0.6);">Sanding Tools</a></li>
                <li><a href="<?php echo esc_url( home_url( '/parts' ) ); ?>" style="text-decoration:none;font-size:0.85rem;color:rgba(15,23,42,0.6);">Parts &amp; Schematics</a></li>
            </ul>
        </div>

        <!-- Support Column -->
        <div class="footer-col" style="display:flex;flex-direction:column;align-items:center;gap:16px;">
            <button class="footer-toggle-btn" data-section="support" style="background:none;border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px;padding:0;text-transform:uppercase;font-size:0.7rem;letter-spacing:0.12em;font-weight:800;color:var(--color-primary-600);width:100%;" aria-expanded="false">
                Support
                <svg class="footer-chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="transition:transform 0.3s;"><polyline points="6 9 12 15 18 9"/></svg>
            </button>
            <ul class="footer-list" data-list="support" style="list-style:none;padding:0;margin:0;display:none;flex-direction:column;gap:10px;align-items:center;">
                <li><a href="<?php echo esc_url( home_url( '/contact' ) ); ?>" style="text-decoration:none;font-size:0.85rem;color:rgba(15,23,42,0.6);">Contact Us</a></li>
                <li><a href="<?php echo esc_url( home_url( '/repairs' ) ); ?>" style="text-decoration:none;font-size:0.85rem;color:rgba(15,23,42,0.6);">Repair Services</a></li>
                <li><a href="<?php echo esc_url( home_url( '/about' ) ); ?>" style="text-decoration:none;font-size:0.85rem;color:rgba(15,23,42,0.6);">About Us</a></li>
                <li><a href="#" style="text-decoration:none;font-size:0.85rem;color:rgba(15,23,42,0.6);">Shipping Policy</a></li>
                <li><a href="#" style="text-decoration:none;font-size:0.85rem;color:rgba(15,23,42,0.6);">Return Portal</a></li>
            </ul>
        </div>

    </div>

    <!-- Copyright bar -->
    <div style="border-top:1px solid var(--machined-border);padding:20px clamp(20px,5vw,40px);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;background-color:#f8fafc;text-align:center;">
        <p style="font-size:0.775rem;color:rgba(15,23,42,0.5);margin:0;font-weight:500;">&copy; 2026 Drywall Toolbox. All rights reserved.</p>
        <div style="display:flex;gap:16px;justify-content:center;flex-wrap:wrap;">
            <a href="#" style="font-size:0.775rem;color:rgba(15,23,42,0.45);text-decoration:none;">Privacy Policy</a>
            <a href="#" style="font-size:0.775rem;color:rgba(15,23,42,0.45);text-decoration:none;">Terms of Service</a>
        </div>
    </div>
</footer>

</div><!-- .site-wrapper -->

<script>
(function() {
    // ── Mobile menu toggle ──
    var mobileMenuBtn = document.getElementById('mobile-menu-btn');
    var mobileMenu    = document.getElementById('mobile-menu');
    var menuIcon      = document.getElementById('menu-icon');
    var closeIcon     = document.getElementById('close-icon');

    function closeMobileMenu() {
        if (mobileMenu)  mobileMenu.classList.remove('open');
        if (menuIcon)    menuIcon.style.display  = '';
        if (closeIcon)   closeIcon.style.display = 'none';
        if (mobileMenuBtn) mobileMenuBtn.setAttribute('aria-expanded', 'false');
    }
    window.closeMobileMenu = closeMobileMenu;

    if (mobileMenuBtn) {
        mobileMenuBtn.addEventListener('click', function() {
            var isOpen = mobileMenu && mobileMenu.classList.toggle('open');
            if (menuIcon)  menuIcon.style.display  = isOpen ? 'none' : '';
            if (closeIcon) closeIcon.style.display = isOpen ? ''     : 'none';
            this.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
        });
    }

    // ── Shop dropdown ──
    var shopToggle   = document.getElementById('shop-toggle');
    var shopDropdown = document.getElementById('shop-dropdown');
    var shopChevron  = document.getElementById('shop-chevron');

    if (shopToggle && shopDropdown) {
        shopToggle.addEventListener('click', function(e) {
            e.stopPropagation();
            var isOpen = shopDropdown.classList.toggle('open');
            if (shopChevron) shopChevron.style.transform = isOpen ? 'rotate(180deg)' : '';
            shopToggle.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
        });
        document.addEventListener('click', function() {
            shopDropdown.classList.remove('open');
            if (shopChevron) shopChevron.style.transform = '';
            shopToggle.setAttribute('aria-expanded', 'false');
        });
    }

    // ── Cart sidebar ──
    function openCart() {
        var sidebar = document.getElementById('cart-sidebar');
        var overlay = document.getElementById('cart-overlay');
        if (sidebar) sidebar.classList.add('open');
        if (overlay) overlay.classList.add('open');
        document.body.style.overflow = 'hidden';
    }
    function closeCart() {
        var sidebar = document.getElementById('cart-sidebar');
        var overlay = document.getElementById('cart-overlay');
        if (sidebar) sidebar.classList.remove('open');
        if (overlay) overlay.classList.remove('open');
        document.body.style.overflow = '';
    }
    window.openCart  = openCart;
    window.closeCart = closeCart;

    var cartBtnDesktop = document.getElementById('cart-btn-desktop');
    var cartBtnMobile  = document.getElementById('cart-btn-mobile');
    if (cartBtnDesktop) cartBtnDesktop.addEventListener('click', openCart);
    if (cartBtnMobile)  cartBtnMobile.addEventListener('click', openCart);

    // ── Footer collapsible sections (mobile) ──
    var footerBtns = document.querySelectorAll('.footer-toggle-btn');
    footerBtns.forEach(function(btn) {
        var section = btn.getAttribute('data-section');
        var list    = document.querySelector('.footer-list[data-list="' + section + '"]');
        var chevron = btn.querySelector('.footer-chevron');

        // Desktop: always show
        function updateVisibility() {
            if (window.innerWidth >= 768) {
                if (list) list.style.display = 'flex';
                if (chevron) chevron.style.transform = '';
            }
        }
        updateVisibility();
        window.addEventListener('resize', updateVisibility);

        btn.addEventListener('click', function() {
            if (window.innerWidth >= 768) return;
            var isOpen = list && list.style.display === 'flex';
            if (list)   list.style.display   = isOpen ? 'none' : 'flex';
            if (chevron) chevron.style.transform = isOpen ? '' : 'rotate(180deg)';
            btn.setAttribute('aria-expanded', isOpen ? 'false' : 'true');
        });
    });

    // ── Toast helper ──
    window.showToast = function(msg, duration) {
        var toast   = document.getElementById('toast-notification');
        var msgSpan = document.getElementById('toast-message');
        if (!toast || !msgSpan) return;
        msgSpan.textContent = msg;
        toast.style.opacity   = '1';
        toast.style.transform = 'translateY(0)';
        setTimeout(function() {
            toast.style.opacity   = '0';
            toast.style.transform = 'translateY(8px)';
        }, duration || 3000);
    };
})();
</script>

<?php wp_footer(); ?>
</body>
</html>
