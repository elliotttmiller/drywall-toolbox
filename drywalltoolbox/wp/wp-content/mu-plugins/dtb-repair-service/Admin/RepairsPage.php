<?php
/**
 * DTB Repair Service — RepairsPage
 *
 * Renders dtb-repairs — repair ticket queue with status tabs and drawer detail.
 *
 * @package drywall-toolbox
 */

defined( 'ABSPATH' ) || exit;

/**
 * Map public queue filters to underlying repair status values.
 *
 * @return array<string, array<int, string>>
 */
function dtb_repairs_status_filter_map(): array {
	return [
		'awaiting_review'         => [ 'submitted', 'reviewed', 'awaiting_customer' ],
		'awaiting_quote_approval' => [ 'approved', 'quoted', 'quote_accepted' ],
		'in_repair'               => [ 'parts_allocated', 'in_progress' ],
		'ready_to_ship'           => [ 'ready_to_ship' ],
		'completed'               => [ 'completed', 'closed' ],
		'cancelled'               => [ 'cancelled', 'quote_declined' ],
	];
}

/**
 * Build a status filter meta_query for repairs pages and REST queue fragments.
 *
 * @param string $status_filter
 * @return array<int|string, mixed>
 */
function dtb_repairs_build_status_meta_query( string $status_filter ): array {
	$map = dtb_repairs_status_filter_map();
	if ( ! isset( $map[ $status_filter ] ) ) {
		return [];
	}

	$values = $map[ $status_filter ];
	if ( 1 === count( $values ) ) {
		return [
			[ 'key' => '_repair_status', 'value' => $values[0] ],
		];
	}

	$query = [ 'relation' => 'OR' ];
	foreach ( $values as $val ) {
		$query[] = [ 'key' => '_repair_status', 'value' => $val ];
	}

	return $query;
}

/**
 * Public summary helper consumed by Command Center.
 *
 * @return array<string, int>
 */
function dtb_repairs_count_by_status(): array {
	$raw = function_exists( 'dtb_repair_admin_get_status_counts' )
		? dtb_repair_admin_get_status_counts()
		: [];

	$sum = static function( array $keys ) use ( $raw ): int {
		$total = 0;
		foreach ( $keys as $key ) {
			$total += (int) ( $raw[ $key ] ?? 0 );
		}
		return $total;
	};

	return [
		'awaiting_review'         => $sum( [ 'submitted', 'reviewed', 'awaiting_customer' ] ),
		'awaiting_quote_approval' => $sum( [ 'approved', 'quoted', 'quote_accepted' ] ),
		'in_repair'               => $sum( [ 'parts_allocated', 'in_progress' ] ),
		'ready_to_ship'           => $sum( [ 'ready_to_ship' ] ),
		'completed'               => $sum( [ 'completed', 'closed' ] ),
		'cancelled'               => $sum( [ 'cancelled', 'quote_declined' ] ),
	];
}

/**
 * Return the canonical public repair queue filters.
 *
 * @return array<string, string>
 */
function dtb_repairs_filter_labels(): array {
	return [
		''                        => __( 'All', 'drywall-toolbox' ),
		'awaiting_review'         => __( 'Awaiting Review', 'drywall-toolbox' ),
		'awaiting_quote_approval' => __( 'Awaiting Quote Approval', 'drywall-toolbox' ),
		'in_repair'               => __( 'In Progress', 'drywall-toolbox' ),
		'ready_to_ship'           => __( 'Ready to Ship', 'drywall-toolbox' ),
		'completed'               => __( 'Completed', 'drywall-toolbox' ),
		'cancelled'               => __( 'Cancelled', 'drywall-toolbox' ),
	];
}

/**
 * Normalize legacy tab aliases to canonical queue filter slugs.
 *
 * @param string $status
 * @return string
 */
function dtb_repairs_normalize_status_filter( string $status ): string {
	$status = sanitize_key( $status );
	$aliases = [
		'all'             => '',
		'awaiting-review' => 'awaiting_review',
		'awaiting-quote'  => 'awaiting_quote_approval',
		'in-progress'     => 'in_repair',
		'ready-to-ship'   => 'ready_to_ship',
	];

	if ( isset( $aliases[ $status ] ) ) {
		$status = $aliases[ $status ];
	}

	return array_key_exists( $status, dtb_repairs_filter_labels() ) ? $status : '';
}

