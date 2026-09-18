/**
 * Data Extractor
 * Extracts price and stock accurately from the DOM, filtering out
 * hidden decoy prices, strikethrough MRP, and formatting artifacts.
 */

/**
 * Sanitizes a price string by stripping zero-width spaces, currency symbols,
 * and normalizing number formats.
 */
function sanitizePriceText(rawText) {
  if (!rawText || typeof rawText !== 'string') return null;

  // 1. Strip zero-width spaces (\u200B), non-breaking spaces (\u00A0), and other invisible chars
  let clean = rawText
    .replace(/\u200B/g, '')
    .replace(/\u00A0/g, ' ')
    .replace(/[\r\n\t]+/g, ' ')
    .trim();

  // 2. Normalize full-width Unicode digits (0-9: \uFF10 - \uFF19) if present
  clean = clean.replace(/[\uFF10-\uFF19]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xFF10 + 48));

  // 3. Strip trailing markers like "/- (incl. of all taxes)" or "/-"
  clean = clean.replace(/\/\-.*$/i, '').trim();

  // 4. Remove currency prefixes / words
  clean = clean.replace(/^(₹|Rs\.?|INR|\$|€)\s*/i, '').trim();

  // 5. Detect European format (e.g. 12.499,00) vs Standard (12,499.00 or 12 499)
  if (/\.\d{3},\d{2}$/.test(clean)) {
    // 12.499,00 -> remove dot, replace comma with dot
    clean = clean.replace(/\./g, '').replace(',', '.');
  } else {
    // Standard format: remove commas and whitespace (e.g. 12,499 -> 12499, 12 499 -> 12499)
    clean = clean.replace(/,/g, '').replace(/\s+/g, '');
  }

  // 6. Match decimal or integer number
  const match = clean.match(/(\d+(?:\.\d+)?)/);
  if (!match) return null;

  const num = parseFloat(match[1]);
  return isNaN(num) ? null : num;
}

/**
 * Parses stock text into an integer count.
 * Handles "In stock · 12 left", "Only 4 left", "15 in stock", "Selling fast — 3 left", "Out of stock".
 */
function parseStockText(rawText) {
  if (!rawText || typeof rawText !== 'string') return null;

  const clean = rawText.trim();
  if (/out\s*of\s*stock/i.test(clean)) {
    return 0;
  }

  const match = clean.match(/\b(\d+)\b/);
  if (match) {
    return parseInt(match[1], 10);
  }

  return null;
}

/**
 * Executes inside Playwright page context to evaluate and return clean price/stock.
 */
async function extractFromPage(page) {
  return await page.evaluate(() => {
    // Helper to check if element is visible
    function isVisible(el) {
      if (!el) return !1;
      const style = window.getComputedStyle(el);
      if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') {
        return !1;
      }
      if (el.getAttribute('aria-hidden') === 'true' && el.style.display === 'none') {
        return !1;
      }
      return el.offsetWidth > 0 || el.offsetHeight > 0 || el.getClientRects().length > 0;
    }

    // 1. Locate price container
    const priceMain = document.querySelector('.price-main');
    if (!priceMain) {
      return { success: false, error: 'Price container .price-main not found' };
    }

    // 2. Find all direct/nested candidate elements inside priceMain
    const allSpans = Array.from(priceMain.querySelectorAll('span, div, p'));
    
    // Filter visible elements that are NOT strikethrough (MRP) and not discount badges / deal labels
    let realPriceText = '';
    let maxFontSize = 0;

    for (const span of allSpans) {
      if (!isVisible(span)) continue;

      const style = window.getComputedStyle(span);
      // Skip strikethrough MRP
      if (style.textDecorationLine.includes('line-through') || style.textDecoration.includes('line-through')) {
        continue;
      }

      const text = span.textContent || '';
      // Skip discount percentage badges, deal price prefix, or "Updating..."
      if (/% off/i.test(text) || /^Deal price/i.test(text) || /updating/i.test(text)) {
        continue;
      }

      // Check if this text contains a currency symbol or digits
      if (/[0-9₹]/.test(text)) {
        const fontSize = parseFloat(style.fontSize) || 0;
        const textLen = text.trim().length;
        // The real selling price has the prominent font size (2.4rem ~ 38px)
        // When characters are split across child spans, the parent element holds the full string
        if (fontSize > maxFontSize || (fontSize === maxFontSize && textLen > realPriceText.length)) {
          maxFontSize = fontSize;
          realPriceText = text.trim();
        }
      }
    }

    // Fallback: if no element matched font size heuristic, find the first visible text with currency/number
    if (!realPriceText) {
      for (const span of allSpans) {
        if (!isVisible(span)) continue;
        const style = window.getComputedStyle(span);
        if (style.textDecorationLine.includes('line-through')) continue;
        const text = span.textContent || '';
        if (/[0-9]/.test(text) && !text.includes('%') && !text.includes('Deal price')) {
          realPriceText = text.trim();
          break;
        }
      }
    }

    // 3. Locate stock
    const stockBadge = document.querySelector('.stock-badge, .price-facets .stock-badge, [class*="stock"]');
    let rawStockText = stockBadge ? stockBadge.textContent.trim() : '';

    // If stock badge wasn't found directly, look inside price-facets
    if (!rawStockText) {
      const facets = document.querySelector('.price-facets');
      if (facets) {
        const facetTexts = Array.from(facets.querySelectorAll('div, span'))
          .map((el) => el.textContent.trim())
          .filter((t) => /stock|left|selling/i.test(t));
        if (facetTexts.length > 0) {
          rawStockText = facetTexts[0];
        }
      }
    }

    return {
      success: true,
      rawPriceText: realPriceText,
      rawStockText
    };
  });
}

module.exports = {
  sanitizePriceText,
  parseStockText,
  extractFromPage
};
