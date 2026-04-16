#!/usr/bin/env python3
"""
Scrape walltools.com for Columbia Taping Tools product images and build a
source CSV that audit_catalog_images.py can consume.

Usage
-----
  # Full scrape + match (slow — fetches ~400 product pages):
  python scripts/scrape_columbia_images.py

  # Skip the network scrape, only re-generate CSV from cached JSON:
  python scripts/scrape_columbia_images.py --match-only

  # Use an alternate walltools catalog cache file:
  python scripts/scrape_columbia_images.py --cache /tmp/my-cache.json

Output
------
  scripts/scraped_results/Columbia/columbia_walltools.csv
    SKU, MPN, Images

  A /tmp/walltools_columbia_cache.json cache file for re-runs.

Source: walltools.com — carries Columbia Taping Tools
"""

from __future__ import annotations

import argparse
import csv
import json
import re
import sys
import time
import urllib.parse
import urllib.request
from pathlib import Path
from typing import Iterator

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/120 Safari/537.36"
    )
}

WALLTOOLS_BC_STORE = "s-tircj30irf"

COLUMBIA_CATEGORY_URLS: list[str] = [
    # Primary parts category (paginated)
    "https://walltools.com/automatic-taping-tools/"
    "taping-tool-parts-repair-kits-accessories/columbia-taping-tools-parts/",
    # Alternate brand pages
    "https://walltools.com/columbiaparts/",
    "https://walltools.com/columbia/",
    # Tool-type categories that carry Columbia products
    "https://walltools.com/automatic-taping-tools/angle-heads/",
    "https://walltools.com/automatic-taping-tools/smoothing-blades/",
    "https://walltools.com/automatic-taping-tools/corner-boxes/",
    "https://walltools.com/automatic-taping-tools/corner-rollers/",
    "https://walltools.com/automatic-taping-tools/flat-boxes/",
    "https://walltools.com/automatic-taping-tools/loading-pumps/",
    "https://walltools.com/automatic-taping-tools/nail-spotters/",
    "https://walltools.com/automatic-taping-tools/automatic-tapers/",
    "https://walltools.com/automatic-taping-tools/handles/",
]

DEFAULT_CACHE = Path("/tmp/walltools_columbia_cache.json")

REPO_ROOT = Path(__file__).resolve().parent.parent
DEFAULT_CATALOG = REPO_ROOT / "frontend/public/wp-catalog.csv"
OUTPUT_DIR = REPO_ROOT / "scripts/scraped_results/Columbia"
OUTPUT_CSV = OUTPUT_DIR / "columbia_walltools.csv"


# ---------------------------------------------------------------------------
# HTTP helpers
# ---------------------------------------------------------------------------

def fetch(url: str, timeout: int = 15) -> str:
    req = urllib.request.Request(url, headers=HEADERS)
    with urllib.request.urlopen(req, timeout=timeout) as r:  # nosec B310
        return r.read().decode("utf-8", "replace")


# ---------------------------------------------------------------------------
# Scraping
# ---------------------------------------------------------------------------

def _best_image(block_html: str) -> str:
    """Return the highest-resolution BigCommerce image URL found in a card block."""
    for width in ("1280w", "960w", "500x659", "500x500"):
        m = re.search(rf"stencil/{re.escape(width)}/products/[^\"?]+", block_html)
        if m:
            return (
                f"https://cdn11.bigcommerce.com/{WALLTOOLS_BC_STORE}/images/"
                + m.group(0)
            )
    return ""


def _extract_cards(html: str) -> Iterator[dict[str, str]]:
    """Yield dicts {url, slug, title, image} for each product card."""
    for block in re.findall(r"<article class=\"card[^\"]*\".*?</article>", html, re.S):
        href = re.search(r'<a href="(https://walltools\.com/[^"]+)"', block)
        title = re.search(r'alt="([^"]+)"', block)
        img = _best_image(block)
        if href and img:
            prod_url = href.group(1)
            yield {
                "url": prod_url,
                "slug": prod_url.rstrip("/").split("/")[-1],
                "title": title.group(1) if title else "",
                "image": img,
            }


def _max_page(html: str) -> int:
    nums = [int(n) for n in re.findall(r"[?&]page=(\d+)", html)]
    return max(nums, default=1)


