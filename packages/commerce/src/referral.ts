import { createHash } from 'node:crypto';

export const INVITE_DISCOUNT_KRW = 3000;
export const INVITE_MIN_ORDER_KRW = 20000;
export const COUNT_MIN_ORDER_KRW = 20000;

export interface RewardTier {
  tier: number;
  kind: string;
  type: '자동' | '사장님';
  description: string;
}

export const REWARD_TIERS: RewardTier[] = [
  { tier: 1, kind: '오늘의 운세 30일', type: '자동', description: '오늘의 운세 30일 무료 이용권' },
  { tier: 3, kind: '이번 주 행운의 번호', type: '자동', description: '이번 주 행운의 번호 점지' },
  { tier: 5, kind: '월운세 6달 (달마다 1번)', type: '자동', description: '한 달 운세 여섯 달 무료' },
  { tier: 7, kind: '5만원 아래 점사 1개', type: '사장님', description: '5만원 아래 점사 1개 무료' },
  { tier: 10, kind: '신년운세 1개', type: '사장님', description: '신년운세 1개 무료' },
  { tier: 15, kind: '택일 또는 작명 중 하나', type: '사장님', description: '택일 또는 작명 중 하나 무료' },
  { tier: 20, kind: '오늘의 운세·월운세·신년운세 1년 + 택일 1회 + 작명 1회', type: '사장님', description: '오늘의 운세·월운세·신년운세 1년치 + 택일 1회 + 작명 1회' },
];

/**
 * 이메일에 붙은 소개 코드를 만든다.
 * 여덟 자리, 영문 소문자와 숫자만 (예: nb7k2m9a).
 * 같은 이메일이면 늘 같은 코드다.
 */
export function generateInviteCode(email: string): string {
  const norm = (email || '').trim().toLowerCase();
  const hash = createHash('sha256').update(`neulbom-salt-invite:${norm}`).digest('hex');
  return `nb${hash.slice(0, 6)}`;
}

/** 소개 코드 형식 검사 */
export function isValidInviteCode(code?: unknown): code is string {
  if (typeof code !== 'string') return false;
  return /^nb[a-z0-9]{6}$/.test(code.trim().toLowerCase());
}

/**
 * 결제 금액에 벗의 증표 할인을 계산한다.
 * 서버에서만 계산하며 클라이언트의 금액은 신뢰하지 않는다.
 */
export function applyInviteDiscount(amountKrw: number, hasValidInvite: boolean) {
  if (!hasValidInvite) {
    return { finalAmountKrw: amountKrw, discountKrw: 0, reason: null };
  }
  if (amountKrw >= INVITE_MIN_ORDER_KRW) {
    return {
      finalAmountKrw: Math.max(0, amountKrw - INVITE_DISCOUNT_KRW),
      discountKrw: INVITE_DISCOUNT_KRW,
      reason: '깎는 이유: 벗의 증표',
    };
  }
  return {
    finalAmountKrw: amountKrw,
    discountKrw: 0,
    reason: '2만원 이상 점사에 쓸 수 있는 증표입니다',
  };
}
