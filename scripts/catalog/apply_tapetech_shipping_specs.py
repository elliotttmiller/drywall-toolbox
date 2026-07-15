#!/usr/bin/env python3
"""Apply official TapeTech package specifications to the production WooCommerce CSV.

Exact SKU matches only. The command is deterministic, idempotent, and rejects
unmatched source records rather than guessing by description.
"""

from __future__ import annotations

import argparse
import csv
from pathlib import Path

SOURCE_FIELDS = {
    "UPC Code": "GTIN, UPC, EAN, or ISBN",
    "Ship Package Weight (lbs)": "Weight (lbs)",
    "Ship Box Length (in)": "Length (in)",
    "Ship Box Width (in)": "Width (in)",
    "Ship Box Height (in)": "Height (in)",
}
PROVENANCE_FIELDS = (
    "Meta: _dtb_shipping_spec_source",
    "Meta: _dtb_shipping_spec_model",
    "Meta: _dtb_shipping_spec_verified",
)


def clean(value: object) -> str:
    return str(value or "").strip()


def normalize_upc(value: object) -> str:
    text = clean(value)
    if text.endswith(".0"):
        text = text[:-2]
    return text.zfill(12) if text.isdigit() else text


def read_rows(path: Path) -> tuple[list[str], list[dict[str, str]]]:
    with path.open("r", encoding="utf-8-sig", newline="") as handle:
        reader = csv.DictReader(handle)
        if not reader.fieldnames:
            raise ValueError(f"{path}: missing CSV header")
        return list(reader.fieldnames), list(reader)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--source", type=Path, required=True)
    parser.add_argument("--catalog", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--audit", type=Path, required=True)
    args = parser.parse_args()

    source_headers, source_rows = read_rows(args.source)
    catalog_headers, catalog_rows = read_rows(args.catalog)
    required_source = {"Model", "Description", *SOURCE_FIELDS}
    missing_source = sorted(required_source.difference(source_headers))
    required_catalog = {"SKU", "Name", *SOURCE_FIELDS.values()}
    missing_catalog = sorted(required_catalog.difference(catalog_headers))
    if missing_source or missing_catalog:
        raise ValueError(
            f"missing source fields={missing_source}; missing catalog fields={missing_catalog}"
        )

    source_by_model: dict[str, dict[str, str]] = {}
    duplicate_models: set[str] = set()
    for row in source_rows:
        model = clean(row["Model"]).upper()
        if not model:
            continue
        if model in source_by_model:
            duplicate_models.add(model)
        source_by_model[model] = row
    if duplicate_models:
        raise ValueError(f"duplicate TapeTech models: {sorted(duplicate_models)}")

    catalog_by_sku: dict[str, list[tuple[int, dict[str, str]]]] = {}
    for row_number, row in enumerate(catalog_rows, start=2):
        sku = clean(row["SKU"]).upper()
        if sku:
            catalog_by_sku.setdefault(sku, []).append((row_number, row))

    audit_rows: list[dict[str, str]] = []
    matched = 0
    for source_number, source_row in enumerate(source_rows, start=2):
        model = clean(source_row["Model"])
        candidates = catalog_by_sku.get(model.upper(), [])
        if len(candidates) != 1:
            audit_rows.append({
                "source_row": str(source_number),
                "model": model,
                "description": clean(source_row["Description"]),
                "catalog_row": "",
                "catalog_sku": "",
                "catalog_name": "",
                "match_status": "ambiguous" if candidates else "unmatched",
                "action": "no_catalog_change",
            })
            continue

        catalog_number, catalog_row = candidates[0]
        for source_field, catalog_field in SOURCE_FIELDS.items():
            value = source_row[source_field]
            catalog_row[catalog_field] = (
                normalize_upc(value) if source_field == "UPC Code" else clean(value)
            )
        catalog_row[PROVENANCE_FIELDS[0]] = args.source.name
        catalog_row[PROVENANCE_FIELDS[1]] = model
        catalog_row[PROVENANCE_FIELDS[2]] = "yes"
        matched += 1
        audit_rows.append({
            "source_row": str(source_number),
            "model": model,
            "description": clean(source_row["Description"]),
            "catalog_row": str(catalog_number),
            "catalog_sku": clean(catalog_row["SKU"]),
            "catalog_name": clean(catalog_row["Name"]),
            "match_status": "matched_exact_sku",
            "action": "updated_official_shipping_fields",
        })

    output_headers = list(catalog_headers)
    for field in PROVENANCE_FIELDS:
        if field not in output_headers:
            output_headers.append(field)

    args.output.parent.mkdir(parents=True, exist_ok=True)
    with args.output.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=output_headers, lineterminator="\n")
        writer.writeheader()
        writer.writerows(catalog_rows)

    args.audit.parent.mkdir(parents=True, exist_ok=True)
    audit_headers = (
        "source_row", "model", "description", "catalog_row", "catalog_sku",
        "catalog_name", "match_status", "action",
    )
    with args.audit.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=audit_headers, lineterminator="\n")
        writer.writeheader()
        writer.writerows(audit_rows)

    unmatched = sum(row["match_status"] == "unmatched" for row in audit_rows)
    ambiguous = sum(row["match_status"] == "ambiguous" for row in audit_rows)
    print(
        f"source={len(source_rows)} matched={matched} "
        f"unmatched={unmatched} ambiguous={ambiguous} output={args.output}"
    )
    return 0 if ambiguous == 0 else 2


if __name__ == "__main__":
    raise SystemExit(main())
