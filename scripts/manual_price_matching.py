#!/usr/bin/env python3
"""
Manual price matching tool - Enhanced version for completing 70 unmatched products.
This script provides better fuzzy matching and interactive review capabilities.
"""

import csv
import json
import re
from typing import List, Dict, Tuple

# Complete list of researched prices from documentation
RESEARCHED_PRICES = [
    # Warner products
    {"brand": "Warner", "name": "Warner 10\" Stainless Steel Mexican Heritage Taping Knife", "price": "$12.99", "price_numeric": "12.99"},
    {"brand": "Warner", "name": "Warner 8 inch Progrip Blue Steel Mexican Heritage Taping Knife", "price": "$9.99", "price_numeric": "9.99"},
    {"brand": "Warner", "name": "Warner 6\" Mexican Heritage Joint Knife", "price": "$10.49", "price_numeric": "10.49"},
    {"brand": "Warner", "name": "Warner 5\" Mexican Heritage Joint Knife", "price": "$9.99", "price_numeric": "9.99"},
    {"brand": "Warner", "name": "Warner 4\" Mexican Heritage Joint Knife", "price": "$9.99", "price_numeric": "9.99"},
    {"brand": "Warner", "name": "Warner 8\" Stainless Steel Mexican Heritage Taping Knife", "price": "$10.99", "price_numeric": "10.99"},
    {"brand": "Warner", "name": "Warner 12\" Blue Steel Mexican Heritage Taping Knife", "price": "$10.99", "price_numeric": "10.99"},
    {"brand": "Warner", "name": "Warner 10\" Blue Steel Mexican Heritage Taping Knife", "price": "$10.49", "price_numeric": "10.49"},
    {"brand": "Warner", "name": "Warner 12\" Stainless Steel Mexican Heritage Taping Knife", "price": "$12.99", "price_numeric": "12.99"},
    {"brand": "Warner", "name": "Warner Adjustable Stainless Steel Inside Corner Trowel", "price": "$30.49", "price_numeric": "30.49"},
    {"brand": "Warner", "name": "Warner Strap-N-Stride 24-40\" Adjustable Aluminum Stilts", "price": "$289.00", "price_numeric": "289.00"},
    {"brand": "Warner", "name": "Warner EZ Stride Adjustable Drywall Bench 18\" - 28\"", "price": "$399.00", "price_numeric": "399.00"},
    
    # Hyde products
    {"brand": "Hyde", "name": "Hyde 09175 Professional Dust-Free Drywall Pole Sander Kit", "price": "$114.50", "price_numeric": "114.50"},
    {"brand": "Hyde", "name": "Hyde 09180 Professional Dust-Free Aluminum Pole Sander Kit", "price": "$119.00", "price_numeric": "119.00"},
    {"brand": "Hyde", "name": "Hyde 06878 Flexible Pro Stainless Drywall Putty Knife 6\"", "price": "$15.24", "price_numeric": "15.24"},
    {"brand": "Hyde", "name": "Hyde 06778 Flexible Pro Stainless Drywall Putty Knife 5\"", "price": "$14.36", "price_numeric": "14.36"},
    {"brand": "Hyde", "name": "Hyde 06578 Flexible Pro Stainless Drywall Putty Knife 4\"", "price": "$13.16", "price_numeric": "13.16"},
    {"brand": "Hyde", "name": "Hyde 02570 Black & Silver Flex Hammer Head Joint Knife 4\"", "price": "$11.59", "price_numeric": "11.59"},
    {"brand": "Hyde", "name": "Hyde 02770 Black & Silver Flex Hammer Head Joint Knife 5\"", "price": "$13.29", "price_numeric": "13.29"},
    {"brand": "Hyde", "name": "Hyde 02870 Black & Silver Flex Hammer Head Joint Knife 6\"", "price": "$13.33", "price_numeric": "13.33"},
    {"brand": "Hyde", "name": "Hyde 02700 3-1/2\" Flex Pointed Blade Joint Knife", "price": "$12.79", "price_numeric": "12.79"},
    {"brand": "Hyde", "name": "Hyde 6\" MaxxGrip Pro Jab Saw", "price": "$8.91", "price_numeric": "8.91"},
    {"brand": "Hyde", "name": "HYDE 02550 Black & Silver Flexible 4\" Putty Knife", "price": "$9.99", "price_numeric": "9.99"},
    {"brand": "Hyde", "name": "Hyde 02350 Black & Silver Flexible 3\" Putty Knife", "price": "$9.60", "price_numeric": "9.60"},
    {"brand": "Hyde", "name": "Hyde 02250 Black & Silver Flexible 2\" Putty Knife", "price": "$6.76", "price_numeric": "6.76"},
    {"brand": "Hyde", "name": "Hyde 9\" Radial Sander Head 09977", "price": "$20.94", "price_numeric": "20.94"},
    {"brand": "Hyde", "name": "Hyde 09047 Aluminum Pole Sander Head", "price": "$31.93", "price_numeric": "31.93"},
    {"brand": "Hyde", "name": "Hyde 6\" Jab Saw with Soft Grip", "price": "$7.99", "price_numeric": "7.99"},
    {"brand": "Hyde", "name": "Hyde Professional 6\" Jab Saw", "price": "$11.99", "price_numeric": "11.99"},
    
    # Marshalltown products
    {"brand": "Marshalltown", "name": "Marshalltown 11\" x 4.5\" Finishing Trowel DuraSoft Handle", "price": "$40.79", "price_numeric": "40.79"},
    {"brand": "Marshalltown", "name": "Marshalltown 14\" x 4\" Finishing Trowel DuraSoft Handle", "price": "$44.59", "price_numeric": "44.59"},
    {"brand": "Marshalltown", "name": "Marshalltown 12\" x 3\" Pool Trowel DuraSoft Handle", "price": "$42.99", "price_numeric": "42.99"},
    {"brand": "Marshalltown", "name": "Marshalltown 12\" x 4\" Finishing Trowel", "price": "$38.29", "price_numeric": "38.29"},
    {"brand": "Marshalltown", "name": "Marshalltown 16\" x 4\" Finishing Trowel", "price": "$51.29", "price_numeric": "51.29"},
    {"brand": "Marshalltown", "name": "Marshalltown SharpShooter 2.1 Hopper Gun Kit", "price": "$144.95", "price_numeric": "144.95"},
    {"brand": "Marshalltown", "name": "Marshalltown 54\" Drywall T-Square", "price": "$30.95", "price_numeric": "30.95"},
    {"brand": "Marshalltown", "name": "Marshalltown Drywall Mud Mixer Paddle 24-30\"", "price": "$16.00", "price_numeric": "16.00"},
    
    # Wal-Board products
    {"brand": "Wal-Board", "name": "Quick Mixer Joint Compound Mud Whip", "price": "$15.15", "price_numeric": "15.15"},
    {"brand": "Wal-Board", "name": "Bulldog Banjo Drywall Taper", "price": "$93.99", "price_numeric": "93.99"},
    {"brand": "Wal-Board", "name": "Stainless Steel Mud Pan 12\"", "price": "$13.50", "price_numeric": "13.50"},
    {"brand": "Wal-Board", "name": "Stainless Steel Taping Knife 6\"", "price": "$6.35", "price_numeric": "6.35"},
    {"brand": "Wal-Board", "name": "Stainless Steel Taping Knife 8\"", "price": "$7.35", "price_numeric": "7.35"},
    {"brand": "Wal-Board", "name": "Stainless Steel Taping Knife 10\"", "price": "$8.15", "price_numeric": "8.15"},
    {"brand": "Wal-Board", "name": "Stainless Steel Taping Knife 12\"", "price": "$9.15", "price_numeric": "9.15"},
    {"brand": "Wal-Board", "name": "6\" Blue Steel Joint Knife", "price": "$5.68", "price_numeric": "5.68"},
    {"brand": "Wal-Board", "name": "Wal-Board Texture Pro 200 Drywall Hopper Gun", "price": "$124.95", "price_numeric": "124.95"},
    
    # TapeTech products
    {"brand": "TapeTech", "name": "TapeTech 7\" Corner Applicator CA07TT", "price": "$315.00", "price_numeric": "315.00"},
    {"brand": "TapeTech", "name": "TapeTech 8\" Corner Applicator CA08TT", "price": "$330.00", "price_numeric": "330.00"},
    {"brand": "TapeTech", "name": "TapeTech MudRunner", "price": "$555.00", "price_numeric": "555.00"},
    {"brand": "TapeTech", "name": "TapeTech 3.5\" EasyRoll Angle Head Corner Finisher 48XTT", "price": "$439.00", "price_numeric": "439.00"},
    {"brand": "TapeTech", "name": "TapeTech Inside Corner Roller 15TTE", "price": "$189.00", "price_numeric": "189.00"},
    {"brand": "TapeTech", "name": "TapeTech EasyClean Compound Pump", "price": "$524.99", "price_numeric": "524.99"},
    {"brand": "TapeTech", "name": "TapeTech Box Filler Attachment", "price": "$54.99", "price_numeric": "54.99"},
    {"brand": "TapeTech", "name": "TapeTech MudDog Premium Banjo Taper", "price": "$119.00", "price_numeric": "119.00"},
    
    # DeWalt products
    {"brand": "DeWalt", "name": "DeWalt DW255 6,000 rpm VSR Drywall Screwgun", "price": "$99.99", "price_numeric": "99.99"},
    {"brand": "DeWalt", "name": "DeWalt DCF620B 20V MAX XR Lithium-Ion Brushless Drywall Screwgun Tool Only", "price": "$159.99", "price_numeric": "159.99"},
    {"brand": "DeWalt", "name": "DeWalt DCF630B 20V MAX XR 1/4\" Drywall Screwgun with Versa-Clutch", "price": "$199.00", "price_numeric": "199.00"},
    {"brand": "DeWalt", "name": "DeWalt DCF620D2 20V MAX XR Brushless Drywall Screw Gun Kit", "price": "$259.99", "price_numeric": "259.99"},
    {"brand": "DeWalt", "name": "Dewalt Folding Retractable Utility Knife", "price": "$10.99", "price_numeric": "10.99"},
    {"brand": "DeWalt", "name": "Dewalt Premium Retractable Utility Knife", "price": "$9.85", "price_numeric": "9.85"},
    
    # Milwaukee products
    {"brand": "Milwaukee", "name": "Milwaukee 2866-20 M18 FUEL Drywall Screw Gun Tool Only", "price": "$199.00", "price_numeric": "199.00"},
    {"brand": "Milwaukee", "name": "Milwaukee Fastback Flip Utility Knife 48-22-1501", "price": "$11.50", "price_numeric": "11.50"},
    {"brand": "Milwaukee", "name": "Milwaukee Fastback Compact Folding Utility Knife 48-22-1500", "price": "$8.25", "price_numeric": "8.25"},
    
    # Makita products
    {"brand": "Makita", "name": "Makita XSF03Z 18V LXT Drywall Screwdriver Tool Only", "price": "$150.00", "price_numeric": "150.00"},
    
    # Stanley products
    {"brand": "Stanley", "name": "Stanley Surform Pocket Plane Rasp Model 21-399", "price": "$10.99", "price_numeric": "10.99"},
    {"brand": "Stanley", "name": "Stanley 6-3/8\" Classic 99 Retractable Utility Knife", "price": "$4.99", "price_numeric": "4.99"},
    {"brand": "Stanley", "name": "Stanley FatMax Retractable Utility Knife", "price": "$8.99", "price_numeric": "8.99"},
    {"brand": "Stanley", "name": "Stanley FatMax 6\" Jab Saw", "price": "$8.99", "price_numeric": "8.99"},
    {"brand": "Stanley", "name": "Stanley 6\" Drywall Saw", "price": "$7.49", "price_numeric": "7.49"},
    {"brand": "Stanley", "name": "Stanley 6\" Wallboard Saw 15-206", "price": "$8.90", "price_numeric": "8.90"},
    {"brand": "Stanley", "name": "Stanley FatMax 6\" Jab Saw 20-556", "price": "$10.35", "price_numeric": "10.35"},
    
    # Level5 products
    {"brand": "Level5", "name": "Level5 7\" Drywall Flat Box", "price": "$401.84", "price_numeric": "401.84"},
    {"brand": "Level5", "name": "Level5 10\" Drywall Flat Box", "price": "$411.74", "price_numeric": "411.74"},
    {"brand": "Level5", "name": "Level5 12\" Drywall Flat Box", "price": "$422.09", "price_numeric": "422.09"},
    {"brand": "Level5", "name": "Level5 2.5\" Corner Finisher", "price": "$420.74", "price_numeric": "420.74"},
    {"brand": "Level5", "name": "Level5 3\" Corner Finisher", "price": "$430.64", "price_numeric": "430.64"},
    {"brand": "Level5", "name": "Level5 3.5\" Corner Finisher", "price": "$440.54", "price_numeric": "440.54"},
    {"brand": "Level5", "name": "Level5 4\" Corner Finisher", "price": "$450.44", "price_numeric": "450.44"},
    {"brand": "Level5", "name": "Level5 3\" Drywall Angle Head Corner Finisher", "price": "$430.64", "price_numeric": "430.64"},
    {"brand": "Level5", "name": "Level5 Compound Pump", "price": "$438.99", "price_numeric": "438.99"},
    {"brand": "Level5", "name": "Level5 Box Filler Attachment", "price": "$56.25", "price_numeric": "56.25"},
    
    # Kraft products
    {"brand": "Kraft", "name": "Kraft Tool 12\" Stainless Steel Mud Pan", "price": "$16.99", "price_numeric": "16.99"},
    {"brand": "Kraft", "name": "Kraft Tool Magnesium Hawk 13\"x13\"", "price": "$32.49", "price_numeric": "32.49"},
    {"brand": "Kraft", "name": "Kraft Tool Aluminum Hawk", "price": "$27.99", "price_numeric": "27.99"},
    {"brand": "Kraft", "name": "Kraft Tool Finishing Trowel ProForm Handle", "price": "$37.99", "price_numeric": "37.99"},
    
    # Columbia products
    {"brand": "Columbia", "name": "Columbia 24\" Drywall Corner Finishing Compound Mud Tube", "price": "$176.85", "price_numeric": "176.85"},
    {"brand": "Columbia", "name": "Columbia 48\" Aluminum Drywall T-Square", "price": "$32.99", "price_numeric": "32.99"},
    
    # Other brands
    {"brand": "Grabber", "name": "Grabber Collated Drywall Screws #6 x 1-1/4\" Fine Thread Phillips Bugle Head 1000ct", "price": "$38.50", "price_numeric": "38.50"},
    {"brand": "3M", "name": "3M Coarse 80-Grit Sandpaper Sheet 4.1875 x 11.25 8-Pack", "price": "$8.00", "price_numeric": "8.00"},
    {"brand": "3M", "name": "3M 120-Grit Drywall Sanding Screen 10-Pack", "price": "$11.99", "price_numeric": "11.99"},
    {"brand": "3M", "name": "3M ProPak 150-Grit Drywall Sanding Screens 10-Pack", "price": "$18.99", "price_numeric": "18.99"},
    {"brand": "Gator", "name": "Gator 220-Grit Sanding Screen 5-Pack", "price": "$7.48", "price_numeric": "7.48"},
    {"brand": "USG", "name": "USG Sheetrock Tools Drywall Pole Sander Head and Pole", "price": "$44.99", "price_numeric": "44.99"},
    {"brand": "USG", "name": "USG Sheetrock 2\" x 250' Paper Joint Tape", "price": "$2.75", "price_numeric": "2.75"},
    {"brand": "USG", "name": "USG Sheetrock 2\" x 500' Paper Joint Tape", "price": "$5.75", "price_numeric": "5.75"},
    {"brand": "Saint-Gobain", "name": "FibaTape 2\" x 150' Fiberglass Mesh Tape", "price": "$4.99", "price_numeric": "4.99"},
    {"brand": "Saint-Gobain", "name": "FibaTape 2\" x 250' Fiberglass Mesh Tape Blue", "price": "$5.39", "price_numeric": "5.39"},
    {"brand": "FibaFuse", "name": "FibaFuse 2\" x 300' Mold-Resistant Fiberglass Tape", "price": "$7.49", "price_numeric": "7.49"},
    {"brand": "Drywall Master Tools", "name": "Drywall Master Stainless Steel Outside Bead Corner Roller DM-91DM-OR", "price": "$220.00", "price_numeric": "220.00"},
    {"brand": "SurPro", "name": "SurPro Adjustable Rolling Drywall Bench", "price": "$289.00", "price_numeric": "289.00"},
    {"brand": "Johnson Level", "name": "Johnson Level 48\" Aluminum Drywall T-Square", "price": "$23.55", "price_numeric": "23.55"},
    {"brand": "Wallboard Tools", "name": "Wallboard Tools 54\" Aluminum Drywall T-Square", "price": "$31.99", "price_numeric": "31.99"},
]

