<?php
/**
 * DTB Repair Service bootstrap.
 *
 * @package drywall-toolbox
 */

defined( 'ABSPATH' ) || exit;

// Load order: events -> workflows -> queue -> notifications -> rest/CPT -> admin.
dtb_module_require( 'dtb-repair-service/Infrastructure/RepairEventRepository.php' );
dtb_module_require( 'dtb-repair-service/Services/RepairWorkflowService.php' );
dtb_module_require( 'dtb-repair-service/Infrastructure/RepairQueue.php' );
dtb_module_require( 'dtb-repair-service/Infrastructure/RepairNotificationDispatcher.php' );
dtb_module_require( 'dtb-repair-service/Rest/SubmitRepairController.php' );
dtb_module_require( 'dtb-repair-service/Admin/RepairAdminMenu.php' );
