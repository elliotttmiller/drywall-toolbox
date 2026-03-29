#!/usr/bin/env python3
"""Transform product catalog CSVs into WooCommerce Product Importer format.

Sources
-------
  public/products_catalog.csv          – all brands (TapeTech, Asgard, Graco, SurPro, Columbia)
  public/products_catalog_columbia.csv – Columbia products with image_1…image_9 columns

Output
------
  public/catalog/woocommerce_products.csv

Transformations performed
-------------------------
  1. Column mapping to WooCommerce standards:
       description_full  → Description   (Markdown converted to HTML)
       description_short → Short description
       price_numeric     → Regular price  (cleaned: no $, no commas)
       sku               → SKU
       name              → Name
       brand             → used for category mapping
       images / image_1…image_9 → Images (comma-separated)

  2. Category mapping (hierarchical):
       Columbia Taping Tools  → "Drywall Tools > <sub-category>" (keyword detection)
       TapeTech               → "Other Brands > TapeTech"
       Asgard                 → "Other Brands > Asgard"
       Graco                  → "Other Brands > Graco"
       SurPro                 → "Other Brands > SurPro"

  3. Global attributes added to every product row:
       Material, Size/Width, Weight Class, Warranty
       (values auto-detected from name/description where possible)

  4. Variable products (Task 4):
       TSB-7 … TSB-48  → parent TSB-PARENT (variable) + variation rows
       SSB10 … SSB48   → parent SSB-PARENT (variable) + variation rows
       Kit/combo rows  → kept as simple products

  5. Image column: columbia image_1…image_9 consolidated; external BigCommerce
     URLs kept as-is (image-optimizer.php downloads & converts them later).

Usage
-----
  python scripts/transform_woocommerce_csv.py
  python scripts/transform_woocommerce_csv.py \\
      --main    public/products_catalog.csv \\
      --columbia public/products_catalog_columbia.csv \\
      --output  public/catalog/woocommerce_products.csv
"""
from __future__ import annotations

import argparse
import csv
import logging
import re
import shutil
import sys
import tempfile
from pathlib import Path


# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

REPO_ROOT = Path(__file__).resolve().parent.parent
DEFAULT_MAIN = REPO_ROOT / "public" / "products_catalog.csv"
DEFAULT_COLUMBIA = REPO_ROOT / "public" / "products_catalog_columbia.csv"
DEFAULT_OUTPUT = REPO_ROOT / "public" / "catalog" / "woocommerce_products.csv"

# WooCommerce importer column order
WC_FIELDNAMES = [
    "ID",
    "Type",
    "SKU",
    "Name",
    "Published",
    "Is featured?",
    "Visibility in catalog",
    "Short description",
    "Description",
    "Date sale price starts",
    "Date sale price ends",
    "Tax status",
    "Tax class",
    "In stock?",
    "Stock",
    "Low stock amount",
    "Backorders allowed?",
    "Sold individually?",
    "Weight (kg)",
    "Length (cm)",
    "Width (cm)",
    "Height (cm)",
    "Allow customer reviews?",
    "Purchase note",
    "Sale price",
    "Regular price",
    "Categories",
    "Tags",
    "Shipping class",
    "Images",
    "Download limit",
    "Download expiry days",
    "Parent",
    "Grouped products",
    "Upsells",
    "Cross-sells",
    "External URL",
    "Button text",
    "Position",
    "Attribute 1 name",
    "Attribute 1 value(s)",
    "Attribute 1 visible",
    "Attribute 1 global",
    "Attribute 1 default",
    "Attribute 2 name",
    "Attribute 2 value(s)",
    "Attribute 2 visible",
    "Attribute 2 global",
    "Attribute 2 default",
    "Attribute 3 name",
    "Attribute 3 value(s)",
    "Attribute 3 visible",
    "Attribute 3 global",
    "Attribute 3 default",
    "Attribute 4 name",
    "Attribute 4 value(s)",
    "Attribute 4 visible",
    "Attribute 4 global",
    "Attribute 4 default",
    "Meta: _upc",
]

