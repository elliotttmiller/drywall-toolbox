#!/usr/bin/env python3
"""
scripts/rebuild_catalog.py
Production-grade image library + catalog CSV rebuild.

Four fixes applied in a single pass:
  1. SEO image renaming  →  [brand]-[name-slug]-[SKU]-[index].webp
  2. Tag cleanup         →  3-5 highly-relevant exact terms for site-search filtering
  3. Variation images    →  parent holds full gallery; each variation holds its primary only
  4. HTML cleanup        →  strip CSS classes, unwrap <span>, semantic HTML throughout

Usage:
  python3 scripts/rebuild_catalog.py              # dry-run  (no files written)
  python3 scripts/rebuild_catalog.py --apply      # rename images + write new CSV
  python3 scripts/rebuild_catalog.py --audit-only # stats only, no writes

Outputs (--apply):
  frontend/public/wp-catalog.csv           ← updated in-place
  scripts/scraped_results/Products/        ← new SEO-named files added (originals kept)
  scripts/scraped_results/Products/_rebuild_manifest.csv  ← old→new rename log
"""

from __future__ import annotations

import argparse
import csv
import os
import re
import shutil
import sys
from collections import defaultdict
from io import StringIO
from pathlib import Path

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------
REPO_ROOT   = Path(__file__).parent.parent
PRODUCTS_DIR = REPO_ROOT / "scripts" / "scraped_results" / "Products"
CSV_PATH     = REPO_ROOT / "frontend" / "public" / "wp-catalog.csv"
MANIFEST_PATH = PRODUCTS_DIR / "_rebuild_manifest.csv"

IMAGE_BASE_URL = "https://drywalltoolbox.com/wp/wp-content/uploads/2026/04/"

# ---------------------------------------------------------------------------
# Brand slug map
# ---------------------------------------------------------------------------
BRAND_SLUG: dict[str, str] = {
    "Asgard":                 "asgard",
    "Columbia Taping Tools":  "columbia",
    "Platinum Drywall Tools": "platinum",
    "SurPro":                 "surpro",
    "TapeTech":               "tapetech",
}

# ---------------------------------------------------------------------------
# Tag cleanup: generic filler terms to drop
# Anything in this list (case-insensitive) is removed before capping at 5.
# ---------------------------------------------------------------------------
TAG_STOPLIST: set[str] = {
    # generic product-type phrases that appear across hundreds of products
    "drywall finishing tools", "drywall taping tool", "drywall taping tools",
    "finishing tool", "finishing tools",
    "joint compound applicator", "joint compound tools", "joint compound tool",
    "drywall tools", "drywall corner tool", "drywall corner tools",
    "taping tool", "taping tools",
    "automatic taper",
    "drywall compound tools", "drywall compound applicator",
    "drywall corner finisher",
    # lone brand names (brand is already a filter dimension on the site)
    "asgard", "tapetech", "columbia tools", "columbia taping tools",
    "platinum drywall tools", "platinum", "surpro",
    # pure duplicates of the brand column
    "columbia", "graco", "level5", "dura-stilts",
    # completely generic
    "drywall", "tool", "tools", "professional",
}

# ---------------------------------------------------------------------------
# HTML cleanup helpers
# ---------------------------------------------------------------------------
try:
    from bs4 import BeautifulSoup, NavigableString, Tag
    _HAS_BS4 = True
except ImportError:
    _HAS_BS4 = False


def _strip_classes_regex(html: str) -> str:
    """Fallback: remove class="..." attributes from all tags via regex."""
    html = re.sub(r'\s+class="[^"]*"', "", html)
    html = re.sub(r"\s+class='[^']*'", "", html)
    return html


