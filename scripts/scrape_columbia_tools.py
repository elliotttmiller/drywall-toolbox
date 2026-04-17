#!/usr/bin/env python3
"""
Columbia Tools Website Scraper
================================
Scrapes every product in every category from https://www.columbiatools.com/columbia-tools/

Extracts per product:
  - Product name
  - All SKU/MPN values  (multiple SKUs on one page → variable product with variants)
  - Full HTML description and features
  - Every gallery image (downloaded as high-quality WebP)

Output:
  - scraped_results/columbia_tools/wp-catalog.csv  — WooCommerce import format
      matching the column structure of frontend/server/wp-catalog.csv,
      with proper variable (parent + variation) rows for multi-SKU products
  - scraped_results/columbia_tools/products.json   — full data for debugging
  - scraped_results/columbia_tools/images/{category_slug}/  — WebP images
  - scraped_results/columbia_tools/by_category/{slug}/      — per-category CSVs
  - scraped_results/columbia_tools/SUMMARY.md

Usage:
    python scripts/scrape_columbia_tools.py
    python scripts/scrape_columbia_tools.py --output-dir custom_path
    python scripts/scrape_columbia_tools.py --no-images
    python scripts/scrape_columbia_tools.py --category compound-tubes
"""

import argparse
import csv
import html as html_module
import io
import json
import re
import sys
import time
import urllib.request
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional, Set
from collections import defaultdict
from urllib.parse import urljoin, urlparse

try:
    import cloudscraper
    CLOUDSCRAPER_AVAILABLE = True
except ImportError:
    CLOUDSCRAPER_AVAILABLE = False
    print("⚠  cloudscraper not installed — run: pip install cloudscraper")

try:
    from PIL import Image
    PILLOW_AVAILABLE = True
except ImportError:
    PILLOW_AVAILABLE = False
    print("⚠  Pillow not installed — run: pip install Pillow")


# ── ANSI helpers ──────────────────────────────────────────────────────────────

CYAN  = "\033[96m"; GREEN = "\033[92m"; YELLOW = "\033[93m"
RED   = "\033[91m"; GREY  = "\033[90m"; RESET  = "\033[0m"; BOLD = "\033[1m"

def step(m): print(f"\n{CYAN}{BOLD}▶  {m}{RESET}")
def ok(m):   print(f"   {GREEN}✔  {m}{RESET}")
def warn(m): print(f"   {YELLOW}⚠  {m}{RESET}")
def fail(m): print(f"   {RED}✘  {m}{RESET}")
def info(m): print(f"   {GREY}·  {m}{RESET}")


# ── WooCommerce CSV column order (matches wp-catalog.csv exactly) ─────────────

WC_FIELDS = [
    "Brands", "SKU", "MPN", "Name", "Type", "Description", "Short description",
    "Regular price", "Sale price", "Images", "Categories", "Tags",
    "Position", "Published", "Is featured?", "Visibility in catalog",
    "Date sale price starts", "Date sale price ends",
    "Tax status", "Tax class", "In stock?", "Stock", "Low stock amount",
    "Backorders allowed?", "Sold individually?",
    "Weight (lbs)", "Length (in)", "Width (in)", "Height (in)",
    "Allow customer reviews?", "Purchase note", "Shipping class",
    "Download limit", "Download expiry days",
    "Parent", "Grouped products", "Upsells", "Cross-sells",
    "External URL", "Button text",
    "Attribute 1 name", "Attribute 1 value(s)", "Attribute 1 visible", "Attribute 1 global",
    "meta:_dtb_seo_title", "meta:_dtb_seo_description",
]

BRAND = "Columbia Tools"


# ── HTML utility helpers ──────────────────────────────────────────────────────

def strip_tags(text: str) -> str:
    """Remove all HTML tags and decode entities."""
    text = re.sub(r'<[^>]+>', ' ', text)
    text = html_module.unescape(text)
    return ' '.join(text.split()).strip()


def extract_balanced_div(html: str, start_pos: int) -> str:
    """
    Starting at start_pos (which must be the '<' of a <div...> tag),
    return the complete HTML including the matching closing </div>.
    Falls back to the remainder of the string if nesting can't be resolved.
    """
    depth = 0
    i = start_pos
    length = len(html)
    while i < length:
        if html[i] == '<':
            # Closing tag?
            if html[i:i+2] == '</':
                tag_end = html.find('>', i)
                tag_name = html[i+2:tag_end].strip().lower().split()[0] if tag_end != -1 else ''
                if tag_name == 'div':
                    depth -= 1
                    if depth == 0:
                        return html[start_pos:tag_end + 1]
                i = tag_end + 1 if tag_end != -1 else i + 1
                continue
            # Self-closing?
            tag_end = html.find('>', i)
            if tag_end == -1:
                break
            tag_content = html[i+1:tag_end]
            if tag_content.endswith('/'):
                i = tag_end + 1
                continue
            tag_name = tag_content.strip().lower().split()[0] if tag_content.strip() else ''
            if tag_name == 'div':
                depth += 1
            i = tag_end + 1
        else:
            i += 1
    return html[start_pos:]


