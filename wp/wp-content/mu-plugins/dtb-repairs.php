<?php
/**
 * DTB Repair Services — Must-Use Plugin (Core)
 *
 * Registers the dtb_repair_request CPT, all post meta keys, and the
 * REST API endpoints that power the React SPA repair submission/tracking flow.
 *
 * REST namespace: dtb/v1
 *   POST /repairs/submit                   — Create a new repair request
 *   GET  /repairs/status/{repair_id}       — Public-safe status projection
 *   POST /repairs/{repair_id}/media        — Upload supporting images
 *   GET  /repairs/{repair_id}/events/stream — SSE event stream (long-poll)
 *   GET  /repairs/health                   — Dependency health check
 *
 * Depends on (loaded before this by 00-dtb-loader.php):
 *   dtb-auth.php               → dtb_jwt_permission()
 *   dtb-repair-events.php      → dtb_repair_append_event()
 *   dtb-repair-workflows.php   → dtb_transition_repair_status(), dtb_build_repair_status_projection()
 *   dtb-repair-queue.php       → dtb_repair_enqueue_job()
 *
 * @package drywall-toolbox
 */

defined( 'ABSPATH' ) || exit;

// =============================================================================
// SECTION 1 — CONSTANTS
// =============================================================================

/** Allowed tool brands for repair submissions. */
if ( ! defined( 'DTB_REPAIR_ALLOWED_BRANDS' ) ) {
	define( 'DTB_REPAIR_ALLOWED_BRANDS', [ 'TapeTech', 'Columbia Tools', 'Asgard', 'Other' ] );
}

/** Allowed service tiers. */
if ( ! defined( 'DTB_REPAIR_SERVICE_TIERS' ) ) {
	define( 'DTB_REPAIR_SERVICE_TIERS', [ 'standard', 'express', 'warranty' ] );
}

/** Rate-limit window in seconds (1 hour). */
if ( ! defined( 'DTB_REPAIR_RATE_LIMIT_WINDOW' ) ) {
	define( 'DTB_REPAIR_RATE_LIMIT_WINDOW', 3600 );
}

/** Maximum submissions per IP per window. */
if ( ! defined( 'DTB_REPAIR_RATE_LIMIT_MAX' ) ) {
	define( 'DTB_REPAIR_RATE_LIMIT_MAX', 5 );
}

/** Allowed MIME types for repair media uploads. */
if ( ! defined( 'DTB_REPAIR_ALLOWED_MIME_TYPES' ) ) {
	define( 'DTB_REPAIR_ALLOWED_MIME_TYPES', [ 'image/jpeg', 'image/png', 'image/gif', 'image/webp' ] );
}

/** Max media files per upload request. */
if ( ! defined( 'DTB_REPAIR_MAX_MEDIA_FILES' ) ) {
	define( 'DTB_REPAIR_MAX_MEDIA_FILES', 5 );
}

/** Max media file size in bytes (5 MB). */
if ( ! defined( 'DTB_REPAIR_MAX_MEDIA_SIZE' ) ) {
	define( 'DTB_REPAIR_MAX_MEDIA_SIZE', 5 * 1024 * 1024 );
}

// =============================================================================
// SECTION 2 — CPT REGISTRATION
// =============================================================================

add_action( 'init', 'dtb_repair_register_cpt' );

/**
 * Register the dtb_repair_request custom post type.
 */
function dtb_repair_register_cpt(): void {
	$labels = [
		'name'               => __( 'Repair Requests', 'drywall-toolbox' ),
		'singular_name'      => __( 'Repair Request', 'drywall-toolbox' ),
		'menu_name'          => __( 'Repairs', 'drywall-toolbox' ),
		'add_new'            => __( 'Add New', 'drywall-toolbox' ),
		'add_new_item'       => __( 'Add New Repair Request', 'drywall-toolbox' ),
		'edit_item'          => __( 'Edit Repair Request', 'drywall-toolbox' ),
		'new_item'           => __( 'New Repair Request', 'drywall-toolbox' ),
		'view_item'          => __( 'View Repair Request', 'drywall-toolbox' ),
		'search_items'       => __( 'Search Repair Requests', 'drywall-toolbox' ),
		'not_found'          => __( 'No repair requests found.', 'drywall-toolbox' ),
		'not_found_in_trash' => __( 'No repair requests found in trash.', 'drywall-toolbox' ),
	];

	register_post_type(
		'dtb_repair_request',
		[
			'labels'              => $labels,
			'public'              => false,
			'publicly_queryable'  => false,
			'show_ui'             => true,
			'show_in_menu'        => false, // dtb-repair-admin.php adds its own menu item.
			'show_in_nav_menus'   => false,
			'show_in_rest'        => false, // All REST is custom-routed through dtb/v1.
			'query_var'           => false,
			'rewrite'             => false,
			'capability_type'     => 'post',
			'capabilities'        => [
				'edit_post'              => 'dtb_manage_repairs',
				'read_post'              => 'dtb_manage_repairs',
				'delete_post'            => 'dtb_manage_repairs',
				'edit_posts'             => 'dtb_manage_repairs',
				'edit_others_posts'      => 'dtb_manage_repairs',
				'publish_posts'          => 'dtb_manage_repairs',
				'read_private_posts'     => 'dtb_manage_repairs',
				'delete_posts'           => 'dtb_manage_repairs',
				'delete_private_posts'   => 'dtb_manage_repairs',
				'delete_published_posts' => 'dtb_manage_repairs',
				'delete_others_posts'    => 'dtb_manage_repairs',
				'edit_private_posts'     => 'dtb_manage_repairs',
				'edit_published_posts'   => 'dtb_manage_repairs',
				'create_posts'           => 'dtb_manage_repairs',
			],
			'map_meta_cap'        => false,
			'hierarchical'        => false,
			'supports'            => [ 'title', 'editor', 'custom-fields', 'thumbnail' ],
			'has_archive'         => false,
			'exclude_from_search' => true,
			'can_export'          => false,
		]
	);
}

