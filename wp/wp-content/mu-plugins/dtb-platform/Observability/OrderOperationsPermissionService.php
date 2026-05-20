<?php
/**
 * OrderOperationsPermissionService — DTB Platform
 *
 * Capability gate for the Operations dashboard and related AJAX/REST endpoints.
 *
 * @package drywall-toolbox
 */

defined( 'ABSPATH' ) || exit;

/**
 * Return true when the current user has manage_options OR a specific DTB custom capability.
 *
 * @param string $cap DTB custom capability slug, e.g. 'dtb_admin_ops'.
 * @return bool
 */
if ( ! function_exists( 'dtb_ops_can' ) ) {
	function dtb_ops_can( string $cap ): bool {
		if ( ! function_exists( 'current_user_can' ) ) {
			return false;
		}
		return current_user_can( 'manage_options' ) || current_user_can( $cap );
	}
}
