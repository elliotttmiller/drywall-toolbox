#!/usr/bin/env python3
"""
sort_catalog_by_brand.py

Sorts wp-catalog.csv alphabetically by the Brands column and reassigns
sequential IDs starting at 1.

This is safe to run on a fresh WooCommerce catalog import: there are no
existing products in the store, so renumbering IDs from 1 does not break
any live product URLs or database references.

Usage
-----
    python3 scripts/sort_catalog_by_brand.py
    python3 scripts/sort_catalog_by_brand.py --csv-in wp-catalog.csv
    python3 scripts/sort_catalog_by_brand.py --csv-in wp-catalog.csv --csv-out wp-catalog-sorted.csv
    python3 scripts/sort_catalog_by_brand.py --dry-run

Options
-------
    --csv-in   PATH   Input CSV (default: wp-catalog.csv in repo root).
    --csv-out  PATH   Output CSV (default: same as --csv-in, i.e. update in-place).
    --dry-run         Print summary of what would be done without writing files.
"""

import argparse
import csv
import os
import sys

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
REPO_ROOT  = os.path.dirname(SCRIPT_DIR)

DEFAULT_CSV_PATH = os.path.join(REPO_ROOT, "wp-catalog.csv")


# ---------------------------------------------------------------------------
# CSV helpers
# ---------------------------------------------------------------------------

def open_csv(path: str):
    """Open a CSV with UTF-8-sig encoding and error replacement (BOM-safe)."""
    return open(path, encoding="utf-8-sig", errors="replace", newline="")


# ---------------------------------------------------------------------------
# Core logic
# ---------------------------------------------------------------------------

def sort_catalog(
    csv_in: str,
    csv_out: str,
    *,
    dry_run: bool = False,
) -> int:
    """
    Read *csv_in*, sort rows alphabetically by the Brands column (case-
    insensitive), reassign sequential IDs starting at 1, and write the
    result to *csv_out*.

    Within each brand the original row order is preserved (stable sort).

    Returns the total number of rows written.
    """
    with open_csv(csv_in) as f:
        reader = csv.DictReader(f)
        fieldnames = reader.fieldnames
        rows = list(reader)

    if fieldnames is None:
        print("ERROR: could not read CSV headers", file=sys.stderr)
        return 0

    if "Brands" not in fieldnames:
        print("ERROR: 'Brands' column not found in CSV", file=sys.stderr)
        return 0

    if "ID" not in fieldnames:
        print("ERROR: 'ID' column not found in CSV", file=sys.stderr)
        return 0

    total = len(rows)
    print(f"Input CSV  : {csv_in}")
    print(f"Output CSV : {csv_out}")
    print(f"Total rows : {total}")
    print()

    # Stable sort by brand name (case-insensitive).
    sorted_rows = sorted(rows, key=lambda r: r.get("Brands", "").lower())

    # Reassign sequential IDs starting at 1.
    for idx, row in enumerate(sorted_rows, start=1):
        row["ID"] = str(idx)

    # Show brand breakdown in output order.
    seen_brands = []
    seen_set = set()
    for r in sorted_rows:
        b = r.get("Brands", "")
        if b not in seen_set:
            seen_set.add(b)
            seen_brands.append(b)

    print("Brand order after sort:")
    for b in seen_brands:
        count = sum(1 for r in sorted_rows if r.get("Brands", "") == b)
        print(f"  {b or '(no brand)':<30}  {count} rows")
    print()

    if dry_run:
        print(f"[dry-run] Would write {total} rows to: {csv_out}")
        print("[dry-run] No files written.")
        return total

    with open(csv_out, "w", encoding="utf-8", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames, quoting=csv.QUOTE_ALL)
        writer.writeheader()
        writer.writerows(sorted_rows)

    print(f"Written {total} rows to: {csv_out}")
    return total


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

def build_arg_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(
        description=(
            "Sort wp-catalog.csv alphabetically by brand and reassign "
            "sequential IDs starting at 1."
        )
    )
    p.add_argument(
        "--csv-in",
        default=DEFAULT_CSV_PATH,
        metavar="PATH",
        help=f"Input CSV path (default: {DEFAULT_CSV_PATH}).",
    )
    p.add_argument(
        "--csv-out",
        default=None,
        metavar="PATH",
        help="Output CSV path (default: same as --csv-in, i.e. update in-place).",
    )
    p.add_argument(
        "--dry-run",
        action="store_true",
        help="Print planned actions without writing files.",
    )
    return p


def main() -> int:
    args = build_arg_parser().parse_args()

    csv_in  = args.csv_in
    csv_out = args.csv_out if args.csv_out else args.csv_in

    if not os.path.isfile(csv_in):
        print(f"ERROR: input CSV not found: {csv_in}", file=sys.stderr)
        return 1

    sort_catalog(csv_in, csv_out, dry_run=args.dry_run)
    return 0


if __name__ == "__main__":
    sys.exit(main())
