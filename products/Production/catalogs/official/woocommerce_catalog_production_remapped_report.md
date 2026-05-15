# Category Remapping Summary Report
**File:** `woocommerce_catalog_production_remapped.csv`  
**Date:** 2026-05-15  
**Base file:** `woocommerce_catalog_production.csv` (1,663 rows incl. header)  
**Output:** 1,538 rows incl. header  
**Net change:** −125 rows removed (excluded products) | 167 rows received a new category label

---

## 1. Authoritative References

| Source | Role |
|--------|------|
| `products/Production/catalogs/config/product_category_map.json` | Canonical functional-category → brand WC-path mapping |
| `products/Production/catalogs/config/product_category_map.csv` | Tabular version of the same schema with search tags |
| `products/Production/catalogs/config/production_taxonomy_policy.json` | Allowed category list, aliases, and controlled-field policy |
| Industry benchmarks: TapeTech.com, Columbia Taping Tools, Dura-Stilts.com, SurPro.com | Cross-validated product type/category labels |

---

## 2. Audit Findings — Problems in the Source Catalog

### 2a. Non-Standard Category Labels ("Flat Boxes")
Three brands used the informal label **"Flat Boxes"** instead of the standard **"Finishing Boxes"**.  
This caused inconsistent navigation across the same functional product type.

| Old Category | Products Affected |
|---|---|
| Asgard > Flat Boxes | 13 rows |
| Platinum Drywall Tools > Flat Boxes | 10 rows |
| TapeTech > Flat Boxes | 29 rows |

**Authority:** `production_taxonomy_policy.json` allowed_categories lists only `Finishing Boxes`.  
**Fix:** Renamed to `Finishing Boxes` and split misplaced items into correct subcategories (see §3).

### 2b. Columbia "Automatic Taping Tools" — Catch-All Category (14 parent SKUs)
Columbia's AT category had been used as a general dump for 14 different product types:
- 4 finishing boxes (flat boxes)
- 4 handles/extensions
- 3 corner tools (angle heads, throttle box)
- 1 nail spotter
- 1 SAT machine
- 1 actual automatic taper

**Fix:** Each product moved to its correct functional category.

### 2c. Columbia "Semi-Automatic Taping Tools" — Entirely Misclassified (7 parent SKUs)
All 7 products in this category were corner tools (flushers, applicators, compound tubes).  
The actual SAT machine (`SAT`) was placed in "Automatic Taping Tools."

**Fix:** Corner tools moved to `Columbia > Corner Tools`; SAT machine moved to `Columbia > Semi-Automatic Taping Tools`.

### 2d. Columbia "Tool Sets" — Non-Standard Label
The label "Tool Sets" was used instead of the standard "Tool Sets & Kits."

**Fix:** Normalized to `Tool Sets & Kits`.

### 2e. TapeTech "Accessories & Adapters" — Miscellaneous Catch-All (10 parent SKUs)
Mixed category with no clear functional identity. Items split by type:
- Drywall floats / wash station → `Mud Pans & Pumps`
- Adapters / accessory kits → `Parts`

### 2f. Platinum "Flat Boxes" — Mixed Product Types (3 parent SKUs)
- `PT-FB` (Platinum Flat Finishing Box) was the only true box
- `PT-BH` / `PT-EBH` were handles (incorrectly placed in flat boxes)

**Fix:** Handles moved to `Handles & Extensions`; box moved to `Finishing Boxes`.

---

## 3. Exclusions Applied

### 3a. Knives & Blades Categories (excluded per specification)

| Brand | Category | Excluded SKUs |
|-------|----------|---------------|
| Columbia | Knives & Blades | `CS` (sander pole?), `TL-3-8` — wait, these are in Sanders |
| Columbia | Knives & Blades | `COL-TOMAHAWK-SMOOTHING-BLADE` → **rescued** (see §4), `CLTHA` → **rescued** |
| TapeTech | Knives & Blades | 55 parent SKUs excluded: finishing knives, taping knives, hot knives, trowels, jab saw, multi-tool, QSX blades, radius trowels, etc. |

