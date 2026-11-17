import { chromium } from 'playwright-core';
const exe = `${process.env.HOME}/Library/Caches/ms-playwright/chromium-1254/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing`;
const browser = await chromium.launch({ executablePath: exe, args: ['--use-angle=metal','--enable-gpu','--ignore-gpu-blocklist'], headless: true });
const page = await browser.newPage({ viewport: { width: 1180, height: 776 }, deviceScaleFactor: 1 });
page.on('pageerror', e => console.log('ERR', e.message.slice(0,300)));
await page.goto('http://localhost:5199/?ui=0&fixed=1&raw=1', { waitUntil: 'networkidle' });
await page.waitForTimeout(3000);
await page.evaluate(() => {
  const w = window.__theatre;
  w.rig.update = () => {};
  w.camera.position.set(0, 2.55, 6.2);
  w.camera.lookAt(0, 2.78, -15);
  const m = w.theatre.room.screenMat;
  m.emissiveMap = null; m.emissive.set(0xffffff); m.emissiveIntensity = 1;
  m.needsUpdate = true;
});
await page.waitForTimeout(500);
await page.screenshot({ path: 'shots/screen_flat.png', timeout: 90000 });
await browser.close();
