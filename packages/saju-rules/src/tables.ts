/**
 * 명리 기초 테이블.
 *
 * 여기 있는 값들은 해석의 근거가 되므로 출처와 유파를 주석으로 남긴다.
 * 유파에 따라 갈리는 값은 그 사실을 명시하고, 임의로 하나를 고르지 않는다.
 */

export type Element = '목' | '화' | '토' | '금' | '수';
export type YinYang = '양' | '음';

/** 오행 상생: 목→화→토→금→수→목 */
export const GENERATES: Record<Element, Element> = {
  목: '화', 화: '토', 토: '금', 금: '수', 수: '목',
};

/** 오행 상극: 목→토→수→화→금→목 */
export const CONTROLS: Record<Element, Element> = {
  목: '토', 토: '수', 수: '화', 화: '금', 금: '목',
};

/**
 * 지장간(支藏干) — 지지 속에 숨은 천간.
 *
 * 지지는 겉으로 드러난 글자 하나지만 실제로는 여러 기운을 품고 있다.
 * 이걸 빼고 오행을 세면 명식의 실제 무게가 어긋난다.
 *
 * days는 한 달 30일 중 그 기운이 작용하는 일수(여기·중기·정기).
 * 마지막 항목이 정기(正氣)로, 그 지지를 대표한다.
 */
export const HIDDEN_STEMS: Record<string, { stem: string; days: number; role: '여기' | '중기' | '정기' }[]> = {
  자: [{ stem: '임', days: 10, role: '여기' }, { stem: '계', days: 20, role: '정기' }],
  축: [{ stem: '계', days: 9, role: '여기' }, { stem: '신', days: 3, role: '중기' }, { stem: '기', days: 18, role: '정기' }],
  인: [{ stem: '무', days: 7, role: '여기' }, { stem: '병', days: 7, role: '중기' }, { stem: '갑', days: 16, role: '정기' }],
  묘: [{ stem: '갑', days: 10, role: '여기' }, { stem: '을', days: 20, role: '정기' }],
  진: [{ stem: '을', days: 9, role: '여기' }, { stem: '계', days: 3, role: '중기' }, { stem: '무', days: 18, role: '정기' }],
  사: [{ stem: '무', days: 7, role: '여기' }, { stem: '경', days: 7, role: '중기' }, { stem: '병', days: 16, role: '정기' }],
  오: [{ stem: '병', days: 10, role: '여기' }, { stem: '기', days: 9, role: '중기' }, { stem: '정', days: 11, role: '정기' }],
  미: [{ stem: '정', days: 9, role: '여기' }, { stem: '을', days: 3, role: '중기' }, { stem: '기', days: 18, role: '정기' }],
  신: [{ stem: '무', days: 7, role: '여기' }, { stem: '임', days: 7, role: '중기' }, { stem: '경', days: 16, role: '정기' }],
  유: [{ stem: '경', days: 10, role: '여기' }, { stem: '신', days: 20, role: '정기' }],
  술: [{ stem: '신', days: 9, role: '여기' }, { stem: '정', days: 3, role: '중기' }, { stem: '무', days: 18, role: '정기' }],
  해: [{ stem: '무', days: 7, role: '여기' }, { stem: '갑', days: 7, role: '중기' }, { stem: '임', days: 16, role: '정기' }],
};

/**
 * 십이운성(十二運星) — 천간이 각 지지에서 갖는 기세.
 * 장생에서 시작해 양간은 순행, 음간은 역행한다.
 */
export const TWELVE_STAGES = [
  '장생', '목욕', '관대', '건록', '제왕', '쇠', '병', '사', '묘', '절', '태', '양',
] as const;
export type TwelveStage = (typeof TWELVE_STAGES)[number];

/** 각 천간의 장생지(長生地). */
export const CHANGSAENG: Record<string, string> = {
  갑: '해', 을: '오', 병: '인', 정: '유', 무: '인',
  기: '유', 경: '사', 신: '자', 임: '신', 계: '묘',
};

/** 천간합(天干合) — 만나면 서로 묶여 다른 오행으로 化하려 한다. */
export const STEM_COMBINATIONS: { pair: [string, string]; becomes: Element; name: string }[] = [
  { pair: ['갑', '기'], becomes: '토', name: '갑기합토' },
  { pair: ['을', '경'], becomes: '금', name: '을경합금' },
  { pair: ['병', '신'], becomes: '수', name: '병신합수' },
  { pair: ['정', '임'], becomes: '목', name: '정임합목' },
  { pair: ['무', '계'], becomes: '화', name: '무계합화' },
];

