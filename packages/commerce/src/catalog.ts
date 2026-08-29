/**
 * 판매 상품.
 *
 * 가격 정책의 근거는 `docs/saju-service-research.md` 10절이다.
 * 무료 구간(단독 풀이 전부)은 여기 없다 — 파는 것은 합본과 서술형 리포트뿐이다.
 *
 * 가격을 코드에 두는 이유: 결제 검증 때 **서버가 가진 금액**과 대조해야 하기 때문이다.
 * 클라이언트가 보낸 금액을 믿으면 1원 결제로 리포트를 가져갈 수 있다.
 */

export type ProductId = 'saju-report' | 'compat-report' | 'cross-report';

export interface Product {
  id: ProductId;
  name: string;
  /** 원 단위 정수. 소수점을 쓰지 않는다 */
  priceKrw: number;
  description: string;
  /** 결제 전에 보여줄 미리보기 분량 (전체 대비 비율) */
  previewRatio: number;
}

export const CATALOG: Record<ProductId, Product> = {
  'saju-report': {
    id: 'saju-report',
    name: '사주 종합 리포트',
    priceKrw: 9900,
    description: '명식·강약·용신·대운·세운을 하나의 글로 풀어 드립니다.',
    previewRatio: 0.2,
  },
  'compat-report': {
    id: 'compat-report',
    name: '궁합 리포트',
    priceKrw: 14900,
    description: '두 명식을 다섯 축으로 대조하고, 맞는 부분과 부딪히는 부분을 함께 씁니다.',
    previewRatio: 0.2,
  },
  'cross-report': {
    id: 'cross-report',
    name: '사주 × 관상 × 손금 교차검증 리포트',
    priceKrw: 19900,
    description: '세 갈래를 같은 척도로 대조해, 일치하는 것과 엇갈리는 것을 가려 드립니다.',
    previewRatio: 0.15,
  },
};

export function getProduct(id: string): Product {
  const product = CATALOG[id as ProductId];
  if (!product) throw new Error(`알 수 없는 상품입니다: ${id}`);
  return product;
}

/**
 * 미리보기 텍스트를 잘라낸다.
 *
 * 전자상거래법상 디지털콘텐츠의 청약철회를 제한하려면 "시험 사용 상품 제공"이
 * 있어야 한다. 미리보기가 그 요건이고, 동시에 구매 판단 근거이기도 하다.
 * 문단 경계에서 자르는 이유: 문장이 잘린 미리보기는 맛보기가 아니라 사고다.
 */
export function makePreview(fullText: string, ratio: number): string {
  const target = Math.floor(fullText.length * ratio);
  const paragraphs = fullText.split(/\n\s*\n/);

  let out = '';
  for (const p of paragraphs) {
    if (out.length > 0 && out.length + p.length > target) break;
    out += (out ? '\n\n' : '') + p;
  }
  return out || paragraphs[0] || '';
}
