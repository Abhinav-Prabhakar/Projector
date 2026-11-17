import { chromium } from 'playwright-core';
import fs from 'node:fs';
const exe = `${process.env.HOME}/Library/Caches/ms-playwright/chromium-1254/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing`;
const browser = await chromium.launch({ executablePath: exe, args: ['--use-angle=metal','--enable-gpu','--ignore-gpu-blocklist'], headless: true });
const page = await browser.newPage({ viewport: { width: 1180, height: 776 }, deviceScaleFactor: 1 });
page.on('pageerror', e => console.log('ERR', e.message.slice(0,400)));
await page.goto('http://localhost:5199/?ui=0&fixed=1', { waitUntil: 'networkidle' });
await page.waitForTimeout(2500);
const shots = [
  ['all', {}],
  ['noscreen', { screen: 0 }],
  ['nostage', { stage: 0 }],
  ['nohouse', { house: 0 }],
];
for (const [name, p] of shots) {
  await page.evaluate((p) => { Object.assign(window.__theatre.target, p); }, p);
  await page.waitForTimeout(600);
  await page.screenshot({ path: `shots/probe_${name}.png`, timeout: 90000 });
}
await browser.close();
