#!/usr/bin/env python3
"""
build_wc_catalog.py — Production WooCommerce catalog builder.

Reads products/scraped_results/wc-catalog.csv and applies:
  1. TapeTech update candidates (short descriptions, categories, names where flagged)
  2. TapeTech missing products (new simple + variable/variation groups)
  3. Columbia update candidates (names, categories)
  4. Columbia missing products (NPK/OPPK/3NPK variable families + singles)
  5. Columbia ICA/BF/CSH: upgrade simple → variable with child variations

Writes back to products/scraped_results/wc-catalog.csv.
Audit summary → products/reports/wc-catalog-audit-summary.md
"""

import csv
import json
import os
import sys
from pathlib import Path
from copy import deepcopy

# ── Paths ─────────────────────────────────────────────────────────────────────
REPO = Path(__file__).resolve().parent.parent
WC   = REPO / "products/scraped_results/wc-catalog.csv"
REPORTS = REPO / "products/reports"

TT_CATALOG    = REPORTS / "brands/TapeTech/tapetech_drywall_catalog_products.csv"
TT_UPDATE_UC  = REPORTS / "brands/TapeTech/wc_catalog_tapetech_update_candidates.csv"
TT_MISSING    = REPORTS / "brands/TapeTech/wc_catalog_tapetech_missing_reference_products.csv"
TT_WPCATALOG  = REPO / "products/scraped_results/TapeTech/wp-catalog.csv"

COL_UPDATE_UC = REPORTS / "brands/Columbia/wc_catalog_exported_columbia_update_candidates.csv"
COL_MISSING   = REPORTS / "brands/Columbia/wc_catalog_exported_columbia_missing_reference_products.csv"
COL_CATALOG   = REPO / "products/scraped_results/Columbia/columbia_tools_structure/wp-columbia-catalog-with-images.csv"

AUDIT_OUT = REPORTS / "wc-catalog-audit-summary.md"

# ── WooCommerce column order (56 cols, matches current wc-catalog.csv) ────────
WC_COLS = [
    "Type", "SKU", "GTIN, UPC, EAN, or ISBN", "Name", "Published",
    "Is featured?", "Visibility in catalog", "Short description", "Description",
    "Date sale price starts", "Date sale price ends", "Tax status", "Tax class",
    "In stock?", "Stock", "Low stock amount", "Backorders allowed?",
    "Sold individually?", "Weight (lbs)", "Length (in)", "Width (in)", "Height (in)",
    "Allow customer reviews?", "Purchase note", "Sale price", "Regular price",
    "Categories", "Tags", "Shipping class", "Images",
    "Download limit", "Download expiry days", "Parent",
    "Grouped products", "Upsells", "Cross-sells", "External URL", "Button text",
    "Position", "Brands",
    "Attribute 1 name", "Attribute 1 value(s)", "Attribute 1 visible", "Attribute 1 global",
    "Attribute 2 name", "Attribute 2 value(s)", "Attribute 2 visible", "Attribute 2 global",
    "Meta: _dtb_seo_title", "Meta: _dtb_seo_description", "Meta: _mpn",
    "Meta: _veeqo_sellable_id", "Meta: _veeqo_mapped_sku",
    "Meta: _dtb_seo_focus_kw", "Meta: _dtb_seo_canonical", "Meta: _dtb_seo_noindex",
]

# ── Helpers ───────────────────────────────────────────────────────────────────

def blank_row():
    return {c: "" for c in WC_COLS}


def tt_defaults(extra=None):
    """Return default field values for a TapeTech product row."""
    d = blank_row()
    d.update({
        "Published": "1",
        "Is featured?": "0",
        "Visibility in catalog": "visible",
        "Tax status": "taxable",
        "In stock?": "1",
        "Backorders allowed?": "0",
        "Sold individually?": "0",
        "Allow customer reviews?": "1",
        "Brands": "TapeTech",
        "Attribute 1 name": "Brand",
        "Attribute 1 value(s)": "TapeTech",
        "Attribute 1 visible": "1",
        "Attribute 1 global": "1",
    })
    if extra:
        d.update(extra)
    return d


def col_defaults(extra=None):
    """Return default field values for a Columbia Taping Tools product row."""
    d = blank_row()
    d.update({
        "Published": "1",
        "Is featured?": "0",
        "Visibility in catalog": "visible",
        "Tax status": "taxable",
        "In stock?": "1",
        "Backorders allowed?": "0",
        "Sold individually?": "0",
        "Allow customer reviews?": "1",
        "Brands": "Columbia Taping Tools",
        "Attribute 1 name": "Brand",
        "Attribute 1 value(s)": "Columbia Taping Tools",
        "Attribute 1 visible": "1",
        "Attribute 1 global": "1",
    })
    if extra:
        d.update(extra)
    return d


def tt_cat(mapping_cat, mapping_sub, mapping_prod):
    """Build TapeTech category path from catalog mapping."""
    parts = ["Drywall Finishing Tools", "TapeTech"]
    for p in (mapping_cat, mapping_sub, mapping_prod):
        if p and p.strip():
            parts.append(p.strip())
    return " > ".join(parts)


