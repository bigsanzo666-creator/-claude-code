/**
 * 궁합(宮合) — 두 명식의 상성.
 *
 * 흔한 궁합 서비스는 띠(연지)만 보고 "쥐띠와 말띠는 상극" 식으로 끝낸다.
 * 그건 열두 갈래뿐이라 사실상 아무 말도 안 하는 것과 같다.
 *
 * 여기서는 다섯 축으로 나눠 본다. 그중 가장 크게 보는 것은 **용신 보완** —
 * 내게 부족한 기운을 상대가 채워주는가다. 명리에서 실제로 궁합을 볼 때
 * 가장 무겁게 치는 지점이고, 띠 궁합과 결과가 자주 어긋나는 이유이기도 하다.
 *
 * 점수는 상성의 한 관점일 뿐이다. 결과가 낮게 나와도 "안 된다"가 아니라
 * "어디를 조심하면 되는가"로 끝내는 것이 이 모듈의 원칙이다.
 */

import type { Myeongsik } from '../../manseryeok/src/index.ts';
import {
  GENERATES, CONTROLS, HIDDEN_STEMS,
  BRANCH_SIX_COMBOS, BRANCH_TRIPLE_COMBOS, BRANCH_CLASHES, BRANCH_PUNISHMENTS,
  STEM_COMBINATIONS, STEM_CLASHES, type Element,
} from './tables.ts';
import { tenGodOf, GOD_GROUP, GOD_MEANING, type GodGroup } from './tenGods.ts';
import { analyzeStrength, findYongsin, elementWeights } from './strength.ts';
import { josa } from '../../korean/src/index.ts';

export interface CompatibilityAxis {
  name: string;
  /** 0-100 */
  score: number;
  /** 종합 점수에서 차지하는 비중 */
  weight: number;
  verdict: string;
  reasoning: string;
}

export interface Compatibility {
  /** 가중 종합 (0-100) */
  score: number;
  grade: '아주 좋음' | '좋음' | '보통' | '노력 필요';
  axes: CompatibilityAxis[];
  strengths: string[];
  cautions: string[];
  /** 결과는 반드시 행동 제안으로 끝난다 */
  advice: string[];
  disclaimer: string;
}

/** 일간의 오행을 기준으로 각 십신 그룹이 어떤 오행인지 구한다. */
function groupElements(dayElement: Element): Record<GodGroup, Element> {
  const generatesMe = (Object.keys(GENERATES) as Element[]).find((e) => GENERATES[e] === dayElement)!;
  const controlsMe = (Object.keys(CONTROLS) as Element[]).find((e) => CONTROLS[e] === dayElement)!;
  return {
    비겁: dayElement,
    식상: GENERATES[dayElement],
    재성: CONTROLS[dayElement],
    관성: controlsMe,
    인성: generatesMe,
  };
}

interface Side {
  ms: Myeongsik;
  label: string;
  dayStem: string;
  dayElement: Element;
  need: Element[];
  avoid: Element[];
  weights: Record<Element, number>;
  missing: Element[];
}

function prepare(ms: Myeongsik, label: string): Side {
  const strength = analyzeStrength(ms);
  const yongsin = findYongsin(ms, strength);
  const map = groupElements(ms.day.element.stem as Element);
  const ew = elementWeights(ms);

  const weights = {} as Record<Element, number>;
  for (const e of ew) weights[e.element] = e.weight;

  return {
    ms, label,
    dayStem: ms.day.stem,
    dayElement: ms.day.element.stem as Element,
    need: yongsin.primary.map((g) => map[g]),
    avoid: yongsin.avoid.map((g) => map[g]),
    weights,
    missing: ew.filter((e) => e.weight < 5).map((e) => e.element),
  };
}

const clamp = (n: number) => Math.max(0, Math.min(100, n));
const round = (n: number) => Math.round(n * 10) / 10;

