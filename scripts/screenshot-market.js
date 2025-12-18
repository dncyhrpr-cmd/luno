const puppeteer = require('puppeteer');

(async () => {
  const url = process.env.URL || 'http://localhost:3001/';
  const screenshotPath = 'out/market-screenshot.png';

  const browser = await puppeteer.launch({ args: ['--no-sandbox','--disable-setuid-sandbox'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900 });

  console.log('Navigating to', url);
  await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });

  // Wait until either a canvas or the Market heading is present
  try {
    await page.waitForSelector('canvas, h1', { timeout: 15000 });
  } catch (e) {
    // continue even if selector not found; we'll still screenshot
    console.warn('Selector not found within timeout, taking full page screenshot anyway');
  }

  // Try to focus chart area, fallback to full page screenshot
  try {
    const h1Handle = await page.$x("//h1[contains(., 'Live Trading')]");
    if (h1Handle && h1Handle.length > 0) {
      const parent = await (await h1Handle[0].getProperty('parentElement')).asElement();
      if (parent) {
        const box = await parent.boundingBox();
        if (box) {
          // enlarge clip a bit for padding
          const clip = {
            x: Math.max(0, box.x - 10),
            y: Math.max(0, box.y - 10),
            width: Math.min(box.width + 20, 1280),
            height: Math.min(box.height + 20, 900)
          };
          await page.screenshot({ path: screenshotPath, clip });
          console.log('Saved chart-area screenshot to', screenshotPath);
          await browser.close();
          process.exit(0);
        }
      }
    }
  } catch (err) {
    // ignore and fall back
  }

  // Fallback: full page
  await page.screenshot({ path: screenshotPath, fullPage: true });
  console.log('Saved full-page screenshot to', screenshotPath);

  await browser.close();
  process.exit(0);
})();
