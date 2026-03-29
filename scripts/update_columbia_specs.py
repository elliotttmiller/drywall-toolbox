#!/usr/bin/env python3
"""
Data audit script: cross-references columbia_tool_specifications.csv with
products_catalog.csv and updates specification fields in description_full
for matched Columbia Taping Tools products.

Usage:
    python3 scripts/update_columbia_specs.py
"""

import csv
import codecs
import json
import os
import re
import sys

# File paths relative to repository root
REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SPECS_FILE = os.path.join(REPO_ROOT, "public", "columbia_tool_specifications.csv")
CATALOG_FILE = os.path.join(REPO_ROOT, "public", "products_catalog.csv")
SUMMARY_FILE = os.path.join(REPO_ROOT, "public", "columbia_specs_update_summary.json")

# Mapping from spec CSV field names to display names in the Technical Specs table
SPEC_FIELD_DISPLAY = {
    "Dimensions (L x W x H) / Size": "Dimensions",
    "Weight": "Weight",
    "Materials": "Materials",
    "Key Technical Specifications": "Key Technical Specifications",
    "Replacement Parts SKUs": "Replacement Parts",
}


def clean_sku(raw: str) -> str:
    """Strip whitespace and surrounding quote marks from a raw SKU value."""
    return raw.strip().strip('"').strip()


def is_sku_column(raw: str) -> bool:
    """
    Return True if the raw column value looks like a SKU identifier.

    SKUs are short alphanumeric codes (with optional hyphens, dots, inch marks).
    They are NOT regular English words, N/A values, approximate sizes, or
    parenthetical notations.
    """
    cleaned = clean_sku(raw)
    if not cleaned or " " in cleaned:
        return False
    # N/A and slash-containing values are not SKUs
    if "/" in cleaned:
        return False
    # Approximate values starting with ~ (e.g., ~19", ~0.5 lbs)
    if cleaned.startswith("~"):
        return False
    # Parenthetical notations like (Various)
    if cleaned.startswith("(") and cleaned.endswith(")"):
        return False
    # Title-case English words (Fixed, Standard, Extended, Aluminum, Varies, etc.)
    # Pattern: one capital letter followed by two or more lowercase letters only
    if re.match(r"^[A-Z][a-z]{2,}$", cleaned):
        return False
    return True


def join_replacement_parts(cols: list) -> str:
    """
    Join replacement-parts columns that were split by the CSV parser because
    the original field contained unquoted commas.
    Each column may have a leading ' "' artifact from the original CSV.
    """
    parts = []
    for col in cols:
        # Remove leading whitespace and stray opening quote
        cleaned = col.strip().lstrip('"').strip()
        # Remove trailing stray quote if present at end without closing paren
        # e.g. 'CTR-42A" (Blades)' → keep as-is (the " is an inch indicator)
        if cleaned:
            parts.append(cleaned)
    return ", ".join(parts)


def parse_specs_csv(filepath: str) -> dict:
    """
    Parse the columbia_tool_specifications.csv file, which has malformed CSV
    due to multi-SKU rows and unquoted commas in the Replacement Parts field.

    Returns a dict mapping each individual SKU (uppercase) to a dict of spec fields:
        {
            "category": str,
            "product_name": str,
            "dimensions": str,
            "weight": str,
            "materials": str,
            "key_specs": str,
            "replacement_parts": str,
        }
    """
    specs_by_sku = {}

    with codecs.open(filepath, "r", "utf-8-sig") as f:
        reader = csv.reader(f)
        _headers = next(reader)  # skip header row

        for raw_row in reader:
            if not raw_row or not any(raw_row):
                continue

            # Columns 0,1 are always Category and Product Name
            category = raw_row[0].strip()
            product_name = raw_row[1].strip()

            # Columns from index 2 onward: scan for SKUs until we hit the
            # Dimensions field (first column that contains a space after cleaning).
            skus = []
            spec_start = len(raw_row)  # fallback

            for i in range(2, len(raw_row)):
                if is_sku_column(raw_row[i]):
                    skus.append(clean_sku(raw_row[i]))
                else:
                    spec_start = i
                    break

            if spec_start >= len(raw_row):
                # All remaining columns looked like SKUs — skip malformed row
                continue

            # After the SKU columns: Dimensions, Weight, Materials, Key Specs,
            # then zero-or-more Replacement Parts columns
            remaining = raw_row[spec_start:]
            dimensions = remaining[0].strip() if len(remaining) > 0 else ""
            weight = remaining[1].strip() if len(remaining) > 1 else ""
            materials = remaining[2].strip() if len(remaining) > 2 else ""
            key_specs = remaining[3].strip() if len(remaining) > 3 else ""
            replacement_parts = (
                join_replacement_parts(remaining[4:]) if len(remaining) > 4 else ""
            )

            spec_data = {
                "category": category,
                "product_name": product_name,
                "dimensions": dimensions,
                "weight": weight,
                "materials": materials,
                "key_specs": key_specs,
                "replacement_parts": replacement_parts,
            }

            for sku in skus:
                if sku:
                    # Normalize SKU to uppercase for consistent lookup
                    specs_by_sku[sku.upper()] = spec_data

    return specs_by_sku


