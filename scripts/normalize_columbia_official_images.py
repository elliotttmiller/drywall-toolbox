#!/usr/bin/env python3
"""
Normalize official Columbia product images and update the launch catalog.

This script:
  1. Reads all official Columbia images from:
       products/Production/launch/launch_images/columbia_official/
  2. Assigns each a normalized ``columbia_tools_`` filename following the
     established convention: ``columbia_tools_{product_code}_{seq:02d}.webp``
  3. Copies each official image into:
       products/Production/launch/launch_images/
     (replacing any existing file at that path)
  4. Builds an old-filename → new-filename map and updates all Columbia image
     URLs in dtb_woocommerce_official_catalog.csv so every reference points to
     the correct official image.
  5. Writes a human-readable migration report to:
       products/Production/launch/reports/columbia_official_image_migration_{ts}.md

Run from the repository root:
    python scripts/normalize_columbia_official_images.py [--dry-run]
"""

from __future__ import annotations

import argparse
import csv
import os
import re
import shutil
import sys
from datetime import datetime
from pathlib import Path

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------
REPO_ROOT = Path(__file__).resolve().parents[1]
OFFICIAL_DIR = REPO_ROOT / "products/Production/launch/launch_images/columbia_official"
LAUNCH_IMAGES = REPO_ROOT / "products/Production/launch/launch_images"
CATALOG_CSV = REPO_ROOT / "products/Production/launch/dtb_woocommerce_official_catalog.csv"
REPORTS_DIR = REPO_ROOT / "products/Production/launch/reports"
IMAGE_BASE_URL = "https://drywalltoolbox.com/wp-content/uploads/2026/media"

