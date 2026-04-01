#!/usr/bin/env python3
"""
scrape_asgard_schematics.py
----------------------------
Scrapes every parts schematic diagram PDF from:
  https://asgardtools.com/parts-and-schematics/

For each PDF found it:
  1. Extracts the product name, SKU, and category from the page.
  2. Downloads the PDF to  scraped_results/AsgardTools/pdfs/
  3. Renders every page as a high-quality PNG (300 DPI).
  4. Organises all output under:
       frontend/public/brands/Asgard/Schematics/{Category}/{SKU}/
     including a schematic_data.json skeleton that matches the
     Columbia / TapeTech schema used by the rest of the app.
  5. Saves a manifest at scraped_results/AsgardTools/manifest.json
     so re-runs can skip completed items.

Usage:
  pip install -r scripts/requirements-scrape.txt
  python scripts/scrape_asgard_schematics.py

Optional flags:
  --dpi INT          Render resolution (default 300)
  --pdf-only         Download PDFs but skip PNG conversion / JSON writing
  --images-only      Skip downloading; re-convert using saved manifest
  --delay FLOAT      Seconds between HTTP requests (default 0.5)
"""

import argparse
import json
import re
import sys
import time
from pathlib import Path
from urllib.parse import urljoin, urlparse

import fitz  # PyMuPDF
import requests
from bs4 import BeautifulSoup

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------
INDEX_URL = "https://asgardtools.com/parts-and-schematics/"
DEFAULT_DPI = 300
DEFAULT_DELAY = 0.5

REPO_ROOT = Path(__file__).parent.parent
SCRATCH_DIR = REPO_ROOT / "scraped_results" / "AsgardTools"
BRANDS_DIR = REPO_ROOT / "frontend" / "public" / "brands" / "Asgard" / "Schematics"

# Regex for Asgard-style SKUs such as AH25-AD, EZ10-AD, BBH-AD, LP01-AD.
# Matches 1-5 uppercase letters, 0-4 digits, then one or more "-WORD" suffixes.
_SKU_RE = re.compile(r"\b([A-Z]{1,5}[0-9]{0,4}(?:-[A-Z0-9]{1,4})+)\b")

# Characters stripped from the edges of extracted name/cell strings.
_STRIP_CHARS = " |-\u2013\u2014"  # space, pipe, hyphen, en-dash, em-dash


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
        "Accept-Encoding": "gzip, deflate",  # no brotli -- requests can't decode it
        "Referer": "https://asgardtools.com/",
    })
    return session


# ---------------------------------------------------------------------------
# Parsing helpers
# ---------------------------------------------------------------------------

def _to_camel(text: str) -> str:
    """Convert free-form text to CamelCase for use as a directory name."""
    words = re.split(r"[\s\-_/]+", text.strip())
    return "".join(w.capitalize() for w in words if w)


def _sku_from_text(text: str) -> str:
    """Return the first SKU-like token found in *text*, or ''."""
    m = _SKU_RE.search(text)
    return m.group(1) if m else ""


def _sku_from_url(url: str) -> str:
    """Try to extract a SKU from the PDF filename in the URL."""
    stem = Path(urlparse(url).path).stem
    # Replace separators so 'AH25_AD' is treated the same as 'AH25-AD'
    normalised = stem.replace("_", "-").upper()
    return _sku_from_text(normalised)


def _safe_pdf_filename(url: str) -> str:
    """Derive a safe local filename from a PDF URL."""
    name = Path(urlparse(url).path).name.split("?")[0]
    safe = "".join(c if (c.isalnum() or c in "._-") else "_" for c in name)
    if not safe.lower().endswith(".pdf"):
        safe += ".pdf"
    return safe


