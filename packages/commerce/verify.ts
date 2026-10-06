/**
 * 결제 도메인 검증.
 *
 * 네트워크를 타지 않는다. 가짜 게이트웨이로 공격 시나리오를 재현한다 —
 * 금액 위조, 미승인 결제 가로채기, 남의 결제 붙이기, 중복 처리.
 * 돈이 걸린 코드는 이런 걸 자동으로 막는지 매번 확인돼야 한다.
 */

import {
  CATALOG, getProduct, makePreview, CATEGORIES, productsIn,
  PACKAGES, bundleMath, packagesContaining, assertPackagesValid, needsPartner, needsChild, type PackageId,
  ALLOWED_REFS, cleanRef, createOrder, markPending, markPaid, markFulfilled, markViewed, markRefunded,
  hasEntitlement, OrderTransitionError,
  assessRefund, addBusinessDays, WITHDRAWAL_NOTICE, WITHDRAWAL_WINDOW_DAYS, refundNotice,
  FakeGateway, confirmPayment, refundOrder, PaymentVerificationError,
  type Order,
  orderable, isOrderable, upsellFor, upgradeCostKrw, calculateUpsellPrice,
  priceOf, HOLIDAY_EXTRA_MEMBER_KRW, HOLIDAY_MAX_MEMBERS,
  UPSELL_PROMO_HOURS, UPSELL_PROMO_RATE, UPSELL_AFTER_RATE, recommendNext, cutPrice,
  시각을바꾼다, isLaunchSale, REGULAR_BY_LAUNCH,
} from './src/index.ts';
import { TOPIC_LABELS } from '../saju-rules/src/topics.ts';

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

const COUNT = Object.keys(CATALOG).length;
check('상품이 스무 개는 넘는다', COUNT >= 21, `${COUNT}개`);
// 시장 1위의 24개 중 연애 계열이 71%였다. 입구를 그쪽에 둔다
const loveish = ['연애', '재회', '궁합'].reduce((n, c) => n + productsIn(c as any).length, 0);
check('연애·재회·궁합에 입구를 둔다', loveish >= 6, `${loveish}종`);
// 1위가 비워둔 자리. 여기서 기억되게 한다
check('가족 갈래가 비어 있지 않다', productsIn('가족').length >= 4, `${productsIn('가족').length}종`);
check('2인 상품은 상대 입력이 필요하다고 표시된다',
  Object.values(CATALOG).filter((p) => p.needsPartner).every((p) => needsPartner(p.id)));
check('혼자 보는 상품은 상대를 요구하지 않는다', !needsPartner('saju-report'));
const CHILD_PRODUCTS = ['child-report', 'child-aptitude-report', 'naming-report', 'naming-plus-report'] as const;
check('아이 상품 네 개는 아이 생년월일을 요구한다',
  CHILD_PRODUCTS.every((id) => needsChild(id) && CATALOG[id].needsChild === true));
check('아이 상품 묶음도 아이 생년월일을 요구한다',
  orderable('child-2').needsChild && orderable('child-3').needsChild && orderable('birth-2').needsChild && orderable('birth-3').needsChild);
check('어른 상품은 아이 생년월일을 요구하지 않는다', !needsChild('saju-report') && !orderable('saju-report').needsChild);
/*
 * 터진 뒤에 적은 것 (2026-10-06): 작명은 아이가 태어나기 전에 맡기는 일이
 * 많고 예정일조차 모르는 부모가 적지 않다. 작명만 날짜 없이 받는다.
 *
 * 아이의 사주로 풀이를 적는 상품(아이 사주·적성·진학)은 날짜가 없으면
 * 아무것도 못 쓴다. 그쪽은 그대로 받는다.
 */
check('작명 둘만 아이 생년월일 없이 받는다',
  Object.values(CATALOG).filter((p) => p.childDateOptional === true).map((p) => p.id).sort().join(',')
  === 'naming-plus-report,naming-report');
