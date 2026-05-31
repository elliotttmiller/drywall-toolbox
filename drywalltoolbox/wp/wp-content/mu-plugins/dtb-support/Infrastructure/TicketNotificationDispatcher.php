<?php
/**
 * Infrastructure — TicketNotificationDispatcher: email templates and send logic.
 *
 * @package drywall-toolbox
 */

defined( 'ABSPATH' ) || exit;

// =============================================================================
// SECTION 1 — CONFIGURATION
// =============================================================================

/**
 * Return the from-name for support notification emails.
 *
 * Reads the saved Support Hub setting first, falls back to blog name.
 *
 * @return string
 */
function dtb_support_email_from_name(): string {
	$saved = (string) get_option( 'dtb_support_from_name', '' );
	$value = '' !== $saved ? $saved : get_bloginfo( 'name' );
	return (string) apply_filters( 'dtb_support_email_from_name', $value );
}

/**
 * Return the from-address for support notification emails.
 *
 * Reads the saved Support Hub setting first, falls back to site-derived address.
 *
 * @return string
 */
function dtb_support_email_from(): string {
	$saved = (string) get_option( 'dtb_support_from_email', '' );
	if ( '' !== $saved && is_email( $saved ) ) {
		return (string) apply_filters( 'dtb_support_email_from', $saved );
	}
	$host    = (string) wp_parse_url( home_url(), PHP_URL_HOST );
	$default = 'support@' . $host;
	return (string) apply_filters( 'dtb_support_email_from', $default );
}

/**
 * Return the admin/staff recipient address for notification emails.
 *
 * Reads the saved Support Hub setting first, falls back to WP admin_email.
 *
 * @return string
 */
function dtb_support_admin_email(): string {
	$saved = (string) get_option( 'dtb_support_admin_email', '' );
	$value = ( '' !== $saved && is_email( $saved ) ) ? $saved : (string) get_option( 'admin_email', '' );
	return (string) apply_filters( 'dtb_support_admin_email', $value );
}

// =============================================================================
// SECTION 1b — WP MAIL FROM HOOKS
// =============================================================================

/**
 * Override WordPress' default From address for all dtb-support emails.
 *
 * WP ignores From: headers unless these filters are set — this ensures our
 * configured address is actually used rather than wordpress@domain.
 */
add_filter( 'wp_mail_from',      'dtb_support_wp_mail_from'      );
add_filter( 'wp_mail_from_name', 'dtb_support_wp_mail_from_name' );

function dtb_support_wp_mail_from( string $original ): string {
	// Only override when we're inside a dtb-support send (guarded by flag).
	return defined( 'DTB_SUPPORT_SENDING' ) ? dtb_support_email_from() : $original;
}

function dtb_support_wp_mail_from_name( string $original ): string {
	return defined( 'DTB_SUPPORT_SENDING' ) ? dtb_support_email_from_name() : $original;
}

// =============================================================================
// SECTION 2 — EMAIL BUILDER
// =============================================================================

/**
 * Build email headers array.
 *
 * @return string[]
 */
function dtb_support_email_headers( string $content_type = 'text/plain' ): array {
	return [
		'Content-Type: ' . sanitize_text_field( $content_type ) . '; charset=UTF-8',
		'From: ' . dtb_support_email_from_name() . ' <' . dtb_support_email_from() . '>',
	];
}

/**
 * Render an email template and return [subject, body] or WP_Error.
 *
 * @param string $template  Slug: 'ticket-opened-customer' | 'ticket-opened-admin' | 'ticket-reply-customer' |
 *                           'ticket-reply-staff' | 'ticket-resolved-customer' | 'ticket-reopened-customer'
 * @param array  $ctx       Template variables.
 * @return array{subject:string,body:string}|WP_Error
 */
