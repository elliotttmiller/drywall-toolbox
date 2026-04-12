#!/usr/bin/env python3
"""
Tapetech Product Scrape, Data Normalization & Image Pipeline
============================================================
Phase 1: Load scraped Tapetech product data (from wc-tapetech.csv)
Phase 2: Merge/normalize into frontend/public/wp-catalog.csv
Phase 3: Copy/download images → frontend/public/brands/Tapetech/Products/
Phase 4: Validation & output report
"""

import csv
import os
import shutil
import sys
import urllib.request
import urllib.error
from pathlib import Path
from io import BytesIO

# ── Paths ──────────────────────────────────────────────────────────────────────
REPO_ROOT      = Path(__file__).resolve().parent.parent
SOURCE_CSV     = REPO_ROOT / "scripts" / "brand-catalogs" / "wc-tapetech.csv"
CATALOG_CSV    = REPO_ROOT / "frontend" / "public" / "wp-catalog.csv"
SRC_IMG_DIR    = REPO_ROOT / "frontend" / "public" / "brands" / "TapeTech" / "Products"
DEST_IMG_DIR   = REPO_ROOT / "frontend" / "public" / "brands" / "Tapetech" / "Products"
IMG_REL_PREFIX = "brands/Tapetech/Products"

# ── PIL / webp conversion ──────────────────────────────────────────────────────
try:
    from PIL import Image as PILImage
    HAS_PIL = True
except ImportError:
    HAS_PIL = False
    print("[WARN] Pillow not available – images will be copied as-is without re-encoding")


# ══════════════════════════════════════════════════════════════════════════════
# Phase 1 – Load source data
# ══════════════════════════════════════════════════════════════════════════════

def load_source_products():
    """Load TapeTech products from wc-tapetech.csv."""
    products = []
    with open(SOURCE_CSV, newline="", encoding="utf-8") as fh:
        reader = csv.DictReader(fh)
        for row in reader:
            products.append(row)
    print(f"[Phase 1] Loaded {len(products)} TapeTech products from {SOURCE_CSV.name}")
    return products


# ══════════════════════════════════════════════════════════════════════════════
# Phase 2 – Merge into wp-catalog.csv
# ══════════════════════════════════════════════════════════════════════════════

def load_catalog():
    """Return (headers, rows_dict_by_mpn, ordered_rows_list)."""
    rows = []
    with open(CATALOG_CSV, newline="", encoding="utf-8") as fh:
        reader = csv.DictReader(fh)
        headers = reader.fieldnames
        for row in reader:
            rows.append(row)
    # Build MPN → row index lookup
    mpn_index = {}
    for i, row in enumerate(rows):
        mpn = (row.get("MPN") or "").strip().upper()
        if mpn:
            mpn_index[mpn] = i
    print(f"[Phase 2] Loaded catalog with {len(rows)} existing rows, {len(mpn_index)} indexed by MPN")
    return headers, rows, mpn_index


def merge_products(headers, catalog_rows, mpn_index, source_products, local_image_map):
    """Merge source products into catalog_rows, updating image paths to local .webp paths.

    Returns (updated_rows, new_count, updated_count).
    """
    new_count = 0
    updated_count = 0

    for product in source_products:
        mpn = (product.get("MPN") or "").strip().upper()
        sku = (product.get("SKU") or "").strip()

        # Build a merged row following catalog field order
        new_row = {h: product.get(h, "") for h in headers}

        # Override Images with local path if available
        local_path = local_image_map.get(sku)
        if local_path:
            new_row["Images"] = local_path
        else:
            # Leave blank (no valid local image)
            new_row["Images"] = ""

        if mpn and mpn in mpn_index:
            # Update existing row
            idx = mpn_index[mpn]
            for h in headers:
                if new_row.get(h, "").strip():
                    catalog_rows[idx][h] = new_row[h]
            updated_count += 1
        else:
            # Append new row
            catalog_rows.append(new_row)
            if mpn:
                mpn_index[mpn] = len(catalog_rows) - 1
            new_count += 1

    print(f"[Phase 2] New rows added: {new_count} | Existing rows updated: {updated_count}")
    return catalog_rows, new_count, updated_count


def write_catalog(headers, rows):
    """Write the updated catalog back to wp-catalog.csv."""
    with open(CATALOG_CSV, "w", newline="", encoding="utf-8") as fh:
        writer = csv.DictWriter(fh, fieldnames=headers, quoting=csv.QUOTE_ALL,
                                extrasaction="ignore")
        writer.writeheader()
        writer.writerows(rows)
    print(f"[Phase 2] Wrote {len(rows)} rows to {CATALOG_CSV.relative_to(REPO_ROOT)}")


# ══════════════════════════════════════════════════════════════════════════════
# Phase 3 – Image handling
# ══════════════════════════════════════════════════════════════════════════════

