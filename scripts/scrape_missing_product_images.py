#!/usr/bin/env python3
"""
Scrape missing product images for Level5, TapeTech, and Asgard brands.

Strategy:
  1. Check local webp files first (fast, no network)
  2. Level5 non-numeric SKUs (DXTT-xxx, 4-xxx): scrape level5tools.com search
  3. Level5 numeric SKUs (7xxx/8xxx hardware parts) + TapeTech parts: all-wall.com API
  4. Asgard CA08-AD: all-wall.com + tapetech.com

Outputs:
  scripts/missing_images_found.csv  - sku, brand, name, image_url, source_url, status
  frontend/public/wp-catalog.csv    - updated with found image URLs
"""

import csv
import json
import os
import re
import time
from pathlib import Path
from urllib.parse import quote_plus, urljoin
from xml.etree import ElementTree as ET

import requests

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------

REPO_ROOT = Path(__file__).resolve().parent.parent
CSV_PATH = REPO_ROOT / "frontend" / "public" / "wp-catalog.csv"
OUTPUT_CSV = REPO_ROOT / "scripts" / "missing_images_found.csv"

LEVEL5_LOCAL_DIR = REPO_ROOT / "frontend" / "public" / "brands" / "Level5" / "product_images"
TAPETECH_LOCAL_DIR = REPO_ROOT / "frontend" / "public" / "brands" / "TapeTech"
ASGARD_LOCAL_DIR = REPO_ROOT / "frontend" / "public" / "brands" / "Asgard"

LEVEL5_URL_BASE = "https://drywalltoolbox.com/brands/Level5/product_images/{sku}.webp"
TAPETECH_URL_BASE = "https://drywalltoolbox.com/brands/TapeTech/{sku}.webp"
ASGARD_URL_BASE = "https://drywalltoolbox.com/brands/Asgard/{sku}.webp"

RATE_DELAY = 0.35  # seconds between requests


def make_session():
    s = requests.Session()
    s.headers.update({
        "User-Agent": (
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
            "AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/120.0.0.0 Safari/537.36"
        ),
        "Accept-Encoding": "gzip, deflate",  # NO brotli
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    })
    return s


SESSION = make_session()


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def get(url, timeout=15, retries=2):
    for attempt in range(retries + 1):
        try:
            r = SESSION.get(url, timeout=timeout)
            return r
        except Exception as e:
            if attempt == retries:
                print(f"    [WARN] GET failed for {url}: {e}")
                return None
            time.sleep(1)


def extract_level5_image(html: str) -> str | None:
    """Extract the best image URL from a Level5 product page."""
    # 1. og:image meta tag (most reliable)
    for pat in [
        r'<meta\s+property=["\']og:image["\']\s+content=["\']([^"\']+)["\']',
        r'<meta\s+content=["\']([^"\']+)["\']\s+property=["\']og:image["\']',
    ]:
        m = re.search(pat, html, re.IGNORECASE)
        if m:
            url = m.group(1).strip()
            if url and "cdn11.bigcommerce.com" in url:
                return url

    # 2. JSON-LD image field
    for m in re.finditer(r'"image"\s*:\s*"(https://cdn11\.bigcommerce\.com/[^"]+)"', html):
        return m.group(1).strip()

    # 3. Any BigCommerce CDN URL for stencil images
    m = re.search(
        r'(https://cdn11\.bigcommerce\.com/s-89a9ntp16/images/stencil/[^"\'>\s]+)',
        html,
    )
    if m:
        return m.group(1).strip()

    # 4. Any BigCommerce CDN URL
    m = re.search(r'(https://cdn11\.bigcommerce\.com/[^"\'>\s]+\.(?:jpg|jpeg|png|webp))',
                  html, re.IGNORECASE)
    if m:
        return m.group(1).strip()

    return None


def extract_level5_sku(html: str) -> str | None:
    """Extract SKU from Level5 product page."""
    for pat in [
        r'"sku"\s*:\s*"([^"]+)"',
        r'<span[^>]*class=["\'][^"\']*sku[^"\']*["\'][^>]*>\s*([^<]+)\s*</span>',
        r'itemprop=["\']sku["\']\s*content=["\']([^"\']+)["\']',
    ]:
        m = re.search(pat, html, re.IGNORECASE)
        if m:
            sku = m.group(1).strip()
            if sku:
                return sku
    return None


