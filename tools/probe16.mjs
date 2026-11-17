import { chromium } from 'playwright-core';
const exe = `${process.env.HOME}/Library/Caches/ms-playwright/chromium-1254/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing`;
const browser = await chromium.launch({ executablePath: exe, args: ['--use-angle=metal','--enable-gpu','--ignore-gpu-blocklist'], headless: true });
const page = await browser.newPage({ viewport: { width: 1180, height: 776 }, deviceScaleFactor: 1 });
page.on('pageerror', e => console.log('ERR', e.message.slice(0,300)));
await page.goto('http://localhost:5199/?ui=0&fixed=1', { waitUntil: 'networkidle' });
await page.waitForTimeout(2500);
console.log(JSON.stringify(await page.evaluate(() => {
  const w = window.__theatre;
  const THREE = w.THREE;
  let face = null;
  w.theatre.room.group.traverse(o => { if (o.userData.exitMat && o.position.x < 0) face = o; });
  const target = face.getWorldPosition(new THREE.Vector3());
  const dir = target.clone().sub(w.camera.position).normalize();
  const rc = new THREE.Raycaster(w.camera.position.clone(), dir, 0.1, 60);
  w.scene.updateMatrixWorld(true);
  const meshes = []; w.scene.traverse(o => { if (o.isMesh) meshes.push(o); });
  const hits = rc.intersectObjects(meshes, false).slice(0, 6).map(h => ({
    d: +h.distance.toFixed(2), type: h.object.type, geo: h.object.geometry && h.object.geometry.type,
    mat: h.object.material && h.object.material.type, col: h.object.material && h.object.material.color && h.object.material.color.getHexString(),
    pos: h.object.position.toArray().map(v=>+v.toFixed(2)), exit: !!h.object.userData.exitMat
  }));
  return hits;
}), null, 1));
await browser.close();
