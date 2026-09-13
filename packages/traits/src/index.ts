/**
 * 공통 성향 척도.
 *
 * 사주·관상·손금은 각각 다른 언어를 쓴다. 사주는 "식상이 많다"고 하고
 * 관상은 "입이 크다"고 하고 손금은 "감정선이 길다"고 한다.
 * 이대로면 셋을 나란히 놓을 수는 있어도 **대조할 수는 없다.**
 *
 * 그래서 셋 다 같은 여덟 개 축으로 환산한다. 환산하고 나면
 * "사주는 +2인데 관상은 −1" 같은 대조가 가능해지고, 그게 우리가 파는 것이다.
 *
 * 이 모듈은 세 갈래 모두가 의존하는 어휘일 뿐, 판단은 하지 않는다.
 */

export const TRAIT_AXES = [
  '재물', '대인관계', '추진력', '표현력', '인내', '학습·직관', '리더십', '안정성',
] as const;

export type TraitAxis = (typeof TRAIT_AXES)[number];

export const AXIS_DESCRIPTION: Record<TraitAxis, string> = {
  재물: '재물을 모으고 다루는 힘',
  대인관계: '사람을 끌어들이고 어울리는 힘',
  추진력: '일을 밀고 나가는 힘',
  표현력: '드러내고 전달하는 힘',
  인내: '견디고 버티는 힘',
  '학습·직관': '배우고 알아채는 힘',
  리더십: '이끌고 책임지는 힘',
  안정성: '흔들리지 않고 유지하는 힘',
};

/** 어디서 나온 판정인지. 교차검증의 기준이 된다. */
export type TraitSource = '사주' | '관상' | '손금';

export interface TraitSignal {
  axis: TraitAxis;
  /** −2(매우 약) ~ +2(매우 강). 0은 특징 없음 */
  score: -2 | -1 | 0 | 1 | 2;
  /** 이 점수가 나온 근거. 반드시 원본 용어로 남긴다 */
  evidence: string;
}

export interface TraitProfile {
  source: TraitSource;
  signals: TraitSignal[];
}

/** 여러 신호를 축별로 합산해 하나의 점수로 정리한다. */
export function collapse(profile: TraitProfile): Map<TraitAxis, { score: number; evidence: string[] }> {
  const out = new Map<TraitAxis, { score: number; evidence: string[] }>();
  for (const axis of TRAIT_AXES) out.set(axis, { score: 0, evidence: [] });

  for (const s of profile.signals) {
    const cell = out.get(s.axis)!;
    cell.score += s.score;
    if (s.score !== 0) cell.evidence.push(s.evidence);
  }
  // 합산 결과를 −2~+2로 다시 눌러 담는다
  for (const cell of out.values()) {
    cell.score = Math.max(-2, Math.min(2, Math.round(cell.score)));
  }
  return out;
}

export const scoreLabel = (n: number): string =>
  n >= 2 ? '매우 강함' : n === 1 ? '강함' : n === 0 ? '보통' : n === -1 ? '약함' : '매우 약함';
