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

import { CATALOG, UPSELL_PROMO_PRICE_KRW, UPSELL_PROMO_HOURS, type ProductId, type Product, type Category } from './catalog.ts';
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
  /** 생년월일 대신 고를 날 후보가 필요한가 */
  needsPick: boolean;
  /** 보고 싶은 기간이 필요한가 */
  needsRange: boolean;
  /** 얼굴과 손 사진이 필요한가 */
  needsFace: boolean;
  /** 아이의 성이 필요한가 (작명) */
  needsName: boolean;
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
    needsPick: pack.members.some((m) => CATALOG[m].needsPick === true),
    needsRange: pack.members.some((m) => CATALOG[m].needsRange === true),
    needsFace: pack.members.some((m) => CATALOG[m].needsFace === true),
    needsName: pack.members.some((m) => CATALOG[m].needsName === true),
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
      needsPick: single.needsPick === true,
      needsRange: single.needsRange === true,
      needsFace: single.needsFace === true,
      needsName: single.needsName === true,
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

export interface UpsellPriceInfo {
  /** 다음으로 내밀 단품 원래 판매가 (예: 14,900원) */
  singlePriceKrw: number;
  /** 정규 묶음 차액 또는 12시간 경과 후 가격 (예: 8,900원) */
  regularUpgradeKrw: number;
  /** 현재 적용가 (12시간 내 60% 할인, 만료 후 40% 할인) */
  currentPriceKrw: number;
  /** 12시간 할인 적용 중인지 */
  isPromo: boolean;
  /** 만료 시각 (ISO string) */
  expiresAt: string;
  /** 남은 밀리초 */
  remainingMs: number;
  /** 남은 시간 포맷: hh:mm:ss */
  remainingFormatted: string;
  /** 다음으로 내밀 상품 */
  nextProduct: {
    id: ProductId;
    name: string;
    priceKrw: number;
  } | null;
  /** 대상 묶음 */
  targetPackage: {
    id: PackageId;
    name: string;
    priceKrw: number;
  } | null;
  /** 손님 질문에 맞춘 첫 추천인가 */
  isMatched?: boolean;
}

/**
 * 깎은 뒤 끝자리를 900으로 내린다:
 * Math.max(900, Math.floor((n - 900) / 1000) * 1000 + 900)
 * 어떤 경우에도 원상품 값보다 커지지 않는다.
 */
export function cutPrice(basePrice: number, discountRate: number): number {
  const n = basePrice * (1 - discountRate);
  const rounded = Math.max(900, Math.floor((n - 900) / 1000) * 1000 + 900);
  return Math.min(basePrice, rounded);
}

const KEYWORD_RULES: { keywords: string[]; categories: Category[] }[] = [
  { keywords: ['이사', '집', '부동산', '이주', '근처', '옮기'], categories: ['시기', '가족'] },
  { keywords: ['아들', '딸', '자식', '아이', '엄마', '아빠', '부모', '며느리', '사위'], categories: ['가족', '궁합'] },
  { keywords: ['남편', '아내', '와이프', '배우자', '결혼'], categories: ['궁합'] },
  { keywords: ['헤어', '이별', '전남', '전여', '다시'], categories: ['재회'] },
  { keywords: ['돈', '빚', '투자', '사업', '장사', '가게'], categories: ['돈과 일'] },
  { keywords: ['이직', '회사', '직장', '취업', '시험', '합격'], categories: ['시험과 취업', '돈과 일'] },
];

const FORBIDDEN_KEYWORDS = ['건강', '아프', '수명', '질병', '임신'];

/**
 * 리포트 끝 추천을 세 개까지 돌려준다.
 * 손님 질문 말뭉치를 보고 갈래에 점수를 매겨 비싼 순으로 뽑는다.
 */
