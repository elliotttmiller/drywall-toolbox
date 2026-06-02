/**
 * DTB Repairs Page — full-screen repair workbench modal
 *
 * Depends on:  window.DtbWorkbench  (dtb-admin-workbench.js)
 * Localized:   window.dtbAdminConfig  { nonce, restUrl, adminUrl, ... }
 *
 * Tabs: overview | intake | quote | parts | technician |
 *        conversation | timeline | shipping | integrations | actions
 */
/* global DtbWorkbench, dtbAdminConfig */
( function () {
	'use strict';

	var WB     = window.DtbWorkbench;
	var CONFIG = window.dtbAdminConfig || {};
	var REST   = ( CONFIG.restUrl || '' ).replace( /\/$/, '' );
	var TABS   = [ 'overview', 'intake', 'quote', 'parts', 'technician',
	               'conversation', 'timeline', 'shipping', 'integrations', 'actions' ];

	// ── State ─────────────────────────────────────────────────────────────────

	var state = {
		repairId:    null,
		data:        null,
		activeTab:   'overview',
		loading:     false,
		refreshTimer: null,
	};

	// ── DOM ───────────────────────────────────────────────────────────────────

	var overlay, modal, tabBar, panelContainer, titleEl, metaEl, footerEl;

	function buildDOM() {
		if ( document.getElementById( 'dtb-repair-modal-overlay' ) ) {
			return; // already built
		}

		overlay = document.createElement( 'div' );
		overlay.id        = 'dtb-repair-modal-overlay';
		overlay.className = 'dtb-modal-overlay';
		overlay.setAttribute( 'role', 'dialog' );
		overlay.setAttribute( 'aria-modal', 'true' );
		overlay.setAttribute( 'aria-labelledby', 'dtb-repair-modal-title' );

		modal = document.createElement( 'div' );
		modal.className = 'dtb-modal dtb-modal--fullscreen';
		modal.setAttribute( 'id', 'dtb-repair-modal' );

		// Header
		var header = document.createElement( 'div' );
		header.className = 'dtb-modal__header';

		titleEl = document.createElement( 'h2' );
		titleEl.id        = 'dtb-repair-modal-title';
		titleEl.className = 'dtb-modal__title';
		titleEl.textContent = 'Repair';

		metaEl = document.createElement( 'div' );
		metaEl.className = 'dtb-modal__meta';

		var closeBtn = document.createElement( 'button' );
		closeBtn.type      = 'button';
		closeBtn.className = 'dtb-modal__close';
		closeBtn.setAttribute( 'aria-label', 'Close' );
		closeBtn.textContent = '×';
		closeBtn.addEventListener( 'click', closeModal );

		header.appendChild( titleEl );
		header.appendChild( metaEl );
		header.appendChild( closeBtn );

		// Tab bar
		tabBar = document.createElement( 'div' );
		tabBar.className = 'dtb-modal-tabs';
		tabBar.setAttribute( 'role', 'tablist' );

		TABS.forEach( function ( tab ) {
			var btn = document.createElement( 'button' );
			btn.type             = 'button';
			btn.className        = 'dtb-modal-tab';
			btn.dataset.tab      = tab;
			btn.setAttribute( 'role', 'tab' );
			btn.setAttribute( 'aria-selected', tab === 'overview' ? 'true' : 'false' );
			btn.textContent = tab.charAt(0).toUpperCase() + tab.slice(1).replace( /-/g, ' ' );
			btn.addEventListener( 'click', function () {
				switchTab( tab );
			} );
			tabBar.appendChild( btn );
		} );

		// Body + panel container
		var body = document.createElement( 'div' );
		body.className = 'dtb-modal__body';

		var mainCol = document.createElement( 'div' );
		mainCol.className = 'dtb-wb-main';

		panelContainer = document.createElement( 'div' );
		panelContainer.id = 'dtb-repair-panels';

		mainCol.appendChild( tabBar );
		mainCol.appendChild( panelContainer );
		body.appendChild( mainCol );

		// Footer
		footerEl = document.createElement( 'div' );
		footerEl.className = 'dtb-modal__footer';

		var refreshBtn = document.createElement( 'button' );
		refreshBtn.type      = 'button';
		refreshBtn.className = 'button';
		refreshBtn.textContent = 'Refresh';
		refreshBtn.addEventListener( 'click', function () { loadRepair( state.repairId ); } );

		var editLink = document.createElement( 'a' );
		editLink.id        = 'dtb-repair-modal-edit-link';
		editLink.className = 'button button-primary';
		editLink.textContent = 'Edit Record';
		editLink.target    = '_blank';

		footerEl.appendChild( refreshBtn );
		footerEl.appendChild( editLink );

		modal.appendChild( header );
		modal.appendChild( body );
		modal.appendChild( footerEl );
		overlay.appendChild( modal );
		document.body.appendChild( overlay );

		// Click outside to close
		overlay.addEventListener( 'click', function ( e ) {
			if ( e.target === overlay ) { closeModal(); }
		} );
	}

	// ── Open / close ──────────────────────────────────────────────────────────

	function openRepair( repairId ) {
		buildDOM();
		state.repairId  = parseInt( repairId, 10 );
		state.activeTab = WB.getUrlParam( 'repair_tab' ) || 'overview';

		overlay.classList.add( 'dtb-modal-overlay--open' );
		document.body.classList.add( 'dtb-modal-open' );

		WB.replaceUrlParam( 'open_repair', String( state.repairId ) );
		WB.replaceUrlParam( 'repair_tab', state.activeTab );

		renderLoading();
		loadRepair( state.repairId );

		// Refresh every 60 seconds while open.
		clearInterval( state.refreshTimer );
		state.refreshTimer = setInterval( function () {
			if ( state.repairId ) { loadRepair( state.repairId ); }
		}, 60000 );
	}

	function closeModal() {
		if ( overlay ) {
			overlay.classList.remove( 'dtb-modal-overlay--open' );
		}
		document.body.classList.remove( 'dtb-modal-open' );
		clearInterval( state.refreshTimer );
		WB.clearUrlParam( 'open_repair' );
		WB.clearUrlParam( 'repair_tab' );
		state.repairId = null;
		state.data     = null;
	}

	// ── Fetch ─────────────────────────────────────────────────────────────────

	function loadRepair( repairId ) {
		if ( state.loading ) { return; }
		state.loading = true;
		setHeaderLoading( true );

		WB.apiFetch( REST + '/dtb/v1/admin/repairs/' + repairId + '/detail', {
			method: 'GET',
		} )
		.then( function ( data ) {
			state.data    = data;
			state.loading = false;
			setHeaderLoading( false );
			renderAll();
		} )
		.catch( function ( err ) {
			state.loading = false;
			setHeaderLoading( false );
			renderError( err && err.message ? err.message : 'Failed to load repair.' );
		} );
	}

	// ── Tabs ──────────────────────────────────────────────────────────────────

	function switchTab( tab ) {
		if ( ! TABS.includes( tab ) ) { tab = 'overview'; }
		state.activeTab = tab;

		tabBar.querySelectorAll( '.dtb-modal-tab' ).forEach( function ( btn ) {
			var active = btn.dataset.tab === tab;
			btn.classList.toggle( 'dtb-modal-tab--active', active );
			btn.setAttribute( 'aria-selected', active ? 'true' : 'false' );
		} );

		panelContainer.querySelectorAll( '.dtb-modal-tab-panel' ).forEach( function ( p ) {
			if ( p.dataset.panel === tab ) {
				p.removeAttribute( 'hidden' );
			} else {
				p.setAttribute( 'hidden', '' );
			}
		} );

		WB.replaceUrlParam( 'repair_tab', tab );
	}

	function getOrCreatePanel( tab ) {
		// Validate tab name against the known-safe TABS list before using in selector.
		if ( ! TABS.includes( tab ) ) { tab = 'overview'; }
		var existing = panelContainer.querySelector( '[data-panel="' + tab + '"]' );
		if ( existing ) { return existing; }
		var panel = document.createElement( 'div' );
		panel.className = 'dtb-modal-tab-panel';
		panel.dataset.panel = tab;
		if ( tab !== state.activeTab ) {
			panel.setAttribute( 'hidden', '' );
		}
		panelContainer.appendChild( panel );
		return panel;
	}

	// ── Header helpers ────────────────────────────────────────────────────────

	function setHeaderLoading( on ) {
		titleEl.textContent = on ? 'Loading…' : ( state.data ? 'Repair #' + state.data.record.id : 'Repair' );
	}

	function renderLoading() {
		panelContainer.innerHTML = '<div class="dtb-modal-loading">Loading repair…</div>';
	}

	function renderError( msg ) {
		panelContainer.innerHTML = '<div class="dtb-modal-error">' + WB.escapeHtml( msg ) + '</div>';
	}

	// ── Render all panels ─────────────────────────────────────────────────────

	function renderAll() {
		var d = state.data;
		if ( ! d || ! d.record ) { return; }

		// Update header
		titleEl.textContent = 'Repair #' + d.record.id + ' — ' + WB.escapeHtml( d.record.customer_name || '' );
		metaEl.innerHTML    = statusBadge( d.record.status );

		// Edit link
		var editLink = document.getElementById( 'dtb-repair-modal-edit-link' );
		if ( editLink ) {
			editLink.href = ( CONFIG.adminUrl || '' ) + 'post.php?post=' + d.record.id + '&action=edit';
		}

		// Clear all panels to re-render fresh data.
		panelContainer.innerHTML = '';

		renderOverview( d );
		renderIntake( d );
		renderQuote( d );
		renderParts( d );
		renderTechnician( d );
		renderConversation( d );
		renderTimeline( d );
		renderShipping( d );
		renderIntegrations( d );
		renderActions( d );

		// Activate correct tab.
		switchTab( state.activeTab );
	}

	// ── Panel: Overview ───────────────────────────────────────────────────────

	function renderOverview( d ) {
		var panel = getOrCreatePanel( 'overview' );
		var r     = d.record;
		var intel = d.intel || {};

		var html = '<div class="dtb-modal__body">';

		// Left: core KVs + linked records
		html += '<div class="dtb-wb-main dtb-modal-tab-panel" data-panel-inner="overview-main">';
		html += '<div class="dtb-wb-section">';
		html += '<h3 class="dtb-wb-section__title">Record</h3>';
		html += kv( 'Status',       statusBadge( r.status ) );
		html += kv( 'Customer',     WB.escapeHtml( r.customer_name ) + ' &lt;' + WB.escapeHtml( r.customer_email ) + '&gt;' );
		html += kv( 'Created',      WB.formatDate( r.created_at ) );
		html += kv( 'Priority',     WB.escapeHtml( r.priority || '—' ) );
		html += kv( 'Service tier', WB.escapeHtml( r.service_tier || '—' ) );
		if ( intel.sla_state ) {
			html += kv( 'SLA', '<span class="dtb-wb-badge dtb-wb-badge--' + slaBadgeClass( intel.sla_state ) + '">' + WB.escapeHtml( intel.sla_state ) + '</span>' );
		}
		html += '</div>';

		// Workload
		if ( intel.next_best_action ) {
			html += '<div class="dtb-wb-section">';
			html += '<h3 class="dtb-wb-section__title">Recommended action</h3>';
			html += '<p style="font-size:.875rem;color:#334155">' + WB.escapeHtml( intel.next_best_action ) + '</p>';
			html += '</div>';
		}

		// Linked records
		var linked = d.linked || {};
		if ( linked.records && linked.records.length ) {
			html += '<div class="dtb-wb-section">';
			html += '<h3 class="dtb-wb-section__title">Linked records</h3>';
			html += '<ul class="dtb-wb-links">';
			linked.records.forEach( function ( rec ) {
				html += '<li>' + linkedRecordChip( rec ) + '</li>';
			} );
			html += '</ul>';
			html += '</div>';
		}

		html += '</div>'; // left col

		// Right rail: customer context
		var ctx = d.customer || {};
		html += '<div class="dtb-wb-rail">';
		if ( ctx.name ) {
			html += '<div class="dtb-wb-card">';
			html += '<div class="dtb-wb-card__title">Customer</div>';
			html += '<div class="dtb-wb-card__body">';
			html += kv( 'Name',    WB.escapeHtml( ctx.name ) );
			html += kv( 'Email',   WB.escapeHtml( ctx.email || '—' ) );
			html += kv( 'Orders',  String( ctx.order_count || 0 ) );
			html += kv( 'LTV',     WB.formatMoney( ctx.lifetime_value || 0 ) );
			if ( ctx.risk_notes && ctx.risk_notes.length ) {
				html += kv( 'Notes', ctx.risk_notes.map( function ( n ) { return WB.escapeHtml( n ); } ).join( ', ' ) );
			}
			html += '</div></div>';
		}
		html += '</div>'; // rail

		html += '</div>'; // body flex

		panel.innerHTML = html;
	}

	// ── Panel: Intake ─────────────────────────────────────────────────────────

	function renderIntake( d ) {
		var panel = getOrCreatePanel( 'intake' );
		var r     = d.record;

		panel.innerHTML = kvSection( 'Customer', [
			[ 'Name',    r.customer_name ],
			[ 'Email',   r.customer_email ],
			[ 'Phone',   r.customer_phone ],
			[ 'Company', r.company ],
		] ) + kvSection( 'Tool', [
			[ 'Brand',       r.tool_brand ],
			[ 'Category',    r.tool_category ],
			[ 'Model',       r.tool_model ],
			[ 'Serial',      r.serial_number ],
			[ 'Tool age',    r.tool_age ],
		] ) + kvSection( 'Issue', [
			[ 'Issue start',   r.issue_start ],
			[ 'Description',   r.issue_description ],
			[ 'Contact pref',  r.contact_preference ],
		] );
	}

	// ── Panel: Quote ──────────────────────────────────────────────────────────

	function renderQuote( d ) {
		var panel = getOrCreatePanel( 'quote' );
		var q     = d.quote || {};
		var perms = d.permissions || {};
		var html  = '';

		if ( ! Object.keys( q ).length ) {
			html = '<p style="color:#64748b;padding:1rem">No quote on file.</p>';
		} else {
			html += kvSection( 'Quote', [
				[ 'Status',     q.status ],
				[ 'Labour',     WB.formatMoney( q.labour_total || 0 ) ],
				[ 'Parts',      WB.formatMoney( q.parts_total  || 0 ) ],
				[ 'Shipping',   WB.formatMoney( q.shipping_total || 0 ) ],
				[ 'Total',      WB.formatMoney( q.grand_total  || 0 ) ],
				[ 'Valid until', WB.formatDate( q.valid_until ) ],
				[ 'Notes',      q.notes ],
			] );
		}

		if ( perms.can_edit_quote ) {
			html += '<div class="dtb-wb-command-bar">';
			html += actionButton( 'Save draft', 'dtb-repair-quote-save', { repairId: d.record.id } );
			html += actionButton( 'Send to customer', 'dtb-repair-quote-send', { repairId: d.record.id }, 'button-primary' );
			html += '</div>';
		}

		panel.innerHTML = html;

		if ( perms.can_edit_quote ) {
			bindActionButton( panel, 'dtb-repair-quote-save', function () {
				doAction( d.record.id, 'quote/save', {} );
			} );
			bindActionButton( panel, 'dtb-repair-quote-send', function () {
				WB.confirmDanger( 'Send this quote to the customer?', function () {
					doAction( d.record.id, 'quote/send', {} );
				} );
			} );
		}
	}

	// ── Panel: Parts ──────────────────────────────────────────────────────────

	function renderParts( d ) {
		var panel = getOrCreatePanel( 'parts' );
		var perms = d.permissions || {};
		var parts = [];
		var html = '<p style="color:#64748b;padding:1rem">Parts allocation coming from record meta.</p>';
		if ( perms.can_allocate_parts ) {
			html += '<div class="dtb-wb-command-bar">';
			html += actionButton( 'Allocate parts', 'dtb-repair-parts-allocate', { repairId: d.record.id }, 'button-primary' );
			html += '</div>';
		}
		panel.innerHTML = html;

		if ( perms.can_allocate_parts ) {
			bindActionButton( panel, 'dtb-repair-parts-allocate', function () {
				doAction( d.record.id, 'parts/allocate', { parts: [] } );
			} );
		}
	}

	// ── Panel: Technician ─────────────────────────────────────────────────────

	function renderTechnician( d ) {
		var panel = getOrCreatePanel( 'technician' );
		var r     = d.record;
		panel.innerHTML = kvSection( 'Assignment', [
			[ 'Technician ID', r.technician_id ? String( r.technician_id ) : 'Unassigned' ],
		] );
	}

	// ── Panel: Conversation ───────────────────────────────────────────────────

	function renderConversation( d ) {
		var panel     = getOrCreatePanel( 'conversation' );
		var msgs      = d.conversation || [];
		var perms     = d.permissions  || {};
		var html      = '';

		if ( ! msgs.length ) {
			html = '<p style="color:#64748b;padding:1rem">No messages yet.</p>';
		} else {
			html += '<div class="dtb-wb-thread" style="padding:1rem">';
			msgs.forEach( function ( m ) {
				var cls = 'dtb-wb-message--' + ( m.type === 'internal' ? 'internal' : ( m.type === 'staff' ? 'staff' : 'customer' ) );
				html += '<div class="dtb-wb-message ' + cls + '">';
				html += '<p>' + WB.escapeHtml( m.body ) + '</p>';
				html += '<p class="dtb-wb-message__meta">' + WB.escapeHtml( m.user_label ) + ' &middot; ' + WB.formatDate( m.created_at ) + '</p>';
				html += '</div>';
			} );
			html += '</div>';
		}

		if ( perms.can_message ) {
			html += '<div style="padding:1rem">';
			html += '<textarea id="dtb-repair-msg-body" class="widefat" rows="3" placeholder="Reply to customer…"></textarea>';
			html += '<div class="dtb-wb-command-bar" style="padding:.5rem 0 0">';
			html += actionButton( 'Send', 'dtb-repair-msg-send', {}, 'button-primary' );
			html += actionButton( 'Add internal note', 'dtb-repair-note-add', {} );
			html += '</div>';
			html += '</div>';
		}

		panel.innerHTML = html;

		if ( perms.can_message ) {
			bindActionButton( panel, 'dtb-repair-msg-send', function () {
				var ta  = panel.querySelector( '#dtb-repair-msg-body' );
				var txt = ta ? ta.value.trim() : '';
				if ( ! txt ) { WB.showToast( 'Message body is empty.', 'warning' ); return; }
				doAction( d.record.id, 'customer-message', { body: txt } )
					.then( function () { if ( ta ) { ta.value = ''; } } );
			} );
			bindActionButton( panel, 'dtb-repair-note-add', function () {
				var ta  = panel.querySelector( '#dtb-repair-msg-body' );
				var txt = ta ? ta.value.trim() : '';
				if ( ! txt ) { WB.showToast( 'Note body is empty.', 'warning' ); return; }
				doAction( d.record.id, 'internal-note', { body: txt } )
					.then( function () { if ( ta ) { ta.value = ''; } } );
			} );
		}
	}

	// ── Panel: Timeline ───────────────────────────────────────────────────────

	function renderTimeline( d ) {
		var panel  = getOrCreatePanel( 'timeline' );
		var events = d.audit || [];
		var html   = '';

		if ( ! events.length ) {
			html = '<p style="color:#64748b;padding:1rem">No audit events.</p>';
		} else {
			html += '<ul style="list-style:none;margin:0;padding:1rem;font-size:.8125rem">';
			events.forEach( function ( ev ) {
				html += '<li style="border-bottom:1px solid #f1f5f9;padding:.375rem 0">';
				html += '<strong>' + WB.escapeHtml( ev.event ) + '</strong> ';
				html += WB.escapeHtml( ev.actor_label || '' ) + ' &middot; ';
				html += WB.formatDate( ev.created_at );
				html += '</li>';
			} );
			html += '</ul>';
		}

		panel.innerHTML = html;
	}

	// ── Panel: Shipping ───────────────────────────────────────────────────────

	function renderShipping( d ) {
		var panel = getOrCreatePanel( 'shipping' );
		var sh    = d.shipping || {};
		var addr  = sh.return_address || {};
		var perms = d.permissions || {};
		var r     = d.record;

		var html = kvSection( 'Return address', [
			[ 'Line 1',   addr.line1 ],
			[ 'City',     addr.city ],
			[ 'State',    addr.state ],
			[ 'Postcode', addr.postcode ],
			[ 'Country',  addr.country ],
		] ) + kvSection( 'Shipping', [
			[ 'Rate name',      sh.rate_name ],
			[ 'Rate price',     WB.formatMoney( sh.rate_price || 0 ) ],
			[ 'Tracking #',     sh.tracking_number || '—' ],
			[ 'Veeqo order ID', sh.veeqo_order_id || '—' ],
		] );

		var canShip = perms.can_transition && r.status === 'in_progress';
		if ( canShip ) {
			html += '<div style="padding:1rem">';
			html += '<label style="display:block;font-size:.8125rem;margin-bottom:.25rem">Tracking number</label>';
			html += '<input id="dtb-repair-tracking" type="text" class="regular-text" value="' + WB.escapeHtml( sh.tracking_number || '' ) + '">';
			html += '</div>';
			html += '<div class="dtb-wb-command-bar">';
			html += actionButton( 'Mark ready to ship', 'dtb-repair-ready-ship', {}, 'button-primary' );
			html += '</div>';
		}

		panel.innerHTML = html;

		if ( canShip ) {
			bindActionButton( panel, 'dtb-repair-ready-ship', function () {
				var tin = panel.querySelector( '#dtb-repair-tracking' );
				doAction( d.record.id, 'ready-to-ship', {
					tracking_number: tin ? tin.value.trim() : '',
				} );
			} );
		}
	}

	// ── Panel: Integrations ───────────────────────────────────────────────────

	function renderIntegrations( d ) {
		var panel = getOrCreatePanel( 'integrations' );
		var intg  = d.integration || {};
		var html  = '';

		if ( ! Object.keys( intg ).length ) {
			html = '<p style="color:#64748b;padding:1rem">No integration data.</p>';
		} else {
			Object.keys( intg ).forEach( function ( key ) {
				var val = intg[ key ];
				html += kvSection( key, Object.keys( val ).map( function ( k ) {
					return [ k, String( val[ k ] ) ];
				} ) );
			} );
		}

		panel.innerHTML = html;
	}

	// ── Panel: Actions ────────────────────────────────────────────────────────

	function renderActions( d ) {
		var panel  = getOrCreatePanel( 'actions' );
		var r      = d.record;
		var perms  = d.permissions || {};
		var html   = '';

		// Status transitions
		if ( perms.can_transition && r.allowed_next && r.allowed_next.length ) {
			html += '<div class="dtb-wb-section" style="padding:1rem">';
			html += '<h3 class="dtb-wb-section__title">Transition status</h3>';
			html += '<div style="display:flex;flex-wrap:wrap;gap:.5rem">';
			r.allowed_next.forEach( function ( nextStatus ) {
				html += '<button type="button" class="button dtb-repair-transition-btn" data-status="' + WB.escapeHtml( nextStatus ) + '">'
				      + WB.escapeHtml( nextStatus.replace( /_/g, ' ' ) )
				      + '</button>';
			} );
			html += '</div>';
			html += '</div>';
		}

		// Close
		if ( perms.can_close && ! r.is_terminal ) {
			html += '<div class="dtb-wb-section" style="padding:0 1rem 1rem">';
			html += '<h3 class="dtb-wb-section__title">Close repair</h3>';
			html += '<textarea id="dtb-repair-close-note" class="widefat" rows="2" placeholder="Closing note (optional)"></textarea>';
			html += '<div class="dtb-wb-command-bar" style="padding:.5rem 0 0">';
			html += actionButton( 'Close repair', 'dtb-repair-close', {}, 'button button-link-delete' );
			html += '</div>';
			html += '</div>';
		}

		panel.innerHTML = html;

		// Bind transition buttons
		panel.querySelectorAll( '.dtb-repair-transition-btn' ).forEach( function ( btn ) {
			btn.addEventListener( 'click', function () {
				var toStatus = btn.dataset.status;
				WB.confirmDanger( 'Transition to "' + toStatus + '"?', function () {
					doAction( d.record.id, 'transition', { to_status: toStatus } );
				} );
			} );
		} );

		if ( perms.can_close && ! r.is_terminal ) {
			bindActionButton( panel, 'dtb-repair-close', function () {
				var noteEl = panel.querySelector( '#dtb-repair-close-note' );
				WB.confirmDanger( 'Close this repair?', function () {
					doAction( d.record.id, 'close', { note: noteEl ? noteEl.value.trim() : '' } );
				} );
			} );
		}
	}

	// ── Action helper ─────────────────────────────────────────────────────────

	function doAction( repairId, actionPath, payload ) {
		var url = REST + '/dtb/v1/admin/repairs/' + repairId + '/' + actionPath;
		setHeaderLoading( true );

		return WB.apiFetch( url, {
			method: 'POST',
			body:   JSON.stringify( payload ),
		} )
		.then( function ( data ) {
			state.data = data;
			setHeaderLoading( false );
			renderAll();
			WB.showToast( 'Updated.', 'success' );
			return data;
		} )
		.catch( function ( err ) {
			setHeaderLoading( false );
			WB.showToast( ( err && err.message ) ? err.message : 'Action failed.', 'error' );
			return Promise.reject( err );
		} );
	}

	// ── Utilities ─────────────────────────────────────────────────────────────

	function kv( label, value ) {
		return '<div class="dtb-wb-kv"><span class="dtb-wb-kv__label">' + WB.escapeHtml( label ) + '</span><span class="dtb-wb-kv__value">' + ( value || '—' ) + '</span></div>';
	}

	function kvSection( title, pairs ) {
		var html = '<div class="dtb-wb-section" style="padding:1rem">';
		html += '<h3 class="dtb-wb-section__title">' + WB.escapeHtml( title ) + '</h3>';
		pairs.forEach( function ( p ) {
			html += kv( p[0], WB.escapeHtml( p[1] || '' ) );
		} );
		html += '</div>';
		return html;
	}

	function statusBadge( status ) {
		var cls = statusBadgeClass( status );
		return '<span class="dtb-wb-badge dtb-wb-badge--' + cls + '">' + WB.escapeHtml( ( status || '' ).replace( /_/g, ' ' ) ) + '</span>';
	}

	function statusBadgeClass( status ) {
		var map = {
			submitted: 'info', reviewed: 'info', awaiting_customer: 'warning',
			approved: 'ok', quoted: 'warning', quote_accepted: 'ok',
			parts_allocated: 'ok', in_progress: 'ok', ready_to_ship: 'warning',
			completed: 'muted', closed: 'muted', cancelled: 'muted', quote_declined: 'breach',
		};
		return map[ status ] || 'muted';
	}

	function slaBadgeClass( state ) {
		var map = { ok: 'ok', warning: 'warning', breach: 'breach' };
		return map[ state ] || 'muted';
	}

	function linkedRecordChip( rec ) {
		var label = WB.escapeHtml( rec.module + ' #' + rec.id );
		if ( rec.url ) {
			return '<a href="' + WB.escapeHtml( rec.url ) + '" target="_blank">' + label + '</a>'
				 + ( rec.confidence === 'orphaned' ? ' <em style="color:#dc2626">(orphaned)</em>' : '' );
		}
		return label;
	}

	function actionButton( label, id, dataset, extraClass ) {
		var cls = 'button ' + ( extraClass || '' );
		return '<button type="button" class="' + WB.escapeHtml( cls.trim() ) + '" id="' + WB.escapeHtml( id ) + '">' + WB.escapeHtml( label ) + '</button>';
	}

	function bindActionButton( panel, id, fn ) {
		var btn = panel.querySelector( '#' + id );
		if ( btn ) { btn.addEventListener( 'click', fn ); }
	}

	// ── Queue click delegation ────────────────────────────────────────────────

	function initQueueDelegation() {
		document.addEventListener( 'click', function ( e ) {
			var row = e.target.closest( '[data-dtb-open-repair]' );
			if ( ! row ) { return; }
			e.preventDefault();
			openRepair( row.dataset.dtbOpenRepair );
		} );
	}

	// ── Keyboard ─────────────────────────────────────────────────────────────

	document.addEventListener( 'keydown', function ( e ) {
		if ( 'Escape' === e.key && overlay && overlay.classList.contains( 'dtb-modal-overlay--open' ) ) {
			closeModal();
		}
	} );

	// ── Deep-link init ────────────────────────────────────────────────────────

	function initDeepLink() {
		var params    = new URLSearchParams( window.location.search );
		var openId    = params.get( 'open_repair' );
		var activeTab = params.get( 'repair_tab' );
		if ( openId && parseInt( openId, 10 ) > 0 ) {
			if ( activeTab && TABS.includes( activeTab ) ) {
				state.activeTab = activeTab;
			}
			openRepair( openId );
		}
	}

	// ── Boot ──────────────────────────────────────────────────────────────────

	document.addEventListener( 'DOMContentLoaded', function () {
		if ( ! window.DtbWorkbench ) {
			console.warn( 'DTB Repairs: DtbWorkbench not loaded.' );
			return;
		}
		initQueueDelegation();
		initDeepLink();
	} );

	// Expose for external triggers (e.g. other modules linking to a repair).
	window.DtbRepairs = { open: openRepair, close: closeModal };
} )();
