<?php
/**
 * Catalog Health admin page shell.
 *
 * @package drywall-toolbox
 */

defined( 'ABSPATH' ) || exit;

if ( ! is_admin() ) {
	return;
}

add_action( 'admin_menu', 'dtb_catalog_health_register_menu', 20 );

/**
 * Register the Catalog Health admin page.
 */
function dtb_catalog_health_register_menu(): void {
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

add_action( 'admin_enqueue_scripts', 'dtb_catalog_health_enqueue' );

/**
 * Enqueue Catalog Health inline admin behavior.
 *
 * @param string $hook Current admin page hook.
 */
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
				$btn.prop("disabled", true).text("Scanning\\u2026");
				$.post(ajaxurl, {
					action: "dtb_catalog_health_scan",
					nonce:  dtbCH.nonce,
					page:   1,
					per_page: 20
				}, function(res) {
					if (res.success) {
						$("#dtb-ch-results").html(res.data.html);
					} else {
						$("#dtb-ch-results").html("<p class=\\"error\\">Scan failed: " + (res.data || "unknown error") + "</p>");
					}
					$btn.prop("disabled", false).text(LABELS.scan);
				}).fail(function() {
					$("#dtb-ch-results").html("<p class=\\"error\\">Request failed.</p>");
					$btn.prop("disabled", false).text(LABELS.scan);
				});
			});

			$(document).on("click", "#dtb-ch-meta-scan-btn", function() {
				var $btn = $(this);
				$btn.prop("disabled", true).text("Scanning DTB Meta\\u2026");
				$.post(ajaxurl, {
					action: "dtb_catalog_health_meta_scan",
					nonce:  dtbCH.nonce,
					page:   1,
					per_page: 50
				}, function(res) {
					if (res.success) {
						$("#dtb-ch-results").html("<h3>DTB Meta Scan Results</h3>" + res.data.html);
					} else {
						$("#dtb-ch-results").html("<p class=\\"error\\">Meta scan failed: " + (res.data || "unknown error") + "</p>");
					}
					$btn.prop("disabled", false).text(LABELS.metaScan);
				}).fail(function() {
					$("#dtb-ch-results").html("<p class=\\"error\\">Request failed.</p>");
					$btn.prop("disabled", false).text(LABELS.metaScan);
				});
			});

			$(document).on("click", "#dtb-ch-flush-btn", function() {
				var $btn = $(this);
				$btn.prop("disabled", true).text("Flushing\\u2026");
				$.post(ajaxurl, {
					action: "dtb_catalog_health_flush",
					nonce:  dtbCH.nonce
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

/**
 * Render the Catalog Health page shell.
 */
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
