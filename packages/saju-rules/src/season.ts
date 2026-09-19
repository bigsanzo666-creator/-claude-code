/**
 * 때를 묻는 상품들이 실제로 쓰는 계산.
 *
 * ## 왜 따로 있는가
 *
 * 「결혼 시기」와 「노후·말년운」과 「우리 아이 사주」가 전부 여덟 글자를
 * 통째로 받아 가고 있었다. 재료가 같으니 나오는 글도 같았다 — 값만 달랐다.
 *
 * 상품이 묻는 것이 다르면 **재료도 달라야 한다.** 여기서 그 재료를 만든다.
 *
 * ## 판단은 전부 규칙이다
 *
 * 점수는 눈금일 뿐 절대값이 아니다. 같은 사람의 여러 시기를 **서로 견주는**
 * 데만 쓴다. 그리고 무엇을 보고 점수를 줬는지 항상 같이 낸다 —
 * 근거 없는 결론은 점집이 하는 짓이다.
 */

import type { Myeongsik } from '../../manseryeok/src/index.ts';
import {
  monthPillar, solveSolarLongitude, toJulianDay, fromJulianDay, MONTH_STARTS,
} from '../../manseryeok/src/index.ts';
import type { YongsinResult } from './strength.ts';
import type { Analysis } from './index.ts';
import {
  annualLuck, luckOf,
  type DaeunResult, type DaeunPeriod, type YearLuck, type Gender,
} from './luck.ts';
import { GOD_GROUP } from './tenGods.ts';

/* ────────────────────────────────────────────────────────────
 * 결혼 시기
 * ──────────────────────────────────────────────────────────── */

/**
 * 배우자 별(星).
 *
 * 전통적으로 남자는 재성, 여자는 관성을 배우자 자리로 본다.
 * **이건 우리가 정한 것이 아니라 명리가 오래 써 온 규칙**이고,
 * 화면에도 그렇게 밝힌다.
 */
function spouseGroup(gender: Gender): '재성' | '관성' {
  return gender === '남' ? '재성' : '관성';
}

export interface MarriageWindow {
  year: number;
  age: number;
  /** 서로 견주는 눈금. 절대값이 아니다 */
  score: number;
  /** 왜 이 점수인지 — 하나도 빼지 않고 적는다 */
  says: string[];
  favor: YearLuck['favor'];
  pillar: string;
}

/**
 * 한 해가 인연에 얼마나 열려 있는가.
 *
 * 보는 것은 넷뿐이고, 넷 다 명리에서 오래 써 온 자리다.
 *   1. 배우자 별이 그 해에 들어오는가 (남=재성, 여=관성)
 *   2. 그 해의 지지가 **배우자 자리(일지)** 와 묶이는가(합)
 *   3. 도화·홍염이 그 해에 닿는가
 *   4. 용신 기준으로 그 해가 유리한가
 *
 * 없는 것은 세지 않는다. 점수가 낮다고 「결혼 못 한다」로 쓰지 않는다 —
 * **다른 해보다 기운이 덜 몰린다**는 뜻이다.
 */
