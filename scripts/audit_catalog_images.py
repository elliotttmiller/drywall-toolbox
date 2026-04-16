#!/usr/bin/env python3
"""
Audit/fix wp-catalog image URLs with optional download + WebP conversion.

Key safeguards:
- Flags missing and placeholder image URLs.
- Blocks forbidden sources: ALSTAPINGTOOLS and All-Wall.
- Resolves candidates from trusted source catalogs first.
- Optionally downloads images and converts to high-quality WebP via sharp.
"""

from __future__ import annotations

import argparse
import csv
import json
import re
import subprocess
import sys
import tempfile
import urllib.parse
import urllib.request
from pathlib import Path
from typing import Iterable

PLACEHOLDER_TOKENS = (
    "placeholder",
    "no-image",
    "no_image",
)

BLOCKED_DOMAINS = {
    "alstapingtools.com",
    "www.alstapingtools.com",
    "all-wall.com",
    "www.all-wall.com",
    "allwall.com",
    "www.allwall.com",
}

# Source files with image columns already present in this repository.
DEFAULT_SOURCE_CSVS = (
    "scripts/scraped_results/TapeTech/tapetech_master_catalog.csv",
    "scripts/scraped_results/Level5/level5_tools.csv",
    "scripts/scraped_results/Columbia/columbia_walltools.csv",
)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Audit and optionally fix catalog image URLs.")
    parser.add_argument(
        "--catalog",
        default="frontend/public/wp-catalog.csv",
        help="Path to wp-catalog.csv (default: frontend/public/wp-catalog.csv)",
    )
    parser.add_argument(
        "--write",
        action="store_true",
        help="Write changes back to the catalog CSV.",
    )
    parser.add_argument(
        "--sync-server-copy",
        action="store_true",
        help="Also mirror updates to frontend/server/wp-catalog.csv when present.",
    )
    parser.add_argument(
        "--report-json",
        default="/tmp/dtb-catalog-image-audit.json",
        help="Output path for JSON audit report.",
    )
    parser.add_argument(
        "--source-csv",
        action="append",
        default=[],
        help="Additional source CSV path (repeatable) with SKU/MPN + image URL columns.",
    )
    parser.add_argument(
        "--download-convert",
        action="store_true",
        help="Download resolved source image and convert to WebP before linking URL.",
    )
    parser.add_argument(
        "--output-dir",
        default="/tmp/dtb-product-images-webp",
        help="Where converted .webp files are written when --download-convert is enabled.",
    )
    parser.add_argument(
        "--uploads-base-url",
        default="https://drywalltoolbox.com/wp/wp-content/uploads/2026/04",
        help="Base URL used in CSV Images column for converted files.",
    )
    parser.add_argument(
        "--webp-quality",
        type=int,
        default=92,
        help="WebP quality for sharp conversion (default: 92).",
    )
    return parser.parse_args()


def is_placeholder(images_value: str) -> bool:
    images_value = (images_value or "").strip().lower()
    if not images_value:
        return True
    return any(token in images_value for token in PLACEHOLDER_TOKENS)


def domain_from_url(url: str) -> str:
    host = urllib.parse.urlparse(url).hostname or ""
    return host.lower()


def is_blocked_url(url: str) -> bool:
    host = domain_from_url(url)
    if not host:
        return False
    if host in BLOCKED_DOMAINS:
        return True
    return any(host.endswith(f".{blocked}") for blocked in BLOCKED_DOMAINS)


def choose_image_column(fieldnames: Iterable[str]) -> str | None:
    preferred = ("Images", "Image URL(s)", "Image URL", "Image")
    available = {name.strip(): name for name in fieldnames if name}
    for column in preferred:
        if column in available:
            return available[column]
    for name in available.values():
        if "image" in name.lower() and "url" in name.lower():
            return name
    return None


def build_source_index(repo_root: Path, extra_sources: list[str]) -> dict[str, str]:
    source_index: dict[str, str] = {}
    all_sources = [*DEFAULT_SOURCE_CSVS, *extra_sources]

    for rel_path in all_sources:
        source_path = (repo_root / rel_path).resolve()
        if not source_path.exists():
            continue

        with source_path.open("r", encoding="latin1", newline="") as handle:
            reader = csv.DictReader(handle)
            if not reader.fieldnames:
                continue

            image_col = choose_image_column(reader.fieldnames)
            if not image_col:
                continue

            for row in reader:
                image = (row.get(image_col) or "").strip()
                if not image:
                    continue

                # Keep first URL only when galleries are pipe-separated.
                image_url = image.split("|")[0].strip()
                if not image_url or is_blocked_url(image_url):
                    continue

                keys = {
                    (row.get("SKU") or "").strip().upper(),
                    (row.get("MPN") or "").strip().upper(),
                }
                keys.discard("")
                for key in keys:
                    source_index.setdefault(key, image_url)

    return source_index


def download_file(url: str, destination: Path) -> None:
    request = urllib.request.Request(
        url,
        headers={"User-Agent": "Mozilla/5.0 (compatible; DTB-CatalogImageAudit/1.0)"},
    )
    with urllib.request.urlopen(request, timeout=40) as response:  # nosec B310
        data = response.read()
    destination.write_bytes(data)