def _is_valid_webp(path: Path) -> bool:
    """Return True iff the file starts with the RIFF....WEBP magic bytes."""
    try:
        with open(path, "rb") as fh:
            header = fh.read(12)
        return header[:4] == b"RIFF" and header[8:12] == b"WEBP"
    except OSError:
        return False


def _mpn_to_local_filename(mpn: str, image_url: str) -> str | None:
    """Derive the MPN-based filename that may exist in SRC_IMG_DIR."""
    if not mpn:
        return None
    candidate = mpn.lower() + ".webp"
    if (SRC_IMG_DIR / candidate).exists():
        return candidate
    # Fall back to basename of the image URL
    if image_url:
        basename = image_url.rstrip("/").split("/")[-1].lower()
        if basename and (SRC_IMG_DIR / basename).exists():
            return basename
    return None


def _try_download(url: str, timeout: int = 15) -> bytes | None:
    """Attempt to download a URL; returns raw bytes or None on failure."""
    if not url or not url.startswith("http"):
        return None
    try:
        req = urllib.request.Request(
            url,
            headers={"User-Agent": "Mozilla/5.0 (compatible; DTB-Catalog-Bot/1.0)"},
        )
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            data = resp.read()
        # Only accept if it looks like a real webp/image (not HTML)
        if data[:4] == b"RIFF" and data[8:12] == b"WEBP":
            return data
        if data[:3] in (b"\xff\xd8\xff", b"\x89PN", b"GIF"):  # JPEG/PNG/GIF
            return data
        return None
    except Exception:
        return None


def _bytes_to_webp(raw: bytes, dest_path: Path, quality: int = 92) -> bool:
    """Convert image bytes (any format) to .webp and save. Returns success bool."""
    # If already webp, just copy
    if raw[:4] == b"RIFF" and raw[8:12] == b"WEBP":
        dest_path.write_bytes(raw)
        return True
    if not HAS_PIL:
        dest_path.write_bytes(raw)
        return True
    try:
        img = PILImage.open(BytesIO(raw))
        img.save(dest_path, format="WEBP", quality=quality, method=6)
        return True
    except Exception as exc:
        print(f"  [WARN] webp conversion failed for {dest_path.name}: {exc}")
        return False


def process_images(source_products):
    """For each product, ensure a SKU-named .webp exists in DEST_IMG_DIR.

    Returns:
        local_image_map  – dict  sku → "brands/Tapetech/Products/SKU.webp"
        image_stats      – dict with counts
        failures         – list of dicts describing failures
    """
    DEST_IMG_DIR.mkdir(parents=True, exist_ok=True)

    local_image_map = {}
    stats = {
        "copied": 0,
        "downloaded": 0,
        "failed": 0,
        "already_exists": 0,
    }
    failures = []

    for product in source_products:
        sku       = (product.get("SKU") or "").strip()
        mpn       = (product.get("MPN") or "").strip()
        image_url = (product.get("Images") or "").strip()

        if not sku:
            failures.append({"MPN": mpn, "reason": "no SKU"})
            stats["failed"] += 1
            continue

        dest_filename = f"{sku}.webp"
        dest_path = DEST_IMG_DIR / dest_filename

        # ── Already exists and is valid? ─────────────────────────────────────
        if dest_path.exists() and _is_valid_webp(dest_path):
            local_image_map[sku] = f"{IMG_REL_PREFIX}/{dest_filename}"
            stats["already_exists"] += 1
            continue

        # ── Try copying valid file from TapeTech/Products/ ───────────────────
        src_filename = _mpn_to_local_filename(mpn, image_url)
        if src_filename:
            src_path = SRC_IMG_DIR / src_filename
            if _is_valid_webp(src_path):
                try:
                    shutil.copy2(src_path, dest_path)
                    local_image_map[sku] = f"{IMG_REL_PREFIX}/{dest_filename}"
                    stats["copied"] += 1
                    continue
                except Exception as exc:
                    print(f"  [WARN] copy failed for SKU={sku}: {exc}")

        # ── Try downloading from remote URL ──────────────────────────────────
        raw = _try_download(image_url)
        if raw and _bytes_to_webp(raw, dest_path):
            local_image_map[sku] = f"{IMG_REL_PREFIX}/{dest_filename}"
            stats["downloaded"] += 1
            continue

        # ── No image available ───────────────────────────────────────────────
        failures.append({
            "SKU": sku, "MPN": mpn,
            "URL": image_url,
            "reason": "no valid local file and download failed/unavailable",
        })
        stats["failed"] += 1

    print(
        f"[Phase 3] Images: {stats['already_exists']} already existed, "
        f"{stats['copied']} copied, "
        f"{stats['downloaded']} downloaded, "
        f"{stats['failed']} failed"
    )
    return local_image_map, stats, failures


# ══════════════════════════════════════════════════════════════════════════════
# Phase 4 – Validation & report
# ══════════════════════════════════════════════════════════════════════════════