def normalize_text(text: str) -> str:
    """Normalize text for matching."""
    if not text:
        return ""
    text = text.lower()
    text = re.sub(r'[^\w\s]', ' ', text)
    text = re.sub(r'\s+', ' ', text)
    return text.strip()

def extract_size(text: str) -> str:
    """Extract size measurements from text."""
    # Look for patterns like 6", 10", 12", etc.
    matches = re.findall(r'(\d+(?:\.\d+)?)\s*(?:inch|in|")', text.lower())
    return ','.join(matches) if matches else ""

def calculate_match_score(research_prod: Dict, catalog_prod: Dict) -> float:
    """Calculate match score between two products."""
    score = 0.0
    
    # Brand matching (40% weight)
    research_brand = normalize_text(research_prod['brand'])
    catalog_brand = normalize_text(catalog_prod.get('brand', ''))
    
    if research_brand == catalog_brand:
        score += 0.4
    elif research_brand in catalog_brand or catalog_brand in research_brand:
        score += 0.3
    
    # Name matching (60% weight)
    research_name = normalize_text(research_prod['name'])
    catalog_name = normalize_text(catalog_prod.get('name', ''))
    
    research_words = set(research_name.split())
    catalog_words = set(catalog_name.split())
    
    if research_words and catalog_words:
        common = research_words & catalog_words
        union = research_words | catalog_words
        word_score = len(common) / len(union) if union else 0
        score += word_score * 0.6
    
    # Size matching bonus (if sizes match, add 0.1)
    research_size = extract_size(research_prod['name'])
    catalog_size = extract_size(catalog_prod.get('name', ''))
    if research_size and catalog_size and research_size == catalog_size:
        score += 0.1
    
    return min(score, 1.0)

