function validateScrapedData(data) {
  if (!data || typeof data !== 'object') {
    return { isValid: false, error: 'Scraped data must be a non-null object' };
  }

  const { price, stock, currency } = data;

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
