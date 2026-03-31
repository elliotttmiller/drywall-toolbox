#!/usr/bin/env python3
"""
extract_tapetech_catalog.py

Reads every filtered PDF in scraped_results/TapeTech/filtered/,
extracts all parts from the legend key table pages, and writes a
comprehensive parts catalog to:

    scraped_results/TapeTech/TapeTech_parts_catalog.csv

CSV columns:
    Part Label ID       – manufacturer part number (e.g. 050003)
    Part Name           – part description (e.g. "Wiper, Control Valve")
    Tool Name           – derived from PDF filename (e.g. "07TT")
    Brand               – always "TapeTech"
    Quantity Each       – quantity per assembly
    Sold As Part Of     – kit/assembly identifier (if listed)

Supported table formats detected in the TapeTech PDFs:
  1. Standard 4-col: Part Number | Description | Quantity Each | Sold as part of:
  2. Standard 3-col: Part Number | Description | Quantity Each
  3. Wide 2-column:  Part Number | Description | Quantity Each | <blank> |
                       Part Number | Description | Quantity Each
  4. P/N 2-column:   P/N | Qty | Description | <blank> | P/N | Qty | Description
"""

import csv
import os
import re

import pdfplumber

FILTERED_DIR = os.path.join(
    os.path.dirname(__file__), "..", "scraped_results", "TapeTech", "filtered"
)
OUTPUT_CSV = os.path.join(
    os.path.dirname(__file__), "..", "scraped_results", "TapeTech",
    "TapeTech_parts_catalog.csv"
)

BRAND = "TapeTech"

CSV_COLUMNS = [
    "Part Label ID",
    "Part Name",
    "Tool Name",
    "Brand",
    "Quantity Each",
    "Sold As Part Of",
]


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def clean(value) -> str:
    """Normalise a cell value to a plain, stripped string."""
    if value is None:
        return ""
    text = str(value)
    # Replace non-breaking spaces, soft hyphens, and other exotic chars
    text = text.replace("\xa0", " ").replace("\xad", "-").replace("\u2011", "-")
    # Collapse internal whitespace/newlines to a single space
    text = re.sub(r"[\r\n\t]+", " ", text)
    text = re.sub(r" {2,}", " ", text)
    return text.strip()


def tool_name_from_filename(fname: str) -> str:
    """Derive the tool/SKU name from a PDF filename.

    Examples:
        07TT_SCH_v11.pdf  ->  07TT
        PAHC10_SCH_v2.pdf ->  PAHC10
        76TT-rE.pdf       ->  76TT-rE
    """
    base = os.path.splitext(fname)[0]
    return re.sub(r"_SCH.*", "", base)


def normalise_header(header_row: list) -> list:
    """Return a lower-case, stripped copy of the header row."""
    return [clean(h).lower() for h in header_row] if header_row else []


def looks_like_part_number(value: str) -> bool:
    """Sanity-check that a cell value resembles a TapeTech part number.

    TapeTech part numbers are typically 5-6 alphanumeric characters,
    sometimes with a trailing letter (e.g. 050003, 054118F, 201032G).
    """
    return bool(re.match(r"^[0-9]{5,7}[A-Z]?$", value.strip()))


# ---------------------------------------------------------------------------
# Row extraction per table type
# ---------------------------------------------------------------------------

def _extract_standard_rows(table: list, tool: str) -> list:
    """Handle single-column and wide two-column 'Part Number' tables.

    Header examples:
        ['Part Number', 'Description', 'Quantity Each', 'Sold as part of:']
        ['Part Number', 'Description', 'Quantity Each']
        ['Part Number', 'Description', 'Quantity Each', None,
         'Part Number', 'Description', 'Quantity Each']
    """
    parts = []
    header = normalise_header(table[0])

    # Find column indices for the first and (optionally) second column set
    pn_cols = [i for i, h in enumerate(header) if "part number" in h]
    desc_cols = [i for i, h in enumerate(header) if "description" in h]
    qty_cols = [i for i, h in enumerate(header) if "quantity" in h or h == "qty"]
    sold_cols = [i for i, h in enumerate(header) if "sold" in h]

    if not pn_cols or not desc_cols:
        return parts  # not a recognisable table

    # Build pairs: [(pn_idx, desc_idx, qty_idx, sold_idx), ...]
    pairs = []
    for k in range(len(pn_cols)):
        pn_i = pn_cols[k]
        desc_i = desc_cols[k] if k < len(desc_cols) else None
        qty_i = qty_cols[k] if k < len(qty_cols) else None
        sold_i = sold_cols[0] if sold_cols else None  # usually only one sold col
        pairs.append((pn_i, desc_i, qty_i, sold_i))

    for row in table[1:]:
        if not any(cell for cell in row):
            continue  # skip blank rows
        for pn_i, desc_i, qty_i, sold_i in pairs:
            part_id = clean(row[pn_i]) if pn_i is not None and pn_i < len(row) else ""
            if not part_id or not looks_like_part_number(part_id):
                continue
            part_name = clean(row[desc_i]) if desc_i is not None and desc_i < len(row) else ""
            qty = clean(row[qty_i]) if qty_i is not None and qty_i < len(row) else ""
            sold_as = clean(row[sold_i]) if sold_i is not None and sold_i < len(row) else ""
            parts.append({
                "Part Label ID": part_id,
                "Part Name": part_name,
                "Tool Name": tool,
                "Brand": BRAND,
                "Quantity Each": qty,
                "Sold As Part Of": sold_as,
            })

    return parts