def _product_name_from_anchor(anchor) -> str:
    """
    Best-effort human-readable product name from an <a> tag and its
    immediate surroundings (parent cell, sibling cells in a row,
    list item, paragraph, or div).
    """
    # Prefer the anchor's own visible text if it looks descriptive
    text = anchor.get_text(separator=" ").strip()
    if text and not text.lower().startswith("download") and len(text) > 3:
        return text

    # Walk up to find a block container with useful text
    for parent in anchor.parents:
        tag = getattr(parent, "name", None)

        # Table row: collect text from sibling cells that don't contain the
        # PDF link themselves (handles the common pattern where product name
        # and SKU are in earlier <td>s and "Download" is in the last one).
        if tag == "tr":
            cells = [
                td.get_text(separator=" ").strip()
                for td in parent.find_all(["td", "th"])
                if td is not anchor.parent and td.get_text(strip=True)
                and not td.find("a", href=lambda h: h and ".pdf" in h.lower())
            ]
            if cells:
                return " - ".join(cells)
            break

        if tag in ("td", "th"):
            # Cell that directly wraps the anchor: its text is just the link
            # text, so strip it and continue climbing toward the <tr>.
            candidate = parent.get_text(separator=" ").strip()
            candidate = candidate.replace(anchor.get_text(), "").strip(_STRIP_CHARS)
            if candidate:
                return candidate
            # Empty after stripping → keep climbing to find the row
            continue

        if tag in ("li", "p", "div", "h2", "h3", "h4"):
            candidate = parent.get_text(separator=" ").strip()
            candidate = candidate.replace(anchor.get_text(), "").strip(_STRIP_CHARS)
            if candidate:
                return candidate
            break

    return ""


def find_pdf_entries(html: str, base_url: str) -> list:
    """
    Parse the index page and return a list of dicts:
        {
          "name"    : str  – human-readable product name,
          "sku"     : str  – product SKU (may be '' if not found),
          "category": str  – CamelCase category derived from nearest heading,
          "url"     : str  – absolute PDF URL,
          "filename": str  – safe local PDF filename,
        }
    Results are deduplicated by URL.
    """
    soup = BeautifulSoup(html, "lxml")
    seen_urls = set()
    results = []
    current_category = "Uncategorized"

    # Walk every element in document order so we can track the last heading
    for element in soup.find_all(True):
        tag = element.name

        # Update the running category whenever we hit a heading
        if tag in ("h1", "h2", "h3", "h4", "h5"):
            heading_text = element.get_text(separator=" ").strip()
            if heading_text:
                current_category = _to_camel(heading_text)
            continue

        # Process anchor tags that link to PDFs
        if tag == "a":
            href = element.get("href", "").strip()
            parsed = urlparse(href)
            if ".pdf" not in parsed.path.lower():
                continue

            abs_url = urljoin(base_url, href)
            if abs_url in seen_urls:
                continue
            seen_urls.add(abs_url)

            # --- derive product name ---
            name = _product_name_from_anchor(element)

            # --- derive SKU ---
            # Priority: name text → URL stem → empty string
            sku = _sku_from_text(name) or _sku_from_url(abs_url)

            # If the name is just "Download" or empty, fall back to URL stem
            if not name or name.lower().startswith("download"):
                stem = Path(parsed.path).stem
                name = stem.replace("-", " ").replace("_", " ").title()

            results.append({
                "name": name,
                "sku": sku,
                "category": current_category,
                "url": abs_url,
                "filename": _safe_pdf_filename(abs_url),
            })

    return results


# ---------------------------------------------------------------------------
# Manifest helpers  (scraped_results/AsgardTools/manifest.json)
# ---------------------------------------------------------------------------

def load_manifest(path: Path) -> dict:
    if path.exists():
        try:
            with open(path, encoding="utf-8") as fh:
                return json.load(fh)
        except (json.JSONDecodeError, OSError):
            pass
    return {}


