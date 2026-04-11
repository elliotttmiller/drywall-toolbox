#!/usr/bin/env python3
"""
Columbia Taping Tools — Comprehensive Image Scraper
=====================================================
Sources (priority order):
  1. https://www.tswfast.com     — PRIMARY: sitemap-indexed catalog, NO search API
  2. https://walltools.com       — SECONDARY: BigCommerce catalog, COLM-{sku} URLs
  3. https://www.toolots.com     — TERTIARY: B2B marketplace
  4. https://www.grainger.com    — QUATERNARY: industrial distributor

Strategy:
  At startup, TSWFast and Walltools catalogs are pre-built from their sitemaps /
  category pages (one-time HTTP crawl per run, resume-safe via JSON cache).
  Per-product lookup is then O(1) dict lookups with SKU fuzzy matching — no
  live search queries against TSWFast's broken /search endpoint.

Reads:  scripts/image_audit_report.csv
Output: frontend/public/brands/Columbia/Products/  (.webp, named per 'notes' field)
Log:    scripts/scrape_log.json   (resume-safe — done SKUs skipped on re-run)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SETUP
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    pip install cloudscraper beautifulsoup4 Pillow lxml

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
USAGE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    python scrape_columbia_images.py            # full run, auto-resume
    python scrape_columbia_images.py --force    # re-download everything
    python scrape_columbia_images.py --dry-run  # find URLs only, no saves
    python scrape_columbia_images.py --start 50 # resume from row 50
    python scrape_columbia_images.py --rebuild-catalog  # force re-crawl catalogs
"""

import argparse
import csv
import json
import logging
import re
import sys
import time
import random
from io import BytesIO
from pathlib import Path
from urllib.parse import urljoin, quote_plus

import cloudscraper
from bs4 import BeautifulSoup, NavigableString
from PIL import Image


# ─────────────────────────── CONFIG ───────────────────────────────────────────

REPO_ROOT  = Path(__file__).parent.parent
CSV_FILE   = Path(__file__).parent / "image_audit_report.csv"
OUTPUT_DIR = REPO_ROOT / "frontend" / "public" / "brands" / "Columbia" / "Products"
LOG_FILE   = Path(__file__).parent / "scrape_log.json"
CATALOG_CACHE = Path(__file__).parent / "scrape_catalog_cache.json"

# Source 1 — TSW Fast
TSW_BASE          = "https://www.tswfast.com"
TSW_SITEMAP_URL   = f"{TSW_BASE}/sitemap_products_1.xml"
TSW_IMG_BUCKET    = "https://s3.amazonaws.com/tswfastcomfiles/product"
TSW_IMG_BUCKET2   = "https://s3.amazonaws.com/gmscom/master/media-common/product"

# Source 2 — Walltools (BigCommerce)
WT_BASE = "https://walltools.com"
WT_COLUMBIA_CATS = [
    "/automatic-taping-tools/taping-tool-parts-repair-kits-accessories/"
    "columbia-taping-tools-parts/columbia-parts/",
    "/automatic-taping-tools/taping-tool-parts-repair-kits-accessories/"
    "columbia-taping-tools-parts/columbia-sub-assemblies/",
    "/automatic-taping-tools/taping-tool-parts-repair-kits-accessories/"
    "columbia-taping-tools-parts/columbia-repair-kits/",
    "/columbia-taping-tools-2/",
    "/columbiaparts/",
    "/columbia/",
]

# Source 3 — Toolots
TOOLOTS_BASE       = "https://www.toolots.com"
TOOLOTS_SEARCH_URL = f"{TOOLOTS_BASE}/search?q={{q}}"

# Source 4 — Grainger
GRAINGER_BASE       = "https://www.grainger.com"
GRAINGER_SEARCH_URL = f"{GRAINGER_BASE}/search?searchQuery={{q}}&sst=4&orderBy=2"

DELAY_MIN       = 2.0
DELAY_MAX       = 4.2
RETRY_MAX       = 3
REQUEST_TIMEOUT = 30
WEBP_QUALITY    = 88


# ─────────────────────────── LOGGING ──────────────────────────────────────────

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler(Path(__file__).parent / "scrape_run.log",
                            encoding="utf-8"),
    ],
)
log = logging.getLogger(__name__)


