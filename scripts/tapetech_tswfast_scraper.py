#!/usr/bin/env python3
"""
Tapetech Product Scrape, Data Normalization & Image Pipeline
============================================================
Data source: https://www.tswfast.com/category/brand_tapeTech (all pages)

Phases:
  1  Paginate every listing page → collect product URLs + MPN + name + thumbnail
  2  Visit each product detail page → full description, all gallery images
  3  Download every gallery image → convert to .webp →
       frontend/public/brands/Tapetech/Products/{MPN}.webp   (single)
       frontend/public/brands/Tapetech/Products/{MPN}_01.webp (multiple)
  4  Normalize all data → append/update frontend/public/wp-catalog.csv
  5  Validation report
"""

import csv
import os
import re
import shutil
import sys
import time
import urllib.error
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed
from io import BytesIO
from pathlib import Path

# ── Paths ─────────────────────────────────────────────────────────────────────
REPO_ROOT    = Path(__file__).resolve().parent.parent
CATALOG_CSV  = REPO_ROOT / "frontend" / "public" / "wp-catalog.csv"
DEST_IMG_DIR = REPO_ROOT / "frontend" / "public" / "brands" / "Tapetech" / "Products"
IMG_REL_PFX  = "brands/Tapetech/Products"

# ── Site constants ─────────────────────────────────────────────────────────────
BASE_URL      = "https://www.tswfast.com"
CATEGORY_PATH = "/category/brand_tapeTech"
BRAND_LABEL   = "TapeTech"
CATEGORY_STR  = "Drywall Finishing Tools > TapeTech"
HEADERS       = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/120.0.0.0 Safari/537.36"
    )
}
REQUEST_DELAY   = 0.25   # seconds between requests
REQUEST_TIMEOUT = 20     # seconds
MAX_WORKERS     = 6      # concurrent detail-page fetches

# ── Pillow ─────────────────────────────────────────────────────────────────────
try:
    from PIL import Image as PILImage
    HAS_PIL = True
except ImportError:
    HAS_PIL = False


# ══════════════════════════════════════════════════════════════════════════════
# Helpers
# ══════════════════════════════════════════════════════════════════════════════

def _fetch(url: str, retries: int = 3) -> str | None:
    """GET url → decoded str, or None on persistent failure."""
    for attempt in range(retries):
        try:
            req = urllib.request.Request(url, headers=HEADERS)
            with urllib.request.urlopen(req, timeout=REQUEST_TIMEOUT) as r:
                return r.read().decode("utf-8", errors="replace")
        except urllib.error.HTTPError as e:
            if e.code == 404:
                return None          # not found – don't retry
            if attempt < retries - 1:
                time.sleep(1.5 ** attempt)
        except Exception:
            if attempt < retries - 1:
                time.sleep(1.5 ** attempt)
    return None


def _fetch_bytes(url: str, retries: int = 3) -> bytes | None:
    """GET url → raw bytes, or None on failure."""
    for attempt in range(retries):
        try:
            req = urllib.request.Request(url, headers=HEADERS)
            with urllib.request.urlopen(req, timeout=REQUEST_TIMEOUT) as r:
                return r.read()
        except Exception:
            if attempt < retries - 1:
                time.sleep(1.5 ** attempt)
    return None


def _is_valid_webp(path: Path) -> bool:
    """True iff file has the RIFF/WEBP magic header."""
    try:
        with open(path, "rb") as fh:
            hdr = fh.read(12)
        return hdr[:4] == b"RIFF" and hdr[8:12] == b"WEBP"
    except OSError:
        return False


def _save_as_webp(raw: bytes, dest: Path, quality: int = 92) -> bool:
    """Save image bytes as .webp at dest. Returns True on success."""
    if not raw:
        return False
    # Already webp – write directly
    if raw[:4] == b"RIFF" and raw[8:12] == b"WEBP":
        dest.write_bytes(raw)
        return True
    if HAS_PIL:
        try:
            img = PILImage.open(BytesIO(raw))
            img.save(dest, format="WEBP", quality=quality, method=6)
            return True
        except Exception as exc:
            print(f"    [WARN] webp convert failed for {dest.name}: {exc}")
            return False
    # Fallback: write as-is (non-webp, but better than nothing)
    dest.write_bytes(raw)
    return True


