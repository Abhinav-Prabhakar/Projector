import { chromium } from 'playwright-core';
const exe = `${process.env.HOME}/Library/Caches/ms-playwright/chromium-1254/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing`;
const browser = await chromium.launch({ executablePath: exe, args: ['--use-angle=metal','--enable-gpu','--ignore-gpu-blocklist'], headless: true });
const page = await browser.newPage({ viewport: { width: 1180, height: 776 }, deviceScaleFactor: 1 });
page.on('pageerror', e => console.log('ERR', e.message.slice(0,300)));
await page.goto('http://localhost:5199/?ui=0&fixed=1', { waitUntil: 'networkidle' });
await page.waitForTimeout(2600);
console.log(await page.evaluate(() => {
  const w = window.__theatre, THREE = w.THREE;
  const meshes = []; w.scene.traverse(o => { if (o.isMesh) meshes.push(o); });
  w.scene.updateMatrixWorld(true);
  const out = [];
  for (let f = 0.46; f < 0.62; f += 0.01) {
    const rc = new THREE.Raycaster();
    rc.setFromCamera(new THREE.Vector2(0, -(f * 2 - 1)), w.camera);
    const hits = rc.intersectObjects(meshes, false);
    const h = hits[0];
    out.push({ f: +f.toFixed(2), geo: h && h.object.geometry.type, col: h && h.object.material.color && h.object.material.color.getHexString(), pt: h && h.point.toArray().map(v => +v.toFixed(2)) });
  }
  return out;
}));
await browser.close();