# ---------------------------------------------------------------------------
# Tomahawk & Sabre variation families
# ---------------------------------------------------------------------------

TSB_SKUS = {
    "TSB-7":  {"size": '7"',  "price": "44.34"},
    "TSB-10": {"size": '10"', "price": "56.24"},
    "TSB-12": {"size": '12"', "price": "63.81"},
    "TSB-14": {"size": '14"', "price": "75.71"},
    "TSB-18": {"size": '18"', "price": "86.52"},
    "TSB-24": {"size": '24"', "price": "103.82"},
    "TSB-32": {"size": '32"', "price": "122.21"},
    "TSB-40": {"size": '40"', "price": "151.41"},
    "TSB-48": {"size": '48"', "price": "200.08"},
}

SSB_SKUS = {
    "SSB10": {"size": '10"', "price": "29.99"},
    "SSB12": {"size": '12"', "price": "31.99"},
    "SSB14": {"size": '14"', "price": "32.99"},
    "SSB16": {"size": '16"', "price": "38.99"},
    "SSB18": {"size": '18"', "price": "44.99"},
    "SSB24": {"size": '24"', "price": "59.99"},
    "SSB32": {"size": '32"', "price": "74.99"},
    "SSB40": {"size": '40"', "price": "99.99"},
    "SSB48": {"size": '48"', "price": "129.99"},
}


# ---------------------------------------------------------------------------
# Markdown → HTML conversion
# ---------------------------------------------------------------------------

def markdown_to_html(text: str) -> str:
    """Convert a subset of Markdown used in product descriptions to HTML.

    Handles:
      ## Heading 2 → <h2>…</h2>
      ### Heading 3 → <h3>…</h3>
      **bold**      → <strong>…</strong>
      *italic*      → <em>…</em>
      - list item   → <ul><li>…</li></ul>  (consecutive list items are grouped)
      | table rows  → <table>…</table>
      blank lines   → paragraph breaks (wrapped in <p>…</p>)
    """
    if not text:
        return ""

    lines = text.splitlines()
    html_parts: list[str] = []
    in_list = False
    in_table = False

    def close_list() -> None:
        nonlocal in_list
        if in_list:
            html_parts.append("</ul>")
            in_list = False

    def close_table() -> None:
        nonlocal in_table
        if in_table:
            html_parts.append("</tbody></table>")
            in_table = False

    def inline(s: str) -> str:
        """Apply inline Markdown rules."""
        s = re.sub(r"\*\*(.+?)\*\*", r"<strong>\1</strong>", s)
        s = re.sub(r"\*(.+?)\*", r"<em>\1</em>", s)
        return s

    table_header_done = False

    for line in lines:
        stripped = line.strip()

        # --- Table rows ---
        if stripped.startswith("|"):
            if not in_table:
                close_list()
                html_parts.append('<table class="product-specs">')
                html_parts.append("<tbody>")
                in_table = True
                table_header_done = False
            # Skip separator rows (| --- | --- |)
            if re.match(r"^\|[-| :]+\|$", stripped):
                continue
            cells = [c.strip() for c in stripped.strip("|").split("|")]
            cells_html = "".join(f"<td>{inline(c)}</td>" for c in cells)
            html_parts.append(f"<tr>{cells_html}</tr>")
            continue

        # Leaving table context
        if in_table and not stripped.startswith("|"):
            close_table()
            table_header_done = False

        # --- Headings ---
        m = re.match(r"^(#{1,6})\s+(.*)", stripped)
        if m:
            close_list()
            level = len(m.group(1))
            heading_text = inline(m.group(2))
            html_parts.append(f"<h{level}>{heading_text}</h{level}>")
            continue

        # --- Unordered list items ---
        m = re.match(r"^[-*]\s+(.*)", stripped)
        if m:
            if not in_list:
                html_parts.append("<ul>")
                in_list = True
            html_parts.append(f"<li>{inline(m.group(1))}</li>")
            continue

        # --- Blank line ---
        if not stripped:
            close_list()
            close_table()
            html_parts.append("")
            continue

        # --- Normal paragraph line ---
        close_list()
        html_parts.append(inline(stripped))

    close_list()
    close_table()

    # Wrap consecutive non-empty, non-block lines into <p> tags
    result: list[str] = []
    para_buf: list[str] = []

    block_tags = re.compile(r"^<(h[1-6]|ul|ol|li|table|tbody|tr|td|th|/)", re.I)

    def flush_para() -> None:
        if para_buf:
            result.append("<p>" + " ".join(para_buf) + "</p>")
            para_buf.clear()

    for part in html_parts:
        if not part:
            flush_para()
        elif block_tags.match(part):
            flush_para()
            result.append(part)
        else:
            para_buf.append(part)

    flush_para()
    return "\n".join(result)


