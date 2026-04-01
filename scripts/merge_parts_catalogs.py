#!/usr/bin/env python3
"""
merge_parts_catalogs.py

Combines data from three source CSV files into a single, comprehensive
parts catalog with standardized columns.

Source files:
  - scraped_results/Level5/level5_parts_catalog.csv
  - scraped_results/TapeTech/TapeTech_parts_catalog.csv
  - parts_catalog.csv  (multi-brand enriched catalog with images/URLs)

Output:
  - combined_parts_catalog.csv
"""

import csv
import os
import sys

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
REPO_ROOT = os.path.dirname(SCRIPT_DIR)

LEVEL5_CSV = os.path.join(REPO_ROOT, "scraped_results", "Level5", "level5_parts_catalog.csv")
TAPETECH_CSV = os.path.join(REPO_ROOT, "scraped_results", "TapeTech", "TapeTech_parts_catalog.csv")
PARTS_CATALOG_CSV = os.path.join(REPO_ROOT, "parts_catalog.csv")
OUTPUT_CSV = os.path.join(REPO_ROOT, "combined_parts_catalog.csv")

# ---------------------------------------------------------------------------
# Brand allow-list.  Only parts whose brand normalises to one of these values
# will appear in the output.  Matching is case-insensitive; canonical spellings
# are the keys used in the output rows.
# ---------------------------------------------------------------------------
# Mapping: lowercased input variant -> canonical output brand name
BRAND_CANONICAL = {
    "tapetech": "TapeTech",
    "columbia": "Columbia",
    "columbia taping tools": "Columbia",
    "level5": "Level5",
    "level 5": "Level5",
    "graco": "Graco",
    "asgard": "Asgard",
}

# ---------------------------------------------------------------------------
# Output column headers (exact order and names required)
# ---------------------------------------------------------------------------
OUTPUT_HEADERS = [
    "brand",
    "part_name",
    "sku",
    "description",
    "price",
    "schematic_diagram",
    "hotspot_id",
    "image_urls",
]


def open_csv(path):
    """Open a CSV file with UTF-8-sig encoding and error replacement."""
    return open(path, encoding="utf-8-sig", errors="replace", newline="")


def normalize_sku(sku):
    """
    Return a normalised key for SKU matching.
    Strips whitespace; for all-numeric strings removes leading zeros so
    that '050003' and '50003' compare equal.
    """
    s = sku.strip().upper()
    if s.isdigit():
        return s.lstrip("0") or "0"
    return s


def clean_price(price_str):
    """Normalise price strings; return 'N/A' when unavailable."""
    s = price_str.strip() if price_str else ""
    if not s or s.lower() in ("not available", "n/a", "-", "none"):
        return "N/A"
    return s


def pc_val(row, key):
    """Return stripped value from a parts-catalog row dict, or empty string."""
    if row is None:
        return ""
    return row.get(key, "").strip()


def normalize_brand(brand_str):
    """
    Return the canonical brand name if the input is in the allow-list, else None.
    """
    return BRAND_CANONICAL.get(brand_str.strip().lower())


def make_row(brand="", part_name="", sku="", description="", price="",
             schematic_diagram="", schematic_label_id="", image_urls=""):
    """Return a dict keyed by OUTPUT_HEADERS."""
    return {
        "brand": brand or "N/A",
        "part_name": part_name or "N/A",
        "sku": sku or "N/A",
        "description": description or "",
        "price": price or "N/A",
        "schematic_diagram": schematic_diagram or "",
        "hotspot_id": schematic_label_id or "",
        "image_urls": image_urls or "",
    }


# ---------------------------------------------------------------------------
# 1. Load the multi-brand enriched catalog (parts_catalog.csv)
#    Key by normalised SKU for fast lookup.
# ---------------------------------------------------------------------------
def load_parts_catalog():
    """
    Returns:
      pc_by_norm_sku  – dict: normalised_sku -> row dict
      pc_all_rows     – list of all row dicts (original, with 'norm_sku' added)
    """
    pc_by_norm_sku = {}
    pc_all_rows = []
    with open_csv(PARTS_CATALOG_CSV) as f:
        for row in csv.DictReader(f):
            sku = row.get("SKU", "").strip()
            norm = normalize_sku(sku)
            row["norm_sku"] = norm
            # Keep the first occurrence for a given normalised SKU
            if norm not in pc_by_norm_sku:
                pc_by_norm_sku[norm] = row
            pc_all_rows.append(row)
    return pc_by_norm_sku, pc_all_rows


