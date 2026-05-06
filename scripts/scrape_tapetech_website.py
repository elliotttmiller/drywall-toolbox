"""
scrape_tapetech_website.py
--------------------------
Scrapes https://tapetech.com/product-category/drywall/ for all drywall tools.

Strategy
--------
1. Use the WordPress REST API to enumerate every product in the "Drywall" category
   (category ID 492, slug "drywall").
2. For each product URL, fetch the product page.
3. Parse the Porto-theme JSON-encoded <script type="text/template"> block, which
   contains the fully-rendered WooCommerce product HTML, to extract:
     - Product Name  (from JSON-LD schema.org Product)
     - MPN / SKU     (labeled "SKU" on the site; the real manufacturer part number)
     - Description   (from #tab-description)
     - Additional Information — weight and dimensions (from WooCommerce attributes table)
     - Image URLs    (full-size gallery images, de-duplicated)

Outputs
-------
  products/scraped_results/TapeTech/tapetech_drywall_scraped.csv
  products/scraped_results/TapeTech/tapetech_drywall_scraped.json

Usage
-----
    python scripts/scrape_tapetech_website.py
    python scripts/scrape_tapetech_website.py --force   # re-scrape already-scraped products
    python scripts/scrape_tapetech_website.py --delay 0.5  # set per-request delay in seconds
"""

from __future__ import annotations

import argparse
import csv
import json
import re
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import requests
from bs4 import BeautifulSoup


# ── Paths ─────────────────────────────────────────────────────────────────────

REPO_ROOT = Path(__file__).resolve().parents[1]
OUT_DIR = REPO_ROOT / "products" / "scraped_results" / "TapeTech"
OUT_CSV = OUT_DIR / "tapetech_drywall_scraped.csv"
OUT_JSON = OUT_DIR / "tapetech_drywall_scraped.json"

# ── Constants ─────────────────────────────────────────────────────────────────

SITE_BASE = "https://tapetech.com"
WP_API_BASE = f"{SITE_BASE}/wp-json/wp/v2"
DRYWALL_CAT_ID = 492          # WordPress term ID for category slug "drywall"
PER_PAGE = 100                # max allowed by WP REST API
REQUEST_DELAY = 0.3           # seconds between requests (be polite)

HEADERS = {
    "User-Agent": "drywall-toolbox-scraper/1.0 (+https://drywalltoolbox.com)",
    "Accept": "text/html,application/json,*/*",
}

# WooCommerce image CDN size suffixes to strip when building full-size URL
_IMAGE_SIZE_RE = re.compile(r"-\d+x\d+(?=\.[a-zA-Z]+$)")

CSV_FIELDNAMES = [
    "source",
    "name",
    "mpn",
    "description",
    "additional_information",
    "weight_lbs",
    "length_in",
    "width_in",
    "height_in",
    "image_urls",
    "url",
]


# ── Helpers ────────────────────────────────────────────────────────────────────

def full_size_url(url: str) -> str:
    """Strip WooCommerce CDN size suffix (e.g. -600x600) to get original."""
    return _IMAGE_SIZE_RE.sub("", url)


def strip_html(html: str) -> str:
    """Remove HTML tags and normalise whitespace."""
    if not html:
        return ""
    soup = BeautifulSoup(html, "html.parser")
    return " ".join(soup.get_text(separator=" ").split())


def parse_template_html(page_html: str) -> BeautifulSoup | None:
    """
    The Porto theme serialises the rendered product page as a JSON string inside
    a <script type="text/template"> element.  Parse and decode that block.
    """
    ts_match = re.search(
        r'<script\s+type=["\']text/template["\']>(.*?)</script>',
        page_html,
        re.DOTALL,
    )
    if not ts_match:
        return None
    raw = ts_match.group(1).strip()
    if not raw.startswith('"'):
        # Not a JSON string — try parsing as raw HTML directly
        return BeautifulSoup(raw, "html.parser")
    try:
        decoded = json.loads(raw)
    except json.JSONDecodeError:
        return None
    return BeautifulSoup(decoded, "html.parser")


