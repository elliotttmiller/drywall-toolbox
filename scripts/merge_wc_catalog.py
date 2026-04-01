#!/usr/bin/env python3
"""
merge_wc_catalog.py

Merges two source CSV files into a single WooCommerce-ready product catalog:
  - wc-product-catalog.csv  (already WooCommerce-formatted, 257 products)
  - combined_parts_catalog.csv  (raw parts catalog, 1 791 parts across 4 brands)

Output:
  - wp-catalog.csv  (WooCommerce import-ready, deduplicated by SKU)

Merge rules:
  1. wc-product-catalog.csv rows are loaded first and take priority on conflicts.
  2. combined_parts_catalog.csv rows are mapped to WooCommerce columns and added
     only when their SKU does not already exist in the WC catalog.
  3. Duplicate SKUs within combined_parts_catalog.csv are collapsed to one row
     (first occurrence wins for the primary fields; schematic references are
     consolidated).
"""

import csv
import os
import re
import sys

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
REPO_ROOT  = os.path.dirname(SCRIPT_DIR)

WC_CATALOG_CSV    = os.path.join(REPO_ROOT, "wc-product-catalog.csv")
PARTS_CATALOG_CSV = os.path.join(REPO_ROOT, "combined_parts_catalog.csv")
OUTPUT_CSV        = os.path.join(REPO_ROOT, "wp-catalog.csv")

# ---------------------------------------------------------------------------
# WooCommerce output column headers (canonical order used by WooCommerce
# CSV importer).
# ---------------------------------------------------------------------------
WC_HEADERS = [
    "ID",
    "Type",
    "SKU",
    "GTIN, UPC, EAN, or ISBN",
    "Name",
    "Published",
    "Is featured?",
    "Visibility in catalog",
    "Short description",
    "Description",
    "Date sale price starts",
    "Date sale price ends",
    "Tax status",
    "Tax class",
    "In stock?",
    "Stock",
    "Low stock amount",
    "Backorders allowed?",
    "Sold individually?",
    "Weight (lbs)",
    "Length (in)",
    "Width (in)",
    "Height (in)",
    "Allow customer reviews?",
    "Purchase note",
    "Sale price",
    "Regular price",
    "Categories",
    "Tags",
    "Shipping class",
    "Images",
    "Download limit",
    "Download expiry days",
    "Parent",
    "Grouped products",
    "Upsells",
    "Cross-sells",
    "External URL",
    "Button text",
    "Position",
    "Brands",
    "Attribute 1 name",
    "Attribute 1 value(s)",
    "Attribute 1 visible",
    "Attribute 1 global",
]

# ---------------------------------------------------------------------------
# Brand -> WooCommerce category path for parts-catalog rows.
# ---------------------------------------------------------------------------
BRAND_CATEGORY = {
    "TapeTech":  "Drywall Finishing Tools > TapeTech > Repair Kits & Parts",
    "Level5":    "Drywall Finishing Tools > Level5 > Parts & Accessories",
    "Graco":     "Texture Tools > Graco > Repair Kits & Parts",
    "Columbia":  "Drywall Finishing Tools > Columbia Taping Tools > Parts & Accessories",
}

# Canonical WooCommerce brand label per internal brand name.
BRAND_LABEL = {
    "TapeTech": "TapeTech",
    "Level5":   "Level5",
    "Graco":    "Graco",
    "Columbia": "Columbia Taping Tools",
}


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def open_csv(path):
    """Open a CSV with UTF-8-sig encoding and error replacement (BOM-safe)."""
    return open(path, encoding="utf-8-sig", errors="replace", newline="")


def normalize_sku(sku):
    """
    Return a canonical comparison key for a SKU:
    strip whitespace, upper-case, and remove leading zeros from all-digit strings.
    """
    s = sku.strip().upper()
    if s.isdigit():
        return s.lstrip("0") or "0"
    return s


def clean_price(price_str):
    """
    Strip currency symbols and whitespace; return an empty string when the
    price is unavailable (N/A, dash, etc.).
    """
    s = (price_str or "").strip()
    if not s or s.lower() in ("n/a", "-", "none", "not available"):
        return ""
    # Remove currency symbols while preserving the numeric value.
    return re.sub(r"[^0-9.]", "", s)


def first_image_url(image_urls_str):
    """
    Return the first usable image URL from a pipe- or semicolon-separated list.
    Skips obvious placeholder/loading SVG URLs.
    """
    if not image_urls_str:
        return ""
    for sep in ("|", ";"):
        if sep in image_urls_str:
            parts = [p.strip() for p in image_urls_str.split(sep)]
            for url in parts:
                if url and "loading.svg" not in url:
                    return url
            break
    # Single URL or no recognised separator
    url = image_urls_str.strip()
    return "" if "loading.svg" in url else url


