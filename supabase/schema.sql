-- INE Product Price Tracker Schema (Supabase PostgreSQL)

-- 1. Tracked Products Table
CREATE TABLE IF NOT EXISTS tracked_products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id INTEGER UNIQUE NOT NULL,
    name TEXT NOT NULL,
    brand TEXT,
    category TEXT,
    sku TEXT,
    url TEXT NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    current_price NUMERIC(12, 2),
    current_stock INTEGER,
    currency TEXT DEFAULT 'INR',
    last_scraped_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Price History Table
CREATE TABLE IF NOT EXISTS price_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tracked_product_id UUID NOT NULL REFERENCES tracked_products(id) ON DELETE CASCADE,
    product_id INTEGER NOT NULL,
    price NUMERIC(12, 2) NOT NULL CHECK (price > 0),
    stock INTEGER NOT NULL CHECK (stock >= 0),
    currency TEXT NOT NULL DEFAULT 'INR',
    scraped_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Scrape Logs Table
CREATE TABLE IF NOT EXISTS scrape_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tracked_product_id UUID REFERENCES tracked_products(id) ON DELETE SET NULL,
    product_id INTEGER NOT NULL,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT now(),
    attempt_number INTEGER NOT NULL DEFAULT 1,
    status TEXT NOT NULL CHECK (status IN ('success', 'retried', 'failed')),
    price NUMERIC(12, 2),
    stock INTEGER,
    duration_ms INTEGER,
    error_message TEXT
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_tracked_products_active ON tracked_products(is_active);
CREATE INDEX IF NOT EXISTS idx_tracked_products_product_id ON tracked_products(product_id);
CREATE INDEX IF NOT EXISTS idx_price_history_tracked_product ON price_history(tracked_product_id, scraped_at DESC);
CREATE INDEX IF NOT EXISTS idx_price_history_product_id ON price_history(product_id, scraped_at DESC);
CREATE INDEX IF NOT EXISTS idx_scrape_logs_tracked_product ON scrape_logs(tracked_product_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_scrape_logs_product_id ON scrape_logs(product_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_scrape_logs_status ON scrape_logs(status, timestamp DESC);

