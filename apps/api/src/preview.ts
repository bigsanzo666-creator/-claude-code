/**
 * 결제 전 미리보기.
 *
 * **미리보기를 LLM으로 만들지 않는다.** 이건 원가 계산에서 나온 결론이다.
 * 전환율을 3%로 잡으면, 미리보기를 모델로 만들 경우 판매 1건당
 * 이탈자 33명분의 원가(약 4,400원)가 붙는다. 판매가 19,900원의 22%다.
 * 리포트 본문 원가가 1%인 것과 비교하면 배보다 배꼽이 크다.
 *
 * 그래서 미리보기는 두 가지로 만든다. 둘 다 모델을 부르지 않는다.
 *   1. 이 사람의 실제 룰 엔진 결과에서 뽑은 항목 목록 — "무엇이 담기는지"
 *   2. 다른 명식으로 미리 써둔 예시 리포트의 앞부분 — "어떤 문장으로 나오는지"
 *
 * 전자상거래법이 요구하는 것은 "시험 사용 상품을 제공하는 등의 방법으로
 * 청약철회 권리 행사가 방해받지 않도록" 하는 것이다. 무엇이 담기고 어떤
 * 문장으로 나오는지 둘 다 보여주면 구매 판단에 필요한 정보는 갖춰진다.
 */

import { makePreview, type ProductId } from '../../../packages/commerce/src/index.ts';

/**
 * 예시 리포트. 실제 룰 엔진 출력으로 한 번 만들어 고정해둔 것이며,
 * 특정 사용자의 것이 아니다. 프롬프트를 고치면 이것도 다시 만들어야 한다.
 */
const SAMPLES: Partial<Record<ProductId, string>> = {
  'saju-report': `일간이 경금(庚金)이고, 이 명식은 신강한 편입니다. 일간을 돕는 힘이 전체의 60% 남짓이라 경계선에 가까운 신강이며, 월지가 일간을 돕지 않는 대신 일지가 받쳐주는 구조입니다. 밀고 나가는 힘 자체는 충분하지만, 그 힘이 늘 같은 세기로 나오지는 않는 배치입니다.

눈에 띄는 것은 재성(재물과 현실적 성취를 다루는 기운)이 하나도 없다는 점입니다. 이것을 "돈이 없다"로 읽지는 않습니다. 다만 재물을 다루는 축이 명식 안에 자리 잡고 있지 않아서, 성취를 재물의 형태로 쌓는 일이 저절로 되지는 않는 편입니다. 의식적으로 구조를 만들어야 남는 쪽입니다.

일주가 괴강에 해당합니다. 극단으로 치우치기 쉬운 강한 기운으로 보며, 크게 되거나 크게 꺾인다는 말이 붙는 자리입니다. 시주에 천을귀인이 함께 있어, 몰릴 때 도와주는 사람이 나타나는 배치로 봅니다.

…`,

  'compat-report': `두 분은 서로를 밀어주는 쪽에 가깝습니다. 다만 그 방향이 한쪽으로 기울어 있어, 오래 두면 한 사람이 더 많이 쓰는 구조가 될 수 있는 조합입니다.

일간을 보면 지영 님의 토(土)가 민수 님의 금(金)을 생합니다. 지영 님이 민수 님을 북돋우는 흐름이고, 관계 초반에는 이 방향이 편안하게 작동합니다. 일지끼리는 신자진 수국의 일부를 이뤄, 두 분이 바라보는 방향 자체는 비슷합니다.

가장 무겁게 보는 용신 보완에서는 서로 채워주는 관계로 나옵니다. 다만…

…`,

  'charm-report': `매력을 세 갈래로 대조했습니다. 사주에서는 도화가 일지에 자리하고, 관상에서는 눈매가 부드러운 편이며, 손금에서는 감정선이 길게 뻗습니다. 셋이 같은 쪽을 가리킵니다.

다만 방향이 조금씩 다릅니다. 사주의 도화는 사람을 끌어당기는 쪽이고, 관상의 눈매는 상대를 편안하게 하는 쪽입니다. 앞의 것은 첫인상에서, 뒤의 것은 시간이 지날수록 작동합니다.

…`,

  'cross-report': `세 갈래를 대조한 결과, 여덟 개 항목 중 셋이 같은 방향을 가리키고 넷이 엇갈립니다. 엇갈리는 넷이 이 리포트에서 가장 눈여겨볼 부분입니다.

먼저 겹치는 것부터 보겠습니다. 대인관계·학습·리더십 세 항목에서 사주와 관상과 손금이 모두 같은 쪽을 가리킵니다. 서로 완전히 다른 방식으로 본 결과가 겹친다는 뜻이라, 이 세 가지는 비교적 확신을 갖고 읽으셔도 좋습니다.

문제는 재물입니다. 관상과 손금은 강하다고 보는데 사주는 약하다고 봅니다. 사주에서는 재성이 5%에 그치고, 관상에서는 재백궁인 콧방울이 발달했으며, 손금에서는 운명선이 뚜렷합니다. 타고난 바탕과 지금 드러나는 모습이 어긋나는 지점입니다…

…`,
};

