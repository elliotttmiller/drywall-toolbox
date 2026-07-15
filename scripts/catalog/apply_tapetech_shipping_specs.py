#!/usr/bin/env python3
"""Apply official TapeTech packaged shipping specifications to a WooCommerce catalog CSV.

Authority:
- WooCommerce remains the product/order system of record.
- TapeTech's official source owns UPC and packaged shipping dimensions/weight by model.
- Veeqo remains inventory, warehouse, allocation, fulfillment, labels, carrier, and tracking authority.
- This script does not call WordPress, WooCommerce, Veeqo, QuickBooks, or any external service.

Safety:
- dry-run by default; --apply is required to write the output catalog
- normalized exact SKU/model matches only
- TapeTech brand/name guard before mutation
- duplicate source/catalog SKU rejection
- blank official values preserve existing catalog values
- deterministic audit output
- atomic output replacement
- idempotent field updates
"""
from __future__ import annotations

import argparse
import csv
import os
import re
import tempfile
from collections import defaultdict
from pathlib import Path
from typing import Iterable

CATALOG_FIELD_MAP = {
    "UPC Code": "GTIN, UPC, EAN, or ISBN",
    "Ship Package Weight (lbs)": "Weight (lbs)",
    "Ship Box Length (in)": "Length (in)",
    "Ship Box Width (in)": "Width (in)",
    "Ship Box Height (in)": "Height (in)",
}

METRIC_META_FIELD_MAP = {
    "Ship Box Length (cm)": "Meta: _dtb_shipping_package_length_cm",
    "Ship Box Width (cm)": "Meta: _dtb_shipping_package_width_cm",
    "Ship Box Height (cm)": "Meta: _dtb_shipping_package_height_cm",
    "Ship Package Weight (kg)": "Meta: _dtb_shipping_package_weight_kg",
}

PROVENANCE_FIELDS = {
    "Meta: _dtb_shipping_spec_source": None,
    "Meta: _dtb_shipping_spec_model": "Model",
    "Meta: _dtb_shipping_spec_description": "Description",
    "Meta: _dtb_shipping_spec_verified": None,
}

REQUIRED_SOURCE_FIELDS = {
    "Model",
    "Description",
    *CATALOG_FIELD_MAP.keys(),
    *METRIC_META_FIELD_MAP.keys(),
}
REQUIRED_CATALOG_FIELDS = {"SKU", "Name", "Brands", *CATALOG_FIELD_MAP.values()}


def normalize_sku(value: object) -> str:
    text = str(value or "").strip().upper()
    text = re.sub(r"\s*-\s*", "-", text)
    return re.sub(r"\s+", "", text)


def clean(value: object) -> str:
    return str(value or "").strip()


def normalize_scalar(value: object) -> str:
    text = clean(value)
    if re.fullmatch(r"-?\d+\.0+", text):
        return text.split(".", 1)[0]
    return text


def normalize_upc(value: object) -> str:
    text = normalize_scalar(value)
    return text.zfill(12) if text.isdigit() else text


def read_csv(path: Path) -> tuple[list[str], list[dict[str, str]]]:
    with path.open("r", encoding="utf-8-sig", newline="") as handle:
        reader = csv.DictReader(handle)
        if not reader.fieldnames:
            raise ValueError(f"{path}: missing CSV header")
        return list(reader.fieldnames), list(reader)


def require_fields(path: Path, actual: Iterable[str], required: set[str]) -> None:
    missing = sorted(required - set(actual))
    if missing:
        raise ValueError(f"{path}: missing required columns: {', '.join(missing)}")