**Rationale:** Per problem specification. The "Knives & Blades" category label itself identifies knife products. Industry-standard drywall finishing tool catalogs (TapeTech, Columbia web stores) keep knives as a separate, optional add-on category distinct from the core automatic finishing tool catalog.

### 3b. Sanders (excluded per specification)

| SKU | Name |
|-----|------|
| `CS` | Columbia Sander Head |
| `CSH` | Columbia Sander Pole |
| `PDDM` | Columbia Phantom DDM Sander |
| `TL-3-8` | Columbia Twist Lock Handle with PHA |

**Rationale:** Sanders are a distinct product segment, not part of the drywall taping/finishing tool catalog.

### 3c. Tool Cases — Miscellaneous (excluded as non-standard)

| SKU | Name |
|-----|------|
| `COL-TOOL-CASE` | Columbia Tool Case |

**Rationale:** Carrying cases are ancillary accessories with no independent functional category in the standard taxonomy.

### 3d. Knife-Containing Bundle

| SKU | Name |
|-----|------|
| `HTBDL4` | Columbia Stainless Steel Knife and Mud Pan Set with Bucket |

**Rationale:** Explicitly contains a stainless steel knife as primary component; falls within knife exclusion scope.

---

## 4. Rescued Products from Excluded Categories

Two Columbia "Knives & Blades" SKUs were retained after product-level review:

| SKU | Name | Old Category | New Category | Rationale |
|-----|------|-------------|-------------|-----------|
| `COL-TOMAHAWK-SMOOTHING-BLADE` | Columbia Tomahawk Smoothing Blade | Columbia > Knives & Blades | Columbia > Smoothing Blades | Flat box wiper blade — functionally a smoothing blade, not a handheld knife. Correctly aligns with `production_taxonomy_policy.json` alias rule. |
| `CLTHA` | Columbia Tomalock Adapter | Columbia > Knives & Blades | Columbia > Handles & Extensions | Handle/adapter component of the Tomalock handle system. Misplaced in knives; correctly a handle extension. |

---

## 5. Full Remapping Table

