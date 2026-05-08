from __future__ import annotations

import csv
import hashlib
import json
import re
from collections import defaultdict
from pathlib import Path

try:
    from PIL import Image
except ImportError:  # pragma: no cover - optional runtime dependency
    Image = None


ROOT = Path(__file__).resolve().parents[1]
PRODUCTION_DIR = ROOT / "products/Production"
IMAGES_DIR = PRODUCTION_DIR / "Images"
CATALOG_PATH = PRODUCTION_DIR / "catalogs/official/woocommerce_catalog_production.csv"
REPORTS_DIR = PRODUCTION_DIR / "reports"
SUMMARY_PATH = REPORTS_DIR / "production_images_normalization_summary.json"
MAP_PATH = REPORTS_DIR / "production_images_rename_map.csv"

SUPPORTED_IMAGE_EXTENSIONS = {".webp", ".png", ".jpg", ".jpeg"}


def brand_to_slug(brand: str) -> str:
    return re.sub(r"[^a-z0-9]", "", (brand or "").lower())


def normalize_slug(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", (value or "").lower()).strip("-")


def normalize_sku_key(value: str) -> str:
    return (value or "").split("__", 1)[0].strip().replace(".", "-").lower()


def parse_image_name(filename: str) -> tuple[str, str, int, int | None] | None:
    match = re.match(
        r"^(?P<brand>[a-z0-9]+)-(?P<body>.+?)(?:-|_)(?P<seq>\d{2,3})(?:-dup(?P<dup>\d+))?\.(?P<ext>[a-z0-9]+)$",
        filename,
        re.IGNORECASE,
    )
    if not match:
        return None
    return (
        match.group("brand").lower(),
        match.group("body"),
        int(match.group("seq")),
        int(match.group("dup")) if match.group("dup") else None,
    )


def load_catalog_index() -> dict[str, dict[str, object]]:
    brand_index: dict[str, dict[str, object]] = {}
    with CATALOG_PATH.open(encoding="utf-8-sig", newline="") as handle:
        reader = csv.DictReader(handle)
        for row in reader:
            brand_slug = brand_to_slug(row.get("Brands", ""))
            sku = (row.get("SKU", "").split("__", 1)[0].strip().replace(".", "-"))
            slug = normalize_slug(row.get("Slug", ""))
            if not brand_slug or not sku or not slug:
                continue

            sku_key = sku.lower()
            brand_entry = brand_index.setdefault(
                brand_slug,
                {"by_sku": {}, "by_slug": defaultdict(list), "sorted_sku_keys": []},
            )
            brand_entry["by_sku"][sku_key] = {"sku": sku, "slug": slug}
            brand_entry["by_slug"][slug].append(sku_key)

    for brand_entry in brand_index.values():
        brand_entry["sorted_sku_keys"] = sorted(
            brand_entry["by_sku"].keys(),
            key=lambda value: (-len(value), -value.count("-"), value),
        )

    return brand_index


def fallback_sku_from_body(body: str) -> str:
    body = body.replace("_", "-").strip("-")
    if not body:
        return "UNKNOWN"
    return re.sub(r"[^A-Za-z0-9-]+", "-", body).strip("-").upper() or "UNKNOWN"


def resolve_catalog_entry(
    brand_slug: str,
    body: str,
    catalog_index: dict[str, dict[str, object]],
) -> tuple[str, str, str]:
    brand_entry = catalog_index.get(brand_slug)
    normalized_body = body.replace("_", "-").replace(".", "-").strip("-")
    body_key = normalized_body.lower()

    normalized_match = re.fullmatch(
        r"(?P<slug>[a-z0-9]+(?:-[a-z0-9]+)*)-(?P<sku>[A-Za-z0-9]+(?:-[A-Za-z0-9]+)*)",
        normalized_body,
    )
    if normalized_match:
        return (
            normalized_match.group("sku"),
            normalize_slug(normalized_match.group("slug")),
            "already_normalized",
        )

    if not brand_entry:
        fallback_sku = fallback_sku_from_body(normalized_body)
        return fallback_sku, normalize_slug(normalized_body), "fallback_no_brand"

    by_sku = brand_entry["by_sku"]
    by_slug = brand_entry["by_slug"]
    sorted_sku_keys: list[str] = brand_entry["sorted_sku_keys"]

    exact = by_sku.get(body_key)
    if exact:
        return exact["sku"], exact["slug"], "direct_sku"

    for sku_key in sorted_sku_keys:
        if body_key.endswith(f"-{sku_key}"):
            matched = by_sku[sku_key]
            return matched["sku"], matched["slug"], "suffix_sku"

    body_slug = normalize_slug(normalized_body)
    if body_slug in by_slug and len(by_slug[body_slug]) == 1:
        matched = by_sku[by_slug[body_slug][0]]
        return matched["sku"], matched["slug"], "slug_lookup"

    trimmed = re.sub(rf"^{re.escape(brand_slug)}-", "", body_slug)
    if trimmed in by_slug and len(by_slug[trimmed]) == 1:
        matched = by_sku[by_slug[trimmed][0]]
        return matched["sku"], matched["slug"], "slug_lookup_trimmed"

    for prefix in ("the-", "a-", "an-"):
        if body_slug.startswith(prefix):
            candidate = body_slug[len(prefix) :]
            if candidate in by_slug and len(by_slug[candidate]) == 1:
                matched = by_sku[by_slug[candidate][0]]
                return matched["sku"], matched["slug"], "slug_lookup_article_trimmed"

    fallback_sku = fallback_sku_from_body(normalized_body)
    return fallback_sku, normalize_slug(normalized_body), "fallback_body"


def choose_seq_width(items: list[dict[str, object]]) -> int:
    max_width = 2
    for item in items:
        max_width = max(max_width, len(str(int(item["seq_value"]))))
    if any(item["dup"] is not None for item in items):
        return max(3, max_width)
    return max_width


def build_rename_map(
    catalog_index: dict[str, dict[str, object]],
) -> tuple[dict[str, str], list[dict[str, str]], dict[str, int]]:
    groups: dict[tuple[str, str, str], list[dict[str, object]]] = defaultdict(list)
    unresolved: list[dict[str, str]] = []
    resolution_method_counts: dict[str, int] = defaultdict(int)

    for path in sorted(IMAGES_DIR.iterdir(), key=lambda value: value.name.lower()):
        if not path.is_file() or path.suffix.lower() not in SUPPORTED_IMAGE_EXTENSIONS:
            continue

        parsed = parse_image_name(path.name)
        if not parsed:
            unresolved.append({"file_name": path.name, "reason": "unparsed_name"})
            continue

        brand_slug, body, seq_value, dup_value = parsed
        sku, slug, method = resolve_catalog_entry(brand_slug, body, catalog_index)
        resolution_method_counts[method] += 1
        if not slug:
            slug = normalize_slug(body) or "image"
        groups[(brand_slug, slug, sku)].append(
            {
                "name": path.name,
                "seq_value": seq_value,
                "dup": dup_value,
            }
        )

    rename_map: dict[str, str] = {}
    occupied_names = {
        path.name
        for path in IMAGES_DIR.iterdir()
        if path.is_file() and path.suffix.lower() in SUPPORTED_IMAGE_EXTENSIONS
    }
    rename_source_names = {
        str(item["name"])
        for group_items in groups.values()
        for item in group_items
    }

    for (brand_slug, slug, sku), items in sorted(groups.items()):
        seq_width = choose_seq_width(items)
        used_sequences: set[int] = set()
        planned_targets: set[str] = set()
        next_sequence = 1

        sorted_items = sorted(
            items,
            key=lambda item: (
                1 if item["dup"] is not None else 0,
                int(item["seq_value"]),
                int(item["dup"]) if item["dup"] is not None else 0,
                str(item["name"]),
            ),
        )

        for item in sorted_items:
            source_name = str(item["name"])
            if item["dup"] is None and int(item["seq_value"]) not in used_sequences:
                seq_value = int(item["seq_value"])
                used_sequences.add(seq_value)
            else:
                while next_sequence in used_sequences:
                    next_sequence += 1
                seq_value = next_sequence
                used_sequences.add(seq_value)
                next_sequence += 1

            target_name = f"{brand_slug}-{slug}-{sku}-{str(seq_value).zfill(seq_width)}.webp"

            while (
                target_name in planned_targets
                or (target_name in occupied_names and target_name not in rename_source_names)
            ):
                while next_sequence in used_sequences:
                    next_sequence += 1
                seq_value = next_sequence
                used_sequences.add(seq_value)
                next_sequence += 1
                target_name = f"{brand_slug}-{slug}-{sku}-{str(seq_value).zfill(seq_width)}.webp"

            planned_targets.add(target_name)
            if source_name != target_name:
                rename_map[source_name] = target_name

    return rename_map, unresolved, dict(resolution_method_counts)


def same_content(path_a: Path, path_b: Path) -> bool:
    if path_a.stat().st_size != path_b.stat().st_size:
        return False
    hash_a = hashlib.sha256(path_a.read_bytes()).digest()
    hash_b = hashlib.sha256(path_b.read_bytes()).digest()
    return hash_a == hash_b


def convert_image_to_webp(source_path: Path, target_path: Path, original_suffix: str) -> None:
    if original_suffix.lower() == ".webp":
        source_path.rename(target_path)
        return

    if Image is None:
        raise RuntimeError(
            f"Pillow is required to convert '{source_path.name}' to WebP. Install with: pip install Pillow"
        )

    with Image.open(source_path) as image:
        if image.mode in ("RGBA", "LA", "P"):
            converted = image.convert("RGBA")
        else:
            converted = image.convert("RGB")
        converted.save(target_path, "WEBP", quality=90, method=6)
    source_path.unlink()


def rename_files(rename_map: dict[str, str]) -> tuple[int, int]:
    renamed = 0
    converted_to_webp = 0
    staged: list[tuple[Path, Path, Path, str]] = []

    for source_name in rename_map:
        source_path = IMAGES_DIR / source_name
        if not source_path.exists():
            continue
        temp_path = source_path.with_name(source_path.name + ".tmp_normalize")
        source_path.rename(temp_path)
        target_path = IMAGES_DIR / rename_map[source_name]
        staged.append((temp_path, source_path, target_path, source_path.suffix))

    for temp_path, original_source_path, target_path, original_suffix in staged:
        if target_path.exists():
            if same_content(temp_path, target_path):
                temp_path.unlink()
                renamed += 1
                continue
            temp_path.rename(original_source_path)
            continue

        convert_image_to_webp(temp_path, target_path, original_suffix)
        if original_suffix.lower() != ".webp":
            converted_to_webp += 1
        renamed += 1

    return renamed, converted_to_webp


def update_catalog_images(catalog_index: dict[str, dict[str, object]]) -> tuple[int, int]:
    with CATALOG_PATH.open(encoding="utf-8-sig", newline="") as handle:
        reader = csv.DictReader(handle)
        fieldnames = list(reader.fieldnames or [])
        rows = list(reader)

    images_by_brand_sku: dict[tuple[str, str], list[str]] = defaultdict(list)
    for path in sorted(IMAGES_DIR.glob("*.webp"), key=lambda value: value.name.lower()):
        parsed = parse_image_name(path.name)
        if not parsed:
            continue
        brand_slug, body, _, _ = parsed
        sku, _, _ = resolve_catalog_entry(brand_slug, body, catalog_index)
        images_by_brand_sku[(brand_slug, normalize_sku_key(sku))].append(path.name)

    children_by_parent: dict[tuple[str, str], list[dict[str, str]]] = defaultdict(list)
    for row in rows:
        row_type = (row.get("Type") or "").strip().lower()
        brand_slug = brand_to_slug(row.get("Brands", ""))
        parent_key = normalize_sku_key(row.get("Parent", "") or row.get("Parent SKU", ""))
        if row_type == "variation" and brand_slug and parent_key:
            children_by_parent[(brand_slug, parent_key)].append(row)

    url_prefix = "https://drywalltoolbox.com/wp-content/uploads/product-images/"
    rows_updated = 0
    image_references = 0

    for row in rows:
        row_type = (row.get("Type") or "").strip().lower()
        brand_slug = brand_to_slug(row.get("Brands", ""))
        sku_key = normalize_sku_key(row.get("SKU", ""))
        if not brand_slug or not sku_key:
            continue

        own_images = list(images_by_brand_sku.get((brand_slug, sku_key), []))
        new_images: list[str] = []

        if row_type == "variable":
            for child in children_by_parent.get((brand_slug, sku_key), []):
                child_key = normalize_sku_key(child.get("SKU", ""))
                for image_name in images_by_brand_sku.get((brand_slug, child_key), []):
                    if image_name not in new_images:
                        new_images.append(image_name)
        if own_images:
            for image_name in own_images:
                if image_name not in new_images:
                    new_images.append(image_name)

        images_value = " | ".join(f"{url_prefix}{image_name}" for image_name in new_images)
        variation_image_value = f"{url_prefix}{new_images[0]}" if new_images and row_type == "variation" else ""

        if row.get("Images", "") != images_value:
            row["Images"] = images_value
            rows_updated += 1
        if row.get("Variation image", "") != variation_image_value:
            row["Variation image"] = variation_image_value
            rows_updated += 1

        image_references += len(new_images)

    with CATALOG_PATH.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)

    return rows_updated, image_references


