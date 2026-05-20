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

// Only load this endpoint when handling REST or admin requests.
if ( ! dtb_is_admin_or_rest_request() ) {
	return;
}

// ─── Constants ────────────────────────────────────────────────────────────────

/** WordPress option key used to persist the subscriber array. */
define( 'DTB_SUBSCRIBERS_OPTION', 'dtb_email_subscribers' );

/** Maximum sign-up attempts per IP address per 24 hours (rate limit). */
define( 'DTB_RATE_LIMIT', 20 );

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

	// ── GET /wp-json/dtb/v1/unsubscribe ─────────────────────────────────────
	// One-click unsubscribe link included in every confirmation email.
	// Validates an HMAC token, removes the subscriber, and renders a page.
	register_rest_route(
		'dtb/v1',
		'/unsubscribe',
		array(
			'methods'             => 'GET',
			'callback'            => 'dtb_rest_unsubscribe',
			'permission_callback' => '__return_true',
			'args'                => array(
				'email' => array(
					'required'          => true,
					'type'              => 'string',
					'sanitize_callback' => 'sanitize_email',
				),
				'token' => array(
					'required' => true,
					'type'     => 'string',
				),
			),
		)
	);
	// ── POST /wp-json/dtb/v1/subscribe/delete ────────────────────────────────
	// Admin-only: hard-delete a subscriber by email address.
	register_rest_route(
		'dtb/v1',
		'/subscribe/delete',
		array(
			'methods'             => 'POST',
			'callback'            => 'dtb_rest_subscribe_delete',
			'permission_callback' => static function (): bool {
				return current_user_can( 'manage_options' );
			},
			'args'                => array(
				'email' => array(
					'required'          => true,
					'type'              => 'string',
					'sanitize_callback' => 'sanitize_email',
					'validate_callback' => static function ( $value ): bool {
						return is_email( $value );
					},
				),
			),
		)
	);
}

/**
 * REST callback for POST /dtb/v1/subscribe/delete.
 *
 * Hard-deletes a subscriber record by email address.
 * Requires manage_options capability.
 *
 * @param WP_REST_Request $request
 * @return WP_REST_Response|WP_Error
 */
function dtb_rest_subscribe_delete( WP_REST_Request $request ) {
	$email = sanitize_email( $request->get_param( 'email' ) );

	if ( ! is_email( $email ) ) {
		return new WP_Error( 'invalid_email', 'A valid email address is required.', array( 'status' => 400 ) );
	}

	$subscribers = get_option( DTB_SUBSCRIBERS_OPTION, array() );

	if ( ! isset( $subscribers[ $email ] ) ) {
		return new WP_Error( 'not_found', 'Subscriber not found.', array( 'status' => 404 ) );
	}

	unset( $subscribers[ $email ] );
	update_option( DTB_SUBSCRIBERS_OPTION, $subscribers );

	return rest_ensure_response( array(
		'deleted' => true,
		'email'   => $email,
	) );
}

