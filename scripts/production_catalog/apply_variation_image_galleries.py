#!/usr/bin/env python3
"""
Apply complete per-variation image galleries to the DTB launch WooCommerce CSV.

The WooCommerce import Images column must contain every available media URL for the
specific variation SKU, not a single representative image. This script scans the
checked-in launch image folders, maps filenames to variation SKUs, and updates only
variation rows in the target CSV.

Default behavior is conservative:
- update rows only when matching image files exist for that exact variation SKU;
- preserve existing Images values for variations with no matching image files;
- emit a CSV report of every updated, unchanged, and missing row;
- write atomically unless --dry-run is used.
"""

from __future__ import annotations

import argparse
import csv
import os
import re
import sys
import tempfile
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable, Iterator, Sequence

CATALOG_DEFAULT = Path("products/Production/launch/dtb_woocommerce_official_catalog.csv")
REPORT_DEFAULT = Path("products/Production/launch/reports/variation_image_gallery_report.csv")
IMAGE_DIR_DEFAULTS = (
    Path("products/Production/launch/launch_images"),
    Path("products/Production/launch_images"),
    Path("products/Production/launch_images/normalized"),
)
SUPPORTED_IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp"}
DEFAULT_MEDIA_BASE_URL = "https://drywalltoolbox.com/wp-content/uploads/2026/media/"


@dataclass(frozen=True, slots=True)
class ImageAsset:
    path: Path
    filename: str
    normalized_stem: str
    sequence: int


@dataclass(frozen=True, slots=True)
class RowResult:
    sku: str
    name: str
    status: str
    previous_image_count: int
    new_image_count: int
    images: tuple[str, ...]


def normalize_token(value: str) -> str:
    """Return a SKU/file matching token using only lowercase ASCII letters/digits."""
    return re.sub(r"[^a-z0-9]+", "", value.lower())


def split_images(value: str) -> list[str]:
    return [part.strip() for part in value.split(",") if part.strip()]


def sequence_from_filename(filename: str) -> int:
    match = re.search(r"_(\d{1,4})(?:\.[^.]+)$", filename.lower())
    if not match:
        return 10_000
    return int(match.group(1))


def iter_image_assets(image_dirs: Sequence[Path]) -> Iterator[ImageAsset]:
    seen: set[Path] = set()
    for image_dir in image_dirs:
        if not image_dir.exists():
            continue
        for path in image_dir.rglob("*"):
            if not path.is_file() or path.suffix.lower() not in SUPPORTED_IMAGE_EXTENSIONS:
                continue
            resolved = path.resolve()
            if resolved in seen:
                continue
            seen.add(resolved)
            yield ImageAsset(
                path=path,
                filename=path.name,
                normalized_stem=normalize_token(path.stem),
                sequence=sequence_from_filename(path.name),
            )


def asset_matches_sku(asset: ImageAsset, sku_token: str) -> bool:
    """Match exact SKU token within normalized filenames such as tapetech_07ttc_01.webp.

    We avoid substring matching because it would incorrectly map broad/shared images
    like `columbia_tools_bh_02.webp` onto specific variations such as `3BH`.
    """
    stem = asset.path.stem.lower()
    raw_parts = [normalize_token(part) for part in re.split(r"[_\-\s]+", stem)]
    if sku_token in raw_parts:
        return True

    # Fallback for filenames where separators were stripped, e.g. 55ffb01.
    # Require the SKU token to be immediately followed by a trailing sequence.
    compact = asset.normalized_stem
    return bool(re.search(rf"(?:^|[a-z]+){re.escape(sku_token)}\d{{1,4}}$", compact))


def build_sku_gallery_map(
    sku_tokens: Iterable[str], image_dirs: Sequence[Path], media_base_url: str
) -> dict[str, list[str]]:
    assets = list(iter_image_assets(image_dirs))
    sku_to_urls: dict[str, list[str]] = {}

    # Catalog-driven matching is intentionally preferred over filename-driven SKU
    # inference. The launch catalog is small enough that O(variation_rows * images)
    # is trivial, and this prevents false positives from broad/shared filename tokens.
    for sku_token in sorted({token for token in sku_tokens if token}):
        matched_assets = [asset for asset in assets if asset_matches_sku(asset, sku_token)]
        if not matched_assets:
            continue

        ordered = sorted(matched_assets, key=lambda item: (item.sequence, item.filename.lower()))
        urls: list[str] = []
        seen_urls: set[str] = set()
        for asset in ordered:
            url = f"{media_base_url.rstrip('/')}/{asset.filename}"
            if url not in seen_urls:
                seen_urls.add(url)
                urls.append(url)
        sku_to_urls[sku_token] = urls
    return sku_to_urls


def read_csv_rows(path: Path) -> tuple[list[str], list[dict[str, str]], str]:
    raw = path.read_bytes()
    encoding = "utf-8-sig" if raw.startswith(b"\xef\xbb\xbf") else "utf-8"
    text = raw.decode(encoding)
    newline = "\r\n" if "\r\n" in text else "\n"
    reader = csv.DictReader(text.splitlines())
    if not reader.fieldnames:
        raise ValueError(f"CSV has no header: {path}")
    rows = [dict(row) for row in reader]
    return list(reader.fieldnames), rows, newline


