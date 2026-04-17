#!/usr/bin/env python3
"""
End-to-End Columbia Catalog Integration
=========================================
Merges ALL Columbia Tools data from every scraped source into the live
frontend/public/wp-catalog.csv.

Strategy
--------
1. Create a timestamped backup of the live catalog before any changes.
2. Load three inputs:
     a. Live catalog  (frontend/public/wp-catalog.csv)          — primary
     b. Columbia scrape (scraped_results/columbia_tools/wp-catalog.csv)
     c. TSW scrape    (scraped_results/tsw_columbia/products_tsw.csv)
3. For all Columbia rows already in the live catalog:
     - Keep every field as-is (they carry richer descriptions + prices).
     - Augment the Images field with any unique extra images from scraped
       sources (gallery enrichment, de-duplicated).
4. For scraped SKUs NOT in the live catalog (new items):
     - Normalize brand to "Columbia Taping Tools".
     - Map scraped category to live category hierarchy.
     - Assign the next available Position value.
     - Mark Published=1, In stock?=1, Tax status=taxable, Visibility=visible.
5. Keep every non-Columbia row exactly unchanged.
6. Write the merged catalog back to frontend/public/wp-catalog.csv.
7. Write audit artifacts to scraped_results/columbia_merged/.

Usage
-----
  python scripts/integrate_columbia_catalog.py
  python scripts/integrate_columbia_catalog.py --dry-run   # preview only
  python scripts/integrate_columbia_catalog.py --no-backup # skip backup (not recommended)
  python scripts/integrate_columbia_catalog.py \
      --live-csv    frontend/public/wp-catalog.csv \
      --columbia-csv scraped_results/columbia_tools/wp-catalog.csv \
      --tsw-csv      scraped_results/tsw_columbia/products_tsw.csv \
      --output-dir   scraped_results/columbia_merged
"""

from __future__ import annotations

import argparse
import csv
import json
import shutil
import sys
from collections import OrderedDict
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional, Tuple
from urllib.parse import quote

# ── Paths ─────────────────────────────────────────────────────────────────────

REPO_ROOT = Path(__file__).resolve().parent.parent
DEFAULT_LIVE_CSV      = REPO_ROOT / "frontend/public/wp-catalog.csv"
DEFAULT_COLUMBIA_CSV  = REPO_ROOT / "scraped_results/columbia_tools/wp-catalog.csv"
DEFAULT_TSW_CSV       = REPO_ROOT / "scraped_results/tsw_columbia/products_tsw.csv"
DEFAULT_OUTPUT_DIR    = REPO_ROOT / "scraped_results/columbia_merged"
DEFAULT_COLUMBIA_IMAGE_BASE = "https://drywalltoolbox.com/wp/wp-content/uploads/columbia-tools"
LIVE_COLUMBIA_BRAND   = "Columbia Taping Tools"
LIVE_CATEGORY_PREFIX  = "Drywall Finishing Tools > Columbia Taping Tools"

# ── ANSI helpers ──────────────────────────────────────────────────────────────

CYAN  = "\033[96m"
GREEN = "\033[92m"
YELLOW= "\033[93m"
RED   = "\033[91m"
GREY  = "\033[90m"
RESET = "\033[0m"
BOLD  = "\033[1m"

def step(msg: str) -> None: print(f"\n{CYAN}{BOLD}▶  {msg}{RESET}")
def ok(msg: str)   -> None: print(f"   {GREEN}✔  {msg}{RESET}")
def warn(msg: str) -> None: print(f"   {YELLOW}⚠  {msg}{RESET}")
def info(msg: str) -> None: print(f"   {GREY}·  {msg}{RESET}")
def fail(msg: str) -> None: print(f"   {RED}✘  {msg}{RESET}")

# ── SKU normalization ─────────────────────────────────────────────────────────

def normalize_sku(value: str) -> str:
    return (value or "").strip().lower().replace("-", "").replace("_", "")

