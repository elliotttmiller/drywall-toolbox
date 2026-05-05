#!/usr/bin/env python3
"""Search, download, and validate product images for all Level5 parts/components.

Reads products/scraped_results/Level5/level5_schematics_manifest.csv (508 unique
parts) and, for each part, executes a prioritised multi-source image search:

  Tier 1 — Level5 official site (https://www.level5tools.com)
  Tier 2 — Known distributors: ToolBarn, Amazon, eBay, Grainger
  Tier 3 — SerpAPI / Google Custom Search (requires --search-api-key)
  Tier 4 — Compatible hardware suppliers for generic fasteners (Fastenal, McMaster-Carr)

Every image is validated (≥100×100 px, >5 KB, real image content-type, no
placeholder URLs) and converted to WebP before saving.

Output layout
-------------
products/scraped_results/Level5/
  parts_images/
    {group-slug}/
      {part_number}__{slug-description}.webp
  level5_parts_images_manifest.csv
  level5_parts_images_manifest.json

Usage
-----
  python scripts/scrape_level5_parts_images.py            # full run
  python scripts/scrape_level5_parts_images.py --dry-run  # no downloads
  python scripts/scrape_level5_parts_images.py --part 7094
  python scripts/scrape_level5_parts_images.py --limit 20
  python scripts/scrape_level5_parts_images.py --search-api-key <SERPAPI_KEY>
"""

from __future__ import annotations

import argparse
import csv
import io
import json
import re
import time
from collections import defaultdict
from dataclasses import dataclass, field, asdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from urllib.parse import urlparse, urlencode, quote_plus

import requests
from bs4 import BeautifulSoup
from PIL import Image, UnidentifiedImageError
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry


# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------

REPO_ROOT = Path(__file__).resolve().parent.parent
OUTPUT_DIR = REPO_ROOT / "products" / "scraped_results" / "Level5"
PARTS_IMAGES_DIR = OUTPUT_DIR / "parts_images"
MANIFEST_CSV = OUTPUT_DIR / "level5_parts_images_manifest.csv"
MANIFEST_JSON = OUTPUT_DIR / "level5_parts_images_manifest.json"
SOURCE_CSV = OUTPUT_DIR / "level5_schematics_manifest.csv"

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

BRAND = "Level5"
TIMEOUT = 30
DOMAIN_DELAY = 1.5          # seconds between requests to the same host
BACKOFF_ON_RATE_LIMIT = 10  # seconds to wait on 429 / 503
MAX_RATE_LIMIT_RETRIES = 3
MIN_IMAGE_BYTES = 5_120     # 5 KB
MIN_IMAGE_DIM = 100         # px in both dimensions
PLACEHOLDER_URL_KEYWORDS = {"placeholder", "no-image", "noimage", "default", "logo", "blank"}

ALLOWED_IMAGE_CONTENT_TYPES = {
    "image/jpeg", "image/jpg", "image/png", "image/webp",
    "image/gif", "image/avif",
}

CSV_FIELDNAMES = [
    "part_number",
    "description",
    "group_name",
    "group_slug",
    "image_confidence",
    "image_source_site",
    "image_source_url",
    "image_local_path",
    "image_width_px",
    "image_height_px",
    "searched_at_utc",
]

# Generic hardware keywords that trigger Tier 4 search
FASTENER_KEYWORDS = frozenset([
    "screw", "bolt", "nut", "washer", "pin", "cotter", "spring",
    "o-ring", "oring", "clip", "rivet", "anchor", "bushing",
])

# ---------------------------------------------------------------------------
# Data structures
# ---------------------------------------------------------------------------


@dataclass
class PartRecord:
    part_number: str
    description: str
    group_name: str
    group_slug: str


@dataclass
class ImageResult:
    image_confidence: str          # exact_brand | compatible | fallback | not_found
    image_source_site: str
    image_source_url: str
    image_local_path: str
    image_width_px: int
    image_height_px: int
    searched_at_utc: str


EMPTY_RESULT = ImageResult(
    image_confidence="not_found",
    image_source_site="",
    image_source_url="",
    image_local_path="",
    image_width_px=0,
    image_height_px=0,
    searched_at_utc="",
)

