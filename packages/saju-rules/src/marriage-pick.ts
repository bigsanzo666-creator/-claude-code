/**
 * 혼인 택일(婚姻 擇日) — 두 사람의 여덟 글자에 맞춰 좋은 날을 고른다.
 *
 * ## 셈법의 전거(典據) 및 표준 표
 *
 * 혼인 택일은 아이의 여덟 글자를 새로 짓는 제왕절개 택일(pick.ts)과 근본이 다르다.
 * 이미 태어난 신랑·신부 두 사람의 명식과 그날의 간지가 어떻게 맞물리는지를 본다.
 * 유파에 따라 견해가 갈릴 수 있으므로 본 모듈이 채택한 표준 표와 근거를 명시한다.
 *
 * 1. 지지충(地支沖) — 삼명통회(三命通會) 및 연해자평(淵海子平) 6충
 *    - 자오(子午)·축미(丑未)·인신(寅申)·묘유(卯酉)·진술(辰戌)·사해(巳亥)
 *    - 혼인에서는 부부궁인 '일지(日支)'가 깨지는 날을 가장 크게 피한다.
 * 2. 지지육합(地支六合) 및 삼합(三合) — 자평진전(子平眞詮) 및 적천수(滴天髓)
 *    - 육합: 자축토·인해목·묘술화·진유금·사신수·오미토 (화합과 결속)
 *    - 삼합: 신자진수국·해묘미목국·인오술화국·사유축금국 (기운의 어우러짐)
 * 3. 천간합(天干合) — 갑기·을경·병신·정임·무계 5합 (음양의 유정한 결합)
 * 4. 원진살(怨嗔殺) — 명리정종(命理正宗) 육원진
 *    - 자미(子未)·축오(丑午)·인유(寅酉)·묘신(卯申)·진해(辰亥)·사술(巳戌)
 *    - 이유 없이 서로 밀어내고 원망하는 기운으로 혼인 택일에서 감점 요인.
 * 5. 흉살(凶煞)
 *    - 백호대살(白虎): 무진·정축·병술·을미·갑진·계축·임술 (충돌과 거친 기세)
 *    - 괴강살(魁罡): 경진·경술·임진·무술 (극단으로 치우치는 기운)
 *    - 양인살(羊刃): 일간 기준 제왕지 (지나치게 강해 부딪히기 쉬움)
 * 6. 길신(吉神)
 *    - 천을귀인(天乙貴人): 일간 기준 최상의 길신 (환난을 풀고 돕는 기운)
 *    - 월덕·천덕귀인(月德·天德): 월지 기준 상생과 덕성의 길신
 *
 * ## 점수는 견주는 눈금이다
 *
 * 이 점수는 100점 만점 성적표가 아니라 주어진 기간 안에서 어느 날이
 * 상대적으로 온화하고 복된 날인지를 가려내는 상대적 눈금이다.
 */

import { calculate, type Myeongsik } from '../../manseryeok/src/index.ts';
import {
  BRANCH_CLASHES, BRANCH_SIX_COMBOS, BRANCH_TRIPLE_COMBOS,
  STEM_COMBINATIONS, CHEONEUL, YANGIN, BAEKHO, GOEGANG,
} from './tables.ts';

/** 원진(怨嗔) — 서로 거슬리고 원망하는 짝 */
export const WONJIN_PAIRS: [string, string][] = [
  ['자', '미'], ['축', '오'], ['인', '유'],
  ['묘', '신'], ['진', '해'], ['사', '술'],
];

/** 나쁜 이름표(흉살) 목록 */
export const BAD_SINSAL_LIST = ['일지충', '원진살', '백호대살', '괴강살', '양인살'] as const;

/** 좋은 이름표(길신) 목록 */
export const GOOD_SINSAL_LIST = ['천을귀인', '육합', '삼합', '천간합'] as const;

export interface PersonBirth {
  date?: string;
  birthDate?: string;
  time?: string | null;
  birthTime?: string | null;
  longitude?: number;
  place?: string;
  location?: string;
}

export interface MarriagePickOptions {
  /** 신랑 생년월일시 */
  groom: PersonBirth;
  /** 신부 생년월일시 */
  bride: PersonBirth;
  /** 택일 시작 날짜 (YYYY-MM-DD) */
  startDate: string;
  /** 택일 끝 날짜 (YYYY-MM-DD) */
  endDate: string;
  /** 피해야 할 날짜 목록 (YYYY-MM-DD) */
  avoidDates?: string[];
  /** 예식 지역 경도 (기본값 서울 126.978) */
  longitude?: number;
}

export interface DayClashDetail {
  target: '신랑' | '신부' | '양쪽';
  pillar: string;
  counter: string;
  name: string;
}

