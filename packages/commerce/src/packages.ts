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

export type PackageId = 'love-pack' | 'samhap-pack' | 'family-pack' | 'full-pack';

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
export const PACKAGES: Record<PackageId, BundlePackage> = {
  'love-pack': {
    id: 'love-pack',
    name: '늘봄 연애',
    members: ['charm-report', 'single-report', 'compat-report'],
    priceKrw: 34900,
    hook: '내 매력과 만날 시기, 그리고 그 사람까지',
    recommended: false,
  },
  'samhap-pack': {
    id: 'samhap-pack',
    name: '늘봄 삼합',
    members: ['cross-report', 'saju-report', 'newyear-report'],
    priceKrw: 64900,
    hook: '사주·관상·손금까지 전부 대조해서',
    recommended: true,
  },
  'family-pack': {
    id: 'family-pack',
    name: '늘봄 가족',
    members: ['child-report', 'child-aptitude-report', 'parent-child-report'],
    priceKrw: 44900,
    hook: '아이의 기질과 진로, 그리고 나와의 관계까지',
    recommended: false,
  },
  'full-pack': {
    id: 'full-pack',
    name: '늘봄 완전',
    members: ['cross-report', 'saju-report', 'newyear-report', 'compat-report', 'wealth-report', 'career-report'],
    priceKrw: 89000,
    hook: '나와 상대, 돈과 일까지 빠짐없이',
    recommended: false,
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
