/**
 * 일간의 강약 판정과 용신 도출.
 *
 * 사주 해석에서 가장 먼저 갈리는 분기점이 "일간이 강한가 약한가"다.
 * 같은 글자라도 신강이면 덜어내야 하고 신약이면 채워야 해서 처방이 정반대가 된다.
 *
 * 여기서는 **억부(抑扶)** 관점으로 계산한다. 조후·격국 등 다른 관점도 있으므로
 * 결과에 어떤 관점인지 명시하고, 판정 근거가 되는 점수를 그대로 노출한다.
 */

import type { Myeongsik } from '../../manseryeok/src/index.ts';
import { STEM_ELEMENT, STEMS } from '../../manseryeok/src/ganzhi.ts';
import { HIDDEN_STEMS, type Element } from './tables.ts';
import { tenGodOf, GOD_GROUP, type GodGroup } from './tenGods.ts';

/**
 * 자리별 가중치.
 *
 * 월지(月支)가 압도적으로 큰 이유: 태어난 계절이 일간의 기세를 가장 크게 좌우한다.
 * 이를 득령(得令)이라 부르고, 강약 판정의 절반 이상을 차지한다.
 */
const POSITION_WEIGHT = {
  yearStem: 8, monthStem: 10, hourStem: 8,
  yearBranch: 10, monthBranch: 30, dayBranch: 15, hourBranch: 10,
} as const;

/** 일간을 돕는 그룹 (인성이 생해주고, 비겁이 힘을 보탠다) */
const SUPPORTING: GodGroup[] = ['인성', '비겁'];

export interface StrengthDetail {
  /** 그룹별 가중 점수 */
  scores: Record<GodGroup, number>;
  /** 일간을 돕는 힘의 비율 (0-100) */
  supportRatio: number;
  verdict: '신강' | '중화' | '신약';
  /** 월지가 일간을 돕는가 */
  deukryeong: boolean;
  /** 일지가 일간을 돕는가 */
  deukji: boolean;
  /** 판정 근거를 사람이 읽는 문장으로 */
  reasoning: string[];
}

export interface ElementWeight {
  element: Element;
  /** 지장간까지 반영한 가중 점수 (합계 100) */
  weight: number;
  /** 겉으로 드러난 글자 수 (천간 4 + 지지 4 중) */
  visibleCount: number;
}

interface Contribution {
  stem: string;
  weight: number;
  source: string;
}

/** 명식의 여덟 글자를 지장간까지 펼쳐서 (천간, 가중치) 목록으로 만든다. */
function contributions(ms: Myeongsik): Contribution[] {
  const list: Contribution[] = [];

  const addStem = (stem: string | undefined, weight: number, source: string) => {
    if (stem) list.push({ stem, weight, source });
  };
  const addBranch = (branch: string | undefined, weight: number, source: string) => {
    if (!branch) return;
    const hidden = HIDDEN_STEMS[branch];
    for (const h of hidden) {
      list.push({ stem: h.stem, weight: weight * (h.days / 30), source: `${source}(${h.role})` });
    }
  };

  addStem(ms.year.stem, POSITION_WEIGHT.yearStem, '연간');
  addStem(ms.month.stem, POSITION_WEIGHT.monthStem, '월간');
  addStem(ms.hour?.stem, POSITION_WEIGHT.hourStem, '시간');

  addBranch(ms.year.branch, POSITION_WEIGHT.yearBranch, '연지');
  addBranch(ms.month.branch, POSITION_WEIGHT.monthBranch, '월지');
  addBranch(ms.day.branch, POSITION_WEIGHT.dayBranch, '일지');
  addBranch(ms.hour?.branch, POSITION_WEIGHT.hourBranch, '시지');

  return list;
}

/** 오행 분포 — 지장간 가중치까지 반영한 실제 무게. */
export function elementWeights(ms: Myeongsik): ElementWeight[] {
  const raw: Record<string, number> = { 목: 0, 화: 0, 토: 0, 금: 0, 수: 0 };
  const visible: Record<string, number> = { 목: 0, 화: 0, 토: 0, 금: 0, 수: 0 };

  for (const c of contributions(ms)) {
    raw[STEM_ELEMENT[STEMS.indexOf(c.stem as never)]] += c.weight;
  }
  for (const p of [ms.year, ms.month, ms.day, ms.hour]) {
    if (!p) continue;
    visible[p.element.stem]++;
    visible[p.element.branch]++;
  }

  const total = Object.values(raw).reduce((a, b) => a + b, 0) || 1;
  return (['목', '화', '토', '금', '수'] as Element[]).map((el) => ({
    element: el,
    weight: Math.round((raw[el] / total) * 1000) / 10,
    visibleCount: visible[el],
  }));
}