check('작명은 단품으로도 날짜 없이 받는다',
  orderable('naming-report').childDateOptional && orderable('naming-plus-report').childDateOptional);
check('아이 사주 리포트는 날짜를 꼭 받는다', !orderable('child-report').childDateOptional);
check('아이 사주가 든 묶음은 날짜를 꼭 받는다',
  !orderable('child-2').childDateOptional && !orderable('child-3').childDateOptional);
check('날짜 없이 받는 상품은 설명에 그 길을 적어 둔다',
  Object.values(CATALOG).filter((p) => p.childDateOptional === true)
    .every((p) => p.description.includes('「아직 모릅니다」') && p.description.includes('사주를 보지 않고')));
check('모든 상품에 갈래가 있다', Object.values(CATALOG).every((p) => CATEGORIES.some((c) => c.key === p.category)));
check('모든 상품에 후킹 질문이 있다', Object.values(CATALOG).every((p) => p.hook.endsWith('?')),
  '「재물운」이라고만 쓰면 안 눌린다');
check('갈래마다 상품이 있다', CATEGORIES.every((c) => productsIn(c.key).length > 0));
check('갈래 제목도 질문이다', CATEGORIES.every((c) => c.question.endsWith('?')));
check('식별자가 겹치지 않는다', new Set(Object.values(CATALOG).map((p) => p.id)).size === COUNT);
check('id 와 키가 일치', Object.entries(CATALOG).every(([k, v]) => k === v.id));
check('charm 토픽 label과 charm-report 카탈로그 이름이 일치한다',
  TOPIC_LABELS.charm.label === CATALOG['charm-report'].name);

// 삼합(49,000원)이 부담스러운 손님이 한 갈래씩 고른다. 그래도 우리가 잘하는
// 「대조」는 남아 있어야 한다 — 사주 하나만 파는 것은 어디서나 한다
const PICKS = ['face-palm-report', 'saju-palm-report', 'saju-face-report'] as const;
check('골라 보기 세 가지가 있다', PICKS.every((id) => CATALOG[id]));
check('골라 보기는 삼합보다 싸다',
  PICKS.every((id) => CATALOG[id].priceKrw < CATALOG['cross-report'].priceKrw));
check('골라 보기는 낱개 하나보다 비싸다',
  PICKS.every((id) => CATALOG[id].priceKrw > CATALOG['saju-report'].priceKrw));
// 얼굴과 손만 보는 것은 생년월일이 없어도 된다. 그게 이 상품의 존재 이유다
check('얼굴과 손은 상대가 필요 없다', !CATALOG['face-palm-report'].needsPartner);

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
/*
 * 주제마다 2종·3종 두 칸이 있고, 그중 **하나만** 추천이어야 한다.
 * 둘 다 추천이면 추천이 아니고, 아무것도 추천하지 않으면 손님이 단품에 머문다.
 * 예전에는 묶음이 넷뿐이라 「전체에서 하나」였다.
 */
check('주제마다 추천이 하나씩', (() => {
  const byTheme = new Map<string, number>();
  for (const p of Object.values(PACKAGES)) {
    const theme = p.id.replace(/-[23]$/, '');
    byTheme.set(theme, (byTheme.get(theme) ?? 0) + (p.recommended ? 1 : 0));
  }
  return [...byTheme.values()].every((n) => n === 1);
})());
check('추천은 싼 칸에 붙인다 — 얹는 금액이 작아야 얹는다',
  Object.values(PACKAGES).every((p) => !p.recommended || p.id.endsWith('-2')));
check('묶음마다 절약률이 20%를 넘는다',
  Object.values(PACKAGES).every((p) => bundleMath(p.id).percent >= 20));
check('삼합 리포트를 보는 사람에게 삼합이 든 묶음만 권한다',
  packagesContaining('cross-report').every((p) => p.members.includes('cross-report')));