# ---------------------------------------------------------------------------
# HTTP session with retry
# ---------------------------------------------------------------------------

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/124.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.5",
}


def make_session() -> requests.Session:
    session = requests.Session()
    retry = Retry(
        total=3,
        backoff_factor=1.5,
        status_forcelist={500, 502, 503, 504},
        allowed_methods={"GET", "HEAD"},
        raise_on_status=False,
    )
    adapter = HTTPAdapter(max_retries=retry)
    session.mount("https://", adapter)
    session.mount("http://", adapter)
    session.headers.update(HEADERS)
    return session


# ---------------------------------------------------------------------------
# Utility helpers
# ---------------------------------------------------------------------------


def clean_text(value: str) -> str:
    return re.sub(r"\s+", " ", (value or "")).strip()


def slugify(value: str) -> str:
    value = clean_text(value).lower()
    value = re.sub(r"[^a-z0-9]+", "-", value)
    return value.strip("-")


def utc_now() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def hostname(url: str) -> str:
    try:
        return urlparse(url).hostname or url
    except Exception:
        return url


def is_placeholder_url(url: str) -> bool:
    url_lower = url.lower()
    return any(kw in url_lower for kw in PLACEHOLDER_URL_KEYWORDS)


def is_fastener(description: str) -> bool:
    desc_lower = description.lower()
    return any(kw in desc_lower for kw in FASTENER_KEYWORDS)


def extract_fastenal_number(description: str) -> str | None:
    """Return a Fastenal part number like '74268' if present in description."""
    match = re.search(r"fastenal\s+(\d{4,8})", description, re.IGNORECASE)
    if match:
        return match.group(1)
    return None


# ---------------------------------------------------------------------------
# Per-domain rate limiting
# ---------------------------------------------------------------------------

_last_request: dict[str, float] = {}


def throttle(url: str, delay: float = DOMAIN_DELAY) -> None:
    host = hostname(url)
    last = _last_request.get(host, 0.0)
    elapsed = time.monotonic() - last
    if elapsed < delay:
        time.sleep(delay - elapsed)
    _last_request[host] = time.monotonic()


def get_with_backoff(
    session: requests.Session,
    url: str,
    *,
    delay: float = DOMAIN_DELAY,
    stream: bool = False,
    extra_headers: dict[str, str] | None = None,
) -> requests.Response | None:
    """GET url with domain throttle and 429/503 backoff. Returns None on failure."""
    headers = dict(extra_headers) if extra_headers else {}
    for attempt in range(MAX_RATE_LIMIT_RETRIES + 1):
        throttle(url, delay)
        try:
            resp = session.get(url, timeout=TIMEOUT, stream=stream, headers=headers)
        except requests.RequestException:
            return None

        if resp.status_code in (429, 503):
            if attempt < MAX_RATE_LIMIT_RETRIES:
                time.sleep(BACKOFF_ON_RATE_LIMIT * (attempt + 1))
                continue
            return None

        if resp.status_code == 200:
            return resp

        # Any other non-200 → give up immediately
        return None

    return None


# ---------------------------------------------------------------------------
# Image download + validation
# ---------------------------------------------------------------------------


def download_and_validate_image(
    session: requests.Session,
    url: str,
    dest: Path,
    dry_run: bool = False,
) -> tuple[int, int] | None:
    """Download image at *url*, validate it, convert to WebP, save to *dest*.

    Returns (width_px, height_px) on success, None on failure.
    Does not write any file when dry_run=True.
    """
    if is_placeholder_url(url):
        return None

    resp = get_with_backoff(session, url, stream=True)
    if resp is None:
        return None

    content_type = resp.headers.get("Content-Type", "").split(";")[0].strip().lower()
    if content_type not in ALLOWED_IMAGE_CONTENT_TYPES and not content_type.startswith("image/"):
        return None

    raw = resp.content
    if len(raw) < MIN_IMAGE_BYTES:
        return None

    try:
        img = Image.open(io.BytesIO(raw))
        img.verify()
        img = Image.open(io.BytesIO(raw))  # reopen after verify()
    except (UnidentifiedImageError, Exception):
        return None

    w, h = img.size
    if w < MIN_IMAGE_DIM or h < MIN_IMAGE_DIM:
        return None

    if dry_run:
        return w, h

    dest.parent.mkdir(parents=True, exist_ok=True)
    img = img.convert("RGBA") if img.mode in ("P", "RGBA") else img.convert("RGB")
    img.save(str(dest), "WEBP", quality=85)
    return w, h


