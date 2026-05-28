#!/usr/bin/env python3
"""
Generate canonical technical specifications metadata for WooCommerce CSV catalogs.

Writes/updates `Meta: _dtb_specs_json` as a JSON array per row so product detail
UIs can render a consistent, professional specifications table end-to-end.

For toolsets that include a <table class="dtb-kit-contents"> in their description,
also writes `Meta: _includes_N_name` / `Meta: _includes_N_sku` columns so the
frontend can render a structured, linkable "Set Includes" list.
"""

from __future__ import annotations

import argparse
import csv
import json
import re
from pathlib import Path

SPECS_META_JSON_COL = "Meta: _dtb_specs_json"


def clean(value: str) -> str:
    return re.sub(r"\s+", " ", str(value or "")).strip()


def strip_tags(html: str) -> str:
    return re.sub(r"<[^>]+>", "", html or "").strip()


def append_spec(specs: list[dict[str, str]], seen_labels: set[str], label: str, value: str) -> None:
    label_clean = clean(label)
    value_clean = clean(value)
    if not label_clean or not value_clean:
        return
    key = label_clean.lower()
    if key in seen_labels:
        return
    seen_labels.add(key)
    specs.append({"label": label_clean, "value": value_clean})


def customer_label_for(attribute_label: str) -> str:
    label = clean(attribute_label)
    low = label.lower()
    overrides = {
        "box configuration": "Configuration",
        "size / model": "Size",
    }
    return overrides.get(low, label)


def with_unit(value: str, unit: str) -> str:
    value_clean = clean(value)
    return f"{value_clean} {unit}".strip() if value_clean else ""


def extract_kit_includes(html_str: str) -> list[dict[str, str]]:
    """
    Parse <table class="...dtb-kit-contents..."> rows from a product description.

    Returns a list of {"name": "2× EasyClean Automatic Tapers", "sku": "07TT"} dicts.
    Each item's name includes a quantity prefix when present (e.g. "2×").
    """
    if not html_str:
        return []

    table_m = re.search(
        r"<table[^>]*dtb-kit-contents[^>]*>(.*?)</table>",
        html_str, re.DOTALL | re.IGNORECASE,
    )
    if not table_m:
        return []

    table_html = table_m.group(1)
    # Strip <thead> so header row is not parsed as data
    table_html = re.sub(r"<thead>.*?</thead>", "", table_html, flags=re.DOTALL | re.IGNORECASE)

    items: list[dict[str, str]] = []
    for tr_m in re.finditer(r"<tr[^>]*>(.*?)</tr>", table_html, re.DOTALL | re.IGNORECASE):
        cells = re.findall(r"<td[^>]*>(.*?)</td>", tr_m.group(1), re.DOTALL | re.IGNORECASE)
        if len(cells) < 2:
            continue
        qty  = strip_tags(cells[0])
        name = strip_tags(cells[1])
        mpn  = strip_tags(cells[2]) if len(cells) >= 3 else ""
        if not name:
            continue
        display_name = f"{qty}\u00d7 {name}" if qty and re.match(r"^\d+$", qty) else name
        items.append({"name": clean(display_name), "sku": clean(mpn)})

    return items


