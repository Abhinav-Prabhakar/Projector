import { chromium } from 'playwright-core';
import fs from 'node:fs';
const exe = `${process.env.HOME}/Library/Caches/ms-playwright/chromium-1254/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing`;
const browser = await chromium.launch({ executablePath: exe, args: ['--use-angle=metal','--enable-gpu','--ignore-gpu-blocklist'], headless: true });
const page = await browser.newPage({ viewport: { width: 1180, height: 776 }, deviceScaleFactor: 1 });
page.on('pageerror', e => console.log('ERR', e.message.slice(0,300)));
await page.goto('http://localhost:5199/?ui=0&fixed=1', { waitUntil: 'networkidle' });
await page.waitForTimeout(2500);
const data = await page.evaluate(() => {
  let m = null;
  window.__theatre.theatre.room.group.traverse(o => { if (o.userData.exitMat) m = o.material; });
  return { url: m.emissiveMap.image.toDataURL('image/png'), w: m.emissiveMap.image.width, h: m.emissiveMap.image.height, color: m.color.getHexString(), emis: m.emissive.getHexString(), ei: m.emissiveIntensity };
});
console.log(data.w, data.h, data.color, data.emis, data.ei);
fs.writeFileSync('shots/exittex.png', Buffer.from(data.url.split(',')[1], 'base64'));
await page.evaluate(() => {
  let m = null;
  window.__theatre.theatre.room.group.traverse(o => { if (o.userData.exitMat) m = o.material; });
  m.depthTest = false;
  m.needsUpdate = true;
});
await page.waitForTimeout(500);
await page.screenshot({ path: 'shots/probe_exitnodepth.png', timeout: 90000 });
await browser.close();