# ─────────────────────────── SKU NORMALIZATION ────────────────────────────────
#
# Columbia SKUs use many separator styles:  "FA S26", "COL2.5CSF", "HFFB1-10"
# TSWFast uses CTT/TTT prefixes:  "CTT25CSF", "TTT304005"
# Walltools uses COLM-{sku} suffixes:  "COLM-ct1", "COLM-ffba-10"
#
# Strategy: strip ALL separators → lowercase alphanumeric core, PLUS strip known
# brand prefixes (COL, CTT, TTT, COLM, TTI) to expose the bare part number.

_SEP_RE    = re.compile(r"[\s\-_./()]+")
_PREFIX_RE = re.compile(r"^(?:col[mu]?|ctt|ttt|tti|ta|tt)", re.I)


def sku_core(s: str) -> str:
    """Strip all separators → lowercase alphanumeric core."""
    return re.sub(r"[^a-z0-9]", "", s.lower())


def sku_bare(s: str) -> str:
    """Strip separators AND leading brand prefix → bare part number core."""
    core = sku_core(s)
    # Remove leading brand prefixes (COL, CTT, TTT, COLM, etc.)
    stripped = _PREFIX_RE.sub("", core)
    return stripped if len(stripped) >= 2 else core


def sku_tokens(s: str) -> list[str]:
    """Split on any separator → list of lowercase alphanum tokens."""
    return [t for t in _SEP_RE.split(s.lower()) if t]


def sku_variants(sku: str) -> list[str]:
    """Return every reasonable textual variant of a SKU."""
    raw  = sku.strip()
    core = sku_core(raw)
    toks = sku_tokens(raw)
    variants = [
        raw,
        raw.upper(),
        raw.replace(" ", "-"),
        raw.replace(" ", ""),
        raw.replace(".", "-"),
        raw.replace(".", ""),
        raw.replace(" ", "-").replace(".", "-"),
        raw.replace(" ", "").replace(".", ""),
        "-".join(toks),
        core,
    ]
    seen, out = set(), []
    for v in variants:
        k = v.lower()
        if k not in seen:
            seen.add(k)
            out.append(v)
    return out


def sku_matches(sku: str, candidate_text: str) -> bool:
    """
    Return True if `sku` is a plausible match for `candidate_text`.

    Matching tiers:
      1. Core equality
      2. Bare (prefix-stripped) core equality  ← NEW for CTT/COL prefix mapping
      3. Any SKU variant appears as a word/token
      4. All SKU tokens present in candidate (order-free)
      5. Core prefix match (≥ 4 chars)
      6. Bare prefix match
    """
    cand_lower = candidate_text.lower()
    cand_core  = sku_core(cand_lower)
    my_core    = sku_core(sku)
    my_bare    = sku_bare(sku)
    my_tokens  = sku_tokens(sku)

    # Tier 1 — pure core equality
    if my_core and my_core == cand_core:
        return True
    # Tier 1b — core contained
    if my_core and len(my_core) >= 4 and my_core in cand_core:
        return True

    # Tier 2 — bare (prefix-stripped) equality (handles CTT vs COL mapping)
    cand_bare = sku_bare(cand_core)
    if my_bare and len(my_bare) >= 3 and my_bare == cand_bare:
        return True
    if my_bare and len(my_bare) >= 4 and my_bare in cand_core:
        return True

    # Tier 3 — any variant appears verbatim (word-boundary aware)
    for v in sku_variants(sku):
        pattern = r"(?<![a-z0-9])" + re.escape(v.lower()) + r"(?![a-z0-9])"
        if re.search(pattern, cand_lower):
            return True

    # Tier 4 — all tokens present anywhere
    if len(my_tokens) >= 2 and all(t in cand_lower for t in my_tokens):
        return True

    # Tier 5 — core prefix (≥ 4 chars)
    if len(my_core) >= 4 and cand_core.startswith(my_core):
        return True

    # Tier 6 — bare prefix (≥ 4 chars)
    if len(my_bare) >= 4 and cand_core.startswith(my_bare):
        return True

    return False