def build_specs_json(row: dict[str, str]) -> str:
    specs: list[dict[str, str]] = []
    seen: set[str] = set()

    # ── Identity ────────────────────────────────────────────────────────────
    append_spec(specs, seen, "Brand", row.get("Brands", ""))
    append_spec(specs, seen, "Part Number", row.get("SKU", ""))
    append_spec(specs, seen, "Model", row.get("Meta: schema_mpn", ""))

    # ── Physical dimensions ──────────────────────────────────────────────────
    append_spec(specs, seen, "Weight", with_unit(row.get("Weight (lbs)", ""), "lbs"))

    length = clean(row.get("Length (in)", ""))
    width  = clean(row.get("Width (in)", ""))
    height = clean(row.get("Height (in)", ""))
    if length and width and height:
        append_spec(specs, seen, "Dimensions", f"{length} in × {width} in × {height} in")
    elif length:
        append_spec(specs, seen, "Length", f"{length} in")

    # ── Product attributes ───────────────────────────────────────────────────
    attr_pairs: list[tuple[int, str, str]] = []
    for key in row.keys():
        m = re.match(r"^Attribute\s+(\d+)\s+name$", key)
        if not m:
            continue
        idx = int(m.group(1))
        attr_pairs.append((idx, key, f"Attribute {idx} value(s)"))

    for _, name_key, value_key in sorted(attr_pairs, key=lambda item: item[0]):
        label = clean(row.get(name_key, ""))
        value = clean(row.get(value_key, ""))
        if not label or not value:
            continue
        if label.lower() == "brand":
            continue
        append_spec(specs, seen, customer_label_for(label), value)

    # ── Set Includes (toolsets) ──────────────────────────────────────────────
    kit_items = extract_kit_includes(row.get("Description", ""))
    if kit_items:
        value_str = ", ".join(item["name"] for item in kit_items)
        append_spec(specs, seen, "Set Includes", value_str)

    return json.dumps(specs, ensure_ascii=False, separators=(",", ":")) if specs else "[]"


def run(csv_path: Path, write_backup: bool) -> dict[str, int]:
    with csv_path.open("r", encoding="utf-8", newline="") as fh:
        reader = csv.DictReader(fh)
        fieldnames = list(reader.fieldnames or [])
        rows = [dict(row) for row in reader]

    if SPECS_META_JSON_COL not in fieldnames:
        fieldnames.append(SPECS_META_JSON_COL)

    # ── First pass: build specs JSON + extract kit includes per row ──────────
    populated = 0
    rows_includes: list[list[dict[str, str]]] = []
    for row in rows:
        payload = build_specs_json(row)
        row[SPECS_META_JSON_COL] = payload
        if payload != "[]":
            populated += 1
        rows_includes.append(extract_kit_includes(row.get("Description", "")))

    # ── Ensure _includes_N_ fieldnames exist up to the max kit depth ─────────
    max_includes = max((len(items) for items in rows_includes), default=0)
    for i in range(max_includes):
        name_col = f"Meta: _includes_{i}_name"
        sku_col  = f"Meta: _includes_{i}_sku"
        if name_col not in fieldnames:
            fieldnames.append(name_col)
        if sku_col not in fieldnames:
            fieldnames.append(sku_col)

    # ── Second pass: write (and clear stale) _includes_N_ values ────────────
    for row, kit_items in zip(rows, rows_includes):
        for key in list(row.keys()):
            if re.match(r"^Meta: _includes_\d+_(name|sku)$", key):
                row[key] = ""
        for i, item in enumerate(kit_items):
            row[f"Meta: _includes_{i}_name"] = item["name"]
            row[f"Meta: _includes_{i}_sku"]  = item["sku"]

    if write_backup:
        backup = csv_path.with_suffix(f".pre_specs_meta{csv_path.suffix}")
        backup.write_text(csv_path.read_text(encoding="utf-8"), encoding="utf-8")

    with csv_path.open("w", encoding="utf-8", newline="") as fh:
        writer = csv.DictWriter(fh, fieldnames=fieldnames, extrasaction="ignore", lineterminator="\n")
        writer.writeheader()
        writer.writerows(rows)

    toolset_count = sum(1 for kit in rows_includes if kit)
    return {
        "rows": len(rows),
        "rows_with_specs": populated,
        "rows_without_specs": len(rows) - populated,
        "toolset_rows_with_includes": toolset_count,
        "max_includes_depth": max_includes,
    }


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Build canonical Meta: _dtb_specs_json values for a WooCommerce CSV.")
    parser.add_argument(
        "--csv",
        type=Path,
        default=Path(__file__).resolve().parent.parent
            / "products" / "Production" / "catalogs" / "official" / "woocommerce_catalog_production.csv",
        help="Path to WooCommerce CSV file.",
    )
    parser.add_argument("--no-backup", action="store_true", help="Skip creating .pre_specs_meta backup file.")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    stats = run(args.csv.resolve(), write_backup=not args.no_backup)
    print(json.dumps({"csv": str(args.csv), **stats}, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
