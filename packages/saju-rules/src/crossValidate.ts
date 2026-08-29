/**
 * 교차검증 — 사주·관상·손금이 같은 말을 하는가.
 *
 * 이것이 이 서비스가 파는 것이다.
 *
 * 세 가지를 각각 보여주는 곳은 이미 여럿 있다. 그런데 셋을 나란히 두기만 하면
 * 읽는 사람은 "그래서 뭐가 맞다는 건데"에서 멈춘다.
 * 여기서는 축마다 세 결과를 대조해서 세 가지로 나눈다:
 *
 *   일치   — 둘 이상이 같은 방향. 확신을 갖고 말할 수 있는 항목
 *   엇갈림 — 서로 반대 방향. 타고난 것과 지금의 차이, 즉 노력이 개입하는 지점
 *   단독   — 한쪽만 말하는 항목. 참고로만
 *
 * 엇갈림을 숨기지 않는 것이 핵심이다. 조사에서 확인한 불만이
 * "다 좋은 말만 한다"였는데, 엇갈림이야말로 그 반대편에 있는 정보다.
 */

import {
  TRAIT_AXES, collapse, scoreLabel,
  type TraitProfile, type TraitAxis, type TraitSource,
} from '../../traits/src/index.ts';
import { josa } from './josa.ts';

/** 여러 이름을 '와/과'로 잇는다. 마지막 연결만 받침을 따진다. */
function joinWith(names: string[]): string {
  if (names.length <= 1) return names[0] ?? '';
  return names.slice(0, -1).map((n) => josa(n, '와')).join(' ') + ' ' + names.at(-1);
}

export type Verdict = '일치' | '엇갈림' | '단독' | '해당 없음';

export interface AxisComparison {
  axis: TraitAxis;
  verdict: Verdict;
  /** 각 갈래가 이 축에 대해 낸 판정 */
  readings: { source: TraitSource; score: number; label: string; evidence: string[] }[];
  /** 합의된 방향 (일치일 때). 엇갈림이면 null */
  consensus: number | null;
  /** 읽는 사람에게 보여줄 문장 */
  text: string;
}

export interface CrossValidation {
  comparisons: AxisComparison[];
  agreed: AxisComparison[];
  conflicted: AxisComparison[];
  soloOnly: AxisComparison[];
  /** 몇 갈래를 대조했는지 */
  sourceCount: number;
  summary: string;
  disclaimer: string;
}

const dir = (n: number) => (n > 0 ? 1 : n < 0 ? -1 : 0);

export function crossValidate(...profiles: TraitProfile[]): CrossValidation {
  const present = profiles.filter((p) => p.signals.length > 0);
  const collapsed = present.map((p) => ({ source: p.source, map: collapse(p) }));

  const comparisons: AxisComparison[] = [];

  for (const axis of TRAIT_AXES) {
    const readings = collapsed.map((c) => {
      const cell = c.map.get(axis)!;
      return { source: c.source, score: cell.score, label: scoreLabel(cell.score), evidence: cell.evidence };
    });

    const speaking = readings.filter((r) => r.score !== 0);

    let verdict: Verdict;
    let consensus: number | null = null;
    let text: string;

    if (speaking.length === 0) {
      verdict = '해당 없음';
      text = `${axis}에 대해서는 어느 쪽도 특별히 말하지 않습니다. 평범한 수준으로 봅니다.`;
    } else if (speaking.length === 1) {
      verdict = '단독';
      const only = speaking[0];
      text = `${only.source}만 ${josa(axis, '을')} 언급합니다 — ${only.label}. ` +
        `근거: ${only.evidence.join(', ')}. 다른 쪽이 뒷받침하지 않으므로 참고로만 보십시오.`;
    } else {
      const dirs = new Set(speaking.map((r) => dir(r.score)));
      if (dirs.size === 1) {
        verdict = '일치';
        consensus = dir(speaking[0].score);
        const strength = consensus > 0 ? '강하다' : '약하다';
        text = `${joinWith(speaking.map((r) => r.source))} 모두 ${josa(axis, '이')} ${strength}고 봅니다. ` +
          `서로 다른 방식으로 본 결과가 같은 방향이므로, 이 항목은 확신을 갖고 읽어도 좋습니다. ` +
          `근거: ${speaking.map((r) => `${r.source}—${r.evidence[0] ?? ''}`).join(' / ')}.`;
      } else {
        verdict = '엇갈림';
        const strong = speaking.filter((r) => r.score > 0).map((r) => r.source);
        const weak = speaking.filter((r) => r.score < 0).map((r) => r.source);
        text = `${josa(strong.join('·'), '은')} ${josa(axis, '이')} 강하다고 보는데 ` +
          `${josa(weak.join('·'), '은')} 약하다고 봅니다. ` +
          `타고난 바탕과 지금 드러나는 모습이 어긋나는 지점입니다. ` +
          `이런 항목은 정해진 결과라기보다 노력과 환경이 크게 작용하는 영역으로 봅니다. ` +
          `근거: ${speaking.map((r) => `${r.source}—${r.evidence[0] ?? ''}`).join(' / ')}.`;
      }
    }

    comparisons.push({ axis, verdict, readings, consensus, text });
  }

  const agreed = comparisons.filter((c) => c.verdict === '일치');
  const conflicted = comparisons.filter((c) => c.verdict === '엇갈림');
  const soloOnly = comparisons.filter((c) => c.verdict === '단독');

  const summary = present.length < 2
    ? '대조하려면 두 가지 이상이 필요합니다. 관상이나 손금을 추가하면 교차검증이 가능합니다.'
    : `${present.map((p) => p.source).join('·')} ${present.length}가지를 대조했습니다. ` +
      `${agreed.length}개 항목에서 같은 방향을 가리키고, ${conflicted.length}개 항목이 엇갈립니다. ` +
      (conflicted.length === 0
        ? '엇갈리는 곳이 없어 전체적으로 결이 일관된 편입니다.'
        : `엇갈리는 ${conflicted.length}개가 이 사람에게 가장 흥미로운 지점입니다 — ` +
          '타고난 것과 지금의 모습이 다르다는 뜻이고, 바꿀 수 있는 여지가 거기에 있습니다.');

  return {
    comparisons, agreed, conflicted, soloOnly,
    sourceCount: present.length,
    summary,
    disclaimer:
      '교차검증은 서로 다른 방식의 해석을 나란히 놓고 비교한 것입니다. ' +
      '일치한다고 해서 사실로 증명된 것은 아니며, 엇갈린다고 해서 어느 한쪽이 틀린 것도 아닙니다. ' +
      '자기 이해를 위한 참고 자료로 보시기 바랍니다.',
  };
}
