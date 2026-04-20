#!/usr/bin/env python3
"""
DTB Image Library Migration Utility
=====================================
Audits, plans, and executes a standardised rename/move of every image
in ``scripts/scraped_results/Products/`` so that the library becomes
production-grade:

  • All files stay in ``.webp`` format (already the case).
  • New canonical name: ``sku-{sku}__mpn-{mpn}__img-{nn}.webp``
  • New folder layout: ``Products/{brand-slug}/{sku-slug}/``
  • A machine-readable manifest ``Products/_manifests/image-map.csv``
    tracks every old-path → new-path mapping.
  • Integrity is validated both before and after the migration.

Modes
-----
  --dry-run      (default) Build manifests + reports, touch nothing.
  --apply        Execute renames/moves from the confirmed manifest.
  --rewrite-csv  Update ``frontend/public/wp-catalog.csv`` image URLs
                 to point at new filenames (run after --apply).
  --validate     CI-style check: fail with exit-code 1 if any integrity
                 rule is violated (no writes).
  --undo         Roll back a previous --apply using rollback-map.csv.

Usage examples
--------------
  # Audit and plan (safe, no writes):
  python scripts/migrate-images.py --dry-run

  # Apply the migration:
  python scripts/migrate-images.py --apply

  # Rewrite CSV image URLs after apply:
  python scripts/migrate-images.py --rewrite-csv

  # Validate library + catalog integrity (CI gate):
  python scripts/migrate-images.py --validate

  # Roll back a previous apply:
  python scripts/migrate-images.py --undo
"""

from __future__ import annotations

import argparse
import csv
import json
import os
import re
import shutil
import sys
import unicodedata
from dataclasses import dataclass
from pathlib import Path
from typing import NamedTuple

# ── ANSI colour helpers ───────────────────────────────────────────────────────

CYAN    = "\033[96m"
GREEN   = "\033[92m"
YELLOW  = "\033[93m"
RED     = "\033[91m"
MAGENTA = "\033[95m"  # noqa: F841 – available for callers
GREY    = "\033[90m"
RESET   = "\033[0m"
BOLD    = "\033[1m"

def step(msg: str)  -> None: print(f"\n{CYAN}{BOLD}▶  {msg}{RESET}")
def ok(msg: str)    -> None: print(f"   {GREEN}✔  {msg}{RESET}")
def warn(msg: str)  -> None: print(f"   {YELLOW}⚠  {msg}{RESET}")
def fail(msg: str)  -> None: print(f"   {RED}✘  {msg}{RESET}")
def info(msg: str)  -> None: print(f"   {GREY}·  {msg}{RESET}")

# ── Default path constants (may be overridden via CLI) ────────────────────────

_REPO_ROOT_DEFAULT = Path(__file__).resolve().parent.parent


@dataclass(frozen=True)
class Paths:
    """Immutable collection of filesystem paths used throughout the pipeline."""
    repo_root:      Path
    products:       Path
    catalog:        Path
    manifests:      Path
    audit_dir:      Path
    image_map_csv:  Path
    rollback_csv:   Path
    exceptions_csv: Path

    @classmethod
    def default(cls) -> "Paths":
        repo_root = _REPO_ROOT_DEFAULT
        products  = repo_root / "scripts" / "scraped_results" / "Products"
        catalog   = repo_root / "frontend" / "public" / "wp-catalog.csv"
        manifests = products / "_manifests"
        audit_dir = products / "_audit"
        return cls(
            repo_root=repo_root,
            products=products,
            catalog=catalog,
            manifests=manifests,
            audit_dir=audit_dir,
            image_map_csv=manifests / "image-map.csv",
            rollback_csv=manifests  / "rollback-map.csv",
            exceptions_csv=audit_dir / "exceptions.csv",
        )

    @classmethod
    def from_overrides(cls, products_dir: str | None, catalog: str | None) -> "Paths":
        defaults = cls.default()
        products = Path(products_dir) if products_dir else defaults.products
        cat      = Path(catalog)      if catalog      else defaults.catalog
        manifests = products / "_manifests"
        audit_dir = products / "_audit"
        return cls(
            repo_root=defaults.repo_root,
            products=products,
            catalog=cat,
            manifests=manifests,
            audit_dir=audit_dir,
            image_map_csv=manifests / "image-map.csv",
            rollback_csv=manifests  / "rollback-map.csv",
            exceptions_csv=audit_dir / "exceptions.csv",
        )

# ── Brand slug mapping ────────────────────────────────────────────────────────

