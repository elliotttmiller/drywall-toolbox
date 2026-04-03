<?php
/**
 * Drywall Webhooks — Must-Use Plugin
 *
 * On WordPress init, checks the WooCommerce webhooks table for the four
 * product lifecycle webhooks (created / updated / deleted / restored).
 * Any missing webhook is auto-created using WC_Webhook with:
 *   - status:       active
 *   - delivery URL: https://drywalltoolbox.com/wp-json/drywall/v1/webhooks/products
 *   - secret:       WC_WEBHOOK_SECRET constant from wp-config.php
 *
 * Each auto-created webhook is logged:
 *   [DryWall Toolbox] Webhook created: {topic}
 *
 * @package drywall-toolbox
 */

defined( 'ABSPATH' ) || exit;

add_action( 'init', 'drywall_ensure_webhooks', 20 );

function drywall_ensure_webhooks() {
	// WooCommerce must be active and WC_Webhook must be available.
	if ( ! function_exists( 'wc_get_webhooks' ) || ! class_exists( 'WC_Webhook' ) ) {
		return;
	}

	$secret = defined( 'WC_WEBHOOK_SECRET' ) ? WC_WEBHOOK_SECRET : '';
	if ( '' === $secret ) {
		// Cannot create functional webhooks without a secret — bail silently.
		return;
	}

	$delivery_url = 'https://drywalltoolbox.com/wp-json/drywall/v1/webhooks/products';

	$required_topics = [
		'product.created',
		'product.updated',
		'product.deleted',
		'product.restored',
	];

	// Fetch all existing webhook IDs that target our delivery URL.
	$existing_hooks = wc_get_webhooks( [
		'delivery_url' => $delivery_url,
		'return'       => 'ids',
		'limit'        => -1,
	] );

	// Build a map of topic → true for webhooks already pointing at our URL.
	$registered_topics = [];
	foreach ( $existing_hooks as $hook_id ) {
		$webhook = new WC_Webhook( $hook_id );
		$registered_topics[ $webhook->get_topic() ] = true;
	}

	// Create any missing webhooks.
	foreach ( $required_topics as $topic ) {
		if ( isset( $registered_topics[ $topic ] ) ) {
			continue;
		}

		$webhook = new WC_Webhook();
		$webhook->set_name( 'Drywall Cache Invalidation — ' . $topic );
		$webhook->set_topic( $topic );
		$webhook->set_delivery_url( $delivery_url );
		$webhook->set_secret( $secret );
		$webhook->set_status( 'active' );
		$webhook->save();

		// phpcs:ignore WordPress.PHP.DevelopmentFunctions.error_log_error_log
		error_log( '[DryWall Toolbox] Webhook created: ' . $topic );
	}
}
