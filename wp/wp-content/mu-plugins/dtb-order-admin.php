<?php
/**
 * DTB Order Admin — Must-Use Plugin
 *
 * WP-Admin observability for the product-order system:
 *   - Custom columns on the WooCommerce order list
 *   - DTB Order Timeline metabox on order detail
 *   - Integration State metabox (Veeqo, QuickBooks, Rewards, Notifications)
 *   - Operator action AJAX handlers (retry sync, refresh tracking, resend email)
 *
 * All AJAX actions require nonce verification and manage_woocommerce capability.
 *
 * Depends on (loaded before this):
 *   dtb-order-events.php    → dtb_order_get_events(), dtb_order_get_customer_timeline()
 *   dtb-order-workflows.php → dtb_order_build_status_projection()
 *   dtb-order-tracking.php  → dtb_order_build_tracking_projection()
 *   dtb-order-queue.php     → dtb_order_enqueue_job()
 *
 * @package drywall-toolbox
 */

defined( 'ABSPATH' ) || exit;

// =============================================================================
// SECTION 1 — ORDER LIST COLUMNS
// =============================================================================

add_filter( 'manage_woocommerce_page_wc-orders_columns', 'dtb_order_admin_list_columns', 20 );
add_filter( 'manage_edit-shop_order_columns',            'dtb_order_admin_list_columns', 20 );

/**
 * Add DTB custom columns to the WooCommerce order list.
 *
 * @param array $columns
 * @return array
 */
function dtb_order_admin_list_columns( array $columns ): array {
	// Insert after the order-status column.
	$insert_after = 'order-status';
	$new_columns  = [
		'dtb_fulfillment'  => __( 'Fulfillment', 'drywall-toolbox' ),
		'dtb_tracking'     => __( 'Tracking', 'drywall-toolbox' ),
		'dtb_veeqo'        => __( 'Veeqo', 'drywall-toolbox' ),
		'dtb_quickbooks'   => __( 'QuickBooks', 'drywall-toolbox' ),
		'dtb_rewards'      => __( 'Rewards', 'drywall-toolbox' ),
		'dtb_last_event'   => __( 'Last DTB Event', 'drywall-toolbox' ),
	];

	$result = [];
	foreach ( $columns as $key => $label ) {
		$result[ $key ] = $label;
		if ( $key === $insert_after ) {
			foreach ( $new_columns as $nk => $nl ) {
				$result[ $nk ] = $nl;
			}
		}
	}

	return $result;
}

add_action( 'manage_woocommerce_page_wc-orders_custom_column', 'dtb_order_admin_render_list_column', 10, 2 );
add_action( 'manage_shop_order_posts_custom_column',           'dtb_order_admin_render_list_column', 10, 2 );

/**
 * Render DTB custom column values in the WooCommerce order list.
 *
 * @param string        $column
 * @param int|WC_Order  $order_or_id
 */
function dtb_order_admin_render_list_column( string $column, $order_or_id ): void {
	$order_id = $order_or_id instanceof WC_Order ? (int) $order_or_id->get_id() : (int) $order_or_id;

	if ( 0 === $order_id || ! str_starts_with( $column, 'dtb_' ) ) {
		return;
	}

	$int_state = dtb_order_get_integration_state( $order_id );

	switch ( $column ) {
		case 'dtb_fulfillment':
			$substate = dtb_order_get_fulfillment_substate( $order_id );
			$labels   = dtb_order_fulfillment_substates();
			echo '<small class="dtb-col-label">' . esc_html( $labels[ $substate ] ?? ucwords( $substate ) ) . '</small>';
			break;

		case 'dtb_tracking':
			$tracking_num = $int_state['veeqo']['tracking'] ?? null;
			if ( $tracking_num ) {
				echo '<small>' . esc_html( $tracking_num ) . '</small>';
			} else {
				echo '<span class="dtb-na">—</span>';
			}
			break;

		case 'dtb_veeqo':
			$status = $int_state['veeqo']['status'] ?? 'pending';
			dtb_order_admin_render_badge( $status );
			break;

		case 'dtb_quickbooks':
			$status = $int_state['quickbooks']['status'] ?? 'pending';
			dtb_order_admin_render_badge( $status );
			break;

		case 'dtb_rewards':
			$status = $int_state['rewards']['status'] ?? 'pending';
			dtb_order_admin_render_badge( $status );
			break;

		case 'dtb_last_event':
			$last = dtb_order_get_last_event( $order_id );
			if ( $last ) {
				echo '<small>' . esc_html( $last->event_type ) . '<br>'
					. esc_html( human_time_diff( strtotime( $last->created_at ), time() ) )
					. ' ago</small>';
			} else {
				echo '<span class="dtb-na">—</span>';
			}
			break;
	}
}

