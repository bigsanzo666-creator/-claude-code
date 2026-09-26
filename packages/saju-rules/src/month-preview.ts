import { calculate, type Myeongsik } from '../../manseryeok/src/index.ts';
import {
  analyze,
  monthlyLuck,
  dailyLuckRange,
  PLACES,
  type Analysis,
  type YongsinResult,
} from './index.ts';
import { parseInputTime } from './daily-preview.ts';
import { extractTopic } from './topics.ts';

export interface MonthPreviewPillar {
  label: string;
  stem: string;
  branch: string;
  stemHanja: string;
  branchHanja: string;
  hangul: string;
}

export interface MonthPreviewDayItem {
  date: string;
  pillar: string;
  stemGod: string;
  branchGod: string;
  favor: string;
  interactions: string[];
}

export interface MonthPreviewTopicItem {
  name: string;
  ask: string;
  revealedLines: string[];
  foggyLines: string[];
}

export interface MonthPreviewData {
  notice: string;
  targetYear: number;
  targetMonth: number;
  myeongsik: {
    pillars: MonthPreviewPillar[];
    correctionText: string;
  };
  thisMonth: {
    termName: string;
    from: string;
    pillarHanja: string;
    pillarHangul: string;
    stemGod: string;
    branchGod: string;
    favor: string;
    headline: string;
    fullDescription: string;
    whyBox: string;
  };
  topics: {
    money: MonthPreviewTopicItem;
    career: MonthPreviewTopicItem;
    people: MonthPreviewTopicItem;
  };
  days: {
    goodRevealed: MonthPreviewDayItem;
    goodFoggy: MonthPreviewDayItem[];
    badFoggy: MonthPreviewDayItem[];
  };
  actionNotice: {
    title: string;
    desc: string;
  };
}

const STEM_HANJA: Record<string, string> = {
  갑: '甲', 을: '乙', 병: '丙', 정: '丁', 무: '戊',
  기: '己', 경: '庚', 신: '辛', 임: '壬', 계: '癸',
};

const BRANCH_HANJA: Record<string, string> = {
  자: '子', 축: '丑', 인: '寅', 묘: '卯', 진: '辰', 사: '巳',
  오: '午', 미: '未', 신: '申', 유: '酉', 술: '戌', 해: '亥',
};

function seoulTodayISO(): string {
  const now = new Date();
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  return kst.toISOString().slice(0, 10);
}

function formatKoreanBirthHeader(dateStr: string, timeStr: string | null | undefined, place: string | undefined): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  let tStr = '시간 모름';
  if (timeStr && timeStr !== '모름') {
    const [hh, mm] = timeStr.split(':').map(Number);
    let label = '낮';
    let h12 = hh;
    if (hh === 0) { label = '자정'; h12 = 12; }
    else if (hh < 6) { label = '새벽'; }
    else if (hh < 12) { label = '오전'; }
    else if (hh === 12) { label = '정오'; h12 = 12; }
    else if (hh < 18) { label = '오후'; h12 = hh - 12; }
    else { label = '저녁'; h12 = hh - 12; }
    tStr = `${label} ${h12}시 ${mm ? `${mm}분` : '00분'}`;
  }
  const placeStr = place ? `${place} 태생` : '출생지 미입력';
  return `${y}년 ${m}월 ${d}일 ${tStr} (${placeStr})`;
}

