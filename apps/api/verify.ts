/**
 * 구매 흐름 전체 검증.
 *
 * 실제 HTTP 서버를 띄우고 fetch로 두드린다. 다만 게이트웨이는 가짜고
 * 리포트 생성기도 가짜라서 **돈이 한 푼도 들지 않는다.**
 * 결제 흐름은 손으로 확인하기 가장 번거로운 영역이라, 여기가 자동화돼야 한다.
 */

import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  CATALOG, FakeGateway, markPaid, markPending, createOrder,
  PACKAGES, bundleMath, orderable, upsellFor,
  INVITE_DISCOUNT_KRW, INVITE_MIN_ORDER_KRW,
} from '../../packages/commerce/src/index.ts';
import { loadBusinessInfo, SPIRITS, CONTENTS_FOR, renderCheckoutPage } from '../../packages/site-policy/src/index.ts';
import { CATEGORIES, maxLaunchDiscountPercent, isLaunchSale } from '../../packages/commerce/src/catalog.ts';
import { findSpiritVideos } from './src/images.ts';
import { createApi, MemoryOrderStore, checkInviteRateLimit, recordInviteCheckFail, inviteCheckAttempts, validateReading } from './src/server.ts';
import { buildPayload } from './src/payload.ts';
import { buildPreview } from './src/preview.ts';
import { maskPreviewText } from './src/preview-sections.ts';
import { cacheKey } from '../../packages/report/src/cache.ts';
import { StandbyGateway, standbyGenerate } from './src/standby.ts';
import { MemoryReferralStore } from '../../packages/store/src/index.ts';

let passed = 0, failed = 0, skipped = 0;
const failures: string[] = [];
function check(label: string, ok: boolean | null, detail = '') {
  if (ok === null) {
    skipped++;
    console.log(`  - ${label} (건너뜀: ${detail || '환경 조건 불일치'})`);
  } else if (ok) {
    passed++;
    console.log(`  ✓ ${label}${detail ? `  ${detail}` : ''}`);
  } else {
    failed++;
    failures.push(label);
    console.log(`  ✗ ${label}${detail ? `  ${detail}` : ''}`);
  }
}
function section(t: string) { console.log(`\n${t}\n${'─'.repeat(60)}`); }

const gateway = new FakeGateway();
const orders = new MemoryOrderStore();
const referrals = new MemoryReferralStore();
let generateCalls = 0;
/** 생성기가 실제로 무엇을 받았는지. 화면의 약속이 리포트까지 가는지 본다 */
const generateArgs: { kind: string; subject: string; question?: string }[] = [];

/** 심사에 통과할 만큼 채워진 사업자 정보. 실제 값이 아니다 */
const business = loadBusinessInfo({
  SITE_NAME: '사주보다', SITE_URL: 'https://example.kr',
  BIZ_COMPANY: '주식회사 예시', BIZ_REPRESENTATIVE: '홍길동',
  BIZ_REG_NUMBER: '220-81-62517', BIZ_MAIL_ORDER_NUMBER: '2026-서울강남-00001',
  BIZ_ADDRESS: '서울특별시 강남구 테헤란로 1', BIZ_PHONE: '02-0000-0000',
  BIZ_EMAIL: 'help@example.kr',
});

