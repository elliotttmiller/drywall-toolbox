#!/usr/bin/env python3
"""
scrape_tapetech_parts_enriched.py

Reads the baseline TapeTech parts catalog from:
    scraped_results/TapeTech/TapeTech_parts_catalog.csv

Searches top drywall industry online stores for each part to extract:
    - Official part name
    - SKU / Part ID
    - Product image URLs (multiple if available)
    - Current retail price
    - Source URL

Writes an enriched catalog to:
    scraped_results/TapeTech/TapeTech_parts_enriched.csv

Targeted stores (in priority order):
    1. All-Wall              – https://www.all-wall.com/parts/tapetech-taping-tools-parts
       Uses NetSuite SuiteCommerce JSON API (no JS required, full field set).
    2. Al's Taping Tools     – https://www.alstapingtools.com/order-parts/
       Uses BigCommerce search.php endpoint; card-based product grid.
    3. TapeTech Official     – https://www.tapetech.com  (WooCommerce)
       Prices hidden behind B2B login; used for official name + image only.
    4. WallTools             – https://walltools.com/…/tapetech-parts/
       BigCommerce; carries repair kits/assemblies; searched as fallback.
    5. Timothy's Toolbox     – https://www.timothystoolbox.com/collections/tapetech
       Shopify; carries complete tools + some parts; searched as fallback.

Usage:
    python3 scripts/scrape_tapetech_parts_enriched.py [--limit N] [--delay SECONDS]

Options:
    --limit N        Process only the first N parts (useful for testing). Default: all.
    --delay SECONDS  Seconds to wait between HTTP requests (default: 1.5).
    --resume         Skip parts that already have enrichment data in the output CSV.
    --output PATH    Override the default output path.
"""

import argparse
import csv
import json
import os
import re
import sys
import time
import urllib.parse
from datetime import datetime, timezone
from typing import Optional

try:
    import requests
    from bs4 import BeautifulSoup
except ImportError:
    print(
        "ERROR: Missing required packages. Install with:\n"
        "  pip install requests beautifulsoup4 lxml",
        file=sys.stderr,
    )
    sys.exit(1)

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------

REPO_ROOT = os.path.join(os.path.dirname(__file__), "..")
BASELINE_CSV = os.path.join(
    REPO_ROOT, "scraped_results", "TapeTech", "TapeTech_parts_catalog.csv"
)
DEFAULT_OUTPUT_CSV = os.path.join(
    REPO_ROOT, "scraped_results", "TapeTech", "TapeTech_parts_enriched.csv"
)

# ---------------------------------------------------------------------------
# HTTP session helpers
# ---------------------------------------------------------------------------

BROWSER_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
    # Omit "br" (brotli) – the requests library cannot decompress it natively,
    # so including it causes garbled binary responses on some servers.
    "Accept-Encoding": "gzip, deflate",
    "Connection": "keep-alive",
}

JSON_HEADERS = {
    **BROWSER_HEADERS,
    "Accept": "application/json, text/javascript, */*; q=0.01",
    "X-Requested-With": "XMLHttpRequest",
    # Do not advertise brotli in AJAX calls either
    "Accept-Encoding": "gzip, deflate",
}

REQUEST_TIMEOUT = 20  # seconds


def make_session() -> requests.Session:
    session = requests.Session()
    session.headers.update(BROWSER_HEADERS)
    return session


def safe_get(
    session: requests.Session, url: str, *, as_json: bool = False
) -> Optional[requests.Response]:
    """GET url, returning None on any network / HTTP error."""
    try:
        hdrs = JSON_HEADERS if as_json else {}
        resp = session.get(url, timeout=REQUEST_TIMEOUT, allow_redirects=True, headers=hdrs)
        resp.raise_for_status()
        return resp
    except requests.RequestException:
        return None


def _best_srcset_url(img_el) -> str:
    """Return the highest-resolution URL from a BigCommerce img element's data-srcset.

    BigCommerce populates ``data-srcset`` with a comma-separated list of
    ``<url> <width>w`` entries (e.g. ``https://…/80w/… 80w, https://…/960w/… 960w``).
    We pick the entry with the largest declared width.  Falls back to ``src``
    if no parseable srcset is present.
    """
    srcset = img_el.get("data-srcset", "")
    if srcset:
        best_url = ""
        best_w = 0
        for entry in srcset.split(","):
            parts = entry.strip().split()
            if len(parts) == 2:
                w_str = parts[1].rstrip("w")
                if w_str.isdigit() and int(w_str) > best_w:
                    best_w = int(w_str)
                    best_url = parts[0]
        if best_url:
            return best_url
    return img_el.get("src", "")