/**
 * Build the queue tabs consumed by the shared Admin shell.
 *
 * @param string $active_status
 * @param string $base_url
 * @return array<int, array<string, mixed>>
 */
function dtb_repairs_build_tabs( string $active_status, string $base_url ): array {
	$tabs = [];
	foreach ( dtb_repairs_filter_labels() as $slug => $label ) {
		$tabs[] = [
			'id'     => $slug ?: 'all',
			'label'  => $label,
			'active' => $active_status === $slug,
			'url'    => $slug ? add_query_arg( 'status', $slug, $base_url ) : $base_url,
		];
	}
	return $tabs;
}

/**
 * Convert an internal repair status to a display label.
 *
 * @param string $status
 * @return string
 */
function dtb_repairs_status_label( string $status ): string {
	return function_exists( 'dtb_get_repair_status_label' )
		? dtb_get_repair_status_label( $status )
		: ucwords( str_replace( '_', ' ', $status ) );
}

/**
 * Map repair statuses to progress-bar width utility classes.
 *
 * @param string $status
 * @return string
 */
function dtb_repairs_progress_class( string $status ): string {
	$map = [
		'submitted'         => 'dtb-progress-pill__bar--15',
		'reviewed'          => 'dtb-progress-pill__bar--25',
		'awaiting_customer' => 'dtb-progress-pill__bar--25',
		'approved'          => 'dtb-progress-pill__bar--40',
		'quoted'            => 'dtb-progress-pill__bar--50',
		'quote_accepted'    => 'dtb-progress-pill__bar--60',
		'parts_allocated'   => 'dtb-progress-pill__bar--70',
		'in_progress'       => 'dtb-progress-pill__bar--80',
		'in_repair'         => 'dtb-progress-pill__bar--80',
		'ready_to_ship'     => 'dtb-progress-pill__bar--92',
		'completed'         => 'dtb-progress-pill__bar--100',
		'closed'            => 'dtb-progress-pill__bar--100',
		'cancelled'         => 'dtb-progress-pill__bar--100',
		'quote_declined'    => 'dtb-progress-pill__bar--100',
	];

	return $map[ $status ] ?? 'dtb-progress-pill__bar--15';
}

/**
 * Render Modernize-style KPI cards for the repairs queue.
 *
 * @param string $active_status
 */
function dtb_repairs_render_summary_cards( string $active_status = '' ): void {
	$counts = dtb_repairs_count_by_status();
	$active_total = (int) ( $counts['awaiting_review'] ?? 0 )
		+ (int) ( $counts['awaiting_quote_approval'] ?? 0 )
		+ (int) ( $counts['in_repair'] ?? 0 )
		+ (int) ( $counts['ready_to_ship'] ?? 0 );
	$base = admin_url( 'admin.php?page=dtb-repairs' );

	$kpis = [
		[
			'value'      => $active_total,
			'label'      => __( 'Active Repairs', 'drywall-toolbox' ),
			'icon'       => 'dashicons-admin-tools',
			'icon_color' => '' === $active_status ? 'primary' : 'neutral',
			'trend'      => __( 'Open workload', 'drywall-toolbox' ),
			'trend_dir'  => 'flat',
			'href'       => $base,
		],
		[
			'value'      => (int) ( $counts['awaiting_review'] ?? 0 ),
			'label'      => __( 'Awaiting Review', 'drywall-toolbox' ),
			'icon'       => 'dashicons-visibility',
			'icon_color' => 'warning',
			'trend'      => __( 'Needs intake', 'drywall-toolbox' ),
			'trend_dir'  => 'flat',
			'href'       => add_query_arg( 'status', 'awaiting_review', $base ),
		],
		[
			'value'      => (int) ( $counts['awaiting_quote_approval'] ?? 0 ),
			'label'      => __( 'Quote Queue', 'drywall-toolbox' ),
			'icon'       => 'dashicons-media-spreadsheet',
			'icon_color' => 'info',
			'trend'      => __( 'Approval flow', 'drywall-toolbox' ),
			'trend_dir'  => 'flat',
			'href'       => add_query_arg( 'status', 'awaiting_quote_approval', $base ),
		],
		[
			'value'      => (int) ( $counts['in_repair'] ?? 0 ),
			'label'      => __( 'In Progress', 'drywall-toolbox' ),
			'icon'       => 'dashicons-hammer',
			'icon_color' => 'primary',
			'trend'      => __( 'Shop floor', 'drywall-toolbox' ),
			'trend_dir'  => 'flat',
			'href'       => add_query_arg( 'status', 'in_repair', $base ),
		],
		[
			'value'      => (int) ( $counts['ready_to_ship'] ?? 0 ),
			'label'      => __( 'Ready to Ship', 'drywall-toolbox' ),
			'icon'       => 'dashicons-archive',
			'icon_color' => 'success',
			'trend'      => __( 'Closeout', 'drywall-toolbox' ),
			'trend_dir'  => 'up',
			'href'       => add_query_arg( 'status', 'ready_to_ship', $base ),
		],
	];

	// phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
	echo dtb_admin_ui_kpi_grid( $kpis );
}