# ---------------------------------------------------------------------------
# Price cleaning
# ---------------------------------------------------------------------------

def clean_price(value: str) -> str:
    """Remove currency symbols, commas, and whitespace from a price string."""
    return re.sub(r"[^\d.]", "", value).strip()


# ---------------------------------------------------------------------------
# Category mapping
# ---------------------------------------------------------------------------

_COLUMBIA_SUB_PATTERNS: list[tuple[str, str]] = [
    (r"automatic taper|taper\b", "Automatic Tapers"),
    (r"flat box|flatbox",        "Flat Boxes"),
    (r"corner",                  "Corner Tools"),
    (r"smoothing blade",         "Smoothing Blades"),
    (r"pump|filler",             "Pumps & Fillers"),
    (r"nail spotter|nail spot",  "Nail Spotters"),
    (r"mud pan\b|drywall pan",   "Mud Pans"),
    (r"sander\b|sanding",        "Sanders"),
    (r"putty knife|putty\b",     "Putty Knives"),
    (r"\bhandle\b",              "Handles"),
    (r"set\b|kit\b|combo\b|bundle\b", "Tool Sets"),
    (r"replacement part|repair kit", "Replacement Parts"),
    (r"case\b|bag\b|storage\b",  "Cases & Storage"),
]

_BRAND_PARENT: dict[str, str] = {
    "TapeTech":             "Other Brands > TapeTech",
    "Asgard":               "Other Brands > Asgard",
    "Graco":                "Other Brands > Graco",
    "SurPro":               "Other Brands > SurPro",
    "Columbia Taping Tools": "Drywall Tools",
}


def map_category(brand: str, name: str) -> str:
    """Return the WooCommerce hierarchical category string for a product."""
    parent = _BRAND_PARENT.get(brand, "Drywall Tools")
    if brand == "Columbia Taping Tools":
        low = name.lower()
        for pattern, sub in _COLUMBIA_SUB_PATTERNS:
            if re.search(pattern, low):
                return f"Drywall Tools > {sub}"
        return "Drywall Tools"
    return parent


# ---------------------------------------------------------------------------
# Attribute helpers
# ---------------------------------------------------------------------------

def detect_size(name: str) -> str:
    """Extract a size/width attribute from the product name (e.g. '10"')."""
    m = re.search(r'(\d+(?:\.\d+)?)\s*["\u201c\u201d]', name)
    if m:
        return f'{m.group(1)}"'
    m = re.search(r'(\d+(?:\.\d+)?)\s*inch', name, re.I)
    if m:
        return f'{m.group(1)}"'
    return ""


def detect_material(description: str) -> str:
    """Detect material keywords from description text."""
    desc_low = description.lower()
    if "carbon fiber" in desc_low:
        return "Carbon Fiber"
    if "billet aluminum" in desc_low or "billet" in desc_low:
        return "Billet Aluminum"
    if "stainless steel" in desc_low or "stainless" in desc_low:
        return "Stainless Steel"
    if "aluminum" in desc_low or "aluminium" in desc_low:
        return "Aluminum"
    if "fiberglass" in desc_low:
        return "Fiberglass"
    return ""


