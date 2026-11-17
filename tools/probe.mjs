import { chromium } from 'playwright-core';
const exe = `${process.env.HOME}/Library/Caches/ms-playwright/chromium-1254/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing`;
const browser = await chromium.launch({ executablePath: exe, args: ['--use-angle=metal','--enable-gpu','--ignore-gpu-blocklist'], headless: true });
const page = await browser.newPage({ viewport: { width: 1180, height: 776 }, deviceScaleFactor: 1 });
page.on('console', m => console.log('PAGE', m.type(), m.text().slice(0,300)));
page.on('pageerror', e => console.log('ERR', e.message.slice(0,400)));
await page.goto('http://localhost:5199/?ui=0&fixed=1', { waitUntil: 'networkidle' });
await page.waitForTimeout(6000);
console.log(await page.evaluate(() => {
  const w = window.__theatre;
  const v = document.getElementById('veil');
  return { veil: getComputedStyle(v).opacity, cls: v.className, cam: w.camera.position.toArray(), rot: [w.camera.rotation.x, w.camera.rotation.y], fov: w.camera.fov, vis: w.theatre.room.screen.visible, expos: w.live.exposure, screen: w.live.screen };
}));
await page.screenshot({ path: 'shots/probe.png', timeout: 60000 });
await browser.close();
