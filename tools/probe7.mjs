import { chromium } from 'playwright-core';
const exe = `${process.env.HOME}/Library/Caches/ms-playwright/chromium-1254/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing`;
const browser = await chromium.launch({ executablePath: exe, args: ['--use-angle=metal','--enable-gpu','--ignore-gpu-blocklist'], headless: true });
const page = await browser.newPage({ viewport: { width: 1180, height: 776 }, deviceScaleFactor: 1 });
page.on('pageerror', e => console.log('ERR', e.message.slice(0,300)));
await page.goto('http://localhost:5199/?ui=0&fixed=1', { waitUntil: 'networkidle' });
await page.waitForTimeout(2200);
await page.evaluate(() => {
  const w = window.__theatre;
  w.theatre.update = () => {};
  w.scene.traverse(o => { if (o.isLight) o.intensity = 0; });
  const lights = []; w.scene.traverse(o => { if (o.isLight) lights.push(o); });
  lights[11].intensity = 400;
  w.theatre.room.group.traverse(o => {
    if (o.isMesh && o.material && o.material.color && o.material.color.getHexString() === 'e6dfc4') {
      o.material.normalMap = null;
      o.material.map = null;
      o.material.roughnessMap = null;
      o.material.color.set(0xffffff);
      o.material.needsUpdate = true;
    }
  });
});
await page.waitForTimeout(500);
await page.screenshot({ path: 'shots/probe_floorflat.png', timeout: 90000 });
await browser.close();