check('싼 것부터 권한다', (() => {
  const ps = packagesContaining('saju-report');
  return ps.every((p, i) => i === 0 || ps[i - 1].priceKrw <= p.priceKrw);
})());
check('가격이 정수 원 단위', Object.values(CATALOG).every((p) => Number.isInteger(p.priceKrw)));
/*
 * 작명은 리포트가 아니다.
 *
 * 리포트는 한 번 써서 한 번 드리는 것이라 값이 분량으로 정해진다. 작명은
 * **마음에 드는 것이 나올 때까지 다시 짓는 일**이라 값이 분량으로 정해지지
 * 않는다. 그래서 「삼합이 제일 비싸다」는 리포트들 사이에서만 성립한다.
 */
const MADE_TO_ORDER = new Set(['naming-report', 'naming-plus-report']);
const reports = Object.values(CATALOG).filter((p) => !MADE_TO_ORDER.has(p.id));

check('삼합(교차검증)이 리포트 중 가장 비쌈',
  reports.every((p) => p.priceKrw <= CATALOG['cross-report'].priceKrw),
  `${CATALOG['cross-report'].priceKrw}원`);
check('맛보기 상품이 가장 쌈 — 첫 결제 장벽을 낮춘다',
  Object.values(CATALOG).every((p) => p.priceKrw >= CATALOG['daily-report'].priceKrw),
  `${CATALOG['daily-report'].priceKrw}원`);
check('다시 짓는 일은 제일 비싼 리포트만큼은 받는다 — 값이 분량이 아니라 손이 든 만큼이다',
  [...MADE_TO_ORDER].every((id) => CATALOG[id].priceKrw >= CATALOG['cross-report'].priceKrw),
  [...MADE_TO_ORDER].map((id) => `${CATALOG[id].priceKrw}원`).join(' · '));
check('겹침까지 보는 쪽이 더 비싸다',
  CATALOG['naming-plus-report'].priceKrw > CATALOG['naming-report'].priceKrw);
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


section('살 수 있는 것 — 단품과 묶음');

check('단품은 자기 자신 한 편', orderable('cross-report').members.length === 1);
check('단품 값은 카탈로그에서', orderable('cross-report').priceKrw === CATALOG['cross-report'].priceKrw);
check('묶음도 살 수 있다', isOrderable('self-3'));
check('모르는 것은 못 산다', !isOrderable('free-lunch'));

let threw = false;
try { orderable('free-lunch'); } catch { threw = true; }
check('모르는 것을 사려 하면 던진다', threw);

for (const pack of Object.values(PACKAGES)) {
  const o = orderable(pack.id);
  const math = bundleMath(pack.id);
  check(`${pack.name} 값은 묶음표에서`, o.priceKrw === math.bundleKrw);
  check(`${pack.name} 편 수가 맞는다`, o.members.length === pack.members.length);
  // 미리보기로 다 읽히면 살 이유가 없어진다. 제일 인색한 쪽에 맞춘다
  check(`${pack.name} 미리보기 분량은 제일 적은 것에 맞춘다`,
    o.previewRatio === Math.min(...pack.members.map((m) => CATALOG[m].previewRatio)));
  // 궁합이 든 묶음은 상대의 생년월일이 있어야 만들 수 있다
  check(`${pack.name} 상대 필요 여부가 구성에서 온다`,
    o.needsPartner === pack.members.some((m) => CATALOG[m].needsPartner === true));
}

// 얹기 쉬우려면 제일 싼 것부터 내밀어야 한다
const offer = upsellFor('cross-report');
check('단품을 품은 묶음을 찾아 준다', offer !== null);
if (offer) {
  const all = Object.values(PACKAGES).filter((p) => (p.members as string[]).includes('cross-report'));
  check('그중 제일 싼 것을 내민다',
    offer.priceKrw === Math.min(...all.map((p) => bundleMath(p.id).bundleKrw)));
  check('얹는 금액은 두 값의 차',
    upgradeCostKrw('cross-report', offer.id) === offer.priceKrw - CATALOG['cross-report'].priceKrw);
  check('얹는 금액은 0보다 크다', upgradeCostKrw('cross-report', offer.id) > 0);
}
check('어느 묶음에도 없으면 안 내민다',
  Object.values(CATALOG).every((p) => {
    const has = Object.values(PACKAGES).some((k) => (k.members as string[]).includes(p.id));
    return has === (upsellFor(p.id) !== null);
  }));

