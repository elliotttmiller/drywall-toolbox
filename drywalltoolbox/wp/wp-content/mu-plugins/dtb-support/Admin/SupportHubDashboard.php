<?php
/**
 * Admin — SupportHubDashboard
 *
 * Command center shell for the rebuilt support experience.
 *
 * @package drywall-toolbox
 */

defined( 'ABSPATH' ) || exit;

function dtb_support_render_dashboard_page(): void {
if ( ! current_user_can( 'dtb_manage_support' ) && ! current_user_can( 'manage_options' ) ) {
wp_die( 'You do not have permission to view this page.' );
}

if ( ! empty( $_GET['ticket_id'] ) ) {
dtb_support_render_ticket_detail_page( absint( $_GET['ticket_id'] ) );
return;
}

$initial_queue = (string) get_option( 'dtb_support_default_queue', 'needs_reply' );
$queue_counts  = function_exists( 'dtb_support_get_queue_counts' ) ? dtb_support_get_queue_counts() : [];
$kpis          = dtb_support_get_kpis();
$settings_url  = admin_url( 'admin.php?page=dtb-support-settings' );
?>
<div class="dtb-wrap">
<div class="dtb-cc-shell">
<aside class="dtb-cc-rail">
<?php dtb_support_render_queue_rail( $queue_counts, $initial_queue ); ?>
</aside>

<main class="dtb-cc-main">
<div class="dtb-topbar">
<h1 class="dtb-topbar__title">Support Command Center</h1>
<p class="dtb-topbar__queue">Queue: <strong id="dtb-active-queue-label"><?php echo esc_html( dtb_support_queue_label( $initial_queue ) ); ?></strong></p>
<div style="margin-left:auto;display:flex;gap:8px;flex-wrap:wrap;">
<button type="button" class="dtb-btn dtb-btn--ghost dtb-btn--sm" onclick="dtbSupport.refresh()">Refresh</button>
<a href="<?php echo esc_url( $settings_url ); ?>" class="dtb-btn dtb-btn--ghost dtb-btn--sm">Settings</a>
</div>
</div>

<div class="dtb-kpi-strip" id="dtb-kpi-strip">
<?php dtb_support_render_command_center_kpis( $kpis ); ?>
</div>

<div class="dtb-toolbar">
<input type="search" id="dtb-search" class="dtb-search" placeholder="Search subject, email, ticket #" oninput="dtbSupport.applyFilters()">
<select id="dtb-filter-type" class="dtb-select" onchange="dtbSupport.applyFilters()">
<option value="">All Types</option>
<?php foreach ( dtb_support_all_types() as $slug => $label ) : ?>
<option value="<?php echo esc_attr( $slug ); ?>"><?php echo esc_html( $label ); ?></option>
<?php endforeach; ?>
</select>
<select id="dtb-filter-priority" class="dtb-select" onchange="dtbSupport.applyFilters()">
<option value="">All Priorities</option>
<?php foreach ( dtb_support_all_priorities() as $slug => $label ) : ?>
<option value="<?php echo esc_attr( $slug ); ?>"><?php echo esc_html( $label ); ?></option>
<?php endforeach; ?>
</select>
<button type="button" class="dtb-btn dtb-btn--ghost dtb-btn--sm" id="dtb-clear-filters" onclick="dtbSupport.clearFilters()" style="display:none;">Clear</button>
<div style="margin-left:auto;display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
<span id="dtb-ticket-count" style="font-size:12px;color:#718096;">Loading…</span>
</div>
</div>

<div class="dtb-toolbar" id="dtb-bulk-bar" style="display:none;border-top:1px solid #f0f2f5;">
<strong id="dtb-bulk-count">0 selected</strong>
<select id="dtb-bulk-action" class="dtb-select">
<option value="">Bulk action…</option>
<option value="assign_me">Assign to me</option>
<option value="set_status:in_progress">Set status: In Progress</option>
<option value="set_status:resolved">Set status: Resolved</option>
<option value="set_priority:urgent">Set priority: Urgent</option>
<option value="set_priority:high">Set priority: High</option>
<option value="unsnooze">Unsnooze</option>
</select>
<button type="button" class="dtb-btn dtb-btn--primary dtb-btn--sm" onclick="dtbSupport.executeBulkAction()">Apply</button>
<button type="button" class="dtb-btn dtb-btn--ghost dtb-btn--sm" onclick="dtbSupport.clearSelection()">Clear</button>
</div>

<section class="dtb-ticket-list">
<div class="dtb-loading" id="dtb-list-loading"><div class="dtb-spinner"></div>Loading queue…</div>
<div class="dtb-empty" id="dtb-empty-state" style="display:none;">
<span class="dtb-empty__icon">📭</span>
<p class="dtb-empty__msg">No tickets in this queue.</p>
<p class="dtb-empty__sub">Try another queue or clear filters.</p>
</div>
<table class="dtb-table" id="dtb-tickets-table" style="display:none;">
<thead>
<tr>
<th style="width:36px"><input id="dtb-select-all" type="checkbox" onchange="dtbSupport.selectAll(this.checked)"></th>
<th style="width:120px">Ticket #</th>
<th>Subject</th>
<th style="width:120px">Status</th>
<th style="width:90px">Priority</th>
<th style="width:110px">Type</th>
<th style="width:120px">Assigned</th>
<th style="width:120px">Action Due</th>
<th style="width:80px">Age</th>
<th style="width:110px"></th>
</tr>
</thead>
<tbody id="dtb-tickets-tbody"></tbody>
</table>
</section>

<div class="dtb-table-footer" id="dtb-pagination" style="display:none;">
<div class="dtb-pager">
<button type="button" class="dtb-btn dtb-btn--ghost dtb-btn--sm" id="dtb-prev-page" onclick="dtbSupport.prevPage()">← Prev</button>
<span id="dtb-page-info">Page 1 of 1</span>
<button type="button" class="dtb-btn dtb-btn--ghost dtb-btn--sm" id="dtb-next-page" onclick="dtbSupport.nextPage()">Next →</button>
</div>
<div id="dtb-last-refresh">Waiting for first refresh…</div>
</div>
</main>

<aside class="dtb-cc-context" id="dtb-context-panel">
<div class="dtb-ctx-section">
<div class="dtb-ctx-section__title">Command Center</div>
<div class="dtb-ctx-row"><span class="dtb-ctx-label">Selected queue</span><span class="dtb-ctx-value" id="dtb-context-queue"><?php echo esc_html( dtb_support_queue_label( $initial_queue ) ); ?></span></div>
<div class="dtb-ctx-row"><span class="dtb-ctx-label">Auto-refresh</span><span class="dtb-ctx-value"><?php echo esc_html( max( 30, (int) get_option( 'dtb_support_poll_interval', 60 ) ) ); ?>s</span></div>
<div class="dtb-ctx-row"><span class="dtb-ctx-label">Shortcuts</span><span class="dtb-ctx-value">/ search · r refresh · esc close</span></div>
</div>
<div class="dtb-ctx-section">
<div class="dtb-ctx-section__title">Queue summary</div>
<?php foreach ( dtb_support_queue_rail_items() as $queue => $meta ) : ?>
<div class="dtb-ctx-row"><span class="dtb-ctx-label"><?php echo esc_html( $meta['label'] ); ?></span><span class="dtb-ctx-value"><?php echo esc_html( (string) ( $queue_counts[ $queue ] ?? 0 ) ); ?></span></div>
<?php endforeach; ?>
</div>
<div class="dtb-ctx-section">
<div class="dtb-ctx-section__title">Selected ticket</div>
<p class="dtb-empty__sub" style="margin:0;">Open a ticket to load customer context, actions, and reply tools.</p>
</div>
</aside>
</div>

<div id="dtb-detail-overlay" style="display:none;position:fixed;inset:0;background:rgba(15,23,42,.55);z-index:99998;" onclick="dtbSupport.closeDetail(event)">
<div id="dtb-detail-panel" style="position:absolute;inset:32px 32px 32px 180px;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 24px 80px rgba(15,23,42,.35);" onclick="event.stopPropagation()">
<div class="dtb-loading" id="dtb-detail-loading"><div class="dtb-spinner"></div>Loading ticket…</div>
<div id="dtb-detail-content" style="display:none;height:100%;"></div>
</div>
</div>
<div id="dtb-toast-container" style="position:fixed;right:24px;bottom:24px;display:flex;flex-direction:column;gap:8px;z-index:99999;"></div>
</div>
<?php
}

