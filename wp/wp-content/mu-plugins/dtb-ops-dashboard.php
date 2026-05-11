<?php
/**
 * DTB Ops Dashboard — Must-Use Plugin
 *
 * Centerpiece operations dashboard for Drywall Toolbox site administrators.
 * Provides KPI panels, order/inventory/repair/rewards/membership summaries,
 * audit logging, AJAX data endpoints, cron refresh, and a REST health route.
 *
 * Sections:
 *   1.  Constants & configuration
 *   2.  Database: audit log table creation
 *   3.  Admin menu & sub-menus (slug: dtb-ops)
 *   4.  Enqueue dashboard assets
 *   5.  Dashboard page render
 *   6.  AJAX: KPI data endpoint
 *   7.  AJAX: Audit log endpoint
 *   8.  Audit log writer
 *   9.  Cron: background KPI refresh
 *   10. REST: dtb/v1/health endpoint
 *   11. Capability helpers
 *
 * @package drywall-toolbox
 */

defined( 'ABSPATH' ) || exit;

if ( ! is_admin() && ! ( defined( 'DOING_CRON' ) && DOING_CRON ) && ! dtb_is_rest_api_request() ) {
	return;
}

// =============================================================================
// SECTION 1 — CONSTANTS & CONFIGURATION
// =============================================================================

if ( ! defined( 'DTB_OPS_VERSION' ) )    define( 'DTB_OPS_VERSION',    '1.0.0' );
if ( ! defined( 'DTB_OPS_DB_VERSION' ) ) define( 'DTB_OPS_DB_VERSION', '1' );

// Custom capabilities.
if ( ! defined( 'DTB_CAP_OPS_ADMIN' ) )   define( 'DTB_CAP_OPS_ADMIN',   'dtb_admin_ops' );
if ( ! defined( 'DTB_CAP_ACCOUNTING' ) )  define( 'DTB_CAP_ACCOUNTING',  'dtb_accounting' );
if ( ! defined( 'DTB_CAP_SUPPORT' ) )     define( 'DTB_CAP_SUPPORT',     'dtb_support' );
if ( ! defined( 'DTB_CAP_CATALOG' ) )     define( 'DTB_CAP_CATALOG',     'dtb_catalog' );

// Cache TTLs (seconds).
if ( ! defined( 'DTB_OPS_TTL_KPIS' ) )      define( 'DTB_OPS_TTL_KPIS',      900 );
if ( ! defined( 'DTB_OPS_TTL_ORDERS' ) )    define( 'DTB_OPS_TTL_ORDERS',    300 );
if ( ! defined( 'DTB_OPS_TTL_INVENTORY' ) ) define( 'DTB_OPS_TTL_INVENTORY', 300 );
if ( ! defined( 'DTB_OPS_TTL_REPAIRS' ) )   define( 'DTB_OPS_TTL_REPAIRS',   300 );

// Audit log.
if ( ! defined( 'DTB_OPS_AUDIT_RETENTION' ) ) define( 'DTB_OPS_AUDIT_RETENTION', 90 );

// =============================================================================
// SECTION 2 — DATABASE: AUDIT LOG TABLE
// =============================================================================

add_action( 'admin_init', 'dtb_ops_maybe_create_db' );

/**
 * Create or upgrade the {prefix}dtb_audit_log table if needed.
 */
function dtb_ops_maybe_create_db(): void {
	if ( (string) get_option( 'dtb_ops_db_version', '' ) === DTB_OPS_DB_VERSION ) {
		return;
	}

	global $wpdb;

	$table   = $wpdb->prefix . 'dtb_audit_log';
	$charset = $wpdb->get_charset_collate();

	// dbDelta requires exactly 2 spaces before PRIMARY KEY and KEY lines.
	$sql = "CREATE TABLE {$table} (
  id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  log_timestamp datetime NOT NULL,
  user_id bigint(20) unsigned NOT NULL DEFAULT 0,
  event varchar(120) NOT NULL DEFAULT '',
  context longtext NOT NULL DEFAULT '',
  ip varchar(45) NOT NULL DEFAULT '',
  PRIMARY KEY  (id),
  KEY log_timestamp (log_timestamp),
  KEY user_id (user_id),
  KEY event (event)
) {$charset};";

	require_once ABSPATH . 'wp-admin/includes/upgrade.php';
	dbDelta( $sql );

	update_option( 'dtb_ops_db_version', DTB_OPS_DB_VERSION );
	update_option( 'dtb_ops_version',    DTB_OPS_VERSION );
}

