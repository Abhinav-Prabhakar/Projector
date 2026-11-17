import { chromium } from 'playwright-core';
const exe = `${process.env.HOME}/Library/Caches/ms-playwright/chromium-1254/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing`;
const browser = await chromium.launch({ executablePath: exe, args: ['--use-angle=metal','--enable-gpu','--ignore-gpu-blocklist'], headless: true });
const page = await browser.newPage({ viewport: { width: 1180, height: 776 }, deviceScaleFactor: 1 });
page.on('pageerror', e => console.log('ERR', e.message.slice(0,300)));
await page.goto('http://localhost:5199/?ui=0&fixed=1', { waitUntil: 'networkidle' });
await page.waitForTimeout(2500);
console.log(JSON.stringify(await page.evaluate(() => {
  const w = window.__theatre;
  const out = [];
  w.theatre.room.group.traverse(o => {
    if (o.userData.exitMat) {
      const p = o.getWorldPosition(new o.position.constructor());
      const v = p.clone().project(w.camera);
      out.push({ pos: p.toArray().map(n=>+n.toFixed(2)), ndc: [ +v.x.toFixed(3), +v.y.toFixed(3), +v.z.toFixed(3) ], px: [ Math.round((v.x*0.5+0.5)*1180), Math.round((-v.y*0.5+0.5)*776) ], emis: o.material.emissiveIntensity, visible: o.visible, parentVisible: o.parent.visible });
    }
  });
  return out;
}), null, 1));
await browser.close();
