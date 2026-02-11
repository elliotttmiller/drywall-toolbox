#!/usr/bin/env python3
"""
Intelligent price finder - generates search queries and prepares batch
for manual web search tool execution.
"""

import csv
import json
from typing import Dict, List

PREFERRED_SOURCES = [
    "timothystoolbox.com",
    "drywalltooldepot.com", 
    "betterinnovativetool.com",
    "alstapingtools.com",
    "csrbuilding.com"
]

def load_products_without_prices(csv_path: str, limit: int = 120) -> List[Dict]:
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
                if limit and len(products) >= limit:
                    break
    
    return products

def create_search_queries(products: List[Dict], batch_size: int = 15) -> List[Dict]:
    """Create optimized search queries for products."""
    queries = []
    
    for i, product in enumerate(products):
        brand = product.get('brand', '').strip()
        name = product.get('name', '').strip()
        sku = product.get('sku', '').strip()
        
        # Create search query
        query_parts = []
        if brand:
            query_parts.append(brand)
        if name:
            # Clean and shorten name
            clean_name = name.replace('"', '').replace(',', '')
            if len(clean_name) > 60:
                clean_name = clean_name[:60]
            query_parts.append(clean_name)
        
        # Add "price" to query
        base_query = ' '.join(query_parts) + ' price'
        
        # Create queries for each preferred source
        source_queries = []
        for source in PREFERRED_SOURCES:
            source_queries.append(f"{base_query} site:{source}")
        
        queries.append({
            'index': i + 1,
            'brand': brand,
            'name': name[:60],
            'sku': sku,
            'base_query': base_query,
            'source_queries': source_queries,
            'product_data': product
        })
    
    return queries

def save_batch_data(queries: List[Dict], output_path: str):
    """Save batch data for processing."""
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(queries, f, indent=2)
    
    print(f"\n✓ Batch data saved to: {output_path}")
    print(f"  Total products: {len(queries)}")

def print_batch_summary(queries: List[Dict], batch_num: int, batch_size: int = 15):
    """Print a batch of queries for manual processing."""
    start_idx = (batch_num - 1) * batch_size
    end_idx = min(start_idx + batch_size, len(queries))
    batch = queries[start_idx:end_idx]
    
    print(f"\n{'='*70}")
    print(f"BATCH {batch_num} - Products {start_idx + 1} to {end_idx}")
    print(f"{'='*70}\n")
    
    for q in batch:
        print(f"[{q['index']}] {q['brand']} - {q['name']}")
        print(f"    Base Query: {q['base_query']}")
        print(f"    Priority Source: {q['source_queries'][0]}")
        print()

def main():
    catalog_path = 'public/products_catalog.csv'
    output_path = '/tmp/price_research_batch.json'
    
    print(f"\n{'='*70}")
    print(f"INTELLIGENT PRICE FINDER")
    print(f"{'='*70}\n")
    
    # Load products
    print("Loading products without prices...")
    products = load_products_without_prices(catalog_path, limit=120)
    print(f"Found {len(products)} products needing prices\n")
    
    # Create search queries
    print("Creating optimized search queries...")
    queries = create_search_queries(products)
    print(f"Generated {len(queries)} search queries\n")
    
    # Save batch data
    save_batch_data(queries, output_path)
    
    # Print first batch for immediate processing
    print_batch_summary(queries, 1, 15)
    
    print(f"{'='*70}")
    print("NEXT STEPS:")
    print(f"{'='*70}")
    print("Use the web_search tool with the queries above to find prices.")
    print("Process in batches of 10-15 products at a time.")
    print(f"Full batch data available at: {output_path}\n")

if __name__ == '__main__':
    main()
