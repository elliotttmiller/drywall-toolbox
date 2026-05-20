<?php
defined( 'ABSPATH' ) || exit;

// Transitional bridge: bootstrap now targets the Infrastructure path from the
// remapping spec; implementation is temporarily sourced from Services during
// migration and should be moved fully into Infrastructure.
// TODO(docs/mu-plugins-remapping.md): replace this bridge with a native
// Infrastructure implementation, then remove Services dependency.
require_once dirname( __DIR__ ) . '/Services/CatalogProductRepository.php';
