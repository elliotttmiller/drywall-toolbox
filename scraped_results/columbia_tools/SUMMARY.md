# Columbia Tools — Scrape Results

**Scraped:** 2026-04-17 10:13:20

## Statistics

| Metric | Value |
|:---|---:|
| Total product pages | 91 |
| Simple products | 82 |
| Variable products (multi-SKU) | 9 |
| Total WC CSV rows | 115 |
| Total images downloaded | 220 |
| Categories | 20 |

## Categories

| Category | Slug | Products |
|:---|:---|---:|
| Angle Heads | `angle-heads` | 6 |
| Applicators | `applicators` | 5 |
| Automatic Tapers | `automatic-tapers` | 4 |
| Compound Tubes | `compound-tubes` | 3 |
| Corner Flushers | `corner-flushers` | 4 |
| Corner Rollers | `corner-rollers` | 7 |
| Corner Tools | `corner-tools` | 3 |
| Finishing Boxes | `finishing-boxes` | 5 |
| Hand Tools | `hand-tools` | 8 |
| Handles | `handles` | 7 |
| Maintenance Kits | `maintenance-kits` | 8 |
| Mud Heads | `mud-heads` | 4 |
| Nailspotters | `nailspotters` | 3 |
| Pumps | `pumps` | 6 |
| Sanders | `sanders` | 3 |
| Semi Automatic Taper | `semi-automatic-taper` | 1 |
| Smoothing Blades | `smoothing-blades` | 4 |
| Suggested Tool Sets | `suggested-tool-sets` | 1 |
| Tool Cases | `tool-cases` | 3 |
| Tool Sets | `tool-sets` | 6 |

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
