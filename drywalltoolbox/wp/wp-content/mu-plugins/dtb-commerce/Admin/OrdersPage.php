<?php
/**
 * DTB Commerce — OrdersPage
 *
 * Renders dtb-orders — WooCommerce order queue with filters and drawer detail.
 *
 * @package drywall-toolbox
 */

defined( 'ABSPATH' ) || exit;

function dtb_orders_render_page(): void {
	if ( ! current_user_can( 'dtb_manage_orders' ) ) {
		dtb_admin_shell_access_denied();
		return;
	}

	// Filters from querystring.
	$status  = sanitize_key( $_GET['status'] ?? '' );   // phpcs:ignore WordPress.Security.NonceVerification.Recommended
	$status_tab = sanitize_key( $_GET['tab'] ?? '' );   // phpcs:ignore WordPress.Security.NonceVerification.Recommended
	// Normalize 'all' (emitted by live tabs) to empty string for WC query.
	if ( 'all' === $status )     $status = '';
	if ( 'all' === $status_tab ) $status_tab = '';
	if ( '' === $status && '' !== $status_tab ) {
		$status = $status_tab;
	}
	$status = function_exists( 'dtb_orders_admin_normalize_filter' ) ? dtb_orders_admin_normalize_filter( $status ) : $status;
	$search  = sanitize_text_field( $_GET['s'] ?? '' ); // phpcs:ignore WordPress.Security.NonceVerification.Recommended
	$live_search = sanitize_text_field( $_GET['search'] ?? '' ); // phpcs:ignore WordPress.Security.NonceVerification.Recommended
	if ( '' === $search && '' !== $live_search ) {
		$search = $live_search;
	}
	$paged   = max( 1, (int) ( $_GET['paged'] ?? 1 ) ); // phpcs:ignore WordPress.Security.NonceVerification.Recommended
	$per     = (int) get_option( 'dtb_admin_items_per_page', 25 );
	$base    = admin_url( 'admin.php?page=dtb-orders' );
	$kpi_attention  = dtb_orders_admin_count( 'attention' );
	$kpi_processing = dtb_orders_admin_count( 'processing' );
	$kpi_on_hold    = dtb_orders_admin_count( 'on-hold' );
	$kpi_pending    = dtb_orders_admin_count( 'pending' );
	$kpi_failed     = dtb_orders_admin_count( 'failed' );
	$kpi_total      = dtb_orders_admin_count();

	$status_tabs = [
		[ 'id' => 'all',        'label' => __( 'All', 'drywall-toolbox' ),              'active' => $status === '' || $status === 'all', 'url' => $base ],
		[ 'id' => 'attention',  'label' => __( 'Needs Attention', 'drywall-toolbox' ),  'active' => $status === 'attention', 'url' => add_query_arg( 'status', 'attention', $base ), 'count' => $kpi_attention ],
		[ 'id' => 'on-hold',    'label' => __( 'On Hold', 'drywall-toolbox' ),          'active' => $status === 'on-hold',    'url' => add_query_arg( 'status', 'on-hold', $base ) ],
		[ 'id' => 'processing', 'label' => __( 'Processing', 'drywall-toolbox' ),       'active' => $status === 'processing', 'url' => add_query_arg( 'status', 'processing', $base ) ],
		[ 'id' => 'pending',    'label' => __( 'Pending', 'drywall-toolbox' ),          'active' => $status === 'pending',    'url' => add_query_arg( 'status', 'pending', $base ) ],
		[ 'id' => 'failed',     'label' => __( 'Failed', 'drywall-toolbox' ),           'active' => $status === 'failed',     'url' => add_query_arg( 'status', 'failed', $base ) ],
		[ 'id' => 'completed',  'label' => __( 'Completed', 'drywall-toolbox' ),        'active' => $status === 'completed',  'url' => add_query_arg( 'status', 'completed', $base ) ],
	];

	dtb_admin_shell_open( [
		'title'       => __( 'Orders', 'drywall-toolbox' ),
		'subtitle'    => __( 'Manage WooCommerce orders.', 'drywall-toolbox' ),
		'section'     => 'operations',
		'page'        => 'dtb-orders',
		'template'    => 'queue',
		'icon'        => 'dashicons-cart',
		'tabs'        => $status_tabs,
		'live_target' => 'dtb-orders-workspace',
	] );

	// KPI strip.
	echo '<div class="dtb-kpi-strip">';
	// phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
	echo dtb_admin_ui_kpi( $kpi_total, __( 'Total Orders', 'drywall-toolbox' ), [
		'icon'       => 'dashicons-cart',
		'icon_color' => 'primary',
		'href'       => $base,
		'data'       => [ 'dtb-live-tab' => 'all', 'dtb-live-target' => 'dtb-orders-workspace' ],
	] );
	// phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
	echo dtb_admin_ui_kpi( $kpi_attention, __( 'Needs Attention', 'drywall-toolbox' ), [
		'icon'       => 'dashicons-warning',
		'icon_color' => 'danger',
		'href'       => add_query_arg( 'status', 'attention', $base ),
		'data'       => [ 'dtb-live-tab' => 'attention', 'dtb-live-target' => 'dtb-orders-workspace' ],
	] );
	// phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
	echo dtb_admin_ui_kpi( $kpi_processing, __( 'Processing', 'drywall-toolbox' ), [
		'icon'       => 'dashicons-update',
		'icon_color' => 'info',
		'href'       => add_query_arg( 'status', 'processing', $base ),
		'data'       => [ 'dtb-live-tab' => 'processing', 'dtb-live-target' => 'dtb-orders-workspace' ],
	] );
	// phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
	echo dtb_admin_ui_kpi( $kpi_on_hold, __( 'On Hold', 'drywall-toolbox' ), [
		'icon'       => 'dashicons-pause',
		'icon_color' => 'warning',
		'href'       => add_query_arg( 'status', 'on-hold', $base ),
		'data'       => [ 'dtb-live-tab' => 'on-hold', 'dtb-live-target' => 'dtb-orders-workspace' ],
	] );
	// phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
	echo dtb_admin_ui_kpi( $kpi_pending, __( 'Pending Payment', 'drywall-toolbox' ), [
		'icon'       => 'dashicons-money-alt',
		'icon_color' => 'warning',
		'href'       => add_query_arg( 'status', 'pending', $base ),
		'data'       => [ 'dtb-live-tab' => 'pending', 'dtb-live-target' => 'dtb-orders-workspace' ],
	] );
	// phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
	echo dtb_admin_ui_kpi( $kpi_failed, __( 'Failed', 'drywall-toolbox' ), [
		'icon'       => 'dashicons-dismiss',
		'icon_color' => 'danger',
		'href'       => add_query_arg( 'status', 'failed', $base ),
		'data'       => [ 'dtb-live-tab' => 'failed', 'dtb-live-target' => 'dtb-orders-workspace' ],
	] );
	echo '</div>';
	if ( function_exists( 'dtb_admin_render_module_exception_chips' ) ) {
		echo dtb_admin_render_module_exception_chips( 'orders' ); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
	}

	// Toolbar: live search + filter controls + refresh + new order.
	echo dtb_admin_ui_toolbar_open();
	// phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
	echo dtb_admin_ui_search_input( __( 'Search orders…', 'drywall-toolbox' ), $search, true, 's', 'dtb-orders-workspace' );
	echo dtb_admin_ui_toolbar_spacer();
	// phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
	echo dtb_admin_ui_button( __( 'Refresh', 'drywall-toolbox' ), [
		'type' => 'secondary',
		'icon' => 'dashicons-update',
		'size' => 'sm',
		'data' => [ 'dtb-live-refresh' => 'dtb-orders-workspace' ],
	] );
	// phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
	echo dtb_admin_ui_button( __( 'New Order', 'drywall-toolbox' ), [
		'href' => admin_url( 'post-new.php?post_type=shop_order' ),
		'icon' => 'dashicons-plus-alt2',
		'size' => 'sm',
	] );
	echo dtb_admin_ui_toolbar_close();

	// Query orders.
	$query_args  = dtb_orders_admin_build_query_args( $status, $search, $paged, $per );
	$total_count = dtb_orders_admin_count( $status, $search );
	$total_pages = $per > 0 ? (int) ceil( $total_count / $per ) : 1;

	$orders = wc_get_orders( $query_args );

	// Live region always wraps the data grid (even when empty, so tabs/search survive).
	dtb_admin_shell_live_region_open( [
		'id'       => 'dtb-orders-workspace',
		'module'   => 'orders',
		'endpoint' => rest_url( 'dtb/v1/admin/orders' ),
		'interval' => 30000,
	] );

	if ( empty( $orders ) ) {
		// phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
		echo dtb_admin_ui_empty_state( __( 'No orders found', 'drywall-toolbox' ), __( 'Try adjusting your filters.', 'drywall-toolbox' ) );
		dtb_admin_shell_live_region_close();
		dtb_admin_shell_close();
		return;
	}

	// phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
	echo dtb_admin_ui_update_badge( 'dtb-orders-workspace' );

	// Table.
	echo dtb_admin_ui_table_open( [
		[ 'label' => __( 'Order', 'drywall-toolbox' ),    'key' => 'id' ],
		[ 'label' => __( 'Date', 'drywall-toolbox' ),     'key' => 'date' ],
		[ 'label' => __( 'Customer', 'drywall-toolbox' ), 'key' => 'customer' ],
		[ 'label' => __( 'Status', 'drywall-toolbox' ),   'key' => 'status' ],
		[ 'label' => __( 'Total', 'drywall-toolbox' ),    'key' => 'total' ],
		[ 'label' => '', 'key' => 'actions' ],
	], [ 'class' => 'dtb-orders-table' ] );

	foreach ( $orders as $order ) {
		/** @var WC_Order $order */
		$order_id   = $order->get_id();
		$raw_status = $order->get_status();
		$badge_type = dtb_admin_ui_status_badge_type( $raw_status );
		$status_label = wc_get_order_status_name( $raw_status );

		echo '<tr class="dtb-table__row dtb-table__row--clickable"'
			. ' data-dtb-open-order="' . esc_attr( (string) $order_id ) . '">';
		echo '<td class="dtb-table__cell"><a href="' . esc_url( get_edit_post_link( $order_id ) ) . '">#' . esc_html( $order_id ) . '</a></td>';
		echo '<td class="dtb-table__cell">' . esc_html( $order->get_date_created() ? $order->get_date_created()->date_i18n( get_option( 'date_format' ) ) : '—' ) . '</td>';
		echo '<td class="dtb-table__cell">' . esc_html( $order->get_formatted_billing_full_name() ?: __( 'Guest', 'drywall-toolbox' ) ) . '</td>';
		echo '<td class="dtb-table__cell">' . dtb_admin_ui_badge( esc_html( $status_label ), $badge_type ) . '</td>'; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
		echo '<td class="dtb-table__cell">' . wp_kses_post( $order->get_formatted_order_total() ) . '</td>';
		echo '<td class="dtb-table__cell">';
		// phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
		echo dtb_admin_ui_button( __( 'View', 'drywall-toolbox' ), [
			'href' => '#',
			'size' => 'xs',
			'type' => 'ghost',
			'data' => [ 'dtb-open-order' => $order_id ],
		] );
		echo '</td>';
		echo '</tr>';
	}

	echo dtb_admin_ui_table_close();
	// phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
	echo dtb_admin_ui_pagination( $paged, $total_pages );
	dtb_admin_shell_live_region_close();

	// Shared order detail drawer — lives outside the live region so it survives partial refreshes.
	// phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
	echo dtb_admin_ui_drawer(
		'dtb-orders-detail-drawer',
		__( 'Order', 'drywall-toolbox' ),
		dtb_admin_ui_detail_row( __( 'Order',    'drywall-toolbox' ), '<span data-dtb-target="orderid">—</span>' )
		. dtb_admin_ui_detail_row( __( 'Customer', 'drywall-toolbox' ), '<span data-dtb-target="customer">—</span>' )
		. dtb_admin_ui_detail_row( __( 'Status',   'drywall-toolbox' ), '<span data-dtb-target="status">—</span>' )
		. dtb_admin_ui_detail_row( __( 'Total',    'drywall-toolbox' ), '<span data-dtb-target="total">—</span>' )
		. dtb_admin_ui_detail_row( __( 'Date',     'drywall-toolbox' ), '<span data-dtb-target="date">—</span>' ),
		'<a href="#" class="dtb-btn dtb-btn--sm dtb-orders-detail-view-btn">'
			. esc_html__( 'View Full Order', 'drywall-toolbox' )
		. '</a>'
	);
	?>
	<div id="dtb-orders-modal" class="dtb-modal-overlay" role="dialog" aria-modal="true" aria-hidden="true" aria-labelledby="dtb-orders-modal-title" hidden>
		<div class="dtb-modal dtb-modal--fullscreen">
			<header class="dtb-modal__header">
				<div>
					<h2 id="dtb-orders-modal-title" class="dtb-modal__title"><?php esc_html_e( 'Order', 'drywall-toolbox' ); ?></h2>
					<p class="dtb-modal__meta"><?php esc_html_e( 'Order workbench', 'drywall-toolbox' ); ?></p>
				</div>
				<button type="button" class="dtb-modal__close" aria-label="<?php esc_attr_e( 'Close', 'drywall-toolbox' ); ?>">&times;</button>
			</header>
			<div class="dtb-modal__body"></div>
			<footer class="dtb-modal__footer"></footer>
		</div>
	</div>
	<?php
	// Update the View Full Order href when drawer populates from a row click.
	?>
	<script>
	(function () {
		var d = document.getElementById( 'dtb-orders-detail-drawer' );
		if ( ! d ) return;
		d.addEventListener( 'dtb:drawer:populate', function ( e ) {
			var url = e.detail.rowData.dtbFieldViewurl;
			var btn = d.querySelector( '.dtb-orders-detail-view-btn' );
			if ( btn && url ) btn.href = url;
		} );
	}());
	</script>
	<?php

	dtb_admin_shell_close();
}
