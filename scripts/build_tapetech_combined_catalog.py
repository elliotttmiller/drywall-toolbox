"""
build_tapetech_combined_catalog.py
------------------------------------
Merges TapeTech drywall product data from two scraped sources into a single
all-in-one product catalog manifest:

  Source 1 — tapetech.com (products/scraped_results/TapeTech/tapetech_drywall_scraped.json)
    Fields: name, mpn, description, additional_information, weight_lbs,
            length_in, width_in, height_in, image_urls, url

  Source 2 — shopamestools.com (products/scraped_results/ShopAmesTools/shopamestools_tapetech_drywall.json)
    Fields: name, mpn, description, url

Outputs
-------
  products/Production/catalogs/official/tapetech_product_catalog_manifest.csv
  products/Production/catalogs/official/tapetech_product_catalog_manifest.json

Deduplication
-------------
Products are keyed by normalised MPN (uppercase, stripped).  When the same MPN
appears in both sources the TapeTech.com record is kept as the primary (it has
richer data: images, dimensions); the ShopAmesTools description is appended as
an alternate source if the primary description is empty.

Usage
-----
    python scripts/build_tapetech_combined_catalog.py
"""

from __future__ import annotations

import csv
import json
import re
from datetime import datetime, timezone
from pathlib import Path


# ── Paths ─────────────────────────────────────────────────────────────────────

REPO_ROOT = Path(__file__).resolve().parents[1]

TT_JSON = (
    REPO_ROOT / "products" / "scraped_results" / "TapeTech" / "tapetech_drywall_scraped.json"
)
TT_CSV = (
    REPO_ROOT / "products" / "scraped_results" / "TapeTech" / "tapetech_drywall_scraped.csv"
)
AMES_JSON = (
    REPO_ROOT
    / "products"
    / "scraped_results"
    / "ShopAmesTools"
    / "shopamestools_tapetech_drywall.json"
)

OUT_DIR = REPO_ROOT / "products" / "Production" / "catalogs" / "official"
OUT_CSV = OUT_DIR / "tapetech_product_catalog_manifest.csv"
OUT_JSON = OUT_DIR / "tapetech_product_catalog_manifest.json"

# ── CSV column order ───────────────────────────────────────────────────────────

TT_CSV_FIELDNAMES = [
    "source",
    "name",
    "mpn",
    "description",
    "additional_information",
    "weight_lbs",
    "length_in",
    "width_in",
    "height_in",
    "image_urls",
    "url",
]

CSV_FIELDNAMES = [
    "source",
    "name",
    "mpn",
    "description",
    "additional_information",
    "weight_lbs",
    "length_in",
    "width_in",
    "height_in",
    "image_urls",
    "tapetech_url",
    "shopamestools_url",
]

EXCLUDED_MPN_PREFIXES = ("PWW-", "PWT")
EXCLUDED_PRODUCT_RE = re.compile(
    r"\b(apparel|beanie|clothing|gloves?|hat|hi[- ]vis|hood(?:ed)?\s+sweatshirt|"
    r"hoodie|jacket|long\s+sleeve\s+t(?:-shirt)?|pants|shirt|"
    r"short\s+sleeve\s+t(?:-shirt)?|soft[- ]shell|sweatshirt|vest|"
    r"work\s*pants|workwear)\b",
    re.IGNORECASE,
)


# ── Helpers ────────────────────────────────────────────────────────────────────

def norm_mpn(mpn: str) -> str:
    """Normalise MPN for deduplication: uppercase, strip whitespace."""
    return re.sub(r"\s+", "", (mpn or "").upper())


def load_json(path: Path) -> list[dict]:
    """Load a scraped JSON file and return its products list."""
    if not path.exists():
        raise FileNotFoundError(
            f"Input file not found: {path}\n"
            "Run the corresponding scraper script first."
        )
    data = json.loads(path.read_text(encoding="utf-8"))
    return data.get("products", [])


def is_excluded_product(product: dict) -> bool:
    """Return True when a product is clothing or workwear rather than a tool."""
    mpn = str(product.get("mpn", "")).strip().upper()
    if any(mpn.startswith(prefix) for prefix in EXCLUDED_MPN_PREFIXES):
        return True

    text = " ".join(
        str(product.get(field, "")).strip()
        for field in ("name", "description", "additional_information", "url")
    )
    return bool(EXCLUDED_PRODUCT_RE.search(text))


def split_products(products: list[dict]) -> tuple[list[dict], list[dict]]:
    """Separate kept products from excluded clothing/workwear products."""
    kept: list[dict] = []
    excluded: list[dict] = []
    for product in products:
        (excluded if is_excluded_product(product) else kept).append(product)
    return kept, excluded


def image_urls_to_string(image_urls: object) -> str:
    """Serialise one-or-many image URLs into the CSV pipe-delimited format."""
    if isinstance(image_urls, list):
        return " | ".join(str(url).strip() for url in image_urls if str(url).strip())
    return str(image_urls or "").strip()


def write_tapetech_source_csv(products: list[dict]) -> None:
    """Rewrite the cleaned TapeTech scraped CSV from the JSON source records."""
    with TT_CSV.open("w", encoding="utf-8", newline="") as fh:
        writer = csv.DictWriter(fh, fieldnames=TT_CSV_FIELDNAMES, extrasaction="ignore")
        writer.writeheader()
        for product in products:
            row = dict(product)
            row["image_urls"] = image_urls_to_string(product.get("image_urls"))
            writer.writerow(row)


