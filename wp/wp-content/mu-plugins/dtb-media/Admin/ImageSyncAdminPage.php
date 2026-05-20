<?php
defined( 'ABSPATH' ) || exit;

if ( is_admin() ) {
	add_action( 'admin_menu', 'dtb_image_sync_add_management_page' );
	add_action( 'wp_ajax_dtb_image_sync', 'dtb_ajax_image_sync_handler' );
}

function dtb_image_sync_add_management_page(): void {
	add_submenu_page(
		'dtb-toolbox',
		'Drywall Toolbox Image Sync',
		'DTB Image Sync',
		'manage_woocommerce',
		'dtb-image-sync',
		'dtb_render_image_sync_admin_page'
	);
}

/**
 * Scan wp-content/uploads/ and return all real subdirectories two levels deep
 * (e.g. "2026/media", "2026/05") as relative paths, sorted newest-year first.
 * Only directories that actually contain at least one image file are included.
 *
 * @return string[] Relative paths like ['2026/media', '2026/05', '2025/12']
 */
function dtb_get_upload_subdirectories(): array {
	$upload_dir = wp_upload_dir();
	$base       = trailingslashit( $upload_dir['basedir'] );
	$results    = [];

	if ( ! is_dir( $base ) ) {
		return $results;
	}

	$image_extensions = [ 'webp', 'jpg', 'jpeg', 'png', 'avif', 'gif' ];

	// Iterate year-level directories (e.g. 2026/, 2025/).
	$year_dirs = glob( $base . '*', GLOB_ONLYDIR );
	if ( ! is_array( $year_dirs ) ) {
		return $results;
	}

	rsort( $year_dirs ); // newest year first

	foreach ( $year_dirs as $year_dir ) {
		$year_name = basename( $year_dir );
		// Skip non-year-like dirs (must be purely numeric, 4 digits).
		if ( ! preg_match( '/^\d{4}$/', $year_name ) ) {
			continue;
		}

		// Iterate subdirectories one level below the year dir.
		$sub_dirs = glob( trailingslashit( $year_dir ) . '*', GLOB_ONLYDIR );
		if ( ! is_array( $sub_dirs ) ) {
			continue;
		}

		foreach ( $sub_dirs as $sub_dir ) {
			$sub_name     = basename( $sub_dir );
			$relative     = $year_name . '/' . $sub_name;

			// Validate path segment (matches dtb_image_sync_validate_upload_path pattern).
			if ( ! preg_match( '/^[a-z0-9-]+$/', $sub_name ) ) {
				continue;
			}

			// Only include if the directory actually contains image files.
			$has_images = false;
			try {
				$it = new DirectoryIterator( $sub_dir );
				foreach ( $it as $file ) {
					if ( ! $file->isFile() ) {
						continue;
					}
					$ext = strtolower( $file->getExtension() );
					if ( in_array( $ext, $image_extensions, true ) ) {
						$has_images = true;
						break;
					}
				}
			} catch ( Exception $e ) {
				continue;
			}

			if ( $has_images ) {
				$results[] = $relative;
			}
		}
	}

	return $results;
}

/**
 * Render the wp-admin DTB Tools → DTB Image Sync page.
 */
