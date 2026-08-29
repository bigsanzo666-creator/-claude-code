/**
 * 글자끼리의 관계(합·충·형)와 신살.
 *
 * 십신이 "일간 대 각 글자"의 세로 관계라면, 합충은 "글자끼리"의 가로 관계다.
 * 충이 있으면 그 자리의 일이 흔들리고, 합이 있으면 묶여서 본래 작용을 덜 한다.
 */

import type { Myeongsik } from '../../manseryeok/src/index.ts';
import { josa } from './josa.ts';
import {
  STEM_COMBINATIONS, STEM_CLASHES, BRANCH_SIX_COMBOS, BRANCH_TRIPLE_COMBOS,
  BRANCH_CLASHES, BRANCH_PUNISHMENTS, CHEONEUL, PEACH_BLOSSOM, TRAVELING_HORSE,
  CANOPY, YANGIN, GOEGANG, BAEKHO,
} from './tables.ts';

export type PillarName = '연주' | '월주' | '일주' | '시주';

export interface Relation {
  kind: '천간합' | '천간충' | '지지육합' | '삼합' | '반합' | '지지충' | '형';
  name: string;
  /** 관여한 자리 */
  positions: PillarName[];
  /** 化하는 오행 (합인 경우) */
  becomes?: string;
  /** 이 관계가 명식에서 갖는 의미 */
  note: string;
}

export interface Sinsal {
  name: string;
  positions: PillarName[];
  basis: string;
  note: string;
}

interface Slot {
  position: PillarName;
  stem: string;
  branch: string;
}

function slotsOf(ms: Myeongsik): Slot[] {
  const slots: Slot[] = [
    { position: '연주', stem: ms.year.stem, branch: ms.year.branch },
    { position: '월주', stem: ms.month.stem, branch: ms.month.branch },
    { position: '일주', stem: ms.day.stem, branch: ms.day.branch },
  ];
  if (ms.hour) slots.push({ position: '시주', stem: ms.hour.stem, branch: ms.hour.branch });
  return slots;
}

/** 인접한 자리인지. 붙어 있어야 합충의 작용이 뚜렷하다고 본다. */
function isAdjacent(a: PillarName, b: PillarName): boolean {
  const order: PillarName[] = ['연주', '월주', '일주', '시주'];
  return Math.abs(order.indexOf(a) - order.indexOf(b)) === 1;
}

export function findRelations(ms: Myeongsik): Relation[] {
  const slots = slotsOf(ms);
  const found: Relation[] = [];

  // 천간끼리
  for (let i = 0; i < slots.length; i++) {
    for (let j = i + 1; j < slots.length; j++) {
      const [a, b] = [slots[i], slots[j]];

      const combo = STEM_COMBINATIONS.find(
        (c) => (c.pair[0] === a.stem && c.pair[1] === b.stem) || (c.pair[0] === b.stem && c.pair[1] === a.stem),
      );
      if (combo) {
        found.push({
          kind: '천간합', name: combo.name, positions: [a.position, b.position], becomes: combo.becomes,
          note: isAdjacent(a.position, b.position)
            ? '붙어 있어 묶임이 뚜렷하다. 두 글자 모두 본래 작용이 줄어든다.'
            : '떨어져 있어 묶임이 약하다.',
        });
      }

      const clash = STEM_CLASHES.find(
        (c) => (c[0] === a.stem && c[1] === b.stem) || (c[0] === b.stem && c[1] === a.stem),
      );
      if (clash) {
        found.push({
          kind: '천간충', name: `${a.stem}${b.stem}충`, positions: [a.position, b.position],
          note: '드러난 자리에서 부딪친다. 생각과 판단이 흔들리는 자리로 본다.',
        });
      }
    }
  }

  // 지지끼리
  for (let i = 0; i < slots.length; i++) {
    for (let j = i + 1; j < slots.length; j++) {
      const [a, b] = [slots[i], slots[j]];

      const six = BRANCH_SIX_COMBOS.find(
        (c) => (c.pair[0] === a.branch && c.pair[1] === b.branch) || (c.pair[0] === b.branch && c.pair[1] === a.branch),
      );
      if (six) {
        found.push({
          kind: '지지육합', name: six.name, positions: [a.position, b.position], becomes: six.becomes,
          note: '두 자리가 가까워진다. 해당 영역의 인연이 얽힌다고 본다.',
        });
      }

      const clash = BRANCH_CLASHES.find(
        (c) => (c[0] === a.branch && c[1] === b.branch) || (c[0] === b.branch && c[1] === a.branch),
      );
      if (clash) {
        found.push({
          kind: '지지충', name: `${a.branch}${b.branch}충`, positions: [a.position, b.position],
          note: isAdjacent(a.position, b.position)
            ? '붙어 있어 충의 작용이 강하다. 그 자리가 상징하는 영역에 변동이 잦다.'
            : '떨어져 있어 충이 약하다.',
        });
      }
    }
  }

  // 삼합 / 반합
  const branches = slots.map((s) => s.branch);
  for (const triple of BRANCH_TRIPLE_COMBOS) {
    const present = triple.members.filter((m) => branches.includes(m));
    if (present.length === 3) {
      found.push({
        kind: '삼합', name: triple.name, becomes: triple.becomes,
        positions: slots.filter((s) => triple.members.includes(s.branch)).map((s) => s.position),
        note: `세 지지가 모여 ${triple.becomes} 기운이 크게 강해진다. 명식의 무게 중심이 여기로 쏠린다.`,
      });
    } else if (present.length === 2 && present.includes(triple.members[1])) {
      // 가운데 글자(왕지)가 있어야 반합으로 인정한다
      found.push({
        kind: '반합', name: `${present.join('')} 반합`, becomes: triple.becomes,
        positions: slots.filter((s) => present.includes(s.branch)).map((s) => s.position),
        note: `${triple.becomes} 기운이 다소 강해진다. 삼합보다는 약하다.`,
      });
    }
  }

  // 형
  for (const p of BRANCH_PUNISHMENTS) {
    if (p.members.length === 2 && p.members[0] === p.members[1]) {
      if (branches.filter((b) => b === p.members[0]).length >= 2) {
        found.push({
          kind: '형', name: p.name,
          positions: slots.filter((s) => s.branch === p.members[0]).map((s) => s.position),
          note: '같은 글자가 겹쳐 스스로를 친다고 본다.',
        });
      }
    } else if (p.members.every((m) => branches.includes(m))) {
      found.push({
        kind: '형', name: p.name,
        positions: slots.filter((s) => p.members.includes(s.branch)).map((s) => s.position),
        note: '얽혀서 마찰이 생기는 조합. 충과 달리 서서히 드러난다고 본다.',
      });
    }
  }

  return found;
}