function dtb_support_get_email_template( string $template, array $ctx ): array|WP_Error {
	$site   = sanitize_text_field( (string) ( $ctx['site_name'] ?? get_bloginfo( 'name' ) ) );
	$name   = sanitize_text_field( (string) ( $ctx['customer_name'] ?? 'Customer' ) );
	$tnum   = sanitize_text_field( (string) ( $ctx['ticket_number'] ?? '' ) );
	$subj   = sanitize_text_field( (string) ( $ctx['subject'] ?? 'Your enquiry' ) );
	$aurl   = esc_url_raw( (string) ( $ctx['admin_url'] ?? admin_url( 'admin.php?page=dtb-support' ) ) );

	switch ( $template ) {

		case 'ticket-opened-customer':
			$body = sprintf(
				"Hi %1\$s,\n\nThank you for reaching out to us. We've received your message and a member of our team will be in touch shortly.\n\nTicket Reference: %2\$s\nSubject: %3\$s\n\nYou can reply directly to this email to add more information.\n\nThanks,\n%4\$s Support Team",
				$name, $tnum, $subj, $site
			);
			return [
				'subject' => sprintf( '[%1$s] We received your message — Ticket %2$s', $site, $tnum ),
				'body'    => $body,
				'html'    => dtb_render_branded_email(
					[
						'title'       => 'We received your message',
						'preheader'   => sprintf( 'Ticket %s has been opened with Drywall Toolbox support.', $tnum ),
						'eyebrow'     => 'Support request received',
						'greeting'    => sprintf( 'Hi %s,', $name ),
						'intro'       => 'Thanks for reaching out. Your message is in our support queue and a team member will follow up shortly.',
						'details'     => [
							[ 'label' => 'Ticket reference', 'value' => $tnum ],
							[ 'label' => 'Subject', 'value' => $subj ],
						],
						'signoff'     => $site . ' Support Team',
						'footer_note' => 'You can reply directly to this email to add more information to your ticket.',
					]
				),
			];

		case 'ticket-opened-admin':
			return [
				'subject' => sprintf( '[%1$s] New support ticket %2$s — %3$s', $site, $tnum, $name ),
				'body'    => sprintf(
					"A new support ticket has been submitted.\n\nTicket: %1\$s\nCustomer: %2\$s\nEmail: %3\$s\nType: %4\$s\nPriority: %5\$s\nSubject: %6\$s\n\nMessage:\n%7\$s\n\nManage in WP-Admin:\n%8\$s",
					$tnum,
					$name,
					esc_html( $ctx['customer_email'] ?? '' ),
					esc_html( $ctx['ticket_type']    ?? 'contact' ),
					esc_html( $ctx['priority']       ?? 'normal' ),
					$subj,
					esc_html( wp_strip_all_tags( $ctx['message'] ?? '' ) ),
					$aurl
				),
			];

		case 'ticket-reply-customer':
			$reply_body  = wp_strip_all_tags( (string) ( $ctx['reply_body'] ?? '' ) );
			$reply_link  = esc_url_raw( (string) ( $ctx['reply_link'] ?? '' ) );
			$reply_cta   = $reply_link ? "\n\nReply to this ticket:\n" . $reply_link : "\n\nReply directly to this email to continue the conversation.";
			$body        = sprintf(
				"Hi %1\$s,\n\nA member of our support team has replied to your ticket (%2\$s).\n\n---\n%3\$s\n---\n%4\$s\n\n%5\$s Support Team",
				$name,
				$tnum,
				$reply_body,
				$reply_cta,
				$site
			);
			return [
				'subject' => sprintf( 'Re: [%1$s] %2$s (Ticket %3$s)', $site, $subj, $tnum ),
				'body'    => $body,
				'html'    => dtb_render_branded_email(
					[
						'title'       => 'You have a new support reply',
						'preheader'   => sprintf( 'A Drywall Toolbox team member replied to ticket %s.', $tnum ),
						'eyebrow'     => 'Support update',
						'greeting'    => sprintf( 'Hi %s,', $name ),
						'intro'       => sprintf( 'A member of our support team replied to your ticket %s.', esc_html( $tnum ) ),
						'details'     => [
							[ 'label' => 'Ticket reference', 'value' => $tnum ],
							[ 'label' => 'Subject', 'value' => $subj ],
						],
						'body_html'   => '<div style="padding:18px 20px;background:#050b18;border:1px solid #334155;border-radius:8px;color:#cbd5e1;">' . nl2br( esc_html( $reply_body ) ) . '</div>',
						'cta'         => $reply_link ? [ 'label' => 'Reply to this ticket', 'url' => $reply_link ] : null,
						'signoff'     => $site . ' Support Team',
						'footer_note' => 'Reply directly to this email or click the button above to continue the conversation.',
					]
				),
			];

		case 'ticket-reply-staff':
			return [
				'subject' => sprintf( '[%1$s] Customer replied to ticket %2$s', $site, $tnum ),
				'body'    => sprintf(
					"A customer has replied to ticket %1\$s.\n\nCustomer: %2\$s\nSubject: %3\$s\n\nMessage:\n%4\$s\n\nOpen ticket:\n%5\$s",
					$tnum,
					$name,
					$subj,
					esc_html( wp_strip_all_tags( $ctx['reply_body'] ?? '' ) ),
					$aurl
				),
			];

		case 'ticket-resolved-customer':
			$body = sprintf(
				"Hi %1\$s,\n\nWe're happy to let you know that your support ticket (%2\$s - %3\$s) has been marked as resolved.\n\nIf you feel the issue is not fully resolved, please reply to this email and we'll reopen it for you.\n\n%4\$s Support Team",
				$name, $tnum, $subj, $site
			);
			return [
				'subject' => sprintf( '[%1$s] Your ticket %2$s has been resolved', $site, $tnum ),
				'body'    => $body,
				'html'    => dtb_render_branded_email(
					[
						'title'       => 'Your ticket has been resolved',
						'preheader'   => sprintf( 'Ticket %s has been marked as resolved.', $tnum ),
						'eyebrow'     => 'Support resolved',
						'greeting'    => sprintf( 'Hi %s,', $name ),
						'intro'       => 'Your support ticket has been marked as resolved.',
						'details'     => [
							[ 'label' => 'Ticket reference', 'value' => $tnum ],
							[ 'label' => 'Subject', 'value' => $subj ],
						],
						'body_html'   => '<p style="margin:0;">If the issue is not fully resolved, reply to this email and we will reopen it for you.</p>',
						'signoff'     => $site . ' Support Team',
						'footer_note' => 'Reply directly to this email if you need this ticket reopened.',
					]
				),
			];

		case 'ticket-reopened-customer':
			$body = sprintf(
				"Hi %1\$s,\n\nYour support ticket (%2\$s) has been reopened and our team will continue looking into it.\n\n%3\$s Support Team",
				$name, $tnum, $site
			);
			return [
				'subject' => sprintf( '[%1$s] Your ticket %2$s has been reopened', $site, $tnum ),
				'body'    => $body,
				'html'    => dtb_render_branded_email(
					[
						'title'       => 'Your ticket has been reopened',
						'preheader'   => sprintf( 'Ticket %s is open again with Drywall Toolbox support.', $tnum ),
						'eyebrow'     => 'Support reopened',
						'greeting'    => sprintf( 'Hi %s,', $name ),
						'intro'       => 'Your support ticket has been reopened and our team will continue looking into it.',
						'details'     => [
							[ 'label' => 'Ticket reference', 'value' => $tnum ],
							[ 'label' => 'Subject', 'value' => $subj ],
						],
						'signoff'     => $site . ' Support Team',
						'footer_note' => 'Reply directly to this email to add more information to your ticket.',
					]
				),
			];

		default:
			return new WP_Error( 'dtb_support_unknown_template', "Unknown email template: {$template}" );
	}
}

