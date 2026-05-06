#!/usr/bin/env python3
"""Normalize TapeTech manifest images and build a WooCommerce-format catalog.

This script:
1) Reads products/Production/catalogs/official/tapetech_product_catalog_manifest.csv
2) Downloads every source image URL and stores normalized `.webp` files in
   products/Production/wp-images
3) Rewrites the TapeTech manifest in a cleaned format with a single `Images` field
   and no source-specific URL fields
4) Builds a TapeTech-only WooCommerce CSV that uses the same column structure as
   products/Production/catalogs/official/woocommerce_catalog.csv
5) Creates variable/variation groups where families can be inferred safely
"""

from __future__ import annotations

import argparse
import csv
import io
import json
import re
from collections import defaultdict
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from urllib.parse import urlparse

import requests

try:
    from PIL import Image
except Exception:  # pragma: no cover - handled at runtime
    Image = None


REPO_ROOT = Path(__file__).resolve().parents[1]
OFFICIAL_DIR = REPO_ROOT / "products" / "Production" / "catalogs" / "official"
MANIFEST_CSV = OFFICIAL_DIR / "tapetech_product_catalog_manifest.csv"
MANIFEST_JSON = OFFICIAL_DIR / "tapetech_product_catalog_manifest.json"
WOO_TEMPLATE_CSV = OFFICIAL_DIR / "woocommerce_catalog.csv"
WOO_OUT_CSV = OFFICIAL_DIR / "tapetech_woocommerce_catalog.csv"
WP_IMAGES_DIR = REPO_ROOT / "products" / "Production" / "wp-images"
SUMMARY_JSON = REPO_ROOT / "products" / "Production" / "reports" / "tapetech_manifest_normalization_summary.json"

DEFAULT_BASE_UPLOAD_URL = "https://drywalltoolbox.com/wp/wp-content/uploads/2026/04"

CLEAN_MANIFEST_FIELDS = [
    "name",
    "mpn",
    "description",
    "additional_information",
    "weight_lbs",
    "length_in",
    "width_in",
    "height_in",
    "Images",
]


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def clean_space(value: str) -> str:
    return re.sub(r"\s+", " ", (value or "").replace("\xa0", " ")).strip()


def slugify(value: str, max_len: int = 90) -> str:
    text = clean_space(value).lower()
    text = text.replace("™", "").replace("®", "")
    text = re.sub(r"[^a-z0-9]+", "-", text).strip("-")
    text = re.sub(r"-+", "-", text)
    return text[:max_len] or "item"


def safe_mpn(value: str) -> str:
    text = clean_space(value).upper()
    text = re.sub(r"[^A-Z0-9-]+", "-", text).strip("-")
    return text or "UNKNOWN"


def read_csv(path: Path) -> list[dict[str, str]]:
    with path.open("r", encoding="utf-8-sig", newline="") as handle:
        return list(csv.DictReader(handle))


def write_csv(path: Path, fieldnames: list[str], rows: list[dict[str, str]]) -> None:
    with path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fieldnames, extrasaction="ignore")
        writer.writeheader()
        writer.writerows(rows)


def parse_source_images(value: str) -> list[str]:
    urls: list[str] = []
    for part in re.split(r"\s*\|\s*|\s*,\s*", value or ""):
        part = part.strip()
        if not part:
            continue
        if part.startswith("http://") or part.startswith("https://"):
            urls.append(part)
    return list(dict.fromkeys(urls))


def parse_number(value: str) -> str:
    text = clean_space(value)
    if not text:
        return ""
    try:
        n = float(text)
    except ValueError:
        return ""
    if n.is_integer():
        return str(int(n))
    return f"{n:.4f}".rstrip("0").rstrip(".")


def image_ext_from_url(url: str) -> str:
    path = urlparse(url).path.lower()
    ext = Path(path).suffix
    return ext if ext in {".jpg", ".jpeg", ".png", ".webp", ".gif", ".bmp", ".tiff", ".avif"} else ".jpg"


