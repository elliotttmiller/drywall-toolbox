"""enrich_wc_catalog_with_parts.py

Adds individual replacement-part entries to the official WooCommerce catalog
for Columbia and Level 5.

Columbia source:
  - frontend/public/brands/Columbia/Schematics/**/schematic_data*.json
    (part `id` field = the Columbia part number / SKU)
  - products/Production/reports/columbia_repair_parts_live_raw.csv
    (enrichment: price, variant title from live CSR scrape)

Level 5 source:
  - products/scraped_results/Level5/level5_schematics_manifest.csv
    (part_number, description, price_display, group_name)

Usage:
  python scripts/enrich_wc_catalog_with_parts.py            # dry-run, prints summary
  python scripts/enrich_wc_catalog_with_parts.py --apply    # writes to catalog CSV
"""
from __future__ import annotations

import argparse
import csv
import json
import re
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------
REPO_ROOT = Path(__file__).resolve().parents[1]
WC_PATH = REPO_ROOT / "products" / "Production" / "catalogs" / "official" / "woocommerce_catalog.csv"
COLUMBIA_SCHEMATICS = REPO_ROOT / "frontend" / "public" / "brands" / "Columbia" / "Schematics"
COLUMBIA_LIVE_RAW = REPO_ROOT / "products" / "Production" / "reports" / "columbia_repair_parts_live_raw.csv"
LEVEL5_MANIFEST = REPO_ROOT / "products" / "scraped_results" / "Level5" / "level5_schematics_manifest.csv"
REPORTS_DIR = REPO_ROOT / "products" / "Production" / "reports"
SUMMARY_PATH = REPORTS_DIR / "enrich_wc_catalog_parts_summary.json"

# ---------------------------------------------------------------------------
# WooCommerce CSV column order (must match existing catalog)
# ---------------------------------------------------------------------------
WC_FIELDNAMES = [
    "Type",
    "SKU",
    "GTIN, UPC, EAN, or ISBN",
    "Name",
    "Published",
    "Is featured?",
    "Visibility in catalog",
    "Short description",
    "Description",
    "Date sale price starts",
    "Date sale price ends",
    "Tax status",
    "Tax class",
    "In stock?",
    "Stock",
    "Low stock amount",
    "Backorders allowed?",
    "Sold individually?",
    "Weight (lbs)",
    "Length (in)",
    "Width (in)",
    "Height (in)",
    "Allow customer reviews?",
    "Purchase note",
    "Sale price",
    "Regular price",
    "Categories",
    "Tags",
    "Shipping class",
    "Images",
    "Download limit",
    "Download expiry days",
    "Parent",
    "Grouped products",
    "Upsells",
    "Cross-sells",
    "External URL",
    "Button text",
    "Position",
    "Brands",
    "Attribute 1 name",
    "Attribute 1 value(s)",
    "Attribute 1 visible",
    "Attribute 1 used for variations",
    "Attribute 1 global",
    "Attribute 2 name",
    "Attribute 2 value(s)",
    "Attribute 2 visible",
    "Attribute 2 used for variations",
    "Attribute 2 global",
    "Attribute 3 name",
    "Attribute 3 value(s)",
    "Attribute 3 visible",
    "Attribute 3 used for variations",
    "Attribute 3 global",
    "Meta: _mpn",
]


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def clean(value: str | None) -> str:
    return " ".join((value or "").replace("\xa0", " ").replace("\ufeff", " ").split()).strip()


def clean_quotes(value: str) -> str:
    return value.replace("\u201c", '"').replace("\u201d", '"').replace("\u2018", "'").replace("\u2019", "'")


def to_sku(raw_id: str) -> str:
    """Convert a part `id` (which may have spaces/special chars) to a clean SKU."""
    s = clean(raw_id)
    s = clean_quotes(s)
    # Replace inch mark variants
    s = re.sub(r'["\u201c\u201d]', "in", s)
    s = re.sub(r"['\u2018\u2019]", "", s)
    # Spaces → hyphens
    s = re.sub(r"\s+", "-", s)
    # Collapse multiple hyphens
    s = re.sub(r"-{2,}", "-", s)
    s = s.strip("-")
    return s


