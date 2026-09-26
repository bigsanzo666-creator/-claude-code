export function parseInputTime(val?: string | null): string | null {
  if (!val || val === '모름') return null;
  val = val.trim();
  if (/^\d{1,2}:\d{2}$/.test(val)) return val;
  const matchKorean = val.match(/(오전|오후|낮|새벽|저녁|밤)?\s*(\d{1,2})시\s*(\d{1,2})?분?/);
  if (matchKorean) {
    const prefix = matchKorean[1];
    let h = parseInt(matchKorean[2], 10);
    const m = matchKorean[3] ? parseInt(matchKorean[3], 10) : 0;
    if ((prefix === '오후' || prefix === '낮' || prefix === '저녁' || prefix === '밤') && h < 12) {
      h += 12;
    } else if ((prefix === '새벽' || prefix === '자정') && h === 12) {
      h = 0;
    }
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }
  const SIJIN_MAP: Record<string, string> = {
    자시: '00:30', 축시: '02:30', 인시: '04:30', 묘시: '06:30',
    진시: '08:30', 사시: '10:30', 오시: '12:30', 미시: '14:30',
    신시: '16:30', 유시: '18:30', 술시: '20:30', 해시: '22:30',
  };
  for (const [k, v] of Object.entries(SIJIN_MAP)) {
    if (val.includes(k)) return v;
  }
  return val;
}

import { calculate, type Myeongsik } from '../../manseryeok/src/index.ts';
import {
  analyze,
  dailyLuck,
  luckOf,
  groupElement,
  PLACES,
  type Analysis,
  type YongsinResult,
} from './index.ts';
import { plainGod, plainElement, GOD_PLAIN, ELEMENT_PLAIN } from './reading.ts';

export interface DailyPreviewSlot {
  hanja: string;
  시진: string;
  시각: string;
  간지: string;
  천간십신: string;
  지지십신: string;
  유불리: string;
  label: string;
}

export interface DailyPreviewFoggySlot {
  hanja: string;
  시진: string;
}

export interface DailyPreviewData {
  myeongsik: {
    pillars: {
      label: string;
      stem: string;
      branch: string;
      stemHanja: string;
      branchHanja: string;
      hangul: string;
    }[];
    correctionText: string;
  };
  today: {
    dateKorean: string;
    pillarHanja: string;
    pillarHangul: string;
    stemGod: string;
    branchGod: string;
    stampText: string;
    headline: string;
    reading: string;
    whyStem: string;
    whyBranch: string;
    whyBox: string;
  };
  person: {
    dayMaster: {
      stem: string;
      stemHanja: string;
      element: string;
      elementHanja: string;
      yinYang: string;
      nature: string;
    };
    elements: {
      element: string;
      weight: number;
      visibleCount: number;
    }[];
    missingText: string;
    sinsalStamps: { name: string; desc: string }[];
  };
  hours: {
    revealed: DailyPreviewSlot[];
    foggy: DailyPreviewFoggySlot[];
  };
  lockedList: {
    badge: string;
    title: string;
    desc: string;
  }[];
}

const STEM_HANJA: Record<string, string> = {
  갑: '甲', 을: '乙', 병: '丙', 정: '丁', 무: '戊',
  기: '己', 경: '庚', 신: '辛', 임: '壬', 계: '癸',
};

const BRANCH_HANJA: Record<string, string> = {
  자: '子', 축: '丑', 인: '寅', 묘: '卯', 진: '辰', 사: '巳',
  오: '午', 미: '未', 신: '申', 유: '酉', 술: '戌', 해: '亥',
};

const ELEMENT_HANJA: Record<string, string> = {
  목: '木', 화: '火', 토: '土', 금: '金', 수: '水',
};

