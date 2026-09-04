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
  PACKAGES, bundleMath, orderable, upsellFor,
} from '../../packages/commerce/src/index.ts';
import { loadBusinessInfo, SPIRITS } from '../../packages/site-policy/src/index.ts';
import { findSpiritVideos } from './src/images.ts';
import { createApi, MemoryOrderStore } from './src/server.ts';
import { StandbyGateway, standbyGenerate } from './src/standby.ts';

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

const page = async (path: string) => {
  const res = await fetch(`${base}${path}`);
  return { status: res.status, type: res.headers.get('content-type') ?? '', html: await res.text() };
};

const BIRTH = { date: '1990-05-15', time: '14:30', gender: '남' as const, name: '민수' };
const reading = { productId: 'cross-report', birth: BIRTH };

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
  const one = await page('/products/wealth-report');
  check('상세페이지에 가격이 실판매가로 나온다', one.html.includes('6,900원'));
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
  const spImg = await get('/img/spirits/flower');
  check('신령 얼굴을 200으로 준다', spImg.status === 200
    && spImg.headers.get('content-type') === 'image/png');
  await spImg.arrayBuffer();
  check('얼굴 없는 신령은 404', (await get('/img/spirits/moon')).status === 404);
  check('신령 주소도 경로를 거슬러 올라갈 수 없다',
    (await get('/img/spirits/..%2F..%2Fetc%2Fpasswd')).status === 404);

  check('카탈로그에 없는 아이디도 404', (await get('/img/products/nope')).status === 404);
  // 요청 문자열로 경로를 만들지 않으므로 애초에 성립하지 않는다
  check('경로를 거슬러 올라갈 수 없다',
    (await get('/img/products/..%2F..%2Fetc%2Fpasswd')).status === 404);

  // 손님이 첫 화면에서 신령을 먼저 만나고, 상품 칸에서 다시 만나야 가게가 된다
  const home = await get('/').then((r) => r.text());
  check('첫 화면에 신령 일곱이 선다',
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
  check('「대표」 직책 표기', f.includes('<b>대표</b>'));
  // 유선전화가 있으면 그 이름으로, 없으면 휴대폰을 「연락처」로. 둘 중 하나는 반드시 있어야 한다
  check('전화 항목이 있다', f.includes('<b>유선전화</b>') || f.includes('<b>연락처</b>'));
  check('휴대폰을 유선전화라고 적지 않는다',
    !(f.includes('<b>유선전화</b>') && /<b>유선전화<\/b> 01[016789]/.test(f)));
  // 카드사 심사는 상세페이지에서 언제·어떻게 받고 어떻게 무르는지를 본다
  const d = (await page('/products/wealth-report')).html;
  check('상세페이지에 받는 시기가 적혀 있다', d.includes('언제 받나요'));
  check('상세페이지에 받는 방법이 적혀 있다', d.includes('어떻게 받나요'));
  check('상세페이지에 무르는 방법이 적혀 있다', d.includes('무르고 싶으면'));
}

const home = await page('/');
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
check('색이 토큰 한 곳에서 나온다', home.html.includes('--nb-ink:#1B2A45'));
// 폰을 어둡게 쓰는 손님에게도 같은 한지 한 벌이 나가야 한다
check('밝은 쪽 하나로 못 박는다',
  home.html.includes('color-scheme:light') && !home.html.includes('prefers-color-scheme:dark'));
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
  check('결제 확인·리포트 생성', confirmed.status === 200 && confirmed.body.ready === true);

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


// ── H. 묶음 사기 ────────────────────────────────────────────────
section('H. 묶음도 살 수 있다');

const PACK = 'samhap-pack';
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
check('묶음 결제가 확정된다', packDone.status === 200 && packDone.body.order.status === 'fulfilled',
  packDone.body.error);
check('편 수만큼 만든다', generateCalls === before + pack.members.length,
  `${generateCalls - before}편`);

const packReport = await api('GET', `/api/orders/${packId}/report`);
check('한 벌로 붙여 준다', packReport.status === 200);
check('편마다 제목이 붙는다',
  pack.members.every((m) => packReport.body.text.includes(`# ${CATALOG[m].name}`)));

// 주문은 한 건, 이용권도 하나. 환불·열람 규칙을 건드리지 않았다
check('묶음도 주문은 한 건', typeof packReport.body.order.id === 'string');

const badPack = await api('POST', '/api/orders',
  { productId: 'no-such-pack', birth: BIRTH, acknowledgedNotice: true });
check('없는 묶음은 거부', badPack.status === 400);

server.close();
console.log(`\n${'═'.repeat(60)}`);
console.log(`통과 ${passed} / 실패 ${failed}  ·  모델 호출 ${generateCalls}회(가짜) · 실제 결제 0건`);
if (failed) { console.log('\n실패 항목:'); for (const f of failures) console.log(`  - ${f}`); process.exit(1); }
console.log('전부 통과.');