def write_tapetech_source_json(products: list[dict]) -> None:
    """Rewrite the cleaned TapeTech scraped JSON payload."""
    payload = {
        "catalog": "TapeTech Drywall Products",
        "source_url": "https://tapetech.com/product-category/drywall/",
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "product_count": len(products),
        "products": products,
    }
    TT_JSON.write_text(
        json.dumps(payload, indent=2, ensure_ascii=False),
        encoding="utf-8",
    )


# ── Main ───────────────────────────────────────────────────────────────────────

def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    # ── Load source data ───────────────────────────────────────────────────────
    print(f"Loading TapeTech data from {TT_JSON.name} …")
    tt_products = load_json(TT_JSON)
    print(f"  {len(tt_products)} products")

    print(f"Loading ShopAmesTools data from {AMES_JSON.name} …")
    ames_products = load_json(AMES_JSON)
    print(f"  {len(ames_products)} products\n")

    tt_products, tt_excluded = split_products(tt_products)
    ames_products, ames_excluded = split_products(ames_products)

    print("Removing clothing/workwear products …")
    print(f"  TapeTech excluded:      {len(tt_excluded)}")
    print(f"  ShopAmesTools excluded: {len(ames_excluded)}")
    print(f"  TapeTech retained:      {len(tt_products)}")
    print(f"  ShopAmesTools retained: {len(ames_products)}\n")

    write_tapetech_source_csv(tt_products)
    write_tapetech_source_json(tt_products)
    print(f"Wrote cleaned {TT_CSV}")
    print(f"Wrote cleaned {TT_JSON}\n")

    # ── Index ShopAmesTools by normalised MPN ──────────────────────────────────
    ames_index: dict[str, dict] = {}
    for p in ames_products:
        key = norm_mpn(p.get("mpn", ""))
        if key:
            ames_index[key] = p

    # ── Build merged product list ──────────────────────────────────────────────
    merged: list[dict] = []
    seen_mpn: set[str] = set()

    for p in tt_products:
        key = norm_mpn(p.get("mpn", ""))
        seen_mpn.add(key)

        ames = ames_index.get(key, {})

        # Description: prefer TapeTech, fall back to ShopAmesTools
        description = p.get("description") or ames.get("description", "")

        image_str = image_urls_to_string(p.get("image_urls"))

        merged.append({
            "source": "tapetech.com" + ("; shopamestools.com" if ames else ""),
            "name": p.get("name", ""),
            "mpn": p.get("mpn", ""),
            "description": description,
            "additional_information": p.get("additional_information", ""),
            "weight_lbs": p.get("weight_lbs", ""),
            "length_in": p.get("length_in", ""),
            "width_in": p.get("width_in", ""),
            "height_in": p.get("height_in", ""),
            "image_urls": image_str,
            "tapetech_url": p.get("url", ""),
            "shopamestools_url": ames.get("url", ""),
        })

    # ── Add ShopAmesTools-only products (not in TapeTech drywall category) ─────
    for p in ames_products:
        key = norm_mpn(p.get("mpn", ""))
        if key and key not in seen_mpn:
            seen_mpn.add(key)
            merged.append({
                "source": "shopamestools.com",
                "name": p.get("name", ""),
                "mpn": p.get("mpn", ""),
                "description": p.get("description", ""),
                "additional_information": "",
                "weight_lbs": "",
                "length_in": "",
                "width_in": "",
                "height_in": "",
                "image_urls": "",
                "tapetech_url": "",
                "shopamestools_url": p.get("url", ""),
            })

    print(f"Combined catalog: {len(merged)} products total")
    print(f"  TapeTech-only:      {sum(1 for p in merged if p['source'] == 'tapetech.com')}")
    print(f"  Both sources:       {sum(1 for p in merged if '; ' in p['source'])}")
    print(f"  ShopAmesTools-only: {sum(1 for p in merged if p['source'] == 'shopamestools.com')}")

    # ── Write CSV ──────────────────────────────────────────────────────────────
    with OUT_CSV.open("w", encoding="utf-8", newline="") as fh:
        writer = csv.DictWriter(fh, fieldnames=CSV_FIELDNAMES, extrasaction="ignore")
        writer.writeheader()
        writer.writerows(merged)
    print(f"\nWrote {OUT_CSV}")

    # ── Write JSON ─────────────────────────────────────────────────────────────
    # For JSON, store image_urls as a list
    merged_json = []
    for row in merged:
        r = dict(row)
        img_str = r.get("image_urls", "")
        r["image_urls"] = [u.strip() for u in img_str.split("|") if u.strip()] if img_str else []
        merged_json.append(r)

    payload = {
        "catalog": "TapeTech Drywall Products — Combined Manifest",
        "sources": [
            "https://tapetech.com/product-category/drywall/",
            "https://www.shopamestools.com/shop-by-brand/tapetech-taping-tools/drywalltools",
        ],
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "product_count": len(merged_json),
        "products": merged_json,
    }
    OUT_JSON.write_text(
        json.dumps(payload, indent=2, ensure_ascii=False), encoding="utf-8"
    )
    print(f"Wrote {OUT_JSON}")


if __name__ == "__main__":
    main()
