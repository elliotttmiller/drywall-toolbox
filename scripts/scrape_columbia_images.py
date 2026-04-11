#!/usr/bin/env python3
"""
Columbia Taping Tools Product Image Scraper

Scrapes product images from prioritized sources:
1. TSWFast (tswfast.com)
2. Walltools (walltools.com)
3. All-Walls (all-walls.com) - fallback if reachable

For every product candidate a DUAL signal is evaluated:
  - SKU similarity   (normalised, prefix-stripped)
  - Name similarity  (token-sort, hardware-spec-aware)

A match is only accepted when BOTH signals together pass one of the
tiered acceptance rules.  Generic hardware parts (washers, screws,
bolts, nuts, pins …) additionally require exact spec token agreement to
avoid assigning an image for the wrong part size.

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
from urllib.parse import urljoin
from typing import Dict, List, Optional, Tuple

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
# Hardware-aware name matching helpers
# ---------------------------------------------------------------------------

# Keywords that flag a product as generic hardware where spec precision matters
_HARDWARE_KEYWORDS = re.compile(
    r"\b(washer|nut|bolt|screw|pin|rivet|roll\s*pin|o[\-\s]?ring|spring|bushing|seal|clip|gasket|door|retainer)\b",
    re.I,
)

# Extract measurement/thread tokens from a hardware name
# e.g. "8-32 x 1/4" → {"8-32", "1/4"}; "10 in." → {"10"}; "12 in." → {"12"}
_SPEC_TOKEN_RE = re.compile(
    r"(?:\d+[-/]\d+(?:[-/]\d+)?(?:[\"'])?)"   # fractions / thread specs: 10-24, 1/4, 1-1/4"
    r"|(?:\d+\.\d+[\"']?)"                      # decimals: 3.5"
    r"|(?:\d+[\"'])"                            # plain with inch mark: 10"
    r"|(?:\d+(?:\.\d+)?\s*(?:in\b|inch\b))",    # "10 in." / "12 in" / "3.5 inch"
    re.I,
)


def _normalize_mixed_fractions(text: str) -> str:
    """
    Normalise mixed-number fractions so that '1 1/4' and '1-1/4' compare equal.
    Converts patterns like "1 1/4" (whole-space-fraction) to "1-1/4".
    """
    return re.sub(r"(\d)\s+(\d+/\d+)", r"\1-\2", text)


def extract_spec_tokens(name: str) -> frozenset:
    """
    Return the set of normalised measurement/thread tokens in *name*.
    Strips trailing quote characters so that "1/4\"" and "1/4" compare equal.
    """
    normalized = _normalize_mixed_fractions(name)
    return frozenset(
        t.lower().rstrip("\"'") for t in _SPEC_TOKEN_RE.findall(normalized)
    )


def is_hardware(name: str) -> bool:
    return bool(_HARDWARE_KEYWORDS.search(name))


# ---------------------------------------------------------------------------
# Utility helpers
# ---------------------------------------------------------------------------

def normalize_sku(sku: str) -> str:
    """
    Normalise a SKU for comparisons: uppercase, collapse spaces/hyphens/dots.
    """
    s = sku.strip().upper()
    s = re.sub(r"[\s\-.]", "", s)
    return s


def sku_to_filename(sku: str) -> str:
    """Convert a SKU to a safe WebP filename (lowercase, dashes for separators)."""
    fn = sku.strip().lower()
    fn = re.sub(r"[\s.]+", "-", fn)
    fn = re.sub(r"[^a-z0-9\-]", "", fn)
    fn = fn.strip("-")
    return fn + ".webp"


def normalize_name(name: str) -> str:
    """
    Normalise a product name for comparison:
      - strip trailing parenthetical SKU  e.g. "(FA347)"
      - strip brand prefixes
      - lowercase, collapse whitespace
    """
    n = name.strip().lower()
    # remove trailing "(SKU)" or "(COLM-XXX)" common in title fields
    n = re.sub(r"\([^)]{1,30}\)\s*$", "", n)
    n = re.sub(r"^columbia\s+taping\s+tools\s+", "", n)
    n = re.sub(r"^columbia\s+", "", n)
    return re.sub(r"\s+", " ", n).strip()


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
                return None
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
    """Returns dict: normalized_sku → target_filename (from image_audit_report.csv)."""
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
# CatalogEntry and dual-signal matching
# ---------------------------------------------------------------------------

class CatalogEntry:
    """One product in a scraped source catalog."""
    __slots__ = ("source_sku", "norm_sku", "name", "norm_name",
                 "img_url", "source", "spec_tokens")

    def __init__(self, source_sku: str, name: str, img_url: str, source: str):
        self.source_sku = source_sku
        self.norm_sku = normalize_sku(source_sku)
        self.name = name
        self.norm_name = normalize_name(name)
        self.img_url = img_url
        self.source = source
        self.spec_tokens = extract_spec_tokens(name)

    def __repr__(self) -> str:
        return f"<CatalogEntry {self.source_sku!r} '{self.name[:40]}'>"


# Acceptance rules applied in order; first satisfied wins.
# (min_sku_score, min_name_score, min_combined, label)
_ACCEPT_RULES: List[Tuple[int, int, int, str]] = [
    # Both signals strongly agree → high confidence
    (90, 90,   0, "both_strong"),
    # Name is essentially identical (hardware exact-spec match included)
    ( 0, 97,   0, "name_near_exact"),
    # SKU is an exact match (after prefix/normalisation) → name just needs to be
    # topically related (not completely different product)
    (100, 50,  0, "sku_exact"),
    # SKU is near-identical AND name is reasonable
    (92, 65,   0, "sku_near_exact"),
    # Solid agreement on both axes (combined ≥ 165 out of 200)
    (70, 82, 165, "combined_high"),
]


def _sku_sim(our_norm: str, entry: CatalogEntry) -> int:
    """
    SKU similarity between our normalised SKU and a catalog entry.
    Tries multiple representations:
      1. Direct comparison (our_norm vs entry.norm_sku)
      2. Strip common brand prefixes from the catalog side (CTT, COLM)
         before comparing — handles "CTTFFB17" vs our "FFB17".
    """
    direct = fuzz.ratio(our_norm, entry.norm_sku)
    # Strip known source prefixes
    stripped = re.sub(r"^(CTT|COLM)", "", entry.norm_sku)
    via_strip = fuzz.ratio(our_norm, stripped)
    return max(direct, via_strip)


def _name_sim(our_norm_name: str, entry: CatalogEntry) -> int:
    """
    Name similarity using token_sort_ratio (handles word-order differences).
    For hardware parts, also validates that *all* measurement/spec tokens
    in our name are present in the candidate — prevents matching "8-32 x 1/4"
    to "8-32 x 1/2" at high score.
    """
    base_score = fuzz.token_sort_ratio(our_norm_name, entry.norm_name)

    # If either side is hardware, enforce exact spec-token agreement
    if is_hardware(our_norm_name) or is_hardware(entry.norm_name):
        our_specs = extract_spec_tokens(our_norm_name)
        if our_specs and not our_specs.issubset(entry.spec_tokens):
            # Spec mismatch — hard-cap at 60 so no rule fires
            return min(base_score, 60)

    return base_score


def dual_signal_match(
    our_sku: str,
    our_name: str,
    catalog: List[CatalogEntry],
) -> Optional[Tuple[CatalogEntry, int, int, str]]:
    """
    Find the best matching CatalogEntry using both SKU and name signals together.

    For every candidate we compute:
      sku_score  — how similar the SKUs are (prefix-normalised)
      name_score — how similar the names are (hardware-spec-aware)

    The candidate is accepted only if it satisfies at least one _ACCEPT_RULE.

    Returns (entry, sku_score, name_score, rule_label) or None.
    """
    our_norm_sku = normalize_sku(our_sku)
    our_norm_name = normalize_name(our_name)

    best: Optional[Tuple[int, int, int, CatalogEntry, str]] = None  # combined, s, n, entry, rule

    for entry in catalog:
        s = _sku_sim(our_norm_sku, entry)
        n = _name_sim(our_norm_name, entry)

        accepted_rule = None
        for min_s, min_n, min_comb, label in _ACCEPT_RULES:
            if s >= min_s and n >= min_n and (s + n) >= min_comb:
                accepted_rule = label
                break

        if accepted_rule is None:
            continue

        combined = s + n
        if best is None or combined > best[0]:
            best = (combined, s, n, entry, accepted_rule)

    if best:
        _, s, n, entry, rule = best
        return entry, s, n, rule
    return None


# ---------------------------------------------------------------------------
# TSWFast scraper
# ---------------------------------------------------------------------------

TSWFAST_BASE = "https://www.tswfast.com"
TSWFAST_COLUMBIA_CATEGORY = f"{TSWFAST_BASE}/category/brand_Columbia_Tools"


def scrape_tswfast_columbia(session: requests.Session) -> List[CatalogEntry]:
    """Scrape all Columbia products from TSWFast. Returns list of CatalogEntry."""
    entries: List[CatalogEntry] = []
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
            sku = prod.get("data-code", "").strip()
            if not sku:
                code_el = prod.select_one(".cvg-code span:last-child")
                if code_el:
                    sku = code_el.get_text().strip()
            if not sku:
                continue

            # Product name from the link text
            name_el = prod.select_one(".cvg-name, .cp-name")
            name = name_el.get_text().strip() if name_el else ""

            img_el = prod.find("img", src=True)
            if not img_el:
                continue
            img_url = img_el["src"]
            if not img_url.startswith("http"):
                img_url = urljoin(TSWFAST_BASE, img_url)

            entries.append(CatalogEntry(sku, name, img_url, "tsw"))

        log.info("TSWFast page %d: %d products (cumulative: %d)",
                 page, len(products), len(entries))
        time.sleep(REQUEST_DELAY)

        if len(products) < 20:
            break
        page += 1
        if page > 20:
            break

    log.info("TSWFast: total catalog size = %d", len(entries))
    return entries


# ---------------------------------------------------------------------------
# Walltools scraper
# ---------------------------------------------------------------------------

WALLTOOLS_BASE = "https://walltools.com"
WALLTOOLS_COLUMBIA_URLS = [
    f"{WALLTOOLS_BASE}/columbia/",
    f"{WALLTOOLS_BASE}/automatic-taping-tools/taping-tool-parts-repair-kits-accessories/columbia-taping-tools-parts/",
    f"{WALLTOOLS_BASE}/columbiaparts/",
]


def _best_srcset_url(srcset: str) -> Optional[str]:
    """Pick the highest-resolution URL from a srcset string."""
    best_url = None
    best_w = 0
    for part in srcset.split(","):
        tokens = part.strip().split()
        if not tokens:
            continue
        url = tokens[0]
        w = 0
        if len(tokens) >= 2:
            try:
                w = int(tokens[1].lower().rstrip("w"))
            except ValueError:
                pass
        if w > best_w:
            best_w, best_url = w, url
    return best_url


def _upgrade_bc_image_url(url: str, width: int = 1280) -> str:
    """Upgrade a BigCommerce image URL to a higher resolution."""
    return re.sub(
        r"(cdn11\.bigcommerce\.com/s-tircj30irf/images/stencil/)\d+[^/]*/",
        lambda m: f"{m.group(1)}{width}w/",
        url,
    )


def _extract_sku_from_title(title: str) -> Optional[str]:
    """Extract SKU from a product title like 'Columbia Foo Bar (COLM-FB10)'."""
    m = re.search(r"\(([A-Z0-9][A-Z0-9\-.\s]+)\)\s*$", title, re.I)
    return m.group(1).strip() if m else None


def scrape_walltools_product_page(
    session: requests.Session, url: str
) -> Optional[Dict]:
    """
    Scrape a single Walltools product page.
    Returns dict with 'sku', 'name', and 'image_url', or None.
    """
    resp = get_with_retry(session, url)
    if resp is None:
        return None

    html = resp.text
    soup = BeautifulSoup(html, "html.parser")

    # SKU from BCData JSON blob
    sku = None
    bc_match = re.search(r"var BCData = ({.*?});", html, re.S)
    if bc_match:
        try:
            bc = json.loads(bc_match.group(1))
            sku = bc.get("product_attributes", {}).get("sku")
        except json.JSONDecodeError:
            pass

    # Product name
    name = ""
    h1 = soup.find("h1", class_="productView-title") or soup.find("h1")
    if h1:
        name = h1.get_text().strip()

    # Image URL (highest resolution available)
    image_url = None
    og_img_el = soup.find("meta", property="og:image")
    if og_img_el:
        og_img = og_img_el.get("content", "")
        if og_img and "bigcommerce.com" in og_img:
            image_url = _upgrade_bc_image_url(og_img.split("?")[0])
    if not image_url:
        pv_img = soup.select_one(
            ".productView-image img, .productView-img-container img"
        )
        if pv_img:
            src = pv_img.get("src") or pv_img.get("data-src")
            if src:
                image_url = _upgrade_bc_image_url(src.split("?")[0])

    if sku and image_url:
        return {"sku": sku, "name": name, "image_url": image_url}
    return None


def scrape_walltools_columbia(session: requests.Session) -> List[CatalogEntry]:
    """Scrape all Columbia products from Walltools. Returns list of CatalogEntry."""
    entries: List[CatalogEntry] = []
    seen_urls: set = set()

    for category_url in WALLTOOLS_COLUMBIA_URLS:
        log.info("Scraping Walltools category: %s", category_url)
        resp = get_with_retry(session, category_url)
        if resp is None:
            log.warning("Cannot reach %s", category_url)
            continue

        page_nums = {
            int(m.group(1))
            for m in re.finditer(r"page=(\d+)", resp.text)
        }
        max_page = max(page_nums) if page_nums else 1
        log.info("  Category has %d pages", max_page)

        # Collect all product card stubs from all pages
        stubs: List[Dict] = []
        for page in range(1, max_page + 1):
            url = f"{category_url}?page={page}" if page > 1 else category_url
            r = get_with_retry(session, url)
            if r is None:
                time.sleep(REQUEST_DELAY)
                continue
            soup = BeautifulSoup(r.text, "html.parser")
            for card in soup.select("article.card"):
                link_el = card.find("a", href=True)
                if not link_el:
                    continue
                prod_url = link_el["href"]
                if not prod_url.startswith("http"):
                    prod_url = urljoin(WALLTOOLS_BASE, prod_url)
                if prod_url in seen_urls:
                    continue
                seen_urls.add(prod_url)

                name_el = card.find(class_="card-title")
                name = name_el.get_text().strip() if name_el else ""
                sku_from_name = _extract_sku_from_title(name)

                img_el = card.find("img")
                thumb = None
                if img_el:
                    srcset = img_el.get("data-srcset", img_el.get("srcset", ""))
                    thumb = _best_srcset_url(srcset) if srcset else None
                    if not thumb:
                        thumb = img_el.get("data-src") or img_el.get("src")

                stubs.append({
                    "url": prod_url, "name": name,
                    "sku_from_name": sku_from_name, "thumb": thumb,
                })
            log.info("  Page %d: stubs so far %d", page, len(stubs))
            time.sleep(REQUEST_DELAY)

        # For each stub: if we already have SKU+thumb from title, use them;
        # otherwise fetch the product page to extract SKU and full image.
        log.info("  Fetching %d product pages...", len(stubs))
        for i, stub in enumerate(stubs):
            sku = stub.get("sku_from_name")
            name = stub["name"]
            if sku and stub.get("thumb"):
                img_url = _upgrade_bc_image_url(stub["thumb"].split("?")[0])
                entries.append(CatalogEntry(sku, name, img_url, "walltools"))
            else:
                result = scrape_walltools_product_page(session, stub["url"])
                if result:
                    entries.append(
                        CatalogEntry(
                            result["sku"],
                            result["name"] or name,
                            result["image_url"],
                            "walltools",
                        )
                    )
            if i % 10 == 9:
                log.info("  Progress: %d / %d pages fetched", i + 1, len(stubs))
            time.sleep(REQUEST_DELAY)

    log.info("Walltools: total catalog size = %d", len(entries))
    return entries


# ---------------------------------------------------------------------------
# Main pipeline
# ---------------------------------------------------------------------------

def main():
    log.info("=" * 70)
    log.info("Columbia Taping Tools Product Image Scraper")
    log.info("  Matching strategy: dual SKU + name validation")
    log.info("  Hardware parts require exact spec-token agreement")
    log.info("=" * 70)

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    # Load data
    missing_products = load_missing_skus()
    audit_map = load_audit_filename_map()

    log.info("Loaded %d products needing images", len(missing_products))
    log.info("Loaded %d audit filename mappings", len(audit_map))

    existing_webp = set(f.name for f in OUTPUT_DIR.glob("*.webp"))
    log.info("Existing WebP images in output directory: %d", len(existing_webp))

    def get_target_filename(sku: str) -> str:
        nsku = normalize_sku(sku)
        return audit_map.get(nsku, sku_to_filename(sku))

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

    session = requests.Session()
    session.headers.update(HEADERS)

    # --- Phase 1: Build TSWFast catalog (priority source) ---
    log.info("\n--- Phase 1: TSWFast ---")
    tsw_entries = scrape_tswfast_columbia(session)

    # --- Phase 2: Build Walltools catalog ---
    log.info("\n--- Phase 2: Walltools ---")
    wt_entries = scrape_walltools_columbia(session)

    # Combined catalog: TSWFast first (priority), then Walltools
    # Walltools entries fill gaps for SKUs TSWFast doesn't have.
    all_entries = tsw_entries + wt_entries
    log.info("Combined catalog: %d entries (%d TSW + %d WT)",
             len(all_entries), len(tsw_entries), len(wt_entries))

    # --- Phase 3: Dual-signal match → download → convert → save ---
    log.info("\n--- Phase 3: Match & Download ---")

    report: Dict = {
        "total_products": len(missing_products),
        "already_done": len(already_done),
        "to_process": len(to_process),
        "tsw_catalog_size": len(tsw_entries),
        "walltools_catalog_size": len(wt_entries),
        "results": [],
    }

    success_count = 0
    failed_skus: List[str] = []

    for i, prod in enumerate(to_process):
        sku = prod["sku"]
        name = prod["name"]
        target_fn = get_target_filename(sku)
        target_path = OUTPUT_DIR / target_fn

        log.info("[%d/%d] SKU: %-20s  '%s'", i + 1, len(to_process), sku, name[:50])

        # Dual-signal match: both SKU and name must agree
        match_result = dual_signal_match(sku, name, all_entries)

        if match_result is None:
            log.warning("  ✗ No confident match found — skipping")
            failed_skus.append(sku)
            report["results"].append({
                "sku": sku,
                "name": name,
                "status": "not_found",
                "target_file": target_fn,
            })
            continue

        entry, sku_score, name_score, rule = match_result
        log.info(
            "  → Matched %-20s  '%s'  [sku=%d name=%d rule=%s source=%s]",
            entry.source_sku, entry.name[:45],
            sku_score, name_score, rule, entry.source,
        )

        image_url = entry.img_url
        img_headers = S3_HEADERS if "s3.amazonaws.com" in image_url else None
        img_bytes = download_image(session, image_url, headers=img_headers)
        if img_bytes is None:
            log.warning("  ✗ Download failed: %s", image_url)
            failed_skus.append(sku)
            report["results"].append({
                "sku": sku, "name": name, "status": "download_failed",
                "matched_sku": entry.source_sku,
                "image_url": image_url, "target_file": target_fn,
            })
            time.sleep(REQUEST_DELAY)
            continue

        webp_bytes = bytes_to_webp(img_bytes)
        if webp_bytes is None:
            log.warning("  ✗ WebP conversion failed: %s", image_url)
            failed_skus.append(sku)
            report["results"].append({
                "sku": sku, "name": name, "status": "conversion_failed",
                "matched_sku": entry.source_sku,
                "image_url": image_url, "target_file": target_fn,
            })
            time.sleep(REQUEST_DELAY)
            continue

        if save_webp(webp_bytes, target_path):
            log.info("  ✓ Saved %s (%d bytes, %s)", target_fn, len(webp_bytes), entry.source)
            success_count += 1
            report["results"].append({
                "sku": sku, "name": name, "status": "success",
                "source": entry.source,
                "matched_sku": entry.source_sku,
                "matched_name": entry.name,
                "sku_score": sku_score,
                "name_score": name_score,
                "rule": rule,
                "image_url": entry.img_url,
                "target_file": target_fn,
                "size_bytes": len(webp_bytes),
            })
        else:
            failed_skus.append(sku)
            report["results"].append({
                "sku": sku, "name": name, "status": "save_failed",
                "matched_sku": entry.source_sku,
                "image_url": entry.img_url,
                "target_file": target_fn,
            })

        time.sleep(REQUEST_DELAY)

    # --- Phase 4: Report ---
    report["success_count"] = success_count
    report["failed_count"] = len(failed_skus)
    report["failed_skus"] = failed_skus

    with open(REPORT_JSON, "w") as f:
        json.dump(report, f, indent=2)

    by_source: Dict[str, int] = {}
    for r in report["results"]:
        if r["status"] == "success":
            by_source[r["source"]] = by_source.get(r["source"], 0) + 1

    log.info("\n%s", "=" * 70)
    log.info("SUMMARY")
    log.info("=" * 70)
    log.info("Total products in missing list:  %d", len(missing_products))
    log.info("Already had images:              %d", len(already_done))
    log.info("Processed this run:              %d", len(to_process))
    log.info("Successfully saved:              %d", success_count)
    for src, cnt in sorted(by_source.items()):
        log.info("  %-30s %d", src, cnt)
    log.info("No confident match found:        %d", len(failed_skus))
    log.info("Report saved to:                 %s", REPORT_JSON)

    if failed_skus:
        log.info("\nSKUs with no match:")
        for s in failed_skus:
            log.info("  - %s", s)


if __name__ == "__main__":
    main()
