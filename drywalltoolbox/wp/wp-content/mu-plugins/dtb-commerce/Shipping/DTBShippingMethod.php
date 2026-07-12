<?php

defined( 'ABSPATH' ) || exit;

defined( 'DTB_SHIPPING_METHOD_ID' ) || define( 'DTB_SHIPPING_METHOD_ID', 'dtb_veeqo_rates' );
defined( 'DTB_SHIPPING_ZONE_BOOTSTRAP_VERSION' ) || define( 'DTB_SHIPPING_ZONE_BOOTSTRAP_VERSION', '2' );

// =============================================================================
// SERVER-AUTHORITATIVE WOOCOMMERCE SHIPPING METHOD
//
// Registers the server-authoritative Drywall Toolbox shipping policy as a
// WooCommerce shipping method available in WooCommerce shipping zones.
//
// The method derives its inputs from WooCommerce's server-side cart package.
// It is a policy method, not a live Veeqo carrier-rating adapter.
// =============================================================================

add_action( 'woocommerce_shipping_init', 'dtb_commerce_register_shipping_method' );

function dtb_commerce_register_shipping_method(): void {
	if ( ! class_exists( 'DTB_Shipping_Method' ) ) {

		/**
		 * WooCommerce shipping method: DTB Shipping Policy.
		 *
		 * Shows Standard, Express, and Overnight options calculated from the
		 * cart total and total weight. Free shipping is applied automatically
		 * for domestic orders >= $500.
		 */
		class DTB_Shipping_Method extends WC_Shipping_Method {

			public function __construct( int $instance_id = 0 ) {
				$this->id                 = DTB_SHIPPING_METHOD_ID;
				$this->instance_id        = $instance_id;
				$this->method_title       = __( 'Drywall Toolbox Shipping', 'woocommerce' );
				$this->method_description = __( 'Server-authoritative Drywall Toolbox shipping policy.', 'woocommerce' );
				$this->supports           = [ 'shipping-zones', 'instance-settings' ];
				$this->title              = $this->get_option( 'title', __( 'Shipping', 'woocommerce' ) );
				$this->enabled            = 'yes';

				$this->init();
			}

			public function init(): void {
				$this->init_form_fields();
				$this->init_settings();
				add_action(
					'woocommerce_update_options_shipping_' . $this->id,
					[ $this, 'process_admin_options' ]
				);
			}

			public function init_form_fields(): void {
				$this->form_fields = [
					'title' => [
						'title'   => __( 'Method title', 'woocommerce' ),
						'type'    => 'text',
						'default' => __( 'Shipping', 'woocommerce' ),
					],
				];
			}

			/**
			 * Calculate shipping rates for the current cart and destination.
			 *
			 * @param array $package WooCommerce shipping package (destination + contents).
			 */
			public function calculate_shipping( $package = [] ): void {
				$destination = $package['destination'] ?? [];
				$contents    = $package['contents'] ?? [];

				$subtotal     = 0.0;
				$total_weight = 0.0;
				$has_repair   = false;

				foreach ( $contents as $cart_item ) {
					$product = $cart_item['data'] ?? null;
					$qty     = (int) ( $cart_item['quantity'] ?? 1 );
					$price   = $product ? (float) $product->get_price() : 0.0;
					$weight  = $product ? (float) $product->get_weight() : 0.5;

					$subtotal     += $price * $qty;
					$total_weight += $weight * $qty;

					$cats = $product ? wp_get_post_terms( $product->get_id(), 'product_cat', [ 'fields' => 'names' ] ) : [];
					foreach ( (array) $cats as $cat ) {
						if ( str_contains( strtolower( $cat ), 'repair' ) || str_contains( strtolower( $cat ), 'service' ) ) {
							$has_repair = true;
						}
					}
				}

				$country = strtoupper( sanitize_text_field( $destination['country'] ?? 'US' ) );

				if ( $has_repair ) {
					$this->add_rate( [
						'id'    => $this->get_rate_id( 'repair_prepaid' ),
						'label' => __( 'Repair Service — Prepaid Label', 'woocommerce' ),
						'cost'  => 0.00,
					] );
					return;
				}

				$is_domestic = ( 'US' === $country );

				if ( $is_domestic ) {
					$standard = $subtotal >= 500.0 ? 0.00
						: ( $total_weight <= 1.0 ? 7.99
							: ( $total_weight <= 5.0 ? 12.99
								: ( $total_weight <= 15.0 ? 19.99 : 29.99 ) ) );

					$this->add_rate( [
						'id'    => $this->get_rate_id( 'standard' ),
						'label' => $subtotal >= 500.0
							? __( 'Free Standard Shipping (5–7 business days)', 'woocommerce' )
							: __( 'Standard Shipping (5–7 business days)', 'woocommerce' ),
						'cost'  => $standard,
					] );
					$this->add_rate( [
						'id'    => $this->get_rate_id( 'express' ),
						'label' => __( 'Express Shipping (2–3 business days)', 'woocommerce' ),
						'cost'  => max( 0.00, $standard + 10.00 ),
					] );
					$this->add_rate( [
						'id'    => $this->get_rate_id( 'overnight' ),
						'label' => __( 'Overnight Shipping (next business day)', 'woocommerce' ),
						'cost'  => max( 0.00, $standard + 30.00 ),
					] );
				} else {
					$base = $total_weight <= 2.0 ? 29.99 : ( $total_weight <= 10.0 ? 49.99 : 79.99 );
					$this->add_rate( [
						'id'    => $this->get_rate_id( 'intl_standard' ),
						'label' => __( 'International Standard (10–15 business days)', 'woocommerce' ),
						'cost'  => $base,
					] );
					$this->add_rate( [
						'id'    => $this->get_rate_id( 'intl_express' ),
						'label' => __( 'International Express (5–7 business days)', 'woocommerce' ),
						'cost'  => $base + 30.00,
					] );
				}
			}
		}
	}
}

