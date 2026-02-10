#!/usr/bin/env python3
"""
Apply selected medium confidence matches that are manually verified as correct.
"""

import csv
import json

# Manually verified medium confidence matches (by SKU or careful review)
VERIFIED_MATCHES = [
    # Hyde 9" Radial Sander - exact match
    {"sku": "HYD09977", "price": "$20.94", "price_numeric": "20.94"},
]

def apply_verified_matches(catalog_path: str):
    """Apply manually verified matches to catalog."""
    # Read all products
    all_products = []
    with open(catalog_path, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        fieldnames = reader.fieldnames
        all_products = list(reader)
    
    # Apply verified matches
    updated_count = 0
    for verified in VERIFIED_MATCHES:
        for product in all_products:
            if product.get('sku') == verified['sku']:
                # Check if it doesn't already have a price
                current_price = product.get('price', '').strip()
                current_price_numeric = product.get('price_numeric', '').strip()
                has_price = (current_price and current_price != '0' and current_price != '0.00') or \
                           (current_price_numeric and current_price_numeric != '0' and current_price_numeric != '0.00')
                
                if not has_price:
                    product['price'] = verified['price']
                    product['price_numeric'] = verified['price_numeric']
                    updated_count += 1
                    print(f"✓ Updated {product['brand']} - {product['name'][:50]} -> {verified['price']}")
                break
    
    # Write back
    with open(catalog_path, 'w', encoding='utf-8', newline='') as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(all_products)
    
    return updated_count

if __name__ == '__main__':
    catalog_path = 'public/products_catalog.csv'
    updated = apply_verified_matches(catalog_path)
    print(f"\n✓ Applied {updated} verified matches to catalog")