# ---------------------------------------------------------------------------
# Complete mapping: official filename stem → normalized columbia_tools_ stem
#
# Keys are the bare stem of each official webp file (no directory, no extension).
# Values are the normalized stem that the file will be written as in launch_images.
#
# Ordering within a product group determines the _01/_02/… sequence number when
# multiple official images share the same base code.  Within each product group
# the first entry is the primary (hero) image.
# ---------------------------------------------------------------------------
OFFICIAL_STEM_TO_NORMALIZED: dict[str, str] = {

    # ── Angle Heads ──────────────────────────────────────────────────────────
    "columbia-angleheads-angleheads-2ah":                       "columbia_tools_2ah_01",
    "columbia-angleheads-angleheads-2-5ah":                     "columbia_tools_25ah_01",
    "columbia-angleheads-angleheads-3ah":                       "columbia_tools_3ah_01",
    "columbia-angleheads-angleheads-3-5ah":                     "columbia_tools_35ah_01",
    "columbia-angleheads-angleheads-aha":                       "columbia_tools_aha_01",
    "columbia-angleheads-angleheads-angle-head-front":          "columbia_tools_ah_front_01",
    "columbia-angleheads-angleheads-angle-head-all-sizes-ah-1": "columbia_tools_ah_all_sizes_01",
    "columbia-angleheads-angleheads-angle-head-all-sizes-ah-2": "columbia_tools_ah_all_sizes_02",
    "columbia-angleheads-angleheads-angle-head-all-sizes-ah-3": "columbia_tools_ah_all_sizes_03",

    # ── Billet / UHMW Mud Applicators ────────────────────────────────────────
    # ICA2-1 applicator (back = primary, front = secondary)
    "columbia-applicators-applicators-ica2-1-back":             "columbia_tools_ica21_01",
    "columbia-applicators-applicators-ica2-1-front":            "columbia_tools_ica21_02",
    # ICA4-1 applicator
    "columbia-applicators-applicators-ica4-1-back":             "columbia_tools_ica41_01",
    "columbia-applicators-applicators-ica4-1-front":            "columbia_tools_ica41_02",
    # CEXT90 compound extension applicator
    "columbia-applicators-applicators-cext90-back":             "columbia_tools_cext90_01",
    "columbia-applicators-applicators-cext90-front":            "columbia_tools_cext90_02",
    # CFLT flat applicator
    "columbia-applicators-applicators-cflt-back":               "columbia_tools_cflt_01",
    "columbia-applicators-applicators-cflt-front":              "columbia_tools_cflt_02",
    # ICATW twin-wing applicator
    "columbia-applicators-applicators-icatw-back":              "columbia_tools_icatw_01",
    "columbia-applicators-applicators-icatw-front":             "columbia_tools_icatw_02",
    # FMH / IA90 / OA90 / OA90A (UHMW applicators)
    "columbia-applicators-applicators-fmh":                     "columbia_tools_fmh_01",
    "columbia-applicators-applicators-ia90":                    "columbia_tools_ia90_01",
    "columbia-applicators-applicators-oa90":                    "columbia_tools_oa90_01",
    "columbia-applicators-applicators-oa90a":                   "columbia_tools_oa90a_01",

    # ── Automatic Flat Boxes (auto / "A" suffix variants) ────────────────────
    "columbia-automatic-finishing-boxes-automatic-flat-boxes-8fbba":       "columbia_tools_8fbba_01",
    "columbia-automatic-finishing-boxes-automatic-flat-boxes-8fbba-back":  "columbia_tools_8fbba_02",
    "columbia-automatic-finishing-boxes-automatic-flat-boxes-8fbba-side":  "columbia_tools_8fbba_03",
    "columbia-automatic-finishing-boxes-automatic-flat-boxes-10fbba":      "columbia_tools_10fbba_01",
    "columbia-automatic-finishing-boxes-automatic-flat-boxes-12fbba":      "columbia_tools_12fbba_01",
    "columbia-automatic-finishing-boxes-automatic-flat-boxes-8ffba":       "columbia_tools_8ffba_01",
    "columbia-automatic-finishing-boxes-automatic-flat-boxes-10ffba":      "columbia_tools_10ffba_01",
    "columbia-automatic-finishing-boxes-automatic-flat-boxes-12ffba":      "columbia_tools_12ffba_01",
    "columbia-automatic-finishing-boxes-automatic-flat-boxes-14ffba":      "columbia_tools_14ffba_01",

    # ── Automatic Taper ──────────────────────────────────────────────────────
    "columbia-automatic-taper-taper-taper-1":                   "columbia_tools_taper_01",
    "columbia-automatic-taper-taper-taper-2":                   "columbia_tools_taper_02",
    "columbia-automatic-taper-taper-taperhead":                 "columbia_tools_taperhead_01",
    "columbia-automatic-taper-taper-pumpactionsleeve":          "columbia_tools_pumpactionsleeve_01",
    "columbia-automatic-taper-taper-taperwnewsleeve":           "columbia_tools_taperwnewsleeve_01",

    # ── Box Handles (180° Grip / BH) ─────────────────────────────────────────
    # Primary product shot
    "columbia-box-handles-box-handles-bh":                                          "columbia_tools_bh_01",
    # 180° Grip detailed views
    "columbia-box-handles-box-handles-180-grip-box-handle-bh-side":                 "columbia_tools_bh_02",
    "columbia-box-handles-box-handles-180-grip-box-handle-bh-top":                  "columbia_tools_bh_03",
    "columbia-box-handles-box-handles-180-grip-box-handle-bh-body-side":            "columbia_tools_bh_04",
    "columbia-box-handles-box-handles-180-grip-box-handle-bh-body-top":             "columbia_tools_bh_05",
    # Bent Box Handle (BBH)
    "columbia-box-handles-box-handles-bent-box-handle-bbh":                         "columbia_tools_bbh_01",
    # Closet Monster Handle (CMH)
    "columbia-box-handles-box-handles-closet-monster-handle-cmh":                   "columbia_tools_cmh_01",
    # Hydra Reach / EBH extended box handle
    "columbia-box-handles-box-handles-box-handle-hydra-reach":                      "columbia_tools_ebh_01",
    "columbia-box-handles-box-handles-hydra-handle-ebh-extended":                   "columbia_tools_ebh_02",
    "columbia-box-handles-box-handles-hydra-handle-ebh-reservoir-side":             "columbia_tools_ebh_03",
    "columbia-box-handles-box-handles-hydra-handle-ebh-reservoir-top":              "columbia_tools_ebh_04",
    "columbia-box-handles-box-handles-hydra-reach-ebh-head-bottom":                 "columbia_tools_ebh_05",
    "columbia-box-handles-box-handles-hydra-reach-ebh-head-side":                   "columbia_tools_ebh_06",
    "columbia-box-handles-box-handles-hydra-reach-handle-ebh-head-top":             "columbia_tools_ebh_07",
    # JKB / numbered catalog reference shots
    "columbia-box-handles-box-handles-jkb-7823":                                    "columbia_tools_jkb7823_01",
    "columbia-box-handles-box-handles-columbia-15":                                 "columbia_tools_bh_catalog_01",
    "columbia-box-handles-box-handles-columbia-16":                                 "columbia_tools_bh_catalog_02",
    "columbia-box-handles-box-handles-columbia-18":                                 "columbia_tools_bh_catalog_03",
    "columbia-box-handles-box-handles-columbia-19":                                 "columbia_tools_bh_catalog_04",
    "columbia-box-handles-box-handles-columbia-20":                                 "columbia_tools_bh_catalog_05",
    "columbia-box-handles-box-handles-columbia-63":                                 "columbia_tools_bh_catalog_06",

    # ── Columbia One Handle (C1H) ─────────────────────────────────────────────
    "columbia-columbia-one-columbiaone-c1h":                                        "columbia_tools_c1h_01",
    "columbia-columbia-one-columbiaone-c1hext":                                     "columbia_tools_c1hext_01",
    "columbia-columbia-one-columbiaone-c1hext-square":                              "columbia_tools_c1hext_02",
    "columbia-columbia-one-columbiaone-with-anglehead":                             "columbia_tools_c1h_with_ah_01",
    "columbia-columbia-one-columbiaone-with-corner-flusher-box":                    "columbia_tools_c1h_with_cfb_01",
    "columbia-columbia-one-columbiaone-with-corner-roller":                         "columbia_tools_c1h_with_cr_01",
    "columbia-columbia-one-columbiaone-with-nailspotter":                           "columbia_tools_c1h_with_ns_01",
    "columbia-columbia-one-columbiaone-anglehead-attachment-aha":                   "columbia_tools_c1h_aha_01",
    "columbia-columbia-one-columbiaone-corner-flusher-box-and-attachment":          "columbia_tools_c1h_cfb_set_01",
    "columbia-columbia-one-columbiaone-corner-flusher-box-attachment":              "columbia_tools_c1h_cfb_attach_01",

    # ── Columbia Tool Sets ────────────────────────────────────────────────────
    "columbia-columbia-tool-sets-basic-set":                    "columbia_tools_ts_basic_01",
    "columbia-columbia-tool-sets-starter-semi-auto-set":        "columbia_tools_ts_starter_01",
    "columbia-columbia-tool-sets-finishing-set":                "columbia_tools_ts_finishing_01",
    "columbia-columbia-tool-sets-flat-box-set":                 "columbia_tools_ts_flatbox_01",
    "columbia-columbia-tool-sets-corner-semi-auto-set":         "columbia_tools_ts_corner_01",
    "columbia-columbia-tool-sets-full-semi-auto-set":           "columbia_tools_ts_full_01",
    "columbia-columbia-tool-sets-complete-set":                 "columbia_tools_ts_complete_01",

    # ── Commando Set ─────────────────────────────────────────────────────────
    "columbia-commando-set-commando-semi-auto-set-commandoset":            "columbia_tools_commando_01",
    "columbia-commando-set-commando-semi-auto-set-commandosetfront":       "columbia_tools_commando_02",
    "columbia-commando-set-commando-semi-auto-set-commandosettools":       "columbia_tools_commando_03",
    "columbia-commando-set-commando-semi-auto-set-commandoset-2":          "columbia_tools_commando_04",
    "columbia-commando-set-commando-semi-auto-set-commandosetfront-2":     "columbia_tools_commando_05",
    "columbia-commando-set-commando-semi-auto-set-commandotransparent":    "columbia_tools_commando_06",
    "columbia-commando-set-commando-semi-auto-set-commandoblacktransparent": "columbia_tools_commando_07",

    # ── Cam-Lock Tube Box Filler ──────────────────────────────────────────────
    "columbia-compound-tube-box-filler-cam-lock-tube-box-filler-boxfillerattachment":            "columbia_tools_tbbf_01",
    "columbia-compound-tube-box-filler-cam-lock-tube-box-filler-boxfillerattachment-2":          "columbia_tools_tbbf_02",
    "columbia-compound-tube-box-filler-cam-lock-tube-box-filler-boxfillerattachmentsmallsquare": "columbia_tools_tbbf_03",
    "columbia-compound-tube-box-filler-cam-lock-tube-box-filler-boxfillerattachment2":           "columbia_tools_tbbf_04",
    "columbia-compound-tube-box-filler-cam-lock-tube-box-filler-boxfillerattachment2-2":         "columbia_tools_tbbf_05",
    "columbia-compound-tube-box-filler-cam-lock-tube-box-filler-boxfillerattachment2smallsquare":"columbia_tools_tbbf_06",
    "columbia-compound-tube-box-filler-cam-lock-tube-box-filler-boxfillerattachment3":           "columbia_tools_tbbf_07",
    "columbia-compound-tube-box-filler-cam-lock-tube-box-filler-boxfillerattachment3-2":         "columbia_tools_tbbf_08",
    "columbia-compound-tube-box-filler-cam-lock-tube-box-filler-boxfillerattachment3smallsquare":"columbia_tools_tbbf_09",
    "columbia-compound-tube-box-filler-cam-lock-tube-box-filler-boxfillerattachment4":           "columbia_tools_tbbf_10",
    "columbia-compound-tube-box-filler-cam-lock-tube-box-filler-boxfillerattachment4smallsquare":"columbia_tools_tbbf_11",

    # ── Compound / Cam-Lock Tubes ─────────────────────────────────────────────
    # CLT = cam-lock tube, CMT = compound mud tube
    "columbia-compound-tubes-compound-tubes-clt":               "columbia_tools_clt_01",
    "columbia-compound-tubes-compound-tubes-cmt":               "columbia_tools_cmt_01",
    "columbia-compound-tubes-compound-tubes-compoundtube":      "columbia_tools_compound_tube_01",

    # ── Corner Flusher Boxes (Throttle) ──────────────────────────────────────
    "columbia-corner-flushers-boxes-throttle-box-throttlebox7":             "columbia_tools_7cfb_01",
    "columbia-corner-flushers-boxes-throttle-box-throttlebox7-2":           "columbia_tools_7cfb_02",
    "columbia-corner-flushers-boxes-throttle-box-throttlebox7small":        "columbia_tools_7cfb_03",
    "columbia-corner-flushers-boxes-throttle-box-throttlebox8":             "columbia_tools_8cfb_01",
    "columbia-corner-flushers-boxes-throttle-box-throttlebox8-2":           "columbia_tools_8cfb_02",
    "columbia-corner-flushers-boxes-throttle-box-throttlebox8small":        "columbia_tools_8cfb_03",
    "columbia-corner-flushers-boxes-throttle-box-throttleboxback":          "columbia_tools_cfb_back_01",
    "columbia-corner-flushers-boxes-throttle-box-throttleboxback-copy":     "columbia_tools_cfb_back_02",
    "columbia-corner-flushers-boxes-throttle-box-throttleboxbacksmall":     "columbia_tools_cfb_back_03",
    "columbia-corner-flushers-boxes-throttle-box-throttleboxhandle":        "columbia_tools_cfb_handle_01",
    "columbia-corner-flushers-boxes-throttle-box-throttleboxhandle-2":      "columbia_tools_cfb_handle_02",
    "columbia-corner-flushers-boxes-throttle-box-throttleboxhandlesmall":   "columbia_tools_cfb_handle_03",

    # ── Corner Flushers (direct / standard / combo / wide-track) ─────────────
    "columbia-corner-flushers-corner-flushers-2-5-direct-flusher-2-5df":    "columbia_tools_2_5df_01",
    "columbia-corner-flushers-corner-flushers-2-5inchflusher":              "columbia_tools_25sf_01",
    "columbia-corner-flushers-corner-flushers-2-5inchflusherwhitebg":       "columbia_tools_25sf_02",
    "columbia-corner-flushers-corner-flushers-3-direct-flusher-3df":        "columbia_tools_3df_01",
    "columbia-corner-flushers-corner-flushers-3-5-direct-flusher-3-5df":    "columbia_tools_3_5df_01",
    "columbia-corner-flushers-corner-flushers-3inchflusher":                "columbia_tools_3sf_01",
    "columbia-corner-flushers-corner-flushers-3inchflusherwhitebg":         "columbia_tools_3sf_02",
    "columbia-corner-flushers-corner-flushers-combo-flusher":               "columbia_tools_3csf_01",
    "columbia-corner-flushers-corner-flushers-wide-track-direct-flusher-3wtdf":    "columbia_tools_3wtdf_01",
    "columbia-corner-flushers-corner-flushers-wide-track-standard-flusher-3wtsf":  "columbia_tools_3wtsf_01",

    # ── Corner Rollers ────────────────────────────────────────────────────────
    "columbia-corner-rollers-untitled-folder-2-cobcr":              "columbia_tools_cobcr_01",
    "columbia-corner-rollers-untitled-folder-2-cobcre":             "columbia_tools_cobcre_01",
    "columbia-corner-rollers-untitled-folder-2-cobrcrw":            "columbia_tools_cobcrw_01",
    "columbia-corner-rollers-untitled-folder-2-cbncr":              "columbia_tools_cbncr_01",
    "columbia-corner-rollers-untitled-folder-2-cbncr-on-handle":    "columbia_tools_cbncr_02",
    "columbia-corner-rollers-untitled-folder-2-cr":                 "columbia_tools_cr_01",
    "columbia-corner-rollers-untitled-folder-2-newcornercobra":     "columbia_tools_cr_02",
    "columbia-corner-rollers-untitled-folder-2-cornercobrawhitebg": "columbia_tools_cr_03",

    # ── Fat Boy Flat Boxes ────────────────────────────────────────────────────
    "columbia-fat-boy-finishing-boxes-fat-boy-box-8fbb":    "columbia_tools_8fbb_01",
    "columbia-fat-boy-finishing-boxes-fat-boy-box-10fbb":   "columbia_tools_10fbb_01",
    "columbia-fat-boy-finishing-boxes-fat-boy-box-12fbb":   "columbia_tools_12fbb_01",
    "columbia-fat-boy-finishing-boxes-fat-boy-box-55fbb":   "columbia_tools_55fbb_01",
    "columbia-fat-boy-finishing-boxes-fat-boy-box-itfb":    "columbia_tools_itfb_01",
    "columbia-fat-boy-finishing-boxes-fat-boy-box-itfb1":   "columbia_tools_itfb_02",

    # ── Flat Finisher Boxes ───────────────────────────────────────────────────
    "columbia-flat-finishing-boxes-flat-box-55ffb":         "columbia_tools_55ffb_01",
    "columbia-flat-finishing-boxes-flat-box-7ffb":          "columbia_tools_7ffb_01",
    "columbia-flat-finishing-boxes-flat-box-8ffb":          "columbia_tools_8ffb_01",
    "columbia-flat-finishing-boxes-flat-box-10ffb":         "columbia_tools_10ffb_01",
    "columbia-flat-finishing-boxes-flat-box-12ffb":         "columbia_tools_12ffb_01",
    "columbia-flat-finishing-boxes-flat-box-14ffb":         "columbia_tools_14ffb_01",
    "columbia-flat-finishing-boxes-flat-box-itc-kside":     "columbia_tools_itc_kside_01",

    # ── Goosenecks ────────────────────────────────────────────────────────────
    "columbia-goosenecks-gooseneck-gn":                     "columbia_tools_gn_01",
    "columbia-goosenecks-gooseneck-tbgn":                   "columbia_tools_tbgn_01",
    "columbia-goosenecks-gooseneck-tbgn-with-height-adjust":"columbia_tools_tbgn_02",

    # ── Matrix Handles ────────────────────────────────────────────────────────
    "columbia-matrix-handles-matrix-handles-matrixhead":    "columbia_tools_mh_head_01",
    "columbia-matrix-handles-matrix-handles-matrixes":      "columbia_tools_mh_all_01",
    "columbia-matrix-handles-matrix-handles-matrixextended":"columbia_tools_mh_ext_01",
    "columbia-matrix-handles-matrix-handles-matrix29-39":   "columbia_tools_mhs_01",
    "columbia-matrix-handles-matrix-handles-matrix40-60":   "columbia_tools_mh_01",
    "columbia-matrix-handles-matrix-handles-matrix56-76":   "columbia_tools_mhl_01",

    # ── Mud Pumps ─────────────────────────────────────────────────────────────
    "columbia-mud-pumps-pumps-hmp":                         "columbia_tools_hmp_01",
    "columbia-mud-pumps-pumps-tbmp":                        "columbia_tools_tbmp_01",
    "columbia-mud-pumps-pumps-tbmp-in-bucket":              "columbia_tools_tbmp_02",
    "columbia-mud-pumps-pumps-gn":                          "columbia_tools_tbgn_pump_01",
    "columbia-mud-pumps-pumps-tbgn":                        "columbia_tools_tbgn_pump_02",
    "columbia-mud-pumps-pumps-tbgn-with-height-adjust":     "columbia_tools_tbgn_pump_03",
    "columbia-mud-pumps-pumps-boxfiller":                   "columbia_tools_bf_01",

    # ── Nail Spotters ─────────────────────────────────────────────────────────
    "columbia-nailspotters-nail-spotters-nailspotter-2":    "columbia_tools_2ns_01",
    "columbia-nailspotters-nail-spotters-nailspotter-3":    "columbia_tools_3ns_01",

    # ── Sabre Smoothing Blades ────────────────────────────────────────────────
    "columbia-sabre-smoothing-blades-sabre-pngs-7inch-1":   "columbia_tools_tsb7_01",
    "columbia-sabre-smoothing-blades-sabre-pngs-10inch-1":  "columbia_tools_tsb10_01",
    "columbia-sabre-smoothing-blades-sabre-pngs-12inch":    "columbia_tools_tsb12_01",
    "columbia-sabre-smoothing-blades-sabre-pngs-14inch":    "columbia_tools_tsb14_01",
    "columbia-sabre-smoothing-blades-sabre-pngs-16inch":    "columbia_tools_tsb16_01",
    "columbia-sabre-smoothing-blades-sabre-pngs-18inch":    "columbia_tools_tsb18_01",
    "columbia-sabre-smoothing-blades-sabre-pngs-24inch":    "columbia_tools_tsb24_01",
    "columbia-sabre-smoothing-blades-sabre-pngs-32":        "columbia_tools_tsb32_01",
    "columbia-sabre-smoothing-blades-sabre-pngs-40inch":    "columbia_tools_tsb40_01",
    "columbia-sabre-smoothing-blades-sabre-pngs-48inch":    "columbia_tools_tsb48_01",
    "columbia-sabre-smoothing-blades-sabre-pngs-sabercase": "columbia_tools_sabercase_01",
    "columbia-sabre-smoothing-blades-sabre-pngs-saberclaw": "columbia_tools_saberclaw_01",
    "columbia-sabre-smoothing-blades-sabre-pngs-saberset":  "columbia_tools_saberset_01",
}

