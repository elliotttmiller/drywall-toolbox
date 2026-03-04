</div><!-- #content .site-content -->

<footer class="site-footer" role="contentinfo">

    <div class="footer-content">

        <!-- Brand / Logo column (order 3 on mobile) -->
        <div class="footer-col footer-brand-col">
            <a href="<?php echo esc_url( home_url( '/' ) ); ?>"
               class="footer-logo-link"
               aria-label="<?php esc_attr_e( 'Drywall Toolbox – Home', 'drywall-toolbox' ); ?>">
                <img src="<?php echo esc_url( get_template_directory_uri() . '/logo2.svg' ); ?>"
                     alt="<?php esc_attr_e( 'Drywall Toolbox', 'drywall-toolbox' ); ?>"
                     width="280" height="94">
            </a>

            <div class="social-links" aria-label="<?php esc_attr_e( 'Social media links', 'drywall-toolbox' ); ?>">

                <!-- Instagram -->
                <a href="https://instagram.com/drywalltoolbox" target="_blank" rel="noopener noreferrer"
                   class="social-link" aria-label="<?php esc_attr_e( 'Instagram', 'drywall-toolbox' ); ?>">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24"
                         fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"
                         stroke-linejoin="round" aria-hidden="true">
                        <rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect>
                        <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path>
                        <line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line>
                    </svg>
                </a>

                <!-- Facebook -->
                <a href="https://facebook.com/drywalltoolbox" target="_blank" rel="noopener noreferrer"
                   class="social-link" aria-label="<?php esc_attr_e( 'Facebook', 'drywall-toolbox' ); ?>">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24"
                         fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"
                         stroke-linejoin="round" aria-hidden="true">
                        <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"></path>
                    </svg>
                </a>

                <!-- Twitter / X -->
                <a href="https://twitter.com/drywalltoolbox" target="_blank" rel="noopener noreferrer"
                   class="social-link" aria-label="<?php esc_attr_e( 'Twitter', 'drywall-toolbox' ); ?>">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24"
                         fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"
                         stroke-linejoin="round" aria-hidden="true">
                        <path d="M23 3a10.9 10.9 0 0 1-3.14 1.53A4.48 4.48 0 0 0 22.43.36a9 9 0 0 1-2.83 1.08A4.48 4.48 0 0 0 16.11 0c-2.47 0-4.48 2-4.48 4.48 0 .35.04.7.11 1.03C7.69 5.33 4.07 3.6 1.64.96a4.48 4.48 0 0 0-.61 2.25c0 1.56.79 2.93 2 3.73a4.49 4.49 0 0 1-2.03-.56v.06c0 2.17 1.55 3.99 3.6 4.4a4.53 4.53 0 0 1-2.02.08 4.49 4.49 0 0 0 4.19 3.12A9 9 0 0 1 1 19.54a12.73 12.73 0 0 0 6.88 2.02c8.26 0 12.78-6.84 12.78-12.78 0-.19 0-.38-.01-.57A9.13 9.13 0 0 0 23 3z"></path>
                    </svg>
                </a>

            </div><!-- .social-links -->
        </div><!-- .footer-brand-col -->

        <!-- Menu column (order 1 on mobile) -->
        <div class="footer-col footer-menu-col">
            <button class="footer-accordion-btn" aria-expanded="false" aria-controls="footer-menu-list">
                <h5><?php esc_html_e( 'Menu', 'drywall-toolbox' ); ?></h5>
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24"
                     fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"
                     stroke-linejoin="round" aria-hidden="true" class="chevron-icon">
                    <polyline points="6 9 12 15 18 9"></polyline>
                </svg>
            </button>

            <ul class="footer-nav-list" id="footer-menu-list" role="list">
                <?php
                $shop_id  = function_exists( 'wc_get_page_id' ) ? wc_get_page_id( 'shop' ) : 0;
                $shop_url = $shop_id ? get_permalink( $shop_id ) : home_url( '/shop/' );
                ?>
                <li>
                    <a href="<?php echo esc_url( $shop_url ); ?>">
                        <?php esc_html_e( 'Shop', 'drywall-toolbox' ); ?>
                    </a>
                </li>
                <li>
                    <a href="<?php echo dwtb_get_page_url( 'parts' ); ?>">
                        <?php esc_html_e( 'Parts', 'drywall-toolbox' ); ?>
                    </a>
                </li>
                <li>
                    <a href="<?php echo dwtb_get_page_url( 'about' ); ?>">
                        <?php esc_html_e( 'About Us', 'drywall-toolbox' ); ?>
                    </a>
                </li>
            </ul>
        </div><!-- .footer-menu-col -->

        <!-- Support column (order 2 on mobile) -->
        <div class="footer-col footer-support-col">
            <button class="footer-accordion-btn" aria-expanded="false" aria-controls="footer-support-list">
                <h5><?php esc_html_e( 'Support', 'drywall-toolbox' ); ?></h5>
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24"
                     fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"
                     stroke-linejoin="round" aria-hidden="true" class="chevron-icon">
                    <polyline points="6 9 12 15 18 9"></polyline>
                </svg>
            </button>

            <ul class="footer-nav-list" id="footer-support-list" role="list">
                <li>
                    <a href="<?php echo esc_url( home_url( '/shipping-policy/' ) ); ?>">
                        <?php esc_html_e( 'Shipping Policy', 'drywall-toolbox' ); ?>
                    </a>
                </li>
                <li>
                    <a href="<?php echo esc_url( home_url( '/return-portal/' ) ); ?>">
                        <?php esc_html_e( 'Return Portal', 'drywall-toolbox' ); ?>
                    </a>
                </li>
                <li>
                    <a href="<?php echo esc_url( home_url( '/safety-guides/' ) ); ?>">
                        <?php esc_html_e( 'Safety Guides', 'drywall-toolbox' ); ?>
                    </a>
                </li>
                <li>
                    <a href="<?php echo dwtb_get_page_url( 'contact' ); ?>">
                        <?php esc_html_e( 'Contact', 'drywall-toolbox' ); ?>
                    </a>
                </li>
            </ul>
        </div><!-- .footer-support-col -->

    </div><!-- .footer-content -->

    <div class="footer-copyright">
        <p>&copy; 2026 <?php esc_html_e( 'Drywall Toolbox.', 'drywall-toolbox' ); ?></p>
    </div>

