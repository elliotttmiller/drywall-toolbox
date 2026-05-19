<?php
/**
 * DTB Repair Admin — Must-Use Plugin
 *
 * WP-Admin UI for the repair services system:
 *   - Adds dtb_manage_repairs capability to the Administrator role
 *   - Custom admin menu page (top-level "Repairs")
 *   - WP_List_Table subclass with rich columns, status badges, and search
 *   - Repair detail metaboxes on the CPT edit screen
 *   - Status transition AJAX handler
 *   - Bulk actions
 *   - Inline admin CSS
 *
 * Depends on (loaded before this):
 *   dtb-repair-events.php     → dtb_repair_get_events(), dtb_repair_get_last_event()
 *   dtb-repair-workflows.php  → dtb_transition_repair_status(), dtb_get_allowed_transitions()
 *   dtb-repair-queue.php      → dtb_repair_enqueue_job()
 *
 * @package drywall-toolbox
 */

defined( 'ABSPATH' ) || exit;

// =============================================================================
// SECTION 1 — CAPABILITY BOOTSTRAP
// =============================================================================

add_action( 'init', 'dtb_repair_admin_add_capability' );

/**
 * Ensure the Administrator role has the dtb_manage_repairs capability.
 */
function dtb_repair_admin_add_capability(): void {
	$role = get_role( 'administrator' );
	if ( $role && ! $role->has_cap( 'dtb_manage_repairs' ) ) {
		$role->add_cap( 'dtb_manage_repairs', true );
	}
}

// =============================================================================
// SECTION 2 — ADMIN MENU
// =============================================================================

add_action( 'admin_menu', 'dtb_repair_admin_menu' );

/**
 * Register the top-level "Repairs" menu in WP-Admin.
 */
function dtb_repair_admin_menu(): void {
	add_menu_page(
		__( 'Repairs', 'drywall-toolbox' ),
		__( 'Repairs', 'drywall-toolbox' ),
		'dtb_manage_repairs',
		'dtb-repairs',
		'dtb_repair_admin_list_page',
		'dashicons-hammer',
		30
	);

	add_submenu_page(
		'dtb-repairs',
		__( 'All Repairs', 'drywall-toolbox' ),
		__( 'All Repairs', 'drywall-toolbox' ),
		'dtb_manage_repairs',
		'dtb-repairs',
		'dtb_repair_admin_list_page'
	);
}

// =============================================================================
// SECTION 3 — ADMIN STYLES
// =============================================================================

add_action( 'admin_head', 'dtb_repair_admin_inline_styles' );

/**
 * Output inline CSS for repair admin pages.
 */
