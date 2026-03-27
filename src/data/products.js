// products.js
// Loads and parses the CSV from /public/products_catalog.csv

export async function loadProducts() {
  // load the unified products catalog (ALS schema)
  // Use BASE_URL to ensure correct path in both dev and production (GitHub Pages)
  const csvPath = `${process.env.PUBLIC_URL}products_catalog.csv`;
  const res = await fetch(csvPath);
  if (!res.ok) return [];
  const text = await res.text();
  const rows = parseCSV(text);
  // The loader supports both old app CSV and new ALS CSV headers.
  // ALS header (current): brand,name,description_full,sku,upc,price,price_numeric,description_short,image_1...image_9
  // Legacy app header: brand,product_name,part_number,url,image_url,short_description,category,specifications
  const products = rows.map((r, idx) => {
    // Normalize fields from either schema into the runtime product shape
  const sku = String(r.sku || r.part_number || '').trim();
  const upc = String(r.upc || '').trim();
  const name = String(r.name || r.product_name || '').trim();
  const brand = String(r.brand || '').trim();
  const url = String(r.url || '').trim();
  // prefer image_1 (ALS) then image_url (legacy)
  let image = (r.image_1 || r.image_url || '').trim();
  if (!image) image = '/product-placeholder.jpg';
  
  // Collect all images (image_1 through image_9)
  const images = [];
  for (let i = 1; i <= 9; i++) {
    const img = (r[`image_${i}`] || '').trim();
    if (img) images.push(img);
  }
  // Ensure at least one image (the primary one)
  if (images.length === 0) images.push(image);
  
  const short_description = String(r.description_short || r.short_description || '').trim();
  const description_full = String(r.description_full || '').trim();
  const descriptionText = short_description || description_full;
  const category = String(r.category || '').trim() || inferCategory(name, descriptionText);
    // specifications: if present (legacy), parse it; otherwise synthesize from description_full
    let specifications = null;
    if (r.specifications) {
      specifications = tryParseJSON(r.specifications) || null;
    } else if (r.description_full || sku || brand) {
      specifications = { PART: sku || '', MANUFACTURER: brand || '', full_description: r.description_full || '', spec_source: 'als' };
    }

    // normalize price to numeric where possible
    let priceVal = '';
    const rawPrice = r.price_numeric || r.price || '';
    if (rawPrice !== '') {
      const n = parseFloat(String(rawPrice).replace(/[^0-9.-]+/g, ''));
      if (!Number.isNaN(n)) priceVal = n;
    }

    return {
      id: sku || `p-${idx}`,
      part_number: sku || `p-${idx}`,
      sku: sku || '',
      upc: upc || '',
      // ensure name fallback so UI always has something to render
      name: name || sku || `Product ${idx}`,
      brand,
      url,
      image: image,
      images: images,
      short_description,
      description_full,
      category,
      specifications,
      price: priceVal,
      rating: r.rating ? Number(r.rating) : 0,
      reviews: r.reviews ? Number(r.reviews) : 0,
      _raw: r
    };
  });
  return products;
}

/**
 * Derive a category ID from a product's name and description.
 * Returns one of: 'taping' | 'finishing' | 'corner' | 'mudboxes' | 'sanding' | ''
 */
function inferCategory(name, description) {
  const text = (name + ' ' + (description || '')).toLowerCase();

  // Sanding tools
  if (/\bsand(er|ing)?\b/.test(text)) return 'sanding';

  // Mud Boxes & Pumps (check before taping to avoid "loading pump" matching taping)
  if (/loading pump|gooseneck|compound tube|mud tube|mud pan|box filler|filler adapt|hot mud pump|mud pump|pump repair/.test(text)) return 'mudboxes';

  // Automatic Taping
  if (/automatic taper|auto taper|\btaper\b|\btaping\b|taping tool|\bbanjo\b|predator taper|semi[ -]auto(matic)?|bazooka/.test(text)) return 'taping';

  // Corner Tools
  if (/corner roller|angle head|angle box|corner flush|\bflusher\b|corner applicat|corner finish|bead roller|corner cobra|inside corner|outside corner|inside 90|outside 90|\bl-trim\b|nail spot|nailspot|throttle[ -]?box/.test(text)) return 'corner';

  // Finishing Tools
  if (/flat box|finishing box|smoothing blade|flat finisher|finishing knife|putty knife|joint knife|box handle|tomahawk|sabre|wipe[ -]down/.test(text)) return 'finishing';

  return '';
}

function tryParseJSON(s) {
  if (!s) return null;
  try {
    return JSON.parse(s);
  } catch {
    return s;
  }
}

function parseCSV(text) {
  // robust CSV parser that supports quoted fields with newlines
  const rows = [];
  let i = 0;
  const N = text.length;
  let cur = '';
  let row = [];
  let inQuotes = false;
  while (i < N) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        // lookahead for escaped quote
        if (i + 1 < N && text[i + 1] === '"') {
          cur += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i++;
        continue;
      }
      // preserve any char inside quotes including newlines
      cur += ch;
      i++;
      continue;
    }
    // not in quotes
    if (ch === '"') {
      inQuotes = true;
      i++;
      continue;
    }
    if (ch === ',') {
      row.push(cur);
      cur = '';
      i++;
      continue;
    }
    if (ch === '\r') { i++; continue; }
    if (ch === '\n') {
      row.push(cur);
      rows.push(row);
      row = [];
      cur = '';
      i++;
      continue;
    }
    cur += ch;
    i++;
  }
  // last field
  if (cur !== '' || row.length > 0) {
    row.push(cur);
    rows.push(row);
  }

  if (rows.length === 0) return [];
  const header = rows[0].map(h => h.trim());
  const objs = [];
  for (let r = 1; r < rows.length; r++) {
    const rowArr = rows[r];
    // skip empty trailing rows
    if (rowArr.length === 1 && rowArr[0] === '') continue;
    const obj = {};
    for (let c = 0; c < header.length; c++) {
      obj[header[c]] = rowArr[c] !== undefined ? rowArr[c] : '';
    }
    objs.push(obj);
  }
  return objs;
}
