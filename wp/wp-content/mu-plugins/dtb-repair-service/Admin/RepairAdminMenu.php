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
add_filter( 'get_user_option_screen_layout_dtb_repair_request', 'dtb_repair_force_two_column_layout' );

/**
 * Force 2-column edit layout for repair requests so side cards always render.
 */
function dtb_repair_force_two_column_layout( $value ): int {
	unset( $value );
	return 2;
}

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

	$repair_screens = [ 'toplevel_page_dtb-repairs', 'dtb_repair_request', 'dtb_repair_request_page_dtb-repairs' ];
	if ( ! in_array( $screen->id, $repair_screens, true ) && 'dtb_repair_request' !== $screen->post_type ) {
		return;
	}

	$is_edit = ( 'dtb_repair_request' === $screen->post_type );
	?>
	<style id="dtb-repair-admin-styles">

	/* ── Design tokens ──────────────────────────────────────────────────────── */
	:root {
		--dtb-blue:        #1d4ed8;
		--dtb-blue-light:  #eff6ff;
		--dtb-border:      #e5e7eb;
		--dtb-text:        #111827;
		--dtb-muted:       #6b7280;
		--dtb-surface:     #ffffff;
		--dtb-bg:          #f3f4f6;
		--dtb-radius:      10px;
		--dtb-shadow:      0 1px 4px rgba(0,0,0,.07), 0 0 0 1px rgba(0,0,0,.05);
		--dtb-shadow-md:   0 4px 16px rgba(0,0,0,.10);
		/* WP admin bar collapses to 46px on mobile (≤782px) */
		--dtb-admin-bar-mobile: 46px;
	}

	/* ── Status badges ──────────────────────────────────────────────────────── */
	.dtb-status-badge {
		display: inline-flex;
		align-items: center;
		padding: 3px 10px;
		border-radius: 20px;
		font-size: 11px;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: .6px;
		white-space: nowrap;
	}
	.dtb-status-submitted,
	.dtb-status-awaiting_customer { background: #fef3c7; color: #92400e; }
	.dtb-status-reviewed,
	.dtb-status-approved,
	.dtb-status-quoted,
	.dtb-status-quote_accepted,
	.dtb-status-parts_allocated,
	.dtb-status-in_progress       { background: #dbeafe; color: #1e40af; }
	.dtb-status-ready_to_ship,
	.dtb-status-completed         { background: #dcfce7; color: #166534; }
	.dtb-status-closed,
	.dtb-status-quote_declined    { background: #f3f4f6; color: #6b7280; }
	.dtb-status-cancelled         { background: #fee2e2; color: #991b1b; }

	/* ── SLA helpers ────────────────────────────────────────────────────────── */
	.dtb-sla-breached { color: #dc2626; font-weight: 600; }
	.dtb-sla-ok       { color: #16a34a; }

	/* ============================================================
	   LIST PAGE — modern e-commerce admin dashboard styles
	   ============================================================ */

	/* ── Page wrapper ─────────────────────────────────────────── */
	.dtb-repairs-wrap { padding: 12px 0 0; }

	/* ── Stats row ────────────────────────────────────────────── */
	.dtb-stats-row {
		display: grid;
		grid-template-columns: repeat(5,1fr);
		gap: 12px;
		margin-bottom: 20px;
	}
	.dtb-stat-card {
		background: #fff;
		border: 1px solid var(--dtb-border);
		border-radius: var(--dtb-radius);
		padding: 10px 14px 10px 16px;
		position: relative;
		overflow: hidden;
		box-shadow: var(--dtb-shadow);
		display: flex;
		align-items: center;
		gap: 10px;
		min-height: 48px;
	}
	.dtb-stat-card::before {
		content: '';
		position: absolute;
		left: 0; top: 0; bottom: 0;
		width: 3px;
		border-radius: var(--dtb-radius) 0 0 var(--dtb-radius);
	}
	.dtb-sc-total::before    { background: #6366f1; }
	.dtb-sc-active::before   { background: #3b82f6; }
	.dtb-sc-ready::before    { background: #10b981; }
	.dtb-sc-completed::before{ background: #22c55e; }
	.dtb-sc-cancelled::before{ background: #ef4444; }
	.dtb-stat-num {
		font-size: 22px;
		font-weight: 800;
		color: var(--dtb-text);
		line-height: 1;
		letter-spacing: -.5px;
		flex-shrink: 0;
	}
	.dtb-stat-label {
		font-size: 11px;
		font-weight: 600;
		color: var(--dtb-muted);
		text-transform: uppercase;
		letter-spacing: .5px;
		line-height: 1.3;
	}

	/* ── List shell (white card — tabs + table) ───────────────── */
	.dtb-list-shell {
		background: #fff;
		border: 1px solid var(--dtb-border);
		border-radius: 12px;
		overflow: hidden;
		box-shadow: var(--dtb-shadow);
	}

	/* ── Tab bar ──────────────────────────────────────────────── */
	.dtb-tab-bar {
		display: flex;
		align-items: stretch;
		justify-content: space-between;
		border-bottom: 1px solid var(--dtb-border);
		padding: 0 20px;
		background: #fff;
		min-height: 48px;
	}
	.dtb-tabs { display: flex; gap: 0; align-items: stretch; }
	.dtb-tab {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		padding: 0 16px;
		font-size: 13px;
		font-weight: 600;
		color: var(--dtb-muted);
		text-decoration: none;
		border-bottom: 2px solid transparent;
		margin-bottom: -1px;
		transition: color .15s, border-color .15s;
		white-space: nowrap;
		cursor: pointer;
	}
	.dtb-tab:hover { color: var(--dtb-blue); text-decoration: none; }
	.dtb-tab.dtb-tab-current {
		color: var(--dtb-blue);
		border-bottom-color: var(--dtb-blue);
	}
	.dtb-tab-badge {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-width: 20px;
		height: 18px;
		padding: 0 6px;
		border-radius: 9px;
		font-size: 10px;
		font-weight: 700;
		background: #f3f4f6;
		color: var(--dtb-muted);
		transition: background .15s, color .15s;
	}
	.dtb-tab.dtb-tab-current .dtb-tab-badge { background: #dbeafe; color: var(--dtb-blue); }
	.dtb-tab-bar-right {
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 8px 0;
		flex-shrink: 0;
	}
	.dtb-tab-bar-right .button-primary {
		border-radius: 8px !important;
		font-weight: 700 !important;
		font-size: 12px !important;
		padding: 5px 14px !important;
		height: auto !important;
	}

	/* ── Status chip filter bar ───────────────────────────────── */
	.dtb-chip-bar {
		display: flex;
		gap: 6px;
		padding: 10px 20px;
		border-bottom: 1px solid #f3f4f6;
		flex-wrap: wrap;
		background: #fafafa;
		align-items: center;
	}
	.dtb-chip {
		display: inline-flex;
		align-items: center;
		gap: 5px;
		padding: 4px 11px;
		border-radius: 20px;
		font-size: 12px;
		font-weight: 600;
		color: var(--dtb-muted);
		background: #f3f4f6;
		text-decoration: none;
		border: 1.5px solid transparent;
		transition: all .15s;
		white-space: nowrap;
		line-height: 1.4;
	}
	.dtb-chip:hover { background: #e5e7eb; color: #374151; text-decoration: none; }
	.dtb-chip.dtb-chip-active {
		background: var(--dtb-blue-light);
		color: var(--dtb-blue);
		border-color: #bfdbfe;
	}
	.dtb-chip-count {
		font-size: 10px;
		background: rgba(0,0,0,.08);
		border-radius: 8px;
		padding: 0 5px;
		min-width: 16px;
		text-align: center;
	}
	.dtb-chip-active .dtb-chip-count { background: rgba(29,78,216,.12); }

	/* ── Table wrapper ────────────────────────────────────────── */
	.dtb-table-wrap { padding: 0; }

	.dtb-table-wrap .search-box {
		padding: 12px 20px;
		border-bottom: 1px solid #f3f4f6;
		display: flex;
		gap: 8px;
		align-items: center;
		background: #fff;
	}
	.dtb-table-wrap .search-box #dtb-repair-search-input,
	.dtb-table-wrap .search-box input[type="search"] {
		border: 1px solid #e5e7eb !important;
		border-radius: 8px !important;
		padding: 6px 12px !important;
		font-size: 13px !important;
		min-width: 220px;
		background: #f9fafb !important;
		transition: border-color .15s, background .15s;
	}
	.dtb-table-wrap .search-box input[type="search"]:focus {
		border-color: var(--dtb-blue) !important;
		background: #fff !important;
		outline: none !important;
		box-shadow: 0 0 0 3px rgba(29,78,216,.1) !important;
	}
	.dtb-table-wrap .search-box .button {
		border-radius: 8px !important;
		font-size: 12px !important;
		font-weight: 600 !important;
		height: auto !important;
		padding: 6px 14px !important;
	}

	/* ── WP_List_Table overrides ─────────────────────────────── */
	.dtb-repairs-wrap .wp-list-table {
		border: none !important;
		box-shadow: none !important;
		background: transparent !important;
		margin: 0 !important;
	}
	.dtb-repairs-wrap .wp-list-table thead th,
	.dtb-repairs-wrap .wp-list-table thead td {
		background: #f9fafb !important;
		border-bottom: 1px solid #e9ebee !important;
		border-top: none !important;
		color: var(--dtb-muted) !important;
		font-size: 11px !important;
		font-weight: 700 !important;
		text-transform: uppercase !important;
		letter-spacing: .55px !important;
		padding: 10px 12px !important;
	}
	.dtb-repairs-wrap .wp-list-table th a { color: var(--dtb-muted) !important; }
	.dtb-repairs-wrap .wp-list-table th a:hover { color: var(--dtb-blue) !important; }
	.dtb-repairs-wrap .wp-list-table tbody tr {
		border-bottom: 1px solid #f3f4f6;
		transition: background .1s;
	}
	.dtb-repairs-wrap .wp-list-table tbody tr:hover { background: #f5f8ff !important; }
	.dtb-repairs-wrap .wp-list-table tbody tr:last-child { border-bottom: none; }
	.dtb-repairs-wrap .wp-list-table td,
	.dtb-repairs-wrap .wp-list-table th {
		padding: 12px !important;
		vertical-align: middle !important;
		border-top: none !important;
		box-shadow: none !important;
	}
	.dtb-repairs-wrap .wp-list-table td.check-column,
	.dtb-repairs-wrap .wp-list-table th.check-column {
		width: 36px !important;
		padding: 12px 8px !important;
	}
	.dtb-repairs-wrap .wp-list-table a { color: var(--dtb-text); font-weight: 600; text-decoration: none; }
	.dtb-repairs-wrap .wp-list-table a:hover { color: var(--dtb-blue); }
	.dtb-repairs-wrap .wp-list-table .row-actions { color: var(--dtb-muted); font-size: 11px; }
	.dtb-repairs-wrap .wp-list-table .row-actions a { font-weight: 400; color: var(--dtb-blue); }
	.dtb-repairs-wrap .widefat { border-radius: 0 !important; border: none !important; }

	/* ── Tablenav (bulk actions + pagination) ─────────────────── */
	.dtb-repairs-wrap .tablenav {
		padding: 10px 20px;
		background: #fff;
		border-top: 1px solid #f3f4f6;
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: 8px;
		margin: 0 !important;
	}
	.dtb-repairs-wrap .tablenav.top { border-top: none; border-bottom: 1px solid #f3f4f6; }
	.dtb-repairs-wrap .tablenav .tablenav-pages { margin: 0; }
	.dtb-repairs-wrap .tablenav .bulkactions { display: flex; gap: 8px; align-items: center; }
	.dtb-repairs-wrap .tablenav .bulkactions select {
		border-radius: 7px !important; font-size: 12px !important;
		border-color: var(--dtb-border) !important; height: auto !important; padding: 5px 8px !important;
	}
	.dtb-repairs-wrap .tablenav .bulkactions input[type="submit"] {
		border-radius: 7px !important; font-size: 12px !important;
		font-weight: 600 !important; height: auto !important; padding: 5px 12px !important;
	}
	.dtb-repairs-wrap .tablenav .displaying-num { font-size: 12px; color: #9ca3af; }
	.dtb-repairs-wrap .tablenav-pages .pagination-links .button { border-radius: 6px !important; }
	.dtb-repairs-wrap .column-repair_id    { width: 90px; }
	.dtb-repairs-wrap .column-customer     { min-width: 160px; }
	.dtb-repairs-wrap .column-tool         { min-width: 160px; }
	.dtb-repairs-wrap .column-status       { width: 145px; }
	.dtb-repairs-wrap .column-wc_order     { width: 90px; text-align: center; }
	.dtb-repairs-wrap .column-last_event   { min-width: 150px; }
	.dtb-repairs-wrap .column-date_created { width: 130px; }

	/* ── Kill WP's striped alternating rows ──────────────────── */
	.dtb-repairs-wrap .wp-list-table.striped > tbody > tr:nth-child(odd) {
		background: transparent !important;
	}
	.dtb-repairs-wrap .wp-list-table.striped > tbody > tr:nth-child(odd):hover {
		background: #f5f8ff !important;
	}

	/* ── Page header ──────────────────────────────────────────── */
	.dtb-page-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: 18px;
	}
	.dtb-page-header h1 {
		margin: 0;
		padding: 0;
		font-size: 20px;
		font-weight: 800;
		color: var(--dtb-text);
		line-height: 1.2;
		border: none;
	}
	.dtb-page-header .dtb-page-subtitle {
		display: block;
		font-size: 12px;
		font-weight: 400;
		color: var(--dtb-muted);
		margin-top: 3px;
	}

	/* ── Secondary cell text ──────────────────────────────────── */
	.dtb-cell-sub {
		display: block;
		font-size: 11px;
		color: var(--dtb-muted);
		font-weight: 400;
		margin-top: 2px;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		max-width: 180px;
	}

	/* ── Age / SLA coloring ───────────────────────────────────── */
	.dtb-age-ok       { color: var(--dtb-muted); }
	.dtb-age-warn     { color: #b45309; font-weight: 600; }
	.dtb-age-critical { color: #dc2626; font-weight: 700; }

	/* ── Repair ID link ───────────────────────────────────────── */
	.dtb-repairs-wrap .column-repair_id strong a {
		color: var(--dtb-blue);
		font-size: 13px;
		font-weight: 700;
	}

	/* ── Integration badges (list table) ─────────────────────── */
	.dtb-repairs-wrap .column-veeqo,
	.dtb-repairs-wrap .column-quickbooks,
	.dtb-repairs-wrap .column-wc_order {
		text-align: center;
	}
	.dtb-int-ok    { color: #16a34a; font-weight: 700; font-size: 14px; }
	.dtb-int-err   { color: #dc2626; font-weight: 700; font-size: 14px; }
	.dtb-int-dash  { color: #d1d5db; font-size: 14px; }

	/* ── Last-event cell ──────────────────────────────────────── */
	.dtb-last-event-type {
		font-size: 12px;
		font-weight: 600;
		color: var(--dtb-text);
		display: block;
		font-family: 'SFMono-Regular', Consolas, monospace;
	}
	.dtb-last-event-time {
		display: block;
		font-size: 11px;
		color: var(--dtb-muted);
		margin-top: 2px;
	}

	/* ── Notice refinement ────────────────────────────────────── */
	.dtb-repairs-wrap .notice {
		border-radius: 8px;
		margin-bottom: 14px;
	}

	/* ── Responsive: list / ops pages ──────────────────────────── */
	@media (max-width: 960px) {
		.dtb-stats-row { grid-template-columns: repeat(3, 1fr); }
	}
	@media (max-width: 782px) {
		.dtb-stats-row     { grid-template-columns: repeat(3, 1fr); gap: 8px; margin-bottom: 10px; }
		.dtb-stat-num      { font-size: 20px; }
		.dtb-tab-bar       { padding: 0 10px; flex-wrap: nowrap; overflow-x: auto; -webkit-overflow-scrolling: touch; gap: 0; }
		.dtb-tabs          { flex-wrap: nowrap; flex-shrink: 0; }
		.dtb-tab           { padding: 0 12px; font-size: 12px; flex-shrink: 0; }
		.dtb-tab-bar-right { flex-shrink: 0; padding: 6px 0; }
		.dtb-chip-bar      { flex-wrap: nowrap; overflow-x: auto; -webkit-overflow-scrolling: touch; padding: 8px 10px; gap: 4px; }
		.dtb-chip          { flex-shrink: 0; }
		.dtb-table-wrap    { overflow-x: auto; -webkit-overflow-scrolling: touch; }
		.dtb-repairs-wrap .wp-list-table td,
		.dtb-repairs-wrap .wp-list-table th { padding: 10px 8px !important; }
		.dtb-repairs-wrap .tablenav { flex-wrap: wrap; }
		.dtb-page-header   { flex-wrap: wrap; gap: 8px; margin-bottom: 10px; }
		.dtb-list-shell    { border-radius: 8px; }
	}
	@media (max-width: 480px) {
		.dtb-stats-row    { grid-template-columns: 1fr 1fr; gap: 6px; }
		.dtb-stat-num     { font-size: 18px; }
		.dtb-stat-card    { padding: 8px 10px 8px 12px; min-height: 42px; }
		.dtb-repairs-wrap { padding: 4px 0 0; }
	}

	<?php if ( $is_edit ) : ?>

	/* ── Hide default WP chrome we don't want on the repair edit screen ─────── */
	#titlediv,
	#postdivrich,
	#post-status-info,
	#minor-publishing,
	#misc-publishing-actions,
	.misc-pub-section.misc-pub-section-last,
	#submitdiv .handle-actions,
	#submitdiv h2.hndle span,
	#screen-meta,
	#screen-meta-links,
	#contextual-help-link-wrap,
	.page-title-action,
	#wp-content-editor-tools,
	#wp-content-wrap,
	.wp-editor-container,
	#postdiv,
	#ed_toolbar,
	#post-status-info,
	#revisionsdiv { display: none !important; }

	/* Keep save button but style it our way */
	#submitdiv { border: none !important; background: transparent !important; box-shadow: none !important; }
	#submitdiv .inside { padding: 0 !important; }
	#submitdiv .hndle { display: none !important; }
	#submitdiv #publishing-action { display: flex; padding: 16px 0 0; }
	#submitdiv #publishing-action .spinner { float: none; margin: 0 6px 0 0; }
	#submitdiv #publish {
		width: 100%;
		background: var(--dtb-blue) !important;
		border-color: var(--dtb-blue) !important;
		color: #fff !important;
		border-radius: 8px !important;
		padding: 9px 0 !important;
		font-size: 13px !important;
		font-weight: 600 !important;
		cursor: pointer;
		transition: opacity .15s;
	}
	#submitdiv #publish:hover { opacity: .88; }
	#postbox-container-1 .meta-box-sortables {
		display: flex;
		flex-direction: column;
		gap: 0;
	}
	#postbox-container-1 #postcustom { order: 60; }
	#postbox-container-1 #submitdiv { order: 999; }
	#postbox-container-1 #submitdiv.postbox {
		margin-top: 8px !important;
	}
	#postcustom .inside {
		padding: 12px !important;
	}
	#postcustom table,
	#postcustom .inside > div {
		width: 100% !important;
		box-sizing: border-box;
	}
	#postcustom input[type="text"],
	#postcustom textarea,
	#postcustom select {
		width: 100% !important;
		max-width: 100% !important;
		box-sizing: border-box;
	}

	/* ── Page layout ────────────────────────────────────────────────────────── */
	#poststuff { padding-top: 0 !important; margin-top: 0 !important; }
	#post-body { margin-top: 0 !important; }
	.wrap > h1.wp-heading-inline,
	.wrap > hr.wp-header-end { display: none; }

	/* ── Repair hero banner ─────────────────────────────────────────────────── */
	#dtb-repair-hero {
		background: linear-gradient(135deg, #0f172a 0%, #1e3a5f 100%);
		color: #fff;
		padding: 24px 28px 20px;
		border-radius: var(--dtb-radius);
		margin: 0 0 20px;
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 20px;
		box-shadow: var(--dtb-shadow-md);
	}
	#dtb-repair-hero .dtb-hero-left { flex: 1; min-width: 0; }
	#dtb-repair-hero .dtb-hero-top {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 20px;
	}
	#dtb-repair-hero .dtb-hero-identity { min-width: 0; }
	#dtb-repair-hero .dtb-hero-id {
		font-size: 11px;
		font-weight: 700;
		letter-spacing: .8px;
		text-transform: uppercase;
		color: rgba(255,255,255,.55);
		margin-bottom: 4px;
	}
	#dtb-repair-hero .dtb-hero-title {
		font-size: 20px;
		font-weight: 700;
		color: #fff;
		margin: 0 0 10px;
		line-height: 1.2;
	}
	#dtb-repair-hero .dtb-hero-status-inline { margin: 0 0 10px; }
	#dtb-repair-hero .dtb-hero-meta {
		display: flex;
		flex-wrap: wrap;
		gap: 6px 16px;
		font-size: 12px;
		color: rgba(255,255,255,.65);
		align-items: center;
	}
	#dtb-repair-hero .dtb-hero-meta span { display: flex; align-items: center; gap: 4px; }
	#dtb-repair-hero .dtb-hero-right { display: none; }
	#dtb-repair-hero .dtb-hero-wc a {
		font-size: 12px;
		color: rgba(255,255,255,.75);
		text-decoration: none;
		border: 1px solid rgba(255,255,255,.25);
		padding: 4px 10px;
		border-radius: 6px;
		transition: background .15s;
	}
	#dtb-repair-hero .dtb-hero-wc a:hover { background: rgba(255,255,255,.1); }
	#dtb-repair-hero .dtb-hero-integrations {
		min-width: 420px;
		max-width: 560px;
		display: grid;
		grid-template-columns: repeat(4, minmax(88px, 1fr));
		gap: 8px;
	}
	#dtb-repair-hero .dtb-hero-int-item {
		display: flex;
		flex-direction: column;
		gap: 4px;
		padding: 8px 10px;
		background: rgba(255,255,255,.06);
		border: 1px solid rgba(255,255,255,.15);
		border-radius: 8px;
	}
	#dtb-repair-hero .dtb-hero-int-name {
		font-size: 10px;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: .45px;
		color: rgba(255,255,255,.62);
	}
	#dtb-repair-hero .dtb-hero-int-meta {
		font-size: 11px;
		font-weight: 600;
		color: rgba(255,255,255,.82);
		text-decoration: none;
	}
	#dtb-repair-hero .dtb-hero-int-meta:hover { text-decoration: underline; }
	#dtb-repair-hero .dtb-hero-int-item .dtb-int-pill { font-size: 10px; }
	#dtb-repair-hero .dtb-hero-int-item .dtb-int-synced   { background: #bbf7d0; color: #14532d; }
	#dtb-repair-hero .dtb-hero-int-item .dtb-int-pending  { background: #fde68a; color: #78350f; }
	#dtb-repair-hero .dtb-hero-int-item .dtb-int-error    { background: #fecaca; color: #7f1d1d; }
	#dtb-repair-hero .dtb-hero-int-item .dtb-int-not_configured,
	#dtb-repair-hero .dtb-hero-int-item .dtb-int-not_eligible { background: #e5e7eb; color: #6b7280; }
	#dtb-repair-workspace-tabs {
		margin: -6px 0 16px;
		background: #fff;
		border: 1px solid var(--dtb-border);
		border-radius: 10px;
		padding: 8px;
		display: flex;
		gap: 8px;
		flex-wrap: wrap;
		box-shadow: var(--dtb-shadow);
	}
	.dtb-workspace-tab {
		border: 1px solid #dbe1ea;
		background: #f8fafc;
		color: #475569;
		border-radius: 8px;
		padding: 7px 12px;
		font-size: 12px;
		font-weight: 700;
		letter-spacing: .2px;
		cursor: pointer;
	}
	.dtb-workspace-tab:hover { border-color: #bfdbfe; color: #1e40af; }
	.dtb-workspace-tab.is-active {
		background: #eff6ff;
		border-color: #93c5fd;
		color: #1d4ed8;
	}
	.dtb-workspace-tab-badge {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-width: 18px;
		height: 18px;
		padding: 0 6px;
		margin-left: 6px;
		font-size: 10px;
		font-weight: 700;
		line-height: 1;
		color: #fff;
		background: #dc2626;
		border-radius: 999px;
	}
	.dtb-workspace-hidden { display: none !important; }
	.dtb-tech-workspace { display: grid; gap: 14px; }
	.dtb-tech-grid {
		display: grid;
		grid-template-columns: repeat(2, minmax(0,1fr));
		gap: 12px;
	}
	.dtb-tech-card {
		border: 1px solid var(--dtb-border);
		background: #f9fafb;
		border-radius: 10px;
		padding: 12px;
	}
	.dtb-tech-card h3 {
		margin: 0 0 6px;
		font-size: 13px;
		font-weight: 700;
		color: #0f172a;
	}
	.dtb-tech-help {
		margin: 0 0 8px;
		font-size: 11px;
		color: #64748b;
	}
	.dtb-tech-label {
		display: block;
		font-size: 11px;
		font-weight: 700;
		color: #475569;
		margin: 8px 0 4px;
	}
	.dtb-tech-input,
	.dtb-tech-textarea {
		width: 100%;
		border: 1px solid #d7dee9;
		border-radius: 8px;
		background: #fff;
		padding: 8px 10px;
		font-size: 12px;
		color: #111827;
		box-sizing: border-box;
	}
	.dtb-tech-textarea { min-height: 124px; resize: vertical; }
	.dtb-tech-textarea-sm { min-height: 82px; }
	.dtb-tech-input:focus,
	.dtb-tech-textarea:focus {
		outline: none;
		border-color: var(--dtb-blue);
		box-shadow: 0 0 0 3px rgba(29,78,216,.14);
	}
	.dtb-tech-row {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 8px;
	}
	.dtb-tech-checkbox {
		display: inline-flex;
		align-items: center;
		gap: 7px;
		font-size: 12px;
		font-weight: 600;
		color: #1f2937;
	}
	.dtb-tech-sync-meta {
		margin-top: 10px;
		padding: 10px;
		border: 1px solid #dbe7ff;
		background: #f8fbff;
		border-radius: 8px;
		font-size: 11px;
		color: #334155;
		display: grid;
		gap: 4px;
	}
	.dtb-tech-sync-checksum {
		word-break: break-all;
		font-family: SFMono-Regular, Consolas, Monaco, monospace;
	}
	.dtb-tech-lookup-menu {
		position: relative;
		margin-top: 6px;
		border: 1px solid #d7dee9;
		border-radius: 8px;
		background: #fff;
		box-shadow: 0 8px 24px rgba(0,0,0,.12);
		max-height: 230px;
		overflow: auto;
		z-index: 18;
	}
	.dtb-tech-lookup-option {
		display: block;
		width: 100%;
		border: 0;
		border-bottom: 1px solid #eef2f7;
		background: #fff;
		text-align: left;
		padding: 8px 10px;
		cursor: pointer;
	}
	.dtb-tech-lookup-option:last-child { border-bottom: none; }
	.dtb-tech-lookup-option:hover,
	.dtb-tech-lookup-option:focus {
		outline: none;
		background: #eff6ff;
	}
	.dtb-tech-lookup-primary {
		display: block;
		font-size: 12px;
		font-weight: 700;
		color: #0f172a;
	}
	.dtb-tech-lookup-secondary {
		display: block;
		margin-top: 2px;
		font-size: 11px;
		color: #64748b;
	}
	.dtb-tech-selected-list {
		display: grid;
		gap: 8px;
		margin-top: 6px;
	}
	.dtb-tech-selected-empty {
		padding: 10px;
		border: 1px dashed #cbd5e1;
		border-radius: 8px;
		font-size: 11px;
		color: #64748b;
		background: #f8fafc;
	}
	.dtb-tech-selected-item {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 10px;
		padding: 8px 10px;
		border: 1px solid #dbe7ff;
		border-radius: 8px;
		background: #f8fbff;
	}
	.dtb-tech-selected-item[draggable="true"] { cursor: grab; }
	.dtb-tech-selected-item.is-dragging { opacity: .55; cursor: grabbing; }
	.dtb-tech-selected-item.is-drop-target { border-color: #60a5fa; background: #eff6ff; }
	.dtb-tech-selected-main { min-width: 0; }
	.dtb-tech-selected-title {
		font-size: 12px;
		font-weight: 700;
		color: #0f172a;
	}
	.dtb-tech-selected-sub {
		font-size: 11px;
		color: #64748b;
		margin-top: 2px;
	}
	.dtb-tech-selected-actions {
		display: inline-flex;
		align-items: center;
		gap: 8px;
	}
	.dtb-tech-selected-remove {
		border: 0;
		background: #fee2e2;
		color: #991b1b;
		font-size: 11px;
		font-weight: 700;
		border-radius: 999px;
		padding: 4px 8px;
		cursor: pointer;
	}

	/* ── Sticky action bar (appears on scroll) ──────────────────────────────── */
	#dtb-sticky-bar {
		position: fixed;
		top: 32px; /* below WP admin bar */
		left: 160px;
		right: 0;
		background: #fff;
		border-bottom: 1px solid var(--dtb-border);
		padding: 8px 24px;
		display: none;
		align-items: center;
		justify-content: space-between;
		z-index: 999;
		box-shadow: 0 2px 8px rgba(0,0,0,.08);
	}
	#dtb-sticky-bar.dtb-visible { display: flex; }
	#dtb-sticky-bar .dtb-sb-title { font-weight: 600; font-size: 13px; color: var(--dtb-text); }
	#dtb-sticky-bar .dtb-sb-actions { display: flex; align-items: center; gap: 10px; }

	/* ── Metabox card restyle ───────────────────────────────────────────────── */
	#postbox-container-1 .postbox,
	#postbox-container-2 .postbox {
		background: var(--dtb-surface);
		border: 1px solid var(--dtb-border) !important;
		border-radius: var(--dtb-radius) !important;
		box-shadow: var(--dtb-shadow);
		margin-bottom: 16px !important;
		overflow: hidden;
	}
	.postbox .hndle {
		background: #f9fafb !important;
		border-bottom: 1px solid var(--dtb-border) !important;
		padding: 12px 16px !important;
		font-size: 12px !important;
		font-weight: 700 !important;
		text-transform: uppercase !important;
		letter-spacing: .6px !important;
		color: var(--dtb-muted) !important;
		cursor: default !important;
	}
	.postbox .hndle .toggle-indicator { display: none !important; }
	.postbox .inside { padding: 16px !important; }
	.postbox.closed .inside { display: block !important; } /* keep all boxes open */
	.postbox .handle-actions { display: none !important; } /* hide collapse toggle */

	/* ── Main workspace grid ──────────────────────────────────────────────── */
	#postbox-container-2 #normal-sortables {
		display: grid;
		grid-template-columns: minmax(0, 1.4fr) minmax(0, 1fr);
		gap: 16px;
	}
	#postbox-container-2 #normal-sortables .dtb-top-grid {
		grid-column: 1 / -1;
		display: grid;
		grid-template-columns: minmax(0, 1.4fr) minmax(0, 1fr);
		gap: 16px;
	}
	#postbox-container-2 #normal-sortables .dtb-top-grid > .postbox {
		margin: 0 !important;
	}
	#postbox-container-2 #normal-sortables > .postbox {
		margin: 0 !important;
		grid-column: 1 / -1; /* default full width */
	}
	#postbox-container-2 #dtb-repair-command-center,
	#postbox-container-2 #dtb-repair-order-details {
		grid-column: auto; /* top row side-by-side */
	}
	#postbox-container-2 #dtb-repair-command-center { order: 1; }
	#postbox-container-2 #dtb-repair-order-details { order: 2; }
	#postbox-container-2 #dtb-repair-technician    { order: 3; }
	#postbox-container-2 #dtb-repair-timeline      { order: 4; }
	#postbox-container-2 #dtb-repair-notes         { order: 5; }

	@media (max-width: 1360px) {
		#postbox-container-2 #normal-sortables {
			grid-template-columns: 1fr;
		}
		#postbox-container-2 #normal-sortables .dtb-top-grid {
			grid-template-columns: 1fr;
		}
		#postbox-container-2 #dtb-repair-command-center,
		#postbox-container-2 #dtb-repair-order-details {
			grid-column: 1 / -1;
		}
	}

	/* ── Customer / Tool detail tables ─────────────────────────────────────── */
	.dtb-repair-metabox table { width: 100%; border-collapse: collapse; }
	.dtb-repair-metabox tr { border-bottom: 1px solid #f3f4f6; }
	.dtb-repair-metabox tr:last-child { border-bottom: none; }
	.dtb-repair-metabox th {
		width: 130px;
		padding: 9px 8px 9px 0;
		text-align: left;
		color: var(--dtb-muted);
		font-size: 11px;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: .5px;
		vertical-align: top;
	}
	.dtb-repair-metabox td {
		padding: 9px 8px;
		color: var(--dtb-text);
		font-size: 13px;
		font-weight: 500;
		vertical-align: top;
		word-break: break-word;
	}

	/* ── Timeline restyle ───────────────────────────────────────────────────── */
	.dtb-repair-timeline { list-style: none; margin: 0; padding: 0; position: relative; }
	.dtb-repair-timeline::before {
		content: '';
		position: absolute;
		left: 7px; top: 6px; bottom: 6px;
		width: 2px;
		background: var(--dtb-border);
	}
	.dtb-repair-timeline li {
		display: flex;
		align-items: flex-start;
		gap: 12px;
		padding: 8px 0;
		border-bottom: none;
		font-size: 12px;
		position: relative;
	}
	.dtb-repair-timeline li::before {
		content: '';
		flex-shrink: 0;
		width: 16px;
		height: 16px;
		border-radius: 50%;
		background: var(--dtb-blue);
		border: 2px solid #fff;
		box-shadow: 0 0 0 2px var(--dtb-blue);
		margin-top: 1px;
		z-index: 1;
	}
	.dtb-repair-timeline li.dtb-ev-customer::before { background: #7c3aed; box-shadow: 0 0 0 2px #7c3aed; }
	.dtb-repair-timeline li.dtb-ev-admin::before    { background: #0891b2; box-shadow: 0 0 0 2px #0891b2; }
	.dtb-repair-timeline li.dtb-ev-system::before   { background: #9ca3af; box-shadow: 0 0 0 2px #9ca3af; }
	.dtb-repair-timeline li.dtb-ev-error::before    { background: #dc2626; box-shadow: 0 0 0 2px #dc2626; }
	.dtb-tl-body { flex: 1; }
	.dtb-tl-type {
		font-weight: 600;
		color: var(--dtb-text);
		font-size: 12px;
		font-family: 'SFMono-Regular', Consolas, monospace;
	}
	.dtb-timeline-time {
		display: block;
		color: var(--dtb-muted);
		font-size: 11px;
		margin-top: 2px;
	}
	.dtb-tl-vis {
		display: inline-block;
		font-size: 10px;
		padding: 1px 6px;
		border-radius: 4px;
		font-weight: 600;
		text-transform: uppercase;
		margin-left: 6px;
		vertical-align: middle;
	}
	.dtb-tl-vis-customer { background: #f3e8ff; color: #7c3aed; }
	.dtb-tl-vis-operator { background: #e0f2fe; color: #0369a1; }
	.dtb-tl-vis-internal { background: #f3f4f6; color: #6b7280; }

	/* ── Customer conversation card ────────────────────────────────────────── */
	.dtb-repair-chat-card {
		margin-top: 14px;
		border: 1px solid var(--dtb-border);
		border-radius: 10px;
		background: #f8fafc;
		padding: 12px;
	}
	.dtb-repair-chat-head {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 10px;
		margin-bottom: 10px;
	}
	.dtb-repair-chat-title {
		font-size: 12px;
		font-weight: 800;
		color: #0f172a;
		text-transform: uppercase;
		letter-spacing: .4px;
	}
	.dtb-repair-chat-subtitle {
		font-size: 11px;
		color: #64748b;
		margin-top: 2px;
	}
	.dtb-repair-chat-unread-badge {
		display: inline-flex;
		align-items: center;
		padding: 2px 8px;
		border-radius: 999px;
		background: #dc2626;
		color: #fff;
		font-size: 10px;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: .3px;
	}
	.dtb-repair-chat-alert {
		margin-bottom: 10px;
		padding: 8px 10px;
		font-size: 12px;
		border-radius: 8px;
		background: #fef3c7;
		color: #92400e;
		border: 1px solid #fcd34d;
	}
	.dtb-repair-chat-list {
		display: flex;
		flex-direction: column;
		gap: 8px;
		max-height: 310px;
		overflow: auto;
		padding-right: 2px;
		margin-bottom: 10px;
	}
	.dtb-repair-chat-empty {
		margin: 0;
		font-size: 12px;
		color: #94a3b8;
	}
	.dtb-repair-chat-item {
		display: flex;
	}
	.dtb-repair-chat-item.from-customer { justify-content: flex-start; }
	.dtb-repair-chat-item.from-admin { justify-content: flex-end; }
	.dtb-repair-chat-bubble {
		max-width: min(100%, 86%);
		padding: 8px 10px;
		border-radius: 10px;
		border: 1px solid transparent;
		box-shadow: 0 1px 1px rgba(15,23,42,.03);
	}
	.dtb-repair-chat-item.from-customer .dtb-repair-chat-bubble {
		background: #ffffff;
		border-color: #ddd6fe;
	}
	.dtb-repair-chat-item.from-admin .dtb-repair-chat-bubble {
		background: #dbeafe;
		border-color: #bfdbfe;
	}
	.dtb-repair-chat-item.is-unread .dtb-repair-chat-bubble {
		border-color: #c026d3;
		box-shadow: 0 0 0 1px rgba(192,38,211,.2);
	}
	.dtb-repair-chat-meta {
		display: flex;
		align-items: center;
		gap: 6px;
		margin-bottom: 4px;
	}
	.dtb-repair-chat-author {
		font-size: 11px;
		font-weight: 700;
		color: #334155;
	}
	.dtb-repair-chat-time {
		font-size: 10px;
		color: #64748b;
	}
	.dtb-repair-chat-pill {
		display: inline-flex;
		align-items: center;
		height: 15px;
		padding: 0 5px;
		font-size: 9px;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: .3px;
		border-radius: 999px;
		background: #f3e8ff;
		color: #86198f;
	}
	.dtb-repair-chat-text {
		font-size: 12px;
		line-height: 1.45;
		color: #0f172a;
		white-space: pre-wrap;
	}
	.dtb-repair-chat-compose {
		display: grid;
		gap: 8px;
	}
	.dtb-repair-chat-input {
		width: 100%;
		min-height: 78px;
		padding: 8px 10px;
		border: 1px solid #cbd5e1;
		border-radius: 8px;
		font-size: 13px;
		line-height: 1.4;
		resize: vertical;
		box-sizing: border-box;
	}
	.dtb-repair-chat-input:focus {
		outline: none;
		border-color: #93c5fd;
		box-shadow: 0 0 0 2px rgba(59,130,246,.15);
	}
	.dtb-repair-chat-actions {
		display: flex;
		align-items: center;
		justify-content: flex-end;
		gap: 8px;
	}
	.dtb-repair-chat-msg {
		margin-right: auto;
		font-size: 12px;
		color: #64748b;
	}
	.dtb-repair-chat-msg.is-ok { color: #166534; }
	.dtb-repair-chat-msg.is-err { color: #b91c1c; }

	/* ── Customer-submitted photos gallery ──────────────────────────────────── */
	.dtb-customer-photos-section {
		margin-top: 14px;
		padding-top: 12px;
		border-top: 1px solid #eef2f7;
	}
	.dtb-customer-photos-head {
		display: flex;
		align-items: center;
		gap: 5px;
		font-size: 11px;
		font-weight: 700;
		color: var(--dtb-muted);
		text-transform: uppercase;
		letter-spacing: .5px;
		margin-bottom: 8px;
		line-height: 1;
	}
	.dtb-customer-photos-head .dashicons {
		font-size: 13px;
		width: 13px;
		height: 13px;
		line-height: 1;
	}
	.dtb-customer-photos-count {
		font-weight: 400;
		color: #94a3b8;
		text-transform: none;
		font-size: 11px;
	}
	.dtb-customer-photos-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(108px, 1fr));
		gap: 8px;
	}
	.dtb-customer-photo-link {
		display: block;
		border-radius: 8px;
		overflow: hidden;
		border: 1px solid var(--dtb-border);
		background: #f8fafc;
		transition: border-color .15s, box-shadow .15s;
		aspect-ratio: 4 / 3;
		line-height: 0;
	}
	.dtb-customer-photo-link:hover {
		border-color: var(--dtb-blue);
		box-shadow: 0 0 0 2px rgba(29,78,216,.1);
	}
	.dtb-customer-photo-link img {
		width: 100% !important;
		height: 100% !important;
		object-fit: cover !important;
		display: block !important;
		border-radius: 0 !important;
	}


	.dtb-integration-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 9px 0;
		border-bottom: 1px solid #f3f4f6;
		font-size: 13px;
	}
	.dtb-integration-row:last-child { border-bottom: none; }
	.dtb-integration-row .dtb-int-label { font-weight: 600; color: var(--dtb-muted); font-size: 11px; text-transform: uppercase; letter-spacing: .5px; }
	.dtb-integration-row .dtb-int-value { display: flex; align-items: center; gap: 6px; }
	.dtb-int-pill {
		display: inline-flex;
		align-items: center;
		padding: 2px 9px;
		border-radius: 12px;
		font-size: 11px;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: .4px;
	}
	.dtb-int-synced   { background: #dcfce7; color: #166534; }
	.dtb-int-pending  { background: #fef3c7; color: #92400e; }
	.dtb-int-error    { background: #fee2e2; color: #991b1b; }
	.dtb-int-stub     { background: #f3f4f6; color: #6b7280; }
	.dtb-int-not_configured,
	.dtb-int-not_eligible { background: #f3f4f6; color: #9ca3af; }
	.dtb-integration-row a { color: var(--dtb-blue); font-weight: 600; font-size: 12px; text-decoration: none; }
	.dtb-integration-row a:hover { text-decoration: underline; }

	/* ── Status Transition panel ────────────────────────────────────────────── */
	#dtb-repair-transition { }
	#dtb-repair-to-status {
		width: 100% !important;
		margin-bottom: 10px !important;
		border: 1px solid var(--dtb-border) !important;
		border-radius: 7px !important;
		padding: 8px 10px !important;
		font-size: 13px !important;
		color: var(--dtb-text) !important;
		background: #fff !important;
	}
	#dtb-repair-transition-note {
		width: 100% !important;
		margin-bottom: 10px !important;
		border: 1px solid var(--dtb-border) !important;
		border-radius: 7px !important;
		padding: 8px 10px !important;
		font-size: 13px !important;
		color: var(--dtb-text) !important;
		box-sizing: border-box !important;
	}
	#dtb-repair-transition-btn.button-primary {
		background: var(--dtb-blue) !important;
		border-color: var(--dtb-blue) !important;
		border-radius: 7px !important;
		padding: 7px 20px !important;
		font-weight: 600 !important;
		font-size: 13px !important;
		height: auto !important;
		cursor: pointer;
		transition: opacity .15s;
	}
	#dtb-repair-transition-btn.button-primary:hover { opacity: .85; }
	#dtb-repair-transition-msg { font-size: 12px; color: var(--dtb-muted); margin-left: 0 !important; display: block; margin-top: 8px; }

	/* ── Command Center metabox ─────────────────────────────────────────────── */
	#dtb-repair-command-center .inside { padding: 0 !important; }
	#dtb-repair-command-center { overflow: hidden; }

	.dtb-command-center { display: block; min-height: 0; }
	.dtb-cc-progress-wrap {
		padding: 16px 20px 8px;
		border-bottom: 1px solid var(--dtb-border);
		background: #fff;
	}
	.dtb-cc-progress-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 10px;
		margin-bottom: 10px;
	}
	.dtb-cc-progress-kicker {
		font-size: 10px;
		font-weight: 700;
		color: var(--dtb-muted);
		text-transform: uppercase;
		letter-spacing: .6px;
	}
	.dtb-cc-progress-track {
		height: 6px;
		border-radius: 999px;
		background: #e5e7eb;
		overflow: hidden;
	}
	.dtb-cc-progress-fill {
		height: 100%;
		background: #2563eb;
		border-radius: 999px;
		transition: width .25s ease-out;
	}
	.dtb-cc-progress-fill-complete { background: #16a34a; }
	.dtb-cc-milestones {
		display: flex;
		justify-content: space-between;
		gap: 10px;
		margin-top: 10px;
	}
	.dtb-cc-ms-item {
		flex: 1;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 5px;
	}
	.dtb-cc-ms-dot-btn {
		border: 0;
		background: transparent;
		padding: 0;
		cursor: default;
		line-height: 1;
		width: 24px;
		height: 24px;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		border-radius: 999px;
		position: relative;
	}
	.dtb-cc-ms-dot-btn.is-clickable { cursor: pointer; }
	.dtb-cc-ms-dot-btn.is-clickable:focus { outline: none; }
	.dtb-cc-ms-dot-btn.is-clickable:focus .dtb-cc-ms-dot {
		box-shadow: 0 0 0 3px rgba(37,99,235,.20);
	}
	.dtb-cc-ms-dot-btn.is-clickable:hover {
		background: rgba(37,99,235,.08);
	}
	.dtb-cc-ms-dot-btn.is-disabled { opacity: .8; }
	.dtb-cc-ms-dot {
		display: block;
		width: 12px;
		height: 12px;
		border-radius: 50%;
		border: 2px solid #cbd5e1;
		background: #fff;
		transition: border-color .15s, background-color .15s, transform .15s;
	}
	.dtb-cc-ms-dot-btn.is-clickable:hover .dtb-cc-ms-dot.dtb-ms-future {
		border-color: #2563eb;
	}
	.dtb-cc-ms-dot.dtb-ms-done { border-color: #2563eb; background: #2563eb; transform: scale(1.02); }
	.dtb-cc-ms-dot.dtb-ms-active { border-color: #2563eb; background: #fff; box-shadow: 0 0 0 3px rgba(37,99,235,.18); transform: scale(1.08); }
	.dtb-cc-ms-label {
		font-size: 10px;
		font-weight: 600;
		color: #9ca3af;
		text-align: center;
		line-height: 1.2;
	}
	.dtb-cc-ms-label.dtb-ms-done,
	.dtb-cc-ms-label.dtb-ms-active { color: #1f2937; }
	.dtb-cc-terminal-msg {
		margin-top: 8px;
		display: inline-flex;
		align-items: center;
		padding: 2px 8px;
		border-radius: 999px;
		font-size: 10px;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: .45px;
		background: #f3f4f6;
		color: #6b7280;
	}
	.dtb-cc-panel {
		padding: 18px 20px;
	}
	.dtb-cc-panel + .dtb-cc-panel {
		border-left: 1px solid var(--dtb-border);
	}
	.dtb-cc-section-title {
		font-size: 10px;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: .7px;
		color: var(--dtb-muted);
		margin: 0 0 14px;
		display: flex;
		align-items: center;
		gap: 8px;
	}
	.dtb-cc-section-title::after {
		content: '';
		flex: 1;
		height: 1px;
		background: var(--dtb-border);
	}
	.dtb-cc-current-status {
		display: flex;
		align-items: center;
		gap: 10px;
		margin-bottom: 14px;
		padding: 10px 13px;
		background: #f9fafb;
		border-radius: 8px;
		border: 1px solid var(--dtb-border);
	}
	.dtb-cc-current-label {
		font-size: 10px;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: .5px;
		color: var(--dtb-muted);
		white-space: nowrap;
	}
	.dtb-cc-select {
		width: 100% !important;
		margin-bottom: 8px !important;
		border: 1px solid var(--dtb-border) !important;
		border-radius: 7px !important;
		padding: 8px 10px !important;
		font-size: 13px !important;
		color: var(--dtb-text) !important;
		background: #fff !important;
		box-sizing: border-box;
		display: block;
	}
	.dtb-cc-action-picker {
		position: relative;
		margin-bottom: 10px;
	}
	.dtb-cc-action-toggle {
		width: 100%;
		border: 1px solid var(--dtb-border);
		border-radius: 8px;
		background: #fff;
		color: var(--dtb-text);
		font-size: 13px;
		font-weight: 600;
		padding: 9px 11px;
		display: flex;
		align-items: center;
		justify-content: space-between;
		cursor: pointer;
		text-align: left;
	}
	.dtb-cc-action-toggle:hover { border-color: #cbd5e1; }
	.dtb-cc-action-toggle:focus {
		outline: none;
		border-color: var(--dtb-blue);
		box-shadow: 0 0 0 3px rgba(29,78,216,.14);
	}
	.dtb-cc-action-menu {
		position: absolute;
		left: 0;
		right: 0;
		top: calc(100% + 6px);
		z-index: 12;
		background: #fff;
		border: 1px solid var(--dtb-border);
		border-radius: 10px;
		box-shadow: 0 10px 24px rgba(0,0,0,.12);
		overflow: hidden;
	}
	.dtb-cc-action-option {
		display: block;
		width: 100%;
		border: 0;
		border-bottom: 1px solid #f3f4f6;
		background: #fff;
		color: #111827;
		text-align: left;
		padding: 10px 12px;
		font-size: 13px;
		font-weight: 600;
		cursor: pointer;
	}
	.dtb-cc-action-option:last-child { border-bottom: none; }
	.dtb-cc-action-option:hover { background: #f8fafc; }
	.dtb-cc-action-option:focus {
		outline: none;
		background: #eff6ff;
		color: #1d4ed8;
	}
	.dtb-cc-note {
		width: 100% !important;
		margin-bottom: 10px !important;
		border: 1px solid var(--dtb-border) !important;
		border-radius: 7px !important;
		padding: 8px 10px !important;
		font-size: 13px !important;
		color: var(--dtb-text) !important;
		box-sizing: border-box !important;
		display: block;
	}
	.dtb-cc-note:focus,
	.dtb-cc-select:focus {
		outline: none !important;
		border-color: var(--dtb-blue) !important;
		box-shadow: 0 0 0 3px rgba(29,78,216,.1) !important;
	}
	.dtb-cc-btn {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		padding: 8px 20px;
		background: var(--dtb-blue);
		border: none;
		border-radius: 7px;
		color: #fff;
		font-size: 13px;
		font-weight: 600;
		cursor: pointer;
		transition: opacity .15s;
		line-height: 1.4;
	}
	.dtb-cc-btn:hover { opacity: .85; }
	.dtb-cc-btn:disabled { opacity: .45; cursor: not-allowed; }
	.dtb-cc-msg {
		display: block;
		font-size: 12px;
		color: var(--dtb-muted);
		margin-top: 9px;
		min-height: 16px;
	}
	.dtb-cc-msg-ok  { color: #16a34a !important; font-weight: 600; }
	.dtb-cc-msg-err { color: #dc2626 !important; font-weight: 600; }
	.dtb-cc-terminal {
		font-size: 13px;
		color: var(--dtb-muted);
		font-style: italic;
		padding: 8px 0;
	}

	/* Integration rows in command center */
	.dtb-cc-int-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 9px 0;
		border-bottom: 1px solid #f3f4f6;
		gap: 8px;
	}
	.dtb-cc-int-row:last-child { border-bottom: none; }
	.dtb-cc-int-name {
		font-size: 12px;
		font-weight: 700;
		color: var(--dtb-text);
		display: flex;
		align-items: center;
		gap: 5px;
		min-width: 100px;
		flex-shrink: 0;
	}
	.dtb-cc-int-right {
		display: flex;
		align-items: center;
		gap: 8px;
		flex-wrap: wrap;
		justify-content: flex-end;
	}
	.dtb-cc-int-link {
		font-size: 11px;
		color: var(--dtb-blue);
		text-decoration: none;
		font-weight: 600;
	}
	.dtb-cc-int-link:hover { text-decoration: underline; }
	.dtb-cc-int-meta {
		font-size: 11px;
		color: var(--dtb-muted);
		font-family: 'SFMono-Regular', Consolas, monospace;
	}

	/* ── Internal notes textarea ────────────────────────────────────────────── */
	textarea[name="dtb_repair_internal_notes"] {
		width: 100% !important;
		min-height: 100px !important;
		border: 1px solid var(--dtb-border) !important;
		border-radius: 7px !important;
		padding: 10px 12px !important;
		font-size: 13px !important;
		line-height: 1.5;
		color: var(--dtb-text) !important;
		resize: vertical;
		box-sizing: border-box;
	}

	/* ── Responsive: repair edit / detail page ──────────────────────────────── */
	@media (max-width: 782px) {
		/* WP admin bar collapses to var(--dtb-admin-bar-mobile) on mobile */
		#dtb-sticky-bar {
			left: 0;
			top: var(--dtb-admin-bar-mobile);
			padding: 6px 14px;
		}
		/* Hero banner stacks vertically */
		#dtb-repair-hero {
			flex-direction: column;
			padding: 16px;
			gap: 14px;
			border-radius: 8px;
		}
		#dtb-repair-hero .dtb-hero-top {
			flex-direction: column;
			gap: 12px;
		}
		#dtb-repair-hero .dtb-hero-integrations {
			min-width: 0;
			width: 100%;
			grid-template-columns: repeat(2, 1fr);
		}
		#dtb-repair-hero .dtb-hero-title { font-size: 17px; }
		/* Workspace tabs scroll */
		#dtb-repair-workspace-tabs {
			flex-wrap: nowrap;
			overflow-x: auto;
			-webkit-overflow-scrolling: touch;
			gap: 4px;
			padding: 6px 10px;
		}
		.dtb-workspace-tab { flex-shrink: 0; }
		/* Tech grid */
		.dtb-tech-grid { grid-template-columns: 1fr; }
		.dtb-tech-row  { grid-template-columns: 1fr; }
		/* Customer photos */
		.dtb-customer-photos-grid { grid-template-columns: repeat(auto-fill, minmax(88px, 1fr)); }
		/* Command center panels stack */
		.dtb-cc-panel { padding: 14px 16px; }
		.dtb-cc-panel + .dtb-cc-panel {
			border-left: none;
			border-top: 1px solid var(--dtb-border);
		}
		/* WP two-column layout → single column, side column at bottom */
		/* Use .wp-admin higher specificity to beat WP core's float-based layout.
		   Flex context automatically neutralises float on child containers,
		   so !important is only needed on width/margin which WP sets inline. */
		.wp-admin #post-body.columns-2 {
			display: flex;
			flex-direction: column;
		}
		#post-body.columns-2 #postbox-container-1,
		#post-body.columns-2 #postbox-container-2 {
			float: none !important;
			width: 100% !important;
			margin-left: 0 !important;
			box-sizing: border-box;
		}
		/* Main content (metaboxes) first, side column (Custom Fields + Queue) last */
		#post-body.columns-2 #postbox-container-2 { order: 1; }
		#post-body.columns-2 #postbox-container-1 { order: 99; }
		#postbox-container-2 #normal-sortables {
			grid-template-columns: 1fr;
		}
		#postbox-container-2 #normal-sortables .dtb-top-grid {
			grid-template-columns: 1fr;
		}
	}
	@media (max-width: 600px) {
		#dtb-sticky-bar { top: var(--dtb-admin-bar-mobile); }
		#dtb-repair-hero {
			padding: 12px;
		}
		#dtb-repair-hero .dtb-hero-integrations {
			grid-template-columns: 1fr 1fr;
		}
		#dtb-repair-hero .dtb-hero-id    { font-size: 10px; }
		#dtb-repair-hero .dtb-hero-title { font-size: 15px; }
	}

	<?php endif; ?>
	</style>
	<?php
}

// =============================================================================
// SECTION 3d — LIST PAGE HELPERS (counts, tab groups)
// =============================================================================

/**
 * Return status keys grouped by tab slug.
 * An empty array means "all statuses" (no filter).
 *
 * @param string $tab  Tab slug: all | active | ready | completed | cancelled
 * @return array<string>
 */
function dtb_repair_admin_tab_statuses( string $tab ): array {
	$groups = [
		'active'    => [ 'submitted', 'reviewed', 'awaiting_customer', 'approved', 'quoted', 'quote_accepted', 'parts_allocated', 'in_progress' ],
		'ready'     => [ 'ready_to_ship' ],
		'completed' => [ 'completed', 'closed' ],
		'cancelled' => [ 'cancelled', 'quote_declined' ],
	];
	return $groups[ $tab ] ?? [];
}

/**
 * Count all repair CPT posts grouped by `_repair_status` meta.
 *
 * @return array<string,int>  key → count
 */
function dtb_repair_admin_get_status_counts(): array {
	global $wpdb;
	// phpcs:disable WordPress.DB.DirectDatabaseQuery.DirectQuery,WordPress.DB.DirectDatabaseQuery.NoCaching
	$rows = $wpdb->get_results(
		$wpdb->prepare(
			"SELECT pm.meta_value AS status, COUNT(*) AS cnt
			 FROM {$wpdb->postmeta} pm
			 INNER JOIN {$wpdb->posts} p ON p.ID = pm.post_id
			 WHERE pm.meta_key = %s
			   AND p.post_type   = %s
			   AND p.post_status = 'publish'
			 GROUP BY pm.meta_value",
			'_repair_status',
			'dtb_repair_request'
		)
	);
	// phpcs:enable WordPress.DB.DirectDatabaseQuery.DirectQuery,WordPress.DB.DirectDatabaseQuery.NoCaching
	$out = [];
	foreach ( (array) $rows as $row ) {
		$out[ $row->status ] = (int) $row->cnt;
	}
	return $out;
}

/**
 * Sum counts for a slice of statuses.
 *
 * @param array<string,int> $counts    Full counts map.
 * @param array<string>     $statuses  Keys to sum.
 * @return int
 */
function dtb_repair_admin_sum_counts( array $counts, array $statuses ): int {
	if ( empty( $statuses ) ) {
		return (int) array_sum( $counts );
	}
	return (int) array_sum( array_intersect_key( $counts, array_flip( $statuses ) ) );
}

// =============================================================================
// SECTION 3b — REPAIR HERO BANNER (edit_form_top)
// =============================================================================

add_action( 'edit_form_top', 'dtb_repair_admin_hero_banner' );

/**
 * Render the custom hero banner at the top of the repair CPT edit screen.
 *
 * @param WP_Post $post
 */
function dtb_repair_admin_hero_banner( WP_Post $post ): void {
	if ( 'dtb_repair_request' !== $post->post_type ) {
		return;
	}

	$repair_id   = $post->ID;
	$status      = dtb_get_repair_status( $repair_id );
	$status_lbl  = function_exists( 'dtb_get_repair_status_label' ) ? dtb_get_repair_status_label( $status ) : ucwords( str_replace( '_', ' ', $status ) );
	$customer    = esc_html( (string) get_post_meta( $repair_id, '_repair_customer_name', true ) );
	$email       = esc_html( (string) get_post_meta( $repair_id, '_repair_customer_email', true ) );
	$phone       = esc_html( (string) get_post_meta( $repair_id, '_repair_customer_phone', true ) );
	$brand       = esc_html( (string) get_post_meta( $repair_id, '_repair_tool_brand', true ) );
	$model       = esc_html( (string) get_post_meta( $repair_id, '_repair_model', true ) );
	$category    = esc_html( (string) get_post_meta( $repair_id, '_repair_tool_category', true ) );
	$tier        = esc_html( (string) get_post_meta( $repair_id, '_repair_service_tier', true ) );
	$submitted   = esc_html( (string) get_post_meta( $repair_id, '_repair_submitted_at', true ) );
	$wc_id       = (int) get_post_meta( $repair_id, '_repair_wc_order_id', true );
	$int_raw     = (string) get_post_meta( $repair_id, '_repair_integration_state', true );
	$int_state   = ( '' !== $int_raw ) ? json_decode( $int_raw, true ) : [];
	$wc_state    = $wc_id ? 'synced' : ( $int_state['woocommerce']['state'] ?? 'pending' );
	$veeqo_state = $int_state['veeqo']['state'] ?? 'pending';
	$qb_state    = $int_state['quickbooks']['state'] ?? 'pending';
	$rw_state    = $int_state['rewards']['state'] ?? 'not_eligible';
	$thread_alert_state = function_exists( 'dtb_repair_get_customer_message_alert_state' )
		? dtb_repair_get_customer_message_alert_state( $repair_id, dtb_repair_get_customer_message_thread( $repair_id, 120 ) )
		: [ 'unread_count' => 0 ];
	$unread_customer_messages = (int) ( $thread_alert_state['unread_count'] ?? 0 );

	$tool_desc   = trim( implode( ' — ', array_filter( [ $brand, $model ?: $category ] ) ) );
	$submitted_fmt = $submitted ? date_i18n( 'M j, Y g:i a', strtotime( $submitted ) ) : '';
	?>
	<div id="dtb-repair-hero">
		<div class="dtb-hero-left">
			<div class="dtb-hero-top">
				<div class="dtb-hero-identity">
					<div class="dtb-hero-id">Repair #<?php echo esc_html( (string) $repair_id ); ?></div>
					<div class="dtb-hero-title"><?php echo $customer ? esc_html( $customer ) : esc_html__( '(No customer name)', 'drywall-toolbox' ); ?></div>
					<div class="dtb-hero-status-inline">
						<span class="dtb-status-badge dtb-status-<?php echo esc_attr( $status ); ?>"><?php echo esc_html( $status_lbl ); ?></span>
					</div>
				</div>

				<div class="dtb-hero-integrations">
					<div class="dtb-hero-int-item">
						<span class="dtb-hero-int-name">WooCommerce</span>
						<?php echo dtb_repair_admin_integration_badge( $wc_state ); // phpcs:ignore ?>
						<?php if ( $wc_id ) : ?>
							<a class="dtb-hero-int-meta" href="<?php echo esc_url( admin_url( 'post.php?post=' . $wc_id . '&action=edit' ) ); ?>">
								Order #<?php echo esc_html( (string) $wc_id ); ?> →
							</a>
						<?php endif; ?>
					</div>
					<div class="dtb-hero-int-item">
						<span class="dtb-hero-int-name">Veeqo</span>
						<?php echo dtb_repair_admin_integration_badge( $veeqo_state ); // phpcs:ignore ?>
					</div>
					<div class="dtb-hero-int-item">
						<span class="dtb-hero-int-name">QuickBooks</span>
						<?php echo dtb_repair_admin_integration_badge( $qb_state ); // phpcs:ignore ?>
					</div>
					<div class="dtb-hero-int-item">
						<span class="dtb-hero-int-name">Rewards</span>
						<?php echo dtb_repair_admin_integration_badge( $rw_state ); // phpcs:ignore ?>
					</div>
				</div>
			</div>

			<div class="dtb-hero-meta">
				<?php if ( $email ) : ?>
					<span><span class="dashicons dashicons-email-alt" style="font-size:13px;width:13px;height:13px;vertical-align:middle;margin-right:3px;opacity:.7;"></span><?php echo esc_html( $email ); ?></span>
				<?php endif; ?>
				<?php if ( $phone ) : ?>
					<span><span class="dashicons dashicons-phone" style="font-size:13px;width:13px;height:13px;vertical-align:middle;margin-right:3px;opacity:.7;"></span><?php echo esc_html( $phone ); ?></span>
				<?php endif; ?>
				<?php if ( $tool_desc ) : ?>
					<span><span class="dashicons dashicons-hammer" style="font-size:13px;width:13px;height:13px;vertical-align:middle;margin-right:3px;opacity:.7;"></span><?php echo esc_html( $tool_desc ); ?></span>
				<?php endif; ?>
				<?php if ( $tier ) : ?>
					<span><span class="dashicons dashicons-star-filled" style="font-size:13px;width:13px;height:13px;vertical-align:middle;margin-right:3px;opacity:.7;"></span><?php echo esc_html( ucfirst( $tier ) ); ?></span>
				<?php endif; ?>
				<?php if ( $submitted_fmt ) : ?>
					<span><span class="dashicons dashicons-calendar-alt" style="font-size:13px;width:13px;height:13px;vertical-align:middle;margin-right:3px;opacity:.7;"></span>Submitted <?php echo esc_html( $submitted_fmt ); ?></span>
				<?php endif; ?>
			</div>
		</div>
	</div>

	<div id="dtb-sticky-bar">
		<span class="dtb-sb-title">
			Repair #<?php echo esc_html( (string) $repair_id ); ?>
			&nbsp;—&nbsp;<?php echo $customer ? esc_html( $customer ) : ''; ?>
			&nbsp;<span class="dtb-status-badge dtb-status-<?php echo esc_attr( $status ); ?>" style="font-size:10px;"><?php echo esc_html( $status_lbl ); ?></span>
		</span>
		<div class="dtb-sb-actions">
			<button type="button" class="button" onclick="document.getElementById('publish').click();" style="border-radius:7px;font-weight:600;">
				<span class="dashicons dashicons-saved" style="vertical-align:middle;margin-right:4px;font-size:14px;width:14px;height:14px;line-height:1.4;"></span>Save Notes
			</button>
		</div>
	</div>

	<div id="dtb-repair-workspace-tabs" role="tablist" aria-label="Repair Workspace Tabs">
		<button type="button" class="dtb-workspace-tab is-active" data-dtb-tab="order_details" role="tab" aria-selected="true">
			Order Details
			<?php if ( $unread_customer_messages > 0 ) : ?>
				<span class="dtb-workspace-tab-badge"><?php echo esc_html( (string) $unread_customer_messages ); ?></span>
			<?php endif; ?>
		</button>
		<button type="button" class="dtb-workspace-tab" data-dtb-tab="technician_details" role="tab" aria-selected="false">
			Technician Details
		</button>
		<button type="button" class="dtb-workspace-tab" data-dtb-tab="timeline" role="tab" aria-selected="false">
			Timeline
		</button>
		<button type="button" class="dtb-workspace-tab" data-dtb-tab="all" role="tab" aria-selected="false">
			All Sections
		</button>
	</div>
	<?php
}

// =============================================================================
// SECTION 3c — ADMIN FOOTER SCRIPTS (detail page enhancements)
// =============================================================================

add_action( 'admin_footer', 'dtb_repair_admin_footer_scripts' );

/**
 * Inject JS enhancements for the repair CPT edit screen.
 */
function dtb_repair_admin_footer_scripts(): void {
	$screen = get_current_screen();
	if ( ! $screen || 'dtb_repair_request' !== $screen->post_type ) {
		return;
	}
	?>
	<script>
	(function() {
		'use strict';

		/* ── Sticky header on scroll ── */
		var hero    = document.getElementById('dtb-repair-hero');
		var stickyBar = document.getElementById('dtb-sticky-bar');
		if ( hero && stickyBar ) {
			window.addEventListener('scroll', function() {
				var heroBottom = hero.getBoundingClientRect().bottom;
				if ( heroBottom < 60 ) {
					stickyBar.classList.add('dtb-visible');
				} else {
					stickyBar.classList.remove('dtb-visible');
				}
			}, { passive: true });
		}

		/* ── Keep all postboxes open (prevent WP collapse toggle) ── */
		document.querySelectorAll('.postbox').forEach(function(box) {
			box.classList.remove('closed');
		});
		document.querySelectorAll('.handlediv, .toggle-indicator').forEach(function(el) {
			el.style.display = 'none';
		});

		/* ── Restyle timeline visibility badges and event dots ── */
		document.querySelectorAll('.dtb-repair-timeline li').forEach(function(li) {
			var badge = li.querySelector('.dtb-status-badge');
			if ( ! badge ) return;
			var vis = badge.textContent.trim().toLowerCase();
			li.classList.add('dtb-ev-' + vis);

			// Re-render the badge as a small pill
			badge.className = 'dtb-tl-vis dtb-tl-vis-' + vis;

			// Wrap the text content in structured divs
			var text = li.innerHTML;
			// Find the event type text (between the badge and the time span)
			var typeMatch = li.childNodes;
			var eventType = '';
			typeMatch.forEach(function(node) {
				if ( node.nodeType === 3 ) {
					var t = node.textContent.trim();
					if ( t ) eventType = t;
				}
			});
			var timeEl = li.querySelector('.dtb-timeline-time');
			var timeHtml = timeEl ? timeEl.outerHTML : '';

			if ( eventType || badge ) {
				li.innerHTML =
					'<div class="dtb-tl-body">' +
						'<span class="dtb-tl-type">' + (eventType || '') + '</span>' +
						badge.outerHTML +
						timeHtml +
					'</div>';
			}
		});

		/* ── Auto-expand notes textarea ── */
		var notes = document.querySelector('textarea[name="dtb_repair_internal_notes"]');
		if ( notes ) {
			notes.addEventListener('input', function() {
				this.style.height = 'auto';
				this.style.height = ( this.scrollHeight + 2 ) + 'px';
			});
		}

		/* ── Move the transition metabox to top of #side-sortables ── */
		var side = document.getElementById('side-sortables');
		var transBox = document.getElementById('dtb-repair-transition');
		if ( side && transBox ) {
			side.insertBefore( transBox, side.firstChild );
		}

		/* ── Force Custom Fields metabox into side column (user order safe) ── */
		var postBody = document.getElementById('post-body');
		if ( postBody ) {
			postBody.classList.remove('columns-1');
			postBody.classList.add('columns-2');
		}
		var customFieldsBox = document.getElementById('postcustom');
		if ( side && customFieldsBox && customFieldsBox.parentElement !== side ) {
			side.appendChild(customFieldsBox);
		}

		/* ── Restyle integration status rows ── */
		document.querySelectorAll('.dtb-integration-row').forEach(function(row) {
			var strong = row.querySelector('strong');
			if ( ! strong ) return;
			var label = strong.textContent.replace(':', '').trim();
			strong.outerHTML = '<span class="dtb-int-label">' + label + '</span>';
		});

		/* ── Add pill class to integration state text ── */
		document.querySelectorAll('.dtb-integration-row').forEach(function(row) {
			var text = row.textContent;
			var states = ['synced','pending','error','not_configured','not_eligible','stub_pending','stub_issued','issued'];
			states.forEach(function(st) {
				if ( text.indexOf(st) !== -1 ) {
					// Wrap the state word in a pill if not already wrapped
					row.innerHTML = row.innerHTML.replace(
						new RegExp('\\b(' + st + ')\\b', 'g'),
						'<span class="dtb-int-pill dtb-int-' + st + '">$1</span>'
					);
				}
			});
		});

		/* ── Workspace tabs: show/hide section groups ── */
		var tabButtons = Array.from(document.querySelectorAll('.dtb-workspace-tab'));
		var mountTopGrid = function() {
			var normal = document.getElementById('normal-sortables');
			var command = document.getElementById('dtb-repair-command-center');
			var orderDetails = document.getElementById('dtb-repair-order-details');
			if (!normal || !command || !orderDetails) return;

			var topGrid = normal.querySelector('.dtb-top-grid');
			if (!topGrid) {
				topGrid = document.createElement('div');
				topGrid.className = 'dtb-top-grid';
				normal.insertBefore(topGrid, normal.firstChild);
			}

			if (command.parentElement !== topGrid) {
				topGrid.appendChild(command);
			}
			if (orderDetails.parentElement !== topGrid) {
				topGrid.appendChild(orderDetails);
			}
		};

		mountTopGrid();
		if ( tabButtons.length ) {
			var byId = function(id) { return document.getElementById(id); };
			var groups = {
				order_details: [
					'dtb-repair-command-center',
					'dtb-repair-order-details'
				],
				technician_details: [
					'dtb-repair-command-center',
					'dtb-repair-technician',
					'dtb-repair-order-details',
					'dtb-repair-notes',
					'dtb-repair-queue'
				],
				timeline: [
					'dtb-repair-command-center',
					'dtb-repair-timeline'
				],
				all: []
			};

			var allKnownIds = [
				'dtb-repair-command-center',
				'dtb-repair-technician',
				'dtb-repair-order-details',
				'dtb-repair-timeline',
				'dtb-repair-notes',
				'dtb-repair-queue'
			];

			var setActiveTab = function(tabKey) {
				tabButtons.forEach(function(btn) {
					var isActive = btn.getAttribute('data-dtb-tab') === tabKey;
					btn.classList.toggle('is-active', isActive);
					btn.setAttribute('aria-selected', isActive ? 'true' : 'false');
				});

				if ( tabKey === 'all' ) {
					allKnownIds.forEach(function(id) {
						var el = byId(id);
						if ( el ) el.classList.remove('dtb-workspace-hidden');
					});
					return;
				}

				var visibleSet = new Set(groups[tabKey] || groups.order_details);
				allKnownIds.forEach(function(id) {
					var el = byId(id);
					if ( ! el ) return;
					el.classList.toggle('dtb-workspace-hidden', ! visibleSet.has(id));
				});
			};

			tabButtons.forEach(function(btn) {
				btn.addEventListener('click', function() {
					var tabKey = btn.getAttribute('data-dtb-tab') || 'order_details';
					setActiveTab(tabKey);
					mountTopGrid();
				});
			});

			setActiveTab('order_details');
			mountTopGrid();
		}

		/* ── Live schematic lookup (technician workspace) ── */
		var lookupInput = document.getElementById('dtb_repair_schematic_catalog_id');
		var lookupMenu = document.getElementById('dtb-tech-schematic-lookup-menu');
		var linksInput = document.getElementById('dtb_repair_schematic_links_json');
		var selectedListEl = document.getElementById('dtb-tech-selected-schematics');
		var primaryBrandEl = document.getElementById('dtb-tech-primary-brand');
		var primaryModelEl = document.getElementById('dtb-tech-primary-model');
		var primarySkuEl = document.getElementById('dtb-tech-primary-sku');
		var lookupReq = null;
		var lookupTimer = null;
		var selectedSchematics = [];

		var hideLookupMenu = function() {
			if (!lookupMenu) return;
			lookupMenu.hidden = true;
			lookupMenu.innerHTML = '';
		};

		var renderLookupMenu = function(items) {
			if (!lookupMenu) return;
			if (!items || !items.length) {
				hideLookupMenu();
				return;
			}
			lookupMenu.innerHTML = items.map(function(item) {
				var primary = (item.schematic_id || 'Unknown ID');
				var secondary = [item.brand, item.model_number, item.model_name].filter(Boolean).join(' · ');
				return (
					'<button type="button" class="dtb-tech-lookup-option" ' +
					'data-id="' + String(item.schematic_id || '').replace(/"/g, '&quot;') + '" ' +
					'data-url="' + String(item.url || '').replace(/"/g, '&quot;') + '" ' +
					'data-brand="' + String(item.brand || '').replace(/"/g, '&quot;') + '" ' +
					'data-model="' + String(item.model_number || '').replace(/"/g, '&quot;') + '" ' +
					'data-model-name="' + String(item.model_name || '').replace(/"/g, '&quot;') + '" ' +
					'data-sku="' + String(item.sku || '').replace(/"/g, '&quot;') + '" ' +
					'data-product-name="' + String(item.product_name || '').replace(/"/g, '&quot;') + '" ' +
					'data-version="' + String(item.version || '').replace(/"/g, '&quot;') + '">' +
						'<span class="dtb-tech-lookup-primary">' + primary + '</span>' +
						'<span class="dtb-tech-lookup-secondary">' + (secondary || 'Catalog schematic') + '</span>' +
					'</button>'
				);
			}).join('');
			lookupMenu.hidden = false;
		};

		var renderSelectedSchematics = function() {
			if (!selectedListEl || !linksInput) return;
			if (!selectedSchematics.length) {
				selectedListEl.innerHTML = '<div class="dtb-tech-selected-empty">No schematic selected yet.</div>';
				linksInput.value = '[]';
				if (primaryBrandEl) primaryBrandEl.textContent = '';
				if (primaryModelEl) primaryModelEl.textContent = '';
				if (primarySkuEl) primarySkuEl.textContent = '';
				return;
			}
			selectedListEl.innerHTML = selectedSchematics.map(function(item, idx) {
				var title = item.schematic_id || 'Unknown schematic';
				var subtitle = [item.brand, item.model_number, item.model_name, item.sku ? ('SKU: ' + item.sku) : ''].filter(Boolean).join(' · ');
				var link = item.url ? '<a href="' + item.url + '" target="_blank" rel="noopener noreferrer">Open</a>' : '';
				return (
					'<div class="dtb-tech-selected-item" draggable="true" data-index="' + idx + '">' +
						'<div class="dtb-tech-selected-main">' +
							'<div class="dtb-tech-selected-title">' + title + '</div>' +
							'<div class="dtb-tech-selected-sub">' + (subtitle || 'Catalog schematic') + '</div>' +
						'</div>' +
						'<div class="dtb-tech-selected-actions">' +
							link +
							'<button type="button" class="dtb-tech-selected-remove" data-index="' + idx + '">Remove</button>' +
						'</div>' +
					'</div>'
				);
			}).join('');
			linksInput.value = JSON.stringify(selectedSchematics);
			var primary = selectedSchematics[0] || {};
			if (primaryBrandEl) primaryBrandEl.textContent = primary.brand || '';
			if (primaryModelEl) primaryModelEl.textContent = primary.model_number || primary.model_name || '';
			if (primarySkuEl) primarySkuEl.textContent = primary.sku || '';
		};

		if (lookupInput && lookupMenu && linksInput && selectedListEl && typeof ajaxurl === 'string') {
			try {
				selectedSchematics = JSON.parse(linksInput.value || '[]');
				if (!Array.isArray(selectedSchematics)) selectedSchematics = [];
			} catch (e) {
				selectedSchematics = [];
			}
			renderSelectedSchematics();

			lookupInput.addEventListener('input', function() {
				var term = lookupInput.value.trim();
				if (lookupTimer) window.clearTimeout(lookupTimer);
				if (term.length < 2) {
					hideLookupMenu();
					return;
				}
				lookupTimer = window.setTimeout(function() {
					if (lookupReq && typeof lookupReq.abort === 'function') {
						lookupReq.abort();
					}
					var body = new URLSearchParams();
					body.set('action', 'dtb_repair_schematic_lookup');
					body.set('term', term);
					body.set('nonce', lookupInput.getAttribute('data-lookup-nonce') || '');

					lookupReq = fetch(ajaxurl, {
						method: 'POST',
						headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' },
						body: body.toString(),
						credentials: 'same-origin'
					})
					.then(function(resp) { return resp.json(); })
					.then(function(payload) {
						var items = payload && payload.success && payload.data ? payload.data.items : [];
						renderLookupMenu(items || []);
					})
					.catch(function() { hideLookupMenu(); });
				}, 180);
			});

			lookupMenu.addEventListener('click', function(e) {
				var btn = e.target.closest('.dtb-tech-lookup-option');
				if (!btn) return;
				var sid = btn.getAttribute('data-id') || '';
				var surl = btn.getAttribute('data-url') || '';
				var sver = btn.getAttribute('data-version') || '';
				var existing = selectedSchematics.find(function(item) { return item.schematic_id === sid; });
				if (!existing) {
					selectedSchematics.push({
						schematic_id: sid,
						url: surl,
						version: sver,
						brand: btn.getAttribute('data-brand') || '',
						model_number: btn.getAttribute('data-model') || '',
						model_name: btn.getAttribute('data-model-name') || '',
						sku: btn.getAttribute('data-sku') || '',
						product_name: btn.getAttribute('data-product-name') || ''
					});
				}
				lookupInput.value = '';
				renderSelectedSchematics();
				hideLookupMenu();
			});

			selectedListEl.addEventListener('click', function(e) {
				var removeBtn = e.target.closest('.dtb-tech-selected-remove');
				if (!removeBtn) return;
				var index = parseInt(removeBtn.getAttribute('data-index') || '-1', 10);
				if (index < 0 || index >= selectedSchematics.length) return;
				selectedSchematics.splice(index, 1);
				renderSelectedSchematics();
			});

			var dragFromIndex = -1;
			selectedListEl.addEventListener('dragstart', function(e) {
				var item = e.target.closest('.dtb-tech-selected-item');
				if (!item) return;
				dragFromIndex = parseInt(item.getAttribute('data-index') || '-1', 10);
				item.classList.add('is-dragging');
				if (e.dataTransfer) {
					e.dataTransfer.effectAllowed = 'move';
					e.dataTransfer.setData('text/plain', String(dragFromIndex));
				}
			});
			selectedListEl.addEventListener('dragend', function() {
				dragFromIndex = -1;
				selectedListEl.querySelectorAll('.dtb-tech-selected-item').forEach(function(el) {
					el.classList.remove('is-dragging', 'is-drop-target');
				});
			});
			selectedListEl.addEventListener('dragover', function(e) {
				var item = e.target.closest('.dtb-tech-selected-item');
				if (!item) return;
				e.preventDefault();
				selectedListEl.querySelectorAll('.dtb-tech-selected-item').forEach(function(el) {
					el.classList.remove('is-drop-target');
				});
				item.classList.add('is-drop-target');
			});
			selectedListEl.addEventListener('drop', function(e) {
				var item = e.target.closest('.dtb-tech-selected-item');
				if (!item) return;
				e.preventDefault();
				var toIndex = parseInt(item.getAttribute('data-index') || '-1', 10);
				if (dragFromIndex < 0 || toIndex < 0 || dragFromIndex === toIndex) return;
				var moved = selectedSchematics.splice(dragFromIndex, 1)[0];
				selectedSchematics.splice(toIndex, 0, moved);
				renderSelectedSchematics();
			});

			document.addEventListener('click', function(e) {
				if (!lookupMenu.contains(e.target) && e.target !== lookupInput) {
					hideLookupMenu();
				}
			});
		}

		/* ── Live parts lookup (technician workspace) ── */
		var partsLookupInput = document.getElementById('dtb_repair_parts_lookup');
		var partsLookupMenu = document.getElementById('dtb-tech-parts-lookup-menu');
		var partsLinksInput = document.getElementById('dtb_repair_parts_links_json');
		var selectedPartsEl = document.getElementById('dtb-tech-selected-parts');
		var primaryPartSkuEl = document.getElementById('dtb-tech-primary-part-sku');
		var primaryPartNameEl = document.getElementById('dtb-tech-primary-part-name');
		var primaryPartBrandEl = document.getElementById('dtb-tech-primary-part-brand');
		var partsReq = null;
		var partsTimer = null;
		var selectedParts = [];

		var hidePartsLookupMenu = function() {
			if (!partsLookupMenu) return;
			partsLookupMenu.hidden = true;
			partsLookupMenu.innerHTML = '';
		};

		var renderPartsLookupMenu = function(items) {
			if (!partsLookupMenu) return;
			if (!items || !items.length) {
				hidePartsLookupMenu();
				return;
			}
			partsLookupMenu.innerHTML = items.map(function(item) {
				var primary = (item.sku || 'No SKU') + ' — ' + (item.name || 'Part');
				var secondary = [item.brand_label, item.manufacturer_sku ? ('MFG: ' + item.manufacturer_sku) : ''].filter(Boolean).join(' · ');
				return (
					'<button type="button" class="dtb-tech-lookup-option" ' +
					'data-part-id="' + String(item.part_id || 0).replace(/"/g, '&quot;') + '" ' +
					'data-sku="' + String(item.sku || '').replace(/"/g, '&quot;') + '" ' +
					'data-name="' + String(item.name || '').replace(/"/g, '&quot;') + '" ' +
					'data-brand="' + String(item.brand_label || '').replace(/"/g, '&quot;') + '" ' +
					'data-manufacturer-sku="' + String(item.manufacturer_sku || '').replace(/"/g, '&quot;') + '">' +
						'<span class="dtb-tech-lookup-primary">' + primary + '</span>' +
						'<span class="dtb-tech-lookup-secondary">' + (secondary || 'Parts library item') + '</span>' +
					'</button>'
				);
			}).join('');
			partsLookupMenu.hidden = false;
		};

		var renderSelectedParts = function() {
			if (!selectedPartsEl || !partsLinksInput) return;
			if (!selectedParts.length) {
				selectedPartsEl.innerHTML = '<div class="dtb-tech-selected-empty">No part selected yet.</div>';
				partsLinksInput.value = '[]';
				if (primaryPartSkuEl) primaryPartSkuEl.textContent = '';
				if (primaryPartNameEl) primaryPartNameEl.textContent = '';
				if (primaryPartBrandEl) primaryPartBrandEl.textContent = '';
				return;
			}
			selectedPartsEl.innerHTML = selectedParts.map(function(item, idx) {
				var subtitle = [item.brand_label, item.manufacturer_sku ? ('MFG: ' + item.manufacturer_sku) : ''].filter(Boolean).join(' · ');
				var qty = parseInt(item.quantity || 1, 10);
				if (!qty || qty < 1) qty = 1;
				var lineNote = item.line_note || '';
				return (
					'<div class="dtb-tech-selected-item" draggable="true" data-index="' + idx + '">' +
						'<div class="dtb-tech-selected-main">' +
							'<div class="dtb-tech-selected-title">' + (item.sku || 'No SKU') + ' — ' + (item.name || 'Part') + '</div>' +
							'<div class="dtb-tech-selected-sub">' + (subtitle || 'Parts library item') + '</div>' +
							'<div class="dtb-tech-selected-fields" style="display:grid;grid-template-columns:120px 1fr;gap:8px;margin-top:8px;">' +
								'<input type="number" min="1" step="1" class="dtb-tech-part-qty" data-index="' + idx + '" value="' + qty + '" placeholder="Qty" />' +
								'<input type="text" class="dtb-tech-part-note" data-index="' + idx + '" value="' + String(lineNote).replace(/"/g, '&quot;') + '" placeholder="Line note (installed position, condition, torque, etc.)" />' +
							'</div>' +
						'</div>' +
						'<div class="dtb-tech-selected-actions">' +
							'<button type="button" class="dtb-tech-selected-remove" data-index="' + idx + '">Remove</button>' +
						'</div>' +
					'</div>'
				);
			}).join('');
			partsLinksInput.value = JSON.stringify(selectedParts);
			var primary = selectedParts[0] || {};
			if (primaryPartSkuEl) primaryPartSkuEl.textContent = primary.sku || '';
			if (primaryPartNameEl) primaryPartNameEl.textContent = primary.name || '';
			if (primaryPartBrandEl) primaryPartBrandEl.textContent = primary.brand_label || '';
		};

		if (partsLookupInput && partsLookupMenu && partsLinksInput && selectedPartsEl && typeof ajaxurl === 'string') {
			try {
				selectedParts = JSON.parse(partsLinksInput.value || '[]');
				if (!Array.isArray(selectedParts)) selectedParts = [];
			} catch (e) {
				selectedParts = [];
			}
			renderSelectedParts();

			partsLookupInput.addEventListener('input', function() {
				var term = partsLookupInput.value.trim();
				if (partsTimer) window.clearTimeout(partsTimer);
				if (term.length < 2) {
					hidePartsLookupMenu();
					return;
				}
				partsTimer = window.setTimeout(function() {
					if (partsReq && typeof partsReq.abort === 'function') {
						partsReq.abort();
					}
					var body = new URLSearchParams();
					body.set('action', 'dtb_repair_parts_lookup');
					body.set('term', term);
					body.set('nonce', partsLookupInput.getAttribute('data-lookup-nonce') || '');

					partsReq = fetch(ajaxurl, {
						method: 'POST',
						headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' },
						body: body.toString(),
						credentials: 'same-origin'
					})
					.then(function(resp) { return resp.json(); })
					.then(function(payload) {
						var items = payload && payload.success && payload.data ? payload.data.items : [];
						renderPartsLookupMenu(items || []);
					})
					.catch(function() { hidePartsLookupMenu(); });
				}, 180);
			});

			partsLookupMenu.addEventListener('click', function(e) {
				var btn = e.target.closest('.dtb-tech-lookup-option');
				if (!btn) return;
				var partId = parseInt(btn.getAttribute('data-part-id') || '0', 10);
				var sku = btn.getAttribute('data-sku') || '';
				var existing = selectedParts.find(function(item) {
					return (partId > 0 && parseInt(item.part_id || 0, 10) === partId) || (sku && item.sku === sku);
				});
				if (!existing) {
					selectedParts.push({
						part_id: partId,
						sku: sku,
						name: btn.getAttribute('data-name') || '',
						brand_label: btn.getAttribute('data-brand') || '',
						manufacturer_sku: btn.getAttribute('data-manufacturer-sku') || '',
						quantity: 1,
						line_note: ''
					});
				}
				partsLookupInput.value = '';
				renderSelectedParts();
				hidePartsLookupMenu();
			});

			selectedPartsEl.addEventListener('click', function(e) {
				var removeBtn = e.target.closest('.dtb-tech-selected-remove');
				if (!removeBtn) return;
				var index = parseInt(removeBtn.getAttribute('data-index') || '-1', 10);
				if (index < 0 || index >= selectedParts.length) return;
				selectedParts.splice(index, 1);
				renderSelectedParts();
			});

			selectedPartsEl.addEventListener('input', function(e) {
				var qtyEl = e.target.closest('.dtb-tech-part-qty');
				if (qtyEl) {
					var idx = parseInt(qtyEl.getAttribute('data-index') || '-1', 10);
					if (idx >= 0 && idx < selectedParts.length) {
						var qtyVal = parseInt(qtyEl.value || '1', 10);
						if (!qtyVal || qtyVal < 1) qtyVal = 1;
						selectedParts[idx].quantity = qtyVal;
						partsLinksInput.value = JSON.stringify(selectedParts);
					}
					return;
				}
				var noteEl = e.target.closest('.dtb-tech-part-note');
				if (noteEl) {
					var nidx = parseInt(noteEl.getAttribute('data-index') || '-1', 10);
					if (nidx >= 0 && nidx < selectedParts.length) {
						selectedParts[nidx].line_note = noteEl.value || '';
						partsLinksInput.value = JSON.stringify(selectedParts);
					}
				}
			});

			var dragPartFromIndex = -1;
			selectedPartsEl.addEventListener('dragstart', function(e) {
				var item = e.target.closest('.dtb-tech-selected-item');
				if (!item) return;
				dragPartFromIndex = parseInt(item.getAttribute('data-index') || '-1', 10);
				item.classList.add('is-dragging');
				if (e.dataTransfer) {
					e.dataTransfer.effectAllowed = 'move';
					e.dataTransfer.setData('text/plain', String(dragPartFromIndex));
				}
			});
			selectedPartsEl.addEventListener('dragend', function() {
				dragPartFromIndex = -1;
				selectedPartsEl.querySelectorAll('.dtb-tech-selected-item').forEach(function(el) {
					el.classList.remove('is-dragging', 'is-drop-target');
				});
			});
			selectedPartsEl.addEventListener('dragover', function(e) {
				var item = e.target.closest('.dtb-tech-selected-item');
				if (!item) return;
				e.preventDefault();
				selectedPartsEl.querySelectorAll('.dtb-tech-selected-item').forEach(function(el) {
					el.classList.remove('is-drop-target');
				});
				item.classList.add('is-drop-target');
			});
			selectedPartsEl.addEventListener('drop', function(e) {
				var item = e.target.closest('.dtb-tech-selected-item');
				if (!item) return;
				e.preventDefault();
				var toIndex = parseInt(item.getAttribute('data-index') || '-1', 10);
				if (dragPartFromIndex < 0 || toIndex < 0 || dragPartFromIndex === toIndex) return;
				var moved = selectedParts.splice(dragPartFromIndex, 1)[0];
				selectedParts.splice(toIndex, 0, moved);
				renderSelectedParts();
			});

			document.addEventListener('click', function(e) {
				if (!partsLookupMenu.contains(e.target) && e.target !== partsLookupInput) {
					hidePartsLookupMenu();
				}
			});
		}

	}());
	</script>
	<?php
}

// =============================================================================
// SECTION 4 — LIST PAGE CALLBACK (WP_List_Table)
// =============================================================================

/**
 * Render the All Repairs admin page — modernized dashboard layout.
 */
function dtb_repair_admin_list_page(): void {
	if ( ! current_user_can( 'dtb_manage_repairs' ) ) {
		wp_die( esc_html__( 'You do not have permission to view this page.', 'drywall-toolbox' ) );
	}

	if ( ! class_exists( 'WP_List_Table' ) ) {
		require_once ABSPATH . 'wp-admin/includes/class-wp-list-table.php';
	}

	$table = new DTB_Repair_List_Table();
	$table->prepare_items();

	// ── Status counts ────────────────────────────────────────────────────────
	$counts      = dtb_repair_admin_get_status_counts();
	$n_total     = (int) array_sum( $counts );
	$n_active    = dtb_repair_admin_sum_counts( $counts, dtb_repair_admin_tab_statuses( 'active' ) );
	$n_ready     = dtb_repair_admin_sum_counts( $counts, dtb_repair_admin_tab_statuses( 'ready' ) );
	$n_completed = dtb_repair_admin_sum_counts( $counts, dtb_repair_admin_tab_statuses( 'completed' ) );
	$n_cancelled = dtb_repair_admin_sum_counts( $counts, dtb_repair_admin_tab_statuses( 'cancelled' ) );

	// ── Current tab & chip ───────────────────────────────────────────────────
	// phpcs:disable WordPress.Security.NonceVerification.Recommended
	$current_tab    = isset( $_GET['tab'] )           ? sanitize_text_field( wp_unslash( (string) $_GET['tab'] ) )           : 'all';
	$current_status = isset( $_GET['repair_status'] ) ? sanitize_text_field( wp_unslash( (string) $_GET['repair_status'] ) ) : '';
	// phpcs:enable WordPress.Security.NonceVerification.Recommended

	// Normalise 'all' to a known slug
	if ( ! in_array( $current_tab, [ 'all', 'active', 'ready', 'completed', 'cancelled' ], true ) ) {
		$current_tab = 'all';
	}

	$base_url    = admin_url( 'admin.php?page=dtb-repairs' );
	$tab_statuses = dtb_repair_admin_tab_statuses( $current_tab );

	// ── Ordered list of all statuses for chip bar ────────────────────────────
	$all_statuses_ordered = [
		'submitted', 'reviewed', 'awaiting_customer', 'approved',
		'quoted', 'quote_accepted', 'quote_declined',
		'parts_allocated', 'in_progress',
		'ready_to_ship', 'completed', 'closed', 'cancelled',
	];
	$chip_pool = ( 'all' === $current_tab ) ? $all_statuses_ordered : $tab_statuses;

	// Filter chip pool to statuses that have at least 1 repair (on All tab)
	if ( 'all' === $current_tab ) {
		$chip_pool = array_filter( $chip_pool, static fn( $s ) => ( $counts[ $s ] ?? 0 ) > 0 );
	}
	?>
	<div class="wrap dtb-repairs-wrap">

		<?php if ( ! empty( $_GET['dtb_bulk_msg'] ) ) : // phpcs:ignore WordPress.Security.NonceVerification.Recommended ?>
			<div class="notice notice-success is-dismissible">
				<p><?php echo esc_html( sanitize_text_field( wp_unslash( (string) $_GET['dtb_bulk_msg'] ) ) ); ?></p>
			</div>
		<?php endif; ?>

		<!-- ── Page header ────────────────────────────────────────────────── -->
		<div class="dtb-page-header">
			<div>
				<h1><?php esc_html_e( 'Repair Requests', 'drywall-toolbox' ); ?>
					<span class="dtb-page-subtitle"><?php echo esc_html( date_i18n( 'F j, Y' ) ); ?></span>
				</h1>
			</div>
		</div>
		<div class="dtb-stats-row">
			<?php
			$stat_cards = [
				[ 'cls' => 'dtb-sc-total',     'num' => $n_total,     'label' => __( 'Total Repairs',   'drywall-toolbox' ) ],
				[ 'cls' => 'dtb-sc-active',    'num' => $n_active,    'label' => __( 'Active',           'drywall-toolbox' ) ],
				[ 'cls' => 'dtb-sc-ready',     'num' => $n_ready,     'label' => __( 'Ready to Ship',    'drywall-toolbox' ) ],
				[ 'cls' => 'dtb-sc-completed', 'num' => $n_completed, 'label' => __( 'Completed',        'drywall-toolbox' ) ],
				[ 'cls' => 'dtb-sc-cancelled', 'num' => $n_cancelled, 'label' => __( 'Cancelled',        'drywall-toolbox' ) ],
			];
			foreach ( $stat_cards as $card ) :
			?>
				<div class="dtb-stat-card <?php echo esc_attr( $card['cls'] ); ?>">
					<div class="dtb-stat-num"><?php echo esc_html( (string) $card['num'] ); ?></div>
					<div class="dtb-stat-label"><?php echo esc_html( $card['label'] ); ?></div>
				</div>
			<?php endforeach; ?>
		</div>

		<!-- ── List shell ─────────────────────────────────────────────────── -->
		<div class="dtb-list-shell">

			<!-- ── Tab bar ──────────────────────────────────────────────── -->
			<div class="dtb-tab-bar">
				<nav class="dtb-tabs" role="tablist">
					<?php
					$tabs = [
						'all'       => [ 'label' => __( 'All Repairs',    'drywall-toolbox' ), 'count' => $n_total     ],
						'active'    => [ 'label' => __( 'Active',          'drywall-toolbox' ), 'count' => $n_active    ],
						'ready'     => [ 'label' => __( 'Ready to Ship',   'drywall-toolbox' ), 'count' => $n_ready     ],
						'completed' => [ 'label' => __( 'Completed',       'drywall-toolbox' ), 'count' => $n_completed ],
						'cancelled' => [ 'label' => __( 'Cancelled',       'drywall-toolbox' ), 'count' => $n_cancelled ],
					];
					foreach ( $tabs as $slug => $tab_def ) :
						$is_cur  = ( $slug === $current_tab );
						$tab_url = ( 'all' === $slug )
							? esc_url( $base_url )
							: esc_url( add_query_arg( [ 'tab' => $slug ], $base_url ) );
					?>
						<a href="<?php echo $tab_url; // phpcs:ignore ?>"
						   class="dtb-tab<?php echo $is_cur ? ' dtb-tab-current' : ''; ?>"
						   role="tab"
						   aria-selected="<?php echo $is_cur ? 'true' : 'false'; ?>"
						>
							<?php echo esc_html( $tab_def['label'] ); ?>
							<span class="dtb-tab-badge"><?php echo esc_html( (string) $tab_def['count'] ); ?></span>
						</a>
					<?php endforeach; ?>
				</nav>
				<div class="dtb-tab-bar-right">
					<a href="<?php echo esc_url( admin_url( 'post-new.php?post_type=dtb_repair_request' ) ); ?>"
					   class="button button-primary">
						+ <?php esc_html_e( 'New Repair', 'drywall-toolbox' ); ?>
					</a>
				</div>
			</div><!-- .dtb-tab-bar -->

			<!-- ── Status chip filter bar ───────────────────────────────── -->
			<div class="dtb-chip-bar">
				<?php
				// "All Statuses" chip clears the status filter but keeps the tab.
				$clear_url = ( 'all' === $current_tab )
					? esc_url( $base_url )
					: esc_url( add_query_arg( [ 'tab' => $current_tab ], $base_url ) );
				?>
				<a href="<?php echo $clear_url; // phpcs:ignore ?>"
				   class="dtb-chip<?php echo '' === $current_status ? ' dtb-chip-active' : ''; ?>">
					<?php esc_html_e( 'All Statuses', 'drywall-toolbox' ); ?>
				</a>

				<?php foreach ( $chip_pool as $st ) :
					$cnt   = $counts[ $st ] ?? 0;
					$label = function_exists( 'dtb_get_repair_status_label' )
						? dtb_get_repair_status_label( $st )
						: ucwords( str_replace( '_', ' ', $st ) );

					$chip_args = [ 'repair_status' => $st ];
					if ( 'all' !== $current_tab ) {
						$chip_args['tab'] = $current_tab;
					}
					$chip_url = esc_url( add_query_arg( $chip_args, $base_url ) );
				?>
					<a href="<?php echo $chip_url; // phpcs:ignore ?>"
					   class="dtb-chip<?php echo ( $current_status === $st ) ? ' dtb-chip-active' : ''; ?>">
						<?php echo esc_html( $label ); ?>
						<span class="dtb-chip-count"><?php echo esc_html( (string) $cnt ); ?></span>
					</a>
				<?php endforeach; ?>
			</div><!-- .dtb-chip-bar -->

			<!-- ── Table ────────────────────────────────────────────────── -->
			<div class="dtb-table-wrap">
				<form method="get" action="">
					<input type="hidden" name="page" value="dtb-repairs">
					<?php if ( 'all' !== $current_tab ) : ?>
						<input type="hidden" name="tab" value="<?php echo esc_attr( $current_tab ); ?>">
					<?php endif; ?>
					<?php if ( '' !== $current_status ) : ?>
						<input type="hidden" name="repair_status" value="<?php echo esc_attr( $current_status ); ?>">
					<?php endif; ?>
					<?php
					$table->search_box( __( 'Search repairs…', 'drywall-toolbox' ), 'dtb-repair-search' );
					$table->display();
					?>
				</form>
			</div><!-- .dtb-table-wrap -->

		</div><!-- .dtb-list-shell -->

	</div><!-- .dtb-repairs-wrap -->
	<?php
}

// =============================================================================
// SECTION 5 — WP_LIST_TABLE SUBCLASS
// =============================================================================
