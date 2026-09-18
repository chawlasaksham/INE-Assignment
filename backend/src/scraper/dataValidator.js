/**
 * Data Validator
 * Ensures that prices and stock extracted from the scraper are valid and clean
 * before being committed to Supabase.
 */

function validateScrapedData(data) {
  if (!data || typeof data !== 'object') {
    return { isValid: false, error: 'Scraped data must be a non-null object' };
  }

  const { price, stock, currency } = data;

  // 1. Price validation
  if (price === null || price === undefined || price === '') {
    return { isValid: false, error: 'Price is missing or empty' };
  }

  const numericPrice = Number(price);
  if (isNaN(numericPrice) || !isFinite(numericPrice)) {
    return { isValid: false, error: `Price must be a valid finite number, received: ${price}` };
  }

  if (numericPrice <= 0) {
    return { isValid: false, error: `Price must be greater than 0, received: ${numericPrice}` };
  }

  // 2. Stock validation
  if (stock === null || stock === undefined || stock === '') {
    return { isValid: false, error: 'Stock is missing or empty' };
  }

  const numericStock = Number(stock);
  if (isNaN(numericStock) || !Number.isInteger(numericStock)) {
    return { isValid: false, error: `Stock must be an integer, received: ${stock}` };
  }

  if (numericStock < 0) {
    return { isValid: false, error: `Stock cannot be negative, received: ${numericStock}` };
  }

  // 3. Currency validation
  const validCurrency = typeof currency === 'string' && currency.trim() ? currency.trim() : 'INR';

  return {
    isValid: true,
    data: {
      price: Math.round(numericPrice * 100) / 100,
      stock: numericStock,
      currency: validCurrency
    }
  };
}

module.exports = {
  validateScrapedData
};