def _match_score(sku: str, name: str, candidate: str) -> int:
    """
    Score how well `candidate` matches our SKU + product name.
    Higher = better; 0 = no match.
    """
    cand_lower = candidate.lower()
    cand_core  = sku_core(candidate)
    my_core    = sku_core(sku)
    my_bare    = sku_bare(sku)
    my_tokens  = sku_tokens(sku)

    if my_core and my_core == cand_core:           return 10
    if my_core and len(my_core) >= 4 and my_core in cand_core: return 9
    cand_bare = sku_bare(cand_core)
    if my_bare and len(my_bare) >= 3 and my_bare == cand_bare: return 9
    if my_bare and len(my_bare) >= 4 and my_bare in cand_core: return 8

    for v in sku_variants(sku):
        pattern = r"(?<![a-z0-9])" + re.escape(v.lower()) + r"(?![a-z0-9])"
        if re.search(pattern, cand_lower):
            return 8

    if len(my_tokens) >= 2 and all(t in cand_lower for t in my_tokens):
        return 6

    if len(my_core) >= 4 and cand_core.startswith(my_core):   return 4
    if len(my_bare) >= 4 and cand_core.startswith(my_bare):   return 4

    stop = {"the", "for", "and", "with", "of", "a", "an", "in", "to"}
    name_words = {w for w in re.split(r"\W+", name.lower())
                  if len(w) > 2 and w not in stop}
    cand_words = set(re.split(r"\W+", cand_lower))
    if len(name_words & cand_words) >= 2:
        return 2

    return 0


# ─────────────────────────── SCRAPER FACTORY ──────────────────────────────────

def make_scraper() -> cloudscraper.CloudScraper:
    scraper = cloudscraper.create_scraper(
        browser={"browser": "chrome", "platform": "windows", "desktop": True},
        delay=10,
    )
    scraper.headers.update({
        "Accept-Language": "en-US,en;q=0.9",
        "Accept":          "text/html,application/xhtml+xml,*/*;q=0.8",
        "Referer":         TSW_BASE,
    })
    return scraper


# ─────────────────────────── HTTP HELPERS ─────────────────────────────────────

def fetch(scraper, url: str, **kw):
    """GET with retry. Returns response or None on total failure."""
    for attempt in range(1, RETRY_MAX + 1):
        try:
            r = scraper.get(url, timeout=REQUEST_TIMEOUT, **kw)
            r.raise_for_status()
            return r
        except Exception as e:
            log.warning(f"  [fetch] attempt {attempt}/{RETRY_MAX} — {e}")
            if attempt < RETRY_MAX:
                time.sleep(attempt * 3)
    return None


def polite_sleep():
    time.sleep(random.uniform(DELAY_MIN, DELAY_MAX))


# ─────────────────────────── IMAGE UTILITIES ──────────────────────────────────

def dedupe_img_urls(urls: list[str], base_url: str = "") -> list[str]:
    """Deduplicate, resolve relative, strip WP thumbnail suffixes, filter junk."""
    SKIP = re.compile(
        r"placeholder|logo|icon|banner|header|footer|spinner|loading|noproduct"
        r"|facebook\.com|twitter\.com|youtube\.com|linkedin\.com"
        r"|ezgif\.com|stencil/\d+x\d+/ezgif",
        re.I,
    )
    seen, out = set(), []
    for u in urls:
        if not u or u.startswith("data:"):
            continue
        if base_url:
            u = urljoin(base_url, u)
        if not re.search(r"\.(jpe?g|png|gif|webp)(\?.*)?$", u, re.I):
            continue
        if SKIP.search(u):
            continue
        clean = re.sub(r"-\d{2,4}x\d{2,4}(?=\.\w+(?:\?.*)?$)", "", u)
        if clean not in seen:
            seen.add(clean)
            out.append(clean)
    return out


def to_webp(data: bytes, out_path: Path):
    img = Image.open(BytesIO(data)).convert("RGBA")
    img.save(out_path, "WEBP", quality=WEBP_QUALITY, method=6)


def stem_from_notes(notes: str) -> str:
    return Path(notes.strip()).stem


def bc_fullres(url: str) -> str:
    """Upgrade a BigCommerce stencil URL to 1280w (largest generally served)."""
    return re.sub(r"/stencil/\d+x\d+/", "/stencil/1280w/", url)


# ══════════════════════════════════════════════════════════════════════════════
#  CATALOG BUILDERS  (run once per session, cached to disk)
# ══════════════════════════════════════════════════════════════════════════════

def _load_catalog_cache() -> dict:
    if CATALOG_CACHE.exists():
        with open(CATALOG_CACHE, encoding="utf-8") as f:
            return json.load(f)
    return {}


def _save_catalog_cache(data: dict):
    with open(CATALOG_CACHE, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2)


# ─────────────────────────── TSW FAST CATALOG ─────────────────────────────────

