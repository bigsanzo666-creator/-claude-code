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
  'wealth-report': `전문 · 일간 경금(庚金) 일주에 재성 편재(偏財) 17.5%, 관성 정관(正官) 19.9%, 비겁 40.3%로 재물 그릇보다 나가는 구멍과 지키려는 체면이 월등히 두터운 명식입니다.

내 통장은 왜 늘 비어 있을까요?
열 살 아이의 저금통으로 비유해 보겠습니다.
손님의 저금통은 들어오는 입구보다 바닥에 난 구멍이 더 큽니다.
돈이 안 들어오는 것이 아닙니다. 돈은 남들만큼, 혹은 그 이상으로 들어오는데 내 손에 쥐어지기 무섭게 나갈 곳이 먼저 줄을 섭니다.
손님의 사주 여덟 글자 중 자기를 돕는 기운(비겁)이 열 중 넷(40.3%)이나 됩니다. 내 편과 형제, 친구에게 베풀고 체면을 차리느라 돈이 먼저 새어 나갑니다.
근거 · 비겁 40.3% · 재성 17.5%

전문 · 일간 경금(庚金)은 제련되지 않은 거대한 무쇠와 원석의 결입니다.

손님은 타고나길 '단단한 무쇠 바위'입니다.
바위는 잔돈을 모아 요리조리 굴리는 잔재주에는 영 서툽니다.
한 번 마음을 먹으면 통 크게 결단을 내리지만, 일상의 사소한 지출을 꼼꼼하게 단속하지 못해 통장이 텅 빕니다.
근거 · 일간 경금(庚金)

전문 · 태어난 해 경인(庚寅), 태어난 달 무인(戊寅), 태어난 날 경오(庚午), 태어난 때 계미(癸未)의 네 기둥입니다.

여덟 글자를 차례로 펼쳐 봅니다.
태어난 날의 위 글자 경(庚)이 바로 손님 자신입니다.
그리고 손님의 돈을 뜻하는 글자는 태어난 해의 아래 글자 인(寅)과 태어난 달의 아래 글자 인(寅) 둘뿐입니다.
나무가 바위 아래 깔려 있으니, 흙을 뚫고 솟아나기 전까지는 돈이 쉽게 손에 잡히지 않는 구조입니다.

전문 · 진태양시 보정 시각은 서울 기준 13시 38분(미시)으로 계산되었습니다.

우리가 일상에서 보는 시계는 일본 아카시 표준시 기준입니다.
한국은 그보다 서쪽에 있어 해가 약 30분 늦게 뜹니다. 사주는 시계가 아니라 하늘의 해 위치로 보아야 정확합니다.
손님의 14시 10분 출생 기록을 해 기준으로 다시 재었더니 13시 38분이 되어 시주가 틀어지지 않고 정확하게 미시(未時)로 잡혔습니다.

전문 · 용신 수(水) 식상을 살려 바위 안의 물길을 터주어야 재물이 마르지 않고 고입니다.

체면과 자존심을 내려놓고 손님의 전문 기술과 손재주(식상)를 앞세워야 돈이 고입니다.
지갑은 검은색이나 짙은 남색 계열을 지니십시오. 흐르고 스며드는 물(수)의 기운이 굳은 바위를 유연하게 풀어 줍니다.
[[가림:손님의 돈그릇이 폭발적으로 차오르는 결정적 시기는 42세부터 시작되는 임자(壬子) 대운이며, 지금은 흩어지는 비겁의 힘을 동업이 아닌 1인 기술 전문직으로 돌려놓아야 3년 뒤 닥칠 큰 재물 손실을 완벽히 피할 수 있습니다.]]
근거 · 용신 식상 12.3% · 채우면좋은기운 수(水)`,

  'saju-report': `전문 · 일간 경금(庚金) 일주에 제 힘을 돕는 인성과 비겁이 전체의 59.8%를 차지하여 신강(身强)의 문턱에 서 있는 명식입니다.

손님은 어떤 사람으로 태어났을까요?
한마디로 비유하자면 '거친 비바람을 견뎌낸 단단한 원석'입니다.
남에게 기대거나 휘둘리는 것을 극도로 싫어하고, 내 힘으로 스스로 길을 뚫고 나아가려는 고집과 뚝심이 대단히 강합니다.
열 명 중 여섯(59.8%)에 달하는 기운이 내 편으로 서 있으니, 어려운 난관이 닥쳐도 쉽게 무너지지 않는 뼈대를 지녔습니다.
근거 · 비겁 35.2% · 인성 24.6%

전문 · 사주 네 기둥 중 재성(財星)이 5.1%로 희박하여 성취가 현실적 자산으로 즉각 환원되지 않는 배치를 이룹니다.

손님의 사주 여덟 글자에서 재물과 실속을 뜻하는 글자는 힘이 매우 얇습니다.
이것을 "평생 돈이 없다"고 읽으면 크게 잘못 읽는 것입니다.
일은 남들보다 두 배로 열심히 하고 큰 성과를 내는데, 그 결실이 손에 쥐어지는 현금이나 부동산으로 차곡차곡 쌓이기보다 명예나 경험으로 흘러가기 쉽다는 뜻입니다.
버는 것보다 '담아두는 그릇'을 의식적으로 단속해야 비로소 모입니다.

전문 · 진태양시 기준 13시 28분 보정을 거쳤으며, 일간 경금에 시지 미토(未土) 천을귀인이 동주합니다.

시계 바늘이 가리키는 시간이 아니라, 손님이 태어난 그 순간 하늘에 떠 있던 해의 진짜 위치(진태양시)로 다시 쟀습니다.
일본 표준시와 32분의 시차가 있어 시계 기준보다 32분을 뺀 시각으로 시주를 정확히 세웠습니다.
그 결과 태어난 시각의 아래 글자에 귀인(나를 돕는 은인)이 뚜렷하게 앉았습니다. 벼랑 끝에 몰려도 마지막 순간에 나를 건져주는 귀인의 손길이 반드시 나타납니다.

전문 · 편고된 금 기운을 소통시키기 위해 수(水) 기운을 용신으로 삼고, 화(火) 관성으로 벼려내야 합니다.

바위가 너무 단단하면 오히려 부러지기 쉽습니다.
물처럼 부드럽게 돌아가는 유연함(수)과 원칙을 단단히 세우는 절제력(화)을 보태야 합니다.
옷이나 소품에 짙은 남색이나 검은색을 가까이 두시고, 하루 중 차분하게 생각을 정리하는 밤 시간을 소중히 쓰십시오.
[[가림:손님의 인생에서 가장 높고 견고한 자리가 열리는 때는 40대 후반에 들어서는 신해(辛亥) 대운의 세 번째 해이며, 이때 맺어질 공적 문서 계약이 평생의 가장 큰 버팀목이 됩니다.]]
근거 · 용신 식상 18.2% · 희신 관성 19.5%`,

  'pick-report': `후보로 주신 세 날, 다섯 시간대를 모두 재어 보았습니다. 가장 앞선 것은 4월 30일 오후 4시에서 5시 사이입니다. 70.4점으로 「아주 좋음」에 들어갑니다. 바로 뒤가 4월 27일 같은 시간대로 69.9점이니, 이 둘은 사실상 붙어 있습니다. 병원 사정이 편한 쪽으로 고르셔도 됩니다.

먼저 점수를 어떻게 읽어야 하는지부터 말씀드립니다. 이 숫자는 절대 점수가 아니라 **후보들 사이에서 견주는 눈금**입니다. 여덟 글자 중 연주와 월주는 그 기간에 이미 정해져 있어, 우리가 고를 수 있는 것은 일주와 시주 절반뿐입니다. 그래서 100점은 구조적으로 나오지 않고, 70점이면 아주 좋은 편에 듭니다.

1순위인 4월 30일 오후 4시대에 태어나면 여덟 글자는 정미 갑진 기묘 임신으로 섭니다. 일간을 돕는 힘이 48%로 한가운데에 있어 세지도 약하지도 않습니다. 부딪히는 자리(충)가 한 군데도 없고, 천을귀인이 붙습니다. 뻗어 나가는 기운 쪽으로 조금 치우쳐 있는데, 이것은 깎는 요소로 넣어 계산한 뒤에도 남은 점수입니다.

2순위인 4월 27일 오후 4시대는 정미 갑진 병자 병신입니다. 힘이 50%로 더 정확히 가운데이고 충도 없습니다. 1순위와 갈린 것은 귀인 하나 차이입니다.

[[가림:의학적 소견이 허락한다면 가장 추천드리는 분만 일시는 4월 30일 16시 25분 정각이며, 이 시각을 맞추었을 때 아이의 일간과 시주 천을귀인이 가장 완전한 합을 이룹니다.]]
근거 · 제왕절개 후보 3일 5시진 정밀 대조`,

  'marriage-pick-report': `신랑과 신부 두 분의 여덟 글자를 함께 세우고, 원하시는 기간 안의 날들을 하나씩 견주어 보았습니다. 가장 앞선 것은 10월 18일입니다. 89점으로 「아주 좋음」에 들어갑니다. 두 사람의 기운을 서로 돕는 글자가 모이고, 부딪히는 자리가 없어 새 출발의 날로 가장 순탄합니다.

먼저 이 점수를 읽는 법부터 말씀드립니다. 이 점수는 100점 만점의 절대 점수가 아니라, **주신 기간 안에서 서로 견주는 눈금**입니다. 80점 이상이면 두 사람의 글자와 부딪힘 없이 화합하는 날이고, 65점 이상이면 순탄한 날입니다.

1순위로 꼽힌 10월 18일은 병오년 무술월 을축일입니다. 신랑의 일간과 그날의 천간이 서로 조화를 이루며 화합하고, 어려움을 풀어 주는 길신(천을귀인)의 기운이 신랑에게 닿습니다. 신부의 일지와도 충돌이 없어 양가 모두 편안한 기운으로 치를 수 있습니다.

[[가림:두 분의 합을 극대화하는 예식 거행 추천 시각은 낮 12시 30분 오시(午時)이며, 양가 어르신의 이동과 하객의 기운이 부딪힘 없이 하나로 모이는 최선의 자리입니다.]]
근거 · 혼인 택일 120일 후보 전수 대조`,

  'naming-report': `도윤이 아버님, 아이의 사주부터 말씀드립니다.

아이는 제 힘이 센 편입니다. 자기를 돕는 기운이 열 중 일곱쯤 되니, 더 보태는 것보다 **덜어내 주는 쪽**이 이롭습니다. 그래서 채워야 할 기운은 품고 버티는 기운(토), 자르고 맺는 기운(금), 흐르고 스며드는 기운(수) 셋입니다.

성이 김(金) 여덟 획이니, 여기에 붙일 수 있는 획수는 정해집니다. 네 자리 획수가 모두 길하게 서는 짝만 골라 그중에서 지었습니다.

**하나. 김도윤 金度玧**

도(度)는 「법도·헤아리다」입니다. 자를 대고 재는 글자라 자르고 맺는 기운을 지녔습니다. 윤(玧)은 「붉은 구슬」입니다. 옥 변이 붙어 흐르는 기운을 함께 봅니다.
아이에게 필요한 두 기운이 한 이름에 다 들었습니다. 힘이 센 아이는 스스로 멈출 자리를 알아야 하는데, 도(度) 자가 그 자리를 짚어 줍니다.
소리는 「김도윤」. 세 글자가 다 열려 있어 부르기 편하고, 받침이 마지막에만 있어 끝이 단정합니다.

[[가림:아이가 20대에 이르러 시험과 진로에서 가장 큰 빛을 발하게 할 획수 조합은 본명에 초년운 18획과 장년운 16획을 배치하는 구성이며, 성명학적 대법원 인명 한자 검증을 모두 마쳤습니다.]]
근거 · 김(金) 8획 기준 정격 수리성명학`,

  'compat-report': `전문 · 지영 님의 기토(己土) 일간과 민수 님의 경금(庚金) 일간이 만나 토생금(土生金)의 상생을 이루나, 에너지의 흐름이 일방으로 치우치기 쉬운 구조입니다.

두 사람은 과연 잘 맞는 사람일까요?
열 살 아이의 눈높이로 풀어보겠습니다.
지영 님은 촉촉하고 따뜻한 '비옥한 흙'이고, 민수 님은 흙 속에서 태어난 '단단한 쇠'입니다.
흙이 쇠를 품어 정성껏 길러내듯, 처음에 만났을 때는 지영 님이 민수 님을 살뜰하게 챙겨주고 민수 님은 그 다정함 속에서 큰 안정감을 느낍니다.
시작하는 첫인상과 끌림은 열에 여덟(82%)이나 맞을 만큼 자연스럽습니다.
근거 · 일간 상성 토생금(土生金) · 첫인상 지수 82점

전문 · 일지 신자진(申子辰) 수국(水局) 삼합의 결합으로 현실적 가치관과 삶의 방향성이 궤를 같이합니다.

태어난 날의 아래 글자(일지), 즉 두 사람이 매일 살아가는 생활 습관과 성향을 대조해 봅니다.
두 사람의 일지는 물처럼 유연하게 하나로 섞이는 삼합(三合)의 관계를 맺고 있습니다.
말하지 않아도 주말을 어떻게 보내고 싶은지, 돈을 어디에 쓰고 싶은지에 대한 기준이 서로 엇갈리지 않고 닮아 있습니다.

전문 · 그러나 지영 님의 관성과 민수 님의 상관이 충돌하여 갈등 발생 시 언어로 인한 상처가 깊어질 수 있습니다.

그런데.
좋은 부분만 있는 관계는 세상에 없습니다.
두 분 사이에서 가장 조심해야 할 자리는 바로 '말'입니다.
지영 님은 원칙과 예의를 중요하게 여기는데, 민수 님은 솔직하고 거침없이 직설적으로 말하는 편입니다.
작은 서운함이 생겼을 때 바로 쏘아붙이지 말고 하루만 묵혀두고 말씀하십시오.
[[가림:두 분의 관계가 가장 크게 흔들릴 수 있는 고비는 내년 가을 9월 유월(酉月)이며, 이때 지영 님이 침묵으로 물러서지 않고 서로의 재정 역할을 분리해 두는 것이 파국을 막는 핵심 열쇠가 됩니다.]]
근거 · 배우자궁 합 78% · 상관견관 충돌 주의`,

  'charm-report': `전문 · 일지 도화와 천간 상관의 기운이 겹쳐 첫 대면의 강렬한 흡인력과 언어적 센스를 동시에 갖춘 구조입니다.

매력을 세 갈래로 대조했습니다.
사주에서는 도화가 일지에 자리하고, 관상에서는 눈매가 부드러운 편이며, 손금에서는 감정선이 길게 뻗습니다. 셋이 같은 쪽을 가리킵니다.
다만 방향이 조금씩 다릅니다. 사주의 도화는 사람을 끌어당기는 쪽이고, 관상의 눈매는 상대를 편안하게 하는 쪽입니다. 앞의 것은 첫인상에서, 뒤의 것은 시간이 지날수록 작동합니다.
[[가림:손님의 매력이 가장 극대화되는 자리는 일대일 사적인 대화 자리이며, 붉은색 계열 소품을 매치할 때 상대가 마음의 무장해제를 가장 빠르게 겪게 됩니다.]]
근거 · 일지 도화 · 관상 안면비례 조화`,

  'cross-report': `전문 · 사주·관상·손금 삼합 교차검증 결과 여덟 개 핵심 축 중 3개 영역 일치, 4개 영역 상충으로 선천적 잠재력과 후천적 발현의 격차가 뚜렷합니다.

겉으로 보이는 나와 속의 진짜 나는 과연 같을까요?
우리는 태어날 때 하늘이 준 설계도(사주)와, 얼굴에 드러난 현재의 표정(관상), 그리고 손으로 직접 살아가며 새겨진 손금(손길)의 세 갈래를 대조해 보았습니다.
대인관계와 배움, 집중력 세 가지에서는 사주와 얼굴, 손금이 정확히 같은 방향을 가리킵니다.
남들이 보는 손님의 모습과 손님 스스로 생각하는 본모습이 일치하니, 이 부분은 흔들림 없는 강점으로 믿으셔도 좋습니다.
근거 · 일치 영역 3축 · 일치도 72.5%

전문 · 사주 원국의 재성 결핍(5.2%)과 관상 재백궁(콧방울)의 발달 및 손금 운명선 직립이 상충합니다.

가장 극적으로 엇갈리는 자리는 바로 '재물'입니다.
사주만 보면 재물을 뜻하는 글자가 5.2%에 불과하여 현실적 결실이 약하다고 나옵니다.
그런데 손님의 얼굴을 보면 돈을 담아두는 콧방울이 도톰하게 살이 올랐고, 손금을 보면 자신의 길을 굳세게 개척하는 운명선이 바닥부터 손가락 끝까지 곧게 뻗어 있습니다.
이것은 무엇을 뜻할까요? 타고난 바탕은 부족했지만, 손님이 살아오면서 끊임없이 노력하고 실력을 갈고닦아 현실의 결실을 스스로 빚어냈다는 증거입니다.

전문 · 엇갈림의 본질은 선천적 기질의 한계를 후천적 의지와 직업적 전문성으로 극복해 낸 성장 궤적입니다.

사주 책만 보고 "당신은 돈이 없습니다"라고 말하는 것은 반쪽짜리 풀이입니다.
손님의 손과 얼굴이 이미 그 결핍을 넘어섰다고 말하고 있습니다.
[[가림:손님의 사주와 손금이 마침내 완벽한 합을 이루어 폭발적인 결실을 맺는 시기는 45세 병오(丙午)년이며, 이때 얼굴의 눈매에 맺힌 살기를 거두고 아랫사람을 품는 포용을 보일 때 천억 대의 그릇이 열립니다.]]
근거 · 사주 재성 5.2% · 관상 재백궁 상급 · 손금 운명선 1등급`,
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
/*
 * 터진 뒤에 적은 것 (2026-10-05): 돈그릇을 눌러도, 사람운을 눌러도, 사주 종합을
 * 눌러도 **똑같은 세 문장**이 나왔다. 제목만 바뀌었다. 손님이 돈 얘기가 궁금해
 * 눌렀는데 돈 얘기가 한 마디도 없었다.
 *
 * 자료에는 이미 그 주제의 글자와 올해 흐름이 들어 있다. 쓰지를 않고 있었다.
 */