def find_matches(catalog_products: List[Dict], threshold: float = 0.4) -> List[Dict]:
    """Find matches for all researched products."""
    matches = []
    
    for research_prod in RESEARCHED_PRICES:
        best_match = None
        best_score = 0
        
        for catalog_prod in catalog_products:
            # Skip products that already have prices
            current_price = catalog_prod.get('price', '').strip()
            current_price_numeric = catalog_prod.get('price_numeric', '').strip()
            has_price = (current_price and current_price != '0' and current_price != '0.00') or \
                       (current_price_numeric and current_price_numeric != '0' and current_price_numeric != '0.00')
            
            if has_price:
                continue
            
            score = calculate_match_score(research_prod, catalog_prod)
            
            if score > best_score and score >= threshold:
                best_score = score
                best_match = catalog_prod
        
        if best_match:
            matches.append({
                'researched': research_prod,
                'catalog': best_match,
                'score': best_score
            })
    
    return matches

def apply_matches(catalog_path: str, matches: List[Dict], min_score: float = 0.5) -> int:
    """Apply matches to the catalog."""
    # Read all products
    all_products = []
    with open(catalog_path, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        fieldnames = reader.fieldnames
        all_products = list(reader)
    
    # Create lookup
    updated_count = 0
    for match in matches:
        if match['score'] < min_score:
            continue
        
        catalog_prod = match['catalog']
        research_prod = match['researched']
        
        # Find and update in all_products
        for prod in all_products:
            if prod.get('name') == catalog_prod.get('name') and \
               prod.get('brand') == catalog_prod.get('brand'):
                prod['price'] = research_prod['price']
                prod['price_numeric'] = research_prod['price_numeric']
                updated_count += 1
                break
    
    # Write back
    with open(catalog_path, 'w', encoding='utf-8', newline='') as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(all_products)
    
    return updated_count

def main():
    catalog_path = 'public/products_catalog.csv'
    
    print(f"{'='*70}")
    print(f"MANUAL PRICE MATCHING TOOL - Enhanced Version")
    print(f"{'='*70}\n")
    
    # Load catalog
    all_products = []
    with open(catalog_path, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        all_products = list(reader)
    
    print(f"Loaded {len(all_products)} products from catalog")
    print(f"Researched prices to match: {len(RESEARCHED_PRICES)}\n")
    
    # Find matches with lower threshold
    print("Finding matches with enhanced algorithm...")
    matches = find_matches(all_products, threshold=0.35)
    
    print(f"\nFound {len(matches)} potential matches")
    
    # Sort by score
    matches.sort(key=lambda x: x['score'], reverse=True)
    
    # Show top matches
    print(f"\n{'='*70}")
    print("Top 30 Matches:")
    print(f"{'='*70}\n")
    for i, match in enumerate(matches[:30], 1):
        print(f"{i}. Score: {match['score']:.2f}")
        print(f"   Research: {match['researched']['brand']} - {match['researched']['name'][:60]}")
        print(f"   Catalog:  {match['catalog']['brand']} - {match['catalog']['name'][:60]}")
        print(f"   Price: {match['researched']['price']}")
        print()
    
    # Apply matches with score >= 0.5
    high_confidence = [m for m in matches if m['score'] >= 0.5]
    medium_confidence = [m for m in matches if 0.4 <= m['score'] < 0.5]
    low_confidence = [m for m in matches if 0.35 <= m['score'] < 0.4]
    
    print(f"\nMatch confidence breakdown:")
    print(f"  High confidence (≥0.5): {len(high_confidence)} matches")
    print(f"  Medium confidence (0.4-0.5): {len(medium_confidence)} matches")
    print(f"  Low confidence (0.35-0.4): {len(low_confidence)} matches")
    
    # Save match report
    with open('manual_match_report.json', 'w') as f:
        json.dump({
            'high_confidence': high_confidence,
            'medium_confidence': medium_confidence,
            'low_confidence': low_confidence
        }, f, indent=2, default=str)
    
    print(f"\n✓ Match report saved to manual_match_report.json")
    
    # Apply high confidence matches
    updated = apply_matches(catalog_path, high_confidence, min_score=0.5)
    print(f"\n✓ Applied {updated} high-confidence matches to catalog")
    
    return len(matches), updated

if __name__ == '__main__':
    total_matches, applied = main()
    print(f"\n{'='*70}")
    print(f"Summary: Found {total_matches} matches, applied {applied} to catalog")
    print(f"{'='*70}")
