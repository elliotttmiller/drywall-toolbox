<?php
/**
 * The generic page template
 *
 * @package Drywall_Toolbox
 */
get_header();
?>
<div class="page-wrapper section-enter" style="min-height:100vh;background:#f8fafc;padding:clamp(2rem,5vw,4rem) clamp(1rem,5vw,2.5rem);">
    <div style="max-width:900px;margin:0 auto;">
        <?php while (have_posts()) : the_post(); ?>
        <article id="post-<?php the_ID(); ?>" <?php post_class(); ?>>
            <header style="margin-bottom:2rem;">
                <h1 style="font-size:clamp(1.75rem,4vw,2.5rem);font-weight:800;color:black;margin:0;letter-spacing:-0.02em;">
                    <?php the_title(); ?>
                </h1>
            </header>
            <div class="entry-content" style="font-size:1rem;color:rgba(15,23,42,0.8);line-height:1.7;">
                <?php the_content(); ?>
            </div>
        </article>
        <?php endwhile; ?>
    </div>
</div>
<?php get_footer(); ?>