/** 일간의 강약을 판정한다. */
export function analyzeStrength(ms: Myeongsik): StrengthDetail {
  const dayStem = ms.day.stem;
  const scores: Record<GodGroup, number> = { 비겁: 0, 식상: 0, 재성: 0, 관성: 0, 인성: 0 };

  let total = 0;
  for (const c of contributions(ms)) {
    const group = GOD_GROUP[tenGodOf(dayStem, c.stem)];
    scores[group] += c.weight;
    total += c.weight;
  }
  // 일간 자신은 위 목록에 없다. 주체이므로 항상 자기편에 더한다.
  const SELF_WEIGHT = 12;
  scores.비겁 += SELF_WEIGHT;
  total += SELF_WEIGHT;

  for (const k of Object.keys(scores) as GodGroup[]) {
    scores[k] = Math.round((scores[k] / total) * 1000) / 10;
  }

  const supportRatio =
    Math.round(SUPPORTING.reduce((sum, g) => sum + scores[g], 0) * 10) / 10;

  const verdict = supportRatio >= 55 ? '신강' : supportRatio < 45 ? '신약' : '중화';

  const monthMain = HIDDEN_STEMS[ms.month.branch].at(-1)!.stem;
  const dayMain = HIDDEN_STEMS[ms.day.branch].at(-1)!.stem;
  const deukryeong = SUPPORTING.includes(GOD_GROUP[tenGodOf(dayStem, monthMain)]);
  const deukji = SUPPORTING.includes(GOD_GROUP[tenGodOf(dayStem, dayMain)]);

  const reasoning = [
    `일간은 ${dayStem}(${ms.day.element.stem}).`,
    deukryeong
      ? `월지 ${ms.month.branch}의 정기 ${monthMain}이 일간을 돕는다 — 득령(得令).`
      : `월지 ${ms.month.branch}의 정기 ${monthMain}이 일간을 돕지 않는다 — 실령(失令).`,
    deukji
      ? `일지 ${ms.day.branch}도 일간 편이다 — 득지(得地).`
      : `일지 ${ms.day.branch}는 일간 편이 아니다 — 실지(失地).`,
    `일간을 돕는 힘(인성+비겁)이 전체의 ${supportRatio}% — ${verdict}.`,
  ];

  return { scores, supportRatio, verdict, deukryeong, deukji, reasoning };
}

export interface YongsinResult {
  /** 억부 관점에서 필요한 기운 */
  primary: GodGroup[];
  /** 피해야 할 기운 */
  avoid: GodGroup[];
  /** 조후(계절 균형) 관점의 보조 의견 */
  seasonalNote: string | null;
  reasoning: string;
  /** 이 결론이 어떤 관점에서 나온 것인지 */
  school: string;
}

/** 계절별로 부족하기 쉬운 기운. 조후용신의 아주 단순화된 형태다. */
const SEASON_OF_BRANCH: Record<string, '봄' | '여름' | '가을' | '겨울'> = {
  인: '봄', 묘: '봄', 진: '봄',
  사: '여름', 오: '여름', 미: '여름',
  신: '가을', 유: '가을', 술: '가을',
  해: '겨울', 자: '겨울', 축: '겨울',
};

/** 억부용신을 구한다. 조후 의견은 참고로 덧붙인다. */
export function findYongsin(ms: Myeongsik, strength: StrengthDetail): YongsinResult {
  const strong = strength.verdict === '신강';
  const balanced = strength.verdict === '중화';

  const primary: GodGroup[] = strong
    ? ['식상', '재성', '관성']
    : balanced
      ? ['식상', '재성']
      : ['인성', '비겁'];
  const avoid: GodGroup[] = strong ? ['인성', '비겁'] : balanced ? [] : ['재성', '관성'];

  const season = SEASON_OF_BRANCH[ms.month.branch];
  const weights = elementWeights(ms);
  const fire = weights.find((w) => w.element === '화')!.weight;
  const water = weights.find((w) => w.element === '수')!.weight;

  let seasonalNote: string | null = null;
  if (season === '겨울' && fire < 15) {
    seasonalNote = `${ms.month.branch}월(겨울) 출생인데 화(火)가 ${fire}%로 적다. 조후 관점에서는 온기가 먼저 필요하다.`;
  } else if (season === '여름' && water < 15) {
    seasonalNote = `${ms.month.branch}월(여름) 출생인데 수(水)가 ${water}%로 적다. 조후 관점에서는 물기가 먼저 필요하다.`;
  }

  const reasoning = strong
    ? `일간이 강하므로(${strength.supportRatio}%) 힘을 덜어내는 쪽이 이롭다. 설기(식상)·소모(재성)·통제(관성)가 용신이 된다.`
    : balanced
      ? `강약이 균형에 가까우므로(${strength.supportRatio}%) 특정 기운을 강하게 밀 이유가 적다. 흐름을 여는 식상·재성을 우선 본다.`
      : `일간이 약하므로(${strength.supportRatio}%) 힘을 보태는 쪽이 이롭다. 생해주는 인성과 힘을 더하는 비겁이 용신이 된다.`;

  return {
    primary,
    avoid,
    seasonalNote,
    reasoning,
    school: '억부용신(抑扶用神) — 일간의 강약을 기준으로 삼는 관점',
  };
}
