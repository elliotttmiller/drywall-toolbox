<?php
/**
 * Admin — SupportHubDashboard
 *
 * Single-page Support Hub: KPI strip, status tabs, toolbar, ticket table
 * with inline expand rows and pagination.
 *
 * Routing: when ?ticket_id is present the detail page is rendered instead.
 *
 * @package drywall-toolbox
 */

defined( 'ABSPATH' ) || exit;

// ---------------------------------------------------------------------------
// Dashboard page
// ---------------------------------------------------------------------------

function dtb_support_render_dashboard_page(): void {
	if ( ! current_user_can( 'dtb_manage_support' ) && ! current_user_can( 'manage_options' ) ) {
		wp_die( 'You do not have permission to view this page.' );
	}

	// Route to detail page when a ticket_id param is present.
	if ( ! empty( $_GET['ticket_id'] ) ) {
		dtb_support_render_ticket_detail_page( absint( $_GET['ticket_id'] ) );
		return;
	}

	// ── Query params ──────────────────────────────────────────────────────────
	$status_filter   = sanitize_text_field( $_GET['status']   ?? '' );
	$type_filter     = sanitize_text_field( $_GET['type']     ?? '' );
	$priority_filter = sanitize_text_field( $_GET['priority'] ?? '' );
	$search          = sanitize_text_field( $_GET['s']        ?? '' );
	$current_page    = max( 1, (int) ( $_GET['paged'] ?? 1 ) );
	$per_page        = 25;

	// ── Data ──────────────────────────────────────────────────────────────────
	$kpis   = dtb_support_get_kpis();
	$counts = dtb_support_count_by_status();

	$query = dtb_support_query_tickets( [
		'status'   => $status_filter,
		'type'     => $type_filter,
		'priority' => $priority_filter,
		'search'   => $search,
		'page'     => $current_page,
		'per_page' => $per_page,
		'order_by' => 'created_at',
		'order'    => 'DESC',
	] );

	$tickets    = array_map( 'dtb_support_project_ticket', $query['tickets'] );
	$total      = (int) $query['total'];
	$page_count = (int) $query['page_count'];
	$statuses   = dtb_support_all_statuses();
	$types      = dtb_support_all_types();
	$priorities = dtb_support_all_priorities();

	$base_url      = admin_url( 'admin.php?page=dtb-support' );
	$settings_url  = admin_url( 'admin.php?page=dtb-support-settings' );
	$total_all     = (int) array_sum( $counts );
	$poll_interval = max( 0, (int) get_option( 'dtb_support_poll_interval', 60 ) );
	?>
<div class="dtb-wrap">

	<!-- ── Top Bar ──────────────────────────────────────────────────────────── -->
	<div class="dtb-topbar">
		<div class="dtb-topbar__left">
			<h1 class="dtb-topbar__title">Support Hub</h1>
			<p class="dtb-topbar__sub"><?php echo esc_html( sprintf( '%d tickets total', $total_all ) ); ?></p>
		</div>
		<div class="dtb-topbar__actions">
			<a href="<?php echo esc_url( $settings_url ); ?>" class="dtb-btn dtb-btn--ghost dtb-btn--sm">Settings</a>
		</div>
	</div>

	<!-- ── KPI Strip ────────────────────────────────────────────────────────── -->
	<div class="dtb-kpi-strip" id="dtb-kpi-strip">
		<?php dtb_support_render_kpi_strip( $kpis ); ?>
	</div>

	<!-- ── Main card ────────────────────────────────────────────────────────── -->
	<div class="dtb-card">

		<!-- Status tabs -->
		<div class="dtb-tabs">
			<?php
			$all_url = $base_url;
			if ( $type_filter )     $all_url = add_query_arg( 'type',     $type_filter,     $all_url );
			if ( $priority_filter ) $all_url = add_query_arg( 'priority', $priority_filter, $all_url );
			if ( $search )          $all_url = add_query_arg( 's',        $search,          $all_url );
			?>
			<a href="<?php echo esc_url( $all_url ); ?>"
				class="dtb-tab <?php echo '' === $status_filter ? 'dtb-tab--active' : ''; ?>">
				All <span class="dtb-tab__count"><?php echo esc_html( $total_all ); ?></span>
			</a>
			<?php foreach ( $statuses as $slug => $label ) :
				$cnt     = (int) ( $counts[ $slug ] ?? 0 );
				$tab_url = add_query_arg(
					array_filter( [
						'status'   => $slug,
						'type'     => $type_filter     ?: null,
						'priority' => $priority_filter ?: null,
						's'        => $search          ?: null,
					] ),
					$base_url
				);
				?>
				<a href="<?php echo esc_url( $tab_url ); ?>"
					class="dtb-tab <?php echo $status_filter === $slug ? 'dtb-tab--active' : ''; ?>">
					<span class="dtb-tab__dot dtb-tab__dot--<?php echo esc_attr( $slug ); ?>"></span>
					<?php echo esc_html( $label ); ?>
					<span class="dtb-tab__count"><?php echo esc_html( $cnt ); ?></span>
				</a>
			<?php endforeach; ?>
		</div>

		<!-- Toolbar: search + filters -->
		<form method="get" action="<?php echo esc_url( admin_url( 'admin.php' ) ); ?>">
			<input type="hidden" name="page" value="dtb-support">
			<?php if ( $status_filter ) : ?>
				<input type="hidden" name="status" value="<?php echo esc_attr( $status_filter ); ?>">
			<?php endif; ?>
			<div class="dtb-toolbar">
				<div class="dtb-toolbar__search-wrap">
					<span class="dtb-toolbar__search-icon">
						<svg width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.2" viewBox="0 0 24 24">
							<circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
						</svg>
					</span>
					<input type="search" name="s" value="<?php echo esc_attr( $search ); ?>"
						class="dtb-search" placeholder="Search tickets...">
				</div>

				<select name="type" class="dtb-select">
					<option value="">All Types</option>
					<?php foreach ( $types as $slug => $label ) : ?>
						<option value="<?php echo esc_attr( $slug ); ?>" <?php selected( $type_filter, $slug ); ?>>
							<?php echo esc_html( $label ); ?>
						</option>
					<?php endforeach; ?>
				</select>

				<select name="priority" class="dtb-select">
					<option value="">All Priorities</option>
					<?php foreach ( $priorities as $slug => $label ) : ?>
						<option value="<?php echo esc_attr( $slug ); ?>" <?php selected( $priority_filter, $slug ); ?>>
							<?php echo esc_html( $label ); ?>
						</option>
					<?php endforeach; ?>
				</select>

				<button type="submit" class="dtb-btn dtb-btn--ghost dtb-btn--sm">Filter</button>

				<?php if ( $search || $type_filter || $priority_filter ) : ?>
					<a href="<?php echo esc_url( $status_filter ? add_query_arg( 'status', $status_filter, $base_url ) : $base_url ); ?>"
						class="dtb-btn dtb-btn--ghost dtb-btn--sm">Clear</a>
				<?php endif; ?>

				<div class="dtb-toolbar__spacer"></div>

				<span class="dtb-toolbar__count">
					<?php
					if ( $total > 0 ) {
						$from = ( ( $current_page - 1 ) * $per_page ) + 1;
						$to   = min( $current_page * $per_page, $total );
						echo esc_html( sprintf( '%d-%d of %d', $from, $to, $total ) );
					} else {
						echo '0 results';
					}
					?>
				</span>
			</div>
		</form>

		<!-- Tickets table -->
		<table class="dtb-table" id="dtb-tickets-table">
			<thead>
				<tr>
					<th style="width:128px">Ticket ID</th>
					<th>Subject</th>
					<th style="width:130px">Status</th>
					<th style="width:90px">Priority</th>
					<th style="width:100px">Type</th>
					<th style="width:140px">Customer</th>
					<th style="width:120px">Assigned</th>
					<th style="width:62px">Action Due</th>
					<th style="width:72px">Age</th>
					<th style="width:34px"></th>
				</tr>
			</thead>
			<tbody>
				<?php if ( empty( $tickets ) ) : ?>
					<tr>
						<td colspan="10">
							<div class="dtb-empty">
								<span class="dtb-empty__icon">&#127881;</span>
								<p class="dtb-empty__msg">
									<?php if ( $search || $status_filter || $type_filter || $priority_filter ) : ?>
										No tickets match your filters.
									<?php else : ?>
										No tickets yet &#8212; you're all caught up!
									<?php endif; ?>
								</p>
								<?php if ( $search || $type_filter || $priority_filter ) : ?>
									<p class="dtb-empty__sub">
										<a href="<?php echo esc_url( $status_filter ? add_query_arg( 'status', $status_filter, $base_url ) : $base_url ); ?>">
											Clear filters
										</a>
									</p>
								<?php endif; ?>
							</div>
						</td>
					</tr>
				<?php else : ?>
					<?php foreach ( $tickets as $t ) :
						$detail_url    = add_query_arg( 'ticket_id', $t['id'], $base_url );
						$assigned_name = $t['assigned_user']['display_name'] ?? '&#8212;';
						$action_state  = $t['action_state'] ?? '';
						$action_label  = $t['action_state_label'] ?? '';
						?>
						<tr id="dtb-row-<?php echo absint( $t['id'] ); ?>">
							<td>
								<a href="<?php echo esc_url( $detail_url ); ?>" class="dtb-tid">
									<?php echo esc_html( $t['ticket_number'] ); ?>
								</a>
							</td>
							<td>
								<a href="<?php echo esc_url( $detail_url ); ?>" class="dtb-subject">
									<?php echo esc_html( $t['subject'] ); ?>
								</a>
								<div class="dtb-subject-meta"><?php echo esc_html( $t['customer_email'] ); ?></div>
							</td>
							<td>
								<span class="dtb-status">
									<span class="dtb-status__dot dtb-status__dot--<?php echo esc_attr( $t['status'] ); ?>"></span>
									<?php echo esc_html( $t['status_label'] ?? $t['status'] ); ?>
								</span>
							</td>
							<td>
								<span class="dtb-pri dtb-pri--<?php echo esc_attr( $t['priority'] ); ?>">
									<?php echo esc_html( $t['priority_label'] ?? $t['priority'] ); ?>
								</span>
							</td>
							<td>
								<span class="dtb-type">
									<?php echo esc_html( $t['type_label'] ?? ( $t['ticket_type'] ?? '' ) ); ?>
								</span>
							</td>
							<td><?php echo esc_html( $t['customer_name'] ); ?></td>
							<td><?php echo esc_html( $assigned_name ); ?></td>
							<td>
								<?php if ( $action_state && 'ok' !== $action_state ) : ?>
									<span class="dtb-action-state dtb-action-state--<?php echo esc_attr( $action_state ); ?>">
										<?php echo esc_html( $action_label ); ?>
									</span>
								<?php elseif ( $action_state ) : ?>
									<span class="dtb-action-state dtb-action-state--ok">
										<?php echo esc_html( $action_label ); ?>
									</span>
								<?php else : ?>&mdash;<?php endif; ?>
							</td>
							<td><?php echo esc_html( $t['age_label'] ?? '&mdash;' ); ?></td>
							<td>
								<button
									id="dtb-expbtn-<?php echo absint( $t['id'] ); ?>"
									class="dtb-expand-btn"
									onclick="dtbSupport.toggleRow(<?php echo absint( $t['id'] ); ?>)"
									title="Preview">
									<svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2" viewBox="0 0 24 24">
										<polyline points="6 9 12 15 18 9"/>
									</svg>
								</button>
							</td>
						</tr>

						<!-- Inline expand row -->
						<tr id="dtb-exp-<?php echo absint( $t['id'] ); ?>" class="dtb-expand-row">
							<td colspan="10">
								<div class="dtb-expand-inner">
									<div>
										<div class="dtb-mini-thread">
											<!-- Populated by dtbSupport.loadMiniThread() -->
										</div>
									</div>
									<div class="dtb-quick-actions">
										<a href="<?php echo esc_url( $detail_url ); ?>" class="dtb-view-full-btn">
											View Full Ticket &rarr;
										</a>
									</div>
								</div>
							</td>
						</tr>

					<?php endforeach; ?>
				<?php endif; ?>
			</tbody>
		</table>

		<!-- Pagination footer -->
		<?php if ( $page_count > 1 || $total > 0 ) : ?>
			<div class="dtb-table-footer">
				<span>
					<?php
					if ( $total > 0 ) {
						$from = ( ( $current_page - 1 ) * $per_page ) + 1;
						$to   = min( $current_page * $per_page, $total );
						echo esc_html( sprintf( 'Showing %d-%d of %d tickets', $from, $to, $total ) );
					}
					?>
				</span>
				<?php if ( $page_count > 1 ) : ?>
					<div class="dtb-pager">
						<?php
						$q_args = array_filter( [
							'page'     => 'dtb-support',
							'status'   => $status_filter   ?: null,
							'type'     => $type_filter     ?: null,
							'priority' => $priority_filter ?: null,
							's'        => $search          ?: null,
						] );
						for ( $p = 1; $p <= $page_count; $p++ ) :
							$page_url = add_query_arg( array_merge( $q_args, [ 'paged' => $p ] ), admin_url( 'admin.php' ) );
							?>
							<a href="<?php echo esc_url( $page_url ); ?>"
								class="dtb-page-btn <?php echo $p === $current_page ? 'dtb-page-btn--active' : ''; ?>">
								<?php echo esc_html( $p ); ?>
							</a>
						<?php endfor; ?>
					</div>
				<?php endif; ?>
			</div>
		<?php endif; ?>

	</div><!-- .dtb-card -->

	<?php if ( $poll_interval >= 30 ) : ?>
	<script>
	(function(){
		var iv = <?php echo absint( $poll_interval ); ?> * 1000;
		setInterval(async function(){
			var d = await dtbSupport.request('/support/kpis');
			if (!d) return;
			var strip = document.getElementById('dtb-kpi-strip');
			if (strip) strip.innerHTML = dtbBuildKpiStrip(d);
		}, iv);

		function dtbBuildKpiStrip(k){
			var cards = [
				{l:'Total',           v: k.total          || 0, w: false},
				{l:'Open',            v: k.open           || 0, w: (k.open||0) > 0},
				{l:'Pending Staff',   v: k.pending_staff  || 0, w: (k.pending_staff||0) > 0},
				{l:'In Progress',     v: k.in_progress    || 0, w: false},
				{l:'Urgent',          v: k.urgent         || 0, w: (k.urgent||0) > 0},
				{l:'Overdue',         v: k.overdue_count  || 0, w: (k.overdue_count||0) > 0},
				{l:'Due Soon',        v: k.due_soon_count || 0, w: (k.due_soon_count||0) > 0},
				{l:'Needs Reply',     v: k.needs_reply    || 0, w: (k.needs_reply||0) > 0},
				{l:'Email Issues',    v: k.email_failures || 0, w: (k.email_failures||0) > 0},
			];
			return cards.map(function(c){
				var cls = 'dtb-kpi-card' + (c.w && c.v > 0 ? ' dtb-kpi-card--warn' : '');
				return '<div class="' + cls + '"><div class="dtb-kpi-val">' + c.v
					+ '</div><div class="dtb-kpi-lbl">' + c.l + '</div></div>';
			}).join('');
		}
	}());
	</script>
	<?php endif; ?>

</div><!-- .dtb-wrap -->
	<?php
}