// =============================================================================
// SECTION 3 — ADMIN MENU
// =============================================================================

add_action( 'admin_menu', 'dtb_ops_register_menu', 6 );

/**
 * Register the DTB Ops top-level menu and submenus.
 */
function dtb_ops_register_menu(): void {
	if ( ! dtb_ops_can( 'manage_options' ) ) {
		return;
	}

	add_menu_page(
		__( 'DTB Ops', 'dtb' ),
		__( 'DTB Ops', 'dtb' ),
		'manage_options',
		'dtb-ops',
		'dtb_ops_render_dashboard',
		'dashicons-chart-bar',
		25
	);

	add_submenu_page(
		'dtb-ops',
		__( 'Dashboard', 'dtb' ),
		__( 'Dashboard', 'dtb' ),
		'manage_options',
		'dtb-ops',
		'dtb_ops_render_dashboard'
	);

	add_submenu_page(
		'dtb-ops',
		__( 'Audit Log', 'dtb' ),
		__( 'Audit Log', 'dtb' ),
		'manage_options',
		'dtb-ops-audit',
		'dtb_ops_render_audit_page'
	);
}

// =============================================================================
// SECTION 4 — ENQUEUE ASSETS
// =============================================================================

add_action( 'admin_enqueue_scripts', 'dtb_ops_enqueue_assets' );

/**
 * Enqueue dashboard JS/CSS only on DTB Ops pages.
 *
 * @param string $hook Current admin page hook.
 */
function dtb_ops_enqueue_assets( string $hook ): void {
	if ( false === strpos( $hook, 'dtb-ops' ) ) {
		return;
	}

	wp_enqueue_style(
		'dtb-ops-dashboard',
		false, // Inline style below
		[],
		DTB_OPS_VERSION
	);

	wp_add_inline_style( 'dtb-ops-dashboard', dtb_ops_inline_css() );

	wp_enqueue_script(
		'dtb-ops-dashboard',
		false, // Inline script below
		[ 'jquery' ],
		DTB_OPS_VERSION,
		true
	);

	wp_add_inline_script(
		'dtb-ops-dashboard',
		dtb_ops_inline_js(),
		'after'
	);

	wp_localize_script( 'dtb-ops-dashboard', 'dtbOps', [
		'ajaxUrl'     => admin_url( 'admin-ajax.php' ),
		'nonce'       => wp_create_nonce( 'dtb_ops_nonce' ),
		'pollInterval'=> 30000,
		'version'     => DTB_OPS_VERSION,
	] );
}

/**
 * Inline CSS for the ops dashboard panels.
 *
 * @return string
 */
