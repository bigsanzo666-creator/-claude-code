/**
 * 24절기. 각 절기는 태양 겉보기 황경이 특정 각도에 도달하는 순간으로 정의된다.
 *
 * 이 중 12개의 '절(節)'이 사주의 월 경계다. 나머지 12개 '기(氣)'는 월 중간에 온다.
 * 달력의 1월/2월이 아니라 이 절기가 월주를 정한다 — 사주 계산의 출발점.
 */

export interface SolarTerm {
  name: string;
  hanja: string;
  /** 태양 겉보기 황경 (도) */
  longitude: number;
  /** true면 절(節) — 월의 시작 */
  isMonthStart: boolean;
  /** 절인 경우 그 월의 순번. 인월=1 … 축월=12 */
  monthOrdinal?: number;
}

export const SOLAR_TERMS: SolarTerm[] = [
  { name: '입춘', hanja: '立春', longitude: 315, isMonthStart: true, monthOrdinal: 1 },
  { name: '우수', hanja: '雨水', longitude: 330, isMonthStart: false },
  { name: '경칩', hanja: '驚蟄', longitude: 345, isMonthStart: true, monthOrdinal: 2 },
  { name: '춘분', hanja: '春分', longitude: 0, isMonthStart: false },
  { name: '청명', hanja: '淸明', longitude: 15, isMonthStart: true, monthOrdinal: 3 },
  { name: '곡우', hanja: '穀雨', longitude: 30, isMonthStart: false },
  { name: '입하', hanja: '立夏', longitude: 45, isMonthStart: true, monthOrdinal: 4 },
  { name: '소만', hanja: '小滿', longitude: 60, isMonthStart: false },
  { name: '망종', hanja: '芒種', longitude: 75, isMonthStart: true, monthOrdinal: 5 },
  { name: '하지', hanja: '夏至', longitude: 90, isMonthStart: false },
  { name: '소서', hanja: '小暑', longitude: 105, isMonthStart: true, monthOrdinal: 6 },
  { name: '대서', hanja: '大暑', longitude: 120, isMonthStart: false },
  { name: '입추', hanja: '立秋', longitude: 135, isMonthStart: true, monthOrdinal: 7 },
  { name: '처서', hanja: '處暑', longitude: 150, isMonthStart: false },
  { name: '백로', hanja: '白露', longitude: 165, isMonthStart: true, monthOrdinal: 8 },
  { name: '추분', hanja: '秋分', longitude: 180, isMonthStart: false },
  { name: '한로', hanja: '寒露', longitude: 195, isMonthStart: true, monthOrdinal: 9 },
  { name: '상강', hanja: '霜降', longitude: 210, isMonthStart: false },
  { name: '입동', hanja: '立冬', longitude: 225, isMonthStart: true, monthOrdinal: 10 },
  { name: '소설', hanja: '小雪', longitude: 240, isMonthStart: false },
  { name: '대설', hanja: '大雪', longitude: 255, isMonthStart: true, monthOrdinal: 11 },
  { name: '동지', hanja: '冬至', longitude: 270, isMonthStart: false },
  { name: '소한', hanja: '小寒', longitude: 285, isMonthStart: true, monthOrdinal: 12 },
  { name: '대한', hanja: '大寒', longitude: 300, isMonthStart: false },
];

const MONTH_STARTS = SOLAR_TERMS.filter((t) => t.isMonthStart);

/**
 * 태양 황경으로부터 그 시점을 지배하는 절(월의 시작)을 찾는다.
 * 입춘(315°)을 0으로 놓고 30도씩 끊으면 월 순번이 바로 나온다.
 */
export function monthTermFor(longitudeDeg: number): SolarTerm {
  const shifted = ((longitudeDeg - 315) % 360 + 360) % 360;
  const index = Math.floor(shifted / 30);
  return MONTH_STARTS[index];
}