# ---------------------------------------------------------------------------
# 2. Process TapeTech parts from TapeTech_parts_catalog.csv,
#    enriched with data from parts_catalog.csv where available.
#    Parts that appear in multiple tools are consolidated into one row with
#    semicolon-separated schematic references.
# ---------------------------------------------------------------------------
def process_tapetech(pc_by_norm_sku):
    """
    Returns:
      rows        – list of output row dicts (one row per unique Part Label ID)
      seen_norms  – set of normalised SKUs already emitted
    """
    # Group TapeTech rows by Part Label ID so that a part used in multiple
    # tools is consolidated into a single catalog entry.
    grouped = {}  # part_label_id -> list of source rows
    with open_csv(TAPETECH_CSV) as f:
        for src in csv.DictReader(f):
            part_label_id = src.get("Part Label ID", "").strip()
            if part_label_id not in grouped:
                grouped[part_label_id] = []
            grouped[part_label_id].append(src)

    rows = []
    seen_norms = set()

    for part_label_id, src_list in grouped.items():
        # Collect unique tool names (preserve order)
        tool_names = []
        seen_tools = set()
        sold_as_values = []
        part_name_tt = ""
        brand = "TapeTech"
        for src in src_list:
            tool = src.get("Tool Name", "").strip()
            if tool and tool not in seen_tools:
                tool_names.append(tool)
                seen_tools.add(tool)
            sa = src.get("Sold As Part Of", "").strip()
            if sa and sa not in sold_as_values:
                sold_as_values.append(sa)
            if not part_name_tt:
                part_name_tt = src.get("Part Name", "").strip()
            b = src.get("Brand", "").strip()
            if b:
                brand = b

        norm = normalize_sku(part_label_id)

        # Enrich from parts_catalog if available
        pc = pc_by_norm_sku.get(norm)
        part_name = pc_val(pc, "Part Name") or part_name_tt
        description = pc_val(pc, "Description")
        if sold_as_values:
            desc_extra = "Sold As Part Of: " + "; ".join(sold_as_values)
            description = f"{description}; {desc_extra}".lstrip("; ") if description else desc_extra
        images = pc_val(pc, "Images")

        rows.append(make_row(
            brand=brand,
            part_name=part_name,
            sku=part_label_id,
            description=description,
            price="N/A",          # no price in TapeTech source files
            schematic_diagram="; ".join(tool_names),
            schematic_label_id=part_label_id,   # per problem statement
            image_urls=images,
        ))
        seen_norms.add(norm)

    return rows, seen_norms