# ---------------------------------------------------------------------------
# PartResult data class
# ---------------------------------------------------------------------------

class PartResult:
    """Holds enrichment data found for a single part from one store."""

    def __init__(
        self,
        *,
        official_name: str = "",
        sku: str = "",
        price_usd: str = "",
        image_urls: list = None,
        source_url: str = "",
        store_name: str = "",
    ):
        self.official_name = official_name.strip()
        self.sku = sku.strip()
        self.price_usd = price_usd.strip()
        self.image_urls = [u for u in (image_urls or []) if u]
        self.source_url = source_url.strip()
        self.store_name = store_name.strip()

    def is_useful(self) -> bool:
        """True if we got at least a name or price."""
        return bool(self.official_name or self.price_usd)

    def __repr__(self):
        return (
            f"PartResult(store={self.store_name!r}, sku={self.sku!r}, "
            f"price={self.price_usd!r}, images={len(self.image_urls)})"
        )


# ---------------------------------------------------------------------------
# Store 1 – All-Wall  (NetSuite SuiteCommerce JSON API)
# Parts URL: https://www.all-wall.com/parts/tapetech-taping-tools-parts
# ---------------------------------------------------------------------------

ALLWALL_API = "https://www.all-wall.com/api/items"
ALLWALL_BASE = "https://www.all-wall.com"


def scrape_allwall(
    session: requests.Session, part_id: str, part_name: str
) -> Optional[PartResult]:
    """Query the All-Wall SuiteCommerce JSON API for the given TapeTech part number.

    The API endpoint accepts ?q=<part_id>&limit=1&format=json&fieldset=details
    and returns a JSON payload containing displayname, pricing, images, and the
    URL slug needed to build the canonical product URL.
    """
    url = (
        f"{ALLWALL_API}?q={urllib.parse.quote_plus(part_id)}"
        "&limit=1&format=json&fieldset=details"
    )
    resp = safe_get(session, url, as_json=True)
    if not resp:
        return None

    try:
        data = resp.json()
    except ValueError:
        return None

    items = data.get("items") or []
    if not items:
        return None

    item = items[0]

    # Official name – prefer storedisplayname2 (e.g. "TapeTech Control Valve Wiper 050003")
    name = (
        item.get("storedisplayname2")
        or item.get("displayname")
        or item.get("pagetitle")
        or ""
    ).strip()

    # SKU / MPN
    sku = (item.get("mpn") or item.get("itemid") or part_id).strip()

    # Price
    price = ""
    price_detail = item.get("onlinecustomerprice_detail") or {}
    price_formatted = price_detail.get("onlinecustomerprice_formatted", "")
    if price_formatted:
        price = price_formatted.strip()
    elif item.get("pricelevel1_formatted"):
        price = str(item["pricelevel1_formatted"]).strip()

    # Images – itemimages_detail is a dict keyed by image-set name
    images = []
    imgs_detail = item.get("itemimages_detail") or {}
    for img_set in imgs_detail.values():
        for img_entry in img_set.get("urls", []):
            src = img_entry.get("url", "").strip()
            if src and src not in images:
                # Ensure absolute URL
                if src.startswith("//"):
                    src = "https:" + src
                elif not src.startswith("http"):
                    src = ALLWALL_BASE + "/" + src.lstrip("/")
                # Percent-encode spaces and non-ASCII chars in the path only,
                # using urlsplit so already-encoded sequences are not double-encoded.
                parsed = urllib.parse.urlsplit(src)
                encoded_path = urllib.parse.quote(parsed.path, safe="/:@!$&'()*+,;=")
                src = urllib.parse.urlunsplit(parsed._replace(path=encoded_path))
                images.append(src)

    # Canonical product URL
    url_slug = item.get("urlcomponent", "").strip()
    source_url = f"{ALLWALL_BASE}/{url_slug}" if url_slug else ALLWALL_BASE

    if not name and not price:
        return None

    return PartResult(
        official_name=name,
        sku=sku,
        price_usd=price,
        image_urls=images,
        source_url=source_url,
        store_name="All-Wall",
    )


# ---------------------------------------------------------------------------
# Store 2 – Al's Taping Tools  (BigCommerce search.php)
# Parts URL: https://www.alstapingtools.com/order-parts/
# ---------------------------------------------------------------------------

