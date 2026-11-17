import { chromium } from 'playwright-core';
import fs from 'node:fs';
const exe = `${process.env.HOME}/Library/Caches/ms-playwright/chromium-1254/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing`;
const browser = await chromium.launch({ executablePath: exe, args: ['--use-angle=metal','--enable-gpu','--ignore-gpu-blocklist'], headless: true });
const page = await browser.newPage({ viewport: { width: 1180, height: 776 }, deviceScaleFactor: 1 });
await page.goto('http://localhost:5199/?ui=0&fixed=1&raw=1', { waitUntil: 'networkidle' });
await page.waitForTimeout(2500);
const data = await page.evaluate(() => {
  const t = window.__theatre.theatre.room.screenMat.emissiveMap;
  return { url: t.image.toDataURL('image/png'), w: t.image.width, h: t.image.height, minFilter: t.minFilter, magFilter: t.magFilter, mips: t.generateMipmaps, aniso: t.anisotropy };
});
console.log(data.w, data.h, data.minFilter, data.magFilter, data.mips, data.aniso);
fs.writeFileSync('shots/screentex.png', Buffer.from(data.url.split(',')[1], 'base64'));
await browser.close();
