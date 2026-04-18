#!/usr/bin/env python3
"""
TapeTech Website Scraper
=========================
Scrapes product data from specified categories at https://tapetech.com/product-category/drywall/

Categories scraped:
- Taping Tools
- Finishing Tools: Flat Joints
- Finishing Tools: Inside Corners
- Taping Knives & Trowels
- Continuous Flow System
- Cleaning & Maintenance
- Automatic Taping & Finishing Tool Sets
- Replacement Parts

Outputs:
  scraped_results/tapetech/wp-catalog.csv    - CSV catalog with all product data
  scraped_results/tapetech/products.json     - Full JSON product data
  scraped_results/tapetech/images/           - WebP images for each product

Usage
-----
  python scripts/scrape_tapetech.py
  python scripts/scrape_tapetech.py --dry-run        # preview, skip image downloads
  python scripts/scrape_tapetech.py --output-dir /path/to/output
  python scripts/scrape_tapetech.py --max-workers 4  # parallel requests
"""

from __future__ import annotations

import argparse
import csv
import io
import json
import re
import sys
import time
import traceback
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from typing import Dict, List, Optional, Set, Tuple
from urllib.parse import urljoin, urlparse

import requests
from bs4 import BeautifulSoup
from PIL import Image

# ── Configuration ─────────────────────────────────────────────────────────────

REPO_ROOT = Path(__file__).resolve().parent.parent
DEFAULT_OUTPUT_DIR = REPO_ROOT / "scripts" / "scraped_results" / "tapetech"

BASE_URL = "https://tapetech.com"

# Target categories: (slug_under_drywall, display_name)
# The slug maps to /product-category/drywall/<slug>/
# "Taping Knives & Trowels" is under /drywall/trowels/ on the site
CATEGORIES: List[Tuple[str, str]] = [
    ("taping-tools",                        "Taping Tools"),
    ("finishing-tools-flat-joints",         "Finishing Tools: Flat Joints"),
    ("finishing-tools-inside-corners",      "Finishing Tools: Inside Corners"),
    ("trowels",                             "Taping Knives & Trowels"),
    ("continuous-flow-system",              "Continuous Flow System"),
    ("cleaning-maintenance",                "Cleaning & Maintenance"),
    ("automatic-taping-finishing-tool-sets","Automatic Taping & Finishing Tool Sets"),
    ("replacement-parts",                   "Replacement Parts"),
]

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.5",
}

CSV_FIELDNAMES = [
    "Brands",
    "Name",
    "SKU",
    "MPN",
    "Description",
    "Additional Information",
    "Categories",
    "Weight (lbs)",
    "Length (in)",
    "Width (in)",
    "Height (in)",
    "Images",
]

REQUEST_DELAY = 0.3   # seconds between requests (per thread)
MAX_RETRIES = 3
REQUEST_TIMEOUT = 30

# ── ANSI helpers ──────────────────────────────────────────────────────────────

CYAN   = "\033[96m"
GREEN  = "\033[92m"
YELLOW = "\033[93m"
RED    = "\033[91m"
GREY   = "\033[90m"
RESET  = "\033[0m"
BOLD   = "\033[1m"


def step(msg: str) -> None:
    print(f"\n{CYAN}{BOLD}▶  {msg}{RESET}")


def ok(msg: str) -> None:
    print(f"   {GREEN}✔  {msg}{RESET}")


def warn(msg: str) -> None:
    print(f"   {YELLOW}⚠  {msg}{RESET}")


def info(msg: str) -> None:
    print(f"   {GREY}·  {msg}{RESET}")


def err(msg: str) -> None:
    print(f"   {RED}✖  {msg}{RESET}", file=sys.stderr)


# ── HTTP helpers ──────────────────────────────────────────────────────────────

