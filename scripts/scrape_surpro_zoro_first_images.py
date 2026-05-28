from __future__ import annotations

import argparse
import csv
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable
from urllib.parse import urljoin

import cloudscraper
import requests
from bs4 import BeautifulSoup


USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/124.0.0.0 Safari/537.36"
)


@dataclass
class ProductRow:
    brand: str
    category: str
    product_name: str
    mpn: str


@dataclass
class ResultRow:
    mpn: str
    product_name: str
    search_url: str
    zoro_product_url: str
    found_mfr: str
    first_image_url: str
    image_file: str
    status: str
    error: str


@dataclass
class SearchProduct:
    mfr: str
    product_url: str
    first_image_url: str


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Scrape Zoro SurPro products by MPN and download first product image.",
    )
    parser.add_argument(
        "--input-csv",
        default=r"d:\AMD\projects\drywall-toolbox\products\catalogs\missing_products.csv",
        help="CSV containing missing products with Brand and MPN columns.",
    )
    parser.add_argument(
        "--output-dir",
        default=r"d:\AMD\projects\drywall-toolbox\products\Production\launch\launch_images\surpro",
        help="Directory to store downloaded first images.",
    )
    parser.add_argument(
        "--manifest",
        default=r"d:\AMD\projects\drywall-toolbox\products\Production\launch\reports\surpro_zoro_first_images_manifest.csv",
        help="Output manifest CSV path.",
    )
    parser.add_argument("--timeout", type=int, default=45)
    parser.add_argument(
        "--search-url",
        default="https://www.zoro.com/search?q=surpro",
        help="Zoro search URL that contains SurPro products.",
    )
    return parser.parse_args()


def slugify(value: str) -> str:
    v = (value or "").strip().lower()
    v = re.sub(r"[^a-z0-9]+", "_", v)
    v = re.sub(r"_+", "_", v).strip("_")
    return v


def normalize_mpn(value: str) -> str:
    return re.sub(r"[^A-Z0-9]", "", (value or "").upper())


def read_surpro_rows(path: Path) -> list[ProductRow]:
    rows: list[ProductRow] = []
    with path.open("r", encoding="utf-8-sig", newline="") as fh:
        reader = csv.DictReader(fh)
        for row in reader:
            brand = (row.get("Brand") or "").strip()
            mpn = (row.get("MPN") or "").strip()
            if brand.lower() != "surpro" or not mpn:
                continue
            rows.append(
                ProductRow(
                    brand=brand,
                    category=(row.get("Category") or "").strip(),
                    product_name=(row.get("Product_Name") or "").strip(),
                    mpn=mpn,
                )
            )
    return rows


def parse_mfr(text: str) -> str:
    flattened = " ".join((text or "").split())
    m = re.search(r"Mfr\s*#\s*([A-Za-z0-9\-]+)", flattened, flags=re.IGNORECASE)
    return m.group(1).strip() if m else ""


def extract_products_from_search(search_html: str) -> dict[str, SearchProduct]:
    soup = BeautifulSoup(search_html, "lxml")
    cards = soup.select("div.product-card")

    by_mpn: dict[str, SearchProduct] = {}

    for card in cards:
        text = card.get_text(" ", strip=True)
        mfr = parse_mfr(text)
        if not mfr:
            continue

        a = card.find("a", href=True)
        if not a:
            continue

        img = card.find("img", src=True)
        if not img:
            continue

        product_url = urljoin("https://www.zoro.com", a["href"].strip())
        image_url = urljoin("https://www.zoro.com", img["src"].strip())
        key = normalize_mpn(mfr)

        by_mpn[key] = SearchProduct(
            mfr=mfr,
            product_url=product_url,
            first_image_url=image_url,
        )

    return by_mpn


def fetch_surpro_index(search_url: str, timeout: int) -> dict[str, SearchProduct]:
    scraper = cloudscraper.create_scraper(
        browser={"browser": "chrome", "platform": "windows", "desktop": True}
    )

    resp = scraper.get(search_url, timeout=timeout)
    if resp.status_code != 200:
        raise RuntimeError(f"search_http_{resp.status_code}")
    if "Please enable JS and disable any ad blocker" in resp.text:
        raise RuntimeError("search_blocked_by_waf")

    index = extract_products_from_search(resp.text)
    if not index:
        raise RuntimeError("no_products_found_on_search_page")
    return index


