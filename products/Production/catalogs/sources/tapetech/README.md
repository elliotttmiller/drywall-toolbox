# TapeTech packaged shipping specifications

## Authority and data flow

TapeTech's official workbook is the authority for UPC, packaged length, packaged width, packaged height, and packaged weight by TapeTech model. WooCommerce remains the product and order system of record. DTB owns validation, checkout orchestration, integration policy, queues, projections, and observability. Veeqo remains the inventory, warehouse, allocation, fulfillment, label, carrier, and tracking authority.

The normalized source maps only to WooCommerce's standard product fields:

- `GTIN, UPC, EAN, or ISBN`
- `Weight (lbs)`
- `Length (in)`
- `Width (in)`
- `Height (in)`

These are packaged shipping-unit measurements, not bare-tool dimensions. The Veeqo synchronization path must consume the normalized WooCommerce/DTB values. This import does not call Veeqo directly and does not perform live carrier rating.

## Source and audit result

- Official source rows: 154
- Exact normalized SKU matches in the supplied production catalog: 56
- Official models not currently present in the production catalog: 98
- Fuzzy/name-based matches: 0
- Duplicate normalized source models: 0
- Duplicate normalized catalog SKUs: 0

`GSR-TT` contains an official UPC but no packaged imperial dimensions or weight. The importer applies the UPC and preserves existing values for blank official fields.

## Match policy

Only a normalized exact SKU/model match is accepted. Normalization trims whitespace, uppercases, and canonicalizes spacing around hyphens. Product-name similarity is not used. A TapeTech brand/name guard prevents cross-brand contamination. Duplicate source models or catalog SKUs are terminal errors. Unmatched official models remain in the source catalog and audit report without changing the production catalog.

## Execution

Audit only:

```powershell
python scripts/catalog/apply_tapetech_shipping_specs.py `
  --catalog products/Production/catalogs/official/woocommerce_catalog_production_optimized.csv `
  --source products/Production/catalogs/sources/tapetech/tapetech_official_shipping_specs.csv `
  --output products/Production/catalogs/official/woocommerce_catalog_production_optimized.csv `
  --audit products/Production/reports/tapetech_catalog_shipping_cross_reference_audit.csv
```

Apply atomically:

```powershell
python scripts/catalog/apply_tapetech_shipping_specs.py `
  --catalog products/Production/catalogs/official/woocommerce_catalog_production_optimized.csv `
  --source products/Production/catalogs/sources/tapetech/tapetech_official_shipping_specs.csv `
  --output products/Production/catalogs/official/woocommerce_catalog_production_optimized.csv `
  --audit products/Production/reports/tapetech_catalog_shipping_cross_reference_audit.csv `
  --apply
```

## Operational controls

1. Review the generated audit, especially pre-existing nonblank values.
2. Run catalog, SKU, and taxonomy validation.
3. Import the resulting WooCommerce CSV through the controlled catalog workflow.
4. Run DTB catalog API smoke tests.
5. Run Veeqo product/projection reconciliation in non-destructive mode.
6. Confirm representative SKUs in WooCommerce and Veeqo before enabling fulfillment use.
7. Roll back by restoring the prior catalog artifact and rerunning the existing WooCommerce/Veeqo projection repair workflow.

Do not perform direct browser-to-Veeqo writes, synchronous external calls during checkout, or overwrite Veeqo inventory/fulfillment authority from this dataset.