# ── Category mapping  ─────────────────────────────────────────────────────────

# Maps scraped categories (from Columbia scrape and TSW) → live catalog categories
CATEGORY_MAP: Dict[str, str] = {
    "Drywall Finishing Tools > Columbia Tools > Finishing Boxes":     f"{LIVE_CATEGORY_PREFIX} > Finishing Boxes",
    "Drywall Finishing Tools > Columbia Tools > Automatic Tapers":    f"{LIVE_CATEGORY_PREFIX} > Automatic Tapers",
    "Drywall Finishing Tools > Columbia Tools > Corner Tools":        f"{LIVE_CATEGORY_PREFIX} > Corner & Angle Tools",
    "Drywall Finishing Tools > Columbia Tools > Corner Flushers":     f"{LIVE_CATEGORY_PREFIX} > Corner & Angle Tools",
    "Drywall Finishing Tools > Columbia Tools > Angleheads":          f"{LIVE_CATEGORY_PREFIX} > Corner & Angle Tools",
    "Drywall Finishing Tools > Columbia Tools > Angle Heads":         f"{LIVE_CATEGORY_PREFIX} > Corner & Angle Tools",
    "Drywall Finishing Tools > Columbia Tools > Corner Rollers":      f"{LIVE_CATEGORY_PREFIX} > Corner & Angle Tools",
    "Drywall Finishing Tools > Columbia Tools > Nailspotters":        f"{LIVE_CATEGORY_PREFIX} > Spotters",
    "Drywall Finishing Tools > Columbia Tools > Handles":             f"{LIVE_CATEGORY_PREFIX} > Handles & Extensions",
    "Drywall Finishing Tools > Columbia Tools > Pumps":               f"{LIVE_CATEGORY_PREFIX} > Pumps & Accessories",
    "Drywall Finishing Tools > Columbia Tools > Compound Tubes":      f"{LIVE_CATEGORY_PREFIX} > Pumps & Accessories",
    "Drywall Finishing Tools > Columbia Tools > Applicators":         f"{LIVE_CATEGORY_PREFIX} > Pumps & Accessories",
    "Drywall Finishing Tools > Columbia Tools > Grooved Mud Heads":   f"{LIVE_CATEGORY_PREFIX} > Pumps & Accessories",
    "Drywall Finishing Tools > Columbia Tools > Mud Heads":           f"{LIVE_CATEGORY_PREFIX} > Pumps & Accessories",
    "Drywall Finishing Tools > Columbia Tools > Maintenance Kits":    f"{LIVE_CATEGORY_PREFIX} > Repair Kits & Parts",
    "Drywall Finishing Tools > Columbia Tools > Hand Tools":          f"{LIVE_CATEGORY_PREFIX} > Repair Kits & Parts",
    "Drywall Finishing Tools > Columbia Tools > Sanders":             f"{LIVE_CATEGORY_PREFIX} > Repair Kits & Parts",
    "Drywall Finishing Tools > Columbia Tools > Smoothing Blades":    f"{LIVE_CATEGORY_PREFIX} > Repair Kits & Parts",
    "Drywall Finishing Tools > Columbia Tools > Tool Cases":          f"{LIVE_CATEGORY_PREFIX} > Repair Kits & Parts",
}