ALSTAPIN_BASE = "https://www.alstapingtools.com"
ALSTAPIN_PARTS = "https://www.alstapingtools.com/order-parts/"


def scrape_alstapin(
    session: requests.Session, part_id: str, part_name: str
) -> Optional[PartResult]:
    """Search Al's Taping Tools BigCommerce store for a TapeTech part number.

    Al's Taping Tools is the largest authorized TapeTech parts distributor and
    carries the full line of individual replacement parts. Their BigCommerce
    search endpoint (search.php) returns HTML with product cards (.card) that
    contain price, title, image, and a direct product URL.

    Parts catalog root: https://www.alstapingtools.com/order-parts/
    """
    search_url = (
        f"{ALSTAPIN_BASE}/search.php"
        f"?search_query={urllib.parse.quote_plus(part_id)}"
    )
    resp = safe_get(session, search_url)
    if not resp:
        return None

    soup = BeautifulSoup(resp.text, "lxml")

    # BigCommerce renders product cards with class="card"
    card = None
    for c in soup.select(".card"):
        # Prefer the card whose title contains the exact part_id
        title_el = c.select_one(".card-title a, h3.card-title a")
        if title_el and part_id in title_el.get_text():
            card = c
            break
    if card is None:
        card = soup.select_one(".card")  # first result fallback
    if card is None:
        return None

    # Name
    title_el = card.select_one(".card-title a, h3.card-title a")
    name = title_el.get_text(" ", strip=True) if title_el else ""

    # Price
    price_el = card.select_one(".price--main[data-product-price-without-tax]")
    if not price_el:
        price_el = card.select_one(".price--main")
    price = price_el.get_text(strip=True) if price_el else ""

    # Image – highest-res entry from BigCommerce data-srcset
    img_el = card.select_one(".card-figure img")
    image = _best_srcset_url(img_el) if img_el else ""

    # Product URL
    link_el = card.select_one(".card-title a")
    prod_url = link_el.get("href", "").split("?")[0] if link_el else ""  # strip tracking params

    if not name and not price:
        return None

    return PartResult(
        official_name=name,
        sku=part_id,
        price_usd=price,
        image_urls=[image] if image else [],
        source_url=prod_url or search_url,
        store_name="Al's Taping Tools",
    )


# ---------------------------------------------------------------------------
# Store 3 – TapeTech Official  (WooCommerce — B2B; name + image only)
# ---------------------------------------------------------------------------

TAPETECH_BASE = "https://www.tapetech.com"


def scrape_tapetech_official(
    session: requests.Session, part_id: str, part_name: str
) -> Optional[PartResult]:
    """Search TapeTech.com for a given part ID.

    Prices require a B2B account login and are not publicly visible.
    This scraper extracts the official product name and product image only.
    """
    search_url = (
        f"{TAPETECH_BASE}/?s={urllib.parse.quote_plus(part_id)}&post_type=product"
    )
    resp = safe_get(session, search_url)
    if not resp:
        return None

    # WooCommerce redirects single-match searches directly to the product page
    final_url = resp.url
    soup = BeautifulSoup(resp.text, "lxml")

    if "/product/" not in final_url:
        # Multiple results – pick the first product link
        prod_links = [
            a.get("href", "")
            for a in soup.select(".products a.woocommerce-LoopProduct-link, ul.products li a")
            if "/product/" in a.get("href", "")
        ]
        if not prod_links:
            return None
        final_url = prod_links[0]
        resp = safe_get(session, final_url)
        if not resp:
            return None
        soup = BeautifulSoup(resp.text, "lxml")

    # Name
    h1 = soup.find("h1")
    name = h1.get_text(" ", strip=True) if h1 else ""

    # Image – WooCommerce gallery
    images = []
    for img in soup.select(".woocommerce-product-gallery img"):
        src = img.get("data-large_image") or img.get("src", "")
        if src and "logo" not in src.lower() and "bg_cat" not in src.lower() and src not in images:
            if src.startswith("//"):
                src = "https:" + src
            images.append(src)
    # Fallback to any wp-content/uploads image that isn't a banner
    if not images:
        for img in soup.find_all("img"):
            src = img.get("src", "")
            if ("uploads" in src and "logo" not in src.lower()
                    and "bg_cat" not in src.lower() and src not in images):
                images.append(src)
            if len(images) >= 3:
                break

    if not name:
        return None

    return PartResult(
        official_name=name,
        sku=part_id,
        price_usd="",  # B2B login required
        image_urls=images,
        source_url=final_url,
        store_name="TapeTech Official",
    )


