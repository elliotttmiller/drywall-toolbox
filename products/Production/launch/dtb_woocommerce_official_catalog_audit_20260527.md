# Production Launch Catalog Audit

Catalog audited: `products/Production/launch/dtb_woocommerce_official_catalog.csv`  
Audit date: 2026-05-27 (UTC)

## Executive summary

The catalog issues previously identified in this audit have now been remediated in the audited CSV.

- **Variation taxonomy is complete:** all 231 variation rows now carry populated `Categories` and `Tags`.
- **The zero-price purchase blocker is removed:** `PT30CF` is no longer a visible purchasable SKU; it is now held as `hidden_reference` until authoritative pricing is available.
- **Validation status vocabulary is normalized:** `official_source_validated` has been backfilled to `official-source-validated`.
- **Availability signals are no longer fully flattened:** visible rows remain sellable/discoverable, while all hidden/unpublished rows now correctly use `In stock?=0`; numeric stock values were normalized from `100.0` to `100`.
- **Columbia brand tags are normalized:** legacy `Columbia` tag usage has been replaced by canonical `Columbia Tools`.
- **Validation notes are split from true errors:** informational validation messages now live in `Meta: _dtb_validation_notes`, leaving `Meta: _dtb_validation_errors` for actual exceptions only.

The catalog is now in a materially stronger launch state. The only notable remaining data gap is the absence of authoritative GTIN/UPC/EAN values in the available in-repo source material.

---

## Detailed audit findings

### 1) Completeness and structural integrity

### Strengths
- **Row count remains stable:** 738 products (436 simple, 71 variable, 231 variation).
- **No duplicate SKU or slug collisions** were introduced during remediation.
- **Variation integrity remains intact:** all variation rows still resolve to valid variable parents.
- **Variation taxonomy gap resolved:** variation children now inherit parent `Categories` and `Tags` where those fields were previously blank.
- **Visible product image coverage remains complete.**
- **SEO metadata remains populated for visible products.**

### Remaining caveat
- `GTIN, UPC, EAN, or ISBN` is still blank across the catalog because no authoritative identifier data exists in the repository sources used for this file.

---

### 2) Pricing and commerce-mode alignment

### Current state
- **No visible purchasable row has a blank or zero `Regular price`.**
- **`PT30CF` remediation applied:** the row was removed from active purchase flow and converted to `hidden_reference` pending real pricing.
- **Blank-price `standard-catalog` rows were reviewed:** the remaining 53 visible blank-price rows are all `variable` parents, which is acceptable because purchasable child variations carry the transactional pricing.

### Result
- The prior revenue/UX blocker is resolved without inventing placeholder pricing.

---

### 3) Inventory and availability signals

### Current state
- **Hidden/unpublished rows now correctly use `In stock?=0`.**
- **Visible rows now use `In stock?=1`, eliminating the previous all-rows-flat `1` state.**
- **Numeric stock values were normalized** from decimal strings like `100.0` to integer-style values like `100`.
- **No hidden row remains incorrectly marked in stock.**

### Result
- Availability signaling is now materially cleaner and safer for import/use, while preserving visible storefront behavior.

---

### 4) Categorization, tags, and metadata consistency

### Current state
- **Columbia brand tags are canonicalized** to `Columbia Tools`.
- **Validation status taxonomy is consistent** across the file:
  - `ready`: 402
  - `official-brand-catalog-price-validated`: 163
  - `official-brand-catalog-validated`: 84
  - `official-source-validated`: 88
  - `needs_review`: 1
- **Validation note semantics are improved:**
  - `Meta: _dtb_validation_notes`: 23 populated rows
  - `Meta: _dtb_validation_errors`: 1 populated row (`PT30CF`)

### Result
- Metadata is now more reliable for reporting, filtering, ETL, and downstream operational interpretation.

---

### 5) Duplicate/conflict check

### Strengths
- No duplicate SKUs.
- No duplicate slugs.
- No variation-parent conflicts.

### Soft duplicate note
- Repeated replacement-part names such as `Return Spring`, `O-Ring`, and `Bearing Sleeve` still appear across distinct SKUs, but these remain legitimate naming collisions rather than catalog defects.

---

## Remediation summary

| Area | Before | After |
|---|---|---|
| Variation categories/tags | 213 variation rows missing `Categories`/`Tags` | 0 missing |
| Visible purchasable zero-price rows | 1 (`PT30CF`) | 0 |
| Snake_case validation status rows | 23 | 0 |
| Columbia alias-only tag rows | present | 0 |
| Decimal stock strings | 19 (`100.0`) | 0 |
| Informational notes stored as errors | 23 rows | 0 |

---

## Final assessment

The catalog is now launch-ready with the originally identified actionable issues resolved in-file. The remaining GTIN/UPC/EAN gap is a source-data limitation rather than a catalog-integrity defect and can be handled later when manufacturer-grade identifier data becomes available.
