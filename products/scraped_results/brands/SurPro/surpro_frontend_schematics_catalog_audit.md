# SurPro Frontend Schematics Catalog Audit

Generated: 2026-06-09T12:16:00.855706+00:00

## Sources
- frontend: `frontend/public/brands/SurPro/Schematics`
- researched: `products/scraped_results/brands/SurPro/scrape_manifest.json`
- researched origin: ['https://stilts.com/pages/instruction-manuals-parts-diagrams']
- researched origin: https://cdn.shopify.com/s/files/1/0439/6056/5922/files/SurPro-S-S1-S1X-Stilts-Manual.pdf
- researched origin: https://cdn.shopify.com/s/files/1/0439/6056/5922/files/SurPro-S2-S2X-Stilts-Manual.pdf

## Summary
- schematic_file_count: 4
- total_parts_catalog_entries: 97
- total_hotspot_labels: 123
- parts_name_enriched_from_manual_sources: 97
- parts_with_unresolved_names_count: 0
- parts_missing_hotspots_count: 0
- hotspots_missing_part_catalog_entries_count: 0
- parts_name_enriched_manual_exact_count: 73
- parts_name_enriched_manual_derived_count: 24

## Schematics
- `S1/schematic_data.json` :: parts=23 hotspots=31 resolved=23 unresolved=0 missing_part_hotspots=0 orphan_hotspots=0
- `S1X/schematic_data.json` :: parts=22 hotspots=28 resolved=22 unresolved=0 missing_part_hotspots=0 orphan_hotspots=0
- `S2/schematic_data.json` :: parts=22 hotspots=29 resolved=22 unresolved=0 missing_part_hotspots=0 orphan_hotspots=0
- `S2X/schematic_data.json` :: parts=30 hotspots=35 resolved=30 unresolved=0 missing_part_hotspots=0 orphan_hotspots=0

## Production Readiness Assessment
- status: **needs manual verification**
- blocking issues:
  - 24 parts use derived name mappings that still need manual verification