# ---------------------------------------------------------------------------
# Tier 1 — Level5 official site
# ---------------------------------------------------------------------------


def _extract_level5_product_image(soup: BeautifulSoup) -> str | None:
    """Return first product image URL from a level5tools.com page."""
    # WooCommerce product gallery
    for selector in [
        ".woocommerce-product-gallery img",
        ".product__thumbnail img",
        ".wp-post-image",
        "article.product img",
        ".entry-summary img",
    ]:
        tag = soup.select_one(selector)
        if tag:
            src = tag.get("data-large_image") or tag.get("data-src") or tag.get("src")
            if src and src.startswith("http"):
                return src
    return None


def search_level5_official(
    session: requests.Session,
    part: PartRecord,
) -> str | None:
    """Try Level5 official site. Returns image URL or None."""
    # Strategy A: direct product slug URL
    slug = slugify(part.part_number)
    for url in [
        f"https://www.level5tools.com/product/{slug}/",
        f"https://www.level5tools.com/product/{part.part_number}/",
    ]:
        resp = get_with_backoff(session, url)
        if resp is None:
            continue
        soup = BeautifulSoup(resp.text, "html.parser")
        img_url = _extract_level5_product_image(soup)
        if img_url:
            return img_url

    # Strategy B: site search
    search_url = f"https://www.level5tools.com/?s={quote_plus(part.part_number)}&post_type=product"
    resp = get_with_backoff(session, search_url)
    if resp is None:
        return None
    soup = BeautifulSoup(resp.text, "html.parser")

    # Find first result link and follow it
    product_link = soup.select_one("ul.products li.product a.woocommerce-loop-product__link")
    if product_link:
        product_url = product_link.get("href")
        if product_url and product_url.startswith("http"):
            resp2 = get_with_backoff(session, product_url)
            if resp2:
                soup2 = BeautifulSoup(resp2.text, "html.parser")
                img_url = _extract_level5_product_image(soup2)
                if img_url:
                    return img_url

    # Also try inline search result thumbnails
    for img_tag in soup.select("ul.products li.product img"):
        src = img_tag.get("data-src") or img_tag.get("src")
        if src and src.startswith("http") and not is_placeholder_url(src):
            return src

    return None


# ---------------------------------------------------------------------------
# Tier 2 — Distributor searches
# ---------------------------------------------------------------------------


def _first_image_from_page(
    soup: BeautifulSoup,
    selectors: list[str],
    title_hint: str = "",
) -> tuple[str | None, bool]:
    """Return (img_url, level5_in_title) for first matching selector."""
    for sel in selectors:
        for tag in soup.select(sel):
            src = (
                tag.get("data-lazy-src")
                or tag.get("data-src")
                or tag.get("src")
                or ""
            )
            if src.startswith("http") and not is_placeholder_url(src):
                return src, False
    # fallback: scan all product-like images
    for img in soup.find_all("img", src=True):
        src = img.get("src", "")
        if src.startswith("http") and not is_placeholder_url(src):
            alt = (img.get("alt") or "").lower()
            if title_hint.lower() in alt:
                return src, "level5" in alt or "level 5" in alt
    return None, False


