from __future__ import annotations

import csv
import json
import re
from collections import defaultdict
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[1]
FRONTEND_BRANDS_DIR = REPO_ROOT / "frontend" / "public" / "brands"
WC_CATALOG = REPO_ROOT / "products" / "Production" / "catalogs" / "official" / "woocommerce_catalog.csv"
REPORTS_DIR = REPO_ROOT / "products" / "Production" / "reports"

SUMMARY_PATH = REPORTS_DIR / "schematic_hotspot_to_woo_audit.json"
DETAIL_PATH = REPORTS_DIR / "schematic_hotspot_to_woo_mapping.csv"

BRAND_FOLDER_TO_WOO_BRAND = {
    "Asgard": "Asgard",
    "Columbia": "Columbia",
    "Dura-Stilts": "Dura-Stilts",
    "Level5": "Level 5",
    "TapeTech": "TapeTech",
}

PARTS_CATEGORY_KEYWORDS = (
    "> Parts",
    "Parts & Accessories",
    "Repair Kits & Parts",
    "Replacement Parts",
    "Spare Parts",
    "Pumps & Parts",
)

PARENS_PATTERN = re.compile(r"\(([A-Za-z0-9 .\-\/]+)\)")
CODE_PATTERN = re.compile(r"\b[A-Z]{1,8}\s*[0-9][A-Z0-9.\-\/]*\b")


def clean_text(value: str) -> str:
    return (value or "").replace("\ufeff", " ").replace("\xa0", " ").strip()


def normalize_sku(value: str) -> str:
    text = clean_text(value).upper()
    text = text.replace("”", "").replace("“", "").replace('"', "").replace("'", "")
    text = re.sub(r"\s+", "", text)
    text = text.replace("_", "").replace("-", "").replace("/", "")
    return text


def is_parts_row(row: dict[str, str]) -> bool:
    categories = clean_text(row.get("Categories", ""))
    return any(keyword in categories for keyword in PARTS_CATEGORY_KEYWORDS)


def read_wc_parts_index() -> dict[str, dict[str, list[dict[str, str]]]]:
    with WC_CATALOG.open("r", encoding="utf-8-sig", newline="") as handle:
        rows = list(csv.DictReader(handle))

    index: dict[str, dict[str, list[dict[str, str]]]] = {}
    for folder_brand, woo_brand in BRAND_FOLDER_TO_WOO_BRAND.items():
        brand_rows = [
            row
            for row in rows
            if clean_text(row.get("Brands", "")) == woo_brand
            and clean_text(row.get("Type", "")).lower() == "simple"
            and is_parts_row(row)
            and clean_text(row.get("SKU", ""))
        ]
        exact: dict[str, list[dict[str, str]]] = defaultdict(list)
        normalized: dict[str, list[dict[str, str]]] = defaultdict(list)
        for row in brand_rows:
            sku = clean_text(row["SKU"])
            exact[sku].append(row)
            normalized[normalize_sku(sku)].append(row)
        index[folder_brand] = {"exact": exact, "normalized": normalized, "rows": brand_rows}
    return index


def build_candidate_codes(part: dict[str, object]) -> list[str]:
    raw_values = [
        clean_text(str(part.get("sku", "") or "")),
        clean_text(str(part.get("id", "") or "")),
        clean_text(str(part.get("source_sku", "") or "")),
        clean_text(str(part.get("name", "") or "")),
    ]
    values: list[str] = []
    for raw in raw_values:
        if raw:
            values.append(raw)
        for match in PARENS_PATTERN.findall(raw):
            match = clean_text(match)
            if match:
                values.append(match)
        upper_raw = raw.upper()
        for match in CODE_PATTERN.findall(upper_raw):
            match = clean_text(match)
            if match:
                values.append(match)

    candidates: list[str] = []
    seen: set[str] = set()
    for value in values:
        cleaned = value.upper()
        cleaned = cleaned.replace("”", "").replace("“", "").replace('"', "").replace("'", "")
        cleaned = cleaned.replace("/", "-")
        no_spaces = re.sub(r"\s+", "", cleaned)
        variants = [
            cleaned,
            no_spaces,
            re.sub(r"\s+", "-", cleaned),
            no_spaces.replace("--", "-"),
            re.sub(r"^([A-Z]+)0+([1-9].*)$", r"\1\2", no_spaces),
            # Also try with "IN" suffix for WC SKUs generated from inch-mark (") conversion
            no_spaces + "IN",
        ]
        for variant in variants:
            variant = clean_text(variant).strip("-")
            if not variant or variant in seen:
                continue
            seen.add(variant)
            candidates.append(variant)
    return candidates


def resolve_part_sku(
    brand: str,
    part: dict[str, object],
    wc_index: dict[str, dict[str, list[dict[str, str]]]],
) -> tuple[str, str]:
    source_sku = clean_text(str(part.get("sku", "") or ""))
    brand_index = wc_index.get(brand, {})
    exact_index = brand_index.get("exact", {})
    normalized_index = brand_index.get("normalized", {})

    def exact_lookup(candidate: str) -> str | None:
        matches = exact_index.get(candidate, [])
        if len(matches) == 1:
            return clean_text(matches[0]["SKU"])
        return None

    def normalized_lookup(candidate: str) -> str | None:
        normalized = normalize_sku(candidate)
        matches = normalized_index.get(normalized, [])
        if len(matches) == 1:
            return clean_text(matches[0]["SKU"])
        return None

    if source_sku:
        resolved = exact_lookup(source_sku)
        if resolved:
            return resolved, "exact"
        resolved = normalized_lookup(source_sku)
        if resolved:
            return resolved, "normalized"

    for candidate in build_candidate_codes(part):
        resolved = exact_lookup(candidate)
        if resolved:
            return resolved, "candidate_exact"
        resolved = normalized_lookup(candidate)
        if resolved:
            return resolved, "candidate_normalized"

    return "", "unresolved"


