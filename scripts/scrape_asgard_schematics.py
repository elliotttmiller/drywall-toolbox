#!/usr/bin/env python3
"""
scrape_asgard_schematics.py
----------------------------
Scrapes every parts schematic diagram PDF from:
  https://asgardtools.com/parts-and-schematics/

For each PDF found it:
  1. Downloads the file to  scraped_results/AsgardTools/pdfs/
  2. Renders every page as a high-quality PNG (300 DPI) to
     scraped_results/AsgardTools/images/<pdf-stem>/page-NNN.png

Usage:
  pip install -r scripts/requirements-scrape.txt
  python scripts/scrape_asgard_schematics.py

Optional flags:
  --dpi INT          Render resolution (default 300)
  --out-dir PATH     Override base output directory
  --pdf-only         Download PDFs but skip PNG conversion
  --images-only      Skip downloading (re-convert already-downloaded PDFs)
  --delay FLOAT      Seconds between HTTP requests (default 0.5)
"""

import argparse
import sys
import time
from pathlib import Path
from urllib.parse import urljoin, urlparse

import fitz  # PyMuPDF
import requests
from bs4 import BeautifulSoup

# ---------------------------------------------------------------------------
# Defaults
# ---------------------------------------------------------------------------
INDEX_URL = "https://asgardtools.com/parts-and-schematics/"
DEFAULT_DPI = 300
DEFAULT_DELAY = 0.5
DEFAULT_OUT_DIR = Path(__file__).parent.parent / "scraped_results" / "AsgardTools"


# ---------------------------------------------------------------------------
# HTTP session
# ---------------------------------------------------------------------------

def make_session() -> requests.Session:
    session = requests.Session()
    session.headers.update({
        "User-Agent": (
            "Mozilla/5.0 (X11; Linux x86_64) "
            "AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/124.0 Safari/537.36"
        ),
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        "Accept-Encoding": "gzip, deflate",   # no brotli – requests can't decode it
        "Referer": "https://asgardtools.com/",
    })
    return session


# ---------------------------------------------------------------------------
# Scraping helpers
# ---------------------------------------------------------------------------

def fetch_index(session: requests.Session) -> str:
    """Fetch the parts-and-schematics index page and return its HTML."""
    print(f"Fetching index page: {INDEX_URL}")
    resp = session.get(INDEX_URL, timeout=30)
    resp.raise_for_status()
    return resp.text


def find_pdf_links(html: str, base_url: str) -> list:
    """
    Return a deduplicated list of (name, absolute_url) tuples for every
    PDF link found on the page.  ``name`` is derived from the link text or
    the PDF filename when no readable label is available.
    """
    soup = BeautifulSoup(html, "lxml")
    seen = set()
    results = []

    for anchor in soup.find_all("a", href=True):
        href = anchor["href"].strip()
        # Accept links that explicitly end in .pdf or contain .pdf in the path
        parsed = urlparse(href)
        if ".pdf" not in parsed.path.lower():
            continue

        abs_url = urljoin(base_url, href)
        if abs_url in seen:
            continue
        seen.add(abs_url)

        # Derive a human-readable name from link text; fall back to filename
        link_text = anchor.get_text(separator=" ").strip()
        if not link_text:
            link_text = Path(parsed.path).stem.replace("-", " ").replace("_", " ")

        results.append((link_text, abs_url))

    return results


# ---------------------------------------------------------------------------
# Download helpers
# ---------------------------------------------------------------------------

def safe_filename(url: str) -> str:
    """Return the PDF filename from the URL, sanitised for the local filesystem."""
    name = Path(urlparse(url).path).name
    # Strip any query-string artefacts appended to the filename
    name = name.split("?")[0]
    # Replace spaces and non-ASCII with underscores
    safe = "".join(c if (c.isalnum() or c in "._-") else "_" for c in name)
    if not safe.lower().endswith(".pdf"):
        safe += ".pdf"
    return safe


def download_pdf(session: requests.Session, url: str, dest: Path) -> bool:
    """
    Download a single PDF to ``dest``.  Returns True on success.
    Skips the download if the file already exists and is non-empty.
    """
    if dest.exists() and dest.stat().st_size > 0:
        print(f"    [skip] already downloaded: {dest.name}")
        return True

    print(f"    Downloading → {dest.name}")
    try:
        resp = session.get(url, timeout=60, stream=True)
        resp.raise_for_status()
        dest.parent.mkdir(parents=True, exist_ok=True)
        with open(dest, "wb") as fh:
            for chunk in resp.iter_content(chunk_size=65536):
                if chunk:
                    fh.write(chunk)
        size_kb = dest.stat().st_size // 1024
        print(f"    Saved {size_kb} KB")
        return True
    except requests.RequestException as exc:
        print(f"    ERROR downloading {url}: {exc}", file=sys.stderr)
        if dest.exists():
            dest.unlink()
        return False


# ---------------------------------------------------------------------------
# PDF → PNG conversion
# ---------------------------------------------------------------------------

