#!/usr/bin/env python3
"""
filter_tapetech_pdfs.py

Processes every PDF in scraped_results/TapeTech/ (top-level only).
Identifies pages that contain legend key tables (parts lists) and removes
schematic diagram pages, saving only the legend key pages to
scraped_results/TapeTech/filtered/.

Detection heuristic:
  A page is a legend key table if its extracted text contains any of:
    - "Part Number"  (standard TapeTech parts-list header)
    - "Part\xa0Number"  (non-breaking-space variant)
    - "\nP/N\nQty\n"  (Axia/Enterprise flat-finisher-box format)
"""

import os
import re
import fitz  # PyMuPDF

TAPETECH_DIR = os.path.join(
    os.path.dirname(__file__), "..", "scraped_results", "TapeTech"
)
OUTPUT_DIR = os.path.join(TAPETECH_DIR, "filtered")


def is_legend_page(page_text: str) -> bool:
    """Return True if the page contains a legend key (parts list) table."""
    return (
        "Part Number" in page_text
        or "Part\xa0Number" in page_text
        or "\nP/N\nQty\n" in page_text
    )


def tool_name_from_filename(fname: str) -> str:
    """Derive a clean tool/SKU name from a PDF filename.

    Examples:
        07TT_SCH_v11.pdf  ->  07TT
        PAHC10_SCH_v2.pdf ->  PAHC10
        76TT-rE.pdf       ->  76TT-rE
        CFHTT-rA.pdf      ->  CFHTT-rA
    """
    base = os.path.splitext(fname)[0]
    # Strip "_SCH" and anything that follows (version tags, suffixes, etc.)
    tool = re.sub(r"_SCH.*", "", base)
    return tool


def filter_pdf(src_path: str, dst_path: str) -> int:
    """Copy only legend key table pages from src_path to dst_path.

    Returns the number of legend key pages kept, or 0 if none were found.
    The destination file is written only when at least one page is kept.
    """
    kept = 0
    with fitz.open(src_path) as src_doc:
        with fitz.open() as dst_doc:
            for page_num in range(len(src_doc)):
                page = src_doc[page_num]
                if is_legend_page(page.get_text()):
                    dst_doc.insert_pdf(src_doc, from_page=page_num, to_page=page_num)
                    kept += 1

            if kept > 0:
                os.makedirs(os.path.dirname(dst_path), exist_ok=True)
                dst_doc.save(dst_path, garbage=4, deflate=True)

    return kept


def main():
    os.makedirs(OUTPUT_DIR, exist_ok=True)

    # Remove any existing PDFs in the output directory so that stale files
    # from a previous (incorrect) run do not persist.
    for existing in os.listdir(OUTPUT_DIR):
        if existing.lower().endswith(".pdf"):
            os.remove(os.path.join(OUTPUT_DIR, existing))

    pdf_files = sorted(
        f for f in os.listdir(TAPETECH_DIR)
        if f.lower().endswith(".pdf")
    )

    if not pdf_files:
        print(f"No PDF files found in {TAPETECH_DIR}")
        return

    print(f"Processing {len(pdf_files)} PDF(s) from {TAPETECH_DIR}")
    print(f"Output directory: {OUTPUT_DIR}\n")

    total_kept = 0
    skipped = []

    for fname in pdf_files:
        src = os.path.join(TAPETECH_DIR, fname)
        dst = os.path.join(OUTPUT_DIR, fname)
        tool = tool_name_from_filename(fname)

        kept = filter_pdf(src, dst)

        if kept > 0:
            total_kept += kept
            print(f"  [OK]  {fname}  ({kept} legend page(s) saved)  ->  {tool}")
        else:
            skipped.append(fname)
            print(f"  [--]  {fname}  (no legend key pages found — schematic only)")

    print(f"\nDone. {total_kept} legend key pages saved across "
          f"{len(pdf_files) - len(skipped)} PDF(s).")
    if skipped:
        print(f"\nPDFs with no extractable legend key pages ({len(skipped)}):")
        for f in skipped:
            print(f"  {f}")


if __name__ == "__main__":
    main()
