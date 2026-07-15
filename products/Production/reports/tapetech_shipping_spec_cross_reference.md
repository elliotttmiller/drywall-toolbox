# TapeTech shipping specification cross-reference audit

Generated from the official TapeTech workbook `TapeTech UPC Codes, Weights & Dimensions.xlsx`.

Last updated: 2026-07-14.

## Target catalog

```text
products/Production/launch/dtb_woocommerce_official_catalog.csv
```

## Result

- Official source records: 155
- Production launch catalog rows evaluated and preserved: 796
- Exact SKU matches applied by the documented workflow: 56
- Unmatched source records retained for review: 99
- Ambiguous matches: 0
- Existing populated shipping values replaced by official TapeTech packaged values: 4

## Applied fields

For exact SKU matches only:

- `GTIN, UPC, EAN, or ISBN`
- `Weight (lbs)` from TapeTech ship package weight
- `Length (in)` from TapeTech ship box length
- `Width (in)` from TapeTech ship box width
- `Height (in)` from TapeTech ship box height
- `Meta: _dtb_shipping_spec_source`
- `Meta: _dtb_shipping_spec_model`
- `Meta: _dtb_shipping_spec_description`
- `Meta: _dtb_shipping_spec_verified`
- `Meta: _dtb_shipping_package_length_cm`
- `Meta: _dtb_shipping_package_width_cm`
- `Meta: _dtb_shipping_package_height_cm`
- `Meta: _dtb_shipping_package_weight_kg`

No fuzzy, name-only, or description-only match is written. Unmatched source records must remain rejected until catalog onboarding or an explicit reviewed alias mapping is added.

## Existing-value overwrites

Official packaged shipping specifications replaced existing populated shipping values for:

- `14TT` — `Weight (lbs)`, `Length (in)`, `Width (in)`, `Height (in)`
- `CT24TT` — `Weight (lbs)`, `Length (in)`, `Width (in)`, `Height (in)`
- `CT36TT` — `Weight (lbs)`, `Length (in)`, `Width (in)`, `Height (in)`
- `CT42TT` — `Weight (lbs)`, `Length (in)`, `Width (in)`, `Height (in)`

## Integration boundary

WooCommerce remains the product record authority. These package specifications are deterministic catalog inputs that may be projected to Veeqo through the existing server-side integration workflow. They do not make Veeqo a product-authoring authority and do not introduce live carrier rating at checkout.

## Reproduction

Audit only:

```powershell
python scripts/catalog/apply_tapetech_shipping_specs.py `
  --source products/Production/catalogs/sources/tapetech/tapetech_upc_weights_dimensions_official.csv `
  --catalog products/Production/launch/dtb_woocommerce_official_catalog.csv `
  --output products/Production/launch/dtb_woocommerce_official_catalog.csv `
  --audit products/Production/reports/tapetech_shipping_spec_cross_reference.csv
```

Apply after audit review:

```powershell
python scripts/catalog/apply_tapetech_shipping_specs.py `
  --source products/Production/catalogs/sources/tapetech/tapetech_upc_weights_dimensions_official.csv `
  --catalog products/Production/launch/dtb_woocommerce_official_catalog.csv `
  --output products/Production/launch/dtb_woocommerce_official_catalog.csv `
  --audit products/Production/reports/tapetech_shipping_spec_cross_reference.csv `
  --apply
```

Run catalog validation and SKU/taxonomy checks before importing the resulting CSV into WooCommerce. Merge is not deployment, WooCommerce import, or Veeqo synchronization.
