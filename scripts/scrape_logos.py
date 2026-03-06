#!/usr/bin/env python3
"""
Official Brand Logo Scraper for ALLOWED_BRANDS
Scrapes and downloads the highest-quality official logos from each brand's
official website or authoritative archived/distributor source.

ALLOWED_BRANDS:
  - Asgard              → asgardtools.com (official site, via Wayback Machine archive)
  - Columbia Taping Tools → alstapingtools.com CDN (authorized distributor logo image)
  - Graco               → graco.com (official website header SVG)
  - Spray King          → sprayking.com (official site, via Wayback Machine archive)
  - SurPro              → stilts.com (official SurPro/Sur-Pro website CDN)
  - TapeTech            → tapetech.com (official website uploads)

Usage:
    python3 scripts/scrape_logos.py

Requirements:
    pip install requests beautifulsoup4 lxml

Output:
    scraped_results/logos/
    ├── logos_summary.json
    ├── Asgard/
    │   ├── asgard_logo_header_wglow_v3.png
    │   └── logo_manifest.json
    ├── Columbia_Taping_Tools/
    │   ├── columbia_taping_tools_logo.jpeg
    │   └── logo_manifest.json
    ├── Graco/
    │   ├── graco_logo.svg
    │   └── logo_manifest.json
    ├── Spray_King/
    │   ├── spray_king_logo.gif
    │   └── logo_manifest.json
    ├── SurPro/
    │   ├── surpro_logo.png
    │   └── logo_manifest.json
    └── TapeTech/
        ├── tapetech_logo.png
        └── logo_manifest.json
"""

import os
import json
import time
import mimetypes
import requests
from bs4 import BeautifulSoup
from urllib.parse import urljoin, urlparse
from datetime import datetime, timezone

# ─────────────────────────────────────────────
# Configuration
# ─────────────────────────────────────────────
REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUTPUT_DIR = os.path.join(REPO_ROOT, "scraped_results", "logos")

ALLOWED_BRANDS = [
    "Asgard",
    "Columbia Taping Tools",
    "Graco",
    "Spray King",
    "SurPro",
    "TapeTech",
]

BRAND_OUTPUT_DIRS = {
    "Asgard":                 os.path.join(OUTPUT_DIR, "Asgard"),
    "Columbia Taping Tools":  os.path.join(OUTPUT_DIR, "Columbia_Taping_Tools"),
    "Graco":                  os.path.join(OUTPUT_DIR, "Graco"),
    "Spray King":             os.path.join(OUTPUT_DIR, "Spray_King"),
    "SurPro":                 os.path.join(OUTPUT_DIR, "SurPro"),
    "TapeTech":               os.path.join(OUTPUT_DIR, "TapeTech"),
}

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/120.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/svg+xml,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.5",
}

SESSION = requests.Session()
SESSION.headers.update(HEADERS)

# ─────────────────────────────────────────────
# Utilities
# ─────────────────────────────────────────────

def ensure_dir(path):
    os.makedirs(path, exist_ok=True)


def ext_from_url(url, content_type=None):
    """Derive a file extension from the URL path or Content-Type header."""
    parsed_path = urlparse(url).path
    _, ext = os.path.splitext(parsed_path)
    if ext.lower() in (".png", ".jpg", ".jpeg", ".svg", ".webp", ".gif"):
        return ext.lower()
    if content_type:
        ext_guess = mimetypes.guess_extension(content_type.split(";")[0].strip())
        if ext_guess:
            return ".jpg" if ext_guess in (".jpe", ".jpeg") else ext_guess
    return ".png"


