/**
 * 십신(十神)과 십이운성.
 *
 * 사주는 여덟 글자를 따로 읽지 않는다. 전부 **일간(日干)과의 관계**로 읽는다.
 * 십신은 그 관계에 붙인 이름이다.
 */

import { STEMS, STEM_ELEMENT, STEM_YINYANG, BRANCHES } from '../../manseryeok/src/ganzhi.ts';
import { GENERATES, CONTROLS, CHANGSAENG, TWELVE_STAGES, type Element, type TwelveStage } from './tables.ts';

export type TenGod =
  | '비견' | '겁재' | '식신' | '상관' | '편재'
  | '정재' | '편관' | '정관' | '편인' | '정인';

/** 십신의 상위 분류. 해석은 대개 이 다섯 갈래로 먼저 잡는다. */
export type GodGroup = '비겁' | '식상' | '재성' | '관성' | '인성';

export const GOD_GROUP: Record<TenGod, GodGroup> = {
  비견: '비겁', 겁재: '비겁',
  식신: '식상', 상관: '식상',
  편재: '재성', 정재: '재성',
  편관: '관성', 정관: '관성',
  편인: '인성', 정인: '인성',
};

/** 각 십신이 통상 상징하는 영역. 해석 문장을 만들 때의 뼈대. */
export const GOD_MEANING: Record<TenGod, string> = {
  비견: '주체성·동료·경쟁',
  겁재: '추진력·손재·형제',
  식신: '표현·여유·먹을 복',
  상관: '재능·비판·규범 이탈',
  편재: '유동적인 재물·활동성',
  정재: '안정적인 재물·성실',
  편관: '압박·도전·권위와의 마찰',
  정관: '규범·직책·자기 통제',
  편인: '비주류 지식·직관',
  정인: '배움·보호·명예',
};

const stemIndex = (stem: string) => STEMS.indexOf(stem as never);

/** 천간 하나가 일간에 대해 갖는 십신을 구한다. */
export function tenGodOf(dayStem: string, target: string): TenGod {
  const di = stemIndex(dayStem);
  const ti = stemIndex(target);
  if (di < 0 || ti < 0) throw new Error(`알 수 없는 천간: ${dayStem} / ${target}`);

  const de = STEM_ELEMENT[di] as Element;
  const te = STEM_ELEMENT[ti] as Element;
  const samePolarity = STEM_YINYANG[di] === STEM_YINYANG[ti];

  if (de === te) return samePolarity ? '비견' : '겁재';
  if (GENERATES[de] === te) return samePolarity ? '식신' : '상관';
  if (CONTROLS[de] === te) return samePolarity ? '편재' : '정재';
  if (CONTROLS[te] === de) return samePolarity ? '편관' : '정관';
  if (GENERATES[te] === de) return samePolarity ? '편인' : '정인';

  throw new Error(`십신 관계를 판정할 수 없습니다: ${dayStem} → ${target}`);
}

/**
 * 십이운성 — 어떤 천간이 어떤 지지에서 갖는 기세.
 * 양간은 장생지에서 순행, 음간은 역행한다.
 */
export function twelveStage(stem: string, branch: string): TwelveStage {
  const si = stemIndex(stem);
  const bi = BRANCHES.indexOf(branch as never);
  if (si < 0 || bi < 0) throw new Error(`알 수 없는 간지: ${stem}${branch}`);

  const origin = BRANCHES.indexOf(CHANGSAENG[stem] as never);
  const isYang = STEM_YINYANG[si] === '양';
  const offset = isYang ? (bi - origin + 12) % 12 : (origin - bi + 12) % 12;
  return TWELVE_STAGES[offset];
}

/** 기세가 왕한 자리인지. 신강약 판정의 보조 지표로 쓴다. */
const STRONG_STAGES: TwelveStage[] = ['장생', '관대', '건록', '제왕'];
export function isStrongStage(stage: TwelveStage): boolean {
  return STRONG_STAGES.includes(stage);
}