# ── Extraction helpers ─────────────────────────────────────────────────────────

def extract_name_from_ld_json(page_html: str) -> str:
    """Pull the product name from schema.org JSON-LD on the page."""
    for s_match in re.finditer(
        r'<script\s+type=["\']application/ld\+json["\']>(.*?)</script>',
        page_html,
        re.DOTALL,
    ):
        try:
            data = json.loads(s_match.group(1))
            if isinstance(data, list):
                for item in data:
                    if item.get("@type") == "Product":
                        return item.get("name", "")
            elif data.get("@type") == "Product":
                return data.get("name", "")
        except json.JSONDecodeError:
            continue
    return ""


def extract_product_fields(
    inner: BeautifulSoup,
) -> dict[str, Any]:
    """
    Given the decoded template HTML, extract SKU/MPN, description,
    additional information, and gallery images.
    """
    result: dict[str, Any] = {
        "mpn": "",
        "description": "",
        "additional_information": "",
        "weight_lbs": "",
        "length_in": "",
        "width_in": "",
        "height_in": "",
        "image_urls": [],
    }

    # ── SKU / MPN ──────────────────────────────────────────────────────────────
    sku_el = inner.find(class_="sku")
    if sku_el:
        result["mpn"] = sku_el.get_text(strip=True)

    # ── Description ────────────────────────────────────────────────────────────
    desc_tab = inner.find(id="tab-description")
    if desc_tab:
        # Remove the <h2>Description</h2> heading itself
        h2 = desc_tab.find("h2")
        if h2:
            h2.decompose()
        result["description"] = strip_html(str(desc_tab))

    # ── Additional Information (weight / dimensions) ────────────────────────────
    attrs_table = inner.find("table", class_="woocommerce-product-attributes")
    if attrs_table:
        rows: dict[str, str] = {}
        for row in attrs_table.find_all("tr"):
            label_el = row.find("th")
            value_el = row.find("td")
            if label_el and value_el:
                label = label_el.get_text(strip=True)
                value = value_el.get_text(strip=True)
                rows[label] = value

        weight_raw = rows.get("Weight", "")
        dims_raw = rows.get("Dimensions", "")

        parts = []
        if weight_raw:
            parts.append(f"Weight: {weight_raw}")
        if dims_raw:
            parts.append(f"Dimensions: {dims_raw}")
        result["additional_information"] = " | ".join(parts)

        # Parse numeric fields
        w_match = re.match(r"([\d.]+)", weight_raw)
        if w_match:
            result["weight_lbs"] = w_match.group(1)

        d_match = re.match(r"([\d.]+)\s*[×x]\s*([\d.]+)\s*[×x]\s*([\d.]+)", dims_raw)
        if d_match:
            result["length_in"] = d_match.group(1)
            result["width_in"] = d_match.group(2)
            result["height_in"] = d_match.group(3)

    # ── Gallery Images ─────────────────────────────────────────────────────────
    gallery = inner.find(class_="woocommerce-product-gallery")
    if gallery:
        seen: set[str] = set()
        for img in gallery.find_all("img"):
            # Prefer data-large_image, fall back to src
            raw_url = img.get("data-large_image") or img.get("src") or ""
            if not raw_url:
                continue
            full = full_size_url(raw_url)
            if full and full not in seen:
                seen.add(full)
                result["image_urls"].append(full)

    return result


# ── API helpers ────────────────────────────────────────────────────────────────

def fetch_all_product_listings(session: requests.Session) -> list[dict]:
    """
    Return all products in the Drywall category via the WP REST API.
    Each item has at least: id, link, title.rendered.
    """
    all_products: list[dict] = []
    page = 1
    while True:
        resp = session.get(
            f"{WP_API_BASE}/product",
            params={
                "product_cat": DRYWALL_CAT_ID,
                "per_page": PER_PAGE,
                "page": page,
                "_fields": "id,link,title,slug",
                "status": "publish",
            },
            headers=HEADERS,
            timeout=30,
        )
        resp.raise_for_status()
        batch = resp.json()
        if not batch:
            break
        all_products.extend(batch)
        total_pages = int(resp.headers.get("X-WP-TotalPages", 1))
        print(
            f"  API page {page}/{total_pages}: {len(batch)} products "
            f"(running total: {len(all_products)})"
        )
        if page >= total_pages:
            break
        page += 1
        time.sleep(REQUEST_DELAY)
    return all_products


