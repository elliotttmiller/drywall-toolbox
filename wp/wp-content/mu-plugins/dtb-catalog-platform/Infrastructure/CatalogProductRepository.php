<?php
defined( 'ABSPATH' ) || exit;

// Transitional bridge: bootstrap now targets the Infrastructure path from the
// remapping spec while the concrete implementation remains in Services.
require_once dirname( __DIR__ ) . '/Services/CatalogProductRepository.php';