/**
 * Query repairs for the page and REST queue fragment.
 *
 * @param string $status
 * @param string $search
 * @param int    $paged
 * @param int    $per_page
 * @return WP_Query
 */
function dtb_repairs_query( string $status, string $search, int $paged, int $per_page ): WP_Query {
	$meta_query = [];
	if ( $status ) {
		$meta_query = dtb_repairs_build_status_meta_query( $status );
	}

	return new WP_Query( [
		'post_type'      => 'dtb_repair_request',
		'post_status'    => 'publish',
		'posts_per_page' => $per_page,
		'paged'          => max( 1, $paged ),
		's'              => $search,
		'meta_query'     => $meta_query, // phpcs:ignore WordPress.DB.SlowDBQuery
	] );
}

/**
 * Render the queue workspace fragment shared by first paint and live refresh.
 *
 * @param WP_Query $query
 * @param int      $paged
 * @param int      $total_pages
 */
function dtb_repairs_render_queue_workspace( WP_Query $query, int $paged, int $total_pages ): void {
	if ( ! $query->have_posts() ) {
		// phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
		echo dtb_admin_ui_empty_state(
			__( 'No repairs found', 'drywall-toolbox' ),
			__( 'Try adjusting your filters.', 'drywall-toolbox' ),
			[ 'icon' => 'dashicons-hammer' ]
		);
		return;
	}

	// phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
	echo dtb_admin_ui_update_badge( 'dtb-repairs-workspace' );

	// phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
	echo dtb_admin_ui_table_open( [
		[ 'label' => __( 'Repair',      'drywall-toolbox' ), 'key' => 'repair' ],
		[ 'label' => __( 'Customer',    'drywall-toolbox' ), 'key' => 'customer' ],
		[ 'label' => __( 'Workflow',    'drywall-toolbox' ), 'key' => 'workflow' ],
		[ 'label' => __( 'Device',      'drywall-toolbox' ), 'key' => 'device' ],
		[ 'label' => __( 'Age',         'drywall-toolbox' ), 'key' => 'age' ],
		[ 'label' => __( 'Next Action', 'drywall-toolbox' ), 'key' => 'next_action' ],
		[ 'label' => '',                                     'key' => 'actions' ],
	], [] );

	while ( $query->have_posts() ) {
		$query->the_post();
		dtb_repairs_render_queue_row( get_the_ID() );
	}
	wp_reset_postdata();

	// phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
	echo dtb_admin_ui_table_close();
	// phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
	echo dtb_admin_ui_pagination( $paged, $total_pages );
}

/**
 * Render one repair queue table row using shared Modernize-style primitives.
 *
 * @param int $repair_id
 */
