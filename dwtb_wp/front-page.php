<?php
/**
 * Front page template
 *
 * @package drywall-toolbox
 */

get_header();

$shop_id  = function_exists( 'wc_get_page_id' ) ? wc_get_page_id( 'shop' ) : 0;
$shop_url = $shop_id ? get_permalink( $shop_id ) : home_url( '/shop/' );
?>

<main id="main" class="site-main" role="main">

    <!-- ── HERO ─────────────────────────────────────────────────────────────── -->
    <section class="section-enter home-hero-section">
        <div class="home-hero-grid">
            <div class="home-hero-text">
                <h1 class="machined-title">
                    <?php esc_html_e( "THE FINISHER'S", 'drywall-toolbox' ); ?><br>
                    <?php esc_html_e( 'HEADQUARTERS.', 'drywall-toolbox' ); ?>
                </h1>

                <p class="home-hero-body">
                    <?php esc_html_e( "Your one stop shop for everything you need to ensure a flawless finish everytime. Get production-grade tools, unbeatable prices, and lightning-fast shipping from a team that knows the job site.", 'drywall-toolbox' ); ?>
                </p>

                <a href="<?php echo esc_url( $shop_url ); ?>" class="alloy-button">
                    <?php esc_html_e( 'Shop Products', 'drywall-toolbox' ); ?>
                </a>
            </div>
        </div>
    </section>

    <!-- ── PARTS & SCHEMATICS ─────────────────────────────────────────────── -->
    <section class="home-parts-section">
        <div class="home-parts-inner">
            <h2 class="home-parts-title">
                <?php esc_html_e( 'PARTS & SCHEMATICS', 'drywall-toolbox' ); ?>
            </h2>

            <p class="home-parts-body">
                <?php esc_html_e( 'Find technical diagrams, replacement parts, and service documentation for professional drywall tools. Our schematics library covers all major brands.', 'drywall-toolbox' ); ?>
            </p>

            <a href="<?php echo dwtb_get_page_url( 'parts' ); ?>" class="alloy-button">
                <?php esc_html_e( 'Browse Parts', 'drywall-toolbox' ); ?>
            </a>
        </div>
    </section>

</main><!-- #main -->

<?php get_footer(); ?>
