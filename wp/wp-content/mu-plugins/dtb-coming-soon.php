<?php
/**
 * Plugin Name: DTB Coming Soon – Email Subscriber Handler
 * Description: Handles email sign-ups from the static coming-soon.html page.
 *              Saves subscriber records to the WordPress database, enforces
 *              IP-based rate limiting, sends the site admin an instant
 *              notification e-mail, and sends the subscriber a confirmation
 *              e-mail on each new sign-up.
 *
 *              Two integration paths are provided:
 *              1. REST API  — POST /wp-json/dtb/v1/subscribe  (AJAX, primary)
 *              2. admin-post.php — traditional <form> POST fallback (no-JS)
 *
 * Version: 1.1.0
 * Author:  Drywall Toolbox
 *
 * Must-use plugin: place in wp/wp-content/mu-plugins/
 * Last Updated: 2026-04-04
 *
 * @package drywall-toolbox
 */

defined( 'ABSPATH' ) || exit;

// ─── Constants ────────────────────────────────────────────────────────────────

/** WordPress option key used to persist the subscriber array. */
define( 'DTB_SUBSCRIBERS_OPTION', 'dtb_email_subscribers' );

/** Maximum sign-up attempts per IP address per hour (rate limit). */
define( 'DTB_RATE_LIMIT', 5 );

// =============================================================================
// 1. REST API ENDPOINTS
// =============================================================================

add_action( 'rest_api_init', 'dtb_register_coming_soon_routes' );

/**
 * Register all coming-soon REST routes under the dtb/v1 namespace.
 */
function dtb_register_coming_soon_routes(): void {

	// ── POST /wp-json/dtb/v1/subscribe ──────────────────────────────────────
	// Primary AJAX endpoint called by coming-soon.html's JavaScript.
	register_rest_route(
		'dtb/v1',
		'/subscribe',
		array(
			'methods'             => 'POST',
			'callback'            => 'dtb_rest_subscribe',
			'permission_callback' => '__return_true', // Public — anyone may subscribe.
			'args'                => array(
				'email'   => array(
					'required'          => true,
					'type'              => 'string',
					'sanitize_callback' => 'sanitize_email',
					'validate_callback' => static function ( $value ) {
						return is_email( $value );
					},
					'description'       => 'The subscriber e-mail address.',
				),
				'_dtb_hp' => array(
					'required'    => false,
					'type'        => 'string',
					'default'     => '',
					'description' => 'Honeypot — must remain empty; any value signals a bot.',
				),
			),
		)
	);

	// ── GET /wp-json/dtb/v1/subscribe-nonce ─────────────────────────────────
	// Returns a short-lived WP nonce for the admin-post.php form fallback.
	// The coming-soon.html JS fetches this on page-load and injects it into
	// the hidden _dtb_nonce field so the no-JS POST path is also CSRF-safe.
	register_rest_route(
		'dtb/v1',
		'/subscribe-nonce',
		array(
			'methods'             => 'GET',
			'callback'            => static function () {
				return rest_ensure_response(
					array( 'nonce' => wp_create_nonce( 'dtb_subscribe' ) )
				);
			},
			'permission_callback' => '__return_true',
		)
	);

	// ── GET /wp-json/dtb/v1/subscribers ─────────────────────────────────────
	// Returns the full subscriber list. Requires manage_options capability
	// (i.e. site administrator). Use this to export or view sign-ups.
	register_rest_route(
		'dtb/v1',
		'/subscribers',
		array(
			'methods'             => 'GET',
			'callback'            => static function () {
				$subscribers = get_option( DTB_SUBSCRIBERS_OPTION, array() );
				return rest_ensure_response( $subscribers );
			},
			'permission_callback' => static function () {
				return current_user_can( 'manage_options' );
			},
		)
	);
}

/**
 * REST callback for POST /wp-json/dtb/v1/subscribe.
 *
 * Validates input, enforces rate limiting, saves the record, and fires
 * the admin notification e-mail.
 *
 * @param WP_REST_Request $request Incoming REST request.
 * @return WP_REST_Response|WP_Error JSON success payload, or a WP_Error.
 */
