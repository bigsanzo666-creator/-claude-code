/**
 * 결제 도메인 검증.
 *
 * 네트워크를 타지 않는다. 가짜 게이트웨이로 공격 시나리오를 재현한다 —
 * 금액 위조, 미승인 결제 가로채기, 남의 결제 붙이기, 중복 처리.
 * 돈이 걸린 코드는 이런 걸 자동으로 막는지 매번 확인돼야 한다.
 */

import {
  CATALOG, getProduct, makePreview, CATEGORIES, productsIn,
  PACKAGES, bundleMath, packagesContaining, assertPackagesValid,
  createOrder, markPending, markPaid, markFulfilled, markViewed, markRefunded,
  hasEntitlement, OrderTransitionError,
  assessRefund, addBusinessDays, WITHDRAWAL_NOTICE, WITHDRAWAL_WINDOW_DAYS, refundNotice,
  FakeGateway, confirmPayment, refundOrder, PaymentVerificationError,
  type Order,
} from './src/index.ts';

let passed = 0, failed = 0;
const failures: string[] = [];
function check(label: string, ok: boolean, detail = '') {
  if (ok) { passed++; console.log(`  ✓ ${label}${detail ? `  ${detail}` : ''}`); }
  else { failed++; failures.push(label); console.log(`  ✗ ${label}${detail ? `  ${detail}` : ''}`); }
}
function section(t: string) { console.log(`\n${t}\n${'─'.repeat(60)}`); }
async function throwsAsync(fn: () => Promise<unknown>): Promise<Error | null> {
  try { await fn(); return null; } catch (e) { return e as Error; }
}
function throwsSync(fn: () => unknown): Error | null {
  try { fn(); return null; } catch (e) { return e as Error; }
}

const HASH = 'a'.repeat(64);
const OTHER_HASH = 'b'.repeat(64);
const T0 = new Date('2026-03-02T00:00:00Z'); // 월요일

const newOrder = (over: Partial<Parameters<typeof createOrder>[0]> = {}) =>
  createOrder({
    id: 'ord_1', productId: 'cross-report', inputHash: HASH,
    noticeGiven: true, previewProvided: true, now: T0, ...over,
  });

/** 가격은 카탈로그에서 가져온다. 값이 바뀌어도 검증이 따라오게 하려는 것이다 */
const CROSS_PRICE = CATALOG['cross-report'].priceKrw;

// ── A. 상품 ────────────────────────────────────────────────────
section('A. 상품과 미리보기');

check('상품 13종', Object.keys(CATALOG).length === 13, `${Object.keys(CATALOG).length}개`);
check('모든 상품에 갈래가 있다', Object.values(CATALOG).every((p) => CATEGORIES.some((c) => c.key === p.category)));
check('모든 상품에 후킹 질문이 있다', Object.values(CATALOG).every((p) => p.hook.endsWith('?')),
  '「재물운」이라고만 쓰면 안 눌린다');
check('갈래마다 상품이 있다', CATEGORIES.every((c) => productsIn(c.key).length > 0));
check('갈래 제목도 질문이다', CATEGORIES.every((c) => c.question.endsWith('?')));
check('식별자가 겹치지 않는다', new Set(Object.values(CATALOG).map((p) => p.id)).size === 13);
check('id 와 키가 일치', Object.entries(CATALOG).every(([k, v]) => k === v.id));

// ── 묶음 ────────────────────────────────────────────────────
check('묶음 구성이 카탈로그와 어긋나지 않는다', throwsSync(() => assertPackagesValid()) === null);
for (const pack of Object.values(PACKAGES)) {
  const m = bundleMath(pack.id);
  check(`${pack.name}: 따로 사는 것보다 싸다`, m.savedKrw > 0, `${m.individualKrw}원 → ${m.bundleKrw}원`);
  // 정가를 지어내면 표시광고법 위반이다. 구성 상품의 실제 판매가 합계만 쓴다
  check(`${pack.name}: 정가가 구성 상품 실제 가격의 합`,
    m.individualKrw === pack.members.reduce((s, id) => s + CATALOG[id].priceKrw, 0));
  check(`${pack.name}: 절약률을 내림한다 — 올려 적으면 과장이다`,
    m.percent <= (m.savedKrw / m.individualKrw) * 100, `${m.percent}%`);
}
check('가운데를 추천한다 — 극단을 피하는 심리',
  Object.values(PACKAGES).filter((p) => p.recommended).length === 1);