def scrape_category(base_url: str, catalog: dict[str, dict]) -> int:
    """Scrape a walltools category URL (all pages) and add unique products to catalog."""
    added = 0
    try:
        html = fetch(base_url)
    except Exception as exc:
        print(f"  WARN: {base_url}: {exc}", file=sys.stderr)
        return 0

    # Only process pages that mention Columbia
    if len(re.findall(r"columbia", html, re.I)) < 3:
        return 0

    max_pg = _max_page(html)
    for card in _extract_cards(html):
        if card["url"] not in catalog:
            catalog[card["url"]] = card
            added += 1

    for page in range(2, max_pg + 1):
        sep = "&" if "?" in base_url else "?"
        try:
            html2 = fetch(f"{base_url}{sep}page={page}")
        except Exception as exc:
            print(f"  WARN page {page}: {exc}", file=sys.stderr)
            break
        for card in _extract_cards(html2):
            if card["url"] not in catalog:
                catalog[card["url"]] = card
                added += 1
        time.sleep(0.3)

    return added


def scrape_product_details(
    catalog: dict[str, dict],
    details: dict[str, dict],
) -> None:
    """For each product not yet in details, fetch its page and extract COLM SKU + images."""
    todo = [
        (url, v)
        for url, v in catalog.items()
        if url not in details
        and "columbia" in (v.get("title", "") + v.get("slug", "")).lower()
    ]
    print(f"  Fetching {len(todo)} Columbia product detail pages …")
    for i, (url, v) in enumerate(todo):
        try:
            html = fetch(url)
        except Exception:
            continue

        schema_sku = re.search(r'"sku"\s*:\s*"([^"]+)"', html)
        img_1280 = re.search(r"stencil/1280x1280/products/[^\"?]+", html)
        img_500 = re.search(r"stencil/500x659/products/[^\"?]+", html)
        img_path = img_1280 or img_500
        best_img = (
            f"https://cdn11.bigcommerce.com/{WALLTOOLS_BC_STORE}/images/"
            + img_path.group(0)
            if img_path
            else v["image"]
        )
        all_colm = list(set(re.findall(r"COLM-([A-Z0-9][A-Z0-9\-]*)", html)))

        details[url] = {
            "url": url,
            "slug": v["slug"],
            "title": v["title"],
            "colm_sku": schema_sku.group(1) if schema_sku else "",
            "all_colm_codes": all_colm,
            "image": best_img,
        }

        if (i + 1) % 50 == 0:
            print(f"    … {i + 1}/{len(todo)} pages fetched")
        time.sleep(0.15)


def run_scrape(cache_path: Path) -> dict[str, dict]:
    """Scrape walltools and return the details dict; save to cache."""
    print("Scraping walltools.com for Columbia products …")
    catalog: dict[str, dict] = {}
    for base_url in COLUMBIA_CATEGORY_URLS:
        added = scrape_category(base_url, catalog)
        print(f"  {base_url[-60:]}: +{added} (total {len(catalog)})")
        time.sleep(0.4)

    print(f"\nTotal walltools products found: {len(catalog)}")

    # Fetch individual pages for COLM SKU codes + higher-res images
    details: dict[str, dict] = {}
    scrape_product_details(catalog, details)

    cache_path.parent.mkdir(parents=True, exist_ok=True)
    cache_path.write_text(json.dumps(details, indent=2), encoding="utf-8")
    print(f"\nCache saved: {cache_path}")
    return details


# ---------------------------------------------------------------------------
# Matching helpers
# ---------------------------------------------------------------------------

def _norm(s: str) -> str:
    """Remove all non-alphanumeric characters and uppercase."""
    return re.sub(r"[^A-Z0-9]", "", s.upper())


def _strip_trailing_letter_suffix(sku: str) -> str:
    """Remove common trailing letter suffixes: -A, -A2, -B, etc."""
    return re.sub(r"-[A-Z]\d*$", "", sku.upper())


def _compact_numeric(s: str) -> str:
    """CT-084A → CT84A (strip hyphens, remove leading zeros from numeric run)."""
    cleaned = re.sub(r"[^A-Z0-9]", "", s.upper())
    # Remove leading zeros from runs of digits embedded in the string
    return re.sub(r"(?<=[A-Z])0+(\d)", r"\1", cleaned)


def candidate_keys(sku: str) -> list[str]:
    """Return ordered list of lookup keys to try for a given SKU."""
    u = sku.upper().strip()
    n = _norm(u)
    keys: list[str] = [n, _compact_numeric(n)]

    # Strip -A, -A2, -B suffix
    stripped = _norm(_strip_trailing_letter_suffix(u))
    keys += [stripped, _compact_numeric(stripped)]

    # Strip trailing single letter after digits: CT128A → CT128
    m = re.match(r"^([A-Z][A-Z0-9]*\d+)([A-Z])$", n)
    if m:
        keys.append(m.group(1))

    # Strip trailing letter+digits suffix: 809526A2 → 809526
    stripped2 = re.sub(r"[A-Z]\d+$", "", n)
    if stripped2 != n:
        keys.append(stripped2)

    # Space removal: COL2 KIT → COL2KIT
    keys.append(n.replace(" ", ""))

    # Columbia "One" prefix: C1SPTAPER → SPTAPER
    m2 = re.match(r"^C1([A-Z].+)$", n)
    if m2:
        keys.append(m2.group(1))

    seen: list[str] = []
    for k in keys:
        if k and k not in seen:
            seen.append(k)
    return seen