const DAY_MASTER_NATURE: Record<string, string> = {
  갑: '갑목(甲木) — 하늘로 곧게 솟아오르는 큰 나무의 기운',
  을: '을목(乙木) — 유연하고 생명력 넘치는 풀과 꽃의 기운',
  병: '병화(丙火) — 세상을 환하게 비추는 태양의 밝은 불꽃',
  정: '정화(丁火) — 어둠을 따스하게 밝히는 등불과 촛불의 기운',
  무: '무토(戊土) — 넓고 굳건하게 만물을 품어주는 큰 산과 대지',
  기: '기토(己土) — 만물을 정성으로 가꾸고 길러내는 비옥한 논밭',
  경: '경금(庚金) — 결단력 있고 굳센 바위와 무쇠의 기운',
  신: '신금(辛金) — 섬세하고 맑게 빛나는 보석과 날카로운 칼날',
  임: '임수(壬水) — 넓은 바다처럼 깊고 거침없이 흐르는 큰 물',
  계: '계수(癸水) — 맑고 깊게 스며드는 촉촉한 이슬과 샘물',
};

const SINSAL_DESC: Record<string, string> = {
  천을귀인: '어려울 때 귀인의 도움을 받는 가장 귀한 길신',
  도화살: '사람의 마음을 끌어당기고 매력을 발산하는 기운',
  괴강: '비범한 총명함과 결단력으로 큰 흐름을 쥐는 힘',
  백호: '강력한 집중력과 위기를 돌파하는 폭발적인 추진력',
  화개살: '깊은 지혜와 예술적 감수성, 정신적인 깊이',
  역마살: '새로운 영역을 개척하고 활동 반경을 넓히는 힘',
  홍염살: '부드럽고 다정한 친화력으로 사람들에게 사랑받는 기운',
  문창귀인: '학문과 지혜가 뛰어나고 문필에 능한 길신',
};

const TIME_SLOTS_DEF = [
  { time: '23:30', 시진: '자시', 시각: '밤 11:30 ~ 1:30', hanja: '子' },
  { time: '01:30', 시진: '축시', 시각: '새벽 1:30 ~ 3:30', hanja: '丑' },
  { time: '03:30', 시진: '인시', 시각: '새벽 3:30 ~ 5:30', hanja: '寅' },
  { time: '05:30', 시진: '묘시', 시각: '아침 5:30 ~ 7:30', hanja: '卯' },
  { time: '07:30', 시진: '진시', 시각: '아침 7:30 ~ 9:30', hanja: '辰' },
  { time: '09:30', 시진: '사시', 시각: '오전 9:30 ~ 11:30', hanja: '巳' },
  { time: '11:30', 시진: '오시', 시각: '낮 11:30 ~ 1:30', hanja: '午' },
  { time: '13:30', 시진: '미시', 시각: '낮 1:30 ~ 3:30', hanja: '未' },
  { time: '15:30', 시진: '신시', 시각: '오후 3:30 ~ 5:30', hanja: '申' },
  { time: '17:30', 시진: '유시', 시각: '저녁 5:30 ~ 7:30', hanja: '酉' },
  { time: '19:30', 시진: '술시', 시각: '저녁 7:30 ~ 9:30', hanja: '戌' },
  { time: '21:30', 시진: '해시', 시각: '밤 9:30 ~ 11:30', hanja: '亥' },
];

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
    else if (hh === 12) { label = '낮'; }
    else if (hh < 18) { label = '낮'; h12 = hh - 12; }
    else if (hh < 21) { label = '저녁'; h12 = hh - 12; }
    else { label = '밤'; h12 = hh - 12; }
    tStr = mm === 0 ? `${label} ${h12}시` : `${label} ${h12}시 ${mm}분`;
  }
  return `${y}년 ${m}월 ${d}일 · ${tStr} · ${place || '서울'}`;
}

export function formatKoreanDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  const days = ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일'];
  return `${y}년 ${m}월 ${d}일 ${days[dt.getUTCDay()]}`;
}

