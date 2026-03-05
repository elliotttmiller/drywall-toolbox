# Scraped Schematic Diagrams

This folder contains official schematic/parts diagrams scraped from each brand's
official website or authorized distributor, for all **ALLOWED_BRANDS**.

Scraper script: `scripts/scrape_schematics.py`
Summary JSON:   `scrape_summary.json`

---

## Results Summary

| Brand | Files | Source |
|-------|-------|--------|
| [TapeTech](./TapeTech/) | 122 PDFs | tapetech.com/schematics (official) |
| [Columbia Taping Tools](./Columbia_Taping_Tools/) | 15 PDFs | alstapingtools.com (authorized distributor) |
| [Asgard](./Asgard/) | 16 PDFs | tapetech.com/schematics (Asgard is a TapeTech sub-brand) |
| [SurPro](./SurPro/) | 7 PDFs | stilts.com (official SurPro website) |
| [Spray King](./Spray_King/) | 0 files | Domain parked – no public schematics found |
| [Graco](./Graco/) | 59 PDFs | graco.com product pages + alstapingtools.com (authorized distributor) |

**Total: 219 schematic/parts diagram files across 5 brands**

---

## Brand Details

### TapeTech (122 PDFs)
All official TapeTech tool schematics scraped from the [TapeTech Schematics page](https://www.tapetech.com/schematics).
Covers every TapeTech tool model including:
- Automatic tapers (03TT–98TT)
- Flat boxes (standard, EZ, MaxxBox, Power Assist)
- Angle boxes & heads
- Corner tools
- Bazooka / Continuous Flow System (CFS)
- Pumps and handles

### Columbia Taping Tools (15 PDFs)
Official Columbia Taping Tools schematics sourced from
[Al's Taping Tools](https://www.alstapingtools.com/order-parts/product-schematic-downloads/)
(an authorized Columbia distributor). Note: columbiatapers.com was not DNS-resolvable from
the scrape environment. Includes:
- Taper Body & Head schematics (2014 version)
- Predator Taper Body & Head schematics
- Semi-Automatic Taper schematic
- Angle Head (3") schematic
- Corner applicators (2-wheel, 4-wheel)
- Inside Corner Roller schematic
- Matrix series (Handle, Head, Lever, Pinchbox)
- Extension Housing schematic
- Full Columbia Tools Operations Manual (English)

### Asgard (16 PDFs)
Asgard is a TapeTech sub-brand. Schematics scraped from tapetech.com/schematics.
Covers all Asgard tool models:
- EZ flat boxes (EZ07, EZ10, EZ12, EZ15) — standard and H-handle versions
- EHC MaxxBox flat boxes (EHC07, EHC10, EHC12)
- PA Power Assist flat boxes (PA07H, PA10H, PA12H)
- PAHC Power Assist flat box combos (PAHC07, PAHC10, PAHC12)

### SurPro (7 PDFs)
Official SurPro parts diagrams and manuals from [stilts.com](https://stilts.com/pages/instruction-manuals-parts-diagrams)
(sur-pro.com redirects here). Includes:
- SurPro Stilts Catalog 2024
- S1 / S1X Stilts User Manual (single-sided)
- S2 / S2X Stilts User Manual (double-sided)
- S1 Parts Diagram (exploded-view schematic)
- S1X Parts Diagram
- S2 Parts Diagram
- S2X Parts Diagram

### Spray King (0 files)
**No public schematics available.** Research findings:
- spray-king.com domain is parked (returns a CDN redirect, no actual content)
- No Spray King schematics found on authorized distributors
- Products in catalog: Air to Electric Pressure Switch for Spray King
- Service documentation distributed exclusively through authorized dealers
- For schematics, contact authorized Spray King dealers

### Graco (59 PDFs)
Official Graco parts manuals and repair guides scraped from individual product pages on
graco.com (discovered via US sitemap) plus supplemental documents from
[Al's Taping Tools](https://www.alstapingtools.com/order-parts/product-schematic-downloads/).
Covers all drywall/texture-relevant Graco products:
- Mark V HD, Mark X HD, Mark XV XT drywall compound pumps
- TexSpray RTX 1400SI, 2000PI, 2500PI, 5000PI, 5000PX, 5500PX
- TexSpray HTX 2030, GTX 2000EX, T-MAX, FastFinish Pro
- DutyMax GH 230, 300, 675DI sprayers
- President 101
- GMAX II 3400/3900/5900/7900 (HD variants)
- PowerFill 3.5 drywall mud pump
- Classic RTX 1500 & RTX 2000 (from Al's Taping Tools)
- Mark V schematic (from Al's Taping Tools)

---

## Re-running the Scraper

To re-scrape and update the results:

```bash
pip install requests beautifulsoup4 lxml
python3 scripts/scrape_schematics.py
```

The script will skip files that already exist on disk. Delete brand folders to force
a full re-download.
