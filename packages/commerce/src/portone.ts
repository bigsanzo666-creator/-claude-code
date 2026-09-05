/**
 * 포트원(PortOne) V2 어댑터.
 *
 * 포트원을 고른 이유: 어그리게이터라 한 번 붙이면 카드·간편결제가 함께 따라온다.
 * 1인 운영에서는 PG마다 따로 심사받고 따로 붙이는 비용이 실제로 크다.
 *
 * 인증 흐름 (V2 공식 문서 기준):
 *   POST https://api.portone.io/login/api-secret  { apiSecret }  → { accessToken, refreshToken }
 *   GET  https://api.portone.io/payments/{paymentId}  Authorization: Bearer {accessToken}
 *
 * API Secret은 서버에만 둔다. 브라우저로 내려가면 그 순간 끝이다.
 */

import type { CancelResult, PaymentGateway, PaymentRecord, PaymentStatus } from './gateway.ts';

const DEFAULT_BASE_URL = 'https://api.portone.io';

/** 포트원 결제 상태 → 우리 상태 */
function mapStatus(raw: string): PaymentStatus {
  switch (raw) {
    case 'PAID': return 'paid';
    case 'READY': return 'ready';
    case 'PENDING':
    case 'VIRTUAL_ACCOUNT_ISSUED': return 'pending';
    case 'CANCELLED':
    case 'PARTIAL_CANCELLED': return 'cancelled';
    case 'FAILED': return 'failed';
    default: return 'pending'; // 모르는 상태를 성공으로 취급하지 않는다
  }
}

export interface PortOneOptions {
  apiSecret: string;
  baseUrl?: string;
  fetchImpl?: typeof fetch;
}

export class PortOneGateway implements PaymentGateway {
  readonly name = 'portone';
  private readonly apiSecret: string;
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;
  private token: { value: string; expiresAt: number } | null = null;

  constructor(options: PortOneOptions) {
    if (!options.apiSecret) throw new Error('포트원 API Secret이 필요합니다.');
    this.apiSecret = options.apiSecret;
    this.baseUrl = options.baseUrl ?? DEFAULT_BASE_URL;
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  /** 액세스 토큰. 만료 1분 전에 미리 갱신한다 */
  private async accessToken(): Promise<string> {
    if (this.token && Date.now() < this.token.expiresAt - 60_000) return this.token.value;

    const res = await this.fetchImpl(`${this.baseUrl}/login/api-secret`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ apiSecret: this.apiSecret }),
    });
    if (!res.ok) throw new Error(`포트원 인증 실패 (${res.status}): ${await res.text()}`);

    const body = (await res.json()) as { accessToken: string };
    if (!body.accessToken) throw new Error('포트원 응답에 accessToken이 없습니다.');

    // 문서상 만료는 10분. 보수적으로 9분만 쓴다
    this.token = { value: body.accessToken, expiresAt: Date.now() + 9 * 60_000 };
    return this.token.value;
  }

  async getPayment(paymentId: string): Promise<PaymentRecord> {
    const token = await this.accessToken();
    const res = await this.fetchImpl(
      `${this.baseUrl}/payments/${encodeURIComponent(paymentId)}`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    if (!res.ok) throw new Error(`결제 조회 실패 (${res.status}): ${await res.text()}`);

    const raw = (await res.json()) as {
      id?: string;
      status?: string;
      amount?: { total?: number };
      customData?: string;
      method?: { type?: string };
      paidAt?: string;
      merchantId?: string;
    };

    return {
      paymentId: raw.id ?? paymentId,
      status: mapStatus(raw.status ?? ''),
      amountKrw: raw.amount?.total ?? 0,
      // 포트원은 결제 요청 시 paymentId를 우리가 정한다. 그 값이 곧 주문 식별자다
      merchantOrderId: raw.id ?? paymentId,
      method: raw.method?.type ?? null,
      paidAt: raw.paidAt ?? null,
      raw,
    };
  }

  async cancelPayment(paymentId: string, reason: string, amountKrw?: number): Promise<CancelResult> {
    const token = await this.accessToken();
    const res = await this.fetchImpl(
      `${this.baseUrl}/payments/${encodeURIComponent(paymentId)}/cancel`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(amountKrw === undefined ? { reason } : { reason, amount: amountKrw }),
      },
    );
    if (!res.ok) throw new Error(`결제 취소 실패 (${res.status}): ${await res.text()}`);

    const raw = (await res.json()) as { cancellation?: { totalAmount?: number } };
    return {
      cancelled: true,
      cancelledAmountKrw: raw.cancellation?.totalAmount ?? amountKrw ?? 0,
      raw,
    };
  }
}
