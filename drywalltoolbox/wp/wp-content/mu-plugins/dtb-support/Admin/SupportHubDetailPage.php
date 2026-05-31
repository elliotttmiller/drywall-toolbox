<?php
/**
 * Admin — SupportHubDetailPage
 *
 * Full single-ticket view: thread, reply composer, sidebar with status /
 * priority / assignment controls and customer/metadata info.
 *
 * Called from SupportHubDashboard when ?ticket_id is present.
 *
 * @package drywall-toolbox
 */

defined( 'ABSPATH' ) || exit;

function dtb_support_render_ticket_detail_page( int $ticket_id ): void {
	if ( ! current_user_can( 'dtb_manage_support' ) && ! current_user_can( 'manage_options' ) ) {
		wp_die( 'You do not have permission to view this page.' );
	}

	// ── Data ──────────────────────────────────────────────────────────────────
	$ticket_raw = dtb_support_get_ticket( $ticket_id );

	if ( ! $ticket_raw ) {
		echo '<div class="dtb-wrap"><div class="dtb-card" style="padding:2rem;">Ticket not found.</div></div>';
		return;
	}

	$ticket     = (array) $ticket_raw;
	$projected  = dtb_support_project_ticket( $ticket_raw );
	$events_raw = dtb_support_get_events( $ticket_id, 'operator' );
	$events     = is_array( $events_raw ) ? array_map( 'get_object_vars', $events_raw ) : [];

	$transitions = dtb_support_allowed_transitions()[ $ticket['status'] ] ?? [];
	$statuses    = dtb_support_all_statuses();
	$priorities  = dtb_support_all_priorities();
	$agents      = dtb_support_get_agents();

	$base_url    = admin_url( 'admin.php?page=dtb-support' );
	$current_uid = get_current_user_id();
	?>
<div class="dtb-wrap">

	<!-- ── Back + Detail topbar ─────────────────────────────────────────────── -->
	<div class="dtb-back-bar">
		<a href="<?php echo esc_url( $base_url ); ?>" class="dtb-back">
			<svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2" viewBox="0 0 24 24">
				<polyline points="15 18 9 12 15 6"/>
			</svg>
			All Tickets
		</a>
	</div>

	<div class="dtb-detail-topbar">
		<div class="dtb-detail-topbar__left">
			<h2 class="dtb-detail-title">
				<?php echo esc_html( $projected['subject'] ); ?>
			</h2>
			<div class="dtb-detail-meta">
				<span class="dtb-tid"><?php echo esc_html( $projected['ticket_number'] ); ?></span>
				<span class="dtb-status">
					<span class="dtb-status__dot dtb-status__dot--<?php echo esc_attr( $ticket['status'] ); ?>"></span>
					<?php echo esc_html( $projected['status_label'] ?? $ticket['status'] ); ?>
				</span>
				<span class="dtb-pri dtb-pri--<?php echo esc_attr( $ticket['priority'] ); ?>">
					<?php echo esc_html( $projected['priority_label'] ?? $ticket['priority'] ); ?>
				</span>
				<span class="dtb-type">
					<?php echo esc_html( $projected['type_label'] ?? $ticket['ticket_type'] ); ?>
				</span>
			</div>
		</div>
	</div>

	<!-- ── Detail grid: thread + sidebar ────────────────────────────────────── -->
	<div class="dtb-detail-grid">

		<!-- Left: Thread + composer -->
		<div>
			<div class="dtb-thread-card">
				<div class="dtb-thread">
					<?php if ( empty( $events ) ) : ?>
						<p style="color:var(--dtb-muted);font-size:.85rem;padding:1rem 0;">No activity yet.</p>
					<?php else : ?>
						<?php foreach ( $events as $ev ) :
							$actor   = $ev['actor_label'] ?? ( $ev['actor_name'] ?? 'System' );
							$initials = strtoupper( mb_substr( $actor, 0, 1 ) );
							$age     = $ev['age_label'] ?? '';
							$type    = $ev['event_type'] ?? 'note';
							$is_reply = in_array( $type, [ 'reply', 'customer_reply' ], true );
							$cls     = 'dtb-event dtb-event--' . esc_attr( $type );
							if ( $is_reply ) $cls .= ' dtb-event--reply';
							?>
							<div class="<?php echo esc_attr( $cls ); ?>">
								<div class="dtb-event__avatar"><?php echo esc_html( $initials ); ?></div>
								<div class="dtb-event__body">
									<div class="dtb-event__header">
										<span class="dtb-event__actor"><?php echo esc_html( $actor ); ?></span>
										<span class="dtb-event__time"><?php echo esc_html( $age ); ?></span>
										<span class="dtb-event__type"><?php echo esc_html( $type ); ?></span>
									</div>
									<div class="dtb-event__content">
										<?php echo nl2br( esc_html( $ev['body'] ?? $ev['content'] ?? '' ) ); ?>
									</div>
								</div>
							</div>
						<?php endforeach; ?>
					<?php endif; ?>
				</div><!-- .dtb-thread -->

				<!-- Reply composer -->
				<form id="dtb-reply-form"
					class="dtb-compose"
					data-ticket-id="<?php echo absint( $ticket_id ); ?>">
					<div class="dtb-compose__header">Reply to Customer</div>
					<textarea
						name="message"
						class="dtb-compose__body"
						rows="5"
						placeholder="Type your reply..."
						required></textarea>
					<div class="dtb-compose__footer">
						<button type="submit" class="dtb-btn dtb-btn--primary dtb-reply-submit">
							Send Reply
						</button>
						<label class="dtb-compose__internal">
							<input type="checkbox" name="is_internal" value="1">
							Internal note
						</label>
					</div>
				</form>
			</div><!-- .dtb-thread-card -->
		</div>

		<!-- Right: Sidebar -->
		<aside class="dtb-sidebar">

			<!-- Status -->
			<div class="dtb-sidebar-card">
				<div class="dtb-sidebar-card__title">Status</div>
				<div class="dtb-sidebar-card__body">
					<span class="dtb-status">
						<span class="dtb-status__dot dtb-status__dot--<?php echo esc_attr( $ticket['status'] ); ?>"></span>
						<?php echo esc_html( $projected['status_label'] ?? $ticket['status'] ); ?>
					</span>
					<?php if ( ! empty( $transitions ) ) : ?>
						<div style="margin-top:.75rem;display:flex;gap:.5rem;flex-wrap:wrap;align-items:center;">
							<select id="dtb-status-select" class="dtb-select">
								<?php foreach ( $transitions as $slug ) : ?>
									<option value="<?php echo esc_attr( $slug ); ?>">
										<?php echo esc_html( $statuses[ $slug ] ?? $slug ); ?>
									</option>
								<?php endforeach; ?>
							</select>
							<button class="dtb-btn dtb-btn--sm dtb-btn--ghost"
								onclick="dtbSupport.transitionTicket(<?php echo absint( $ticket_id ); ?>, document.getElementById('dtb-status-select').value, this)">
								Apply
							</button>
						</div>
					<?php else : ?>
						<p style="font-size:.8rem;color:var(--dtb-muted);margin-top:.5rem;">No transitions available.</p>
					<?php endif; ?>
				</div>
			</div>

			<!-- Priority -->
			<div class="dtb-sidebar-card">
				<div class="dtb-sidebar-card__title">Priority</div>
				<div class="dtb-sidebar-card__body">
					<div style="display:flex;gap:.5rem;align-items:center;flex-wrap:wrap;">
						<select id="dtb-priority-select" class="dtb-select">
							<?php foreach ( $priorities as $slug => $label ) : ?>
								<option value="<?php echo esc_attr( $slug ); ?>" <?php selected( $ticket['priority'], $slug ); ?>>
									<?php echo esc_html( $label ); ?>
								</option>
							<?php endforeach; ?>
						</select>
						<button class="dtb-btn dtb-btn--sm dtb-btn--ghost"
							onclick="dtbSupport.request(
								'/support/tickets/<?php echo absint( $ticket_id ); ?>',
								'PATCH',
								{ priority: document.getElementById('dtb-priority-select').value }
							).then(function(){ location.reload(); })">
							Apply
						</button>
					</div>
				</div>
			</div>

			<!-- Assignment -->
			<div class="dtb-sidebar-card">
				<div class="dtb-sidebar-card__title">Assigned To</div>
				<div class="dtb-sidebar-card__body">
					<div style="display:flex;gap:.5rem;align-items:center;flex-wrap:wrap;">
						<select id="dtb-assign-select" class="dtb-select">
							<option value="">Unassigned</option>
							<?php foreach ( $agents as $agent_id ) :
								$u = get_userdata( $agent_id );
								if ( ! $u ) continue;
								?>
								<option value="<?php echo absint( $agent_id ); ?>"
									<?php selected( (int) ( $ticket['assigned_user_id'] ?? 0 ), $agent_id ); ?>>
									<?php echo esc_html( $u->display_name ); ?>
								</option>
							<?php endforeach; ?>
						</select>
						<button class="dtb-btn dtb-btn--sm dtb-btn--ghost"
							onclick="dtbSupport.assignTicket(<?php echo absint( $ticket_id ); ?>, document.getElementById('dtb-assign-select').value)">
							Assign
						</button>
					</div>
				</div>
			</div>

			<!-- Customer info -->
			<div class="dtb-sidebar-card">
				<div class="dtb-sidebar-card__title">Customer</div>
				<div class="dtb-sidebar-card__body">
					<p class="dtb-sidebar-card__row">
						<strong>Name:</strong>
						<?php echo esc_html( $ticket['customer_name'] ?? '—' ); ?>
					</p>
					<p class="dtb-sidebar-card__row">
						<strong>Email:</strong>
						<a href="mailto:<?php echo esc_attr( $ticket['customer_email'] ?? '' ); ?>">
							<?php echo esc_html( $ticket['customer_email'] ?? '—' ); ?>
						</a>
					</p>
					<?php if ( ! empty( $ticket['order_id'] ) ) : ?>
						<p class="dtb-sidebar-card__row">
							<strong>Order:</strong>
							<a href="<?php echo esc_url( admin_url( 'post.php?post=' . absint( $ticket['order_id'] ) . '&action=edit' ) ); ?>">
								#<?php echo absint( $ticket['order_id'] ); ?>
							</a>
						</p>
					<?php endif; ?>
				</div>
			</div>

			<!-- Ticket metadata -->
			<div class="dtb-sidebar-card">
				<div class="dtb-sidebar-card__title">Details</div>
				<div class="dtb-sidebar-card__body">
					<p class="dtb-sidebar-card__row">
						<strong>Source:</strong>
						<?php echo esc_html( $ticket['source'] ?? '—' ); ?>
					</p>
					<p class="dtb-sidebar-card__row">
						<strong>Age:</strong>
						<?php echo esc_html( $projected['age_label'] ?? '—' ); ?>
					</p>
					<?php if ( ! empty( $projected['action_state'] ) ) : ?>
						<p class="dtb-sidebar-card__row">
							<strong>Action Due:</strong>
							<span class="dtb-action-state dtb-action-state--<?php echo esc_attr( $projected['action_state'] ); ?>">
								<?php echo esc_html( $projected['action_state_label'] ?? $projected['action_state'] ); ?>
							</span>
						</p>
					<?php endif; ?>
					<p class="dtb-sidebar-card__row">
						<strong>Created:</strong>
						<?php echo esc_html( dtb_support_format_date( $ticket['created_at'] ?? '' ) ); ?>
					</p>
					<p class="dtb-sidebar-card__row">
						<strong>Updated:</strong>
						<?php echo esc_html( dtb_support_format_date( $ticket['updated_at'] ?? '' ) ); ?>
					</p>
				</div>
			</div>

		</aside>
	</div><!-- .dtb-detail-grid -->

</div><!-- .dtb-wrap -->
	<?php
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Format a MySQL datetime string to a readable local date/time.
 */
function dtb_support_format_date( string $mysql_date ): string {
	if ( ! $mysql_date ) {
		return '—';
	}
	$ts = strtotime( $mysql_date );
	return $ts ? wp_date( get_option( 'date_format' ) . ' ' . get_option( 'time_format' ), $ts ) : $mysql_date;
}
