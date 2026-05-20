<?php
defined( 'ABSPATH' ) || exit;

function dtb_schematics_render_page() {
	$nonce        = wp_create_nonce( 'dtb_schematics_nonce' );
	$brands       = DTB_BRANDS;
	$manifest_age = '';
	$transient    = get_option( '_transient_timeout_' . DTB_MANIFEST_TRANSIENT );
	if ( $transient ) {
		$expires_in   = $transient - time();
		$manifest_age = $expires_in > 0 ? 'Manifest cache expires in ' . human_time_diff( time(), $transient ) : 'Manifest cache expired.';
	} else {
		$manifest_age = 'No manifest cache found — will be generated on next request.';
	}
	?>
	<div class="wrap dtb-schematics">
		<h1 class="wp-heading-inline">Schematics Manager</h1>
		<hr class="wp-header-end">

		<style>
			.dtb-schematics { max-width:1100px; }
			.dtb-tabs { display:flex; gap:0; border-bottom:2px solid #dcdcde; margin:16px 0 0; }
			.dtb-tab { padding:10px 18px; cursor:pointer; font-size:13px; font-weight:600; color:#787c82; border:2px solid transparent; border-bottom:none; margin-bottom:-2px; border-radius:3px 3px 0 0; background:transparent; }
			.dtb-tab.active { color:#1d2327; border-color:#dcdcde; border-bottom-color:#fff; background:#fff; }
			.dtb-tab-panel { display:none; }
			.dtb-tab-panel.active { display:block; }
			.dtb-card { background:#fff; border:1px solid #dcdcde; border-radius:0 4px 4px 4px; padding:20px 24px; margin-bottom:16px; }
			.dtb-toolbar { display:flex; gap:10px; align-items:center; flex-wrap:wrap; margin-bottom:16px; }
			.dtb-btn { display:inline-flex; align-items:center; gap:5px; padding:7px 14px; border-radius:3px; font-size:13px; font-weight:600; cursor:pointer; border:1px solid transparent; }
			.dtb-btn-primary { background:#2271b1; color:#fff; border-color:#2271b1; }
			.dtb-btn-primary:hover { background:#135e96; border-color:#135e96; color:#fff; }
			.dtb-btn-secondary { background:#f6f7f7; color:#2c3338; border-color:#c3c4c7; }
			.dtb-btn-secondary:hover { background:#f0f0f1; }
			.dtb-btn-danger { background:#fff; color:#d63638; border-color:#d63638; }
			.dtb-btn-danger:hover { background:#d63638; color:#fff; }
			.dtb-btn:disabled { opacity:.5; cursor:not-allowed; }
			.dtb-select, .dtb-input { padding:5px 9px; border:1px solid #c3c4c7; border-radius:3px; font-size:13px; }
			.dtb-tbl { width:100%; border-collapse:collapse; font-size:13px; }
			.dtb-tbl th { text-align:left; padding:9px 12px; border-bottom:2px solid #dcdcde; background:#f6f7f7; font-weight:600; }
			.dtb-tbl td { padding:9px 12px; border-bottom:1px solid #f0f0f1; vertical-align:middle; }
			.dtb-tbl tr:last-child td { border-bottom:0; }
			.dtb-tbl tr:hover td { background:#fafafa; }
			.dtb-thumb { width:56px; height:56px; object-fit:contain; border:1px solid #dcdcde; border-radius:3px; background:#f6f7f7; cursor:pointer; }
			.dtb-thumb-placeholder { width:56px; height:56px; background:#f6f7f7; border:1px solid #dcdcde; border-radius:3px; display:flex; align-items:center; justify-content:center; color:#c3c4c7; font-size:22px; }
			.dtb-badge-brand { display:inline-block; padding:2px 8px; border-radius:20px; font-size:11px; font-weight:600; background:#e8f4fd; color:#1d6fa4; }
			.dtb-link-chips { display:flex; flex-wrap:wrap; gap:4px; }
			.dtb-chip { display:inline-flex; align-items:center; gap:4px; padding:2px 8px; background:#f0f0f1; border-radius:20px; font-size:11px; }
			.dtb-chip-remove { cursor:pointer; color:#d63638; font-weight:700; background:none; border:none; padding:0; line-height:1; }
			.dtb-modal-overlay { display:none; position:fixed; inset:0; background:rgba(0,0,0,.55); z-index:100000; align-items:center; justify-content:center; }
			.dtb-modal-overlay.open { display:flex; }
			.dtb-modal { background:#fff; border-radius:6px; padding:28px 32px; max-width:620px; width:90%; max-height:90vh; overflow-y:auto; position:relative; box-shadow:0 8px 32px rgba(0,0,0,.22); }
			.dtb-modal h2 { margin:0 0 16px; font-size:16px; }
			.dtb-modal-close { position:absolute; top:14px; right:16px; font-size:20px; cursor:pointer; background:none; border:none; color:#787c82; }
			.dtb-form-row { margin-bottom:14px; }
			.dtb-form-row label { font-size:12px; font-weight:600; display:block; margin-bottom:4px; color:#3c434a; }
			.dtb-form-row input[type=text], .dtb-form-row input[type=number], .dtb-form-row select, .dtb-form-row textarea { width:100%; padding:6px 10px; border:1px solid #c3c4c7; border-radius:3px; font-size:13px; box-sizing:border-box; }
			.dtb-form-row textarea { resize:vertical; min-height:70px; }
			.dtb-product-search-wrap { position:relative; }
			.dtb-product-dropdown { position:absolute; top:100%; left:0; right:0; background:#fff; border:1px solid #c3c4c7; border-top:0; border-radius:0 0 3px 3px; z-index:100; max-height:200px; overflow-y:auto; display:none; }
			.dtb-product-dropdown li { padding:8px 12px; cursor:pointer; font-size:13px; list-style:none; }
			.dtb-product-dropdown li:hover { background:#f0f0f1; }
			.dtb-product-dropdown ul { margin:0; padding:0; }
			.dtb-linked-products { display:flex; flex-wrap:wrap; gap:6px; margin-top:8px; }
			.dtb-media-preview { margin-top:8px; }
			.dtb-media-preview img { max-width:120px; max-height:120px; border:1px solid #dcdcde; border-radius:3px; }
			.dtb-manifest-status { font-size:13px; color:#787c82; padding:8px 0; }
			.dtb-pagination { display:flex; align-items:center; gap:8px; margin-top:14px; font-size:13px; }
			#dtb-list-loading { color:#787c82; padding:20px 0; text-align:center; }
		</style>

		<!-- Tabs -->
		<div class="dtb-tabs">
			<button class="dtb-tab active" data-tab="list">All Schematics</button>
			<button class="dtb-tab" data-tab="add">Add Schematic</button>
			<button class="dtb-tab" data-tab="manifest">Manifest</button>
		</div>

		<!-- Tab: List -->
		<div id="dtb-tab-list" class="dtb-tab-panel active">
			<div class="dtb-card">
				<div class="dtb-toolbar">
					<select id="dtb-filter-brand" class="dtb-select">
						<option value="">All Brands</option>
						<?php foreach ( $brands as $b ) : ?>
							<option value="<?php echo esc_attr( $b ); ?>"><?php echo esc_html( $b ); ?></option>
						<?php endforeach; ?>
					</select>
					<input type="text" id="dtb-filter-search" class="dtb-input" placeholder="Search model number or name…" style="min-width:220px;">
					<button id="dtb-btn-search" class="dtb-btn dtb-btn-secondary">
						<span class="dashicons dashicons-search" style="font-size:15px;"></span> Search
					</button>
					<span id="dtb-list-count" style="color:#787c82;font-size:13px;margin-left:auto;"></span>
				</div>
				<div id="dtb-list-loading">Loading schematics…</div>
				<div id="dtb-list-container" style="display:none;">
					<table class="dtb-tbl">
						<thead>
							<tr>
								<th>Image</th>
								<th>Brand</th>
								<th>Model</th>
								<th>Name</th>
								<th>Parts</th>
								<th>Linked Products</th>
								<th>Actions</th>
							</tr>
						</thead>
						<tbody id="dtb-list-body"></tbody>
					</table>
					<div class="dtb-pagination" id="dtb-pagination"></div>
				</div>
				<div id="dtb-list-empty" style="display:none;color:#787c82;padding:20px 0;">No schematics found.</div>
			</div>
		</div>

		<!-- Tab: Add -->
		<div id="dtb-tab-add" class="dtb-tab-panel">
			<div class="dtb-card" style="max-width:600px;">
				<h3 style="margin-top:0;">Register a Schematic from Media Library</h3>
				<p style="color:#787c82;font-size:13px;margin-top:0;">Select an existing image from the WP Media Library (WebP preferred), then fill in the schematic metadata below.</p>

				<div class="dtb-form-row">
					<label>Schematic Image</label>
					<div style="display:flex;gap:10px;align-items:center;">
						<button id="dtb-add-select-media" class="dtb-btn dtb-btn-secondary">
							<span class="dashicons dashicons-upload" style="font-size:15px;"></span> Select from Media Library
						</button>
						<span id="dtb-add-filename" style="color:#787c82;font-size:12px;"></span>
					</div>
					<input type="hidden" id="dtb-add-attachment-id">
					<div class="dtb-media-preview" id="dtb-add-preview"></div>
				</div>

				<div class="dtb-form-row">
					<label>Brand <span style="color:#d63638;">*</span></label>
					<select id="dtb-add-brand" class="dtb-select" style="width:100%;">
						<option value="">— Select Brand —</option>
						<?php foreach ( $brands as $b ) : ?>
							<option value="<?php echo esc_attr( $b ); ?>"><?php echo esc_html( $b ); ?></option>
						<?php endforeach; ?>
					</select>
				</div>
				<div class="dtb-form-row">
					<label>Model Number <span style="color:#d63638;">*</span></label>
					<input type="text" id="dtb-add-model-number" placeholder="e.g. AT-EX">
				</div>
				<div class="dtb-form-row">
					<label>Model Name</label>
					<input type="text" id="dtb-add-model-name" placeholder="e.g. Automatic Taper">
				</div>
				<div class="dtb-form-row">
					<label>Part Count</label>
					<input type="number" id="dtb-add-part-count" placeholder="0" min="0" style="width:120px;">
				</div>
				<div class="dtb-form-row">
					<label>Notes</label>
					<textarea id="dtb-add-notes" placeholder="Optional internal notes…"></textarea>
				</div>
				<div class="dtb-form-row">
					<label>Linked Products</label>
					<div class="dtb-product-search-wrap">
						<input type="text" id="dtb-add-product-search" class="dtb-input" placeholder="Search products by name or SKU…" style="width:100%;">
						<div class="dtb-product-dropdown" id="dtb-add-product-dropdown"><ul></ul></div>
					</div>
					<div class="dtb-linked-products" id="dtb-add-linked-products"></div>
					<input type="hidden" id="dtb-add-product-ids" value="">
				</div>
				<button id="dtb-btn-add-save" class="dtb-btn dtb-btn-primary" style="margin-top:6px;">
					<span class="dashicons dashicons-yes" style="font-size:15px;"></span> Register Schematic
				</button>
				<span id="dtb-add-spinner" style="display:none;margin-left:8px;"><span class="spinner is-active" style="float:none;margin:0;"></span></span>
				<div id="dtb-add-msg" style="margin-top:10px;font-size:13px;"></div>
			</div>
		</div>

		<!-- Tab: Manifest -->
		<div id="dtb-tab-manifest" class="dtb-tab-panel">
			<div class="dtb-card" style="max-width:600px;">
				<h3 style="margin-top:0;">Manifest Cache</h3>
				<p class="dtb-manifest-status" id="dtb-manifest-status"><?php echo esc_html( $manifest_age ); ?></p>
				<p style="font-size:13px;color:#787c82;margin-top:0;">
					The manifest is a cached JSON response served to the React SPA at <code><?php echo esc_html( rest_url( 'dtb/v1/schematics/manifest' ) ); ?></code>.
					It is rebuilt automatically on the next request after being purged. Purge it after adding or updating schematics to push changes to the frontend immediately.
				</p>
				<button id="dtb-btn-purge" class="dtb-btn dtb-btn-secondary">
					<span class="dashicons dashicons-trash" style="font-size:15px;"></span> Purge Manifest Cache
				</button>
				<span id="dtb-purge-spinner" style="display:none;margin-left:8px;"><span class="spinner is-active" style="float:none;margin:0;"></span></span>
				<div id="dtb-purge-msg" style="margin-top:10px;font-size:13px;"></div>
			</div>
		</div>

	</div>

	<!-- Edit Modal -->
	<div class="dtb-modal-overlay" id="dtb-edit-modal">
		<div class="dtb-modal">
			<button class="dtb-modal-close" id="dtb-modal-close">✕</button>
			<h2 id="dtb-edit-modal-title">Edit Schematic</h2>
			<input type="hidden" id="dtb-edit-id">
			<div class="dtb-form-row">
				<label>Current Image</label>
				<div id="dtb-edit-preview"></div>
			</div>
			<div class="dtb-form-row">
				<label>Brand <span style="color:#d63638;">*</span></label>
				<select id="dtb-edit-brand" class="dtb-select" style="width:100%;">
					<option value="">— Select Brand —</option>
					<?php foreach ( $brands as $b ) : ?>
						<option value="<?php echo esc_attr( $b ); ?>"><?php echo esc_html( $b ); ?></option>
					<?php endforeach; ?>
				</select>
			</div>
			<div class="dtb-form-row">
				<label>Model Number <span style="color:#d63638;">*</span></label>
				<input type="text" id="dtb-edit-model-number">
			</div>
			<div class="dtb-form-row">
				<label>Model Name</label>
				<input type="text" id="dtb-edit-model-name">
			</div>
			<div class="dtb-form-row">
				<label>Part Count</label>
				<input type="number" id="dtb-edit-part-count" min="0" style="width:120px;">
			</div>
			<div class="dtb-form-row">
				<label>Notes</label>
				<textarea id="dtb-edit-notes"></textarea>
			</div>
			<div class="dtb-form-row">
				<label>Linked Products</label>
				<div class="dtb-product-search-wrap">
					<input type="text" id="dtb-edit-product-search" class="dtb-input" placeholder="Search products by name or SKU…" style="width:100%;">
					<div class="dtb-product-dropdown" id="dtb-edit-product-dropdown"><ul></ul></div>
				</div>
				<div class="dtb-linked-products" id="dtb-edit-linked-products"></div>
				<input type="hidden" id="dtb-edit-product-ids" value="">
			</div>
			<div style="display:flex;gap:10px;align-items:center;margin-top:16px;">
				<button id="dtb-edit-save" class="dtb-btn dtb-btn-primary">Save Changes</button>
				<span id="dtb-edit-spinner" style="display:none;"><span class="spinner is-active" style="float:none;margin:0;"></span></span>
				<button id="dtb-edit-delete" class="dtb-btn dtb-btn-danger" style="margin-left:auto;">Remove Schematic</button>
			</div>
			<div id="dtb-edit-msg" style="margin-top:10px;font-size:13px;"></div>
		</div>
	</div>

	<script>
	(function($){
		var nonce  = <?php echo wp_json_encode( $nonce ); ?>;
		var paged  = 1;
		var totalPages = 1;

		// ── Tabs ──────────────────────────────────────────────────────────────

		$('.dtb-tab').on('click', function(){
			$('.dtb-tab').removeClass('active');
			$('.dtb-tab-panel').removeClass('active');
			$(this).addClass('active');
			$('#dtb-tab-' + $(this).data('tab')).addClass('active');
		});

		// ── List Tab ──────────────────────────────────────────────────────────

		function loadList(p) {
			paged = p || 1;
			$('#dtb-list-loading').text('Loading…').show();
			$('#dtb-list-container').hide();
			$('#dtb-list-empty').hide();
			$.post(ajaxurl, {
				action: 'dtb_schematics_list',
				nonce:  nonce,
				brand:  $('#dtb-filter-brand').val(),
				search: $('#dtb-filter-search').val(),
				paged:  paged
			}, function(res){
				$('#dtb-list-loading').hide();
				if (!res.success) return;
				var d = res.data;
				totalPages = d.pages;
				if (!d.items || !d.items.length) {
					$('#dtb-list-empty').show(); return;
				}
				$('#dtb-list-count').text(d.total + ' schematic' + (d.total !== 1 ? 's' : ''));
				var rows = '';
				$.each(d.items, function(i, s){
					var thumb = s.thumb
						? '<img src="' + s.thumb + '" class="dtb-thumb" data-id="' + s.id + '">'
						: '<div class="dtb-thumb-placeholder"><span class="dashicons dashicons-format-image"></span></div>';
					var chips = '';
					$.each(s.products, function(j, p){
						chips += '<span class="dtb-chip">' + $('<div>').text(p.sku || p.name).html() + '</span>';
					});
					rows += '<tr>';
					rows += '<td>' + thumb + '</td>';
					rows += '<td><span class="dtb-badge-brand">' + $('<div>').text(s.brand).html() + '</span></td>';
					rows += '<td><code>' + $('<div>').text(s.model_number).html() + '</code></td>';
					rows += '<td>' + $('<div>').text(s.model_name).html() + '</td>';
					rows += '<td>' + (s.part_count || '—') + '</td>';
					rows += '<td><div class="dtb-link-chips">' + (chips || '<span style="color:#c3c4c7">—</span>') + '</div></td>';
					rows += '<td><button class="dtb-btn dtb-btn-secondary dtb-edit-btn" style="font-size:12px;padding:4px 10px;" data-id="' + s.id + '">Edit</button></td>';
					rows += '</tr>';
				});
				$('#dtb-list-body').html(rows);

				var pg = '';
				if (totalPages > 1) {
					pg += '<button class="dtb-btn dtb-btn-secondary" id="dtb-pg-prev" style="padding:4px 10px;font-size:12px;"' + (paged <= 1 ? ' disabled' : '') + '>‹ Prev</button>';
					pg += '<span>Page ' + paged + ' of ' + totalPages + '</span>';
					pg += '<button class="dtb-btn dtb-btn-secondary" id="dtb-pg-next" style="padding:4px 10px;font-size:12px;"' + (paged >= totalPages ? ' disabled' : '') + '>Next ›</button>';
				}
				$('#dtb-pagination').html(pg);
				$('#dtb-list-container').show();
			});
		}

		$('#dtb-btn-search').on('click', function(){ loadList(1); });
		$('#dtb-filter-search').on('keydown', function(e){ if(e.key === 'Enter') loadList(1); });
		$('#dtb-filter-brand').on('change', function(){ loadList(1); });
		$(document).on('click','#dtb-pg-prev', function(){ if(paged > 1) loadList(paged-1); });
		$(document).on('click','#dtb-pg-next', function(){ if(paged < totalPages) loadList(paged+1); });

		loadList(1);

		// ── Edit button → open modal ──────────────────────────────────────────

		$(document).on('click','.dtb-edit-btn', function(){
			var id = $(this).data('id');
			$('#dtb-edit-msg').text('');
			$.post(ajaxurl, { action: 'dtb_schematics_get', nonce: nonce, id: id }, function(res){
				if (!res.success) return;
				var s = res.data;
				$('#dtb-edit-id').val(s.id);
				$('#dtb-edit-modal-title').text('Edit Schematic — ' + (s.model_number || s.id));
				$('#dtb-edit-brand').val(s.brand);
				$('#dtb-edit-model-number').val(s.model_number);
				$('#dtb-edit-model-name').val(s.model_name);
				$('#dtb-edit-part-count').val(s.part_count || '');
				$('#dtb-edit-notes').val(s.notes || '');
				$('#dtb-edit-preview').html(s.thumb ? '<img src="' + s.thumb + '" style="max-width:80px;max-height:80px;border:1px solid #dcdcde;border-radius:3px;">' : '');
				var ids = [], chips = '';
				$.each(s.products, function(i, p){
					ids.push(p.id);
					chips += renderChip(p.id, p.name, p.sku, 'edit');
				});
				$('#dtb-edit-product-ids').val(ids.join(','));
				$('#dtb-edit-linked-products').html(chips);
				$('#dtb-edit-modal').addClass('open');
			});
		});

		$('#dtb-modal-close').on('click', function(){ $('#dtb-edit-modal').removeClass('open'); });
		$('#dtb-edit-modal').on('click', function(e){ if($(e.target).hasClass('dtb-modal-overlay')) $(this).removeClass('open'); });

		// ── Save edit ─────────────────────────────────────────────────────────

		$('#dtb-edit-save').on('click', function(){
			var $btn = $(this);
			$btn.prop('disabled', true);
			$('#dtb-edit-spinner').show();
			$.post(ajaxurl, {
				action: 'dtb_schematics_save',
				nonce:  nonce,
				attachment_id: $('#dtb-edit-id').val(),
				brand:         $('#dtb-edit-brand').val(),
				model_number:  $('#dtb-edit-model-number').val(),
				model_name:    $('#dtb-edit-model-name').val(),
				part_count:    $('#dtb-edit-part-count').val(),
				notes:         $('#dtb-edit-notes').val(),
				product_ids:   $('#dtb-edit-product-ids').val()
			}, function(res){
				$btn.prop('disabled', false);
				$('#dtb-edit-spinner').hide();
				if (res.success) {
					$('#dtb-edit-msg').text('✓ Saved.').css('color','#1a7f37');
					loadList(paged);
					setTimeout(function(){ $('#dtb-edit-modal').removeClass('open'); }, 800);
				} else {
					$('#dtb-edit-msg').text('✗ Save failed.').css('color','#d63638');
				}
			});
		});

		// ── Delete schematic flag ─────────────────────────────────────────────

		$('#dtb-edit-delete').on('click', function(){
			if (!confirm('Remove this schematic? The media file will NOT be deleted, only the schematic metadata.')) return;
			$.post(ajaxurl, { action: 'dtb_schematics_remove', nonce: nonce, id: $('#dtb-edit-id').val() }, function(res){
				if (res.success) { $('#dtb-edit-modal').removeClass('open'); loadList(paged); }
			});
		});

		// ── Product search (shared for add and edit) ──────────────────────────

		var searchTimer;
		function initProductSearch(inputId, dropdownId, linkedId, idsId, ctx) {
			$('#' + inputId).on('input', function(){
				clearTimeout(searchTimer);
				var q = $(this).val().trim();
				if (q.length < 1) { $('#' + dropdownId).hide(); return; }
				searchTimer = setTimeout(function(){
					$.post(ajaxurl, { action: 'dtb_schematics_search_products', nonce: nonce, q: q }, function(res){
						if (!res.success || !res.data.length) { $('#' + dropdownId).hide(); return; }
						var items = '';
						$.each(res.data, function(i, p){
							items += '<li data-id="' + p.id + '" data-name="' + $('<div>').text(p.name).html() + '" data-sku="' + $('<div>').text(p.sku).html() + '">' + $('<div>').text(p.name).html() + ' <small style="color:#787c82">(' + $('<div>').text(p.sku).html() + ')</small></li>';
						});
						$('#' + dropdownId + ' ul').html(items);
						$('#' + dropdownId).show();
					});
				}, 250);
			});

			$(document).on('click', '#' + dropdownId + ' li', function(){
				var id   = $(this).data('id');
				var name = $(this).data('name');
				var sku  = $(this).data('sku');
				var cur  = $('#' + idsId).val();
				var ids  = cur ? cur.split(',').map(Number) : [];
				if (ids.indexOf(id) !== -1) { $('#' + dropdownId).hide(); return; }
				ids.push(id);
				$('#' + idsId).val(ids.join(','));
				$('#' + linkedId).append(renderChip(id, name, sku, ctx));
				$('#' + dropdownId).hide();
				$('#' + inputId).val('');
			});

			$(document).on('click', '.' + ctx + '-chip-remove', function(){
				var id  = $(this).data('id');
				var cur = $('#' + idsId).val();
				var ids = cur ? cur.split(',').map(Number).filter(function(x){ return x !== id; }) : [];
				$('#' + idsId).val(ids.join(','));
				$(this).closest('.dtb-chip').remove();
			});
		}

		function renderChip(id, name, sku, ctx) {
			return '<span class="dtb-chip">' + $('<div>').text(sku || name).html() + '<button class="dtb-chip-remove ' + ctx + '-chip-remove" data-id="' + id + '" type="button">×</button></span>';
		}

		initProductSearch('dtb-add-product-search', 'dtb-add-product-dropdown', 'dtb-add-linked-products', 'dtb-add-product-ids', 'add');
		initProductSearch('dtb-edit-product-search', 'dtb-edit-product-dropdown', 'dtb-edit-linked-products', 'dtb-edit-product-ids', 'edit');

		$(document).on('click', function(e){
			if (!$(e.target).closest('.dtb-product-search-wrap').length) {
				$('.dtb-product-dropdown').hide();
			}
		});

		// ── Add Tab: Media Library picker ─────────────────────────────────────

		var mediaFrame;
		$('#dtb-add-select-media').on('click', function(e){
			e.preventDefault();
			if (mediaFrame) { mediaFrame.open(); return; }
			mediaFrame = wp.media({ title: 'Select Schematic Image', button: { text: 'Use this image' }, multiple: false, library: { type: 'image' } });
			mediaFrame.on('select', function(){
				var attachment = mediaFrame.state().get('selection').first().toJSON();
				$('#dtb-add-attachment-id').val(attachment.id);
				$('#dtb-add-filename').text(attachment.filename);
				$('#dtb-add-preview').html('<img src="' + (attachment.sizes && attachment.sizes.thumbnail ? attachment.sizes.thumbnail.url : attachment.url) + '" style="max-width:80px;max-height:80px;border:1px solid #dcdcde;border-radius:3px;">');
				// Pre-fill model name from filename
				if (!$('#dtb-add-model-number').val()) {
					var basename = attachment.filename.replace(/\.[^.]+$/, '').replace(/[-_]/g,' ').toUpperCase();
					$('#dtb-add-model-number').val(basename);
				}
			});
			mediaFrame.open();
		});

		// ── Add Tab: Save ─────────────────────────────────────────────────────

		$('#dtb-btn-add-save').on('click', function(){
			var id    = $('#dtb-add-attachment-id').val();
			var brand = $('#dtb-add-brand').val();
			var model = $('#dtb-add-model-number').val().trim();
			if (!id) { alert('Please select an image first.'); return; }
			if (!brand) { alert('Please select a brand.'); return; }
			if (!model) { alert('Please enter a model number.'); return; }
			var $btn = $(this);
			$btn.prop('disabled', true);
			$('#dtb-add-spinner').show();
			$('#dtb-add-msg').text('');
			$.post(ajaxurl, {
				action:       'dtb_schematics_save',
				nonce:        nonce,
				attachment_id: id,
				brand:         brand,
				model_number:  model,
				model_name:    $('#dtb-add-model-name').val(),
				part_count:    $('#dtb-add-part-count').val(),
				notes:         $('#dtb-add-notes').val(),
				product_ids:   $('#dtb-add-product-ids').val()
			}, function(res){
				$btn.prop('disabled', false);
				$('#dtb-add-spinner').hide();
				if (res.success) {
					$('#dtb-add-msg').text('✓ Schematic registered.').css('color','#1a7f37');
					$('#dtb-add-attachment-id,#dtb-add-model-number,#dtb-add-model-name,#dtb-add-part-count,#dtb-add-notes').val('');
					$('#dtb-add-brand').val('');
					$('#dtb-add-preview,#dtb-add-linked-products').empty();
					$('#dtb-add-filename').text('');
					$('#dtb-add-product-ids').val('');
					loadList(1);
				} else {
					$('#dtb-add-msg').text('✗ Save failed.').css('color','#d63638');
				}
			});
		});

		// ── Manifest Tab: Purge ───────────────────────────────────────────────

		$('#dtb-btn-purge').on('click', function(){
			var $btn = $(this);
			$btn.prop('disabled', true);
			$('#dtb-purge-spinner').show();
			$.post(ajaxurl, { action: 'dtb_schematics_purge', nonce: nonce }, function(res){
				$btn.prop('disabled', false);
				$('#dtb-purge-spinner').hide();
				if (res.success) {
					$('#dtb-purge-msg').text('✓ ' + res.data.message).css('color','#1a7f37');
					$('#dtb-manifest-status').text('Cache cleared. Will regenerate on next API request.');
				} else {
					$('#dtb-purge-msg').text('✗ Purge failed.').css('color','#d63638');
				}
			});
		});

	})(jQuery);
	</script>
	<?php
}