// =============================================================================
// SECTION 3 — META KEY REGISTRATION
// =============================================================================

add_action( 'init', 'dtb_repair_register_meta' );

/**
 * Register all post meta keys for dtb_repair_request.
 *
 * Registering meta enables schema validation in REST and documents expected
 * types for tooling, even though REST show_in_rest is false on the CPT.
 */
function dtb_repair_register_meta(): void {
	$admin_auth = function (): bool {
		return current_user_can( 'dtb_manage_repairs' );
	};

	$string_meta = [
		'_repair_status', '_repair_public_token', '_repair_idempotency_key',
		'_repair_customer_email', '_repair_customer_name', '_repair_customer_phone',
		'_repair_tool_brand', '_repair_model', '_repair_serial',
		'_repair_service_tier', '_repair_issue', '_repair_internal_notes',
		'_repair_veeqo_sync_status', '_repair_veeqo_tracking',
		'_repair_quickbooks_invoice_id', '_repair_rewards_status',
		'_repair_submitted_at', '_repair_reviewed_at', '_repair_completed_at', '_repair_closed_at',
		'_repair_integration_state', '_repair_rewards_event_id', '_repair_rewards_issued_at',
	];

	foreach ( $string_meta as $key ) {
		register_post_meta(
			'dtb_repair_request',
			$key,
			[
				'type'              => 'string',
				'single'            => true,
				'sanitize_callback' => 'sanitize_text_field',
				'auth_callback'     => $admin_auth,
			]
		);
	}

	$int_meta = [
		'_repair_customer_user_id',
		'_repair_assigned_tech_id',
		'_repair_wc_order_id',
	];

	foreach ( $int_meta as $key ) {
		register_post_meta(
			'dtb_repair_request',
			$key,
			[
				'type'              => 'integer',
				'single'            => true,
				'sanitize_callback' => 'absint',
				'auth_callback'     => $admin_auth,
			]
		);
	}

	$bool_meta = [ '_repair_rewards_issued' ];
	foreach ( $bool_meta as $key ) {
		register_post_meta(
			'dtb_repair_request',
			$key,
			[
				'type'              => 'boolean',
				'single'            => true,
				'sanitize_callback' => 'rest_sanitize_boolean',
				'auth_callback'     => $admin_auth,
			]
		);
	}

	// Images stored as a JSON-encoded array of attachment IDs.
	register_post_meta(
		'dtb_repair_request',
		'_repair_images',
		[
			'type'              => 'string',
			'single'            => true,
			'sanitize_callback' => function ( $value ) {
				// Accepts a JSON string; sanitize the decoded array and re-encode.
				$decoded = is_string( $value ) ? json_decode( $value, true ) : $value;
				if ( ! is_array( $decoded ) ) {
					return '[]';
				}
				return wp_json_encode( array_values( array_map( 'absint', $decoded ) ) );
			},
			'auth_callback'     => $admin_auth,
		]
	);
}

// =============================================================================
// SECTION 4 — REST ROUTES REGISTRATION
// =============================================================================

add_action( 'rest_api_init', 'dtb_repair_register_rest_routes' );

/**
 * Register all REST routes for the repair service.
 */