BRAND_SLUGS: dict[str, str] = {
    "Asgard":                "asgard",
    "Columbia Taping Tools": "columbia-taping-tools",
    "Platinum Drywall Tools":"platinum-drywall-tools",
    "SurPro":                "surpro",
    "TapeTech":              "tapetech",
}

# ── Catalog URL prefix ────────────────────────────────────────────────────────

CATALOG_URL_PREFIX = "https://drywalltoolbox.com/wp/wp-content/uploads/2026/04/"

# ── Token normalisation ───────────────────────────────────────────────────────

_ALLOWED_RE = re.compile(r"[^a-z0-9\-]")
_MULTI_DASH  = re.compile(r"-{2,}")

def normalize_token(value: str) -> str:
    """Lowercase, remove diacritics, replace unwanted chars with '-', collapse dupes."""
    value = unicodedata.normalize("NFKD", value)
    value = value.encode("ascii", "ignore").decode("ascii")
    value = value.lower()
    # Replace underscores, spaces, dots, quotes and other separators with dash
    value = re.sub(r"[\s_./\\\"'\u201c\u201d\u2018\u2019]+", "-", value)
    value = _ALLOWED_RE.sub("-", value)
    value = _MULTI_DASH.sub("-", value)
    value = value.strip("-")
    return value


def canonical_filename(sku_norm: str, mpn_norm: str, index: int) -> str:
    """Build the canonical filename: sku-XXX__mpn-YYY__img-NN.webp"""
    return f"sku-{sku_norm}__mpn-{mpn_norm}__img-{index:02d}.webp"


def canonical_subdir(brand_slug: str, sku_norm: str) -> Path:
    """Return the relative path inside Products/ for a product."""
    return Path(brand_slug) / sku_norm

# ── Data classes ──────────────────────────────────────────────────────────────

class ProductRecord(NamedTuple):
    row_id:     int         # 1-based line in CSV (excluding header)
    brand:      str
    brand_slug: str
    sku:        str
    sku_norm:   str
    mpn:        str
    mpn_norm:   str
    prod_type:  str         # simple / variable / variation
    images:     list[str]   # ordered basenames from the catalog

class ImageRecord(NamedTuple):
    path:     Path          # absolute path to file
    basename: str           # filename without directory
    stem:     str           # filename without extension
    flags:    set[str]      # "orig", "old", "hash", "bad_char", "leading_zero"

class ManifestRow(NamedTuple):
    brand:       str
    sku:         str
    mpn:         str
    old_path:    str        # relative to REPO_ROOT
    new_path:    str        # relative to REPO_ROOT
    image_index: int
    is_primary:  bool
    source:      str        # "catalog_url" / "stem_match" / "hash_match" / ...
    row_id:      int
    confidence:  str        # "high" / "medium" / "low"
    status:      str        # "mapped" / "unmatched" / "cross_linked" / "conflict"

# ── Step 1: Build authoritative product map ───────────────────────────────────

def build_product_map(paths: Paths) -> tuple[list[ProductRecord], dict[str, list[ProductRecord]], dict[str, list[ProductRecord]]]:
    """Parse wp-catalog.csv and return product list + SKU/MPN lookup dicts."""
    records: list[ProductRecord] = []
    sku_map:  dict[str, list[ProductRecord]] = {}
    mpn_map:  dict[str, list[ProductRecord]] = {}

    with open(paths.catalog, encoding="utf-8-sig", newline="") as f:
        reader = csv.DictReader(f)
        for row_id, row in enumerate(reader, start=1):
            brand      = row["Brands"].strip()
            brand_slug = BRAND_SLUGS.get(brand, normalize_token(brand))
            sku        = row["SKU"].strip()
            mpn        = row["MPN"].strip()
            sku_norm   = normalize_token(sku)
            mpn_norm   = normalize_token(mpn)
            prod_type  = row["Type"].strip()

            # Parse gallery images from catalog pipe-separated URLs
            images: list[str] = []
            for url in row["Images"].split("|"):
                url = url.strip()
                if url:
                    images.append(os.path.basename(url))

            pr = ProductRecord(
                row_id=row_id,
                brand=brand, brand_slug=brand_slug,
                sku=sku, sku_norm=sku_norm,
                mpn=mpn, mpn_norm=mpn_norm,
                prod_type=prod_type,
                images=images,
            )
            records.append(pr)
            sku_map.setdefault(sku_norm, []).append(pr)
            mpn_map.setdefault(mpn_norm, []).append(pr)

    return records, sku_map, mpn_map


# ── Step 2: Build full image inventory ───────────────────────────────────────

