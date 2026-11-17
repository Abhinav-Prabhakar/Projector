import { chromium } from 'playwright-core';
const exe = `${process.env.HOME}/Library/Caches/ms-playwright/chromium-1254/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing`;
const browser = await chromium.launch({ executablePath: exe, args: ['--use-angle=metal','--enable-gpu','--ignore-gpu-blocklist'], headless: true });
const page = await browser.newPage({ viewport: { width: 1180, height: 776 }, deviceScaleFactor: 1 });
page.on('pageerror', e => console.log('ERR', e.message.slice(0,300)));
await page.goto('http://localhost:5199/?ui=0&fixed=1', { waitUntil: 'networkidle' });
await page.waitForTimeout(2600);
const out = await page.evaluate(() => {
  const w = window.__theatre, THREE = w.THREE;
  const deck = [], glow = [], skirt = [];
  w.theatre.room.group.traverse(o => {
    if (!o.isMesh) return;
    const c = o.material && o.material.color && o.material.color.getHexString();
    if (o.geometry.type === 'BoxGeometry' && c === '3d382f') deck.push(o);
    if (o.material && o.material.blending === THREE.AdditiveBlending) glow.push(o);
  });
  w.scene.traverse(o => {
    if (o.isMesh && o.geometry.type === 'PlaneGeometry' && o.position.z < -13) skirt.push(o);
  });
  w.scene.updateMatrixWorld(true);
  const rows = [];
  for (let f = 0.485; f < 0.585; f += 0.0025) {
    const rc = new THREE.Raycaster();
    rc.setFromCamera(new THREE.Vector2(0, -(f * 2 - 1)), w.camera);
    const h = rc.intersectObjects([...deck, ...glow], false)[0];
    rows.push({ f: +f.toFixed(4), z: h ? +h.point.z.toFixed(2) : null, glow: h ? h.object.material.blending === THREE.AdditiveBlending : null });
  }
  const rd = new THREE.Raycaster();
  rd.setFromCamera(new THREE.Vector2(0, -(0.503 * 2 - 1)), w.camera);
  const hit = rd.intersectObjects(deck, false)[0];
  return { rows, deckAt503: hit ? [hit.point.x, hit.point.y, hit.point.z].map(v => +v.toFixed(2)) : null, nDeck: deck.length, nGlow: glow.length };
});
console.log(JSON.stringify(out.rows.filter(r => r.f % 0.01 < 0.003 || true).slice(0, 60)));
console.log('deck@0.503', JSON.stringify(out.deckAt503), 'nDeck', out.nDeck, 'nGlow', out.nGlow);
await page.screenshot({ path: 'shots/deck.png' });
await browser.close();