# ---------------------------------------------------------------------------
# New images to APPEND to specific catalog products.
#
# These are official images that are genuinely new — they have no existing
# placeholder in the catalog — and must be added to the relevant product's
# Images column.  The images are appended after any existing images (after
# URL substitutions have been applied).
#
# Keys are SKU values from the catalog.  Values are lists of normalized stems
# (without .webp extension) to append.  Duplicates are suppressed at write
# time so re-running is idempotent.
# ---------------------------------------------------------------------------
NEW_IMAGES_FOR_PRODUCTS: dict[str, list[str]] = {

    # ── Angle Heads ──────────────────────────────────────────────────────────
    "COL-ANGLE-HEAD": [
        "columbia_tools_ah_front_01",
        "columbia_tools_ah_all_sizes_01",
        "columbia_tools_ah_all_sizes_02",
        "columbia_tools_ah_all_sizes_03",
    ],

    # ── 180° Grip Box Handle ─────────────────────────────────────────────────
    # Primary image is replaced (flat_box_handle_01 → bh_01 via explicit rename).
    # Add the multi-view shots and numbered catalog reference photos.
    "COL-180-GRIP-FLAT-BOX-HANDLE": [
        "columbia_tools_bh_02",
        "columbia_tools_bh_03",
        "columbia_tools_bh_04",
        "columbia_tools_bh_05",
        "columbia_tools_bbh_01",
        "columbia_tools_ebh_01",
        "columbia_tools_ebh_02",
        "columbia_tools_ebh_03",
        "columbia_tools_ebh_04",
        "columbia_tools_ebh_05",
        "columbia_tools_ebh_06",
        "columbia_tools_ebh_07",
        "columbia_tools_jkb7823_01",
        "columbia_tools_bh_catalog_01",
        "columbia_tools_bh_catalog_02",
        "columbia_tools_bh_catalog_03",
        "columbia_tools_bh_catalog_04",
        "columbia_tools_bh_catalog_05",
        "columbia_tools_bh_catalog_06",
    ],

    # ── Automatic Flat Boxes (auto / "A" suffix size variants) ───────────────
    "COL-AUTOMATIC-FLAT-BOX": [
        "columbia_tools_8ffba_01",
        "columbia_tools_10fbba_01",
        "columbia_tools_10ffba_01",
        "columbia_tools_12fbba_01",
        "columbia_tools_12ffba_01",
        "columbia_tools_14ffba_01",
        "columbia_tools_8fbba_02",
        "columbia_tools_8fbba_03",
    ],

    # ── Automatic Fat Boy Flat Boxes ─────────────────────────────────────────
    "COL-AUTOMATIC-FAT-BOY-BOX": [
        "columbia_tools_8fbba_02",
        "columbia_tools_8fbba_03",
        "columbia_tools_10fbba_01",
        "columbia_tools_12fbba_01",
    ],

    # ── Automatic Taper ──────────────────────────────────────────────────────
    "COL-AUTOMATIC-TAPER": [
        "columbia_tools_taper_02",
        "columbia_tools_taperhead_01",
    ],

    # ── Billet Mud Applicator ─────────────────────────────────────────────────
    "COL-BILLET-MUD-APPLICATOR": [
        "columbia_tools_cflt_02",
        "columbia_tools_icatw_01",
        "columbia_tools_icatw_02",
        "columbia_tools_oa90_01",
        "columbia_tools_oa90a_01",
    ],

    # ── UHMW Mud Applicator ───────────────────────────────────────────────────
    "COL-UHMW-MUD-APPLICATOR": [
        "columbia_tools_oa90_01",
        "columbia_tools_oa90a_01",
    ],

    # ── Cam-Lock Tube Box Filler ──────────────────────────────────────────────
    # tbbf_01 already in catalog (content replaced); add views 02-11.
    "COL-BOX-FILLER": [
        "columbia_tools_tbbf_02",
        "columbia_tools_tbbf_03",
        "columbia_tools_tbbf_04",
        "columbia_tools_tbbf_05",
        "columbia_tools_tbbf_06",
        "columbia_tools_tbbf_07",
        "columbia_tools_tbbf_08",
        "columbia_tools_tbbf_09",
        "columbia_tools_tbbf_10",
        "columbia_tools_tbbf_11",
        "columbia_tools_compound_tube_01",
    ],

    # ── Cam-Lock Tube ─────────────────────────────────────────────────────────
    # All four old size-specific images fold into clt_01 (via explicit renames).
    # Add the generic compound tube shot.
    "COL-CAM-LOCK-TUBE": [
        "columbia_tools_compound_tube_01",
    ],

    # ── Compound Tube ─────────────────────────────────────────────────────────
    "COL-COMPOUND-TUBE": [
        "columbia_tools_compound_tube_01",
    ],

    # ── Matrix Flat Box Handle ────────────────────────────────────────────────
    "COL-MATRIX-FLAT-BOX-HANDLE": [
        "columbia_tools_mh_head_01",
        "columbia_tools_mh_all_01",
        "columbia_tools_mh_ext_01",
    ],

    # ── Gooseneck ─────────────────────────────────────────────────────────────
    "COL-GOOSENECK": [
        "columbia_tools_tbgn_02",
    ],

    # ── Hot Mud Pump ──────────────────────────────────────────────────────────
    "COL-HOT-MUD-PUMP": [
        "columbia_tools_tbmp_02",
        "columbia_tools_tbgn_pump_01",
        "columbia_tools_tbgn_pump_02",
        "columbia_tools_tbgn_pump_03",
    ],

    # ── Fat Boy Flat Boxes ────────────────────────────────────────────────────
    "COL-FAT-BOY-FLAT-BOX": [
        "columbia_tools_55fbb_01",
        "columbia_tools_itfb_01",
        "columbia_tools_itfb_02",
    ],

    # ── Flat Finisher Boxes ───────────────────────────────────────────────────
    "COL-FLAT-FINISHER-BOX": [
        "columbia_tools_itc_kside_01",
    ],

    # ── Throttle Corner Flusher Box ───────────────────────────────────────────
    "COL-THROTTLE-CORNER-FLUSHER-BOX": [
        "columbia_tools_cfb_back_02",
        "columbia_tools_cfb_back_03",
        "columbia_tools_cfb_handle_01",
        "columbia_tools_cfb_handle_02",
        "columbia_tools_cfb_handle_03",
    ],

    # ── Outside Corner Rollers ────────────────────────────────────────────────
    "COL-OUTSIDE-CORNER-ROLLER": [
        "columbia_tools_cr_01",
        "columbia_tools_cr_02",
        "columbia_tools_cr_03",
    ],

    # ── Columbia One Handle ───────────────────────────────────────────────────
    "COL-ONE-HANDLE": [
        "columbia_tools_c1h_with_ah_01",
        "columbia_tools_c1h_with_cfb_01",
        "columbia_tools_c1h_with_cr_01",
        "columbia_tools_c1h_with_ns_01",
        "columbia_tools_c1h_aha_01",
        "columbia_tools_c1h_cfb_set_01",
        "columbia_tools_c1h_cfb_attach_01",
    ],

    # ── Tomahawk / Sabre Smoothing Blade ─────────────────────────────────────
    "COL-TOMAHAWK-SMOOTHING-BLADE": [
        "columbia_tools_tsb16_01",
        "columbia_tools_sabercase_01",
        "columbia_tools_saberclaw_01",
        "columbia_tools_saberset_01",
    ],

    # ── Tool Set ─────────────────────────────────────────────────────────────
    # Existing images are renamed via explicit renames (ts_01→ts_basic_01, etc.).
    # Add the flat-box set image and commando semi-auto set gallery.
    "COL-TOOL-SET": [
        "columbia_tools_ts_flatbox_01",
        "columbia_tools_commando_01",
        "columbia_tools_commando_02",
        "columbia_tools_commando_03",
        "columbia_tools_commando_04",
        "columbia_tools_commando_05",
        "columbia_tools_commando_06",
        "columbia_tools_commando_07",
    ],
}


