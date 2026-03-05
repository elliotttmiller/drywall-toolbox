#!/usr/bin/env python3
"""
Comprehensive Schematic Diagram Scraper for ALLOWED_BRANDS
Scrapes official schematic/parts diagrams from each brand's official website.

ALLOWED_BRANDS:
  - TapeTech           → tapetech.com/schematics (122 PDFs)
  - Columbia Taping Tools → alstapingtools.com (authorized distributor, 15 PDFs)
  - Asgard             → tapetech.com/schematics (TapeTech sub-brand, 16 PDFs)
  - SurPro             → stilts.com (official SurPro website, 7 PDFs)
  - Spray King         → No public schematics found (domain parked)
  - Graco              → graco.com product pages + alstapingtools.com (59 PDFs)

Usage:
    python3 scripts/scrape_schematics.py

Requirements:
    pip install requests beautifulsoup4 lxml

Output:
    scraped_results/
    ├── scrape_summary.json
    ├── TapeTech/                (122 PDF schematics)
    ├── Columbia_Taping_Tools/   (15 PDF schematics)
    ├── Asgard/                  (16 PDF schematics)
    ├── SurPro/                  ( 7 PDF parts diagrams)
    ├── Spray_King/              ( 0 files – no public schematics found)
    └── Graco/                   (59 PDF manuals/schematics)
"""

import os
import json
import time
import requests
from bs4 import BeautifulSoup
from urllib.parse import urljoin
from datetime import datetime, timezone

# ─────────────────────────────────────────────
# Configuration
# ─────────────────────────────────────────────
REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUTPUT_DIR = os.path.join(REPO_ROOT, "scraped_results")

ALLOWED_BRANDS = [
    "TapeTech",
    "Columbia Taping Tools",
    "Asgard",
    "SurPro",
    "Spray King",
    "Graco",
]

BRAND_OUTPUT_DIRS = {
    "TapeTech":               os.path.join(OUTPUT_DIR, "TapeTech"),
    "Columbia Taping Tools":  os.path.join(OUTPUT_DIR, "Columbia_Taping_Tools"),
    "Asgard":                 os.path.join(OUTPUT_DIR, "Asgard"),
    "SurPro":                 os.path.join(OUTPUT_DIR, "SurPro"),
    "Spray King":             os.path.join(OUTPUT_DIR, "Spray_King"),
    "Graco":                  os.path.join(OUTPUT_DIR, "Graco"),
}

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/120.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.5",
}

SESSION = requests.Session()
SESSION.headers.update(HEADERS)

# ─────────────────────────────────────────────
# Utilities
# ─────────────────────────────────────────────

def ensure_dir(path):
    os.makedirs(path, exist_ok=True)


def safe_filename(name):
    """Sanitize a string for use as a filename."""
    keepchars = "-_. "
    return "".join(c if (c.isalnum() or c in keepchars) else "_" for c in name).strip()


def download_file(url, dest_path, retries=3, delay=1.5):
    """Download a file from url to dest_path. Returns True on success."""
    if os.path.exists(dest_path):
        print(f"    [SKIP] Already exists: {os.path.basename(dest_path)}")
        return True

    for attempt in range(retries):
        try:
            resp = SESSION.get(url, timeout=30, stream=True)
            resp.raise_for_status()
            with open(dest_path, "wb") as f:
                for chunk in resp.iter_content(chunk_size=65536):
                    if chunk:
                        f.write(chunk)
            size_kb = os.path.getsize(dest_path) // 1024
            print(f"    [OK]   {os.path.basename(dest_path)}  ({size_kb} KB)")
            return True
        except requests.HTTPError as e:
            print(f"    [HTTP {e.response.status_code}] {url}")
            return False
        except Exception as e:
            if attempt < retries - 1:
                print(f"    [RETRY {attempt+1}] {url}: {e}")
                time.sleep(delay * (attempt + 1))
            else:
                print(f"    [FAIL] {url}: {e}")
                return False
    return False


