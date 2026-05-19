#!/usr/bin/env python3
from __future__ import annotations

import csv
import json
import re
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parents[1]

OFFICIAL_CSV = ROOT / "products" / "Production" / "catalogs" / "other" / "official_brand_catalog_combined.csv"
TAPETECH_WEB_CSV = ROOT / "products" / "scraped_results" / "brands" / "TapeTech" / "wp-catalog.csv"
COLUMBIA_WEB_CSV = ROOT / "products" / "scraped_results" / "brands" / "Columbia" / "wp-columbia-catalog.csv"
COLUMBIA_FAMILIES_CSV = ROOT / "products" / "scraped_results" / "brands" / "Columbia" / "catalog-families.csv"
COLUMBIA_IMAGE_MANIFEST = ROOT / "products" / "scraped_results" / "brands" / "Columbia" / "images" / "manifest.csv"
TSW_CSV = ROOT / "products" / "scraped_results" / "tsw_output" / "tsw_all_brands.csv"
TAPETECH_AMES_CSV = ROOT / "products" / "scraped_results" / "brands" / "TapeTech" / "old" / "tapetech_master_catalog.csv"

OUT_CSV = ROOT / "products" / "Production" / "catalogs" / "official" / "woocommerce_catalog_initial_launch_tapetech_columbia.csv"
OUT_AUDIT_MD = ROOT / "products" / "reports" / "audits" / "official_vs_tswfast_tapetech_columbia_audit.md"
OUT_AUDIT_CSV = ROOT / "products" / "reports" / "audits" / "official_vs_tswfast_tapetech_columbia_discrepancies.csv"

WOO_FIELDS = [
    "ID",
    "Type",
    "SKU",
    "Slug",
    "Name",
    "Published",
    "Visibility in catalog",
    "Short description",
    "Description",
    "Regular price",
    "Sale price",
    "Tax status",
    "In stock?",
    "Categories",
    "Images",
    "Brands",
    "Attribute 1 name",
    "Attribute 1 value(s)",
    "Attribute 1 visible",
    "Attribute 1 global",
    "Attribute 2 name",
    "Attribute 2 value(s)",
    "Attribute 2 visible",
    "Attribute 2 global",
    "Meta: source_catalog",
    "Meta: source_catalog_pages",
    "Meta: source_validation",
    "Meta: official_sku_raw",
    "Meta: tsw_match_status",
    "Meta: tsw_name_mismatch",
]


def clean_text(value: str) -> str:
    return re.sub(r"\s+", " ", (value or "").replace("\xa0", " ")).strip()


def normalize_sku(value: str) -> str:
    return re.sub(r"[^A-Z0-9]", "", clean_text(value).upper())


def normalize_name(value: str) -> str:
    return re.sub(r"[^a-z0-9]", "", clean_text(value).lower())


def slugify(value: str) -> str:
    value = clean_text(value).lower().replace("&", " and ")
    value = re.sub(r"[^a-z0-9]+", "-", value)
    return value.strip("-")


def first_sentence(value: str, max_len: int = 220) -> str:
    value = clean_text(value)
    if not value:
        return ""
    m = re.search(r"(.+?[.!?])(?:\s|$)", value)
    out = clean_text(m.group(1)) if m else value
    if len(out) <= max_len:
        return out
    trimmed = clean_text(out[: max_len - 1].rsplit(" ", 1)[0])
    return trimmed if re.search(r"[.!?]$", trimmed) else f"{trimmed}."


def csv_rows(path: Path) -> list[dict[str, str]]:
    with path.open(encoding="utf-8-sig", newline="", errors="replace") as fh:
        return list(csv.DictReader(fh))


def parse_columbia_source_pages(text: str) -> list[str]:
    text = clean_text(text)
    if "Source pages:" not in text:
        return []
    tail = text.split("Source pages:", 1)[1]
    return [u.strip() for u in tail.split("|") if u.strip().startswith("http")]


def host_matches_domain(host: str, domain: str) -> bool:
    host = host.lower()
    domain = domain.lower()
    return host == domain or host.endswith(f".{domain}")


