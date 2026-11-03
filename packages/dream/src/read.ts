/**
 * 손님이 적은 꿈에서 낱말을 찾아 풀이를 낸다.
 *
 * 전부 표에서 꺼내 온다. **모델을 부르지 않으므로 원가가 0이다.**
 * 공짜로 내놓는 것이라 이 점이 중요하다 — 사람이 아무리 몰려도 돈이 안 나간다.
 *
 * ## 못 찾았을 때 지어내지 않는다
 * 표에 없는 꿈이면 솔직하게 없다고 말한다. 아무 말이나 지어 붙이지 않고,
 * 가장 많이 찾는 낱말 열 개를 바로 볼 수 있게 안내한다.
 *
 * ## 둘 이상 걸렸을 때 묶은 풀이를 맨 위에 쓴다
 * 꿈에 나온 낱말들이 둘 이상이면 조합을 종합한 한 줄 요약 문단을 상단에 싣는다.
 *
 * ## 근거를 단다
 * 풀이마다 손님이 쓴 어느 낱말에서 나왔는지를 같이 낸다.
 */

import { SYMBOLS, TONE_LABEL, type DreamSymbol, type Tone } from './symbols.ts';

/** 가장 많이 찾는 낱말 열 개 */
export const TOP_WORDS = ['돼지', '뱀', '돈', '똥', '맑은 물', '불', '돌아가신 분', '이빨', '피', '집'];

/** 찾아낸 낱말 하나 */
export interface DreamHit {
  id: string;
  group: DreamSymbol['group'];
  tone: Tone;
  toneLabel: string;
  say: string;
  more: string;
  /** 손님 글에서 이 낱말을 찾아낸 자리 */
  found: string;
}

export interface DreamReading {
  /** 한 줄 맺음 */
  head: string;
  /** 둘 이상 걸렸을 때 한데 묶은 풀이 (없으면 null) */
  combined: string | null;
  hits: DreamHit[];
  /** 찾아낸 것이 없을 때 손님에게 할 말 */
  miss: string | null;
  /** 찾아낸 것이 없을 때 바로 볼 수 있는 추천 낱말 열 개 */
  topWords: string[];
  /** 여기까지가 공짜라는 것을 신령이 직접 말한다 */
  cut: string;
}

/** 글자를 견주기 좋게 다듬는다. 띄어쓰기만 없앤다 */
function squash(text: string): string {
  return text.replace(/\s+/g, '');
}

/** 받침 유무 확인 */
function hasBatchim(word: string): boolean {
  if (!word) return false;
  const lastChar = word[word.length - 1];
  const code = lastChar.charCodeAt(0);
  if (code < 0xac00 || code > 0xd7a3) return false;
  return (code - 0xac00) % 28 > 0;
}

/** 낱말들을 자연스러운 한국어 조사로 엮는다 */
function formatWordList(words: string[]): string {
  if (words.length === 0) return '';
  if (words.length === 1) {
    const w = words[0];
    return w + (hasBatchim(w) ? '이' : '가');
  }
  let str = '';
  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    if (i === words.length - 1) {
      str += w + (hasBatchim(w) ? '이' : '가');
    } else {
      str += w + (hasBatchim(w) ? '과 ' : '와 ');
    }
  }
  return str;
}

/**
 * 둘 이상 걸렸을 때 한데 묶은 풀이를 만든다.
 * 예: 「집과 이사와 선물이 함께 나왔습니다. 전해 내려오는 해몽에서 이 셋이 같이 나오면 자리가 바뀌는 쪽으로 봅니다.」
 */
