#!/usr/bin/env python3
"""
filter_level5_schematics.py

Processes every PDF in scraped_results/Level5/schematics/ (top-level only).

Step 1 – Filter:
  Identifies pages that are legend key tables (parts lists) or other
  non-schematic content and removes them, saving only the schematic
  diagram pages to scraped_results/Level5/schematics/filtered/.

Step 2 – Convert:
  Converts every schematic diagram page in the filtered PDFs to a PNG
  image and saves them to
  scraped_results/Level5/schematics/filtered/images/
  with the naming convention: <pdf-basename>_page_<N>.png

Non-schematic page detection heuristics
----------------------------------------
A page is classified as non-schematic (and therefore removed) if its
extracted text matches any of the following patterns:

  TEXT-BASED LEGEND KEY TABLE PAGES
  • Contains "Schematic#" or OCR-noisy variants such as "Sche:matic #"
      regex: r'Sch[A-Za-z:.\xa0 ]*#'
  • Contains "Part Number" or "Part\\xa0Number"  (general parts-list header)
  • Contains "\\nP/N\\nQty\\n"                   (Axia/Enterprise format)

  IMAGE-BASED LEGEND KEY TABLE PAGES
  • Contains "Zhejiang KC Mechanical"
      (manufacturer title-block found only on legend/BOM pages, not on the
      schematic exploded-view drawings for this PDF set)

Usage:
    python3 scripts/filter_level5_schematics.py [--dry-run] [--dpi DPI]

Options:
    --dry-run   Show what would be done without writing any files.
    --dpi DPI   Resolution for PNG export (default: 150).
"""

import argparse
import os
import re
import sys

try:
    import fitz  # PyMuPDF
except ImportError:
    print(
        "ERROR: PyMuPDF is required. Install with:\n"
        "  pip install pymupdf",
        file=sys.stderr,
    )
    sys.exit(1)

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------

SCHEMATICS_DIR = os.path.join(
    os.path.dirname(__file__), "..", "scraped_results", "Level5", "schematics"
)
FILTERED_DIR = os.path.join(SCHEMATICS_DIR, "filtered")
IMAGES_DIR = os.path.join(FILTERED_DIR, "images")

# ---------------------------------------------------------------------------
# Page-type detection
# ---------------------------------------------------------------------------

# Level5-specific pattern: "Schematic#", "Sche:matic #", etc.
_LEVEL5_LEGEND_RE = re.compile(r"Sch[A-Za-z:.\xa0 ]*#")


def is_non_schematic_page(page_text: str) -> bool:
    """Return True if *page_text* indicates the page should be removed.

    Matches two families of non-schematic pages found in the Level5
    schematic PDF set:

    1. Text-based legend key tables – the parts-list table text is
       directly extractable from the PDF.
    2. Image-based legend key tables – the table is a raster scan, but
       the manufacturer title-block text is extractable and uniquely
       identifies these pages.
    """
    # --- Text-based legend key table patterns ---
    if _LEVEL5_LEGEND_RE.search(page_text):
        return True
    if "Part Number" in page_text or "Part\xa0Number" in page_text:
        return True
    if "\nP/N\nQty\n" in page_text:
        return True

    # --- Image-based legend key table (manufacturer title-block marker) ---
    if "Zhejiang KC Mechanical" in page_text:
        return True

    return False


# ---------------------------------------------------------------------------
# PDF filtering
# ---------------------------------------------------------------------------


def filter_pdf(src_path: str, dst_path: str, *, dry_run: bool = False) -> tuple[int, int]:
    """Copy only schematic diagram pages from *src_path* to *dst_path*.

    Returns ``(kept, total)`` where *kept* is the number of schematic pages
    saved and *total* is the total number of pages in the source PDF.
    The destination file is written only when ``dry_run`` is False and at
    least one schematic page was found.
    """
    kept = 0
    total = 0

    with fitz.open(src_path) as src_doc:
        total = len(src_doc)
        with fitz.open() as dst_doc:
            for page_num in range(total):
                page = src_doc[page_num]
                if not is_non_schematic_page(page.get_text()):
                    dst_doc.insert_pdf(src_doc, from_page=page_num, to_page=page_num)
                    kept += 1

            if not dry_run and kept > 0:
                os.makedirs(os.path.dirname(dst_path), exist_ok=True)
                dst_doc.save(dst_path, garbage=4, deflate=True)

    return kept, total


# ---------------------------------------------------------------------------
# PNG conversion
# ---------------------------------------------------------------------------


