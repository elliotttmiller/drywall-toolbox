#!/usr/bin/env python3
"""
Final comprehensive price update - ALL prices found through web research Session Feb 11, 2026
"""

import csv
from typing import List, Dict, Tuple

# FINAL comprehensive list - ALL prices found
FINAL_PRICES = [
    # Norton Abrasives - Sanding products
    {"brand": "Norton", "name_match": "120 Grit", "name_exclude": "", "price": "8.49", "source": "TTB/DTD"},
    {"brand": "Norton", "name_match": "80 Grit", "name_exclude": "", "price": "8.49", "source": "TTB/DTD"},
    {"brand": "Norton", "name_match": "100 Grit", "name_exclude": "", "price": "8.49", "source": "TTB/DTD"},
    {"brand": "Norton", "name_match": "150 Grit", "name_exclude": "", "price": "8.49", "source": "TTB/DTD"},
    {"brand": "Norton", "name_match": "220 Grit", "name_exclude": "", "price": "8.49", "source": "TTB/DTD"},
    {"brand": "Norton", "name_match": "180 Grit", "name_exclude": "", "price": "8.49", "source": "TTB/DTD"},
    
    # Renegade Tools - Most products
    {"brand": "Renegade", "name_match": "10", "name_has": "Taping Knife", "name_exclude": "12|14|6|8", "price": "8.49", "source": "TTB/DTD"},
    {"brand": "Renegade", "name_match": "12", "name_has": "Taping Knife|Stainless Steel", "name_exclude": "10|14|6|8", "price": "9.24", "source": "TTB/DTD"},
    
    # Full Circle Products
    {"brand": "Full Circle", "name_match": "Level360", "name_has": "Disc", "price": "14.99", "source": "TTB/DTD"},
    {"brand": "Full Circle", "name_match": "Radius360", "name_exclude": "Flex|Air|Pole", "price": "28.49", "source": "TTB/DTD"},
    {"brand": "Full Circle", "name_match": "Radius360", "name_has": "Flex Air", "price": "39.99", "source": "TTB/DTD"},
    {"brand": "Full Circle", "name_match": "Pole Sander", "name_exclude": "Disc", "price": "42.99", "source": "TTB/DTD"},
    {"brand": "Full Circle", "name_match": "Foam Pad", "price": "14.99", "source": "TTB/DTD"},
    
    # Nela Tools - Premium trowels
    {"brand": "Nela Tools", "name_match": "14", "name_has": "Trowel", "price": "56.49", "source": "TTB/DTD/BIT"},
    {"brand": "Nela Tools", "name_match": "16", "name_has": "Trowel", "price": "59.99", "source": "TTB/DTD/BIT"},
    {"brand": "Nela Tools", "name_match": "12", "name_has": "Trowel", "price": "54.99", "source": "TTB/DTD/BIT"},
    {"brand": "Nela Tools", "name_match": "Black Edition", "price": "54.99", "source": "TTB/DTD/BIT"},
    
    # Columbia Tools - Taping Knives (CONFIRMED PRICES)
    {"brand": "Columbia", "name_match": "6", "name_has": "Taping Knife", "name_exclude": "8|10|12", "price": "23.97", "source": "TTB/ATS"},
    {"brand": "Columbia", "name_match": "8", "name_has": "Taping Knife", "name_exclude": "6|10|12", "price": "25.97", "source": "TTB/ATS"},
    {"brand": "Columbia", "name_match": "10", "name_has": "Taping Knife", "name_exclude": "6|8|12", "price": "27.97", "source": "TTB/ATS"},
    {"brand": "Columbia", "name_match": "12", "name_has": "Taping Knife", "name_exclude": "6|8|10", "price": "29.97", "source": "TTB/ATS"},
    {"brand": "Columbia", "name_match": "Mud Pan", "name_has": "12", "price": "25.15", "source": "ATS"},
    
    # Kraft Tools
    {"brand": "Kraft", "name_match": "10", "name_has": "Taping Knife", "name_exclude": "12|14", "price": "16.00", "source": "TTB/DTD"},
    {"brand": "Kraft", "name_match": "12", "name_has": "Taping Knife", "name_exclude": "10|14", "price": "17.00", "source": "TTB/DTD"},
    {"brand": "Kraft", "name_match": "14", "name_has": "Taping Knife", "name_exclude": "10|12", "price": "19.00", "source": "TTB/DTD"},
    
    # Arrow Fastener
    {"brand": "Arrow Fastener", "name_match": "T50", "price": "25.00", "source": "TTB"},
    
    # Atlas/Showa Gloves
    {"brand": "Atlas Gloves", "name_match": "300", "price": "27.70", "source": "TTB/DTD (per dozen)"},
    {"brand": "Showa", "name_match": "Atlas 300", "price": "27.70", "source": "TTB/DTD (per dozen)"},
]