_HASH_SUFFIX_RE  = re.compile(r"_([0-9a-f]{6,8})$", re.IGNORECASE)
_LEADING_ZERO_RE = re.compile(r"^0+(\d.*)$")
_INDEX_SUFFIX_RE = re.compile(r"^(.*?)[-_](\d{1,2})$")

def classify_stem(stem: str) -> tuple[str, int | None, set[str]]:
    """
    Given a bare stem (no extension), return (base_stem, gallery_index, flags).
    gallery_index is None for the primary image.
    flags is a set of string labels: orig, old, hash, bad_char, leading_zero.
    """
    flags: set[str] = set()

    if any(c in stem for c in ('"', '\u201c', '\u201d', '\u2018', '\u2019')):
        flags.add("bad_char")

    # Legacy markers
    if stem.endswith("_orig"):
        flags.add("orig")
        stem = stem[:-5]
    if stem.endswith("-old"):
        flags.add("old")
        stem = stem[:-4]

    # Hash variant: something_7316520b
    hm = _HASH_SUFFIX_RE.search(stem)
    if hm:
        flags.add("hash")
        # keep the hash as part of the base so matching can use it
        # We'll strip it during match step

    # Leading zero: 010249 → 10249
    lm = _LEADING_ZERO_RE.match(stem)
    if lm:
        flags.add("leading_zero")

    # Gallery index (last segment): stem_01, stem-1, etc.
    im = _INDEX_SUFFIX_RE.match(stem)
    if im:
        base = im.group(1)
        idx  = int(im.group(2))
        # Verify it's actually an index (not part of a product number like "ct-28")
        # Heuristic: base must be non-empty and idx must be 0-20
        if base and 0 <= idx <= 20:
            return base, idx, flags

    return stem, None, flags


def build_image_inventory(paths: Paths) -> tuple[list[ImageRecord], dict[str, list[ImageRecord]]]:
    """Inventory all files in Products/, skipping _manifests/ and _audit/."""
    records: list[ImageRecord] = []
    stem_map: dict[str, list[ImageRecord]] = {}   # raw lowercase stem → files

    for root, dirs, files in os.walk(paths.products):
        # Skip meta directories
        dirs[:] = [d for d in dirs if d not in ("_manifests", "_audit")]
        for fname in files:
            if not fname.lower().endswith(".webp"):
                continue
            fpath = Path(root) / fname
            stem  = Path(fname).stem
            _, _, flags = classify_stem(stem)
            ir = ImageRecord(path=fpath, basename=fname, stem=stem, flags=flags)
            records.append(ir)
            stem_map.setdefault(stem.lower(), []).append(ir)

    return records, stem_map


# ── Step 3: Deterministic matching pipeline ───────────────────────────────────

def strip_hash(stem: str) -> str:
    """Remove a trailing _XXXXXXXX hash suffix."""
    return _HASH_SUFFIX_RE.sub("", stem)

def strip_leading_zeros(token: str) -> str:
    m = _LEADING_ZERO_RE.match(token)
    return m.group(1) if m else token

def strip_index(stem: str) -> tuple[str, int | None]:
    m = _INDEX_SUFFIX_RE.match(stem)
    if m:
        base = m.group(1)
        idx  = int(m.group(2))
        if base and 0 <= idx <= 20:
            return base, idx
    return stem, None