def write_rename_map(rename_map: dict[str, str]) -> None:
    REPORTS_DIR.mkdir(parents=True, exist_ok=True)
    with MAP_PATH.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.writer(handle)
        writer.writerow(["old_file_name", "new_file_name"])
        for source_name, target_name in sorted(rename_map.items()):
            writer.writerow([source_name, target_name])


def main() -> None:
    catalog_index = load_catalog_index()
    rename_map, unresolved, resolution_method_counts = build_rename_map(catalog_index)
    renamed, converted_to_webp = rename_files(rename_map)
    catalog_rows_updated, catalog_image_references = update_catalog_images(catalog_index)
    write_rename_map(rename_map)

    summary = {
        "directory": str(IMAGES_DIR.relative_to(ROOT)).replace("\\", "/"),
        "catalog": str(CATALOG_PATH.relative_to(ROOT)).replace("\\", "/"),
        "candidate_renames": len(rename_map),
        "files_renamed": renamed,
        "converted_to_webp": converted_to_webp,
        "catalog_rows_updated": catalog_rows_updated,
        "catalog_image_references": catalog_image_references,
        "resolution_methods": resolution_method_counts,
        "unparsed_files": len(unresolved),
        "rename_map_csv": str(MAP_PATH.relative_to(ROOT)).replace("\\", "/"),
        "sample_renames": [
            {"old": source_name, "new": target_name}
            for source_name, target_name in list(sorted(rename_map.items()))[:50]
        ],
        "sample_unparsed": unresolved[:50],
    }
    SUMMARY_PATH.write_text(json.dumps(summary, indent=2), encoding="utf-8")
    print(json.dumps(summary, indent=2))


if __name__ == "__main__":
    main()
