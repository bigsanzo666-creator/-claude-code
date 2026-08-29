/**
 * 브라우저 결제 흐름 검증.
 *
 * 진짜 API 서버를 띄우고, 결제창만 가짜로 바꿔 끼운다.
 * 사용자가 결제창을 닫는 경우처럼 손으로 재현하기 번거로운 상황을
 * 여기서 전부 돌려본다. 실제 결제는 한 건도 일어나지 않는다.
 */

import { createServer } from 'node:http';
import { FakeGateway, CATALOG } from '../commerce/src/index.ts';
import { createApi, MemoryOrderStore } from '../../apps/api/src/server.ts';
import { Checkout, CheckoutError, portOnePay, type PayRequest, type PayResponse } from './src/index.ts';

let passed = 0, failed = 0;
const failures: string[] = [];
function check(label: string, ok: boolean, detail = '') {
  if (ok) { passed++; console.log(`  ✓ ${label}${detail ? `  ${detail}` : ''}`); }
  else { failed++; failures.push(label); console.log(`  ✗ ${label}${detail ? `  ${detail}` : ''}`); }
}
function section(t: string) { console.log(`\n${t}\n${'─'.repeat(60)}`); }
async function caught(fn: () => Promise<unknown>): Promise<Error | null> {
  try { await fn(); return null; } catch (e) { return e as Error; }
}

const gateway = new FakeGateway();
const orders = new MemoryOrderStore();
const server = createServer(createApi({
  gateway, orders,
  generate: async ({ kind }) => ({ text: `[${kind} 리포트 본문]\n\n두 번째 문단.` }),
}));
await new Promise<void>((r) => server.listen(0, r));
const apiBase = `http://127.0.0.1:${(server.address() as any).port}`;

const READING = {
  productId: 'cross-report',
  birth: { date: '1990-05-15', time: '14:30', gender: '남', name: '민수' },
};
const config = { storeId: 'store-test', channelKey: 'channel-test' };

/** 승인된 결제를 게이트웨이에 미리 넣어두는 가짜 결제창 */
const payRequests: PayRequest[] = [];
const payOk = async (req: PayRequest): Promise<PayResponse> => {
  payRequests.push(req);
  gateway.put({
    paymentId: req.paymentId, status: 'paid', amountKrw: req.totalAmount,
    merchantOrderId: req.paymentId, method: 'card', paidAt: new Date().toISOString(), raw: {},
  });
  return { paymentId: req.paymentId };
};

// ── A. 미리보기 ────────────────────────────────────────────────
section('A. 미리보기 (무료)');

const co = new Checkout({ apiBase, config, pay: payOk });
const pv = await co.preview(READING);
check('미리보기 조회', pv.preview.contents.length > 0, `${pv.preview.contents.length}개 항목`);
check('가격이 서버 값', pv.product.priceKrw === CATALOG['cross-report'].priceKrw, `${pv.product.priceKrw}원`);
check('청약철회 고지가 함께 옴', pv.notice.includes('청약철회가 제한'));
check('예시가 남의 명식임을 안내', pv.preview.sampleNotice.includes('다른 분'));

// ── B. 정상 구매 ───────────────────────────────────────────────
section('B. 정상 구매');

const stages: string[] = [];
const bought = await co.purchase(READING, { previewShown: true, onStage: (s) => stages.push(s) });

check('리포트를 받아옴', bought.text.includes('교차검증 리포트 본문'));
check('결제 금액이 상품 가격', bought.amountKrw === CATALOG['cross-report'].priceKrw);
check('단계가 순서대로 보고됨',
  stages.join('→') === 'order→payment→confirm→report→done', stages.join(' → '));

const req = payRequests.at(-1)!;
check('결제창에 주문번호를 그대로 넘김', req.paymentId === bought.orderId);
check('통화와 결제수단이 지정됨', req.currency === 'CURRENCY_KRW' && req.payMethod === 'CARD');
check('상점 정보가 전달됨', req.storeId === 'store-test' && req.channelKey === 'channel-test');
check('금액이 서버가 정한 값', req.totalAmount === CATALOG['cross-report'].priceKrw, `${req.totalAmount}원`);

// ── C. 결제 실패 상황들 ────────────────────────────────────────
section('C. 실패 상황');

// 사용자가 결제창을 닫음 — 포트원은 code를 채워 돌려준다
const cancelCo = new Checkout({
  apiBase, config,
  pay: async () => ({ code: 'USER_CANCEL', message: '사용자가 결제를 취소했습니다.' }),
});
const cancelled = await caught(() => cancelCo.purchase(READING, { previewShown: true }));
check('결제창을 닫으면 취소로 처리',
  cancelled instanceof CheckoutError && cancelled.stage === 'payment' && cancelled.cancelled,
  cancelled?.message);

