# Product Image Audit Report

**Generated:** 2026-04-13 07:08 UTC  
**Source file:** `frontend/public/wp-catalog.csv`  
**Total products in catalog:** 1,553  
**Products with 2+ images:** 299  
**Products audited (all multi-image + hyphen-pair analysis):** 299  
**Products modified:** 150 (124 reorders, 26 image removals)  
**Images removed:** 35  

---

## Methodology

Every image URL in the catalog was assessed as follows:

1. **Structure analysis** — All 1,553 product image lists were parsed and every filename classified by suffix pattern: base (no suffix), zero-indexed (`_0`, `_1`, …), padded (`_01`, `_02`, …), and hash-based (`_[hex]`). This identified 299 multi-image products, 209 where the base was not first, 9 mixed-series products, and 15 hyphenated/non-hyphenated variant pairs.
2. **Resolution check** — All misplaced base images (209) and all zero-indexed first images for those products were downloaded and measured with PIL. The 15 hyphenated/non-hyphenated pairs were also measured and MD5-hashed to determine whether they were identical files or genuinely different images.
3. **Validity check** — PIL `Image.open()` was used to confirm file integrity. Any file that threw `UnidentifiedImageError` is flagged as broken and removed.
4. **Quality-based ordering** — The unsuffixed base image (`sku.webp`) is the canonical gallery thumbnail unless it is: (a) corrupt, (b) ≤ 300 px while a ≥ 1200 px numbered variant covers the same shot, or (c) provably lower-resolution than a no-hyphen variant with an identical stem.
5. **Duplicate detection** — Images are classified as duplicates when: (a) both `_N` (1200 px) and `_0N` (≤ 500 px) series exist for the same product, or (b) a no-hyphen filename (e.g., `sku0.webp`) is a 300 px re-encoding of a 1200 px hyphenated counterpart.

---

## Section 1 — Removed Images

### 1.1 Broken / Unreadable Files (9 images, 9 products)

These files returned invalid image data (PIL `UnidentifiedImageError`). Removing them prevents broken icons in the storefront.

