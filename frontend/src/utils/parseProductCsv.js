/**
 * frontend/src/utils/parseProductCsv.js
 *
 * Parses a WooCommerce product-import CSV (the same file that lives on the
 * live server at:
 *   /wp-content/uploads/wc-imports/product-wp-catalog-c7p3my05pn.csv
 *
 * The CSV uses:
 *   • RFC-4180 quoting — fields containing commas/newlines are wrapped in ""
 *   • Pipe ( | ) as a multi-value separator for Images, Tags, Upsells, etc.
 *   • A "Categories" column whose leaf name maps to our internal category keys
 *   • An "Attribute 1 name / value" pair for the Brand
 *   • A "Meta: upc" column for UPC barcodes
 *
 * Output shape matches normalizeProduct() in src/services/api.js so every
 * downstream component gets the same object regardless of source.
 */

// ─── CSV tokenizer ────────────────────────────────────────────────────────────

/**
 * Split one CSV line into field strings, handling RFC-4180 quoting.
 * @param {string} line
 * @returns {string[]}
 */
function tokenizeLine(line) {
  const fields = [];
  let cur = '';
  let inQuote = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuote) {
      if (ch === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;               // skip escaped quote
      } else if (ch === '"') {
        inQuote = false;   // closing quote
      } else {
        cur += ch;
      }
    } else {
      if (ch === '"') {
        inQuote = true;
      } else if (ch === ',') {
        fields.push(cur);
        cur = '';
      } else {
        cur += ch;
      }
    }
  }
  fields.push(cur);
  return fields;
}

/**
 * Parse a complete CSV text (with header row) into an array of plain objects.
 * Multi-line quoted fields are re-joined before tokenising.
 *
 * @param {string} csvText  Full CSV text
 * @returns {Object[]}
 */
export function parseCsvText(csvText) {
  // Normalise line endings
  const text = csvText.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  // Re-assemble multi-line quoted fields into single logical lines
  const logicalLines = [];
  let buffer = '';
  let openQuotes = 0;

  for (const ch of text) {
    if (ch === '"') openQuotes++;
    if (ch === '\n' && openQuotes % 2 === 0) {
      logicalLines.push(buffer);
      buffer = '';
    } else {
      buffer += ch;
    }
  }
  if (buffer) logicalLines.push(buffer);

  if (logicalLines.length < 2) return [];

  const headers = tokenizeLine(logicalLines[0]);

  const rows = [];
  for (let i = 1; i < logicalLines.length; i++) {
    const line = logicalLines[i].trim();
    if (!line) continue;
    const values = tokenizeLine(line);
    const row = {};
    headers.forEach((h, idx) => {
      row[h.trim()] = (values[idx] || '').trim();
    });
    rows.push(row);
  }
  return rows;
}

// ─── Category mapping ─────────────────────────────────────────────────────────
// Maps WooCommerce category leaf names → our internal filter key strings
// Exported so api.js can reuse the same mapping for REST API products.

export const CATEGORY_MAP = {
  // Taping
  'automatic tapers':      'taping',
  'tool sets & bundles':   'taping',
  // Finishing
  'finishing boxes':       'finishing',
  'flat boxes':            'finishing',
  'handles & extensions':  'finishing',
  'blades & knives':       'finishing',
  'finishing trowels':     'finishing',
  'rollers & stands':      'finishing',
  'spotters':              'finishing',
  // Corner
  'corner & angle tools':  'corner',
  'corner tools':          'corner',
  'angle tools':           'corner',
  // Mud boxes / pumps
  'mud boxes & pumps':     'mudboxes',
  'mud pans & compound tubes': 'mudboxes',
  'loading pumps':         'mudboxes',
  'pumps & accessories':   'mudboxes',
  // Sanding
  'sanding tools':         'sanding',
  'sanders & poles':       'sanding',
  // Stilts
  'stilts':                'stilts',
  'stilt accessories':     'stilts',
  // Texture / spray
  'texture sprayers':      'texture',
  'applicators & rollers': 'texture',
  'spray tips & nozzles':  'texture',
  'hoses & fittings':      'texture',
  'cleaning accessories':  'texture',
  // Parts — all "repair / replacement" leaf categories
  'parts & accessories':   'parts',
  'repair kits & parts':   'parts',
  'pumps & parts':         'parts',
};

