<?php
/**
 * DTB Rewards Bridge — Must-Use Plugin
 *
 * Exposes WPLoyalty point data through the DTB REST API (dtb/v1 namespace).
 * The React SPA never calls WPLoyalty directly — it calls only these endpoints.
 *
 * Endpoints:
 *   GET  /wp-json/dtb/v1/rewards/balance/{id}  — User's current point balance
 *   GET  /wp-json/dtb/v1/rewards/history/{id}  — Paginated transaction history
 *   POST /wp-json/dtb/v1/rewards/redeem        — Redeem points → WC coupon code
 *   POST /wp-json/dtb/v1/rewards/admin/adjust  — Admin: manual point adjustment
 *
 * All user endpoints require a valid DTB JWT (dtb_jwt_permission).
 * The admin endpoint additionally requires manage_woocommerce capability.
 *
 * EARN LOGIC — FLAT RATE (sourced from DTB_Strategy_Overview.md §Loyalty Points):
 *   1 point per $2.00 of eligible subtotal (0.5 pts/$1).
 *   WPLoyalty Lite does not support conditional campaign rules.
 *   Points are awarded here via woocommerce_order_status_completed.
 *   WPLoyalty is used only as a ledger — disable its own campaigns.
 *
 *   REDEMPTION RATE: 100 pts = $5.00 (0.05 USD/pt)
 *   MINIMUM REDEEM:  100 pts ($5.00)
 *   MAXIMUM REDEEM:  5,000 pts ($250.00) per order
 *
 * Depends on (loaded before this via 00-dtb-loader.php):
 *   dtb-auth.php  → dtb_jwt_permission(), dtb_verify_jwt()
 *   WPLoyalty     → active plugin providing WLR\Plugin\Helpers\App
 *
 * @package drywall-toolbox
 */

defined( 'ABSPATH' ) || exit;

/** Points earned per US dollar spent (100 pts = $5.00 → 20 pts/$1.00). */
if ( ! defined( 'DTB_REWARDS_POINTS_PER_DOLLAR' ) ) {
	define( 'DTB_REWARDS_POINTS_PER_DOLLAR', 20 );
}

// =============================================================================
// EARN ENGINE — ORDER COMPLETION HOOK
//
// WPLoyalty Lite does not support conditional campaign rules.
// We bypass its campaign engine entirely and award points here on order
// completion. WPLoyalty is used only as a ledger — install it, but disable
// its own campaigns (or set them to 0 pts/$) so there is no double-awarding.
//
// EARN RATE: 1 point per $2.00 spent on eligible subtotal (0.5 pts/$1).
// SOURCE:    DTB_Strategy_Overview.md §Loyalty Points
// =============================================================================

add_action( 'woocommerce_order_status_completed', 'dtb_rewards_award_order_points', 20 );

/**
 * Award points when an order is marked complete.
 *
 * EARN RATE: 1 point per $2.00 spent on eligible subtotal.
 *   - Earn basis: order subtotal (excl. shipping, tax, fees).
 *   - Membership fees:   0 pts (excluded — see _dtb_exclude_from_points meta).
 *   - Shipping charges:  0 pts (already excluded by using get_subtotal()).
 *   - Refunds:           points reversed on refund/cancel (see dtb_rewards_reverse_points).
 *
 * Formula: floor( subtotal / 2 )
 *   $10 → 5 pts  | $49 → 24 pts  | $100 → 50 pts
 *   $299 → 149 pts | $499 → 249 pts | $1,000 → 500 pts
 *
 * Idempotent: guarded by _dtb_rewards_awarded order meta.
 *
 * @param int $order_id
 */
