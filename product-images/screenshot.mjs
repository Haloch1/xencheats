import { chromium } from 'playwright';
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const htmlPath = path.join(__dirname, 'generator.html');

async function run() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 800, height: 800 },
    deviceScaleFactor: 4,
  });
  const page = await context.newPage();

  // Load the page once
  await page.goto(`file:///${htmlPath.replace(/\\/g, '/')}?i=0`);
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(2000); // wait for fonts

  const products = await page.evaluate(() => window.PRODUCTS);

  for (let i = 0; i < products.length; i++) {
    await page.evaluate((idx) => window.applyProduct(idx), i);
    await page.waitForTimeout(300);

    const canvas = page.locator('#canvas');
    await canvas.screenshot({
      path: path.join(__dirname, `${products[i].slug}.png`),
      type: 'png',
    });

    console.log(`[${i + 1}/${products.length}] ${products[i].slug}.png`);
  }

  await browser.close();
  console.log('Done!');
}

run().catch(console.error);