/** 받침이 있으면 을/이, 없으면 를/가 */
function 조사(말: string, 받침있을때: string, 받침없을때: string): string {
  const 끝 = [...String(말)].pop() ?? '';
  const 코드 = 끝.charCodeAt(0);
  if (코드 < 0xac00 || 코드 > 0xd7a3) return 받침있을때;
  return (코드 - 0xac00) % 28 === 0 ? 받침없을때 : 받침있을때;
}

/** 주제마다 큰 글씨로 올릴 쉬운 말 */
const 주제이름: Record<string, string> = {
  재성: '돈이 들고 나는 자리', 관성: '자리와 이름이 서는 곳',
  식상: '밖으로 내놓는 힘이 나오는 자리', 인성: '배움과 문서가 드는 자리',
  비겁: '사람이 드나드는 자리', '도화·홍염': '사람을 끄는 기운이 나오는 자리',
  역마: '움직임이 드는 자리', 천을귀인: '도움이 닿는 자리',
};

/** 많고 적음과 용신 관계로 한 문장을 짓는다. 없는 것을 「막혔다」고 쓰지 않는다 */
function 주제문장(t: Record<string, any>): string {
  const 이름 = String(t?.label ?? '이 자리');
  const 많고적음 = String(t?.abundance ?? '');
  const 숨은것 = Number(t?.hiddenCount ?? 0);
  const 써야하나 = t?.favorable;
  if (많고적음 === '없음' && 숨은것 > 0) {
    return `${이름}의 글자가 겉으로는 드러나 있지 않고 글자 속에 ${숨은것}개 숨어 있어, 남들 눈에 잘 띄지 않는 방식으로 돌아갑니다.`;
  }
  if (많고적음 === '없음') {
    return `${이름}의 글자를 타고나지 않았습니다. 없다는 것이 나쁘다는 뜻은 아니고, 이 자리는 스스로 만들어 가는 쪽이라는 뜻입니다.`;
  }
  if (많고적음 === '많음') {
    return 써야하나 === false
      ? `${이름}의 글자가 ${t.count}개로 많습니다. 많다고 다 좋은 것은 아니어서, 넓게 벌리기보다 고르고 덜어내는 쪽이 낫습니다.`
      : `${이름}의 글자가 ${t.count}개로 많고, 이 명식이 써야 하는 기운이기도 합니다. 크게 벌릴수록 잘 돌아갑니다.`;
  }
  if (많고적음 === '적음') {
    return `${이름}의 글자가 ${t.count}개로 적습니다. 여러 갈래로 벌리기보다 한 자리를 깊게 파는 쪽이 맞습니다.`;
  }
  return 써야하나 === true
    ? `${이름}의 글자가 치우침 없이 놓여 있고, 이 명식이 써야 하는 기운입니다. 무리 없이 꾸준히 돌아갑니다.`
    : `${이름}의 글자가 치우침 없이 놓여 있어, 기복 없이 꾸준히 돌아갑니다.`;
}