def fetch(url: str, session: requests.Session, retries: int = MAX_RETRIES) -> Optional[requests.Response]:
    """Fetch URL with retry logic."""
    for attempt in range(retries):
        try:
            resp = session.get(url, timeout=REQUEST_TIMEOUT)
            if resp.status_code == 200:
                return resp
            if resp.status_code == 404:
                warn(f"404: {url}")
                return None
            warn(f"HTTP {resp.status_code} for {url} (attempt {attempt+1})")
        except requests.exceptions.RequestException as e:
            warn(f"Request error for {url}: {e} (attempt {attempt+1})")
        time.sleep(1.5 * (attempt + 1))
    err(f"Failed to fetch {url} after {retries} attempts")
    return None


def get_inner_html(resp: requests.Response) -> Optional[BeautifulSoup]:
    """
    TapeTech uses Porto theme. The main product/category content is embedded
    as a JSON-encoded HTML string inside a <script> tag within the #main div.
    This function extracts and parses that inner HTML.
    Falls back to the full page soup if the pattern isn't found.
    """
    outer_soup = BeautifulSoup(resp.text, "lxml")
    main_div = outer_soup.find("div", id="main") or outer_soup.find("main")
    if not main_div:
        return outer_soup

    script = main_div.find("script")
    if not script:
        return outer_soup

    raw = script.string or script.get_text()
    if not raw:
        return outer_soup

    try:
        html_content = json.loads(raw)
        return BeautifulSoup(html_content, "lxml")
    except (json.JSONDecodeError, ValueError):
        return outer_soup


# ── Category page scraping ────────────────────────────────────────────────────

def _has_next_page(outer_soup: BeautifulSoup) -> bool:
    """Check for a 'next page' link in the outer HTML pagination nav."""
    for nav in outer_soup.find_all("nav", class_=re.compile(r"woocommerce.*pagination")):
        if nav.find("a", class_=re.compile(r"\bnext\b")):
            return True
    return False


def _get_subcategory_urls(inner: BeautifulSoup) -> List[str]:
    """
    When a category page shows subcategories (not products), collect those URLs.
    """
    subcat_urls: Set[str] = set()
    for a in inner.find_all("a", href=True):
        href = a["href"]
        if "/product-category/" in href and "tapetech.com" in href:
            subcat_urls.add(href.rstrip("/") + "/")
    return sorted(subcat_urls)


def get_product_urls_from_category(
    category_slug: str,
    session: requests.Session,
) -> List[str]:
    """
    Retrieve all product URLs from a category page (handles pagination and
    parent categories that show subcategories instead of products directly).
    Returns a de-duplicated list of absolute product URLs.
    """
    base_cat_url = f"{BASE_URL}/product-category/drywall/{category_slug}/"
    product_urls: Set[str] = set()

    visited_cat_urls: Set[str] = set()

    def _scrape_paginated_url(base_url: str, depth: int = 0) -> None:
        """Scrape all pages of a single category URL and add products to product_urls."""
        if depth > 3:
            warn(f"Max subcategory depth reached for {base_url}")
            return

        page = 1
        while True:
            url = base_url if page == 1 else f"{base_url}page/{page}/"
            if url in visited_cat_urls:
                break
            visited_cat_urls.add(url)

            resp = fetch(url, session)
            if resp is None:
                break

            outer_soup = BeautifulSoup(resp.text, "lxml")
            inner = get_inner_html(resp)
            if inner is None:
                break

            # Extract product links from this page
            page_links: Set[str] = set()
            for a in inner.find_all("a", href=True):
                href = a["href"]
                if "/product/" in href and "tapetech.com" in href:
                    # Clean up URL (remove query strings like ?add-to-cart=...)
                    clean = href.split("?")[0].rstrip("/") + "/"
                    page_links.add(clean)

            if page == 1 and not page_links:
                # No products on page 1 — check if this is a parent category
                # showing subcategories instead
                subcats = _get_subcategory_urls(inner)
                if subcats:
                    info(f"  Parent category, found {len(subcats)} subcategories")
                    for subcat_url in subcats:
                        _scrape_paginated_url(subcat_url, depth + 1)
                break

            new_count = len(page_links - product_urls)
            product_urls.update(page_links)

            has_next = _has_next_page(outer_soup)
            info(f"  Page {page}: {len(page_links)} products ({new_count} new)")

            if not has_next:
                break
            page += 1
            time.sleep(REQUEST_DELAY)

    _scrape_paginated_url(base_cat_url)
    return sorted(product_urls)


