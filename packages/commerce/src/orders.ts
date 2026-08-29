/**
 * 주문과 이용권.
 *
 * 상태 전이를 함수로 강제하는 이유: 결제 코드에서 제일 흔한 사고가
 * "이미 처리한 결제를 한 번 더 처리"와 "결제 안 됐는데 물건이 나감"이다.
 * 필드를 직접 고치는 대신 전이 함수만 두면 그 두 가지를 구조적으로 막을 수 있다.
 */

import { getProduct, type ProductId } from './catalog.ts';

export type OrderStatus =
  /** 주문서 생성. 아직 결제창도 안 띄웠다 */
  | 'created'
  /** 결제창을 띄웠고 결과를 기다린다 */
  | 'pending'
  /** 결제가 확인됐다. 이 시점부터 이용권이 생긴다 */
  | 'paid'
  /** 리포트가 만들어져 전달 가능해졌다 */
  | 'fulfilled'
  /** 사용자가 전문을 열람했다. 청약철회 제한의 기준점 */
  | 'viewed'
  | 'failed'
  | 'refunded';

export interface Order {
  id: string;
  productId: ProductId;
  /** 결제 시점에 서버가 확정한 금액. 검증의 기준값 */
  amountKrw: number;
  status: OrderStatus;
  /**
   * 이 주문이 어떤 풀이에 대한 것인지. 리포트 캐시 키와 같은 값을 쓴다.
   * 이용권을 주문이 아니라 "내용"에 묶어야, 결제한 것과 다른 명식을 뽑아가는 것을 막는다.
   */
  inputHash: string;
  /** PG가 부여한 결제 식별자 */
  paymentId: string | null;
  /** 결제 화면에서 청약철회 제한을 고지했는가 */
  noticeGiven: boolean;
  /** 결제 전에 미리보기를 제공했는가 */
  previewProvided: boolean;
  createdAt: string;
  paidAt: string | null;
  viewedAt: string | null;
  refundedAt: string | null;
  failureReason: string | null;
}

export interface CreateOrderInput {
  id: string;
  productId: string;
  inputHash: string;
  noticeGiven: boolean;
  previewProvided: boolean;
  now?: Date;
}

export function createOrder(input: CreateOrderInput): Order {
  const product = getProduct(input.productId);
  const now = (input.now ?? new Date()).toISOString();

  if (!input.inputHash) throw new Error('inputHash가 없습니다. 이용권을 묶을 대상이 없습니다.');

  return {
    id: input.id,
    productId: product.id,
    amountKrw: product.priceKrw,
    status: 'created',
    inputHash: input.inputHash,
    paymentId: null,
    noticeGiven: input.noticeGiven,
    previewProvided: input.previewProvided,
    createdAt: now,
    paidAt: null,
    viewedAt: null,
    refundedAt: null,
    failureReason: null,
  };
}

const ALLOWED: Record<OrderStatus, OrderStatus[]> = {
  created: ['pending', 'failed'],
  pending: ['paid', 'failed'],
  paid: ['fulfilled', 'refunded'],
  fulfilled: ['viewed', 'refunded'],
  viewed: ['refunded'],
  failed: ['pending'],
  refunded: [],
};

export class OrderTransitionError extends Error {
  readonly from: OrderStatus;
  readonly to: OrderStatus;
  constructor(from: OrderStatus, to: OrderStatus) {
    super(`주문 상태를 ${from}에서 ${to}(으)로 바꿀 수 없습니다.`);
    this.name = 'OrderTransitionError';
    this.from = from;
    this.to = to;
  }
}

function transition(order: Order, to: OrderStatus): void {
  if (!ALLOWED[order.status].includes(to)) throw new OrderTransitionError(order.status, to);
}

export function markPending(order: Order, paymentId: string): Order {
  transition(order, 'pending');
  return { ...order, status: 'pending', paymentId };
}

/**
 * 결제 확인.
 *
 * **금액은 반드시 서버가 가진 `order.amountKrw`와 대조한다.**
 * PG에서 조회한 실제 결제 금액이 인자로 들어오며, 클라이언트가 보낸 값을 쓰면 안 된다.
 * 이 검사 하나가 빠지면 1원 결제로 상품을 가져갈 수 있다.
 */
export function markPaid(order: Order, paidAmountKrw: number, now = new Date()): Order {
  transition(order, 'paid');
  if (paidAmountKrw !== order.amountKrw) {
    throw new Error(
      `결제 금액이 주문 금액과 다릅니다. 주문 ${order.amountKrw}원 / 결제 ${paidAmountKrw}원`,
    );
  }
  return { ...order, status: 'paid', paidAt: now.toISOString() };
}

export function markFailed(order: Order, reason: string): Order {
  transition(order, 'failed');
  return { ...order, status: 'failed', failureReason: reason };
}

export function markFulfilled(order: Order): Order {
  transition(order, 'fulfilled');
  return { ...order, status: 'fulfilled' };
}

/** 전문 열람. 청약철회 제한의 기준이 되는 시점이라 반드시 기록한다. */
export function markViewed(order: Order, now = new Date()): Order {
  if (order.status === 'viewed') return order; // 여러 번 열람해도 최초 시점을 유지한다
  transition(order, 'viewed');
  return { ...order, status: 'viewed', viewedAt: now.toISOString() };
}

export function markRefunded(order: Order, now = new Date()): Order {
  transition(order, 'refunded');
  return { ...order, status: 'refunded', refundedAt: now.toISOString() };
}

/** 결제가 끝난 주문인가 — 이용권 판정의 기준 */
const ENTITLED: OrderStatus[] = ['paid', 'fulfilled', 'viewed'];

/**
 * 이 주문으로 이 풀이를 볼 수 있는가.
 *
 * 주문 상태만 보지 않고 `inputHash`까지 대조한다.
 * 사주 리포트를 사고 다른 사람 명식을 넣어 뽑아가는 것을 막는다.
 */
export function hasEntitlement(order: Order, inputHash: string): boolean {
  return ENTITLED.includes(order.status) && order.inputHash === inputHash;
}