def build_tsw_catalog(scraper, force: bool = False) -> dict:
    """
    Download TSWFast product sitemap and build a catalog dict:
      {
        product_url: {
          'slug': '...',
          'slug_core': '...',
          'tsw_code': '...',       # first token of slug (e.g. CTT25CSF)
          'tsw_code_core': '...',  # sku_core of tsw_code
          'tsw_bare': '...',       # sku_bare of tsw_code (prefix stripped)
          'name_text': '...',      # product name embedded in slug
        }
      }
    Returns dict keyed by product URL.
    """
    cache = _load_catalog_cache()
    if not force and "tsw" in cache:
        log.info(f"  [TSW catalog] loaded from cache ({len(cache['tsw'])} entries)")
        return cache["tsw"]

    log.info("  [TSW catalog] downloading sitemap …")
    r = fetch(scraper, TSW_SITEMAP_URL)
    if not r:
        log.warning("  [TSW catalog] sitemap fetch failed, returning empty catalog")
        return {}

    soup = BeautifulSoup(r.text, "lxml-xml")
    all_urls = [loc.text.strip() for loc in soup.find_all("loc")]
    log.info(f"  [TSW catalog] {len(all_urls)} product URLs in sitemap")

    catalog = {}
    for url in all_urls:
        slug = url.split("/product/")[-1]
        parts = slug.split("-")
        tsw_code = parts[0] if parts else slug
        name_text = " ".join(parts[1:]).replace("-", " ") if len(parts) > 1 else ""
        catalog[url] = {
            "slug":           slug,
            "slug_core":      sku_core(slug),
            "tsw_code":       tsw_code,
            "tsw_code_core":  sku_core(tsw_code),
            "tsw_bare":       sku_bare(tsw_code),
            "name_text":      name_text,
        }

    cache["tsw"] = catalog
    _save_catalog_cache(cache)
    log.info(f"  [TSW catalog] built {len(catalog)} entries, cached")
    return catalog


def tsw_find_product(tsw_catalog: dict, sku: str, name: str) -> str | None:
    """
    Look up the best TSWFast product URL for a given SKU + name.
    Uses pre-built catalog — no live search queries.
    Returns product URL or None.
    """
    name_base = name.split("(")[0].strip()
    my_core   = sku_core(sku)
    my_bare   = sku_bare(sku)

    best_url, best_score = None, 0

    for url, info in tsw_catalog.items():
        # Build a rich candidate string for scoring
        candidate = (
            f"{info['slug']} {info['tsw_code']} {info['name_text']}"
        )
        score = _match_score(sku, name_base, candidate)

        # Boost: bare core exact match (CTT→COL prefix normalisation)
        if my_bare and len(my_bare) >= 3 and my_bare == info["tsw_bare"]:
            score = max(score, 9)

        # Boost: SKU core fully contained in slug
        if my_core and len(my_core) >= 4 and my_core in info["slug_core"]:
            score = max(score, 8)

        if score > best_score:
            best_score, best_url = score, url

    if best_url and best_score >= 4:
        log.info(f"  [TSW catalog hit score={best_score}] {best_url}")
        return best_url

    return None


def tsw_extract_images(scraper, product_url: str) -> list[str]:
    """
    Fetch a TSWFast product page and extract product images.
    Primary strategy: carousel/cv-media img[src] pointing to S3.
    Fallback: construct direct S3 URL from data-code attribute.
    """
    r = fetch(scraper, product_url)
    if not r:
        return []

    soup = BeautifulSoup(r.text, "lxml")
    raw  = []

    # Get the TSW internal product code
    content_div = soup.select_one("[data-code]")
    tsw_code = content_div["data-code"].strip() if content_div else ""

    # Primary: all images in the product carousel / media area
    for img in soup.select(
        ".cv-media img, .carousel img, .carousel-item img, "
        ".carousel-indicators img, [class*=product] img"
    ):
        src = img.get("src", "")
        if src and "logo" not in src.lower() and ("tswfast" in src or "gmscom" in src
                                                  or "amazonaws" in src):
            raw.append(src)

    # Fallback: construct S3 URL directly from the data-code
    if tsw_code and not raw:
        for bucket in [TSW_IMG_BUCKET, TSW_IMG_BUCKET2]:
            candidate = f"{bucket}/{tsw_code}_M.jpg"
            test = fetch(scraper, candidate)
            if test and test.status_code == 200 and len(test.content) > 5000:
                raw.append(candidate)
                break

    # og:image fallback
    for prop in ("og:image", "twitter:image"):
        tag = soup.find("meta", property=prop) or soup.find("meta", attrs={"name": prop})
        if tag and tag.get("content"):
            raw.append(tag["content"])

    return dedupe_img_urls(raw, product_url)


# ─────────────────────────── WALLTOOLS CATALOG ────────────────────────────────

