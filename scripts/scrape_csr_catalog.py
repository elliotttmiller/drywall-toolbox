#!/usr/bin/env python3
"""
scrape_csr_catalog.py — CSR Building Shopify catalog scraper.

Scrapes all products for brands: Asgard, Columbia, Level 5, TapeTech
from categories: Automatic Taping Tools, Semi Automatic Taping Tools,
Taping & Finishing Tools, and Parts.

Outputs:
  products/scraped_results/CSR/csr_raw_products.json    — raw Shopify API data
  products/scraped_results/CSR/csr_catalog.json         — structured catalog manifest
  products/scraped_results/CSR/csr_wc_catalog.csv       — WooCommerce import CSV

Variable/Variation mapping:
  - Single-variant "Default Title" products → Type = simple
  - Multi-variant products → Type = variable (parent) + variation rows (children)
"""

from __future__ import annotations

import csv
import html
import json
import re
import time
import urllib.request
from pathlib import Path
from typing import Any

# ── Paths ─────────────────────────────────────────────────────────────────────
REPO = Path(__file__).resolve().parent.parent
OUT_DIR = REPO / "products" / "scraped_results" / "CSR"
OUT_DIR.mkdir(parents=True, exist_ok=True)

RAW_JSON   = OUT_DIR / "csr_raw_products.json"
CATALOG_JSON = OUT_DIR / "csr_catalog.json"
WC_CSV     = OUT_DIR / "csr_wc_catalog.csv"

# ── Target filter config ───────────────────────────────────────────────────────
TARGET_VENDORS: set[str] = {"Asgard", "Columbia", "Level 5", "TapeTech"}

TARGET_PRODUCT_TYPES: set[str] = {
    "Automatic Taping Tools",
    "Semi Automatic Taping Tools",
    "Taping & Finishing Tools",
    "Parts",
}

# ── Brand normalization (CSR vendor → WooCommerce brand label) ─────────────────
BRAND_MAP: dict[str, str] = {
    "Asgard":   "Asgard",
    "Columbia": "Columbia Taping Tools",
    "Level 5":  "Level 5 Tools",
    "TapeTech": "TapeTech",
}

# ── Category mapping (CSR product_type → WC category path) ────────────────────
# Format: "Drywall Finishing Tools > {WC_Brand} > {Sub-category}"
CATEGORY_MAP: dict[str, str] = {
    "Automatic Taping Tools":     "Automatic Tapers",
    "Semi Automatic Taping Tools": "Semi-Automatic Tapers",
    "Taping & Finishing Tools":   "Taping & Finishing Tools",
    "Parts":                      "Repair Kits & Parts",
}

# ── WooCommerce CSV columns ────────────────────────────────────────────────────
WC_COLS = [
    "Brands", "Type", "SKU", "MPN", "GTIN, UPC, EAN, or ISBN",
    "Name", "Published", "Is featured?", "Visibility in catalog",
    "Short description", "Description",
    "Date sale price starts", "Date sale price ends",
    "Tax status", "Tax class",
    "In stock?", "Stock", "Low stock amount",
    "Backorders allowed?", "Sold individually?",
    "Weight (lbs)", "Length (in)", "Width (in)", "Height (in)",
    "Allow customer reviews?", "Purchase note",
    "Sale price", "Regular price",
    "Categories", "Tags", "Shipping class", "Images",
    "Download limit", "Download expiry days",
    "Parent", "Grouped products", "Upsells", "Cross-sells",
    "External URL", "Button text", "Position",
    "Attribute 1 name", "Attribute 1 value(s)", "Attribute 1 visible", "Attribute 1 global",
    "Attribute 1 used for variations",
    "Attribute 2 name", "Attribute 2 value(s)", "Attribute 2 visible", "Attribute 2 global",
    "Attribute 2 used for variations",
    "Meta: _dtb_seo_title", "Meta: _dtb_seo_description",
    "Meta: _mpn", "Meta: _csr_product_id", "Meta: _csr_handle",
    "Meta: _dtb_seo_focus_kw", "Meta: _dtb_seo_canonical", "Meta: _dtb_seo_noindex",
]