/**
 * Render a small colored status badge.
 *
 * @param string $status 'pending'|'synced'|'failed'|'issued'|'reversed'
 */
function dtb_order_admin_render_badge( string $status ): void {
	$colors = [
		'pending'  => '#888',
		'synced'   => '#228B22',
		'issued'   => '#228B22',
		'failed'   => '#c00',
		'reversed' => '#E07B00',
	];
	$color = $colors[ $status ] ?? '#888';
	echo '<span style="color:' . esc_attr( $color ) . '; font-weight:600; font-size:11px;">'
		. esc_html( ucfirst( $status ) ) . '</span>';
}

// =============================================================================
// SECTION 2 — ORDER DETAIL METABOXES
// =============================================================================

add_action( 'add_meta_boxes', 'dtb_order_admin_register_metaboxes', 30 );

/**
 * Register DTB metaboxes on the WooCommerce order detail screen.
 */
function dtb_order_admin_register_metaboxes(): void {
	$screens = [ 'shop_order', 'woocommerce_page_wc-orders' ];

	foreach ( $screens as $screen ) {
		add_meta_box(
			'dtb-order-timeline',
			__( 'DTB Order Timeline', 'drywall-toolbox' ),
			'dtb_order_admin_metabox_timeline',
			$screen,
			'normal',
			'high'
		);

		add_meta_box(
			'dtb-integration-state',
			__( 'DTB Integration State', 'drywall-toolbox' ),
			'dtb_order_admin_metabox_integration',
			$screen,
			'side',
			'default'
		);

		add_meta_box(
			'dtb-operator-actions',
			__( 'DTB Operator Actions', 'drywall-toolbox' ),
			'dtb_order_admin_metabox_actions',
			$screen,
			'side',
			'low'
		);
	}
}

/**
 * Render the DTB Order Timeline metabox.
 *
 * @param WP_Post|WC_Order $post_or_order
 */
function dtb_order_admin_metabox_timeline( $post_or_order ): void {
	$order_id = $post_or_order instanceof WC_Order ? (int) $post_or_order->get_id() : (int) $post_or_order->ID;
	$events   = dtb_order_get_events( $order_id, [ 'order' => 'ASC', 'limit' => 200 ] );

	$nonce = wp_create_nonce( 'dtb_order_admin_' . $order_id );
	echo '<input type="hidden" id="dtb-order-nonce" value="' . esc_attr( $nonce ) . '">';
	echo '<input type="hidden" id="dtb-order-id" value="' . esc_attr( (string) $order_id ) . '">';

	if ( empty( $events ) ) {
		echo '<p style="color:#888;">' . esc_html__( 'No events recorded yet.', 'drywall-toolbox' ) . '</p>';
		return;
	}

	$vis_labels = [
		'customer' => '<span style="background:#d1fae5;color:#065f46;padding:1px 6px;border-radius:3px;font-size:10px;">customer</span>',
		'operator' => '<span style="background:#dbeafe;color:#1e3a8a;padding:1px 6px;border-radius:3px;font-size:10px;">operator</span>',
		'internal' => '<span style="background:#f3f4f6;color:#374151;padding:1px 6px;border-radius:3px;font-size:10px;">internal</span>',
	];

	echo '<table style="width:100%;border-collapse:collapse;font-size:13px;">';
	echo '<thead><tr style="border-bottom:1px solid #ddd;">';
	echo '<th style="text-align:left;padding:4px 6px;">' . esc_html__( 'Time (UTC)', 'drywall-toolbox' ) . '</th>';
	echo '<th style="text-align:left;padding:4px 6px;">' . esc_html__( 'Event', 'drywall-toolbox' ) . '</th>';
	echo '<th style="text-align:left;padding:4px 6px;">' . esc_html__( 'Actor', 'drywall-toolbox' ) . '</th>';
	echo '<th style="text-align:left;padding:4px 6px;">' . esc_html__( 'Source', 'drywall-toolbox' ) . '</th>';
	echo '<th style="text-align:left;padding:4px 6px;">' . esc_html__( 'Visibility', 'drywall-toolbox' ) . '</th>';
	echo '</tr></thead><tbody>';

	foreach ( $events as $row ) {
		$vis_badge = $vis_labels[ (string) $row->visibility ] ?? esc_html( (string) $row->visibility );
		echo '<tr style="border-bottom:1px solid #f0f0f0;">';
		echo '<td style="padding:4px 6px;white-space:nowrap;">' . esc_html( (string) $row->created_at ) . '</td>';
		echo '<td style="padding:4px 6px;font-family:monospace;">' . esc_html( (string) $row->event_type ) . '</td>';
		echo '<td style="padding:4px 6px;">' . esc_html( (string) $row->actor_type ) . '</td>';
		echo '<td style="padding:4px 6px;">' . esc_html( (string) $row->source ) . '</td>';
		// phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
		echo '<td style="padding:4px 6px;">' . $vis_badge . '</td>';
		echo '</tr>';
	}

	echo '</tbody></table>';
}

