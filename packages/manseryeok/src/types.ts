import type { Pillar } from './ganzhi.ts';

/** 자시(23:00~00:59) 처리 방식. 유파마다 달라 정답이 없으므로 선택지로 노출한다. */
export type YajaMode =
  /** 00:00을 날짜 경계로 본다. 23시대는 당일 일주 + 자시. (현대 통용) */
  | 'midnight'
  /** 23:00을 날짜 경계로 본다. 23시대는 익일 일주 + 자시. (야자시설) */
  | 'yaja';

export interface BirthInput {
  /** 양력 'YYYY-MM-DD' */
  date: string;
  /** 'HH:mm'. 출생시각을 모르면 null — 시주가 생략된다. */
  time: string | null;
  /** 출생지 경도. 기본 서울 126.978 */
  longitude?: number;
  /** 기본 'midnight' */
  yajaMode?: YajaMode;
  /** 진태양시 보정 적용 여부. 기본 true */
  applyTrueSolarTime?: boolean;
  /** 균시차까지 반영할지. 기본 true */
  applyEquationOfTime?: boolean;
}

export interface MyeongsikMeta {
  /** 입력받은 시계 시각 */
  inputTime: string | null;
  /** 진태양시로 보정한 시각 */
  correctedTime: string | null;
  /** 보정으로 날짜가 넘어갔으면 그 날짜 */
  correctedDate: string;
  /** 시계 → 진태양시 총 보정량 (분) */
  solarTimeOffsetMin: number;
  /** 그날 적용된 표준자오선 */
  standardMeridian: number;
  /** 서머타임 적용 여부 */
  dstApplied: boolean;
  /** 이 명식을 지배하는 절 */
  monthTermName: string;
  monthTermHanja: string;
  /** 그 절의 절입시각 (KST 시계 시각) */
  monthTermEnteredAt: string;
  /** 절입시각까지 남은/지난 시간 (분). 음수면 이미 지났다. */
  minutesFromMonthTerm: number;
  /** 입춘 기준 연도 */
  solarYear: number;
  /** 그 해 입춘 시각 (KST) */
  ipchunAt: string;
  /** 태양 겉보기 황경 (도) */
  solarLongitude: number;
  /** 자시 처리 방식 */
  yajaMode: string;
  /** 야자시 구간(23:00~23:59) 출생 여부 */
  isYajaHour: boolean;
}

export interface Myeongsik {
  year: Pillar;
  month: Pillar;
  day: Pillar;
  hour: Pillar | null;
  meta: MyeongsikMeta;
}
