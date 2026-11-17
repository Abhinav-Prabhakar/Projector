import { chromium } from 'playwright-core';
const exe = `${process.env.HOME}/Library/Caches/ms-playwright/chromium-1254/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing`;
const browser = await chromium.launch({ executablePath: exe, args: ['--use-angle=metal','--enable-gpu','--ignore-gpu-blocklist'], headless: true });
const page = await browser.newPage({ viewport: { width: 860, height: 560 }, deviceScaleFactor: 2 });
page.on('pageerror', e => console.log('ERR', e.message.slice(0,200)));
await page.goto('http://localhost:5199/?ui=0&fixed=1', { waitUntil: 'networkidle' });
await page.waitForTimeout(3000);
const shots = JSON.parse(process.env.SHOTS);
for (const [name, pos, target, focus] of shots) {
  await page.evaluate(({ pos, target, focus }) => {
    const w = window.__theatre;
    w.rig.update = () => {};
    w.camera.position.set(...pos);
    w.camera.lookAt(...target);
    w.camera.updateMatrixWorld();
    w.live.focus = focus; w.target.focus = focus;
  }, { pos, target, focus });
  await page.waitForTimeout(700);
  await page.screenshot({ path: `shots/d_${name}.png`, timeout: 120000 });
}
await browser.close();
console.log('detail shots done');
