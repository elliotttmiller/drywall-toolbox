<?php
/**
 * Admin — SupportHubAdminMenu
 *
 * Registers menus, enqueues shared assets, and renders the Settings page.
 *
 * Navigation:
 *   Support (top-level)  →  Dashboard (KPIs + full ticket list + detail routing)
 *   └─ Dashboard         →  same
 *   └─ Settings          →  dtb_support_render_settings_page
 *
 * "All Tickets" has been consolidated into the Dashboard page.
 *
 * @package drywall-toolbox
 */

defined( 'ABSPATH' ) || exit;

// ─────────────────────────────────────────────────────────────────────────────
// MENU REGISTRATION
// ─────────────────────────────────────────────────────────────────────────────

function dtb_support_register_menus(): void {
	$badge = dtb_support_open_ticket_count_badge();
	$label = $badge
		? sprintf( 'Support %s', $badge )
		: __( 'Support', 'drywall-toolbox' );

	add_menu_page(
		__( 'Support Hub', 'drywall-toolbox' ),
		$label,
		'dtb_manage_support',
		'dtb-support',
		'dtb_support_render_dashboard_page',
		'dashicons-format-chat',
		30
	);

	add_submenu_page(
		'dtb-support',
		__( 'Dashboard', 'drywall-toolbox' ),
		__( 'Dashboard', 'drywall-toolbox' ),
		'dtb_manage_support',
		'dtb-support',
		'dtb_support_render_dashboard_page'
	);

	add_submenu_page(
		'dtb-support',
		__( 'Settings', 'drywall-toolbox' ),
		__( 'Settings', 'drywall-toolbox' ),
		'manage_options',
		'dtb-support-settings',
		'dtb_support_render_settings_page'
	);
}
add_action( 'admin_menu', 'dtb_support_register_menus' );

// ─────────────────────────────────────────────────────────────────────────────
// BADGE
// ─────────────────────────────────────────────────────────────────────────────

function dtb_support_open_ticket_count_badge(): string {
	$counts = dtb_support_count_by_status();
	$n      = (int) ( $counts['open'] ?? 0 ) + (int) ( $counts['pending_staff'] ?? 0 );
	return $n > 0 ? sprintf( '<span class="awaiting-mod">%d</span>', $n ) : '';
}

// ─────────────────────────────────────────────────────────────────────────────
// ASSET ENQUEUE
// ─────────────────────────────────────────────────────────────────────────────

function dtb_support_enqueue_admin_assets( string $hook ): void {
	$page = sanitize_text_field( $_GET['page'] ?? '' );
	if (
		! in_array( $hook, [ 'toplevel_page_dtb-support', 'support_page_dtb-support-settings' ], true )
		&& ! str_starts_with( $page, 'dtb-support' )
	) {
		return;
	}

	$assets_dir = __DIR__ . '/assets';
	$assets_url = plugin_dir_url( __FILE__ ) . 'assets';

	// Enqueue versioned CSS from file when it exists; otherwise fall back to inline.
	$css_file = $assets_dir . '/dtb-support.css';
	if ( file_exists( $css_file ) ) {
		wp_enqueue_style(
			'dtb-support-admin',
			$assets_url . '/dtb-support.css',
			[ 'wp-admin' ],
			(string) filemtime( $css_file )
		);
	} else {
		wp_add_inline_style( 'wp-admin', dtb_support_admin_css() );
	}

	// Enqueue versioned JS from file when it exists; otherwise fall back to inline.
	$js_file = $assets_dir . '/dtb-support.js';
	if ( file_exists( $js_file ) ) {
		wp_enqueue_script(
			'dtb-support-admin',
			$assets_url . '/dtb-support.js',
			[ 'wp-util' ],
			(string) filemtime( $js_file ),
			true
		);
		wp_localize_script( 'dtb-support-admin', 'dtbSupportConfig', [
			'restUrl' => esc_url_raw( rest_url( 'dtb/v1' ) ),
			'nonce'   => wp_create_nonce( 'wp_rest' ),
		] );
	} else {
		wp_enqueue_script( 'wp-util' );
		wp_add_inline_script( 'wp-util', dtb_support_admin_js(), 'after' );
	}
}
add_action( 'admin_enqueue_scripts', 'dtb_support_enqueue_admin_assets' );

// ─────────────────────────────────────────────────────────────────────────────
// SETTINGS PAGE
// ─────────────────────────────────────────────────────────────────────────────

