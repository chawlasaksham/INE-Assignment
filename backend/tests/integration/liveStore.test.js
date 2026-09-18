/**
 * Live Store Integration Test
 * Executes real Playwright scraping against https://demo.inelabteamdev.com/
 */

require('dotenv').config();
const { scrapeProduct } = require('../../src/scraper/scraperRunner');

describe('Live INE Store Integration Test', () => {
  // Give ample time for real web navigation, hover, and price reveal
  jest.setTimeout(45000);

  test('Scrapes real price and stock from INE Mock Store product 705', async () => {
    const testProduct = {
      product_id: 705,
      name: 'Ironwood Kettle S',
      url: 'https://demo.inelabteamdev.com/product/705'
    };

    const result = await scrapeProduct(testProduct, {
      headless: true,
      maxAttempts: 3
    });

    console.log('[Live Test Result]', result);

    expect(result.success).toBe(true);
    expect(result.price).toBeGreaterThan(0);
    expect(result.stock).toBeGreaterThanOrEqual(0);
    expect(typeof result.price).toBe('number');
    expect(typeof result.stock).toBe('number');
    expect(result.durationMs).toBeGreaterThan(0);
  });
});

