/* eslint-env node */
/* global process */
import fs from 'fs';
import path from 'path';
import { parse } from 'csv-parse';

const INPUT = path.resolve(process.cwd(), 'public', 'products_catalog.csv');
const OUTPUT = path.resolve(process.cwd(), 'public', 'products_catalog_no_price_or_zero.csv');

if (!fs.existsSync(INPUT)) {
  console.error(`Input file not found: ${INPUT}`);
  process.exit(2);
}

const parser = parse({ columns: true, skip_empty_lines: true, relax_column_count: true, trim: true });
const input = fs.createReadStream(INPUT);
const outputStream = fs.createWriteStream(OUTPUT, { encoding: 'utf8' });

// write header
outputStream.write('brand,name,sku,upc,price\n');

let readCount = 0;
let exportedCount = 0;

const keysMatch = (objKeys, wanted) => objKeys.find(k => k.toLowerCase() === wanted.toLowerCase());

const escapeCsv = (value) => {
  if (value === undefined || value === null) return '';
  const s = String(value);
  if (s.includes('"')) return `"${s.replace(/"/g, '""')}"`;
  if (s.includes(',') || s.includes('\n')) return `"${s}"`;
  return s;
};

input.pipe(parser)
  .on('data', (row) => {
    readCount++;
    const objKeys = Object.keys(row || {});

    const brandKey = keysMatch(objKeys, 'brand') || keysMatch(objKeys, 'manufacturer') || keysMatch(objKeys, 'make');
    const nameKey = keysMatch(objKeys, 'name') || keysMatch(objKeys, 'product_name') || keysMatch(objKeys, 'title');
    const skuKey = keysMatch(objKeys, 'sku') || keysMatch(objKeys, 'part_number') || keysMatch(objKeys, 'part#') || keysMatch(objKeys, 'part number');
    const upcKey = keysMatch(objKeys, 'upc') || keysMatch(objKeys, 'barcode');
    const priceKey = keysMatch(objKeys, 'price') || keysMatch(objKeys, 'price_1') || keysMatch(objKeys, 'retail_price') || keysMatch(objKeys, 'sale_price');

    const brand = brandKey ? row[brandKey] : '';
    const name = nameKey ? row[nameKey] : '';
    const sku = skuKey ? row[skuKey] : '';
    const upc = upcKey ? row[upcKey] : '';
    let priceRaw = priceKey ? row[priceKey] : '';
    priceRaw = priceRaw === undefined || priceRaw === null ? '' : String(priceRaw).trim();

    // Treat explicit 'Call for Price' (and variants) as empty/no-price
    if (/call\s*for\s*price/i.test(priceRaw)) {
      priceRaw = '';
    }

    // normalize numeric value from price string (remove currency symbols and commas)
    const numeric = Number(priceRaw.replace(/[^0-9.-]+/g, ''));

    const isNoPrice = priceRaw === '' || (!isNaN(numeric) && numeric === 0) || (priceRaw === '0' || priceRaw === '0.00');

    if (isNoPrice) {
      outputStream.write([
        escapeCsv(brand),
        escapeCsv(name),
        escapeCsv(sku),
        escapeCsv(upc),
        escapeCsv(priceRaw)
      ].join(',') + '\n');
      exportedCount++;
    }
  })
  .on('end', () => {
    outputStream.end();
    console.log(`Processed ${readCount} rows. Exported ${exportedCount} rows to ${OUTPUT}`);
  })
  .on('error', (err) => {
    console.error('Error parsing CSV:', err);
    process.exit(1);
  });
