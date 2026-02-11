#!/usr/bin/env python3
"""
Merge researched prices from JSON into products_catalog.csv
"""

import csv
import json
import sys
from typing import Dict, List

def normalize_string(s: str) -> str:
    """Normalize string for comparison."""
    return s.strip().lower().replace('"', '').replace("'", "")

def load_researched_prices(json_path: str) -> List[Dict]:
    """Load researched prices from JSON file."""
    with open(json_path, 'r') as f:
        return json.load(f)

def merge_prices(catalog_path: str, researched_prices: List[Dict], output_path: str) -> tuple:
    """Merge researched prices into catalog."""
    
    # Create lookup dictionary for quick matching
    price_lookup = {}
    for item in researched_prices:
        if item.get('price_found', False):
            brand_norm = normalize_string(item.get('brand', ''))
            name_norm = normalize_string(item.get('name', ''))
            sku_norm = normalize_string(item.get('sku', ''))
            
            # Store by multiple keys for better matching
            keys = [
                (brand_norm, name_norm),
                (brand_norm, sku_norm) if sku_norm else None,
                (brand_norm, name_norm, sku_norm) if sku_norm else None
            ]
            
            for key in keys:
                if key:
                    price_lookup[key] = {
                        'price': item.get('price', ''),
                        'price_numeric': item.get('price_numeric', ''),
                        'source': item.get('source', ''),
                        'original': item
                    }
    
    print(f"Loaded {len(researched_prices)} researched prices")
    print(f"Created {len(price_lookup)} lookup keys")
    
    # Read catalog and update prices
    updated_rows = []
    update_count = 0
    match_details = []
    
    with open(catalog_path, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        fieldnames = reader.fieldnames
        
        for row in reader:
            brand = row.get('brand', '').strip()
            name = row.get('name', '').strip()
            sku = row.get('sku', '').strip()
            current_price = row.get('price_numeric', '').strip()
            
            # Check if price needs updating
            needs_update = not current_price or current_price == '0' or current_price == '0.00'
            
            if needs_update:
                # Try to find a match
                brand_norm = normalize_string(brand)
                name_norm = normalize_string(name)
                sku_norm = normalize_string(sku)
                
                # Try different matching strategies
                match_key = None
                if (brand_norm, name_norm, sku_norm) in price_lookup and sku_norm:
                    match_key = (brand_norm, name_norm, sku_norm)
                elif (brand_norm, name_norm) in price_lookup:
                    match_key = (brand_norm, name_norm)
                elif (brand_norm, sku_norm) in price_lookup and sku_norm:
                    match_key = (brand_norm, sku_norm)
                
                if match_key:
                    price_data = price_lookup[match_key]
                    row['price'] = price_data['price']
                    row['price_numeric'] = price_data['price_numeric']
                    update_count += 1
                    
                    match_details.append({
                        'brand': brand,
                        'name': name,
                        'sku': sku,
                        'price': price_data['price'],
                        'source': price_data['source']
                    })
                    
                    print(f"✓ Updated: {brand} - {name[:50]}... → {price_data['price']} (from {price_data['source']})")
            
            updated_rows.append(row)
    
    # Write updated catalog
    with open(output_path, 'w', encoding='utf-8', newline='') as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(updated_rows)
    
    return update_count, match_details

def main():
    """Main execution."""
    json_path = 'tmp/price_research_results.json'
    catalog_path = 'public/products_catalog.csv'
    output_path = 'public/products_catalog.csv'
    
    print("="*80)
    print("MERGING RESEARCHED PRICES INTO CATALOG")
    print("="*80)
    print()
    
    # Load researched prices
    researched_prices = load_researched_prices(json_path)
    print(f"Loaded {len(researched_prices)} researched prices")
    
    # Count how many have prices
    with_prices = sum(1 for p in researched_prices if p.get('price_found', False))
    print(f"Products with prices found: {with_prices}")
    print()
    
    # Merge prices
    update_count, match_details = merge_prices(catalog_path, researched_prices, output_path)
    
    print()
    print("="*80)
    print(f"✓ Successfully updated {update_count} products with new prices!")
    print("="*80)
    
    # Save match details
    with open('tmp/price_merge_details.json', 'w') as f:
        json.dump(match_details, f, indent=2)
    print(f"\nMatch details saved to tmp/price_merge_details.json")
    
    # Summary by source
    from collections import Counter
    sources = Counter(m['source'] for m in match_details)
    print("\nPrices by source:")
    for source, count in sources.most_common():
        print(f"  {source}: {count} products")

if __name__ == '__main__':
    main()
