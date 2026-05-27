# Production Launch Catalog Audit

Catalog audited: `products/Production/launch/dtb_woocommerce_official_catalog.csv`  
Audit date: 2026-05-27 (UTC)

## Executive summary

Overall catalog health is **good** and launch-ready in core structure, with strong integrity in SKU uniqueness, parent/variation linkage, SEO metadata coverage, and visible product imagery.

Key risk areas are mostly **data consistency and merchandising hygiene** (not hard import blockers):

- 213/231 variation rows intentionally omit `Categories` and `Tags` (expected in many WooCommerce setups, but weak for downstream analytics/search tooling).
- One visible purchasable variation has a `$0.00` regular price (`PT30CF`), which is a high-priority revenue/UX risk.
- Validation status taxonomy is inconsistent (`official-source-validated` vs `official_source_validated`).
- Inventory semantics are flattened (`In stock?=1` for all 738 rows; only 19 rows carry numeric `Stock`, and those are decimal strings like `100.0`).
- Brand tag normalization is partially inconsistent (`Columbia Tools` brand rows often tagged `Columbia`).

---

## Detailed audit findings

### 1) Completeness and structural integrity

### Strengths
- **Row count:** 738 products (436 simple, 71 variable, 231 variation).
- **No missing critical identifiers:** `SKU`, `Name`, `Type`, `Published`, `Visibility in catalog`, `Brands` are complete across all rows.
- **No duplicate SKU or slug collisions** detected.
- **Variation integrity is strong:** all 231 variation rows resolve to an existing parent SKU, and each parent is type `variable`.
- **Visible product image coverage is complete:** no published/visible product is missing `Images`.
- **SEO metadata is complete for visible products:** `Meta: seo_title`, `Meta: seo_description`, `Meta: seo_canonical`, `Meta: seo_robots` are populated.

### Gaps / caveats
- `Categories` missing in 213 rows and `Tags` missing in 213 rows (almost entirely variation children).
  - Example rows: #3 (`3BH`), #4 (`42BH`), #5 (`4BH`) are variations with blank categories/tags.
- `GTIN, UPC, EAN, or ISBN` is empty for all rows.

---

### 2) Pricing and commerce-mode alignment

### Strengths
- Price formatting is clean (no malformed numeric values).
- No `Sale price` values exceed `Regular price`.
- `quote_only` rows correctly avoid regular prices (362/362 blank).
- All `purchasable` rows have a regular price (35/35).

### Issues
1. **High priority:** One visible, purchasable variation has `Regular price=0`.
   - Row #187, SKU `PT30CF`, `Platinum Stainless Steel Corner Flusher - 3"`, `Published=1`, `Visibility=visible`, `Meta: _dtb_commerce_mode=purchasable`.
2. **Potential mode inconsistency:** 138 `standard-catalog` rows have blank regular price.
   - This may be intentional if these are browse-only catalog entries, but should be explicitly validated against launch commerce goals.
3. Price spread is wide (min non-zero ~$9, max $8756), which is expected for toolsets + parts, but warrants periodic outlier QA checks for misplaced decimal or copied bundle prices.

---

### 3) Inventory and availability signals

### Strengths
- No contradictory publish/visibility combinations (`Published=1` with `hidden`, or unpublished-but-visible).
- `Backorders allowed?` is consistently `0`.

### Issues
1. **Stock-state flattening:** `In stock?=1` for all 738 rows, including quote-only and hidden products.
   - This removes operational nuance (out-of-stock/backorder/preorder) and can reduce buyer trust if frontend exposes it.
2. **Mixed stock datatype:** only 19 rows have `Stock`, all as decimal text `100.0` instead of integer-style quantities.
   - Example: row #149 `PTFA` (`Stock=100.0`), row #186 `PT25CF` (`Stock=100.0`).

---

### 4) Categorization, tags, and metadata consistency

### Strengths
- Top-level category taxonomy is stable (`Drywall Finishing Tools` umbrella for categorized rows).
- Brand fields are internally consistent in dedicated metadata columns:
  - `Brands` ↔ `Meta: _dtb_brand_key` ↔ `Meta: _dtb_brand_label` are coherent for Columbia Tools, TapeTech, and Platinum Drywall Tools.

### Issues
1. **Brand tag normalization drift:** 64 non-variation `Columbia Tools` rows use tag `Columbia` instead of `Columbia Tools`.
   - Example row #2 `COL-180-GRIP-FLAT-BOX-HANDLE` tags: `Columbia,Drywall Finishing Tools`.
