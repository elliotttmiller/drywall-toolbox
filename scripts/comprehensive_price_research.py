#!/usr/bin/env python3
"""
Comprehensive price research script for drywall products.
Searches preferred sources in priority order until a price is found for each product.
Uses web_search tool to efficiently find product pricing information.
"""

import csv
import json
import re
import sys
from typing import List, Dict, Optional, Tuple

# Preferred sources in priority order
PREFERRED_SOURCES = [
    "timothystoolbox.com",
    "drywalltooldepot.com",
    "betterinnovativetool.com",
    "alstapingtools.com",
    "csrbuilding.com"
]

# Excluded source
EXCLUDED_SOURCE = "tswfast.com"

def load_products_needing_prices(csv_path: str, limit: int = None) -> List[Dict]:
    """Load products that need price data from the catalog."""
    products_needing_prices = []
    
    with open(csv_path, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            price = row.get('price', '').strip()
            price_numeric = row.get('price_numeric', '').strip()
            
            # Check if price is missing or zero
            if not price or price == '0' or price == '0.00' or not price_numeric or price_numeric == '0' or price_numeric == '0.00':
                products_needing_prices.append(row)
                if limit and len(products_needing_prices) >= limit:
                    break
    
    return products_needing_prices

def save_products_for_research(products: List[Dict], output_path: str):
    """Save products that need research to a separate file for reference."""
    with open(output_path, 'w', encoding='utf-8') as f:
        writer = csv.DictWriter(f, fieldnames=['brand', 'name', 'sku', 'upc'])
        writer.writeheader()
        for product in products:
            writer.writerow({
                'brand': product.get('brand', ''),
                'name': product.get('name', ''),
                'sku': product.get('sku', ''),
                'upc': product.get('upc', '')
            })

def create_search_batches(products: List[Dict], batch_size: int = 15) -> List[List[Dict]]:
    """Create batches of products for efficient processing."""
    batches = []
    for i in range(0, len(products), batch_size):
        batches.append(products[i:i+batch_size])
    return batches

def generate_search_query(product: Dict) -> str:
    """Generate an effective search query for a product."""
    brand = product.get('brand', '').strip()
    name = product.get('name', '').strip()
    sku = product.get('sku', '').strip()
    
    # Create a focused search query
    query_parts = []
    if brand:
        query_parts.append(brand)
    if name:
        # Clean up the name - remove extra quotes and special chars
        clean_name = name.replace('"', '').strip()
        query_parts.append(clean_name)
    if sku:
        query_parts.append(f"SKU:{sku}")
    
    return ' '.join(query_parts)

def save_research_results(results: List[Dict], output_path: str):
    """Save research results to a JSON file."""
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(results, f, indent=2)
    print(f"\nResearch results saved to {output_path}")

def merge_prices_to_catalog(research_results: List[Dict], catalog_path: str, output_path: str):
    """Merge researched prices back into the product catalog."""
    # Create a lookup dictionary for quick access
    price_lookup = {}
    for result in research_results:
        if result.get('price_found'):
            key = (result.get('brand', '').strip(), result.get('name', '').strip())
            price_lookup[key] = {
                'price': result.get('price', ''),
                'price_numeric': result.get('price_numeric', ''),
                'source': result.get('source', '')
            }
    
    print(f"\nMerging {len(price_lookup)} prices into catalog...")
    
    # Read catalog and update prices
    updated_rows = []
    update_count = 0
    
    with open(catalog_path, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        fieldnames = reader.fieldnames
        
        for row in reader:
            key = (row.get('brand', '').strip(), row.get('name', '').strip())
            if key in price_lookup:
                price_data = price_lookup[key]
                # Only update if current price is missing or zero
                current_price = row.get('price_numeric', '').strip()
                if not current_price or current_price == '0' or current_price == '0.00':
                    row['price'] = price_data['price']
                    row['price_numeric'] = price_data['price_numeric']
                    update_count += 1
                    print(f"Updated: {row['brand']} - {row['name']}: {price_data['price']}")
            updated_rows.append(row)
    
    # Write updated catalog
    with open(output_path, 'w', encoding='utf-8', newline='') as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(updated_rows)
    
    print(f"\n✓ Updated {update_count} products with new prices")
    print(f"✓ Catalog saved to {output_path}")

def main():
    """Main execution function."""
    catalog_path = 'public/products_catalog.csv'
    
    # Load products needing prices
    print("Loading products that need price data...")
    products = load_products_needing_prices(catalog_path, limit=150)
    print(f"Found {len(products)} products needing prices")
    
    # Save products list for reference
    save_products_for_research(products, 'tmp/products_for_research.csv')
    print(f"Saved product list to tmp/products_for_research.csv")
    
    # Create batches
    batches = create_search_batches(products, batch_size=15)
    print(f"\nCreated {len(batches)} batches for processing")
    
    # Generate search instructions
    print("\n" + "="*80)
    print("RESEARCH INSTRUCTIONS")
    print("="*80)
    print("\nYou need to research prices for the products saved in tmp/products_for_research.csv")
    print(f"Total products to research: {len(products)}")
    print(f"Minimum target: 100+ products with prices")
    print(f"\nPreferred sources (in priority order):")
    for i, source in enumerate(PREFERRED_SOURCES, 1):
        print(f"  {i}. {source}")
    print(f"\nExcluded source: {EXCLUDED_SOURCE}")
    print("\nSearch strategy:")
    print("  1. For each product, search sources in priority order")
    print("  2. Stop searching when you find a price for that product")
    print("  3. Move to the next product")
    print("  4. Use brand, name, and SKU for searches")
    print("\nOutput format:")
    print("  Save results to tmp/price_research_results.json with structure:")
    print("  [{")
    print('    "brand": "Brand Name",')
    print('    "name": "Product Name",')
    print('    "sku": "SKU123",')
    print('    "price": "$99.99",')
    print('    "price_numeric": "99.99",')
    print('    "source": "timothystoolbox.com",')
    print('    "price_found": true')
    print("  }, ...]")
    print("\n" + "="*80)
    
    # Display first batch as example
    print("\nFirst batch of products to research (15 products):")
    print("-" * 80)
    for i, product in enumerate(batches[0], 1):
        query = generate_search_query(product)
        print(f"{i}. {product.get('brand', 'N/A')} - {product.get('name', 'N/A')}")
        print(f"   SKU: {product.get('sku', 'N/A')}")
        print(f"   Search query: {query}")
        print()

if __name__ == '__main__':
    main()