def match_images_to_products(
    products:  list[ProductRecord],
    images:    list[ImageRecord],
    sku_map:   dict[str, list[ProductRecord]],
    mpn_map:   dict[str, list[ProductRecord]],
    paths:     Paths,
) -> tuple[list[ManifestRow], list[dict]]:
    """
    Implement the 6-priority matching pipeline described in the plan.
    Returns (manifest_rows, exceptions).
    """
    # Index the images for fast lookup
    # We build several lookup indexes from the image stems.
    # Key: normalised lookup string → list of ImageRecord

    def _make_indexes(img_list: list[ImageRecord]):
        by_exact:   dict[str, list[ImageRecord]] = {}   # exact normalised stem
        by_base:    dict[str, list[ImageRecord]] = {}   # stem with index removed
        by_hash:    dict[str, list[ImageRecord]] = {}   # stem with hash removed
        by_lz:      dict[str, list[ImageRecord]] = {}   # stem with leading zeros stripped
        by_basename:dict[str, list[ImageRecord]] = {}   # full basename (for catalog URL match)

        for ir in img_list:
            stem_lc = ir.stem.lower()
            by_exact.setdefault(stem_lc, []).append(ir)
            by_basename.setdefault(ir.basename.lower(), []).append(ir)

            base_no_idx, _ = strip_index(stem_lc)
            by_base.setdefault(base_no_idx, []).append(ir)

            stem_no_hash = strip_hash(stem_lc)
            by_hash.setdefault(stem_no_hash, []).append(ir)

            # Hash stripped + index stripped → index into by_base so that
            # "pt-10fb_7316520b" is findable by the key "pt-10fb".
            base_no_idx_no_hash = strip_index(strip_hash(stem_lc))[0]
            by_base.setdefault(base_no_idx_no_hash, []).append(ir)

            stem_lz = strip_leading_zeros(stem_lc)
            by_lz.setdefault(stem_lz, []).append(ir)

            base_lz, _ = strip_index(stem_lz)
            by_lz.setdefault(base_lz, []).append(ir)

        return by_exact, by_base, by_hash, by_lz, by_basename

    by_exact, by_base, by_hash, by_lz, by_basename = _make_indexes(images)

    manifest_rows: list[ManifestRow] = []
    exceptions:    list[dict]        = []
    matched_images: set[str] = set()   # absolute path strings already mapped

    def _lookup(key: str, index: dict) -> list[ImageRecord]:
        return index.get(key, [])

    def _find_candidates(lookup_key: str) -> tuple[list[ImageRecord], str]:
        """
        Try each priority and return (candidates, source_label).
        Priority 1: exact stem == sku_norm
        Priority 2: exact stem == mpn_norm  (handled by caller with mpn_norm)
        Priority 3: base stem with index stripped
        Priority 4: hash variant
        Priority 5: leading-zero variant
        Returns only the highest-priority non-empty hit.
        """
        # P1/P2: exact
        cands = _lookup(lookup_key, by_exact)
        if cands:
            return cands, "stem_exact"
        # P3: with index stripped (covers _01, -1, etc.)
        cands = _lookup(lookup_key, by_base)
        if cands:
            return cands, "stem_indexed"
        # P4: hash stripped
        cands = _lookup(lookup_key, by_hash)
        if cands:
            return cands, "hash_match"
        # P5: leading zero stripped
        cands = _lookup(lookup_key, by_lz)
        if cands:
            return cands, "leading_zero"
        return [], ""

    for pr in products:
        # Build ordered list of images already declared in the catalog (P6)
        catalog_imgs: list[ImageRecord] = []
        for basename in pr.images:
            hits = _lookup(basename.lower(), by_basename)
            if hits:
                catalog_imgs.extend(hits)

        # Build all candidates for this product
        all_cands: list[tuple[ImageRecord, str]] = []

        # P6: catalog-declared images (highest fidelity – catalog is truth)
        seen_paths: set[str] = set()
        for ir in catalog_imgs:
            key = str(ir.path)
            if key not in seen_paths:
                seen_paths.add(key)
                all_cands.append((ir, "catalog_url"))

        # P1-P5: SKU match
        if not all_cands:
            cands, src = _find_candidates(pr.sku_norm)
            for ir in cands:
                key = str(ir.path)
                if key not in seen_paths:
                    seen_paths.add(key)
                    all_cands.append((ir, src))

        # P1-P5: MPN match (if MPN != SKU)
        if not all_cands and pr.mpn_norm != pr.sku_norm:
            cands, src = _find_candidates(pr.mpn_norm)
            for ir in cands:
                key = str(ir.path)
                if key not in seen_paths:
                    seen_paths.add(key)
                    all_cands.append((ir, src))

        if not all_cands:
            exceptions.append({
                "type":    "products_missing_images",
                "sku":     pr.sku,
                "mpn":     pr.mpn,
                "brand":   pr.brand,
                "row_id":  pr.row_id,
                "details": "No images matched in Products/ directory",
            })
            continue

        # Assign gallery index
        # Prefer catalog order when it comes from catalog_url source.
        # Build a basename-keyed position map from the catalog image list so
        # that lookup is by filename string, not by ImageRecord object identity.
        catalog_bn_order: dict[str, int] = {
            bn.lower(): idx for idx, bn in enumerate(pr.images)
        }

        def _infer_order(pair: tuple[ImageRecord, str]) -> int:
            ir, src = pair
            if src == "catalog_url":
                pos = catalog_bn_order.get(ir.basename.lower())
                if pos is not None:
                    return pos
            # Fall back to numeric index in stem
            _, idx = strip_index(strip_hash(ir.stem.lower()))
            if idx is not None:
                return idx
            return 0

        all_cands.sort(key=_infer_order)

        # Check for cross-link issues (image stem implies a different SKU)
        for ir, src in all_cands:
            stem_lc = ir.stem.lower()
            base_stem, _ = strip_index(strip_hash(stem_lc))
            # If the base stem itself looks like a SKU-like token that doesn't
            # match this product but matches another product, flag it
            other_products = []
            if base_stem in sku_map and base_stem != pr.sku_norm:
                other_products = [p.sku for p in sku_map[base_stem]]
            if base_stem in mpn_map and base_stem != pr.mpn_norm:
                other_products += [p.sku for p in mpn_map[base_stem]]

            if other_products:
                exceptions.append({
                    "type":            "cross_linked_images",
                    "sku":             pr.sku,
                    "brand":           pr.brand,
                    "row_id":          pr.row_id,
                    "image":           ir.basename,
                    "stem_implies_sku": base_stem,
                    "other_products":  list(set(other_products)),
                    "details":         (
                        f"Image stem '{base_stem}' implies a different product SKU "
                        f"({other_products}), yet it is linked to {pr.sku}"
                    ),
                })

        # Emit manifest rows
        img_index = 1
        for ir, src in all_cands:
            rel_old = ir.path.relative_to(paths.repo_root)
            subdir  = canonical_subdir(pr.brand_slug, pr.sku_norm)
            new_fn  = canonical_filename(pr.sku_norm, pr.mpn_norm, img_index)
            new_rel = Path("scripts") / "scraped_results" / "Products" / subdir / new_fn

            # Detect collisions (two source images → same target)
            confidence = "high"
            status     = "mapped"
            if str(ir.path) in matched_images:
                confidence = "medium"
                status     = "conflict"
                exceptions.append({
                    "type":    "conflicting_images",
                    "image":   ir.basename,
                    "sku":     pr.sku,
                    "row_id":  pr.row_id,
                    "details": f"Image already assigned to another product: {ir.path}",
                })
            matched_images.add(str(ir.path))

            manifest_rows.append(ManifestRow(
                brand=pr.brand,
                sku=pr.sku,
                mpn=pr.mpn,
                old_path=str(rel_old).replace("\\", "/"),
                new_path=str(new_rel).replace("\\", "/"),
                image_index=img_index,
                is_primary=(img_index == 1),
                source=src,
                row_id=pr.row_id,
                confidence=confidence,
                status=status,
            ))
            img_index += 1

    # Find unmatched images (in Products/ but never matched)
    unmatched_paths = set(str(ir.path) for ir in images) - matched_images
    for upath in sorted(unmatched_paths):
        bn = Path(upath).name
        exceptions.append({
            "type":    "unmatched_images",
            "image":   bn,
            "path":    str(Path(upath).relative_to(paths.repo_root)).replace("\\", "/"),
            "details": "File exists in Products/ but was not matched to any catalog product",
        })

    return manifest_rows, exceptions