# ---------------------------------------------------------------------------
# The catalog currently uses URLs with some `-scaled` variants.
# We strip `-scaled` when looking up old filenames.
# ---------------------------------------------------------------------------

def build_old_to_new_url_map() -> dict[str, str]:
    """
    Build a mapping of old catalog image URL → new catalog image URL.

    For each official image that replaces an existing file we emit an entry:
        old_url → new_url
    where the filename part of old_url is the OLD columbia_tools_* stem and
    the filename part of new_url is the NEW normalized stem.

    When the old filename equals the new filename the content is replaced in-
    place; the URL in the catalog does not change.  Only entries where the URL
    actually changes need to appear here, but we include all for completeness.
    """
    mapping: dict[str, str] = {}

    # Explicit renames (old stem → new stem) for files whose names change
    EXPLICIT_RENAMES: dict[str, str] = {
        # BOX HANDLES
        # The 180° Grip Box Handle parent product currently uses a generic
        # 'flat_box_handle_01' placeholder; replace with the proper BH image.
        "columbia_tools_flat_box_handle_01": "columbia_tools_bh_01",

        # AUTOMATIC FLAT BOXES
        # The parent COL-AUTOMATIC-FLAT-BOX / COL-AUTOMATIC-FAT-BOY-BOX
        # used a generic 'automatic_flat_boxes_01' placeholder.
        "columbia_tools_automatic_flat_boxes_01": "columbia_tools_8fbba_01",

        # COMPOUND TUBES / BOX FILLER
        # Generic tube placeholders become model-specific names.
        "columbia_tools_clt24_01": "columbia_tools_clt_01",
        "columbia_tools_clt32_01": "columbia_tools_clt_01",
        "columbia_tools_clt42_01": "columbia_tools_clt_01",
        "columbia_tools_clt55_01": "columbia_tools_clt_01",
        "columbia_tools_cmt24_01": "columbia_tools_cmt_01",
        "columbia_tools_cmt32_01": "columbia_tools_cmt_01",
        "columbia_tools_cmt42_01": "columbia_tools_cmt_01",
        "columbia_tools_cmt55_01": "columbia_tools_cmt_01",

        # BOX FILLER (tube-based / cam-lock)
        "columbia_tools_tbbf_01": "columbia_tools_tbbf_01",   # same name, content replaced

        # GOOSENECK
        "columbia_tools_tbgn_01": "columbia_tools_tbgn_01",

        # TOOL SETS
        "columbia_tools_ts_01":   "columbia_tools_ts_basic_01",
        "columbia_tools_pts_01":  "columbia_tools_ts_starter_01",
        "columbia_tools_sacs_01": "columbia_tools_ts_corner_01",
        "columbia_tools_sacs_02": "columbia_tools_ts_full_01",
        "columbia_tools_tws_01":  "columbia_tools_ts_finishing_01",
        "columbia_tools_tws_02":  "columbia_tools_ts_complete_01",

        # TAPER (pump-action sleeve, etc.)
        "columbia_tools_ptaper_01":   "columbia_tools_pumpactionsleeve_01",
        "columbia_tools_ptaper_02":   "columbia_tools_pumpactionsleeve_01",
        "columbia_tools_sptaper_01":  "columbia_tools_taperwnewsleeve_01",
        "columbia_tools_staper_01":   "columbia_tools_taperwnewsleeve_01",
        "columbia_tools_staper_03":   "columbia_tools_taperwnewsleeve_01",

        # MATRIX HANDLES (remove duplicate views)
        "columbia_tools_mhs_02": "columbia_tools_mhs_01",
        "columbia_tools_mhs_03": "columbia_tools_mhs_01",
        "columbia_tools_mhs_04": "columbia_tools_mhs_01",
        "columbia_tools_mh_02":  "columbia_tools_mh_01",
        "columbia_tools_mh_03":  "columbia_tools_mh_01",
        "columbia_tools_mh_04":  "columbia_tools_mh_01",
        "columbia_tools_mhl_02": "columbia_tools_mhl_01",
        "columbia_tools_mhl_03": "columbia_tools_mhl_01",
        "columbia_tools_mhl_04": "columbia_tools_mhl_01",

        # ANGLE HEAD (the numbered views become the proper per-size images)
        "columbia_tools_25ah_02": "columbia_tools_ah_all_sizes_01",
        "columbia_tools_25ah_03": "columbia_tools_ah_all_sizes_02",
        "columbia_tools_25ah_04": "columbia_tools_ah_all_sizes_03",
        "columbia_tools_2ah_02":  "columbia_tools_ah_all_sizes_01",
        "columbia_tools_2ah_03":  "columbia_tools_ah_all_sizes_02",
        "columbia_tools_2ah_04":  "columbia_tools_ah_all_sizes_03",
        "columbia_tools_3ah_02":  "columbia_tools_ah_all_sizes_01",
        "columbia_tools_3ah_03":  "columbia_tools_ah_all_sizes_02",
        "columbia_tools_3ah_04":  "columbia_tools_ah_all_sizes_03",
        "columbia_tools_35ah_02": "columbia_tools_ah_all_sizes_01",
        "columbia_tools_35ah_03": "columbia_tools_ah_all_sizes_02",
        "columbia_tools_35ah_04": "columbia_tools_ah_all_sizes_03",

        # OUTSIDE CORNER ROLLERS (duplicate numbered views)
        "columbia_tools_cobcr_02":  "columbia_tools_cobcr_01",
        "columbia_tools_cobcr_03":  "columbia_tools_cobcr_01",
        "columbia_tools_cobcre_02": "columbia_tools_cobcre_01",
        "columbia_tools_cobcre_03": "columbia_tools_cobcre_01",
        "columbia_tools_cobcrw_02": "columbia_tools_cobcrw_01",
        "columbia_tools_cobcrw_03": "columbia_tools_cobcrw_01",
        "columbia_tools_cbncr_02":  "columbia_tools_cbncr_01",
        "columbia_tools_cbncr_03":  "columbia_tools_cbncr_01",

        # COLUMBIA ONE HANDLE (extra numbered views)
        "columbia_tools_c1h_02":    "columbia_tools_c1h_with_ah_01",
        "columbia_tools_c1h_03":    "columbia_tools_c1h_with_cr_01",
        "columbia_tools_c1hext_02": "columbia_tools_c1hext_02",
        "columbia_tools_c1hext_03": "columbia_tools_c1hext_01",
        "columbia_tools_c1hs_01":   "columbia_tools_c1h_with_cfb_01",
        "columbia_tools_c1hs_02":   "columbia_tools_c1h_with_ns_01",
        "columbia_tools_c1hs_03":   "columbia_tools_c1h_aha_01",
        "columbia_tools_chxl_01":   "columbia_tools_c1h_with_ah_01",

        # THROTTLE CORNER FLUSHER BOX (numbered → per-box-size images)
        "columbia_tools_7cfb_02": "columbia_tools_7cfb_02",
        "columbia_tools_7cfb_03": "columbia_tools_7cfb_03",
        "columbia_tools_7cfb_04": "columbia_tools_cfb_back_01",
        "columbia_tools_8cfb_02": "columbia_tools_8cfb_02",
        "columbia_tools_8cfb_03": "columbia_tools_8cfb_03",
        "columbia_tools_8cfb_04": "columbia_tools_cfb_back_01",

        # SABRE / TOMAHAWK blades (sabre = sabre brand, tsb = tomahawk brand)
        # The official sabre images replace the tsb placeholders only for
        # the sizes where official images exist.
        "columbia_tools_tsb7_02":  "columbia_tools_saberset_01",
        "columbia_tools_tsb10_02": "columbia_tools_saberset_01",
        "columbia_tools_tsb12_02": "columbia_tools_saberset_01",
        "columbia_tools_tsb14_02": "columbia_tools_saberset_01",
        "columbia_tools_tsb18_02": "columbia_tools_saberset_01",
        "columbia_tools_tsb24_02": "columbia_tools_saberset_01",
        "columbia_tools_tsb32_02": "columbia_tools_saberset_01",
        "columbia_tools_tsb40_02": "columbia_tools_saberset_01",
        "columbia_tools_tsb48_02": "columbia_tools_saberset_01",
    }

    for old_stem, new_stem in EXPLICIT_RENAMES.items():
        old_url = f"{IMAGE_BASE_URL}/{old_stem}.webp"
        new_url = f"{IMAGE_BASE_URL}/{new_stem}.webp"
        mapping[old_url] = new_url
        # Also map -scaled variant of old URL to new URL
        mapping[f"{IMAGE_BASE_URL}/{old_stem}-scaled.webp"] = new_url

    return mapping


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def normalize_stem(official_stem: str) -> str:
    """Return the normalized columbia_tools_ stem for an official image stem."""
    normalized = OFFICIAL_STEM_TO_NORMALIZED.get(official_stem)
    if normalized is None:
        raise KeyError(
            f"No normalization mapping found for official stem: {official_stem!r}\n"
            "Add an entry to OFFICIAL_STEM_TO_NORMALIZED."
        )
    return normalized


