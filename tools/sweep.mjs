import { chromium } from 'playwright-core';
const exe = `${process.env.HOME}/Library/Caches/ms-playwright/chromium-1254/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing`;
const browser = await chromium.launch({ executablePath: exe, args: ['--use-angle=metal','--enable-gpu','--ignore-gpu-blocklist'], headless: true });
const page = await browser.newPage({ viewport: { width: 1180, height: 776 }, deviceScaleFactor: 1 });
page.on('pageerror', e => console.log('ERR', e.message.slice(0,300)));
await page.goto('http://localhost:5199/?ui=0&fixed=1', { waitUntil: 'networkidle' });
await page.waitForTimeout(2500);
await page.evaluate(() => {
  const w = window.__theatre;
  w.theatre.update = () => {};
  window.__L = [];
  w.scene.traverse(o => { if (o.isLight) window.__L.push(o); });
});
const cases = JSON.parse(process.env.CASES);
for (const [name, body] of cases) {
  await page.evaluate(new Function('try {' + body + '} catch (e) { console.log("case err", e.message); }'));
  await page.waitForTimeout(450);
  await page.screenshot({ path: `shots/sw_${name}.png`, timeout: 90000 });
}
await browser.close();
