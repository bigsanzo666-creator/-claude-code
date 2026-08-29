/**
 * 구매 흐름 전체 검증.
 *
 * 실제 HTTP 서버를 띄우고 fetch로 두드린다. 다만 게이트웨이는 가짜고
 * 리포트 생성기도 가짜라서 **돈이 한 푼도 들지 않는다.**
 * 결제 흐름은 손으로 확인하기 가장 번거로운 영역이라, 여기가 자동화돼야 한다.
 */

import { createServer } from 'node:http';
import {
  CATALOG, FakeGateway, markPaid, markPending, createOrder,
} from '../../packages/commerce/src/index.ts';
import { createApi, MemoryOrderStore } from './src/server.ts';

let passed = 0, failed = 0;
const failures: string[] = [];
function check(label: string, ok: boolean, detail = '') {
  if (ok) { passed++; console.log(`  ✓ ${label}${detail ? `  ${detail}` : ''}`); }
  else { failed++; failures.push(label); console.log(`  ✗ ${label}${detail ? `  ${detail}` : ''}`); }
}
function section(t: string) { console.log(`\n${t}\n${'─'.repeat(60)}`); }

const gateway = new FakeGateway();
const orders = new MemoryOrderStore();
let generateCalls = 0;

const handler = createApi({
  gateway,
  orders,
  generate: async ({ kind, subject }) => {
    generateCalls++;
    return { text: `[가짜 ${kind} 리포트: ${subject}]\n\n두 번째 문단입니다.` };
  },
});

const server = createServer(handler);
await new Promise<void>((r) => server.listen(0, r));
const port = (server.address() as { port: number }).port;
const base = `http://127.0.0.1:${port}`;

const api = async (method: string, path: string, body?: unknown) => {
  const res = await fetch(`${base}${path}`, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, body: await res.json() as any };
};

const BIRTH = { date: '1990-05-15', time: '14:30', gender: '남' as const, name: '민수' };
const reading = { productId: 'cross-report', birth: BIRTH };

// ── A. 상품·미리보기 ───────────────────────────────────────────
section('A. 상품과 미리보기 (결제 전, 원가 0)');

const products = await api('GET', '/api/products');
check('상품 목록 조회', products.status === 200 && products.body.products.length === 3);
check('목록에 청약철회 고지 포함', products.body.notice.includes('청약철회가 제한'));

const preview = await api('POST', '/api/preview', reading);
check('미리보기 응답', preview.status === 200);
check('이 사람의 실제 항목이 담김',
  preview.body.preview.contents.length > 0,
  `${preview.body.preview.contents.length}개 — ${preview.body.preview.contents[0]}`);
check('엇갈림 항목이 미리보기에 노출',
  preview.body.preview.contents.some((c: string) => c.startsWith('엇갈림')));
check('예시 리포트 발췌 포함', preview.body.preview.sample.length > 50);
check('예시가 남의 명식임을 안내', preview.body.preview.sampleNotice.includes('다른 분의 명식'));
check('가격이 서버 카탈로그 값', preview.body.product.priceKrw === CATALOG['cross-report'].priceKrw);
check('미리보기는 모델을 부르지 않음', generateCalls === 0, `호출 ${generateCalls}회`);

// ── B. 주문 ────────────────────────────────────────────────────
section('B. 주문 생성');

const noAck = await api('POST', '/api/orders', reading);
check('고지 확인 없이는 주문 거부', noAck.status === 400, noAck.body.error);

const created = await api('POST', '/api/orders', { ...reading, acknowledgedNotice: true, previewShown: true });
check('주문 생성', created.status === 201);
const orderId: string = created.body.order.id;
check('금액이 카탈로그 값으로 고정',
  created.body.order.amountKrw === CATALOG['cross-report'].priceKrw, `${created.body.order.amountKrw}원`);
check('고지·미리보기 제공 사실이 기록됨',
  created.body.order.noticeGiven === true && created.body.order.previewProvided === true);
check('inputHash가 붙음', /^[0-9a-f]{64}$/.test(created.body.order.inputHash));

const badProduct = await api('POST', '/api/orders', { ...reading, productId: 'free-lunch', acknowledgedNotice: true });
check('없는 상품 거부', badProduct.status === 400);

// ── C. 결제 검증 ───────────────────────────────────────────────
section('C. 결제 확인 — 위조 차단');

await api('POST', `/api/orders/${orderId}/pending`);