/*
 * 인원에 따라 값이 붙는 상품.
 *
 * 값이 입력에 따라 달라지는 상품은 이것 하나뿐이다. **화면이 보낸 금액을
 * 쓰지 않는다**는 규칙이 여기서 깨지면 손님이 값을 깎아 보낼 수 있다.
 */
{
  const 명절 = 'family-holiday-report' as const;
  check('넷까지는 값이 같다',
    [1, 2, 3, 4].every((n) => priceOf(명절, n) === CATALOG[명절].priceKrw));
  check('다섯째부터 한 명당 더 붙는다',
    priceOf(명절, 5) === CATALOG[명절].priceKrw + HOLIDAY_EXTRA_MEMBER_KRW
    && priceOf(명절, 6) === CATALOG[명절].priceKrw + 2 * HOLIDAY_EXTRA_MEMBER_KRW);
  check('상한을 넘겨도 더 받지 않는다',
    priceOf(명절, 99) === priceOf(명절, HOLIDAY_MAX_MEMBERS));
  check('인원을 안 적으면 한 명으로 본다', priceOf(명절) === CATALOG[명절].priceKrw);
  check('다른 상품은 인원이 값을 바꾸지 않는다',
    Object.keys(CATALOG).filter((id) => id !== 명절)
      .every((id) => [1, 5, 99].every((n) => priceOf(id as never, n) === CATALOG[id as never].priceKrw)));

  // 주문 금액도 같은 규칙을 따라야 한다. 여기가 실제로 카드에 긁히는 값이다
  const 주문 = (n: number) => createOrder({
    id: 'ord_x', productId: 명절, inputHash: 'h', noticeGiven: true, previewProvided: true, memberCount: n,
  }).amountKrw;
  check('주문 금액이 표의 규칙과 같다',
    [1, 4, 5, 6, 99].every((n) => 주문(n) === priceOf(명절, n)));
  check('인원을 안 넘기면 기본값으로 만든다',
    createOrder({ id: 'o', productId: 명절, inputHash: 'h', noticeGiven: true, previewProvided: true })
      .amountKrw === CATALOG[명절].priceKrw);
}


// 광고 유입 식별자 (ref)
{
  check('아는 여덟 개가 아닌 ref 는 빈 값이 된다',
    cleanRef('unknown') === null
    && cleanRef('hack<script>') === null
    && cleanRef('sidaek!') === null
    && cleanRef('a'.repeat(25)) === null
    && cleanRef('') === null
    && cleanRef(undefined) === null
    && cleanRef(null) === null
    && ALLOWED_REFS.length === 8
    && ALLOWED_REFS.every((r) => cleanRef(r) === r && cleanRef(r.toUpperCase()) === r));

  const baseInput = {
    id: 'ord_ref_test',
    productId: 'family-holiday-report' as const,
    inputHash: 'hash123',
    noticeGiven: true,
    previewProvided: true,
  };

  const oNoRef = createOrder({ ...baseInput });
  const oWithRef = createOrder({ ...baseInput, ref: 'sidaek' });
  const oBadRef = createOrder({ ...baseInput, ref: 'invalid_ad' });

  check('ref 가 없어도 주문이 만들어진다',
    oNoRef.id === 'ord_ref_test' && oNoRef.ref === null);

  check('ref 가 값을 바꾸지 않는다 (같은 주문이면 ref 가 달라도 금액이 같다)',
    oNoRef.amountKrw === oWithRef.amountKrw
    && oNoRef.amountKrw === oBadRef.amountKrw
    && oWithRef.ref === 'sidaek'
    && oBadRef.ref === null);
}