/**
 * Render the DTB Integration State metabox.
 *
 * @param WP_Post|WC_Order $post_or_order
 */
function dtb_order_admin_metabox_integration( $post_or_order ): void {
	$order_id  = $post_or_order instanceof WC_Order ? (int) $post_or_order->get_id() : (int) $post_or_order->ID;
	$int_state = dtb_order_get_integration_state( $order_id );

	$slices = [
		'veeqo'      => __( 'Veeqo Fulfillment', 'drywall-toolbox' ),
		'quickbooks' => __( 'QuickBooks', 'drywall-toolbox' ),
		'rewards'    => __( 'Rewards', 'drywall-toolbox' ),
	];

	foreach ( $slices as $key => $label ) {
		$slice  = $int_state[ $key ] ?? [];
		$status = $slice['status'] ?? 'pending';
		$color  = 'failed' === $status ? '#c00' : ( 'synced' === $status || 'issued' === $status ? '#228B22' : '#888' );
		echo '<strong>' . esc_html( $label ) . ':</strong> ';
		echo '<span style="color:' . esc_attr( $color ) . ';">' . esc_html( ucfirst( $status ) ) . '</span>';
		if ( ! empty( $slice['error'] ) ) {
			echo '<br><small style="color:#c00;">' . esc_html( $slice['error'] ) . '</small>';
		}
		if ( ! empty( $slice['updated_at'] ) ) {
			echo '<br><small style="color:#888;">' . esc_html( $slice['updated_at'] ) . '</small>';
		}
		echo '<br><br>';
	}

	// Tracking preview.
	$tracking = dtb_order_get_tracking_projection( $order_id );
	if ( $tracking && ! empty( $tracking['tracking_number'] ) ) {
		echo '<strong>' . esc_html__( 'Tracking:', 'drywall-toolbox' ) . '</strong> ';
		if ( $tracking['tracking_url'] ) {
			echo '<a href="' . esc_url( $tracking['tracking_url'] ) . '" target="_blank">'
				. esc_html( $tracking['tracking_number'] ) . '</a>';
		} else {
			echo esc_html( $tracking['tracking_number'] );
		}
		echo '<br>';
	}
}

/**
 * Render the DTB Operator Actions metabox.
 *
 * @param WP_Post|WC_Order $post_or_order
 */
function dtb_order_admin_metabox_actions( $post_or_order ): void {
	$order_id = $post_or_order instanceof WC_Order ? (int) $post_or_order->get_id() : (int) $post_or_order->ID;
	$nonce    = wp_create_nonce( 'dtb_order_admin_' . $order_id );

	$actions = [
		'retry_veeqo'       => __( 'Retry Veeqo Sync', 'drywall-toolbox' ),
		'retry_quickbooks'  => __( 'Retry QuickBooks Sync', 'drywall-toolbox' ),
		'refresh_tracking'  => __( 'Refresh Tracking Projection', 'drywall-toolbox' ),
		'resend_confirm'    => __( 'Resend Order Confirmation Email', 'drywall-toolbox' ),
		'resend_shipped'    => __( 'Resend Shipping Email', 'drywall-toolbox' ),
		'recalc_rewards'    => __( 'Recalculate Rewards', 'drywall-toolbox' ),
	];

	echo '<style>.dtb-op-btn{display:block;width:100%;margin:4px 0;padding:5px 8px;font-size:12px;cursor:pointer;}</style>';

	foreach ( $actions as $action => $label ) {
		echo '<button type="button" class="button dtb-op-btn dtb-op-action"'
			. ' data-action="' . esc_attr( $action ) . '"'
			. ' data-order-id="' . esc_attr( (string) $order_id ) . '"'
			. ' data-nonce="' . esc_attr( $nonce ) . '">'
			. esc_html( $label )
			. '</button>';
	}

	echo '<div id="dtb-op-result-' . esc_attr( (string) $order_id ) . '" style="margin-top:8px;font-size:12px;"></div>';

	// Inline JS for AJAX actions.
	?>
	<script>
	(function(){
		document.querySelectorAll('.dtb-op-action').forEach(function(btn){
			btn.addEventListener('click', function(){
				var action  = btn.dataset.action;
				var orderId = btn.dataset.orderId;
				var nonce   = btn.dataset.nonce;
				var result  = document.getElementById('dtb-op-result-' + orderId);
				btn.disabled = true;
				result.textContent = '<?php echo esc_js( __( 'Working…', 'drywall-toolbox' ) ); ?>';

				var formData = new FormData();
				formData.append('action', 'dtb_order_operator_action');
				formData.append('dtb_action', action);
				formData.append('order_id', orderId);
				formData.append('nonce', nonce);

				fetch(window.ajaxurl || '<?php echo esc_url( admin_url( 'admin-ajax.php' ) ); ?>', {
					method: 'POST',
					body:   formData,
					credentials: 'same-origin',
				})
				.then(function(r){ return r.json(); })
				.then(function(d){
					result.style.color = d.success ? '#228B22' : '#c00';
					result.textContent = d.data ? d.data.message : '<?php echo esc_js( __( 'Done.', 'drywall-toolbox' ) ); ?>';
				})
				.catch(function(){
					result.style.color = '#c00';
					result.textContent = '<?php echo esc_js( __( 'Request failed.', 'drywall-toolbox' ) ); ?>';
				})
				.finally(function(){
					btn.disabled = false;
				});
			});
		});
	})();
	</script>
	<?php
}