// dtb_rest_unsubscribe() and other callbacks below.

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
	$rate_key   = 'dtb_sub_rate_' . md5( dtb_anonymise_ip( $ip ) );
	$rate_count = (int) get_transient( $rate_key );

	if ( $rate_count >= DTB_RATE_LIMIT ) {
		return new WP_Error(
			'rate_limited',
			__( 'Too many requests. Please try again later.', 'dtb' ),
			array( 'status' => 429 )
		);
	}

	// ── Save subscriber ──────────────────────────────────────────────────────
	$result = dtb_save_subscriber( $email, $ip );

	if ( is_wp_error( $result ) ) {
		// Surface "already subscribed" as a 200 so the UX stays friendly.
		// Do NOT increment the rate counter — this is not an abuse attempt.
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

	// Increment rate counter only on a genuine new sign-up. Window: 24 hours.
	set_transient( $rate_key, $rate_count + 1, DAY_IN_SECONDS );

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

/**
 * REST callback for GET /wp-json/dtb/v1/unsubscribe?email=...&token=...
 *
 * Validates the HMAC token, removes the subscriber, and returns a
 * self-contained HTML confirmation page (not JSON) so the browser shows
 * a friendly message when the user clicks the email link.
 *
 * @param WP_REST_Request $request Incoming REST request.
 * @return WP_REST_Response|WP_Error
 */
function dtb_rest_unsubscribe( WP_REST_Request $request ) {
	$email = sanitize_email( (string) $request->get_param( 'email' ) );
	$token = sanitize_text_field( (string) $request->get_param( 'token' ) );

	// Validate the HMAC token — prevents anyone from unsubscribing arbitrary addresses.
	if ( ! hash_equals( dtb_unsubscribe_token( $email ), $token ) ) {
		dtb_unsubscribe_page(
			'Invalid or expired link',
			'This unsubscribe link is invalid or has already been used. If you need help, reply to the original email.',
			false
		);
		return new WP_REST_Response( null, 200 );
	}

	// Remove from list.
	$subscribers = get_option( DTB_SUBSCRIBERS_OPTION, array() );
	$found       = false;
	$subscribers = array_values(
		array_filter(
			$subscribers,
			static function ( $row ) use ( $email, &$found ) {
				$match = strtolower( $row['email'] ?? '' ) === strtolower( $email );
				if ( $match ) {
					$found = true;
				}
				return ! $match;
			}
		)
	);

	if ( $found ) {
		update_option( DTB_SUBSCRIBERS_OPTION, $subscribers, false );
	}

	dtb_unsubscribe_page(
		'You have been unsubscribed',
		'Your email address <strong>' . esc_html( $email ) . '</strong> has been removed from our list. You will not receive any further emails from us.',
		true
	);
	return new WP_REST_Response( null, 200 );
}

/**
 * Generate a deterministic HMAC token for a given email address.
 * Uses WordPress AUTH_KEY as the secret so tokens are environment-specific.
 *
 * @param string $email The subscriber email address.
 * @return string 16-character hex token.
 */
function dtb_unsubscribe_token( string $email ): string {
	$secret = defined( 'AUTH_KEY' ) ? AUTH_KEY : wp_salt( 'auth' );
	return substr( hash_hmac( 'sha256', strtolower( $email ), $secret ), 0, 32 );
}

/**
 * Build a self-contained HTML page response for the unsubscribe endpoint.
 *
 * Uses the `rest_pre_serve_request` filter to take full control of the HTTP
 * response before WordPress sets Content-Type to application/json, ensuring
 * the browser renders the page rather than displaying raw source.
 *
 * @param string $title   Page heading.
 * @param string $message Body message (may contain safe HTML).
 * @param bool   $success True for success styling, false for error.
 * @return void  Never returns — exits after serving the HTML page.
 */
function dtb_unsubscribe_page( string $title, string $message, bool $success ): void {
	$site_name  = get_option( 'blogname' );
	$site_url   = home_url();
	$icon       = $success ? '&#10003;' : '&#9888;';
	$icon_color = $success ? '#16a34a' : '#dc2626';
	$html = '<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
  <meta name="theme-color" content="#000000">
  <title>' . esc_html( $title ) . ' &mdash; ' . esc_html( $site_name ) . '</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    html{font-size:100%;height:100%}
    body{
      font-family:\'Inter\',-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
      background:#000;
      display:flex;align-items:center;justify-content:center;
      min-height:100vh;min-height:100dvh;padding:1rem;
      color:rgba(255,255,255,.9);
      background-image:
        linear-gradient(rgba(37,99,235,.025) 1px,transparent 1px),
        linear-gradient(90deg,rgba(37,99,235,.025) 1px,transparent 1px);
      background-size:56px 56px;
    }
    .wrap{
      background:rgba(11,13,28,.88);
      backdrop-filter:blur(24px) saturate(160%);
      -webkit-backdrop-filter:blur(24px) saturate(160%);
      border:1px solid rgba(37,99,235,.22);
      border-radius:16px;
      max-width:460px;width:100%;
      padding:2.25rem 1.5rem;
      text-align:center;
      box-shadow:0 28px 70px rgba(0,0,0,.85),0 0 0 1px rgba(37,99,235,.08),0 0 55px rgba(37,99,235,.05);
      position:relative;
    }
    .wrap::before{
      content:"";position:absolute;inset:0;border-radius:16px;
      background:radial-gradient(ellipse 90% 55% at 50% 0%,rgba(37,99,235,.10) 0%,transparent 68%);
      pointer-events:none;
    }
    .icon{
      font-size:2.5rem;color:' . $icon_color . ';
      margin-bottom:1.125rem;
      display:flex;align-items:center;justify-content:center;
      width:64px;height:64px;border-radius:50%;margin:0 auto 1.25rem;
      background:rgba(37,99,235,.08);border:1.5px solid rgba(37,99,235,.2);
    }
    h1{font-size:1.25rem;font-weight:700;letter-spacing:-.02em;color:#fff;margin-bottom:.625rem;position:relative;}
    p{font-size:.9375rem;color:rgba(255,255,255,.52);line-height:1.65;position:relative;}
    a{
      display:inline-flex;align-items:center;gap:.375rem;
      margin-top:1.875rem;font-size:.875rem;font-weight:500;
      color:#3b82f6;text-decoration:none;
      padding:.55rem 1.25rem;border-radius:8px;
      border:1px solid rgba(37,99,235,.25);background:rgba(37,99,235,.07);
      transition:background .25s,border-color .25s,transform .2s;
      position:relative;
    }
    a:hover{background:rgba(37,99,235,.14);border-color:rgba(37,99,235,.45);transform:translateY(-1px);}
    @media(min-width:480px){
      .wrap{padding:3rem 2.5rem;}
      h1{font-size:1.375rem;}
    }
  </style>
</head>
<body>
  <div class="wrap">
    <div class="icon" aria-hidden="true">' . $icon . '</div>
    <h1>' . esc_html( $title ) . '</h1>
    <p>' . $message . '</p>
    <a href="' . esc_url( $site_url ) . '">&#8592; Back to ' . esc_html( $site_name ) . '</a>
  </div>
</body>
</html>';

	// Hook into the REST dispatch pipeline before headers are sent.
	// Returning `true` tells WordPress we have already served the response.
	add_filter(
		'rest_pre_serve_request',
		static function () use ( $html ) {
			header( 'Content-Type: text/html; charset=UTF-8' );
			// Remove any Content-Type header WordPress may have queued.
			header_remove( 'X-Content-Type-Options' );
			echo $html; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
			return true; // Signal to WP_REST_Server: response already sent.
		}
	);

	// Return a dummy WP_REST_Response — it will never be serialised because
	// the filter above returns true and exits the serve loop.
	// We still need to return *something* so the REST callback type is valid.
	// The filter fires before WP touches the response object.
	return; // dtb_rest_unsubscribe() must return after calling this function.
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
	$rate_key   = 'dtb_sub_rate_' . md5( dtb_anonymise_ip( $ip ) );
	$rate_count = (int) get_transient( $rate_key );

	if ( $rate_count >= DTB_RATE_LIMIT ) {
		wp_safe_redirect( home_url( '/coming-soon.html?status=error&msg=rate_limited' ) );
		exit;
	}

	// ── Save subscriber ──────────────────────────────────────────────────────
	$result = dtb_save_subscriber( $email, $ip );

	if ( is_wp_error( $result ) && 'already_subscribed' !== $result->get_error_code() ) {
		$code = $result->get_error_code();
		wp_safe_redirect( home_url( '/coming-soon.html?status=error&msg=' . rawurlencode( $code ) ) );
		exit;
	}

	// Increment rate counter only on genuine new sign-ups. Window: 24 hours.
	if ( ! is_wp_error( $result ) ) {
		set_transient( $rate_key, $rate_count + 1, DAY_IN_SECONDS );
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

	// ── Handle single subscriber deletion ────────────────────────────────────
	if (
		isset( $_GET['dtb_delete'] ) &&
		isset( $_GET['_wpnonce'] ) &&
		wp_verify_nonce( sanitize_text_field( wp_unslash( $_GET['_wpnonce'] ) ), 'dtb_delete_subscriber' )
	) {
		$email_to_delete = sanitize_email( wp_unslash( $_GET['dtb_delete'] ) );
		$subscribers     = get_option( DTB_SUBSCRIBERS_OPTION, array() );
		$subscribers     = array_values(
			array_filter(
				$subscribers,
				static function ( $row ) use ( $email_to_delete ) {
					return strtolower( $row['email'] ?? '' ) !== strtolower( $email_to_delete );
				}
			)
		);
		update_option( DTB_SUBSCRIBERS_OPTION, $subscribers, false );
		wp_safe_redirect( admin_url( 'options-general.php?page=dtb-subscribers&dtb_deleted=1' ) );
		exit;
	}

	// ── Handle delete all ────────────────────────────────────────────────────
	if (
		isset( $_POST['dtb_delete_all'] ) &&
		isset( $_POST['_wpnonce_delete_all'] ) &&
		wp_verify_nonce( sanitize_text_field( wp_unslash( $_POST['_wpnonce_delete_all'] ) ), 'dtb_delete_all_subscribers' )
	) {
		update_option( DTB_SUBSCRIBERS_OPTION, array(), false );
		wp_safe_redirect( admin_url( 'options-general.php?page=dtb-subscribers&dtb_deleted=all' ) );
		exit;
	}

	$subscribers = get_option( DTB_SUBSCRIBERS_OPTION, array() );
	$count       = count( $subscribers );
	?>
	<div class="wrap">
		<h1><?php esc_html_e( 'Coming-Soon Subscribers', 'dtb' ); ?></h1>

		<?php if ( isset( $_GET['dtb_deleted'] ) ) : ?>
			<div class="notice notice-success is-dismissible">
				<p>
					<?php
					if ( 'all' === $_GET['dtb_deleted'] ) {
						esc_html_e( 'All subscribers have been deleted.', 'dtb' );
					} else {
						esc_html_e( 'Subscriber removed successfully.', 'dtb' );
					}
					?>
				</p>
			</div>
		<?php endif; ?>

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
			<p style="display:flex;gap:8px;align-items:center;">
				<a
					href="<?php echo esc_url( wp_nonce_url( admin_url( 'options-general.php?page=dtb-subscribers&dtb_export=csv' ), 'dtb_export_csv' ) ); ?>"
					class="button button-primary"
				>
					<?php esc_html_e( 'Export as CSV', 'dtb' ); ?>
				</a>

				<form method="post" style="margin:0;" onsubmit="return confirm('Delete ALL subscribers? This cannot be undone.');">
					<?php wp_nonce_field( 'dtb_delete_all_subscribers', '_wpnonce_delete_all' ); ?>
					<button type="submit" name="dtb_delete_all" value="1" class="button" style="color:#b32d2e;border-color:#b32d2e;">
						<?php esc_html_e( 'Delete All', 'dtb' ); ?>
					</button>
				</form>
			</p>

			<table class="widefat striped" style="margin-top:1em;">
				<thead>
					<tr>
						<th><?php esc_html_e( '#', 'dtb' ); ?></th>
						<th><?php esc_html_e( 'E-mail Address', 'dtb' ); ?></th>
						<th><?php esc_html_e( 'Sign-Up Date (UTC)', 'dtb' ); ?></th>
						<th><?php esc_html_e( 'IP (anonymised)', 'dtb' ); ?></th>
						<th><?php esc_html_e( 'Action', 'dtb' ); ?></th>
					</tr>
				</thead>
				<tbody>
					<?php foreach ( array_reverse( $subscribers ) as $index => $row ) : ?>
						<tr>
							<td><?php echo esc_html( $count - $index ); ?></td>
							<td><?php echo esc_html( $row['email'] ?? '' ); ?></td>
							<td><?php echo esc_html( $row['date']  ?? '' ); ?></td>
							<td><?php echo esc_html( $row['ip']    ?? '' ); ?></td>
							<td>
								<a
									href="<?php echo esc_url( wp_nonce_url( admin_url( 'options-general.php?page=dtb-subscribers&dtb_delete=' . rawurlencode( $row['email'] ?? '' ) ), 'dtb_delete_subscriber' ) ); ?>"
									style="color:#b32d2e;"
									onclick="return confirm('Remove <?php echo esc_js( $row['email'] ?? '' ); ?> from the list?');"
								>
									<?php esc_html_e( 'Delete', 'dtb' ); ?>
								</a>
							</td>
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
 * Uses WordPress's wp_mail() routed through WP Mail SMTP Pro.
 *
 * @param string $email The new subscriber's e-mail address.
 */
function dtb_notify_admin( string $email ): void {
	$admin_email = 'elliott.miller@drywalltoolbox.com';
	$site_name   = get_option( 'blogname' );
	$from_email  = 'no-reply@' . wp_parse_url( home_url(), PHP_URL_HOST );

	// Avoid [brackets] in the subject — some spam filters penalise them.
	$subject = sprintf(
		/* translators: %s: site name */
		__( 'New Coming-Soon Sign-Up — %s', 'dtb' ),
		$site_name
	);

	$message = sprintf(
		/* translators: 1: subscriber email, 2: UTC datetime, 3: admin URL */
		__(
			"A new visitor just signed up on the coming-soon page.\n\n" .
			"E-mail:   %1\$s\n" .
			"Received: %2\$s UTC\n\n" .
			"View all subscribers:\n%3\$s",
			'dtb'
		),
		$email,
		gmdate( 'Y-m-d H:i:s' ),
		admin_url( 'options-general.php?page=dtb-subscribers' )
	);

	$headers = array(
		'Content-Type: text/plain; charset=UTF-8',
		'From: ' . $site_name . ' <' . $from_email . '>',
	);

	wp_mail( $admin_email, $subject, $message, $headers );
}

/**
 * Send a confirmation e-mail to the new subscriber.
 *
 * Delivers an HTML email (with plain-text fallback) through WP Mail SMTP Pro.
 * The template is self-contained inline-CSS so it renders correctly in Gmail,
 * Outlook, Apple Mail, and Yahoo without requiring an external stylesheet.
 *
 * Logo is served as a hosted <img> from the live site using logo-white.png —
 * a 2× retina PNG (280px wide, displayed at 140px) for sharp rendering on
 * all screens. SVG is not reliably supported in Gmail, Outlook, or Yahoo.
 *
 * @param string $email The new subscriber's validated e-mail address.
 */
function dtb_send_confirmation_email( string $email ): void {
	$site_name   = get_option( 'blogname' );
	$site_url    = home_url();
	$admin_email = get_option( 'admin_email' );
	$from_email  = 'no-reply@' . wp_parse_url( home_url(), PHP_URL_HOST );
	$logo_url    = 'https://drywalltoolbox.com/logo-white-email.png';

	// One-click unsubscribe — signed HMAC link, no stored state needed.
	$unsub_url = add_query_arg(
		array(
			'email' => rawurlencode( $email ),
			'token' => dtb_unsubscribe_token( $email ),
		),
		home_url( '/wp-json/dtb/v1/unsubscribe' )
	);

	$subject = sprintf(
		/* translators: %s: site name */
		__( 'You are on the list - %s', 'dtb' ),
		$site_name
	);

	// ── HTML body ─────────────────────────────────────────────────────────────
	// Clean white design — works correctly on all email clients including
	// iOS Gmail, Outlook, Apple Mail, Gmail desktop, and Yahoo.
	$html_message = sprintf(
		'<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>%1$s</title>
  <style>
    @media only screen and (max-width: 600px) {
      .dtb-card { width: 100%% !important; }
      .dtb-body { padding: 32px 24px 24px !important; }
      .dtb-foot { padding: 20px 24px 28px !important; }
    }
  </style>
</head>
<body style="margin:0;padding:0;background-color:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,\'Segoe UI\',Roboto,\'Helvetica Neue\',Arial,sans-serif;">

  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%%" bgcolor="#f4f4f5"
         style="background-color:#f4f4f5;">
    <tr>
      <td align="center" bgcolor="#f4f4f5" style="padding:48px 16px;background-color:#f4f4f5;">

        <!-- Card -->
        <table role="presentation" class="dtb-card" cellspacing="0" cellpadding="0" border="0" width="560" bgcolor="#ffffff"
               style="max-width:560px;width:100%%;background-color:#ffffff;border-radius:8px;overflow:hidden;border:1px solid #e4e4e7;">

          <!-- Blue accent bar -->
          <tr>
            <td bgcolor="#2563eb" height="4"
                style="height:4px;background:linear-gradient(90deg,#1d4ed8 0%%,#2563eb 100%%);font-size:0;line-height:0;">&nbsp;</td>
          </tr>

          <!-- Body -->
          <tr>
            <td class="dtb-body" bgcolor="#ffffff"
                style="padding:48px 48px 32px;background-color:#ffffff;">

              <p style="margin:0 0 24px;font-size:16px;line-height:1.7;color:#18181b;">
                Hi there,
              </p>

              <h1 style="margin:0 0 8px;font-size:24px;font-weight:700;color:#09090b;letter-spacing:-0.3px;">
                Thanks for signing up &mdash; you&rsquo;re officially on the list.
              </h1>

              <div style="height:1px;background-color:#e4e4e7;margin:28px 0;"></div>

              <p style="margin:0 0 16px;font-size:16px;line-height:1.7;color:#18181b;">
                We&rsquo;ve reserved your spot and will notify you at
                <span style="color:#2563eb;font-weight:600;">%3$s</span>
                the moment Drywall Toolbox goes live. You&rsquo;ll be among the first to know.
              </p>
              <p style="margin:0 0 32px;font-size:16px;line-height:1.7;color:#18181b;">
                Big things are on the way &mdash; the wait won&rsquo;t be long, and it&rsquo;ll be well worth the wait.
              </p>

              <p style="margin:0 0 4px;font-size:16px;line-height:1.7;color:#18181b;">
                Talk soon,
              </p>
              <p style="margin:0;font-size:16px;font-weight:600;color:#09090b;">
                The %2$s Team
              </p>

            </td>
          </tr>

          <!-- Divider -->
          <tr>
            <td bgcolor="#ffffff" style="padding:0 48px;background-color:#ffffff;">
              <div style="height:1px;background-color:#e4e4e7;"></div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td class="dtb-foot" bgcolor="#f4f4f5"
                style="padding:28px 48px 36px;background-color:#f4f4f5;text-align:center;">

              <img src="https://drywalltoolbox.com/logo-black-email.png"
                   alt="%2$s" width="320" height="167"
                   style="display:block;border:0;width:320px;height:auto;margin:0 auto 16px auto;">

              <p style="margin:0;font-size:12px;color:#71717a;line-height:1.6;text-align:center;">
                You received this because you signed up at<br>
                <a href="%4$s" style="color:#2563eb;text-decoration:underline;">drywalltoolbox.com</a>
              </p>
              <p style="margin:10px 0 0;font-size:11px;color:#71717a;text-align:center;">
                <a href="%6$s" style="color:#2563eb;text-decoration:underline;">Unsubscribe</a>
              </p>

            </td>
          </tr>

        </table><!-- /Card -->

      </td>
    </tr>
  </table>

</body>
</html>',
		esc_attr( $subject ),        // %1$s — <title>
		esc_html( $site_name ),      // %2$s — site name
		esc_html( $email ),          // %3$s — subscriber email address
		esc_url( $site_url ),        // %4$s — footer link
		esc_url( $logo_url ),        // %5$s — unused, kept for compat
		esc_url( $unsub_url )        // %6$s — one-click unsubscribe link
	);

	// ── Plain-text fallback ───────────────────────────────────────────────────
	$plain_message = sprintf(
		__(
			"Hi there,\n\n" .
			"Thanks for signing up - you're officially on the list.\n\n" .
			"We've reserved your spot and will notify you at %1\$s the moment Drywall Toolbox goes live. You'll be among the first to know.\n\n" .
			"Big things are on the way - the wait won't be long, and it'll be well worth the wait.\n\n" .
			"Talk soon,\n" .
			"The %2\$s Team\n\n" .
			"%3\$s",
			'dtb'
		),
		$email,
		$site_name,
		$site_url
	);

	// Hook phpmailer_init once to inject the plain-text AltBody.
	// PHPMailer then sends a proper multipart/alternative message automatically.
	// The hook is removed immediately after wp_mail() returns so it never
	// affects any other email sent during the same request.
	// The cleanest way to set AltBody without a persistent filter:
	// hook phpmailer_init once, set AltBody, then remove ourselves.
	$set_alt_body = static function ( $phpmailer ) use ( $plain_message ) {
		$phpmailer->AltBody = $plain_message;
	};
	add_action( 'phpmailer_init', $set_alt_body );

	$headers = array(
		'Content-Type: text/html; charset=UTF-8',
		// From address must exactly match the domain authorised in SPF/DKIM.
		'From: ' . $site_name . ' <' . $from_email . '>',
		// Replies go to the real admin inbox, not the no-reply address.
		'Reply-To: ' . $site_name . ' <' . $admin_email . '>',
	);

	$sent = wp_mail( $email, $subject, $html_message, $headers );

	// Always remove the one-shot hook regardless of send result.
	remove_action( 'phpmailer_init', $set_alt_body );

	if ( ! $sent ) {
		error_log( // phpcs:ignore WordPress.PHP.DevelopmentFunctions.error_log_error_log
			sprintf(
				'[DTB] dtb_send_confirmation_email: wp_mail() failed for subscriber %s',
				$email
			)
		);
	}
}
// dtb_get_client_ip() and dtb_anonymise_ip() are provided by dtb-utils.php.