function dtb_repair_register_rest_routes(): void {
	$ns = 'dtb/v1';

	register_rest_route(
		$ns,
		'/repairs/health',
		[
			'methods'             => WP_REST_Server::READABLE,
			'callback'            => 'dtb_repair_rest_health',
			'permission_callback' => '__return_true',
		]
	);

	register_rest_route(
		$ns,
		'/repairs/submit',
		[
			'methods'             => WP_REST_Server::CREATABLE,
			'callback'            => 'dtb_repair_rest_submit',
			'permission_callback' => 'dtb_repair_submit_permission',
			'args'                => dtb_repair_submit_args(),
		]
	);

	register_rest_route(
		$ns,
		'/repairs/status/(?P<repair_id>\d+)',
		[
			'methods'             => WP_REST_Server::READABLE,
			'callback'            => 'dtb_repair_rest_status',
			'permission_callback' => 'dtb_repair_read_permission',
			'args'                => [
				'repair_id'    => [ 'type' => 'integer', 'required' => true, 'minimum' => 1 ],
				'public_token' => [ 'type' => 'string', 'required' => false, 'sanitize_callback' => 'sanitize_text_field' ],
			],
		]
	);

	register_rest_route(
		$ns,
		'/repairs/(?P<repair_id>\d+)/media',
		[
			'methods'             => WP_REST_Server::CREATABLE,
			'callback'            => 'dtb_repair_rest_media',
			'permission_callback' => 'dtb_repair_read_permission',
			'args'                => [
				'repair_id'    => [ 'type' => 'integer', 'required' => true, 'minimum' => 1 ],
				'public_token' => [ 'type' => 'string', 'required' => false, 'sanitize_callback' => 'sanitize_text_field' ],
			],
		]
	);

	register_rest_route(
		$ns,
		'/repairs/(?P<repair_id>\d+)/events/stream',
		[
			'methods'             => WP_REST_Server::READABLE,
			'callback'            => 'dtb_repair_rest_events_stream',
			'permission_callback' => 'dtb_repair_read_permission',
			'args'                => [
				'repair_id'     => [ 'type' => 'integer', 'required' => true, 'minimum' => 1 ],
				'public_token'  => [ 'type' => 'string', 'required' => false, 'sanitize_callback' => 'sanitize_text_field' ],
				'last_event_id' => [ 'type' => 'integer', 'required' => false, 'minimum' => 0, 'default' => 0 ],
			],
		]
	);
}

// =============================================================================
// SECTION 5 — ARGUMENT SCHEMAS
// =============================================================================

/**
 * REST arg schema for POST /repairs/submit.
 *
 * @return array
 */
function dtb_repair_submit_args(): array {
	return [
		'idempotency_key'  => [
			'type'              => 'string',
			'required'          => false,
			'sanitize_callback' => 'sanitize_text_field',
			'validate_callback' => function ( $val ) {
				return '' === $val || ( is_string( $val ) && strlen( $val ) <= 128 );
			},
		],
		'email'            => [
			'type'              => 'string',
			'required'          => true,
			'sanitize_callback' => 'sanitize_email',
			'validate_callback' => 'is_email',
		],
		'name'             => [
			'type'              => 'string',
			'required'          => true,
			'sanitize_callback' => 'sanitize_text_field',
			'validate_callback' => function ( $val ) {
				return is_string( $val ) && strlen( trim( $val ) ) >= 2;
			},
		],
		'phone'            => [
			'type'              => 'string',
			'required'          => false,
			'sanitize_callback' => 'sanitize_text_field',
		],
		'brand'            => [
			'type'              => 'string',
			'required'          => true,
			'sanitize_callback' => 'sanitize_text_field',
			'validate_callback' => function ( $val ) {
				return in_array( $val, DTB_REPAIR_ALLOWED_BRANDS, true );
			},
		],
		'model'            => [
			'type'              => 'string',
			'required'          => false,
			'sanitize_callback' => 'sanitize_text_field',
		],
		'serial'           => [
			'type'              => 'string',
			'required'          => false,
			'sanitize_callback' => 'sanitize_text_field',
		],
		'service_tier'     => [
			'type'              => 'string',
			'required'          => false,
			'default'           => 'standard',
			'sanitize_callback' => 'sanitize_text_field',
			'validate_callback' => function ( $val ) {
				return in_array( $val, DTB_REPAIR_SERVICE_TIERS, true );
			},
		],
		'issue'            => [
			'type'              => 'string',
			'required'          => true,
			'sanitize_callback' => 'wp_kses_post',
			'validate_callback' => function ( $val ) {
				return is_string( $val ) && strlen( trim( $val ) ) >= 10;
			},
		],
	];
}

// =============================================================================
// SECTION 6 — PERMISSION CALLBACKS
// =============================================================================

/**
 * Permission callback for repair submission.
 *
 * Allows authenticated users (any) or anonymous requests that pass the
 * origin check. Rate limiting is enforced inside the handler.
 *
 * @return true|WP_Error
 */
function dtb_repair_submit_permission(): bool|WP_Error {
	if ( ! dtb_check_origin() ) {
		return new WP_Error( 'dtb_origin_denied', __( 'Origin not allowed.', 'drywall-toolbox' ), [ 'status' => 403 ] );
	}
	return true;
}