// =============================================================================
// SECTION 3 — AJAX OPERATOR ACTION HANDLER
// =============================================================================

add_action( 'wp_ajax_dtb_order_operator_action', 'dtb_order_admin_ajax_operator_action' );

/**
 * Handle AJAX operator actions dispatched from the metabox.
 */
function dtb_order_admin_ajax_operator_action(): void {
	if ( ! current_user_can( 'manage_woocommerce' ) ) {
		wp_send_json_error( [ 'message' => __( 'Insufficient permissions.', 'drywall-toolbox' ) ], 403 );
		return;
	}

	$order_id   = (int) ( $_POST['order_id'] ?? 0 );
	$nonce      = sanitize_text_field( (string) ( $_POST['nonce'] ?? '' ) );
	$dtb_action = sanitize_key( (string) ( $_POST['dtb_action'] ?? '' ) );

	if ( ! wp_verify_nonce( $nonce, 'dtb_order_admin_' . $order_id ) ) {
		wp_send_json_error( [ 'message' => __( 'Security check failed.', 'drywall-toolbox' ) ], 403 );
		return;
	}

	if ( $order_id <= 0 ) {
		wp_send_json_error( [ 'message' => __( 'Invalid order ID.', 'drywall-toolbox' ) ] );
		return;
	}

	$order = wc_get_order( $order_id );
	if ( ! $order ) {
		wp_send_json_error( [ 'message' => __( 'Order not found.', 'drywall-toolbox' ) ] );
		return;
	}

	$actor_id = get_current_user_id();

	switch ( $dtb_action ) {
		case 'retry_veeqo':
			dtb_order_enqueue_job( 'dtb_order_sync_veeqo', $order_id );
			dtb_order_append_event( $order_id, 'integration.veeqo.queued', [
				'source'     => 'wp_admin',
				'actor_type' => 'admin',
				'actor_id'   => $actor_id,
				'visibility' => 'operator',
			] );
			wp_send_json_success( [ 'message' => __( 'Veeqo sync re-queued.', 'drywall-toolbox' ) ] );
			break;

		case 'retry_quickbooks':
			dtb_order_enqueue_job( 'dtb_order_sync_quickbooks', $order_id, [ 'action' => 'create' ] );
			dtb_order_append_event( $order_id, 'integration.quickbooks.queued', [
				'source'     => 'wp_admin',
				'actor_type' => 'admin',
				'actor_id'   => $actor_id,
				'visibility' => 'operator',
			] );
			wp_send_json_success( [ 'message' => __( 'QuickBooks sync re-queued.', 'drywall-toolbox' ) ] );
			break;

		case 'refresh_tracking':
			dtb_order_enqueue_job( 'dtb_order_refresh_tracking_projection', $order_id );
			wp_send_json_success( [ 'message' => __( 'Tracking projection refresh queued.', 'drywall-toolbox' ) ] );
			break;

		case 'resend_confirm':
			dtb_order_enqueue_job( 'dtb_order_send_notification', $order_id, [ 'template' => 'order-confirmation' ] );
			wp_send_json_success( [ 'message' => __( 'Order confirmation re-queued.', 'drywall-toolbox' ) ] );
			break;

		case 'resend_shipped':
			dtb_order_enqueue_job( 'dtb_order_send_notification', $order_id, [ 'template' => 'order-shipped' ] );
			wp_send_json_success( [ 'message' => __( 'Shipping email re-queued.', 'drywall-toolbox' ) ] );
			break;

		case 'recalc_rewards':
			dtb_order_enqueue_job( 'dtb_order_issue_rewards', $order_id );
			wp_send_json_success( [ 'message' => __( 'Rewards recalculation queued.', 'drywall-toolbox' ) ] );
			break;

		default:
			wp_send_json_error( [ 'message' => __( 'Unknown action.', 'drywall-toolbox' ) ] );
	}
}