const handler = createApi({
  gateway,
  orders,
  business,
  referrals,
  generate: async ({ kind, subject, question }) => {
    generateCalls++;
    generateArgs.push({ kind, subject, question });
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

const page = async (path: string) => {
  const res = await fetch(`${base}${path}`);
  return { status: res.status, type: res.headers.get('content-type') ?? '', html: await res.text() };
};

const BIRTH = { date: '1990-05-15', time: '14:30', gender: '남' as const, name: '민수' };
const reading = { productId: 'cross-report', birth: BIRTH, face: { foreheadWidth: 'wide' }, palm: { lifeLength: 'long' } };

// ── A. 상품·미리보기 ───────────────────────────────────────────
section('A. 상품과 미리보기 (결제 전, 원가 0)');

const products = await api('GET', '/api/products');
// 상품은 늘어난다. 개수를 못 박으면 하나 늘 때마다 여기가 깨진다 —
// 봐야 할 것은 「카탈로그에 있는 것이 다 나오는가」다
const { CATALOG: LIVE } = await import('../../packages/commerce/src/catalog.ts');
check('상품 목록 조회',
  products.status === 200 && products.body.products.length === Object.keys(LIVE).length,
  `${products.body.products.length}종`);
check('목록에 청약철회 고지 포함', products.body.notice.includes('청약철회가 제한'));

const preview = await api('POST', '/api/preview', reading);
check('미리보기 응답', preview.status === 200);
const sections = preview.body.preview.sections || [];
check('손님 자료로 만든 맛보기 세 대목', sections.length === 3);
check('세 대목에 각각 가린 낱말이 있다', sections.length === 3 && sections.every((s: any) => s.parts.some((p: any) => p.hidden)));
check('세 대목에서 가린 글자가 30% 이하다', sections.length === 3 && sections.every((s: any) => {
  const all = s.parts.reduce((n: number, p: any) => n + [...p.text].length, 0);
  const hidden = s.parts.filter((p: any) => p.hidden).reduce((n: number, p: any) => n + [...p.text].length, 0);
  return all > 0 && hidden / all <= 0.3;
}));
check('가림 표시가 없는 글도 규칙으로 가린다', maskPreviewText('손님은 2027년에 남쪽으로 움직이시면 좋습니다.').some((p) => p.hidden));
check('가림 표시가 있는 글에서도 문장은 읽힌다', (() => {
  const parts = maskPreviewText('손님은 [[가림:2027년 남쪽]]에 움직이시면 좋습니다.');
  return parts.some((p) => p.hidden) && parts.some((p) => !p.hidden && p.text.includes('손님은'));
})());
/*
 * 터진 뒤에 적은 것 (2026-10-05): 가린 낱말이 「손님의」였고, 문장은
 * 「…적습니다입니다」로 끝났다. 가릴 것은 결론을 가르는 말이고,
 * 사람이 읽을 수 없는 문장은 안 내보낸다.
 */
check('조사·군더더기를 가리지 않는다', (() => {
  const 군더더기 = ['손님의', '손님은', '자료', '결과', '그리고', '하지만'];
  const parts = maskPreviewText('손님의 자료에서 나온 결과를 살펴보니 든든한 날개가 됩니다.');
  return parts.filter((p) => p.hidden).every((p) => !군더더기.includes(p.text.trim()));
})(), '가려 봐야 감출 것이 없는 말을 가리면 가린 척만 하는 것이다');
check('끝 서술어가 받는 알맹이를 가린다', (() => {
  const parts = maskPreviewText('모든 얽힌 실타래가 자연스럽게 풀립니다.');
  return parts.some((p) => p.hidden && p.text.trim() === '실타래');
})());
check('표시한 자리를 잘라도 낱말이 반 토막 나지 않는다', (() => {
  const 표시 = '2027년 남쪽';
  const parts = maskPreviewText(`손님은 [[가림:${표시}]]에 움직이시면 좋습니다.`);
  const hidden = parts.filter((p) => p.hidden).map((p) => p.text).join('');
  /* 표시한 자리 전부이거나, 낱말 경계에서 끊긴 앞도막이어야 한다 */
  return hidden === 표시 || 표시.startsWith(hidden + ' ');
})(), '「2027년 남」처럼 낱말이 반 토막 나면 손님이 읽다가 멈춘다');
check('세 대목의 문장이 사람이 읽을 수 있게 끝난다',
  sections.length === 3 && sections.every((s: any) => {
    const 글 = s.parts.map((p: any) => p.text).join('');
    return !/(?:입니다|습니다|합니다)입니다/.test(글) && !/다입니다/.test(글) && /[.!?。]$/.test(글.trim());
  }), '「…적습니다입니다」 같은 말이 손님 눈에 나갔다');
check('가린 낱말이 큰 글씨에 그대로 비치지 않는다',
  sections.length === 3 && sections.every((s: any) => {
    const 위 = (s.title || '') + ' ' + (s.lead || '');
    return s.parts.filter((p: any) => p.hidden).every((p: any) => !위.includes(p.text.trim()));
  }), '가려도 위에서 다 보이면 가린 것이 아니다');
check('세 대목이 근거를 데리고 온다',
  sections.length === 3 && sections.every((s: any) => typeof s.basis === 'string' && s.basis.length > 0));
const embeddedCheckout = renderCheckoutPage(business, '', CATALOG['compat-report'],
  { storeId: 'test', channelKey: 'test' }, false, true);
/*
 * 터진 뒤에 적은 것 (2026-10-05): 덮개 결제창에는 기간·상대·성 칸이 없다.
 * 상품 화면에서 이미 받았기 때문이다. 그런데 결제창이 그 빈 칸을 읽고
 * 「적어 주십시오」로 막아서, **기간을 받는 상품은 아예 결제가 안 됐다.**
 */
{
  const 기간상품 = renderCheckoutPage(business, '', CATALOG['pick-report'],
    { storeId: 'test', channelKey: 'test' }, false, true);
  check('덮개 결제창은 상품 화면에서 받은 기간을 쓴다',
    기간상품.includes('칸또는받아둔것') && 기간상품.includes("받아둔것.range"),
    '칸이 없다고 막으면 결제가 아예 안 된다');
  check('덮개 결제창은 상품 화면에서 받은 수술 시각을 쓴다',
    기간상품.includes("(loadReading() || {}).pick"));
}

check('결제 덮개에서 사주·상대 입력칸이 보이지 않는다',
  !embeddedCheckout.includes('id="birthDate"')
  && !embeddedCheckout.includes('id="partnerDate"')
  && !embeddedCheckout.includes('id="coUserCard"'));
check('결제 덮개의 광고 동의는 처음부터 꺼져 있다',
  embeddedCheckout.includes('id="coAgreeMarketing"') && !/id="coAgreeMarketing"[^>]*checked/.test(embeddedCheckout));
check('결제 덮개에 상품 이름과 서버 가격이 있다',
  embeddedCheckout.includes(CATALOG['compat-report'].name)
  && embeddedCheckout.includes(CATALOG['compat-report'].priceKrw.toLocaleString('ko-KR') + '원'));
const homeApp = readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'public', 'app.js'), 'utf8');
const mergedFlow = homeApp.slice(homeApp.indexOf('function drawTaste('), homeApp.indexOf('function closeTasteCheckout('));
/*
 * 터진 뒤에 적은 것 (2026-10-05): 세 대목이 상세 설명 사이사이에 흩어져 있었다.
 * 신령이 하는 말은 **한 덩어리로** 붙어 있어야 한 사람이 말하는 것으로 들린다.
 */
const inOrder = ['taste-hero-slot', 'taste-say', '손님의 여덟 글자', 'tasteNeeds(panel, product)',
  'taste-jaegi', "'신령이 이렇게 말합니다'", '말함.append(previewOne, previewTwo, previewThree)',
  "take('.pd-fit')", "take('.pd-why')",
  "page.querySelector('.pd-gloss')", "page.querySelector('.pd-buy')",
  "take('.pd-cross-box')", "take('.pd-terms')", "doc.querySelector('footer')"];
let lastPlace = -1;
check('합친 화면의 주요 덩어리가 정해진 차례로 놓인다', inOrder.every((part) => {
  const place = mergedFlow.indexOf(part, lastPlace + 1);
  if (place < 0) return false;
  lastPlace = place;
  return true;
}));
check('오늘·한 달 운세도 같은 결제 덮개를 연다',
  mergedFlow.includes(".dp-price-card, .mp-price-card") && mergedFlow.includes('openTasteCheckout(productId)'));
/*
 * 터진 뒤에 적은 것 (2026-10-05): 펼친 칸에 값을 적어 두었다. 사장님은
 * 「값은 결제 화면에서만」이라 하셨다. 값 조각을 걷어 내는지 검증이 본다.
 */
check('펼친 칸에는 값이 적히지 않는다',
  !mergedFlow.includes('taste-price') && !mergedFlow.includes("priceKrw.toLocaleString"),
  '값을 먼저 보면 손님이 값부터 재고 나간다');
check('값이 적힌 띠와 가격표를 걷어 낸다',
  mergedFlow.includes('.pd-launch-bar') && mergedFlow.includes('dp-price-tag'),
  '상세페이지에서 옮겨 온 조각에 값이 남는다');
check('세 대목에 근거를 단다',
  mergedFlow.includes("'근거 · '") && mergedFlow.includes('section.basis'),
  '근거 없는 결론은 두지 않는다');
check('이 사람의 실제 항목이 담김',
  preview.body.preview.contents.length > 0,
  `${preview.body.preview.contents.length}개 — ${preview.body.preview.contents[0]}`);
check('엇갈림 항목이 미리보기에 노출',
  preview.body.preview.contents.some((c: string) => c.startsWith('엇갈림')));
check('예시 리포트 발췌 포함', preview.body.preview.sample.length > 50);
check('예시가 남의 명식임을 안내', preview.body.preview.sampleNotice.includes('다른 분의 명식'));
check('가격이 서버 카탈로그 값', preview.body.product.priceKrw === CATALOG['cross-report'].priceKrw);
check('미리보기는 모델을 부르지 않음', generateCalls === 0, `호출 ${generateCalls}회`);
check('손님 실제 사주 기반 맛보기 점사 생성됨',
  Array.isArray(preview.body.preview.fortunePoints) && preview.body.preview.fortunePoints.length > 0);
const firstPoint = preview.body.preview.fortunePoints?.[0];
check('점사에 근거 글자가 명시됨',
  !!(firstPoint && typeof firstPoint.basis === 'string' && (firstPoint.basis.includes('글자') || firstPoint.basis.includes('일간') || firstPoint.basis.includes('명식') || firstPoint.basis.includes('분석'))));
check('점사에 명리 용어와 한 줄 뜻이 분리 기재됨',
  !!(firstPoint && typeof firstPoint.term === 'string' && typeof firstPoint.termDesc === 'string' && firstPoint.termDesc.length > 0));
check('점사에 겁주는 표현(막혔다)이 없음',
  !JSON.stringify(preview.body.preview.fortunePoints).includes('막혔다'));

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

// 광고 유입 식별자 (ref)
const withRef = await api('POST', '/api/orders', {
  ...reading, acknowledgedNotice: true, previewShown: true, ref: 'sidaek',
});
check('ref 가 주문에 기록된다', withRef.status === 201 && withRef.body.order.ref === 'sidaek');

const withBadRef = await api('POST', '/api/orders', {
  ...reading, acknowledgedNotice: true, previewShown: true, ref: 'not-in-allowed-refs',
});
check('아는 여덟 개가 아닌 ref 는 빈 값이 된다',
  withBadRef.status === 201 && withBadRef.body.order.ref === null);

check('ref 가 값을 바꾸지 않는다 (같은 주문이면 ref 가 달라도 금액이 같다)',
  created.body.order.amountKrw === withRef.body.order.amountKrw
  && created.body.order.amountKrw === withBadRef.body.order.amountKrw);

check('ref 가 없어도 주문이 만들어진다',
  created.status === 201 && created.body.order.ref === null);

// 작명 상품 돌림자 / 피할 글자 주문 및 검증
const namingNoFixed = await api('POST', '/api/orders', {
  productId: 'naming-report',
  birth: BIRTH,
  child: { date: '2026-03-10', gender: '남' },
  name: { surname: '김' },
  acknowledgedNotice: true,
  previewShown: true,
});
check('돌림자 없는 작명 주문 정상 생성', namingNoFixed.status === 201);

const namingWithFixed = await api('POST', '/api/orders', {
  productId: 'naming-report',
  birth: BIRTH,
  child: { date: '2026-03-10', gender: '남' },
  name: { surname: '김', fixed: { char: '준', at: '앞' }, avoid: ['철', '수'] },
  acknowledgedNotice: true,
  previewShown: true,
});
check('돌림자·피할글자 있는 작명 주문 정상 생성', namingWithFixed.status === 201);

const namingLongAvoid = await api('POST', '/api/orders', {
  productId: 'naming-report',
  birth: BIRTH,
  child: { date: '2026-03-10', gender: '남' },
  name: {
    surname: '김',
    avoid: ['가','나','다','라','마','바','사','아','자','차','카','타','파','하','거','너','더','러','머','버','서'], // 21자
  },
  acknowledgedNotice: true,
  previewShown: true,
});
check('피할 글자 21자 입력 시 400 반환', namingLongAvoid.status === 400);

const namingLongFixed = await api('POST', '/api/orders', {
  productId: 'naming-report',
  birth: BIRTH,
  child: { date: '2026-03-10', gender: '남' },
  name: { surname: '김', fixed: { char: '준희', at: '앞' } },
  acknowledgedNotice: true,
  previewShown: true,
});
check('돌림자 2자 이상 입력 시 400 반환', namingLongFixed.status === 400);

/*
 * 아이 성별은 메워 넣지 않는다.
 * 터진 뒤에 적은 것 (2026-10-05): 「남」으로 채워 넣고 있었다. 딸이면
 * 대운이 거꾸로 간다 — 리포트 전체가 틀린다.
 */
const 성별없는아이 = {
  productId: 'child-report', birth: BIRTH,
  child: { date: '2026-03-10', time: '10:00' },
  acknowledgedNotice: true, previewShown: true,
};
check('아이 성별을 안 고르면 되묻는다',
  (await api('POST', '/api/orders', 성별없는아이)).status === 400);
check('아이 성별을 고르면 지나간다',
  (await api('POST', '/api/orders', { ...성별없는아이,
    child: { ...성별없는아이.child, gender: '여' } })).status === 201);

const pLoad = buildPayload({
  productId: 'naming-report',
  birth: BIRTH,
  child: { date: '2026-03-10', time: '10:00', gender: '남' },
  name: { surname: '김', fixed: { char: '준', at: '앞' }, avoid: ['철'] },
});
check('작명 페이로드에 돌림자가 반영된다', (pLoad.data as any).이름밭?.돌림자 === '준' || Boolean((pLoad.data as any).이름밭?.돌림자_분석));

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
check('정상 금액이면 확정', confirmed.status === 200 && (confirmed.body.order.status === 'paid' || confirmed.body.order.status === 'fulfilled'));
for (let i = 0; i < 20 && generateCalls === 0; i++) {
  await new Promise(r => setTimeout(r, 20));
}
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

// ── E. 정책 페이지와 사업자 정보 ───────────────────────────────
section('E. 정책 페이지 (PG 심사가 열어보는 곳)');

for (const [path, title] of [['/products', '판매 상품과 가격'], ['/terms', '이용약관'], ['/privacy', '개인정보처리방침'], ['/refund', '취소·환불 정책']]) {
  const res = await page(path);
  const heading = path === '/products' ? `<h2>${title}</h2>` : `<h1>${title}</h1>`;
  check(`${path} 는 ${title} 을 200으로 준다`, res.status === 200 && res.html.includes(heading));
  check(`${path} 는 HTML로 응답`, res.type.startsWith('text/html'));
  check(`${path} 에 사업자등록번호 표시`, res.html.includes('220-81-62517'));
}

// 카드사 등록심사: 상품을 클릭하면 상세페이지가 나와야 한다
{
  const { CATALOG: CAT } = await import('../../packages/commerce/src/catalog.ts');
  let ok = 0;
  for (const p of Object.values(CAT)) {
    const res = await page(`/products/${p.id}`);
    if (res.status === 200 && res.html.includes(p.name) && res.html.includes(p.hook)) ok++;
  }
  check('상품 21개가 각각 제 페이지를 가진다', ok === Object.keys(CAT).length, `${ok}/${Object.keys(CAT).length}`);

  // 맛보기가 한 번만 나오는지를 보는 검증 (같은 문장이 두 번 이상 나오면 실패)
  {
    const { sampleFor } = await import('./src/preview.ts');
    const dupList: string[] = [];
    for (const p of Object.values(CAT)) {
      if (p.id === 'daily-report' || p.id === 'month-report') continue;
      const res = await page(`/products/${p.id}`);
      const sampleRaw = sampleFor(p.id);
      const firstSentence = sampleRaw.split(/\n\n+/)[0].slice(0, 30);
      const count = res.html.split(firstSentence).length - 1;
      if (count !== 1) dupList.push(`${p.id}(${count}회)`);
    }
    check('맛보기 문장이 상세페이지에 두 번 이상 나오지 않고 딱 한 번만 나온다', dupList.length === 0,
      dupList.length === 0 ? '31개 상품 모두 중복 없음' : dupList.join(', '));
  }

  // 명절 가족운세 상세페이지 검증
  {
    const fhr = await page('/products/family-holiday-report');
    check('명절 가족운세에 「망설여지는 점」이 나온다', fhr.html.includes('망설여지는 점'));
    check('명절 가족운세 「그래서 믿어도 되는가」에 전용 문구 3문단이 나온다',
      fhr.html.includes('풀이의 출발점은 짐작이 아니라 계산입니다') &&
      fhr.html.includes('결론마다 그 말이 나온 글자를 밝힙니다') &&
      fhr.html.includes('큰 글씨는 일상에서 쓰는 말로 적습니다'));
    let otherHasHesitation = false;
    for (const p of Object.values(CAT)) {
      if (p.id === 'family-holiday-report') continue;
      const res = await page(`/products/${p.id}`);
      if (res.html.includes('망설여지는 점')) otherHasHesitation = true;
    }
    check('「망설여지는 점」이 다른 상품에는 나오지 않는다', !otherHasHesitation);
  }
  const one = await page('/products/wealth-report');
  check('상세페이지 본문과 고정 띠에 값이 나오지 않는다',
    !one.html.includes(CAT['wealth-report'].priceKrw.toLocaleString('ko-KR') + '원') &&
    !one.html.includes('부가세 포함'));
  check('결제가 준비 중일 때는 결제 준비 중 안내가 나온다',
    one.html.includes('결제 준비 중입니다'));
  const { renderProductPage: renderProd } = await import('../../packages/site-policy/src/index.ts');
  const readyPage = renderProd(CAT['wealth-report'], business, true, '');
  check('상세페이지에 「더욱 자세한 내용 받기」 단추가 있다',
    readyPage.includes('더욱 자세한 내용 받기'));
  const coWealth = await page('/checkout?product=wealth-report');
  check('결제 화면에는 값이 나온다',
    coWealth.html.includes(CAT['wealth-report'].priceKrw.toLocaleString('ko-KR') + '원'));
  check('상세페이지에 명리 용어를 함께 단다', one.html.includes('재성(財星)'));
  check('상세페이지에서 목록으로 돌아갈 수 있다', one.html.includes('href="/products"'));
  check('상세페이지에도 사업자 정보', one.html.includes('220-81-62517'));
  check('없는 상품은 404', (await page('/products/nope')).status === 404);
  check('목록에서 상세로 링크가 걸린다',
    (await page('/products')).html.includes('href="/products/wealth-report"'));
}

// 상품 그림. 나온 것만 붙고, 없는 것은 자리를 남기지 않는다
{
  const { mkdtempSync, writeFileSync, rmSync } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const { join: j } = await import('node:path');
  const {
    findProductImages, findHeroImage, findHeroVideo, strayImages, toProductId,
    findSpiritImages, straySpiritImages, findSceneImages, straySceneImages, findGateVideo,
  } = await import('./src/images.ts');

  // 한국 사람이 한국 손님에게 파는 물건이다. 파일 이름을 한글로 지어도 붙어야 한다
  check('한글 짧은 이름을 알아듣는다',
    toProductId('돈그릇') === 'wealth-report' && toProductId('재회') === 'reunion-report');
  check('카탈로그에 적힌 상품 이름 그대로도 알아듣는다',
    toProductId('우리 아이 사주') === 'child-report');
  check('띄어쓰기가 달라도 같은 것으로 본다', toProductId('돈 그릇') === 'wealth-report');
  check('영어 아이디도 그대로 된다', toProductId('wealth-report') === 'wealth-report');
  check('모르는 이름은 빈 문자열', toProductId('아무거나') === '');

  const dir = mkdtempSync(j(tmpdir(), 'saju-img-'));
  const png = Buffer.from('89504e470d0a1a0a', 'hex'); // 내용은 상관없다 — 이름과 확장자만 본다
  writeFileSync(j(dir, 'wealth-report.png'), png);
  writeFileSync(j(dir, 'reunion-report.jpg'), png);
  writeFileSync(j(dir, '오타난이름.png'), png);      // 카탈로그에 없는 이름
  writeFileSync(j(dir, 'wealth-report.txt'), 'x');   // 그림이 아닌 파일
  writeFileSync(j(dir, '귀인운.jpg'), png);           // 한글로 저장한 파일
  writeFileSync(j(dir, 'site-hero.jpg'), png);       // 첫 화면에 까는 그림 — 상품이 아니다
  writeFileSync(j(dir, 'hero.mp4'), Buffer.from('0000001c66747970', 'hex')); // 첫 화면 영상

  // 신령 얼굴은 폴더를 따로 쓴다. 파는 물건이 아니라 파는 사람이기 때문이다
  const spDir = mkdtempSync(j(tmpdir(), 'saju-sp-'));
  writeFileSync(j(spDir, 'flower.png'), png);        // 영문 아이디로 저장
  writeFileSync(j(spDir, '산신령.jpg'), png);         // 한글 이름으로 저장
  writeFileSync(j(spDir, '아무거나.png'), png);        // 신령이 아닌 이름

  const found = findProductImages(dir);
  check('상품 아이디로 저장한 그림만 골라낸다', found.size === 3);
  check('한글로 저장한 파일도 제자리에 붙는다', found.has('helper-report'));
  check('확장자가 달라도 찾는다 — png도 jpg도',
    found.get('wealth-report')?.type === 'image/png'
    && found.get('reunion-report')?.type === 'image/jpeg');
  check('카탈로그에 없는 이름은 무시한다', !found.has('오타난이름'));
  check('이름 틀린 파일은 기동 로그로 알려준다', strayImages(dir).includes('오타난이름.png'));
  // 첫 화면 그림은 일부러 그 이름으로 지은 것이다. 오타로 오해해 경고하면 안 된다
  check('첫 화면 그림은 오타 경고에 끼지 않는다', !strayImages(dir).includes('site-hero.jpg'));
  check('첫 화면 그림은 상품 목록에도 끼지 않는다', found.size === 3);
  check('첫 화면 그림을 따로 찾아낸다', findHeroImage(dir)?.type === 'image/jpeg');
  check('첫 화면 그림이 없으면 null', findHeroImage(j(dir, '없는폴더')) === null);
  check('첫 화면 영상을 찾아낸다', findHeroVideo(dir)?.type === 'video/mp4');
  check('영상은 상품 목록에도 오타 경고에도 끼지 않는다',
    found.size === 3 && !strayImages(dir).includes('hero.mp4'));
  check('폴더가 없어도 죽지 않는다', findProductImages(j(dir, '없는폴더')).size === 0);

  // 문 여는 영상은 장소 폴더에 함께 둔다
  const scDir = mkdtempSync(j(tmpdir(), 'saju-sc-'));
  writeFileSync(j(scDir, '문.jpg'), png);
  writeFileSync(j(scDir, '문열림.mp4'), Buffer.from('0000001c66747970', 'hex'));
  check('문 여는 영상을 한글 이름으로 찾는다', findGateVideo(scDir)?.type === 'video/mp4');
  check('영상은 장소 그림에도 오타 경고에도 끼지 않는다',
    findSceneImages(scDir).size === 1 && !straySceneImages(scDir).includes('문열림.mp4'));
  check('영상이 없으면 null', findGateVideo(j(scDir, '없는폴더')) === null);
  // 사장님이 파일을 어떤 이름으로 저장하실지 프로그램이 정할 일이 아니다
  writeFileSync(j(scDir, '신령계장소.jpg'), png);
  check('같은 장소를 여러 이름으로 알아듣는다',
    findSceneImages(scDir).has('world') && !straySceneImages(scDir).includes('신령계장소.jpg'));

  const faces = findSpiritImages(spDir);
  check('신령 얼굴을 영문 아이디로 찾는다', faces.has('flower'));
  check('신령 얼굴을 한글 이름으로도 찾는다', faces.has('mountain'));
  check('신령이 아닌 이름은 무시한다', faces.size === 2);
  check('신령 폴더의 이름 틀린 파일도 알려준다',
    straySpiritImages(spDir).includes('아무거나.png'));
  check('신령 폴더가 없어도 죽지 않는다', findSpiritImages(j(spDir, '없는폴더')).size === 0);

  const imgSrv = createServer(createApi({
    gateway, orders, generate: async () => ({ text: '' }), images: found,
    heroImage: findHeroImage(dir), heroVideo: findHeroVideo(dir), spiritImages: faces,
  }));
  await new Promise<void>((r) => imgSrv.listen(0, r));
  const ip = (imgSrv.address() as { port: number }).port;
  const get = (path: string) => fetch(`http://127.0.0.1:${ip}${path}`);

  const img = await get('/img/products/wealth-report');
  check('그림을 200으로 준다', img.status === 200);
  check('Content-Type 이 실제 파일 형식과 맞는다',
    img.headers.get('content-type') === 'image/png');
  check('그림은 캐시된다', (img.headers.get('cache-control') ?? '').includes('max-age'));
  await img.arrayBuffer();

  check('그림이 없는 상품은 404', (await get('/img/products/child-report')).status === 404);
  const heroRes = await get('/img/hero');
  check('첫 화면 그림을 200으로 준다', heroRes.status === 200);
  await heroRes.arrayBuffer();

  // 브라우저는 영상을 통째로 받지 않고 조각내어 요청한다. 그것을 못 받으면 재생이 시작되지 않는다
  const vid = await get('/video/hero');
  check('첫 화면 영상을 200으로 준다', vid.status === 200
    && vid.headers.get('content-type') === 'video/mp4');
  check('조각 요청을 받아 준다는 것을 알린다',
    vid.headers.get('accept-ranges') === 'bytes');
  await vid.arrayBuffer();
  const part = await fetch(`http://127.0.0.1:${ip}/video/hero`, { headers: { Range: 'bytes=0-3' } });
  check('조각으로 달라면 조각으로 준다',
    part.status === 206 && (await part.arrayBuffer()).byteLength === 4);

  /*
   * 그림과 영상을 통째로 메모리에 올리지 않는다.
   *
   * 예전에는 한 장 보낼 때마다 그 파일을 전부 읽어 들였다. 신령 영상은 한 개가
   * 7메가고 우리 서버는 512메가짜리다 — 손님이 몰리는 날 넘친다. 손님이 없을
   * 때는 안 터지므로, 터지기 전에 여기서 잡아야 한다.
   */
  const heroSize = Number(vid.headers.get('content-length'));
  check('영상 길이를 제대로 알려 준다', heroSize > 0, `${heroSize}바이트`);

  // 「bytes=-2」 는 끝에서 두 바이트다. 0 부터로 읽으면 영상 앞부분을 보내게 된다
  const tail = await fetch(`http://127.0.0.1:${ip}/video/hero`, { headers: { Range: 'bytes=-2' } });
  const tailBody = Buffer.from(await tail.arrayBuffer());
  const whole = Buffer.from(await (await get('/video/hero')).arrayBuffer());
  check('끝에서 달라면 끝을 준다',
    tail.status === 206 && tailBody.length === 2 && tailBody.equals(whole.subarray(-2)),
    tail.headers.get('content-range') ?? '');

  // 가운데 조각도 원본과 같은 자리여야 한다. 흘려보내며 자리를 잘못 잡으면 영상이 깨진다
  const mid = await fetch(`http://127.0.0.1:${ip}/video/hero`, { headers: { Range: 'bytes=3-9' } });
  const midBody = Buffer.from(await mid.arrayBuffer());
  check('가운데 조각도 제자리를 준다',
    mid.status === 206 && midBody.equals(whole.subarray(3, 10)),
    mid.headers.get('content-range') ?? '');

  const over = await fetch(`http://127.0.0.1:${ip}/video/hero`,
    { headers: { Range: `bytes=${heroSize + 10}-${heroSize + 20}` } });
  check('없는 자리를 달라면 416으로 돌려보낸다', over.status === 416,
    over.headers.get('content-range') ?? '');
  await over.arrayBuffer();

  // 여럿이 한꺼번에 눌러도 다 제대로 받아야 한다. 흘려보내다 서로 엉키면 여기서 걸린다
  const many = await Promise.all(Array.from({ length: 12 }, () => get('/video/hero')));
  const bodies = await Promise.all(many.map(async (r) => Buffer.from(await r.arrayBuffer())));
  check('열두 명이 동시에 받아도 온전하다',
    many.every((r) => r.status === 200) && bodies.every((b) => b.equals(whole)),
    `${bodies.filter((b) => b.equals(whole)).length}/12`);
  const spImg = await get('/img/spirits/flower');
  check('신령 얼굴을 200으로 준다', spImg.status === 200
    && spImg.headers.get('content-type') === 'image/png');
  await spImg.arrayBuffer();
  check('얼굴 없는 신령은 404', (await get('/img/spirits/moon')).status === 404);
  check('신령 주소도 경로를 거슬러 올라갈 수 없다',
    (await get('/img/spirits/..%2F..%2Fetc%2Fpasswd')).status === 404);

  /*
   * 「이런 분이 보시면 좋습니다」 그림은 **확장자가 달라도 나가야 한다.**
   *
   * 화면은 `.jpg` 로 부른다. 전에는 서버도 `.jpg` 만 찾아서, 사장님이
   * `.webp` 로 저장하시면 칸이 까맣게 남고 아무 말도 안 나왔다.
   */
  {
    const { mkdirSync, writeFileSync, rmSync } = await import('node:fs');
    const { join: j, dirname: dn } = await import('node:path');
    const { fileURLToPath: f2u } = await import('node:url');
    const fitDir = j(dn(f2u(import.meta.url)), 'public', 'fit');
    mkdirSync(fitDir, { recursive: true });
    const webp = j(fitDir, 'zzz-test-report-1.webp');
    writeFileSync(webp, Buffer.from('RIFF....WEBPVP8 ', 'binary'));
    const got = await get('/img/fit/zzz-test-report-1.jpg');
    check('그림이 webp 로 올라와도 화면은 jpg 로 받아 간다',
      got.status === 200 && got.headers.get('content-type') === 'image/webp',
      `${got.status} ${got.headers.get('content-type')}`);
    await got.arrayBuffer();
    rmSync(webp, { force: true });
    check('없는 그림은 404', (await get('/img/fit/zzz-test-report-9.jpg')).status === 404);
    check('그림 주소도 경로를 거슬러 올라갈 수 없다',
      (await get('/img/fit/..%2F..%2Fetc%2Fpasswd')).status === 404);
  }

  check('카탈로그에 없는 아이디도 404', (await get('/img/products/nope')).status === 404);
  // 요청 문자열로 경로를 만들지 않으므로 애초에 성립하지 않는다
  check('경로를 거슬러 올라갈 수 없다',
    (await get('/img/products/..%2F..%2Fetc%2Fpasswd')).status === 404);

  // 손님이 첫 화면에서 신령을 먼저 만나고, 상품 칸에서 다시 만나야 가게가 된다
  const home = await get('/').then((r) => r.text());
  check('첫 화면에 신령이 다 선다',
    SPIRITS.every((sp) => home.includes(sp.name)));
  check('얼굴이 있는 신령은 첫 화면에서 그림으로 나온다',
    home.includes('/img/spirits/flower'));
  check('얼굴이 없는 신령은 도장으로 자리를 지킨다', home.includes('sp-seal'));

  const list = await get('/products').then((r) => r.text());
  check('그림이 있는 것에만 썸네일이 붙는다', (list.match(/pr-thumb"/g) ?? []).length === 3);
  const detail = await get('/products/wealth-report').then((r) => r.text());
  check('상세페이지에는 크게 건다', detail.includes('class="pd-hero"'));
  const noPic = await get('/products/child-report').then((r) => r.text());
  // 상품 그림이 없으면 그 자리를 아예 만들지 않는다. 신령 얼굴은 상품 그림이 아니다
  check('그림 없는 상세페이지에 빈 네모가 없다',
    !noPic.includes('class="pd-hero"') && !noPic.includes('/img/products/'));
  check('상품 그림이 없어도 파는 신령은 나온다',
    noPic.includes('산신령') && noPic.includes('sp-pitch'));

  imgSrv.close();
  rmSync(dir, { recursive: true, force: true });
}

// 카드사 심사가 하단 필수정보로 보는 항목들
{
  const f = (await page('/products')).html;
  check('「대표」 직책 표기', f.includes('<dt>대표</dt>'));
  // 유선전화가 있으면 그 이름으로, 없으면 휴대폰을 「연락처」로. 둘 중 하나는 반드시 있어야 한다
  check('전화 항목이 있다', f.includes('<dt>유선전화</dt>') || f.includes('<dt>연락처</dt>'));
  // 읽을 수 없으면 표시한 것이 아니다. 상품 화면에도 하단 스타일이 따라와야 한다
  check('하단 정보에 스타일이 따라간다', f.includes('.biz-row{display:grid'));
  check('휴대폰을 유선전화라고 적지 않는다',
    !(f.includes('<b>유선전화</b>') && /<b>유선전화<\/b> 01[016789]/.test(f)));
  // 카드사 심사는 상세페이지에서 언제·어떻게 받고 어떻게 무르는지를 본다
  const d = (await page('/products/wealth-report')).html;
  check('상세페이지에 받는 시기가 적혀 있다', d.includes('언제 받나요'));
  check('상세페이지에 받는 방법이 적혀 있다', d.includes('어떻게 받나요'));
  check('상세페이지에 무르는 방법이 적혀 있다', d.includes('무르고 싶으면'));
}

const home = await page('/');
  check('신령 처소 입장 화면에 태어난 곳 안내 문구가 실린다',
    home.html.includes('id="inputPlace"') && home.html.includes('태어난 곳에 따라 시(時)가 갈릴 수 있어 여쭙습니다'));
{
  // 카톡에 링크를 붙이면 여기가 간판이 된다. 개발자용 제목이 새어 나가면 안 된다
  check('링크 이름이 사람 말이다',
    /<title>[^<]*사주·관상·손금을 한 자리에서<\/title>/.test(home.html));
  check('본문에 제목이 두 개 남지 않는다',
    (home.html.match(/<title>/g) ?? []).length === 1);
  check('카톡 카드가 붙는다',
    ['og:title', 'og:description', 'og:image', 'og:url'].every((k) => home.html.includes(k)));
  check('만세력·명식 같은 말이 링크 이름에 안 들어간다',
    !/<title>[^<]*(만세력|명식)/.test(home.html));

  // 들어오는 길은 전체 화면 세 장면이다 — 길 · 문 · 열림.
  // 그 다음도 전체 화면이다 — 신령계 · 신령 하나의 판. 스크롤은 글을 읽을 때부터다
  for (const id of ['stWalk', 'stGate', 'stOpen', 'stWorld']) {
    check(`전체 화면에 ${id} 장면이 있다`, home.html.includes(`id="${id}"`));
  }
  // 숫자를 박아 두면 신령이 늘 때마다 여기부터 깨진다. 신령 수를 따라간다
  check('신령마다 저마다 판을 갖는다',
    (home.html.match(/id="stSp-/g) ?? []).length === SPIRITS.length);
  // 영상이 올라온 신령은 살아 움직인다. 없는 신령은 얼굴 그림이 그대로 돈다.
  // 신령 하나에 영상을 더 올릴 때마다 여기가 깨지면 안 되므로, 폴더를 따라간다
  const clips = findSpiritVideos();
  check('영상이 올라온 신령은 움직인다',
    [...clips.keys()].every((id) => home.html.includes(`src="/video/spirits/${id}" type="video/mp4"`)),
    `${clips.size}명`);
  check('영상이 없는 신령은 얼굴 그림으로 남는다',
    (home.html.match(/<source src="\/video\/spirits\/[^".]+" type="video\/mp4"/g) ?? []).length === clips.size);
  const webms = findSpiritVideos(undefined, '.webm');
  check('mp4 를 못 여는 브라우저도 본다',
    [...webms.keys()].every((id) => home.html.includes(`src="/video/spirits/${id}.webm"`)));
  check('신령계에서 무료 사주를 먼저 건다', home.html.includes('id="stFree"'));
  check('문 앞에서 이름·태어난 날·태어난 시를 받는다',
    ['stName', 'stDate', 'stHour'].every((id) => home.html.includes(`id="${id}"`)));
  // 덮개이지 대문이 아니다. 아래에 상품과 가격과 사업자 정보가 그대로 있다
  check('덮개를 걷으면 상품이 그대로 있다',
    home.html.includes('id="products"') && home.html.includes('둘러보기'));
  check('자바스크립트가 꺼져 있으면 덮개가 안 뜬다',
    home.html.includes('<div class="stage" id="stage" hidden>'));
  check('영상은 미리 받지 않는다',
    (home.html.match(/class="st-vid"/g) ?? []).every(() => true)
    && (home.html.match(/preload="none"/g) ?? []).length >= 2);

  /*
   * 화면 글의 꼬리표는 손으로 적지 않는다.
   *
   * 손으로 적어 두었더니 글은 고쳤는데 꼬리표가 그대로였다. 하루짜리로
   * 저장돼 있던 손님 휴대폰은 **새 뼈대에 옛 글**을 얹어 돌렸고, 입장 영상이
   * 통째로 안 나왔다. 실제로 그렇게 나갔다 (2026-09-23).
   * 파일 내용에서 뽑은 꼬리표는 한 글자만 고쳐도 저절로 바뀐다.
   */
  const stamps = [...home.html.matchAll(/\/(?:app\.js|style\.css)\?v=([^"']+)/g)].map((m) => m[1]);
  check('화면 글과 꾸밈에 꼬리표가 붙는다', stamps.length === 2);
  check('꼬리표는 파일 내용에서 뽑는다', stamps.every((v) => /^[0-9a-f]{10}$/.test(v)));
  check('화면 글과 꾸밈의 꼬리표는 서로 다르다', stamps.length === 2 && stamps[0] !== stamps[1]);

  // 앞은 보여 주고 뒤는 가린다. 아무것도 안 보여 주면 뭘 사는지 모르고,
  // 다 보여 주면 살 이유가 없다
  check('가림막을 세울 줄 안다', home.html.includes('veil-ask') && home.html.includes('veiled('));
  check('가림막 앞에서 신령이 말한다', home.html.includes('MS.BLIND['));
  check('가림막에 값과 갈 곳이 적힌다',
    home.html.includes('이어서 보기') && home.html.includes('veil-go'));
  check('가린 뒤에도 여기까지는 공짜라고 밝힌다',
    home.html.includes('여기까지는 결제 없이'));
  // 문에서 이미 밝혔는데 또 물으면 손님은 같은 일을 두 번 한다
  check('문을 열면 하나씩 묻는 화면이 걷힌다',
    home.html.includes('NB_SKIP_WIZARD'));

  // 십신 이름 옆에 쉬운 말이 한 줄 더 붙는다. 오행과 같은 좁은 칸에 밀어 넣으면
  // 「혼자 / 밀고 / 나가 / 는 힘」처럼 넉 줄로 접힌다
  check('십신 막대는 이름을 한 줄 위로 올린다',
    home.html.includes('bar wide') && home.html.includes('.bar.wide > .bl{grid-column:1/-1'));
  check('오행 막대는 그대로 한 줄이다',
    /'<div class="bar"><span class="e-'/.test(home.html));
}
{
  // 얼굴 사진은 생체정보다. 서버로 보내는 순간 보관·파기·동의 문제가 전부 따라붙는다.
  // 여기서 보는 것은 「보내지 않는다」가 코드에 실제로 그렇게 되어 있는가다
  const v = home.html;
  check('사진 고르는 칸이 관상 화면에 있다', v.includes('id="facePhoto"'));
  check('사진을 우리 서버로 올리지 않는다',
    !/facePhoto[\s\S]{0,4000}?(FormData|new XMLHttpRequest)/.test(v));
  check('다 쓴 사진은 바로 버린다', v.includes('revokeObjectURL'));
  check('사진 재기가 안 되면 손으로 고를 수 있다고 알린다',
    v.includes('직접 골라 주세요'));
  // 3MB짜리 도구를 첫 화면부터 받으면 사진을 안 쓸 손님까지 기다린다
  check('점 찍는 도구는 누를 때 받는다',
    v.includes("import('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision"));
  check('첫 화면이 그 도구를 미리 받지 않는다', !v.includes('<script src="https://cdn.jsdelivr.net/npm/@mediapipe'));
  // 인터넷이 느리면 손님을 하염없이 기다리게 두지 않는다
  check('오래 걸리면 포기하고 알려 준다', v.includes('FACE_WAIT_MS'));
  // hidden 은 display:none 이라 키보드로 고를 수 없다
  check('파일칸을 눈에서만 감춘다', !v.includes('id="facePhoto" accept="image/*" hidden'));
  check('사진 값도 손으로 고칠 수 있다', v.includes('syncFaceForm'));
}
{
  // 손 사진도 얼굴과 같은 약속을 지킨다 — 기기 밖으로 안 나간다
  const v = home.html;
  check('사진 고르는 칸이 손금 화면에도 있다', v.includes('id="palmPhoto"'));
  check('손 사진을 우리 서버로 올리지 않는다',
    !/palmPhoto[\s\S]{0,4000}?(FormData|new XMLHttpRequest)/.test(v));
  check('손 점 찍는 도구도 누를 때 받는다', v.includes('hand_landmarker.task'));
  check('손도 오래 걸리면 포기하고 알려 준다',
    /loadHandPicker[\s\S]{0,1600}?FACE_WAIT_MS/.test(v));
  check('손 파일칸도 눈에서만 감춘다', !v.includes('id="palmPhoto" accept="image/*" hidden'));
  check('손 모양 값도 손으로 고칠 수 있다', v.includes('syncPalmForm'));
  // 못 재는 것을 재는 척하지 않는다. 지금은 손 모양까지다
  check('손금 선은 아직 직접 고르라고 밝힌다',
    v.includes('손금 선은 아직 직접 골라 주셔야 합니다'));
}
{
  // 손님이 신령을 누르면 그 뒤로는 그 신령이 상담한다. 홈페이지가 설명하는 게 아니다
  const v = home.html;
  check('신령 판에 주고받는 칸이 있다', /<div class="tk" id="tk-mountain"/.test(v));
  check('자바스크립트가 꺼져 있으면 상담 칸이 안 보인다',
    /<div class="tk" id="tk-mountain"[\s\S]{0,200}?hidden>/.test(v));
  check('신령마다 상담 칸이 하나씩', (v.match(/<div class="tk" id="tk-/g) ?? []).length === SPIRITS.length);
  // 신령이 답만 하면 안내문이다. 되물어야 상담이다
  check('되묻는 말을 담을 자리가 있다', v.includes('tk-ask'));
  check('무엇을 답하지 않는지 화면에 적어 둔다',
    v.includes('몸·죽음·투자·법으로 다투는 일은 답하지 않습니다'));

  const facts = {
    name: '민수', dayStem: '갑', dayElement: '목', eight: '갑자 을축 병인 정묘',
    strong: true, topGod: '식상', lackGod: '관성', topElement: '목', lackElement: '금',
    timeKnown: true,
  };
  // 손님이 앉으면 신령이 먼저 말을 건다
  const hi = await api('POST', '/api/talk', { spirit: 'mountain', facts });
  check('신령이 먼저 말을 건다', hi.status === 200 && hi.body.text.length > 20);
  check('첫 인사에 여덟 글자가 들어간다', hi.body.text.includes('갑자 을축 병인 정묘'));

  // 열쇠가 없어도 답이 나온다. 지금 이 집에는 열쇠가 없다
  const one = await api('POST', '/api/talk',
    { spirit: 'mountain', facts, ask: '엄마랑 자꾸 부딪혀요', turn: 0, history: [] });
  check('열쇠가 없어도 신령이 답한다', one.status === 200 && one.body.text.length > 20);
  check('모델을 안 불렀다', one.body.byModel === false);
  check('신령이 되묻는다', typeof one.body.ask === 'string' && one.body.ask.length > 0);
  check('남은 공짜 횟수를 알려 준다', one.body.left === 2);

  // 세 번째에는 제대로 보라고 하고 상품으로 넘긴다
  const last = await api('POST', '/api/talk',
    { spirit: 'mountain', facts, ask: '그래서 어떻게 해요', turn: 2, history: [] });
  check('세 번째에 상품으로 넘긴다', last.body.left === 0 && last.body.close.length > 0);
  check('신령이 값을 부르지 않는다', !/원|₩/.test(last.body.close + last.body.text));
  const over = await api('POST', '/api/talk',
    { spirit: 'mountain', facts, ask: '한 번 더요', turn: 3, history: [] });
  check('공짜를 다 쓰면 더 안 받는다', over.status === 429);

  // 넘지 않는 선
  const med = await api('POST', '/api/talk',
    { spirit: 'mountain', facts, ask: '암 수술 받아야 할까요', turn: 0, history: [] });
  check('몸 이야기는 의사에게 보낸다', med.body.text.includes('의사'));
  const harm = await api('POST', '/api/talk',
    { spirit: 'mountain', facts, ask: '죽고 싶어요', turn: 0, history: [] });
  check('목숨 이야기에는 갈 곳을 알려 준다', harm.body.text.includes('109'));

  const bad = await api('POST', '/api/talk', { spirit: '없는신령', facts });
  check('모르는 신령은 거절한다', bad.status === 400);

  // 고르면 값을 받기 전에 먼저 한 조각을 준다. 표만 보여 주면 아무도 안 산다
  const t = await api('POST', '/api/taste', { product: 'child-report', facts });
  check('고르면 그 자리에서 봐 준다', t.status === 200 && t.body.lines.length >= 2);
  check('그 손님 사주에서 나온 말이다', t.body.lines[0].includes('제 힘으로 미는'));
  check('끊는 자리를 신령이 직접 말한다', t.body.more.length > 10);
  check('신령이 값을 부르지 않는다', !/원|₩/.test(t.body.lines.join(' ') + t.body.more));
  const noSuch = await api('POST', '/api/taste', { product: '없는상품', facts });
  check('모르는 상품은 거절한다', noSuch.status === 400);
}
{
  // 신령을 눌러 들어왔는데 표가 나오면 신령은 그냥 그림이 된다
  const v = home.html;
  check('상품이 고르는 칸으로 나온다', v.includes('data-taste="child-report"'));
  check('칸마다 영상·그림 자리가 있다', v.includes('class="sp-shot"'));
  check('신령이 무엇부터 볼지 묻는다', v.includes('무엇부터 보시겠습니까'));
  // 자바스크립트가 꺼져 있어도, 카드사 심사와 검색엔진은 상품과 값을 봐야 한다
  check('자바스크립트가 꺼져 있으면 링크가 남는다',
    /<noscript><div class="sp-plain">[\s\S]{0,600}?href="\/products\//.test(v));
}
check('첫 화면에도 사업자 정보가 붙는다', home.html.includes('220-81-62517'));
check('첫 화면에서 정책·상품으로 링크', ['/products', '/terms', '/privacy', '/refund'].every((h) => home.html.includes(`href="${h}"`)));
// 첫 화면에서 값부터 보이면 손님이 물러선다. 무엇을 봐 주는지만 보여 준다
check('첫 화면에는 값이 안 나온다', !home.html.includes('19,900원'));
check('첫 화면에서 가격표로 가는 길이 있다', home.html.includes('판매 상품과 가격 전체 보기'));
// 카드사 등록심사는 상품과 가격을 본다. 자바스크립트 없이 서버가 그린 HTML 이어야 한다
const priced = await page('/products');
check('가격표 HTML 자체에 값이 박혀 있다',
  priced.html.includes('19,900원') && priced.html.includes('9,900원'));
check('가격이 자바스크립트 없이 보인다', home.html.includes('<section class="pr"'));
check('첫 화면은 여전히 뷰어를 담고 있다', home.html.includes('window.SAJU_CONFIG'));
// 손님이 보는 순서: 브랜드 → 상품 → 무료 체험. 계산기가 먼저 나오면 안 된다
const iBrand = home.html.indexOf('lp-name');
const iProducts = home.html.indexOf('id="products"');
const iTry = home.html.indexOf('id="try"');
check('브랜드가 맨 위', iBrand > 0 && iBrand < iProducts, `${iBrand} < ${iProducts}`);
check('상품이 무료 체험보다 먼저', iProducts > 0 && iProducts < iTry, `${iProducts} < ${iTry}`);
check('개발자용 제목이 사라졌다', !home.html.includes('<h1>만세력 · 명식 해석</h1>'));
check('VSOP87 같은 말이 첫 화면 상단에 없다',
  home.html.indexOf('VSOP87') === -1 || home.html.indexOf('VSOP87') > iTry);
check('푸터 스타일이 함께 나간다', home.html.includes('.biz-rows'));
// 색을 한 곳에서만 정한다 — 첫 화면·목록·상세가 서로 다른 색으로 뜨면 그림이 겉돈다
check('색이 토큰 한 곳에서 나온다', home.html.includes('--nb-ink:#F5F5F7'));
// 폰이 밝든 어둡든 같은 밤 한 벌이 나가야 한다
check('밤 한 벌로 못 박는다',
  home.html.includes('color-scheme:dark') && !home.html.includes('prefers-color-scheme:light'));
// 무료 만세력 조각은 자기 색을 들고 온다. 한 장의 종이로 보이도록 덮어 준다
check('무료 화면 색을 우리 색으로 맞춘다', home.html.includes('--paper:var(--nb-paper)'));
// 관상 칸의 이름표가 버튼 오른쪽으로 밀려 나 있었다. 한 줄짜리로 세워 둔다
check('관상 고르는 칸이 한 줄로 선다',
  home.html.includes('.fg{grid-template-columns:1fr') && home.html.includes('.fg > .seg{grid-row:auto'));

// GET /refund 는 정책 페이지, GET /api/orders/:id/refund 는 환불 조회 — 서로 가리지 않아야 한다
const stillJson = await api('GET', `/api/orders/${id2}/refund`);
check('주문 환불 조회가 정책 페이지에 먹히지 않는다', stillJson.status === 200 && 'verdict' in stillJson.body);

const noBiz = createServer(createApi({ gateway, orders, generate: async () => ({ text: '' }), business: loadBusinessInfo({}) }));
await new Promise<void>((r) => noBiz.listen(0, r));
const noBizPort = (noBiz.address() as { port: number }).port;
const bare = await fetch(`http://127.0.0.1:${noBizPort}/terms`).then((r) => r.text());
check('사업자 정보가 비면 화면에 드러난다', bare.includes('[미입력: 상호]'));
noBiz.close();

// ── F. 심사 대기 모드 ──────────────────────────────────────────
section('F. 심사 대기 모드 (PG 계약 전에도 사이트가 떠 있어야 한다)');

const health = await api('GET', '/healthz');
check('헬스체크 응답', health.status === 200 && health.body.ok === true);
check('헬스체크가 결제 가능 여부를 알려준다', health.body.payments === false);

const standby = createServer(createApi({
  gateway: new StandbyGateway(),
  orders: new MemoryOrderStore(),
  generate: standbyGenerate,
  business,
}));
await new Promise<void>((r) => standby.listen(0, r));
const sbPort = (standby.address() as { port: number }).port;
const sb = async (method: string, path: string, body?: unknown) => {
  const res = await fetch(`http://127.0.0.1:${sbPort}${path}`, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  return { status: res.status, text, json: (() => { try { return JSON.parse(text); } catch { return null; } })() };
};

const sbHome = await sb('GET', '/');
check('심사 대기 중에도 첫 화면이 뜬다', sbHome.status === 200);
// 심사를 통과해야 결제가 켜지는데, 결제가 켜져야 가격이 보이면 영원히 통과 못 한다
const sbPriced = await sb('GET', '/products');
check('결제가 꺼져 있어도 가격표에 값이 있다', sbPriced.text.includes('19,900원'));
check('결제가 꺼져 있으면 준비 중이라고 알린다', sbPriced.text.includes('결제 준비 중'));
for (const path of ['/products', '/terms', '/privacy', '/refund']) {
  check(`심사 대기 중에도 ${path} 가 뜬다`, (await sb('GET', path)).status === 200);
}
const sbConfig = await sb('GET', '/api/config');
check('결제 준비 안 됐다고 알린다', sbConfig.json.ready === false);
check('결제 버튼을 감추도록 화면에 내려간다', (await sb('GET', '/')).text.includes('"ready":false'));
check('무료 미리보기는 여전히 동작', (await sb('POST', '/api/preview', reading)).status === 200);

const sbOrder = await sb('POST', '/api/orders', { ...reading, acknowledgedNotice: true, previewShown: true });
check('주문 자체는 만들어진다', sbOrder.status === 201);
const sbConfirm = await sb('POST', `/api/orders/${sbOrder.json.order.id}/confirm`, {});
check('결제 확인은 조용히 성공하지 않고 거부된다', sbConfirm.status === 402);
check('거부 사유가 심사 대기임을 밝힌다', String(sbConfirm.json.error).includes('심사 대기'));
standby.close();

// ── G. 재시작을 넘는 구매 (진짜 Postgres) ──────────────────────
if (process.env.DATABASE_URL) {
  section('G. 서버가 재시작돼도 산 사람은 리포트를 본다');

  const { createPool, migrate, PostgresOrderStore, PostgresReportStore } =
    await import('../../packages/store/src/index.ts');

  const pool = createPool(process.env.DATABASE_URL);
  await pool.query('DROP TABLE IF EXISTS reports, orders CASCADE');
  await migrate(pool);

  const pgGateway = new FakeGateway();
  /** 서버를 새로 띄운다. 같은 DB를 보되 프로세스 안의 상태는 전부 새것이다 */
  const boot = async () => {
    const srv = createServer(createApi({
      gateway: pgGateway,
      orders: new PostgresOrderStore(createPool(process.env.DATABASE_URL!)),
      reportStore: new PostgresReportStore(createPool(process.env.DATABASE_URL!)),
      generate: async ({ kind, subject }) => ({ text: `[${kind} 리포트: ${subject}] 재시작을 넘어 살아남는 본문.` }),
      business,
    }));
    await new Promise<void>((r) => srv.listen(0, r));
    const p = (srv.address() as { port: number }).port;
    return {
      close: () => srv.close(),
      call: async (method: string, path: string, body?: unknown) => {
        const res = await fetch(`http://127.0.0.1:${p}${path}`, {
          method,
          headers: body ? { 'Content-Type': 'application/json' } : {},
          body: body ? JSON.stringify(body) : undefined,
        });
        return { status: res.status, body: await res.json() as any };
      },
    };
  };

  const first = await boot();
  const made = await first.call('POST', '/api/orders',
    { ...reading, acknowledgedNotice: true, previewShown: true });
  check('주문 생성', made.status === 201);
  const pgId = made.body.order.id;

  await first.call('POST', `/api/orders/${pgId}/pending`);
  pgGateway.put({
    paymentId: pgId, status: 'paid', amountKrw: CATALOG['cross-report'].priceKrw,
    orderName: '교차검증', raw: {},
  });
  const confirmed = await first.call('POST', `/api/orders/${pgId}/confirm`, { paymentId: pgId });
  check('결제 확인·리포트 생성', confirmed.status === 200 && (confirmed.body.ready === false || confirmed.body.ready === true));
  for (let i = 0; i < 20; i++) {
    const r = await first.call('GET', `/api/orders/${pgId}/report`);
    if (r.status === 200) break;
    await new Promise(r => setTimeout(r, 20));
  }

  // 여기서 서버가 죽는다. 손님은 아직 리포트를 안 열었다
  first.close();

  const second = await boot();
  const afterRestart = await second.call('GET', `/api/orders/${pgId}/report`);
  check('재시작 후에도 리포트를 받는다', afterRestart.status === 200, `${afterRestart.status}`);
  check('본문이 그대로', String(afterRestart.body.text).includes('재시작을 넘어 살아남는'));
  check('열람 기록도 남는다', afterRestart.body.order.status === 'viewed');

  const refundCheck = await second.call('GET', `/api/orders/${pgId}/refund`);
  check('재시작 후에도 환불 판정이 된다', refundCheck.status === 200 && 'verdict' in refundCheck.body);

  const third = await boot();
  const stillViewed = await third.call('GET', `/api/orders/${pgId}/report`);
  check('두 번째 재시작에도 이용권 유지', stillViewed.status === 200);
  second.close(); third.close();
  await pool.end();
} else {
  section('G. 재시작 검증 — DATABASE_URL 이 없어 건너뜁니다');
}

// ── H. 저장소가 죽어도 사이트는 산다 ──────────────────────────
section('H. 저장소 장애가 사이트를 죽이지 않는다');

{
  /*
   * 처음에는 기동 중 `await migrate()` 를 그냥 두었다가, DB가 준비되기 전에
   * 배포가 돌아 서버가 기동에서 멈추고 **사이트 전체가 내려갔다.**
   * 심사자가 봐야 할 약관 페이지까지 같이 죽는다.
   *
   * 저장소가 끊겨도 무료 구간과 정책 페이지는 살아 있어야 한다.
   */
  const brokenStore: OrderStore = {
    async get() { throw new Error('데이터베이스에 연결할 수 없습니다.'); },
    async save() { throw new Error('데이터베이스에 연결할 수 없습니다.'); },
  };
  const brokenReports = {
    async get(): Promise<string | null> { throw new Error('연결 끊김'); },
    async set() { throw new Error('연결 끊김'); },
    async delete() { throw new Error('연결 끊김'); },
  };
  const srv = createServer(createApi({
    gateway: new StandbyGateway(), orders: brokenStore,
    reportStore: brokenReports, generate: standbyGenerate, business,
  }));
  await new Promise<void>((r) => srv.listen(0, r));
  const port = (srv.address() as { port: number }).port;
  const call = async (path: string) => {
    const res = await fetch(`http://127.0.0.1:${port}${path}`);
    return res.status;
  };

  check('첫 화면이 뜬다', (await call('/')) === 200);
  check('헬스체크가 산다', (await call('/healthz')) === 200);
  for (const path of ['/products', '/terms', '/privacy', '/refund']) {
    check(`${path} 가 뜬다`, (await call(path)) === 200);
  }
  // 주문 조회는 당연히 실패하지만, 500으로 실패할 뿐 서버가 죽지는 않는다
  check('주문 조회는 실패하되 서버는 살아 있다', (await call('/api/orders/ord_x/report')) === 500);
  check('그 뒤에도 정책 페이지가 뜬다', (await call('/terms')) === 200);
  srv.close();
}


// ── 주인 통과 ──────────────────────────────────────────────────
section('주인 통과 — 사장님만 값 없이 리포트까지 받는다');
{
  const 통과주문 = (pass?: string) => api('POST', '/api/orders', {
    ...reading, acknowledgedNotice: true, previewShown: true, ...(pass ? { pass } : {}),
  });

  const 원래값 = process.env.OWNER_PASS;

  // 암호를 안 넣어 두면 이 길은 아예 없다. 기본이 잠김이다
  delete process.env.OWNER_PASS;
  const 잠김 = await 통과주문('아무거나적어본다긴암호처럼');
  check('암호를 안 걸어 두면 통과가 없다',
    잠김.status === 201 && 잠김.body.order.amountKrw > 0, `${잠김.body?.order?.amountKrw}원`);

  const passNoEnv = await api('POST', '/api/pass/check', { pass: 'neulbom-owner-pass-verify-only' });
  check('OWNER_PASS 가 없을 때 → 어떤 암호를 줘도 ok: false',
    passNoEnv.status === 200 && passNoEnv.body.ok === false);

  // 짧은 암호는 받지 않는다. 주소창에 실려 다니므로 찍히면 끝난다
  process.env.OWNER_PASS = '짧다';
  const 짧음 = await 통과주문('짧다');
  check('짧은 암호는 통과로 치지 않는다',
    짧음.status === 201 && 짧음.body.order.amountKrw > 0, `${짧음.body?.order?.amountKrw}원`);

  process.env.OWNER_PASS = 'neulbom-owner-pass-verify-only';
  const 틀림 = await 통과주문('neulbom-owner-pass-verify-onlyX');
  check('암호가 한 글자만 달라도 통과하지 않는다',
    틀림.status === 201 && 틀림.body.order.amountKrw > 0, `${틀림.body?.order?.amountKrw}원`);

  const passWrong = await api('POST', '/api/pass/check', { pass: 'neulbom-owner-pass-verify-onlyX' });
  check('틀린 암호 → ok: false', passWrong.status === 200 && passWrong.body.ok === false);

  const passOk = await api('POST', '/api/pass/check', { pass: 'neulbom-owner-pass-verify-only' });
  check('맞는 암호로 /api/pass/check → ok: true', passOk.status === 200 && passOk.body.ok === true);

  check('답에 암호 글자가 들어 있지 않다',
    !JSON.stringify(passOk.body).includes('neulbom-owner-pass-verify-only') &&
    !JSON.stringify(passWrong.body).includes('neulbom-owner-pass-verify-onlyX'));

  const { renderCheckoutPage } = await import('../../packages/site-policy/src/index.ts');
  const coHtml = renderCheckoutPage(business, '', CATALOG['saju-report'], { storeId: 'test_store', channelKey: 'test_channel' });
  check('결제 화면 대본이 /api/pass/check 를 부른다', coHtml.includes('/api/pass/check'));
  check('화면 금액과 주문 금액이 다르면 결제창을 안 연다',
    coHtml.includes('created.order.amountKrw !== currentDisplayedAmount') &&
    coHtml.includes('값이 맞지 않습니다. 새로고침한 뒤 다시 해 주십시오.'));

  const 없음 = await 통과주문();
  check('암호를 안 보낸 손님은 그대로 값을 낸다',
    없음.status === 201 && 없음.body.order.amountKrw > 0, `${없음.body?.order?.amountKrw}원`);

  const 맞음 = await 통과주문('neulbom-owner-pass-verify-only');
  check('맞는 암호면 0원이 되어 리포트까지 간다',
    맞음.status === 201 && 맞음.body.order.amountKrw === 0, `${맞음.body?.order?.amountKrw}원`);

  // 판 것처럼 보이면 장부가 거짓이 된다. 주문에 그대로 남아야 한다
  check('주문에 「주인 통과」라고 남는다',
    맞음.body.order.rewardUsed === '주인 통과', String(맞음.body?.order?.rewardUsed));

  /*
   * 값이 0이 되는 것만으로는 반쪽이다. 사장님이 보려는 것은 **리포트 본문**이다.
   * 결제창을 거치지 않고 리포트까지 실제로 나오는지 여기서 끝까지 간다.
   */
  const 통과확인 = await api('POST', `/api/orders/${맞음.body.order.id}/confirm`,
    { paymentId: 맞음.body.order.id });
  check('결제창 없이 확정된다', 통과확인.status === 200 && 통과확인.body.ready === false);
  let 통과리포트 = await api('GET', `/api/orders/${맞음.body.order.id}/report`);
  for (let i = 0; i < 20 && 통과리포트.status === 202; i++) {
    await new Promise(r => setTimeout(r, 20));
    통과리포트 = await api('GET', `/api/orders/${맞음.body.order.id}/report`);
  }
  check('리포트 본문까지 나온다',
    통과리포트.status === 200 && typeof 통과리포트.body.text === 'string'
      && 통과리포트.body.text.length > 20,
    `${String(통과리포트.body?.text ?? '').length}자`);

  if (원래값 === undefined) delete process.env.OWNER_PASS;
  else process.env.OWNER_PASS = 원래값;
}

// ── H. 묶음 사기 ────────────────────────────────────────────────
section('H. 묶음도 살 수 있다');

const PACK = 'self-3';
const pack = PACKAGES[PACK];
const packMath = bundleMath(PACK);
const packReading = { productId: PACK, birth: BIRTH };

// 못 사는 것을 내밀면 속이는 것이다. 묶음이 결제까지 가야 끼워 팔 수 있다
check('묶음도 살 수 있는 것으로 잡힌다', orderable(PACK).members.length === pack.members.length);

const packPreview = await api('POST', '/api/preview', packReading);
check('묶음 미리보기가 뜬다', packPreview.status === 200, packPreview.body.error);
check('묶음 값은 묶음표에서 온다',
  packPreview.body.product.priceKrw === packMath.bundleKrw, `${packPreview.body.product.priceKrw}원`);
check('편마다 무엇이 담기는지 이름이 붙는다',
  packPreview.body.preview.contents.some((c: string) => c.startsWith(CATALOG[pack.members[0]].name + ' — ')));
check('묶음을 보는 손님에게 또 묶음을 내밀지 않는다', packPreview.body.upsell === null);

// 단품을 보는 손님에게는 그것을 품은 묶음을 내민다
const single = await api('POST', '/api/preview', reading);
const offer = single.body.upsell;
check('단품 미리보기에 묶음이 함께 온다', offer !== null && typeof offer.id === 'string');
check('얹는 금액을 알려 준다', offer.addKrw === offer.priceKrw - CATALOG['cross-report'].priceKrw);
// 판 적 없는 정가를 지어내지 않는다 — 낱개 판매가의 합계가 「따로 사면」이다
check('따로 사면 값은 낱개 판매가의 합계',
  offer.apartKrw === offer.members.reduce((a: number, m: any) => a + m.priceKrw, 0));
check('절약액은 그 차액', offer.saveKrw === offer.apartKrw - offer.priceKrw);
check('제일 싼 묶음을 내민다', offer.id === upsellFor('cross-report')!.id);

/*
 * 사다리 차례.
 *
 * 추천이 맨 앞, 그다음은 싼 것부터. 화면이 제 마음대로 줄을 세우지 않도록
 * 서버가 정해서 보낸다. 차례는 바꾸되 **미리 골라 두지는 않는다**.
 */
const ladder = single.body.upsells as any[];
check('사다리를 함께 보낸다', Array.isArray(ladder) && ladder.length > 0, `${ladder?.length}칸`);
check('추천이 맨 앞에 온다',
  ladder.every((o, i) => i === 0 || !(o.recommended && !ladder[i - 1].recommended)),
  ladder.map((o) => (o.recommended ? '★' : '·') + o.priceKrw).join(' '));
check('그다음은 싼 것부터',
  ladder.every((o, i) => i === 0 || ladder[i - 1].recommended || o.priceKrw >= ladder[i - 1].priceKrw));
// 값만 보고 고르지 않게, 누가 불러 주는지를 함께 보낸다
check('묶음마다 신령이 부르는 말이 붙는다',
  ladder.every((o) => o.handoff && typeof o.handoff.greet === 'string' && o.handoff.greet.length > 0));
// 화면에서 미리 체크되는 것은 단품이다. 서버는 그것을 강요할 수단을 주지 않는다
check('서버가 대신 골라 두지 않는다',
  ladder.every((o) => !('selected' in o) && !('checked' in o) && !('default' in o)));

const before = generateCalls;
const packOrder = await api('POST', '/api/orders',
  { ...packReading, acknowledgedNotice: true, previewShown: true });
check('묶음 주문이 생긴다', packOrder.status === 201, packOrder.body.error);
check('금액은 묶음값으로 고정',
  packOrder.body.order.amountKrw === packMath.bundleKrw, `${packOrder.body.order.amountKrw}원`);
check('묶음 주문에도 지문이 붙는다', /^[0-9a-f]{64}$/.test(packOrder.body.order.inputHash));
check('주문서를 만드는 동안 모델을 부르지 않는다', generateCalls === before);

const packId: string = packOrder.body.order.id;
await api('POST', `/api/orders/${packId}/pending`);
gateway.put({ paymentId: packId, status: 'paid', amountKrw: packMath.bundleKrw,
  merchantOrderId: packId, method: 'card', paidAt: new Date().toISOString(), raw: {} });
const packDone = await api('POST', `/api/orders/${packId}/confirm`, { paymentId: packId });
check('묶음 결제가 확정된다', packDone.status === 200 && (packDone.body.order.status === 'paid' || packDone.body.order.status === 'fulfilled'),
  packDone.body.error);
let packReport = await api('GET', `/api/orders/${packId}/report`);
for (let i = 0; i < 20 && packReport.status === 202; i++) {
  await new Promise(r => setTimeout(r, 20));
  packReport = await api('GET', `/api/orders/${packId}/report`);
}
check('편 수만큼 만든다', generateCalls === before + pack.members.length,
  `${generateCalls - before}편`);

check('한 벌로 붙여 준다', packReport.status === 200);
check('편마다 제목이 붙는다',
  pack.members.every((m) => packReport.body.text.includes(`# ${CATALOG[m].name}`)));

// 주문은 한 건, 이용권도 하나. 환불·열람 규칙을 건드리지 않았다
check('묶음도 주문은 한 건', typeof packReport.body.order.id === 'string');

const badPack = await api('POST', '/api/orders',
  { productId: 'no-such-pack', birth: BIRTH, acknowledgedNotice: true });
check('없는 묶음은 거부', badPack.status === 400);

// ── H2. 신령이 약속한 질문 하나 ──────────────────────────────────
/*
 * 화면에서 신령이 「원하는 것 하나를 말해 보렴」이라고 한다.
 * 그 말이 리포트까지 실제로 가는지 여기서 본다. 안 가면 거짓 광고다.
 */
// ── H1. 값이 다르면 물건도 달라야 한다 ────────────────────────
/*
 * 31개 상품이 실제로는 **여섯 가지 글**만 만들고 있었다.
 *
 * 돈그릇(14,900원)과 사주 종합(34,900원)이 글자 하나까지 같은 자료로 만들어졌고,
 * 캐시 열쇠까지 같아서 정말로 같은 글이 나갔다. 값이 다른데 물건이 같으면
 * 그건 파는 것이 아니다.
 *
 * 여기서 그것을 막는다. 아직 못 가른 것은 아래에 **이름을 적어 두고**,
 * 새로 겹치는 것이 생기면 바로 걸린다.
 */
section('H1. 값이 다르면 물건도 다르다');
{
  const BIRTH2 = { date: '1990-09-25', time: '14:40', longitude: 126.978, gender: '남' as const };
  const PARTNER2 = { date: '1992-03-03', time: '09:00', longitude: 126.978, gender: '여' as const };
  const byReport = new Map<string, string[]>();
  /*
   * 조용히 건너뛰지 않는다. 전에는 자료를 못 만드는 상품을 `continue` 로
   * 넘겨서, 택일 하나가 통째로 빠진 채 「다 다르다」고 통과하고 있었다.
   * 못 만들면 그 자체가 실패다.
   */
  const 못만든것: string[] = [];
  const 갈래어긋남: string[] = [];
  const 상대빠짐: string[] = [];
  for (const p of Object.values(CATALOG)) {
    let built;
    try {
      built = buildPayload({
        productId: p.id, birth: BIRTH2, partner: PARTNER2,
        // 아이 상품은 아이의 명식으로 세운다. 아이 자료가 없으면 만들어지지 않는 게 맞다
        child: { date: '2026-03-10', time: '10:00', gender: '여' },
        name: { surname: '김' }, pick: { dates: ['2027-04-30'], times: ['16:30'] },
        range: { from: '2026-10-01', to: '2026-10-31' },
        // 명절 가족운세는 한 상에 앉는 사람이 있어야 짝이 선다
        family: [
          { relation: '어머니', date: '1962-03-11', time: '08:30' },
          { relation: '아버지', date: '1958-11-02', time: '20:30' },
          { relation: '형', date: '1987-06-19', time: '12:00' },
        ],
      } as never);
    } catch (e) {
      못만든것.push(`${p.id}: ${(e as Error).message}`);
      continue;
    }
    /*
     * 표만 붙여 놓고 **자료는 안 갈라 준 상품**을 잡는다.
     *
     * 혼인 택일을 만들 때, 갈래만 「택일」로 적어 두고 계산은 나중에 하기로
     * 했다. 그런데 그 상품이 **그대로 팔 수 있는 상태로 라이브에 나갔다.**
     * 손님이 5만 9천 원을 내면, 신랑 한 사람의 사주만 담긴 자료를 들고
     * 모델이 「택일 리포트」를 써야 한다 — **날짜를 지어낸다.**
     *
     * 검증은 다 통과하고 있었다. 자료가 만들어지기는 했고, 다른 상품과
     * 겹치지도 않았기 때문이다. **갈래와 자료가 맞는지를 아무도 안 봤다.**
     */
    const 갈래필수: Record<string, string[]> = {
      택일: ['후보날', '순위'],
      궁합: ['A', 'B'],
      작명: ['이름밭', '채워야할기운'],
    };
    for (const 키 of 갈래필수[built.kind] ?? []) {
      if (!(키 in (built.data as Record<string, unknown>))) {
        갈래어긋남.push(`${p.id}: ${built.kind}인데 ${키}가 없다`);
        break;
      }
    }
    /*
     * 상대가 필요하다고 적어 둔 상품은 **자료에 상대가 실제로 들어가야 한다.**
     * 결제 화면에서 상대 생년월일을 받아 놓고 계산에 안 쓰면, 손님은 낸 돈만큼
     * 못 받는다.
     */
    if (p.needsPartner) {
      const 글 = JSON.stringify(built.data) + String(built.subject);
      if (!글.includes(PARTNER2.date.slice(0, 4)) && !String(built.subject).includes('·')) {
        상대빠짐.push(p.id);
      }
    }
    const key = cacheKey({
      input: { kind: built.kind, data: built.data, subject: built.subject },
      model: 'claude-opus-5', effort: 'medium',
    });
    byReport.set(key, [...(byReport.get(key) ?? []), p.id]);
  }
  check('갈래와 자료가 맞는다', 갈래어긋남.length === 0,
    갈래어긋남.join(' / ') || '전부 맞음');
  check('상대가 필요한 상품은 자료에 상대가 들어간다', 상대빠짐.length === 0,
    상대빠짐.join(' / ') || '전부 들어감');
  check('상품마다 리포트 자료가 만들어진다', 못만든것.length === 0, 못만든것.join(' / ') || '31개 모두');

  /*
   * **상품 하나에 글 하나.** 이제 예외가 없다.
   *
   * 한때 서른한 개가 여섯 가지 글만 만들고 있었다. 돈그릇(14,900원)과
   * 사주 종합(34,900원)이 글자 하나까지 같았다. 여기서 다시는 그렇게
   * 되지 않게 막는다 — 새 상품을 만들 때 자료를 안 갈라 주면 바로 걸린다.
   */
  const 겹침 = [...byReport.values()].filter((ids) => ids.length > 1);
  check('값이 다른 상품이 같은 글을 내지 않는다', 겹침.length === 0,
    겹침.map((ids) => ids.join(' = ')).join(' / ') || `${byReport.size}개 모두 다름`);
  check('상품 수만큼 글이 나온다', byReport.size === Object.keys(CATALOG).length,
    `상품 ${Object.keys(CATALOG).length}개 · 글 ${byReport.size}가지`);

  // 「생년월일 없이 얼굴과 손만으로 봅니다」라고 팔아 놓고 사주를 실으면 거짓말이다
  const fp = buildPayload({ productId: 'face-palm-report', birth: BIRTH2 } as never);
  check('얼굴과 손 상품에 사주가 실리지 않는다', !('사주' in (fp.data as object)),
    Object.keys(fp.data as object).join('/'));
  const sp = buildPayload({ productId: 'saju-palm-report', birth: BIRTH2 } as never);
  check('사주 × 손금에 관상이 실리지 않는다', !('관상' in (sp.data as object)));
  const sf = buildPayload({ productId: 'saju-face-report', birth: BIRTH2 } as never);
  check('사주 × 관상에 손금이 실리지 않는다', !('손금' in (sf.data as object)));

  // 1단계 검증: 치우친 값이 없는 보통(mid) 손님도 관상 10대목, 손금 6대목이 빠짐없이 실린다
  const crossMid = buildPayload({
    productId: 'cross-report',
    birth: BIRTH2,
    face: {},
    palm: {},
  } as never);
  const crossData = crossMid.data as { 관상?: { 부위별: unknown[] }; 손금?: { 항목별: unknown[] } };
  check('보통 손님도 관상 10대목이 빠짐없이 실린다', crossData.관상?.부위별.length === 10, `${crossData.관상?.부위별.length}대목`);
  check('보통 손님도 손금 6대목이 빠짐없이 실린다', crossData.손금?.항목별.length === 6, `${crossData.손금?.항목별.length}대목`);

  /*
   * 화면에 적은 것과 자료가 같은 말을 해야 한다.
   *
   * 「다섯 해를 봅니다」라고 적어 놓고 세 해만 실으면 그건 거짓 광고다.
   * 상세페이지 글과 리포트 자료가 다른 말을 하면 그 자체가 위반이다.
   */
  const 해수: Record<string, number> = {
    'wealth-report': 3, 'career-report': 3, 'expression-report': 3, 'peers-report': 3,
    'helper-report': 3, 'learning-report': 3, 'travel-report': 3, 'admission-report': 3,
    'exam-report': 5, 'job-report': 5,
  };
  for (const [id, want] of Object.entries(해수)) {
    const d = buildPayload({ productId: id, birth: BIRTH2,
      child: { date: '2026-03-10', time: '10:00', gender: '여' } } as never).data as { 세운: unknown[] };
    const 말 = { 3: '세 해', 5: '다섯 해' }[want];
    const said = (CONTENTS_FOR(id) ?? []).some((t) => t.includes(`올해부터 ${말}`));
    check(`${CATALOG[id as never].name} — 적어 둔 해수와 자료가 맞는다`,
      d.세운.length === want && said, `${d.세운.length}해`);
  }

  /*
   * 결제 직전에 **무엇을 받는지** 한 줄도 안 보여 주는 상품이 있으면 안 된다.
   *
   * 자료를 주제별로 자르고 나서 미리보기를 안 고쳤더니 주제 상품이 세 줄로
   * 쪼그라들었고, 매력 삼합과 「얼굴과 손」은 **아예 0줄**이었다.
   * 오늘의 운세도 0줄이었다 — 제일 많은 사람이 처음 사 보는 자리다.
   */
  const 얇은것: string[] = [];
  for (const p of Object.values(CATALOG)) {
    let pl;
    try {
      pl = buildPayload({
        productId: p.id, birth: BIRTH2, partner: PARTNER2,
        // 아이 상품은 아이의 명식으로 세운다. 아이 자료가 없으면 만들어지지 않는 게 맞다
        child: { date: '2026-03-10', time: '10:00', gender: '여' },
        name: { surname: '김' }, pick: { dates: ['2027-04-30'], times: ['16:30'] },
        range: { from: '2026-10-01', to: '2026-10-31' },
        // 명절 가족운세는 한 상에 앉는 사람이 있어야 짝이 선다
        family: [
          { relation: '어머니', date: '1962-03-11', time: '08:30' },
          { relation: '아버지', date: '1958-11-02', time: '20:30' },
          { relation: '형', date: '1987-06-19', time: '12:00' },
        ],
      } as never);
    } catch { continue; }
    const n = buildPreview(p.id as never, pl.data, p.previewRatio).contents.length;
    if (n < 4) 얇은것.push(`${p.name} ${n}줄`);
  }
  check('상품마다 담기는 것을 네 줄 넘게 보여 준다', 얇은것.length === 0,
    얇은것.join(', ') || `${Object.keys(CATALOG).length}개 모두`);

  // 주제 상품은 그 주제만 받는다. 자료에 다 들어 있으면 모델은 결국 쓴다
  const w = buildPayload({ productId: 'wealth-report', birth: BIRTH2 } as never);
  check('주제 상품은 주제 갈래로 나간다', w.kind === '주제');
  check('주제 상품에 신살·특징 전체가 실리지 않는다',
    !('신살' in (w.data as object)) && !('두드러진_특징' in (w.data as object)));
  check('주제 상품이 사주 종합보다 자료가 적다',
    JSON.stringify(w.data).length
      < JSON.stringify(buildPayload({ productId: 'saju-report', birth: BIRTH2 } as never).data).length,
    `${JSON.stringify(w.data).length}자 < 사주 종합`);
}

section('H2. 물어본 것이 리포트까지 간다');

const Q = '올해 이직해도 괜찮을까요?';
// 아무것도 안 물은 같은 손님. 이것과 견준다
const quietBase = await api('POST', '/api/orders',
  { productId: 'cross-report', birth: BIRTH, face: { foreheadWidth: 'wide' }, palm: { lifeLength: 'long' }, acknowledgedNotice: true, previewShown: true });
const askOrder = await api('POST', '/api/orders',
  { productId: 'cross-report', birth: BIRTH, face: { foreheadWidth: 'wide' }, palm: { lifeLength: 'long' }, question: Q, acknowledgedNotice: true, previewShown: true });
check('질문을 실은 주문이 생긴다', askOrder.status === 201, askOrder.body.error);
check('질문이 다르면 다른 주문으로 친다',
  askOrder.body.order.inputHash !== quietBase.body.order.inputHash);

const askId: string = askOrder.body.order.id;
await api('POST', `/api/orders/${askId}/pending`);
gateway.put({ paymentId: askId, status: 'paid', amountKrw: askOrder.body.order.amountKrw,
  merchantOrderId: askId, method: 'card', paidAt: new Date().toISOString(), raw: {} });
generateArgs.length = 0;
const askDone = await api('POST', `/api/orders/${askId}/confirm`, { paymentId: askId });
check('결제가 확정된다', askDone.status === 200, askDone.body.error);
check('물어본 것이 그대로 생성기까지 간다', generateArgs.at(-1)?.question === Q,
  generateArgs.at(-1)?.question ?? '안 감');

// 묶음은 편이 여럿이다. 같은 답을 여러 번 하면 성의가 아니라 허술함이다
generateArgs.length = 0;
const packAsk = await api('POST', '/api/orders',
  { ...packReading, question: Q, acknowledgedNotice: true, previewShown: true });
const packAskId: string = packAsk.body.order.id;
await api('POST', `/api/orders/${packAskId}/pending`);
gateway.put({ paymentId: packAskId, status: 'paid', amountKrw: packAsk.body.order.amountKrw,
  merchantOrderId: packAskId, method: 'card', paidAt: new Date().toISOString(), raw: {} });
await api('POST', `/api/orders/${packAskId}/confirm`, { paymentId: packAskId });
check('묶음에서는 한 편에만 답한다',
  generateArgs.filter((g) => g.question).length === 1,
  `${generateArgs.filter((g) => g.question).length}편`);
check('그 한 편은 마지막 편이다', generateArgs.at(-1)?.question === Q);

// 안 물어도 된다. 그게 기본이다
generateArgs.length = 0;
const quiet = await api('POST', '/api/orders',
  { productId: 'cross-report', birth: BIRTH, face: { foreheadWidth: 'wide' }, palm: { lifeLength: 'long' }, question: '   ', acknowledgedNotice: true });
check('빈 질문은 없는 것으로 친다', quiet.body.order.inputHash === quietBase.body.order.inputHash);

const badQ = await api('POST', '/api/orders',
  { productId: 'cross-report', birth: BIRTH, face: { foreheadWidth: 'wide' }, palm: { lifeLength: 'long' }, question: { 나쁜: '것' }, acknowledgedNotice: true });
check('글이 아닌 질문은 거부', badQ.status === 400, badQ.body.error);

const longQ = await api('POST', '/api/orders',
  { productId: 'cross-report', birth: BIRTH, face: { foreheadWidth: 'wide' }, palm: { lifeLength: 'long' }, question: '가'.repeat(600), acknowledgedNotice: true });
check('아주 긴 질문도 서버가 버틴다', longQ.status === 201, longQ.body.error);

// ─── 택일 리포트 ──────────────────────────────────────────────
// 아직 태어나지 않은 아이의 날을 고르는 상품이라, 생년월일 없이도 서야 한다
{
  /*
   * 터진 뒤에 적은 것 (2026-10-05): 손님에게 후보 날짜를 하나하나 적으라고 했다.
   * 이제 **기간만 받고** 그 안에서 우리가 고른다.
   */
  const PICK = { times: ['15:30', '16:30'], longitude: 126.705, place: '인천' };
  const 기간 = { from: '2027-04-27', to: '2027-04-30' };

  const noBirth = await api('POST', '/api/preview',
    { productId: 'pick-report', pick: PICK, range: 기간 });
  check('생년월일 없이도 미리보기가 선다', noBirth.status === 200, noBirth.body?.error);
  const c = noBirth.body?.preview?.contents ?? [];
  check('무엇이 담기는지 미리 보여 준다', c.length >= 4, `${c.length}줄`);
  check('1순위와 까닭을 미리 보여 준다',
    c.some((x: string) => x.startsWith('1순위 2027-04-30'))
    && c.some((x: string) => x.startsWith('1순위 근거:')));
  // 손님이 고른 것은 「16~17시」다. 우리가 재려고 잡은 16:30 이 나가면 안 된다
  check('고른 말 그대로 되돌려 준다',
    c.some((x: string) => x.includes('16~17시')) && !c.join(' ').includes('16:30'));
  check('값은 서버가 가진 것으로',
    noBirth.body?.product?.priceKrw === CATALOG['pick-report'].priceKrw,
    `${noBirth.body?.product?.priceKrw}원`);

  const noDates = await api('POST', '/api/preview', { productId: 'pick-report' });
  check('기간이 없으면 거부', noDates.status === 400);
  const noTimes = await api('POST', '/api/preview',
    { productId: 'pick-report', pick: { times: [] }, range: 기간 });
  check('가능한 시각이 없으면 거부', noTimes.status === 400);
  /* 기간 안의 날을 하루도 빠짐없이 센다 */
  check('기간 안의 날을 모두 센다', (() => {
    const 센날 = noBirth.body?.preview?.contents?.join(' ') ?? '';
    return 센날.includes('2027-04-27') || 센날.includes('후보 4날') || 센날.includes('4날');
  })(), (noBirth.body?.preview?.contents ?? []).slice(0, 2).join(' / '));
  // 다른 상품은 그대로 생년월일을 받는다 — 택일 때문에 문이 열리면 안 된다
  const stillNeeds = await api('POST', '/api/preview', { productId: 'saju-report' });
  check('다른 상품은 여전히 생년월일이 있어야 한다', stillNeeds.status === 400);
}

// ─── 혼인 택일 리포트 ──────────────────────────────────────────
{
  section('혼인 택일 리포트 (두 사람 생년월일 + 기간)');

  // 1. 상품이 목록에 나오고 상품 페이지가 열린다
  const prods = await api('GET', '/api/products');
  check('혼인 택일 상품이 목록에 나온다',
    prods.body.products.some((p: any) => p.id === 'marriage-pick-report'));
  const prodPage = await page('/products/marriage-pick-report');
  check('혼인 택일 상품 페이지가 열린다 (200)', prodPage.status === 200);

  // 2. 상세페이지 본문에 값이 안 보인다
  check('상세페이지 본문에 값이 안 보인다 (가격안내 법 준수)',
    !prodPage.html.includes('59,000'));
  check('상세페이지에 결제 화면에서 기간 정한다는 안내가 있다',
    prodPage.html.includes('원하시는 기간을 결제 화면에서 정하시면 됩니다.'));

  // 3. 결제 화면에 상대 생년월일 칸과 기간 칸이 뜬다
  const coHtml = renderCheckoutPage(business, '', CATALOG['marriage-pick-report'], { storeId: 'test_store', channelKey: 'test_channel' });
  check('결제 화면에 상대 생년월일 칸이 뜬다', coHtml.includes('name="partnerDate"'));
  check('결제 화면에 기간 칸(시작·끝)이 뜬다',
    coHtml.includes('name="rangeFrom"') && coHtml.includes('name="rangeTo"'));

  // 4. 기간 없이 주문하면 400
  const noRange = await api('POST', '/api/orders', {
    productId: 'marriage-pick-report',
    acknowledgedNotice: true,
    birth: BIRTH,
    partner: { date: '1992-08-20', time: '10:00' },
  });
  check('기간 없이 주문하면 400', noRange.status === 400, noRange.body?.error);

  // 5. 기간이 뒤집히면 400
  const flipped = await api('POST', '/api/orders', {
    productId: 'marriage-pick-report',
    acknowledgedNotice: true,
    birth: BIRTH,
    partner: { date: '1992-08-20', time: '10:00' },
    range: { from: '2026-10-31', to: '2026-10-01' },
  });
  check('기간이 뒤집히면 400', flipped.status === 400, flipped.body?.error);

  // 6. 181일을 넣으면 400
  const over180 = await api('POST', '/api/orders', {
    productId: 'marriage-pick-report',
    acknowledgedNotice: true,
    birth: BIRTH,
    partner: { date: '1992-08-20', time: '10:00' },
    range: { from: '2026-05-01', to: '2026-10-31' }, // 184일
  });
  check('181일 이상 넣으면 400',
    over180.status === 400 && String(over180.body?.error).includes('여섯 달'),
    over180.body?.error);

  // 7. 만들어진 자료에 후보날과 순위가 들어 있다
  const pl = buildPayload({
    productId: 'marriage-pick-report',
    birth: BIRTH,
    partner: { date: '1992-08-20', time: '10:00' },
    range: { from: '2026-10-01', to: '2026-10-31' },
  });
  check('갈래가 택일이다', pl.kind === '택일');
  check('만들어진 자료에 후보날이 들어 있다',
    Array.isArray(pl.data?.후보날) && pl.data.후보날.length === 31);
  check('만들어진 자료에 순위가 들어 있다',
    Array.isArray(pl.data?.순위) && pl.data.순위.length === 31);

  // 8. 만들어진 자료에 신부가 들어 있다
  check('만들어진 자료에 신부가 들어 있다',
    pl.data?.신부?.생년월일 === '1992-08-20');

  // 9. 모든 날에 근거가 한 줄 이상 붙어 있다
  check('모든 날에 근거가 한 줄 이상 붙어 있다',
    Array.isArray(pl.data?.순위) && pl.data.순위.every((item: any) => Array.isArray(item.까닭) && item.까닭.length >= 1));
}

// ─── I. 신규 주문 조회 및 확정 멱등성 검증 ───────────────────────
section('I. 신규 주문 조회 및 확정 멱등성');

// 1. 코드 어디에도 2026-09-24 같은 박힌 날짜가 없다
const fs = await import('fs');
const payloadSource = fs.readFileSync(new URL('./src/payload.ts', import.meta.url), 'utf8');
const catalogSource = fs.readFileSync(new URL('../../packages/commerce/src/catalog.ts', import.meta.url), 'utf8');
const productsSource = fs.readFileSync(new URL('../../packages/site-policy/src/products.ts', import.meta.url), 'utf8');
check('코드 어디에도 2026-09-24 같은 박힌 날짜가 없다',
  !payloadSource.includes('2026-09-24') &&
  !catalogSource.includes('2026-09-24') &&
  !productsSource.includes('2026-09-24') &&
  !payloadSource.includes('9월 24일') &&
  !catalogSource.includes('9월 24일') &&
  !productsSource.includes('9월 24일'));

// 2. /order/<없는번호> 는 404 다
const noOrder = await page('/order/ord_nonexistent_12345');
check('/order/<없는번호> 는 404 다', noOrder.status === 404 && noOrder.html.includes('그런 주문이 없습니다'));

// 3. 확정을 두 번 불러도 탈이 없다
const doubleOrder = await api('POST', '/api/orders', { ...reading, acknowledgedNotice: true, previewShown: true });
const doubleId = doubleOrder.body.order.id;
await api('POST', `/api/orders/${doubleId}/pending`);
gateway.put({ paymentId: doubleId, status: 'paid', amountKrw: CATALOG['cross-report'].priceKrw, merchantOrderId: doubleId, method: 'card', paidAt: new Date().toISOString(), raw: {} });
const firstConfirm = await api('POST', `/api/orders/${doubleId}/confirm`, { paymentId: doubleId });
check('첫 번째 확정 성공', firstConfirm.status === 200 && firstConfirm.body.ready === false);
const secondConfirm = await api('POST', `/api/orders/${doubleId}/confirm`, { paymentId: doubleId });
check('확정을 두 번 불러도 탈이 없다', secondConfirm.status === 200 && secondConfirm.body.ready === false);

// 4. 결제 완료된 주문의 백그라운드 리포트 생성 완료 대기 및 /order/:id 조회 시 리포트 노출 확인
for (let i = 0; i < 30; i++) {
  const r = await api('GET', `/api/orders/${doubleId}/report`);
  if (r.status === 200) break;
  await new Promise(r => setTimeout(r, 50));
}
const orderPage = await page(`/order/${doubleId}`);
check('/order/<진짜 주문번호> 는 리포트를 보여준다',
  orderPage.status === 200 &&
  orderPage.html.includes('이 주소를 저장해 두시면 언제든 다시 보실 수 있습니다') &&
  orderPage.html.includes(doubleId));
check('이메일 없는 주문의 리포트 화면에도 증표 상자(nb-invite-box)와 안내/단추가 노출된다',
  orderPage.html.includes('class="nb-invite-box"') &&
  orderPage.html.includes('증표를 받으시려면 받으실 메일 주소를 적어 주십시오') &&
  orderPage.html.includes('href="/invite"') &&
  orderPage.html.includes('id="nbGoInviteBtn"'));

// 터진 뒤에 적은 것 (2026-10-01): 풀이를 다 만들어 놓고도 화면은
// 「결제 확인에 실패했습니다」라고 말했다. 처음 사는 손님만 당했다.
// 통로 하나에 모델 호출을 매달면 안 된다.
{
  const slowGateway = new FakeGateway();
  const slowOrders = new MemoryOrderStore();
  let slowResolve: ((val: any) => void) | null = null;
  const slowHandler = createApi({
    gateway: slowGateway,
    orders: slowOrders,
    business,
    referrals: new MemoryReferralStore(),
    generate: async () => {
      return new Promise((resolve) => {
        slowResolve = resolve;
        setTimeout(() => resolve({ text: '[60초 뒤 풀이]' }), 60_000);
      });
    },
  });
  const slowServer = createServer(slowHandler);
  await new Promise<void>((r) => slowServer.listen(0, r));
  const slowPort = (slowServer.address() as { port: number }).port;
  const slowBase = `http://127.0.0.1:${slowPort}`;

  const slowOrderRes = await fetch(`${slowBase}/api/orders`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...reading, acknowledgedNotice: true, previewShown: true }),
  });
  const slowOrderId = (await slowOrderRes.json() as any).order.id;
  await fetch(`${slowBase}/api/orders/${slowOrderId}/pending`, { method: 'POST' });
  slowGateway.put({
    paymentId: slowOrderId,
    status: 'paid',
    amountKrw: CATALOG['cross-report'].priceKrw,
    merchantOrderId: slowOrderId,
    method: 'card',
    paidAt: new Date().toISOString(),
    raw: {},
  });

  const confirmStart = Date.now();
  const slowConfirmRes = await fetch(`${slowBase}/api/orders/${slowOrderId}/confirm`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ paymentId: slowOrderId }),
  });
  const confirmElapsed = Date.now() - confirmStart;
  const slowConfirmBody = await slowConfirmRes.json() as any;

  check('풀이 짓는 데 오래 걸려도 결제 확인은 곧바로 답한다',
    slowConfirmRes.status === 200 && confirmElapsed < 3000 && slowConfirmBody.ready === false,
    `응답 ${confirmElapsed}ms`);

  const pollBeforeReady = await fetch(`${slowBase}/api/orders/${slowOrderId}/report`);
  const pollBeforeReadyBody = await pollBeforeReady.json() as any;
  const is202 = pollBeforeReady.status === 202 && pollBeforeReadyBody.ready === false;

  if (slowResolve) {
    (slowResolve as (val: any) => void)({ text: '드디어 완성된 풀이' });
  }

  let is200 = false;
  for (let i = 0; i < 30; i++) {
    await new Promise((r) => setTimeout(r, 50));
    const pollAfter = await fetch(`${slowBase}/api/orders/${slowOrderId}/report`);
    if (pollAfter.status === 200) {
      const afterBody = await pollAfter.json() as any;
      if (afterBody.ready === true && afterBody.text?.includes('드디어 완성된 풀이')) {
        is200 = true;
        break;
      }
    }
  }
  check('풀이가 아직이면 202 로 답하고, 되면 200 으로 답한다', is202 && is200);

  slowServer.close();

  const checkoutHtmlRes = renderCheckoutPage(business, '', CATALOG['cross-report']);
  check('결제 확인이 실패해도 화면이 풀이 기다리기로 넘어간다',
    checkoutHtmlRes.includes('waitForReport') &&
    checkoutHtmlRes.includes('/report') &&
    checkoutHtmlRes.includes('catch'));
}


  // ─── 오늘의 운세(daily-report) 상세페이지 및 무료 미리보기 검증 ──
  const drPage = await page('/products/daily-report');
  check('오늘의 운세 상세페이지에 입력칸이 있다',
    drPage.html.includes('id="dpDate"') &&
    drPage.html.includes('id="dpTime"') &&
    drPage.html.includes('id="dpPlace"') &&
    drPage.html.includes('id="dpForm"') &&
    drPage.html.includes('값 안 받습니다'));

  // 무료 구간을 만드는 길에서 모델 호출이 한 번도 일어나지 않는다
  const callsBeforePreview = generateCalls;
  const drPreviewRes = await api('POST', '/api/preview', {
    productId: 'daily-report',
    birth: { date: '1990-09-25', time: '14:40', place: '인천', gender: '남' },
  });
  const drPreviewJson = drPreviewRes.body;
  check('무료 구간을 만드는 길에서 모델 호출이 한 번도 일어나지 않는다',
    generateCalls === callsBeforePreview);

  // 무료로 나가는 시진이 정확히 둘이고, 둘 다 「유리」이며 충이 없다
  const revealedSlots = drPreviewJson.dailyPreview?.hours?.revealed ?? [];
  check('무료로 나가는 시진이 정확히 둘이고, 둘 다 「유리」이며 충이 없다',
    revealedSlots.length === 2 &&
    revealedSlots.every((s: any) => s.유불리 === '유리' && !s.label.includes('충')));

  // 나쁜 시간이 무료 구간에 한 글자도 나오지 않는다
  // calculateDailyHours 에서 산출되는 조심할 두 시간(badTwo)이 무료 공개 시진에 포함되지 않아야 함
  const revealedNames = revealedSlots.map((s: any) => s.시진);
  check('나쁜 시간이 무료 구간에 한 글자도 나오지 않는다',
    revealedSlots.length === 2 &&
    revealedSlots.every((s: any) => s.유불리 === '유리') &&
    !revealedSlots.some((s: any) => s.label.includes('조심') || s.label.includes('위험') || s.label.includes('충')));

  // 나머지 31개 페이지는 옛 구조 그대로다
  let other31Kept = true;
  for (const p of Object.values(CATALOG)) {
    if (p.id === 'daily-report') continue;
    const op = await page(`/products/${p.id}`);
    if (op.html.includes('id="dpForm"') || !op.html.includes('pd-sample-lead')) {
      other31Kept = false;
      break;
    }
  }
  check('나머지 31개 페이지는 옛 구조 그대로다', other31Kept);

  // 어디에도 취소선 정가·할인율·거짓 급함·가짜 후기가 없다
  const forbiddenPatterns = [
    '<del>', '<s>', '정가', '할인율', '선착순', '오늘 마감', '지금만', '별점', '후기', '명이 지금 보고 있습니다'
  ];
  let hasForbidden = false;
  for (const pat of forbiddenPatterns) {
    if (drPage.html.includes(pat)) {
      hasForbidden = true;
      break;
    }
  }
  check('어디에도 취소선 정가·할인율·거짓 급함·가짜 후기가 없다', !hasForbidden);

// ── J. 월운세 · 행운의 번호 · 친구 추천 검증 ─────────────────────────
section('J. 월운세 · 행운의 번호 · 친구 추천');

{
  const { readFileSync } = await import('node:fs');
  const { join, dirname } = await import('node:path');
  const { fileURLToPath } = await import('node:url');
  const { generateInviteCode } = await import('../../packages/commerce/src/index.ts');
  const here = dirname(fileURLToPath(import.meta.url));

  // 1. 월운세 값이 catalog.ts 한 곳에서만 온다
  const catalogPath = join(here, '../../packages/commerce/src/catalog.ts');
  const catalogSrc = readFileSync(catalogPath, 'utf8');
  check('월운세 값이 catalog.ts 한 곳에서만 온다',
    CATALOG['month-report']?.priceKrw === 9900 && catalogSrc.includes('priceKrw: 9900'));

  // 2. 2만원 미만 주문에 invite 를 붙여도 값이 깎이지 않는다
  const inviterEmail = 'inviter_spec@example.com';
  const myCode = generateInviteCode(inviterEmail);
  await api('POST', '/api/invite/status', { email: inviterEmail });
  const cheapOrder = await api('POST', '/api/orders', {
    productId: 'month-report',
    email: 'newbie_cheap@example.com',
    invite: myCode,
    acknowledgedNotice: true,
    previewShown: true,
    birth: { date: '1990-01-01', time: '12:00', place: '서울', gender: '남' },
  });
  check('2만원 미만 주문에 invite 를 붙여도 값이 깎이지 않는다',
    cheapOrder.status === 201 && cheapOrder.body.order.amountKrw === 9900);

  // 3. 2만원 이상 주문에 invite 를 붙이면 값이 3,000원 깎인다
  const expOrder = await api('POST', '/api/orders', {
    productId: 'newyear-report',
    email: 'newbie_exp@example.com',
    invite: myCode,
    acknowledgedNotice: true,
    previewShown: true,
    birth: { date: '1990-01-01', time: '12:00', place: '서울', gender: '남' },
  });
  const normalPrice = CATALOG['newyear-report'].priceKrw;
  check('2만원 이상 주문에 invite 붙이면 3,000원 깎인다',
    expOrder.status === 201 && expOrder.body.order.amountKrw === normalPrice - 3000);

  // Pending & confirm payment for newbie_exp
  await api('POST', `/api/orders/${expOrder.body.order.id}/pending`);
  gateway.put({
    paymentId: expOrder.body.order.id,
    status: 'paid',
    amountKrw: expOrder.body.order.amountKrw,
    merchantOrderId: expOrder.body.order.id,
    method: 'card',
    paidAt: new Date().toISOString(),
    raw: {},
  });
  await api('POST', `/api/orders/${expOrder.body.order.id}/confirm`, { paymentId: expOrder.body.order.id });

  // 4. 같은 이메일이 할인권을 두 번 쓸 수 없다
  const expOrderSecond = await api('POST', '/api/orders', {
    productId: 'newyear-report',
    email: 'newbie_exp@example.com',
    invite: myCode,
    acknowledgedNotice: true,
    previewShown: true,
    birth: { date: '1990-01-01', time: '12:00', place: '서울', gender: '남' },
  });
  check('같은 이메일이 할인권을 두 번 쓸 수 없다',
    expOrderSecond.status === 201 && expOrderSecond.body.order.amountKrw === normalPrice);

  // 5. 자기 코드로 자기가 할인받을 수 없다
  const selfOrder = await api('POST', '/api/orders', {
    productId: 'newyear-report',
    email: inviterEmail,
    invite: myCode,
    acknowledgedNotice: true,
    previewShown: true,
    birth: { date: '1990-01-01', time: '12:00', place: '서울', gender: '남' },
  });
  check('자기 코드로 자기가 할인받을 수 없다',
    selfOrder.status === 201 && selfOrder.body.order.amountKrw === normalPrice);

  // 6. 환불하면 센 소개가 되돌아간다
  const beforeRefund = await api('POST', '/api/invite/status', { email: inviterEmail });
  const countBefore = beforeRefund.body.count;
  await api('POST', `/api/orders/${expOrder.body.order.id}/refund`);
  const afterRefund = await api('POST', '/api/invite/status', { email: inviterEmail });
  const countAfter = afterRefund.body.count;
  check('환불하면 센 소개가 되돌아간다',
    countBefore === 1 && countAfter === 0);

  // 7. 행운의 번호 여섯 개가 1~45 안이고 겹치지 않는다
  const { calculate } = await import('../../packages/manseryeok/src/index.ts');
  const { luckyNumbers, analyze } = await import('../../packages/saju-rules/src/index.ts');
  const msUser = calculate({ date: '1992-05-20', time: '10:30', place: '서울', gender: '여' });
  const ysUser = analyze(msUser).yongsin;
  const numObj = luckyNumbers(msUser, ysUser, '2026-09-21');
  const uniqueNums = new Set(numObj.numbers);
  check('행운의 번호 여섯 개가 1~45 안이고 겹치지 않는다',
    numObj.numbers.length === 6 &&
    uniqueNums.size === 6 &&
    numObj.numbers.every(n => Number.isInteger(n) && n >= 1 && n <= 45));

  // 8. 같은 사람 같은 주 → 행운의 번호가 똑같다. 사람이 다르면 다르다
  const numObjSame = luckyNumbers(msUser, ysUser, '2026-09-21');
  const msOther = calculate({ date: '1988-11-11', time: '22:00', place: '대구', gender: '남' });
  const ysOther = analyze(msOther).yongsin;
  const numObjOther = luckyNumbers(msOther, ysOther, '2026-09-21');
  check('같은 사람 같은 주 → 행운의 번호가 똑같다. 사람이 다르면 다르다',
    JSON.stringify(numObj.numbers) === JSON.stringify(numObjSame.numbers) &&
    JSON.stringify(numObj.numbers) !== JSON.stringify(numObjOther.numbers));

  // 9. 화면 어디에도 「로또」·「복권」·「당첨」 이 없다
  const { renderInvitePage, renderAdminInvitePage, renderProductPage } = await import('../../packages/site-policy/src/index.ts');
  const invHtml = renderInvitePage(business, '');
  const admHtml = renderAdminInvitePage(business, '', 'test_token', [], []);
  const mHtml = renderProductPage(CATALOG['month-report'], business, true, '', new Set(), new Set());
  const forbidden = ['로또', '복권', '당첨'];
  const foundInScreen = forbidden.some(w =>
    invHtml.includes(w) || admHtml.includes(w) || mHtml.includes(w) || numObj.근거.includes(w)
  );
  check('화면 어디에도 「로또」·「복권」·「당첨」 이 없다', !foundInScreen);

  // 10. ADMIN_TOKEN 이 없으면 관리 화면이 404다
  const savedToken = process.env.ADMIN_TOKEN;
  delete process.env.ADMIN_TOKEN;
  const resNoToken = await page('/admin/invite');
  process.env.ADMIN_TOKEN = 'my_admin_secret_pass';
  const resBadToken = await page('/admin/invite?token=wrong');
  const resOkToken = await page('/admin/invite?token=my_admin_secret_pass');
  process.env.ADMIN_TOKEN = savedToken;
  check('ADMIN_TOKEN 이 없으면 관리 화면이 404다',
    resNoToken.status === 404 && resBadToken.status === 404 && resOkToken.status === 200);

  // 11. 월운세 상세페이지가 모델을 부르지 않는다
  const callsBefore = generateCalls;
  await page('/products/month-report');
  await api('POST', '/api/preview', {
    productId: 'month-report',
    acknowledgedNotice: true,
    birth: { date: '1990-08-15', time: '13:00', place: '서울', gender: '남' },
  });
  check('월운세 상세페이지가 모델을 부르지 않는다', generateCalls === callsBefore);

  // 12. 없는 증표로는 3,000원이 깎이지 않는다
  const fakeCodeOrder = await api('POST', '/api/orders', {
    productId: 'newyear-report',
    email: 'newbie_fake@example.com',
    invite: 'nbaaaaaa',
    acknowledgedNotice: true,
    previewShown: true,
    birth: { date: '1990-01-01', time: '12:00', place: '서울', gender: '남' },
  });
  check('없는 증표로도 3,000원이 깎이지 않는다',
    fakeCodeOrder.status === 201 && fakeCodeOrder.body.order.amountKrw === normalPrice);

  // 13. 이메일이 없으면 증표 할인을 하지 않는다
  const noEmailOrder = await api('POST', '/api/orders', {
    productId: 'newyear-report',
    invite: myCode,
    acknowledgedNotice: true,
    previewShown: true,
    birth: { date: '1990-01-01', time: '12:00', place: '서울', gender: '남' },
  });
  check('이메일이 없으면 증표 할인을 하지 않는다',
    noEmailOrder.status === 201 && noEmailOrder.body.order.amountKrw === normalPrice);

  // 13-B. 증표 수동 확인 API (POST /api/invite/check) 및 화면 입력칸 검증
  const validCheck = await api('POST', '/api/invite/check', { code: myCode });
  check('/api/invite/check: 올바른 증표는 200과 할인 정보 반환',
    validCheck.status === 200 && validCheck.body.ok === true && validCheck.body.discountKrw === INVITE_DISCOUNT_KRW && validCheck.body.minOrderKrw === INVITE_MIN_ORDER_KRW);

  const fakeCheck = await api('POST', '/api/invite/check', { code: 'nb000000' });
  check('/api/invite/check: 없는 증표는 「그런 증표가 없습니다」 반환',
    fakeCheck.status === 200 && fakeCheck.body.ok === false && fakeCheck.body.message === '그런 증표가 없습니다');

  const selfCheck = await api('POST', '/api/invite/check', { code: myCode, email: inviterEmail });
  check('/api/invite/check: 자기 증표는 「자신의 증표는 쓰실 수 없습니다」 반환',
    selfCheck.status === 200 && selfCheck.body.ok === false && selfCheck.body.message === '자신의 증표는 쓰실 수 없습니다');

  const homeRes = await page('/');
  check('명식 넣고 들어온 화면에 「벗의 증표가 있으십니까?」 작은 단추 존재',
    homeRes.html.includes('btnOpenStageInvite') && homeRes.html.includes('벗의 증표가 있으십니까?'));

  const checkoutRes = await page(`/checkout?product=saju-report`);
  check('결제 화면 금액 아래에 「증표 있으십니까?」 접힌 칸 존재',
    checkoutRes.html.includes('coInviteToggle') && checkoutRes.html.includes('증표 있으십니까?'));

  const checkoutUnder20Res = await page(`/checkout?product=wealth-report`);
  check('2만원 미만 결제 화면 금액 아래에 사전 안내 접힌 칸 존재',
    checkoutUnder20Res.html.includes('coInviteToggle') && checkoutUnder20Res.html.includes('증표는 2만원 이상 점사에서 쓰실 수 있습니다'));

  // 13-C. 증표 입력 제한 개선 검증 (6단계: 1분 잠금, 이메일 격리, 만료 후 리셋, 10분 후 리셋)
  const lockedEmail = 'locked_tester@example.com';
  const otherEmail = 'other_tester@example.com';
  await api('POST', '/api/invite/check', { code: 'nb000001', email: lockedEmail });
  await api('POST', '/api/invite/check', { code: 'nb000002', email: lockedEmail });
  const lockedRes = await api('POST', '/api/invite/check', { code: 'nb000003', email: lockedEmail });
  check('3회 틀린 이메일은 429로 잠긴다', lockedRes.status === 429 && lockedRes.body.message.includes('60초'));

  const otherRes = await api('POST', '/api/invite/check', { code: 'nb000001', email: otherEmail });
  check('이메일이 다르면 남의 실패로 잠기지 않는다', otherRes.status === 200 && otherRes.body.message === '그런 증표가 없습니다');

  const unlockEmail = 'unlock_tester@example.com';
  await api('POST', '/api/invite/check', { code: 'nb000001', email: unlockEmail });
  await api('POST', '/api/invite/check', { code: 'nb000002', email: unlockEmail });
  const rightRes = await api('POST', '/api/invite/check', { code: myCode, email: unlockEmail });
  check('맞히면 그 자리에서 성공하고 잠금 기록이 삭제된다', rightRes.status === 200 && rightRes.body.ok === true);
  check('맞힌 후 다시 틀려도 바로 잠기지 않는다', (await api('POST', '/api/invite/check', { code: 'nb000001', email: unlockEmail })).status === 200);

  // 시간 경과 시뮬레이션: 잠금 만료 후 카운트 0 리셋 & 10분 후 리셋
  const t0 = 1_000_000_000;
  recordInviteCheckFail('sim_user', t0);
  recordInviteCheckFail('sim_user', t0);
  const simLocked = recordInviteCheckFail('sim_user', t0);
  check('3회 실패 시 60초 잠금', simLocked.locked === true && simLocked.remainingSec === 60);

  const simCheckUnlocked = checkInviteRateLimit('sim_user', t0 + 61_000);
  check('60초 경과 후 잠금이 풀린다', simCheckUnlocked.allowed === true);

  const simFailAfterUnlock = recordInviteCheckFail('sim_user', t0 + 61_000);
  check('잠금 풀린 뒤 한 번 틀려도 안 잠긴다 (카운트 0 리셋 확인)', simFailAfterUnlock.locked === false);

  const t2 = 2_000_000_000;
  recordInviteCheckFail('sim_user2', t2);
  recordInviteCheckFail('sim_user2', t2);
  const sim10m = recordInviteCheckFail('sim_user2', t2 + 10 * 60 * 1000 + 1000);
  check('10분 지난 것은 잊고 다시 카운트 1부터 시작 (잠기지 않음)', sim10m.locked === false);
  check('10분 지난 후 카운트는 1이다', inviteCheckAttempts.get('sim_user2')?.count === 1);

  // 14. 월운세: 어느 달인지 명시되고 열흘 미만 시 다음 달 운세 제공
  const monthPreviewCheck = await api('POST', '/api/preview', {
    productId: 'month-report',
    birth: { date: '1990-01-01', time: '12:00', place: '서울', gender: '남' },
  });
  check('월운세 미리보기에 어느 달인지 안내된다',
    monthPreviewCheck.body.preview.contents.some((c: string) => c.includes('운세입니다')));
}

// ── J2. 소개 보답 「바로 쓰기」 무료 이용권 검증 ─────────────────────────
section('J2. 소개 보답 「바로 쓰기」 무료 이용권 검증');
{
  const { generateInviteCode } = await import('../../packages/commerce/src/index.ts');
  const birthSample = { date: '1990-01-01', time: '12:00', place: '서울', gender: '남' };

  // 1. 1명 보답을 쓰면 오늘의 운세가 0원이 된다
  const user1 = 'reward_tester_1@example.com';
  const code1 = generateInviteCode(user1);
  await api('POST', '/api/invite/status', { email: user1 });
  await referrals.recordInviteUse({
    id: 'use_t1',
    code: code1,
    invitedEmail: 'friend_t1@example.com',
    orderId: 'ord_t1',
    amountKrw: 24900,
  });
  const claim1 = await api('POST', '/api/invite/reward/claim', { email: user1, tier: 1 });
  check('1명 보답 claim 성공', claim1.status === 200 && claim1.body.ok === true && claim1.body.reward.status === '내줌');

  const orderDaily = await api('POST', '/api/orders', {
    productId: 'daily-report',
    email: user1,
    acknowledgedNotice: true,
    previewShown: true,
    birth: birthSample,
  });
  check('1명 보답을 쓰면 오늘의 운세가 0원이 된다',
    orderDaily.status === 201 && orderDaily.body.order.amountKrw === 0 && orderDaily.body.order.rewardUsed === '이용권으로 받음');

  // 2. 30일이 지난 이용권으로는 0원이 안 된다
  const userExp = 'reward_tester_expired@example.com';
  const past31Days = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000).toISOString();
  await referrals.applyReward(userExp, 1, '오늘의 운세 30일', '내줌', past31Days, null);

  const orderExpired = await api('POST', '/api/orders', {
    productId: 'daily-report',
    email: userExp,
    acknowledgedNotice: true,
    previewShown: true,
    birth: birthSample,
  });
  check('30일이 지난 이용권으로는 0원이 안 된다',
    orderExpired.status === 201 && orderExpired.body.order.amountKrw === 1900);

  // 3. 5명 보답으로 월운세를 받으면 0원이 되고, 같은 달 두 번째는 막힌다
  const user5 = 'reward_tester_5@example.com';
  const code5 = generateInviteCode(user5);
  await api('POST', '/api/invite/status', { email: user5 });
  for (let i = 1; i <= 5; i++) {
    await referrals.recordInviteUse({
      id: `use_t5_${i}`,
      code: code5,
      invitedEmail: `friend_t5_${i}@example.com`,
      orderId: `ord_t5_${i}`,
      amountKrw: 24900,
    });
  }
  const claim5 = await api('POST', '/api/invite/reward/claim', { email: user5, tier: 5 });
  check('5명 보답 claim 성공', claim5.status === 200 && claim5.body.ok === true && claim5.body.reward.status === '내줌');

  const orderMonth1 = await api('POST', '/api/orders', {
    productId: 'month-report',
    email: user5,
    acknowledgedNotice: true,
    previewShown: true,
    birth: birthSample,
  });
  check('5명 보답으로 월운세를 받으면 0원이 되고',
    orderMonth1.status === 201 && orderMonth1.body.order.amountKrw === 0 && orderMonth1.body.order.rewardUsed === '이용권으로 받음');

  // 같은 달 두 번째 시도
  const orderMonth2 = await api('POST', '/api/orders', {
    productId: 'month-report',
    email: user5,
    acknowledgedNotice: true,
    previewShown: true,
    birth: birthSample,
  });
  check('같은 달 두 번째는 막힌다',
    orderMonth2.status === 400 && String(orderMonth2.body.error).includes('이번 달 것은 이미 받으셨네'));

  // 4. 여섯 번을 다 쓰면 더 안 된다
  const userExhausted = 'reward_tester_exhausted@example.com';
  const rewEx = await referrals.applyReward(userExhausted, 5, '월운세 6달', '내줌', new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString(), 6);
  // 지난달 사용 기록으로 6번 소진
  for (let i = 0; i < 6; i++) {
    await referrals.recordRewardUse(rewEx.id, new Date(Date.now() - 40 * 24 * 60 * 60 * 1000));
  }
  const orderExhausted = await api('POST', '/api/orders', {
    productId: 'month-report',
    email: userExhausted,
    acknowledgedNotice: true,
    previewShown: true,
    birth: birthSample,
  });
  check('여섯 번을 다 쓰면 더 안 된다',
    orderExhausted.status === 201 && orderExhausted.body.order.amountKrw === 9900);

  // 5. 이용권이 없는 사람은 0원이 안 된다
  const userNoRew = 'user_no_rew@example.com';
  const orderNoRew = await api('POST', '/api/orders', {
    productId: 'daily-report',
    email: userNoRew,
    acknowledgedNotice: true,
    previewShown: true,
    birth: birthSample,
  });
  check('이용권이 없는 사람은 0원이 안 된다',
    orderNoRew.status === 201 && orderNoRew.body.order.amountKrw === 1900);

  // 6. 남의 이메일로는 남의 이용권을 못 쓴다
  const userOther = 'other_stranger@example.com';
  const orderOther = await api('POST', '/api/orders', {
    productId: 'daily-report',
    email: userOther,
    acknowledgedNotice: true,
    previewShown: true,
    birth: birthSample,
  });
  check('남의 이메일로는 남의 이용권을 못 쓴다',
    orderOther.status === 201 && orderOther.body.order.amountKrw === 1900);

  // 7. 0원 주문은 결제창을 띄우지 않는다
  // (1) 0원 주문 confirm 은 gateway 를 타지 않고 바로 200 성공 및 리포트가 생성된다
  const confirmRes = await api('POST', `/api/orders/${orderDaily.body.order.id}/confirm`, {
    paymentId: orderDaily.body.order.id,
  });
  const reportRes = await api('GET', `/api/orders/${orderDaily.body.order.id}/report`);
  // (2) checkout 소스에 0원 주문 분기 확인
  const checkoutHtml = renderCheckoutPage(business, '', CATALOG['daily-report'], { storeId: 'test_store', channelKey: 'test_channel' });
  const skipsPortOneForZero = checkoutHtml.includes('created.order.amountKrw === 0') &&
    checkoutHtml.includes("post('/api/orders/' + orderId + '/confirm'");
  check('0원 주문은 결제창을 띄우지 않는다',
    confirmRes.status === 200 && reportRes.status === 200 && skipsPortOneForZero);
}

// ── K. 모든 화면의 스크립트 문법 검사 ─────────────────────────────────
section('K. 모든 화면의 스크립트가 문법 오류 없이 통과한다');
{
  const vm = await import('node:vm');
  const testPaths = [
    '/',
    '/products',
    '/products/month-report',
    '/products/daily-report',
    '/checkout?product=saju-report',
    '/invite',
    '/pick',
    '/dream',
    `/order/${doubleId}`,
  ];

  /*
   * 터진 뒤에 적은 것 (2026-09-28): 갈래 단추 열한 개가 화면에도 app.js 에도
   * 손으로 적혀 있었다. 「시험과 취업」 갈래를 새로 만들자 그 갈래만 단추가
   * 없었고, 「전체」도 그 손으로 적은 목록을 돌기 때문에 급제신령 상품 넷은
   * 신령계 메뉴 어디에도 나오지 않았다. 손 목록은 반드시 어긋난다.
   */
  {
    const home = await page('/');
    const 빠진갈래 = CATEGORIES.filter((c) => !home.html.includes(`data-category="${c.key}"`));
    check(`갈래 단추가 ${CATEGORIES.length}개 갈래를 전부 덮는다`,
      빠진갈래.length === 0, 빠진갈래.map((c) => c.key).join(', '));
    const 빠진메뉴 = CATEGORIES.filter((c) => !home.html.includes(`"name":"${c.key}"`));
    check('신령계 메뉴 목록에도 갈래가 전부 들어간다',
      빠진메뉴.length === 0, 빠진메뉴.map((c) => c.key).join(', '));
    const 신령없음 = SPIRITS.filter((sp) => !home.html.includes(`"name":"${sp.name}"`));
    check(`신령 ${SPIRITS.length}분이 전부 메뉴에 선다`,
      신령없음.length === 0, 신령없음.map((sp) => sp.name).join(', '));

    /*
     * 터진 뒤에 적은 것 (2026-09-28): 맛보기 점사를 만들어 놓고 화면에는
     * 안 붙였다. 그 칸은 손님에게 안 보이는 `legacyStageWrapper` 안에만
     * 있었고, 보이는 화면은 카드를 누르면 곧장 상세페이지로 튕겨 보냈다.
     * 「1:1 대면 처소로 모십니다」라는 문구만 남아 거짓말이 되어 있었다.
     */
    const appJs = fs.readFileSync(new URL('./public/app.js', import.meta.url), 'utf8');
    check('상품 카드를 누르면 맛보기를 부른다', appJs.includes("'/api/taste'"));
    check('상품 카드가 곧장 상세페이지로 튕겨 보내지 않는다',
      !/closest\('\.product-card'\)[\s\S]{0,400}location\.href/.test(appJs));
    check('맛보기가 룰 엔진 계산을 근거로 함께 보여준다',
      appJs.includes('MS.freeReading') && appJs.includes('taste-tb'));
    check('없는 처소로 모신다고 말하지 않는다',
      !home.html.includes('1:1 대면 처소로 모십니다'));

    const style = fs.readFileSync(new URL('./public/style.css', import.meta.url), 'utf8');
    check('맛보기 칸에 생김새가 붙어 있다', style.includes('.taste-panel'));

    /*
     * 맛보기 펼침 칸에서 얼굴·손 사진을 받고 블라인드 사주를 보여준다
     */
    check('app.js 가 NB재기.얼굴 / NB재기.손 을 부른다',
      appJs.includes('NB재기.얼굴') && appJs.includes('NB재기.손'));
    check('첫 화면이 /engine.js 와 /jaegi.js 를 부른다',
      home.html.includes('/engine.js') && home.html.includes('/jaegi.js'));
    const 사진필요상품 = ['cross-report', 'face-palm-report', 'saju-face-report', 'saju-palm-report'];
    const 사진불필요상품 = Object.keys(CATALOG).filter((id) => !사진필요상품.includes(id));
    const 사진판별 = (id: string) => {
      const needsFace = (id === 'cross-report' || id === 'face-palm-report' || id === 'saju-face-report');
      const needsPalm = (id === 'cross-report' || id === 'face-palm-report' || id === 'saju-palm-report');
      return needsFace || needsPalm;
    };
    check('사진이 필요 없는 상품에는 사진 칸이 안 생긴다',
      사진불필요상품.length > 0 && 사진불필요상품.every((id) => !사진판별(id)) &&
      appJs.includes('if (needsPhoto)'));
    check('사진을 다 넣기 전에는 「신령께 보여 드리기」가 잠겨 있다',
      appJs.includes('reveal.disabled = check.missing.length > 0') &&
      appJs.includes("check.missing.push('얼굴 사진')") &&
      appJs.includes("check.missing.push('손바닥 사진')"));

    /*
     * 터진 뒤에 적은 것 (2026-09-29): 갈래 칸의 신령 카드가 140px 짜리 납작한
     * 띠였다. 신령 그림은 세로로 긴데 가로 한 줄만 보여 얼굴이 손톱만 했다.
     * 누가 봐 주는 것인지 알아볼 수 없으면 카드가 아니다.
     */
    const 카드규칙 = style.slice(style.indexOf('.product-card {'));
    const 최소높이 = /min-height:\s*(\d+)px/.exec(카드규칙.slice(0, 900));
    check('신령 카드가 얼굴이 보일 만큼 크다',
      !!최소높이 && Number(최소높이[1]) >= 200,
      최소높이 ? `${최소높이[1]}px` : '높이를 못 찾음');
  }

  /* 상품 서른네 개 전부에서 맛보기가 실제로 나와야 한다 */
  {
    const 맛보기실패: string[] = [];
    for (const id of Object.keys(CATALOG)) {
      const r = await api('POST', '/api/taste', {
        product: id,
        facts: { strong: true, topGod: '식상', lackElement: '금', timeKnown: true },
      });
      if (r.status !== 200) { 맛보기실패.push(`${id}(${r.status})`); continue; }
      const body = r.body as any;
      if (!body?.lines?.length || !body?.more) 맛보기실패.push(`${id}(빈 말)`);
    }
    check(`상품 ${Object.keys(CATALOG).length}개 전부 맛보기가 나온다`,
      맛보기실패.length === 0, 맛보기실패.join(', '));
  }

  /*
   * 결제 뒤 결과 카드가 **보이는지**.
   *
   * 터진 뒤에 적은 것 (2026-10-02): 결과·기다림 카드가 들어가는 #coDone 이
   * <form id="coForm"> 안에 있는데, 결제 뒤 그 form 을 숨겨서 카드까지
   * 사라졌다. 글자는 화면 안에 다 있었으니 글자만 세는 검사는 전부 통과했다.
   * 그래서 **틀 관계와 숨기는 대상**을 직접 본다.
   */
  {
    const co = renderCheckoutPage(business, '', CATALOG['charm-report'],
      { storeId: 'test_store', channelKey: 'test_channel' });
    const 입력칸시작 = co.indexOf('id="coFields"');
    const 입력칸끝 = co.indexOf('<p class="co-msg"', 입력칸시작);
    const 결과칸 = co.indexOf('id="coDone"');
    check('결과 카드(#coDone)가 입력칸(#coFields) 밖에 있다',
      입력칸시작 > 0 && 결과칸 > 0 && 결과칸 > 입력칸끝 && 입력칸끝 > 0,
      `입력칸 ${입력칸시작}~${입력칸끝}, 결과칸 ${결과칸}`);
    check('결제 뒤에 form 전체를 숨기지 않는다',
      !/\bf\.style\.display\s*=\s*'none'/.test(co),
      'f.style.display = \'none\' 이 남아 있다 — 결과 카드가 같이 사라진다');
    check('풀이가 막히면 화면이 그 말을 한다 (500 을 삼키지 않는다)',
      co.includes('coStuckCard') && /r\.status\s*>=\s*500/.test(co),
      '막힘 카드나 500 처리가 없다');
    check('파수꾼이 높이 0인 카드를 「보이는 것」으로 세지 않는다',
      co.includes('키있나'), '파수꾼이 카드 존재만 보고 잠든다');
  }

  /*
   * 화면에 적는 할인율이 **실제보다 크면 안 된다.**
   *
   * 터진 뒤에 적은 것 (2026-10-02): 배너에 「모든 점괘 25% 할인 중」이라고 손으로
   * 적어 두었는데 실제로는 24%인 상품이 다섯이었고(적은 것보다 덜 깎인다),
   * 명절 가족운세는 할인이 아예 없었다. 이어보기 뱃지의 「30%」도 실제는
   * 30~34%였다. 숫자를 손으로 적으면 반드시 실제와 어긋난다.
   */
  {
    const 최대 = maxLaunchDiscountPercent();
    const 실제들 = Object.values(CATALOG).map((p) => {
      const r = (p as any).regularKrw ?? p.priceKrw;
      return r > 0 ? Math.floor((1 - p.priceKrw / r) * 100) : 0;
    });
    check('배너 숫자가 실제 최대 할인율과 같다',
      최대 === Math.max(...실제들), `배너 ${최대}% vs 실제 최대 ${Math.max(...실제들)}%`);
    check('배너가 실제보다 큰 할인율을 적지 않는다',
      실제들.every((n) => n <= 최대), `${실제들.filter((n) => n > 최대).join(', ')}`);

    const home = await page('/');
    if (isLaunchSale()) {
      check('배너에 「모든 점괘」처럼 전부라고 적지 않는다',
        !home.html.includes('모든 점괘'),
        '할인이 없는 상품이 하나라도 있으면 「모든」은 거짓이다');
      check(`배너가 「최대 ${최대}%」로 적힌다`,
        home.html.includes(`최대 ${최대}% 할인 중`), '배너 문구가 값에서 오지 않는다');
    }

    const co = renderCheckoutPage(business, '', CATALOG['charm-report'],
      { storeId: 'test_store', channelKey: 'test_channel' });
    check('이어보기 뱃지 숫자를 손으로 적지 않는다',
      !/'[0-9]+%<br>할인'/.test(co),
      '뱃지에 숫자가 박혀 있다 — 실제 값과 어긋난다');
  }

  /*
   * 얼굴·손 리포트가 **아무 값을 받아도 죽지 않아야** 한다.
   *
   * 터진 뒤에 적은 것 (2026-10-02): 화면이 보내던 이름이 규칙에서 쓰는 이름과
   * 전혀 달라 「HAND_SHAPE_RULES[f.handShape] is not iterable」로 리포트가 통째로
   * 죽었다. 손님이 값을 치르고도 아무것도 못 받는 자리다.
   */
  {
    const { sanitizePalmFeatures, readPalm } = await import('../../packages/palmistry/src/index.ts');
    const { sanitizeFaceFeatures, readFace } = await import('../../packages/physiognomy/src/index.ts');
    const 험한값: unknown[] = [
      undefined, null, {}, 'zzz', 42, [],
      { headLine: 'mid', lifeLine: 'mid', heartLine: 'mid', fateLine: 'mid' }, // 옛 화면이 보내던 것
      { handShape: '불형' }, { handShape: null }, { lifeLength: 'zzz', simianLine: 'yes' },
    ];
    let 손금터짐 = '';
    let 관상터짐 = '';
    for (const v of 험한값) {
      try { readPalm(sanitizePalmFeatures(v)); } catch (e: any) { 손금터짐 = `${JSON.stringify(v)} → ${e.message}`; break; }
      try { readFace(sanitizeFaceFeatures(v)); } catch (e: any) { 관상터짐 = `${JSON.stringify(v)} → ${e.message}`; break; }
    }
    check('손금 규칙이 어떤 값을 받아도 죽지 않는다', 손금터짐 === '', 손금터짐);
    check('관상 규칙이 어떤 값을 받아도 죽지 않는다', 관상터짐 === '', 관상터짐);
    check('손 모양이 늘 다섯 가지 중 하나다',
      ['목형', '화형', '토형', '금형', '수형'].includes(sanitizePalmFeatures({ handShape: '불형' }).handShape));

    /*
     * 결제 화면은 얼굴·손 값을 **지어내지 않는다.**
     *
     * 터진 뒤에 적은 것 (2026-10-02): 결제 화면에 사진 올리는 칸이 있었는데
     * 받기만 하고 아무것도 재지 않았다. 값은 전부 「보통」으로 채워져서
     * 어떤 사진을 올려도 리포트가 똑같이 나왔다. 사진을 본다고 해 놓고
     * 안 보는 것은 손님을 속이는 것이다. 값은 첫 화면이 **실제로 잰 것만** 쓴다.
     */
    const co = renderCheckoutPage(business, '', CATALOG['cross-report'],
      { storeId: 'test_store', channelKey: 'test_channel' });
    check('결제 화면이 얼굴·손 값을 지어내지 않는다',
      !/foreheadWidth:\s*'mid'/.test(co) && !/lifeLength:\s*'mid'/.test(co)
      && !co.includes("forehead: 'mid'") && !co.includes("lifeLine: 'mid'"),
      '결제 화면이 재지도 않은 값을 채워 넣는다');
    check('결제 화면에 사진 올리는 칸이 없다',
      !co.includes('id="coFaceInput"') && !co.includes('id="coPalmInput"'),
      '재지 않으면서 사진을 받는 칸이 남아 있다');
    /*
     * 터진 뒤에 적은 것 (2026-10-03): /#panelF 로 보냈는데 문을 두드리기 전에는
     * 그 칸이 화면에 없어서 손님이 문 앞에 선 채로 멈췄다. 자리만 가리키지 말고
     * **무엇을 해야 하는지** 글로 말해야 한다.
     */
    check('결제 화면이 사진 이야기를 꺼내지 않는다',
      !/얼굴 사진|손 사진|손바닥 사진|재러 가기|보여 드리기/.test(co),
      '값을 치르기로 한 뒤에 사진을 요구하면 손님이 돌아선다');

    /*
     * 결제 화면으로 바로 들어와도 사진을 건너뛰지 못하게
     */
    const 사진필요상품 = ['cross-report', 'face-palm-report', 'saju-face-report', 'saju-palm-report'];
    for (const pId of 사진필요상품) {
      const coHtml = renderCheckoutPage(business, '', CATALOG[pId as keyof typeof CATALOG],
        { storeId: 'test_store', channelKey: 'test_channel' });
      check(`${pId}: 결제 화면 대본이 값이 없으면 상세페이지로 보낸다를 담고 있다`,
        coHtml.includes('/products/' + encodeURIComponent(pId)) &&
        coHtml.includes('location.replace') &&
        coHtml.includes('nb_reading') &&
        (coHtml.includes('보여줌') || coHtml.includes('face') || coHtml.includes('palm')),
        '사진 없는 손님이 결제 화면에 머무를 수 있다');
      check(`${pId}: 결제 화면에 사진 이야기가 여전히 한 글자도 없다`,
        !/얼굴 사진|손 사진|손바닥 사진|재러 가기|보여 드리기|보여 주십시오|보여주십시오/.test(coHtml),
        '결제 화면에 사진 관련 문구가 남아 있다');
    }

    for (const pId of 사진필요상품) {
      const noPhotoRes = await api('POST', '/api/orders', {
        productId: pId,
        birth: BIRTH,
        acknowledgedNotice: true,
        previewShown: true,
      });
      check(`${pId}: face/palm 없이 주문하면 400 이 나온다`,
        noPhotoRes.status === 400 && noPhotoRes.body.error === '이 상품에 필요한 얼굴·손 사진을 먼저 보여 주셔야 합니다.',
        `상태: ${noPhotoRes.status}, 메시지: ${noPhotoRes.body?.error}`);

      const withPhotoRes = await api('POST', '/api/orders', {
        productId: pId,
        birth: BIRTH,
        face: { foreheadWidth: 'wide' },
        palm: { lifeLength: 'long' },
        acknowledgedNotice: true,
        previewShown: true,
      });
      check(`${pId}: face/palm 이 있으면 주문이 201 로 만들어진다`,
        withPhotoRes.status === 201,
        `상태: ${withPhotoRes.status}, 에러: ${withPhotoRes.body?.error}`);
    }

    const charmNoPhoto = await api('POST', '/api/orders', {
      productId: 'charm-report',
      birth: BIRTH,
      acknowledgedNotice: true,
      previewShown: true,
    });
    check('사진이 필요 없는 상품(charm-report 등)은 아무 영향이 없다',
      charmNoPhoto.status === 201,
      `상태: ${charmNoPhoto.status}, 에러: ${charmNoPhoto.body?.error}`);

    const charmCo = renderCheckoutPage(business, '', CATALOG['charm-report'],
      { storeId: 'test_store', channelKey: 'test_channel' });
    check('charm-report 결제 화면은 상세페이지로 보내지 않는다',
      !charmCo.includes("location.replace('/products/charm-report") && !charmCo.includes('IS_PHOTO = true'));

    const viewer = fs.readFileSync(new URL('../../apps/manse-viewer/index.html', import.meta.url), 'utf8');
    check('첫 화면이 잰 값을 결제 화면에 넘긴다',
      viewer.includes('nb_reading') && viewer.includes('잰값을둔다'),
      '첫 화면이 잰 값을 저장하지 않는다 — 결제 화면이 못 가져간다');
    /*
     * 터진 뒤에 적은 것 (2026-10-03): 암호를 받는 자리가 결제 화면에만 있어서
     * 사장님이 저장해 둔 「/?pass=…」 주소가 아무 일도 하지 않았다.
     */
    /*
     * 신령 대화의 사진 칸이 **실제로 재는지.**
     *
     * 터진 뒤에 적은 것 (2026-10-03): 그 칸이 사진 이름만 적어 두고 아무것도
     * 재지 않았다. 맛보기가 누가 어떤 사진을 올려도 똑같이 나와서,
     * 손님은 「내 사진을 안 봤네」 하고 나간다.
     */
    const 신령대화 = fs.readFileSync(new URL('./public/app.js', import.meta.url), 'utf8');
    /*
     * 맛보기는 **맛만** 보여야 한다.
     *
     * 터진 뒤에 적은 것 (2026-10-03): 손님 것으로 지은 글을 통째로 보여 주고 있었다.
     * 다 보여 주면 더 궁금할 것이 없어 결제할 까닭이 사라진다.
     * 가리는 것은 진짜 그 손님의 글이어야 한다 — 흐릿한 가짜 글은 속이는 것이다.
     */
    /*
     * 터진 뒤에 적은 것 (2026-10-03): 관상용 얼굴 사진을 미리 찍어 둔 사람은 없다.
     * 앨범만 열리면 손님은 뒤로 나가 사진부터 찍고 다시 들어와야 한다 — 거기서 나간다.
     * 그리고 못 재면 잠금이 안 풀려 **앞으로 못 갔다.** 사장님이 직접 막히셨다.
     */
    const { renderProductPage: 상세장 } = await import('../../packages/site-policy/src/index.ts');
    const 상세대본 = 상세장(CATALOG['cross-report'], business, true, '');
    check('카드 펼침 칸에서 카메라가 바로 켜진다',
      신령대화.includes("'capture', 'user'") && 신령대화.includes("'capture', 'environment'"),
      '앨범만 열리면 손님이 뒤로 나간다');
    check('상세페이지에서도 카메라가 바로 켜진다',
      상세대본.includes('capture="user"') && 상세대본.includes('capture="environment"'),
      '앨범만 열리면 손님이 뒤로 나간다');
    check('어느 손을 올리는지 알려 준다',
      신령대화.includes('남좌여우') && 상세대본.includes('남좌여우'),
      '왼손인지 오른손인지 몰라 손님이 멈춘다');
    check('못 재어도 앞길을 막지 않는다',
      신령대화.includes('보여줬다') && 상세대본.includes('보여줬다'),
      '못 재면 손님이 갇혀서 못 산다');
    check('이미 보여 준 손님에게 두 번 묻지 않는다',
      상세대본.includes('다시 올리지 않으셔도 됩니다'), '같은 것을 두 번 올리게 하면 나간다');

    check('맛보기 글은 알맹이 낱말만 가린다',
      신령대화.includes('taste-mask-word') && 신령대화.includes('section.parts.forEach'),
      '문장 전체를 흐리면 읽을 수 없다');
    check('가린 자리가 있다고 말해 준다',
      신령대화.includes('🔒 리포트에서 풀어 드립니다'), '왜 끊겼는지 손님이 모른다');
    check('가짜 글을 깔지 않는다',
      !/lorem|▒▒▒▒▒▒/.test(신령대화), '지어낸 글을 흐리게 깔면 속이는 것이다');

    check('신령 대화의 사진 칸이 실제로 잰다',
      신령대화.includes('NB_얼굴잰다') && 신령대화.includes('NB_손잰다'),
      '사진을 받기만 하고 재지 않는다');
    check('재는 함수를 만세력 화면이 내놓는다',
      viewer.includes('window.NB_얼굴잰다') && viewer.includes('window.NB_손잰다'),
      '부를 함수가 없다');
    check('사진을 재고 나서 손님에게 결과를 알려 준다',
      신령대화.includes('consult-photo-msg'), '쟀는지 못 쟀는지 손님이 모른다');
    check('못 재어도 앞으로 못 가게 막지 않는다',
      /catch\(\(err\)|\.catch\(/.test(신령대화) && 신령대화.includes('그대로 두셔도 풀이는 나옵니다'),
      '사진을 못 재면 손님이 갇힌다');

    check('첫 화면도 주인 통과를 받는다',
      viewer.includes("[?&]pass=") && viewer.includes("'nb_pass'"),
      '첫 화면으로 들어오면 통과가 그냥 지나간다');
    check('받은 통과는 주소에서 지운다',
      viewer.includes('history.replaceState'), '암호가 주소창에 남는다');
    check('재러 온 손님을 그 자리로 데려다 준다',
      viewer.includes("h !== 'panelF' && h !== 'panelP'") && viewer.includes('scrollIntoView'),
      '주소에 자리를 적어 보내도 첫 화면만 보인다');
    check('첫 화면이 쓰는 이름이 규칙이 읽는 이름과 같다',
      viewer.includes('foreheadWidth') && viewer.includes('lifeLength') && viewer.includes('handShape'),
      '첫 화면이 다른 이름을 쓴다');
  }

  for (const p of testPaths) {
    const pageRes = await page(p);
    check(`${p} 화면 로드 성공`, pageRes.status === 200, `상태: ${pageRes.status}`);
    const scripts = [...pageRes.html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)];
    let scriptsOk = true;
    let errDetail = '';
    for (const m of scripts) {
      const code = m[1].trim();
      if (!code) continue;
      try {
        new vm.Script(code);
      } catch (e: any) {
        scriptsOk = false;
        errDetail = `${e.message} in script: ${code.slice(0, 100)}`;
        break;
      }
    }
    check(`${p} 의 모든 인라인 스크립트 문법 통과`, scriptsOk, errDetail);
  }

  // ── 6단계: 사주 정보 [고치기] 및 생년월일 검증 ─────────────
  {
    const { spawn } = await import('node:child_process');
    const path = await import('node:path');
    const os = await import('node:os');
    const candidates = [
      process.env.CHROME_BIN,
      'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
      '/usr/bin/google-chrome',
      '/usr/bin/chromium-browser',
      '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    ].filter(Boolean) as string[];
    const chromePath = candidates.find((c) => fs.existsSync(c));

    let openedOnEntry = false;
    let toggledOnEdit = false;
    let redirectedToDetail = false;
    let passCarriedOver = false;
    let staysOnCheckoutWithPhotos = false;
    let homeFreeVisible = false;
    let productsFreeVisible = false;
    let inviteDiscountOk = false;
    let under20kNoteOk = false;
    let hasPaymentKeys = false;
    let readySeen = false;

    let redirectDetailNote: string | undefined;
    let passCarriedNote: string | undefined;
    let staysOnCheckoutNote: string | undefined;
    let homeFreeNote: string | undefined;
    let productsFreeNote: string | undefined;
    let openedOnEntryNote: string | undefined;
    let toggledOnEditNote: string | undefined;
    let inviteDiscountNote: string | undefined;
    let under20kNoteNote: string | undefined;

    if (chromePath) {
      const coServer = createServer(async (req, res) => {
        const u = new URL(req.url || '/', 'http://127.0.0.1');
        if (u.pathname === '/checkout' || (u.pathname === '/' && u.searchParams.has('product'))) {
          const pId = u.searchParams.get('product') || 'daily-report';
          const p = CATALOG[pId as keyof typeof CATALOG] || CATALOG['daily-report'];
          const coHtml = renderCheckoutPage(business, '', p, { storeId: 'test_store', channelKey: 'test_channel' });
          res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
          res.end(coHtml);
          return;
        }
        try {
          const upstream = await fetch(`${base}${req.url}`);
          const headers: Record<string, string> = {};
          upstream.headers.forEach((v, k) => { headers[k] = v; });
          res.writeHead(upstream.status, headers);
          const buf = Buffer.from(await upstream.arrayBuffer());
          res.end(buf);
        } catch (e: any) {
          res.writeHead(500);
          res.end(e.message);
        }
      });
      await new Promise<void>((r) => coServer.listen(0, r));
      const coPort = (coServer.address() as any).port;

      const cPort = 9555 + Math.floor(Math.random() * 200);
      const tmpDir = path.join(os.tmpdir(), `chrome_v6_${Date.now()}`);
      const proc = spawn(chromePath, [
        '--headless',
        '--disable-gpu',
        // 관리자 권한으로 도는 자리(도커·CI)에서는 이게 없으면 크롬이 아예 안 뜬다
        '--no-sandbox',
        '--disable-dev-shm-usage',
        `--remote-debugging-port=${cPort}`,
        `--user-data-dir=${tmpDir}`,
        'about:blank',
      ]);
      try {
        let wsUrl = '';
        for (let i = 0; i < 30; i++) {
          try {
            const res = await fetch(`http://127.0.0.1:${cPort}/json/version`);
            if (res.ok) {
              const data = await res.json() as any;
              wsUrl = data.webSocketDebuggerUrl;
              break;
            }
          } catch {}
          await new Promise((r) => setTimeout(r, 150));
        }

        const ws = new WebSocket(wsUrl);
        await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
        let reqId = 1;
        const send = (method: string, params: any = {}) => {
          const id = ++reqId;
          ws.send(JSON.stringify({ id, method, params }));
          return new Promise<any>((resolve, reject) => {
            const handler = (event: any) => {
              const msg = JSON.parse(event.data);
              if (msg.id === id) {
                ws.removeEventListener('message', handler);
                if (msg.error) reject(msg.error);
                else resolve(msg.result);
              }
            };
            ws.addEventListener('message', handler);
          });
        };

        const target = await send('Target.createTarget', { url: 'about:blank' });
        const pageWs = new WebSocket(`ws://127.0.0.1:${cPort}/devtools/page/${target.targetId}`);
        await new Promise((r, j) => { pageWs.onopen = r; pageWs.onerror = j; });
        let pageReqId = 1;
        const pageSend = (method: string, params: any = {}) => {
          const id = ++pageReqId;
          pageWs.send(JSON.stringify({ id, method, params }));
          return new Promise<any>((resolve, reject) => {
            const handler = (event: any) => {
              const msg = JSON.parse(event.data);
              if (msg.id === id) {
                pageWs.removeEventListener('message', handler);
                if (msg.error) reject(msg.error);
                else resolve(msg.result);
              }
            };
            pageWs.addEventListener('message', handler);
          });
        };

        const pollUntil = async <T>(
          fn: () => Promise<T | null | undefined | false>,
          timeoutMs = 5000,
          intervalMs = 50,
        ): Promise<{ ok: boolean; value?: T; lastSeen?: any }> => {
          const start = Date.now();
          let lastSeen: any = undefined;
          while (Date.now() - start < timeoutMs) {
            try {
              const res = await fn();
              lastSeen = res;
              if (res) return { ok: true, value: res, lastSeen };
            } catch (err: any) {
              lastSeen = { error: err?.message || String(err) };
            }
            await new Promise((r) => setTimeout(r, intervalMs));
          }
          return { ok: false, lastSeen };
        };

        await pageSend('Page.enable');
        await pageSend('Page.navigate', { url: `http://127.0.0.1:${coPort}/checkout?product=daily-report` });

        const waitRes1 = await pollUntil(async () => {
          const evalRes = await pageSend('Runtime.evaluate', {
            expression: `(function(){
              var form = document.getElementById('coForm');
              var editForm = document.getElementById('coUserEditForm');
              var ready = document.querySelector('.co-soon');
              var isReady = Boolean(ready && ready.textContent.includes('결제 준비 중'));
              return {
                display: editForm ? getComputedStyle(editForm).display : 'none',
                hasForm: Boolean(form),
                isReady: isReady,
                readyText: ready ? ready.textContent.trim() : '',
              };
            })()`,
            returnByValue: true,
          });
          const val = evalRes.result?.value;
          if (val?.display === 'block' || val?.isReady) return val;
          return null;
        }, 5000, 50);
        hasPaymentKeys = Boolean(waitRes1.value?.hasForm);
        readySeen = Boolean(waitRes1.value?.isReady);
        openedOnEntry = hasPaymentKeys && waitRes1.value?.display === 'block';
        openedOnEntryNote = openedOnEntry ? undefined : `마지막 화면 상태: ${JSON.stringify(waitRes1.lastSeen)}`;

        const waitRes2 = await pollUntil(async () => {
          const evalRes = await pageSend('Runtime.evaluate', {
            expression: `(function(){
              var editBtn = document.getElementById('coEditUserBtn');
              var editForm = document.getElementById('coUserEditForm');
              if(!editBtn || !editForm) return null;
              editBtn.click();
              var afterFirst = getComputedStyle(editForm).display;
              editBtn.click();
              var afterSecond = getComputedStyle(editForm).display;
              return { afterFirst: afterFirst, afterSecond: afterSecond };
            })()`,
            returnByValue: true,
          });
          const val = evalRes.result?.value;
          if (val && val.afterFirst === 'none' && val.afterSecond === 'block') return val;
          return null;
        }, 5000, 50);
        toggledOnEdit = Boolean(waitRes2.ok);
        toggledOnEditNote = toggledOnEdit ? undefined : `마지막 상태: ${JSON.stringify(waitRes2.lastSeen)}`;

        // 7단계: 사진이 필요한 상품에서 사진 없이 들어가면 상세페이지로 넘어가고 pass 보존 확인
        await pageSend('Page.navigate', { url: `http://127.0.0.1:${coPort}/checkout?product=cross-report&pass=secret-pass-123` });
        const waitRes3 = await pollUntil(async () => {
          const evalRes = await pageSend('Runtime.evaluate', {
            expression: `(function(){
              return {
                pathname: location.pathname,
                search: location.search,
                href: location.href,
              };
            })()`,
            returnByValue: true,
          });
          const val = evalRes.result?.value;
          if (val?.pathname === '/products/cross-report') return val;
          return null;
        }, 5000, 50);
        redirectedToDetail = Boolean(waitRes3.ok);
        passCarriedOver = Boolean(waitRes3.value?.search?.includes('pass=secret-pass-123'));
        redirectDetailNote = redirectedToDetail ? undefined : `마지막 위치: ${JSON.stringify(waitRes3.lastSeen)}`;
        passCarriedNote = passCarriedOver ? undefined : `마지막 쿼리: ${JSON.stringify(waitRes3.lastSeen)}`;

        // 사진 2장이 있으면 결제 화면이 제대로 뜨는지 확인
        await pageSend('Runtime.evaluate', {
          expression: `(function(){
            sessionStorage.setItem('nb_reading', JSON.stringify({ face: { foreheadWidth: 'wide' }, palm: { lifeLength: 'long' } }));
          })()`,
        });
        await pageSend('Page.navigate', { url: `http://127.0.0.1:${coPort}/checkout?product=cross-report` });
        const waitStay = await pollUntil(async () => {
          const evalRes = await pageSend('Runtime.evaluate', {
            expression: `(function(){
              var form = document.getElementById('coForm');
              var ready = document.querySelector('.co-soon');
              return {
                pathname: location.pathname,
                hasForm: Boolean(form),
                isReady: Boolean(ready && ready.textContent.includes('결제 준비 중')),
              };
            })()`,
            returnByValue: true,
          });
          const val = evalRes.result?.value;
          if (val?.pathname === '/checkout' && (val?.hasForm || val?.isReady)) return val;
          return null;
        }, 5000, 50);
        staysOnCheckoutWithPhotos = hasPaymentKeys
          ? Boolean(waitStay.value?.pathname === '/checkout' && waitStay.value?.hasForm)
          : Boolean(waitStay.value?.pathname === '/checkout' && waitStay.value?.isReady);
        staysOnCheckoutNote = staysOnCheckoutWithPhotos
          ? undefined
          : (hasPaymentKeys ? `coForm 없음: ${JSON.stringify(waitStay.lastSeen)}` : `결제 준비 중 없음: ${JSON.stringify(waitStay.lastSeen)}`);

        // 1단계: 실제 브라우저로 홈의 「무료 · 내 사주 여덟 글자」를 눌러서 무료 사주 입력칸이 보이는지 확인
        await pageSend('Page.navigate', { url: `${base}/` });
        await pollUntil(async () => {
          const evalRes = await pageSend('Runtime.evaluate', {
            expression: `document.readyState === 'complete' && Boolean(document.getElementById('btnFreeEightLetters'))`,
            returnByValue: true,
          });
          return evalRes.result?.value ? true : null;
        }, 5000, 50);

        let lastHomeFree: any = null;
        const waitHomeFree = await pollUntil(async () => {
          const evalRes = await pageSend('Runtime.evaluate', {
            expression: `(function(){
              var panelA = document.getElementById('panelA');
              var leg = document.getElementById('manseStage');
              if(!panelA || !leg) {
                var btn = document.getElementById('btnFreeEightLetters');
                if (btn) btn.click();
                panelA = document.getElementById('panelA');
                leg = document.getElementById('manseStage');
              }
              if(!panelA || !leg) return { found: false, error: 'panelA/legacy 없음', panelA: Boolean(panelA), leg: Boolean(leg) };
              var pDisp = getComputedStyle(panelA).display;
              var lDisp = getComputedStyle(leg).display;
              var isVis = pDisp !== 'none' && lDisp !== 'none';
              if (!isVis) {
                var btn = document.getElementById('btnFreeEightLetters');
                if (btn) btn.click();
                pDisp = getComputedStyle(panelA).display;
                lDisp = getComputedStyle(leg).display;
                isVis = pDisp !== 'none' && lDisp !== 'none';
              }
              return { found: true, visible: isVis, panelADisplay: pDisp, legDisplay: lDisp };
            })()`,
            returnByValue: true,
          });
          const val = evalRes.result?.value;
          lastHomeFree = val;
          if (val?.visible) return val;
          return null;
        }, 5000, 50);
        homeFreeVisible = Boolean(waitHomeFree.ok);
        homeFreeNote = homeFreeVisible ? undefined : `마지막 판정: ${JSON.stringify(lastHomeFree)}`;

        // /products 에서 누른 경우도 똑같이 확인
        await pageSend('Page.navigate', { url: `${base}/products` });
        await pollUntil(async () => {
          const evalRes = await pageSend('Runtime.evaluate', {
            expression: `document.readyState === 'complete' && Boolean(document.getElementById('btnFreeEightLetters'))`,
            returnByValue: true,
          });
          return evalRes.result?.value ? true : null;
        }, 5000, 50);

        let lastProductsFree: any = null;
        const waitProductsFree = await pollUntil(async () => {
          const evalRes = await pageSend('Runtime.evaluate', {
            expression: `(function(){
              var panelA = document.getElementById('panelA');
              var leg = document.getElementById('manseStage');
              if(!panelA || !leg) {
                var btn = document.getElementById('btnFreeEightLetters');
                if(btn && location.pathname === '/products') location.href = btn.href;
                panelA = document.getElementById('panelA');
                leg = document.getElementById('manseStage');
              }
              if(!panelA || !leg) return { found: false, error: 'panelA/legacy 없음', loc: location.href };
              var pDisp = getComputedStyle(panelA).display;
              var lDisp = getComputedStyle(leg).display;
              var isVis = pDisp !== 'none' && lDisp !== 'none';
              var urlClean = !location.search.includes('free=1');
              return { found: true, visible: isVis, urlClean: urlClean, panelADisplay: pDisp, legDisplay: lDisp, loc: location.href };
            })()`,
            returnByValue: true,
          });
          const val = evalRes.result?.value;
          lastProductsFree = val;
          if (val?.visible && val?.urlClean) return val;
          return null;
        }, 5000, 50);
        productsFreeVisible = Boolean(waitProductsFree.ok);
        productsFreeNote = productsFreeVisible ? undefined : `마지막 판정: ${JSON.stringify(lastProductsFree)}`;

        // 소개 검증: 실제 브라우저로 /?invite=<코드> 로 들어가 상품을 고르고 결제 화면까지 가서 값이 깎였는지 본다
        await pageSend('Page.navigate', { url: `http://127.0.0.1:${coPort}/?invite=friendtest12` });
        await pollUntil(async () => {
          const evalRes = await pageSend('Runtime.evaluate', {
            expression: `document.readyState === 'complete'`,
            returnByValue: true,
          });
          return evalRes.result?.value ? true : null;
        }, 5000, 50);

        // 1) 2만원 이상 상품 선택하여 결제 화면으로 이동 (saju-report: 34,900원 -> 31,900원)
        await pageSend('Page.navigate', { url: `http://127.0.0.1:${coPort}/checkout?product=saju-report` });
        const waitInvite = await pollUntil(async () => {
          const evalRes = await pageSend('Runtime.evaluate', {
            expression: `(function(){
              var tag = document.querySelector('.co-price b');
              var note = document.getElementById('coInviteNote');
              var pay = document.getElementById('coPay');
              var ready = document.querySelector('.co-soon');
              var text = ((tag && tag.textContent) || '') + ' ' + ((note && note.textContent) || '') + ' ' + ((pay && pay.textContent) || '');
              var hasMinus = text.includes('3,000') || text.includes('−3,000') || text.includes('-3,000');
              var hasBadge = text.includes('벗의 증표');
              var isDiscounted = text.includes('31,900');
              return {
                ok: hasBadge && hasMinus && isDiscounted,
                text: text,
                isReady: Boolean(ready),
                session: sessionStorage.getItem('nb_invite')
              };
            })()`,
            returnByValue: true,
          });
          const val = evalRes.result?.value;
          if (val?.ok || val?.isReady) return val;
          return null;
        }, 5000, 50);
        inviteDiscountOk = Boolean(waitInvite.value?.ok);
        inviteDiscountNote = inviteDiscountOk ? undefined : `마지막 상태: ${JSON.stringify(waitInvite.lastSeen)}`;

        // 2) 2만원 아래 상품(daily-report, 9,900원)
        await pageSend('Page.navigate', { url: `http://127.0.0.1:${coPort}/checkout?product=daily-report` });
        const waitUnder20k = await pollUntil(async () => {
          const evalRes = await pageSend('Runtime.evaluate', {
            expression: `(function(){
              var note = document.getElementById('coInviteNote');
              var ready = document.querySelector('.co-soon');
              var text = (note && note.textContent) || '';
              return {
                ok: text.includes('이 증표는 2만원 이상 점사에 쓰실 수 있습니다'),
                text: text,
                isReady: Boolean(ready),
              };
            })()`,
            returnByValue: true,
          });
          const val = evalRes.result?.value;
          if (val?.ok || val?.isReady) return val;
          return null;
        }, 5000, 50);
        under20kNoteOk = Boolean(waitUnder20k.value?.ok);
        under20kNoteNote = under20kNoteOk ? undefined : `마지막 상태: ${JSON.stringify(waitUnder20k.lastSeen)}`;

        pageWs.close();
        ws.close();
      } catch (e: any) {
        console.error('브라우저 검증 오류:', e.message);
      } finally {
        coServer.close();
        proc.kill();
        try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch {}
      }
    } else {
      const coDaily = renderCheckoutPage(business, '', CATALOG['daily-report'], { storeId: 't', channelKey: 't' });
      openedOnEntry = coDaily.includes('if(editForm && !date){') && coDaily.includes("editForm.style.display = 'block';");
      toggledOnEdit = coDaily.includes("getComputedStyle(editForm).display !== 'none'") && coDaily.includes('scrollIntoView');
      const crossHtml = renderCheckoutPage(business, '', CATALOG['cross-report'], { storeId: 't', channelKey: 't' });
      redirectedToDetail = crossHtml.includes('/products/cross-report') && crossHtml.includes('location.replace');
      passCarriedOver = crossHtml.includes('location.search');
      staysOnCheckoutWithPhotos = crossHtml.includes('coForm');
      homeFreeVisible = home.html.includes('btnFreeEightLetters') && home.html.includes('openFreeSaju');
      productsFreeVisible = (await page('/products')).html.includes('href="/?free=1"');

      const appJs = fs.readFileSync(new URL('./public/app.js', import.meta.url), 'utf8');
      const coPageSrc = fs.readFileSync(new URL('../../packages/site-policy/src/checkout-page.ts', import.meta.url), 'utf8');
      inviteDiscountOk = appJs.includes("sessionStorage.setItem('nb_invite'")
        && coPageSrc.includes("sessionStorage.getItem('nb_invite')")
        && coPageSrc.includes('discount = 3000')
        && coPageSrc.includes('벗의 증표 −3,000원');
      under20kNoteOk = coPageSrc.includes('이 증표는 2만원 이상 점사에 쓰실 수 있습니다');
    }

    const inviteWayHome = (home.html.match(/href="\/invite"/g) ?? []).length;
    const { renderInviteBadge: rBadge } = await import('../../packages/site-policy/src/referral-badge.ts');
    const inviteWayBadge = rBadge('TEST1234').includes('href="/invite"');
    const invitePathsCount = inviteWayHome + (inviteWayBadge ? 1 : 0);
    const hasMultipleInvitePaths = invitePathsCount >= 2;

    if (hasPaymentKeys) {
      check('생년월일 없이 결제 화면에 들어오면 입력칸이 펼쳐져 있다', openedOnEntry, openedOnEntryNote);
      check('[고치기]를 누르면 입력칸이 열린다', toggledOnEdit, toggledOnEditNote);
      check('사진 없이 들어가면 상세페이지로 리다이렉트된다', redirectedToDetail, redirectDetailNote);
      check('상세페이지로 갈 때 pass 가 보존된다', passCarriedOver, passCarriedNote);
      check('사진이 있으면 결제 화면이 정상적으로 뜬다', staysOnCheckoutWithPhotos, staysOnCheckoutNote);
    } else {
      check('생년월일 없이 결제 화면에 들어오면 입력칸이 펼쳐져 있다', null, '결제 열쇠 없음 — coForm 미생성으로 건너뜀');
      check('[고치기]를 누르면 입력칸이 열린다', null, '결제 열쇠 없음 — coForm 미생성으로 건너뜀');
      check('사진 없이 들어가면 상세페이지로 리다이렉트된다', redirectedToDetail, redirectDetailNote);
      check('상세페이지로 갈 때 pass 가 보존된다', passCarriedOver, passCarriedNote);
      check('사진이 있으면 결제 화면이 정상적으로 뜬다', readySeen, readySeen ? '결제 열쇠 없는 서버: 결제 준비 중 확인' : '결제 준비 중 표시 없음');
    }
    /*
     * 터진 뒤에 적은 것 (2026-10-03): 사진을 결제 화면에서 받고 있었다.
     * 값을 치르기로 마음먹은 뒤에야 요구하니 거기서 돌아선다.
     * 사진은 **상품 상세페이지**에서 받고, 받은 값으로 미리보기를 바꾼다.
     */
    /*
     * 생년월일을 **손으로 적을 수 있어야** 한다.
     *
     * 터진 뒤에 적은 것 (2026-10-03): 달력에서 고르는 것뿐이라, 폰에서 1988년을
     * 찾으려면 달을 수십 번 넘겨야 했다. 사장님이 직접 겪고 두 번 말씀하셨다.
     */
    const 날짜대본 = fs.readFileSync(new URL('./public/nalja.js', import.meta.url), 'utf8');
    check('날짜를 손으로 적는 장치가 있다',
      날짜대본.includes('inputMode') && 날짜대본.includes('input[type="date"]'),
      '달력에서만 고르게 두면 폰에서 한참 걸린다');
    check('적은 값이 YYYY-MM-DD 모양으로 담긴다', 날짜대본.includes('모양을잡는다'));
    check('달력으로 고르는 길도 남겨 둔다', 날짜대본.includes('달력에서 고르기'));
    const 결제화면 = renderCheckoutPage(business, '', CATALOG['saju-report'],
      { storeId: 'test_store', channelKey: 'test_channel' });
    check('첫 화면이 날짜 적는 장치를 부른다', home.html.includes('/nalja.js'), '그 화면에서는 달력만 뜬다');
    check('결제 화면이 날짜 적는 장치를 부른다', 결제화면.includes('/nalja.js'), '그 화면에서는 달력만 뜬다');

    const { renderProductPage: 상세 } = await import('../../packages/site-policy/src/index.ts');
    check('사진이 필요한 상품은 상세페이지에서 사진을 받는다',
      ['cross-report', 'face-palm-report', 'saju-face-report', 'saju-palm-report'].every((id) => {
        const h = 상세(CATALOG[id as keyof typeof CATALOG], business, true, '');
        return h.includes('id="pdJaegi"') && h.includes('/jaegi.js') && h.includes('/engine.js');
      }), '상세페이지에 사진 받는 칸이 없다');
    /*
     * 사진 칸이 **결제 단추보다 먼저** 보여야 한다.
     *
     * 터진 뒤에 적은 것 (2026-10-03): 사진 칸은 화면 3,000픽셀 아래에 있었는데
     * 결제 단추는 화면 아래에 늘 붙어 다녔다. 사장님이 사진 칸을 보지도 못하고
     * 결제로 가셨다. 칸을 위로 올리고, 보여 주시기 전에는 단추를 잠근다.
     */
    for (const id of ['cross-report', 'face-palm-report', 'saju-face-report', 'saju-palm-report']) {
      const h = 상세(CATALOG[id as keyof typeof CATALOG], business, true, '');
      const 칸 = h.indexOf('id="pdJaegi"');
      const 살자리 = h.indexOf('class="pd-buy"');
      check(`${id}: 사진 칸이 사는 자리보다 먼저 나온다`, 칸 > 0 && 살자리 > 0 && 칸 < 살자리,
        `사진 칸 ${칸}, 사는 자리 ${살자리}`);
      check(`${id}: 보여 주시기 전에는 결제 단추가 잠겨 있다`,
        h.includes('pd-go-locked') && h.includes('먼저 보여 주십시오'),
        '사진을 못 보고 결제로 갈 수 있다');
      check(`${id}: 늘 붙어 다니는 단추도 잠근다`,
        h.includes('id="pdStickyGo"'), '아래 단추로 빠져나갈 수 있다');
    }

    check('사진이 필요 없는 상품에는 그 칸이 없다',
      !상세(CATALOG['charm-report'], business, true, '').includes('id="pdJaegi"'));
    check('사진을 보여 주면 미리보기를 손님 것으로 바꾼다',
      상세(CATALOG['cross-report'], business, true, '').includes('/api/preview'),
      '사진을 받고도 미리보기가 그대로면 보여 준 보람이 없다');
    check('실제 브라우저로 홈의 「무료 · 내 사주 여덟 글자」를 눌러서 무료 사주 입력칸이 화면에 보인다', homeFreeVisible, homeFreeNote);
    check('/products 에서 누른 경우도 똑같이 확인된다', productsFreeVisible, productsFreeNote);

    /*
     * 터진 뒤에 적은 것 (2026-10-01): 소개 링크는 홈을 가리키는데 코드를
     * 받는 곳은 결제 화면뿐이었다. 할인이 한 번도 걸린 적이 없다.
     * 만들어 두고 이어 보지 않았다.
     */
    if (hasPaymentKeys) {
      check('홈에 소개 코드를 담고 들어가면 결제 화면에서 3,000원이 깎인다', inviteDiscountOk, inviteDiscountNote);
      check('소개 현황 화면으로 가는 길이 두 군데 이상 있다', hasMultipleInvitePaths);
      check('2만원 아래 상품에서는 못 쓴다고 솔직히 적는다', under20kNoteOk, under20kNoteNote);
    } else {
      check('소개 현황 화면으로 가는 길이 두 군데 이상 있다', hasMultipleInvitePaths);
      check('2만원 아래 상품에서는 못 쓴다고 솔직히 적는다', null, '결제 열쇠 없음 — coForm 미생성으로 건너뜀');
    }

    const badgeHtml = rBadge('testcode');
    check('증표 카드에 깎이는 금액과 받는 보답(오늘의 운세 30일)이 둘 다 명시된다',
      badgeHtml.includes(`${INVITE_DISCOUNT_KRW.toLocaleString('ko-KR')}원`) &&
      badgeHtml.includes('오늘의 운세 30일'));

    const { REFERRAL_BADGE_SCRIPT: rScript } = await import('../../packages/site-policy/src/referral-badge.ts');
    check('카카오 SDK 연동 스크립트 및 피드 공유 로직이 포함된다',
      rScript.includes('window.Kakao') && rScript.includes("objectType: 'feed'"));

    const { renderInvitePage: rInvPage } = await import('../../packages/site-policy/src/invite-page.ts');
    const inviteHtml = rInvPage(business, '');
    check('소개 현황 화면에 깎이는 금액과 받는 보답이 둘 다 명시된다',
      inviteHtml.includes(`${INVITE_DISCOUNT_KRW.toLocaleString('ko-KR')}원`) &&
      inviteHtml.includes('오늘의 운세 30일'));

    const appJsContent = fs.readFileSync(new URL('./public/app.js', import.meta.url), 'utf8');
    check('첫 화면에 시각 직접 입력칸과 시간을 모릅니다 단추가 있다',
      home.html.includes('id="stTimeInput"') && home.html.includes('id="stBtnUnknown"'));
    check('app.js 에 배경음악(/audio/bgm) 및 신령음 제어가 연결되어 있다',
      appJsContent.includes('/audio/bgm') && appJsContent.includes('setSound'));

    /*
     * 상품 설명에 약속을 적으면, 그 약속을 받는 칸이 화면에 있어야 한다.
     * 없으면 거짓 광고다. 검증이 본다. (터진 뒤에 적은 것, 2026-10-04)
     */
    const PROMISE_RULES = [
      {
        keyword: '넣고 싶은 글자',
        test: (desc: string) => desc.includes('넣고 싶은 글자'),
        fieldCheck: (html: string) => html.includes('id="fixedChar"') || html.includes('name="fixedChar"'),
        fieldDescription: '돌림자/넣고 싶은 글자 입력칸(fixedChar)',
      },
      {
        keyword: '돌림자',
        test: (desc: string) => desc.includes('돌림자'),
        fieldCheck: (html: string) => html.includes('id="fixedChar"') || html.includes('name="fixedChar"'),
        fieldDescription: '돌림자 입력칸(fixedChar)',
      },
      {
        keyword: '피할',
        test: (desc: string) => desc.includes('피할'),
        fieldCheck: (html: string) => html.includes('avoidChars') || html.includes('rangeAvoid'),
        fieldDescription: '피할 글자(avoidChars) 또는 피할 날(rangeAvoid) 입력칸',
      },
      {
        keyword: '상대',
        test: (desc: string) => desc.includes('상대'),
        fieldCheck: (html: string) => html.includes('partnerDate') || html.includes('partnerTime'),
        fieldDescription: '상대 정보 입력칸(partnerDate/partnerTime)',
      },
      {
        keyword: '기간',
        test: (desc: string) => desc.includes('기간'),
        fieldCheck: (html: string) => html.includes('rangeFrom') && html.includes('rangeTo'),
        fieldDescription: '기간 선택칸(rangeFrom/rangeTo)',
      },
      {
        keyword: '사진',
        test: (desc: string) => desc.includes('사진'),
        fieldCheck: (html: string, p: any) => p.needsFace || p.needsPalm || html.includes('isPhotoProduct'),
        fieldDescription: '사진 확인/입력 흐름',
      },
      {
        keyword: '얼굴',
        test: (desc: string) => desc.includes('얼굴'),
        fieldCheck: (html: string, p: any) => p.needsFace || html.includes('needsFace') || html.includes('hasFace'),
        fieldDescription: '얼굴 사진 확인/입력 흐름',
      },
      {
        keyword: '손',
        test: (desc: string) => desc.includes('손금') || desc.includes('손만으로') || (desc.includes('손') && !desc.includes('손을 내미')),
        fieldCheck: (html: string, p: any) => p.needsPalm || html.includes('needsPalm') || html.includes('hasPalm'),
        fieldDescription: '손/손금 사진 확인/입력 흐름',
      },
      {
        keyword: '가족',
        test: (desc: string) => desc.includes('가족'),
        fieldCheck: (html: string) => html.includes('addKin') || html.includes('kinDate') || html.includes('NEEDS_FAMILY'),
        fieldDescription: '가족/구성원 추가 입력칸',
      },
      {
        keyword: '성(姓)',
        test: (desc: string) => desc.includes('성(姓)') || desc.includes('아이의 성') || desc.includes('성씨'),
        fieldCheck: (html: string) => html.includes('id="surname"') || html.includes('name="surname"'),
        fieldDescription: '성(surname) 입력칸',
      },
    ];

    for (const [id, p] of Object.entries(CATALOG)) {
      const coHtml = renderCheckoutPage(business, '', p, { storeId: 'test_store', channelKey: 'test_channel' });
      const textToCheck = `${p.name} ${p.description || ''} ${p.hook || ''}`;
      for (const rule of PROMISE_RULES) {
        if (rule.test(textToCheck)) {
          const ok = rule.fieldCheck(coHtml, p);
          check(
            `${id}: 설명/문구 약속 [${rule.keyword}]이 결제 화면에 실려 있다`,
            ok,
            ok ? `필드 확인` : `설명/문구에 [${rule.keyword}] 약속이 있으나 화면에 [${rule.fieldDescription}] 없음`
          );
        }
      }
    }
  }

  section('소개 보답 — 오늘의 운세 30일 소개당 지급');
  {
    const testEmail = 'two_refs@example.kr';
    await referrals.createInvite('nb_two_refs', testEmail);
    await referrals.recordInviteUse({
      id: 'use_t1',
      code: 'nb_two_refs',
      invitedEmail: 'friend1@example.kr',
      orderId: 'ord_f1',
      amountKrw: 24900,
    });
    await referrals.recordInviteUse({
      id: 'use_t2',
      code: 'nb_two_refs',
      invitedEmail: 'friend2@example.kr',
      orderId: 'ord_f2',
      amountKrw: 24900,
    });

    const c1 = await api('POST', '/api/invite/reward/claim', { email: testEmail, tier: 1 });
    const c2 = await api('POST', '/api/invite/reward/claim', { email: testEmail, tier: 1 });
    const c3 = await api('POST', '/api/invite/reward/claim', { email: testEmail, tier: 1 });

    check('소개 2명인 사람이 30일 받기를 두 번 성공, 세 번째는 400',
      c1.status === 200 && c2.status === 200 && c3.status === 400);

    const expMs = new Date(c2.body.reward.expiresAt).getTime();
    const days = Math.round((expMs - Date.now()) / (24 * 60 * 60 * 1000));
    check('그 사람 만료일이 60일 뒤', c2.body.reward.grantCount === 2 && days >= 59 && days <= 61, `${days}일 뒤`);
  }

  // 아이 상품 생년월일 필수 검증 (1단계)
  {
    /*
 * 터진 뒤에 적은 것 (2026-10-05): 여기에 상품을 손으로 넷 적어 두었더니,
 * 다섯째(진학운)가 붙었을 때 검사가 그것을 보지 않았다. 상품표에서 읽는다.
 */
const childProductIds = Object.values(CATALOG).filter((p) => p.needsChild).map((p) => p.id);
check('아이를 약속한 상품은 모두 아이 칸을 받는다', childProductIds.length >= 5,
  `아이 칸이 붙은 상품 ${childProductIds.length}개`);
/*
 * 아이를 약속했는데 받는 칸이 없으면 부모 사주로 아이를 적는다.
 * 다만 부모·자식 궁합은 아이를 **상대 칸**으로 받고, 제왕절개 택일은
 * 아이가 아직 안 태어나 생년월일이 없다 — 이 둘은 빼고 본다.
 */
{
  const 칸없이약속한것 = Object.values(CATALOG).filter((p) => !p.isPackage
    && /이 아이|아이의|우리 아이|아이가/.test(`${p.description} ${p.hook}`)
    && !p.needsChild && !p.needsPartner && !p.needsPick);
  check('설명에 「아이」가 든 상품에 아이 칸이 빠지지 않았다',
    칸없이약속한것.length === 0, 칸없이약속한것.map((p) => p.id).join(', ') || '전부 붙음');
}
    const parentBirth = { date: '1988-05-14', time: '14:40', gender: '남' as const, name: '이부모' };
    for (const pId of childProductIds) {
      const badOrder = await api('POST', '/api/orders', {
        reading: {
          productId: pId,
          birth: parentBirth,
          name: { surname: '이' },
        },
        buyerEmail: 'parent@example.com',
        buyerPhone: '01012345678',
      });
      check(`${pId} 아이 생년월일 없이 주문하면 400 반환`, badOrder.status === 400, `응답: ${badOrder.status}`);
    }
  }
}

server.close();
console.log(`\n${'═'.repeat(60)}`);
// ─── 작명 ─────────────────────────────────────────────────────
{
  const { buildPayload, kindOf } = await import('./src/payload.ts');
  const { buildPreview } = await import('./src/preview.ts');

  check('작명 상품은 작명 갈래로 나간다',
    kindOf('naming-report') === '작명' && kindOf('naming-plus-report') === '작명');
  check('다른 상품까지 작명으로 새지 않는다',
    kindOf('saju-report') === '사주' && kindOf('pick-report') === '택일');

  const birth = { date: '2026-03-14', time: '09:30', gender: '남' as const };
  const built = buildPayload({ productId: 'naming-report', birth, child: birth, name: { surname: '김' } });
  const d = built.data as any;

  check('아이의 사주를 함께 싣는다', !!d.아이사주?.명식?.연주);
  /*
   * 용신은 「식상이 필요하다」처럼 십신으로 나온다. 글자를 고르려면 오행이어야
   * 하고, 그 변환이 빠지면 기운을 안 보고 이름을 짓게 된다.
   */
  check('채워야 할 기운이 오행으로 나온다',
    Array.isArray(d.채워야할기운?.오행) && d.채워야할기운.오행.length > 0
    && d.채워야할기운.오행.every((e: string) => ['목', '화', '토', '금', '수'].includes(e)),
    JSON.stringify(d.채워야할기운?.오행));

  const field = d.이름밭;
  check('성을 읽어 획수를 잡는다', field?.성?.한자 === '金' && field.성.획수[0] === 8);
  check('획수 짝을 낸다', field?.후보?.length > 3, `${field?.후보?.length}짝`);
  check('짝마다 네 격이 붙는다',
    field.후보.every((p: any) => p.네격?.초년운?.수 && p.네격?.전체운?.수));
  check('자리마다 글자가 있다',
    field.후보.every((p: any) => p.앞자리?.length && p.끝자리?.length));
  check('글자에 소리와 뜻이 붙는다',
    field.후보[0].앞자리.every((h: any) => h.자 && h.소리 && typeof h.획 === 'number'));

  /*
   * 리포트 한 편에 실어 보낼 수 있는 크기여야 한다. 엔진이 내는 대로 다 실으면
   * 십구만 토큰이 되어 이름 다섯 짓는 값이 리포트 값을 넘어선다.
   */
  const size = JSON.stringify(built.data).length;
  check('한 편에 실을 만한 크기다', size < 60000, `${size}자`);

  // 성이 없으면 지을 수 없다
  let noSur = false;
  try { buildPayload({ productId: 'naming-report', birth }); } catch { noSur = true; }
  check('성이 없으면 짓지 않는다', noSur);

  // 미리보기
  const pv = buildPreview('naming-report', built.data, 0.2);
  check('미리보기가 고를 수 있는 크기를 보여 준다',
    pv.contents.some((c) => c.includes('획수 짝'))
    && pv.contents.some((c) => /인명용 한자 \d+자/.test(c) && !c.includes(' 0자')),
    pv.contents.join(' / '));
  check('미리보기가 신고된다는 것을 말한다',
    pv.contents.some((c) => c.includes('출생신고')));
  check('예시가 누구 것인지 밝힌다', pv.sampleNotice.includes('다른 아이'));

  // 돌림자
  const dol = buildPayload({
    productId: 'naming-report', birth, child: birth,
    name: { surname: '김', fixed: { char: '珉', at: '뒤' } },
  });
  const df = (dol.data as any).이름밭;
  check('돌림자를 넣으면 그 자리가 고정된다',
    df.후보.length > 0 && df.후보.every((p: any) => p.끝자리.length === 1 && p.끝자리[0].자 === '珉'),
    `${df.후보.length}짝`);

  // 신고 안 되는 글자는 막는다
  let bad = false;
  try {
    buildPayload({ productId: 'naming-report', birth, child: birth, name: { surname: '김', fixed: { char: '龘', at: '뒤' } } });
  } catch { bad = true; }
  check('신고 안 되는 돌림자는 막는다', bad);
}

// ─── 오늘의 운세 ──────────────────────────────────────────────
{
  const { buildPayload, kindOf } = await import('./src/payload.ts');
  const { readFileSync } = await import('node:fs');
  check('오늘의 운세는 오늘운세 갈래로 나간다', kindOf('daily-report') === '오늘운세');
  const birth = { date: '1990-05-20', time: '14:30', gender: '남' as const };
  const built = buildPayload({ productId: 'daily-report', birth });
  check('오늘의 운세 kind는 오늘운세', built.kind === '오늘운세');
  const d = built.data as any;
  check('오늘의 날짜와 간지가 들어간다', !!d.오늘날짜 && !!d.오늘의간지);
  check('오늘의 십신과 유불리가 계산된다', !!d.오늘의십신 && !!d.오늘의기운_유불리);
  check('오늘의 행운 비책이 들어간다', Array.isArray(d.오늘의_처방전?.행운의_색상) && d.오늘의_처방전?.행운의_색상.length > 0);

  // 시간대 계산 및 고른 넷 검증
  check('오늘의 운세 자료에 시진이 열두 개 들어 있다',
    Array.isArray(d.열두시진) && d.열두시진.length === 12);
  check('고른 넷이 따로 들어 있고, 좋은 둘·나쁜 둘이 서로 겹치지 않는다',
    d.고른넷 && Array.isArray(d.고른넷.좋은둘) && d.고른넷.좋은둘.length === 2 &&
    Array.isArray(d.고른넷.나쁜둘) && d.고른넷.나쁜둘.length === 2 &&
    d.고른넷.좋은둘.every((g: any) => !d.고른넷.나쁜둘.some((b: any) => b.시진 === g.시진)));

  const birthB = { date: '1992-04-03', time: '08:00', gender: '여' as const };
  const builtB = buildPayload({ productId: 'daily-report', birth: birthB });
  const dB = builtB.data as any;
  const sameGood = JSON.stringify(d.고른넷.좋은둘) === JSON.stringify(dB.고른넷.좋은둘);
  const sameBad = JSON.stringify(d.고른넷.나쁜둘) === JSON.stringify(dB.고른넷.나쁜둘);
  check('같은 날이어도 명식이 다르면 고른 넷이 달라진다', !sameGood || !sameBad);

  const builtAgain = buildPayload({ productId: 'daily-report', birth });
  const dAgain = builtAgain.data as any;
  check('같은 입력을 두 번 돌리면 고른 넷이 똑같다',
    JSON.stringify(d.고른넷) === JSON.stringify(dAgain.고른넷));

  const payloadSource = readFileSync(new URL('./src/payload.ts', import.meta.url), 'utf-8');
  const dailyReportSourceIdx = payloadSource.indexOf("req.productId === 'daily-report'");
  const dailyReportChunk = payloadSource.slice(dailyReportSourceIdx, dailyReportSourceIdx + 1500);
  const calcDailyHoursIdx = payloadSource.indexOf("function calculateDailyHours");
  const calcDailyHoursChunk = payloadSource.slice(calcDailyHoursIdx, calcDailyHoursIdx + 2500);
  check('pickScore 가 오늘의 운세 자료를 만드는 데 쓰이지 않는다',
    !dailyReportChunk.includes('pickScore') && !calcDailyHoursChunk.includes('pickScore'));
}


// ─── 진태양시 보정 시각 검증 ────────────────────────────────────
{
  const { buildPayload } = await import('./src/payload.ts');
  const { calculate } = await import('../../packages/manseryeok/src/index.ts');
  const birthIncheon = { date: '1990-09-25', time: '14:40', place: '인천', gender: '남' as const };
  const payload = buildPayload({ productId: 'saju-report', birth: birthIncheon });
  const ms = calculate({ date: '1990-09-25', time: '14:40', longitude: 126.705 });
  const reportCorrected = (payload.data as any).계산근거?.correctedTime;
  check('리포트에 적힌 보정 시각이 만세력이 낸 값과 한 글자도 다르지 않다',
    reportCorrected === ms.meta.correctedTime && reportCorrected === '14:14',
    `리포트 ${reportCorrected} === 만세력 ${ms.meta.correctedTime}`);

  // 오늘운세 리포트에도 계산근거가 들어가고 보정 시각이 일치하는지 확인
  const dailyPayload = buildPayload({ productId: 'daily-report', birth: birthIncheon });
  const dailyCorrected = (dailyPayload.data as any).계산근거?.correctedTime;
  check('오늘운세 리포트 보정 시각도 만세력 값과 정확히 일치한다',
    dailyCorrected === ms.meta.correctedTime && dailyCorrected === '14:14');
  check('오늘운세에 추천 안내 한 줄이 포함되어 있다',
    (dailyPayload.data as any).고른넷?.안내 === '유리하면서 부딪힘까지 없는 시간을 골랐습니다.');

  // 명절 가족운세 데이터와 글 검증 테스트
  const { validateReportFacts } = await import('../../packages/report/src/validate.ts');
  const familyReq = {
    productId: 'family-holiday-report' as const,
    birth: birthIncheon,
    family: [
      { relation: '어머니', date: '1962-03-11', time: '12:00' },
      { relation: '아버지', date: '1958-11-02', time: '12:00' },
      { relation: '형', date: '1987-06-19', time: '12:00' },
    ],
  };
  const familyPayload = buildPayload(familyReq);
  const famData = familyPayload.data as any;
  check('명절 가족운세 손님 보정 시각이 만세력 값 14:14와 일치한다',
    famData.나의_계산근거?.correctedTime === '14:14');

  // 틀린 수치(14시 16분, 비겁 0%)가 들어간 글을 검증기가 차단하는지 확인
  const badFamText = '진태양시 14시 16분 보정이며 비겁 0%입니다.';
  const badResult = validateReportFacts(badFamText, famData);
  check('가짜 모델이 낸 틀린 수치(14시 16분, 비겁 0%)를 검증기가 적발한다',
    !badResult.valid && badResult.errors.length >= 2);

  // 올바른 수치(14시 14분, 비겁 11.7%, 어머니 화·토 42.3%)가 들어간 글은 통과하는지 확인
  const goodFamText = '진태양시 14시 14분 보정이며, 비겁 11.7%이고 어머니는 화·토 42.3%입니다.';
  const goodResult = validateReportFacts(goodFamText, famData);
  check('올바른 계산 수치가 들어간 글은 사실 검증을 통과한다', goodResult.valid);

  // ─── 출생지 및 시진 경계 검증 ────────────────────────────────
  const { PLACES } = await import('../../packages/saju-rules/src/index.ts');
  const { resolveLongitude } = await import('./src/payload.ts');

  // 0) PLACES 를 내보내는 곳이 저장소에 하나뿐이다 (saju-rules 와 site-policy re-export 객체 동일성)
  const sitePolicy = await import('../../packages/site-policy/src/index.ts');
  check('PLACES 를 내보내는 곳이 저장소에 하나뿐이다', PLACES === sitePolicy.PLACES);

    // 1) 태어난 곳을 안 주면 예전(서울 기본값)과 똑같은 명식이 나온다
  const noPlacePayload = buildPayload({
    productId: 'saju-report',
    birth: { date: '1990-09-25', time: '14:40', gender: '남' },
  });
  const seoulPayload = buildPayload({
    productId: 'saju-report',
    birth: { date: '1990-09-25', time: '14:40', place: '서울', gender: '남' },
  });
  check('태어난 곳을 안 주면 예전과 똑같은 명식이 나온다',
    JSON.stringify((noPlacePayload.data as any).명식) === JSON.stringify((seoulPayload.data as any).명식)
    && (noPlacePayload.data as any).계산근거.correctedTime === (seoulPayload.data as any).계산근거.correctedTime);

  // 2) PLACES 에 없는 이름을 보내면 서울(또는 undefined fallback)로 본다
  const invalidPlaceLon = resolveLongitude({ place: '안드로메다' });
  const seoulLon = PLACES.find((p) => p.name === '서울')!.longitude;
  check('PLACES 에 없는 이름을 보내면 서울(또는 undefined fallback)로 본다',
    invalidPlaceLon === undefined);

  // 3) 열두 곳 각각이 경도에 따라 서로 다른 보정 시각을 낸다
  const correctedTimes = new Set(
    PLACES.map((p) => {
      const msLocal = calculate({ date: '1990-09-25', time: '15:25', longitude: p.longitude });
      return msLocal.meta.correctedTime;
    })
  );
  check('열두 곳 각각이 경도에 따라 서로 다른 보정 시각을 낸다', correctedTimes.size >= 6);

  // 4) 시진 경계 근처(1990-09-25 15:25)에서 인천과 서울의 시주가 실제로 갈린다
  const incheon1525 = calculate({ date: '1990-09-25', time: '15:25', longitude: 126.705 });
  const seoul1525 = calculate({ date: '1990-09-25', time: '15:25', longitude: seoulLon });
  const incheonHourPillar = incheon1525.hour?.stem + incheon1525.hour?.branch;
  const seoulHourPillar = seoul1525.hour?.stem + seoul1525.hour?.branch;
  check('시진 경계 근처(1990-09-25 15:25)에서 인천과 서울의 시주가 실제로 갈린다',
    incheonHourPillar === '기미' && seoulHourPillar === '경신');

  // 5) 리포트 글에 자료에 없는 지명이 나오면 검증기가 차단한다
  const badPlaceReport = validateReportFacts(
    '부산 기준 진태양시 14시 14분 보정입니다. 금 45.6%입니다.',
    famData
  );
  check('리포트 글에 자료에 없는 지명이 나오면 검증기가 차단한다',
    !badPlaceReport.valid && badPlaceReport.errors.some((e) => e.includes('부산')));

}






/*
 * 뷰어에 묶이는 파일이 **서버 전용 도구를 쓰지 않는가.**
 *
 * 만세력 뷰어는 브라우저에서 도는 파일 하나로 묶인다. 그런데 거기 묶이는
 * `lucky-number.ts` 가 `node:crypto` 를 가져다 썼다. 브라우저에는 그런 것이
 * 없어서 **도커 빌드가 거기서 멈췄고, 열 번이 넘는 배포가 통째로 실패했다.**
 *
 * 더 나쁜 것은 **아무도 몰랐다는 점**이다. 검증은 전부 통과했고, 사이트도
 * 멀쩡해 보였다. 렌더가 실패한 새 버전 대신 **옛 버전을 그대로 살려 두기**
 * 때문이다. 새 상품도 고친 말도 며칠 동안 손님에게 안 나갔다.
 *
 * 그래서 여기서 막는다. 뷰어 진입점에서 시작해 따라 들어가는 모든 파일을
 * 훑고, `node:` 로 시작하는 것을 가져다 쓰면 실패로 잡는다.
 */
{
  const { readFileSync, existsSync } = await import('node:fs');
  const { join, dirname, resolve, relative } = await import('node:path');
  const { fileURLToPath } = await import('node:url');
  const viewerEntry = join(dirname(fileURLToPath(import.meta.url)), '..', 'manse-viewer', 'entry.ts');
  const seen = new Set<string>();
  const nodeOnly: string[] = [];
  const walk = (file: string) => {
    if (seen.has(file) || !existsSync(file)) return;
    seen.add(file);
    const text = readFileSync(file, 'utf8');
    for (const m of text.matchAll(/(?:from|import)\s*['"]([^'"]+)['"]/g)) {
      const spec = m[1]!;
      if (spec.startsWith('node:')) {
        nodeOnly.push(`${relative(process.cwd(), file)} → ${spec}`);
        continue;
      }
      if (!spec.startsWith('.')) continue;
      walk(resolve(dirname(file), spec));
    }
  };
  walk(viewerEntry);
  check('뷰어에 묶이는 파일이 서버 전용 도구를 쓰지 않는다',
    nodeOnly.length === 0,
    nodeOnly.length ? nodeOnly.join(' · ') : `${seen.size}개 파일을 훑음`);
}

/*
 * 주문 완료 메일 발송 검증
 */
{
  const { sendOrderMail, mailReady, buildReportMailSubject, buildOrderMailSubject } = await import('./src/mail.ts');
  const { CATALOG } = await import('../../packages/commerce/src/catalog.ts');
  const { readFileSync } = await import('node:fs');
  const { join, dirname } = await import('node:path');
  const { fileURLToPath } = await import('node:url');
  const { WITHDRAWAL_WINDOW_DAYS } = await import('../../packages/commerce/src/refund.ts');

  // 4단계: 34개 상품 전체 메일 제목 검증 — 「리포트 리포트」 중복 표기가 없어야 함
  const catalogProducts = Object.values(CATALOG);
  check('전체 상품 수가 34개이다', catalogProducts.length === 34, `${catalogProducts.length}개`);
  const productsWithDup = catalogProducts.filter(p =>
    buildReportMailSubject(p.name).includes('리포트 리포트') ||
    buildOrderMailSubject(p.name).includes('리포트 리포트')
  );
  check('34개 상품 메일 제목에 「리포트 리포트」 중복 표기가 하나도 없다',
    productsWithDup.length === 0,
    productsWithDup.length ? productsWithDup.map(p => p.name).join(', ') : '0개');
  check('「사주 종합 리포트」 리포트 전문 메일 제목이 올바르다',
    buildReportMailSubject('사주 종합 리포트') === '[늘봄사주] 사주 종합 리포트입니다');
  check('「사주 종합 리포트」 주문 완료 메일 제목이 올바르다',
    buildOrderMailSubject('사주 종합 리포트') === '[늘봄사주] 사주 종합 리포트를 보실 수 있습니다');
  check('끝이 「리포트」가 아닌 상품 메일 제목에 「리포트」가 붙는다',
    buildReportMailSubject('재회운') === '[늘봄사주] 재회운 리포트입니다' &&
    buildOrderMailSubject('재회운') === '[늘봄사주] 재회운 리포트를 보실 수 있습니다');

  // 1) 열쇠가 없을 때 sendOrderMail 이 예외를 던지지 않고 안 보냄으로 돌아온다
  const oldKey = process.env.RESEND_API_KEY;
  delete process.env.RESEND_API_KEY;
  const noKeyRes = await sendOrderMail({
    to: 'test@example.com',
    orderId: 'ord_test_nokey',
    productName: '사주 종합 리포트',
  });
  check('열쇠가 없을 때 예외 없이 안 보냄으로 돌아온다',
    noKeyRes.sent === false && noKeyRes.reason === '열쇠 없음');

  // 2) 받는 주소가 비었거나 잘못되었을 때도 예외를 던지지 않는다
  process.env.RESEND_API_KEY = 're_test_dummy_key';
  const emptyTo = await sendOrderMail({
    to: '',
    orderId: 'ord_test_empty',
    productName: '사주 종합 리포트',
  });
  check('받는 주소가 비었을 때 예외 없이 안 보냄으로 돌아온다',
    emptyTo.sent === false && emptyTo.reason === '주소 없음');

  const invalidTo = await sendOrderMail({
    to: 'invalid-email',
    orderId: 'ord_test_invalid',
    productName: '사주 종합 리포트',
  });
  check('받는 주소에 @가 없을 때 예외 없이 안 보냄으로 돌아온다',
    invalidTo.sent === false && invalidTo.reason === '주소 없음');

  // 3) 메일 보내는 쪽이 통째로 실패(예외 발생)해도 confirm 은 200 이고 리포트 본문이 나온다
  const fakeGw = new FakeGateway();
  const testOrders = new MemoryOrderStore();
  const mailSrv = createServer(createApi({
    gateway: fakeGw,
    orders: testOrders,
    generate: async () => ({ text: '리포트 본문 내용' }),
    business,
  }));
  await new Promise<void>((r) => mailSrv.listen(0, r));
  const mailPort = (mailSrv.address() as { port: number }).port;
  const mailApi = async (method: string, path: string, body?: unknown) => {
    const res = await origFetch(`http://127.0.0.1:${mailPort}${path}`, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : {},
      body: body ? JSON.stringify(body) : undefined,
    });
    return { status: res.status, body: await res.json() as any };
  };

  const origFetch = globalThis.fetch;
  process.env.RESEND_API_KEY = 're_test_dummy_key';
  try {
    globalThis.fetch = async (input: any, init?: any) => {
      const url = typeof input === 'string' ? input : input?.url || '';
      if (url.includes('api.resend.com')) {
        throw new Error('Resend 서버 접속 불가 폭탄');
      }
      return origFetch(input, init);
    };
    const dummyOrder = await mailApi('POST', '/api/orders', {
      productId: 'cross-report',
      birth: BIRTH,
      face: { foreheadWidth: 'wide' },
      palm: { lifeLength: 'long' },
      email: 'test@example.com',
      acknowledgedNotice: true,
      previewShown: true,
    });
    check('주문 생성 성공', dummyOrder.status === 201, `상태: ${dummyOrder.status}, 에러: ${dummyOrder.body?.error}`);
    const ordId = dummyOrder.body.order.id;
    fakeGw.put({
      paymentId: ordId,
      status: 'paid',
      amountKrw: dummyOrder.body.order.amountKrw,
      merchantOrderId: ordId,
      method: 'card',
      paidAt: new Date().toISOString(),
      raw: {},
    });
    await mailApi('POST', `/api/orders/${ordId}/pending`);
    const confirmRes = await mailApi('POST', `/api/orders/${ordId}/confirm`, {
      paymentId: ordId,
    });
    check('메일 발송이 예외를 던져도 주문 확정은 200 성공', confirmRes.status === 200);
    const repRes = await mailApi('GET', `/api/orders/${ordId}/report`);
    check('메일 발송이 실패해도 리포트 본문이 온전히 조회됨', repRes.status === 200 && Boolean(repRes.body.text));
  } finally {
    globalThis.fetch = origFetch;
  }

  // 4) 메일 소스코드 검사: WITHDRAWAL_WINDOW_DAYS 사용 여부
  const mailCode = readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'src', 'mail.ts'), 'utf8');
  check('메일 코드에서 WITHDRAWAL_WINDOW_DAYS 를 가져다 쓴다',
    mailCode.includes('WITHDRAWAL_WINDOW_DAYS') && mailCode.includes('${WITHDRAWAL_WINDOW_DAYS}일'));
  check('메일 코드에 환불 일수를 7일로 하드코딩하지 않았다',
    !/결제\s*후\s*7일/.test(mailCode));

  /*
   * 5) 리포트 전문이 **언제** 메일로 나가는지.
   *
   * 결제 직후 메일(sendOrderMail)에는 주소만 들어간다. 전문은 손님이 리포트를
   * **처음 연 뒤에만**(sendReportMail) 나간다. 결제 직후에 전문을 보내면
   * 「열람하지 않으면 환불」이라는 약속과 어긋난다 — 메일로 글이 나간 순간
   * 열람을 안 했다고 할 수 없기 때문이다.
   */
  const 결제직후메일 = mailCode.slice(mailCode.indexOf('export async function sendOrderMail'));
  check('결제 직후 메일에는 주소만 들어간다',
    !결제직후메일.includes('reportText') && !결제직후메일.includes('chunks') && mailCode.includes('/order/'),
    '결제하자마자 전문이 나가면 환불 약속과 어긋난다');
  check('리포트 전문을 보내는 자리가 따로 있다',
    mailCode.includes('export async function sendReportMail'));

  const serverCode = readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'src', 'server.ts'), 'utf8');
  check('전문 메일은 처음 연 뒤에만 보낸다',
    /처음연다 && viewed\.email/.test(serverCode) && serverCode.includes('sendReportMail'),
    '연 적 없는 주문에도 전문이 나간다');
  check('전문 메일이 리포트 보여 주는 길을 막지 않는다',
    /send\(res, 200, \{ text[\s\S]{0,900}?void sendReportMail/.test(serverCode),
    '메일을 기다린 뒤에 화면을 주면 메일이 늦을 때 손님이 기다린다');

  // 6) 코드 어디에도 nodemailer 같은 새 라이브러리를 부르지 않는지
  const apiPkg = readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'package.json'), 'utf8');
  check('package.json 에 nodemailer 가 없다', !apiPkg.includes('nodemailer'));
  check('mail.ts 에 외부 패키지 import 가 없다', !/import\s+.*\s+from\s+['"](?!(\.|\.\.|\/)).*['"]/.test(mailCode));

  // 7) 메일 코드가 보내기 전과 후에 기록을 남긴다 & 기록에 열쇠(re_...)가 절대 안 찍힌다
  const { sendTestMail, redactKey, formatMailFrom } = await import('./src/mail.ts');

  // 6단계: 보내는 이 이름 한글 RFC 2047 인코딩 검증
  const defaultFrom = formatMailFrom();
  const expectedEncoded = `=?UTF-8?B?${Buffer.from('늘봄사주').toString('base64')}?= <no-reply@neulbomsaju.co.kr>`;
  check('기본 발송자 이름이 RFC 2047 규격으로 인코딩되어 주소와 함께 구성된다',
    defaultFrom === expectedEncoded,
    defaultFrom);
  check('발송자 주소 부분(<no-reply@neulbomsaju.co.kr>)이 온전하다',
    defaultFrom.endsWith('<no-reply@neulbomsaju.co.kr>'));
  check('한글 발송자명 인코딩이 올바르다',
    formatMailFrom('늘봄사주 <no-reply@neulbomsaju.co.kr>') === expectedEncoded);
  check('영문 발송자명은 그대로 유지된다',
    formatMailFrom('Neulbom Saju <no-reply@neulbomsaju.co.kr>') === 'Neulbom Saju <no-reply@neulbomsaju.co.kr>');

  const capturedLogs: string[] = [];
  const origLog = console.log;
  console.log = (...args: any[]) => {
    capturedLogs.push(args.map(String).join(' '));
    origLog(...args);
  };

  // 실제 Resend 열쇠는 36자이며 가운데 밑줄이 있다 (re_XXXXXXXX_YYYY...YYYY)
  const testApiKey = 're_8aB3kLmN_9xYzQw4RtUvWx7PqS2dFg1234';
  const keyFront = '8aB3kLmN';
  const keyBack = '9xYzQw4RtUvWx7PqS2dFg1234';
  process.env.RESEND_API_KEY = testApiKey;

  check('redactKey 가 실제 36자 밑줄 키(앞8자, 뒤24자) 전체를 가린다',
    redactKey(testApiKey) === '[REDACTED]' &&
    !redactKey(`오류: ${testApiKey} 노출됨`).includes(keyFront) &&
    !redactKey(`오류: ${testApiKey} 노출됨`).includes(keyBack));

  const origAdminToken = process.env.ADMIN_TOKEN;
  const origOwnerPass = process.env.OWNER_PASS;

  try {
    globalThis.fetch = async (input: any, init?: any) => {
      const url = typeof input === 'string' ? input : input?.url || '';
      if (url.includes('api.resend.com')) {
        return new Response(JSON.stringify({ id: 'email_test_123', status: 'ok', debug: testApiKey }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      return origFetch(input, init);
    };

    const testRes = await sendTestMail({ to: 'admin@example.com' });
    check('sendTestMail 성공 반환', testRes.sent && testRes.status === 200);

    const hasPreLog = capturedLogs.some((l) => l.includes('[메일] 보내려 함') && l.includes('admin@example.com'));
    const hasPostLog = capturedLogs.some((l) => l.includes('[메일] 답 200') && l.includes('email_test_123'));
    check('메일 코드가 보내기 전과 후에 기록을 남긴다', hasPreLog && hasPostLog);

    const leakedKey = capturedLogs.some((l) => l.includes(testApiKey));
    const leakedFront = capturedLogs.some((l) => l.includes(keyFront));
    const leakedBack = capturedLogs.some((l) => l.includes(keyBack));
    const redactedKeySeen = capturedLogs.some((l) => l.includes('[REDACTED]'));
    check('기록에 열쇠(re_...)와 조각(앞8자, 뒤24자)이 절대 안 찍힌다', !leakedKey && !leakedFront && !leakedBack && redactedKeySeen);

    // 8) /admin/mail-check 가 암호 없이는 안 열린다 (404) & 암호/토큰으로 열린다 (200)
    process.env.ADMIN_TOKEN = 'admin_secret_token_123';
    process.env.OWNER_PASS = 'owner_secret_pass_1234567890';

    const checkNoAuth = await mailApi('GET', '/admin/mail-check?to=check@example.com');
    check('/admin/mail-check 가 암호 없이는 안 열린다', checkNoAuth.status === 404);

    const checkTokenAuth = await mailApi('GET', `/admin/mail-check?token=admin_secret_token_123&to=check@example.com`);
    check('/admin/mail-check 토큰 인증으로 200 성공',
      checkTokenAuth.status === 200 &&
      checkTokenAuth.body.hasKey === true &&
      checkTokenAuth.body.keyLength === testApiKey.length &&
      typeof checkTokenAuth.body.from === 'string' &&
      checkTokenAuth.body.status === 200);
    const bodyStr = JSON.stringify(checkTokenAuth.body);
    check('/admin/mail-check 응답에 실제 API 키 및 조각(앞8자, 뒤24자)이 없다',
      !bodyStr.includes(testApiKey) && !bodyStr.includes(keyFront) && !bodyStr.includes(keyBack));

    const checkPassAuth = await mailApi('GET', `/admin/mail-check?pass=owner_secret_pass_1234567890&to=check@example.com`);
    check('/admin/mail-check 주인 통과로 200 성공', checkPassAuth.status === 200 && checkPassAuth.body.sent === true);
  } finally {
    console.log = origLog;
    globalThis.fetch = origFetch;
    mailSrv.close();
    if (origAdminToken === undefined) delete process.env.ADMIN_TOKEN;
    else process.env.ADMIN_TOKEN = origAdminToken;
    if (origOwnerPass === undefined) delete process.env.OWNER_PASS;
    else process.env.OWNER_PASS = origOwnerPass;
    if (oldKey !== undefined) process.env.RESEND_API_KEY = oldKey;
    else delete process.env.RESEND_API_KEY;
  }
}

// ── 2026-09-30 리포트 개편 및 이어사기·상세페이지 검증 ─────────────────────────
section('리포트 개편 — 시각 인지, 상세 가림막, 서버 계산 이어사기');

/*
 * 터진 뒤에 적은 것 (2026-09-30): 리포트 품질 개선 및 전자상거래법 준수 검증.
 * 1) 태어난 시각을 정확히 준 주문은 payload 의 시각을_아는가 가 true, 모른다고 한 주문은 false 이고 가운데 값(12:00) 사용.
 * 2) 상세페이지 미리보기에 결론 문장을 가린 블러 및 자물쇠 표시와 안내 문구가 실제로 들어가는지.
 * 3) 리포트 화면의 이어사기 할인 금액이 서버가 계산한 값(12시간 내 5,900원, 이후 8,900원)과 정확히 일치하는지 검증한다.
 */
{
  const { buildPayload } = await import('./src/payload.ts');
  const { calculateUpsellPrice, upsellFor } = await import('../../packages/commerce/src/orderable.ts');
  const { renderProductPage } = await import('../../packages/site-policy/src/products.ts');
  const { renderOrderPage } = await import('../../packages/site-policy/src/order-page.ts');

  // 1) 태어난 시각을 정확히 준 주문은 payload 의 시각을_아는가 가 true
  const knownPayload = buildPayload({
    productId: 'wealth-report',
    birth: { date: '1990-05-15', time: '14:24', gender: '남', name: '홍길동', timeKnown: true },
  } as any);
  check('태어난 시각을 정확히 준 주문은 payload 의 시각을_아는가 가 true',
    (knownPayload.data as any).시각을_아는가 === true);

  // 모른다고 한 주문은 false 이고, 그때만 칸 가운데 값을 쓴다
  const unknownPayload = buildPayload({
    productId: 'wealth-report',
    birth: { date: '1990-05-15', time: '12:00', gender: '남', name: '홍길동', timeKnown: false },
  } as any);
  check('모른다고 한 주문은 시각을_아는가 가 false 이고 칸 가운데 값(12:00)을 쓴다',
    (unknownPayload.data as any).시각을_아는가 === false && (unknownPayload.data as any).계산근거.inputTime === '12:00');

  // 2) 상세페이지에 가린 자리 표시가 실제로 들어간다
  const { sampleFor, sampleNoticeFor } = await import('./src/preview.ts');
  const wealthHtml = renderProductPage(
    CATALOG['wealth-report'],
    business,
    true,
    '',
    undefined,
    undefined,
    { text: sampleFor('wealth-report'), notice: sampleNoticeFor('wealth-report') },
  );
  check('상세페이지에 가린 자리(pd-locked-sentence) 표시가 실제로 들어간다',
    wealthHtml.includes('class="pd-locked-sentence"'));
  check('상세페이지에 흐릿한 텍스트(pd-blurred-text)가 실제로 들어간다',
    wealthHtml.includes('class="pd-blurred-text"'));
  check('상세페이지에 자물쇠 뱃지(pd-lock-badge)가 실제로 들어간다',
    wealthHtml.includes('class="pd-lock-badge"'));
  check('가린 곳 아래 안내 문구가 노출된다',
    wealthHtml.includes('가려진 곳은 손님의 실제 명식으로 채워집니다'));

  // 3) 리포트 끝 이어사기 값이 서버가 계산한 값과 같다
  const mockOrder = {
    id: 'ord_upsell_test',
    productId: 'wealth-report' as const,
    amountKrw: 14900,
    status: 'viewed' as const,
    viewedAt: '2026-09-30T10:00:00.000Z',
    createdAt: '2026-09-30T09:50:00.000Z',
    paidAt: '2026-09-30T09:55:00.000Z',
    refundedAt: null,
    paymentId: 'pay_test',
    inputHash: 'hash',
    noticeGiven: true,
    previewProvided: true,
    ref: null,
    email: null,
  };
  const wealthUpsell = upsellFor('wealth-report');
  check('돈그릇 이어사기 묶음이 존재한다', wealthUpsell !== null);
  if (wealthUpsell) {
    const serverNow = new Date('2026-09-30T14:00:00.000Z'); // 4시간 경과 (12시간 이내)
    const serverUpsellInfo = calculateUpsellPrice('wealth-report', wealthUpsell.id, mockOrder.viewedAt, serverNow);
    const { renderOrderReportPage } = await import('../../packages/site-policy/src/order-page.ts');
    const orderPageHtml = renderOrderReportPage(
      business,
      '',
      mockOrder as any,
      '리포트 본문 내용',
      null,
      {
        info: serverUpsellInfo,
        reason: '관성 19.9%가 재성 17.5%보다 두껍습니다',
        checkoutUrl: `/checkout?product=${serverUpsellInfo.nextProduct?.id}&fromOrder=${mockOrder.id}`,
      },
    );

    check('리포트 끝 이어사기 값이 서버가 계산한 값(5,900원)과 같다',
      orderPageHtml.includes(`${serverUpsellInfo.currentPriceKrw.toLocaleString('ko-KR')}원`) &&
      serverUpsellInfo.currentPriceKrw === 5900 &&
      orderPageHtml.includes('따로 사면 14,900원') &&
      orderPageHtml.includes('남은 시간'));

    // 만료 후 8,900원 확인
    const expiredNow = new Date('2026-09-30T23:00:00.000Z'); // 13시간 경과
    const expiredUpsellInfo = calculateUpsellPrice('wealth-report', wealthUpsell.id, mockOrder.viewedAt, expiredNow);
    const expiredHtml = renderOrderReportPage(
      business,
      '',
      mockOrder as any,
      '리포트 본문 내용',
      null,
      {
        info: expiredUpsellInfo,
        reason: '관성 19.9%가 재성 17.5%보다 두껍습니다',
        checkoutUrl: `/checkout?product=${expiredUpsellInfo.nextProduct?.id}&fromOrder=${mockOrder.id}`,
      },
    );
    check('12시간 경과 후에는 서버 계산값(8,900원)이 화면에 표기된다',
      expiredHtml.includes(`${expiredUpsellInfo.currentPriceKrw.toLocaleString('ko-KR')}원`) &&
      expiredUpsellInfo.currentPriceKrw === 8900 &&
      expiredHtml.includes('할인 시간이 지났습니다'));
  }
}

{
  section('배경음악 지연 생성 검증 (음악 끈 손님 데이터 낭비 방지)');
  const appJsCode = readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'public/app.js'), 'utf8');

  // setSound 함수 내부 정적 분석
  const setSoundMatch = appJsCode.match(/function setSound\(enable\)\s*\{([\s\S]*?)\n  \}/);
  check('setSound 함수 존재', !!setSoundMatch);
  if (setSoundMatch) {
    const fnBody = setSoundMatch[1];
    check('setSound(false) 분기에서 getBgm()을 부르지 않는다',
      !/else\s*\{[^}]*getBgm\(\)/.test(fnBody));
    check('getBgm() 호출은 enable(켜는 쪽)에만 모여 있다',
      /if\s*\(enable\)\s*\{[\s\S]*?getBgm\(\)/.test(fnBody) &&
      (fnBody.match(/getBgm\(\)/g) ?? []).length === 1);
    check('끄는 쪽에서는 기존 bgmAudio가 있을 때만 정지한다',
      /if\s*\(bgmAudio\)\s*\{\s*bgmAudio\.pause\(\);?\s*\}/.test(fnBody));
  }

  // 모의 브라우저 환경에서 동작 테스트
  let audioInstances = 0;
  class MockAudio {
    src: string;
    loop = false;
    volume = 1.0;
    paused = true;
    constructor(src: string) {
      this.src = src;
      audioInstances++;
    }
    async play() { this.paused = false; }
    pause() { this.paused = true; }
  }

  // 꺼 둔 상태(localStorage = '0') 모의 실행
  const sandboxMuted: any = {
    Audio: MockAudio,
    document: { addEventListener: () => {}, removeEventListener: () => {}, getElementById: () => null },
    localStorage: { getItem: (k: string) => k === 'nb_sound_active' ? '0' : null, setItem: () => {} },
  };
  const testScriptMuted = `
    let bgmAudio = null;
    let isAudioActive = false;
    let gateVideo = null, enterVideo = null, stageGate = null, soundControl = null, soundIcon = null, soundText = null;
    function getBgm() {
      if (!bgmAudio) {
        try { bgmAudio = new Audio('/audio/bgm'); } catch(e) { bgmAudio = null; }
      }
      return bgmAudio;
    }
    ${setSoundMatch ? setSoundMatch[0] : ''}
    const savedSound = localStorage.getItem('nb_sound_active');
    if (savedSound === '0') { setSound(false); }
  `;
  new Function('Audio', 'localStorage', 'document', testScriptMuted)(MockAudio, sandboxMuted.localStorage, sandboxMuted.document);
  check('소리 꺼 둔 손님이 화면 열었을 때 /audio/bgm 을 한 번도 안 받는다', audioInstances === 0, `Audio 생성 횟수: ${audioInstances}회`);

  // 켠 상태에서 setSound(true) 호출 시 Audio 생성
  const sandboxOn: any = {
    Audio: MockAudio,
    document: { addEventListener: () => {}, removeEventListener: () => {}, getElementById: () => null },
    localStorage: { getItem: (k: string) => null, setItem: () => {} },
  };
  const testScriptOn = `
    let bgmAudio = null;
    let isAudioActive = false;
    let gateVideo = null, enterVideo = null, stageGate = null, soundControl = null, soundIcon = null, soundText = null;
    function getBgm() {
      if (!bgmAudio) {
        try { bgmAudio = new Audio('/audio/bgm'); } catch(e) { bgmAudio = null; }
      }
      return bgmAudio;
    }
    ${setSoundMatch ? setSoundMatch[0] : ''}
    setSound(true);
    let pausedAfterOff = false;
    setSound(false);
    if (bgmAudio && bgmAudio.paused) pausedAfterOff = true;
    return { audioCount: bgmAudio ? 1 : 0, pausedAfterOff };
  `;
  const resultOn = new Function('Audio', 'localStorage', 'document', testScriptOn)(MockAudio, sandboxOn.localStorage, sandboxOn.document);
  check('소리를 켜면 /audio/bgm Audio 객체를 생성한다', resultOn.audioCount === 1);
  check('신령음 OFF(setSound false)를 누르면 음악이 멈춘다', resultOn.pausedAfterOff === true);
}
// ── 아이 상품 사주 분리 검증 (1단계) ───────────────────────────────
section('아이 상품 사주 분리 검증 (1단계)');

const parentBirth = { date: '1988-05-14', time: '14:40', gender: '남' as const, name: '이부모' };
const childBirth = { date: '2026-03-10', time: '10:00', gender: '남' as const, name: '이도윤' };
const childDueBirth = { date: '2026-03-10', time: '12:00', gender: '남' as const, isDueDate: true };

/*
 * 터진 뒤에 적은 것 (2026-10-05): 여기에 상품을 손으로 넷 적어 두었더니,
 * 다섯째(진학운)가 붙었을 때 검사가 그것을 보지 않았다. 상품표에서 읽는다.
 */
const childProductIds = Object.values(CATALOG).filter((p) => p.needsChild).map((p) => p.id);
check('아이를 약속한 상품은 모두 아이 칸을 받는다', childProductIds.length >= 5,
  `아이 칸이 붙은 상품 ${childProductIds.length}개`);
/*
 * 아이를 약속했는데 받는 칸이 없으면 부모 사주로 아이를 적는다.
 * 다만 부모·자식 궁합은 아이를 **상대 칸**으로 받고, 제왕절개 택일은
 * 아이가 아직 안 태어나 생년월일이 없다 — 이 둘은 빼고 본다.
 */
{
  const 칸없이약속한것 = Object.values(CATALOG).filter((p) => !p.isPackage
    && /이 아이|아이의|우리 아이|아이가/.test(`${p.description} ${p.hook}`)
    && !p.needsChild && !p.needsPartner && !p.needsPick);
  check('설명에 「아이」가 든 상품에 아이 칸이 빠지지 않았다',
    칸없이약속한것.length === 0, 칸없이약속한것.map((p) => p.id).join(', ') || '전부 붙음');
}

// 1. 네 상품 모두 아이의 명식(2026-03-10)으로 세워져야 한다 (부모 1988-05-14 명식이면 안 됨)
for (const pId of childProductIds) {
  const req = {
    productId: pId,
    birth: parentBirth,
    child: childBirth,
    name: { surname: '이' },
  };
  const payload = buildPayload(req as any);
  const data: any = payload.data;
  const myeongsik = data.명식 || data.아이사주?.명식;
  check(`${pId}는 아이 명식(2026-03-10, 병오년)으로 계산된다`, myeongsik?.연주 === '병오', `실제 연주: ${myeongsik?.연주}`);
  check(`${pId}는 부모 명식(1988-05-14, 무진년)을 쓰지 않는다`, myeongsik?.연주 !== '무진');
  check(`${pId}의 subject는 부모 이름이 아니다`, payload.subject !== '이부모');
}

// 2. 예정일 주문인 경우 '예정일' 문구가 실리는지 검증
for (const pId of childProductIds) {
  const req = {
    productId: pId,
    birth: parentBirth,
    child: childDueBirth,
    name: { surname: '이' },
  };
  const payload = buildPayload(req as any);
  const data: any = payload.data;
  check(`${pId} 예정일 주문에 예정일 안내 문구가 실린다`,
    data.예정일 === '예정일 2026-03-10 로 세운 명식입니다. 실제 태어난 날이 달라지면 명식도 달라집니다.');
}

// 3. 아들과 딸의 대운 방향이 반대다
{
  const parent = { date: '1988-05-14', time: '14:40', gender: '남' as const, name: '이부모' };
  const dirs = (['남', '여'] as const).map((g) => {
    const d: any = buildPayload({ productId: 'child-report', birth: parent,
      child: { date: '2026-03-10', time: '10:00', gender: g } } as any).data;
    return d.지금_대운?.방향;
  });
  check('아들과 딸의 대운 방향이 반대다', !!dirs[0] && !!dirs[1] && dirs[0] !== dirs[1], dirs.join(' / '));
}

// 4. 결제 화면의 아이 성별 칸은 아무것도 골라져 있지 않다
{
  const childCheckout = renderCheckoutPage(business, '', CATALOG['child-report'],
    { storeId: 'test', channelKey: 'test' }, false, false);
  check('아이 성별 칸이 미리 골라져 있지 않다',
    /<option value="" selected>/.test(childCheckout)
    && !/<option value="남"[^>]*selected/.test(childCheckout),
    '딸인데 넘어가면 대운이 거꾸로 나간다');
  check('아이 성별을 안 고르면 결제가 잠긴다',
    childCheckout.includes("아이가 아들인지 딸인지 골라 주십시오"));
}

/*
 * 5. 작명은 아이의 태어난 날을 몰라도 통과한다.
 *
 * 터진 뒤에 적은 것 (2026-10-06): 작명을 맡기는 부모 상당수가 아이가
 * 태어나기 전이고, 예정일조차 모르는 분이 적지 않다. 날짜를 꼭 받으니
 * 그분들이 결제 화면에서 막혀 그대로 돌아갔다.
 *
 * 날짜가 없으면 아이 사주를 세울 수 없다. **사주를 봤다고 적지 않는 것**까지
 * 같이 본다 — 안 본 것을 봤다고 적으면 그게 거짓 광고다.
 */
{
  const parent = { date: '1988-05-14', time: '14:40', gender: '남' as const, name: '이부모' };

  /** 통과하면 0, 막히면 그 번호 */
  const 받아보기 = (body: any): number => {
    try { validateReading(body); return 0; } catch (e: any) { return e?.status ?? 500; }
  };

  for (const pId of ['naming-report', 'naming-plus-report'] as const) {
    const body: any = { productId: pId, birth: parent, name: { surname: '이' } };
    check(`${pId}는 아이 생년월일 없이도 통과한다`, 받아보기(body) === 0, `막힘 ${받아보기(body)}`);
    check(`${pId}는 날짜를 못 받았다고 표시해 둔다`, body.child?.dateUnknown === true);
  }

  check('아이 리포트는 아이 생년월일 없이 통과하지 않는다',
    받아보기({ productId: 'child-report', birth: parent }) === 400);
  check('작명도 성을 안 적으면 통과하지 않는다',
    받아보기({ productId: 'naming-report', birth: parent }) === 400);

  const 날짜없이: any = buildPayload({ productId: 'naming-report', birth: parent,
    child: { dateUnknown: true }, name: { surname: '이' } } as any).data;
  check('날짜 없는 작명 자료에는 아이 사주가 없다',
    !날짜없이.아이사주 && !날짜없이.채워야할기운);
  check('날짜 없는 작명 자료가 사주를 안 봤다고 밝힌다',
    typeof 날짜없이.사주는보지않았음?.반드시적을것 === 'string'
    && 날짜없이.사주는보지않았음.반드시적을것.includes('사주를 보지 않고'));
  check('날짜 없는 작명도 이름밭은 펼쳐진다',
    Array.isArray(날짜없이.이름밭?.후보) && 날짜없이.이름밭.후보.length > 0,
    `후보 ${날짜없이.이름밭?.후보?.length ?? 0}가지`);

  const 날짜있는: any = buildPayload({ productId: 'naming-report', birth: parent,
    child: { date: '2026-03-10', time: '10:00', gender: '여' }, name: { surname: '이' } } as any).data;
  check('날짜가 있으면 아이 사주가 실린다', 날짜있는.아이사주?.명식?.연주 === '병오',
    `연주: ${날짜있는.아이사주?.명식?.연주}`);
  check('날짜가 있으면 사주를 안 봤다는 말이 없다', !날짜있는.사주는보지않았음);

  const 딸: any = buildPayload({ productId: 'naming-plus-report', birth: parent,
    child: { date: '2026-03-10', time: '10:00', gender: '여' }, name: { surname: '이' } } as any).data;
  check('「안 겹치게」는 부모가 아니라 아이의 성별로 흔한 이름을 피한다',
    딸.요즘_흔한_이름?.성별 === '여', `${딸.요즘_흔한_이름?.성별}`);

  check('상품 화면 패널에도 「아직 모릅니다」 칸이 있다',
    homeApp.includes("tickField('childDateUnknown', '태어난 날도 예정일도 아직 모릅니다')")
    && homeApp.includes('product.childDateOptional'));
  check('패널에서 그 칸을 누르면 날짜를 묻지 않는다',
    homeApp.includes('fields.childDateUnknown && fields.childDateUnknown.checked')
    && homeApp.includes("data.child = { dateUnknown: true }"));

  const namingCheckout = renderCheckoutPage(business, '', CATALOG['naming-report'],
    { storeId: 'test', channelKey: 'test' }, false, false);
  check('작명 결제 화면에 「아직 모릅니다」 칸이 있다',
    namingCheckout.includes('id="childDateUnknown"')
    && namingCheckout.includes('태어난 날도 예정일도 아직 모릅니다'));
  const childOnly = renderCheckoutPage(business, '', CATALOG['child-report'],
    { storeId: 'test', channelKey: 'test' }, false, false);
  check('아이 리포트 결제 화면에는 그 칸이 없다',
    !childOnly.includes('id="childDateUnknown"'));
}

// ── 4단계: 무료 사주 화면의 위치와 기둥 순서 ─────────────────────────
section('무료 사주 화면 위치 및 기둥 순서 검증 (4단계)');

{
  const here = dirname(fileURLToPath(import.meta.url));
  const serverSrc = readFileSync(join(here, 'src', 'server.ts'), 'utf8');
  const viewerIdx = serverSrc.indexOf('id="manseStage"');
  const footerIdx = serverSrc.indexOf('class="site-footer-wrapper"');

  check('화면에서 뷰어가 .site-footer-wrapper 보다 앞에 온다', viewerIdx !== -1 && footerIdx !== -1 && viewerIdx < footerIdx);

  // 기둥 순서 검증: 연주 -> 월주 -> 일주 -> 시주
  /*
   * 터진 뒤에 적은 것 (2026-10-05): 이 검사가 `index.html` 을 보고 있었다.
   * 그 파일은 `index.template.html` 로 **만들어지는** 것이고 깃에 들어가지도
   * 않는다. 빌드를 돌리지 않은 자리에서는 낡은 파일을 보고 엉뚱하게 실패하거나,
   * 더 나쁘게는 고쳐지지 않았는데 통과한다. 깃에 든 원본을 본다.
   */
  const manseHtml = readFileSync(join(here, '..', 'manse-viewer', 'index.template.html'), 'utf8');

  const yearPillarIdx = manseHtml.indexOf("pillarColumn(ms.year, byPos['연주'], '연주', false)");
  const monthPillarIdx = manseHtml.indexOf("pillarColumn(ms.month, byPos['월주'], '월주', false)");
  const dayPillarIdx = manseHtml.indexOf("pillarColumn(ms.day, byPos['일주'], '일주 · 나', true)");
  const hourPillarIdx = manseHtml.indexOf("pillarColumn(ms.hour, byPos['시주'], '시주', false)");

  check('기둥 순서가 연·월·일·시 순이다',
    yearPillarIdx !== -1 &&
    monthPillarIdx !== -1 &&
    dayPillarIdx !== -1 &&
    hourPillarIdx !== -1 &&
    yearPillarIdx < monthPillarIdx &&
    monthPillarIdx < dayPillarIdx &&
    dayPillarIdx < hourPillarIdx);
}

// ── 6단계: 손 사진 안내의 위치 및 문구 ────────────────────────────────
section('손 사진 안내 위치 및 문구 검증 (6단계)');

{
  const here = dirname(fileURLToPath(import.meta.url));
  const appJsCode = readFileSync(join(here, 'public', 'app.js'), 'utf8');

  // 1. "남좌여우" 포함, "반대 손" 빠짐
  check('app.js 손 안내 문구에 남좌여우 포함',
    appJsCode.includes('남자는 왼손, 여자는 오른손을 올려주십시오 (남좌여우).'));

  check('app.js 손 안내 문구에서 「반대 손」이 빠져 있다',
    !appJsCode.includes('반대 손도 괜찮습니다'));

  // 2. 안내 위치가 손 사진 box 바로 위
  const handIdx = appJsCode.indexOf("'taste-jaegi-hand'");
  const palmBoxIdx = appJsCode.indexOf("tEl('div', 'taste-jaegi-box')", handIdx);
  check('app.js 손 사진 안내 문구가 손 사진 box 바로 앞에 위치한다',
    handIdx !== -1 && palmBoxIdx !== -1 && handIdx < palmBoxIdx && (palmBoxIdx - handIdx) < 150);
}

// ── 7단계: 첫 화면 문구 어색한 것 다듬기 ──────────────────────────────
section('첫 화면 문구 다듬기 검증 (7단계)');

{
  const here = dirname(fileURLToPath(import.meta.url));
  const serverSrc = readFileSync(join(here, 'src', 'server.ts'), 'utf8');

  check('첫 화면에 "누루시면" 오타가 없다',
    !serverSrc.includes('누루시면'));

  // 터진 뒤에 적은 것 (2026-10-06): 마디 묶음(span)을 넣자 옛 검사가 문구를 못 찾았다. 묶음을 걷고 본다.
  const 묶음걷은서버 = serverSrc
    .replace(/<span class="nb-brk">/g, '').replace(/<\/span>/g, '').replace(/<br>/g, ' ');

  check('첫 화면 안내 문구가 올바르다',
    묶음걷은서버.includes('상품을 누르시면 신령이 그 자리에서 사주를 봐 드립니다'));

  check('첫 화면 안내 문구는 마디째로만 줄이 바뀐다',
    serverSrc.includes('<span class="nb-brk">상품을 누르시면 신령이</span><br><span class="nb-brk">그 자리에서 사주를 봐 드립니다</span>'));

  check('첫 화면 벗 증표 바에 신령 말투 및 INVITE_DISCOUNT_KRW 반영',
    묶음걷은서버.includes('벗에게 ${INVITE_DISCOUNT_KRW.toLocaleString(\'ko-KR\')}원 할인증표 보내고 그대도 역대급 보답을 받으시지요'));

  check('첫 화면 벗 증표 바도 마디째로만 줄이 바뀐다',
    serverSrc.includes('할인증표 보내고</span><br><span class="nb-brk">그대도 역대급 보답을 받으시지요'));

  check('마디 묶음에 줄바꿈 금지가 걸려 있다',
    /\.nb-brk\{[^}]*white-space:nowrap/.test(serverSrc));
}

// ── 8단계: 뒤로가기 제어 ──────────────────────────────────────────────
section('뒤로가기 제어 검증 (8단계)');

{
  const here = dirname(fileURLToPath(import.meta.url));
  const appJsCode = readFileSync(join(here, 'public', 'app.js'), 'utf8');
  const serverSrc = readFileSync(join(here, 'src', 'server.ts'), 'utf8');

  // 1. popstate 핸들러가 등록되어 있는지
  check('app.js에 popstate 이벤트 리스너가 등록되어 있다',
    appJsCode.includes("window.addEventListener('popstate'"));

  // 2. 단계 전환 시 history.pushState 호출하는지
  check('뷰어 열 때 history.pushState({ stage: \'viewer\' }) 호출',
    serverSrc.includes("history.pushState({ stage: 'viewer' }"));

  check('처소 열 때 history.pushState({ stage: \'chamber\' }) 호출',
    appJsCode.includes("history.pushState({ stage: 'chamber'"));

  check('사주 선택(맛보기) 열 때 history.pushState({ stage: \'select\' }) 호출',
    appJsCode.includes("history.pushState({ stage: 'select'"));

  // 3. popstate 시 각 단계의 닫기/복원 로직이 들어있는지
  check('popstate 시 뷰어 닫기 로직 포함',
    appJsCode.includes('closeFreeSaju'));

  check('popstate 시 처소 닫기 로직 포함',
    appJsCode.includes('closeChamber'));

  check('popstate 시 맛보기 패널 제거 로직 포함',
    appJsCode.includes('openPanel.remove()'));
}

// ── 9단계: 무의미한 늘봄 워터마크 정리 ──────────────────────────────
section('무의미한 늘봄 워터마크 정리 검증 (9단계)');

{
  const here = dirname(fileURLToPath(import.meta.url));
  const serverSrc = readFileSync(join(here, 'src', 'server.ts'), 'utf8');

  // 1. 화면 위를 둥둥 떠다니는 무의미한 워터마크 이미지 요소 제거
  check('대문/입장/메뉴판/처소 화면에 watermark-seal-cover 이미지가 없다',
    !serverSrc.includes('watermark-seal-cover'));

  check('화면 곳곳에 붓글씨 골드누끼 워터마크 이미지가 없다',
    !serverSrc.includes('늘봄붓글씨_골드누끼.png'));

  // 2. 메뉴판 위 불필요한 낙관 마크 제거
  check('메뉴판 상단에 무의미한 user-seal-mark 낙관이 없다',
    !serverSrc.includes('user-seal-mark'));

  // 3. 필수 요소(푸터 법적 정보, 상품명 등)는 온전히 보존
  check('푸터 회사 정보(.site-footer-wrapper)는 보존되어 있다',
    serverSrc.includes('class="site-footer-wrapper"'));
}

// ── 10단계: 작명서 라우트 및 메일 연동 검증 ──────────────────────
section('작명서 라우트 및 메일 연동 검증 (6·7·8단계)');

{
  const here = dirname(fileURLToPath(import.meta.url));
  const serverSrc = readFileSync(join(here, 'src', 'server.ts'), 'utf8');
  const mailSrc = readFileSync(join(here, 'src', 'mail.ts'), 'utf8');

  check('server.ts 에 /작명서/:id 라우트 핸들러가 등록되어 있다',
    serverSrc.includes("'GET /작명서/:id'"));
  check('server.ts 에 renderNamingCertificatePage 가 import 및 호출된다',
    serverSrc.includes('renderNamingCertificatePage'));
  check('mail.ts 에 작명 상품 시 certUrl (/작명서/) 구성이 포함되어 있다',
    mailSrc.includes('/작명서/'));
  check('mail.ts 에 「작명서 보기」 단추가 포함되어 있다',
    mailSrc.includes('작명서 보기') && mailSrc.includes('작명서 주소:'));
}


console.log(`통과 ${passed} / 실패 ${failed}${skipped ? ` / 건너뜀 ${skipped}` : ''}  ·  모델 호출 ${generateCalls}회(가짜) · 실제 결제 0건`);
if (failed) { console.log('\n실패 항목:'); for (const f of failures) console.log(`  - ${f}`); process.exit(1); }
console.log('전부 통과.');
process.exit(0);
