#!/usr/bin/env python3
"""
Batch price scraper for drywall products from preferred industry sources.
Searches sources in priority order until a price is found for each product.
"""

import csv
import re
import time
import urllib.parse
import urllib.request
from typing import Optional, Dict, List, Tuple
import json
import sys

# Preferred sources in priority order
PREFERRED_SOURCES = [
    "https://timothystoolbox.com",
    "https://www.drywalltooldepot.com",
    "https://www.betterinnovativetool.com",
    "https://www.alstapingtools.com",
    "https://csrbuilding.com/en-us"
]

# Excluded sources
EXCLUDED_SOURCES = ["https://www.tswfast.com"]

# User agent to avoid bot detection
USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"

class PriceScraper:
    def __init__(self, batch_size=15):
        self.batch_size = batch_size
        self.found_count = 0
        self.search_count = 0
        
    def fetch_page(self, url: str, timeout: int = 15) -> Optional[str]:
        """Fetch a web page with proper headers."""
        try:
            req = urllib.request.Request(
                url,
                headers={
                    'User-Agent': USER_AGENT,
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                    'Accept-Language': 'en-US,en;q=0.5',
                    'Accept-Encoding': 'gzip, deflate',
                    'Connection': 'keep-alive',
                }
            )
            with urllib.request.urlopen(req, timeout=timeout) as response:
                content = response.read()
                # Handle gzip encoding
                if response.info().get('Content-Encoding') == 'gzip':
                    import gzip
                    content = gzip.decompress(content)
                return content.decode('utf-8', errors='ignore')
        except Exception as e:
            print(f"  Error fetching {url}: {e}")
            return None
    
    def extract_price_from_html(self, html: str) -> Optional[float]:
        """Extract price from HTML content using various patterns."""
        if not html:
            return None
        
        # Common price patterns
        price_patterns = [
            r'\$\s*(\d+\.\d{2})',  # $XX.XX
            r'price["\s:]+\$?(\d+\.\d{2})',  # price: $XX.XX or price="XX.XX"
            r'\"price\":\s*\"?\$?(\d+\.\d{2})\"?',  # JSON "price": "XX.XX"
            r'data-price["\s=]+\$?(\d+\.\d{2})',  # data-price="XX.XX"
            r'itemprop="price"[^>]*content="(\d+\.\d{2})"',  # Schema.org price
            r'<span[^>]*class="[^"]*price[^"]*"[^>]*>\$?(\d+\.\d{2})',  # price span
            r'<div[^>]*class="[^"]*price[^"]*"[^>]*>\$?(\d+\.\d{2})',  # price div
        ]
        
        prices = []
        for pattern in price_patterns:
            matches = re.findall(pattern, html, re.IGNORECASE)
            for match in matches:
                try:
                    price = float(match)
                    # Filter out unreasonable prices (too low or too high)
                    if 0.50 < price < 50000:
                        prices.append(price)
                except ValueError:
                    continue
        
        # Return the most common price if multiple found
        if prices:
            return min(prices)  # Return lowest reasonable price
        return None
    
    def search_timothys_toolbox(self, product: Dict) -> Optional[float]:
        """Search Timothy's Toolbox for product pricing."""
        base_url = "https://timothystoolbox.com"
        
        # Try searching by brand and product name
        search_terms = []
        if product['brand']:
            search_terms.append(product['brand'])
        if product['name']:
            # Clean product name for search
            name = product['name'].replace('"', ' ').replace(',', ' ')
            search_terms.append(name)
        if product['sku']:
            search_terms.append(product['sku'])
        
        search_query = ' '.join(search_terms)
        search_url = f"{base_url}/search?q={urllib.parse.quote(search_query)}"
        
        print(f"  Searching Timothy's Toolbox: {search_query[:60]}...")
        html = self.fetch_page(search_url)
        if html:
            price = self.extract_price_from_html(html)
            if price:
                print(f"  ✓ Found price: ${price:.2f}")
                return price
        
        return None
    
    def search_drywall_tool_depot(self, product: Dict) -> Optional[float]:
        """Search Drywall Tool Depot for product pricing."""
        base_url = "https://www.drywalltooldepot.com"
        
        search_terms = []
        if product['brand']:
            search_terms.append(product['brand'])
        if product['name']:
            name = product['name'].replace('"', ' ').replace(',', ' ')
            search_terms.append(name)
        
        search_query = ' '.join(search_terms)
        search_url = f"{base_url}/search?q={urllib.parse.quote(search_query)}"
        
        print(f"  Searching Drywall Tool Depot: {search_query[:60]}...")
        html = self.fetch_page(search_url)
        if html:
            price = self.extract_price_from_html(html)
            if price:
                print(f"  ✓ Found price: ${price:.2f}")
                return price
        
        return None
    
    def search_better_innovative_tool(self, product: Dict) -> Optional[float]:
        """Search Better Innovative Tool for product pricing."""
        base_url = "https://www.betterinnovativetool.com"
        
        search_terms = []
        if product['brand']:
            search_terms.append(product['brand'])
        if product['name']:
            name = product['name'].replace('"', ' ').replace(',', ' ')
            search_terms.append(name)
        
        search_query = ' '.join(search_terms)
        search_url = f"{base_url}/search?q={urllib.parse.quote(search_query)}"
        
        print(f"  Searching Better Innovative Tool: {search_query[:60]}...")
        html = self.fetch_page(search_url)
        if html:
            price = self.extract_price_from_html(html)
            if price:
                print(f"  ✓ Found price: ${price:.2f}")
                return price
        
        return None
    
    def search_als_taping_tools(self, product: Dict) -> Optional[float]:
        """Search Al's Taping Tools for product pricing."""
        base_url = "https://www.alstapingtools.com"
        
        search_terms = []
        if product['brand']:
            search_terms.append(product['brand'])
        if product['name']:
            name = product['name'].replace('"', ' ').replace(',', ' ')
            search_terms.append(name)
        
        search_query = ' '.join(search_terms)
        search_url = f"{base_url}/search?q={urllib.parse.quote(search_query)}"
        
        print(f"  Searching Al's Taping Tools: {search_query[:60]}...")
        html = self.fetch_page(search_url)
        if html:
            price = self.extract_price_from_html(html)
            if price:
                print(f"  ✓ Found price: ${price:.2f}")
                return price
        
        return None
    
    def search_csr_building(self, product: Dict) -> Optional[float]:
        """Search CSR Building for product pricing."""
        base_url = "https://csrbuilding.com/en-us"
        
        search_terms = []
        if product['brand']:
            search_terms.append(product['brand'])
        if product['name']:
            name = product['name'].replace('"', ' ').replace(',', ' ')
            search_terms.append(name)
        
        search_query = ' '.join(search_terms)
        search_url = f"{base_url}/search?q={urllib.parse.quote(search_query)}"
        
        print(f"  Searching CSR Building: {search_query[:60]}...")
        html = self.fetch_page(search_url)
        if html:
            price = self.extract_price_from_html(html)
            if price:
                print(f"  ✓ Found price: ${price:.2f}")
                return price
        
        return None
    
    def search_product(self, product: Dict) -> Optional[Tuple[float, str]]:
        """Search for a product across sources until price is found."""
        self.search_count += 1
        
        # Search each source in order until price found
        sources = [
            ("Timothy's Toolbox", self.search_timothys_toolbox),
            ("Drywall Tool Depot", self.search_drywall_tool_depot),
            ("Better Innovative Tool", self.search_better_innovative_tool),
            ("Al's Taping Tools", self.search_als_taping_tools),
            ("CSR Building", self.search_csr_building),
        ]
        
        for source_name, search_func in sources:
            try:
                price = search_func(product)
                if price:
                    self.found_count += 1
                    return (price, source_name)
                time.sleep(0.5)  # Small delay between source attempts
            except Exception as e:
                print(f"  Error searching {source_name}: {e}")
                continue
        
        return None
    
    def process_batch(self, products: List[Dict]) -> List[Dict]:
        """Process a batch of products and return those with found prices."""
        results = []
        
        print(f"\n{'='*70}")
        print(f"Processing batch of {len(products)} products...")
        print(f"{'='*70}\n")
        
        for i, product in enumerate(products, 1):
            print(f"[{i}/{len(products)}] {product['brand']} - {product['name'][:50]}...")
            
            result = self.search_product(product)
            if result:
                price, source = result
                product['price'] = f"${price:.2f}"
                product['price_numeric'] = f"{price:.2f}"
                product['price_source'] = source
                results.append(product)
                print(f"  ✓✓✓ SUCCESS: Found ${price:.2f} from {source}\n")
            else:
                print(f"  ✗ No price found in any source\n")
            
            # Small delay between products
            time.sleep(1)
        
        return results

