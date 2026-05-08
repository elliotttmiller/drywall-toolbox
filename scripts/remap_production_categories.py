#!/usr/bin/env python3
"""
remap_production_categories.py

Comprehensive, industry-standard category mapping optimization for
products/Production/catalogs/official/woocommerce_catalog_production.csv.

Applies a uniform leaf-category structure across all brands:
  Automatic Taping Tools | Semi-Automatic Taping Tools | Flat Boxes
  Corner Tools | Handles & Extensions | Knives & Blades
  Mud Pans & Pumps | Nail Spotters | Tool Sets & Kits | Parts
  Accessories & Adapters (catch-all for brand-specific misc)

Also updates Tags and meta:search_keywords to stay in sync.

Usage:
    python scripts/remap_production_categories.py [--dry-run]
    python scripts/remap_production_categories.py --apply
"""

from __future__ import annotations

import csv
import re
import sys
from copy import deepcopy
from datetime import datetime, timezone
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
CATALOG_PATH = (
    REPO_ROOT
    / "products"
    / "Production"
    / "catalogs"
    / "official"
    / "woocommerce_catalog_production.csv"
)

DRY_RUN = "--apply" not in sys.argv

# ─── 1. Whole-category simple renames ────────────────────────────────────────
# Maps old full category path → new full category path.
# Applies to ALL rows (simple, variable, variation) that carry this exact path.
CATEGORY_SIMPLE_REMAP: dict[str, str] = {
    # ── TapeTech ──────────────────────────────────────────────────────────────
    # Compound Rollers are corner tools (applied in corners)
    "Drywall Finishing Tools > TapeTech > Compound Rollers":
        "Drywall Finishing Tools > TapeTech > Corner Tools",
    # Loading pumps / goosenecks belong with mud/compound delivery
    "Drywall Finishing Tools > TapeTech > Compound Tubes & Loading Accessories":
        "Drywall Finishing Tools > TapeTech > Mud Pans & Pumps",
    # Corner edgers / corner finishers / corner flushers → Corner Tools
    "Drywall Finishing Tools > TapeTech > Corner Edgers":
        "Drywall Finishing Tools > TapeTech > Corner Tools",
    "Drywall Finishing Tools > TapeTech > Corner Finishers & Rollers":
        "Drywall Finishing Tools > TapeTech > Corner Tools",
    "Drywall Finishing Tools > TapeTech > Corner Flushers & Compound Tubes":
        "Drywall Finishing Tools > TapeTech > Corner Tools",
    # Finishing knives / trowels / joint knives / taping knives → Knives & Blades
    "Drywall Finishing Tools > TapeTech > Finishing Knives":
        "Drywall Finishing Tools > TapeTech > Knives & Blades",
    "Drywall Finishing Tools > TapeTech > Finishing Trowels":
        "Drywall Finishing Tools > TapeTech > Knives & Blades",
    "Drywall Finishing Tools > TapeTech > Joint Knives":
        "Drywall Finishing Tools > TapeTech > Knives & Blades",
    "Drywall Finishing Tools > TapeTech > Taping Knives":
        "Drywall Finishing Tools > TapeTech > Knives & Blades",
    # Flat box handles → Handles & Extensions
    "Drywall Finishing Tools > TapeTech > Flat Box Handles":
        "Drywall Finishing Tools > TapeTech > Handles & Extensions",
    # Mobile Wash Station → Accessories & Adapters (catch-all for misc TapeTech)
    "Drywall Finishing Tools > TapeTech > Mobile Wash Station":
        "Drywall Finishing Tools > TapeTech > Accessories & Adapters",
    # Mud pans & hawks → Mud Pans & Pumps
    "Drywall Finishing Tools > TapeTech > Mud Pans & Hawks":
        "Drywall Finishing Tools > TapeTech > Mud Pans & Pumps",
    # *** Critical fix: TapeTech "Parts" contains tool sets, NOT parts ***
    "Drywall Finishing Tools > TapeTech > Parts":
        "Drywall Finishing Tools > TapeTech > Tool Sets & Kits",
    # Taping Tools & Tapers → Automatic Taping Tools
    "Drywall Finishing Tools > TapeTech > Taping Tools & Tapers":
        "Drywall Finishing Tools > TapeTech > Automatic Taping Tools",

    # ── Platinum Drywall Tools ────────────────────────────────────────────────
    # "Platinum Semi Automatic Drywall Taper" was mis-filed as "Automatic Tapers"
    "Drywall Finishing Tools > Platinum Drywall Tools > Automatic Tapers":
        "Drywall Finishing Tools > Platinum Drywall Tools > Semi-Automatic Taping Tools",
    # Standardise leaf names to match Columbia / Level 5 / TapeTech
    "Drywall Finishing Tools > Platinum Drywall Tools > Corner & Angle Tools":
        "Drywall Finishing Tools > Platinum Drywall Tools > Corner Tools",
    "Drywall Finishing Tools > Platinum Drywall Tools > Finishing Boxes":
        "Drywall Finishing Tools > Platinum Drywall Tools > Flat Boxes",
    "Drywall Finishing Tools > Platinum Drywall Tools > Pumps & Accessories":
        "Drywall Finishing Tools > Platinum Drywall Tools > Mud Pans & Pumps",
    "Drywall Finishing Tools > Platinum Drywall Tools > Spotters":
        "Drywall Finishing Tools > Platinum Drywall Tools > Nail Spotters",
    "Drywall Finishing Tools > Platinum Drywall Tools > Tool Sets & Bundles":
        "Drywall Finishing Tools > Platinum Drywall Tools > Tool Sets & Kits",
    # "Box Filler Attachment" is a mud/loading accessory
    "Drywall Finishing Tools > Platinum Drywall Tools > Tools":
        "Drywall Finishing Tools > Platinum Drywall Tools > Mud Pans & Pumps",
}

