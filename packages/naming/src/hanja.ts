/**
 * 한자 낱글자 표.
 *
 * ## 원획을 어떻게 세는가
 *
 * 성명학은 **원획법**으로 센다 — 부수를 쓰인 모양이 아니라 **본래 글자**의
 * 획수로 세는 방법이다. 물 부수 氵는 눈에 보이기로는 세 획이지만 水 네 획으로
 * 세고, 마음 부수 忄도 心 네 획으로 센다. 옥편에 적힌 획수와 다르다.
 *
 * 이것을 글자마다 손으로 적어 두면 팔천 자를 옮겨 적다가 어딘가 틀린다.
 * 그래서 **부수 번호에서 계산한다.**
 *
 *     원획 = 그 부수의 강희자전 획수 + 나머지 획수
 *
 * 부수 번호는 유니코드 한자 데이터(Unihan)가 글자마다 갖고 있고, 214 부수의
 * 획수는 고정된 표다. 氵든 水든 부수 번호는 똑같이 85 이므로 변형자 문제가
 * 애초에 생기지 않는다.
 *
 * 맞는지는 남이 낸 감명서로 확인했다. 청월당이 공개한 「김리아 金漓妸」에서
 * 金 8, 漓 15, 妸 8 이고, 이 표도 같은 값을 낸다.
 *
 * ## 자원오행
 *
 * 부수의 뜻에서 오행을 본다. 이것은 유파가 갈리는 자리라, **뜻이 분명한
 * 부수에만** 붙였다. 나머지는 빈 값으로 두고 화면에서도 「갈린다」고 적는다.
 * 없는 것을 있는 척하지 않는다.
 *
 * ## 인명용 한자
 *
 * 대법원이 정한 목록 안에 없는 글자는 출생신고가 되지 않는다. 그 목록을
 * 54쪽짜리 관보에서 한 쪽씩 눈으로 읽어 옮겨 적었고(`data/ilmyeong.json`),
 * 옮긴 글자는 모두 유니코드 한국 독음과 맞대어 보아 어긋나면 버렸다.
 * 빠뜨린 글자는 이름 후보가 몇 개 줄 뿐이지만, 없는 글자를 넣으면 신고가
 * 반려된다. 그래서 의심스러운 것은 늘 버리는 쪽으로 했다.
 *
 * `hanjaLegal()` 이 참인 글자만 이름으로 판다.
 */

import { readFileSync } from 'node:fs';

interface Raw { r: number; s: number; k: string[]; e: string; d: string }

const RAW: Record<string, Raw> = JSON.parse(
  readFileSync(new URL('../data/hanja.json', import.meta.url), 'utf8'),
);

export type Element = '목' | '화' | '토' | '금' | '수';

export interface Hanja {
  /** 한자 한 글자 */
  char: string;
  /** 부수 번호 (1~214) */
  radical: number;
  /** 원획. 부수를 본래 글자의 획수로 세었다 */
  strokes: number;
  /** 한글 독음. 두 가지로 읽는 글자가 있다 (金 = 금·김) */
  readings: string[];
  /** 자원오행. 유파가 갈리지 않는 부수에만 붙는다. 없으면 null */
  element: Element | null;
  /** 뜻 (영문). 없으면 빈 문자열 */
  meaning: string;
}

function toHanja(char: string, r: Raw): Hanja {
  return {
    char, radical: r.r, strokes: r.s, readings: r.k,
    element: (r.e || null) as Element | null, meaning: r.d,
  };
}

/** 글자 하나를 찾는다. 표에 없으면 null */
export function hanja(char: string): Hanja | null {
  const r = RAW[char];
  return r ? toHanja(char, r) : null;
}

/** 표에 든 글자 수 */
export function hanjaCount(): number {
  return Object.keys(RAW).length;
}

const BY_READING = new Map<string, string[]>();
for (const [char, r] of Object.entries(RAW)) {
  for (const k of r.k) {
    const list = BY_READING.get(k);
    if (list) list.push(char);
    else BY_READING.set(k, [char]);
  }
}

export interface HanjaFilter {
  /** 원획이 이 수인 것만 */
  strokes?: number;
  /** 자원오행이 이 중 하나인 것만 */
  elements?: Element[];
  /** 참이면 그 독음으로 출생신고가 되는 글자만 (이름을 지을 때는 늘 참) */
  legal?: boolean;
}

/**
 * 독음으로 찾는다. 「도」로 찾으면 도로 읽는 한자가 다 나온다.
 *
 * 획수와 자원오행으로 좁힐 수 있다. 작명은 「도 자리에 몇 획짜리 물(水)
 * 글자가 무엇이 있는가」를 묻는 일이라 이 두 가지로 거의 다 좁혀진다.
 */