function dtb_rewards_award_order_points( int $order_id ): void {
	if ( ! class_exists( 'WLR\Plugin\Helpers\App' ) ) {
		return;
	}

	$order = wc_get_order( $order_id );
	if ( ! $order || $order->get_meta( '_dtb_rewards_awarded' ) ) {
		return;
	}

	$user_id = (int) $order->get_user_id();
	if ( ! $user_id ) {
		return; // Guest order — no user to credit.
	}

	$user_email = dtb_wlr_get_user_email( $user_id );
	if ( ! $user_email ) {
		return;
	}

	// Earn basis: subtotal only. Shipping = 0 pts. Taxes = 0 pts.
	$earn_basis = (float) $order->get_subtotal();

	// Exclude any items flagged as non-earnable (e.g., service-fee products).
	foreach ( $order->get_items() as $item ) {
		$product = $item->get_product();
		if ( $product && $product->get_meta( '_dtb_exclude_from_points' ) === 'yes' ) {
			$earn_basis -= (float) $item->get_subtotal();
		}
	}

	$earn_basis = max( 0.0, $earn_basis );
	$points     = (int) floor( $earn_basis / 2 ); // 1 pt per $2

	if ( $points <= 0 ) {
		return;
	}

	try {
		\WLR\Plugin\Helpers\App::addPoints(
			$user_email,
			$points,
			'purchase',
			sprintf( 'Order #%d — $%.2f eligible subtotal → %d pts (1pt/$2)', $order_id, $earn_basis, $points )
		);

		$order->update_meta_data( '_dtb_rewards_awarded', true );
		$order->update_meta_data( '_dtb_rewards_points', $points );
		$order->save_meta_data();
	} catch ( \Throwable $e ) {
		error_log( '[DTB Rewards] Award failed for order ' . $order_id . ': ' . $e->getMessage() );
	}
}

/**
 * Reverse points when an order is refunded or cancelled.
 * Only reverses if points were actually awarded for this order.
 *
 * @param int $order_id
 */
add_action( 'woocommerce_order_status_refunded', 'dtb_rewards_reverse_points', 10 );
add_action( 'woocommerce_order_status_cancelled', 'dtb_rewards_reverse_points', 10 );
function dtb_rewards_reverse_points( int $order_id ): void {
	if ( ! class_exists( 'WLR\Plugin\Helpers\App' ) ) {
		return;
	}

	$order = wc_get_order( $order_id );
	if ( ! $order ) {
		return;
	}

	$awarded = (int) $order->get_meta( '_dtb_rewards_points' );
	if ( $awarded <= 0 || $order->get_meta( '_dtb_rewards_reversed' ) ) {
		return;
	}

	$user_id    = (int) $order->get_user_id();
	$user_email = dtb_wlr_get_user_email( $user_id );
	if ( ! $user_email ) {
		return;
	}

	try {
		\WLR\Plugin\Helpers\App::deductPoints(
			$user_email,
			$awarded,
			'refund',
			sprintf( 'Points reversed for refunded/cancelled Order #%d (−%d pts)', $order_id, $awarded )
		);
		$order->update_meta_data( '_dtb_rewards_reversed', true );
		$order->save_meta_data();
	} catch ( \Throwable $e ) {
		error_log( '[DTB Rewards] Reversal failed for order ' . $order_id . ': ' . $e->getMessage() );
	}
}

// =============================================================================
// ROUTE REGISTRATION
// Register after WPLoyalty has had a chance to load (priority 10 is fine as
// WPLoyalty loads its classes on plugins_loaded before rest_api_init fires).
// =============================================================================

if ( dtb_is_rest_api_request() ) {
	add_action( 'rest_api_init', 'dtb_rewards_register_routes', 10 );
}

