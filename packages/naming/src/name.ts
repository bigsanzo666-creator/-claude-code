/**
 * 이름 후보를 만든다.
 *
 * ## 무엇을 기계가 하고 무엇을 사람이 하는가
 *
 * 기계는 **좁히는 일**만 한다. 여덟천 자에서 「이 성에, 이 사주에, 신고까지
 * 되는 글자」를 몇십 개로 줄인다. 그 안에서 어느 것이 이름다운지 — 소리가
 * 예쁜지, 놀림감이 되지 않는지, 뜻이 부모 마음에 닿는지 — 는 기계가 못 한다.
 * 그건 글을 쓰는 쪽이 고른다.
 *
 * 그래서 이 파일은 **답을 내지 않고 후보를 낸다.** 답을 내는 척하면 「왜 이
 * 이름이냐」에 답할 말이 없어진다.
 *
 * ## 좁히는 차례
 *
 * 1. 성의 획수를 잡는다
 * 2. 네 격(원·형·이·정)이 다 길한 **획수 짝**을 찾는다 — 보통 스무 짝 남짓
 * 3. 그 획수의 글자 중 **신고되는 것**만 남긴다
 * 4. 사주가 필요로 하는 오행(용신)이 있으면 그 기운의 글자를 앞세운다
 * 5. 학교에서 가르치는 기초한자를 앞세운다 — 이름은 남이 읽어야 한다
 */

import { readFileSync } from 'node:fs';
import {
  hanja, hanjaLegal, hanjaCommon,
  type Hanja, type Element,
} from './hanja.ts';
import { meaningBad, meaningGood } from './fit.ts';
import { readFrames, type FrameRead } from './numbers.ts';
import { surnamesByReading, surnameOf, type Surname } from './surname.ts';

/** 성을 한글로 받든 한자로 받든 하나로 만든다 */
export interface SurnameRead {
  /** 한자 성. 두 자 성이면 두 자 */
  chars: string[];
  /** 글자마다의 원획 */
  strokes: number[];
  /** 획수 합 */
  total: number;
  hangul: string;
}

/**
 * 성을 읽는다.
 *
 * 한자로 주면 그대로 쓴다. 한글로 주면 성씨 표에서 찾는데, 「유」처럼 집안이
 * 여럿인 소리는 **고르지 않고 null 을 돌려준다.** 아무거나 집으면 남의 성이
 * 된다. 그럴 때는 `surnamesByReading()` 으로 물어 보고 손님이 고르게 한다.
 */
export function readSurname(input: string): SurnameRead | null {
  const raw = input.trim();
  if (!raw) return null;

  // 한자로 준 경우
  const known = surnameOf(raw);
  const chars = known ? [...known.char] : null;
  if (chars) return build(chars, known!.hangul);

  // 한글로 준 경우 — 집안이 하나일 때만 정한다
  const found = surnamesByReading(raw);
  if (found.length !== 1) return null;
  return build([...found[0]!.char], found[0]!.hangul);

  function build(cs: string[], hangul: string): SurnameRead | null {
    const strokes: number[] = [];
    for (const c of cs) {
      const h = hanja(c);
      if (!h) return null;
      strokes.push(h.strokes);
    }
    return { chars: cs, strokes, total: strokes.reduce((a, b) => a + b, 0), hangul };
  }
}

/** 이름 자리 하나에 넣을 수 있는 글자 */
export interface Slot {
  strokes: number;
  chars: Hanja[];
}

/** 획수 짝 하나와, 그 자리에 넣을 수 있는 글자들 */
export interface StrokePair {
  /** 이름 첫 글자의 획수 */
  first: number;
  /** 이름 끝 글자의 획수 */
  last: number;
  frames: FrameRead;
  firstChars: Hanja[];
  lastChars: Hanja[];
}