def find_marker_div(html: str, marker: str) -> str:
    """
    Find the first <div ...> that contains `marker` in its attributes,
    then return its complete balanced HTML block.
    Returns '' if not found.
    """
    pos = html.find(marker)
    if pos == -1:
        return ''
    # Walk backwards to find the start of this tag
    div_start = html.rfind('<div', 0, pos)
    if div_start == -1:
        return ''
    return extract_balanced_div(html, div_start)


# ── SKU helpers ───────────────────────────────────────────────────────────────

_SKU_RE = re.compile(r'\b([A-Z][A-Z0-9]{1,}(?:-[A-Z0-9]+)*)\b')

def derive_parent_sku(skus: List[str]) -> str:
    """
    Derive a synthetic parent SKU from a list of variant SKUs.
    Strategy: longest common alphabetic prefix, upper-cased.
    Falls back to first SKU if prefix is too short.
    """
    if not skus:
        return ''
    if len(skus) == 1:
        return skus[0]
    prefix = skus[0]
    for sku in skus[1:]:
        while not sku.startswith(prefix):
            prefix = prefix[:-1]
            if not prefix:
                break
    prefix = re.sub(r'[-_\d]+$', '', prefix).strip('-_').upper()
    return prefix if len(prefix) >= 2 else skus[0]


def _is_columbia_image_url(url: str) -> bool:
    """Return True only if the URL's host is exactly www.columbiatools.com or columbiatools.com."""
    try:
        host = urlparse(url).hostname or ''
        return host in ('www.columbiatools.com', 'columbiatools.com')
    except Exception:
        return False


def short_desc(html_desc: str, max_chars: int = 200) -> str:
    """Extract a plain-text short description from full HTML description."""
    text = strip_tags(html_desc)
    if len(text) <= max_chars:
        return text
    cut = text[:max_chars].rsplit(' ', 1)[0]
    return cut + '…'


def make_tags(name: str, category: str, skus: List[str]) -> str:
    """Generate a sensible comma-separated tags string."""
    parts = []
    parts.append(f"Columbia Tools")
    for sku in skus:
        parts.append(sku)
    # Add words from the product name
    words = re.sub(r'[^a-zA-Z0-9\s]', '', name).split()
    for w in words:
        if len(w) > 3:
            parts.append(w)
    parts.append(category)
    # Deduplicate preserving order
    seen: dict = {}
    for p in parts:
        p = p.strip()
        if p and p.lower() not in seen:
            seen[p.lower()] = p
    return ', '.join(seen.values())


def make_wc_category(category_name: str) -> str:
    return f"Drywall Finishing Tools > Columbia Tools > {category_name}"


def make_seo_title(name: str, sku: str) -> str:
    return f"{name} | {sku} | Columbia Tools"


def make_seo_desc(name: str, category: str) -> str:
    return f"Professional {name} by Columbia Tools. {category} drywall taping tool for contractors."


# ── Core scraper class ────────────────────────────────────────────────────────

