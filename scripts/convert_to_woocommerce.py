#!/usr/bin/env python3
"""
Convert products_catalog.csv to WooCommerce-compatible CSV for direct import.
UTF-8 without BOM, standard WooCommerce CSV import format.
"""

import csv
import re
import sys
import warnings
from collections import Counter
from pathlib import Path

import markdown

# Paths relative to this script so it works from any working directory.
_REPO_ROOT = Path(__file__).resolve().parent.parent
SOURCE = _REPO_ROOT / 'public' / 'products_catalog.csv'
OUTPUT = _REPO_ROOT / 'public' / 'woocommerce_products_import.csv'

# ──────────────────────────────────────────────────────────────────────────────
# Helper: convert $1,234.56 → 1234.56  (returns '' if no numeric data)
# ──────────────────────────────────────────────────────────────────────────────
def clean_price(price_raw, price_numeric_raw):
    if price_numeric_raw and price_numeric_raw.strip():
        try:
            return f"{float(price_numeric_raw.strip()):.2f}"
        except ValueError:
            pass
    if price_raw and price_raw.strip():
        cleaned = re.sub(r'[^\d.]', '', price_raw.replace(',', ''))
        try:
            return f"{float(cleaned):.2f}"
        except ValueError:
            pass
    return ''

# ──────────────────────────────────────────────────────────────────────────────
# Helper: convert comma-separated image URLs → pipe-separated
# ──────────────────────────────────────────────────────────────────────────────
def clean_images(images_raw):
    if not images_raw or not images_raw.strip():
        return ''
    parts = re.split(r',(?=https?://)', images_raw.strip())
    return '|'.join(p.strip() for p in parts if p.strip())

# ──────────────────────────────────────────────────────────────────────────────
# Helper: convert Markdown description → HTML
# ──────────────────────────────────────────────────────────────────────────────
def md_to_html(text):
    if not text or not text.strip():
        return ''
    try:
        return markdown.markdown(text, extensions=['nl2br']).strip()
    except Exception:
        return text.strip()