def allowed_image(url: str, brand: str) -> bool:
    host = (urlparse(url).hostname or "").lower()
    if brand == "TapeTech":
        return host_matches_domain(host, "tapetech.com") or host_matches_domain(host, "shopamestools.com")
    return host_matches_domain(host, "columbiatools.com")


def build_tapetech_lookup(rows: list[dict[str, str]]) -> dict[str, dict[str, str]]:
    lookup: dict[str, dict[str, str]] = {}
    for row in rows:
        key = normalize_sku(row.get("SKU", ""))
        if not key:
            continue
        if key not in lookup or len(clean_text(row.get("Description", ""))) > len(clean_text(lookup[key].get("Description", ""))):
            lookup[key] = row
    return lookup


def build_tapetech_ames_lookup(rows: list[dict[str, str]]) -> dict[str, dict[str, str]]:
    lookup: dict[str, dict[str, str]] = {}
    for row in rows:
        for raw_key in (row.get("MPN", ""), row.get("SKU", "")):
            key = normalize_sku(raw_key)
            if not key:
                continue
            if key not in lookup:
                lookup[key] = row
    return lookup


def build_columbia_lookups(
    web_rows: list[dict[str, str]], family_rows: list[dict[str, str]], image_rows: list[dict[str, str]]
) -> tuple[dict[str, dict[str, str]], dict[str, list[str]], dict[str, list[str]], dict[str, list[str]]]:
    sku_lookup: dict[str, dict[str, str]] = {}
    for row in web_rows:
        key = normalize_sku(row.get("SKU", ""))
        if not key:
            continue
        if key not in sku_lookup or len(clean_text(row.get("Description", ""))) > len(clean_text(sku_lookup[key].get("Description", ""))):
            sku_lookup[key] = row

    images_by_tool_url: dict[str, list[str]] = defaultdict(list)
    images_by_sku: dict[str, list[str]] = defaultdict(list)
    sku_to_tool_urls: dict[str, list[str]] = defaultdict(list)
    bad_img_bits = ("video_icon", "warranty")

    for row in image_rows:
        src = clean_text(row.get("source_url", ""))
        tool_url = clean_text(row.get("tool_url", ""))
        if not src or not tool_url:
            continue
        src_l = src.lower()
        if any(bit in src_l for bit in bad_img_bits):
            continue
        if not allowed_image(src, "Columbia"):
            continue
        if src not in images_by_tool_url[tool_url]:
            images_by_tool_url[tool_url].append(src)

        src_norm = normalize_sku(Path(urlparse(src).path).name)
        for maybe in re.findall(r"[A-Z0-9.\-]{2,}", src.upper()):
            sku_key = normalize_sku(maybe)
            if sku_key and sku_key in src_norm and src not in images_by_sku[sku_key]:
                images_by_sku[sku_key].append(src)

    for row in family_rows:
        member_urls = [clean_text(u) for u in (row.get("member_urls", "") or "").split("|") if clean_text(u).startswith("http")]
        variants_json = row.get("variants_json", "") or "[]"
        try:
            variants = json.loads(variants_json)
        except json.JSONDecodeError:
            variants = []
        for variant in variants:
            sku_key = normalize_sku(str(variant.get("sku", "")))
            if not sku_key:
                continue
            tool_url = clean_text(str(variant.get("url", "")))
            if tool_url.startswith("http"):
                if tool_url not in sku_to_tool_urls[sku_key]:
                    sku_to_tool_urls[sku_key].append(tool_url)
            for member_url in member_urls:
                if member_url not in sku_to_tool_urls[sku_key]:
                    sku_to_tool_urls[sku_key].append(member_url)

    return sku_lookup, images_by_tool_url, images_by_sku, sku_to_tool_urls


def category_for(brand: str, section: str) -> str:
    section_name = clean_text(section.split(";", 1)[0].split("/", 1)[0]) or "Tools"
    brand_label = "Columbia Tools" if brand == "Columbia" else brand
    return f"Drywall Finishing Tools > {brand_label} > {section_name}"


