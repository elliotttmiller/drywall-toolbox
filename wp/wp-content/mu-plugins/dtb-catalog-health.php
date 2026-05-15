<?php
/**
 * DTB Catalog Health — Must-Use Plugin
 *
 * Variable Products diagnostics panel for wp-admin.
 * Lists variable products with parent/child integrity issues,
 * variation SKU gaps, and stock anomalies.  Provides:
 *
 *   - Per-product issue list with severity (error / warning / info)
 *   - Export issues as CSV
 *   - Cache flush / rebuild actions
 *   - Full-catalog integrity scan (AJAX, paged)
 *
 * Admin menu: DTB Ops → Catalog Health
 * Capability: DTB_CAP_CATALOG ('dtb_catalog')
 *
 * @package drywall-toolbox
 */

defined( 'ABSPATH' ) || exit;

if ( ! is_admin() ) {
	return;
}

// =============================================================================
// SECTION 1 — ADMIN MENU
// =============================================================================

add_action( 'admin_menu', 'dtb_catalog_health_register_menu', 20 );

function dtb_catalog_health_register_menu(): void {
	// Only register when the parent DTB Ops menu exists (loaded by dtb-ops-dashboard.php).
	if ( ! function_exists( 'dtb_ops_menu_slug' ) ) {
		add_menu_page(
			'DTB Catalog Health',
			'Catalog Health',
			DTB_CAP_CATALOG,
			'dtb-catalog-health',
			'dtb_catalog_health_render_page',
			'dashicons-chart-bar',
			58
		);
		return;
	}

	add_submenu_page(
		'dtb-ops',
		'Catalog Health',
		'Catalog Health',
		DTB_CAP_CATALOG,
		'dtb-catalog-health',
		'dtb_catalog_health_render_page'
	);
}

// =============================================================================
// SECTION 2 — ENQUEUE
// =============================================================================

add_action( 'admin_enqueue_scripts', 'dtb_catalog_health_enqueue' );

