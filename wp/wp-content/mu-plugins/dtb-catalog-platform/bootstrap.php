<?php
/**
 * DTB Catalog Platform — Bootstrap
 *
 * Loads catalog-platform module files in dependency order. Runtime hook wiring
 * lives in Application/* files so this bootstrap remains a composition root.
 *
 * @package drywall-toolbox
 */

defined( 'ABSPATH' ) || exit;

if ( defined( 'DTB_CATALOG_PLATFORM_ENABLED' ) && ! DTB_CATALOG_PLATFORM_ENABLED ) {
	return;
}

if ( ! dtb_is_admin_or_rest_request() && ! ( defined( 'WP_CLI' ) && WP_CLI ) ) {
	return;
}

$_dtb_cp = __DIR__;

// Domain.
require_once $_dtb_cp . '/Domain/ProductMeta.php';
require_once $_dtb_cp . '/Domain/ToolFamilies.php';
require_once $_dtb_cp . '/Domain/ToolsetData.php';
require_once $_dtb_cp . '/Domain/CatalogHealthIssue.php';

// Services and infrastructure.
require_once $_dtb_cp . '/Services/BrandNormalizer.php';
require_once $_dtb_cp . '/Services/CategoryNormalizer.php';
require_once $_dtb_cp . '/Services/ToolFamilyResolver.php';
require_once $_dtb_cp . '/Services/CatalogProductNormalizer.php';
require_once $_dtb_cp . '/Infrastructure/CatalogProductRepository.php';
require_once $_dtb_cp . '/Infrastructure/CatalogHealthRepository.php';
require_once $_dtb_cp . '/Services/VariationReadModelService.php';
require_once $_dtb_cp . '/Services/DefaultVariationResolver.php';
require_once $_dtb_cp . '/Services/CatalogFacetService.php';
require_once $_dtb_cp . '/Services/CatalogHealthService.php';
require_once $_dtb_cp . '/Services/ToolsetEligibilityService.php';
require_once $_dtb_cp . '/Services/ToolsetValidationService.php';

// REST controllers.
require_once $_dtb_cp . '/Rest/CatalogFacetsController.php';
require_once $_dtb_cp . '/Rest/CatalogProductsController.php';
require_once $_dtb_cp . '/Rest/ProductDetailController.php';
require_once $_dtb_cp . '/Rest/CompatiblePartsController.php';
require_once $_dtb_cp . '/Rest/ToolsetTemplatesController.php';
require_once $_dtb_cp . '/Rest/ToolsetOptionsController.php';
require_once $_dtb_cp . '/Rest/ToolsetValidationController.php';

// Validation.
require_once $_dtb_cp . '/Validation/CatalogValidationService.php';
require_once $_dtb_cp . '/Validation/ProductMetaValidator.php';
require_once $_dtb_cp . '/Validation/VariationValidator.php';
require_once $_dtb_cp . '/Validation/ToolsetEligibilityValidator.php';
require_once $_dtb_cp . '/Validation/PricingValidator.php';
require_once $_dtb_cp . '/Validation/ImageValidator.php';
require_once $_dtb_cp . '/Validation/SeoValidator.php';

// Application hook wiring and use cases.
require_once $_dtb_cp . '/Application/RegisterCatalogMeta.php';
require_once $_dtb_cp . '/Application/RegisterCatalogRoutes.php';
require_once $_dtb_cp . '/Application/RegisterCatalogHooks.php';
require_once $_dtb_cp . '/Application/RunCatalogHealthScan.php';
require_once $_dtb_cp . '/Application/ResolveCompatibleParts.php';

// Admin / CLI tools.
if ( is_admin() || ( defined( 'WP_CLI' ) && WP_CLI ) ) {
	require_once $_dtb_cp . '/Admin/MetaBackfillTool.php';
	require_once $_dtb_cp . '/Admin/CatalogHealthRenderer.php';
	require_once $_dtb_cp . '/Admin/CatalogHealthActions.php';
	require_once $_dtb_cp . '/Admin/CatalogHealthPage.php';
}

unset( $_dtb_cp );
