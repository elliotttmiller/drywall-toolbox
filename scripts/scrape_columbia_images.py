#!/usr/bin/env python3
"""
Columbia Taping Tools Product Image Scraper

Scrapes product images from prioritized sources:
1. TSWFast (tswfast.com)
2. Walltools (walltools.com)
3. All-Walls (all-walls.com) - fallback if reachable

Converts all images to WebP and saves under:
  frontend/public/brands/Columbia/Products/

Usage:
  python3 scripts/scrape_columbia_images.py
"""

import csv
import json
import re
import sys
import time
import logging
from pathlib import Path
from urllib.parse import urljoin, urlparse
from typing import Optional, Dict, List, Tuple

import requests
from bs4 import BeautifulSoup
from PIL import Image
from io import BytesIO
from thefuzz import fuzz

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

REPO_ROOT = Path(__file__).parent.parent
MISSING_CSV = REPO_ROOT / "scripts" / "columbia_missing_images.csv"
AUDIT_CSV = REPO_ROOT / "scripts" / "image_audit_report.csv"
OUTPUT_DIR = REPO_ROOT / "frontend" / "public" / "brands" / "Columbia" / "Products"
REPORT_JSON = REPO_ROOT / "scripts" / "columbia_scrape_report.json"

REQUEST_DELAY = 0.8  # seconds between requests (polite crawling)
REQUEST_TIMEOUT = 20
MAX_RETRIES = 3
WEBP_QUALITY = 90
FUZZY_MATCH_THRESHOLD = 80  # minimum fuzz score for near-match

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/120.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
}

S3_HEADERS = {
    **HEADERS,
    "Referer": "https://www.tswfast.com/",
}

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)],
)
log = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Utility helpers
# ---------------------------------------------------------------------------

def normalize_sku(sku: str) -> str:
    """
    Normalise a SKU for comparisons: uppercase, strip whitespace, collapse
    internal spaces/hyphens/dots to a single canonical form.
    """
    s = sku.strip().upper()
    s = re.sub(r"[\s]+", "-", s)   # spaces → hyphen
    s = re.sub(r"[.]", "-", s)     # dots → hyphen
    return s


def sku_to_filename(sku: str) -> str:
    """
    Convert a SKU to a safe WebP filename:
      - lowercase
      - spaces/dots → hyphens
      - strip leading/trailing hyphens
    """
    fn = sku.strip().lower()
    fn = re.sub(r"[\s.]+", "-", fn)
    fn = re.sub(r"[^a-z0-9\-]", "", fn)
    fn = fn.strip("-")
    return fn + ".webp"


def get_with_retry(
    session: requests.Session,
    url: str,
    headers: Optional[dict] = None,
    stream: bool = False,
) -> Optional[requests.Response]:
    """Fetch URL with retries; returns None on failure."""
    h = headers or HEADERS
    for attempt in range(MAX_RETRIES):
        try:
            resp = session.get(url, headers=h, timeout=REQUEST_TIMEOUT, stream=stream)
            if resp.status_code == 200:
                return resp
            if resp.status_code in (404, 403):
                return None  # no point retrying
            log.debug("HTTP %s for %s (attempt %d)", resp.status_code, url, attempt + 1)
        except requests.RequestException as exc:
            log.debug("Request error for %s (attempt %d): %s", url, attempt + 1, exc)
        time.sleep(REQUEST_DELAY * (attempt + 1))
    return None


def download_image(
    session: requests.Session,
    url: str,
    headers: Optional[dict] = None,
) -> Optional[bytes]:
    """Download an image; returns raw bytes or None."""
    resp = get_with_retry(session, url, headers=headers, stream=True)
    if resp is None:
        return None
    content_type = resp.headers.get("Content-Type", "")
    if "image" not in content_type and "octet" not in content_type:
        # Might be a redirect or error page
        raw = resp.content
        if len(raw) < 1000:
            return None
        return raw
    return resp.content