function scoreYear(y: YearLuck, spouse: '재성' | '관성', charmBranches: readonly string[]): MarriageWindow {
  const says: string[] = [];
  let score = 0;

  if (GOD_GROUP[y.stemGod] === spouse) {
    score += 3; says.push(`그 해 천간이 ${y.stemGod} — 배우자 자리(${spouse})가 들어옵니다`);
  }
  if (GOD_GROUP[y.branchGod] === spouse) {
    score += 3; says.push(`그 해 지지가 ${y.branchGod} — 배우자 자리(${spouse})가 들어옵니다`);
  }
  // 일지는 배우자 자리다. 거기에 묶이는 해가 인연이 붙는 해다
  for (const note of y.interactions) {
    if (note.startsWith('일주') && note.includes('합')) {
      score += 3; says.push(`배우자 자리(일지)와 묶입니다 — ${note}`);
    } else if (note.startsWith('일주') && note.includes('충')) {
      score += 1; says.push(`배우자 자리가 흔들립니다 — ${note}. 만남도 헤어짐도 이 자리에서 납니다`);
    } else if (note.includes('합')) {
      score += 1; says.push(`묶이는 자리가 있습니다 — ${note}`);
    }
  }
  if (charmBranches.includes(y.pillar.branch)) {
    score += 2; says.push(`도화·홍염이 닿는 해입니다 (${y.pillar.branch})`);
  }
  if (y.favor === '유리') { score += 2; says.push('채워야 할 기운이 들어오는 해입니다'); }
  else if (y.favor === '불리') { score -= 1; says.push('덜어내야 할 기운이 강한 해입니다'); }

  if (!says.length) says.push('이 해에는 인연 쪽으로 특별히 몰리는 기운이 없습니다');
  return {
    year: y.year, age: y.age, score, says, favor: y.favor,
    pillar: `${y.pillar.stem}${y.pillar.branch}`,
  };
}

export interface MarriageReading {
  /** 남=재성, 여=관성. 무엇을 배우자 자리로 보는지 밝힌다 */
  spouseStar: string;
  /** 일지 — 배우자가 앉는 자리 */
  spouseSeat: string;
  /** 나이대(대운)마다 어떤 결인지 */
  byDecade: {
    startAge: number; endAge: number; startYear: number; endYear: number;
    pillar: string; favor: string; says: string[];
  }[];
  /** 기운이 제일 세게 들어오는 두 해 */
  strongest: MarriageWindow[];
  /** 살펴본 모든 해 */
  years: MarriageWindow[];
  disclaimer: string;
}

/**
 * 결혼 시기.
 *
 * 나이대(대운)별로 결이 어떤지 보여 주고, 그 안에서 **제일 세게 들어오는
 * 두 해**를 집어 준다. 두 해를 집는 이유는 하나만 집으면 그 해가 지나면
 * 끝인 것처럼 읽히기 때문이다.
 */
export function marriageTiming(
  ms: Myeongsik, an: Analysis, daeun: DaeunResult, gender: Gender, fromYear: number, span = 20,
): MarriageReading {
  const spouse = spouseGroup(gender);
  const charm = an.sinsal
    .filter((s) => /도화|홍염/.test(s.name))
    .flatMap((s) => s.positions.map((p) => {
      const slot = { 연주: ms.year, 월주: ms.month, 일주: ms.day, 시주: ms.hour }[p];
      return slot?.branch ?? '';
    }))
    .filter(Boolean);

  const years = annualLuck(ms, an.yongsin, fromYear, span).map((y) => scoreYear(y, spouse, charm));
  const strongest = [...years].sort((a, b) => b.score - a.score || a.year - b.year).slice(0, 2)
    .sort((a, b) => a.year - b.year);

  const byDecade = daeun.periods
    .filter((d) => d.endYear >= fromYear && d.startAge < 60)
    .map((d) => {
      const says: string[] = [];
      if (GOD_GROUP[d.stemGod] === spouse || GOD_GROUP[d.branchGod] === spouse) {
        says.push(`이 십 년은 배우자 자리(${spouse})가 배경에 깔립니다`);
      }
      for (const note of d.interactions) {
        if (note.startsWith('일주')) says.push(`배우자 자리와 ${note.includes('합') ? '묶입니다' : '부딪힙니다'} — ${note}`);
      }
      const inside = years.filter((y) => y.year >= d.startYear && y.year <= d.endYear);
      const best = inside.sort((a, b) => b.score - a.score)[0];
      if (best && best.score > 0) says.push(`이 십 년 안에서는 ${best.year}년(${best.age}세)이 제일 몰립니다`);
      if (!says.length) says.push('이 십 년은 인연 쪽으로 두드러지는 것이 없습니다');
      return {
        startAge: d.startAge, endAge: d.endAge, startYear: d.startYear, endYear: d.endYear,
        pillar: `${d.pillar.stem}${d.pillar.branch}`, favor: d.favor, says,
      };
    });

  return {
    spouseStar: `${spouse} — ${gender === '남' ? '남자는 재성을' : '여자는 관성을'} 배우자 자리로 봅니다`,
    spouseSeat: `일지 ${ms.day.branch} — 배우자가 앉는 자리입니다`,
    byDecade, strongest, years,
    disclaimer: '점수는 이 분의 여러 해를 서로 견주는 눈금입니다. '
      + '낮다고 결혼을 못 한다는 뜻이 아니라 그 해에 기운이 덜 몰린다는 뜻입니다.',
  };
}

