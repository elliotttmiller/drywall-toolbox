/**
 * DTB Orders Page — canonical order workbench modal.
 */
( function ( window, document ) {
	'use strict';

	var WB = window.DtbWorkbench || null;
	if ( ! WB ) { return; }

	var MODAL_ID = 'dtb-orders-modal';
	var state = {
		orderId: null,
		payload: null,
	};

	function bodyEl() {
		var modal = document.getElementById( MODAL_ID );
		return modal ? modal.querySelector( '.dtb-modal__body' ) : null;
	}

	function footerEl() {
		var modal = document.getElementById( MODAL_ID );
		return modal ? modal.querySelector( '.dtb-modal__footer' ) : null;
	}

	// Returns the WooCommerce post.php edit URL for fallback use only.
	// The linked-records URL fallback was intentionally removed; order URLs are
	// available inside the linked records panel, not as a primary footer CTA.
	function editUrl( record ) {
		if ( record && record.id ) {
			var adminUrl = ( window.dtbAdminConfig && window.dtbAdminConfig.adminUrl ) || '/wp-admin/admin.php';
			return adminUrl.replace( /admin\.php.*$/, '' ) + 'post.php?post=' + encodeURIComponent( record.id ) + '&action=edit';
		}
		return '';
	}

	function renderItems( items, currency ) {
		items = Array.isArray( items ) ? items : [];
		if ( ! items.length ) {
			return '<div class="dtb-wb-empty">No line items.</div>';
		}
		var html = '<table class="dtb-orders-items"><thead><tr><th>Item</th><th>Qty</th><th>Total</th></tr></thead><tbody>';
		items.forEach( function ( item ) {
			html += '<tr>';
			html += '<td>' + WB.escapeHtml( item.name || 'Item' ) + '</td>';
			html += '<td>' + WB.escapeHtml( item.quantity || 0 ) + '</td>';
			html += '<td>' + WB.escapeHtml( WB.formatMoney( item.total || 0, currency ) ) + '</td>';
			html += '</tr>';
		} );
		html += '</tbody></table>';
		return html;
	}

	function renderAddress( title, addr ) {
		addr = addr || {};
		var name = [ addr.first_name, addr.last_name ].filter( Boolean ).join( ' ' );
		var lines = [ addr.address_1, addr.address_2, addr.city, addr.state, addr.postcode, addr.country ].filter( Boolean );
		var html = '<div class="dtb-wb-card"><div class="dtb-wb-card__title">' + WB.escapeHtml( title ) + '</div><div class="dtb-wb-card__body">';
		html += WB.renderKeyValue( 'Name', WB.escapeHtml( name || '—' ) );
		html += WB.renderKeyValue( 'Address', WB.escapeHtml( lines.join( ', ' ) || '—' ) );
		if ( addr.email ) {
			html += WB.renderKeyValue( 'Email', '<a href="mailto:' + WB.escapeHtml( addr.email ) + '">' + WB.escapeHtml( addr.email ) + '</a>' );
		}
		if ( addr.phone ) {
			html += WB.renderKeyValue( 'Phone', '<a href="tel:' + WB.escapeHtml( addr.phone ) + '">' + WB.escapeHtml( addr.phone ) + '</a>' );
		}
		html += '</div></div>';
		return html;
	}

	function renderActions( payload ) {
		var perms = payload.permissions || {};
		var linked = payload.linked_records || {};
		var workflow = payload.workflow || {};
		var html = '<div class="dtb-wb-command-bar dtb-orders-command-bar">';
		if ( perms.can_refresh ) {
			html += '<button type="button" class="button" data-dtb-order-action="refresh_snapshot">Refresh Snapshot</button>';
		}
		html += '</div>';

		// Workflow transitions (server-provided, not hardcoded).
		var allowed = Array.isArray( workflow.allowed_transitions ) ? workflow.allowed_transitions : [];
		var labels = workflow.labels || {};
		if ( perms.can_manage_status && allowed.length ) {
			html += '<div class="dtb-wb-section" style="padding:1rem">';
			html += '<h3 class="dtb-wb-section__title">Transition status</h3>';
			html += '<div style="display:flex;flex-wrap:wrap;gap:.5rem">';
			allowed.forEach( function ( s ) {
				var label = labels[ s ] || s.replace( /_/g, ' ' );
				html += '<button type="button" class="button dtb-orders-transition-btn" data-status="' + WB.escapeHtml( s ) + '">' + WB.escapeHtml( label ) + '</button>';
			} );
			html += '</div></div>';
		}

		// Linked records — quick-open buttons.
		var ticketIds = Array.isArray( linked.ticket_ids ) ? linked.ticket_ids : [];
		var returnIds = Array.isArray( linked.return_ids ) ? linked.return_ids : [];
		var repairIds = Array.isArray( linked.repair_ids ) ? linked.repair_ids : [];
		if ( ticketIds.length || returnIds.length || repairIds.length ) {
			html += '<div class="dtb-wb-section" style="padding:1rem">';
			html += '<h3 class="dtb-wb-section__title">Linked records</h3>';
			html += '<div style="display:flex;flex-wrap:wrap;gap:.5rem">';
			ticketIds.forEach( function ( id ) {
				html += '<button type="button" class="button dtb-wb-open-record-btn" data-dtb-open-module="support" data-dtb-open-record-id="' + WB.escapeHtml( String( id ) ) + '">Support #' + WB.escapeHtml( String( id ) ) + '</button>';
			} );
			returnIds.forEach( function ( id ) {
				html += '<button type="button" class="button dtb-wb-open-record-btn" data-dtb-open-module="returns" data-dtb-open-record-id="' + WB.escapeHtml( String( id ) ) + '">Return #' + WB.escapeHtml( String( id ) ) + '</button>';
			} );
			repairIds.forEach( function ( id ) {
				html += '<button type="button" class="button dtb-wb-open-record-btn" data-dtb-open-module="repair" data-dtb-open-record-id="' + WB.escapeHtml( String( id ) ) + '">Repair #' + WB.escapeHtml( String( id ) ) + '</button>';
			} );
			html += '</div></div>';
		}

		// Integration retries are available via System Manager only (not primary actions).
		if ( perms.can_retry_sync ) {
			var sysUrl = ( ( window.dtbAdminConfig && window.dtbAdminConfig.adminUrl ) || '/wp-admin/admin.php' )
				.replace( /admin\.php.*$/, 'admin.php' ) + '?page=dtb-system-manager';
			html += '<div class="dtb-wb-section" style="padding:.5rem 1rem">';
			html += '<p class="dtb-wb-note dtb-wb-note--info">Integration retries (Veeqo, QuickBooks) are available in <a href="' + WB.escapeHtml( sysUrl ) + '" target="_blank" rel="noopener">System Manager ↗</a>.</p>';
			html += '</div>';
		}

		return html;
	}

	function renderRecordIssues( integrations ) {
		var blockerKeys = [ 'sync_failed', 'notification_failed', 'payment_failed', 'shipping_blocked', 'refund_unavailable' ];
		var issues = [];
		var sysUrl = ( window.dtbAdminConfig && window.dtbAdminConfig.adminUrl
			? window.dtbAdminConfig.adminUrl.replace( /admin\.php.*$/, 'admin.php' )
			: '/wp-admin/admin.php' )
			+ '?page=dtb-system-manager';
		Object.keys( integrations || {} ).forEach( function ( key ) {
			var item = integrations[ key ] || {};
			var status = item.status || item.state || '';
			if ( status !== 'error' && status !== 'failed' && blockerKeys.indexOf( key ) === -1 ) { return; }
			var err = item.last_error || item.error || item.last_error_code || null;
			issues.push( { label: item.label || key, error: err, url: sysUrl } );
		} );
		if ( ! issues.length ) { return ''; }
		var html = '<div class="dtb-wb-record-issues">';
		html += '<div class="dtb-wb-record-issues__title">Record Issues</div>';
		issues.forEach( function ( issue ) {
			html += '<div class="dtb-wb-note dtb-wb-note--error">';
			html += WB.escapeHtml( issue.label );
			if ( issue.error ) { html += ' — ' + WB.escapeHtml( issue.error ); }
			html += ' <a href="' + WB.escapeHtml( issue.url ) + '">System Manager ↗</a>';
			html += '</div>';
		} );
		html += '</div>';
		return html;
	}

	function renderWorkbench( payload ) {
		payload = payload || {};
		state.payload = payload;
		var record = payload.record || payload.order || {};
		var linked = payload.linked_records || {};
		var workflow = payload.workflow || {};
		var intelligence = payload.intelligence || {};
		var currency = record.currency || 'USD';
		var body = bodyEl();
		var footer = footerEl();
		if ( ! body ) { return; }

		var tabs = [ 'overview', 'customer', 'linked', 'timeline', 'actions' ];
		var tabLabels = { overview: 'Overview', customer: 'Customer', linked: 'Linked', timeline: 'Timeline', actions: 'Actions' };

		var html = '<div class="dtb-orders-workbench">';
		html += '<nav class="dtb-modal-tabs" role="tablist">';
		tabs.forEach( function ( tab, index ) {
			html += '<button type="button" class="dtb-modal-tab' + ( index === 0 ? ' dtb-modal-tab--active' : '' ) + '" data-dtb-tab="' + tab + '" aria-selected="' + ( index === 0 ? 'true' : 'false' ) + '">' + WB.escapeHtml( tabLabels[ tab ] ) + '</button>';
		} );
		html += '</nav>';

		var issuesHtml = renderRecordIssues( payload.integrations || {} );

		html += '<div class="dtb-modal-tab-panel dtb-modal-tab-panel--active" data-dtb-tab="overview">';
		html += '<div class="dtb-orders-overview-grid">';
		if ( issuesHtml ) { html += issuesHtml; }
		html += '<div class="dtb-wb-card"><div class="dtb-wb-card__title">Order</div><div class="dtb-wb-card__body">';
		html += WB.renderKeyValue( 'Order', '#' + WB.escapeHtml( record.id || '' ) );
		html += WB.renderKeyValue( 'Status', WB.renderStatusBadge( workflow.status || record.status, workflow.label || record.status_label ) );
		html += WB.renderKeyValue( 'Payment', WB.escapeHtml( record.payment_method_title || record.payment_method || '—' ) );
		html += WB.renderKeyValue( 'Fulfillment', WB.escapeHtml( record.fulfillment_substate || '—' ) );
		html += WB.renderKeyValue( 'Total', WB.escapeHtml( WB.formatMoney( record.total || 0, currency ) ) );
		html += WB.renderKeyValue( 'Created', WB.escapeHtml( WB.formatDateFull( record.date_created ) ) );
		if ( intelligence.next_best_action ) {
			html += '<div class="dtb-wb-note dtb-wb-note--info">' + WB.escapeHtml( intelligence.next_best_action ) + '</div>';
		}
		html += '</div></div>';
		html += renderAddress( 'Billing', record.billing || {} );
		html += renderAddress( 'Shipping', record.shipping || {} );
		html += '<div class="dtb-wb-card dtb-orders-line-items"><div class="dtb-wb-card__title">Line Items</div><div class="dtb-wb-card__body">' + renderItems( record.line_items, currency ) + '</div></div>';
		html += '</div></div>';

		html += '<div class="dtb-modal-tab-panel" data-dtb-tab="customer" hidden>' + WB.renderCustomerRail( payload.customer || {} ) + '</div>';
		html += '<div class="dtb-modal-tab-panel" data-dtb-tab="linked" hidden>' + WB.renderLinkedRecords( linked ) + '</div>';
		html += '<div class="dtb-modal-tab-panel" data-dtb-tab="timeline" hidden>' + WB.renderTimeline( payload.timeline || [] ) + '</div>';
		html += '<div class="dtb-modal-tab-panel" data-dtb-tab="actions" hidden>' + renderActions( payload ) + '</div>';
		html += '</div>';

		body.innerHTML = html;
		if ( footer ) {
			var url = editUrl( record );
			footer.innerHTML = url
				? '<span class="dtb-wb-fallback-links">Fallback: <a class="button button-small" href="' + WB.escapeHtml( url ) + '" target="_blank">WooCommerce order ↗</a></span>'
				: '';
		}
	}

	function fetchOrder( orderId ) {
		WB.setModalLoading( MODAL_ID, 'Loading order…' );
		return WB.apiFetch( 'dtb/v1/admin/orders/' + encodeURIComponent( orderId ) + '/detail' )
			.then( renderWorkbench )
			.catch( function ( err ) {
				WB.setModalError( MODAL_ID, err.message || 'Unable to load order.' );
			} );
	}

	function openOrder( orderId, trigger ) {
		orderId = parseInt( orderId, 10 );
		if ( ! orderId ) { return; }
		state.orderId = orderId;
		WB.openRecordModal( {
			modalId: MODAL_ID,
			title: 'Order #' + orderId,
			loadingLabel: 'Loading order…',
			urlParam: 'open_order',
			urlParamValue: String( orderId ),
			focusReturnEl: trigger || null,
		} );
		fetchOrder( orderId );
	}

	function runTransition( toStatus, button ) {
		if ( ! state.orderId || ! toStatus ) { return; }
		WB.lockAction( button, 'Working…' );
		var opNonce = Math.random().toString( 36 ).slice( 2, 8 );
		WB.apiFetch( 'dtb/v1/admin/orders/' + encodeURIComponent( state.orderId ) + '/actions', {
			method: 'POST',
			body: {
				action_type: 'transition',
				to_status:   toStatus,
				idempotency_key: 'orders-' + state.orderId + '-transition-' + toStatus,
			},
		} ).then( function ( data ) {
			WB.showToast( data.message || 'Order status updated.', 'success' );
			renderWorkbench( data.detail || state.payload || {} );
		} ).catch( function ( err ) {
			WB.showToast( err.message || 'Transition failed.', 'error' );
		} ).finally( function () {
			WB.unlockAction( button );
		} );
	}

	function runAction( action, button ) {
		if ( ! state.orderId || ! action ) { return; }
		WB.lockAction( button, 'Working…' );
		// Derive idempotency key: record + action + short per-click nonce so the same
		// action can be repeated without being blocked by the server-side idempotency cache.
		var opNonce = Math.random().toString( 36 ).slice( 2, 8 );
		WB.apiFetch( 'dtb/v1/admin/orders/' + encodeURIComponent( state.orderId ) + '/actions', {
			method: 'POST',
			body: {
				action_type: action,
				idempotency_key: 'orders-' + state.orderId + '-' + action + '-' + opNonce,
			},
		} ).then( function ( data ) {
			WB.showToast( data.message || 'Order action queued.', 'success' );
			renderWorkbench( data.detail || state.payload || {} );
		} ).catch( function ( err ) {
			WB.showToast( err.message || 'Order action failed.', 'error' );
		} ).finally( function () {
			WB.unlockAction( button );
		} );
	}

	document.addEventListener( 'click', function ( event ) {
		var actionButton = event.target.closest ? event.target.closest( '[data-dtb-order-action]' ) : null;
		if ( actionButton ) {
			event.preventDefault();
			runAction( actionButton.getAttribute( 'data-dtb-order-action' ), actionButton );
			return;
		}

		// Transition button inside the modal actions panel.
		var transBtn = event.target.closest ? event.target.closest( '#' + MODAL_ID + ' .dtb-orders-transition-btn' ) : null;
		if ( transBtn ) {
			event.preventDefault();
			var toStatus = transBtn.getAttribute( 'data-status' );
			WB.confirmDanger( 'Transition order to "' + toStatus.replace( /_/g, ' ' ) + '"?', function () {
				runTransition( toStatus, transBtn );
			} );
			return;
		}

		// Open linked record buttons (dispatch module-specific deeplink event).
		var openBtn = event.target.closest ? event.target.closest( '#' + MODAL_ID + ' .dtb-wb-open-record-btn' ) : null;
		if ( openBtn ) {
			event.preventDefault();
			var mod = openBtn.getAttribute( 'data-dtb-open-module' );
			var rid = openBtn.getAttribute( 'data-dtb-open-record-id' );
			document.dispatchEvent( new CustomEvent( 'dtb:deeplink', { detail: { module: mod, id: rid } } ) );
			return;
		}

		var explicit = event.target.closest ? event.target.closest( '[data-dtb-open-order]' ) : null;
		var row = explicit || ( event.target.closest ? event.target.closest( 'tr[data-dtb-open-order]' ) : null );
		if ( ! row ) { return; }
		if ( ! explicit && event.target.closest( 'a,button,input,select,textarea,label' ) ) { return; }
		event.preventDefault();
		openOrder( row.getAttribute( 'data-dtb-open-order' ), explicit || row );
	} );

	document.addEventListener( 'click', function ( event ) {
		var tab = event.target.closest ? event.target.closest( '#dtb-orders-modal .dtb-modal-tab[data-dtb-tab]' ) : null;
		if ( ! tab ) { return; }
		event.preventDefault();
		WB.switchTabs( document.getElementById( MODAL_ID ), tab.getAttribute( 'data-dtb-tab' ) );
	} );

	document.addEventListener( 'dtb:deeplink', function ( event ) {
		if ( event.detail && event.detail.module === 'order' ) {
			openOrder( event.detail.id );
		}
	} );

	var initialOrder = WB.getUrlParam( 'open_order' );
	if ( initialOrder ) {
		openOrder( initialOrder );
	}
}( window, document ) );