/**
 * Convert a WooCommerce category path string like
 *   "Drywall Finishing Tools > Asgard > Finishing Boxes"
 * into our internal category key (e.g. "finishing").
 * Exported so api.js can reuse this for REST API categories.
 */
export function mapCategory(categoriesCell) {
  if (!categoriesCell) return '';
  // Take the first category entry (before any pipe)
  const first = categoriesCell.split('|')[0].trim();
  // Leaf segment is after the last >
  const parts = first.split('>');
  const leaf  = parts[parts.length - 1].trim().toLowerCase();
  return CATEGORY_MAP[leaf] || leaf;
}

/**
 * Extract the brand name from a WooCommerce category path string such as
 *   "Drywall Finishing Tools > TapeTech > Parts & Accessories"
 * The brand is the second segment (index 1) between the ">" separators.
 * Returns an empty string when the path has fewer than two segments.
 *
 * @param {string} categoriesCell  Raw "Categories" CSV cell value
 * @returns {string}
 */
function extractBrandFromCategory(categoriesCell) {
  if (!categoriesCell) return '';
  const first   = categoriesCell.split('|')[0].trim();
  const segments = first.split('>');
  return segments.length >= 2 ? segments[1].trim() : '';
}

/**
 * Return true when the category leaf marks this product as a replacement
 * part / repair kit rather than a complete tool.
 * Exported so api.js can reuse this for REST API categories.
 *
 * @param {string} categoriesCell
 * @returns {boolean}
 */
export function isPartsRow(categoriesCell) {
  if (!categoriesCell) return false;
  const first = categoriesCell.split('|')[0].trim();
  const leaf  = first.split('>').pop().trim().toLowerCase();
  return leaf === 'parts & accessories' ||
         leaf === 'repair kits & parts' ||
         leaf === 'pumps & parts';
}

// ─── HTML → Markdown converter ───────────────────────────────────────────────

/**
 * Converts the WooCommerce product description HTML into clean Markdown.
 *
 * The CSV descriptions use a small, predictable tag set:
 *   <h2>          → ## heading
 *   <p>           → paragraph (with blank line after)
 *   <ul>/<li>     → - bullet list
 *   <strong>      → **bold**
 *   <br />        → line break within a paragraph
 *   <p>| … |</p>  → GFM pipe-table (already almost valid Markdown —
 *                   just needs the <br /> → newline and <p> stripped)
 *
 * Keeping descriptions as Markdown lets ReactMarkdown + remark-gfm handle
 * all rendering (headings, bold, lists, tables) via Tailwind's prose classes,
 * with no dangerouslySetInnerHTML.
 *
 * @param {string} html  Raw HTML description from the CSV
 * @returns {string}     Clean GitHub-Flavoured Markdown
 */
