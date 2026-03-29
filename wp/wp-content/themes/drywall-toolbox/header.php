<!DOCTYPE html>
<html <?php language_attributes(); ?>>
<head>
    <meta charset="<?php bloginfo( 'charset' ); ?>">
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
    <link rel="profile" href="https://gmpg.org/xfn/11">
    <?php wp_head(); ?>
</head>
<body <?php body_class(); ?>>
<?php wp_body_open(); ?>

<div class="machined-bg"></div>

<div class="site-wrapper" style="display:flex;flex-direction:column;min-height:100vh;">

<header class="site-header" role="banner" id="site-header">
    <div class="site-header-inner">

        <!-- MOBILE LAYOUT -->
        <div class="mobile-header-row" id="mobile-header-row">
            <button class="header-icon" id="mobile-menu-btn" aria-label="Toggle menu" style="background:none;border:none;cursor:pointer;padding:8px;color:#0f172a;">
                <svg id="menu-icon" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
                <svg id="close-icon" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:none"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
            <a href="<?php echo esc_url( home_url( '/' ) ); ?>" class="mobile-logo-link">
                <img src="<?php echo esc_url( DTB_THEME_URI . '/assets/logo2.svg' ); ?>" alt="<?php bloginfo( 'name' ); ?>" class="logo-image-mobile" onerror="this.style.display='none'">
                <span style="font-weight:800;font-size:1rem;color:var(--color-primary-600);">DRYWALL TOOLBOX</span>
            </a>
            <button class="header-icon" id="cart-btn-mobile" aria-label="Open cart" style="position:relative;background:none;border:none;cursor:pointer;padding:8px;color:#0f172a;">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>
                <span class="cart-badge" id="cart-count-mobile" style="display:none;">0</span>
            </button>
        </div>

        <!-- DESKTOP LAYOUT -->
        <div class="desktop-header-row" id="desktop-header-row">
            <!-- Left Nav -->
            <nav class="header-left" aria-label="Primary">
                <ul class="nav-links">
                    <li style="position:relative;">
                        <button class="nav-link shop-toggle" id="shop-toggle" style="background:none;border:none;cursor:pointer;font-family:inherit;display:flex;align-items:center;gap:4px;" aria-expanded="false" aria-haspopup="true">
                            Shop
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" id="shop-chevron" style="transition:transform 200ms;vertical-align:middle;"><polyline points="6 9 12 15 18 9"/></svg>
                        </button>
                        <div class="shop-dropdown" id="shop-dropdown" role="menu">
                            <a href="<?php echo esc_url( home_url( '/products' ) ); ?>" role="menuitem">All Products</a>
                            <a href="<?php echo esc_url( home_url( '/products' ) ); ?>?brand=TapeTech" role="menuitem">TapeTech</a>
                            <a href="<?php echo esc_url( home_url( '/products' ) ); ?>?brand=Columbia" role="menuitem">Columbia</a>
                            <a href="<?php echo esc_url( home_url( '/products' ) ); ?>?brand=SurPro" role="menuitem">SurPro</a>
                            <a href="<?php echo esc_url( home_url( '/products' ) ); ?>?brand=Asgard" role="menuitem">Asgard</a>
                            <a href="<?php echo esc_url( home_url( '/products' ) ); ?>?brand=Graco" role="menuitem">Graco</a>
                        </div>
                    </li>
                    <li><a href="<?php echo esc_url( home_url( '/parts' ) ); ?>" class="nav-link">Parts &amp; Schematics</a></li>
                    <li><a href="<?php echo esc_url( home_url( '/repairs' ) ); ?>" class="nav-link">Repairs</a></li>
                </ul>
            </nav>

            <!-- Center Logo -->
            <a href="<?php echo esc_url( home_url( '/' ) ); ?>" class="header-logo" style="justify-self:center;">
                <img src="<?php echo esc_url( DTB_THEME_URI . '/assets/logo2.svg' ); ?>" alt="<?php bloginfo( 'name' ); ?>" class="logo-image" onerror="this.style.display='none'">
                <span class="logo-text" style="font-weight:800;font-size:1.1rem;color:var(--color-primary-600);display:none;">DRYWALL TOOLBOX</span>
            </a>

            <!-- Right Nav -->
            <nav class="header-right" aria-label="Secondary">
                <ul class="nav-links" style="justify-content:flex-end;">
                    <li><a href="<?php echo esc_url( home_url( '/about' ) ); ?>" class="nav-link">About</a></li>
                    <li><a href="<?php echo esc_url( home_url( '/contact' ) ); ?>" class="nav-link">Contact</a></li>
                    <li>
                        <button class="header-icon" id="cart-btn-desktop" aria-label="Open cart" style="position:relative;background:none;border:none;cursor:pointer;padding:8px;color:#0f172a;">
                            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>
                            <span class="cart-badge" id="cart-count-desktop" style="display:none;">0</span>
                        </button>
                    </li>
                </ul>
            </nav>
        </div>

    </div>
