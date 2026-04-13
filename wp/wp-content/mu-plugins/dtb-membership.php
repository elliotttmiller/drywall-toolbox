<?php
/**
 * DTB Membership — ProCare Tier Management
 *
 * REST Endpoints (dtb/v1 namespace):
 *   GET  /wp-json/dtb/v1/membership/tiers         — Public: tier configuration
 *   GET  /wp-json/dtb/v1/membership/status/{id}   — JWT: user's current tier & benefits
 *   POST /wp-json/dtb/v1/membership/enroll        — JWT: enroll in or upgrade a tier
 *
 * User meta keys:
 *   _dtb_membership_tier     → 'essential' | 'professional' | 'fleet'
 *   _dtb_membership_expires  → Unix timestamp (null for essential)
 *   _dtb_founding_member     → '1' if enrolled during Founding Member promo window
 *   _dtb_dx_used_this_year   → int — free diagnostics used in current membership year
 *
 * Tier definitions (must match frontend/src/api/membership.js MEMBERSHIP_TIERS):
 *   essential    — Free. No labor/parts discount. 15-day warranty. 0 free diagnostics.
 *   professional — $99/yr. 10% labor. Free ship ≥$150. 30-day warranty. 1 free Dx. +200 pts.
 *   fleet        — $299/yr. 15% labor+parts. Always free ship. 60-day warranty. 2 free Dx. +200 pts.
 *
 * Depends on (loaded before this via 00-dtb-loader.php):
 *   dtb-auth.php  → dtb_jwt_permission(), dtb_verify_jwt()
 *   dtb-rewards.php (optional) → WLR\Plugin\Helpers\App for bonus points
 *
 * @package drywall-toolbox
 */

defined( 'ABSPATH' ) || exit;

// ─── Tier definitions ─────────────────────────────────────────────────────────

define( 'DTB_MEMBERSHIP_TIERS', [
	'essential' => [
		'price'           => 0,
		'labor_discount'  => 0.00,
		'parts_discount'  => 0.00,
		'ship_threshold'  => null,   // No free shipping
		'warranty_days'   => 15,
		'free_dx'         => 0,
		'bonus_points'    => 0,
		'billing_cycle'   => null,
	],
	'professional' => [
		'price'           => 99,
		'labor_discount'  => 0.10,
		'parts_discount'  => 0.00,
		'ship_threshold'  => 150.0,  // Free shipping on orders ≥ $150
		'warranty_days'   => 30,
		'free_dx'         => 1,
		'bonus_points'    => 200,
		'billing_cycle'   => 'annual',
	],
	'fleet' => [
		'price'           => 299,
		'labor_discount'  => 0.15,
		'parts_discount'  => 0.15,
		'ship_threshold'  => 0.0,    // Always free shipping
		'warranty_days'   => 60,
		'free_dx'         => 2,
		'bonus_points'    => 200,
		'billing_cycle'   => 'annual',
	],
] );

// WooCommerce product SKUs that correspond to each paid membership tier.
// These products must exist in WooCommerce and be marked _dtb_exclude_from_points: yes.
define( 'DTB_MEMBERSHIP_SKUS', [
	'professional' => 'procare-professional',
	'fleet'        => 'procare-fleet',
] );

// ─── Route registration ───────────────────────────────────────────────────────

add_action( 'rest_api_init', 'dtb_membership_register_routes' );

function dtb_membership_register_routes(): void {
	$ns = 'dtb/v1';

	register_rest_route( $ns, '/membership/tiers', [
		'methods'             => 'GET',
		'callback'            => 'dtb_membership_get_tiers',
		'permission_callback' => '__return_true',
	] );

	register_rest_route( $ns, '/membership/status/(?P<id>\d+)', [
		'methods'             => 'GET',
		'callback'            => 'dtb_membership_get_status',
		'permission_callback' => 'dtb_jwt_permission',
		'args'                => [
			'id' => [
				'required'          => true,
				'validate_callback' => 'is_numeric',
				'sanitize_callback' => 'absint',
			],
		],
	] );

	register_rest_route( $ns, '/membership/enroll', [
		'methods'             => 'POST',
		'callback'            => 'dtb_membership_enroll',
		'permission_callback' => 'dtb_jwt_permission',
	] );
}