// =============================================================================
// SECTION 3 — DISPATCH
// =============================================================================

/**
 * Send a support notification email.
 *
 * @param string   $to       Recipient address.
 * @param string   $template Template slug.
 * @param array    $ctx      Template context.
 * @return bool|WP_Error
 */
function dtb_support_send_email( string $to, string $template, array $ctx ): bool|WP_Error {
	$result = dtb_support_get_email_template( $template, $ctx );
	if ( is_wp_error( $result ) ) {
		return $result;
	}

	if ( ! defined( 'DTB_SUPPORT_SENDING' ) ) {
		define( 'DTB_SUPPORT_SENDING', true );
	}

	$is_html       = ! empty( $result['html'] );
	$message       = $is_html ? (string) $result['html'] : (string) $result['body'];
	$content_type  = $is_html ? 'text/html' : 'text/plain';
	$alt_body_hook = $is_html && function_exists( 'dtb_mail_alt_body_hook' )
		? dtb_mail_alt_body_hook( (string) $result['body'] )
		: null;

	$sent = wp_mail(
		$to,
		$result['subject'],
		$message,
		dtb_support_email_headers( $content_type )
	);

	if ( is_callable( $alt_body_hook ) ) {
		remove_action( 'phpmailer_init', $alt_body_hook );
	}

	if ( ! $sent ) {
		return new WP_Error( 'dtb_support_mail_failed', "wp_mail failed for template {$template} to {$to}" );
	}

	return true;
}

/**
 * Queue a support email in the outbox when available, falling back to direct delivery.
 */
