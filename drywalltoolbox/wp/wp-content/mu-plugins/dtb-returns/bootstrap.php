<?php
/**
 * DTB Returns — bootstrap
 *
 * Loaded by 00-dtb-loader.php. Registers all sub-components.
 *
 * @package drywall-toolbox
 */

defined( 'ABSPATH' ) || exit;

$_dtb_returns_dir = __DIR__;

require_once $_dtb_returns_dir . '/Domain/ReturnStatus.php';
require_once $_dtb_returns_dir . '/Domain/ReturnEntity.php';
require_once $_dtb_returns_dir . '/Infrastructure/ReturnRepository.php';
require_once $_dtb_returns_dir . '/Services/ReturnWorkflowTransitionMap.php';
require_once $_dtb_returns_dir . '/Services/ReturnService.php';
require_once $_dtb_returns_dir . '/Admin/ReturnsPage.php';
require_once $_dtb_returns_dir . '/Rest/ReturnsController.php';
require_once $_dtb_returns_dir . '/Rest/ReturnsAdminQueueController.php';

add_action( 'rest_api_init', 'dtb_returns_rest_register_routes' );
add_action( 'init',          'dtb_returns_register_post_type' );