# ── Step 4: Write manifests and exceptions ────────────────────────────────────

MANIFEST_COLS = [
    "brand", "sku", "mpn", "old_path", "new_path",
    "image_index", "is_primary", "source", "row_id", "confidence", "status",
]

EXCEPTION_COLS = [
    "type", "brand", "sku", "mpn", "row_id",
    "image", "path", "stem_implies_sku", "other_products", "details",
]

def write_manifests(manifest_rows: list[ManifestRow], exceptions: list[dict], paths: Paths) -> None:
    paths.manifests.mkdir(parents=True, exist_ok=True)
    paths.audit_dir.mkdir(parents=True, exist_ok=True)

    with open(paths.image_map_csv, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=MANIFEST_COLS)
        w.writeheader()
        for mr in manifest_rows:
            w.writerow(mr._asdict())

    with open(paths.exceptions_csv, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=EXCEPTION_COLS, extrasaction="ignore")
        w.writeheader()
        for ex in exceptions:
            # convert lists to strings for CSV
            row = {k: (json.dumps(v) if isinstance(v, list) else v)
                   for k, v in ex.items()}
            w.writerow(row)

    ok(f"Manifest written: {paths.image_map_csv.relative_to(paths.repo_root)}")
    ok(f"Exceptions written: {paths.exceptions_csv.relative_to(paths.repo_root)}")


# ── Step 5: Apply renames/moves ───────────────────────────────────────────────

