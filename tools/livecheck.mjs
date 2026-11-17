import { chromium } from 'playwright-core';

const url = process.env.URL || 'https://abhinav-prabhakar.github.io/Projector/?ui=0&fixed=1';
const out = process.env.OUT || 'shots/live.png';
const exe = `${process.env.HOME}/Library/Caches/ms-playwright/chromium-1254/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing`;
const browser = await chromium.launch({ executablePath: exe, args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'], headless: true });
const page = await browser.newPage({ viewport: { width: 1600, height: 1052 }, deviceScaleFactor: 1 });
const errs = [];
page.on('pageerror', (e) => errs.push(e.message.slice(0, 200)));
await page.goto(url, { waitUntil: 'networkidle' });
await page.waitForTimeout(5000);
const stats = await page.evaluate(async () => {
  const w = window.__theatre;
  const t0 = performance.now();
  let frames = 0;
  await new Promise((res) => {
    const step = () => { frames++; if (performance.now() - t0 > 2000) res(); else requestAnimationFrame(step); };
    requestAnimationFrame(step);
  });
  const fps = frames / ((performance.now() - t0) / 1000);
  w.renderer.info.autoReset = false;
  w.renderer.info.reset();
  await new Promise((r) => setTimeout(r, 300));
  const r = w.renderer.info.render;
  return { fps: +fps.toFixed(1), calls: r.calls, tris: r.triangles, dpr: w.renderer.getPixelRatio() };
});
await page.screenshot({ path: out, timeout: 120000 });
await browser.close();
console.log(JSON.stringify(stats), errs.length ? 'errors: ' + errs.join(' | ') : 'no page errors');