function dtb_rewards_register_routes(): void {

	$ns = 'dtb/v1';

	// ── GET /dtb/v1/rewards/balance/{id} ─────────────────────────────────────
	register_rest_route( $ns, '/rewards/balance/(?P<id>\d+)', [
		'methods'             => 'GET',
		'callback'            => 'dtb_rewards_get_balance',
		'permission_callback' => 'dtb_jwt_permission',
		'args'                => [
			'id' => [ 'validate_callback' => 'is_numeric' ],
		],
	] );

	// ── GET /dtb/v1/rewards/history/{id} ─────────────────────────────────────
	register_rest_route( $ns, '/rewards/history/(?P<id>\d+)', [
		'methods'             => 'GET',
		'callback'            => 'dtb_rewards_get_history',
		'permission_callback' => 'dtb_jwt_permission',
		'args'                => [
			'id'     => [ 'validate_callback' => 'is_numeric' ],
			'limit'  => [ 'default' => 20, 'validate_callback' => 'is_numeric' ],
			'offset' => [ 'default' => 0,  'validate_callback' => 'is_numeric' ],
		],
	] );

	// ── POST /dtb/v1/rewards/redeem ──────────────────────────────────────────
	register_rest_route( $ns, '/rewards/redeem', [
		'methods'             => 'POST',
		'callback'            => 'dtb_rewards_redeem',
		'permission_callback' => 'dtb_jwt_permission',
	] );

	// ── POST /dtb/v1/rewards/admin/adjust ────────────────────────────────────
	register_rest_route( $ns, '/rewards/admin/adjust', [
		'methods'             => 'POST',
		'callback'            => 'dtb_rewards_admin_adjust',
		'permission_callback' => 'dtb_rewards_admin_permission',
	] );
}

// =============================================================================
// PERMISSION CALLBACKS
// =============================================================================

/**
 * Admin-only permission: valid DTB JWT + manage_woocommerce capability.
 * Decodes the JWT to get the WP user_id, then checks their role.
 *
 * @param WP_REST_Request $request
 * @return true|WP_Error
 */
function dtb_rewards_admin_permission( WP_REST_Request $request ) {
	$jwt_check = dtb_jwt_permission( $request );
	if ( is_wp_error( $jwt_check ) ) {
		return $jwt_check;
	}

	// Re-read token to extract user_id from payload.
	$token = null;
	if ( ! empty( $_COOKIE['dtb_auth'] ) ) {
		$token = sanitize_text_field( wp_unslash( $_COOKIE['dtb_auth'] ) );
	} else {
		$auth = $request->get_header( 'authorization' );
		if ( $auth && preg_match( '/^Bearer\s+(\S+)$/i', $auth, $m ) ) {
			$token = $m[1];
		}
	}

	$payload = dtb_verify_jwt( (string) $token );
	if ( is_wp_error( $payload ) ) {
		return $payload;
	}

	$user = get_user_by( 'id', (int) $payload->sub );
	if ( ! $user || ! user_can( $user, 'manage_woocommerce' ) ) {
		return new WP_Error( 'forbidden', 'Shop admin access required.', [ 'status' => 403 ] );
	}

	return true;
}

// =============================================================================
// ROUTE CALLBACKS
// =============================================================================

/**
 * GET /dtb/v1/rewards/balance/{id}
 *
 * Returns the user's point balance, lifetime earned, lifetime redeemed,
 * and current USD-equivalent value.
 *
 * @param WP_REST_Request $request
 * @return WP_REST_Response|WP_Error
 */
function dtb_rewards_get_balance( WP_REST_Request $request ) {
	$user_id = (int) $request['id'];

	// WPLoyalty not yet installed — return a zero-balance stub so the
	// dashboard renders instead of crashing.
	if ( ! class_exists( 'WLR\Plugin\Helpers\App' ) ) {
		return rest_ensure_response( [
			'user_id'          => $user_id,
			'points'           => 0,
			'points_earned'    => 0,
			'points_redeemed'  => 0,
			'points_value_usd' => 0.00,
			'_note'            => 'Rewards program not yet configured.',
		] );
	}

	$data = dtb_wlr_get_user_points( $user_id );

	if ( is_wp_error( $data ) ) {
		return $data;
	}

	return rest_ensure_response( [
		'user_id'          => $user_id,
		'points'           => $data['balance'],
		'points_earned'    => $data['earned'],
		'points_redeemed'  => $data['redeemed'],
		'points_value_usd' => round( $data['balance'] * 0.05, 2 ), // 100 pts = $5.00
	] );
}