</footer><!-- .site-footer -->

<!-- ── CART SIDEBAR ────────────────────────────────────────────────────── -->

<div id="cart-overlay" class="cart-overlay" aria-hidden="true"></div>

<div id="cart-panel" class="cart-panel" role="dialog" aria-modal="true"
     aria-label="<?php esc_attr_e( 'Shopping cart', 'drywall-toolbox' ); ?>"
     aria-hidden="true">

    <div class="cart-panel-header">
        <h2 class="cart-panel-title"><?php esc_html_e( 'Cart', 'drywall-toolbox' ); ?></h2>
        <button class="cart-panel-close header-icon" id="cart-panel-close"
                aria-label="<?php esc_attr_e( 'Close cart', 'drywall-toolbox' ); ?>">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24"
                 fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"
                 stroke-linejoin="round" aria-hidden="true">
                <line x1="18" y1="6"  x2="6"  y2="18"></line>
                <line x1="6"  y1="6"  x2="18" y2="18"></line>
            </svg>
        </button>
    </div><!-- .cart-panel-header -->

    <div id="cart-items" class="cart-panel-items">
        <?php
        if ( function_exists( 'WC' ) && WC()->cart && ! WC()->cart->is_empty() ) {
            foreach ( WC()->cart->get_cart() as $cart_item_key => $cart_item ) {
                $product = $cart_item['data'];
                if ( ! $product || ! $product->exists() ) {
                    continue;
                }
                ?>
                <div class="cart-item" data-key="<?php echo esc_attr( $cart_item_key ); ?>">
                    <div class="cart-item-image">
                        <?php echo wp_kses_post( $product->get_image( 'thumbnail' ) ); ?>
                    </div>
                    <div class="cart-item-details">
                        <p class="cart-item-name"><?php echo esc_html( $product->get_name() ); ?></p>
                        <p class="cart-item-price"><?php echo wp_kses_post( WC()->cart->get_product_price( $product ) ); ?></p>
                        <p class="cart-item-qty">
                            <?php
                            echo esc_html(
                                sprintf(
                                    /* translators: %d: quantity */
                                    __( 'Qty: %d', 'drywall-toolbox' ),
                                    $cart_item['quantity']
                                )
                            );
                            ?>
                        </p>
                    </div>
                </div>
                <?php
            }
        } else {
            ?>
            <p class="cart-empty-message"><?php esc_html_e( 'Your cart is empty.', 'drywall-toolbox' ); ?></p>
            <?php
        }
        ?>
    </div><!-- #cart-items -->

    <div class="cart-panel-footer">
        <?php if ( function_exists( 'WC' ) && WC()->cart ) : ?>
            <div class="cart-total-row">
                <span class="cart-total-label"><?php esc_html_e( 'Total', 'drywall-toolbox' ); ?></span>
                <span class="cart-total-amount"><?php echo wp_kses_post( WC()->cart->get_cart_total() ); ?></span>
            </div>
            <a href="<?php echo esc_url( function_exists( 'wc_get_checkout_url' ) ? wc_get_checkout_url() : home_url( '/checkout/' ) ); ?>"
               class="alloy-button" style="width:100%;justify-content:center;display:flex;">
                <?php esc_html_e( 'Checkout', 'drywall-toolbox' ); ?>
            </a>
        <?php endif; ?>
    </div><!-- .cart-panel-footer -->

</div><!-- #cart-panel -->

</div><!-- #page -->

<?php wp_footer(); ?>
</body>
</html>
