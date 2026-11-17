import { chromium } from 'playwright-core';
const exe = `${process.env.HOME}/Library/Caches/ms-playwright/chromium-1254/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing`;
const b = await chromium.launch({ executablePath: exe, args: ['--use-angle=metal','--enable-gpu','--ignore-gpu-blocklist'], headless: true });
const p = await b.newPage({ viewport: { width: 1600, height: 1052 }, deviceScaleFactor: 1 });
await p.goto(process.env.URL, { waitUntil: 'networkidle' });
await p.waitForTimeout(4000);
for (let i=0;i<3;i++){
  await p.waitForTimeout(1500);
  console.log('hud', await p.evaluate(() => ({ fps: document.getElementById('fps')?.textContent, res: document.getElementById('res')?.textContent, dpr: window.__theatre.renderer.getPixelRatio() })));
}
const gl = await p.evaluate(() => { const g = window.__theatre.renderer.getContext(); const d = g.getExtension('WEBGL_debug_renderer_info'); return d ? g.getParameter(d.UNMASKED_RENDERER_WEBGL) : 'n/a'; });
console.log('gpu', gl);
await b.close();