def download_image(session: requests.Session, url: str, out_path: Path, timeout: int) -> None:
    r = session.get(url, timeout=timeout)
    if r.status_code != 200:
        raise RuntimeError(f"image_http_{r.status_code}")
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_bytes(r.content)


def pick_extension(url: str) -> str:
    m = re.search(r"\.([a-zA-Z0-9]{2,5})(?:\?|$)", url)
    ext = m.group(1).lower() if m else "jpg"
    if ext not in {"jpg", "jpeg", "png", "webp", "gif", "bmp", "tif", "tiff"}:
        ext = "jpg"
    return ext


def write_manifest(path: Path, rows: Iterable[ResultRow]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8", newline="") as fh:
        writer = csv.DictWriter(
            fh,
            fieldnames=[
                "mpn",
                "product_name",
                "search_url",
                "zoro_product_url",
                "found_mfr",
                "first_image_url",
                "image_file",
                "status",
                "error",
            ],
        )
        writer.writeheader()
        for r in rows:
            writer.writerow(
                {
                    "mpn": r.mpn,
                    "product_name": r.product_name,
                    "search_url": r.search_url,
                    "zoro_product_url": r.zoro_product_url,
                    "found_mfr": r.found_mfr,
                    "first_image_url": r.first_image_url,
                    "image_file": r.image_file,
                    "status": r.status,
                    "error": r.error,
                }
            )


def main() -> int:
    args = parse_args()

    input_csv = Path(args.input_csv)
    output_dir = Path(args.output_dir)
    manifest_path = Path(args.manifest)

    if not input_csv.is_file():
        raise FileNotFoundError(f"Input CSV not found: {input_csv}")

    rows = read_surpro_rows(input_csv)

    product_index = fetch_surpro_index(args.search_url, timeout=args.timeout)

    session = requests.Session()
    session.headers.update({"User-Agent": USER_AGENT, "Referer": args.search_url})

    out_rows: list[ResultRow] = []

    for row in rows:
        search_url = ""
        product_url = ""
        found_mfr = ""
        first_img = ""
        image_file = ""

        try:
            search_url = args.search_url
            target = normalize_mpn(row.mpn)
            matched = product_index.get(target)
            if not matched:
                raise RuntimeError("mpn_not_found_on_search_page")

            product_url = matched.product_url
            found_mfr = matched.mfr
            first_img = matched.first_image_url
            if not first_img:
                raise RuntimeError("first_image_not_found")

            ext = pick_extension(first_img)
            out_name = f"surpro_{slugify(row.mpn)}_01.{ext}"
            out_path = output_dir / out_name
            download_image(session, first_img, out_path, timeout=args.timeout)
            image_file = str(out_path)

            out_rows.append(
                ResultRow(
                    mpn=row.mpn,
                    product_name=row.product_name,
                    search_url=search_url,
                    zoro_product_url=product_url,
                    found_mfr=found_mfr,
                    first_image_url=first_img,
                    image_file=image_file,
                    status="ok",
                    error="",
                )
            )
        except Exception as exc:  # noqa: BLE001
            out_rows.append(
                ResultRow(
                    mpn=row.mpn,
                    product_name=row.product_name,
                    search_url=search_url,
                    zoro_product_url=product_url,
                    found_mfr=found_mfr,
                    first_image_url=first_img,
                    image_file=image_file,
                    status="failed",
                    error=str(exc),
                )
            )

    write_manifest(manifest_path, out_rows)

    ok_count = sum(1 for r in out_rows if r.status == "ok")
    fail_count = sum(1 for r in out_rows if r.status == "failed")

    print(f"INPUT={input_csv}")
    print(f"SURPRO_MPN_ROWS={len(rows)}")
    print(f"OK={ok_count}")
    print(f"FAILED={fail_count}")
    print(f"OUTPUT_DIR={output_dir}")
    print(f"MANIFEST={manifest_path}")

    return 0 if fail_count == 0 else 2


if __name__ == "__main__":
    raise SystemExit(main())
