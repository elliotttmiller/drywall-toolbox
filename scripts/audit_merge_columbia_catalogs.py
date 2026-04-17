#!/usr/bin/env python3
"""
Audit + merge Columbia catalog sources into one WooCommerce-ready CSV.

Inputs:
  - scraped_results/columbia_tools/wp-catalog.csv
  - scraped_results/tsw_columbia/products_tsw.csv

Outputs:
  - wp-catalog.csv (merged)
  - audit-summary.json
  - audit-summary.md
  - sku-cross-reference.csv
"""

from __future__ import annotations

import argparse
import csv
import json
from collections import OrderedDict
from pathlib import Path
from typing import Dict, List
from urllib.parse import quote


REPO_ROOT = Path(__file__).resolve().parent.parent
DEFAULT_COLUMBIA_CSV = REPO_ROOT / "scraped_results/columbia_tools/wp-catalog.csv"
DEFAULT_TSW_CSV = REPO_ROOT / "scraped_results/tsw_columbia/products_tsw.csv"
DEFAULT_COLUMBIA_IMAGES_ROOT = REPO_ROOT / "scraped_results/columbia_tools"
DEFAULT_OUTPUT_DIR = REPO_ROOT / "scraped_results/columbia_merged"
DEFAULT_COLUMBIA_IMAGE_BASE = "https://drywalltoolbox.com/wp/wp-content/uploads/columbia-tools"


def normalize_sku(value: str) -> str:
    raw = (value or "").strip().lower()
    return raw.replace("-", "").replace("_", "")


def load_csv(path: Path) -> List[Dict[str, str]]:
    with path.open("r", encoding="utf-8-sig", newline="") as fh:
        return list(csv.DictReader(fh))


def row_score(row: Dict[str, str], source: str) -> int:
    score = 0
    if (row.get("Description") or "").strip():
        score += 3
    if (row.get("Short description") or "").strip():
        score += 2
    if (row.get("Images") or "").strip():
        score += 3
    if (row.get("Categories") or "").strip():
        score += 2
    if source == "columbia":
        score += 1
    return score


def split_images(value: str) -> List[str]:
    if not value:
        return []
    return [chunk.strip() for chunk in value.split("|") if chunk.strip()]


def absolutize_image(value: str, columbia_images_root: Path, columbia_image_base_url: str) -> str:
    if value.startswith("http://") or value.startswith("https://"):
        return value

    rel = value.lstrip("./")
    candidate = columbia_images_root / rel
    if not candidate.exists():
        return value

    quoted_rel = "/".join(quote(part) for part in rel.split("/"))
    return f"{columbia_image_base_url.rstrip('/')}/{quoted_rel}"


def merge_image_field(
    chosen: Dict[str, str],
    alternate: Dict[str, str] | None,
    columbia_images_root: Path,
    columbia_image_base_url: str,
) -> str:
    merged = OrderedDict()
    alternate_row = alternate or {}
    for row in (chosen, alternate_row):
        for img in split_images(row.get("Images", "")):
            normalized = absolutize_image(img, columbia_images_root, columbia_image_base_url)
            merged[normalized] = True
    return "|".join(merged.keys())


def select_preferred_row(
    columbia_row: Dict[str, str] | None, tsw_row: Dict[str, str] | None
) -> tuple[Dict[str, str], str]:
    if columbia_row is not None and tsw_row is None:
        return dict(columbia_row), "columbia"
    if tsw_row is not None and columbia_row is None:
        return dict(tsw_row), "tsw"
    if columbia_row is None and tsw_row is None:
        raise ValueError("select_preferred_row requires at least one source row.")

    columbia = columbia_row or {}
    tsw = tsw_row or {}
    columbia_score = row_score(columbia, "columbia")
    tsw_score = row_score(tsw, "tsw")
    if columbia_score >= tsw_score:
        return dict(columbia), "columbia"
    return dict(tsw), "tsw"