def download_logo(url, out_dir, base_filename):
    """
    Download a logo image from url into out_dir.
    Returns the saved file path on success, or None on failure.
    """
    try:
        resp = SESSION.get(url, timeout=30, stream=True)
        resp.raise_for_status()
        content_type = resp.headers.get("Content-Type", "")
        ext = ext_from_url(url, content_type)
        dest = os.path.join(out_dir, f"{base_filename}{ext}")
        with open(dest, "wb") as f:
            for chunk in resp.iter_content(chunk_size=65536):
                if chunk:
                    f.write(chunk)
        size_kb = os.path.getsize(dest) // 1024
        print(f"    [OK]   {os.path.basename(dest)}  ({size_kb} KB)  ← {url}")
        return dest
    except requests.HTTPError as e:
        print(f"    [HTTP {e.response.status_code}] {url}")
        return None
    except Exception as e:
        print(f"    [FAIL] {url}: {e}")
        return None


def get_soup(url, timeout=20):
    """Fetch a URL and return a BeautifulSoup object (or None on failure)."""
    try:
        resp = SESSION.get(url, timeout=timeout, allow_redirects=True)
        resp.raise_for_status()
        return BeautifulSoup(resp.content, "lxml"), resp.url
    except Exception as e:
        print(f"  [ERR] Could not fetch {url}: {e}")
        return None, url


def find_logo_in_soup(soup, base_url, brand_keywords=None):
    """
    Heuristically find the best logo <img> in a BeautifulSoup page.
    Returns the absolute URL of the best candidate, or None.
    """
    brand_keywords = brand_keywords or []
    candidates = []

    for img in soup.find_all("img"):
        src = img.get("src") or img.get("data-src") or ""
        alt = (img.get("alt") or "").lower()
        cls = " ".join(img.get("class") or []).lower()
        iid = (img.get("id") or "").lower()

        if not src:
            continue

        score = 0
        src_lower = src.lower()

        if "logo" in src_lower:
            score += 40
        if "logo" in cls or "logo" in iid:
            score += 30
        if any(kw.lower() in src_lower for kw in brand_keywords):
            score += 20
        if any(kw.lower() in alt for kw in brand_keywords):
            score += 15
        if "header" in cls or "header" in iid:
            score += 10
        if "brand" in src_lower or "brand" in cls:
            score += 10

        if any(bad in src_lower for bad in ("icon", "favicon", "sprite", "arrow", "banner")):
            score -= 20
        if any(bad in src_lower for bad in ("placeholder", "spacer", "blank", "pixel")):
            score -= 50

        if src_lower.endswith(".svg"):
            score += 15
        elif src_lower.endswith(".png"):
            score += 8
        elif src_lower.endswith((".jpg", ".jpeg")):
            score += 5
        elif src_lower.endswith(".webp"):
            score += 3

        abs_src = urljoin(base_url, src)
        candidates.append((score, abs_src))

    if not candidates:
        return None

    candidates.sort(key=lambda x: x[0], reverse=True)
    best_score, best_url = candidates[0]
    print(f"    [LOGO] Best candidate (score={best_score}): {best_url}")
    return best_url if best_score > 0 else None


def _write_logo_manifest(brand, out_dir, result):
    """Write a JSON manifest for this brand's logo scrape."""
    manifest = {
        "brand": brand,
        "scraped_at": datetime.now(timezone.utc).isoformat(),
        "downloaded": result["downloaded"],
        "failed": result["failed"],
        "source_urls": result["source_urls"],
        "files": result["files"],
    }
    manifest_path = os.path.join(out_dir, "logo_manifest.json")
    with open(manifest_path, "w", encoding="utf-8") as f:
        json.dump(manifest, f, indent=2)
    print(f"  Manifest written: {manifest_path}")


