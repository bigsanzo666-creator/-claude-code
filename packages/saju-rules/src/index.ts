/**
 * 사주 해석 룰 엔진.
 *
 * 명식(여덟 글자)을 받아 **구조화된 분석 결과**를 낸다. 여기까지가 전부 결정론이다.
 * LLM은 이 JSON을 문장으로 옮기는 데만 쓴다 — 판단은 룰이 하고, 서술만 맡긴다.
 *
 * 그렇게 나누는 이유:
 *  - 같은 명식이면 언제나 같은 결론이 나온다 (일관성이 신뢰의 대부분이다)
 *  - 결론마다 근거를 남길 수 있다
 *  - 무료 구간은 LLM 없이 이 결과만으로도 채울 수 있어 원가가 0에 수렴한다
 */

import type { Myeongsik } from '../../manseryeok/src/index.ts';
import { HIDDEN_STEMS } from './tables.ts';
import {
  tenGodOf, twelveStage, GOD_GROUP, GOD_MEANING,
  type TenGod, type GodGroup,
} from './tenGods.ts';
import {
  analyzeStrength, findYongsin, elementWeights,
  type StrengthDetail, type YongsinResult, type ElementWeight,
} from './strength.ts';
import { findRelations, findSinsal, type Relation, type Sinsal, type PillarName } from './relations.ts';

export * from './tables.ts';
export * from './tenGods.ts';
export * from './strength.ts';
export * from './relations.ts';
export * from './luck.ts';
export * from './compatibility.ts';
export * from '../../korean/src/index.ts';
export * from './toTraits.ts';
export * from './crossValidate.ts';
export * from './topics.ts';
export * from './reading.ts';

export interface PillarAnalysis {
  position: PillarName;
  stem: string;
  branch: string;
  /** 천간의 십신. 일간 자신은 null */
  stemGod: TenGod | null;
  /** 지지 정기의 십신 */
  branchGod: TenGod;
  /** 지지에 숨은 천간들과 각각의 십신 */
  hidden: { stem: string; role: string; god: TenGod }[];
  /** 일간이 이 지지에서 갖는 기세 */
  stage: string;
}

export interface Analysis {
  /** 이 명식의 주체 */
  dayMaster: { stem: string; element: string; yinYang: string };
  pillars: PillarAnalysis[];
  /** 십신 등장 횟수 (천간 + 지지 정기 기준) */
  godCounts: Record<GodGroup, number>;
  /** 아예 없는 십신 그룹 — 결핍은 과잉만큼 중요한 정보다 */
  missingGroups: GodGroup[];
  elements: ElementWeight[];
  /** 오행 중 아예 없는 것 */
  missingElements: string[];
  strength: StrengthDetail;
  yongsin: YongsinResult;
  relations: Relation[];
  sinsal: Sinsal[];
  /** 해석 문장을 만들 때 우선 다뤄야 할 특징들 */
  highlights: string[];
}

const GROUPS: GodGroup[] = ['비겁', '식상', '재성', '관성', '인성'];

export function analyze(ms: Myeongsik): Analysis {
  const dayStem = ms.day.stem;

  const sources: { position: PillarName; pillar: typeof ms.year | null }[] = [
    { position: '연주', pillar: ms.year },
    { position: '월주', pillar: ms.month },
    { position: '일주', pillar: ms.day },
    { position: '시주', pillar: ms.hour },
  ];

  const pillars: PillarAnalysis[] = [];
  const godCounts: Record<GodGroup, number> = { 비겁: 0, 식상: 0, 재성: 0, 관성: 0, 인성: 0 };

  for (const { position, pillar } of sources) {
    if (!pillar) continue;

    const isDayMaster = position === '일주';
    const stemGod = isDayMaster ? null : tenGodOf(dayStem, pillar.stem);
    const branchMain = HIDDEN_STEMS[pillar.branch].at(-1)!.stem;
    const branchGod = tenGodOf(dayStem, branchMain);

    if (stemGod) godCounts[GOD_GROUP[stemGod]]++;
    godCounts[GOD_GROUP[branchGod]]++;

    pillars.push({
      position,
      stem: pillar.stem,
      branch: pillar.branch,
      stemGod,
      branchGod,
      hidden: HIDDEN_STEMS[pillar.branch].map((h) => ({
        stem: h.stem, role: h.role, god: tenGodOf(dayStem, h.stem),
      })),
      stage: twelveStage(dayStem, pillar.branch),
    });
  }

  const elements = elementWeights(ms);
  const strength = analyzeStrength(ms);
  const yongsin = findYongsin(ms, strength);
  const relations = findRelations(ms);
  const sinsal = findSinsal(ms);

  const missingGroups = GROUPS.filter((g) => godCounts[g] === 0);
  /*
   * 「없는 오행」은 무게가 0인 것이 아니라 **글자로도 안 보이는 것**이다.
   *
   * 일간은 저울에 올리지 않는다 — 재는 주체이지 재어지는 것이 아니다. 그래서
   * 계수 일간인 사람도 수의 무게는 0으로 나온다. 그것을 「수가 전혀 없다」고
   * 말해 버리면 제 일간을 없다고 하는 셈이라, 손님이 첫 줄에서 우리를 접는다.
   */
  const missingElements = elements
    .filter((e) => e.weight === 0 && e.visibleCount === 0)
    .map((e) => e.element);

  return {
    dayMaster: {
      stem: dayStem,
      element: ms.day.element.stem,
      yinYang: ms.day.stemIndex % 2 === 0 ? '양' : '음',
    },
    pillars,
    godCounts,
    missingGroups,
    elements,
    missingElements,
    strength,
    yongsin,
    relations,
    sinsal,
    highlights: buildHighlights({ ms, godCounts, missingGroups, elements, missingElements, strength, relations, sinsal }),
  };
}

