import { chromium } from 'playwright-core';
const exe = `${process.env.HOME}/Library/Caches/ms-playwright/chromium-1254/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing`;
const browser = await chromium.launch({ executablePath: exe, args: ['--use-angle=metal','--enable-gpu','--ignore-gpu-blocklist'], headless: true });
const page = await browser.newPage({ viewport: { width: 1180, height: 776 }, deviceScaleFactor: 1 });
page.on('pageerror', e => console.log('ERR', e.message.slice(0,300)));
await page.goto('http://localhost:5199/?ui=0&fixed=1', { waitUntil: 'networkidle' });
await page.waitForTimeout(3000);
await page.evaluate(() => {
  const w = window.__theatre;
  w.rig.update = () => {};
  w.camera.position.set(-2, 4.5, -8);
  w.camera.lookAt(-6.5, 4.5, -13.7);
  w.camera.updateProjectionMatrix();
});
await page.waitForTimeout(400);
await page.screenshot({ path: 'shots/curtain.png', timeout: 60000 });
await browser.close();
