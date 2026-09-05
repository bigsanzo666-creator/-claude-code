/**
 * 살 수 있는 것 — 단품과 묶음을 한 가지로 다룬다.
 *
 * 묶음이 화면에만 있고 살 수는 없었다. 단품을 사러 온 손님에게 묶음을 내밀려면
 * 그 묶음이 **실제로 결제까지 가야** 한다. 못 사는 것을 내미는 건 속이는 것이다.
 *
 * ## 주문은 여전히 하나다
 *
 * 묶음을 사도 주문은 한 건이고 이용권도 하나다. 달라지는 것은 **만들어 드릴
 * 리포트가 여러 편**이라는 것뿐이다. 그래서 환불·열람·청약철회 규칙을 손대지
 * 않았다 — 돈을 다루는 자리는 건드릴수록 위험하다.
 *
 * ## 값은 여기서만 정한다
 *
 * 화면이 보낸 금액은 쓰지 않는다. 단품이면 카탈로그, 묶음이면 묶음표에서
 * 가져온다. 절약액은 구성 상품의 실제 판매가 합계에서 계산한다 — 판 적 없는
 * 정가를 지어내지 않는다.
 */

import { CATALOG, type ProductId } from './catalog.ts';
import { PACKAGES, bundleMath, type PackageId } from './packages.ts';

export interface Orderable {
  id: string;
  name: string;
  priceKrw: number;
  description: string;
  /** 결제 전에 보여줄 미리보기 분량 */
  previewRatio: number;
  /** 실제로 만들어 드릴 리포트들. 단품이면 자기 자신 하나 */
  members: ProductId[];
  isPackage: boolean;
  /** 두 사람의 생년월일이 필요한 구성이 하나라도 있는가 */
  needsPartner: boolean;
}

function fromPackage(id: PackageId): Orderable {
  const pack = PACKAGES[id];
  const math = bundleMath(id);
  const names = pack.members.map((m) => CATALOG[m].name).join(' + ');
  return {
    id: pack.id,
    name: pack.name,
    priceKrw: math.bundleKrw,
    description: `${names} — 따로 사면 ${math.individualKrw.toLocaleString('ko-KR')}원입니다.`,
    // 묶음은 편수가 많으므로 제일 인색한 쪽에 맞춘다. 미리보기로 다 읽히면 안 된다
    previewRatio: Math.min(...pack.members.map((m) => CATALOG[m].previewRatio)),
    members: [...pack.members],
    isPackage: true,
    needsPartner: pack.members.some((m) => CATALOG[m].needsPartner === true),
  };
}

/** 단품이든 묶음이든 살 수 있는 것으로 바꾼다. 모르는 것이면 던진다 */
export function orderable(id: string): Orderable {
  const single = CATALOG[id as ProductId];
  if (single) {
    return {
      id: single.id,
      name: single.name,
      priceKrw: single.priceKrw,
      description: single.description,
      previewRatio: single.previewRatio,
      members: [single.id],
      isPackage: false,
      needsPartner: single.needsPartner === true,
    };
  }
  if (PACKAGES[id as PackageId]) return fromPackage(id as PackageId);
  throw new Error(`알 수 없는 상품입니다: ${id}`);
}

/** 살 수 있는 것인가 */
export function isOrderable(id: string): boolean {
  return Boolean(CATALOG[id as ProductId] ?? PACKAGES[id as PackageId]);
}

/**
 * 이 단품을 품고 있는 묶음 중 **손님에게 내밀 것 하나**.
 *
 * 여럿이면 제일 싼 것을 고른다. 사러 온 것에 얹는 금액이 작을수록 얹기 쉽다.
 * 비싼 것부터 들이밀면 손님은 얹지 않고 그냥 나간다.
 */
export function upsellFor(productId: string): Orderable | null {
  const packs = Object.values(PACKAGES)
    .filter((p) => (p.members as string[]).includes(productId))
    .sort((a, b) => a.priceKrw - b.priceKrw);
  return packs.length ? fromPackage(packs[0].id) : null;
}

/** 단품을 묶음으로 바꿔 살 때 더 내는 돈 */
export function upgradeCostKrw(productId: string, packageId: string): number {
  return orderable(packageId).priceKrw - orderable(productId).priceKrw;
}