def get_soup(url, timeout=20):
    """Fetch a URL and return a BeautifulSoup object (or None on failure)."""
    try:
        resp = SESSION.get(url, timeout=timeout, allow_redirects=True)
        resp.raise_for_status()
        return BeautifulSoup(resp.content, "lxml")
    except Exception as e:
        print(f"  [ERR] Could not fetch {url}: {e}")
        return None


def write_manifest(brand, out_dir, results):
    """Write a JSON manifest file summarising the scrape results for a brand."""
    manifest = {
        "brand": brand,
        "scraped_at": datetime.now(timezone.utc).isoformat(),
        "total_files": results.get("total", 0),
        "downloaded": results.get("downloaded", 0),
        "skipped": results.get("skipped", 0),
        "failed": results.get("failed", 0),
        "source_urls": results.get("source_urls", []),
        "files": results.get("files", []),
        "notes": results.get("notes", ""),
    }
    path = os.path.join(out_dir, "scrape_manifest.json")
    with open(path, "w", encoding="utf-8") as f:
        json.dump(manifest, f, indent=2)
    print(f"  [MANIFEST] Written: {path}")


# ─────────────────────────────────────────────
# Brand scrapers
# ─────────────────────────────────────────────

# ── TapeTech ──────────────────────────────────────────────────────────────────
def scrape_tapetech():
    brand = "TapeTech"
    out_dir = BRAND_OUTPUT_DIRS[brand]
    ensure_dir(out_dir)

    source_url = "https://www.tapetech.com/schematics"
    print(f"\n{'='*60}")
    print(f"  Scraping: {brand}")
    print(f"  Source  : {source_url}")
    print(f"  Output  : {out_dir}")
    print(f"{'='*60}")

    soup = get_soup(source_url)
    if not soup:
        write_manifest(brand, out_dir, {
            "total": 0,
            "source_urls": [source_url],
            "notes": "ERROR: Could not fetch schematics page.",
        })
        return

    # Collect every PDF link on the page
    pdf_links = []
    for a in soup.find_all("a", href=True):
        href = a["href"]
        if href.lower().endswith(".pdf") and "tapetech" in href:
            pdf_links.append(href)

    # Deduplicate while preserving order
    seen = set()
    unique_pdfs = []
    for url in pdf_links:
        if url not in seen:
            seen.add(url)
            unique_pdfs.append(url)

    print(f"  Found {len(unique_pdfs)} schematic PDFs on the page.")

    results = {
        "total": len(unique_pdfs),
        "downloaded": 0,
        "skipped": 0,
        "failed": 0,
        "source_urls": [source_url],
        "files": [],
    }

    for pdf_url in unique_pdfs:
        filename = pdf_url.split("/")[-1]
        dest = os.path.join(out_dir, filename)
        ok = download_file(pdf_url, dest)
        if ok:
            file_size = os.path.getsize(dest)
            results["downloaded"] += 1
            results["files"].append({
                "filename": filename,
                "source_url": pdf_url,
                "size_bytes": file_size,
            })
        else:
            results["failed"] += 1
        time.sleep(0.3)

    write_manifest(brand, out_dir, results)
    print(f"\n  {brand}: {results['downloaded']} downloaded, {results['failed']} failed.")


