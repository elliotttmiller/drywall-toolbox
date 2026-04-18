# WooCommerce Catalog Audit & Optimization Report

**File:** `frontend/public/wp-catalog.csv`  
**Audit Date:** 2026-04-18  
**Rows Audited:** 959 products (1 header row + 959 data rows across 1,587 raw lines)  
**Brands:** Asgard · Columbia Taping Tools · Platinum Drywall Tools · SurPro · TapeTech  

---

## 1. Executive Summary

The catalog was structurally sound at the field/schema level—no duplicate SKUs, no orphaned
variations, all required WooCommerce columns present—but contained five categories of data
quality issues plus a flat, unordered row layout that made the file difficult to navigate and
maintain. All five issues have been corrected, and the catalog has been fully reorganized into a
logical, brand-within-category hierarchy.

---

## 2. Audit Findings

### 2.1 Character-Encoding Corruption (Severity: High)

| SKU | Column | Before | After |
|---|---|---|---|
| `700010F` | Name | `TapeTechï¿½ï¿½ 700010F Valve Seal (700010F)` | `TapeTech® 700010F Valve Seal (700010F)` |
| `051001` | Name | `TapeTechï¿½ï¿½ 051001 Outlet Valve Handle (051001)` | `TapeTech® 051001 Outlet Valve Handle (051001)` |

**Root cause:** The registered trademark symbol `®` (U+00AE) was saved as raw UTF-8 bytes
(`0xC2 0xAE`) and then read back as Latin-1, producing the three-byte garbage sequence
`ï¿½`. This causes visible corruption in the WooCommerce storefront product title.

**Fix applied:** Replaced every occurrence of `ï¿½ï¿½` with `®` across all columns.

---

### 2.2 Brand Attribute Value Inconsistency (Severity: Medium)

The **`Brands`** column consistently used `"Platinum Drywall Tools"` for the 40 Platinum rows,
but the **`Attribute 1 value(s)`** column (the global `Brand` attribute surfaced on the product
page) used the truncated value `"Platinum"`. This inconsistency would cause the storefront Brand
filter to display "Platinum" while the rest of the site referred to the full brand name.

**Fix applied:** All 40 Platinum rows now have `Attribute 1 value(s)` = `"Platinum Drywall Tools"`.

---

### 2.3 Redundant Descriptions on Variation Rows (Severity: Medium)

All 175 variation rows carried full copies of the parent product's `Description` and
`Short description`. WooCommerce variation rows do not display their own description—the
parent's description is always shown—so this data is never rendered and only bloats the CSV.
More importantly it signals to search-engine crawlers (if descriptions are ever exposed as
structured data) that hundreds of near-duplicate pages exist.

**Fix applied:** `Description` and `Short description` cleared to empty string on all 175
variation rows. Parent rows retain their full content.

---

### 2.4 Missing `Backorders allowed?` Value for All Platinum Rows (Severity: Low)

All 40 Platinum Drywall Tools rows (5 variable parents, 15 variations, 20 simple products) had
a blank `Backorders allowed?` field. WooCommerce treats a blank as "notify", which silently
enables backorders on those SKUs—almost certainly unintentional.

**Fix applied:** Set to `"0"` (do not allow) for all 40 rows, consistent with every other brand
in the catalog.

---

### 2.5 Row Ordering: Flat / Unsorted (Severity: Medium)

The original file appended products in historical insertion order—Asgard flat boxes first, then
a mix of variation rows interspersed with unrelated products, Platinum items scattered
throughout, Columbia parts immediately before TapeTech parts. There was no logical grouping by
product type, making the file hard to scan, audit, or extend manually.

**Fix applied:** See Section 3 below.

---

### 2.6 Missing Product Images (Informational — Not Fixed)

Nine products have no image URL in the `Images` column. These are valid data gaps (images have
not yet been uploaded) rather than formatting errors, so they were not altered. They are listed
here for follow-up:

| SKU | Name |
|---|---|
| `12FBBA` | Columbia 12" Fat Boy Automatic Assist Drywall Flat Box (variation) |
| `8FFBA` | Columbia 8" Automatic Assist Drywall Flat Box (variation) |
| `AH73` | Columbia 3" Angle Head Tension Spring (variation) |
| `AH8` | Columbia Angle Head Retainer Clip |
| `CT128A` | Columbia Taper Shaft Guide Roller Bushing |
| `CT20` | Columbia Taper Hinge Block |
| `CT35` | Columbia Taper Cap Reinforcing Tab |
| `CT5` | Columbia Taper Right Wafer Bushing |
| `CT97` | Columbia Taper Mud Supply Valve Body |

---

### 2.7 Missing Price Data (Informational — Not Fixed)

851 rows have no `Regular price`. Of these:

- **175** are **variation** rows — correct behavior; WooCommerce reads price from each variation.
- **46** are **variable** rows — correct behavior; price is derived from the cheapest variation.
- **630** are **simple** products with no price.

The 630 unprice simple products are spread across all brands and are predominantly repair/part
SKUs. Price data must be sourced from the supplier price sheets and entered manually or via the
existing price-import pipeline. No price data was fabricated.

---

### 2.8 No Weight or Dimension Data (Informational — Not Fixed)

Zero of 959 rows have values in `Weight (lbs)`, `Length (in)`, `Width (in)`, or `Height (in)`.
These fields are required for live shipping-rate calculation. Populate them from manufacturer
spec sheets to enable real-time carrier rates at checkout.

---

