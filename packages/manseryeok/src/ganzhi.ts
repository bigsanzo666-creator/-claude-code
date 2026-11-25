/** 천간·지지와 60갑자 계산. */

export const STEMS = ['갑', '을', '병', '정', '무', '기', '경', '신', '임', '계'] as const;
export const BRANCHES = ['자', '축', '인', '묘', '진', '사', '오', '미', '신', '유', '술', '해'] as const;

export const STEMS_HANJA = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'] as const;
export const BRANCHES_HANJA = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'] as const;

/** 천간의 오행 (목화토금수) */
export const STEM_ELEMENT = ['목', '목', '화', '화', '토', '토', '금', '금', '수', '수'] as const;
/** 지지의 오행 */
export const BRANCH_ELEMENT = ['수', '토', '목', '목', '토', '화', '화', '토', '금', '금', '토', '수'] as const;

/** 천간의 음양 (짝수 인덱스가 양) */
export const STEM_YINYANG = ['양', '음', '양', '음', '양', '음', '양', '음', '양', '음'] as const;

export interface Pillar {
  stem: string;
  branch: string;
  stemHanja: string;
  branchHanja: string;
  stemIndex: number;
  branchIndex: number;
  /** 60갑자 순번 (0-59) */
  sexagenary: number;
  element: { stem: string; branch: string };
}

export function makePillar(stemIndex: number, branchIndex: number): Pillar {
  const s = ((stemIndex % 10) + 10) % 10;
  const b = ((branchIndex % 12) + 12) % 12;
  // 60갑자 순번: 천간과 지지가 동시에 맞는 지점
  let sexagenary = 0;
  for (let i = 0; i < 60; i++) {
    if (i % 10 === s && i % 12 === b) {
      sexagenary = i;
      break;
    }
  }
  return {
    stem: STEMS[s],
    branch: BRANCHES[b],
    stemHanja: STEMS_HANJA[s],
    branchHanja: BRANCHES_HANJA[b],
    stemIndex: s,
    branchIndex: b,
    sexagenary,
    element: { stem: STEM_ELEMENT[s], branch: BRANCH_ELEMENT[b] },
  };
}

/**
 * 연주. 입춘을 기준으로 넘어간 "절기 연도"를 받는다.
 * 1984년이 갑자년인 것을 기준점으로 삼는다.
 */
export function yearPillar(solarYear: number): Pillar {
  return makePillar(solarYear - 4, solarYear - 4);
}

/**
 * 월주. monthOrdinal은 인월=1, 묘월=2 … 축월=12.
 * 천간은 오호둔(五虎遁): 갑·기년→병인월, 을·경년→무인월, 병·신년→경인월,
 * 정·임년→임인월, 무·계년→갑인월.
 */
export function monthPillar(yearStemIndex: number, monthOrdinal: number): Pillar {
  const branchIndex = (monthOrdinal + 1) % 12; // 인(2)부터 시작
  const stemIndex = yearStemIndex * 2 + monthOrdinal + 1;
  return makePillar(stemIndex, branchIndex);
}

/**
 * 일주. jdn은 그 지역 날짜 정오의 율리우스일수(정수).
 * 기준 검산: 2000-01-01(JDN 2451545)은 무오일.
 */
export function dayPillar(jdn: number): Pillar {
  return makePillar(jdn + 9, jdn + 1);
}

/**
 * 시주. hourBranchIndex는 자시=0 … 해시=11.
 * 천간은 오서둔(五鼠遁): 갑·기일→갑자시, 을·경일→병자시, 병·신일→무자시,
 * 정·임일→경자시, 무·계일→임자시.
 */
export function hourPillar(dayStemIndex: number, hourBranchIndex: number): Pillar {
  return makePillar(dayStemIndex * 2 + hourBranchIndex, hourBranchIndex);
}

/** 진태양시 시각(시, 분)으로부터 시지 인덱스. 23:00~00:59가 자시. */
export function hourBranchIndexOf(hour: number, minute: number): number {
  const totalMin = hour * 60 + minute;
  // 23:00을 0으로 맞추고 2시간 단위로 끊는다
  return Math.floor((((totalMin + 60) % 1440) / 120)) % 12;
}
