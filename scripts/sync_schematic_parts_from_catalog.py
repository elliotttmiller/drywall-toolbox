#!/usr/bin/env python3
"""
sync_schematic_parts_from_catalog.py

Synchronize part hotspot data in schematic_data.json files with accurate
product information from the WooCommerce catalog CSV.

Matching strategy (in priority order):
  1. Exact case-insensitive match: part.id == catalog.sku
  2. Normalized match (remove hyphens/spaces/underscores, uppercase):
       normalize(part.id) == normalize(catalog.sku)
  3. Strip trailing "X N" / "W ..." quantity/note suffixes from part.id,
     then repeat exact + normalized checks.
  4. For parts that already have a non-empty part.sku, use that SKU to
     verify/update price from the catalog (sku-lookup only, no overwrite of
     name/sku if already populated).

For every confirmed match the script updates:
  - part["sku"]   → canonical catalog SKU (exact case from CSV)
  - part["name"]  → catalog product name
                    (only when the current name is identical to part.id,
                     indicating an auto-populated placeholder, not a
                     hand-crafted descriptive name)
  - part["price"] → catalog price (sale price if available, else regular)

Unmatched parts are left untouched.

Usage:
    python scripts/sync_schematic_parts_from_catalog.py [--dry-run] [--verbose]

Options:
    --dry-run   Print proposed changes without writing any files.
    --verbose   Print every part processed (matched and unmatched).
"""

import argparse
import csv
import glob
import json
import os
import re
import sys


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def normalize(s: str) -> str:
    """Strip hyphens, spaces, underscores; uppercase."""
    return re.sub(r'[\s\-_]', '', s).upper()


def clean_part_id(pid: str) -> str:
    """
    Strip common quantity/note suffixes from a schematic part ID so it can
    be looked up in the catalog.

    Examples:
        "059619 X 2 W LOCTITE 263 (RED)"  ->  "059619"
        "480002B X 2"                      ->  "480002B"
        "883020"                           ->  "883020"
    """
    # Remove " X N ..." or " x N ..." trailing quantity annotations
    cleaned = re.sub(r'\s+[Xx]\s+\d+.*$', '', pid).strip()
    # Remove " W ..." trailing notes
    cleaned = re.sub(r'\s+[Ww]\s+.*$', '', cleaned).strip()
    return cleaned


# ---------------------------------------------------------------------------
# Catalog loading
# ---------------------------------------------------------------------------

def load_catalog(csv_path: str) -> dict:
    """
    Load wp-catalog.csv and return a dict keyed by SKU (original case).
    Each value is a dict with: name, price, image, categories.
    """
    catalog: dict[str, dict] = {}
    with open(csv_path, newline='', encoding='utf-8') as fh:
        reader = csv.DictReader(fh)
        for row in reader:
            sku = row.get('SKU', '').strip()
            if not sku:
                continue
            sale_price_str = row.get('Sale price', '').strip()
            reg_price_str = row.get('Regular price', '').strip()
            try:
                sale_price = float(sale_price_str) if sale_price_str else 0.0
            except ValueError:
                sale_price = 0.0
            try:
                reg_price = float(reg_price_str) if reg_price_str else 0.0
            except ValueError:
                reg_price = 0.0
            price = sale_price if sale_price else reg_price

            images_raw = row.get('Images', '').strip()
            image = images_raw.split('|')[0].strip() if images_raw else ''

            catalog[sku] = {
                'name': row.get('Name', '').strip(),
                'price': price,
                'image': image,
                'categories': row.get('Categories', '').strip(),
            }
    return catalog


