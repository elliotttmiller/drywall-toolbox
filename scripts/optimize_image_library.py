"""
scripts/optimize_image_library.py

Comprehensive product image library audit, optimization, and migration.

Operations (all idempotent / safe to re-run):

  1. AUDIT     — scan every image source, cross-reference with wp-catalog.csv,
                 report gaps and mismatches.

  2. SYNC      — copy new/missing images from all source directories into the
                 canonical flat Products dir (scripts/scraped_results/Products/).

  3. ORGANIZE  — copy every brand-mapped image from the flat Products dir into
                 the correct frontend/public/brands/{Brand}/Products/ directory
                 (lowercase filename, skip if identical copy already exists).

  4. REWRITE   — update wp-catalog.csv image URLs using the expanded flat
                 Products directory (runs the same logic as fix_image_urls.py).

  5. REPORT    — write a CSV audit report to scripts/scraped_results/
                 _image_audit.csv with per-row status for every product.

Usage:
  python3 scripts/optimize_image_library.py              # dry-run (no writes)
  python3 scripts/optimize_image_library.py --apply      # full run
  python3 scripts/optimize_image_library.py --audit-only # report only, no writes
"""

from __future__ import annotations

import argparse
import csv
import os
import re
import shutil
import sys
from collections import defaultdict
from dataclasses import dataclass, field
from pathlib import Path
from typing import Dict, List, Set

# ─── Paths ────────────────────────────────────────────────────────────────────

REPO_ROOT      = Path(__file__).resolve().parent.parent
SCRIPTS_DIR    = REPO_ROOT / "scripts"
SCRAPED_DIR    = SCRIPTS_DIR / "scraped_results"
PRODUCTS_FLAT  = SCRAPED_DIR / "Products"                         # canonical flat source
COL_TOOLS_IMG  = SCRAPED_DIR / "Columbia" / "columbia_tools" / "images"
BRANDS_DIR     = REPO_ROOT / "frontend" / "public" / "brands"
CATALOG_PATH   = REPO_ROOT / "frontend" / "public" / "wp-catalog.csv"
AUDIT_REPORT   = SCRAPED_DIR / "_image_audit.csv"

# WooCommerce import image base URL (all flat-dir images are uploaded here)
WP_BASE_URL    = "https://drywalltoolbox.com/wp/wp-content/uploads/2026/04/"

# Brand name in wp-catalog.csv  →  subfolder under frontend/public/brands/
BRAND_DIR_MAP: Dict[str, str] = {
    "Asgard":                 "Asgard",
    "Columbia Taping Tools":  "Columbia",
    "Platinum Drywall Tools": "Platinum",
    "SurPro":                 "SurPro",
    "TapeTech":               "TapeTech",
    "Level5":                 "Level5",
    "Graco":                  "Graco",
    "Dura-Stilts":            "Dura-Stilts",
}

