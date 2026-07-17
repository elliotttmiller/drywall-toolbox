<?php
/**
 * Signed same-origin payment surface for the DTB checkout shell.
 *
 * This document is intentionally owned by WordPress/WooCommerce so the native
 * WooCommerce Checkout Block and WooPayments execute inside their supported
 * runtime instead of being cloned into the external React tree.
 *
 * @package drywall-toolbox
 */

defined( 'ABSPATH' ) || exit;

final class DTB_CheckoutPaymentSurface {
	private const QUERY_VAR     = 'dtb_checkout_payment_surface';
	private const TOKEN_VERSION = '1';
	private const TOKEN_TTL     = 900;
	private const SESSION_KEYS  = [
		'dtb_payment_surface_order_id',
		'dtb_payment_surface_order_key',
		'dtb_payment_surface_session_id',
		'dtb_payment_surface_cart_hash',
		'dtb_payment_surface_token_hash',
		'dtb_payment_surface_started_at',
	];

	public static function register(): void {
		add_filter( 'query_vars', [ __CLASS__, 'query_vars' ] );
		add_action( 'template_redirect', [ __CLASS__, 'maybe_render_surface' ], 0 );
		add_filter( 'rest_pre_dispatch', [ __CLASS__, 'route_payment_surface_checkout_request' ], 5, 3 );
		add_action( 'wp_ajax_dtb_checkout_payment_surface_cleanup', [ __CLASS__, 'cleanup_surface_ajax' ] );
		add_action( 'wp_ajax_nopriv_dtb_checkout_payment_surface_cleanup', [ __CLASS__, 'cleanup_surface_ajax' ] );
	}

	public static function query_vars( array $vars ): array {
		$vars[] = self::QUERY_VAR;
		return $vars;
	}

	public static function surface_available(): bool {
		return function_exists( 'WC' )
			&& function_exists( 'do_blocks' )
			&& class_exists( '\\Automattic\\WooCommerce\\Blocks\\Package' )
			&& class_exists( '\\Automattic\\WooCommerce\\Blocks\\Payments\\PaymentMethodRegistry' );
	}

	public static function payment_surface_url( WC_Order $order ): string {
		$token = self::create_token( $order );
		return add_query_arg( self::QUERY_VAR, rawurlencode( $token ), home_url( '/' ) );
	}

	/**
	 * Server-side containment for the native Checkout Block inside the payment surface.
	 *
	 * The client bridge rewrites Store API checkout submissions to the existing-order
	 * endpoint before they leave the iframe. This hook is the defensive backstop: if
	 * WooCommerce Blocks or WooPayments bypasses window.fetch/apiFetch and attempts a
	 * bare /wc/store/v1/checkout POST from the verified payment-surface session, DTB
	 * internally re-dispatches that request to /wc/store/v1/checkout/{order_id} with
	 * the signed order key. This prevents ambient-cart order creation while preserving
	 * WooCommerce/WooPayments ownership of payment execution.
	 */
	public static function route_payment_surface_checkout_request( $result, WP_REST_Server $server, WP_REST_Request $request ) {
		if ( null !== $result || 'POST' !== strtoupper( (string) $request->get_method() ) ) {
			return $result;
		}

		$route = '/' . ltrim( untrailingslashit( (string) $request->get_route() ), '/' );
		if ( '/wc/store/v1/checkout' !== $route ) {
			return $result;
		}
		if ( ! function_exists( 'WC' ) || ! WC()->session || ! function_exists( 'rest_do_request' ) ) {
			return $result;
		}

		$context = self::payment_surface_session_context();
		if ( empty( array_filter( $context, static fn ( $value ) => '' !== (string) $value && 0 !== (int) $value ) ) ) {
			return $result;
		}

		$surface_token = self::active_surface_token_from_request( $request );
		if ( ! self::request_matches_active_surface( $surface_token ) ) {
			self::cleanup_payment_surface_session();
			return new WP_Error( 'dtb_payment_surface_inactive', 'The checkout payment surface is no longer active.', [ 'status' => 403 ] );
		}

		$order_id   = absint( $context['order_id'] );
		$order_key  = sanitize_text_field( (string) $context['order_key'] );
		$session_id = sanitize_text_field( (string) $context['session_id'] );
		$cart_hash  = sanitize_text_field( (string) $context['cart_hash'] );
		if ( $order_id <= 0 || '' === $order_key || '' === $session_id || '' === $cart_hash ) {
			self::cleanup_payment_surface_session();
			return new WP_Error( 'dtb_payment_surface_context_incomplete', 'The checkout payment surface context is incomplete.', [ 'status' => 403 ] );
		}

		$order = function_exists( 'wc_get_order' ) ? wc_get_order( $order_id ) : null;
		if ( ! $order instanceof WC_Order || ! hash_equals( (string) $order->get_order_key(), $order_key ) ) {
			self::cleanup_payment_surface_session();
			return new WP_Error( 'dtb_payment_surface_order_context_invalid', 'The checkout payment surface order context could not be verified.', [ 'status' => 403 ] );
		}

		$state_error = self::assert_surface_state( $order, [ 'session_id' => $session_id, 'cart_hash' => $cart_hash ] );
		if ( $state_error instanceof WP_Error ) {
			self::cleanup_payment_surface_session();
			return $state_error;
		}

		$params = $request->get_json_params();
		if ( ! is_array( $params ) || empty( $params ) ) {
			$params = $request->get_body_params();
		}
		if ( ! is_array( $params ) ) {
			$params = [];
		}
		$params['key'] = $order_key;

		$forward = new WP_REST_Request( 'POST', '/wc/store/v1/checkout/' . $order_id );
		foreach ( (array) $request->get_headers() as $name => $values ) {
			$forward->set_header( (string) $name, implode( ',', array_map( 'strval', (array) $values ) ) );
		}
		$forward->set_header( 'content-type', 'application/json' );
		$forward->set_query_params( (array) $request->get_query_params() );
		$forward->set_body_params( $params );
		$forward->set_body( wp_json_encode( $params ) ?: '{}' );
		$forward->set_param( 'key', $order_key );

		$forwarded = rest_do_request( $forward );
		if ( self::response_is_terminal( $forwarded ) ) {
			self::cleanup_payment_surface_session();
		}

		return $forwarded;
	}

