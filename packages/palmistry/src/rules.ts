/**
 * 손금 특징 → 공통 성향 척도.
 *
 * 관상과 같은 방식이다. 전통 해석을 옮기되 단정하지 않고,
 * 근거에 원래 용어(선 이름)를 남겨 나중에 사주·관상과 대조할 때 추적할 수 있게 한다.
 *
 * 손금은 특히 "수명"과 엮어 겁을 주기 쉬운 영역이라 주의한다.
 * 생명선은 수명이 아니라 **체력과 지구력**으로만 읽는다. 이건 규칙이다.
 */

import type { TraitProfile, TraitSignal } from '../../traits/src/index.ts';
import { type PalmFeatures, type HandShape, HAND_SHAPE_SHORT } from './features.ts';

const lv = (v: 'low' | 'mid' | 'high'): -1 | 0 | 1 => (v === 'high' ? 1 : v === 'low' ? -1 : 0);

export interface PalmistryReading {
  profile: TraitProfile;
  notes: { domain: string; text: string }[];
  highlights: string[];
}

/** 손 모양이 갖는 성향. 오행 이름을 그대로 쓰므로 사주와 대조하기 쉽다. */
const HAND_SHAPE_RULES: Record<HandShape, { axis: TraitSignal['axis']; score: 1 | -1 }[]> = {
  목형: [{ axis: '학습·직관', score: 1 }, { axis: '인내', score: -1 }],
  화형: [{ axis: '추진력', score: 1 }, { axis: '표현력', score: 1 }, { axis: '인내', score: -1 }],
  토형: [{ axis: '인내', score: 1 }, { axis: '안정성', score: 1 }, { axis: '재물', score: 1 }],
  금형: [{ axis: '인내', score: 1 }, { axis: '리더십', score: 1 }],
  수형: [{ axis: '대인관계', score: 1 }, { axis: '표현력', score: 1 }, { axis: '안정성', score: -1 }],
};

const HAND_SHAPE_TEXT: Record<HandShape, string> = {
  목형: '목형 손입니다. 생각이 앞서고 머리로 푸는 편이라, 몸으로 오래 버티는 일은 덜 맞는다고 봅니다.',
  화형: '화형 손입니다. 시작이 빠르고 표현이 시원한 대신, 길게 끄는 일에서는 지치기 쉽다고 봅니다.',
  토형: '토형 손입니다. 꾸준하고 실속을 챙기는 손으로, 모으고 지키는 데 유리하다고 봅니다.',
  금형: '금형 손입니다. 원칙이 분명하고 마무리가 야무진 손으로 봅니다.',
  수형: '수형 손입니다. 사람과 분위기를 잘 읽는 대신 마음이 자주 움직인다고 봅니다.',
};