# ── Graco ─────────────────────────────────────────────────────────────────────
def scrape_graco():
    """
    Graco drywall-relevant products:
      - Mark V / Mark V HD / Mark X HD / Mark XV XT drywall compound pumps
      - PowerFill drywall mud pump
      - TexSpray RTX series texture sprayers
      - TexSpray HTX / GTX / T-MAX / FastFinish sprayers
      - DutyMax GH series sprayers
      - President 101
      - GMAX II series

    Individual product pages (with PDF parts manuals) are at:
      https://www.graco.com/us/en/contractor/product/<model-id>.html

    We discover product IDs from the US sitemap, filter for drywall/texture
    tools, then download English-language parts and repair manuals only.
    """
    brand = "Graco"
    out_dir = BRAND_OUTPUT_DIRS[brand]
    ensure_dir(out_dir)

    print(f"\n{'='*60}")
    print(f"  Scraping: {brand}")
    print(f"  Output  : {out_dir}")
    print(f"{'='*60}")

    # ── Step 1: collect drywall-relevant product page URLs from sitemap ──────
    sitemap_url = "https://www.graco.com/us/en/sitemap.xml"
    print(f"  Fetching sitemap: {sitemap_url}")
    soup = get_soup(sitemap_url)

    product_pages = []
    if soup:
        all_locs = [loc.text for loc in soup.find_all("loc")]
        drywall_keywords = [
            "rtx", "texspray", "mark-v", "mark-x", "mark-xv",
            "powerfill", "president", "dutymax", "gmax", "t-max",
            "htx", "gtx", "fastfinish", "hopper", "mud-pump",
        ]
        for url in all_locs:
            if "/us/en/contractor/product/" in url and url.endswith(".html"):
                url_lower = url.lower()
                if any(kw in url_lower for kw in drywall_keywords):
                    product_pages.append(url)

    print(f"  Found {len(product_pages)} drywall/texture product pages in sitemap.")

    # ── Step 2: visit each product page and collect English PDF links ────────
    # We only download English-language parts & repair manuals and brochures.
    ENGLISH_SUFFIXES = ("EN", "EN-A", "EN-B", "EN-C", "EN-D", "EN-E",
                        "EN-F", "EN-G", "EN-H", "EN-J", "EN-K")

    pdf_links = {}  # filename -> url  (deduplicated by filename)
    source_urls_visited = [sitemap_url]

    for prod_url in sorted(product_pages):
        soup = get_soup(prod_url)
        if not soup:
            continue
        source_urls_visited.append(prod_url)

        for a in soup.find_all("a", href=True):
            href = a["href"]
            if ".pdf" not in href.lower():
                continue
            full_pdf = ("https://www.graco.com" + href
                        if href.startswith("/") else href)
            fname = full_pdf.split("/")[-1].split("?")[0]
            if not fname:
                continue
            # Only keep English documents (avoid language duplication)
            fname_stem = fname.replace(".pdf", "")
            is_english = (
                fname_stem.endswith("EN")
                or any(fname_stem.endswith(suf) for suf in ENGLISH_SUFFIXES)
            )
            if is_english and fname not in pdf_links:
                pdf_links[fname] = full_pdf

        time.sleep(0.3)

    print(f"  Found {len(pdf_links)} unique English PDF documents.")

    # ── Step 3: also scrape Al's Taping Tools for older Graco drywall docs ───
    # These include the classic RTX 1500 schematic, Mark V schematic, etc.
    DISTRIBUTOR_URL = "https://www.alstapingtools.com/order-parts/product-schematic-downloads/"
    dist_soup = get_soup(DISTRIBUTOR_URL)
    if dist_soup:
        graco_keywords = ["graco", "rtx", "mark v", "mark x", "powerfill", "texspray"]
        for a in dist_soup.find_all("a", href=True):
            href = a["href"]
            text = a.get_text(strip=True).lower()
            if ".pdf" not in href.lower():
                continue
            if not any(kw in text for kw in graco_keywords):
                continue
            full_url = href if href.startswith("http") else "https://www.alstapingtools.com" + href
            fname = full_url.split("/")[-1].split("?")[0]
            if fname and fname not in pdf_links:
                pdf_links[fname] = full_url
        source_urls_visited.append(DISTRIBUTOR_URL)
        print(f"  After distributor supplemental: {len(pdf_links)} total unique PDFs.")

    results = {
        "total": len(pdf_links),
        "downloaded": 0,
        "skipped": 0,
        "failed": 0,
        "source_urls": source_urls_visited,
        "files": [],
        "notes": (
            "Graco drywall/texture product manuals (English only). "
            "Products: Mark V/X/XV HD, TexSpray RTX 1400/2000/2500/5000/5500, "
            "HTX 2030, GTX 2000EX, FastFinish, T-MAX, DutyMax GH 230/300/675, "
            "President 101, GMAX II 3400/3900/5900/7900. "
            "Supplemental classic manuals from Al's Taping Tools authorized distributor."
        ),
    }

    for filename, pdf_url in sorted(pdf_links.items()):
        dest = os.path.join(out_dir, filename)
        ok = download_file(pdf_url, dest)
        if ok:
            results["downloaded"] += 1
            results["files"].append({
                "filename": filename,
                "source_url": pdf_url,
                "size_bytes": os.path.getsize(dest),
            })
        else:
            results["failed"] += 1
        time.sleep(0.3)

    write_manifest(brand, out_dir, results)
    print(f"\n  {brand}: {results['downloaded']} downloaded, {results['failed']} failed.")


