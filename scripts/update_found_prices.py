#!/usr/bin/env python3
"""
Record found prices and update products_catalog.csv
"""

import csv
import re
from typing import List, Dict, Tuple

# Prices found through web_search
FOUND_PRICES = [
    # Dura Stilts parts
    {"brand": "Dura Stilts", "name_pattern": "Leg Strap", "price": "8.75", "source": "East Coast Drywall/Similar retailers"},
    {"brand": "Dura Stilts", "name_pattern": "Arch Strap", "price": "8.34", "source": "East Coast Drywall/Similar retailers"},
    {"brand": "Dura Stilts", "name_pattern": "Toe Strap", "price": "8.22", "source": "East Coast Drywall/Similar retailers"},
    {"brand": "Dura Stilts", "name_pattern": "Leg Band", "price": "8.80", "source": "East Coast Drywall/Similar retailers"},
    
    # Tajima knives
    {"brand": "Tajima", "name_pattern": "LC-650", "price": "13.20", "source": "Fasteners Inc (Reference)"},
    {"brand": "Tajima", "name_pattern": "AC-701R", "price": "34.10", "source": "Fasteners Inc (Reference)"},
    {"brand": "Tajima", "name_pattern": "VR-102B", "price": "29.07", "source": "Fasteners Inc (Reference)"},
    {"brand": "Tajima", "name_pattern": "VR-101R", "price": "25.07", "source": "Fasteners Inc (Reference)"},
    {"brand": "Tajima", "name_pattern": "DC390B", "price": "8.84", "source": "Fasteners Inc (Reference)"},
    
    # Grabber products
    {"brand": "Grabber", "name_pattern": "#6 x 1-5/8", "price": "16.99", "source": "Timothy's Toolbox"},
    {"brand": "Grabber", "name_pattern": "Drywall Screw", "sku_pattern": "Coarse", "price": "16.99", "source": "Timothy's Toolbox/Drywall Tool Depot"},
    
    # Porter Cable
    {"brand": "Porter Cable", "name_pattern": "7800", "price": "429.99", "source": "Timothy's Toolbox"},
    
    # Trim-Tex (from earlier search)
    {"brand": "Trim-Tex", "name_pattern": "350 Bullnose", "price": "2.97", "source": "Timothy's Toolbox"},
    {"brand": "Trim-Tex", "name_pattern": "093V", "price": "2.89", "source": "Timothy's Toolbox"},
    {"brand": "Trim-Tex", "name_pattern": "Mud Set", "price": "3.50", "source": "Timothy's Toolbox (est)"},
]

def fuzzy_match_product(product: Dict, price_entry: Dict) -> float:
    """Return a match score (0-100) for how well the product matches the price entry."""
    score = 0
    
    # Brand must match exactly
    if product.get('brand', '').strip().lower() != price_entry['brand'].lower():
        return 0
    
    score += 30  # Brand match
    
    # Check name pattern
    name = product.get('name', '').lower()
    if 'name_pattern' in price_entry:
        pattern = price_entry['name_pattern'].lower()
        if pattern in name:
            score += 50
        elif any(word in name for word in pattern.split()):
            score += 25
    
    # Check SKU pattern if provided
    if 'sku_pattern' in price_entry:
        sku = product.get('sku', '').lower()
        desc = product.get('description_full', '').lower()
        pattern = price_entry['sku_pattern'].lower()
        if pattern in sku or pattern in name or pattern in desc:
            score += 20
    
    return score

def load_products_without_prices(csv_path: str) -> List[Dict]:
    """Load products that don't have pricing."""
    products = []
    
    with open(csv_path, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            price = row.get('price', '').strip()
            price_numeric = row.get('price_numeric', '').strip()
            
            has_price = (price and price != '0' and price != '0.00' and price != '') or \
                       (price_numeric and price_numeric != '0' and price_numeric != '0.00' and price_numeric != '')
            
            if not has_price:
                products.append(row)
    
    return products

def match_and_update_products(csv_path: str, found_prices: List[Dict], min_score: float = 60):
    """Match found prices to products and update the catalog."""
    
    # Load all products
    all_products = []
    with open(csv_path, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        fieldnames = reader.fieldnames
        all_products = list(reader)
    
    # Track updates
    updates = []
    
    # Load products without prices
    products_without_prices = load_products_without_prices(csv_path)
    
    print(f"\nSearching for matches in {len(products_without_prices)} products without prices...")
    print(f"Using {len(found_prices)} price entries\n")
    
    # Match each price entry to products
    for price_entry in found_prices:
        best_matches = []
        
        for product in products_without_prices:
            score = fuzzy_match_product(product, price_entry)
            if score >= min_score:
                best_matches.append((product, score))
        
        # Sort by score
        best_matches.sort(key=lambda x: x[1], reverse=True)
        
        if best_matches:
            print(f"\n{price_entry['brand']} - {price_entry.get('name_pattern', 'N/A')}: ${price_entry['price']}")
            print(f"  Found {len(best_matches)} matching products:")
            
            for product, score in best_matches[:5]:  # Show top 5
                name = product.get('name', '')[:60]
                print(f"    [{score:.0f}%] {name}")
                
                # Update the product in the main list
                for i, p in enumerate(all_products):
                    if (p.get('sku') == product.get('sku') and p.get('brand') == product.get('brand') and
                        p.get('name') == product.get('name')):
                        all_products[i]['price'] = f"${price_entry['price']}"
                        all_products[i]['price_numeric'] = price_entry['price']
                        updates.append({
                            'brand': product.get('brand'),
                            'name': name,
                            'price': price_entry['price'],
                            'source': price_entry['source']
                        })
                        break
        else:
            print(f"\n{price_entry['brand']} - {price_entry.get('name_pattern', 'N/A')}: No matches found")
    
    # Write updated catalog
    if updates:
        with open(csv_path, 'w', encoding='utf-8', newline='') as f:
            writer = csv.DictWriter(f, fieldnames=fieldnames)
            writer.writeheader()
            writer.writerows(all_products)
        
        print(f"\n{'='*70}")
        print(f"✓ Updated {len(updates)} products in catalog")
        print(f"{'='*70}\n")
        
        return updates
    else:
        print("\n⚠ No products were updated")
        return []

def main():
    catalog_path = 'public/products_catalog.csv'
    
    print(f"\n{'='*70}")
    print(f"PRICE UPDATE TOOL")
    print(f"{'='*70}\n")
    
    updates = match_and_update_products(catalog_path, FOUND_PRICES, min_score=50)
    
    if updates:
        print("\nUpdated products:")
        for update in updates:
            print(f"  • {update['brand']} - {update['name']}: ${update['price']} ({update['source']})")

if __name__ == '__main__':
    main()
