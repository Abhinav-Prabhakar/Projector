import { chromium } from 'playwright-core';
const exe = `${process.env.HOME}/Library/Caches/ms-playwright/chromium-1254/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing`;
const browser = await chromium.launch({ executablePath: exe, args: ['--use-angle=metal','--enable-gpu','--ignore-gpu-blocklist'], headless: true });
for (const [name, p] of JSON.parse(process.env.CASES)) {
  const page = await browser.newPage({ viewport: { width: 1180, height: 776 }, deviceScaleFactor: 1 });
  page.on('pageerror', e => console.log('ERR', e.message.slice(0,300)));
  await page.goto('http://localhost:5199/?ui=0&fixed=1', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2600);
  await page.evaluate((p) => { Object.assign(window.__theatre.live, p); Object.assign(window.__theatre.target, p); }, p);
  await page.waitForTimeout(900);
  await page.screenshot({ path: `shots/p_${name}.png`, timeout: 90000 });
  await page.close();
}
await browser.close();