function buildCombinedReading(hits: DreamHit[]): string | null {
  if (hits.length < 2) return null;
  const names = hits.map((h) => h.id);
  const subjectStr = formatWordList(names);

  const hasMove = names.some((n) => ['집', '이사', '바꾸다', '길', '다리', '신발'].includes(n));
  const hasWealth = names.some((n) => ['돈', '금', '은', '돼지', '똥', '물고기', '통장', '쌀', '나무 열매'].includes(n));
  const hasNoble = names.some((n) => ['임금·대통령', '선생', '스님', '신부', '돌아가신 분', '용', '호랑이'].includes(n));
  const hasFamily = names.some((n) => ['언니', '형', '누나', '오빠', '동생', '친구'].includes(n));
  const hasRebirth = names.some((n) => ['죽음', '피', '불'].includes(n));

  let reasoning = '각 기운이 어우러져 새로운 국면이 순조롭게 열리는 쪽으로 봅니다.';
  if (hasMove && hasFamily) {
    reasoning = '가까운 인연과 함께 생활의 터전이나 자리가 새롭게 바뀌는 쪽으로 봅니다.';
  } else if (hasMove) {
    reasoning = '자리가 바뀌거나 환경에 큰 변화가 찾아오는 쪽으로 봅니다.';
  } else if (hasWealth && hasNoble) {
    reasoning = '귀인의 도움과 후원을 받아 굵직한 결실과 재물을 쥐는 쪽으로 봅니다.';
  } else if (hasWealth) {
    reasoning = '재물과 복록이 겹쳐서 들어와 곳간이 넉넉해지는 쪽으로 봅니다.';
  } else if (hasRebirth) {
    reasoning = '묵은 기운이 깨끗이 가시고 새로운 번영이 크게 일어나는 쪽으로 봅니다.';
  } else if (hasNoble) {
    reasoning = '높은 윗사람이나 길잡이를 만나 인생의 밝은 길을 얻는 쪽으로 봅니다.';
  } else if (hasFamily) {
    reasoning = '주변 인연들의 두터운 신뢰와 따뜻한 화합이 깃드는 쪽으로 봅니다.';
  }

  return `${subjectStr} 함께 나왔습니다. 전해 내려오는 해몽에서 이들이 같이 나오면 ${reasoning}`;
}

/**
 * 몇 개까지 보여 줄 것인가.
 * 너무 많이 늘어놓으면 산만하므로 최대 6개까지 준다.
 * 좋게 보는 것을 앞에 둔다.
 */
const MAX_HITS = 6;

export function readDream(text: string): DreamReading {
  const raw = String(text ?? '');
  const flat = squash(raw);

  const hits: DreamHit[] = [];
  for (const sym of SYMBOLS) {
    let found: string | null = null;
    for (const w of sym.words) {
      if (flat.includes(squash(w))) { found = w; break; }
    }
    if (!found) continue;
    hits.push({
      id: sym.id, group: sym.group, tone: sym.tone,
      toneLabel: TONE_LABEL[sym.tone],
      say: sym.say, more: sym.more, found,
    });
  }

  // 좋게 보는 것을 앞에. 겁부터 주지 않는다
  const order: Record<Tone, number> = { 길: 0, 중립: 1, 흉: 2 };
  hits.sort((a, b) => order[a.tone] - order[b.tone]);
  const shown = hits.slice(0, MAX_HITS);

  if (!shown.length) {
    return {
      head: '적어 주신 글에서 전해 내려오는 해몽에 있는 낱말을 찾지 못했습니다.',
      combined: null,
      hits: [],
      miss: '적어 주신 글에서 전해 내려오는 해몽에 있는 낱말을 찾지 못했습니다. ' +
        '꿈에 **무엇이 나왔는지**를 한 낱말이라도 적어 주시면 찾을 수 있습니다. ' +
        '예를 들어 돼지·뱀·물·불·돈·아기·이빨처럼요. 문장이 길지 않아도 됩니다.',
      topWords: TOP_WORDS,
      cut: '',
    };
  }

  const good = shown.filter((h) => h.tone === '길').length;
  const head = good === shown.length
    ? `좋게 보는 꿈입니다. ${shown.length}가지가 걸렸고 모두 들어오는 쪽입니다.`
    : good > 0
      ? `${shown.length}가지가 걸렸습니다. 그중 ${good}가지는 좋게 보는 꿈입니다.`
      : `${shown.length}가지가 걸렸습니다. 놀랄 것은 없고, 살펴볼 자리를 짚어 드립니다.`;

  const combined = buildCombinedReading(shown);

  return {
    head,
    combined,
    hits: shown,
    miss: null,
    topWords: [],
    cut: '꿈은 그날의 마음을 비춥니다. **타고난 여덟 글자**가 지금 어느 십 년을 ' +
      '지나고 있는지는 사주를 봐야 나옵니다. 그건 생년월일만 넣으시면 무료로 펼쳐 드립니다.',
  };
}

/** 표에 몇 낱말이 들어 있는가. 화면에서 「○○가지 꿈을 압니다」로 쓴다 */
export function symbolCount(): number {
  return SYMBOLS.length;
}

/** 손님에게 예시로 보여 줄 낱말들 */
export function sampleWords(n = 8): string[] {
  return SYMBOLS.slice(0, n).map((s) => s.id);
}