/** 어느 기둥 어느 글자에서 나왔는지 밝힌다 */
function 주제근거(t: Record<string, any>): string {
  const ev = Array.isArray(t?.evidence) ? t.evidence : [];
  if (ev.length === 0) {
    const 말 = String(t?.term ?? '이 자리');
    return `명식 여덟 글자에서 ${말}${조사(말, '을', '를')} 세어 본 결과에서 나옴`;
  }
  const 적을것 = ev.slice(0, 3).map((e: any) => `${e.where}의 ${e.what}(${e.depth})`).join(', ');
  return `${적을것}${ev.length > 3 ? ` 외 ${ev.length - 3}곳` : ''}에서 나옴`;
}

/** 손님이 누른 그 주제로 첫 대목을 짓는다. 주제가 없는 상품이면 null */
function 주제점사(d: Record<string, any>): FortunePoint | null {
  const 목록 = Array.isArray(d?.주제) ? d.주제
    : Array.isArray(d?.여덟_주제) ? d.여덟_주제 : null;
  if (!목록 || 목록.length === 0) return null;
  /* 여러 주제가 오면 **할 말이 가장 많은 것**을 고른다 */
  const t = [...목록].sort((a: any, b: any) => {
    const 점 = (x: any) => (x?.abundance === '많음' ? 3 : x?.abundance === '없음' ? 2 : x?.abundance === '적음' ? 1 : 0)
      + (x?.favorable === true ? 2 : x?.favorable === false ? 1 : 0);
    return 점(b) - 점(a);
  })[0];
  if (!t) return null;
  const 용어 = String(t.term ?? '');
  return {
    title: 주제이름[용어] ?? `${t.label ?? '이 자리'}가 서는 곳`,
    term: `${용어}${t.termHanja ? `(${t.termHanja})` : ''}`,
    termDesc: String(t.gloss ?? ''),
    text: 주제문장(t),
    basis: 주제근거(t),
  };
}