# Fallback by keyword match on product name (for TSW rows with generic category)
def infer_category_from_name(name: str) -> str:
    n = (name or "").lower()
    if any(x in n for x in ["flat box", "finishing box", "fat boy box"]):
        return f"{LIVE_CATEGORY_PREFIX} > Finishing Boxes"
    if any(x in n for x in ["automatic taper", "taper semi"]):
        return f"{LIVE_CATEGORY_PREFIX} > Automatic Tapers"
    if any(x in n for x in ["anglehead", "angle head", "corner flusher", "corner roller",
                              "corner tool", "combo flusher", "direct corner", "standard corner"]):
        return f"{LIVE_CATEGORY_PREFIX} > Corner & Angle Tools"
    if any(x in n for x in ["nailspotter", "nail spotter", "spotter"]):
        return f"{LIVE_CATEGORY_PREFIX} > Spotters"
    if any(x in n for x in ["handle", "extension", "brake"]):
        return f"{LIVE_CATEGORY_PREFIX} > Handles & Extensions"
    if any(x in n for x in ["pump", "compound tube", "applicator", "mud head", "grooved"]):
        return f"{LIVE_CATEGORY_PREFIX} > Pumps & Accessories"
    if any(x in n for x in ["maintenance kit", "repair kit", "blade", "spring", "part",
                              "trowel", "hawk", "knife", "knives", "putty", "sander",
                              "smoothing", "tool case", "carrying"]):
        return f"{LIVE_CATEGORY_PREFIX} > Repair Kits & Parts"
    return f"{LIVE_CATEGORY_PREFIX} > Finishing Boxes"


def map_category(scraped_cat: str, name: str) -> str:
    if scraped_cat in CATEGORY_MAP:
        return CATEGORY_MAP[scraped_cat]
    return infer_category_from_name(name)

# ── Image helpers ─────────────────────────────────────────────────────────────

def split_images(value: str) -> List[str]:
    return [chunk.strip() for chunk in (value or "").split("|") if chunk.strip()]


def absolutize_image(
    value: str,
    columbia_images_root: Path,
    columbia_image_base_url: str,
) -> str:
    if value.startswith("http://") or value.startswith("https://"):
        return value
    rel = value.lstrip("./")
    candidate = columbia_images_root / rel
    if candidate.exists():
        quoted_rel = "/".join(quote(part) for part in rel.split("/"))
        return f"{columbia_image_base_url.rstrip('/')}/{quoted_rel}"
    return value


def merge_images(
    live_imgs: List[str],
    extra_imgs: List[str],
    columbia_images_root: Path,
    columbia_image_base_url: str,
) -> str:
    """Return de-duplicated, absolute image list: live images first, then extras."""
    seen: OrderedDict[str, bool] = OrderedDict()
    for img in live_imgs:
        norm = absolutize_image(img, columbia_images_root, columbia_image_base_url)
        seen[norm] = True
    for img in extra_imgs:
        norm = absolutize_image(img, columbia_images_root, columbia_image_base_url)
        if norm not in seen:
            seen[norm] = True
    return "|".join(seen.keys())

# ── CSV I/O ───────────────────────────────────────────────────────────────────

def load_csv(path: Path) -> List[Dict[str, str]]:
    with path.open("r", encoding="utf-8-sig", newline="") as fh:
        return list(csv.DictReader(fh))


def write_csv(path: Path, headers: List[str], rows: List[Dict[str, str]]) -> None:
    with path.open("w", encoding="utf-8", newline="") as fh:
        writer = csv.DictWriter(fh, fieldnames=headers, extrasaction="ignore")
        writer.writeheader()
        writer.writerows(rows)

# ── WC row defaults for new rows ──────────────────────────────────────────────

def new_row_defaults(headers: List[str]) -> Dict[str, str]:
    """Return WooCommerce defaults matching the live catalog conventions."""
    return {h: "" for h in headers} | {
        "Type":                     "simple",
        "Published":                "1",
        "Is featured?":             "0",
        "Visibility in catalog":    "visible",
        "Tax status":               "taxable",
        "Tax class":                "",
        "In stock?":                "1",
        "Stock":                    "",
        "Low stock amount":         "",
        "Backorders allowed?":      "0",
        "Sold individually?":       "0",
        "Allow customer reviews?":  "1",
        "Attribute 1 name":         "Brand",
        "Attribute 1 visible":      "1",
        "Attribute 1 global":       "1",
    }

# ── Main integration ──────────────────────────────────────────────────────────

