<?php
/**
 * Sidebar template — shop sidebar
 *
 * @package drywall-toolbox
 */

if ( ! is_active_sidebar( 'shop-sidebar' ) ) {
    return;
}
?>

<aside class="widget-area shop-sidebar-widget" role="complementary"
       aria-label="<?php esc_attr_e( 'Shop Sidebar', 'drywall-toolbox' ); ?>">
    <?php dynamic_sidebar( 'shop-sidebar' ); ?>
</aside><!-- .shop-sidebar-widget -->
