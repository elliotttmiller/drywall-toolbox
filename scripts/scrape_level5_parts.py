#!/usr/bin/env python3
"""
scrape_level5_parts.py

Scrapes every tool parts schematic diagram and corresponding parts list from
the Level5 Tools parts & components page:
    https://www.level5tools.com/parts-components/

For every schematic section the script collects:
    - Diagram File Name  (exact PDF filename from the download link)
    - LABEL NUMBER ON SCHEMATIC DIAGRAM (#)  (the circled reference number)
    - PARTS SKU (PART)
    - PARTS NAME (DESCRIPTION)
    - PRICE

All PDF files are downloaded to:
    scraped_results/Level5/schematics/

The compiled catalog is written to:
    scraped_results/Level5/level5_parts_catalog.csv

Usage:
    python3 scripts/scrape_level5_parts.py [--no-download] [--delay SECONDS]

Options:
    --no-download   Skip downloading PDF files (catalog CSV is still created).
    --delay SECONDS Seconds to wait between HTTP requests (default: 1.0).
    --output PATH   Override the default CSV output path.
"""

import argparse
import csv
import os
import re
import sys
import time
import urllib.parse
from pathlib import Path

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

REPO_ROOT = Path(__file__).resolve().parent.parent
OUTPUT_DIR = REPO_ROOT / "scraped_results" / "Level5"
SCHEMATICS_DIR = OUTPUT_DIR / "schematics"
DEFAULT_OUTPUT_CSV = OUTPUT_DIR / "level5_parts_catalog.csv"

SOURCE_URL = "https://www.level5tools.com/parts-components/"

CSV_COLUMNS = [
    "Diagram File Name",
    "LABEL NUMBER ON SCHEMATIC DIAGRAM (#)",
    "PARTS SKU (PART)",
    "PARTS NAME (DESCRIPTION)",
    "PRICE",
]

# ---------------------------------------------------------------------------
# HTTP helpers
# ---------------------------------------------------------------------------

BROWSER_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
    # Omit "br" (brotli) – requests cannot decompress it natively;
    # including it causes garbled responses when sessions are reused.
    "Accept-Encoding": "gzip, deflate",
    "Connection": "keep-alive",
}

REQUEST_TIMEOUT = 30  # seconds


def make_session() -> requests.Session:
    session = requests.Session()
    session.headers.update(BROWSER_HEADERS)
    return session


def safe_get(session: requests.Session, url: str) -> requests.Response | None:
    """GET *url*, returning None on any network / HTTP error."""
    try:
        resp = session.get(url, timeout=REQUEST_TIMEOUT, allow_redirects=True)
        resp.raise_for_status()
        return resp
    except requests.RequestException as exc:
        print(f"  [WARN] GET {url} -> {exc}", file=sys.stderr)
        return None


# ---------------------------------------------------------------------------
# Parsing helpers
# ---------------------------------------------------------------------------

def _pdf_filename(pdf_url: str) -> str:
    """Return just the filename portion of a PDF URL."""
    return urllib.parse.unquote(pdf_url.rstrip("/").split("/")[-1])


def parse_page(html: str) -> list[dict]:
    """Parse the Level5 parts page HTML and return a list of part-row dicts.

    Each dict has the keys matching CSV_COLUMNS.
    """
    soup = BeautifulSoup(html, "lxml")
    rows: list[dict] = []
    seen: set[tuple] = set()

    sections = soup.select("section.sch--cont")
    if not sections:
        # Fallback: any element with schematic-sec attribute
        sections = soup.find_all(attrs={"schematic-sec": True})

    for section in sections:
        # --- Schematic PDF link ------------------------------------------------
        pdf_url = ""
        for a_tag in section.find_all("a", href=True):
            href = a_tag["href"]
            if href.lower().endswith(".pdf"):
                pdf_url = href
                break

        diagram_filename = _pdf_filename(pdf_url) if pdf_url else "N/A"

        # --- Parts grid -------------------------------------------------------
        # Each part row consists of four consecutive grid-item divs:
        #   1. index-wrapper  → label #
        #   2. sch-item-sku   → part SKU
        #   3. sch-item-name-wrapper → description (+ availability note)
        #   4. plain grid-item → price
        #
        # We walk the flat list of .grid-item elements inside the section,
        # skipping the header row (class "heading").

        grid_items = section.select(".grid-item")
        # Filter out header cells
        grid_items = [gi for gi in grid_items if "heading" not in gi.get("class", [])]

        i = 0
        while i < len(grid_items):
            gi = grid_items[i]

            # Detect start of a part row by the presence of index-wrapper
            if "index-wrapper" not in gi.get("class", []):
                i += 1
                continue

            # Label number
            index_el = gi.select_one(".index-round")
            label_num = index_el.get_text(strip=True) if index_el else ""

            # Part SKU
            sku_el = grid_items[i + 1] if i + 1 < len(grid_items) else None
            part_sku = sku_el.get_text(strip=True) if sku_el else ""

            # Description (+ availability flag)
            name_wrapper = grid_items[i + 2] if i + 2 < len(grid_items) else None
            description = ""
            availability = ""
            if name_wrapper:
                name_el = name_wrapper.select_one(".item--name")
                description = name_el.get_text(strip=True) if name_el else name_wrapper.get_text(strip=True)
                avail_el = name_wrapper.select_one(".text-sm-red")
                if avail_el:
                    availability = avail_el.get_text(strip=True)

            # Price
            price_el = grid_items[i + 3] if i + 3 < len(grid_items) else None
            price = price_el.get_text(strip=True) if price_el else ""
            # Normalise price: if item is "Not Available" treat price as such
            if availability.lower() == "not available":
                price = "Not Available"
            elif price == "$0":
                price = "Not Available"

            # Deduplicate
            key = (diagram_filename, label_num, part_sku)
            if key not in seen:
                seen.add(key)
                rows.append(
                    {
                        "Diagram File Name": diagram_filename,
                        "LABEL NUMBER ON SCHEMATIC DIAGRAM (#)": label_num,
                        "PARTS SKU (PART)": part_sku,
                        "PARTS NAME (DESCRIPTION)": description,
                        "PRICE": price,
                    }
                )

            i += 1  # advance to next grid-item (will skip to next index-wrapper)

    return rows


