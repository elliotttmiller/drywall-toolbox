<?php
/**
 * Admin — RepairAdminMenu: capability, menu registration, inline styles, and list page callback.
 *
 * @package drywall-toolbox
 */

defined( 'ABSPATH' ) || exit;

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
