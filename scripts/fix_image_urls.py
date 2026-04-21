"""
Fix and optimize product image URLs in wp-catalog.csv.

Strategy:
1. Build index of all .webp files in Products/ grouped by lowercase SKU prefix
2. For each row in wp-catalog.csv:
   - simple/variation: find files matching SKU prefix
   - variable parent: use first child variation's images
3. Use custom mappings for SKUs that don't directly match filenames
4. Clear images for TapeTech parts (050xxx-059xxx) that have no files
5. Deduplicate and expand all image URL lists
"""

import csv
import os
import re
from collections import defaultdict

BASE_URL = "https://drywalltoolbox.com/wp/wp-content/uploads/2026/04/"
PRODUCTS_DIR = "/home/runner/work/drywall-toolbox/drywall-toolbox/scripts/scraped_results/Products/"
CATALOG_PATH = "/home/runner/work/drywall-toolbox/drywall-toolbox/frontend/public/wp-catalog.csv"

# Custom SKU -> filename prefix mappings for products whose filenames
# don't directly match the SKU (scraped with different naming conventions)
CUSTOM_SKU_PREFIX_MAP = {
    # TapeTech Tapers (scraped with model-prefix naming)
    "07TT":        "ez07tt",    # EasyClean Automatic Taper
    "03TT":        "ns03tt",    # EasyClean Automatic Mini-Taper
    "07TT-C":      "ca07tt",    # Carbon Fiber Automatic Taper

    # Columbia products
    "C1HS":        "c1h",       # Columbia 1" Hand Skimmer
    "CLT":         "clt24",     # Compound Loading Tool (24" representative image)
    "CMT":         "cmt24",     # Compound Tube (24" representative)
    "AH73":        "ah735",     # AH73.5 Angle Head variation
    "8FFBA":       "14ffba",    # 14" Full Box variation
    "CSH":         "cs",        # Columbia Skimmer Handle
    "ICA":         "ica2_1",    # Inside Corner Applicator
    "ITC-K":       "itc_k",     # Inside Taper Corner Kit
    "SSB-SIZE":    "ssb_size",  # Stilts size chart
    "TSB-SIZE":    "tsb_size",  # Stilts size chart

    # Platinum
    "PT-3NS":      "pt-2ns",    # 3" Nail Spotter (shares 2NS images)

    # TapeTech Corner Rollers (generic image only)
    "CROLL-TT":    "cr",
    "CROLL-TT-4":  "cr",
    "CROLL-TT-9":  "cr",
    "CROLL-TT-12": "cr",

    # TapeTech Quick Corner Angle Head
    "CA-TT":       "qca-tt",
    "CA-TT-7":     "qca-tt",
    "CA-TT-8":     "qca-tt",

    # TapeTech EasyClean® Flat Box Handles (generic image)
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

# TapeTech spare parts SKU pattern (have no images in Products/)
PARTS_SKU_RE = re.compile(r'^0[5-9][0-9]{4}', re.IGNORECASE)

# Suffix pattern: _<hexhash8> or _<digits>
SUFFIX_RE = re.compile(r'^(.+?)(?:_([0-9a-f]{8}|[0-9]+))?$')


def build_file_index(products_dir):
    """
    Build index: lowercase_prefix -> sorted list of .webp filenames.
    Prefix is the SKU-like portion of the filename (before optional _suffix).
    """
    index = defaultdict(list)
    for fname in sorted(os.listdir(products_dir)):
        if not fname.lower().endswith('.webp'):
            continue
        base = fname[:-5].lower()  # remove .webp, lowercase
        m = SUFFIX_RE.match(base)
        prefix = m.group(1) if m else base
        index[prefix].append(fname)

    # Sort each group: exact-name-match (main image) first, then alphabetically
    for key in index:
        index[key].sort(key=lambda f: (
            0 if f[:-5].lower() == key else 1,  # main image first
            f.lower()
        ))
    return index


def get_images_for_sku(sku, file_index):
    """Return sorted list of .webp filenames from Products/ for the given SKU."""
    # Custom prefix mapping takes priority
    prefix = CUSTOM_SKU_PREFIX_MAP.get(sku.upper(), sku.lower())
    return list(file_index.get(prefix, []))


def build_urls(filenames):
    """Convert list of filenames to pipe-separated URL string."""
    return "|".join(BASE_URL + f for f in filenames)


def is_parts_sku(sku):
    """Return True if this is a TapeTech spare part with no available image."""
    return bool(PARTS_SKU_RE.match(sku))


def main():
    file_index = build_file_index(PRODUCTS_DIR)

    # Read entire CSV
    with open(CATALOG_PATH, newline='', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        fieldnames = reader.fieldnames
        rows = list(reader)

    # Build parent -> [child SKUs in order] map
    parent_to_children = defaultdict(list)
    for row in rows:
        parent = row.get('Parent', '').strip()
        if parent and row.get('Type') == 'variation':
            parent_to_children[parent].append(row['SKU'])

    stats = {
        'unchanged':    0,
        'fixed':        0,
        'deduped':      0,
        'expanded':     0,
        'cleared':      0,
        'no_file':      0,
    }

    updated_rows = []
    for row in rows:
        sku      = row.get('SKU', '').strip()
        ptype    = row.get('Type', '').strip()
        old_imgs = row.get('Images', '').strip()

        # TapeTech spare parts: clear image URL
        if is_parts_sku(sku):
            if old_imgs:
                row['Images'] = ''
                stats['cleared'] += 1
            else:
                stats['unchanged'] += 1
            updated_rows.append(row)
            continue

        # Determine correct image files for this SKU
        if ptype == 'variable':
            # Use first child variation that has matching files
            files = []
            for child_sku in parent_to_children.get(sku, []):
                child_files = get_images_for_sku(child_sku, file_index)
                if child_files:
                    files = child_files
                    break
            # Fallback: try parent SKU directly (e.g., CMT, CLT have custom map)
            if not files:
                files = get_images_for_sku(sku, file_index)
        else:
            files = get_images_for_sku(sku, file_index)

        if not files:
            # No files found - keep existing (may be correct but we can't verify)
            if old_imgs:
                stats['no_file'] += 1
                print(f"  INFO no-file: SKU={sku} (type={ptype}) | existing: {old_imgs[:80]}")
            else:
                stats['unchanged'] += 1
            updated_rows.append(row)
            continue

        new_imgs = build_urls(files)

        if new_imgs == old_imgs:
            stats['unchanged'] += 1
        else:
            old_urls = [u for u in old_imgs.split('|') if u.strip()] if old_imgs else []
            old_unique = list(dict.fromkeys(old_urls))
            new_urls   = files

            if not old_imgs:
                stats['fixed'] += 1
            elif len(old_unique) < len(old_urls):
                # Had duplicates
                if set(u.replace(BASE_URL,'') for u in old_unique) != set(new_urls):
                    stats['fixed'] += 1
                else:
                    stats['deduped'] += 1
            elif set(u.replace(BASE_URL,'') for u in old_unique) != set(new_urls):
                stats['fixed'] += 1
            else:
                stats['expanded'] += 1

            row['Images'] = new_imgs

        updated_rows.append(row)

    # Write back
    with open(CATALOG_PATH, 'w', newline='', encoding='utf-8') as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(updated_rows)

    print(f"\n=== Image URL Update Complete ===")
    print(f"  Unchanged:        {stats['unchanged']}")
    print(f"  Fixed (wrong):    {stats['fixed']}")
    print(f"  Deduped only:     {stats['deduped']}")
    print(f"  Expanded:         {stats['expanded']}")
    print(f"  Cleared (parts):  {stats['cleared']}")
    print(f"  No file found:    {stats['no_file']}")
    print(f"  Total rows:       {sum(stats.values())}")


if __name__ == '__main__':
    main()
