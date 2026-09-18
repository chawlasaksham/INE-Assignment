/**
 * Test Forced Scraper Failures & Retries
 * Forces 3 consecutive failures to verify:
 * - Attempt 1 = retried
 * - Attempt 2 = retried
 * - Attempt 3 = failed
 * - Every attempt is logged in scrape_logs
 * - NO record is created in price_history
 */

const path = require('path');
require(path.join(__dirname, '../backend/node_modules/dotenv')).config({ path: path.join(__dirname, '../backend/.env') });
const db = require('../backend/src/db/database');
const { scrapeProduct } = require('../backend/src/scraper/scraperRunner');

async function testForcedFailure() {
  console.log('\n======================================================');
  console.log('  🧪 TESTING SCRAPER RETRY & FAILURE BEHAVIOR');
  console.log('======================================================\n');

  const fakeStoreId = 9999999;

  // 1. Create a dummy tracked product targeting a non-existent product URL
  const existing = await db.getTrackedProductByStoreId(fakeStoreId);
  if (existing) {
    await db.deleteTrackedProduct(existing.id);
  }

  const dummyProduct = await db.createTrackedProduct({
    productId: fakeStoreId,
    name: 'Non-Existent Failure Test Product',
    brand: 'TestBrand',
    category: 'TestCategory',
    sku: 'TEST-9999999',
    url: `https://demo.inelabteamdev.com/product/${fakeStoreId}`
  });

  console.log(`Created test product with ID ${dummyProduct.id} pointing to non-existent store page.`);

  // 2. Clear any old logs for this ID just in case
  const initialHistory = await db.getPriceHistory(dummyProduct.id);
  console.log(`Initial price_history count: ${initialHistory.length}`);

  // 3. Run scrape with maxAttempts: 3
  console.log('Running scrapeProduct on invalid page (forcing 3 failures)...');
  const result = await scrapeProduct(dummyProduct, {
    headless: true,
    maxAttempts: 3
  });

  console.log('\nScraper returned result:', result);

  // Assertion 1: Scrape result must be false
  if (result.success !== false) {
    throw new Error(`Expected result.success to be false, got ${result.success}`);
  }
  if (result.attempts !== 3) {
    throw new Error(`Expected 3 attempts, got ${result.attempts}`);
  }
  console.log('  ✅ Scrape terminated with success: false after exactly 3 attempts');

  // Assertion 2: Verify scrape_logs has all 3 attempts with correct statuses
  const logs = await db.getScrapeLogs({ productId: fakeStoreId, limit: 10 });
  console.log(`\nRetrieved ${logs.length} scrape logs for product ${fakeStoreId}:`);
  logs.forEach((l) => {
    console.log(`  - Attempt ${l.attempt_number}: status = "${l.status}", error = "${l.error_message?.slice(0, 60)}..."`);
  });

  if (logs.length !== 3) {
    throw new Error(`Expected exactly 3 scrape logs, found ${logs.length}`);
  }

  // Logs are ordered descending by timestamp: attempt 3, attempt 2, attempt 1
  const attempt3Log = logs.find((l) => l.attempt_number === 3);
  const attempt2Log = logs.find((l) => l.attempt_number === 2);
  const attempt1Log = logs.find((l) => l.attempt_number === 1);

  if (!attempt1Log || attempt1Log.status !== 'retried') {
    throw new Error(`Expected attempt 1 to have status "retried", got "${attempt1Log?.status}"`);
  }
  console.log('  ✅ Attempt 1 status verified: "retried"');

  if (!attempt2Log || attempt2Log.status !== 'retried') {
    throw new Error(`Expected attempt 2 to have status "retried", got "${attempt2Log?.status}"`);
  }
  console.log('  ✅ Attempt 2 status verified: "retried"');

  if (!attempt3Log || attempt3Log.status !== 'failed') {
    throw new Error(`Expected attempt 3 to have status "failed", got "${attempt3Log?.status}"`);
  }
  console.log('  ✅ Attempt 3 status verified: "failed"');

  // Assertion 3: CRITICAL - NO incorrect record in price_history
  const finalHistory = await db.getPriceHistory(dummyProduct.id);
  console.log(`\nFinal price_history count for failed product: ${finalHistory.length}`);
  if (finalHistory.length !== 0) {
    throw new Error(`CRITICAL FAILURE: Corrupt history record was created! Found ${finalHistory.length} records.`);
  }
  console.log('  ✅ CRITICAL GUARANTEE VERIFIED: 0 records inserted into price_history on failure');

  // Assertion 4: Tracked product current_price and current_stock remain null / untouched
  const finalProduct = await db.getTrackedProductById(dummyProduct.id);
  if (finalProduct.current_price !== null || finalProduct.current_stock !== null) {
    throw new Error(`Tracked product current price/stock was corrupted: ${finalProduct.current_price}`);
  }
  console.log('  ✅ Tracked product current_price/stock remains null and uncontaminated');

  // Clean up test product
  await db.deleteTrackedProduct(dummyProduct.id);
  console.log('\n======================================================');
  console.log('  🎉 FORCED FAILURE & RETRY TEST PASSED WITH 100% SUCCESS');
  console.log('======================================================\n');
}

testForcedFailure().catch((err) => {
  console.error('\n❌ Forced Failure Test Failed:', err);
  process.exit(1);
});

