#!/usr/bin/env python3
"""
Web search-based price research for drywall products.
Uses intelligent web search to find prices from preferred industry sources.
"""

import csv
import json
import sys
import time
from typing import Dict, List, Optional, Tuple

# Preferred sources in priority order
PREFERRED_SOURCES = [
    "timothystoolbox.com",
    "drywalltooldepot.com",
    "betterinnovativetool.com",
    "alstapingtools.com",
    "csrbuilding.com"
]

# Excluded sources
EXCLUDED_SOURCES = ["tswfast.com"]

class SearchBasedPriceResearcher:
    def __init__(self):
        self.found_count = 0
        self.search_count = 0
        self.results = []
        
    def create_search_query(self, product: Dict) -> str:
        """Create an effective search query for the product."""
        parts = []
        
        # Add brand
        if product.get('brand'):
            parts.append(product['brand'])
        
        # Add product name (cleaned)
        if product.get('name'):
            name = product['name'].replace('"', '').replace(',', '').strip()
            # Take first 50 chars to keep query reasonable
            if len(name) > 50:
                name = name[:50]
            parts.append(name)
        
        # Add SKU if available
        if product.get('sku'):
            parts.append(product['sku'])
        
        # Add preferred source domain to focus search
        query = ' '.join(parts)
        query += f" site:{PREFERRED_SOURCES[0]}"  # Start with top priority source
        
        return query
    
    def search_with_web_search_tool(self, product: Dict, source_index: int = 0) -> Optional[Tuple[str, str, str]]:
        """
        Search for product price using the web_search tool.
        Returns (price, source, search_result) if found, None otherwise.
        """
        if source_index >= len(PREFERRED_SOURCES):
            return None
        
        source_domain = PREFERRED_SOURCES[source_index]
        
        # Build search query
        parts = []
        if product.get('brand'):
            parts.append(product['brand'])
        if product.get('name'):
            name = product['name'].replace('"', '').strip()[:60]
            parts.append(name)
        
        query = f"{' '.join(parts)} price site:{source_domain}"
        
        print(f"  [Manual] Search needed: {query}")
        print(f"  Please use web_search tool with this query and provide the price.")
        return None
    
    def process_products(self, products: List[Dict], limit: int = 100) -> List[Dict]:
        """Process products and collect those needing manual search."""
        search_needed = []
        
        print(f"\n{'='*70}")
        print(f"PREPARING SEARCH QUERIES FOR {min(len(products), limit)} PRODUCTS")
        print(f"{'='*70}\n")
        
        for i, product in enumerate(products[:limit], 1):
            brand = product.get('brand', 'Unknown')
            name = product.get('name', 'Unknown')[:50]
            
            print(f"[{i}/{min(len(products), limit)}] {brand} - {name}")
            
            # Create search query for this product
            search_query = self.create_search_query(product)
            
            search_needed.append({
                'product': product,
                'search_query': search_query,
                'priority_sources': PREFERRED_SOURCES[:3]  # Top 3 sources
            })
        
        return search_needed

def load_products_without_prices(csv_path: str, limit: int = None) -> List[Dict]:
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

def save_search_plan(search_needed: List[Dict], output_path: str):
    """Save the search plan for manual execution."""
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(search_needed, f, indent=2)
    print(f"\n✓ Search plan saved to {output_path}")
    print(f"  {len(search_needed)} products need price research")

def main():
    catalog_path = 'public/products_catalog.csv'
    output_path = '/tmp/price_search_plan.json'
    
    print(f"\n{'='*70}")
    print(f"DRYWALL TOOLBOX - SEARCH-BASED PRICE RESEARCH")
    print(f"{'='*70}\n")
    
    # Load products without prices
    print("Loading products without prices...")
    products = load_products_without_prices(catalog_path, limit=120)
    print(f"Found {len(products)} products without prices\n")
    
    if not products:
        print("No products without prices found!")
        return
    
    # Initialize researcher
    researcher = SearchBasedPriceResearcher()
    
    # Process products and create search plan
    search_needed = researcher.process_products(products, limit=120)
    
    # Save search plan
    save_search_plan(search_needed, output_path)
    
    print(f"\n{'='*70}")
    print(f"NEXT STEPS:")
    print(f"{'='*70}")
    print("Use the web_search tool for each product to find prices.")
    print("The search queries are optimized for the preferred sources.")
    print(f"Search plan available at: {output_path}\n")

if __name__ == '__main__':
    main()