def bytes_to_webp(image_bytes: bytes, quality: int = WEBP_QUALITY) -> Optional[bytes]:
    """Convert raw image bytes to WebP bytes."""
    try:
        img = Image.open(BytesIO(image_bytes))
        if img.mode not in ("RGB", "RGBA"):
            img = img.convert("RGBA" if img.mode == "P" else "RGB")
        buf = BytesIO()
        img.save(buf, format="WEBP", quality=quality, method=6)
        return buf.getvalue()
    except Exception as exc:
        log.debug("WebP conversion failed: %s", exc)
        return None


def save_webp(webp_bytes: bytes, output_path: Path) -> bool:
    """Save WebP bytes to disk."""
    try:
        output_path.parent.mkdir(parents=True, exist_ok=True)
        output_path.write_bytes(webp_bytes)
        return True
    except Exception as exc:
        log.error("Failed to save %s: %s", output_path, exc)
        return False


# ---------------------------------------------------------------------------
# Load source data
# ---------------------------------------------------------------------------

def load_missing_skus() -> List[Dict]:
    """Load products from columbia_missing_images.csv."""
    rows = []
    with open(MISSING_CSV, newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            rows.append({
                "brand": row.get("Brands", "").strip(),
                "sku": row.get("SKU", "").strip(),
                "mpn": row.get("MPN", "").strip(),
                "name": row.get("Name", "").strip(),
            })
    return rows


def load_audit_filename_map() -> Dict[str, str]:
    """
    Returns dict: normalized_sku -> target_filename (from image_audit_report.csv).
    """
    mapping = {}
    with open(AUDIT_CSV, newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            sku = row.get("SKU", "").strip()
            notes = row.get("notes", "").strip()
            if sku and notes:
                mapping[normalize_sku(sku)] = notes
    return mapping


# ---------------------------------------------------------------------------
# TSWFast scraper
# ---------------------------------------------------------------------------

TSWFAST_BASE = "https://www.tswfast.com"
TSWFAST_COLUMBIA_CATEGORY = f"{TSWFAST_BASE}/category/brand_Columbia_Tools"


def scrape_tswfast_columbia(session: requests.Session) -> Dict[str, str]:
    """
    Scrape all Columbia products from TSWFast.
    Returns dict: normalized_sku -> image_url
    """
    catalog: Dict[str, str] = {}
    page = 1

    log.info("Scraping TSWFast Columbia category...")
    while True:
        url = f"{TSWFAST_COLUMBIA_CATEGORY}?page={page}"
        resp = get_with_retry(session, url)
        if resp is None:
            log.warning("TSWFast page %d: no response", page)
            break

        soup = BeautifulSoup(resp.text, "html.parser")
        products = soup.select(".cp-product, .cvg-tile")
        if not products:
            log.info("TSWFast: no products on page %d, stopping", page)
            break

        for prod in products:
            # SKU from data-code attribute
            sku = prod.get("data-code", "").strip()
            if not sku:
                # fallback: look for code span
                code_el = prod.select_one(".cvg-code span:last-child")
                if code_el:
                    sku = code_el.get_text().strip()

            if not sku:
                continue

            # Image URL
            img_el = prod.find("img", src=True)
            if not img_el:
                continue

            img_url = img_el["src"]
            if not img_url.startswith("http"):
                img_url = urljoin(TSWFAST_BASE, img_url)

            nsku = normalize_sku(sku)
            catalog[nsku] = img_url
            log.debug("TSWFast: %s -> %s", nsku, img_url)

        log.info("TSWFast page %d: %d products (cumulative: %d)", page, len(products), len(catalog))
        time.sleep(REQUEST_DELAY)

        # Check if there's a next page
        if len(products) < 20:
            # Likely last page
            break
        page += 1
        if page > 20:  # safety cap
            break

    log.info("TSWFast: total catalog size = %d", len(catalog))
    return catalog


def try_tswfast_direct(session: requests.Session, sku: str) -> Optional[str]:
    """
    Try to find an image directly on TSWFast S3 using the known URL pattern:
    https://s3.amazonaws.com/tswfastcomfiles/product/{SKU}_M.jpg
    """
    base_url = f"https://s3.amazonaws.com/tswfastcomfiles/product/{sku}_M.jpg"
    resp = get_with_retry(session, base_url, headers=S3_HEADERS)
    if resp and "image" in resp.headers.get("Content-Type", ""):
        return base_url
    return None


# ---------------------------------------------------------------------------
# Walltools scraper
# ---------------------------------------------------------------------------

WALLTOOLS_BASE = "https://walltools.com"
WALLTOOLS_COLUMBIA_URLS = [
    f"{WALLTOOLS_BASE}/columbia/",
    f"{WALLTOOLS_BASE}/automatic-taping-tools/taping-tool-parts-repair-kits-accessories/columbia-taping-tools-parts/",
]
BC_IMG_RE = re.compile(
    r"https://cdn11\.bigcommerce\.com/s-tircj30irf/images/stencil/"
    r"(?:\d+w|\d+x\d+)/products/(\d+)/(\d+)/([^\"'\s?]+\.(?:jpg|jpeg|png|gif))",
    re.I,
)


def _parse_walltools_catalog_page(html: str, base_url: str) -> List[Dict]:
    """Parse a Walltools category page and return product dicts."""
    soup = BeautifulSoup(html, "html.parser")
    products = []

    for card in soup.select("article.card"):
        link_el = card.find("a", href=True)
        if not link_el:
            continue
        product_url = link_el["href"]
        if not product_url.startswith("http"):
            product_url = urljoin(base_url, product_url)

        # Try to extract SKU from product name (e.g., "Columbia Foo Bar (SKU123)")
        name_el = card.find(class_="card-title")
        name = name_el.get_text().strip() if name_el else ""
        sku_from_name = _extract_sku_from_title(name)

        # Get thumbnail image (srcset or src)
        img_el = card.find("img")
        thumb_url = None
        if img_el:
            # srcset: pick highest resolution
            srcset = img_el.get("data-srcset", img_el.get("srcset", ""))
            if srcset:
                thumb_url = _best_srcset_url(srcset)
            if not thumb_url:
                thumb_url = img_el.get("data-src") or img_el.get("src")

        products.append({
            "product_url": product_url,
            "name": name,
            "sku_from_name": sku_from_name,
            "thumb_url": thumb_url,
        })

    return products


def _extract_sku_from_title(title: str) -> Optional[str]:
    """Extract SKU from a product title like 'Columbia Foo Bar (COLM-FB10)'."""
    # Look for parenthetical at the end of the title
    m = re.search(r"\(([A-Z0-9][A-Z0-9\-.\s]+)\)\s*$", title, re.I)
    if m:
        return m.group(1).strip()
    return None


def _best_srcset_url(srcset: str) -> Optional[str]:
    """Pick the highest-resolution URL from a srcset string."""
    best_url = None
    best_w = 0
    parts = srcset.split(",")
    for part in parts:
        part = part.strip()
        tokens = part.split()
        if not tokens:
            continue
        url = tokens[0]
        if len(tokens) >= 2:
            w_str = tokens[1].lower().rstrip("w")
            try:
                w = int(w_str)
            except ValueError:
                w = 0
        else:
            w = 0
        if w > best_w:
            best_w = w
            best_url = url
    return best_url


def _upgrade_bc_image_url(url: str, width: int = 1280) -> str:
    """Upgrade a BigCommerce image URL to a higher resolution."""
    # Replace the size portion (e.g., 80w, 500x659, 1280x1280) with {width}w
    upgraded = re.sub(
        r"(cdn11\.bigcommerce\.com/s-tircj30irf/images/stencil/)\d+[^/]*/",
        lambda m: f"{m.group(1)}{width}w/",
        url,
    )
    return upgraded


def scrape_walltools_product_page(
    session: requests.Session,
    url: str,
) -> Optional[Dict]:
    """
    Scrape a single Walltools product page.
    Returns dict with 'sku' and 'image_url', or None.
    """
    resp = get_with_retry(session, url)
    if resp is None:
        return None

    html = resp.text
    soup = BeautifulSoup(html, "html.parser")

    # SKU from BCData JSON blob
    sku = None
    bc_match = re.search(r'var BCData = ({.*?});', html, re.S)
    if bc_match:
        try:
            bc = json.loads(bc_match.group(1))
            sku = bc.get("product_attributes", {}).get("sku")
        except json.JSONDecodeError:
            pass

    # Fallback: og:url contains product slug with SKU sometimes
    if not sku:
        og_url_el = soup.find("meta", property="og:url")
        if og_url_el:
            slug = og_url_el.get("content", "").rstrip("/").split("/")[-1]
            # try to extract SKU from slug
            m = re.search(r"([A-Z]{2,}\d+[A-Z0-9\-]*)$", slug.upper())
            if m:
                sku = m.group(1)

    # Image: main product image in highest available resolution
    image_url = None
    # Try the OG image (often 386x513 - decent quality)
    og_img_el = soup.find("meta", property="og:image")
    if og_img_el:
        og_img = og_img_el.get("content", "")
        if og_img and "bigcommerce.com" in og_img:
            # Try to get 1280w version
            image_url = _upgrade_bc_image_url(og_img.split("?")[0])

    # Fallback: main product view image
    if not image_url:
        pv_img = soup.select_one(".productView-image img, .productView-img-container img")
        if pv_img:
            src = pv_img.get("src") or pv_img.get("data-src")
            if src:
                image_url = _upgrade_bc_image_url(src.split("?")[0])

    if sku and image_url:
        return {"sku": sku, "image_url": image_url}
    return None


def scrape_walltools_columbia(session: requests.Session) -> Dict[str, str]:
    """
    Scrape all Columbia products from Walltools.
    Returns dict: normalized_sku -> image_url
    """
    catalog: Dict[str, str] = {}

    for category_url in WALLTOOLS_COLUMBIA_URLS:
        log.info("Scraping Walltools category: %s", category_url)

        # Discover total pages
        resp = get_with_retry(session, category_url)
        if resp is None:
            log.warning("Cannot reach %s", category_url)
            continue

        soup = BeautifulSoup(resp.text, "html.parser")
        page_links = soup.select(".pagination-list a, .pagination a")
        page_nums = set()
        for a in page_links:
            m = re.search(r"page=(\d+)", a.get("href", ""))
            if m:
                page_nums.add(int(m.group(1)))
        max_page = max(page_nums) if page_nums else 1
        log.info("  Category has %d pages", max_page)

        # Collect all product URLs from all pages
        all_product_stubs: List[Dict] = []
        for page in range(1, max_page + 1):
            url = f"{category_url}?page={page}" if page > 1 else category_url
            resp = get_with_retry(session, url)
            if resp is None:
                log.warning("  Walltools page %d: no response", page)
                time.sleep(REQUEST_DELAY)
                continue

            stubs = _parse_walltools_catalog_page(resp.text, url)
            all_product_stubs.extend(stubs)
            log.info("  Page %d: %d products (total so far: %d)", page, len(stubs), len(all_product_stubs))
            time.sleep(REQUEST_DELAY)

        # Visit each product page to get SKU + full image
        log.info("  Fetching %d product pages...", len(all_product_stubs))
        for i, stub in enumerate(all_product_stubs):
            # Quick attempt: if we can get SKU from name and thumbnail
            sku_from_name = stub.get("sku_from_name")
            if sku_from_name and stub.get("thumb_url"):
                nsku = normalize_sku(sku_from_name)
                # Upgrade thumbnail to 1280w
                img_url = _upgrade_bc_image_url(
                    stub["thumb_url"].split("?")[0]
                )
                catalog[nsku] = img_url
                log.debug(
                    "  [name-extract] %s -> %s", nsku, img_url[:80]
                )
                continue

            # Full product page scrape for SKU
            product_url = stub["product_url"]
            result = scrape_walltools_product_page(session, product_url)
            if result:
                nsku = normalize_sku(result["sku"])
                catalog[nsku] = result["image_url"]
                log.debug(
                    "  [page-scrape] %s -> %s", nsku, result["image_url"][:80]
                )
            else:
                log.debug("  [page-scrape] no result for %s", product_url)

            if i % 10 == 9:
                log.info("  Progress: %d / %d product pages processed", i + 1, len(all_product_stubs))
            time.sleep(REQUEST_DELAY)

    log.info("Walltools: total catalog size = %d", len(catalog))
    return catalog


# ---------------------------------------------------------------------------
# Fuzzy matching
# ---------------------------------------------------------------------------

def find_best_match(
    sku: str,
    catalog: Dict[str, str],
) -> Optional[Tuple[str, str, int]]:
    """
    Find the best matching SKU in catalog using fuzzy matching.
    Returns (matched_sku, image_url, score) or None if no match above threshold.
    """
    nsku = normalize_sku(sku)

    # Exact match first
    if nsku in catalog:
        return nsku, catalog[nsku], 100

    # Fuzzy matching
    best_score = 0
    best_key = None
    for key in catalog:
        score = fuzz.ratio(nsku, key)
        if score > best_score:
            best_score = score
            best_key = key
        # Also try partial ratio for short SKUs
        pscore = fuzz.partial_ratio(nsku, key)
        if pscore > best_score and len(nsku) >= 4:
            best_score = pscore
            best_key = key

    if best_key and best_score >= FUZZY_MATCH_THRESHOLD:
        return best_key, catalog[best_key], best_score

    return None


# ---------------------------------------------------------------------------
# Main pipeline
# ---------------------------------------------------------------------------

def main():
    log.info("=" * 70)
    log.info("Columbia Taping Tools Product Image Scraper")
    log.info("=" * 70)

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    # Load data
    missing_products = load_missing_skus()
    audit_map = load_audit_filename_map()  # normalized_sku -> target_filename

    log.info("Loaded %d products needing images", len(missing_products))
    log.info("Loaded %d audit filename mappings", len(audit_map))

    # Check which already have images
    existing_webp = set(f.name for f in OUTPUT_DIR.glob("*.webp"))
    log.info("Existing WebP images in output directory: %d", len(existing_webp))

    # Determine target filename for each product
    def get_target_filename(sku: str) -> str:
        nsku = normalize_sku(sku)
        if nsku in audit_map:
            return audit_map[nsku]
        return sku_to_filename(sku)

    # Filter out products that already have an image
    to_process = []
    already_done = []
    for prod in missing_products:
        fn = get_target_filename(prod["sku"])
        if fn in existing_webp:
            already_done.append((prod["sku"], fn))
        else:
            to_process.append(prod)

    log.info("Already have images for %d products, need to find %d more",
             len(already_done), len(to_process))

    if not to_process:
        log.info("All images already present! Nothing to do.")
        return

    # Build session
    session = requests.Session()
    session.headers.update(HEADERS)

    # --- Phase 1: Scrape TSWFast Columbia catalog ---
    log.info("\n--- Phase 1: TSWFast ---")
    tsw_catalog = scrape_tswfast_columbia(session)

    # --- Phase 2: Scrape Walltools Columbia catalog ---
    log.info("\n--- Phase 2: Walltools ---")
    wt_catalog = scrape_walltools_columbia(session)

    # Merge catalogs (TSWFast has priority)
    merged_catalog: Dict[str, str] = {}
    merged_catalog.update(wt_catalog)   # lower priority
    merged_catalog.update(tsw_catalog)  # higher priority (overwrites Walltools)
    log.info("Merged catalog: %d unique SKUs", len(merged_catalog))

    # --- Phase 3: Match, download, convert ---
    log.info("\n--- Phase 3: Match & Download ---")

    report = {
        "total_products": len(missing_products),
        "already_done": len(already_done),
        "to_process": len(to_process),
        "tsw_catalog_size": len(tsw_catalog),
        "walltools_catalog_size": len(wt_catalog),
        "results": [],
    }

    success_count = 0
    failed_skus = []

    for i, prod in enumerate(to_process):
        sku = prod["sku"]
        target_fn = get_target_filename(sku)
        target_path = OUTPUT_DIR / target_fn
        nsku = normalize_sku(sku)

        log.info("[%d/%d] SKU: %s -> %s", i + 1, len(to_process), sku, target_fn)

        # Find image URL
        image_url = None
        source = None
        match_score = 0
        matched_sku = None

        # 1. Exact match in merged catalog
        if nsku in merged_catalog:
            image_url = merged_catalog[nsku]
            source = "tsw" if nsku in tsw_catalog else "walltools"
            match_score = 100
            matched_sku = nsku
        else:
            # 2. Fuzzy match
            match = find_best_match(sku, merged_catalog)
            if match:
                matched_sku, image_url, match_score = match
                source = "tsw" if matched_sku in tsw_catalog else "walltools"
                log.info("  Fuzzy match: %s (score=%d) via %s", matched_sku, match_score, source)

        # 3. TSWFast direct S3 URL fallback
        if image_url is None:
            direct_url = try_tswfast_direct(session, sku)
            if direct_url:
                image_url = direct_url
                source = "tsw_direct"
                match_score = 100
                matched_sku = nsku
                log.info("  TSWFast direct S3 hit: %s", sku)

        if image_url is None:
            log.warning("  No image found for SKU: %s", sku)
            failed_skus.append(sku)
            report["results"].append({
                "sku": sku,
                "status": "not_found",
                "target_file": target_fn,
            })
            continue

        # Download image
        img_headers = S3_HEADERS if "s3.amazonaws.com" in image_url else None
        img_bytes = download_image(session, image_url, headers=img_headers)
        if img_bytes is None:
            log.warning("  Failed to download: %s", image_url)
            failed_skus.append(sku)
            report["results"].append({
                "sku": sku,
                "status": "download_failed",
                "image_url": image_url,
                "target_file": target_fn,
            })
            time.sleep(REQUEST_DELAY)
            continue

        # Convert to WebP
        webp_bytes = bytes_to_webp(img_bytes)
        if webp_bytes is None:
            log.warning("  WebP conversion failed for: %s", image_url)
            failed_skus.append(sku)
            report["results"].append({
                "sku": sku,
                "status": "conversion_failed",
                "image_url": image_url,
                "target_file": target_fn,
            })
            time.sleep(REQUEST_DELAY)
            continue

        # Save
        if save_webp(webp_bytes, target_path):
            log.info("  ✓ Saved %s (%d bytes)", target_fn, len(webp_bytes))
            success_count += 1
            report["results"].append({
                "sku": sku,
                "status": "success",
                "source": source,
                "match_score": match_score,
                "matched_sku": matched_sku,
                "image_url": image_url,
                "target_file": target_fn,
                "size_bytes": len(webp_bytes),
            })
        else:
            failed_skus.append(sku)
            report["results"].append({
                "sku": sku,
                "status": "save_failed",
                "image_url": image_url,
                "target_file": target_fn,
            })

        time.sleep(REQUEST_DELAY)

    # --- Phase 4: Report ---
    report["success_count"] = success_count
    report["failed_count"] = len(failed_skus)
    report["failed_skus"] = failed_skus

    with open(REPORT_JSON, "w") as f:
        json.dump(report, f, indent=2)

    log.info("\n" + "=" * 70)
    log.info("SUMMARY")
    log.info("=" * 70)
    log.info("Total products in missing list:  %d", len(missing_products))
    log.info("Already had images:              %d", len(already_done))
    log.info("Processed this run:              %d", len(to_process))
    log.info("Successfully saved:              %d", success_count)
    log.info("Failed (no image found):         %d", len(failed_skus))
    log.info("Report saved to:                 %s", REPORT_JSON)

    if failed_skus:
        log.info("\nFailed SKUs:")
        for sku in failed_skus:
            log.info("  - %s", sku)


if __name__ == "__main__":
    main()
