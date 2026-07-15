# TapeTech shipping specification cross-reference audit

Generated from the official TapeTech workbook `TapeTech UPC Codes, Weights & Dimensions.xlsx`.

## Result

- Official source records: 155
- Exact SKU matches applied: 56
- Unmatched source records: 99
- Ambiguous matches: 0
- Production catalog rows evaluated: 796

## Applied fields

For exact SKU matches only:

- `GTIN, UPC, EAN, or ISBN`
- `Weight (lbs)` from TapeTech ship package weight
- `Length (in)` from TapeTech ship box length
- `Width (in)` from TapeTech ship box width
- `Height (in)` from TapeTech ship box height
- provenance metadata identifying the official source and TapeTech model

No fuzzy or description-only match is written. Unmatched source records must remain rejected until catalog onboarding or an explicit, reviewed alias mapping is added.

## Integration boundary

WooCommerce remains the product record authority. These package specifications are deterministic catalog inputs that may be projected to Veeqo through the existing server-side integration workflow. They do not make Veeqo a product-authoring authority and do not introduce live carrier rating at checkout.

## Reproduction

```powershell
python scripts/catalog/apply_tapetech_shipping_specs.py `
  --source products/Production/catalogs/sources/tapetech/tapetech_upc_weights_dimensions_official.csv `
  --catalog products/Production/catalogs/official/woocommerce_catalog_production_optimized.csv `
  --output products/Production/catalogs/official/woocommerce_catalog_production_optimized.csv `
  --audit products/Production/reports/tapetech_shipping_spec_cross_reference.csv
```

Run catalog validation and smoke checks before importing the resulting CSV into WooCommerce. Merge is not deployment or catalog import.