# ── Product page scraping ─────────────────────────────────────────────────────

def _get_product_div_soup(resp: requests.Response) -> Optional[BeautifulSoup]:
    """
    Get the inner HTML soup for a product page.
    TapeTech products embed their content in a <script> inside a div#product-<id>.
    """
    outer_soup = BeautifulSoup(resp.text, "lxml")

    # Find div with id starting with "product-"
    for div in outer_soup.find_all("div", id=True):
        if div["id"].startswith("product-"):
            script = div.find("script")
            if script:
                raw = script.string or script.get_text()
                if raw:
                    try:
                        html_content = json.loads(raw)
                        return BeautifulSoup(html_content, "lxml")
                    except (json.JSONDecodeError, ValueError):
                        pass

    # Fallback: try the main #main approach
    return get_inner_html(resp)


def _extract_json_ld(resp_text: str) -> Dict:
    """Extract Schema.org Product JSON-LD from page HTML."""
    for match in re.finditer(
        r'application/ld\+json[^>]*>(.*?)</script>', resp_text, re.DOTALL
    ):
        try:
            data = json.loads(match.group(1).strip())
            if isinstance(data, dict) and data.get("@type") == "Product":
                return data
            # Handle @graph
            if isinstance(data, dict) and "@graph" in data:
                for item in data["@graph"]:
                    if isinstance(item, dict) and item.get("@type") == "Product":
                        return item
        except (json.JSONDecodeError, ValueError):
            continue
    return {}


def _clean_text(text: str) -> str:
    """Normalize whitespace in text."""
    return re.sub(r"\s+", " ", text).strip()


def _get_full_image_url(thumbnail_url: str) -> str:
    """
    TapeTech images are served at various sizes like -600x600.jpg or -300x300.jpg.
    Strip the size suffix to get the full-resolution version.
    """
    return re.sub(r"-\d+x\d+(\.[a-zA-Z]+)$", r"\1", thumbnail_url)


