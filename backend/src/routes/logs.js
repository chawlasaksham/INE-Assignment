const express = require('express');
const router = express.Router();
const db = require('../db/database');

/**
 * GET /api/scrape-logs
 * Retrieves scrape logs, optionally filtered by productId, trackedProductId, or status.
 */
router.get('/', async (req, res, next) => {
  try {
    const { productId, trackedProductId, status, limit } = req.query;
    const logs = await db.getScrapeLogs({
      productId: productId ? Number(productId) : null,
      trackedProductId: trackedProductId || null,
      status: status || null,
      limit: limit ? Math.min(Number(limit), 200) : 100
    });
    res.json(logs);
  } catch (err) {
    next(err);
  }
});

module.exports = router;