// ─── Route callbacks ──────────────────────────────────────────────────────────

/**
 * GET /dtb/v1/membership/tiers — public
 *
 * Returns tier configuration (without pricing data that could be scraped for
 * competitor intelligence — benefits only, no internal cost margins).
 */
function dtb_membership_get_tiers(): WP_REST_Response {
	$tiers = DTB_MEMBERSHIP_TIERS;

	// Strip internal-only keys before sending to client.
	$public = [];
	foreach ( $tiers as $id => $config ) {
		$public[ $id ] = [
			'id'              => $id,
			'price'           => $config['price'],
			'billing_cycle'   => $config['billing_cycle'],
			'labor_discount'  => $config['labor_discount'],
			'parts_discount'  => $config['parts_discount'],
			'ship_threshold'  => $config['ship_threshold'],
			'warranty_days'   => $config['warranty_days'],
			'free_dx'         => $config['free_dx'],
			'bonus_points'    => $config['bonus_points'],
		];
	}

	return rest_ensure_response( $public );
}

/**
 * GET /dtb/v1/membership/status/{id} — JWT required
 *
 * Returns the authenticated user's current membership tier, expiry,
 * remaining free diagnostics, and applied discount rates.
 */
function dtb_membership_get_status( WP_REST_Request $request ): WP_REST_Response|WP_Error {
	$user_id = absint( $request['id'] );

	if ( ! get_user_by( 'id', $user_id ) ) {
		return new WP_Error( 'not_found', 'User not found.', [ 'status' => 404 ] );
	}

	$tier    = get_user_meta( $user_id, '_dtb_membership_tier', true ) ?: 'essential';
	$expires = get_user_meta( $user_id, '_dtb_membership_expires', true ) ?: null;

	// Membership is active if essential (no expiry) or expiry is in the future.
	$active = ( 'essential' === $tier ) || ( $expires && (int) $expires > time() );

	// If a paid membership has expired, fall back to essential.
	if ( 'essential' !== $tier && ! $active ) {
		$tier = 'essential';
	}

	$tier_config  = DTB_MEMBERSHIP_TIERS[ $tier ] ?? DTB_MEMBERSHIP_TIERS['essential'];
	$dx_used      = (int) get_user_meta( $user_id, '_dtb_dx_used_this_year', true );
	$dx_remaining = max( 0, $tier_config['free_dx'] - $dx_used );

	return rest_ensure_response( [
		'user_id'                    => $user_id,
		'tier'                       => $tier,
		'active'                     => $active,
		'expires_at'                 => $expires ? gmdate( 'c', (int) $expires ) : null,
		'free_diagnostics_remaining' => $dx_remaining,
		'founding_member'            => (bool) get_user_meta( $user_id, '_dtb_founding_member', true ),
		'labor_discount'             => $tier_config['labor_discount'],
		'parts_discount'             => $tier_config['parts_discount'],
		'warranty_days'              => $tier_config['warranty_days'],
		'ship_threshold'             => $tier_config['ship_threshold'],
	] );
}

/**
 * POST /dtb/v1/membership/enroll — JWT required
 *
 * Enrolls a user in a paid tier. Accepts founding_member flag for the promo window.
 * Awards enrollment bonus points via WPLoyalty (if available).
 *
 * Body: { user_id: int, tier: string, founding_member?: bool }
 */