export interface DayComboDetail {
  target: '신랑' | '신부' | '양쪽';
  pillar: string;
  counter: string;
  name: string;
}

export interface MarriageDayScore {
  date: string;
  /** 그날의 간지 표기 (예: 병오년 무술월 갑자일) */
  eight: string;
  /** 상대 비교 점수 */
  score: number;
  /** 눈금 등급 */
  band: '아주 좋음' | '좋음' | '무난함' | '아쉬움' | '피하는 것이 좋음';
  /** 눈금 등급 (동의어) */
  grade: '아주 좋음' | '좋음' | '무난함' | '아쉬움' | '피하는 것이 좋음';
  /** 왜 그 점수가 나왔는지 근거 한 줄씩 (사람 말로) */
  says: string[];
  /** 충돌 상세 */
  clashes: string[];
  /** 묶임(합) 상세 */
  combos: string[];
  /** 나쁜 이름표 */
  badSinsal: string[];
  /** 좋은 이름표 */
  goodSinsal: string[];
}

export interface MarriagePickResult {
  /** 기간 내 모든 날의 평가 (점수 높은 순) */
  days: MarriageDayScore[];
  /** 제일 좋은 날 다섯 */
  bestFive: MarriageDayScore[];
  /** 피하는 것이 좋은 날 (점수가 낮거나 부딪힘이 강한 날) */
  avoidDays: MarriageDayScore[];
  /** 기간 정보 */
  period: {
    startDate: string;
    endDate: string;
    totalDays: number;
  };
}

/** 점수를 등급으로 환산 */
export function marriageBandOf(score: number): '아주 좋음' | '좋음' | '무난함' | '아쉬움' | '피하는 것이 좋음' {
  if (score >= 80) return '아주 좋음';
  if (score >= 65) return '좋음';
  if (score >= 50) return '무난함';
  if (score >= 35) return '아쉬움';
  return '피하는 것이 좋음';
}

function isClash(b1: string, b2: string): boolean {
  return BRANCH_CLASHES.some(([x, y]) => (x === b1 && y === b2) || (x === b2 && y === b1));
}

function isSixCombo(b1: string, b2: string): string | null {
  const found = BRANCH_SIX_COMBOS.find((c) => (c.pair[0] === b1 && c.pair[1] === b2) || (c.pair[0] === b2 && c.pair[1] === b1));
  return found ? found.name : null;
}

function isStemCombo(s1: string, s2: string): string | null {
  const found = STEM_COMBINATIONS.find((c) => (c.pair[0] === s1 && c.pair[1] === s2) || (c.pair[0] === s2 && c.pair[1] === s1));
  return found ? found.name : null;
}

function isWonjin(b1: string, b2: string): boolean {
  return WONJIN_PAIRS.some(([x, y]) => (x === b1 && y === b2) || (x === b2 && y === b1));
}

function hasTripleCombo(dayBranch: string, targetBranch: string): string | null {
  for (const t of BRANCH_TRIPLE_COMBOS) {
    if (t.members.includes(dayBranch as any) && t.members.includes(targetBranch as any)) {
      return `${t.becomes} 기운의 삼합국`;
    }
  }
  return null;
}

function resolveMyeongsik(p: PersonBirth, defaultLng: number): Myeongsik {
  const d = p.date ?? p.birthDate;
  if (!d) throw new Error('생년월일(date 또는 birthDate)이 필요합니다.');
  const t = p.time ?? p.birthTime ?? '12:00';
  const lng = p.longitude ?? defaultLng;
  return calculate({ date: d, time: t, longitude: lng });
}

/**
 * 신랑과 신부의 명식과 기간을 받아 날마다의 혼인 택일 점수를 산출한다.
 */
