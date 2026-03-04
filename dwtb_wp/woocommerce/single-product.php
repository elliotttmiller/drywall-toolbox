<?php
/**
 * The Template for displaying all single products.
 *
 * @package Drywall_Toolbox
 */

defined( 'ABSPATH' ) || exit;

get_header();
?>
<main id="main" class="site-main single-product-page" role="main">
  <div class="page-container" style="max-width:1200px;margin:0 auto;padding:clamp(100px,12vw,140px) clamp(1rem,5vw,2.5rem) 60px;">

    <?php
    // Breadcrumb navigation.
    $shop_id  = function_exists( 'wc_get_page_id' ) ? wc_get_page_id( 'shop' ) : 0;
    $shop_url = $shop_id ? esc_url( get_permalink( $shop_id ) ) : esc_url( home_url( '/shop' ) );
    ?>
    <nav class="breadcrumbs" aria-label="<?php esc_attr_e( 'Breadcrumbs', 'drywall-toolbox' ); ?>" style="font-size:0.75rem;margin-bottom:32px;opacity:0.6;">
      <a href="<?php echo esc_url( home_url( '/' ) ); ?>" style="color:inherit;text-decoration:none;">
        <?php esc_html_e( 'Home', 'drywall-toolbox' ); ?>
      </a>
      &rsaquo;
      <a href="<?php echo $shop_url; // Already escaped above. ?>" style="color:inherit;text-decoration:none;">
        <?php esc_html_e( 'Shop', 'drywall-toolbox' ); ?>
      </a>
      &rsaquo;
      <span><?php echo esc_html( get_the_title() ); ?></span>
    </nav>

    <?php while ( have_posts() ) : the_post(); ?>
    <?php global $product; ?>

    <div class="product-detail-grid" style="display:grid;grid-template-columns:1fr 1fr;gap:60px;margin-bottom:80px;">

      <!-- Product Gallery -->
      <div class="product-gallery">
        <div style="background:white;border:1px solid var(--machined-border);padding:24px;">
          <?php do_action( 'woocommerce_before_single_product_summary' ); ?>
        </div>
      </div>

      <!-- Product Summary -->
      <div class="product-summary">
        <?php
        $brand = get_post_meta( get_the_ID(), 'brand', true );
        $sku   = $product->get_sku();
        if ( $brand || $sku ) :
        ?>
          <div class="part-meta" style="font-size:0.7rem;text-transform:uppercase;letter-spacing:0.1em;opacity:0.5;margin-bottom:12px;">
            <?php if ( $brand ) echo esc_html( $brand ) . ' &bull; '; ?>
            <?php if ( $sku ) echo 'SKU: ' . esc_html( $sku ); ?>
          </div>
        <?php endif; ?>

        <?php do_action( 'woocommerce_single_product_summary' ); ?>
      </div>
    </div>

    <!-- Description / Tabs -->
    <?php do_action( 'woocommerce_after_single_product_summary' ); ?>

    <?php endwhile; ?>

    <!-- Related Products -->
    <?php
    $related_ids = wc_get_related_products( get_the_ID(), 3 );
    if ( $related_ids ) :
    ?>
    <section class="related-products" style="margin-top:80px;">
      <h2 style="font-weight:800;font-size:1.25rem;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:32px;color:var(--alloy-deep);">
        <?php esc_html_e( 'Related Products', 'drywall-toolbox' ); ?>
      </h2>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:24px;">
        <?php foreach ( $related_ids as $related_id ) :
          $related = wc_get_product( $related_id );
          if ( ! $related ) { continue; }
        ?>
        <div class="tool-card">
          <div class="tool-image" style="margin-bottom:16px;">
            <?php echo $related->get_image( 'medium', array( 'loading' => 'lazy' ) ); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- WC method returns safe HTML. ?>
          </div>
          <div style="font-size:0.7rem;text-transform:uppercase;opacity:0.5;margin-bottom:4px;">
            <?php echo esc_html( $related->get_attribute( 'brand' ) ?: '' ); ?>
          </div>
          <h3 style="font-weight:700;font-size:0.875rem;margin:0 0 8px;line-height:1.3;">
            <?php echo esc_html( $related->get_name() ); ?>
          </h3>
          <div class="tool-price" style="font-family:var(--font-mono);font-weight:700;color:var(--alloy-deep);margin-bottom:16px;">
            <?php echo wp_kses_post( $related->get_price_html() ); ?>
          </div>
          <a href="<?php echo esc_url( $related->get_permalink() ); ?>" class="alloy-button alloy-button-sm">
            <?php esc_html_e( 'View Product', 'drywall-toolbox' ); ?>
          </a>
        </div>
        <?php endforeach; ?>
      </div>
    </section>
    <?php endif; ?>

  </div>
</main>
<?php get_footer(); ?>
