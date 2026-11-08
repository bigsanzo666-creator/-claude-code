/**
 * 주문과 이용권.
 *
 * 상태 전이를 함수로 강제하는 이유: 결제 코드에서 제일 흔한 사고가
 * "이미 처리한 결제를 한 번 더 처리"와 "결제 안 됐는데 물건이 나감"이다.
 * 필드를 직접 고치는 대신 전이 함수만 두면 그 두 가지를 구조적으로 막을 수 있다.
 */

import { type ProductId, extraMemberKrw } from './catalog.ts';
import { orderable } from './orderable.ts';

export const ALLOWED_REFS = [
  'sidaek',
  'jansori',
  'bigyo',
  'don',
  'gyeolhon',
  'ai',
  'bumo',
  'silta',
] as const;
export type AdRef = (typeof ALLOWED_REFS)[number];

/**
 * 광고 식별자 정제.
 *
 * 영문 소문자와 숫자, 붙임표만 받고 20자에서 자른다.
 * 허용된 여덟 개가 아니면 빈 값(null)으로 둔다.
 * 이 값은 값을 정하는 데 일절 쓰이지 않는다.
 */
export function cleanRef(ref?: unknown): string | null {
  if (typeof ref !== 'string') return null;
  const trimmed = ref.trim().toLowerCase().slice(0, 20);
  if (!/^[a-z0-9-]+$/.test(trimmed)) return null;
  if (!ALLOWED_REFS.includes(trimmed as AdRef)) return null;
  return trimmed;
}

/** 광고 유입(UTM) 보관 기간 — 처음 들어온 값을 기준으로 7일간 유지한다 */
export const UTM_RETENTION_DAYS = 7;
export const UTM_RETENTION_MS = UTM_RETENTION_DAYS * 24 * 60 * 60 * 1000;

export interface UtmInfo {
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  utmContent: string | null;
  fbclid: string | null;
  utmFirstSeenAt: string | null;
}