/**
 * Permission callback for repair read/media/stream routes.
 *
 * Access is granted when ANY of the following is true:
 *  - Current user has dtb_manage_repairs cap.
 *  - Current user is the repair owner (checked inside the handler after loading post).
 *  - A valid public_token is supplied (checked inside the handler).
 *
 * This callback just ensures origin is valid and at least one path to auth exists.
 *
 * @param WP_REST_Request $request
 * @return true|WP_Error
 */
function dtb_repair_read_permission( WP_REST_Request $request ): bool|WP_Error {
	if ( ! dtb_check_origin() ) {
		return new WP_Error( 'dtb_origin_denied', __( 'Origin not allowed.', 'drywall-toolbox' ), [ 'status' => 403 ] );
	}

	$repair_id    = (int) $request->get_param( 'repair_id' );
	$public_token = sanitize_text_field( (string) $request->get_param( 'public_token' ) );

	// Operators always have access.
	if ( current_user_can( 'dtb_manage_repairs' ) ) {
		return true;
	}

	// Authenticated owner check.
	$user_id = get_current_user_id();
	if ( $user_id && $repair_id ) {
		$owner_id = (int) get_post_meta( $repair_id, '_repair_customer_user_id', true );
		if ( $owner_id && $owner_id === $user_id ) {
			return true;
		}
	}

	// Public token check.
	if ( $repair_id && '' !== $public_token ) {
		$stored_token = (string) get_post_meta( $repair_id, '_repair_public_token', true );
		if ( '' !== $stored_token && hash_equals( $stored_token, $public_token ) ) {
			return true;
		}
	}

	return new WP_Error(
		'dtb_repair_access_denied',
		__( 'You do not have permission to access this repair.', 'drywall-toolbox' ),
		[ 'status' => 403 ]
	);
}

// =============================================================================
// SECTION 7 — REST HANDLER: POST /repairs/submit
// =============================================================================

/**
 * Handle POST /dtb/v1/repairs/submit.
 *
 * @param WP_REST_Request $request
 * @return WP_REST_Response|WP_Error
 */
function dtb_repair_rest_submit( WP_REST_Request $request ): WP_REST_Response|WP_Error {
	// --- Rate limiting ----------------------------------------------------------
	$ip          = dtb_repair_get_client_ip();
	$rate_key    = 'dtb_repair_rate_' . md5( $ip );
	$rate_count  = (int) get_transient( $rate_key );

	if ( $rate_count >= DTB_REPAIR_RATE_LIMIT_MAX ) {
		return new WP_Error(
			'dtb_repair_rate_limited',
			__( 'Too many repair submissions. Please try again later.', 'drywall-toolbox' ),
			[ 'status' => 429 ]
		);
	}

	set_transient( $rate_key, $rate_count + 1, DTB_REPAIR_RATE_LIMIT_WINDOW );

	// --- Idempotency ------------------------------------------------------------
	$idempotency_key = sanitize_text_field( (string) $request->get_param( 'idempotency_key' ) );

	if ( '' !== $idempotency_key ) {
		$existing_id = dtb_repair_find_by_idempotency_key( $idempotency_key );
		if ( $existing_id ) {
			$post         = get_post( $existing_id );
			$public_token = (string) get_post_meta( $existing_id, '_repair_public_token', true );
			$status       = (string) get_post_meta( $existing_id, '_repair_status', true );

			return new WP_REST_Response(
				[
					'repair_id'    => $existing_id,
					'public_token' => $public_token,
					'status'       => $status,
					'message'      => __( 'Repair request already submitted.', 'drywall-toolbox' ),
				],
				200
			);
		}
	}

	// --- Build post data --------------------------------------------------------
	$email        = sanitize_email( (string) $request->get_param( 'email' ) );
	$name         = sanitize_text_field( (string) $request->get_param( 'name' ) );
	$phone        = sanitize_text_field( (string) $request->get_param( 'phone' ) );
	$brand        = sanitize_text_field( (string) $request->get_param( 'brand' ) );
	$model        = sanitize_text_field( (string) $request->get_param( 'model' ) );
	$serial       = sanitize_text_field( (string) $request->get_param( 'serial' ) );
	$service_tier = sanitize_text_field( (string) $request->get_param( 'service_tier' ) );
	$issue        = wp_kses_post( (string) $request->get_param( 'issue' ) );
	$user_id      = get_current_user_id();

	// --- Create CPT post --------------------------------------------------------
	$post_title = sprintf(
		'%s — %s %s',
		esc_html( $name ),
		esc_html( $brand ),
		esc_html( $model )
	);

	$post_id = wp_insert_post(
		[
			'post_type'   => 'dtb_repair_request',
			'post_status' => 'publish',
			'post_title'  => wp_strip_all_tags( $post_title ),
			'post_author' => $user_id, // 0 = no author (anonymous); already validated int.
		],
		true
	);

	if ( is_wp_error( $post_id ) ) {
		return $post_id;
	}

	// --- Generate public tracking token ----------------------------------------
	$public_token = bin2hex( random_bytes( 16 ) ); // 32-char hex.

	// --- Save meta --------------------------------------------------------------
	$submitted_at = gmdate( 'Y-m-d\TH:i:s\Z' );

	$meta_map = [
		'_repair_status'            => 'submitted',
		'_repair_public_token'      => $public_token,
		'_repair_idempotency_key'   => $idempotency_key,
		'_repair_customer_user_id'  => $user_id,
		'_repair_customer_email'    => $email,
		'_repair_customer_name'     => $name,
		'_repair_customer_phone'    => $phone,
		'_repair_tool_brand'        => $brand,
		'_repair_model'             => $model,
		'_repair_serial'            => $serial,
		'_repair_service_tier'      => $service_tier,
		'_repair_issue'             => $issue,
		'_repair_rewards_issued'    => false,
		'_repair_submitted_at'      => $submitted_at,
	];

	foreach ( $meta_map as $meta_key => $meta_value ) {
		update_post_meta( $post_id, $meta_key, $meta_value );
	}

	// Initialize integration state projection.
	$integration_state = wp_json_encode( [
		'woocommerce' => [ 'state' => 'pending', 'order_id' => null, 'last_success_at' => null, 'last_error' => null ],
		'veeqo'       => [ 'state' => 'pending', 'tracking_number' => null, 'last_success_at' => null, 'last_error_code' => null ],
		'quickbooks'  => [ 'state' => 'pending', 'invoice_id' => null, 'last_success_at' => null, 'last_error_code' => null ],
		'rewards'     => [ 'state' => 'not_eligible', 'issued' => false ],
	] );
	update_post_meta( $post_id, '_repair_integration_state', $integration_state );

	// --- Fire creation action ---------------------------------------------------
	/**
	 * Fires immediately after a repair request is created.
	 *
	 * @param int   $post_id    Post ID of the new repair.
	 * @param array $meta_map   The meta values saved to the post.
	 */
	do_action( 'dtb_repair_created', $post_id, $meta_map );

	return new WP_REST_Response(
		[
			'repair_id'    => $post_id,
			'public_token' => $public_token,
			'status'       => 'submitted',
			'message'      => __( 'Repair request submitted successfully.', 'drywall-toolbox' ),
		],
		201
	);
}