export interface PreviewResult {
  /** 이 리포트에 실제로 담길 항목들 */
  contents: string[];
  /** 예시 리포트 발췌 */
  sample: string;
  /** 예시는 다른 사람의 명식이라는 안내 */
  sampleNotice: string;
}

/** 룰 엔진 결과에서 "무엇이 담기는지"를 뽑아낸다. 모델을 부르지 않는다. */
/**
 * 상품별 예시.
 *
 * 상품이 열셋인데 예시를 열셋 쓸 이유는 없다. 손님이 보는 것은 "이런 식으로
 * 쓰는구나"이지 그 상품 고유의 문장이 아니다. 없으면 같은 갈래의 예시를 쓴다.
 */
export function sampleFor(productId: ProductId): string {
  if (SAMPLES[productId]) return SAMPLES[productId]!;
  const twoPerson = ['crush-compat-report', 'reunion-report', 'parent-child-report'];
  if (twoPerson.includes(productId)) return SAMPLES['compat-report']!;
  if (productId === 'charm-report') return SAMPLES['cross-report']!;
  return SAMPLES['saju-report']!;
}

/** @deprecated `sampleFor()`를 쓸 것 */
export const SAMPLE_REPORTS = new Proxy({} as Record<ProductId, string>, {
  get: (_t, key: string) => sampleFor(key as ProductId),
});

export function buildPreview(productId: ProductId, data: unknown, ratio: number): PreviewResult {
  const d = data as Record<string, any>;
  const contents: string[] = [];

  if (productId === 'compat-report') {
    const cp = d?.궁합;
    if (cp) {
      contents.push(`종합 상성 ${cp.score}점 — ${cp.grade}`);
      for (const axis of cp.axes ?? []) contents.push(`${axis.name}: ${axis.verdict} (${axis.score}점)`);
      if (cp.cautions?.length) contents.push(`주의할 점 ${cp.cautions.length}가지`);
    }
  } else if (productId === 'cross-report') {
    const xv = d?.교차검증;
    if (xv) {
      contents.push(`${xv.sourceCount}가지를 대조 — 일치 ${xv.agreed.length}개, 엇갈림 ${xv.conflicted.length}개`);
      for (const c of xv.conflicted ?? []) contents.push(`엇갈림: ${c.axis}`);
      for (const c of xv.agreed ?? []) contents.push(`일치: ${c.axis}`);
    }
  } else {
    const saju = d ?? {};
    if (saju.명식) {
      contents.push(`명식 ${saju.명식.연주} ${saju.명식.월주} ${saju.명식.일주} ${saju.명식.시주 ?? '—'}`);
    }
    if (saju.강약) contents.push(`일간 강약: ${saju.강약.verdict} (${saju.강약.supportRatio}%)`);
    if (saju.용신) contents.push(`용신: ${(saju.용신.primary ?? []).join('·')}`);
    for (const h of (saju.두드러진_특징 ?? []).slice(0, 3)) contents.push(String(h));
    if (saju.대운?.현재) {
      const cur = saju.대운.현재;
      contents.push(`현재 대운 ${cur.pillar.stem}${cur.pillar.branch} (${cur.startAge}~${cur.endAge}세)`);
    }
  }

  return {
    contents,
    sample: makePreview(SAMPLE_REPORTS[productId], Math.max(ratio, 0.4)),
    sampleNotice: '위 예시는 다른 분의 명식으로 만든 것입니다. 실제 리포트는 위에 나열된 내용으로 작성됩니다.',
  };
}