def build_colm_index(details: dict[str, dict]) -> dict[str, dict]:
    """Build index: normalized COLM-code → detail dict."""
    idx: dict[str, dict] = {}
    for _url, v in details.items():
        if not v.get("image"):
            continue
        # Primary: schema.org SKU (e.g. "COLM-TSB14")
        colm = v.get("colm_sku", "")
        if colm:
            code = re.sub(r"^COLM-?", "", colm, flags=re.I)
            idx.setdefault(_norm(code), v)
            idx.setdefault(_compact_numeric(code), v)
        # Secondary: all COLM codes mentioned on the page
        for c in v.get("all_colm_codes", []):
            idx.setdefault(_norm(c), v)
            idx.setdefault(_compact_numeric(c), v)
    return idx


# ---------------------------------------------------------------------------
# Name-based fuzzy matching (for parts that lack explicit COLM codes)
# ---------------------------------------------------------------------------

_STOP = frozenset(
    "columbia taping tools in inch the a for and or of with replacement new "
    "style pre old non automatic".split()
)


def _kw(text: str) -> frozenset[str]:
    # Strip HTML entities before tokenising
    clean = re.sub(r"&[a-z]+;", " ", text)
    words = re.findall(r"[a-z]+", clean.lower())
    return frozenset(w for w in words if w not in _STOP and len(w) >= 3)


def _size(text: str) -> str:
    """Extract the primary inch-size from a product name.

    Skips numbers that are part of thread/fraction specs like 1/4-20 or 1-1/2.
    Matches standalone integers or decimals immediately before ``"`` or ``in.``.
    """
    m = re.search(r'(?<![0-9/])(\d+(?:\.\d+)?)(?:\s*"|(?:\s+in\.?\b))', text, re.I)
    return m.group(1) if m else ""


def name_match(
    name: str,
    details: dict[str, dict],
    min_score: int = 3,
    colm_idx: dict[str, dict] | None = None,
) -> dict | None:
    """Return the best-matching walltools detail dict by product name similarity.

    Two extra heuristics beyond keyword overlap:

    1. Model-code extraction – recognises patterns like "Columbia AH5 - …" or
       "Columbia CT128 - …" and performs a COLM-code lookup first (high
       confidence, no score threshold needed).

    2. HTML-entity stripping – walltools titles contain ``&amp;``, ``&quot;``,
       etc. which are decoded before comparison.
    """
    # Strip HTML entities from name before comparison
    clean_name = re.sub(r"&[a-z]+;", " ", name)
    our_kw = _kw(clean_name)
    our_sz = _size(clean_name)

    # Heuristic 1 – embedded model codes in the name
    # Patterns: "Columbia AH5 - …", "Columbia CT128 - …", "(COL3.5 KIT)"
    embedded_codes: list[str] = []
    m_dash = re.search(r"^Columbia\s+([A-Z0-9][A-Z0-9\-\.]+)\s+-\s+", clean_name, re.I)
    if m_dash:
        embedded_codes.append(m_dash.group(1))
    embedded_codes += re.findall(r"\(([A-Z][A-Z0-9\-\.]+)\)", clean_name)

    if colm_idx and embedded_codes:
        for code in embedded_codes:
            for key in candidate_keys(code):
                if key in colm_idx:
                    return colm_idx[key]

    best: dict | None = None
    best_score = 0

    for v in details.values():
        if not v.get("image"):
            continue
        # Strip HTML entities from walltools title
        clean_title = re.sub(r"&[a-z]+;", " ", v["title"])
        their_kw = _kw(clean_title)
        their_sz = _size(clean_title)

        # Size must match when both are present
        if our_sz and their_sz and our_sz != their_sz:
            continue

        overlap = len(our_kw & their_kw)
        if overlap < 2:
            continue

        sz_bonus = 2 if (our_sz and their_sz and our_sz == their_sz) else 0
        sz_penalty = -1 if (our_sz and not their_sz) else 0
        score = overlap + sz_bonus + sz_penalty

        if score >= min_score and score > best_score:
            best_score = score
            best = v

    return best


