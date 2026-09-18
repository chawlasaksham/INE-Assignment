/**
 * Catalog Service
 * Uses lightweight HTTP fetching to browse and search products from the INE mock store.
 */

const MOCK_STORE_URL = process.env.MOCK_STORE_URL || 'https://demo.inelabteamdev.com';

let cachedCatalog = null;
let lastFetchedAt = 0;
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

/**
 * Fetches all products across catalog pages using lightweight HTTP.
 */
async function fetchFullCatalog() {
  const now = Date.now();
  if (cachedCatalog && now - lastFetchedAt < CACHE_TTL_MS) {
    return cachedCatalog;
  }

  console.log('[CatalogService] Fetching fresh catalog from mock store...');
  const allItems = [];
  let page = 1;
  const pageSize = 60;
  let totalPages = 1;

  try {
    while (page <= totalPages) {
      const url = `${MOCK_STORE_URL}/api/catalog?page=${page}&pageSize=${pageSize}`;
      const res = await fetch(url);
      if (!res.ok) {
        throw new Error(`Catalog API responded with HTTP ${res.status}`);
      }
      const data = await res.json();
      if (data.items && Array.isArray(data.items)) {
        allItems.push(...data.items);
      }
      totalPages = data.pages || 1;
      page++;
      // Guard against infinite loop
      if (page > 50) break;
    }

    cachedCatalog = allItems;
    lastFetchedAt = Date.now();
    console.log(`[CatalogService] Successfully loaded ${allItems.length} products into cache`);
    return allItems;
  } catch (err) {
    console.error('[CatalogService] Failed to fetch full catalog:', err.message);
    if (cachedCatalog) return cachedCatalog;
    throw err;
  }
}

/**
 * Searches products by partial or full query matching name, brand, category, or SKU.
 */
async function searchProducts(query) {
  const catalog = await fetchFullCatalog();
  if (!query || typeof query !== 'string' || !query.trim()) {
    return catalog.slice(0, 30);
  }

  const q = query.trim().toLowerCase();
  return catalog.filter((item) => {
    const nameMatch = item.name && item.name.toLowerCase().includes(q);
    const brandMatch = item.brand && item.brand.toLowerCase().includes(q);
    const categoryMatch = item.category && item.category.toLowerCase().includes(q);
    const skuMatch = item.sku && item.sku.toLowerCase().includes(q);
    return nameMatch || brandMatch || categoryMatch || skuMatch;
  });
}

/**
 * Fetches single product metadata from mock store HTTP API.
 */
async function getProductById(productId) {
  const url = `${MOCK_STORE_URL}/api/product/${productId}`;
  const res = await fetch(url);
  if (!res.ok) {
    if (res.status === 404) return null;
    throw new Error(`Product API responded with HTTP ${res.status}`);
  }
  return await res.json();
}

module.exports = {
  fetchFullCatalog,
  searchProducts,
  getProductById
};