def _strip_html(html: str) -> str:
    """Very lightweight HTML → plain-text conversion."""
    return re.sub(r"<[^>]+>", " ", html).strip()


def _normalize_mpn(raw: str) -> str:
    """Strip the 'TTT' prefix (case-insensitive) from a Tapetech MPN/SKU."""
    return re.sub(r"^TTT", "", raw.strip(), flags=re.IGNORECASE)


# ══════════════════════════════════════════════════════════════════════════════
# Phase 1 – Paginate listing pages → raw product stubs
# ══════════════════════════════════════════════════════════════════════════════

def _parse_listing_page(html: str) -> list[dict]:
    """Extract product stubs from a category listing page."""
    products = []
    # Each product tile: <div class="cvg-tile cp-product" data-code="TTT42TT" ...>
    tile_re = re.compile(
        r'<div[^>]+class="cvg-tile cp-product"[^>]+data-code="([^"]+)"[^>]*>'
        r'(.*?)</div>\s*</div>\s*</div>',   # close cvg-tile
        re.S,
    )
    for m in tile_re.finditer(html):
        mpn  = m.group(1).strip()
        body = m.group(2)

        # Product page path
        href_m = re.search(r'href="(/product/[^"?]+)', body)
        path   = href_m.group(1) if href_m else None

        # Product name
        name_m = re.search(r'class="cvg-name cp-name"[^>]*>\s*([^<]+)\s*</a>', body)
        name   = name_m.group(1).strip() if name_m else ""

        # Thumbnail image (used as fallback only)
        img_m  = re.search(r'<img[^>]+src="([^"]+)"', body)
        thumb  = img_m.group(1) if img_m else ""

        if mpn and path:
            products.append({
                "mpn":   _normalize_mpn(mpn),
                "path":  path,
                "name":  name,
                "thumb": thumb,
            })
    return products


def scrape_all_listing_pages() -> tuple[list[dict], int]:
    """
    Iterate all paginated listing pages.
    Returns (product_stubs, total_pages_scraped).
    """
    all_products: list[dict] = []
    seen_mpns:    set[str]   = set()
    page = 1

    print(f"[Phase 1] Paginating {BASE_URL}{CATEGORY_PATH} …")
    while True:
        url  = f"{BASE_URL}{CATEGORY_PATH}?page={page}"
        html = _fetch(url)
        if not html:
            print(f"  Page {page}: fetch failed – stopping pagination")
            break

        stubs = _parse_listing_page(html)
        if not stubs:
            # Empty page → we've gone past the last page
            break

        new = [s for s in stubs if s["mpn"] not in seen_mpns]
        seen_mpns.update(s["mpn"] for s in new)
        all_products.extend(new)
        print(f"  Page {page}: {len(stubs)} products ({len(new)} new) | running total: {len(all_products)}")

        page += 1
        time.sleep(REQUEST_DELAY)

    total_pages = page - 1
    print(f"[Phase 1] Done – {total_pages} pages scraped, {len(all_products)} unique products found")
    return all_products, total_pages


# ══════════════════════════════════════════════════════════════════════════════
# Phase 2 – Scrape each product detail page
# ══════════════════════════════════════════════════════════════════════════════