def detect_table_separator(table_block: str) -> str:
    """Detect whether the table uses '|---|---|' or '| :--- | :--- |' style."""
    for line in table_block.splitlines():
        stripped = line.strip()
        if stripped.startswith("|") and ("---" in stripped):
            return stripped
    return "|---|---|"


def parse_markdown_table(table_block: str) -> tuple:
    """
    Parse a markdown table block, returning:
      (header_line, separator_line, rows)
    where rows is a list of (key, value) tuples.
    """
    lines = [l for l in table_block.splitlines() if l.strip()]
    if len(lines) < 2:
        return None, None, []

    header_line = lines[0]
    separator_line = lines[1]
    rows = []
    for line in lines[2:]:
        stripped = line.strip()
        if not stripped.startswith("|"):
            break
        parts = [p.strip() for p in stripped.strip("|").split("|")]
        if len(parts) >= 2:
            key = parts[0].strip("* ")
            value = parts[1].strip()
            rows.append((key, value))

    return header_line, separator_line, rows


def build_table_row(key: str, value: str, separator_line: str) -> str:
    """Build a single markdown table row, bold-formatting the key."""
    if ":---" in separator_line:
        return f"| **{key}** | {value} |"
    else:
        return f"| **{key}** | {value} |"


def update_tech_specs_table(
    description: str, spec_data: dict
) -> tuple:
    """
    Find the '## Technical Specifications' section in description and update
    the table within it by adding or updating rows for:
      - Dimensions
      - Weight
      - Materials
      - Key Technical Specifications
      - Replacement Parts

    Returns (updated_description, changes_dict) where changes_dict maps
    field_display_name -> {"old": old_value, "new": new_value}.
    """
    changes = {}

    # Spec fields to add/update (display_name -> new_value)
    spec_updates = {
        "Dimensions": spec_data["dimensions"],
        "Weight": spec_data["weight"],
        "Materials": spec_data["materials"],
        "Key Technical Specifications": spec_data["key_specs"],
        "Replacement Parts": spec_data["replacement_parts"],
    }

    # Remove entries with empty values or N/A
    spec_updates = {k: v for k, v in spec_updates.items() if v and v.upper() != "N/A"}

    if not spec_updates:
        return description, changes

    # Find the Technical Specifications section
    section_marker = "## Technical Specifications"
    section_pos = description.find(section_marker)

    if section_pos < 0:
        # No existing section — append one at the end
        new_section = f"\n\n{section_marker}\n\n| Specification | Detail |\n|---|---|\n"
        for display_name, new_value in spec_updates.items():
            new_section += f"| **{display_name}** | {new_value} |\n"
            changes[display_name] = {"old": None, "new": new_value}
        return description.rstrip() + new_section, changes

    # Find the end of the section (next ## heading or end of string)
    next_section_match = re.search(
        r"\n##\s", description[section_pos + len(section_marker):]
    )
    if next_section_match:
        section_end = section_pos + len(section_marker) + next_section_match.start()
    else:
        section_end = len(description)

    section_text = description[section_pos:section_end]
    before_section = description[:section_pos]
    after_section = description[section_end:]

    # Parse the existing table within the section
    _header, separator_line, existing_rows = parse_markdown_table(
        "\n".join(
            line for line in section_text.splitlines()
            if line.strip().startswith("|")
        )
    )

    if separator_line is None:
        separator_line = "|---|---|"

    # Build a dict of existing rows (key lowercase -> (original_key, value, index))
    existing_map = {}
    for idx, (k, v) in enumerate(existing_rows):
        existing_map[k.lower()] = (k, v, idx)

    # Determine which rows need updating vs adding
    updated_rows = list(existing_rows)  # mutable copy

    for display_name, new_value in spec_updates.items():
        key_lower = display_name.lower()
        if key_lower in existing_map:
            orig_key, old_value, idx = existing_map[key_lower]
            if old_value != new_value:
                updated_rows[idx] = (orig_key, new_value)
                changes[display_name] = {"old": old_value, "new": new_value}
        else:
            # Check for partial key matches (e.g., "Overall Length" for "Dimensions")
            partial_match_keys = {
                "dimensions": ["overall length", "dimensions", "size", "length", "width"],
                "weight": ["weight"],
                "materials": ["materials", "construction", "material"],
                "key technical specifications": ["key technical", "key specs"],
                "replacement parts": ["replacement parts", "compatible parts", "spare parts"],
            }
            partial_keys = partial_match_keys.get(key_lower, [])
            found_partial = False
            for pm_key in partial_keys:
                if pm_key in existing_map:
                    orig_key, old_value, idx = existing_map[pm_key]
                    if old_value != new_value:
                        updated_rows[idx] = (orig_key, new_value)
                        changes[display_name] = {"old": old_value, "new": new_value}
                    found_partial = True
                    break
            if not found_partial:
                # Append new row
                updated_rows.append((display_name, new_value))
                changes[display_name] = {"old": None, "new": new_value}

    if not changes:
        return description, changes

    # Rebuild the section with updated table
    # Find table header line from original section
    table_lines = [
        line for line in section_text.splitlines() if line.strip().startswith("|")
    ]
    header_line = table_lines[0] if table_lines else "| Specification | Detail |"

    new_table = header_line + "\n" + separator_line + "\n"
    for k, v in updated_rows:
        new_table += f"| **{k}** | {v} |\n"

    # Reconstruct the section: keep any non-table, non-marker content before the table
    # Skip the section_marker line itself and collect only content between the marker
    # and the table (e.g., introductory prose lines).
    pre_table = []
    section_lines = section_text.splitlines()
    # Skip the section_marker line (index 0)
    for line in section_lines[1:]:
        if line.strip().startswith("|"):
            break
        pre_table.append(line)

    pre_table_text = "\n".join(pre_table)
    if pre_table_text.strip():
        pre_table_text = pre_table_text.rstrip() + "\n"
    else:
        pre_table_text = "\n"

    new_section = section_marker + "\n" + pre_table_text + new_table

    updated_description = before_section + new_section + after_section
    return updated_description, changes