def write_csv_atomic(path: Path, fieldnames: Sequence[str], rows: Sequence[dict[str, str]], newline: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile("w", encoding="utf-8-sig", newline="", delete=False, dir=path.parent) as tmp:
        writer = csv.DictWriter(tmp, fieldnames=fieldnames, lineterminator=newline)
        writer.writeheader()
        writer.writerows(rows)
        tmp_path = Path(tmp.name)
    os.replace(tmp_path, path)


def write_report(path: Path, results: Sequence[RowResult], newline: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(
            handle,
            fieldnames=("sku", "name", "status", "previous_image_count", "new_image_count", "images"),
            lineterminator=newline,
        )
        writer.writeheader()
        for result in results:
            writer.writerow(
                {
                    "sku": result.sku,
                    "name": result.name,
                    "status": result.status,
                    "previous_image_count": result.previous_image_count,
                    "new_image_count": result.new_image_count,
                    "images": ", ".join(result.images),
                }
            )


def update_variation_rows(
    rows: list[dict[str, str]], sku_to_gallery: dict[str, list[str]], *, clear_missing: bool
) -> tuple[int, int, list[RowResult]]:
    changed = 0
    missing = 0
    results: list[RowResult] = []

    for row in rows:
        if row.get("Type", "").strip().lower() != "variation":
            continue

        sku = row.get("SKU", "").strip()
        sku_token = normalize_token(sku)
        previous_images = split_images(row.get("Images", ""))
        gallery = sku_to_gallery.get(sku_token, [])

        if gallery:
            new_images = gallery
            status = "updated" if previous_images != new_images else "already_complete"
            if previous_images != new_images:
                row["Images"] = ", ".join(new_images)
                changed += 1
        elif clear_missing and previous_images:
            new_images = []
            row["Images"] = ""
            status = "cleared_missing"
            changed += 1
            missing += 1
        else:
            new_images = previous_images
            status = "missing_gallery" if not previous_images else "preserved_no_gallery_match"
            missing += 1 if not previous_images else 0

        results.append(
            RowResult(
                sku=sku,
                name=row.get("Name", "").strip(),
                status=status,
                previous_image_count=len(previous_images),
                new_image_count=len(new_images),
                images=tuple(new_images),
            )
        )

    return changed, missing, results


def parse_args(argv: Sequence[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Apply complete variation image galleries to the launch WooCommerce CSV.")
    parser.add_argument("--catalog", type=Path, default=CATALOG_DEFAULT, help=f"Catalog CSV path. Default: {CATALOG_DEFAULT}")
    parser.add_argument(
        "--image-dir",
        type=Path,
        action="append",
        default=None,
        help="Image directory to scan. May be passed multiple times. Defaults to known launch image directories.",
    )
    parser.add_argument(
        "--media-base-url",
        default=DEFAULT_MEDIA_BASE_URL,
        help=f"Public media base URL written to WooCommerce Images. Default: {DEFAULT_MEDIA_BASE_URL}",
    )
    parser.add_argument("--report", type=Path, default=REPORT_DEFAULT, help=f"Report CSV path. Default: {REPORT_DEFAULT}")
    parser.add_argument("--dry-run", action="store_true", help="Analyze and write report without modifying the catalog CSV.")
    parser.add_argument("--check", action="store_true", help="Fail if any update would be required or any variation is missing images.")
    parser.add_argument("--clear-missing", action="store_true", help="Clear Images for variation rows with no matching image files.")
    return parser.parse_args(argv)


def main(argv: Sequence[str] | None = None) -> int:
    args = parse_args(argv or sys.argv[1:])
    catalog_path: Path = args.catalog
    image_dirs: tuple[Path, ...] = tuple(args.image_dir or IMAGE_DIR_DEFAULTS)

    if not catalog_path.exists():
        raise FileNotFoundError(f"Catalog CSV not found: {catalog_path}")

    fieldnames, rows, newline = read_csv_rows(catalog_path)
    required_columns = {"Type", "SKU", "Name", "Images"}
    missing_columns = sorted(required_columns.difference(fieldnames))
    if missing_columns:
        raise ValueError(f"Catalog is missing required columns: {', '.join(missing_columns)}")

    variation_sku_tokens = [
        normalize_token(row.get("SKU", ""))
        for row in rows
        if row.get("Type", "").strip().lower() == "variation"
    ]
    sku_to_gallery = build_sku_gallery_map(variation_sku_tokens, image_dirs, args.media_base_url)
    changed, missing, results = update_variation_rows(rows, sku_to_gallery, clear_missing=args.clear_missing)

    write_report(args.report, results, newline)
    if not args.dry_run and changed:
        write_csv_atomic(catalog_path, fieldnames, rows, newline)

    complete = sum(1 for result in results if result.new_image_count > 0)
    multi = sum(1 for result in results if result.new_image_count > 1)
    print(
        "Variation gallery sync complete: "
        f"variations={len(results)} complete={complete} multi_image={multi} changed={changed} missing={missing} "
        f"report={args.report}"
    )

    if args.check and (changed > 0 or missing > 0):
        return 1
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as exc:  # noqa: BLE001 - CLI must surface concise operational errors.
        print(f"ERROR: {exc}", file=sys.stderr)
        raise SystemExit(2)
