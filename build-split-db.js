const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');

const CSV_FILE = 'indian_food_nutrition.csv';
const PUBLIC_DIR = path.join(__dirname, 'public');
const PRODUCTS_DIR = path.join(PUBLIC_DIR, 'products');
const MORE_INFO_DIR = path.join(PUBLIC_DIR, 'more_info');

// Ensure output folders exist cleanly
[PRODUCTS_DIR, MORE_INFO_DIR].forEach(dir => {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

const productChunks = {};
const infoChunks = {};
let totalRecords = 0;

console.log('🔄 Parsing data including Nutri-Score grades...');

fs.createReadStream(CSV_FILE)
  .pipe(csv())
  .on('data', (row) => {
      const barcode = row.barcode ? row.barcode.trim() : '';
      if (!barcode || barcode.length < 3) return; // Skip invalid rows

      const chunkId = barcode.substring(0, 3);

      if (!productChunks[chunkId]) productChunks[chunkId] = {};
      if (!infoChunks[chunkId]) infoChunks[chunkId] = {};

      let rawCategory = row.category ? row.category.trim() : 'General Grocery';
      if (rawCategory.includes(',')) {
          rawCategory = rawCategory.split(',')[0].trim();
      }

      // Collection 1: Base Product Info (Stays lightweight)
      productChunks[chunkId][barcode] = {
          n: row.product_name ? row.product_name.trim() : 'Unknown Product',
          u: row.image_url ? row.image_url.trim() : '',
          c: rawCategory
      };

      // Collection 2: Detailed Info (Now contains "s" for Nutri-Score)
      infoChunks[chunkId][barcode] = {
          i: row.ingredients ? row.ingredients.trim() : 'No ingredients listed',
          s: row.score ? row.score.trim().toUpperCase() : 'UNKNOWN', // A, B, C, D, E or UNKNOWN
          nut: {
              cal: row.calories ? parseFloat(row.calories) : 0,
              fat: row.fat ? parseFloat(row.fat) : 0,
              carb: row.carbs ? parseFloat(row.carbs) : 0,
              prot: row.protein ? parseFloat(row.protein) : 0,
              sod: row.sodium ? parseFloat(row.sodium) : 0
          }
      };

      totalRecords++;
  })
  .on('end', () => {
      console.log('✍️ Exporting static JSON files to public architecture...');
      
      Object.keys(productChunks).forEach((chunkId) => {
          fs.writeFileSync(path.join(PRODUCTS_DIR, `${chunkId}.json`), JSON.stringify(productChunks[chunkId]));
      });

      Object.keys(infoChunks).forEach((chunkId) => {
          fs.writeFileSync(path.join(MORE_INFO_DIR, `${chunkId}.json`), JSON.stringify(infoChunks[chunkId]));
      });

      const manifest = {
          total_products: totalRecords,
          schema: "split-collections-v1.2-score",
          last_updated_at: Date.now()
      };
      fs.writeFileSync(path.join(PUBLIC_DIR, 'manifest.json'), JSON.stringify(manifest, null, 2));

      console.log(`✅ Success! Processed ${totalRecords} items with nutritional grades.`);
  });