// ---------------------------------------------------------------------------
// KPI strip helper (shared by PHP render + JS rebuild poll)
// ---------------------------------------------------------------------------

function dtb_support_render_kpi_strip( array $kpis ): void {
	$cards = [
		[ 'label' => 'Total',          'value' => $kpis['total']          ?? 0, 'warn' => false ],
		[ 'label' => 'Open',           'value' => $kpis['open']           ?? 0, 'warn' => ( $kpis['open'] ?? 0 ) > 0 ],
		[ 'label' => 'Pending Staff',  'value' => $kpis['pending_staff']  ?? 0, 'warn' => ( $kpis['pending_staff'] ?? 0 ) > 0 ],
		[ 'label' => 'In Progress',    'value' => $kpis['in_progress']    ?? 0, 'warn' => false ],
		[ 'label' => 'Urgent',         'value' => $kpis['urgent']         ?? 0, 'warn' => ( $kpis['urgent'] ?? 0 ) > 0 ],
		[ 'label' => 'Overdue',        'value' => $kpis['overdue_count']  ?? 0, 'warn' => ( $kpis['overdue_count'] ?? 0 ) > 0 ],
		[ 'label' => 'Due Soon',       'value' => $kpis['due_soon_count'] ?? 0, 'warn' => ( $kpis['due_soon_count'] ?? 0 ) > 0 ],
		[ 'label' => 'Needs Reply',    'value' => $kpis['needs_reply']    ?? 0, 'warn' => ( $kpis['needs_reply'] ?? 0 ) > 0 ],
		[ 'label' => 'Email Issues',   'value' => $kpis['email_failures'] ?? 0, 'warn' => ( $kpis['email_failures'] ?? 0 ) > 0 ],
		[
			'label' => 'Avg Response',
			'value' => isset( $kpis['avg_first_response_h'] )
				? number_format_i18n( $kpis['avg_first_response_h'], 1 ) . 'h'
				: '&mdash;',
			'warn' => false,
		],
		[ 'label' => 'Resolved Today', 'value' => $kpis['today_resolved'] ?? ( $kpis['resolved_today'] ?? 0 ), 'warn' => false ],
	];

	foreach ( $cards as $card ) {
		$cls = 'dtb-kpi-card';
		if ( $card['warn'] && $card['value'] > 0 ) {
			$cls .= ' dtb-kpi-card--warn';
		}
		printf(
			'<div class="%s"><div class="dtb-kpi-val">%s</div><div class="dtb-kpi-lbl">%s</div></div>',
			esc_attr( $cls ),
			esc_html( (string) $card['value'] ),
			esc_html( $card['label'] )
		);
	}
}