def scrape_product(
    url: str,
    session: requests.Session,
    category_name: str,
) -> Optional[Dict]:
    """
    Scrape a single product page and return a dict of product data.
    Returns None if scraping fails.
    """
    resp = fetch(url, session)
    if resp is None:
        return None

    inner = _get_product_div_soup(resp)
    json_ld = _extract_json_ld(resp.text)

    # ── Name ──────────────────────────────────────────────────────────────────
    name = ""
    if json_ld.get("name"):
        name = _clean_text(json_ld["name"])
    else:
        h1 = inner.find("h1", class_="product_title") if inner else None
        if not h1 and inner:
            h1 = inner.find("h1")
        if h1:
            name = _clean_text(h1.get_text())

    # ── SKU ───────────────────────────────────────────────────────────────────
    sku = ""
    if json_ld.get("sku"):
        sku = _clean_text(json_ld["sku"])
    elif inner:
        sku_el = inner.find(class_="sku")
        if sku_el:
            sku = _clean_text(sku_el.get_text())

    # ── MPN (often same as SKU for TapeTech, or found in attributes) ─────────
    mpn = json_ld.get("mpn", "") or sku

    # ── Description ───────────────────────────────────────────────────────────
    description = ""
    if json_ld.get("description"):
        description = _clean_text(json_ld["description"])
    elif inner:
        # Try tab description
        tab_desc = inner.find("div", id="tab-description")
        if not tab_desc:
            tab_desc = inner.find("div", class_="woocommerce-Tabs-panel--description")
        if not tab_desc:
            tab_desc = inner.find("div", class_="entry-content")
        if tab_desc:
            description = _clean_text(tab_desc.get_text())

        if not description:
            short_desc = inner.find(
                "div", class_="woocommerce-product-details__short-description"
            )
            if short_desc:
                description = _clean_text(short_desc.get_text())

    # ── Additional Information ────────────────────────────────────────────────
    additional_info_parts: List[str] = []
    weight = ""
    length = ""
    width = ""
    height = ""

    if inner:
        add_info_table = inner.find("table", class_="woocommerce-product-attributes")
        if add_info_table:
            for row in add_info_table.find_all("tr"):
                th = row.find("th")
                td = row.find("td")
                if th and td:
                    label = _clean_text(th.get_text())
                    value = _clean_text(td.get_text())
                    additional_info_parts.append(f"{label}: {value}")

                    label_lower = label.lower()
                    # Extract weight
                    if "weight" in label_lower:
                        weight_match = re.search(r"([\d.]+)", value)
                        if weight_match:
                            weight = weight_match.group(1)

                    # Extract dimensions (e.g., "Dimensions: 10 × 5 × 2 in")
                    elif "dimension" in label_lower or "size" in label_lower:
                        # Format might be "L × W × H in"
                        dims = re.findall(r"([\d.]+)", value)
                        if len(dims) >= 3:
                            length, width, height = dims[0], dims[1], dims[2]
                        elif len(dims) == 2:
                            length, width = dims[0], dims[1]

                    # Some products list dimensions separately
                    elif "length" in label_lower:
                        m = re.search(r"([\d.]+)", value)
                        if m:
                            length = m.group(1)
                    elif "width" in label_lower:
                        m = re.search(r"([\d.]+)", value)
                        if m:
                            width = m.group(1)
                    elif "height" in label_lower or "depth" in label_lower:
                        m = re.search(r"([\d.]+)", value)
                        if m:
                            height = m.group(1)

    additional_info = " | ".join(additional_info_parts)

    # ── Images ────────────────────────────────────────────────────────────────
    images: List[str] = []
    seen_images: Set[str] = set()

    # From JSON-LD
    if json_ld.get("image"):
        img_url = json_ld["image"]
        if isinstance(img_url, list):
            for u in img_url:
                full = _get_full_image_url(u)
                if full not in seen_images:
                    images.append(full)
                    seen_images.add(full)
        else:
            full = _get_full_image_url(img_url)
            if full not in seen_images:
                images.append(full)
                seen_images.add(full)

    # From inner HTML gallery
    if inner:
        gallery = inner.find("div", class_="woocommerce-product-gallery")
        if not gallery:
            gallery = inner.find("div", class_="product-images")
        if gallery:
            for img in gallery.find_all("img", src=True):
                src = img.get("src", "")
                # Also check data-large_image
                large = img.get("data-large_image", "") or img.get("data-src", "")
                for candidate in [large, src]:
                    if candidate and "wp-content" in candidate:
                        full = _get_full_image_url(candidate)
                        if full not in seen_images:
                            images.append(full)
                            seen_images.add(full)

        # Also check srcset for higher resolution
        if not images:
            for img in inner.find_all("img", src=True):
                src = img.get("src", "")
                if "wp-content" in src and "uploads" in src:
                    full = _get_full_image_url(src)
                    if full not in seen_images:
                        images.append(full)
                        seen_images.add(full)

    return {
        "Brands": "TapeTech",
        "Name": name,
        "SKU": sku,
        "MPN": mpn,
        "Description": description,
        "Additional Information": additional_info,
        "Categories": category_name,
        "Weight (lbs)": weight,
        "Length (in)": length,
        "Width (in)": width,
        "Height (in)": height,
        "Images": " | ".join(images),
        "_url": url,
        "_images_list": images,
    }


