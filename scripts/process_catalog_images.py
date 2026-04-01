#!/usr/bin/env python3
"""
process_catalog_images.py

Downloads external product-part images referenced in wp-catalog.csv, converts
them to WebP format, saves them under frontend/public/brands/, and updates the
CSV to use self-hosted drywalltoolbox.com URLs.

Background
----------
Parts rows in wp-catalog.csv that originate from combined_parts_catalog.csv
carry image URLs pointing to the BigCommerce CDN (cdn11.bigcommerce.com).
WooCommerce import works fine with external URLs, but hosting images under the
site's own domain is preferred for:
  - Reliability (no dependency on a third-party CDN going offline).
  - SEO (images are associated with the domain in Google image search).
  - Consistency with product images already hosted at drywalltoolbox.com.

Directory / URL structure
-------------------------
Downloaded images are saved under frontend/public/brands/ and are served as
static assets from the React frontend build (webpack copies public/ → dist/).

  Local file : frontend/public/brands/<BrandDir>/<sku_slug>.webp
  Public URL : https://drywalltoolbox.com/brands/<BrandDir>/<sku_slug>.webp

Where:
  BrandDir  – canonical brand directory name (see BRAND_DIR_MAP below):
               "Columbia Taping Tools" → "Columbia"
               "TapeTech"             → "TapeTech"
               "Graco"                → "Graco"
               "Level5"               → "Level5"
  sku_slug  – SKU lower-cased, with non-alphanumeric chars replaced by hyphens
               (e.g. "050023F" → "050023f")

ID column
---------
The WooCommerce store is a fresh installation with no existing products.
All rows in wp-catalog.csv (products and parts) are assigned sequential IDs
starting at 1 by merge_wc_catalog.py.  Starting at 1 is optimal for a
clean initial import: there are no existing WP posts to collide with,
no live product URLs to break, and the gap-free sequence is easy to audit.
Previously, products held sparse WordPress post IDs (17, 19, 21 …) while
parts had NO IDs at all; both problems are resolved by the merge script.

Usage
-----
    python3 scripts/process_catalog_images.py
    python3 scripts/process_catalog_images.py --dry-run
    python3 scripts/process_catalog_images.py --limit 20 --delay 1.0
    python3 scripts/process_catalog_images.py --output-dir /tmp/brands-images

Options
-------
    --dry-run      Print what would be done without downloading or modifying files.
    --limit N      Process only the first N rows that have external images.
    --delay SEC    Seconds to pause between HTTP requests (default: 0.5).
    --output-dir   Directory to write converted WebP files
                   (default: frontend/public/brands/ in the repo root).
    --csv-in       Path to the input CSV (default: wp-catalog.csv in repo root).
    --csv-out      Path to write the updated CSV (default: same as --csv-in).

After running
-------------
The WebP files are placed directly under the React frontend's public/brands/
directory.  They are automatically included in the production build (webpack
copies frontend/public/ → dist/) and served at:
    https://drywalltoolbox.com/brands/<BrandDir>/<sku_slug>.webp
"""

import argparse
import csv
import os
import re
import sys
import time
from pathlib import Path
from urllib.parse import urlparse

try:
    import requests
except ImportError:
    print(
        "ERROR: 'requests' is not installed.  Run:\n  pip install requests",
        file=sys.stderr,
    )
    sys.exit(1)

try:
    from PIL import Image
    import io as _io
except ImportError:
    print(
        "ERROR: 'Pillow' is not installed.  Run:\n  pip install Pillow",
        file=sys.stderr,
    )
    sys.exit(1)

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
REPO_ROOT  = os.path.dirname(SCRIPT_DIR)

DEFAULT_CSV_PATH    = os.path.join(REPO_ROOT, "wp-catalog.csv")
DEFAULT_OUTPUT_DIR  = os.path.join(REPO_ROOT, "frontend", "public", "brands")
DTB_DOMAIN          = "drywalltoolbox.com"
DTB_BRANDS_BASE     = "https://drywalltoolbox.com/brands"
MANIFEST_FILENAME   = "image-manifest.csv"

# ---------------------------------------------------------------------------
# Brand directory mapping
# Maps the "Brands" CSV value to the canonical subdirectory name under
# frontend/public/brands/.  Unmapped brands fall back to the raw brand name.
# ---------------------------------------------------------------------------

BRAND_DIR_MAP = {
    "Columbia Taping Tools": "Columbia",
    "TapeTech":              "TapeTech",
    "Graco":                 "Graco",
    "Level5":                "Level5",
    "Asgard":                "Asgard",
    "SurPro":                "SurPro",
}

# ---------------------------------------------------------------------------
# HTTP session
# ---------------------------------------------------------------------------

BROWSER_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
    ),
    "Accept": "image/webp,image/apng,image/*,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
    # Omit 'br' (brotli) – requests cannot decompress it natively.
    "Accept-Encoding": "gzip, deflate",
    "Connection": "keep-alive",
}

