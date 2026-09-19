# INE Product Price Tracker

A full-stack web application built for the **INE Software Engineer Intern Assignment**. The application searches products on INE's hosted mock store ([https://demo.inelabteamdev.com/](https://demo.inelabteamdev.com/)), tracks their prices and stock over time, visualizes trends through interactive charts, and audits every scrape attempt with honest execution logs.

---

## 🔗 Live Deployments

- **Frontend (Vercel)**: [https://ine-assignment-two.vercel.app](https://ine-assignment-two.vercel.app)
- **Backend (Render)**: [https://ine-price-tracker-backend.onrender.com](https://ine-price-tracker-backend.onrender.com)
- **Target Mock Store**: [https://demo.inelabteamdev.com](https://demo.inelabteamdev.com)
- **Database**: Supabase PostgreSQL

---

## 🛠️ Tech Stack

- **Frontend**: React 18, Vite, Tailwind CSS, Recharts, Lucide React (Deployed on Vercel)
- **Backend**: Node.js, Express.js (Deployed as a Docker Web Service on Render)
- **Database**: Supabase PostgreSQL (with automatic local storage fallback for offline dev)
- **Scraper**: Playwright (Headless & Headed modes)
- **Scheduler**: External cron service ([cron-job.org](https://cron-job.org)) triggering every 2 hours

---

## ✨ Features & Scraper Reliability

- **Catalog Search**: Fast, lightweight search by partial/full product name, brand, category, or SKU using the store's catalog API.
- **Interactive Price Reveal**: Automates the mock store's hover dwell requirement (`>600ms` dwell time, $\ge 8$ cursor moves) to unlock and click "Reveal price".
- **Resilient Automation**: Automatically recovers from simulated click drops (~17.5% drop rate) and dismisses asynchronous multi-click cookie consent overlays.
- **Decoy & MRP Filtering**: Uses computed CSS visibility checks to ignore hidden decoy price elements (`display: none`) and strikethrough MRP values.
- **Data Validation & Non-Pollution Guarantee**: Enforces strictly positive prices and non-negative integer stock counts. If an attempt fails after 3 retries, the failure is logged honestly and zero corrupt records are written to `price_history`.
- **Historical Trends & Audit Logs**: Interactive price and stock curves (Recharts) and detailed scrape logs detailing attempt counts, latency, and outcomes (`success`, `retried`, `failed`).

---

## 🚀 Getting Started

### Prerequisites
- Node.js 18+ (Node 20+ recommended)
- npm

### 1. Installation
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
SUPABASE_KEY=your-supabase-anon-or-service-key
CRON_SECRET=your-secret-token-here
MOCK_STORE_URL=https://demo.inelabteamdev.com
HEADLESS=true
```
*(Note: If `SUPABASE_URL` is omitted, the backend runs in Local Storage mode `backend/data/local_db.json` for zero-setup local development).*

Create `frontend/.env`:
```env
VITE_API_BASE_URL=http://localhost:5001/api
```

### 3. Database Setup (Supabase)
Run the SQL schema located at [`supabase/schema.sql`](supabase/schema.sql) in your Supabase project's SQL Editor to create the required tables, foreign keys, and indexes.

### 4. Running Locally
```bash
# Terminal 1 - Backend (port 5001)
cd backend
npm run dev

# Terminal 2 - Frontend (port 3000 / 5173)
cd frontend
npm run dev
```

---

## 🎥 Observable (Headed) Run

To launch the scraper in headed mode for evaluation and screen recording:

```bash
cd backend
npm run scraper:headed

# Or test a specific product ID (e.g. 705)
npm run scraper:headed -- --productId 705
```

This opens a visible Chromium browser with `slowMo: 650ms`, clearly showing:
1. Direct navigation to the product page.
2. Cookie overlay dismissal.
3. Mouse hover and dwell over the price container.
4. "Reveal price" button unlocking, clicking, and click-drop recovery.
5. Extraction and validation of selling price and stock.

---

## ⏰ Scraping Schedule & Sleep Handling

Because free-tier hosting platforms (Render) go to sleep after 15 minutes of inactivity, an internal timer cannot guarantee execution.

- **External Cron**: Configured on **cron-job.org** to send an HTTP `POST` request every 2 hours:
  - **URL**: `https://ine-price-tracker-backend.onrender.com/api/scrape/trigger`
  - **Headers**: `Authorization: Bearer <CRON_SECRET>`
- **Behavior**: The request wakes the sleeping Render instance, validates the authorization token, sequentially scrapes all active products, persists observations and logs to Supabase, and allows the instance to sleep until the next cycle.

---

## 🧪 Testing

```bash
# Run deterministic unit tests (decoy filtering, sanitization, validation, retries)
cd backend
npm run test:unit

# Run live mock store integration test against product 705
npm run test:integration
```

---

## 📂 Project Structure

```
INE-Assignment/
├── Dockerfile                         # Root Dockerfile for Render deployment
├── render.yaml                        # Render blueprint configuration
├── design-notes.md                    # Engineering decisions, trade-offs & AI corrections
├── README.md                          # Project documentation
├── supabase/
│   └── schema.sql                     # Database schema definition
├── backend/
│   ├── Dockerfile                     # Container definition with Playwright Chromium
│   ├── scripts/
│   │   └── runHeaded.js               # Observable headed scraper script
│   ├── src/
│   │   ├── server.js                  # Express application setup & middleware
│   │   ├── db/database.js             # Unified database interface (Supabase / Local JSON)
│   │   ├── services/catalogService.js # Lightweight HTTP catalog browsing & search
│   │   ├── scraper/
│   │   │   ├── storeInteraction.js    # Playwright DOM interaction & reveal flow
│   │   │   ├── dataExtractor.js       # Price/stock extraction & decoy removal
│   │   │   ├── dataValidator.js       # Strict validation rules
│   │   │   └── scraperRunner.js       # Lifecycle, retries & error handling
│   │   └── routes/
│   │       ├── products.js            # Catalog search routes
│   │       ├── tracked.js             # Tracked product CRUD routes
│   │       ├── scrape.js              # Cron trigger & manual scrape routes
│   │       └── logs.js                # Scrape attempt audit logs route
│   └── tests/
│       ├── unit/                      # Unit tests
│       └── integration/               # Integration tests
└── frontend/
    └── src/
        ├── App.jsx                    # Dashboard container & polling
        ├── services/api.js            # Backend REST API client
        └── components/
            ├── Navbar.jsx             # Navigation header
            ├── TrackedProductCard.jsx # Product card with price/stock badges
            ├── SearchModal.jsx        # Store catalog search modal
            ├── ProductDetailsModal.jsx# Price/stock history chart & logs modal
            └── GlobalLogsModal.jsx    # System audit logs modal
```

---

## 📡 REST API Reference

| Method | Endpoint | Auth | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/health` | None | Service health check and keep-alive ping |
| `GET` | `/api/products/search?q=...` | None | Search mock store catalog by keyword |
| `GET` | `/api/products/:id` | None | Fetch single product details |
| `GET` | `/api/tracked-products` | None | List all tracked products |
| `POST` | `/api/tracked-products` | None | Track a new product (starts initial background scrape) |
| `DELETE` | `/api/tracked-products/:id` | None | Remove a tracked product and its history |
| `GET` | `/api/tracked-products/:id/history` | None | Retrieve price & stock history observations |
| `GET` | `/api/scrape-logs` | None | Retrieve scrape attempt audit logs |
| `POST` | `/api/scrape/trigger` | `Bearer <CRON_SECRET>` | Authenticated trigger for 2-hour scheduled batch scrape |
| `POST` | `/api/scrape/product/:id` | None | On-demand manual scrape for a single product |
