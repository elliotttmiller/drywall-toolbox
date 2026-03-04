<?php
/**
 * 404 template
 *
 * @package drywall-toolbox
 */

get_header();
?>

<main id="main" class="site-main" role="main">
    <section class="error-404-section">
        <div class="error-404-inner">

            <h1 class="machined-title error-404-code">
                <?php esc_html_e( '404', 'drywall-toolbox' ); ?>
            </h1>

            <p class="error-404-message">
                <?php esc_html_e( "Page not found. The tool you're looking for isn't in our shop.", 'drywall-toolbox' ); ?>
            </p>

            <a href="<?php echo esc_url( home_url( '/' ) ); ?>" class="alloy-button">
                <?php esc_html_e( 'Back to Home', 'drywall-toolbox' ); ?>
            </a>

        </div>
    </section>
</main><!-- #main -->

<?php get_footer(); ?>