export interface NameWish {
  /** 성. 한글이면 「김」, 한자면 「金」 */
  surname: string;
  /** 사주가 필요로 하는 기운. 이 오행의 글자를 앞세운다 */
  elements?: Element[];
  /** 돌림자. 이 글자를 반드시 넣는다 */
  fixed?: { char: string; at: '앞' | '뒤' };
  /** 피할 글자 */
  avoid?: string[];
  /** 획수 짝을 몇 개까지 볼 것인가 */
  pairLimit?: number;
  /** 한 자리에 글자를 몇 개까지 낼 것인가 */
  charLimit?: number;
}

/** 이름 자리에 쓸 수 있는 최대 획수. 이보다 크면 이름으로 쓰기 무겁다 */
const MAX_STROKE = 25;


/**
 * 글자를 이름감으로 얼마나 앞세울지.
 *
 * 큰 수가 앞이다. 뜻이 좋은 것 > 오행이 맞는 것 > 기초한자 순인데,
 * 획수가 적은 쪽을 아주 살짝 앞세운다 — 쓰기 쉬운 글자가 이름에 낫다.
 *
 * 뜻이 나쁜 글자는 여기서 거르지 않고 아예 밭에 들이지 않는다.
 */
function score(h: Hanja, want: Element[]): number {
  let n = 0;
  if (meaningGood(h.meaning)) n += 200;
  /*
   * 학교에서 가르치는 글자라는 것이 오행보다 무겁다.
   *
   * 汪(넓을 왕)은 물 기운이고 뜻도 「넓다」라 점수만 보면 좋은 글자다. 그런데
   * 이 글자로 이름을 지으면 아이가 평생 「그거 무슨 자예요」를 듣는다.
   * 오행은 몇 점 차이지만 읽히느냐 아니냐는 평생 간다.
   */
  if (hanjaCommon(h.char)) n += 150;
  if (want.length && h.element && want.includes(h.element)) n += 100;
  if (h.element) n += 5;
  return n - h.strokes * 0.1;
}

/**
 * 획수 → 그 획수의 인명용 글자.
 *
 * 한 번만 만들어 둔다. 이름 하나 짓는 데 획수를 마흔 번 넘게 뒤지므로,
 * 그때마다 팔천 자를 훑으면 화면이 멎는다.
 */
const BY_STROKE = new Map<number, Hanja[]>();
{
  const raw: Record<string, { c: string; x: string }> = JSON.parse(
    readFileSync(new URL('../data/ilmyeong.json', import.meta.url), 'utf8'),
  );
  const seen = new Set<string>();
  for (const g of Object.values(raw)) {
    for (const c of g.c + g.x) {
      if (seen.has(c)) continue;
      seen.add(c);
      const h = hanja(c);
      if (!h) continue;
      // 뜻이 나쁜 글자는 아예 밭에 들이지 않는다. 획수가 맞아도 이름이 아니다
      if (meaningBad(h.meaning)) continue;
      const list = BY_STROKE.get(h.strokes);
      if (list) list.push(h);
      else BY_STROKE.set(h.strokes, [h]);
    }
  }
}

/** 그 획수로 이름에 쓸 수 있는 글자들. 앞세울 것부터 */
export function charsByStroke(
  strokes: number, want: Element[] = [], limit = 24, avoid: string[] = [],
): Hanja[] {
  const pool = BY_STROKE.get(strokes) ?? [];
  return pool
    .filter((h) => !avoid.includes(h.char))
    .sort((a, b) => score(b, want) - score(a, want) || a.char.localeCompare(b.char))
    .slice(0, limit);
}

/**
 * 네 격이 다 길한 획수 짝을 찾는다.
 *
 * 두 자 이름만 본다. 한 자 이름은 가성수를 넣어야 해서 유파가 갈리고,
 * 요즘 짓는 이름은 거의 두 자다.
 */