def smart_match(product: Dict, price_entry: Dict) -> bool:
    """Smart matching with multiple criteria"""
    # Brand must match
    product_brand = product.get('brand', '').strip().lower()
    entry_brand = price_entry['brand'].lower()
    if product_brand != entry_brand:
        return False
    
    name = product.get('name', '').lower()
    desc = product.get('description_full', '').lower()
    combined = f"{name} {desc}"
    
    # Check name_match
    if price_entry.get('name_match'):
        if price_entry['name_match'].lower() not in combined:
            return False
    
    # Check name_has (all keywords must be present)
    if price_entry.get('name_has'):
        keywords = price_entry['name_has'].split('|')
        if not any(kw.lower() in combined for kw in keywords):
            return False
    
    # Check name_exclude (none should be present)
    if price_entry.get('name_exclude'):
        exclude_words = price_entry['name_exclude'].split('|')
        for word in exclude_words:
            if word.lower() in combined:
                return False
    
    return True

def apply_final_prices(csv_path: str):
    """Apply all final prices"""
    # Load products
    with open(csv_path, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        fieldnames = list(reader.fieldnames)
        products = list(reader)
    
    print(f"\n{'='*70}")
    print(f"FINAL COMPREHENSIVE PRICE UPDATE - Session Feb 11, 2026")
    print(f"{'='*70}\n")
    print(f"Total products in catalog: {len(products)}")
    print(f"Price entries to apply: {len(FINAL_PRICES)}\n")
    
    updates = 0
    update_details = []
    
    for i, price_entry in enumerate(FINAL_PRICES, 1):
        brand = price_entry['brand']
        match_str = price_entry.get('name_match', '') or price_entry.get('name_has', '')
        price = price_entry['price']
        
        print(f"[{i}/{len(FINAL_PRICES)}] {brand} - {match_str}: ${price}")
        
        matches = 0
        for j, product in enumerate(products):
            # Skip if already has price
            existing_price = product.get('price_numeric', '').strip()
            if existing_price and existing_price != '0' and existing_price != '0.00':
                continue
            
            if smart_match(product, price_entry):
                products[j]['price'] = f"${price}"
                products[j]['price_numeric'] = price
                matches += 1
                updates += 1
                
                if matches <= 3:  # Show first 3 matches
                    name = product.get('name', '')[:60]
                    print(f"  ✓ {name}")
                    update_details.append({
                        'brand': brand,
                        'name': name,
                        'price': price,
                        'source': price_entry['source']
                    })
        
        if matches > 3:
            print(f"  ... and {matches - 3} more")
        elif matches == 0:
            print(f"  (no new matches)")
        
        print()
    
    # Write back
    with open(csv_path, 'w', encoding='utf-8', newline='') as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(products)
    
    print(f"{'='*70}")
    print(f"✓ COMPLETE: Updated {updates} products")
    print(f"{'='*70}\n")
    
    # Show summary
    if update_details:
        by_brand = {}
        for item in update_details:
            brand = item['brand']
            if brand not in by_brand:
                by_brand[brand] = []
            by_brand[brand].append(item)
        
        print("\nBrand Summary:")
        for brand, items in sorted(by_brand.items()):
            print(f"  {brand}: {len(items)} products")
    
    return updates

def main():
    catalog_path = 'public/products_catalog.csv'
    
    total_updates = apply_final_prices(catalog_path)
    
    # Count final status
    with open(catalog_path, 'r') as f:
        reader = csv.DictReader(f)
        with_price = sum(1 for row in reader if row.get('price_numeric', '').strip() and row['price_numeric'] not in ['0', '0.00'])
    
    with open(catalog_path, 'r') as f:
        reader = csv.DictReader(f)
        total = sum(1 for _ in reader)
    
    print(f"\n{'='*70}")
    print(f"FINAL STATUS")
    print(f"{'='*70}")
    print(f"Total products: {total}")
    print(f"Products with prices: {with_price} ({with_price/total*100:.1f}%)")
    print(f"Products added this session: {total_updates}")
    print(f"{'='*70}\n")

if __name__ == '__main__':
    main()
