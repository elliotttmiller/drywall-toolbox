#!/usr/bin/env python3
"""
scripts/split_catalog_by_brand.py
==================================
Reads ``frontend/public/wp-catalog.csv`` and splits every unique brand into
its own separate CSV file named ``wc-<brand>.csv``, written to a
``scripts/brand-catalogs/`` output directory (created automatically if it
does not already exist).

Brand-extraction logic mirrors ``frontend/src/utils/parseProductCsv.js``:
  1. Primary  – ``"Attribute 1 name"`` column == ``"Brand"``; value taken from
                ``"Attribute 1 value(s)"``
  2. Fallback – Second ``>``-delimited segment of the ``"Categories"`` column

Usage:
    python scripts/split_catalog_by_brand.py

Optional flags:
    --csv   PATH  Path to source wp-catalog.csv      (default: frontend/public/wp-catalog-updated.csv)
    --out   DIR   Output directory for brand CSVs    (default: scripts/brand-catalogs/)
    --dry-run     Print what would be written without creating any files
"""

import argparse
import csv
import os
import re
import sys

# ---------------------------------------------------------------------------
# Defaults
# ---------------------------------------------------------------------------
REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DEFAULT_CSV = os.path.join(REPO_ROOT, "frontend", "public", "wp-catalog-updated.csv")
DEFAULT_OUT = os.path.join(REPO_ROOT, "scripts", "brand-catalogs")


# ---------------------------------------------------------------------------
# Brand helpers
# ---------------------------------------------------------------------------

def extract_brand(row: dict) -> str:
    """Return the brand name for *row*, using the same logic as parseProductCsv.js."""
    # 1. Explicit Brand attribute
    if (row.get("Attribute 1 name") or "").strip().lower() == "brand":
        brand = (row.get("Attribute 1 value(s)") or "").strip()
        if brand:
            return brand
    # 2. Second segment of Categories path
    categories = (row.get("Categories") or "").strip()
    if categories:
        first_entry = categories.split("|")[0].strip()
        segments = [s.strip() for s in first_entry.split(">")]
        if len(segments) >= 2:
            return segments[1]
    return "Unknown"


def brand_to_filename(brand: str) -> str:
    """Convert a brand name to a safe ``wc-<brand>.csv`` filename.

    Steps:
      - Lowercase
      - Replace spaces with hyphens
      - Remove characters that are not alphanumeric or hyphens
      - Prefix with ``wc-``
    """
    slug = brand.lower()
    slug = slug.replace(" ", "-")
    slug = re.sub(r"[^a-z0-9\-]", "", slug)
    return f"wc-{slug}.csv"


# ---------------------------------------------------------------------------
# Core processing
# ---------------------------------------------------------------------------

def process(csv_path: str, out_dir: str, dry_run: bool) -> None:
    print(f"Reading: {csv_path}")

    with open(csv_path, newline="", encoding="utf-8") as fh:
        reader = csv.DictReader(fh)
        fieldnames = reader.fieldnames
        if not fieldnames:
            sys.exit("ERROR: CSV appears to be empty or has no header row.")
        rows = list(reader)

    print(f"Found {len(rows)} product rows.")
    print()

    # Group rows by brand
    brand_rows: dict[str, list[dict]] = {}
    for row in rows:
        brand = extract_brand(row)
        if brand not in brand_rows:
            brand_rows[brand] = []
        brand_rows[brand].append(row)

    # Sort brands alphabetically for consistent output
    sorted_brands = sorted(brand_rows.keys())

    # Build a mapping: brand → filename
    brand_filenames: dict[str, str] = {b: brand_to_filename(b) for b in sorted_brands}

    print(f"Brands found ({len(sorted_brands)}):")
    max_brand_len = max(len(b) for b in sorted_brands) if sorted_brands else 0
    max_file_len  = max(len(f) for f in brand_filenames.values()) if brand_filenames else 0
    for brand in sorted_brands:
        fname = brand_filenames[brand]
        count = len(brand_rows[brand])
        print(f"  {brand:<{max_brand_len}}  →  {fname:<{max_file_len}}  ({count} rows)")
    print()

    if dry_run:
        print(f"Would write brand CSVs to: {out_dir}")
        for brand in sorted_brands:
            fname = brand_filenames[brand]
            print(f"  [DRY RUN] {fname}")
        print()
        print(f"Done. {len(sorted_brands)} brand files would be written.")
        return

    # Create output directory if needed
    os.makedirs(out_dir, exist_ok=True)

    print(f"Writing brand CSVs to: {out_dir}")
    for brand in sorted_brands:
        fname = brand_filenames[brand]
        out_path = os.path.join(out_dir, fname)
        with open(out_path, "w", newline="", encoding="utf-8") as fh:
            writer = csv.DictWriter(fh, fieldnames=fieldnames, quoting=csv.QUOTE_MINIMAL)
            writer.writeheader()
            writer.writerows(brand_rows[brand])
        print(f"  \u2713 {fname}")
    print()
    print(f"Done. {len(sorted_brands)} brand files written.")


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

def main() -> None:
    parser = argparse.ArgumentParser(
        description="Split wp-catalog.csv into per-brand CSV files."
    )
    parser.add_argument("--csv",     default=DEFAULT_CSV, help="Path to source wp-catalog.csv")
    parser.add_argument("--out",     default=DEFAULT_OUT, help="Output directory for brand CSVs")
    parser.add_argument("--dry-run", action="store_true", help="Preview output without writing files")
    args = parser.parse_args()

    if not os.path.isfile(args.csv):
        sys.exit(f"ERROR: CSV not found: {args.csv}")

    process(args.csv, args.out, args.dry_run)


if __name__ == "__main__":
    main()