# ---------------------------------------------------------------------------
# Store 4 – WallTools  (BigCommerce)
# Parts URL: https://walltools.com/automatic-taping-tools/taping-tool-parts-repair-kits-accessories/tapetech-parts/
# ---------------------------------------------------------------------------

WALLTOOLS_BASE = "https://walltools.com"
WALLTOOLS_PARTS = (
    "https://walltools.com/automatic-taping-tools/"
    "taping-tool-parts-repair-kits-accessories/tapetech-parts/"
)


def scrape_walltools(
    session: requests.Session, part_id: str, part_name: str
) -> Optional[PartResult]:
    """Search WallTools BigCommerce store for a TapeTech part.

    WallTools carries TapeTech repair kits and sub-assemblies.
    Individual piece parts (6-digit IDs) may not all be listed;
    this scraper is used as a fallback for kits and sub-assemblies.
    """
    # Try part_id first, then part_name if no results
    for query in [part_id, f"tapetech {part_name}"]:
        search_url = (
            f"{WALLTOOLS_BASE}/search.php"
            f"?search_query={urllib.parse.quote_plus(query)}"
        )
        resp = safe_get(session, search_url)
        if not resp:
            continue

        soup = BeautifulSoup(resp.text, "lxml")
        card = None
        for c in soup.select(".card"):
            title_el = c.select_one(".card-title a, h3.card-title a")
            txt = (title_el.get_text() if title_el else "").lower()
            # Only accept if "tapetech" appears in the card
            if "tapetech" in txt or "tape tech" in txt:
                card = c
                break

        if card is None:
            continue

        title_el = card.select_one(".card-title a, h3.card-title a")
        name = title_el.get_text(" ", strip=True) if title_el else ""

        price_el = card.select_one(".price--main")
        price = price_el.get_text(strip=True) if price_el else ""

        img_el = card.select_one(".card-figure img")
        image = _best_srcset_url(img_el) if img_el else ""

        link_el = card.select_one(".card-title a")
        prod_url = link_el.get("href", "").split("?")[0] if link_el else ""

        if name or price:
            return PartResult(
                official_name=name,
                sku=part_id,
                price_usd=price,
                image_urls=[image] if image else [],
                source_url=prod_url or WALLTOOLS_PARTS,
                store_name="WallTools",
            )

    return None


# ---------------------------------------------------------------------------
# Store 5 – Timothy's Toolbox  (Shopify)
# TapeTech collection: https://www.timothystoolbox.com/collections/tapetech
# ---------------------------------------------------------------------------

TIMOTHYS_BASE = "https://www.timothystoolbox.com"
TIMOTHYS_PARTS = "https://www.timothystoolbox.com/collections/tapetech"


def scrape_timothys(
    session: requests.Session, part_id: str, part_name: str
) -> Optional[PartResult]:
    """Search Timothy's Toolbox Shopify store for a TapeTech part.

    Timothy's carries complete TapeTech tools and some individual parts.
    Uses the Shopify Storefront predictive-search API for fast, accurate
    matching. Falls back to the /search endpoint if the suggest API returns
    no results.
    """
    # Try Shopify predictive search (fastest)
    for query in [part_id, f"TapeTech {part_name}"]:
        suggest_url = (
            f"{TIMOTHYS_BASE}/search/suggest.json"
            f"?q={urllib.parse.quote_plus(query)}"
            "&resources[type]=product&resources[limit]=5"
        )
        resp = safe_get(session, suggest_url, as_json=True)
        products = []
        if resp:
            try:
                data = resp.json()
                products = (
                    data.get("resources", {})
                    .get("results", {})
                    .get("products", [])
                )
            except ValueError:
                pass

        if not products:
            continue

        # Prefer a result whose title/url contains the part_id
        best = None
        for p in products:
            if part_id in p.get("title", "") or part_id in p.get("url", ""):
                best = p
                break
        if best is None:
            best = products[0]

        title = best.get("title", "").strip()
        price_raw = best.get("price", "")
        # Shopify returns price as cents integer string e.g. "56000" → $560.00
        price = ""
        if price_raw:
            try:
                price = f"${float(price_raw) / 100:.2f}"
            except (ValueError, TypeError):
                price = str(price_raw)

        image = best.get("featured_image", {}).get("url", "") if isinstance(best.get("featured_image"), dict) else best.get("image", "")
        prod_url = TIMOTHYS_BASE + best.get("url", "")

        if title or price:
            return PartResult(
                official_name=title,
                sku=part_id,
                price_usd=price,
                image_urls=[image] if image else [],
                source_url=prod_url,
                store_name="Timothy's Toolbox",
            )

    return None


