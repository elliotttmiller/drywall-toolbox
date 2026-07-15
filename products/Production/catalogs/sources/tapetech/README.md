# TapeTech packaged shipping specifications

## Authority and data flow

TapeTech's official workbook is the source authority for UPC, packaged length, packaged width, packaged height, and packaged weight by TapeTech model. WooCommerce remains the product record and catalog import authority. DTB owns validation, catalog workflow, checkout orchestration, integration policy, queues, projections, and observability. Veeqo remains inventory, warehouse, allocation, fulfillment, labels, carrier, and tracking authority.

The normalized source maps only to WooCommerce catalog fields and DTB provenance metadata:

- `GTIN, UPC, EAN, or ISBN`
- `Weight (lbs)`
- `Length (in)`
- `Width (in)`
- `Height (in)`
- `Meta: _dtb_shipping_spec_*`
- `Meta: _dtb_shipping_package_*`

These values are packaged shipping-unit measurements, not bare-tool dimensions. The Veeqo synchronization path must consume normalized WooCommerce/DTB values through the existing server-side projection workflow. This import does not call Veeqo directly and does not perform live carrier rating.

## Source and audit result

- Official source rows: 155
- Launch catalog rows evaluated in the documented workflow: 796
- Exact normalized SKU matches: 56
- Official models not currently present in the launch catalog: 99
- Ambiguous matches: 0
- Fuzzy/name-based matches: 0

Unmatched official models remain in the source catalog and audit report until explicit product onboarding or a reviewed alias/mapping workflow exists.

## Match policy

Only a normalized exact SKU/model match is accepted. Normalization trims whitespace, uppercases, and canonicalizes spacing around hyphens. Product-name similarity is not used. A TapeTech brand/name guard prevents cross-brand contamination. Duplicate source models or catalog SKUs are terminal errors. Blank official values preserve existing catalog values rather than inventing package data.

## Execution

Audit only:

```powershell
python scripts/catalog/apply_tapetech_shipping_specs.py `
  --catalog products/Production/launch/dtb_woocommerce_official_catalog.csv `
  --source products/Production/catalogs/sources/tapetech/tapetech_upc_weights_dimensions_official.csv `
  --output products/Production/launch/dtb_woocommerce_official_catalog.csv `
  --audit products/Production/reports/tapetech_shipping_spec_cross_reference.csv
```

Apply atomically:

```powershell
python scripts/catalog/apply_tapetech_shipping_specs.py `
  --catalog products/Production/launch/dtb_woocommerce_official_catalog.csv `
  --source products/Production/catalogs/sources/tapetech/tapetech_upc_weights_dimensions_official.csv `
  --output products/Production/launch/dtb_woocommerce_official_catalog.csv `
  --audit products/Production/reports/tapetech_shipping_spec_cross_reference.csv `
  --apply
```

## Operational controls

1. Run audit-only first and review all updates and unmatched official models.
2. Do not accept fuzzy or description-only matches.
3. Run catalog, SKU, and taxonomy validation before WooCommerce import.
4. Import the resulting CSV through the controlled WooCommerce catalog workflow.
5. Allow existing server-side integration jobs to project eligible product data to Veeqo.
6. Run Veeqo product/projection reconciliation in non-destructive mode.
7. Confirm representative SKUs in WooCommerce and Veeqo before enabling fulfillment use.
8. Roll back by restoring the prior catalog artifact and rerunning the existing WooCommerce/Veeqo projection repair workflow.

Do not perform direct browser-to-Veeqo writes, synchronous external calls during checkout, or overwrite Veeqo inventory/fulfillment authority from this dataset.
