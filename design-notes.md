# Engineering Design Notes: INE Product Price Tracker

This document details the architectural, scraping, reliability, and free-tier engineering decisions made for the **INE Software Engineer Intern Assignment**.

---

## 1. Why Playwright vs. Lightweight HTTP Scraping

The assignment evaluation explicitly tests candidate judgment in choosing between lightweight HTTP fetching and a browser engine:

### Lightweight HTTP for Catalog & Search
- Inspecting `https://demo.inelabteamdev.com/` revealed that the catalog endpoints (`/api/catalog?page=X&pageSize=20` and `/api/product/:id`) return static metadata (`id`, `name`, `brand`, `category`, `sku`, `specs`, `reviews`).
- Because these endpoints do not require browser rendering, our backend uses **lightweight HTTP requests** with an in-memory TTL cache for product search. This provides sub-50ms search responses without spinning up headless browser instances.

### Playwright for Price & Stock Extraction
- In contrast, product detail pages (`/product/:id`) are client-side React 19 single-page applications. Static HTML fetching returns only an empty `<div id="root"></div>`.
- Furthermore, the pricing API `/api/products/:id/price` is strictly guarded:
  1. Requests without authorization return `401 Unauthorized`.
  2. Obtaining authorization requires passing a client-side challenge: WebAssembly execution, SHA-256 proof-of-work, canvas/WebGL fingerprinting, and mouse trajectory attestation.
  3. The pricing data returned over the wire is encrypted ciphertext decrypted in memory by the React app.
  4. The page requires user interaction: mouse hover movements across the price block exceeding 600ms dwell time before the "Reveal price" button is enabled.
  5. The store randomly drops clicks (17.5% chance) and introduces simulated 429/upstream retry delays.
- Therefore, **Playwright is genuinely required** to execute the page's client-side runtime, interact naturally with the DOM, and extract live pricing. Playwright also fulfills the explicit **Observable Headed Run** requirement (`npm run scraper:headed`) for video demonstration.

---

## 2. Store Interaction & Decoy Element Immunity

The mock store intentionally injects traps designed to break naive web scrapers:

1. **Decoy Price Elements**:
   - Two fake price elements are injected into `.price-main` with `style="display:none"`:
     `<span class="price-value" aria-hidden="true" style="display:none">` and `<span class="amount" data-price="true" aria-hidden="true" style="display:none">`.
   - Naive selectors querying `.price-value` or `[data-price="true"]` extract incorrect prices.
   - **Solution**: Our extractor evaluates computed styles (`window.getComputedStyle(el).display !== 'none'` and `visibility !== 'hidden'`), filtering out all hidden decoy elements.
2. **MRP Strikethrough**:
   - The original MRP is styled with `text-decoration: line-through`.
   - **Solution**: The extractor explicitly ignores elements whose computed `textDecorationLine` contains `line-through`.
3. **Split Price Carrier & Formatting**:
   - The store injects zero-width spaces (`\u200B`), non-breaking spaces (`\u00A0`), and Indian Rupee formatting (`₹`, `Rs.`).
   - **Solution**: `sanitizePriceText` strips all invisible Unicode characters, removes currency prefixes, and normalizes standard decimal numbers.
4. **Click-Drop Resilience**:
   - The click handler on "Reveal price" drops clicks ~17.5% of the time.
   - **Solution**: `storeInteraction.js` checks if the `.price-idle` class persists after 1.2s; if so, it automatically re-clicks the button.
5. **Intrusive Cookie Consent**:
   - A cookie overlay randomly appears, disabling body scrolling and intercepting clicks.
   - **Solution**: `storeInteraction.js` detects `.cookie-overlay` and dismisses it prior to interacting with the price container.

---

## 3. Retry Strategy & Timeout Handling

- **Maximum Attempts**: 3 attempts per scrape job.
- **Exponential Backoff**: If an attempt fails due to a slow response, timeout, or store error, the runner sleeps for `2^(attempt - 1) * 1000` ms (1s after attempt 1, 2s after attempt 2).
- **Timeouts**:
  - Page navigation: 20 seconds (`domcontentloaded`).
  - Price block discovery: 10 seconds.
  - Hover & button unlock: 6 seconds.
  - Price transition: 15 seconds.