def normalize_sku_for_lookup(value: str) -> str:
    """Normalize a SKU for deduplication matching (same logic as normalize_schematic script)."""
    text = clean(value).upper()
    text = re.sub(r'["\u201c\u201d\u2018\u2019\'\\]', "", text)
    text = re.sub(r"\s+", "", text)
    text = text.replace("_", "").replace("-", "").replace("/", "")
    return text


def blank_row() -> dict[str, str]:
    return {f: "" for f in WC_FIELDNAMES}


def parse_price(price_display: str) -> str:
    """Extract numeric price from strings like '$3.14' or '$0' or empty."""
    text = clean(price_display).replace("$", "").replace(",", "")
    try:
        val = float(text)
        if val <= 0:
            return ""
        return f"{val:.2f}".rstrip("0").rstrip(".")
    except ValueError:
        return ""


def is_columbia_parts_row(row: dict[str, str]) -> bool:
    return (
        clean(row.get("Brands", "")) == "Columbia"
        and "Parts" in clean(row.get("Categories", ""))
    )


def is_level5_parts_row(row: dict[str, str]) -> bool:
    return (
        clean(row.get("Brands", "")) == "Level 5"
        and "Parts" in clean(row.get("Categories", ""))
    )


# ---------------------------------------------------------------------------
# Load existing WC catalog
# ---------------------------------------------------------------------------

def load_wc_catalog() -> tuple[list[str], list[dict[str, str]]]:
    with WC_PATH.open("r", encoding="utf-8-sig", newline="") as fh:
        reader = csv.DictReader(fh)
        fieldnames = list(reader.fieldnames or WC_FIELDNAMES)
        rows = list(reader)
    return fieldnames, rows


def write_wc_catalog(fieldnames: list[str], rows: list[dict[str, str]]) -> None:
    with WC_PATH.open("w", encoding="utf-8-sig", newline="") as fh:
        writer = csv.DictWriter(fh, fieldnames=fieldnames, extrasaction="ignore", quoting=csv.QUOTE_ALL)
        writer.writeheader()
        writer.writerows(rows)


def backup_catalog() -> Path:
    ts = datetime.now(timezone.utc).strftime("%Y%m%d-%H%M%S")
    backup = WC_PATH.with_name(f"{WC_PATH.stem}.pre-enrich-parts-{ts}{WC_PATH.suffix}")
    backup.write_bytes(WC_PATH.read_bytes())
    return backup


# ---------------------------------------------------------------------------
# COLUMBIA: collect missing parts
# ---------------------------------------------------------------------------

def _load_columbia_live_raw() -> dict[str, dict[str, str]]:
    """Return MPN → best live_raw row (exact match, then normalized)."""
    if not COLUMBIA_LIVE_RAW.exists():
        return {}
    with COLUMBIA_LIVE_RAW.open("r", encoding="utf-8-sig", newline="") as fh:
        rows = list(csv.DictReader(fh))
    index: dict[str, dict[str, str]] = {}
    norm_index: dict[str, dict[str, str]] = {}
    for r in rows:
        mpn = clean(r.get("variant_mpn", ""))
        if not mpn:
            continue
        if mpn not in index:
            index[mpn] = r
        n = normalize_sku_for_lookup(mpn)
        if n not in norm_index:
            norm_index[n] = r
    return index, norm_index  # type: ignore[return-value]


def _columbia_tags(schematic_path: Path) -> str:
    """Derive Columbia repair-parts tag string from schematic directory."""
    try:
        top = schematic_path.relative_to(COLUMBIA_SCHEMATICS).parts[0]
    except (ValueError, IndexError):
        top = ""
    tag_map = {
        "AutomaticTapers": "Columbia Automatic Taper Repair Parts",
        "Angleheads": "Columbia Angle Head Repair Parts",
        "FinishingBoxes": "Columbia Finishing Box Repair Parts",
        "CornerFlushers": "Columbia Corner Flusher Repair Parts",
        "CornerBoxes": "Columbia Corner Box Repair Parts",
        "CornerRollers": "Columbia Corner Roller Repair Parts",
        "Handles": "Columbia Handle Repair Parts",
        "Nailspotters": "Columbia Nailspotter Repair Parts",
        "Pumps": "Columbia Pump Repair Parts",
        "SemiAutomaticTapers": "Columbia Semi-Automatic Taper Repair Parts",
        "Applicators": "Columbia Applicator Repair Parts",
        "CompoundTubes": "Columbia Compound Tube Repair Parts",
        "Sanders": "Columbia Sander Repair Parts",
        "SmoothingBlades": "Columbia Smoothing Blade Repair Parts",
    }
    label = tag_map.get(top, "Columbia Repair Parts")
    return f"Columbia, {label}, Parts, Repair Parts"


