# TapeTech Frontend Schematics Catalog Audit

Generated: 2026-06-08T18:29:20.222208+00:00

## Sources
- frontend: `frontend/public/brands/TapeTech/Schematics`
- researched: `products/scraped_results/brands/TapeTech/schematics/scrape_manifest.json`
- researched: `products/scraped_results/brands/TapeTech/wp-catalog.csv`

## Summary
- schematic_file_count_all: 29
- schematic_file_count_primary: 28
- schematic_file_count_backup: 1
- total_parts_catalog_entries: 1448
- total_hotspot_labels: 694
- parts_name_enriched_from_researched_sources: 298
- parts_missing_hotspots_count: 611
- hotspots_missing_part_catalog_entries_count: 1
- parts_with_unresolved_generic_names_count: 312

## Validation Gaps
- parts_missing_hotspots: 611
- hotspots_missing_part_catalog_entries: 1
- parts_with_unresolved_generic_names: 312

## Schematics
- `07TT/schematic_data.json` (primary, schema=1.x) :: pages=4 parts=326 labels=190 missing_part_hotspots=0 orphan_labels=0
- `07TT/schematic_data_004.json` (primary, schema=1.x) :: pages=1 parts=57 labels=52 missing_part_hotspots=0 orphan_labels=0
- `17TT/schematic_data.json` (primary, schema=2.x) :: pages=1 parts=19 labels=20 missing_part_hotspots=0 orphan_labels=0
- `42TT/schematic_data.json` (primary, schema=2.x) :: pages=1 parts=23 labels=23 missing_part_hotspots=0 orphan_labels=0
- `48TT/schematic_data.backup-20260414-065412.json` (backup, schema=2.x) :: pages=1 parts=29 labels=29 missing_part_hotspots=1 orphan_labels=0
- `48TT/schematic_data.json` (primary, schema=1.x) :: pages=1 parts=29 labels=28 missing_part_hotspots=1 orphan_labels=1
- `76TT/schematic_data.json` (primary, schema=2.x) :: pages=1 parts=33 labels=35 missing_part_hotspots=0 orphan_labels=0
- `80XXTT/schematic_data.json` (primary, schema=2.x) :: pages=1 parts=30 labels=25 missing_part_hotspots=7 orphan_labels=0
- `81XXTT/schematic_data.json` (primary, schema=2.x) :: pages=1 parts=25 labels=26 missing_part_hotspots=2 orphan_labels=0
- `85T/schematic_data.json` (primary, schema=2.x) :: pages=1 parts=4 labels=4 missing_part_hotspots=0 orphan_labels=0
- `88TTE/schematic_data.json` (primary, schema=2.x) :: pages=1 parts=23 labels=23 missing_part_hotspots=0 orphan_labels=0
- `88TTE/schematic_data_1.json` (primary, schema=2.x) :: pages=1 parts=25 labels=25 missing_part_hotspots=0 orphan_labels=0
- `88TTE/schematic_data_2.json` (primary, schema=2.x) :: pages=1 parts=22 labels=22 missing_part_hotspots=0 orphan_labels=0
- `90T/schematic_data.json` (primary, schema=1.x) :: pages=1 parts=6 labels=5 missing_part_hotspots=0 orphan_labels=0
- `CA07TT/schematic_data.json` (primary, schema=2.x) :: pages=1 parts=32 labels=32 missing_part_hotspots=0 orphan_labels=0
- `CA08TT/schematic_data.json` (primary, schema=2.x) :: pages=1 parts=31 labels=32 missing_part_hotspots=0 orphan_labels=0
- `EHC07/schematic_data.json` (primary, schema=1.x) :: pages=1 parts=72 labels=61 missing_part_hotspots=0 orphan_labels=0
- `EHC10/schematic_data.json` (primary, schema=1.x) :: pages=1 parts=68 labels=0 missing_part_hotspots=68 orphan_labels=0
- `EHC12/schematic_data.json` (primary, schema=1.x) :: pages=1 parts=72 labels=0 missing_part_hotspots=72 orphan_labels=0
- `EZ07TT/schematic_data.json` (primary, schema=1.x) :: pages=1 parts=54 labels=0 missing_part_hotspots=54 orphan_labels=0
- `EZ10TT/schematic_data.json` (primary, schema=1.x) :: pages=1 parts=54 labels=0 missing_part_hotspots=54 orphan_labels=0
- `EZ12TT/schematic_data.json` (primary, schema=1.x) :: pages=1 parts=54 labels=0 missing_part_hotspots=54 orphan_labels=0
- `EZ15TT/schematic_data.json` (primary, schema=1.x) :: pages=1 parts=54 labels=0 missing_part_hotspots=54 orphan_labels=0
- `PAHC07/schematic_data.json` (primary, schema=1.x) :: pages=1 parts=81 labels=0 missing_part_hotspots=81 orphan_labels=0
- `PAHC10/schematic_data.json` (primary, schema=1.x) :: pages=1 parts=76 labels=0 missing_part_hotspots=76 orphan_labels=0
- `PAHC12/schematic_data.json` (primary, schema=1.x) :: pages=1 parts=84 labels=0 missing_part_hotspots=84 orphan_labels=0
- `QB06-QSX/schematic_data.json` (primary, schema=2.x) :: pages=1 parts=23 labels=20 missing_part_hotspots=3 orphan_labels=0
- `QB08-QSX/schematic_data.json` (primary, schema=2.x) :: pages=1 parts=24 labels=24 missing_part_hotspots=0 orphan_labels=0
- `XHTT/schematic_data.json` (primary, schema=2.x) :: pages=1 parts=18 labels=18 missing_part_hotspots=0 orphan_labels=0