check('추천 묶음의 절약률이 가장 높다',
  bundleMath('samhap-pack').percent >= bundleMath('basic-pack').percent);
check('삼합 리포트를 보는 사람에게 삼합이 든 묶음만 권한다',
  packagesContaining('cross-report').every((p) => p.members.includes('cross-report')));
check('싼 것부터 권한다', (() => {
  const ps = packagesContaining('saju-report');
  return ps.every((p, i) => i === 0 || ps[i - 1].priceKrw <= p.priceKrw);
})());
check('가격이 정수 원 단위', Object.values(CATALOG).every((p) => Number.isInteger(p.priceKrw)));
check('삼합(교차검증)이 단품 중 가장 비쌈',
  Object.values(CATALOG).every((p) => p.priceKrw <= CATALOG['cross-report'].priceKrw),
  `${CATALOG['cross-report'].priceKrw}원`);
check('맛보기 상품이 가장 쌈 — 첫 결제 장벽을 낮춘다',
  Object.values(CATALOG).every((p) => p.priceKrw >= CATALOG['daily-report'].priceKrw),
  `${CATALOG['daily-report'].priceKrw}원`);
check('없는 상품은 거부', throwsSync(() => getProduct('nope')) !== null);

const long = ['첫 문단입니다. 두 문장째입니다.', '둘째 문단입니다.', '셋째 문단입니다.', '넷째 문단입니다.'].join('\n\n');
const preview = makePreview(long, 0.3);
check('미리보기가 문단 경계에서 잘림', !preview.endsWith('입') && preview.includes('첫 문단'), JSON.stringify(preview));
check('미리보기가 전체보다 짧음', preview.length < long.length, `${preview.length}자 / ${long.length}자`);
check('비율이 작아도 최소 한 문단은 나옴', makePreview(long, 0.01).length > 0);

// ── B. 주문 상태 ───────────────────────────────────────────────
section('B. 주문 상태 전이');

const o0 = newOrder();
check('생성 시 금액이 상품 가격으로 고정', o0.amountKrw === CATALOG['cross-report'].priceKrw, `${o0.amountKrw}원`);
check('생성 직후는 created', o0.status === 'created');
check('inputHash 없으면 생성 거부',
  throwsSync(() => createOrder({ id: 'x', productId: 'saju-report', inputHash: '', noticeGiven: true, previewProvided: true })) !== null);

const o1 = markPending(o0, 'pay_1');
check('created → pending', o1.status === 'pending' && o1.paymentId === 'pay_1');
check('created에서 바로 paid로 못 감',
  throwsSync(() => markPaid(o0, o0.amountKrw)) instanceof OrderTransitionError);

const o2 = markPaid(o1, o1.amountKrw, T0);
check('pending → paid', o2.status === 'paid' && o2.paidAt !== null);
check('중복 결제 확인 거부', throwsSync(() => markPaid(o2, o2.amountKrw)) instanceof OrderTransitionError);
check('금액이 다르면 paid 거부', throwsSync(() => markPaid(o1, 1)) !== null);

const o3 = markFulfilled(o2);
const o4 = markViewed(o3, T0);
check('paid → fulfilled → viewed', o4.status === 'viewed' && o4.viewedAt !== null);
check('여러 번 열람해도 최초 시점 유지',
  markViewed(o4, new Date('2026-03-05T00:00:00Z')).viewedAt === o4.viewedAt);
check('환불된 주문은 더 이상 전이 불가',
  throwsSync(() => markFulfilled(markRefunded(o2, T0))) instanceof OrderTransitionError);