def log(msg: str) -> None:
    print(msg, flush=True)


# ---------------------------------------------------------------------------
# Core operations
# ---------------------------------------------------------------------------

def copy_official_images(dry_run: bool) -> list[tuple[str, str, str]]:
    """
    Copy each official image to launch_images/ with its normalized filename.

    Returns a list of (official_path, destination_path, normalized_stem) for
    every file processed.
    """
    results: list[tuple[str, str, str]] = []

    official_files = sorted(
        p for p in OFFICIAL_DIR.iterdir()
        if p.suffix == ".webp" and not p.name.startswith("_")
    )
    log(f"Found {len(official_files)} official Columbia images.")

    for src in official_files:
        stem = src.stem
        try:
            normalized = normalize_stem(stem)
        except KeyError as exc:
            log(f"  SKIP (unmapped): {src.name} — {exc}")
            continue

        dest = LAUNCH_IMAGES / f"{normalized}.webp"
        action = "OVERWRITE" if dest.exists() else "CREATE"
        log(f"  [{action}] {src.name!r:80s} → {dest.name!r}")

        if not dry_run:
            shutil.copy2(src, dest)

        results.append((str(src), str(dest), normalized))

    return results


def update_catalog_csv(
    old_to_new: dict[str, str],
    dry_run: bool,
) -> tuple[int, int, int]:
    """
    Rewrite the catalog CSV:
      1. Replace old image URLs with new ones (URL substitutions).
      2. Append genuinely new official images to the relevant parent products.

    Returns (rows_changed, urls_substituted, urls_added).
    """
    with open(CATALOG_CSV, newline="", encoding="utf-8") as fh:
        reader = csv.DictReader(fh)
        fieldnames = reader.fieldnames or []
        rows = list(reader)

    rows_changed = 0
    urls_substituted = 0
    urls_added = 0

    for row in rows:
        # Only touch Columbia rows
        if "columbia" not in row.get("Meta: _dtb_brand_key", "").lower():
            continue

        sku = row.get("SKU", "")
        images_raw = row.get("Images", "")
        row_dirty = False

        # ── Step A: substitute old URLs with new ones ──────────────────────
        parts = [p.strip() for p in images_raw.split(",") if p.strip()]
        new_parts: list[str] = []
        seen_new: set[str] = set()

        for part in parts:
            new_part = old_to_new.get(part, part)
            if new_part in seen_new:
                # Duplicate after substitution — drop it
                row_dirty = True
                urls_substituted += 1
                continue
            seen_new.add(new_part)
            if new_part != part:
                row_dirty = True
                urls_substituted += 1
            new_parts.append(new_part)

        # ── Step B: append new images for matching parent SKUs ─────────────
        new_stems = NEW_IMAGES_FOR_PRODUCTS.get(sku, [])
        for stem in new_stems:
            new_url = f"{IMAGE_BASE_URL}/{stem}.webp"
            if new_url not in seen_new:
                seen_new.add(new_url)
                new_parts.append(new_url)
                row_dirty = True
                urls_added += 1

        if row_dirty:
            row["Images"] = ", ".join(new_parts)
            rows_changed += 1

    if not dry_run:
        with open(CATALOG_CSV, "w", newline="", encoding="utf-8") as fh:
            writer = csv.DictWriter(fh, fieldnames=fieldnames)
            writer.writeheader()
            writer.writerows(rows)

    return rows_changed, urls_substituted, urls_added