2. **Validation status taxonomy drift:** both kebab-case and snake_case values are present.
   - `official-source-validated` (example row #84) vs `official_source_validated` (example row #190).
3. `Meta: _dtb_validation_errors` contains informational validation notes on 23 rows, not only errors.
   - This is usable, but field naming may mislead downstream consumers.

---

### 5) Duplicate/conflict check

### Strengths
- No duplicate SKUs.
- No duplicate slugs.
- No variation-parent conflicts.

### Observed soft duplicates (likely legitimate parts)
- Repeated generic names exist across distinct SKUs (e.g., `Return Spring`, `O-Ring`, `Bearing Sleeve`).
- These are likely valid replacement-part naming patterns, but could benefit from parent/tool context in title for search disambiguation.

---

## Identified issues (with examples)

| Severity | Issue | Example | Impact |
|---|---|---|---|
| High | Visible purchasable product priced at zero | Row #187 `PT30CF` regular price `0` | Revenue leakage, user confusion |
| Medium | Variation rows missing tags/categories | Rows #3-#7 (`3BH`, `42BH`, `4BH`, `5BH`, `6BH`) | Weaker filtering/search/analytics for child SKUs |
| Medium | Validation status naming inconsistency | Row #84 `official-source-validated`; row #190 `official_source_validated` | Fragile reporting/ETL logic |
| Medium | Inventory semantics too coarse | `In stock?=1` on all 738 rows; stock mostly blank | Less accurate merchandising and fulfillment signals |
| Low-Medium | Brand tag drift for Columbia | Row #2 uses `Columbia` tag while brand is `Columbia Tools` | Fragmented tag-based discovery |

---

## External market benchmark observations (2026 spot-check)

Real-time spot checks were performed against representative drywall finishing retailers:

1. **CSR Building Supplies (Shopify endpoint)**  
   Source: `https://csrbuilding.com/en-us/collections/taping-finishing-tools/products.json?limit=250`
   - Returned 250 products / 844 variants in sample.
   - Variant-level fields include **SKU, price, availability, variant options, vendor, product type**.
   - Availability is not flattened (both `available=true` and `available=false` are present).

2. **Walltools (category telemetry payload on page)**  
   Source: `https://walltools.com/automatic-taping-tools/`
   - Embedded payload exposes featured category items with **SKU + product_name + brand + purchase_price + currency**.
   - Example SKUs/prices observed: `COLM-PTS` $5962.61, `COLM-TS` $5746.32, `TAPE-FULL` $4399.00.

### Market-alignment takeaway
Compared to peer stores, your catalog is strong on structured metadata and SEO fields, but can improve by tightening **stock realism**, **status/tag normalization**, and **variation-level merchandising metadata**.

---

## Recommended corrections and improvements

1. **Fix immediate pricing blocker**
   - Correct `PT30CF` (`Regular price=0`) before launch publish.
   - Add a guard in catalog build/audit pipeline: fail or flag visible+purchasable rows where regular price <= 0.

2. **Normalize validation status vocabulary**
   - Canonicalize to one enum style (recommended kebab-case).
   - Backfill existing rows and enforce normalization during export.

3. **Clarify variation metadata policy**
   - If blank variation categories/tags are intentional, document this contract and ensure consumers inherit parent taxonomy.
   - Otherwise, propagate parent categories/tags to child variations for simpler downstream integrations.

4. **Improve inventory truthfulness**
   - Introduce at least three stock states (in-stock / low-stock / out-of-stock) and avoid forcing `In stock?=1` globally.
   - Standardize `Stock` to integer format when present.

5. **Unify brand tags with canonical brand labels**
   - Map `Columbia` tag to `Columbia Tools` consistently (or explicitly support both via controlled synonym mapping).

6. **Expand machine-readable identifiers**
   - Populate GTIN/UPC/EAN where available, especially for parts and high-volume SKUs.

7. **Improve validation-note semantics**
   - If `Meta: _dtb_validation_errors` includes non-errors, rename or split into `validation_notes` and `validation_errors`.

---

## Data trends and anomalies

- Catalog is heavily weighted toward parts and quote workflows:
  - `Meta: _dtb_product_kind=part`: 363 rows.
  - `Meta: _dtb_commerce_mode=quote_only`: 362 rows.
- Brand distribution is launch-focused:
  - Columbia Tools 509, TapeTech 188, Platinum Drywall Tools 41.
- Canonical URLs are consistently relative paths (`/product/...`) across all rows, which is coherent but should match SEO platform expectations.

---

## Final assessment

The launch catalog is structurally robust and close to production quality. The most important pre-launch correction is the single zero-priced purchasable row, followed by normalization work (validation statuses, brand tags, and stock semantics) to improve long-term reliability in search, analytics, syndication, and operations.