def pdf_to_images(pdf_path: str, images_dir: str, dpi: int = 150) -> int:
    """Render every page of *pdf_path* to a PNG file in *images_dir*.

    File names follow the convention: ``<pdf-basename>_page_<N>.png``
    where N is the 1-based page number.

    Returns the number of PNG files written.
    """
    basename = os.path.splitext(os.path.basename(pdf_path))[0]
    zoom = dpi / 72.0  # 72 pt/inch is PyMuPDF's default
    mat = fitz.Matrix(zoom, zoom)
    written = 0

    with fitz.open(pdf_path) as doc:
        for page_num in range(len(doc)):
            out_name = f"{basename}_page_{page_num + 1}.png"
            out_path = os.path.join(images_dir, out_name)
            os.makedirs(images_dir, exist_ok=True)
            pix = doc[page_num].get_pixmap(matrix=mat)
            pix.save(out_path)
            written += 1

    return written


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(
        description=(
            "Filter Level5 schematic PDFs (remove legend key pages) "
            "and convert the remaining schematic pages to PNG images."
        )
    )
    p.add_argument(
        "--dry-run",
        action="store_true",
        help="Show what would be done without writing any files.",
    )
    p.add_argument(
        "--dpi",
        type=int,
        default=150,
        metavar="DPI",
        help="Resolution (dots per inch) for PNG export (default: 150).",
    )
    return p.parse_args()


def main() -> None:
    args = parse_args()
    dry_run = args.dry_run

    if dry_run:
        print("[DRY RUN] No files will be written.\n")

    # -----------------------------------------------------------------------
    # Step 1: Filter PDFs
    # -----------------------------------------------------------------------

    if not dry_run:
        os.makedirs(FILTERED_DIR, exist_ok=True)

        # Remove stale filtered PDFs from a previous run.
        for existing in os.listdir(FILTERED_DIR):
            if existing.lower().endswith(".pdf"):
                os.remove(os.path.join(FILTERED_DIR, existing))

    pdf_files = sorted(
        f for f in os.listdir(SCHEMATICS_DIR)
        if f.lower().endswith(".pdf")
    )

    if not pdf_files:
        print(f"No PDF files found in {SCHEMATICS_DIR}")
        return

    print(f"Step 1 – Filtering {len(pdf_files)} PDF(s) from:")
    print(f"  {SCHEMATICS_DIR}")
    print(f"Output directory: {FILTERED_DIR}\n")

    total_schematic_pages = 0
    skipped_pdfs: list[str] = []
    # Maps fname → number of schematic pages kept (used for Step 2 dry-run).
    filtered_pdf_pages: dict[str, int] = {}

    for fname in pdf_files:
        src = os.path.join(SCHEMATICS_DIR, fname)
        dst = os.path.join(FILTERED_DIR, fname)

        kept, total = filter_pdf(src, dst, dry_run=dry_run)
        removed = total - kept

        if kept > 0:
            total_schematic_pages += kept
            filtered_pdf_pages[fname] = kept
            removed_note = f", {removed} non-schematic page(s) removed" if removed else ""
            print(f"  [OK]  {fname}  ({kept}/{total} schematic page(s) kept{removed_note})")
        else:
            skipped_pdfs.append(fname)
            print(f"  [--]  {fname}  (no schematic pages found — skipped)")

    print(
        f"\nStep 1 done. {total_schematic_pages} schematic page(s) across "
        f"{len(filtered_pdf_pages)} filtered PDF(s)."
    )
    if skipped_pdfs:
        print(f"\nPDFs with no schematic pages ({len(skipped_pdfs)}):")
        for f in skipped_pdfs:
            print(f"  {f}")

    if not filtered_pdf_pages:
        print("\nNothing to convert. Exiting.")
        return

    # -----------------------------------------------------------------------
    # Step 2: Convert filtered PDFs to PNG images
    # -----------------------------------------------------------------------

    print(f"\nStep 2 – Converting schematic pages to PNG  (DPI={args.dpi})")
    print(f"Images directory: {IMAGES_DIR}\n")

    if not dry_run:
        # Remove stale images from a previous run.
        if os.path.isdir(IMAGES_DIR):
            for existing in os.listdir(IMAGES_DIR):
                if existing.lower().endswith(".png"):
                    os.remove(os.path.join(IMAGES_DIR, existing))

    total_images = 0

    for fname, kept_pages in filtered_pdf_pages.items():
        if dry_run:
            # Filtered PDF doesn't exist yet; report expected image count from Step 1.
            total_images += kept_pages
            print(f"  [PNG] {fname}  → {kept_pages} image(s) (would write)")
        else:
            pdf_path = os.path.join(FILTERED_DIR, fname)
            written = pdf_to_images(pdf_path, IMAGES_DIR, dpi=args.dpi)
            total_images += written
            print(f"  [PNG] {fname}  → {written} image(s)")

    print(f"\nStep 2 done. {total_images} PNG image(s) written to {IMAGES_DIR}")


if __name__ == "__main__":
    main()