// =============================================================================
// SECTION 8 — REST HANDLER: GET /repairs/status/{repair_id}
// =============================================================================

/**
 * Handle GET /dtb/v1/repairs/status/{repair_id}.
 *
 * @param WP_REST_Request $request
 * @return WP_REST_Response|WP_Error
 */
function dtb_repair_rest_status( WP_REST_Request $request ): WP_REST_Response|WP_Error {
	$repair_id = (int) $request->get_param( 'repair_id' );
	$post      = get_post( $repair_id );

	if ( ! $post || 'dtb_repair_request' !== $post->post_type ) {
		return new WP_Error( 'dtb_repair_not_found', __( 'Repair request not found.', 'drywall-toolbox' ), [ 'status' => 404 ] );
	}

	// Permission check is already done in dtb_repair_read_permission().
	// Build and return the customer-safe projection.
	if ( function_exists( 'dtb_build_repair_status_projection' ) ) {
		$projection = dtb_build_repair_status_projection( $repair_id );
		return new WP_REST_Response( $projection, 200 );
	}

	// Minimal fallback if workflows file is not loaded.
	return new WP_REST_Response(
		[
			'repair_id' => $repair_id,
			'status'    => (string) get_post_meta( $repair_id, '_repair_status', true ),
		],
		200
	);
}

// =============================================================================
// SECTION 9 — REST HANDLER: POST /repairs/{repair_id}/media
// =============================================================================

/**
 * Handle POST /dtb/v1/repairs/{repair_id}/media.
 *
 * Accepts multipart/form-data with one or more files under the 'files' key.
 *
 * @param WP_REST_Request $request
 * @return WP_REST_Response|WP_Error
 */