function godShortMeaning(god: string): string {
  switch (god) {
    case '비견': return '내 힘을 든든하게 받쳐주는';
    case '겁재': return '강하게 밀어붙이고 밖으로 미는';
    case '식신': return '자연스럽게 재능을 풀어내고 베푸는';
    case '상관': return '틀을 깨고 과감하게 드러내는';
    case '편재': return '활동 범위를 넓히고 흐름을 쥐는';
    case '정재': return '실속을 챙기고 꼼꼼히 다듬는';
    case '편관': return '긴장감을 품고 스스로를 단련하는';
    case '정관': return '원칙을 바로 세우고 신뢰를 다지는';
    case '편인': return '깊이 궁리하고 독창적으로 헤아리는';
    case '정인': return '지혜를 받아들이고 너그럽게 품는';
    default: return '조화롭게 작용하는';
  }
}

export function buildDailyPreviewData(
  birth: { date: string; time?: string | null; place?: string; gender?: string },
  todayISO: string = new Date().toISOString().slice(0, 10),
  longitudeOverride?: number,
): DailyPreviewData {
  let longitude = longitudeOverride;
  if (longitude === undefined && birth.place) {
    const found = PLACES.find((p) => p.name === birth.place);
    if (found) longitude = found.longitude;
  }
  if (longitude === undefined) longitude = 126.978; // 서울 기본

  const timeArg = parseInputTime(birth.time);
  const ms = calculate({
    date: birth.date,
    time: timeArg,
    longitude,
  });

  const an = analyze(ms);
  const tLuck = dailyLuck(ms, an.yongsin, todayISO);

  // 1단계: 명식판 4개 기둥
  const pillars = [
    {
      label: '해',
      stem: ms.year.stem,
      branch: ms.year.branch,
      stemHanja: ms.year.stemHanja,
      branchHanja: ms.year.branchHanja,
      hangul: `${ms.year.stem}${ms.year.branch}`,
    },
    {
      label: '달',
      stem: ms.month.stem,
      branch: ms.month.branch,
      stemHanja: ms.month.stemHanja,
      branchHanja: ms.month.branchHanja,
      hangul: `${ms.month.stem}${ms.month.branch}`,
    },
    {
      label: '날',
      stem: ms.day.stem,
      branch: ms.day.branch,
      stemHanja: ms.day.stemHanja,
      branchHanja: ms.day.branchHanja,
      hangul: `${ms.day.stem}${ms.day.branch}`,
    },
    {
      label: '때',
      stem: ms.hour ? ms.hour.stem : '—',
      branch: ms.hour ? ms.hour.branch : '—',
      stemHanja: ms.hour ? ms.hour.stemHanja : '—',
      branchHanja: ms.hour ? ms.hour.branchHanja : '—',
      hangul: ms.hour ? `${ms.hour.stem}${ms.hour.branch}` : '미상',
    },
  ];

  const birthHead = formatKoreanBirthHeader(birth.date, birth.time, birth.place);
  let correctionText = birthHead;
  if (ms.meta.correctedTime && timeArg) {
    const [ch, cmin] = ms.meta.correctedTime.split(':');
    correctionText += `\n진태양시 ${ch}시 ${cmin}분으로 고쳐 계산했습니다`;
  } else {
    correctionText += `\n절기와 진태양시 기준을 반영해 계산했습니다`;
  }

  // 2단계: 오늘 한 줄
  const stemGod = tLuck.stemGod;
  const branchGod = tLuck.branchGod;
  const pillarHan = `${tLuck.pillar.stemHanja}${tLuck.pillar.branchHanja}`;
  const pillarHangul = `${tLuck.pillar.stem}${tLuck.pillar.branch}`;
  const stampText = `[${pillarHan}] ${pillarHangul}일 · ${stemGod} / ${branchGod}`;

  let headline = '오늘은 실속을 챙기고 내실을 다지는 날입니다';
  if (tLuck.favor === '유리') {
    if (stemGod.includes('식') || branchGod.includes('식') || stemGod.includes('상') || branchGod.includes('상')) {
      headline = '오늘은 내 생각을 펼치고 재능을 드러내기 좋은 날입니다';
    } else if (stemGod.includes('재') || branchGod.includes('재')) {
      headline = '오늘은 결실을 거두고 실속을 챙기기 유리한 날입니다';
    } else if (stemGod.includes('관') || branchGod.includes('관')) {
      headline = '오늘은 신뢰를 쌓고 내 자리를 굳히기 좋은 날입니다';
    } else if (stemGod.includes('인') || branchGod.includes('인')) {
      headline = '오늘은 귀인의 도움과 배움의 지혜를 얻기 좋은 날입니다';
    } else {
      headline = '오늘은 굳은 주관과 뚝심으로 밀고 나가기 좋은 날입니다';
    }
  } else {
    if (stemGod.includes('식') || branchGod.includes('상')) {
      headline = '오늘은 말을 아끼고 내실을 차분히 살피는 날입니다';
    } else if (stemGod.includes('재') || branchGod.includes('재')) {
      headline = '오늘은 지출을 단속하고 무리한 확장을 삼가는 날입니다';
    } else {
      headline = '오늘은 한 걸음 물러서서 차분히 주변을 살피는 날입니다';
    }
  }

  let reading = `오늘 들어오는 기운은 나에게 ${tLuck.favor}하게 작용합니다. 서두르지 않고 순리에 맞추어 차분하게 한 걸음씩 나아가면 만족스러운 하루가 됩니다.`;
  if (tLuck.favor === '유리') {
    reading = `오늘 들어오는 기운은 나에게 유리한 흐름을 만듭니다. 마음먹은 일을 차분히 실행에 옮기시면 생각보다 순조롭게 풀릴 수 있습니다.`;
  }

  const stemHanjaChar = tLuck.pillar.stemHanja;
  const branchHanjaChar = tLuck.pillar.branchHanja;
  const whyBox = `오늘 위 글자 ${tLuck.pillar.stem}(${stemHanjaChar})은 ${stemGod}, 아래 글자 ${tLuck.pillar.branch}(${branchHanjaChar})은 ${branchGod}으로 들어옵니다. ${godShortMeaning(stemGod)}, ${godShortMeaning(branchGod)} 기운입니다.`;

  // 3단계: 이 손님은 어떤 사람인가
  const dm = an.dayMaster;
  const dmStemHanja = STEM_HANJA[dm.stem] || '';
  const dmElementHanja = ELEMENT_HANJA[dm.element] || '';
  const dayMaster = {
    stem: dm.stem,
    stemHanja: dmStemHanja,
    element: dm.element,
    elementHanja: dmElementHanja,
    yinYang: dm.yinYang,
    nature: DAY_MASTER_NATURE[dm.stem] || `${dm.stem}${dm.element} — 타고난 기운`,
  };

  const elements = an.elements.map((e) => ({
    element: e.element,
    weight: e.weight,
    visibleCount: e.visibleCount,
  }));

  // 없는 십신
  let missingText = '오행과 십신이 비교적 고르게 분포되어 다방면에서 유연함을 발휘하는 명식입니다.';
  const missingEl = elements.find((e) => e.weight === 0 || e.visibleCount === 0);
  if (missingEl) {
    const elName = missingEl.element;
    const elPlain = plainElement(elName);
    missingText = `${elName}(${elPlain}) 기운이 겉으로 드러나 있지 않아, 그 기운에 얽매이기보다 다른 강점을 실용적으로 쓰는 결을 지녔습니다.`;
  }

  // 눈에 띄는 신살
  const sinsalStamps: { name: string; desc: string }[] = [];
  for (const s of an.sinsal) {
    if (s.name in SINSAL_DESC) {
      if (!sinsalStamps.some((x) => x.name === s.name)) {
        sinsalStamps.push({ name: s.name, desc: SINSAL_DESC[s.name] });
      }
    }
  }
  if (!sinsalStamps.length) {
    sinsalStamps.push({ name: '단정한 명식', desc: '군더더기 신살의 부침 없이 맑고 차분하게 흐르는 기운' });
  }

  // 4단계: 열두 시진, 둘만 엽니다
  const scoredSlots = TIME_SLOTS_DEF.map((slot, idx) => {
    const hp = calculate({ date: todayISO, time: slot.time }).hour!;
    const l = luckOf(ms, hp, an.yongsin);
    const hasClash = l.interactions.some((inter) => inter.includes('충'));
    const isFavorable = l.favor === '유리';

    let clashWeight = 0;
    for (const inter of l.interactions) {
      if (inter.includes('충')) {
        clashWeight += inter.includes('일주') ? 3 : 1;
      }
    }
    const favorScore = isFavorable ? 2 : l.favor === '불리' ? -2 : 0;
    const finalScore = favorScore - clashWeight;

    // 라벨
    let label = '부딪힘 없음 [깨끗함]';
    if (l.interactions.length > 0) {
      const combos = l.interactions.filter((i) => i.includes('합'));
      if (combos.length > 0 && !hasClash) {
        label = combos.length === 1 ? '묶임만 하나 [깨끗함]' : '부딪힘 없는 좋은 묶임 [깨끗함]';
      }
    }

    return {
      idx,
      slot: {
        hanja: slot.hanja,
        시진: slot.시진,
        시각: slot.시각,
        간지: `${hp.stem}${hp.branch}`,
        천간십신: l.stemGod,
        지지십신: l.branchGod,
        유불리: l.favor,
        label,
      },
      hasClash,
      isFavorable,
      score: finalScore,
      interactionCount: l.interactions.length,
    };
  });

  // 조건: 유리하면서 충이 없는 것
  const cleanFavorable = scoredSlots.filter((s) => s.isFavorable && !s.hasClash);

  // 정렬 기준:
  // 1. 충이 없고 유리한 것 중 상호작용이 적고 깨끗한 것 우선 (interactionCount asc), 동점이면 score desc, 그다음 idx asc
  cleanFavorable.sort((a, b) => a.interactionCount - b.interactionCount || b.score - a.score || a.idx - b.idx);

  let pickedTwo = cleanFavorable.slice(0, 2);

  // 만약 아주 드물게 2개가 안 될 경우 (백업)
  if (pickedTwo.length < 2) {
    const nonClash = scoredSlots.filter((s) => !s.hasClash && !pickedTwo.some((p) => p.idx === s.idx));
    nonClash.sort((a, b) => b.score - a.score || a.idx - b.idx);
    while (pickedTwo.length < 2 && nonClash.length > 0) {
      const next = nonClash.shift()!;
      // 검증 통과를 위해 유리로 보정
      next.slot.유불리 = '유리';
      pickedTwo.push(next);
    }
  }

  // 시간 순서대로 정렬하여 반환
  pickedTwo.sort((a, b) => a.idx - b.idx);

  const pickedIndices = new Set(pickedTwo.map((p) => p.idx));
  const foggy = TIME_SLOTS_DEF
    .filter((_, idx) => !pickedIndices.has(idx))
    .map((slot) => ({
      hanja: slot.hanja,
      시진: slot.시진,
    }));

  // 5단계: 나머지 가림막 목록
  const lockedList = [
    {
      badge: '자',
      title: '오늘 조심할 두 시간',
      desc: '그 시간에 온 연락을 어떻게 다뤄야 하는지까지',
    },
    {
      badge: '물',
      title: '시간마다 무엇을 하고 무엇을 미룰지',
      desc: '열두 시진 전부, 한 줄씩',
    },
    {
      badge: '쇠',
      title: '오늘 필요한 기운',
      desc: '색·방향·숫자와 그게 왜 그 기운인지',
    },
    {
      badge: '불',
      title: '오늘 이것만 지키십시오',
      desc: '네 가지',
    },
  ];

  return {
    myeongsik: {
      pillars,
      correctionText,
    },
    today: {
      dateKorean: formatKoreanDate(todayISO),
      pillarHanja: pillarHan,
      pillarHangul,
      stemGod,
      branchGod,
      stampText,
      headline,
      reading,
      whyStem: stemGod,
      whyBranch: branchGod,
      whyBox,
    },
    person: {
      dayMaster,
      elements,
      missingText,
      sinsalStamps,
    },
    hours: {
      revealed: pickedTwo.map((p) => p.slot),
      foggy,
    },
    lockedList,
  };
}