def build_integrated_catalog(
    live_rows:     List[Dict[str, str]],
    col_rows:      List[Dict[str, str]],
    tsw_rows:      List[Dict[str, str]],
    columbia_images_root: Path,
    columbia_image_base_url: str,
) -> Tuple[List[Dict[str, str]], Dict]:
    """
    Returns (merged_rows, stats_dict).
    merged_rows keeps the live catalog column order.
    """
    headers = list(live_rows[0].keys()) if live_rows else []
    # Remove trailing empty column if present (live CSV artefact)
    clean_headers = [h for h in headers if h]

    # Index scraped sources by normalized SKU
    col_by_sku  = {normalize_sku(r["SKU"]): r for r in col_rows  if normalize_sku(r.get("SKU",""))}
    tsw_by_sku  = {normalize_sku(r["SKU"]): r for r in tsw_rows  if normalize_sku(r.get("SKU",""))}
    live_by_sku = {normalize_sku(r["SKU"]): r for r in live_rows if normalize_sku(r.get("SKU",""))}

    # Determine which live rows belong to Columbia (by brand)
    live_columbia_keys = {normalize_sku(r["SKU"]) for r in live_rows
                          if r.get("Brands") == LIVE_COLUMBIA_BRAND
                          and normalize_sku(r.get("SKU",""))}

    all_scraped_keys  = set(col_by_sku.keys()) | set(tsw_by_sku.keys())
    new_sku_keys      = all_scraped_keys - live_columbia_keys  # scraped not yet in live

    # Max position currently used in the Columbia section
    max_col_pos = 0
    for r in live_rows:
        if r.get("Brands") == LIVE_COLUMBIA_BRAND:
            try:
                pos = int(r.get("Position", 0) or 0)
                if pos > max_col_pos:
                    max_col_pos = pos
            except ValueError:
                pass

    # Stats
    stats: Dict = {
        "live_total_rows_in":          len(live_rows),
        "live_columbia_rows":          len(live_columbia_keys),
        "live_non_columbia_rows":      len(live_rows) - len(live_columbia_keys),
        "scraped_columbia_skus":       len(col_by_sku),
        "scraped_tsw_skus":            len(tsw_by_sku),
        "all_scraped_unique_skus":     len(all_scraped_keys),
        "overlap_skus":                len(all_scraped_keys & live_columbia_keys),
        "new_skus_added":              0,
        "image_galleries_enriched":    0,
        "extra_images_added":          0,
        "live_total_rows_out":         0,
    }

    # ── Pass 1: copy every live row, enriching Columbia image galleries ────────
    merged: List[Dict[str, str]] = []
    for row in live_rows:
        if not row.get("Brands") == LIVE_COLUMBIA_BRAND:
            # Non-Columbia row — copy verbatim
            merged.append({h: row.get(h, "") for h in clean_headers})
            continue

        # Columbia row — enrich images if scraped has more
        key = normalize_sku(row.get("SKU",""))
        live_imgs = split_images(row.get("Images",""))

        extra: List[str] = []
        for scraped_dict in (col_by_sku, tsw_by_sku):
            scraped_row = scraped_dict.get(key)
            if scraped_row:
                for img in split_images(scraped_row.get("Images","")):
                    abs_img = absolutize_image(img, columbia_images_root, columbia_image_base_url)
                    if abs_img not in live_imgs:
                        extra.append(abs_img)

        if extra:
            new_imgs = merge_images(live_imgs, extra, columbia_images_root, columbia_image_base_url)
            added = len([x for x in extra if x])
            stats["image_galleries_enriched"] += 1
            stats["extra_images_added"] += added
            enriched = {h: row.get(h, "") for h in clean_headers}
            enriched["Images"] = new_imgs
            merged.append(enriched)
        else:
            merged.append({h: row.get(h, "") for h in clean_headers})

    # ── Pass 2: append new Columbia SKUs ──────────────────────────────────────
    next_pos = max_col_pos + 1

    for key in sorted(new_sku_keys):
        # Prefer TSW over Columbia-scrape (TSW has absolute image URLs)
        scraped_row: Optional[Dict[str, str]] = tsw_by_sku.get(key) or col_by_sku.get(key)
        if not scraped_row:
            continue

        raw_cat  = scraped_row.get("Categories","")
        live_cat = map_category(raw_cat, scraped_row.get("Name",""))

        # Build image string
        imgs = []
        for img in split_images(scraped_row.get("Images","")):
            imgs.append(absolutize_image(img, columbia_images_root, columbia_image_base_url))
        image_str = "|".join(imgs) if imgs else ""

        new_row = new_row_defaults(clean_headers)
        new_row.update({
            "Brands":                      LIVE_COLUMBIA_BRAND,
            "SKU":                         scraped_row.get("SKU",""),
            "MPN":                         scraped_row.get("MPN", scraped_row.get("SKU","")),
            "Name":                        scraped_row.get("Name",""),
            "Type":                        "simple",
            "Description":                 scraped_row.get("Description",""),
            "Short description":           scraped_row.get("Short description",""),
            "Regular price":               scraped_row.get("Regular price",""),
            "Sale price":                  scraped_row.get("Sale price",""),
            "Images":                      image_str,
            "Categories":                  live_cat,
            "Tags":                        scraped_row.get("Tags",""),
            "Position":                    str(next_pos),
            "Published":                   "1",
            "Is featured?":                "0",
            "Visibility in catalog":       "visible",
            "Tax status":                  "taxable",
            "In stock?":                   "1",
            "Backorders allowed?":         "0",
            "Sold individually?":          "0",
            "Allow customer reviews?":     "1",
            "Attribute 1 name":            "Brand",
            "Attribute 1 value(s)":        LIVE_COLUMBIA_BRAND,
            "Attribute 1 visible":         "1",
            "Attribute 1 global":          "1",
            "meta:_dtb_seo_title":         scraped_row.get("meta:_dtb_seo_title",""),
            "meta:_dtb_seo_description":   scraped_row.get("meta:_dtb_seo_description",""),
        })

        merged.append(new_row)
        next_pos += 1
        stats["new_skus_added"] += 1

    stats["live_total_rows_out"] = len(merged)
    return merged, stats