REQUEST_TIMEOUT = 30  # seconds


def make_session() -> requests.Session:
    session = requests.Session()
    session.headers.update(BROWSER_HEADERS)
    return session


# ---------------------------------------------------------------------------
# Slug helpers
# ---------------------------------------------------------------------------

def slugify(text: str) -> str:
    """
    Convert an arbitrary string to a URL/filesystem-safe lowercase slug.
    Non-alphanumeric characters are collapsed into a single hyphen.
    Leading/trailing hyphens are removed.
    """
    text = text.lower().strip()
    text = re.sub(r"[^a-z0-9]+", "-", text)
    return text.strip("-")


def brand_slug(brand: str) -> str:
    """Return a filesystem-safe slug for the brand name."""
    return slugify(brand) if brand else "unknown-brand"


def sku_slug(sku: str) -> str:
    """Return a filesystem-safe slug for a product SKU."""
    return slugify(sku) if sku else "unknown-sku"


# ---------------------------------------------------------------------------
# Image URL helpers
# ---------------------------------------------------------------------------

def is_external_image(url: str) -> bool:
    """
    Return True when the URL points to an external host (i.e. not
    drywalltoolbox.com).  Empty strings and obvious placeholder SVGs return
    False.
    """
    if not url:
        return False
    if "loading.svg" in url:
        return False
    parsed = urlparse(url)
    host = parsed.netloc.lower()
    return bool(host) and DTB_DOMAIN not in host


def brand_dir(brand: str) -> str:
    """
    Return the canonical brand directory name under frontend/public/brands/.
    Falls back to a slugified version of the brand name for unmapped brands.
    """
    if not brand:
        return "unknown-brand"
    return BRAND_DIR_MAP.get(brand, brand_slug(brand))


def build_local_path(output_dir: str, brand: str, sku: str) -> Path:
    """
    Return the absolute local path where the WebP image should be written.
    Structure: <output_dir>/<BrandDir>/<sku_slug>.webp
    """
    return Path(output_dir) / brand_dir(brand) / (sku_slug(sku) + ".webp")


def build_dtb_url(brand: str, sku: str) -> str:
    """
    Return the drywalltoolbox.com URL for a product's WebP image served from
    the React frontend static assets.
    Structure: https://drywalltoolbox.com/brands/<BrandDir>/<sku_slug>.webp
    """
    return f"{DTB_BRANDS_BASE}/{brand_dir(brand)}/{sku_slug(sku)}.webp"


# ---------------------------------------------------------------------------
# Download + convert
# ---------------------------------------------------------------------------

def download_and_convert(
    session: requests.Session,
    url: str,
    local_path: Path,
    *,
    dry_run: bool = False,
) -> bool:
    """
    Download the image at *url*, convert it to WebP, and save it at
    *local_path*.

    Returns True on success, False on any failure (the error is printed but
    does not raise an exception so the caller can continue processing).

    When *dry_run* is True the function prints what it would do and returns
    True without writing any files.
    """
    if dry_run:
        print(f"    [dry-run] would download {url}")
        print(f"    [dry-run] would save     {local_path}")
        return True

    try:
        response = session.get(url, timeout=REQUEST_TIMEOUT, stream=True)
        response.raise_for_status()
    except requests.RequestException as exc:
        print(f"    [WARN] download failed: {exc}", file=sys.stderr)
        return False

    # Read the entire image body into memory (safe for typical product images).
    raw_bytes = response.content
    if not raw_bytes:
        print("    [WARN] empty response body", file=sys.stderr)
        return False

    try:
        img = Image.open(_io.BytesIO(raw_bytes))
        # Convert palette/RGBA modes so WebP encoder is happy.
        if img.mode in ("P", "RGBA"):
            img = img.convert("RGBA")
        elif img.mode not in ("RGB", "L"):
            img = img.convert("RGB")
    except Exception as exc:
        print(f"    [WARN] image decode failed: {exc}", file=sys.stderr)
        return False

    local_path.parent.mkdir(parents=True, exist_ok=True)
    try:
        img.save(local_path, format="WEBP", quality=85, method=4)
    except Exception as exc:
        print(f"    [WARN] save failed: {exc}", file=sys.stderr)
        return False

    return True


# ---------------------------------------------------------------------------
# CSV processing
# ---------------------------------------------------------------------------

def open_csv(path: str):
    """Open a CSV with UTF-8-sig encoding and error replacement (BOM-safe)."""
    return open(path, encoding="utf-8-sig", errors="replace", newline="")


