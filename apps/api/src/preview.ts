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

  'pick-report': `후보로 주신 세 날, 다섯 시간대를 모두 재어 보았습니다. 앞선 것은 4월 30일 오후 4시에서 5시 사이입니다. 70.4점으로 「아주 좋음」에 들어갑니다. 바로 뒤가 4월 27일 같은 시간대로 69.9점이니, 이 둘은 사실상 붙어 있습니다. 병원 사정이 편한 쪽으로 고르셔도 됩니다.

먼저 점수를 어떻게 읽어야 하는지부터 말씀드립니다. 이 숫자는 절대 점수가 아니라 **후보들 사이에서 견주는 눈금**입니다. 여덟 글자 중 연주와 월주는 그 기간에 이미 정해져 있어, 우리가 고를 수 있는 것은 일주와 시주 절반뿐입니다. 그래서 100점은 구조적으로 나오지 않고, 70점이면 아주 좋은 편에 듭니다.

1순위인 4월 30일 오후 4시대에 태어나면 여덟 글자는 정미 갑진 기묘 임신으로 섭니다. 일간을 돕는 힘이 48%로 한가운데에 있어 세지도 약하지도 않습니다. 부딪히는 자리(충)가 한 군데도 없고, 천을귀인이 붙습니다. 뻗어 나가는 기운 쪽으로 조금 치우쳐 있는데, 이것은 깎는 요소로 넣어 계산한 뒤에도 남은 점수입니다.

2순위인 4월 27일 오후 4시대는 정미 갑진 병자 병신입니다. 힘이 50%로 더 정확히 가운데이고 충도 없습니다. 1순위와 갈린 것은 귀인 하나 차이입니다…

한편 5월 3일 오후 1시대는 8.3점으로 「피하는 게 낫다」에 들어갑니다. 이유를 감추지 않고 적습니다. 신약으로, 일간을 돕는 힘이 15%밖에 되지 않습니다. 타오르는 기운으로 크게 치우쳐 있고, 자르고 맺는 기운이 아예 없으며, 부딪히는 자리도 한 군데 있습니다.

다만 이 값은 **의사 선생님이 이미 된다고 하신 날들 중에서 고른 것**입니다. 여기서 좋게 나온 날이 의학적으로 괜찮은 날이라는 뜻이 아닙니다. 산모와 아기의 몸이 먼저입니다…

…`,

  'marriage-pick-report': `신랑과 신부 두 분의 여덟 글자를 함께 세우고, 원하시는 기간 안의 날들을 하나씩 견주어 보았습니다. 가장 앞선 것은 10월 18일입니다. 89점으로 「아주 좋음」에 들어갑니다. 두 사람의 기운을 서로 돕는 글자가 모이고, 부딪히는 자리가 없어 새 출발의 날로 가장 순탄합니다.

먼저 이 점수를 읽는 법부터 말씀드립니다. 이 점수는 100점 만점의 절대 점수가 아니라, **주신 기간 안에서 서로 견주는 눈금**입니다. 80점 이상이면 두 사람의 글자와 부딪힘 없이 화합하는 날이고, 65점 이상이면 순탄한 날입니다.

1순위로 꼽힌 10월 18일은 병오년 무술월 을축일입니다. 신랑의 일간과 그날의 천간이 서로 조화를 이루며 화합하고, 어려움을 풀어 주는 길신(천을귀인)의 기운이 신랑에게 닿습니다. 신부의 일지와도 충돌이 없어 양가 모두 편안한 기운으로 치를 수 있습니다…

…`,

  'naming-report': `도윤이 아버님, 아이의 사주부터 말씀드립니다.

아이는 제 힘이 센 편입니다. 자기를 돕는 기운이 열 중 일곱쯤 되니, 더 보태는 것보다 **덜어내 주는 쪽**이 이롭습니다. 그래서 채워야 할 기운은 품고 버티는 기운(토), 자르고 맺는 기운(금), 흐르고 스며드는 기운(수) 셋입니다.

성이 김(金) 여덟 획이니, 여기에 붙일 수 있는 획수는 정해집니다. 네 자리 획수가 모두 길하게 서는 짝만 골라 그중에서 지었습니다.

**하나. 김도윤 金度玧**

도(度)는 「법도·헤아리다」입니다. 자를 대고 재는 글자라 자르고 맺는 기운을 지녔습니다. 윤(玧)은 「붉은 구슬」입니다. 옥 변이 붙어 흐르는 기운을 함께 봅니다.

아이에게 필요한 두 기운이 한 이름에 다 들었습니다. 힘이 센 아이는 스스로 멈출 자리를 알아야 하는데, 도(度) 자가 그 자리를 짚어 줍니다.

소리는 「김도윤」. 세 글자가 다 열려 있어 부르기 편하고, 받침이 마지막에만 있어 끝이 단정합니다.

**둘. 김서진 金瑞珍**

…

**획수는 이렇게 봤습니다**

| 때 | 무엇을 더한 것 | 획수 | 뜻 |
|---|---|---|---|
| 초년운 | 이름 두 글자 | 18획 | 발전격 — 뻗어 나가는 수 |
| 청년운 | 성 + 앞 글자 | 17획 | 건창격 — 굳세게 이루는 수 |
| 장년운 | 성 + 끝 글자 | 16획 | 덕망격 — 사람이 따르는 수 |
| 전체운 | 전부 | 25획 | 안강격 — 편안히 이루는 수 |

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

export interface FortunePoint {
  /** 큰 글씨 쉬운 말 */
  title: string;
  /** 구체적이고 따뜻한 실제 점사 풀이 문장 */
  text: string;
  /** 어느 글자에서 나왔는지 밝히는 근거 */
  basis: string;
  /** 명리 용어 */
  term: string;
  /** 용어 한 줄 뜻 */
  termDesc: string;
}

export interface PreviewResult {
  /** 이 리포트에 실제로 담길 항목들 */
  contents: string[];
  /** 예시 리포트 발췌 */
  sample: string;
  /** 예시는 다른 사람의 명식이라는 안내 */
  sampleNotice: string;
  /** 실제 고객 사주 기반 맛보기 점사 */
  fortunePoints?: FortunePoint[];
  /** 맛보기 점사 요약 텍스트 */
  text?: string;
}

const DAY_STEM_PROFILES: Record<string, { title: string; term: string; termDesc: string; text: string; element: string }> = {
  갑: {
    title: '곧고 단단하게 뿌리내려 길을 여는 개척의 기운',
    term: '일간(日干) 갑목(甲木)',
    termDesc: '태어난 날의 천간이자 나 자신을 뜻하며, 큰 나무처럼 주도적이고 곧은 본성',
    text: '남의 시선에 흔들리기보다 내 뜻을 단단히 세우고 나아갈 때 스스로 성취를 일구어내는 바탕을 지녔습니다.',
    element: '목',
  },
  을: {
    title: '어떤 환경에서도 길을 찾아 피어나는 유연한 생명력',
    term: '일간(日干) 을목(乙木)',
    termDesc: '태어난 날의 천간이자 나 자신을 뜻하며, 풀꽃이나 담쟁이처럼 적응력과 친화력이 뛰어난 본성',
    text: '굳이 부딪쳐 꺾이기보다 부드럽게 돌아가며 사람과 상황을 내 편으로 만드는 타고난 지혜가 돋보입니다.',
    element: '목',
  },
  병: {
    title: '주변을 환하게 비추며 에너지를 북돋우는 열정',
    term: '일간(日干) 병화(丙火)',
    termDesc: '태어난 날의 천간이자 나 자신을 뜻하며, 하늘의 태양처럼 당당하고 숨김없는 본성',
    text: '매사를 솔직하게 대하며, 어두운 자리를 밝히고 사람들의 활력을 이끌어내는 힘이 있습니다.',
    element: '화',
  },
  정: {
    title: '은근한 온기로 주위를 감싸며 몰입하는 통찰력',
    term: '일간(日干) 정화(丁火)',
    termDesc: '태어난 날의 천간이자 나 자신을 뜻하며, 등불이나 촛불처럼 따뜻하고 한곳에 깊이 파고드는 본성',
    text: '드러나지 않아도 한 가지에 집중하는 끈기와 사람의 마음을 섬세하게 어루만지는 안목이 남다릅니다.',
    element: '화',
  },
  무: {
    title: '묵묵히 중심을 잡고 품어주는 듬직한 신뢰감',
    term: '일간(日干) 무토(戊土)',
    termDesc: '태어난 날의 천간이자 나 자신을 뜻하며, 거대한 산처럼 묵직하고 믿음직한 본성',
    text: '사소한 파도에 쉽게 일희일비하지 않고, 곁에 있는 이들에게 안정감과 든든한 의지가 되어 줍니다.',
    element: '토',
  },
  기: {
    title: '곡식을 길러내듯 알뜰하고 섬세하게 챙기는 실속',
    term: '일간(日干) 기토(己土)',
    termDesc: '태어난 날의 천간이자 나 자신을 뜻하며, 비옥한 논밭처럼 포용력 있고 현실 감각이 뛰어난 본성',
    text: '겉치레보다 실질적인 가치를 소중히 여기며, 꼼꼼한 관리와 살핌으로 성장의 결실을 맺는 힘이 있습니다.',
    element: '토',
  },
  경: {
    title: '맺고 끊음이 확실하며 원칙을 지키는 단호한 결단력',
    term: '일간(日干) 경금(庚金)',
    termDesc: '태어난 날의 천간이자 나 자신을 뜻하며, 바위나 강철처럼 단단하고 의리가 곧은 본성',
    text: '흐지부지한 타협을 싫어하며, 한 번 옳다고 여긴 기준은 끝까지 지켜내어 결실을 맺는 기운입니다.',
    element: '금',
  },
  신: {
    title: '원석을 깎아 보석을 만들듯 정교하고 예리한 감각',
    term: '일간(日干) 신금(辛金)',
    termDesc: '태어난 날의 천간이자 나 자신을 뜻하며, 잘 벼려진 보석처럼 섬세하고 완벽을 기하는 본성',
    text: '남들이 보지 못하는 디테일을 포착해내며, 고유한 품격과 깔끔한 일처리로 독보적인 빛을 냅니다.',
    element: '금',
  },
  임: {
    title: '넓은 바다처럼 유연하게 흐르며 지혜를 모으는 포용',
    term: '일간(日干) 임수(壬水)',
    termDesc: '태어난 날의 천간이자 나 자신을 뜻하며, 큰 강과 바다처럼 막힘없이 흘러 세상을 담아내는 본성',
    text: '형식에 얽매이지 않고 큰 그림을 그리며, 어떤 상황에서도 유연하게 해결책을 찾아내는 지혜가 있습니다.',
    element: '수',
  },
  계: {
    title: '조용히 스며들어 메마른 자리를 적시는 기지와 감수성',
    term: '일간(日干) 계수(癸水)',
    termDesc: '태어난 날의 천간이자 나 자신을 뜻하며, 봄비나 이슬처럼 맑고 촉촉하게 스며드는 본성',
    text: '눈치가 빠르고 상대의 마음을 민감하게 헤아리며, 은근하고 끈기 있게 사람을 감화시키는 힘이 있습니다.',
    element: '수',
  },
};

const YONGSIN_PROFILES: Record<string, { title: string; term: string; termDesc: string; text: string }> = {
  목: {
    title: '새로운 시작과 배움으로 생기를 돋우는 활력의 열쇠',
    term: '희용신 목(木) 기운',
    termDesc: '기운의 정체를 풀고 새로운 생명력을 불어넣는 이로운 기운',
    text: '기운이 멈추거나 막힌 것이 아니며, 가벼운 산책이나 새로운 지식을 접하는 것만으로도 운의 흐름이 한층 시원하게 트입니다.',
  },
  화: {
    title: '따뜻한 온기와 적극적인 표현으로 결실을 맺는 열쇠',
    term: '희용신 화(火) 기운',
    termDesc: '어두운 자리를 밝히고 열정과 활력을 채워주는 이로운 기운',
    text: '혼자 삭이지 않고 생각을 솔직하게 표현하거나 밝고 따뜻한 온기를 가까이하면 가려졌던 기회가 선명히 드러납니다.',
  },
  토: {
    title: '마음의 중심을 굳건히 다지고 실속을 갈무리하는 열쇠',
    term: '희용신 토(土) 기운',
    termDesc: '흔들림을 잡아주고 차분하게 중심을 세워주는 이로운 기운',
    text: '서두르지 않고 매일의 루틴을 차분히 지키며 내 자리를 정돈할 때 쌓아온 노력이 단단한 성과로 맺힙니다.',
  },
  금: {
    title: '불필요한 것은 덜어내고 핵심에 집중하는 정돈의 열쇠',
    term: '희용신 금(金) 기운',
    termDesc: '복잡한 생각을 가라앉히고 명확한 기준과 매듭을 짓는 이로운 기운',
    text: '결코 길이 막힌 것이 아니며, 우선순위를 세워 깔끔하게 정돈하고 집중할 때 정체되었던 일들이 일사천리로 풀려나갑니다.',
  },
  수: {
    title: '경직된 틀을 풀고 물처럼 부드럽게 돌아가는 순환의 열쇠',
    term: '희용신 수(水) 기운',
    termDesc: '굳은 것을 부드럽게 녹이고 넓은 지혜와 여유를 더하는 이로운 기운',
    text: '벽을 정면으로 부수려 하기보다 물처럼 자연스럽게 우회하고 한 호흡 쉬어갈 때 모든 얽힌 실타래가 자연스럽게 풀립니다.',
  },
};

/**
 * 손님의 실제 사주 룰 엔진 결과에서 뽑은 진짜 맛보기 점사.
 * 모델을 일절 부르지 않으며, 룰 결과의 근거 글자를 명확히 밝힌다.
 */
export function extractFortunePoints(d: Record<string, any>, productId: ProductId): FortunePoint[] {
  const points: FortunePoint[] = [];

  // 1) 택일 계열 상품 처리
  if (productId === 'pick-report' || productId === 'marriage-pick-report') {
    const top = d?.순위?.[0] || d?.제일좋은날?.[0];
    if (top) {
      points.push({
        title: '부딪힘 없이 순탄하게 뻗어 나가는 온화한 기운의 때',
        term: `1순위 길일 선정 (${top.날} ${top.때 || ''})`.trim(),
        termDesc: '사주의 충(沖)을 피하고 서로의 기운이 조화롭게 화합하는 최적의 날',
        text: '무리하게 애쓰지 않아도 자연스럽게 기운이 합을 이루어 평온하고 길한 출발을 돕는 배치입니다.',
        basis: `후보 중 가장 높은 점수를 받은 1순위 날짜의 여덟 글자(${top.여덟글자 || '일진'})에서 나옴`,
      });
      points.push({
        title: '어려움을 풀어주고 돕는 길신의 보살핌',
        term: '천을귀인(天乙貴人) 및 화합',
        termDesc: '위기나 막힘을 풀어주고 귀인의 조력을 이끌어내는 상서로운 기운',
        text: '새로운 시작을 맞이할 때 주변 사람들의 축복과 순조로운 도움이 닿는 흐름입니다.',
        basis: (top.까닭 && top.까닭[0]) ? String(top.까닭[0]) : '길일의 일진과 사주 상생 관계에서 나옴',
      });
      points.push({
        title: '치우치지 않고 균형을 맞추는 조화로운 선택',
        term: '생기(生氣) 보전의 원리',
        termDesc: '절대 점수가 아닌 후보들 사이에서 서로의 부족함을 가장 잘 채워주는 균형',
        text: '앞선 자리를 취함으로써 번잡한 기운을 덜어내고 든든한 안정감을 품을 수 있습니다.',
        basis: '후보 날짜 및 시간대별 오행 상생 룰 분석에서 나옴',
      });
      return points;
    }
  }

  // 2) 작명 계열 상품 처리
  if (productId === 'naming-report' || productId === 'naming-plus-report') {
    const need = d?.채워야할기운;
    const needEls = (need?.오행 || ['목']) as string[];
    const firstEl = needEls[0] || '목';
    const profile = YONGSIN_PROFILES[firstEl] || YONGSIN_PROFILES['목'];
    points.push({
      title: '아이의 명식에 부족한 기운을 채워주는 균형의 이름',
      term: `용신(用神) 보완 — ${needEls.join('·')} 기운`,
      termDesc: '사주의 치우침을 바로잡고 아이의 타고난 기세를 가장 건강하게 돕는 기운',
      text: '부족한 기운이 막힌 것이 아니라, 이름의 글자로 따뜻하게 채워주면 평생의 든든한 날개가 됩니다.',
      basis: `아이 사주의 강약과 오행 분포 분석(${need?.까닭 || '사주 조화 분석'})에서 나옴`,
    });
    points.push({
      title: '네 가지 운(초·청·장·전체)이 모두 길하게 서는 획수의 조화',
      term: '원형이정 4격(四格) 길수',
      termDesc: '성씨와 이름 두 글자의 획수를 합하여 인생의 사계절을 모두 길하게 세우는 수리',
      text: '부르기 편안하고 끝이 단정하며, 획수마다 성취와 복덕이 깃들도록 길한 짝을 짓습니다.',
      basis: `성씨 획수와 대법원 인명용 한자의 획수 짝 배합에서 나옴`,
    });
    points.push({
      title: profile.title,
      term: profile.term,
      termDesc: profile.termDesc,
      text: profile.text,
      basis: '아이 사주의 용신 및 오행 배합에서 나옴',
    });
    return points;
  }

  // 3) 일반 사주/궁합/운세 상품: 손님의 실제 사주 정보 추출
  const rawDayStem = d?.일간?.stem
    || d?.손님의_바탕?.일간?.stem
    || d?.내일간?.stem
    || d?.아이사주?.일간?.stem
    || d?.A?.일간?.stem
    || (d?.명식?.일주 ? d.명식.일주.charAt(0) : '')
    || '';
  const dayStem = rawDayStem.replace(/[^갑을병정무기경신임계]/g, '').charAt(0) || '갑';
  const stemProfile = DAY_STEM_PROFILES[dayStem] || DAY_STEM_PROFILES['갑'];

  // 첫 번째 점사: 타고난 기질과 중심 기운 (일간)
  points.push({
    title: stemProfile.title,
    term: stemProfile.term,
    termDesc: stemProfile.termDesc,
    text: stemProfile.text,
    basis: `태어난 날의 중심 글자인 일주 천간 ${stemProfile.term.split(' ')[1] || dayStem}에서 비롯됨`,
  });

  // 두 번째 점사: 활동력과 현실의 강점 (신강/신약/중화 및 십신)
  const strengthVerdict = String(d?.강약?.verdict || d?.손님의_바탕?.강약?.verdict || d?.아이사주?.강약?.verdict || '');
  if (strengthVerdict === '신강') {
    points.push({
      title: '외부의 압박을 딛고 제 힘으로 길을 개척하는 추진력',
      term: '신강(身强) 명식의 기세',
      termDesc: '나를 돕는 기운이 탄탄하여 남에게 기대지 않고 스스로 판을 짜는 힘',
      text: '주변의 상황을 살피며 주저하기보다는 확신을 가지고 먼저 움직일 때 뜻밖의 결실을 크게 거둡니다.',
      basis: `사주 일간을 받쳐주는 힘이 두터운 신강(身强) 구조에서 나옴`,
    });
  } else if (strengthVerdict === '신약') {
    points.push({
      title: '흐름을 예리하게 파악하고 기회를 포착하는 유연한 지혜',
      term: '신약(身弱) 명식의 유연성',
      termDesc: '혼자 모든 짐을 지기보다 주변의 흐름과 조력자를 지혜롭게 활용하는 힘',
      text: '무리하게 홀로 부딪치기보다 상황의 맥락을 읽고 타이밍을 재어 실속을 취할 때 가장 크게 성취합니다.',
      basis: `상황에 기민하게 반응하고 조화를 이루는 신약(身弱) 구조에서 나옴`,
    });
  } else {
    points.push({
      title: '치우침 없이 흔들리지 않는 균형감과 끈기',
      term: '중화(中和) 명식의 균형',
      termDesc: '미는 힘과 버티는 힘이 고르게 어우러져 기복 없이 오래 이어지는 바탕',
      text: '급격한 부침에 휩쓸리지 않고 차분하게 중심을 지켜내며 지속 가능한 성취를 쌓아갑니다.',
      basis: `사주 오행의 비중이 한쪽으로 쏠리지 않은 조화로운 균형에서 나옴`,
    });
  }

  // 세 번째 점사: 나를 일으켜 세우는 이로운 기운과 개운법 (용신)
  const rawYongsin = Array.isArray(d?.용신?.primary) ? d.용신.primary[0] : '';
  const rawWant = Array.isArray(d?.오늘의_처방전?.나를_돕는_기운) ? d.오늘의_처방전.나를_돕는_기운[0] : '';
  let yongEl = '목';
  if (rawWant && YONGSIN_PROFILES[rawWant]) yongEl = rawWant;
  else if (rawYongsin && YONGSIN_PROFILES[rawYongsin]) yongEl = rawYongsin;
  else {
    // 일간 상극/상생에 따른 기본 조화 오행 배분
    const el = stemProfile.element;
    yongEl = el === '목' ? '화' : el === '화' ? '토' : el === '토' ? '금' : el === '금' ? '수' : '목';
  }
  const yongProfile = YONGSIN_PROFILES[yongEl] || YONGSIN_PROFILES['목'];

  points.push({
    title: yongProfile.title,
    term: yongProfile.term,
    termDesc: yongProfile.termDesc,
    text: yongProfile.text,
    basis: `사주의 오행 균형과 흐름을 조율하는 용신(用神) 분석에서 비롯됨`,
  });

  return points;
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

/** 예시가 누구 것인지 밝힌다. 갈래마다 「누구」가 다르다 */
export function sampleNoticeFor(productId: ProductId): string {
  if (productId === 'pick-report') {
    return '위 예시는 다른 분이 받은 후보 날짜로 만든 것입니다. 실제 리포트는 위에 나열된 내용으로 작성됩니다.';
  }
  if (productId === 'naming-report' || productId === 'naming-plus-report') {
    return '위 예시는 다른 아이의 사주와 성으로 지은 것입니다. 실제로는 위에 적힌 글자들 안에서 지어 드립니다.';
  }
  return '위 예시는 다른 분의 명식으로 만든 것입니다. 실제 리포트는 위에 나열된 내용으로 작성됩니다.';
}

export function buildPreview(productId: ProductId, data: unknown, ratio: number): PreviewResult {
  const d = data as Record<string, any>;
  const contents: string[] = [];

  // 손님의 실제 명식/데이터에서 뽑은 진짜 맛보기 점사 생성 (모델 호출 없음)
  const fortunePoints = extractFortunePoints(d, productId);
  if (fortunePoints.length > 0) {
    for (const fp of fortunePoints) {
      contents.push(`[맛보기 점사] ${fp.title} — 근거: ${fp.basis}`);
    }
  }

  if (productId === 'compat-report') {
    const cp = d?.궁합;
    if (cp) {
      contents.push(`종합 상성 ${cp.score}점 — ${cp.grade}`);
      for (const axis of cp.axes ?? []) contents.push(`${axis.name}: ${axis.verdict} (${axis.score}점)`);
      if (cp.cautions?.length) contents.push(`주의할 점 ${cp.cautions.length}가지`);
    }
  } else if (d?.끌림과_결) {
    // 썸 — 두 축만 본다. 오래갈지는 궁합 리포트가 본다
    contents.push(d.보는_축);
    for (const axis of d.끌림과_결.axes ?? []) {
      contents.push(`${axis.name}: ${axis.verdict} (${axis.score}점)`);
    }
    contents.push(`내 매력이 어디서 나오는지 — ${d.A?.매력?.term} ${d.A?.매력?.count}자리`);
    contents.push(`상대의 매력 자리도 함께 — ${d.B?.매력?.term} ${d.B?.매력?.count}자리`);
    contents.push('상대의 마음을 읽어 드리지는 않습니다');
  } else if (d?.다시_닿는_때) {
    // 재회 — 다섯 축 + 언제 다시 닿는가
    const cp = d.관계;
    contents.push(`종합 상성 ${cp.score}점 — ${cp.grade}`);
    for (const axis of cp.axes ?? []) contents.push(`${axis.name}: ${axis.verdict} (${axis.score}점)`);
    const 달 = (d.다시_닿는_때.달마다 ?? []) as any[];
    contents.push(`앞으로 세 해를 **달마다** — 모두 ${달.length}달`);
    contents.push('두 사람 자리가 다시 묶이는 달을 짚어 드립니다');
    contents.push('돌아온다고 약속하는 글이 아닙니다');
  } else if (d?.맞물리는_짝) {
    /*
     * 명절 가족운세 — 결제 전에 **무엇을 세었는지**를 보여 준다.
     *
     * 짝의 점수는 여기서 까지 않는다. 그건 사고 나서 볼 것이다.
     * 대신 몇 사람을 몇 짝으로 셌는지, 어느 축으로 봤는지를 밝혀 둔다.
     */
    const 짝 = (d.맞물리는_짝 ?? []) as any[];
    const 사람 = (d.한_상에_앉는_사람 ?? []) as string[];
    contents.push(`${d.연휴?.이름 ? d.연휴.이름 + ' ' : ''}연휴 ${(d.연휴?.날들 ?? []).length}일을 **날마다** 봄`);
    for (const 날 of (d.연휴_날마다 ?? []) as any[]) {
      contents.push(`${날.date} — ${날.pillar?.stem}${날.pillar?.branch} 일진, 내 기운과 ${날.favor}`);
    }
    contents.push(`한 상에 앉는 ${사람.length}명: ${사람.join(' · ')}`);
    contents.push(`맞물리는 짝 ${짝.length}쌍을 **하나씩** — 나를 사이에 두지 않는 짝까지`);
    contents.push('짝마다 일간·일지·용신·오행·전체 다섯 축으로 재고 근거를 붙임');
    contents.push('누가 잘못했는지 가리지 않습니다');
  } else if (d?.맞물림) {
    // 부모 자식 — 배우자 자리는 뺀다. 점수도 앞세우지 않는다
    contents.push(d.뺀_축);
    for (const axis of d.맞물림.axes ?? []) contents.push(`${axis.name}: ${axis.verdict}`);
    contents.push(`부모 명식 ${d.부모?.명식} · 아이 명식 ${d.아이?.명식}`);
    contents.push('아이 명식에서 부모가 어느 자리로 놓이는지');
    contents.push('누가 잘못했는지 가리지 않습니다');
  } else if (d?.만나는_달) {
    const mm = d.만나는_달;
    for (const h of mm.how) contents.push(`무엇을 보고 집는지: ${h}`);
    contents.push(`앞으로 세 해 ${mm.months.length}달을 하나씩 봄`);
    contents.push(`그중 인연 기운이 몰리는 달 ${mm.picked.length}개를 짚음`);
    for (const m of mm.picked.slice(0, 2)) {
      contents.push(`예: ${m.from} ${m.termName}부터 ${m.pillar} — ${m.says[0]}`);
    }
  } else if (d?.괜찮아지는_달) {
    const hm = d.괜찮아지는_달;
    for (const h of hm.how) contents.push(`무엇을 보고 집는지: ${h}`);
    contents.push(`앞으로 세 해 ${hm.months.length}달을 하나씩 봄`);
    contents.push(`마음이 흔들릴 달과 제 힘이 돌아오는 달 ${hm.picked.length}개`);
    contents.push('다시 만나는지는 보지 않습니다');
  } else if (productId === 'pick-report') {
    // 택일은 사람이 아니라 날을 본다. 뽑아 보일 것도 명식이 아니라 순위다
    const ranked = (d?.순위 ?? []) as any[];
    const perDay = (d?.날마다최고 ?? []) as any[];
    if (ranked.length) {
      const top = ranked[0];
      contents.push(`후보 ${(d?.후보날 ?? []).length}날 × 시간대 ${(d?.가능시각 ?? []).length}개를 전부 견줌`);
      contents.push(`1순위 ${top.날} ${top.때} — ${top.점수}점 · ${top.등급}`);
      contents.push(`그때 서는 여덟 글자: ${top.여덟글자}`);
      for (const why of (top.까닭 ?? []).slice(0, 3)) contents.push(`1순위 근거: ${why}`);
      if (perDay.length) contents.push(`날마다 제일 좋은 시각 ${perDay.length}줄`);
      const last = ranked[ranked.length - 1];
      if (ranked.length > 1) contents.push(`피하는 게 나은 때: ${last.날} ${last.때} (${last.점수}점)`);
    }
  } else if (productId === 'marriage-pick-report') {
    const ranked = (d?.순위 ?? []) as any[];
    const best = (d?.제일좋은날 ?? []) as any[];
    if (ranked.length) {
      contents.push(`원하시는 기간 안의 ${ranked.length}날을 하나씩 견줌`);
      if (best.length) {
        const top = best[0];
        contents.push(`1순위 ${top.날} (${top.여덟글자}) — ${top.점수}점 · ${top.등급}`);
        for (const why of (top.까닭 ?? []).slice(0, 3)) contents.push(`1순위 근거: ${why}`);
      }
      contents.push(`두 분에게 가장 좋은 날 ${best.length}선`);
      const avoid = (d?.피할날 ?? []) as any[];
      if (avoid.length) {
        contents.push(`부딪힘이 있어 피하는 것이 좋은 날 ${avoid.length}개`);
      }
    }
  } else if (productId === 'naming-report' || productId === 'naming-plus-report') {
    /*
     * 작명은 사주를 푸는 것이 아니라 **고를 수 있는 것이 얼마나 되는지**를
     * 보여야 산다. 「글자 몇 자 중에서 고른다」가 이 상품의 값이다.
     */
    const need = d?.채워야할기운;
    const field = d?.이름밭;
    const saju = d?.아이사주;
    if (saju?.명식) {
      contents.push(`아이 명식 ${saju.명식.연주} ${saju.명식.월주} ${saju.명식.일주} ${saju.명식.시주 ?? '—'}`);
    }
    if (need) {
      contents.push(`채워야 할 기운: ${(need.오행 ?? []).join('·')} (${(need.십신 ?? []).join('·')})`);
    }
    if (field) {
      const pairs = (field.후보 ?? []) as any[];
      const chars = new Set<string>();
      for (const p of pairs) {
        for (const h of [...(p.앞자리 ?? []), ...(p.끝자리 ?? [])]) chars.add(h.자);
      }
      contents.push(`성 ${field.성?.한글}(${field.성?.한자}) ${(field.성?.획수 ?? []).join('+')}획에서 시작`);
      contents.push(`네 격이 다 길한 획수 짝 ${pairs.length}가지`);
      contents.push(`그 자리에 넣을 수 있는 인명용 한자 ${chars.size}자`);
      if (field.돌림자) contents.push(`돌림자 ${field.돌림자} 를 넣어 지음`);
      contents.push('지어 드린 이름마다 한자 뜻·소리·네 격 획수를 함께 적음');
      contents.push('고른 글자는 모두 대법원 인명용 한자 — 출생신고가 됩니다');
    }
    /*
     * 「안 겹치게」가 값을 더 받는 까닭이 여기 있다.
     * 결제 직전 화면에 이게 안 보이면 손님은 왜 6만원을 더 내는지 모른다.
     */
    const pop = d?.요즘_흔한_이름;
    if (pop) {
      const 해 = (pop.해마다 ?? []).map((y: any) => y.해).join('·');
      contents.push(`대법원 출생신고 이름 통계와 대조 — ${해}년 각 100위`);
      contents.push('지어 드린 이름마다 최근 100위 안에 드는지 한 줄로 밝힘');
      contents.push('100위 안에 드는 이름은 피해서 지음');
      contents.push('자료는 부르는 이름(한글) 기준 — 한자까지 같은지는 알 수 없습니다');
    }
  } else if (d?.결혼시기) {
    const m = d.결혼시기;
    contents.push(m.spouseStar);
    contents.push(m.spouseSeat);
    contents.push(`앞으로 ${m.years.length}해를 한 해씩 견줌`);
    contents.push(`나이대(대운)마다 어떤 결인지 ${m.byDecade.length}구간`);
    for (const w of m.strongest) {
      contents.push(`기운이 제일 세게 드는 해: ${w.year}년 ${w.age}세 (${w.pillar}) — ${w.says[0]}`);
    }
  } else if (d?.노후) {
    const l = d.노후;
    contents.push(l.lateSeat);
    contents.push(`예순 이후 십 년씩 ${l.decades.length}구간`);
    for (const x of l.decades.slice(0, 3)) {
      contents.push(`${x.startAge}~${x.endAge}세 ${x.pillar} — ${x.favor}`);
    }
    contents.push('수명이나 병은 보지 않습니다');
  } else if (Array.isArray(d?.세_해_달마다)) {
    if (d.명식) contents.push(`아이 명식 ${d.명식.연주} ${d.명식.월주} ${d.명식.일주} ${d.명식.시주 ?? '—'}`);
    if (d.강약) contents.push(`일간 강약: ${d.강약.verdict} (${d.강약.supportRatio}%)`);
    if (d.용신) contents.push(`채워야 할 기운: ${(d.용신.primary ?? []).join('·')}`);
    for (const h of (d.두드러진_특징 ?? []).slice(0, 2)) contents.push(String(h));
    const years = d.세_해_달마다 as any[];
    const months = years.reduce((n, y) => n + y.달.length, 0);
    contents.push(`앞으로 세 해를 **달마다** — ${years.map((y: any) => y.해).join('·')}년, 모두 ${months}달`);
    const first = years[0]?.달?.[0];
    if (first) contents.push(`예: ${first.from} ${first.termName}부터 ${first.pillar} — ${first.stemGod}/${first.branchGod}, ${first.favor}`);
    contents.push('달은 달력이 아니라 절기로 끊습니다');
  } else if (d?.오늘의간지) {
    /*
     * 오늘의 운세. 1,900원이라고 미리보기를 비워 두면 안 된다 —
     * 제일 많은 사람이 처음 사 보는 자리라 여기서 이 집의 인상이 정해진다.
     */
    contents.push(`${d.오늘날짜}의 간지 ${d.오늘의간지}`);
    contents.push(`오늘의 오행: 천간 ${d.오늘의오행?.천간} · 지지 ${d.오늘의오행?.지지}`);
    if (d.내일간) contents.push(`내 일간 ${d.내일간.stem}(${d.내일간.element}) 에서 본 오늘`);
    if (d.오늘의십신) contents.push(`오늘의 십신: 천간 ${d.오늘의십신.천간} · 지지 ${d.오늘의십신.지지}`);
    if (d.오늘의기운_유불리) contents.push(`오늘 기운은 나에게 — ${d.오늘의기운_유불리}`);
    for (const x of (d.사주와의_충합_관계 ?? []).slice(0, 2)) contents.push(`내 명식과: ${x}`);
    const 처방 = d.오늘의_처방전;
    if (처방) {
      contents.push(`행운의 색 ${(처방.행운의_색상 ?? []).join('·')} · 방향 ${(처방.행운의_방향 ?? []).join('·')} · 숫자 ${(처방.행운의_숫자 ?? []).join('·')}`);
    }
  } else if (productId === 'month-report' || d?.이번달) {
    /*
     * 한 달 운세.
     *
     * 이번 달 절기와 간지, 유불리, 돈·일·사람 주제 요약,
     * 좋은 날 셋과 조심할 날 셋을 결제 전 미리보기 목록으로 보여준다.
     */
    if (d.안내문구) contents.push(d.안내문구);
    else if (d.운세_월) contents.push(`${d.운세_월} 운세입니다`);
    if (d.이번달) {
      contents.push(`이번 달 절기: ${d.이번달.절기} (${d.이번달.시작일}부터) · 간지 ${d.이번달.간지}`);
      contents.push(`이번 달 기운: 천간 ${d.이번달.천간십신} · 지지 ${d.이번달.지지십신} — 내 명식과 ${d.이번달.유불리}`);
      for (const x of (d.이번달.부딪힘 ?? []).slice(0, 2)) contents.push(`사주와의 흐름: ${x}`);
    }
    if (d.돈) contents.push(`돈: ${d.돈.주제} — ${d.돈.요약}`);
    if (d.일) contents.push(`일: ${d.일.주제} — ${d.일.요약}`);
    if (d.사람) contents.push(`사람: ${d.사람.주제} — ${d.사람.요약}`);
    if (d.날) {
      const g = (d.날.좋은날셋 ?? []).map((x: any) => `${x.날짜}(${x.간지})`).join('·');
      const b = (d.날.조심할날셋 ?? []).map((x: any) => `${x.날짜}(${x.간지})`).join('·');
      if (g) contents.push(`이번 달 좋은 날: ${g}`);
      if (b) contents.push(`이번 달 조심할 날: ${b}`);
    }
    if (d.이번달_추천처방) {
      const tips = d.이번달_추천처방;
      contents.push(`행운의 색상 ${(tips.행운의_색상 ?? []).join('·')} · 방향 ${(tips.행운의_방향 ?? []).join('·')}`);
    }
  } else if (d?.교차검증) {
    /*
     * 갈래를 대조하는 상품 전부.
     *
     * 전에는 `cross-report` 하나만 여기로 들어왔다. 그래서 매력 삼합과
     * 「얼굴과 손」은 **결제 직전 화면에 담기는 것이 한 줄도 안 나왔다.**
     * 무엇을 받는지 안 보여 주고 돈을 받는 것이라 그냥 둘 수 없다.
     */
    const xv = d.교차검증;
    const sources = (d.보는_갈래 ?? []) as string[];
    if (sources.length) contents.push(`대조하는 갈래: ${sources.join(' × ')}`);
    contents.push(`${xv.sourceCount}가지를 ${(xv.comparisons ?? []).length}개 축으로 대조`);
    for (const c of xv.conflicted ?? []) contents.push(`엇갈림: ${c.axis}`);
    for (const c of xv.agreed ?? []) contents.push(`일치: ${c.axis}`);
    for (const c of xv.soloOnly ?? []) contents.push(`한쪽만 말하는 것: ${c.axis}`);
  } else if (Array.isArray(d?.주제)) {
    /*
     * 주제 하나(또는 둘)를 보는 상품.
     *
     * 자료를 주제별로 자르고 나서 여기를 안 고쳤더니, 담기는 것이 명식·강약·
     * 용신 **세 줄**로 쪼그라들었다. 손님이 값을 내기 전에 보는 화면이
     * 세 줄이면 안 사고 나간다. 주제에서 뽑을 수 있는 것을 그대로 뽑는다.
     */
    if (d.명식) contents.push(`명식 ${d.명식.연주} ${d.명식.월주} ${d.명식.일주} ${d.명식.시주 ?? '—'}`);
    if (d.강약) contents.push(`일간 강약: ${d.강약.verdict} (${d.강약.supportRatio}%)`);
    for (const t of d.주제 as any[]) {
      const 겉 = (t.evidence ?? []).filter((e: any) => e.depth !== '지장간').length;
      contents.push(`${t.label}(${t.term}) ${t.abundance} — 겉으로 ${겉}개, 지지 속에 ${t.hiddenCount}개`);
      for (const e of (t.evidence ?? []).slice(0, 2)) contents.push(`${t.label} 자리: ${e.where} — ${e.what}`);
      if (t.favorable === true) contents.push(`${t.label}은 이 명식이 **써야 하는** 기운`);
      else if (t.favorable === false) contents.push(`${t.label}은 이 명식이 **덜어내야 하는** 쪽`);
    }
    if (d.지금_대운?.현재) {
      const cur = d.지금_대운.현재;
      contents.push(`현재 대운 ${cur.pillar.stem}${cur.pillar.branch} (${cur.startAge}~${cur.endAge}세)`);
    }
    const years = (d.세운 ?? []) as any[];
    if (years.length) {
      contents.push(`${years[0].year}년부터 ${years.length}해의 유불리 — ${years.map((y) => `${y.year} ${y.favor}`).join(', ')}`);
    }
  } else {
    const saju = d ?? {};
    if (saju.명식) {
      contents.push(`명식 ${saju.명식.연주} ${saju.명식.월주} ${saju.명식.일주} ${saju.명식.시주 ?? '—'}`);
    }
    if (saju.강약) contents.push(`일간 강약: ${saju.강약.verdict} (${saju.강약.supportRatio}%)`);
    if (saju.용신) contents.push(`용신: ${(saju.용신.primary ?? []).join('·')}`);
    for (const h of (saju.두드러진_특징 ?? []).slice(0, 3)) contents.push(String(h));
    if (saju.대운?.현재 || saju.지금_대운?.현재) {
      const cur = saju.대운?.현재 ?? saju.지금_대운.현재;
      contents.push(`현재 대운 ${cur.pillar.stem}${cur.pillar.branch} (${cur.startAge}~${cur.endAge}세)`);
    }
    // 신년운세는 한 해를 보는 상품이라 그 해의 유불리가 곧 상품이다
    const nextYears = (saju.올해와_내년 ?? []) as any[];
    for (const y of nextYears) {
      contents.push(`${y.year}년 ${y.pillar.stem}${y.pillar.branch} — ${y.favor}`
        + (y.interactions?.length ? ` (${y.interactions.join(', ')})` : ''));
    }
    // 한 해를 파는 상품에 달이 없으면 살 이유가 없다
    const 달수 = (saju.올해_달마다 ?? []).length + (saju.내년_달마다 ?? []).length;
    if (달수) {
      contents.push(`올해와 내년을 **달마다** — 모두 ${달수}달, 절기로 끊어서`);
      const m = saju.올해_달마다[0];
      contents.push(`예: ${m.from} ${m.termName}부터 ${m.pillar} — ${m.stemGod}/${m.branchGod}, ${m.favor}`);
    }
    /*
     * 여덟 주제를 다 받는 상품은 그것이 값의 근거다.
     * 「여덟 주제 전부」 한 줄로 끝내면 29,800원을 왜 내는지 안 보인다.
     */
    const all = (saju.여덟_주제 ?? []) as any[];
    if (all.length) {
      contents.push(`여덟 주제를 전부 봅니다 — ${all.map((t) => t.label).join('·')}`);
      const 센것 = [...all].sort((x, y) => y.count - x.count).slice(0, 3);
      const 없는것 = all.filter((t) => t.count === 0);
      for (const t of 센것) {
        contents.push(`${t.label}(${t.term}) ${t.count}자리 — ${t.abundance}`);
      }
      if (없는것.length) {
        contents.push(`타고나지 않은 자리: ${없는것.map((t: any) => t.label).join('·')}`);
      }
      contents.push('주제마다 여덟 글자 어디에서 나왔는지 함께 적습니다');
    }
  }

  const fortuneText = fortunePoints.length > 0
    ? fortunePoints.map((fp) => `${fp.title}. ${fp.text}`).join(' ')
    : undefined;

  return {
    contents,
    sample: makePreview(SAMPLE_REPORTS[productId], Math.max(ratio, 0.4)),
    sampleNotice: sampleNoticeFor(productId),
    fortunePoints: fortunePoints.length > 0 ? fortunePoints : undefined,
    text: fortuneText,
  };
}