add_filter( 'woocommerce_shipping_methods', function ( array $methods ): array {
	$methods[ DTB_SHIPPING_METHOD_ID ] = 'DTB_Shipping_Method';
	return $methods;
} );

/**
 * Return whether a shipping zone already contains a DTB policy instance.
 *
 * Disabled instances count as existing so migrations never create duplicates
 * or override an operator's explicit disabled state.
 */
function dtb_commerce_zone_has_shipping_method( WC_Shipping_Zone $zone ): bool {
	foreach ( (array) $zone->get_shipping_methods( false, 'admin' ) as $method ) {
		if ( is_object( $method ) && DTB_SHIPPING_METHOD_ID === (string) ( $method->id ?? '' ) ) {
			return true;
		}
	}

	return false;
}

/**
 * Add DTB policy rates in memory when the matching zone has no DTB instance.
 *
 * This keeps public quote requests read-only. The rate fallback uses the same
 * server-authoritative method calculation without mutating WooCommerce shipping
 * zone configuration during an interactive checkout request. A disabled DTB
 * instance is treated as explicit operator intent and is not bypassed.
 *
 * @param array<string,WC_Shipping_Rate> $rates   Rates from the matching zone.
 * @param array<string,mixed>            $package Active shipping package.
 * @return array<string,WC_Shipping_Rate>
 */
function dtb_commerce_add_policy_rates_when_missing( array $rates, array $package ): array {
	foreach ( $rates as $rate ) {
		$method_id = is_object( $rate ) && method_exists( $rate, 'get_method_id' )
			? (string) $rate->get_method_id()
			: '';
		if ( DTB_SHIPPING_METHOD_ID === $method_id ) {
			return $rates;
		}
	}

	if ( class_exists( 'WC_Shipping_Zones' ) && class_exists( 'WC_Shipping_Zone' ) ) {
		$zone = WC_Shipping_Zones::get_zone_matching_package( $package );
		if ( $zone instanceof WC_Shipping_Zone && dtb_commerce_zone_has_shipping_method( $zone ) ) {
			return $rates;
		}
	}

	if ( ! class_exists( 'DTB_Shipping_Method' ) && class_exists( 'WC_Shipping_Method' ) ) {
		dtb_commerce_register_shipping_method();
	}
	if ( ! class_exists( 'DTB_Shipping_Method' ) ) {
		return $rates;
	}

	$method = new DTB_Shipping_Method( 0 );
	foreach ( (array) $method->get_rates_for_package( $package ) as $rate_id => $rate ) {
		if ( $rate instanceof WC_Shipping_Rate && ! isset( $rates[ $rate_id ] ) ) {
			$rates[ $rate_id ] = $rate;
		}
	}

	return $rates;
}
add_filter( 'woocommerce_package_rates', 'dtb_commerce_add_policy_rates_when_missing', 100, 2 );

