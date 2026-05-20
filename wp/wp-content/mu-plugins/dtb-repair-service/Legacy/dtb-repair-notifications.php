<?php
/**
 * DTB Repair Notifications — Must-Use Plugin
 *
 * Inline email templates and dispatch logic for all repair workflow notifications.
 * All templates are defined as PHP string functions — no external template files
 * are required.
 *
 * Provides:
 *   dtb_repair_send_email()              — Low-level send via wp_mail()
 *   dtb_repair_dispatch_notification()  — High-level: build context + send + log events
 *   dtb_repair_get_email_template()     — Render a template by slug
 *
 * Hooks:
 *   dtb_repair_status_changed           — Auto-dispatch notifications on transitions
 *
 * Depends on (loaded before this):
 *   dtb-repair-events.php  → dtb_repair_append_event()
 *
 * @package drywall-toolbox
 */

defined( 'ABSPATH' ) || exit;

// =============================================================================
// SECTION 1 — CONFIGURATION
// =============================================================================

/**
 * Return the from-name for repair notification emails.
 *
 * @return string
 */
function dtb_repair_email_from_name(): string {
	return (string) apply_filters( 'dtb_repair_email_from_name', get_bloginfo( 'name' ) );
}

/**
 * Return the from-address for repair notification emails.
 *
 * @return string
 */
function dtb_repair_email_from_address(): string {
	$default = 'repairs@' . wp_parse_url( home_url(), PHP_URL_HOST );
	return (string) apply_filters( 'dtb_repair_email_from_address', $default );
}

/**
 * Return the admin recipient address for repair notification emails.
 *
 * @return string
 */
function dtb_repair_admin_email(): string {
	return (string) apply_filters( 'dtb_repair_admin_email', get_option( 'admin_email', '' ) );
}

/**
 * Return the base URL for the customer-facing repair tracking page.
 *
 * The React SPA handles routing at /repairs/status/{repair_id}?token={token}.
 *
 * @return string
 */
function dtb_repair_tracking_base_url(): string {
	return (string) apply_filters( 'dtb_repair_tracking_base_url', home_url( '/repairs/status/' ) );
}

// =============================================================================
// SECTION 2 — TEMPLATE DEFINITIONS
// =============================================================================

/**
 * Render an email template by slug and return [subject, body] or WP_Error.
 *
 * All templates receive a $ctx array (merged from repair meta + caller overrides).
 * Context keys used across templates:
 *   repair_id, customer_name, brand, model, serial, service_tier, issue,
 *   tracking_url, public_token, site_name, admin_url.
 *
 * @param string $template  Template slug (e.g. 'repair-submitted-customer').
 * @param array  $ctx       Template context variables.
 * @return array{subject: string, body: string}|WP_Error
 */