| Parent SKU | From | To | Reason |
|---|---|---|---|
| ASG-FINISHING-BOX | Asgard > Flat Boxes | Asgard > Finishing Boxes | Normalize label |
| ASG-MAXXBOX-FINISHING-BOX | Asgard > Flat Boxes | Asgard > Finishing Boxes | Normalize label |
| ASG-POWER-ASSIST-MAXXBOX-FINISHING-BOX | Asgard > Flat Boxes | Asgard > Finishing Boxes | Normalize label |
| CA08-AD | Asgard > Flat Boxes | Asgard > Corner Tools | Applicator box head is a corner tool |
| PT-FB | Platinum > Flat Boxes | Platinum > Finishing Boxes | Normalize label |
| PT-BH | Platinum > Flat Boxes | Platinum > Handles & Extensions | It's a flat box handle |
| PT-EBH | Platinum > Flat Boxes | Platinum > Handles & Extensions | It's an extendable flat box handle |
| TT-EASYCLEAN-FINISHING-BOX | TapeTech > Flat Boxes | TapeTech > Finishing Boxes | Normalize label |
| TT-MAXXBOX | TapeTech > Flat Boxes | TapeTech > Finishing Boxes | Normalize label |
| TT-POWER-ASSIST-MAXXBOX | TapeTech > Flat Boxes | TapeTech > Finishing Boxes | Normalize label |
| TT-QUICKBOX-QSX | TapeTech > Flat Boxes | TapeTech > Finishing Boxes | Normalize label |
| TTFBC | TapeTech > Flat Boxes | TapeTech > Finishing Boxes | Normalize label |
| 90T | TapeTech > Flat Boxes | TapeTech > Mud Pans & Pumps | Box filler = compound pump |
| 200052F, 202028, 209046, 209047, 250026F, 300026F, 310051F, 501C7, 501C10, 501C12, 502CN | TapeTech > Flat Boxes | TapeTech > Parts | Repair parts / screws / washers |
| COL-AUTOMATIC-TAPER | Columbia > Automatic Taping Tools | Columbia > Automatic Taping Tools | No change — only true AT |
| SAT | Columbia > Automatic Taping Tools | Columbia > Semi-Automatic Taping Tools | It's the SAT machine |
| COL-AUTOMATIC-FAT-BOY-FLAT-BOX | Columbia > Automatic Taping Tools | Columbia > Finishing Boxes | Finishing box |
| COL-AUTOMATIC-FLAT-BOX | Columbia > Automatic Taping Tools | Columbia > Finishing Boxes | Finishing box |
| COL-FAT-BOY-BOX | Columbia > Automatic Taping Tools | Columbia > Finishing Boxes | Finishing box |
| COL-FLAT-FINISHING-BOXES | Columbia > Automatic Taping Tools | Columbia > Finishing Boxes | Finishing box |
| CMH | Columbia > Automatic Taping Tools | Columbia > Handles & Extensions | Closet Monster Handle |
| COL-180-GRIP-FLAT-BOX-HANDLE-FIXED-LENGTH | Columbia > Automatic Taping Tools | Columbia > Handles & Extensions | Handle |
| COL-MATRIX-BOX-HANDLE | Columbia > Automatic Taping Tools | Columbia > Handles & Extensions | Handle |
| COL-PREDATOR-MATRIX-BOX-HANDLE | Columbia > Automatic Taping Tools | Columbia > Handles & Extensions | Handle |
| AHA | Columbia > Automatic Taping Tools | Columbia > Corner Tools | Angle Head Adapter |
| COL-ANGLE-HEAD | Columbia > Automatic Taping Tools | Columbia > Corner Tools | Angle Head |
| COL-THROTTLE-BOX | Columbia > Automatic Taping Tools | Columbia > Corner Tools | Throttle box (corner filling) |
| COL-NAIL-SPOTTER | Columbia > Automatic Taping Tools | Columbia > Nail Spotters | Nail spotter |
| COL-BILLET-MUD-APPLICATOR | Columbia > Semi-Automatic Taping Tools | Columbia > Corner Tools | Applicator = corner tool |
| COL-CAM-LOCK-TUBE | Columbia > Semi-Automatic Taping Tools | Columbia > Corner Tools | Cam lock compound tube |
| COL-COMBO-FLUSHER | Columbia > Semi-Automatic Taping Tools | Columbia > Corner Tools | Corner flusher |
| COL-COMPOUND-TUBE | Columbia > Semi-Automatic Taping Tools | Columbia > Corner Tools | Compound tube |
| COL-DIRECT-FLUSHER | Columbia > Semi-Automatic Taping Tools | Columbia > Corner Tools | Corner flusher |
| COL-PLASTIC-MUD-HEAD-APPLICATOR | Columbia > Semi-Automatic Taping Tools | Columbia > Corner Tools | Applicator |
| COL-STANDARD-FLUSHERS | Columbia > Semi-Automatic Taping Tools | Columbia > Corner Tools | Corner flusher |
| COL-TOOL-SETS | Columbia > Tool Sets | Columbia > Tool Sets & Kits | Normalize label |
| EABS127TTSM | TapeTech > Accessories & Adapters | TapeTech > Mud Pans & Pumps | ABS Float |
| EFLOAT0512N | TapeTech > Accessories & Adapters | TapeTech > Mud Pans & Pumps | EVA Float |
| MWS01-TT | TapeTech > Accessories & Adapters | TapeTech > Mud Pans & Pumps | Mobile Wash Station |
| VABS050 | TapeTech > Accessories & Adapters | TapeTech > Mud Pans & Pumps | ABS Float |
| VABS130 | TapeTech > Accessories & Adapters | TapeTech > Mud Pans & Pumps | ABS Float |
| 90TT | TapeTech > Accessories & Adapters | TapeTech > Parts | Filler Adapter |
| MWS-ACC | TapeTech > Accessories & Adapters | TapeTech > Parts | Accessory kit |
| MWS-PK01 | TapeTech > Accessories & Adapters | TapeTech > Parts | Hose kit |
| MWS01-LW | TapeTech > Accessories & Adapters | TapeTech > Parts | Wheel kit |
| QCATT | TapeTech > Accessories & Adapters | TapeTech > Parts | Quick-Connect Adapter |
| CLTHA | Columbia > Knives & Blades | Columbia > Handles & Extensions | Handle adapter (rescued) |
| COL-TOMAHAWK-SMOOTHING-BLADE | Columbia > Knives & Blades | Columbia > Smoothing Blades | Wiper blade (rescued) |