function dtb_support_queue_email_notification( ?object $ticket, string $to, string $recipient_name, string $template, array $ctx ): bool|WP_Error {
	$result = dtb_support_get_email_template( $template, $ctx );
	if ( is_wp_error( $result ) ) {
		return $result;
	}

	$is_html = ! empty( $result['html'] );
	if ( function_exists( 'dtb_support_outbox_enqueue' ) ) {
		$enqueued = dtb_support_outbox_enqueue( [
			'ticket_id'       => $ticket ? (int) $ticket->id : null,
			'recipient_email' => $to,
			'recipient_name'  => $recipient_name,
			'subject'         => (string) $result['subject'],
			'body_html'       => $is_html ? (string) $result['html'] : '',
			'body_text'       => (string) $result['body'],
			'headers'         => dtb_support_email_headers( $is_html ? 'text/html' : 'text/plain' ),
		] );

		return is_wp_error( $enqueued ) ? $enqueued : true;
	}

	return dtb_support_send_email( $to, $template, $ctx );
}

/**
 * Fire all standard notifications for a newly-opened ticket.
 *
 * @param object $ticket  Full ticket row from the DB.
 */
function dtb_support_notify_ticket_opened( object $ticket ): void {
	$admin_url = admin_url( 'admin.php?page=dtb-support&ticket_id=' . $ticket->id );

	$ctx = [
		'ticket_number'  => $ticket->ticket_number,
		'subject'        => $ticket->subject,
		'customer_name'  => $ticket->customer_name,
		'customer_email' => $ticket->customer_email,
		'ticket_type'    => $ticket->ticket_type,
		'priority'       => $ticket->priority,
		'message'        => $ticket->message,
		'admin_url'      => $admin_url,
	];

	// Notify customer.
	if ( is_email( $ticket->customer_email ) ) {
		dtb_support_queue_email_notification( $ticket, $ticket->customer_email, (string) $ticket->customer_name, 'ticket-opened-customer', $ctx );
	}

	// Notify staff (admin email or assigned agent).
	$assigned_user = $ticket->assigned_user_id ? get_userdata( (int) $ticket->assigned_user_id ) : null;
	$staff_email   = $assigned_user->user_email ?? dtb_support_admin_email();
	$staff_name    = $assigned_user->display_name ?? __( 'Support Team', 'drywall-toolbox' );

	if ( is_email( $staff_email ) ) {
		dtb_support_queue_email_notification( $ticket, $staff_email, $staff_name, 'ticket-opened-admin', $ctx );
	}
}

/**
 * Fire all standard notifications for a staff reply.
 *
 * @param object $ticket
 * @param string $reply_body  Plain-text reply body.
 */
function dtb_support_notify_staff_reply( object $ticket, string $reply_body ): void {
	if ( ! is_email( $ticket->customer_email ) ) {
		return;
	}

	// Generate an expiring token so the customer can reply via the REST endpoint
	// from their email client without needing to be logged in.
	$reply_token = dtb_support_generate_public_reply_token( (int) $ticket->id, $ticket->customer_email );
	// The ticket ID is already in the REST URL path; only the token is a query parameter.
	$reply_link  = add_query_arg(
		[ 'token' => $reply_token ],
		rest_url( 'dtb/v1/support/tickets/' . $ticket->id . '/reply/public' )
	);

	$ctx = [
		'ticket_number'  => $ticket->ticket_number,
		'subject'        => $ticket->subject,
		'customer_name'  => $ticket->customer_name,
		'customer_email' => $ticket->customer_email,
		'reply_body'     => $reply_body,
		'reply_link'     => esc_url_raw( $reply_link ),
	];

	dtb_support_queue_email_notification( $ticket, $ticket->customer_email, (string) $ticket->customer_name, 'ticket-reply-customer', $ctx );
}

/**
 * Fire all standard notifications for a customer reply.
 *
 * @param object $ticket
 * @param string $reply_body
 */
function dtb_support_notify_customer_reply( object $ticket, string $reply_body ): void {
	$assigned_user = $ticket->assigned_user_id ? get_userdata( (int) $ticket->assigned_user_id ) : null;
	$staff_email   = $assigned_user->user_email ?? dtb_support_admin_email();
	$staff_name    = $assigned_user->display_name ?? __( 'Support Team', 'drywall-toolbox' );

	if ( ! is_email( $staff_email ) ) {
		return;
	}

	$admin_url = admin_url( 'admin.php?page=dtb-support&ticket_id=' . $ticket->id );
	$ctx = [
		'ticket_number' => $ticket->ticket_number,
		'subject'       => $ticket->subject,
		'customer_name' => $ticket->customer_name,
		'reply_body'    => $reply_body,
		'admin_url'     => $admin_url,
	];

	dtb_support_queue_email_notification( $ticket, $staff_email, $staff_name, 'ticket-reply-staff', $ctx );
}