function dtb_support_queue_rail_items(): array {
return [
'needs_reply'          => [ 'label' => 'Needs Reply',         'badge_class' => '' ],
'overdue'              => [ 'label' => 'Overdue',             'badge_class' => 'dtb-rail-badge--urgent' ],
'due_soon'             => [ 'label' => 'Due Soon',            'badge_class' => 'dtb-rail-badge--warning' ],
'unassigned'           => [ 'label' => 'Unassigned',          'badge_class' => '' ],
'urgent'               => [ 'label' => 'Urgent',              'badge_class' => 'dtb-rail-badge--urgent' ],
'in_progress'          => [ 'label' => 'In Progress',         'badge_class' => '' ],
'waiting_on_customer'  => [ 'label' => 'Waiting on Customer', 'badge_class' => '' ],
'snoozed'              => [ 'label' => 'Snoozed',             'badge_class' => '' ],
'resolved_pending_close' => [ 'label' => 'Resolved',          'badge_class' => '' ],
'all_active'           => [ 'label' => 'All Active',          'badge_class' => '' ],
];
}

function dtb_support_queue_label( string $queue ): string {
$items = dtb_support_queue_rail_items();
return $items[ $queue ]['label'] ?? ucfirst( str_replace( '_', ' ', $queue ) );
}

