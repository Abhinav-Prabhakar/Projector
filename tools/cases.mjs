import { chromium } from 'playwright-core';
const exe = `${process.env.HOME}/Library/Caches/ms-playwright/chromium-1254/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing`;
const browser = await chromium.launch({ executablePath: exe, args: ['--use-angle=metal','--enable-gpu','--ignore-gpu-blocklist'], headless: true });
const page = await browser.newPage({ viewport: { width: 1180, height: 776 }, deviceScaleFactor: 1 });
page.on('pageerror', e => console.log('ERR', e.message.slice(0,300)));
await page.goto('http://localhost:5199/?ui=0&fixed=1', { waitUntil: 'networkidle' });
await page.waitForTimeout(2600);
await page.evaluate(() => {
  const w = window.__theatre;
  const L = []; w.scene.traverse(o => { if (o.isLight) L.push(o); });
  window.__L = L;
  window.__P = w.post;
});
for (const [name, body] of JSON.parse(process.env.CASES)) {
  try { await page.evaluate(new Function('const W=window.__theatre, L=window.__L, P=window.__P;' + body)); }
  catch (e) { console.log('CASE ERR', name, e.message.slice(0,200)); }
  await page.waitForTimeout(420);
  await page.screenshot({ path: `shots/c_${name}.png`, timeout: 90000 });
}
await browser.close();