def _try_known_then_scrape(
    known_candidates, scrape_url, brand_keywords, out_dir, base_filename, result
):
    """
    First try a list of known/guessed logo URLs. If none work, fall back to
    scraping the brand's homepage and heuristically picking the best logo.
    Returns the saved file path on success, or None.
    """
    for url in known_candidates:
        print(f"  Trying known URL: {url}")
        result["source_urls"].append(url)
        saved = download_logo(url, out_dir, base_filename)
        if saved:
            result["downloaded"] += 1
            result["files"].append({
                "filename": os.path.basename(saved),
                "source_url": url,
                "size_bytes": os.path.getsize(saved),
            })
            return saved
        time.sleep(0.3)

    if scrape_url:
        print(f"\n  Falling back to homepage scrape: {scrape_url}")
        soup, final_url = get_soup(scrape_url)
        if soup is None:
            print(f"  [ERR] Could not load {scrape_url}. Logo not downloaded.")
            result["failed"] += 1
            return None

        logo_url = find_logo_in_soup(soup, final_url, brand_keywords)
        if not logo_url:
            print(f"  [ERR] No logo found on {final_url}")
            result["failed"] += 1
            return None

        result["source_urls"].append(logo_url)
        saved = download_logo(logo_url, out_dir, base_filename)
        if saved:
            result["downloaded"] += 1
            result["files"].append({
                "filename": os.path.basename(saved),
                "source_url": logo_url,
                "size_bytes": os.path.getsize(saved),
            })
            return saved

    result["failed"] += 1
    return None


# ─────────────────────────────────────────────
# Brand scrapers
# ─────────────────────────────────────────────

# ── TapeTech ──────────────────────────────────────────────────────────────────
def scrape_tapetech():
    """
    TapeTech official website: tapetech.com
    Logo is the official 2024 brand mark uploaded to their WP media library.
    """
    brand = "TapeTech"
    out_dir = BRAND_OUTPUT_DIRS[brand]
    ensure_dir(out_dir)

    print(f"\n{'='*60}")
    print(f"  Scraping logo: {brand}")
    print(f"  Source       : https://www.tapetech.com")
    print(f"  Output       : {out_dir}")
    print(f"{'='*60}")

    result = {"brand": brand, "downloaded": 0, "failed": 0, "files": [], "source_urls": []}

    # Official 2024 TapeTech logo from tapetech.com WordPress uploads
    known_candidates = [
        "https://tapetech.com/wp-content/uploads/2024/05/TapeTech_logo_2c_2024.png",
        "https://www.tapetech.com/wp-content/uploads/2024/05/TapeTech_logo_2c_2024.png",
    ]

    saved = _try_known_then_scrape(
        known_candidates=known_candidates,
        scrape_url="https://www.tapetech.com",
        brand_keywords=["tapetech", "tape tech"],
        out_dir=out_dir,
        base_filename="tapetech_logo",
        result=result,
    )

    _write_logo_manifest(brand, out_dir, result)
    return saved


# ── Asgard ────────────────────────────────────────────────────────────────────
def scrape_asgard():
    """
    Asgard Tools: asgardtools.com
    Official header logo (v3, with glow effect) sourced from the Wayback Machine
    archive of asgardtools.com (August 2025 snapshot).
    Direct access to asgardtools.com returns 403 from automated scrapers; the
    Wayback Machine archive provides authoritative access to their official assets.
    """
    brand = "Asgard"
    out_dir = BRAND_OUTPUT_DIRS[brand]
    ensure_dir(out_dir)

    print(f"\n{'='*60}")
    print(f"  Scraping logo: {brand}")
    print(f"  Source       : https://asgardtools.com (via Wayback Machine)")
    print(f"  Output       : {out_dir}")
    print(f"{'='*60}")

    result = {"brand": brand, "downloaded": 0, "failed": 0, "files": [], "source_urls": []}

    # Official Asgard header logo from their WordPress uploads (via Wayback Machine)
    # The direct asgardtools.com server blocks automated requests (403), so we use
    # the Wayback Machine archive which has the same official files cached.
    known_candidates = [
        # Official v3 header logo with glow (2024/11 upload) – via Wayback Machine
        "http://web.archive.org/web/20250825092720im_/https://asgardtools.com/wp-content/uploads/2024/11/asgard_logo_header_wglow_v3.png",
        # Horizontal official brand logo – alternate Wayback timestamp
        "http://web.archive.org/web/20250825092720im_/https://asgardtools.com/wp-content/uploads/2024/08/ASGARD-Logo_HORIZONTAL_2c-RGB_DRK-BKGRND.png",
    ]

    saved = _try_known_then_scrape(
        known_candidates=known_candidates,
        scrape_url=None,  # Can't scrape directly (403); rely on known URLs
        brand_keywords=["asgard"],
        out_dir=out_dir,
        base_filename="asgard_logo",
        result=result,
    )

    _write_logo_manifest(brand, out_dir, result)
    return saved