class ColumbiaToolsScraper:
    """Full Columbia Tools website scraper → wp-catalog.csv output."""

    BASE_URL = "https://www.columbiatools.com/columbia-tools/"

    def __init__(
        self,
        output_dir: str = "scraped_results/columbia_tools",
        category_filter: Optional[str] = None,
        download_images: bool = True,
    ):
        self.output_dir = Path(output_dir)
        self.category_filter = category_filter
        self.download_images = download_images
        self.products: List[Dict[str, Any]] = []
        self.by_category: Dict[str, List[Dict[str, Any]]] = defaultdict(list)
        self.processed_urls: Set[str] = set()

        self.output_dir.mkdir(parents=True, exist_ok=True)
        self.images_base = self.output_dir / "images"
        self.images_base.mkdir(exist_ok=True)

        if not CLOUDSCRAPER_AVAILABLE:
            fail("cloudscraper not available — install with: pip install cloudscraper")
            sys.exit(1)
        self.session = cloudscraper.create_scraper()

    # ── HTTP ──────────────────────────────────────────────────────────────────

    def fetch(self, url: str, retries: int = 3) -> Optional[str]:
        for attempt in range(1, retries + 1):
            try:
                resp = self.session.get(
                    url,
                    headers={"User-Agent": (
                        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                        "AppleWebKit/537.36 (KHTML, like Gecko) "
                        "Chrome/120.0.0.0 Safari/537.36"
                    )},
                    timeout=30,
                )
                if resp.status_code == 404:
                    return None
                resp.raise_for_status()
                return resp.text
            except Exception as exc:
                if attempt < retries:
                    wait = 2 ** attempt
                    warn(f"Fetch attempt {attempt} failed ({exc}) — retry in {wait}s")
                    time.sleep(wait)
                else:
                    fail(f"Failed to fetch {url}: {exc}")
        return None

    # ── Category discovery ────────────────────────────────────────────────────

    def discover_categories(self, html: str) -> List[Dict[str, str]]:
        """
        Return list of {name, url, slug} from the main directory page.
        Only 1-level paths after /columbia-tools/ are categories.
        """
        categories: List[Dict[str, str]] = []
        seen: Set[str] = set()

        pattern = re.compile(
            r'href="(https?://www\.columbiatools\.com/columbia-tools/([a-z0-9\-]+)/?)"',
            re.IGNORECASE,
        )
        for m in pattern.finditer(html):
            url = m.group(1).rstrip('/') + '/'
            slug = m.group(2).lower()

            if slug in seen:
                continue
            if any(x in slug for x in ['dealer', 'contact', 'new-release', 'home', 'cart', 'account']):
                continue
            if self.category_filter and self.category_filter.lower() not in slug:
                continue

            seen.add(slug)
            categories.append({
                'name': slug.replace('-', ' ').title(),
                'url': url,
                'slug': slug,
            })

        return categories

    # ── Product link discovery ────────────────────────────────────────────────

    def product_links_from_category(self, html: str, cat_url: str) -> List[str]:
        """
        Return product-page URLs from a category listing page.
        Product pages have the pattern: /columbia-tools/{cat}/{product}/
        """
        links: List[str] = []
        seen: Set[str] = set()

        for raw in re.findall(r'href="([^"]+)"', html):
            if raw.startswith('/'):
                url = 'https://www.columbiatools.com' + raw
            elif raw.startswith('http'):
                url = raw
            else:
                url = urljoin(cat_url, raw)

            url = url.rstrip('/')
            parsed = urlparse(url)
            if url in seen or parsed.hostname not in ('www.columbiatools.com', 'columbiatools.com'):
                continue
            if any(x in url.lower() for x in [
                '/wp-admin', '/wp-content', '/wp-includes',
                '.pdf', '.zip', 'dealer', 'contact', 'cart', 'checkout', 'account',
            ]):
                continue

            if '/columbia-tools/' in url:
                after = url.split('/columbia-tools/', 1)[-1].strip('/')
                segs = [s for s in after.split('/') if s]
                if len(segs) == 2:          # category/product — this is a product page
                    seen.add(url)
                    links.append(url)

        return links

    # ── Product detail extraction ─────────────────────────────────────────────

    def extract_product(self, html: str, page_url: str) -> Optional[Dict[str, Any]]:
        """Parse a single product page and return a product dict."""

        # ── Product name ──────────────────────────────────────────────────────
        name_m = (
            re.search(r'<h2[^>]+class="product_title[^"]*"[^>]*>\s*([^<]+?)\s*</h2>', html)
            or re.search(r'<h1[^>]*class="[^"]*product_title[^"]*"[^>]*>\s*([^<]+?)\s*</h1>', html)
            or re.search(r'<h1[^>]*>\s*([^<]{3,}?)\s*</h1>', html)
        )
        if not name_m:
            return None
        product_name = html_module.unescape(name_m.group(1)).strip()

        # ── Category from breadcrumb ──────────────────────────────────────────
        cat_m = re.search(
            r'<a[^>]+href="https?://www\.columbiatools\.com/columbia-tools/([^/"]+)/?"[^>]*>([^<]+)</a>',
            html,
        )
        category_slug = cat_m.group(1).strip() if cat_m else ''
        category_name = html_module.unescape(cat_m.group(2)).strip() if cat_m else ''

        # ── Raw product content div ───────────────────────────────────────────
        # The block we want is inside data-widget_type="woocommerce-product-content.default"
        content_html = find_marker_div(html, 'woocommerce-product-content.default')
        if not content_html:
            # Fallback: look for <div class="product">
            pm = re.search(r'<div[^>]+class="product"[^>]*>', html)
            if pm:
                content_html = extract_balanced_div(html, pm.start())

        # ── SKU extraction ────────────────────────────────────────────────────
        # Priority 1: explicit WooCommerce SKU meta element
        sku_elem_m = re.search(
            r'<span[^>]+class="[^"]*sku[^"]*"[^>]*>\s*([A-Z0-9][A-Z0-9\-]*)\s*</span>',
            html,
            re.IGNORECASE,
        )
        page_sku = sku_elem_m.group(1).strip().upper() if sku_elem_m else ''

        # Priority 2: extract all SKU-like tokens from the first line of product content
        # Columbia Tools lists them as "(CLT24, CLT32, CLT42, CLT55)" near the top of content
        all_skus: List[str] = []
        if content_html:
            # Look for a parenthesised list of SKUs at the very start of the content
            paren_m = re.search(
                r'<p[^>]*>\s*\(([A-Z0-9][A-Z0-9,\s\-]*)\)\s*</p>',
                content_html,
                re.IGNORECASE,
            )
            if paren_m:
                candidates = [s.strip().upper() for s in paren_m.group(1).split(',')]
                all_skus = [s for s in candidates if re.match(r'^[A-Z][A-Z0-9\-]{1,}$', s)]

        # Also try to grab SKUs from product title itself e.g. "Cam Lock Tube (CLT24)"
        title_paren_m = re.search(r'\(([A-Z0-9][A-Z0-9,\s\-]*)\)', product_name)
        if title_paren_m:
            candidates = [s.strip().upper() for s in title_paren_m.group(1).split(',')]
            for c in candidates:
                if re.match(r'^[A-Z][A-Z0-9\-]{1,}$', c) and c not in all_skus:
                    all_skus.append(c)

        # If we only have the page_sku and no paren list, treat it as the sole SKU
        if not all_skus and page_sku:
            all_skus = [page_sku]

        if not all_skus:
            # Last resort: try to find a SKU from the URL slug
            slug_m = re.search(r'/columbia-tools/[^/]+/([^/]+)/?$', page_url)
            if slug_m:
                candidate = slug_m.group(1).upper().replace('-', '')
                if re.match(r'^[A-Z][A-Z0-9]{2,}$', candidate):
                    all_skus = [candidate]

        # ── Description / features ────────────────────────────────────────────
        desc_html = ''
        features: List[str] = []

        if content_html:
            # Remove the leading SKU paragraph if present
            cleaned = re.sub(
                r'^.*?<p[^>]*>\s*\([A-Z0-9][A-Z0-9,\s\-]*\)\s*</p>\s*',
                '',
                content_html,
                count=1,
                flags=re.DOTALL | re.IGNORECASE,
            )
            # Extract features list items
            feat_m = re.search(
                r'<h4[^>]*>\s*FEATURES:?\s*</h4>\s*<ul[^>]*>(.*?)</ul>',
                cleaned,
                re.DOTALL | re.IGNORECASE,
            )
            if feat_m:
                li_texts = re.findall(r'<li[^>]*>(.*?)</li>', feat_m.group(1), re.DOTALL)
                features = [strip_tags(t) for t in li_texts if strip_tags(t)]

            # Build full description HTML: paragraphs + features
            # Strip download buttons, warranty badges etc.
            cleaned = re.sub(r'<button[^>]*>.*?</button>', '', cleaned, flags=re.DOTALL)
            cleaned = re.sub(r'<h4[^>]*>\s*DOWNLOAD:?\s*</h4>.*?(?=<h4|$)', '', cleaned, flags=re.DOTALL | re.IGNORECASE)
            # Keep only the <p> and <ul>/<ol> blocks and headings
            desc_parts = re.findall(
                r'(<(?:p|ul|ol|h[2-5]|blockquote)[^>]*>.*?</(?:p|ul|ol|h[2-5]|blockquote)>)',
                cleaned,
                re.DOTALL | re.IGNORECASE,
            )
            desc_html = '\n'.join(desc_parts).strip()

        # If description is empty, build a minimal one
        if not desc_html and features:
            feat_html = '<ul>' + ''.join(f'<li>{f}</li>' for f in features) + '</ul>'
            desc_html = f'<p>{product_name} by Columbia Tools.</p>\n<h4>Features:</h4>\n{feat_html}'
        elif not desc_html:
            desc_html = f'<p>{product_name} by Columbia Tools.</p>'

        # ── Gallery images ────────────────────────────────────────────────────
        gallery_html = find_marker_div(html, 'woocommerce-product-gallery__wrapper')
        if not gallery_html:
            # Fallback: look for the gallery class directly
            gm = re.search(r'<div[^>]+class="[^"]*woocommerce-product-gallery__wrapper[^"]*"[^>]*>', html)
            if gm:
                gallery_html = extract_balanced_div(html, gm.start())

        image_urls: List[str] = []
        if gallery_html:
            # Primary: html5lightbox hrefs pointing to full-size images
            for m in re.finditer(
                r'<a[^>]+href="([^"]+\.(jpe?g|png|webp))"[^>]*class="[^"]*html5lightbox[^"]*"',
                gallery_html,
                re.IGNORECASE,
            ):
                url = m.group(1)
                if _is_columbia_image_url(url) and not any(
                    x in url.lower() for x in ['100x100', '150x150', '300x', '-crop', 'thumb']
                ):
                    if url not in image_urls:
                        image_urls.append(url)

            # Secondary: feat_image href
            if not image_urls:
                for m in re.finditer(r'<a[^>]+href="([^"]+\.(jpe?g|png|webp))"', gallery_html, re.IGNORECASE):
                    url = m.group(1)
                    if _is_columbia_image_url(url):
                        if url not in image_urls:
                            image_urls.append(url)

        # Tertiary fallback: any large product image
        if not image_urls:
            for m in re.finditer(r'<img[^>]+src="([^"]+/wp-content/uploads/[^"]+\.(jpe?g|png))"', html, re.IGNORECASE):
                url = m.group(1)
                if not any(x in url.lower() for x in ['100x100', '150x150', 'hqdefault', 'thumb']):
                    if url not in image_urls:
                        image_urls.append(url)

        return {
            'name': product_name,
            'all_skus': all_skus,          # all variant SKUs
            'category': category_name,
            'category_slug': category_slug,
            'description': desc_html,
            'features': features,
            'image_urls': image_urls,
            'local_images': [],            # filled after download
            'url': page_url,
        }

    # ── Image download + WebP conversion ─────────────────────────────────────

    def _download_raw(self, url: str, dest: Path) -> Optional[Path]:
        try:
            req = urllib.request.Request(
                url,
                headers={"User-Agent": "Mozilla/5.0 (compatible; ColumbiaToolsScraper/1.0)"},
            )
            with urllib.request.urlopen(req, timeout=20) as resp:
                ct = resp.headers.get('content-type', '').lower()
                if 'png' in ct or url.lower().endswith('.png'):
                    ext = '.png'
                elif 'webp' in ct or url.lower().endswith('.webp'):
                    ext = '.webp'
                elif 'gif' in ct or url.lower().endswith('.gif'):
                    ext = '.gif'
                else:
                    ext = '.jpg'
                out = dest.with_suffix(ext)
                out.write_bytes(resp.read())
                return out
        except Exception as exc:
            warn(f"Download failed ({url[-60:]}): {exc}")
            return None

    def _to_webp(self, src: Path, dest_stem: Path) -> Optional[Path]:
        if not PILLOW_AVAILABLE:
            return None
        try:
            out = dest_stem.with_suffix('.webp')
            img = Image.open(src)
            if img.mode == 'RGBA':
                bg = Image.new('RGB', img.size, (255, 255, 255))
                bg.paste(img, mask=img.split()[3])
                img = bg
            elif img.mode not in ('RGB',):
                img = img.convert('RGB')
            img.save(out, 'WEBP', quality=90, method=6)
            if out.exists() and src.suffix.lower() != '.webp':
                src.unlink(missing_ok=True)
            return out
        except Exception as exc:
            warn(f"WebP conversion failed: {exc}")
            return None

    def process_image(self, img_url: str, cat_slug: str, sku: str, idx: int) -> Optional[str]:
        """Download image, convert to WebP, return relative path from output_dir."""
        if not self.download_images:
            return None

        cat_dir = self.images_base / (cat_slug or 'uncategorised')
        cat_dir.mkdir(parents=True, exist_ok=True)

        safe_sku = re.sub(r'[^a-z0-9]', '_', sku.lower()) if sku else 'img'
        stem = cat_dir / f"tmp_{safe_sku}_{idx:02d}"
        raw = self._download_raw(img_url, stem)
        if not raw:
            return None

        final_stem = cat_dir / f"{safe_sku}_{idx:02d}"
        webp = self._to_webp(raw, final_stem)
        if webp:
            return str(webp.relative_to(self.output_dir))
        # Keep original if WebP failed
        kept = final_stem.with_suffix(raw.suffix)
        raw.rename(kept)
        return str(kept.relative_to(self.output_dir))

    # ── WooCommerce row builders ──────────────────────────────────────────────

    def _base_row(self) -> Dict[str, str]:
        return {f: '' for f in WC_FIELDS}

    def _common_fields(self, row: Dict[str, str], product: Dict[str, Any],
                       sku: str, name: str, images_str: str, pos: int) -> None:
        """Populate fields shared by simple, variable-parent, and variation rows."""
        cat_wc = make_wc_category(product['category'])
        all_skus = product['all_skus']
        row.update({
            'Brands': BRAND,
            'SKU': sku,
            'MPN': sku,
            'Name': name,
            'Images': images_str,
            'Categories': cat_wc,
            'Tags': make_tags(product['name'], product['category'], all_skus),
            'Position': str(pos),
            'Published': '1',
            'Is featured?': '0',
            'Visibility in catalog': 'visible',
            'Tax status': 'taxable',
            'Tax class': '',
            'In stock?': '1',
            'Stock': '',
            'Low stock amount': '',
            'Backorders allowed?': '0',
            'Sold individually?': '0',
            'Allow customer reviews?': '1',
            'Sold individually?': '0',
        })

    def build_simple_row(self, product: Dict[str, Any], pos: int) -> Dict[str, str]:
        sku = product['all_skus'][0] if product['all_skus'] else ''
        name = product['name']
        images_str = '|'.join(product['local_images'])
        row = self._base_row()
        self._common_fields(row, product, sku, name, images_str, pos)
        row['Type'] = 'simple'
        row['Description'] = product['description']
        row['Short description'] = short_desc(product['description'])
        row['Attribute 1 name'] = 'Brand'
        row['Attribute 1 value(s)'] = BRAND
        row['Attribute 1 visible'] = '1'
        row['Attribute 1 global'] = '1'
        row['meta:_dtb_seo_title'] = make_seo_title(name, sku)
        row['meta:_dtb_seo_description'] = make_seo_desc(name, product['category'])
        return row

    def build_variable_parent_row(
        self, product: Dict[str, Any], parent_sku: str, all_skus: List[str], pos: int
    ) -> Dict[str, str]:
        name = product['name']
        images_str = '|'.join(product['local_images'])
        row = self._base_row()
        self._common_fields(row, product, parent_sku, name, images_str, pos)
        row['Type'] = 'variable'
        row['Description'] = product['description']
        row['Short description'] = short_desc(product['description'])
        row['Attribute 1 name'] = 'SKU'
        row['Attribute 1 value(s)'] = '|'.join(all_skus)
        row['Attribute 1 visible'] = '1'
        row['Attribute 1 global'] = '1'
        row['meta:_dtb_seo_title'] = make_seo_title(name, parent_sku)
        row['meta:_dtb_seo_description'] = make_seo_desc(name, product['category'])
        return row

    def build_variation_row(
        self, product: Dict[str, Any], parent_sku: str, variant_sku: str, pos: int
    ) -> Dict[str, str]:
        name = f"{product['name']} – {variant_sku}"
        images_str = '|'.join(product['local_images'])
        row = self._base_row()
        self._common_fields(row, product, variant_sku, name, images_str, pos)
        row['Type'] = 'variation'
        row['Description'] = ''        # Inherited from parent
        row['Short description'] = ''
        row['Parent'] = parent_sku
        row['Attribute 1 name'] = 'SKU'
        row['Attribute 1 value(s)'] = variant_sku
        row['Attribute 1 visible'] = '1'
        row['Attribute 1 global'] = '1'
        row['meta:_dtb_seo_title'] = ''
        row['meta:_dtb_seo_description'] = ''
        return row

    def product_to_wc_rows(self, product: Dict[str, Any], pos: int) -> List[Dict[str, str]]:
        """
        Convert a product dict to one or more WooCommerce CSV rows.
        - 1 SKU  → simple product (1 row)
        - N SKUs → variable parent row + N variation rows
        """
        all_skus = product['all_skus']
        if not all_skus:
            all_skus = ['UNKNOWN']

        if len(all_skus) == 1:
            return [self.build_simple_row(product, pos)]

        parent_sku = derive_parent_sku(all_skus)
        rows = [self.build_variable_parent_row(product, parent_sku, all_skus, pos)]
        for i, sku in enumerate(all_skus, 1):
            rows.append(self.build_variation_row(product, parent_sku, sku, pos + i))
        return rows

    # ── Main scrape loop ──────────────────────────────────────────────────────

    def scrape(self):
        step("Columbia Tools full-catalog scrape")
        info(f"Output: {self.output_dir}")
        # (cat_slug, normalised_name) pairs we've already stored — prevents duplicate
        # category-overview pages from inflating the product list.
        self._seen_products: Set[tuple] = set()

        # Fetch main directory
        step("Fetching main category directory")
        html = self.fetch(self.BASE_URL)
        if not html:
            fail("Could not load main page — aborting")
            return

        categories = self.discover_categories(html)
        ok(f"Discovered {len(categories)} categories")
        for c in categories:
            info(f"  {c['slug']} → {c['url']}")

        position = 1

        for cat in categories:
            step(f"Category: {cat['name']} ({cat['slug']})")

            cat_html = self.fetch(cat['url'])
            if not cat_html:
                warn("Could not fetch category page — skipping")
                continue

            product_urls = self.product_links_from_category(cat_html, cat['url'])
            ok(f"  {len(product_urls)} products found")

            # Create category image directory
            cat_img_dir = self.images_base / cat['slug']
            cat_img_dir.mkdir(exist_ok=True)

            for idx, purl in enumerate(product_urls, 1):
                if purl in self.processed_urls:
                    info(f"  [{idx}/{len(product_urls)}] already processed — skip")
                    continue
                self.processed_urls.add(purl)

                info(f"  [{idx}/{len(product_urls)}] {purl.split('/')[-2] or purl[-40:]}")

                phtml = self.fetch(purl)
                if not phtml:
                    warn("  Could not fetch product page — skip")
                    continue

                product = self.extract_product(phtml, purl)
                if not product:
                    warn("  Could not parse product details — skip")
                    continue

                if not product['category']:
                    product['category'] = cat['name']
                    product['category_slug'] = cat['slug']

                # Deduplicate by (category_slug, normalised_name).
                # Exception: if an already-stored entry has NO SKUs but the new entry
                # DOES have SKUs, the new entry is richer — replace the old one.
                dedup_key = (product['category_slug'], product['name'].lower().strip())
                if dedup_key in self._seen_products:
                    if product['all_skus']:
                        # Replace the placeholder entry with this richer one.
                        idx_to_replace = next(
                            (i for i, p in enumerate(self.products)
                             if (p['category_slug'], p['name'].lower().strip()) == dedup_key
                             and not p['all_skus']),
                            None,
                        )
                        if idx_to_replace is not None:
                            info(f"    upgrading placeholder '{product['name']}' with SKU-bearing entry")
                            # Remove old entry from by_category too
                            old = self.products[idx_to_replace]
                            self.by_category[old['category_slug']] = [
                                p for p in self.by_category[old['category_slug']] if p is not old
                            ]
                            self.products.pop(idx_to_replace)
                            # Fall through to add the new entry
                        else:
                            info(f"    duplicate — skipping '{product['name']}'")
                            continue
                    else:
                        info(f"    duplicate — skipping '{product['name']}'")
                        continue
                self._seen_products.add(dedup_key)

                # Download images
                ref_sku = product['all_skus'][0] if product['all_skus'] else 'img'
                for img_idx, img_url in enumerate(product['image_urls'], 1):
                    local = self.process_image(img_url, product['category_slug'], ref_sku, img_idx)
                    if local:
                        product['local_images'].append(local)

                info(f"    name={product['name']!r}  skus={product['all_skus']}  imgs={len(product['local_images'])}")

                self.products.append(product)
                self.by_category[product['category_slug']].append(product)
                position += len(product['all_skus']) + 1  # Reserve slots for variations

                time.sleep(0.4)

            time.sleep(0.8)

        ok(f"Scraping done — {len(self.products)} products across {len(self.by_category)} categories")
        self.save_results()

    # ── Output ────────────────────────────────────────────────────────────────

    def save_results(self):
        step("Saving outputs")

        if not self.products:
            warn("No products to save — nothing written")
            return

        # ── 1. Master wp-catalog.csv ──────────────────────────────────────────
        catalog_path = self.output_dir / "wp-catalog.csv"
        pos = 1
        all_wc_rows: List[Dict[str, str]] = []
        for product in self.products:
            rows = self.product_to_wc_rows(product, pos)
            all_wc_rows.extend(rows)
            pos += len(rows) + 1

        with open(catalog_path, 'w', newline='', encoding='utf-8') as fh:
            writer = csv.DictWriter(fh, fieldnames=WC_FIELDS)
            writer.writeheader()
            writer.writerows(all_wc_rows)

        ok(f"wp-catalog.csv → {len(all_wc_rows)} rows ({catalog_path})")

        # ── 2. Full JSON dump ─────────────────────────────────────────────────
        json_path = self.output_dir / "products.json"
        with open(json_path, 'w', encoding='utf-8') as fh:
            json.dump(self.products, fh, indent=2, ensure_ascii=False)
        ok(f"products.json  → {len(self.products)} products ({json_path})")

        # ── 3. Per-category CSVs ──────────────────────────────────────────────
        step("Saving per-category CSVs")
        for slug, cat_products in self.by_category.items():
            cat_dir = self.output_dir / "by_category" / slug
            cat_dir.mkdir(parents=True, exist_ok=True)
            cat_rows: List[Dict[str, str]] = []
            for p in cat_products:
                cat_rows.extend(self.product_to_wc_rows(p, 1))
            cat_csv = cat_dir / "wp-catalog.csv"
            with open(cat_csv, 'w', newline='', encoding='utf-8') as fh:
                writer = csv.DictWriter(fh, fieldnames=WC_FIELDS)
                writer.writeheader()
                writer.writerows(cat_rows)
            ok(f"  {slug}: {len(cat_products)} products → {cat_csv.name}")

        # ── 4. SUMMARY.md ─────────────────────────────────────────────────────
        total_imgs = sum(len(p['local_images']) for p in self.products)
        variable_count = sum(1 for p in self.products if len(p['all_skus']) > 1)
        simple_count = len(self.products) - variable_count

        summary = self.output_dir / "SUMMARY.md"
        with open(summary, 'w', encoding='utf-8') as fh:
            fh.write("# Columbia Tools — Scrape Results\n\n")
            fh.write(f"**Scraped:** {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n\n")
            fh.write("## Statistics\n\n")
            fh.write(f"| Metric | Value |\n|:---|---:|\n")
            fh.write(f"| Total product pages | {len(self.products)} |\n")
            fh.write(f"| Simple products | {simple_count} |\n")
            fh.write(f"| Variable products (multi-SKU) | {variable_count} |\n")
            fh.write(f"| Total WC CSV rows | {len(all_wc_rows)} |\n")
            fh.write(f"| Total images downloaded | {total_imgs} |\n")
            fh.write(f"| Categories | {len(self.by_category)} |\n\n")
            fh.write("## Categories\n\n")
            fh.write("| Category | Slug | Products |\n|:---|:---|---:|\n")
            for slug, prods in sorted(self.by_category.items()):
                cat_name = prods[0]['category'] if prods else slug
                fh.write(f"| {cat_name} | `{slug}` | {len(prods)} |\n")
            fh.write("\n## Output Files\n\n")
            fh.write("| File | Description |\n|:---|:---|\n")
            fh.write("| `wp-catalog.csv` | Full WooCommerce import CSV (all categories) |\n")
            fh.write("| `products.json` | Raw scraped data with all fields |\n")
            fh.write("| `by_category/{slug}/wp-catalog.csv` | Per-category WC CSV |\n")
            fh.write("| `images/{slug}/{sku}_{nn}.webp` | Product gallery images (WebP) |\n\n")
            fh.write("## Variable Product Format\n\n")
            fh.write("Products with multiple SKUs (different sizes/lengths) are stored as:\n\n")
            fh.write("- **Variable parent row** — `Type=variable`, `SKU=<common-prefix>`, "
                     "`Attribute 1 name=SKU`, `Attribute 1 value(s)=SKU1|SKU2|...`\n")
            fh.write("- **Variation rows** — `Type=variation`, `SKU=<variant>`, "
                     "`Parent=<parent-sku>`, `Attribute 1 value(s)=<this-sku>`\n")

        ok(f"SUMMARY.md → {summary}")


# ── CLI entry-point ───────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(
        description="Scrape Columbia Tools catalog → wp-catalog.csv + WebP images"
    )
    parser.add_argument(
        "--output-dir", default="scraped_results/columbia_tools",
        help="Root output directory (default: scraped_results/columbia_tools)",
    )
    parser.add_argument(
        "--category", default=None,
        help="Limit to one category slug, e.g. compound-tubes",
    )
    parser.add_argument(
        "--no-images", action="store_true",
        help="Skip image download and WebP conversion",
    )
    args = parser.parse_args()

    scraper = ColumbiaToolsScraper(
        output_dir=args.output_dir,
        category_filter=args.category,
        download_images=not args.no_images,
    )
    scraper.scrape()


if __name__ == "__main__":
    main()