def decode_image_to_webp(content: bytes, src_ext: str) -> bytes:
    if src_ext == ".webp":
        return content

    if Image is None:
        raise RuntimeError(
            "Pillow is required to convert non-webp images. Install it with `pip install Pillow`."
        )

    with Image.open(io.BytesIO(content)) as img:
        if img.mode in {"P", "RGBA", "LA"}:
            img = img.convert("RGBA")
        else:
            img = img.convert("RGB")

        out = io.BytesIO()
        img.save(out, format="WEBP", quality=92, method=6)
        return out.getvalue()


def download_and_store_images(
    rows: list[dict[str, str]],
    base_upload_url: str,
    timeout: int,
) -> tuple[list[dict[str, str]], dict[str, Any]]:
    WP_IMAGES_DIR.mkdir(parents=True, exist_ok=True)

    session = requests.Session()
    session.headers.update({"User-Agent": "drywall-toolbox/normalize-tapetech/1.0"})

    downloaded = 0
    reused = 0
    failed = 0
    total_urls = 0
    url_cache: dict[str, str] = {}

    normalized_rows: list[dict[str, str]] = []

    for row in rows:
        name = clean_space(row.get("name", ""))
        mpn = clean_space(row.get("mpn", ""))
        source_urls = parse_source_images(row.get("image_urls", ""))
        total_urls += len(source_urls)

        image_urls: list[str] = []
        product_slug = slugify(name)
        mpn_slug = safe_mpn(mpn)

        for index, source_url in enumerate(source_urls, start=1):
            if source_url in url_cache:
                image_urls.append(url_cache[source_url])
                reused += 1
                continue

            filename = f"tapetech-{product_slug}-{mpn_slug}-{index:02d}.webp"
            out_path = WP_IMAGES_DIR / filename
            public_url = f"{base_upload_url.rstrip('/')}/{filename}"

            if out_path.exists() and out_path.stat().st_size > 0:
                image_urls.append(public_url)
                url_cache[source_url] = public_url
                reused += 1
                continue

            try:
                response = session.get(source_url, timeout=timeout)
                response.raise_for_status()
                src_ext = image_ext_from_url(source_url)
                webp_data = decode_image_to_webp(response.content, src_ext)

                if not webp_data:
                    raise ValueError("empty image payload")

                out_path.write_bytes(webp_data)
                image_urls.append(public_url)
                url_cache[source_url] = public_url
                downloaded += 1
            except Exception:
                failed += 1

                # Keep the original URL on failure so downstream review can see
                # exactly which source URL still needs conversion.
                image_urls.append(source_url)
                url_cache[source_url] = source_url

        normalized_rows.append(
            {
                "name": name,
                "mpn": mpn,
                "description": clean_space(row.get("description", "")),
                "additional_information": clean_space(row.get("additional_information", "")),
                "weight_lbs": parse_number(row.get("weight_lbs", "")),
                "length_in": parse_number(row.get("length_in", "")),
                "width_in": parse_number(row.get("width_in", "")),
                "height_in": parse_number(row.get("height_in", "")),
                "Images": " | ".join(image_urls),
            }
        )

    summary = {
        "products": len(rows),
        "source_image_urls": total_urls,
        "downloaded": downloaded,
        "reused": reused,
        "failed": failed,
    }
    return normalized_rows, summary


def normalize_name_for_group(name: str, mpn: str) -> str:
    text = clean_space(name).lower()
    text = text.replace("″", '"').replace("”", '"').replace("“", '"').replace("º", "°")
    text = text.replace(mpn.lower(), " ")
    text = re.sub(r"\b\d+(?:\.\d+)?\s*(?:\"|″|”|in(?:ch(?:es)?)?)", " ", text, flags=re.IGNORECASE)
    text = re.sub(r"\b\d+(?:\.\d+)?\s*[x×]\s*\d+(?:\.\d+)?\b", " ", text)
    text = re.sub(r"\b\d+(?:\.\d+)?\s*(?:°|deg)\b", " ", text)
    text = re.sub(r"\[[^\]]*\]", " ", text)
    text = re.sub(r"[^a-z0-9]+", " ", text)
    return clean_space(text)