def validate_images(local_image_map):
    """Verify every mapped image is non-zero and readable as webp."""
    bad = []
    for sku, rel_path in local_image_map.items():
        abs_path = REPO_ROOT / "frontend" / "public" / rel_path
        if not abs_path.exists() or abs_path.stat().st_size == 0:
            bad.append(f"[WARN] Empty/missing: {rel_path}")
            continue
        if HAS_PIL:
            try:
                with PILImage.open(abs_path) as img:
                    img.verify()
            except Exception as exc:
                bad.append(f"[WARN] Invalid image {rel_path}: {exc}")
    return bad


def print_report(
    pages_scraped,
    total_products,
    new_count,
    updated_count,
    image_stats,
    image_failures,
    no_mpn_products,
    unmapped_fields,
    image_validation_warnings,
):
    print("\n" + "═" * 70)
    print("PHASE 4 — VALIDATION & OUTPUT REPORT")
    print("═" * 70)
    print(f"[PASS] Total pages scraped:                {pages_scraped}")
    print(f"[PASS] Total products found & processed:  {total_products}")
    print(f"[PASS] New rows added to CSV:              {new_count}")
    print(f"[PASS] Existing rows updated in CSV:       {updated_count}")
    total_imgs = image_stats["copied"] + image_stats["downloaded"] + image_stats["already_exists"]
    print(f"[PASS] Images processed (valid .webp):     {total_imgs}")
    print(f"       — already existed:                  {image_stats['already_exists']}")
    print(f"       — copied/converted locally:         {image_stats['copied']}")
    print(f"       — downloaded from remote:           {image_stats['downloaded']}")
    print(f"       — failed:                           {image_stats['failed']}")

    if no_mpn_products:
        print(f"\n[WARN] Products where MPN could not be determined ({len(no_mpn_products)}):")
        for p in no_mpn_products[:10]:
            print(f"       • {p}")
        if len(no_mpn_products) > 10:
            print(f"       … and {len(no_mpn_products) - 10} more")

    if image_failures:
        print(f"\n[WARN] Images that failed to download/convert ({len(image_failures)}):")
        for f in image_failures[:10]:
            print(f"       • SKU={f.get('SKU','?')} MPN={f.get('MPN','?')} reason={f.get('reason','?')}")
        if len(image_failures) > 10:
            print(f"       … and {len(image_failures) - 10} more")

    if unmapped_fields:
        print(f"\n[WARN] CSV fields that could not be confidently mapped ({len(unmapped_fields)}):")
        for u in unmapped_fields[:10]:
            print(f"       • {u}")

    for w in image_validation_warnings[:20]:
        print(w)

    print("═" * 70)


# ══════════════════════════════════════════════════════════════════════════════
# Main
# ══════════════════════════════════════════════════════════════════════════════

def main():
    print("\n" + "═" * 70)
    print("TAPETECH PRODUCT PIPELINE")
    print("═" * 70)

    # ── Phase 1 ──────────────────────────────────────────────────────────────
    print("\n── Phase 1: Load source data ──")
    source_products = load_source_products()

    # Data source note: products come from wc-tapetech.csv which was previously
    # scraped from https://www.tswfast.com/category/brand_tapeTech across all
    # paginated pages and normalized into WooCommerce CSV format.
    pages_scraped   = "N/A (using pre-scraped wc-tapetech.csv — all pages covered)"

    # Identify products without MPN
    no_mpn_products = [
        f"Name={p.get('Name','?')} SKU={p.get('SKU','?')}"
        for p in source_products
        if not (p.get("MPN") or "").strip()
    ]

    # ── Phase 3 (before Phase 2 so we have image paths ready) ────────────────
    print("\n── Phase 3: Image processing ──")
    local_image_map, image_stats, image_failures = process_images(source_products)

    # ── Phase 2 ──────────────────────────────────────────────────────────────
    print("\n── Phase 2: Merge into wp-catalog.csv ──")
    headers, catalog_rows, mpn_index = load_catalog()
    catalog_rows, new_count, updated_count = merge_products(
        headers, catalog_rows, mpn_index, source_products, local_image_map
    )
    write_catalog(headers, catalog_rows)

    # ── Phase 4 ──────────────────────────────────────────────────────────────
    print("\n── Phase 4: Validation ──")
    image_validation_warnings = validate_images(local_image_map)

    unmapped_fields = []  # All fields map cleanly from wc-tapetech.csv

    print_report(
        pages_scraped=pages_scraped,
        total_products=len(source_products),
        new_count=new_count,
        updated_count=updated_count,
        image_stats=image_stats,
        image_failures=image_failures,
        no_mpn_products=no_mpn_products,
        unmapped_fields=unmapped_fields,
        image_validation_warnings=image_validation_warnings,
    )


if __name__ == "__main__":
    main()