function dtb_repair_get_email_template( string $template, array $ctx ): array|WP_Error {
	$site   = esc_html( $ctx['site_name'] ?? get_bloginfo( 'name' ) );
	$name   = esc_html( $ctx['customer_name'] ?? 'Customer' );
	$rid    = (int) ( $ctx['repair_id'] ?? 0 );
	$brand  = esc_html( $ctx['brand'] ?? '' );
	$model  = esc_html( $ctx['model'] ?? '' );
	$serial = esc_html( $ctx['serial'] ?? '' );
	$tier   = esc_html( ucfirst( $ctx['service_tier'] ?? 'standard' ) );
	$issue  = esc_html( wp_strip_all_tags( $ctx['issue'] ?? '' ) );
	$turl   = esc_url( $ctx['tracking_url'] ?? '' );
	$aurl   = esc_url( $ctx['admin_url'] ?? '' );

	switch ( $template ) {

		// ---- Customer: submission confirmation -----------------------------------
		case 'repair-submitted-customer':
			return [
				'subject' => sprintf( __( '[%1$s] Your repair request #%2$d has been received', 'drywall-toolbox' ), $site, $rid ),
				'body'    => sprintf(
					__( "Hi %1\$s,\n\nThank you for submitting your repair request. Here are your details:\n\nRepair ID: #%2\$d\nTool: %3\$s %4\$s\nSerial: %5\$s\nService Tier: %6\$s\n\nIssue Description:\n%7\$s\n\nTrack your repair status at any time:\n%8\$s\n\nWe'll be in touch soon.\n\n— %9\$s Team", 'drywall-toolbox' ),
					$name, $rid, $brand, $model, $serial ?: __( 'N/A', 'drywall-toolbox' ), $tier, $issue, $turl, $site
				),
			];

		// ---- Admin: new submission alert -----------------------------------------
		case 'repair-submitted-admin':
			return [
				'subject' => sprintf( __( '[%1$s] New repair request #%2$d — %3$s %4$s (%5$s)', 'drywall-toolbox' ), $site, $rid, $brand, $model, $name ),
				'body'    => sprintf(
					__( "A new repair request has been submitted.\n\nRepair ID: #%1\$d\nCustomer: %2\$s\nEmail: %3\$s\nPhone: %4\$s\nTool: %5\$s %6\$s (Serial: %7\$s)\nService Tier: %8\$s\n\nIssue:\n%9\$s\n\nReview in WP-Admin:\n%10\$s", 'drywall-toolbox' ),
					$rid,
					$name,
					esc_html( $ctx['customer_email'] ?? '' ),
					esc_html( $ctx['customer_phone'] ?? '' ),
					$brand, $model, $serial ?: __( 'N/A', 'drywall-toolbox' ),
					$tier, $issue, $aurl
				),
			];

		// ---- Customer: information requested ------------------------------------
		case 'repair-info-requested':
			return [
				'subject' => sprintf( __( '[%1$s] We need more information for your repair #%2$d', 'drywall-toolbox' ), $site, $rid ),
				'body'    => sprintf(
					__( "Hi %1\$s,\n\nOur technicians have reviewed your repair request (#%2\$d) and require some additional information before we can proceed.\n\nPlease reply to this email or visit your repair page:\n%3\$s\n\nThank you,\n— %4\$s Team", 'drywall-toolbox' ),
					$name, $rid, $turl, $site
				),
			];

		// ---- Customer: repair reviewed ------------------------------------------
		case 'repair-reviewed':
			return [
				'subject' => sprintf( __( '[%1$s] Your repair #%2$d is under review', 'drywall-toolbox' ), $site, $rid ),
				'body'    => sprintf(
					__( "Hi %1\$s,\n\nGood news! Our team has reviewed your repair request (#%2\$d — %3\$s %4\$s) and it is now under review.\n\nWe'll notify you once a decision has been made.\n\nTrack status: %5\$s\n\n— %6\$s Team", 'drywall-toolbox' ),
					$name, $rid, $brand, $model, $turl, $site
				),
			];

		// ---- Customer: repair approved ------------------------------------------
		case 'repair-approved':
			return [
				'subject' => sprintf( __( '[%1$s] Repair #%2$d has been approved', 'drywall-toolbox' ), $site, $rid ),
				'body'    => sprintf(
					__( "Hi %1\$s,\n\nWe're pleased to let you know that your repair (#%2\$d — %3\$s %4\$s) has been approved.\n\nWe will begin sourcing the necessary parts and proceed with your %5\$s service.\n\nTrack status: %6\$s\n\n— %7\$s Team", 'drywall-toolbox' ),
					$name, $rid, $brand, $model, $tier, $turl, $site
				),
			];

		// ---- Customer: quote sent -----------------------------------------------
		case 'repair-quote-created':
			return [
				'subject' => sprintf( __( '[%1$s] Your repair quote is ready — #%2$d', 'drywall-toolbox' ), $site, $rid ),
				'body'    => sprintf(
					__( "Hi %1\$s,\n\nWe have prepared a quote for your repair (#%2\$d — %3\$s %4\$s).\n\nPlease log in to review and accept or decline your quote:\n%5\$s\n\nThis quote will expire in 14 days. If you have any questions, please reply to this email.\n\n— %6\$s Team", 'drywall-toolbox' ),
					$name, $rid, $brand, $model, $turl, $site
				),
			];

		// ---- Customer: quote accepted -------------------------------------------
		case 'repair-quote-accepted':
			return [
				'subject' => sprintf( __( '[%1$s] Quote accepted — repair #%2$d will proceed', 'drywall-toolbox' ), $site, $rid ),
				'body'    => sprintf(
					__( "Hi %1\$s,\n\nThank you for accepting the quote for repair #%2\$d (%3\$s %4\$s).\n\nWe will now begin ordering the required parts. We'll keep you updated.\n\nTrack status: %5\$s\n\n— %6\$s Team", 'drywall-toolbox' ),
					$name, $rid, $brand, $model, $turl, $site
				),
			];

		// ---- Customer: repair in progress ---------------------------------------
		case 'repair-in-progress':
			return [
				'subject' => sprintf( __( '[%1$s] Work has started on your repair #%2$d', 'drywall-toolbox' ), $site, $rid ),
				'body'    => sprintf(
					__( "Hi %1\$s,\n\nGreat news — our technicians have started work on your repair (#%2\$d — %3\$s %4\$s).\n\nWe'll notify you when it's complete and ready to ship.\n\nTrack status: %5\$s\n\n— %6\$s Team", 'drywall-toolbox' ),
					$name, $rid, $brand, $model, $turl, $site
				),
			];

		// ---- Customer: ready to ship --------------------------------------------
		case 'repair-ready-to-ship':
			$tracking_note = ! empty( $ctx['tracking_number'] )
				? sprintf( __( "\nTracking Number: %s\n", 'drywall-toolbox' ), esc_html( $ctx['tracking_number'] ) )
				: '';

			return [
				'subject' => sprintf( __( '[%1$s] Your repair #%2$d is ready to ship!', 'drywall-toolbox' ), $site, $rid ),
				'body'    => sprintf(
					__( "Hi %1\$s,\n\nYour repaired %2\$s %3\$s (#%4\$d) is packed and ready to ship!%5\$s\nTrack status: %6\$s\n\n— %7\$s Team", 'drywall-toolbox' ),
					$name, $brand, $model, $rid, $tracking_note, $turl, $site
				),
			];

		// ---- Customer: repair completed -----------------------------------------
		case 'repair-completed':
			return [
				'subject' => sprintf( __( '[%1$s] Your repair #%2$d is complete — earn loyalty rewards!', 'drywall-toolbox' ), $site, $rid ),
				'body'    => sprintf(
					__( "Hi %1\$s,\n\nYour repair (#%2\$d — %3\$s %4\$s) has been completed and shipped.\n\nAs a thank-you, loyalty reward points have been credited to your account.\n\nTrack status and view your points balance:\n%5\$s\n\nThank you for choosing %6\$s!\n\n— %6\$s Team", 'drywall-toolbox' ),
					$name, $rid, $brand, $model, $turl, $site
				),
			];

		// ---- Customer: repair cancelled -----------------------------------------
		case 'repair-cancelled':
			return [
				'subject' => sprintf( __( '[%1$s] Repair request #%2$d has been cancelled', 'drywall-toolbox' ), $site, $rid ),
				'body'    => sprintf(
					__( "Hi %1\$s,\n\nThis is to let you know that repair request #%2\$d (%3\$s %4\$s) has been cancelled.\n\nIf you believe this was in error or have questions, please contact us.\n\n— %5\$s Team", 'drywall-toolbox' ),
					$name, $rid, $brand, $model, $site
				),
			];

		default:
			return new WP_Error(
				'dtb_repair_template_not_found',
				/* translators: %s: template slug */
				sprintf( __( 'Email template "%s" not found.', 'drywall-toolbox' ), esc_html( $template ) )
			);
	}
}