def _parse_detail_page(html: str, stub: dict) -> dict:
    """
    Parse a product detail page and return a full product dict.
    All fields that could not be determined are left as empty strings.
    """
    p: dict = {
        "mpn":         _normalize_mpn(stub["mpn"]),
        "name":        stub["name"],
        "description": "",
        "short_desc":  "",
        "images":      [],      # list of remote URLs in carousel order
        "attributes":  {},      # PART → code, MANUFACTURER → name, etc.
        "in_stock":    "1",     # assume in-stock unless 'out of stock' phrase found
    }

    # ── MPN / name from page (override stub if present) ──────────────────────
    code_m = re.search(r'<div[^>]+cv-content cp-product[^>]+data-code="([^"]+)"', html)
    if code_m:
        p["mpn"] = _normalize_mpn(code_m.group(1).strip())

    name_m = re.search(r'<span class="cp-name">([^<]+)</span>', html)
    if name_m:
        p["name"] = name_m.group(1).strip()

    # ── Gallery images (from carousel, order-preserving, deduplicated) ───────
    carousel_m = re.search(
        r'id="cv-carousel"(.*?)<!-- / product media -->',
        html, re.S
    )
    if carousel_m:
        carousel_html = carousel_m.group(1)
        # Use carousel-item images (not the duplicate thumbnail buttons)
        item_imgs = re.findall(
            r'class="carousel-item[^"]*"[^>]*>\s*<img[^>]+src="([^"]+)"',
            carousel_html, re.S
        )
        if item_imgs:
            p["images"] = list(dict.fromkeys(item_imgs))
        else:
            # Fallback: any img in carousel
            all_carousel = re.findall(r'<img[^>]+src="([^"]+)"', carousel_html)
            p["images"] = list(dict.fromkeys(all_carousel))

    # Fall back to OG image when carousel is empty
    if not p["images"]:
        og_m = re.search(r'<meta property="og:image" content="([^"]+)"', html)
        if og_m:
            p["images"] = [og_m.group(1)]

    # Fall back to thumbnail from listing
    if not p["images"] and stub.get("thumb"):
        p["images"] = [stub["thumb"]]

    # ── Full description (HTML preserved) ────────────────────────────────────
    desc_m = re.search(
        r'id="product-description"[^>]*>\s*(.*?)\s*(?=</div>\s*\n\s*</div>)',
        html, re.S
    )
    if desc_m:
        raw_desc = desc_m.group(1).strip()
        # Keep as HTML (matches existing catalog style)
        p["description"] = raw_desc
        # Short desc: first sentence / first <p>
        first_p = re.search(r'<p[^>]*>(.*?)</p>', raw_desc, re.S)
        if first_p:
            p["short_desc"] = _strip_html(first_p.group(1))[:250]
        else:
            p["short_desc"] = _strip_html(raw_desc)[:250]

    # ── Attributes (PART, MANUFACTURER, etc.) ────────────────────────────────
    for attr_m in re.finditer(
        r'cv-attribute[^>]*>\s*<span[^>]*>([^<]+)</span>\s*<span[^>]*>([^<]+)</span>',
        html
    ):
        key = attr_m.group(1).strip().upper()
        val = attr_m.group(2).strip()
        p["attributes"][key] = val

    # ── Stock status ─────────────────────────────────────────────────────────
    if re.search(r'out.of.stock|backordered|unavailable', html, re.I):
        p["in_stock"] = "0"

    return p


def _scrape_one_product(stub: dict) -> dict | None:
    """Fetch and parse a single product detail page."""
    url  = BASE_URL + stub["path"]
    html = _fetch(url)
    if not html:
        return None
    return _parse_detail_page(html, stub)


def scrape_all_product_details(stubs: list[dict]) -> tuple[list[dict], list[dict]]:
    """
    Scrape all product detail pages concurrently.
    Returns (products, failed_stubs).
    """
    products: list[dict]      = []
    failed:   list[dict]      = []
    total = len(stubs)

    print(f"[Phase 2] Scraping {total} product detail pages …")
    with ThreadPoolExecutor(max_workers=MAX_WORKERS) as pool:
        futures = {pool.submit(_scrape_one_product, s): s for s in stubs}
        done = 0
        for fut in as_completed(futures):
            stub = futures[fut]
            done += 1
            try:
                result = fut.result()
                if result:
                    products.append(result)
                else:
                    failed.append(stub)
                    print(f"  [WARN] detail fetch failed: {stub['path']}")
            except Exception as exc:
                failed.append(stub)
                print(f"  [WARN] detail error {stub['path']}: {exc}")

            if done % 50 == 0 or done == total:
                print(f"  Progress: {done}/{total}")

            time.sleep(REQUEST_DELAY / MAX_WORKERS)

    print(f"[Phase 2] Scraped {len(products)} products; {len(failed)} failed")
    return products, failed


