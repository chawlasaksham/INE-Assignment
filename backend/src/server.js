require('dotenv').config();
const express = require('express');
const cors = require('cors');

const productsRouter = require('./routes/products');
const trackedRouter = require('./routes/tracked');
const logsRouter = require('./routes/logs');
const scrapeRouter = require('./routes/scrape');

const app = express();
const PORT = process.env.PORT || 5001;

app.use(cors());
app.use(express.json());

app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    console.log(`[HTTP] ${req.method} ${req.originalUrl} ${res.statusCode} - ${Date.now() - start}ms`);
  });
  next();
});

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'price-tracker-backend',
    timestamp: new Date().toISOString()
  });
});

app.use('/api/products', productsRouter);
app.use('/api/tracked-products', trackedRouter);
app.use('/api/scrape-logs', logsRouter);
app.use('/api/scrape', scrapeRouter);

app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

app.use((err, req, res, next) => {
  console.error('[Error Handler]', err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error'
  });
});

if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(`\n🚀 Price Tracker Backend running on port ${PORT}`);
    console.log(`👉 Health check: http://localhost:${PORT}/health`);
    console.log(`👉 Mock store: ${process.env.MOCK_STORE_URL || 'https://demo.inelabteamdev.com'}\n`);
  });
}

module.exports = app;