# ─── 2. Per-product SKU → new category path ──────────────────────────────────
# Used for complex splits where different products in the SAME current category
# map to DIFFERENT new categories (Asgard, Columbia & Level 5 Taping & Finishing,
# TapeTech Accessories & Adapters).
SKU_CATEGORY_MAP: dict[str, str] = {
    # ── Asgard (all currently in "Automatic Taping Tools") ───────────────────
    "AT01-AD":  "Drywall Finishing Tools > Asgard > Automatic Taping Tools",  # The HAMMER
    # Corner Tools
    "ASG-ANGLE-HEAD": "Drywall Finishing Tools > Asgard > Corner Tools",
    "CFA-AD":   "Drywall Finishing Tools > Asgard > Corner Tools",   # Angle Head Adapter
    "CR01-AD":  "Drywall Finishing Tools > Asgard > Corner Tools",   # Inside Corner Roller
    # Flat Boxes
    "CA08-AD":  "Drywall Finishing Tools > Asgard > Flat Boxes",     # Applicator Box Head
    "ASG-FINISHING-BOX":              "Drywall Finishing Tools > Asgard > Flat Boxes",
    "ASG-MAXXBOX-FINISHING-BOX":      "Drywall Finishing Tools > Asgard > Flat Boxes",
    "ASG-POWER-ASSIST-MAXXBOX-FINISHING-BOX": "Drywall Finishing Tools > Asgard > Flat Boxes",
    # Handles & Extensions
    "BBHE-AD":  "Drywall Finishing Tools > Asgard > Handles & Extensions",  # Brakeless Extendable
    "BBH-AD":   "Drywall Finishing Tools > Asgard > Handles & Extensions",  # Brakeless Fixed
    "FBHE-AD":  "Drywall Finishing Tools > Asgard > Handles & Extensions",  # Extendable Fin Box
    "XH-AD":    "Drywall Finishing Tools > Asgard > Handles & Extensions",  # Extension Support
    "FH-AD":    "Drywall Finishing Tools > Asgard > Handles & Extensions",  # Fiberglass Handle
    # Mud Pans & Pumps
    "GN01-AD":  "Drywall Finishing Tools > Asgard > Mud Pans & Pumps",  # Gooseneck Adapter
    "LP01-AD":  "Drywall Finishing Tools > Asgard > Mud Pans & Pumps",  # Loading Pump
    # Nail Spotters
    "NS03-AD":  "Drywall Finishing Tools > Asgard > Nail Spotters",  # Nail Spotter Head
    # Tool Sets & Kits
    "TTBDL9":   "Drywall Finishing Tools > Asgard > Tool Sets & Kits",  # Classic Finishing Set

    # ── TapeTech Accessories & Adapters (per-product split) ──────────────────
    "JS01":     "Drywall Finishing Tools > TapeTech > Knives & Blades",  # Jab Saw
    "MT01":     "Drywall Finishing Tools > TapeTech > Knives & Blades",  # 9-in-1 Multi-Tool
    "TMK01TT":  "Drywall Finishing Tools > TapeTech > Tool Sets & Kits", # ATF Maintenance Kit
    "CFA-TT":   "Drywall Finishing Tools > TapeTech > Corner Tools",     # Corner Finisher Adapter

    # ── Columbia > Taping & Finishing Tools (per-product split) ──────────────
    # Knives & Blades — individual knives, trowels, smoothing blades
    "JKBP":     "Drywall Finishing Tools > Columbia > Knives & Blades",
    "3WJKBP":   "Drywall Finishing Tools > Columbia > Knives & Blades",
    "COLHTBDL2": "Drywall Finishing Tools > Columbia > Knives & Blades",
    "COL-3WAY-STAINLESS-STEEL-PUTTY-KNIVES-WITH-NYLON-HANDLE":
                "Drywall Finishing Tools > Columbia > Knives & Blades",
    "COL-FAT-BOY-SMOOTHING-BLADE":    "Drywall Finishing Tools > Columbia > Knives & Blades",
    "FSBSET":   "Drywall Finishing Tools > Columbia > Knives & Blades",  # Fat Boy Blade Set
    "OPPK10-1": "Drywall Finishing Tools > Columbia > Knives & Blades",  # 10-in-1 Multi Tool
    "COLHTBDL13": "Drywall Finishing Tools > Columbia > Knives & Blades", # OPPK Set
    "COL-ONE-PIECE-STAINLESS-STEEL-PUTTY-KNIVES":
                "Drywall Finishing Tools > Columbia > Knives & Blades",
    "COLSABDL7": "Drywall Finishing Tools > Columbia > Knives & Blades", # Predator Tomahawk Set
    "COL-PRO-FLEX-0-7-CURVED-BLADE-STAINLESS-STEEL-FINISHING-TROWEL":
                "Drywall Finishing Tools > Columbia > Knives & Blades",
    "COL-DEWALT-PRO-FLEX-FLAT-BLADE-STAINLESS-STEEL-FINISHING-TROWEL-COPY":
                "Drywall Finishing Tools > Columbia > Knives & Blades",
    "COL-SABRE-SMOOTHING-BLADE":      "Drywall Finishing Tools > Columbia > Knives & Blades",
    "SBSET":    "Drywall Finishing Tools > Columbia > Knives & Blades",  # Sabre Blade Set
    "COL-SILVER-0-4-CURVED-BLADE-STAINLESS-STEEL-FINISHING-TROWEL":
                "Drywall Finishing Tools > Columbia > Knives & Blades",
    "COL-SPECIALTY-KNIFE-WITH-NYLON-HANDLE":
                "Drywall Finishing Tools > Columbia > Knives & Blades",
    "9-1MT":    "Drywall Finishing Tools > Columbia > Knives & Blades",  # 9-in-1 Putty Knife
    "COL-STAINLESS-STEEL-JOINT-KNIFE-WITH-SOFT-GRIP-HANDLE":
                "Drywall Finishing Tools > Columbia > Knives & Blades",
    "COL-STAINLESS-STEEL-PUTTY-KNIVES-WITH-NYLON-HANDLE":
                "Drywall Finishing Tools > Columbia > Knives & Blades",
    "COLHTBDL3": "Drywall Finishing Tools > Columbia > Knives & Blades", # SS Taping Knife Set
    "COL-COLUMBIOA-STAINLESS-STEEL-TAPING-KNIFE-WITH-SOFT-GRIP-HANDLE":
                "Drywall Finishing Tools > Columbia > Knives & Blades",
    "COL-SUPER-FLEX-0-3-FLAT-BLADE-STAINLESS-STEEL-FINISHING-TROWEL":
                "Drywall Finishing Tools > Columbia > Knives & Blades",
    "COL-TOMAHAWK-SMOOTHING-BLADE":   "Drywall Finishing Tools > Columbia > Knives & Blades",
    # Handles & Extensions — smoothing blade poles, adapters, claws
    "FSBC":     "Drywall Finishing Tools > Columbia > Handles & Extensions",  # Fat Boy Adapter Claw
    "COL-FIBERGLASS-SMOOTHING-BLADE-EXTENSION-HANDLE":
                "Drywall Finishing Tools > Columbia > Handles & Extensions",
    "SBC":      "Drywall Finishing Tools > Columbia > Handles & Extensions",  # Sabre Blade Claw
    "SBP":      "Drywall Finishing Tools > Columbia > Handles & Extensions",  # Sabre Blade Pole
    "CLTHA":    "Drywall Finishing Tools > Columbia > Handles & Extensions",  # Tomalock Adaptor
    "UTA":      "Drywall Finishing Tools > Columbia > Handles & Extensions",  # Universal Thread Adaptor
    # Mud Pans & Pumps — mud pans, hawks, bucket scoops, mud rollers
    "2KMR12":   "Drywall Finishing Tools > Columbia > Mud Pans & Pumps",  # 2K Mud Roller
    "13-H-S":   "Drywall Finishing Tools > Columbia > Mud Pans & Pumps",  # Aluminum Hawk
    "OPBS":     "Drywall Finishing Tools > Columbia > Mud Pans & Pumps",  # Bucket Scoop (SS)
    "BSNC":     "Drywall Finishing Tools > Columbia > Mud Pans & Pumps",  # Bucket Scoop Cork
    "CBS2K":    "Drywall Finishing Tools > Columbia > Mud Pans & Pumps",  # Bucket Scoop Soft Grip
    "COL-STAINLESS-STEEL-MUD-PAN-WITH-FREE-MUD-GRIP":
                "Drywall Finishing Tools > Columbia > Mud Pans & Pumps",
    # Corner Tools — compound/mud rollers for corners
    "FMRAF1-5": "Drywall Finishing Tools > Columbia > Corner Tools",  # Corner Mud Roller w/ Frame
    "COL-MUD-ROLLER-WITH-ACME-THREAD-ROLLER-FRAME":
                "Drywall Finishing Tools > Columbia > Corner Tools",
    # Tool Sets & Kits — multi-item sets
    "COLHTBDL6":  "Drywall Finishing Tools > Columbia > Tool Sets & Kits",  # Mud Roller+Sabre Set
    "COLHTBDL14": "Drywall Finishing Tools > Columbia > Tool Sets & Kits",  # Basic Hand Tool Set
    "COLHTBDL5":  "Drywall Finishing Tools > Columbia > Tool Sets & Kits",  # Knife+Mud Pan Set
    "COLHTBDL8":  "Drywall Finishing Tools > Columbia > Tool Sets & Kits",  # Complete Putty Set
    "COLHTBDL7":  "Drywall Finishing Tools > Columbia > Tool Sets & Kits",  # Essentials Set
    "COLHTBDL15": "Drywall Finishing Tools > Columbia > Tool Sets & Kits",  # Mud Roller+Knife Set
    "COLHTBDL9":  "Drywall Finishing Tools > Columbia > Tool Sets & Kits",  # Pro Flex Curved+Hawk
    "COLHTBDL11": "Drywall Finishing Tools > Columbia > Tool Sets & Kits",  # Pro Flex Flat+Hawk
    "COLHTBDL10": "Drywall Finishing Tools > Columbia > Tool Sets & Kits",  # Silver+Hawk
    "COLHTBDL1":  "Drywall Finishing Tools > Columbia > Tool Sets & Kits",  # SS Hand Tool Set
    "COLHTBDL4":  "Drywall Finishing Tools > Columbia > Tool Sets & Kits",  # Knife+Mud Pan Set
    "COLHTBDL12": "Drywall Finishing Tools > Columbia > Tool Sets & Kits",  # Super Flex+Hawk
    "TWS":        "Drywall Finishing Tools > Columbia > Tool Sets & Kits",  # Tomahawk Warrior Set
    # Parts — replacement components
    "MRW":      "Drywall Finishing Tools > Columbia > Parts",   # Mud Roller Washer
    "SF5":      "Drywall Finishing Tools > Columbia > Parts",   # Shrink Fit Comfort Grips

    # ── Level 5 > Taping & Finishing Tools (per-product split) ───────────────
    # Knives & Blades
    "BLUE-STEEL-BIG-BACK-TAPING-KNIFE-SOFT-GRIP-HANDLE":
                "Drywall Finishing Tools > Level 5 > Knives & Blades",
    "BLUE-STEEL-TAPING-KNIFE-SOFT-GRIP-HANDLE":
                "Drywall Finishing Tools > Level 5 > Knives & Blades",
    "CARBON-STEEL-FINISHING-KNIFE-WITH-SOFT-GRIP-HANDLE":
                "Drywall Finishing Tools > Level 5 > Knives & Blades",
    "5-603":    "Drywall Finishing Tools > Level 5 > Knives & Blades",
    "5-200":    "Drywall Finishing Tools > Level 5 > Knives & Blades",  # Specialized Putty Knife
    "COMPOSITE-SKIMMING-BLADE":       "Drywall Finishing Tools > Level 5 > Knives & Blades",
    "CUSTOM-STAINLESS-STEEL-FINISHING-KNIFE-WITH-SOFT-GRIP-HANDLE":
                "Drywall Finishing Tools > Level 5 > Knives & Blades",
    "FLAT-FLEX-STAINLESS-STEEL-FINISHING-TROWEL":
                "Drywall Finishing Tools > Level 5 > Knives & Blades",
    "ONE-PIECE-STAINLESS-STEEL-PUTTY-KNIVES-WITH-WELDED-HANDLE":
                "Drywall Finishing Tools > Level 5 > Knives & Blades",
    "PRO-FLEX-CURVED-BLADE-STAINLESS-STEEL-FINISHING-TROWEL":
                "Drywall Finishing Tools > Level 5 > Knives & Blades",
    "5-651":    "Drywall Finishing Tools > Level 5 > Knives & Blades",
    "5-653":    "Drywall Finishing Tools > Level 5 > Knives & Blades",
    "SKIMMING-BLADE": "Drywall Finishing Tools > Level 5 > Knives & Blades",
    "STAINLESS-STEEL-BIG-BACK-TAPING-KNIFE-SOFT-GRIP-HANDLE":
                "Drywall Finishing Tools > Level 5 > Knives & Blades",
    "TOOLS-STAINLESS-STEEL-FINISHING-KNIFE-WITH-SOFT-GRIP-HANDLE":
                "Drywall Finishing Tools > Level 5 > Knives & Blades",
    "STAINLESS-STEEL-FLEX-OFFSET-KNIFE-WITH-SOFT-GRIP-HANDLE":
                "Drywall Finishing Tools > Level 5 > Knives & Blades",
    "5-602":    "Drywall Finishing Tools > Level 5 > Knives & Blades",
    "5-620":    "Drywall Finishing Tools > Level 5 > Knives & Blades",
    "STAINLESS-STEEL-JOINT-KNIFE-WITH-COMPOSITE-HANDLE":
                "Drywall Finishing Tools > Level 5 > Knives & Blades",
    "STAINLESS-STEEL-STIFF-OFFSET-KNIFE-WITH-SOFT-GRIP-HANDLE":
                "Drywall Finishing Tools > Level 5 > Knives & Blades",
    "STAINLESS-STEEL-TAPING-KNIFE-COMPOSITE-HANDLE":
                "Drywall Finishing Tools > Level 5 > Knives & Blades",
    "5-619":    "Drywall Finishing Tools > Level 5 > Knives & Blades",
    "TOOLS-STAINLESS-STEEL-TAPING-KNIFE-WITH-SOFT-GRIP-HANDLE":
                "Drywall Finishing Tools > Level 5 > Knives & Blades",
    "5-203":    "Drywall Finishing Tools > Level 5 > Knives & Blades",  # Trim Puller
    "TRIPLE-HARDENED-RIGID-CURVED-GOLDEN-STAINLESS-STEEL-FINISHING-TROWEL":
                "Drywall Finishing Tools > Level 5 > Knives & Blades",
    "TRIPLE-HARDENED-RIGID-FLAT-GOLDEN-STAINLESS-STEEL-FINISHING-TROWEL":
                "Drywall Finishing Tools > Level 5 > Knives & Blades",
    # Handles & Extensions
    "4-941C":   "Drywall Finishing Tools > Level 5 > Handles & Extensions",  # Composite Blade Pole Adapter
    "5-392":    "Drywall Finishing Tools > Level 5 > Handles & Extensions",  # Off-Set Knife Adapter
    "SKIMMING-BLADE-EXTENSION-HANDLES":
                "Drywall Finishing Tools > Level 5 > Handles & Extensions",
    "4-945":    "Drywall Finishing Tools > Level 5 > Handles & Extensions",  # Extension + Pole Adapter
    "4-941":    "Drywall Finishing Tools > Level 5 > Handles & Extensions",  # Pole Adapter
    # Mud Pans & Pumps
    "5-325":    "Drywall Finishing Tools > Level 5 > Mud Pans & Pumps",  # Professional Aluminum Hawk
    "PROFESSIONAL-MIXER": "Drywall Finishing Tools > Level 5 > Mud Pans & Pumps",
    "5-210":    "Drywall Finishing Tools > Level 5 > Mud Pans & Pumps",  # SS Bucket Scoop
    "TOOLS-STAINLESS-STEEL-MUD-PAN":
                "Drywall Finishing Tools > Level 5 > Mud Pans & Pumps",
    # Corner Tools
    "4-006":    "Drywall Finishing Tools > Level 5 > Corner Tools",  # Corner Compound Roller
    "DRYWALL-COMPOUND-ROLLER-WITH-FRAME":
                "Drywall Finishing Tools > Level 5 > Corner Tools",
    "TOOLS-STAINLESS-STEEL-CORNER-TOOLS-WITH-SOFT-GRIP-HANDLE":
                "Drywall Finishing Tools > Level 5 > Corner Tools",
    # Semi-Automatic Taping Tools
    "5-311":    "Drywall Finishing Tools > Level 5 > Semi-Automatic Taping Tools",  # Banjo
    # Tool Sets & Kits
    "5-440C":   "Drywall Finishing Tools > Level 5 > Tool Sets & Kits",  # Composite Blade Set 3pc
    "5-441C":   "Drywall Finishing Tools > Level 5 > Tool Sets & Kits",  # Composite Blade Set 3pc v2
    "5-609":    "Drywall Finishing Tools > Level 5 > Tool Sets & Kits",  # Deluxe Hand Tool Set
    "5-360":    "Drywall Finishing Tools > Level 5 > Tool Sets & Kits",  # Flat Tool Bag 20"
    "5-550":    "Drywall Finishing Tools > Level 5 > Tool Sets & Kits",  # Blade+Roller Set
    "5-440":    "Drywall Finishing Tools > Level 5 > Tool Sets & Kits",  # Skimming Blade Set 3pc
    "5-441":    "Drywall Finishing Tools > Level 5 > Tool Sets & Kits",  # Skimming Blade Set 3pc v2
    "5-600":    "Drywall Finishing Tools > Level 5 > Tool Sets & Kits",  # Hand Tool Finishing Set
    # Parts — replacement components
    "5-411":    "Drywall Finishing Tools > Level 5 > Parts",  # Heat-Shrink Handle Grips
    "5-295":    "Drywall Finishing Tools > Level 5 > Parts",  # Pro Mixer Adaptor w/ Hex Key
}