# ══════════════════════════════════════════════════════════════════════════════
# Phase 3 – Download images → .webp
# ══════════════════════════════════════════════════════════════════════════════

def process_images(products: list[dict]) -> tuple[dict, dict, list]:
    """
    For each product, download all gallery images and save as .webp.

    Returns:
        local_image_map  – mpn → "brands/Tapetech/Products/MPN.webp" (or | -joined list)
        image_stats      – counters
        failures         – list of failure dicts
    """
    DEST_IMG_DIR.mkdir(parents=True, exist_ok=True)

    local_image_map: dict[str, str] = {}
    stats = {"saved": 0, "already_exists": 0, "failed": 0}
    failures: list[dict] = []

    print(f"[Phase 3] Processing images for {len(products)} products …")

    for product in products:
        mpn    = product["mpn"]
        urls   = product["images"]   # list of remote URLs

        if not urls:
            failures.append({"MPN": mpn, "name": product["name"], "reason": "no image URLs found"})
            stats["failed"] += 1
            continue

        saved_paths: list[str] = []

        for idx, url in enumerate(urls):
            # Filename: MPN.webp (single) or MPN_01.webp (multiple)
            if len(urls) == 1:
                filename = f"{mpn}.webp"
            else:
                filename = f"{mpn}_{idx + 1:02d}.webp"

            dest = DEST_IMG_DIR / filename
            rel  = f"{IMG_REL_PFX}/{filename}"

            # Already saved and valid?
            if dest.exists() and _is_valid_webp(dest):
                saved_paths.append(rel)
                stats["already_exists"] += 1
                continue

            raw = _fetch_bytes(url)
            if raw and _save_as_webp(raw, dest):
                # Verify
                if dest.stat().st_size > 0:
                    saved_paths.append(rel)
                    stats["saved"] += 1
                else:
                    dest.unlink(missing_ok=True)
                    failures.append({"MPN": mpn, "url": url, "reason": "saved file is zero-byte"})
                    stats["failed"] += 1
            else:
                failures.append({"MPN": mpn, "url": url, "reason": "download or conversion failed"})
                stats["failed"] += 1

        if saved_paths:
            local_image_map[mpn] = "|".join(saved_paths)

    print(
        f"[Phase 3] Images: {stats['saved']} saved, "
        f"{stats['already_exists']} already existed, "
        f"{stats['failed']} failed"
    )
    return local_image_map, stats, failures


# ══════════════════════════════════════════════════════════════════════════════
# Phase 4 – Normalize & merge into wp-catalog.csv
# ══════════════════════════════════════════════════════════════════════════════

