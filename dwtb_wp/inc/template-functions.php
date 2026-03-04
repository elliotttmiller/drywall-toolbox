<?php
/**
 * Template helper functions for Drywall Toolbox theme.
 *
 * @package Drywall_Toolbox
 */

defined( 'ABSPATH' ) || exit;

/**
 * Return the permalink for a page identified by its slug.
 *
 * @param string $slug Page slug.
 * @return string Escaped URL.
 */
function dwtb_get_page_url( $slug ) {
	$page = get_page_by_path( $slug );
	return $page ? esc_url( get_permalink( $page->ID ) ) : esc_url( home_url( '/' . $slug ) );
}

/**
 * Output breadcrumb navigation: Home > [Category] > [Post/Page Title].
 */
function dwtb_breadcrumbs() {
	$separator = '<span class="breadcrumb-sep" aria-hidden="true"> &rsaquo; </span>';

	echo '<nav class="breadcrumbs" aria-label="' . esc_attr__( 'Breadcrumbs', 'drywall-toolbox' ) . '">';
	echo '<ol itemscope itemtype="https://schema.org/BreadcrumbList">';

	$position = 1;

	// Home
	echo '<li class="breadcrumb-item" itemprop="itemListElement" itemscope itemtype="https://schema.org/ListItem">';
	echo '<a href="' . esc_url( home_url( '/' ) ) . '" itemprop="item"><span itemprop="name">' . esc_html__( 'Home', 'drywall-toolbox' ) . '</span></a>';
	echo '<meta itemprop="position" content="' . esc_attr( $position ) . '">';
	echo '</li>';

	if ( is_single() ) {
		$categories = get_the_category();
		if ( $categories ) {
			$cat = $categories[0];
			++$position;
			echo $separator; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
			echo '<li class="breadcrumb-item" itemprop="itemListElement" itemscope itemtype="https://schema.org/ListItem">';
			echo '<a href="' . esc_url( get_category_link( $cat->term_id ) ) . '" itemprop="item"><span itemprop="name">' . esc_html( $cat->name ) . '</span></a>';
			echo '<meta itemprop="position" content="' . esc_attr( $position ) . '">';
			echo '</li>';
		}

		++$position;
		echo $separator; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
		echo '<li class="breadcrumb-item breadcrumb-current" itemprop="itemListElement" itemscope itemtype="https://schema.org/ListItem">';
		echo '<span itemprop="name">' . esc_html( get_the_title() ) . '</span>';
		echo '<meta itemprop="position" content="' . esc_attr( $position ) . '">';
		echo '</li>';

	} elseif ( is_page() ) {
		$queried = get_queried_object();
		if ( $queried && $queried->post_parent ) {
			++$position;
			echo $separator; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
			echo '<li class="breadcrumb-item" itemprop="itemListElement" itemscope itemtype="https://schema.org/ListItem">';
			echo '<a href="' . esc_url( get_permalink( $queried->post_parent ) ) . '" itemprop="item"><span itemprop="name">' . esc_html( get_the_title( $queried->post_parent ) ) . '</span></a>';
			echo '<meta itemprop="position" content="' . esc_attr( $position ) . '">';
			echo '</li>';
		}

		++$position;
		echo $separator; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
		echo '<li class="breadcrumb-item breadcrumb-current" itemprop="itemListElement" itemscope itemtype="https://schema.org/ListItem">';
		echo '<span itemprop="name">' . esc_html( get_the_title() ) . '</span>';
		echo '<meta itemprop="position" content="' . esc_attr( $position ) . '">';
		echo '</li>';

	} elseif ( is_category() ) {
		++$position;
		echo $separator; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
		$cat = get_queried_object();
		echo '<li class="breadcrumb-item breadcrumb-current" itemprop="itemListElement" itemscope itemtype="https://schema.org/ListItem">';
		echo '<span itemprop="name">' . esc_html( $cat->name ) . '</span>';
		echo '<meta itemprop="position" content="' . esc_attr( $position ) . '">';
		echo '</li>';

	} elseif ( is_search() ) {
		++$position;
		echo $separator; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
		echo '<li class="breadcrumb-item breadcrumb-current" itemprop="itemListElement" itemscope itemtype="https://schema.org/ListItem">';
		/* translators: %s: search query */
		echo '<span itemprop="name">' . esc_html( sprintf( __( 'Search: %s', 'drywall-toolbox' ), get_search_query() ) ) . '</span>';
		echo '<meta itemprop="position" content="' . esc_attr( $position ) . '">';
		echo '</li>';

	} elseif ( is_404() ) {
		++$position;
		echo $separator; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
		echo '<li class="breadcrumb-item breadcrumb-current" itemprop="itemListElement" itemscope itemtype="https://schema.org/ListItem">';
		echo '<span itemprop="name">' . esc_html__( '404 Not Found', 'drywall-toolbox' ) . '</span>';
		echo '<meta itemprop="position" content="' . esc_attr( $position ) . '">';
		echo '</li>';
	}

	echo '</ol>';
	echo '</nav>';
}