def apply_migration(manifest_rows: list[ManifestRow], paths: Paths, dry_run: bool = False) -> None:
    rollback: list[dict] = []
    errors   = 0
    moved    = 0

    for mr in manifest_rows:
        if mr.confidence != "high" or mr.status != "mapped":
            continue

        src  = paths.repo_root / mr.old_path
        dst  = paths.repo_root / mr.new_path

        if not src.exists():
            warn(f"Source missing, skipping: {mr.old_path}")
            errors += 1
            continue

        if dst.exists() and src.resolve() != dst.resolve():
            warn(f"Target already exists, skipping: {mr.new_path}")
            errors += 1
            continue

        if not dry_run:
            dst.parent.mkdir(parents=True, exist_ok=True)
            shutil.move(str(src), str(dst))
            rollback.append({"src": mr.new_path, "dst": mr.old_path})

        moved += 1

    if not dry_run and rollback:
        paths.manifests.mkdir(parents=True, exist_ok=True)
        with open(paths.rollback_csv, "w", newline="", encoding="utf-8") as f:
            w = csv.DictWriter(f, fieldnames=["src", "dst"])
            w.writeheader()
            for rb in rollback:
                w.writerow(rb)
        ok(f"Rollback map written: {paths.rollback_csv.relative_to(paths.repo_root)}")

    prefix = "[DRY-RUN] " if dry_run else ""
    ok(f"{prefix}Processed {moved} files; {errors} skipped/errors")


# ── Step 6: Rewrite catalog image references ──────────────────────────────────

def rewrite_catalog(manifest_rows: list[ManifestRow], paths: Paths) -> None:
    """
    Update the Images column in wp-catalog.csv to use the new canonical URLs.
    Uses the manifest as the mapping source (old basename → new basename).
    """
    # Build old basename → new basename mapping from manifest
    old_bn_to_new_bn: dict[str, str] = {}
    for mr in manifest_rows:
        if mr.confidence == "high" and mr.status == "mapped":
            old_bn = Path(mr.old_path).name
            new_bn = Path(mr.new_path).name
            old_bn_to_new_bn[old_bn] = new_bn

    if not old_bn_to_new_bn:
        warn("No high-confidence mappings found; catalog not rewritten.")
        return

    rows_updated = 0
    output_rows: list[dict] = []
    fieldnames: list[str] = []

    with open(paths.catalog, encoding="utf-8-sig", newline="") as f:
        reader = csv.DictReader(f)
        fieldnames = reader.fieldnames or []
        for row in reader:
            old_images = row.get("Images", "")
            if not old_images.strip():
                output_rows.append(row)
                continue

            new_parts: list[str] = []
            changed = False
            for url in old_images.split("|"):
                url = url.strip()
                if not url:
                    continue
                bn = os.path.basename(url)
                if bn in old_bn_to_new_bn:
                    new_bn   = old_bn_to_new_bn[bn]
                    # Rebuild URL with new basename
                    new_url  = CATALOG_URL_PREFIX + new_bn
                    new_parts.append(new_url)
                    changed = True
                else:
                    new_parts.append(url)
            row["Images"] = "|".join(new_parts)
            if changed:
                rows_updated += 1
            output_rows.append(row)

    # Write back (preserve UTF-8 BOM for WooCommerce compatibility)
    with open(paths.catalog, "w", encoding="utf-8-sig", newline="") as f:
        w = csv.DictWriter(f, fieldnames=fieldnames, quoting=csv.QUOTE_ALL)
        w.writeheader()
        w.writerows(output_rows)

    ok(f"Catalog rewritten: {rows_updated} rows updated in {paths.catalog.relative_to(paths.repo_root)}")


# ── Step 7: Integrity validation ──────────────────────────────────────────────

_CANONICAL_RE = re.compile(
    r"^sku-[a-z0-9\-]+__mpn-[a-z0-9\-]+__img-\d{2}\.webp$"
)
_BAD_CHAR_RE  = re.compile(r'[^a-z0-9\-_.]')

