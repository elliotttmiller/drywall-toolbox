<?php
/**
 * Template Name: About
 *
 * @package drywall-toolbox
 */

get_header();
?>

<main id="main" class="site-main" role="main">

    <!-- ── HERO ─────────────────────────────────────────────────────────────── -->
    <section class="about-hero">
        <!-- Dot texture overlay -->
        <div class="about-hero-dots" aria-hidden="true"></div>

        <div class="about-hero-inner">
            <a href="<?php echo esc_url( home_url( '/' ) ); ?>" class="about-back-btn">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24"
                     fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"
                     stroke-linejoin="round" aria-hidden="true">
                    <polyline points="15 18 9 12 15 6"></polyline>
                </svg>
                <?php esc_html_e( 'Back', 'drywall-toolbox' ); ?>
            </a>

            <h1 class="machined-title about-hero-title">
                <?php esc_html_e( 'BUILT FOR', 'drywall-toolbox' ); ?><br>
                <?php esc_html_e( 'FINISHERS.', 'drywall-toolbox' ); ?>
            </h1>

            <p class="about-hero-subtitle">
                <?php esc_html_e( "THE PRO'S CHOICE FOR DRYWALL TOOLS", 'drywall-toolbox' ); ?>
            </p>
        </div>
    </section>

    <!-- ── STATS ─────────────────────────────────────────────────────────────── -->
    <section class="about-stats">
        <div class="stats-grid">

            <div class="stat-card">
                <span class="stat-number">50+</span>
                <span class="stat-label"><?php esc_html_e( 'Brand Partners', 'drywall-toolbox' ); ?></span>
            </div>

            <div class="stat-card">
                <span class="stat-number">2000+</span>
                <span class="stat-label"><?php esc_html_e( 'Products', 'drywall-toolbox' ); ?></span>
            </div>

            <div class="stat-card">
                <span class="stat-number">24/7</span>
                <span class="stat-label"><?php esc_html_e( 'Support', 'drywall-toolbox' ); ?></span>
            </div>

            <div class="stat-card">
                <span class="stat-number">100%</span>
                <span class="stat-label"><?php esc_html_e( 'Pro-Grade', 'drywall-toolbox' ); ?></span>
            </div>

        </div>
    </section>

    <!-- ── MISSION ───────────────────────────────────────────────────────────── -->
    <section class="about-mission">
        <div class="about-mission-inner">

            <div class="mission-text">
                <h2><?php esc_html_e( 'OUR MISSION', 'drywall-toolbox' ); ?></h2>
                <p>
                    <?php esc_html_e( "We're not just a tool store. We're finishers. Built by professionals, for professionals — every product we carry has been vetted for real job-site performance.", 'drywall-toolbox' ); ?>
                </p>
            </div>

            <div class="features-grid">

                <!-- Quality First -->
                <div class="feature-card">
                    <div class="feature-icon" aria-hidden="true">
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"
                             fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"
                             stroke-linejoin="round">
                            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
                        </svg>
                    </div>
                    <h3 class="feature-title"><?php esc_html_e( 'Quality First', 'drywall-toolbox' ); ?></h3>
                    <p class="feature-desc"><?php esc_html_e( 'Every tool is vetted for real job-site performance before hitting our shelves.', 'drywall-toolbox' ); ?></p>
                </div>

                <!-- Expert Team -->
                <div class="feature-card">
                    <div class="feature-icon" aria-hidden="true">
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"
                             fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"
                             stroke-linejoin="round">
                            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                            <circle cx="9" cy="7" r="4"></circle>
                            <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                            <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                        </svg>
                    </div>
                    <h3 class="feature-title"><?php esc_html_e( 'Expert Team', 'drywall-toolbox' ); ?></h3>
                    <p class="feature-desc"><?php esc_html_e( 'Our staff are working finishers who understand the demands of the trade.', 'drywall-toolbox' ); ?></p>
                </div>

                <!-- Fast Shipping -->
                <div class="feature-card">
                    <div class="feature-icon" aria-hidden="true">
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"
                             fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"
                             stroke-linejoin="round">
                            <rect x="1" y="3" width="15" height="13"></rect>
                            <polygon points="16 8 20 8 23 11 23 16 16 16 16 8"></polygon>
                            <circle cx="5.5" cy="18.5" r="2.5"></circle>
                            <circle cx="18.5" cy="18.5" r="2.5"></circle>
                        </svg>
                    </div>
                    <h3 class="feature-title"><?php esc_html_e( 'Fast Shipping', 'drywall-toolbox' ); ?></h3>
                    <p class="feature-desc"><?php esc_html_e( 'Lightning-fast fulfillment so your job never waits on gear.', 'drywall-toolbox' ); ?></p>
                </div>

                <!-- Warranty Coverage -->
                <div class="feature-card">
                    <div class="feature-icon" aria-hidden="true">
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"
                             fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"
                             stroke-linejoin="round">
                            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
                        </svg>
                    </div>
                    <h3 class="feature-title"><?php esc_html_e( 'Warranty Coverage', 'drywall-toolbox' ); ?></h3>
                    <p class="feature-desc"><?php esc_html_e( "Manufacturer warranties honored — we stand behind every product we sell.", 'drywall-toolbox' ); ?></p>
                </div>

                <!-- Customer Focused -->
                <div class="feature-card">
                    <div class="feature-icon" aria-hidden="true">
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"
                             fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"
                             stroke-linejoin="round">
                            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
                        </svg>
                    </div>
                    <h3 class="feature-title"><?php esc_html_e( 'Customer Focused', 'drywall-toolbox' ); ?></h3>
                    <p class="feature-desc"><?php esc_html_e( 'Real support from people who pick up the phone and know the product.', 'drywall-toolbox' ); ?></p>
                </div>

                <!-- Industry Leaders -->
                <div class="feature-card">
                    <div class="feature-icon" aria-hidden="true">
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"
                             fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"
                             stroke-linejoin="round">
                            <polyline points="6 9 12 15 18 9"></polyline>
                            <path d="M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z"></path>
                            <line x1="12" y1="3" x2="12" y2="9"></line>
                        </svg>
                    </div>
                    <h3 class="feature-title"><?php esc_html_e( 'Industry Leaders', 'drywall-toolbox' ); ?></h3>
                    <p class="feature-desc"><?php esc_html_e( 'Trusted by contractors and finishers across North America.', 'drywall-toolbox' ); ?></p>
                </div>

            </div><!-- .features-grid -->

        </div><!-- .about-mission-inner -->
    </section>

    <!-- ── BRAND PARTNERS ─────────────────────────────────────────────────── -->
    <section class="about-brands">
        <h3 class="brands-strip-title">
            <?php esc_html_e( 'OUR BRAND PARTNERS', 'drywall-toolbox' ); ?>
        </h3>

        <div class="brands-strip" aria-label="<?php esc_attr_e( 'Brand partners', 'drywall-toolbox' ); ?>">
            <?php
            $brand_names = array(
                'TapeTech', 'Columbia', 'DeWalt', 'Hyde',
                'Warner', 'Marshalltown', 'Goldblatt', 'Wal-Board',
            );
            foreach ( $brand_names as $brand_name ) :
            ?>
                <span class="brand-item"><?php echo esc_html( $brand_name ); ?></span>
            <?php endforeach; ?>
        </div>
    </section>

</main><!-- #main -->

<?php get_footer(); ?>
