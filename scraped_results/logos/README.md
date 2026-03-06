# Official Brand Logos

This folder contains official brand logos scraped from each brand's official
website (or an authoritative archived/distributor source) for all **ALLOWED_BRANDS**.

Scraper script: `scripts/scrape_logos.py`
Summary JSON:   `logos_summary.json`

---

## Results Summary

| Brand | Logo File | Dimensions | Format | Source |
|-------|-----------|------------|--------|--------|
| Asgard | `Asgard/asgard_logo.png` | 362×108 | PNG (RGBA) | asgardtools.com via Wayback Machine |
| Columbia Taping Tools | `Columbia_Taping_Tools/columbia_taping_tools_logo.jpeg` | 1200×1200 | JPEG | Al's Taping Tools CDN (authorized distributor) |
| Graco | `Graco/graco_logo.svg` | Vector | SVG | graco.com (official website) |
| Spray King | `Spray_King/spray_king_logo.gif` | 325×123 | GIF | sprayking.com via Wayback Machine |
| SurPro | `SurPro/surpro_logo.png` | 500×165 | PNG (RGB) | stilts.com (official Sur-Pro website) |
| TapeTech | `TapeTech/tapetech_logo.png` | 1296×387 | PNG (RGBA) | tapetech.com (official website) |

---

## Brand Details

### Asgard
- **Official site:** https://asgardtools.com  
- **Logo file:** `Asgard/asgard_logo.png`
- **Source:** Official `asgardtools.com` WordPress uploads (2024/11), accessed via
  Wayback Machine archive (August 2025 snapshot). The live site returns HTTP 403
  for automated scrapers; the Wayback archive provides authoritative access.
- **Logo:** Official header brand mark (with glow effect), `asgard_logo_header_wglow_v3.png`

---

### Columbia Taping Tools
- **Official site:** https://columbiatapers.com (currently unreachable / not DNS-resolvable)
- **Logo file:** `Columbia_Taping_Tools/columbia_taping_tools_logo.jpeg`
- **Source:** Al's Taping Tools BigCommerce CDN (`cdn11.bigcommerce.com`).
  Al's Taping Tools is an official authorized Columbia distributor and hosts the
  Columbia brand logo with Columbia's consent. File: `columbia-logo-large.jpeg`.

---

### Graco
- **Official site:** https://www.graco.com  
- **Logo file:** `Graco/graco_logo.svg`
- **Source:** `https://www.graco.com/img/graco_logo.svg` — official SVG logo served
  directly from the Graco website. Vector format ensures highest possible quality
  at any display size.

---

### Spray King
- **Official site:** https://sprayking.com (domain inactive; now redirects to unrelated site)
- **Logo file:** `Spray_King/spray_king_logo.gif`
- **Source:** Wayback Machine archive of the original `sprayking.com` website
  (March 2001 snapshot: `http://web.archive.org/web/20010302101458/`).
  This is the authentic official Spray King logo from when the brand maintained
  its own website. The domain is now parked/redirected.

---

### SurPro
- **Official site:** https://www.stilts.com (sur-pro.com redirects here)
- **Logo file:** `SurPro/surpro_logo.png`
- **Source:** `https://stilts.com/cdn/shop/files/SurPro_orange_block_logo_500x.png`
  — official SurPro orange block logo from the stilts.com Shopify store CDN.

---

### TapeTech
- **Official site:** https://www.tapetech.com  
- **Logo file:** `TapeTech/tapetech_logo.png`
- **Source:** `https://tapetech.com/wp-content/uploads/2024/05/TapeTech_logo_2c_2024.png`
  — official 2024 two-colour brand mark uploaded to tapetech.com WordPress media.

---

## Re-running the Scraper

```bash
pip install requests beautifulsoup4 lxml
python3 scripts/scrape_logos.py
```

Each brand's folder contains a `logo_manifest.json` with:
- `brand` — brand name
- `scraped_at` — UTC timestamp of when the logo was downloaded
- `downloaded` / `failed` — success/failure counts
- `source_urls` — exact URL(s) tried
- `files` — list of saved files with filename, source URL, and file size