export function htmlToMarkdown(html) {
  if (!html) return '';

  let md = html;

  // ── 0. Normalise escaped newlines ─────────────────────────────────────────
  // WooCommerce CSV exports embed literal \n (backslash + n) escape sequences
  // inside HTML strings (e.g. between <br /> and the next table row).
  // Convert them to real newlines first so all subsequent regex work correctly.
  md = md.replace(/\\n/g, '\n');

  // ── 1. Headings ────────────────────────────────────────────────────────────
  md = md.replace(/<h1[^>]*>([\s\S]*?)<\/h1>/gi, (_, t) => `# ${t.trim()}\n\n`);
  md = md.replace(/<h2[^>]*>([\s\S]*?)<\/h2>/gi, (_, t) => `## ${t.trim()}\n\n`);
  md = md.replace(/<h3[^>]*>([\s\S]*?)<\/h3>/gi, (_, t) => `### ${t.trim()}\n\n`);

  // ── 2. Inline formatting ───────────────────────────────────────────────────
  md = md.replace(/<strong[^>]*>([\s\S]*?)<\/strong>/gi, (_, t) => `**${t.trim()}**`);
  md = md.replace(/<em[^>]*>([\s\S]*?)<\/em>/gi,         (_, t) => `*${t.trim()}*`);
  md = md.replace(/<code[^>]*>([\s\S]*?)<\/code>/gi,     (_, t) => `\`${t.trim()}\``);

  // ── 3. Line breaks inside paragraphs ──────────────────────────────────────
  // <br /> inside a pipe-table paragraph becomes a newline (handled below).
  // <br /> elsewhere becomes a hard line-break (two trailing spaces).
  md = md.replace(/<br\s*\/?>/gi, '\n');

  // ── 4. List items ─────────────────────────────────────────────────────────
  md = md.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, (_, t) => `- ${t.trim()}\n`);
  md = md.replace(/<\/?ul[^>]*>/gi, '\n');
  md = md.replace(/<\/?ol[^>]*>/gi, '\n');

  // ── 5. Paragraphs ─────────────────────────────────────────────────────────
  // A paragraph whose content looks like a pipe-table becomes a bare table
  // block (no surrounding blank-line paragraphs needed).
  md = md.replace(/<p[^>]*>([\s\S]*?)<\/p>/gi, (_, inner) => {
    let text = inner.trim();

    // WooCommerce CSV sometimes stores all table rows on a single line with
    // consecutive pipes as the only row separator, e.g.:
    //   | Specification | Detail | | :--- | :--- | | SKU | TACSET |
    // Only apply when the content is a single line (no existing newlines) AND
    // contains a GFM alignment cell (| :--- |), so we don't accidentally split
    // multi-line tables or paragraphs that happen to contain pipe characters.
    if (
      text.startsWith('|') &&
      text.endsWith('|') &&
      !text.includes('\n') &&
      /\|\s*:?-+:?\s*\|/.test(text)
    ) {
      // At a row boundary the last cell ends with `|` and the next row starts
      // with `|`, giving `| |` (two pipes separated only by whitespace).
      // Within a row, adjacent pipes always have cell content between them.
      text = text.replace(/\|\s*\|/g, '|\n|');
    }

    // Detect pipe-table: every non-empty line starts with |
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
    const isPipeTable = lines.length >= 2 && lines.every(l => l.startsWith('|'));

    if (isPipeTable) {
      // The CSV already has an alignment row (| :--- | :--- |).
      // Just join the lines and add surrounding blank lines for GFM.
      return '\n\n' + lines.join('\n') + '\n\n';
    }

    return text + '\n\n';
  });

  // ── 6. Anchor tags ────────────────────────────────────────────────────────
  md = md.replace(/<a[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi,
    (_, href, text) => `[${text.trim()}](${href})`);

  // ── 7. Strip any remaining HTML tags ──────────────────────────────────────
  md = md.replace(/<[^>]+>/g, '');

  // ── 8. Decode common HTML entities ────────────────────────────────────────
  md = md
    .replace(/&amp;/g,  '&')
    .replace(/&lt;/g,   '<')
    .replace(/&gt;/g,   '>')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&nbsp;/g, ' ');

  // ── 9. Normalise whitespace ────────────────────────────────────────────────
  // Collapse 3+ consecutive blank lines down to 2.
  md = md.replace(/\n{3,}/g, '\n\n').trim();

  return md;
}

// ─── Normalizer ───────────────────────────────────────────────────────────────

