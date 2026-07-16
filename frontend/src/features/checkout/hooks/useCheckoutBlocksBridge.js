/**
 * frontend/src/features/checkout/hooks/useCheckoutBlocksBridge.js
 *
 * Runtime guard for the future official WooCommerce Blocks payment bridge.
 * This file intentionally does not register payment methods or render card
 * fields. WooCommerce/payment providers must own those pieces through the
 * official Blocks registry. DTB only decides whether the current runtime is
 * eligible to activate a same-shell payment step or must keep order-pay as the
 * fallback.
 */

function registryFromWindow() {
	if ( typeof window === 'undefined' ) return null;
	const registry = window.wc?.wcBlocksRegistry;
	if ( !registry || typeof registry !== 'object' ) return null;
	return registry;
}

export function hasBlocksRegistry() {
	const registry = registryFromWindow();
	return Boolean(
		registry
		&& typeof registry.registerPaymentMethod === 'function'
		&& typeof registry.registerExpressPaymentMethod === 'function',
	);
}

export function normalizePaymentArchitecture( capabilities = {} ) {
	const architecture = capabilities?.payment_architecture || {};
	const methods = Array.isArray( architecture.methods ) ? architecture.methods : [];
	const registeredMethods = Array.isArray( architecture.registered_methods ) ? architecture.registered_methods : [];
	return {
		contractVersion: String( architecture.contract_version || '' ),
		primaryFlow: String( architecture.primary_flow || 'classic_order_pay_fallback' ),
		sameShellSupported: architecture.same_shell_supported === true,
		fallbackOrderPayEnabled: architecture.fallback_order_pay_enabled !== false,
		serverBlocksReady: architecture.server_blocks_ready === true,
		serverSameShellReady: architecture.server_same_shell_ready === true,
		clientBridgeEnabled: architecture.client_bridge_enabled === true,
		hasRegisteredBlocksMethod: architecture.has_registered_blocks_method === true,
		clientRegistryGlobal: String( architecture.client_registry_global || 'window.wc.wcBlocksRegistry' ),
		methods,
		registeredMethods,
	};
}

export function resolveCheckoutBlocksBridge( capabilities = {} ) {
	const architecture = normalizePaymentArchitecture( capabilities );
	const clientRegistryReady = hasBlocksRegistry();
	const eligibleMethods = architecture.methods.filter(
		( method ) => method?.is_manual !== true && method?.blocks_registered === true && method?.blocks_active === true,
	);
	const sameShellReady = Boolean(
		architecture.sameShellSupported
		&& architecture.clientBridgeEnabled
		&& architecture.serverBlocksReady
		&& architecture.serverSameShellReady
		&& clientRegistryReady
		&& eligibleMethods.length > 0,
	);

	let reason = '';
	if ( !sameShellReady ) {
		if ( !architecture.sameShellSupported ) reason = 'dtb_bridge_not_enabled';
		else if ( !architecture.clientBridgeEnabled ) reason = 'client_bridge_not_enabled';
		else if ( !architecture.serverBlocksReady ) reason = 'server_blocks_unavailable';
		else if ( !architecture.serverSameShellReady ) reason = 'no_registered_blocks_methods';
		else if ( !clientRegistryReady ) reason = 'client_blocks_registry_unavailable';
		else if ( eligibleMethods.length === 0 ) reason = 'no_eligible_payment_methods';
		else reason = 'unknown';
	}

	return {
		architecture,
		clientRegistryReady,
		eligibleMethods,
		sameShellReady,
		fallbackRequired: !sameShellReady && architecture.fallbackOrderPayEnabled,
		reason,
	};
}