# ── Columbia Taping Tools ─────────────────────────────────────────────────────
def scrape_columbia_taping_tools():
    """
    Columbia Taping Tools.
    Official website columbiatapers.com is not DNS-resolvable from all environments.
    Schematics sourced from Al's Taping Tools authorized distributor schematic page.
    Covers: taper bodies/heads, angle heads, corner applicators, corner roller,
    Predator taper, Semi-Automatic taper, Matrix series, Extension Housing,
    and the full Columbia Tools Operations Manual.
    """
    brand = "Columbia Taping Tools"
    out_dir = BRAND_OUTPUT_DIRS[brand]
    ensure_dir(out_dir)

    # Al's Taping Tools is an authorized Columbia distributor and hosts
    # the official schematics with Columbia's consent
    DISTRIBUTOR_URL = "https://www.alstapingtools.com/order-parts/product-schematic-downloads/"

    print(f"\n{'='*60}")
    print(f"  Scraping: {brand}")
    print(f"  Source  : {DISTRIBUTOR_URL}")
    print(f"  Output  : {out_dir}")
    print(f"{'='*60}")

    files_downloaded = []
    failed = []
    source_urls_found = []

    soup = get_soup(DISTRIBUTOR_URL)
    if not soup:
        write_manifest(brand, out_dir, {
            "total": 0,
            "source_urls": [DISTRIBUTOR_URL],
            "notes": "ERROR: Could not fetch distributor schematic page.",
        })
        return

    source_urls_found.append(DISTRIBUTOR_URL)

    # Collect all Columbia-related PDF links
    # Includes: links with "columbia" in text/href, Matrix series, Extension Housing
    columbia_pdfs = []
    for a in soup.find_all("a", href=True):
        href = a["href"]
        text = a.get_text(strip=True)
        if ".pdf" not in href.lower() and ".PDF" not in href:
            continue
        is_columbia = (
            "columbia" in text.lower()
            or "columbia" in href.lower()
            or any(x in text.lower() for x in ["matrix", "matix", "extension housing"])
        )
        if is_columbia:
            full_url = href if href.startswith("http") else "https://www.alstapingtools.com" + href
            columbia_pdfs.append((text, full_url))

    print(f"  Found {len(columbia_pdfs)} Columbia schematic PDFs.")

    results = {
        "total": len(columbia_pdfs),
        "downloaded": 0,
        "skipped": 0,
        "failed": 0,
        "source_urls": source_urls_found,
        "files": [],
        "notes": (
            "Official website columbiatapers.com not DNS-resolvable from this environment. "
            "Schematics sourced from Al's Taping Tools (authorized distributor): "
            + DISTRIBUTOR_URL
        ),
    }

    for text, pdf_url in columbia_pdfs:
        fname = pdf_url.split("/")[-1].split("?")[0]
        dest = os.path.join(out_dir, fname)
        ok = download_file(pdf_url, dest)
        if ok:
            results["downloaded"] += 1
            results["files"].append({
                "filename": fname,
                "description": text,
                "source_url": pdf_url,
                "size_bytes": os.path.getsize(dest),
            })
        else:
            results["failed"] += 1
        time.sleep(0.4)

    write_manifest(brand, out_dir, results)
    print(f"\n  {brand}: {results['downloaded']} downloaded, {results['failed']} failed.")