## 3. Catalog Reorganization

### 3.1 Sort Logic

Rows are now sorted by three keys, applied in order:

1. **Functional subcategory** (primary) — products that do the same job are grouped together
   regardless of brand, so buyers and administrators can compare offerings at a glance.
2. **Brand** (secondary, A → Z) — within each category, brands appear in alphabetical order:
   Asgard → Columbia Taping Tools → Platinum Drywall Tools → SurPro → TapeTech.
3. **Product name** (tertiary, A → Z) — ties broken by name.

Variable products are pinned immediately above all of their variations; variations are sorted by
name within each parent block.

### 3.2 Section Map

| # | Functional Section | Brands Present | Row Count |
|---|---|---|---|
| 1 | **Automatic Tapers** | Columbia, Platinum, TapeTech | 9 |
| 2 | **Finishing Boxes** | Asgard, Columbia, Platinum, TapeTech | 73 |
| 3 | **Corner & Angle Tools** | Asgard, Columbia, Platinum, TapeTech | 96 |
| 4 | **Handles & Extensions** | Asgard, Columbia, Platinum, TapeTech | 67 |
| 5 | **Pumps & Accessories** | Asgard, Columbia, Platinum, TapeTech | 43 |
| 6 | **Spotters** | Columbia, Platinum | 6 |
| 7 | **Sanders & Poles** | TapeTech | 16 |
| 8 | **Finishing Trowels** | TapeTech | 23 |
| 9 | **Blades & Knives** | TapeTech | 47 |
| 10 | **Tool Sets & Bundles** | Asgard, Platinum, TapeTech | 8 |
| 11 | **Tools** (misc. accessories) | Platinum, TapeTech | 14 |
| 12 | **Repair Kits & Parts** | Asgard, Columbia, Platinum, TapeTech | 538 |
| 13 | **Stilts** | SurPro | 1 |
| 14 | **Stilt Accessories** | SurPro | 18 |
| | **Total** | | **959** |

---

## 4. Outstanding Recommendations

These improvements are outside the scope of a CSV-level fix but should be addressed before the
catalog is considered fully production-ready.

### 4.1 Add Pricing to All Simple Products
630 simple products have no price. These will show as free (`$0.00`) on the storefront unless
WooCommerce is configured to hide unprice products. Source prices from supplier price lists and
update via WooCommerce CSV import using the `Regular price` column.

### 4.2 Populate Weight and Dimensions
Carrier-calculated shipping (UPS, FedEx, USPS) requires accurate weight and dimensions. Add
values to `Weight (lbs)`, `Length (in)`, `Width (in)`, `Height (in)` for all shippable SKUs.
Manufacturer spec sheets are the authoritative source.

### 4.3 Upload Missing Images for 9 SKUs
See Section 2.6. Upload images and update the `Images` column for the 9 listed SKUs.

### 4.4 Standardize the `"Platinum Drywall Tools > Tools"` Category
The category `Drywall Finishing Tools > Platinum Drywall Tools > Tools` contains a single
product (`PT-BF Platinum Box Filler Attachment`). Miscellaneous accessories like this are better
placed under `Pumps & Accessories` or `Tool Sets & Bundles` so that every brand-level leaf
category has meaningful depth. A matching category exists for TapeTech (`TapeTech > Tools`),
which holds 13 products including mud pans, cleaning nozzles, and adapters—also candidates for
more descriptive subcategories.

### 4.5 Rename `"TapeTech > Tools"` and `"Platinum > Tools"` to More Descriptive Names
Both catch-all `Tools` subcategories contain products that fit better in specific categories:
mud pans → `Finishing Boxes` or a new `Mud Pans & Pans` leaf; gooseneck adapters →
`Handles & Extensions`; cleaning nozzles → `Pumps & Accessories`. Resolving this reduces the
`Tools` bucket and improves browse-ability.

### 4.6 Resolve `"Platinum > Automatic Tapers"` Category Label
`PT-TP` is named *"Platinum Semi Automatic Drywall Taper"* but sits under the `Automatic Tapers`
category. Consider either renaming the category leaf to `Automatic & Semi-Automatic Tapers`
across all brands, or creating a dedicated `Semi-Automatic Tapers` leaf.

### 4.7 Review `Allow customer reviews? = 1` Across All 959 Products
Customer reviews are currently enabled on every product, including individual spare parts (e.g.,
springs, O-rings, washers). Reviews on parts-level SKUs add little value to buyers and create
moderation overhead. Consider disabling reviews on `Repair Kits & Parts` category products.

### 4.8 Set `Sold individually?` Selectively
All 959 products have `Sold individually? = 0`. For high-value complete tool sets and automatic
tapers, setting this to `1` prevents customers from accidentally adding multiples to a single
order.

---

## 5. Summary of Changes Applied to `wp-catalog.csv`

| # | Change | Rows Affected |
|---|---|---|
| 1 | Mojibake `ï¿½ï¿½` → `®` in product names | 2 |
| 2 | `Attribute 1 value(s)` normalized from `"Platinum"` → `"Platinum Drywall Tools"` | 40 |
| 3 | `Description` and `Short description` cleared on variation rows | 175 |
| 4 | `Backorders allowed?` blank → `"0"` (Platinum rows) | 40 |
| 5 | Rows re-ordered: functional subcategory → brand A–Z → product name A–Z | 959 |
| 6 | `Position` column re-sequenced 1–959 to match new row order | 959 |

No rows were added or removed. Row count before and after: **959**.