def build_walltools_catalog(scraper, force: bool = False) -> dict:
    """
    Crawl all Walltools Columbia category pages and build a catalog:
      {
        product_url: {
          'colm_sku':      'ct1',      # raw COLM-{sku} extracted from URL
          'colm_sku_core': 'ct1',      # sku_core of colm_sku
          'colm_bare':     'ct1',      # sku_bare of colm_sku
          'thumb_url':     '...',      # thumbnail src (already upgraded to 1280w)
        }
      }
    """
    cache = _load_catalog_cache()
    if not force and "walltools" in cache:
        log.info(f"  [WT catalog] loaded from cache ({len(cache['walltools'])} entries)")
        return cache["walltools"]

    log.info("  [WT catalog] crawling Columbia category pages …")
    catalog = {}

    for cat_path in WT_COLUMBIA_CATS:
        cat_url = WT_BASE + cat_path
        page = 1
        while True:
            url = cat_url + (f"?page={page}" if page > 1 else "")
            r = fetch(scraper, url)
            if not r:
                break

            soup = BeautifulSoup(r.text, "lxml")
            listing = soup.find(class_=re.compile(r"productGrid"))
            if not listing:
                break

            new_count = 0
            for child in listing.children:
                if isinstance(child, NavigableString):
                    continue
                a   = child.find("a", href=True)
                img = child.find("img")
                if not a or WT_BASE not in a["href"]:
                    continue

                href = a["href"].rstrip("/")
                if href in catalog:
                    continue

                # Extract COLM-{sku} from URL
                sku_m = re.search(
                    r"[Cc][Oo][Ll][Mm]-([a-z0-9_\-]+?)(?:-COLM-[a-z0-9_\-]+)?$",
                    href, re.I,
                )
                colm_sku = sku_m.group(1).lower() if sku_m else ""

                thumb = ""
                if img:
                    thumb = img.get("data-src") or img.get("src", "")
                    if thumb and "bigcommerce" in thumb:
                        thumb = bc_fullres(thumb)

                catalog[href] = {
                    "colm_sku":      colm_sku,
                    "colm_sku_core": sku_core(colm_sku),
                    "colm_bare":     sku_bare(colm_sku),
                    "thumb_url":     thumb,
                }
                new_count += 1

            log.info(f"    {cat_path[:55]}  p={page}  +{new_count}  total={len(catalog)}")

            if new_count == 0:
                break
            page += 1
            polite_sleep()

    cache["walltools"] = catalog
    _save_catalog_cache(cache)
    log.info(f"  [WT catalog] built {len(catalog)} entries, cached")
    return catalog


def walltools_find_product(wt_catalog: dict, sku: str, name: str) -> str | None:
    """Look up the best Walltools product URL using the pre-built catalog."""
    name_base = name.split("(")[0].strip()
    my_core   = sku_core(sku)
    my_bare   = sku_bare(sku)

    best_url, best_score = None, 0

    for url, info in wt_catalog.items():
        colm_sku = info["colm_sku"]
        if not colm_sku:
            continue

        # Build candidate string: url slug + colm_sku
        slug = url.split(WT_BASE + "/")[-1]
        candidate = f"{slug} {colm_sku}"

        score = _match_score(sku, name_base, candidate)

        # Bonus: COLM SKU bare matches our SKU bare
        if my_bare and len(my_bare) >= 2 and my_bare == info["colm_bare"]:
            score = max(score, 9)
        if my_core and len(my_core) >= 3 and my_core == info["colm_sku_core"]:
            score = max(score, 10)

        if score > best_score:
            best_score, best_url = score, url

    if best_url and best_score >= 4:
        log.info(f"  [WT catalog hit score={best_score}] {best_url}")
        return best_url

    return None


def walltools_extract_images(scraper, product_url: str,
                             thumb_url: str = "") -> list[str]:
    """
    Fetch a Walltools product page and extract full-resolution BigCommerce images.
    Also includes the thumbnail URL (already upgraded to 1280w) as a reliable
    fallback without needing to parse the product page.
    """
    raw = []

    # Thumbnail from catalog is already 1280w — add it immediately
    if thumb_url:
        raw.append(thumb_url)

    r = fetch(scraper, product_url)
    if not r:
        return dedupe_img_urls(raw, WT_BASE)

    soup = BeautifulSoup(r.text, "lxml")

    # BC product gallery — data-image-gallery-new-image-url holds full-res
    for el in soup.select("[data-image-gallery-new-image-url]"):
        v = el["data-image-gallery-new-image-url"]
        if v:
            raw.append(bc_fullres(v))

    # Anchor wrapping product images (BC lightbox)
    for a in soup.select(
        ".productView-image a, .productView-imageCarousel a, "
        "[class*=productView-image] a"
    ):
        href = a.get("href", "")
        if href and "bigcommerce" in href:
            raw.append(bc_fullres(href))

    # img tags in gallery
    for img in soup.select(
        ".productView-image img, [class*=productView] img, "
        ".productView-thumbnails img, [data-product-image]"
    ):
        for attr in ("src", "data-src", "data-zoom-src", "data-large_image"):
            v = img.get(attr, "")
            if v and "bigcommerce" in v:
                raw.append(bc_fullres(v))
                break

    # og:image (always full-res in BC)
    og = soup.find("meta", property="og:image")
    if og and og.get("content"):
        raw.append(og["content"])

    return dedupe_img_urls(raw, WT_BASE)


