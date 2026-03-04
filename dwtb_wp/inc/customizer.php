<?php
/**
 * Drywall Toolbox Theme Customizer
 *
 * @package Drywall_Toolbox
 */

defined( 'ABSPATH' ) || exit;

/**
 * Register customizer settings, sections, and controls.
 *
 * @param WP_Customize_Manager $wp_customize Customizer manager instance.
 */
function dwtb_customize_register( $wp_customize ) {

	// =========================================================
	// Panel
	// =========================================================
	$wp_customize->add_panel(
		'dwtb_theme_options',
		array(
			'title'    => __( 'Drywall Toolbox Options', 'drywall-toolbox' ),
			'priority' => 30,
		)
	);

	// =========================================================
	// Section: Brand Colors
	// =========================================================
	$wp_customize->add_section(
		'dwtb_colors',
		array(
			'title'    => __( 'Brand Colors', 'drywall-toolbox' ),
			'panel'    => 'dwtb_theme_options',
			'priority' => 10,
		)
	);

	// Primary Color
	$wp_customize->add_setting(
		'dwtb_primary_color',
		array(
			'default'           => '#2563eb',
			'sanitize_callback' => 'sanitize_hex_color',
			'transport'         => 'postMessage',
		)
	);
	$wp_customize->add_control(
		new WP_Customize_Color_Control(
			$wp_customize,
			'dwtb_primary_color',
			array(
				'label'   => __( 'Primary Color', 'drywall-toolbox' ),
				'section' => 'dwtb_colors',
			)
		)
	);

	// Accent Color
	$wp_customize->add_setting(
		'dwtb_accent_color',
		array(
			'default'           => '#60a5fa',
			'sanitize_callback' => 'sanitize_hex_color',
			'transport'         => 'postMessage',
		)
	);
	$wp_customize->add_control(
		new WP_Customize_Color_Control(
			$wp_customize,
			'dwtb_accent_color',
			array(
				'label'   => __( 'Accent Color', 'drywall-toolbox' ),
				'section' => 'dwtb_colors',
			)
		)
	);

	// =========================================================
	// Section: Contact Info
	// =========================================================
	$wp_customize->add_section(
		'dwtb_contact',
		array(
			'title'    => __( 'Contact Info', 'drywall-toolbox' ),
			'panel'    => 'dwtb_theme_options',
			'priority' => 20,
		)
	);

	// Contact Email
	$wp_customize->add_setting(
		'dwtb_contact_email',
		array(
			'default'           => 'support@drywalltoolbox.com',
			'sanitize_callback' => 'sanitize_email',
		)
	);
	$wp_customize->add_control(
		'dwtb_contact_email',
		array(
			'label'   => __( 'Contact Email', 'drywall-toolbox' ),
			'section' => 'dwtb_contact',
			'type'    => 'text',
		)
	);

	// Phone Number
	$wp_customize->add_setting(
		'dwtb_contact_phone',
		array(
			'default'           => '',
			'sanitize_callback' => 'sanitize_text_field',
		)
	);
	$wp_customize->add_control(
		'dwtb_contact_phone',
		array(
			'label'   => __( 'Phone Number', 'drywall-toolbox' ),
			'section' => 'dwtb_contact',
			'type'    => 'text',
		)
	);

	// =========================================================
	// Section: Social Media
	// =========================================================
	$wp_customize->add_section(
		'dwtb_social',
		array(
			'title'    => __( 'Social Media', 'drywall-toolbox' ),
			'panel'    => 'dwtb_theme_options',
			'priority' => 30,
		)
	);

	// Instagram URL
	$wp_customize->add_setting(
		'dwtb_instagram_url',
		array(
			'default'           => 'https://instagram.com',
			'sanitize_callback' => 'esc_url_raw',
		)
	);
	$wp_customize->add_control(
		'dwtb_instagram_url',
		array(
			'label'   => __( 'Instagram URL', 'drywall-toolbox' ),
			'section' => 'dwtb_social',
			'type'    => 'url',
		)
	);

	// Facebook URL
	$wp_customize->add_setting(
		'dwtb_facebook_url',
		array(
			'default'           => 'https://facebook.com',
			'sanitize_callback' => 'esc_url_raw',
		)
	);
	$wp_customize->add_control(
		'dwtb_facebook_url',
		array(
			'label'   => __( 'Facebook URL', 'drywall-toolbox' ),
			'section' => 'dwtb_social',
			'type'    => 'url',
		)
	);

	// Twitter / X URL
	$wp_customize->add_setting(
		'dwtb_twitter_url',
		array(
			'default'           => 'https://twitter.com',
			'sanitize_callback' => 'esc_url_raw',
		)
	);
	$wp_customize->add_control(
		'dwtb_twitter_url',
		array(
			'label'   => __( 'Twitter / X URL', 'drywall-toolbox' ),
			'section' => 'dwtb_social',
			'type'    => 'url',
		)
	);
}
add_action( 'customize_register', 'dwtb_customize_register' );

/**
 * Output inline CSS for custom brand colors (front-end).
 */
function dwtb_customizer_css() {
	$primary = get_theme_mod( 'dwtb_primary_color', '#2563eb' );
	$primary = sanitize_hex_color( $primary );
	if ( ! $primary ) {
		$primary = '#2563eb';
	}
	?>
	<style id="dwtb-customizer-css">
		:root {
			--alloy-deep: <?php echo esc_attr( $primary ); ?>;
			--tension-accent: <?php echo esc_attr( $primary ); ?>;
			--primary-600: <?php echo esc_attr( $primary ); ?>;
		}
	</style>
	<?php
}
add_action( 'wp_head', 'dwtb_customizer_css' );

/**
 * Live-preview JS: update CSS variables instantly in the customizer.
 */
function dwtb_customizer_preview_js() {
	?>
	<script>
	(function() {
		'use strict';

		function applyColor(color) {
			var styleEl = document.getElementById('dwtb-live-preview-style');
			if (!styleEl) {
				styleEl = document.createElement('style');
				styleEl.id = 'dwtb-live-preview-style';
				document.head.appendChild(styleEl);
			}
			styleEl.textContent =
				':root {' +
				'--alloy-deep:' + color + ';' +
				'--tension-accent:' + color + ';' +
				'--primary-600:' + color + ';' +
				'}';
		}

		wp.customize('dwtb_primary_color', function(value) {
			value.bind(function(newColor) {
				applyColor(newColor);
			});
		});
	})();
	</script>
	<?php
}
add_action( 'customize_preview_init', function() {
	add_action( 'wp_footer', 'dwtb_customizer_preview_js' );
} );