def validate(paths: Paths) -> int:
    """
    Run hard integrity checks.  Returns the number of violations found.
    """
    violations = 0

    # Load catalog image basenames
    cat_basenames: set[str] = set()
    sku_image_map: dict[str, list[str]] = {}  # sku → basenames
    with open(paths.catalog, encoding="utf-8-sig", newline="") as f:
        reader = csv.DictReader(f)
        for row in reader:
            sku = row["SKU"].strip()
            for url in row["Images"].split("|"):
                url = url.strip()
                if url:
                    bn = os.path.basename(url)
                    cat_basenames.add(bn)
                    sku_image_map.setdefault(sku, []).append(bn)

    # Inventory Products/ files (skip meta dirs)
    prod_files: set[str] = set()
    bad_names:  list[str] = []
    non_webp:   list[str] = []
    orig_old:   list[str] = []

    for root, dirs, files in os.walk(paths.products):
        dirs[:] = [d for d in dirs if d not in ("_manifests", "_audit")]
        for fname in files:
            if not fname.lower().endswith(".webp"):
                non_webp.append(fname)
                violations += 1
                continue
            prod_files.add(fname)
            stem = Path(fname).stem
            if "_orig" in stem or "-old" in stem:
                orig_old.append(fname)
                violations += 1
            if _BAD_CHAR_RE.search(stem):
                bad_names.append(fname)
                violations += 1

    # Check 1: Every catalog image resolves to a file
    missing_in_prod = cat_basenames - prod_files
    for bn in sorted(missing_in_prod):
        fail(f"[CHECK1] Catalog references missing file: {bn}")
        violations += 1

    # Check 2: Every file in Products/ is referenced in catalog
    # (This is a warning, not a hard failure — gallery/variant images are ok)
    orphan_files = prod_files - cat_basenames
    if orphan_files:
        warn(f"[CHECK2] {len(orphan_files)} files in Products/ not referenced in catalog")
        info("  (Run without --validate to see details in exceptions.csv)")

    # Check 3: No non-webp files
    if non_webp:
        for f in non_webp:
            fail(f"[CHECK3] Non-.webp file found: {f}")

    # Check 4: No _orig or -old in filenames
    if orig_old:
        for f in orig_old:
            fail(f"[CHECK4] Legacy suffix (_orig/-old) found: {f}")

    # Check 5: No files with bad characters (smart quotes, spaces, etc.)
    if bad_names:
        for f in bad_names[:20]:
            fail(f"[CHECK5] Invalid characters in filename: {f}")
        if len(bad_names) > 20:
            fail(f"[CHECK5] ... and {len(bad_names)-20} more")

    summary_parts = [
        f"CHECK1={len(missing_in_prod)} missing catalog→file",
        f"CHECK3={len(non_webp)} non-webp",
        f"CHECK4={len(orig_old)} orig/old",
        f"CHECK5={len(bad_names)} bad_chars",
        f"orphans={len(orphan_files)} (warning only)",
    ]
    info("Validation summary: " + " | ".join(summary_parts))

    if violations == 0:
        ok("All hard integrity checks passed.")
    else:
        fail(f"{violations} violation(s) found.")

    return violations


# ── Step 8: Undo/rollback ─────────────────────────────────────────────────────

def undo_migration(paths: Paths) -> None:
    if not paths.rollback_csv.exists():
        fail(f"Rollback file not found: {paths.rollback_csv.relative_to(paths.repo_root)}")
        sys.exit(1)

    moved = 0
    errors = 0
    with open(paths.rollback_csv, encoding="utf-8", newline="") as f:
        reader = csv.DictReader(f)
        for rb in reader:
            src = paths.repo_root / rb["src"]
            dst = paths.repo_root / rb["dst"]
            if not src.exists():
                warn(f"Rollback source missing, skipping: {rb['src']}")
                errors += 1
                continue
            dst.parent.mkdir(parents=True, exist_ok=True)
            shutil.move(str(src), str(dst))
            moved += 1

    ok(f"Rolled back {moved} files; {errors} skipped/errors")


# ── Reporting helpers ─────────────────────────────────────────────────────────

def print_summary(
    products: list[ProductRecord],
    images: list[ImageRecord],
    manifest_rows: list[ManifestRow],
    exceptions: list[dict],
) -> None:
    step("Summary")

    type_counts: dict[str, int] = {}
    for pr in products:
        type_counts[pr.prod_type] = type_counts.get(pr.prod_type, 0) + 1

    mapped  = [mr for mr in manifest_rows if mr.status == "mapped"]
    conflic = [mr for mr in manifest_rows if mr.status == "conflict"]

    ex_types: dict[str, int] = {}
    for ex in exceptions:
        ex_types[ex["type"]] = ex_types.get(ex["type"], 0) + 1

    info(f"Catalog products : {len(products)}  ({type_counts})")
    info(f"Products dir files: {len(images)}")
    info(f"Manifest rows    : {len(manifest_rows)}  (mapped={len(mapped)}, conflict={len(conflic)})")
    info(f"Exceptions       : {len(exceptions)}")
    for t, n in ex_types.items():
        info(f"  {t}: {n}")

    # Flags breakdown
    flag_counts: dict[str, int] = {}
    for ir in images:
        for flag in ir.flags:
            flag_counts[flag] = flag_counts.get(flag, 0) + 1
    info(f"Image flags      : {flag_counts}")


# ── CLI ───────────────────────────────────────────────────────────────────────