# ── Image downloading ─────────────────────────────────────────────────────────

def _sanitize_filename(name: str) -> str:
    """Create a safe filename from a product name or SKU."""
    safe = re.sub(r'[^\w\s-]', '', name.lower())
    safe = re.sub(r'[\s_-]+', '-', safe).strip('-')
    return safe[:80]


def download_image_as_webp(
    image_url: str,
    dest_path: Path,
    session: requests.Session,
    quality: int = 92,
) -> bool:
    """Download an image and save it as a high-quality WebP file."""
    try:
        resp = session.get(image_url, timeout=30, stream=True)
        if resp.status_code != 200:
            return False

        img_data = resp.content
        img = Image.open(io.BytesIO(img_data))

        # Convert to RGB if necessary (WebP doesn't support all modes)
        if img.mode in ("RGBA", "LA"):
            bg = Image.new("RGB", img.size, (255, 255, 255))
            if img.mode == "RGBA":
                bg.paste(img, mask=img.split()[3])
            else:
                bg.paste(img, mask=img.split()[1])
            img = bg
        elif img.mode != "RGB":
            img = img.convert("RGB")

        dest_path.parent.mkdir(parents=True, exist_ok=True)
        img.save(str(dest_path), "WEBP", quality=quality, method=6)
        return True

    except Exception as e:
        warn(f"Failed to download/convert {image_url}: {e}")
        return False


def download_product_images(
    product: Dict,
    images_dir: Path,
    session: requests.Session,
    dry_run: bool = False,
) -> List[str]:
    """
    Download all images for a product. Returns list of local WebP file paths (relative to output dir).
    """
    images = product.get("_images_list", [])
    if not images:
        return []

    sku = _sanitize_filename(product.get("SKU") or product.get("Name") or "unknown")
    local_paths: List[str] = []

    for idx, img_url in enumerate(images):
        # Extract original filename
        parsed = urlparse(img_url)
        orig_name = Path(parsed.path).name
        stem = Path(orig_name).stem
        # Name: {sku}_{idx+1}.webp or {sku}_{original_stem}.webp
        dest_name = f"{sku}_{idx+1:02d}.webp"
        dest_path = images_dir / dest_name

        if dry_run:
            local_paths.append(str(dest_path.relative_to(images_dir.parent.parent) if images_dir.parent.parent.exists() else dest_path))
            continue

        if dest_path.exists():
            local_paths.append(str(dest_name))
            continue

        success = download_image_as_webp(img_url, dest_path, session)
        if success:
            local_paths.append(str(dest_name))
        else:
            local_paths.append(img_url)  # fallback to original URL

    return local_paths


# ── Main scraping orchestration ───────────────────────────────────────────────

def scrape_all(
    output_dir: Path,
    dry_run: bool = False,
    max_workers: int = 3,
) -> List[Dict]:
    """
    Main entry point. Scrapes all configured categories and returns product list.
    """
    session = requests.Session()
    session.headers.update(HEADERS)

    images_dir = output_dir / "images"
    if not dry_run:
        images_dir.mkdir(parents=True, exist_ok=True)

    all_products: List[Dict] = []
    seen_skus: Set[str] = set()
    seen_urls: Set[str] = set()

    for category_slug, category_name in CATEGORIES:
        step(f"Category: {category_name}")

        # Get all product URLs for this category
        product_urls = get_product_urls_from_category(category_slug, session)
        ok(f"Found {len(product_urls)} product URLs")

        if not product_urls:
            warn("No products found, skipping category")
            continue

        # Scrape each product
        category_products: List[Dict] = []
        failed: List[str] = []

        for i, url in enumerate(product_urls, 1):
            if url in seen_urls:
                info(f"  [{i}/{len(product_urls)}] Skipping duplicate URL: {url}")
                continue

            seen_urls.add(url)
            info(f"  [{i}/{len(product_urls)}] Scraping: {url}")

            product = scrape_product(url, session, category_name)
            if product is None:
                failed.append(url)
                continue

            sku = product.get("SKU", "")
            if sku and sku in seen_skus:
                # Product appears in multiple categories — add this category
                for existing in all_products:
                    if existing.get("SKU") == sku:
                        existing["Categories"] = existing["Categories"] + " | " + category_name
                        break
                info(f"    SKU {sku} already seen, merged categories")
                continue

            if sku:
                seen_skus.add(sku)

            category_products.append(product)
            time.sleep(REQUEST_DELAY)

        # Download images for this category's products
        step(f"Downloading images for {category_name}")
        for product in category_products:
            local_paths = download_product_images(product, images_dir, session, dry_run)
            product["_local_images"] = local_paths

        all_products.extend(category_products)

        ok(f"Scraped {len(category_products)} products (failed: {len(failed)})")
        if failed:
            for f in failed[:5]:
                warn(f"  Failed: {f}")

    return all_products