// ── H. 이어사기 12시간 한정 할인 정책 ─────────────────────────
section('H. 이어사기 12시간 한정 할인 — 전자상거래법 및 표시광고법 준수');

/*
 * 터진 뒤에 적은 것 (2026-09-30): 리포트 끝 이어사기에서 임의로 할인율을 부풀리거나 가짜 타이머를 쓰면
 * 전자상거래법 및 표시광고법 위반이므로, 가격 셋(단품가, 정규차액, 12시간할인가)은 catalog.ts 에서만 오고,
 * viewedAt 기준 12시간 판정으로 5,900원/8,900원으로 엄격히 갈리며, 단품가를 절대 초과하지 않음을 검증한다.
 */
{
  const baseProductId = 'wealth-report';
  const packOffer = upsellFor(baseProductId);
  check('돈그릇 상품의 이어사기 묶음이 존재한다', packOffer !== null && packOffer.id === 'money-2');

  if (packOffer) {
    const singlePrice = CATALOG['career-report'].priceKrw; // 14,900원
    const regularUpgrade = upgradeCostKrw(baseProductId, packOffer.id); // 8,900원
    const promoPrice = cutPrice(regularUpgrade, UPSELL_PROMO_RATE); // 5,900원

    // 1) 이어사기 값 셋이 catalog.ts 에서만 온다
    check('이어사기 값 셋이 catalog.ts 에서만 온다',
      singlePrice === CATALOG['career-report'].priceKrw &&
      regularUpgrade === PACKAGES[packOffer.id as PackageId].priceKrw - CATALOG[baseProductId].priceKrw &&
      singlePrice === 14900 && regularUpgrade === 8900 && promoPrice === 5900,
      `단품: ${singlePrice}원, 정규차액: ${regularUpgrade}원, 12시간특가: ${promoPrice}원`);

    const viewTime = new Date('2026-09-30T10:00:00Z');
    const within12h = new Date('2026-09-30T18:00:00Z'); // 8시간 경과 (12시간 이내)
    const after12h = new Date('2026-09-30T23:00:00Z'); // 13시간 경과 (12시간 초과)

    const promoCalc = calculateUpsellPrice(baseProductId, packOffer.id, viewTime, within12h);
    const expiredCalc = calculateUpsellPrice(baseProductId, packOffer.id, viewTime, after12h);

    // 2) 12시간 안이면 5,900원, 지나면 8,900원으로 갈린다
    check('12시간 안이면 5,900원으로 계산된다 (차액 8,900원에서 깎음)', promoCalc.isPromo === true && promoCalc.currentPriceKrw === 5900,
      `현재가: ${promoCalc.currentPriceKrw}원, 남은시간: ${promoCalc.remainingFormatted}`);
    check('12시간이 지나면 8,900원으로 갈린다', expiredCalc.isPromo === false && expiredCalc.currentPriceKrw === 8900,
      `현재가: ${expiredCalc.currentPriceKrw}원`);

    // 3) 어떤 경우에도 단품값(14,900원)보다 비싸지지 않는다
    const allOrderables = Object.keys(CATALOG);
    const neverExceedsSingle = allOrderables.every((pid) => {
      const u = upsellFor(pid);
      if (!u) return true;
      const cWithin = calculateUpsellPrice(pid, u.id, viewTime, within12h);
      const cAfter = calculateUpsellPrice(pid, u.id, viewTime, after12h);
      return cWithin.currentPriceKrw <= cWithin.singlePriceKrw &&
             cAfter.currentPriceKrw <= cAfter.singlePriceKrw;
    });
    check('어떤 경우에도 이어사기 금액이 단품값(14,900원 등)보다 비싸지지 않는다', neverExceedsSingle);
  }
}