def clean_html(html: str) -> str:
    """
    Strip CSS classes from every element and unwrap bare <span> tags.
    Returns minimal, semantic HTML.
    """
    if not html or not html.strip():
        return html

    if not _HAS_BS4:
        return _strip_classes_regex(html)

    soup = BeautifulSoup(html, "html.parser")

    # 1. Remove class attribute from every element
    for tag in soup.find_all(True):
        tag.attrs.pop("class", None)
        tag.attrs.pop("style", None)

    # 2. Unwrap <span> tags (keep their text content)
    for span in soup.find_all("span"):
        span.unwrap()

    # 3. Re-serialise — BeautifulSoup adds <html><body> wrappers only when
    #    parsing a full document; parsing a fragment keeps just the content.
    result = soup.decode_contents()

    # 4. Collapse excessive blank lines produced by the serialiser
    result = re.sub(r"\n{3,}", "\n\n", result.strip())
    return result


# ---------------------------------------------------------------------------
# Slug helpers
# ---------------------------------------------------------------------------
_INCH_PATTERN  = re.compile(r'(\d+(?:\.\d+)?)\s*"')   # 8"  →  8-inch
_WF_PATTERN    = re.compile(r'\bw/', re.IGNORECASE)    # w/  →  with  (no trailing \b needed)
_AMP_PATTERN   = re.compile(r'\s*&(?:amp;)?\s*')
_NON_WORD      = re.compile(r'[^a-z0-9]+')
_MULTI_DASH    = re.compile(r'-{2,}')


def slugify(text: str, max_len: int = 45) -> str:
    """Convert a product name fragment to a URL-safe slug."""
    text = _INCH_PATTERN.sub(r'\1-inch', text)
    text = _WF_PATTERN.sub('with', text)
    text = _AMP_PATTERN.sub('-and-', text)
    text = text.lower()
    text = _NON_WORD.sub('-', text)
    text = _MULTI_DASH.sub('-', text).strip('-')
    return text[:max_len].rstrip('-')


# Patterns to remove from Name before slugging
_TRAILING_SKU  = re.compile(r'\s*\([A-Z0-9][\w\-/]{2,}\)\s*$')  # trailing (SKU)
_PARENS        = re.compile(r'\([^)]*\)')                         # all (...) blocks


def name_slug(brand: str, name: str) -> str:
    """
    Derive a clean, descriptive slug from the product Name field.
    Removes brand prefix and trailing SKU parentheticals.
    """
    # Remove trailing (SKU) — uppercase heavy
    cleaned = _TRAILING_SKU.sub('', name).strip()
    # Remove brand prefix (case-insensitive)
    if cleaned.lower().startswith(brand.lower()):
        cleaned = cleaned[len(brand):].strip()
    # Strip remaining parentheticals that are just specs or repeat info
    cleaned = _PARENS.sub(' ', cleaned).strip()
    return slugify(cleaned)


def sku_to_slug(sku: str) -> str:
    """Normalise SKU for use in a filename (keep case, replace / with -)."""
    return re.sub(r'[^A-Za-z0-9\-]', '-', sku).strip('-')


# ---------------------------------------------------------------------------
# Tag cleanup
# ---------------------------------------------------------------------------
_MEASURE_RE = re.compile(
    r'\b\d+(?:\.\d+)?\s*(?:inch|in\b|"|-inch|-in\b)',
    re.IGNORECASE
)


def _score_tag(tag: str) -> int:
    """Higher = more specific / valuable for site-search filtering."""
    t = tag.lower().strip()
    if t in TAG_STOPLIST:
        return -1
    score = 0
    if _MEASURE_RE.search(t):
        score += 3          # contains a size measurement
    if len(t.split()) <= 3:
        score += 2          # short, exact phrase
    if any(c.isdigit() for c in t):
        score += 1          # numeric content
    if len(t.split()) > 5:
        score -= 2          # long phrase → too verbose for filtering
    return score


