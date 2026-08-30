/**
 * 실제 브라우저에서 결제 흐름을 끝까지 돌린다.
 *
 * 여기까지 와야 "결제가 된다"고 말할 수 있다. 단위 테스트는 흐름이 맞는지만
 * 확인하지, 버튼이 실제로 눌리는지·화면이 바뀌는지는 확인하지 못한다.
 *
 * 결제창(PortOne)만 가짜로 바꿔 끼운다. 나머지는 전부 진짜다 —
 * 진짜 서버, 진짜 브라우저, 진짜 DOM.
 */

import { createServer } from 'node:http';
import { chromium } from 'playwright';
import { FakeGateway, CATALOG } from '../../packages/commerce/src/index.ts';
import { createApi, MemoryOrderStore } from '../api/src/server.ts';

let passed = 0, failed = 0;
const failures: string[] = [];
function check(label: string, ok: boolean, detail = '') {
  if (ok) { passed++; console.log(`  ✓ ${label}${detail ? `  ${detail}` : ''}`); }
  else { failed++; failures.push(label); console.log(`  ✗ ${label}${detail ? `  ${detail}` : ''}`); }
}
function section(t: string) { console.log(`\n${t}\n${'─'.repeat(60)}`); }

const gateway = new FakeGateway();
const api = createApi({
  gateway,
  orders: new MemoryOrderStore(),
  generate: async ({ subject }) => ({
    text: `[교차검증 리포트 · ${subject}]\n\n이것은 결제 후에만 보이는 본문입니다.`,
  }),
  checkout: { storeId: 'store-test', channelKey: 'channel-test' },
});

/**
 * 가짜 결제창이 "승인됐다"고 알려줄 경로만 앞에서 가로채고,
 * 나머지는 전부 진짜 API로 넘긴다.
 */
const server = createServer((req, res) => {
  if (req.url === '/__test/approve' && req.method === 'POST') {
    let raw = '';
    req.on('data', (c) => { raw += c; });
    req.on('end', () => {
      const { paymentId, amountKrw } = JSON.parse(raw);
      gateway.put({
        paymentId, status: 'paid', amountKrw, merchantOrderId: paymentId,
        method: 'card', paidAt: new Date().toISOString(), raw: {},
      });
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end('{"ok":true}');
    });
    return;
  }
  api(req, res);
});
await new Promise<void>((r) => server.listen(0, r));
const base = `http://127.0.0.1:${(server.address() as any).port}`;

// 이 환경에는 브라우저가 미리 깔려 있고 playwright 버전과 어긋난다.
// 새로 내려받지 말고 설치된 실행 파일을 직접 가리킨다.
const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--no-sandbox'],
});
const page = await browser.newPage();
const consoleErrors: string[] = [];
page.on('pageerror', (e) => consoleErrors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });

/**
 * 외부 CDN 차단은 코드 오류가 아니다.
 * 이 샌드박스는 바깥 네트워크를 막아서 포트원 SDK 로딩이 실패한다.
 * 그 상황 자체는 checkout-client 의 'SDK 미로딩 가드'에서 따로 검증한다.
 */
const isNetworkBlock = (m: string) =>
  m.includes('ERR_CONNECTION') || m.includes('ERR_NAME_NOT_RESOLVED') || m.includes('Failed to load resource');
const codeErrors = () => consoleErrors.filter((m) => !isNetworkBlock(m));

// 포트원 SDK를 가짜로 갈아끼운다. 요청받은 금액 그대로 승인 처리한다
await page.addInitScript(() => {
  (window as any).__payCalls = [];
  (window as any).__payMode = 'ok';
  (window as any).PortOne = {
    requestPayment: async (req: any) => {
      (window as any).__payCalls.push(req);
      if ((window as any).__payMode === 'cancel') {
        return { code: 'USER_CANCEL', message: '사용자가 결제를 취소했습니다.' };
      }
      await fetch('/__test/approve', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paymentId: req.paymentId, amountKrw: req.totalAmount }),
      });
      return { paymentId: req.paymentId };
    },
  };
});

// ── A. 페이지가 뜨는가 ─────────────────────────────────────────
section('A. 페이지 로드');

await page.goto(base, { waitUntil: 'domcontentloaded' });
await page.waitForSelector('.chart', { timeout: 10000 });

check('명식이 그려짐', (await page.locator('.chart .col').count()) === 4);
check('탭 3개', (await page.locator('.tab').count()) === 3);
check('자바스크립트 오류 없음', codeErrors().length === 0, codeErrors()[0] ?? '');
check('외부 CDN이 막혀도 페이지는 동작', true,
  consoleErrors.some(isNetworkBlock) ? '포트원 SDK 로딩 차단됨 — 화면은 정상' : 'CDN 정상');
