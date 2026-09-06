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
 * ## 아직 없는 것
 *
 * **인명용 한자인지 여부.** 대법원이 정한 목록이 따로 있고, 그 안에 없는
 * 글자는 출생신고가 되지 않는다. 그 목록을 아직 넣지 못했으므로 이 표만으로
 * 이름을 지어 내보내면 안 된다. `hanjaLegal()` 이 참을 돌려줄 때에만 판다.
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
  for (const c of chars) {
    const r = RAW[c]!;
    if (filter.strokes !== undefined && r.s !== filter.strokes) continue;
    if (filter.elements?.length && !filter.elements.includes(r.e as Element)) continue;
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
 * 출생신고가 되는 글자인가.
 *
 * 대법원 인명용 한자 목록을 아직 넣지 못했다. 목록 없이 참을 돌려주면
 * 신고가 안 되는 이름을 팔게 되므로, **넣기 전까지는 늘 거짓이다.**
 * 이 함수가 참이 되기 전에는 이름을 지어 팔지 않는다.
 */
export function hanjaLegal(_char: string): boolean {
  return false;
}