# ── Columbia Taping Tools ──────────────────────────────────────────────────────
def scrape_columbia_taping_tools():
    """
    Columbia Taping Tools: columbiatapers.com (domain currently unreachable)
    Logo sourced from Al's Taping Tools (authorized distributor) BigCommerce CDN.
    Al's Taping Tools is an official authorized Columbia distributor and hosts
    the Columbia brand logo image with Columbia's consent.
    """
    brand = "Columbia Taping Tools"
    out_dir = BRAND_OUTPUT_DIRS[brand]
    ensure_dir(out_dir)

    print(f"\n{'='*60}")
    print(f"  Scraping logo: {brand}")
    print(f"  Source       : alstapingtools.com CDN (authorized distributor)")
    print(f"  Output       : {out_dir}")
    print(f"{'='*60}")

    result = {"brand": brand, "downloaded": 0, "failed": 0, "files": [], "source_urls": []}

    # Columbia brand logo image hosted on Al's Taping Tools BigCommerce CDN.
    # URL pattern: stencil/original/image-manager/<filename>
    # columbiatapers.com itself is not DNS-resolvable from all environments.
    known_candidates = [
        "https://cdn11.bigcommerce.com/s-dbb3r9a7se/images/stencil/original/image-manager/columbia-logo-large.jpeg?t=1718137933",
    ]

    saved = _try_known_then_scrape(
        known_candidates=known_candidates,
        scrape_url="https://www.alstapingtools.com/shop-by-manufacturer/columbia/",
        brand_keywords=["columbia", "taping"],
        out_dir=out_dir,
        base_filename="columbia_taping_tools_logo",
        result=result,
    )

    _write_logo_manifest(brand, out_dir, result)
    return saved


# ── Graco ─────────────────────────────────────────────────────────────────────
def scrape_graco():
    """
    Graco: graco.com
    Official SVG logo from the Graco website header.
    """
    brand = "Graco"
    out_dir = BRAND_OUTPUT_DIRS[brand]
    ensure_dir(out_dir)

    print(f"\n{'='*60}")
    print(f"  Scraping logo: {brand}")
    print(f"  Source       : https://www.graco.com")
    print(f"  Output       : {out_dir}")
    print(f"{'='*60}")

    result = {"brand": brand, "downloaded": 0, "failed": 0, "files": [], "source_urls": []}

    # Official Graco SVG logo from graco.com static assets
    known_candidates = [
        "https://www.graco.com/img/graco_logo.svg",
    ]

    saved = _try_known_then_scrape(
        known_candidates=known_candidates,
        scrape_url="https://www.graco.com/us/en/contractor.html",
        brand_keywords=["graco"],
        out_dir=out_dir,
        base_filename="graco_logo",
        result=result,
    )

    _write_logo_manifest(brand, out_dir, result)
    return saved


