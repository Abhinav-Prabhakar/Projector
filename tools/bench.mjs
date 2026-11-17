import { chromium } from 'playwright-core';

/* Ablation bench: measures rAF fps on the live page under one mutation at a time.
   URL=... node tools/bench.mjs  */

const exe = `${process.env.HOME}/Library/Caches/ms-playwright/chromium-1254/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing`;
const url = process.env.URL || 'http://localhost:5199/?ui=0&fixed=1';
const browser = await chromium.launch({ executablePath: exe, args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'], headless: true });
const page = await browser.newPage({ viewport: { width: 1600, height: 1052 }, deviceScaleFactor: 1 });
await page.goto(url, { waitUntil: 'networkidle' });
await page.waitForTimeout(4000);

const CASES = {
  base: '',
  noPost: `const w=__theatre; w.post.render=(s,c)=>{w.renderer.setRenderTarget(null); w.renderer.render(s,c);};`,
  noShadow: `const w=__theatre; w.renderer.shadowMap.enabled=false; w.scene.traverse(o=>{if(o.isLight)o.castShadow=false;});`,
  noSeats: `__theatre.theatre.seating.visible=false;`,
  noDrape: `const w=__theatre; w.scene.traverse(o=>{ if(o.material && o.material.uniforms && o.material.uniforms.uSway) o.visible=false; });`,
  lights8: `const w=__theatre; const ls=[]; w.scene.traverse(o=>{if(o.isLight)ls.push(o);}); ls.slice(8).forEach(l=>l.parent&&l.parent.remove(l));`,
  lowRes: `const w=__theatre; w.renderer.setPixelRatio(0.7); w.post.setSize(Math.round(1600*0.7), Math.round(1052*0.7));`,
  lowDof: `const w=__theatre; w.target.dof=0.0; w.live.dof=0.0;`,
};

for (const [name, code] of Object.entries(CASES)) {
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2500);
  if (code) await page.evaluate((c) => { eval(c); }, code);
  await page.waitForTimeout(1200);
  const fps = await page.evaluate(async () => {
    const el = document.getElementById('fps');
    const vals = [];
    for (let i = 0; i < 6; i++) {
      await new Promise((r) => setTimeout(r, 600));
      vals.push(parseInt(el.textContent, 10) || 0);
    }
    vals.sort((a, b) => a - b);
    return vals[3];
  });
  console.log(name.padEnd(9), fps);
}
await browser.close();