function dtb_repair_rest_media( WP_REST_Request $request ): WP_REST_Response|WP_Error {
	$repair_id = (int) $request->get_param( 'repair_id' );
	$post      = get_post( $repair_id );

	if ( ! $post || 'dtb_repair_request' !== $post->post_type ) {
		return new WP_Error( 'dtb_repair_not_found', __( 'Repair request not found.', 'drywall-toolbox' ), [ 'status' => 404 ] );
	}

	// Check terminal states.
	$current_status = (string) get_post_meta( $repair_id, '_repair_status', true );
	$terminal       = [ 'closed', 'cancelled', 'quote_declined' ];
	if ( in_array( $current_status, $terminal, true ) ) {
		return new WP_Error(
			'dtb_repair_terminal',
			__( 'Cannot upload media to a closed or cancelled repair.', 'drywall-toolbox' ),
			[ 'status' => 409 ]
		);
	}

	// Validate files are present.
	$files = $request->get_file_params();
	if ( empty( $files ) || empty( $files['files'] ) ) {
		return new WP_Error( 'dtb_repair_no_files', __( 'No files uploaded.', 'drywall-toolbox' ), [ 'status' => 400 ] );
	}

	// Normalize single/multiple file uploads.
	$file_list = dtb_repair_normalize_file_params( $files['files'] );

	if ( count( $file_list ) > DTB_REPAIR_MAX_MEDIA_FILES ) {
		return new WP_Error(
			'dtb_repair_too_many_files',
			sprintf(
				/* translators: %d: maximum number of files */
				__( 'Maximum %d files per upload.', 'drywall-toolbox' ),
				DTB_REPAIR_MAX_MEDIA_FILES
			),
			[ 'status' => 400 ]
		);
	}

	require_once ABSPATH . 'wp-admin/includes/file.php';
	require_once ABSPATH . 'wp-admin/includes/image.php';
	require_once ABSPATH . 'wp-admin/includes/media.php';

	$attachment_ids     = [];
	$validation_errors  = [];

	foreach ( $file_list as $index => $file ) {
		// Size check.
		if ( (int) $file['size'] > DTB_REPAIR_MAX_MEDIA_SIZE ) {
			$validation_errors[] = sprintf(
				/* translators: 1: file index, 2: max size in MB */
				__( 'File %1$d exceeds the %2$d MB size limit.', 'drywall-toolbox' ),
				$index + 1,
				DTB_REPAIR_MAX_MEDIA_SIZE / 1024 / 1024
			);
			continue;
		}

		// MIME type check via finfo (more reliable than trusting $_FILES['type']).
		$finfo     = finfo_open( FILEINFO_MIME_TYPE );
		$real_mime = finfo_file( $finfo, $file['tmp_name'] );
		finfo_close( $finfo );

		if ( ! in_array( $real_mime, DTB_REPAIR_ALLOWED_MIME_TYPES, true ) ) {
			$validation_errors[] = sprintf(
				/* translators: 1: file index, 2: detected MIME type */
				__( 'File %1$d has disallowed type "%2$s".', 'drywall-toolbox' ),
				$index + 1,
				esc_html( $real_mime )
			);
			continue;
		}

		// Extension/MIME consistency check.
		$ext      = strtolower( pathinfo( $file['name'], PATHINFO_EXTENSION ) );
		$ext_map  = dtb_repair_allowed_mime_extension_map();
		if ( ! isset( $ext_map[ $ext ] ) || $ext_map[ $ext ] !== $real_mime ) {
			$validation_errors[] = sprintf(
				/* translators: %d: file index */
				__( 'File %d has inconsistent extension and MIME type.', 'drywall-toolbox' ),
				$index + 1
			);
			continue;
		}

		// Use the WP uploader.
		$_FILES['dtb_repair_upload'] = $file;
		$upload_id = media_handle_upload(
			'dtb_repair_upload',
			$repair_id,
			[],
			[ 'test_form' => false ]
		);

		if ( is_wp_error( $upload_id ) ) {
			$validation_errors[] = $upload_id->get_error_message();
			continue;
		}

		// Regenerate metadata to strip EXIF and build thumbnails.
		$attach_data = wp_generate_attachment_metadata( $upload_id, get_attached_file( $upload_id ) );
		wp_update_attachment_metadata( $upload_id, $attach_data );

		$attachment_ids[] = $upload_id;
	}

	if ( ! empty( $validation_errors ) && empty( $attachment_ids ) ) {
		return new WP_Error(
			'dtb_repair_media_invalid',
			implode( ' ', $validation_errors ),
			[ 'status' => 422 ]
		);
	}

	// Append new attachment IDs to existing.
	if ( ! empty( $attachment_ids ) ) {
		$existing_raw = (string) get_post_meta( $repair_id, '_repair_images', true );
		$existing     = ( '' !== $existing_raw ) ? (array) json_decode( $existing_raw, true ) : [];
		$merged       = array_values( array_unique( array_merge( $existing, $attachment_ids ) ) );
		update_post_meta( $repair_id, '_repair_images', wp_json_encode( $merged ) );

		if ( function_exists( 'dtb_repair_append_event' ) ) {
			dtb_repair_append_event(
				$repair_id,
				'repair.media_uploaded',
				[
					'payload'    => [ 'attachment_ids' => $attachment_ids ],
					'actor_type' => get_current_user_id() ? 'user' : 'customer',
					'actor_id'   => get_current_user_id() ?: null,
					'visibility' => 'customer',
				]
			);
		}
	}

	return new WP_REST_Response(
		[
			'attachment_ids'   => $attachment_ids,
			'errors'           => $validation_errors,
			'total_uploaded'   => count( $attachment_ids ),
		],
		200
	);
}

