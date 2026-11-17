import { chromium } from 'playwright-core';
const exe = `${process.env.HOME}/Library/Caches/ms-playwright/chromium-1254/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing`;
const browser = await chromium.launch({ executablePath: exe, args: ['--use-angle=metal','--enable-gpu','--ignore-gpu-blocklist'], headless: true });
const page = await browser.newPage({ viewport: { width: 1600, height: 1052 }, deviceScaleFactor: 1 });
page.on('pageerror', e => console.log('ERR', e.message.slice(0,300)));
await page.goto('http://localhost:5199/?ui=0&fixed=1', { waitUntil: 'networkidle' });
await page.waitForTimeout(3500);
await page.screenshot({ path: 'docs/hero.png', timeout: 120000 });
// lighting variations for the gallery
const shots = [
  ['screen-on', { screen: 1, stage: 1, beam: 0.42 }],
  ['screen-off', { screen: 0, stage: 0.3, house: 0.25, cove: 0.9, beam: 0 }],
  ['houselights', { screen: 0.15, stage: 1, house: 2.2, cove: 1.5, beam: 0.06 }],
];
for (const [name, p] of shots) {
  await page.evaluate((p) => { Object.assign(window.__theatre.target, p); }, p);
  await page.waitForTimeout(2600);
  await page.screenshot({ path: `docs/${name}.png`, timeout: 120000 });
}
// sway frames -> gif
await page.evaluate(() => { Object.assign(window.__theatre.target, { screen: 1, stage: 1, house: 0.9, cove: 0.8, beam: 0.24 }); });
await page.waitForTimeout(2400);
for (let i = 0; i < 14; i++) {
  await page.waitForTimeout(380);
  await page.screenshot({ path: `shots/sway_${String(i).padStart(2, '0')}.png`, timeout: 120000 });
}
// ui
await page.goto('http://localhost:5199/?fixed=1', { waitUntil: 'networkidle' });
await page.waitForTimeout(3000);
await page.screenshot({ path: 'docs/ui.png', timeout: 120000 });
await browser.close();
console.log('gallery done');