function dtb_repairs_render_queue_row( int $repair_id ): void {
	$status      = (string) ( get_post_meta( $repair_id, '_repair_status', true ) ?: 'submitted' );
	$status_lbl  = dtb_repairs_status_label( $status );
	$customer    = (string) ( get_post_meta( $repair_id, '_repair_customer_name', true ) ?: __( 'Unassigned customer', 'drywall-toolbox' ) );
	$email       = (string) get_post_meta( $repair_id, '_repair_customer_email', true );
	$brand       = (string) get_post_meta( $repair_id, '_repair_tool_brand', true );
	$model       = (string) get_post_meta( $repair_id, '_repair_model', true );
	$category    = (string) get_post_meta( $repair_id, '_repair_tool_category', true );
	$device      = trim( implode( ' ', array_filter( [ $brand, $model ] ) ) );
	$device      = '' !== $device ? $device : ( $category ?: get_the_title( $repair_id ) );
	$edit_link   = (string) get_edit_post_link( $repair_id );
	$initial     = strtoupper( substr( trim( wp_strip_all_tags( $customer ) ), 0, 1 ) );
	$initial     = '' !== $initial ? $initial : 'R';
	$created_at  = get_post_field( 'post_date_gmt', $repair_id );
	$badge_type  = dtb_admin_ui_status_badge_type( $status );
	$avatar_type = in_array( $badge_type, [ 'success', 'warning', 'info', 'accent' ], true ) ? $badge_type : 'primary';

	// Derive next action.
	$next_action_map = [
		'submitted'         => [ __( 'Review Intake',   'drywall-toolbox' ), 'warning' ],
		'reviewed'          => [ __( 'Send Quote',      'drywall-toolbox' ), 'warning' ],
		'awaiting_customer' => [ __( 'Await Approval',  'drywall-toolbox' ), 'primary' ],
		'approved'          => [ __( 'Start Repair',    'drywall-toolbox' ), 'primary' ],
		'quoted'            => [ __( 'Await Approval',  'drywall-toolbox' ), 'primary' ],
		'quote_accepted'    => [ __( 'Allocate Parts',  'drywall-toolbox' ), 'primary' ],
		'parts_allocated'   => [ __( 'Begin Work',      'drywall-toolbox' ), 'primary' ],
		'in_progress'       => [ __( 'In Progress',     'drywall-toolbox' ), 'info' ],
		'in_repair'         => [ __( 'In Progress',     'drywall-toolbox' ), 'info' ],
		'ready_to_ship'     => [ __( 'Ship Now',        'drywall-toolbox' ), 'success' ],
		'completed'         => [ __( 'Completed',       'drywall-toolbox' ), 'muted' ],
		'closed'            => [ __( 'Closed',          'drywall-toolbox' ), 'muted' ],
		'cancelled'         => [ __( 'Cancelled',       'drywall-toolbox' ), 'muted' ],
		'quote_declined'    => [ __( 'Declined',        'drywall-toolbox' ), 'muted' ],
	];
	[ $na_label, $na_type ] = $next_action_map[ $status ] ?? [ ucwords( str_replace( '_', ' ', $status ) ), 'muted' ];

	echo '<tr class="dtb-table__row dtb-table__row--clickable"'
		. ' data-dtb-open-repair="' . esc_attr( (string) $repair_id ) . '"'
		. ' data-dtb-field-customer="' . esc_attr( $customer ) . '"'
		. ' data-dtb-field-device="' . esc_attr( $device ) . '"'
		. ' data-dtb-field-status="' . esc_attr( $status ) . '"'
		. '>';

	echo '<td class="dtb-table__cell">';
	echo '<div class="dtb-object-cell">';
	echo '<span class="dtb-object-avatar dtb-object-avatar--' . esc_attr( $avatar_type ) . '">' . esc_html( $initial ) . '</span>';
	echo '<div>';
	echo '<p class="dtb-object-title"><a href="' . esc_url( $edit_link ) . '">#' . esc_html( (string) $repair_id ) . '</a></p>';
	echo '<div class="dtb-object-meta">' . esc_html__( 'Repair request', 'drywall-toolbox' ) . '</div>';
	echo '</div>';
	echo '</div>';
	echo '</td>';

	echo '<td class="dtb-table__cell">';
	echo '<p class="dtb-object-title">' . esc_html( $customer ) . '</p>';
	if ( $email ) {
		echo '<div class="dtb-object-meta">' . esc_html( $email ) . '</div>';
	}
	echo '</td>';

	echo '<td class="dtb-table__cell">';
	echo dtb_admin_ui_badge( $status_lbl, $badge_type ); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
	echo '<div class="dtb-progress-pill">';
	echo '<span class="dtb-progress-pill__track"><span class="dtb-progress-pill__bar ' . esc_attr( dtb_repairs_progress_class( $status ) ) . '"></span></span>';
	echo '<span class="dtb-progress-pill__label">' . esc_html( $status_lbl ) . '</span>';
	echo '</div>';
	echo '</td>';

	echo '<td class="dtb-table__cell">';
	echo '<p class="dtb-object-title">' . esc_html( $device ) . '</p>';
	if ( $brand || $category ) {
		echo '<div class="dtb-object-meta">' . esc_html( trim( implode( ' / ', array_filter( [ $brand, $category ] ) ) ) ) . '</div>';
	}
	echo '</td>';

	// phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
	echo '<td class="dtb-table__cell">' . dtb_admin_ui_age_badge( $created_at ) . '</td>';

	// phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
	echo '<td class="dtb-table__cell">' . dtb_admin_ui_next_action( $na_label, $na_type ) . '</td>';

	echo '<td class="dtb-table__cell"><div class="dtb-table__actions">';
	// phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
	echo dtb_admin_ui_button( __( 'Open', 'drywall-toolbox' ), [
		'href' => $edit_link,
		'size' => 'xs',
		'type' => 'ghost',
	] );
	echo '</div></td>';
	echo '</tr>';
}