# ─────────────────────────── TOOLOTS (FALLBACK 3) ─────────────────────────────

def toolots_find_product(scraper, sku: str, name: str) -> str | None:
    """Search Toolots.com for the product. Returns URL or None."""
    name_base = name.split("(")[0].strip()
    queries   = list(dict.fromkeys([
        f"columbia taping tools {sku}",
        f"columbia {sku}",
        sku,
        name_base,
    ]))
    for q in queries:
        url = TOOLOTS_SEARCH_URL.format(q=quote_plus(q))
        log.info(f"  [Toolots] GET {url}")
        r = fetch(scraper, url)
        if not r:
            polite_sleep(); continue

        soup  = BeautifulSoup(r.text, "lxml")
        links = _extract_generic_product_links(soup, TOOLOTS_BASE,
                                               href_must_contain="/product")
        if not links:
            polite_sleep(); continue

        best_url, best_score = None, 0
        for href, text in links:
            score = _match_score(sku, name_base, f"{href} {text}")
            if score > best_score:
                best_score, best_url = score, href

        if best_url and best_score > 0:
            log.info(f"  [Toolots hit score={best_score}] {best_url}")
            return best_url
        polite_sleep()
    return None


def toolots_extract_images(scraper, product_url: str) -> list[str]:
    r = fetch(scraper, product_url)
    if not r:
        return []
    soup = BeautifulSoup(r.text, "lxml")
    raw  = []
    for attr in ("data-zoom-src", "data-large", "data-src", "data-original"):
        for el in soup.select(f"[{attr}]"):
            v = el.get(attr, "")
            if v: raw.append(v)
    for img in soup.select(
        ".product-image img, [class*='gallery'] img, [class*='product'] img"
    ):
        src = img.get("src") or img.get("data-src","")
        if src: raw.append(src)
    for prop in ("og:image", "twitter:image"):
        tag = soup.find("meta", property=prop) or soup.find("meta", attrs={"name": prop})
        if tag and tag.get("content"):
            raw.append(tag["content"])
    return dedupe_img_urls(raw, product_url)


# ─────────────────────────── GRAINGER (FALLBACK 4) ────────────────────────────

def grainger_find_product(scraper, sku: str, name: str) -> str | None:
    """Search Grainger.com. Returns URL or None."""
    name_base = name.split("(")[0].strip()
    queries = list(dict.fromkeys([
        f"columbia taping tools {sku}",
        f"columbia {sku}",
    ]))
    for q in queries:
        url = GRAINGER_SEARCH_URL.format(q=quote_plus(q))
        log.info(f"  [Grainger] GET {url}")
        r = fetch(scraper, url)
        if not r:
            polite_sleep(); continue

        soup  = BeautifulSoup(r.text, "lxml")
        links = _extract_generic_product_links(soup, GRAINGER_BASE,
                                               href_must_contain="/product")
        if not links:
            polite_sleep(); continue

        best_url, best_score = None, 0
        for href, text in links:
            score = _match_score(sku, name_base, f"{href} {text}")
            if score > best_score:
                best_score, best_url = score, href

        if best_url and best_score > 0:
            log.info(f"  [Grainger hit score={best_score}] {best_url}")
            return best_url
        polite_sleep()
    return None


def grainger_extract_images(scraper, product_url: str) -> list[str]:
    r = fetch(scraper, product_url)
    if not r:
        return []
    soup = BeautifulSoup(r.text, "lxml")
    raw  = []
    for attr in ("data-src", "data-zoom-src", "data-large", "data-original"):
        for el in soup.select(f"[{attr}]"):
            v = el.get(attr, "")
            if v: raw.append(v)
    for img in soup.select(
        "[class*='product-image'] img, [class*='product-photo'] img, "
        "[data-testid*='image'] img"
    ):
        src = img.get("src","") or img.get("data-src","")
        if src and not src.startswith("data:"):
            raw.append(src)
    for prop in ("og:image", "twitter:image"):
        tag = soup.find("meta", property=prop) or soup.find("meta", attrs={"name": prop})
        if tag and tag.get("content"):
            raw.append(tag["content"])
    return dedupe_img_urls(raw, product_url)


