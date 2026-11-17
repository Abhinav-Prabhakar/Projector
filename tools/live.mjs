import { chromium } from 'playwright-core';
const exe = `${process.env.HOME}/Library/Caches/ms-playwright/chromium-1254/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing`;
const browser = await chromium.launch({ executablePath: exe, args: ['--use-angle=metal','--enable-gpu','--ignore-gpu-blocklist'], headless: true });
const page = await browser.newPage({ viewport: { width: 1180, height: 776 }, deviceScaleFactor: 1 });
page.on('pageerror', e => console.log('ERR', e.message.slice(0,400)));
const log = [];
page.on('console', m => log.push(m.text().slice(0,300)));
await page.goto('http://localhost:5199/?ui=0&fixed=1', { waitUntil: 'networkidle' });
await page.waitForTimeout(2500);
const script = process.env.SCRIPT;
if (script) {
  try { console.log(JSON.stringify(await page.evaluate(new Function('return (async () => {' + script + '})()')), null, 1)); }
  catch (e) { console.log('EVAL ERROR', e.message.slice(0,500)); }
}
await page.waitForTimeout(600);
if (process.env.OUT) await page.screenshot({ path: process.env.OUT, timeout: 90000 });
console.log('---console---'); console.log(log.slice(-6).join('\n'));
await browser.close();