def _build_row(product: dict, local_image_map: dict, position: int, headers: list[str]) -> dict:
    """Map a scraped product to the exact column structure of wp-catalog.csv."""
    mpn   = product["mpn"]
    name  = product["name"]
    # Use MPN as SKU since tswfast.com provides the part-number as the product code
    sku   = mpn

    full_name = name if f"({mpn})" in name else f"{name} ({mpn})"

    row: dict = {h: "" for h in headers}
    row.update({
        "Brands":                BRAND_LABEL,
        "SKU":                   sku,
        "MPN":                   mpn,
        "Name":                  full_name,
        "Type":                  "simple",
        "Description":           product.get("description", ""),
        "Short description":     product.get("short_desc", ""),
        "Regular price":         "",
        "Sale price":            "",
        "Images":                local_image_map.get(mpn, ""),
        "Categories":            CATEGORY_STR,
        "Tags":                  BRAND_LABEL,
        "Position":              str(position),
        "Published":             "1",
        "Is featured?":          "0",
        "Visibility in catalog": "visible",
        "Date sale price starts": "",
        "Date sale price ends":   "",
        "Tax status":            "taxable",
        "Tax class":             "",
        "In stock?":             product.get("in_stock", "1"),
        "Stock":                 "",
        "Low stock amount":      "",
        "Backorders allowed?":   "0",
        "Sold individually?":    "0",
        "Weight (lbs)":          "",
        "Length (in)":           "",
        "Width (in)":            "",
        "Height (in)":           "",
        "Allow customer reviews?": "1",
        "Purchase note":         "",
        "Shipping class":        "",
        "Download limit":        "",
        "Download expiry days":  "",
        "Parent":                "",
        "Grouped products":      "",
        "Upsells":               "",
        "Cross-sells":           "",
        "External URL":          "",
        "Button text":           "",
        "Attribute 1 name":      "Brand",
        "Attribute 1 value(s)":  BRAND_LABEL,
        "Attribute 1 visible":   "1",
        "Attribute 1 global":    "1",
    })
    return row


def load_catalog() -> tuple[list[str], list[dict], dict[str, int]]:
    """Read wp-catalog.csv. Returns (headers, rows, mpn_to_row_index)."""
    rows: list[dict] = []
    with open(CATALOG_CSV, newline="", encoding="utf-8") as fh:
        reader = csv.DictReader(fh)
        headers = list(reader.fieldnames or [])
        for r in reader:
            rows.append(r)

    mpn_index: dict[str, int] = {}
    for i, r in enumerate(rows):
        m = (r.get("MPN") or "").strip().upper()
        if m:
            mpn_index[m] = i

    return headers, rows, mpn_index


def merge_into_catalog(
    products: list[dict],
    local_image_map: dict,
) -> tuple[int, int]:
    """
    Merge scraped products into wp-catalog.csv.
    Returns (new_count, updated_count).
    """
    headers, rows, mpn_index = load_catalog()

    # Base position: max existing + 1
    positions = [int(r.get("Position", "0") or "0") for r in rows if r.get("Position")]
    next_pos  = max(positions, default=0) + 1

    new_count = updated_count = 0

    for product in products:
        mpn = product["mpn"].strip().upper()
        row = _build_row(product, local_image_map, next_pos, headers)

        if mpn and mpn in mpn_index:
            # Update existing row (overwrite all fields from new scrape)
            idx = mpn_index[mpn]
            for h in headers:
                if row.get(h, "") != "":
                    rows[idx][h] = row[h]
            updated_count += 1
        else:
            rows.append(row)
            if mpn:
                mpn_index[mpn] = len(rows) - 1
            new_count += 1
            next_pos  += 1

    # Write back
    with open(CATALOG_CSV, "w", newline="", encoding="utf-8") as fh:
        writer = csv.DictWriter(
            fh, fieldnames=headers, quoting=csv.QUOTE_ALL, extrasaction="ignore"
        )
        writer.writeheader()
        writer.writerows(rows)

    print(
        f"[Phase 4] CSV written – {len(rows)} total rows | "
        f"{new_count} new | {updated_count} updated"
    )
    return new_count, updated_count


# ══════════════════════════════════════════════════════════════════════════════
# Phase 5 – Validation & report
# ══════════════════════════════════════════════════════════════════════════════

def validate_images(local_image_map: dict) -> list[str]:
    warnings: list[str] = []
    for mpn, rel_str in local_image_map.items():
        for rel in rel_str.split("|"):
            abs_p = REPO_ROOT / "frontend" / "public" / rel
            if not abs_p.exists() or abs_p.stat().st_size == 0:
                warnings.append(f"[WARN] Missing/empty image file: {rel}")
            elif not _is_valid_webp(abs_p):
                warnings.append(f"[WARN] Not a valid .webp: {rel}")
    return warnings


