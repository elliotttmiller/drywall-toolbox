<?php
/**
 * The front page / home page template
 *
 * @package Drywall_Toolbox
 */
get_header();
?>
<div style="min-height:100vh;background:white;" class="page-wrapper">

    <!-- HERO -->
    <section class="section-enter home-hero-section" style="padding:clamp(2.5rem,5vw,4rem) clamp(1rem,5vw,2.5rem) clamp(1rem,3vw,1.5rem);min-height:100vh;display:flex;align-items:center;justify-content:center;">
        <div style="display:flex;flex-direction:column;justify-content:center;align-items:center;gap:clamp(1.25rem,4vw,2rem);max-width:1400px;margin:0 auto;text-align:center;">
            <h1 class="machined-title" style="margin-bottom:0;color:var(--color-primary-600);line-height:1.1;">
                TOP TRUSTED<br>ONE-STOP SHOP.
            </h1>
            <p style="max-width:700px;margin-bottom:0;font-size:clamp(0.95rem,2.5vw,1.1rem);opacity:0.7;color:black;line-height:1.6;">
                Everything you need to ensure a flawless finish every time. Get production-grade tools and parts at unbeatable prices with lightning-fast shipping.
            </p>
            <div style="display:flex;gap:16px;flex-wrap:wrap;justify-content:center;">
                <a href="<?php echo esc_url(home_url('/products')); ?>" class="alloy-button">Shop All Tools</a>
                <a href="<?php echo esc_url(home_url('/parts')); ?>" class="alloy-button" style="background:transparent;color:var(--color-primary-600);border:2px solid var(--color-primary-600);clip-path:none;border-radius:4px;">Parts &amp; Schematics</a>
            </div>
        </div>
    </section>

    <!-- TRENDING PRODUCTS -->
    <section style="padding:clamp(2rem,5vw,3rem) clamp(1rem,5vw,2.5rem);max-width:1400px;margin:0 auto;">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:clamp(1.25rem,3vw,1.75rem);">
            <h2 style="font-size:clamp(1.1rem,3vw,1.4rem);font-weight:800;color:var(--alloy-deep);margin:0;letter-spacing:-0.02em;">Trending Products</h2>
            <a href="<?php echo esc_url(home_url('/all-products')); ?>" style="font-size:0.75rem;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;color:var(--color-primary-600);text-decoration:none;">View All →</a>
        </div>
        <div id="trending-products" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:16px;">
            <div style="text-align:center;padding:40px;color:rgba(15,23,42,0.4);">Loading products...</div>
        </div>
    </section>

    <!-- TRUST BADGES -->
    <section style="padding:clamp(2rem,5vw,3rem) clamp(1rem,5vw,2.5rem);max-width:1400px;margin:0 auto;">
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:16px;">
            <div style="display:flex;align-items:center;justify-content:center;gap:16px;background:white;border:1px solid var(--machined-border);border-radius:4px;padding:20px 24px;">
                <div style="color:var(--color-primary-600);flex-shrink:0;">
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="1" y="3" width="15" height="13" rx="1"/><path d="M16 8h4l3 3v5h-7V8z"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>
                </div>
                <div>
                    <div style="font-weight:700;font-size:0.875rem;color:black;margin-bottom:2px;">Free Shipping</div>
                    <div style="font-size:0.75rem;color:rgba(15,23,42,0.5);">On qualifying orders</div>
                </div>
            </div>
            <div style="display:flex;align-items:center;justify-content:center;gap:16px;background:white;border:1px solid var(--machined-border);border-radius:4px;padding:20px 24px;">
                <div style="color:var(--color-primary-600);flex-shrink:0;">
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                </div>
                <div>
                    <div style="font-weight:700;font-size:0.875rem;color:black;margin-bottom:2px;">Warranty Covered</div>
                    <div style="font-size:0.75rem;color:rgba(15,23,42,0.5);">Full manufacturer coverage</div>
                </div>
            </div>
            <div style="display:flex;align-items:center;justify-content:center;gap:16px;background:white;border:1px solid var(--machined-border);border-radius:4px;padding:20px 24px;">
                <div style="color:var(--color-primary-600);flex-shrink:0;">
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 11.93a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.6 1h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.6A16 16 0 0 0 16 16.68l.96-.95a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
                </div>
                <div>
                    <div style="font-weight:700;font-size:0.875rem;color:black;margin-bottom:2px;">Expert Support</div>
                    <div style="font-size:0.75rem;color:rgba(15,23,42,0.5);">Real help from real people</div>
                </div>
            </div>
        </div>
    </section>

    <!-- BRAND LOGOS -->
    <section style="padding:clamp(2rem,5vw,3rem) clamp(1rem,5vw,2.5rem) clamp(3rem,6vw,4rem);max-width:1400px;margin:0 auto;text-align:center;">
        <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;margin-bottom:32px;">
            <p style="text-transform:uppercase;font-size:0.7rem;letter-spacing:0.15em;color:var(--color-primary-600);margin:0;padding-bottom:6px;padding-left:12px;padding-right:12px;border-bottom:2px solid var(--color-primary-600);font-weight:700;">Trusted Brands</p>
        </div>
        <div style="display:flex;flex-wrap:wrap;align-items:center;justify-content:center;gap:clamp(24px,5vw,56px);">
            <?php
            $brands = [
                ['name' => 'TapeTech',  'logo' => 'TapeTech/tapetech_logo.svg',                              'height' => 'clamp(24px,4vw,40px)',   'maxw' => '120px'],
                ['name' => 'Columbia',  'logo' => 'Columbia/columbia_taping_tools_logo.svg',                 'height' => 'clamp(60px,10vw,100px)', 'maxw' => '300px'],
                ['name' => 'SurPro',    'logo' => 'SurPro/surpro_logo.svg',                                  'height' => 'clamp(24px,4vw,40px)',   'maxw' => '120px'],
                ['name' => 'Asgard',    'logo' => 'Asgard/asgard_logo.svg',                                  'height' => 'clamp(32px,5vw,50px)',   'maxw' => '150px'],
                ['name' => 'Graco',     'logo' => 'Graco/graco_logo.svg',                                    'height' => 'clamp(32px,5vw,50px)',   'maxw' => '150px'],
            ];
            foreach ( $brands as $brand ) :
                $brand_param = $brand['name'] === 'Columbia' ? 'Columbia+Taping+Tools' : urlencode( $brand['name'] );
            ?>
            <a href="<?php echo esc_url( home_url( '/products?brand=' . $brand_param ) ); ?>"
               title="<?php echo esc_attr( $brand['name'] ); ?>"
               style="text-decoration:none;opacity:1;transition:opacity 0.2s;"
               onmouseover="this.style.opacity='0.8'"
               onmouseout="this.style.opacity='1'">
                <img src="<?php echo esc_url( DTB_THEME_URI . '/assets/brands/' . $brand['logo'] ); ?>"
                     alt="<?php echo esc_attr( $brand['name'] ); ?>"
                     style="height:<?php echo esc_attr( $brand['height'] ); ?>;max-width:<?php echo esc_attr( $brand['maxw'] ); ?>;object-fit:contain;">
            </a>
            <?php endforeach; ?>
        </div>
    </section>

</div>
<?php get_footer(); ?>