---

## 6. Final Category Taxonomy

All categories in the output file conform to the standard taxonomy defined in `production_taxonomy_policy.json` plus the addition of `Columbia > Nail Spotters` (parity with Asgard, Platinum, and TapeTech which all have this category).

### Drywall Finishing Tools

| Category | Asgard | Columbia | Platinum | TapeTech |
|----------|--------|----------|----------|----------|
| Automatic Taping Tools | ✓ | ✓ | ✓ | ✓ |
| Semi-Automatic Taping Tools | — | ✓ | ✓ | — |
| Finishing Boxes | ✓ | ✓ | ✓ | ✓ |
| Corner Tools | ✓ | ✓ | ✓ | ✓ |
| Handles & Extensions | ✓ | ✓ | ✓ | ✓ |
| Mud Pans & Pumps | ✓ | ✓ | ✓ | ✓ |
| Nail Spotters | ✓ | ✓ | ✓ | ✓ |
| Smoothing Blades | — | ✓ | — | — |
| Parts | — | ✓ | ✓ | ✓ |
| Tool Sets & Kits | ✓ | ✓ | ✓ | ✓ |

### Stilts & Accessories (unchanged)
- Dura-Stilts: Extension Tubes & Clamps, Hardware, Legs & Brackets, Soles & Floor Plates, Springs & Bearings, Stilts, Straps & Buckles
- SurPro: Accessories, Extension Tubes & Clamps, Hardware, Soles & Floor Plates, Springs & Bearings, Straps & Buckles

---

## 7. Validation Results

| Metric | Original | Remapped |
|--------|----------|----------|
| Total rows | 1,663 | 1,538 |
| Hard errors (validator) | 127 | 75 |
| Warnings | 1 | 1 |

The 75 remaining hard errors are **all pre-existing** `variation_missing_price` issues on TapeTech Tool Sets & Kits and Corner Tools variations that have no `Regular price` in the source data. These are unrelated to category mappings and were present before remapping. The 1 warning (`COL-MUD-PUMP` missing a variation) is also pre-existing.

---

## 8. Assumptions & Decisions

1. **"Exclude knives"** interpreted as: remove all products from `Knives & Blades` categories, with targeted rescues for non-knife items (flat box wiper blades, handle adapters) confirmed via product-name review.
2. **"Exclude sanders"** interpreted as: remove all products in the `Columbia > Sanders` category.
3. **"Miscellaneous categories"** includes: `Tool Cases`, `Tool Sets` (label normalized to `Tool Sets & Kits`), `Accessories & Adapters` (split to Parts and Mud Pans & Pumps).
4. **Columbia > Nail Spotters** added as a new standard category to achieve brand parity. The `production_taxonomy_policy.json` note on Columbia nail spotters suggests this was a planned improvement.
5. **Stilts categories** retained unchanged — they are legitimate, well-structured brand subcategories.
6. **All other product data** (SKU, Name, Description, Pricing, Images, SEO fields, Attributes, etc.) is preserved exactly as-is.
