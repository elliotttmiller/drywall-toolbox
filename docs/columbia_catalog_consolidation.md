# Columbia Catalog Consolidation (Columbia Tools + TSW)

Use `scripts/audit_merge_columbia_catalogs.py` to cross-reference both Columbia source catalogs and produce one WooCommerce import file with merged image fields.

## Why this workflow

- Deduplicates by normalized SKU (case-insensitive, hyphen/underscore agnostic).
- Prefers richer records (description/category/image completeness), with Columbia as tie-break source.
- Merges image sets across both sources per SKU.
- Converts Columbia relative image paths to production URLs when files exist locally.
- Emits an explicit SKU cross-reference file for spot-checking before import.

## Command

```bash
python scripts/audit_merge_columbia_catalogs.py \
  --columbia-csv scraped_results/columbia_tools/wp-catalog.csv \
  --tsw-csv scraped_results/tsw_columbia/products_tsw.csv \
  --columbia-images-root scraped_results/columbia_tools \
  --columbia-image-base-url https://drywalltoolbox.com/wp/wp-content/uploads/columbia-tools \
  --output-dir scraped_results/columbia_merged
```

## Generated outputs

- `scraped_results/columbia_merged/wp-catalog.csv`
- `scraped_results/columbia_merged/sku-cross-reference.csv`
- `scraped_results/columbia_merged/audit-summary.json`
- `scraped_results/columbia_merged/audit-summary.md`

## Production migration sequence

1. Run the merge script and review `audit-summary.md`.
2. Spot-check overlap rows in `sku-cross-reference.csv` (especially high-value SKUs).
3. Upload/verify all image URLs referenced by the merged CSV.
4. Import `wp-catalog.csv` into WooCommerce in a staging environment first.
5. Validate products, categories, and galleries in staging, then run production import.