	public static function cleanup_surface_ajax(): void {
		$token = isset( $_POST['surface_token'] ) ? sanitize_text_field( wp_unslash( (string) $_POST['surface_token'] ) ) : '';
		if ( '' === $token ) {
			wp_send_json_error( [ 'code' => 'dtb_payment_surface_cleanup_token_required' ], 400 );
		}

		if ( ! self::request_matches_active_surface( $token ) ) {
			wp_send_json_success( [ 'cleaned' => false, 'reason' => 'inactive_surface' ] );
		}

		self::cleanup_payment_surface_session();
		wp_send_json_success( [ 'cleaned' => true ] );
	}

	public static function maybe_render_surface(): void {
		$token = sanitize_text_field( wp_unslash( (string) ( get_query_var( self::QUERY_VAR ) ?: ( $_GET[ self::QUERY_VAR ] ?? '' ) ) ) );
		if ( '' === $token ) {
			return;
		}

		$verified = self::verify_token( $token );
		if ( $verified instanceof WP_Error ) {
			$error  = $verified;
			$status = (int) ( $error->get_error_data()['status'] ?? 403 );
			status_header( $status );
			nocache_headers();
			wp_die( esc_html( $error->get_error_message() ), esc_html__( 'Checkout payment unavailable', 'drywall-toolbox' ), [ 'response' => $status ] );
		}

		$order = $verified['order'];
		self::prepare_payment_only_surface( $order, $verified['payload'], $token );
		self::render_document( $order, $verified['payload'], $token );
		exit;
	}

	private static function create_token( WC_Order $order ): string {
		$payload = [
			'v'          => self::TOKEN_VERSION,
			'order_id'   => (int) $order->get_id(),
			'key_hash'   => self::order_key_hash( (string) $order->get_order_key() ),
			'session_id' => sanitize_text_field( (string) $order->get_meta( '_dtb_checkout_session_id', true ) ),
			'cart_hash'  => sanitize_text_field( (string) $order->get_meta( '_dtb_checkout_cart_hash', true ) ),
			'exp'        => time() + self::TOKEN_TTL,
		];
		$body = self::base64url_encode( wp_json_encode( $payload ) ?: '{}' );
		return $body . '.' . hash_hmac( 'sha256', $body, self::signing_key() );
	}