def scrape_product_page(
    session: requests.Session,
    url: str,
) -> dict[str, Any] | None:
    """Fetch a single product page and extract all fields."""
    try:
        resp = session.get(url, headers=HEADERS, timeout=30)
        resp.raise_for_status()
    except requests.RequestException as exc:
        print(f"    WARNING: failed to fetch {url}: {exc}", file=sys.stderr)
        return None

    page_html = resp.text

    # Name from JSON-LD (already HTML-decoded, clean)
    name = extract_name_from_ld_json(page_html)
    if not name:
        # Fallback to <title>
        soup_main = BeautifulSoup(page_html, "html.parser")
        title_el = soup_main.find("title")
        if title_el:
            name = title_el.get_text(strip=True).split(" - ")[0].split(" | ")[0]

    # Parse the Porto template block
    inner = parse_template_html(page_html)
    if inner is None:
        print(f"    WARNING: could not find template block for {url}", file=sys.stderr)
        return None

    fields = extract_product_fields(inner)
    fields["name"] = name
    fields["url"] = url
    fields["source"] = "tapetech.com"
    return fields


# ── Main ───────────────────────────────────────────────────────────────────────

def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--force",
        action="store_true",
        help="Re-scrape products even if output files already exist",
    )
    parser.add_argument(
        "--delay",
        type=float,
        default=REQUEST_DELAY,
        help=f"Seconds between product page requests (default: {REQUEST_DELAY})",
    )
    args = parser.parse_args()

    OUT_DIR.mkdir(parents=True, exist_ok=True)

    session = requests.Session()
    session.headers.update(HEADERS)

    # ── Enumerate all drywall products ─────────────────────────────────────────
    print("Fetching product list from WP REST API …")
    listings = fetch_all_product_listings(session)
    total = len(listings)
    print(f"Found {total} products in the Drywall category.\n")

    # ── Build lookup of already-scraped URLs (resume support) ─────────────────
    existing: dict[str, dict] = {}
    if not args.force and OUT_JSON.exists():
        try:
            payload = json.loads(OUT_JSON.read_text(encoding="utf-8"))
            for p in payload.get("products", []):
                if p.get("url"):
                    existing[p["url"]] = p
            print(f"Resuming: {len(existing)} products already scraped.\n")
        except Exception:
            existing = {}

    # ── Scrape each product page ───────────────────────────────────────────────
    products: list[dict] = []
    for i, listing in enumerate(listings, 1):
        url = listing.get("link", "")
        if not url:
            continue

        if url in existing:
            products.append(existing[url])
            continue

        title = (
            listing.get("title", {}).get("rendered", listing.get("slug", url))
        )
        print(f"  [{i}/{total}] {title}")

        product = scrape_product_page(session, url)
        if product:
            products.append(product)
        else:
            # Store a minimal placeholder so we don't retry on resume
            products.append({
                "source": "tapetech.com",
                "name": title,
                "mpn": "",
                "description": "",
                "additional_information": "",
                "weight_lbs": "",
                "length_in": "",
                "width_in": "",
                "height_in": "",
                "image_urls": [],
                "url": url,
            })

        time.sleep(args.delay)

    print(f"\nScraped {len(products)} products.")

    # ── Write JSON ─────────────────────────────────────────────────────────────
    payload = {
        "catalog": "TapeTech Drywall Products",
        "source_url": "https://tapetech.com/product-category/drywall/",
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
        for p in products:
            row = dict(p)
            row["image_urls"] = " | ".join(row.get("image_urls") or [])
            writer.writerow(row)
    print(f"Wrote {OUT_CSV}")


if __name__ == "__main__":
    main()
