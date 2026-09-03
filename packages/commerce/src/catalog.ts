/**
 * 판매 상품.
 *
 * 가격 정책과 경쟁사 분석은 `docs/product-strategy.md`.
 * 무료 구간(단독 풀이 전부)은 여기 없다 — 파는 것은 서술형 리포트뿐이다.
 *
 * 가격을 코드에 두는 이유: 결제 검증 때 **서버가 가진 금액**과 대조해야 하기
 * 때문이다. 클라이언트가 보낸 금액을 믿으면 1원 결제로 리포트를 가져갈 수 있다.
 *
 * ---
 *
 * ## 갈래를 주제가 아니라 **상황**으로 나눈 이유
 *
 * 사람은 "재물운이 궁금해"로 오지 않는다. "헤어졌는데 다시 만날 수 있을까"로 온다.
 * 시장 1위가 「재회」를 「연애」에서 따로 빼놓은 것이 그 증거다 —
 * 수요가 없으면 굳이 탭을 쪼개지 않는다.
 *
 * ## 상품 구성의 전략 (C안)
 *
 * 1위의 24개를 세어 보면 연애 계열이 71%, 재물이 8%다. **돈은 연애에서 나온다.**
 * 그런데 1위의 화면은 20대용이라, 가족 쪽 손님을 데려오지 못한다.
 * 「자녀 사주」 하나가 있을 뿐 **부모 입장에서 보는 상품이 없다.**
 *
 *   입구 — 연애·재회·궁합.  시장이 크니 여기로 들어오게 한다.
 *   차별 — 가족.            아무도 안 하니 여기서 기억되게 한다.
 *
 * 계산은 전부 이미 있는 엔진을 재사용한다. 재회는 궁합 엔진, 결혼 시기는
 * 대운·세운, 자녀 적성은 십신 주제 분리 — 새로 만드는 계산이 없다.
 */

export type ProductId =
  // 연애 — 입구
  | 'charm-report' | 'single-report' | 'marriage-timing-report'
  // 재회
  | 'reunion-report' | 'letgo-report'
  // 궁합
  | 'compat-report' | 'crush-compat-report'
  // 가족 — 차별점
  | 'child-report' | 'child-aptitude-report' | 'parent-child-report' | 'latelife-report'
  // 나
  | 'saju-report' | 'cross-report' | 'peers-report' | 'expression-report' | 'helper-report'
  // 나 — 골라 보기. 삼합이 부담스러운 손님이 한 갈래씩 고른다
  | 'face-palm-report' | 'saju-palm-report' | 'saju-face-report'
  // 돈과 일
  | 'wealth-report' | 'career-report' | 'learning-report'
  // 시기
  | 'daily-report' | 'newyear-report' | 'travel-report';

/**
 * 화면에서 상품을 묶는 갈래.
 *
 * 순서가 곧 화면의 탭 순서다. 앞이 입구, 뒤가 차별점.
 */
