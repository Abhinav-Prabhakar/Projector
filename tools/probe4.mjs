import { chromium } from 'playwright-core';
const exe = `${process.env.HOME}/Library/Caches/ms-playwright/chromium-1254/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing`;
const browser = await chromium.launch({ executablePath: exe, args: ['--use-angle=metal','--enable-gpu','--ignore-gpu-blocklist'], headless: true });
const cases = JSON.parse(process.env.CASES);
for (const [name, kind] of cases) {
  const page = await browser.newPage({ viewport: { width: 1180, height: 776 }, deviceScaleFactor: 1 });
  page.on('pageerror', e => console.log('ERR', e.message.slice(0,300)));
  await page.goto('http://localhost:5199/?ui=0&fixed=1', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2200);
  await page.evaluate((kind) => {
    const w = window.__theatre;
    w.theatre.update = () => {};
    w.scene.traverse(o => { if (!o.isLight) return; if (kind === 'all' || o.type === kind) o.intensity = 0; });
  }, kind);
  await page.waitForTimeout(500);
  await page.screenshot({ path: `shots/lt_${name}.png`, timeout: 90000 });
  await page.close();
}
await browser.close();