function dtb_support_render_queue_rail( array $queue_counts, string $active_queue ): void {
?>
<div class="dtb-rail-header">Queues</div>
<?php foreach ( dtb_support_queue_rail_items() as $queue => $meta ) : ?>
<a href="#" class="dtb-rail-item <?php echo $queue === $active_queue ? 'is-active' : ''; ?>" data-queue="<?php echo esc_attr( $queue ); ?>">
<span><?php echo esc_html( $meta['label'] ); ?></span>
<span class="dtb-rail-badge <?php echo esc_attr( $meta['badge_class'] ); ?>"><?php echo esc_html( (string) ( $queue_counts[ $queue ] ?? 0 ) ); ?></span>
</a>
<?php endforeach; ?>
<?php
}

function dtb_support_render_command_center_kpis( array $kpis ): void {
$cards = [
[ 'label' => 'Active',         'value' => $kpis['active_total'] ?? $kpis['total'] ?? 0, 'class' => 'ok' ],
[ 'label' => 'Needs Reply',    'value' => $kpis['needs_reply']    ?? 0, 'class' => ( (int) ( $kpis['needs_reply']    ?? 0 ) > 0 ) ? 'warning' : 'ok' ],
[ 'label' => 'Overdue',        'value' => $kpis['overdue_count']  ?? 0, 'class' => ( (int) ( $kpis['overdue_count']  ?? 0 ) > 0 ) ? 'breach'  : 'ok' ],
[ 'label' => 'Due Soon',       'value' => $kpis['due_soon_count'] ?? 0, 'class' => ( (int) ( $kpis['due_soon_count'] ?? 0 ) > 0 ) ? 'warning' : 'ok' ],
[ 'label' => 'Unassigned',     'value' => $kpis['unassigned']     ?? 0, 'class' => ( (int) ( $kpis['unassigned']     ?? 0 ) > 0 ) ? 'warning' : 'ok' ],
[ 'label' => 'Urgent',         'value' => $kpis['urgent']         ?? 0, 'class' => ( (int) ( $kpis['urgent']         ?? 0 ) > 0 ) ? 'breach'  : 'ok' ],
[ 'label' => 'Email Failures', 'value' => $kpis['email_failures'] ?? 0, 'class' => ( (int) ( $kpis['email_failures'] ?? 0 ) > 0 ) ? 'warning' : 'ok' ],
];

foreach ( $cards as $card ) {
echo '<div class="dtb-kpi dtb-kpi--' . esc_attr( $card['class'] ) . '"><div class="dtb-kpi__val">' . esc_html( (string) $card['value'] ) . '</div><div class="dtb-kpi__label">' . esc_html( $card['label'] ) . '</div></div>';
}
}
