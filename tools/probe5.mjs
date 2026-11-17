import { chromium } from 'playwright-core';
const exe = `${process.env.HOME}/Library/Caches/ms-playwright/chromium-1254/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing`;
const browser = await chromium.launch({ executablePath: exe, args: ['--use-angle=metal','--enable-gpu','--ignore-gpu-blocklist'], headless: true });
const page = await browser.newPage({ viewport: { width: 1180, height: 776 }, deviceScaleFactor: 1 });
page.on('pageerror', e => console.log('ERR', e.message.slice(0,300)));
await page.goto('http://localhost:5199/?ui=0&fixed=1', { waitUntil: 'networkidle' });
await page.waitForTimeout(2200);
console.log(await page.evaluate(() => {
  const w = window.__theatre;
  const out = [];
  w.scene.traverse(o => { if (o.isLight) out.push({ type: o.type, i: o.intensity, p: o.position.toArray().map(v=>+v.toFixed(2)), t: o.target ? o.target.position.toArray().map(v=>+v.toFixed(2)) : null, angle: o.angle, dist: o.distance, decay: o.decay }); });
  return out;
}));
await page.evaluate(() => {
  const w = window.__theatre;
  w.theatre.update = () => {};
  w.scene.traverse(o => { if (o.isLight) o.intensity = 0; });
  // isolate the apron spotlight (index 11)
  const lights = []; w.scene.traverse(o => { if (o.isLight) lights.push(o); });
  lights[11].intensity = 400;
});
await page.waitForTimeout(500);
await page.screenshot({ path: 'shots/lt_apron.png', timeout: 90000 });
await page.evaluate(() => {
  const w = window.__theatre;
  const lights = []; w.scene.traverse(o => { if (o.isLight) lights.push(o); });
  lights[11].intensity = 0;
  lights[12].intensity = 30; // screen bounce point
});
await page.waitForTimeout(400);
await page.screenshot({ path: 'shots/lt_bounce.png', timeout: 90000 });
await browser.close();
