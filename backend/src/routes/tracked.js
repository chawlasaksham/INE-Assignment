const express = require('express');
const router = express.Router();
const db = require('../db/database');
const { scrapeProduct } = require('../scraper/scraperRunner');

router.get('/', async (req, res, next) => {
  try {
    const products = await db.getTrackedProducts();
    res.json(products);
  } catch (err) {
    next(err);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const { productId, name, brand, category, sku, url } = req.body;

    if (!productId || !name) {
      return res.status(400).json({ error: 'productId and name are required' });
    }

    const existing = await db.getTrackedProductByStoreId(productId);
    if (existing) {
      return res.status(409).json({
        error: 'Product is already being tracked',
        product: existing
      });
    }

    const createdProduct = await db.createTrackedProduct({
      productId,
      name,
      brand,
      category,
      sku,
      url: url || `https://demo.inelabteamdev.com/product/${productId}`
    });

    res.status(201).json({
      message: 'Product tracked successfully. Initial scrape started in background.',
      product: createdProduct
    });

    setImmediate(async () => {
      try {
        console.log(`[Tracked] Triggering background initial scrape for product ${productId}...`);
        await scrapeProduct(createdProduct);
      } catch (err) {
        console.error(`[Tracked] Background scrape error for product ${productId}:`, err.message);
      }
    });

  } catch (err) {
    next(err);
  }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    await db.deleteTrackedProduct(id);
    res.json({ success: true, message: 'Product untracked successfully' });
  } catch (err) {
    next(err);
  }
});

router.get('/:id/history', async (req, res, next) => {
  try {
    const { id } = req.params;
    const history = await db.getPriceHistory(id);
    res.json(history);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