def pdf_to_png(pdf_path: Path, images_dir: Path, dpi: int = DEFAULT_DPI) -> int:
    """
    Render every page of ``pdf_path`` to a PNG in ``images_dir``.
    Returns the number of pages converted.
    """
    stem = pdf_path.stem
    out_dir = images_dir / stem
    out_dir.mkdir(parents=True, exist_ok=True)

    try:
        doc = fitz.open(str(pdf_path))
    except Exception as exc:  # noqa: BLE001
        print(f"    ERROR opening PDF {pdf_path.name}: {exc}", file=sys.stderr)
        return 0

    zoom = dpi / 72.0            # 72 DPI is PyMuPDF's internal base resolution
    mat = fitz.Matrix(zoom, zoom)
    converted = 0

    for page_index in range(len(doc)):
        page_num = page_index + 1
        out_file = out_dir / f"page-{page_num:03d}.png"

        if out_file.exists() and out_file.stat().st_size > 0:
            print(f"      [skip] {out_file.name} already exists")
            converted += 1
            continue

        page = doc.load_page(page_index)
        pix = page.get_pixmap(matrix=mat, alpha=False)
        pix.save(str(out_file))
        print(f"      → {out_file.name}  ({pix.width}×{pix.height} px)")
        converted += 1

    doc.close()
    return converted


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Download all Asgard Tools schematic PDFs and convert to PNG.",
    )
    parser.add_argument(
        "--dpi",
        type=int,
        default=DEFAULT_DPI,
        help=f"PNG render resolution in DPI (default: {DEFAULT_DPI})",
    )
    parser.add_argument(
        "--out-dir",
        type=Path,
        default=DEFAULT_OUT_DIR,
        help="Base output directory (default: scraped_results/AsgardTools/)",
    )
    parser.add_argument(
        "--pdf-only",
        action="store_true",
        help="Download PDFs but skip PNG conversion",
    )
    parser.add_argument(
        "--images-only",
        action="store_true",
        help="Skip downloading; re-convert already-downloaded PDFs to PNG",
    )
    parser.add_argument(
        "--delay",
        type=float,
        default=DEFAULT_DELAY,
        help=f"Seconds between HTTP requests (default: {DEFAULT_DELAY})",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()

    pdf_dir = args.out_dir / "pdfs"
    images_dir = args.out_dir / "images"

    session = make_session()

    # ------------------------------------------------------------------
    # 1. Discover PDF links
    # ------------------------------------------------------------------
    if args.images_only:
        # Re-convert whatever PDFs are already on disk
        pdf_links = [
            (p.stem, p)
            for p in sorted(pdf_dir.glob("*.pdf"))
        ]
        print(f"--images-only: found {len(pdf_links)} PDFs in {pdf_dir}")
    else:
        html = fetch_index(session)
        pdf_links = find_pdf_links(html, INDEX_URL)
        print(f"\nFound {len(pdf_links)} PDF link(s) on the page.\n")

    if not pdf_links and not args.images_only:
        print("No PDF links found – check the page structure or network access.", file=sys.stderr)
        sys.exit(1)

    # ------------------------------------------------------------------
    # 2. Download PDFs
    # ------------------------------------------------------------------
    downloaded_paths = []

    if not args.images_only:
        pdf_dir.mkdir(parents=True, exist_ok=True)
        for idx, (name, url) in enumerate(pdf_links, start=1):
            print(f"[{idx}/{len(pdf_links)}] {name}")
            filename = safe_filename(url)
            dest = pdf_dir / filename
            ok = download_pdf(session, url, dest)
            if ok:
                downloaded_paths.append(dest)
            if idx < len(pdf_links):
                time.sleep(args.delay)
    else:
        downloaded_paths = [p for _, p in pdf_links]

    print(f"\nDownloaded {len(downloaded_paths)} PDF(s) to {pdf_dir}")

    # ------------------------------------------------------------------
    # 3. Convert PDFs → PNG
    # ------------------------------------------------------------------
    if args.pdf_only:
        print("--pdf-only: skipping PNG conversion.")
        return

    print(f"\nConverting PDFs to PNG images at {args.dpi} DPI …\n")
    total_pages = 0
    failed = []

    for pdf_path in sorted(downloaded_paths):
        print(f"  {pdf_path.name}")
        pages = pdf_to_png(pdf_path, images_dir, dpi=args.dpi)
        total_pages += pages
        if pages == 0:
            failed.append(pdf_path.name)

    # ------------------------------------------------------------------
    # 4. Summary
    # ------------------------------------------------------------------
    print("\n" + "=" * 60)
    print("SUMMARY")
    print("=" * 60)
    print(f"  PDFs found/downloaded : {len(downloaded_paths)}")
    print(f"  PNG pages produced    : {total_pages}")
    print(f"  Output (PDFs)         : {pdf_dir}")
    print(f"  Output (images)       : {images_dir}")
    if failed:
        print(f"\n  FAILED conversions ({len(failed)}):")
        for name in failed:
            print(f"    - {name}")


if __name__ == "__main__":
    main()