function dtb_rest_subscribe( WP_REST_Request $request ) {

	// ── Honeypot check ───────────────────────────────────────────────────────
	// Legitimate users will never fill the hidden _dtb_hp field.
	// Return a fake success so bots do not know they were detected.
	if ( '' !== (string) $request->get_param( '_dtb_hp' ) ) {
		return rest_ensure_response( array( 'success' => true, 'message' => 'Thank you!' ) );
	}

	// ── Sanitise & validate e-mail ───────────────────────────────────────────
	$email = sanitize_email( (string) $request->get_param( 'email' ) );
	if ( ! is_email( $email ) ) {
		return new WP_Error(
			'invalid_email',
			__( 'Please enter a valid e-mail address.', 'dtb' ),
			array( 'status' => 400 )
		);
	}

	// ── IP rate limiting ─────────────────────────────────────────────────────
	$ip         = dtb_get_client_ip();
	$rate_key   = 'dtb_sub_rate_' . md5( $ip );
	$rate_count = (int) get_transient( $rate_key );

	if ( $rate_count >= DTB_RATE_LIMIT ) {
		return new WP_Error(
			'rate_limited',
			__( 'Too many requests. Please try again in an hour.', 'dtb' ),
			array( 'status' => 429 )
		);
	}

	// Increment counter; expires after one hour automatically.
	set_transient( $rate_key, $rate_count + 1, HOUR_IN_SECONDS );

	// ── Save subscriber ──────────────────────────────────────────────────────
	$result = dtb_save_subscriber( $email, $ip );

	if ( is_wp_error( $result ) ) {
		// Surface "already subscribed" as a 200 so the UX stays friendly.
		if ( 'already_subscribed' === $result->get_error_code() ) {
			return rest_ensure_response(
				array(
					'success' => true,
					'message' => __( 'You are already on the list!', 'dtb' ),
				)
			);
		}

		return new WP_Error(
			$result->get_error_code(),
			$result->get_error_message(),
			array( 'status' => 500 )
		);
	}

	// ── Admin notification & subscriber confirmation ─────────────────────────
	dtb_notify_admin( $email );
	dtb_send_confirmation_email( $email );

	return rest_ensure_response(
		array(
			'success' => true,
			'message' => __( 'You are on the list. We will be in touch!', 'dtb' ),
		)
	);
}

// =============================================================================
// 2. ADMIN-POST HANDLERS  (traditional HTML form fallback — no JavaScript)
// =============================================================================

// Both hooks point to the same handler function.
// admin_post_dtb_subscribe        → logged-in users (rare for a public form)
// admin_post_nopriv_dtb_subscribe → unauthenticated visitors (typical)
add_action( 'admin_post_dtb_subscribe',        'dtb_handle_subscribe_post' );
add_action( 'admin_post_nopriv_dtb_subscribe', 'dtb_handle_subscribe_post' );

/**
 * Processes the HTML form POST to /wp-admin/admin-post.php.
 *
 * Expected POST fields:
 *   action      = dtb_subscribe       (triggers this hook)
 *   dtb_email   = user@example.com    (the subscriber address)
 *   _dtb_nonce  = <wp_nonce>          (generated by /wp-json/dtb/v1/subscribe-nonce)
 *   _dtb_hp     = ""                  (honeypot — must stay empty)
 *
 * On completion the visitor is redirected back to coming-soon.html with a
 * ?status= query parameter so the page can show a success / error banner.
 */
