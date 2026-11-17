import { chromium } from 'playwright-core';
const exe = `${process.env.HOME}/Library/Caches/ms-playwright/chromium-1254/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing`;
const browser = await chromium.launch({ executablePath: exe, args: ['--use-angle=metal','--enable-gpu','--ignore-gpu-blocklist'], headless: true });
const page = await browser.newPage({ viewport: { width: 1180, height: 776 }, deviceScaleFactor: 1 });
page.on('pageerror', e => console.log('ERR', e.message.slice(0,400)));
await page.goto('http://localhost:5199/?ui=0&fixed=1', { waitUntil: 'networkidle' });
await page.waitForTimeout(3000);
console.log(await page.evaluate(() => {
  const w = window.__theatre;
  w.target.debugDepth = 1; w.live.debugDepth = 1;
  return { depthTex: !!w.post.depthTexture, w: w.post.w, h: w.post.h };
}));
await page.waitForTimeout(700);
await page.screenshot({ path: 'shots/depth.png', timeout: 90000 });
await browser.close();
