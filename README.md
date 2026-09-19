# INE Product Price Tracker

A robust, production-ready full-stack web application built for the **INE Software Engineer Intern Assignment**.

The application tracks product prices and inventory levels over time from INE's hosted mock store ([https://demo.inelabteamdev.com/](https://demo.inelabteamdev.com/)). It automates complex browser interactions (hover dwell, click drops, cookie dismissal, decoy filtering), persists clean data in Supabase PostgreSQL, schedules background scrapes every 2 hours via an external cron service, and visualizes price and stock history with interactive charts, observations tables, and audit logs.

---

## 🌐 Live Production Deployments

| Component | Provider | Live URL |
| :--- | :--- | :--- |
| **Frontend Web App** | Vercel | [https://ine-assignment-two.vercel.app](https://ine-assignment-two.vercel.app) |
| **Backend REST API** | Render (Docker) | [https://ine-price-tracker-backend.onrender.com](https://ine-price-tracker-backend.onrender.com) |
| **Database** | Supabase (PostgreSQL) | Connected (`https://jfpzxbmrfpideifheqee.supabase.co`) |
| **Source Code** | GitHub | [https://github.com/chawlasaksham/INE-Assignment.git](https://github.com/chawlasaksham/INE-Assignment.git) |
| **External Scheduler** | cron-job.org | Triggering `POST /api/scrape/trigger` every 2 hours |

---

## 🏗️ System Architecture

```
                                  +------------------------------------+
                                  |   External Cron (cron-job.org)     |
                                  |         (Triggers every 2h)        |
                                  +-----------------+------------------+
                                                    | HTTP POST /api/scrape/trigger
                                                    | Header: Authorization: Bearer <CRON_SECRET>
                                                    v
+-----------------------------+        +-------------------------------+
|      React + Vite Frontend  |        |      Node.js Express Backend  |
|     (Deployed on Vercel)    | <----> |     (Deployed on Render)      |
|  - Search Mock Store        |  REST  |  - /api/products/search       |
|  - Tracked Products Grid    |  API   |  - /api/tracked-products      |
|  - Price & Stock Charts     |        |  - /api/tracked-products/:id  |
|  - Per-Product Scrape Logs  |        |  - /api/scrape-logs           |
|  - System Audit Logs        |        |  - /api/scrape/trigger        |
+-----------------------------+        +---------------+---------------+
                                                       |
                                        +--------------+---------------+
                                        |                              |
                                        v                              v
                         +-----------------------------+  +----------------------------+
                         |     Playwright Scraper      |  |    Supabase PostgreSQL     |
                         |  - storeInteraction.js      |  |  - tracked_products        |
                         |  - dataExtractor.js         |  |  - price_history           |
                         |  - dataValidator.js         |  |  - scrape_logs             |
                         |  - scraperRunner.js         |  +----------------------------+
                         +-----------------------------+
```

---

## 🧠 Overcoming the Mock Store Challenges

The INE mock storefront is deliberately engineered to break naive scraping:

1. **Client-Side React SPA**: Static HTML scraping (`axios` / `cheerio`) only retrieves an empty `<div id="root"></div>`. Product data and pricing require JavaScript execution.
2. **Interactive Price Reveal**: The price is initially hidden behind a "Reveal price" button.
3. **Mouse Hover & Dwell Detection**: The store requires a minimum dwell time (`>600ms`) and at least 8 distinct mouse move events over the `.price-block` before the "Reveal price" button becomes enabled.
4. **Asynchronous Multi-Click Cookie Overlay**: A cookie consent modal appears at random delays (1.5s to 5.0s) and uses an internal counter requiring up to 3 clicks to dismiss.
5. **Simulated Click Drops**: The "Reveal price" click drops randomly (~17.5% of the time). Our scraper actively detects if the state remains idle and re-clicks automatically.
6. **Decoy DOM Elements**: The store injects hidden `<span class="price-value" style="display:none">` and `<span class="amount" data-price="true" style="display:none">` elements with fake prices. Our extractor checks computed CSS visibility to ignore all hidden decoys.
7. **Strikethrough MRP vs. Selling Price**: Strikethrough elements (`text-decoration: line-through`) are strictly filtered out so only the true selling price is captured.
8. **Invisible Formatting Characters**: Strips zero-width spaces (`\u200B`), non-breaking spaces, and currency symbols (`₹`, `Rs.`).
9. **Strict Validation & Non-Pollution Guarantee**: If an attempt fails after 3 retries, the failure is recorded honestly in `scrape_logs`, and **zero records are inserted into `price_history`**.
10. **Free-Tier Sleep Handling**: Free hosting instances (Render) sleep after 15 minutes of inactivity. Rather than an in-process loop that halts when suspended, an external cron service (**cron-job.org**) sends an authenticated HTTP request every 2 hours to wake the service and trigger batch scraping.

---

## 💻 Local Setup & Installation

### Prerequisites
- Node.js 18+ (Node 20+ recommended)
- npm

### 1. Clone & Install
```bash
git clone https://github.com/chawlasaksham/INE-Assignment.git
cd INE-Assignment

# Install backend dependencies & Playwright Chromium browser
cd backend
npm install
npx playwright install chromium

# Install frontend dependencies
cd ../frontend
npm install
```

### 2. Environment Variables

Create `backend/.env`:
```env
PORT=5001
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your-supabase-anon-or-service-role-key
CRON_SECRET=your-secret-token-here
MOCK_STORE_URL=https://demo.inelabteamdev.com
HEADLESS=true
```
*(Note: If `SUPABASE_URL` is omitted, the backend runs in Local Storage mode `backend/data/local_db.json`, allowing instant local testing without an external database).*

Create `frontend/.env`:
```env
VITE_API_BASE_URL=http://localhost:5001/api
```

### 3. Database Setup (Supabase)
1. Open your Supabase project dashboard -> **SQL Editor**.
2. Run the SQL statements from [`supabase/schema.sql`](supabase/schema.sql).

### 4. Running Locally
```bash
# Terminal 1 - Start Backend (runs on port 5001)
cd backend
npm run dev

# Terminal 2 - Start Frontend (runs on port 3000 / 5173)
cd frontend
npm run dev
```

---

## 🎥 Observable Headed Run (Screen Recording Demonstration)

The assignment requires demonstrating the scraper running in headed mode to show how it handles the mock store:

```bash
# Run against the first tracked product (or default product 705)
cd backend
npm run scraper:headed

# Or run against any specific product ID (e.g. 705)
npm run scraper:headed -- --productId 705
```

This launches a visible Chromium browser with `slowMo: 650ms`, clearly showing:
1. Direct navigation to the product page.
2. Automated dismissal of the cookie banner if present.
3. Smooth mouse hover movement and dwell time over the price block.
4. "Reveal price" button unlocking and automated clicking (with click-drop recovery).
5. Price and stock extraction and terminal verification.

---

## 🧪 Automated Testing

The test suite separates deterministic unit tests from real-store integration tests:

```bash
# Run deterministic unit tests (decoy filtering, sanitization, validation, retries)
cd backend
npm run test:unit

# Run live mock store integration test against product 705
npm run test:integration
```

---

## 📁 Comprehensive File & Function Directory

This reference documents every file in the codebase, its purpose, and the functions it contains.

```
INE-Assignment/
├── Dockerfile                         # Root Dockerfile for containerized deployments
├── render.yaml                        # Render deployment blueprint
├── design-notes.md                    # Engineering design decisions & trade-offs
├── README.md                          # Main project guide and documentation
├── supabase/
│   └── schema.sql                     # PostgreSQL schema (tables, constraints, indexes)
├── backend/
│   ├── Dockerfile                     # Backend Dockerfile with Playwright Chromium
│   ├── package.json                   # Backend dependencies and scripts
│   ├── scripts/
│   │   └── runHeaded.js               # Observable headed scraper runner
│   ├── src/
│   │   ├── server.js                  # Express entry point & middleware
│   │   ├── db/
│   │   │   └── database.js            # Unified Supabase / local JSON storage layer
│   │   ├── services/
│   │   │   └── catalogService.js      # Lightweight HTTP catalog fetching & search
│   │   ├── scraper/
│   │   │   ├── storeInteraction.js    # Playwright DOM interaction & reveal flow
│   │   │   ├── dataExtractor.js       # Visible price/stock parsing & decoy removal
│   │   │   ├── dataValidator.js       # Data correctness & positive price enforcement
│   │   │   └── scraperRunner.js       # Scraper lifecycle, retries, and error logging
│   │   └── routes/
│   │       ├── products.js            # Catalog search routes
│   │       ├── tracked.js             # Tracked product CRUD routes
│   │       ├── scrape.js              # Cron trigger & manual scrape routes
│   │       └── logs.js                # Scrape attempt audit logs route
│   └── tests/
│       ├── unit/                      # 29 deterministic unit tests
│       └── integration/               # Live mock store test
└── frontend/
    ├── package.json                   # Frontend dependencies
    ├── vite.config.js                 # Vite build configuration
    └── src/
        ├── main.jsx                   # React DOM root render
        ├── App.jsx                    # Main dashboard container & polling loop
        ├── services/
        │   └── api.js                 # REST client for backend API communication
        └── components/
            ├── Navbar.jsx             # Top bar navigation & action triggers
            ├── TrackedProductCard.jsx # Product card with price/stock badges & actions
            ├── SearchModal.jsx        # Store catalog search modal
            ├── ProductDetailsModal.jsx# Price/stock history chart & attempt logs modal
            └── GlobalLogsModal.jsx    # System-wide audit logs modal
```

---

### Backend Files & Functions

#### 1. `backend/src/server.js`
*Primary backend entry point.*
- Configures Express, CORS, and JSON body parsing.
- Implements HTTP request logging with method, URL, status code, and latency in milliseconds.
- Mounts routes: `/health`, `/api/products`, `/api/tracked-products`, `/api/scrape-logs`, `/api/scrape`.
- Provides 404 handler for undefined routes and global error handler returning JSON errors.

#### 2. `backend/src/db/database.js`
*Unified database adapter supporting Supabase PostgreSQL with local JSON file fallback.*
- `loadLocalData()`: Reads `backend/data/local_db.json` or creates the initial schema structure if missing.
- `saveLocalData(data)`: Writes JSON data back to `local_db.json`.
- `getTrackedProducts()`: Fetches all tracked products ordered by creation date descending.
- `getTrackedProductById(id)`: Fetches a single tracked product by its primary UUID.
- `getTrackedProductByStoreId(productId)`: Looks up a product by the store's integer product ID to prevent duplicate tracking.
- `createTrackedProduct(product)`: Inserts a new tracked product record into Supabase/local storage with initial null price and pending stock.
- `deleteTrackedProduct(id)`: Deletes a tracked product and cascades deletion across associated price history and scrape logs.
- `updateTrackedProductLatestScrape(id, price, stock, scrapedAt)`: Updates the current price, current stock, and last scraped timestamp on a tracked product.
- `addPriceHistory({ trackedProductId, productId, price, stock, currency, scrapedAt })`: Inserts a validated observation into the `price_history` table.
- `getPriceHistory(trackedProductId, limit)`: Returns chronological price and stock observations for chart rendering.
- `addScrapeLog({ trackedProductId, productId, attemptNumber, status, price, stock, durationMs, errorMessage, timestamp })`: Inserts a scrape attempt log record (`success`, `retried`, or `failed`) with execution duration and error details.
- `getScrapeLogs({ trackedProductId, productId, status, limit })`: Retrieves audit logs with optional filtering by product or status.

#### 3. `backend/src/services/catalogService.js`
*Lightweight HTTP client for searching and browsing the mock store.*
- `fetchFullCatalog()`: Queries `/api/catalog?page=X&pageSize=60` across pages using native HTTP `fetch` with an in-memory 10-minute TTL cache, avoiding browser overhead.
- `searchProducts(query)`: Filters cached catalog items by case-insensitive matching across product name, brand, category, or SKU.
- `getProductById(productId)`: Fetches metadata for a single product from `/api/product/:id`.

#### 4. `backend/src/scraper/storeInteraction.js`
*Playwright browser automation module for interacting with the mock storefront.*
- `dismissCookieIfPresent(page)`: Detects `.cookie-overlay` and clicks the accept button up to 5 times to handle the store's random multi-click counter.
- `interactAndRevealPrice(page, targetUrl, options)`:
  1. Registers Playwright `addLocatorHandler` for asynchronous cookie banner interruptions.
  2. Navigates to the product URL (`domcontentloaded`).
  3. Scrolls the `.price-block` into view.
  4. Calculates bounding box coordinates and executes smooth mouse movements over 16 increments (total dwell time ~1200ms) to satisfy the store's `minDwellMs >= 600` and `minMoves >= 8` requirement.
  5. Waits for the "Reveal price" button to lose its `disabled` attribute.
  6. Enters a click loop to overcome simulated click drops (~17.5% drop rate).
  7. Waits for `.price-success`, or detects `.price-error` and clicks "Try again".

#### 5. `backend/src/scraper/dataExtractor.js`
*Extracts and sanitizes DOM data while filtering out traps and decoys.*
- `sanitizePriceText(rawText)`:
  - Strips zero-width spaces (`\u200B`), non-breaking spaces (`\u00A0`), and line breaks.
  - Normalizes full-width Unicode numbers (`\uFF10-\uFF19`) to standard ASCII digits.
  - Strips trailing suffixes like `/- (incl. of all taxes)`.
  - Removes currency symbols and prefixes (`₹`, `Rs.`, `INR`, `$`, `€`).
  - Distinguishes European decimal formats (`12.499,00`) from standard comma formats (`12,499.00`).
  - Returns a clean floating-point number or `null`.
- `parseStockText(rawText)`:
  - Recognizes "Out of stock" and returns `0`.
  - Extracts numeric digits from strings like "In stock · 12 left", "Only 4 left", "Selling fast — 3 left".
  - Returns integer stock count or `null`.
- `extractFromPage(page)`:
  - Evaluates within the browser page context.
  - Checks computed styles (`window.getComputedStyle`) to reject hidden elements (`display: none`, `visibility: hidden`, `opacity: 0`).
  - Explicitly ignores elements with `line-through` (MRP values).
  - Selects the prominent selling price element based on computed font size (avoiding split digit spans).
  - Extracts raw stock text from `.stock-badge` or `.price-facets`.

#### 6. `backend/src/scraper/dataValidator.js`
*Strict validation gate ensuring no corrupt or empty data is committed.*
- `validateScrapedData(data)`:
  - Ensures price is a finite, positive number (`> 0`).
  - Ensures stock is a non-negative integer (`>= 0`).
  - Rejects `null`, `undefined`, `NaN`, empty strings, and negative values.
  - Returns `{ isValid: true, data: { price, stock, currency } }` or `{ isValid: false, error: "..." }`.

#### 7. `backend/src/scraper/scraperRunner.js`
*Scraper orchestration engine with retries, backoff, and audit logging.*
- `scrapeProduct(product, options)`:
  - Launches Chromium browser (headless by default, headed if configured).
  - Executes up to 3 attempts per product.
  - On each attempt: creates an isolated browser context/page, runs `interactAndRevealPrice`, extracts via `extractFromPage`, and validates via `validateScrapedData`.
  - On success: logs success to `scrape_logs`, inserts an observation to `price_history`, updates `tracked_products`, and returns.
  - On failure: logs attempt as `retried` (attempts 1 & 2) or `failed` (attempt 3) in `scrape_logs`. On retry, sleeps with exponential backoff (1s, 2s).
  - Guarantees zero writes to `price_history` if validation fails or all retries fail.
  - Always closes browser contexts and pages in `finally` blocks to prevent memory leaks.
- `scrapeAllActiveProducts(options)`:
  - Iterates through all active tracked products **sequentially** to conserve server memory on free-tier instances.

#### 8. `backend/src/routes/products.js`
- `GET /api/products/search?q=...`: Calls `catalogService.searchProducts(q)` and returns matching products.
- `GET /api/products/:id`: Returns product details from mock store.

#### 9. `backend/src/routes/tracked.js`
- `GET /api/tracked-products`: Returns all tracked products with their current prices and stock.
- `POST /api/tracked-products`: Persists product record immediately (201 Created), then kicks off initial background scrape via `setImmediate`.
- `DELETE /api/tracked-products/:id`: Removes product and deletes its history.
- `GET /api/tracked-products/:id/history`: Returns historical observations for chart plotting.

#### 10. `backend/src/routes/scrape.js`
- `verifyCronAuth(req, res, next)`: Middleware verifying `Authorization: Bearer <CRON_SECRET>`.
- `POST /api/scrape/trigger`: Authenticated cron endpoint to trigger batch scraping across all products (or single product via query param).
- `POST /api/scrape/product/:id`: Unauthenticated on-demand manual scrape endpoint triggered by the user in the UI.

#### 11. `backend/src/routes/logs.js`
- `GET /api/scrape-logs`: Returns audit log records filtered by `productId`, `trackedProductId`, `status`, and `limit`.

#### 12. `backend/scripts/runHeaded.js`
*Executable script for video recording demonstration.*
- `parseArgs()`: Parses command-line arguments (e.g. `--productId 705`).
- `main()`: Launches Playwright with `headless: false` and `slowMo: 650ms`, prints step-by-step progress to terminal, and outputs extracted price and stock.

---

### Frontend Files & Functions

#### 1. `frontend/src/services/api.js`
*REST client communicating with the backend.*
- `handleResponse(res)`: Checks HTTP status, extracts JSON error message, or parses response.
- `searchCatalog(query)`: Calls `GET /api/products/search?q=...`.
- `getTrackedProducts()`: Calls `GET /api/tracked-products`.
- `trackProduct(product)`: Calls `POST /api/tracked-products`.
- `untrackProduct(id)`: Calls `DELETE /api/tracked-products/:id`.
- `getProductHistory(id)`: Calls `GET /api/tracked-products/:id/history`.
- `getScrapeLogs(productId, limit)`: Calls `GET /api/scrape-logs`.
- `triggerProductScrape(id)`: Calls `POST /api/scrape/product/:id` for manual scrape.
- `triggerBatchScrape(secret)`: Calls `POST /api/scrape/trigger` with Bearer token.

#### 2. `frontend/src/App.jsx`
*Root application dashboard.*
- Manages state for tracked products, loading status, active modals, and polling.
- `fetchProducts(showLoading)`: Retrieves tracked products from backend.
- Sets up 15-second polling interval to auto-refresh metrics when background scrapes complete.
- Renders `Navbar`, page header, responsive grid of `TrackedProductCard` components, and modals.

#### 3. `frontend/src/components/Navbar.jsx`
*Top navigation bar.*
- Displays brand logo, live badge, and target mock store URL.
- Houses action buttons: "Audit Logs", "Refresh", and "Track Product".

#### 4. `frontend/src/components/TrackedProductCard.jsx`
*Card component representing a single tracked product.*
- `handleScrape(e)`: Calls manual scrape endpoint and updates card state.
- `handleDelete(e)`: Confirms and calls untrack API.
- Formats price using Indian Rupee grouping (`₹18,217`).
- Renders dynamic stock badge (green for in-stock, red for out-of-stock, slate for pending).
- Shows last scrape timestamp and quick action buttons.

#### 5. `frontend/src/components/SearchModal.jsx`
*Product search and discovery modal.*
- Implements 250ms debounced input search against mock store catalog API.
- Shows loading spinners, error alerts, and empty search states.
- Displays search results with category badges, SKU, and "Track Product" button (or "Tracked" if already added).

#### 6. `frontend/src/components/ProductDetailsModal.jsx`
*Deep-dive analytics modal for a tracked product.*
- `loadData()`: Concurrently loads price history and scrape logs for the product.
- `handleManualScrape()`: Triggers live scrape and updates chart and tables in place.
- **Price & Stock History Tab**:
  - Interactive Recharts `LineChart` plotting dual Y-axes (Price in blue, Stock in green) with custom tooltips.
  - Chronological observation table displaying timestamps, formatted prices, and stock badges.
- **Scrape Attempt Logs Tab**:
  - Detailed audit table showing every scrape attempt, attempt number, status badge (`Success`, `Retried`, `Failed`), duration in ms, and extracted values or error messages.

#### 7. `frontend/src/components/GlobalLogsModal.jsx`
*System-wide audit logs modal.*
- `fetchLogs()`: Fetches the last 100 scrape logs across all products.
- Provides status filter buttons: `All`, `Success`, `Retried`, `Failed`.
- Renders timestamped table detailing product IDs, attempt numbers, durations, and honest error messages.

---

## 📅 Scraping Schedule & Sleep Handling (cron-job.org)

Free-tier backends (Render) go to sleep after 15 minutes of inactivity. When asleep, internal timers (`setInterval`, `node-cron`) do not execute.

### The Solution:
1. An external cron job is configured at [cron-job.org](https://console.cron-job.org/).
2. **Schedule**: Every 2 hours (`0 */2 * * *`).
3. **Endpoint**: `POST https://ine-price-tracker-backend.onrender.com/api/scrape/trigger`.
4. **Headers**: `Authorization: Bearer <CRON_SECRET>`.
5. **How It Works**:
   - The incoming HTTP request wakes Render from sleep.
   - The backend validates the Bearer token.
   - The backend scrapes all active products sequentially.
   - Price observations and attempt logs are persisted to Supabase.
   - Render returns to sleep until the next 2-hour schedule or user request.

---

## 🚀 Production Deployment Guide

### 1. Database (Supabase)
- Create a Supabase project.
- Run `supabase/schema.sql` in the SQL Editor.

### 2. Backend (Render)
- Create a **Web Service** on Render connected to the repository.
- **Runtime**: `Docker`
- **Dockerfile Path**: `backend/Dockerfile` (or `Dockerfile`)
- **Environment Variables**:
  - `NODE_ENV`: `production`
  - `PORT`: `10000`
  - `SUPABASE_URL`: `https://jfpzxbmrfpideifheqee.supabase.co`
  - `SUPABASE_KEY`: `<supabase-service-key>`
  - `CRON_SECRET`: `<your-cron-secret-token>`
  - `MOCK_STORE_URL`: `https://demo.inelabteamdev.com`
  - `HEADLESS`: `true`

### 3. Frontend (Vercel)
- Import repository into Vercel.
- **Root Directory**: `frontend`
- **Framework Preset**: `Vite`
- **Build Command**: `npm run build`
- **Output Directory**: `dist`
- **Environment Variables**:
  - `VITE_API_BASE_URL`: `https://ine-price-tracker-backend.onrender.com/api`

---

## 📋 REST API Reference Summary

| Method | Path | Auth | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/health` | None | Health check & keep-alive ping |
| `GET` | `/api/products/search?q=...` | None | Search mock store catalog |
| `GET` | `/api/products/:id` | None | Get product details from mock store |
| `GET` | `/api/tracked-products` | None | List all tracked products |
| `POST` | `/api/tracked-products` | None | Track product (persists immediately, background scrape) |
| `DELETE` | `/api/tracked-products/:id` | None | Untrack product and cascade delete history |
| `GET` | `/api/tracked-products/:id/history` | None | Get chronological observations for charts |
| `GET` | `/api/scrape-logs` | None | Get attempt audit logs |
| `POST` | `/api/scrape/trigger` | `Bearer <CRON_SECRET>` | Authenticated trigger for 2-hour scheduled cron |
| `POST` | `/api/scrape/product/:id` | None | Manual trigger from UI for single product |