/**
 * GET /dtb/v1/rewards/history/{id}?limit=20&offset=0
 *
 * Returns paginated transaction history for the user.
 *
 * @param WP_REST_Request $request
 * @return WP_REST_Response|WP_Error
 */
function dtb_rewards_get_history( WP_REST_Request $request ) {
	$user_id = (int) $request['id'];
	$limit   = max( 1, min( 100, (int) $request['limit'] ) );
	$offset  = max( 0, (int) $request['offset'] );

	// WPLoyalty not yet installed — return an empty history stub.
	if ( ! class_exists( 'WLR\Plugin\Helpers\App' ) ) {
		return rest_ensure_response( [
			'user_id' => $user_id,
			'total'   => 0,
			'events'  => [],
			'_note'   => 'Rewards program not yet configured.',
		] );
	}

	$result = dtb_wlr_get_history( $user_id, $limit, $offset );

	if ( is_wp_error( $result ) ) {
		return $result;
	}

	return rest_ensure_response( $result );
}

/**
 * POST /dtb/v1/rewards/redeem
 * Body: { user_id: int, points_to_redeem: int }
 *
 * Validates the request, calls the WPLoyalty helper to deduct points
 * and create a WooCommerce coupon, then returns the coupon code to the SPA.
 *
 * @param WP_REST_Request $request
 * @return WP_REST_Response|WP_Error
 */
function dtb_rewards_redeem( WP_REST_Request $request ) {
	if ( ! class_exists( 'WLR\Plugin\Helpers\App' ) ) {
		return new WP_Error( 'not_configured', 'Rewards program not yet configured.', [ 'status' => 503 ] );
	}

	$params           = $request->get_json_params();
	$user_id          = (int) ( $params['user_id'] ?? 0 );
	$points_to_redeem = (int) ( $params['points_to_redeem'] ?? 0 );

	if ( ! $user_id || $points_to_redeem <= 0 ) {
		return new WP_Error( 'invalid_params', 'user_id and points_to_redeem are required.', [ 'status' => 400 ] );
	}

	// Minimum redemption threshold: 100 points = $5.00
	if ( $points_to_redeem < 100 ) {
		return new WP_Error( 'below_minimum', 'Minimum redemption is 100 points ($5.00).', [ 'status' => 400 ] );
	}

	// Must be a multiple of 100.
	if ( $points_to_redeem % 100 !== 0 ) {
		return new WP_Error( 'invalid_increment', 'Points must be redeemed in multiples of 100.', [ 'status' => 400 ] );
	}

	// Maximum redemption per order: 5,000 points = $250.00
	if ( $points_to_redeem > 5000 ) {
		return new WP_Error( 'above_maximum', 'Maximum redemption per order is 5,000 points ($250.00).', [ 'status' => 400 ] );
	}

	// Rate limit: 5 redemption requests per user per hour.
	$rate_key = 'dtb_redeem_user_' . $user_id;
	$attempts = (int) get_transient( $rate_key );
	if ( $attempts >= 5 ) {
		return new WP_Error( 'rate_limited', 'Too many redemption attempts. Please wait before trying again.', [ 'status' => 429 ] );
	}
	set_transient( $rate_key, $attempts + 1, HOUR_IN_SECONDS );

	$result = dtb_wlr_redeem_points( $user_id, $points_to_redeem );

	if ( is_wp_error( $result ) ) {
		return $result;
	}

	return rest_ensure_response( $result );
}

/**
 * POST /dtb/v1/rewards/admin/adjust
 * Body: { user_id: int, points_delta: int, reason: string }
 *
 * Admin-only. Adds (positive delta) or deducts (negative delta) points
 * from a user and logs the reason in WPLoyalty's activity ledger.
 *
 * @param WP_REST_Request $request
 * @return WP_REST_Response|WP_Error
 */
