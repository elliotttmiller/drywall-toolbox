<?php
/**
 * The main template file
 *
 * This is the most generic template file in a WordPress theme
 * and one of the two required files for a theme (the other being style.css).
 *
 * @package Drywall_Toolbox
 */

get_header();
?>

<div class="site-main section-enter" id="main">
    <?php
    if ( have_posts() ) {
        while ( have_posts() ) {
            the_post();
            ?>
            <article id="post-<?php the_ID(); ?>" <?php post_class(); ?>>
                <header class="entry-header">
                    <?php
                    if ( is_singular() ) {
                        the_title( '<h1 class="entry-title">', '</h1>' );
                    } else {
                        the_title( '<h2 class="entry-title"><a href="' . esc_url( get_permalink() ) . '" rel="bookmark">', '</a></h2>' );
                    }
                    ?>
                </header><!-- .entry-header -->

                <div class="entry-content">
                    <?php
                    the_content(
                        sprintf(
                            wp_kses(
                                __( 'Continue reading<span class="screen-reader-text"> "%s"</span>', 'drywall-toolbox' ),
                                array(
                                    'span' => array(
                                        'class' => array(),
                                    ),
                                )
                            ),
                            wp_kses_post( get_the_title() )
                        )
                    );

                    wp_link_pages(
                        array(
                            'before' => '<div class="page-links">' . esc_html__( 'Pages:', 'drywall-toolbox' ),
                            'after'  => '</div>',
                        )
                    );
                    ?>
                </div><!-- .entry-content -->

                <footer class="entry-footer">
                    <?php
                    if ( is_singular() ) {
                        echo esc_html__( 'Posted on ', 'drywall-toolbox' ) . esc_html( get_the_date() );
                    }
                    ?>
                </footer><!-- .entry-footer -->
            </article><!-- #post-<?php the_ID(); ?> -->
            <?php
        }

        the_posts_navigation();
    } else {
        echo '<p>' . esc_html__( 'No posts found.', 'drywall-toolbox' ) . '</p>';
    }
    ?>
</div><!-- #main -->

<?php
get_footer();
