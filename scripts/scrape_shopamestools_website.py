"""
scrape_shopamestools_website.py
--------------------------------
Scrapes https://www.shopamestools.com/shop-by-brand/tapetech-taping-tools/drywalltools
for all TapeTech drywall products.

Strategy
--------
Uses the SuiteCommerce (NetSuite) internal REST API endpoint /api/cacheable/items
with fieldset=details to retrieve all products in the drywall category.
The API returns rich product data in a single paginated JSON response, including:
  - displayname / storedisplayname2  → Product Name
  - mpn / itemid                     → MPN (manufacturer part number)
  - storedetaileddescription         → Description (HTML)

All pages are retrieved until the full result set is exhausted.

Outputs
-------
  products/scraped_results/ShopAmesTools/shopamestools_tapetech_drywall.csv
  products/scraped_results/ShopAmesTools/shopamestools_tapetech_drywall.json

Usage
-----
    python scripts/scrape_shopamestools_website.py
    python scripts/scrape_shopamestools_website.py --force   # re-fetch all pages
"""

from __future__ import annotations

import argparse
import csv
import json
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

import requests
from bs4 import BeautifulSoup


# ── Paths ─────────────────────────────────────────────────────────────────────

REPO_ROOT = Path(__file__).resolve().parents[1]
OUT_DIR = REPO_ROOT / "products" / "scraped_results" / "ShopAmesTools"
OUT_CSV = OUT_DIR / "shopamestools_tapetech_drywall.csv"
OUT_JSON = OUT_DIR / "shopamestools_tapetech_drywall.json"

# ── Constants ─────────────────────────────────────────────────────────────────

SITE_BASE = "https://www.shopamestools.com"
ITEMS_API = f"{SITE_BASE}/api/cacheable/items"

CATEGORY_ID = "590358"               # SuiteCommerce internal ID for TapeTech Drywall
CATEGORY_URL = "/shop-by-brand/tapetech-taping-tools/drywalltools"
PAGE_SIZE = 100                      # max items per request

REQUEST_DELAY = 0.25                 # seconds between paginated API requests

HEADERS = {
    "User-Agent": "drywall-toolbox-scraper/1.0 (+https://drywalltoolbox.com)",
    "Accept": "application/json",
    "Referer": f"{SITE_BASE}{CATEGORY_URL}",
}

CSV_FIELDNAMES = [
    "source",
    "name",
    "mpn",
    "description",
    "url",
]


# ── Helpers ────────────────────────────────────────────────────────────────────

def strip_html(html: str) -> str:
    """Remove HTML tags and normalise whitespace."""
    if not html:
        return ""
    soup = BeautifulSoup(html, "html.parser")
    return " ".join(soup.get_text(separator=" ").split())


def product_url(url_component: str) -> str:
    """Build the full product page URL from the urlcomponent field."""
    return f"{SITE_BASE}/{url_component}"


# ── API helpers ────────────────────────────────────────────────────────────────

def fetch_all_products(session: requests.Session) -> list[dict]:
    """
    Paginate through the SuiteCommerce items API and return all products
    in the drywall category with full detail fields.
    """
    all_items: list[dict] = []
    offset = 0

    while True:
        params = {
            "c": CATEGORY_ID,
            "commercecategoryurl": CATEGORY_URL,
            "country": "US",
            "currency": "USD",
            "fieldset": "details",
            "language": "en",
            "limit": PAGE_SIZE,
            "n": "7",
            "offset": offset,
            "pricelevel": "5",
            "use_pcv": "F",
        }

        try:
            resp = session.get(ITEMS_API, params=params, headers=HEADERS, timeout=30)
            resp.raise_for_status()
        except requests.RequestException as exc:
            print(
                f"  ERROR fetching items at offset {offset}: {exc}", file=sys.stderr
            )
            break

        data = resp.json()
        items = data.get("items", [])
        total = data.get("total", 0)

        if not items:
            break

        all_items.extend(items)
        current_end = offset + len(items)
        print(f"  Fetched {current_end}/{total} items (offset={offset})")

        if current_end >= total:
            break

        offset += PAGE_SIZE
        time.sleep(REQUEST_DELAY)

    return all_items


def normalize_product(item: dict) -> dict:
    """
    Convert a raw SuiteCommerce item record into a canonical product dict.
    """
    # Product name: prefer storedisplayname2 (cleaner), fall back to displayname
    name = (item.get("storedisplayname2") or item.get("displayname") or "").strip()

    # MPN: mpn field (same as itemid for TapeTech products)
    mpn = str(item.get("mpn") or item.get("itemid") or "").strip()

    # Description: storedetaileddescription (HTML) → plain text
    description = strip_html(item.get("storedetaileddescription") or "")

    # URL
    url_component = item.get("urlcomponent", "")
    url = product_url(url_component) if url_component else ""

    return {
        "source": "shopamestools.com",
        "name": name,
        "mpn": mpn,
        "description": description,
        "url": url,
    }


# ── Main ───────────────────────────────────────────────────────────────────────

def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--force",
        action="store_true",
        help="Re-fetch all pages even if output files already exist",
    )
    args = parser.parse_args()

    OUT_DIR.mkdir(parents=True, exist_ok=True)

    session = requests.Session()
    session.headers.update(HEADERS)

    print(f"Fetching TapeTech drywall products from {SITE_BASE} …")
    raw_items = fetch_all_products(session)
    print(f"\nFetched {len(raw_items)} raw items.")

    products = [normalize_product(item) for item in raw_items]
    # Filter out any items with no name or mpn
    products = [p for p in products if p["name"] or p["mpn"]]
    print(f"Normalised to {len(products)} products.")

    # ── Write JSON ─────────────────────────────────────────────────────────────
    payload = {
        "catalog": "ShopAmesTools — TapeTech Drywall Products",
        "source_url": f"{SITE_BASE}{CATEGORY_URL}",
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "product_count": len(products),
        "products": products,
    }
    OUT_JSON.write_text(
        json.dumps(payload, indent=2, ensure_ascii=False), encoding="utf-8"
    )
    print(f"Wrote {OUT_JSON}")

    # ── Write CSV ──────────────────────────────────────────────────────────────
    with OUT_CSV.open("w", encoding="utf-8", newline="") as fh:
        writer = csv.DictWriter(fh, fieldnames=CSV_FIELDNAMES, extrasaction="ignore")
        writer.writeheader()
        writer.writerows(products)
    print(f"Wrote {OUT_CSV}")


if __name__ == "__main__":
    main()