def save_manifest(path: Path, data: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w", encoding="utf-8") as fh:
        json.dump(data, fh, indent=2, ensure_ascii=False)


# ---------------------------------------------------------------------------
# Download
# ---------------------------------------------------------------------------

def download_pdf(session: requests.Session, url: str, dest: Path) -> bool:
    """Download a PDF to *dest*.  Returns True on success."""
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
        print(f"    Saved {dest.stat().st_size // 1024} KB")
        return True
    except requests.RequestException as exc:
        print(f"    ERROR downloading {url}: {exc}", file=sys.stderr)
        if dest.exists():
            dest.unlink()
        return False


# ---------------------------------------------------------------------------
# PDF → PNG conversion
# ---------------------------------------------------------------------------

def pdf_to_png(pdf_path: Path, out_dir: Path, dpi: int) -> tuple:
    """
    Render every page of *pdf_path* into *out_dir* as page-NNN.png.

    Returns (page_count, first_page_width, first_page_height).
    All values are 0 on failure.
    """
    out_dir.mkdir(parents=True, exist_ok=True)

    try:
        doc = fitz.open(str(pdf_path))
    except Exception as exc:  # noqa: BLE001
        print(f"    ERROR opening PDF {pdf_path.name}: {exc}", file=sys.stderr)
        return 0, 0, 0

    zoom = dpi / 72.0
    mat = fitz.Matrix(zoom, zoom)
    first_w = first_h = 0
    count = 0

    for page_index in range(len(doc)):
        page_num = page_index + 1
        out_file = out_dir / f"page-{page_num:03d}.png"

        if out_file.exists() and out_file.stat().st_size > 0:
            print(f"      [skip] {out_file.name} already exists")
            if page_index == 0:
                # Read dimensions from existing file without re-rendering
                pix_tmp = doc.load_page(0).get_pixmap(matrix=mat, alpha=False)
                first_w, first_h = pix_tmp.width, pix_tmp.height
            count += 1
            continue

        page = doc.load_page(page_index)
        pix = page.get_pixmap(matrix=mat, alpha=False)
        pix.save(str(out_file))
        print(f"      → {out_file.name}  ({pix.width}×{pix.height} px)")

        if page_index == 0:
            first_w, first_h = pix.width, pix.height
        count += 1

    doc.close()
    return count, first_w, first_h


# ---------------------------------------------------------------------------
# schematic_data.json writer
# ---------------------------------------------------------------------------

def write_schematic_data(
    product_dir: Path,
    sku: str,
    name: str,
    page_count: int,
    img_width: int,
    img_height: int,
) -> None:
    """
    Write a schematic_data.json skeleton into *product_dir*.
    Skips the write if the file already exists (preserves any manual edits).
    """
    dest = product_dir / "schematic_data.json"
    if dest.exists():
        return

    # Use a millisecond timestamp as a stable-enough unique id
    uid = str(int(time.time() * 1000))

    data = {
        "id": uid,
        "title": f"{sku}_SCH" if sku else name,
        "product_name": name,
        "sku": sku,
        "diagramPages": list(range(1, page_count + 1)),
        "legendPages": [],
        "parts": [],
        "coordinates": {},
        "schema_version": "1.0",
        "image_natural_width": img_width if img_width else None,
        "image_natural_height": img_height if img_height else None,
    }

    with open(dest, "w", encoding="utf-8") as fh:
        json.dump(data, fh, indent=2, ensure_ascii=False)
    print(f"      Wrote {dest.relative_to(REPO_ROOT)}")


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=(
            "Download all Asgard Tools schematic PDFs, convert to PNG, "
            "and organise output in frontend/public/brands/Asgard/Schematics/."
        ),
    )
    parser.add_argument(
        "--dpi",
        type=int,
        default=DEFAULT_DPI,
        help=f"PNG render resolution in DPI (default: {DEFAULT_DPI})",
    )
    parser.add_argument(
        "--pdf-only",
        action="store_true",
        help="Download PDFs but skip PNG conversion and schematic_data.json writing",
    )
    parser.add_argument(
        "--images-only",
        action="store_true",
        help="Skip downloading; re-convert PDFs listed in the saved manifest",
    )
    parser.add_argument(
        "--delay",
        type=float,
        default=DEFAULT_DELAY,
        help=f"Seconds between HTTP requests (default: {DEFAULT_DELAY})",
    )
    return parser.parse_args()


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main() -> None:
    args = parse_args()
    manifest_path = SCRATCH_DIR / "manifest.json"
    pdf_dir = SCRATCH_DIR / "pdfs"

    session = make_session()
    manifest = load_manifest(manifest_path)

    # ------------------------------------------------------------------
    # 1. Discover PDF entries (name, sku, category, url)
    # ------------------------------------------------------------------
    if args.images_only:
        if not manifest:
            print(
                "ERROR: --images-only requires a saved manifest "
                f"({manifest_path}).  Run without --images-only first.",
                file=sys.stderr,
            )
            sys.exit(1)
        entries = list(manifest.values())
        print(f"--images-only: loaded {len(entries)} entries from manifest.\n")
    else:
        print(f"Fetching index page: {INDEX_URL}")
        resp = session.get(INDEX_URL, timeout=30)
        resp.raise_for_status()
        entries = find_pdf_entries(resp.text, INDEX_URL)
        print(f"Found {len(entries)} PDF link(s) on the page.\n")

        if not entries:
            print(
                "No PDF links found – check page structure or network access.",
                file=sys.stderr,
            )
            sys.exit(1)

    # ------------------------------------------------------------------
    # 2. Download PDFs & update manifest
    # ------------------------------------------------------------------
    downloaded = []

    if not args.images_only:
        pdf_dir.mkdir(parents=True, exist_ok=True)
        for idx, entry in enumerate(entries, start=1):
            name = entry["name"]
            sku = entry["sku"] or "(no SKU)"
            cat = entry["category"]
            url = entry["url"]
            filename = entry["filename"]

            print(f"[{idx}/{len(entries)}] {name}  |  SKU: {sku}  |  Category: {cat}")
            dest = pdf_dir / filename
            ok = download_pdf(session, url, dest)
            if ok:
                entry["local_pdf"] = str(dest)
                manifest[url] = entry
                downloaded.append(entry)
            if idx < len(entries):
                time.sleep(args.delay)

        save_manifest(manifest_path, manifest)
        print(f"\nDownloaded {len(downloaded)} PDF(s).  Manifest → {manifest_path}\n")
    else:
        downloaded = entries

    # ------------------------------------------------------------------
    # 3. Convert PDFs → PNG + write schematic_data.json
    # ------------------------------------------------------------------
    if args.pdf_only:
        print("--pdf-only: skipping PNG conversion.")
        _print_summary(downloaded, 0, pdf_dir)
        return

    print(f"Converting PDFs to PNG images at {args.dpi} DPI …\n")
    total_pages = 0
    failed = []

    for entry in downloaded:
        name = entry["name"]
        sku = entry.get("sku", "")
        category = entry.get("category", "Uncategorized")
        local_pdf = entry.get("local_pdf") or str(pdf_dir / entry["filename"])
        pdf_path = Path(local_pdf)

        # Use SKU as folder name when available; fall back to PDF stem
        folder_name = sku if sku else pdf_path.stem
        product_dir = BRANDS_DIR / category / folder_name

        print(f"  [{category}/{folder_name}]  {pdf_path.name}")

        if not pdf_path.exists():
            print(f"    WARNING: PDF not found at {pdf_path} – skipping", file=sys.stderr)
            failed.append(pdf_path.name)
            continue

        page_count, img_w, img_h = pdf_to_png(pdf_path, product_dir, dpi=args.dpi)
        total_pages += page_count

        if page_count == 0:
            failed.append(pdf_path.name)
        else:
            write_schematic_data(product_dir, sku, name, page_count, img_w, img_h)
            # Keep manifest up-to-date with the product directory
            entry["product_dir"] = str(product_dir)
            if entry.get("url"):
                manifest[entry["url"]] = entry

    save_manifest(manifest_path, manifest)
    _print_summary(downloaded, total_pages, pdf_dir, failed)


def _print_summary(entries, total_pages, pdf_dir, failed=None):
    print("\n" + "=" * 60)
    print("SUMMARY")
    print("=" * 60)
    print(f"  PDFs processed        : {len(entries)}")
    print(f"  PNG pages produced    : {total_pages}")
    print(f"  PDFs directory        : {pdf_dir}")
    print(f"  Schematics directory  : {BRANDS_DIR}")
    if failed:
        print(f"\n  FAILED ({len(failed)}):")
        for name in failed:
            print(f"    - {name}")


if __name__ == "__main__":
    main()