function dtb_membership_enroll( WP_REST_Request $request ): WP_REST_Response|WP_Error {
	$params          = $request->get_json_params();
	$user_id         = absint( $params['user_id'] ?? 0 );
	$tier            = sanitize_key( $params['tier'] ?? '' );
	$founding_member = (bool) ( $params['founding_member'] ?? false );

	if ( ! $user_id || ! isset( DTB_MEMBERSHIP_TIERS[ $tier ] ) || 'essential' === $tier ) {
		return new WP_Error(
			'invalid_params',
			'Valid user_id and a paid tier (professional or fleet) are required.',
			[ 'status' => 400 ]
		);
	}

	if ( ! get_user_by( 'id', $user_id ) ) {
		return new WP_Error( 'not_found', 'User not found.', [ 'status' => 404 ] );
	}

	// Atomic idempotency guard using wp_cache_add (returns false if key already exists).
	// This prevents double-enrollment from concurrent requests within the same 10-second window.
	$lock_key = 'dtb_membership_enroll_' . $user_id;
	if ( ! wp_cache_add( $lock_key, 1, '', 10 ) ) {
		return new WP_Error( 'conflict', 'Enrollment already in progress.', [ 'status' => 409 ] );
	}

	$tier_config = DTB_MEMBERSHIP_TIERS[ $tier ];
	$expires     = strtotime( '+1 year' );

	update_user_meta( $user_id, '_dtb_membership_tier', $tier );
	update_user_meta( $user_id, '_dtb_membership_expires', $expires );
	update_user_meta( $user_id, '_dtb_dx_used_this_year', 0 );

	if ( $founding_member ) {
		update_user_meta( $user_id, '_dtb_founding_member', 1 );
	}

	// Award enrollment bonus points via WPLoyalty (if installed).
	if ( $tier_config['bonus_points'] > 0 && class_exists( 'WLR\Plugin\Helpers\App' ) ) {
		$user = get_user_by( 'id', $user_id );
		if ( $user ) {
			try {
				\WLR\Plugin\Helpers\App::addPoints(
					$user->user_email,
					$tier_config['bonus_points'],
					'membership',
					sprintf(
						'ProCare %s enrollment bonus — %d pts',
						ucfirst( $tier ),
						$tier_config['bonus_points']
					)
				);
			} catch ( \Throwable $e ) {
				// Log but never block enrollment.
				error_log( '[DTB Membership] Bonus points failed for user ' . $user_id . ': ' . $e->getMessage() );
			}
		}
	}

	wp_cache_delete( $lock_key );

	return rest_ensure_response( [
		'success'    => true,
		'tier'       => $tier,
		'expires_at' => gmdate( 'c', $expires ),
	] );
}

// ─── WooCommerce order hook: renewal & counter reset ─────────────────────────

/**
 * When a WooCommerce membership product order is completed, update the user's
 * tier meta and reset the annual free-diagnostic counter.
 *
 * This handles both new enrollments (where enrollMembership sets meta directly)
 * and future renewals (where the customer re-purchases the membership product).
 *
 * @param int $order_id
 */
add_action( 'woocommerce_order_status_completed', 'dtb_membership_handle_order', 15 );

function dtb_membership_handle_order( int $order_id ): void {
	$order = wc_get_order( $order_id );
	if ( ! $order ) {
		return;
	}

	$user_id = (int) $order->get_user_id();
	if ( ! $user_id ) {
		return;
	}

	foreach ( $order->get_items() as $item ) {
		$product = $item->get_product();
		if ( ! $product ) {
			continue;
		}
		$sku = $product->get_sku();
		foreach ( DTB_MEMBERSHIP_SKUS as $tier => $membership_sku ) {
			if ( $sku === $membership_sku ) {
				$expires = strtotime( '+1 year' );
				update_user_meta( $user_id, '_dtb_membership_tier', $tier );
				update_user_meta( $user_id, '_dtb_membership_expires', $expires );
				update_user_meta( $user_id, '_dtb_dx_used_this_year', 0 );
				break;
			}
		}
	}
}