export function buildMonthPreviewData(input: {
  date: string;
  time?: string | null;
  place?: string;
  gender?: string;
}): MonthPreviewData {
  let longitude: number | undefined = undefined;
  if (input.place) {
    const found = PLACES.find((p) => p.name === input.place);
    if (found) longitude = found.longitude;
  }
  if (longitude === undefined) longitude = 126.978; // 서울 기본

  const time = parseInputTime(input.time);
  const ms = calculate({ date: input.date, time, longitude });
  const an = analyze(ms);

  const pillars: MonthPreviewPillar[] = [
    {
      label: '시주',
      stem: ms.hour ? ms.hour.stem : '—',
      branch: ms.hour ? ms.hour.branch : '—',
      stemHanja: ms.hour ? (STEM_HANJA[ms.hour.stem] || ms.hour.stem) : '—',
      branchHanja: ms.hour ? (BRANCH_HANJA[ms.hour.branch] || ms.hour.branch) : '—',
      hangul: ms.hour ? `${ms.hour.stem}${ms.hour.branch}` : '시 모름',
    },
    {
      label: '일주',
      stem: ms.day.stem,
      branch: ms.day.branch,
      stemHanja: STEM_HANJA[ms.day.stem] || ms.day.stem,
      branchHanja: BRANCH_HANJA[ms.day.branch] || ms.day.branch,
      hangul: `${ms.day.stem}${ms.day.branch}`,
    },
    {
      label: '월주',
      stem: ms.month.stem,
      branch: ms.month.branch,
      stemHanja: STEM_HANJA[ms.month.stem] || ms.month.stem,
      branchHanja: BRANCH_HANJA[ms.month.branch] || ms.month.branch,
      hangul: `${ms.month.stem}${ms.month.branch}`,
    },
    {
      label: '연주',
      stem: ms.year.stem,
      branch: ms.year.branch,
      stemHanja: STEM_HANJA[ms.year.stem] || ms.year.stem,
      branchHanja: BRANCH_HANJA[ms.year.branch] || ms.year.branch,
      hangul: `${ms.year.stem}${ms.year.branch}`,
    },
  ];

  const birthHeader = formatKoreanBirthHeader(input.date, input.time, input.place);
  const corrText = ms.meta.correctedTime
    ? `${birthHeader}\n${input.place || '서울'} 기준 진태양시 ${ms.meta.correctedTime} 보정 명식입니다.`
    : `${birthHeader}\n진태양시 보정 기준 명식입니다.`;

  const today = seoulTodayISO();
  const [yStr, mStr, dStr] = today.split('-');
  const yNum = Number(yStr);
  const mNum = Number(mStr);
  const dNum = Number(dStr);
  const thisMonthLastDay = new Date(Date.UTC(yNum, mNum, 0)).getUTCDate();
  const daysRemaining = thisMonthLastDay - dNum + 1;

  let targetYear: number;
  let targetMonth: number;
  let startDate: string;
  let dayCount: number;

  if (daysRemaining < 10) {
    // 말일까지 열흘 미만이면 → 다음 달 것을 준다
    targetYear = mNum === 12 ? yNum + 1 : yNum;
    targetMonth = mNum === 12 ? 1 : mNum + 1;
    const targetLastDay = new Date(Date.UTC(targetYear, targetMonth, 0)).getUTCDate();
    startDate = `${targetYear}-${String(targetMonth).padStart(2, '0')}-01`;
    dayCount = targetLastDay;
  } else {
    targetYear = yNum;
    targetMonth = mNum;
    startDate = today;
    dayCount = daysRemaining;
  }

  const targetMonthLabel = `${targetYear}년 ${targetMonth}월 운세입니다`;

  // 대상 월의 월운(절기)은 그 달 15일 기준
  const targetMidDate = `${targetYear}-${String(targetMonth).padStart(2, '0')}-15`;
  const allMonths = [targetYear - 1, targetYear, targetYear + 1].flatMap((y) => monthlyLuck(ms, an.yongsin, y));
  allMonths.sort((a, b) => a.from.localeCompare(b.from));
  const thisMonthIndex = allMonths.findLastIndex((m) => m.from <= targetMidDate);
  const thisMonth = allMonths[thisMonthIndex >= 0 ? thisMonthIndex : 0];

  const mStem = thisMonth.pillar[0] || '';
  const mBranch = thisMonth.pillar[1] || '';
  const pillarHanja = `${STEM_HANJA[mStem] || mStem}${BRANCH_HANJA[mBranch] || mBranch}`;
  const pillarHangul = thisMonth.pillar;

  // 1번 칸: 이번 달, 그대는 어떤 자리에 있는가
  const favorStr = thisMonth.favor === '유리'
    ? '제 힘을 살려 주도권을 쥐기에 좋은 달'
    : thisMonth.favor === '불리'
      ? '무리한 확장보다 속도를 조절하고 숨을 고르는 달'
      : '안정을 유지하며 차분하게 다져가는 달';

  const headline = `${thisMonth.termName} 절기부터 시작되는 ${pillarHangul}의 흐름`;
  const fullDescription =
    `이번 달은 손님의 사주와 만나 ${favorStr}입니다. ` +
    `내 기운을 바탕으로 볼 때 ${thisMonth.favor === '유리' ? '적극적으로 결단을 내리고 기회를 만들어갈 자리' : '지나친 서두름을 피하고 흐름을 지켜볼 자리'}에 서 있습니다. ` +
    (thisMonth.interactions.length ? `사주와의 관계에서는 ${thisMonth.interactions.join(', ')}의 흐름이 작용합니다.` : '특별히 거친 부딪힘 없이 안정적으로 이어지는 기운입니다.');

  const whyBox = `절기: ${thisMonth.termName} (${thisMonth.from}부터) · 간지: ${pillarHanja}(${pillarHangul}) · 천간 ${thisMonth.stemGod} · 지지 ${thisMonth.branchGod} · 유불리: ${thisMonth.favor}`;

  // 2, 3, 4번 칸: 돈 · 일 · 사람
  const wealth = extractTopic(an, 'wealth');
  const career = extractTopic(an, 'career');
  const peers = extractTopic(an, 'peers');

  function splitTopicLines(topicData: any, defaultAsk: string): MonthPreviewTopicItem {
    const rawLines: string[] = [];
    if (topicData?.highlights?.length) {
      for (const h of topicData.highlights) rawLines.push(String(h));
    }
    if (topicData?.elements) {
      rawLines.push(`재성·관성 관련 바탕 기운이 손님의 결을 이룹니다.`);
    }
    if (rawLines.length < 4) {
      rawLines.push('기운의 흐름에 맞춰 들어오고 나가는 결을 살핍니다.');
      rawLines.push('시기별 유불리와 변동성에 유의해야 할 지점이 있습니다.');
      rawLines.push('구체적인 주의점과 방향은 본문 리포트에서 이어집니다.');
    }
    return {
      name: topicData?.title || '주제',
      ask: defaultAsk,
      revealedLines: rawLines.slice(0, 2),
      foggyLines: rawLines.slice(2),
    };
  }

  const moneyTopic = splitTopicLines(wealth, '들어오는 달인지 나가는 달인지, 무엇을 조심할지');
  const careerTopic = splitTopicLines(career, '밀어붙일 달인지 버틸 달인지');
  const peopleTopic = splitTopicLines(peers, '누구와 가까워지고 누구와 엇갈리는지');

  // 5번 칸: 날 (좋은 날 셋, 조심할 날 셋)
  const daysLuck = dailyLuckRange(ms, an.yongsin, startDate, dayCount);

  const scoredDays = daysLuck.map((d, idx) => {
    let clashWeight = 0;
    for (const inter of d.interactions) {
      if (inter.includes('충')) {
        if (inter.includes('일주') || inter.includes('가장 크게 본다')) clashWeight += 3;
        else clashWeight += 1;
      }
    }
    const favorScore = d.favor === '유리' ? 2 : d.favor === '불리' ? -2 : 0;
    const finalScore = favorScore - clashWeight;
    const sH = STEM_HANJA[d.pillar.stem] || d.pillar.stem;
    const bH = BRANCH_HANJA[d.pillar.branch] || d.pillar.branch;
    return {
      idx,
      day: {
        date: d.date,
        pillar: `${sH}${bH} (${d.pillar.stem}${d.pillar.branch})`,
        stemGod: d.stemGod,
        branchGod: d.branchGod,
        favor: d.favor,
        interactions: d.interactions,
      },
      score: finalScore,
    };
  });

  const sortedDesc = [...scoredDays].sort((a, b) => b.score - a.score || a.idx - b.idx);
  const goodThree = sortedDesc.slice(0, 3).map((s) => s.day);
  const goodIndices = new Set(sortedDesc.slice(0, 3).map((s) => s.idx));

  const remainingForBad = scoredDays.filter((s) => !goodIndices.has(s.idx));
  const sortedAsc = [...remainingForBad].sort((a, b) => a.score - b.score || a.idx - b.idx);
  const badThree = sortedAsc.slice(0, 3).map((s) => s.day);

  return {
    notice: targetMonthLabel,
    targetYear,
    targetMonth,
    myeongsik: {
      pillars,
      correctionText: corrText,
    },
    thisMonth: {
      termName: thisMonth.termName,
      from: thisMonth.from,
      pillarHanja,
      pillarHangul,
      stemGod: thisMonth.stemGod,
      branchGod: thisMonth.branchGod,
      favor: thisMonth.favor,
      headline,
      fullDescription,
      whyBox,
    },
    topics: {
      money: moneyTopic,
      career: careerTopic,
      people: peopleTopic,
    },
    days: {
      goodRevealed: goodThree[0],
      goodFoggy: goodThree.slice(1),
      badFoggy: badThree,
    },
    actionNotice: {
      title: '이번 달에 하면 좋은 일 하나',
      desc: '손님의 명식에 가장 필요한 기운을 돕는 구체적 실천법 하나를 리포트 마지막에 처방해 드립니다.',
    },
  };
}