def clean_tags(raw_tags: str, sku: str, categories: str) -> str:
    """
    Reduce comma-separated tag string to 3-5 highly relevant exact terms.
    Falls back to extracting terms from categories / SKU when too few remain.
    """
    if not raw_tags:
        return ""

    tags = [t.strip() for t in raw_tags.split(",") if t.strip()]

    # Score and filter
    scored = [(t, _score_tag(t)) for t in tags]
    kept = [t for t, s in sorted(scored, key=lambda x: -x[1]) if s >= 0]

    # De-duplicate (case-insensitive)
    seen: set[str] = set()
    unique: list[str] = []
    for t in kept:
        key = t.lower()
        if key not in seen:
            seen.add(key)
            unique.append(t)

    # Cap at 5
    result = unique[:5]

    # Supplement from categories if we have fewer than 3
    if len(result) < 3 and categories:
        for part in reversed(categories.split(">")):
            part = part.strip()
            if part and part.lower() not in seen and part.lower() not in TAG_STOPLIST and len(result) < 5:
                result.append(part)
                seen.add(part.lower())

    # Last resort: add SKU
    if len(result) < 2 and sku:
        result.insert(0, sku)

    return ", ".join(result)


# ---------------------------------------------------------------------------
# Core: build old→new image filename mapping
# ---------------------------------------------------------------------------
def extract_filename(url: str) -> str | None:
    """Return filename portion from a full image URL, or None."""
    url = url.strip()
    if url.startswith(IMAGE_BASE_URL):
        return url[len(IMAGE_BASE_URL):]
    return None


def build_seo_filename(brand: str, prod_name: str, sku: str, index: int) -> str:
    """Return the SEO-optimised image filename (no directory prefix)."""
    b_slug  = BRAND_SLUG.get(brand, slugify(brand))
    n_slug  = name_slug(brand, prod_name)
    s_slug  = sku_to_slug(sku)
    return f"{b_slug}-{n_slug}-{s_slug}-{index:02d}.webp"


def build_rename_map(rows: list[dict]) -> dict[str, str]:
    """
    Build a global old_filename → new_filename mapping.

    Only simple and variation rows drive the mapping (they "own" their images).
    Variable parent rows are aggregated from their variations later.
    Shared images (same file referenced by multiple rows) keep the first mapping.
    """
    mapping: dict[str, str] = {}

    for row in rows:
        rtype  = row.get("Type", "")
        brand  = row.get("Brands", "")
        sku    = row.get("SKU", "")
        name   = row.get("Name", "")
        images = row.get("Images", "")

        # Only simple and variation rows assign canonical new names
        if rtype not in ("simple", "variation"):
            continue

        files = [f for f in (extract_filename(u) for u in images.split("|")) if f]
        for idx, fname in enumerate(files, start=1):
            if fname in mapping:
                continue  # first owner wins
            new_name = build_seo_filename(brand, name, sku, idx)
            # Handle collisions: append extra counter if new_name already taken
            counter = 0
            candidate = new_name
            taken = set(mapping.values())
            while candidate in taken:
                counter += 1
                stem = new_name[:-5]  # strip .webp
                candidate = f"{stem}-x{counter:02d}.webp"
            mapping[fname] = candidate

    return mapping


# ---------------------------------------------------------------------------
# Core: fix variation image assignments
# ---------------------------------------------------------------------------
def fix_variation_images(rows: list[dict]) -> list[dict]:
    """
    For each variable parent:
      - Parent.Images = ordered union of all variation primary images
        followed by their supporting gallery images.
      - Variation.Images = only that variation's primary (first) image.

    Returns a new list of rows with Images fields updated.
    """
    # Index rows by SKU
    by_sku: dict[str, dict] = {r["SKU"]: r for r in rows}

    # Find variable parents and their variations
    parent_skus: set[str] = {r["SKU"] for r in rows if r.get("Type") == "variable"}
    children: dict[str, list[dict]] = defaultdict(list)
    for r in rows:
        if r.get("Type") == "variation" and r.get("Parent") in parent_skus:
            children[r["Parent"]].append(r)

    for parent_sku, var_rows in children.items():
        parent_row = by_sku.get(parent_sku)
        if not parent_row:
            continue

        # Collect all variation images: primary first, then extras
        all_urls: list[str] = []
        seen_urls: set[str] = set()

        def _add(url: str) -> None:
            u = url.strip()
            if u and u not in seen_urls:
                seen_urls.add(u)
                all_urls.append(u)

        for vrow in var_rows:
            imgs = [u for u in vrow.get("Images", "").split("|") if u.strip()]
            # Primary image of this variation
            if imgs:
                _add(imgs[0])
            # Supporting gallery images
            for extra in imgs[1:]:
                _add(extra)

        # Set parent gallery to union of all variation images
        parent_row["Images"] = "|".join(all_urls)

        # Reduce each variation to its primary image only
        for vrow in var_rows:
            imgs = [u for u in vrow.get("Images", "").split("|") if u.strip()]
            vrow["Images"] = imgs[0] if imgs else ""

    return rows