function dtb_repairs_render_page(): void {
	if ( ! current_user_can( 'dtb_manage_repairs' ) ) {
		dtb_admin_shell_access_denied();
		return;
	}

	$status = sanitize_key( $_GET['status'] ?? '' );  // phpcs:ignore WordPress.Security.NonceVerification.Recommended
	$status_tab = sanitize_key( $_GET['tab'] ?? '' ); // phpcs:ignore WordPress.Security.NonceVerification.Recommended
	if ( '' === $status && '' !== $status_tab ) {
		$status = $status_tab;
	}
	$status = dtb_repairs_normalize_status_filter( $status );
	$search = sanitize_text_field( $_GET['s'] ?? '' ); // phpcs:ignore WordPress.Security.NonceVerification.Recommended
	$live_search = sanitize_text_field( $_GET['search'] ?? '' ); // phpcs:ignore WordPress.Security.NonceVerification.Recommended
	if ( '' === $search && '' !== $live_search ) {
		$search = $live_search;
	}
	$paged  = max( 1, (int) ( $_GET['paged'] ?? 1 ) ); // phpcs:ignore WordPress.Security.NonceVerification.Recommended
	$per    = (int) get_option( 'dtb_admin_items_per_page', 25 );
	$base   = admin_url( 'admin.php?page=dtb-repairs' );
	$tabs   = dtb_repairs_build_tabs( $status, $base );

	dtb_admin_shell_open( [
		'title'       => __( 'Repairs', 'drywall-toolbox' ),
		'subtitle'    => __( 'Manage repair service tickets.', 'drywall-toolbox' ),
		'section'     => 'operations',
		'page'        => 'dtb-repairs',
		'template'    => 'queue',
		'icon'        => 'dashicons-hammer',
		'tabs'        => $tabs,
		'live_target' => 'dtb-repairs-workspace',
	] );

	dtb_repairs_render_summary_cards( $status );

	// Toolbar.
	echo dtb_admin_ui_toolbar_open(); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
	// phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
	echo dtb_admin_ui_search_input( __( 'Search repairs…', 'drywall-toolbox' ), $search, true, 's' );
	echo dtb_admin_ui_toolbar_spacer(); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
	if ( current_user_can( 'dtb_manage_repairs' ) ) {
		// phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
		echo dtb_admin_ui_button( __( 'New Repair', 'drywall-toolbox' ), [
			'href' => admin_url( 'post-new.php?post_type=dtb_repair_request' ),
			'icon' => 'dashicons-plus-alt2',
			'size' => 'sm',
		] );
	}
	echo dtb_admin_ui_toolbar_close(); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped

	$query = dtb_repairs_query( $status, $search, $paged, $per );
	$total_pages = $query->max_num_pages ?: 1;

	// Live region wraps the data grid so AJAX partial-renders target it.
	dtb_admin_shell_live_region_open( [
		'id'       => 'dtb-repairs-workspace',
		'module'   => 'repairs',
		'endpoint' => rest_url( 'dtb/v1/admin/repairs' ),
		'interval' => 30000,
	] );

	dtb_repairs_render_queue_workspace( $query, $paged, $total_pages );

	// Repair detail drawer.
	// phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
	echo dtb_admin_ui_drawer(
		'dtb-repairs-detail-drawer',
		__( 'Repair Detail', 'drywall-toolbox' ),
		'<div class="dtb-drawer-loading">' . esc_html__( 'Select a repair to view details.', 'drywall-toolbox' ) . '</div>',
		dtb_admin_ui_button( __( 'Open Full Record', 'drywall-toolbox' ), [
			'type' => 'secondary',
			'size' => 'sm',
			'data' => [ 'dtb-drawer-action' => 'view' ],
		] )
	);

	dtb_admin_shell_live_region_close();
	dtb_admin_shell_close();
}
