from __future__ import annotations

import argparse
import csv
import re
from collections import OrderedDict
from dataclasses import dataclass
from io import BytesIO
from pathlib import Path
from typing import Iterable

import requests
from PIL import Image


USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/124.0.0.0 Safari/537.36"
)


@dataclass
class ProductImage:
    brand: str
    sku: str
    universal_sku: str
    name: str
    url: str


@dataclass
class ManifestRow:
    brand: str
    sku: str
    universal_sku: str
    name: str
    source_url: str
    output_file: str
    status: str
    error: str


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Download product images from a brand CSV and convert to WebP using universal product image keying.",
    )
    parser.add_argument(
        "--csv",
        default=r"d:\AMD\projects\drywall-toolbox\products\scraped_results\brands\Level5\level5_variable_variation_with_toolset_contents_enriched_image_urls_fixed.csv",
        help="Input CSV path.",
    )
    parser.add_argument(
        "--output-dir",
        default=r"d:\AMD\projects\drywall-toolbox\products\Production\launch\launch_images",
        help="Directory where .webp files are written.",
    )
    parser.add_argument(
        "--manifest",
        default=r"d:\AMD\projects\drywall-toolbox\products\Production\launch\reports\level5_image_download_manifest_fixed_run.csv",
        help="Manifest CSV output path.",
    )
    parser.add_argument("--quality", type=int, default=88, help="WebP quality (0-100).")
    parser.add_argument("--timeout", type=int, default=45, help="HTTP timeout seconds.")
    parser.add_argument("--retries", type=int, default=3, help="Retry attempts per URL.")
    parser.add_argument(
        "--overwrite",
        action="store_true",
        help="Overwrite existing destination files. Default is skip existing.",
    )
    return parser.parse_args()


def slugify(value: str) -> str:
    val = (value or "").strip().lower()
    val = re.sub(r"[^a-z0-9]+", "_", val)
    val = re.sub(r"_+", "_", val).strip("_")
    return val


def split_piped_urls(cell: str) -> Iterable[str]:
    if not cell:
        return []
    return [u.strip() for u in str(cell).split("|") if u.strip()]


def gather_row_urls(row: dict[str, str]) -> list[str]:
    ordered = OrderedDict()

    for key in ("image_url_1", "image_url_2", "image_url_3"):
        u = (row.get(key) or "").strip()
        if u.startswith(("http://", "https://")):
            ordered[u] = None

    for u in split_piped_urls(row.get("image_gallery_urls", "")):
        if u.startswith(("http://", "https://")):
            ordered[u] = None

    return list(ordered.keys())


def universal_product_key(row: dict[str, str]) -> str:
    """
    Universal image key rules:
    - toolset_component rows use component_sku (or normalized_sku fallback)
    - everything else uses sku (or normalized_sku fallback)
    """
    row_type = (row.get("row_type") or "").strip().lower()
    sku = (row.get("sku") or "").strip()
    normalized_sku = (row.get("normalized_sku") or "").strip()

    if row_type == "toolset_component":
        component_sku = (row.get("component_sku") or "").strip()
        if component_sku:
            return component_sku

        if normalized_sku:
            return normalized_sku

        if "::" in sku:
            return sku.split("::", 1)[1].strip()

    return sku or normalized_sku


def build_work_items(csv_path: Path) -> list[ProductImage]:
    grouped: dict[str, dict[str, object]] = {}

    with csv_path.open("r", encoding="utf-8-sig", newline="") as fh:
        reader = csv.DictReader(fh)
        for row in reader:
            urls = gather_row_urls(row)
            if not urls:
                continue

            brand = (row.get("brand") or "").strip()
            sku = (row.get("sku") or "").strip()
            name = (row.get("name") or "").strip()
            universal_sku = universal_product_key(row)

            if not brand or not universal_sku:
                continue

            base = f"{slugify(brand)}_{slugify(universal_sku)}"
            if not base.strip("_"):
                continue

            bucket = grouped.setdefault(
                base,
                {
                    "brand": brand,
                    "sku": sku,
                    "universal_sku": universal_sku,
                    "name": name,
                    "urls": OrderedDict(),
                },
            )

            bucket_urls: OrderedDict[str, None] = bucket["urls"]  # type: ignore[assignment]
            for u in urls:
                bucket_urls[u] = None

    work: list[ProductImage] = []
    for base, meta in grouped.items():
        urls: list[str] = list(meta["urls"].keys())  # type: ignore[index]
        for url in urls:
            work.append(
                ProductImage(
                    brand=str(meta["brand"]),
                    sku=str(meta["sku"]),
                    universal_sku=str(meta["universal_sku"]),
                    name=str(meta["name"]),
                    url=url,
                )
            )
    return work


