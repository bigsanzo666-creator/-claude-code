/**
 * 브라우저 결제 흐름.
 *
 * 결제창을 띄우는 함수(`pay`)와 서버 호출(`fetchImpl`)을 주입받는다.
 * 그래야 진짜 결제창 없이도 흐름 전체를 테스트할 수 있다 —
 * 사용자가 창을 닫았을 때, 카드사에서 거절당했을 때, 서버 검증이 실패했을 때까지.
 *
 * 이 파일은 DOM을 만지지 않는다. 화면은 이 결과를 받아 그리기만 한다.
 */

export interface PayRequest {
  storeId: string;
  channelKey: string;
  paymentId: string;
  orderName: string;
  totalAmount: number;
  currency: 'CURRENCY_KRW';
  payMethod: 'CARD';
}

/** 포트원 SDK 응답. 실패하면 code가 채워진다 */
export interface PayResponse {
  code?: string;
  message?: string;
  paymentId?: string;
}

export interface CheckoutConfig {
  storeId: string;
  channelKey: string;
}

export interface CheckoutDeps {
  apiBase: string;
  config: CheckoutConfig;
  fetchImpl?: typeof fetch;
  pay: (req: PayRequest) => Promise<PayResponse>;
}

export interface PreviewResult {
  product: { id: string; name: string; priceKrw: number; description: string };
  notice: string;
  preview: { contents: string[]; sample: string; sampleNotice: string };
}

export type CheckoutStage =
  | 'preview' | 'order' | 'payment' | 'confirm' | 'report' | 'done';

/** 어느 단계에서 무슨 이유로 멈췄는지 남긴다. CS에서 이게 없으면 아무것도 못 한다 */
export class CheckoutError extends Error {
  readonly stage: CheckoutStage;
  readonly cancelled: boolean;
  constructor(stage: CheckoutStage, message: string, cancelled = false) {
    super(message);
    this.name = 'CheckoutError';
    this.stage = stage;
    this.cancelled = cancelled;
  }
}

export interface PurchaseResult {
  orderId: string;
  text: string;
  amountKrw: number;
}

export class Checkout {
  private readonly deps: CheckoutDeps;
  private readonly fetchImpl: typeof fetch;

  constructor(deps: CheckoutDeps) {
    this.deps = deps;
    // 브라우저의 fetch는 window에 바인딩돼 있어야 한다.
    // 그냥 참조만 넘기면 "Illegal invocation"으로 죽는다 — Node에서는 안 나는 오류라
    // 브라우저에서 돌려보기 전까지 드러나지 않는다.
    this.fetchImpl = deps.fetchImpl ?? globalThis.fetch.bind(globalThis);
  }

  private async call(path: string, init?: RequestInit): Promise<any> {
    const res = await this.fetchImpl(`${this.deps.apiBase}${path}`, {
      ...init,
      headers: init?.body ? { 'Content-Type': 'application/json' } : undefined,
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body?.error ?? `요청이 실패했습니다 (${res.status})`);
    return body;
  }

  /** 결제 전 미리보기. 서버가 모델을 부르지 않으므로 무료다 */
  async preview(reading: unknown): Promise<PreviewResult> {
    try {
      return await this.call('/api/preview', { method: 'POST', body: JSON.stringify(reading) });
    } catch (error) {
      throw new CheckoutError('preview', (error as Error).message);
    }
  }

  /**
   * 주문 → 결제창 → 검증 → 리포트.
   *
   * 각 단계마다 `onStage`로 진행 상황을 알린다. 결제창이 뜬 뒤 확정까지
   * 몇 초 걸리는데, 그 사이 화면이 멈춰 있으면 사용자는 실패한 줄 안다.
   */
  async purchase(
    reading: { productId: string; [k: string]: unknown },
    options: { previewShown: boolean; onStage?: (stage: CheckoutStage) => void } ,
  ): Promise<PurchaseResult> {
    const notify = options.onStage ?? (() => {});

    notify('order');
    let created: any;
    try {
      created = await this.call('/api/orders', {
        method: 'POST',
        body: JSON.stringify({ ...reading, acknowledgedNotice: true, previewShown: options.previewShown }),
      });
    } catch (error) {
      throw new CheckoutError('order', (error as Error).message);
    }

    const orderId: string = created.order.id;
    const amountKrw: number = created.order.amountKrw;
    const orderName: string = created.order.productId;

    // 결제창을 띄우기 직전임을 서버에 알린다. 실패해도 결제는 진행한다
    await this.call(`/api/orders/${orderId}/pending`, { method: 'POST' }).catch(() => {});

    notify('payment');
    let result: PayResponse;
    try {
      result = await this.deps.pay({
        storeId: this.deps.config.storeId,
        channelKey: this.deps.config.channelKey,
        paymentId: orderId,
        orderName,
        totalAmount: amountKrw,
        currency: 'CURRENCY_KRW',
        payMethod: 'CARD',
      });
    } catch (error) {
      throw new CheckoutError('payment', (error as Error).message);
    }

    // 포트원은 실패 시 code를 채운다. 사용자가 창을 닫은 것도 여기로 온다
    if (result.code !== undefined) {
      throw new CheckoutError('payment', result.message ?? '결제가 취소되었습니다.', true);
    }

    notify('confirm');
    try {
      await this.call(`/api/orders/${orderId}/confirm`, {
        method: 'POST',
        body: JSON.stringify({ paymentId: result.paymentId ?? orderId }),
      });
    } catch (error) {
      // 결제는 됐는데 확정이 실패한 경우다. 사용자에게 주문번호를 반드시 알려야 한다
      throw new CheckoutError(
        'confirm',
        `${(error as Error).message}\n결제는 완료되었을 수 있습니다. 주문번호 ${orderId}로 문의해 주십시오.`,
      );
    }

    notify('report');
    let report: any;
    try {
      report = await this.call(`/api/orders/${orderId}/report`);
    } catch (error) {
      throw new CheckoutError('report', (error as Error).message);
    }

    notify('done');
    return { orderId, text: report.text, amountKrw };
  }

  /** 환불 가능 여부 조회. 실제로 취소하지 않는다 */
  async refundStatus(orderId: string): Promise<{ refundable: boolean; message: string }> {
    const body = await this.call(`/api/orders/${orderId}/refund`);
    return { refundable: body.verdict.refundable, message: body.message };
  }

  async requestRefund(orderId: string): Promise<{ refundedKrw: number; message: string }> {
    return this.call(`/api/orders/${orderId}/refund`, { method: 'POST' });
  }
}

/** 포트원 브라우저 SDK를 감싼다. SDK가 없으면 즉시 알려준다 */
export function portOnePay(): (req: PayRequest) => Promise<PayResponse> {
  return async (req) => {
    const sdk = (globalThis as any).PortOne;
    if (!sdk?.requestPayment) {
      throw new Error('결제 모듈을 불러오지 못했습니다. 새로고침 후 다시 시도해 주십시오.');
    }
    return sdk.requestPayment(req);
  };
}
