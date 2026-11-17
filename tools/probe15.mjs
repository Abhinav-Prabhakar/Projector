import { chromium } from 'playwright-core';
const exe = `${process.env.HOME}/Library/Caches/ms-playwright/chromium-1254/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing`;
const browser = await chromium.launch({ executablePath: exe, args: ['--use-angle=metal','--enable-gpu','--ignore-gpu-blocklist'], headless: true });
const page = await browser.newPage({ viewport: { width: 1180, height: 776 }, deviceScaleFactor: 1 });
page.on('pageerror', e => console.log('ERR', e.message.slice(0,300)));
await page.goto('http://localhost:5199/?ui=0&fixed=1', { waitUntil: 'networkidle' });
await page.waitForTimeout(2500);
console.log(JSON.stringify(await page.evaluate(() => {
  const w = window.__theatre;
  const THREE = w.scene.constructor;
  let face = null;
  w.theatre.room.group.traverse(o => { if (o.userData.exitMat && o.position.x < 0) face = o; });
  const target = face.getWorldPosition(new (face.position.constructor)());
  const dir = target.clone().sub(w.camera.position).normalize();
  // build raycaster via the Raycaster found in the renderer? use a light trick: manual raycaster through THREE from module
  const rc = new (w.rig && w.rig.raycaster ? w.rig.raycaster.constructor : Object)();
  return { target: target.toArray(), cam: w.camera.position.toArray() };
}), null, 1));
await browser.close();
