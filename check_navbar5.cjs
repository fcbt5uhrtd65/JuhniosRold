const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto('http://localhost:5173', { waitUntil: 'load' });
  await page.waitForTimeout(1500);
  const result = await page.evaluate(() => {
    const el = document.querySelector('[class*="rounded-\\[20px\\]"]');
    if (!el) return 'not found';
    const cs = getComputedStyle(el);
    return { className: el.className, bg: cs.backgroundColor, backdropFilter: cs.backdropFilter };
  });
  console.log(JSON.stringify(result, null, 2));
  await browser.close();
})();
