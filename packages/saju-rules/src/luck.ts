/**
 * 대운(大運)·세운(歲運)·일진(日辰) — 시기별 흐름.
 *
 * 명식이 "타고난 구조"라면 대운은 그 구조가 놓이는 10년 단위의 배경이고,
 * 세운은 한 해, 일진은 하루다. 같은 명식이라도 어떤 대운을 지나느냐에 따라
 * 같은 글자가 도움이 되기도 하고 부담이 되기도 한다.
 *
 * 이 부분이 있어야 "올해는 어떤가"에 답할 수 있고, 매일 바뀌는 화면을 만들 수 있다.
 */

import type { Myeongsik } from '../../manseryeok/src/index.ts';
import { makePillar, yearPillar, dayPillar, toJulianDay, STEMS, BRANCHES } from '../../manseryeok/src/index.ts';
import type { Pillar } from '../../manseryeok/src/ganzhi.ts';
import { HIDDEN_STEMS, BRANCH_CLASHES, BRANCH_SIX_COMBOS, STEM_COMBINATIONS, STEM_CLASHES } from './tables.ts';
import { tenGodOf, GOD_GROUP, type TenGod, type GodGroup } from './tenGods.ts';
import type { YongsinResult } from './strength.ts';
import { josa } from '../../korean/src/index.ts';

export type Gender = '남' | '여';

/** 용신 대비 이 기운이 유리한지. */
export type Favor = '유리' | '불리' | '중립';

export interface LuckPillar {
  pillar: Pillar;
  stemGod: TenGod;
  branchGod: TenGod;
  favor: Favor;
  /** 명식과 부딪치거나 묶이는 지점 */
  interactions: string[];
}

export interface DaeunPeriod extends LuckPillar {
  /** 몇 번째 대운인지 (1부터) */
  index: number;
  /** 이 대운이 시작되는 만 나이 */
  startAge: number;
  endAge: number;
  startYear: number;
  endYear: number;
}

export interface DaeunResult {
  direction: '순행' | '역행';
  directionReason: string;
  /** 대운이 바뀌는 나이 (대운수) */
  startAge: number;
  /** 반올림 전 값 — 유파에 따라 버림·반올림이 갈린다 */
  startAgeExact: number;
  basis: string;
  periods: DaeunPeriod[];
}

export interface YearLuck extends LuckPillar {
  year: number;
  age: number;
}

export interface DayLuck extends LuckPillar {
  date: string;
}

function favorOf(group: GodGroup, yongsin: YongsinResult): Favor {
  if (yongsin.primary.includes(group)) return '유리';
  if (yongsin.avoid.includes(group)) return '불리';
  return '중립';
}

/** 운의 간지가 명식의 여덟 글자와 부딪치거나 묶이는 지점을 찾는다. */
function interactionsWith(ms: Myeongsik, pillar: Pillar): string[] {
  const notes: string[] = [];
  const slots: [string, Pillar | null][] = [
    ['연주', ms.year], ['월주', ms.month], ['일주', ms.day], ['시주', ms.hour],
  ];

  for (const [name, p] of slots) {
    if (!p) continue;

    if (BRANCH_CLASHES.some((c) =>
      (c[0] === p.branch && c[1] === pillar.branch) || (c[1] === p.branch && c[0] === pillar.branch))) {
      notes.push(`${name} ${josa(p.branch, '과')} 충 — ${clashMeaning(name)}`);
    }
    const six = BRANCH_SIX_COMBOS.find((c) =>
      (c.pair[0] === p.branch && c.pair[1] === pillar.branch) || (c.pair[1] === p.branch && c.pair[0] === pillar.branch));
    if (six) notes.push(`${name} ${josa(p.branch, '과')} ${six.name}`);

    if (STEM_CLASHES.some((c) =>
      (c[0] === p.stem && c[1] === pillar.stem) || (c[1] === p.stem && c[0] === pillar.stem))) {
      notes.push(`${name} 천간 ${josa(p.stem, '과')} 충`);
    }
    const combo = STEM_COMBINATIONS.find((c) =>
      (c.pair[0] === p.stem && c.pair[1] === pillar.stem) || (c.pair[1] === p.stem && c.pair[0] === pillar.stem));
    if (combo) notes.push(`${name} 천간 ${josa(p.stem, '과')} ${combo.name}`);
  }
  return notes;
}

function clashMeaning(position: string): string {
  switch (position) {
    case '연주': return '뿌리와 초년의 터전이 흔들리는 자리로 본다.';
    case '월주': return '직업과 사회적 자리가 흔들리는 자리로 본다.';
    case '일주': return '자신과 배우자 자리가 직접 흔들린다고 본다. 가장 크게 본다.';
    default: return '자식·말년·결과의 자리가 흔들린다고 본다.';
  }
}