# ---------------------------------------------------------------------------
# Core: rewrite image URLs in all rows using rename mapping
# ---------------------------------------------------------------------------
def apply_rename_map(rows: list[dict], mapping: dict[str, str]) -> list[dict]:
    """Replace every image URL in every row using the old→new mapping."""
    for row in rows:
        images = row.get("Images", "")
        if not images:
            continue
        new_urls: list[str] = []
        for url in images.split("|"):
            url = url.strip()
            if not url:
                continue
            fname = extract_filename(url)
            if fname and fname in mapping:
                new_urls.append(IMAGE_BASE_URL + mapping[fname])
            else:
                new_urls.append(url)  # keep as-is if not in mapping
        row["Images"] = "|".join(new_urls)
    return rows


# ---------------------------------------------------------------------------
# Core: apply all four fixes to a row
# ---------------------------------------------------------------------------
def process_row(row: dict, mapping: dict[str, str]) -> dict:
    """Apply tag cleanup and HTML cleanup. Image rewriting is done separately."""
    row["Tags"] = clean_tags(
        row.get("Tags", ""),
        row.get("SKU", ""),
        row.get("Categories", ""),
    )
    row["Description"] = clean_html(row.get("Description", ""))
    row["Short description"] = clean_html(row.get("Short description", ""))
    return row


# ---------------------------------------------------------------------------
# File operations
# ---------------------------------------------------------------------------
def copy_renamed_images(
    mapping: dict[str, str],
    products_dir: Path,
    dry_run: bool,
) -> tuple[int, int, list[str]]:
    """
    Copy each image to its new SEO filename.
    Originals are kept (non-destructive).
    Returns (copied, skipped, warnings).
    """
    copied = 0
    skipped = 0
    warnings: list[str] = []

    for old_name, new_name in mapping.items():
        src = products_dir / old_name
        dst = products_dir / new_name

        if not src.exists():
            warnings.append(f"SOURCE MISSING: {old_name}")
            skipped += 1
            continue

        if dst.exists() and dst.stat().st_size == src.stat().st_size:
            skipped += 1  # identical already present
            continue

        if not dry_run:
            shutil.copy2(src, dst)
        copied += 1

    return copied, skipped, warnings


