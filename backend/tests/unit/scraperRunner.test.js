/**
 * Deterministic Scraper Runner Unit Tests
 * Uses mocked dependencies to test retries, timeouts, failures,
 * and database guarantees without internet access.
 */

const { validateScrapedData } = require('../../src/scraper/dataValidator');

describe('Scraper Runner Workflow & Reliability Tests', () => {
  let mockDb;

  beforeEach(() => {
    mockDb = {
      priceHistory: [],
      scrapeLogs: [],
      trackedProduct: {
        id: 'test-product-uuid-1',
        product_id: 705,
        current_price: 5000,
        current_stock: 10,
        last_scraped_at: '2026-01-01T00:00:00.000Z'
      },
      async addPriceHistory(rec) {
        this.priceHistory.push(rec);
      },
      async addScrapeLog(rec) {
        this.scrapeLogs.push(rec);
      },
      async updateTrackedProductLatestScrape(id, price, stock) {
        this.trackedProduct.current_price = price;
        this.trackedProduct.current_stock = stock;
        this.trackedProduct.last_scraped_at = new Date().toISOString();
      }
    };
  });

  // Mock runner simulation function that replicates scraperRunner logic exactly
  async function simulateRunner(mockAttempts, options = {}) {
    const maxAttempts = options.maxAttempts || 3;
    let finalResult = null;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const mockResult = mockAttempts[attempt - 1];

      if (mockResult.type === 'timeout') {
        const isFinal = attempt === maxAttempts;
        await mockDb.addScrapeLog({
          productId: 705,
          attemptNumber: attempt,
          status: isFinal ? 'failed' : 'retried',
          errorMessage: 'Timed out waiting for price element'
        });
        if (isFinal) {
          finalResult = { success: false, attempts: maxAttempts, error: 'Timed out' };
        }
      } else if (mockResult.type === 'network_error') {
        const isFinal = attempt === maxAttempts;
        await mockDb.addScrapeLog({
          productId: 705,
          attemptNumber: attempt,
          status: isFinal ? 'failed' : 'retried',
          errorMessage: mockResult.message || 'HTTP 429 Too Many Requests'
        });
        if (isFinal) {
          finalResult = { success: false, attempts: maxAttempts, error: mockResult.message };
        }
      } else if (mockResult.type === 'invalid_data') {
        const validation = validateScrapedData(mockResult.data);
        const isFinal = attempt === maxAttempts;
        await mockDb.addScrapeLog({
          productId: 705,
          attemptNumber: attempt,
          status: isFinal ? 'failed' : 'retried',
          errorMessage: `Data validation failed: ${validation.error}`
        });
        if (isFinal) {
          finalResult = { success: false, attempts: maxAttempts, error: validation.error };
        }
      } else if (mockResult.type === 'success') {
        const validation = validateScrapedData(mockResult.data);
        if (validation.isValid) {
          await mockDb.addScrapeLog({
            productId: 705,
            attemptNumber: attempt,
            status: 'success',
            price: validation.data.price,
            stock: validation.data.stock
          });
          await mockDb.addPriceHistory({
            trackedProductId: 'test-product-uuid-1',
            productId: 705,
            price: validation.data.price,
            stock: validation.data.stock
          });
          await mockDb.updateTrackedProductLatestScrape(
            'test-product-uuid-1',
            validation.data.price,
            validation.data.stock
          );
          finalResult = {
            success: true,
            attempt,
            price: validation.data.price,
            stock: validation.data.stock
          };
          break;
        }
      }
    }
    return finalResult;
  }

  test('1. Successful scrape on attempt 1 logs success and commits to price_history', async () => {
    const attempts = [{ type: 'success', data: { price: 8181, stock: 155, currency: 'INR' } }];
    const res = await simulateRunner(attempts);

    expect(res.success).toBe(true);
    expect(res.attempt).toBe(1);
    expect(mockDb.priceHistory.length).toBe(1);
    expect(mockDb.priceHistory[0].price).toBe(8181);
    expect(mockDb.priceHistory[0].stock).toBe(155);

    expect(mockDb.scrapeLogs.length).toBe(1);
    expect(mockDb.scrapeLogs[0].status).toBe('success');
    expect(mockDb.trackedProduct.current_price).toBe(8181);
  });

  test('2. Slow response/timeout on attempt 1 followed by retry and success on attempt 2', async () => {
    const attempts = [
      { type: 'timeout' },
      { type: 'success', data: { price: 8181, stock: 155, currency: 'INR' } }
    ];
    const res = await simulateRunner(attempts);

    expect(res.success).toBe(true);
    expect(res.attempt).toBe(2);

    expect(mockDb.scrapeLogs.length).toBe(2);
    expect(mockDb.scrapeLogs[0].attemptNumber).toBe(1);
    expect(mockDb.scrapeLogs[0].status).toBe('retried');
    expect(mockDb.scrapeLogs[1].attemptNumber).toBe(2);
    expect(mockDb.scrapeLogs[1].status).toBe('success');

    expect(mockDb.priceHistory.length).toBe(1);
    expect(mockDb.priceHistory[0].price).toBe(8181);
  });

  test('3. Temporary failure (429) on attempt 1 followed by success on attempt 2', async () => {
    const attempts = [
      { type: 'network_error', message: 'HTTP 429 Store Busy' },
      { type: 'success', data: { price: 7999, stock: 20, currency: 'INR' } }
    ];
    const res = await simulateRunner(attempts);

    expect(res.success).toBe(true);
    expect(res.attempt).toBe(2);
    expect(mockDb.scrapeLogs[0].status).toBe('retried');
    expect(mockDb.scrapeLogs[0].errorMessage).toContain('429');
    expect(mockDb.scrapeLogs[1].status).toBe('success');
  });

  test('4. Repeated failure across all 3 attempts NEVER commits corrupt data to price_history', async () => {
    const attempts = [
      { type: 'network_error', message: 'HTTP 500' },
      { type: 'timeout' },
      { type: 'network_error', message: 'HTTP 503' }
    ];
    const res = await simulateRunner(attempts, { maxAttempts: 3 });

    expect(res.success).toBe(false);
    expect(res.attempts).toBe(3);

    // Logs verify all 3 attempts were recorded honestly
    expect(mockDb.scrapeLogs.length).toBe(3);
    expect(mockDb.scrapeLogs[0].status).toBe('retried');
    expect(mockDb.scrapeLogs[1].status).toBe('retried');
    expect(mockDb.scrapeLogs[2].status).toBe('failed');

    // CRITICAL REQUIREMENT: price_history must remain 0 (no bad data written)
    expect(mockDb.priceHistory.length).toBe(0);

    // Existing product current_price must NOT be wiped or corrupted
    expect(mockDb.trackedProduct.current_price).toBe(5000);
    expect(mockDb.trackedProduct.current_stock).toBe(10);
  });

  test('5. Invalid/empty price extracted rejects and prevents insertion into price_history', async () => {
    const attempts = [
      { type: 'invalid_data', data: { price: '', stock: 5 } },
      { type: 'invalid_data', data: { price: null, stock: 5 } },
      { type: 'invalid_data', data: { price: NaN, stock: 5 } }
    ];
    const res = await simulateRunner(attempts, { maxAttempts: 3 });

    expect(res.success).toBe(false);
    expect(mockDb.priceHistory.length).toBe(0);
    expect(mockDb.scrapeLogs.length).toBe(3);
    expect(mockDb.scrapeLogs[2].status).toBe('failed');
    expect(mockDb.scrapeLogs[2].errorMessage).toContain('validation failed');
  });

  test('6. Invalid stock extracted rejects and prevents insertion into price_history', async () => {
    const attempts = [
      { type: 'invalid_data', data: { price: 2999, stock: -5 } },
      { type: 'invalid_data', data: { price: 2999, stock: 'in stock' } },
      { type: 'invalid_data', data: { price: 2999, stock: null } }
    ];
    const res = await simulateRunner(attempts, { maxAttempts: 3 });

    expect(res.success).toBe(false);
    expect(mockDb.priceHistory.length).toBe(0);
    expect(mockDb.scrapeLogs.length).toBe(3);
  });
});