/** 천간충(天干沖) — 오행이 상극이면서 음양이 같은 관계. */
export const STEM_CLASHES: [string, string][] = [
  ['갑', '경'], ['을', '신'], ['병', '임'], ['정', '계'],
];

/** 지지육합(地支六合) */
export const BRANCH_SIX_COMBOS: { pair: [string, string]; becomes: Element; name: string }[] = [
  { pair: ['자', '축'], becomes: '토', name: '자축합토' },
  { pair: ['인', '해'], becomes: '목', name: '인해합목' },
  { pair: ['묘', '술'], becomes: '화', name: '묘술합화' },
  { pair: ['진', '유'], becomes: '금', name: '진유합금' },
  { pair: ['사', '신'], becomes: '수', name: '사신합수' },
  { pair: ['오', '미'], becomes: '토', name: '오미합토' },
];

/** 삼합(三合) — 세 지지가 모이면 강한 오행 국(局)을 이룬다. 두 개만 있으면 반합(半合). */
export const BRANCH_TRIPLE_COMBOS: { members: [string, string, string]; becomes: Element; name: string }[] = [
  { members: ['신', '자', '진'], becomes: '수', name: '신자진 수국' },
  { members: ['해', '묘', '미'], becomes: '목', name: '해묘미 목국' },
  { members: ['인', '오', '술'], becomes: '화', name: '인오술 화국' },
  { members: ['사', '유', '축'], becomes: '금', name: '사유축 금국' },
];

/** 지지충(地支沖) — 정반대에 놓인 지지끼리 부딪친다. */
export const BRANCH_CLASHES: [string, string][] = [
  ['자', '오'], ['축', '미'], ['인', '신'], ['묘', '유'], ['진', '술'], ['사', '해'],
];

/** 지지형(地支刑) */
export const BRANCH_PUNISHMENTS: { members: string[]; name: string }[] = [
  { members: ['인', '사', '신'], name: '인사신 삼형' },
  { members: ['축', '술', '미'], name: '축술미 삼형' },
  { members: ['자', '묘'], name: '자묘형' },
  { members: ['진', '진'], name: '진진 자형' },
  { members: ['오', '오'], name: '오오 자형' },
  { members: ['유', '유'], name: '유유 자형' },
  { members: ['해', '해'], name: '해해 자형' },
];

/**
 * 천을귀인(天乙貴人) — 일간 기준. 가장 널리 인정되는 길신.
 */
export const CHEONEUL: Record<string, string[]> = {
  갑: ['축', '미'], 무: ['축', '미'], 경: ['축', '미'],
  을: ['자', '신'], 기: ['자', '신'],
  병: ['해', '유'], 정: ['해', '유'],
  임: ['묘', '사'], 계: ['묘', '사'],
  신: ['인', '오'],
};

/**
 * 삼합국의 첫 글자(생지)를 기준으로 잡는 신살.
 * 도화·역마·화개는 연지 또는 일지를 기준으로 본다. (유파에 따라 기준지가 다름)
 */
export const PEACH_BLOSSOM: Record<string, string> = { // 도화살
  신: '유', 자: '유', 진: '유',
  해: '자', 묘: '자', 미: '자',
  인: '묘', 오: '묘', 술: '묘',
  사: '오', 유: '오', 축: '오',
};

export const TRAVELING_HORSE: Record<string, string> = { // 역마살
  신: '인', 자: '인', 진: '인',
  해: '사', 묘: '사', 미: '사',
  인: '신', 오: '신', 술: '신',
  사: '해', 유: '해', 축: '해',
};

export const CANOPY: Record<string, string> = { // 화개살
  신: '진', 자: '진', 진: '진',
  해: '미', 묘: '미', 미: '미',
  인: '술', 오: '술', 술: '술',
  사: '축', 유: '축', 축: '축',
};

/** 양인살(羊刃) — 양간이 제왕에 이르는 자리. 힘이 넘쳐 날이 선다. */
export const YANGIN: Record<string, string> = {
  갑: '묘', 병: '오', 무: '오', 경: '유', 임: '자',
};

/** 괴강(魁罡) — 일주가 이 네 가지일 때. */
export const GOEGANG = ['경진', '경술', '임진', '무술'];

/** 백호대살(白虎大殺) */
export const BAEKHO = ['무진', '정축', '병술', '을미', '갑진', '계축', '임술'];
