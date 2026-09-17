/**
 * 손님이 적은 꿈에서 낱말을 찾아 풀이를 낸다.
 *
 * 전부 표에서 꺼내 온다. **모델을 부르지 않으므로 원가가 0이다.**
 * 공짜로 내놓는 것이라 이 점이 중요하다 — 사람이 아무리 몰려도 돈이 안 나간다.
 *
 * ## 못 찾았을 때 지어내지 않는다
 *
 * 표에 없는 꿈이면 **없다고 말한다.** 아무 말이나 지어 붙이면 그 순간
 * 「아무 말이나 하는 곳」이 된다. 대신 무엇을 적으면 찾을 수 있는지 알려 준다.
 *
 * ## 근거를 단다
 *
 * 풀이마다 **손님이 쓴 어느 낱말에서 나왔는지**를 같이 낸다. 그래야 손님이
 * 「내 꿈을 읽었구나」로 받는다. 근거 없는 결론은 점집이 하는 짓이다.
 */

import { SYMBOLS, TONE_LABEL, type DreamSymbol, type Tone } from './symbols.ts';

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
  hits: DreamHit[];
  /** 찾아낸 것이 없을 때 손님에게 할 말 */
  miss: string | null;
  /** 여기까지가 공짜라는 것을 신령이 직접 말한다 */
  cut: string;
}

/** 글자를 견주기 좋게 다듬는다. 띄어쓰기만 없앤다 */
function squash(text: string): string {
  return text.replace(/\s+/g, '');
}

/**
 * 몇 개까지 보여 줄 것인가.
 *
 * 꿈 하나에 열 가지를 늘어놓으면 읽지 않는다. 앞의 넷만 준다.
 * 좋게 보는 것을 앞에 둔다 — 겁부터 주지 않기 위해서다.
 */
const MAX_HITS = 4;

export function readDream(text: string): DreamReading {
  const raw = String(text ?? '');
  const flat = squash(raw);

  const hits: DreamHit[] = [];
  for (const sym of SYMBOLS) {
    // 같은 낱말을 두 번 세지 않는다
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
      head: '적어 주신 글에서는 아는 낱말을 찾지 못했습니다.',
      hits: [],
      miss: '꿈에 **무엇이 나왔는지**를 한 낱말이라도 적어 주시면 찾을 수 있습니다. ' +
        '예를 들어 돼지·뱀·물·불·돈·아기·이빨처럼요. 문장이 길지 않아도 됩니다.',
      cut: '',
    };
  }

  const good = shown.filter((h) => h.tone === '길').length;
  const head = good === shown.length
    ? `좋게 보는 꿈입니다. ${shown.length}가지가 걸렸고 모두 들어오는 쪽입니다.`
    : good > 0
      ? `${shown.length}가지가 걸렸습니다. 그중 ${good}가지는 좋게 보는 꿈입니다.`
      : `${shown.length}가지가 걸렸습니다. 놀랄 것은 없고, 살펴볼 자리를 짚어 드립니다.`;

  return {
    head,
    hits: shown,
    miss: null,
    // 준 것과 남은 것을 분명히 한다. 그래야 손님이 속았다고 느끼지 않는다
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