function dtb_handle_subscribe_post(): void {

	// ── CSRF / nonce verification ────────────────────────────────────────────
	// The JS pre-fetches a nonce and injects it into the hidden _dtb_nonce
	// field before the form is submitted.
	$raw_nonce = isset( $_POST['_dtb_nonce'] )
		? sanitize_text_field( wp_unslash( $_POST['_dtb_nonce'] ) )
		: '';

	if ( ! wp_verify_nonce( $raw_nonce, 'dtb_subscribe' ) ) {
		wp_safe_redirect( home_url( '/coming-soon.html?status=error&msg=invalid_token' ) );
		exit;
	}

	// ── Honeypot check ───────────────────────────────────────────────────────
	if ( ! empty( $_POST['_dtb_hp'] ) ) {
		// Fake success — do not hint to the bot that it was blocked.
		wp_safe_redirect( home_url( '/coming-soon.html?status=success' ) );
		exit;
	}

	// ── Sanitise & validate e-mail ───────────────────────────────────────────
	$raw_email = isset( $_POST['dtb_email'] )
		? wp_unslash( $_POST['dtb_email'] )  // phpcs:ignore WordPress.Security.ValidatedSanitizedInput.InputNotSanitized
		: '';
	$email     = sanitize_email( $raw_email );

	if ( ! is_email( $email ) ) {
		wp_safe_redirect( home_url( '/coming-soon.html?status=error&msg=invalid_email' ) );
		exit;
	}

	// ── IP rate limiting ─────────────────────────────────────────────────────
	$ip         = dtb_get_client_ip();
	$rate_key   = 'dtb_sub_rate_' . md5( $ip );
	$rate_count = (int) get_transient( $rate_key );

	if ( $rate_count >= DTB_RATE_LIMIT ) {
		wp_safe_redirect( home_url( '/coming-soon.html?status=error&msg=rate_limited' ) );
		exit;
	}

	set_transient( $rate_key, $rate_count + 1, HOUR_IN_SECONDS );

	// ── Save subscriber ──────────────────────────────────────────────────────
	$result = dtb_save_subscriber( $email, $ip );

	if ( is_wp_error( $result ) && 'already_subscribed' !== $result->get_error_code() ) {
		$code = $result->get_error_code();
		wp_safe_redirect( home_url( '/coming-soon.html?status=error&msg=' . rawurlencode( $code ) ) );
		exit;
	}

	// ── Admin notification & subscriber confirmation ─────────────────────────
	dtb_notify_admin( $email );
	dtb_send_confirmation_email( $email );

	wp_safe_redirect( home_url( '/coming-soon.html?status=success' ) );
	exit;
}

// =============================================================================
// 3. WP ADMIN PAGE — Subscriber List
// =============================================================================

add_action( 'admin_menu', 'dtb_add_subscribers_menu' );

/**
 * Register a "Coming-Soon Subscribers" submenu under Settings.
 * Accessible at WP Admin → Settings → Coming-Soon Subscribers.
 */
function dtb_add_subscribers_menu(): void {
	add_options_page(
		__( 'Coming-Soon Subscribers', 'dtb' ),
		__( 'Subscribers', 'dtb' ),
		'manage_options',
		'dtb-subscribers',
		'dtb_render_subscribers_page'
	);
}

/**
 * Render the Coming-Soon Subscribers admin page.
 *
 * Displays a sortable table of all captured e-mail addresses with their
 * sign-up date and anonymised IP, plus a CSV export button.
 */