def _extract_pn_rows(table: list, tool: str) -> list:
    """Handle the P/N | Qty | Description two-column format.

    Header example:
        ['P/N', 'Qty', 'Description', '', 'P/N', 'Qty', 'Description']
    """
    parts = []
    header = normalise_header(table[0])

    pn_cols = [i for i, h in enumerate(header) if h == "p/n"]
    qty_cols = [i for i, h in enumerate(header) if h == "qty"]
    desc_cols = [i for i, h in enumerate(header) if h == "description"]

    if not pn_cols or not desc_cols:
        return parts

    pairs = list(zip(pn_cols, qty_cols if qty_cols else [None] * len(pn_cols), desc_cols))

    for row in table[1:]:
        if not any(cell for cell in row):
            continue
        for pn_i, qty_i, desc_i in pairs:
            part_id = clean(row[pn_i]) if pn_i is not None and pn_i < len(row) else ""
            if not part_id or not looks_like_part_number(part_id):
                continue
            qty = clean(row[qty_i]) if qty_i is not None and qty_i < len(row) else ""
            part_name = clean(row[desc_i]) if desc_i is not None and desc_i < len(row) else ""
            parts.append({
                "Part Label ID": part_id,
                "Part Name": part_name,
                "Tool Name": tool,
                "Brand": BRAND,
                "Quantity Each": qty,
                "Sold As Part Of": "",
            })

    return parts


# ---------------------------------------------------------------------------
# Page-level dispatcher
# ---------------------------------------------------------------------------

def extract_parts_from_page(page, tool: str) -> list:
    """Extract all parts from a single pdfplumber page."""
    parts = []
    tables = page.extract_tables()
    if not tables:
        return parts

    for table in tables:
        if not table or len(table) < 2:
            continue

        header = table[0]
        if header is None:
            continue
        norm = normalise_header(header)

        # Determine table type by inspecting header tokens
        has_part_number = any("part number" in h for h in norm)
        has_pn = any(h == "p/n" for h in norm)

        if has_part_number:
            parts.extend(_extract_standard_rows(table, tool))
        elif has_pn:
            parts.extend(_extract_pn_rows(table, tool))
        # else: not a parts table (revision block, title block, etc.) — skip

    return parts


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    if not os.path.isdir(FILTERED_DIR):
        print(f"ERROR: Filtered directory not found: {FILTERED_DIR}")
        print("Run filter_tapetech_pdfs.py first.")
        return

    pdf_files = sorted(
        f for f in os.listdir(FILTERED_DIR) if f.lower().endswith(".pdf")
    )

    if not pdf_files:
        print(f"No filtered PDFs found in {FILTERED_DIR}")
        return

    print(f"Extracting parts from {len(pdf_files)} filtered PDF(s)...")

    all_parts = []
    seen_ids = set()  # (tool, part_id) pairs — deduplicate within same tool

    for fname in pdf_files:
        path = os.path.join(FILTERED_DIR, fname)
        tool = tool_name_from_filename(fname)
        page_count = 0

        try:
            with pdfplumber.open(path) as pdf:
                for page in pdf.pages:
                    rows = extract_parts_from_page(page, tool)
                    for row in rows:
                        key = (tool, row["Part Label ID"])
                        if key not in seen_ids:
                            seen_ids.add(key)
                            all_parts.append(row)
                    page_count += len(rows)
        except Exception as exc:
            print(f"  [ERROR] {fname}: {exc}")
            continue

        print(f"  {fname}  ->  {page_count} part(s)  (tool: {tool})")

    # Write CSV
    os.makedirs(os.path.dirname(OUTPUT_CSV), exist_ok=True)
    with open(OUTPUT_CSV, "w", newline="", encoding="utf-8") as csvfile:
        writer = csv.DictWriter(csvfile, fieldnames=CSV_COLUMNS)
        writer.writeheader()
        writer.writerows(all_parts)

    print(f"\nWrote {len(all_parts)} parts to {OUTPUT_CSV}")


if __name__ == "__main__":
    main()
