/**
 * 묶음 상품.
 *
 * 경쟁사가 객단가를 올리는 방법이 이것이다. 단품 옆에 묶음을 나란히 놓고
 * 가운데에 「추천」을 단다. 단품을 사러 온 사람이 묶음을 산다.
 *
 * **정가를 지어내지 않는다.** 경쟁사들이 쓰는 "정가 128,000원 → 61% 할인"은
 * 그 가격에 실제로 판 적이 없으면 표시광고법상 거짓·과장광고가 된다.
 * 우리는 구성 상품이 전부 실재하므로 **그 합계를 정가로 쓴다** — 지어낼 필요가 없다.
 *
 * 그래서 이 파일에는 할인 금액이 하드코딩돼 있지 않다. 묶음가만 정하고
 * 절약액은 카탈로그에서 계산한다. 개별 가격을 고치면 절약액이 저절로 따라온다.
 */

import { CATALOG, getProduct, type ProductId } from './catalog.ts';

export type PackageId =
  // 주제마다 두 칸씩 — 단품 옆에 2종, 그 옆에 3종
  | 'love-2' | 'love-3'
  | 'reunion-2' | 'reunion-3'
  | 'marry-2' | 'marry-3'
  | 'child-2' | 'child-3'
  | 'self-2' | 'self-3'
  | 'money-2' | 'money-3'
  | 'face-2' | 'face-3'
  | 'birth-2' | 'birth-3';

export interface BundlePackage {
  id: PackageId;
  name: string;
  members: ProductId[];
  priceKrw: number;
  hook: string;
  /** 화면에서 가운데를 강조한다. 극단을 피하는 심리 때문에 가운데가 제일 팔린다 */
  recommended: boolean;
}

/**
 * 묶음은 갈래를 가로지른다.
 *
 * 「연애 묶음」은 손님이 들어오는 입구를 넓히고, 「가족 묶음」은 우리만
 * 가진 자리를 판다. 삼합은 간판이라 단독으로도 서고 묶음의 축이기도 하다.
 */
/**
 * 묶음 — 주제마다 2종과 3종을 하나씩.
 *
 * 전에는 묶음이 넷뿐이라 상품 스물여덟 중 열일곱에는 사다리가 아예 안 붙었다.
 * 돈그릇(단품)에서 다음 칸이 89,000원이라 계단이 너무 높기도 했다.
 *
 * 경쟁사(청월당)는 여덟 주제 전부에 1·2·3단계를 채워 놓고, 단품 사러 온 손님을
 * 2단계로 올린다. 배수가 일정하다 — 2종이 단품의 약 두 배, 3종이 두 배 반에서 세 배.
 * 그 구조를 그대로 쓴다. **베끼지 않는 것은 가짜 정가와 거짓 할인율뿐이다.**
 *
 * 값은 「따로 사면」보다 반드시 싸야 한다. 그렇지 않으면 묶음이라 부를 수 없고,
 * `assertPackagesValid()` 가 기동할 때 막는다.
 */