def save_webp_from_bytes(image_bytes: bytes, destination: Path, quality: int) -> None:
    with Image.open(BytesIO(image_bytes)) as im:
        if im.mode not in ("RGB", "RGBA"):
            im = im.convert("RGBA" if "A" in im.getbands() else "RGB")
        im.save(destination, format="WEBP", quality=quality, method=6)


def download_bytes(session: requests.Session, url: str, timeout: int, retries: int) -> bytes:
    last_error = ""
    for attempt in range(1, retries + 1):
        try:
            response = session.get(url, timeout=timeout)
            if response.status_code == 200:
                return response.content
            last_error = f"http_{response.status_code}"
        except Exception as exc:  # noqa: BLE001
            last_error = str(exc)

        if attempt < retries:
            continue

    raise RuntimeError(last_error or "download_failed")


def write_manifest(path: Path, rows: list[ManifestRow]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8", newline="") as fh:
        writer = csv.DictWriter(
            fh,
            fieldnames=[
                "brand",
                "sku",
                "universal_sku",
                "name",
                "source_url",
                "output_file",
                "status",
                "error",
            ],
        )
        writer.writeheader()
        for r in rows:
            writer.writerow(
                {
                    "brand": r.brand,
                    "sku": r.sku,
                    "universal_sku": r.universal_sku,
                    "name": r.name,
                    "source_url": r.source_url,
                    "output_file": r.output_file,
                    "status": r.status,
                    "error": r.error,
                }
            )


def main() -> int:
    args = parse_args()

    csv_path = Path(args.csv)
    output_dir = Path(args.output_dir)
    manifest_path = Path(args.manifest)

    if not csv_path.is_file():
        raise FileNotFoundError(f"CSV not found: {csv_path}")

    output_dir.mkdir(parents=True, exist_ok=True)

    work_items = build_work_items(csv_path)

    by_key_counter: dict[str, int] = {}
    manifest_rows: list[ManifestRow] = []

    session = requests.Session()
    session.headers.update({"User-Agent": USER_AGENT})

    for item in work_items:
        key_base = f"{slugify(item.brand)}_{slugify(item.universal_sku)}"
        seq = by_key_counter.get(key_base, 0) + 1
        by_key_counter[key_base] = seq

        output_name = f"{key_base}_{seq:02d}.webp"
        output_path = output_dir / output_name

        if output_path.exists() and not args.overwrite:
            manifest_rows.append(
                ManifestRow(
                    brand=item.brand,
                    sku=item.sku,
                    universal_sku=item.universal_sku,
                    name=item.name,
                    source_url=item.url,
                    output_file=str(output_path),
                    status="exists",
                    error="",
                )
            )
            continue

        try:
            image_bytes = download_bytes(session, item.url, timeout=args.timeout, retries=args.retries)
            save_webp_from_bytes(image_bytes, output_path, quality=args.quality)
            manifest_rows.append(
                ManifestRow(
                    brand=item.brand,
                    sku=item.sku,
                    universal_sku=item.universal_sku,
                    name=item.name,
                    source_url=item.url,
                    output_file=str(output_path),
                    status="ok",
                    error="",
                )
            )
        except Exception as exc:  # noqa: BLE001
            manifest_rows.append(
                ManifestRow(
                    brand=item.brand,
                    sku=item.sku,
                    universal_sku=item.universal_sku,
                    name=item.name,
                    source_url=item.url,
                    output_file=str(output_path),
                    status="failed",
                    error=str(exc),
                )
            )

    write_manifest(manifest_path, manifest_rows)

    ok_count = sum(1 for r in manifest_rows if r.status == "ok")
    exists_count = sum(1 for r in manifest_rows if r.status == "exists")
    fail_count = sum(1 for r in manifest_rows if r.status == "failed")

    print(f"CSV={csv_path}")
    print(f"OUTPUT_DIR={output_dir}")
    print(f"MANIFEST={manifest_path}")
    print(f"TOTAL_WORK_ITEMS={len(manifest_rows)}")
    print(f"OK={ok_count}")
    print(f"EXISTS={exists_count}")
    print(f"FAILED={fail_count}")

    return 0 if fail_count == 0 else 2


if __name__ == "__main__":
    raise SystemExit(main())