	private static function verify_token( string $token ): array|WP_Error {
		$parts = explode( '.', $token, 2 );
		if ( 2 !== count( $parts ) ) {
			return new WP_Error( 'dtb_payment_surface_token_malformed', 'The checkout payment surface token is invalid.', [ 'status' => 403 ] );
		}
		[ $body, $signature ] = $parts;
		$expected = hash_hmac( 'sha256', $body, self::signing_key() );
		if ( ! hash_equals( $expected, $signature ) ) {
			return new WP_Error( 'dtb_payment_surface_token_signature', 'The checkout payment surface token could not be verified.', [ 'status' => 403 ] );
		}
		$payload = json_decode( self::base64url_decode( $body ), true );
		if ( ! is_array( $payload ) || (string) ( $payload['v'] ?? '' ) !== self::TOKEN_VERSION ) {
			return new WP_Error( 'dtb_payment_surface_token_payload', 'The checkout payment surface token payload is invalid.', [ 'status' => 403 ] );
		}
		if ( (int) ( $payload['exp'] ?? 0 ) < time() ) {
			return new WP_Error( 'dtb_payment_surface_token_expired', 'The checkout payment surface has expired. Return to checkout and prepare payment again.', [ 'status' => 409 ] );
		}
		$order = wc_get_order( (int) ( $payload['order_id'] ?? 0 ) );
		if ( ! $order instanceof WC_Order ) {
			return new WP_Error( 'dtb_payment_surface_order_missing', 'The checkout order could not be loaded.', [ 'status' => 404 ] );
		}
		if ( ! hash_equals( self::order_key_hash( (string) $order->get_order_key() ), (string) ( $payload['key_hash'] ?? '' ) ) ) {
			return new WP_Error( 'dtb_payment_surface_order_forbidden', 'The checkout payment surface is not authorized for this order.', [ 'status' => 403 ] );
		}
		if ( method_exists( $order, 'is_paid' ) && $order->is_paid() ) {
			return new WP_Error( 'dtb_payment_surface_order_paid', 'This order has already been paid.', [ 'status' => 409 ] );
		}

		$state_error = self::assert_surface_state( $order, $payload );
		if ( $state_error instanceof WP_Error ) {
			return $state_error;
		}

		return [ 'order' => $order, 'payload' => $payload ];
	}

	private static function assert_surface_state( WC_Order $order, array $payload ): true|WP_Error {
		$session_id = sanitize_text_field( (string) ( $payload['session_id'] ?? '' ) );
		$cart_hash  = sanitize_text_field( (string) ( $payload['cart_hash'] ?? '' ) );
		if ( '' === $session_id || '' === $cart_hash ) {
			return new WP_Error( 'dtb_payment_surface_token_context_missing', 'The checkout payment surface token is missing checkout context.', [ 'status' => 403 ] );
		}

		if ( ! hash_equals( $session_id, sanitize_text_field( (string) $order->get_meta( '_dtb_checkout_session_id', true ) ) ) ) {
			return new WP_Error( 'dtb_payment_surface_session_mismatch', 'The checkout payment surface session could not be verified.', [ 'status' => 403 ] );
		}
		if ( ! hash_equals( $cart_hash, sanitize_text_field( (string) $order->get_meta( '_dtb_checkout_cart_hash', true ) ) ) ) {
			return new WP_Error( 'dtb_payment_surface_cart_mismatch', 'The checkout payment surface cart context could not be verified.', [ 'status' => 403 ] );
		}

		$row = class_exists( 'DTB_OrderCheckoutSessionRepository' ) ? DTB_OrderCheckoutSessionRepository::find_by_order_id( (int) $order->get_id() ) : null;
		if ( ! is_array( $row ) ) {
			return new WP_Error( 'dtb_payment_surface_session_missing', 'The checkout session for this payment surface could not be verified.', [ 'status' => 409 ] );
		}
		if ( ! hash_equals( $session_id, (string) ( $row['session_id'] ?? '' ) ) || ! hash_equals( $cart_hash, (string) ( $row['cart_hash'] ?? '' ) ) ) {
			return new WP_Error( 'dtb_payment_surface_checkout_state_mismatch', 'The checkout payment surface no longer matches the active checkout state.', [ 'status' => 403 ] );
		}
		if ( ! in_array( (string) ( $row['state'] ?? '' ), [ 'order_created', 'payment_pending' ], true ) ) {
			return new WP_Error( 'dtb_payment_surface_invalid_state', 'The checkout order is not ready for payment.', [ 'status' => 409 ] );
		}

		return true;
	}

