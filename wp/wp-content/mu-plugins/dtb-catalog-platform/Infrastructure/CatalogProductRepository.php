<?php
defined( 'ABSPATH' ) || exit;

// Transitional bridge: bootstrap now targets the Infrastructure path from the
// remapping spec; implementation is temporarily sourced from Services during
// migration and should be moved fully into Infrastructure.
// TODO(migration): Move CatalogProductRepository implementation from Services
// to Infrastructure per docs/mu-plugins-remapping.md (Current-to-Target
// Mapping -> Catalog), then remove this bridge dependency.
require_once dirname( __DIR__ ) . '/Services/CatalogProductRepository.php';
