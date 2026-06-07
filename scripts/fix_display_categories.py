#!/usr/bin/env python3
"""
Fix inconsistent display_category_key values in the WooCommerce catalog CSV.

This script normalizes all display category keys to match the expected format
used by the frontend catalog filters.
"""

import csv
import sys
import shutil
from pathlib import Path

# Canonical display category mapping
# Maps various category names to their normalized slug
DISPLAY_CATEGORY_MAP = {
    # Corner Tools
    'corner tools': 'corner_tools',
    'corner tool': 'corner_tools',
    'corner finisher': 'corner_tools',
    'corner flusher': 'corner_tools',
    'angle head': 'corner_tools',
    'corner roller': 'corner_tools',
    'corner applicator': 'corner_tools',
    'inside corner tool': 'corner_tools',
    'outside corner tool': 'corner_tools',
    
    # Finishing Boxes
    'finishing boxes': 'finishing_boxes',
    'finishing box': 'finishing_boxes',
    'flat box': 'finishing_boxes',
    'flatbox': 'finishing_boxes',
    'drywall box': 'finishing_boxes',
    'drywall finishing box': 'finishing_boxes',
    'maxx box': 'finishing_boxes',
    'box': 'finishing_boxes',
    
    # Handles
    'handles & extensions': 'handles',
    'handles and extensions': 'handles',
    'handles': 'handles',
    'handle': 'handles',
    'box handle': 'handles',
    'extension handle': 'handles',
    'extension': 'handles',
    'extendable handle': 'handles',
    
    # Nail Spotters
    'nail spotters': 'nail_spotters',
    'nail spotter': 'nail_spotters',
    'nailspotter': 'nail_spotters',
    'nailspotters': 'nail_spotters',
    'spotter': 'nail_spotters',
    
    # Smoothing Blades
    'smoothing blades': 'smoothing_blades',
    'smoothing blade': 'smoothing_blades',
    'blade': 'smoothing_blades',
    'skimming blade': 'smoothing_blades',
    
    # Pumps
    'mud pans & pumps': 'pumps',
    'mud pans and pumps': 'pumps',
    'mud pans': 'pumps',
    'pump': 'pumps',
    'pumps': 'pumps',
    'loading pump': 'pumps',
    'mud pump': 'pumps',
    'compound pump': 'pumps',
    
    # Automatic Tapers
    'automatic taping tools': 'automatic_tapers',
    'automatic tapers': 'automatic_tapers',
    'automatic taper': 'automatic_tapers',
    'taper': 'automatic_tapers',
    'taping tool': 'automatic_tapers',
    'auto taper': 'automatic_tapers',
    
    # Semi Automatic Tapers
    'semi automatic tapers': 'semi_automatic_tapers',
    'semi-automatic taper': 'semi_automatic_tapers',
    'semi-automatic tapers': 'semi_automatic_tapers',
    
    # Toolsets
    'tool sets & kits': 'toolsets',
    'tool sets and kits': 'toolsets',
    'toolsets': 'toolsets',
    'tool set': 'toolsets',
    'kit': 'toolsets',
    'kits': 'toolsets',
    
    # Stilts
    'stilts': 'stilts',
    'stilt': 'stilts',
    'drywall stilt': 'stilts',
    'drywall stilts': 'stilts',
    
    # Accessories
    'accessories': 'accessories',
    'accessory': 'accessories',
    
    # Parts
    'parts': 'parts',
    'part': 'parts',
    'replacement part': 'parts',
    'replacement parts': 'parts',
    'repair part': 'parts',
    'repair parts': 'parts',
}

# Reverse map for existing underscore variants
UNDERSCORE_VARIANTS = {
    'automatic_taping_tools': 'automatic_tapers',
    'handles_and_extensions': 'handles',
    'mud_pans_and_pumps': 'pumps',
    'tool_sets_and_kits': 'toolsets',
    'semi_automatic_tapers': 'semi_automatic_tapers',  # already correct
}