// =============================================================================
// SECTION 3 — LOW-LEVEL EMAIL SEND
// =============================================================================

/**
 * Send a repair notification email via wp_mail().
 *
 * @param string $to        Recipient email address.
 * @param string $template  Template slug.
 * @param array  $context   Template context variables.
 * @return bool  true if wp_mail() accepted the message.
 */
function dtb_repair_send_email( string $to, string $template, array $context ): bool {
	if ( '' === $to || ! is_email( $to ) ) {
		error_log( "[DTB Repairs] dtb_repair_send_email: invalid 'to' address '{$to}' for template '{$template}'." );
		return false;
	}

	$rendered = dtb_repair_get_email_template( $template, $context );

	if ( is_wp_error( $rendered ) ) {
		error_log( '[DTB Repairs] ' . $rendered->get_error_message() );
		return false;
	}

	$from    = dtb_repair_email_from_name() . ' <' . dtb_repair_email_from_address() . '>';
	$headers = [
		'Content-Type: text/plain; charset=UTF-8',
		'From: ' . $from,
	];

	return (bool) wp_mail( $to, $rendered['subject'], $rendered['body'], $headers );
}

// =============================================================================
// SECTION 4 — HIGH-LEVEL DISPATCH
// =============================================================================

/**
 * Build context from repair meta and dispatch a notification email.
 *
 * Logs notification.email.queued, and either notification.email.sent or
 * notification.email.failed to the event table.
 *
 * @param int    $repair_id      Post ID of the repair.
 * @param string $template       Template slug.
 * @param array  $extra_context  Additional context values to merge over defaults.
 */