def search_toolbarn(session: requests.Session, part: PartRecord) -> tuple[str | None, str]:
    url = f"https://www.toolbarn.com/search/?q={quote_plus(part.part_number)}"
    resp = get_with_backoff(session, url)
    if resp is None:
        return None, ""
    soup = BeautifulSoup(resp.text, "html.parser")

    selectors = [
        ".product-item img",
        ".search-results img",
        ".product-listing img",
        "article.product img",
    ]
    img_url, _ = _first_image_from_page(soup, selectors, part.description)
    if not img_url:
        return None, ""

    # Check if any result title mentions Level5
    titles = " ".join(t.get_text() for t in soup.select(".product-item .product-title, .product-name"))
    confidence = "exact_brand" if "level5" in titles.lower() or "level 5" in titles.lower() else "compatible"
    return img_url, confidence


def search_amazon(session: requests.Session, part: PartRecord) -> tuple[str | None, str]:
    query = f"Level5 {part.part_number} {part.description}"
    url = f"https://www.amazon.com/s?{urlencode({'k': query})}"
    resp = get_with_backoff(session, url, extra_headers={"Accept-Encoding": "gzip"})
    if resp is None:
        return None, ""
    soup = BeautifulSoup(resp.text, "html.parser")

    selectors = [
        "[data-component-type='s-search-result'] img.s-image",
        ".s-result-item img",
    ]
    img_url, _ = _first_image_from_page(soup, selectors, part.description)
    if not img_url:
        return None, ""

    titles = " ".join(t.get_text() for t in soup.select(".a-size-base-plus, .a-size-medium, h2.a-size-mini"))
    confidence = "exact_brand" if "level5" in titles.lower() or "level 5" in titles.lower() else "compatible"
    return img_url, confidence


def search_ebay(session: requests.Session, part: PartRecord) -> tuple[str | None, str]:
    query = f"Level5 {part.part_number}"
    url = f"https://www.ebay.com/sch/i.html?{urlencode({'_nkw': query})}"
    resp = get_with_backoff(session, url)
    if resp is None:
        return None, ""
    soup = BeautifulSoup(resp.text, "html.parser")

    selectors = [
        ".s-item__image img",
        ".srp-results img",
    ]
    img_url, _ = _first_image_from_page(soup, selectors, part.description)
    if not img_url:
        return None, ""

    titles = " ".join(t.get_text() for t in soup.select(".s-item__title"))
    confidence = "exact_brand" if "level5" in titles.lower() or "level 5" in titles.lower() else "compatible"
    return img_url, confidence


def search_grainger(session: requests.Session, part: PartRecord) -> tuple[str | None, str]:
    url = f"https://www.grainger.com/search?{urlencode({'searchQuery': part.part_number})}"
    resp = get_with_backoff(session, url)
    if resp is None:
        return None, ""
    soup = BeautifulSoup(resp.text, "html.parser")

    selectors = [
        ".product-search-result img",
        "[data-testid='product-image'] img",
        ".SearchResults img",
    ]
    img_url, _ = _first_image_from_page(soup, selectors, part.description)
    if not img_url:
        return None, ""

    titles = " ".join(t.get_text() for t in soup.select(".product-description, .product-title, h3"))
    confidence = "exact_brand" if "level5" in titles.lower() or "level 5" in titles.lower() else "compatible"
    return img_url, confidence


DISTRIBUTOR_SEARCHERS = [
    ("toolbarn.com", search_toolbarn),
    ("amazon.com", search_amazon),
    ("ebay.com", search_ebay),
    ("grainger.com", search_grainger),
]


def search_distributors(
    session: requests.Session,
    part: PartRecord,
) -> tuple[str | None, str, str]:
    """Returns (img_url, confidence, site) or (None, '', '') if nothing found."""
    for site, fn in DISTRIBUTOR_SEARCHERS:
        try:
            img_url, confidence = fn(session, part)
        except Exception:
            continue
        if img_url:
            return img_url, confidence, site
    return None, "", ""


# ---------------------------------------------------------------------------
# Tier 3 — SerpAPI / Google CSE
# ---------------------------------------------------------------------------


