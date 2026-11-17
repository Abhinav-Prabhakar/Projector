import { chromium } from 'playwright-core';
const exe = `${process.env.HOME}/Library/Caches/ms-playwright/chromium-1254/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing`;
const browser = await chromium.launch({ executablePath: exe, args: ['--use-angle=metal','--enable-gpu','--ignore-gpu-blocklist'], headless: true });
const page = await browser.newPage({ viewport: { width: 1180, height: 776 }, deviceScaleFactor: 1 });
page.on('pageerror', e => console.log('ERR', e.message.slice(0,300)));
await page.goto('http://localhost:5199/?ui=0&fixed=1', { waitUntil: 'networkidle' });
await page.waitForTimeout(2600);
const handles = await page.evaluate(() => {
  const w = window.__theatre;
  const L = [];
  w.scene.traverse(o => { if (o.isLight) L.push(o); });
  const by = (t, i) => L.filter(l => l.type === t)[i];
  let floor = null;
  w.theatre.room.group.traverse(o => { if (o.isMesh && o.material && o.material.color && o.material.color.getHexString() === '615a4e') floor = o; });
  window.__T = {
    screenLight: by('SpotLight', 0),
    houseArea: by('RectAreaLight', 0),
    key: by('SpotLight', 1),
    fill: by('HemisphereLight', 0),
    spots: L.filter(l => l.type === 'SpotLight').slice(2, 5),
    stageWash: by('RectAreaLight', 1),
    legRakes: L.filter(l => l.type === 'SpotLight').slice(5, 7),
    drapeWash: L.filter(l => l.type === 'SpotLight')[7],
    apron: L.filter(l => l.type === 'SpotLight')[8],
    screenBounce: L.filter(l => l.type === 'PointLight')[0],
    ceilingGlows: L.filter(l => l.type === 'PointLight').slice(1, 4),
    floorMat: floor.material,
  };
  window.__T.base = {
    screenLight: __T.screenLight.intensity, key: __T.key.intensity, apron: __T.apron.intensity,
    screenBounce: __T.screenBounce.intensity, spots: __T.spots[0].intensity,
    legRakes: __T.legRakes[0].intensity, drapeWash: __T.drapeWash.intensity,
  };
  w.theatre.update = () => {};
  return { base: window.__T.base, count: L.length };
});
console.log(JSON.stringify(handles));
const cases = JSON.parse(process.env.CASES);
for (const [name, body] of cases) {
  await page.evaluate(new Function('const T = window.__T; const B = T.base;' + body));
  await page.waitForTimeout(400);
  await page.screenshot({ path: `shots/t_${name}.png`, timeout: 90000 });
  const m = await page.evaluate(() => {
    const w = window.__theatre;
    const c = document.createElement('canvas');
    return 1;
  });
}
await browser.close();