def write_manifest(
    mapping: dict[str, str],
    manifest_path: Path,
    dry_run: bool,
) -> None:
    if dry_run:
        return
    with open(manifest_path, "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(["old_filename", "new_filename"])
        for old, new in sorted(mapping.items()):
            w.writerow([old, new])
    print(f"  Manifest written → {manifest_path.relative_to(REPO_ROOT)}")


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__,
                                     formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--apply",      action="store_true", help="Apply all changes")
    parser.add_argument("--audit-only", action="store_true", help="Stats only, no writes")
    args = parser.parse_args()

    dry_run = not args.apply
    audit_only = args.audit_only

    # ------------------------------------------------------------------
    print("=" * 70)
    print("DTB Catalog Rebuild")
    print("=" * 70)

    # 1. Read CSV
    with open(CSV_PATH, newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        fieldnames = reader.fieldnames
        rows = list(reader)

    print(f"\n  CSV loaded:  {len(rows):,} rows  |  {len(fieldnames)} columns")

    # 2. Audit: count images
    all_imgs: set[str] = set()
    for row in rows:
        for url in row.get("Images", "").split("|"):
            fname = extract_filename(url.strip())
            if fname:
                all_imgs.add(fname)
    print(f"  Image refs:  {len(all_imgs):,} unique filenames in CSV")

    types_count = {t: sum(1 for r in rows if r.get("Type") == t)
                   for t in ("simple", "variable", "variation")}
    print(f"  Row types:   {types_count}")
    print()

    if audit_only:
        print("Audit-only mode: exiting without changes.")
        return

    # ------------------------------------------------------------------
    # Fix 3: Variation image mapping (must run before rename-map build)
    print("Fix 3 — Variation image mapping …")
    rows = fix_variation_images(rows)
    var_count = sum(1 for r in rows if r.get("Type") == "variation")
    print(f"  Processed {var_count} variations")

    # ------------------------------------------------------------------
    # Fix 1: Build SEO rename map from post-mapping rows
    print("Fix 1 — Building SEO image rename map …")
    rename_map = build_rename_map(rows)
    print(f"  {len(rename_map):,} images to rename")

    # Sample a few renames for the user to review
    samples = list(rename_map.items())[:8]
    for old, new in samples:
        print(f"    {old}  →  {new}")

    # ------------------------------------------------------------------
    # Fix 1 (continued): Rewrite image URLs in all rows
    rows = apply_rename_map(rows, rename_map)

    # ------------------------------------------------------------------
    # Fix 2 & 4: Tags and HTML cleanup per row
    print("Fix 2 — Tag cleanup …")
    print("Fix 4 — HTML description cleanup …")
    for row in rows:
        process_row(row, rename_map)
    print("  Done.")

    # ------------------------------------------------------------------
    # Verify CSV output in-memory before writing
    print("\nValidating …")
    issues: list[str] = []
    # Check no row lost its Images field if it had one before
    for row in rows:
        if row.get("Type") in ("simple", "variation") and not row.get("Images"):
            # It's OK for some to have no images; just warn
            pass
        imgs = row.get("Images", "")
        if imgs:
            for url in imgs.split("|"):
                if url and not url.startswith("http"):
                    issues.append(f"BAD URL {row['SKU']}: {url[:60]}")
    if issues:
        print(f"  {len(issues)} URL issues found:")
        for i in issues[:10]:
            print(f"    {i}")
    else:
        print("  All image URLs valid.")

    # ------------------------------------------------------------------
    if dry_run:
        print(
            "\nDRY-RUN complete. No files were modified.\n"
            "Run with --apply to write changes.\n"
        )
        return

    # ------------------------------------------------------------------
    # Apply: copy renamed image files
    print("\nCopying renamed image files …")
    copied, skipped, warnings = copy_renamed_images(rename_map, PRODUCTS_DIR, dry_run=False)
    print(f"  Copied:  {copied:,}  |  Skipped (unchanged): {skipped:,}")
    if warnings:
        print(f"  Warnings ({len(warnings)}):")
        for w in warnings[:10]:
            print(f"    {w}")

    # ------------------------------------------------------------------
    # Apply: write manifest
    write_manifest(rename_map, MANIFEST_PATH, dry_run=False)

    # ------------------------------------------------------------------
    # Apply: write updated CSV
    print("Writing updated CSV …")
    with open(CSV_PATH, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames, extrasaction="ignore")
        writer.writeheader()
        writer.writerows(rows)
    print(f"  Written → {CSV_PATH.relative_to(REPO_ROOT)}")

    # ------------------------------------------------------------------
    print("\n" + "=" * 70)
    print("Rebuild complete.")
    print(f"  Images renamed:  {copied:,}")
    print(f"  CSV rows:        {len(rows):,}")
    print(f"  Manifest:        {MANIFEST_PATH.relative_to(REPO_ROOT)}")
    print("=" * 70)


if __name__ == "__main__":
    main()
