import { calculate, type Myeongsik } from '../../manseryeok/src/index.ts';
import { groupElement, type Element, type YongsinResult } from './index.ts';

/*
 * 씨 문자열에서 **늘 같은** 바이트를 뽑는다.
 *
 * 전에는 `node:crypto` 의 sha256 을 썼다. 그런데 이 파일은 만세력 뷰어에도
 * 함께 묶이고, 뷰어는 **브라우저에서 도는 파일 하나**다. 브라우저에는
 * `node:crypto` 가 없어서 **도커 빌드가 거기서 멈췄고, 열 번이 넘는 배포가
 * 통째로 실패했다.** 사이트는 옛 버전 그대로 돌고 있었다.
 *
 * 여기 쓰이는 값은 **자물쇠가 아니라 주사위**다. 번호 여섯 개가 모자랄 때
 * 빈자리를 메우는 데만 쓴다. 그래서 암호 도구가 필요 없다. 서버에서든
 * 브라우저에서든 같은 답이 나오는 것, 그거 하나만 있으면 된다.
 */
function seedBytes(seed: string): number[] {
  // FNV-1a — 짧고, 어디서나 같은 값이 나온다
  let h = 0x811c9dc5;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  const out: number[] = [];
  for (let i = 0; i < 32; i++) {
    h ^= h << 13; h >>>= 0;
    h ^= h >>> 17;
    h ^= h << 5; h >>>= 0;
    out.push(h & 0xff);
  }
  return out;
}

export const ELEMENT_NUMBERS: Record<Element, [number, number]> = {
  수: [1, 6],
  화: [2, 7],
  목: [3, 8],
  금: [4, 9],
  토: [5, 10],
};

const ELEMENT_KO: Record<Element, { full: string; short: string }> = {
  수: { full: '물(水)', short: '물' },
  화: { full: '불(火)', short: '불' },
  목: { full: '나무(木)', short: '나무' },
  금: { full: '쇠(金)', short: '쇠' },
  토: { full: '흙(土)', short: '흙' },
};

export interface LuckyNumbersResult {
  numbers: [number, number, number, number, number, number];
  근거: string;
}

export function luckyNumbers(
  ms: Myeongsik,
  yongsin: YongsinResult,
  weekStartISO: string,
): LuckyNumbersResult {
  const dayEl = ms.day.element.stem as Element;
  const primeGroup = yongsin.primary[0] || '인성';
  const yongsinEl = groupElement(dayEl, primeGroup);
  const [s1, s2] = ELEMENT_NUMBERS[yongsinEl];

  const mon = calculate({ date: weekStartISO });
  const monStemEl = mon.day.element.stem as Element;
  const monBranchEl = mon.day.element.branch as Element;
  const [m1, m2] = ELEMENT_NUMBERS[monStemEl];
  const [m3, m4] = ELEMENT_NUMBERS[monBranchEl];

  const personKey = `${ms.year.stemHanja}${ms.year.branchHanja}${ms.month.stemHanja}${ms.month.branchHanja}${ms.day.stemHanja}${ms.day.branchHanja}${ms.hour ? ms.hour.stemHanja + ms.hour.branchHanja : 'nohour'}`;
  const seedStr = `${personKey}:${weekStartISO}:${yongsinEl}:${s1},${s2}:${m1},${m2},${m3},${m4}`;
  const hash = seedBytes(seedStr);

  const picked = new Set<number>();
  // 1) 이로운 기운의 두 숫자를 씨로 삼는다
  if (s1 >= 1 && s1 <= 45) picked.add(s1);
  if (s2 >= 1 && s2 <= 45) picked.add(s2);

  // 2) 그 주 월요일 일진에서 나오는 숫자를 섞는다
  const derived = [
    ((s1 + m1 - 1) % 45) + 1,
    ((s2 + m2 - 1) % 45) + 1,
    ((s1 * 2 + m3 - 1) % 45) + 1,
    ((s2 * 2 + m4 - 1) % 45) + 1,
    ((m1 + m3 - 1) % 45) + 1,
    ((m2 + m4 - 1) % 45) + 1,
  ];

  for (const n of derived) {
    if (picked.size < 6) picked.add(n);
  }

  // 3) 부족하면 해시 바이트로 채운다 (1~45, 결정론적)
  let byteIdx = 0;
  while (picked.size < 6) {
    const val = (hash[byteIdx % hash.length]! % 45) + 1;
    picked.add(val);
    byteIdx++;
  }

  const sorted = Array.from(picked).sort((a, b) => a - b);
  const six = sorted.slice(0, 6) as [number, number, number, number, number, number];

  const ELEMENT_PHRASES: Record<Element, { full: string; phrase: string }> = {
    수: { full: '물(水)', phrase: '물의 숫자 1과 6' },
    목: { full: '나무(木)', phrase: '나무의 숫자 3과 8' },
    화: { full: '불(火)', phrase: '불의 숫자 2와 7' },
    토: { full: '흙(土)', phrase: '흙의 숫자 5와 10' },
    금: { full: '쇠(金)', phrase: '쇠의 숫자 4와 9' },
  };

  const ep = ELEMENT_PHRASES[yongsinEl] || { full: `${yongsinEl}`, phrase: `${yongsinEl}의 숫자 ${s1}과 ${s2}` };
  const 근거 = `그대에게 이로운 기운은 ${ep.full}일세.\n${ep.phrase}에서 왔고, 이번 주 날의 기운을 더했네.`;

  return {
    numbers: six,
    근거,
  };
}