def main():
    # --- Parse specs ---
    print(f"Loading specs from: {SPECS_FILE}")
    specs_by_sku = parse_specs_csv(SPECS_FILE)
    unique_families = len({id(v) for v in specs_by_sku.values()})
    print(f"  Loaded specs for {unique_families} product families "
          f"({len(specs_by_sku)} SKU entries)")

    # --- Load catalog ---
    print(f"Loading catalog from: {CATALOG_FILE}")
    catalog_rows = []
    with open(CATALOG_FILE, newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        fieldnames = reader.fieldnames
        for row in reader:
            catalog_rows.append(dict(row))
    print(f"  Loaded {len(catalog_rows)} catalog rows")

    # --- Process each Columbia product ---
    summary = {
        "updated_products": [],
        "matched_skus": [],
        "unmatched_spec_skus": [],
    }

    update_count = 0
    for row in catalog_rows:
        brand = row.get("brand", "").strip().lower()
        if brand != "columbia taping tools":
            continue

        sku = row.get("sku", "").strip()
        if not sku:
            continue

        # Normalize SKU to uppercase for consistent lookup
        spec_data = specs_by_sku.get(sku.upper())
        if spec_data is None:
            continue

        summary["matched_skus"].append(sku)

        original_desc = row.get("description_full", "")
        updated_desc, changes = update_tech_specs_table(original_desc, spec_data)

        if changes:
            row["description_full"] = updated_desc
            update_count += 1
            summary["updated_products"].append({
                "sku": sku,
                "name": row.get("name", ""),
                "changes": changes,
            })
            print(f"  Updated SKU={sku} | Fields changed: {list(changes.keys())}")

    # Find spec SKUs that had no match in the catalog
    # All keys in specs_by_sku are already uppercase-normalized
    all_catalog_columbia_skus_upper = {
        row.get("sku", "").strip().upper()
        for row in catalog_rows
        if row.get("brand", "").strip().lower() == "columbia taping tools"
    }
    matched_set_upper = {s.upper() for s in summary["matched_skus"]}
    for sku in specs_by_sku:
        if sku not in matched_set_upper and sku not in all_catalog_columbia_skus_upper:
            if sku not in summary["unmatched_spec_skus"]:
                summary["unmatched_spec_skus"].append(sku)

    # --- Write updated catalog ---
    print(f"\nWriting updated catalog to: {CATALOG_FILE}")
    with open(CATALOG_FILE, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(catalog_rows)

    # --- Write summary ---
    print(f"Writing summary to: {SUMMARY_FILE}")
    with open(SUMMARY_FILE, "w", encoding="utf-8") as f:
        json.dump(summary, f, indent=2, ensure_ascii=False)

    print(f"\n=== Summary ===")
    print(f"  Products with specification updates: {update_count}")
    print(f"  Total matched SKUs: {len(summary['matched_skus'])}")
    print(f"  Spec SKUs with no catalog match: {len(summary['unmatched_spec_skus'])}")
    print(f"  Unmatched spec SKUs: {summary['unmatched_spec_skus']}")

    return 0


if __name__ == "__main__":
    sys.exit(main())
