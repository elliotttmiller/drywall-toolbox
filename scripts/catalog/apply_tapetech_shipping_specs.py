#!/usr/bin/env python3
"""Apply official TapeTech packaged shipping specifications to a WooCommerce CSV.

Authority:
- WooCommerce remains product/order system of record.
- TapeTech source owns UPC and packaged shipping dimensions/weight by model.
- Veeqo consumes normalized WooCommerce/DTB product data; this script does not call Veeqo.

Safety:
- exact normalized SKU matches only
- TapeTech brand guard
- duplicate detection
- dry-run by default
- atomic output replacement
- idempotent updates
- complete audit output
"""
from __future__ import annotations

import argparse
import csv
import os
import re
import tempfile
from collections import defaultdict
from pathlib import Path
from typing import Dict, Iterable, List

TARGET_FIELDS = {
    "GTIN, UPC, EAN, or ISBN": "UPC Code",
    "Length (in)": "Ship Box Length (in)",
    "Width (in)": "Ship Box Width (in)",
    "Height (in)": "Ship Box Height (in)",
    "Weight (lbs)": "Ship Package Weight (lbs)",
}
REQUIRED_SOURCE_FIELDS = {"Model", "Description", *TARGET_FIELDS.values()}
REQUIRED_CATALOG_FIELDS = {"SKU", "Name", "Brands", *TARGET_FIELDS.keys()}


def normalize_sku(value: str) -> str:
    value = (value or "").strip().upper()
    value = re.sub(r"\s*-\s*", "-", value)
    return re.sub(r"\s+", "", value)


def normalize_scalar(value: str) -> str:
    value = "" if value is None else str(value).strip()
    if re.fullmatch(r"-?\d+\.0+", value):
        return value.split(".", 1)[0]
    return value


def read_csv(path: Path) -> tuple[List[str], List[Dict[str, str]]]:
    with path.open("r", encoding="utf-8-sig", newline="") as handle:
        reader = csv.DictReader(handle)
        if not reader.fieldnames:
            raise ValueError(f"{path}: missing CSV header")
        return list(reader.fieldnames), list(reader)


def require_fields(path: Path, actual: Iterable[str], required: set[str]) -> None:
    missing = sorted(required - set(actual))
    if missing:
        raise ValueError(f"{path}: missing required columns: {', '.join(missing)}")


def atomic_write_csv(path: Path, headers: List[str], rows: List[Dict[str, str]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, tmp_name = tempfile.mkstemp(prefix=f".{path.name}.", suffix=".tmp", dir=path.parent)
    try:
        with os.fdopen(fd, "w", encoding="utf-8", newline="") as handle:
            writer = csv.DictWriter(handle, fieldnames=headers, extrasaction="ignore")
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


def main() -> int:
    parser = argparse.ArgumentParser()
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

    catalog_index: defaultdict[str, list[int]] = defaultdict(list)
    for index, row in enumerate(catalog_rows):
        sku = normalize_sku(row.get("SKU", ""))
        if sku:
            catalog_index[sku].append(index)

    duplicate_catalog_skus = {sku: indexes for sku, indexes in catalog_index.items() if len(indexes) > 1}
    if duplicate_catalog_skus:
        examples = ", ".join(sorted(duplicate_catalog_skus)[:10])
        raise ValueError(f"Catalog contains duplicate normalized SKUs; refusing update: {examples}")

    seen_source: set[str] = set()
    audit_rows: list[dict[str, str]] = []
    matched = changed = unchanged = unmatched = 0

    for source_row in source_rows:
        source_sku = normalize_sku(source_row.get("Model", ""))
        if not source_sku:
            raise ValueError("Source contains a blank Model")
        if source_sku in seen_source:
            raise ValueError(f"Source contains duplicate normalized Model: {source_sku}")
        seen_source.add(source_sku)

        indexes = catalog_index.get(source_sku, [])
        if not indexes:
            unmatched += 1
            audit_rows.append({
                "Status": "NOT_IN_PRODUCTION_CATALOG",
                "Official Model": source_row["Model"],
                "Catalog SKU": "",
                "Catalog Name": "",
                "Action": "NO_CHANGE",
                "Notes": "Official reference retained; no fuzzy or speculative linkage.",
            })
            continue

        row = catalog_rows[indexes[0]]
        brand = f'{row.get("Brands", "")} {row.get("Name", "")}'.lower()
        if "tapetech" not in brand:
            raise ValueError(
                f"SKU {row.get('SKU')} matched official TapeTech model but catalog row is not TapeTech"
            )

        matched += 1
        row_changed = False
        audit = {
            "Status": "MATCHED_EXACT_SKU",
            "Official Model": source_row["Model"],
            "Catalog SKU": row.get("SKU", ""),
            "Catalog Name": row.get("Name", ""),
            "Action": "UNCHANGED",
            "Notes": "Exact normalized SKU and TapeTech brand guard passed.",
        }
        for target, source in TARGET_FIELDS.items():
            before = normalize_scalar(row.get(target, ""))
            after = normalize_scalar(source_row.get(source, ""))
            audit[f"Existing {target}"] = before
            audit[f"Official {target}"] = after
            if not after:
                audit["Notes"] += f" Official {source} is blank; existing value preserved."
                continue
            if before != after:
                row[target] = after
                row_changed = True

        if row_changed:
            changed += 1
            audit["Action"] = "UPDATED"
        else:
            unchanged += 1
        audit_rows.append(audit)

    audit_headers = [
        "Status", "Official Model", "Catalog SKU", "Catalog Name",
        *[item for field in TARGET_FIELDS for item in (f"Existing {field}", f"Official {field}")],
        "Action", "Notes",
    ]
    atomic_write_csv(args.audit, audit_headers, audit_rows)
    if args.apply:
        atomic_write_csv(args.output, catalog_headers, catalog_rows)

    print(
        f"source={len(source_rows)} matched={matched} changed={changed} "
        f"unchanged={unchanged} unmatched={unmatched} apply={args.apply}"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