// 금액을 깎은 결제를 먼저 시도한다
gateway.put({ paymentId: orderId, status: 'paid', amountKrw: 100, merchantOrderId: orderId, method: 'card', paidAt: new Date().toISOString(), raw: {} });
const cheap = await api('POST', `/api/orders/${orderId}/confirm`, { paymentId: orderId });
check('100원 결제로는 리포트가 나오지 않음', cheap.status === 402, cheap.body.error);
check('실패해도 리포트를 만들지 않음', generateCalls === 0);

// 실패 후 재시도 경로: 정상 금액으로 다시
const stored = await orders.get(orderId);
await orders.save({ ...markPending({ ...stored!, status: 'failed' }, orderId), ...({ reading: (stored as any).reading } as any) });
gateway.put({ paymentId: orderId, status: 'paid', amountKrw: CATALOG['cross-report'].priceKrw, merchantOrderId: orderId, method: 'card', paidAt: new Date().toISOString(), raw: {} });

const confirmed = await api('POST', `/api/orders/${orderId}/confirm`, { paymentId: orderId });
check('정상 금액이면 확정', confirmed.status === 200 && confirmed.body.order.status === 'fulfilled');
check('이때 비로소 리포트를 만듦', generateCalls === 1, `호출 ${generateCalls}회`);

// ── D. 이용권과 열람 ───────────────────────────────────────────
section('D. 리포트 열람');

const report = await api('GET', `/api/orders/${orderId}/report`);
check('전문 조회', report.status === 200 && report.body.text.includes('가짜 교차검증 리포트'));
check('열람 시점이 기록됨', report.body.order.status === 'viewed' && report.body.order.viewedAt);

const again = await api('GET', `/api/orders/${orderId}/report`);
check('재열람해도 최초 열람 시점 유지', again.body.order.viewedAt === report.body.order.viewedAt);
check('재열람은 모델을 다시 부르지 않음', generateCalls === 1);

const unpaidOrder = createOrder({ id: 'ord_unpaid', productId: 'saju-report', inputHash: 'c'.repeat(64), noticeGiven: true, previewProvided: true });
await orders.save(unpaidOrder);
const forbidden = await api('GET', '/api/orders/ord_unpaid/report');
check('결제 안 된 주문은 열람 차단', forbidden.status === 403, forbidden.body.error);
check('없는 주문은 404', (await api('GET', '/api/orders/nope/report')).status === 404);

// ── E. 환불 ────────────────────────────────────────────────────
section('E. 환불');

const verdict = await api('GET', `/api/orders/${orderId}/refund`);
check('열람 + 고지·미리보기 완비 → 환불 불가', verdict.body.verdict.refundable === false);
check('사유에 법적 근거가 붙음', verdict.body.verdict.basis.includes('제17조'), verdict.body.verdict.basis);
check('환불 시도도 거부', (await api('POST', `/api/orders/${orderId}/refund`)).status === 409);

// 열람하지 않은 주문은 환불된다
const second = await api('POST', '/api/orders', { ...reading, birth: { ...BIRTH, name: '지영' }, acknowledgedNotice: true, previewShown: true });
const id2: string = second.body.order.id;
await api('POST', `/api/orders/${id2}/pending`);
gateway.put({ paymentId: id2, status: 'paid', amountKrw: CATALOG['cross-report'].priceKrw, merchantOrderId: id2, method: 'card', paidAt: new Date().toISOString(), raw: {} });
await api('POST', `/api/orders/${id2}/confirm`, { paymentId: id2 });

const refunded = await api('POST', `/api/orders/${id2}/refund`);
check('미열람 주문은 환불됨', refunded.status === 200 && refunded.body.order.status === 'refunded');
check('전액 환불', refunded.body.refundedKrw === CATALOG['cross-report'].priceKrw, `${refunded.body.refundedKrw}원`);
check('환불 안내에 처리 기한 포함', refunded.body.message.includes('3영업일'));
check('PG에 실제로 취소가 걸림', gateway.cancelled.some((c) => c.paymentId === id2));
check('환불 후에는 열람 차단', (await api('GET', `/api/orders/${id2}/report`)).status === 403);
check('중복 환불 차단', (await api('POST', `/api/orders/${id2}/refund`)).status === 409);

server.close();
console.log(`\n${'═'.repeat(60)}`);
console.log(`통과 ${passed} / 실패 ${failed}  ·  모델 호출 ${generateCalls}회(가짜) · 실제 결제 0건`);
if (failed) { console.log('\n실패 항목:'); for (const f of failures) console.log(`  - ${f}`); process.exit(1); }
console.log('전부 통과.');
