const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

const isSupabaseConfigured = Boolean(
  supabaseUrl && 
  supabaseKey && 
  !supabaseUrl.includes('your-supabase-project') &&
  supabaseUrl.startsWith('http')
);

let supabase = null;
if (isSupabaseConfigured) {
  supabase = createClient(supabaseUrl, supabaseKey);
  console.log('[Database] Connected to Supabase PostgreSQL at:', supabaseUrl);
} else {
  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      '[FATAL] Running in production mode (NODE_ENV=production) requires valid SUPABASE_URL and SUPABASE_KEY. Local JSON storage fallback is strictly prohibited in production.'
    );
  }
  console.log('[Database] Running in Local Storage mode (Set SUPABASE_URL and SUPABASE_KEY to switch to Supabase)');
}

// Local fallback store file
const dataDir = path.join(__dirname, '../../data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}
const localDbFile = path.join(dataDir, 'local_db.json');

function loadLocalData() {
  if (!fs.existsSync(localDbFile)) {
    const initial = {
      tracked_products: [],
      price_history: [],
      scrape_logs: []
    };
    fs.writeFileSync(localDbFile, JSON.stringify(initial, null, 2), 'utf8');
    return initial;
  }
  try {
    return JSON.parse(fs.readFileSync(localDbFile, 'utf8'));
  } catch (err) {
    return { tracked_products: [], price_history: [], scrape_logs: [] };
  }
}

function saveLocalData(data) {
  fs.writeFileSync(localDbFile, JSON.stringify(data, null, 2), 'utf8');
}

/**
 * Unified Database Interface
 */
const db = {
  isSupabase: isSupabaseConfigured,

  // Tracked Products
  async getTrackedProducts() {
    if (isSupabaseConfigured) {
      const { data, error } = await supabase
        .from('tracked_products')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw new Error(error.message);
      return data || [];
    } else {
      const data = loadLocalData();
      return [...data.tracked_products].sort(
        (a, b) => new Date(b.created_at) - new Date(a.created_at)
      );
    }
  },

  async getTrackedProductById(id) {
    if (isSupabaseConfigured) {
      const { data, error } = await supabase
        .from('tracked_products')
        .select('*')
        .eq('id', id)
        .single();
      if (error && error.code !== 'PGRST116') throw new Error(error.message);
      return data || null;
    } else {
      const data = loadLocalData();
      return data.tracked_products.find((p) => p.id === id) || null;
    }
  },

  async getTrackedProductByStoreId(productId) {
    const pId = Number(productId);
    if (isSupabaseConfigured) {
      const { data, error } = await supabase
        .from('tracked_products')
        .select('*')
        .eq('product_id', pId)
        .maybeSingle();
      if (error) throw new Error(error.message);
      return data || null;
    } else {
      const data = loadLocalData();
      return data.tracked_products.find((p) => p.product_id === pId) || null;
    }
  },

  async createTrackedProduct(product) {
    const now = new Date().toISOString();
    const newRecord = {
      product_id: Number(product.productId),
      name: String(product.name),
      brand: product.brand || '',
      category: product.category || '',
      sku: product.sku || '',
      url: product.url || `https://demo.inelabteamdev.com/product/${product.productId}`,
      is_active: true,
      current_price: null,
      current_stock: null,
      currency: 'INR',
      last_scraped_at: null,
      created_at: now,
      updated_at: now
    };

    if (isSupabaseConfigured) {
      const { data, error } = await supabase
        .from('tracked_products')
        .insert([newRecord])
        .select()
        .single();
      if (error) throw new Error(error.message);
      return data;
    } else {
      const data = loadLocalData();
      const existing = data.tracked_products.find((p) => p.product_id === newRecord.product_id);
      if (existing) {
        throw new Error('Product is already being tracked');
      }
      newRecord.id = crypto.randomUUID();
      data.tracked_products.unshift(newRecord);
      saveLocalData(data);
      return newRecord;
    }
  },

  async deleteTrackedProduct(id) {
    if (isSupabaseConfigured) {
      const { error } = await supabase
        .from('tracked_products')
        .delete()
        .eq('id', id);
      if (error) throw new Error(error.message);
      return true;
    } else {
      const data = loadLocalData();
      data.tracked_products = data.tracked_products.filter((p) => p.id !== id);
      data.price_history = data.price_history.filter((h) => h.tracked_product_id !== id);
      data.scrape_logs = data.scrape_logs.filter((l) => l.tracked_product_id !== id);
      saveLocalData(data);
      return true;
    }
  },

  async updateTrackedProductLatestScrape(id, price, stock, scrapedAt) {
    const timestamp = scrapedAt || new Date().toISOString();
    if (isSupabaseConfigured) {
      const { data, error } = await supabase
        .from('tracked_products')
        .update({
          current_price: price,
          current_stock: stock,
          last_scraped_at: timestamp,
          updated_at: timestamp
        })
        .eq('id', id)
        .select()
        .single();
      if (error) throw new Error(error.message);
      return data;
    } else {
      const data = loadLocalData();
      const product = data.tracked_products.find((p) => p.id === id);
      if (product) {
        product.current_price = price;
        product.current_stock = stock;
        product.last_scraped_at = timestamp;
        product.updated_at = timestamp;
        saveLocalData(data);
      }
      return product;
    }
  },

  // Price History
  async addPriceHistory({ trackedProductId, productId, price, stock, currency = 'INR', scrapedAt }) {
    const timestamp = scrapedAt || new Date().toISOString();
    const record = {
      tracked_product_id: trackedProductId,
      product_id: Number(productId),
      price: Number(price),
      stock: Number(stock),
      currency: currency || 'INR',
      scraped_at: timestamp
    };

    if (isSupabaseConfigured) {
      const { data, error } = await supabase
        .from('price_history')
        .insert([record])
        .select()
        .single();
      if (error) throw new Error(error.message);
      return data;
    } else {
      const data = loadLocalData();
      record.id = crypto.randomUUID();
      data.price_history.unshift(record);
      saveLocalData(data);
      return record;
    }
  },

  async getPriceHistory(trackedProductId, limit = 100) {
    if (isSupabaseConfigured) {
      const { data, error } = await supabase
        .from('price_history')
        .select('*')
        .eq('tracked_product_id', trackedProductId)
        .order('scraped_at', { ascending: true })
        .limit(limit);
      if (error) throw new Error(error.message);
      return data || [];
    } else {
      const data = loadLocalData();
      return data.price_history
        .filter((h) => h.tracked_product_id === trackedProductId)
        .sort((a, b) => new Date(a.scraped_at) - new Date(b.scraped_at))
        .slice(-limit);
    }
  },

  // Scrape Logs
  async addScrapeLog({ trackedProductId, productId, attemptNumber = 1, status, price = null, stock = null, durationMs = null, errorMessage = null, timestamp }) {
    const now = timestamp || new Date().toISOString();
    const record = {
      tracked_product_id: trackedProductId || null,
      product_id: Number(productId),
      attempt_number: Number(attemptNumber),
      status: status, // 'success' | 'retried' | 'failed'
      price: price !== null ? Number(price) : null,
      stock: stock !== null ? Number(stock) : null,
      duration_ms: durationMs !== null ? Number(durationMs) : null,
      error_message: errorMessage ? String(errorMessage) : null,
      timestamp: now
    };

    if (isSupabaseConfigured) {
      const { data, error } = await supabase
        .from('scrape_logs')
        .insert([record])
        .select()
        .single();
      if (error) throw new Error(error.message);
      return data;
    } else {
      const data = loadLocalData();
      record.id = crypto.randomUUID();
      data.scrape_logs.unshift(record);
      // Keep logs capped at 1000 locally
      if (data.scrape_logs.length > 1000) data.scrape_logs.pop();
      saveLocalData(data);
      return record;
    }
  },

  async getScrapeLogs({ trackedProductId = null, productId = null, status = null, limit = 100 } = {}) {
    if (isSupabaseConfigured) {
      let query = supabase
        .from('scrape_logs')
        .select('*')
        .order('timestamp', { ascending: false })
        .limit(limit);

      if (trackedProductId) query = query.eq('tracked_product_id', trackedProductId);
      if (productId) query = query.eq('product_id', Number(productId));
      if (status) query = query.eq('status', status);

      const { data, error } = await query;
      if (error) throw new Error(error.message);
      return data || [];
    } else {
      const data = loadLocalData();
      let logs = [...data.scrape_logs];
      if (trackedProductId) logs = logs.filter((l) => l.tracked_product_id === trackedProductId);
      if (productId) logs = logs.filter((l) => l.product_id === Number(productId));
      if (status) logs = logs.filter((l) => l.status === status);
      return logs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)).slice(0, limit);
    }
  }
};

module.exports = db;
