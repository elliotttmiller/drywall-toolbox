<?php
/**
 * Archive template
 *
 * @package drywall-toolbox
 */

get_header();
?>

<main id="main" class="site-main" role="main">
    <div class="page-container">

        <header class="archive-header">
            <h1 class="machined-title archive-title">
                <?php the_archive_title(); ?>
            </h1>
            <?php
            $archive_description = get_the_archive_description();
            if ( $archive_description ) :
            ?>
                <div class="archive-description">
                    <?php echo wp_kses_post( $archive_description ); ?>
                </div>
            <?php endif; ?>
        </header><!-- .archive-header -->

        <?php if ( have_posts() ) : ?>

            <div class="posts-grid" role="list">
                <?php while ( have_posts() ) : the_post(); ?>

                    <div class="tool-card" role="listitem">

                        <?php if ( has_post_thumbnail() ) : ?>
                            <a href="<?php the_permalink(); ?>" class="tool-card-image" tabindex="-1" aria-hidden="true">
                                <?php the_post_thumbnail( 'medium' ); ?>
                            </a>
                        <?php endif; ?>

                        <div class="tool-card-body">
                            <h2 class="tool-card-title">
                                <a href="<?php the_permalink(); ?>"><?php the_title(); ?></a>
                            </h2>

                            <div class="tool-card-meta">
                                <time datetime="<?php echo esc_attr( get_the_date( 'c' ) ); ?>">
                                    <?php echo esc_html( get_the_date() ); ?>
                                </time>
                            </div>

                            <div class="tool-card-excerpt">
                                <?php the_excerpt(); ?>
                            </div>

                            <a href="<?php the_permalink(); ?>" class="tool-card-read-more">
                                <?php esc_html_e( 'Read More', 'drywall-toolbox' ); ?>
                                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24"
                                     fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"
                                     stroke-linejoin="round" aria-hidden="true">
                                    <polyline points="9 18 15 12 9 6"></polyline>
                                </svg>
                            </a>
                        </div>

                    </div><!-- .tool-card -->

                <?php endwhile; ?>
            </div><!-- .posts-grid -->

            <nav class="posts-pagination" aria-label="<?php esc_attr_e( 'Archive pagination', 'drywall-toolbox' ); ?>">
                <?php posts_nav_link( ' — ', esc_html__( '← Previous', 'drywall-toolbox' ), esc_html__( 'Next →', 'drywall-toolbox' ) ); ?>
            </nav>

        <?php else : ?>

            <div class="no-results">
                <p><?php esc_html_e( 'No posts found.', 'drywall-toolbox' ); ?></p>
            </div>

        <?php endif; ?>

    </div><!-- .page-container -->
</main><!-- #main -->

<?php get_footer(); ?>