def convert_to_webp_with_sharp(input_file: Path, output_file: Path, quality: int, frontend_dir: Path) -> None:
    js = (
        "const sharp=require('sharp');"
        "sharp(process.argv[1]).webp({quality:Number(process.argv[3]),effort:6})"
        ".toFile(process.argv[2])"
        ".catch((err)=>{console.error(err);process.exit(1);});"
    )
    subprocess.run(
        ["node", "-e", js, str(input_file), str(output_file), str(quality)],
        cwd=str(frontend_dir),
        check=True,
        capture_output=True,
        text=True,
    )


def sanitize_filename(value: str) -> str:
    cleaned = re.sub(r"[^a-zA-Z0-9._-]+", "-", value.strip().lower())
    cleaned = cleaned.strip("-._")
    return cleaned or "unknown-sku"


def main() -> int:
    args = parse_args()

    repo_root = Path(__file__).resolve().parent.parent
    catalog_path = (repo_root / args.catalog).resolve()
    if not catalog_path.exists():
        print(f"Catalog not found: {catalog_path}", file=sys.stderr)
        return 1

    frontend_dir = repo_root / "frontend"
    if args.download_convert and not (frontend_dir / "node_modules" / "sharp").exists():
        print("sharp is required for --download-convert. Run: cd frontend && npm ci", file=sys.stderr)
        return 1

    source_index = build_source_index(repo_root, args.source_csv)

    with catalog_path.open("r", encoding="utf-8", newline="") as handle:
        reader = csv.DictReader(handle)
        if not reader.fieldnames:
            print("Catalog has no header row", file=sys.stderr)
            return 1
        rows = list(reader)
        fieldnames = reader.fieldnames

    unresolved: list[dict[str, str]] = []
    replaced = 0
    blocked_candidates = 0
    missing_total = 0

    output_dir = Path(args.output_dir)
    if args.download_convert:
        output_dir.mkdir(parents=True, exist_ok=True)

    for row in rows:
        images = row.get("Images") or ""
        if not is_placeholder(images):
            continue

        missing_total += 1
        sku = (row.get("SKU") or "").strip()
        mpn = (row.get("MPN") or "").strip()

        candidate = ""
        for key in (sku.upper(), mpn.upper()):
            if key and key in source_index:
                candidate = source_index[key]
                break

        if not candidate:
            unresolved.append({
                "sku": sku,
                "mpn": mpn,
                "name": (row.get("Name") or "").strip(),
                "brand": (row.get("Brands") or "").strip(),
                "reason": "no_source_match",
            })
            continue

        if is_blocked_url(candidate):
            blocked_candidates += 1
            unresolved.append({
                "sku": sku,
                "mpn": mpn,
                "name": (row.get("Name") or "").strip(),
                "brand": (row.get("Brands") or "").strip(),
                "reason": "blocked_domain",
                "candidate": candidate,
            })
            continue

        if args.download_convert:
            filename_stem = sanitize_filename(sku or mpn or row.get("Name") or "product")
            webp_filename = f"{filename_stem}.webp"
            target_webp = output_dir / webp_filename

            with tempfile.TemporaryDirectory(prefix="dtb-img-") as tmp_dir:
                tmp_input = Path(tmp_dir) / "source-image"
                download_file(candidate, tmp_input)
                convert_to_webp_with_sharp(tmp_input, target_webp, args.webp_quality, frontend_dir)

            row["Images"] = f"{args.uploads_base_url.rstrip('/')}/{webp_filename}"
        else:
            row["Images"] = candidate

        replaced += 1

    report = {
        "catalog": str(catalog_path),
        "total_rows": len(rows),
        "missing_or_placeholder_rows": missing_total,
        "replaced_rows": replaced,
        "blocked_candidates": blocked_candidates,
        "unresolved_count": len(unresolved),
        "unresolved": unresolved,
        "blocked_domains": sorted(BLOCKED_DOMAINS),
        "download_convert": args.download_convert,
        "output_dir": str(output_dir) if args.download_convert else None,
    }

    report_path = Path(args.report_json)
    report_path.parent.mkdir(parents=True, exist_ok=True)
    report_path.write_text(json.dumps(report, indent=2), encoding="utf-8")

    if args.write:
        with catalog_path.open("w", encoding="utf-8", newline="") as handle:
            writer = csv.DictWriter(handle, fieldnames=fieldnames)
            writer.writeheader()
            writer.writerows(rows)

        if args.sync_server_copy:
            server_copy = repo_root / "frontend/server/wp-catalog.csv"
            if server_copy.exists():
                with server_copy.open("w", encoding="utf-8", newline="") as handle:
                    writer = csv.DictWriter(handle, fieldnames=fieldnames)
                    writer.writeheader()
                    writer.writerows(rows)

    print(f"Catalog rows: {len(rows)}")
    print(f"Missing/placeholder rows: {missing_total}")
    print(f"Rows replaced: {replaced}")
    print(f"Unresolved rows: {len(unresolved)}")
    print(f"Blocked candidates skipped: {blocked_candidates}")
    print(f"Report: {report_path}")
    if args.download_convert:
        print(f"Converted WebP files: {output_dir}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
