/**
 * frontend/src/features/checkout/hooks/useCheckoutBlocksBridge.js
 *
 * Runtime guard for DTB's same-origin WooCommerce Checkout Blocks payment
 * surface. This module does not register payment methods, render card fields,
 * or confirm Stripe payments. WooCommerce and Payment Plugins for Stripe own
 * those pieces through the official Blocks registry inside the WordPress-owned
 * payment document.
 */

export function normalizePaymentArchitecture(capabilities = {}) {
	const architecture = capabilities?.payment_architecture || {};
	const methods = Array.isArray(architecture.methods) ? architecture.methods : [];
	const registeredMethods = Array.isArray(architecture.registered_methods) ? architecture.registered_methods : [];
	return {
		contractVersion: String(architecture.contract_version || ''),
		primaryFlow: String(architecture.primary_flow || 'native_checkout_block_payment_surface'),
		sameShellSupported: architecture.same_shell_supported === true,
		fallbackOrderPayEnabled: architecture.fallback_order_pay_enabled === true,
		paymentSurfaceSupported: architecture.payment_surface_supported === true,
		serverBlocksReady: architecture.server_blocks_ready === true,
		serverSameShellReady: architecture.server_same_shell_ready === true,
		providerSameShellReady: architecture.provider_same_shell_ready === true,
		clientBridgeEnabled: architecture.client_bridge_enabled === true,
		clientRegistryRequired: architecture.client_registry_required === true,
		hasRegisteredBlocksMethod: architecture.has_registered_blocks_method === true,
		clientBridgeRequired: String(architecture.client_bridge_required || 'dtb_checkout_payment_surface_frame'),
		methods,
		registeredMethods,
	};
}

export function resolveCheckoutBlocksBridge(capabilities = {}) {
	const architecture = normalizePaymentArchitecture(capabilities);
	const eligibleMethods = architecture.methods.filter(
		(method) => method?.is_manual !== true
			&& method?.blocks_registered === true
			&& method?.blocks_active === true,
	);
	const sameShellReady = Boolean(
		architecture.contractVersion === '4'
		&& architecture.sameShellSupported
		&& architecture.clientBridgeEnabled
		&& architecture.paymentSurfaceSupported
		&& architecture.serverBlocksReady
		&& architecture.serverSameShellReady
		&& architecture.providerSameShellReady
		&& eligibleMethods.length > 0,
	);

	let reason = '';
	if (!sameShellReady) {
		if (architecture.contractVersion !== '4') reason = 'contract_version_mismatch';
		else if (!architecture.paymentSurfaceSupported) reason = 'native_payment_surface_unavailable';
		else if (!architecture.serverBlocksReady) reason = 'server_blocks_unavailable';
		else if (!architecture.serverSameShellReady) reason = 'no_registered_blocks_methods';
		else if (!architecture.providerSameShellReady) reason = 'stripe_blocks_not_ready';
		else if (!architecture.clientBridgeEnabled) reason = 'client_bridge_not_enabled';
		else if (eligibleMethods.length === 0) reason = 'no_eligible_payment_methods';
		else reason = 'unknown';
	}

	return {
		architecture,
		clientRegistryReady: true,
		eligibleMethods,
		sameShellReady,
		fallbackRequired: !sameShellReady,
		reason,
	};
}
