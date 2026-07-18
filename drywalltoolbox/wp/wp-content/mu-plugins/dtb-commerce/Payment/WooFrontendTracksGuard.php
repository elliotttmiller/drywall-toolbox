<?php
/**
 * Guard optional WooCommerce frontend tracking scripts on DTB checkout shells.
 *
 * WooCommerce checkout and WooPayments must remain fully active. WooCommerce
 * Tracks is analytics-only; if it is enqueued without the expected data object
 * on our standalone checkout documents, it can throw before checkout UI mounts.
 *
 * @package drywall-toolbox
 */

defined( 'ABSPATH' ) || exit;

final class DTB_WooFrontendTracksGuard {
	/** @var string[] */
	private const BLOCKED_SRC_FRAGMENTS = [
		'frontend-tracks.js',
	];

	/** @var string[] */
	private const OPTIONAL_TRACKING_HANDLES = [
		'wc-tracks',
		'woo-tracks',
		'woocommerce-tracks',
		'wc-frontend-tracks',
		'woocommerce-frontend-tracks',
	];

	public static function register(): void {
		add_action( 'wp_enqueue_scripts', [ __CLASS__, 'dequeue_optional_tracks' ], 9999 );
		add_filter( 'script_loader_tag', [ __CLASS__, 'suppress_optional_tracks_tag' ], 10, 3 );
	}

	public static function dequeue_optional_tracks(): void {
		if ( ! self::is_dtb_checkout_surface() ) {
			return;
		}

		foreach ( self::matching_handles() as $handle ) {
			wp_dequeue_script( $handle );
		}
	}

	public static function suppress_optional_tracks_tag( string $tag, string $handle, string $src ): string {
		if ( ! self::is_dtb_checkout_surface() ) {
			return $tag;
		}

		if ( in_array( $handle, self::OPTIONAL_TRACKING_HANDLES, true ) || self::source_is_blocked( $src ) ) {
			return '';
		}

		return $tag;
	}

	private static function is_dtb_checkout_surface(): bool {
		if ( is_admin() ) {
			return false;
		}

		if ( isset( $_GET['dtb_wcpay_express_surface'] ) && '1' === sanitize_text_field( wp_unslash( $_GET['dtb_wcpay_express_surface'] ) ) ) { // phpcs:ignore WordPress.Security.NonceVerification.Recommended
			return true;
		}

		if ( isset( $_GET['dtb_woo_checkout'] ) && '1' === sanitize_text_field( wp_unslash( $_GET['dtb_woo_checkout'] ) ) ) { // phpcs:ignore WordPress.Security.NonceVerification.Recommended
			return true;
		}

		return function_exists( 'is_checkout' ) && is_checkout();
	}

	/**
	 * @return string[]
	 */
	private static function matching_handles(): array {
		global $wp_scripts;

		$handles = self::OPTIONAL_TRACKING_HANDLES;
		if ( ! $wp_scripts instanceof WP_Scripts ) {
			return array_values( array_unique( $handles ) );
		}

		foreach ( $wp_scripts->registered as $handle => $dependency ) {
			$src = is_object( $dependency ) && isset( $dependency->src ) ? (string) $dependency->src : '';
			if ( self::source_is_blocked( $src ) ) {
				$handles[] = (string) $handle;
			}
		}

		return array_values( array_unique( array_filter( $handles ) ) );
	}

	private static function source_is_blocked( string $src ): bool {
		foreach ( self::BLOCKED_SRC_FRAGMENTS as $fragment ) {
			if ( '' !== $src && false !== stripos( $src, $fragment ) ) {
				return true;
			}
		}
		return false;
	}
}

DTB_WooFrontendTracksGuard::register();