- **Lifecycle Guarantees**: A `finally` block ensures that Playwright browser pages and contexts are strictly closed after each attempt, preventing memory leaks on resource-constrained servers.

---

## 4. Validation & Non-Pollution Guarantee

A core evaluation criterion is: *"never save empty, malformed, or obviously invalid price/stock data. If scraping fails after retries, record the failure honestly and do not overwrite good historical data with bad data."*

- **Validation Rules** (`dataValidator.js`):
  - Price must be a finite, positive number (`> 0`).
  - Stock must be a non-negative integer (`>= 0`).
  - Empty strings, `null`, `undefined`, `NaN`, and negative numbers are rejected.
- **Transactional Discipline**:
  - `price_history` is written **only** after extracted data passes strict validation.
  - If an attempt fails, it is recorded as `retried` or `failed` in `scrape_logs`.
  - On permanent failure, **zero records are written to `price_history`**, and the existing product record retains its last known valid price and stock.

---

## 5. Free-Tier Sleeping Backend Architecture

Free-tier hosting platforms like **Render.com** put web services to sleep after 15 minutes of inactivity. An in-process timer (`setInterval` or `node-cron`) ceases execution when the container is suspended.

### Solution: External Cron Service Trigger
- We trigger scheduled scrapes via an external HTTP request from **cron-job.org** configured to hit `POST /api/scrape/trigger` every 2 hours.
- Incoming HTTP requests automatically wake up the sleeping Render instance.
- **Security**: The trigger endpoint is protected by `Authorization: Bearer <CRON_SECRET>`. Unauthenticated requests receive `401 Unauthorized`.
- **Memory Conservation**: Batch scrapes iterate through active products **sequentially** rather than opening multiple concurrent browser instances, keeping peak memory consumption well under Render's 512MB limit.

---

## 6. What AI Tools Initially Got Wrong and How It Was Corrected

During initial development, common automated assumptions failed against this mock storefront:

1. **Assumption: Static HTML Scraping with Cheerio / Axios**:
   - *AI Mistake*: Initial analysis assumed product pages could be scraped via simple HTTP GET and HTML parsing.
   - *Reality*: The store is a client-side React SPA where static HTML contains only `<div id="root"></div>`.
   - *Correction*: Tested HTTP fetching first; proved it returns empty shells; switched to Playwright for browser-side rendering.
2. **Assumption: Directly Scraping `.price-value` or `[data-price="true"]`**:
   - *AI Mistake*: AI suggested querying `document.querySelector('.price-value')` or `[data-price="true"]`.
   - *Reality*: The store authors specifically created hidden decoy spans with `.price-value` and `[data-price="true"]` containing fake numbers!
   - *Correction*: Inspected the actual component code, added computed visibility checks, and matched the prominent font-size element with zero-width space sanitization.
3. **Assumption: Single Click on "Reveal price"**:
   - *AI Mistake*: AI assumed clicking the button once would always initiate loading.
   - *Reality*: The store code includes an intentional random drop (`Math.random() < 0.35 && Math.random() < 0.5`) that silently drops clicks ~17.5% of the time.
   - *Correction*: Added a state check after 1.2s to detect if the block remained in `price-idle`, automatically re-triggering the click.
4. **Assumption: Blocking API on Product Creation**:
   - *AI Mistake*: Calling the Playwright scraper inside `POST /api/tracked-products` before returning the response.
   - *Reality*: A full Playwright navigation takes 2-5 seconds, causing HTTP timeouts on frontend callers.
   - *Correction*: Persists the product immediately, returns `201 Created`, and executes the initial scrape asynchronously in the background.

---

## 7. Trade-offs Made

- **Playwright Resource Overhead vs. Scraper Reliability**:
  - Running Chromium consumes ~100MB of RAM. While lightweight HTTP is faster, it cannot run the store's WebAssembly challenges or client-side decryption. Reliability and adherence to the assignment's core requirements took absolute priority.
- **Sequential vs. Parallel Batch Scraping**:
  - Scraping products sequentially takes slightly longer for large lists, but ensures strict compliance with free-tier 512MB RAM limits and prevents server crashes.

