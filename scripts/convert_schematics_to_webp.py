#!/usr/bin/env python3
"""
convert_schematics_to_webp.py
─────────────────────────────
Batch-converts all schematic PNG and JPG images under public/brands/*/Schematics/
to WebP format, placing the output files alongside the originals.

Dependencies:
    pip install Pillow

Usage (run from repo root):
    python scripts/convert_schematics_to_webp.py

Options:
    --quality   WebP quality 0-100 (default: 90, lossless for diagrams)
    --lossless  Force lossless compression for all images
    --dry-run   Print what would be converted without writing files
    --overwrite Overwrite existing .webp files (default: skip)

Output:
    Each source image foo.png → foo.webp next to the original.
    The originals are NOT deleted — remove them manually once you've confirmed
    the .webp files look correct and are uploaded to WordPress Media Library.
"""

import argparse
import sys
from pathlib import Path

try:
    from PIL import Image
except ImportError:
    sys.exit(
        "ERROR: Pillow is required.  Install it with:  pip install Pillow\n"
    )

# Repo-root relative paths to search for schematic images
SEARCH_ROOTS = [
    Path("public/brands"),
]
SCHEMATIC_DIR_NAME = "Schematics"
SOURCE_EXTENSIONS = {".png", ".jpg", ".jpeg"}
WEBP_QUALITY_DEFAULT = 90


def convert_image(src: Path, quality: int, lossless: bool, overwrite: bool, dry_run: bool) -> str:
    """Convert a single image to WebP.  Returns a status string."""
    dest = src.with_suffix(".webp")

    if dest.exists() and not overwrite:
        return f"  SKIP  {src.relative_to(Path.cwd())} (already exists)"

    if dry_run:
        return f"  DRY   {src.relative_to(Path.cwd())} → {dest.name}"

    try:
        with Image.open(src) as img:
            # Preserve transparency (RGBA) or convert to RGB for JPEG sources.
            if img.mode in ("RGBA", "LA"):
                save_kwargs = {"format": "WEBP", "quality": quality, "lossless": lossless, "method": 6}
            else:
                rgb = img.convert("RGB")
                save_kwargs = {"format": "WEBP", "quality": quality, "lossless": lossless, "method": 6}
                img = rgb

            img.save(dest, **save_kwargs)

        src_kb  = src.stat().st_size  / 1024
        dest_kb = dest.stat().st_size / 1024
        saving  = (1 - dest_kb / src_kb) * 100 if src_kb else 0
        return (
            f"  OK    {src.relative_to(Path.cwd())} "
            f"({src_kb:.0f} KB → {dest_kb:.0f} KB, -{saving:.0f}%)"
        )
    except Exception as exc:  # noqa: BLE001
        return f"  ERROR {src.relative_to(Path.cwd())}: {exc}"


def main() -> None:
    parser = argparse.ArgumentParser(description="Convert schematic images to WebP")
    parser.add_argument("--quality",   type=int,  default=WEBP_QUALITY_DEFAULT, help="WebP quality 0-100")
    parser.add_argument("--lossless",  action="store_true", help="Lossless WebP for all images")
    parser.add_argument("--dry-run",   action="store_true", help="Print plan without writing files")
    parser.add_argument("--overwrite", action="store_true", help="Overwrite existing .webp files")
    args = parser.parse_args()

    repo_root = Path(__file__).parent.parent.resolve()

    sources: list[Path] = []
    for root in SEARCH_ROOTS:
        abs_root = repo_root / root
        if not abs_root.exists():
            print(f"WARNING: search root not found: {abs_root}")
            continue
        for p in sorted(abs_root.rglob("*")):
            if (
                p.is_file()
                and p.suffix.lower() in SOURCE_EXTENSIONS
                and SCHEMATIC_DIR_NAME in p.parts
                and p.name != "schematic_data.json"
            ):
                sources.append(p)

    if not sources:
        print("No schematic images found.  Nothing to do.")
        return

    print(f"Found {len(sources)} schematic image(s) to process.\n")

    ok = skip = error = 0
    for src in sources:
        status = convert_image(src, args.quality, args.lossless, args.overwrite, args.dry_run)
        print(status)
        if "  OK  " in status:
            ok += 1
        elif "  SKIP" in status:
            skip += 1
        elif "  DRY " in status:
            ok += 1
        else:
            error += 1

    print(f"\n{'Dry-run summary' if args.dry_run else 'Summary'}:")
    print(f"  {'Would convert' if args.dry_run else 'Converted'}: {ok}")
    print(f"  Skipped : {skip}")
    print(f"  Errors  : {error}")

    if not args.dry_run and ok > 0:
        print(
            "\nNext step: run  python scripts/upload_schematics_to_wp.py"
            "  to upload the .webp files to WordPress Media Library."
        )


if __name__ == "__main__":
    main()
