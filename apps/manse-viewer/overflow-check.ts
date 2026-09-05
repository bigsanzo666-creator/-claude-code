import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
const html = readFileSync('index.html', 'utf8');
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] });
const page = await b.newPage({ viewport: { width: 390, height: 844 } });
await page.setContent(`<!doctype html><html><body>${html}</body></html>`, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(200);
for (let i = 0; i < 6; i++) { const n = page.locator('.wiz-next'); if (await n.count()) { await n.click(); await page.waitForTimeout(60); } }
await page.waitForTimeout(500);
const r = await page.evaluate(() => {
  const chain: string[] = [];
  let el: HTMLElement | null = document.querySelector('#panelA');
  while (el) { const b = el.getBoundingClientRect();
    chain.push(`${el.tagName.toLowerCase()}.${(el.className||'').toString().split(' ')[0]} w=${Math.round(b.width)} css=${getComputedStyle(el).maxWidth}`);
    el = el.parentElement; }
  (window as any).__chain = chain;
  const vw = document.documentElement.clientWidth;
  const bad: string[] = [];
  document.querySelectorAll('*').forEach((el) => {
    const b = (el as HTMLElement).getBoundingClientRect();
    if (b.width > vw + 1 || b.right > vw + 1) {
      bad.push(`${el.tagName.toLowerCase()}.${(el.className||'').toString().split(' ')[0]} w=${Math.round(b.width)} right=${Math.round(b.right)}`);
    }
  });
  return { chain, vw, scrollW: document.documentElement.scrollWidth, bad: [...new Set(bad)].slice(0, 15) };
});
console.log(JSON.stringify(r, null, 1));
await b.close();
