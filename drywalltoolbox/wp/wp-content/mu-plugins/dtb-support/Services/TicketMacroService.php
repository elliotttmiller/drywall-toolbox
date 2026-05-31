<?php
/**
 * Services — TicketMacroService: macro rendering and default macro seeding.
 *
 * @package drywall-toolbox
 */

defined( 'ABSPATH' ) || exit;

/**
 * Return the macros table name.
 */
function dtb_support_macros_table(): string {
	global $wpdb;
	return $wpdb->prefix . 'dtb_support_macros';
}

/**
 * Return all active macros ordered by sort_order.
 *
 * @return object[]
 */
function dtb_support_get_macros(): array {
	global $wpdb;
	$table = dtb_support_macros_table();
	// phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
	$rows  = $wpdb->get_results( "SELECT * FROM {$table} WHERE is_active = 1 ORDER BY sort_order ASC, macro_name ASC" );
	return $rows ?: [];
}

/**
 * Return a single macro by ID, or null.
 */
function dtb_support_get_macro( int $macro_id ): ?object {
	global $wpdb;
	$table = dtb_support_macros_table();
	// phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
	return $wpdb->get_row( $wpdb->prepare( "SELECT * FROM {$table} WHERE id = %d LIMIT 1", $macro_id ) );
}

/**
 * Render a macro template, interpolating variables from ticket/order context.
 */
function dtb_support_render_macro( string $template, object $ticket ): string {
	$replacements = [
		'{{customer_name}}' => (string) ( $ticket->customer_name ?? '' ),
		'{{ticket_number}}' => (string) ( $ticket->ticket_number ?? '' ),
		'{{order_id}}'      => ! empty( $ticket->order_id ) ? (string) $ticket->order_id : '',
		'{{support_email}}' => function_exists( 'dtb_support_email_from' ) ? dtb_support_email_from() : (string) get_option( 'admin_email', '' ),
		'{{site_name}}'     => (string) get_bloginfo( 'name' ),
		'{{ticket_url}}'    => admin_url( 'admin.php?page=dtb-support&ticket_id=' . (int) ( $ticket->id ?? 0 ) ),
	];

	return strtr( $template, $replacements );
}

/**
 * Create or update a macro.
 *
 * @param array $data Fields: macro_name, category, subject_template, body_template, is_active, sort_order.
 * @param int   $macro_id 0 for new, >0 for update.
 * @return int|WP_Error
 */
function dtb_support_save_macro( array $data, int $macro_id = 0 ): int|WP_Error {
	global $wpdb;
	$table = dtb_support_macros_table();
	$now   = gmdate( 'Y-m-d H:i:s' );
	$existing = $macro_id > 0 ? dtb_support_get_macro( $macro_id ) : null;

	$macro_name = sanitize_text_field( $data['macro_name'] ?? ( $existing->macro_name ?? '' ) );
	$body       = wp_kses_post( $data['body_template'] ?? ( $existing->body_template ?? '' ) );
	if ( '' === $macro_name || '' === trim( wp_strip_all_tags( $body ) ) ) {
		return new WP_Error( 'dtb_support_invalid_macro', __( 'Macro name and body template are required.', 'drywall-toolbox' ), [ 'status' => 400 ] );
	}

	$subject_template = sanitize_text_field( $data['subject_template'] ?? ( $existing->subject_template ?? '' ) );
	preg_match_all( '/\{\{\s*([a-z0-9_]+)\s*\}\}/i', $subject_template . "\n" . $body, $matches );
	$variables = array_values( array_unique( array_map( 'strtolower', $matches[1] ?? [] ) ) );

	$row = [
		'macro_name'       => $macro_name,
		'category'         => sanitize_text_field( $data['category'] ?? ( $existing->category ?? 'general' ) ),
		'subject_template' => $subject_template,
		'body_template'    => $body,
		'variables'        => wp_json_encode( $variables ),
		'is_active'        => isset( $data['is_active'] ) ? (int) (bool) $data['is_active'] : ( isset( $existing->is_active ) ? (int) $existing->is_active : 1 ),
		'sort_order'       => isset( $data['sort_order'] ) ? (int) $data['sort_order'] : ( isset( $existing->sort_order ) ? (int) $existing->sort_order : 0 ),
		'updated_at'       => $now,
	];

	if ( $macro_id > 0 ) {
		$result = $wpdb->update( $table, $row, [ 'id' => $macro_id ] );
		if ( false === $result ) {
			return new WP_Error( 'dtb_support_macro_save_failed', __( 'Could not update macro.', 'drywall-toolbox' ) );
		}
		return $macro_id;
	}

	$row['created_by'] = get_current_user_id() ?: null;
	$row['created_at'] = $now;
	$result            = $wpdb->insert( $table, $row );
	if ( false === $result ) {
		return new WP_Error( 'dtb_support_macro_save_failed', __( 'Could not create macro.', 'drywall-toolbox' ) );
	}

	return (int) $wpdb->insert_id;
}

/**
 * Deactivate a macro.
 */