function dtb_support_render_settings_page(): void {
	if ( ! current_user_can( 'manage_options' ) ) {
		wp_die( __( 'Insufficient permissions.', 'drywall-toolbox' ) );
	}

	$saved = false;
	if (
		isset( $_POST['_dtb_settings_nonce'] )
		&& wp_verify_nonce( sanitize_text_field( $_POST['_dtb_settings_nonce'] ), 'dtb_support_save_settings' )
	) {
		update_option( 'dtb_support_from_name',    sanitize_text_field( $_POST['dtb_support_from_name']    ?? '' ) );
		update_option( 'dtb_support_from_email',   sanitize_email(      $_POST['dtb_support_from_email']   ?? '' ) );
		update_option( 'dtb_support_admin_email',  sanitize_email(      $_POST['dtb_support_admin_email']  ?? '' ) );
		update_option( 'dtb_support_poll_interval', absint(             $_POST['dtb_support_poll_interval'] ?? 60 ) );
		$saved = true;
	}

	$from_name     = (string) get_option( 'dtb_support_from_name',   get_bloginfo( 'name' ) );
	$from_email    = (string) get_option( 'dtb_support_from_email',  get_option( 'admin_email', '' ) );
	$admin_email   = (string) get_option( 'dtb_support_admin_email', get_option( 'admin_email', '' ) );
	$poll_interval = (int)    get_option( 'dtb_support_poll_interval', 60 );
	?>
	<div class="dtb-wrap">

		<div class="dtb-topbar">
			<div class="dtb-topbar__left">
				<h1 class="dtb-topbar__title">⚙️ <?php esc_html_e( 'Support Settings', 'drywall-toolbox' ); ?></h1>
				<p class="dtb-topbar__sub"><?php esc_html_e( 'Configure email notifications and dashboard behaviour.', 'drywall-toolbox' ); ?></p>
			</div>
		</div>

		<?php if ( $saved ) : ?>
			<div class="dtb-alert dtb-alert--success">✓ <?php esc_html_e( 'Settings saved.', 'drywall-toolbox' ); ?></div>
		<?php endif; ?>

		<div class="dtb-card">
			<form method="post">
				<?php wp_nonce_field( 'dtb_support_save_settings', '_dtb_settings_nonce' ); ?>

				<div class="dtb-settings-section">
					<h2 class="dtb-settings-section__title"><?php esc_html_e( 'Email', 'drywall-toolbox' ); ?></h2>
					<div class="dtb-settings-grid">
						<div class="dtb-field">
							<label class="dtb-label" for="from_name"><?php esc_html_e( 'From Name', 'drywall-toolbox' ); ?></label>
							<input type="text" id="from_name" name="dtb_support_from_name"
								value="<?php echo esc_attr( $from_name ); ?>" class="dtb-input">
						</div>
						<div class="dtb-field">
							<label class="dtb-label" for="from_email"><?php esc_html_e( 'From Email', 'drywall-toolbox' ); ?></label>
							<input type="email" id="from_email" name="dtb_support_from_email"
								value="<?php echo esc_attr( $from_email ); ?>" class="dtb-input">
						</div>
						<div class="dtb-field">
							<label class="dtb-label" for="admin_email"><?php esc_html_e( 'Admin Notification Email', 'drywall-toolbox' ); ?></label>
							<input type="email" id="admin_email" name="dtb_support_admin_email"
								value="<?php echo esc_attr( $admin_email ); ?>" class="dtb-input">
							<span class="dtb-hint"><?php esc_html_e( 'New ticket alerts are delivered here.', 'drywall-toolbox' ); ?></span>
						</div>
					</div>
				</div>

				<div class="dtb-settings-section">
					<h2 class="dtb-settings-section__title"><?php esc_html_e( 'Dashboard', 'drywall-toolbox' ); ?></h2>
					<div class="dtb-settings-grid">
						<div class="dtb-field">
							<label class="dtb-label" for="poll_interval"><?php esc_html_e( 'Auto-Refresh (seconds)', 'drywall-toolbox' ); ?></label>
							<input type="number" id="poll_interval" name="dtb_support_poll_interval"
								value="<?php echo esc_attr( $poll_interval ); ?>" min="30" max="600" class="dtb-input dtb-input--sm">
							<span class="dtb-hint"><?php esc_html_e( 'Minimum 30s. Set to 0 to disable.', 'drywall-toolbox' ); ?></span>
						</div>
					</div>
				</div>

				<div class="dtb-settings-footer">
					<button type="submit" class="dtb-btn dtb-btn--primary">
						<?php esc_html_e( 'Save Settings', 'drywall-toolbox' ); ?>
					</button>
				</div>
			</form>
		</div>

	</div>
	<?php
}

// ═════════════════════════════════════════════════════════════════════════════
// SHARED CSS  — Full Design System
// ═════════════════════════════════════════════════════════════════════════════

