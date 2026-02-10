const fs = require('fs');
const path = require('path');

/**
 * Price Extraction Script for Preferred Sources
 * 
 * Searches and extracts product prices from preferred industry sources:
 * 1. Timothy's Toolbox (timothystoolbox.com)
 * 2. Drywall Tool Depot (drywalltooldepot.com)
 * 3. Better Innovative Tool (betterinnovativetool.com)
 * 4. Al's Taping Tools (alstapingtools.com)
 * 5. CSR Building (csrbuilding.com/en-us)
 * 
 * Excluded: tswfast.com
 */

const PREFERRED_SOURCES = [
  'timothystoolbox.com',
  'drywalltooldepot.com',
  'betterinnovativetool.com',
  'alstapingtools.com',
  'csrbuilding.com/en-us'
];

const EXCLUDED_SOURCES = ['tswfast.com'];

// Read CSV file
function readCSV(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  const headers = lines[0].split(',').map(h => h.trim());
  
  const products = [];
  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue;
    
    const values = parseCSVLine(lines[i]);
    const product = {};
    headers.forEach((header, index) => {
      product[header] = values[index] || '';
    });
    product._lineNumber = i + 1; // Store line number for updates
    products.push(product);
  }
  
  return { headers, products };
}

// Parse CSV line handling quoted values
function parseCSVLine(line) {
  const values = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      values.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  values.push(current.trim());
  
  return values;
}

// Write CSV file
function writeCSV(filePath, headers, products) {
  const lines = [headers.join(',')];
  
  for (const product of products) {
    const values = headers.map(header => {
      let value = product[header] || '';
      // Escape quotes and wrap in quotes if contains comma
      if (value.includes(',') || value.includes('"') || value.includes('\n')) {
        value = '"' + value.replace(/"/g, '""') + '"';
      }
      return value;
    });
    lines.push(values.join(','));
  }
  
  fs.writeFileSync(filePath, lines.join('\n') + '\n');
}

// Filter products that need pricing
function getProductsNeedingPrices(products) {
  return products.filter(p => {
    const price = p.price || '';
    const priceNumeric = p.price_numeric || '';
    return !price || price === '0' || price === '0.00' || 
           !priceNumeric || priceNumeric === '0' || priceNumeric === '0.00';
  });
}

// Generate search queries for a product
function generateSearchQueries(product) {
  const brand = product.brand || '';
  const name = product.name || '';
  const sku = product.sku || '';
  
  const queries = [];
  
  // Query with SKU if available
  if (sku) {
    queries.push(`${brand} ${sku}`);
    queries.push(`${name} ${sku}`);
  }
  
  // Query with brand and name
  if (brand && name) {
    queries.push(`${brand} ${name}`);
  }
  
  // Query with just name if it's descriptive enough
  if (name && name.length > 10) {
    queries.push(name);
  }
  
  return queries;
}

// Main extraction function
async function extractPrices(inputFile, outputFile, limit = 100) {
  console.log('Reading product catalog...');
  const { headers, products } = readCSV(inputFile);
  
  const needsPricing = getProductsNeedingPrices(products);
  console.log(`Found ${needsPricing.length} products needing prices`);
  console.log(`Will attempt to extract prices for ${Math.min(limit, needsPricing.length)} products\n`);
  
  // Track progress
  const results = {
    successful: [],
    failed: [],
    updated: 0
  };
  
  // Process products in batches
  const toProcess = needsPricing.slice(0, limit);
  
  for (let i = 0; i < toProcess.length; i++) {
    const product = toProcess[i];
    console.log(`\n[${i + 1}/${toProcess.length}] Processing: ${product.brand} - ${product.name} (${product.sku})`);
    
    const queries = generateSearchQueries(product);
    console.log(`  Search queries: ${queries.join(' | ')}`);
    
    // In a real implementation, this would make HTTP requests to search each source
    // For now, we'll output the search strategy
    console.log(`  Would search sources in order: ${PREFERRED_SOURCES.join(', ')}`);
    
    // Mark for manual follow-up
    results.failed.push({
      product,
      queries,
      reason: 'Manual search required - automated web scraping not implemented'
    });
  }
  
  console.log(`\n\nSummary:`);
  console.log(`  Products processed: ${toProcess.length}`);
  console.log(`  Successful: ${results.successful.length}`);
  console.log(`  Failed/Manual: ${results.failed.length}`);
  console.log(`  CSV updated: ${results.updated > 0 ? 'Yes' : 'No'}`);
  
  // Save updated CSV if any prices were found
  if (results.updated > 0) {
    const backupFile = inputFile.replace('.csv', `.${new Date().toISOString().replace(/:/g, '-')}.bak.csv`);
    fs.copyFileSync(inputFile, backupFile);
    console.log(`  Backup created: ${backupFile}`);
    
    writeCSV(outputFile, headers, products);
    console.log(`  Updated file: ${outputFile}`);
  }
  
  return results;
}

// CLI
if (require.main === module) {
  const inputFile = path.join(__dirname, '../public/products_catalog_zero_or_missing_price_minimal_production.csv');
  const outputFile = inputFile;
  const limit = parseInt(process.argv[2]) || 100;
  
  extractPrices(inputFile, outputFile, limit)
    .then(() => {
      console.log('\nPrice extraction process completed!');
      console.log('\nNote: This script generates the search strategy.');
      console.log('Actual web scraping requires using the web_search tool for each product.');
    })
    .catch(err => {
      console.error('Error:', err);
      process.exit(1);
    });
}

module.exports = { extractPrices, generateSearchQueries };
