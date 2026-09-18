#!/usr/bin/env node

/**
 * Headed Scraper Demonstration Script
 * Runs Playwright in headed mode with visible browser automation
 * for evaluation and screen recording (Assignment Requirement #7).
 */

require('dotenv').config();
const db = require('../src/db/database');
const { scrapeProduct } = require('../src/scraper/scraperRunner');

function parseArgs() {
  const args = process.argv.slice(2);
  let productId = null;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--productId' && args[i + 1]) {
      productId = Number(args[i + 1]);
      i++;
    } else if (/^\d+$/.test(args[i])) {
      productId = Number(args[i]);
    }
  }
  return { productId };
}

async function main() {
  console.log('\n========================================================');
  console.log('  🎥 INE PRODUCT PRICE TRACKER — HEADED RUN DEMONSTRATION');
  console.log('========================================================');
  console.log('Launching Playwright with visible Chromium browser...');
  console.log('SlowMo: 650ms (for clear visual observation during recording)');

  const { productId: requestedId } = parseArgs();
  let targetProduct = null;

  if (requestedId) {
    targetProduct = await db.getTrackedProductByStoreId(requestedId);
    if (!targetProduct) {
      targetProduct = {
        product_id: requestedId,
        name: `Product #${requestedId}`,
        url: `https://demo.inelabteamdev.com/product/${requestedId}`
      };
    }
  } else {
    // Pick the first tracked product or fallback to product 705 (Ironwood Kettle S)
    const trackedList = await db.getTrackedProducts();
    if (trackedList.length > 0) {
      targetProduct = trackedList[0];
    } else {
      targetProduct = {
        product_id: 705,
        name: 'Ironwood Kettle S',
        url: 'https://demo.inelabteamdev.com/product/705'
      };
    }
  }

  console.log(`\n🎯 Target Product: [${targetProduct.product_id}] ${targetProduct.name}`);
  console.log(`🌐 URL: ${targetProduct.url || `https://demo.inelabteamdev.com/product/${targetProduct.product_id}`}`);

  console.log('\n[Watch Browser Window] Starting visible interaction sequence:');
  console.log(' 1. Navigating to product page');
  console.log(' 2. Dismissing cookie overlay if present');
  console.log(' 3. Performing mouse hover and dwell over price block');
  console.log(' 4. Waiting for "Reveal price" button to become active');
  console.log(' 5. Clicking "Reveal price" (re-clicking if dropped)');
  console.log(' 6. Handling upstream slow/retry states');
  console.log(' 7. Extracting and validating real selling price and stock\n');

  const startTime = Date.now();
  const result = await scrapeProduct(targetProduct, {
    headless: false,
    slowMo: 650,
    maxAttempts: 3
  });

  const duration = ((Date.now() - startTime) / 1000).toFixed(1);

  console.log('\n========================================================');
  if (result.success) {
    console.log('  ✅ HEADED RUN COMPLETED SUCCESSFULLY');
    console.log(`  ⏱️  Total Run Time: ${duration}s`);
    console.log(`  💵 Extracted Price: ₹${result.price}`);
    console.log(`  📦 Extracted Stock: ${result.stock} units`);
    console.log(`  🔁 Succeeded on Attempt: ${result.attempt}`);
    console.log('========================================================\n');
    process.exit(0);
  } else {
    console.log('  ❌ HEADED RUN FAILED');
    console.log(`  ⏱️  Total Run Time: ${duration}s`);
    console.log(`  ⚠️  Error: ${result.error}`);
    console.log('========================================================\n');
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('\nFatal Error in Headed Scraper:', err);
  process.exit(1);
});

