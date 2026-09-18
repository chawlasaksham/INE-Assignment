const express = require('express');
const router = express.Router();
const catalogService = require('../services/catalogService');

/**
 * GET /api/products/search?q=...
 * Searches mock store catalog by partial or full name, brand, category, or SKU.
 */
router.get('/search', async (req, res, next) => {
  try {
    const query = req.query.q || '';
    const results = await catalogService.searchProducts(query);
    res.json({
      query,
      count: results.length,
      items: results.slice(0, 50) // Return up to 50 matching items
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/products/:id
 * Fetches product details from mock store.
 */
router.get('/:id', async (req, res, next) => {
  try {
    const product = await catalogService.getProductById(req.params.id);
    if (!product) {
      return res.status(404).json({ error: 'Product not found in mock store' });
    }
    res.json(product);
  } catch (err) {
    next(err);
  }
});

module.exports = router;