function dtb_repair_dispatch_notification( int $repair_id, string $template, array $extra_context = [] ): void {
	if ( '' === $template ) {
		return;
	}

	$post = get_post( $repair_id );
	if ( ! $post || 'dtb_repair_request' !== $post->post_type ) {
		return;
	}

	// Build base context from repair meta.
	$repair_id_val  = $repair_id;
	$customer_email = sanitize_email( (string) get_post_meta( $repair_id, '_repair_customer_email', true ) );
	$customer_name  = sanitize_text_field( (string) get_post_meta( $repair_id, '_repair_customer_name', true ) );
	$customer_phone = sanitize_text_field( (string) get_post_meta( $repair_id, '_repair_customer_phone', true ) );
	$brand          = sanitize_text_field( (string) get_post_meta( $repair_id, '_repair_tool_brand', true ) );
	$model          = sanitize_text_field( (string) get_post_meta( $repair_id, '_repair_model', true ) );
	$serial         = sanitize_text_field( (string) get_post_meta( $repair_id, '_repair_serial', true ) );
	$service_tier   = sanitize_text_field( (string) get_post_meta( $repair_id, '_repair_service_tier', true ) );
	$issue          = wp_kses_post( (string) get_post_meta( $repair_id, '_repair_issue', true ) );
	$public_token   = sanitize_text_field( (string) get_post_meta( $repair_id, '_repair_public_token', true ) );
	$tracking_num   = sanitize_text_field( (string) get_post_meta( $repair_id, '_repair_veeqo_tracking', true ) );

	$tracking_url = add_query_arg(
		[ 'token' => $public_token ],
		rtrim( dtb_repair_tracking_base_url(), '/' ) . '/' . $repair_id
	);
	$admin_url    = admin_url( 'post.php?post=' . $repair_id . '&action=edit' );

	$context = array_merge(
		[
			'repair_id'       => $repair_id_val,
			'customer_name'   => $customer_name,
			'customer_email'  => $customer_email,
			'customer_phone'  => $customer_phone,
			'brand'           => $brand,
			'model'           => $model,
			'serial'          => $serial,
			'service_tier'    => $service_tier,
			'issue'           => $issue,
			'public_token'    => $public_token,
			'tracking_url'    => $tracking_url,
			'tracking_number' => $tracking_num,
			'admin_url'       => $admin_url,
			'site_name'       => get_bloginfo( 'name' ),
		],
		$extra_context
	);

	// Determine recipient: admin templates go to the admin address.
	$admin_templates = [ 'repair-submitted-admin' ];
	if ( in_array( $template, $admin_templates, true ) ) {
		$to = dtb_repair_admin_email();
	} else {
		$to = $customer_email;
	}

	if ( '' === $to ) {
		error_log( "[DTB Repairs] dispatch_notification: no recipient for template '{$template}', repair #{$repair_id}." );
		return;
	}

	// Log queued event.
	if ( function_exists( 'dtb_repair_append_event' ) ) {
		dtb_repair_append_event( $repair_id, 'notification.email.queued', [
			'visibility' => 'operator',
			'payload'    => [ 'template' => $template, 'to' => $to ],
		] );
	}

	$sent = dtb_repair_send_email( $to, $template, $context );

	// Log sent/failed event.
	if ( function_exists( 'dtb_repair_append_event' ) ) {
		$event_type = $sent ? 'notification.email.sent' : 'notification.email.failed';
		dtb_repair_append_event( $repair_id, $event_type, [
			'visibility' => 'operator',
			'payload'    => [ 'template' => $template, 'to' => $to ],
		] );
	}
}

// =============================================================================
// SECTION 5 — AUTO-DISPATCH ON STATUS TRANSITION
// =============================================================================

add_action( 'dtb_repair_status_changed', 'dtb_repair_notifications_on_status_changed', 10, 4 );

/**
 * Dispatch the appropriate notification when a repair status changes.
 *
 * The queue file (dtb-repair-queue.php) already schedules this via Action
 * Scheduler through dtb_repair_send_notification jobs.  This hook is a direct
 * fallback for cases where Action Scheduler is unavailable.
 *
 * @param int    $repair_id
 * @param string $from_status
 * @param string $to_status
 * @param array  $context
 */
function dtb_repair_notifications_on_status_changed( int $repair_id, string $from_status, string $to_status, array $context ): void {
	// When Action Scheduler is available, notifications are handled via queued jobs.
	// Only dispatch directly here as a fallback.
	if ( function_exists( 'as_schedule_single_action' ) ) {
		return;
	}

	$template_map = [
		'awaiting_customer' => 'repair-info-requested',
		'reviewed'          => 'repair-reviewed',
		'approved'          => 'repair-approved',
		'quoted'            => 'repair-quote-created',
		'quote_accepted'    => 'repair-quote-accepted',
		'in_progress'       => 'repair-in-progress',
		'ready_to_ship'     => 'repair-ready-to-ship',
		'completed'         => 'repair-completed',
		'cancelled'         => 'repair-cancelled',
	];

	if ( ! isset( $template_map[ $to_status ] ) ) {
		return;
	}

	dtb_repair_dispatch_notification( $repair_id, $template_map[ $to_status ] );
}