// ── I. 오픈 기념가 자동 전환 검증 ─────────────────────────
section('I. 오픈 기념가 자동 전환 — 11월 1일 0시에 자동으로 정가로 전환');
{
  const oct15 = () => Date.UTC(2026, 9, 15, 0, 0, 0);
  const nov01 = () => Date.UTC(2026, 9, 31, 15, 1, 0); // 11월 1일 0시 1분 (KST)
  const nov02 = () => Date.UTC(2026, 10, 2, 0, 0, 0); // 11월 2일

  const REGULAR_EXPECTED: Record<number, number> = {
    1900: 2900,
    9900: 13900,
    14900: 26900,
    19900: 26900,
    24900: 33900,
    29900: 39900,
    34900: 46900,
    37900: 49900,
    39900: 53900,
    44900: 59900,
    59000: 78900,
    69000: 92900,
    89900: 119900,
    149000: 198900,
  };

  try {
    // ① 10월 15일에는 모든 상품값이 지금 파는 값과 같다
    시각을바꾼다(oct15);
    check('10월 15일에는 오픈 기념가 기간이다', isLaunchSale() === true);
    const oct15Prices = Object.values(CATALOG).map(p => ({ id: p.id, price: p.priceKrw }));
    const holidayOct15 = CATALOG['family-holiday-report'].priceKrw;

    // 오픈가가 전부 REGULAR_BY_LAUNCH 에 키가 있다 (없는 값이 하나라도 있으면 실패)
    const openKeysValid = Object.values(CATALOG).every(p => {
      return p.priceKrw in REGULAR_BY_LAUNCH;
    });
    check('오픈가가 전부 REGULAR_BY_LAUNCH 에 키가 있다', openKeysValid);

    // 상품 34개의 정가가 오픈가보다 반드시 크거나 같다
    const productCount = Object.keys(CATALOG).length;
    const regularGteLaunch = Object.values(CATALOG).every(p => {
      const reg = p.regularKrw ?? p.priceKrw;
      return reg >= p.priceKrw;
    });
    check('상품 34개의 정가가 오픈가보다 반드시 크거나 같다', productCount === 34 && regularGteLaunch, `총 상품 수: ${productCount}`);

    // 썸 궁합 29900 / 궁합 계열 37900 / 정가 39900·49900 을 숫자로 못 박아라
    const crushOk = CATALOG['crush-compat-report'].priceKrw === 29900 && CATALOG['crush-compat-report'].regularKrw === 39900;
    const compatGroupIds = ['reunion-report', 'compat-report', 'child-report', 'child-aptitude-report', 'parent-child-report'] as const;
    const compatGroupOk = compatGroupIds.every(id => CATALOG[id].priceKrw === 37900 && CATALOG[id].regularKrw === 49900);
    check('썸 궁합 29900 / 궁합 계열 37900 / 정가 39900·49900 을 숫자로 못 박음', crushOk && compatGroupOk);

    // 묶음 16개의 정가가 그 묶음 오픈가보다 크다 (11월 1일에 값이 내려가면 안 된다)
    const packageCount = Object.keys(PACKAGES).length;
    const bundlesRegularGtLaunch = Object.values(PACKAGES).every(pack => pack.regularKrw > pack.priceKrw);
    check('묶음 16개의 정가가 그 묶음 오픈가보다 크다', packageCount === 16 && bundlesRegularGtLaunch, `총 묶음 수: ${packageCount}`);

    // ② 11월 1일 0시 1분에는 모든 상품값이 REGULAR_BY_LAUNCH 의 값과 같다
    시각을바꾼다(nov01);
    check('11월 1일 0시 1분에는 오픈 기념가가 끝났다', isLaunchSale() === false);

    const nov01AllRegular = Object.values(CATALOG).every(p => {
      if (p.id === 'family-holiday-report') return p.priceKrw === 39900;
      const launch = oct15Prices.find(x => x.id === p.id)!.price;
      const expected = REGULAR_EXPECTED[launch] ?? launch;
      return p.priceKrw === expected;
    });
    check('11월 1일 0시 1분에는 모든 상품값이 REGULAR_BY_LAUNCH 의 값과 같다', nov01AllRegular);

    // ③ 명절 가족운세는 두 시각 모두 39,900원이다
    const holidayNov01 = CATALOG['family-holiday-report'].priceKrw;
    check('명절 가족운세는 두 시각 모두 39,900원이다', holidayOct15 === 39900 && holidayNov01 === 39900);

    // ④ 시각을바꾼다() 로 11월 2일로 돌려 놓고도 묶음 16개가 전부 「따로 사면」보다 싸다
    시각을바꾼다(nov02);
    const bundlesCheaperNov02 = Object.values(PACKAGES).every(pack => {
      const math = bundleMath(pack.id);
      return math.savedKrw > 0;
    });
    check('시각을바꾼다() 로 11월 2일로 돌려 놓고도 묶음 16개가 전부 「따로 사면」보다 싸다', packageCount === 16 && bundlesCheaperNov02);
  } finally {
    시각을바꾼다(null);
  }
}