def fallback_description(row: dict[str, str]) -> str:
    brand = clean_text(row.get("brand", ""))
    name = clean_text(row.get("product_name", ""))
    section = clean_text(row.get("section", ""))
    pages = clean_text(row.get("source_catalog_pages", ""))
    line = clean_text(row.get("source_lines", ""))
    parts = [f"Official {brand} catalog item: {name}."]
    if section:
        parts.append(f"Section: {section}.")
    if line:
        parts.append(f"Source listing: {line}.")
    if pages:
        parts.append(f"Catalog page(s): {pages}.")
    return " ".join(parts)


def build() -> None:
    official_rows = [
        row
        for row in csv_rows(OFFICIAL_CSV)
        if row.get("brand") in {"TapeTech", "Columbia"} and row.get("launch_candidate") == "1"
    ]
    tapetech_lookup = build_tapetech_lookup(csv_rows(TAPETECH_WEB_CSV))
    tapetech_ames_lookup = build_tapetech_ames_lookup(csv_rows(TAPETECH_AMES_CSV))
    columbia_lookup, columbia_images_by_tool_url, columbia_images_by_sku, columbia_sku_to_tool_urls = build_columbia_lookups(
        csv_rows(COLUMBIA_WEB_CSV),
        csv_rows(COLUMBIA_FAMILIES_CSV),
        csv_rows(COLUMBIA_IMAGE_MANIFEST),
    )

    tsw_rows = [
        row
        for row in csv_rows(TSW_CSV)
        if clean_text(row.get("Brands", "")) in {"TapeTech", "Columbia"}
    ]
    tsw_by_key: dict[tuple[str, str], dict[str, str]] = {}
    for row in tsw_rows:
        key = (clean_text(row.get("Brands", "")), normalize_sku(row.get("SKU", "")))
        if key[0] and key[1] and key not in tsw_by_key:
            tsw_by_key[key] = row

    discrepancies: list[dict[str, str]] = []
    out_rows: list[dict[str, str]] = []
    official_keys: set[tuple[str, str]] = set()

    for row in sorted(official_rows, key=lambda r: (r.get("brand", ""), normalize_sku(r.get("official_sku", "")))):
        brand = clean_text(row.get("brand", ""))
        sku_raw = clean_text(row.get("official_sku", ""))
        sku_key = normalize_sku(sku_raw)
        sku = sku_key
        official_keys.add((brand, sku_key))

        web_name = ""
        web_desc = ""
        web_images: list[str] = []
        reg_price = ""
        sale_price = ""

        if brand == "TapeTech":
            ames_src = tapetech_ames_lookup.get(sku_key, {})
            web_name = clean_text(ames_src.get("Name", ""))
            web_desc = clean_text(ames_src.get("Description", ""))
            reg_price = clean_text(ames_src.get("Regular price", ""))
            sale_price = clean_text(ames_src.get("Sale price", ""))
            for part in re.split(r"\s*\|\s*", ames_src.get("Images", "") or ""):
                img = clean_text(part)
                if img and allowed_image(img, brand) and img not in web_images:
                    web_images.append(img)

            src = tapetech_lookup.get(sku_key, {})
            if not web_name:
                web_name = clean_text(src.get("Name", ""))
            if not web_desc:
                web_desc = clean_text(src.get("Description", ""))
            if not reg_price:
                reg_price = clean_text(src.get("Regular price", ""))
            if not sale_price:
                sale_price = clean_text(src.get("Sale price", ""))
            for part in re.split(r"\s*\|\s*", src.get("Images", "") or ""):
                img = clean_text(part)
                if img and allowed_image(img, brand) and img not in web_images:
                    web_images.append(img)

        else:
            src = columbia_lookup.get(sku_key, {})
            web_name = clean_text(src.get("Name", ""))
            web_desc = clean_text(re.sub(r"<[^>]+>", " ", src.get("Description", "") or ""))

            for img in columbia_images_by_sku.get(sku_key, []):
                if img not in web_images:
                    web_images.append(img)
            if not web_images:
                for tool_url in parse_columbia_source_pages(src.get("Description", "")):
                    for img in columbia_images_by_tool_url.get(tool_url, []):
                        if img not in web_images:
                            web_images.append(img)
            if not web_images:
                for tool_url in columbia_sku_to_tool_urls.get(sku_key, []):
                    for img in columbia_images_by_tool_url.get(tool_url, []):
                        if img not in web_images:
                            web_images.append(img)

        official_name = clean_text(row.get("product_name", ""))
        name = official_name or web_name or sku
        desc = web_desc or fallback_description(row)
        short_desc = first_sentence(desc)

        tsw = tsw_by_key.get((brand, sku_key))
        tsw_status = "matched" if tsw else "missing_in_tsw"
        name_mismatch = ""
        if tsw:
            tsw_name = clean_text(tsw.get("Name", ""))
            if tsw_name and normalize_name(tsw_name) != normalize_name(name):
                name_mismatch = "1"
                discrepancies.append(
                    {
                        "brand": brand,
                        "official_sku": sku_raw,
                        "normalized_sku": sku_key,
                        "issue_type": "name_mismatch",
                        "official_name": name,
                        "tsw_name": tsw_name,
                        "official_present": "1",
                        "tsw_present": "1",
                        "notes": "Official and TSW names differ after normalization.",
                    }
                )
        else:
            discrepancies.append(
                {
                    "brand": brand,
                    "official_sku": sku_raw,
                    "normalized_sku": sku_key,
                    "issue_type": "missing_in_tsw",
                    "official_name": name,
                    "tsw_name": "",
                    "official_present": "1",
                    "tsw_present": "0",
                    "notes": "Official launch candidate SKU not found in TSW listing by normalized SKU.",
                }
            )

        brand_label = "Columbia Tools" if brand == "Columbia" else brand
        is_priced = bool(clean_text(reg_price))
        published = "1" if is_priced else "0"
        visibility = "visible" if is_priced else "hidden"
        in_stock = "1"
        out_rows.append(
            {
                "ID": "",
                "Type": "simple",
                "SKU": sku,
                "Slug": slugify(f"{brand_label} {name} {sku}"),
                "Name": f"{brand_label} {name}" if brand_label.lower() not in name.lower() else name,
                "Published": published,
                "Visibility in catalog": visibility,
                "Short description": short_desc,
                "Description": desc,
                "Regular price": reg_price,
                "Sale price": sale_price,
                "Tax status": "taxable",
                "In stock?": in_stock,
                "Categories": category_for(brand, row.get("section", "")),
                "Images": ", ".join(web_images),
                "Brands": brand_label,
                "Attribute 1 name": "Official Section",
                "Attribute 1 value(s)": clean_text(row.get("section", "")),
                "Attribute 1 visible": "1",
                "Attribute 1 global": "0",
                "Attribute 2 name": "Catalog Item Type",
                "Attribute 2 value(s)": clean_text(row.get("catalog_item_type", "")),
                "Attribute 2 visible": "1",
                "Attribute 2 global": "0",
                "Meta: source_catalog": clean_text(row.get("source_pdf", "")),
                "Meta: source_catalog_pages": clean_text(row.get("source_catalog_pages", "")),
                "Meta: source_validation": clean_text(row.get("source_validation", "")),
                "Meta: official_sku_raw": sku_raw,
                "Meta: tsw_match_status": tsw_status,
                "Meta: tsw_name_mismatch": name_mismatch,
            }
        )

    for (brand, sku_key), tsw in sorted(tsw_by_key.items()):
        if (brand, sku_key) in official_keys:
            continue
        discrepancies.append(
            {
                "brand": brand,
                "official_sku": "",
                "normalized_sku": sku_key,
                "issue_type": "extra_in_tsw",
                "official_name": "",
                "tsw_name": clean_text(tsw.get("Name", "")),
                "official_present": "0",
                "tsw_present": "1",
                "notes": "TSW SKU is not present in official launch-candidate catalog by normalized SKU.",
            }
        )

    OUT_CSV.parent.mkdir(parents=True, exist_ok=True)
    OUT_AUDIT_MD.parent.mkdir(parents=True, exist_ok=True)

    with OUT_CSV.open("w", encoding="utf-8", newline="") as fh:
        writer = csv.DictWriter(fh, fieldnames=WOO_FIELDS)
        writer.writeheader()
        writer.writerows(out_rows)

    discrepancy_fields = [
        "brand",
        "official_sku",
        "normalized_sku",
        "issue_type",
        "official_name",
        "tsw_name",
        "official_present",
        "tsw_present",
        "notes",
    ]
    with OUT_AUDIT_CSV.open("w", encoding="utf-8", newline="") as fh:
        writer = csv.DictWriter(fh, fieldnames=discrepancy_fields)
        writer.writeheader()
        writer.writerows(discrepancies)

    by_issue: dict[str, int] = defaultdict(int)
    by_brand: dict[str, dict[str, int]] = defaultdict(lambda: defaultdict(int))
    for row in discrepancies:
        issue = row["issue_type"]
        brand = row["brand"]
        by_issue[issue] += 1
        by_brand[brand][issue] += 1

    launch_counts: dict[str, int] = defaultdict(int)
    image_counts: dict[str, int] = defaultdict(int)
    for row in out_rows:
        brand = row["Brands"]
        launch_counts[brand] += 1
        if clean_text(row.get("Images", "")):
            image_counts[brand] += 1

    lines = [
        "# Official vs TSWFast Catalog Audit (TapeTech + Columbia)",
        "",
        f"Generated: {datetime.now(timezone.utc).isoformat(timespec='seconds')}",
        "",
        "## Source of Truth",
        "- TapeTech official catalog source used in-repo: `products/scraped_results/brands/TapeTech/old/tapetech_master_catalog.csv` (shopamestools.com catalog scrape), with fallback enrichment from `products/scraped_results/brands/TapeTech/wp-catalog.csv`.",
        "- Columbia official catalog source used in-repo: `products/Production/catalogs/other/official_brand_catalog_combined.csv` + Columbia page/image mappings from `products/scraped_results/brands/Columbia/catalog-families.csv` and `products/scraped_results/brands/Columbia/images/manifest.csv`.",
        "- Distributor comparison source: `products/scraped_results/tsw_output/tsw_all_brands.csv`.",
        "",
        "## Launch WooCommerce CSV Output",
        f"- `{OUT_CSV.relative_to(ROOT)}`",
        f"- Total launch products: **{len(out_rows)}**",
        f"- TapeTech launch products: **{launch_counts.get('TapeTech', 0)}**",
        f"- Columbia Tools launch products: **{launch_counts.get('Columbia Tools', 0)}**",
        f"- TapeTech rows with authorized images: **{image_counts.get('TapeTech', 0)}**",
        f"- Columbia Tools rows with authorized images: **{image_counts.get('Columbia Tools', 0)}**",
        "",
        "## TSWFast Discrepancy Summary",
        f"- Missing in TSW (official launch SKU not found): **{by_issue.get('missing_in_tsw', 0)}**",
        f"- Extra in TSW (not in official launch catalog): **{by_issue.get('extra_in_tsw', 0)}**",
        f"- Name mismatches for matched SKUs: **{by_issue.get('name_mismatch', 0)}**",
        "",
        "### By Brand",
    ]

    for brand in sorted(by_brand):
        lines.append(
            f"- {brand}: missing_in_tsw={by_brand[brand].get('missing_in_tsw', 0)}, "
            f"extra_in_tsw={by_brand[brand].get('extra_in_tsw', 0)}, "
            f"name_mismatch={by_brand[brand].get('name_mismatch', 0)}"
        )

    lines.extend(
        [
            "",
            "## Detailed Discrepancies",
            f"- `{OUT_AUDIT_CSV.relative_to(ROOT)}`",
            "",
            "## Notes",
            "- Official manufacturer naming/SKU from the official catalog extract is preserved in the launch CSV.",
            "- TSWFast is used strictly for audit/comparison metadata (`Meta: tsw_*`) and discrepancy reporting.",
        ]
    )

    OUT_AUDIT_MD.write_text("\n".join(lines) + "\n", encoding="utf-8")

    print(f"wrote_csv={OUT_CSV}")
    print(f"wrote_audit_md={OUT_AUDIT_MD}")
    print(f"wrote_audit_csv={OUT_AUDIT_CSV}")
    print(f"rows={len(out_rows)}")
    print(json.dumps(dict(by_issue), indent=2))


if __name__ == "__main__":
    build()