# ── CLI ───────────────────────────────────────────────────────────────────────

def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(
        description="End-to-end Columbia catalog integration into frontend/public/wp-catalog.csv",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__,
    )
    p.add_argument("--live-csv",               type=Path, default=DEFAULT_LIVE_CSV)
    p.add_argument("--columbia-csv",           type=Path, default=DEFAULT_COLUMBIA_CSV)
    p.add_argument("--tsw-csv",                type=Path, default=DEFAULT_TSW_CSV)
    p.add_argument("--columbia-images-root",   type=Path,
                   default=REPO_ROOT / "scraped_results/columbia_tools")
    p.add_argument("--columbia-image-base-url", default=DEFAULT_COLUMBIA_IMAGE_BASE)
    p.add_argument("--output-dir",             type=Path, default=DEFAULT_OUTPUT_DIR)
    p.add_argument("--dry-run", action="store_true",
                   help="Print what would happen without writing any files")
    p.add_argument("--no-backup", action="store_true",
                   help="Skip creating a timestamped backup (not recommended)")
    return p.parse_args()


def main() -> None:
    args = parse_args()

    # ── Validate inputs ────────────────────────────────────────────────────────
    for path, label in (
        (args.live_csv, "Live catalog"),
        (args.columbia_csv, "Columbia scrape"),
        (args.tsw_csv, "TSW scrape"),
    ):
        if not path.exists():
            fail(f"{label} not found: {path}")
            sys.exit(1)

    step("Loading source catalogs")
    live_rows = load_csv(args.live_csv)
    col_rows  = load_csv(args.columbia_csv)
    tsw_rows  = load_csv(args.tsw_csv)

    if not live_rows:
        fail(f"Live catalog is empty: {args.live_csv}")
        sys.exit(1)
    ok(f"Live catalog:      {len(live_rows):>5} rows")
    ok(f"Columbia scrape:   {len(col_rows):>5} rows")
    ok(f"TSW scrape:        {len(tsw_rows):>5} rows")

    # ── Backup ─────────────────────────────────────────────────────────────────
    if not args.no_backup and not args.dry_run:
        step("Backing up live catalog")
        ts = datetime.now().strftime("%Y%m%d_%H%M%S")
        backup_path = args.live_csv.with_name(f"wp-catalog.csv.bak_{ts}")
        shutil.copy2(args.live_csv, backup_path)
        ok(f"Backup created: {backup_path}")
    elif args.dry_run:
        info("Dry-run: backup skipped")

    # ── Merge ──────────────────────────────────────────────────────────────────
    step("Running integration merge")
    merged_rows, stats = build_integrated_catalog(
        live_rows=live_rows,
        col_rows=col_rows,
        tsw_rows=tsw_rows,
        columbia_images_root=args.columbia_images_root,
        columbia_image_base_url=args.columbia_image_base_url,
    )
    ok(f"Merge complete")

    # ── Print stats ────────────────────────────────────────────────────────────
    step("Integration results")
    info(f"Live rows in:                  {stats['live_total_rows_in']:>5}")
    info(f"  Columbia Taping Tools rows:  {stats['live_columbia_rows']:>5}")
    info(f"  Non-Columbia rows:           {stats['live_non_columbia_rows']:>5}")
    info(f"Scraped Columbia unique SKUs:  {stats['scraped_columbia_skus']:>5}")
    info(f"Scraped TSW unique SKUs:       {stats['scraped_tsw_skus']:>5}")
    info(f"All scraped unique SKUs:       {stats['all_scraped_unique_skus']:>5}")
    info(f"Overlap (live ∩ scraped):      {stats['overlap_skus']:>5}")
    info(f"Image galleries enriched:      {stats['image_galleries_enriched']:>5}  (+{stats['extra_images_added']} images)")
    info(f"New SKUs added from scraped:   {stats['new_skus_added']:>5}")
    info(f"Live rows out:                 {stats['live_total_rows_out']:>5}")

    if args.dry_run:
        warn("Dry-run mode: no files written")
        return

    # ── Write live catalog ─────────────────────────────────────────────────────
    step(f"Writing merged catalog → {args.live_csv}")
    live_headers = [h for h in live_rows[0].keys() if h]
    write_csv(args.live_csv, live_headers, merged_rows)
    ok(f"Wrote {len(merged_rows)} rows to {args.live_csv}")

    # ── Write audit artifacts ──────────────────────────────────────────────────
    step(f"Writing audit artifacts → {args.output_dir}")
    args.output_dir.mkdir(parents=True, exist_ok=True)

    # Merged Columbia-only CSV (for standalone import if needed)
    col_headers = [h for h in col_rows[0].keys() if h]
    col_merged_rows = [
        r for r in merged_rows if r.get("Brands") == LIVE_COLUMBIA_BRAND
    ]
    write_csv(args.output_dir / "wp-catalog.csv", live_headers, col_merged_rows)
    ok(f"Columbia-only CSV: {len(col_merged_rows)} rows")

    # SKU cross-reference
    col_by_sku  = {normalize_sku(r["SKU"]): r for r in col_rows  if normalize_sku(r.get("SKU",""))}
    tsw_by_sku  = {normalize_sku(r["SKU"]): r for r in tsw_rows  if normalize_sku(r.get("SKU",""))}
    live_col_d  = {normalize_sku(r["SKU"]): r for r in live_rows
                   if r.get("Brands") == LIVE_COLUMBIA_BRAND and normalize_sku(r.get("SKU",""))}

    xref_rows: List[Dict[str, str]] = []
    for row in col_merged_rows:
        key = normalize_sku(row.get("SKU",""))
        xref_rows.append({
            "sku":             row.get("SKU",""),
            "in_live_before":  "1" if key in live_col_d else "0",
            "in_columbia_scrape": "1" if key in col_by_sku else "0",
            "in_tsw_scrape":   "1" if key in tsw_by_sku else "0",
            "action":          "existing" if key in live_col_d else "added",
            "name":            row.get("Name",""),
            "category":        row.get("Categories",""),
            "has_image":       "1" if row.get("Images","").strip() else "0",
        })
    xref_path = args.output_dir / "sku-cross-reference.csv"
    xref_headers = ["sku","in_live_before","in_columbia_scrape","in_tsw_scrape","action","name","category","has_image"]
    write_csv(xref_path, xref_headers, xref_rows)
    ok(f"Cross-reference CSV: {len(xref_rows)} rows")

    # JSON summary
    summary = {
        "run_at": datetime.now().isoformat(),
        "inputs": {
            "live_csv":             str(args.live_csv),
            "columbia_csv":         str(args.columbia_csv),
            "tsw_csv":              str(args.tsw_csv),
            "columbia_images_root": str(args.columbia_images_root),
            "columbia_image_base_url": args.columbia_image_base_url,
        },
        "stats": stats,
        "outputs": {
            "merged_live_csv":  str(args.live_csv),
            "columbia_only_csv": str(args.output_dir / "wp-catalog.csv"),
            "xref_csv":         str(xref_path),
        },
    }
    summary_json = args.output_dir / "audit-summary.json"
    summary_json.write_text(json.dumps(summary, indent=2), encoding="utf-8")

    # Markdown summary
    s = stats
    md_lines = [
        "# Columbia Catalog End-to-End Integration Summary",
        "",
        f"**Run at:** {summary['run_at']}",
        "",
        "## Source files",
        "",
        f"- Live catalog: `{args.live_csv}`",
        f"- Columbia scrape: `{args.columbia_csv}`",
        f"- TSW scrape: `{args.tsw_csv}`",
        "",
        "## Integration stats",
        "",
        f"| Metric | Count |",
        f"|--------|-------|",
        f"| Live rows in | {s['live_total_rows_in']} |",
        f"| Columbia Taping Tools rows (live) | {s['live_columbia_rows']} |",
        f"| Non-Columbia rows (unchanged) | {s['live_non_columbia_rows']} |",
        f"| Scraped Columbia unique SKUs | {s['scraped_columbia_skus']} |",
        f"| Scraped TSW unique SKUs | {s['scraped_tsw_skus']} |",
        f"| All scraped unique SKUs | {s['all_scraped_unique_skus']} |",
        f"| Overlap (live ∩ scraped) | {s['overlap_skus']} |",
        f"| Image galleries enriched | {s['image_galleries_enriched']} (+{s['extra_images_added']} images) |",
        f"| New SKUs added from scraped | {s['new_skus_added']} |",
        f"| Live rows out | {s['live_total_rows_out']} |",
        "",
        "## Outputs",
        "",
        f"- Integrated live catalog: `{args.live_csv}`",
        f"- Columbia-only CSV: `{args.output_dir}/wp-catalog.csv`",
        f"- SKU cross-reference: `{xref_path}`",
        f"- JSON summary: `{summary_json}`",
    ]
    summary_md = args.output_dir / "audit-summary.md"
    summary_md.write_text("\n".join(md_lines), encoding="utf-8")
    ok(f"Summary written to {summary_md}")

    print()
    ok("Integration complete!")
    print(f"\n{GREEN}{BOLD}   → {args.live_csv}{RESET}")


if __name__ == "__main__":
    main()
