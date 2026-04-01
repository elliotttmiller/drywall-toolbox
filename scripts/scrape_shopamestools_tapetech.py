#!/usr/bin/env python3
"""
scrape_shopamestools_tapetech.py
--------------------------------
Scrapes every TapeTech drywall-tools product from:
  https://www.shopamestools.com/shop-by-brand/tapetech-taping-tools/drywalltools

Extracts per-product:
  - name          (storedisplayname2 / displayname)
  - sku           (itemid)
  - mpn           (manufacturer part number)
  - price         (formatted retail price)
  - short_description (storedescription, plain-text)
  - full_description  (storedetaileddescription, HTML stripped to plain text)
  - image_urls    (all gallery image URLs, pipe-separated)
  - product_url   (canonical shopamestools.com product page URL)
  - manufacturer
  - style         (custitem_option1description)
  - in_stock

Output:
  scraped_results/ShopAmesTools/TapeTech_drywalltools_catalog.csv
"""

import csv
import html
import re
import sys
import time
from pathlib import Path

import requests
from bs4 import BeautifulSoup

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------
BASE_URL = "https://www.shopamestools.com"
CATEGORY_URL = "/shop-by-brand/tapetech-taping-tools/drywalltools"
API_URL = f"{BASE_URL}/api/cacheable/items"

COMMON_PARAMS = {
    "c": "590358",
    "commercecategoryurl": CATEGORY_URL,
    "country": "US",
    "currency": "USD",
    "fieldset": "details",
    "language": "en",
    "n": "7",
    "pricelevel": "5",
    "sort": "commercecategory:desc",
    "use_pcv": "F",
}

PAGE_SIZE = 100          # max items per API call
REQUEST_DELAY = 0.4      # seconds between page requests (polite crawl)

OUTPUT_DIR = Path(__file__).parent.parent / "scraped_results" / "ShopAmesTools"
OUTPUT_FILE = OUTPUT_DIR / "TapeTech_drywalltools_catalog.csv"

CSV_FIELDS = [
    "sku",
    "mpn",
    "name",
    "manufacturer",
    "style",
    "price",
    "in_stock",
    "short_description",
    "full_description",
    "image_urls",
    "product_url",
]


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def make_session() -> requests.Session:
    session = requests.Session()
    session.headers.update({
        "User-Agent": (
            "Mozilla/5.0 (X11; Linux x86_64) "
            "AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/124.0 Safari/537.36"
        ),
        "Accept": "application/json, text/plain, */*",
        "Accept-Language": "en-US,en;q=0.9",
        "Accept-Encoding": "gzip, deflate",   # no brotli – requests can't decode it
        "Referer": BASE_URL + CATEGORY_URL,
    })
    return session


def strip_html(raw: str) -> str:
    """Convert HTML to clean plain text (collapse whitespace)."""
    if not raw:
        return ""
    soup = BeautifulSoup(raw, "lxml")
    text = soup.get_text(separator=" ")
    text = html.unescape(text)
    text = re.sub(r"\s+", " ", text).strip()
    return text


def extract_images(itemimages_detail: dict) -> list:
    """Return a flat list of all image URLs from the itemimages_detail blob."""
    urls = []
    for _group_name, group in itemimages_detail.items():
        for entry in group.get("urls", []):
            url = entry.get("url", "").strip()
            if url:
                urls.append(url)
    return urls


def fetch_page(session: requests.Session, offset: int) -> dict:
    """Fetch one page of product data from the AMES Tools API."""
    params = {**COMMON_PARAMS, "limit": str(PAGE_SIZE), "offset": str(offset)}
    resp = session.get(API_URL, params=params, timeout=30)
    resp.raise_for_status()
    return resp.json()


def build_product_url(urlcomponent: str) -> str:
    if urlcomponent:
        return f"{BASE_URL}/{urlcomponent}"
    return ""


def parse_item(item: dict) -> dict:
    """Map a raw API item dict to our canonical CSV row dict."""
    sku = item.get("itemid", "").strip()

    # Prefer the store-facing display name; fall back to internal name
    name = (item.get("storedisplayname2") or item.get("displayname") or "").strip()

    mpn = item.get("mpn", "").strip()

    price = item.get("onlinecustomerprice_formatted", "").strip()
    if not price:
        # fall back to pricelevel5
        price = item.get("pricelevel5_formatted", "").strip()

    manufacturer = item.get("manufacturer", "").strip()
    style = item.get("custitem_option1description", "").strip()
    in_stock = "Yes" if item.get("isinstock") else "No"

    short_desc = strip_html(item.get("storedescription", ""))
    full_desc = strip_html(item.get("storedetaileddescription", ""))

    image_urls = extract_images(item.get("itemimages_detail", {}))
    images_str = " | ".join(image_urls)

    product_url = build_product_url(item.get("urlcomponent", ""))

    return {
        "sku": sku,
        "mpn": mpn,
        "name": name,
        "manufacturer": manufacturer,
        "style": style,
        "price": price,
        "in_stock": in_stock,
        "short_description": short_desc,
        "full_description": full_desc,
        "image_urls": images_str,
        "product_url": product_url,
    }


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main() -> None:
    session = make_session()
    all_products = []

    print(f"Fetching TapeTech drywall tools from {BASE_URL}{CATEGORY_URL} …")

    # First call to get total count
    data = fetch_page(session, offset=0)
    total = data.get("total", 0)
    items = data.get("items", [])
    all_products.extend(items)

    print(f"  Total products reported: {total}")
    print(f"  Fetched page 1  ({len(items)} items)")

    # Paginate through remaining pages
    offset = PAGE_SIZE
    page_num = 2
    while offset < total:
        time.sleep(REQUEST_DELAY)
        data = fetch_page(session, offset=offset)
        batch = data.get("items", [])
        if not batch:
            print(f"  WARNING: empty batch at offset {offset} – stopping early")
            break
        all_products.extend(batch)
        print(f"  Fetched page {page_num}  ({len(batch)} items, running total: {len(all_products)})")
        offset += PAGE_SIZE
        page_num += 1

    print(f"\nTotal items collected: {len(all_products)}")

    # Parse into rows
    rows = [parse_item(item) for item in all_products]

    # Sort by SKU for a clean catalog
    rows.sort(key=lambda r: r["sku"])

    # Write CSV
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    with open(OUTPUT_FILE, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=CSV_FIELDS, quoting=csv.QUOTE_ALL)
        writer.writeheader()
        writer.writerows(rows)

    print(f"\nCatalog written → {OUTPUT_FILE}")
    print(f"Rows: {len(rows)}")


if __name__ == "__main__":
    main()
