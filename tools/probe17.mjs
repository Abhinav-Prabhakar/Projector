import { chromium } from 'playwright-core';
const exe = `${process.env.HOME}/Library/Caches/ms-playwright/chromium-1254/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing`;
const browser = await chromium.launch({ executablePath: exe, args: ['--use-angle=metal','--enable-gpu','--ignore-gpu-blocklist'], headless: true });
const page = await browser.newPage({ viewport: { width: 1180, height: 776 }, deviceScaleFactor: 1 });
page.on('pageerror', e => console.log('ERR', e.message.slice(0,300)));
await page.goto('http://localhost:5199/?ui=0&fixed=1', { waitUntil: 'networkidle' });
await page.waitForTimeout(2500);
await page.evaluate(() => {
  const leg = window.__theatre.theatre.drapery.children[0];
  leg.material.color.set(0x888888);
  leg.material.sheen = 0;
  leg.material.needsUpdate = true;
});
await page.waitForTimeout(600);
await page.screenshot({ path: 'shots/probe_leg.png', timeout: 90000 });
await browser.close();