# ---------------------------------------------------------------------------
# Build match table
# ---------------------------------------------------------------------------

def build_match_table(
    catalog_path: Path,
    details: dict[str, dict],
) -> list[dict[str, str]]:
    """
    Return rows [{"SKU", "MPN", "Images", "source", "wt_title"}] for every
    Columbia part that is currently missing an image and has a candidate.
    """
    with catalog_path.open("r", encoding="utf-8", newline="") as fh:
        rows = list(csv.DictReader(fh))

    def is_missing(r: dict) -> bool:
        imgs = (r.get("Images") or "").strip().lower()
        if not imgs:
            return True
        return any(t in imgs for t in ("placeholder", "no-image", "no_image"))

    missing = [
        r
        for r in rows
        if r.get("Brands") == "Columbia Taping Tools" and is_missing(r)
    ]
    print(f"Missing Columbia images in catalog: {len(missing)}")

    idx = build_colm_index(details)

    # ---------------------------------------------------------------------------
    # Manual overrides: SKUs that don't match algorithmically but have
    # a clear best walltools proxy.  Maps our SKU → walltools COLM SKU to use.
    # These are all cases where our SKU is the Columbia internal part number
    # (e.g. 809526-A2, FA209) but walltools sells the same physical part under
    # a different catalogue code.
    # ---------------------------------------------------------------------------
    MANUAL_PROXY_CODES: dict[str, str] = {
        # Angle Head Carbide Blades (AH32 = 2", AH35 = 3.5" etc.)
        # COLM-AH3 covers all sizes 2/2.5/3/3.5 in the same listing.
        "AH32": "AH3",
        "AH35": "AH3",
        "AH325": "AH3",
        "AH33": "AH3",
        # Angle Head Rebuild / Blade Maintenance Kits → Blade Repair Kit image
        "COL2KIT": "AHR-BK",
        "COL3KIT": "AHR-BK",
        "COL25KIT": "AHR-BK",
        "COL35KIT": "AHR-BK",
        "AHRBK35": "AHR-BK",
        "AHRBK3": "AHR-BK",
        "AHRBK25": "AHR-BK",
        "AHRBK2": "AHR-BK",
        # Columbia "One" tapers: strip C1 prefix, fall back to base model
        "C1PTAPER": "PREDATOR",
        "C1TBPTAPER": "TBGN",   # Tall Boy model → Tall Boy Gooseneck
        "C1SPTAPER": "SPTAPER",
        "C1TBBODY": "TBGN",
        # Thread adapter → Cam Lock Tube Hollow Adapter image
        "CTTPHA": "CLTHA",
        # Hex Bolt (805865-A) → COLM-FA299 (same bolt, different catalogue code)
        "805865A": "FA299",
        "FA326": "FA224",   # Rivet → similar pin/split-pin product
        # Flusher parts (CF-xxx = Corner/Combo Flusher internal parts)
        # Best proxy: Standard Flushers unit image
        "CF6": "SF-X",
        "CF1C": "SF-X",
        "CF2": "SF-X",
        "CF7": "SF-X",
        "CF8": "SF-X",
        "CF38": "SF-X",
        "COL3CSF": "SF-X",
        # Nail Spotter parts without COLM equivalents
        # Standard Nail Spotter parts → NS (3" Nail Spotter unit)
        "NS32": "NS",
        "NS33": "NS",
        "NS28": "FFB4A",     # Square Washer → Stainless Steel Washer
        "NS27": "FFB4A",     # L Washer → Stainless Steel Washer
        "NS92": "CFB15",     # Hinge 2" → Door Hinge
        "NS93": "CFB15",     # Hinge 3" → Door Hinge
        "NS282": "FFB4A",
        "NS272": "FFB4A",
        # Hinged Nail Spotter side plates → closest is HNS8-2/3 (blade holders)
        "HNS3A3": "HNS8-3",
        "HNS3A2": "HNS8-2",
        "HNS33": "HNS8-3",
        "HNS32": "HNS8-2",
        # HH26 = E-Clip → Extension Release Clip
        "HH26": "HH30",
        # ICATW1 = Body for ICATW → use standard ICATW product
        "ICATW1": "ICATW",
        # CMT Draw Tube → Compound Mud Tube unit
        "CMT1A22": "CMT",
        # BH8-3 = Box Handle → use 3ft Brake Connecting Strap (3 ft)
        "BH83": "BH9-3",
        # SB7 = Tomahawk Handle Fitting → closest is TSB7 (7" Tomahawk)
        "SB7": "TSB7",
        # Sander parts → Columbia Sander unit
        "S4": "CS",
        "S6": "CS",
        # Predator-specific small parts → Predator image
        "C154": "PREDATOR",
        "C159": "PREDATOR",
        "PA214": "PREDATOR",
        "FAJ144": "FA224",   # Joint Fastener → split pin
        "FAJ706": "FA224",
        "FG445": "CFB4-7",   # 45° Corner Guide → Corner Box Door
    }

    def proxy_lookup(sku: str) -> dict | None:
        """Look up the manual proxy for a given SKU."""
        norm_sku = _norm(sku)
        target_code = MANUAL_PROXY_CODES.get(norm_sku)
        if not target_code:
            return None
        for key in [_norm(target_code), _compact_numeric(target_code)]:
            if key in idx:
                return idx[key]
        return None

    results: list[dict[str, str]] = []
    colm_matches = 0
    name_matches = 0
    unresolved: list[str] = []

    for r in missing:
        sku = (r.get("SKU") or "").strip()
        mpn = (r.get("MPN") or "").strip()
        name = (r.get("Name") or "").strip()

        found: dict | None = None
        match_type = ""

        # 1) COLM-code lookup using all candidate key variants
        for key_source in [sku, mpn]:
            for key in candidate_keys(key_source):
                if key in idx:
                    found = idx[key]
                    match_type = "colm"
                    break
            if found:
                break

        # 2) Name-based fuzzy match (passes idx for embedded-code lookup)
        if not found and name:
            # Use a lower threshold (min_score=2) so hardware parts
            # (washers, screws, bolts) resolve to same-type Columbia parts.
            found = name_match(name, details, min_score=2, colm_idx=idx)
            if found:
                match_type = "name"

        # 3) Manual proxy lookup for parts not algorithmically matched
        if not found:
            found = proxy_lookup(sku)
            if found:
                match_type = "proxy"

        if found and found.get("image"):
            if match_type == "colm":
                colm_matches += 1
            else:
                name_matches += 1
            results.append(
                {
                    "SKU": sku,
                    "MPN": mpn,
                    "Images": found["image"],
                    "match_type": match_type,
                    "wt_sku": found.get("colm_sku", ""),
                    "wt_title": found.get("title", ""),
                }
            )
        else:
            unresolved.append(sku)

    print(
        f"  COLM-code matches : {colm_matches}\n"
        f"  Name-fuzzy matches: {name_matches}\n"
        f"  Unresolved        : {len(unresolved)}"
    )
    if unresolved:
        print("  Unresolved SKUs:")
        for s in unresolved[:30]:
            print(f"    {s}")
        if len(unresolved) > 30:
            print(f"    … and {len(unresolved) - 30} more")

    return results