def print_report(
    total_pages: int,
    total_products: int,
    detail_failures: list[dict],
    new_count: int,
    updated_count: int,
    img_stats: dict,
    img_failures: list[dict],
    no_mpn: list[dict],
    validation_warnings: list[str],
) -> None:
    sep = "═" * 70
    print(f"\n{sep}")
    print("PHASE 5 — VALIDATION & OUTPUT REPORT")
    print(sep)
    print(f"[PASS] Total pages scraped:                {total_pages}")
    print(f"[PASS] Total products found & processed:   {total_products}")
    print(f"[PASS] New rows added to CSV:               {new_count}")
    print(f"[PASS] Existing rows updated in CSV:        {updated_count}")
    total_imgs = img_stats["saved"] + img_stats["already_exists"]
    print(f"[PASS] Images downloaded/converted (.webp): {total_imgs}")
    print(f"       — freshly downloaded:                {img_stats['saved']}")
    print(f"       — already existed (valid):           {img_stats['already_exists']}")
    print(f"       — failed:                            {img_stats['failed']}")

    if no_mpn:
        print(f"\n[WARN] Products with no MPN ({len(no_mpn)}):")
        for p in no_mpn[:10]:
            print(f"       • path={p.get('path')} name={p.get('name','?')[:60]}")

    if detail_failures:
        print(f"\n[WARN] Product detail pages that failed to scrape ({len(detail_failures)}):")
        for f in detail_failures[:10]:
            print(f"       • {f.get('path','?')}")
        if len(detail_failures) > 10:
            print(f"       … and {len(detail_failures)-10} more")

    if img_failures:
        print(f"\n[WARN] Images that failed ({len(img_failures)}):")
        for f in img_failures[:10]:
            print(f"       • MPN={f.get('MPN','?')}  reason={f.get('reason','?')}")
        if len(img_failures) > 10:
            print(f"       … and {len(img_failures)-10} more")

    for w in validation_warnings[:20]:
        print(w)
    if not (no_mpn or detail_failures or img_failures or validation_warnings):
        print("[PASS] No warnings.")

    print(sep)


# ══════════════════════════════════════════════════════════════════════════════
# Entry point
# ══════════════════════════════════════════════════════════════════════════════

def main() -> None:
    print("\n" + "═" * 70)
    print("TAPETECH TSWFAST.COM SCRAPER PIPELINE")
    print("═" * 70)

    # Phase 1 ─────────────────────────────────────────────────────────────────
    print("\n── Phase 1: Paginate listing pages ──")
    stubs, total_pages = scrape_all_listing_pages()

    no_mpn = [s for s in stubs if not s.get("mpn")]
    stubs  = [s for s in stubs if s.get("mpn")]

    # Phase 2 ─────────────────────────────────────────────────────────────────
    print("\n── Phase 2: Scrape product detail pages ──")
    products, detail_failures = scrape_all_product_details(stubs)

    # Phase 3 ─────────────────────────────────────────────────────────────────
    print("\n── Phase 3: Download & convert images ──")
    local_image_map, img_stats, img_failures = process_images(products)

    # Phase 4 ─────────────────────────────────────────────────────────────────
    print("\n── Phase 4: Merge into wp-catalog.csv ──")
    new_count, updated_count = merge_into_catalog(products, local_image_map)

    # Phase 5 ─────────────────────────────────────────────────────────────────
    print("\n── Phase 5: Validation ──")
    validation_warnings = validate_images(local_image_map)

    print_report(
        total_pages=total_pages,
        total_products=len(products),
        detail_failures=detail_failures,
        new_count=new_count,
        updated_count=updated_count,
        img_stats=img_stats,
        img_failures=img_failures,
        no_mpn=no_mpn,
        validation_warnings=validation_warnings,
    )


if __name__ == "__main__":
    main()
