const express = require('express');
const router = express.Router();
const catalogService = require('../services/catalogService');

router.get('/search', async (req, res, next) => {
  try {
    const query = req.query.q || '';
    const results = await catalogService.searchProducts(query);
    res.json({
      query,
      count: results.length,
      items: results.slice(0, 50)
    });
  } catch (err) {
    next(err);
  }
});

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