// 카드사 거절
const declineCo = new Checkout({
  apiBase, config,
  pay: async () => ({ code: 'CARD_DECLINED', message: '한도를 초과했습니다.' }),
});
const declined = await caught(() => declineCo.purchase(READING, { previewShown: true }));
check('카드 거절도 결제 단계에서 멈춤',
  declined instanceof CheckoutError && (declined as CheckoutError).stage === 'payment');
check('거절 사유가 그대로 전달됨', declined!.message.includes('한도를 초과'));

// SDK 자체가 터진 경우
const brokenCo = new Checkout({
  apiBase, config,
  pay: async () => { throw new Error('네트워크가 끊겼습니다.'); },
});
const broken = await caught(() => brokenCo.purchase(READING, { previewShown: true }));
check('결제창 자체가 실패해도 잡아냄',
  broken instanceof CheckoutError && (broken as CheckoutError).stage === 'payment');
check('그 경우는 취소가 아님', !(broken as CheckoutError).cancelled);

// 결제는 됐는데 서버 검증이 실패 — 가장 위험한 경우
const cheatCo = new Checkout({
  apiBase, config,
  pay: async (r) => {
    // 금액을 깎아서 승인된 것처럼 꾸민다
    gateway.put({
      paymentId: r.paymentId, status: 'paid', amountKrw: 100,
      merchantOrderId: r.paymentId, method: 'card', paidAt: new Date().toISOString(), raw: {},
    });
    return { paymentId: r.paymentId };
  },
});
const cheated = await caught(() => cheatCo.purchase(READING, { previewShown: true }));
check('금액을 깎으면 확정 단계에서 막힘',
  cheated instanceof CheckoutError && (cheated as CheckoutError).stage === 'confirm');
check('그때 주문번호를 안내해 문의할 수 있게 함',
  cheated!.message.includes('주문번호'), cheated!.message.split('\n')[1]);

// 없는 상품
const badProduct = await caught(() => co.purchase({ productId: 'free-lunch' } as any, { previewShown: true }));
check('없는 상품은 주문 단계에서 거부',
  badProduct instanceof CheckoutError && (badProduct as CheckoutError).stage === 'order');

// ── D. 환불 ────────────────────────────────────────────────────
section('D. 환불');

const status = await co.refundStatus(bought.orderId);
check('열람했으므로 환불 불가로 조회됨', status.refundable === false, status.message.slice(0, 40) + '…');

// 열람하지 않은 주문을 하나 더 만들어 환불한다
const co2 = new Checkout({ apiBase, config, pay: payOk });
const order2 = await co2.purchase({ ...READING, birth: { ...READING.birth, name: '지영' } }, { previewShown: true });
// purchase가 리포트까지 읽으므로 열람 상태다. 새 주문을 만들어 결제만 하고 멈춘다
const created = await fetch(`${apiBase}/api/orders`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ ...READING, acknowledgedNotice: true, previewShown: true }),
}).then((r) => r.json()) as any;
const id3 = created.order.id;
await fetch(`${apiBase}/api/orders/${id3}/pending`, { method: 'POST' });
await payOk({ ...config, paymentId: id3, orderName: 'x', totalAmount: created.order.amountKrw, currency: 'CURRENCY_KRW', payMethod: 'CARD' });
await fetch(`${apiBase}/api/orders/${id3}/confirm`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ paymentId: id3 }),
});

const unviewed = await co.refundStatus(id3);
check('미열람 주문은 환불 가능으로 조회됨', unviewed.refundable === true);

const refunded = await co.requestRefund(id3);
check('환불 실행됨', refunded.refundedKrw === CATALOG['cross-report'].priceKrw, `${refunded.refundedKrw}원`);
check('환불 안내에 처리 기한 포함', refunded.message.includes('3영업일'));

// ── E. SDK 가드 ────────────────────────────────────────────────
section('E. SDK 미로딩 가드');

const guarded = portOnePay();
const noSdk = await caught(() => guarded({} as PayRequest));
check('SDK가 없으면 명확한 안내', noSdk !== null && noSdk.message.includes('새로고침'), noSdk?.message);

server.close();
console.log(`\n${'═'.repeat(60)}`);
console.log(`통과 ${passed} / 실패 ${failed}  ·  실제 결제 0건`);
if (failed) { console.log('\n실패 항목:'); for (const f of failures) console.log(`  - ${f}`); process.exit(1); }
console.log('전부 통과.');
