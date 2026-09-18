/**
 * Scraper Runner
 * Coordinates the full scraping lifecycle: browser management, retries with
 * exponential backoff, extraction, strict validation, and database updates.
 */

const { chromium } = require('playwright');
const db = require('../db/database');
const { interactAndRevealPrice } = require('./storeInteraction');
const { extractFromPage, sanitizePriceText, parseStockText } = require('./dataExtractor');
const { validateScrapedData } = require('./dataValidator');

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Scrapes a single product with retry and backoff logic.
 *
 * @param {Object} product - Tracked product record (must have id, product_id, url)
 * @param {Object} options - { headless: boolean, maxAttempts: number, slowMo: number }
 */
async function scrapeProduct(product, options = {}) {
  const headless = options.headless !== undefined ? options.headless : (process.env.HEADLESS !== 'false');
  const maxAttempts = options.maxAttempts || 3;
  const slowMo = options.slowMo || 0;
  const targetUrl = product.url || `https://demo.inelabteamdev.com/product/${product.product_id}`;

  console.log(`\n========================================`);
  console.log(`[Runner] Starting scrape for product ID ${product.product_id} (${product.name || 'Unnamed'})`);
  console.log(`[Runner] URL: ${targetUrl}`);
  console.log(`[Runner] Mode: ${headless ? 'Headless' : 'Headed'}`);
  console.log(`========================================`);

  let browser = null;
  let finalResult = null;

  try {
    browser = await chromium.launch({
      headless,
      slowMo,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--no-first-run'
      ]
    });

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const attemptStart = Date.now();
      let context = null;
      let page = null;

      try {
        console.log(`[Runner] Attempt ${attempt} of ${maxAttempts}...`);
        context = await browser.newContext({
          viewport: { width: 1280, height: 800 },
          userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
        });
        page = await context.newPage();

        // 1. Execute interaction to reveal price
        await interactAndRevealPrice(page, targetUrl, { timeout: 25000 });

        // 2. Extract price and stock from DOM
        const extraction = await extractFromPage(page);
        if (!extraction.success) {
          throw new Error(extraction.error || 'Extraction failed');
        }

        const price = sanitizePriceText(extraction.rawPriceText);
        const stock = parseStockText(extraction.rawStockText);

        // 3. Validate extracted values
        const validation = validateScrapedData({ price, stock, currency: 'INR' });
        if (!validation.isValid) {
          throw new Error(`Data validation failed: ${validation.error} (rawPrice: "${extraction.rawPriceText}", rawStock: "${extraction.rawStockText}")`);
        }

        const durationMs = Date.now() - attemptStart;
        const validData = validation.data;

        console.log(`[Runner] Attempt ${attempt} SUCCEEDED in ${durationMs}ms`);
        console.log(`[Runner] Extracted: Price = ₹${validData.price}, Stock = ${validData.stock}`);

        // 4. Log successful attempt to scrape_logs
        await db.addScrapeLog({
          trackedProductId: product.id || null,
          productId: product.product_id,
          attemptNumber: attempt,
          status: 'success',
          price: validData.price,
          stock: validData.stock,
          durationMs,
          errorMessage: null
        });

        // 5. Commit to price_history and update tracked_products
        if (product.id) {
          await db.addPriceHistory({
            trackedProductId: product.id,
            productId: product.product_id,
            price: validData.price,
            stock: validData.stock,
            currency: validData.currency
          });

          await db.updateTrackedProductLatestScrape(
            product.id,
            validData.price,
            validData.stock
          );
        }

        finalResult = {
          success: true,
          attempt,
          price: validData.price,
          stock: validData.stock,
          durationMs
        };
        break; // Break retry loop on success

      } catch (err) {
        const durationMs = Date.now() - attemptStart;
        const isFinalAttempt = attempt === maxAttempts;
        const status = isFinalAttempt ? 'failed' : 'retried';

        console.error(`[Runner] Attempt ${attempt} failed (${durationMs}ms): ${err.message}`);

        // Log every attempt honestly
        await db.addScrapeLog({
          trackedProductId: product.id || null,
          productId: product.product_id,
          attemptNumber: attempt,
          status,
          price: null,
          stock: null,
          durationMs,
          errorMessage: err.message
        });

        if (isFinalAttempt) {
          finalResult = {
            success: false,
            attempts: maxAttempts,
            error: err.message
          };
        } else {
          // Exponential backoff: 1s, 2s, 4s...
          const backoffMs = Math.pow(2, attempt - 1) * 1000;
          console.log(`[Runner] Waiting ${backoffMs}ms before retry...`);
          await sleep(backoffMs);
        }
      } finally {
        if (page) await page.close().catch(() => {});
        if (context) await context.close().catch(() => {});
      }
    }

  } catch (browserErr) {
    console.error(`[Runner] Browser startup/lifecycle error: ${browserErr.message}`);
    finalResult = {
      success: false,
      error: browserErr.message
    };
  } finally {
    if (browser) await browser.close().catch(() => {});
  }

  return finalResult;
}

/**
 * Scrapes all active tracked products sequentially to conserve memory.
 */
async function scrapeAllActiveProducts(options = {}) {
  const products = await db.getTrackedProducts();
  const activeProducts = products.filter((p) => p.is_active !== false);

  console.log(`[Runner] Starting batch scrape for ${activeProducts.length} active products`);
  const results = [];

  for (const product of activeProducts) {
    try {
      const res = await scrapeProduct(product, options);
      results.push({ productId: product.product_id, ...res });
    } catch (err) {
      results.push({ productId: product.product_id, success: false, error: err.message });
    }
  }

  return results;
}

module.exports = {
  scrapeProduct,
  scrapeAllActiveProducts
};