function dtb_catalog_health_enqueue( string $hook ): void {
	if ( false === strpos( $hook, 'dtb-catalog-health' ) ) {
		return;
	}

	wp_enqueue_style( 'wp-admin' );

	wp_add_inline_script( 'jquery', '
		jQuery(function($) {
			var LABELS = {
				scan:     "Scan Variable Products",
				metaScan: "Scan DTB Meta",
				flush:    "Flush Product Cache"
			};

			$(document).on("click", "#dtb-ch-scan-btn", function() {
				var $btn = $(this);
				$btn.prop("disabled", true).text("Scanning\u2026");
				$.post(ajaxurl, {
					action: "dtb_catalog_health_scan",
					nonce:  dtbCH.nonce,
					page:   1,
					per_page: 20
				}, function(res) {
					if (res.success) {
						$("#dtb-ch-results").html(res.data.html);
					} else {
						$("#dtb-ch-results").html("<p class=\'error\'>Scan failed: " + (res.data || "unknown error") + "</p>");
					}
					$btn.prop("disabled", false).text(LABELS.scan);
				}).fail(function() {
					$("#dtb-ch-results").html("<p class=\'error\'>Request failed.</p>");
					$btn.prop("disabled", false).text(LABELS.scan);
				});
			});

			$(document).on("click", "#dtb-ch-meta-scan-btn", function() {
				var $btn = $(this);
				$btn.prop("disabled", true).text("Scanning DTB Meta\u2026");
				$.post(ajaxurl, {
					action: "dtb_catalog_health_meta_scan",
					nonce:  dtbCH.nonce,
					page:   1,
					per_page: 50
				}, function(res) {
					if (res.success) {
						$("#dtb-ch-results").html("<h3>DTB Meta Scan Results</h3>" + res.data.html);
					} else {
						$("#dtb-ch-results").html("<p class=\'error\'>Meta scan failed: " + (res.data || "unknown error") + "</p>");
					}
					$btn.prop("disabled", false).text(LABELS.metaScan);
				}).fail(function() {
					$("#dtb-ch-results").html("<p class=\'error\'>Request failed.</p>");
					$btn.prop("disabled", false).text(LABELS.metaScan);
				});
			});

			$(document).on("click", "#dtb-ch-flush-btn", function() {
				var $btn = $(this);
				$btn.prop("disabled", true).text("Flushing\u2026");
				$.post(ajaxurl, {
					action: "dtb_catalog_health_flush",
					nonce:  dtbCH.nonce,
				}, function(res) {
					if (res.success) {
						alert("Cache flushed. " + res.data.message);
					} else {
						alert("Flush failed: " + (res.data || "unknown error"));
					}
					$btn.prop("disabled", false).text(LABELS.flush);
				});
			});
		});
	' );

	wp_localize_script( 'jquery', 'dtbCH', [
		'nonce' => wp_create_nonce( 'dtb_catalog_health' ),
	] );
}

// =============================================================================
// SECTION 3 — PAGE RENDER
// =============================================================================

function dtb_catalog_health_render_page(): void {
	if ( ! current_user_can( DTB_CAP_CATALOG ) ) {
		wp_die( esc_html__( 'You do not have permission to access this page.', 'drywall-toolbox' ) );
	}
	?>
	<div class="wrap">
		<h1>📊 DTB Catalog Health</h1>
		<p class="description">Scans WooCommerce variable products for parent/child integrity issues, missing variation SKUs, and stock anomalies.</p>

		<div style="display:flex;gap:10px;margin:16px 0;">
			<button id="dtb-ch-scan-btn" class="button button-primary">Scan Variable Products</button>
			<button id="dtb-ch-meta-scan-btn" class="button button-primary" style="background:#2563eb;border-color:#1d4ed8;">Scan DTB Meta</button>
			<button id="dtb-ch-flush-btn" class="button">Flush Product Cache</button>
			<a href="<?php echo esc_url( admin_url( 'admin-ajax.php?action=dtb_catalog_health_export_csv&nonce=' . wp_create_nonce( 'dtb_catalog_health' ) ) ); ?>"
			   class="button" download="dtb-catalog-health.csv">Export CSV</a>
		</div>

		<div id="dtb-ch-results" style="margin-top:20px;">
			<p style="color:#666;">Click <em>Scan Now</em> to run the catalog health check.</p>
		</div>
	</div>
	<?php
}

// =============================================================================
// SECTION 4 — AJAX: SCAN
// =============================================================================

add_action( 'wp_ajax_dtb_catalog_health_scan', 'dtb_catalog_health_ajax_scan' );

function dtb_catalog_health_ajax_scan(): void {
	check_ajax_referer( 'dtb_catalog_health', 'nonce' );

	if ( ! current_user_can( DTB_CAP_CATALOG ) ) {
		wp_send_json_error( 'Permission denied.' );
	}

	$page     = max( 1, (int) ( $_POST['page'] ?? 1 ) );
	$per_page = max( 1, min( 50, (int) ( $_POST['per_page'] ?? 20 ) ) );

	$issues = dtb_catalog_health_run_scan( $page, $per_page );
	$html   = dtb_catalog_health_render_results( $issues );

	wp_send_json_success( [ 'html' => $html ] );
}

// =============================================================================
// SECTION 5 — AJAX: FLUSH
// =============================================================================

add_action( 'wp_ajax_dtb_catalog_health_flush', 'dtb_catalog_health_ajax_flush' );

function dtb_catalog_health_ajax_flush(): void {
	check_ajax_referer( 'dtb_catalog_health', 'nonce' );

	if ( ! current_user_can( DTB_CAP_CATALOG ) ) {
		wp_send_json_error( 'Permission denied.' );
	}

	if ( function_exists( 'dtb_invalidate_product_cache' ) ) {
		dtb_invalidate_product_cache();
	}

	if ( function_exists( 'dtb_log_cache_event' ) ) {
		dtb_log_cache_event( 'admin_catalog_health_flush', [ 'user_id' => get_current_user_id() ] );
	}

	wp_send_json_success( [ 'message' => 'Product cache flushed successfully.' ] );
}

// =============================================================================
// SECTION 6 — AJAX: EXPORT CSV
// =============================================================================

add_action( 'wp_ajax_dtb_catalog_health_export_csv', 'dtb_catalog_health_ajax_export_csv' );

function dtb_catalog_health_ajax_export_csv(): void {
	check_ajax_referer( 'dtb_catalog_health', 'nonce' );

	if ( ! current_user_can( DTB_CAP_CATALOG ) ) {
		wp_die( 'Permission denied.' );
	}

	$issues = dtb_catalog_health_run_scan( 1, 100 );

	header( 'Content-Type: text/csv; charset=utf-8' );
	header( 'Content-Disposition: attachment; filename="dtb-catalog-health-' . gmdate( 'Y-m-d' ) . '.csv"' );
	header( 'Pragma: no-cache' );

	$out = fopen( 'php://output', 'w' ); // phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_fopen
	fputcsv( $out, [ 'Product ID', 'Product Name', 'SKU', 'Issue Severity', 'Issue Code', 'Message', 'Edit URL' ] );

	foreach ( $issues as $issue ) {
		fputcsv( $out, [
			$issue['product_id'],
			$issue['product_name'],
			$issue['sku'],
			$issue['severity'],
			$issue['code'],
			$issue['message'],
			get_edit_post_link( $issue['product_id'], '' ),
		] );
	}

	fclose( $out ); // phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_fclose
	exit;
}

// =============================================================================
// SECTION 7 — SCAN LOGIC
// =============================================================================

/**
 * Run the catalog health scan and return a flat array of issue records.
 *
 * @param int $page     Page number (1-based).
 * @param int $per_page Products per page.
 * @return array        Array of issue records.
 */
function dtb_catalog_health_run_scan( int $page, int $per_page ): array {
	$issues = [];

	$query = new WP_Query( [
		'post_type'      => 'product',
		'post_status'    => 'publish',
		'posts_per_page' => $per_page,
		'paged'          => $page,
		'tax_query'      => [ // phpcs:ignore WordPress.DB.SlowDBQuery.slow_db_query_tax_query
			[
				'taxonomy' => 'product_type',
				'field'    => 'slug',
				'terms'    => 'variable',
			],
		],
		'fields'         => 'ids',
	] );

	foreach ( $query->posts as $product_id ) {
		$product = wc_get_product( $product_id );
		if ( ! $product instanceof WC_Product_Variable ) {
			continue;
		}

		$product_name = $product->get_name();
		$parent_sku   = $product->get_sku();

		// Get all variation IDs — including out-of-stock and draft.
		$variation_ids = $product->get_children();

		// ── Issue: No child variations ─────────────────────────────────────────
		if ( empty( $variation_ids ) ) {
			$issues[] = [
				'product_id'   => $product_id,
				'product_name' => $product_name,
				'sku'          => $parent_sku,
				'severity'     => 'error',
				'code'         => 'variable_parent_no_children',
				'message'      => 'Variable product has no child variations.',
			];
			continue;
		}

		// ── Variation-level checks ─────────────────────────────────────────────
		$has_at_least_one_purchasable = false;
		$attributes = $product->get_variation_attributes();

		foreach ( $variation_ids as $var_id ) {
			$variation = wc_get_product( $var_id );
			if ( ! $variation instanceof WC_Product_Variation ) {
				continue;
			}

			$var_sku         = $variation->get_sku();
			$var_stock       = $variation->get_stock_status();
			$var_purchasable = $variation->is_purchasable();
			$var_price       = $variation->get_price();
			$var_attrs       = $variation->get_attributes();

			if ( $var_purchasable && 'instock' === $var_stock ) {
				$has_at_least_one_purchasable = true;
			}

			// Issue: Missing variation SKU
			if ( '' === $var_sku ) {
				$issues[] = [
					'product_id'   => $product_id,
					'product_name' => $product_name,
					'sku'          => "var#{$var_id}",
					'severity'     => 'error',
					'code'         => 'variation_missing_sku',
					'message'      => "Variation #{$var_id} has no SKU. Veeqo/QuickBooks sync will be blocked.",
				];
			}

			// Issue: Purchasable variation missing price
			if ( $var_purchasable && ( '' === $var_price || null === $var_price ) ) {
				$issues[] = [
					'product_id'   => $product_id,
					'product_name' => $product_name,
					'sku'          => $var_sku ?: "var#{$var_id}",
					'severity'     => 'error',
					'code'         => 'variation_missing_price',
					'message'      => "Variation #{$var_id} ({$var_sku}) is purchasable but has no price.",
				];
			}

			// Issue: Variation missing attribute values
			if ( empty( $var_attrs ) && ! empty( $attributes ) ) {
				$issues[] = [
					'product_id'   => $product_id,
					'product_name' => $product_name,
					'sku'          => $var_sku ?: "var#{$var_id}",
					'severity'     => 'error',
					'code'         => 'variation_missing_attribute_values',
					'message'      => "Variation #{$var_id} ({$var_sku}) has no attribute values assigned.",
				];
			}
		}

		// Issue: No purchasable in-stock variation
		if ( ! $has_at_least_one_purchasable ) {
			$issues[] = [
				'product_id'   => $product_id,
				'product_name' => $product_name,
				'sku'          => $parent_sku,
				'severity'     => 'warning',
				'code'         => 'no_purchasable_variations',
				'message'      => 'Variable product has no purchasable in-stock variations.',
			];
		}

		// Issue: Parent SKU missing
		if ( '' === $parent_sku ) {
			$issues[] = [
				'product_id'   => $product_id,
				'product_name' => $product_name,
				'sku'          => '(none)',
				'severity'     => 'warning',
				'code'         => 'parent_missing_sku',
				'message'      => 'Variable parent product has no SKU.',
			];
		}
	}

	return $issues;
}

// =============================================================================
// SECTION 8 — RENDER HELPERS
// =============================================================================

/**
 * Render the issues table HTML.
 *
 * @param array $issues Array of issue records.
 * @return string       HTML string.
 */
function dtb_catalog_health_render_results( array $issues ): string {
	if ( empty( $issues ) ) {
		return '<div style="padding:16px;background:#edfcf2;border:1px solid #86efac;border-radius:6px;color:#14532d;">
			✅ <strong>No issues found.</strong> All scanned variable products passed the health check.
		</div>';
	}

	$error_count   = count( array_filter( $issues, fn( $i ) => 'error'   === $i['severity'] ) );
	$warning_count = count( array_filter( $issues, fn( $i ) => 'warning' === $i['severity'] ) );

	$badge = fn( string $severity ) => match ( $severity ) {
		'error'   => '<span style="background:#fef2f2;color:#dc2626;border:1px solid #fca5a5;padding:2px 8px;border-radius:4px;font-size:0.7rem;font-weight:700;">ERROR</span>',
		'warning' => '<span style="background:#fffbeb;color:#d97706;border:1px solid #fcd34d;padding:2px 8px;border-radius:4px;font-size:0.7rem;font-weight:700;">WARNING</span>',
		default   => '<span style="background:#f0f9ff;color:#0284c7;border:1px solid #7dd3fc;padding:2px 8px;border-radius:4px;font-size:0.7rem;font-weight:700;">INFO</span>',
	};

	ob_start();
	?>
	<div style="background:#fef2f2;border:1px solid #fca5a5;border-radius:6px;padding:12px 16px;margin-bottom:16px;">
		Found <strong><?php echo esc_html( count( $issues ) ); ?> issue(s)</strong>:
		<?php if ( $error_count ) : ?>
			<strong style="color:#dc2626;"><?php echo esc_html( $error_count ); ?> error(s)</strong>
		<?php endif; ?>
		<?php if ( $warning_count ) : ?>
			<strong style="color:#d97706;"><?php echo esc_html( $warning_count ); ?> warning(s)</strong>
		<?php endif; ?>
	</div>

	<table class="wp-list-table widefat fixed striped" style="margin-top:0;">
		<thead>
			<tr>
				<th style="width:40px;">ID</th>
				<th>Product</th>
				<th style="width:110px;">SKU</th>
				<th style="width:80px;">Severity</th>
				<th style="width:200px;">Code</th>
				<th>Message</th>
				<th style="width:60px;">Action</th>
			</tr>
		</thead>
		<tbody>
			<?php foreach ( $issues as $issue ) : ?>
				<tr>
					<td><?php echo esc_html( $issue['product_id'] ); ?></td>
					<td><strong><?php echo esc_html( $issue['product_name'] ); ?></strong></td>
					<td><code><?php echo esc_html( $issue['sku'] ); ?></code></td>
					<td><?php echo wp_kses_post( $badge( $issue['severity'] ) ); ?></td>
					<td><code style="font-size:0.72rem;"><?php echo esc_html( $issue['code'] ); ?></code></td>
					<td><?php echo esc_html( $issue['message'] ); ?></td>
					<td>
						<a href="<?php echo esc_url( get_edit_post_link( $issue['product_id'] ) ); ?>"
						   class="button button-small" target="_blank" rel="noopener">Edit</a>
					</td>
				</tr>
			<?php endforeach; ?>
		</tbody>
	</table>
	<?php
	return ob_get_clean();
}

// =============================================================================
// SECTION 9 — DTB META SCAN
// =============================================================================
// Checks that every published product carries the canonical _dtb_* meta fields
// required by the catalog platform read model.
// =============================================================================

add_action( 'wp_ajax_dtb_catalog_health_meta_scan', 'dtb_catalog_health_ajax_meta_scan' );

function dtb_catalog_health_ajax_meta_scan(): void {
	check_ajax_referer( 'dtb_catalog_health', 'nonce' );

	if ( ! current_user_can( DTB_CAP_CATALOG ) ) {
		wp_send_json_error( 'Permission denied.' );
	}

	$page     = max( 1, (int) ( $_POST['page']     ?? 1 ) );
	$per_page = max( 1, min( 50, (int) ( $_POST['per_page'] ?? 20 ) ) );

	$issues = dtb_catalog_health_run_dtb_meta_scan( $page, $per_page );
	$html   = dtb_catalog_health_render_results( $issues );

	wp_send_json_success( [
		'html'       => $html,
		'page'       => $page,
		'issueCount' => count( $issues ),
	] );
}

/**
 * Scan all published products for missing or incomplete DTB catalog meta.
 *
 * Error-level issues (blocking for catalog read model):
 *   dtb_missing_brand_key      — _dtb_brand_key is absent
 *   dtb_missing_category_key   — _dtb_category_key is absent
 *
 * Warning-level issues:
 *   dtb_builder_missing_family — builder_eligible=1 but _dtb_tool_family absent
 *   dtb_builder_missing_slots  — builder_eligible=1 but _dtb_builder_slots absent
 *   dtb_missing_default_var    — variable parent missing _dtb_default_variation_id
 *   dtb_missing_product_kind   — _dtb_product_kind is absent
 *
 * @param  int $page
 * @param  int $per_page
 * @return array[]
 */
function dtb_catalog_health_run_dtb_meta_scan( int $page, int $per_page ): array {
	$issues = [];

	$query = new WP_Query( [
		'post_type'      => 'product',
		'post_status'    => 'publish',
		'posts_per_page' => $per_page,
		'paged'          => $page,
		'fields'         => 'ids',
		'no_found_rows'  => false,
	] );

	foreach ( $query->posts as $product_id ) {
		$product = wc_get_product( $product_id );
		if ( ! $product ) {
			continue;
		}

		$name = $product->get_name();
		$sku  = $product->get_sku();

		$brand_key       = (string) get_post_meta( $product_id, '_dtb_brand_key',            true );
		$category_key    = (string) get_post_meta( $product_id, '_dtb_category_key',         true );
		$product_kind    = (string) get_post_meta( $product_id, '_dtb_product_kind',         true );
		$tool_family     = (string) get_post_meta( $product_id, '_dtb_tool_family',          true );
		$builder_eligible= (string) get_post_meta( $product_id, '_dtb_builder_eligible',    true );
		$builder_slots   = (string) get_post_meta( $product_id, '_dtb_builder_slots',        true );
		$default_var_id  = (string) get_post_meta( $product_id, '_dtb_default_variation_id', true );

		// Error: missing brand key.
		if ( '' === $brand_key ) {
			$issues[] = [
				'product_id'   => $product_id,
				'product_name' => $name,
				'sku'          => $sku ?: '(none)',
				'severity'     => 'error',
				'code'         => 'dtb_missing_brand_key',
				'message'      => 'Product is published but has no _dtb_brand_key. Catalog facets and filters will not include this product.',
			];
		}

		// Error: missing category key.
		if ( '' === $category_key ) {
			$issues[] = [
				'product_id'   => $product_id,
				'product_name' => $name,
				'sku'          => $sku ?: '(none)',
				'severity'     => 'error',
				'code'         => 'dtb_missing_category_key',
				'message'      => 'Product is published but has no _dtb_category_key. Category filters and display routing will not work.',
			];
		}

		// Warning: missing product kind.
		if ( '' === $product_kind ) {
			$issues[] = [
				'product_id'   => $product_id,
				'product_name' => $name,
				'sku'          => $sku ?: '(none)',
				'severity'     => 'warning',
				'code'         => 'dtb_missing_product_kind',
				'message'      => 'Product is missing _dtb_product_kind (tool/part/accessory/service/kit). Toolset Builder eligibility may be inaccurate.',
			];
		}

		// Warning: builder eligible but missing tool family.
		if ( '1' === $builder_eligible && '' === $tool_family ) {
			$issues[] = [
				'product_id'   => $product_id,
				'product_name' => $name,
				'sku'          => $sku ?: '(none)',
				'severity'     => 'warning',
				'code'         => 'dtb_builder_missing_family',
				'message'      => 'Product is marked builder-eligible (_dtb_builder_eligible=1) but has no _dtb_tool_family. Toolset slot matching will fall back to keyword inference.',
			];
		}

		// Warning: builder eligible but missing slots.
		if ( '1' === $builder_eligible && '' === $builder_slots ) {
			$issues[] = [
				'product_id'   => $product_id,
				'product_name' => $name,
				'sku'          => $sku ?: '(none)',
				'severity'     => 'warning',
				'code'         => 'dtb_builder_missing_slots',
				'message'      => 'Product is marked builder-eligible but has no _dtb_builder_slots. It will not appear in any Toolset Builder slot.',
			];
		}

		// Warning: variable parent missing default variation ID.
		if ( $product->is_type( 'variable' ) && '' === $default_var_id ) {
			$issues[] = [
				'product_id'   => $product_id,
				'product_name' => $name,
				'sku'          => $sku ?: '(none)',
				'severity'     => 'warning',
				'code'         => 'dtb_missing_default_var',
				'message'      => 'Variable parent product has no _dtb_default_variation_id. Product cards will fall back to automatic default variation resolution.',
			];
		}

		// Warning: variable parent — default variation ID invalid.
		if ( $product->is_type( 'variable' ) && '' !== $default_var_id ) {
			$var_product = wc_get_product( (int) $default_var_id );
			if ( ! $var_product || ! in_array( (int) $default_var_id, $product->get_children(), true ) ) {
				$issues[] = [
					'product_id'   => $product_id,
					'product_name' => $name,
					'sku'          => $sku ?: '(none)',
					'severity'     => 'warning',
					'code'         => 'dtb_invalid_default_var',
					'message'      => sprintf(
						'_dtb_default_variation_id (%s) does not belong to this product.',
						esc_html( $default_var_id )
					),
				];
			}
		}
	}

	return $issues;
}

