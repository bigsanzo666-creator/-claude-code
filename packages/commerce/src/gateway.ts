/**
 * 결제 게이트웨이 인터페이스.
 *
 * PG를 인터페이스 뒤에 두는 이유는 두 가지다.
 * 하나는 나중에 갈아탈 수 있게 하는 것이고, 더 중요한 하나는
 * **결제 로직을 네트워크 없이 테스트할 수 있게 하는 것**이다.
 * 돈이 걸린 코드는 자동으로 검증돼야 하는데, 진짜 PG를 부르는 테스트는 그럴 수 없다.
 */

export type PaymentStatus = 'ready' | 'pending' | 'paid' | 'failed' | 'cancelled';

export interface PaymentRecord {
  paymentId: string;
  status: PaymentStatus;
  /** 실제로 승인된 금액 (원). 주문 금액과 대조하는 기준값 */
  amountKrw: number;
  /** PG가 인식한 주문 식별자. 우리 orderId와 일치해야 한다 */
  merchantOrderId: string | null;
  method: string | null;
  paidAt: string | null;
  raw: unknown;
}

export interface CancelResult {
  cancelled: boolean;
  cancelledAmountKrw: number;
  raw: unknown;
}

export interface PaymentGateway {
  readonly name: string;
  /** 결제 단건 조회. 검증의 유일한 진실 공급원이다 */
  getPayment(paymentId: string): Promise<PaymentRecord>;
  cancelPayment(paymentId: string, reason: string, amountKrw?: number): Promise<CancelResult>;
}

/**
 * 테스트용 가짜 게이트웨이.
 *
 * 결제 검증 로직 전체를 여기에 대고 돌린다. 금액 불일치, 미승인 결제,
 * 주문번호 어긋남 같은 공격 시나리오를 실제 돈 없이 재현할 수 있다.
 */
export class FakeGateway implements PaymentGateway {
  readonly name = 'fake';
  private payments = new Map<string, PaymentRecord>();
  readonly cancelled: { paymentId: string; reason: string; amountKrw?: number }[] = [];

  put(record: PaymentRecord): void {
    this.payments.set(record.paymentId, record);
  }

  async getPayment(paymentId: string): Promise<PaymentRecord> {
    const found = this.payments.get(paymentId);
    if (!found) throw new Error(`결제 내역을 찾을 수 없습니다: ${paymentId}`);
    return found;
  }

  async cancelPayment(paymentId: string, reason: string, amountKrw?: number): Promise<CancelResult> {
    const found = await this.getPayment(paymentId);
    if (found.status !== 'paid') throw new Error('승인된 결제만 취소할 수 있습니다.');
    this.cancelled.push({ paymentId, reason, amountKrw });
    this.payments.set(paymentId, { ...found, status: 'cancelled' });
    return { cancelled: true, cancelledAmountKrw: amountKrw ?? found.amountKrw, raw: {} };
  }
}
