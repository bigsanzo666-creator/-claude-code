/**
 * 사주 분석 결과 → 공통 성향 척도.
 *
 * 관상·손금과 대조하려면 같은 축으로 환산해야 한다.
 * 환산 근거는 반드시 사주 용어로 남긴다 — "재성이 없다" 같은 식으로.
 * 그래야 나중에 "사주는 왜 그렇게 말했나"를 되짚을 수 있다.
 */

import type { TraitProfile, TraitSignal, TraitAxis } from '../../traits/src/index.ts';
import type { Analysis } from './index.ts';
import type { GodGroup } from './tenGods.ts';

/** 비중(%)을 −2~+2로 환산. 다섯 그룹이 고르면 각 20%가 된다. */
function ratioToScore(pct: number): -2 | -1 | 0 | 1 | 2 {
  if (pct >= 32) return 2;
  if (pct >= 24) return 1;
  if (pct >= 12) return 0;
  if (pct >= 5) return -1;
  return -2;
}

/** 각 십신 그룹이 어느 축을 대표하는지 */
const GROUP_AXES: Record<GodGroup, TraitAxis[]> = {
  재성: ['재물'],
  식상: ['표현력'],
  관성: ['리더십'],
  인성: ['학습·직관'],
  비겁: ['대인관계', '추진력'],
};

export function sajuToTraits(a: Analysis): TraitProfile {
  const signals: TraitSignal[] = [];
  const push = (axis: TraitAxis, score: number, evidence: string) => {
    if (score === 0) return;
    signals.push({ axis, score: Math.max(-2, Math.min(2, score)) as TraitSignal['score'], evidence });
  };

  // 십신 비중
  for (const [group, axes] of Object.entries(GROUP_AXES) as [GodGroup, TraitAxis[]][]) {
    const pct = a.strength.scores[group];
    const score = ratioToScore(pct);
    const evidence = score === -2
      ? `${group}이 사실상 없다 (${pct}%)`
      : `${group}이 ${pct}%`;
    for (const axis of axes) push(axis, score, evidence);
  }

  // 일간의 강약 — 밀고 나가는 힘과 버티는 힘의 근거
  if (a.strength.verdict === '신강') {
    push('추진력', 1, `일간이 신강 (${a.strength.supportRatio}%)`);
    push('인내', 1, `일간이 신강 (${a.strength.supportRatio}%)`);
  } else if (a.strength.verdict === '신약') {
    push('추진력', -1, `일간이 신약 (${a.strength.supportRatio}%)`);
    push('대인관계', 1, `일간이 신약이라 주변의 힘을 빌리는 구조`);
  }

  // 오행 편중
  const w = (el: string) => a.elements.find((e) => e.element === el)?.weight ?? 0;
  if (w('토') >= 30) push('안정성', 2, `토가 ${w('토')}%로 두텁다`);
  else if (w('토') < 8) push('안정성', -1, `토가 ${w('토')}%로 얇다`);
  if (w('금') >= 30) push('인내', 1, `금이 ${w('금')}%로 강하다`);
  if (w('화') >= 30) push('표현력', 1, `화가 ${w('화')}%로 강하다`);
  if (w('수') >= 30) push('학습·직관', 1, `수가 ${w('수')}%로 강하다`);
  if (w('목') >= 30) push('추진력', 1, `목이 ${w('목')}%로 강하다`);

  // 충·합
  const clashes = a.relations.filter((r) => r.kind === '지지충' || r.kind === '천간충' || r.kind === '형').length;
  const combos = a.relations.filter((r) => r.kind.includes('합')).length;
  if (clashes >= 2) push('안정성', -2, `충·형이 ${clashes}개로 많다`);
  else if (clashes === 1) push('안정성', -1, `충 또는 형이 있다`);
  if (combos >= 2) push('대인관계', 1, `합이 ${combos}개로 얽힘이 많다`);

  // 신살
  if (a.sinsal.some((s) => s.name === '괴강')) push('추진력', 1, '일주가 괴강');
  if (a.sinsal.some((s) => s.name === '양인')) push('추진력', 1, '양인이 있다');
  if (a.sinsal.some((s) => s.name === '천을귀인')) push('대인관계', 1, '천을귀인이 있다');
  if (a.sinsal.some((s) => s.name === '역마살')) push('안정성', -1, '역마살이 있다');
  if (a.sinsal.some((s) => s.name === '화개살')) push('학습·직관', 1, '화개살이 있다');

  return { source: '사주', signals };
}