def atomic_write_csv(path: Path, headers: list[str], rows: list[dict[str, str]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, tmp_name = tempfile.mkstemp(prefix=f".{path.name}.", suffix=".tmp", dir=path.parent)
    try:
        with os.fdopen(fd, "w", encoding="utf-8", newline="") as handle:
            writer = csv.DictWriter(handle, fieldnames=headers, extrasaction="ignore", lineterminator="\n")
            writer.writeheader()
            writer.writerows(rows)
            handle.flush()
            os.fsync(handle.fileno())
        os.replace(tmp_name, path)
    except Exception:
        try:
            os.unlink(tmp_name)
        except FileNotFoundError:
            pass
        raise


def append_headers(headers: list[str], fields: Iterable[str]) -> list[str]:
    next_headers = list(headers)
    for field in fields:
        if field not in next_headers:
            next_headers.append(field)
    return next_headers


def official_value(source_row: dict[str, str], source_field: str) -> str:
    value = normalize_upc(source_row.get(source_field)) if source_field == "UPC Code" else normalize_scalar(source_row.get(source_field))
    return value


def build_catalog_index(rows: list[dict[str, str]]) -> dict[str, list[int]]:
    index: defaultdict[str, list[int]] = defaultdict(list)
    for row_index, row in enumerate(rows):
        sku = normalize_sku(row.get("SKU", ""))
        if sku:
            index[sku].append(row_index)
    duplicates = {sku: indexes for sku, indexes in index.items() if len(indexes) > 1}
    if duplicates:
        examples = ", ".join(sorted(duplicates)[:10])
        raise ValueError(f"Catalog contains duplicate normalized SKUs; refusing update: {examples}")
    return dict(index)


def assert_unique_source_models(rows: list[dict[str, str]]) -> None:
    seen: set[str] = set()
    for row in rows:
        model = normalize_sku(row.get("Model", ""))
        if not model:
            raise ValueError("Source contains a blank Model")
        if model in seen:
            raise ValueError(f"Source contains duplicate normalized Model: {model}")
        seen.add(model)


def row_is_tapetech(row: dict[str, str]) -> bool:
    haystack = f"{row.get('Brands', '')} {row.get('Name', '')}".lower()
    return "tapetech" in haystack


def main() -> int:
    parser = argparse.ArgumentParser(description="Apply official TapeTech packaged shipping specs by exact SKU.")
    parser.add_argument("--catalog", required=True, type=Path)
    parser.add_argument("--source", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    parser.add_argument("--audit", required=True, type=Path)
    parser.add_argument("--apply", action="store_true", help="Write the enriched catalog. Default is audit-only.")
    args = parser.parse_args()

    catalog_headers, catalog_rows = read_csv(args.catalog)
    source_headers, source_rows = read_csv(args.source)
    require_fields(args.catalog, catalog_headers, REQUIRED_CATALOG_FIELDS)
    require_fields(args.source, source_headers, REQUIRED_SOURCE_FIELDS)
    assert_unique_source_models(source_rows)

    output_headers = append_headers(
        catalog_headers,
        [*METRIC_META_FIELD_MAP.values(), *PROVENANCE_FIELDS.keys()],
    )
    catalog_index = build_catalog_index(catalog_rows)

    audit_rows: list[dict[str, str]] = []
    matched = changed = unchanged = unmatched = 0

    for source_row in source_rows:
        source_model = clean(source_row.get("Model"))
        source_sku = normalize_sku(source_model)
        indexes = catalog_index.get(source_sku, [])
        if not indexes:
            unmatched += 1
            audit_rows.append({
                "Status": "NOT_IN_PRODUCTION_CATALOG",
                "Official Model": source_model,
                "Catalog SKU": "",
                "Catalog Name": "",
                "Action": "NO_CHANGE",
                "Notes": "Official reference retained; no fuzzy or speculative linkage.",
            })
            continue

        row = catalog_rows[indexes[0]]
        if not row_is_tapetech(row):
            raise ValueError(f"SKU {row.get('SKU')} matched official TapeTech model but catalog row is not TapeTech")

        matched += 1
        row_changed = False
        notes = ["Exact normalized SKU and TapeTech brand guard passed."]
        audit = {
            "Status": "MATCHED_EXACT_SKU",
            "Official Model": source_model,
            "Catalog SKU": row.get("SKU", ""),
            "Catalog Name": row.get("Name", ""),
            "Action": "UNCHANGED",
        }

        for source_field, catalog_field in CATALOG_FIELD_MAP.items():
            before = normalize_scalar(row.get(catalog_field, ""))
            after = official_value(source_row, source_field)
            audit[f"Existing {catalog_field}"] = before
            audit[f"Official {catalog_field}"] = after
            if not after:
                notes.append(f"Official {source_field} is blank; existing {catalog_field} preserved.")
                continue
            if before != after:
                row[catalog_field] = after
                row_changed = True

        for source_field, meta_field in METRIC_META_FIELD_MAP.items():
            before = normalize_scalar(row.get(meta_field, ""))
            after = normalize_scalar(source_row.get(source_field, ""))
            audit[f"Existing {meta_field}"] = before
            audit[f"Official {meta_field}"] = after
            if not after:
                continue
            if before != after:
                row[meta_field] = after
                row_changed = True

        provenance_updates = {
            "Meta: _dtb_shipping_spec_source": args.source.name,
            "Meta: _dtb_shipping_spec_model": source_model,
            "Meta: _dtb_shipping_spec_description": clean(source_row.get("Description", "")),
            "Meta: _dtb_shipping_spec_verified": "yes",
        }
        for field, after in provenance_updates.items():
            before = normalize_scalar(row.get(field, ""))
            audit[f"Existing {field}"] = before
            audit[f"Official {field}"] = after
            if before != after:
                row[field] = after
                row_changed = True

        if row_changed:
            changed += 1
            audit["Action"] = "UPDATED"
        else:
            unchanged += 1
        audit["Notes"] = " ".join(notes)
        audit_rows.append(audit)

    audit_headers = [
        "Status",
        "Official Model",
        "Catalog SKU",
        "Catalog Name",
        *[
            item
            for catalog_field in CATALOG_FIELD_MAP.values()
            for item in (f"Existing {catalog_field}", f"Official {catalog_field}")
        ],
        *[
            item
            for meta_field in METRIC_META_FIELD_MAP.values()
            for item in (f"Existing {meta_field}", f"Official {meta_field}")
        ],
        *[
            item
            for provenance_field in PROVENANCE_FIELDS.keys()
            for item in (f"Existing {provenance_field}", f"Official {provenance_field}")
        ],
        "Action",
        "Notes",
    ]
    atomic_write_csv(args.audit, audit_headers, audit_rows)
    if args.apply:
        atomic_write_csv(args.output, output_headers, catalog_rows)

    print(
        f"source={len(source_rows)} matched={matched} changed={changed} "
        f"unchanged={unchanged} unmatched={unmatched} apply={args.apply}"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