// =============================================================================
// SECTION 10 — REST HANDLER: GET /repairs/{repair_id}/events/stream (SSE)
// =============================================================================

/**
 * Handle GET /dtb/v1/repairs/{repair_id}/events/stream.
 *
 * Uses a long-poll / flush model. Emits current events since last_event_id
 * as SSE, then closes. The client should reconnect with the last event ID.
 *
 * @param WP_REST_Request $request
 * @return void (exits directly to control response headers)
 */
function dtb_repair_rest_events_stream( WP_REST_Request $request ): void {
	$repair_id     = (int) $request->get_param( 'repair_id' );
	$last_event_id = (int) $request->get_param( 'last_event_id' );

	$post = get_post( $repair_id );
	if ( ! $post || 'dtb_repair_request' !== $post->post_type ) {
		// Cannot send a WP_REST_Response here — we've taken control of output.
		header( 'Content-Type: application/json', true, 404 );
		echo wp_json_encode( [ 'code' => 'not_found', 'message' => 'Repair not found.' ] );
		exit;
	}

	// Disable output buffering and set SSE headers.
	while ( ob_get_level() > 0 ) {
		ob_end_clean();
	}

	header( 'Content-Type: text/event-stream; charset=UTF-8' );
	header( 'Cache-Control: no-cache, no-store, must-revalidate' );
	header( 'X-Accel-Buffering: no' );
	header( 'Connection: keep-alive' );

	if ( ! function_exists( 'dtb_repair_get_events' ) ) {
		echo "data: []\n\n";
		flush();
		exit;
	}

	// Fetch customer-visible events since last_event_id.
	global $wpdb;
	$table  = $wpdb->prefix . 'dtb_repair_events';
	// phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- table name is built from $wpdb->prefix (trusted); esc_sql() applied for defense-in-depth.
	$events = $wpdb->get_results(
		$wpdb->prepare(
			"SELECT id, event_type, from_status, to_status, payload_json, created_at
			 FROM `" . esc_sql( $table ) . "`
			 WHERE repair_id = %d
			   AND id > %d
			   AND visibility IN ('customer', 'operator')
			 ORDER BY id ASC
			 LIMIT 100",
			$repair_id,
			$last_event_id
		)
	);

	if ( empty( $events ) ) {
		echo ": heartbeat\n\n";
		flush();
		exit;
	}

	foreach ( $events as $ev ) {
		$payload = ! empty( $ev->payload_json ) ? json_decode( $ev->payload_json, true ) : [];
		$data    = wp_json_encode(
			[
				'id'          => (int) $ev->id,
				'type'        => $ev->event_type,
				'from_status' => $ev->from_status,
				'to_status'   => $ev->to_status,
				'occurred_at' => $ev->created_at,
				'payload'     => $payload,
			]
		);
		echo "id: {$ev->id}\n";
		echo "event: {$ev->event_type}\n";
		echo "data: {$data}\n\n";
	}

	flush();
	exit;
}

// =============================================================================
// SECTION 11 — REST HANDLER: GET /repairs/health
// =============================================================================

/**
 * Handle GET /dtb/v1/repairs/health.
 *
 * @return WP_REST_Response
 */
function dtb_repair_rest_health(): WP_REST_Response {
	global $wpdb;

	$table  = $wpdb->prefix . 'dtb_repair_events';
	$checks = [];

	// Event table existence.
	// phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
	$table_exists           = (bool) $wpdb->get_var( "SHOW TABLES LIKE '{$table}'" );
	$checks['event_table']  = $table_exists ? 'ok' : 'missing';

	// Action Scheduler.
	$checks['action_scheduler'] = function_exists( 'as_schedule_single_action' ) ? 'ok' : 'unavailable';

	// WooCommerce.
	$checks['woocommerce'] = function_exists( 'wc_get_order' ) ? 'ok' : 'inactive';

	// Veeqo.
	$checks['veeqo'] = ( function_exists( 'dtb_veeqo_enabled' ) && dtb_veeqo_enabled() ) ? 'ok' : 'not_configured';

	// QuickBooks.
	$checks['quickbooks'] = ( function_exists( 'dtb_qbo_enabled' ) && dtb_qbo_enabled() ) ? 'ok' : 'not_configured';

	$all_ok = ! in_array( 'missing', $checks, true ) && ! in_array( 'inactive', $checks, true );

	return new WP_REST_Response(
		[
			'healthy'  => $all_ok,
			'checks'   => $checks,
			'ts'       => gmdate( 'Y-m-d\TH:i:s\Z' ),
		],
		$all_ok ? 200 : 503
	);
}

// =============================================================================
// SECTION 12 — CREATION HOOKS (dtb_repair_created)
// =============================================================================

add_action( 'dtb_repair_created', 'dtb_repair_on_created_append_event', 10, 2 );

/**
 * Append the initial repair.submitted event.
 *
 * @param int   $repair_id
 * @param array $meta_map
 */