def collect_columbia_missing(
    existing_skus: set[str],
    existing_norm: dict[str, str],
) -> list[dict[str, Any]]:
    """
    Walk all Columbia schematic files. For each part whose `id` is not already
    in the WC catalog (exact or normalized), create a candidate WC row dict.

    Deduplication strategy:
      - Prefer `source_sku` (the canonical Columbia part number) as the WC SKU
        when it is a clean string without spaces or special characters.
      - Fall back to to_sku(id) otherwise.
      - Deduplicate by normalized form so that "CF1B" and "CF 1B" (same part,
        different schematic formatting) don't produce two catalog entries.
    """
    live_exact, live_norm = _load_columbia_live_raw()

    # normalized_sku → best candidate info (dedup key)
    candidates: dict[str, dict[str, Any]] = {}

    for sch_file in sorted(COLUMBIA_SCHEMATICS.rglob("schematic_data*.json")):
        data = json.loads(sch_file.read_text(encoding="utf-8"))
        for part in data.get("parts") or []:
            raw_id = clean(str(part.get("id") or ""))
            if not raw_id:
                continue

            # Prefer source_sku as the SKU when it's a clean part number
            raw_source_sku = clean(str(part.get("source_sku") or ""))
            if raw_source_sku and " " not in raw_source_sku:
                sku = raw_source_sku
            else:
                sku = to_sku(raw_id)
            if not sku:
                continue

            # Skip if already in WC (exact or normalized)
            if sku in existing_skus:
                continue
            sku_norm = normalize_sku_for_lookup(sku)
            if sku_norm in existing_norm:
                continue

            # Deduplicate by normalized form (e.g. "CF1B" and "CF-1B" → same)
            if sku_norm in candidates:
                continue

            # Part name: prefer live_raw title, else schematic name
            part_name_raw = clean(str(part.get("name") or ""))
            live_row = live_exact.get(raw_source_sku or raw_id) or live_norm.get(
                normalize_sku_for_lookup(raw_source_sku or raw_id)
            )

            if live_row:
                name = clean(live_row.get("variant_title", "")) or part_name_raw or sku
                price = clean(live_row.get("price", ""))
                description_html = clean(live_row.get("description_html", ""))
                short_desc = clean(live_row.get("short_description", ""))
            else:
                name = part_name_raw or sku
                price = ""
                description_html = ""
                short_desc = ""

            candidates[sku_norm] = {
                "sku": sku,
                "raw_id": raw_id,
                "name": name,
                "price": price,
                "description_html": description_html,
                "short_description": short_desc,
                "tags": _columbia_tags(sch_file),
                "has_live_data": live_row is not None,
            }

    return list(candidates.values())


def build_columbia_wc_row(info: dict[str, Any]) -> dict[str, str]:
    row = blank_row()
    sku = info["sku"]
    name = info["name"] or f"Columbia Part {sku}"
    row.update(
        {
            "Type": "simple",
            "SKU": sku,
            "Name": name,
            "Published": "1",
            "Is featured?": "0",
            "Visibility in catalog": "visible",
            "Short description": info.get("short_description", ""),
            "Description": info.get("description_html", ""),
            "Tax status": "taxable",
            "In stock?": "1",
            "Backorders allowed?": "0",
            "Sold individually?": "0",
            "Weight (lbs)": "0.02",
            "Allow customer reviews?": "1",
            "Regular price": info.get("price", ""),
            "Categories": "Drywall Finishing Tools > Columbia > Parts",
            "Tags": info.get("tags", "Columbia, Parts, Repair Parts"),
            "Position": "0",
            "Brands": "Columbia",
            "Meta: _mpn": info["raw_id"],
        }
    )
    return row


