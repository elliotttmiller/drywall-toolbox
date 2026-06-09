#!/usr/bin/env python3
from __future__ import annotations

import argparse
import csv
import json
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, Iterable, List, Tuple

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_AUDIT_JSON = ROOT / "products/scraped_results/brands/TapeTech/tapetech_frontend_schematics_catalog_audit.json"
DEFAULT_OUTPUT_CSV = ROOT / "products/Production/catalogs/other/tapetech_parts_master.csv"
REQUIRED_COLUMNS = [
    "brand",
    "model",
    "schematic_key",
    "normalized_sku",
    "display_id",
    "part_name",
    "quantity",
    "notes",
    "source_confidence",
]


@dataclass(frozen=True)
class PartRow:
    brand: str
    model: str
    schematic_key: str
    normalized_sku: str
    display_id: str
    part_name: str
    quantity: str
    notes: str
    source_confidence: str


def normalize_sku(part_id: str) -> str:
    return (part_id or "").strip().upper()


def normalize_quantity(quantity: object) -> str:
    if quantity in (None, ""):
        return ""
    try:
        value = float(quantity)
    except (TypeError, ValueError):
        return str(quantity).strip()
    if value.is_integer():
        return str(int(value))
    return str(value)


def is_generic_name(name: str) -> bool:
    cleaned = (name or "").strip()
    if not cleaned:
        return True
    if re.match(r"^(part|item|component)\b", cleaned, flags=re.IGNORECASE):
        return True
    if re.fullmatch(r"[A-Z0-9\-_/.\s]+", cleaned, flags=re.IGNORECASE):
        token = re.sub(r"[^A-Z0-9]", "", cleaned.upper())
        return bool(token) and not re.search(r"[A-Z]", token)
    return False


def confidence_for_part(part: dict) -> str:
    present_in_hotspots = bool(part.get("present_in_hotspots"))
    has_non_generic_name = not is_generic_name((part.get("name") or "").strip())

    if present_in_hotspots and has_non_generic_name:
        return "high"
    if present_in_hotspots or has_non_generic_name:
        return "medium"
    return "low"


def build_notes(part: dict, duplicate_schematics: Iterable[str]) -> str:
    notes: List[str] = []
    raw_notes = (part.get("notes") or "").strip()
    if raw_notes:
        notes.append(raw_notes)

    name_source = (part.get("name_source") or "").strip()
    if name_source:
        notes.append(f"name_source={name_source}")

    if not part.get("present_in_hotspots"):
        notes.append("missing_hotspot=true")

    if is_generic_name((part.get("name") or "").strip()):
        notes.append("generic_name=true")

    schematics = sorted({s for s in duplicate_schematics if s})
    if len(schematics) > 1:
        notes.append(f"duplicate_schematic_keys={'|'.join(schematics)}")

    return "; ".join(notes)


def pick_better_row(current: PartRow, candidate: PartRow) -> PartRow:
    score = {"high": 3, "medium": 2, "low": 1}
    current_score = score.get(current.source_confidence, 0)
    candidate_score = score.get(candidate.source_confidence, 0)
    if candidate_score > current_score:
        return candidate
    if candidate_score < current_score:
        return current

    current_generic = is_generic_name(current.part_name)
    candidate_generic = is_generic_name(candidate.part_name)
    if current_generic and not candidate_generic:
        return candidate
    if candidate_generic and not current_generic:
        return current

    # Break remaining ties deterministically for stable rebuild output.
    if candidate.schematic_key < current.schematic_key:
        return candidate
    return current


def build_parts_master(audit: dict, include_backup: bool) -> List[PartRow]:
    grouped_schematics: Dict[Tuple[str, str], set] = {}
    candidates: Dict[Tuple[str, str], List[dict]] = {}

    brand = (audit.get("brand") or "TapeTech").strip() or "TapeTech"

    for schematic in audit.get("schematics", []):
        role = (schematic.get("frontend_file_role") or "").strip().lower()
        if not include_backup and role != "primary":
            continue

        model = (schematic.get("model") or "").strip()
        schematic_key = (schematic.get("schematic_key") or "").strip()

        for part in schematic.get("parts", []):
            normalized = normalize_sku(part.get("part_id") or "")
            if not normalized or not model:
                continue

            key = (normalized, model)
            grouped_schematics.setdefault(key, set()).add(schematic_key)
            candidates.setdefault(key, []).append(
                {
                    "brand": brand,
                    "model": model,
                    "schematic_key": schematic_key,
                    "normalized_sku": normalized,
                    "display_id": (part.get("display_id") or "").strip(),
                    "part_name": (part.get("name") or "").strip(),
                    "quantity": normalize_quantity(part.get("quantity")),
                    "source_confidence": confidence_for_part(part),
                    "part": part,
                }
            )

    output_rows: List[PartRow] = []
    # Sort by (model, normalized_sku) to keep output deterministic and readable.
    for key, rows in sorted(candidates.items(), key=lambda item: (item[0][1], item[0][0])):
        best = None
        for row in rows:
            notes = build_notes(row["part"], grouped_schematics.get(key, set()))
            candidate = PartRow(
                brand=row["brand"],
                model=row["model"],
                schematic_key=row["schematic_key"],
                normalized_sku=row["normalized_sku"],
                display_id=row["display_id"],
                part_name=row["part_name"],
                quantity=row["quantity"],
                notes=notes,
                source_confidence=row["source_confidence"],
            )
            best = candidate if best is None else pick_better_row(best, candidate)
        if best:
            output_rows.append(best)

    return output_rows


def write_csv(rows: List[PartRow], output_csv: Path) -> None:
    output_csv.parent.mkdir(parents=True, exist_ok=True)
    with output_csv.open("w", encoding="utf-8", newline="") as fh:
        writer = csv.DictWriter(fh, fieldnames=REQUIRED_COLUMNS)
        writer.writeheader()
        for row in rows:
            writer.writerow(
                {
                    "brand": row.brand,
                    "model": row.model,
                    "schematic_key": row.schematic_key,
                    "normalized_sku": row.normalized_sku,
                    "display_id": row.display_id,
                    "part_name": row.part_name,
                    "quantity": row.quantity,
                    "notes": row.notes,
                    "source_confidence": row.source_confidence,
                }
            )


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Build TapeTech parts master catalog CSV from frontend schematic audit JSON.")
    parser.add_argument("--audit-json", type=Path, default=DEFAULT_AUDIT_JSON)
    parser.add_argument("--output-csv", type=Path, default=DEFAULT_OUTPUT_CSV)
    parser.add_argument("--include-backup", action="store_true", help="Include backup schematic files in output (off by default).")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    audit = json.loads(args.audit_json.read_text(encoding="utf-8"))
    rows = build_parts_master(audit, include_backup=args.include_backup)
    write_csv(rows, args.output_csv)
    print(f"Wrote {len(rows)} rows to {args.output_csv}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