# ── Helpers ────────────────────────────────────────────────────────────────────

def blank_row() -> dict[str, str]:
    return {c: "" for c in WC_COLS}


def strip_csr_prefix(sku: str) -> str:
    """Strip CSR supplier prefix '08' from SKU to get manufacturer SKU/MPN."""
    if sku and sku.startswith("08") and len(sku) > 3:
        return sku[2:]
    return sku


def html_to_text(body: str) -> str:
    """Very light HTML → plain text (for short descriptions)."""
    text = re.sub(r"<[^>]+>", " ", body or "")
    text = html.unescape(text)
    return re.sub(r"\s+", " ", text).strip()


def short_desc(body_html: str, max_chars: int = 250) -> str:
    """Generate a short description from HTML body."""
    text = html_to_text(body_html)
    if len(text) <= max_chars:
        return text
    truncated = text[:max_chars]
    last_space = truncated.rfind(" ")
    return (truncated[:last_space] if last_space > 0 else truncated) + "…"


def make_parent_sku(vendor: str, handle: str, variants: list[dict],
                    product_id: int | None = None) -> str:
    """
    Derive a guaranteed-unique parent SKU for variable products.

    Strategy:
      1. Find longest common prefix across all variant SKUs (≥ 3 chars and
         does NOT equal any single variant's full SKU).
      2. Fall back to brand-code prefix + Shopify product ID (always unique).

    The result is guaranteed to be unique per product because the Shopify
    product handle is unique and product_id is always unique.
    """
    brand_codes = {"Asgard": "ASG", "Columbia": "COL", "Level 5": "L5", "TapeTech": "TT"}
    code = brand_codes.get(vendor, vendor[:3].upper())

    skus = [strip_csr_prefix(v["sku"]) for v in variants if v.get("sku")]

    if len(skus) > 1:
        # Find common prefix across all variant SKUs
        base = skus[0]
        for s in skus[1:]:
            while base and not s.startswith(base):
                base = base[:-1]
        base = base.rstrip("-_/ ").strip()
        # Only use the common prefix if it differs from every individual SKU
        # (avoids parent_sku == child_sku collision) and is meaningful
        if base and len(base) >= 3 and base not in skus:
            return base

    # Fall back: brand code + Shopify product ID (always unique)
    if product_id:
        return f"{code}-{product_id}"

    # Last resort: brand code + sanitized handle (truncated for readability)
    slug = re.sub(r"[^a-z0-9]+", "-", handle.lower()).strip("-")
    slug = re.sub(r"-+", "-", slug)
    return f"{code}-{slug[:30]}"


def grams_to_lbs(grams: int) -> str:
    if not grams:
        return ""
    lbs = grams / 453.592
    return f"{lbs:.2f}"


def build_wc_category(vendor: str, product_type: str) -> str:
    wc_brand = BRAND_MAP.get(vendor, vendor)
    sub = CATEGORY_MAP.get(product_type, product_type)
    return f"Drywall Finishing Tools > {wc_brand} > {sub}"


def build_tags(product: dict[str, Any]) -> str:
    tags = product.get("tags", [])
    extra = [product.get("vendor", ""), product.get("product_type", "")]
    all_tags = [t.strip() for t in (tags + extra) if t and t.strip()]
    # Deduplicate preserving order
    seen = set()
    unique = []
    for t in all_tags:
        if t.lower() not in seen:
            seen.add(t.lower())
            unique.append(t)
    return ", ".join(unique)


def product_images(product: dict[str, Any], variant_id: int | None = None) -> str:
    """Return comma-separated image URLs for a product or specific variant."""
    images = product.get("images", [])
    if variant_id is not None:
        # Return images assigned to this variant first, then fallback to all
        variant_imgs = [img["src"] for img in images if variant_id in img.get("variant_ids", [])]
        if variant_imgs:
            return ", ".join(variant_imgs)
    # All product images
    return ", ".join(img["src"] for img in images if img.get("src"))