/* ────────────────────────────────────────────────────────────
 * 노후·말년운
 * ──────────────────────────────────────────────────────────── */

export interface LateLifeReading {
  /** 시주 — 말년의 자리 */
  lateSeat: string;
  /** 예순 이후의 대운만 */
  decades: {
    startAge: number; endAge: number; startYear: number; endYear: number;
    pillar: string; stemGod: string; branchGod: string; favor: string;
    interactions: string[]; says: string[];
  }[];
  disclaimer: string;
}

/**
 * 노후·말년운 — **예순 이후만** 본다.
 *
 * 스무 살 대운까지 같이 실으면 평생 사주가 되고, 그러면 사주 종합과 같은
 * 글이 나간다. 손님이 물은 것은 「내 노후는 어떨까」 하나다.
 *
 * 수명이나 병은 다루지 않는다. 그건 프롬프트에서도 막아 두었다.
 */
export function lateLife(ms: Myeongsik, an: Analysis, daeun: DaeunResult): LateLifeReading {
  /*
   * 예순부터 아흔아홉까지만. 대운은 백스무 살까지 계산되지만 그것을 글에
   * 싣는 것은 손님을 속이는 것에 가깝다 — 읽을 사람이 없는 구간이다.
   */
  const decades = daeun.periods
    .filter((d) => d.endAge >= 60 && d.startAge < 100)
    .map((d: DaeunPeriod) => {
    const says: string[] = [];
    says.push(`${d.startAge}세부터 ${d.endAge}세까지 — ${d.pillar.stem}${d.pillar.branch}`);
    says.push(`천간은 ${d.stemGod}, 지지는 ${d.branchGod}`);
    if (d.favor === '유리') says.push('채워야 할 기운이 들어오는 십 년입니다');
    else if (d.favor === '불리') says.push('덜어내야 할 기운이 강한 십 년입니다 — 무리하지 않는 쪽이 낫습니다');
    else says.push('크게 밀지도 막지도 않는 십 년입니다');
    for (const note of d.interactions) {
      if (note.startsWith('시주')) says.push(`말년의 자리(시주)와 걸립니다 — ${note}`);
      else says.push(`명식과 걸리는 것 — ${note}`);
    }
    return {
      startAge: d.startAge, endAge: d.endAge, startYear: d.startYear, endYear: d.endYear,
      pillar: `${d.pillar.stem}${d.pillar.branch}`,
      stemGod: d.stemGod, branchGod: d.branchGod, favor: d.favor,
      interactions: d.interactions, says,
    };
  });

  return {
    lateSeat: ms.hour
      ? `시주 ${ms.hour.stem}${ms.hour.branch} — 말년이 앉는 자리입니다`
      : '태어난 시각을 모르셔서 시주가 없습니다. 말년의 자리는 대운으로만 봅니다',
    decades,
    disclaimer: '수명이나 병은 보지 않습니다. 기운이 어느 쪽으로 도는지만 씁니다.',
  };
}

/* ────────────────────────────────────────────────────────────
 * 달마다 보는 흐름 — 아이 사주에 쓴다
 * ──────────────────────────────────────────────────────────── */