def search_serpapi(
    session: requests.Session,
    part: PartRecord,
    api_key: str,
) -> str | None:
    """Use SerpAPI Google search to find an image URL."""
    # Primary query: brand + part number + description scoped to known sites
    queries = [
        f'"Level5" "{part.part_number}" "{part.description}" site:level5tools.com OR site:toolbarn.com',
        f'"{part.description}" drywall tool replacement part',
    ]
    for q in queries:
        params = {
            "q": q,
            "tbm": "isch",          # image search
            "api_key": api_key,
            "num": "5",
        }
        url = f"https://serpapi.com/search?{urlencode(params)}"
        resp = get_with_backoff(session, url, delay=0.5)
        if resp is None:
            continue
        try:
            data = resp.json()
        except Exception:
            continue
        for result in data.get("images_results", []):
            img_url = result.get("original") or result.get("thumbnail")
            if img_url and not is_placeholder_url(img_url):
                return img_url
    return None


def search_google_cse(
    session: requests.Session,
    part: PartRecord,
    api_key: str,
    cx: str | None = None,
) -> str | None:
    """Use Google Custom Search API to find an image URL.
    Falls back to SerpAPI-style if cx is not provided.
    """
    if cx is None:
        return None
    queries = [
        f'"Level5" "{part.part_number}" {part.description}',
        f'{part.description} drywall replacement part Level5',
    ]
    for q in queries:
        params = {
            "q": q,
            "searchType": "image",
            "key": api_key,
            "cx": cx,
            "num": "5",
        }
        url = f"https://www.googleapis.com/customsearch/v1?{urlencode(params)}"
        resp = get_with_backoff(session, url, delay=0.3)
        if resp is None:
            continue
        try:
            data = resp.json()
        except Exception:
            continue
        for item in data.get("items", []):
            img_url = item.get("link")
            if img_url and not is_placeholder_url(img_url):
                return img_url
    return None


# ---------------------------------------------------------------------------
# Tier 4 — Compatible hardware (Fastenal / McMaster-Carr)
# ---------------------------------------------------------------------------


def search_fastenal(
    session: requests.Session,
    part: PartRecord,
    fastenal_pn: str | None,
) -> str | None:
    # Try by Fastenal part number first
    if fastenal_pn:
        url = f"https://www.fastenal.com/products/details/{fastenal_pn}"
        resp = get_with_backoff(session, url)
        if resp:
            soup = BeautifulSoup(resp.text, "html.parser")
            for sel in [".product-image img", ".pdp-image img", "#product-image img", "img.primary-image"]:
                tag = soup.select_one(sel)
                if tag:
                    src = tag.get("data-src") or tag.get("src")
                    if src and src.startswith("http") and not is_placeholder_url(src):
                        return src

    # Fallback: search by description
    query = re.sub(r"fastenal\s+\d+", "", part.description, flags=re.IGNORECASE).strip()
    url = f"https://www.fastenal.com/products?term={quote_plus(query)}"
    resp = get_with_backoff(session, url)
    if resp is None:
        return None
    soup = BeautifulSoup(resp.text, "html.parser")
    for sel in [".product-listing img", ".product-card img", ".product-image img"]:
        tag = soup.select_one(sel)
        if tag:
            src = tag.get("data-src") or tag.get("src")
            if src and src.startswith("http") and not is_placeholder_url(src):
                return src
    return None


def search_mcmaster(session: requests.Session, part: PartRecord) -> str | None:
    query = part.description
    # McMaster-Carr has a simple text search with image results in JSON
    url = f"https://www.mcmaster.com/api/product/search?q={quote_plus(query)}&page_size=5"
    resp = get_with_backoff(session, url)
    if resp is None:
        return None
    try:
        data = resp.json()
    except Exception:
        return None
    for result in data.get("results", []):
        img = result.get("image_url") or result.get("imageUrl")
        if img and not is_placeholder_url(img):
            if img.startswith("//"):
                img = "https:" + img
            return img
    return None


def search_compatible_hardware(
    session: requests.Session,
    part: PartRecord,
) -> tuple[str | None, str]:
    """Returns (img_url, site) for generic hardware parts. Empty strings if not found."""
    fastenal_pn = extract_fastenal_number(part.description)

    img_url = search_fastenal(session, part, fastenal_pn)
    if img_url:
        return img_url, "fastenal.com"

    img_url = search_mcmaster(session, part)
    if img_url:
        return img_url, "mcmaster.com"

    return None, ""


