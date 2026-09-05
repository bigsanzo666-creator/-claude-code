import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
const html = readFileSync('/home/user/-claude-code/apps/manse-viewer/index.html', 'utf8');
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const errs: string[] = [];
page.on('pageerror', (e) => errs.push(e.message));
await page.setContent(`<!doctype html><html><body>${html}</body></html>`, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(300);

let pass = 0, fail = 0;
const ck = (l: string, ok: boolean, d = '') => { ok ? pass++ : fail++; console.log(`  ${ok ? '✓' : '✗'} ${l}${d ? '  ' + d : ''}`); };

ck('마법사가 켜진다', await page.locator('body.wiz').count() === 1);
ck('첫 질문만 보인다', await page.locator('#panelA .f.step-on').count() === 1);
ck('생년월일부터 묻는다', await page.locator('.f.step-on #date').count() === 1);
ck('질문이 문장으로 나온다', (await page.locator('#panelA h2').textContent())?.includes('태어난 날') ?? false);
ck('결과는 아직 안 보인다', !(await page.locator('#out').isVisible()));
ck('점 표시가 질문 수만큼', await page.locator('.wiz-dot').count() === 4);

await page.locator('.wiz-next').click();
ck('둘째 질문 = 시각', await page.locator('.f.step-on #time').count() === 1);
ck('「모르겠어요」가 여기서만 보인다', await page.locator('.wiz-skip').isVisible());

await page.locator('.wiz-back').click();
ck('이전으로 돌아온다', await page.locator('.f.step-on #date').count() === 1);

await page.locator('.wiz-next').click();
await page.locator('.wiz-skip').click();
ck('모르겠어요를 누르면 체크박스가 눌린다', await page.locator('#notime').isChecked());
ck('다음 질문으로 넘어간다', await page.locator('.f.step-on #place').count() === 1);

await page.locator('.wiz-next').click();
ck('마지막은 성별', await page.locator('.f.step-on #gender').count() === 1);
ck('버튼 문구가 바뀐다', (await page.locator('.wiz-next').textContent()) === '내 사주 보기');

await page.locator('.wiz-next').click();
await page.waitForTimeout(400);
ck('마법사가 사라진다', await page.locator('body.wiz').count() === 0);
ck('입력칸이 전부 돌아온다', await page.locator('#panelA .f:visible').count() >= 4);
ck('결과가 나온다', await page.locator('#out').isVisible());
ck('명식이 실제로 계산됐다', (await page.locator('#out').textContent() ?? '').length > 200);
ck('세부 설정도 돌아온다', await page.locator('#yaja').isVisible());
ck('자바스크립트 오류 없음', errs.length === 0, errs.join(' | '));

await browser.close();
console.log(`\n통과 ${pass} / 실패 ${fail}`);
process.exit(fail ? 1 : 0);