function toLuckPillar(ms: Myeongsik, pillar: Pillar, yongsin: YongsinResult): LuckPillar {
  const dayStem = ms.day.stem;
  const branchMain = HIDDEN_STEMS[pillar.branch].at(-1)!.stem;
  const stemGod = tenGodOf(dayStem, pillar.stem);
  const branchGod = tenGodOf(dayStem, branchMain);

  // 천간과 지지의 유불리가 갈릴 수 있어 둘 다 보고 판단한다
  const f1 = favorOf(GOD_GROUP[stemGod], yongsin);
  const f2 = favorOf(GOD_GROUP[branchGod], yongsin);
  const favor: Favor = f1 === f2 ? f1 : f1 === '중립' ? f2 : f2 === '중립' ? f1 : '중립';

  return { pillar, stemGod, branchGod, favor, interactions: interactionsWith(ms, pillar) };
}

/**
 * 대운을 계산한다.
 *
 * 방향은 **양남음녀 순행, 음남양녀 역행**. 연간의 음양과 성별로 정해진다.
 * 대운수는 순행이면 다음 절까지, 역행이면 이전 절부터의 시간을 3일=1년으로 환산한다.
 */
export function calculateDaeun(
  ms: Myeongsik,
  gender: Gender,
  yongsin: YongsinResult,
  count = 10,
): DaeunResult {
  const yearStemIsYang = ms.year.stemIndex % 2 === 0;
  const isMale = gender === '남';
  const forward = yearStemIsYang === isMale;

  const directionReason =
    `연간 ${ms.year.stem}은 ${yearStemIsYang ? '양' : '음'}간, 성별은 ${gender}. ` +
    `${yearStemIsYang ? '양' : '음'}${isMale ? '남' : '녀'}이므로 ${forward ? '순행' : '역행'}한다.`;

  const minutes = forward ? ms.meta.minutesToNextTerm : ms.meta.minutesFromMonthTerm;
  const days = minutes / 1440;
  const startAgeExact = days / 3; // 3일 = 1년
  const startAge = Math.max(1, Math.round(startAgeExact));

  const basis =
    forward
      ? `출생부터 다음 절(${ms.meta.nextTermName}, ${ms.meta.nextTermEnteredAt})까지 ${days.toFixed(2)}일. 3일을 1년으로 환산해 ${startAgeExact.toFixed(2)}년 → 대운수 ${startAge}.`
      : `직전 절(${ms.meta.monthTermName}, ${ms.meta.monthTermEnteredAt})부터 출생까지 ${days.toFixed(2)}일. 3일을 1년으로 환산해 ${startAgeExact.toFixed(2)}년 → 대운수 ${startAge}.`;

  const periods: DaeunPeriod[] = [];
  for (let i = 1; i <= count; i++) {
    const offset = forward ? i : -i;
    const sex = ((ms.month.sexagenary + offset) % 60 + 60) % 60;
    const pillar = makePillar(sex % 10, sex % 12);
    const s = startAge + (i - 1) * 10;

    periods.push({
      index: i,
      startAge: s,
      endAge: s + 9,
      startYear: ms.meta.solarYear + s,
      endYear: ms.meta.solarYear + s + 9,
      ...toLuckPillar(ms, pillar, yongsin),
    });
  }

  return { direction: forward ? '순행' : '역행', directionReason, startAge, startAgeExact, basis, periods };
}

/** 지금 지나고 있는 대운. 아직 첫 대운 전이면 null. */
export function currentDaeun(daeun: DaeunResult, age: number): DaeunPeriod | null {
  return daeun.periods.find((p) => age >= p.startAge && age <= p.endAge) ?? null;
}

/** 세운 — 해마다의 흐름. 연주는 입춘을 기준으로 바뀐다. */
export function annualLuck(
  ms: Myeongsik,
  yongsin: YongsinResult,
  fromYear: number,
  count = 10,
): YearLuck[] {
  const out: YearLuck[] = [];
  for (let i = 0; i < count; i++) {
    const year = fromYear + i;
    out.push({
      year,
      age: year - ms.meta.solarYear,
      ...toLuckPillar(ms, yearPillar(year), yongsin),
    });
  }
  return out;
}

/**
 * 일진 — 그날의 기운.
 *
 * 매일 바뀌므로 재방문 이유를 만드는 데 쓴다.
 * 명식은 그대로인데 일진만 바뀌므로, 오늘 하루의 관계만 새로 계산하면 된다.
 */
export function dailyLuck(ms: Myeongsik, yongsin: YongsinResult, dateISO: string): DayLuck {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateISO);
  if (!m) throw new Error(`날짜 형식이 올바르지 않습니다: ${dateISO}`);
  const jdn = toJulianDay(+m[1], +m[2], +m[3]) + 0.5;
  return { date: dateISO, ...toLuckPillar(ms, dayPillar(jdn), yongsin) };
}

/** 앞으로 며칠간의 일진. 달력 형태로 보여줄 때 쓴다. */
export function dailyLuckRange(
  ms: Myeongsik, yongsin: YongsinResult, fromISO: string, days = 7,
): DayLuck[] {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(fromISO);
  if (!m) throw new Error(`날짜 형식이 올바르지 않습니다: ${fromISO}`);
  const base = Date.UTC(+m[1], +m[2] - 1, +m[3]);
  const out: DayLuck[] = [];
  for (let i = 0; i < days; i++) {
    const d = new Date(base + i * 86400000);
    const iso = d.toISOString().slice(0, 10);
    out.push(dailyLuck(ms, yongsin, iso));
  }
  return out;
}