function dtb_ops_inline_css(): string {
	return '
.dtb-ops-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:16px;margin:20px 0}
.dtb-ops-kpi{background:#fff;border:1px solid #e0e0e0;border-radius:6px;padding:18px 20px;box-shadow:0 1px 3px rgba(0,0,0,.05)}
.dtb-ops-kpi__label{font-size:12px;font-weight:600;color:#666;text-transform:uppercase;letter-spacing:.04em;margin-bottom:6px}
.dtb-ops-kpi__value{font-size:28px;font-weight:700;color:#1d2327;line-height:1.1}
.dtb-ops-kpi--warn .dtb-ops-kpi__value{color:#d63638}
.dtb-ops-kpi--ok   .dtb-ops-kpi__value{color:#00a32a}
.dtb-ops-section{background:#fff;border:1px solid #e0e0e0;border-radius:6px;padding:20px;margin:0 0 20px}
.dtb-ops-section h2{margin-top:0;font-size:15px;border-bottom:1px solid #f0f0f0;padding-bottom:10px;margin-bottom:14px}
.dtb-ops-loading{opacity:.5;font-style:italic}
#dtb-ops-refresh-btn{margin-left:10px}
';
}

/**
 * Inline JS for the ops dashboard: polling, Page Visibility API, AJAX fetch.
 *
 * @return string
 */
function dtb_ops_inline_js(): string {
	return <<<'JS'
(function ($) {
    var pollTimer = null;
    var paused    = false;

    function loadKpis() {
        $('#dtb-ops-kpis').addClass('dtb-ops-loading');
        $.post(dtbOps.ajaxUrl, {
            action: 'dtb_ops_kpis',
            nonce:  dtbOps.nonce
        }, function (res) {
            $('#dtb-ops-kpis').removeClass('dtb-ops-loading');
            if (res && res.success && res.data) {
                renderKpis(res.data);
            }
        }).fail(function () {
            $('#dtb-ops-kpis').removeClass('dtb-ops-loading');
        });
    }

    function renderKpis(data) {
        $.each(data, function (key, kpi) {
            var $el = $('#dtb-kpi-' + key);
            if ($el.length) {
                $el.find('.dtb-ops-kpi__value').text(kpi.value);
                $el.toggleClass('dtb-ops-kpi--warn', !!kpi.warn);
                $el.toggleClass('dtb-ops-kpi--ok',   !kpi.warn);
            }
        });
    }

    function startPolling() {
        loadKpis();
        pollTimer = setInterval(function () {
            if (!paused) loadKpis();
        }, dtbOps.pollInterval);
    }

    // Pause polling when tab is hidden (Page Visibility API).
    document.addEventListener('visibilitychange', function () {
        paused = (document.visibilityState === 'hidden');
        if (!paused && !pollTimer) startPolling();
    });

    $('#dtb-ops-refresh-btn').on('click', function (e) {
        e.preventDefault();
        loadKpis();
    });

    $(document).ready(function () {
        if (typeof dtbOps !== 'undefined') startPolling();
    });
}(jQuery));
JS;
}

// =============================================================================
// SECTION 5 — DASHBOARD PAGE RENDER
// =============================================================================

/**
 * Render the DTB Ops main dashboard page.
 */
function dtb_ops_render_dashboard(): void {
	if ( ! current_user_can( 'manage_options' ) ) {
		wp_die( esc_html__( 'Insufficient permissions.', 'dtb' ) );
	}
	?>
	<div class="wrap">
		<h1>
			<?php esc_html_e( 'DTB Ops Dashboard', 'dtb' ); ?>
			<small style="font-size:13px;color:#666;margin-left:8px;">v<?php echo esc_html( DTB_OPS_VERSION ); ?></small>
			<a href="#" id="dtb-ops-refresh-btn" class="button button-secondary"><?php esc_html_e( 'Refresh', 'dtb' ); ?></a>
		</h1>

		<div id="dtb-ops-kpis" class="dtb-ops-grid">
			<?php foreach ( dtb_ops_kpi_definitions() as $key => $def ) : ?>
			<div class="dtb-ops-kpi" id="dtb-kpi-<?php echo esc_attr( $key ); ?>">
				<div class="dtb-ops-kpi__label"><?php echo esc_html( $def['label'] ); ?></div>
				<div class="dtb-ops-kpi__value"><?php esc_html_e( '—', 'dtb' ); ?></div>
			</div>
			<?php endforeach; ?>
		</div>

		<div class="dtb-ops-section">
			<h2><?php esc_html_e( 'Recent Audit Events', 'dtb' ); ?></h2>
			<?php dtb_ops_render_recent_audit(); ?>
		</div>
	</div>
	<?php
}

/**
 * Render the audit log admin page.
 */
function dtb_ops_render_audit_page(): void {
	if ( ! current_user_can( 'manage_options' ) ) {
		wp_die( esc_html__( 'Insufficient permissions.', 'dtb' ) );
	}

	$page     = max( 1, (int) ( $_GET['paged'] ?? 1 ) );
	$per_page = 50;
	$offset   = ( $page - 1 ) * $per_page;
	$rows     = dtb_ops_get_audit_log( $per_page, $offset );
	?>
	<div class="wrap">
		<h1><?php esc_html_e( 'DTB Ops — Audit Log', 'dtb' ); ?></h1>
		<table class="wp-list-table widefat striped">
			<thead>
				<tr>
					<th><?php esc_html_e( 'Time', 'dtb' ); ?></th>
					<th><?php esc_html_e( 'User', 'dtb' ); ?></th>
					<th><?php esc_html_e( 'Event', 'dtb' ); ?></th>
					<th><?php esc_html_e( 'Context', 'dtb' ); ?></th>
					<th><?php esc_html_e( 'IP', 'dtb' ); ?></th>
				</tr>
			</thead>
			<tbody>
				<?php if ( empty( $rows ) ) : ?>
				<tr><td colspan="5"><em><?php esc_html_e( 'No audit events yet.', 'dtb' ); ?></em></td></tr>
				<?php else : ?>
				<?php foreach ( $rows as $row ) : ?>
				<tr>
					<td><code><?php echo esc_html( $row->log_timestamp ); ?></code></td>
					<?php
					if ( $row->user_id > 0 ) {
						$_u      = get_userdata( $row->user_id );
						$_label  = ( $_u instanceof WP_User ) ? $_u->user_login : (string) $row->user_id;
					} else {
						$_label = '—';
					}
				?>
				<td><?php echo esc_html( $_label ); ?></td>
					<td><code><?php echo esc_html( $row->event ); ?></code></td>
					<td><code style="font-size:11px;word-break:break-all;"><?php echo esc_html( $row->context ); ?></code></td>
					<td><?php echo esc_html( $row->ip ); ?></td>
				</tr>
				<?php endforeach; ?>
				<?php endif; ?>
			</tbody>
		</table>
	</div>
	<?php
}

/**
 * Render the most recent 10 audit entries inline in the dashboard.
 */
function dtb_ops_render_recent_audit(): void {
	$rows = dtb_ops_get_audit_log( 10 );
	if ( empty( $rows ) ) {
		echo '<p><em>' . esc_html__( 'No events yet.', 'dtb' ) . '</em></p>';
		return;
	}
	echo '<table class="wp-list-table widefat striped" style="font-size:13px">';
	echo '<thead><tr><th>Time</th><th>Event</th><th>Context</th></tr></thead><tbody>';
	foreach ( $rows as $row ) {
		echo '<tr>';
		echo '<td><code>' . esc_html( $row->log_timestamp ) . '</code></td>';
		echo '<td><code>' . esc_html( $row->event ) . '</code></td>';
		echo '<td><code style="font-size:11px;">' . esc_html( substr( $row->context, 0, 160 ) ) . '</code></td>';
		echo '</tr>';
	}
	echo '</tbody></table>';
}

// =============================================================================
// SECTION 6 — AJAX: KPI DATA ENDPOINT
// =============================================================================

add_action( 'wp_ajax_dtb_ops_kpis', 'dtb_ops_ajax_kpis' );

/**
 * AJAX handler: return all KPI values as JSON.
 */
function dtb_ops_ajax_kpis(): void {
	check_ajax_referer( 'dtb_ops_nonce', 'nonce' );

	if ( ! current_user_can( 'manage_options' ) ) {
		wp_send_json_error( [ 'message' => 'Insufficient permissions.' ], 403 );
	}

	$kpis = dtb_ops_get_all_kpis();
	wp_send_json_success( $kpis );
}

/**
 * Aggregate all KPI values, using cached data where available.
 *
 * @return array<string, array{ label: string, value: string, warn: bool }>
 */
function dtb_ops_get_all_kpis(): array {
	$kpis = [];

	// Orders today.
	$orders_today = function_exists( 'dtb_woo_get_orders_today' ) ? dtb_woo_get_orders_today() : '—';
	$kpis['orders_today'] = [
		'label' => 'Orders Today',
		'value' => (string) $orders_today,
		'warn'  => false,
	];

	// Orders by status (processing + on-hold).
	if ( function_exists( 'dtb_woo_get_orders_by_status' ) ) {
		$by_status = dtb_woo_get_orders_by_status( [ 'processing', 'on-hold' ] );
		$kpis['orders_processing'] = [
			'label' => 'Processing',
			'value' => (string) ( $by_status['processing'] ?? 0 ),
			'warn'  => ( ( $by_status['processing'] ?? 0 ) > 50 ),
		];
		$kpis['orders_on_hold'] = [
			'label' => 'On Hold',
			'value' => (string) ( $by_status['on-hold'] ?? 0 ),
			'warn'  => ( ( $by_status['on-hold'] ?? 0 ) > 10 ),
		];
	}

	// Low stock.
	if ( function_exists( 'dtb_woo_get_low_stock_count' ) ) {
		$low_stock = dtb_woo_get_low_stock_count();
		$kpis['low_stock'] = [
			'label' => 'Low Stock SKUs',
			'value' => (string) $low_stock,
			'warn'  => ( $low_stock > 0 ),
		];
	}

	// Pending repairs (Veeqo).
	if ( function_exists( 'dtb_veeqo_get_pending_repairs_count' ) ) {
		$repairs = dtb_veeqo_get_pending_repairs_count();
		$kpis['pending_repairs'] = [
			'label' => 'Pending Repairs',
			'value' => (string) $repairs,
			'warn'  => ( $repairs > 20 ),
		];
	}

	// Active memberships.
	if ( function_exists( 'dtb_membership_get_active_count' ) ) {
		$members = dtb_membership_get_active_count();
		$kpis['active_members'] = [
			'label' => 'Active Members',
			'value' => (string) $members,
			'warn'  => false,
		];
	}

	// Rewards liability.
	if ( function_exists( 'dtb_rewards_get_total_liability' ) ) {
		$liability = dtb_rewards_get_total_liability();
		$kpis['rewards_liability'] = [
			'label' => 'Rewards Liability',
			'value' => '$' . number_format( $liability, 2 ),
			'warn'  => ( $liability > 5000 ),
		];
	}

	// Image sync health.
	if ( function_exists( 'dtb_image_sync_get_status' ) ) {
		$sync = dtb_image_sync_get_status();
		$kpis['image_sync'] = [
			'label' => 'Image Sync',
			'value' => $sync['health'],
			'warn'  => ( 'ok' !== $sync['health'] && 'never' !== $sync['health'] ),
		];
	}

	return $kpis;
}

/**
 * Return the KPI definition map (label only — values filled by AJAX).
 *
 * @return array<string, array{ label: string }>
 */
function dtb_ops_kpi_definitions(): array {
	return [
		'orders_today'     => [ 'label' => 'Orders Today' ],
		'orders_processing' => [ 'label' => 'Processing' ],
		'orders_on_hold'   => [ 'label' => 'On Hold' ],
		'low_stock'        => [ 'label' => 'Low Stock SKUs' ],
		'pending_repairs'  => [ 'label' => 'Pending Repairs' ],
		'active_members'   => [ 'label' => 'Active Members' ],
		'rewards_liability' => [ 'label' => 'Rewards Liability' ],
		'image_sync'       => [ 'label' => 'Image Sync' ],
	];
}

// =============================================================================
// SECTION 7 — AJAX: AUDIT LOG ENDPOINT
// =============================================================================

add_action( 'wp_ajax_dtb_ops_audit_log', 'dtb_ops_ajax_audit_log' );

/**
 * AJAX handler: return paginated audit log as JSON.
 */
function dtb_ops_ajax_audit_log(): void {
	check_ajax_referer( 'dtb_ops_nonce', 'nonce' );

	if ( ! current_user_can( 'manage_options' ) ) {
		wp_send_json_error( [ 'message' => 'Insufficient permissions.' ], 403 );
	}

	$page     = max( 1, (int) ( $_POST['page'] ?? 1 ) );
	$per_page = min( 100, max( 10, (int) ( $_POST['per_page'] ?? 25 ) ) );
	$offset   = ( $page - 1 ) * $per_page;
	$rows     = dtb_ops_get_audit_log( $per_page, $offset );

	wp_send_json_success( [
		'rows'    => $rows,
		'page'    => $page,
		'per_page'=> $per_page,
	] );
}

// =============================================================================
// SECTION 8 — AUDIT LOG WRITER
// =============================================================================

/**
 * Write an entry to the DTB audit log table.
 *
 * @param string $event   Short event identifier (e.g. 'qbo_sync_complete').
 * @param array  $context Optional additional context (will be JSON-encoded).
 * @param int    $user_id WordPress user ID (0 = system/cron).
 */
function dtb_ops_audit_log( string $event, array $context = [], int $user_id = 0 ): void {
	global $wpdb;

	$table = $wpdb->prefix . 'dtb_audit_log';

	if ( 0 === $user_id ) {
		$user_id = get_current_user_id();
	}

	$ip = function_exists( 'dtb_anonymise_ip' )
		? dtb_anonymise_ip( function_exists( 'dtb_get_client_ip' ) ? dtb_get_client_ip() : '' )
		: '';

	// phpcs:ignore WordPress.DB.DirectDatabaseQuery
	$wpdb->insert(
		$table,
		[
			'log_timestamp' => current_time( 'mysql', true ),
			'user_id'       => $user_id,
			'event'         => sanitize_key( $event ),
			'context'       => wp_json_encode( $context ) ?: '',
			'ip'            => sanitize_text_field( $ip ),
		],
		[ '%s', '%d', '%s', '%s', '%s' ]
	);
}

/**
 * Read recent audit log entries.
 *
 * @param int $limit  Number of rows to return.
 * @param int $offset Query offset (for pagination).
 * @return object[]   Array of stdClass rows.
 */
function dtb_ops_get_audit_log( int $limit = 50, int $offset = 0 ): array {
	global $wpdb;

	$table = $wpdb->prefix . 'dtb_audit_log';

	// phpcs:ignore WordPress.DB.DirectDatabaseQuery, WordPress.DB.PreparedSQL.InterpolatedNotPrepared
	$rows = $wpdb->get_results(
		$wpdb->prepare(
			"SELECT id, log_timestamp, user_id, event, context, ip
			 FROM {$table}
			 ORDER BY id DESC
			 LIMIT %d OFFSET %d",
			$limit,
			$offset
		)
	);

	return is_array( $rows ) ? $rows : [];
}

/**
 * Purge audit log entries older than DTB_OPS_AUDIT_RETENTION days.
 *
 * Scheduled via cron (dtb_ops_audit_purge).
 */
function dtb_ops_purge_old_audit_entries(): void {
	global $wpdb;

	$table    = $wpdb->prefix . 'dtb_audit_log';
	$cutoff   = gmdate( 'Y-m-d H:i:s', strtotime( '-' . DTB_OPS_AUDIT_RETENTION . ' days' ) );

	// phpcs:ignore WordPress.DB.DirectDatabaseQuery, WordPress.DB.PreparedSQL.InterpolatedNotPrepared
	$wpdb->query(
		$wpdb->prepare(
			"DELETE FROM {$table} WHERE log_timestamp < %s",
			$cutoff
		)
	);
}

// =============================================================================
// SECTION 9 — CRON: BACKGROUND KPI REFRESH & AUDIT PURGE
// =============================================================================

add_action( 'init', 'dtb_ops_schedule_cron' );

/**
 * Register cron jobs if not already scheduled.
 */
function dtb_ops_schedule_cron(): void {
	if ( ! wp_next_scheduled( 'dtb_ops_refresh_kpis' ) ) {
		wp_schedule_event( time(), 'dtb_ops_every_5_min', 'dtb_ops_refresh_kpis' );
	}

	if ( ! wp_next_scheduled( 'dtb_ops_audit_purge' ) ) {
		wp_schedule_event( time(), 'daily', 'dtb_ops_audit_purge' );
	}
}

add_filter( 'cron_schedules', 'dtb_ops_add_cron_intervals' );

/**
 * Register a 5-minute cron interval.
 *
 * @param array $schedules Existing WordPress cron schedules.
 * @return array Modified schedules.
 */
function dtb_ops_add_cron_intervals( array $schedules ): array {
	if ( ! isset( $schedules['dtb_ops_every_5_min'] ) ) {
		$schedules['dtb_ops_every_5_min'] = [
			'interval' => 300,
			'display'  => __( 'Every 5 minutes (DTB Ops)', 'dtb' ),
		];
	}
	return $schedules;
}

add_action( 'dtb_ops_refresh_kpis', 'dtb_ops_cron_refresh_kpis' );

/**
 * Cron callback: warm the KPI cache so the dashboard loads instantly.
 */
function dtb_ops_cron_refresh_kpis(): void {
	dtb_ops_get_all_kpis();
	dtb_ops_audit_log( 'cron_kpi_refresh', [ 'ts' => gmdate( 'c' ) ], 0 );
}

add_action( 'dtb_ops_audit_purge', 'dtb_ops_purge_old_audit_entries' );

// =============================================================================
// SECTION 10 — REST: dtb/v1/health
// =============================================================================

if ( dtb_is_rest_api_request() ) {
	add_action( 'rest_api_init', 'dtb_ops_register_health_route' );
}

/**
 * Register the public health-check REST endpoint.
 */
function dtb_ops_register_health_route(): void {
	register_rest_route(
		'dtb/v1',
		'/health',
		[
			'methods'             => WP_REST_Server::READABLE,
			'callback'            => 'dtb_ops_rest_health',
			'permission_callback' => '__return_true',
		]
	);
}

/**
 * REST callback for GET /dtb/v1/health.
 *
 * @return WP_REST_Response
 */
function dtb_ops_rest_health(): WP_REST_Response {
	global $wpdb;

	$db_ok = false;
	try {
		// phpcs:ignore WordPress.DB.DirectDatabaseQuery
		$db_ok = ( 1 === (int) $wpdb->get_var( 'SELECT 1' ) );
	} catch ( \Throwable $e ) {
		$db_ok = false;
	}

	$data = [
		'status'      => $db_ok ? 'ok' : 'degraded',
		'version'     => DTB_OPS_VERSION,
		'db_version'  => DTB_OPS_DB_VERSION,
		'db_ok'       => $db_ok,
		'php_version' => PHP_VERSION,
		'wp_version'  => get_bloginfo( 'version' ),
		'checked_at'  => gmdate( 'c' ),
	];

	return new WP_REST_Response( $data, $db_ok ? 200 : 503 );
}

// =============================================================================
// SECTION 11 — CAPABILITY HELPERS
// =============================================================================

/**
 * Check whether the current user has the given WordPress capability
 * OR any of the custom DTB ops capabilities.
 *
 * Falls back gracefully when the DTB_CAP_* constants are not yet defined
 * (e.g. early-loading edge cases on shared hosting).
 *
 * @param string $fallback_cap Standard WordPress capability to check first.
 * @return bool
 */
if ( ! function_exists( 'dtb_ops_can' ) ) {
	function dtb_ops_can( string $fallback_cap = 'manage_options' ): bool {
		if ( current_user_can( $fallback_cap ) ) {
			return true;
		}

		$dtb_caps = [];
		foreach ( [ 'DTB_CAP_OPS_ADMIN', 'DTB_CAP_ACCOUNTING', 'DTB_CAP_SUPPORT', 'DTB_CAP_CATALOG' ] as $const ) {
			if ( defined( $const ) ) {
				$dtb_caps[] = constant( $const );
			}
		}

		foreach ( $dtb_caps as $cap ) {
			if ( current_user_can( $cap ) ) {
				return true;
			}
		}

		return false;
	}
}