/**
 * 해석에서 먼저 다뤄야 할 특징을 뽑는다.
 *
 * 조사에서 확인한 사용자 불만이 "다 좋은 말만 나온다"였다.
 * 그래서 여기서는 두드러진 것을 좋고 나쁨 가리지 않고 골라낸다 —
 * 과잉, 결핍, 충돌까지 전부. 무난한 명식이면 무난하다고 말한다.
 */
function buildHighlights(a: {
  ms: Myeongsik;
  godCounts: Record<GodGroup, number>;
  missingGroups: GodGroup[];
  elements: ElementWeight[];
  missingElements: string[];
  strength: StrengthDetail;
  relations: Relation[];
  sinsal: Sinsal[];
}): string[] {
  const out: string[] = [];

  out.push(`일간 ${a.ms.day.stem}(${a.ms.day.element.stem}), ${a.strength.verdict} — 일간을 돕는 힘 ${a.strength.supportRatio}%.`);

  // 과잉
  const heavy = a.elements.filter((e) => e.weight >= 35).sort((x, y) => y.weight - x.weight);
  for (const e of heavy) {
    out.push(`${e.element}이 ${e.weight}%로 크게 치우쳐 있다. 이 기운이 명식 전체를 끌고 간다.`);
  }

  // 결핍
  if (a.missingElements.length) {
    out.push(`${a.missingElements.join('·')} 기운이 명식에 전혀 없다. 지장간까지 따져도 나오지 않는다.`);
  }
  for (const g of a.missingGroups) {
    out.push(`${g}이 하나도 없다 — ${groupAbsenceNote(g)}`);
  }

  // 특정 십신 과다
  for (const g of GROUPS) {
    if (a.godCounts[g] >= 4) {
      out.push(`${g}이 ${a.godCounts[g]}개로 많다. 그 영역의 일이 반복해서 나타난다고 본다.`);
    }
  }

  // 충·형은 반드시 언급한다
  for (const r of a.relations) {
    if (r.kind === '지지충' || r.kind === '천간충' || r.kind === '형') {
      out.push(`${r.name} (${r.positions.join('·')}) — ${r.note}`);
    }
    if (r.kind === '삼합') {
      out.push(`${r.name} — ${r.note}`);
    }
  }

  // 눈에 띄는 신살만
  for (const s of a.sinsal) {
    if (['천을귀인', '괴강', '양인'].includes(s.name)) {
      out.push(`${s.name} (${s.positions.join('·')}) — ${s.note}`);
    }
  }

  if (out.length === 1) {
    out.push('오행이 고르고 충·형도 없다. 특정 영역이 튀지 않는 무난한 구성이다.');
  }

  return out;
}

function groupAbsenceNote(g: GodGroup): string {
  switch (g) {
    case '비겁': return '기댈 동료나 경쟁 관계가 약하다는 뜻으로 읽는다.';
    case '식상': return '표현하고 내보내는 통로가 약하다는 뜻으로 읽는다.';
    case '재성': return '재물과 현실적 성취를 다루는 축이 약하다는 뜻으로 읽는다.';
    case '관성': return '규범·직책·자기 통제의 축이 약하다는 뜻으로 읽는다.';
    case '인성': return '배움과 보호를 받는 축이 약하다는 뜻으로 읽는다.';
  }
}

/** 십신별 의미를 붙여 사람이 읽는 요약으로. 디버깅과 검증 출력용. */
export function formatAnalysis(a: Analysis): string {
  const lines: string[] = [];
  lines.push(`일간 ${a.dayMaster.stem}(${a.dayMaster.element}·${a.dayMaster.yinYang}) — ${a.strength.verdict}`);
  lines.push('');
  for (const p of a.pillars) {
    const stem = p.stemGod ? `${p.stem}=${p.stemGod}` : `${p.stem}=일간`;
    lines.push(`  ${p.position}  ${stem}  ${p.branch}=${p.branchGod}  [${p.stage}]`);
  }
  lines.push('');
  lines.push(`  오행  ${a.elements.map((e) => `${e.element} ${e.weight}%`).join('  ')}`);
  lines.push(`  십신  ${GROUPS.map((g) => `${g} ${a.godCounts[g]}`).join('  ')}`);
  lines.push(`  용신  ${a.yongsin.primary.join('·')}  (기피 ${a.yongsin.avoid.join('·') || '없음'})`);
  if (a.relations.length) lines.push(`  관계  ${a.relations.map((r) => r.name).join(', ')}`);
  if (a.sinsal.length) lines.push(`  신살  ${a.sinsal.map((s) => s.name).join(', ')}`);
  return lines.join('\n');
}

export { GOD_MEANING };
