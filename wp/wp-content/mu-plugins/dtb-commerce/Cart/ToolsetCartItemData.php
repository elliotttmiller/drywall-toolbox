<?php
/**
 * Toolset cart item data bridge.
 *
 * Accepts a constrained DTB metadata payload from Store API extensions and
 * stores sanitized values in Woo cart item data for later order persistence.
 *
 * @package drywall-toolbox
 */

defined( 'ABSPATH' ) || exit;

final class DTB_ToolsetCartItemData {
	/** @var string[] */
	private const ALLOWLIST_KEYS = [
		'_dtb_toolset_id',
		'_dtb_toolset_instance_id',
		'_dtb_toolset_slot',
		'_dtb_toolset_slot_label',
		'_dtb_toolset_brand',
		'_dtb_toolset_scope',
		'_dtb_included_item',
	];

	public static function register(): void {
		add_filter( 'woocommerce_store_api_add_to_cart_data', [ self::class, 'filter_store_api_add_to_cart_data' ], 20, 2 );
		add_filter( 'woocommerce_add_cart_item_data', [ self::class, 'filter_add_cart_item_data' ], 20, 3 );
	}

	/**
	 * Move sanitized Store API extension metadata into cart item data.
	 *
	 * @param array           $add_to_cart_data
	 * @param WP_REST_Request $request
	 * @return array
	 */
	public static function filter_store_api_add_to_cart_data( array $add_to_cart_data, WP_REST_Request $request ): array {
		$params = $request->get_json_params();
		if ( ! is_array( $params ) ) {
			return $add_to_cart_data;
		}

		$incoming = $params['extensions']['dtb']['metadata'] ?? null;
		$meta     = self::sanitize_metadata_pairs( $incoming );
		if ( [] === $meta ) {
			return $add_to_cart_data;
		}

		$add_to_cart_data['dtb_toolset_meta'] = $meta;
		return $add_to_cart_data;
	}

	/**
	 * Ensure cart item data carries sanitized metadata in non-Store-API flows too.
	 *
	 * @param array $cart_item_data
	 * @param int   $_product_id
	 * @param int   $_variation_id
	 * @return array
	 */
	public static function filter_add_cart_item_data( array $cart_item_data, int $_product_id, int $_variation_id ): array {
		$incoming = $cart_item_data['dtb_toolset_meta'] ?? null;
		$meta     = self::sanitize_metadata_assoc( $incoming );

		if ( [] === $meta ) {
			unset( $cart_item_data['dtb_toolset_meta'] );
			return $cart_item_data;
		}

		$cart_item_data['dtb_toolset_meta'] = $meta;
		return $cart_item_data;
	}

	/**
	 * @param mixed $value
	 * @return array<string,string>
	 */
	private static function sanitize_metadata_assoc( mixed $value ): array {
		if ( ! is_array( $value ) ) {
			return [];
		}

		$out = [];
		foreach ( $value as $key => $val ) {
			$key = sanitize_key( (string) $key );
			if ( ! in_array( $key, self::ALLOWLIST_KEYS, true ) ) {
				continue;
			}
			$normalized = self::normalize_value( $key, $val );
			if ( null === $normalized ) {
				continue;
			}
			$out[ $key ] = $normalized;
		}

		return $out;
	}

	/**
	 * @param mixed $value
	 * @return array<string,string>
	 */
	private static function sanitize_metadata_pairs( mixed $value ): array {
		if ( ! is_array( $value ) ) {
			return [];
		}

		$out = [];
		foreach ( $value as $entry ) {
			if ( ! is_array( $entry ) ) {
				continue;
			}
			$key = sanitize_key( (string) ( $entry['key'] ?? '' ) );
			if ( ! in_array( $key, self::ALLOWLIST_KEYS, true ) ) {
				continue;
			}
			$normalized = self::normalize_value( $key, $entry['value'] ?? null );
			if ( null === $normalized ) {
				continue;
			}
			$out[ $key ] = $normalized;
		}

		return $out;
	}

	private static function normalize_value( string $key, mixed $value ): ?string {
		if ( null === $value ) {
			return null;
		}

		$raw = wp_strip_all_tags( (string) $value );
		if ( '' === $raw ) {
			return null;
		}

		if ( '_dtb_included_item' === $key ) {
			return in_array( strtolower( $raw ), [ '1', 'true', 'yes' ], true ) ? '1' : '0';
		}

		return sanitize_text_field( $raw );
	}
}
