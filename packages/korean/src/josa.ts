/**
 * 한국어 조사 처리.
 *
 * 이름을 문장에 끼워 넣을 때 받침 유무에 따라 조사가 달라진다.
 * "지영이 민수을 북돋운다" 같은 문장은 결과의 신뢰를 그대로 깎아먹는다.
 */

/** 마지막 글자에 받침이 있는가. 한글이 아니면 false. */
export function hasFinalConsonant(word: string): boolean {
  const ch = word.trim().at(-1);
  if (!ch) return false;
  const code = ch.charCodeAt(0);
  if (code < 0xac00 || code > 0xd7a3) return false; // 한글 음절이 아님
  return (code - 0xac00) % 28 !== 0;
}

/** 받침에 맞는 조사를 붙인다. `josa('민수', '을')` → '민수를' */
export function josa(word: string, pair: '은' | '는' | '이' | '가' | '을' | '를' | '와' | '과' | '으로' | '로'): string {
  const withFinal = hasFinalConsonant(word);
  const table: Record<string, [string, string]> = {
    은: ['은', '는'], 는: ['은', '는'],
    이: ['이', '가'], 가: ['이', '가'],
    을: ['을', '를'], 를: ['을', '를'],
    와: ['과', '와'], 과: ['과', '와'],
    으로: ['으로', '로'], 로: ['으로', '로'],
  };
  const [yes, no] = table[pair];
  return word + (withFinal ? yes : no);
}