function dtb_render_subscribers_page(): void {
	if ( ! current_user_can( 'manage_options' ) ) {
		wp_die( esc_html__( 'You do not have permission to view this page.', 'dtb' ) );
	}

	// ── Handle CSV export ────────────────────────────────────────────────────
	if (
		isset( $_GET['dtb_export'] ) &&
		'csv' === $_GET['dtb_export'] &&
		isset( $_GET['_wpnonce'] ) &&
		wp_verify_nonce( sanitize_text_field( wp_unslash( $_GET['_wpnonce'] ) ), 'dtb_export_csv' )
	) {
		dtb_export_subscribers_csv();
		exit;
	}

	$subscribers = get_option( DTB_SUBSCRIBERS_OPTION, array() );
	$count       = count( $subscribers );
	?>
	<div class="wrap">
		<h1><?php esc_html_e( 'Coming-Soon Subscribers', 'dtb' ); ?></h1>
		<p>
			<?php
			printf(
				/* translators: %d: number of subscribers */
				esc_html( _n( '%d subscriber captured.', '%d subscribers captured.', $count, 'dtb' ) ),
				(int) $count
			);
			?>
		</p>

		<?php if ( $count > 0 ) : ?>
			<p>
				<a
					href="<?php echo esc_url( wp_nonce_url( admin_url( 'options-general.php?page=dtb-subscribers&dtb_export=csv' ), 'dtb_export_csv' ) ); ?>"
					class="button button-primary"
				>
					<?php esc_html_e( 'Export as CSV', 'dtb' ); ?>
				</a>
			</p>

			<table class="widefat striped" style="margin-top:1em;">
				<thead>
					<tr>
						<th><?php esc_html_e( '#', 'dtb' ); ?></th>
						<th><?php esc_html_e( 'E-mail Address', 'dtb' ); ?></th>
						<th><?php esc_html_e( 'Sign-Up Date (UTC)', 'dtb' ); ?></th>
						<th><?php esc_html_e( 'IP (anonymised)', 'dtb' ); ?></th>
					</tr>
				</thead>
				<tbody>
					<?php foreach ( array_reverse( $subscribers ) as $index => $row ) : ?>
						<tr>
							<td><?php echo esc_html( $count - $index ); ?></td>
							<td><?php echo esc_html( $row['email'] ?? '' ); ?></td>
							<td><?php echo esc_html( $row['date']  ?? '' ); ?></td>
							<td><?php echo esc_html( $row['ip']    ?? '' ); ?></td>
						</tr>
					<?php endforeach; ?>
				</tbody>
			</table>
		<?php else : ?>
			<p><?php esc_html_e( 'No subscribers yet.', 'dtb' ); ?></p>
		<?php endif; ?>
	</div>
	<?php
}

/**
 * Stream the subscriber list as a downloadable CSV file.
 * Called when the admin clicks "Export as CSV".
 */
function dtb_export_subscribers_csv(): void {
	$subscribers = get_option( DTB_SUBSCRIBERS_OPTION, array() );
	$filename    = 'dtb-subscribers-' . gmdate( 'Y-m-d' ) . '.csv';

	// Output CSV headers.
	header( 'Content-Type: text/csv; charset=UTF-8' );
	header( 'Content-Disposition: attachment; filename="' . $filename . '"' );
	header( 'Pragma: no-cache' );
	header( 'Expires: 0' );

	$output = fopen( 'php://output', 'w' );

	// BOM for Excel UTF-8 compatibility.
	// phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_fwrite
	fwrite( $output, "\xEF\xBB\xBF" );

	// phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_fputcsv
	fputcsv( $output, array( 'Email', 'Date (UTC)', 'IP (anonymised)' ) );

	foreach ( $subscribers as $row ) {
		// phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_fputcsv
		fputcsv(
			$output,
			array(
				$row['email'] ?? '',
				$row['date']  ?? '',
				$row['ip']    ?? '',
			)
		);
	}

	// phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_fclose
	fclose( $output );
}

// =============================================================================
// 4. SHARED HELPERS
// =============================================================================

/**
 * Persist a new subscriber record in the WordPress options table.
 *
 * Storage format (serialised PHP array, autoload = false):
 * [
 *   [ 'email' => 'user@example.com', 'date' => '2026-04-04T01:00:00+00:00', 'ip' => '1.2.3.0' ],
 *   ...
 * ]
 *
 * @param string $email Sanitised + validated e-mail address.
 * @param string $ip    Raw client IP (will be anonymised before storage).
 * @return true|WP_Error  True on success; WP_Error on duplicate or DB failure.
 */