def read_csv(path):
    rows = []
    with open(path, encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for r in reader:
            rows.append(r)
    return rows


def write_csv(path, rows):
    with open(path, "w", encoding="utf-8", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=WC_COLS, quoting=csv.QUOTE_ALL,
                                extrasaction="ignore")
        writer.writeheader()
        writer.writerows(rows)


def imgs_from_json(json_str):
    """Parse enrichment_images_json → comma-separated URL string."""
    if not json_str:
        return ""
    try:
        lst = json.loads(json_str)
        return ", ".join(lst)
    except Exception:
        return ""


def next_position(rows):
    """Return max Position + 1."""
    vals = []
    for r in rows:
        try:
            vals.append(int(r.get("Position", 0) or 0))
        except ValueError:
            pass
    return (max(vals) if vals else 0) + 1


# ── Load source data ──────────────────────────────────────────────────────────

def load_all():
    wc_rows = read_csv(WC)
    tt_catalog_map = {r["model"]: r for r in read_csv(TT_CATALOG)}
    tt_update_uc   = read_csv(TT_UPDATE_UC)
    tt_missing     = read_csv(TT_MISSING)
    tt_wp_map      = {r["SKU"]: r for r in read_csv(TT_WPCATALOG)}
    col_update_uc  = read_csv(COL_UPDATE_UC)
    col_missing    = read_csv(COL_MISSING)
    col_cat_map    = {r["SKU"]: r for r in read_csv(COL_CATALOG)}
    col_cat_all    = read_csv(COL_CATALOG)
    return (wc_rows, tt_catalog_map, tt_update_uc, tt_missing, tt_wp_map,
            col_update_uc, col_missing, col_cat_map, col_cat_all)


# ═══════════════════════════════════════════════════════════════════════════════
# STEP 1 — Apply TapeTech update candidates
# ═══════════════════════════════════════════════════════════════════════════════

def apply_tt_updates(wc_rows, tt_update_uc, tt_catalog_map):
    """
    Apply updates to existing TapeTech rows based on update candidates.
    Returns (updated_rows, summary_list)
    """
    # Index wc rows by SKU for fast lookup
    sku_idx = {r["SKU"]: i for i, r in enumerate(wc_rows)}
    mpn_idx = {r.get("Meta: _mpn", ""): i for i, r in enumerate(wc_rows) if r.get("Meta: _mpn")}

    updates = []

    for uc in tt_update_uc:
        wc_sku = uc.get("wc_sku", "")
        wc_mpn = uc.get("wc_mpn", "")

        # Find the row
        idx = sku_idx.get(wc_sku)
        if idx is None:
            idx = mpn_idx.get(wc_mpn)
        if idx is None:
            continue

        row = wc_rows[idx]
        changed = []

        # Update name if flagged and different
        if uc.get("can_update_name") == "1":
            new_name = uc.get("proposed_name", "").strip()
            if new_name and new_name != row.get("Name", ""):
                row["Name"] = new_name
                changed.append("name")

        # Update short description if empty/flagged
        if uc.get("can_update_short_description") == "1":
            new_sd = uc.get("proposed_short_description", "").strip()
            if not new_sd:
                new_sd = uc.get("reference_enrichment_short_description", "").strip()
            if new_sd and new_sd != row.get("Short description", ""):
                row["Short description"] = new_sd
                changed.append("short_description")

        # Update categories if flagged
        if uc.get("can_update_categories") == "1":
            new_cat = uc.get("proposed_categories", "").strip()
            if not new_cat:
                # Build from mapping fields
                new_cat = tt_cat(
                    uc.get("reference_mapping_category", ""),
                    uc.get("reference_mapping_subcategory", ""),
                    uc.get("reference_mapping_product", ""),
                )
            if new_cat and new_cat != row.get("Categories", ""):
                row["Categories"] = new_cat
                changed.append("categories")

        if changed:
            updates.append((wc_sku, wc_mpn, "TapeTech", ", ".join(changed)))
            wc_rows[idx] = row

    return wc_rows, updates


# ═══════════════════════════════════════════════════════════════════════════════
# STEP 2 — Add missing TapeTech products
# ═══════════════════════════════════════════════════════════════════════════════

def build_tt_variable_row(sku, name, short_desc, desc, categories, images,
                           weight, attr2_name, attr2_values, price, position, tags=""):
    """Build a TapeTech variable parent row."""
    r = tt_defaults()
    r.update({
        "Type": "variable",
        "SKU": sku,
        "Name": name,
        "Short description": short_desc,
        "Description": desc,
        "Categories": categories,
        "Images": images,
        "Weight (lbs)": weight,
        "Stock": "100",
        "Regular price": str(price) if price else "",
        "Position": str(position),
        "Tags": tags,
        "Attribute 2 name": attr2_name,
        "Attribute 2 value(s)": attr2_values,
        "Attribute 2 visible": "1",
        "Attribute 2 global": "1",
        "Meta: _mpn": sku,
        "Meta: _dtb_seo_title": name,
    })
    return r


def build_tt_variation_row(sku, name, parent_sku, attr2_name, attr2_value,
                            price, images, position, weight=""):
    """Build a TapeTech variation child row."""
    r = tt_defaults()
    r.update({
        "Type": "variation",
        "SKU": sku,
        "Name": name,
        "Parent": parent_sku,
        "Regular price": str(price) if price else "",
        "Stock": "0",
        "Images": images,
        "Weight (lbs)": weight,
        "Position": str(position),
        "Attribute 1 visible": "",
        "Attribute 2 name": attr2_name,
        "Attribute 2 value(s)": attr2_value,
        "Attribute 2 global": "1",
        "Meta: _mpn": sku,
        "Meta: _dtb_seo_title": name,
    })
    return r


def build_tt_simple_row(sku, name, short_desc, desc, categories, images,
                         weight, price, position, tags="", length="", width="", height=""):
    """Build a TapeTech simple product row."""
    r = tt_defaults()
    r.update({
        "Type": "simple",
        "SKU": sku,
        "Name": name,
        "Short description": short_desc,
        "Description": desc,
        "Categories": categories,
        "Images": images,
        "Weight (lbs)": weight,
        "Length (in)": length,
        "Width (in)": width,
        "Height (in)": height,
        "Stock": "100",
        "Regular price": str(price) if price else "",
        "Position": str(position),
        "Tags": tags,
        "Meta: _mpn": sku,
        "Meta: _dtb_seo_title": name,
    })
    return r


def enrich(model, tt_catalog_map, tt_wp_map):
    """Gather enrichment data for a TT model from all sources."""
    cat = tt_catalog_map.get(model, {})
    wp  = tt_wp_map.get(model, {})
    return {
        "name":      (cat.get("enrichment_name") or wp.get("Name") or "").strip(),
        "short_desc": (cat.get("enrichment_short_description") or "").strip(),
        "desc":      (cat.get("enrichment_description") or wp.get("Description") or "").strip(),
        "price":     cat.get("enrichment_price", "") or "",
        "images":    imgs_from_json(cat.get("enrichment_images_json", "")),
        "weight":    wp.get("Weight (lbs)", ""),
        "length":    wp.get("Length (in)", ""),
        "width":     wp.get("Width (in)", ""),
        "height":    wp.get("Height (in)", ""),
    }


def add_missing_tt(wc_rows, tt_missing, tt_catalog_map, tt_wp_map):
    """Build and append rows for missing TapeTech products."""
    existing_skus = {r["SKU"] for r in wc_rows}
    existing_mpns = {r.get("Meta: _mpn", "") for r in wc_rows}
    added = []
    pos = next_position(wc_rows)

    # Helper to check if already present
    def present(sku):
        return sku in existing_skus or sku in existing_mpns

    # Build a lookup of missing SKUs for easy reference
    missing_map = {r["reference_model"]: r for r in tt_missing}

    # ── 1. Angle Head Repair Kits — variable group ────────────────────────────
    repair_kits = [
        ("501F2A",  '2"',   "TapeTech 2\" Angle Head Repair Kit 501F2A",   enrich("501F2A",  tt_catalog_map, tt_wp_map)),
        ("501F25A", '2.5"', "TapeTech 2.5\" Angle Head Repair Kit 501F25A", enrich("501F25A", tt_catalog_map, tt_wp_map)),
        ("501F3A",  '3"',   "TapeTech 3\" Angle Head Repair Kit 501F3A",   enrich("501F3A",  tt_catalog_map, tt_wp_map)),
    ]
    if not any(present(sku) for sku, *_ in repair_kits):
        cat = "Drywall Finishing Tools > TapeTech > Automatic Taping & Finishing Tools > Corner Finishers > Angle Head Repair Kits"
        parent_sku = "501F-REPAIR-TT"
        all_imgs = ", ".join(filter(None, [e["images"] for _, _, _, e in repair_kits]))
        var_row = build_tt_variable_row(
            sku=parent_sku,
            name='TapeTech Angle Head Repair Kits',
            short_desc='TapeTech angle head repair kits for 2", 2.5", and 3" corner finishers.',
            desc='<p>TapeTech Angle Head Repair Kits provide all the hardware needed to restore your angle head to factory condition. Available for 2", 2.5", and 3" heads. Each kit includes blade tension spring, center clip assembly, and set screws.</p>',
            categories=cat,
            images=all_imgs,
            weight="0.15",
            attr2_name="Size",
            attr2_values=' | '.join(s for _, s, *_ in repair_kits),
            price="",
            position=pos,
            tags="angle head repair, corner finisher kit",
        )
        wc_rows.append(var_row)
        added.append((parent_sku, var_row["Name"]))
        pos += 1
        for sku, size, name, e in repair_kits:
            if not present(sku):
                wc_rows.append(build_tt_variation_row(
                    sku=sku, name=name, parent_sku=parent_sku,
                    attr2_name="Size", attr2_value=size,
                    price=e["price"], images=e["images"],
                    position=pos, weight=e["weight"],
                ))
                added.append((sku, name))
                pos += 1
                existing_skus.add(sku)
        existing_skus.add(parent_sku)

    # ── 2. Angle Head Blade Kits — variable group ─────────────────────────────
    blade_kits = [
        ("502F2",  '2"',   "TapeTech 2\" Angle Head Blade Kit 502F2",   enrich("502F2",  tt_catalog_map, tt_wp_map)),
        ("502F25", '2.5"', "TapeTech 2.5\" Angle Head Blade Kit 502F25", enrich("502F25", tt_catalog_map, tt_wp_map)),
        ("502F3",  '3"',   "TapeTech 3\" Angle Head Blade Kit 502F3",   enrich("502F3",  tt_catalog_map, tt_wp_map)),
    ]
    if not any(present(sku) for sku, *_ in blade_kits):
        cat = "Drywall Finishing Tools > TapeTech > Automatic Taping & Finishing Tools > Corner Finishers > Angle Head Blade Kits"
        parent_sku = "502F-BLADES-TT"
        all_imgs = ", ".join(filter(None, [e["images"] for _, _, _, e in blade_kits]))
        var_row = build_tt_variable_row(
            sku=parent_sku,
            name='TapeTech Angle Head Blade Kits',
            short_desc='Replacement carbide blade kits for TapeTech 2", 2.5", and 3" angle heads.',
            desc='<p>TapeTech Angle Head Blade Kits include carbide blades, stainless skids, and all hardware for replacement. Available for 2", 2.5", and 3" angle heads.</p>',
            categories=cat,
            images=all_imgs,
            weight="0.15",
            attr2_name="Size",
            attr2_values=' | '.join(s for _, s, *_ in blade_kits),
            price="",
            position=pos,
            tags="angle head blade, corner finisher blades, carbide blade",
        )
        wc_rows.append(var_row)
        added.append((parent_sku, var_row["Name"]))
        pos += 1
        for sku, size, name, e in blade_kits:
            if not present(sku):
                wc_rows.append(build_tt_variation_row(
                    sku=sku, name=name, parent_sku=parent_sku,
                    attr2_name="Size", attr2_value=size,
                    price=e["price"], images=e["images"],
                    position=pos, weight=e["weight"],
                ))
                added.append((sku, name))
                pos += 1
                existing_skus.add(sku)
        # 502F2X — 2" Corner Finisher Blade Change Kit (for 40XTT) — simple
        if not present("502F2X"):
            wc_rows.append(build_tt_simple_row(
                sku="502F2X",
                name='TapeTech 2" Corner Finisher Blade Change Kit (502F2X)',
                short_desc='Blade change kit for the TapeTech 40XTT 2" Corner Finisher.',
                desc='<p>The TapeTech 502F2X Blade Change Kit is designed for use with the 40XTT 2" Corner Finisher. Includes all hardware needed for a complete blade replacement.</p>',
                categories=cat,
                images="",
                weight="0.15",
                price="",
                position=pos,
                tags="502F2X, blade change kit, corner finisher",
            ))
            added.append(("502F2X", 'TapeTech 2" Corner Finisher Blade Change Kit (502F2X)'))
            pos += 1
            existing_skus.add("502F2X")
        existing_skus.add(parent_sku)

    # ── 3. Cove Applicator Heads — variable group ─────────────────────────────
    cove_heads = [
        ("CH55TT", "55 mm", "TapeTech 55 mm Cove Applicator Head CH55TT", enrich("CH55TT", tt_catalog_map, tt_wp_map)),
        ("CH75TT", "75 mm", "TapeTech 75 mm Cove Applicator Head CH75TT", enrich("CH75TT", tt_catalog_map, tt_wp_map)),
        ("CH83TT", "83 mm", "TapeTech 83 mm Cove Applicator Head CH83TT", enrich("CH83TT", tt_catalog_map, tt_wp_map)),
        ("CH90TT", "90 mm", "TapeTech 90 mm Cove Applicator Head CH90TT", enrich("CH90TT", tt_catalog_map, tt_wp_map)),
    ]
    if not any(present(sku) for sku, *_ in cove_heads):
        cat = "Drywall Finishing Tools > TapeTech > Automatic Taping & Finishing Tools > Applicator Heads > Cove Applicator Head"
        parent_sku = "CHTT"
        all_imgs = ", ".join(filter(None, [e["images"] for _, _, _, e in cove_heads]))
        var_row = build_tt_variable_row(
            sku=parent_sku,
            name="TapeTech Cove Applicator Heads",
            short_desc=cove_heads[0][3]["short_desc"] or "TapeTech Cove Applicator Heads apply a bead of gypsum cove adhesive in precisely the right location.",
            desc='<p>TapeTech Cove Applicator Heads apply a bead of gypsum cove adhesive in precisely the right location for optimal adhesion of cove moulding. Available in 55 mm, 75 mm, 83 mm, and 90 mm sizes to match standard cove profiles.</p>',
            categories=cat,
            images=all_imgs,
            weight="1.8",
            attr2_name="Size",
            attr2_values=" | ".join(s for _, s, *_ in cove_heads),
            price="99",
            position=pos,
            tags="cove applicator head, cove adhesive, CH55TT, CH75TT, CH83TT, CH90TT",
        )
        wc_rows.append(var_row)
        added.append((parent_sku, var_row["Name"]))
        pos += 1
        for sku, size, name, e in cove_heads:
            if not present(sku):
                wc_rows.append(build_tt_variation_row(
                    sku=sku, name=name, parent_sku=parent_sku,
                    attr2_name="Size", attr2_value=size,
                    price=e["price"] or "99",
                    images=e["images"],
                    position=pos, weight=e["weight"] or "1.8",
                ))
                added.append((sku, name))
                pos += 1
                existing_skus.add(sku)
        existing_skus.add(parent_sku)

    # ── 4. Carbon Fiber Extension Box Handles — variable group ────────────────
    cf_handles = [
        ("FBH2642TT-CF", '26"-42"', 'TapeTech Carbon Fiber Extension Box Handle 26" to 42" (FBH2642TT-CF)', enrich("FBH2642TT-CF", tt_catalog_map, tt_wp_map)),
        ("FBH4272TT-CF", '42"-72"', 'TapeTech Carbon Fiber Extension Box Handle 42" to 72" (FBH4272TT-CF)', enrich("FBH4272TT-CF", tt_catalog_map, tt_wp_map)),
    ]
    if not any(present(sku) for sku, *_ in cf_handles):
        cat = "Drywall Finishing Tools > TapeTech > Automatic Taping & Finishing Tools > Box Handles > Carbon Fiber Box Handle"
        parent_sku = "FBH-CF-TT"
        var_row = build_tt_variable_row(
            sku=parent_sku,
            name="TapeTech Carbon Fiber Extension Box Handles",
            short_desc='Lightweight carbon fiber telescoping box handles for TapeTech flat boxes. Extends 26"-42" or 42"-72".',
            desc='<p>TapeTech Carbon Fiber Extension Box Handles provide a lightweight, high-strength alternative for extended reach when finishing drywall. The carbon fiber construction minimizes weight while maximizing durability. Available in two ranges: 26" to 42" (FBH2642TT-CF) and 42" to 72" (FBH4272TT-CF).</p>',
            categories=cat,
            images="",
            weight="",
            attr2_name="Length",
            attr2_values=" | ".join(s for _, s, *_ in cf_handles),
            price="",
            position=pos,
            tags="carbon fiber box handle, extension handle, FBH2642TT-CF, FBH4272TT-CF",
        )
        wc_rows.append(var_row)
        added.append((parent_sku, var_row["Name"]))
        pos += 1
        for sku, length, name, e in cf_handles:
            if not present(sku):
                wc_rows.append(build_tt_variation_row(
                    sku=sku, name=name, parent_sku=parent_sku,
                    attr2_name="Length", attr2_value=length,
                    price=e["price"], images=e["images"],
                    position=pos, weight=e["weight"],
                ))
                added.append((sku, name))
                pos += 1
                existing_skus.add(sku)
        existing_skus.add(parent_sku)

    # ── 5. Radius Trowels — Curved and Straight variable groups ──────────────
    cat_trowels = "Drywall Finishing Tools > TapeTech > Premium Knives & Trowels > Radius Trowels"
    # Curved
    curved = [
        ("RTC20TT", '20"', 'TapeTech 20" Radius Trowel - Curved (RTC20TT)', enrich("RTC20TT", tt_catalog_map, tt_wp_map)),
        ("RTC26TT", '26"', 'TapeTech 26" Radius Trowel - Curved (RTC26TT)', enrich("RTC26TT", tt_catalog_map, tt_wp_map)),
    ]
    if not any(present(sku) for sku, *_ in curved):
        parent_sku = "RTC-TT"
        all_imgs = ", ".join(filter(None, [e["images"] for _, _, _, e in curved]))
        var_row = build_tt_variable_row(
            sku=parent_sku,
            name="TapeTech Curved Radius Trowels",
            short_desc='TapeTech premium curved radius trowels for smooth drywall finishing. Available in 20" and 26".',
            desc='<p>TapeTech Curved Radius Trowels feature a sleek design and traditional look. The curved profile is ideal for feathering joint compound on large flat surfaces. Available in 20" (RTC20TT) and 26" (RTC26TT).</p>',
            categories=cat_trowels,
            images=all_imgs,
            weight="",
            attr2_name="Size",
            attr2_values=" | ".join(s for _, s, *_ in curved),
            price="",
            position=pos,
            tags="radius trowel, curved trowel, RTC20TT, RTC26TT",
        )
        wc_rows.append(var_row)
        added.append((parent_sku, var_row["Name"]))
        pos += 1
        for sku, size, name, e in curved:
            if not present(sku):
                wc_rows.append(build_tt_variation_row(
                    sku=sku, name=name, parent_sku=parent_sku,
                    attr2_name="Size", attr2_value=size,
                    price=e["price"], images=e["images"],
                    position=pos, weight=e["weight"],
                ))
                added.append((sku, name))
                pos += 1
                existing_skus.add(sku)
        existing_skus.add(parent_sku)
    # Straight
    straight = [
        ("RTS20TT", '20"', 'TapeTech 20" Radius Trowel - Straight (RTS20TT)', enrich("RTS20TT", tt_catalog_map, tt_wp_map)),
        ("RTS26TT", '26"', 'TapeTech 26" Radius Trowel - Straight (RTS26TT)', enrich("RTS26TT", tt_catalog_map, tt_wp_map)),
    ]
    if not any(present(sku) for sku, *_ in straight):
        parent_sku = "RTS-TT"
        all_imgs = ", ".join(filter(None, [e["images"] for _, _, _, e in straight]))
        var_row = build_tt_variable_row(
            sku=parent_sku,
            name="TapeTech Straight Radius Trowels",
            short_desc='TapeTech premium straight radius trowels for smooth drywall finishing. Available in 20" and 26".',
            desc='<p>TapeTech Straight Radius Trowels feature a sleek design and traditional look. The straight profile is ideal for feathering joint compound on large flat surfaces. Available in 20" (RTS20TT) and 26" (RTS26TT).</p>',
            categories=cat_trowels,
            images=all_imgs,
            weight="",
            attr2_name="Size",
            attr2_values=" | ".join(s for _, s, *_ in straight),
            price="",
            position=pos,
            tags="radius trowel, straight trowel, RTS20TT, RTS26TT",
        )
        wc_rows.append(var_row)
        added.append((parent_sku, var_row["Name"]))
        pos += 1
        for sku, size, name, e in straight:
            if not present(sku):
                wc_rows.append(build_tt_variation_row(
                    sku=sku, name=name, parent_sku=parent_sku,
                    attr2_name="Size", attr2_value=size,
                    price=e["price"], images=e["images"],
                    position=pos, weight=e["weight"],
                ))
                added.append((sku, name))
                pos += 1
                existing_skus.add(sku)
        existing_skus.add(parent_sku)

    # ── 6. Premium Gold Finishing Trowels (ProSoft Grip) — variable groups ───
    cat_gold = "Drywall Finishing Tools > TapeTech > Premium Knives & Trowels > Premium Gold Trowels"
    # Standard ProSoft 4.3" trowels
    gold_43 = [
        ("TG12053-PS", '12"', 'TapeTech 12" x 4.3" Premium Gold Finishing Trowel', enrich("TG12053-PS", tt_catalog_map, tt_wp_map)),
        ("TG14053-PS", '14"', 'TapeTech 14" x 4.3" Premium Gold Finishing Trowel', enrich("TG14053-PS", tt_catalog_map, tt_wp_map)),
        ("TG16053-PS", '16"', 'TapeTech 16" x 4.3" Premium Gold Finishing Trowel', enrich("TG16053-PS", tt_catalog_map, tt_wp_map)),
        ("TG18053-PS", '18"', 'TapeTech 18" x 4.3" Premium Gold Finishing Trowel', enrich("TG18053-PS", tt_catalog_map, tt_wp_map)),
    ]
    if not any(present(sku) for sku, *_ in gold_43):
        parent_sku = "TG-43-PS-TT"
        all_imgs = ", ".join(filter(None, [e["images"] for _, _, _, e in gold_43[:2]]))
        var_row = build_tt_variable_row(
            sku=parent_sku,
            name='TapeTech Premium Gold Finishing Trowels (4.3" Blade)',
            short_desc='TapeTech Premium Gold Stainless Steel Finishing Trowels with 4.3" ProSoft grip handles.',
            desc='<p>TapeTech Premium Gold Finishing Trowels feature a 4.3" wide gold stainless steel blade and ProSoft ergonomic grip handle. Available in 12", 14", 16", and 18" lengths for professional drywall finishing.</p>',
            categories=cat_gold,
            images=all_imgs,
            weight="1",
            attr2_name="Length",
            attr2_values=" | ".join(s for _, s, *_ in gold_43),
            price="",
            position=pos,
            tags='premium gold trowel, ProSoft grip, TG12053-PS, TG14053-PS, TG16053-PS, TG18053-PS',
        )
        wc_rows.append(var_row)
        added.append((parent_sku, var_row["Name"]))
        pos += 1
        for sku, size, name, e in gold_43:
            if not present(sku):
                wc_rows.append(build_tt_variation_row(
                    sku=sku, name=name, parent_sku=parent_sku,
                    attr2_name="Length", attr2_value=size,
                    price=e["price"], images=e["images"],
                    position=pos, weight=e["weight"],
                ))
                added.append((sku, name))
                pos += 1
                existing_skus.add(sku)
        existing_skus.add(parent_sku)

    # Standard ProSoft 4.7" trowels
    gold_47 = [
        ("TG12054-PS", '12"', 'TapeTech 12" x 4.7" Premium Gold Finishing Trowel', enrich("TG12054-PS", tt_catalog_map, tt_wp_map)),
        ("TG14054-PS", '14"', 'TapeTech 14" x 4.7" Premium Gold Finishing Trowel', enrich("TG14054-PS", tt_catalog_map, tt_wp_map)),
        ("TG16054-PS", '16"', 'TapeTech 16" x 4.7" Premium Gold Finishing Trowel', enrich("TG16054-PS", tt_catalog_map, tt_wp_map)),
        ("TG18054-PS", '18"', 'TapeTech 18" x 4.7" Premium Gold Finishing Trowel', enrich("TG18054-PS", tt_catalog_map, tt_wp_map)),
    ]
    if not any(present(sku) for sku, *_ in gold_47):
        parent_sku = "TG-47-PS-TT"
        all_imgs = ", ".join(filter(None, [e["images"] for _, _, _, e in gold_47[:2]]))
        var_row = build_tt_variable_row(
            sku=parent_sku,
            name='TapeTech Premium Gold Finishing Trowels (4.7" Blade)',
            short_desc='TapeTech Premium Gold Stainless Steel Finishing Trowels with 4.7" ProSoft grip handles.',
            desc='<p>TapeTech Premium Gold Finishing Trowels feature a 4.7" wide gold stainless steel blade and ProSoft ergonomic grip handle. Available in 12", 14", 16", and 18" lengths for professional drywall finishing.</p>',
            categories=cat_gold,
            images=all_imgs,
            weight="1",
            attr2_name="Length",
            attr2_values=" | ".join(s for _, s, *_ in gold_47),
            price="",
            position=pos,
            tags='premium gold trowel, ProSoft grip, TG12054-PS, TG14054-PS, TG16054-PS, TG18054-PS',
        )
        wc_rows.append(var_row)
        added.append((parent_sku, var_row["Name"]))
        pos += 1
        for sku, size, name, e in gold_47:
            if not present(sku):
                wc_rows.append(build_tt_variation_row(
                    sku=sku, name=name, parent_sku=parent_sku,
                    attr2_name="Length", attr2_value=size,
                    price=e["price"], images=e["images"],
                    position=pos, weight=e["weight"],
                ))
                added.append((sku, name))
                pos += 1
                existing_skus.add(sku)
        existing_skus.add(parent_sku)

    # Curved trowels (PSCU)
    gold_curved = [
        ("TG120565-PSCU", '12"', 'TapeTech 12" x 4.7" Premium Gold Curved Finishing Trowel', enrich("TG120565-PSCU", tt_catalog_map, tt_wp_map)),
        ("TG140565-PSCU", '14"', 'TapeTech 14" x 4.7" Premium Gold Curved Finishing Trowel', enrich("TG140565-PSCU", tt_catalog_map, tt_wp_map)),
    ]
    if not any(present(sku) for sku, *_ in gold_curved):
        parent_sku = "TG-CU-PS-TT"
        all_imgs = ", ".join(filter(None, [e["images"] for _, _, _, e in gold_curved]))
        var_row = build_tt_variable_row(
            sku=parent_sku,
            name='TapeTech Premium Gold Curved Finishing Trowels',
            short_desc=gold_curved[0][3]["short_desc"] or 'TapeTech Premium Gold Curved Finishing Trowels — curved blade profile for feathering and tapering.',
            desc='<p>TapeTech Premium Curved Gold Finishing Trowels allow you to professionally feather and taper drywall, EIFS, and stucco joints, leaving extra joint compound where you need it. Available in 12" and 14".</p>',
            categories=cat_gold,
            images=all_imgs,
            weight="",
            attr2_name="Length",
            attr2_values=" | ".join(s for _, s, *_ in gold_curved),
            price="",
            position=pos,
            tags='curved trowel, premium gold trowel, TG120565-PSCU, TG140565-PSCU',
        )
        wc_rows.append(var_row)
        added.append((parent_sku, var_row["Name"]))
        pos += 1
        for sku, size, name, e in gold_curved:
            if not present(sku):
                wc_rows.append(build_tt_variation_row(
                    sku=sku, name=name, parent_sku=parent_sku,
                    attr2_name="Length", attr2_value=size,
                    price=e["price"], images=e["images"],
                    position=pos, weight=e["weight"],
                ))
                added.append((sku, name))
                pos += 1
                existing_skus.add(sku)
        existing_skus.add(parent_sku)

    # Pool trowels (TGP)
    pool_trowels = [
        ("TGP120565-PS", '12"', 'TapeTech 12" x 4.7" Premium Gold Rounded Front Pool Trowel', enrich("TGP120565-PS", tt_catalog_map, tt_wp_map)),
        ("TGP140565-PS", '14"', 'TapeTech 14" x 4.7" Premium Gold Rounded Front Pool Trowel', enrich("TGP140565-PS", tt_catalog_map, tt_wp_map)),
        ("TGP160565-PS", '16"', 'TapeTech 16" x 4.7" Premium Gold Rounded Front Pool Trowel', enrich("TGP160565-PS", tt_catalog_map, tt_wp_map)),
        ("TGP180565-PS", '18"', 'TapeTech 18" x 4.7" Premium Gold Rounded Front Pool Trowel', enrich("TGP180565-PS", tt_catalog_map, tt_wp_map)),
    ]
    if not any(present(sku) for sku, *_ in pool_trowels):
        parent_sku = "TGPTT"
        all_imgs = ", ".join(filter(None, [e["images"] for _, _, _, e in pool_trowels[:2]]))
        var_row = build_tt_variable_row(
            sku=parent_sku,
            name='TapeTech Premium Gold Rounded Front Pool Trowels',
            short_desc=pool_trowels[0][3]["short_desc"] or 'TapeTech Premium Gold Stainless Steel Pool Trowels with two rounded ends for smooth surface application.',
            desc='<p>TapeTech Premium Gold Stainless Steel Pool Trowels are not just for pools! They feature two rounded ends, ideal to generate a smooth application of joint compound, stucco, plaster, and similar materials. Available in 12", 14", 16", and 18" lengths.</p>',
            categories=cat_gold,
            images=all_imgs,
            weight="",
            attr2_name="Length",
            attr2_values=" | ".join(s for _, s, *_ in pool_trowels),
            price="",
            position=pos,
            tags='pool trowel, premium gold trowel, TGP120565-PS, TGP140565-PS, TGP160565-PS, TGP180565-PS',
        )
        wc_rows.append(var_row)
        added.append((parent_sku, var_row["Name"]))
        pos += 1
        for sku, size, name, e in pool_trowels:
            if not present(sku):
                wc_rows.append(build_tt_variation_row(
                    sku=sku, name=name, parent_sku=parent_sku,
                    attr2_name="Length", attr2_value=size,
                    price=e["price"], images=e["images"],
                    position=pos, weight=e["weight"],
                ))
                added.append((sku, name))
                pos += 1
                existing_skus.add(sku)
        existing_skus.add(parent_sku)

    # ── 7. Offset Taping Knives — variable group ──────────────────────────────
    offset_knives = [
        ("TKOS08BSTT", '8"',  'TapeTech 8" Premium Blue Steel Offset Taping Knife',  enrich("TKOS08BSTT", tt_catalog_map, tt_wp_map)),
        ("TKOS10BSTT", '10"', 'TapeTech 10" Premium Blue Steel Offset Taping Knife', enrich("TKOS10BSTT", tt_catalog_map, tt_wp_map)),
        ("TKOS12BSTT", '12"', 'TapeTech 12" Premium Blue Steel Offset Taping Knife', enrich("TKOS12BSTT", tt_catalog_map, tt_wp_map)),
        ("TKOS14BSTT", '14"', 'TapeTech 14" Premium Blue Steel Offset Taping Knife', enrich("TKOS14BSTT", tt_catalog_map, tt_wp_map)),
        ("TKOS16BSTT", '16"', 'TapeTech 16" Premium Blue Steel Offset Taping Knife', enrich("TKOS16BSTT", tt_catalog_map, tt_wp_map)),
    ]
    if not any(present(sku) for sku, *_ in offset_knives):
        cat = "Drywall Finishing Tools > TapeTech > Premium Knives & Trowels > Offset Taping Knives"
        parent_sku = "TKOS-BS-TT"
        var_row = build_tt_variable_row(
            sku=parent_sku,
            name='TapeTech Premium Blue Steel Offset Taping Knives',
            short_desc='TapeTech Premium Blue Steel Offset Taping Knives in 8", 10", 12", 14", and 16" sizes.',
            desc='<p>TapeTech Premium Blue Steel Offset Taping Knives feature high-carbon blue steel blades with a precision-ground edge and offset design for improved compound spreading. Available in 8", 10", 12", 14", and 16" widths.</p>',
            categories=cat,
            images="",
            weight="",
            attr2_name="Size",
            attr2_values=" | ".join(s for _, s, *_ in offset_knives),
            price="",
            position=pos,
            tags='offset taping knife, blue steel knife, TKOS08BSTT, TKOS10BSTT',
        )
        wc_rows.append(var_row)
        added.append((parent_sku, var_row["Name"]))
        pos += 1
        for sku, size, name, e in offset_knives:
            if not present(sku):
                wc_rows.append(build_tt_variation_row(
                    sku=sku, name=name, parent_sku=parent_sku,
                    attr2_name="Size", attr2_value=size,
                    price=e["price"], images=e["images"],
                    position=pos, weight=e["weight"],
                ))
                added.append((sku, name))
                pos += 1
                existing_skus.add(sku)
        existing_skus.add(parent_sku)

    # ── 8. Venetian Outside Corner Trowels — variable group ───────────────────
    vex_trowels = [
        ("VEX4030",  '1.6" x 1.2"', 'VEX4030 TapeTech 1.6" x 1.2" Mini Outside Corner Trowel', enrich("VEX4030",  tt_catalog_map, tt_wp_map)),
        ("VEX8025",  '3" x 1"',     'VEX8025 TapeTech 3" x 1" Mini Outside Corner Trowel',     enrich("VEX8025",  tt_catalog_map, tt_wp_map)),
        ("VEX8060",  '3" x 2.4"',   'VEX8060 TapeTech 3" x 2.4" Outside Corner Trowel',        enrich("VEX8060",  tt_catalog_map, tt_wp_map)),
        ("VEX11075", '4.3" x 3"',   'VEX11075 TapeTech 4.3" x 3" Outside Corner Trowel',       enrich("VEX11075", tt_catalog_map, tt_wp_map)),
    ]
    if not any(present(sku) for sku, *_ in vex_trowels):
        cat = "Drywall Finishing Tools > TapeTech > Venetian & Decorative Finish Tools > Corner Trowels"
        parent_sku = "VEXTT"
        all_imgs = ", ".join(filter(None, [e["images"] for _, _, _, e in vex_trowels]))
        var_row = build_tt_variable_row(
            sku=parent_sku,
            name="TapeTech Venetian Outside Corner Trowels",
            short_desc="TapeTech handcrafted Italian stainless steel outside corner trowels for 90° exterior corner finishing.",
            desc='<p>TapeTech Outside Corner Trowels are handcrafted in Italy from premium stainless steel. Perfect for finishing the 90° corners of interior decoration work, Venetian plaster, and decorative finishing applications. Available in four sizes.</p>',
            categories=cat,
            images=all_imgs,
            weight="",
            attr2_name="Size",
            attr2_values=" | ".join(s for _, s, *_ in vex_trowels),
            price="",
            position=pos,
            tags="venetian trowel, outside corner trowel, VEX4030, VEX8025, VEX8060, VEX11075",
        )
        wc_rows.append(var_row)
        added.append((parent_sku, var_row["Name"]))
        pos += 1
        for sku, size, name, e in vex_trowels:
            if not present(sku):
                wc_rows.append(build_tt_variation_row(
                    sku=sku, name=name, parent_sku=parent_sku,
                    attr2_name="Size", attr2_value=size,
                    price=e["price"], images=e["images"],
                    position=pos, weight=e["weight"],
                ))
                added.append((sku, name))
                pos += 1
                existing_skus.add(sku)
        existing_skus.add(parent_sku)

    # ── 9. Venetian Inside Corner Trowels — variable group ────────────────────
    vin_trowels = [
        ("VIN4030",  '1.6" x 1.2"', 'VIN4030 TapeTech 1.6" x 1.2" Mini Inside Corner Trowel', enrich("VIN4030",  tt_catalog_map, tt_wp_map)),
        ("VIN8025",  '3" x 1"',     'VIN8025 TapeTech 3" x 1" Mini Inside Corner Trowel',     enrich("VIN8025",  tt_catalog_map, tt_wp_map)),
        ("VIN8060",  '3" x 2.4"',   'VIN8060 TapeTech 3" x 2.4" Inside Corner Trowel',        enrich("VIN8060",  tt_catalog_map, tt_wp_map)),
        ("VIN11075", '4.3" x 3"',   'VIN11075 TapeTech 4.3" x 3" Inside Corner Trowel',       enrich("VIN11075", tt_catalog_map, tt_wp_map)),
    ]
    if not any(present(sku) for sku, *_ in vin_trowels):
        cat = "Drywall Finishing Tools > TapeTech > Venetian & Decorative Finish Tools > Corner Trowels"
        parent_sku = "VINTT"
        all_imgs = ", ".join(filter(None, [e["images"] for _, _, _, e in vin_trowels]))
        var_row = build_tt_variable_row(
            sku=parent_sku,
            name="TapeTech Venetian Inside Corner Trowels",
            short_desc="TapeTech handcrafted Italian stainless steel inside corner trowels for 90° interior corner finishing.",
            desc='<p>TapeTech Inside Corner Trowels are handcrafted in Italy from premium stainless steel. Perfect for finishing the 90° corners of interior decoration work, Venetian plaster, and decorative finishing applications. Available in four sizes.</p>',
            categories=cat,
            images=all_imgs,
            weight="",
            attr2_name="Size",
            attr2_values=" | ".join(s for _, s, *_ in vin_trowels),
            price="",
            position=pos,
            tags="venetian trowel, inside corner trowel, VIN4030, VIN8025, VIN8060, VIN11075",
        )
        wc_rows.append(var_row)
        added.append((parent_sku, var_row["Name"]))
        pos += 1
        for sku, size, name, e in vin_trowels:
            if not present(sku):
                wc_rows.append(build_tt_variation_row(
                    sku=sku, name=name, parent_sku=parent_sku,
                    attr2_name="Size", attr2_value=size,
                    price=e["price"], images=e["images"],
                    position=pos, weight=e["weight"],
                ))
                added.append((sku, name))
                pos += 1
                existing_skus.add(sku)
        existing_skus.add(parent_sku)

    # ── 10. Simple products ───────────────────────────────────────────────────
    simples = [
        # (sku, name, short_desc, cat, cat_mapping_tuple)
        ("76TT-CA",  "TapeTech EasyClean® Loading Pump 76TT-CA",
         "TapeTech EasyClean® Loading Pump 76TT-CA (Canada Only) — fills automatic drywall tools with joint compound.",
         "Drywall Finishing Tools > TapeTech > Automatic Taping & Finishing Tools > Loading Pumps > EasyClean Pump"),
        ("GSR-TT",   "TapeTech Gooseneck Riser GSR-TT",
         "TapeTech Gooseneck Riser GSR-TT for use with 85T Gooseneck and 76TT-CA Loading Pump.",
         "Drywall Finishing Tools > TapeTech > Automatic Taping & Finishing Tools > Loading Pumps > Gooseneck Riser"),
        ("BAN001TT", "TapeTech MudDog™ Premium Taping Banjo",
         "TapeTech MudDog™ Premium Taping Banjo for fast, efficient tape application.",
         "Drywall Finishing Tools > TapeTech > Semi-Automatic Tools > MudDog Banjo > MudDog Premium Banjo"),
        ("CCAGE04",  'TapeTech 4" Compound Roller Frame',
         'TapeTech 4" Compound Roller Frame CCAGE04 — ideal for applying large amounts of drywall compound.',
         "Drywall Finishing Tools > TapeTech > Compound Rollers > Roller Cages > Roller Cage"),
        ("JCT01TT",  "TapeTech Jam Clearing Tool",
         "TapeTech Jam Clearing Tool — swiftly unclogs automatic taper jams, avoiding slowdowns on the jobsite.",
         "Drywall Finishing Tools > TapeTech > Tools of the Trade > Jam Clearing Tool"),
        ("NSW01",    "TapeTech Nail Spotter Wheel Kit (NSW01)",
         "TapeTech Nail Spotter Wheel Kit NSW01 — designed to make finishing faster, smoother, and less fatiguing.",
         "Drywall Finishing Tools > TapeTech > Nail Spotters"),
        ("TC01TT",   "TapeTech Tool Caddy TC01TT",
         "TapeTech Tool Caddy TC01TT — makes filling finishing boxes with a compound tube even easier.",
         "Drywall Finishing Tools > TapeTech > Semi-Automatic Tools > Adapters & Accessories > Tool Caddy"),
        ("PMP001",   '30" Premium Paddle Mixer',
         '30" Premium Paddle Mixer PMP001 — quickly mixes joint compound, concrete, stucco, EIFS, and grout.',
         "Drywall Finishing Tools > TapeTech > Tools of the Trade > Mixing Paddle"),
        ("PKL001",   "TapeTech Pocket Kicker Lift Tool",
         "TapeTech Pocket Kicker Lift Tool PKL001 — compact drywall lift tool for job site convenience.",
         "Drywall Finishing Tools > TapeTech > Tools of the Trade > Lift Tools"),
        ("MT01TT",   "TapeTech 9-in-1 Stainless Steel Multi-tool",
         "TapeTech 9-in-1 Stainless Steel Multi-tool MT01TT for drywall professionals.",
         "Drywall Finishing Tools > TapeTech > Tools of the Trade > Multi-tools"),
        ("HAWK001-PS", '13" x 13" Aluminum Finishing Hawk',
         '13" x 13" Aluminum Finishing Hawk HAWK001-PS — professional aluminum hawk for drywall finishing.',
         "Drywall Finishing Tools > TapeTech > Premium Knives & Trowels > Mud Pans & Hawks"),
        ("HAWK002-PS", '13" x 13" Premium Anodized Finishing Hawk',
         '13" x 13" Premium Anodized Aluminum Finishing Hawk HAWK002-PS — anodized finish for corrosion resistance.',
         "Drywall Finishing Tools > TapeTech > Premium Knives & Trowels > Mud Pans & Hawks"),
        ("MP12SSTT",  '12" Stainless Steel Mud Pan',
         '12" Stainless Steel Mud Pan MP12SSTT — professional stainless steel mud pan.',
         "Drywall Finishing Tools > TapeTech > Premium Knives & Trowels > Mud Pans & Hawks > Mud Pan"),
        ("MP14SSTT",  '14" Stainless Steel Mud Pan',
         '14" Stainless Steel Mud Pan MP14SSTT — professional stainless steel mud pan.',
         "Drywall Finishing Tools > TapeTech > Premium Knives & Trowels > Mud Pans & Hawks > Mud Pan"),
        ("T-RAXX01",  "TapeTech T-RAXX™ Taping Tool Rack System (T-RAXX01)",
         "TapeTech T-RAXX™ T-RAXX01 — the first and only professional tool rack system designed to securely hold Automatic Taping & Finishing tools.",
         "Drywall Finishing Tools > TapeTech > T-RAXX Tool Rack System"),
        ("T-RAXX-LP", "TapeTech T-RAXX Loading Pump Holder",
         "TapeTech T-RAXX Loading Pump Holder — optional add-on for the T-RAXX tool rack system.",
         "Drywall Finishing Tools > TapeTech > T-RAXX Tool Rack System"),
        ("T-RAXX-RG", "TapeTech T-RAXX Reducer Gasket",
         "TapeTech T-RAXX Reducer Gasket — replacement gasket for the T-RAXX tool rack system.",
         "Drywall Finishing Tools > TapeTech > T-RAXX Tool Rack System"),
        ("FS1106",   "TapeTech FLEX 2-Drawer Stack Pack (FS1106)",
         "TapeTech FLEX 2-Drawer Stack Pack FS1106 for the T-RAXX Tool Rack System.",
         "Drywall Finishing Tools > TapeTech > T-RAXX Tool Rack System"),
        ("FS1108",   "TapeTech FLEX Roller Drawer Stack Pack (FS1108)",
         "TapeTech FLEX Roller Drawer Stack Pack FS1108 for the T-RAXX Tool Rack System.",
         "Drywall Finishing Tools > TapeTech > T-RAXX Tool Rack System"),
        ("FS1501",   'TapeTech Track Lock™ 32" Wall Mount Rail Base (FS1501)',
         'TapeTech Track Lock™ 32" Wall Mount Rail Base FS1501 for the T-RAXX Tool Rack System.',
         "Drywall Finishing Tools > TapeTech > T-RAXX Tool Rack System"),
        ("FS1501-2", 'TapeTech Track Lock™ 32" Wall Mount Rail Base 2-Pack (FS1501-2)',
         'TapeTech Track Lock™ 32" Wall Mount Rail Base 2-Pack FS1501-2 for the T-RAXX Tool Rack System.',
         "Drywall Finishing Tools > TapeTech > T-RAXX Tool Rack System"),
        ("CTADJUST-IN", "TapeTech Carbon Steel Clipped & Pointed Knife",
         "TapeTech Carbon Steel Clipped & Pointed taping knife for precision drywall work.",
         "Drywall Finishing Tools > TapeTech > Premium Knives & Trowels > Premium Taping Knives"),
        # Premium Gold GS and CY and SQ — simple products (limited data)
        ("TG110565-GS", 'TapeTech 11" Premium Gold Stainless Steel Finishing Trowel',
         'TapeTech Premium Gold Stainless Steel Finishing Trowel.',
         cat_gold),
        ("TG120565-GS", 'TapeTech 12" Premium Gold Stainless Steel Finishing Trowel (TG120565-GS)',
         'TapeTech 12" Premium Gold Stainless Steel Finishing Trowel.',
         cat_gold),
        ("TG140565-GS", 'TapeTech 14" Premium Gold Stainless Steel Finishing Trowel (TG140565-GS)',
         'TapeTech 14" Premium Gold Stainless Steel Finishing Trowel.',
         cat_gold),
        ("TG160565-GS", 'TapeTech 16" Premium Gold Stainless Steel Finishing Trowel (TG160565-GS)',
         'TapeTech 16" Premium Gold Stainless Steel Finishing Trowel.',
         cat_gold),
        ("TG180565-GS", 'TapeTech 18" Premium Gold Stainless Steel Finishing Trowel (TG180565-GS)',
         'TapeTech 18" Premium Gold Stainless Steel Finishing Trowel.',
         cat_gold),
        ("TG120565-CY", '12" Curry-Style Finishing Trowel (TG120565-CY)',
         'TapeTech 12" Curry-Style Finishing Trowel.',
         cat_gold),
        ("TG140565-CY", '14" Curry-Style Finishing Trowel (TG140565-CY)',
         'TapeTech 14" Curry-Style Finishing Trowel.',
         cat_gold),
        ("TG120565-SQ", 'TapeTech 12" Premium Gold Square Finishing Trowel (TG120565-SQ)',
         'TapeTech 12" Premium Gold Square Finishing Trowel.',
         cat_gold),
        ("TG140565-SQ", 'TapeTech 14" Premium Gold Square Finishing Trowel (TG140565-SQ)',
         'TapeTech 14" Premium Gold Square Finishing Trowel.',
         cat_gold),
    ]

    for sku, name, short_desc, cat in simples:
        if not present(sku):
            e = enrich(sku, tt_catalog_map, tt_wp_map)
            wc_rows.append(build_tt_simple_row(
                sku=sku, name=e["name"] or name,
                short_desc=e["short_desc"] or short_desc,
                desc=e["desc"],
                categories=cat,
                images=e["images"],
                weight=e["weight"],
                price=e["price"],
                position=pos,
                tags=sku,
                length=e["length"],
                width=e["width"],
                height=e["height"],
            ))
            added.append((sku, e["name"] or name))
            pos += 1
            existing_skus.add(sku)

    return wc_rows, added


# ═══════════════════════════════════════════════════════════════════════════════
# STEP 3 — Apply Columbia update candidates
# ═══════════════════════════════════════════════════════════════════════════════

def apply_col_updates(wc_rows, col_update_uc):
    """Apply name/category updates to existing Columbia rows."""
    sku_idx = {r["SKU"]: i for i, r in enumerate(wc_rows)}
    updates = []

    # These SKUs are being upgraded to variable parents; their proposed_name in the
    # update candidates contains a variation-specific name (incorrect), so skip name updates.
    SKIP_NAME_UPDATE_SKUS = {"BF", "CSH"}

    for uc in col_update_uc:
        wc_sku = uc.get("wc_sku", "")
        idx = sku_idx.get(wc_sku)
        if idx is None:
            continue

        row = wc_rows[idx]
        changed = []

        if uc.get("can_update_name") == "1" and wc_sku not in SKIP_NAME_UPDATE_SKUS:
            new_name = (uc.get("proposed_name") or "").strip()
            if new_name and new_name != row.get("Name", ""):
                row["Name"] = new_name
                changed.append("name")

        if uc.get("can_update_categories") == "1":
            new_cat = (uc.get("proposed_categories") or "").strip()
            if new_cat and new_cat != row.get("Categories", ""):
                row["Categories"] = new_cat
                changed.append("categories")

        if changed:
            updates.append((wc_sku, uc.get("wc_mpn", ""), "Columbia Taping Tools", ", ".join(changed)))
            wc_rows[idx] = row

    return wc_rows, updates


# ═══════════════════════════════════════════════════════════════════════════════
# STEP 4 — Add missing Columbia products
# ═══════════════════════════════════════════════════════════════════════════════

def col_row_from_source(src, fieldmap=None):
    """
    Convert a columbia-catalog row to wc-catalog format.
    fieldmap: optional overrides.
    """
    # Map columbia catalog fields → wc-catalog fields
    r = blank_row()
    r.update({
        "Brands": "Columbia Taping Tools",
        "Type": src.get("Type", "simple"),
        "SKU": src.get("SKU", ""),
        "Name": src.get("Name", ""),
        "Published": "1",
        "Is featured?": "0",
        "Visibility in catalog": "visible",
        "Short description": src.get("Short description", ""),
        "Description": src.get("Description", ""),
        "Tax status": "taxable",
        "In stock?": "1",
        "Stock": "100" if src.get("Type", "") in ("simple", "variable") else "0",
        "Backorders allowed?": "0",
        "Sold individually?": "0",
        "Allow customer reviews?": "1",
        "Weight (lbs)": src.get("Weight (lbs)", ""),
        "Length (in)": src.get("Length (in)", ""),
        "Width (in)": src.get("Width (in)", ""),
        "Height (in)": src.get("Height (in)", ""),
        "Categories": src.get("Categories", ""),
        "Tags": src.get("Tags", ""),
        "Images": src.get("Images", ""),
        "Parent": src.get("Parent", ""),
        "Regular price": src.get("Regular price", ""),
        "Sale price": src.get("Sale price", ""),
        "Position": src.get("Position", ""),
        "Attribute 1 name": "Brand",
        "Attribute 1 value(s)": "Columbia Taping Tools",
        "Attribute 1 visible": src.get("Attribute 1 visible", "1") or "1",
        "Attribute 1 global": "1",
        "Attribute 2 name": src.get("Attribute 2 name", ""),
        "Attribute 2 value(s)": src.get("Attribute 2 value(s)", ""),
        "Attribute 2 visible": src.get("Attribute 2 visible", ""),
        "Attribute 2 global": src.get("Attribute 2 global", ""),
        "Meta: _mpn": src.get("MPN", src.get("SKU", "")),
        "Meta: _dtb_seo_title": src.get("meta:_dtb_seo_title", src.get("Name", "")),
        "Meta: _dtb_seo_description": src.get("meta:_dtb_seo_description", ""),
    })
    # For variation rows, clear Attribute 1 visible
    if r["Type"] == "variation":
        r["Attribute 1 visible"] = ""
    if fieldmap:
        r.update(fieldmap)
    return r


def add_missing_columbia(wc_rows, col_missing, col_cat_map, col_cat_all):
    """Build and append rows for missing Columbia products."""
    existing_skus = {r["SKU"] for r in wc_rows}
    added = []
    pos = next_position(wc_rows)

    def present(sku):
        return sku in existing_skus

    # ── 1. NPK — Nylon Putty Knives variable family ───────────────────────────
    npk_skus = ["NPK", "NPK1.5", "NPK2", "NPK3", "NPK4", "NPK5", "NPK6", "NPK8", "NPK10",
                "9-1MT", "CJK6", "PJK3.5"]
    if not any(present(s) for s in npk_skus):
        for sku in npk_skus:
            src = col_cat_map.get(sku)
            if not src:
                continue
            r = col_row_from_source(src, {"Position": str(pos)})
            # NPK parent is variable; 9-1MT, CJK6, PJK3.5 are variations under NPK
            # but in columbia catalog they're typed as variation with parent=NPK
            # Keep the type from source
            wc_rows.append(r)
            added.append((sku, r["Name"]))
            pos += 1
            existing_skus.add(sku)

    # ── 2. OPPK — One Piece Putty Knives variable family ─────────────────────
    oppk_skus = ["OPPK", "OPPK1.5", "OPPK2", "OPPK3", "OPPK4", "OPPK5", "OPPK6", "OPPK8", "OPPK10-1"]
    if not any(present(s) for s in oppk_skus):
        for sku in oppk_skus:
            src = col_cat_map.get(sku)
            if not src:
                continue
            r = col_row_from_source(src, {"Position": str(pos)})
            wc_rows.append(r)
            added.append((sku, r["Name"]))
            pos += 1
            existing_skus.add(sku)

    # ── 3. 3NPK — Three Way Knives variable family ────────────────────────────
    # Note: columbia catalog has 3NPK4/5/6 with Parent=THREE-WAY-KNIVES (wrong),
    # so we override Parent to '3NPK' for the variations.
    npk3_skus = ["3NPK", "3NPK4", "3NPK5", "3NPK6"]
    if not any(present(s) for s in npk3_skus):
        for sku in npk3_skus:
            src = col_cat_map.get(sku)
            if not src:
                continue
            overrides = {"Position": str(pos)}
            if src.get("Type", "") == "variation":
                overrides["Parent"] = "3NPK"  # fix incorrect parent in source
            r = col_row_from_source(src, overrides)
            wc_rows.append(r)
            added.append((sku, r["Name"]))
            pos += 1
            existing_skus.add(sku)

    # ── 4. Other missing product families from the missing list ───────────────
    # These are family-level reference SKUs that map to existing or new products
    other_families = {
        "3NPK": "Columbia Three Way Knives",
        "AH": "Columbia Angleheads",
        "C1": "Columbia One (C1)",
        "DF": "Columbia Direct Corner Flusher",
        "FSB": "Columbia Fat Boy Smoothing Blades",
        "MP-6": "Columbia Mud Pans",
        "NPK": "Columbia Nylon Putty Knives",
        "NS": "Columbia Nailspotters",
        "OPPK": "Columbia One Piece Putty Knives",
        "PREDATOR-FAMILY": "Columbia Predator Family",
        "SAWED-OFF-TAPER": "Columbia Sawed Off Taper",
        "SF": "Columbia Standard Corner Flusher",
    }
    for sku, default_name in other_families.items():
        if present(sku):
            continue
        src = col_cat_map.get(sku)
        if src:
            r = col_row_from_source(src, {"Position": str(pos), "Published": "1"})
            wc_rows.append(r)
            added.append((sku, r["Name"]))
            pos += 1
            existing_skus.add(sku)

    return wc_rows, added


# ═══════════════════════════════════════════════════════════════════════════════
# STEP 5 — Fix Columbia ICA/BF/CSH: simple → variable + add variations
# ═══════════════════════════════════════════════════════════════════════════════

def fix_columbia_variable_types(wc_rows, col_cat_map, col_cat_all):
    """
    ICA, BF, CSH are currently simple in wc-catalog but should be variable.
    Upgrade them and add their variations.
    """
    sku_idx = {r["SKU"]: i for i, r in enumerate(wc_rows)}
    existing_skus = {r["SKU"] for r in wc_rows}
    fixed = []
    pos = next_position(wc_rows)

    # Group: (parent_sku, attr2_name, [(variation_sku, variation_attr2_val), ...])
    groups = {
        "ICA": ("Size",          [("ICA2-1", '2"'), ("ICA4-1", '4"')]),
        "BF":  ("Model",         [("BF-STD", "BF"),  ("TBBF",   "TBBF")]),
        "CSH": ("Configuration", [("CS",    "Head Only (CS)"), ("CSHV", "With Handle (CSH)")]),
    }

    # Correct names for variable parents (avoid inheriting variation-specific names)
    CORRECT_PARENT_NAMES = {
        "BF":  "Columbia Box Filler",
        "CSH": "Columbia Sander Head",
    }

    for parent_sku, (attr2_name, var_pairs) in groups.items():
        idx = sku_idx.get(parent_sku)
        if idx is None:
            continue

        parent_row = wc_rows[idx]
        if parent_row.get("Type", "") == "variable":
            continue  # already variable

        # Get the source data from columbia catalog
        src_parent = col_cat_map.get(parent_sku, {})

        # Upgrade parent to variable
        parent_row["Type"] = "variable"
        parent_row["Stock"] = "100"
        parent_row["Attribute 2 name"] = attr2_name
        parent_row["Attribute 2 value(s)"] = src_parent.get("Attribute 2 value(s)", " | ".join(v for _, v in var_pairs))
        parent_row["Attribute 2 visible"] = "1"
        parent_row["Attribute 2 global"] = "1"
        # Restore correct generic parent name if it was renamed to a variation-specific name
        if parent_sku in CORRECT_PARENT_NAMES:
            parent_row["Name"] = CORRECT_PARENT_NAMES[parent_sku]
            parent_row["Meta: _dtb_seo_title"] = CORRECT_PARENT_NAMES[parent_sku]
        wc_rows[idx] = parent_row
        fixed.append((parent_sku, f"simple→variable, added Attribute 2 ({attr2_name})"))

        # Add variation children
        for var_sku, var_val in var_pairs:
            if var_sku in existing_skus:
                # existing simple row that should become a variation
                vidx = sku_idx.get(var_sku)
                if vidx is not None:
                    vrow = wc_rows[vidx]
                    vrow["Type"] = "variation"
                    vrow["Parent"] = parent_sku
                    vrow["Stock"] = "0"
                    vrow["Attribute 1 visible"] = ""
                    vrow["Attribute 2 name"] = attr2_name
                    vrow["Attribute 2 value(s)"] = var_val
                    vrow["Attribute 2 global"] = "1"
                    wc_rows[vidx] = vrow
                    fixed.append((var_sku, f"simple→variation under {parent_sku}"))
            else:
                # New variation row from columbia catalog
                src_var = col_cat_map.get(var_sku, {})
                if src_var:
                    r = col_row_from_source(src_var, {
                        "Type": "variation",
                        "Parent": parent_sku,
                        "Stock": "0",
                        "Position": str(pos),
                        "Attribute 1 visible": "",
                        "Attribute 2 name": attr2_name,
                        "Attribute 2 value(s)": var_val,
                        "Attribute 2 global": "1",
                    })
                    wc_rows.append(r)
                    fixed.append((var_sku, f"new variation under {parent_sku}"))
                    pos += 1
                    existing_skus.add(var_sku)

    return wc_rows, fixed


# ═══════════════════════════════════════════════════════════════════════════════
# VALIDATION
# ═══════════════════════════════════════════════════════════════════════════════

def validate(wc_rows):
    """Check for orphan variations and duplicate SKUs."""
    parents = {r["SKU"] for r in wc_rows if r.get("Type", "") == "variable"}
    orphans = [r["SKU"] for r in wc_rows
               if r.get("Type", "") == "variation" and r.get("Parent", "") not in parents]
    from collections import Counter
    skus = [r["SKU"] for r in wc_rows if r.get("SKU", "")]
    dups = [(s, c) for s, c in Counter(skus).items() if c > 1]
    return orphans, dups


# ═══════════════════════════════════════════════════════════════════════════════
# AUDIT REPORT
# ═══════════════════════════════════════════════════════════════════════════════

def write_audit(before_count, after_count, tt_updates, tt_added, col_updates, col_added, col_fixed, orphans, dups):
    lines = [
        "# WooCommerce Catalog Audit Summary\n",
        f"**Generated by:** `scripts/build_wc_catalog.py`\n",
        "\n## Totals\n",
        f"| Metric | Count |",
        f"|--------|-------|",
        f"| Rows before | {before_count} |",
        f"| TapeTech rows added | {len(tt_added)} |",
        f"| Columbia rows added | {len(col_added)} |",
        f"| Columbia rows fixed (type upgrade) | {len(col_fixed)} |",
        f"| Rows after | {after_count} |",
        f"| TapeTech updates applied | {len(tt_updates)} |",
        f"| Columbia updates applied | {len(col_updates)} |",
        f"| Orphan variations (should be 0) | {len(orphans)} |",
        f"| Duplicate SKUs (should be 0) | {len(dups)} |",
        "",
        "\n## TapeTech Products Added\n",
        "| SKU | Name |",
        "|-----|------|",
    ]
    for sku, name in tt_added:
        lines.append(f"| {sku} | {name} |")

    lines += [
        "",
        "\n## TapeTech Products Updated\n",
        "| SKU | Fields Changed |",
        "|-----|----------------|",
    ]
    for sku, mpn, brand, fields in tt_updates:
        lines.append(f"| {sku} | {fields} |")

    lines += [
        "",
        "\n## Columbia Products Added\n",
        "| SKU | Name |",
        "|-----|------|",
    ]
    for sku, name in col_added:
        lines.append(f"| {sku} | {name} |")

    lines += [
        "",
        "\n## Columbia Products Updated\n",
        "| SKU | Fields Changed |",
        "|-----|----------------|",
    ]
    for sku, mpn, brand, fields in col_updates:
        lines.append(f"| {sku} | {fields} |")

    lines += [
        "",
        "\n## Columbia Type Fixes (simple → variable/variation)\n",
        "| SKU | Change |",
        "|-----|--------|",
    ]
    for sku, change in col_fixed:
        lines.append(f"| {sku} | {change} |")

    if orphans:
        lines += ["", "\n## ⚠️ Orphan Variations\n", "| SKU |", "|-----|"]
        for sku in orphans:
            lines.append(f"| {sku} |")
    if dups:
        lines += ["", "\n## ⚠️ Duplicate SKUs\n", "| SKU |", "|-----|"]
        for sku, count in dups:
            lines.append(f"| {sku} (×{count}) |")

    AUDIT_OUT.parent.mkdir(parents=True, exist_ok=True)
    with open(AUDIT_OUT, "w", encoding="utf-8") as f:
        f.write("\n".join(lines) + "\n")


# ═══════════════════════════════════════════════════════════════════════════════
# MAIN
# ═══════════════════════════════════════════════════════════════════════════════

def main():
    print("Loading source data...")
    (wc_rows, tt_catalog_map, tt_update_uc, tt_missing, tt_wp_map,
     col_update_uc, col_missing, col_cat_map, col_cat_all) = load_all()

    before_count = len(wc_rows)
    print(f"  Loaded {before_count} rows from wc-catalog.csv")

    print("Step 1: Applying TapeTech update candidates...")
    wc_rows, tt_updates = apply_tt_updates(wc_rows, tt_update_uc, tt_catalog_map)
    print(f"  Applied {len(tt_updates)} TapeTech updates")

    print("Step 2: Adding missing TapeTech products...")
    wc_rows, tt_added = add_missing_tt(wc_rows, tt_missing, tt_catalog_map, tt_wp_map)
    print(f"  Added {len(tt_added)} TapeTech rows")

    print("Step 3: Applying Columbia update candidates...")
    wc_rows, col_updates = apply_col_updates(wc_rows, col_update_uc)
    print(f"  Applied {len(col_updates)} Columbia updates")

    print("Step 4: Adding missing Columbia products...")
    wc_rows, col_added = add_missing_columbia(wc_rows, col_missing, col_cat_map, col_cat_all)
    print(f"  Added {len(col_added)} Columbia rows")

    print("Step 5: Fixing Columbia ICA/BF/CSH to variable types...")
    wc_rows, col_fixed = fix_columbia_variable_types(wc_rows, col_cat_map, col_cat_all)
    print(f"  Fixed {len(col_fixed)} Columbia rows")

    print("Validating...")
    orphans, dups = validate(wc_rows)
    after_count = len(wc_rows)
    print(f"  Orphan variations: {len(orphans)}")
    print(f"  Duplicate SKUs: {len(dups)}")
    if orphans:
        print(f"  Orphans: {orphans[:10]}")
    if dups:
        print(f"  Duplicates: {dups[:10]}")

    print(f"Writing {after_count} rows to {WC}...")
    write_csv(WC, wc_rows)

    print(f"Writing audit report to {AUDIT_OUT}...")
    write_audit(before_count, after_count, tt_updates, tt_added,
                col_updates, col_added, col_fixed, orphans, dups)

    print(f"\nDone! {before_count} → {after_count} rows (+{after_count - before_count})")
    if orphans or dups:
        print("⚠️  Validation issues found — review audit report.")
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
