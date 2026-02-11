#!/usr/bin/env python3
"""
Comprehensive price update - Apply all prices found through web research.
"""

import csv
import re
from typing import List, Dict, Tuple

# Comprehensive list of found prices from web research
COMPREHENSIVE_PRICES = [
    # Dura Stilts parts (confirmed)
    {"brand": "Dura Stilts", "patterns": ["Leg Strap", "Buckle"], "exclude": ["Arch", "Toe"], "price": "8.75", "source": "Timothy's Toolbox/DTD"},
    {"brand": "Dura Stilts", "patterns": ["Arch Strap"], "price": "8.34", "source": "Timothy's Toolbox/DTD"},
    {"brand": "Dura Stilts", "patterns": ["Toe Strap"], "exclude": ["Arch"], "price": "8.22", "source": "Timothy's Toolbox/DTD"},
    {"brand": "Dura Stilts", "patterns": ["Leg Band"], "price": "8.80", "source": "Timothy's Toolbox/DTD"},
    {"brand": "Dura Stilts", "patterns": ["Replacement Sole"], "price": "8.50", "source": "Timothy's Toolbox/DTD est"},
    
    # Norton Abrasives
    {"brand": "Norton", "patterns": ["120", "Grit", "Sanding Screen"], "price": "8.49", "source": "Timothy's Toolbox"},
    {"brand": "Norton", "patterns": ["80", "Grit", "Sanding Screen"], "price": "8.49", "source": "Timothy's Toolbox"},
    {"brand": "Norton", "patterns": ["100", "Grit", "Sanding Screen"], "price": "8.49", "source": "Timothy's Toolbox"},
    {"brand": "Norton", "patterns": ["150", "Grit", "Sanding Screen"], "price": "8.49", "source": "Timothy's Toolbox"},
    {"brand": "Norton", "patterns": ["220", "Grit", "Sanding Screen"], "price": "8.49", "source": "Timothy's Toolbox"},
    
    # Renegade Tools - Taping Knives
    {"brand": "Renegade", "patterns": ["6", "Blue Steel", "Taping Knife"], "exclude": ["8", "10", "12"], "price": "6.24", "source": "Timothy's Toolbox/DTD (avg)"},
    {"brand": "Renegade", "patterns": ["8", "Blue Steel", "Taping Knife"], "exclude": ["6", "10", "12"], "price": "7.49", "source": "Timothy's Toolbox/DTD (avg)"},
    {"brand": "Renegade", "patterns": ["10", "Blue Steel", "Taping Knife"], "exclude": ["6", "8", "12"], "price": "8.49", "source": "Timothy's Toolbox/DTD (avg)"},
    {"brand": "Renegade", "patterns": ["12", "Blue Steel", "Taping Knife"], "exclude": ["6", "8", "10"], "price": "9.24", "source": "Timothy's Toolbox/DTD (avg)"},
    {"brand": "Renegade", "patterns": ["Stainless", "Mud Pan", "13"], "price": "9.49", "source": "Timothy's Toolbox/DTD (avg)"},
    {"brand": "Renegade", "patterns": ["Drywall Rasp"], "price": "5.64", "source": "Timothy's Toolbox/DTD (avg)"},
    {"brand": "Renegade", "patterns": ["Putty Knife", "3"], "exclude": ["4", "5", "6"], "price": "3.99", "source": "Timothy's Toolbox/DTD"},
    {"brand": "Renegade", "patterns": ["Putty Knife", "4"], "exclude": ["3", "5", "6"], "price": "4.49", "source": "Timothy's Toolbox/DTD"},
    {"brand": "Renegade", "patterns": ["Putty Knife", "5"], "exclude": ["3", "4", "6"], "price": "4.99", "source": "Timothy's Toolbox/DTD"},
    {"brand": "Renegade", "patterns": ["Putty Knife", "6"], "exclude": ["3", "4", "5"], "price": "5.49", "source": "Timothy's Toolbox/DTD"},
    {"brand": "Renegade", "patterns": ["Poly Mud Pan"], "price": "3.24", "source": "Timothy's Toolbox/DTD (avg)"},
    {"brand": "Renegade", "patterns": ["Hand Sander"], "price": "7.50", "source": "Timothy's Toolbox/DTD"},
    
    # Full Circle
    {"brand": "Full Circle", "patterns": ["Level360", "Sanding Disc"], "price": "14.99", "source": "Timothy's Toolbox/DTD (avg)"},
    {"brand": "Full Circle", "patterns": ["Radius360", "Sanding Tool"], "exclude": ["Flex", "Pole"], "price": "28.49", "source": "Timothy's Toolbox/DTD (avg)"},
    {"brand": "Full Circle", "patterns": ["Radius360", "Flex Air"], "price": "39.99", "source": "Timothy's Toolbox/DTD"},
    {"brand": "Full Circle", "patterns": ["Pole Sander"], "price": "42.99", "source": "Timothy's Toolbox/DTD (avg)"},
    {"brand": "Full Circle", "patterns": ["Foam Pad"], "price": "14.99", "source": "Timothy's Toolbox/DTD (avg)"},
    
    # Nela Tools
    {"brand": "Nela Tools", "patterns": ["SuperFlex", "14"], "price": "56.49", "source": "Timothy's Toolbox/DTD/BIT (avg)"},
    {"brand": "Nela Tools", "patterns": ["SuperFlex", "16"], "price": "59.99", "source": "Timothy's Toolbox/DTD/BIT (avg)"},
    {"brand": "Nela Tools", "patterns": ["SuperFlex", "12"], "price": "54.99", "source": "Timothy's Toolbox/DTD/BIT (avg)"},
    {"brand": "Nela Tools", "patterns": ["Black Edition"], "price": "54.99", "source": "Timothy's Toolbox/DTD/BIT (avg)"},
    
    # Columbia Tools - Mud Pans
    {"brand": "Columbia", "patterns": ["12", "Mud Pan"], "exclude": ["14", "16"], "price": "25.15", "source": "Timothy's Toolbox/DTD/ATS (avg)"},
    {"brand": "Columbia", "patterns": ["14", "Mud Pan"], "exclude": ["12", "16"], "price": "26.99", "source": "Timothy's Toolbox/DTD est"},
    {"brand": "Columbia", "patterns": ["6", "Taping Knife"], "exclude": ["8", "10", "12"], "price": "22.00", "source": "Timothy's Toolbox/DTD est"},
    {"brand": "Columbia", "patterns": ["8", "Taping Knife"], "exclude": ["6", "10", "12"], "price": "24.00", "source": "Timothy's Toolbox/DTD est"},
    {"brand": "Columbia", "patterns": ["10", "Taping Knife"], "exclude": ["6", "8", "12"], "price": "25.00", "source": "Timothy's Toolbox/DTD est"},
    {"brand": "Columbia", "patterns": ["12", "Taping Knife"], "exclude": ["6", "8", "10"], "price": "26.00", "source": "Timothy's Toolbox/DTD est"},
    
    # Kraft Tools
    {"brand": "Kraft", "patterns": ["10", "Taping Knife"], "exclude": ["12", "14", "16"], "price": "16.00", "source": "Timothy's Toolbox/DTD"},
    {"brand": "Kraft", "patterns": ["12", "Taping Knife"], "exclude": ["10", "14", "16"], "price": "17.00", "source": "Timothy's Toolbox/DTD"},
    {"brand": "Kraft", "patterns": ["14", "Taping Knife"], "exclude": ["10", "12", "16"], "price": "19.00", "source": "Timothy's Toolbox/DTD"},
    {"brand": "Kraft", "patterns": ["Finishing Trowel", "12"], "exclude": ["10", "14", "16"], "price": "36.00", "source": "Timothy's Toolbox/DTD"},
    {"brand": "Kraft", "patterns": ["Finishing Trowel", "14"], "exclude": ["10", "12", "16"], "price": "38.00", "source": "Timothy's Toolbox/DTD"},
    {"brand": "Kraft", "patterns": ["Mud Pan"], "price": "14.00", "source": "Timothy's Toolbox/DTD est"},
    {"brand": "Kraft", "patterns": ["Hawk"], "price": "21.00", "source": "Timothy's Toolbox/DTD est"},
]

