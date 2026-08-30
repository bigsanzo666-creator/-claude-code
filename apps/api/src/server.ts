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
  type BusinessInfo,
} from '../../../packages/site-policy/src/index.ts';
import { buildPayload, KIND_OF, type ReadingRequest } from './payload.ts';
import { buildPreview } from './preview.ts';

/** 주문 저장소. 배포 전에 Postgres 구현체로 갈아끼운다. */
export interface OrderStore {
  get(id: string): Promise<Order | null>;
  save(order: Order): Promise<void>;
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
  /** 생성된 리포트 본문 보관. 주문 id → 본문 */
  reports?: Map<string, string>;
  /** 포트원 상점 정보. 없으면 결제 기능이 꺼진 채로 뜬다 */
  checkout?: CheckoutConfig;
  /** 사업자 정보. 없으면 환경변수에서 읽는다 */
  business?: BusinessInfo;
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
function renderPage(checkout: CheckoutConfig | null, business: BusinessInfo): string {
  const fragment = readFileSync(VIEWER_PATH, 'utf8');
  const config = JSON.stringify({ apiBase: '', checkout, ready: checkout !== null });
  return `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>:root{color-scheme:light dark}body{margin:0}img{max-width:100%}[hidden]{display:none!important}
${FOOTER_CSS}</style>
<script>window.SAJU_CONFIG = ${config};</script>
<script src="https://cdn.portone.io/v2/browser-sdk.js"></script>
</head>
<body>
${fragment}
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
.biz{max-width:760px;margin:24px auto 0;padding:20px;border-top:1px solid #e3e3ea;color:#5c5c66;font:12.5px/1.7 -apple-system,BlinkMacSystemFont,"Apple SD Gothic Neo","Malgun Gothic",system-ui,sans-serif}
.biz-links{display:flex;gap:14px;margin-bottom:10px}
.biz-links a{color:#5b3fa8}
.biz-rows{display:flex;flex-wrap:wrap;gap:4px 14px}
.biz-rows b{font-weight:600;color:#1b1b1f}
.biz-note{margin-top:10px}
@media (prefers-color-scheme:dark){
.biz{border-top-color:#33333d;color:#a0a0ad}
.biz-links a{color:#b9a4f0}
.biz-rows b{color:#e8e8ee}
}`;

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
  const reports = deps.reports ?? new Map<string, string>();

  const checkout = deps.checkout ?? null;
  const business = deps.business ?? loadBusinessInfo();

  const routes: Record<string, (req: IncomingMessage, res: ServerResponse, id: string) => Promise<void>> = {
    /** 화면. 결제 설정을 주입해 내려준다 */
    'GET /': async (_req, res) => {
      const html = renderPage(checkout, business);
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
      reports.set(id, text);

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
      const text = reports.get(id);
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
      reports.delete(id);
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
