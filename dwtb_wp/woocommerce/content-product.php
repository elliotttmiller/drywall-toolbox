<?php
/**
 * The template for displaying product content within loops.
 *
 * @package Drywall_Toolbox
 */

defined( 'ABSPATH' ) || exit;

global $product;

if ( ! $product || ! $product->is_visible() ) {
	return;
}
?>
<li <?php post_class( 'tool-card' ); ?> id="product-<?php the_ID(); ?>">

  <a href="<?php echo esc_url( $product->get_permalink() ); ?>" class="woocommerce-loop-product__link" style="text-decoration:none;color:inherit;display:block;">

    <div class="tool-image" style="height:200px;display:flex;align-items:center;justify-content:center;margin-bottom:16px;overflow:hidden;">
      <?php if ( has_post_thumbnail() ) : ?>
        <?php echo get_the_post_thumbnail( get_the_ID(), 'medium', array( 'loading' => 'lazy', 'style' => 'max-height:200px;width:100%;object-fit:contain;' ) ); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- core function returns safe HTML. ?>
      <?php else : ?>
        <div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;background:var(--alloy-base);font-size:0.75rem;opacity:0.4;text-transform:uppercase;">
          <?php echo esc_html( $product->get_name() ); ?>
        </div>
      <?php endif; ?>
    </div>

    <?php
    $brand = $product->get_attribute( 'pa_brand' ) ?: get_post_meta( get_the_ID(), 'brand', true );
    $sku   = $product->get_sku();
    ?>
    <?php if ( $brand || $sku ) : ?>
    <div class="part-meta" style="font-size:0.65rem;text-transform:uppercase;letter-spacing:0.1em;opacity:0.5;margin-bottom:6px;font-family:var(--font-mono);">
      <?php if ( $brand ) echo esc_html( $brand ) . ' &bull; '; ?>
      <?php if ( $sku ) echo 'SKU: ' . esc_html( $sku ); ?>
    </div>
    <?php endif; ?>

    <h2 class="woocommerce-loop-product__title" style="font-weight:700;font-size:0.875rem;color:#0f172a;margin:0 0 8px;line-height:1.3;">
      <?php echo esc_html( $product->get_name() ); ?>
    </h2>

    <div class="tool-price" style="font-family:var(--font-mono);font-weight:700;font-size:1rem;color:var(--alloy-deep);margin-bottom:16px;">
      <?php echo wp_kses_post( $product->get_price_html() ); ?>
    </div>

  </a>

  <button
    class="alloy-button alloy-button-sm dwtb-add-to-cart"
    data-product-id="<?php echo esc_attr( $product->get_id() ); ?>"
    data-quantity="1"
    style="width:100%;justify-content:center;"
    aria-label="<?php echo esc_attr( sprintf( /* translators: %s: product name */ __( 'Add %s to cart', 'drywall-toolbox' ), $product->get_name() ) ); ?>"
  >
    <?php esc_html_e( 'Add to Cart', 'drywall-toolbox' ); ?>
  </button>

</li>
