# INE Product Price Tracker

A full-stack web application built for the **INE Software Engineer Intern Assignment**. The application allows users to search the hosted mock storefront ([https://demo.inelabteamdev.com/](https://demo.inelabteamdev.com/)), track products, monitor price and stock changes over time with charts and tables, and audit all scrape attempts via honest execution logs.

---

## Architecture Overview

```
                                  +------------------------------------+
                                  |   External Cron (cron-job.org)    |
                                  |         (Triggers every 2h)        |
                                  +-----------------+------------------+
                                                    | HTTP POST /api/scrape/trigger
                                                    | Header: Authorization: Bearer <CRON_SECRET>
                                                    v
+-----------------------------+        +-------------------------------+
|      React + Vite Frontend  |        |      Node.js Express Backend  |
|     (Deployed on Vercel)    | <----> |     (Deployed on Render)      |
|  - Search Mock Store        |  REST  |  - /api/products/search       |
|  - Tracked Products List    |  API   |  - /api/tracked-products      |
|  - Price & Stock Charts     |        |  - /api/tracked-products/:id  |
|  - Per-Product Scrape Logs  |        |  - /api/scrape-logs           |
+-----------------------------+        |  - /api/scrape/trigger        |
                                       +---------------+---------------+
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

## Tech Stack

- **Frontend**: React 18, Vite, Tailwind CSS, Lucide React, Recharts (Deployable on **Vercel**)
- **Backend**: Node.js, Express.js (Deployable on **Render**)
- **Database**: Supabase PostgreSQL (with automatic local storage fallback for zero-setup local dev)
- **Scraper**: Playwright (supports headless and observable headed runs)
- **Scheduler**: External cron service (**cron-job.org**) triggering every 2 hours

---

## Core Features & Scraper Reliability

1. **Lightweight Catalog Search**: Fast partial and full product name, brand, category, and SKU search using the mock store's catalog API.
2. **Interactive Mock Store Price Reveal**: Simulates realistic hover dwell (`>600ms`) and clicks the "Reveal price" button, handling intentional click-drops with automatic re-clicks.
3. **Decoy Element Filtering**: Completely ignores hidden fake prices (`display: none;` decoy spans) and strikethrough MRP elements to guarantee that only the true selling price is captured.
4. **Data Sanitization**: Automatically strips zero-width spaces (`\u200B`), non-breaking spaces, and currency symbols (`₹`, `Rs.`).
5. **Strict Validation & Non-Pollution Guarantee**: Rejects non-positive prices and invalid stock. If all retry attempts fail, the failure is recorded honestly in `scrape_logs`, and **zero records are inserted into `price_history`**.
6. **Free-Tier Sleep Handling**: Protected `POST /api/scrape/trigger` endpoint woke up automatically by external cron (`cron-job.org`) every 2 hours.

---

## Local Setup Instructions

### Prerequisites
- Node.js 18+ (Node 20 recommended)
- npm

### 1. Install Dependencies
```bash
# Install backend dependencies
cd backend && npm install

# Install Playwright browser (Chromium)
npx playwright install chromium

# Install frontend dependencies
cd ../frontend && npm install
```

### 2. Environment Variables Setup

Create `backend/.env`:
```env
PORT=5001
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your-supabase-anon-or-service-key
CRON_SECRET=your-chosen-secret-token
MOCK_STORE_URL=https://demo.inelabteamdev.com
HEADLESS=true
```

> **Note**: If `SUPABASE_URL` is omitted or empty, the backend runs in zero-setup Local Storage mode (`backend/data/local_db.json`), allowing instant local testing without needing an external database account.

Create `frontend/.env`:
```env
VITE_API_BASE_URL=http://localhost:5001/api
```

### 3. Supabase Database Setup
1. Log in to [Supabase](https://supabase.com) and create a new project.
2. Open the **SQL Editor** tab.
3. Paste and run the contents of [`supabase/schema.sql`](file:///Users/sakshamchawla/Desktop/INE%20Assignment/supabase/schema.sql).
4. Copy your Project URL and Anon/Service Key into `backend/.env`.

---

## Running the Application

### Start Backend
```bash
cd backend
npm run dev
# Server runs on http://localhost:5001
```

### Start Frontend
```bash
cd frontend
npm run dev
# Frontend runs on http://localhost:3000
```

---

## Headed Scraper (Screen Recording Demonstration)

To run the scraper in headed mode for the required evaluation screen recording:

```bash
# From root or backend:
npm run scraper:headed

# Or test a specific product ID:
npm run scraper:headed -- --productId 705
```

This launches a visible Chromium browser with `slowMo: 650ms`, clearly showing:
1. Navigating to the mock store product page.
2. Dismissing cookie overlay if present.
3. Performing hover dwell on the price area.
4. Unlocking and clicking "Reveal price".
5. Waiting through the spinner / store retries.
6. Extracting the real price and stock.
7. Outputting colored results and timings to the terminal.

---

## Running Automated Tests

The test suite is strictly divided into deterministic unit tests (mocking network and browser behaviors) and live integration tests against the actual mock store:

### Deterministic Unit Tests
Fast, deterministic tests verifying timeouts, retries, decoy rejection, stock parsing, data validation, and ensuring corrupt data never enters `price_history`:
```bash
npm run test:unit
```

### Live Mock Store Integration Test
Runs a real Playwright scrape against `https://demo.inelabteamdev.com/product/705`:
```bash
npm run test:integration
```

---

## Scheduling Scrapes (cron-job.org)

Free-tier cloud backends (e.g. Render) spin down / sleep when idle. To ensure reliable scheduled execution every 2 hours:

1. Sign up for a free account at [cron-job.org](https://cron-job.org).
2. Create a new cron job:
   - **URL**: `https://your-backend-service.onrender.com/api/scrape/trigger`
   - **Schedule**: Every 2 hours (`0 */2 * * *`)
   - **Request Method**: `POST`
   - **Headers**:
     - `Authorization: Bearer <YOUR_CRON_SECRET>`
3. When `cron-job.org` triggers the request:
   - Render automatically wakes up from sleep.
   - The backend validates `CRON_SECRET`.
   - The scraper runner scrapes all active tracked products in sequence.
   - Historical prices, stocks, and logs are persisted to Supabase.

---

---

## Live Deployments & Repository

- **Frontend (Vercel)**: [https://ine-assignment-two.vercel.app](https://ine-assignment-two.vercel.app)
- **Backend (Render)**: [https://ine-price-tracker-backend.onrender.com](https://ine-price-tracker-backend.onrender.com)
- **GitHub Repository**: [https://github.com/chawlasaksham/INE-Assignment.git](https://github.com/chawlasaksham/INE-Assignment.git)
- **Database (Supabase)**: Connected (`https://jfpzxbmrfpideifheqee.supabase.co`)

---

## Production Deployment Guide

### Database: Supabase
1. Create a Supabase project.
2. Run [`supabase/schema.sql`](file:///Users/sakshamchawla/Desktop/INE%20Assignment/supabase/schema.sql) in the SQL Editor to create tables, indexes, and foreign keys.

### Backend: Render.com
1. Create a new **Web Service** on Render connected to your GitHub repository.
2. Configure:
   - **Environment / Runtime**: `Docker` (uses official `mcr.microsoft.com/playwright:v1.61.1-noble` container with all Chromium dependencies pre-packaged)
   - **Dockerfile Path**: `backend/Dockerfile` (or `Dockerfile`)
3. Add Environment Variables:
   - `SUPABASE_URL`: `https://jfpzxbmrfpideifheqee.supabase.co`
   - `SUPABASE_KEY`: `<your-supabase-key>`
   - `CRON_SECRET`: `<your-cron-secret-token>`
   - `PORT`: `10000`
   - `HEADLESS`: `true`
   - `MOCK_STORE_URL`: `https://demo.inelabteamdev.com`

### Frontend: Vercel
1. Create a new project on Vercel connected to your GitHub repository.
2. Configure:
   - **Root Directory**: `frontend`
   - **Framework Preset**: `Vite`
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
3. Add Environment Variable:
   - `VITE_API_BASE_URL`: `https://ine-price-tracker-backend.onrender.com/api`

---

## REST API Reference

| Method | Endpoint | Auth | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/health` | None | Health check & keep-alive ping |
| `GET` | `/api/products/search?q=...` | None | Search mock store catalog by name, brand, SKU |
| `GET` | `/api/tracked-products` | None | List all tracked products |
| `POST` | `/api/tracked-products` | None | Track product (persists immediately, background scrape) |
| `DELETE` | `/api/tracked-products/:id` | None | Untrack product |
| `GET` | `/api/tracked-products/:id/history` | None | Get chronological price & stock history |
| `GET` | `/api/scrape-logs` | None | Get attempt audit logs (optional `?productId=...`) |
| `POST` | `/api/scrape/trigger` | `Bearer <CRON_SECRET>` | Trigger scheduled batch scrape across all tracked products |
| `POST` | `/api/scrape/product/:id` | None | Trigger on-demand manual scrape for single product |

