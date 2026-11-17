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
  const l = lights[11];
  return { type: l.type, pos: l.position.toArray(), tw: l.target.position.toArray(), inScene: !!l.parent, tInScene: !!l.target.parent, angle: l.angle, penumbra: l.penumbra, decay: l.decay, distance: l.distance, layers: l.layers.mask, visible: l.visible, castShadow: l.castShadow };
}));
await page.evaluate(() => {
  const w = window.__theatre;
  w.theatre.update = () => {};
  w.scene.traverse(o => { if (o.isLight) o.intensity = 0; });
  const THREE = window.__theatre.renderer.constructor;
  const lights = []; w.scene.traverse(o => { if (o.isLight) lights.push(o); });
  const l = lights[11];
  // clone as a point light at the same spot
  const p = l.clone();
  p.isSpotLight = false;
  p.type = 'PointLight';
  p.intensity = 2000;
  p.distance = 0;
  p.decay = 1;
  w.scene.add(p);
});
await page.waitForTimeout(500);
await page.screenshot({ path: 'shots/probe_point.png', timeout: 90000 });
await browser.close();
