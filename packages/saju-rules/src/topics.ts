/**
 * 주제별로 명식을 자른다.
 *
 * 경쟁사가 상품을 열 개 넘게 파는 방법이 이것이다. 상품을 각각 만드는 게 아니라
 * **하나의 명식에서 나온 해석을 주제별로 잘라** 각각 이름을 붙인다.
 * 계산은 한 번, 파는 건 열 번.
 *
 * 여기서 지키는 두 가지.
 *
 * **1. 이름과 계산을 분리한다.**
 * 「재성」을 「돈그릇」이라 부를지 「재물운」이라 부를지는 장사의 문제지
 * 명리의 문제가 아니다. 이름은 `TOPIC_LABELS` 한 곳에만 있어서, 바꿀 때
 * 계산 코드를 건드리지 않는다.
 *
 * **2. 용어를 그냥 던지지 않는다.**
 * 경쟁사들은 "식상"이라 써놓고 곧바로 "자녀운이 좋습니다"로 넘어간다.
 * 손님은 식상이 뭔지 모른 채 결론만 받는다. 그 사이가 비어 있다.
 * 그래서 모든 주제가 `term`(명리 용어)과 `gloss`(한 줄 뜻)를 함께 들고 다닌다 —
 * 화면에서 큰 글씨는 쉬운 말, 옆에 작은 글씨로 용어와 뜻.
 */

import type { Analysis, PillarAnalysis } from './index.ts';
import { GOD_GROUP, GOD_MEANING, type GodGroup, type TenGod } from './tenGods.ts';

/** 주제 식별자. **이 값은 절대 바꾸지 않는다** — 주문에 남고 결제와 묶인다 */
export type TopicId =
  | 'wealth' | 'career' | 'expression' | 'learning' | 'peers'
  | 'charm' | 'travel' | 'helper';

export interface TopicLabel {
  /** 손님에게 보일 이름. 장사의 영역이라 자주 바뀐다 */
  label: string;
  /** 명리 용어 */
  term: string;
  termHanja: string;
  /** 그 용어가 무슨 뜻인지 한 줄로. 화면에 그대로 나간다 */
  gloss: string;
}

/**
 * 이름표.
 *
 * **바꿀 곳은 여기뿐이다.** 계산 코드는 `TopicId`만 안다.
 */
export const TOPIC_LABELS: Record<TopicId, TopicLabel> = {
  wealth: {
    label: '돈그릇',
    term: '재성', termHanja: '財星',
    gloss: '내가 다루는 재물과 사람을 뜻합니다',
  },
  career: {
    label: '출세운',
    term: '관성', termHanja: '官星',
    gloss: '나를 규율하는 자리와 명예를 뜻합니다',
  },
  expression: {
    label: '재능운',
    term: '식상', termHanja: '食傷',
    gloss: '내가 밖으로 내놓는 것 — 표현·재능·자녀를 뜻합니다',
  },
  learning: {
    label: '공부·문서운',
    term: '인성', termHanja: '印星',
    gloss: '나를 돕고 채워주는 것 — 배움·문서·보호를 뜻합니다',
  },
  peers: {
    label: '사람운',
    term: '비겁', termHanja: '比劫',
    gloss: '나와 같은 자리에 선 사람 — 동료이자 경쟁자를 뜻합니다',
  },
  charm: {
    label: '매력 삼합',
    term: '도화·홍염', termHanja: '桃花·紅艶',
    gloss: '사람을 끌어당기는 기운을 뜻합니다',
  },
  travel: {
    label: '이동·해외운',
    term: '역마', termHanja: '驛馬',
    gloss: '한자리에 머무르지 않는 기운을 뜻합니다',
  },
  helper: {
    label: '귀인운',
    term: '천을귀인', termHanja: '天乙貴人',
    gloss: '어려울 때 나를 돕는 사람을 뜻합니다',
  },
};

/** 십신에 기반한 주제와, 신살에 기반한 주제를 나눈다 */
const GROUP_OF_TOPIC: Partial<Record<TopicId, GodGroup>> = {
  wealth: '재성', career: '관성', expression: '식상',
  learning: '인성', peers: '비겁',
};

/** 신살 이름으로 찾는 주제 */
const SINSAL_OF_TOPIC: Partial<Record<TopicId, string[]>> = {
  charm: ['도화살', '홍염살'],
  travel: ['역마살'],
  helper: ['천을귀인'],
};

/** 많고 적음의 판정. 어느 쪽도 좋고 나쁨이 아니다 */
export type Abundance = '없음' | '적음' | '적정' | '많음';

export interface TopicEvidence {
  /** 어느 기둥의 어느 글자에서 나왔는지 */
  where: string;
  /** 무엇이 나왔는지 */
  what: string;
  /** 겉 글자인지 지장간인지 */
  depth: '천간' | '지지' | '지장간';
}

export interface TopicReading extends TopicLabel {
  id: TopicId;
  /**
   * 이 주제가 **겉으로** 얼마나 나타나는가.
   * 지장간은 세지 않는다 — 숨은 것과 드러난 것은 작용이 다르다.
   */
  abundance: Abundance;
  /** 겉으로 드러난 개수 (천간 + 지지 정기) */
  count: number;
  /** 지지 속에만 숨어 있는 개수. 겉이 0인데 이게 있으면 "없다"고 말하면 안 된다 */
  hiddenCount: number;
  /** 근거 — 어느 글자에서 나왔는지. **결론마다 이게 붙어야 한다** */
  evidence: TopicEvidence[];
  /** 이 주제에 해당하는 십신들이 통상 상징하는 것 */
  aspects: string[];
  /** 용신과의 관계. 이 기운을 써야 하는 명식인가 */
  favorable: boolean | null;
  /** 문장을 만들 때 먼저 다뤄야 할 사실 */
  notes: string[];
}