# ── Asgard ────────────────────────────────────────────────────────────────────
def scrape_asgard():
    """
    Asgard (asgardtools.com).
    Asgard is a TapeTech sub-brand. Their schematics are hosted on tapetech.com.
    """
    brand = "Asgard"
    out_dir = BRAND_OUTPUT_DIRS[brand]
    ensure_dir(out_dir)

    # Asgard tools are branded by TapeTech; look for EZ/EHC/PA model schematics
    # on tapetech.com (the same schematics page we already scraped for TapeTech)
    # Asgard product models: EZ07, EZ10, EZ12, EZ15, EHC07, EHC10, EHC12,
    #                        PA07H, PA10H, PA12H, PAHC07, PAHC10, PAHC12, LP01
    asgard_model_prefixes = [
        "EZ", "EHC", "PA", "PAHC",
    ]

    candidate_urls = [
        "https://www.tapetech.com/schematics",
        "https://www.asgardtools.com/schematics",
        "https://www.asgardtools.com/parts",
        "https://asgardtools.com/schematics",
    ]

    print(f"\n{'='*60}")
    print(f"  Scraping: {brand}")
    print(f"{'='*60}")

    files_downloaded = []
    failed_urls = []
    source_urls = []

    for url in candidate_urls:
        soup = get_soup(url)
        if not soup:
            failed_urls.append(url)
            continue
        source_urls.append(url)

        # Find all PDFs that match Asgard model prefixes
        for a in soup.find_all("a", href=True):
            href = a["href"]
            if ".pdf" not in href.lower():
                continue
            fname = href.split("/")[-1].split("?")[0].upper()
            # Check if filename matches any Asgard model prefix
            is_asgard = any(
                fname.startswith(pfx) for pfx in asgard_model_prefixes
            )
            if is_asgard:
                full_pdf = urljoin(url, href) if not href.startswith("http") else href
                dest_name = full_pdf.split("/")[-1].split("?")[0]
                dest = os.path.join(out_dir, dest_name)
                ok = download_file(full_pdf, dest)
                if ok:
                    files_downloaded.append({
                        "filename": dest_name,
                        "source_url": full_pdf,
                        "size_bytes": os.path.getsize(dest),
                    })
                time.sleep(0.3)

    notes = (
        "Asgard is a TapeTech sub-brand. Schematics are hosted on tapetech.com "
        "under model codes: EZ (flat boxes), EHC (MaxxBox), PA/PAHC (power-assist). "
        "Direct Asgard website asgardtools.com returned HTTP 403 at scrape time."
    )

    results = {
        "total": len(files_downloaded),
        "downloaded": len(files_downloaded),
        "skipped": 0,
        "failed": len(failed_urls),
        "source_urls": candidate_urls,
        "files": files_downloaded,
        "notes": notes,
    }
    write_manifest(brand, out_dir, results)
    print(f"\n  {brand}: {len(files_downloaded)} downloaded, {len(failed_urls)} failed.")


# ── SurPro ────────────────────────────────────────────────────────────────────
def scrape_surpro():
    """
    SurPro stilts (stilts.com – sur-pro.com redirects here).
    Products: S1, S1X (single-sided) and S2, S2X (double-sided) drywall stilts.
    Documents: product catalog, user manuals, and official parts diagrams.
    """
    brand = "SurPro"
    out_dir = BRAND_OUTPUT_DIRS[brand]
    ensure_dir(out_dir)

    SOURCE_URL = "https://stilts.com/pages/instruction-manuals-parts-diagrams"

    print(f"\n{'='*60}")
    print(f"  Scraping: {brand}")
    print(f"  Source  : {SOURCE_URL}")
    print(f"  Output  : {out_dir}")
    print(f"{'='*60}")

    soup = get_soup(SOURCE_URL)
    if not soup:
        write_manifest(brand, out_dir, {
            "total": 0,
            "source_urls": [SOURCE_URL],
            "notes": "ERROR: Could not fetch SurPro manuals page.",
        })
        return

    # Collect all CDN PDF links (SurPro uses Shopify CDN)
    pdf_links = {}  # filename -> url
    for a in soup.find_all("a", href=True):
        href = a["href"]
        if "cdn.shopify.com" in href or ".pdf" in href.lower():
            clean_url = href.split("?")[0] + "?" + href.split("?")[1] if "?" in href else href
            fname = href.split("/")[-1].split("?")[0]
            if fname and fname not in pdf_links:
                pdf_links[fname] = href

    print(f"  Found {len(pdf_links)} PDF documents.")

    results = {
        "total": len(pdf_links),
        "downloaded": 0,
        "skipped": 0,
        "failed": 0,
        "source_urls": [SOURCE_URL, "https://stilts.com"],
        "files": [],
        "notes": (
            "SurPro (by Columbia Taping Tools) drywall stilts. "
            "Official website: stilts.com (sur-pro.com redirects here). "
            "Files: catalog, S1/S1X manual, S2/S2X manual, and parts diagrams "
            "for S1, S1X, S2, S2X models with exploded-view schematics and part numbers."
        ),
    }

    for fname, pdf_url in sorted(pdf_links.items()):
        dest = os.path.join(out_dir, fname)
        ok = download_file(pdf_url, dest)
        if ok:
            results["downloaded"] += 1
            results["files"].append({
                "filename": fname,
                "source_url": pdf_url.split("?")[0],
                "size_bytes": os.path.getsize(dest),
            })
        else:
            results["failed"] += 1
        time.sleep(0.4)

    write_manifest(brand, out_dir, results)
    print(f"\n  {brand}: {results['downloaded']} downloaded, {results['failed']} failed.")