/** 1. 일간끼리 — 두 사람의 본질이 어떻게 만나는가 */
function dayStemAxis(a: Side, b: Side): CompatibilityAxis {
  const combo = STEM_COMBINATIONS.find(
    (c) => (c.pair[0] === a.dayStem && c.pair[1] === b.dayStem) || (c.pair[1] === a.dayStem && c.pair[0] === b.dayStem));
  const clash = STEM_CLASHES.some(
    (c) => (c[0] === a.dayStem && c[1] === b.dayStem) || (c[1] === a.dayStem && c[0] === b.dayStem));

  const god = tenGodOf(a.dayStem, b.dayStem);
  let score: number, verdict: string, reasoning: string;

  if (combo) {
    score = 95;
    verdict = '서로 끌린다';
    reasoning = `일간 ${josa(a.dayStem, '과')} ${josa(b.dayStem, '이')} ${combo.name}. 천간이 합하는 관계로, 서로에게 자연히 끌리는 배치다.`;
  } else if (clash) {
    score = 40;
    verdict = '부딪치기 쉽다';
    reasoning = `일간 ${josa(a.dayStem, '과')} ${josa(b.dayStem, '이')} 충. 본질이 정면으로 맞서는 배치라 부딪침이 잦다. 다만 긴장이 추진력이 되기도 한다.`;
  } else if (a.dayElement === b.dayElement) {
    score = 65;
    verdict = '닮았다';
    reasoning = `둘 다 ${a.dayElement} 일간. 이해는 빠르지만 같은 것을 두고 겨루기도 쉽다.`;
  } else if (GENERATES[b.dayElement] === a.dayElement || GENERATES[a.dayElement] === b.dayElement) {
    score = 85;
    verdict = '한쪽이 북돋운다';
    const giver = GENERATES[b.dayElement] === a.dayElement ? b : a;
    const taker = giver === a ? b : a;
    reasoning = `${giver.label}의 ${josa(giver.dayElement, '이')} ${taker.label}의 ${josa(taker.dayElement, '을')} 생한다. ` +
      `${josa(giver.label, '이')} ${josa(taker.label, '을')} 북돋우는 흐름이다.`;
  } else {
    score = 55;
    verdict = '한쪽이 눌린다';
    reasoning = `일간끼리 극하는 관계(${a.dayStem}→${b.dayStem}${josa(b.dayStem, '은').slice(-1)} ${god}). 한쪽이 다른 쪽을 통제하는 구도라 역할이 뚜렷해지지만, 눌리는 쪽의 피로가 쌓일 수 있다.`;
  }

  return { name: '일간 상성', score, weight: 25, verdict, reasoning };
}

/** 2. 일지끼리 — 일지는 배우자 자리(配偶者宮)라 궁합에서 특히 무겁게 본다 */
function dayBranchAxis(a: Side, b: Side): CompatibilityAxis {
  const ab = a.ms.day.branch, bb = b.ms.day.branch;

  const six = BRANCH_SIX_COMBOS.find(
    (c) => (c.pair[0] === ab && c.pair[1] === bb) || (c.pair[1] === ab && c.pair[0] === bb));
  const triple = BRANCH_TRIPLE_COMBOS.find((t) => t.members.includes(ab) && t.members.includes(bb) && ab !== bb);
  const clash = BRANCH_CLASHES.some((c) => (c[0] === ab && c[1] === bb) || (c[1] === ab && c[0] === bb));
  const punish = BRANCH_PUNISHMENTS.some((p) => p.members.includes(ab) && p.members.includes(bb) && p.members.length === 3);

  let score: number, verdict: string, reasoning: string;

  if (six) {
    score = 95; verdict = '배우자 자리가 맞물린다';
    reasoning = `일지 ${josa(ab, '과')} ${josa(bb, '이')} ${six.name}. 일지는 배우자 자리라 궁합에서 가장 무겁게 보는 지점인데, 여기가 합한다.`;
  } else if (triple) {
    score = 88; verdict = '같은 방향을 본다';
    reasoning = `일지 ${josa(ab, '과')} ${josa(bb, '이')} ${triple.name}의 일부. 같은 오행 국을 이뤄 지향이 비슷하다.`;
  } else if (clash) {
    score = 35; verdict = '배우자 자리가 충한다';
    reasoning = `일지 ${josa(ab, '과')} ${josa(bb, '이')} 충. 가장 가까운 자리에서 부딪치므로 생활에서 마찰이 드러나기 쉽다. 거리와 역할을 분명히 하면 완화된다.`;
  } else if (punish) {
    score = 45; verdict = '서서히 얽힌다';
    reasoning = `일지 ${josa(ab, '과')} ${josa(bb, '이')} 형(刑) 관계. 충처럼 터지진 않지만 오래 두면 얽힌다고 본다.`;
  } else if (ab === bb) {
    score = 70; verdict = '같은 자리';
    reasoning = `둘 다 일지가 ${ab}. 생활 방식이 비슷해 편하지만 새로움은 적다.`;
  } else {
    score = 62; verdict = '무난하다';
    reasoning = `일지 ${josa(ab, '과')} ${bb} 사이에 합도 충도 없다. 특별히 끌리지도 부딪치지도 않는 배치다.`;
  }

  return { name: '일지 · 배우자 자리', score, weight: 25, verdict, reasoning };
}

