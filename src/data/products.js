// products.js
// Loads and parses the CSV placed in /public/tswfast_all_products.csv

export async function loadProducts() {
  // Use relative path that works with Vite's base configuration
  const res = await fetch('/drywall-toolbox/tswfast_all_products.csv');
  if (!res.ok) return [];
  const text = await res.text();
  const rows = parseCSV(text);
  // CSV header: brand,product_name,part_number,url,image_url,short_description,category,specifications
  const products = rows.map((r, idx) => {
    // Generate a deterministic review count based on part number (0-50 range)
    const partHash = (r.part_number || '').split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const reviewCount = 10 + (partHash % 50);
    
    return {
      id: r.part_number || `p-${idx}`,
      part_number: r.part_number || `p-${idx}`,
      name: r.product_name || '',
      brand: r.brand || '',
      url: r.url || '',
      image: r.image_url || '/product-placeholder.jpg',
      short_description: r.short_description || '',
      category: r.category || '',
      specifications: tryParseJSON(r.specifications) || null,
      // Add default values for fields expected by the UI but not in CSV
      rating: 4.5, // Default rating when actual rating data not available
      reviews: reviewCount, // Deterministic review count based on part number
      price: null, // Price not available in CSV - will show "Call for Price"
      badge: null, // No badges by default
      _raw: r
    };
  });
  return products;
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
  const lines = text.split(/\r?\n/).filter(l => l.trim() !== '');
  if (lines.length === 0) return [];
  const header = splitCSVLine(lines[0]).map(h => h.trim());
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const parts = splitCSVLine(lines[i]);
    if (parts.length === 0) continue;
    const obj = {};
    for (let j = 0; j < header.length; j++) {
      obj[header[j]] = parts[j] !== undefined ? parts[j] : '';
    }
    rows.push(obj);
  }
  return rows;
}

function splitCSVLine(line) {
  const result = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      // handle double-quote escapes
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (ch === ',' && !inQuotes) {
      result.push(cur);
      cur = '';
      continue;
    }
    cur += ch;
  }
  result.push(cur);
  return result;
}