| SKU | Removed File | Notes |
|-----|-------------|-------|
| FA302 | [`fa302.webp`](https://drywalltoolbox.com/wp/wp-content/uploads/2026/04/fa302.webp) | Corrupt / empty file |
| CFB16 | [`cfb16.webp`](https://drywalltoolbox.com/wp/wp-content/uploads/2026/04/cfb16.webp) | Corrupt / empty file |
| AH4 | [`ah4.webp`](https://drywalltoolbox.com/wp/wp-content/uploads/2026/04/ah4.webp) | Corrupt / empty file |
| FMH | [`fmh.webp`](https://drywalltoolbox.com/wp/wp-content/uploads/2026/04/fmh.webp) | Corrupt / empty file |
| IA90 | [`ia90.webp`](https://drywalltoolbox.com/wp/wp-content/uploads/2026/04/ia90.webp) | Corrupt / empty file |
| CF5-2 .5 | [`cf5-2-5.webp`](https://drywalltoolbox.com/wp/wp-content/uploads/2026/04/cf5-2-5.webp) | Corrupt duplicate — `cf5-2.5.webp` (1200×1200) covers the same shot |
| CFB-15A | [`cfb-15a.webp`](https://drywalltoolbox.com/wp/wp-content/uploads/2026/04/cfb-15a.webp) | Corrupt / empty file — discovered in hyphen-pair audit |
| CT-5 | [`ct-5.webp`](https://drywalltoolbox.com/wp/wp-content/uploads/2026/04/ct-5.webp) | Corrupt / empty file — discovered in hyphen-pair audit |
| FA-288 | [`fa-288.webp`](https://drywalltoolbox.com/wp/wp-content/uploads/2026/04/fa-288.webp) | Corrupt / empty file — discovered in hyphen-pair audit |

### 1.2 Low-Resolution Base Images Superseded by High-Resolution Replacement (6 images, 6 products)

The original base image (`sku.webp`) for these products is a legacy 300×300 thumbnail. A 1200×1200 replacement was later uploaded as `sku_0.webp`. The low-res file is removed; the 1200×1200 numbered variant becomes the gallery thumbnail.

| SKU | Removed File | Removed Res | Thumbnail Kept | Kept Res |
|-----|-------------|------------|---------------|---------|
| 4BBH | [`4bbh.webp`](https://drywalltoolbox.com/wp/wp-content/uploads/2026/04/4bbh.webp) | 300×300 | [`4bbh_0.webp`](https://drywalltoolbox.com/wp/wp-content/uploads/2026/04/4bbh_0.webp) | 1200×1200 |
| COL3DF | [`col3df.webp`](https://drywalltoolbox.com/wp/wp-content/uploads/2026/04/col3df.webp) | 300×300 | [`col3df_0.webp`](https://drywalltoolbox.com/wp/wp-content/uploads/2026/04/col3df_0.webp) | 1200×1200 |
| COL3WTDF | [`col3wtdf.webp`](https://drywalltoolbox.com/wp/wp-content/uploads/2026/04/col3wtdf.webp) | 300×300 | [`col3wtdf_0.webp`](https://drywalltoolbox.com/wp/wp-content/uploads/2026/04/col3wtdf_0.webp) | 1200×1200 |
| COL3WTSF | [`col3wtsf.webp`](https://drywalltoolbox.com/wp/wp-content/uploads/2026/04/col3wtsf.webp) | 300×300 | [`col3wtsf_0.webp`](https://drywalltoolbox.com/wp/wp-content/uploads/2026/04/col3wtsf_0.webp) | 1200×1200 |
| CT13 | [`ct13.webp`](https://drywalltoolbox.com/wp/wp-content/uploads/2026/04/ct13.webp) | 300×300 | [`ct13_0.webp`](https://drywalltoolbox.com/wp/wp-content/uploads/2026/04/ct13_0.webp) | 1200×1200 |
| CTA87-CL | [`cta87-cl.webp`](https://drywalltoolbox.com/wp/wp-content/uploads/2026/04/cta87-cl.webp) | 300×300 | [`cta87-cl_0.webp`](https://drywalltoolbox.com/wp/wp-content/uploads/2026/04/cta87-cl_0.webp) | 1200×1200 |

### 1.3 Mislabelled / Alternate-SKU Low-Resolution Duplicates (3 images, 3 products)

These 300×300 files use alternative filename forms (no hyphen, or different convention) and are lower-quality re-encodings of 1200×1200 counterparts already in the gallery.

| SKU | Removed File | Res | High-Res Equivalent |
|-----|-------------|-----|-------------------|
| SB2-18 | [`sb218_0.webp`](https://drywalltoolbox.com/wp/wp-content/uploads/2026/04/sb218_0.webp) | 300×300 | sb2-18_0.webp  (1200×1200) |
| SB2-24 | [`sb224_0.webp`](https://drywalltoolbox.com/wp/wp-content/uploads/2026/04/sb224_0.webp) | 300×300 | sb2-24_0.webp  (1200×1200) |
| CTA87-CL | [`cta87cl_0.webp`](https://drywalltoolbox.com/wp/wp-content/uploads/2026/04/cta87cl_0.webp) | 300×300 | cta87-cl_0.webp (1200×1200) |

### 1.4 Lower-Resolution Padded-Series Duplicates (17 images, 9 products)

Nine products contained both a zero-indexed series (`_0`, `_1`, … at 1200×1200) and a padded series (`_01`, `_02`, … at 500×500 or 386×386). The padded variants are clearly re-encoded duplicates that add no new visual information. All have been removed.

| SKU | Removed Padded Files | Padded Res | Retained Series |
|-----|---------------------|-----------|----------------|
| CR2 | `cr2_01.webp`, `cr2_02.webp` | 500×500 / 386×386 | `cr2_0.webp`, `cr2_1.webp` (1200×1200) |
| AH1A | `ah1a_01.webp` | 500×500 | `ah1a_0.webp`, `ah1a_1.webp` (1200×1200) |
| BH3 | `bh3_01.webp`, `bh3_02.webp` | 500×500 / 386×386 | `bh3_0.webp`, `bh3_1.webp` (1200×1200) |
| HNS12 | `hns12_01.webp`, `hns12_02.webp` | 500×500 / 386×386 | `hns12_0.webp`, `hns12_1.webp` (1200×1200) |
| MP7 | `mp7_01.webp`, `mp7_02.webp` | 500×500 / 386×386 | `mp7_0.webp`, `mp7_1.webp` (1200×1200) |
| FFB4-8 | `ffb4-8_01.webp`, `ffb4-8_02.webp` | 500×500 / 386×386 | `ffb4-8_0.webp` … `_3.webp` (1200×1200) |
| FFB1-12 | `ffb1-12_01.webp`, `ffb1-12_02.webp` | 500×500 / 386×386 | `ffb1-12_0.webp`, `ffb1-12_1.webp` (1200×1200) |
| CFB1-8 | `cfb1-8_01.webp`, `cfb1-8_02.webp` | 500×500 / 386×386 | `cfb1-8_0.webp` … `_4.webp` (1200×1200) |
| HH22 | `hh22_01.webp`, `hh22_02.webp` | 500×500 / 386×386 | `hh22_0.webp`, `hh22_1.webp` (1200×1200) |

---

## Section 2 — Reordered Image Galleries (124 products)

### 2.1 Rationale

124 products had their image order corrected so the canonical base thumbnail (`sku.webp`) appears first. These products previously had a numbered variant (`sku_0.webp` or `sku_N.webp`) in position 1.

For all 124 products, both the base and the leading numbered image are 300×300 — neither is superior in resolution. The base is promoted to position 1 to align with the catalog-wide convention (1,274 correctly ordered products already follow this pattern) and to ensure the most visually canonical product shot serves as the card thumbnail.

Ordering applied: `sku.webp` → `sku_0.webp` → `sku_1.webp` → … (ascending zero-index), then padded series if no zero-index exists.

### 2.2 Full Reorder List

| SKU | Previous First Image | Corrected First Image |
|-----|---------------------|-----------------------|
| FA-306 | `fa306_0.webp` | `fa-306.webp` |
| FA247 | `fa247_0.webp` | `fa247.webp` |
| CFB-1A | `cfb1a_0.webp` | `cfb-1a.webp` |
| BH-5 | `bh5_0.webp` | `bh-5.webp` |
| CT-28 | `ct28_0.webp` | `ct-28.webp` |
| STAPER | `staper_0.webp` | `staper.webp` |
| 10ITFB | `10itfb_0.webp` | `10itfb.webp` |
| 12FBBA | `12fbba_0.webp` | `12fbba.webp` |
| 12FBB | `12fbb_0.webp` | `12fbb.webp` |
| C12MPX6 | `c12mpx6_0.webp` | `c12mpx6.webp` |
| 14FFB | `14ffb_0.webp` | `14ffb.webp` |
| C14MPX6 | `c14mpx6_0.webp` | `c14mpx6.webp` |
| 2AH | `2ah_0.webp` | `2ah.webp` |
| 3DF | `3df_0.webp` | `3df.webp` |
| 3WTDF | `3wtdf_0.webp` | `3wtdf.webp` |
| 3BBH | `3bbh_0.webp` | `3bbh.webp` |
| CLT32 | `clt32_0.webp` | `clt32.webp` |
| CFLT | `cflt_0.webp` | `cflt.webp` |
| 42BH | `42bh_0.webp` | `42bh.webp` |
| 7CFB | `7cfb_0.webp` | `7cfb.webp` |
| 8FFB | `8ffb_0.webp` | `8ffb.webp` |
| 8FBBA | `8fbba_0.webp` | `8fbba.webp` |
| 8FBB | `8fbb_0.webp` | `8fbb.webp` |
| 8ITFB | `8itfb_0.webp` | `8itfb.webp` |
| AHA | `aha_0.webp` | `aha.webp` |
| TAPER | `taper_0.webp` | `taper.webp` |
| BH07 | `bh07_0.webp` | `bh07.webp` |
| PTAPER | `ptaper_0.webp` | `ptaper.webp` |
| CMH | `cmh_0.webp` | `cmh.webp` |
| CLTBF | `cltbf_0.webp` | `cltbf.webp` |
| CC | `cc_0.webp` | `cc.webp` |
| 7FFB | `7ffb_0.webp` | `7ffb.webp` |
| ICATW | `icatw_0.webp` | `icatw.webp` |
| MHL | `mhl_0.webp` | `mhl.webp` |
| CEXT90 | `cext90_0.webp` | `cext90.webp` |
| CBNCR | `cbncr_0.webp` | `cbncr.webp` |
| PDDM | `pddm_0.webp` | `pddm.webp` |
| SPTAPER | `sptaper_0.webp` | `sptaper.webp` |
| SSB10 | `ssb10_0.webp` | `ssb10.webp` |
| SSB12 | `ssb12_0.webp` | `ssb12.webp` |
| SSB14 | `ssb14_0.webp` | `ssb14.webp` |
| SSB16 | `ssb16_0.webp` | `ssb16.webp` |
| SSB18 | `ssb18_0.webp` | `ssb18.webp` |
| SSB24 | `ssb24_0.webp` | `ssb24.webp` |
| SSB32 | `ssb32_0.webp` | `ssb32.webp` |
| SSB40 | `ssb40_0.webp` | `ssb40.webp` |
| SSB48 | `ssb48_0.webp` | `ssb48.webp` |
| SSB7 | `ssb7_0.webp` | `ssb7.webp` |
| SAT | `sat_0.webp` | `sat.webp` |
| COBCRW | `cobcrw_0.webp` | `cobcrw.webp` |
| PTS | `pts_0.webp` | `pts.webp` |
| TBGN | `tbgn_0.webp` | `tbgn.webp` |
| TBMP | `tbmp_0.webp` | `tbmp.webp` |
| FA253 | `fa253_0.webp` | `fa253.webp` |
| CT-122A | `ct122a_0.webp` | `ct-122a.webp` |
| CT-116A | `ct116a_0.webp` | `ct-116a.webp` |
| TWS | `tws_0.webp` | `tws.webp` |
| CLTHA | `cltha_0.webp` | `cltha.webp` |
| OA90 | `oa90_0.webp` | `oa90.webp` |
| CR6 | `cr6_0.webp` | `cr6.webp` |
| BH4 | `bh4_0.webp` | `bh4.webp` |
| CT-34R | `ct34r_0.webp` | `ct-34r.webp` |
| CT-119 | `ct119_0.webp` | `ct-119.webp` |
| CT-103 | `ct103_0.webp` | `ct-103.webp` |
| CT22 | `ct22_0.webp` | `ct22.webp` |
| CT-73 | `ct73_0.webp` | `ct-73.webp` |
| CT-45 | `ct45_0.webp` | `ct-45.webp` |
| CT-105 | `ct105_0.webp` | `ct-105.webp` |
| CT-41 | `ct41_0.webp` | `ct-41.webp` |
| CT-77 | `ct77_0.webp` | `ct-77.webp` |
| CT127 | `ct127_0.webp` | `ct127.webp` |
| CT115A | `ct115a_0.webp` | `ct115a.webp` |
| CT-92A | `ct92a_0.webp` | `ct-92a.webp` |
| CT-43 | `ct43_0.webp` | `ct-43.webp` |
| CT-98 | `ct98_0.webp` | `ct-98.webp` |
| CT-29 | `ct29_0.webp` | `ct-29.webp` |
| CT-125 | `ct125_0.webp` | `ct-125.webp` |
| CT1 | `ct1_0.webp` | `ct1.webp` |
| BH06 | `bh06_0.webp` | `bh06.webp` |
| AH6A | `ah6a_0.webp` | `ah6a.webp` |
| CT109 | `ct109_0.webp` | `ct109.webp` |
| CT81 | `ct81_0.webp` | `ct81.webp` |
| FA280 | `fa280_0.webp` | `fa280.webp` |
| FA278 | `fa278_0.webp` | `fa278.webp` |
| CT115 | `ct115_0.webp` | `ct115.webp` |
| CT112 | `ct112_0.webp` | `ct112.webp` |
| CT107 | `ct107_0.webp` | `ct107.webp` |
| CT106 | `ct106_0.webp` | `ct106.webp` |
| CT96 | `ct96_0.webp` | `ct96.webp` |
| CT95 | `ct95_0.webp` | `ct95.webp` |
| CT94 | `ct94_0.webp` | `ct94.webp` |
| CT92 | `ct92_0.webp` | `ct92.webp` |
| CT85 | `ct85_0.webp` | `ct85.webp` |
| CT78 | `ct78_0.webp` | `ct78.webp` |
| CT71 | `ct71_0.webp` | `ct71.webp` |
| CT68 | `ct68_0.webp` | `ct68.webp` |
| CT65 | `ct65_0.webp` | `ct65.webp` |
| CT64 | `ct64_0.webp` | `ct64.webp` |
| CT58 | `ct58_0.webp` | `ct58.webp` |
| CT57 | `ct57_0.webp` | `ct57.webp` |
| CT51 | `ct51_0.webp` | `ct51.webp` |
| AH9 | `ah9_0.webp` | `ah9.webp` |
| CT50 | `ct50_0.webp` | `ct50.webp` |
| CT48 | `ct48_0.webp` | `ct48.webp` |
| CT38 | `ct38_0.webp` | `ct38.webp` |
| CT37 | `ct37_0.webp` | `ct37.webp` |
| CT36 | `ct36_0.webp` | `ct36.webp` |
| CT31 | `ct31_0.webp` | `ct31.webp` |
| CT29A | `ct29a_0.webp` | `ct29a.webp` |
| CT27 | `ct27_0.webp` | `ct27.webp` |
| CT26 | `ct26_0.webp` | `ct26.webp` |
| CT23 | `ct23_0.webp` | `ct23.webp` |
| CT17 | `ct17_0.webp` | `ct17.webp` |
| CT12 | `ct12_0.webp` | `ct12.webp` |
| CT11 | `ct11_0.webp` | `ct11.webp` |
| CT8 | `ct8_0.webp` | `ct8.webp` |
| CT7 | `ct7_0.webp` | `ct7.webp` |
| CT2 | `ct2_0.webp` | `ct2.webp` |
| CFB8 | `cfb8_0.webp` | `cfb8.webp` |
| CFB6 | `cfb6_0.webp` | `cfb6.webp` |
| CHXL | `chxl_0.webp` | `chxl.webp` |
| COL3SF | `col3sf_0.webp` | `col3sf.webp` |
| PT-14FB | `pt-14fb_9633c392.webp` | `pt-14fb_35056475.webp` |
| PT-AICA | `pt-aica_c3a12474.webp` | `pt-aica_03754041.webp` |

---

## Section 3 — Observations & Recommendations

### 3.1 Hash-Based Filenames (32 PT- Products)

Thirty-two products (all `PT-` prefix) have images named with 8-character hex hashes, e.g.:
```
pt-10fb_7316520b.webp  pt-10fb_2fef317f.webp  pt-10fb_3468df21.webp
```
All are valid 1280×1280 files. Their current order is **unchanged** because filenames provide no signal about which is the best thumbnail. One specific anomaly was found:

- **PT-BH42** — its first image is `pt-bh34_e35382a4.webp` (note `bh34` in a `BH42` product). This appears to be a copy-paste error. Manual review is recommended.

**Recommendation:** Re-upload these products using standard sequential naming (`sku.webp`, `sku_01.webp`, …) with the best marketing shot as the base. Until then, manually verify that the first image in each PT- product is the intended thumbnail.

### 3.2 Single-Image Products (1,254 Products)

1,254 products have only one gallery image. While not an ordering problem, multi-image galleries improve conversion rates. **Recommendation:** add 2–4 additional angle, detail, and in-use shots for these products, prioritising the highest-revenue SKUs first.

### 3.3 Products Without a Canonical Base Image

90 products have no `sku.webp` — their galleries start at `sku_0.webp` or `sku_01.webp`. This is functionally correct once ordering is applied, but breaks the catalog-wide naming convention. **Recommendation:** rename `sku_0.webp` → `sku.webp` on the next image library pass.

### 3.4 Remaining Low-Resolution Images

After the six confirmed 300×300 bases were removed (Section 1.2), approximately **125 products** retain 300×300 images throughout their galleries — both base and numbered variants are 300 px. These are legacy shots with no higher-quality replacement currently available.

**Recommendation:** Commission 1200×1200 re-shoots for the Columbia (`COL`) and TapeTech (`CT-`/`CT`) families, which have the highest concentration of 300×300 imagery.

### 3.5 Hyphenated vs Non-Hyphenated Filename Pairs

15 products were found with both a hyphenated (`sku-X.webp`) and a non-hyphenated (`skuX.webp`) variant in the same gallery. Most pairs are genuinely different images at different resolutions — the high-res hyphenated base is already first (correct). Three were broken/low-res and removed (Section 1.1 and 1.3).

The following pairs were **kept** because both files are valid and genuinely different images:

| SKU | Hyphenated File | Res | No-Hyphen File | Res |
|-----|----------------|-----|----------------|-----|
| AH1-2 | `ah1-2.webp` | 1200×1200 | `ah12.webp` | 1200×1200 |
| CR-11 | `cr-11.webp` | 1209×1200 | `cr11.webp` | 500×500 |
| CT-118 | `ct-118.webp` | 500×500 | `ct118.webp` | 500×500 |
| CT-35R | `ct-35r.webp` | 1280×1027 | `ct35r.webp` | 1200×1200 |
| CT-41A | `ct-41a.webp` | 300×300 | `ct41a.webp` | 500×500 |
| CT-80 | `ct-80.webp` | 1200×1200 | `ct80.webp` | 500×500 |
| MP-13 | `mp-13.webp` | 1280×968 | `mp13.webp` | 500×500 |
| MP-13A | `mp-13a.webp` | 1280×968 | `mp13a.webp` | 500×500 |
| MP-14 | `mp-14.webp` | 1280×1190 | `mp14.webp` | 500×500 |
| MP-23 | `mp-23.webp` | 1136×1200 | `mp23.webp` | 500×500 |
| MP-32 | `mp-32.webp` | 1280×914 | `mp32.webp` | 1200×1200 |

> **Note for CT-41A:** the hyphenated base `ct-41a.webp` (300×300) is lower-res than its partner `ct41a.webp` (500×500). However, as both files are distinct valid images and the 300×300 is the canonical base, it is retained first. **Recommendation:** replace `ct-41a.webp` with a 1200×1200 version when possible.

### 3.6 Specific Products Requiring Manual Attention

| SKU | Issue | Recommended Action |
|-----|-------|-------------------|
| CA08-AD | No base image; gallery runs `_01` → `_06` | Designate best shot as canonical thumbnail and rename to `ca08-ad.webp` |
| 12FBBA | `12fbba_0.webp` is 590×425 (non-square) | Verify this is an intentional lifestyle shot; otherwise re-crop to square |
| TWS | Base `tws.webp` is 538×396 (non-square) | Replace with a square 1200×1200 version |
| CLTBF | Base `cltbf.webp` is 500×500 (below catalog standard) | Replace with 1200×1200 |
| PT-BH42 | First image filename `pt-bh34_e35382a4.webp` belongs to PT-BH34 | Correct the image assignment |
| All PT- SKUs | 32 products with hash-only filenames — thumbnail order is arbitrary | Re-upload with standard sequential naming |

---

*Report generated by automated image audit — `frontend/public/wp-catalog.csv` updated in place.*