# ---------------------------------------------------------------------------
# Part image filename
# ---------------------------------------------------------------------------


def part_image_filename(part: PartRecord) -> str:
    slug_desc = slugify(part.description)[:60]
    return f"{part.part_number}__{slug_desc}.webp"


def part_image_path(part: PartRecord, images_dir: Path) -> Path:
    return images_dir / slugify(part.group_slug or part.group_name) / part_image_filename(part)


# ---------------------------------------------------------------------------
# Main search orchestration
# ---------------------------------------------------------------------------


def search_part(
    session: requests.Session,
    part: PartRecord,
    dest_path: Path,
    dry_run: bool,
    search_api_key: str | None,
    google_cx: str | None,
) -> ImageResult:
    """Run the full Tier 1→4 pipeline for one part. Returns an ImageResult."""
    now = utc_now()

    # Tier 1 — Level5 official
    print(f"  [T1] Level5 official: {part.part_number}")
    try:
        img_url = search_level5_official(session, part)
    except Exception as exc:
        print(f"       T1 error: {exc}")
        img_url = None

    if img_url:
        dims = download_and_validate_image(session, img_url, dest_path, dry_run)
        if dims:
            w, h = dims
            return ImageResult(
                image_confidence="exact_brand",
                image_source_site="level5tools.com",
                image_source_url=img_url,
                image_local_path=str(dest_path.relative_to(REPO_ROOT)) if not dry_run else "",
                image_width_px=w,
                image_height_px=h,
                searched_at_utc=now,
            )

    # Tier 2 — Distributors
    print(f"  [T2] Distributors: {part.part_number}")
    try:
        img_url, confidence, site = search_distributors(session, part)
    except Exception as exc:
        print(f"       T2 error: {exc}")
        img_url, confidence, site = None, "", ""

    if img_url:
        dims = download_and_validate_image(session, img_url, dest_path, dry_run)
        if dims:
            w, h = dims
            return ImageResult(
                image_confidence=confidence or "compatible",
                image_source_site=site,
                image_source_url=img_url,
                image_local_path=str(dest_path.relative_to(REPO_ROOT)) if not dry_run else "",
                image_width_px=w,
                image_height_px=h,
                searched_at_utc=now,
            )

    # Tier 3 — Search API
    if search_api_key:
        print(f"  [T3] Search API: {part.part_number}")
        try:
            img_url = search_serpapi(session, part, search_api_key)
            if img_url is None:
                img_url = search_google_cse(session, part, search_api_key, google_cx)
        except Exception as exc:
            print(f"       T3 error: {exc}")
            img_url = None

        if img_url:
            dims = download_and_validate_image(session, img_url, dest_path, dry_run)
            if dims:
                w, h = dims
                return ImageResult(
                    image_confidence="fallback",
                    image_source_site=hostname(img_url),
                    image_source_url=img_url,
                    image_local_path=str(dest_path.relative_to(REPO_ROOT)) if not dry_run else "",
                    image_width_px=w,
                    image_height_px=h,
                    searched_at_utc=now,
                )

    # Tier 4 — Compatible hardware suppliers (fasteners only)
    if is_fastener(part.description):
        print(f"  [T4] Compatible hardware: {part.part_number}")
        try:
            img_url, site = search_compatible_hardware(session, part)
        except Exception as exc:
            print(f"       T4 error: {exc}")
            img_url, site = None, ""

        if img_url:
            dims = download_and_validate_image(session, img_url, dest_path, dry_run)
            if dims:
                w, h = dims
                return ImageResult(
                    image_confidence="compatible",
                    image_source_site=site,
                    image_source_url=img_url,
                    image_local_path=str(dest_path.relative_to(REPO_ROOT)) if not dry_run else "",
                    image_width_px=w,
                    image_height_px=h,
                    searched_at_utc=now,
                )

    print(f"  [--] Not found: {part.part_number}")
    return ImageResult(
        image_confidence="not_found",
        image_source_site="",
        image_source_url="",
        image_local_path="",
        image_width_px=0,
        image_height_px=0,
        searched_at_utc=now,
    )


