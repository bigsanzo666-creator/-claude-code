/**
 * 결제 확인과 환불 실행.
 *
 * 결제 검증의 원칙 하나: **클라이언트가 보낸 값은 무엇도 믿지 않는다.**
 * 브라우저는 "결제 성공했어요, 19,900원이요"라고 말할 수 있고 그 말은 위조된다.
 * 유일한 진실은 PG에 직접 물어본 결과다.
 */

import type { PaymentGateway } from './gateway.ts';
import { assessRefund, type RefundVerdict } from './refund.ts';
import { markFailed, markPaid, markRefunded, type Order } from './orders.ts';

export class PaymentVerificationError extends Error {
  readonly code: 'not_paid' | 'order_mismatch' | 'amount_mismatch';
  constructor(code: PaymentVerificationError['code'], message: string) {
    super(message);
    this.name = 'PaymentVerificationError';
    this.code = code;
  }
}

/**
 * 결제를 확인해 주문을 확정한다.
 *
 * 세 가지를 순서대로 검사한다. 하나라도 어긋나면 물건이 나가지 않는다.
 *   1. PG 기준으로 실제 승인된 결제인가
 *   2. 그 결제가 이 주문의 것인가
 *   3. 금액이 서버가 정한 값과 같은가
 */
export async function confirmPayment(
  order: Order,
  gateway: PaymentGateway,
  paymentId: string,
  now = new Date(),
): Promise<Order> {
  const payment = await gateway.getPayment(paymentId);

  if (payment.status !== 'paid') {
    throw new PaymentVerificationError(
      'not_paid',
      `승인되지 않은 결제입니다. (상태: ${payment.status})`,
    );
  }

  // 다른 주문의 결제를 가져다 붙이는 것을 막는다
  if (payment.merchantOrderId && payment.merchantOrderId !== order.id) {
    throw new PaymentVerificationError(
      'order_mismatch',
      `결제가 다른 주문의 것입니다. 주문 ${order.id} / 결제 ${payment.merchantOrderId}`,
    );
  }

  // markPaid 안에서 금액을 대조한다. 여기서 예외가 나면 주문은 확정되지 않는다
  try {
    return markPaid({ ...order, paymentId }, payment.amountKrw, now);
  } catch (error) {
    if (error instanceof Error && error.message.includes('결제 금액이')) {
      throw new PaymentVerificationError('amount_mismatch', error.message);
    }
    throw error;
  }
}

/** 결제 실패 처리. 사유를 남겨두면 CS에서 되짚을 수 있다 */
export function failOrder(order: Order, reason: string): Order {
  return markFailed(order, reason);
}

export interface RefundOutcome {
  order: Order;
  verdict: RefundVerdict;
  cancelledAmountKrw: number;
}

/**
 * 환불 실행.
 *
 * 정책 판정을 먼저 하고, 통과했을 때만 PG에 취소를 건다.
 * 순서를 바꾸면 환불 불가인 건도 돈이 먼저 나가버린다.
 */
export async function refundOrder(
  order: Order,
  gateway: PaymentGateway,
  now = new Date(),
): Promise<RefundOutcome> {
  const verdict = assessRefund(order, now);
  if (!verdict.refundable) {
    throw new Error(`환불할 수 없는 주문입니다. ${verdict.reason}`);
  }
  if (!order.paymentId) {
    throw new Error('결제 식별자가 없어 취소를 요청할 수 없습니다.');
  }

  const result = await gateway.cancelPayment(order.paymentId, verdict.reason, order.amountKrw);
  return {
    order: markRefunded(order, now),
    verdict,
    cancelledAmountKrw: result.cancelledAmountKrw,
  };
}