export function recommendNext(
  productId: string,
  question: string | null | undefined,
  viewedAt: Date | string | null | undefined,
  now: Date = new Date(),
): UpsellPriceInfo[] {
  const q = (question || '').trim();

  const scores: Partial<Record<Category, number>> = {};
  const isForbidden = FORBIDDEN_KEYWORDS.some((kw) => q.includes(kw));

  if (q && !isForbidden) {
    for (const rule of KEYWORD_RULES) {
      const matched = rule.keywords.some((kw) => q.includes(kw));
      if (matched) {
        for (const cat of rule.categories) {
          scores[cat] = (scores[cat] ?? 0) + 1;
        }
      }
    }
  }

  const scoredCategories = (Object.keys(scores) as Category[]).sort(
    (a, b) => (scores[b] ?? 0) - (scores[a] ?? 0),
  );

  const selectedProducts: Product[] = [];
  const selectedIds = new Set<string>([productId]);

  // 1) 점수 높은 갈래에서 값이 비싼 순으로 뽑는다
  for (const cat of scoredCategories) {
    const inCat = Object.values(CATALOG)
      .filter((p) => p.category === cat && !selectedIds.has(p.id))
      .sort((a, b) => b.priceKrw - a.priceKrw);

    for (const p of inCat) {
      if (selectedProducts.length >= 3) break;
      selectedProducts.push(p);
      selectedIds.add(p.id);
    }
    if (selectedProducts.length >= 3) break;
  }

  // 2) 모자라면 같은 갈래에서 값이 비싼 순으로 채운다
  const currentProd = CATALOG[productId as ProductId];
  if (selectedProducts.length < 3 && currentProd) {
    const sameCat = Object.values(CATALOG)
      .filter((p) => p.category === currentProd.category && !selectedIds.has(p.id))
      .sort((a, b) => b.priceKrw - a.priceKrw);

    for (const p of sameCat) {
      if (selectedProducts.length >= 3) break;
      selectedProducts.push(p);
      selectedIds.add(p.id);
    }
  }

  // 3) 그래도 모자라면 사주 종합 리포트 순으로 채운다
  const generalReportIds: ProductId[] = [
    'saju-report', 'cross-report', 'face-palm-report', 'saju-palm-report',
    'saju-face-report', 'wealth-report', 'career-report', 'charm-report',
  ];
  for (const gid of generalReportIds) {
    if (selectedProducts.length >= 3) break;
    const p = CATALOG[gid];
    if (p && !selectedIds.has(p.id)) {
      selectedProducts.push(p);
      selectedIds.add(p.id);
    }
  }

  // 4) 혹시라도 여전히 모자라면 전체 카탈로그에서 비싼 순으로 채운다
  if (selectedProducts.length < 3) {
    const remaining = Object.values(CATALOG)
      .filter((p) => !selectedIds.has(p.id))
      .sort((a, b) => b.priceKrw - a.priceKrw);
    for (const p of remaining) {
      if (selectedProducts.length >= 3) break;
      selectedProducts.push(p);
      selectedIds.add(p.id);
    }
  }

  // 5) 시간 및 할인 가격 계산 (12시간 내 60%, 12시간 후 40%)
  const viewedTime = viewedAt ? new Date(viewedAt).getTime() : now.getTime();
  const expiresTime = viewedTime + UPSELL_PROMO_HOURS * 60 * 60 * 1000;
  const nowTime = now.getTime();
  const isPromo = nowTime < expiresTime;
  const remainingMs = Math.max(0, expiresTime - nowTime);

  const hours = Math.floor(remainingMs / 3600000);
  const minutes = Math.floor((remainingMs % 3600000) / 60000);
  const seconds = Math.floor((remainingMs % 60000) / 1000);
  const pad = (n: number) => String(n).padStart(2, '0');
  const remainingFormatted = `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;

  return selectedProducts.map((p, idx) => {
    const singlePriceKrw = p.priceKrw;
    const promoPriceKrw = cutPrice(singlePriceKrw, 0.60);
    const expiredPriceKrw = cutPrice(singlePriceKrw, 0.40);

    return {
      singlePriceKrw,
      regularUpgradeKrw: expiredPriceKrw,
      currentPriceKrw: isPromo ? promoPriceKrw : expiredPriceKrw,
      isPromo,
      expiresAt: new Date(expiresTime).toISOString(),
      remainingMs,
      remainingFormatted,
      nextProduct: {
        id: p.id,
        name: p.name,
        priceKrw: p.priceKrw,
      },
      targetPackage: null,
      isMatched: idx === 0 && scoredCategories.length > 0,
    };
  });
}

/**
 * 리포트 첫 열람(viewedAt) 기준 12시간 한정 이어사기 가격 계산.
 * 단품 및 묶음 호환 지원.
 */
export function calculateUpsellPrice(
  productId: string,
  targetPackageId: string,
  viewedAt: Date | string | null | undefined,
  now: Date = new Date(),
): UpsellPriceInfo {
  const pack = PACKAGES[targetPackageId as PackageId];
  const nextMemberId = pack?.members.find((m) => m !== productId) ?? (pack?.members[0] as ProductId);
  const nextProduct = nextMemberId && CATALOG[nextMemberId] ? CATALOG[nextMemberId] : null;
  const singlePriceKrw = nextProduct ? nextProduct.priceKrw : CATALOG[productId as ProductId]?.priceKrw ?? 14900;

  const regularUpgradeKrw = upgradeCostKrw(productId, targetPackageId);

  const viewedTime = viewedAt ? new Date(viewedAt).getTime() : now.getTime();
  const expiresTime = viewedTime + UPSELL_PROMO_HOURS * 60 * 60 * 1000;
  const nowTime = now.getTime();

  const isPromo = nowTime < expiresTime;
  const remainingMs = Math.max(0, expiresTime - nowTime);

  const hours = Math.floor(remainingMs / 3600000);
  const minutes = Math.floor((remainingMs % 3600000) / 60000);
  const seconds = Math.floor((remainingMs % 60000) / 1000);
  const pad = (n: number) => String(n).padStart(2, '0');
  const remainingFormatted = `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;

  const promoPrice = cutPrice(singlePriceKrw, 0.60);
  let currentPriceKrw = isPromo ? promoPrice : regularUpgradeKrw;
  if (currentPriceKrw > singlePriceKrw) {
    currentPriceKrw = singlePriceKrw;
  }

  return {
    singlePriceKrw,
    regularUpgradeKrw,
    currentPriceKrw,
    isPromo,
    expiresAt: new Date(expiresTime).toISOString(),
    remainingMs,
    remainingFormatted,
    nextProduct: nextProduct ? { id: nextProduct.id, name: nextProduct.name, priceKrw: nextProduct.priceKrw } : null,
    targetPackage: pack ? { id: pack.id, name: pack.name, priceKrw: pack.priceKrw } : null,
  };
}

