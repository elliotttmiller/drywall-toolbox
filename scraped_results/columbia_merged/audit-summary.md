# Columbia Catalog End-to-End Integration Summary

**Run at:** 2026-04-17T23:26:58.954575

## Strategy

All existing Columbia Taping Tools rows were **replaced** with a fresh catalog
built entirely from the Columbia Tools scrape and TSW scrape sources.

## Source files

- Live catalog (original): `/home/runner/work/drywall-toolbox/drywall-toolbox/frontend/public/wp-catalog.csv`
- Columbia Tools scrape: `/home/runner/work/drywall-toolbox/drywall-toolbox/scraped_results/columbia_tools/wp-catalog.csv`
- TSW scrape: `/home/runner/work/drywall-toolbox/drywall-toolbox/scraped_results/tsw_columbia/products_tsw.csv`

## Integration stats

| Metric | Count |
|--------|-------|
| Original live rows | 914 |
| Old Columbia rows removed | 367 |
| Non-Columbia rows kept unchanged | 547 |
| Scraped Columbia unique SKUs | 83 |
| Scraped TSW unique SKUs | 335 |
| Total unique scraped SKUs | 367 |
| In both sources (best-of merge) | 51 |
| Only in Columbia scrape | 32 |
| Only in TSW | 284 |
| New Columbia rows built | 367 |
| With multi-image galleries | 72 |
| Final catalog rows | 914 |

## Merge rules

- **Description**: longer HTML from either source wins
- **Images**: Columbia scrape gallery images first (multi-image), TSW canonical image appended
- **Short description**: TSW preferred (clean prose), Columbia scrape fallback
- **SEO meta**: TSW optimized titles/descriptions preferred
- **Tags**: merged and deduplicated (TSW tags first)
- **Category**: Columbia scrape sub-category preferred; mapped to live catalog hierarchy
- **Brand**: normalized to `Columbia Taping Tools`

## Outputs

- Updated live catalog: `/home/runner/work/drywall-toolbox/drywall-toolbox/frontend/public/wp-catalog.csv`
- Columbia-only CSV: `/home/runner/work/drywall-toolbox/drywall-toolbox/scraped_results/columbia_merged/wp-catalog.csv`
- SKU cross-reference: `/home/runner/work/drywall-toolbox/drywall-toolbox/scraped_results/columbia_merged/sku-cross-reference.csv`
- JSON summary: `/home/runner/work/drywall-toolbox/drywall-toolbox/scraped_results/columbia_merged/audit-summary.json`