def detect_warranty(description: str) -> str:
    """Detect warranty text from description."""
    if "5-year" in description.lower() or "5 year" in description.lower():
        return "5-Year"
    if "1-year" in description.lower() or "1 year" in description.lower():
        return "1-Year"
    return ""


# ---------------------------------------------------------------------------
# Row builders
# ---------------------------------------------------------------------------

def _base_row() -> dict[str, str]:
    """Return a skeleton WooCommerce row with safe defaults."""
    return {f: "" for f in WC_FIELDNAMES}


def build_simple_row(src: dict[str, str]) -> dict[str, str]:
    """Convert a source CSV row to a WooCommerce simple-product row."""
    row = _base_row()

    row["Type"] = "simple"
    row["SKU"] = src.get("sku", "").strip()
    row["Name"] = src.get("name", "").strip()
    row["Published"] = "1"
    row["Visibility in catalog"] = "visible"
    row["In stock?"] = "1"
    row["Allow customer reviews?"] = "1"
    row["Tax status"] = "taxable"

    row["Short description"] = src.get("description_short", "").strip()
    row["Description"] = markdown_to_html(src.get("description_full", ""))

    row["Regular price"] = clean_price(src.get("price_numeric", src.get("price", "")))
    row["Categories"] = map_category(src.get("brand", ""), src.get("name", ""))

    row["Images"] = _resolve_images(src)
    row["Meta: _upc"] = src.get("upc", "").strip()

    # Attributes
    size = detect_size(src.get("name", ""))
    material = detect_material(src.get("description_full", ""))
    warranty = detect_warranty(src.get("description_full", ""))

    row["Attribute 1 name"] = "Size/Width"
    row["Attribute 1 value(s)"] = size
    row["Attribute 1 visible"] = "1"
    row["Attribute 1 global"] = "1"

    row["Attribute 2 name"] = "Material"
    row["Attribute 2 value(s)"] = material
    row["Attribute 2 visible"] = "1"
    row["Attribute 2 global"] = "1"

    row["Attribute 3 name"] = "Warranty"
    row["Attribute 3 value(s)"] = warranty
    row["Attribute 3 visible"] = "1"
    row["Attribute 3 global"] = "1"

    return row


def _resolve_images(src: dict[str, str]) -> str:
    """Return a comma-separated image URL string from either source format."""
    # Columbia format: image_1 … image_9
    if "image_1" in src:
        imgs = [src.get(f"image_{i}", "").strip() for i in range(1, 10)]
        return ",".join(img for img in imgs if img)
    # Main catalog format: images (already comma-separated)
    return src.get("images", "").strip()


def build_variable_parent_row(
    sku: str,
    name: str,
    description_short: str,
    description_full: str,
    category: str,
    images: str,
    sizes: list[str],
) -> dict[str, str]:
    """Build the parent (variable) product row."""
    row = _base_row()
    row["Type"] = "variable"
    row["SKU"] = sku
    row["Name"] = name
    row["Published"] = "1"
    row["Visibility in catalog"] = "visible"
    row["In stock?"] = "1"
    row["Allow customer reviews?"] = "1"
    row["Tax status"] = "taxable"
    row["Short description"] = description_short
    row["Description"] = markdown_to_html(description_full)
    row["Categories"] = category
    row["Images"] = images

    # Size attribute — all variation values pipe-separated
    row["Attribute 1 name"] = "Size/Width"
    row["Attribute 1 value(s)"] = " | ".join(sizes)
    row["Attribute 1 visible"] = "1"
    row["Attribute 1 global"] = "1"
    row["Attribute 1 default"] = sizes[0] if sizes else ""

    row["Attribute 2 name"] = "Material"
    row["Attribute 2 value(s)"] = "Billet Aluminum"
    row["Attribute 2 visible"] = "1"
    row["Attribute 2 global"] = "1"

    row["Attribute 3 name"] = "Warranty"
    row["Attribute 3 value(s)"] = "5-Year"
    row["Attribute 3 visible"] = "1"
    row["Attribute 3 global"] = "1"

    return row