# ---------------------------------------------------------------------------
# LEVEL 5: collect parts from manifest
# ---------------------------------------------------------------------------

_LEVEL5_GROUP_CATEGORY = {
    "Automatic Taper": "Drywall Finishing Tools > Level 5 > Parts",
    "Compound Pump & Accessories": "Drywall Finishing Tools > Level 5 > Parts",
    "Compound Tube": "Drywall Finishing Tools > Level 5 > Parts",
    "Corner Applicators": "Drywall Finishing Tools > Level 5 > Parts",
    "Corner Finishers": "Drywall Finishing Tools > Level 5 > Parts",
    "Corner Roller": "Drywall Finishing Tools > Level 5 > Parts",
    "Flat Boxes": "Drywall Finishing Tools > Level 5 > Parts",
    "MiniShot Compound Tube": "Drywall Finishing Tools > Level 5 > Parts",
    "Nail Spotters": "Drywall Finishing Tools > Level 5 > Parts",
    "Tool Handles": "Drywall Finishing Tools > Level 5 > Parts",
}

_LEVEL5_GROUP_TAGS = {
    "Automatic Taper": "Level 5, Level 5 Automatic Taper Parts, Parts",
    "Compound Pump & Accessories": "Level 5, Level 5 Pump Parts, Parts",
    "Compound Tube": "Level 5, Level 5 Compound Tube Parts, Parts",
    "Corner Applicators": "Level 5, Level 5 Corner Applicator Parts, Parts",
    "Corner Finishers": "Level 5, Level 5 Corner Finisher Parts, Parts",
    "Corner Roller": "Level 5, Level 5 Corner Roller Parts, Parts",
    "Flat Boxes": "Level 5, Level 5 Flat Box Parts, Parts",
    "MiniShot Compound Tube": "Level 5, Level 5 MiniShot Parts, Parts",
    "Nail Spotters": "Level 5, Level 5 Nail Spotter Parts, Parts",
    "Tool Handles": "Level 5, Level 5 Handle Parts, Parts",
}


def collect_level5_missing(
    existing_skus: set[str],
    existing_norm: dict[str, str],
) -> list[dict[str, Any]]:
    """
    Read level5_schematics_manifest.csv. For each unique part_number not
    already in WC catalog, create a candidate row dict.
    """
    if not LEVEL5_MANIFEST.exists():
        return []

    with LEVEL5_MANIFEST.open("r", encoding="utf-8-sig", newline="") as fh:
        rows = list(csv.DictReader(fh))

    candidates: dict[str, dict[str, Any]] = {}

    for r in rows:
        pn = clean(r.get("part_number", ""))
        if not pn:
            continue
        if pn in existing_skus:
            continue
        if normalize_sku_for_lookup(pn) in existing_norm:
            continue
        if pn in candidates:
            continue

        group = clean(r.get("group_name", ""))
        description = clean(r.get("description", ""))
        price = parse_price(r.get("price_display", ""))
        compat_skus = clean(r.get("compatible_skus", ""))

        # Build name: "Level 5 {description}" trimmed
        name = f"Level 5 {description}".strip() if description else f"Level 5 Part {pn}"

        # Build description HTML
        desc_parts: list[str] = []
        if description:
            desc_parts.append(f"<p>{description}</p>")
        if compat_skus:
            desc_parts.append(f"<p>Compatible with: {compat_skus}</p>")
        description_html = " ".join(desc_parts)

        candidates[pn] = {
            "sku": pn,
            "name": name,
            "price": price,
            "description_html": description_html,
            "short_description": description,
            "group": group,
            "compatible_skus": compat_skus,
        }

    return list(candidates.values())