function dtb_rewards_admin_adjust( WP_REST_Request $request ) {
	if ( ! class_exists( 'WLR\Plugin\Helpers\App' ) ) {
		return new WP_Error( 'not_configured', 'Rewards program not yet configured.', [ 'status' => 503 ] );
	}

	$params       = $request->get_json_params();
	$user_id      = (int) ( $params['user_id'] ?? 0 );
	$points_delta = (int) ( $params['points_delta'] ?? 0 );
	$reason       = sanitize_text_field( $params['reason'] ?? 'Manual admin adjustment' );

	if ( ! $user_id || $points_delta === 0 ) {
		return new WP_Error( 'invalid_params', 'user_id and non-zero points_delta are required.', [ 'status' => 400 ] );
	}

	$result = dtb_wlr_adjust_points( $user_id, $points_delta, $reason );

	if ( is_wp_error( $result ) ) {
		return $result;
	}

	return rest_ensure_response( $result );
}

// =============================================================================
// WPLOYALTY ADAPTER FUNCTIONS
//
// All WPLoyalty internals are isolated here. If WPLoyalty ever changes its
// class/method names, only this section needs updating.
// =============================================================================

/**
 * Get a user's point balance and lifetime totals from WPLoyalty.
 *
 * @param int $user_id
 * @return array|WP_Error { balance: int, earned: int, redeemed: int }
 */
function dtb_wlr_get_user_points( int $user_id ): array|WP_Error {
	if ( ! get_user_by( 'id', $user_id ) ) {
		return new WP_Error( 'user_not_found', 'User not found.', [ 'status' => 404 ] );
	}

	try {
		$pts = \WLR\Plugin\Helpers\App::getUserPoints( $user_id );

		return [
			'balance'  => isset( $pts->points )       ? (int) $pts->points       : 0,
			'earned'   => isset( $pts->earn_total )   ? (int) $pts->earn_total   : 0,
			'redeemed' => isset( $pts->redeem_total ) ? (int) $pts->redeem_total : 0,
		];
	} catch ( \Throwable $e ) {
		return new WP_Error( 'wlr_error', 'Could not fetch points data.', [ 'status' => 500 ] );
	}
}

/**
 * Get paginated transaction history for a user from WPLoyalty's activity table.
 *
 * WPLoyalty stores history in {prefix}wlr_reward_activity, keyed by user_email.
 *
 * @param int $user_id
 * @param int $limit
 * @param int $offset
 * @return array|WP_Error { user_id, events, total, limit, offset }
 */
function dtb_wlr_get_history( int $user_id, int $limit, int $offset ): array|WP_Error {
	$user_email = dtb_wlr_get_user_email( $user_id );
	if ( ! $user_email ) {
		return new WP_Error( 'user_not_found', 'User not found.', [ 'status' => 404 ] );
	}

	global $wpdb;

	$table = $wpdb->prefix . 'wlr_reward_activity';

	// phpcs:disable WordPress.DB.PreparedSQL.InterpolatedNotPrepared
	$total = (int) $wpdb->get_var(
		$wpdb->prepare( "SELECT COUNT(*) FROM {$table} WHERE user_email = %s", $user_email )
	);

	$rows = $wpdb->get_results(
		$wpdb->prepare(
			"SELECT action_type, points, note, created_at
			 FROM {$table}
			 WHERE user_email = %s
			 ORDER BY id DESC
			 LIMIT %d OFFSET %d",
			$user_email,
			$limit,
			$offset
		),
		ARRAY_A
	);
	// phpcs:enable WordPress.DB.PreparedSQL.InterpolatedNotPrepared

	$events = array_map( static function ( array $row ): array {
		return [
			'event'  => $row['action_type'] ?? 'unknown',
			'points' => (int) ( $row['points'] ?? 0 ),
			'note'   => $row['note'] ?? '',
			'date'   => $row['created_at'] ?? '',
		];
	}, $rows ?: [] );

	return [
		'user_id' => $user_id,
		'events'  => $events,
		'total'   => $total,
		'limit'   => $limit,
		'offset'  => $offset,
	];
}

