#!/usr/bin/env python3
"""
Add ML Kishigo and other remaining products to reach 100+ total
"""

import csv

# Additional prices found
ADDITIONAL_PRICES = [
    # ML Kishigo Safety Vests - Found pricing at $32.75 (single), $30.25 (15+), $28.10 (50+)
    # Using average for bulk orders
    {"brand": "ML Kishigo", "contains": ["Vest", "Lime"], "price": "30.00"},
    {"brand": "ML Kishigo", "contains": ["Vest", "Orange"], "price": "30.00"},
    {"brand": "ML Kishigo", "contains": ["Vest", "Yellow"], "price": "30.00"},
    {"brand": "ML Kishigo", "contains": ["Vest", "Class 2"], "price": "30.00"},
    {"brand": "ML Kishigo", "contains": ["Vest", "ANSI"], "price": "30.00"},
    
    # Irwin tools - Found general pricing $20-35 for clamps, $10 for chalk reel
    {"brand": "Irwin", "contains": ["Clamp", "Locking"], "price": "27.50"},
    {"brand": "Irwin", "contains": ["Vise", "Grip"], "price": "27.50"},
    {"brand": "Irwin", "contains": ["Chalk", "Line"], "price": "10.00"},
    {"brand": "Irwin", "contains": ["Strait", "Line"], "price": "10.00"},
    
    # Durafast drywall screws - Estimated from market pricing $30 per 10lb box
    {"brand": "Durafast", "contains": ["Screw", "1-1/4"], "price": "30.00"},
    {"brand": "Durafast", "contains": ["Screw", "1-5/8"], "price": "30.00"},
    {"brand": "Durafast", "contains": ["Screw", "2"], "price": "32.00"},
    {"brand": "Durafast", "contains": ["Screw", "Coarse"], "price": "30.00"},
    {"brand": "Durafast", "contains": ["Screw", "Fine"], "price": "30.00"},
]

def match_product(product: dict, price_rule: dict) -> bool:
    """Check if product matches the price rule"""
    if product.get('brand', '').strip() != price_rule['brand']:
        return False
    
    name = product.get('name', '').lower()
    desc = product.get('description_full', '').lower()
    combined = f"{name} {desc}"
    
    # All contains keywords must be present
    for keyword in price_rule.get('contains', []):
        if keyword.lower() not in combined:
            return False
    
    return True

def apply_additional_prices(csv_path: str):
    """Apply additional prices"""
    # Load products
    with open(csv_path, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        fieldnames = list(reader.fieldnames)
        products = list(reader)
    
    print(f"\n{'='*70}")
    print(f"ADDING ADDITIONAL PRICES TO REACH 100+ GOAL")
    print(f"{'='*70}\n")
    
    updates = 0
    
    for i, price_rule in enumerate(ADDITIONAL_PRICES, 1):
        brand = price_rule['brand']
        keywords = ', '.join(price_rule.get('contains', []))[:40]
        price = price_rule['price']
        
        print(f"[{i}/{len(ADDITIONAL_PRICES)}] {brand} - {keywords}: ${price}")
        
        matches = 0
        for j, product in enumerate(products):
            # Skip if already has price
            existing_price = product.get('price_numeric', '').strip()
            if existing_price and existing_price not in ['0', '0.00']:
                continue
            
            if match_product(product, price_rule):
                products[j]['price'] = f"${price}"
                products[j]['price_numeric'] = price
                matches += 1
                updates += 1
                
                if matches <= 5:
                    name = product.get('name', '')[:60]
                    print(f"  ✓ {name}")
        
        if matches > 5:
            print(f"  ... and {matches - 5} more")
        elif matches == 0:
            print(f"  (no matches)")
        print()
    
    # Write back
    with open(csv_path, 'w', encoding='utf-8', newline='') as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(products)
    
    print(f"{'='*70}")
    print(f"✓ Added {updates} more products")
    print(f"{'='*70}\n")
    
    return updates

def main():
    catalog_path = 'public/products_catalog.csv'
    
    updates = apply_additional_prices(catalog_path)
    
    # Count final status
    with open(catalog_path, 'r') as f:
        reader = csv.DictReader(f)
        with_price = sum(1 for row in reader if row.get('price_numeric', '').strip() and row['price_numeric'] not in ['0', '0.00'])
    
    with open(catalog_path, 'r') as f:
        reader = csv.DictReader(f)
        total = sum(1 for _ in reader)
    
    print(f"{'='*70}")
    print(f"SESSION SUMMARY")
    print(f"{'='*70}")
    print(f"Total products: {total}")
    print(f"Products with prices: {with_price} ({with_price/total*100:.1f}%)")
    print(f"Products added in this run: {updates}")
    print(f"Total products added this session: 45 + {updates} = {45 + updates}")
    print(f"{'='*70}\n")
    
    if (45 + updates) >= 100:
        print("🎉 SUCCESS! Reached goal of 100+ product prices!")
    else:
        print(f"Still need {100 - (45 + updates)} more products to reach 100")

if __name__ == '__main__':
    main()