# ──────────────────────────────────────────────────────────────────────────────
# Category assignment  (priority order matters: most-specific first)
# ──────────────────────────────────────────────────────────────────────────────
def get_product_type_category(brand, name):
    """Return WooCommerce category string. Hierarchy: Top Level > Brand > Product Type."""
    n = name.lower()

    # ── Graco ──────────────────────────────────────────────────────────────
    if brand == 'Graco':
        if any(k in n for k in ['rtx', 'quickshot', 'ultra quickshot', 'cm20',
                                  'toughtek', 'air atomizer', 'external compressor']):
            ptype = 'Texture Sprayers'
        elif any(k in n for k in ['disk tip', 'nozzle', 'spray tip', 'spray texture',
                                    'disk spray']):
            ptype = 'Spray Tips & Nozzles'
        elif any(k in n for k in ['hose', 'coupler', 'adapter', 'swivel', 'cam-lok']):
            ptype = 'Hoses & Fittings'
        elif any(k in n for k in ['pump', 'piston', 'seal', 'packing', 'o-ring',
                                    'repair kit', 'gun', 'proconnect', 'chromex',
                                    'taper gooseneck', 'replacement tire']):
            ptype = 'Pumps & Parts'
        elif any(k in n for k in ['sponge ball', 'clean out']):
            ptype = 'Cleaning Accessories'
        elif any(k in n for k in ['roller', 'jet roller']):
            ptype = 'Applicators & Rollers'
        else:
            ptype = 'Parts & Accessories'
        return f"Texture Tools > Graco > {ptype}"

    # ── SurPro ─────────────────────────────────────────────────────────────
    if brand == 'SurPro':
        if (re.search(r'\bstilt\b', n)
                and re.search(r'magnesium|aluminum|double.sided|single.sided|20.30|24.40|36.48', n)):
            ptype = 'Stilts'
        else:
            ptype = 'Stilt Accessories'
        return f"Stilts & Accessories > SurPro > {ptype}"

    # ── Drywall brands: TapeTech, Asgard, Columbia Taping Tools ───────────
    #
    # Priority 0 – Unambiguous bundles/sets (override all other keywords)
    if re.search(
            r'flat box combo|combo set|full set|jumbo set|warrior set|'
            r'full semi.+set|semi-automatic set|flusher set tool case|'
            r'semi-auto.+set|pro grade.+set|starter set|taping set|'
            r'commando.+kit|complete pro set|tactical set|finishing set',
            n):
        ptype = 'Tool Sets & Bundles'

    # Priority 1 – Repair Kits & Parts
    elif re.search(r'repair kit|\bcables?\b', n):
        ptype = 'Repair Kits & Parts'

    # Priority 2 – Explicit Handles (before corner and blade checks)
    elif re.search(
            r'extension handle|flat box handle|extendable flat box handle|'
            r'matrix.+handle|bent flat box handle|featherweight flat box handle|'
            r'closet monster|xtender finishing box handle|brakeless box handle|'
            r'support handle|fiberglass handle|one extendable handle|'
            r'extendable.+angle head handle|angle head handle',
            n):
        ptype = 'Handles & Extensions'

    # Priority 3 – Corner & Angle Tools (before handles and blades)
    elif any(k in n for k in [
            'angle head', 'corner roller', 'nail spotter', 'corner finisher',
            'corner flusher', 'corner applicator', 'corner bead',
            'inside corner', 'outside corner', 'outside 90', 'inside 90',
            'outside bullnose', 'corner cobra', 'flusher', 'applicator head',
            'angle box', 'l-trim', 'inside 90 degree', 'combo flusher',
            'direct drywall corner', 'standard drywall corner',
            'inside corner applicator', 'outside corner applicator',
            'outside corner bead', 'widetrack']):
        ptype = 'Corner & Angle Tools'

    # Priority 4 – Blades & Knives (before handles)
    elif any(k in n for k in [
            'tomahawk', 'sabre', 'smoothing blade', 'wipe down knife',
            'putty knife', 'putty knives', 'clipped joint', 'pointing joint knife',
            'flat applicator head', 'skimming', 'finishing knife']):
        ptype = 'Blades & Knives'

    # Priority 5 – Handles (explicit handle product names, after corner/blade checks)
    elif re.search(r'\bone handle\b', n) and 'corner roller' not in n:
        ptype = 'Handles & Extensions'

    # Priority 6 – Finishing Boxes (after handles so "flat box handle" won't match here)
    elif any(k in n for k in [
            'flat box', 'finishing box', 'fat boy', 'flat finisher box',
            'flat finishing box', 'hinged flat', 'inside track',
            'throttlebox', 'maxxbox', 'power assist']):
        ptype = 'Finishing Boxes'

    # Priority 7 – Automatic Tapers
    elif any(k in n for k in [
            'automatic taper', 'carbon fiber', 'predator taper',
            'semi-auto taper', 'semi auto taper', 'mini taper',
            'taper body', 'taper head', 'semi automatic',
            'full semi automatic']):
        ptype = 'Automatic Tapers'

    # Priority 8 – Mud Pans & Compound Tubes
    elif any(k in n for k in ['mud pan', 'mud tube', 'compound tube',
                                'mud head', 'mud applicator head']):
        ptype = 'Mud Pans & Compound Tubes'

    # Priority 9 – Pumps
    elif any(k in n for k in ['loading pump', 'pump', 'hot mud pump']):
        ptype = 'Pumps & Accessories'

    # Priority 10 – Small Parts & Accessories
    elif any(k in n for k in [
            'gooseneck', 'filler adapter', 'box filler', 'filler adaptor',
            'coarse thread', 'cover plate', 'cork seal', 'tomalock',
            'bazooka oil', 'aerosol', 'banjo', 'mud dog', 'cam-lock',
            'ball adapter', 'angle head ball', 'road case', 'tool case']):
        ptype = 'Parts & Accessories'

    # Priority 11 – Sanding
    elif any(k in n for k in ['pole sander', 'phantom']):
        ptype = 'Sanding Tools'

    # Priority 12 – General sets / bundles
    elif any(k in n for k in [
            'set', 'combo', 'bundle', 'kit', 'starter',
            'complete', 'pro grade', 'commando', 'warrior']):
        ptype = 'Tool Sets & Bundles'

    # Priority 13 – General Handle catch-all
    elif re.search(r'\bhandle\b', n):
        ptype = 'Handles & Extensions'

    else:
        ptype = 'Accessories'

    return f"Drywall Finishing Tools > {brand} > {ptype}"