// ── C. 이용권 ──────────────────────────────────────────────────
section('C. 이용권 — 결제한 그 풀이만');

check('결제 전에는 이용권 없음', !hasEntitlement(o1, HASH));
check('결제 후 이용권 생김', hasEntitlement(o2, HASH));
check('열람 후에도 이용권 유지', hasEntitlement(o4, HASH));
check('다른 명식은 같은 주문으로 못 봄', !hasEntitlement(o2, OTHER_HASH));
check('환불하면 이용권 사라짐', !hasEntitlement(markRefunded(o2, T0), HASH));

// ── D. 결제 검증 (공격 시나리오) ───────────────────────────────
section('D. 결제 검증 — 위조 시도를 막는가');

const gw = new FakeGateway();
gw.put({ paymentId: 'pay_ok', status: 'paid', amountKrw: CROSS_PRICE, merchantOrderId: 'ord_1', method: 'card', paidAt: T0.toISOString(), raw: {} });
gw.put({ paymentId: 'pay_cheap', status: 'paid', amountKrw: 100, merchantOrderId: 'ord_1', method: 'card', paidAt: T0.toISOString(), raw: {} });
gw.put({ paymentId: 'pay_pending', status: 'pending', amountKrw: CROSS_PRICE, merchantOrderId: 'ord_1', method: 'card', paidAt: null, raw: {} });
gw.put({ paymentId: 'pay_other', status: 'paid', amountKrw: CROSS_PRICE, merchantOrderId: 'ord_999', method: 'card', paidAt: T0.toISOString(), raw: {} });

const confirmed = await confirmPayment(markPending(newOrder(), 'pay_ok'), gw, 'pay_ok', T0);
check('정상 결제는 확정됨', confirmed.status === 'paid' && confirmed.paymentId === 'pay_ok');

const cheap = await throwsAsync(() => confirmPayment(markPending(newOrder(), 'pay_cheap'), gw, 'pay_cheap', T0));
check('100원 결제로 19,900원 상품 못 가져감',
  cheap instanceof PaymentVerificationError && cheap.code === 'amount_mismatch', cheap?.message);

const pending = await throwsAsync(() => confirmPayment(markPending(newOrder(), 'pay_pending'), gw, 'pay_pending', T0));
check('미승인 결제 거부',
  pending instanceof PaymentVerificationError && pending.code === 'not_paid', pending?.message);

const other = await throwsAsync(() => confirmPayment(markPending(newOrder(), 'pay_other'), gw, 'pay_other', T0));
check('남의 결제를 내 주문에 못 붙임',
  other instanceof PaymentVerificationError && other.code === 'order_mismatch', other?.message);

check('없는 결제는 조회 단계에서 실패',
  (await throwsAsync(() => confirmPayment(markPending(newOrder(), 'nope'), gw, 'nope', T0))) !== null);

// ── E. 환불 정책 ───────────────────────────────────────────────
section('E. 환불 — 전자상거래법 제17조');

const paidOrder = (over: Partial<Order> = {}): Order => ({
  ...markPaid(markPending(newOrder(), 'pay_ok'), CROSS_PRICE, T0), ...over,
});

const day = (n: number) => new Date(T0.getTime() + n * 86400000);

check('미열람 + 3일 경과 → 환불 가능',
  assessRefund(paidOrder(), day(3)).refundable);
check('미열람 + 7일 경계 → 환불 가능',
  assessRefund(paidOrder(), day(WITHDRAWAL_WINDOW_DAYS)).refundable);
check('미열람 + 8일 → 기간 경과로 불가',
  !assessRefund(paidOrder(), day(8)).refundable,
  assessRefund(paidOrder(), day(8)).reason);

const viewedFull = paidOrder({ status: 'viewed', viewedAt: T0.toISOString() });
check('열람 + 고지·미리보기 모두 있음 → 환불 불가',
  !assessRefund(viewedFull, day(1)).refundable, assessRefund(viewedFull, day(1)).basis);