/**
 * Convert one raw CSV row object into the internal product shape.
 *
 * @param {Object} row  Plain object produced by parseCsvText()
 * @param {number} idx  Row index (used as fallback ID)
 * @returns {Object}    Normalized product
 */
function normalizeRow(row, idx) {
  // Images: pipe-separated URLs. CSV columns may contain "Images" or "Images (comma separated)"
  const rawImages = row['Images'] || row['Images (comma separated)'] || '';
  const images = rawImages
    .split('|')
    .map(u => u.trim())
    .filter(Boolean);
  if (images.length === 0) images.push('/no-image-placeholder.webp');

  // Brand: prefer explicit "Attribute 1 name == Brand" value; fall back to
  // the second segment of the category path (e.g. "TapeTech" from
  // "Drywall Finishing Tools > TapeTech > Parts & Accessories").
  // This ensures every product carries its brand even when the CSV rows for
  // parts / repair kits omit the Brand attribute column entirely.
  const attrName  = (row['Attribute 1 name']     || '').trim();
  const attrValue = (row['Attribute 1 value(s)'] || '').trim();
  const attrBrand = attrName.toLowerCase() === 'brand' ? attrValue : '';
  const brand     = attrBrand || extractBrandFromCategory(row['Categories'] || '');

  // Price — prefer Sale price, then Regular price
  const salePrice    = parseFloat(row['Sale price'])    || 0;
  const regularPrice = parseFloat(row['Regular price']) || 0;
  const price = salePrice || regularPrice;

  // UPC lives in the last column: "Meta: upc"
  const upc = (row['Meta: upc'] || '').trim();

  // SKU is our canonical ID
  const sku = (row['SKU'] || '').trim();

  // Category + parts flag
  const categoriesCell = row['Categories'] || '';
  const category = mapCategory(categoriesCell);
  const is_parts = isPartsRow(categoriesCell);

  // Tags as array
  const tags = (row['Tags'] || '').split(',').map(t => t.trim()).filter(Boolean);

  return {
    // Identity — use SKU; fall back to row index so IDs are always defined
    id:          sku || `csv-${idx}`,
    part_number: sku || `csv-${idx}`,
    sku,
    upc,
    slug:        sku.toLowerCase().replace(/[^a-z0-9]+/g, '-'),

    // Display
    name:   (row['Name']  || sku || `Product ${idx}`).replace(/^"(.*)"$/, '$1'),
    brand,
    category,
    is_parts,
    categories: [{ name: categoriesCell.split('>').pop().trim() }],
    tags,

    // Media
    image:  images[0],
    images,

    // Pricing & inventory
    price,
    regular_price: regularPrice,
    sale_price:    salePrice || '',
    on_sale:       salePrice > 0 && salePrice < regularPrice,
    stock_status:  row['In stock?'] === '1' ? 'instock' : 'outofstock',
    manage_stock:  false,
    stock_quantity: row['Stock'] ? (parseInt(row['Stock'], 10) || null) : null,

    // Descriptions — convert HTML → Markdown for ReactMarkdown rendering
    short_description: (row['Short description'] || '').replace(/<[^>]+>/g, '').slice(0, 200),
    description_full:  htmlToMarkdown(row['Description'] || ''),

    // Attributes / meta preserved for schematic lookups
    attributes: brand ? [{ name: 'Brand', options: [brand] }] : [],
    meta_data:  upc   ? [{ key: 'upc', value: upc }]         : [],

    // Ratings — CSV does not carry ratings
    rating:  0,
    reviews: 0,

    // Mark source so components can show badge differences if desired
    _source: 'csv',
  };
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Parse raw CSV text into an array of normalized product objects.
 *
 * @param {string} csvText
 * @returns {Object[]}
 */
export function parseProductCsv(csvText) {
  const rows = parseCsvText(csvText);
  return rows
    .filter(r => r['SKU'] || r['Name']) // skip blank rows
    .map((r, i) => normalizeRow(r, i));
}