# ──────────────────────────────────────────────────────────────────────────────
# Tags generation
# ──────────────────────────────────────────────────────────────────────────────
def get_tags(brand, name, sku):
    tags = [brand]
    n = name.lower()

    type_keywords = [
        ('automatic taper', 'automatic taper'),
        ('flat box', 'flat box'),
        ('finishing box', 'finishing box'),
        ('angle head', 'angle head'),
        ('corner roller', 'corner roller'),
        ('corner finisher', 'corner finisher'),
        ('corner flusher', 'corner flusher'),
        ('nail spotter', 'nail spotter'),
        ('putty knife', 'putty knife'),
        ('putty knives', 'putty knife'),
        ('joint knife', 'joint knife'),
        ('smoothing blade', 'smoothing blade'),
        ('tomahawk', 'tomahawk'),
        ('sabre', 'sabre blade'),
        ('finishing knife', 'finishing knife'),
        ('feather lite', 'feather lite'),
        ('mud pan', 'mud pan'),
        ('compound tube', 'compound tube'),
        ('mud tube', 'compound tube'),
        ('flat box handle', 'flat box handle'),
        ('extension handle', 'extension handle'),
        ('extendable', 'extendable'),
        ('loading pump', 'loading pump'),
        ('hot mud pump', 'hot mud pump'),
        ('gooseneck', 'gooseneck'),
        ('corner cobra', 'corner cobra'),
        ('fat boy', 'fat boy'),
        ('predator taper', 'predator taper'),
        ('carbon fiber', 'carbon fiber'),
        ('fiberglass', 'fiberglass'),
        ('magnesium', 'magnesium'),
        ('stilt', 'drywall stilts'),
        ('banjo', 'banjo'),
        ('texture', 'texture sprayer'),
        ('spray', 'airless spray'),
        ('hose', 'spray hose'),
        ('repair kit', 'repair kit'),
        ('easyroll', 'easyroll'),
        ('easyclean', 'easyclean'),
        ('brakeless', 'brakeless'),
        ('pole sander', 'pole sander'),
        ('inside corner', 'inside corner'),
        ('outside corner', 'outside corner'),
        ('flusher', 'corner flusher'),
        ('drywall', 'drywall'),
        ('bundle', 'bundle'),
        ('bazooka', 'bazooka'),
        ('throttlebox', 'throttlebox'),
        ('maxxbox', 'maxxbox'),
        ('phantom', 'phantom'),
        ('continuous flow', 'continuous flow'),
        ('taping tool', 'taping tool'),
        ('replacement', 'replacement part'),
        ('starter set', 'starter set'),
        ('tool set', 'tool set'),
        ('combo set', 'combo set'),
    ]

    added = set([brand.lower()])
    for keyword, tag in type_keywords:
        if keyword in n and tag not in added:
            tags.append(tag)
            added.add(tag)

    # Size tags
    for sz in re.findall(r'(\d+(?:\.\d+)?)"', name):
        tag = f'{sz}"'
        if tag not in added:
            tags.append(tag)
            added.add(tag)

    return ', '.join(tags)

# ──────────────────────────────────────────────────────────────────────────────
# WooCommerce CSV column headers
# ──────────────────────────────────────────────────────────────────────────────
WC_HEADERS = [
    'ID', 'Type', 'SKU', 'Name', 'Published', 'Is featured?',
    'Visibility in catalog', 'Short description', 'Description',
    'Date sale price starts', 'Date sale price ends',
    'Tax status', 'Tax class',
    'In stock?', 'Stock', 'Low stock amount',
    'Backorders allowed?', 'Sold individually?',
    'Weight (lbs)', 'Length (in)', 'Width (in)', 'Height (in)',
    'Allow customer reviews?', 'Purchase note',
    'Sale price', 'Regular price',
    'Categories', 'Tags', 'Shipping class',
    'Images',
    'Download limit', 'Download expiry days',
    'Parent', 'Grouped products', 'Upsells', 'Cross-sells',
    'External URL', 'Button text', 'Position',
    'Attribute 1 name', 'Attribute 1 value(s)', 'Attribute 1 visible', 'Attribute 1 global',
    'Attribute 1 default',
    'Meta: upc',
]

