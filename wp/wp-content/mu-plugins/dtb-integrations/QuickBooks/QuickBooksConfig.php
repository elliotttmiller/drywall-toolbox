<?php
/**
 * QuickBooks configuration facade.
 *
 * @package drywall-toolbox
 */

defined( 'ABSPATH' ) || exit;

if ( class_exists( 'DTB_QuickBooksConfig' ) ) {
	return;
}

final class DTB_QuickBooksConfig {
	/** Return raw runtime config from the existing QuickBooks module. */
	public static function raw(): array {
		return function_exists( 'dtb_qbo_config' ) ? (array) dtb_qbo_config() : [];
	}

	/** Return whether the integration is enabled. */
	public static function enabled(): bool {
		return function_exists( 'dtb_qbo_enabled' ) ? (bool) dtb_qbo_enabled() : false;
	}

	/** Return a safe diagnostic snapshot without exposing credential values. */
	public static function diagnostics(): array {
		$config = self::raw();

		return [
			'enabled' => self::enabled(),
			'has_client_id' => '' !== (string) ( $config['client_id'] ?? '' ),
			'has_client_credential' => '' !== (string) ( $config['client_secret'] ?? '' ),
			'has_realm_id' => '' !== (string) ( $config['realm_id'] ?? '' ),
			'sandbox' => (bool) ( $config['sandbox'] ?? false ),
			'has_tokens' => function_exists( 'dtb_qbo_load_tokens' ) ? null !== dtb_qbo_load_tokens() : false,
		];
	}
}

function dtb_integrations_qbo_config(): array {
	return DTB_QuickBooksConfig::raw();
}