export function goodPairs(sur: SurnameRead, limit = 40): { first: number; last: number; frames: FrameRead }[] {
  const out: { first: number; last: number; frames: FrameRead }[] = [];
  for (let a = 1; a <= MAX_STROKE; a++) {
    for (let b = 1; b <= MAX_STROKE; b++) {
      const frames = readFrames(sur.strokes, [a, b]);
      if (!frames.allGood) continue;
      if (!frames.yinYangMixed) continue; // 다 홀수거나 다 짝수면 치우친 것으로 본다
      out.push({ first: a, last: b, frames });
    }
  }
  /*
   * 어느 짝을 앞세울 것인가.
   *
   * 획수만 적은 순으로 세우면 三·川·山 같은 두세 획 글자가 앞으로 나와
   * 「김산」「김천」 같은 이름이 먼저 뜬다. 못 쓸 이름은 아니지만 요즘 짓는
   * 이름이 아니다. 실제로 쓰는 이름은 글자마다 예닐곱 획에서 열두어 획
   * 사이라, 그 언저리를 앞세운다.
   */
  const ideal = (n: number) => Math.abs(n - 9);
  return out
    .filter((p) => p.first >= 3 && p.last >= 3)
    .sort((x, y) =>
      (ideal(x.first) + ideal(x.last)) - (ideal(y.first) + ideal(y.last))
      || (x.first + x.last) - (y.first + y.last))
    .slice(0, limit);
}

export interface NameField {
  성: { 한글: string; 한자: string; 획수: number[] };
  /** 돌림자를 넣었으면 그 글자 */
  돌림자: string | null;
  /** 사주가 필요로 하는 기운 */
  필요한기운: Element[];
  /** 획수 짝마다 쓸 수 있는 글자들 */
  후보: StrokePair[];
  눈금: string;
}

/**
 * 글을 쓰는 쪽에 넘길 밭을 만든다.
 *
 * 여기서 이름을 정하지 않는다. **정할 수 있는 것을 다 펼쳐 놓는다.**
 */
export function nameField(wish: NameWish): NameField {
  const sur = readSurname(wish.surname);
  if (!sur) throw new Error(`성 「${wish.surname}」을 알 수 없습니다. 한자로 적어 주세요.`);

  const want = wish.elements ?? [];
  // 성으로 쓰는 글자는 이름 자리에서 뺀다
  const avoid = [...(wish.avoid ?? []), ...sur.chars];
  const charLimit = wish.charLimit ?? 20;
  const fixedH = wish.fixed ? hanja(wish.fixed.char) : null;
  if (wish.fixed && (!fixedH || !hanjaLegal(wish.fixed.char))) {
    throw new Error(`「${wish.fixed.char}」는 출생신고가 되지 않는 글자입니다.`);
  }

  let pairs = goodPairs(sur, wish.pairLimit ?? 40);
  // 돌림자가 있으면 그 자리의 획수는 이미 정해졌다
  if (fixedH && wish.fixed) {
    const at = wish.fixed.at;
    pairs = pairs.filter((p) => (at === '앞' ? p.first : p.last) === fixedH.strokes);
  }

  const 후보: StrokePair[] = pairs.map((p) => ({
    first: p.first,
    last: p.last,
    frames: p.frames,
    firstChars: fixedH && wish.fixed?.at === '앞'
      ? [fixedH]
      : charsByStroke(p.first, want, charLimit, avoid),
    lastChars: fixedH && wish.fixed?.at === '뒤'
      ? [fixedH]
      : charsByStroke(p.last, want, charLimit, avoid),
  })).filter((p) => p.firstChars.length && p.lastChars.length);

  return {
    성: { 한글: sur.hangul, 한자: sur.chars.join(''), 획수: sur.strokes },
    돌림자: wish.fixed?.char ?? null,
    필요한기운: want,
    후보,
    눈금: [
      '네 격이 다 길하고 음양이 섞인 획수 짝만 골랐다.',
      '글자는 모두 인명용이라 출생신고가 된다.',
      '뜻이 나쁜 글자와 성씨로 쓰는 글자는 미리 뺐다.',
      '앞 글자와 끝 글자에 같은 글자를 쓰지 않는다.',
    ].join(' '),
  };
}