# ── Spray King ────────────────────────────────────────────────────────────────
def scrape_spray_king():
    """
    Spray King pneumatic drywall texture sprayers and pressure systems.

    Research findings:
    - spray-king.com domain is parked (returns a CDN redirect page, no content).
    - No Spray King schematic downloads found on authorized distributors
      (Al's Taping Tools, Timothy's Toolbox, Drywall Tool Depot).
    - Products in catalog: Air to Electric Pressure Switch for Spray King.
    - Service schematics are distributed exclusively through authorized dealers.
    """
    brand = "Spray King"
    out_dir = BRAND_OUTPUT_DIRS[brand]
    ensure_dir(out_dir)

    print(f"\n{'='*60}")
    print(f"  Scraping: {brand}")
    print(f"{'='*60}")
    print(f"  NOTE: spray-king.com domain is parked. No public schematics found.")

    results = {
        "total": 0,
        "downloaded": 0,
        "skipped": 0,
        "failed": 0,
        "source_urls": [
            "https://spray-king.com",
            "https://www.alstapingtools.com/order-parts/product-schematic-downloads/",
        ],
        "files": [],
        "notes": (
            "Spray King manufactures pneumatic/air-powered drywall texture sprayers "
            "and pressure systems. Products in catalog: Air to Electric Pressure Switch "
            "for Spray King. "
            "Research findings: (1) spray-king.com domain is parked (CDN redirect, no content). "
            "(2) No Spray King schematics found on authorized distributors. "
            "(3) Service schematics distributed exclusively through authorized dealers. "
            "Contact info@spray-king.com or authorized Spray King dealers."
        ),
    }
    write_manifest(brand, out_dir, results)
    print(f"\n  {brand}: No files available (domain parked, no public schematics).")


# ─────────────────────────────────────────────
# Master runner
# ─────────────────────────────────────────────

def run_all():
    print("\n" + "="*60)
    print("  DRYWALL TOOLBOX — Schematic Diagram Scraper")
    print("  Brands:", ", ".join(ALLOWED_BRANDS))
    print("="*60)

    ensure_dir(OUTPUT_DIR)

    start = time.time()
    scrape_tapetech()
    scrape_graco()
    scrape_columbia_taping_tools()
    scrape_asgard()
    scrape_surpro()
    scrape_spray_king()

    elapsed = time.time() - start
    print(f"\n{'='*60}")
    print(f"  All brands processed in {elapsed:.1f}s")
    print(f"  Results saved to: {OUTPUT_DIR}")
    print("="*60)

    # Write a top-level summary
    summary = {
        "scraped_at": datetime.now(timezone.utc).isoformat(),
        "elapsed_seconds": round(elapsed, 1),
        "brands": ALLOWED_BRANDS,
        "output_dir": OUTPUT_DIR,
    }
    with open(os.path.join(OUTPUT_DIR, "scrape_summary.json"), "w") as f:
        json.dump(summary, f, indent=2)


if __name__ == "__main__":
    run_all()
