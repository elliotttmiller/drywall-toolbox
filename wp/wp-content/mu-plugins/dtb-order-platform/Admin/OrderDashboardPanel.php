<?php
/**
 * DTB Order Dashboard Panel — WP dashboard widget for recent DTB order events.
 *
 * @package drywall-toolbox
 */

defined( 'ABSPATH' ) || exit;

add_action( 'wp_dashboard_setup', 'dtb_order_admin_register_dashboard_widget' );

function dtb_order_admin_register_dashboard_widget(): void {
	wp_add_dashboard_widget(
		'dtb_order_recent_events',
		__( 'Recent DTB Order Events', 'drywall-toolbox' ),
		'dtb_order_admin_dashboard_widget_render'
	);
}

function dtb_order_admin_dashboard_widget_render(): void {
	global $wpdb;

	$table = $wpdb->prefix . 'dtb_order_events';
	// phpcs:ignore WordPress.DB.DirectDatabaseQuery, WordPress.DB.PreparedSQL.InterpolatedNotPrepared
	$events = $wpdb->get_results(
		"SELECT order_id, event_type, actor_type, created_at FROM {$table} ORDER BY id DESC LIMIT 10"
	);

	if ( empty( $events ) ) {
		echo '<p>' . esc_html__( 'No events recorded yet.', 'drywall-toolbox' ) . '</p>';
		return;
	}

	echo '<table style="width:100%;font-size:12px;border-collapse:collapse;">';
	echo '<thead><tr>'
		. '<th style="text-align:left;padding:3px 5px;">' . esc_html__( 'Order', 'drywall-toolbox' ) . '</th>'
		. '<th style="text-align:left;padding:3px 5px;">' . esc_html__( 'Event', 'drywall-toolbox' ) . '</th>'
		. '<th style="text-align:left;padding:3px 5px;">' . esc_html__( 'Time (UTC)', 'drywall-toolbox' ) . '</th>'
		. '</tr></thead><tbody>';

	foreach ( $events as $row ) {
		echo '<tr style="border-top:1px solid #f0f0f0;">'
			. '<td style="padding:3px 5px;">' . esc_html( (string) $row->order_id ) . '</td>'
			. '<td style="padding:3px 5px;font-family:monospace;">' . esc_html( (string) $row->event_type ) . '</td>'
			. '<td style="padding:3px 5px;">' . esc_html( (string) $row->created_at ) . '</td>'
			. '</tr>';
	}

	echo '</tbody></table>';
}