def normalize_display_category_from_wc(wc_category):
    """Determine display category key from WooCommerce category path."""
    if not wc_category or not isinstance(wc_category, str):
        return ''
    
    wc_category = wc_category.strip()
    if not wc_category:
        return ''
    
    # Extract leaf category from hierarchy like "Drywall Finishing Tools > Brand > Category"
    parts = wc_category.split('>')
    if len(parts) >= 3:
        # Get the last part (actual category)
        leaf = parts[-1].strip().lower()
    else:
        leaf = wc_category.strip().lower()
    
    # Check if explicitly marked as parts
    if 'part' in leaf and 'parts' not in leaf:
        if any(word in leaf for word in ['replacement', 'repair', 'component']):
            return 'parts'
    
    # Look up in our mapping
    for pattern, normalized in DISPLAY_CATEGORY_MAP.items():
        if pattern == leaf or pattern in leaf:
            return normalized
    
    return ''


def normalize_existing_display_key(current_key):
    """Normalize an existing display_category_key value."""
    if not current_key or not isinstance(current_key, str):
        return ''
    
    current_key = current_key.strip().lower()
    if not current_key:
        return ''
    
    # Check if it's already a valid normalized key
    valid_keys = set(DISPLAY_CATEGORY_MAP.values())
    if current_key in valid_keys:
        return current_key
    
    # Check underscore variants
    if current_key in UNDERSCORE_VARIANTS:
        return UNDERSCORE_VARIANTS[current_key]
    
    # Try to match against our patterns
    for pattern, normalized in DISPLAY_CATEGORY_MAP.items():
        if pattern in current_key or current_key in pattern:
            return normalized
    
    return ''


def fix_display_categories(csv_path):
    """Fix all display_category_key values in the CSV."""
    csv_path = Path(csv_path)
    backup_path = csv_path.with_suffix('.csv.backup')
    
    # Create backup
    print(f"Creating backup: {backup_path}")
    shutil.copy2(csv_path, backup_path)
    
    # Read CSV
    with open(csv_path, 'r', encoding='utf-8', newline='') as f:
        reader = csv.reader(f)
        headers = next(reader)
        rows = list(reader)
    
    # Find column indexes
    try:
        type_idx = headers.index('Type')
        cat_idx = headers.index('Categories')
        display_idx = headers.index('Meta: _dtb_display_category_key')
        is_parts_idx = headers.index('Meta: _dtb_is_parts')
    except ValueError as e:
        print(f"Error: Required column not found: {e}")
        return False
    
    # Process rows
    fixed_count = 0
    for row in rows:
        if len(row) <= max(type_idx, cat_idx, display_idx, is_parts_idx):
            continue
        
        row_type = row[type_idx]
        if row_type not in ['simple', 'variable', 'variation']:
            continue
        
        # Check if marked as parts
        is_parts = row[is_parts_idx] == '1' if len(row) > is_parts_idx else False
        if is_parts:
            if row[display_idx] != 'parts':
                row[display_idx] = 'parts'
                fixed_count += 1
            continue
        
        wc_category = row[cat_idx]
        current_display = row[display_idx]
        
        # Try to normalize from WC category first
        suggested = normalize_display_category_from_wc(wc_category)
        
        # If that didn't work, try normalizing the existing key
        if not suggested and current_display:
            suggested = normalize_existing_display_key(current_display)
        
        # Update if we have a valid suggestion and it's different
        if suggested and suggested != current_display:
            row[display_idx] = suggested
            fixed_count += 1
    
    # Write updated CSV
    print(f"Writing updated CSV: {csv_path}")
    with open(csv_path, 'w', encoding='utf-8', newline='') as f:
        writer = csv.writer(f)
        writer.writerow(headers)
        writer.writerows(rows)
    
    print(f"Fixed {fixed_count} display category keys")
    return True


if __name__ == '__main__':
    csv_file = 'products/Production/catalogs/official/woocommerce_catalog_production.csv'
    
    if not Path(csv_file).exists():
        print(f"Error: CSV file not found: {csv_file}")
        sys.exit(1)
    
    print("Fixing display category keys in catalog CSV...")
    success = fix_display_categories(csv_file)
    
    if success:
        print("Done! Backup saved to: products/Production/catalogs/official/woocommerce_catalog_production.csv.backup")
    else:
        print("Failed to fix display categories")
        sys.exit(1)