/** 3. 용신 보완 — 궁합에서 실제로 가장 크게 보는 축 */
function yongsinAxis(a: Side, b: Side): CompatibilityAxis {
  const helps = (from: Side, to: Side) => {
    const need = to.need.reduce((s, e) => s + (from.weights[e] ?? 0), 0);
    const bad = to.avoid.reduce((s, e) => s + (from.weights[e] ?? 0), 0);
    return { need: round(need), bad: round(bad), score: clamp(50 + (need - bad) * 1.1) };
  };

  const aToB = helps(a, b);
  const bToA = helps(b, a);
  const score = round((aToB.score + bToA.score) / 2);

  const verdict =
    score >= 75 ? '서로 채워준다' :
    score >= 60 ? '한쪽이 채워준다' :
    score >= 45 ? '보완이 크지 않다' : '서로 부담이 된다';

  const reasoning =
    `${b.label}에게 필요한 기운(${b.need.join('·')})을 ${josa(a.label, '이')} ${aToB.need}%만큼 갖고 있고, ` +
    `${a.label}에게 필요한 기운(${a.need.join('·')})을 ${josa(b.label, '이')} ${bToA.need}%만큼 갖고 있다. ` +
    (aToB.score - bToA.score > 15
      ? `${josa(a.label, '이')} ${josa(b.label, '을')} 더 채워주는 쪽이다.`
      : bToA.score - aToB.score > 15
        ? `${josa(b.label, '이')} ${josa(a.label, '을')} 더 채워주는 쪽이다.`
        : '보완이 한쪽으로 크게 기울지 않는다.');

  return { name: '용신 보완', score, weight: 30, verdict, reasoning };
}

/** 4. 오행 보완 — 내게 없는 것을 상대가 갖고 있는가 */
function elementAxis(a: Side, b: Side): CompatibilityAxis {
  const filled = (x: Side, y: Side) => x.missing.filter((e) => (y.weights[e] ?? 0) >= 10);
  const aFilled = filled(a, b);
  const bFilled = filled(b, a);
  const totalMissing = a.missing.length + b.missing.length;
  const totalFilled = aFilled.length + bFilled.length;

  const score = totalMissing === 0 ? 75 : clamp(45 + (totalFilled / totalMissing) * 55);
  const verdict = totalFilled > 0 ? '빈 자리를 메운다' : totalMissing === 0 ? '둘 다 고르다' : '빈 자리가 남는다';

  const parts: string[] = [];
  if (aFilled.length) parts.push(`${a.label}에게 부족한 ${josa(aFilled.join('·'), '을')} ${josa(b.label, '이')} 갖고 있다.`);
  if (bFilled.length) parts.push(`${b.label}에게 부족한 ${josa(bFilled.join('·'), '을')} ${josa(a.label, '이')} 갖고 있다.`);
  if (!parts.length) {
    parts.push(totalMissing === 0
      ? '두 명식 모두 오행이 고르게 갖춰져 있다.'
      : `부족한 기운(${[...new Set([...a.missing, ...b.missing])].join('·')})을 서로 메워주지는 못한다.`);
  }

  return { name: '오행 보완', score: round(score), weight: 10, verdict, reasoning: parts.join(' ') };
}

