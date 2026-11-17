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
  const PointCtor = lights[12].constructor;
  w.theatre.update = () => {};
  w.scene.traverse(o => { if (o.isLight) o.intensity = 0; });
  const p = new PointCtor(0xffeedd, 3000, 0, 1);
  p.position.set(0, 4.2, -9.5);
  w.scene.add(p);
  // report the floor mesh world normal
  let info = null;
  w.theatre.room.group.traverse(o => {
    if (o.isMesh && o.material && o.material.color && o.material.color.getHexString() === 'e6dfc4' && o.geometry.type === 'BoxGeometry') {
      o.geometry.computeVertexNormals();
      const n = o.geometry.attributes.normal;
      const pos = o.geometry.attributes.position;
      const arr = [];
      for (let i = 0; i < pos.count; i += 1) {
        if (pos.getY(i) > 0.05) arr.push([n.getX(i).toFixed(2), n.getY(i).toFixed(2), n.getZ(i).toFixed(2)]);
      }
      info = arr.slice(0, 4);
    }
  });
  return info;
}));
await page.waitForTimeout(500);
await page.screenshot({ path: 'shots/probe_pt.png', timeout: 90000 });
await browser.close();
