# WooCommerce Product Catalog Audit Report

**File:** `frontend/public/wp-catalog.csv`  
**Audit Date:** 2026-04-05  
**Total Products Audited:** 2,235  
**Total Changes Applied:** 825

---

## 1. Catalog Overview

### Structure

The catalog is a flat WooCommerce-format CSV with **45 fields** per row. All 2,235 products are `simple` type (no variable products, grouped products, or product bundles).

| Field Category | Fields |
|---|---|
| Identity | ID, Type, SKU, GTIN/UPC/EAN/ISBN |
| Content | Name, Short description, Description |
| Commerce | Published, Is featured?, Visibility, Regular price, Sale price, Tax status |
| Inventory | In stock?, Stock, Low stock amount, Backorders allowed?, Sold individually? |
| Physical | Weight (lbs), Length/Width/Height (in) |
| Catalog | Categories, Tags, Brands, Shipping class, Images |
| Attributes | Attribute 1 name/value(s)/visible/global |
| Relationships | Parent, Grouped products, Upsells, Cross-sells |

### Brand Distribution

| Brand | Products | % |
|---|---|---|
| TapeTech | 936 | 41.9% |
| Level5 | 781 | 34.9% |
| Columbia Taping Tools | 383 | 17.1% |
| Graco | 86 | 3.8% |
| Asgard | 28 | 1.3% |
| SurPro | 21 | 0.9% |

### Top-Level Categories

| Category | Products |
|---|---|
| Drywall Finishing Tools | 2,128 |
| Texture Tools | 86 |
| Stilts & Accessories | 21 |

### 46 Distinct Category Paths

The catalog has 46 unique category paths using `>` as a separator (e.g., `Drywall Finishing Tools > TapeTech > Repair Kits & Parts`). The deepest nesting is 3 levels (Top > Brand > Sub-category).

### Price Range

| Metric | Value |
|---|---|
| Minimum | $0.89 |
| Maximum | $10,380.00 |
| Average | $213.87 |

---

## 2. Issues Found

### 2.1 SKU Embedded in Product Names *(Critical — 812 products, 36.3%)*

The most widespread issue was SKUs or part-number codes embedded directly in product names. Six distinct patterns were identified:

| Pattern | Example (Before) | Count |
|---|---|---|
| **A — Leading with dash** | `AH4 - Angle Head Side Blade` | 454 |
| **B — Trailing with dash** | `#8 Flat Washer - FA253` | 228 |
| **B-Alt — Trailing alternate ID** | `#4 Lock Washer - FA205` (SKU field: `59038-A`) | 103 |
| **A2 — Leading with space** | `AH7-3 Angle Head Frame Tension Spring` | 9 |
| **D — Mid-name embedded** | `Graco 287326 Repair Sensor Kit` | 5 |
| **B2 — Trailing with space** | `Graco Widetex Kit 17V692` | 3 |
| **E — Parenthetical** | `Automatic Drywall Taper Repair Kit (501A)` | 2 |

#### SKU Mismatch Sub-Issue (103 products)

In 103 cases, the identifier embedded in the product name was a **different code** from what the SKU field contained. The name held a "catalog-friendly" part number while the SKU field stored an internal or supplier code:

| ID | SKU Field | Code in Name | Name |
|---|---|---|---|
| 29 | `59038-A` | `FA205` | `#4 Lock Washer - FA205` |
| 34 | `FA-298` | `FA298` | `1/4-20 X 7/8in Flat Socket - FA298` |
| 60 | `CFB-15` | `CFB15` | `Angle Box Door Hinge - CFB15` |
| 64 | `354003F-A` | `CFB6` | `Angle Box Mud Supply Valve Unit - CFB6` |

In most of these cases, the name's code is a normalised version of the SKU (dashes stripped, case aligned), confirming they are the same part, just inconsistently formatted.

### 2.2 SKU Field Case Inconsistency *(51 products)*

51 products had lowercase or mixed-case characters in the SKU field (WooCommerce convention is uppercase for part numbers):

| ID | Before | After |
|---|---|---|
| 47 | `fa247` | `FA247` |
| 56 | `ah8a` | `AH8A` |
| 62 | `cfb-15a` | `CFB-15A` |
| 75 | `gCTBOXSET` | `GCTBOXSET` |
| 106 | `COL3 KIt` | `COL3 KIT` |
| 110 | `g3NS &amp; C1H` | `G3NS &AMP; C1H` |
| 145 | `Gctboxset8/10` | `GCTBOXSET8/10` |

### 2.3 Duplicate Product Names *(61 groups after cleanup)*

After applying SKU and identifier removals, 61 groups of products share an identical name. 33 groups were pre-existing duplicates; 28 are newly visible.

These are primarily generic hardware parts (washers, screws, bearings, plates) that legitimately share names across different tools or tool generations. WooCommerce differentiates them by SKU internally, but they may confuse customers in search results.