# ---------------------------------------------------------------------------
# Enrichment orchestrator
# ---------------------------------------------------------------------------

SCRAPERS = [
    ("All-Wall",             scrape_allwall),
    ("Al's Taping Tools",    scrape_alstapin),
    ("TapeTech Official",    scrape_tapetech_official),
    ("WallTools",            scrape_walltools),
    ("Timothy's Toolbox",    scrape_timothys),
]


def enrich_part(
    session: requests.Session,
    part_id: str,
    part_name: str,
    delay: float,
) -> PartResult:
    """Try each store in order and merge the best data across all sources.

    Strategy:
      1. All-Wall (JSON API) → best source for name, price, and stock status.
      2. Al's Taping Tools (BigCommerce) → confirms price; provides image if
         All-Wall image is missing or low-quality.
      3. TapeTech Official (WooCommerce) → price hidden; best source for the
         manufacturer's own product image.
      4. WallTools (BigCommerce) → fallback for kits/sub-assemblies.
      5. Timothy's Toolbox (Shopify) → last resort; mainly complete tools.

    We stop early once we have all three of: official_name, price_usd, image_urls.
    Otherwise we continue through all stores and merge the best fields.
    """
    results = []
    found_name = False
    found_price = False
    found_image = False

    for store_label, scraper_fn in SCRAPERS:
        # Stop only after gathering from the primary two stores if we have everything
        if found_name and found_price and found_image and len(results) >= 2:
            break

        try:
            result = scraper_fn(session, part_id, part_name)
        except Exception as exc:
            result = None
            print(f"    [{store_label}] ERROR: {exc}", flush=True)

        time.sleep(delay)

        if result and result.is_useful():
            results.append(result)
            found_name  = found_name  or bool(result.official_name)
            found_price = found_price or bool(result.price_usd)
            found_image = found_image or bool(result.image_urls)
            label = " ".join(filter(None, [
                "✓name"  if result.official_name else "",
                "✓price" if result.price_usd else "",
                f"✓{len(result.image_urls)}img" if result.image_urls else "",
            ]))
            print(f"    [{result.store_name}] {label}", flush=True)
        else:
            print(f"    [{store_label}] not found", flush=True)

    if not results:
        return PartResult(sku=part_id)

    # ------------------------------------------------------------------ merge
    # Build the best composite result:
    #   - official_name : prefer All-Wall → TapeTech Official → Al's
    #   - price_usd     : prefer All-Wall → Al's → WallTools
    #   - image_urls    : merge from all sources, deduped
    #   - source_url    : from the result that provided the most data
    #   - store_name    : comma-joined list of contributing stores

    def score(r: PartResult) -> int:
        return (
            bool(r.official_name) * 4
            + bool(r.price_usd) * 3
            + min(len(r.image_urls), 4)
        )

    primary = max(results, key=score)

    merged_name  = next((r.official_name for r in results if r.official_name), "")
    merged_price = next((r.price_usd for r in results if r.price_usd), "")
    merged_sku   = next((r.sku for r in results if r.sku and r.sku != part_id), part_id)

    # Collect all images in priority order: TapeTech → All-Wall → Al's → others
    prio_order = ["TapeTech Official", "All-Wall", "Al's Taping Tools", "WallTools", "Timothy's Toolbox"]
    all_images: list = []
    seen_imgs: set = set()
    for store_prio in prio_order:
        for r in results:
            if r.store_name == store_prio:
                for img in r.image_urls:
                    if img not in seen_imgs:
                        all_images.append(img)
                        seen_imgs.add(img)
    # Any remaining images not yet collected
    for r in results:
        for img in r.image_urls:
            if img not in seen_imgs:
                all_images.append(img)
                seen_imgs.add(img)

    contributing_stores = ", ".join(dict.fromkeys(r.store_name for r in results))

    return PartResult(
        official_name=merged_name,
        sku=merged_sku,
        price_usd=merged_price,
        image_urls=all_images,
        source_url=primary.source_url,
        store_name=contributing_stores,
    )


