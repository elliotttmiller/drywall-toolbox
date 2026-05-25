#!/usr/bin/env python3
"""
Scrape Columbia Tools repair-parts catalog from csrbuilding.com.

Rules
-----
Only Shopify product pages whose title ends exactly with "repair parts"
(case-insensitive) are included.  Kits, maintenance kits, conversion
kits, or any other non-repair-parts pages are excluded.

Outputs (written to products/scraped_results/brands/Columbia/)
-------
  columbia_repair_parts_catalog.json  –  {tool_title: [{part_name, sku, image_url}, …]}
  columbia_repair_parts_catalog.csv   –  Tool Name, Part Name, SKU, Image URL

Usage
-----
  python scripts/scrape_columbia_repair_parts.py
  python scripts/scrape_columbia_repair_parts.py --out-dir /custom/path
"""
from __future__ import annotations

import argparse
import csv
import json
import time
import urllib.request
from pathlib import Path

COLLECTION_URL = (
    "https://csrbuilding.com/en-us/collections/columbia-parts/products.json"
)
PAGE_SIZE = 50
REQUEST_DELAY = 0.5  # seconds between paginated requests

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_OUT_DIR = (
    ROOT / "products" / "scraped_results" / "brands" / "Columbia"
)


def _fetch_json(url: str) -> dict:
    req = urllib.request.Request(
        url, headers={"User-Agent": "DTB-Scraper/1.0"}
    )
    with urllib.request.urlopen(req, timeout=30) as resp:
        return json.loads(resp.read().decode())


def fetch_all_products() -> list[dict]:
    """Paginate through the Shopify products.json endpoint and return all products."""
    products: list[dict] = []
    page = 1
    while True:
        url = f"{COLLECTION_URL}?limit={PAGE_SIZE}&page={page}"
        data = _fetch_json(url)
        batch: list[dict] = data.get("products", [])
        if not batch:
            break
        products.extend(batch)
        if len(batch) < PAGE_SIZE:
            break
        page += 1
        time.sleep(REQUEST_DELAY)
    return products


def is_repair_parts_page(title: str) -> bool:
    """Return True only for pages whose title ends with 'repair parts'."""
    return title.strip().lower().endswith("repair parts")


def build_catalog(products: list[dict]) -> tuple[dict, list[dict]]:
    """
    Filter to repair-parts pages and build catalog structures.

    Returns
    -------
    catalog_json : dict
        Mapping of tool title → list of part dicts (part_name, sku, image_url).
    csv_rows : list[dict]
        Flat list of rows for CSV export.
    """
    catalog_json: dict[str, list[dict]] = {}
    csv_rows: list[dict] = []

    for product in products:
        title: str = product.get("title", "")
        if not is_repair_parts_page(title):
            continue

        parts: list[dict] = []
        for variant in product.get("variants", []):
            part_name: str = variant.get("title", "")
            sku: str | None = variant.get("sku") or None
            img = variant.get("featured_image")
            image_url: str | None = img["src"] if img else None

            parts.append(
                {"part_name": part_name, "sku": sku, "image_url": image_url}
            )
            csv_rows.append(
                {
                    "Tool Name": title,
                    "Part Name": part_name,
                    "SKU": sku if sku else "null",
                    "Image URL": image_url if image_url else "null",
                }
            )

        catalog_json[title] = parts

    return catalog_json, csv_rows


def write_outputs(
    catalog_json: dict,
    csv_rows: list[dict],
    out_dir: Path,
) -> None:
    out_dir.mkdir(parents=True, exist_ok=True)

    json_path = out_dir / "columbia_repair_parts_catalog.json"
    with json_path.open("w", encoding="utf-8") as fh:
        json.dump(catalog_json, fh, indent=2, ensure_ascii=False)
    print(f"Wrote {json_path}")

    csv_path = out_dir / "columbia_repair_parts_catalog.csv"
    fieldnames = ["Tool Name", "Part Name", "SKU", "Image URL"]
    with csv_path.open("w", newline="", encoding="utf-8") as fh:
        writer = csv.DictWriter(fh, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(csv_rows)
    print(f"Wrote {csv_path}")


def print_summary(catalog_json: dict, csv_rows: list[dict]) -> None:
    total_tools = len(catalog_json)
    total_parts = len(csv_rows)
    missing_img = sum(1 for r in csv_rows if r["Image URL"] == "null")
    missing_sku = sum(1 for r in csv_rows if r["SKU"] == "null")

    print(f"\n{'='*55}")
    print(f"  Repair-parts tool pages : {total_tools}")
    print(f"  Total parts             : {total_parts}")
    print(f"  Parts missing image URL : {missing_img}")
    print(f"  Parts missing SKU       : {missing_sku}")
    print(f"{'='*55}")
    for tool, parts in catalog_json.items():
        print(f"  [{len(parts):3d}]  {tool}")


def main(argv: list[str] | None = None) -> None:
    parser = argparse.ArgumentParser(
        description="Scrape Columbia repair-parts catalog from csrbuilding.com"
    )
    parser.add_argument(
        "--out-dir",
        type=Path,
        default=DEFAULT_OUT_DIR,
        help="Directory to write output files (default: %(default)s)",
    )
    args = parser.parse_args(argv)

    print("Fetching products from csrbuilding.com …")
    all_products = fetch_all_products()
    print(f"Fetched {len(all_products)} total products from collection.")

    catalog_json, csv_rows = build_catalog(all_products)
    print_summary(catalog_json, csv_rows)
    write_outputs(catalog_json, csv_rows, args.out_dir)


if __name__ == "__main__":
    main()
