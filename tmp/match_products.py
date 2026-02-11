#!/usr/bin/env python3
"""
Match researched products to catalog products using fuzzy matching.
"""
import json
import csv
import re
from difflib import SequenceMatcher

def normalize_text(text):
    """Normalize text for comparison."""
    if not text:
        return ""
    text = str(text).lower().strip()
    text = re.sub(r'[^\w\s]', ' ', text)
    text = re.sub(r'\s+', ' ', text)
    return text

def extract_size(text):
    """Extract size measurements like 10", 12", etc."""
    if not text:
        return []
    matches = re.findall(r'(\d+\.?\d*)\s*(?:inch|in|")', text.lower())
    return matches

def extract_model_numbers(text):
    """Extract potential model numbers."""
    if not text:
        return []
    matches = re.findall(r'\b[A-Z]{2,}\d+[A-Z]*\d*\b', text, re.IGNORECASE)
    return matches

def similarity_score(s1, s2):
    """Calculate similarity score between two strings."""
    return SequenceMatcher(None, s1, s2).ratio()

def match_by_sku(research_sku, catalog_sku):
    """Check if SKUs match."""
    if not research_sku or not catalog_sku:
        return False
    return normalize_text(research_sku) == normalize_text(catalog_sku)

def match_products(research_product, catalog_product):
    """
    Calculate match score between research product and catalog product.
    Returns (score, match_reason).
    """
    scores = []
    reasons = []
    
    # SKU exact match - highest priority
    if match_by_sku(research_product.get('sku'), catalog_product.get('sku')):
        return (1.0, 'SKU exact match')
    
    # Brand matching
    research_brand = normalize_text(research_product.get('brand', ''))
    catalog_brand = normalize_text(catalog_product.get('brand', ''))
    
    if research_brand and catalog_brand:
        brand_score = similarity_score(research_brand, catalog_brand)
        if brand_score < 0.7:  # Brands must match reasonably well
            return (0.0, 'Brand mismatch')
        scores.append(brand_score * 0.4)  # Brand weight 40%
        reasons.append(f'Brand: {brand_score:.2f}')
    else:
        return (0.0, 'Missing brand')
    
    # Name matching
    research_name = normalize_text(research_product.get('name', ''))
    catalog_name = normalize_text(catalog_product.get('name', ''))
    
    if research_name and catalog_name:
        name_score = similarity_score(research_name, catalog_name)
        scores.append(name_score * 0.6)  # Name weight 60%
        reasons.append(f'Name: {name_score:.2f}')
        
        # Bonus for size matching
        research_sizes = extract_size(research_product.get('name', ''))
        catalog_sizes = extract_size(catalog_product.get('name', ''))
        if research_sizes and catalog_sizes:
            if any(rs in catalog_sizes for rs in research_sizes):
                scores.append(0.1)  # Size match bonus
                reasons.append('Size match')
        
        # Bonus for model number matching
        research_models = extract_model_numbers(research_product.get('name', ''))
        catalog_models = extract_model_numbers(catalog_product.get('name', ''))
        if research_models and catalog_models:
            if any(rm.lower() in [cm.lower() for cm in catalog_models] for rm in research_models):
                scores.append(0.1)  # Model match bonus
                reasons.append('Model match')
    
    total_score = sum(scores) if scores else 0.0
    return (total_score, ', '.join(reasons) if reasons else 'No match')

def main():
    # Load research results
    with open('/home/runner/work/drywall-toolbox/drywall-toolbox/tmp/price_research_results.json', 'r') as f:
        research_products = json.load(f)
    
    # Load catalog
    catalog_products = []
    with open('/home/runner/work/drywall-toolbox/drywall-toolbox/public/products_catalog.csv', 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            catalog_products.append(row)
    
    print(f"Loaded {len(research_products)} research products")
    print(f"Loaded {len(catalog_products)} catalog products")
    print()
    
    matched_products = []
    stats = {
        'total_research': len(research_products),
        'matched': 0,
        'needs_update': 0,
        'already_priced': 0,
        'no_match': 0
    }
    
    # Match each research product
    for research_prod in research_products:
        best_match = None
        best_score = 0.0
        best_reason = ''
        
        for catalog_prod in catalog_products:
            score, reason = match_products(research_prod, catalog_prod)
            if score > best_score:
                best_score = score
                best_match = catalog_prod
                best_reason = reason
        
        # Consider it a match if score > 0.7
        if best_score >= 0.7 and best_match:
            stats['matched'] += 1
            
            # Check if needs price update
            catalog_price = best_match.get('price_numeric', '')
            needs_update = not catalog_price or catalog_price == '0' or catalog_price == '0.0' or catalog_price == ''
            
            if needs_update:
                stats['needs_update'] += 1
            else:
                stats['already_priced'] += 1
            
            match_info = {
                'research_product': {
                    'brand': research_prod.get('brand'),
                    'name': research_prod.get('name'),
                    'sku': research_prod.get('sku'),
                    'price': research_prod.get('price'),
                    'price_numeric': research_prod.get('price_numeric'),
                    'source': research_prod.get('source'),
                    'search_url': research_prod.get('search_url')
                },
                'catalog_product': {
                    'brand': best_match.get('brand'),
                    'name': best_match.get('name'),
                    'sku': best_match.get('sku'),
                    'current_price': best_match.get('price'),
                    'current_price_numeric': best_match.get('price_numeric')
                },
                'match_score': round(best_score, 3),
                'match_reason': best_reason,
                'needs_price_update': needs_update
            }
            
            matched_products.append(match_info)
        else:
            stats['no_match'] += 1
    
    # Save matched products
    with open('/home/runner/work/drywall-toolbox/drywall-toolbox/tmp/matched_prices_for_update.json', 'w') as f:
        json.dump(matched_products, f, indent=2)
    
    # Print statistics
    print("=" * 70)
    print("MATCHING STATISTICS")
    print("=" * 70)
    print(f"Total researched products:        {stats['total_research']}")
    print(f"Products matched to catalog:      {stats['matched']}")
    print(f"  - Need price updates:           {stats['needs_update']}")
    print(f"  - Already have prices:          {stats['already_priced']}")
    print(f"Products not in catalog:          {stats['no_match']}")
    print("=" * 70)
    print()
    print(f"Matched products saved to: tmp/matched_prices_for_update.json")
    print()
    
    # Show some examples of matched products needing updates
    needs_update = [m for m in matched_products if m['needs_price_update']]
    if needs_update:
        print("Sample products needing price updates:")
        print("-" * 70)
        for match in needs_update[:10]:  # Show first 10
            research = match['research_product']
            catalog = match['catalog_product']
            print(f"Brand: {research['brand']}")
            print(f"Research: {research['name']} (${research['price_numeric']})")
            print(f"Catalog:  {catalog['name']} (current: ${catalog['current_price_numeric']})")
            print(f"Match: {match['match_score']:.2f} - {match['match_reason']}")
            print()

if __name__ == '__main__':
    main()