export type Category = '연애' | '재회' | '궁합' | '가족' | '나' | '돈과 일' | '시기';

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
  /** 두 사람의 생년월일이 필요한가. 화면이 입력칸을 하나 더 띄운다 */
  needsPartner?: boolean;
  /** 짝이 되는 주제 (`packages/saju-rules` 의 TopicId) */
  topic?: string;
}

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
  // ── 연애 (입구) ──────────────────────────────────────────
  'charm-report': {
    ...topic('charm-report', 'charm', '매력 삼합', '연애',
      '나는 어떤 사람에게 끌릴까?',
      '도화·홍염을 사주·관상·손금 세 갈래로 대조해, 내 매력이 어디서 나오는지 씁니다.'),
    priceKrw: 12900,
  },
  'single-report': {
    id: 'single-report',
    name: '솔로 탈출 — 언제 만날까',
    priceKrw: 12900,
    description: '인연이 들어오는 시기를 대운·세운에서 찾고, 그때 내가 어떤 상태일지 함께 씁니다.',
    previewRatio: 0.2,
    category: '연애',
    hook: '나는 언제쯤 만날 수 있을까?',
  },
  'marriage-timing-report': {
    id: 'marriage-timing-report',
    name: '결혼 시기',
    priceKrw: 19900,
    description: '배우자 자리와 대운의 흐름을 대조해 결혼이 무르익는 구간을 짚습니다.',
    previewRatio: 0.2,
    category: '연애',
    hook: '결혼, 언제쯤이 좋을까?',
  },

  // ── 재회 ────────────────────────────────────────────────
  'reunion-report': {
    id: 'reunion-report',
    name: '재회 가능성',
    priceKrw: 19900,
    description: '두 명식의 합·충 관계와 올해의 흐름을 대조해, 다시 이어질 여지와 그 조건을 씁니다.',
    previewRatio: 0.15,
    category: '재회',
    hook: '다시 만날 수 있을까?',
    needsPartner: true,
  },

  /**
   * 재회 칸의 두 번째.
   *
   * 재회를 보러 오는 사람의 절반은 사실 「돌아올까」가 아니라
   * 「언제까지 이래야 하나」를 묻는다. 그런데 우리에게는 앞의 질문만 있었다.
   *
   * 돌아온다고 지어내지 않는다. **언제 마음이 가벼워지는지**를 대운·세운에서
   * 짚어 주는 것이 우리가 실제로 할 수 있는 일이다.
   */
  'letgo-report': {
    id: 'letgo-report',
    name: '마음 정리 — 언제쯤 괜찮아질까',
    priceKrw: 14900,
    description: '대운과 세운의 흐름에서 이 마음이 가벼워지는 구간을 짚습니다. 돌아온다고 지어내지 않습니다.',
    previewRatio: 0.2,
    category: '재회',
    hook: '언제쯤 괜찮아질까?',
  },

  // ── 궁합 ────────────────────────────────────────────────
  'compat-report': {
    id: 'compat-report',
    name: '궁합 리포트',
    priceKrw: 19900,
    description: '두 명식을 다섯 축으로 대조하고, 맞는 부분과 부딪히는 부분을 함께 씁니다.',
    previewRatio: 0.2,
    category: '궁합',
    hook: '이 사람과 오래갈 수 있을까?',
    needsPartner: true,
  },
  'crush-compat-report': {
    id: 'crush-compat-report',
    name: '썸 궁합',
    priceKrw: 9900,
    description: '아직 시작하지 않은 관계를, 두 명식의 첫 끌림 축만 뽑아 가볍게 봅니다.',
    previewRatio: 0.3,
    category: '궁합',
    hook: '이 사람, 나한테 관심 있을까?',
    needsPartner: true,
  },

  // ── 가족 (차별점) ────────────────────────────────────────
  'child-report': {
    id: 'child-report',
    name: '우리 아이 사주',
    priceKrw: 19900,
    description: '아이의 명식을 부모가 읽을 수 있게 풀어, 타고난 기질과 키울 때 볼 것을 씁니다.',
    previewRatio: 0.2,
    category: '가족',
    hook: '우리 아이는 어떤 아이일까?',
  },
  'child-aptitude-report': {
    id: 'child-aptitude-report',
    name: '자녀 진로·적성',
    priceKrw: 19900,
    description: '식상·인성·관성의 배치로 아이가 잘 쓰는 힘과 안 맞는 길을 가려 씁니다.',
    previewRatio: 0.2,
    category: '가족',
    hook: '이 아이는 뭘 시켜야 할까?',
  },
  'parent-child-report': {
    id: 'parent-child-report',
    name: '부모·자식 궁합',
    priceKrw: 19900,
    description: '부모와 자녀의 명식을 대조해, 왜 부딪히는지와 어떻게 물러서면 되는지를 씁니다.',
    previewRatio: 0.2,
    category: '가족',
    hook: '왜 이 아이와는 늘 부딪힐까?',
    needsPartner: true,
  },
  'latelife-report': {
    id: 'latelife-report',
    name: '노후·말년운',
    priceKrw: 19900,
    description: '시주와 후반 대운을 중심으로, 남은 흐름에서 무엇을 준비하면 되는지 씁니다.',
    previewRatio: 0.2,
    category: '가족',
    hook: '내 노후는 어떨까?',
  },

  // ── 나 ──────────────────────────────────────────────────
  'saju-report': {
    id: 'saju-report',
    name: '사주 종합 리포트',
    priceKrw: 19900,
    description: '명식·강약·용신·대운·세운을 하나의 글로 풀어 드립니다.',
    previewRatio: 0.2,
    category: '나',
    hook: '나는 어떤 사람으로 태어났을까?',
  },
  /**
   * 간판 상품.
   *
   * 국내에서 세 갈래를 같은 척도로 대조하는 곳이 없다. 시장 1위의 최상위
   * 상품(사주 + 점성술, 두 체계)이 69,000원인데, 우리는 세 체계를 대조하면서
   * 그보다 싸게 팔 이유가 없다.
   */
  'cross-report': {
    id: 'cross-report',
    name: '삼합 리포트 — 사주 × 관상 × 손금',
    priceKrw: 49000,
    description: '세 갈래를 같은 척도로 대조해, 일치하는 것과 엇갈리는 것을 가려 드립니다.',
    previewRatio: 0.12,
    category: '나',
    hook: '겉으로 보이는 나와 속의 나는 같을까?',
  },
  /**
   * 골라 보기 세 가지.
   *
   * 삼합(49,000원)은 우리만 하는 것이지만, 처음 온 손님에게는 큰 값이다.
   * 그렇다고 사주 하나만 보면 우리에게 올 이유가 없다 — 그건 어디서나 한다.
   *
   * 그래서 **두 갈래씩 대조하는 것**을 사이에 둔다. 우리가 잘하는 대조는
   * 그대로 하면서, 값은 삼합의 절반이다.
   */
  'face-palm-report': {
    id: 'face-palm-report',
    name: '얼굴과 손 — 관상 × 손금',
    priceKrw: 24000,
    description: '생년월일 없이 얼굴과 손만으로 봅니다. 두 갈래가 같은 말을 하는 곳과 엇갈리는 곳을 가려 씁니다.',
    previewRatio: 0.15,
    category: '나',
    hook: '생년월일 없이도 볼 수 있을까?',
  },
  'saju-palm-report': {
    id: 'saju-palm-report',
    name: '타고난 것과 살아온 것 — 사주 × 손금',
    priceKrw: 29000,
    description: '태어날 때 정해진 것(사주)과 살면서 새겨진 것(손금)을 맞춰 봅니다.',
    previewRatio: 0.15,
    category: '나',
    hook: '타고난 대로 살고 있을까?',
  },
  'saju-face-report': {
    id: 'saju-face-report',
    name: '속과 겉 — 사주 × 관상',
    priceKrw: 29000,
    description: '사주가 말하는 속과 얼굴이 말하는 겉을 대조합니다. 남들이 보는 나와 진짜 나의 거리를 씁니다.',
    previewRatio: 0.15,
    category: '나',
    hook: '남들이 보는 나는 진짜 나일까?',
  },

  'expression-report': topic('expression-report', 'expression', '재능운', '나',
    '내가 진짜 잘하는 건 뭘까?',
    '식상(食傷)으로 본 표현력과 재능, 밖으로 내놓는 힘을 씁니다.'),
  'peers-report': topic('peers-report', 'peers', '사람운', '나',
    '왜 사람 때문에 늘 힘들까?',
    '비겁(比劫)으로 본 동료와 경쟁자, 내가 사람에게 휘둘리는 자리를 씁니다.'),
  'helper-report': topic('helper-report', 'helper', '귀인운', '나',
    '어려울 때 누가 나를 도울까?',
    '천을귀인(天乙貴人)으로 본, 나를 돕는 사람이 어느 자리에서 오는지 씁니다.'),

  // ── 돈과 일 ─────────────────────────────────────────────
  'wealth-report': topic('wealth-report', 'wealth', '돈그릇', '돈과 일',
    '내 통장은 왜 늘 비어 있을까?',
    '재성(財星)으로 본 재물의 크기와, 그 돈이 어디로 흐르는지를 씁니다.'),
  'career-report': topic('career-report', 'career', '출세운', '돈과 일',
    '이 일을 계속하는 게 맞을까?',
    '관성(官星)으로 본 자리와 명예, 조직에서 내가 놓이는 위치를 씁니다.'),
  'learning-report': topic('learning-report', 'learning', '공부·문서운', '돈과 일',
    '시험·계약, 지금이 때일까?',
    '인성(印星)으로 본 배움과 문서운 — 합격·계약·부동산까지 함께 봅니다.'),

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
  'travel-report': topic('travel-report', 'travel', '이동·해외운', '시기',
    '떠나야 할까, 머물러야 할까?',
    '역마(驛馬)로 본 이동의 기운 — 이사·이직·해외를 함께 봅니다.'),
};

/**
 * 갈래와 그 제목.
 *
 * 「연애」라고만 쓰면 안 눌린다. 질문이 붙어야 눌린다.
 * 순서는 화면의 탭 순서이고, 앞이 손님이 많이 들어오는 입구다.
 */
export const CATEGORIES: { key: Category; question: string }[] = [
  { key: '연애', question: '이 사람, 어떨까?' },
  { key: '재회', question: '다시 만날 수 있을까?' },
  { key: '궁합', question: '우리, 잘 맞을까?' },
  { key: '가족', question: '우리 아이는 어떤 아이일까?' },
  { key: '나', question: '나는 어떤 사람일까?' },
  { key: '돈과 일', question: '먹고사는 일은 풀릴까?' },
  { key: '시기', question: '지금이 그때일까?' },
];

export function productsIn(category: Category): Product[] {
  return Object.values(CATALOG).filter((p) => p.category === category);
}

/** 상대의 생년월일이 필요한 상품. 화면이 입력칸을 하나 더 띄운다 */
export function needsPartner(id: ProductId): boolean {
  return CATALOG[id]?.needsPartner === true;
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