def build_variation_row(
    parent_sku: str,
    var_sku: str,
    size: str,
    price: str,
    images: str,
    upc: str = "",
) -> dict[str, str]:
    """Build a single variation row."""
    row = _base_row()
    row["Type"] = "variation"
    row["SKU"] = var_sku
    row["Published"] = "1"
    row["In stock?"] = "1"
    row["Tax status"] = "taxable"
    row["Regular price"] = price
    row["Parent"] = parent_sku
    row["Images"] = images
    row["Meta: _upc"] = upc
    row["Attribute 1 name"] = "Size/Width"
    row["Attribute 1 value(s)"] = size
    row["Attribute 1 visible"] = "1"
    row["Attribute 1 global"] = "1"
    return row


# ---------------------------------------------------------------------------
# Main pipeline
# ---------------------------------------------------------------------------

def read_csv(path: Path) -> list[dict[str, str]]:
    """Read a CSV file and return a list of row dicts."""
    encodings = ["utf-8-sig", "utf-8", "latin-1"]
    for enc in encodings:
        try:
            with path.open("r", encoding=enc, newline="") as fh:
                return list(csv.DictReader(fh))
        except UnicodeDecodeError:
            continue
    raise RuntimeError(f"Could not decode {path} with any of {encodings}")


def build_tsb_family(src_rows: dict[str, dict[str, str]]) -> list[dict[str, str]]:
    """Build TSB-PARENT (variable) + variation rows from collected TSB source rows."""
    # Use TSB-10 as the canonical parent description/image source
    canon = src_rows.get("TSB-10") or next(iter(src_rows.values()))
    sizes = [TSB_SKUS[s]["size"] for s in sorted(TSB_SKUS.keys(), key=lambda x: int(x.split("-")[1]))]

    parent = build_variable_parent_row(
        sku="TSB-PARENT",
        name='Columbia Tomahawk Smoothing Blade',
        description_short=(
            "The all-metal Columbia Tomahawk Smoothing Blade — zero plastic, "
            "direct Flat Box handle connection, real-time angle-of-attack adjustment. "
            "Available in 7\u201248\u2033."
        ),
        description_full=canon.get("description_full", ""),
        category="Drywall Tools > Smoothing Blades",
        images=_resolve_images(canon),
        sizes=sizes,
    )

    rows = [parent]
    for sku in sorted(TSB_SKUS.keys(), key=lambda x: int(x.split("-")[1])):
        info = TSB_SKUS[sku]
        src = src_rows.get(sku, {})
        rows.append(build_variation_row(
            parent_sku="TSB-PARENT",
            var_sku=sku,
            size=info["size"],
            price=info["price"],
            images=_resolve_images(src),
            upc=src.get("upc", ""),
        ))
    return rows


def build_ssb_family(src_rows: dict[str, dict[str, str]]) -> list[dict[str, str]]:
    """Build SSB-PARENT (variable) + variation rows from collected SSB source rows."""
    canon = src_rows.get("SSB10") or next(iter(src_rows.values()))
    sizes = [SSB_SKUS[s]["size"] for s in sorted(SSB_SKUS.keys(), key=lambda x: int(re.sub(r"\D", "", x)))]

    parent = build_variable_parent_row(
        sku="SSB-PARENT",
        name='Columbia Sabre Smoothing Blade',
        description_short=(
            "The Columbia Sabre Smoothing Blade delivers glass-smooth finishes. "
            "Lightweight construction, ergonomic profile, minimal sanding required. "
            "Available in 10\u201248\u2033."
        ),
        description_full=canon.get("description_full", ""),
        category="Drywall Tools > Smoothing Blades",
        images=_resolve_images(canon),
        sizes=sizes,
    )

    rows = [parent]
    for sku in sorted(SSB_SKUS.keys(), key=lambda x: int(re.sub(r"\D", "", x))):
        info = SSB_SKUS[sku]
        src = src_rows.get(sku, {})
        rows.append(build_variation_row(
            parent_sku="SSB-PARENT",
            var_sku=sku,
            size=info["size"],
            price=info["price"],
            images=_resolve_images(src),
            upc=src.get("upc", ""),
        ))
    return rows


