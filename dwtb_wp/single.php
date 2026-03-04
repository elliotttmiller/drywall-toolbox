<?php
/**
 * Single post template
 *
 * @package drywall-toolbox
 */

get_header();
?>

<main id="main" class="site-main" role="main">
    <div class="page-container page-container--narrow">

        <?php while ( have_posts() ) : the_post(); ?>

            <article id="post-<?php the_ID(); ?>" <?php post_class(); ?>>

                <header class="entry-header">
                    <h1 class="entry-title"><?php the_title(); ?></h1>

                    <div class="entry-meta">
                        <span class="posted-on">
                            <?php
                            printf(
                                /* translators: %s: post date */
                                esc_html__( 'Posted on %s', 'drywall-toolbox' ),
                                '<time datetime="' . esc_attr( get_the_date( 'c' ) ) . '">' . esc_html( get_the_date() ) . '</time>'
                            );
                            ?>
                        </span>
                        <span class="byline">
                            <?php
                            printf(
                                /* translators: %s: author display name */
                                esc_html__( 'by %s', 'drywall-toolbox' ),
                                '<span class="author vcard">' . esc_html( get_the_author() ) . '</span>'
                            );
                            ?>
                        </span>
                    </div><!-- .entry-meta -->
                </header><!-- .entry-header -->

                <?php if ( has_post_thumbnail() ) : ?>
                    <div class="post-thumbnail">
                        <?php the_post_thumbnail( 'large' ); ?>
                    </div>
                <?php endif; ?>

                <div class="entry-content">
                    <?php
                    the_content(
                        sprintf(
                            wp_kses(
                                /* translators: %s: Name of current post */
                                __( 'Continue reading<span class="screen-reader-text"> "%s"</span>', 'drywall-toolbox' ),
                                array( 'span' => array( 'class' => array() ) )
                            ),
                            wp_kses_post( get_the_title() )
                        )
                    );

                    wp_link_pages( array(
                        'before' => '<div class="page-links">' . esc_html__( 'Pages:', 'drywall-toolbox' ),
                        'after'  => '</div>',
                    ) );
                    ?>
                </div><!-- .entry-content -->

                <footer class="entry-footer">
                    <?php
                    $tags_list = get_the_tag_list( '', esc_html_x( ', ', 'list item separator', 'drywall-toolbox' ) );
                    if ( $tags_list ) {
                        printf(
                            '<span class="tags-links">' . esc_html__( 'Tags: %1$s', 'drywall-toolbox' ) . '</span>',
                            wp_kses_post( $tags_list )
                        );
                    }

                    $categories_list = get_the_category_list( esc_html_x( ', ', 'list item separator', 'drywall-toolbox' ) );
                    if ( $categories_list ) {
                        printf(
                            '<span class="cat-links">' . esc_html__( 'Categories: %1$s', 'drywall-toolbox' ) . '</span>',
                            wp_kses_post( $categories_list )
                        );
                    }
                    ?>
                </footer><!-- .entry-footer -->

            </article><!-- #post-<?php the_ID(); ?> -->

            <!-- Post navigation -->
            <nav class="post-navigation" aria-label="<?php esc_attr_e( 'Post navigation', 'drywall-toolbox' ); ?>">
                <div class="nav-links">
                    <div class="nav-previous">
                        <?php
                        $prev_post = get_previous_post();
                        if ( $prev_post ) {
                            printf(
                                '<a href="%1$s" rel="prev"><span class="nav-label">%2$s</span> %3$s</a>',
                                esc_url( get_permalink( $prev_post ) ),
                                esc_html__( '← Previous', 'drywall-toolbox' ),
                                esc_html( get_the_title( $prev_post ) )
                            );
                        }
                        ?>
                    </div>
                    <div class="nav-next">
                        <?php
                        $next_post = get_next_post();
                        if ( $next_post ) {
                            printf(
                                '<a href="%1$s" rel="next"><span class="nav-label">%2$s</span> %3$s</a>',
                                esc_url( get_permalink( $next_post ) ),
                                esc_html__( 'Next →', 'drywall-toolbox' ),
                                esc_html( get_the_title( $next_post ) )
                            );
                        }
                        ?>
                    </div>
                </div>
            </nav><!-- .post-navigation -->

        <?php endwhile; ?>

    </div><!-- .page-container -->
</main><!-- #main -->

<?php get_footer(); ?>
