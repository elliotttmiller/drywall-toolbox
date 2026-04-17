#!/usr/bin/env python3
"""
End-to-End Columbia Catalog Integration
=========================================
Replaces ALL existing Columbia rows in frontend/public/wp-catalog.csv with a
new, optimized and polished catalog built entirely from the two scraped sources.

Strategy
--------
1. Create a timestamped backup of the live catalog before any changes.
2. Load three inputs:
     a. Live catalog   (frontend/public/wp-catalog.csv)
     b. Columbia scrape (scraped_results/columbia_tools/wp-catalog.csv)
     c. TSW scrape      (scraped_results/tsw_columbia/products_tsw.csv)
3. Strip ALL existing "Columbia Taping Tools" rows from the live catalog.
4. Build a fresh Columbia section from the scraped sources (367 unique SKUs):
     - For SKUs present in both scraped sources:
         • Pick the longer description (Columbia scrape often has richer HTML).
         • Merge image galleries from both (Columbia scrape multi-image + TSW
           single absolute URL), de-duplicated.
         • Use TSW SEO meta fields (already optimized).
     - For SKUs only in Columbia scrape: use as-is (images absolutized).
     - For SKUs only in TSW: use as-is.
     - Normalize Brand to "Columbia Taping Tools" for all rows.
     - Map scraped category to the live catalog's category hierarchy.
     - Regenerate Position numbers sequentially (1-N) for the whole section.
5. Append the fresh Columbia rows after all non-Columbia rows.
6. Write the combined catalog back to frontend/public/wp-catalog.csv.
7. Write full audit artifacts to scraped_results/columbia_merged/.

Usage
-----
  python scripts/integrate_columbia_catalog.py
  python scripts/integrate_columbia_catalog.py --dry-run    # preview, no writes
  python scripts/integrate_columbia_catalog.py --no-backup  # skip backup
  python scripts/integrate_columbia_catalog.py \\
      --live-csv      frontend/public/wp-catalog.csv \\
      --columbia-csv  scraped_results/columbia_tools/wp-catalog.csv \\
      --tsw-csv       scraped_results/tsw_columbia/products_tsw.csv \\
      --output-dir    scraped_results/columbia_merged
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
    "Drywall Finishing Tools > Columbia Tools > Suggested Tool Sets": f"{LIVE_CATEGORY_PREFIX} > Repair Kits & Parts",
    "Drywall Finishing Tools > Columbia Tools > The Tool Sets":       f"{LIVE_CATEGORY_PREFIX} > Repair Kits & Parts",
    "Drywall Finishing Tools > Columbia Tools > Tool Sets":           f"{LIVE_CATEGORY_PREFIX} > Repair Kits & Parts",
    "Drywall Finishing Tools > Columbia Tools > Semi Automatic Taper":f"{LIVE_CATEGORY_PREFIX} > Automatic Tapers",
}

import re as _re

# SKU-prefix rules that override name inference (applied before name keywords)
_SKU_PREFIX_CATEGORY: List[Tuple[str, str]] = [
    # Taper parts: CT*, CTA*, CTR*, CTK*
    ("^CT[A-Z0-9]",     f"{LIVE_CATEGORY_PREFIX} > Repair Kits & Parts"),
    # Flat-box spare parts: CFB*
    ("^CFB[0-9A-Z]",    f"{LIVE_CATEGORY_PREFIX} > Repair Kits & Parts"),
    # Flat-box spare parts with numeric suffix: FFB[0-9]*
    ("^FFB[0-9]",       f"{LIVE_CATEGORY_PREFIX} > Repair Kits & Parts"),
    # Fasteners / hardware: FA*
    ("^FA[0-9]",        f"{LIVE_CATEGORY_PREFIX} > Repair Kits & Parts"),
    # Box-handle mounting parts: BH[0-9]*
    ("^BH[0-9]",        f"{LIVE_CATEGORY_PREFIX} > Handles & Extensions"),
    # Matrix Handle parts: MH[0-9]*
    ("^MH[0-9]",        f"{LIVE_CATEGORY_PREFIX} > Handles & Extensions"),
]


# Fallback by keyword match on product name (for TSW rows with generic category)
def infer_category_from_sku_and_name(sku: str, name: str) -> str:
    # SKU-prefix rules take highest priority
    s = (sku or "").upper().strip()
    for pattern, cat in _SKU_PREFIX_CATEGORY:
        if _re.match(pattern, s):
            return cat

    n = (name or "").lower()

    # Throttle boxes are genuine finishing boxes
    if "throttle box" in n:
        return f"{LIVE_CATEGORY_PREFIX} > Finishing Boxes"

    # Handles & extensions — check BEFORE flat box to catch "Flat Box Handle"
    if any(x in n for x in ["flat box handle", "handle", "extension", "brake",
                              "mounting plate", "mounting bracket", "cam lock"]):
        return f"{LIVE_CATEGORY_PREFIX} > Handles & Extensions"

    # Taper-related components (name contains "taper" + part keyword)
    taper_part_kws = ["casting", "bracket", "bushing", "spring", "pin", "shaft",
                      "lever", "plate", "block", "valve", "cable", "chain", "gear",
                      "roller", "seal", "drum", "clutch", "release", "crimp",
                      "ratchet", "spacer", "strap", "spool", "piston", "guard",
                      "needle", "bushing", "carriage", "assembly", "bracket base"]
    if "taper" in n and any(kw in n for kw in taper_part_kws):
        return f"{LIVE_CATEGORY_PREFIX} > Repair Kits & Parts"

    # Genuine flat boxes / finishing boxes (product, not spare part)
    if any(x in n for x in ["flat box", "finishing box", "fat boy box", "angle box"]):
        return f"{LIVE_CATEGORY_PREFIX} > Finishing Boxes"

    # Automatic tapers (complete tools)
    if any(x in n for x in ["automatic taper", "taper semi", "semi-automatic taper"]):
        return f"{LIVE_CATEGORY_PREFIX} > Automatic Tapers"

    # Corner / angle tools
    if any(x in n for x in ["anglehead", "angle head", "corner flusher", "corner roller",
                              "corner tool", "combo flusher", "direct corner", "standard corner"]):
        return f"{LIVE_CATEGORY_PREFIX} > Corner & Angle Tools"

    # Nailspotters
    if any(x in n for x in ["nailspotter", "nail spotter", "spotter"]):
        return f"{LIVE_CATEGORY_PREFIX} > Spotters"

    # Pumps & accessories
    if any(x in n for x in ["pump", "compound tube", "applicator", "mud head", "grooved",
                              "gooseneck", "powerfill", "cam lock tube", "coupling pin",
                              "swivel coupling", "valve unit"]):
        return f"{LIVE_CATEGORY_PREFIX} > Pumps & Accessories"

    # Repair kits & parts (broad bucket)
    if any(x in n for x in ["maintenance kit", "repair kit", "blade", "spring", "part",
                              "trowel", "hawk", "knife", "knives", "putty", "sander",
                              "smoothing", "tool case", "carrying", "mud pan", "mud pans",
                              "screw", "bolt", "nut", "washer", "pin", "clip", "bushing",
                              "bracket", "casting", "hinge", "seal", "door", "gasket",
                              "roll face", "nylatron", "plate", "adaptor", "adapter",
                              "set", "commando", "tactical", "predator", "sabre", "kit"]):
        return f"{LIVE_CATEGORY_PREFIX} > Repair Kits & Parts"

    return f"{LIVE_CATEGORY_PREFIX} > Finishing Boxes"


def map_category(scraped_cat: str, name: str, sku: str = "") -> str:
    if scraped_cat in CATEGORY_MAP:
        return CATEGORY_MAP[scraped_cat]
    return infer_category_from_sku_and_name(sku, name)

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

# ── Core merge logic for a single Columbia SKU ───────────────────────────────

def build_columbia_row(
    key: str,
    col_by_sku: Dict[str, Dict[str, str]],
    tsw_by_sku: Dict[str, Dict[str, str]],
    columbia_images_root: Path,
    columbia_image_base_url: str,
    headers: List[str],
    position: int,
) -> Dict[str, str]:
    """
    Construct one polished WooCommerce row for a Columbia SKU.

    Priority rules:
    - Description: prefer the longer HTML description (Columbia scrape is usually
      richer; TSW is used as fallback).
    - Short description: prefer TSW (clean prose), fall back to Columbia scrape.
    - Images: Columbia scrape provides multi-image galleries (absolutized);
      TSW provides a single canonical absolute URL.  We put gallery images first,
      then add any unique TSW image after, so the primary/featured image is the
      gallery lead shot from Columbia's own site.
    - SEO meta: TSW has optimized title/description; use them when available.
    - Tags: merge unique tags from both sources.
    - All WC control fields use safe, production-ready defaults.
    """
    c_row: Optional[Dict[str, str]] = col_by_sku.get(key)
    t_row: Optional[Dict[str, str]] = tsw_by_sku.get(key)
    base  = t_row or c_row
    if base is None:
        raise ValueError(f"build_columbia_row: no source for key {key!r}")

    # ── Description: longer wins ──────────────────────────────────────────────
    c_desc  = (c_row or {}).get("Description","")
    t_desc  = (t_row or {}).get("Description","")
    description = c_desc if len(c_desc) >= len(t_desc) else t_desc

    # ── Short description ─────────────────────────────────────────────────────
    t_short = (t_row or {}).get("Short description","")
    c_short = (c_row or {}).get("Short description","")
    short_description = t_short or c_short

    # ── Images: Columbia gallery first, TSW featured image appended ───────────
    col_imgs: List[str] = []
    for img in split_images((c_row or {}).get("Images","")):
        col_imgs.append(absolutize_image(img, columbia_images_root, columbia_image_base_url))
    tsw_imgs: List[str] = []
    for img in split_images((t_row or {}).get("Images","")):
        tsw_imgs.append(absolutize_image(img, columbia_images_root, columbia_image_base_url))
    image_str = merge_images(col_imgs, tsw_imgs, columbia_images_root, columbia_image_base_url)

    # ── Category ──────────────────────────────────────────────────────────────
    # Columbia scrape has richer sub-categories; prefer it over the generic TSW category
    c_cat = (c_row or {}).get("Categories","")
    t_cat = (t_row or {}).get("Categories","")
    raw_cat = c_cat if c_cat else t_cat
    live_cat = map_category(raw_cat, base.get("Name",""), sku=base.get("SKU",""))

    # ── Tags: merge and deduplicate ───────────────────────────────────────────
    c_tags = [t.strip() for t in (c_row or {}).get("Tags","").split(",") if t.strip()]
    t_tags = [t.strip() for t in (t_row or {}).get("Tags","").split(",") if t.strip()]
    seen_tags: OrderedDict[str, bool] = OrderedDict()
    for tag in t_tags + c_tags:  # TSW tags first (cleaner, keyword-optimized)
        seen_tags[tag] = True
    tags = ", ".join(seen_tags.keys())

    # ── SEO meta: prefer TSW ──────────────────────────────────────────────────
    seo_title = (t_row or {}).get("meta:_dtb_seo_title","") or (c_row or {}).get("meta:_dtb_seo_title","")
    seo_desc  = (t_row or {}).get("meta:_dtb_seo_description","") or (c_row or {}).get("meta:_dtb_seo_description","")

    # If TSW SEO title is missing, generate a clean one
    if not seo_title:
        sku  = base.get("SKU","")
        name = base.get("Name","")
        seo_title = f"{name} | {sku}" if sku and name else name

    row = new_row_defaults(headers)
    row.update({
        "Brands":                    LIVE_COLUMBIA_BRAND,
        "SKU":                       base.get("SKU",""),
        "MPN":                       base.get("MPN", base.get("SKU","")),
        "Name":                      base.get("Name",""),
        "Type":                      "simple",
        "Description":               description,
        "Short description":         short_description,
        "Regular price":             base.get("Regular price",""),
        "Sale price":                base.get("Sale price",""),
        "Images":                    image_str,
        "Categories":                live_cat,
        "Tags":                      tags,
        "Position":                  str(position),
        "Published":                 "1",
        "Is featured?":              "0",
        "Visibility in catalog":     "visible",
        "Tax status":                "taxable",
        "Tax class":                 "",
        "In stock?":                 "1",
        "Stock":                     "",
        "Low stock amount":          "",
        "Backorders allowed?":       "0",
        "Sold individually?":        "0",
        "Allow customer reviews?":   "1",
        "Attribute 1 name":          "Brand",
        "Attribute 1 value(s)":      LIVE_COLUMBIA_BRAND,
        "Attribute 1 visible":       "1",
        "Attribute 1 global":        "1",
        "meta:_dtb_seo_title":       seo_title,
        "meta:_dtb_seo_description": seo_desc,
    })
    return row


# ── Main integration ──────────────────────────────────────────────────────────

def build_replacement_catalog(
    live_rows:            List[Dict[str, str]],
    col_rows:             List[Dict[str, str]],
    tsw_rows:             List[Dict[str, str]],
    columbia_images_root: Path,
    columbia_image_base_url: str,
) -> Tuple[List[Dict[str, str]], Dict]:
    """
    Returns (output_rows, stats).

    All existing Columbia Taping Tools rows are discarded.
    A fresh set of Columbia rows is built from the scraped sources.
    Non-Columbia rows are preserved verbatim.
    """
    # Remove trailing empty header column that the live CSV sometimes carries
    headers = [h for h in (live_rows[0].keys() if live_rows else []) if h]

    # Index scraped sources
    col_by_sku = {normalize_sku(r["SKU"]): r for r in col_rows if normalize_sku(r.get("SKU",""))}
    tsw_by_sku = {normalize_sku(r["SKU"]): r for r in tsw_rows if normalize_sku(r.get("SKU",""))}

    # All unique SKUs across both scraped sources
    all_scraped_keys = sorted(set(col_by_sku.keys()) | set(tsw_by_sku.keys()))

    # Count rows being removed
    old_columbia_keys = {normalize_sku(r.get("SKU","")) for r in live_rows
                         if r.get("Brands") == LIVE_COLUMBIA_BRAND and normalize_sku(r.get("SKU",""))}

    stats: Dict = {
        "live_total_rows_in":      len(live_rows),
        "old_columbia_rows_removed": len(old_columbia_keys),
        "live_non_columbia_rows":  sum(1 for r in live_rows if r.get("Brands") != LIVE_COLUMBIA_BRAND),
        "scraped_columbia_skus":   len(col_by_sku),
        "scraped_tsw_skus":        len(tsw_by_sku),
        "all_scraped_unique_skus": len(all_scraped_keys),
        "in_both_sources":         len(set(col_by_sku.keys()) & set(tsw_by_sku.keys())),
        "only_in_columbia_scrape": len(set(col_by_sku.keys()) - set(tsw_by_sku.keys())),
        "only_in_tsw":             len(set(tsw_by_sku.keys()) - set(col_by_sku.keys())),
        "new_columbia_rows":       0,
        "with_gallery_images":     0,
        "live_total_rows_out":     0,
    }

    # ── Pass 1: keep all non-Columbia rows exactly ────────────────────────────
    output: List[Dict[str, str]] = []
    for row in live_rows:
        if row.get("Brands") != LIVE_COLUMBIA_BRAND:
            output.append({h: row.get(h, "") for h in headers})

    # ── Pass 2: build fresh Columbia section ──────────────────────────────────
    position = 1
    for key in all_scraped_keys:
        # Skip rows where the SKU is empty (category-header artefacts with no SKU)
        c_row = col_by_sku.get(key)
        t_row = tsw_by_sku.get(key)
        sku = ((c_row or t_row) or {}).get("SKU","").strip()
        if not sku:
            continue

        new_row = build_columbia_row(
            key=key,
            col_by_sku=col_by_sku,
            tsw_by_sku=tsw_by_sku,
            columbia_images_root=columbia_images_root,
            columbia_image_base_url=columbia_image_base_url,
            headers=headers,
            position=position,
        )
        output.append(new_row)
        if len(split_images(new_row.get("Images",""))) > 1:
            stats["with_gallery_images"] += 1
        position += 1
        stats["new_columbia_rows"] += 1

    stats["live_total_rows_out"] = len(output)
    return output, stats


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
    step("Building replacement Columbia catalog")
    merged_rows, stats = build_replacement_catalog(
        live_rows=live_rows,
        col_rows=col_rows,
        tsw_rows=tsw_rows,
        columbia_images_root=args.columbia_images_root,
        columbia_image_base_url=args.columbia_image_base_url,
    )
    ok("Build complete")

    # ── Print stats ────────────────────────────────────────────────────────────
    step("Integration results")
    info(f"Live rows in (original):       {stats['live_total_rows_in']:>5}")
    info(f"  Old Columbia rows removed:   {stats['old_columbia_rows_removed']:>5}")
    info(f"  Non-Columbia rows kept:      {stats['live_non_columbia_rows']:>5}")
    info(f"Scraped Columbia unique SKUs:  {stats['scraped_columbia_skus']:>5}")
    info(f"Scraped TSW unique SKUs:       {stats['scraped_tsw_skus']:>5}")
    info(f"All scraped unique SKUs:       {stats['all_scraped_unique_skus']:>5}")
    info(f"  In both sources:             {stats['in_both_sources']:>5}  (best-of merge)")
    info(f"  Only in Columbia scrape:     {stats['only_in_columbia_scrape']:>5}")
    info(f"  Only in TSW:                 {stats['only_in_tsw']:>5}")
    info(f"New Columbia rows built:       {stats['new_columbia_rows']:>5}")
    info(f"  With multi-image galleries:  {stats['with_gallery_images']:>5}")
    info(f"Live rows out (total):         {stats['live_total_rows_out']:>5}")

    if args.dry_run:
        warn("Dry-run mode: no files written")
        return

    # ── Write live catalog ─────────────────────────────────────────────────────
    step(f"Writing replacement catalog → {args.live_csv}")
    live_headers = [h for h in live_rows[0].keys() if h]
    write_csv(args.live_csv, live_headers, merged_rows)
    ok(f"Wrote {len(merged_rows)} rows to {args.live_csv}")

    # ── Write audit artifacts ──────────────────────────────────────────────────
    step(f"Writing audit artifacts → {args.output_dir}")
    args.output_dir.mkdir(parents=True, exist_ok=True)

    # Columbia-only CSV (the new section for standalone import if needed)
    col_only_rows = [r for r in merged_rows if r.get("Brands") == LIVE_COLUMBIA_BRAND]
    write_csv(args.output_dir / "wp-catalog.csv", live_headers, col_only_rows)
    ok(f"Columbia-only CSV: {len(col_only_rows)} rows")

    # SKU cross-reference
    col_by_sku_ref = {normalize_sku(r["SKU"]): r for r in col_rows if normalize_sku(r.get("SKU",""))}
    tsw_by_sku_ref = {normalize_sku(r["SKU"]): r for r in tsw_rows if normalize_sku(r.get("SKU",""))}

    xref_rows: List[Dict[str, str]] = []
    for row in col_only_rows:
        key = normalize_sku(row.get("SKU",""))
        in_col = "1" if key in col_by_sku_ref else "0"
        in_tsw = "1" if key in tsw_by_sku_ref else "0"
        source = ("both" if in_col == "1" and in_tsw == "1"
                  else "columbia" if in_col == "1"
                  else "tsw")
        xref_rows.append({
            "sku":              row.get("SKU",""),
            "in_columbia_scrape": in_col,
            "in_tsw_scrape":    in_tsw,
            "source":           source,
            "name":             row.get("Name",""),
            "category":         row.get("Categories",""),
            "has_image":        "1" if row.get("Images","").strip() else "0",
            "image_count":      str(len(split_images(row.get("Images","")))),
        })
    xref_path = args.output_dir / "sku-cross-reference.csv"
    xref_headers = ["sku","in_columbia_scrape","in_tsw_scrape","source","name","category","has_image","image_count"]
    write_csv(xref_path, xref_headers, xref_rows)
    ok(f"Cross-reference CSV: {len(xref_rows)} rows")

    # JSON summary
    summary = {
        "run_at": datetime.now().isoformat(),
        "inputs": {
            "live_csv":              str(args.live_csv),
            "columbia_csv":          str(args.columbia_csv),
            "tsw_csv":               str(args.tsw_csv),
            "columbia_images_root":  str(args.columbia_images_root),
            "columbia_image_base_url": args.columbia_image_base_url,
        },
        "stats": stats,
        "outputs": {
            "merged_live_csv":   str(args.live_csv),
            "columbia_only_csv": str(args.output_dir / "wp-catalog.csv"),
            "xref_csv":          str(xref_path),
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
        "## Strategy",
        "",
        "All existing Columbia Taping Tools rows were **replaced** with a fresh catalog",
        "built entirely from the Columbia Tools scrape and TSW scrape sources.",
        "",
        "## Source files",
        "",
        f"- Live catalog (original): `{args.live_csv}`",
        f"- Columbia Tools scrape: `{args.columbia_csv}`",
        f"- TSW scrape: `{args.tsw_csv}`",
        "",
        "## Integration stats",
        "",
        "| Metric | Count |",
        "|--------|-------|",
        f"| Original live rows | {s['live_total_rows_in']} |",
        f"| Old Columbia rows removed | {s['old_columbia_rows_removed']} |",
        f"| Non-Columbia rows kept unchanged | {s['live_non_columbia_rows']} |",
        f"| Scraped Columbia unique SKUs | {s['scraped_columbia_skus']} |",
        f"| Scraped TSW unique SKUs | {s['scraped_tsw_skus']} |",
        f"| Total unique scraped SKUs | {s['all_scraped_unique_skus']} |",
        f"| In both sources (best-of merge) | {s['in_both_sources']} |",
        f"| Only in Columbia scrape | {s['only_in_columbia_scrape']} |",
        f"| Only in TSW | {s['only_in_tsw']} |",
        f"| New Columbia rows built | {s['new_columbia_rows']} |",
        f"| With multi-image galleries | {s['with_gallery_images']} |",
        f"| Final catalog rows | {s['live_total_rows_out']} |",
        "",
        "## Merge rules",
        "",
        "- **Description**: longer HTML from either source wins",
        "- **Images**: Columbia scrape gallery images first (multi-image), TSW canonical image appended",
        "- **Short description**: TSW preferred (clean prose), Columbia scrape fallback",
        "- **SEO meta**: TSW optimized titles/descriptions preferred",
        "- **Tags**: merged and deduplicated (TSW tags first)",
        "- **Category**: Columbia scrape sub-category preferred; mapped to live catalog hierarchy",
        "- **Brand**: normalized to `Columbia Taping Tools`",
        "",
        "## Outputs",
        "",
        f"- Updated live catalog: `{args.live_csv}`",
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