def load_products_without_prices(csv_path: str, limit: int = None) -> List[Dict]:
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
    
    # Create a lookup for price results by SKU or name
    price_lookup = {}
    for result in price_results:
        key = result.get('sku') or result.get('name')
        if key:
            price_lookup[key] = result
    
    # Update products with found prices
    updated_count = 0
    for product in all_products:
        key = product.get('sku') or product.get('name')
        if key in price_lookup:
            product['price'] = price_lookup[key]['price']
            product['price_numeric'] = price_lookup[key]['price_numeric']
            updated_count += 1
    
    # Write back to CSV
    with open(csv_path, 'w', encoding='utf-8', newline='') as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(all_products)
    
    print(f"\n✓ Updated {updated_count} products in {csv_path}")

def main():
    catalog_path = 'public/products_catalog.csv'
    
    print(f"\n{'='*70}")
    print(f"DRYWALL TOOLBOX - BATCH PRICE SCRAPER")
    print(f"{'='*70}\n")
    
    # Load products without prices
    print("Loading products without prices...")
    products = load_products_without_prices(catalog_path, limit=150)
    print(f"Found {len(products)} products without prices\n")
    
    if not products:
        print("No products without prices found!")
        return
    
    # Initialize scraper
    scraper = PriceScraper(batch_size=15)
    all_results = []
    
    # Process in batches
    batch_size = 15
    for i in range(0, len(products), batch_size):
        batch = products[i:i+batch_size]
        results = scraper.process_batch(batch)
        all_results.extend(results)
        
        print(f"\nBatch complete: {len(results)}/{len(batch)} prices found")
        print(f"Total progress: {scraper.found_count} prices found from {scraper.search_count} searches")
        
        # Check if we've reached our goal
        if scraper.found_count >= 100:
            print(f"\n{'='*70}")
            print(f"✓✓✓ GOAL ACHIEVED: {scraper.found_count} prices found!")
            print(f"{'='*70}\n")
            break
        
        # Small delay between batches
        if i + batch_size < len(products):
            print("\nWaiting 3 seconds before next batch...\n")
            time.sleep(3)
    
    # Save results
    if all_results:
        print(f"\n{'='*70}")
        print(f"FINAL RESULTS")
        print(f"{'='*70}")
        print(f"Total searches: {scraper.search_count}")
        print(f"Prices found: {scraper.found_count}")
        print(f"Success rate: {(scraper.found_count/scraper.search_count*100):.1f}%")
        print(f"{'='*70}\n")
        
        # Update the catalog
        print("Updating catalog with found prices...")
        update_catalog_with_prices(catalog_path, all_results)
        
        # Save detailed results
        results_path = 'public/price_research_results.json'
        with open(results_path, 'w', encoding='utf-8') as f:
            json.dump(all_results, f, indent=2)
        print(f"✓ Detailed results saved to {results_path}\n")
    else:
        print("\nNo prices were found.")

if __name__ == '__main__':
    main()
