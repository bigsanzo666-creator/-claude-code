/**
 * 무료로 펼쳐 주는 긴 풀이.
 *
 * 값을 받기 전에 **먼저 많이 준다.** 손님이 다 읽고 나서 「이 정도면」 하고
 * 사는 것이지, 세 줄 보고 사지 않는다.
 *
 * ## 여기 있는 것은 전부 계산된 값이다
 *
 * 여덟 글자, 십신, 오행 무게, 신강·신약, 채워야 할 기운, 십 년 운 — 전부
 * `analyze()` 와 `calculateDaeun()` 이 이미 낸 값을 **말로 옮기기만** 한다.
 * 지어내는 문장은 하나도 없고, 모델도 부르지 않는다. 그래서 손님이 아무리
 * 많이 읽어도 원가가 0이다.
 *
 * ## 어디서 끊는가
 *
 * 「지금 어떤 사람이고 어느 십 년을 지나는가」까지 준다. 그래서 **무엇을
 * 어떻게 하라는 말**은 리포트에 있다. 끊는 자리를 `cut` 이 직접 말한다.
 */

import type { Myeongsik } from '../../manseryeok/src/index.ts';
import type { Analysis } from './index.ts';
import { calculateDaeun, currentDaeun, annualLuck, type Gender, type Favor } from './luck.ts';

/** 십신 그룹을 여덟 살이 알아듣는 말로 */
export const GOD_PLAIN: Record<string, string> = {
  비겁: '혼자 밀고 나가는 힘',
  식상: '밖으로 내보이는 힘',
  재성: '쥐고 굴리는 힘',
  관성: '지키고 견디는 힘',
  인성: '받아들이고 배우는 힘',
};

/** 오행을 여덟 살이 알아듣는 말로 */
export const ELEMENT_PLAIN: Record<string, string> = {
  목: '뻗어 나가는 기운',
  화: '타오르는 기운',
  토: '품고 버티는 기운',
  금: '자르고 맺는 기운',
  수: '흐르고 스며드는 기운',
};

export function plainGod(god: string): string {
  return GOD_PLAIN[god] ?? god;
}

export function plainElement(element: string): string {
  return ELEMENT_PLAIN[element] ?? element;
}

/** 여덟 글자 표의 한 줄 */
export interface ReadRow {
  position: string;
  stem: string;
  branch: string;
  /** 천간의 십신. 일간 자신은 「나」 */
  stemGod: string;
  branchGod: string;
  stage: string;
}

/** 오행 막대 하나 */
export interface ReadBar {
  element: string;
  plain: string;
  /** 지장간까지 반영한 무게 (합 100) */
  pct: number;
  /** 겉으로 드러난 글자 수 */
  visible: number;
}

/** 십 년 운 한 칸 */
export interface ReadLuck {
  ganzhi: string;
  ages: string;
  years: string;
  favor: Favor;
  now: boolean;
  say: string;
}

/** 한 해 */
export interface ReadYear {
  year: number;
  ganzhi: string;
  favor: Favor;
  now: boolean;
  say: string;
}

export interface FreeReading {
  /** 한 줄로 「무슨 사주인가」 */
  head: string;
  eight: ReadRow[];
  bars: ReadBar[];
  strength: { verdict: string; ratio: number; say: string };
  fill: { need: string[]; avoid: string[]; say: string };
  /** 성별을 모르면 빈 배열 — 대운은 성별로 방향이 갈린다 */
  luck: ReadLuck[];
  years: ReadYear[];
  /** 이 명식에서 눈에 띄는 것들 */
  notes: string[];
  /** 끊는 자리 */
  cut: string;
}

const FAVOR_SAY: Record<Favor, string> = {
  유리: '기운이 붙는다',
  불리: '부딪히는 데가 있다',
  중립: '크게 흔들리지 않는다',
};

export interface ReadingOptions {
  /** 모르면 null — 그러면 십 년 운을 내지 않는다 */
  gender: Gender | null;
  /** 오늘. 「지금 어느 십 년인가」를 짚는 데 쓴다 */
  todayYear: number;
}

export function freeReading(ms: Myeongsik, an: Analysis, opts: ReadingOptions): FreeReading {
  const eight: ReadRow[] = an.pillars.map((p) => ({
    position: p.position,
    stem: p.stem,
    branch: p.branch,
    stemGod: p.stemGod ?? '나',
    branchGod: p.branchGod,
    stage: p.stage,
  }));

  const bars: ReadBar[] = an.elements.map((e) => ({
    element: e.element,
    plain: plainElement(e.element),
    pct: Math.round(e.weight),
    visible: e.visibleCount,
  }));

  const strong = an.strength.verdict === '신강';
  const strengthSay =
    an.strength.verdict === '중화'
      ? '미는 힘과 기대는 힘이 엇비슷해. 어느 쪽으로도 크게 치우치지 않는다.'
      : strong
        ? '제 힘으로 미는 쪽이야. 밀 때 세게 밀지만, 아닌 것을 붙들 때도 그만큼 세게 붙든다.'
        : '기대는 쪽이야. 혼자 다 지려고 하면 오래 못 가고, 곁을 두면 훨씬 멀리 간다.';

  const need = an.yongsin.primary.map(plainGod);
  const avoid = an.yongsin.avoid.map(plainGod);
  const fillSay = need.length
    ? `네게 붙으면 풀리는 건 ${need.join(', ')}이야.` +
      (an.yongsin.seasonalNote ? ` ${an.yongsin.seasonalNote}` : '')
    : '한쪽으로 크게 모자란 기운은 없다.';

  const age = opts.todayYear - ms.meta.solarYear;
  let luck: ReadLuck[] = [];
  if (opts.gender) {
    const daeun = calculateDaeun(ms, opts.gender, an.yongsin);
    const now = currentDaeun(daeun, age);
    luck = daeun.periods.map((p) => ({
      ganzhi: p.pillar.stem + p.pillar.branch,
      ages: `${p.startAge}–${p.endAge}세`,
      years: `${p.startYear}–${p.endYear}`,
      favor: p.favor,
      now: now ? p.index === now.index : false,
      say: FAVOR_SAY[p.favor],
    }));
  }

  const years: ReadYear[] = annualLuck(ms, an.yongsin, opts.todayYear, 3).map((y) => ({
    year: y.year,
    ganzhi: y.pillar.stem + y.pillar.branch,
    favor: y.favor,
    now: y.year === opts.todayYear,
    say: FAVOR_SAY[y.favor],
  }));

  const top = [...an.elements].sort((a, b) => b.weight - a.weight)[0];
  const head =
    `${ms.day.stem} 일간, ${an.dayMaster.element}. ` +
    (top ? `${plainElement(top.element)}이 제일 두껍다.` : '');

  return {
    head,
    eight,
    bars,
    strength: { verdict: an.strength.verdict, ratio: Math.round(an.strength.supportRatio), say: strengthSay },
    fill: { need, avoid, say: fillSay },
    luck,
    years,
    notes: an.highlights.slice(0, 6),
    // 준 것과 남은 것을 신령이 직접 말한다. 그래야 손님이 속았다고 느끼지 않는다
    cut: '여기까지가 네가 어떤 사람이고 지금 어느 십 년을 지나는가야. ' +
      '이 기운을 어디에 어떻게 써야 하는지는, 여덟 글자를 처음부터 끝까지 훑어야 나온다.',
  };
}