# ──────────────────────────────────────────────────────────────────────────────
# Main
# ──────────────────────────────────────────────────────────────────────────────
def convert():
    with open(SOURCE, 'r', encoding='utf-8-sig', errors='replace') as f:
        rows = list(csv.DictReader(f))

    print(f"Read {len(rows)} products from source.")

    output_rows = []
    seen_skus = {}

    for row in rows:
        brand = (row.get('brand') or '').strip()
        name  = (row.get('name') or '').strip()
        sku   = (row.get('sku') or '').strip()
        upc   = (row.get('upc') or '').strip()

        if not name:
            continue

        # Deduplicate SKUs and warn about collisions
        if sku:
            if sku in seen_skus:
                seen_skus[sku] += 1
                new_sku = f"{sku}-{seen_skus[sku]}"
                warnings.warn(
                    f"Duplicate SKU '{sku}' for '{name}' — renamed to '{new_sku}'",
                    stacklevel=2,
                )
                sku = new_sku
            else:
                seen_skus[sku] = 1

        output_rows.append({
            'ID': '',
            'Type': 'simple',
            'SKU': sku,
            'Name': name,
            'Published': '1',
            'Is featured?': '0',
            'Visibility in catalog': 'visible',
            'Short description': (row.get('description_short') or '').strip(),
            'Description': md_to_html(row.get('description_full') or ''),
            'Date sale price starts': '',
            'Date sale price ends': '',
            'Tax status': 'taxable',
            'Tax class': '',
            'In stock?': '1',
            'Stock': '',
            'Low stock amount': '',
            'Backorders allowed?': '0',
            'Sold individually?': '0',
            'Weight (lbs)': '',
            'Length (in)': '',
            'Width (in)': '',
            'Height (in)': '',
            'Allow customer reviews?': '1',
            'Purchase note': '',
            'Sale price': '',
            'Regular price': clean_price(row.get('price') or '', row.get('price_numeric') or ''),
            'Categories': get_product_type_category(brand, name),
            'Tags': get_tags(brand, name, sku),
            'Shipping class': '',
            'Images': clean_images(row.get('images') or ''),
            'Download limit': '',
            'Download expiry days': '',
            'Parent': '',
            'Grouped products': '',
            'Upsells': '',
            'Cross-sells': '',
            'External URL': '',
            'Button text': '',
            'Position': '0',
            'Attribute 1 name': 'Brand',
            'Attribute 1 value(s)': brand,
            'Attribute 1 visible': '1',
            'Attribute 1 global': '1',
            'Attribute 1 default': '',
            'Meta: upc': upc,
        })

    # Write UTF-8 without BOM
    with open(OUTPUT, 'w', newline='', encoding='utf-8') as f:
        writer = csv.DictWriter(f, fieldnames=WC_HEADERS, quoting=csv.QUOTE_MINIMAL)
        writer.writeheader()
        writer.writerows(output_rows)

    print(f"Wrote {len(output_rows)} products to {OUTPUT}")

    # Validation summary
    no_price = sum(1 for r in output_rows if not r['Regular price'])
    no_image = sum(1 for r in output_rows if not r['Images'])
    no_sku   = sum(1 for r in output_rows if not r['SKU'])
    print(f"\nValidation:")
    print(f"  Products with no price:  {no_price}")
    print(f"  Products with no image:  {no_image}")
    print(f"  Products with no SKU:    {no_sku}")

    # Category distribution
    cat_counts = Counter(r['Categories'] for r in output_rows)
    print(f"\nCategory distribution ({len(cat_counts)} unique categories):")
    for cat, count in sorted(cat_counts.items()):
        print(f"  {count:3d}  {cat}")

if __name__ == '__main__':
    convert()
