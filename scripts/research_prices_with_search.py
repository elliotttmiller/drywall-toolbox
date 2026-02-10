#!/usr/bin/env python3
"""
Advanced price research tool using web search for drywall products.
This script processes products in batches and uses targeted searches.
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

class PriceResearcher:
    def __init__(self):
        self.found_count = 0
        self.searched_count = 0
        self.results = []
        
    def format_search_query(self, product: Dict) -> str:
        """Create an effective search query for a product."""
        parts = []
        
        # Add brand
        if product.get('brand'):
            parts.append(product['brand'])
        
        # Add product name (cleaned)
        if product.get('name'):
            name = product['name']
            # Remove quotes and extra spaces
            name = name.replace('"', '').replace(',', ' ')
            # Truncate very long names
            if len(name) > 60:
                name = name[:60]
            parts.append(name)
        
        # Add SKU if available
        if product.get('sku'):
            parts.append(product['sku'])
        
        return ' '.join(parts)
    
    def extract_price_from_text(self, text: str) -> Optional[float]:
        """Extract price from text using various patterns."""
        import re
        
        # Look for common price patterns
        patterns = [
            r'\$(\d+\.\d{2})',
            r'USD\s*(\d+\.\d{2})',
            r'Price:\s*\$?(\d+\.\d{2})',
            r'(\d+\.\d{2})\s*each',
        ]
        
        prices = []
        for pattern in patterns:
            matches = re.findall(pattern, text, re.IGNORECASE)
            for match in matches:
                try:
                    price = float(match)
                    # Filter reasonable prices (between $0.50 and $5000)
                    if 0.50 < price < 5000:
                        prices.append(price)
                except:
                    continue
        
        # Return most common/lowest price if found
        if prices:
            return min(prices)
        return None
    
    def search_product(self, product: Dict, search_tool) -> Optional[Tuple[float, str]]:
        """Search for product pricing using web search."""
        self.searched_count += 1
        
        query = self.format_search_query(product)
        
        # Try each preferred source
        for source in PREFERRED_SOURCES:
            try:
                # Create site-specific search
                search_query = f"{query} site:{source} price"
                
                print(f"  Searching {source} for: {query[:50]}...")
                
                # Call web search (this would be replaced with actual web_search tool call)
                # For now, we'll mark as a placeholder
                result_text = search_tool(search_query)
                
                if result_text:
                    price = self.extract_price_from_text(result_text)
                    if price:
                        print(f"  ✓ Found ${price:.2f} from {source}")
                        self.found_count += 1
                        return (price, source)
                
                time.sleep(0.5)  # Rate limiting
                
            except Exception as e:
                print(f"  Error searching {source}: {e}")
                continue
        
        print(f"  ✗ No price found")
        return None
    
    def save_results(self, output_path: str):
        """Save research results to JSON."""
        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump({
                'total_searched': self.searched_count,
                'prices_found': self.found_count,
                'success_rate': f"{(self.found_count/self.searched_count*100):.1f}%",
                'results': self.results
            }, f, indent=2)
        print(f"\n✓ Results saved to {output_path}")

def load_products_without_prices(csv_path: str, limit: int = 150) -> List[Dict]:
    """Load products that don't have pricing."""
    products = []
    
    with open(csv_path, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            price = row.get('price', '').strip()
            price_numeric = row.get('price_numeric', '').strip()
            
            has_price = (price and price != '0' and price != '0.00') or \
                       (price_numeric and price_numeric != '0' and price_numeric != '0.00')
            
            if not has_price:
                products.append(row)
                if limit and len(products) >= limit:
                    break
    
    return products

def update_catalog_with_prices(csv_path: str, price_results: List[Dict]):
    """Update the catalog CSV with found prices."""
    # Read all products
    all_products = []
    with open(csv_path, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        fieldnames = reader.fieldnames
        all_products = list(reader)
    
    # Create lookup
    price_lookup = {}
    for result in price_results:
        # Use multiple keys for matching
        keys = []
        if result.get('sku'):
            keys.append(result['sku'])
        if result.get('name'):
            keys.append(result['name'])
        
        for key in keys:
            if key:
                price_lookup[key] = result
    
    # Update products
    updated_count = 0
    for product in all_products:
        # Try matching by SKU first, then by name
        key = product.get('sku') or product.get('name')
        if key in price_lookup:
            product['price'] = price_lookup[key]['price']
            product['price_numeric'] = price_lookup[key]['price_numeric']
            updated_count += 1
    
    # Write back
    with open(csv_path, 'w', encoding='utf-8', newline='') as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(all_products)
    
    print(f"✓ Updated {updated_count} products in catalog")

def main():
    print("This script requires the web_search tool integration.")
    print("It should be called from the agent context with web_search available.")
    print("\nFor standalone use, this is a reference implementation.")

if __name__ == '__main__':
    main()