# ---------------------------------------------------------------------------
# Step 1 - Load CSV and find missing image rows
# ---------------------------------------------------------------------------

def load_csv():
    with open(CSV_PATH, newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        fieldnames = reader.fieldnames
        rows = list(reader)
    return fieldnames, rows


def find_missing(rows):
    return [r for r in rows if not r.get("Images", "").strip()]


# ---------------------------------------------------------------------------
# Step 2 - Check local files
# ---------------------------------------------------------------------------

def check_local_level5(sku: str) -> str | None:
    fn = LEVEL5_LOCAL_DIR / f"{sku}.webp"
    if fn.exists():
        return LEVEL5_URL_BASE.format(sku=sku)
    return None


def check_local_tapetech(sku: str) -> str | None:
    fn = TAPETECH_LOCAL_DIR / f"{sku}.webp"
    if fn.exists():
        return TAPETECH_URL_BASE.format(sku=sku)
    return None


def check_local_asgard(sku: str) -> str | None:
    fn = ASGARD_LOCAL_DIR / f"{sku}.webp"
    if fn.exists():
        return ASGARD_URL_BASE.format(sku=sku)
    return None


# ---------------------------------------------------------------------------
# Step 3 - Scrape Level5 sitemap
# ---------------------------------------------------------------------------

def get_level5_sitemap_urls():
    """Fetch all product URLs from Level5 XML sitemap (all pages)."""
    urls = []
    page = 1
    while True:
        sitemap_url = f"https://www.level5tools.com/xmlsitemap.php?type=products&page={page}"
        print(f"  Fetching sitemap page {page}: {sitemap_url}")
        r = get(sitemap_url, timeout=20)
        time.sleep(RATE_DELAY)
        if not r or r.status_code != 200:
            print(f"  [WARN] Sitemap page {page} returned status {r.status_code if r else 'None'}")
            break
        text = r.text.strip()
        if not text or "<url>" not in text:
            print(f"  Sitemap page {page}: no more URLs found.")
            break
        try:
            root = ET.fromstring(text)
            ns = {"sm": "http://www.sitemaps.org/schemas/sitemap/0.9"}
            locs = [elem.text for elem in root.findall(".//sm:loc", ns) if elem.text]
            if not locs:
                # try without namespace
                locs = [elem.text for elem in root.findall(".//loc") if elem.text]
            if not locs:
                print(f"  Sitemap page {page}: parsed but found 0 URLs.")
                break
            urls.extend(locs)
            print(f"    Found {len(locs)} URLs on page {page} (total: {len(urls)})")
            page += 1
        except ET.ParseError as e:
            print(f"  [WARN] XML parse error on sitemap page {page}: {e}")
            break
    return urls


def scrape_level5_products(product_urls: list[str]) -> dict[str, str]:
    """Scrape Level5 product pages and return {sku: image_url} mapping."""
    mapping: dict[str, str] = {}
    total = len(product_urls)
    for i, url in enumerate(product_urls, 1):
        if i % 50 == 0 or i == 1:
            print(f"  Scraping Level5 product {i}/{total}: {url}")
        r = get(url, timeout=15)
        time.sleep(RATE_DELAY)
        if not r or r.status_code != 200:
            continue
        sku = extract_level5_sku(r.text)
        img = extract_level5_image(r.text)
        if sku and img:
            mapping[sku.upper()] = img
        elif sku:
            mapping[sku.upper()] = ""  # page found but no image
    return mapping


def search_level5_sku(sku: str) -> str | None:
    """Try Level5 search page for a given SKU."""
    search_url = f"https://www.level5tools.com/search.php?search_query={quote_plus(sku)}"
    r = get(search_url, timeout=15)
    time.sleep(RATE_DELAY)
    if not r or r.status_code != 200:
        return None
    html = r.text

    # If redirected to a single product page, extract image directly
    if r.url != search_url and r.url.startswith("https://www.level5tools.com/") and r.url != "https://www.level5tools.com/":
        img = extract_level5_image(html)
        if img:
            return img

    # Otherwise look for product links in search results
    product_links = re.findall(
        r'href=["\'](https://www\.level5tools\.com/[a-z0-9\-]+/)["\']',
        html,
        re.IGNORECASE,
    )
    product_links = list(dict.fromkeys(product_links))  # dedupe, preserve order

    for prod_url in product_links[:3]:
        pr = get(prod_url, timeout=15)
        time.sleep(RATE_DELAY)
        if not pr or pr.status_code != 200:
            continue
        page_sku = extract_level5_sku(pr.text)
        img = extract_level5_image(pr.text)
        if img and page_sku and page_sku.upper() == sku.upper():
            return img
        if img and not page_sku:
            return img

    return None


# ---------------------------------------------------------------------------
# Step 4 - TapeTech via all-wall.com API
# ---------------------------------------------------------------------------

def search_allwall(name: str, sku: str) -> str | None:
    """Search all-wall.com API by product name or SKU, return image URL or None.

    Response structure:
      data["items"][n]["itemimages_detail"]["media"]["urls"][0]["url"]
    """
    for query in [name, sku]:
        url = (
            f"https://www.all-wall.com/api/items"
            f"?q={quote_plus(query)}&limit=3&fieldset=details"
        )
        r = get(url, timeout=15)
        time.sleep(RATE_DELAY)
        if not r or r.status_code != 200:
            continue
        try:
            data = r.json()
        except Exception:
            continue

        # API returns {"items": [...], "total": n, ...}
        items = data.get("items", data) if isinstance(data, dict) else data
        if not isinstance(items, list) or not items:
            continue

        for item in items[:3]:
            img_detail = item.get("itemimages_detail")
            if not img_detail or not isinstance(img_detail, dict):
                continue
            # Each key (e.g. "media", "thumbnail") maps to {"urls": [{"url": ...}]}
            for _key, val in img_detail.items():
                if not isinstance(val, dict):
                    continue
                urls = val.get("urls", [])
                if urls and isinstance(urls, list):
                    first = urls[0]
                    u = first.get("url") if isinstance(first, dict) else str(first)
                    if u:
                        # Encode spaces in the URL path
                        return u.replace(" ", "%20")
    return None


def search_shopamestools(name: str, sku: str) -> str | None:
    """Search shopamestools.com for a product, return image URL or None."""
    # Use their search
    search_url = f"https://www.shopamestools.com/search?q={quote_plus(name)}"
    r = get(search_url, timeout=15)
    time.sleep(RATE_DELAY)
    if not r or r.status_code != 200:
        return None
    html = r.text

    # Find product links
    links = re.findall(
        r'href=["\'](/products/[^"\'?#]+)["\']',
        html,
        re.IGNORECASE,
    )
    if not links:
        return None

    for rel_link in links[:3]:
        prod_url = f"https://www.shopamestools.com{rel_link}"
        pr = get(prod_url, timeout=15)
        time.sleep(RATE_DELAY)
        if not pr or pr.status_code != 200:
            continue
        # og:image
        m = re.search(
            r'<meta\s+(?:property=["\']og:image["\']\s+content=["\']|content=["\']([^"\']+)["\']\s+property=["\']og:image["\'])',
            pr.text, re.IGNORECASE
        )
        if not m:
            m = re.search(
                r'<meta\s+property=["\']og:image["\']\s+content=["\']([^"\']+)["\']',
                pr.text, re.IGNORECASE,
            )
        if m:
            url = m.group(1) or m.group(0)
            if url and url.startswith("http"):
                return url
        # JSON-LD
        m = re.search(r'"image"\s*:\s*"(https?://[^"]+)"', pr.text)
        if m:
            return m.group(1)
    return None


# ---------------------------------------------------------------------------
# Step 5 - Asgard (CA08-AD)
# ---------------------------------------------------------------------------

def find_asgard_image(sku: str, name: str) -> tuple[str | None, str | None]:
    """Try several sources for the Asgard CA08-AD image."""
    # 1. TapeTech website search
    search_url = f"https://www.tapetech.com/search?q={quote_plus(sku)}"
    r = get(search_url, timeout=15)
    time.sleep(RATE_DELAY)
    if r and r.status_code == 200:
        m = re.search(
            r'<meta\s+property=["\']og:image["\']\s+content=["\']([^"\']+)["\']',
            r.text, re.IGNORECASE
        )
        if m:
            return m.group(1), search_url

    # 2. all-wall.com
    img = search_allwall(name, sku)
    if img:
        return img, f"https://www.all-wall.com/api/items?q={quote_plus(name)}"

    # 3. shopamestools
    img = search_shopamestools(name, sku)
    if img:
        return img, f"https://www.shopamestools.com/search?q={quote_plus(name)}"

    # 4. Direct TapeTech product page guess
    # Asgard is made by TapeTech; try tapetech.com/shop
    r = get("https://www.tapetech.com/shop", timeout=15)
    time.sleep(RATE_DELAY)
    if r and r.status_code == 200:
        # look for CA08
        m = re.search(r'href=["\']([^"\']+ca08[^"\']*)["\']', r.text, re.IGNORECASE)
        if m:
            prod_url = urljoin("https://www.tapetech.com", m.group(1))
            pr = get(prod_url, timeout=15)
            time.sleep(RATE_DELAY)
            if pr and pr.status_code == 200:
                mi = re.search(
                    r'<meta\s+property=["\']og:image["\']\s+content=["\']([^"\']+)["\']',
                    pr.text, re.IGNORECASE,
                )
                if mi:
                    return mi.group(1), prod_url

    return None, None


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    print("=" * 60)
    print("Scraping missing product images")
    print("=" * 60)

    fieldnames, rows = load_csv()
    missing = find_missing(rows)

    level5_missing = [r for r in missing if r.get("Brands") == "Level5"]
    tapetech_missing = [r for r in missing if r.get("Brands") == "TapeTech"]
    asgard_missing = [r for r in missing if r.get("Brands") == "Asgard"]

    print(f"\nMissing images: {len(missing)} total")
    print(f"  Level5: {len(level5_missing)}")
    print(f"  TapeTech: {len(tapetech_missing)}")
    print(f"  Asgard: {len(asgard_missing)}")

    results: list[dict] = []  # {sku, brand, name, image_url, source_url, status}

    # -----------------------------------------------------------------------
    # LEVEL5
    # -----------------------------------------------------------------------
    print("\n" + "-" * 40)
    print("LEVEL5")
    print("-" * 40)

    level5_found: dict[str, tuple[str, str]] = {}  # sku -> (image_url, source_url)

    # 2a. Check local files first
    print("\nChecking local Level5 files...")
    local_found = 0
    still_missing_l5 = []
    for row in level5_missing:
        sku = row["SKU"]
        local_img = check_local_level5(sku)
        if local_img:
            level5_found[sku] = (local_img, "local")
            local_found += 1
        else:
            still_missing_l5.append(row)
    print(f"  Local hits: {local_found}, still missing: {len(still_missing_l5)}")

    # Separate by SKU type
    numeric_l5 = [r for r in still_missing_l5 if r["SKU"].isdigit()]
    alpha_l5 = [r for r in still_missing_l5 if not r["SKU"].isdigit() and r["SKU"] != "N/A"]
    print(f"  Numeric SKUs (hardware parts): {len(numeric_l5)}")
    print(f"  Alphanumeric SKUs: {len(alpha_l5)}")

    # 2b. Level5 search for DXTT-xxx and 4-xxx type SKUs
    if alpha_l5:
        print(f"\nSearching Level5 website for {len(alpha_l5)} alphanumeric SKUs...")
        l5_search_found = 0
        for i, row in enumerate(alpha_l5, 1):
            sku = row["SKU"]
            img = search_level5_sku(sku)
            if img:
                src = f"https://www.level5tools.com/search.php?search_query={quote_plus(sku)}"
                level5_found[sku] = (img, src)
                l5_search_found += 1
        print(f"  Found via Level5 search: {l5_search_found}/{len(alpha_l5)}")

    # 2c. all-wall.com for numeric hardware part SKUs
    alpha_not_found = [r for r in alpha_l5 if r["SKU"] not in level5_found]
    to_try_allwall = numeric_l5 + alpha_not_found
    if to_try_allwall:
        print(f"\nSearching all-wall.com for {len(to_try_allwall)} Level5 parts...")
        l5_aw_found = 0
        for i, row in enumerate(to_try_allwall, 1):
            sku = row["SKU"]
            name = row["Name"]
            if i % 50 == 0:
                print(f"  all-wall.com Level5 progress: {i}/{len(to_try_allwall)}")
            img = search_allwall(name, sku)
            if img:
                level5_found[sku] = (
                    img,
                    f"https://www.all-wall.com/api/items?q={quote_plus(name)}&limit=3&fieldset=details",
                )
                l5_aw_found += 1
        print(f"  Found via all-wall.com: {l5_aw_found}/{len(to_try_allwall)}")

    # Compile Level5 results
    for row in level5_missing:
        sku = row["SKU"]
        if sku in level5_found:
            img_url, src_url = level5_found[sku]
            results.append({
                "sku": sku, "brand": "Level5", "name": row["Name"],
                "image_url": img_url, "source_url": src_url, "status": "found",
            })
        else:
            results.append({
                "sku": sku, "brand": "Level5", "name": row["Name"],
                "image_url": "", "source_url": "", "status": "not_found",
            })

    # -----------------------------------------------------------------------
    # TAPETECH
    # -----------------------------------------------------------------------
    print("\n" + "-" * 40)
    print("TAPETECH")
    print("-" * 40)

    tapetech_found: dict[str, tuple[str, str]] = {}

    # Check local files first
    print("\nChecking local TapeTech files...")
    tt_local = 0
    still_missing_tt = []
    for row in tapetech_missing:
        sku = row["SKU"]
        local_img = check_local_tapetech(sku)
        if local_img:
            tapetech_found[sku] = (local_img, "local")
            tt_local += 1
        else:
            still_missing_tt.append(row)
    print(f"  Local hits: {tt_local}, still missing: {len(still_missing_tt)}")

    # all-wall.com API
    print(f"\nSearching all-wall.com for {len(still_missing_tt)} TapeTech parts...")
    tt_allwall = 0
    still_missing_tt_v2 = []
    for i, row in enumerate(still_missing_tt, 1):
        sku = row["SKU"]
        name = row["Name"]
        if i % 20 == 0:
            print(f"  all-wall.com progress: {i}/{len(still_missing_tt)}")
        img = search_allwall(name, sku)
        if img:
            tapetech_found[sku] = (
                img,
                f"https://www.all-wall.com/api/items?q={quote_plus(name)}&limit=3&fieldset=details",
            )
            tt_allwall += 1
        else:
            still_missing_tt_v2.append(row)
    print(f"  Found via all-wall.com: {tt_allwall}")
    print(f"  Still missing: {len(still_missing_tt_v2)}")

    # Fallback: shopamestools for remaining TapeTech
    if still_missing_tt_v2:
        print(f"\nTrying shopamestools.com for {len(still_missing_tt_v2)} TapeTech parts...")
        tt_ames = 0
        for row in still_missing_tt_v2:
            sku = row["SKU"]
            name = row["Name"]
            img = search_shopamestools(name, sku)
            if img:
                tapetech_found[sku] = (
                    img,
                    f"https://www.shopamestools.com/search?q={quote_plus(name)}",
                )
                tt_ames += 1
        print(f"  Found via shopamestools.com: {tt_ames}")

    # Compile TapeTech results
    for row in tapetech_missing:
        sku = row["SKU"]
        if sku in tapetech_found:
            img_url, src_url = tapetech_found[sku]
            results.append({
                "sku": sku, "brand": "TapeTech", "name": row["Name"],
                "image_url": img_url, "source_url": src_url, "status": "found",
            })
        else:
            results.append({
                "sku": sku, "brand": "TapeTech", "name": row["Name"],
                "image_url": "", "source_url": "", "status": "not_found",
            })

    # -----------------------------------------------------------------------
    # ASGARD
    # -----------------------------------------------------------------------
    print("\n" + "-" * 40)
    print("ASGARD")
    print("-" * 40)

    asgard_found: dict[str, tuple[str, str]] = {}

    for row in asgard_missing:
        sku = row["SKU"]
        name = row["Name"]
        print(f"\n  Looking for Asgard SKU={sku} Name={name}")

        # Check local first
        local_img = check_local_asgard(sku)
        if local_img:
            asgard_found[sku] = (local_img, "local")
            print(f"    Found locally: {local_img}")
        else:
            img, src = find_asgard_image(sku, name)
            if img:
                asgard_found[sku] = (img, src or "")
                print(f"    Found: {img}")
                print(f"    Source: {src}")
            else:
                print(f"    Not found.")

    for row in asgard_missing:
        sku = row["SKU"]
        if sku in asgard_found:
            img_url, src_url = asgard_found[sku]
            results.append({
                "sku": sku, "brand": "Asgard", "name": row["Name"],
                "image_url": img_url, "source_url": src_url, "status": "found",
            })
        else:
            results.append({
                "sku": sku, "brand": "Asgard", "name": row["Name"],
                "image_url": "", "source_url": "", "status": "not_found",
            })

    # -----------------------------------------------------------------------
    # Write output CSV
    # -----------------------------------------------------------------------
    print("\n" + "-" * 40)
    print("WRITING OUTPUTS")
    print("-" * 40)

    output_fields = ["sku", "brand", "name", "image_url", "source_url", "status"]
    with open(OUTPUT_CSV, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=output_fields)
        writer.writeheader()
        writer.writerows(results)

    found_count = sum(1 for r in results if r["status"] == "found")
    not_found_count = sum(1 for r in results if r["status"] == "not_found")
    print(f"\nWrote {len(results)} rows to {OUTPUT_CSV}")
    print(f"  Found: {found_count}")
    print(f"  Not found: {not_found_count}")

    # -----------------------------------------------------------------------
    # Update wp-catalog.csv
    # -----------------------------------------------------------------------
    found_map: dict[str, str] = {
        r["sku"]: r["image_url"] for r in results if r["status"] == "found"
    }

    updated_count = 0
    for row in rows:
        sku = row.get("SKU", "")
        if not row.get("Images", "").strip() and sku in found_map:
            row["Images"] = found_map[sku]
            updated_count += 1

    # Write to temp file then replace
    temp_path = CSV_PATH.with_suffix(".csv.new")
    with open(temp_path, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames, extrasaction="ignore")
        writer.writeheader()
        writer.writerows(rows)

    # Verify the new file
    with open(temp_path, newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        verify_rows = list(reader)

    if len(verify_rows) != len(rows):
        print(f"[ERROR] Row count mismatch: {len(rows)} original vs {len(verify_rows)} written. Aborting CSV update.")
    else:
        # Replace original
        temp_path.replace(CSV_PATH)
        print(f"\nUpdated wp-catalog.csv: {updated_count} rows had Images filled in")

    # -----------------------------------------------------------------------
    # Summary
    # -----------------------------------------------------------------------
    print("\n" + "=" * 60)
    print("SUMMARY")
    print("=" * 60)
    by_brand = {}
    for r in results:
        b = r["brand"]
        if b not in by_brand:
            by_brand[b] = {"found": 0, "not_found": 0}
        by_brand[b][r["status"]] += 1

    for b, counts in sorted(by_brand.items()):
        total = counts["found"] + counts["not_found"]
        print(f"  {b}: {counts['found']}/{total} found ({counts['not_found']} not found)")

    print(f"\nTotal: {found_count}/{len(results)} found")
    print(f"\nOutput files:")
    print(f"  {OUTPUT_CSV}")
    print(f"  {CSV_PATH} (updated)")


if __name__ == "__main__":
    main()