# Custom SKU → image filename-prefix mappings
# (identical to fix_image_urls.py; kept in sync manually)
CUSTOM_SKU_PREFIX_MAP: Dict[str, str] = {
    # TapeTech Tapers
    "07TT":        "ez07tt",
    "03TT":        "ns03tt",
    "07TT-C":      "ca07tt",
    # Columbia products
    "C1HS":        "c1h",
    "CLT":         "clt24",
    "CMT":         "cmt24",
    "AH73":        "ah735",
    "8FFBA":       "14ffba",
    "CSH":         "cs",
    "ICA":         "ica2_1",
    "ITC-K":       "itc_k",
    "SSB-SIZE":    "ssb_size",
    "TSB-SIZE":    "tsb_size",
    # Platinum
    "PT-3NS":      "pt-2ns",
    # TapeTech Corner Rollers (generic image only)
    "CROLL-TT":    "cr",
    "CROLL-TT-4":  "cr",
    "CROLL-TT-9":  "cr",
    "CROLL-TT-12": "cr",
    # TapeTech Quick Corner Angle Head
    "CA-TT":       "qca-tt",
    "CA-TT-7":     "qca-tt",
    "CA-TT-8":     "qca-tt",
    # TapeTech EasyClean® Flat Box Handles
    "EFBH-TT":     "bh",
    "EFBH-TT-34":  "bh",
    "EFBH-TT-42":  "bh",
    "EFBH-TT-54":  "bh",
    "EFBH-TT-72":  "bh",
    "FBH-TT":      "bh",
    "FBH-TT-34":   "bh",
    "FBH-TT-42":   "bh",
    "FBH-TT-54":   "bh",
    "FBH-TT-72":   "bh",

    # TapeTech Compound Tube Applicators (size-specific naming)
    "CT-TT-24":    "ct24tt",
    "CT-TT-36":    "ct36tt",
    "CT-TT-42":    "ct42tt",

    # TapeTech ProForm® Flat Boxes (zero-padded size in filename)
    "PFB-TT-7":    "pfb07",
    "PFB-TT-12":   "pfb12",
    "PFB-TT-14":   "pfb14",
    "PFB-TT-18":   "pfb18",
    "PFB-TT-24":   "pfb24",
    "PFB-TT-32":   "pfb32",
    "PFB-TT-40":   "pfb40",
    "PFB-TT-48":   "pfb48",

    # TapeTech ProForm® Flat Box Kits (zero-padded size + tt suffix)
    "PFK-TT-7":    "pfk07tt",
    "PFK-TT-12":   "pfk12tt",
    "PFK-TT-14":   "pfk14tt",
    "PFK-TT-18":   "pfk18tt",
    "PFK-TT-24":   "pfk24tt",
    "PFK-TT-32":   "pfk32tt",
    "PFK-TT-40":   "pfk40tt",
    "PFK-TT-48":   "pfk48tt",

    # TapeTech QuickBox® QSX (size encoded as width×height digits)
    "QB-QSX-65":   "qb06-qsx",   # 6" × 5"
    "QB-QSX-85":   "qb08-qsx",   # 8" × 5"
}

# TapeTech spare-parts SKU pattern (no images available)
PARTS_SKU_RE = re.compile(r"^0[5-9][0-9]{4}", re.IGNORECASE)

# Filename suffix pattern: optional _<hexhash8> or _<digits>
SUFFIX_RE = re.compile(r"^(.+?)(?:_([0-9a-f]{8}|[0-9]+))?$")


# ─── Helpers ──────────────────────────────────────────────────────────────────

def is_parts_sku(sku: str) -> bool:
    return bool(PARTS_SKU_RE.match(sku))


def image_prefix(filename: str) -> str:
    """Return the SKU-like prefix of a webp filename (strip suffix + extension)."""
    stem = Path(filename).stem.lower()
    m = SUFFIX_RE.match(stem)
    return m.group(1) if m else stem


def sku_prefix(sku: str) -> str:
    return CUSTOM_SKU_PREFIX_MAP.get(sku.upper(), sku.lower())


def files_in(directory: Path) -> List[str]:
    """Return sorted list of .webp filenames (lowercase) in a directory."""
    if not directory.is_dir():
        return []
    return sorted(
        f.lower() for f in os.listdir(directory) if f.lower().endswith(".webp")
    )


def build_flat_index(flat_dir: Path) -> Dict[str, List[str]]:
    """
    Build prefix → [sorted filenames] index from the flat Products directory.
    Main image (no suffix) sorts first; thereafter alphabetical.
    """
    index: Dict[str, List[str]] = defaultdict(list)
    for fname in sorted(os.listdir(flat_dir)):
        if not fname.lower().endswith(".webp"):
            continue
        prefix = image_prefix(fname)
        index[prefix].append(fname.lower())

    for key in index:
        index[key].sort(
            key=lambda f: (0 if Path(f).stem == key else 1, f)
        )
    return dict(index)


def files_for_sku(sku: str, flat_index: Dict[str, List[str]]) -> List[str]:
    prefix = sku_prefix(sku)
    return list(flat_index.get(prefix, []))


def build_url_list(filenames: List[str]) -> str:
    return "|".join(WP_BASE_URL + f for f in filenames)


# ─── Catalog loader ───────────────────────────────────────────────────────────

@dataclass
class CatalogRow:
    raw: dict
    sku: str
    brand: str
    ptype: str
    parent: str
    old_images: str


def load_catalog() -> tuple[List[str], List[CatalogRow]]:
    with open(CATALOG_PATH, newline="", encoding="utf-8") as fh:
        reader = csv.DictReader(fh)
        fieldnames = list(reader.fieldnames or [])
        rows = [
            CatalogRow(
                raw=row,
                sku=row.get("SKU", "").strip(),
                brand=row.get("Brands", "").strip(),
                ptype=row.get("Type", "").strip(),
                parent=row.get("Parent", "").strip(),
                old_images=row.get("Images", "").strip(),
            )
            for row in reader
        ]
    return fieldnames, rows