**Pre-existing examples (unchanged):**
- `Screw` — 10 products (Level5, SKUs: 7444–8401)
- `10in Bottom Plate` — 2 products (Level5, SKUs: 7227, 9253)
- `Banjo Taper, Compound Tube, 10/12" Flat Boxes…` — 2 products (Level5, SKU: `4-650` both)

**Newly visible examples (brand prefix applied where cross-brand):**
- `TapeTech Cotter Pin` — 2 products (SKUs: `059025`, `059143`)
- `TapeTech Special Nut` — 4 products (SKUs: `159026`, `202021`, `603031`, `700037`)

### 2.4 Missing Regular Prices *(1,278 products, 57.2%)*

Over half of all products have an empty `Regular price` field. These products appear in the catalog but cannot be purchased without a price being set. They are concentrated in the parts/repair-kits sub-categories.

### 2.5 Missing Product Images *(667 products, 29.8%)*

667 products have no image URL in the `Images` field. While these display in WooCommerce, the absence of product imagery significantly reduces conversion rates and customer confidence.

### 2.6 Missing Descriptions *(946 products, 42.3%)*

946 products have an empty `Description` field. A further 763 have a `Short description` under 20 characters, effectively blank.

### 2.7 Leading-Zero SKU Inconsistency *(8 products)*

Eight products had names referencing their SKU with a leading zero (e.g., name `Flanged Bearing - 051151`, SKU `51151`). This creates a mismatch between the displayed code and the canonical SKU:

| ID | SKU | Code in Name |
|---|---|---|
| 1995 | `51151` | `051151` |
| 2010 | `50226` | `050226` |
| 2069 | `50259` | `050259` |
| 2070 | `50403` | `050403` |
| 2156 | `56248` | `056248` |

---

## 3. Implemented Changes

All changes have been applied to `frontend/public/wp-catalog.csv`.

### 3.1 SKU Removal from Product Names

**812 product names** were cleaned according to their pattern. For 109 products where name cleanup would have produced a cross-brand duplicate, the brand name was prepended as a prefix to maintain unique, discoverable product titles.

#### Before / After Examples

**Pattern A — Leading SKU with dash (454 products):**
| Before | After |
|---|---|
| `AH4 - Angle Head Side Blade` | `Angle Head Side Blade` |
| `AH7-2 - Angle Head Frame Tension Spring 2in` | `Angle Head Frame Tension Spring 2in` |
| `FA253 - Flat Box Shoe` | `Flat Box Shoe` |
| `CT20 - Taper Hinge Block` | `Taper Hinge Block` |

**Pattern B — Trailing SKU with dash (228 products):**
| Before | After |
|---|---|
| `#8 Flat Washer - FA253` | `#8 Flat Washer` |
| `1/4-28 X 1/4in Set Screw - FA302` | `1/4-28 X 1/4in Set Screw` |
| `Columbia Cover Plate Assembly - CTA87` | `Columbia Cover Plate Assembly` |
| `Columbia Flat Box Shoe (Left) - FFB7A` | `Columbia Flat Box Shoe (Left)` |

**Pattern B-Alt — Trailing alternate ID (103 products):**
| Before | After | SKU Field |
|---|---|---|
| `#4 Lock Washer - FA205` | `#4 Lock Washer` | `59038-A` |
| `#6 Belleville Washer - FA227` | `#6 Belleville Washer` | `809526-A2` |
| `Angle Box Mud Supply Valve Unit - CFB6` | `Angle Box Mud Supply Valve Unit` | `354003F-A` |

**Pattern D — Mid-name embedded (5 products):**
| Before | After |
|---|---|
| `Columbia 5.5" Flat Box Blade Kit 501C55 - 3 Blades, 2 Sets of Skid Covers` | `Columbia 5.5" Flat Box Blade Kit - 3 Blades, 2 Sets of Skid Covers` |
| `Columbia 8" Flat Box Blade Kit 501C8 - 3 Blades, 2 Sets of Skid Covers` | `Columbia 8" Flat Box Blade Kit - 3 Blades, 2 Sets of Skid Covers` |
| `Graco 287326 Repair Sensor Kit` | `Graco Repair Sensor Kit` |
| `TapeTech 501ACF Taper Wear Parts Kit - CF` | `TapeTech Taper Wear Parts Kit - CF` |
| `Tapetech 050003 - Control Valve Wiper` | `Tapetech - Control Valve Wiper` |

**Pattern E — Parenthetical SKU (2 products):**
| Before | After |
|---|---|
| `Automatic Drywall Taper Repair Kit (501A)` | `Automatic Drywall Taper Repair Kit` |
| `Graco Freeflow Inline Gun Kit … (Graco 24B327)` | `Graco Freeflow Inline Gun Kit …` |