def read_csv(path: Path) -> tuple[list[str], list[dict[str, str]]]:
    with open(path, encoding="utf-8", newline="") as f:
        reader = csv.DictReader(f)
        headers = list(reader.fieldnames or [])
        rows = list(reader)
    return headers, rows


def write_csv(path: Path, headers: list[str], rows: list[dict[str, str]]) -> None:
    with open(path, "w", encoding="utf-8", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=headers, quoting=csv.QUOTE_ALL,
                                extrasaction="ignore")
        writer.writeheader()
        writer.writerows(rows)


def leaf_of(category_path: str) -> str:
    """Extract the leaf (last >) segment from a category path."""
    return category_path.split(">")[-1].strip()


def update_tags(tags_cell: str, old_leaf: str, new_leaf: str) -> str:
    """
    Replace old_leaf with new_leaf inside the comma-separated tags string,
    if the tag exists.  Case-sensitive match.
    """
    if not tags_cell or old_leaf == new_leaf:
        return tags_cell
    parts = [t.strip() for t in tags_cell.split(",")]
    updated = [new_leaf if t == old_leaf else t for t in parts]
    return ", ".join(updated)


def update_search_keywords(kw_cell: str, old_path: str, new_path: str) -> str:
    """Replace the old full category path with the new one in meta:search_keywords."""
    if not kw_cell or old_path == new_path:
        return kw_cell
    # Replace all occurrences (exact string match)
    return kw_cell.replace(old_path, new_path)