def match_product(product: Dict, price_entry: Dict) -> float:
    """Return a match score (0-100) for how well the product matches the price entry."""
    score = 0
    
    # Brand must match
    product_brand = product.get('brand', '').strip()
    if product_brand.lower() != price_entry['brand'].lower():
        return 0
    
    score += 40  # Brand match
    
    # Check all patterns must be present
    name = product.get('name', '').lower()
    desc = product.get('description_full', '').lower()
    combined_text = f"{name} {desc}"
    
    # All patterns must match
    patterns = price_entry.get('patterns', [])
    matched_patterns = 0
    for pattern in patterns:
        if pattern.lower() in combined_text:
            matched_patterns += 1
    
    if matched_patterns == 0:
        return 0
    
    # Score based on pattern matches
    pattern_score = (matched_patterns / len(patterns)) * 50
    score += pattern_score
    
    # Check exclude patterns - if any match, disqualify
    exclude_patterns = price_entry.get('exclude', [])
    for exclude in exclude_patterns:
        if exclude.lower() in combined_text:
            return 0
    
    # Bonus for exact matches
    if matched_patterns == len(patterns) and pattern_score >= 45:
        score += 10
    
    return score

def load_all_products(csv_path: str) -> Tuple[List[Dict], List[str]]:
    """Load all products from CSV."""
    with open(csv_path, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        fieldnames = list(reader.fieldnames)
        products = list(reader)
    return products, fieldnames

def apply_comprehensive_prices(csv_path: str, price_list: List[Dict], min_score: float = 60):
    """Apply all found prices to the catalog."""
    
    # Load products
    all_products, fieldnames = load_all_products(csv_path)
    
    print(f"\n{'='*70}")
    print(f"COMPREHENSIVE PRICE UPDATE")
    print(f"{'='*70}\n")
    print(f"Total products: {len(all_products)}")
    print(f"Price entries to apply: {len(price_list)}\n")
    
    # Track updates
    updates = []
    update_count = 0
    
    # For each price entry, find and update matching products
    for i, price_entry in enumerate(price_list, 1):
        brand = price_entry['brand']
        patterns_str = ', '.join(price_entry['patterns'][:3])
        price = price_entry['price']
        
        print(f"[{i}/{len(price_list)}] {brand} - {patterns_str}: ${price}")
        
        matches = []
        for j, product in enumerate(all_products):
            # Skip products that already have prices
            existing_price = product.get('price_numeric', '').strip()
            if existing_price and existing_price != '0' and existing_price != '0.00':
                continue
            
            score = match_product(product, price_entry)
            if score >= min_score:
                matches.append((j, product, score))
        
        if matches:
            # Sort by score
            matches.sort(key=lambda x: x[2], reverse=True)
            
            print(f"  Found {len(matches)} matches:")
            for idx, product, score in matches[:10]:  # Show top 10
                name = product.get('name', '')[:60]
                print(f"    [{score:.0f}%] {name}")
                
                # Update the product
                all_products[idx]['price'] = f"${price}"
                all_products[idx]['price_numeric'] = price
                update_count += 1
                
                updates.append({
                    'brand': brand,
                    'name': name,
                    'price': price,
                    'source': price_entry['source']
                })
        else:
            print(f"  No matches found")
        
        print()
    
    # Write updated catalog
    if update_count > 0:
        with open(csv_path, 'w', encoding='utf-8', newline='') as f:
            writer = csv.DictWriter(f, fieldnames=fieldnames)
            writer.writeheader()
            writer.writerows(all_products)
        
        print(f"{'='*70}")
        print(f"✓ Successfully updated {update_count} products in catalog")
        print(f"{'='*70}\n")
    else:
        print("⚠ No products were updated\n")
    
    return updates

def main():
    catalog_path = 'public/products_catalog.csv'
    
    updates = apply_comprehensive_prices(catalog_path, COMPREHENSIVE_PRICES, min_score=60)
    
    if updates:
        print("\n" + "="*70)
        print("UPDATE SUMMARY")
        print("="*70)
        
        # Group by brand
        by_brand = {}
        for update in updates:
            brand = update['brand']
            if brand not in by_brand:
                by_brand[brand] = []
            by_brand[brand].append(update)
        
        for brand, items in sorted(by_brand.items()):
            print(f"\n{brand}: {len(items)} products updated")
            for item in items[:5]:  # Show first 5 per brand
                print(f"  • {item['name']}: ${item['price']}")
            if len(items) > 5:
                print(f"  ... and {len(items) - 5} more")

if __name__ == '__main__':
    main()
