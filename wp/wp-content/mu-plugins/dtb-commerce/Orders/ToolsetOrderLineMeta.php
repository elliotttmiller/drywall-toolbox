<?php
/**
 * Toolset order line metadata persistence.
 *
 * @package drywall-toolbox
 */

defined( 'ABSPATH' ) || exit;

final class DTB_ToolsetOrderLineMeta {
	public static function register(): void {
		add_action( 'woocommerce_checkout_create_order_line_item', [ self::class, 'persist_order_line_meta' ], 20, 4 );
	}

	/**
	 * Persist allowed DTB toolset metadata onto order line items.
	 *
	 * @param WC_Order_Item_Product $item
	 * @param string                $_cart_item_key
	 * @param array                 $values
	 * @param WC_Order              $_order
	 * @return void
	 */
	public static function persist_order_line_meta( WC_Order_Item_Product $item, string $_cart_item_key, array $values, WC_Order $_order ): void {
		$meta = $values['dtb_toolset_meta'] ?? null;
		if ( ! is_array( $meta ) || [] === $meta ) {
			return;
		}

		foreach ( $meta as $key => $value ) {
			$key = sanitize_key( (string) $key );
			if ( '' === $key ) {
				continue;
			}
			$val = sanitize_text_field( (string) $value );
			if ( '' === $val ) {
				continue;
			}
			$item->add_meta_data( $key, $val, true );
		}
	}
}
