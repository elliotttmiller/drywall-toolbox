#!/usr/bin/env python3
"""
scripts/split_catalog_by_brand.py
===================================
Reads ``frontend/public/wp-catalog.csv`` and splits it into one CSV file per
brand, writing the results to ``scripts/brand-catalogs/``.

Brand extraction priority
--------------------------
1. ``Attribute 1 name`` == ``brand`` (case-insensitive) → ``Attribute 1 value(s)``
2. Second ``>``-separated segment (skipping the first/root segment) of the first
   ``|``-separated ``Categories`` entry
3. Direct ``Brands`` column value (present in some CSV exports)
4. ``'Unknown'`` as a fallback

Output filename convention
---------------------------
* Lowercase the brand name
* Replace spaces with hyphens
* Remove characters that are not alphanumeric or hyphens
* Prefix with ``wc-``

Examples:
    Columbia Taping Tools → wc-columbia-taping-tools.csv
    TapeTech              → wc-tapetech.csv
    Dura-Stilts           → wc-dura-stilts.csv

Usage
------
    # Default paths (run from repo root)
    python scripts/split_catalog_by_brand.py

    # Custom paths
    python scripts/split_catalog_by_brand.py --csv path/to/wp-catalog.csv --out output/dir/

    # Preview without writing anything
    python scripts/split_catalog_by_brand.py --dry-run
"""

import argparse
import csv
import os
import re
import sys
from collections import defaultdict

# ---------------------------------------------------------------------------
# Defaults (relative to the repo root, i.e. where you run the script from)
# ---------------------------------------------------------------------------
DEFAULT_CSV = os.path.join("frontend", "public", "wp-catalog.csv")
DEFAULT_OUT = os.path.join("scripts", "brand-catalogs")


def extract_brand(row: dict) -> str:
    """Return the brand name for a WooCommerce CSV row.

    Priority:
    1. Explicit ``Brand`` attribute (``Attribute 1 name`` == ``brand``)
    2. Second segment of the ``Categories`` path (skips the root segment)
    3. Direct ``Brands`` column (present in some CSV exports)
    4. ``'Unknown'``
    """
    # 1. Explicit Brand attribute
    if (row.get("Attribute 1 name") or "").strip().lower() == "brand":
        brand = (row.get("Attribute 1 value(s)") or "").strip()
        if brand:
            return brand

    # 2. Second segment of the Categories path
    categories = (row.get("Categories") or "").strip()
    if categories:
        first_entry = categories.split("|")[0].strip()
        segments = [s.strip() for s in first_entry.split(">")]
        if len(segments) >= 2:
            return segments[1]

    # 3. Direct Brands column
    brand = (row.get("Brands") or "").strip()
    if brand:
        return brand

    return "Unknown"


def slugify(brand: str) -> str:
    """Convert a brand name to a safe filename slug prefixed with ``wc-``."""
    slug = brand.lower()
    slug = slug.replace(" ", "-")
    slug = re.sub(r"[^a-z0-9-]", "", slug)
    return f"wc-{slug}"


def main(argv=None):
    parser = argparse.ArgumentParser(
        description="Split wp-catalog.csv into per-brand CSV files."
    )
    parser.add_argument(
        "--csv",
        default=DEFAULT_CSV,
        help=f"Path to the source wp-catalog.csv (default: {DEFAULT_CSV})",
    )
    parser.add_argument(
        "--out",
        default=DEFAULT_OUT,
        help=f"Output directory for brand CSV files (default: {DEFAULT_OUT})",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Print what would be written without actually writing files",
    )
    args = parser.parse_args(argv)

    # ------------------------------------------------------------------
    # Read source CSV
    # ------------------------------------------------------------------
    if not os.path.isfile(args.csv):
        print(f"ERROR: source CSV not found: {args.csv}", file=sys.stderr)
        sys.exit(1)

    with open(args.csv, newline="", encoding="utf-8") as fh:
        reader = csv.DictReader(fh)
        headers = reader.fieldnames
        rows_by_brand = defaultdict(list)
        for row in reader:
            brand = extract_brand(row)
            rows_by_brand[brand].append(row)

    # ------------------------------------------------------------------
    # Write per-brand CSV files
    # ------------------------------------------------------------------
    if not args.dry_run:
        os.makedirs(args.out, exist_ok=True)

    for brand, rows in sorted(rows_by_brand.items()):
        slug = slugify(brand)
        filename = f"{slug}.csv"
        out_path = os.path.join(args.out, filename)
        if args.dry_run:
            print(f"[dry-run] Would write {len(rows):4d} rows → {out_path}")
        else:
            with open(out_path, "w", newline="", encoding="utf-8") as fh:
                writer = csv.DictWriter(fh, fieldnames=headers)
                writer.writeheader()
                writer.writerows(rows)
            print(f"Wrote {len(rows):4d} rows → {out_path}")

    total = sum(len(r) for r in rows_by_brand.values())
    action = "Would write" if args.dry_run else "Wrote"
    print(
        f"\n{action} {total} rows across {len(rows_by_brand)} brand file(s) "
        f"in '{args.out}'."
    )


if __name__ == "__main__":
    main()
