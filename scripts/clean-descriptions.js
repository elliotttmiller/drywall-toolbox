/* eslint-env node */
/* global process */

import fs from 'fs';
import path from 'path';
import { parse } from 'csv-parse';

/* eslint-env node */

const INPUT = path.resolve(process.cwd(), 'public', 'products_catalog.csv');
const OUTPUT = path.resolve(process.cwd(), 'public', 'products_catalog.cleaned.csv');

if (!fs.existsSync(INPUT)) {
  console.error('Input CSV not found:', INPUT);
  process.exit(2);
}

const parser = parse({ columns: true, skip_empty_lines: false, relax_column_count: true });
const input = fs.createReadStream(INPUT);

const rows = [];

function findKeyIgnoreCase(obj, want) {
  const keys = Object.keys(obj || {});
  return keys.find(k => k.toLowerCase() === want.toLowerCase());
}

function escapeCsv(value) {
  if (value === undefined || value === null) return '';
  const s = String(value);
  if (s.includes('"')) return `"${s.replace(/"/g, '""')}"`;
  if (s.includes(',') || s.includes('\n')) return `"${s}"`;
  return s;
}

function capitalizeFirstLetter(s) {
  if (!s) return s;
  const idx = s.search(/[A-Za-z]/);
  if (idx === -1) return s;
  return s.slice(0, idx) + s[idx].toUpperCase() + s.slice(idx+1);
}

const prefixRegex = /^\s*Product\s+Details\s+Resources\b[:\-–—\s]*/i;

input.pipe(parser)
  .on('data', (row) => rows.push(row))
  .on('end', () => {
    if (rows.length === 0) {
      console.log('No rows found in CSV.');
      return;
    }

    let cleaned = 0;
    const descKey = findKeyIgnoreCase(rows[0], 'description_full') || 'description_full';

    // Write header based on original columns order
    const headers = Object.keys(rows[0]);
    const out = fs.createWriteStream(OUTPUT, { encoding: 'utf8' });
    out.write(headers.join(',') + '\n');

    for (const r of rows) {
      const raw = r[descKey] === undefined || r[descKey] === null ? '' : String(r[descKey]);
      const trimmed = raw.replace(/^[\s\u00A0]+/, '');
      if (prefixRegex.test(trimmed)) {
        let newDesc = trimmed.replace(prefixRegex, '');
        newDesc = newDesc.replace(/^\s+/, '');
        newDesc = capitalizeFirstLetter(newDesc);
        r[descKey] = newDesc;
        cleaned++;
      } else {
        // also ensure first alphabetic char is uppercased for existing descriptions starting lowercase
        const maybe = capitalizeFirstLetter(trimmed);
        if (maybe !== trimmed) {
          r[descKey] = maybe;
        } else {
          r[descKey] = raw;
        }
      }

      const rowOut = headers.map(h => escapeCsv(r[h]));
      out.write(rowOut.join(',') + '\n');
    }

    out.end(() => {
      console.log(`Processed ${rows.length} rows. Cleaned ${cleaned} descriptions.`);
      console.log('Wrote cleaned CSV to:', OUTPUT);
    });
  })
  .on('error', (err) => {
    console.error('Error parsing CSV:', err);
    process.exit(1);
  });