# ---------------------------------------------------------------------------
# CSV I/O
# ---------------------------------------------------------------------------

ENRICHED_COLUMNS = [
    "Part Label ID",
    "Part Name",
    "Tool Name",
    "Brand",
    "Quantity Each",
    "Sold As Part Of",
    "Official Part Name",
    "SKU",
    "Price USD",
    "Image URLs",
    "Source URL",
    "Stores",
    "Scraped At",
]


def load_baseline(path: str) -> list:
    """Load the baseline TapeTech parts catalog."""
    parts = []
    with open(path, newline="", encoding="utf-8-sig", errors="replace") as f:
        reader = csv.DictReader(f)
        for row in reader:
            parts.append(dict(row))
    return parts


def load_existing_enriched(path: str) -> dict:
    """Load already-enriched rows keyed by Part Label ID (for --resume)."""
    if not os.path.isfile(path):
        return {}
    enriched = {}
    with open(path, newline="", encoding="utf-8-sig", errors="replace") as f:
        reader = csv.DictReader(f)
        for row in reader:
            pid = row.get("Part Label ID", "").strip()
            if pid:
                enriched[pid] = row
    return enriched


def write_enriched_csv(path: str, rows: list):
    """Write all enriched rows to the output CSV."""
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=ENRICHED_COLUMNS, extrasaction="ignore")
        writer.writeheader()
        writer.writerows(rows)


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def parse_args():
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--limit",   type=int,   default=None,               help="Process only first N parts")
    p.add_argument("--delay",   type=float, default=1.5,                help="Seconds between HTTP requests (default: 1.5)")
    p.add_argument("--resume",  action="store_true",                    help="Skip parts already in the output CSV")
    p.add_argument("--output",  type=str,   default=DEFAULT_OUTPUT_CSV, help="Output CSV path")
    return p.parse_args()


def main():
    args = parse_args()

    if not os.path.isfile(BASELINE_CSV):
        print(f"ERROR: Baseline catalog not found: {BASELINE_CSV}", file=sys.stderr)
        sys.exit(1)

    parts = load_baseline(BASELINE_CSV)
    total = len(parts)
    print(f"Loaded {total} parts from baseline catalog.")

    existing = {}
    if args.resume:
        existing = load_existing_enriched(args.output)
        print(f"Resuming: {len(existing)} parts already enriched.")

    if args.limit:
        parts = parts[: args.limit]
        print(f"Processing first {len(parts)} part(s) (--limit {args.limit}).")

    session = make_session()
    enriched_rows = []
    scraped_at = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")

    for i, part in enumerate(parts, start=1):
        part_id   = (part.get("Part Label ID") or "").strip()
        part_name = (part.get("Part Name") or "").strip()
        tool_name = (part.get("Tool Name") or "").strip()

        if not part_id:
            continue

        print(f"[{i}/{len(parts)}] {part_id}  –  {part_name}", flush=True)

        if args.resume and part_id in existing:
            enriched_rows.append(existing[part_id])
            print("  (skipped – already enriched)", flush=True)
            continue

        result = enrich_part(session, part_id, part_name, args.delay)

        row = {
            "Part Label ID":    part_id,
            "Part Name":        part_name,
            "Tool Name":        tool_name,
            "Brand":            part.get("Brand", "TapeTech"),
            "Quantity Each":    part.get("Quantity Each", ""),
            "Sold As Part Of":  part.get("Sold As Part Of", ""),
            "Official Part Name": result.official_name,
            "SKU":              result.sku,
            "Price USD":        result.price_usd,
            "Image URLs":       " | ".join(result.image_urls),
            "Source URL":       result.source_url,
            "Stores":           result.store_name,
            "Scraped At":       scraped_at,
        }
        enriched_rows.append(row)

        # Incremental save every 50 parts to preserve progress
        if i % 50 == 0:
            write_enriched_csv(args.output, enriched_rows)
            print(f"  → Checkpoint saved ({i} rows written to {args.output})", flush=True)

    # Final write
    write_enriched_csv(args.output, enriched_rows)
    enriched_count   = sum(1 for r in enriched_rows if r.get("Official Part Name") or r.get("Price USD"))
    unenriched_count = len(enriched_rows) - enriched_count

    print(
        f"\nDone. {len(enriched_rows)} rows written to {args.output}\n"
        f"  Enriched (name or price found): {enriched_count}\n"
        f"  Not found on any store:         {unenriched_count}"
    )


if __name__ == "__main__":
    main()