def iter_schematic_files() -> list[tuple[str, Path]]:
    files: list[tuple[str, Path]] = []
    for brand_dir in sorted(FRONTEND_BRANDS_DIR.iterdir()):
        if not brand_dir.is_dir():
            continue
        schematics_dir = brand_dir / "Schematics"
        if not schematics_dir.exists():
            continue
        for path in sorted(schematics_dir.rglob("schematic_data*.json")):
            files.append((brand_dir.name, path))
    return files


def sync_file(
    brand: str,
    path: Path,
    wc_index: dict[str, dict[str, list[dict[str, str]]]],
    detail_rows: list[dict[str, str]],
    brand_summary: dict[str, dict[str, object]],
) -> None:
    data = json.loads(path.read_text(encoding="utf-8"))
    parts = data.get("parts") or []

    summary = brand_summary.setdefault(
        brand,
        {
            "schematic_files": set(),
            "hotspot_rows_total": 0,
            "hotspot_rows_with_source_sku": 0,
            "exact_resolved_rows": 0,
            "normalized_resolved_rows": 0,
            "candidate_resolved_rows": 0,
            "cleared_unresolved_rows": 0,
            "active_rows_after_sync": 0,
            "active_unique_skus_after_sync": set(),
            "unresolved_examples": [],
        },
    )
    summary["schematic_files"].add(str(path.relative_to(REPO_ROOT)).replace("\\", "/"))

    for part in parts:
        summary["hotspot_rows_total"] += 1
        source_sku = clean_text(str(part.get("sku", "") or ""))
        if source_sku:
            summary["hotspot_rows_with_source_sku"] += 1

        resolved_sku, rule = resolve_part_sku(brand, part, wc_index)
        if resolved_sku:
            part["sku"] = resolved_sku
            if source_sku and source_sku != resolved_sku:
                part["source_sku"] = source_sku
            elif "source_sku" in part:
                part.pop("source_sku", None)

            if rule == "exact":
                summary["exact_resolved_rows"] += 1
            elif rule == "normalized":
                summary["normalized_resolved_rows"] += 1
            else:
                summary["candidate_resolved_rows"] += 1

            summary["active_rows_after_sync"] += 1
            summary["active_unique_skus_after_sync"].add(resolved_sku)
        else:
            if source_sku:
                part["source_sku"] = source_sku
                summary["cleared_unresolved_rows"] += 1
                if len(summary["unresolved_examples"]) < 20:
                    summary["unresolved_examples"].append(
                        {
                            "sku": source_sku,
                            "part_id": clean_text(str(part.get("id", "") or "")),
                            "part_name": clean_text(str(part.get("name", "") or "")),
                            "file": str(path.relative_to(REPO_ROOT)).replace("\\", "/"),
                        }
                    )
            part["sku"] = ""

        detail_rows.append(
            {
                "brand": brand,
                "schematic_file": str(path.relative_to(REPO_ROOT)).replace("\\", "/"),
                "part_id": clean_text(str(part.get("id", "") or "")),
                "part_name": clean_text(str(part.get("name", "") or "")),
                "source_sku": source_sku,
                "resolved_sku": resolved_sku,
                "status": "resolved" if resolved_sku else "cleared_unresolved",
                "resolution_rule": rule,
            }
        )

    path.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def finalize_summary(brand_summary: dict[str, dict[str, object]]) -> dict[str, dict[str, object]]:
    final: dict[str, dict[str, object]] = {}
    for brand, summary in sorted(brand_summary.items()):
        final[brand] = {
            "schematic_files": len(summary["schematic_files"]),
            "hotspot_rows_total": summary["hotspot_rows_total"],
            "hotspot_rows_with_source_sku": summary["hotspot_rows_with_source_sku"],
            "exact_resolved_rows": summary["exact_resolved_rows"],
            "normalized_resolved_rows": summary["normalized_resolved_rows"],
            "candidate_resolved_rows": summary["candidate_resolved_rows"],
            "cleared_unresolved_rows": summary["cleared_unresolved_rows"],
            "active_rows_after_sync": summary["active_rows_after_sync"],
            "active_unique_skus_after_sync": len(summary["active_unique_skus_after_sync"]),
            "unresolved_examples": summary["unresolved_examples"],
        }
    return final


def write_detail_report(rows: list[dict[str, str]]) -> None:
    with DETAIL_PATH.open("w", encoding="utf-8-sig", newline="") as handle:
        writer = csv.DictWriter(
            handle,
            fieldnames=[
                "brand",
                "schematic_file",
                "part_id",
                "part_name",
                "source_sku",
                "resolved_sku",
                "status",
                "resolution_rule",
            ],
            quoting=csv.QUOTE_ALL,
        )
        writer.writeheader()
        writer.writerows(rows)


def main() -> None:
    wc_index = read_wc_parts_index()
    detail_rows: list[dict[str, str]] = []
    brand_summary: dict[str, dict[str, object]] = {}

    for brand, path in iter_schematic_files():
        sync_file(brand, path, wc_index, detail_rows, brand_summary)

    REPORTS_DIR.mkdir(parents=True, exist_ok=True)
    write_detail_report(detail_rows)

    summary = {
        "woocommerce_catalog": str(WC_CATALOG.relative_to(REPO_ROOT)).replace("\\", "/"),
        "mapping_report": str(DETAIL_PATH.relative_to(REPO_ROOT)).replace("\\", "/"),
        "brands": finalize_summary(brand_summary),
    }
    SUMMARY_PATH.write_text(json.dumps(summary, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(summary, indent=2))


if __name__ == "__main__":
    main()