function dtb_repair_admin_inline_styles(): void {
	$screen = get_current_screen();
	if ( ! $screen ) {
		return;
	}

	// Only output on repair-related screens.
	$repair_screens = [ 'toplevel_page_dtb-repairs', 'dtb_repair_request', 'dtb_repair_request_page_dtb-repairs' ];
	if ( ! in_array( $screen->id, $repair_screens, true ) && 'dtb_repair_request' !== $screen->post_type ) {
		return;
	}
	?>
	<style id="dtb-repair-admin-styles">
		/* Status badges */
		.dtb-status-badge {
			display: inline-block;
			padding: 2px 8px;
			border-radius: 3px;
			font-size: 11px;
			font-weight: 600;
			text-transform: uppercase;
			letter-spacing: 0.5px;
		}
		/* Yellow — pending/initial */
		.dtb-status-submitted,
		.dtb-status-awaiting_customer { background: #fef3c7; color: #92400e; }
		/* Blue — active workflow */
		.dtb-status-reviewed,
		.dtb-status-approved,
		.dtb-status-quoted,
		.dtb-status-quote_accepted,
		.dtb-status-parts_allocated,
		.dtb-status-in_progress { background: #dbeafe; color: #1e40af; }
		/* Green — near complete */
		.dtb-status-ready_to_ship,
		.dtb-status-completed { background: #dcfce7; color: #166534; }
		/* Gray — terminal/closed */
		.dtb-status-closed,
		.dtb-status-quote_declined { background: #f3f4f6; color: #6b7280; }
		/* Red — cancelled/problem */
		.dtb-status-cancelled { background: #fee2e2; color: #991b1b; }

		/* SLA breach indicator */
		.dtb-sla-breached { color: #dc2626; font-weight: 600; }
		.dtb-sla-ok { color: #16a34a; }

		/* Metabox styles */
		.dtb-repair-metabox table { width: 100%; border-collapse: collapse; }
		.dtb-repair-metabox th { width: 140px; padding: 6px 8px; text-align: left; color: #6b7280; font-weight: 500; }
		.dtb-repair-metabox td { padding: 6px 8px; }
		.dtb-repair-timeline { list-style: none; margin: 0; padding: 0; }
		.dtb-repair-timeline li { padding: 6px 0; border-bottom: 1px solid #f3f4f6; font-size: 12px; }
		.dtb-repair-timeline li:last-child { border-bottom: none; }
		.dtb-timeline-time { color: #9ca3af; margin-left: 8px; }
		.dtb-integration-row { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; }
		.dtb-integration-ok { color: #16a34a; }
		.dtb-integration-pending { color: #d97706; }
		.dtb-integration-error { color: #dc2626; }
	</style>
	<?php
}

// =============================================================================
// SECTION 4 — LIST PAGE CALLBACK (WP_List_Table)
// =============================================================================

/**
 * Render the All Repairs admin page.
 */
function dtb_repair_admin_list_page(): void {
	if ( ! current_user_can( 'dtb_manage_repairs' ) ) {
		wp_die( esc_html__( 'You do not have permission to view this page.', 'drywall-toolbox' ) );
	}

	// Load the list table class if it isn't already.
	if ( ! class_exists( 'WP_List_Table' ) ) {
		require_once ABSPATH . 'wp-admin/includes/class-wp-list-table.php';
	}

	$table = new DTB_Repair_List_Table();
	$table->prepare_items();
	?>
	<div class="wrap">
		<h1 class="wp-heading-inline"><?php esc_html_e( 'Repair Requests', 'drywall-toolbox' ); ?></h1>
		<hr class="wp-header-end">

		<?php
		// Handle bulk action messages.
		if ( ! empty( $_GET['dtb_bulk_msg'] ) ) { // phpcs:ignore WordPress.Security.NonceVerification.Recommended
			$msg = sanitize_text_field( wp_unslash( (string) $_GET['dtb_bulk_msg'] ) ); // phpcs:ignore WordPress.Security.NonceVerification.Recommended
			echo '<div class="notice notice-success is-dismissible"><p>' . esc_html( $msg ) . '</p></div>';
		}
		?>

		<form method="get" action="">
			<input type="hidden" name="page" value="dtb-repairs">
			<?php
			$table->search_box( __( 'Search Repairs', 'drywall-toolbox' ), 'dtb-repair-search' );
			$table->display();
			?>
		</form>
	</div>
	<?php
}

// =============================================================================
// SECTION 5 — WP_LIST_TABLE SUBCLASS
// =============================================================================

if ( is_admin() ) {
	add_action( 'admin_menu', function (): void {
		if ( ! class_exists( 'WP_List_Table' ) ) {
			require_once ABSPATH . 'wp-admin/includes/class-wp-list-table.php';
		}
	}, 1 );
}

/**
 * DTB Repair List Table
 *
 * @package drywall-toolbox
 */
class DTB_Repair_List_Table extends WP_List_Table {

	/** @var int Total number of items (for pagination). */
	private int $total_items = 0;

	public function __construct() {
		parent::__construct( [
			'singular' => 'repair',
			'plural'   => 'repairs',
			'ajax'     => false,
		] );
	}

	// ---- Columns ---------------------------------------------------------------

	public function get_columns(): array {
		return [
			'cb'          => '<input type="checkbox">',
			'repair_id'   => __( 'Repair ID', 'drywall-toolbox' ),
			'customer'    => __( 'Customer', 'drywall-toolbox' ),
			'tool'        => __( 'Brand / Model', 'drywall-toolbox' ),
			'status'      => __( 'Status', 'drywall-toolbox' ),
			'age'         => __( 'Age', 'drywall-toolbox' ),
			'sla'         => __( 'SLA', 'drywall-toolbox' ),
			'wc_order'    => __( 'WC Order', 'drywall-toolbox' ),
			'veeqo'       => __( 'Veeqo', 'drywall-toolbox' ),
			'quickbooks'  => __( 'QuickBooks', 'drywall-toolbox' ),
			'tech'        => __( 'Tech', 'drywall-toolbox' ),
			'last_event'  => __( 'Last Event', 'drywall-toolbox' ),
		];
	}

	public function get_sortable_columns(): array {
		return [
			'repair_id' => [ 'ID', false ],
			'status'    => [ 'status', false ],
			'age'       => [ 'date', true ],
		];
	}

	// ---- Bulk actions ----------------------------------------------------------

	public function get_bulk_actions(): array {
		return [
			'bulk_cancel'   => __( 'Cancel', 'drywall-toolbox' ),
			'bulk_reviewed' => __( 'Mark Reviewed', 'drywall-toolbox' ),
		];
	}

	public function process_bulk_action(): void {
		// Verify nonce before touching any POST data; bail silently on regular page loads.
		if ( empty( $_REQUEST['_wpnonce'] ) ) { // phpcs:ignore WordPress.Security.NonceVerification.Recommended
			return;
		}

		check_admin_referer( 'bulk-repairs' );

		if ( empty( $_POST['repair'] ) || ! is_array( $_POST['repair'] ) ) {
			return;
		}

		$action     = $this->current_action();
		$repair_ids = array_map( 'absint', (array) $_POST['repair'] ); // phpcs:ignore WordPress.Security.NonceVerification.Missing
		$processed  = 0;

		$action_map = [
			'bulk_cancel'   => 'cancelled',
			'bulk_reviewed' => 'reviewed',
		];

		if ( ! isset( $action_map[ $action ] ) ) {
			return;
		}

		$to_status = $action_map[ $action ];

		foreach ( $repair_ids as $rid ) {
			if ( function_exists( 'dtb_transition_repair_status' ) ) {
				$result = dtb_transition_repair_status( $rid, $to_status, [
					'actor_type' => 'admin',
					'actor_id'   => get_current_user_id(),
					'source'     => 'admin_bulk',
				] );
				if ( true === $result ) {
					$processed++;
				}
			}
		}

		if ( $processed > 0 ) {
			wp_safe_redirect(
				add_query_arg(
					[
						'page'         => 'dtb-repairs',
						'dtb_bulk_msg' => sprintf(
							/* translators: %d: number of repairs updated */
							__( '%d repair(s) updated.', 'drywall-toolbox' ),
							$processed
						),
					],
					admin_url( 'admin.php' )
				)
			);
			exit;
		}
	}

	// ---- Data query ------------------------------------------------------------

	public function prepare_items(): void {
		$this->process_bulk_action();

		$per_page     = 25;
		$current_page = $this->get_pagenum();
		$search       = sanitize_text_field( wp_unslash( (string) ( $_GET['s'] ?? '' ) ) ); // phpcs:ignore WordPress.Security.NonceVerification.Recommended

		$args = [
			'post_type'      => 'dtb_repair_request',
			'post_status'    => 'publish',
			'posts_per_page' => $per_page,
			'paged'          => $current_page,
			'orderby'        => 'date',
			'order'          => 'DESC',
		];

		if ( '' !== $search ) {
			$args['meta_query'] = [
				'relation' => 'OR',
				[
					'key'     => '_repair_customer_email',
					'value'   => $search,
					'compare' => 'LIKE',
				],
				[
					'key'     => '_repair_customer_name',
					'value'   => $search,
					'compare' => 'LIKE',
				],
			];
		}

		// Status filter.
		if ( ! empty( $_GET['repair_status'] ) ) { // phpcs:ignore WordPress.Security.NonceVerification.Recommended
			$filter_status = sanitize_text_field( wp_unslash( (string) $_GET['repair_status'] ) ); // phpcs:ignore WordPress.Security.NonceVerification.Recommended
			$args['meta_query'][] = [
				'key'   => '_repair_status',
				'value' => $filter_status,
			];
		}

		$query             = new WP_Query( $args );
		$this->total_items = (int) $query->found_posts;

		$this->set_pagination_args( [
			'total_items' => $this->total_items,
			'per_page'    => $per_page,
		] );

		$this->_column_headers = [ $this->get_columns(), [], $this->get_sortable_columns() ];
		$this->items           = $query->posts;
	}

	// ---- Column renderers ------------------------------------------------------

	protected function column_default( $item, $column_name ): string {
		return '—';
	}

	protected function column_cb( $item ): string {
		return sprintf( '<input type="checkbox" name="repair[]" value="%d">', (int) $item->ID );
	}

	protected function column_repair_id( $item ): string {
		$edit_url = admin_url( 'post.php?post=' . (int) $item->ID . '&action=edit' );
		$actions  = [
			'edit' => sprintf(
				'<a href="%s">%s</a>',
				esc_url( $edit_url ),
				esc_html__( 'Edit', 'drywall-toolbox' )
			),
		];
		return sprintf(
			'<strong><a href="%s">#%d</a></strong>%s',
			esc_url( $edit_url ),
			(int) $item->ID,
			$this->row_actions( $actions )
		);
	}

	protected function column_customer( $item ): string {
		$name  = esc_html( (string) get_post_meta( $item->ID, '_repair_customer_name', true ) );
		$email = esc_html( (string) get_post_meta( $item->ID, '_repair_customer_email', true ) );
		return $name . ( $email ? '<br><small>' . $email . '</small>' : '' );
	}

	protected function column_tool( $item ): string {
		$brand  = esc_html( (string) get_post_meta( $item->ID, '_repair_tool_brand', true ) );
		$model  = esc_html( (string) get_post_meta( $item->ID, '_repair_model', true ) );
		$serial = esc_html( (string) get_post_meta( $item->ID, '_repair_serial', true ) );
		return $brand . ' ' . $model . ( $serial ? '<br><small>S/N: ' . $serial . '</small>' : '' );
	}

	protected function column_status( $item ): string {
		$status = (string) get_post_meta( $item->ID, '_repair_status', true );
		$label  = function_exists( 'dtb_get_repair_status_label' )
			? dtb_get_repair_status_label( $status )
			: esc_html( $status );

		$css_class = 'dtb-status-' . esc_attr( $status );
		return sprintf(
			'<span class="dtb-status-badge %s">%s</span>',
			esc_attr( $css_class ),
			esc_html( $label )
		);
	}

	protected function column_age( $item ): string {
		$submitted = (string) get_post_meta( $item->ID, '_repair_submitted_at', true );
		if ( '' === $submitted ) {
			return '—';
		}
		$ts   = strtotime( $submitted );
		$days = (int) floor( ( time() - $ts ) / DAY_IN_SECONDS );
		return esc_html( sprintf( _n( '%d day', '%d days', $days, 'drywall-toolbox' ), $days ) );
	}

	protected function column_sla( $item ): string {
		$breached   = (string) get_post_meta( $item->ID, '_repair_sla_breached', true );
		$age_days   = (string) get_post_meta( $item->ID, '_repair_sla_age_days', true );
		$sla_days   = (string) get_post_meta( $item->ID, '_repair_sla_threshold_days', true );

		if ( '' === $age_days ) {
			return '<span class="dtb-sla-ok">—</span>';
		}

		$class = $breached ? 'dtb-sla-breached' : 'dtb-sla-ok';
		return sprintf(
			'<span class="%s">%s/%s d</span>',
			esc_attr( $class ),
			esc_html( $age_days ),
			esc_html( $sla_days )
		);
	}

	protected function column_wc_order( $item ): string {
		$order_id = (int) get_post_meta( $item->ID, '_repair_wc_order_id', true );
		if ( ! $order_id ) {
			return '—';
		}
		$order_url = admin_url( 'post.php?post=' . $order_id . '&action=edit' );
		return sprintf( '<a href="%s">#%d</a>', esc_url( $order_url ), $order_id );
	}

	protected function column_veeqo( $item ): string {
		$state = dtb_repair_admin_get_integration_state_value( $item->ID, 'veeqo', 'state' );
		return dtb_repair_admin_integration_badge( $state );
	}

	protected function column_quickbooks( $item ): string {
		$state = dtb_repair_admin_get_integration_state_value( $item->ID, 'quickbooks', 'state' );
		return dtb_repair_admin_integration_badge( $state );
	}

	protected function column_tech( $item ): string {
		$tech_id = (int) get_post_meta( $item->ID, '_repair_assigned_tech_id', true );
		if ( ! $tech_id ) {
			return '—';
		}
		$user = get_userdata( $tech_id );
		return $user ? esc_html( $user->display_name ) : esc_html( '#' . $tech_id );
	}

	protected function column_last_event( $item ): string {
		if ( ! function_exists( 'dtb_repair_get_last_event' ) ) {
			return '—';
		}
		$ev = dtb_repair_get_last_event( $item->ID );
		if ( ! $ev ) {
			return '—';
		}
		return esc_html( $ev->event_type ) . '<br><small class="dtb-timeline-time">' . esc_html( $ev->created_at ) . '</small>';
	}
}

// =============================================================================
// SECTION 6 — HELPER: INTEGRATION STATE DISPLAY
// =============================================================================

/**
 * Read a single value from the integration state JSON meta.
 *
 * @param int    $repair_id
 * @param string $integration  'woocommerce' | 'veeqo' | 'quickbooks' | 'rewards'
 * @param string $key          Key within the integration slice.
 * @return mixed
 */
function dtb_repair_admin_get_integration_state_value( int $repair_id, string $integration, string $key ): mixed {
	$raw     = (string) get_post_meta( $repair_id, '_repair_integration_state', true );
	$decoded = ( '' !== $raw ) ? json_decode( $raw, true ) : [];
	return $decoded[ $integration ][ $key ] ?? null;
}

/**
 * Render a small integration status badge.
 *
 * @param mixed $state  State string from the integration projection.
 * @return string  HTML badge.
 */
function dtb_repair_admin_integration_badge( mixed $state ): string {
	$state = (string) $state;

	if ( '' === $state || 'pending' === $state || 'not_configured' === $state ) {
		return '<span class="dtb-integration-pending">—</span>';
	}

	if ( in_array( $state, [ 'synced', 'issued', 'ok' ], true ) ) {
		return '<span class="dtb-integration-ok">✓</span>';
	}

	if ( in_array( $state, [ 'error', 'failed' ], true ) ) {
		return '<span class="dtb-integration-error">✗</span>';
	}

	return '<span>' . esc_html( $state ) . '</span>';
}

// =============================================================================
// SECTION 7 — CPT EDIT SCREEN METABOXES
// =============================================================================

add_action( 'add_meta_boxes', 'dtb_repair_admin_add_metaboxes' );

/**
 * Register all metaboxes for the dtb_repair_request CPT edit screen.
 */
function dtb_repair_admin_add_metaboxes(): void {
	$boxes = [
		'dtb-repair-customer'    => [ __( 'Customer Details', 'drywall-toolbox' ), 'dtb_repair_metabox_customer', 'side', 'high' ],
		'dtb-repair-tool'        => [ __( 'Tool Details', 'drywall-toolbox' ), 'dtb_repair_metabox_tool', 'normal', 'high' ],
		'dtb-repair-issue'       => [ __( 'Issue Description', 'drywall-toolbox' ), 'dtb_repair_metabox_issue', 'normal', 'high' ],
		'dtb-repair-timeline'    => [ __( 'Repair Timeline', 'drywall-toolbox' ), 'dtb_repair_metabox_timeline', 'normal', 'default' ],
		'dtb-repair-notes'       => [ __( 'Internal Notes', 'drywall-toolbox' ), 'dtb_repair_metabox_notes', 'normal', 'default' ],
		'dtb-repair-integration' => [ __( 'Integration Status', 'drywall-toolbox' ), 'dtb_repair_metabox_integration', 'side', 'default' ],
		'dtb-repair-transition'  => [ __( 'Status Transition', 'drywall-toolbox' ), 'dtb_repair_metabox_transition', 'side', 'high' ],
		'dtb-repair-queue'       => [ __( 'Queue Jobs', 'drywall-toolbox' ), 'dtb_repair_metabox_queue', 'side', 'low' ],
	];

	foreach ( $boxes as $id => $args ) {
		add_meta_box(
			$id,
			$args[0],
			$args[1],
			'dtb_repair_request',
			$args[2],
			$args[3]
		);
	}
}

// ---- Metabox: Customer Details -----------------------------------------------

function dtb_repair_metabox_customer( WP_Post $post ): void {
	$fields = [
		'_repair_customer_name'  => __( 'Name', 'drywall-toolbox' ),
		'_repair_customer_email' => __( 'Email', 'drywall-toolbox' ),
		'_repair_customer_phone' => __( 'Phone', 'drywall-toolbox' ),
	];
	echo '<div class="dtb-repair-metabox"><table>';
	foreach ( $fields as $key => $label ) {
		$value = esc_html( (string) get_post_meta( $post->ID, $key, true ) );
		echo '<tr><th>' . esc_html( $label ) . '</th><td>' . $value . '</td></tr>';
	}
	echo '</table></div>';
}

// ---- Metabox: Tool Details ---------------------------------------------------

function dtb_repair_metabox_tool( WP_Post $post ): void {
	$fields = [
		'_repair_tool_brand'   => __( 'Brand', 'drywall-toolbox' ),
		'_repair_model'        => __( 'Model', 'drywall-toolbox' ),
		'_repair_serial'       => __( 'Serial Number', 'drywall-toolbox' ),
		'_repair_service_tier' => __( 'Service Tier', 'drywall-toolbox' ),
	];
	echo '<div class="dtb-repair-metabox"><table>';
	foreach ( $fields as $key => $label ) {
		$value = esc_html( (string) get_post_meta( $post->ID, $key, true ) );
		echo '<tr><th>' . esc_html( $label ) . '</th><td>' . $value . '</td></tr>';
	}
	echo '</table></div>';
}

// ---- Metabox: Issue Description ---------------------------------------------

function dtb_repair_metabox_issue( WP_Post $post ): void {
	$issue  = wp_kses_post( (string) get_post_meta( $post->ID, '_repair_issue', true ) );
	$images = json_decode( (string) get_post_meta( $post->ID, '_repair_images', true ), true );

	echo '<div class="dtb-repair-metabox">';
	echo '<p>' . wp_kses_post( $issue ) . '</p>';

	if ( ! empty( $images ) && is_array( $images ) ) {
		echo '<p><strong>' . esc_html__( 'Attached Images:', 'drywall-toolbox' ) . '</strong></p><div style="display:flex;gap:8px;flex-wrap:wrap;">';
		foreach ( $images as $att_id ) {
			$att_id = absint( $att_id );
			$thumb  = wp_get_attachment_image( $att_id, [ 80, 80 ] );
			$url    = wp_get_attachment_url( $att_id );
			if ( $thumb && $url ) {
				echo '<a href="' . esc_url( $url ) . '" target="_blank">' . $thumb . '</a>';
			}
		}
		echo '</div>';
	}
	echo '</div>';
}

// ---- Metabox: Timeline -------------------------------------------------------

function dtb_repair_metabox_timeline( WP_Post $post ): void {
	if ( ! function_exists( 'dtb_repair_get_events' ) ) {
		echo '<p>' . esc_html__( 'Event log unavailable.', 'drywall-toolbox' ) . '</p>';
		return;
	}

	$events = dtb_repair_get_events( $post->ID, null, 50 );
	if ( empty( $events ) ) {
		echo '<p>' . esc_html__( 'No events recorded yet.', 'drywall-toolbox' ) . '</p>';
		return;
	}

	echo '<ul class="dtb-repair-timeline">';
	foreach ( array_reverse( $events ) as $ev ) {
		echo '<li>'
			. '<span class="dtb-status-badge dtb-status-' . esc_attr( $ev->visibility ) . '">' . esc_html( $ev->visibility ) . '</span> '
			. esc_html( $ev->event_type )
			. '<span class="dtb-timeline-time">' . esc_html( $ev->created_at ) . '</span>'
			. '</li>';
	}
	echo '</ul>';
}

// ---- Metabox: Internal Notes ------------------------------------------------

function dtb_repair_metabox_notes( WP_Post $post ): void {
	wp_nonce_field( 'dtb_repair_save_notes_' . $post->ID, 'dtb_repair_notes_nonce' );
	$notes = wp_kses_post( (string) get_post_meta( $post->ID, '_repair_internal_notes', true ) );
	echo '<div class="dtb-repair-metabox">';
	echo '<textarea name="dtb_repair_internal_notes" style="width:100%;min-height:120px;" placeholder="'
		. esc_attr__( 'Internal notes (not visible to customers)…', 'drywall-toolbox' )
		. '">' . esc_textarea( $notes ) . '</textarea>';
	echo '</div>';
}

add_action( 'save_post_dtb_repair_request', 'dtb_repair_save_notes_meta' );

/**
 * Save internal notes metabox.
 *
 * @param int $post_id
 */
function dtb_repair_save_notes_meta( int $post_id ): void {
	if ( ! isset( $_POST['dtb_repair_notes_nonce'] ) ) {
		return;
	}
	if ( ! wp_verify_nonce( sanitize_text_field( wp_unslash( (string) $_POST['dtb_repair_notes_nonce'] ) ), 'dtb_repair_save_notes_' . $post_id ) ) {
		return;
	}
	if ( ! current_user_can( 'dtb_manage_repairs' ) ) {
		return;
	}
	if ( defined( 'DOING_AUTOSAVE' ) && DOING_AUTOSAVE ) {
		return;
	}

	$notes = isset( $_POST['dtb_repair_internal_notes'] )
		? wp_kses_post( wp_unslash( (string) $_POST['dtb_repair_internal_notes'] ) )
		: '';

	update_post_meta( $post_id, '_repair_internal_notes', $notes );

	if ( ! empty( $notes ) && function_exists( 'dtb_repair_append_event' ) ) {
		dtb_repair_append_event( $post_id, 'repair.note_added', [
			'actor_type' => 'admin',
			'actor_id'   => get_current_user_id(),
			'source'     => 'admin',
			'visibility' => 'operator',
			'payload'    => [ 'note_length' => strlen( $notes ) ],
		] );
	}
}

// ---- Metabox: Integration Status --------------------------------------------

function dtb_repair_metabox_integration( WP_Post $post ): void {
	$raw   = (string) get_post_meta( $post->ID, '_repair_integration_state', true );
	$state = ( '' !== $raw ) ? json_decode( $raw, true ) : [];

	echo '<div class="dtb-repair-metabox">';

	// WooCommerce.
	$wc_order_id = (int) get_post_meta( $post->ID, '_repair_wc_order_id', true );
	$wc_state    = esc_html( $state['woocommerce']['state'] ?? 'pending' );
	echo '<div class="dtb-integration-row"><strong>WooCommerce:</strong> ';
	if ( $wc_order_id ) {
		$wc_url = admin_url( 'post.php?post=' . $wc_order_id . '&action=edit' );
		echo '<a href="' . esc_url( $wc_url ) . '">' . esc_html__( 'Order #', 'drywall-toolbox' ) . $wc_order_id . '</a>';
	} else {
		echo esc_html( $wc_state );
	}
	echo '</div>';

	// Veeqo.
	$veeqo_state = esc_html( $state['veeqo']['state'] ?? 'pending' );
	$veeqo_track = esc_html( $state['veeqo']['tracking_number'] ?? '' );
	echo '<div class="dtb-integration-row"><strong>Veeqo:</strong> '
		. $veeqo_state
		. ( $veeqo_track ? ' &mdash; ' . $veeqo_track : '' )
		. '</div>';

	// QuickBooks.
	$qb_state   = esc_html( $state['quickbooks']['state'] ?? 'pending' );
	$qb_invoice = esc_html( $state['quickbooks']['invoice_id'] ?? '' );
	echo '<div class="dtb-integration-row"><strong>QuickBooks:</strong> '
		. $qb_state
		. ( $qb_invoice ? ' &mdash; ' . $qb_invoice : '' )
		. '</div>';

	// Rewards.
	$rewards_state  = esc_html( $state['rewards']['state'] ?? 'not_eligible' );
	$rewards_issued = ! empty( $state['rewards']['issued'] ) ? __( 'Yes', 'drywall-toolbox' ) : __( 'No', 'drywall-toolbox' );
	echo '<div class="dtb-integration-row"><strong>'
		. esc_html__( 'Rewards:', 'drywall-toolbox' )
		. '</strong> '
		. $rewards_state
		. ' (' . esc_html( $rewards_issued ) . ')</div>';

	echo '</div>';
}

// ---- Metabox: Status Transition ---------------------------------------------

function dtb_repair_metabox_transition( WP_Post $post ): void {
	if ( ! function_exists( 'dtb_get_repair_status' ) || ! function_exists( 'dtb_get_allowed_transitions' ) ) {
		echo '<p>' . esc_html__( 'Workflow module unavailable.', 'drywall-toolbox' ) . '</p>';
		return;
	}

	$current     = dtb_get_repair_status( $post->ID );
	$transitions = dtb_get_allowed_transitions();
	$allowed     = $transitions[ $current ] ?? [];

	echo '<div class="dtb-repair-metabox">';
	echo '<p><strong>' . esc_html__( 'Current Status:', 'drywall-toolbox' ) . '</strong> '
		. '<span class="dtb-status-badge dtb-status-' . esc_attr( $current ) . '">' . esc_html( dtb_get_repair_status_label( $current ) ) . '</span></p>';

	if ( empty( $allowed ) ) {
		echo '<p><em>' . esc_html__( 'No transitions available (terminal state).', 'drywall-toolbox' ) . '</em></p>';
		echo '</div>';
		return;
	}

	echo '<select id="dtb-repair-to-status" style="width:100%;margin-bottom:8px;">';
	echo '<option value="">' . esc_html__( '— Select new status —', 'drywall-toolbox' ) . '</option>';
	foreach ( $allowed as $ts ) {
		echo '<option value="' . esc_attr( $ts ) . '">' . esc_html( dtb_get_repair_status_label( $ts ) ) . '</option>';
	}
	echo '</select>';
	echo '<input type="text" id="dtb-repair-transition-note" placeholder="' . esc_attr__( 'Optional note…', 'drywall-toolbox' ) . '" style="width:100%;margin-bottom:8px;">';

	wp_nonce_field( 'dtb_repair_transition_' . $post->ID, 'dtb_repair_transition_nonce' );

	echo '<button type="button" id="dtb-repair-transition-btn" class="button button-primary" data-repair-id="' . esc_attr( (string) $post->ID ) . '">'
		. esc_html__( 'Transition', 'drywall-toolbox' )
		. '</button>';
	echo '<span id="dtb-repair-transition-msg" style="margin-left:8px;"></span>';

	// Inline JS for the AJAX transition button.
	?>
	<script>
	(function($) {
		$('#dtb-repair-transition-btn').on('click', function() {
			var repairId = $(this).data('repair-id');
			var toStatus = $('#dtb-repair-to-status').val();
			var note     = $('#dtb-repair-transition-note').val();
			var nonce    = $('input[name="dtb_repair_transition_nonce"]').val();

			if (!toStatus) {
				$('#dtb-repair-transition-msg').text('<?php echo esc_js( __( 'Please select a status.', 'drywall-toolbox' ) ); ?>');
				return;
			}

			$('#dtb-repair-transition-btn').prop('disabled', true);
			$('#dtb-repair-transition-msg').text('<?php echo esc_js( __( 'Transitioning…', 'drywall-toolbox' ) ); ?>');

			$.post(ajaxurl, {
				action:    'dtb_repair_transition',
				repair_id: repairId,
				to_status: toStatus,
				note:      note,
				nonce:     nonce
			}, function(response) {
				if (response.success) {
					$('#dtb-repair-transition-msg').text(response.data.message);
					setTimeout(function() { location.reload(); }, 800);
				} else {
					$('#dtb-repair-transition-msg').text(response.data.message || '<?php echo esc_js( __( 'Error.', 'drywall-toolbox' ) ); ?>');
					$('#dtb-repair-transition-btn').prop('disabled', false);
				}
			});
		});
	}(jQuery));
	</script>
	<?php
	echo '</div>';
}

// ---- Metabox: Queue Jobs ----------------------------------------------------

function dtb_repair_metabox_queue( WP_Post $post ): void {
	echo '<div class="dtb-repair-metabox">';

	if ( ! function_exists( 'as_get_scheduled_actions' ) ) {
		echo '<p><em>' . esc_html__( 'Action Scheduler not active.', 'drywall-toolbox' ) . '</em></p>';
		echo '</div>';
		return;
	}

	// function_exists('as_get_scheduled_actions') passed above — AS is active, so the class exists.
	$as_status = \ActionScheduler_Store::STATUS_PENDING;

	$actions = as_get_scheduled_actions(
		[
			'group'    => 'dtb-repairs',
			'search'   => (string) $post->ID,
			'status'   => $as_status,
			'per_page' => 20,
		]
	);

	if ( empty( $actions ) ) {
		echo '<p><em>' . esc_html__( 'No pending jobs.', 'drywall-toolbox' ) . '</em></p>';
		echo '</div>';
		return;
	}

	echo '<ul style="margin:0;padding:0;list-style:none;">';
	foreach ( $actions as $action ) {
		echo '<li style="padding:3px 0;font-size:12px;">'
			. esc_html( $action->get_hook() )
			. '</li>';
	}
	echo '</ul>';
	echo '</div>';
}

// =============================================================================
// SECTION 8 — AJAX: STATUS TRANSITION
// =============================================================================

add_action( 'wp_ajax_dtb_repair_transition', 'dtb_repair_ajax_transition' );

/**
 * Handle the AJAX status transition request from the metabox.
 */
function dtb_repair_ajax_transition(): void {
	// Nonce verification.
	$nonce     = sanitize_text_field( wp_unslash( (string) ( $_POST['nonce'] ?? '' ) ) );
	$repair_id = (int) ( $_POST['repair_id'] ?? 0 );

	if ( ! $repair_id || ! wp_verify_nonce( $nonce, 'dtb_repair_transition_' . $repair_id ) ) {
		wp_send_json_error( [ 'message' => __( 'Security check failed.', 'drywall-toolbox' ) ], 403 );
	}

	if ( ! current_user_can( 'dtb_manage_repairs' ) ) {
		wp_send_json_error( [ 'message' => __( 'Insufficient permissions.', 'drywall-toolbox' ) ], 403 );
	}

	$to_status = sanitize_text_field( wp_unslash( (string) ( $_POST['to_status'] ?? '' ) ) );
	$note      = sanitize_textarea_field( wp_unslash( (string) ( $_POST['note'] ?? '' ) ) );

	if ( '' === $to_status ) {
		wp_send_json_error( [ 'message' => __( 'No target status provided.', 'drywall-toolbox' ) ] );
	}

	if ( ! function_exists( 'dtb_transition_repair_status' ) ) {
		wp_send_json_error( [ 'message' => __( 'Workflow module unavailable.', 'drywall-toolbox' ) ] );
	}

	$result = dtb_transition_repair_status(
		$repair_id,
		$to_status,
		[
			'actor_type' => 'admin',
			'actor_id'   => get_current_user_id(),
			'source'     => 'admin',
			'note'       => $note,
		]
	);

	if ( is_wp_error( $result ) ) {
		wp_send_json_error( [ 'message' => $result->get_error_message() ] );
	}

	wp_send_json_success( [
		'message' => sprintf(
			/* translators: %s: new status label */
			__( 'Status updated to: %s', 'drywall-toolbox' ),
			function_exists( 'dtb_get_repair_status_label' ) ? dtb_get_repair_status_label( $to_status ) : $to_status
		),
	] );
}

// =============================================================================
// SECTION 9 — CPT COLUMN CUSTOMIZATION (native WP post list)
// =============================================================================

add_filter( 'manage_dtb_repair_request_posts_columns', 'dtb_repair_admin_cpt_columns' );

/**
 * Customize columns for the native WP all-posts screen (fallback, rarely used).
 *
 * @param array $columns
 * @return array
 */
function dtb_repair_admin_cpt_columns( array $columns ): array {
	$new = [
		'cb'          => $columns['cb'],
		'title'       => __( 'Repair', 'drywall-toolbox' ),
		'dtb_status'  => __( 'Status', 'drywall-toolbox' ),
		'dtb_customer'=> __( 'Customer', 'drywall-toolbox' ),
		'dtb_tool'    => __( 'Tool', 'drywall-toolbox' ),
		'date'        => $columns['date'],
	];
	return $new;
}

add_action( 'manage_dtb_repair_request_posts_custom_column', 'dtb_repair_admin_cpt_column_content', 10, 2 );

/**
 * Render custom column content on the native WP post list.
 *
 * @param string $column
 * @param int    $post_id
 */
function dtb_repair_admin_cpt_column_content( string $column, int $post_id ): void {
	switch ( $column ) {
		case 'dtb_status':
			$status = (string) get_post_meta( $post_id, '_repair_status', true );
			$label  = function_exists( 'dtb_get_repair_status_label' ) ? dtb_get_repair_status_label( $status ) : $status;
			echo '<span class="dtb-status-badge dtb-status-' . esc_attr( $status ) . '">' . esc_html( $label ) . '</span>';
			break;
		case 'dtb_customer':
			echo esc_html( (string) get_post_meta( $post_id, '_repair_customer_name', true ) );
			break;
		case 'dtb_tool':
			$brand = (string) get_post_meta( $post_id, '_repair_tool_brand', true );
			$model = (string) get_post_meta( $post_id, '_repair_model', true );
			echo esc_html( $brand . ' ' . $model );
			break;
	}
}

// =============================================================================
// SECTION 10 — ADMIN SEARCH FILTER
// =============================================================================

add_action( 'pre_get_posts', 'dtb_repair_admin_search_filter' );

/**
 * Extend the default WP search to query customer email/name meta for repair CPT.
 *
 * @param WP_Query $query
 */
function dtb_repair_admin_search_filter( WP_Query $query ): void {
	if ( ! is_admin() || ! $query->is_main_query() ) {
		return;
	}
	if ( 'dtb_repair_request' !== $query->get( 'post_type' ) ) {
		return;
	}
	$search = (string) $query->get( 's' );
	if ( '' === $search ) {
		return;
	}

	$query->set( 's', '' ); // Clear default title search.
	$query->set(
		'meta_query',
		[
			'relation' => 'OR',
			[
				'key'     => '_repair_customer_email',
				'value'   => $search,
				'compare' => 'LIKE',
			],
			[
				'key'     => '_repair_customer_name',
				'value'   => $search,
				'compare' => 'LIKE',
			],
		]
	);
}