def remap_row(row: dict, sku_to_new_cat: dict[str, str]) -> tuple[dict, str | None]:
    """
    Determine the new category for a row, applying SKU overrides first, then
    simple whole-category renames.

    Returns (updated_row, change_description) where change_description is None
    if no change was made.
    """
    row = dict(row)
    sku = row.get("SKU", "").strip()
    old_cat = row.get("Categories", "").strip()

    # 1. SKU-level override (handles Asgard, Columbia, Level 5, TapeTech Accessories splits)
    if sku in sku_to_new_cat:
        new_cat = sku_to_new_cat[sku]
        if new_cat != old_cat:
            old_leaf = leaf_of(old_cat)
            new_leaf = leaf_of(new_cat)
            row["Categories"] = new_cat
            row["Tags"] = update_tags(row.get("Tags", ""), old_leaf, new_leaf)
            row["meta:search_keywords"] = update_search_keywords(
                row.get("meta:search_keywords", ""), old_cat, new_cat
            )
            return row, f"  [{sku}] {old_cat!r} → {new_cat!r}"

    # 2. Whole-category rename
    if old_cat in CATEGORY_SIMPLE_REMAP:
        new_cat = CATEGORY_SIMPLE_REMAP[old_cat]
        old_leaf = leaf_of(old_cat)
        new_leaf = leaf_of(new_cat)
        row["Categories"] = new_cat
        row["Tags"] = update_tags(row.get("Tags", ""), old_leaf, new_leaf)
        row["meta:search_keywords"] = update_search_keywords(
            row.get("meta:search_keywords", ""), old_cat, new_cat
        )
        return row, f"  [{sku}] {old_cat!r} → {new_cat!r}"

    return row, None