// ── J. 리포트 끝 추천(recommendNext) 검증 ──────────────────
section('J. 리포트 끝 추천 3개 — 손님 질문에 맞춰 고르고 할인을 크게 표시');
{
  const allProductIds = Object.keys(CATALOG);
  const now = new Date('2026-10-15T12:00:00Z');
  const viewTime = new Date('2026-10-15T10:00:00Z'); // 2시간 전 (12시간 안)
  const after12h = new Date('2026-10-16T00:00:00Z'); // 14시간 후 (12시간 지남)

  // ① 모든 상품 34개에 대해 recommendNext() 가 하나 이상을 돌려준다
  const allHaveAtLeastOne = allProductIds.every((pid) => {
    const recs = recommendNext(pid, null, viewTime, now);
    return recs && recs.length >= 1;
  });
  check('① 모든 상품 34개에 대해 recommendNext() 가 하나 이상을 돌려준다', allHaveAtLeastOne, `총 상품 수: ${allProductIds.length}`);

  // ② 돌려준 값이 그 상품 값보다 절대 크지 않다
  const neverExceedsOriginal = allProductIds.every((pid) => {
    const recsWithin = recommendNext(pid, '이사하고 싶어요', viewTime, now);
    const recsAfter = recommendNext(pid, '이사하고 싶어요', viewTime, after12h);
    const okWithin = recsWithin.every((r) => r.currentPriceKrw <= r.singlePriceKrw);
    const okAfter = recsAfter.every((r) => r.currentPriceKrw <= r.singlePriceKrw);
    return okWithin && okAfter;
  });
  check('② 돌려준 값이 그 상품 값보다 절대 크지 않다', neverExceedsOriginal);

  // ③ 14,900원짜리는 12시간 안 5,900원, 지난 뒤 8,900원이다
  const p14900 = Object.values(CATALOG).find((p) => p.priceKrw === 14900);
  let check3Ok = false;
  if (p14900) {
    const otherId = Object.keys(CATALOG).find((id) => id !== p14900.id)!;
    const recs12h = recommendNext(otherId, null, viewTime, now);
    const r14900_12h = recs12h.find((r) => r.singlePriceKrw === 14900);
    const recsAfter = recommendNext(otherId, null, viewTime, after12h);
    const r14900_after = recsAfter.find((r) => r.singlePriceKrw === 14900);
    if (r14900_12h && r14900_after) {
      check3Ok = r14900_12h.currentPriceKrw === 9900 && r14900_after.currentPriceKrw === 11900;
    } else {
      const { cutPrice } = await import('./src/orderable.ts');
      check3Ok = cutPrice(14900, UPSELL_PROMO_RATE) === 9900 && cutPrice(14900, UPSELL_AFTER_RATE) === 11900;
    }
  }
  check('③ 14,900원짜리는 12시간 안 9,900원, 지난 뒤 11,900원이다', check3Ok);

  /*
   * 이어보기 값이 제값의 절반 아래로 내려가면 안 된다.
   *
   * 터진 뒤에 적은 것 (2026-10-02): 60% 할인이라 신년운세(24,900원)가
   * 9,900원까지 내려갔다. 한 번 그 값을 본 손님에게는 그게 그 상품의 값이 된다.
   * 깎는 것은 한 번 더 사게 하는 값이지 제값을 지우는 것이 아니다.
   */
  {
    const { cutPrice: cp } = await import('./src/orderable.ts');
    const 너무싼것: string[] = [];
    for (const p of Object.values(CATALOG)) {
      const 깎은값 = cp(p.priceKrw, UPSELL_PROMO_RATE);
      if (p.priceKrw >= 9900 && 깎은값 < p.priceKrw * 0.5) 너무싼것.push(`${p.name} ${p.priceKrw}→${깎은값}`);
    }
    check('이어보기 값이 제값의 절반 아래로 내려가지 않는다', 너무싼것.length === 0, 너무싼것.join(', '));
    /*
     * 터진 뒤에 적은 것 (2026-10-02): 묶음 이어사기의 12시간 「특가」가
     * 시간이 지난 뒤 값보다 비싼 적이 있었다. 특가는 늘 더 싸야 한다.
     */
    for (const base of ['wealth-report', 'career-report'] as const) {
      const pack = upsellFor(base);
      if (!pack) continue;
      const v = new Date('2026-09-30T10:00:00Z');
      const 안 = calculateUpsellPrice(base, pack.id as PackageId, v.toISOString(), new Date('2026-09-30T14:00:00Z'));
      const 밖 = calculateUpsellPrice(base, pack.id as PackageId, v.toISOString(), new Date('2026-09-30T23:00:00Z'));
      check(`${base} 묶음 이어사기 특가가 시간 지난 뒤보다 싸다`,
        안.currentPriceKrw < 밖.currentPriceKrw, `특가 ${안.currentPriceKrw} vs 지난뒤 ${밖.currentPriceKrw}`);
    }
    check('이어보기 할인율이 한 곳에서만 온다 (30% / 20%)',
      UPSELL_PROMO_RATE === 0.30 && UPSELL_AFTER_RATE === 0.20,
      `지금 ${UPSELL_PROMO_RATE} / ${UPSELL_AFTER_RATE}`);
    check('12시간이 지나면 값이 더 비싸진다 (깎이는 폭이 줄어든다)',
      UPSELL_AFTER_RATE < UPSELL_PROMO_RATE);
  }

  // ④ 「이사」가 든 질문에 시기 또는 가족 갈래가 첫 장에 온다
  const isaRecs = recommendNext('saju-report', '아들 근처로 이사 가고 싶은데 어떨지', viewTime, now);
  const firstCat = isaRecs[0]?.nextProduct ? CATALOG[isaRecs[0].nextProduct.id].category : null;
  check('④ 「이사」가 든 질문에 시기 또는 가족 갈래가 첫 장에 온다', firstCat === '시기' || firstCat === '가족', `첫 추천 갈래: ${firstCat}`);

  // ⑤ 돌려준 셋 안에 같은 상품이 두 번 들어가지 않는다
  const noDuplicates = allProductIds.every((pid) => {
    const recs = recommendNext(pid, '아들 근처로 이사 가고 돈 벌고 취업', viewTime, now);
    const ids = recs.map((r) => r.nextProduct?.id).filter(Boolean);
    const uniqueIds = new Set(ids);
    return ids.length === uniqueIds.size;
  });
  check('⑤ 돌려준 셋 안에 같은 상품이 두 번 들어가지 않는다', noDuplicates);
}

console.log(`\n${'═'.repeat(60)}`);
console.log(`통과 ${passed} / 실패 ${failed}`);
if (failed) { console.log('\n실패 항목:'); for (const f of failures) console.log(`  - ${f}`); process.exit(1); }
console.log('전부 통과. (네트워크 호출 없음)');
