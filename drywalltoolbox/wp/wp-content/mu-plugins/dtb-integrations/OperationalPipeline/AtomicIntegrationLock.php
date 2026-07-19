<?php
/**
 * Atomic integration side-effect lease.
 *
 * Uses WordPress' unique option-name constraint as an atomic compare-and-create
 * primitive. This replaces the unsafe get_transient()+set_transient() race for
 * Veeqo/QuickBooks order writes while preserving the existing function contract.
 *
 * @package drywall-toolbox
 */

defined( 'ABSPATH' ) || exit;

if ( ! function_exists( 'dtb_order_integration_lock_key' ) ) {
	function dtb_order_integration_lock_key( string $system, int $order_id ): string {
		return 'dtb_integration_lock_' . sanitize_key( $system ) . '_' . max( 0, $order_id );
	}
}

if ( ! function_exists( 'dtb_order_integration_lock_owners' ) ) {
	/** @return array<string,string> */
	function &dtb_order_integration_lock_owners(): array {
		static $owners = [];
		return $owners;
	}
}

if ( ! function_exists( 'dtb_order_integration_acquire_lock' ) ) {
	function dtb_order_integration_acquire_lock( string $system, int $order_id, int $ttl = 300 ): bool {
		$key       = dtb_order_integration_lock_key( $system, $order_id );
		$ttl       = max( 30, $ttl );
		$token     = wp_generate_uuid4();
		$lease     = wp_json_encode( [ 'token' => $token, 'expires_at' => time() + $ttl ] );
		$owners   =& dtb_order_integration_lock_owners();

		if ( add_option( $key, $lease, '', 'no' ) ) {
			$owners[ $key ] = $token;
			return true;
		}

		$current = json_decode( (string) get_option( $key, '' ), true );
		$expired = is_array( $current ) && (int) ( $current['expires_at'] ?? 0 ) > 0 && (int) $current['expires_at'] < time();
		if ( ! $expired ) {
			return false;
		}

		// Best-effort stale lease recovery. `add_option` below is the actual atomic
		// winner selection if multiple workers observe the same expired lease.
		delete_option( $key );
		if ( ! add_option( $key, $lease, '', 'no' ) ) {
			return false;
		}

		$owners[ $key ] = $token;
		return true;
	}
}

if ( ! function_exists( 'dtb_order_integration_release_lock' ) ) {
	function dtb_order_integration_release_lock( string $system, int $order_id ): void {
		$key      = dtb_order_integration_lock_key( $system, $order_id );
		$owners  =& dtb_order_integration_lock_owners();
		$token    = (string) ( $owners[ $key ] ?? '' );
		$current  = json_decode( (string) get_option( $key, '' ), true );
		$held_by  = is_array( $current ) ? (string) ( $current['token'] ?? '' ) : '';

		if ( '' !== $token && '' !== $held_by && hash_equals( $held_by, $token ) ) {
			delete_option( $key );
		}
		unset( $owners[ $key ] );
	}
}