/**
 * Redeem points for a WooCommerce coupon code via WPLoyalty.
 *
 * Creates a fixed-cart coupon, then asks WPLoyalty to deduct the points
 * from the user's ledger and record the transaction in its activity table.
 *
 * @param int $user_id
 * @param int $points_to_redeem
 * @return array|WP_Error { success, coupon_code, discount_amount, new_balance }
 */
function dtb_wlr_redeem_points( int $user_id, int $points_to_redeem ): array|WP_Error {
	$user_data = dtb_wlr_get_user_points( $user_id );
	if ( is_wp_error( $user_data ) ) {
		return $user_data;
	}

	if ( $user_data['balance'] < $points_to_redeem ) {
		return new WP_Error(
			'insufficient_points',
			sprintf( 'You have %d points but tried to redeem %d.', $user_data['balance'], $points_to_redeem ),
			[ 'status' => 400 ]
		);
	}

	// 100 points = $5.00 discount  (POINTS_REDEEM_VALUE = 0.05 USD/pt)
	$discount_amount = round( $points_to_redeem * 0.05, 2 );

	// Collision-resistant coupon code: DTB- + 8 hex chars
	$coupon_code = 'DTB-' . strtoupper( substr( md5( $user_id . $points_to_redeem . microtime() ), 0, 8 ) );

	try {
		// Build and save the WooCommerce coupon.
		$coupon = new WC_Coupon();
		$coupon->set_code( $coupon_code );
		$coupon->set_discount_type( 'fixed_cart' );
		$coupon->set_amount( $discount_amount );
		$coupon->set_usage_limit( 1 );
		$coupon->set_usage_limit_per_user( 1 );
		$coupon->set_individual_use( true );
		$coupon->set_date_expires( strtotime( '+7 days' ) );

		// Restrict coupon to this user's email — prevents sharing.
		$user = get_user_by( 'id', $user_id );
		if ( $user ) {
			$coupon->set_email_restrictions( [ $user->user_email ] );
		}

		$coupon->save();

		// Tell WPLoyalty to deduct the points and log the transaction.
		\WLR\Plugin\Helpers\App::deductPoints(
			dtb_wlr_get_user_email( $user_id ),
			$points_to_redeem,
			'redeem',
			sprintf( 'Redeemed %d pts → coupon %s (−$%.2f)', $points_to_redeem, $coupon_code, $discount_amount )
		);

		return [
			'success'         => true,
			'coupon_code'     => $coupon_code,
			'discount_amount' => $discount_amount,
			'new_balance'     => $user_data['balance'] - $points_to_redeem,
		];
	} catch ( \Throwable $e ) {
		return new WP_Error( 'redemption_failed', 'Redemption failed: ' . $e->getMessage(), [ 'status' => 500 ] );
	}
}

/**
 * Admin helper: manually add or deduct points from a user.
 *
 * @param int    $user_id
 * @param int    $points_delta  Positive = award, Negative = deduct
 * @param string $reason        Admin note recorded in WPLoyalty activity log
 * @return array|WP_Error { success, adjusted, new_balance, reason }
 */