export function findSinsal(ms: Myeongsik): Sinsal[] {
  const slots = slotsOf(ms);
  const found: Sinsal[] = [];
  const dayStem = ms.day.stem;

  const at = (branch: string) => slots.filter((s) => s.branch === branch).map((s) => s.position);

  // 천을귀인 — 일간 기준
  for (const b of CHEONEUL[dayStem] ?? []) {
    const pos = at(b);
    if (pos.length) {
      found.push({
        name: '천을귀인', positions: pos, basis: `일간 ${dayStem} 기준`,
        note: '어려울 때 도움을 받는 자리로 본다. 신살 중 가장 널리 인정되는 길신이다.',
      });
    }
  }

  // 양인 — 일간 기준
  const yangin = YANGIN[dayStem];
  if (yangin) {
    const pos = at(yangin);
    if (pos.length) {
      found.push({
        name: '양인', positions: pos, basis: `일간 ${dayStem}의 제왕지`,
        note: '힘이 넘치는 자리. 추진력이 되기도 하고 날이 서기도 한다.',
      });
    }
  }

  // 도화·역마·화개 — 연지와 일지를 각각 기준으로 본다 (유파에 따라 기준이 갈린다)
  for (const [basisName, basisBranch] of [['연지', ms.year.branch], ['일지', ms.day.branch]] as const) {
    for (const [name, table, note] of [
      ['도화살', PEACH_BLOSSOM, '매력과 인기. 사람을 끄는 자리로 본다.'],
      ['역마살', TRAVELING_HORSE, '이동과 변화. 한곳에 머물지 않는 기운.'],
      ['화개살', CANOPY, '고독과 몰입. 예술·학문·종교 쪽으로 읽는다.'],
    ] as const) {
      const target = table[basisBranch];
      const pos = at(target);
      if (pos.length) {
        found.push({
          name, positions: pos, basis: `${basisName} ${basisBranch} 기준`,
          note,
        });
      }
    }
  }

  // 괴강·백호 — 주(柱) 단위
  for (const s of slots) {
    const pillar = s.stem + s.branch;
    if (GOEGANG.includes(pillar)) {
      found.push({
        name: '괴강', positions: [s.position], basis: `${s.position} ${pillar}`,
        note: '극단으로 치우치기 쉬운 강한 기운. 크게 되거나 크게 꺾인다고 본다.',
      });
    }
    if (BAEKHO.includes(pillar)) {
      found.push({
        name: '백호대살', positions: [s.position], basis: `${s.position} ${pillar}`,
        note: '기세가 사납다고 보는 자리. 현대 해석에서는 강한 추진력으로 읽기도 한다.',
      });
    }
  }

  // 같은 신살이 여러 자리에 걸리면 하나로 합친다
  const merged = new Map<string, Sinsal>();
  for (const s of found) {
    const key = `${s.name}|${s.basis}`;
    const prev = merged.get(key);
    if (prev) prev.positions = [...new Set([...prev.positions, ...s.positions])];
    else merged.set(key, { ...s });
  }
  return [...merged.values()];
}
