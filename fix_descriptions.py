"""
fix_descriptions.py
-------------------
Reads woocommerce_products_import.csv, converts every broken markdown pipe-table
block in the Description column into clean semantic HTML <table> markup, and
writes the corrected rows to woocommerce_products_import_FIXED.csv.

Scope: Description column only — all other columns and all other HTML in the
Description field are preserved verbatim.

Usage:
    python3 fix_descriptions.py
"""

import csv
import re
import sys
import os

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
INPUT_FILE = os.path.join(SCRIPT_DIR, "public", "woocommerce_products_import.csv")
OUTPUT_FILE = os.path.join(SCRIPT_DIR, "public", "woocommerce_products_import_FIXED.csv")

# ---------------------------------------------------------------------------
# Regex patterns for broken table detection
# ---------------------------------------------------------------------------

# Primary pattern: markdown table wrapped in <p>...</p> with <br /> line breaks
# Handles <br />, <br/>, <br> variants; uses DOTALL for multi-line content.
BROKEN_TABLE_PATTERN = re.compile(
    r'<p>\|\s*Specification\s*\|\s*Detail\s*\|.*?</p>',
    re.DOTALL | re.IGNORECASE,
)

# Secondary pattern: bare markdown table using real newlines OR literal \n sequences
# (no <p> wrapper, no <br />).  Handles edge cases where the description was authored
# with escaped newlines instead of HTML line breaks.
# Stops before any HTML tag (< character) to avoid consuming surrounding markup.
BARE_TABLE_PATTERN = re.compile(
    r'\|\s*Specification\s*\|\s*Detail\s*\|(?:(?:\\n|\n)[^<]*)+',
    re.IGNORECASE,
)

# Regex used to split on any <br> variant only
BR_PATTERN = re.compile(r'<br\s*/?>', re.IGNORECASE)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def build_spec_table(rows: list) -> str:
    """
    Convert a list of (label, value) tuples into a WooCommerce-compatible
    HTML spec table.  No inline styles, no class attributes.
    """
    html = "<table>\n  <tbody>\n"
    for label, value in rows:
        html += f"    <tr><td><strong>{label}</strong></td><td>{value}</td></tr>\n"
    html += "  </tbody>\n</table>"
    return html


def convert_broken_table(match_text: str) -> str:
    """
    Parse one broken table block (either <p>|...|</p> or bare markdown with
    newlines) and return proper <table> HTML.
    Returns the original text unchanged if parsing yields no data rows.
    """
    # Determine whether this is a <p>-wrapped block or a bare newline block
    is_p_wrapped = re.match(r'^\s*<p>', match_text, re.IGNORECASE) is not None

    if is_p_wrapped:
        # Step 1: strip <p> wrapper
        inner = re.sub(r'^\s*<p>', '', match_text, flags=re.IGNORECASE)
        inner = re.sub(r'</p>\s*$', '', inner, flags=re.IGNORECASE)
        # Step 2: split on <br /> variants
        lines = BR_PATTERN.split(inner)
    else:
        # Bare markdown block — split on actual newlines or literal \n sequences
        lines = re.split(r'\\n|\n', match_text)

    rows = []
    for line in lines:
        line = line.strip()

        # Skip empty lines
        if not line:
            continue

        # Skip lines that are only pipe characters / whitespace
        if re.match(r'^[\|\s]+$', line):
            continue

        # Skip the header row
        if re.match(r'^\|\s*Specification\s*\|\s*Detail\s*\|', line, re.IGNORECASE):
            continue

        # Skip the markdown alignment row
        if re.match(r'^\|\s*:?-+:?\s*\|\s*:?-+:?\s*\|', line):
            continue

        # Parse data row: | Label | Value |
        if line.startswith("|"):
            parts = line.split("|")
            # parts[0] is empty (before first |), parts[-1] may be empty (after last |)
            # Valid data rows have at least 3 non-empty parts: '', label, value [, '']
            data_parts = [p.strip() for p in parts]
            if len(data_parts) >= 4:
                label = data_parts[1]
                value = data_parts[2]
                if label:
                    rows.append((label, value))

    if not rows:
        # Return original — nothing to replace
        return match_text

    return build_spec_table(rows)


def fix_description(description: str) -> tuple:
    """
    Find and replace all broken markdown table blocks in the description.
    Returns (fixed_description, count_of_tables_converted).
    """
    count = [0]

    def replacer(m):
        count[0] += 1
        return convert_broken_table(m.group(0))

    # Apply primary pattern (<p>-wrapped tables)
    fixed = BROKEN_TABLE_PATTERN.sub(replacer, description)
    # Apply secondary pattern (bare newline tables not already handled)
    fixed = BARE_TABLE_PATTERN.sub(replacer, fixed)
    return fixed, count[0]


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    if not os.path.exists(INPUT_FILE):
        print(f"ERROR: Input file not found: {INPUT_FILE}", file=sys.stderr)
        sys.exit(1)

    total_products = 0
    total_tables_converted = 0
    no_table_found = []
    multiple_tables = []
    encoding_errors = 0

    rows_out = []
    fieldnames = None

    with open(INPUT_FILE, newline="", encoding="utf-8-sig") as f_in:
        reader = csv.DictReader(f_in)
        fieldnames = reader.fieldnames

        for row in reader:
            total_products += 1
            sku = row.get("SKU", f"row-{total_products}")

            try:
                desc = row.get("Description", "")
                fixed_desc, n_converted = fix_description(desc)
                row["Description"] = fixed_desc
                total_tables_converted += n_converted

                if n_converted == 0:
                    no_table_found.append(sku)
                elif n_converted > 1:
                    multiple_tables.append(sku)

            except UnicodeDecodeError:
                encoding_errors += 1

            rows_out.append(row)

    with open(OUTPUT_FILE, newline="", encoding="utf-8", mode="w") as f_out:
        writer = csv.DictWriter(
            f_out,
            fieldnames=fieldnames,
            quoting=csv.QUOTE_ALL,
        )
        writer.writeheader()
        writer.writerows(rows_out)

    # Summary
    separator = "\u2500" * 37
    print("Processing complete.")
    print(separator)
    print(f"Total products processed:     {total_products}")
    print(f"Tables converted:             {total_tables_converted}")
    print(f"Products with no table found: {len(no_table_found)}")
    if no_table_found:
        print(f"  SKUs: {', '.join(no_table_found[:20])}" +
              ("  [truncated]" if len(no_table_found) > 20 else ""))
    print(f"Products with multiple tables: {len(multiple_tables)}")
    if multiple_tables:
        print(f"  SKUs: {', '.join(multiple_tables)}")
    print(f"Encoding errors:              {encoding_errors}")
    print(f"Output file: {OUTPUT_FILE}")
    print(separator)


if __name__ == "__main__":
    main()