export function byReading(reading: string, filter: HanjaFilter = {}): Hanja[] {
  const chars = BY_READING.get(reading.trim()) ?? [];
  const out: Hanja[] = [];
  const want = reading.trim();
  for (const c of chars) {
    const r = RAW[c]!;
    if (filter.strokes !== undefined && r.s !== filter.strokes) continue;
    if (filter.elements?.length && !filter.elements.includes(r.e as Element)) continue;
    if (filter.legal && !hanjaLegalReading(c, want)) continue;
    out.push(toHanja(c, r));
  }
  // 획수 → 글자 순. 같은 값이면 늘 같은 차례로 나와야 한다
  return out.sort((a, b) => a.strokes - b.strokes || a.char.localeCompare(b.char));
}

/** 그 독음으로 읽는 한자가 있는가 */
export function hasReading(reading: string): boolean {
  return BY_READING.has(reading.trim());
}

/**
 * 인명용 한자표.
 *
 * 독음마다 두 묶음이다. `c` 는 한문 교육용 기초한자 1,800자 — 학교에서
 * 가르치는 글자다. `x` 는 인명용으로만 더 열어 준 나머지.
 *
 * 이름은 남이 읽을 수 있어야 한다. 뜻이 아무리 좋아도 아무도 모르는 글자면
 * 평생 「그거 무슨 자예요」를 듣는다. 그래서 둘을 갈라 두고, 이름을 지을 때는
 * 기초한자를 먼저 쓴다.
 */
const ILMYEONG: Record<string, { c: string; x: string }> = JSON.parse(
  readFileSync(new URL('../data/ilmyeong.json', import.meta.url), 'utf8'),
);

/** 인명용 글자 전부 */
const LEGAL = new Set<string>();
/** 그중 기초한자. 이름에 먼저 쓴다 */
const COMMON = new Set<string>();
/** 그 글자를 그 독음으로 쓸 수 있는가 — 「독음+글자」로 담는다 */
const LEGAL_READ = new Set<string>();
for (const [reading, group] of Object.entries(ILMYEONG)) {
  for (const c of group.c) { LEGAL.add(c); COMMON.add(c); LEGAL_READ.add(reading + c); }
  for (const c of group.x) { LEGAL.add(c); LEGAL_READ.add(reading + c); }
}

/** 학교에서 가르치는 기초한자인가. 이름을 지을 때 이쪽을 먼저 쓴다 */
export function hanjaCommon(char: string): boolean {
  return COMMON.has(char);
}

/**
 * 출생신고가 되는 글자인가.
 *
 * 대법원 인명용 한자표에 든 글자만 참이다.
 */
export function hanjaLegal(char: string): boolean {
  return LEGAL.has(char);
}

/**
 * 그 글자를 그 독음으로 신고할 수 있는가.
 *
 * 표는 「이 표에 적힌 발음으로만 쓸 수 있다」고 못박는다. 金 은 금·김 둘 다
 * 표에 있으니 둘 다 되지만, 표에 한쪽만 있는 글자는 다른 쪽으로 못 쓴다.
 *
 * 다만 첫소리가 ㄴ·ㄹ 인 글자는 소리 나는 대로 ㅇ·ㄴ 으로도 쓸 수 있다
 * (표의 주 1). 李 를 「리」로도 「이」로도 쓰는 것이 그것이다.
 */
export function hanjaLegalReading(char: string, reading: string): boolean {
  const r = reading.trim();
  if (LEGAL_READ.has(r + char)) return true;
  for (const alt of soundAlts(r)) if (LEGAL_READ.has(alt + char)) return true;
  return false;
}

/** 첫소리 ㄴ·ㄹ 을 되돌린 독음들. 「이」→「리·니」, 「나」→「라」 */
function soundAlts(reading: string): string[] {
  const code = reading.charCodeAt(0) - 0xac00;
  if (code < 0 || code >= 11172) return [];
  const lead = Math.floor(code / 588);
  const rest = code % 588;
  // 초성 차례: ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ
  const N = 2, R = 5, O = 11;
  const outs: number[] = [];
  if (lead === O) outs.push(N, R); // ㅇ ← ㄴ 이나 ㄹ 이었을 수 있다
  else if (lead === N) outs.push(R); // ㄴ ← ㄹ 이었을 수 있다
  return outs.map((l) => String.fromCharCode(0xac00 + l * 588 + rest) + reading.slice(1));
}

/** 인명용 목록에 든 글자 수 */
export function hanjaLegalCount(): number {
  return LEGAL.size;
}

/** 그중 기초한자 수 */
export function hanjaCommonCount(): number {
  return COMMON.size;
}