export function cleanUtmValue(v?: unknown, maxLen = 120): string | null {
  if (typeof v !== 'string') return null;
  const cleaned = v.replace(/[\r\n\t<>'"`\\]/g, '').trim().slice(0, maxLen);
  return cleaned.length > 0 ? cleaned : null;
}

export function cleanIsoTimestamp(v?: unknown): string | null {
  if (typeof v !== 'string') return null;
  const ms = Date.parse(v.trim());
  if (Number.isNaN(ms)) return null;
  return new Date(ms).toISOString();
}

/**
 * 입력 객체에서 오직 UTM 4종 + fbclid + 처음 들어온 시각만 정제하여 꺼낸다.
 * 이름·생년월일·이메일 같은 개인정보는 절대 섞이지 않게 버린다.
 */
export function sanitizeUtm(raw?: unknown, fallbackNowIso?: string): UtmInfo {
  if (!raw || typeof raw !== 'object') {
    return {
      utmSource: null,
      utmMedium: null,
      utmCampaign: null,
      utmContent: null,
      fbclid: null,
      utmFirstSeenAt: null,
    };
  }
  const obj = raw as Record<string, unknown>;
  const utmSource = cleanUtmValue(obj.utmSource ?? obj.utm_source);
  const utmMedium = cleanUtmValue(obj.utmMedium ?? obj.utm_medium);
  const utmCampaign = cleanUtmValue(obj.utmCampaign ?? obj.utm_campaign);
  const utmContent = cleanUtmValue(obj.utmContent ?? obj.utm_content);
  const fbclid = cleanUtmValue(obj.fbclid, 200);
  const hasAny = Boolean(utmSource || utmMedium || utmCampaign || utmContent || fbclid);
  const utmFirstSeenAt = hasAny
    ? (cleanIsoTimestamp(obj.utmFirstSeenAt ?? obj.utm_first_seen_at) ?? fallbackNowIso ?? new Date().toISOString())
    : null;
  return {
    utmSource,
    utmMedium,
    utmCampaign,
    utmContent,
    fbclid,
    utmFirstSeenAt,
  };
}

export function hasAnyUtm(utm?: Partial<UtmInfo> | null): boolean {
  if (!utm) return false;
  return Boolean(utm.utmSource || utm.utmMedium || utm.utmCampaign || utm.utmContent || utm.fbclid);
}

export function isUtmFresh(utm?: Partial<UtmInfo> | null, nowMs = Date.now()): boolean {
  if (!hasAnyUtm(utm)) return false;
  if (!utm?.utmFirstSeenAt) return true;
  const seenMs = Date.parse(utm.utmFirstSeenAt);
  if (Number.isNaN(seenMs)) return false;
  return nowMs - seenMs <= UTM_RETENTION_MS;
}

export function extractUtmFromSearchParams(params: URLSearchParams, nowIso = new Date().toISOString()): UtmInfo | null {
  const candidate = sanitizeUtm({
    utm_source: params.get('utm_source'),
    utm_medium: params.get('utm_medium'),
    utm_campaign: params.get('utm_campaign'),
    utm_content: params.get('utm_content'),
    fbclid: params.get('fbclid'),
  }, nowIso);
  return hasAnyUtm(candidate) ? candidate : null;
}

/**
 * 처음 들어온 값을 기준으로 7일간 유지한다.
 * 기존 값이 있고 7일이 안 지났으면 기존 값을 지키고, 없거나 만료됐으면 새 값을 쓴다.
 */
export function mergeFirstTouchUtm(
  existing: Partial<UtmInfo> | null | undefined,
  incoming: Partial<UtmInfo> | null | undefined,
  nowMs = Date.now(),
): UtmInfo | null {
  const nowIso = new Date(nowMs).toISOString();
  if (existing && isUtmFresh(existing, nowMs)) {
    return sanitizeUtm(existing, existing.utmFirstSeenAt ?? nowIso);
  }
  if (incoming && hasAnyUtm(incoming)) {
    const sanitized = sanitizeUtm(incoming, incoming.utmFirstSeenAt ?? nowIso);
    if (isUtmFresh(sanitized, nowMs)) return sanitized;
  }
  return null;
}


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
  /** 어느 광고를 보고 들어왔는지. 값을 정하거나 권한을 주는 데는 쓰지 않는다 */
  ref?: string | null;
  /** 결제 완료 및 리포트 안내를 받을 이메일 주소 */
  email?: string | null;
  createdAt: string;
  paidAt: string | null;
  viewedAt: string | null;
  refundedAt: string | null;
  failureReason: string | null;
  discountKrw?: number;
  inviteCode?: string | null;
  rewardUsed?: string | null;
  utmSource?: string | null;
  utmMedium?: string | null;
  utmCampaign?: string | null;
  utmContent?: string | null;
  fbclid?: string | null;
  utmFirstSeenAt?: string | null;
}

export interface CreateOrderInput {
  id: string;
  productId: string;
  inputHash: string;
  noticeGiven: boolean;
  previewProvided: boolean;
  ref?: string | null;
  email?: string | null;
  inviteCode?: string | null;
  discountKrw?: number;
  rewardUsed?: string | null;
  utm?: Partial<UtmInfo> | null;
  /**
   * 본인을 포함한 인원. 인원에 따라 값이 달라지는 상품에만 쓴다.
   *
   * **서버가 손님이 적어 넣은 가족 수에서 직접 센 값**이라야 한다.
   * 화면이 보낸 금액이나 인원을 그대로 믿으면 값을 깎아 보낼 수 있다.
   */
  memberCount?: number;
  now?: Date;
}

export function createOrder(input: CreateOrderInput): Order {
  // 단품이든 묶음이든 값은 여기서만 정한다. 화면이 보낸 금액은 쓰지 않는다
  const product = orderable(input.productId);
  const now = (input.now ?? new Date()).toISOString();

  if (!input.inputHash) throw new Error('inputHash가 없습니다. 이용권을 묶을 대상이 없습니다.');

  const utm = sanitizeUtm(input.utm, now);

  return {
    id: input.id,
    productId: product.id,
    amountKrw: Math.max(0, product.priceKrw + extraMemberKrw(product.id, input.memberCount ?? 1) - Math.max(0, input.discountKrw ?? 0)),
    inviteCode: input.inviteCode ?? null,
    discountKrw: Math.max(0, input.discountKrw ?? 0),
    rewardUsed: input.rewardUsed ?? null,
    utmSource: utm.utmSource,
    utmMedium: utm.utmMedium,
    utmCampaign: utm.utmCampaign,
    utmContent: utm.utmContent,
    fbclid: utm.fbclid,
    utmFirstSeenAt: utm.utmFirstSeenAt,
    status: 'created',
    inputHash: input.inputHash,
    paymentId: null,
    noticeGiven: input.noticeGiven,
    previewProvided: input.previewProvided,
    ref: cleanRef(input.ref),
    email: input.email ? input.email.trim().toLowerCase() : null,
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