/**
 * Return the logo URL for a known brand, or empty string.
 *
 * @param string $brand_name Brand name.
 * @return string Escaped URL or empty string.
 */
function dwtb_get_brand_logo( $brand_name ) {
	$known_brands = array( 'tapetech', 'columbia-taping-tools', 'asgard', 'surpro', 'spray-king', 'graco' );
	$slug         = sanitize_title( $brand_name );
	if ( in_array( $slug, $known_brands, true ) ) {
		return esc_url( get_template_directory_uri() . '/assets/images/' . $slug . '-logo.svg' );
	}
	return '';
}

/**
 * Format a numeric value as a currency string ($X,XXX.XX).
 *
 * @param mixed $price Numeric price.
 * @return string Escaped formatted price, or empty string on invalid input.
 */
function dwtb_format_price( $price ) {
	if ( ! is_numeric( $price ) ) {
		return '';
	}
	return esc_html( '$' . number_format( (float) $price, 2 ) );
}

/**
 * Return 'active' if the current request URI contains $path, else ''.
 *
 * @param string $path URL path fragment to match.
 * @return string 'active' or ''.
 */
function dwtb_active_nav( $path ) {
	// phpcs:ignore WordPress.Security.ValidatedSanitizedInput.InputNotSanitized
	$request_uri = isset( $_SERVER['REQUEST_URI'] ) ? wp_unslash( $_SERVER['REQUEST_URI'] ) : '';
	$current_uri = esc_url( $request_uri );
	return ( strpos( $current_uri, $path ) !== false ) ? 'active' : '';
}

/**
 * Return the WooCommerce shop URL.
 *
 * @return string Escaped URL.
 */
function dwtb_get_wc_shop_url() {
	if ( function_exists( 'wc_get_page_id' ) ) {
		return esc_url( get_permalink( wc_get_page_id( 'shop' ) ) );
	}
	return esc_url( home_url( '/shop' ) );
}

/**
 * Return the WooCommerce cart URL.
 *
 * @return string Escaped URL.
 */
function dwtb_get_wc_cart_url() {
	if ( function_exists( 'wc_get_cart_url' ) ) {
		return esc_url( wc_get_cart_url() );
	}
	return esc_url( home_url( '/cart' ) );
}

/**
 * Return the WooCommerce checkout URL.
 *
 * @return string Escaped URL.
 */
function dwtb_get_wc_checkout_url() {
	if ( function_exists( 'wc_get_checkout_url' ) ) {
		return esc_url( wc_get_checkout_url() );
	}
	return esc_url( home_url( '/checkout' ) );
}

/**
 * Output the post thumbnail wrapped in a .tool-image container, with lazy loading.
 * Falls back to a placeholder div when no thumbnail is set.
 */
function dwtb_post_thumbnail() {
	if ( has_post_thumbnail() ) {
		echo '<div class="tool-image">';
		the_post_thumbnail( 'medium', array( 'loading' => 'lazy', 'class' => 'product-thumb' ) );
		echo '</div>';
	} else {
		echo '<div class="tool-image tool-image-placeholder"><span>' . esc_html( get_the_title() ) . '</span></div>';
	}
}
