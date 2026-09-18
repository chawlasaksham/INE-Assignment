const API_BASE = import.meta.env.VITE_API_BASE_URL || '/api';

async function handleResponse(res) {
  if (!res.ok) {
    let errorMsg = `HTTP Error ${res.status}`;
    try {
      const body = await res.json();
      if (body.error) errorMsg = body.error;
    } catch (_) {}
    throw new Error(errorMsg);
  }
  return await res.json();
}

export const api = {
  // Search
  async searchCatalog(query) {
    const res = await fetch(`${API_BASE}/products/search?q=${encodeURIComponent(query || '')}`);
    return handleResponse(res);
  },

  // Tracked Products
  async getTrackedProducts() {
    const res = await fetch(`${API_BASE}/tracked-products`);
    return handleResponse(res);
  },

  async trackProduct(product) {
    const res = await fetch(`${API_BASE}/tracked-products`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        productId: product.id,
        name: product.name,
        brand: product.brand,
        category: product.category,
        sku: product.sku,
        url: `https://demo.inelabteamdev.com/product/${product.id}`
      })
    });
    return handleResponse(res);
  },

  async untrackProduct(id) {
    const res = await fetch(`${API_BASE}/tracked-products/${id}`, {
      method: 'DELETE'
    });
    return handleResponse(res);
  },

  // History & Logs
  async getProductHistory(id) {
    const res = await fetch(`${API_BASE}/tracked-products/${id}/history`);
    return handleResponse(res);
  },

  async getScrapeLogs(productId = null, limit = 50) {
    const url = productId
      ? `${API_BASE}/scrape-logs?productId=${productId}&limit=${limit}`
      : `${API_BASE}/scrape-logs?limit=${limit}`;
    const res = await fetch(url);
    return handleResponse(res);
  },

  // Manual Scrape
  async triggerProductScrape(id) {
    const res = await fetch(`${API_BASE}/scrape/product/${id}`, {
      method: 'POST'
    });
    return handleResponse(res);
  },

  async triggerBatchScrape(secret) {
    const res = await fetch(`${API_BASE}/scrape/trigger`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${secret}`
      }
    });
    return handleResponse(res);
  }
};