/**
 * Clear WooCommerce's request/session package-rate cache.
 *
 * @param array<int,array<string,mixed>> $packages Current cart shipping packages.
 */
function dtb_commerce_invalidate_shipping_package_cache( array $packages = [] ): void {
	if ( ! function_exists( 'WC' ) || ! WC()->session ) {
		return;
	}

	$package_keys = array_keys( $packages );
	if ( empty( $package_keys ) ) {
		$package_keys = [ 0 ];
	}

	foreach ( $package_keys as $package_key ) {
		$session_key = 'shipping_for_package_' . absint( $package_key );
		if ( method_exists( WC()->session, '__unset' ) ) {
			WC()->session->__unset( $session_key );
		} else {
			WC()->session->set( $session_key, null );
		}
	}
}

/**
 * Return whether a zone location can match a United States destination.
 */
function dtb_commerce_zone_matches_us( WC_Shipping_Zone $zone ): bool {
	foreach ( (array) $zone->get_zone_locations() as $location ) {
		$type = sanitize_key( (string) ( $location->type ?? '' ) );
		$code = strtoupper( sanitize_text_field( (string) ( $location->code ?? '' ) ) );
		if ( ( 'country' === $type && 'US' === $code ) || str_starts_with( $code, 'US:' ) ) {
			return true;
		}
	}

	return false;
}

/**
 * Bootstrap and repair the required persisted policy instances.
 *
 * This deterministic versioned migration is independent of request payloads.
 * In-memory package-rate fallback protects checkout if a zone is later added
 * or reordered, while an explicitly disabled DTB instance remains disabled.
 */
add_action( 'woocommerce_init', 'dtb_bootstrap_shipping_zones', 20 );

function dtb_bootstrap_shipping_zones(): void {
	if ( DTB_SHIPPING_ZONE_BOOTSTRAP_VERSION === (string) get_option( 'dtb_shipping_zones_bootstrapped' ) ) {
		return;
	}

	if ( ! class_exists( 'WC_Shipping_Zones' ) || ! class_exists( 'WC_Shipping_Zone' ) ) {
		return;
	}

	$has_us_zone = false;
	foreach ( (array) WC_Shipping_Zones::get_zones() as $zone_data ) {
		$zone = WC_Shipping_Zones::get_zone( (int) ( $zone_data['zone_id'] ?? 0 ) );
		if ( ! $zone instanceof WC_Shipping_Zone || ! dtb_commerce_zone_matches_us( $zone ) ) {
			continue;
		}

		$has_us_zone = true;
		if ( ! dtb_commerce_zone_has_shipping_method( $zone ) ) {
			$zone->add_shipping_method( DTB_SHIPPING_METHOD_ID );
		}
	}

	if ( ! $has_us_zone ) {
		$us_zone = new WC_Shipping_Zone();
		$us_zone->set_zone_name( 'United States' );
		$us_zone->set_zone_order( 1 );
		$us_zone->add_location( 'US', 'country' );
		$us_zone->save();
		$us_zone->add_shipping_method( DTB_SHIPPING_METHOD_ID );
	}

	$row_zone = new WC_Shipping_Zone( 0 );
	if ( ! dtb_commerce_zone_has_shipping_method( $row_zone ) ) {
		$row_zone->add_shipping_method( DTB_SHIPPING_METHOD_ID );
	}

	update_option( 'dtb_shipping_zones_bootstrapped', DTB_SHIPPING_ZONE_BOOTSTRAP_VERSION );
}