const noNotice = paidOrder({ status: 'viewed', viewedAt: T0.toISOString(), noticeGiven: false });
check('열람했어도 고지를 안 했으면 환불 가능',
  assessRefund(noNotice, day(1)).refundable, assessRefund(noNotice, day(1)).reason);

const noPreview = paidOrder({ status: 'viewed', viewedAt: T0.toISOString(), previewProvided: false });
check('열람했어도 미리보기가 없었으면 환불 가능',
  assessRefund(noPreview, day(1)).refundable);

const neither = paidOrder({ status: 'viewed', viewedAt: T0.toISOString(), noticeGiven: false, previewProvided: false });
check('둘 다 없으면 사유에 둘 다 표기',
  assessRefund(neither, day(1)).reason.includes('고지') && assessRefund(neither, day(1)).reason.includes('미리보기'));

check('결제 전 주문은 환불 대상 아님', !assessRefund(newOrder(), day(1)).refundable);
check('이미 환불된 주문은 재환불 불가',
  !assessRefund(markRefunded(paidOrder(), T0), day(1)).refundable);

check('환불 가능하면 환급 기한이 나옴', assessRefund(paidOrder(), day(1)).refundDueBy !== null);
check('환불 불가면 기한 없음', assessRefund(viewedFull, day(1)).refundDueBy === null);

// 영업일 계산
check('금요일 + 3영업일 = 수요일',
  addBusinessDays(new Date('2026-03-06T00:00:00Z'), 3).toISOString().slice(0, 10) === '2026-03-11',
  addBusinessDays(new Date('2026-03-06T00:00:00Z'), 3).toISOString().slice(0, 10));
check('영업일 계산이 주말을 건너뜀',
  addBusinessDays(new Date('2026-03-06T00:00:00Z'), 1).toISOString().slice(0, 10) === '2026-03-09');

// ── F. 고지 문구 ───────────────────────────────────────────────
section('F. 결제 화면 고지');

check('철회 불가 사실을 명시', WITHDRAWAL_NOTICE.includes('청약철회가 제한'));
check('환불 가능 조건을 명시', WITHDRAWAL_NOTICE.includes('열람하지 않으셨다면'));
check('미리보기를 읽어보라고 안내', WITHDRAWAL_NOTICE.includes('미리보기'));
check('환불 안내에 처리 기한 포함',
  refundNotice(assessRefund(paidOrder(), day(1))).includes('3영업일'));

// ── G. 환불 실행 ───────────────────────────────────────────────
section('G. 환불 실행');

const gw2 = new FakeGateway();
gw2.put({ paymentId: 'pay_ok', status: 'paid', amountKrw: CROSS_PRICE, merchantOrderId: 'ord_1', method: 'card', paidAt: T0.toISOString(), raw: {} });

const outcome = await refundOrder(paidOrder(), gw2, day(1));
check('환불되면 주문이 refunded', outcome.order.status === 'refunded' && outcome.order.refundedAt !== null);
check('PG에 취소가 실제로 걸림', gw2.cancelled.length === 1 && gw2.cancelled[0].paymentId === 'pay_ok');
check('전액이 취소됨', outcome.cancelledAmountKrw === CROSS_PRICE, `${outcome.cancelledAmountKrw}원`);

const gw3 = new FakeGateway();
gw3.put({ paymentId: 'pay_ok', status: 'paid', amountKrw: CROSS_PRICE, merchantOrderId: 'ord_1', method: 'card', paidAt: T0.toISOString(), raw: {} });
const blocked = await throwsAsync(() => refundOrder({ ...viewedFull, paymentId: 'pay_ok' }, gw3, day(1)));
check('환불 불가 건은 PG를 부르기 전에 막힘', blocked !== null && gw3.cancelled.length === 0,
  '정책 판정이 먼저, 돈은 그 다음');

console.log(`\n${'═'.repeat(60)}`);
console.log(`통과 ${passed} / 실패 ${failed}`);
if (failed) { console.log('\n실패 항목:'); for (const f of failures) console.log(`  - ${f}`); process.exit(1); }
console.log('전부 통과. (네트워크 호출 없음)');