**Leading-zero variant cleanup (8 products):**
| Before | After |
|---|---|
| `Flanged Bearing (Long Hub) - 051151` | `Flanged Bearing (Long Hub)` |
| `Guide Roller - 050226` | `Guide Roller` |
| `Taper Tube Non-Oem - 056248` | `Taper Tube Non-OEM` *(also corrected capitalisation)* |
| `250045G - 10" Axle` | `10" Axle` |
| `260024F - 10" TapeTech Combo Wiper` | `10" TapeTech Combo Wiper` |
| `480015F - Stainless Steel Frame (Left)` | `Stainless Steel Frame (Left)` |

**Cross-brand disambiguation with brand prefix (109 products):**
| Before | After | Reason |
|---|---|---|
| `#4 Lock Washer - FA205` | `Columbia Taping Tools #4 Lock Washer` | Shares name with Level5 product after cleanup |
| `059025 - Cotter Pin` | `TapeTech Cotter Pin` | Shares name with Level5 product after cleanup |
| `Anvil - 050043F` | `TapeTech Anvil` | Shares name with Level5 `7035 - Anvil` |

### 3.2 SKU Field Normalised to Uppercase

**51 SKU fields** with lowercase or mixed-case characters were normalised to uppercase. SKU integrity and uniqueness are preserved; only capitalisation changed.

### 3.3 Intentionally Unchanged

| ID | SKU | Name | Reason |
|---|---|---|---|
| 155 | `TAPER` | `Columbia Automatic Taper` | "Taper" is a core descriptor of the product category (automatic taper tool); not a tagged identifier |

---

## 4. Recommendations (Not Yet Implemented)

### 4.1 — Add Prices to 1,278 Products *(High Priority)*
The majority of repair parts and accessories have no `Regular price`. These should be priced from supplier catalogues or set to `0.00` with a "Call for Pricing" note to prevent silent cart failures.

### 4.2 — Add Product Images *(High Priority)*
667 products are image-less. Where manufacturer product photography is not available, brand logos or category placeholder images significantly improve catalog presentation.

### 4.3 — Resolve Duplicate Product Names *(Medium Priority)*
61 name groups remain duplicate. The 28 new groups (same brand, same part name) require further disambiguation — typically by:
- Adding the tool/series compatibility (e.g., "Bearing — Flat Box" vs "Bearing — Taper")
- Adding the size or spec (e.g., "Cotter Pin 3/16" vs "Cotter Pin 1/4"")
- Adding a generation/revision suffix (e.g., "Valve Disc — Gen 2")

The 33 pre-existing duplicates (e.g., 10 products named "Screw") fall into the same category and also warrant manual review.

### 4.4 — Add Product Descriptions *(Medium Priority)*
946 products are missing a `Description`. Short descriptions are missing for 763 products. Descriptions improve SEO, reduce customer support queries, and increase conversion.

### 4.5 — Standardise SKU Format for Columbia Parts *(Low Priority)*
Columbia parts exhibit two overlapping SKU schemes: a "clean" alphanumeric code (e.g., `FA253`, `CFB15`) and a supplier/internal code (e.g., `59038-A`, `809526-A2`). Several products have the supplier code in the SKU field while the catalog-facing code appeared in the product name (now removed). Consider:
- Migrating to the clean alphanumeric code as the primary WooCommerce SKU
- Storing the supplier code in a custom product attribute or meta field

### 4.6 — Review Exact-Duplicate SKUs *(Low Priority)*
Two product bundles each have two rows with the same SKU:
- SKU `4-650`: IDs 885 and 886 (Level5 bundle)
- SKU `4-679`: IDs 954 and 955 (Level5 bundle)
- SKU `4-746`: IDs 1124 and 1125 (Level5 OCA head)

WooCommerce requires unique SKUs per product. These pairs should be merged or given distinct SKUs.

---

## 5. Summary of Changes Applied

| Change Type | Count |
|---|---|
| Names cleaned — leading SKU/code removed (Pattern A) | 454 |
| Names cleaned — trailing SKU removed (Pattern B) | 228 |
| Names cleaned — trailing alternate ID removed (Pattern B-Alt) | 103 |
| Names cleaned — leading/trailing version-suffix code removed | 8 |
| Names cleaned — mid-name embedded SKU removed (Pattern D) | 5 |
| Names cleaned — trailing space-separated SKU removed (Pattern B2) | 3 |
| Names cleaned — parenthetical SKU removed (Pattern E) | 2 |
| Brand prefix added for cross-brand disambiguation | 109 |
| SKU fields normalised to uppercase | 51 |
| Minor typo corrected (`Non-Oem` → `Non-OEM`) | 1 |
| **Total product records modified** | **825** |
| Products unchanged | 1,410 |
| Remaining SKU-in-name (intentional) | 1 |

---

*All SKU values in the `SKU` field remain intact and have not been removed or altered beyond case normalisation. The WooCommerce import will continue to use these SKUs for inventory management, order tracking, and product lookup.*