export function readPalm(f: PalmFeatures): PalmistryReading {
  const signals: TraitSignal[] = [];
  const notes: { domain: string; text: string }[] = [];
  const push = (axis: TraitSignal['axis'], score: number, evidence: string) => {
    if (score === 0) return;
    signals.push({ axis, score: Math.max(-2, Math.min(2, score)) as TraitSignal['score'], evidence });
  };

  // 생명선 — 체력과 지구력. 수명과 엮지 않는다.
  const ll = lv(f.lifeLength);
  const ld = lv(f.lifeDepth);
  if (ll !== 0) {
    push('인내', ll * 2, `생명선이 ${ll > 0 ? '길다' : '짧다'}`);
    push('안정성', ll, `생명선이 ${ll > 0 ? '길다' : '짧다'}`);
  }
  if (ld !== 0) push('추진력', ld, `생명선이 ${ld > 0 ? '뚜렷하다' : '옅다'}`);
  if (ll !== 0 || ld !== 0) {
    notes.push({
      domain: '생명선',
      text: '생명선은 수명이 아니라 체력과 지구력을 봅니다. ' +
        (ll > 0 ? '길게 뻗어 있어 오래 쓰는 힘이 있다고 봅니다. '
          : ll < 0 ? '짧은 편이라 한 번에 몰아 쓰기보다 나눠 쓰는 쪽이 맞다고 봅니다. ' : '') +
        (ld > 0 ? '선이 뚜렷해 기운을 밀어내는 힘이 좋습니다.'
          : ld < 0 ? '선이 옅은 편이라 무리하면 금세 티가 난다고 봅니다.' : ''),
    });
  }

  // 두뇌선 — 사고의 폭. 길면 신중, 짧으면 결단이 빠르다.
  const hl = lv(f.headLength);
  const hd = lv(f.headDepth);
  if (hl > 0) {
    push('학습·직관', 1, '두뇌선이 길다');
    push('안정성', 1, '두뇌선이 길어 신중하다');
  } else if (hl < 0) {
    push('추진력', 1, '두뇌선이 짧아 결단이 빠르다');
    push('학습·직관', -1, '두뇌선이 짧다');
  }
  if (hd !== 0) push('학습·직관', hd, `두뇌선이 ${hd > 0 ? '뚜렷하다' : '옅다'}`);
  if (hl !== 0 || hd !== 0) {
    notes.push({
      domain: '두뇌선',
      text: (hl > 0 ? '두뇌선이 긴 편입니다. 오래 재고 따지는 쪽이라 판단이 신중한 대신 결정이 느립니다. '
        : hl < 0 ? '두뇌선이 짧은 편입니다. 재지 않고 바로 정하는 쪽이라 빠른 대신 나중에 되짚는 일이 생깁니다. ' : '') +
        (hd > 0 ? '선이 뚜렷해 한번 잡은 생각을 깊게 파고듭니다.'
          : hd < 0 ? '선이 옅어 관심이 여러 곳으로 흩어지기 쉽습니다.' : ''),
    });
  }

  // 감정선 — 정의 범위와 세기
  const el = lv(f.heartLength);
  const ed = lv(f.heartDepth);
  if (el > 0) {
    push('대인관계', 1, '감정선이 길다');
    push('표현력', 1, '감정선이 길다');
  } else if (el < 0) {
    push('대인관계', -1, '감정선이 짧다');
    push('안정성', 1, '감정선이 짧아 감정을 절제한다');
  }
  if (ed !== 0) push('대인관계', ed, `감정선이 ${ed > 0 ? '뚜렷하다' : '옅다'}`);
  if (el !== 0 || ed !== 0) {
    notes.push({
      domain: '감정선',
      text: (el > 0 ? '감정선이 긴 편입니다. 정을 넓게 주고 표현도 잘 하는 쪽으로 봅니다. '
        : el < 0 ? '감정선이 짧은 편입니다. 사람을 가려 두고 속을 잘 내보이지 않는 쪽으로 봅니다. ' : '') +
        (ed > 0 ? '선이 뚜렷해 한번 맺은 정이 오래갑니다.'
          : ed < 0 ? '선이 옅어 감정의 기복이 겉으로 잘 드러나지 않습니다.' : ''),
    });
  }

  // 운명선 — 사회적 궤도. 없는 사람도 많으므로 없다고 나쁘게 말하지 않는다.
  const fc = lv(f.fateClarity);
  if (fc > 0) {
    push('리더십', 1, '운명선이 뚜렷하다');
    push('재물', 1, '운명선이 뚜렷하다');
    push('안정성', 1, '운명선이 뚜렷하다');
  } else if (fc < 0) {
    push('안정성', -1, '운명선이 흐리다');
  }
  if (fc !== 0) {
    notes.push({
      domain: '운명선',
      text: fc > 0
        ? '운명선이 뚜렷합니다. 한 길로 쌓아 올리는 흐름이고, 자리를 잡으면 오래 간다고 봅니다.'
        : '운명선이 흐린 편입니다. 정해진 궤도가 없다는 뜻이지 나쁜 것이 아닙니다. ' +
          '한 길로 가기보다 여러 갈래를 오가며 자기 자리를 만드는 쪽으로 봅니다.',
    });
  }

  // 막쥔손금
  if (f.simianLine) {
    push('추진력', 2, '막쥔손금(두뇌선과 감정선이 하나)');
    push('안정성', -1, '막쥔손금');
    notes.push({
      domain: '막쥔손금',
      text: '두뇌선과 감정선이 하나로 이어진 막쥔손금입니다. 생각과 감정이 한 방향으로 몰려 ' +
        '집중력이 대단한 대신 한번 꽂히면 방향을 틀기 어렵다고 봅니다.',
    });
  }

  // 손 모양
  for (const r of HAND_SHAPE_RULES[f.handShape]) {
    push(r.axis, r.score, `손 모양이 ${HAND_SHAPE_SHORT[f.handShape]}`);
  }
  notes.push({ domain: '손 모양', text: HAND_SHAPE_TEXT[f.handShape] });

  const highlights = notes
    .filter((n) => n.domain !== '손 모양')
    .slice(0, 4)
    .map((n) => n.text.split('. ')[0] + '.');

  return { profile: { source: '손금', signals }, notes, highlights };
}