function dtb_repair_on_created_append_event( int $repair_id, array $meta_map ): void {
	if ( ! function_exists( 'dtb_repair_append_event' ) ) {
		return;
	}

	dtb_repair_append_event(
		$repair_id,
		'repair.submitted',
		[
			'to_status'  => 'submitted',
			'actor_type' => $meta_map['_repair_customer_user_id'] ? 'user' : 'anonymous',
			'actor_id'   => $meta_map['_repair_customer_user_id'] ?: null,
			'source'     => 'api',
			'visibility' => 'customer',
			'payload'    => [
				'brand'        => $meta_map['_repair_tool_brand'],
				'model'        => $meta_map['_repair_model'],
				'service_tier' => $meta_map['_repair_service_tier'],
			],
		]
	);
}

add_action( 'dtb_repair_created', 'dtb_repair_on_created_queue_notifications', 20, 2 );

/**
 * Queue customer and admin notifications on repair creation.
 *
 * @param int   $repair_id
 * @param array $meta_map
 */
function dtb_repair_on_created_queue_notifications( int $repair_id, array $meta_map ): void {
	if ( ! function_exists( 'dtb_repair_enqueue_job' ) ) {
		return;
	}

	dtb_repair_enqueue_job(
		'dtb_repair_send_notification',
		$repair_id,
		[ 'template' => 'repair-submitted-customer' ]
	);

	dtb_repair_enqueue_job(
		'dtb_repair_send_notification',
		$repair_id,
		[ 'template' => 'repair-submitted-admin' ]
	);
}

// =============================================================================
// SECTION 13 — HELPER FUNCTIONS
// =============================================================================

/**
 * Return the extension-to-MIME-type map for allowed repair media uploads.
 *
 * Single source of truth — used for both MIME validation and extension
 * consistency checks so they stay in sync when DTB_REPAIR_ALLOWED_MIME_TYPES changes.
 *
 * @return array<string, string>  file extension → MIME type
 */
function dtb_repair_allowed_mime_extension_map(): array {
	return [
		'jpg'  => 'image/jpeg',
		'jpeg' => 'image/jpeg',
		'png'  => 'image/png',
		'gif'  => 'image/gif',
		'webp' => 'image/webp',
	];
}

/**
 * Return the client IP address (supports common proxy headers).
 *
 * @return string
 */
function dtb_repair_get_client_ip(): string {
	$candidates = [ 'HTTP_CF_CONNECTING_IP', 'HTTP_X_FORWARDED_FOR', 'HTTP_X_REAL_IP', 'REMOTE_ADDR' ];
	foreach ( $candidates as $key ) {
		if ( ! empty( $_SERVER[ $key ] ) ) {
			$ip   = sanitize_text_field( wp_unslash( (string) $_SERVER[ $key ] ) );
			// Take the first IP from X-Forwarded-For lists.
			$parts = explode( ',', $ip );
			$ip    = trim( $parts[0] ?? '' );
			if ( filter_var( $ip, FILTER_VALIDATE_IP ) ) {
				return $ip;
			}
		}
	}
	return '0.0.0.0';
}

/**
 * Find an existing repair post by idempotency key.
 *
 * @param string $idempotency_key
 * @return int|null Post ID or null if not found.
 */
function dtb_repair_find_by_idempotency_key( string $idempotency_key ): ?int {
	if ( '' === $idempotency_key ) {
		return null;
	}

	$posts = get_posts(
		[
			'post_type'      => 'dtb_repair_request',
			'posts_per_page' => 1,
			'post_status'    => 'publish',
			'meta_query'     => [
				[
					'key'     => '_repair_idempotency_key',
					'value'   => $idempotency_key,
					'compare' => '=',
				],
			],
			'fields'         => 'ids',
		]
	);

	return ! empty( $posts ) ? (int) $posts[0] : null;
}

/**
 * Normalize $_FILES structure for single vs multiple file uploads.
 *
 * PHP structures $_FILES differently for single vs. multiple uploads.
 * This function always returns an array of individual file arrays.
 *
 * @param array $files The $_FILES['files'] entry.
 * @return array[] Array of individual file arrays.
 */
function dtb_repair_normalize_file_params( array $files ): array {
	// If 'name' is a string, it's a single file upload already in normal form.
	if ( is_string( $files['name'] ) ) {
		return [ $files ];
	}

	// Multiple files: PHP uses a transposed structure.
	$normalized = [];
	$count      = count( $files['name'] );
	for ( $i = 0; $i < $count; $i++ ) {
		$normalized[] = [
			'name'     => $files['name'][ $i ],
			'type'     => $files['type'][ $i ],
			'tmp_name' => $files['tmp_name'][ $i ],
			'error'    => $files['error'][ $i ],
			'size'     => $files['size'][ $i ],
		];
	}
	return $normalized;
}
