<!DOCTYPE html>
<html <?php language_attributes(); ?>>
<head>
    <meta charset="<?php bloginfo( 'charset' ); ?>">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <link rel="profile" href="https://gmpg.org/xfn/11">
    <?php wp_head(); ?>
</head>

<body <?php body_class(); ?>>
<?php wp_body_open(); ?>

<!-- Dot-texture background -->
<div class="machined-bg" aria-hidden="true"></div>

<div id="page">

<header class="site-header" role="banner">
    <div class="site-header-inner">

        <!-- ── MOBILE LAYOUT ── -->
        <div class="header-mobile-layout">

            <button class="cart-toggle header-icon" id="cart-toggle-mobile" aria-label="<?php esc_attr_e( 'Open cart', 'drywall-toolbox' ); ?>">
                <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none"
                     stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
                     aria-hidden="true">
                    <circle cx="9" cy="21" r="1"></circle>
                    <circle cx="20" cy="21" r="1"></circle>
                    <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path>
                </svg>
                <span class="cart-badge" id="cart-count-mobile"><?php echo esc_html( dwtb_cart_count() ); ?></span>
            </button>

            <a href="<?php echo esc_url( home_url( '/' ) ); ?>" class="header-logo-link" aria-label="<?php esc_attr_e( 'Drywall Toolbox – Home', 'drywall-toolbox' ); ?>">
                <?php
                if ( has_custom_logo() ) {
                    the_custom_logo();
                } else {
                    ?>
                    <img src="<?php echo esc_url( get_template_directory_uri() . '/logo2.svg' ); ?>"
                         alt="<?php esc_attr_e( 'Drywall Toolbox', 'drywall-toolbox' ); ?>"
                         class="site-logo"
                         width="160" height="53">
                    <?php
                }
                ?>
            </a>

            <button class="header-icon" id="mobile-menu-toggle"
                    aria-controls="mobile-menu"
                    aria-expanded="false"
                    aria-label="<?php esc_attr_e( 'Toggle navigation menu', 'drywall-toolbox' ); ?>">
                <!-- Hamburger icon -->
                <svg class="icon-hamburger" xmlns="http://www.w3.org/2000/svg" width="24" height="24"
                     viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
                     stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                    <line x1="3" y1="6"  x2="21" y2="6"></line>
                    <line x1="3" y1="12" x2="21" y2="12"></line>
                    <line x1="3" y1="18" x2="21" y2="18"></line>
                </svg>
                <!-- Close icon (hidden by default) -->
                <svg class="icon-close" xmlns="http://www.w3.org/2000/svg" width="24" height="24"
                     viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
                     stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"
                     style="display:none;">
                    <line x1="18" y1="6"  x2="6"  y2="18"></line>
                    <line x1="6"  y1="6"  x2="18" y2="18"></line>
                </svg>
            </button>

        </div><!-- .header-mobile-layout -->

        <!-- ── DESKTOP LAYOUT ── -->
        <div class="header-desktop-layout">

            <!-- Left nav -->
            <div class="header-left">
                <nav class="nav-links" aria-label="<?php esc_attr_e( 'Primary Navigation', 'drywall-toolbox' ); ?>">

                    <!-- Shop dropdown -->
                    <div class="shop-dropdown-wrapper">
                        <button class="nav-link shop-dropdown-btn" aria-haspopup="true" aria-expanded="false">
                            <?php esc_html_e( 'Shop', 'drywall-toolbox' ); ?>
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24"
                                 fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"
                                 stroke-linejoin="round" aria-hidden="true" class="chevron-icon">
                                <polyline points="6 9 12 15 18 9"></polyline>
                            </svg>
                        </button>

                        <div class="shop-dropdown-menu" role="menu" aria-hidden="true">
                            <?php
                            $shop_id  = function_exists( 'wc_get_page_id' ) ? wc_get_page_id( 'shop' ) : 0;
                            $shop_url = $shop_id ? get_permalink( $shop_id ) : home_url( '/shop/' );
                            ?>
                            <a class="dropdown-item" role="menuitem"
                               href="<?php echo esc_url( $shop_url ); ?>">
                                <?php esc_html_e( 'All Products', 'drywall-toolbox' ); ?>
                            </a>
                            <a class="dropdown-item" role="menuitem"
                               href="<?php echo esc_url( add_query_arg( 'view', 'brands', $shop_url ) ); ?>">
                                <?php esc_html_e( 'Brands', 'drywall-toolbox' ); ?>
                            </a>
                        </div>
                    </div><!-- .shop-dropdown-wrapper -->

                    <a href="<?php echo dwtb_get_page_url( 'parts' ); ?>"
                       class="nav-link<?php echo is_page( 'parts' ) ? ' active' : ''; ?>">
                        <?php esc_html_e( 'Parts', 'drywall-toolbox' ); ?>
                    </a>

                </nav>
            </div><!-- .header-left -->

            <!-- Center logo -->
            <div class="header-center">
                <a href="<?php echo esc_url( home_url( '/' ) ); ?>" class="header-logo-link"
                   aria-label="<?php esc_attr_e( 'Drywall Toolbox – Home', 'drywall-toolbox' ); ?>">
                    <?php
                    if ( has_custom_logo() ) {
                        the_custom_logo();
                    } else {
                        ?>
                        <img src="<?php echo esc_url( get_template_directory_uri() . '/logo2.svg' ); ?>"
                             alt="<?php esc_attr_e( 'Drywall Toolbox', 'drywall-toolbox' ); ?>"
                             class="site-logo"
                             width="200" height="67">
                        <?php
                    }
                    ?>
                </a>
            </div><!-- .header-center -->

            <!-- Right nav -->
            <div class="header-right">
                <nav class="nav-links" aria-label="<?php esc_attr_e( 'Secondary Navigation', 'drywall-toolbox' ); ?>">
                    <a href="<?php echo dwtb_get_page_url( 'about' ); ?>"
                       class="nav-link<?php echo is_page( 'about' ) ? ' active' : ''; ?>">
                        <?php esc_html_e( 'About', 'drywall-toolbox' ); ?>
                    </a>
                    <a href="<?php echo dwtb_get_page_url( 'contact' ); ?>"
                       class="nav-link<?php echo is_page( 'contact' ) ? ' active' : ''; ?>">
                        <?php esc_html_e( 'Contact', 'drywall-toolbox' ); ?>
                    </a>
                </nav>

                <div class="cart-area">
                    <button class="cart-toggle header-icon" id="cart-toggle-desktop"
                            aria-label="<?php esc_attr_e( 'Open cart', 'drywall-toolbox' ); ?>">
                        <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24"
                             fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"
                             stroke-linejoin="round" aria-hidden="true">
                            <circle cx="9" cy="21" r="1"></circle>
                            <circle cx="20" cy="21" r="1"></circle>
                            <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path>
                        </svg>
                        <span class="cart-badge" id="cart-count-desktop"><?php echo esc_html( dwtb_cart_count() ); ?></span>
                    </button>
                </div>

            </div><!-- .header-right -->

        </div><!-- .header-desktop-layout -->

    </div><!-- .site-header-inner -->

    <!-- ── MOBILE MENU ── -->
    <div id="mobile-menu" class="header-mobile-menu" aria-hidden="true" role="dialog" aria-label="<?php esc_attr_e( 'Mobile navigation', 'drywall-toolbox' ); ?>">
        <nav aria-label="<?php esc_attr_e( 'Mobile Primary Navigation', 'drywall-toolbox' ); ?>">

            <!-- Shop dropdown (mobile) -->
            <div class="mobile-nav-group">
                <button class="mobile-nav-link mobile-dropdown-btn" aria-expanded="false">
                    <?php esc_html_e( 'Shop', 'drywall-toolbox' ); ?>
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24"
                         fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"
                         stroke-linejoin="round" aria-hidden="true" class="chevron-icon">
                        <polyline points="6 9 12 15 18 9"></polyline>
                    </svg>
                </button>
                <div class="mobile-dropdown-menu">
                    <?php
                    $shop_id  = function_exists( 'wc_get_page_id' ) ? wc_get_page_id( 'shop' ) : 0;
                    $shop_url = $shop_id ? get_permalink( $shop_id ) : home_url( '/shop/' );
                    ?>
                    <a class="mobile-nav-sub-link" href="<?php echo esc_url( $shop_url ); ?>">
                        <?php esc_html_e( 'All Products', 'drywall-toolbox' ); ?>
                    </a>
                    <a class="mobile-nav-sub-link"
                       href="<?php echo esc_url( add_query_arg( 'view', 'brands', $shop_url ) ); ?>">
                        <?php esc_html_e( 'Brands', 'drywall-toolbox' ); ?>
                    </a>
                </div>
            </div>

            <a href="<?php echo dwtb_get_page_url( 'parts' ); ?>"
               class="mobile-nav-link<?php echo is_page( 'parts' ) ? ' active' : ''; ?>">
                <?php esc_html_e( 'Parts', 'drywall-toolbox' ); ?>
            </a>
            <a href="<?php echo dwtb_get_page_url( 'about' ); ?>"
               class="mobile-nav-link<?php echo is_page( 'about' ) ? ' active' : ''; ?>">
                <?php esc_html_e( 'About', 'drywall-toolbox' ); ?>
            </a>
            <a href="<?php echo dwtb_get_page_url( 'contact' ); ?>"
               class="mobile-nav-link<?php echo is_page( 'contact' ) ? ' active' : ''; ?>">
                <?php esc_html_e( 'Contact', 'drywall-toolbox' ); ?>
            </a>

        </nav>
    </div><!-- #mobile-menu -->

</header><!-- .site-header -->

<div id="content" class="site-content">