def defaults() -> dict[str, str]:
    d = blank_row()
    d.update({
        "Published":               "1",
        "Is featured?":            "0",
        "Visibility in catalog":   "visible",
        "Tax status":              "taxable",
        "In stock?":               "1",
        "Backorders allowed?":     "0",
        "Sold individually?":      "0",
        "Allow customer reviews?": "1",
    })
    return d


# ── Scraper ────────────────────────────────────────────────────────────────────

def fetch_all_products(delay: float = 0.5) -> list[dict]:
    """Fetch every page of csrbuilding.com/products.json and return all products."""
    all_products = []
    page = 1
    while True:
        url = f"https://csrbuilding.com/products.json?limit=250&page={page}"
        req = urllib.request.Request(url, headers={"User-Agent": "DTB-Scraper/1.0"})
        try:
            with urllib.request.urlopen(req, timeout=30) as resp:
                data = json.loads(resp.read())
        except Exception as exc:
            print(f"  [WARN] Error fetching page {page}: {exc}")
            break
        prods = data.get("products", [])
        if not prods:
            break
        all_products.extend(prods)
        print(f"  Fetched page {page} — {len(prods)} products (cumulative: {len(all_products)})")
        page += 1
        time.sleep(delay)
    return all_products


def filter_products(products: list[dict]) -> list[dict]:
    """Keep only target-brand products in target categories."""
    filtered = []
    for p in products:
        vendor = p.get("vendor", "")
        ptype  = p.get("product_type", "")
        if vendor in TARGET_VENDORS and ptype in TARGET_PRODUCT_TYPES:
            filtered.append(p)
    return filtered


# ── WooCommerce row builders ───────────────────────────────────────────────────

def build_simple_row(product: dict, vendor: str, wc_brand: str, category: str,
                     variant: dict, position: int) -> dict:
    sku     = strip_csr_prefix(variant.get("sku", ""))
    mpn     = sku
    name    = product.get("title", "").strip()
    body    = product.get("body_html", "")
    price   = variant.get("price", "")
    grams   = variant.get("grams", 0)
    avail   = "1" if variant.get("available", True) else "0"

    row = defaults()
    row.update({
        "Brands":               wc_brand,
        "Type":                 "simple",
        "SKU":                  sku,
        "MPN":                  mpn,
        "Name":                 name,
        "Short description":    short_desc(body),
        "Description":          body,
        "Regular price":        price,
        "In stock?":            avail,
        "Weight (lbs)":         grams_to_lbs(grams),
        "Categories":           category,
        "Tags":                 build_tags(product),
        "Images":               product_images(product),
        "Position":             str(position),
        "Attribute 1 name":     "Brand",
        "Attribute 1 value(s)": wc_brand,
        "Attribute 1 visible":  "1",
        "Attribute 1 global":   "1",
        "Attribute 1 used for variations": "0",
        "Meta: _dtb_seo_title": name,
        "Meta: _dtb_seo_description": short_desc(body, 155),
        "Meta: _mpn":           mpn,
        "Meta: _csr_product_id": str(product.get("id", "")),
        "Meta: _csr_handle":    product.get("handle", ""),
        "Meta: _dtb_seo_focus_kw": name.lower(),
    })
    return row