## Production Readiness Assessment
- status: **not production ready**
- hotspot coverage: **57.80%** (`(1448 - 611) / 1448`)
- resolved part-name coverage: **78.45%** (`(1448 - 312) / 1448`)
- blocking issues:
  - 611 parts cannot be linked to interactive hotspots (cannot support diagram-driven purchase UX)
  - 312 parts still use unresolved generic names (risk of duplicate/ambiguous SKU listings)
  - 1 hotspot references a part not present in the parts list (`48TT/schematic_data.json`)

## Priority Gap Concentration (Where to Fix First)
### Missing hotspot coverage (largest blockers)
- `PAHC12`: 84/84 missing hotspots
- `PAHC07`: 81/81 missing hotspots
- `PAHC10`: 76/76 missing hotspots
- `EHC12`: 72/72 missing hotspots
- `EHC10`: 68/68 missing hotspots
- `EZ07TT`: 54/54 missing hotspots
- `EZ10TT`: 54/54 missing hotspots
- `EZ12TT`: 54/54 missing hotspots
- `EZ15TT`: 54/54 missing hotspots

### Unresolved part naming (largest blockers)
- `EHC07`: 47 unresolved names
- `EZ15TT`: 32 unresolved names
- `07TT/schematic_data_004`: 31 unresolved names
- `EZ07TT`: 29 unresolved names
- `EZ10TT`: 27 unresolved names
- `EZ12TT`: 27 unresolved names
- `QB08-QSX`: 19 unresolved names
- `CA07TT`: 16 unresolved names

## Production-Grade Official TapeTech Parts Catalog Build Plan
1. **Normalize and lock the schematic source set**
   - Use only `primary` schematic files as authoritative inputs for production output.
   - Exclude `backup` files from all production transforms.
   - Treat each `(model, schematic_key, part_id)` as a unique source record.

2. **Run deterministic quality repair passes before catalog export**
   - Pass A (hotspots): close all `parts_missing_hotspots`, starting with PAHC/EHC/EZ families.
   - Pass B (naming): resolve `parts_with_unresolved_generic_names` using researched references (`scrape_manifest.json`, `wp-catalog.csv`), then human review for unresolved remainder.
   - Pass C (referential integrity): resolve all `hotspots_missing_part_catalog_entries` so every hotspot maps to a valid part row.

3. **Build canonical parts master from schematics**
   - Canonical key: `normalized_sku = upper(trim(part_id))`.
   - Required fields: `brand`, `model`, `schematic_key`, `normalized_sku`, `display_id`, `part_name`, `quantity`, `notes`, `source_confidence`.
   - Deduplicate by `(normalized_sku, model)` while preserving schematic-level fitment mapping.

4. **Generate commerce-ready official catalog rows**
   - Build one purchasable parent SKU row per normalized part, then model compatibility/fits metadata from schematic membership.
   - Enforce naming precedence: `frontend_name` -> researched normalized name -> manual override dictionary.
   - Keep an explicit exception ledger for SKUs requiring manual adjudication.

5. **Gate release with hard acceptance criteria**
   - `parts_missing_hotspots_count == 0`
   - `hotspots_missing_part_catalog_entries_count == 0`
   - `parts_with_unresolved_generic_names_count == 0` (or approved exception list with sign-off)
   - deterministic rebuild checksum parity across two consecutive runs

## Recommended Deliverables
- `tapetech_parts_master.csv` (canonical schematic-derived parts inventory)
- `tapetech_parts_fitment_map.csv` (model-to-part compatibility map)
- `tapetech_official_brand_catalog.csv` (commerce import target)
- `tapetech_official_brand_catalog_audit_issues.csv` (exceptions + manual adjudications)
