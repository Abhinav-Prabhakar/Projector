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
  w.theatre.room.group.traverse(o => {
    if (!o.isMesh) return;
    const b = new (o.geometry.boundingBox ? Object : Object)();
    o.geometry.computeBoundingBox();
    const bb = o.geometry.boundingBox;
    out.push({ geo: o.geometry.type, w: (bb.max.x-bb.min.x).toFixed(2), h: (bb.max.y-bb.min.y).toFixed(2), d: (bb.max.z-bb.min.z).toFixed(2), pos: o.position.toArray().map(v=>+v.toFixed(2)), mat: o.material.type, color: o.material.color && o.material.color.getHexString() });
  });
  return out.filter(o => o.h < 1 && o.w > 5);
}));
await page.evaluate(() => {
  const w = window.__theatre;
  w.theatre.room.group.traverse(o => {
    if (!o.isMesh) return;
    if (o.material && o.material.color && o.material.color.getHexString() === 'e6dfc4') {
      o.material.emissive = new (o.material.emissive.constructor)(0xff0000);
      o.material.emissiveIntensity = 1;
      o.material.needsUpdate = true;
    }
  });
});
await page.waitForTimeout(500);
await page.screenshot({ path: 'shots/probe_floorred.png', timeout: 90000 });
await browser.close();