def main() -> None:
    parser = argparse.ArgumentParser(description="Audit and merge Columbia + TSW WooCommerce catalogs")
    parser.add_argument("--columbia-csv", type=Path, default=DEFAULT_COLUMBIA_CSV)
    parser.add_argument("--tsw-csv", type=Path, default=DEFAULT_TSW_CSV)
    parser.add_argument("--columbia-images-root", type=Path, default=DEFAULT_COLUMBIA_IMAGES_ROOT)
    parser.add_argument("--columbia-image-base-url", default=DEFAULT_COLUMBIA_IMAGE_BASE)
    parser.add_argument("--output-dir", type=Path, default=DEFAULT_OUTPUT_DIR)
    args = parser.parse_args()

    columbia_rows = load_csv(args.columbia_csv)
    tsw_rows = load_csv(args.tsw_csv)
    if not columbia_rows:
        raise SystemExit(f"Columbia CSV is empty: {args.columbia_csv}")
    if not tsw_rows:
        raise SystemExit(f"TSW CSV is empty: {args.tsw_csv}")

    headers = list(columbia_rows[0].keys())
    if not headers:
        raise SystemExit(f"Columbia CSV has no headers: {args.columbia_csv}")
    columbia_by_sku = {
        normalize_sku(r.get("SKU", "")): r for r in columbia_rows if normalize_sku(r.get("SKU", ""))
    }
    tsw_by_sku = {
        normalize_sku(r.get("SKU", "")): r for r in tsw_rows if normalize_sku(r.get("SKU", ""))
    }

    all_keys = sorted(set(columbia_by_sku.keys()) | set(tsw_by_sku.keys()))
    merged_rows: List[Dict[str, str]] = []
    xref_rows: List[Dict[str, str]] = []

    selected_columbia = 0
    selected_tsw = 0
    overlapping = 0
    with_images = 0
    missing_images = 0

    for key in all_keys:
        c_row = columbia_by_sku.get(key)
        t_row = tsw_by_sku.get(key)
        if c_row and t_row:
            overlapping += 1

        chosen, selected_source = select_preferred_row(c_row, t_row)
        chosen["Images"] = merge_image_field(
            chosen=chosen,
            alternate=t_row if selected_source == "columbia" else c_row,
            columbia_images_root=args.columbia_images_root,
            columbia_image_base_url=args.columbia_image_base_url,
        )
        if chosen["Images"].strip():
            with_images += 1
        else:
            missing_images += 1

        if selected_source == "columbia":
            selected_columbia += 1
        else:
            selected_tsw += 1

        merged_rows.append({field: chosen.get(field, "") for field in headers})
        xref_rows.append(
            {
                "normalized_sku": key,
                "sku": chosen.get("SKU", ""),
                "in_columbia": "1" if c_row else "0",
                "in_tsw": "1" if t_row else "0",
                "selected_source": selected_source,
                "columbia_name": (c_row or {}).get("Name", ""),
                "tsw_name": (t_row or {}).get("Name", ""),
                "selected_name": chosen.get("Name", ""),
            }
        )

    args.output_dir.mkdir(parents=True, exist_ok=True)
    merged_csv = args.output_dir / "wp-catalog.csv"
    with merged_csv.open("w", encoding="utf-8", newline="") as fh:
        writer = csv.DictWriter(fh, fieldnames=headers)
        writer.writeheader()
        writer.writerows(merged_rows)

    xref_csv = args.output_dir / "sku-cross-reference.csv"
    with xref_csv.open("w", encoding="utf-8", newline="") as fh:
        xref_headers = [
            "normalized_sku",
            "sku",
            "in_columbia",
            "in_tsw",
            "selected_source",
            "columbia_name",
            "tsw_name",
            "selected_name",
        ]
        writer = csv.DictWriter(fh, fieldnames=xref_headers)
        writer.writeheader()
        writer.writerows(xref_rows)

    summary = {
        "inputs": {
            "columbia_csv": str(args.columbia_csv),
            "tsw_csv": str(args.tsw_csv),
            "columbia_images_root": str(args.columbia_images_root),
            "columbia_image_base_url": args.columbia_image_base_url,
        },
        "stats": {
            "columbia_source_skus": len(columbia_by_sku),
            "tsw_source_skus": len(tsw_by_sku),
            "combined_unique_skus": len(all_keys),
            "overlapping_skus": overlapping,
            "selected_from_columbia": selected_columbia,
            "selected_from_tsw": selected_tsw,
            "rows_with_images": with_images,
            "rows_missing_images": missing_images,
        },
        "outputs": {
            "merged_csv": str(merged_csv),
            "sku_cross_reference_csv": str(xref_csv),
        },
    }

    summary_json = args.output_dir / "audit-summary.json"
    summary_json.write_text(json.dumps(summary, indent=2), encoding="utf-8")

    summary_md = args.output_dir / "audit-summary.md"
    stats = summary["stats"]
    summary_md.write_text(
        "\n".join(
            [
                "# Columbia Catalog Audit + Merge Summary",
                "",
                "## Inputs",
                "",
                f"- Columbia CSV: `{summary['inputs']['columbia_csv']}`",
                f"- TSW CSV: `{summary['inputs']['tsw_csv']}`",
                f"- Columbia images root: `{summary['inputs']['columbia_images_root']}`",
                f"- Columbia image base URL: `{summary['inputs']['columbia_image_base_url']}`",
                "",
                "## Cross-reference stats",
                "",
                f"- Columbia source SKUs: **{stats['columbia_source_skus']}**",
                f"- TSW source SKUs: **{stats['tsw_source_skus']}**",
                f"- Combined unique SKUs: **{stats['combined_unique_skus']}**",
                f"- Overlapping SKUs: **{stats['overlapping_skus']}**",
                f"- Selected from Columbia: **{stats['selected_from_columbia']}**",
                f"- Selected from TSW: **{stats['selected_from_tsw']}**",
                f"- Rows with images: **{stats['rows_with_images']}**",
                f"- Rows missing images: **{stats['rows_missing_images']}**",
                "",
                "## Outputs",
                "",
                f"- Merged WooCommerce CSV: `{summary['outputs']['merged_csv']}`",
                f"- SKU cross-reference CSV: `{summary['outputs']['sku_cross_reference_csv']}`",
                f"- JSON summary: `{summary_json}`",
            ]
        ),
        encoding="utf-8",
    )

    print(f"✔ Merged catalog written to: {merged_csv}")
    print(f"✔ Cross-reference written to: {xref_csv}")
    print(f"✔ Summary written to: {summary_json}")
    print(f"✔ Markdown summary written to: {summary_md}")


if __name__ == "__main__":
    main()
