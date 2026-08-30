/**
 * 판매 상품.
 *
 * 가격 정책의 근거는 `docs/product-strategy.md`.
 * 무료 구간(단독 풀이 전부)은 여기 없다 — 파는 것은 서술형 리포트뿐이다.
 *
 * 가격을 코드에 두는 이유: 결제 검증 때 **서버가 가진 금액**과 대조해야 하기
 * 때문이다. 클라이언트가 보낸 금액을 믿으면 1원 결제로 리포트를 가져갈 수 있다.
 *
 * ---
 *
 * 상품이 셋에서 열둘로 늘었다. 경쟁사가 상품을 열 개 넘게 파는 방법은
 * 상품을 각각 만드는 것이 아니라 **하나의 명식에서 나온 해석을 주제별로
 * 잘라** 각각 이름을 붙이는 것이다. 계산은 한 번, 파는 건 열 번.
 * 우리 엔진은 이미 그 재료를 다 계산하고 있다 (`packages/saju-rules/src/topics.ts`).
 *
 * 그래서 얻는 것 세 가지.
 * 1. 검색 입구가 는다 — 사람들은 `사주`가 아니라 `재물운 사주`로 검색한다.
 * 2. 재구매가 생긴다 — 돈그릇 산 사람이 다음 달 결혼운을 산다.
 * 3. 가격 사다리가 생긴다 — 첫 결제의 심리적 장벽이 가장 높다.
 */

export type ProductId =
  // 종합
  | 'saju-report' | 'compat-report' | 'cross-report'
  // 시기
  | 'daily-report' | 'newyear-report'
  // 주제별 (packages/saju-rules 의 TopicId 와 짝을 이룬다)
  | 'wealth-report' | 'career-report' | 'expression-report'
  | 'learning-report' | 'peers-report' | 'charm-report'
  | 'travel-report' | 'helper-report';

/** 화면에서 상품을 묶는 갈래. 열두 개를 그냥 늘어놓으면 아무도 못 고른다 */
export type Category = '나' | '돈과 일' | '연애' | '시기';

export interface Product {
  id: ProductId;
  name: string;
  /** 원 단위 정수. 소수점을 쓰지 않는다 */
  priceKrw: number;
  description: string;
  /** 결제 전에 보여줄 미리보기 분량 (전체 대비 비율) */
  previewRatio: number;
  category: Category;
  /**
   * 손님이 실제로 궁금해하는 것을 질문으로.
   * 「재물운」이라고만 쓰면 안 눌린다. 질문이 붙어야 눌린다.
   */
  hook: string;
  /** 짝이 되는 주제. 주제별 상품에만 있다 */
  topic?: string;
}

/**
 * 가격.
 *
 * 시장 조사 결과는 이렇다 — 종합 리포트 한 방은 19,900원 선이고,
 * 프리미엄 단품은 29,900원, 묶음은 49,800~99,000원까지 간다.
 * 우리 천장이 낮았다.
 *
 * **이 숫자는 제안이다.** 바꿀 곳은 여기 한 곳뿐이며, 화면·미리보기·묶음
 * 할인은 전부 이 값에서 계산된다.
 */
const TOPIC_PRICE = 6900;

function topic(
  id: ProductId, topicId: string, name: string, category: Category,
  hook: string, description: string,
): Product {
  return {
    id, name, priceKrw: TOPIC_PRICE, description, previewRatio: 0.25,
    category, hook, topic: topicId,
  };
}

