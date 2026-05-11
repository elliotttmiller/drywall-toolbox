<?php
/**
 * DTB Cache Admin Page — Must-Use Plugin
 *
 * Adds a "Cache" submenu under Tools in wp-admin where admins can:
 *   • View cache statistics
 *   • Clear all product cache
 *   • View recent cache events
 *
 * Integrates with dtb-cache.php transient-based caching system.
 *
 * @package drywall-toolbox
 */

defined( 'ABSPATH' ) || exit;

// Only load on admin pages
if ( ! is_admin() ) {
	return;
}

// =============================================================================
// ADMIN MENU
// =============================================================================

add_action( 'admin_menu', 'dtb_add_cache_admin_page' );

/**
 * Register the Cache page under Tools menu.
 */
function dtb_add_cache_admin_page(): void {
	add_management_page(
		'Drywall Toolbox Cache',           // Page title
		'DTB Cache',                       // Menu title
		'manage_options',                  // Capability
		'dtb-cache-settings',              // Menu slug
		'dtb_render_cache_admin_page'      // Callback
	);
}

// =============================================================================
// ADMIN PAGE RENDER
// =============================================================================

/**
 * Render the cache admin page.
 */
function dtb_render_cache_admin_page(): void {
	// Security check
	if ( ! current_user_can( 'manage_options' ) ) {
		wp_die( 'Unauthorized' );
	}

	// Handle form submission (clear cache button or flush module cache)
	if ( isset( $_POST['dtb_cache_action'] ) && wp_verify_nonce( $_POST['dtb_cache_nonce'] ?? '', 'dtb_cache_admin' ) ) {
		if ( 'clear_cache' === $_POST['dtb_cache_action'] ) {
			dtb_invalidate_product_cache();
			echo '<div class="notice notice-success"><p>✅ Product cache cleared successfully.</p></div>';
		} elseif ( 'flush_module' === $_POST['dtb_cache_action'] ) {
			$module = sanitize_key( $_POST['dtb_cache_module'] ?? 'all' );
			if ( 'all' === $module ) {
				dtb_invalidate_product_cache();
				echo '<div class="notice notice-success"><p>✅ All cache cleared successfully.</p></div>';
			} elseif ( function_exists( 'dtb_ops_cache_flush' ) ) {
				dtb_ops_cache_flush( $module );
				echo '<div class="notice notice-success"><p>✅ ' . esc_html( $module ) . ' module cache flushed.</p></div>';
			} else {
				dtb_invalidate_product_cache();
				echo '<div class="notice notice-success"><p>✅ Product cache cleared (ops cache not available).</p></div>';
			}
		}
	}

	// Get cache statistics
	$log = dtb_get_cache_log();
	$last_invalidated = null;

	foreach ( $log as $entry ) {
		if ( 'cache_invalidated' === ( $entry['event'] ?? '' ) ) {
			if ( ! $last_invalidated ) {
				$last_invalidated = $entry['timestamp'];
			}
			break;
		}
	}

	?>
	<div class="wrap">
		<h1><?php echo esc_html( get_admin_page_title() ); ?></h1>

		<!-- Cache Statistics -->
		<div class="card" style="max-width: 100%; margin: 20px 0;">
			<h2 style="margin-top: 0;">Cache Statistics</h2>
			<table class="wp-list-table" style="width: 100%;">
				<tbody>
					<tr>
						<td><strong>Last Invalidated:</strong></td>
						<td><?php echo $last_invalidated ? esc_html( $last_invalidated ) : '(never)'; ?></td>
					</tr>
					<tr>
						<td><strong>Cache Entries in Log:</strong></td>
						<td><?php echo count( $log ); ?>/50</td>
					</tr>
				</tbody>
			</table>
		</div>

		<!-- Clear Cache Button -->
		<div class="card" style="max-width: 100%; margin: 20px 0; padding: 20px;">
			<h2 style="margin-top: 0;">Cache Management</h2>
			<p>Clear all product catalog transients and reset the cache.</p>
			<form method="post" action="">
				<?php wp_nonce_field( 'dtb_cache_admin', 'dtb_cache_nonce' ); ?>
				<input type="hidden" name="dtb_cache_action" value="clear_cache" />
				<button type="submit" class="button button-primary" onclick="return confirm('Clear all cached data? This will force fresh API calls on next page load.');">
					🗑️ Clear All Cache
				</button>
			</form>
		</div>

		<!-- Flush Module Cache -->
		<div class="card" style="max-width: 100%; margin: 20px 0; padding: 20px;">
			<h2 style="margin-top: 0;">Flush Module Cache</h2>
			<p>Flush the ops cache for a specific module, or select <em>All</em> to clear everything.</p>
			<form method="post" action="">
				<?php wp_nonce_field( 'dtb_cache_admin', 'dtb_cache_nonce' ); ?>
				<input type="hidden" name="dtb_cache_action" value="flush_module" />
				<select name="dtb_cache_module" style="margin-right: 8px;">
					<option value="all">All</option>
					<option value="veeqo">Veeqo</option>
					<option value="orders">Orders</option>
					<option value="inventory">Inventory</option>
					<option value="repairs">Repairs</option>
					<option value="kpis">KPIs</option>
				</select>
				<button type="submit" class="button button-secondary">
					♻️ Flush Module Cache
				</button>
			</form>
		</div>

		<!-- Recent Cache Events -->
		<div class="card" style="max-width: 100%; margin: 20px 0;">
			<h2 style="margin-top: 0;">Recent Cache Events</h2>
			<?php if ( ! empty( $log ) ) : ?>
				<table class="wp-list-table widefat striped">
					<thead>
						<tr>
							<th>Timestamp</th>
							<th>Event</th>
							<th>Details</th>
						</tr>
					</thead>
					<tbody>
						<?php foreach ( array_slice( $log, 0, 20 ) as $entry ) : ?>
							<tr>
								<td><code><?php echo esc_html( $entry['timestamp'] ?? '—' ); ?></code></td>
								<td>
									<?php
										$event = $entry['event'] ?? 'unknown';
										echo esc_html( $event );
										if ( 'cache_invalidated' === $event ) {
											echo ' <span style="color: #d63638;">●</span>';
										}
									?>
								</td>
								<td>
									<?php
										if ( ! empty( $entry['context'] ) ) {
											echo '<code style="font-size: 11px;">' . esc_html( wp_json_encode( $entry['context'], JSON_PRETTY_PRINT ) ) . '</code>';
										}
									?>
								</td>
							</tr>
						<?php endforeach; ?>
					</tbody>
				</table>
			<?php else : ?>
				<p><em>No cache events yet.</em></p>
			<?php endif; ?>
		</div>

		<!-- About DTB Cache -->
		<div class="card" style="max-width: 100%; margin: 20px 0; background: #f5f5f5;">
			<h3>About DTB Cache</h3>
			<p>
				The Drywall Toolbox cache system automatically stores and expires product catalog
				data fetched from the WooCommerce REST API. Cache TTL:
			</p>
			<ul style="margin-left: 20px;">
				<li><strong>Categories & Attributes:</strong> 15 minutes</li>
				<li><strong>Products & Search:</strong> 10 minutes</li>
			</ul>
			<p>
				Cache is automatically invalidated when WooCommerce product events occur
				(via webhooks), or you can manually clear it above.
			</p>
		</div>
	</div>
	<?php
}
