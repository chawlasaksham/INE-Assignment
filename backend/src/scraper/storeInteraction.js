const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function dismissCookieIfPresent(page) {
  for (let i = 0; i < 5; i++) {
    try {
      const overlay = await page.$('.cookie-overlay');
      if (!overlay) break;

      const acceptBtn = await page.$('.cookie-overlay button.btn-primary, button[aria-label="Accept cookies"]');
      if (acceptBtn && (await acceptBtn.isVisible())) {
        console.log(`[Interaction] Auto-dismissing cookie overlay (click ${i + 1})...`);
        await acceptBtn.click();
        await sleep(300);
      } else {
        break;
      }
    } catch (err) {
      break;
    }
  }
}

async function interactAndRevealPrice(page, targetUrl, options = {}) {
  const timeout = options.timeout || 30000;
  console.log(`[Interaction] Navigating to: ${targetUrl}`);
  await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout });

  try {
    if (typeof page.addLocatorHandler === 'function') {
      await page.addLocatorHandler(
        page.locator('.cookie-overlay'),
        async (overlay) => {
          const btn = overlay.locator('button.btn-primary, button:has-text("Accept")');
          if (await btn.isVisible()) {
            console.log('[Interaction] Auto-handler: Dismissing cookie overlay...');
            await btn.click();
          }
        }
      );
    }
  } catch (_) {}

  await dismissCookieIfPresent(page);

  const priceBlock = await page.waitForSelector('.price-block', { timeout: 10000 });
  if (!priceBlock) {
    throw new Error('Could not find .price-block element on product page');
  }

  await priceBlock.scrollIntoViewIfNeeded();
  await sleep(200);

  if (await page.$('.price-block.price-success')) {
    return { success: true };
  }

  const box = await priceBlock.boundingBox();
  if (!box) {
    throw new Error('Unable to get bounding box for .price-block');
  }

  const centerX = box.x + box.width / 2;
  const centerY = box.y + box.height / 2;

  console.log('[Interaction] Performing automated hover and dwell over price area...');
  await page.mouse.move(centerX - 40, centerY - 10);

  for (let i = 1; i <= 16; i++) {
    const offsetX = (i % 2 === 0 ? 1 : -1) * (i * 3);
    const offsetY = (i % 3 === 0 ? 1 : -1) * (i * 2);
    await page.mouse.move(centerX + offsetX, centerY + offsetY);
    await sleep(75);

    if (i === 8 || i === 14) {
      await dismissCookieIfPresent(page);
    }
  }

  console.log('[Interaction] Waiting for "Reveal price" button to enable...');
  const revealBtnSelector = '.price-block button.btn-primary, button[aria-label="Reveal price"]';
  let revealBtn = null;
  const unlockStart = Date.now();

  while (Date.now() - unlockStart < 12000) {
    await dismissCookieIfPresent(page);

    const btn = await page.$(revealBtnSelector);
    if (btn) {
      const isDisabled = await btn.getAttribute('disabled');
      if (isDisabled === null) {
        revealBtn = btn;
        break;
      }
    }

    await page.mouse.move(centerX + (Math.random() * 20 - 10), centerY + (Math.random() * 20 - 10));
    await sleep(250);
  }

  if (!revealBtn) {
    throw new Error('Reveal price button did not become enabled after hover dwell');
  }

  console.log('[Interaction] Automatically clicking "Reveal price"...');
  let clicked = false;
  const clickStart = Date.now();

  while (Date.now() - clickStart < 15000) {
    await dismissCookieIfPresent(page);

    const isSuccess = await page.$('.price-block.price-success');
    if (isSuccess) return { success: true };

    const isLoading = await page.$('.price-block [aria-busy="true"], .price-block .spinner, .price-block.price-error');
    if (isLoading) {
      clicked = true;
      break;
    }

    const btn = await page.$(revealBtnSelector);
    if (btn && (await btn.isVisible())) {
      const isDisabled = await btn.getAttribute('disabled');
      if (isDisabled === null) {
        console.log('[Interaction] Clicking "Reveal price" button...');
        await btn.click({ force: true }).catch(() => {});
      }
    }

    await sleep(700);
  }

  const maxWaitMs = 18000;
  const pollStart = Date.now();

  while (Date.now() - pollStart < maxWaitMs) {
    await dismissCookieIfPresent(page);

    const successEl = await page.$('.price-block.price-success');
    if (successEl) {
      console.log('[Interaction] Price and stock successfully revealed!');
      await sleep(200);
      return { success: true };
    }

    const errorEl = await page.$('.price-block.price-error');
    if (errorEl) {
      console.log('[Interaction] Store entered price-error state, automatically clicking "Try again"...');
      const tryAgainBtn = await page.$('.price-block.price-error button.btn-primary');
      if (tryAgainBtn) {
        await tryAgainBtn.click().catch(() => {});
        await sleep(1000);
      }
    }

    await sleep(300);
  }

  throw new Error(`Timed out waiting for price-success state after ${maxWaitMs}ms`);
}

module.exports = {
  interactAndRevealPrice,
  dismissCookieIfPresent
};
