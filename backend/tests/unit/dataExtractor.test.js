const { sanitizePriceText, parseStockText } = require('../../src/scraper/dataExtractor');

describe('Data Extractor Unit Tests', () => {
  describe('sanitizePriceText', () => {
    test('cleans standard Indian currency formatted price', () => {
      expect(sanitizePriceText('₹ 12,499')).toBe(12499);
      expect(sanitizePriceText('₹1,299')).toBe(1299);
      expect(sanitizePriceText('Rs. 8,450')).toBe(8450);
    });

    test('strips zero-width spaces (\\u200B) injected by split priceCarrier', () => {
      const splitText = '₹\u200B1\u200B2\u200B,\u200B4\u200B9\u200B9';
      expect(sanitizePriceText(splitText)).toBe(12499);
    });

    test('strips non-breaking spaces (\\u00A0) and whitespace', () => {
      const nbspText = 'Rs.\u00A015,999.00';
      expect(sanitizePriceText(nbspText)).toBe(15999);
    });

    test('normalizes full-width Unicode digits', () => {
      // １２３４ -> 1234
      const unicodeDigits = '₹１２４９９';
      expect(sanitizePriceText(unicodeDigits)).toBe(12499);
    });

    test('handles trailing markers like "/- (incl. of all taxes)"', () => {
      expect(sanitizePriceText('₹ 5,999/- (incl. of all taxes)')).toBe(5999);
      expect(sanitizePriceText('₹ 750/-')).toBe(750);
    });

    test('handles European format like 12.499,00', () => {
      expect(sanitizePriceText('₹ 12.499,00')).toBe(12499);
    });

    test('returns null for empty or invalid text', () => {
      expect(sanitizePriceText('')).toBeNull();
      expect(sanitizePriceText(null)).toBeNull();
      expect(sanitizePriceText(undefined)).toBeNull();
      expect(sanitizePriceText('Price hidden')).toBeNull();
      expect(sanitizePriceText('No digits here')).toBeNull();
    });
  });

  describe('parseStockText', () => {
    test('parses "In stock · 12 left"', () => {
      expect(parseStockText('In stock · 12 left')).toBe(12);
    });

    test('parses "Only 4 left"', () => {
      expect(parseStockText('Only 4 left')).toBe(4);
    });

    test('parses "15 in stock"', () => {
      expect(parseStockText('15 in stock')).toBe(15);
    });

    test('parses "Selling fast — 3 left"', () => {
      expect(parseStockText('Selling fast — 3 left')).toBe(3);
    });

    test('parses "Hurry, just 2 left"', () => {
      expect(parseStockText('Hurry, just 2 left')).toBe(2);
    });

    test('parses "Out of stock" as 0', () => {
      expect(parseStockText('Out of stock')).toBe(0);
      expect(parseStockText('out of stock')).toBe(0);
    });

    test('returns null for empty or non-numeric stock', () => {
      expect(parseStockText('')).toBeNull();
      expect(parseStockText(null)).toBeNull();
      expect(parseStockText('Checking availability...')).toBeNull();
    });
  });
});