function dtb_support_admin_css(): string { return <<<'CSS'
/* ══════════════════════════════════════════════════════════════════
   DTB Support Hub — Design System v3
   Inspired by KirrDesk + clean SaaS ticket UIs.
   ══════════════════════════════════════════════════════════════════ */

/* ── Variables ───────────────────────────────────────────────────── */
.dtb-wrap {
	--dtb-bg:        #f4f6f9;
	--dtb-surface:   #ffffff;
	--dtb-border:    #e8eaed;
	--dtb-border-lt: #f0f2f5;
	--dtb-text:      #1a1d23;
	--dtb-text-md:   #4b5563;
	--dtb-text-sm:   #9ca3af;
	--dtb-accent:    #2563eb;
	--dtb-accent-lt: #eff6ff;
	--dtb-radius:    8px;
	--dtb-radius-lg: 12px;
	--dtb-shadow:    0 1px 3px rgba(0,0,0,.08), 0 1px 2px rgba(0,0,0,.04);
	--dtb-shadow-md: 0 4px 16px rgba(0,0,0,.10);
	font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
}
.dtb-wrap * { box-sizing: border-box; }

/* ── Outer wrapper ───────────────────────────────────────────────── */
.dtb-wrap {
	background: var(--dtb-bg);
	min-height: calc(100vh - 32px);
	padding: 0 0 40px;
	margin-top: -8px;
	max-width: 100%;
}
/* hide default WP h1 + hr */
.dtb-wrap + .wp-header-end,
.dtb-wrap ~ hr.wp-header-end { display:none; }

/* ── Top Bar ─────────────────────────────────────────────────────── */
.dtb-topbar {
	background: var(--dtb-surface);
	border-bottom: 1px solid var(--dtb-border);
	padding: 18px 28px 14px;
	display: flex;
	align-items: flex-end;
	justify-content: space-between;
	gap: 16px;
	flex-wrap: wrap;
	margin-bottom: 20px;
}
.dtb-topbar__title {
	font-size: 18px !important;
	font-weight: 700 !important;
	color: var(--dtb-text) !important;
	margin: 0 !important;
	line-height: 1.3 !important;
}
.dtb-topbar__sub {
	margin: 2px 0 0 !important;
	font-size: 12px;
	color: var(--dtb-text-sm);
}
.dtb-topbar__actions { display:flex; gap:8px; align-items:center; }

/* ── Content area ────────────────────────────────────────────────── */
.dtb-content { padding: 0 28px; }

/* ── Alert banner ────────────────────────────────────────────────── */
.dtb-alert {
	padding: 10px 16px;
	border-radius: var(--dtb-radius);
	font-size: 13px;
	font-weight: 500;
	margin: 0 28px 16px;
}
.dtb-alert--success { background:#f0fdf4; color:#16a34a; border:1px solid #bbf7d0; }
.dtb-alert--error   { background:#fef2f2; color:#dc2626; border:1px solid #fecaca; }

/* ── KPI Strip ───────────────────────────────────────────────────── */
.dtb-kpi-strip {
	display: grid;
	grid-template-columns: repeat(auto-fill, minmax(130px, 1fr));
	gap: 10px;
	padding: 0 28px 20px;
}
.dtb-kpi-card {
	background: var(--dtb-surface);
	border: 1px solid var(--dtb-border);
	border-radius: var(--dtb-radius-lg);
	padding: 16px 14px;
	text-align: center;
	transition: box-shadow .2s, transform .2s;
	cursor: default;
}
.dtb-kpi-card:hover { box-shadow: var(--dtb-shadow-md); transform: translateY(-1px); }
.dtb-kpi-card--warn { border-color: #fca5a5; }
.dtb-kpi-card--warn .dtb-kpi-val { color: #dc2626 !important; }
.dtb-kpi-val {
	font-size: 30px;
	font-weight: 800;
	color: var(--dtb-accent);
	line-height: 1;
	margin-bottom: 5px;
	letter-spacing: -1px;
}
.dtb-kpi-lbl {
	font-size: 10px;
	font-weight: 700;
	color: var(--dtb-text-sm);
	text-transform: uppercase;
	letter-spacing: .7px;
}

/* ── Main card ───────────────────────────────────────────────────── */
.dtb-card {
	background: var(--dtb-surface);
	border: 1px solid var(--dtb-border);
	border-radius: var(--dtb-radius-lg);
	box-shadow: var(--dtb-shadow);
	margin: 0 28px;
	overflow: hidden;
}

/* ── Toolbar (search + filters) ─────────────────────────────────── */
.dtb-toolbar {
	display: flex;
	align-items: center;
	gap: 10px;
	padding: 14px 18px;
	border-bottom: 1px solid var(--dtb-border-lt);
	flex-wrap: wrap;
}
.dtb-toolbar__search-wrap {
	position: relative;
	flex: 1;
	min-width: 200px;
	max-width: 340px;
}
.dtb-toolbar__search-icon {
	position: absolute;
	left: 11px;
	top: 50%;
	transform: translateY(-50%);
	color: var(--dtb-text-sm);
	pointer-events: none;
	line-height: 1;
}
.dtb-search {
	width: 100%;
	padding: 8px 12px 8px 34px;
	border: 1px solid var(--dtb-border);
	border-radius: 6px;
	font-size: 13px;
	color: var(--dtb-text);
	background: #fafbfc;
	outline: none;
	transition: border-color .15s, box-shadow .15s;
}
.dtb-search::placeholder { color: var(--dtb-text-sm); }
.dtb-search:focus { border-color: var(--dtb-accent); background:#fff; box-shadow: 0 0 0 3px rgba(37,99,235,.12); }
.dtb-toolbar__count { font-size: 13px; color: var(--dtb-text-sm); white-space: nowrap; font-weight: 500; }
.dtb-toolbar__spacer { flex: 1; }
.dtb-select {
	padding: 7px 28px 7px 10px;
	border: 1px solid var(--dtb-border);
	border-radius: 6px;
	font-size: 12px;
	font-weight: 500;
	color: var(--dtb-text-md);
	background: #fafbfc;
	appearance: none;
	background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='11' height='11' fill='none' stroke='%239ca3af' stroke-width='2.2' viewBox='0 0 24 24'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E");
	background-repeat: no-repeat;
	background-position: right 8px center;
	cursor: pointer;
	outline: none;
	transition: border-color .15s;
}
.dtb-select:focus { border-color: var(--dtb-accent); }

/* ── Status tab strip ────────────────────────────────────────────── */
.dtb-tabs {
	display: flex;
	gap: 0;
	border-bottom: 1px solid var(--dtb-border-lt);
	padding: 0 18px;
	background: var(--dtb-surface);
	overflow-x: auto;
}
.dtb-tab {
	display: inline-flex;
	align-items: center;
	gap: 6px;
	padding: 11px 14px;
	font-size: 12px;
	font-weight: 600;
	color: var(--dtb-text-sm);
	text-decoration: none;
	border-bottom: 2px solid transparent;
	margin-bottom: -1px;
	white-space: nowrap;
	transition: color .15s;
}
.dtb-tab:hover { color: var(--dtb-accent); }
.dtb-tab--active { color: var(--dtb-accent); border-bottom-color: var(--dtb-accent); }
.dtb-tab__dot {
	width: 7px;
	height: 7px;
	border-radius: 50%;
	display: inline-block;
	background: var(--dtb-text-sm);
}
.dtb-tab__dot--open              { background: #2563eb; }
.dtb-tab__dot--in_progress       { background: #f59e0b; }
.dtb-tab__dot--pending_customer  { background: #ec4899; }
.dtb-tab__dot--pending_staff     { background: #8b5cf6; }
.dtb-tab__dot--resolved          { background: #16a34a; }
.dtb-tab__dot--closed            { background: #d1d5db; }
.dtb-tab__dot--spam              { background: #ef4444; }
.dtb-tab__count {
	background: #f3f4f6;
	color: var(--dtb-text-sm);
	border-radius: 99px;
	padding: 1px 6px;
	font-size: 10px;
	font-weight: 700;
}
.dtb-tab--active .dtb-tab__count { background: #dbeafe; color: var(--dtb-accent); }

/* ── Tickets table ───────────────────────────────────────────────── */
.dtb-table {
	width: 100%;
	border-collapse: collapse;
}
.dtb-table thead th {
	padding: 9px 14px;
	text-align: left;
	font-size: 11px;
	font-weight: 700;
	color: var(--dtb-text-sm);
	text-transform: uppercase;
	letter-spacing: .5px;
	background: #fafbfc;
	border-bottom: 1px solid var(--dtb-border-lt);
	white-space: nowrap;
	user-select: none;
}
.dtb-table thead th:first-child { padding-left: 18px; }
.dtb-table thead th:last-child  { padding-right: 18px; }
.dtb-table tbody tr {
	border-bottom: 1px solid var(--dtb-border-lt);
	transition: background .1s;
}
.dtb-table tbody tr:last-child { border-bottom: none; }
.dtb-table tbody tr:hover { background: #f8fafc; }
.dtb-table tbody tr.dtb-row--expanded { background: #f0f7ff; }
.dtb-table td {
	padding: 13px 14px;
	vertical-align: middle;
	font-size: 13px;
	color: var(--dtb-text-md);
}
.dtb-table td:first-child { padding-left: 18px; }
.dtb-table td:last-child  { padding-right: 18px; }
/* Ticket ID col */
.dtb-tid {
	font-family: "SFMono-Regular", Consolas, monospace;
	font-size: 12px;
	font-weight: 700;
	color: var(--dtb-accent);
	text-decoration: none;
	white-space: nowrap;
}
.dtb-tid:hover { text-decoration: underline; }
/* Subject col */
.dtb-subject {
	font-weight: 600;
	color: var(--dtb-text);
	text-decoration: none;
	display: block;
}
.dtb-subject:hover { color: var(--dtb-accent); }
.dtb-subject-meta { font-size: 11px; color: var(--dtb-text-sm); margin-top: 1px; }
/* Status dot + label */
.dtb-status {
	display: inline-flex;
	align-items: center;
	gap: 6px;
	font-size: 12px;
	font-weight: 600;
	color: var(--dtb-text-md);
	white-space: nowrap;
}
.dtb-status__dot {
	width: 8px;
	height: 8px;
	border-radius: 50%;
	flex-shrink: 0;
}
.dtb-status__dot--open              { background: #2563eb; box-shadow: 0 0 0 2px #dbeafe; }
.dtb-status__dot--in_progress       { background: #f59e0b; box-shadow: 0 0 0 2px #fef9c3; }
.dtb-status__dot--pending_customer  { background: #ec4899; box-shadow: 0 0 0 2px #fce7f3; }
.dtb-status__dot--pending_staff     { background: #8b5cf6; box-shadow: 0 0 0 2px #ede9fe; }
.dtb-status__dot--resolved          { background: #16a34a; box-shadow: 0 0 0 2px #dcfce7; }
.dtb-status__dot--closed            { background: #d1d5db; box-shadow: 0 0 0 2px #f3f4f6; }
.dtb-status__dot--spam              { background: #ef4444; box-shadow: 0 0 0 2px #fee2e2; }
/* Priority badge */
.dtb-pri {
	display: inline-block;
	padding: 3px 9px;
	border-radius: 99px;
	font-size: 11px;
	font-weight: 700;
	text-transform: capitalize;
	white-space: nowrap;
}
.dtb-pri--low    { background: #f0fdf4; color: #15803d; }
.dtb-pri--normal { background: #eff6ff; color: #1d4ed8; }
.dtb-pri--high   { background: #fff7ed; color: #c2410c; }
.dtb-pri--urgent { background: #fef2f2; color: #dc2626; }
/* Type badge */
.dtb-type {
	display: inline-block;
	padding: 3px 9px;
	border-radius: 99px;
	font-size: 11px;
	font-weight: 600;
	background: #f3f4f6;
	color: var(--dtb-text-md);
	white-space: nowrap;
}
/* Action-state pill (operational target / due-soon / overdue) */
.dtb-action-state {
	display: inline-flex;
	align-items: center;
	gap: 3px;
	padding: 3px 8px;
	border-radius: 99px;
	font-size: 10px;
	font-weight: 700;
	text-transform: uppercase;
	letter-spacing: .4px;
	white-space: nowrap;
}
.dtb-action-state--ok       { background: #dcfce7; color: #15803d; }
.dtb-action-state--due-soon { background: #fff7ed; color: #c2410c; }
.dtb-action-state--overdue  { background: #fee2e2; color: #dc2626; }
/* Expand chevron */
.dtb-expand-btn {
	background: none;
	border: none;
	cursor: pointer;
	padding: 4px 6px;
	color: var(--dtb-text-sm);
	border-radius: 4px;
	transition: background .15s, color .15s;
	line-height: 1;
}
.dtb-expand-btn:hover { background: #f0f4f8; color: var(--dtb-accent); }
.dtb-expand-btn svg { display:block; }
/* Inline expand row */
.dtb-expand-row { display: none; }
.dtb-expand-row.is-open { display: table-row; }
.dtb-expand-row td { padding: 0 !important; }
.dtb-expand-inner {
	padding: 20px 24px 20px 56px;
	background: #f8fafc;
	border-top: 1px solid var(--dtb-border-lt);
	display: grid;
	grid-template-columns: 1fr 220px;
	gap: 20px;
	align-items: start;
}
/* Inline thread */
.dtb-mini-thread { display: flex; flex-direction: column; gap: 12px; }
.dtb-mini-event { display:flex; gap:10px; align-items:flex-start; }
.dtb-mini-event__avatar {
	width: 30px;
	height: 30px;
	border-radius: 50%;
	background: var(--dtb-accent);
	color: #fff;
	font-size: 11px;
	font-weight: 700;
	display: flex;
	align-items: center;
	justify-content: center;
	flex-shrink: 0;
	text-transform: uppercase;
}
.dtb-mini-event__avatar--customer { background: #ec4899; }
.dtb-mini-event__avatar--staff    { background: #6366f1; }
.dtb-mini-event__avatar--system   { background: #d1d5db; color: #6b7280; }
.dtb-mini-event__body { flex: 1; min-width: 0; }
.dtb-mini-event__header {
	display: flex;
	align-items: baseline;
	gap: 8px;
	margin-bottom: 3px;
}
.dtb-mini-event__name { font-size: 12px; font-weight: 700; color: var(--dtb-text); }
.dtb-mini-event__time { font-size: 10px; color: var(--dtb-text-sm); }
.dtb-mini-event__msg  { font-size: 12px; color: var(--dtb-text-md); line-height: 1.6; }
/* Inline quick actions */
.dtb-quick-actions { display:flex; flex-direction:column; gap:8px; }
.dtb-quick-actions__label { font-size: 10px; font-weight:700; color:var(--dtb-text-sm); text-transform:uppercase; letter-spacing:.5px; margin-bottom:2px; }
.dtb-view-full-btn {
	display: block;
	text-align: center;
	padding: 8px;
	background: var(--dtb-accent);
	color: #fff;
	border-radius: 6px;
	font-size: 12px;
	font-weight: 600;
	text-decoration: none;
	transition: background .15s;
}
.dtb-view-full-btn:hover { background: #1d4ed8; color: #fff; }
/* Empty state */
.dtb-empty {
	text-align: center;
	padding: 56px 24px;
}
.dtb-empty__icon { font-size: 40px; display:block; margin-bottom: 12px; }
.dtb-empty__msg  { font-size: 14px; font-weight: 600; color: var(--dtb-text-md); }
.dtb-empty__sub  { font-size: 12px; color: var(--dtb-text-sm); margin-top: 4px; }
/* Table footer (pagination) */
.dtb-table-footer {
	display: flex;
	align-items: center;
	justify-content: space-between;
	padding: 12px 18px;
	border-top: 1px solid var(--dtb-border-lt);
	font-size: 12px;
	color: var(--dtb-text-sm);
	background: #fafbfc;
}
.dtb-pager { display:flex; gap:4px; align-items:center; }
.dtb-page-btn {
	display: inline-flex;
	align-items: center;
	justify-content: center;
	width: 28px;
	height: 28px;
	border-radius: 5px;
	font-size: 12px;
	font-weight: 600;
	text-decoration: none;
	color: var(--dtb-text-md);
	border: 1px solid var(--dtb-border);
	transition: all .15s;
}
.dtb-page-btn:hover,
.dtb-page-btn--active { background: var(--dtb-accent); color: #fff; border-color: var(--dtb-accent); }

/* ── Detail page ─────────────────────────────────────────────────── */
.dtb-back {
	display: inline-flex;
	align-items: center;
	gap: 5px;
	font-size: 12px;
	color: var(--dtb-text-sm);
	text-decoration: none;
	padding: 12px 28px 4px;
	transition: color .15s;
}
.dtb-back:hover { color: var(--dtb-accent); }
.dtb-detail-topbar {
	display: flex;
	align-items: flex-start;
	justify-content: space-between;
	gap: 12px;
	padding: 10px 28px 16px;
	flex-wrap: wrap;
}
.dtb-detail-title {
	font-size: 18px !important;
	font-weight: 700 !important;
	color: var(--dtb-text) !important;
	margin: 0 0 4px !important;
	line-height: 1.3 !important;
}
.dtb-detail-badges { display:flex; align-items:center; gap:8px; flex-wrap:wrap; margin-top: 4px; }
.dtb-detail-grid {
	display: grid;
	grid-template-columns: 1fr 280px;
	gap: 16px;
	padding: 0 28px;
	align-items: start;
}
/* Thread card */
.dtb-thread-card {
	background: var(--dtb-surface);
	border: 1px solid var(--dtb-border);
	border-radius: var(--dtb-radius-lg);
	overflow: hidden;
}
.dtb-thread-header {
	padding: 12px 18px;
	border-bottom: 1px solid var(--dtb-border-lt);
	font-size: 11px;
	font-weight: 700;
	color: var(--dtb-text-sm);
	text-transform: uppercase;
	letter-spacing: .5px;
}
.dtb-event {
	display: flex;
	gap: 12px;
	padding: 16px 18px;
	border-bottom: 1px solid var(--dtb-border-lt);
	align-items: flex-start;
}
.dtb-event:last-child { border-bottom: none; }
.dtb-event--internal { background: #fefce8; }
.dtb-event__avatar {
	width: 34px;
	height: 34px;
	border-radius: 50%;
	font-size: 12px;
	font-weight: 700;
	display: flex;
	align-items: center;
	justify-content: center;
	flex-shrink: 0;
	text-transform: uppercase;
	color: #fff;
}
.dtb-event__avatar--customer { background: linear-gradient(135deg,#ec4899,#be185d); }
.dtb-event__avatar--staff    { background: linear-gradient(135deg,#6366f1,#4338ca); }
.dtb-event__avatar--system   { background: #e5e7eb; color: #9ca3af; }
.dtb-event__content { flex: 1; min-width: 0; }
.dtb-event__meta {
	display: flex;
	align-items: baseline;
	gap: 8px;
	margin-bottom: 6px;
	flex-wrap: wrap;
}
.dtb-event__actor { font-size: 13px; font-weight: 700; color: var(--dtb-text); }
.dtb-event__when  { font-size: 11px; color: var(--dtb-text-sm); }
.dtb-event__internal-badge {
	font-size: 10px;
	font-weight: 700;
	background: #fef9c3;
	color: #854d0e;
	padding: 2px 6px;
	border-radius: 4px;
	text-transform: uppercase;
}
.dtb-event__body { font-size: 13px; line-height: 1.7; color: var(--dtb-text-md); white-space: pre-wrap; }
.dtb-event__log  { font-size: 12px; color: var(--dtb-text-sm); font-style: italic; }
/* Reply composer */
.dtb-compose {
	background: var(--dtb-surface);
	border: 1px solid var(--dtb-border);
	border-radius: var(--dtb-radius-lg);
	overflow: hidden;
	margin-top: 12px;
}
.dtb-compose__header {
	padding: 12px 18px;
	border-bottom: 1px solid var(--dtb-border-lt);
	font-size: 12px;
	font-weight: 700;
	color: var(--dtb-text-md);
}
.dtb-compose__body { padding: 14px 18px; }
.dtb-compose__textarea {
	width: 100%;
	padding: 10px 12px;
	border: 1px solid var(--dtb-border);
	border-radius: 6px;
	font-size: 13px;
	font-family: inherit;
	resize: vertical;
	min-height: 100px;
	outline: none;
	color: var(--dtb-text);
	transition: border-color .15s, box-shadow .15s;
}
.dtb-compose__textarea::placeholder { color: var(--dtb-text-sm); }
.dtb-compose__textarea:focus { border-color: var(--dtb-accent); box-shadow: 0 0 0 3px rgba(37,99,235,.10); }
.dtb-compose__footer {
	display: flex;
	align-items: center;
	justify-content: space-between;
	padding: 10px 18px 14px;
	gap: 10px;
	flex-wrap: wrap;
}
.dtb-internal-toggle {
	display: flex;
	align-items: center;
	gap: 6px;
	font-size: 12px;
	color: var(--dtb-text-sm);
	cursor: pointer;
}
.dtb-internal-toggle input { cursor: pointer; }
/* Sidebar */
.dtb-sidebar { display:flex; flex-direction:column; gap:12px; }
.dtb-sidebar-card {
	background: var(--dtb-surface);
	border: 1px solid var(--dtb-border);
	border-radius: var(--dtb-radius-lg);
	overflow: hidden;
}
.dtb-sidebar-card__header {
	padding: 10px 14px;
	border-bottom: 1px solid var(--dtb-border-lt);
	font-size: 10px;
	font-weight: 700;
	color: var(--dtb-text-sm);
	text-transform: uppercase;
	letter-spacing: .6px;
	background: #fafbfc;
}
.dtb-sidebar-card__body { padding: 14px; }
.dtb-sidebar-field { margin-bottom: 12px; }
.dtb-sidebar-field:last-child { margin-bottom: 0; }
.dtb-sidebar-field__label {
	display: block;
	font-size: 10px;
	font-weight: 700;
	color: var(--dtb-text-sm);
	text-transform: uppercase;
	letter-spacing: .4px;
	margin-bottom: 5px;
}
.dtb-sidebar-select {
	width: 100%;
	padding: 7px 28px 7px 10px;
	border: 1px solid var(--dtb-border);
	border-radius: 6px;
	font-size: 12px;
	color: var(--dtb-text-md);
	background: #fafbfc;
	appearance: none;
	background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='11' height='11' fill='none' stroke='%239ca3af' stroke-width='2.2' viewBox='0 0 24 24'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E");
	background-repeat: no-repeat;
	background-position: right 8px center;
	cursor: pointer;
	outline: none;
}
.dtb-sidebar-select:focus { border-color: var(--dtb-accent); }
.dtb-sidebar-apply-btn {
	margin-top: 6px;
	width: 100%;
	padding: 7px;
	border-radius: 6px;
	border: 1px solid var(--dtb-border);
	background: #f9fafb;
	font-size: 12px;
	font-weight: 600;
	color: var(--dtb-text-md);
	cursor: pointer;
	transition: background .15s, border-color .15s;
}
.dtb-sidebar-apply-btn:hover { background: var(--dtb-accent); color: #fff; border-color: var(--dtb-accent); }
.dtb-customer-name { font-size: 14px; font-weight: 700; color: var(--dtb-text); margin-bottom: 2px; }
.dtb-customer-email { font-size: 12px; color: var(--dtb-accent); text-decoration: none; }
.dtb-customer-email:hover { text-decoration: underline; }
.dtb-info-row {
	display: flex;
	justify-content: space-between;
	font-size: 12px;
	padding: 5px 0;
	border-bottom: 1px solid var(--dtb-border-lt);
}
.dtb-info-row:last-child { border-bottom: none; }
.dtb-info-row__key { color: var(--dtb-text-sm); font-weight: 500; }
.dtb-info-row__val { color: var(--dtb-text-md); font-weight: 600; text-align: right; }

/* ── Buttons ─────────────────────────────────────────────────────── */
.dtb-btn {
	display: inline-flex;
	align-items: center;
	gap: 6px;
	padding: 8px 16px;
	border-radius: 6px;
	font-size: 13px;
	font-weight: 600;
	cursor: pointer;
	border: 1px solid transparent;
	line-height: 1.4;
	text-decoration: none;
	transition: all .15s;
	white-space: nowrap;
}
.dtb-btn--primary  { background: var(--dtb-accent); color: #fff; border-color: var(--dtb-accent); }
.dtb-btn--primary:hover { background: #1d4ed8; border-color: #1d4ed8; color: #fff; }
.dtb-btn--ghost    { background: transparent; color: var(--dtb-text-md); border-color: var(--dtb-border); }
.dtb-btn--ghost:hover { background: #f3f4f6; color: var(--dtb-text); }
.dtb-btn--sm       { padding: 6px 12px; font-size: 12px; }
.dtb-btn--reply    { background: #0ea5e9; border-color: #0ea5e9; color: #fff; }
.dtb-btn--reply:hover { background: #0284c7; border-color: #0284c7; color:#fff; }

/* ── Settings ────────────────────────────────────────────────────── */
.dtb-settings-section { padding: 22px; border-bottom: 1px solid var(--dtb-border-lt); }
.dtb-settings-section:last-of-type { border-bottom: none; }
.dtb-settings-section__title {
	font-size: 13px !important;
	font-weight: 700 !important;
	color: var(--dtb-text) !important;
	margin: 0 0 16px !important;
}
.dtb-settings-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(260px,1fr)); gap:16px; }
.dtb-field { display:flex; flex-direction:column; gap:4px; }
.dtb-label { font-size: 12px; font-weight: 600; color: var(--dtb-text-md); }
.dtb-input {
	padding: 8px 12px;
	border: 1px solid var(--dtb-border);
	border-radius: 6px;
	font-size: 13px;
	color: var(--dtb-text);
	outline: none;
	transition: border-color .15s, box-shadow .15s;
}
.dtb-input:focus { border-color: var(--dtb-accent); box-shadow: 0 0 0 3px rgba(37,99,235,.10); }
.dtb-input--sm   { max-width: 110px; }
.dtb-hint { font-size: 11px; color: var(--dtb-text-sm); }
.dtb-settings-footer { padding: 16px 22px; background: #fafbfc; border-top: 1px solid var(--dtb-border-lt); }

/* ── Responsive ──────────────────────────────────────────────────── */
@media (max-width: 1024px) {
	.dtb-detail-grid { grid-template-columns: 1fr; }
	.dtb-sidebar { flex-direction: row; flex-wrap: wrap; }
	.dtb-sidebar-card { flex: 1; min-width: 200px; }
	.dtb-expand-inner { grid-template-columns: 1fr; }
}
@media (max-width: 782px) {
	.dtb-topbar, .dtb-content, .dtb-kpi-strip, .dtb-card,
	.dtb-back, .dtb-detail-topbar, .dtb-detail-grid { padding-left: 12px !important; padding-right: 12px !important; }
	.dtb-kpi-strip { grid-template-columns: repeat(auto-fill, minmax(100px, 1fr)); }
}
CSS;
}

// ═════════════════════════════════════════════════════════════════════════════
// SHARED JS
// ═════════════════════════════════════════════════════════════════════════════

function dtb_support_admin_js(): string {
	$nonce    = wp_create_nonce( 'wp_rest' );
	$rest_url = esc_url_raw( rest_url( 'dtb/v1' ) );

	return <<<JS
(function(){
'use strict';

const dtbSupport = window.dtbSupport = {
	restUrl: '{$rest_url}',
	nonce:   '{$nonce}',

	request: async function(path, method, body) {
		const opts = {
			method:  method || 'GET',
			headers: { 'Content-Type':'application/json', 'X-WP-Nonce': dtbSupport.nonce },
		};
		if (body) opts.body = JSON.stringify(body);
		try {
			const res = await fetch(dtbSupport.restUrl + path, opts);
			return res.json();
		} catch(e) { return null; }
	},

	transitionTicket: async function(ticketId, status, btn) {
		const orig = btn.textContent;
		btn.disabled = true; btn.textContent = '…';
		const d = await dtbSupport.request('/support/tickets/' + ticketId, 'PATCH', { status });
		if (d && d.success) { window.location.reload(); }
		else { alert('Error: ' + (d && d.message || 'Unknown')); btn.disabled=false; btn.textContent=orig; }
	},

	assignTicket: async function(ticketId, userId, sel) {
		const d = await dtbSupport.request('/support/tickets/' + ticketId, 'PATCH', {
			assigned_user_id: userId ? parseInt(userId,10) : null
		});
		if (!d || !d.success) { alert('Assign error: ' + (d && d.message || 'Unknown')); }
	},

	submitReply: async function(ticketId, message, isInternal, btn, textarea) {
		const orig = btn.textContent;
		btn.disabled=true; btn.textContent='Sending…';
		const d = await dtbSupport.request('/support/tickets/' + ticketId + '/reply', 'POST', {
			message, is_internal: isInternal
		});
		if (d && d.success) { textarea.value=''; window.location.reload(); }
		else { alert('Error: ' + (d && d.message || 'Failed')); btn.disabled=false; btn.textContent=orig; }
	},

	// Toggle inline expand row.
	toggleRow: function(ticketId) {
		const row   = document.getElementById('dtb-exp-' + ticketId);
		const btn   = document.getElementById('dtb-expbtn-' + ticketId);
		const tr    = document.getElementById('dtb-row-' + ticketId);
		if (!row) return;
		const open = row.classList.toggle('is-open');
		if (tr)  tr.classList.toggle('dtb-row--expanded', open);
		if (btn) btn.innerHTML = open ? dtbSupport._chevronUp() : dtbSupport._chevronDown();
		// Lazy-load events once.
		if (open && !row.dataset.loaded) {
			dtbSupport.loadMiniThread(ticketId, row);
		}
	},

	loadMiniThread: async function(ticketId, row) {
		row.dataset.loaded = '1';
		const container = row.querySelector('.dtb-mini-thread');
		if (!container) return;
		container.innerHTML = '<p style="font-size:12px;color:#9ca3af;padding:6px 0">Loading…</p>';
		const events = await dtbSupport.request('/support/tickets/' + ticketId + '/events');
		if (!events || !events.length) {
			container.innerHTML = '<p style="font-size:12px;color:#9ca3af;">No conversation yet.</p>';
			return;
		}
		container.innerHTML = events.slice(0,4).map(function(ev) {
			const isCustomer = ev.actor_type === 'customer';
			const initials   = (ev.actor_label || (isCustomer ? 'C' : 'S')).substring(0,2).toUpperCase();
			const cls        = isCustomer ? 'dtb-mini-event__avatar--customer' : 'dtb-mini-event__avatar--staff';
			const body       = ev.body ? ev.body.substring(0,160) + (ev.body.length>160?'…':'') : '<em>— status change —</em>';
			return '<div class="dtb-mini-event">' +
				'<div class="dtb-mini-event__avatar ' + cls + '">' + initials + '</div>' +
				'<div class="dtb-mini-event__body">' +
					'<div class="dtb-mini-event__header">' +
						'<span class="dtb-mini-event__name">' + (ev.actor_label || (isCustomer?'Customer':'Staff')) + '</span>' +
						'<span class="dtb-mini-event__time">' + (ev.age_label || '') + '</span>' +
					'</div>' +
					'<div class="dtb-mini-event__msg">' + body + '</div>' +
				'</div></div>';
		}).join('');
	},

	_chevronDown: function() { return '<svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2" viewBox="0 0 24 24"><polyline points="6 9 12 15 18 9"/></svg>'; },
	_chevronUp:   function() { return '<svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2" viewBox="0 0 24 24"><polyline points="18 15 12 9 6 15"/></svg>'; },
};

// Wire reply form (detail page).
document.addEventListener('DOMContentLoaded', function() {
	const form = document.getElementById('dtb-reply-form');
	if (!form) return;
	const tid  = parseInt(form.dataset.ticketId, 10);
	const ta   = form.querySelector('textarea[name="message"]');
	const intl = form.querySelector('input[name="is_internal"]');
	const btn  = form.querySelector('.dtb-reply-submit');
	form.addEventListener('submit', function(e) {
		e.preventDefault();
		const msg = ta.value.trim();
		if (!msg) { ta.focus(); return; }
		dtbSupport.submitReply(tid, msg, intl && intl.checked, btn, ta);
	});
});

}());
JS;
}