function dtb_support_delete_macro( int $macro_id ): bool|WP_Error {
	global $wpdb;
	$table = dtb_support_macros_table();

	if ( ! dtb_support_get_macro( $macro_id ) ) {
		return new WP_Error( 'dtb_support_not_found', __( 'Macro not found.', 'drywall-toolbox' ) );
	}

	$result = $wpdb->update(
		$table,
		[
			'is_active'  => 0,
			'updated_at' => gmdate( 'Y-m-d H:i:s' ),
		],
		[ 'id' => $macro_id ]
	);

	if ( false === $result ) {
		return new WP_Error( 'dtb_support_macro_delete_failed', __( 'Could not delete macro.', 'drywall-toolbox' ) );
	}

	return true;
}

/**
 * Seed default macros on first install.
 */
function dtb_support_seed_default_macros(): void {
	if ( get_option( 'dtb_support_macros_seeded', false ) ) {
		return;
	}

	$defaults = [
		[ 'shipping', 'Shipping Delay Update', 'Update on your order {{ticket_number}}', "Hi {{customer_name}},\n\nWe wanted to share a quick shipping update for ticket {{ticket_number}}. Your order {{order_id}} is still in transit, and we are actively monitoring it for you.\n\nYou can also review the latest details here: {{ticket_url}}\n\nThank you,\n{{site_name}} Support" ],
		[ 'shipping', 'Order Tracking Update', 'Tracking update for order {{order_id}}', "Hi {{customer_name}},\n\nHere is the latest tracking update associated with ticket {{ticket_number}} and order {{order_id}}. If you need anything else, reply here and our team will help.\n\n{{ticket_url}}\n\nRegards,\n{{site_name}} Support" ],
		[ 'orders', 'Missing Item', 'We are reviewing the missing item report', "Hi {{customer_name}},\n\nThanks for letting us know about the missing item on order {{order_id}}. We are reviewing the shipment details now and will follow up as soon as we have the next step.\n\nTicket: {{ticket_number}}\n{{ticket_url}}\n\n{{site_name}} Support" ],
		[ 'orders', 'Wrong Item Received', 'Help with the wrong item received', "Hi {{customer_name}},\n\nWe are sorry the wrong item arrived with order {{order_id}}. We are reviewing the replacement options and will update ticket {{ticket_number}} shortly.\n\n{{ticket_url}}\n\n{{site_name}} Support" ],
		[ 'orders', 'Order Cancellation', 'Order cancellation request received', "Hi {{customer_name}},\n\nWe received your cancellation request for order {{order_id}} and added it to ticket {{ticket_number}}. Our team will confirm the next steps shortly.\n\n{{ticket_url}}\n\n{{site_name}} Support" ],
		[ 'returns', 'Return Request Instructions', 'Return instructions for order {{order_id}}', "Hi {{customer_name}},\n\nWe have logged your return request under ticket {{ticket_number}}. Please keep the item and packaging available while we confirm the return steps for order {{order_id}}.\n\n{{ticket_url}}\n\n{{site_name}} Support" ],
		[ 'returns', 'Refund Request', 'Refund request update', "Hi {{customer_name}},\n\nYour refund request for order {{order_id}} is being reviewed. We will keep ticket {{ticket_number}} updated as soon as we verify the order status.\n\n{{ticket_url}}\n\n{{site_name}} Support" ],
		[ 'product', 'Damaged Product', 'We are reviewing your damaged product report', "Hi {{customer_name}},\n\nWe are sorry to hear the product arrived damaged. Ticket {{ticket_number}} is now with our support team, and we will review the best replacement or resolution option.\n\n{{ticket_url}}\n\n{{site_name}} Support" ],
		[ 'product', 'Warranty Question', 'Warranty support update', "Hi {{customer_name}},\n\nThanks for contacting {{site_name}} about your warranty question. Ticket {{ticket_number}} is in review and we will follow up with the applicable coverage details.\n\n{{ticket_url}}\n\n{{site_name}} Support" ],
		[ 'product', 'Product Compatibility', 'Compatibility request received', "Hi {{customer_name}},\n\nWe have received your compatibility question and logged it under ticket {{ticket_number}}. We will review the details and respond with guidance shortly.\n\n{{ticket_url}}\n\n{{site_name}} Support" ],
		[ 'general', 'General Follow-up', 'Following up on ticket {{ticket_number}}', "Hi {{customer_name}},\n\nWe are following up on ticket {{ticket_number}} to keep things moving. If you have any additional details to share, reply here and our team will jump back in.\n\n{{ticket_url}}\n\n{{site_name}} Support" ],
		[ 'general', 'Repair Service Status Update', 'Repair service update', "Hi {{customer_name}},\n\nWe wanted to share a quick repair status update for ticket {{ticket_number}}. We are still working through the details and will keep you posted with the next milestone.\n\n{{ticket_url}}\n\n{{site_name}} Support" ],
	];

	$sort = 10;
	foreach ( $defaults as $row ) {
		dtb_support_save_macro( [
			'category'         => $row[0],
			'macro_name'       => $row[1],
			'subject_template' => $row[2],
			'body_template'    => $row[3],
			'is_active'        => 1,
			'sort_order'       => $sort,
		] );
		$sort += 10;
	}

	update_option( 'dtb_support_macros_seeded', 1, false );
}
add_action( 'plugins_loaded', 'dtb_support_seed_default_macros', 20 );
