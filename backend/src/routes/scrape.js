const express = require('express');
const router = express.Router();
const db = require('../db/database');
const { scrapeProduct, scrapeAllActiveProducts } = require('../scraper/scraperRunner');

/**
 * Middleware to verify CRON_SECRET in Authorization header.
 */
function verifyCronAuth(req, res, next) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    console.warn('[Scrape] CRON_SECRET is not configured in environment!');
    return res.status(500).json({ error: 'Server misconfiguration: CRON_SECRET not set' });
  }

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      error: 'Unauthorized: Missing or invalid Authorization header. Format: "Bearer <CRON_SECRET>"'
    });
  }

  const token = authHeader.split(' ')[1];
  if (token !== cronSecret) {
    return res.status(401).json({
      error: 'Unauthorized: Invalid CRON_SECRET'
    });
  }

  next();
}

/**
 * POST /api/scrape/trigger
 * Protected trigger endpoint for scheduled cron or manual admin runs.
 * If productId is passed in query/body, scrapes just that product.
 * Otherwise, scrapes all active tracked products.
 */
router.post('/trigger', verifyCronAuth, async (req, res, next) => {
  try {
    const productId = req.query.productId || req.body.productId;

    if (productId) {
      const product = await db.getTrackedProductByStoreId(productId);
      if (!product) {
        return res.status(404).json({ error: `Product with store ID ${productId} is not currently tracked` });
      }

      // Respond that job has been accepted
      res.json({
        message: `Scrape triggered for product ${productId}`,
        productId: Number(productId),
        status: 'queued'
      });

      // Run scrape in background
      setImmediate(async () => {
        try {
          await scrapeProduct(product);
        } catch (err) {
          console.error(`[Scrape Trigger] Error scraping product ${productId}:`, err.message);
        }
      });
      return;
    }

    // Batch scrape all active products
    res.json({
      message: 'Batch scrape triggered for all active tracked products',
      status: 'queued'
    });

    setImmediate(async () => {
      try {
        await scrapeAllActiveProducts();
      } catch (err) {
        console.error('[Scrape Trigger] Batch scrape error:', err.message);
      }
    });

  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/scrape/product/:id
 * Manual user trigger for a single product from the UI (unauthenticated or session-allowed).
 */
router.post('/product/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const product = await db.getTrackedProductById(id);
    if (!product) {
      return res.status(404).json({ error: 'Tracked product not found' });
    }

    // Run synchronous or immediate scrape
    const result = await scrapeProduct(product);
    res.json({
      message: `Scrape finished for ${product.name}`,
      result
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
