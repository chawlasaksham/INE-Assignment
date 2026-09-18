/**
 * End-to-End Local Flow Audit Script
 * Verifies the full user cycle:
 * Search -> Track -> DB Persist -> Scrape -> Price/Stock Extracted -> History Created -> Logs Created -> Manual Scrape -> Cron Trigger
 */

const path = require('path');
require(path.join(__dirname, '../backend/node_modules/dotenv')).config({ path: path.join(__dirname, '../backend/.env') });
const request = require(path.join(__dirname, '../backend/node_modules/supertest'));
const app = require('../backend/src/server');
const db = require('../backend/src/db/database');

async function runE2EAudit() {
  console.log('\n======================================================');
  console.log('       🚀 FULL END-TO-END PRODUCTION AUDIT FLOW');
  console.log('======================================================\n');

  // 1. Health Check
  console.log('Step 1: Checking Server Health...');
  let res = await request(app).get('/health');
  if (res.status !== 200 || res.body.status !== 'ok') {
    throw new Error(`Health check failed with status ${res.status}`);
  }
  console.log('  ✅ Server is healthy:', res.body);

  // 2. Product Search
  console.log('\nStep 2: Searching Mock Store for "Copperpot"...');
  res = await request(app).get('/api/products/search?q=Copperpot');
  if (res.status !== 200 || !res.body.items || res.body.items.length === 0) {
    throw new Error('Search failed or returned 0 items');
  }
  const target = res.body.items[0];
  console.log(`  ✅ Found ${res.body.count} items. Selected: [${target.id}] ${target.name} (SKU: ${target.sku})`);

  // Clean up if this product was already tracked in previous test
  const existing = await db.getTrackedProductByStoreId(target.id);
  if (existing) {
    await db.deleteTrackedProduct(existing.id);
  }

  // 3. Track Product (Immediate 201 response)
  console.log('\nStep 3: Tracking Product via POST /api/tracked-products...');
  res = await request(app)
    .post('/api/tracked-products')
    .send({
      productId: target.id,
      name: target.name,
      brand: target.brand,
      category: target.category,
      sku: target.sku,
      url: `https://demo.inelabteamdev.com/product/${target.id}`
    });

  if (res.status !== 201 || !res.body.product) {
    throw new Error(`Tracking failed with status ${res.status}: ${JSON.stringify(res.body)}`);
  }
  const trackedProduct = res.body.product;
  console.log('  ✅ Product tracked successfully (201 Created):', trackedProduct.id);

  // 4. Trigger Scrape for this product
  console.log('\nStep 4: Executing Scrape on Mock Store...');
  const scrapeStart = Date.now();
  res = await request(app).post(`/api/scrape/product/${trackedProduct.id}`);
  if (res.status !== 200 || !res.body.result) {
    throw new Error(`Scrape API failed: ${JSON.stringify(res.body)}`);
  }
  const scrapeResult = res.body.result;
  const scrapeDuration = ((Date.now() - scrapeStart) / 1000).toFixed(1);

  if (!scrapeResult.success) {
    throw new Error(`Scrape execution returned failure: ${scrapeResult.error}`);
  }
  console.log(`  ✅ Scrape Succeeded in ${scrapeDuration}s!`);
  console.log(`     💵 Extracted Price: ₹${scrapeResult.price}`);
  console.log(`     📦 Extracted Stock: ${scrapeResult.stock} units`);
  console.log(`     🔁 Attempt: ${scrapeResult.attempt}`);

  // 5. Verify Database Records (Tracked Product updated, Price History inserted)
  console.log('\nStep 5: Verifying Database Updates...');
  const updated = await db.getTrackedProductById(trackedProduct.id);
  console.log(`  ✅ Tracked Product Record: Price = ₹${updated.current_price}, Stock = ${updated.current_stock}, ScrapedAt = ${updated.last_scraped_at}`);
  if (!updated.current_price || updated.current_stock === null) {
    throw new Error('Database record was not updated with latest price and stock');
  }

  // 6. Verify Price History
  console.log('\nStep 6: Verifying History Retrieval via GET /api/tracked-products/:id/history...');
  res = await request(app).get(`/api/tracked-products/${trackedProduct.id}/history`);
  if (res.status !== 200 || !Array.isArray(res.body) || res.body.length === 0) {
    throw new Error('History API returned empty or invalid records');
  }
  console.log(`  ✅ Verified ${res.body.length} historical observation(s):`);
  res.body.forEach((h) => {
    console.log(`     - [${h.scraped_at}] ₹${h.price} | Stock: ${h.stock} ${h.currency}`);
  });

  // 7. Verify Scrape Logs
  console.log('\nStep 7: Verifying Scrape Audit Logs via GET /api/scrape-logs...');
  res = await request(app).get(`/api/scrape-logs?productId=${target.id}`);
  if (res.status !== 200 || !Array.isArray(res.body) || res.body.length === 0) {
    throw new Error('Logs API returned empty records');
  }
  console.log(`  ✅ Verified ${res.body.length} scrape log(s) for product ${target.id}:`);
  res.body.forEach((l) => {
    console.log(`     - Attempt ${l.attempt_number}: status = ${l.status} (${l.duration_ms}ms)`);
  });

  // 8. Verify Cron Authentication Security
  console.log('\nStep 8: Verifying Protected Cron Trigger Security...');
  // 8a. No auth header -> 401
  let unauthRes = await request(app).post('/api/scrape/trigger');
  if (unauthRes.status !== 401) {
    throw new Error(`Expected 401 for unauthenticated trigger, got ${unauthRes.status}`);
  }
  console.log('  ✅ Unauthenticated request correctly rejected with 401');

  // 8b. Bad token -> 401
  let badTokenRes = await request(app)
    .post('/api/scrape/trigger')
    .set('Authorization', 'Bearer wrong-secret-token');
  if (badTokenRes.status !== 401) {
    throw new Error(`Expected 401 for invalid token, got ${badTokenRes.status}`);
  }
  console.log('  ✅ Invalid token correctly rejected with 401');

  // 8c. Query parameter ?secret= -> 401 (prohibited per item 1)
  let querySecretRes = await request(app)
    .post(`/api/scrape/trigger?secret=${process.env.CRON_SECRET}`);
  if (querySecretRes.status !== 401) {
    throw new Error(`Expected 401 for ?secret query param, got ${querySecretRes.status}`);
  }
  console.log('  ✅ Query parameter ?secret correctly rejected with 401 (only Bearer header allowed)');

  // 8d. Valid Bearer token -> 200
  let validRes = await request(app)
    .post('/api/scrape/trigger')
    .set('Authorization', `Bearer ${process.env.CRON_SECRET}`);
  if (validRes.status !== 200 || validRes.body.status !== 'queued') {
    throw new Error(`Expected 200 for valid Bearer token, got ${validRes.status}`);
  }
  console.log('  ✅ Valid Bearer token accepted with 200 (job queued):', validRes.body);

  console.log('\n======================================================');
  console.log('  🎉 COMPLETE END-TO-END AUDIT COMPLETED WITH 0 ERRORS');
  console.log('======================================================\n');
  process.exit(0);
}

runE2EAudit().catch((err) => {
  console.error('\n❌ E2E Audit Failed:', err);
  process.exit(1);
});