def build_lookup_indices(catalog: dict) -> tuple[dict, dict]:
    """
    Build two lookup indices from the catalog dict:
      exact_lower  : { sku.lower()    : sku }   – for case-insensitive exact match
      normalized   : { normalize(sku) : sku }   – for hyphen/space-stripped match
    """
    exact_lower: dict[str, str] = {}
    normalized: dict[str, str] = {}
    for sku in catalog:
        key_lower = sku.lower()
        key_norm = normalize(sku)
        # If two SKUs collide on the same normalised form, last writer wins.
        # This is acceptable – collisions indicate identical parts.
        exact_lower[key_lower] = sku
        normalized[key_norm] = sku
    return exact_lower, normalized


# ---------------------------------------------------------------------------
# Match logic
# ---------------------------------------------------------------------------

def find_catalog_sku(
    part_id: str,
    existing_sku: str,
    exact_lower: dict,
    normalized: dict,
) -> str | None:
    """
    Return the canonical catalog SKU that matches the part, or None.

    Checks are performed in this order:
      1. existing_sku exact (case-insensitive) – honour already-populated skus
      2. part_id exact (case-insensitive)
      3. part_id normalized
      4. cleaned part_id exact (strip quantity suffixes)
      5. cleaned part_id normalized
    """
    # 1. Existing SKU already set – verify it's in the catalog
    if existing_sku:
        if existing_sku.lower() in exact_lower:
            return exact_lower[existing_sku.lower()]
        if normalize(existing_sku) in normalized:
            return normalized[normalize(existing_sku)]

    # 2–3. Full part_id
    if part_id.lower() in exact_lower:
        return exact_lower[part_id.lower()]
    if normalize(part_id) in normalized:
        return normalized[normalize(part_id)]

    # 4–5. Cleaned part_id (strip suffix annotations)
    cleaned = clean_part_id(part_id)
    if cleaned != part_id:
        if cleaned.lower() in exact_lower:
            return exact_lower[cleaned.lower()]
        if normalize(cleaned) in normalized:
            return normalized[normalize(cleaned)]

    return None


# ---------------------------------------------------------------------------
# JSON processing
# ---------------------------------------------------------------------------