function dtb_render_image_sync_admin_page(): void {
	if ( ! dtb_image_sync_can_manage() ) {
		wp_die( esc_html__( 'Unauthorized', 'drywall-toolbox' ) );
	}

	$nonce_value = isset( $_POST['dtb_image_sync_nonce'] ) // phpcs:ignore WordPress.Security.NonceVerification.Missing
		? sanitize_text_field( wp_unslash( (string) $_POST['dtb_image_sync_nonce'] ) ) // phpcs:ignore WordPress.Security.NonceVerification.Missing
		: '';
	$request_method  = isset( $_SERVER['REQUEST_METHOD'] ) // phpcs:ignore WordPress.Security.ValidatedSanitizedInput.InputNotSanitized
		? strtoupper( sanitize_text_field( wp_unslash( (string) $_SERVER['REQUEST_METHOD'] ) ) ) // phpcs:ignore WordPress.Security.ValidatedSanitizedInput.InputNotSanitized
		: 'GET';
	$has_valid_nonce = ( 'POST' === $request_method )
		&& ( '' !== $nonce_value )
		&& wp_verify_nonce( $nonce_value, 'dtb_image_sync_admin' );

	$get_post_field = static function ( string $key, string $default = '' ) use ( $has_valid_nonce ): string {
		if ( ! $has_valid_nonce || ! isset( $_POST[ $key ] ) ) { // phpcs:ignore WordPress.Security.NonceVerification.Missing
			return $default;
		}
		return sanitize_text_field( wp_unslash( (string) $_POST[ $key ] ) ); // phpcs:ignore WordPress.Security.NonceVerification.Missing
	};

	$get_post_bool = static function ( string $key, bool $default = false ) use ( $has_valid_nonce ): bool {
		if ( ! $has_valid_nonce || ! isset( $_POST[ $key ] ) ) { // phpcs:ignore WordPress.Security.NonceVerification.Missing
			return $default;
		}
		return rest_sanitize_boolean( wp_unslash( (string) $_POST[ $key ] ) ); // phpcs:ignore WordPress.Security.NonceVerification.Missing
	};

	$default_upload_path = defined( 'DTB_IMAGE_SYNC_DEFAULT_UPLOAD_RELATIVE_PATH' )
		? DTB_IMAGE_SYNC_DEFAULT_UPLOAD_RELATIVE_PATH
		: '2026/media';
	$upload_path_raw = trim( $get_post_field( 'dtb_upload_path', $default_upload_path ), '/' );
	// If the user selected "Enter custom path…" from the dropdown, use the manual text field instead.
	if ( '__custom__' === $upload_path_raw ) {
		$upload_path_raw = trim( $get_post_field( 'dtb_upload_path_custom', $default_upload_path ), '/' );
	}
	$upload_path = ( '' !== $upload_path_raw && dtb_image_sync_validate_upload_path( $upload_path_raw ) )
		? $upload_path_raw
		: $default_upload_path;

	// Scan actual upload subdirectories from disk for the directory selector.
	$available_dirs = dtb_get_upload_subdirectories();
	// Ensure the current selection is always present in the list, even if the
	// directory is empty (e.g. the default path before any files are uploaded).
	if ( ! in_array( $upload_path, $available_dirs, true ) ) {
		array_unshift( $available_dirs, $upload_path );
	}

	$limit   = max( 1, absint( $get_post_field( 'dtb_limit', '25' ) ) );
	$offset  = absint( $get_post_field( 'dtb_offset', '0' ) );
	$dry_run = $get_post_bool( 'dtb_dry_run', false );
	$force   = $get_post_bool( 'dtb_force', false );

	// Which action was submitted (null = no form post yet, show status only).
	$action         = null;
	$action_result  = null;

	if (
		$has_valid_nonce
		&& isset( $_POST['dtb_image_sync_action'] ) // phpcs:ignore WordPress.Security.NonceVerification.Missing
	) {
		$action = sanitize_key( wp_unslash( (string) $_POST['dtb_image_sync_action'] ) ); // phpcs:ignore WordPress.Security.NonceVerification.Missing

		$request = new WP_REST_Request();
		$request->set_param( 'upload_path', $upload_path );

		if ( in_array( $action, [ 'register_only', 'sync', 'pipeline', 'link_only', 'reset', 'fix_renamed' ], true ) ) {
			$request->set_param( 'dry_run', $dry_run );
		}

		if ( 'register_only' === $action ) {
			$request->set_param( 'limit', $limit );
			$request->set_param( 'offset', $offset );
			$request->set_param( 'force', $force );
			$request->set_param( 'register_only', true );
			$action_result = dtb_route_sync_images( $request );

		} elseif ( 'sync' === $action ) {
			$request->set_param( 'limit', $limit );
			$request->set_param( 'offset', $offset );
			$request->set_param( 'force', $force );
			$action_result = dtb_route_sync_images( $request );

		} elseif ( 'link_only' === $action ) {
			$request->set_param( 'limit', $limit );
			$request->set_param( 'offset', $offset );
			$request->set_param( 'force', $force );
			$action_result = dtb_route_link_registered_images( $request );

		} elseif ( 'pipeline' === $action ) {
			// Phase 1 — fix any WP-renamed files (idempotent, non-destructive).
			// Can be disabled by setting DTB_IMAGE_SYNC_DISABLE_RENAME = true.
			if ( ! ( defined( 'DTB_IMAGE_SYNC_DISABLE_RENAME' ) && DTB_IMAGE_SYNC_DISABLE_RENAME ) ) {
				$fix_request = new WP_REST_Request();
				$fix_request->set_param( 'upload_path', $upload_path );
				$fix_request->set_param( 'dry_run', $dry_run );
				$fix_result = dtb_route_fix_renamed_files( $fix_request );

				$fix_data = is_wp_error( $fix_result ) ? [] : (array) $fix_result->get_data();
			} else {
				$fix_data = [ 'renamed' => 0, 'errors' => [], 'disabled' => true ];
			}

			// Phase 2 — sync this batch.
			$sync_request = new WP_REST_Request();
			$sync_request->set_param( 'upload_path', $upload_path );
			$sync_request->set_param( 'dry_run', $dry_run );
			$sync_request->set_param( 'force',   $force );
			$sync_request->set_param( 'limit',   $limit );
			$sync_request->set_param( 'offset',  $offset );
			$sync_request->set_param( 'register_only', false );
			$sync_result = dtb_route_sync_images( $sync_request );

			if ( is_wp_error( $sync_result ) ) {
				$action_result = $sync_result;
			} else {
				$sync_data     = (array) $sync_result->get_data();
				$action_result = rest_ensure_response( array_merge(
					$sync_data,
					[
						'pipeline'          => true,
						'fix_renamed_count' => $fix_data['renamed'] ?? 0,
						'fix_errors'        => $fix_data['errors'] ?? [],
					]
				) );
			}

		} elseif ( 'release_lock' === $action ) {
			delete_transient( DTB_SYNC_LOCK_KEY );
			delete_transient( DTB_SYNC_PROGRESS_KEY );
			$action_result = rest_ensure_response( [ 'released' => true, 'message' => 'Sync lock released.' ] );

		} elseif ( 'status' === $action ) {
			$action_result = dtb_route_sync_images_status( $request );

		} elseif ( 'fix_renamed' === $action ) {
			$action_result = dtb_route_fix_renamed_files( $request );

		} elseif ( 'reset' === $action ) {
			$confirm_reset = $get_post_bool( 'dtb_confirm_reset', false );
			if ( ! $confirm_reset ) {
				$action_result = new WP_Error(
					'dtb_reset_confirmation_required',
					'Check "I understand reset is destructive" before running reset.',
					[ 'status' => 400 ]
				);
			} else {
				$action_result = dtb_route_reset_images( $request );
			}
		}
	}

	// Initial page load (no action submitted) — show live status for context.
	$status_data = null;
	$status_request = new WP_REST_Request();
	$status_request->set_param( 'upload_path', $upload_path );
	$status_result = dtb_route_sync_images_status( $status_request );
	if ( ! is_wp_error( $status_result ) ) {
		$status_data = $status_result->get_data();
	}

	$is_error    = is_wp_error( $action_result );
	$result_data = null === $action_result
		? null
		: (
			$is_error
			? [
				'code'    => $action_result->get_error_code(),
				'message' => $action_result->get_error_message(),
				'data'    => $action_result->get_error_data(),
			]
			: $action_result->get_data()
		);
	$status_json = wp_json_encode( $status_data ?: [], JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT );

	// Convenience: next-batch offset from a sync/pipeline result.
	$next_offset = is_array( $result_data ) ? ( $result_data['next_offset'] ?? null ) : null;

	?>
	<div class="wrap">
		<h1>🖼️ DTB Image Sync</h1>
		<p>Register, link, and optimize product images in <code>wp-content/uploads/<?php echo esc_html( $upload_path ); ?>/</code> for WooCommerce import readiness.</p>

		<div id="dtb-status-dashboard" class="card" style="max-width:100%;margin:0 0 20px;padding:20px;">
			<p style="margin:0;color:#50575e;">Loading image sync snapshot…</p>
		</div>

		<?php if ( is_array( $status_data ) && ! empty( $status_data['sync_locked'] ) ) : ?>
			<div class="card" style="max-width:100%;margin:0 0 20px;padding:16px 20px;border-left:4px solid #d63638;">
				<p style="margin:0 0 10px;"><strong>Sync lock is active.</strong> Release it only if the current run is stale or crashed.</p>
				<form method="post" action="">
					<?php wp_nonce_field( 'dtb_image_sync_admin', 'dtb_image_sync_nonce' ); ?>
					<button type="submit" class="button" name="dtb_image_sync_action" value="release_lock">🔓 Release Stuck Lock</button>
				</form>
			</div>
		<?php endif; ?>

		<?php
		// ── Action notice (only shown when a form was submitted) ──────────────
		if ( null !== $action_result ) :
			if ( $is_error ) : ?>
				<div class="notice notice-error is-dismissible"><p>
					<strong>Action failed:</strong> <?php echo esc_html( (string) ( $result_data['message'] ?? '' ) ); ?>
				</p></div>
			<?php else : ?>
				<div class="notice notice-success is-dismissible"><p>
					<?php
					$msg_parts = [];
					if ( ! empty( $result_data['pipeline'] ) ) {
						$msg_parts[] = 'Pipeline complete';
						if ( ! empty( $result_data['fix_renamed_count'] ) ) {
							$msg_parts[] = esc_html( (string) $result_data['fix_renamed_count'] ) . ' file(s) renamed';
						}
					}
					if ( isset( $result_data['registered'] ) ) {
						$msg_parts[] = esc_html( (string) $result_data['registered'] ) . ' registered';
					}
					if ( isset( $result_data['linked'] ) ) {
						$msg_parts[] = esc_html( (string) $result_data['linked'] ) . ' linked';
					}
					if ( isset( $result_data['renamed'] ) && ! isset( $result_data['registered'] ) ) {
						$msg_parts[] = esc_html( (string) $result_data['renamed'] ) . ' renamed';
					}
					if ( ! empty( $result_data['dry_run'] ) ) {
						$msg_parts[] = '(dry run)';
					}
					echo implode( ' · ', $msg_parts ) ?: 'Action completed.'; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- each part already escaped above
					?>
				</p></div>
			<?php endif;
		endif;
		?>

		<?php
		// ── Next-batch shortcut ───────────────────────────────────────────────
		if ( null !== $next_offset ) :
			$next_action = ! empty( $result_data['pipeline'] )
				? 'pipeline'
				: ( ! empty( $result_data['link_only'] )
					? 'link_only'
					: ( ! empty( $result_data['register_only'] ) ? 'register_only' : 'sync' ) );
			?>
			<div class="notice notice-info" style="display:flex;align-items:center;gap:16px;">
				<p style="margin:0;">More batches remaining. Next offset: <strong><?php echo esc_html( (string) $next_offset ); ?></strong></p>
				<form method="post" action="" style="margin:0;">
					<?php wp_nonce_field( 'dtb_image_sync_admin', 'dtb_image_sync_nonce' ); ?>
					<input type="hidden" name="dtb_upload_path" value="<?php echo esc_attr( $upload_path ); ?>" />
					<input type="hidden" name="dtb_limit"  value="<?php echo esc_attr( (string) $limit ); ?>" />
					<input type="hidden" name="dtb_offset" value="<?php echo esc_attr( (string) $next_offset ); ?>" />
					<?php if ( $dry_run ) : ?><input type="hidden" name="dtb_dry_run" value="1" /><?php endif; ?>
					<?php if ( $force )   : ?><input type="hidden" name="dtb_force"   value="1" /><?php endif; ?>
					<button type="submit" class="button button-primary" name="dtb_image_sync_action" value="<?php echo esc_attr( $next_action ); ?>">
						Continue Next Batch (offset <?php echo esc_html( (string) $next_offset ); ?>) →
					</button>
				</form>
			</div>
		<?php endif; ?>

		<div class="card" style="max-width:100%;margin:20px 0;padding:20px;">
			<h2 style="margin-top:0;">⚙️ Run Image Sync</h2>
			<form method="post" action="" id="dtb-image-sync-form">
				<?php wp_nonce_field( 'dtb_image_sync_admin', 'dtb_image_sync_nonce' ); ?>
				<table class="form-table" role="presentation">
					<tr>
						<th scope="row"><label for="dtb_upload_path">Upload Directory</label></th>
						<td>
							<?php if ( ! empty( $available_dirs ) ) : ?>
								<select id="dtb_upload_path" name="dtb_upload_path" class="regular-text" onchange="document.getElementById('dtb_upload_path_manual').style.display=this.value==='__custom__'?'block':'none';">
									<?php foreach ( $available_dirs as $dir ) : ?>
										<option value="<?php echo esc_attr( $dir ); ?>"<?php selected( $dir, $upload_path ); ?>>
											<?php echo esc_html( 'wp-content/uploads/' . $dir ); ?>
											<?php echo ( $dir === $default_upload_path ) ? ' ✦ default' : ''; ?>
										</option>
									<?php endforeach; ?>
									<option value="__custom__">— Enter custom path…</option>
								</select>
								<div id="dtb_upload_path_manual" style="display:none;margin-top:8px;">
									<input type="text" name="dtb_upload_path_custom" class="regular-text"
										placeholder="e.g. 2026/media"
										value="" />
									<p class="description">Custom relative path under <code>wp-content/uploads/</code></p>
								</div>
							<?php else : ?>
								<input id="dtb_upload_path" name="dtb_upload_path" type="text" class="regular-text"
									value="<?php echo esc_attr( $upload_path ); ?>"
									placeholder="e.g. 2026/media" />
								<p class="description">No subdirectories found on disk yet. Enter path manually — e.g. <code>2026/media</code></p>
							<?php endif; ?>
						</td>
					</tr>
					<tr>
						<th scope="row"><label for="dtb_limit">Batch limit</label></th>
						<td>
							<input id="dtb_limit" name="dtb_limit" type="number" min="1" max="250" class="small-text" value="<?php echo esc_attr( (string) $limit ); ?>" />
							<p class="description">Products per batch. 25 is safer while registering thumbnails on shared hosting.</p>
						</td>
					</tr>
					<tr>
						<th scope="row"><label for="dtb_offset">Offset</label></th>
						<td>
							<input id="dtb_offset" name="dtb_offset" type="number" min="0" class="small-text" value="<?php echo esc_attr( (string) $offset ); ?>" />
							<p class="description">Skip this many SKUs (for resuming a previous run).</p>
						</td>
					</tr>
				</table>

				<fieldset style="margin:12px 0;border:1px solid #c3c4c7;padding:12px 16px;border-radius:4px;">
					<legend style="font-weight:600;padding:0 6px;">Options</legend>
					<label style="display:block;margin-bottom:8px;">
						<input type="checkbox" name="dtb_dry_run" value="1" <?php checked( $dry_run ); ?> />
						<strong>Dry run</strong> — scan and report without writing to the database
					</label>
					<label style="display:block;margin-bottom:8px;">
						<input type="checkbox" name="dtb_force" value="1" <?php checked( $force ); ?> />
						<strong>Force</strong> — re-register and re-link images even if already synced
					</label>
					<label style="display:block;color:#b32d2e;">
						<input type="checkbox" name="dtb_confirm_reset" value="1" />
						<strong>I understand reset is destructive</strong> — required to run the Reset action
					</label>
				</fieldset>

				<p class="submit" style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;">
					<button type="submit" class="button" name="dtb_image_sync_action" value="status">Refresh Snapshot</button>
					<button type="submit" class="button" name="dtb_image_sync_action" value="fix_renamed">Fix Renamed Files</button>
					<button type="submit" class="button button-primary" name="dtb_image_sync_action" value="register_only">Register Images Only</button>
					<button type="submit" class="button button-secondary" name="dtb_image_sync_action" value="link_only">Link Registered Images</button>
					<button type="submit" class="button button-primary" name="dtb_image_sync_action" value="sync">Register + Link</button>
					<button type="submit" class="button button-primary" name="dtb_image_sync_action" value="pipeline"
						style="background:#2e7d32;border-color:#1b5e20;">🚀 Run Full Pipeline</button>
					<button type="submit" class="button button-link-delete" name="dtb_image_sync_action" value="reset"
						style="margin-left:auto;">⚠️ Run Reset</button>
				</p>
			</form>

			<div id="dtb-live-runner" class="notice notice-info" style="display:none;margin:14px 0 0;padding:12px;">
				<p id="dtb-live-status" style="margin:0 0 8px;"><strong>Ready.</strong></p>
				<div style="width:100%;max-width:760px;height:12px;background:#dcdcde;border-radius:8px;overflow:hidden;">
					<div id="dtb-live-bar" style="width:0%;height:100%;background:#2271b1;transition:width .3s ease;"></div>
				</div>
				<pre id="dtb-live-log" style="white-space:pre-wrap;margin:10px 0 0;background:#f6f7f7;padding:10px;border-radius:4px;max-height:240px;overflow:auto;font-size:12px;"></pre>
			</div>
		</div>

		<?php if ( null !== $result_data ) : ?>
			<div class="card" style="max-width:100%;margin:20px 0;padding:20px;">
				<h2 style="margin-top:0;">
					📋 Result
					<?php if ( null !== $action ) : ?>
						— <code><?php echo esc_html( $action ); ?></code>
					<?php endif; ?>
				</h2>
				<pre style="white-space:pre-wrap;margin:0;background:#f0f0f1;padding:12px;border-radius:4px;font-size:12px;"><?php
					echo esc_html( wp_json_encode( $result_data, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES ) ?: '{}' );
				?></pre>
			</div>
		<?php endif; ?>

		<div class="card" style="max-width:100%;margin:20px 0;background:#f6f7f7;padding:16px 20px;">
			<h3 style="margin-top:0;">📖 Quick Guide</h3>
			<ol style="margin-left:20px;margin-bottom:0;">
				<li>Select your <strong>Upload Directory</strong> from the dropdown — it lists every real subdirectory found under <code>wp-content/uploads/2026/</code> on disk.</li>
				<li>Click <strong>🚀 Run Full Pipeline</strong> — it fixes any WP-renamed files, then registers and links images for this batch.</li>
				<li>If a <em>Continue Next Batch</em> button appears, click it to advance until all SKUs are processed.</li>
				<li>Run <strong>Refresh Snapshot</strong> any time to reconcile catalog expectations, disk files, media attachments, and WooCommerce product links.</li>
				<li>Flow A: click <strong>🚀 Run Full Pipeline</strong> to fix names, register images, and link products in one run.</li>
				<li>Flow B: if your image library is already registered, import <code>wp-catalog.csv</code> via <a href="<?php echo esc_url( admin_url( 'edit.php?post_type=product&page=product_importer' ) ); ?>">WooCommerce → Products → Import</a>, then run <strong>Link Registered Images</strong>.</li>
			</ol>
		</div>
	</div>
	<?php
	?>
	<script>
	( function () {
		const form = document.getElementById( 'dtb-image-sync-form' );
		const dashboardEl = document.getElementById( 'dtb-status-dashboard' );
		const runner = document.getElementById( 'dtb-live-runner' );
		const statusEl = document.getElementById( 'dtb-live-status' );
		const barEl = document.getElementById( 'dtb-live-bar' );
		const logEl = document.getElementById( 'dtb-live-log' );
		if ( ! form || ! dashboardEl || ! runner || ! statusEl || ! barEl || ! logEl ) {
			return;
		}

		/**
		 * Use admin-ajax.php instead of the WP REST API.
		 *
		 * Reason: on HostGator shared hosting (and some other environments) the
		 * WP REST API cookie-nonce authentication returns "Cookie check failed"
		 * because the server strips session cookies on /wp-json/ requests before
		 * they reach PHP.  admin-ajax.php uses the standard WP session and
		 * check_ajax_referer(), which is unaffected by this issue.
		 */
		const api = {
			ajaxUrl: <?php echo wp_json_encode( esc_url_raw( admin_url( 'admin-ajax.php' ) ) ); ?>,
			nonce:   <?php echo wp_json_encode( wp_create_nonce( 'dtb_image_sync_admin' ) ); ?>
		};
		const initialSnapshot = <?php echo $status_json ?: '{}'; ?>;

		const MAX_BATCHES = 1000;

		let submittedAction = '';
		let progressPollTimer = null;
		let snapshotPollTimer = null;
		let progressPollBusy = false;
		let snapshotPollBusy = false;

		const parseBool = ( value ) => {
			const v = typeof value === 'string' ? value.toLowerCase() : value;
			return v === '1' || v === 'true' || v === true;
		};
		const parseIntOrDefault = ( value, fallback ) => {
			const parsed = Number.parseInt( String( value ?? '' ), 10 );
			return Number.isNaN( parsed ) ? fallback : parsed;
		};
		const escapeHtml = ( value ) => String( value ?? '' )
			.replaceAll( '&', '&amp;' )
			.replaceAll( '<', '&lt;' )
			.replaceAll( '>', '&gt;' )
			.replaceAll( '"', '&quot;' )
			.replaceAll( "'", '&#039;' );
		const formatNumber = ( value ) => new Intl.NumberFormat( 'en-US' ).format( parseIntOrDefault( value, 0 ) );
		const formatPercent = ( num, den ) => {
			const numerator = parseIntOrDefault( num, 0 );
			const denominator = parseIntOrDefault( den, 0 );
			if ( denominator <= 0 ) {
				return '0%';
			}
			return Math.round( ( numerator / denominator ) * 100 ) + '%';
		};
		const formatDuration = ( totalSeconds ) => {
			const seconds = parseIntOrDefault( totalSeconds, 0 );
			if ( seconds <= 0 ) {
				return '0s';
			}
			const hours = Math.floor( seconds / 3600 );
			const minutes = Math.floor( ( seconds % 3600 ) / 60 );
			const secs = seconds % 60;
			if ( hours > 0 ) {
				return `${hours}h ${minutes}m`;
			}
			if ( minutes > 0 ) {
				return `${minutes}m ${secs}s`;
			}
			return `${secs}s`;
		};
		const setStatus = ( text, isError = false ) => {
			statusEl.textContent = text;
			statusEl.style.color = isError ? '#b32d2e' : '#1d2327';
		};
		const setBar = ( ratio ) => {
			const pct = Math.max( 0, Math.min( 100, Math.round( ratio * 100 ) ) );
			barEl.style.width = pct + '%';
		};
		const appendLog = ( text ) => {
			logEl.textContent += ( logEl.textContent ? '\n' : '' ) + text;
			logEl.scrollTop = logEl.scrollHeight;
		};
		const renderHealthBadge = ( state ) => {
			const palette = {
				healthy: { bg: '#edfaef', fg: '#155724', label: 'Healthy' },
				warning: { bg: '#fff8e1', fg: '#8a6d1d', label: 'Warning' },
				error:   { bg: '#fdecea', fg: '#b42318', label: 'Error' },
				running: { bg: '#e8f1fe', fg: '#174ea6', label: 'Running' },
				blocked: { bg: '#f3e8ff', fg: '#6b21a8', label: 'Blocked' }
			};
			const cfg = palette[ state ] || palette.warning;
			return `<span style="display:inline-flex;align-items:center;padding:3px 8px;border-radius:999px;background:${cfg.bg};color:${cfg.fg};font-size:12px;font-weight:600;">${escapeHtml( cfg.label )}</span>`;
		};
		const renderMetricCard = ( title, state, metrics ) => `
			<div style="border:1px solid #dcdcde;border-radius:10px;padding:16px;background:#fff;">
				<div style="display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:10px;">
					<h3 style="margin:0;font-size:14px;line-height:1.3;">${escapeHtml( title )}</h3>
					${renderHealthBadge( state )}
				</div>
				<div style="display:grid;gap:6px;">
					${metrics.map( ( metric ) => `
						<div style="display:flex;justify-content:space-between;gap:16px;font-size:12px;">
							<span style="color:#50575e;">${escapeHtml( metric.label )}</span>
							<strong>${escapeHtml( metric.value )}</strong>
						</div>
					` ).join( '' )}
				</div>
			</div>
		`;
		const renderSimpleList = ( title, items ) => `
			<div style="border:1px solid #dcdcde;border-radius:10px;padding:16px;background:#fff;">
				<h3 style="margin:0 0 12px;font-size:14px;">${escapeHtml( title )}</h3>
				<ul style="margin:0;padding-left:18px;">
					${items.map( ( item ) => `<li style="margin:0 0 6px;">${item}</li>` ).join( '' )}
				</ul>
			</div>
		`;
		const renderCodeList = ( title, items ) => `
			<div style="border:1px solid #dcdcde;border-radius:10px;padding:16px;background:#fff;">
				<h3 style="margin:0 0 12px;font-size:14px;">${escapeHtml( title )}</h3>
				<div style="display:flex;flex-wrap:wrap;gap:8px;">
					${items.map( ( item ) => `<code style="background:#f6f7f7;padding:4px 8px;border-radius:6px;">${escapeHtml( item )}</code>` ).join( '' )}
				</div>
			</div>
		`;
		const renderMappedList = ( title, items, formatter ) => `
			<div style="border:1px solid #dcdcde;border-radius:10px;padding:16px;background:#fff;">
				<h3 style="margin:0 0 12px;font-size:14px;">${escapeHtml( title )}</h3>
				<div style="display:grid;gap:10px;">
					${items.map( formatter ).join( '' )}
				</div>
			</div>
		`;
		const renderDashboard = ( snapshot ) => {
			if ( ! snapshot || typeof snapshot !== 'object' ) {
				dashboardEl.innerHTML = '<p style="margin:0;color:#b32d2e;">Unable to load image sync snapshot.</p>';
				return;
			}

			const catalog = snapshot.catalog || {};
			const disk = snapshot.disk || {};
			const media = snapshot.media || {};
			const links = snapshot.links || {};
			const run = snapshot.run || {};
			const health = snapshot.health || {};
			const samples = snapshot.samples || {};
			const recommendations = Array.isArray( snapshot.recommendations ) ? snapshot.recommendations : [];
			const progress = run.progress || {};
			const runMeta = [
				{ label: 'Lock', value: snapshot.sync_locked ? 'Locked' : 'Free' },
				{ label: 'Elapsed', value: formatDuration( run.elapsed_seconds ) },
				{ label: 'Throughput', value: run.throughput_per_min ? `${run.throughput_per_min}/min` : 'n/a' },
				{ label: 'ETA', value: run.eta_seconds ? formatDuration( run.eta_seconds ) : 'n/a' }
			];
			if ( progress.last_sku ) {
				runMeta.push( { label: 'Last SKU', value: progress.last_sku } );
			}

			const sections = [];
			if ( recommendations.length ) {
				sections.push(
					renderMappedList(
						'Recommended Next Actions',
						recommendations,
						( item ) => `
							<div style="padding:10px 12px;border-radius:8px;background:${item.severity === 'error' ? '#fdecea' : '#f6f7f7'};">
								<div style="display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:4px;">
									<strong>${escapeHtml( item.label || 'Recommendation' )}</strong>
									${renderHealthBadge( item.severity || 'warning' )}
								</div>
								<div style="font-size:12px;color:#50575e;">${escapeHtml( item.action || '' )}</div>
							</div>
						`
					)
				);
			}
			if ( Array.isArray( samples.missing_wc_skus ) && samples.missing_wc_skus.length ) {
				sections.push( renderCodeList( 'Catalog SKUs Missing in WooCommerce', samples.missing_wc_skus ) );
			}
			if ( Array.isArray( samples.unexpected_disk_files ) && samples.unexpected_disk_files.length ) {
				sections.push( renderCodeList( 'Unexpected Files on Disk', samples.unexpected_disk_files ) );
			}
			if ( Array.isArray( samples.missing_disk_files ) && samples.missing_disk_files.length ) {
				sections.push(
					renderMappedList(
						'Expected Files Missing on Disk',
						samples.missing_disk_files,
						( item ) => `
							<div style="padding:10px 12px;border-radius:8px;background:#f6f7f7;">
								<strong>${escapeHtml( item.sku || '(unknown sku)' )}</strong>
								<div style="font-size:12px;color:#50575e;margin-top:4px;">${escapeHtml( Array.isArray( item.expected ) ? item.expected.join( ', ' ) : '' )}</div>
							</div>
						`
					)
				);
			}
			if ( Array.isArray( samples.missing_attachments ) && samples.missing_attachments.length ) {
				sections.push(
					renderMappedList(
						'Files Present But Not Registered as Media',
						samples.missing_attachments,
						( item ) => `
							<div style="padding:10px 12px;border-radius:8px;background:#f6f7f7;">
								<strong>${escapeHtml( item.sku || '(unknown sku)' )}</strong>
								<div style="font-size:12px;color:#50575e;margin-top:4px;">${escapeHtml( Array.isArray( item.expected ) ? item.expected.join( ', ' ) : '' )}</div>
							</div>
						`
					)
				);
			}
			if ( Array.isArray( samples.primary_mismatches ) && samples.primary_mismatches.length ) {
				sections.push(
					renderMappedList(
						'Primary Image Mismatches',
						samples.primary_mismatches,
						( item ) => `
							<div style="padding:10px 12px;border-radius:8px;background:#f6f7f7;">
								<strong>${escapeHtml( item.sku || '(unknown sku)' )}</strong>
								<div style="font-size:12px;color:#50575e;margin-top:4px;">
									product ${escapeHtml( item.product_id )} · current thumb ${escapeHtml( item.current_thumbnail_id )} · expected attachment ${escapeHtml( item.expected_attachment_id )} · expected file ${escapeHtml( item.expected_filename )}
								</div>
							</div>
						`
					)
				);
			}
			if ( Array.isArray( samples.gallery_mismatches ) && samples.gallery_mismatches.length ) {
				sections.push(
					renderMappedList(
						'Gallery Mismatches',
						samples.gallery_mismatches,
						( item ) => `
							<div style="padding:10px 12px;border-radius:8px;background:#f6f7f7;">
								<strong>${escapeHtml( item.sku || '(unknown sku)' )}</strong>
								<div style="font-size:12px;color:#50575e;margin-top:4px;">
									product ${escapeHtml( item.product_id )} · current [${escapeHtml( Array.isArray( item.current_gallery_ids ) ? item.current_gallery_ids.join( ', ' ) : '' )}] · expected [${escapeHtml( Array.isArray( item.expected_gallery_ids ) ? item.expected_gallery_ids.join( ', ' ) : '' )}]
								</div>
							</div>
						`
					)
				);
			}
			if ( Array.isArray( samples.orphan_attachments ) && samples.orphan_attachments.length ) {
				sections.push(
					renderMappedList(
						'Orphan Attachments in This Directory',
						samples.orphan_attachments,
						( item ) => `
							<div style="padding:10px 12px;border-radius:8px;background:#f6f7f7;">
								<strong>${escapeHtml( item.basename || '' )}</strong>
								<div style="font-size:12px;color:#50575e;margin-top:4px;">attachment ${escapeHtml( item.attachment_id )} · parent ${escapeHtml( item.post_parent )}</div>
							</div>
						`
					)
				);
			}
			if ( Array.isArray( samples.duplicate_attachment_basenames ) && samples.duplicate_attachment_basenames.length ) {
				sections.push(
					renderMappedList(
						'Duplicate Attachment Filename Collisions',
						samples.duplicate_attachment_basenames,
						( item ) => `
							<div style="padding:10px 12px;border-radius:8px;background:#f6f7f7;">
								<strong>${escapeHtml( item.basename || '' )}</strong>
								<div style="font-size:12px;color:#50575e;margin-top:4px;">attachments [${escapeHtml( Array.isArray( item.attachment_ids ) ? item.attachment_ids.join( ', ' ) : '' )}]</div>
							</div>
						`
					)
				);
			}

			dashboardEl.innerHTML = `
				<div style="display:flex;align-items:flex-start;justify-content:space-between;gap:16px;flex-wrap:wrap;margin-bottom:16px;">
					<div>
						<h2 style="margin:0 0 6px;">Image Sync Snapshot</h2>
						<div style="font-size:13px;color:#50575e;">
							<strong>Directory:</strong> <code>${escapeHtml( snapshot.directory || '' )}</code>
							&nbsp;·&nbsp;
							<strong>Active CSV:</strong> <code>${escapeHtml( snapshot.active_csv || '(none)' )}</code>
						</div>
					</div>
					${renderHealthBadge( health.overall || 'warning' )}
				</div>

				<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px;margin-bottom:16px;">
					${renderMetricCard( 'Catalog', health.catalog || 'warning', [
						{ label: 'Expected SKUs', value: formatNumber( catalog.expected_skus_total ) },
						{ label: 'Found in WooCommerce', value: formatNumber( catalog.expected_wc_products_total ) },
						{ label: 'Missing in WooCommerce', value: formatNumber( catalog.expected_missing_wc_products ) },
						{ label: 'Expected image refs', value: formatNumber( catalog.expected_image_references_total ) }
					] )}
					${renderMetricCard( 'Disk', health.disk || 'warning', [
						{ label: 'Files on disk', value: formatNumber( disk.files_on_disk_total ) },
						{ label: 'Expected refs present', value: `${formatNumber( disk.expected_present_references )} (${formatPercent( disk.expected_present_references, catalog.expected_image_references_total )})` },
						{ label: 'Expected refs missing', value: formatNumber( disk.expected_missing_references ) },
						{ label: 'Unexpected files', value: formatNumber( disk.unexpected_files_total ) }
					] )}
					${renderMetricCard( 'Media', health.media || 'warning', [
						{ label: 'Registered attachments', value: formatNumber( media.registered_attachments_total ) },
						{ label: 'Expected refs registered', value: `${formatNumber( media.expected_registered_references )} (${formatPercent( media.expected_registered_references, catalog.expected_image_references_total )})` },
						{ label: 'Missing attachments', value: formatNumber( media.expected_missing_attachments ) },
						{ label: 'Orphan attachments', value: formatNumber( media.orphan_attachments_total ) }
					] )}
					${renderMetricCard( 'Links', health.links || 'warning', [
						{ label: 'Products expected', value: formatNumber( links.products_expected_total ) },
						{ label: 'Correct primary', value: formatNumber( links.products_with_correct_primary ) },
						{ label: 'Primary missing/mismatch', value: formatNumber( links.products_missing_primary + links.variations_missing_primary ) },
						{ label: 'Complete galleries', value: formatNumber( links.products_with_complete_gallery ) },
						{ label: 'Partial/missing galleries', value: formatNumber( links.products_partial_gallery + links.products_missing_gallery ) }
					] )}
					${renderMetricCard( 'Current Run', health.run || 'warning', runMeta )}
				</div>

				<div style="display:grid;gap:12px;">
					${sections.length ? sections.join( '' ) : renderSimpleList( 'Snapshot Status', [ 'No current discrepancies detected in the sampled reconciliation layers.' ] )}
				</div>

				<details style="margin-top:16px;">
					<summary style="cursor:pointer;font-weight:600;">Raw snapshot JSON</summary>
					<pre style="white-space:pre-wrap;margin:12px 0 0;background:#f6f7f7;padding:12px;border-radius:6px;font-size:12px;overflow:auto;">${escapeHtml( JSON.stringify( snapshot, null, 2 ) )}</pre>
				</details>
			`;
		};
		const resolveUploadPath = ( formData ) => {
			const selected = String( formData.get( 'dtb_upload_path' ) || '' ).trim();
			if ( selected === '__custom__' ) {
				return String( formData.get( 'dtb_upload_path_custom' ) || '' ).trim();
			}
			return selected;
		};
		const postJson = async ( syncAction, body ) => {
			const params = new URLSearchParams( {
				action:      'dtb_image_sync',
				nonce:       api.nonce,
				sync_action: syncAction
			} );
			Object.entries( body ).forEach( ( [ k, v ] ) => {
				params.set( k, String( v ?? '' ) );
			} );
			const res = await fetch( api.ajaxUrl, {
				method:      'POST',
				credentials: 'same-origin',
				body:        params
			} );
			const envelope = await res.json().catch( () => null );
			if ( ! res.ok || ( envelope && ! envelope.success ) ) {
				const message = ( envelope && envelope.data && envelope.data.message )
					? envelope.data.message
					: `Request failed (${res.status})`;
				throw new Error( message );
			}
			return envelope ? envelope.data : null;
		};
		const readProgress = async () => {
			if ( progressPollBusy ) {
				return;
			}
			progressPollBusy = true;
			try {
				const payload = await postJson( 'progress', {} );
				const p = payload && payload.progress ? payload.progress : null;
				if ( ! p ) {
					return;
				}
				const processed = parseIntOrDefault( p.processed, 0 );
				const batchTotal = parseIntOrDefault( p.batch_total, 0 );
				const pct = batchTotal > 0 ? processed / batchTotal : 0;
				const throughput = p.throughput_per_min ? `${p.throughput_per_min}/min` : 'n/a';
				const eta = p.eta_seconds ? formatDuration( p.eta_seconds ) : 'n/a';
				const label = p.last_sku || p.last_item || 'working';
				setBar( pct );
				setStatus( `Running… ${processed}/${batchTotal > 0 ? batchTotal : '?'} (${Math.round( pct * 100 )}%) · ${label} · ${throughput} · ETA ${eta}` );
			} catch ( err ) {
				// Ignore transient polling errors while a run is active.
			} finally {
				progressPollBusy = false;
			}
		};
		const readSnapshot = async ( uploadPath ) => {
			if ( snapshotPollBusy ) {
				return;
			}
			snapshotPollBusy = true;
			try {
				const snapshot = await postJson( 'status', { upload_path: uploadPath } );
				renderDashboard( snapshot );
			} catch ( err ) {
				// Keep the previous dashboard rendered if a single poll fails.
			} finally {
				snapshotPollBusy = false;
			}
		};
		const startProgressPolling = () => {
			if ( progressPollTimer ) {
				return;
			}
			progressPollTimer = window.setInterval( readProgress, 1500 );
			void readProgress();
		};
		const stopProgressPolling = () => {
			if ( progressPollTimer ) {
				window.clearInterval( progressPollTimer );
				progressPollTimer = null;
			}
		};
		const startSnapshotPolling = ( uploadPath ) => {
			if ( snapshotPollTimer ) {
				return;
			}
			snapshotPollTimer = window.setInterval( () => void readSnapshot( uploadPath ), 8000 );
			void readSnapshot( uploadPath );
		};
		const stopSnapshotPolling = () => {
			if ( snapshotPollTimer ) {
				window.clearInterval( snapshotPollTimer );
				snapshotPollTimer = null;
			}
		};
		const stopAllPolling = () => {
			stopProgressPolling();
			stopSnapshotPolling();
		};
		const setButtonsDisabled = ( disabled ) => {
			form.querySelectorAll( 'button[type="submit"]' ).forEach( ( button ) => {
				button.disabled = disabled;
			} );
		};

		renderDashboard( initialSnapshot );
		if ( initialSnapshot && initialSnapshot.sync_locked ) {
			startSnapshotPolling( String( initialSnapshot.directory || '' ).replace( /^wp-content\/uploads\//, '' ) );
		}

		form.addEventListener( 'click', ( event ) => {
			const button = event.target.closest( 'button[name="dtb_image_sync_action"]' );
			if ( button ) {
				submittedAction = button.value || '';
			}
		} );

		form.addEventListener( 'submit', async ( event ) => {
			const handledActions = [ 'status', 'register_only', 'sync', 'pipeline', 'link_only' ];
			if ( ! handledActions.includes( submittedAction ) ) {
				return;
			}
			event.preventDefault();

			const formData = new FormData( form );
			const uploadPath = resolveUploadPath( formData ) || <?php echo wp_json_encode( $upload_path ); ?>;

			if ( submittedAction === 'status' ) {
				setButtonsDisabled( true );
				try {
					await readSnapshot( uploadPath );
				} finally {
					setButtonsDisabled( false );
				}
				return;
			}

			const limit = Math.max( 1, Math.min( 250, parseIntOrDefault( formData.get( 'dtb_limit' ), 25 ) ) );
			const dryRun = parseBool( formData.get( 'dtb_dry_run' ) );
			const force = parseBool( formData.get( 'dtb_force' ) );
			let currentOffset = Math.max( 0, parseIntOrDefault( formData.get( 'dtb_offset' ), 0 ) );
			const startOffset = currentOffset;

			setButtonsDisabled( true );
			runner.style.display = 'block';
			logEl.textContent = '';
			setBar( 0 );
			setStatus( 'Starting…' );
			const actionLabel = submittedAction === 'register_only'
				? 'Register Images Only'
				: ( submittedAction === 'link_only' ? 'Link Registered Images' : 'Register + Link' );
			appendLog( `Starting ${actionLabel} for ${uploadPath} (limit ${limit}, offset ${currentOffset})` );

			try {
				startSnapshotPolling( uploadPath );

				if ( submittedAction === 'pipeline' ) {
					setStatus( 'Running Fix Renamed…' );
					const fixResult = await postJson( 'fix_renamed', {
						upload_path: uploadPath,
						dry_run: dryRun
					} );
					appendLog( `Fix Renamed complete · renamed ${parseIntOrDefault( fixResult.renamed, 0 )}` );
					await readSnapshot( uploadPath );
				}

				let batchCount = 0;
				const missingFiles = [];
				const syncAction = submittedAction === 'link_only' ? 'link_only' : 'sync';
				while ( true ) {
					batchCount += 1;
					if ( batchCount > MAX_BATCHES ) {
						throw new Error( 'Maximum batch limit exceeded.' );
					}
					setStatus( `Running ${actionLabel} batch ${batchCount}…` );
					if ( submittedAction !== 'link_only' ) {
						startProgressPolling();
					}
					const batch = await postJson( syncAction, {
						upload_path: uploadPath,
						dry_run: dryRun,
						force: force,
						register_only: submittedAction === 'register_only',
						limit: limit,
						offset: currentOffset
					} );
					stopProgressPolling();
					await readSnapshot( uploadPath );

					const scanned = parseIntOrDefault( batch.scanned, 0 );
					const total = Math.max( scanned, parseIntOrDefault( batch.total, 0 ) );
					const completed = Math.min( total, Math.max( 0, currentOffset - startOffset + scanned ) );
					const pct = total > 0 ? completed / total : 1;
					setBar( pct );
					const batchSummary = [
						`Batch ${batchCount} done`,
						`scanned ${scanned}`,
						`linked ${parseIntOrDefault( batch.linked, 0 )}`,
						`skipped ${parseIntOrDefault( batch.skipped, 0 )}`,
						`no_file ${parseIntOrDefault( batch.no_file, 0 )}`,
						`no_catalog_image ${parseIntOrDefault( batch.no_catalog_image, 0 )}`,
						`missing_disk_file ${parseIntOrDefault( batch.missing_disk_file, 0 )}`,
						`missing_attachments ${parseIntOrDefault( batch.missing_attachments, 0 )}`
					];
					if ( 'registered' in batch ) {
						batchSummary.push( `registered ${parseIntOrDefault( batch.registered, 0 )}` );
					}
					if ( batch.active_csv ) {
						batchSummary.push( `active_csv ${batch.active_csv}` );
					}
					if ( batch.csv_source ) {
						batchSummary.push( `csv_source ${batch.csv_source}` );
					}
					batchSummary.push( `errors ${Array.isArray( batch.errors ) ? batch.errors.length : 0}` );
					appendLog( batchSummary.join( ' · ' ) );

					if ( Array.isArray( batch.missing_files ) ) {
						batch.missing_files.forEach( ( item ) => missingFiles.push( item ) );
						batch.missing_files.slice( 0, 10 ).forEach( ( item ) => {
							const sku = item && item.sku ? item.sku : '(unknown sku)';
							const expected = Array.isArray( item.expected ) && item.expected.length
								? item.expected.join( ', ' )
								: '(no Images filename found in active CSV)';
							appendLog( `  no_file ${sku}: ${expected}` );
						} );
						if ( batch.missing_files.length > 10 ) {
							appendLog( `  ...${batch.missing_files.length - 10} more no_file SKU(s) in this batch` );
						}
					}

					if ( batch.next_offset === null || typeof batch.next_offset === 'undefined' ) {
						if ( missingFiles.length > 0 ) {
							appendLog( '' );
							appendLog( `Missing image files (${missingFiles.length}):` );
							missingFiles.forEach( ( item ) => {
								const sku = item && item.sku ? item.sku : '(unknown sku)';
								const expected = Array.isArray( item.expected ) && item.expected.length
									? item.expected.join( ', ' )
									: '(no Images filename found in catalog)';
								appendLog( `${sku}: ${expected}` );
							} );
						}
						appendLog( 'Run complete.' );
						setStatus( 'Completed successfully.' );
						setBar( 1 );
						break;
					}

					const nextOffset = Math.max( 0, parseIntOrDefault( batch.next_offset, currentOffset + scanned ) );
					if ( nextOffset < currentOffset ) {
						throw new Error( 'Sync returned a non-advancing next offset.' );
					}
					currentOffset = nextOffset;
					appendLog( `Continuing to next batch at offset ${currentOffset}…` );
				}
			} catch ( err ) {
				stopAllPolling();
				setStatus( err && err.message ? err.message : 'Run failed.', true );
				appendLog( `Error: ${err && err.message ? err.message : 'Run failed.'}` );
				await readSnapshot( uploadPath );
			} finally {
				stopAllPolling();
				await readSnapshot( uploadPath );
				setButtonsDisabled( false );
			}
		} );
	} )();
	</script>
	<?php
}

// =============================================================================
// OPS DASHBOARD ANALYTICS HELPERS
// =============================================================================

/**
 * Return status data about the last image sync run for the ops dashboard.
 *
 * @return array {
 *   last_run_at: string|null ISO-8601 timestamp,
 *   last_synced: int,
 *   last_errors: int,
 *   health: string 'ok'|'warning'|'error'|'never'
 * }
 */

