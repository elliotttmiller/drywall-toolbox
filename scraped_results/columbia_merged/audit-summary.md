# Columbia Catalog End-to-End Integration Summary

**Run at:** 2026-04-17T23:18:05.475465

## Source files

- Live catalog: `/home/runner/work/drywall-toolbox/drywall-toolbox/frontend/public/wp-catalog.csv`
- Columbia scrape: `/home/runner/work/drywall-toolbox/drywall-toolbox/scraped_results/columbia_tools/wp-catalog.csv`
- TSW scrape: `/home/runner/work/drywall-toolbox/drywall-toolbox/scraped_results/tsw_columbia/products_tsw.csv`

## Integration stats

| Metric | Count |
|--------|-------|
| Live rows in | 1553 |
| Columbia Taping Tools rows (live) | 1004 |
| Non-Columbia rows (unchanged) | 549 |
| Scraped Columbia unique SKUs | 83 |
| Scraped TSW unique SKUs | 335 |
| All scraped unique SKUs | 367 |
| Overlap (live ∩ scraped) | 294 |
| Image galleries enriched | 286 (+417 images) |
| New SKUs added from scraped | 73 |
| Live rows out | 1626 |

## Outputs

- Integrated live catalog: `/home/runner/work/drywall-toolbox/drywall-toolbox/frontend/public/wp-catalog.csv`
- Columbia-only CSV: `/home/runner/work/drywall-toolbox/drywall-toolbox/scraped_results/columbia_merged/wp-catalog.csv`
- SKU cross-reference: `/home/runner/work/drywall-toolbox/drywall-toolbox/scraped_results/columbia_merged/sku-cross-reference.csv`
- JSON summary: `/home/runner/work/drywall-toolbox/drywall-toolbox/scraped_results/columbia_merged/audit-summary.json`