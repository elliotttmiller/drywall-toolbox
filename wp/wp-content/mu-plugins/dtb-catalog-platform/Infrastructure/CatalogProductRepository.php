<?php
defined( 'ABSPATH' ) || exit;

// Transitional bridge: bootstrap now targets the Infrastructure path from the
// remapping spec; implementation is temporarily sourced from Services during
// migration and should be moved fully into Infrastructure.
// TODO(docs/mu-plugins-remapping.md, "Current-to-Target Mapping" -> "Catalog"):
// replace this bridge with a native Infrastructure implementation, then remove
// the Services dependency.
require_once dirname( __DIR__ ) . '/Services/CatalogProductRepository.php';