def process_schematic(
    json_path: str,
    catalog: dict,
    exact_lower: dict,
    normalized: dict,
    dry_run: bool,
    verbose: bool,
) -> dict:
    """
    Process a single schematic_data.json file.
    Returns a stats dict: {total, matched, updated_sku, updated_name, updated_price}.
    """
    with open(json_path, encoding='utf-8') as fh:
        data = json.load(fh)

    parts = data.get('parts', [])
    stats = {'total': 0, 'matched': 0, 'updated_sku': 0,
             'updated_name': 0, 'updated_price': 0}
    changed = False

    for part in parts:
        stats['total'] += 1
        pid = part.get('id', '')
        existing_sku = part.get('sku', '')
        current_name = part.get('name', '')
        current_price = part.get('price', None)

        matched_sku = find_catalog_sku(pid, existing_sku, exact_lower, normalized)

        if matched_sku is None:
            if verbose:
                print(f'  [SKIP]   id={pid!r:30s} sku={existing_sku!r}')
            continue

        stats['matched'] += 1
        entry = catalog[matched_sku]
        updates: list[str] = []

        # --- sku ---
        if existing_sku != matched_sku:
            if not dry_run:
                part['sku'] = matched_sku
            stats['updated_sku'] += 1
            updates.append(f'sku: {existing_sku!r} → {matched_sku!r}')
            changed = True

        # --- name (only overwrite if it looks like a placeholder = name==id) ---
        if current_name == pid and entry['name'] and entry['name'] != current_name:
            if not dry_run:
                part['name'] = entry['name']
            stats['updated_name'] += 1
            updates.append(f'name: {current_name!r} → {entry["name"]!r}')
            changed = True

        # --- price ---
        catalog_price = entry['price']
        if catalog_price and current_price != catalog_price:
            if not dry_run:
                part['price'] = catalog_price
            stats['updated_price'] += 1
            updates.append(f'price: {current_price} → {catalog_price}')
            changed = True

        if verbose and updates:
            print(f'  [UPDATE] id={pid!r:30s} {"; ".join(updates)}')
        elif verbose:
            print(f'  [OK]     id={pid!r:30s} sku={matched_sku!r} (no changes needed)')

    if changed and not dry_run:
        with open(json_path, 'w', encoding='utf-8') as fh:
            json.dump(data, fh, indent=2, ensure_ascii=False)
            fh.write('\n')

    return stats


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main() -> None:
    parser = argparse.ArgumentParser(
        description='Sync schematic hotspot parts with WooCommerce catalog.'
    )
    parser.add_argument('--dry-run', action='store_true',
                        help='Print proposed changes without writing files.')
    parser.add_argument('--verbose', action='store_true',
                        help='Print every part processed.')
    args = parser.parse_args()

    repo_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    csv_path = os.path.join(repo_root, 'frontend', 'public', 'wp-catalog.csv')
    schematics_glob = os.path.join(
        repo_root, 'frontend', 'public', 'brands', '*',
        'Schematics', '**', 'schematic_data.json'
    )

    if not os.path.exists(csv_path):
        print(f'ERROR: Catalog CSV not found: {csv_path}', file=sys.stderr)
        sys.exit(1)

    # Load catalog
    print(f'Loading catalog: {csv_path}')
    catalog = load_catalog(csv_path)
    exact_lower, norm_idx = build_lookup_indices(catalog)
    print(f'  → {len(catalog)} catalog products loaded.')

    # Find all schematic JSON files
    json_files = sorted(glob.glob(schematics_glob, recursive=True))
    print(f'  → {len(json_files)} schematic_data.json files found.')
    if args.dry_run:
        print('  [DRY RUN] No files will be written.\n')
    else:
        print()

    # Process each file
    totals = {'total': 0, 'matched': 0, 'updated_sku': 0,
              'updated_name': 0, 'updated_price': 0}
    by_brand: dict[str, dict] = {}

    for json_path in json_files:
        brand = json_path.split(os.sep + 'brands' + os.sep)[1].split(os.sep)[0]
        rel = os.path.relpath(json_path, repo_root)

        if args.verbose:
            print(f'\n{rel}')

        stats = process_schematic(
            json_path, catalog, exact_lower, norm_idx,
            dry_run=args.dry_run, verbose=args.verbose
        )

        for k in totals:
            totals[k] += stats[k]
        if brand not in by_brand:
            by_brand[brand] = {'total': 0, 'matched': 0, 'updated_sku': 0,
                               'updated_name': 0, 'updated_price': 0}
        for k in by_brand[brand]:
            by_brand[brand][k] += stats[k]

    # Summary
    print('=' * 60)
    print('SUMMARY')
    print('=' * 60)
    header = f"{'Brand':<12} {'Parts':>6} {'Matched':>8} {'Sku':>6} {'Name':>6} {'Price':>6}"
    print(header)
    print('-' * 60)
    for brand in sorted(by_brand):
        s = by_brand[brand]
        pct = 100 * s['matched'] / s['total'] if s['total'] else 0
        print(f"{brand:<12} {s['total']:>6} {s['matched']:>7} ({pct:5.1f}%)"
              f" {s['updated_sku']:>6} {s['updated_name']:>6} {s['updated_price']:>6}")
    print('-' * 60)
    pct = 100 * totals['matched'] / totals['total'] if totals['total'] else 0
    print(f"{'TOTAL':<12} {totals['total']:>6} {totals['matched']:>7} ({pct:5.1f}%)"
          f" {totals['updated_sku']:>6} {totals['updated_name']:>6} {totals['updated_price']:>6}")
    print()
    print('Columns: Parts=total hotspot parts, Matched=catalog matches found,')
    print('         Sku/Name/Price=fields updated in JSON files.')
    if args.dry_run:
        print('\n[DRY RUN] No files were modified.')


if __name__ == '__main__':
    main()
