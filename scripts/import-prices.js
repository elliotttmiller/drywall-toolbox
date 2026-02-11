/* eslint-env node */
/* global process */
import fs from 'fs';
import path from 'path';
import { parse } from 'csv-parse';
const argv = process.argv.slice(2);
if (argv.length < 1) {
  console.error('Usage: node import-prices.js <prices.csv> [--input <catalog.csv>] [--output <out.csv>]');
  process.exit(2);
}

const PRICE_CSV = path.resolve(process.cwd(), argv[0]);
let INPUT_CATALOG = path.resolve(process.cwd(), 'public', 'products_catalog.csv');
let OUTPUT_CATALOG = path.resolve(process.cwd(), 'public', 'products_catalog.updated.csv');

for (let i = 1; i < argv.length; i++) {
  if (argv[i] === '--input' && argv[i+1]) { INPUT_CATALOG = path.resolve(process.cwd(), argv[i+1]); i++; }
  if (argv[i] === '--output' && argv[i+1]) { OUTPUT_CATALOG = path.resolve(process.cwd(), argv[i+1]); i++; }
}

if (!fs.existsSync(PRICE_CSV)) { console.error('Price CSV not found:', PRICE_CSV); process.exit(2); }
if (!fs.existsSync(INPUT_CATALOG)) { console.error('Catalog CSV not found:', INPUT_CATALOG); process.exit(2); }

const readCsv = (filePath) => new Promise((resolve, reject) => {
  const rows = [];
  fs.createReadStream(filePath)
    .pipe(parse({ columns: true, skip_empty_lines: true, relax_column_count: true }))
    .on('data', (r) => rows.push(r))
    .on('end', () => resolve(rows))
    .on('error', (err) => reject(err));
});

const escapeCsv = (value) => {
  if (value === undefined || value === null) return '';
  const s = String(value);
  if (s.includes('"')) return `"${s.replace(/"/g, '""')}"`;
  if (s.includes(',') || s.includes('\n')) return `"${s}"`;
  return s;
};

const findKeyIgnoreCase = (obj, want) => {
  const keys = Object.keys(obj || {});
  const found = keys.find(k => k.toLowerCase() === want.toLowerCase());
  return found;
};

const normalizePrice = (priceRaw) => {
  if (priceRaw === undefined || priceRaw === null) return { raw: '', num: NaN };
  let p = String(priceRaw).trim();
  if (/call\s*for\s*price/i.test(p) || /^call$/i.test(p) || /contact/i.test(p)) return { raw: '', num: NaN, isContact: true };
  const numeric = Number(p.replace(/[^0-9.-]+/g, ''));
  return { raw: p, num: numeric };
};

const run = async () => {
  const [catalogRows, priceRows] = await Promise.all([readCsv(INPUT_CATALOG), readCsv(PRICE_CSV)]);

  // Build lookup maps from catalog by SKU and UPC
  const bySku = new Map();
  const byUpc = new Map();
  for (const r of catalogRows) {
    const skuKey = findKeyIgnoreCase(r, 'sku');
    const upcKey = findKeyIgnoreCase(r, 'upc');
    const sku = skuKey ? String(r[skuKey]).trim().toLowerCase() : '';
    const upc = upcKey ? String(r[upcKey]).trim() : '';
    if (sku) bySku.set(sku, r);
    if (upc) byUpc.set(upc, r);
  }

  // Inspect price CSV columns to find price, sku, upc fields
  let priceField = null;
  let skuField = null;
  let upcField = null;
  if (priceRows.length > 0) {
    const sample = priceRows[0];
    for (const k of Object.keys(sample)) {
      const kl = k.toLowerCase();
      if (!priceField && (kl === 'price' || kl.includes('price') || kl.includes('retail') || kl.includes('amount'))) priceField = k;
      if (!skuField && (kl === 'sku' || kl === 'part' || kl.includes('part'))) skuField = k;
      if (!upcField && (kl === 'upc' || kl === 'barcode')) upcField = k;
    }
  }

  let matched = 0;
  for (const pr of priceRows) {
    const prSku = skuField && pr[skuField] ? String(pr[skuField]).trim().toLowerCase() : '';
    const prUpc = upcField && pr[upcField] ? String(pr[upcField]).trim() : '';
    const rawPrice = priceField ? pr[priceField] : (pr.price || pr.price_numeric || '');
    const norm = normalizePrice(rawPrice);

    let target = null;
    if (prSku && bySku.has(prSku)) target = bySku.get(prSku);
    else if (prUpc && byUpc.has(prUpc)) target = byUpc.get(prUpc);

    if (target) {
      // find catalog's price keys
      const priceKey = findKeyIgnoreCase(target, 'price') || 'price';
      const priceNumKey = findKeyIgnoreCase(target, 'price_numeric') || 'price_numeric';

      if (norm.isContact) {
        target[priceKey] = '';
        target[priceNumKey] = '';
      } else if (!isNaN(norm.num) && norm.num > 0) {
        target[priceKey] = `$${Number(norm.num).toFixed(2)}`;
        target[priceNumKey] = String(Number(norm.num));
      } else {
        // zero or empty -> leave for the later pass
      }
      matched++;
    }
  }

  // Finalize: for every catalog row, if no price or numeric 0, set to 'Contact for Price'
  for (const r of catalogRows) {
    const priceKey = findKeyIgnoreCase(r, 'price') || 'price';
    const priceNumKey = findKeyIgnoreCase(r, 'price_numeric') || 'price_numeric';
    const raw = r[priceKey] === undefined || r[priceKey] === null ? '' : String(r[priceKey]).trim();
    const numRaw = r[priceNumKey] === undefined || r[priceNumKey] === null ? '' : String(r[priceNumKey]).trim();
    const numeric = Number(numRaw.replace(/[^0-9.-]+/g, ''));
    if (raw === '' || raw === '0' || raw === '0.00' || (!isNaN(numeric) && numeric === 0)) {
      r[priceKey] = 'Contact for Price';
      r[priceNumKey] = '';
    }
  }

  // Write output CSV preserving header order from original catalog
  const headers = Object.keys(catalogRows[0] || {});
  const out = fs.createWriteStream(OUTPUT_CATALOG, { encoding: 'utf8' });
  out.write(headers.join(',') + '\n');
  for (const r of catalogRows) {
    const row = headers.map(h => escapeCsv(r[h]));
    out.write(row.join(',') + '\n');
  }
  out.end();

  console.log(`Catalog rows: ${catalogRows.length}`);
  console.log(`Price rows inspected: ${priceRows.length}`);
  console.log(`Matched price rows applied: ${matched}`);
  console.log(`Wrote updated catalog to: ${OUTPUT_CATALOG}`);
};

run().catch(err => { console.error(err); process.exit(1); });