# ─────────────────────────── GENERIC HELPERS ──────────────────────────────────

def _extract_generic_product_links(soup: BeautifulSoup, base: str,
                                   href_must_contain: str = "/product"
                                   ) -> list[tuple[str, str]]:
    seen, results = set(), []
    for a in soup.find_all("a", href=True):
        href = a["href"].strip()
        if not href:
            continue
        if href.startswith("/"):
            href = base + href
        if href_must_contain.lower() not in href.lower():
            continue
        if href not in seen:
            seen.add(href)
            results.append((href, a.get_text(" ", strip=True)))
    return results


# ─────────────────────────── DOWNLOAD ─────────────────────────────────────────

def download_images(scraper, img_urls: list[str], base_name: str,
                    out_dir: Path, dry_run: bool = False) -> list[str]:
    """Download + convert to WebP. Returns list of saved filenames."""
    saved  = []
    multi  = len(img_urls) > 1

    for i, url in enumerate(img_urls, start=1):
        suffix   = f"_{i:02d}" if multi else ""
        filename = f"{base_name}{suffix}.webp"
        out_path = out_dir / filename

        if out_path.exists():
            log.info(f"    ✓ exists → {filename}")
            saved.append(filename)
            continue

        if dry_run:
            log.info(f"    [DRY-RUN] {filename}  ←  {url}")
            saved.append(filename)
            continue

        r = fetch(scraper, url)
        if not r:
            log.warning(f"    ✗ download failed: {url}")
            continue

        try:
            to_webp(r.content, out_path)
            log.info(f"    ✓ {filename}  ({len(r.content)//1024} KB)")
            saved.append(filename)
        except Exception as e:
            log.error(f"    ✗ conversion error ({url}): {e}")

        polite_sleep()

    return saved


# ─────────────────────────── CSV READER ───────────────────────────────────────

def read_csv() -> list[dict]:
    rows = []
    with open(CSV_FILE, encoding="utf-8-sig") as f:
        for row in csv.DictReader(f):
            sku   = row.get("SKU",          "").strip()
            name  = row.get("Product Name", "").strip()
            notes = row.get("notes",        "").strip()
            if sku and notes:
                rows.append({"sku": sku, "name": name, "notes": notes})
    return rows


# ─────────────────────────── PROGRESS LOG ─────────────────────────────────────

def load_log() -> dict:
    if LOG_FILE.exists():
        with open(LOG_FILE, encoding="utf-8") as f:
            return json.load(f)
    return {}


def save_log(data: dict):
    with open(LOG_FILE, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2)


# ─────────────────────────── MAIN ─────────────────────────────────────────────

