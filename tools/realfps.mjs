import { chromium } from 'playwright-core';

/* Real-window frame rate check with optional ablations. Headless throttles rAF,
   so this opens a window, applies each case's mutation and samples the HUD.
   URL=... SIZE=1600x1052 CASES=base,dof0,lights12 node tools/realfps.mjs  */

const exe = `${process.env.HOME}/Library/Caches/ms-playwright/chromium-1254/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing`;
const url = process.env.URL || 'http://localhost:5199/';
const [W, H] = (process.env.SIZE || '1600x1052').split('x').map(Number);

const MUT = {
  base: '',
  dof0: `w.target.dof = 0; w.live.dof = 0;`,
  bloom0: `w.target.bloom = 0; w.live.bloom = 0;`,
  noPost: `const r = w.renderer; w.post.render = (s, c) => { r.setRenderTarget(null); r.render(s, c); };`,
  noShadow: `w.renderer.shadowMap.enabled = false; w.scene.traverse(o => { if (o.isLight) o.castShadow = false; });`,
  noSeats: `w.theatre.seating.visible = false;`,
  lights10: `const ls = []; w.scene.traverse(o => { if (o.isLight) ls.push(o); }); ls.slice(10).forEach(l => l.parent && l.parent.remove(l));`,
  dpr075: `w.renderer.setPixelRatio(0.75); w.post.setSize(Math.round(${W} * 0.75), Math.round(${H} * 0.75));`,
  flat: `w.scene.traverse(o => { if (o.isMesh && o.material && o.material.isMeshPhysicalMaterial) { const m = o.material; m.sheen = 0; m.clearcoat = 0; m.needsUpdate = true; } });`,
};

const cases = (process.env.CASES || 'base').split(',');

const browser = await chromium.launch({
  executablePath: exe,
  headless: false,
  args: [
    '--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', `--window-size=${W},${H}`,
    ...(process.env.UNCAPPED ? ['--disable-gpu-vsync', '--disable-frame-rate-limit'] : []),
  ],
});
const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
await page.bringToFront();

for (const name of cases) {
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.waitForTimeout(3000);
  if (MUT[name]) await page.evaluate((code) => { const w = window.__theatre; eval(code); }, MUT[name]);
  await page.waitForTimeout(1500);
  const vals = [];
  for (let i = 0; i < 8; i++) {
    await page.waitForTimeout(400);
    vals.push(parseInt(await page.evaluate(() => document.getElementById('fps').textContent), 10) || 0);
  }
  vals.sort((a, b) => a - b);
  const res = await page.evaluate(() => document.getElementById('res').textContent);
  console.log(`${name.padEnd(9)} ${res.padEnd(10)} median ${String(vals[4]).padStart(3)}  max ${String(vals[7]).padStart(3)}  [${vals.join(',')}]`);
  if (process.env.OUT && name === 'base') await page.screenshot({ path: process.env.OUT, timeout: 120000 });
}
await browser.close();