export const PACKAGES: Record<PackageId, BundlePackage> = {
  // ── 연애 ─────────────────────────────────────────────────
  'love-2': {
    id: 'love-2', name: '늘봄 연애', members: ['charm-report', 'single-report'],
    priceKrw: 39800, hook: '내 매력과 만날 시기까지', recommended: true,
  },
  'love-3': {
    id: 'love-3', name: '늘봄 연애 · 전부', members: ['charm-report', 'single-report', 'compat-report'],
    priceKrw: 62900, hook: '그 사람과 맞는지까지 한 번에', recommended: false,
  },

  // ── 재회 ─────────────────────────────────────────────────
  'reunion-2': {
    id: 'reunion-2', name: '늘봄 재회', members: ['reunion-report', 'letgo-report'],
    priceKrw: 43700, hook: '다시 만날 자리와, 아니라면 정리하는 법', recommended: true,
  },
  'reunion-3': {
    id: 'reunion-3', name: '늘봄 재회 · 전부', members: ['reunion-report', 'letgo-report', 'compat-report'],
    priceKrw: 66900, hook: '애초에 맞는 사람이었는지까지', recommended: false,
  },

  // ── 결혼 ─────────────────────────────────────────────────
  'marry-2': {
    id: 'marry-2', name: '늘봄 결혼', members: ['marriage-timing-report', 'compat-report'],
    priceKrw: 43700, hook: '언제, 그리고 이 사람과', recommended: true,
  },
  'marry-3': {
    id: 'marry-3', name: '늘봄 결혼 · 전부',
    members: ['marriage-timing-report', 'compat-report', 'saju-report'],
    priceKrw: 70900, hook: '내가 어떤 사람인지부터 보고 정한다', recommended: false,
  },

  // ── 자녀 ─────────────────────────────────────────────────
  'child-2': {
    id: 'child-2', name: '늘봄 아이', members: ['child-report', 'child-aptitude-report'],
    priceKrw: 46900, hook: '어떤 아이인지, 뭘 시켜야 할지', recommended: true,
  },
  'child-3': {
    id: 'child-3', name: '늘봄 아이 · 전부',
    members: ['child-report', 'child-aptitude-report', 'parent-child-report'],
    priceKrw: 69900, hook: '왜 나와 부딪히는지까지', recommended: false,
  },

  // ── 나 ───────────────────────────────────────────────────
  'self-2': {
    id: 'self-2', name: '늘봄 나', members: ['saju-report', 'newyear-report'],
    priceKrw: 47800, hook: '타고난 것과 올 한 해', recommended: true,
  },
  'self-3': {
    id: 'self-3', name: '늘봄 나 · 전부', members: ['saju-report', 'newyear-report', 'cross-report'],
    priceKrw: 99900, hook: '얼굴과 손까지 대조해서', recommended: false,
  },

  // ── 돈과 일 ──────────────────────────────────────────────
  'money-2': {
    id: 'money-2', name: '늘봄 돈과 일', members: ['wealth-report', 'career-report'],
    priceKrw: 23800, hook: '벌 그릇과 오를 자리', recommended: true,
  },
  'money-3': {
    id: 'money-3', name: '늘봄 돈과 일 · 전부',
    members: ['wealth-report', 'career-report', 'learning-report'],
    priceKrw: 34900, hook: '시험과 계약까지 함께', recommended: false,
  },

  // ── 겉과 속 ──────────────────────────────────────────────
  'face-2': {
    id: 'face-2', name: '늘봄 겉과 속', members: ['face-palm-report', 'saju-face-report'],
    priceKrw: 63900, hook: '얼굴과 손, 그리고 사주까지 맞대어', recommended: true,
  },
  'face-3': {
    id: 'face-3', name: '늘봄 삼합',
    members: ['face-palm-report', 'saju-face-report', 'cross-report'],
    priceKrw: 109900, hook: '셋이 같은 말을 하는지 끝까지', recommended: false,
  },

  // ── 출산 ─────────────────────────────────────────────────
  // 우리만 파는 자리다. 청월당은 택일도 작명도 팔지 않는다.
  // 게다가 둘 다 기한이 박혀 있다 — 수술 날짜, 출생신고 한 달.
  'birth-2': {
    id: 'birth-2', name: '늘봄 출산', members: ['pick-report', 'naming-report'],
    priceKrw: 118900, hook: '낳는 날과 아이 이름을 한 자리에서', recommended: true,
  },
  'birth-3': {
    id: 'birth-3', name: '늘봄 출산 · 전부',
    members: ['pick-report', 'naming-report', 'child-report'],
    priceKrw: 139900, hook: '어떤 아이로 자랄지까지', recommended: false,
  },
};

export interface BundleMath {
  /** 구성 상품을 따로 살 때의 합계. **실제 판매가의 합이므로 지어낸 값이 아니다** */
  individualKrw: number;
  bundleKrw: number;
  savedKrw: number;
  /** 내림한다. 21.7%를 22%로 올려 적으면 그만큼이 과장이다 */
  percent: number;
}

export function bundleMath(id: PackageId): BundleMath {
  const pack = PACKAGES[id];
  const individualKrw = pack.members.reduce((sum, m) => sum + getProduct(m).priceKrw, 0);
  const savedKrw = individualKrw - pack.priceKrw;
  return {
    individualKrw,
    bundleKrw: pack.priceKrw,
    savedKrw,
    percent: Math.floor((savedKrw / individualKrw) * 100),
  };
}

/**
 * 어떤 상품을 보고 있는 사람에게 권할 묶음.
 *
 * 그 상품이 **들어 있는** 묶음만 권한다. 관계없는 것을 들이밀면
 * 그건 권유가 아니라 방해다.
 */
export function packagesContaining(productId: ProductId): BundlePackage[] {
  return Object.values(PACKAGES)
    .filter((p) => p.members.includes(productId))
    .sort((a, b) => a.priceKrw - b.priceKrw);
}

/** 묶음 구성이 카탈로그와 어긋나지 않는지. 기동할 때 한 번 확인한다 */
export function assertPackagesValid(): void {
  for (const pack of Object.values(PACKAGES)) {
    for (const m of pack.members) {
      if (!CATALOG[m]) throw new Error(`${pack.name}: 없는 상품이 들어 있습니다 — ${m}`);
    }
    if (new Set(pack.members).size !== pack.members.length) {
      throw new Error(`${pack.name}: 같은 상품이 두 번 들어 있습니다.`);
    }
    const math = bundleMath(pack.id);
    if (math.savedKrw <= 0) {
      throw new Error(`${pack.name}: 따로 사는 게 더 쌉니다 (${math.individualKrw}원 vs ${math.bundleKrw}원). 묶음이라고 부를 수 없습니다.`);
    }
  }
}