def empty_wc_row():
    """Return an output row dict with every WC column set to an empty string."""
    return {col: "" for col in WC_HEADERS}


# ---------------------------------------------------------------------------
# 1. Load wc-product-catalog.csv rows (already WC-formatted).
#    Returns (list_of_row_dicts, set_of_normalised_skus).
# ---------------------------------------------------------------------------
def load_wc_catalog():
    rows = []
    skus = set()
    with open_csv(WC_CATALOG_CSV) as f:
        reader = csv.DictReader(f)
        for src in reader:
            row = empty_wc_row()
            # Copy every matching column; ignore unknown source columns.
            for col in WC_HEADERS:
                if col in src:
                    row[col] = src[col]
            rows.append(row)
            sku = src.get("SKU", "").strip()
            if sku:
                skus.add(normalize_sku(sku))
    return rows, skus


# ---------------------------------------------------------------------------
# 2. Convert a combined_parts_catalog.csv row to a WooCommerce row dict.
# ---------------------------------------------------------------------------
def parts_row_to_wc(src):
    """
    Map the 8 columns of combined_parts_catalog.csv to WooCommerce columns.
    Returns a WC row dict.
    """
    row = empty_wc_row()

    brand    = src.get("brand", "").strip()
    sku      = src.get("sku",   "").strip()
    name     = src.get("part_name", "").strip()
    desc     = src.get("description", "").strip()
    price    = clean_price(src.get("price", ""))
    diagrams = src.get("schematic_diagram", "").strip()
    images   = first_image_url(src.get("image_urls", ""))

    # --- Core identification ---
    row["Type"]    = "simple"
    row["SKU"]     = sku
    row["Name"]    = name or sku

    # --- Visibility / status ---
    row["Published"]              = "1"
    row["Is featured?"]           = "0"
    row["Visibility in catalog"]  = "visible"

    # --- Pricing ---
    row["Regular price"] = price

    # --- Inventory defaults ---
    row["Tax status"]          = "taxable"
    row["In stock?"]           = "1"
    row["Backorders allowed?"] = "0"
    row["Sold individually?"]  = "0"

    # --- Reviews ---
    row["Allow customer reviews?"] = "1"

    # --- Taxonomy ---
    row["Categories"] = BRAND_CATEGORY.get(brand, "")
    row["Brands"]     = BRAND_LABEL.get(brand, brand)

    # Use schematic diagram reference as a tag so it's searchable.
    if diagrams:
        row["Tags"] = diagrams

    # --- Content ---
    row["Description"]       = desc
    row["Short description"] = name if name else ""

    # --- Media ---
    row["Images"] = images

    return row


# ---------------------------------------------------------------------------
# 3. Load combined_parts_catalog.csv, deduplicate within that file, and
#    filter out SKUs already in the WC catalog.
# ---------------------------------------------------------------------------
def load_parts_catalog(existing_norm_skus):
    """
    Returns a list of WC-formatted row dicts for parts not already covered by
    the WC catalog.  Within the parts catalog, the first occurrence of each
    normalised SKU wins (same logic as merge_parts_catalogs.py).
    """
    rows = []
    seen_norms = set()

    with open_csv(PARTS_CATALOG_CSV) as f:
        for src in csv.DictReader(f):
            sku  = src.get("sku", "").strip()
            norm = normalize_sku(sku) if sku else ""

            # Skip if already present in WC catalog.
            if norm and norm in existing_norm_skus:
                continue
            # Skip duplicates within the parts catalog.
            if norm and norm in seen_norms:
                continue
            if norm:
                seen_norms.add(norm)

            rows.append(parts_row_to_wc(src))

    return rows


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
def main():
    print(f"Loading WooCommerce catalog: {WC_CATALOG_CSV} …")
    wc_rows, wc_norm_skus = load_wc_catalog()
    print(f"  {len(wc_rows)} products loaded ({len(wc_norm_skus)} unique SKUs)")

    print(f"Loading parts catalog: {PARTS_CATALOG_CSV} …")
    parts_rows = load_parts_catalog(wc_norm_skus)
    print(f"  {len(parts_rows)} new part rows (after deduplication)")

    combined = wc_rows + parts_rows
    print(f"\nTotal rows to write: {len(combined)}")

    print(f"Writing output to {OUTPUT_CSV} …")
    with open(OUTPUT_CSV, "w", encoding="utf-8", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=WC_HEADERS, quoting=csv.QUOTE_ALL)
        writer.writeheader()
        writer.writerows(combined)

    print("Done.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