# ── Output ────────────────────────────────────────────────────────────────────

def write_csv(products: List[Dict], output_path: Path) -> None:
    """Write product data to CSV."""
    output_path.parent.mkdir(parents=True, exist_ok=True)

    with open(output_path, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(
            f,
            fieldnames=CSV_FIELDNAMES,
            extrasaction="ignore",
            quoting=csv.QUOTE_ALL,
        )
        writer.writeheader()
        for product in products:
            row = {k: product.get(k, "") for k in CSV_FIELDNAMES}
            writer.writerow(row)

    ok(f"Wrote {len(products)} rows to {output_path}")


def write_json(products: List[Dict], output_path: Path) -> None:
    """Write full product data to JSON."""
    output_path.parent.mkdir(parents=True, exist_ok=True)

    # Clean internal fields before serializing
    clean_products = []
    for p in products:
        cp = {k: v for k, v in p.items() if not k.startswith("_")}
        cp["_images"] = p.get("_images_list", [])
        cp["_local_images"] = p.get("_local_images", [])
        cp["_url"] = p.get("_url", "")
        clean_products.append(cp)

    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(clean_products, f, indent=2, ensure_ascii=False)

    ok(f"Wrote {len(products)} products to {output_path}")


# ── Entry point ───────────────────────────────────────────────────────────────

def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Scrape TapeTech product catalog from tapetech.com"
    )
    parser.add_argument(
        "--output-dir",
        type=Path,
        default=DEFAULT_OUTPUT_DIR,
        help="Directory to write output files (default: scripts/scraped_results/tapetech/)",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Scrape product data but skip image downloads",
    )
    parser.add_argument(
        "--max-workers",
        type=int,
        default=1,
        help="Number of parallel worker threads (default: 1, sequential)",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    output_dir = args.output_dir

    step("TapeTech Product Catalog Scraper")
    info(f"Output directory: {output_dir}")
    info(f"Dry run: {args.dry_run}")
    info(f"Categories: {len(CATEGORIES)}")

    products = scrape_all(
        output_dir=output_dir,
        dry_run=args.dry_run,
        max_workers=args.max_workers,
    )

    step("Writing output files")
    write_csv(products, output_dir / "wp-catalog.csv")
    write_json(products, output_dir / "products.json")

    step("Summary")
    ok(f"Total products scraped: {len(products)}")
    cats_summary: Dict[str, int] = {}
    for p in products:
        cat = p.get("Categories", "Unknown")
        cats_summary[cat] = cats_summary.get(cat, 0) + 1
    for cat, count in cats_summary.items():
        info(f"  {cat}: {count}")

    if not args.dry_run:
        images_dir = output_dir / "images"
        webp_count = len(list(images_dir.glob("*.webp"))) if images_dir.exists() else 0
        ok(f"Total WebP images saved: {webp_count}")


if __name__ == "__main__":
    main()
