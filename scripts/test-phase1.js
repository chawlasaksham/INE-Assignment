require('dotenv').config();
const catalogService = require('./src/services/catalogService');
const { scrapeProduct } = require('./src/scraper/scraperRunner');
const db = require('./src/db/database');

async function main() {
  console.log('=== PHASE 1 VERIFICATION START ===');

  // 1. Test Catalog Search
  console.log('\n--- 1. Testing Catalog Search ---');
  const searchResults = await catalogService.searchProducts('kettle');
  console.log(`Found ${searchResults.length} products matching "kettle":`);
  searchResults.slice(0, 3).forEach((p) => {
    console.log(` - [${p.id}] ${p.name} (${p.brand}) - SKU: ${p.sku}`);
  });

  if (searchResults.length === 0) {
    throw new Error('Catalog search returned 0 items');
  }

  const sample = searchResults[0];

  // 2. Test Tracking Creation in DB
  console.log('\n--- 2. Testing Tracked Product Creation ---');
  let tracked = await db.getTrackedProductByStoreId(sample.id);
  if (!tracked) {
    tracked = await db.createTrackedProduct({
      productId: sample.id,
      name: sample.name,
      brand: sample.brand,
      category: sample.category,
      sku: sample.sku,
      url: `https://demo.inelabteamdev.com/product/${sample.id}`
    });
    console.log('Created tracked product:', tracked.id, tracked.name);
  } else {
    console.log('Product already in DB:', tracked.id, tracked.name);
  }

  // 3. Test Real Scraper with Playwright
  console.log('\n--- 3. Testing Scraper on Product Page ---');
  const scrapeResult = await scrapeProduct(tracked, {
    headless: true,
    maxAttempts: 3
  });

  console.log('\n--- 4. Verification Results ---');
  console.log('Scrape Result:', JSON.stringify(scrapeResult, null, 2));

  if (!scrapeResult.success) {
    throw new Error(`Scraper failed: ${scrapeResult.error}`);
  }

  // 5. Verify Database Records
  const updatedProduct = await db.getTrackedProductById(tracked.id);
  console.log(`Updated Product: Current Price = ₹${updatedProduct.current_price}, Current Stock = ${updatedProduct.current_stock}, Last Scraped = ${updatedProduct.last_scraped_at}`);

  const history = await db.getPriceHistory(tracked.id);
  console.log(`History count: ${history.length}, latest: ₹${history[0]?.price}, stock: ${history[0]?.stock}`);

  const logs = await db.getScrapeLogs({ trackedProductId: tracked.id });
  console.log(`Scrape logs count: ${logs.length}, latest status: ${logs[0]?.status}, duration: ${logs[0]?.duration_ms}ms`);

  console.log('\n=== PHASE 1 VERIFICATION COMPLETED SUCCESSFULLY ===');
}

main().catch((err) => {
  console.error('\n❌ Verification failed:', err);
  process.exit(1);
});