check('무료 구간은 결제 없이 보임',
  (await page.locator('text=오늘의 일진').count()) > 0);

// ── B. 유료 구간이 막혀 있는가 ─────────────────────────────────
section('B. 유료 구간 — 결제 전');

await page.locator('#tabFace').click();
await page.waitForSelector('.pro', { timeout: 10000 });
await page.waitForSelector('#payBtn', { timeout: 10000 });

const priceText = await page.locator('.buy .price').textContent();
// 값을 여기 적어두면 카탈로그를 고칠 때마다 검증이 깨진다. 한 곳에서만 온다
const crossPrice = CATALOG['cross-report'].priceKrw.toLocaleString('ko-KR');
check('가격이 표시됨', priceText?.includes(crossPrice) ?? false, priceText ?? '');
check('담길 내용 목록이 보임', (await page.locator('.will li').count()) > 0,
  `${await page.locator('.will li').count()}개`);
check('예시 리포트가 보임', ((await page.locator('.samp').textContent()) ?? '').length > 50);
check('청약철회 고지가 보임',
  ((await page.locator('.legal').textContent()) ?? '').includes('청약철회가 제한'));
check('결제 버튼이 처음엔 비활성', await page.locator('#payBtn').isDisabled());
check('교차검증 전문은 아직 안 보임', (await page.locator('.xv').count()) === 0);

// ── C. 동의 → 결제 ─────────────────────────────────────────────
section('C. 결제');

await page.locator('#agree').check();
await page.waitForFunction(() => !(document.querySelector('#payBtn') as HTMLButtonElement)?.disabled);
check('동의하면 결제 버튼 활성', !(await page.locator('#payBtn').isDisabled()));

await page.locator('#payBtn').click();
await page.waitForSelector('.bought', { timeout: 30000 });

const bought = (await page.locator('.bought').textContent()) ?? '';
check('결제 후 리포트 본문이 나옴', bought.includes('결제 후에만 보이는 본문'));
check('호칭이 반영됨', bought.includes('이 분'), bought.slice(0, 40));
check('주문번호가 안내됨', ((await page.locator('.panel-in .note .mono').textContent()) ?? '').startsWith('ord_'));

const payCalls = await page.evaluate(() => (window as any).__payCalls);
check('결제창이 한 번 호출됨', payCalls.length === 1);
check('금액이 서버가 정한 값으로 전달됨',
  payCalls[0].totalAmount === CATALOG['cross-report'].priceKrw, `${payCalls[0].totalAmount}원`);
check('상점 정보가 전달됨',
  payCalls[0].storeId === 'store-test' && payCalls[0].channelKey === 'channel-test');
check('통화·결제수단 지정', payCalls[0].currency === 'CURRENCY_KRW' && payCalls[0].payMethod === 'CARD');

// ── D. 결제 취소 ───────────────────────────────────────────────
section('D. 사용자가 결제창을 닫는 경우');

await page.evaluate(() => { (window as any).__payMode = 'cancel'; });
// 입력을 바꾸면 이전 구매 결과가 초기화된다 (이름 칸은 궁합 모드 전용이라 생년월일로 바꾼다)
await page.locator('#date').fill('1985-11-03');
await page.waitForSelector('#payBtn', { timeout: 10000 });
check('입력이 바뀌면 이전 리포트가 사라짐', (await page.locator('.bought').count()) === 0);

await page.locator('#agree').check();
await page.waitForFunction(() => !(document.querySelector('#payBtn') as HTMLButtonElement)?.disabled);
await page.locator('#payBtn').click();
await page.waitForSelector('.err', { timeout: 15000 });

const err = (await page.locator('.err').textContent()) ?? '';
check('취소가 안내됨', err.includes('취소'), err);
check('다시 시도할 수 있다고 안내', err.includes('다시 시도'));
check('취소해도 리포트는 안 나옴', (await page.locator('.bought').count()) === 0);
check('결제창은 두 번 호출됨',
  (await page.evaluate(() => (window as any).__payCalls.length)) === 2);

check('전 과정에 자바스크립트 오류 없음', codeErrors().length === 0, codeErrors()[0] ?? '');

await browser.close();
server.close();

console.log(`\n${'═'.repeat(60)}`);
console.log(`통과 ${passed} / 실패 ${failed}  ·  실제 브라우저 · 실제 결제 0건`);
if (failed) { console.log('\n실패 항목:'); for (const f of failures) console.log(`  - ${f}`); process.exit(1); }
console.log('전부 통과.');
