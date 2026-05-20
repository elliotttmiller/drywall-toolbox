<?php
defined( 'ABSPATH' ) || exit;

// Transitional bridge: bootstrap now targets the Infrastructure path from the
// remapping spec; implementation is temporarily sourced from Services during
// migration and should be moved fully into Infrastructure.
require_once dirname( __DIR__ ) . '/Services/CatalogProductRepository.php';