# ── SurPro ────────────────────────────────────────────────────────────────────
def scrape_surpro():
    """
    SurPro: stilts.com (sur-pro.com redirects here)
    Official SurPro orange block logo from their Shopify store CDN.
    """
    brand = "SurPro"
    out_dir = BRAND_OUTPUT_DIRS[brand]
    ensure_dir(out_dir)

    print(f"\n{'='*60}")
    print(f"  Scraping logo: {brand}")
    print(f"  Source       : https://www.stilts.com")
    print(f"  Output       : {out_dir}")
    print(f"{'='*60}")

    result = {"brand": brand, "downloaded": 0, "failed": 0, "files": [], "source_urls": []}

    # Official SurPro orange block logo from stilts.com Shopify CDN
    known_candidates = [
        "https://stilts.com/cdn/shop/files/SurPro_orange_block_logo_500x.png?v=1638900570",
    ]

    saved = _try_known_then_scrape(
        known_candidates=known_candidates,
        scrape_url="https://www.stilts.com",
        brand_keywords=["sur-pro", "surpro", "stilts"],
        out_dir=out_dir,
        base_filename="surpro_logo",
        result=result,
    )

    _write_logo_manifest(brand, out_dir, result)
    return saved


# ── Spray King ────────────────────────────────────────────────────────────────
def scrape_spray_king():
    """
    Spray King: sprayking.com
    The sprayking.com domain is no longer active (now redirects to an unrelated site).
    Official logo sourced from the Wayback Machine archive of the original
    sprayking.com website (2001 snapshot – the last era with an active site).
    """
    brand = "Spray King"
    out_dir = BRAND_OUTPUT_DIRS[brand]
    ensure_dir(out_dir)

    print(f"\n{'='*60}")
    print(f"  Scraping logo: {brand}")
    print(f"  Source       : sprayking.com (via Wayback Machine archive)")
    print(f"  Output       : {out_dir}")
    print(f"{'='*60}")

    result = {"brand": brand, "downloaded": 0, "failed": 0, "files": [], "source_urls": []}

    # Official Spray King logo from sprayking.com (via Wayback Machine).
    # The domain now redirects to an unrelated company. The logo is authentic,
    # sourced from the brand's own website when it was active.
    known_candidates = [
        "http://web.archive.org/web/20010302101458im_/http://www.sprayking.com/images/logo3.gif",
    ]

    saved = _try_known_then_scrape(
        known_candidates=known_candidates,
        scrape_url=None,  # Domain no longer active; rely on Wayback Machine archive
        brand_keywords=["spray king", "sprayking"],
        out_dir=out_dir,
        base_filename="spray_king_logo",
        result=result,
    )

    _write_logo_manifest(brand, out_dir, result)
    return saved


# ─────────────────────────────────────────────
# Main
# ─────────────────────────────────────────────

def run_all():
    print("\n" + "=" * 60)
    print("  DRYWALL TOOLBOX — Official Brand Logo Scraper")
    print("  Brands:", ", ".join(ALLOWED_BRANDS))
    print("=" * 60)

    ensure_dir(OUTPUT_DIR)

    start = time.time()
    results = {}

    results["TapeTech"] = scrape_tapetech()
    results["Asgard"] = scrape_asgard()
    results["Columbia Taping Tools"] = scrape_columbia_taping_tools()
    results["Graco"] = scrape_graco()
    results["SurPro"] = scrape_surpro()
    results["Spray King"] = scrape_spray_king()

    elapsed = time.time() - start

    print(f"\n{'='*60}")
    print(f"  All brands processed in {elapsed:.1f}s")
    print(f"  Results saved to: {OUTPUT_DIR}")
    print("=" * 60)
    print("\n  Summary:")
    for brand, saved in results.items():
        status = f"✓  {os.path.basename(saved)}" if saved else "✗  NOT FOUND"
        print(f"    {brand:<30} {status}")

    summary = {
        "scraped_at": datetime.now(timezone.utc).isoformat(),
        "elapsed_seconds": round(elapsed, 1),
        "brands": ALLOWED_BRANDS,
        "output_dir": OUTPUT_DIR,
        "results": {
            brand: {"saved": bool(path), "path": path}
            for brand, path in results.items()
        },
    }
    summary_path = os.path.join(OUTPUT_DIR, "logos_summary.json")
    with open(summary_path, "w", encoding="utf-8") as f:
        json.dump(summary, f, indent=2)
    print(f"\n  Summary JSON: {summary_path}")


if __name__ == "__main__":
    run_all()