# ─── Phase 1 – AUDIT ──────────────────────────────────────────────────────────

@dataclass
class AuditEntry:
    sku: str
    brand: str
    ptype: str
    old_image_count: int
    new_image_count: int
    status: str          # unchanged | improved | cleared | no_file | parts
    added_files: List[str] = field(default_factory=list)
    removed_files: List[str] = field(default_factory=list)


def audit(
    fieldnames: List[str],
    rows: List[CatalogRow],
    flat_index: Dict[str, List[str]],
) -> tuple[List[AuditEntry], Dict[str, List[str]]]:
    """
    Cross-reference every catalog row with the flat image index.
    Returns (audit_entries, parent_to_children).
    """
    parent_to_children: Dict[str, List[str]] = defaultdict(list)
    for row in rows:
        if row.parent and row.ptype == "variation":
            parent_to_children[row.parent].append(row.sku)

    entries: List[AuditEntry] = []
    for row in rows:
        old_urls = [u.strip() for u in row.old_images.split("|") if u.strip()]
        old_fnames = [u.split("/")[-1].lower() for u in old_urls]
        old_count = len(old_fnames)

        if is_parts_sku(row.sku):
            entries.append(
                AuditEntry(row.sku, row.brand, row.ptype, old_count, 0, "parts")
            )
            continue

        if row.ptype == "variable":
            new_fnames: List[str] = []
            for child_sku in parent_to_children.get(row.sku, []):
                child_files = files_for_sku(child_sku, flat_index)
                if child_files:
                    new_fnames = child_files
                    break
            if not new_fnames:
                new_fnames = files_for_sku(row.sku, flat_index)
        else:
            new_fnames = files_for_sku(row.sku, flat_index)

        if not new_fnames:
            status = "no_file"
            entries.append(
                AuditEntry(row.sku, row.brand, row.ptype, old_count, 0, status)
            )
            continue

        added   = [f for f in new_fnames if f not in old_fnames]
        removed = [f for f in old_fnames if f not in new_fnames]

        if not added and not removed:
            status = "unchanged"
        else:
            status = "improved" if added else "changed"

        entries.append(
            AuditEntry(
                row.sku, row.brand, row.ptype,
                old_count, len(new_fnames),
                status, added, removed,
            )
        )

    return entries, parent_to_children


# ─── Phase 2 – SYNC source images into flat Products dir ──────────────────────

def sync_source_images(dry_run: bool) -> Dict[str, int]:
    """
    Copy new .webp files from columbia_tools/images/ into the flat Products dir.
    Returns counts: {copied, skipped, source_total}.
    """
    existing_lower = {f.lower() for f in os.listdir(PRODUCTS_FLAT)}
    stats = {"copied": 0, "skipped": 0, "source_total": 0}

    for src_file in sorted(COL_TOOLS_IMG.rglob("*.webp")):
        stats["source_total"] += 1
        dest_name = src_file.name.lower()
        dest_path = PRODUCTS_FLAT / dest_name

        if dest_name in existing_lower:
            stats["skipped"] += 1
            continue

        print(f"  SYNC  {src_file.name}  →  Products/{dest_name}")
        if not dry_run:
            shutil.copy2(src_file, dest_path)
        stats["copied"] += 1

    return stats


# ─── Phase 3 – ORGANIZE brand directories ─────────────────────────────────────

