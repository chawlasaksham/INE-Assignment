function sanitizePriceText(rawText) {
  if (!rawText || typeof rawText !== 'string') return null;

  let clean = rawText
    .replace(/\u200B/g, '')
    .replace(/\u00A0/g, ' ')
    .replace(/[\r\n\t]+/g, ' ')
    .trim();

  clean = clean.replace(/[\uFF10-\uFF19]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xFF10 + 48));

  clean = clean.replace(/\/\-.*$/i, '').trim();

  clean = clean.replace(/^(₹|Rs\.?|INR|\$|€)\s*/i, '').trim();

  if (/\.\d{3},\d{2}$/.test(clean)) {
    clean = clean.replace(/\./g, '').replace(',', '.');
  } else {
    clean = clean.replace(/,/g, '').replace(/\s+/g, '');
  }

  const match = clean.match(/(\d+(?:\.\d+)?)/);
  if (!match) return null;

  const num = parseFloat(match[1]);
  return isNaN(num) ? null : num;
}

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

async function extractFromPage(page) {
  return await page.evaluate(() => {
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

    const priceMain = document.querySelector('.price-main');
    if (!priceMain) {
      return { success: false, error: 'Price container .price-main not found' };
    }

    const allSpans = Array.from(priceMain.querySelectorAll('output, span, div, p, strong, em'));
    
    let rawPriceText = '';
    let maxFontSize = 0;

    for (const span of allSpans) {
      if (!isVisible(span)) continue;

      const style = window.getComputedStyle(span);
      if (style.textDecorationLine.includes('line-through') || style.textDecoration.includes('line-through')) {
        continue;
      }

      const text = span.textContent || '';
      if (/% off/i.test(text) || /^Deal price/i.test(text) || /updating/i.test(text)) {
        continue;
      }

      if (/[0-9₹]/.test(text)) {
        const fontSize = parseFloat(style.fontSize) || 0;
        const textLen = text.trim().length;
        if (fontSize > maxFontSize || (fontSize === maxFontSize && textLen > rawPriceText.length)) {
          maxFontSize = fontSize;
          rawPriceText = text.trim();
        }
      }
    }

    if (!rawPriceText) {
      for (const span of allSpans) {
        if (!isVisible(span)) continue;
        const style = window.getComputedStyle(span);
        if (style.textDecorationLine.includes('line-through')) continue;
        const text = span.textContent || '';
        if (/[0-9]/.test(text) && !text.includes('%') && !text.includes('Deal price')) {
          rawPriceText = text.trim();
          break;
        }
      }
    }

    const stockBadge = document.querySelector('.stock-badge, .price-facets .stock-badge, [class*="stock"]');
    let rawStockText = stockBadge ? stockBadge.textContent.trim() : '';

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
      rawPriceText,
      rawStockText
    };
  });
}

module.exports = {
  sanitizePriceText,
  parseStockText,
  extractFromPage
};