def build_level5_wc_row(info: dict[str, Any]) -> dict[str, str]:
    row = blank_row()
    sku = info["sku"]
    group = info.get("group", "")
    category = _LEVEL5_GROUP_CATEGORY.get(group, "Drywall Finishing Tools > Level 5 > Parts")
    tags = _LEVEL5_GROUP_TAGS.get(group, "Level 5, Level 5 Parts, Parts")
    row.update(
        {
            "Type": "simple",
            "SKU": sku,
            "Name": info["name"],
            "Published": "1",
            "Is featured?": "0",
            "Visibility in catalog": "visible",
            "Short description": info.get("short_description", ""),
            "Description": info.get("description_html", ""),
            "Tax status": "taxable",
            "In stock?": "1",
            "Backorders allowed?": "0",
            "Sold individually?": "0",
            "Weight (lbs)": "",
            "Allow customer reviews?": "1",
            "Regular price": info.get("price", ""),
            "Categories": category,
            "Tags": tags,
            "Position": "0",
            "Brands": "Level 5",
            "Meta: _mpn": sku,
        }
    )
    return row


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def build_existing_index(
    wc_rows: list[dict[str, str]],
) -> tuple[set[str], dict[str, str]]:
    """Return (exact SKU set, normalized-SKU → exact-SKU map)."""
    exact: set[str] = set()
    norm: dict[str, str] = {}
    for r in wc_rows:
        sku = clean(r.get("SKU", ""))
        if sku:
            exact.add(sku)
            n = normalize_sku_for_lookup(sku)
            if n not in norm:
                norm[n] = sku
    return exact, norm


def _insert_after_brand_parts(
    wc_rows: list[dict[str, str]],
    new_rows: list[dict[str, str]],
    brand: str,
) -> list[dict[str, str]]:
    """Insert new_rows after the last existing row for this brand's parts."""
    last_idx = -1
    for i, r in enumerate(wc_rows):
        if clean(r.get("Brands", "")) == brand and "Parts" in clean(r.get("Categories", "")):
            last_idx = i
    insert_at = last_idx + 1 if last_idx >= 0 else len(wc_rows)
    return wc_rows[:insert_at] + new_rows + wc_rows[insert_at:]


def run(apply: bool = False) -> dict[str, Any]:
    fieldnames, wc_rows = load_wc_catalog()
    existing_skus, existing_norm = build_existing_index(wc_rows)

    # --- Columbia ---
    columbia_candidates = collect_columbia_missing(existing_skus, existing_norm)
    columbia_rows = [build_columbia_wc_row(c) for c in columbia_candidates]
    columbia_with_price = sum(1 for c in columbia_candidates if c.get("price"))
    columbia_with_live = sum(1 for c in columbia_candidates if c.get("has_live_data"))

    # --- Level 5 ---
    level5_candidates = collect_level5_missing(existing_skus, existing_norm)
    level5_rows = [build_level5_wc_row(c) for c in level5_candidates]
    level5_with_price = sum(1 for c in level5_candidates if c.get("price"))

    summary: dict[str, Any] = {
        "wc_catalog": str(WC_PATH.relative_to(REPO_ROOT)),
        "existing_sku_count": len(existing_skus),
        "columbia": {
            "new_parts_to_add": len(columbia_rows),
            "with_live_raw_enrichment": columbia_with_live,
            "with_price": columbia_with_price,
        },
        "level5": {
            "new_parts_to_add": len(level5_rows),
            "with_price": level5_with_price,
        },
        "total_new_rows": len(columbia_rows) + len(level5_rows),
        "applied": apply,
    }

    if apply:
        backup_path = backup_catalog()
        summary["backup"] = str(backup_path.relative_to(REPO_ROOT))

        # Insert Columbia new parts after existing Columbia parts section
        updated = _insert_after_brand_parts(wc_rows, columbia_rows, "Columbia")
        # Insert Level 5 new parts after existing Level 5 parts section
        updated = _insert_after_brand_parts(updated, level5_rows, "Level 5")

        write_wc_catalog(fieldnames, updated)
        summary["final_wc_row_count"] = len(updated)
    else:
        print("[DRY RUN] Pass --apply to write changes.")

    REPORTS_DIR.mkdir(parents=True, exist_ok=True)
    SUMMARY_PATH.write_text(json.dumps(summary, indent=2) + "\n", encoding="utf-8")
    return summary


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--apply", action="store_true", help="Write changes to WooCommerce catalog CSV.")
    args = parser.parse_args()
    result = run(apply=args.apply)
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