def write_report(
    copied: list[tuple[str, str, str]],
    rows_changed: int,
    urls_substituted: int,
    urls_added: int,
    old_to_new: dict[str, str],
    dry_run: bool,
) -> Path:
    ts = datetime.now().strftime("%Y%m%d_%H%M%S")
    report_path = REPORTS_DIR / f"columbia_official_image_migration_{ts}.md"
    REPORTS_DIR.mkdir(parents=True, exist_ok=True)

    lines: list[str] = [
        f"# Columbia Official Image Migration — {ts}",
        "",
        f"**Mode:** {'DRY RUN (no files written)' if dry_run else 'APPLIED'}",
        f"**Official images processed:** {len(copied)}",
        f"**Catalog rows updated:** {rows_changed}",
        f"**Catalog URL references substituted:** {urls_substituted}",
        f"**New image URLs added to catalog:** {urls_added}",
        "",
        "## Files Copied / Created",
        "",
        "| Official Source | Normalized Destination |",
        "| --- | --- |",
    ]
    for src, dest, stem in sorted(copied, key=lambda x: x[2]):
        src_name = Path(src).name
        dest_name = Path(dest).name
        lines.append(f"| `{src_name}` | `{dest_name}` |")

    lines += [
        "",
        "## URL Substitutions Applied to Catalog",
        "",
        "| Old URL (filename) | New URL (filename) |",
        "| --- | --- |",
    ]
    for old, new in sorted(old_to_new.items(), key=lambda x: x[0]):
        if old != new:
            old_fname = old.split("/")[-1]
            new_fname = new.split("/")[-1]
            lines.append(f"| `{old_fname}` | `{new_fname}` |")

    lines += [
        "",
        "## New Images Added to Catalog Products",
        "",
        "| SKU | New Images Added |",
        "| --- | --- |",
    ]
    for sku, stems in sorted(NEW_IMAGES_FOR_PRODUCTS.items()):
        fnames = ", ".join(f"`{s}.webp`" for s in stems)
        lines.append(f"| `{sku}` | {fnames} |")

    report_path.write_text("\n".join(lines) + "\n", encoding="utf-8")
    return report_path


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

