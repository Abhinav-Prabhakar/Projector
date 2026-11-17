import { chromium } from 'playwright-core';
const exe = `${process.env.HOME}/Library/Caches/ms-playwright/chromium-1254/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing`;
const browser = await chromium.launch({ executablePath: exe, args: ['--use-angle=metal','--enable-gpu','--ignore-gpu-blocklist'], headless: true });
const page = await browser.newPage({ viewport: { width: 1180, height: 776 }, deviceScaleFactor: 1 });
page.on('pageerror', e => console.log('ERR', e.message.slice(0,300)));
await page.goto('http://localhost:5199/?ui=0&fixed=1', { waitUntil: 'networkidle' });
await page.waitForTimeout(2200);
console.log(JSON.stringify(await page.evaluate(() => {
  const w = window.__theatre;
  let info = null;
  w.theatre.room.group.traverse(o => {
    if (o.isMesh && o.material && o.material.color && o.material.color.getHexString() === 'e6dfc4' && o.geometry.type === 'BoxGeometry') {
      const n = o.geometry.attributes.normal, p = o.geometry.attributes.position;
      const tops = [];
      for (let i = 0; i < p.count; i++) if (p.getY(i) > 0.05) tops.push([n.getX(i).toFixed(2), n.getY(i).toFixed(2), n.getZ(i).toFixed(2)]);
      info = { count: tops.length, first: tops.slice(0, 6), side: o.material.side, scale: o.scale.toArray(), matrix: o.matrixWorld.elements.map(v => +v.toFixed(3)) };
    }
  });
  return info;
}), null, 1));
await page.evaluate(() => {
  const w = window.__theatre;
  const lights = []; w.scene.traverse(o => { if (o.isLight) lights.push(o); });
  const l = lights[11];
  w.theatre.update = () => {};
  w.scene.traverse(o => { if (o.isLight) o.intensity = 0; });
  l.intensity = 300; l.angle = 1.4; l.distance = 0; l.decay = 0;
  w.theatre.room.group.traverse(o => {
    if (o.isMesh && o.material && o.material.color && o.material.color.getHexString() === 'e6dfc4' && o.geometry.type === 'BoxGeometry') {
      o.material.side = 2; o.material.needsUpdate = true;
    }
  });
});
await page.waitForTimeout(500);
await page.screenshot({ path: 'shots/probe_side.png', timeout: 90000 });
await browser.close();
