<?php
/* Template Name: About */
get_header();
?>
<div style="min-height:100vh;background:#f8fafc;" class="page-wrapper section-enter">

    <!-- HERO -->
    <section style="background:linear-gradient(135deg,#0f172a 0%,#1e3a8a 50%,#1d4ed8 100%);padding:80px 24px 100px;position:relative;overflow:hidden;">
        <div style="position:absolute;inset:0;background-image:radial-gradient(circle at 2px 2px,rgba(255,255,255,0.06) 1px,transparent 0);background-size:40px 40px;pointer-events:none;"></div>
        <div style="position:absolute;top:-120px;right:-120px;width:500px;height:500px;background:radial-gradient(circle,rgba(96,165,250,0.15) 0%,transparent 70%);pointer-events:none;"></div>
        <div style="position:absolute;bottom:-80px;left:-80px;width:400px;height:400px;background:radial-gradient(circle,rgba(37,99,235,0.2) 0%,transparent 70%);pointer-events:none;"></div>
        <div style="max-width:760px;margin:0 auto;text-align:center;position:relative;">
            <h1 style="font-size:clamp(2.5rem,8vw,4.5rem);font-weight:800;line-height:1.05;letter-spacing:-0.03em;color:#ffffff;margin-bottom:24px;">
                Built for the<br><span style="color:#60a5fa;">Pro on the Wall</span>
            </h1>
            <p style="font-size:clamp(1rem,2.5vw,1.2rem);color:rgba(255,255,255,0.7);line-height:1.7;max-width:560px;margin:0 auto 40px;">
                Drywall Toolbox is the go-to destination for professional contractors who demand the best tools, the best parts, and the best service — every single order.
            </p>
            <div style="display:flex;gap:16px;justify-content:center;flex-wrap:wrap;">
                <a href="<?php echo esc_url(home_url('/products')); ?>"
                   style="background:#ffffff;color:#1d4ed8;border:none;border-radius:10px;padding:14px 32px;font-size:0.95rem;font-weight:700;cursor:pointer;text-decoration:none;display:inline-block;transition:all 0.2s ease;letter-spacing:0.02em;"
                   onmouseover="this.style.transform='translateY(-2px)';this.style.boxShadow='0 12px 32px rgba(0,0,0,0.2)'"
                   onmouseout="this.style.transform='none';this.style.boxShadow='none'">
                    Shop Tools
                </a>
                <a href="<?php echo esc_url(home_url('/contact')); ?>"
                   style="background:rgba(255,255,255,0.1);color:#ffffff;border:1.5px solid rgba(255,255,255,0.3);border-radius:10px;padding:14px 32px;font-size:0.95rem;font-weight:600;cursor:pointer;text-decoration:none;display:inline-block;transition:all 0.2s ease;backdrop-filter:blur(10px);"
                   onmouseover="this.style.background='rgba(255,255,255,0.18)'"
                   onmouseout="this.style.background='rgba(255,255,255,0.1)'">
                    Contact Us
                </a>
            </div>
        </div>
    </section>

    <!-- STATS ROW -->
    <section style="background:#ffffff;border-bottom:1px solid rgba(15,23,42,0.06);">
        <div style="max-width:1100px;margin:0 auto;padding:0 24px;">
            <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:0;" class="about-stats-grid">
                <?php
                $stats = [
                    ['number' => '50+',    'label' => 'Brand Partners', 'sub' => 'industry-leading manufacturers'],
                    ['number' => '2,000+', 'label' => 'Products',       'sub' => 'tools, parts & accessories'],
                    ['number' => '24/7',   'label' => 'Support',        'sub' => 'always here when you need us'],
                    ['number' => '100%',   'label' => 'Pro-Grade',      'sub' => 'no consumer-grade products'],
                ];
                foreach ( $stats as $i => $stat ) :
                ?>
                <div style="padding:40px 24px;text-align:center;<?php echo $i < 3 ? 'border-right:1px solid rgba(15,23,42,0.06);' : ''; ?>" class="about-stat-item">
                    <div style="font-size:clamp(2rem,5vw,3rem);font-weight:800;color:var(--color-primary-600);letter-spacing:-0.03em;line-height:1;margin-bottom:8px;">
                        <?php echo esc_html($stat['number']); ?>
                    </div>
                    <div style="font-size:0.9rem;font-weight:700;color:black;margin-bottom:4px;"><?php echo esc_html($stat['label']); ?></div>
                    <div style="font-size:0.78rem;color:rgba(15,23,42,0.45);"><?php echo esc_html($stat['sub']); ?></div>
                </div>
                <?php endforeach; ?>
            </div>
        </div>
    </section>

    <!-- FEATURES GRID -->
    <section style="padding:clamp(3rem,6vw,5rem) clamp(1.5rem,5vw,3rem);max-width:1100px;margin:0 auto;">
        <div style="text-align:center;margin-bottom:clamp(2rem,4vw,3rem);">
            <h2 style="font-size:clamp(1.75rem,4vw,2.5rem);font-weight:800;color:black;margin:0 0 12px;letter-spacing:-0.02em;">Why Choose Drywall Toolbox?</h2>
            <p style="color:rgba(15,23,42,0.55);font-size:1rem;max-width:520px;margin:0 auto;line-height:1.6;">We&apos;re not just a tool store — we&apos;re your partner in the trade.</p>
        </div>
        <?php
        $features = [
            [
                'icon' => '<path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>',
                'title' => 'Quality First',
                'desc'  => 'We curate only tools that meet our rigorous standards — sourced from the most trusted manufacturers in the industry.'
            ],
            [
                'icon' => '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
                'title' => 'Expert Team',
                'desc'  => 'Our staff are industry veterans who have worked with drywall tools firsthand — we speak your language.'
            ],
            [
                'icon' => '<rect x="1" y="3" width="15" height="13" rx="1"/><path d="M16 8h4l3 3v5h-7V8z"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/>',
                'title' => 'Fast Shipping',
                'desc'  => 'Most orders ship within 24 hours. Free shipping on qualifying orders — because your time is money.'
            ],
            [
                'icon' => '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>',
                'title' => 'Warranty Coverage',
                'desc'  => 'Every product backed by full manufacturer warranty plus our own satisfaction guarantee — zero risk.'
            ],
            [
                'icon' => '<path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>',
                'title' => 'Customer Focused',
                'desc'  => 'Real support from real people — available whenever you need us. No bots, no runaround.'
            ],
            [
                'icon' => '<polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/>',
                'title' => 'Industry Leaders',
                'desc'  => 'We partner with the most innovative drywall brands — bringing you the latest tools before anyone else.'
            ],
        ];
        ?>
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:24px;">
            <?php foreach ( $features as $feat ) : ?>
            <div style="background:white;border:1px solid rgba(15,23,42,0.08);border-radius:12px;padding:28px 24px;transition:box-shadow 0.2s,transform 0.2s;"
                 onmouseover="this.style.boxShadow='0 8px 24px rgba(37,99,235,0.1)';this.style.transform='translateY(-2px)'"
                 onmouseout="this.style.boxShadow='none';this.style.transform='none'">
                <div style="width:52px;height:52px;background:linear-gradient(135deg,#eff6ff,#dbeafe);border-radius:12px;display:flex;align-items:center;justify-content:center;color:var(--color-primary-600);margin-bottom:16px;">
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                        <?php echo $feat['icon']; ?>
                    </svg>
                </div>
                <h3 style="font-size:1rem;font-weight:700;color:black;margin:0 0 8px;"><?php echo esc_html($feat['title']); ?></h3>
                <p style="font-size:0.875rem;color:rgba(15,23,42,0.6);line-height:1.6;margin:0;"><?php echo esc_html($feat['desc']); ?></p>
            </div>
            <?php endforeach; ?>
        </div>
    </section>

    <!-- BRANDS LIST -->
    <section style="background:white;border-top:1px solid rgba(15,23,42,0.06);padding:clamp(3rem,6vw,5rem) clamp(1.5rem,5vw,3rem);">
        <div style="max-width:1100px;margin:0 auto;text-align:center;">
            <h2 style="font-size:clamp(1.5rem,3vw,2rem);font-weight:800;color:black;margin:0 0 12px;letter-spacing:-0.02em;">Brands We Carry</h2>
            <p style="font-size:0.9rem;color:rgba(15,23,42,0.5);margin:0 0 36px;line-height:1.6;">Trusted by professionals at every level of the trade.</p>
            <div style="display:flex;flex-wrap:wrap;gap:12px;justify-content:center;">
                <?php
                $brands = ['TapeTech','Columbia','DeWalt','Hyde','Warner','Marshalltown','Goldblatt','Wal-Board'];
                foreach ( $brands as $b ) :
                ?>
                <div style="background:#f8fafc;border:1px solid rgba(15,23,42,0.08);border-radius:8px;padding:10px 20px;font-size:0.875rem;font-weight:600;color:rgba(15,23,42,0.7);">
                    <?php echo esc_html($b); ?>
                </div>
                <?php endforeach; ?>
            </div>
        </div>
    </section>

</div>
<?php get_footer(); ?>