def organize_brand_dirs(
    rows: List[CatalogRow],
    flat_index: Dict[str, List[str]],
    parent_to_children: Dict[str, List[str]],
    dry_run: bool,
) -> Dict[str, int]:
    """
    For every brand-mapped SKU, copy its image files from the flat Products dir
    into the correct frontend/public/brands/{Brand}/Products/ directory.
    Files are lowercased; existing identical files are skipped.
    """
    stats: Dict[str, int] = defaultdict(int)

    # Build: brand_dir → set of lowercase filenames to copy
    to_copy: Dict[str, Set[str]] = defaultdict(set)

    for row in rows:
        if is_parts_sku(row.sku):
            continue
        brand_dir_name = BRAND_DIR_MAP.get(row.brand)
        if not brand_dir_name:
            continue

        if row.ptype == "variable":
            fnames: List[str] = []
            for child_sku in parent_to_children.get(row.sku, []):
                child_files = files_for_sku(child_sku, flat_index)
                if child_files:
                    fnames = child_files
                    break
            if not fnames:
                fnames = files_for_sku(row.sku, flat_index)
        else:
            fnames = files_for_sku(row.sku, flat_index)

        for fname in fnames:
            to_copy[brand_dir_name].add(fname)

    for brand_dir_name, filenames in sorted(to_copy.items()):
        dest_dir = BRANDS_DIR / brand_dir_name / "Products"
        dest_dir.mkdir(parents=True, exist_ok=True)
        existing_lower = {f.lower() for f in os.listdir(dest_dir)}

        for fname in sorted(filenames):
            src = PRODUCTS_FLAT / fname
            if not src.exists():
                stats["missing_source"] += 1
                continue
            dest = dest_dir / fname
            if fname in existing_lower:
                stats["skipped"] += 1
            else:
                print(f"  ORGANIZE  {fname}  →  brands/{brand_dir_name}/Products/")
                if not dry_run:
                    shutil.copy2(src, dest)
                stats["copied"] += 1

    return dict(stats)


# ─── Phase 4 – REWRITE wp-catalog.csv ─────────────────────────────────────────

def rewrite_catalog(
    fieldnames: List[str],
    rows: List[CatalogRow],
    flat_index: Dict[str, List[str]],
    parent_to_children: Dict[str, List[str]],
    dry_run: bool,
) -> Dict[str, int]:
    """
    Update the Images column in wp-catalog.csv using the expanded flat index.
    """
    stats: Dict[str, int] = defaultdict(int)
    updated_rows: list = []

    for row in rows:
        d = dict(row.raw)
        sku    = row.sku
        ptype  = row.ptype
        old_img = row.old_images

        if is_parts_sku(sku):
            if old_img:
                d["Images"] = ""
                stats["cleared"] += 1
            else:
                stats["unchanged"] += 1
            updated_rows.append(d)
            continue

        if ptype == "variable":
            new_fnames: List[str] = []
            for child_sku in parent_to_children.get(sku, []):
                child_files = files_for_sku(child_sku, flat_index)
                if child_files:
                    new_fnames = child_files
                    break
            if not new_fnames:
                new_fnames = files_for_sku(sku, flat_index)
        else:
            new_fnames = files_for_sku(sku, flat_index)

        if not new_fnames:
            stats["no_file"] += 1
            updated_rows.append(d)
            continue

        new_img = build_url_list(new_fnames)
        if new_img == old_img:
            stats["unchanged"] += 1
        else:
            old_count = len([u for u in old_img.split("|") if u.strip()])
            new_count = len(new_fnames)
            if new_count > old_count:
                stats["expanded"] += 1
            elif not old_img:
                stats["fixed"] += 1
            else:
                stats["changed"] += 1
            d["Images"] = new_img

        updated_rows.append(d)

    if not dry_run:
        with open(CATALOG_PATH, "w", newline="", encoding="utf-8") as fh:
            writer = csv.DictWriter(fh, fieldnames=fieldnames)
            writer.writeheader()
            writer.writerows(updated_rows)

    return dict(stats)


# ─── Phase 5 – REPORT ─────────────────────────────────────────────────────────

