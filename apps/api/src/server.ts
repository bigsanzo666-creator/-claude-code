/**
 * 결제·리포트 API.
 *
 * 의존성을 주입받는 이유는 테스트다. 가짜 게이트웨이와 가짜 리포트 생성기를 꽂으면
 * 구매 흐름 전체를 돈 한 푼 없이 돌려볼 수 있다.
 *
 * 프레임워크를 쓰지 않은 이유: 라우트가 일곱 개뿐이고, 의존성이 적을수록
 * 배포와 보안 관리가 단순해진다. 라우트가 늘면 그때 바꾸면 된다.
 */

import { createServer as createHttpServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import {
  CATALOG, getProduct, createOrder, markPending, markFulfilled, markViewed,
  hasEntitlement, assessRefund, refundNotice, confirmPayment, refundOrder, failOrder,
  WITHDRAWAL_NOTICE, type Order, type PaymentGateway, type ProductId,
} from '../../../packages/commerce/src/index.ts';
import { cacheKey } from '../../../packages/report/src/cache.ts';
import {
  loadBusinessInfo, renderFooter, renderTerms, renderPrivacy, renderRefund,
  renderProducts, renderProductsPage, PRODUCTS_CSS,
  renderHero, renderTryHeading, LANDING_CSS, FONT_LINK, renderProductPage,
  renderSpiritRow,
  type BusinessInfo,
} from '../../../packages/site-policy/src/index.ts';
import {
  findProductImages, findHeroImage, findHeroVideo, findSpiritImages, type ProductImage,
} from './images.ts';
import { buildPayload, KIND_OF, type ReadingRequest } from './payload.ts';
import { buildPreview } from './preview.ts';

/** 주문 저장소. 배포 전에 Postgres 구현체로 갈아끼운다. */
export interface OrderStore {
  get(id: string): Promise<Order | null>;
  save(order: Order): Promise<void>;
}

/**
 * 리포트 본문 보관.
 *
 * 메모리(Map)와 Postgres 두 가지를 같은 얼굴로 다루기 위한 것이다.
 * 라우트가 저장 방식을 알 필요는 없다.
 */
export interface ReportBox {
  get(orderId: string): Promise<string | null>;
  set(orderId: string, inputHash: string, body: string): Promise<void>;
  delete(orderId: string): Promise<void>;
}

export class MemoryReportBox implements ReportBox {
  private map = new Map<string, string>();
  async get(id: string) { return this.map.get(id) ?? null; }
  async set(id: string, _hash: string, body: string) { this.map.set(id, body); }
  async delete(id: string) { this.map.delete(id); }
}

export class MemoryOrderStore implements OrderStore {
  private store = new Map<string, Order>();
  async get(id: string) { return this.store.get(id) ?? null; }
  async save(order: Order) { this.store.set(order.id, order); }
}

/** 리포트 생성기. 실제로는 @saju/report 의 generateReport 를 감싼다. */
export type ReportGenerator = (args: {
  kind: string; data: unknown; subject: string;
}) => Promise<{ text: string }>;

/** 브라우저 결제창에 필요한 값. 비어 있으면 화면이 결제 버튼을 감춘다 */
export interface CheckoutConfig {
  storeId: string;
  channelKey: string;
}

export interface ApiDeps {
  gateway: PaymentGateway;
  orders: OrderStore;
  generate: ReportGenerator;
  /** 생성된 리포트 본문 보관. 없으면 메모리에 담는다 */
  reportStore?: ReportBox | null;
  /** 포트원 상점 정보. 없으면 결제 기능이 꺼진 채로 뜬다 */
  checkout?: CheckoutConfig;
  /** 사업자 정보. 없으면 환경변수에서 읽는다 */
  business?: BusinessInfo;
  /** 상품 그림. 없으면 기동할 때 public 폴더를 훑는다 */
  images?: Map<string, ProductImage>;
  /** 첫 화면에 깔 그림. `null` 이면 종이색 바탕으로 뜬다 */
  heroImage?: ProductImage | null;
  /** 첫 화면에 트는 영상. `null` 이면 그림만 뜬다 */
  heroVideo?: ProductImage | null;
  /** 신령 얼굴 그림. 없으면 기동할 때 public 폴더를 훑는다 */
  spiritImages?: Map<string, ProductImage>;
}

const HERE = dirname(fileURLToPath(import.meta.url));
const VIEWER_PATH = join(HERE, '..', '..', 'manse-viewer', 'index.html');

/**
 * 화면 HTML을 만든다.
 *
 * `apps/manse-viewer/index.html` 은 문서 조각이다 — 아티팩트로 게시할 때는
 * 바깥 껍데기를 플랫폼이 씌워준다. 우리가 직접 서빙할 때는 여기서 씌운다.
 * 덕분에 같은 파일이 무료 데모(아티팩트)와 실제 사이트 양쪽에서 쓰인다.
 */
function renderPage(
  checkout: CheckoutConfig | null, business: BusinessInfo, images: ReadonlySet<string>,
  hero = false, heroVideo = false, faces: ReadonlySet<string> = new Set(),
): string {
  const fragment = readFileSync(VIEWER_PATH, 'utf8');
  const config = JSON.stringify({ apiBase: '', checkout, ready: checkout !== null });
  return `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
${FONT_LINK}
<style>:root{color-scheme:light dark}body{margin:0}img{max-width:100%}[hidden]{display:none!important}
${LANDING_CSS}
${PRODUCTS_CSS}
${FOOTER_CSS}</style>
<script>window.SAJU_CONFIG = ${config};</script>
<script src="https://cdn.portone.io/v2/browser-sdk.js"></script>
</head>
<body>
${renderHero(business, checkout !== null, hero, heroVideo)}
${renderSpiritRow(faces)}
${renderProducts(checkout !== null, images, faces)}
${renderTryHeading()}
${fragment}
<style>${VIEWER_SKIN}</style>
${renderFooter(business)}
</body>
</html>`;
}

/**
 * 푸터 스타일.
 *
 * 정책 페이지는 자기 스타일을 들고 다니지만, 본 화면의 껍데기는 여기서 씌우므로
 * 푸터 몫만 따로 둔다. 아티팩트로 게시하는 무료 데모에는 푸터가 붙지 않는다 —
 * 거기서는 파는 것이 없으므로 사업자 정보 표시 의무도 없다.
 */
const FOOTER_CSS = `
.biz{max-width:1080px;margin:56px auto 0;padding:22px;border-top:1px solid var(--nb-line-soft);
  color:var(--nb-ink-3);font:12.5px/1.7 var(--nb-sans)}
.biz-links{display:flex;gap:16px;margin-bottom:10px}
.biz-links a{color:var(--nb-gold)}
.biz-rows{display:flex;flex-wrap:wrap;gap:4px 14px}
.biz-rows b{font-weight:600;color:var(--nb-ink-2)}
.biz-note{margin-top:10px}`;

/**
 * 무료 만세력 화면의 색을 우리 색으로 맞춘다.
 *
 * 그 화면은 아티팩트로 따로 게시하는 물건이라 자기 색을 들고 다닌다 —
 * 차가운 회색 바탕이다. 한 페이지 안에서 위는 한지색이고 가운데만 회색이면
 * 서로 다른 사이트를 이어 붙인 것처럼 보인다.
 *
 * 조각의 `:root` 가 우리 것보다 뒤에 오므로 여기서 다시 덮는다. 조각 자체는
 * 손대지 않는다 — 아티팩트로 나갈 때는 원래 색 그대로여야 한다.
 *
 * 오행 다섯 색과 도장의 붉은색은 그대로 둔다. 뜻이 있는 색이다.
 */
const VIEWER_SKIN = `
:root{
  --paper:var(--nb-paper); --surface:var(--nb-paper-2); --surface-2:var(--nb-paper-2);
  --ink:var(--nb-ink); --ink-2:var(--nb-ink-2); --ink-3:var(--nb-ink-3);
  --rule:var(--nb-line); --rule-soft:var(--nb-line-soft);
  --field:var(--nb-paper-2);
}
/* 조각 안에 색이 직접 박힌 두 곳. 보라색 알약 버튼 하나가 화면 전체를 싸구려로 만든다 */
.wiz-next{background:var(--nb-ink);color:var(--nb-paper-2);border-radius:0;letter-spacing:.02em}
.wiz-dot.on{background:var(--nb-gold)}

/* 얼굴·손금을 고르는 칸의 배치가 깨져 있다.
   fg 는 두 칸 격자인데 seg 에 grid-row:1/span 2 가 붙어 있다. 행이 정해진 항목이
   먼저 놓이므로 버튼이 왼쪽 첫 칸을 차지하고, 이름표가 오른쪽으로 밀려난다.
   버튼 칸은 1fr 이라 옆에 빈자리까지 남는다.
   조각은 아티팩트로도 나가므로 손대지 않고 여기서 한 줄짜리로 세워 준다 —
   이름표 · 고르는 버튼 · 명리 용어 순서로 위에서 아래로 읽힌다. */
.fg{grid-template-columns:1fr;gap:.3rem}
.fg > .seg{grid-row:auto;width:fit-content;max-width:100%;flex-wrap:wrap}

/* 여기부터는 「행정 서식」을 위쪽 화면과 한 가족으로 만드는 손질이다.
   붉은색은 남겨 둔다 — 오류·경고·불리처럼 **뜻이 있는 자리**에 쓰이고 있어서,
   금색으로 바꾸면 나쁜 소식이 좋은 소식처럼 보인다. 손대는 것은 껍데기뿐이다. */
.tabs{width:100%}
.tab{flex:1;white-space:nowrap;font-size:.86rem}
.tab.on{color:var(--nb-gold);box-shadow:inset 0 -2px 0 var(--nb-gold)}
.seg button.on{background:transparent;color:var(--nb-gold);box-shadow:inset 0 -2px 0 var(--nb-gold)}
button.pay{background:var(--nb-ink);color:var(--nb-paper-2);border-radius:0;letter-spacing:.02em}
input,select,textarea{border-radius:0;border-color:var(--nb-line)}
input:focus-visible,select:focus-visible,button:focus-visible{outline-color:var(--nb-gold)}
/* 대문자 영문 모노 라벨은 서식 서류의 인상을 준다. 위쪽 금색 라벨과 같은 결로 맞춘다 */
.label,.who{font-family:var(--nb-sans);text-transform:none;letter-spacing:.16em;color:var(--nb-gold)}
.f > .label{color:var(--nb-ink-3);letter-spacing:.04em;font-size:.78rem}
.seal{border-color:var(--nb-gold);color:var(--nb-gold);border-radius:0;border-width:1px}
.pro{border-color:var(--nb-gold)}
.pro::before{background:var(--nb-gold);color:var(--nb-paper-2)}`;

class HttpError extends Error {
  readonly status: number;
  constructor(status: number, message: string) { super(message); this.status = status; }
}

async function readJson(req: IncomingMessage): Promise<any> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 256 * 1024) throw new HttpError(413, '요청이 너무 큽니다.');
    chunks.push(chunk as Buffer);
  }
  if (!chunks.length) return {};
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); }
  catch { throw new HttpError(400, '본문이 올바른 JSON이 아닙니다.'); }
}

