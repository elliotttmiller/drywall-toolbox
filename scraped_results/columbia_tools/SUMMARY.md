# Columbia Tools — Scrape Results

**Scraped:** 2026-04-17 09:57:55

## Statistics

| Metric | Value |
|:---|---:|
| Total product pages | 133 |
| Simple products | 124 |
| Variable products (multi-SKU) | 9 |
| Total WC CSV rows | 157 |
| Total images downloaded | 274 |
| Categories | 20 |

## Categories

| Category | Slug | Products |
|:---|:---|---:|
| Angle Heads | `angle-heads` | 8 |
| Applicators | `applicators` | 7 |
| Automatic Tapers | `automatic-tapers` | 6 |
| Compound Tubes | `compound-tubes` | 6 |
| Corner Flushers | `corner-flushers` | 6 |
| Corner Rollers | `corner-rollers` | 9 |
| Corner Tools | `corner-tools` | 5 |
| Finishing Boxes | `finishing-boxes` | 7 |
| Hand Tools | `hand-tools` | 10 |
| Handles | `handles` | 9 |
| Maintenance Kits | `maintenance-kits` | 10 |
| Mud Heads | `mud-heads` | 6 |
| Nailspotters | `nailspotters` | 5 |
| Pumps | `pumps` | 8 |
| Sanders | `sanders` | 5 |
| Semi Automatic Taper | `semi-automatic-taper` | 4 |
| Smoothing Blades | `smoothing-blades` | 6 |
| Suggested Tool Sets | `suggested-tool-sets` | 3 |
| Tool Cases | `tool-cases` | 5 |
| Tool Sets | `tool-sets` | 8 |

## Output Files

| File | Description |
|:---|:---|
| `wp-catalog.csv` | Full WooCommerce import CSV (all categories) |
| `products.json` | Raw scraped data with all fields |
| `by_category/{slug}/wp-catalog.csv` | Per-category WC CSV |
| `images/{slug}/{sku}_{nn}.webp` | Product gallery images (WebP) |

## Variable Product Format

Products with multiple SKUs (different sizes/lengths) are stored as:

- **Variable parent row** — `Type=variable`, `SKU=<common-prefix>`, `Attribute 1 name=SKU`, `Attribute 1 value(s)=SKU1|SKU2|...`
- **Variation rows** — `Type=variation`, `SKU=<variant>`, `Parent=<parent-sku>`, `Attribute 1 value(s)=<this-sku>`
