import { chromium } from 'playwright-core';

/* Render arbitrary lighting variants at gallery resolution.
   MOODS='[["name",{"screen":0.02,"house":0.4}]]' node tools/mood.mjs  */

const exe = `${process.env.HOME}/Library/Caches/ms-playwright/chromium-1254/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing`;
const browser = await chromium.launch({ executablePath: exe, args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'], headless: true });
const page = await browser.newPage({ viewport: { width: 1600, height: 1052 }, deviceScaleFactor: 1 });
page.on('pageerror', (e) => console.log('ERR', e.message.slice(0, 200)));
await page.goto('http://localhost:5199/?ui=0&fixed=1', { waitUntil: 'networkidle' });
await page.waitForTimeout(3500);

const moods = JSON.parse(process.env.MOODS);
for (const [name, params] of moods) {
  await page.evaluate((p) => { Object.assign(window.__theatre.target, p); }, params);
  await page.waitForTimeout(2600);
  await page.screenshot({ path: `docs/${name}.png`, timeout: 120000 });
}
await browser.close();
console.log('mood done');
