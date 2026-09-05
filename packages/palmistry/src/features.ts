/**
 * 손금 특징 — 손에서 읽어내는 값들.
 *
 * 관상과 같은 원칙으로 만든다: 세 단계로만 기록하고, 점수를 매기지 않는다.
 * 손금은 조명과 손을 편 정도에 따라 선이 달라 보여서, 관상보다도 정밀도를
 * 주장하기 어렵다. 길다/보통/짧다 이상은 지어내는 것이다.
 *
 * 손 모양을 오행(五行)으로 분류하는 것은 이 서비스에 특히 유리하다.
 * 사주도 오행으로 말하므로, 같은 언어로 대조할 수 있는 지점이 하나 더 생긴다.
 */

export type Level = 'low' | 'mid' | 'high';

/** 오행 손 모양. 손바닥의 비율과 손가락 길이로 나눈다. */
export type HandShape = '목형' | '화형' | '토형' | '금형' | '수형';

export interface PalmFeatures {
  /** 생명선 길이 — 생명력과 체력의 지속을 본다 */
  lifeLength: Level;
  /** 생명선 선명도 */
  lifeDepth: Level;
  /** 두뇌선 길이 — 생각의 폭과 깊이를 본다 */
  headLength: Level;
  /** 두뇌선 선명도 */
  headDepth: Level;
  /** 감정선 길이 — 정(情)의 범위를 본다 */
  heartLength: Level;
  /** 감정선 선명도 */
  heartDepth: Level;
  /** 운명선 뚜렷함 — 사회적 궤도의 선명함을 본다. 없는 사람도 많다 */
  fateClarity: Level;
  /** 손 모양 */
  handShape: HandShape;
  /** 막쥔손금(원숭이선) — 두뇌선과 감정선이 하나로 이어진 형태 */
  simianLine: boolean;
}

export const HAND_SHAPE_LABEL: Record<HandShape, string> = {
  목형: '목형 — 손바닥과 손가락 모두 길다',
  화형: '화형 — 손바닥은 긴데 손가락은 짧다',
  토형: '토형 — 손바닥이 네모나고 손가락이 짧다',
  금형: '금형 — 손바닥이 네모나고 손가락이 길다',
  수형: '수형 — 전체적으로 부드럽고 유연하다',
};

export const HAND_SHAPE_SHORT: Record<HandShape, string> = {
  목형: '목형(木)', 화형: '화형(火)', 토형: '토형(土)', 금형: '금형(金)', 수형: '수형(水)',
};

export const PALM_FEATURE_LABEL: Record<keyof Omit<PalmFeatures, 'handShape' | 'simianLine'>, string> = {
  lifeLength: '생명선 길이',
  lifeDepth: '생명선 선명도',
  headLength: '두뇌선 길이',
  headDepth: '두뇌선 선명도',
  heartLength: '감정선 길이',
  heartDepth: '감정선 선명도',
  fateClarity: '운명선 뚜렷함',
};

/** 각 특징이 전통적으로 무엇을 맡는지. 결과 화면에서 근거로 보여준다. */
export const PALM_FEATURE_DOMAIN: Record<keyof Omit<PalmFeatures, 'handShape' | 'simianLine'>, string> = {
  lifeLength: '생명선 (체력·지구력)',
  lifeDepth: '생명선 (기운의 세기)',
  headLength: '두뇌선 (사고의 폭)',
  headDepth: '두뇌선 (집중의 깊이)',
  heartLength: '감정선 (정의 범위)',
  heartDepth: '감정선 (정의 세기)',
  fateClarity: '운명선 (사회적 궤도)',
};

/** 세 단계의 표시 문구. 항목마다 말이 달라야 자연스럽다. */
export const PALM_LEVEL_LABELS: Record<keyof Omit<PalmFeatures, 'handShape' | 'simianLine'>, [string, string, string]> = {
  lifeLength: ['짧음', '보통', '긺'],
  lifeDepth: ['옅음', '보통', '뚜렷'],
  headLength: ['짧음', '보통', '긺'],
  headDepth: ['옅음', '보통', '뚜렷'],
  heartLength: ['짧음', '보통', '긺'],
  heartDepth: ['옅음', '보통', '뚜렷'],
  fateClarity: ['거의 없음', '보통', '뚜렷'],
};

/** 아무 특징도 두드러지지 않은 기본값. */
export const NEUTRAL_PALM_FEATURES: PalmFeatures = {
  lifeLength: 'mid', lifeDepth: 'mid',
  headLength: 'mid', headDepth: 'mid',
  heartLength: 'mid', heartDepth: 'mid',
  fateClarity: 'mid',
  handShape: '토형',
  simianLine: false,
};

/**
 * 어느 손을 볼 것인가에 대한 안내.
 *
 * 유파에 따라 갈리는 영역이라 우리가 정하지 않고 사용자에게 알린다.
 * 흔히 쓰는 기준은 남좌여우(男左女右) — 남자는 왼손, 여자는 오른손을
 * 타고난 것(선천)으로 보고 반대 손을 살아온 것(후천)으로 본다.
 */
export const HAND_CHOICE_NOTE =
  '어느 손을 보는지는 유파마다 다릅니다. 흔히 쓰는 기준은 남좌여우(男左女右)로, ' +
  '남자는 왼손·여자는 오른손을 타고난 것으로 보고 반대 손을 살아오며 바뀐 것으로 봅니다. ' +
  '양손이 다르다면 그 차이 자체가 정보입니다.';