function dtb_wlr_adjust_points( int $user_id, int $points_delta, string $reason ): array|WP_Error {
	$user_data = dtb_wlr_get_user_points( $user_id );
	if ( is_wp_error( $user_data ) ) {
		return $user_data;
	}

	if ( $points_delta < 0 && $user_data['balance'] < abs( $points_delta ) ) {
		return new WP_Error(
			'insufficient_points',
			sprintf( 'Cannot deduct %d points; user only has %d.', abs( $points_delta ), $user_data['balance'] ),
			[ 'status' => 400 ]
		);
	}

	try {
		$user_email = dtb_wlr_get_user_email( $user_id );

		if ( $points_delta > 0 ) {
			\WLR\Plugin\Helpers\App::addPoints( $user_email, $points_delta, 'credit', $reason );
		} else {
			\WLR\Plugin\Helpers\App::deductPoints( $user_email, abs( $points_delta ), 'debit', $reason );
		}

		$new_data = dtb_wlr_get_user_points( $user_id );

		return [
			'success'     => true,
			'adjusted'    => $points_delta,
			'new_balance' => is_wp_error( $new_data ) ? null : $new_data['balance'],
			'reason'      => $reason,
		];
	} catch ( \Throwable $e ) {
		return new WP_Error( 'adjust_failed', 'Adjustment failed: ' . $e->getMessage(), [ 'status' => 500 ] );
	}
}

// ─── Utility ─────────────────────────────────────────────────────────────────

/**
 * Get a WordPress user's email address by user ID.
 * WPLoyalty keys its activity table by user_email, not user_id.
 *
 * @param int $user_id
 * @return string  Email address, or empty string if the user does not exist.
 */
function dtb_wlr_get_user_email( int $user_id ): string {
	$user = get_user_by( 'id', $user_id );
	return $user ? $user->user_email : '';
}

// =============================================================================
// OPS DASHBOARD ANALYTICS HELPERS
// =============================================================================

/**
 * Calculate the total unredeemed rewards liability in USD.
 *
 * Returns the monetary value of all unredeemed points across all users
 * at the platform redemption rate of $0.05 per point (100 pts = $5.00).
 *
 * @return float Total liability in USD, rounded to 2 decimal places.
 */
function dtb_rewards_get_total_liability(): float {
	$cached = get_transient( 'dtb_rewards_total_liability' );
	if ( false !== $cached ) {
		return (float) $cached;
	}

	if ( ! class_exists( 'WLR\Plugin\Helpers\App' ) ) {
		return 0.0;
	}

	global $wpdb;

	$points_per_dollar = DTB_REWARDS_POINTS_PER_DOLLAR;
	// phpcs:ignore WordPress.DB.DirectDatabaseQuery
	$total_points = (int) $wpdb->get_var(
		"SELECT COALESCE(SUM(points), 0) FROM {$wpdb->prefix}wlr_reward_points WHERE points > 0"
	);

	$liability = round( $total_points / $points_per_dollar, 2 );

	set_transient( 'dtb_rewards_total_liability', $liability, 15 * MINUTE_IN_SECONDS );

	return $liability;
}

/**
 * Return recent reward redemptions.
 *
 * @param int $limit Maximum number of records to return (default 25).
 * @return array[] Each element: { user_id, email, points, redeemed_at, coupon_code }
 */
function dtb_rewards_get_recent_redemptions( int $limit = 25 ): array {
	$limit = min( max( 1, $limit ), 100 );

	if ( ! class_exists( 'WLR\Plugin\Helpers\App' ) ) {
		return [];
	}

	global $wpdb;

	// phpcs:ignore WordPress.DB.DirectDatabaseQuery, WordPress.DB.PreparedSQL.InterpolatedNotPrepared
	$rows = $wpdb->get_results(
		$wpdb->prepare(
			"SELECT user_email, points, created_at, action_type, note
			 FROM {$wpdb->prefix}wlr_reward_points
			 WHERE action_type IN ('redeem','coupon')
			 ORDER BY id DESC
			 LIMIT %d",
			$limit
		),
		ARRAY_A
	);

	if ( ! is_array( $rows ) ) {
		return [];
	}

	$results = [];
	foreach ( $rows as $row ) {
		$user      = get_user_by( 'email', $row['user_email'] );
		$results[] = [
			'user_id'     => $user ? $user->ID : 0,
			'email'       => $row['user_email'],
			'points'      => (int) $row['points'],
			'redeemed_at' => $row['created_at'],
			'note'        => $row['note'] ?? '',
		];
	}

	return $results;
}
