/**
 * 택일 — 수술로 낳는 날을 고른다.
 *
 * 역술가는 날짜 셋을 적어 주고 끝낸다. 그런데 그 셋이 병원 수술 일정과 안 맞으면
 * 손님은 그냥 못 쓴다. **그래서 여기서는 손님이 의사한테 받은 후보 날짜와 수술이
 * 가능한 시간대를 먼저 받고, 그 안에서만 점수를 매긴다.** 전화 상담으로는 못 하는
 * 일이고, 이것이 우리가 파는 것이다.
 *
 * ## 몸이 먼저다
 *
 * 이 계산은 **의사가 이미 된다고 한 날들 중에서 고르는 것**이다. 여기서 좋다고
 * 나온 날이 의학적으로 되는 날이라는 뜻이 아니다. 화면에도 그렇게 적는다.
 *
 * ## 점수는 눈금이지 성적표가 아니다
 *
 * 여덟 글자 중 연주와 월주는 이미 정해져 있다. 우리가 고를 수 있는 것은 일주와
 * 시주 둘뿐이라 100점은 구조적으로 나오지 않는다. 그래서 이 점수는 **같은 기간
 * 안에서 서로 견주는 눈금**이다. `BANDS` 가 그 눈금을 사람 말로 옮긴다.
 */

import { calculate } from '../../manseryeok/src/index.ts';
import { analyze } from './index.ts';
import { plainElement } from './reading.ts';

/** 널리 인정되는 길신. 붙으면 점수를 올린다 */
export const GOOD_SINSAL = [
  '천을귀인', '문창귀인', '천덕귀인', '월덕귀인', '금여', '암록', '태극귀인',
] as const;

export interface PickOptions {
  /** 의사가 된다고 한 날들. 이것 말고는 보지 않는다 */
  dates: string[];
  /** 수술이 가능한 시각들. 「08:00」 꼴 */
  times: string[];
  /** 태어날 곳의 경도. 진태양시로 시주를 세우는 데 쓴다 */
  longitude?: number;
}

export interface PickParts {
  /** 힘이 한쪽으로 안 쏠렸는가 (0~100) */
  balance: number;
  /** 다섯 기운이 고른가 (0~100) */
  even: number;
  /** 아예 없는 기운 하나마다 깎은 점 */
  missing: number;
  /** 부딪히는 자리 하나마다 깎은 점 */
  chung: number;
  /** 길신으로 더한 점 */
  gwi: number;
}

export interface PickScore {
  date: string;
  time: string;
  /** 그날 그 시각에 태어나면 갖게 될 여덟 글자 */
  eight: string;
  total: number;
  band: string;
  parts: PickParts;
  verdict: string;
  /** 일간을 돕는 힘 (%) */
  ratio: number;
  /** 제일 많은 기운과 제일 적은 기운의 차 */
  spread: number;
  missingElements: string[];
  chungCount: number;
  gwiNames: string[];
  /** 왜 이 점수인지 사람 말로 */
  says: string[];
}

/**
 * 점수를 사람 말로.
 *
 * 눈금은 2026~2030년 낮 8시~17시를 통째로 훑어(18,250칸) 잡았다.
 * 그때 나온 분포는 이렇다 — 최고 82.7, 한가운데 45.7, 최저 -19.9.
 *
 *   70점 이상  상위 2.5%
 *   62점 이상  상위 12%
 *   52점 이상  상위 34%
 *   38점 이상  상위 69%
 *
 * **100점은 나오지 않는다.** 여덟 글자 중 연주와 월주가 이미 정해져 있어서
 * 우리가 고를 수 있는 것은 절반뿐이다. 그것을 모르고 보면 70점이 낮아 보인다.
 */
export const BANDS: { at: number; say: string }[] = [
  { at: 70, say: '아주 좋음' },
  { at: 62, say: '좋음' },
  { at: 52, say: '무난함' },
  { at: 38, say: '아쉬움' },
  { at: -999, say: '피하는 게 낫다' },
];