def run(args):
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    progress = load_log()
    products = read_csv()
    total    = len(products)

    log.info(f"Loaded {total} products from {CSV_FILE.name}")
    log.info(f"Output dir : {OUTPUT_DIR.resolve()}")

    scraper = make_scraper()

    # ── Build catalogs (once, cached) ─────────────────────────────────────────
    log.info("\nBuilding source catalogs …")
    tsw_catalog = build_tsw_catalog(scraper, force=args.rebuild_catalog)
    wt_catalog  = build_walltools_catalog(scraper, force=args.rebuild_catalog)
    log.info(f"  TSWFast: {len(tsw_catalog)} products  |  Walltools: {len(wt_catalog)} products\n")

    completed, failed = 0, []

    start = max(0, args.start - 1) if args.start else 0
    if start:
        log.info(f"Starting from row {start + 1}")

    for idx, p in enumerate(products[start:], start=start + 1):
        sku   = p["sku"]
        name  = p["name"]
        notes = p["notes"]
        base  = stem_from_notes(notes)

        log.info(f"\n[{idx}/{total}]  SKU={sku!r}  →  {base}.webp")

        # Skip if already done (log or file on disk)
        out_path = OUTPUT_DIR / f"{base}.webp"
        if not args.force:
            if progress.get(sku, {}).get("status") == "ok":
                log.info("  ↩ already complete (log)")
                completed += 1
                continue
            if out_path.exists():
                log.info("  ↩ file exists on disk, marking complete")
                progress[sku] = {"status": "ok", "files": [f"{base}.webp"],
                                  "source": "pre-existing"}
                completed += 1
                save_log(progress)
                continue

        img_urls    = []
        source_used = "none"

        # ── 1. TSW Fast (PRIMARY — catalog lookup) ─────────────────────────
        try:
            prod_url = tsw_find_product(tsw_catalog, sku, name)
            if prod_url:
                polite_sleep()
                img_urls = tsw_extract_images(scraper, prod_url)
                if img_urls:
                    source_used = f"tswfast:{prod_url}"
                    log.info(f"  → {len(img_urls)} image(s) from TSWFast")
        except Exception as e:
            log.warning(f"  [TSW error] {e}")

        # ── 2. Walltools (SECONDARY — catalog lookup) ──────────────────────
        if not img_urls:
            try:
                prod_url = walltools_find_product(wt_catalog, sku, name)
                if prod_url:
                    thumb = wt_catalog.get(prod_url.rstrip("/"), {}).get("thumb_url", "")
                    polite_sleep()
                    img_urls = walltools_extract_images(scraper, prod_url, thumb)
                    if img_urls:
                        source_used = f"walltools:{prod_url}"
                        log.info(f"  → {len(img_urls)} image(s) from Walltools")
            except Exception as e:
                log.warning(f"  [Walltools error] {e}")

        # ── 3. Toolots (TERTIARY) ──────────────────────────────────────────
        if not img_urls and not args.no_toolots:
            log.info("  → trying toolots.com")
            try:
                prod_url = toolots_find_product(scraper, sku, name)
                if prod_url:
                    polite_sleep()
                    img_urls = toolots_extract_images(scraper, prod_url)
                    if img_urls:
                        source_used = f"toolots:{prod_url}"
                        log.info(f"  → {len(img_urls)} image(s) from Toolots")
            except Exception as e:
                log.warning(f"  [Toolots error] {e}")

        # ── 4. Grainger (QUATERNARY) ───────────────────────────────────────
        if not img_urls and not args.no_grainger:
            log.info("  → trying grainger.com")
            try:
                prod_url = grainger_find_product(scraper, sku, name)
                if prod_url:
                    polite_sleep()
                    img_urls = grainger_extract_images(scraper, prod_url)
                    if img_urls:
                        source_used = f"grainger:{prod_url}"
                        log.info(f"  → {len(img_urls)} image(s) from Grainger")
            except Exception as e:
                log.warning(f"  [Grainger error] {e}")

        # ── 5. Save ────────────────────────────────────────────────────────
        if not img_urls:
            log.warning(f"  ✗ NO images found for {sku!r}")
            progress[sku] = {"status": "not_found", "name": name}
            failed.append(sku)
            save_log(progress)
            continue

        saved = download_images(scraper, img_urls, base, OUTPUT_DIR, args.dry_run)

        if saved:
            progress[sku] = {"status": "ok", "files": saved, "source": source_used}
            completed += 1
        else:
            progress[sku] = {"status": "download_failed", "name": name}
            failed.append(sku)

        save_log(progress)

    # ── Summary ────────────────────────────────────────────────────────────────
    log.info("\n" + "═" * 60)
    log.info(f"DONE  {completed}/{total} completed")
    if failed:
        log.warning(f"{len(failed)} SKU(s) not found / failed:")
        for s in failed:
            log.warning(f"  • {s}")
        log.info("→ Check scrape_log.json (status: not_found) for manual review")
    log.info(f"Output dir : {OUTPUT_DIR.resolve()}")
    log.info(f"Resume log : {LOG_FILE.resolve()}")


def main():
    p = argparse.ArgumentParser(
        description=(
            "Columbia Taping Tools image scraper — TSWFast-primary, "
            "sitemap-catalog edition (no Al's Taping Tools)"
        )
    )
    p.add_argument("--force",           action="store_true",
                   help="Re-download already-completed SKUs")
    p.add_argument("--dry-run",         action="store_true",
                   help="Find URLs only, do not write files")
    p.add_argument("--rebuild-catalog", action="store_true",
                   help="Force re-crawl of TSWFast sitemap and Walltools categories")
    p.add_argument("--no-toolots",      action="store_true",
                   help="Skip Toolots.com fallback")
    p.add_argument("--no-grainger",     action="store_true",
                   help="Skip Grainger.com fallback")
    p.add_argument("--start",           type=int, default=0, metavar="N",
                   help="Start from row N (1-indexed)")
    run(p.parse_args())


if __name__ == "__main__":
    main()
