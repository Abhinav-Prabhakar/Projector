import { chromium } from 'playwright-core';
const exe = `${process.env.HOME}/Library/Caches/ms-playwright/chromium-1254/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing`;
const browser = await chromium.launch({ executablePath: exe, args: ['--use-angle=metal','--enable-gpu','--ignore-gpu-blocklist'], headless: true });
const page = await browser.newPage({ viewport: { width: 1180, height: 776 }, deviceScaleFactor: 1 });
page.on('pageerror', e => console.log('ERR', e.message.slice(0,300)));
await page.goto('http://localhost:5199/?ui=0&fixed=1', { waitUntil: 'networkidle' });
await page.waitForTimeout(2200);
console.log(await page.evaluate(() => {
  const w = window.__theatre;
  const lights = []; w.scene.traverse(o => { if (o.isLight) lights.push(o); });
  const AmbientCtor = lights.find(l => l.type === 'HemisphereLight').constructor;
  w.theatre.update = () => {};
  w.scene.traverse(o => { if (o.isLight) o.intensity = 0; });
  // pure ambient test
  const a = new AmbientCtor(0xffffff, 3);
  w.scene.add(a);
  return { added: true };
}));
await page.waitForTimeout(500);
await page.screenshot({ path: 'shots/probe_amb.png', timeout: 90000 });
await browser.close();
