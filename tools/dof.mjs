import { chromium } from 'playwright-core';
const exe = `${process.env.HOME}/Library/Caches/ms-playwright/chromium-1254/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing`;
const browser = await chromium.launch({ executablePath: exe, args: ['--use-angle=metal','--enable-gpu','--ignore-gpu-blocklist'], headless: true });
const page = await browser.newPage({ viewport: { width: 1180, height: 776 }, deviceScaleFactor: 1 });
await page.goto('http://localhost:5199/?ui=0&fixed=1', { waitUntil: 'networkidle' });
await page.waitForTimeout(3000);
console.log(await page.evaluate(() => {
  const w = window.__theatre;
  w.target.focus = 34; w.target.dof = 2.2; w.live.focus = 34; w.live.dof = 2.2;
  return { depth: w.post.depthTexture ? 'yes' : 'no' };
}));
await page.waitForTimeout(800);
await page.screenshot({ path: 'shots/dof_test.png', timeout: 90000 });
await browser.close();