# ---------------------------------------------------------------------------
# Data ingestion
# ---------------------------------------------------------------------------


def load_parts(csv_path: Path) -> list[PartRecord]:
    """Load unique (part_number, description, group_name, group_slug) from CSV."""
    seen: set[str] = set()
    parts: list[PartRecord] = []
    with csv_path.open(newline="", encoding="utf-8") as fh:
        for row in csv.DictReader(fh):
            key = row["part_number"].strip()
            if not key or key in seen:
                continue
            seen.add(key)
            parts.append(
                PartRecord(
                    part_number=key,
                    description=clean_text(row.get("description", "")),
                    group_name=clean_text(row.get("group_name", "")),
                    group_slug=clean_text(row.get("group_slug", "")),
                )
            )
    return parts


def load_existing_manifest(json_path: Path) -> dict[str, dict[str, Any]]:
    """Return {part_number: result_dict} for parts already resolved."""
    if not json_path.exists():
        return {}
    try:
        with json_path.open(encoding="utf-8") as fh:
            data = json.load(fh)
        results: dict[str, dict[str, Any]] = {}
        for item in data.get("parts", []):
            pn = item.get("part_number", "")
            confidence = item.get("image_confidence", "not_found")
            # Only re-use resolved entries (skip not_found so they get retried)
            if pn and confidence not in ("not_found", ""):
                results[pn] = item
        return results
    except Exception:
        return {}


# ---------------------------------------------------------------------------
# Manifest writers
# ---------------------------------------------------------------------------


def write_manifests(
    parts: list[PartRecord],
    results: dict[str, ImageResult],
    csv_path: Path,
    json_path: Path,
) -> None:
    rows = []
    for part in parts:
        res = results.get(part.part_number, EMPTY_RESULT)
        rows.append({
            "part_number": part.part_number,
            "description": part.description,
            "group_name": part.group_name,
            "group_slug": part.group_slug,
            "image_confidence": res.image_confidence,
            "image_source_site": res.image_source_site,
            "image_source_url": res.image_source_url,
            "image_local_path": res.image_local_path,
            "image_width_px": res.image_width_px,
            "image_height_px": res.image_height_px,
            "searched_at_utc": res.searched_at_utc,
        })

    csv_path.parent.mkdir(parents=True, exist_ok=True)
    with csv_path.open("w", newline="", encoding="utf-8") as fh:
        writer = csv.DictWriter(fh, fieldnames=CSV_FIELDNAMES)
        writer.writeheader()
        writer.writerows(rows)

    manifest = {
        "brand": BRAND,
        "generated_at_utc": utc_now(),
        "total_parts": len(parts),
        "exact_brand": sum(1 for r in results.values() if r.image_confidence == "exact_brand"),
        "compatible": sum(1 for r in results.values() if r.image_confidence == "compatible"),
        "fallback": sum(1 for r in results.values() if r.image_confidence == "fallback"),
        "not_found": sum(1 for r in results.values() if r.image_confidence == "not_found"),
        "parts": rows,
    }
    with json_path.open("w", encoding="utf-8", newline="\n") as fh:
        json.dump(manifest, fh, indent=2, ensure_ascii=False)
        fh.write("\n")


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------


def build_arg_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(
        description="Search and download Level5 replacement part images.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    p.add_argument(
        "--dry-run",
        action="store_true",
        help="Print search decisions without downloading or writing files.",
    )
    p.add_argument(
        "--part",
        metavar="PART_NUMBER",
        help="Process only this one part number (for debugging).",
    )
    p.add_argument(
        "--limit",
        type=int,
        metavar="N",
        help="Process at most N parts.",
    )
    p.add_argument(
        "--search-api-key",
        metavar="KEY",
        default=None,
        help="SerpAPI or Google Custom Search API key for Tier 3 fallback.",
    )
    p.add_argument(
        "--google-cx",
        metavar="CX",
        default=None,
        help="Google Custom Search Engine ID (cx). Required when using Google CSE key.",
    )
    p.add_argument(
        "--domain-delay",
        type=float,
        default=DOMAIN_DELAY,
        metavar="SECONDS",
        help=f"Minimum seconds between requests to the same host (default: {DOMAIN_DELAY}).",
    )
    p.add_argument(
        "--output-dir",
        type=Path,
        default=OUTPUT_DIR,
        metavar="PATH",
        help="Override the output directory (default: products/scraped_results/Level5).",
    )
    p.add_argument(
        "--resume",
        action="store_true",
        default=True,
        help="Skip parts already resolved in a prior run (default: True).",
    )
    p.add_argument(
        "--no-resume",
        action="store_false",
        dest="resume",
        help="Re-process all parts even if a manifest already exists.",
    )
    return p


