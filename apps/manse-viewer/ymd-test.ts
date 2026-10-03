import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
const html = readFileSync('index.html', 'utf8');
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] });
const page = await b.newPage({ viewport: { width: 390, height: 844 } });
const errs: string[] = []; page.on('pageerror', (e) => errs.push(e.message));
await page.setContent(`<!doctype html><html><body>${html}</body></html>`, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(250);
let pass = 0, fail = 0;
const ck = (l: string, ok: boolean, d = '') => { ok ? pass++ : fail++; console.log(`  ${ok ? '✓' : '✗'} ${l}${d ? '  ' + d : ''}`); };

ck('연·월·일 세 칸이 생긴다', await page.locator('.ymd select').count() >= 3);
ck('기본 달력은 숨는다', !(await page.locator('#date').isVisible()));
const sel = page.locator('.ymd').first().locator('select');
ck('처음 값이 원래 날짜와 같다', (await sel.nth(0).inputValue()) === '1990' && (await sel.nth(1).inputValue()) === '05');

await sel.nth(0).selectOption('1978');
await sel.nth(1).selectOption('02');
await page.waitForTimeout(150);
ck('숨은 입력에 값이 써진다', (await page.locator('#date').inputValue()).startsWith('1978-02'), await page.locator('#date').inputValue());
ck('2월은 28일까지만', (await sel.nth(2).locator('option').count()) === 28);

await sel.nth(0).selectOption('1980');
await page.waitForTimeout(120);
ck('윤년 2월은 29일', (await sel.nth(2).locator('option').count()) === 29);

for (let i = 0; i < 6; i++) { const n = page.locator('.wiz-next'); if (await n.count()) { await n.click(); await page.waitForTimeout(60); } }
await page.waitForTimeout(500);
const out = (await page.locator('#out').textContent()) ?? '';
ck('바꾼 날짜로 실제 계산된다', out.length > 200 && !out.includes('1990-05-15'), `${out.length}자`);
ck('화면 밖으로 안 삐져나간다', await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1));
ck('궁합 쪽에도 붙는다', await page.locator('.ymd').count() >= 2, `${await page.locator('.ymd').count()}곳`);
ck('자바스크립트 오류 없음', errs.length === 0, errs.join(' | '));
await b.close();
console.log(`\n통과 ${pass} / 실패 ${fail}`);
process.exit(fail ? 1 : 0);