export interface MonthLuck {
  year: number;
  /** 절기로 끊은 달. 인월=1 … 축월=12 */
  ordinal: number;
  /** 그 달이 시작되는 날 (절입일) */
  from: string;
  termName: string;
  pillar: string;
  stemGod: string;
  branchGod: string;
  favor: string;
  interactions: string[];
}

/**
 * 달마다의 흐름.
 *
 * 한 해를 열두 달로 끊되 **달력 달이 아니라 절기로** 끊는다. 명리에서
 * 한 달은 입춘·경칩처럼 절(節)이 드는 날부터다. 달력으로 끊으면 월주가
 * 하루 이틀씩 어긋난다.
 *
 * 절입일은 표에서 찾지 않고 태양 위치로 계산한다 — 이 집이 절기를
 * 계산하는 방식 그대로다.
 */
export function monthlyLuck(ms: Myeongsik, yongsin: YongsinResult, year: number): MonthLuck[] {
  const yStemIndex = ((year - 4) % 10 + 10) % 10;
  const out: MonthLuck[] = [];
  for (let ordinal = 1; ordinal <= 12; ordinal++) {
    const term = MONTH_STARTS[ordinal - 1];
    /*
     * 인월(입춘)은 2월 초, 축월(소한)은 이듬해 1월 초다. 그래서 축월만
     * 다음 해에 든다 — 달력 해와 명리 해가 어긋나는 자리다.
     */
    const guessMonth = ((ordinal + 1) % 12) + 1;
    const guessYear = ordinal === 12 ? year + 1 : year;
    const jd = solveSolarLongitude(term.longitude, toJulianDay(guessYear, guessMonth, 4));
    const d = fromJulianDay(jd + 0.5);
    const pillar = monthPillar(yStemIndex, ordinal);
    const luck = luckOf(ms, pillar, yongsin);
    out.push({
      year: guessYear, ordinal,
      from: `${d.y}-${String(d.m).padStart(2, '0')}-${String(Math.floor(d.d)).padStart(2, '0')}`,
      termName: term.name,
      pillar: `${pillar.stem}${pillar.branch}`,
      stemGod: luck.stemGod, branchGod: luck.branchGod,
      favor: luck.favor, interactions: luck.interactions,
    });
  }
  return out;
}

/* ────────────────────────────────────────────────────────────
 * 달 단위로 때를 집는 것 — 솔로 탈출·마음 정리
 * ──────────────────────────────────────────────────────────── */

export interface MarkedMonth extends MonthLuck {
  /** 이 달을 집은 까닭. 없으면 안 집은 달이다 */
  says: string[];
}

export interface MonthPick {
  /** 무엇을 보고 달을 집었는지 먼저 밝힌다 */
  how: string[];
  /** 살펴본 모든 달 */
  months: MarkedMonth[];
  /** 그중 집힌 달 */
  picked: MarkedMonth[];
  disclaimer: string;
}

/** 도화·홍염이 앉은 지지를 뽑는다. 매력과 인연을 보는 자리다 */
function charmBranchesOf(ms: Myeongsik, an: Analysis): string[] {
  return an.sinsal
    .filter((s) => /도화|홍염/.test(s.name))
    .flatMap((s) => s.positions.map((p) => {
      const slot = { 연주: ms.year, 월주: ms.month, 일주: ms.day, 시주: ms.hour }[p];
      return slot?.branch ?? '';
    }))
    .filter(Boolean);
}

/**
 * 솔로 탈출 — **언제 만나나.**
 *
 * 결혼 시기는 스무 해를 해 단위로 본다. 만남은 그렇게 멀리 보는 것이 아니다.
 * 그래서 여기는 **가까운 세 해를 달 단위로** 본다. 같은 재료를 눈금만 바꿔
 * 보는 것이 아니라, 묻는 것이 다르니 보는 눈금도 다르다.
 */
