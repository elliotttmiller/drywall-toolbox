<?php
/**
 * Template Name: Shop
 *
 * @package drywall-toolbox
 */

get_header();

// ─── Brand list ───────────────────────────────────────────────────────────────
$brands = array(
    'tapetech'             => 'TapeTech',
    'columbia-taping-tools'=> 'Columbia Taping Tools',
    'asgard'               => 'Asgard',
    'surpro'               => 'SurPro',
    'spray-king'           => 'Spray King',
    'graco'                => 'Graco',
);

// Sanitize brand query arg
$selected_brand     = isset( $_GET['brand'] ) ? sanitize_key( $_GET['brand'] ) : '';  // phpcs:ignore WordPress.Security.NonceVerification.Recommended
$selected_brand_name = isset( $brands[ $selected_brand ] ) ? $brands[ $selected_brand ] : '';
?>

<main id="main" class="site-main" role="main">
    <div class="page-container">

        <?php if ( ! class_exists( 'WooCommerce' ) ) : ?>

            <!-- WooCommerce not active fallback -->
            <div class="wc-missing-notice">
                <h2><?php esc_html_e( 'Shop Coming Soon', 'drywall-toolbox' ); ?></h2>
                <p><?php esc_html_e( 'Our online store is being set up. Please check back soon.', 'drywall-toolbox' ); ?></p>
                <a href="<?php echo esc_url( home_url( '/' ) ); ?>" class="alloy-button">
                    <?php esc_html_e( 'Back to Home', 'drywall-toolbox' ); ?>
                </a>
            </div>

        <?php elseif ( empty( $selected_brand ) ) : ?>

            <!-- ── BRAND SELECTOR ─────────────────────────────────────────────── -->
            <section class="brand-selector-section">
                <h1 class="machined-title" style="color:var(--primary-600);">
                    <?php esc_html_e( 'SHOP BY BRAND', 'drywall-toolbox' ); ?>
                </h1>
                <p class="brand-selector-subtitle">
                    <?php esc_html_e( 'Choose a brand to browse professional drywall tools, finishing equipment, and accessories.', 'drywall-toolbox' ); ?>
                </p>

                <div class="brand-selector-grid">
                    <?php foreach ( $brands as $slug => $name ) :
                        $initial = mb_strtoupper( mb_substr( $name, 0, 1, 'UTF-8' ), 'UTF-8' );
                        $shop_id  = function_exists( 'wc_get_page_id' ) ? wc_get_page_id( 'shop' ) : 0;
                        $shop_url = $shop_id ? get_permalink( $shop_id ) : home_url( '/shop/' );
                        $brand_url = add_query_arg( 'brand', $slug, $shop_url );
                    ?>
                        <div class="brand-card"
                             role="button"
                             tabindex="0"
                             data-href="<?php echo esc_url( $brand_url ); ?>"
                             onclick="window.location='<?php echo esc_js( $brand_url ); ?>'"
                             onkeydown="if(event.key==='Enter'||event.key===' ')window.location='<?php echo esc_js( $brand_url ); ?>'"
                             aria-label="<?php echo esc_attr( sprintf( __( 'Shop %s', 'drywall-toolbox' ), $name ) ); ?>">
                            <div class="brand-logo-placeholder" aria-hidden="true">
                                <?php echo esc_html( $initial ); ?>
                            </div>
                            <p class="brand-name"><?php echo esc_html( $name ); ?></p>
                        </div>
                    <?php endforeach; ?>
                </div><!-- .brand-selector-grid -->
            </section>

        <?php else : ?>

            <!-- ── BRAND PRODUCT VIEW ─────────────────────────────────────────── -->
            <?php
            $shop_id  = function_exists( 'wc_get_page_id' ) ? wc_get_page_id( 'shop' ) : 0;
            $shop_url = $shop_id ? get_permalink( $shop_id ) : home_url( '/shop/' );
            ?>

            <div class="shop-back-row">
                <a href="<?php echo esc_url( $shop_url ); ?>" class="shop-back-btn">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24"
                         fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"
                         stroke-linejoin="round" aria-hidden="true">
                        <polyline points="15 18 9 12 15 6"></polyline>
                    </svg>
                    <?php esc_html_e( 'Brands', 'drywall-toolbox' ); ?>
                </a>
            </div>

            <h1 class="machined-title" style="color:var(--primary-600);margin-bottom:40px;">
                <?php echo esc_html( strtoupper( $selected_brand_name ) ); ?>
            </h1>

            <div class="shop-layout">

                <!-- Sidebar -->
                <aside class="shop-sidebar" aria-label="<?php esc_attr_e( 'Shop filters', 'drywall-toolbox' ); ?>">

                    <?php if ( is_active_sidebar( 'shop-sidebar' ) ) : ?>
                        <?php dynamic_sidebar( 'shop-sidebar' ); ?>
                    <?php else : ?>

                        <!-- Built-in filters when sidebar is empty -->
                        <div class="shop-filter-section">
                            <h4 class="filter-title"><?php esc_html_e( 'Categories', 'drywall-toolbox' ); ?></h4>
                            <?php
                            $product_cats = get_terms( array(
                                'taxonomy'   => 'product_cat',
                                'hide_empty' => true,
                            ) );
                            if ( ! is_wp_error( $product_cats ) && ! empty( $product_cats ) ) :
                                foreach ( $product_cats as $cat ) :
                            ?>
                                <label class="filter-check-label">
                                    <input type="checkbox" class="filter-check"
                                           name="cat" value="<?php echo esc_attr( $cat->slug ); ?>">
                                    <?php echo esc_html( $cat->name ); ?>
                                </label>
                            <?php
                                endforeach;
                            endif;
                            ?>
                        </div>

                        <div class="shop-filter-section">
                            <h4 class="filter-title"><?php esc_html_e( 'Price Range', 'drywall-toolbox' ); ?></h4>
                            <div class="price-range-wrap">
                                <input type="range" class="price-range-input" min="0" max="1000"
                                       value="1000" step="10" aria-label="<?php esc_attr_e( 'Max price', 'drywall-toolbox' ); ?>">
                                <div class="price-range-labels">
                                    <span>$0</span>
                                    <span class="price-range-max">$1000</span>
                                </div>
                            </div>
                        </div>

                        <div class="shop-filter-section">
                            <h4 class="filter-title"><?php esc_html_e( 'Brand', 'drywall-toolbox' ); ?></h4>
                            <?php foreach ( $brands as $slug => $name ) : ?>
                                <label class="filter-check-label">
                                    <input type="checkbox" class="filter-check brand-filter"
                                           name="brand_filter" value="<?php echo esc_attr( $slug ); ?>"
                                        <?php checked( $slug, $selected_brand ); ?>>
                                    <?php echo esc_html( $name ); ?>
                                </label>
                            <?php endforeach; ?>
                        </div>

                    <?php endif; ?>

                </aside><!-- .shop-sidebar -->

                <!-- Product grid -->
                <main class="shop-products">

                    <?php
                    $paged = get_query_var( 'paged' ) ? absint( get_query_var( 'paged' ) ) : 1;

                    $args = array(
                        'post_type'      => 'product',
                        'posts_per_page' => 24,
                        'paged'          => $paged,
                        'post_status'    => 'publish',
                    );

                    // Filter by brand taxonomy if available
                    if ( $selected_brand ) {
                        // Try product attribute pa_brand first, then product tag
                        $brand_term = get_term_by( 'slug', $selected_brand, 'pa_brand' );
                        if ( $brand_term && ! is_wp_error( $brand_term ) ) {
                            $args['tax_query'] = array(
                                array(
                                    'taxonomy' => 'pa_brand',
                                    'field'    => 'slug',
                                    'terms'    => $selected_brand,
                                ),
                            );
                        } else {
                            // Fallback: search by product tag
                            $args['tag'] = $selected_brand;
                        }
                    }

                    $products_query = new WP_Query( $args );

                    if ( $products_query->have_posts() ) :

                        woocommerce_product_loop_start();

                        while ( $products_query->have_posts() ) :
                            $products_query->the_post();
                            wc_get_template_part( 'content', 'product' );
                        endwhile;

                        woocommerce_product_loop_end();

                        // Pagination
                        $big   = 999999999;
                        $links = paginate_links( array(
                            'base'    => str_replace( $big, '%#%', esc_url( get_pagenum_link( $big ) ) ),
                            'format'  => '?paged=%#%',
                            'current' => max( 1, $paged ),
                            'total'   => $products_query->max_num_pages,
                        ) );
                        if ( $links ) {
                            echo '<nav class="wc-pagination" aria-label="' . esc_attr__( 'Products pagination', 'drywall-toolbox' ) . '">' . wp_kses_post( $links ) . '</nav>';
                        }

                        wp_reset_postdata();

                    else :
                        ?>
                        <div class="no-products-notice">
                            <p><?php esc_html_e( 'No products found for this brand.', 'drywall-toolbox' ); ?></p>
                            <a href="<?php echo esc_url( $shop_url ); ?>" class="alloy-button">
                                <?php esc_html_e( 'View All Brands', 'drywall-toolbox' ); ?>
                            </a>
                        </div>
                        <?php
                    endif;
                    ?>

                </main><!-- .shop-products -->

            </div><!-- .shop-layout -->

        <?php endif; ?>

    </div><!-- .page-container -->
</main><!-- #main -->

<?php get_footer(); ?>