def mpn_prefix(mpn: str) -> str:
    cleaned = re.sub(r"[^A-Z0-9-]", "", (mpn or "").upper())
    if not cleaned:
        return ""
    prefix = re.sub(r"\d+$", "", cleaned).rstrip("-")
    return prefix


def tokenize_for_similarity(name: str, mpn: str) -> set[str]:
    text = normalize_name_for_group(name, mpn)
    return {token for token in text.split() if token and token not in {"tapetech", "with", "for", "and", "set"}}


def jaccard(a: set[str], b: set[str]) -> float:
    if not a or not b:
        return 0.0
    return len(a & b) / len(a | b)


def extract_option_value(name: str, mpn: str) -> str:
    lowered = clean_space(name)
    quoted = re.search(r"(\d+(?:\.\d+)?)\s*(?:\"|″|”)", lowered)
    if quoted:
        return f'{quoted.group(1)}"'

    dim = re.search(r"\b(\d+(?:\.\d+)?)\s*(?:in(?:ch(?:es)?)?)\b", lowered, flags=re.IGNORECASE)
    if dim:
        return f'{dim.group(1)}"'

    degree = re.search(r"\b(\d+(?:\.\d+)?)\s*(?:°|º|deg)\b", lowered, flags=re.IGNORECASE)
    if degree:
        return f"{degree.group(1)}°"

    base = normalize_name_for_group(name, mpn)
    residual = clean_space(re.sub(re.escape(base), "", clean_space(name), flags=re.IGNORECASE)) if base else ""
    residual = clean_space(residual.replace(mpn, ""))
    if residual:
        return residual[:60]
    return mpn


@dataclass
class Group:
    key: str
    rows: list[dict[str, str]]


def infer_variable_groups(rows: list[dict[str, str]]) -> tuple[list[Group], list[dict[str, str]]]:
    by_name_key: dict[str, list[dict[str, str]]] = defaultdict(list)
    for row in rows:
        key = normalize_name_for_group(row.get("name", ""), row.get("mpn", ""))
        if key:
            by_name_key[key].append(row)

    variable_groups: list[Group] = []
    grouped_ids: set[int] = set()

    # Primary: exact normalized family name.
    for key, group_rows in by_name_key.items():
        if len(group_rows) < 2:
            continue
        unique_mpn = {clean_space(r.get("mpn", "")).upper() for r in group_rows if clean_space(r.get("mpn", ""))}
        if len(unique_mpn) < 2:
            continue
        variable_groups.append(Group(key=key, rows=sorted(group_rows, key=lambda r: clean_space(r.get("mpn", "")).upper())))
        grouped_ids.update(id(r) for r in group_rows)

    # Secondary: MPN prefix + semantic name similarity.
    by_prefix: dict[str, list[dict[str, str]]] = defaultdict(list)
    for row in rows:
        if id(row) in grouped_ids:
            continue
        prefix = mpn_prefix(row.get("mpn", ""))
        if len(prefix) >= 3:
            by_prefix[prefix].append(row)

    for prefix, group_rows in by_prefix.items():
        if len(group_rows) < 2:
            continue
        token_sets = [tokenize_for_similarity(r.get("name", ""), r.get("mpn", "")) for r in group_rows]
        avg_similarity = 0.0
        pairs = 0
        for i in range(len(token_sets)):
            for j in range(i + 1, len(token_sets)):
                avg_similarity += jaccard(token_sets[i], token_sets[j])
                pairs += 1
        if pairs:
            avg_similarity /= pairs
        if avg_similarity < 0.40:
            continue
        variable_groups.append(Group(key=prefix.lower(), rows=sorted(group_rows, key=lambda r: clean_space(r.get("mpn", "")).upper())))
        grouped_ids.update(id(r) for r in group_rows)

    simple_rows = [row for row in rows if id(row) not in grouped_ids]
    return variable_groups, simple_rows