def parse_args(argv: list[str]) -> argparse.Namespace:
    p = argparse.ArgumentParser(
        description="Normalize and migrate Columbia official images into launch_images/ and update the catalog CSV."
    )
    p.add_argument(
        "--dry-run",
        action="store_true",
        help="Report what would happen without writing any files.",
    )
    return p.parse_args(argv)


def main(argv: list[str]) -> int:
    args = parse_args(argv)

    if args.dry_run:
        log("=== DRY RUN — no files will be modified ===\n")

    # 1. Validate all official images have mappings before doing anything
    official_files = sorted(
        p for p in OFFICIAL_DIR.iterdir()
        if p.suffix == ".webp" and not p.name.startswith("_")
    )
    missing = [
        p.stem for p in official_files
        if p.stem not in OFFICIAL_STEM_TO_NORMALIZED
    ]
    if missing:
        log("ERROR: The following official images have no normalization mapping:")
        for m in missing:
            log(f"  {m}")
        log("\nAdd entries to OFFICIAL_STEM_TO_NORMALIZED in the script and re-run.")
        return 1

    log(f"All {len(official_files)} official images have normalization mappings. ✓\n")

    # 2. Copy official images with normalized names
    log("=== Step 1: Copy official images to launch_images/ ===")
    copied = copy_official_images(dry_run=args.dry_run)
    log(f"  → {len(copied)} images {'would be' if args.dry_run else 'were'} written.\n")

    # 3. Update catalog CSV
    log("=== Step 2: Update catalog image URLs ===")
    old_to_new = build_old_to_new_url_map()
    rows_changed, urls_substituted, urls_added = update_catalog_csv(old_to_new, dry_run=args.dry_run)
    log(f"  → {rows_changed} rows changed, {urls_substituted} URL substitutions, {urls_added} new URLs added.\n")

    # 4. Write report
    log("=== Step 3: Write migration report ===")
    report_path = write_report(copied, rows_changed, urls_substituted, urls_added, old_to_new, args.dry_run)
    if not args.dry_run:
        log(f"  → Report written to: {report_path}\n")
    else:
        log(f"  → (Dry run) Report would be written to: {report_path}\n")

    log("Done.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