def write_audit_report(
    entries: List[AuditEntry],
    sync_stats: Dict[str, int],
    organize_stats: Dict[str, int],
    catalog_stats: Dict[str, int],
    dry_run: bool,
) -> None:
    report_fields = [
        "SKU", "Brand", "Type", "Status",
        "Old Image Count", "New Image Count",
        "Added Files", "Removed Files",
    ]
    if not dry_run:
        with open(AUDIT_REPORT, "w", newline="", encoding="utf-8") as fh:
            writer = csv.DictWriter(fh, fieldnames=report_fields)
            writer.writeheader()
            for e in entries:
                writer.writerow({
                    "SKU":             e.sku,
                    "Brand":           e.brand,
                    "Type":            e.ptype,
                    "Status":          e.status,
                    "Old Image Count": e.old_image_count,
                    "New Image Count": e.new_image_count,
                    "Added Files":     "|".join(e.added_files),
                    "Removed Files":   "|".join(e.removed_files),
                })

    # Status breakdown
    from collections import Counter
    status_counts = Counter(e.status for e in entries)

    print("\n" + "=" * 60)
    print("  IMAGE LIBRARY OPTIMIZATION REPORT")
    print("=" * 60)
    print(f"\nDry-run mode: {'YES (no files written)' if dry_run else 'NO (changes applied)'}")

    print("\n── Catalog row status ──────────────────────────────────")
    for status, count in sorted(status_counts.items()):
        print(f"  {status:<20} {count:>5}")
    print(f"  {'TOTAL':<20} {sum(status_counts.values()):>5}")

    print("\n── Source sync (columbia_tools → Products/) ────────────")
    for k, v in sorted(sync_stats.items()):
        print(f"  {k:<20} {v:>5}")

    print("\n── Brand dir organization ──────────────────────────────")
    for k, v in sorted(organize_stats.items()):
        print(f"  {k:<20} {v:>5}")

    print("\n── Catalog CSV rewrite ─────────────────────────────────")
    for k, v in sorted(catalog_stats.items()):
        print(f"  {k:<20} {v:>5}")

    if not dry_run:
        print(f"\nAudit report written to: {AUDIT_REPORT.relative_to(REPO_ROOT)}")
    print()


# ─── Main ─────────────────────────────────────────────────────────────────────

def main() -> None:
    parser = argparse.ArgumentParser(
        description="Optimize the product image library and wp-catalog.csv"
    )
    parser.add_argument(
        "--apply",
        action="store_true",
        help="Apply all changes (default: dry-run only)",
    )
    parser.add_argument(
        "--audit-only",
        action="store_true",
        help="Print audit report without making any changes or writing any files",
    )
    args = parser.parse_args()

    dry_run = not args.apply

    if args.audit_only:
        dry_run = True
        print("=== Audit-only mode – no files will be read or written ===\n")
    elif dry_run:
        print("=== Dry-run mode – pass --apply to write changes ===\n")
    else:
        print("=== APPLY mode – changes will be written ===\n")

    # ── Step 1: sync columbia_tools images into the flat Products dir ──────────
    print("── Step 1: Sync columbia_tools source images ──────────────")
    sync_stats = sync_source_images(dry_run=dry_run)

    # ── Step 2: rebuild flat index (now includes any newly synced files) ────────
    # In dry-run mode the flat dir hasn't changed, but we still show what *would*
    # be available after sync by simulating the additions.
    flat_index = build_flat_index(PRODUCTS_FLAT)

    if dry_run:
        # Simulate: add the would-be-synced files to the index
        existing_lower = {f.lower() for f in os.listdir(PRODUCTS_FLAT)}
        for src_file in sorted(COL_TOOLS_IMG.rglob("*.webp")):
            dest_name = src_file.name.lower()
            if dest_name not in existing_lower:
                prefix = image_prefix(dest_name)
                if prefix not in flat_index:
                    flat_index[prefix] = []
                if dest_name not in flat_index[prefix]:
                    flat_index[prefix].append(dest_name)
                    flat_index[prefix].sort(
                        key=lambda f: (0 if Path(f).stem == prefix else 1, f)
                    )

    # ── Step 3: load catalog ────────────────────────────────────────────────────
    fieldnames, rows = load_catalog()

    # ── Step 4: audit ──────────────────────────────────────────────────────────
    print("── Step 2: Audit catalog vs image index ───────────────────")
    entries, parent_to_children = audit(fieldnames, rows, flat_index)

    # ── Step 5: organize brand dirs ────────────────────────────────────────────
    print("── Step 3: Organize brand image directories ────────────────")
    if not args.audit_only:
        organize_stats = organize_brand_dirs(
            rows, flat_index, parent_to_children, dry_run=dry_run
        )
    else:
        organize_stats = {}

    # ── Step 6: rewrite catalog ────────────────────────────────────────────────
    print("── Step 4: Rewrite wp-catalog.csv ──────────────────────────")
    if not args.audit_only:
        catalog_stats = rewrite_catalog(
            fieldnames, rows, flat_index, parent_to_children, dry_run=dry_run
        )
    else:
        catalog_stats = {}

    # ── Step 7: report ─────────────────────────────────────────────────────────
    write_audit_report(entries, sync_stats, organize_stats, catalog_stats, dry_run)


if __name__ == "__main__":
    main()