def process_catalog(
    csv_in: str,
    csv_out: str,
    output_dir: str,
    *,
    dry_run: bool = False,
    limit: int = 0,
    delay: float = 0.5,
) -> int:
    """
    Main processing loop.

    Reads *csv_in*, downloads + converts external images, updates the Images
    column with new drywalltoolbox.com URLs, and writes the result to *csv_out*.

    Also writes a manifest CSV at <output_dir>/image-manifest.csv listing every
    row that was processed.

    Returns the number of images successfully converted.
    """
    with open_csv(csv_in) as f:
        reader = csv.DictReader(f)
        fieldnames = reader.fieldnames
        rows = list(reader)

    if fieldnames is None:
        print("ERROR: could not read CSV headers", file=sys.stderr)
        return 0

    session = make_session()
    manifest_rows = []          # records for the manifest CSV
    success_count = 0
    processed = 0

    print(f"Input CSV   : {csv_in}")
    print(f"Output CSV  : {csv_out}")
    print(f"Images dir  : {output_dir}")
    print(f"Total rows  : {len(rows)}")
    print()

    for row in rows:
        img_url = row.get("Images", "").strip()
        sku     = row.get("SKU",    "").strip()
        brand   = row.get("Brands", "").strip()

        if not is_external_image(img_url):
            # Row already uses a DTB URL or has no image – nothing to do.
            continue

        if limit and processed >= limit:
            break

        processed += 1
        local_path = build_local_path(output_dir, brand, sku)
        new_url    = build_dtb_url(brand, sku)

        print(f"  [{processed}] SKU={sku} brand={brand or '?'}")
        print(f"       src : {img_url}")
        print(f"       dst : {new_url}")

        ok = download_and_convert(session, img_url, local_path, dry_run=dry_run)

        manifest_rows.append(
            {
                "sku":       sku,
                "brand":     brand,
                "src_url":   img_url,
                "local_path": str(local_path),
                "new_url":   new_url,
                "status":    "ok" if ok else "failed",
            }
        )

        if ok:
            # Update the row in-place so the output CSV carries the new URL.
            row["Images"] = new_url
            success_count += 1
            print(f"       ✓ saved")
        else:
            print(f"       ✗ failed (original URL kept)")

        if delay > 0 and not dry_run:
            time.sleep(delay)

    print()
    print(f"Converted {success_count} / {processed} images.")

    # ------------------------------------------------------------------
    # Write updated CSV
    # ------------------------------------------------------------------
    if not dry_run:
        with open(csv_out, "w", encoding="utf-8", newline="") as f:
            writer = csv.DictWriter(f, fieldnames=fieldnames, quoting=csv.QUOTE_ALL)
            writer.writeheader()
            writer.writerows(rows)
        print(f"Updated CSV written to: {csv_out}")

        # ------------------------------------------------------------------
        # Write manifest
        # ------------------------------------------------------------------
        if manifest_rows:
            manifest_path = os.path.join(REPO_ROOT, MANIFEST_FILENAME)
            manifest_fields = ["sku", "brand", "src_url", "local_path", "new_url", "status"]
            with open(manifest_path, "w", encoding="utf-8", newline="") as mf:
                writer = csv.DictWriter(mf, fieldnames=manifest_fields, quoting=csv.QUOTE_ALL)
                writer.writeheader()
                writer.writerows(manifest_rows)
            print(f"Manifest written to   : {manifest_path}")
    else:
        print("[dry-run] No files written.")

    return success_count


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

def build_arg_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(
        description=(
            "Download external part images from wp-catalog.csv, convert to WebP, "
            "and update the CSV to use drywalltoolbox.com URLs."
        )
    )
    p.add_argument(
        "--dry-run",
        action="store_true",
        help="Print planned actions without downloading or writing files.",
    )
    p.add_argument(
        "--limit",
        type=int,
        default=0,
        metavar="N",
        help="Process at most N rows with external images (0 = all).",
    )
    p.add_argument(
        "--delay",
        type=float,
        default=0.5,
        metavar="SEC",
        help="Seconds to wait between HTTP requests (default: 0.5).",
    )
    p.add_argument(
        "--output-dir",
        default=DEFAULT_OUTPUT_DIR,
        metavar="DIR",
        help=f"Directory to write converted WebP files (default: {DEFAULT_OUTPUT_DIR}).",
    )
    p.add_argument(
        "--csv-in",
        default=DEFAULT_CSV_PATH,
        metavar="PATH",
        help=f"Input CSV path (default: {DEFAULT_CSV_PATH}).",
    )
    p.add_argument(
        "--csv-out",
        default=None,
        metavar="PATH",
        help="Output CSV path (default: same as --csv-in, i.e. update in-place).",
    )
    return p


def main() -> int:
    args = build_arg_parser().parse_args()

    csv_in  = args.csv_in
    csv_out = args.csv_out if args.csv_out else args.csv_in

    if not os.path.isfile(csv_in):
        print(f"ERROR: input CSV not found: {csv_in}", file=sys.stderr)
        return 1

    process_catalog(
        csv_in,
        csv_out,
        args.output_dir,
        dry_run=args.dry_run,
        limit=args.limit,
        delay=args.delay,
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