# ---------------------------------------------------------------------------
# PDF downloader
# ---------------------------------------------------------------------------

def download_pdfs(
    pdf_urls: list[str],
    dest_dir: Path,
    session: requests.Session,
    delay: float,
) -> None:
    """Download each unique PDF URL into *dest_dir*."""
    dest_dir.mkdir(parents=True, exist_ok=True)
    unique_urls = list(dict.fromkeys(pdf_urls))
    print(f"\nDownloading {len(unique_urls)} schematic PDF(s) → {dest_dir}")

    for url in unique_urls:
        filename = _pdf_filename(url)
        dest_path = dest_dir / filename
        if dest_path.exists():
            print(f"  [SKIP]  {filename} (already exists)")
            continue

        print(f"  [GET]   {filename}")
        resp = safe_get(session, url)
        if resp and resp.content:
            dest_path.write_bytes(resp.content)
            print(f"  [SAVED] {filename}  ({len(resp.content):,} bytes)")
        else:
            print(f"  [FAIL]  {filename}", file=sys.stderr)

        time.sleep(delay)


# ---------------------------------------------------------------------------
# CLI entry-point
# ---------------------------------------------------------------------------

def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(
        description="Scrape Level5 Tools parts catalog to CSV and download schematics."
    )
    p.add_argument(
        "--no-download",
        action="store_true",
        help="Skip downloading PDF schematic files.",
    )
    p.add_argument(
        "--delay",
        type=float,
        default=1.0,
        metavar="SECONDS",
        help="Seconds to wait between HTTP requests (default: 1.0).",
    )
    p.add_argument(
        "--output",
        type=Path,
        default=DEFAULT_OUTPUT_CSV,
        metavar="PATH",
        help=f"Output CSV path (default: {DEFAULT_OUTPUT_CSV}).",
    )
    return p.parse_args()


def main() -> None:
    args = parse_args()
    session = make_session()

    # ------------------------------------------------------------------
    # 1. Fetch the parts page
    # ------------------------------------------------------------------
    print(f"Fetching {SOURCE_URL} …")
    resp = safe_get(session, SOURCE_URL)
    if not resp:
        print("ERROR: Could not fetch the Level5 Tools parts page.", file=sys.stderr)
        sys.exit(1)

    time.sleep(args.delay)

    # ------------------------------------------------------------------
    # 2. Parse parts data
    # ------------------------------------------------------------------
    print("Parsing page …")
    rows = parse_page(resp.text)
    print(f"  Found {len(rows)} part row(s) across all schematics.")

    # ------------------------------------------------------------------
    # 3. Collect unique PDF URLs for download
    # ------------------------------------------------------------------
    pdf_urls_in_order: list[str] = []
    pdf_seen: set[str] = set()
    soup_for_pdfs = BeautifulSoup(resp.text, "lxml")
    for a_tag in soup_for_pdfs.find_all("a", href=True):
        href = a_tag["href"]
        if href.lower().endswith(".pdf") and href not in pdf_seen:
            pdf_seen.add(href)
            pdf_urls_in_order.append(href)

    # ------------------------------------------------------------------
    # 4. Download PDFs (unless --no-download)
    # ------------------------------------------------------------------
    if not args.no_download:
        download_pdfs(pdf_urls_in_order, SCHEMATICS_DIR, session, args.delay)
    else:
        print("\n[--no-download] Skipping PDF downloads.")

    # ------------------------------------------------------------------
    # 5. Write CSV
    # ------------------------------------------------------------------
    args.output.parent.mkdir(parents=True, exist_ok=True)
    with open(args.output, "w", newline="", encoding="utf-8") as fh:
        writer = csv.DictWriter(fh, fieldnames=CSV_COLUMNS)
        writer.writeheader()
        writer.writerows(rows)

    print(f"\nWrote {len(rows)} rows → {args.output}")


if __name__ == "__main__":
    main()