def read_woo_fieldnames(template_csv: Path) -> list[str]:
    with template_csv.open("r", encoding="utf-8-sig", newline="") as handle:
        reader = csv.DictReader(handle)
        return list(reader.fieldnames or [])


def blank_woo_row(fieldnames: list[str]) -> dict[str, str]:
    return {field: "" for field in fieldnames}


def base_woo_values(row: dict[str, str]) -> dict[str, str]:
    return {
        "Published": "1",
        "Is featured?": "0",
        "Visibility in catalog": "visible",
        "Tax status": "taxable",
        "In stock?": "1",
        "Backorders allowed?": "0",
        "Sold individually?": "0",
        "Allow customer reviews?": "1",
        "Brands": "TapeTech",
    }


def build_simple_woo_row(source: dict[str, str], fieldnames: list[str], position: int) -> dict[str, str]:
    row = blank_woo_row(fieldnames)
    row.update(base_woo_values(source))

    mpn = clean_space(source.get("mpn", ""))
    row.update(
        {
            "Type": "simple",
            "SKU": mpn,
            "Name": clean_space(source.get("name", "")),
            "Short description": clean_space(source.get("description", ""))[:320],
            "Description": clean_space(source.get("description", "")),
            "Weight (lbs)": parse_number(source.get("weight_lbs", "")),
            "Length (in)": parse_number(source.get("length_in", "")),
            "Width (in)": parse_number(source.get("width_in", "")),
            "Height (in)": parse_number(source.get("height_in", "")),
            "Categories": "Drywall Finishing Tools > TapeTech",
            "Images": clean_space(source.get("Images", "")),
            "Position": str(position),
            "Meta: _mpn": mpn,
        }
    )
    return row


def build_variable_family_rows(group: Group, fieldnames: list[str], position_start: int) -> tuple[list[dict[str, str]], int]:
    rows: list[dict[str, str]] = []
    children = group.rows

    display_base = clean_space(children[0].get("name", ""))
    base_clean = normalize_name_for_group(display_base, children[0].get("mpn", ""))
    if base_clean:
        display_base = " ".join(word.capitalize() for word in base_clean.split())

    mpns = [clean_space(item.get("mpn", "")) for item in children if clean_space(item.get("mpn", ""))]
    parent_sku = f"TT-{slugify(group.key, 48).upper()}"
    parent_images = []
    for child in children:
        for url in parse_source_images(child.get("Images", "")):
            if url not in parent_images:
                parent_images.append(url)

    parent = blank_woo_row(fieldnames)
    parent.update(base_woo_values(children[0]))
    parent.update(
        {
            "Type": "variable",
            "SKU": parent_sku,
            "Name": f"{display_base} - [{', '.join(mpns)}]",
            "Short description": clean_space(children[0].get("description", ""))[:320],
            "Description": clean_space(children[0].get("description", "")),
            "Categories": "Drywall Finishing Tools > TapeTech",
            "Images": " | ".join(parent_images),
            "Position": str(position_start),
            "Attribute 1 name": "Option",
            "Attribute 1 value(s)": " | ".join(extract_option_value(c.get("name", ""), c.get("mpn", "")) for c in children),
            "Attribute 1 visible": "1",
            "Attribute 1 used for variations": "1",
            "Attribute 1 global": "1",
            "Meta: _mpn": ", ".join(mpns),
        }
    )
    rows.append(parent)

    for idx, child in enumerate(children, start=1):
        mpn = clean_space(child.get("mpn", ""))
        option_value = extract_option_value(child.get("name", ""), mpn)
        variation = blank_woo_row(fieldnames)
        variation.update(base_woo_values(child))
        variation.update(
            {
                "Type": "variation",
                "SKU": mpn,
                "Name": f"{display_base} - [{mpn}]",
                "Categories": "Drywall Finishing Tools > TapeTech",
                "Images": clean_space(child.get("Images", "")),
                "Parent": parent_sku,
                "Position": str(position_start + idx),
                "Attribute 1 name": "Option",
                "Attribute 1 value(s)": option_value,
                "Attribute 1 global": "1",
                "Meta: _mpn": mpn,
                "Weight (lbs)": parse_number(child.get("weight_lbs", "")),
                "Length (in)": parse_number(child.get("length_in", "")),
                "Width (in)": parse_number(child.get("width_in", "")),
                "Height (in)": parse_number(child.get("height_in", "")),
            }
        )
        rows.append(variation)

    return rows, position_start + len(children) + 1