# ---------------------------------------------------------------------------
# Write output CSV
# ---------------------------------------------------------------------------

def write_output_csv(rows: list[dict[str, str]], output_path: Path) -> None:
    output_path.parent.mkdir(parents=True, exist_ok=True)
    fieldnames = ["SKU", "MPN", "Images", "match_type", "wt_sku", "wt_title"]
    with output_path.open("w", encoding="utf-8", newline="") as fh:
        writer = csv.DictWriter(fh, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)
    print(f"\nOutput CSV: {output_path}  ({len(rows)} rows)")


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument(
        "--match-only",
        action="store_true",
        help="Skip scraping; load from cache and regenerate the output CSV only.",
    )
    p.add_argument(
        "--cache",
        default=str(DEFAULT_CACHE),
        help=f"Cache JSON path (default: {DEFAULT_CACHE})",
    )
    p.add_argument(
        "--catalog",
        default=str(DEFAULT_CATALOG),
        help=f"wp-catalog.csv path (default: {DEFAULT_CATALOG})",
    )
    p.add_argument(
        "--output",
        default=str(OUTPUT_CSV),
        help=f"Output CSV path (default: {OUTPUT_CSV})",
    )
    return p.parse_args()


def main() -> int:
    args = parse_args()
    cache_path = Path(args.cache)
    catalog_path = Path(args.catalog)
    output_path = Path(args.output)

    if args.match_only:
        if not cache_path.exists():
            print(f"Cache file not found: {cache_path}", file=sys.stderr)
            return 1
        print(f"Loading cache: {cache_path}")
        details = json.loads(cache_path.read_text(encoding="utf-8"))
    else:
        details = run_scrape(cache_path)

    print(f"\nBuilding match table against {catalog_path} …")
    rows = build_match_table(catalog_path, details)
    write_output_csv(rows, output_path)

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
