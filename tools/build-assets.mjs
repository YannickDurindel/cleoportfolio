// Regenerates the OG image, favicons and placeholder CVs.
// Usage (from repo root):  python3 -m http.server 8765 &   then   node tools/build-assets.mjs
// Requires: npm i -D playwright && npx playwright install chromium
import { chromium } from 'playwright';
const base = process.env.BASE || 'http://localhost:8765/';
const browser = await chromium.launch(process.env.CHROME ? { executablePath: process.env.CHROME } : {});
const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });

await page.goto(base + 'tools/og.html', { waitUntil: 'networkidle' });
await page.waitForSelector('body[data-ready]');
await page.screenshot({ path: 'assets/img/og.jpg', type: 'jpeg', quality: 88 });

for (const s of [32, 180, 192, 512]) {
  await page.setViewportSize({ width: s, height: s });
  await page.setContent(`<html><head><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,400;1,9..144,400&display=block"></head>
  <body style="margin:0"><div style="width:${s}px;height:${s}px;background:#0e1a2b;display:grid;place-items:center;border-radius:${s === 180 ? 0 : s * .2}px;position:relative">
  <div style="position:absolute;inset:${s * .1}px;border:${Math.max(1, s / 40)}px solid #b08d57;border-radius:50%"></div>
  <span style="font:400 ${s * .42}px/1 Fraunces,serif;letter-spacing:-.06em;color:#f4efe6;margin-left:-${s * .02}px">C<i style="color:#d9473c">B</i></span></div></body></html>`, { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  const name = s === 32 ? 'favicon-32.png' : s === 180 ? 'apple-touch-icon.png' : `icon-${s}.png`;
  await page.screenshot({ path: `assets/img/${name}`, omitBackground: true });
}

for (const l of ['fr', 'en']) {
  await page.goto(`${base}tools/cv.html?l=${l}`, { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  await page.pdf({ path: `assets/cv/cleo-beaufils-cv-${l}.pdf`, format: 'A4', printBackground: true });
}
await browser.close();
console.log('assets built');
