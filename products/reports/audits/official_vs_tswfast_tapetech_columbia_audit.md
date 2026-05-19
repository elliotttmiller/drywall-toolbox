# Official vs TSWFast Catalog Audit (TapeTech + Columbia)

Generated: 2026-05-19T04:11:35+00:00

## Source of Truth
- TapeTech official catalog source used in-repo: `products/scraped_results/brands/TapeTech/old/tapetech_master_catalog.csv` (shopamestools.com catalog scrape), with fallback enrichment from `products/scraped_results/brands/TapeTech/wp-catalog.csv`.
- Columbia official catalog source used in-repo: `products/Production/catalogs/other/official_brand_catalog_combined.csv` + Columbia page/image mappings from `products/scraped_results/brands/Columbia/catalog-families.csv` and `products/scraped_results/brands/Columbia/images/manifest.csv`.
- Distributor comparison source: `products/scraped_results/tsw_output/tsw_all_brands.csv`.

## Launch WooCommerce CSV Output
- `products/Production/catalogs/official/woocommerce_catalog_initial_launch_tapetech_columbia.csv`
- Total launch products: **272**
- TapeTech launch products: **152**
- Columbia Tools launch products: **120**
- TapeTech rows with authorized images: **129**
- Columbia Tools rows with authorized images: **93**

## TSWFast Discrepancy Summary
- Missing in TSW (official launch SKU not found): **105**
- Extra in TSW (not in official launch catalog): **605**
- Name mismatches for matched SKUs: **163**

### By Brand
- Columbia: missing_in_tsw=13, extra_in_tsw=228, name_mismatch=105
- TapeTech: missing_in_tsw=92, extra_in_tsw=377, name_mismatch=58

## Detailed Discrepancies
- `products/reports/audits/official_vs_tswfast_tapetech_columbia_discrepancies.csv`

## Notes
- Official manufacturer naming/SKU from the official catalog extract is preserved in the launch CSV.
- TSWFast is used strictly for audit/comparison metadata (`Meta: tsw_*`) and discrepancy reporting.