export function meetingMonths(
  ms: Myeongsik, an: Analysis, gender: Gender, fromYear: number, years = 3,
): MonthPick {
  const spouse = spouseGroup(gender);
  const charm = charmBranchesOf(ms, an);
  const how = [
    `배우자 자리(${spouse})가 그 달에 드는가 — ${gender === '남' ? '남자는 재성을' : '여자는 관성을'} 봅니다`,
    '그 달이 배우자 자리(일지)와 묶이는가',
    '도화·홍염이 닿는 달인가',
    '채워야 할 기운이 드는 달인가',
  ];

  const months: MarkedMonth[] = [];
  for (let i = 0; i < years; i++) {
    for (const m of monthlyLuck(ms, an.yongsin, fromYear + i)) {
      const says: string[] = [];
      if (GOD_GROUP[m.stemGod as never] === spouse) says.push(`천간이 ${m.stemGod} — 배우자 자리가 듭니다`);
      if (GOD_GROUP[m.branchGod as never] === spouse) says.push(`지지가 ${m.branchGod} — 배우자 자리가 듭니다`);
      for (const note of m.interactions) {
        if (note.startsWith('일주') && note.includes('합')) says.push(`배우자 자리와 묶입니다 — ${note}`);
      }
      if (charm.includes(m.pillar.slice(-1))) says.push('도화·홍염이 닿는 달입니다');
      if (says.length && m.favor === '유리') says.push('채워야 할 기운이 드는 달입니다');
      months.push({ ...m, says });
    }
  }

  return {
    how,
    months,
    picked: months.filter((m) => m.says.length >= 2),
    disclaimer: '집힌 달에 반드시 만난다는 뜻이 아닙니다. '
      + '**그 달에 인연 쪽 기운이 더 몰린다**는 뜻이고, 안 집힌 달에 못 만난다는 뜻도 아닙니다.',
  };
}

/**
 * 마음 정리 — **언제쯤 괜찮아지나.**
 *
 * 재회는 「다시 닿는가」를 본다. 여기는 그 반대다 — **걸린 것이 풀리는
 * 때**와 **제 힘이 돌아오는 때**를 본다.
 *
 * 돌아온다 안 돌아온다를 말하지 않는다. 그건 재회 상품이 하는 일이고,
 * 이 상품을 산 손님이 물은 것도 아니다.
 */
export function healingMonths(
  ms: Myeongsik, an: Analysis, fromYear: number, years = 3,
): MonthPick {
  const how = [
    '배우자 자리(일지)에 걸린 것이 있는 달인가 — 걸리는 달은 마음이 다시 흔들립니다',
    '제 힘을 세우는 기운(비겁·인성)이 드는 달인가 — 그 달에 기운이 돌아옵니다',
    '채워야 할 기운이 드는 달인가',
  ];

  const months: MarkedMonth[] = [];
  for (let i = 0; i < years; i++) {
    for (const m of monthlyLuck(ms, an.yongsin, fromYear + i)) {
      const says: string[] = [];
      for (const note of m.interactions) {
        if (note.startsWith('일주')) says.push(`마음자리가 흔들립니다 — ${note}`);
      }
      const self = ['비겁', '인성'];
      if (self.includes(GOD_GROUP[m.stemGod as never])) says.push(`천간이 ${m.stemGod} — 제 힘을 세우는 기운입니다`);
      if (self.includes(GOD_GROUP[m.branchGod as never])) says.push(`지지가 ${m.branchGod} — 제 힘을 세우는 기운입니다`);
      if (m.favor === '유리' && says.length) says.push('채워야 할 기운이 드는 달입니다');
      months.push({ ...m, says });
    }
  }

  return {
    how,
    months,
    picked: months.filter((m) => m.says.length >= 2),
    disclaimer: '이 글은 **정리하는 쪽**을 봅니다. 다시 만나는지는 보지 않습니다. '
      + '기운이 든다고 저절로 괜찮아지는 것도 아닙니다 — 그 달이 덜 힘든 달이라는 뜻입니다.',
  };
}