/** 올해가 어떤 해인지. 세운이 있는 상품만 */
function 흐름점사(d: Record<string, any>): FortunePoint | null {
  const 세운 = Array.isArray(d?.세운) ? d.세운 : null;
  if (!세운 || 세운.length === 0) return null;
  const 올해 = 세운[0];
  if (!올해?.pillar) return null;
  const 간지 = `${올해.pillar.stem}${올해.pillar.branch}`;
  const 유불리 = String(올해.favor ?? '중립');
  const 말 = 유불리 === '유리'
    ? '올해는 이 명식이 써야 하는 기운이 들어오는 해라, 벌여 놓은 것이 제 속도로 나아갑니다.'
    : 유불리 === '불리'
      ? '올해는 덜어내야 하는 기운이 드는 해라, 새로 벌이기보다 있는 것을 다지는 편이 낫습니다.'
      : '올해는 어느 쪽으로도 크게 기울지 않는 해라, 하던 것을 그대로 이어 가기 좋습니다.';
  return {
    title: `올해(${올해.year}년)는 이런 해입니다`,
    term: `${간지}년 · 천간 ${올해.stemGod} · 지지 ${올해.branchGod}`,
    termDesc: '올해의 두 글자가 내 일간과 맺는 관계입니다',
    text: 말,
    basis: `${올해.year}년의 간지 ${간지}와 일간의 관계에서 나옴`,
  };
}

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

  /*
   * 손님이 누른 **그 상품의 주제**가 있으면 그것을 맨 앞에 세운다.
   * 돈그릇을 눌렀으면 돈 자리 글자부터 말한다.
   */
  const 주제 = 주제점사(d);
  if (주제) points.unshift(주제);

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

  /*
   * 올해 흐름이 있는 상품이면 가운데 자리를 그것으로 바꾼다.
   * 대목 이름이 「지금 흐름」인데 타고난 기질을 적어 두면 말이 어긋난다.
   */
  const 흐름 = 흐름점사(d);
  /*
   * 주제가 앞에 섰으면 네 개가 된다. 맨 뒤 용신(손님이 **할 수 있는 일**)은
   * 떨구지 않는다 — 떨구면 대목 셋이 전부 「타고난 것」만 말하게 된다.
   */
  if (주제) {
    const 가운데 = 흐름 ?? points[1];
    return [주제, 가운데, points[points.length - 1]];
  }
  if (흐름 && points.length >= 3) points[1] = 흐름;

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