export const CATALOG: Record<ProductId, Product> = {
  // ── 시기 ────────────────────────────────────────────────
  'daily-report': {
    id: 'daily-report',
    name: '오늘의 운세',
    priceKrw: 3900,
    description: '오늘의 간지가 내 명식과 맺는 관계를 하루치로 읽어 드립니다.',
    previewRatio: 0.3,
    category: '시기',
    hook: '오늘 하루, 무엇을 조심할까?',
  },
  'newyear-report': {
    id: 'newyear-report',
    name: '신년운세',
    priceKrw: 14900,
    description: '올해의 세운이 명식과 어떻게 만나는지, 달별 흐름까지 짚어 드립니다.',
    previewRatio: 0.2,
    category: '시기',
    hook: '올해는 나아질까?',
  },

  // ── 종합 ────────────────────────────────────────────────
  'saju-report': {
    id: 'saju-report',
    name: '사주 종합 리포트',
    priceKrw: 19900,
    description: '명식·강약·용신·대운·세운을 하나의 글로 풀어 드립니다.',
    previewRatio: 0.2,
    category: '나',
    hook: '나는 어떤 사람으로 태어났을까?',
  },
  'compat-report': {
    id: 'compat-report',
    name: '궁합 리포트',
    priceKrw: 19900,
    description: '두 명식을 다섯 축으로 대조하고, 맞는 부분과 부딪히는 부분을 함께 씁니다.',
    previewRatio: 0.2,
    category: '연애',
    hook: '이 사람과 오래갈 수 있을까?',
  },
  'cross-report': {
    id: 'cross-report',
    name: '삼합 리포트 — 사주 × 관상 × 손금',
    priceKrw: 29900,
    description: '세 갈래를 같은 척도로 대조해, 일치하는 것과 엇갈리는 것을 가려 드립니다.',
    previewRatio: 0.15,
    category: '나',
    hook: '겉으로 보이는 나와 속의 나는 같을까?',
  },

  // ── 주제별 ──────────────────────────────────────────────
  'wealth-report': topic('wealth-report', 'wealth', '돈그릇', '돈과 일',
    '내 통장은 왜 늘 비어 있을까?',
    '재성(財星)으로 본 재물의 크기와, 그 돈이 어디로 흐르는지를 씁니다.'),
  'career-report': topic('career-report', 'career', '출세운', '돈과 일',
    '이 일을 계속하는 게 맞을까?',
    '관성(官星)으로 본 자리와 명예, 조직에서 내가 놓이는 위치를 씁니다.'),
  'expression-report': topic('expression-report', 'expression', '재능·자녀운', '나',
    '내가 진짜 잘하는 건 뭘까?',
    '식상(食傷)으로 본 표현력과 재능, 그리고 자녀와의 인연을 씁니다.'),
  'learning-report': topic('learning-report', 'learning', '공부·문서운', '돈과 일',
    '시험·계약, 지금이 때일까?',
    '인성(印星)으로 본 배움과 문서운 — 합격·계약·부동산까지 함께 봅니다.'),
  'peers-report': topic('peers-report', 'peers', '사람운', '나',
    '왜 사람 때문에 늘 힘들까?',
    '비겁(比劫)으로 본 동료와 경쟁자, 그리고 내가 사람에게 휘둘리는 자리를 씁니다.'),
  'charm-report': topic('charm-report', 'charm', '매력 삼합', '연애',
    '나는 어떤 사람에게 끌릴까?',
    '도화·홍염을 사주·관상·손금 세 갈래로 대조해, 내 매력이 어디서 나오는지 씁니다.'),
  'travel-report': topic('travel-report', 'travel', '이동·해외운', '시기',
    '떠나야 할까, 머물러야 할까?',
    '역마(驛馬)로 본 이동의 기운 — 이사·이직·해외를 함께 봅니다.'),
  'helper-report': topic('helper-report', 'helper', '귀인운', '나',
    '어려울 때 누가 나를 도울까?',
    '천을귀인(天乙貴人)으로 본, 나를 돕는 사람이 어느 자리에서 오는지 씁니다.'),
};

export const CATEGORIES: { key: Category; question: string }[] = [
  // 「나」라고만 쓰면 안 눌린다. 질문이 붙어야 눌린다
  { key: '나', question: '나는 어떤 사람일까?' },
  { key: '돈과 일', question: '돈과 일은 풀릴까?' },
  { key: '연애', question: '이 사람, 괜찮을까?' },
  { key: '시기', question: '지금이 그때일까?' },
];

export function productsIn(category: Category): Product[] {
  return Object.values(CATALOG).filter((p) => p.category === category);
}

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