def build_variable_rows(product: dict, vendor: str, wc_brand: str, category: str,
                        variants: list[dict], options: list[dict],
                        position: int) -> list[dict]:
    """
    Build a parent (variable) row + one variation row per variant.
    Options mapping:
      - First non-Brand option → Attribute 2 (used for variations)
      - Brand always → Attribute 1
    """
    rows: list[dict] = []
    parent_sku = make_parent_sku(vendor, product.get("handle", ""), variants,
                                 product.get("id"))
    name       = product.get("title", "").strip()
    body       = product.get("body_html", "")

    # Collect all option names (skip generic "Title")
    variation_options = [o for o in options if o["name"].lower() not in ("title",)]
    opt_name = variation_options[0]["name"] if variation_options else options[0]["name"]

    # All values for the variation attribute (for parent row)
    all_opt_values = " | ".join(
        v.get("option1", "") or ""
        for v in variants
        if v.get("option1") and v.get("option1") != "Default Title"
    )

    # ── Parent row ────────────────────────────────────────────────────────────
    parent = defaults()
    parent.update({
        "Brands":               wc_brand,
        "Type":                 "variable",
        "SKU":                  parent_sku,
        "MPN":                  parent_sku,
        "Name":                 name,
        "Short description":    short_desc(body),
        "Description":          body,
        "In stock?":            "1",
        "Categories":           category,
        "Tags":                 build_tags(product),
        "Images":               product_images(product),
        "Position":             str(position),
        "Attribute 1 name":     "Brand",
        "Attribute 1 value(s)": wc_brand,
        "Attribute 1 visible":  "1",
        "Attribute 1 global":   "1",
        "Attribute 1 used for variations": "0",
        "Attribute 2 name":     opt_name,
        "Attribute 2 value(s)": all_opt_values,
        "Attribute 2 visible":  "1",
        "Attribute 2 global":   "1",
        "Attribute 2 used for variations": "1",
        "Meta: _dtb_seo_title": name,
        "Meta: _dtb_seo_description": short_desc(body, 155),
        "Meta: _mpn":           parent_sku,
        "Meta: _csr_product_id": str(product.get("id", "")),
        "Meta: _csr_handle":    product.get("handle", ""),
        "Meta: _dtb_seo_focus_kw": name.lower(),
    })
    rows.append(parent)

    # ── Variation rows ────────────────────────────────────────────────────────
    for idx, variant in enumerate(variants):
        var_sku   = strip_csr_prefix(variant.get("sku", ""))
        opt_value = variant.get("option1", "") or var_sku
        if opt_value == "Default Title":
            opt_value = var_sku
        price     = variant.get("price", "")
        grams     = variant.get("grams", 0)
        avail     = "1" if variant.get("available", True) else "0"

        # Image: prefer variant-specific image, else product images
        var_img = product_images(product, variant.get("id"))

        var_row = defaults()
        var_row.update({
            "Brands":               wc_brand,
            "Type":                 "variation",
            "SKU":                  var_sku,
            "MPN":                  var_sku,
            "Name":                 name,
            "In stock?":            avail,
            "Regular price":        price,
            "Weight (lbs)":         grams_to_lbs(grams),
            "Images":               var_img,
            "Parent":               parent_sku,
            "Position":             str(idx + 1),
            "Attribute 1 name":     "Brand",
            "Attribute 1 value(s)": wc_brand,
            "Attribute 1 visible":  "1",
            "Attribute 1 global":   "1",
            "Attribute 1 used for variations": "0",
            "Attribute 2 name":     opt_name,
            "Attribute 2 value(s)": opt_value,
            "Attribute 2 visible":  "1",
            "Attribute 2 global":   "1",
            "Attribute 2 used for variations": "1",
            "Meta: _dtb_seo_title": f"{name} – {opt_value}",
            "Meta: _dtb_seo_description": f"{name} – {opt_value}. {short_desc(body, 120)}",
            "Meta: _mpn":           var_sku,
            "Meta: _csr_product_id": str(product.get("id", "")),
            "Meta: _csr_handle":    product.get("handle", ""),
            "Allow customer reviews?": "0",
        })
        rows.append(var_row)

    return rows


# ── Catalog manifest builder ───────────────────────────────────────────────────

