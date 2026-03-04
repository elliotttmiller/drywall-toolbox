<?php
/**
 * The Template for displaying product archives.
 *
 * @package Drywall_Toolbox
 */

defined( 'ABSPATH' ) || exit;

get_header();
?>
<main id="main" class="site-main woocommerce-archive" role="main">
  <div class="page-container" style="max-width:1400px;margin:0 auto;padding:clamp(100px,12vw,140px) clamp(1rem,5vw,2.5rem) 60px;">
    <div class="shop-layout" style="display:flex;gap:40px;align-items:flex-start;">

      <!-- Sidebar Filters -->
      <aside class="shop-sidebar" style="width:260px;flex-shrink:0;position:sticky;top:calc(clamp(80px,12vw,140px) + 20px);">
        <div style="background:white;border:1px solid var(--machined-border);padding:24px;">
          <h3 style="font-weight:800;font-size:0.7rem;text-transform:uppercase;letter-spacing:0.1em;color:var(--alloy-deep);margin:0 0 20px;">
            <?php esc_html_e( 'Filter Products', 'drywall-toolbox' ); ?>
          </h3>

          <!-- Category Filter -->
          <?php
          $product_categories = get_terms(
            array(
              'taxonomy'   => 'product_cat',
              'hide_empty' => true,
              'parent'     => 0,
            )
          );
          if ( $product_categories && ! is_wp_error( $product_categories ) ) :
          ?>
          <div class="filter-section" style="margin-bottom:24px;">
            <h4 style="font-size:0.65rem;text-transform:uppercase;font-weight:800;letter-spacing:0.05em;margin:0 0 12px;color:#0f172a;">
              <?php esc_html_e( 'Categories', 'drywall-toolbox' ); ?>
            </h4>
            <?php foreach ( $product_categories as $cat ) : ?>
              <label style="display:flex;align-items:center;gap:8px;margin-bottom:8px;font-size:0.8rem;cursor:pointer;">
                <input type="checkbox" name="product_cat[]" value="<?php echo esc_attr( $cat->slug ); ?>" style="accent-color:var(--alloy-deep);">
                <?php echo esc_html( $cat->name ); ?>
                <span style="margin-left:auto;opacity:0.5;font-size:0.7rem;">(<?php echo esc_html( $cat->count ); ?>)</span>
              </label>
            <?php endforeach; ?>
          </div>
          <?php endif; ?>

          <!-- Price Range -->
          <div class="filter-section" style="margin-bottom:24px;">
            <h4 style="font-size:0.65rem;text-transform:uppercase;font-weight:800;letter-spacing:0.05em;margin:0 0 12px;color:#0f172a;">
              <?php esc_html_e( 'Price Range', 'drywall-toolbox' ); ?>
            </h4>
            <input type="range" id="price-range" min="0" max="3000" value="3000" style="width:100%;accent-color:var(--alloy-deep);">
            <div style="display:flex;justify-content:space-between;font-size:0.7rem;opacity:0.6;margin-top:8px;">
              <span>$0</span>
              <span id="price-display">$3,000</span>
            </div>
          </div>

          <!-- Brand Filter -->
          <div class="filter-section">
            <h4 style="font-size:0.65rem;text-transform:uppercase;font-weight:800;letter-spacing:0.05em;margin:0 0 12px;color:#0f172a;">
              <?php esc_html_e( 'Brand', 'drywall-toolbox' ); ?>
            </h4>
            <?php
            $brands = array( 'TapeTech', 'Columbia Taping Tools', 'Asgard', 'SurPro', 'Spray King', 'Graco' );
            foreach ( $brands as $brand ) :
            ?>
              <label style="display:flex;align-items:center;gap:8px;margin-bottom:8px;font-size:0.8rem;cursor:pointer;">
                <input type="checkbox" name="pa_brand[]" value="<?php echo esc_attr( sanitize_title( $brand ) ); ?>" style="accent-color:var(--alloy-deep);">
                <?php echo esc_html( $brand ); ?>
              </label>
            <?php endforeach; ?>
          </div>
        </div>
      </aside>

      <!-- Products -->
      <div class="shop-products-main" style="flex:1;min-width:0;">
        <?php if ( woocommerce_product_loop() ) : ?>
          <?php do_action( 'woocommerce_before_shop_loop' ); ?>
          <?php woocommerce_product_loop_start(); ?>
          <?php while ( have_posts() ) : the_post(); ?>
            <?php wc_get_template_part( 'content', 'product' ); ?>
          <?php endwhile; ?>
          <?php woocommerce_product_loop_end(); ?>
          <?php do_action( 'woocommerce_after_shop_loop' ); ?>
        <?php else : ?>
          <?php do_action( 'woocommerce_no_products_found' ); ?>
        <?php endif; ?>
      </div>

    </div>
  </div>
</main>
<?php get_footer(); ?>
