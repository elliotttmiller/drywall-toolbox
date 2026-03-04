<?php
/**
 * Template Name: Parts
 *
 * @package drywall-toolbox
 */

get_header();
?>

<main id="main" class="site-main" role="main">
    <section class="section-enter parts-section">
        <div class="parts-inner">

            <h1 class="machined-title parts-hero-title">
                <?php esc_html_e( 'PARTS &', 'drywall-toolbox' ); ?><br>
                <?php esc_html_e( 'SCHEMATICS', 'drywall-toolbox' ); ?>
            </h1>

            <p class="parts-intro">
                <?php esc_html_e( 'Find replacement parts, technical diagrams, and service documentation for professional drywall taping and finishing tools from all major brands.', 'drywall-toolbox' ); ?>
            </p>

            <!-- ── SCHEMATIC VIEWER ────────────────────────────────────────── -->
            <div class="parts-schematic-viewer">
                <div class="schematic-placeholder">

                    <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24"
                         fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"
                         stroke-linejoin="round" aria-hidden="true" style="margin-bottom:16px;">
                        <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"></path>
                    </svg>

                    <p><?php esc_html_e( 'Schematic Viewer — Coming Soon', 'drywall-toolbox' ); ?></p>
                    <p class="schematic-sub">
                        <?php esc_html_e( 'Interactive parts diagrams will be available here. Contact us to request a specific schematic.', 'drywall-toolbox' ); ?>
                    </p>

                </div>
            </div><!-- .parts-schematic-viewer -->

            <!-- ── FILTERS ───────────────────────────────────────────────────── -->
            <div class="parts-filter-row" role="search" aria-label="<?php esc_attr_e( 'Filter parts', 'drywall-toolbox' ); ?>">

                <div class="parts-filter-item">
                    <label for="parts-brand" class="machined-label">
                        <?php esc_html_e( 'Brand', 'drywall-toolbox' ); ?>
                    </label>
                    <select id="parts-brand" class="machined-input" name="brand">
                        <option value=""><?php esc_html_e( 'All Brands', 'drywall-toolbox' ); ?></option>
                        <option value="tapetech"><?php esc_html_e( 'TapeTech', 'drywall-toolbox' ); ?></option>
                        <option value="columbia-taping-tools"><?php esc_html_e( 'Columbia Taping Tools', 'drywall-toolbox' ); ?></option>
                        <option value="asgard"><?php esc_html_e( 'Asgard', 'drywall-toolbox' ); ?></option>
                        <option value="surpro"><?php esc_html_e( 'SurPro', 'drywall-toolbox' ); ?></option>
                        <option value="spray-king"><?php esc_html_e( 'Spray King', 'drywall-toolbox' ); ?></option>
                        <option value="graco"><?php esc_html_e( 'Graco', 'drywall-toolbox' ); ?></option>
                    </select>
                </div>

                <div class="parts-filter-item">
                    <label for="parts-tool-type" class="machined-label">
                        <?php esc_html_e( 'Tool Type', 'drywall-toolbox' ); ?>
                    </label>
                    <select id="parts-tool-type" class="machined-input" name="tool_type">
                        <option value=""><?php esc_html_e( 'All Types', 'drywall-toolbox' ); ?></option>
                        <option value="automatic-taper"><?php esc_html_e( 'Automatic Taper', 'drywall-toolbox' ); ?></option>
                        <option value="flat-box"><?php esc_html_e( 'Flat Box', 'drywall-toolbox' ); ?></option>
                        <option value="corner-roller"><?php esc_html_e( 'Corner Roller', 'drywall-toolbox' ); ?></option>
                        <option value="pump"><?php esc_html_e( 'Pump', 'drywall-toolbox' ); ?></option>
                        <option value="sander"><?php esc_html_e( 'Sander', 'drywall-toolbox' ); ?></option>
                    </select>
                </div>

            </div><!-- .parts-filter-row -->

            <!-- ── CTA ───────────────────────────────────────────────────────── -->
            <div class="parts-cta">
                <h3><?php esc_html_e( "CAN'T FIND YOUR PART?", 'drywall-toolbox' ); ?></h3>
                <p>
                    <?php esc_html_e( 'Our parts specialists can locate any component for your drywall tools. Contact us with your tool model number.', 'drywall-toolbox' ); ?>
                </p>
                <a href="<?php echo dwtb_get_page_url( 'contact' ); ?>" class="alloy-button">
                    <?php esc_html_e( 'Request a Part', 'drywall-toolbox' ); ?>
                </a>
            </div><!-- .parts-cta -->

        </div><!-- .parts-inner -->
    </section>
</main><!-- #main -->

<?php get_footer(); ?>