def main() -> None:
    args = build_arg_parser().parse_args()

    output_dir: Path = args.output_dir
    images_dir = output_dir / "parts_images"
    manifest_csv = output_dir / "level5_parts_images_manifest.csv"
    manifest_json = output_dir / "level5_parts_images_manifest.json"

    # Load parts
    all_parts = load_parts(SOURCE_CSV)
    print(f"Loaded {len(all_parts)} unique parts from {SOURCE_CSV}")

    # Filter by --part
    if args.part:
        all_parts = [p for p in all_parts if p.part_number == args.part]
        if not all_parts:
            print(f"Part number '{args.part}' not found in manifest.")
            return

    # Load existing resolved results for resume
    existing: dict[str, dict[str, Any]] = {}
    if args.resume:
        existing = load_existing_manifest(manifest_json)
        if existing:
            print(f"Resuming: {len(existing)} parts already resolved.")

    # Build work list (skip already-resolved unless --no-resume)
    work_parts = [p for p in all_parts if p.part_number not in existing]
    if args.limit:
        work_parts = work_parts[: args.limit]

    print(f"Parts to process: {len(work_parts)}")
    if args.dry_run:
        print("DRY RUN — no files will be written.\n")

    # Seed results from existing manifest
    results: dict[str, ImageResult] = {
        pn: ImageResult(
            image_confidence=d.get("image_confidence", "not_found"),
            image_source_site=d.get("image_source_site", ""),
            image_source_url=d.get("image_source_url", ""),
            image_local_path=d.get("image_local_path", ""),
            image_width_px=int(d.get("image_width_px") or 0),
            image_height_px=int(d.get("image_height_px") or 0),
            searched_at_utc=d.get("searched_at_utc", ""),
        )
        for pn, d in existing.items()
    }

    session = make_session()

    for idx, part in enumerate(work_parts, 1):
        print(f"\n[{idx}/{len(work_parts)}] {part.part_number} — {part.description}")
        dest = part_image_path(part, images_dir)

        result = search_part(
            session,
            part,
            dest,
            dry_run=args.dry_run,
            search_api_key=args.search_api_key,
            google_cx=args.google_cx,
        )
        results[part.part_number] = result

        # Persist manifests incrementally every 10 parts (so progress is not lost)
        if not args.dry_run and idx % 10 == 0:
            write_manifests(all_parts, results, manifest_csv, manifest_json)

    # Final write
    if not args.dry_run:
        write_manifests(all_parts, results, manifest_csv, manifest_json)
        print(f"\nManifest CSV : {manifest_csv}")
        print(f"Manifest JSON: {manifest_json}")

    # Summary
    confidence_counts: dict[str, int] = defaultdict(int)
    for r in results.values():
        confidence_counts[r.image_confidence] += 1

    summary = {
        "total_parts": len(all_parts),
        "processed_this_run": len(work_parts),
        "exact_brand": confidence_counts.get("exact_brand", 0),
        "compatible": confidence_counts.get("compatible", 0),
        "fallback": confidence_counts.get("fallback", 0),
        "not_found": confidence_counts.get("not_found", 0),
        "manifest_csv": str(manifest_csv),
        "manifest_json": str(manifest_json),
        "images_dir": str(images_dir),
    }
    print("\n" + json.dumps(summary, indent=2))


if __name__ == "__main__":
    main()