def build_catalog_entry(product: dict, vendor: str) -> dict:
    """Build a structured catalog entry for the JSON manifest."""
    wc_brand  = BRAND_MAP.get(vendor, vendor)
    ptype     = product.get("product_type", "")
    category  = build_wc_category(vendor, ptype)
    variants  = product.get("variants", [])
    options   = product.get("options", [])
    is_simple = (len(variants) == 1 and
                 options and options[0]["name"].lower() == "title")

    entry: dict[str, Any] = {
        "csr_id":       product["id"],
        "csr_handle":   product["handle"],
        "brand":        wc_brand,
        "csr_vendor":   vendor,
        "product_type": ptype,
        "wc_category":  category,
        "title":        product.get("title", ""),
        "product_kind": "simple" if is_simple else "variable",
        "tags":         product.get("tags", []),
        "images":       [img["src"] for img in product.get("images", [])],
        "body_html":    product.get("body_html", ""),
    }

    if is_simple:
        v = variants[0]
        sku = strip_csr_prefix(v.get("sku", ""))
        entry["sku"] = sku
        entry["mpn"] = sku
        entry["price"] = v.get("price", "")
        entry["available"] = v.get("available", True)
        entry["weight_grams"] = v.get("grams", 0)
    else:
        variation_options = [o for o in options if o["name"].lower() not in ("title",)]
        opt_name = variation_options[0]["name"] if variation_options else options[0]["name"]
        parent_sku = make_parent_sku(vendor, product.get("handle", ""), variants,
                                     product.get("id"))
        entry["parent_sku"] = parent_sku
        entry["variation_attribute"] = opt_name
        entry["variations"] = []
        for v in variants:
            var_sku = strip_csr_prefix(v.get("sku", ""))
            opt_val = v.get("option1", "")
            if opt_val == "Default Title":
                opt_val = var_sku
            var_imgs = product_images(product, v.get("id"))
            entry["variations"].append({
                "sku":          var_sku,
                "mpn":          var_sku,
                "option_value": opt_val,
                "price":        v.get("price", ""),
                "available":    v.get("available", True),
                "weight_grams": v.get("grams", 0),
                "images":       [url.strip() for url in var_imgs.split(", ") if url.strip()],
            })

    return entry


def _unique_sku(base_sku: str, seen: set[str], fallback_suffix: str) -> str:
    """Return `base_sku` if not in `seen`, else `base_sku-{fallback_suffix}` or
    `base_sku-{n}` until unique.  Mutates nothing; caller adds result to seen."""
    if base_sku not in seen:
        return base_sku
    candidate = f"{base_sku}-{fallback_suffix}"
    if candidate not in seen:
        return candidate
    n = 2
    while True:
        candidate = f"{base_sku}-{n}"
        if candidate not in seen:
            return candidate
        n += 1


# ── Main ───────────────────────────────────────────────────────────────────────