/** 5. 여덟 글자 전체의 합·충 균형 */
function overallAxis(a: Side, b: Side): CompatibilityAxis {
  const aBranches = [a.ms.year.branch, a.ms.month.branch, a.ms.day.branch, a.ms.hour?.branch].filter(Boolean) as string[];
  const bBranches = [b.ms.year.branch, b.ms.month.branch, b.ms.day.branch, b.ms.hour?.branch].filter(Boolean) as string[];

  let combos = 0, clashes = 0;
  for (const x of aBranches) {
    for (const y of bBranches) {
      if (BRANCH_SIX_COMBOS.some((c) => (c.pair[0] === x && c.pair[1] === y) || (c.pair[1] === x && c.pair[0] === y))) combos++;
      if (BRANCH_CLASHES.some((c) => (c[0] === x && c[1] === y) || (c[1] === x && c[0] === y))) clashes++;
    }
  }

  const score = clamp(60 + combos * 12 - clashes * 12);
  const verdict = combos > clashes ? '전반적으로 맞물린다' : clashes > combos ? '전반적으로 걸린다' : '균형이 비슷하다';

  return {
    name: '전체 합·충',
    score: round(score), weight: 10, verdict,
    reasoning: `여덟 글자를 교차해 보면 합이 ${combos}개, 충이 ${clashes}개다. ` +
      (clashes === 0 ? '충이 없어 큰 마찰 요인은 보이지 않는다.'
        : combos === 0 ? '합이 없어 서로 묶이는 힘이 약하다.'
        : '합과 충이 함께 있어 가까워졌다 멀어졌다 하는 흐름이 나타난다.'),
  };
}

export function compatibility(
  msA: Myeongsik, msB: Myeongsik, labelA = 'A', labelB = 'B',
): Compatibility {
  const a = prepare(msA, labelA);
  const b = prepare(msB, labelB);

  const axes = [dayStemAxis(a, b), dayBranchAxis(a, b), yongsinAxis(a, b), elementAxis(a, b), overallAxis(a, b)];
  const score = round(axes.reduce((s, x) => s + x.score * x.weight, 0) / axes.reduce((s, x) => s + x.weight, 0));

  const grade: Compatibility['grade'] =
    score >= 80 ? '아주 좋음' : score >= 65 ? '좋음' : score >= 50 ? '보통' : '노력 필요';

  const strengths = axes.filter((x) => x.score >= 75).map((x) => `${x.name}: ${x.verdict} — ${x.reasoning}`);
  const cautions = axes.filter((x) => x.score < 55).map((x) => `${x.name}: ${x.verdict} — ${x.reasoning}`);

  // 배우자 자리의 십신은 "어떤 상대를 원하는가"를 보여준다
  const spouseGod = (s: Side) => {
    const main = HIDDEN_STEMS[s.ms.day.branch].at(-1)!.stem;
    const god = tenGodOf(s.dayStem, main);
    return `${s.label}의 배우자 자리(일지 ${s.ms.day.branch})는 ${god} — ${GOD_MEANING[god]}. 이런 성향의 상대에게 끌린다고 본다.`;
  };

  const advice: string[] = [spouseGod(a), spouseGod(b)];

  const clashAxis = axes.find((x) => x.name === '일지 · 배우자 자리' && x.score < 50);
  if (clashAxis) {
    advice.push('일지가 부딪치는 배치입니다. 생활 공간과 역할을 분명히 나누면 마찰이 눈에 띄게 줄어든다고 봅니다.');
  }
  const ya = axes.find((x) => x.name === '용신 보완')!;
  if (ya.score >= 70) {
    advice.push('서로 부족한 기운을 채워주는 관계입니다. 함께 있을 때 각자 더 잘 풀리는 조합으로 봅니다.');
  } else if (ya.score < 50) {
    advice.push('보완보다 소모가 큰 배치입니다. 각자의 영역을 지키고 붙어 있는 시간을 조절하는 편이 낫다고 봅니다.');
  }

  return {
    score, grade, axes, strengths, cautions, advice,
    disclaimer:
      '궁합은 두 명식의 상성을 보는 하나의 관점이며, 관계의 결과를 정하지 않습니다. ' +
      '점수가 낮게 나온 조합도 어디를 조심할지 알면 달라집니다. 참고 자료로만 보시기 바랍니다.',
  };
}