# ---------------------------------------------------------------------------
# 3. Process Level5 parts from level5_parts_catalog.csv.
#    Parts appearing in multiple schematic diagrams are consolidated into one
#    row; schematic references are paired as "label @ diagram.pdf".
# ---------------------------------------------------------------------------
def process_level5(pc_by_norm_sku):
    """
    Returns:
      rows       – list of output row dicts (one row per unique SKU)
      seen_norms – set of normalised SKUs already emitted
    """
    # Group by SKU; rows with a blank SKU are kept individually (they are
    # distinct parts that happen to lack a catalogue number in the source data).
    grouped = {}  # key -> list of source rows
    import itertools
    _blank_counter = itertools.count(1)
    with open_csv(LEVEL5_CSV) as f:
        for src in csv.DictReader(f):
            sku = src.get("PARTS SKU (PART)", "").strip()
            if sku:
                key = sku
            else:
                # Synthetic key to keep this row distinct
                key = f"__blank_{next(_blank_counter)}__"
            if key not in grouped:
                grouped[key] = []
            grouped[key].append(src)

    rows = []
    seen_norms = set()

    for key, src_list in grouped.items():
        # Resolve the real SKU (blank if this is a synthetic-key entry)
        sku = key if not key.startswith("__blank_") else ""
        # Build ordered, de-duplicated schematic references
        diagram_refs = []   # "diagram.pdf"
        label_refs = []     # "label @ diagram.pdf"
        seen_diagram_label = set()
        part_name = ""
        price = "N/A"
        for src in src_list:
            diagram = src.get("Diagram File Name", "").strip()
            label_id = src.get("LABEL NUMBER ON SCHEMATIC DIAGRAM (#)", "").strip()
            ref_key = (diagram, label_id)
            if ref_key not in seen_diagram_label:
                seen_diagram_label.add(ref_key)
                if diagram not in diagram_refs:
                    diagram_refs.append(diagram)
                label_refs.append(f"{label_id} @ {diagram}" if diagram else label_id)
            if not part_name:
                part_name = src.get("PARTS NAME (DESCRIPTION)", "").strip()
            if price == "N/A":
                price = clean_price(src.get("PRICE", ""))

        norm = normalize_sku(sku) if sku else ""

        # Enrich from parts_catalog if available (Level 5 brand entries)
        pc = pc_by_norm_sku.get(norm) if norm else None
        description = pc_val(pc, "Description")
        images = pc_val(pc, "Images")

        rows.append(make_row(
            brand="Level5",
            part_name=part_name,
            sku=sku,
            description=description or part_name,
            price=price,
            schematic_diagram="; ".join(diagram_refs),
            schematic_label_id="; ".join(label_refs),
            image_urls=images,
        ))
        # Only track non-empty norms to avoid false collision on blank SKUs
        if norm:
            seen_norms.add(norm)

    return rows, seen_norms


# ---------------------------------------------------------------------------
# 4. Include all remaining parts_catalog.csv entries not yet covered
#    (non-TapeTech, non-Level5, and any TapeTech/Level5 rows without a
#    schematic counterpart).
# ---------------------------------------------------------------------------
def process_remaining_pc(pc_all_rows, already_seen_norms):
    """
    Returns list of output row dicts for rows not already in already_seen_norms.
    """
    rows = []
    seen_in_this_pass = set()

    for src in pc_all_rows:
        norm = src["norm_sku"]
        if norm in already_seen_norms or norm in seen_in_this_pass:
            continue
        seen_in_this_pass.add(norm)

        brand = src.get("Brand", "").strip()
        canonical = normalize_brand(brand)
        if canonical is None:
            # Brand not in the allow-list – skip this row
            continue
        brand = canonical
        part_name = src.get("Part Name", "").strip()
        sku = src.get("SKU", "").strip()
        description = src.get("Description", "").strip()
        images = src.get("Images", "").strip()
        # Product URL appended to images field when no dedicated column exists
        product_url = src.get("Product URL", "").strip()
        combined_urls = "; ".join(filter(None, [images, product_url]))

        rows.append(make_row(
            brand=brand,
            part_name=part_name,
            sku=sku,
            description=description,
            price="N/A",
            schematic_diagram="",
            schematic_label_id="",
            image_urls=combined_urls,
        ))

    return rows


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
def main():
    print("Loading parts_catalog.csv …")
    pc_by_norm_sku, pc_all_rows = load_parts_catalog()
    print(f"  {len(pc_all_rows)} rows loaded ({len(pc_by_norm_sku)} unique SKUs)")

    print("Processing TapeTech parts …")
    tt_rows, tt_seen = process_tapetech(pc_by_norm_sku)
    print(f"  {len(tt_rows)} TapeTech rows")

    print("Processing Level5 parts …")
    l5_rows, l5_seen = process_level5(pc_by_norm_sku)
    print(f"  {len(l5_rows)} Level5 rows")

    all_seen = tt_seen | l5_seen

    print("Processing remaining parts_catalog entries …")
    rem_rows = process_remaining_pc(pc_all_rows, all_seen)
    print(f"  {len(rem_rows)} additional rows from parts_catalog")

    combined = tt_rows + l5_rows + rem_rows
    print(f"\nTotal combined rows: {len(combined)}")
    print(f"Brands retained: {', '.join(sorted(set(BRAND_CANONICAL.values())))}")

    print(f"Writing output to {OUTPUT_CSV} …")
    with open(OUTPUT_CSV, "w", encoding="utf-8", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=OUTPUT_HEADERS, quoting=csv.QUOTE_ALL)
        writer.writeheader()
        writer.writerows(combined)

    print("Done.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