</header>

<!-- Mobile Menu -->
<nav class="mobile-menu" id="mobile-menu" aria-label="Mobile navigation">
    <a href="<?php echo esc_url( home_url( '/' ) ); ?>" onclick="closeMobileMenu()">Home</a>
    <a href="<?php echo esc_url( home_url( '/products' ) ); ?>" onclick="closeMobileMenu()">All Products</a>
    <a href="<?php echo esc_url( home_url( '/parts' ) ); ?>" onclick="closeMobileMenu()">Parts &amp; Schematics</a>
    <a href="<?php echo esc_url( home_url( '/repairs' ) ); ?>" onclick="closeMobileMenu()">Repairs</a>
    <a href="<?php echo esc_url( home_url( '/about' ) ); ?>" onclick="closeMobileMenu()">About</a>
    <a href="<?php echo esc_url( home_url( '/contact' ) ); ?>" onclick="closeMobileMenu()">Contact</a>
    <a href="<?php echo esc_url( home_url( '/cart' ) ); ?>" onclick="closeMobileMenu()">Cart</a>
</nav>

<!-- Cart Overlay -->
<div class="cart-overlay" id="cart-overlay" onclick="closeCart()" role="presentation"></div>

<!-- Cart Sidebar -->
<aside class="cart-sidebar" id="cart-sidebar" aria-label="Shopping cart">
    <div style="display:flex;align-items:center;justify-content:space-between;padding:20px 24px;border-bottom:1px solid var(--machined-border);">
        <h2 style="font-size:1rem;font-weight:700;margin:0;color:var(--alloy-deep);">Your Cart</h2>
        <button onclick="closeCart()" style="background:none;border:none;cursor:pointer;padding:4px;" aria-label="Close cart">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
    </div>
    <div id="cart-sidebar-items" style="flex:1;overflow-y:auto;padding:16px 24px;">
        <div id="cart-empty-msg" style="text-align:center;padding:40px 0;color:rgba(15,23,42,0.4);">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="margin:0 auto 12px;display:block;opacity:0.3;"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>
            <p style="font-size:0.875rem;">Your cart is empty</p>
        </div>
        <div id="cart-items-list"></div>
    </div>
    <div style="padding:16px 24px;border-top:1px solid var(--machined-border);">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
            <span style="font-weight:600;font-size:0.9rem;">Subtotal</span>
            <span id="cart-subtotal" style="font-weight:800;font-size:1.1rem;color:var(--color-primary-600);">$0.00</span>
        </div>
        <a href="<?php echo esc_url( home_url( '/checkout' ) ); ?>" class="alloy-button" style="display:block;text-align:center;text-decoration:none;">Checkout</a>
    </div>
</aside>

<!-- Toast Notification -->
<div id="toast-notification" role="status" aria-live="polite" style="position:fixed;bottom:24px;right:24px;background:var(--color-primary-600);color:white;padding:12px 20px;border-radius:8px;font-size:0.875rem;font-weight:600;z-index:9999;opacity:0;transform:translateY(8px);transition:opacity 0.3s,transform 0.3s;pointer-events:none;max-width:300px;">
    <span id="toast-message"></span>
</div>

<main class="main-content" id="main-content">