def main() -> None:
    print("=" * 70)
    print("CSR Building Catalog Scraper")
    print("Target brands:", ", ".join(sorted(TARGET_VENDORS)))
    print("Target types: ", ", ".join(sorted(TARGET_PRODUCT_TYPES)))
    print("=" * 70)

    # ── 1. Fetch raw products ────────────────────────────────────────────────
    print("\n[1/4] Fetching all products from csrbuilding.com …")
    all_products = fetch_all_products(delay=0.4)
    print(f"  Total products fetched: {len(all_products)}")

    # Save raw
    RAW_JSON.write_text(json.dumps(all_products, indent=2), encoding="utf-8")
    print(f"  Raw JSON → {RAW_JSON.relative_to(REPO)}")

    # ── 2. Filter ────────────────────────────────────────────────────────────
    print("\n[2/4] Filtering to target brands and categories …")
    target_products = filter_products(all_products)
    print(f"  Matching products: {len(target_products)}")

    # Summary by brand + type
    summary: dict[str, int] = {}
    for p in target_products:
        key = f"{p['vendor']} | {p['product_type']}"
        summary[key] = summary.get(key, 0) + 1
    for k, c in sorted(summary.items()):
        print(f"    {c:4d}  {k}")

    # ── 3. Build catalog manifest ────────────────────────────────────────────
    print("\n[3/4] Building catalog manifest …")
    catalog: dict[str, Any] = {
        "source":     "csrbuilding.com",
        "scraped_at": __import__("datetime").datetime.now(__import__("datetime").timezone.utc).isoformat(),
        "total":      len(target_products),
        "brands":     sorted(TARGET_VENDORS),
        "categories": sorted(TARGET_PRODUCT_TYPES),
        "summary":    summary,
        "products":   [],
    }

    for p in target_products:
        vendor = p.get("vendor", "")
        entry  = build_catalog_entry(p, vendor)
        catalog["products"].append(entry)

    CATALOG_JSON.write_text(json.dumps(catalog, indent=2), encoding="utf-8")
    print(f"  Catalog JSON → {CATALOG_JSON.relative_to(REPO)}")

    # ── 4. Build WooCommerce CSV ─────────────────────────────────────────────
    print("\n[4/4] Building WooCommerce CSV …")
    wc_rows: list[dict] = []
    seen_skus: set[str] = set()
    position = 1

    for p in target_products:
        vendor   = p.get("vendor", "")
        ptype    = p.get("product_type", "")
        wc_brand = BRAND_MAP.get(vendor, vendor)
        category = build_wc_category(vendor, ptype)
        variants = p.get("variants", [])
        options  = p.get("options", [])

        is_simple = (len(variants) == 1 and
                     options and options[0]["name"].lower() == "title")

        if is_simple:
            row = build_simple_row(p, vendor, wc_brand, category,
                                   variants[0], position)
            row["SKU"] = _unique_sku(row["SKU"], seen_skus, str(p.get("id", "")))
            row["MPN"] = row["SKU"]
            row["Meta: _mpn"] = row["SKU"]
            seen_skus.add(row["SKU"])
            wc_rows.append(row)
        else:
            product_rows = build_variable_rows(p, vendor, wc_brand, category,
                                               variants, options, position)
            parent_row  = product_rows[0]
            child_rows  = product_rows[1:]

            # Dedupe parent SKU
            parent_sku = _unique_sku(parent_row["SKU"], seen_skus, str(p.get("id", "")))
            parent_row["SKU"]  = parent_sku
            parent_row["MPN"]  = parent_sku
            parent_row["Meta: _mpn"] = parent_sku
            seen_skus.add(parent_sku)

            # Dedupe variation SKUs and fix parent reference
            for child in child_rows:
                child["Parent"] = parent_sku
                child_sku = _unique_sku(child["SKU"], seen_skus, child["SKU"])
                child["SKU"]  = child_sku
                child["MPN"]  = child_sku
                child["Meta: _mpn"] = child_sku
                seen_skus.add(child_sku)

            wc_rows.append(parent_row)
            wc_rows.extend(child_rows)

        position += 1

    with open(WC_CSV, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=WC_COLS, extrasaction="ignore")
        writer.writeheader()
        writer.writerows(wc_rows)

    print(f"  WooCommerce CSV → {WC_CSV.relative_to(REPO)}")
    print(f"  Total WC rows written: {len(wc_rows)}")

    # ── Summary ──────────────────────────────────────────────────────────────
    simple_count    = sum(1 for r in wc_rows if r.get("Type") == "simple")
    variable_count  = sum(1 for r in wc_rows if r.get("Type") == "variable")
    variation_count = sum(1 for r in wc_rows if r.get("Type") == "variation")

    print("\n" + "=" * 70)
    print("COMPLETE")
    print(f"  Simple products:    {simple_count:4d}")
    print(f"  Variable parents:   {variable_count:4d}")
    print(f"  Variation children: {variation_count:4d}")
    print(f"  Total CSV rows:     {len(wc_rows):4d}")
    print("=" * 70)


if __name__ == "__main__":
    main()