function send(res: ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(payload),
  });
  res.end(payload);
}

function sendHtml(res: ServerResponse, html: string): void {
  res.writeHead(200, {
    'Content-Type': 'text/html; charset=utf-8',
    'Content-Length': Buffer.byteLength(html),
  });
  res.end(html);
}

function validateReading(body: any): ReadingRequest {
  if (!body || typeof body !== 'object') throw new HttpError(400, '요청 본문이 필요합니다.');
  const productId = body.productId as ProductId;
  if (!CATALOG[productId]) throw new HttpError(400, `알 수 없는 상품입니다: ${body.productId}`);
  if (!body.birth?.date) throw new HttpError(400, '생년월일이 필요합니다.');
  return body as ReadingRequest;
}

export function createApi(deps: ApiDeps) {
  const reports: ReportBox = deps.reportStore ?? new MemoryReportBox();

  const checkout = deps.checkout ?? null;
  const business = deps.business ?? loadBusinessInfo();
  // 기동할 때 한 번만 훑는다. 그림은 배포로만 바뀐다
  const images = deps.images ?? findProductImages();
  const haveImage = new Set(images.keys());
  const hero = deps.heroImage !== undefined ? deps.heroImage : findHeroImage();
  const heroVideo = deps.heroVideo !== undefined ? deps.heroVideo : findHeroVideo();
  // 신령 얼굴도 같이 훑는다. 없는 얼굴은 한자 도장으로 나가므로 몇 장이든 상관없다
  const spirits = deps.spiritImages ?? findSpiritImages();
  const haveFace = new Set(spirits.keys());

  const routes: Record<string, (req: IncomingMessage, res: ServerResponse, id: string) => Promise<void>> = {
    /** 화면. 결제 설정을 주입해 내려준다 */
    'GET /': async (_req, res) => {
      const html = renderPage(checkout, business, haveImage, hero !== null, heroVideo !== null, haveFace);
      res.writeHead(200, {
        'Content-Type': 'text/html; charset=utf-8',
        'Content-Length': Buffer.byteLength(html),
      });
      res.end(html);
    },

    /** 결제 준비 상태. 상점 정보가 없으면 화면이 결제 버튼을 감춘다 */
    'GET /api/config': async (_req, res) => {
      send(res, 200, { ready: checkout !== null, checkout });
    },

    /**
     * 살아 있는지 확인하는 자리.
     *
     * 배포 플랫폼이 여기를 주기적으로 두드려서, 죽으면 다시 띄운다.
     * 화면을 렌더링하지 않으므로 파일을 읽지 않는다 — 헬스체크가 디스크를
     * 건드리면 그 자체가 장애 원인이 된다.
     */
    'GET /healthz': async (_req, res) => {
      send(res, 200, { ok: true, payments: checkout !== null });
    },

    /**
     * 정책 페이지 세 장.
     *
     * PG 심사에서 실제로 열어보는 주소다. 결제 화면 안의 팝업이 아니라
     * 고정된 주소로 접근되어야 하므로 라우트로 둔다.
     */
    /**
     * 상품·가격 전용 페이지.
     *
     * 첫 화면에도 같은 내용이 붙지만, 심사가 곧바로 열어볼 수 있는 주소를
     * 따로 둔다. 「상품 등록 유무」는 자동 검사 항목이라 찾기 쉬워야 한다.
     */
    /**
     * 상품 하나짜리 페이지.
     *
     * 카드사 등록심사가 "상품을 클릭했을 때 상세페이지가 제대로 되어 있는가"를
     * 본다. 목록에 설명이 다 있어도 들어갈 곳이 없으면 걸린다.
     */
    'GET /products/:id': async (_req, res, id) => {
      const product = CATALOG[id as ProductId];
      if (!product) throw new HttpError(404, `없는 상품입니다: ${id}`);
      sendHtml(res, renderProductPage(
        product, business, checkout !== null, renderFooter(business), haveImage, haveFace,
      ));
    },

    /**
     * 상품 그림.
     *
     * 확장자 없는 주소로 받는다. 그록이 무엇을 뱉든 파일 이름만 상품 아이디에
     * 맞추면 되고, 나중에 jpg를 webp로 바꿔도 화면 쪽은 손댈 것이 없다.
     *
     * 요청에서 온 문자열로 경로를 만들지 않는다. 기동할 때 카탈로그와 대조해
     * 만들어 둔 표에서 꺼내 쓸 뿐이라 경로 조작이 성립하지 않는다.
     */
    'GET /img/products/:id': async (_req, res, id) => {
      const image = images.get(id);
      if (!image) throw new HttpError(404, `그림이 없습니다: ${id}`);
      const body = readFileSync(image.path);
      res.writeHead(200, {
        'Content-Type': image.type,
        'Content-Length': body.length,
        // 한 시간. 그림을 다시 뽑아 올려도 오래 묵지 않는다
        'Cache-Control': 'public, max-age=3600',
      });
      res.end(body);
    },

    /**
     * 신령 얼굴.
     *
     * 상품 그림과 똑같은 방식이다 — 기동할 때 만들어 둔 표에서만 꺼내므로
     * 요청 문자열로 파일을 찾는 일이 없다.
     */
    'GET /img/spirits/:id': async (_req, res, id) => {
      const image = spirits.get(id);
      if (!image) throw new HttpError(404, `신령 그림이 없습니다: ${id}`);
      const body = readFileSync(image.path);
      res.writeHead(200, {
        'Content-Type': image.type,
        'Content-Length': body.length,
        'Cache-Control': 'public, max-age=3600',
      });
      res.end(body);
    },

    /** 첫 화면에 까는 그림. 상품이 아니므로 주소도 따로 둔다 */
    'GET /img/hero': async (_req, res) => {
      if (!hero) throw new HttpError(404, '첫 화면 그림이 없습니다.');
      const body = readFileSync(hero.path);
      res.writeHead(200, {
        'Content-Type': hero.type,
        'Content-Length': body.length,
        'Cache-Control': 'public, max-age=3600',
      });
      res.end(body);
    },

    /**
     * 첫 화면 영상.
     *
     * 브라우저는 영상을 통째로 받지 않고 조각내어 요청한다(Range). 그것을
     * 받아 주지 않으면 어떤 브라우저는 아예 재생을 시작하지 않는다.
     */
    'GET /video/hero': async (req, res) => {
      if (!heroVideo) throw new HttpError(404, '첫 화면 영상이 없습니다.');
      const body = readFileSync(heroVideo.path);
      const range = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range ?? '');
      const head = {
        'Content-Type': heroVideo.type,
        'Cache-Control': 'public, max-age=3600',
        'Accept-Ranges': 'bytes',
      };
      if (!range) {
        res.writeHead(200, { ...head, 'Content-Length': body.length });
        res.end(body);
        return;
      }
      const start = range[1] ? Number(range[1]) : 0;
      const end = range[2] ? Math.min(Number(range[2]), body.length - 1) : body.length - 1;
      if (!(start >= 0 && start <= end && end < body.length)) {
        res.writeHead(416, { ...head, 'Content-Range': `bytes */${body.length}` });
        res.end();
        return;
      }
      const slice = body.subarray(start, end + 1);
      res.writeHead(206, {
        ...head,
        'Content-Range': `bytes ${start}-${end}/${body.length}`,
        'Content-Length': slice.length,
      });
      res.end(slice);
    },

    'GET /products': async (_req, res) =>
      sendHtml(res, renderProductsPage(
        business, checkout !== null, renderFooter(business), haveImage, haveFace,
      )),

    'GET /terms': async (_req, res) => sendHtml(res, renderTerms(business)),
    'GET /privacy': async (_req, res) => sendHtml(res, renderPrivacy(business)),
    'GET /refund': async (_req, res) => sendHtml(res, renderRefund(business)),

    /** 상품 목록. 가격은 서버가 정한다 */
    'GET /api/products': async (_req, res) => {
      send(res, 200, { products: Object.values(CATALOG), notice: WITHDRAWAL_NOTICE });
    },

    /**
     * 결제 전 미리보기. 모델을 부르지 않으므로 원가가 없다.
     * 전자상거래법상 "시험 사용 상품 제공" 요건을 채우는 자리이기도 하다.
     */
    'POST /api/preview': async (req, res) => {
      const reading = validateReading(await readJson(req));
      const product = getProduct(reading.productId);
      const { data } = buildPayload(reading);
      send(res, 200, {
        product,
        notice: WITHDRAWAL_NOTICE,
        preview: buildPreview(reading.productId, data, product.previewRatio),
      });
    },

    /**
     * 주문 생성.
     * 금액은 클라이언트가 보낸 값을 쓰지 않고 카탈로그에서 가져온다.
     * 고지와 미리보기를 실제로 제공했는지 여부를 주문에 남겨, 나중에 환불 판정에 쓴다.
     */
    'POST /api/orders': async (req, res) => {
      const body = await readJson(req);
      const reading = validateReading(body);
      if (body.acknowledgedNotice !== true) {
        throw new HttpError(400, '청약철회 제한 고지에 대한 확인이 필요합니다.');
      }
      const { kind, data, subject } = buildPayload(reading);
      const inputHash = cacheKey({
        input: { kind: kind as any, data, subject },
        model: 'claude-opus-5',
        effort: 'medium',
      });

      const order = createOrder({
        id: `ord_${randomUUID()}`,
        productId: reading.productId,
        inputHash,
        noticeGiven: true,
        previewProvided: body.previewShown === true,
      });
      await deps.orders.save({ ...order, ...({ reading } as any) });
      send(res, 201, {
        order,
        // 포트원은 결제 식별자를 우리가 정한다. 주문 id를 그대로 쓴다
        paymentId: order.id,
        amountKrw: order.amountKrw,
        notice: WITHDRAWAL_NOTICE,
      });
    },

    /** 결제창을 띄우기 직전 */
    'POST /api/orders/:id/pending': async (req, res, id) => {
      const order = await mustGet(id);
      const updated = markPending(order, id);
      await save(order, updated);
      send(res, 200, { order: strip(updated) });
    },

    /**
     * 결제 확인 → 리포트 생성.
     * PG에 직접 물어보고, 금액과 주문번호를 대조한 뒤에만 리포트를 만든다.
     */
    'POST /api/orders/:id/confirm': async (req, res, id) => {
      const body = await readJson(req);
      const stored = await mustGet(id);
      const paymentId = String(body.paymentId ?? id);

      let paid: Order;
      try {
        paid = await confirmPayment(stored, deps.gateway, paymentId);
      } catch (error) {
        const reason = error instanceof Error ? error.message : '알 수 없는 오류';
        if (stored.status === 'created' || stored.status === 'pending') {
          await save(stored, failOrder(stored, reason));
        }
        throw new HttpError(402, reason);
      }

      const reading = (stored as any).reading as ReadingRequest;
      const { kind, data, subject } = buildPayload(reading);
      const { text } = await deps.generate({ kind, data, subject });
      await reports.set(id, stored.inputHash, text);

      const done = markFulfilled(paid);
      await save(stored, done);
      send(res, 200, { order: strip(done), ready: true });
    },

    /**
     * 리포트 전문.
     * 이용권을 확인하고, 열람 시점을 기록한다 — 청약철회 제한의 기준점이다.
     */
    'GET /api/orders/:id/report': async (_req, res, id) => {
      const stored = await mustGet(id);
      if (!hasEntitlement(stored, stored.inputHash)) {
        throw new HttpError(403, '결제가 확인되지 않았거나 환불된 주문입니다.');
      }
      const text = await reports.get(id);
      if (!text) throw new HttpError(409, '리포트가 아직 준비되지 않았습니다.');

      const viewed = stored.status === 'viewed' ? stored : markViewed(stored);
      await save(stored, viewed);
      send(res, 200, { text, order: strip(viewed) });
    },

    /** 환불 가능 여부만 조회. 실제로 취소하지 않는다 */
    'GET /api/orders/:id/refund': async (_req, res, id) => {
      const order = await mustGet(id);
      const verdict = assessRefund(order);
      send(res, 200, { verdict, message: refundNotice(verdict) });
    },

    'POST /api/orders/:id/refund': async (_req, res, id) => {
      const stored = await mustGet(id);
      const verdict = assessRefund(stored);
      if (!verdict.refundable) throw new HttpError(409, verdict.reason);

      const outcome = await refundOrder(stored, deps.gateway);
      await save(stored, outcome.order);
      await reports.delete(id);
      send(res, 200, {
        order: strip(outcome.order),
        refundedKrw: outcome.cancelledAmountKrw,
        message: refundNotice(outcome.verdict),
      });
    },
  };

  async function mustGet(id: string): Promise<Order> {
    const order = await deps.orders.get(id);
    if (!order) throw new HttpError(404, '주문을 찾을 수 없습니다.');
    return order;
  }
  /** 내부 보관 필드(reading)를 유지하면서 저장한다 */
  async function save(previous: Order, next: Order): Promise<void> {
    await deps.orders.save({ ...next, ...({ reading: (previous as any).reading } as any) });
  }
  /** 응답에서 내부 필드를 뺀다 */
  function strip(order: Order): Order {
    const { ...rest } = order as any;
    delete rest.reading;
    return rest;
  }

  return async function handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
    try {
      const url = new URL(req.url ?? '/', 'http://localhost');
      const parts = url.pathname.split('/').filter(Boolean); // api, orders, :id, action
      let key = `${req.method} ${url.pathname}`;
      let id = '';

      if (parts[0] === 'api' && parts[1] === 'orders' && parts[2]) {
        id = parts[2];
        key = `${req.method} /api/orders/:id${parts[3] ? `/${parts[3]}` : ''}`;
      } else if (parts[0] === 'products' && parts[1] && !parts[2]) {
        id = parts[1];
        key = `${req.method} /products/:id`;
      } else if (parts[0] === 'img' && parts[1] === 'products' && parts[2] && !parts[3]) {
        id = parts[2];
        key = `${req.method} /img/products/:id`;
      } else if (parts[0] === 'img' && parts[1] === 'spirits' && parts[2] && !parts[3]) {
        id = parts[2];
        key = `${req.method} /img/spirits/:id`;
      }

      const route = routes[key];
      if (!route) throw new HttpError(404, `없는 경로입니다: ${req.method} ${url.pathname}`);
      await route(req, res, id);
    } catch (error) {
      const status = error instanceof HttpError ? error.status : 500;
      const message = error instanceof Error ? error.message : '서버 오류';
      if (status === 500) console.error('[api]', error);
      send(res, status, { error: message });
    }
  };
}

export function startApi(deps: ApiDeps, port = Number(process.env.PORT ?? 3000)) {
  const server = createHttpServer(createApi(deps));
  server.listen(port, () => console.log(`[api] http://localhost:${port}`));
  return server;
}