def transform(
    main_path: Path,
    columbia_path: Path,
    output_path: Path,
) -> int:
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)s %(message)s",
    )

    logging.info("Reading %s …", main_path)
    main_rows = read_csv(main_path)

    logging.info("Reading %s …", columbia_path)
    columbia_rows = read_csv(columbia_path)

    # Index columbia rows by SKU for O(1) lookup
    columbia_by_sku: dict[str, dict[str, str]] = {r["sku"]: r for r in columbia_rows}

    # Collect variation source rows keyed by SKU
    tsb_src: dict[str, dict[str, str]] = {}
    ssb_src: dict[str, dict[str, str]] = {}

    output_rows: list[dict[str, str]] = []
    skipped_variation_skus: set[str] = set(TSB_SKUS.keys()) | set(SSB_SKUS.keys())

    for src in main_rows:
        sku = src.get("sku", "").strip()

        # For TSB/SSB variations grab image data from columbia CSV and defer
        if sku in TSB_SKUS:
            tsb_src[sku] = columbia_by_sku.get(sku, src)
            continue
        if sku in SSB_SKUS:
            ssb_src[sku] = columbia_by_sku.get(sku, src)
            continue

        # Prefer columbia version when available (has individual image columns)
        effective = columbia_by_sku.get(sku, src)
        output_rows.append(build_simple_row(effective))

    # Columbia-only products not in the main catalog
    main_skus = {r.get("sku", "").strip() for r in main_rows}
    for src in columbia_rows:
        sku = src.get("sku", "").strip()
        if sku not in main_skus and sku not in skipped_variation_skus:
            output_rows.append(build_simple_row(src))

    # Insert variable product families before the first simple product
    if tsb_src:
        tsb_rows = build_tsb_family(tsb_src)
        output_rows = tsb_rows + output_rows
    if ssb_src:
        ssb_rows = build_ssb_family(ssb_src)
        output_rows = ssb_rows + output_rows

    # Write output
    output_path.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile(
        "w", delete=False, encoding="utf-8", newline="", suffix=".csv"
    ) as tmp:
        writer = csv.DictWriter(
            tmp,
            fieldnames=WC_FIELDNAMES,
            extrasaction="ignore",
            quoting=csv.QUOTE_ALL,
        )
        writer.writeheader()
        writer.writerows(output_rows)

    shutil.move(tmp.name, str(output_path))
    logging.info(
        "Done. Wrote %d rows to %s",
        len(output_rows),
        output_path,
    )
    return 0


# ---------------------------------------------------------------------------
# CLI entry-point
# ---------------------------------------------------------------------------

def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(
        description="Transform product catalog CSVs to WooCommerce import format."
    )
    p.add_argument(
        "--main",
        default=str(DEFAULT_MAIN),
        help=f"Main product catalog CSV (default: {DEFAULT_MAIN})",
    )
    p.add_argument(
        "--columbia",
        default=str(DEFAULT_COLUMBIA),
        help=f"Columbia product catalog CSV (default: {DEFAULT_COLUMBIA})",
    )
    p.add_argument(
        "--output",
        default=str(DEFAULT_OUTPUT),
        help=f"Output WooCommerce CSV (default: {DEFAULT_OUTPUT})",
    )
    return p.parse_args()


if __name__ == "__main__":
    args = parse_args()
    sys.exit(
        transform(Path(args.main), Path(args.columbia), Path(args.output))
    )