function dtb_save_subscriber( string $email, string $ip ) {
	$subscribers = get_option( DTB_SUBSCRIBERS_OPTION, array() );

	// Prevent duplicate e-mail entries (case-insensitive comparison).
	foreach ( $subscribers as $existing ) {
		if ( isset( $existing['email'] ) && strtolower( $existing['email'] ) === strtolower( $email ) ) {
			return new WP_Error(
				'already_subscribed',
				__( 'This e-mail address is already on the list.', 'dtb' )
			);
		}
	}

	$subscribers[] = array(
		'email' => $email,
		'date'  => gmdate( 'c' ),              // ISO 8601, e.g. 2026-04-04T01:00:00+00:00
		'ip'    => dtb_anonymise_ip( $ip ),    // GDPR-friendly: last octet zeroed
	);

	// autoload = false — this option is only read on-demand, never on every page load.
	update_option( DTB_SUBSCRIBERS_OPTION, $subscribers, false );

	return true;
}

/**
 * Send an instant notification e-mail to the site administrator.
 *
 * Uses WordPress's wp_mail() which routes through whatever SMTP configuration
 * is active (e.g. WP Mail SMTP). If the default PHP mail() is being used,
 * deliverability may be poor — consider installing WP Mail SMTP and
 * connecting to a transactional provider (SendGrid, Mailgun, etc.).
 *
 * @param string $email The new subscriber's e-mail address.
 */
function dtb_notify_admin( string $email ): void {
	$admin_email = get_option( 'admin_email' );
	$site_name   = get_option( 'blogname' );

	$subject = sprintf(
		/* translators: %s: site name */
		__( '[%s] New Coming-Soon Sign-Up', 'dtb' ),
		$site_name
	);

	$message = sprintf(
		/* translators: 1: subscriber email, 2: UTC datetime, 3: admin URL */
		__(
			"A new visitor just signed up on the coming-soon page.\n\n" .
			"E-mail:   %1\$s\n" .
			"Received: %2\$s UTC\n\n" .
			"View all subscribers in WP Admin:\n%3\$s",
			'dtb'
		),
		$email,
		gmdate( 'Y-m-d H:i:s' ),
		admin_url( 'options-general.php?page=dtb-subscribers' )
	);


	wp_mail(
		$admin_email,
		$subject,
		$message,
		array( 'Content-Type: text/plain; charset=UTF-8' )
	);
}

/**
 * Send a confirmation e-mail to the new subscriber.
 *
 * Routed through WordPress's wp_mail() so it uses whatever SMTP configuration
 * is active — including WP Mail SMTP Pro when installed and configured.
 *
 * The message is intentionally plain-text so it renders cleanly in every mail
 * client without requiring an HTML template.
 *
 * @param string $email The new subscriber's validated e-mail address.
 */
function dtb_send_confirmation_email( string $email ): void {
	$site_name = get_option( 'blogname' );
	$site_url  = home_url();

	$subject = sprintf(
		/* translators: %s: site name */
		__( "You're on the list — %s", 'dtb' ),
		$site_name
	);

	$message = sprintf(
		/* translators: 1: subscriber email, 2: site name, 3: site URL */
		__(
			"Hi there,\n\n" .
			"Thank you for signing up! We've reserved your spot at %2\$s.\n\n" .
			"You'll receive an email at %1\$s the moment we go live.\n\n" .
			"In the meantime, feel free to visit us at:\n%3\$s\n\n" .
			"We're working hard behind the scenes and can't wait to share\n" .
			"what we've been building.\n\n" .
			"— The %2\$s Team",
			'dtb'
		),
		$email,
		$site_name,
		$site_url
	);

	$headers = array(
		'Content-Type: text/plain; charset=UTF-8',
		// Set a Reply-To so replies go to the admin inbox, not a no-reply address.
		'Reply-To: ' . get_option( 'admin_email' ),
	);

	$sent = wp_mail( $email, $subject, $message, $headers );

	if ( ! $sent ) {
		// Log a PHP error so server logs capture delivery failures without
		// exposing details to the end-user (the subscriber already sees success).
		error_log( // phpcs:ignore WordPress.PHP.DevelopmentFunctions.error_log_error_log
			sprintf(
				'[DTB] dtb_send_confirmation_email: wp_mail() failed for subscriber %s',
				$email
			)
		);
	}
}
// dtb_get_client_ip() and dtb_anonymise_ip() are provided by dtb-utils.php.