def build_tapetech_woo_rows(normalized_manifest_rows: list[dict[str, str]], fieldnames: list[str]) -> tuple[list[dict[str, str]], dict[str, Any]]:
    variable_groups, simple_rows = infer_variable_groups(normalized_manifest_rows)

    output_rows: list[dict[str, str]] = []
    position = 1
    for group in sorted(variable_groups, key=lambda g: (len(g.rows) * -1, g.key)):
        family_rows, position = build_variable_family_rows(group, fieldnames, position)
        output_rows.extend(family_rows)

    for row in sorted(simple_rows, key=lambda r: clean_space(r.get("name", "")).lower()):
        output_rows.append(build_simple_woo_row(row, fieldnames, position))
        position += 1

    summary = {
        "variable_families": len(variable_groups),
        "simple_products": len(simple_rows),
        "variable_parent_rows": len(variable_groups),
        "variation_rows": sum(len(g.rows) for g in variable_groups),
        "total_woo_rows": len(output_rows),
    }
    return output_rows, summary


def write_manifest_json(rows: list[dict[str, str]]) -> None:
    payload = {
        "catalog": "TapeTech Drywall Products — Normalized Manifest",
        "generated_at": now_iso(),
        "product_count": len(rows),
        "fields": CLEAN_MANIFEST_FIELDS,
        "products": [
            {
                **{k: row.get(k, "") for k in CLEAN_MANIFEST_FIELDS if k != "Images"},
                "Images": parse_source_images(row.get("Images", "")),
            }
            for row in rows
        ],
    }
    MANIFEST_JSON.write_text(json.dumps(payload, indent=2, ensure_ascii=False), encoding="utf-8")


def run(base_upload_url: str, timeout: int) -> dict[str, Any]:
    source_rows = read_csv(MANIFEST_CSV)

    normalized_manifest_rows, image_summary = download_and_store_images(
        source_rows,
        base_upload_url=base_upload_url,
        timeout=timeout,
    )

    write_csv(MANIFEST_CSV, CLEAN_MANIFEST_FIELDS, normalized_manifest_rows)
    write_manifest_json(normalized_manifest_rows)

    woo_fields = read_woo_fieldnames(WOO_TEMPLATE_CSV)
    woo_rows, woo_summary = build_tapetech_woo_rows(normalized_manifest_rows, woo_fields)
    write_csv(WOO_OUT_CSV, woo_fields, woo_rows)

    summary = {
        "generated_at": now_iso(),
        "manifest_csv": str(MANIFEST_CSV.relative_to(REPO_ROOT)),
        "manifest_json": str(MANIFEST_JSON.relative_to(REPO_ROOT)),
        "woo_output_csv": str(WOO_OUT_CSV.relative_to(REPO_ROOT)),
        "images": image_summary,
        "woo": woo_summary,
    }

    SUMMARY_JSON.parent.mkdir(parents=True, exist_ok=True)
    SUMMARY_JSON.write_text(json.dumps(summary, indent=2, ensure_ascii=False), encoding="utf-8")
    return summary


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--base-upload-url", default=DEFAULT_BASE_UPLOAD_URL)
    parser.add_argument("--timeout", type=int, default=45)
    args = parser.parse_args()

    summary = run(base_upload_url=args.base_upload_url, timeout=args.timeout)
    print(json.dumps(summary, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
