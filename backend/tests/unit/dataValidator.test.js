const { validateScrapedData } = require('../../src/scraper/dataValidator');

describe('Data Validator Unit Tests', () => {
  test('validates correct price and stock', () => {
    const res = validateScrapedData({ price: 12499, stock: 15, currency: 'INR' });
    expect(res.isValid).toBe(true);
    expect(res.data.price).toBe(12499);
    expect(res.data.stock).toBe(15);
    expect(res.data.currency).toBe('INR');
  });

  test('validates stock = 0 (out of stock)', () => {
    const res = validateScrapedData({ price: 499, stock: 0, currency: 'INR' });
    expect(res.isValid).toBe(true);
    expect(res.data.stock).toBe(0);
  });

  test('rejects missing or empty price', () => {
    expect(validateScrapedData({ price: null, stock: 5 }).isValid).toBe(false);
    expect(validateScrapedData({ price: undefined, stock: 5 }).isValid).toBe(false);
    expect(validateScrapedData({ price: '', stock: 5 }).isValid).toBe(false);
  });

  test('rejects zero or negative price', () => {
    expect(validateScrapedData({ price: 0, stock: 5 }).isValid).toBe(false);
    expect(validateScrapedData({ price: -100, stock: 5 }).isValid).toBe(false);
  });

  test('rejects NaN or non-finite price', () => {
    expect(validateScrapedData({ price: NaN, stock: 5 }).isValid).toBe(false);
    expect(validateScrapedData({ price: Infinity, stock: 5 }).isValid).toBe(false);
    expect(validateScrapedData({ price: 'abc', stock: 5 }).isValid).toBe(false);
  });

  test('rejects missing or empty stock', () => {
    expect(validateScrapedData({ price: 1000, stock: null }).isValid).toBe(false);
    expect(validateScrapedData({ price: 1000, stock: undefined }).isValid).toBe(false);
    expect(validateScrapedData({ price: 1000, stock: '' }).isValid).toBe(false);
  });

  test('rejects negative stock', () => {
    expect(validateScrapedData({ price: 1000, stock: -1 }).isValid).toBe(false);
  });

  test('rejects non-integer stock', () => {
    expect(validateScrapedData({ price: 1000, stock: 4.5 }).isValid).toBe(false);
  });

  test('rejects non-object input', () => {
    expect(validateScrapedData(null).isValid).toBe(false);
    expect(validateScrapedData('data').isValid).toBe(false);
  });
});