function abundanceOf(count: number): Abundance {
  if (count === 0) return '없음';
  if (count === 1) return '적음';
  if (count <= 3) return '적정';
  return '많음';
}

/** 십신 기반 주제의 근거를 모은다. 지장간까지 센다 */
function godEvidence(pillars: PillarAnalysis[], group: GodGroup): TopicEvidence[] {
  const found: TopicEvidence[] = [];
  for (const p of pillars) {
    const at = p.position;
    if (p.stemGod && GOD_GROUP[p.stemGod] === group) {
      found.push({ where: `${at} 천간 ${p.stem}`, what: p.stemGod, depth: '천간' });
    }
    if (GOD_GROUP[p.branchGod] === group) {
      found.push({ where: `${at} 지지 ${p.branch}`, what: p.branchGod, depth: '지지' });
    }
    for (const h of p.hidden) {
      if (GOD_GROUP[h.god] === group && h.role !== '정기') {
        found.push({ where: `${at} ${p.branch} 속 ${h.stem}`, what: h.god, depth: '지장간' });
      }
    }
  }
  return found;
}

/**
 * 한 주제를 뽑는다.
 *
 * 판단은 여기서 끝난다. 문장은 `packages/report`가 만든다 —
 * 룰이 판단하고 모델은 문장화만 한다는 원칙은 주제별로 잘라도 그대로다.
 */
export function extractTopic(analysis: Analysis, id: TopicId): TopicReading {
  const label = TOPIC_LABELS[id];
  const group = GROUP_OF_TOPIC[id];
  const notes: string[] = [];

  if (group) {
    const evidence = godEvidence(analysis.pillars, group);
    const count = analysis.godCounts[group] ?? 0;
    const hiddenCount = evidence.filter((e) => e.depth === '지장간').length;
    const abundance = abundanceOf(count);
    const gods = [...new Set(evidence.map((e) => e.what))] as TenGod[];
    // 용신은 "써야 할 기운"과 "덜어낼 기운"을 따로 준다.
    // 어느 쪽에도 없으면 이 주제에 대해 용신이 할 말이 없다는 뜻이라 null이다.
    const favorable = analysis.yongsin.primary.includes(group) ? true
      : analysis.yongsin.avoid.includes(group) ? false : null;

    if (abundance === '없음' && hiddenCount > 0) {
      // 이 구분이 중요하다. 겉이 비었다고 "없다"고 말하면 틀린 말이 된다
      notes.push(`${label.term}이 겉으로는 드러나 있지 않지만, 지지 속에 ${hiddenCount}개 숨어 있습니다. 남들 눈에 잘 보이지 않는 방식으로 작용합니다.`);
    } else if (abundance === '없음') {
      notes.push(`${label.term}이 명식에 없습니다. 없다는 것이 곧 나쁘다는 뜻은 아니며, 이 영역을 타고나기보다 스스로 만들어 가야 한다는 뜻으로 봅니다.`);
    } else if (abundance === '많음') {
      notes.push(`${label.term}이 ${count}개로 많습니다. 한쪽으로 기운이 몰려 있어, 그 영역에서 힘도 크고 흔들림도 큽니다.`);
    }
    if (abundance !== '없음' && hiddenCount > 0) {
      notes.push(`겉에 드러난 것 외에 지지 속에 ${hiddenCount}개가 더 있습니다. 드러나지 않게 작용합니다.`);
    }
    if (favorable === true) {
      notes.push(`용신 기준으로 이 명식이 **써야 하는 기운**에 해당합니다.`);
    } else if (favorable === false) {
      notes.push(`용신 기준으로는 덜어내야 하는 쪽입니다. 많다고 좋은 것이 아닙니다.`);
    }

    return {
      id, ...label, abundance, count, hiddenCount, evidence, favorable, notes,
      aspects: gods.map((g) => `${g} — ${GOD_MEANING[g]}`),
    };
  }

  // 신살 기반 주제
  const names = SINSAL_OF_TOPIC[id] ?? [];
  const hits = analysis.sinsal.filter((s) => names.some((n) => s.name.includes(n.replace('살', ''))));
  const evidence: TopicEvidence[] = hits.flatMap((s) =>
    (s.positions.length ? s.positions : ['명식' as const]).map((at) => ({
      where: `${at} — ${s.basis}`,
      what: s.name,
      depth: '지지' as const,
    })));

  if (!hits.length) {
    notes.push(`${label.term}이 명식에 없습니다. 이 기운을 타고나지 않았다는 뜻이지, 그 영역이 막혀 있다는 뜻이 아닙니다.`);
  }

  return {
    id, ...label,
    abundance: abundanceOf(hits.length),
    count: hits.length,
    hiddenCount: 0,
    evidence,
    aspects: [...new Set(hits.map((s) => `${s.name} — ${s.note}`))],
    favorable: null,
    notes,
  };
}

export const ALL_TOPICS: TopicId[] = [
  'wealth', 'career', 'expression', 'learning', 'peers', 'charm', 'travel', 'helper',
];

export function allTopics(analysis: Analysis): TopicReading[] {
  return ALL_TOPICS.map((id) => extractTopic(analysis, id));
}
