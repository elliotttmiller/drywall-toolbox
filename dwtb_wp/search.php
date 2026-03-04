<?php
/**
 * Search results template
 *
 * @package drywall-toolbox
 */

get_header();
?>

<main id="main" class="site-main" role="main">
    <div class="page-container">

        <header class="search-header">
            <h1 class="search-title">
                <?php
                printf(
                    /* translators: %s: search query */
                    esc_html__( 'Search results for: %s', 'drywall-toolbox' ),
                    '<span class="search-query">' . esc_html( get_search_query() ) . '</span>'
                );
                ?>
            </h1>
        </header>

        <?php get_search_form(); ?>

        <?php if ( have_posts() ) : ?>

            <p class="search-count">
                <?php
                global $wp_query;
                printf(
                    /* translators: %d: number of results */
                    esc_html( _n( '%d result found.', '%d results found.', $wp_query->found_posts, 'drywall-toolbox' ) ),
                    (int) $wp_query->found_posts
                );
                ?>
            </p>

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

            <nav class="posts-pagination" aria-label="<?php esc_attr_e( 'Search pagination', 'drywall-toolbox' ); ?>">
                <?php posts_nav_link( ' — ', esc_html__( '← Previous', 'drywall-toolbox' ), esc_html__( 'Next →', 'drywall-toolbox' ) ); ?>
            </nav>

        <?php else : ?>

            <div class="no-results no-search-results">
                <p>
                    <?php
                    printf(
                        /* translators: %s: search query */
                        esc_html__( 'No results found for "%s". Try a different search term or browse our shop.', 'drywall-toolbox' ),
                        esc_html( get_search_query() )
                    );
                    ?>
                </p>
                <?php
                $shop_id  = function_exists( 'wc_get_page_id' ) ? wc_get_page_id( 'shop' ) : 0;
                $shop_url = $shop_id ? get_permalink( $shop_id ) : home_url( '/shop/' );
                ?>
                <a href="<?php echo esc_url( $shop_url ); ?>" class="alloy-button">
                    <?php esc_html_e( 'Browse Shop', 'drywall-toolbox' ); ?>
                </a>
            </div>

        <?php endif; ?>

    </div><!-- .page-container -->
</main><!-- #main -->

<?php get_footer(); ?>