def build_parent_map(rows: list[dict]) -> dict[str, str]:
    """
    Build a map of parent_sku → new_category for VARIATION rows so they
    follow their variable parent's new category.
    """
    # We'll populate this in two passes, but for now collect what we know
    # from SKU_CATEGORY_MAP (parent SKUs may be in there) and from
    # CATEGORY_SIMPLE_REMAP applied to variable rows.
    parent_cat: dict[str, str] = {}
    for row in rows:
        if row.get("Type") in ("simple", "variable"):
            sku = row["SKU"].strip()
            cat = row.get("Categories", "").strip()
            parent_cat[sku] = cat
    return parent_cat


def apply_remapping() -> None:
    headers, rows = read_csv(CATALOG_PATH)

    # Pass 1: remap all rows individually (simple, variable, variation)
    # Build a pre-pass sku→new_cat from SKU_CATEGORY_MAP plus deriving the
    # variation children from their parent's new cat.

    # a. Determine new cats for all simple/variable rows first
    parent_new_cat: dict[str, str] = {}  # parent_sku → new_cat after remapping
    for row in rows:
        if row.get("Type") in ("simple", "variable"):
            sku = row["SKU"].strip()
            old_cat = row.get("Categories", "").strip()
            if sku in SKU_CATEGORY_MAP:
                parent_new_cat[sku] = SKU_CATEGORY_MAP[sku]
            elif old_cat in CATEGORY_SIMPLE_REMAP:
                parent_new_cat[sku] = CATEGORY_SIMPLE_REMAP[old_cat]
            else:
                parent_new_cat[sku] = old_cat

    # b. Now build a full SKU override map that also covers variation rows
    #    by inheriting from their parent.
    full_sku_map: dict[str, str] = dict(SKU_CATEGORY_MAP)
    for row in rows:
        if row.get("Type") == "variation":
            parent_sku = row.get("Parent", "").strip()
            sku = row["SKU"].strip()
            if parent_sku in parent_new_cat:
                full_sku_map[sku] = parent_new_cat[parent_sku]

    # c. Apply to all rows
    updated_rows = []
    changes: list[str] = []
    for row in rows:
        new_row, change = remap_row(row, full_sku_map)
        updated_rows.append(new_row)
        if change:
            changes.append(change)

    # Summarise
    unique_changes: dict[str, str] = {}
    for c in changes:
        # Deduplicate by "old → new" text (many variation rows repeat same path)
        match = re.search(r"'(.+?)' → '(.+?)'", c)
        if match:
            key = f"{match.group(1)} → {match.group(2)}"
            unique_changes[key] = c

    print(f"\nTotal rows processed : {len(rows)}")
    print(f"Total rows changed   : {len(changes)}")
    print(f"Unique path remaps   : {len(unique_changes)}\n")
    print("Unique remaps applied:")
    for key in sorted(unique_changes):
        print(f"  {key}")

    if DRY_RUN:
        print("\n[DRY RUN] No files were written.  Pass --apply to commit changes.")
        return

    # Create dated backup
    ts = datetime.now(timezone.utc).strftime("%Y%m%d")
    backup_path = CATALOG_PATH.with_suffix(
        f".pre-category-remap-{ts}.csv"
    )
    if not backup_path.exists():
        import shutil
        shutil.copy2(CATALOG_PATH, backup_path)
        print(f"\nBackup written: {backup_path.name}")

    write_csv(CATALOG_PATH, headers, updated_rows)
    print(f"Catalog updated: {CATALOG_PATH.name}")


if __name__ == "__main__":
    apply_remapping()
