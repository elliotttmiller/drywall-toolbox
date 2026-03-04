<?php
/**
 * Default page template
 *
 * @package drywall-toolbox
 */

get_header();
?>

<main id="main" class="site-main" role="main">
    <div class="page-container">

        <?php while ( have_posts() ) : the_post(); ?>

            <article id="post-<?php the_ID(); ?>" <?php post_class(); ?>>

                <header class="entry-header">
                    <h1 class="entry-title"><?php the_title(); ?></h1>
                </header><!-- .entry-header -->

                <?php if ( has_post_thumbnail() ) : ?>
                    <div class="post-thumbnail">
                        <?php the_post_thumbnail( 'large' ); ?>
                    </div>
                <?php endif; ?>

                <div class="entry-content">
                    <?php
                    the_content();

                    wp_link_pages( array(
                        'before' => '<div class="page-links">' . esc_html__( 'Pages:', 'drywall-toolbox' ),
                        'after'  => '</div>',
                    ) );
                    ?>
                </div><!-- .entry-content -->

                <?php if ( get_edit_post_link() ) : ?>
                    <footer class="entry-footer">
                        <?php edit_post_link(
                            sprintf(
                                wp_kses(
                                    /* translators: %s: Name of current post */
                                    __( 'Edit <span class="screen-reader-text">%s</span>', 'drywall-toolbox' ),
                                    array( 'span' => array( 'class' => array() ) )
                                ),
                                wp_kses_post( get_the_title() )
                            ),
                            '<span class="edit-link">',
                            '</span>'
                        ); ?>
                    </footer>
                <?php endif; ?>

            </article><!-- #post-<?php the_ID(); ?> -->

        <?php endwhile; ?>

    </div><!-- .page-container -->
</main><!-- #main -->

<?php get_footer(); ?>