	private static function prepare_payment_only_surface( WC_Order $order, array $payload, string $token ): void {
		if ( function_exists( 'WC' ) && WC()->session ) {
			WC()->session->set( 'dtb_payment_surface_order_id', (int) $order->get_id() );
			WC()->session->set( 'dtb_payment_surface_order_key', (string) $order->get_order_key() );
			WC()->session->set( 'dtb_payment_surface_session_id', sanitize_text_field( (string) ( $payload['session_id'] ?? '' ) ) );
			WC()->session->set( 'dtb_payment_surface_cart_hash', sanitize_text_field( (string) ( $payload['cart_hash'] ?? '' ) ) );
			WC()->session->set( 'dtb_payment_surface_token_hash', self::surface_token_hash( $token ) );
			WC()->session->set( 'dtb_payment_surface_started_at', time() );
		}
	}

	private static function render_document( WC_Order $order, array $payload, string $token ): void {
		status_header( 200 );
		nocache_headers();
		header( 'X-Robots-Tag: noindex, nofollow', true );
		header( "Content-Security-Policy: frame-ancestors 'self'", true );
		$origin        = esc_url_raw( home_url() );
		$checkout_path = rest_url( 'wc/store/v1/checkout' );
		$cleanup_url   = admin_url( 'admin-ajax.php' );
		?><!doctype html>
<html <?php language_attributes(); ?>>
<head>
	<meta charset="<?php bloginfo( 'charset' ); ?>">
	<meta name="viewport" content="width=device-width, initial-scale=1">
	<meta name="robots" content="noindex,nofollow">
	<title><?php echo esc_html__( 'Secure payment', 'drywall-toolbox' ); ?></title>
	<script>
	(function(){
		var targetOrigin = <?php echo wp_json_encode( $origin ); ?>;
		var orderId = <?php echo wp_json_encode( (int) $order->get_id() ); ?>;
		var orderKey = <?php echo wp_json_encode( (string) $order->get_order_key() ); ?>;
		var surfaceToken = <?php echo wp_json_encode( $token ); ?>;
		var cleanupUrl = <?php echo wp_json_encode( $cleanup_url ); ?>;
		var checkoutPath = <?php echo wp_json_encode( $checkout_path ); ?>;
		var checkoutApiPath = '/wc/store/v1/checkout';
		var checkoutOrderPath = checkoutPath.replace(/\/?$/, '/') + orderId;
		var bridgeState = { fetch:false, xhr:false, apiFetch:false, captured:false, terminal:false, cleanupSent:false };
		function emit(type, extra){
			if (!window.parent || window.parent === window) return;
			window.parent.postMessage(Object.assign({ type:type, source:'dtb-payment-surface', orderId:orderId, targetOrigin:targetOrigin }, extra || {}), targetOrigin);
		}
		function cleanupSurface(reason){
			if (bridgeState.cleanupSent) return;
			bridgeState.cleanupSent = true;
			try {
				var body = new URLSearchParams();
				body.set('action', 'dtb_checkout_payment_surface_cleanup');
				body.set('surface_token', surfaceToken);
				body.set('reason', reason || '');
				if (navigator.sendBeacon && navigator.sendBeacon(cleanupUrl, body)) return;
				if (window.fetch) window.fetch(cleanupUrl, { method:'POST', body:body, credentials:'same-origin', keepalive:true }).catch(function(){});
			} catch (e) {}
		}
		function terminalEmit(type, extra){
			bridgeState.terminal = true;
			emit(type, extra || {});
			cleanupSurface(type);
		}
		function normalizePath(path){ return String(path || '').replace(/\/$/, ''); }
		function normalizeCheckoutRequest(input){
			var url = '';
			try { url = typeof input === 'string' ? input : String(input && input.url || ''); } catch (e) { url = ''; }
			if (!url) return null;
			var parsed;
			try { parsed = new URL(url, window.location.origin); } catch (e) { return null; }
			var checkout = new URL(checkoutPath, window.location.origin);
			var checkoutOrder = new URL(checkoutOrderPath, window.location.origin);
			var path = normalizePath(parsed.pathname);
			if (parsed.origin !== checkout.origin) return null;
			if (path !== normalizePath(checkout.pathname) && path !== normalizePath(checkoutApiPath)) return null;
			parsed.pathname = checkoutOrder.pathname;
			return parsed.toString();
		}
		function payloadFromBody(body){
			var payload = {};
			if (typeof body === 'string' && body) {
				try { payload = JSON.parse(body); } catch (e) { payload = {}; }
			} else if (body && typeof FormData !== 'undefined' && body instanceof FormData) {
				body.forEach(function(value, key){ payload[key] = value; });
			} else if (body && typeof URLSearchParams !== 'undefined' && body instanceof URLSearchParams) {
				body.forEach(function(value, key){ payload[key] = value; });
			}
			payload.key = orderKey;
			return payload;
		}
		function bodyWithOrderKey(init){ return JSON.stringify(payloadFromBody(init && init.body)); }
		function headersWithJson(init){
			var headers = new Headers((init && init.headers) || {});
			if (!headers.has('content-type')) headers.set('content-type', 'application/json');
			headers.set('x-dtb-payment-surface-token', surfaceToken);
			return headers;
		}
		function classifyPaymentData(ok, statusCode, data){
			var result = data && (data.payment_result || data);
			var status = String((result && (result.payment_status || result.status || result.result)) || '').toLowerCase();
			if (ok && (status === 'success' || status === 'processing' || status === 'completed')) {
				return { type:'dtb:payment-surface:success', detail:{ status:status, result:result, response:data } };
			}
			if (!ok || status === 'failure' || status === 'failed' || status === 'error' || status === 'cancelled' || status === 'canceled') {
				return { type:'dtb:payment-surface:error', detail:{ status:status || String(statusCode || ''), message:(data && (data.message || (data.error && data.error.message))) || 'Payment could not be completed.', response:data } };
			}
			return null;
		}
		function emitPaymentData(ok, statusCode, data){
			var classified = classifyPaymentData(ok, statusCode, data || {});
			if (classified) terminalEmit(classified.type, classified.detail);
		}
		function emitTransportFailure(message){
			terminalEmit('dtb:payment-surface:error', { message:message || 'Payment request failed.' });
		}
		function handlePaymentResponse(response){
			try {
				response.clone().json().then(function(data){ emitPaymentData(response.ok, response.status, data); }).catch(function(){
					if (!response.ok) emitTransportFailure('Payment request failed with status ' + response.status + '.');
				});
			} catch (e) {}
			return response;
		}
		if (window.fetch) {
			var nativeFetch = window.fetch.bind(window);
			window.fetch = function(input, init){
				var method = String((init && init.method) || (input && input.method) || 'GET').toUpperCase();
				var redirected = method === 'POST' ? normalizeCheckoutRequest(input) : null;
				if (!redirected) return nativeFetch(input, init);
				bridgeState.fetch = true;
				bridgeState.captured = true;
				var nextInit = Object.assign({}, init || {}, { method:'POST', headers:headersWithJson(init || {}), body:bodyWithOrderKey(init || {}) });
				return nativeFetch(redirected, nextInit).then(handlePaymentResponse).catch(function(error){
					emitTransportFailure(error && error.message ? error.message : 'Payment request failed.');
					throw error;
				});
			};
		}
		if (window.XMLHttpRequest) {
			var NativeXHR = window.XMLHttpRequest;
			window.XMLHttpRequest = function(){
				var xhr = new NativeXHR();
				var nativeOpen = xhr.open;
				var nativeSend = xhr.send;
				var redirected = null;
				var listenersAttached = false;
				function attachListeners(){
					if (listenersAttached) return;
					listenersAttached = true;
					xhr.addEventListener('load', function(){
						var data = {};
						try { data = xhr.responseText ? JSON.parse(xhr.responseText) : {}; } catch (e) { data = {}; }
						emitPaymentData(xhr.status >= 200 && xhr.status < 300, xhr.status, data);
						if (xhr.status >= 400 && !bridgeState.terminal) emitTransportFailure('Payment request failed with status ' + xhr.status + '.');
					});
					xhr.addEventListener('error', function(){ emitTransportFailure('Payment request failed due to a network error.'); });
					xhr.addEventListener('timeout', function(){ emitTransportFailure('Payment request timed out.'); });
					xhr.addEventListener('abort', function(){ emitTransportFailure('Payment request was aborted.'); });
				}
				xhr.open = function(method, url){
					redirected = String(method || '').toUpperCase() === 'POST' ? normalizeCheckoutRequest(url) : null;
					return nativeOpen.apply(xhr, [method, redirected || url].concat(Array.prototype.slice.call(arguments, 2)));
				};
				xhr.send = function(body){
					if (redirected) {
						bridgeState.xhr = true;
						bridgeState.captured = true;
						attachListeners();
						try { xhr.setRequestHeader('content-type', 'application/json'); } catch (e) {}
						try { xhr.setRequestHeader('x-dtb-payment-surface-token', surfaceToken); } catch (e) {}
						return nativeSend.call(xhr, JSON.stringify(payloadFromBody(body)));
					}
					return nativeSend.apply(xhr, arguments);
				};
				return xhr;
			};
		}
		function installApiFetchBridge(){
			if (!window.wp || !window.wp.apiFetch || typeof window.wp.apiFetch.use !== 'function' || window.wp.apiFetch.__dtbPaymentSurfaceBridge) return false;
			window.wp.apiFetch.__dtbPaymentSurfaceBridge = true;
			window.wp.apiFetch.use(function(options, next){
				var method = String((options && options.method) || 'GET').toUpperCase();
				var candidate = options && (options.url || options.path || '');
				var redirected = method === 'POST' ? normalizeCheckoutRequest(candidate) : null;
				if (!redirected) return next(options);
				bridgeState.apiFetch = true;
				bridgeState.captured = true;
				var data = Object.assign({}, (options && options.data) || {});
				data.key = orderKey;
				var headers = Object.assign({}, (options && options.headers) || {}, { 'x-dtb-payment-surface-token': surfaceToken });
				return next(Object.assign({}, options, { path:undefined, url:redirected, method:'POST', headers:headers, data:data })).then(function(responseData){
					emitPaymentData(true, 200, responseData);
					return responseData;
				}).catch(function(error){
					emitTransportFailure(error && error.message ? error.message : 'Payment request failed.');
					throw error;
				});
			});
			return true;
		}
		var apiFetchAttempts = 0;
		var apiFetchTimer = window.setInterval(function(){
			apiFetchAttempts += 1;
			if (installApiFetchBridge() || apiFetchAttempts > 40) window.clearInterval(apiFetchTimer);
		}, 50);
		window.addEventListener('pagehide', function(){
			if (!bridgeState.terminal && !bridgeState.captured) cleanupSurface('abandoned');
		});
		window.dtbPaymentSurfaceEmit = emit;
		window.dtbPaymentSurfaceBridgeState = bridgeState;
	})();
	</script>
	<?php wp_head(); ?>
	<style>
		body.dtb-payment-surface{margin:0;background:#fff;color:#0f172a;font-family:inherit}.dtb-payment-surface__wrap{max-width:760px;margin:0 auto;padding:16px}.dtb-payment-surface__title{margin:0 0 12px;font-size:13px;font-weight:900;letter-spacing:.12em;text-transform:uppercase;color:#3158df}.dtb-payment-surface .wc-block-checkout{margin:0}.dtb-payment-surface .wc-block-components-main,.dtb-payment-surface .wc-block-components-sidebar{width:100%;float:none}.dtb-payment-surface .wp-block-woocommerce-checkout{padding:0}.dtb-payment-surface__fallback{border:1px solid #e5e7eb;border-radius:16px;padding:14px;background:#f8fafc;font-size:14px;line-height:1.45}
	</style>
</head>
<body <?php body_class( 'dtb-payment-surface' ); ?> data-dtb-payment-surface-order="<?php echo esc_attr( (string) $order->get_id() ); ?>">
	<div class="dtb-payment-surface__wrap">
		<p class="dtb-payment-surface__title"><?php echo esc_html__( 'Secure payment', 'drywall-toolbox' ); ?></p>
		<?php
		if ( self::surface_available() ) {
			echo do_blocks( '<!-- wp:woocommerce/checkout /-->' ); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
		} else {
			?>
			<div class="dtb-payment-surface__fallback" role="status">
				<?php echo esc_html__( 'WooCommerce Checkout Blocks are not available. Return to checkout and try again after payment services are enabled.', 'drywall-toolbox' ); ?>
			</div>
			<?php
		}
		?>
	</div>
	<script>
	(function(){
		var emit = window.dtbPaymentSurfaceEmit || function(){};
		function resize(){ emit('dtb:payment-surface:resize', { height: Math.max(document.documentElement.scrollHeight, document.body ? document.body.scrollHeight : 0) }); }
		window.addEventListener('load', function(){ emit('dtb:payment-surface:ready', { bridge:window.dtbPaymentSurfaceBridgeState || null }); resize(); });
		window.addEventListener('resize', resize);
		new MutationObserver(resize).observe(document.documentElement, { childList:true, subtree:true, attributes:true });
		if (window.wp && window.wp.data && typeof window.wp.data.subscribe === 'function') {
			window.wp.data.subscribe(function(){ resize(); });
		}
	})();
	</script>
	<?php wp_footer(); ?>
</body>
</html><?php
	}

	private static function payment_surface_session_context(): array {
		if ( ! function_exists( 'WC' ) || ! WC()->session ) {
			return [];
		}
		return [
			'order_id'   => absint( WC()->session->get( 'dtb_payment_surface_order_id' ) ),
			'order_key'  => sanitize_text_field( (string) WC()->session->get( 'dtb_payment_surface_order_key' ) ),
			'session_id' => sanitize_text_field( (string) WC()->session->get( 'dtb_payment_surface_session_id' ) ),
			'cart_hash'  => sanitize_text_field( (string) WC()->session->get( 'dtb_payment_surface_cart_hash' ) ),
		];
	}

	private static function active_surface_token_from_request( WP_REST_Request $request ): string {
		$token = sanitize_text_field( (string) $request->get_header( 'x-dtb-payment-surface-token' ) );
		if ( '' !== $token ) {
			return $token;
		}

		$referer = sanitize_text_field( (string) $request->get_header( 'referer' ) );
		if ( '' === $referer ) {
			return '';
		}
		$query = (string) wp_parse_url( $referer, PHP_URL_QUERY );
		if ( '' === $query ) {
			return '';
		}
		parse_str( $query, $params );
		return sanitize_text_field( (string) ( $params[ self::QUERY_VAR ] ?? '' ) );
	}

	private static function request_matches_active_surface( string $token ): bool {
		if ( '' === $token || ! function_exists( 'WC' ) || ! WC()->session ) {
			return false;
		}
		$stored = sanitize_text_field( (string) WC()->session->get( 'dtb_payment_surface_token_hash' ) );
		return '' !== $stored && hash_equals( $stored, self::surface_token_hash( $token ) );
	}

	private static function cleanup_payment_surface_session(): void {
		if ( ! function_exists( 'WC' ) || ! WC()->session ) {
			return;
		}
		foreach ( self::SESSION_KEYS as $key ) {
			if ( method_exists( WC()->session, '__unset' ) ) {
				WC()->session->__unset( $key );
			} else {
				WC()->session->set( $key, null );
			}
		}
		if ( method_exists( WC()->session, 'save_data' ) ) {
			WC()->session->save_data();
		}
	}

	private static function response_is_terminal( $response ): bool {
		if ( is_wp_error( $response ) ) {
			return true;
		}
		if ( ! $response instanceof WP_REST_Response ) {
			return false;
		}
		if ( (int) $response->get_status() >= 400 ) {
			return true;
		}
		$data = $response->get_data();
		if ( ! is_array( $data ) ) {
			return false;
		}
		$result = is_array( $data['payment_result'] ?? null ) ? $data['payment_result'] : $data;
		$status = strtolower( (string) ( $result['payment_status'] ?? $result['status'] ?? $result['result'] ?? '' ) );
		return in_array( $status, [ 'success', 'processing', 'completed', 'failure', 'failed', 'error', 'cancelled', 'canceled' ], true );
	}

	private static function surface_token_hash( string $token ): string {
		return hash( 'sha256', $token );
	}

	private static function order_key_hash( string $order_key ): string {
		return hash_hmac( 'sha256', $order_key, self::signing_key() );
	}

	private static function signing_key(): string {
		return wp_salt( 'auth' ) . '|dtb-checkout-payment-surface|' . self::TOKEN_VERSION;
	}

	private static function base64url_encode( string $value ): string {
		return rtrim( strtr( base64_encode( $value ), '+/', '-_' ), '=' );
	}

	private static function base64url_decode( string $value ): string {
		$padding = strlen( $value ) % 4;
		if ( $padding ) {
			$value .= str_repeat( '=', 4 - $padding );
		}
		return base64_decode( strtr( $value, '-_', '+/' ), true ) ?: '';
	}
}