def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(
        description="DTB Image Library Migration Utility",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__,
    )
    # Mode flags — the default (no flag) behaves the same as --dry-run.
    mode = p.add_mutually_exclusive_group()
    mode.add_argument(
        "--apply",
        action="store_true",
        help="Execute rename/move operations from the manifest",
    )
    mode.add_argument(
        "--rewrite-csv",
        action="store_true",
        dest="rewrite_csv",
        help="Rewrite catalog CSV image URLs to new filenames (run after --apply)",
    )
    mode.add_argument(
        "--validate",
        action="store_true",
        help="CI integrity check: exit 1 on any violation",
    )
    mode.add_argument(
        "--undo",
        action="store_true",
        help="Roll back a previous --apply using rollback-map.csv",
    )
    p.add_argument(
        "--products-dir",
        default=str(Paths.default().products),
        help="Override the Products directory path",
    )
    p.add_argument(
        "--catalog",
        default=str(Paths.default().catalog),
        help="Override the catalog CSV path",
    )
    return p.parse_args()


def _is_dry_run(args: argparse.Namespace) -> bool:
    """True when no explicit write-mode flag is set (default behaviour = dry-run)."""
    return not (args.apply or args.rewrite_csv or args.validate or args.undo)


def _load_manifest_from_disk(paths: Paths) -> list[ManifestRow]:
    """Load a previously written image-map.csv from disk."""
    manifest_rows: list[ManifestRow] = []
    with open(paths.image_map_csv, encoding="utf-8", newline="") as f:
        reader = csv.DictReader(f)
        for row in reader:
            manifest_rows.append(ManifestRow(
                brand=row["brand"],
                sku=row["sku"],
                mpn=row["mpn"],
                old_path=row["old_path"],
                new_path=row["new_path"],
                image_index=int(row["image_index"]),
                is_primary=row["is_primary"].lower() == "true",
                source=row["source"],
                row_id=int(row["row_id"]),
                confidence=row["confidence"],
                status=row["status"],
            ))
    return manifest_rows


def main() -> None:
    args = parse_args()

    # Build path configuration from CLI overrides (no global mutation)
    paths = Paths.from_overrides(
        products_dir=args.products_dir if args.products_dir != str(Paths.default().products) else None,
        catalog=args.catalog if args.catalog != str(Paths.default().catalog) else None,
    )

    # ── --validate ────────────────────────────────────────────────────────────
    if args.validate:
        step("Mode: Validate")
        violations = validate(paths)
        sys.exit(1 if violations else 0)

    # ── --undo ────────────────────────────────────────────────────────────────
    if args.undo:
        step("Mode: Undo")
        undo_migration(paths)
        return

    # ── --rewrite-csv ─────────────────────────────────────────────────────────
    if args.rewrite_csv:
        step("Mode: Rewrite CSV")
        if not paths.image_map_csv.exists():
            fail("image-map.csv not found. Run without flags (dry-run) or --apply first.")
            sys.exit(1)
        manifest_rows = _load_manifest_from_disk(paths)
        rewrite_catalog(manifest_rows, paths)
        return

    # ── Common phases (dry-run and apply share build steps) ───────────────────

    dry_run = _is_dry_run(args)
    if dry_run:
        step("Mode: Dry-run (default) — no files will be moved")

    step("Phase 1: Build product map from catalog")
    products, sku_map, mpn_map = build_product_map(paths)
    ok(f"Loaded {len(products)} product rows; {len(sku_map)} unique SKUs")

    step("Phase 2: Inventory image library")
    images, stem_map = build_image_inventory(paths)
    ok(f"Found {len(images)} .webp files in Products/")

    step("Phase 3: Match images to products")
    manifest_rows, exceptions = match_images_to_products(
        products, images, sku_map, mpn_map, paths,
    )
    ok(f"Generated {len(manifest_rows)} manifest rows; {len(exceptions)} exceptions")

    step("Phase 4: Write manifests and exceptions")
    write_manifests(manifest_rows, exceptions, paths)

    print_summary(products, images, manifest_rows, exceptions)

    if args.apply:
        step("Phase 5: Apply migration (renames/moves)")
        apply_migration(manifest_rows, paths, dry_run=False)
        ok("Migration applied. Run --validate to verify, then --rewrite-csv to update catalog URLs.")
    else:
        step("Phase 5: [DRY-RUN] Migration plan ready — no files moved")
        apply_migration(manifest_rows, paths, dry_run=True)
        info("Run with --apply to execute the migration.")
        info("Then run --rewrite-csv to update catalog image URLs.")
        info("Then run --validate to confirm integrity.")


if __name__ == "__main__":
    main()