export function bandOf(total: number): string {
  return BANDS.find((b) => total >= b.at)!.say;
}

/** 한 날 한 시각을 잰다 */
export function pickScore(date: string, time: string, longitude = 126.978): PickScore {
  const ms = calculate({ date, time, longitude });
  const an = analyze(ms);

  const weights = an.elements.map((e) => e.weight);
  const spread = Math.max(...weights) - Math.min(...weights);
  const ratio = an.strength.supportRatio;
  const gwiNames = [...new Set(
    an.sinsal.filter((s) => (GOOD_SINSAL as readonly string[]).includes(s.name)).map((s) => s.name),
  )];
  const chungCount = an.relations.filter((r) => r.kind.includes('충')).length;

  const parts: PickParts = {
    balance: Math.max(0, 100 - Math.abs(ratio - 50) * 2),
    even: Math.max(0, 100 - spread * 1.2),
    missing: an.missingElements.length * 15,
    chung: chungCount * 8,
    gwi: Math.min(gwiNames.length * 6, 18),
  };
  const total = 0.45 * parts.balance + 0.35 * parts.even
    - parts.missing - parts.chung + parts.gwi;

  const p = (x: { stem: string; branch: string } | null) => (x ? x.stem + x.branch : '—');
  const says: string[] = [];
  says.push(an.strength.verdict === '중화'
    ? `힘이 ${Math.round(ratio)}%로 가운데에 있다. 세지도 약하지도 않다.`
    : `${an.strength.verdict}이다. 일간을 돕는 힘이 ${Math.round(ratio)}%.`);
  says.push(spread <= 20
    ? '다섯 기운이 고르게 퍼져 있다.'
    : `${plainElement(an.elements.reduce((a, b) => (a.weight > b.weight ? a : b)).element)}으로 치우쳐 있다.`);
  if (an.missingElements.length) {
    says.push(`${an.missingElements.map(plainElement).join(', ')}이 아예 없다.`);
  }
  says.push(chungCount === 0 ? '부딪히는 자리가 없다.' : `부딪히는 자리가 ${chungCount}군데 있다.`);
  if (gwiNames.length) says.push(`${gwiNames.join(', ')}이 붙는다.`);

  return {
    date, time,
    eight: `${p(ms.year)} ${p(ms.month)} ${p(ms.day)} ${p(ms.hour)}`,
    total: Math.round(total * 10) / 10,
    band: bandOf(total),
    parts,
    verdict: an.strength.verdict,
    ratio: Math.round(ratio),
    spread: Math.round(spread),
    missingElements: [...an.missingElements],
    chungCount,
    gwiNames,
    says,
  };
}

/**
 * 받은 날과 시각을 전부 재서 좋은 순으로 돌려준다.
 *
 * 같은 날 안에서 시각만 달라도 시주가 바뀌어 점수가 크게 갈린다. 그래서 날만
 * 고르는 것이 아니라 **날과 시각을 함께** 고른다.
 */
export function pickDays(opts: PickOptions): PickScore[] {
  if (!opts.dates.length) throw new Error('볼 날이 없습니다.');
  if (!opts.times.length) throw new Error('수술이 가능한 시각이 없습니다.');
  const out: PickScore[] = [];
  for (const date of opts.dates) {
    for (const time of opts.times) out.push(pickScore(date, time, opts.longitude));
  }
  return out.sort((a, b) => b.total - a.total);
}

/** 날마다 그날의 제일 좋은 시각 하나씩 */
export function bestPerDay(scores: PickScore[]): PickScore[] {
  const best = new Map<string, PickScore>();
  for (const s of scores) {
    const had = best.get(s.date);
    if (!had || s.total > had.total) best.set(s.date, s);
  }
  return [...best.values()].sort((a, b) => a.date.localeCompare(b.date));
}