export function pickMarriageDays(options: MarriagePickOptions): MarriagePickResult {
  const { startDate, endDate, avoidDates = [], longitude = 126.978 } = options;

  if (!startDate || !endDate) {
    throw new Error('시작 날짜와 끝 날짜를 모두 입력해야 합니다.');
  }
  if (startDate > endDate) {
    throw new Error('시작 날짜가 끝 날짜보다 뒤에 올 수 없습니다.');
  }

  const startUtc = new Date(`${startDate}T00:00:00Z`).getTime();
  const endUtc = new Date(`${endDate}T00:00:00Z`).getTime();
  const oneDay = 86400000;

  const avoidSet = new Set(avoidDates);

  const groomMs = resolveMyeongsik(options.groom, longitude);
  const brideMs = resolveMyeongsik(options.bride, longitude);

  const gDayStem = groomMs.day.stem;
  const gDayBranch = groomMs.day.branch;
  const bDayStem = brideMs.day.stem;
  const bDayBranch = brideMs.day.branch;

  const evaluatedDays: MarriageDayScore[] = [];

  for (let t = startUtc; t <= endUtc; t += oneDay) {
    const curDate = new Date(t).toISOString().slice(0, 10);
    if (avoidSet.has(curDate)) {
      continue;
    }

    // 그날 정오의 간지 계산
    const dayMs = calculate({ date: curDate, time: '12:00', longitude });
    const dayStem = dayMs.day.stem;
    const dayBranch = dayMs.day.branch;
    const dayPillar = `${dayStem}${dayBranch}`;
    const eight = `${dayMs.year.stem}${dayMs.year.branch}년 ${dayMs.month.stem}${dayMs.month.branch}월 ${dayMs.day.stem}${dayMs.day.branch}일`;

    let score = 60; // 기준 출발 점수
    const says: string[] = [];
    const clashes: string[] = [];
    const combos: string[] = [];
    const badSinsal: string[] = [];
    const goodSinsal: string[] = [];

    // ── 1. 일지(日支)와 부딪히는가 (가장 중요) ─────────────────
    const groomClash = isClash(gDayBranch, dayBranch);
    const brideClash = isClash(bDayBranch, dayBranch);

    if (groomClash && brideClash) {
      score -= 65;
      clashes.push(`신랑 일지 ${gDayBranch}·신부 일지 ${bDayBranch} 모두 당일 지지 ${dayBranch}와 충돌`);
      badSinsal.push('양쪽 일지 쌍충');
      says.push(`신랑과 신부 두 분의 배우자 자리(일지)가 모두 그날의 글자와 부딪혀 권하지 않는 날입니다.`);
    } else if (groomClash) {
      score -= 25;
      clashes.push(`신랑 일지 ${gDayBranch}와 당일 지지 ${dayBranch} 충돌(${gDayBranch}${dayBranch}충)`);
      badSinsal.push('신랑 일지충');
      says.push(`신랑의 배우자 자리(일지 ${gDayBranch})와 그날의 글자(${dayBranch})가 서로 부딪힙니다(${gDayBranch}${dayBranch}충).`);
    } else if (brideClash) {
      score -= 25;
      clashes.push(`신부 일지 ${bDayBranch}와 당일 지지 ${dayBranch} 충돌(${bDayBranch}${dayBranch}충)`);
      badSinsal.push('신부 일지충');
      says.push(`신부의 배우자 자리(일지 ${bDayBranch})와 그날의 글자(${dayBranch})가 서로 부딪힙니다(${bDayBranch}${dayBranch}충).`);
    }

    // ── 2. 두 사람의 글자와 묶이는가(합) ────────────────────────
    // 지지 육합
    const groomSix = isSixCombo(gDayBranch, dayBranch);
    const brideSix = isSixCombo(bDayBranch, dayBranch);

    if (groomSix && brideSix) {
      score += 36;
      combos.push(`신랑·신부 일지 모두 당일 지지와 육합(${groomSix})`);
      goodSinsal.push('양쪽 일지 육합');
      says.push(`신랑과 신부 두 분의 배우자 자리가 모두 그날의 글자와 육합을 이루어 화합의 기운이 큽니다.`);
    } else {
      if (groomSix) {
        score += 15;
        combos.push(`신랑 일지 ${gDayBranch}와 당일 지지 ${dayBranch} 육합(${groomSix})`);
        goodSinsal.push('신랑 일지 육합');
        says.push(`신랑의 일지(${gDayBranch})와 그날의 글자(${dayBranch})가 육합(${groomSix})을 이루어 화합합니다.`);
      }
      if (brideSix) {
        score += 15;
        combos.push(`신부 일지 ${bDayBranch}와 당일 지지 ${dayBranch} 육합(${brideSix})`);
        goodSinsal.push('신부 일지 육합');
        says.push(`신부의 일지(${bDayBranch})와 그날의 글자(${dayBranch})가 육합(${brideSix})을 이루어 화합합니다.`);
      }
    }

    // 천간합
    const groomStemCombo = isStemCombo(gDayStem, dayStem);
    const brideStemCombo = isStemCombo(bDayStem, dayStem);

    if (groomStemCombo) {
      score += 8;
      combos.push(`신랑 일간 ${gDayStem}과 당일 천간 ${dayStem} 천간합(${groomStemCombo})`);
      goodSinsal.push('신랑 천간합');
      says.push(`신랑의 일간(${gDayStem})과 그날의 천간(${dayStem})이 서로 조화를 이룹니다.`);
    }
    if (brideStemCombo) {
      score += 8;
      combos.push(`신부 일간 ${bDayStem}과 당일 천간 ${dayStem} 천간합(${brideStemCombo})`);
      goodSinsal.push('신부 천간합');
      says.push(`신부의 일간(${bDayStem})과 그날의 천간(${dayStem})이 서로 조화를 이룹니다.`);
    }

    // 삼합 / 반합
    const groomTriple = hasTripleCombo(dayBranch, gDayBranch);
    const brideTriple = hasTripleCombo(dayBranch, bDayBranch);
    if (groomTriple && !groomSix) {
      score += 6;
      combos.push(`신랑 일지와 ${groomTriple}`);
      goodSinsal.push('신랑 삼합');
    }
    if (brideTriple && !brideSix) {
      score += 6;
      combos.push(`신부 일지와 ${brideTriple}`);
      goodSinsal.push('신부 삼합');
    }

    // ── 3. 나쁜 이름표 (신살 감점) ──────────────────────────────
    // 원진살 (일지와 당일 지지)
    const groomWonjin = isWonjin(gDayBranch, dayBranch);
    const brideWonjin = isWonjin(bDayBranch, dayBranch);

    if (groomWonjin) {
      score -= 10;
      badSinsal.push('신랑 일지 원진');
      says.push(`신랑의 일지(${gDayBranch})와 그날의 글자(${dayBranch}) 사이에 원진(서로 거슬리는 기운)이 있습니다.`);
    }
    if (brideWonjin) {
      score -= 10;
      badSinsal.push('신부 일지 원진');
      says.push(`신부의 일지(${bDayBranch})와 그날의 글자(${dayBranch}) 사이에 원진(서로 거슬리는 기운)이 있습니다.`);
    }

    // 백호대살
    if (BAEKHO.includes(dayPillar)) {
      score -= 8;
      badSinsal.push('백호대살');
      says.push(`그날의 일진이 백호대살(${dayPillar})에 해당하여 기운이 다소 거칠 수 있습니다.`);
    }

    // 괴강살
    if (GOEGANG.includes(dayPillar)) {
      score -= 6;
      badSinsal.push('괴강살');
      says.push(`그날의 일진이 괴강(${dayPillar})에 해당하여 기운이 한쪽으로 치우칠 수 있습니다.`);
    }

    // 양인살
    const groomYangin = YANGIN[gDayStem] === dayBranch;
    const brideYangin = YANGIN[bDayStem] === dayBranch;
    if (groomYangin) {
      score -= 6;
      badSinsal.push('신랑 양인살');
      says.push(`신랑의 일간(${gDayStem})에 양인(날카로운 기세)이 닿습니다.`);
    }
    if (brideYangin) {
      score -= 6;
      badSinsal.push('신부 양인살');
      says.push(`신부의 일간(${bDayStem})에 양인(날카로운 기세)이 닿습니다.`);
    }

    // ── 4. 좋은 이름표 (길신 가점) ──────────────────────────────
    // 천을귀인
    const groomCheoneul = (CHEONEUL[gDayStem] ?? []).includes(dayBranch);
    const brideCheoneul = (CHEONEUL[bDayStem] ?? []).includes(dayBranch);

    if (groomCheoneul && brideCheoneul) {
      score += 30;
      goodSinsal.push('양쪽 천을귀인');
      says.push(`신랑과 신부 두 분 모두에게 길신(천을귀인)이 닿아 만사를 화합으로 이끕니다.`);
    } else {
      if (groomCheoneul) {
        score += 15;
        goodSinsal.push('신랑 천을귀인');
        says.push(`신랑에게 어려움을 풀어 주는 길신(천을귀인)의 기운이 닿습니다.`);
      }
      if (brideCheoneul) {
        score += 15;
        goodSinsal.push('신부 천을귀인');
        says.push(`신부에게 어려움을 풀어 주는 길신(천을귀인)의 기운이 닿습니다.`);
      }
    }

    // 특별한 충/합/살이 없어 근거 문장이 비어 있는 경우 기본 평온 문구 보장
    if (says.length === 0) {
      says.push(`두 사람의 여덟 글자와 큰 부딪힘 없이 무난하고 순탄하게 치를 수 있는 날입니다.`);
    }

    const band = marriageBandOf(score);
    evaluatedDays.push({
      date: curDate,
      eight,
      score,
      band,
      grade: band,
      says,
      clashes,
      combos,
      badSinsal,
      goodSinsal,
    });
  }

  // 좋은 순(점수 내림차순, 동점 시 날짜 오름차순)으로 정렬
  const sorted = [...evaluatedDays].sort((a, b) => b.score - a.score || a.date.localeCompare(b.date));

  const bestFive = sorted.slice(0, 5);
  // 피하는 것이 좋은 날: 점수가 35점 미만이거나 일지 충돌이 있는 날
  const avoidDays = sorted.filter((d) => d.score < 35 || d.clashes.length > 0);

  return {
    days: sorted,
    bestFive,
    avoidDays,
    period: {
      startDate,
      endDate,
      totalDays: evaluatedDays.length,
    },
  };
}
