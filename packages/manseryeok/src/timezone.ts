/**
 * 한국 표준시 이력, 서머타임, 진태양시 보정.
 *
 * 사주에서 시주(時柱)는 표준시가 아니라 그 지점의 실제 태양 위치로 정해야 한다.
 * 한국은 표준자오선이 두 번 바뀌었고 서머타임도 12차례 시행돼서,
 * 이 보정을 빼먹으면 특정 연도 출생자의 시주가 통째로 어긋난다.
 */

/** 한국 표준자오선 변천. offsetMinutes는 UTC 기준. */
const MERIDIAN_HISTORY: { from: string; to: string; meridian: number; offsetMinutes: number }[] = [
  { from: '1908-04-01', to: '1911-12-31', meridian: 127.5, offsetMinutes: 510 }, // UTC+8:30
  { from: '1912-01-01', to: '1954-03-20', meridian: 135.0, offsetMinutes: 540 }, // UTC+9
  { from: '1954-03-21', to: '1961-08-09', meridian: 127.5, offsetMinutes: 510 }, // UTC+8:30
  { from: '1961-08-10', to: '2999-12-31', meridian: 135.0, offsetMinutes: 540 }, // UTC+9
];

/**
 * 한국 서머타임 시행 구간 (구간 내 출생자는 시계가 1시간 앞서 있으므로 −60분).
 * 경계일의 정확한 시각까지는 반영하지 않았다 — 시행 첫날/마지막날 출생자는
 * 별도 확인이 필요하며, meta.dstApplied 로 노출해 사용자가 알 수 있게 한다.
 */
const DST_PERIODS: [string, string][] = [
  ['1948-06-01', '1948-09-12'],
  ['1949-04-03', '1949-09-10'],
  ['1950-04-01', '1950-09-10'],
  ['1951-05-06', '1951-09-08'],
  ['1955-05-05', '1955-09-08'],
  ['1956-05-20', '1956-09-29'],
  ['1957-05-05', '1957-09-21'],
  ['1958-05-04', '1958-09-20'],
  ['1959-05-03', '1959-09-19'],
  ['1960-05-01', '1960-09-17'],
  ['1987-05-10', '1987-10-11'],
  ['1988-05-08', '1988-10-09'],
];

export interface TimeContext {
  /** 그날 적용된 표준자오선 (도) */
  meridian: number;
  /** 표준시의 UTC 오프셋 (분) */
  utcOffsetMinutes: number;
  /** 서머타임 적용 여부 */
  dstApplied: boolean;
}

export function timeContextFor(dateISO: string): TimeContext {
  const era =
    MERIDIAN_HISTORY.find((e) => dateISO >= e.from && dateISO <= e.to) ??
    MERIDIAN_HISTORY[MERIDIAN_HISTORY.length - 1];
  const dstApplied = DST_PERIODS.some(([a, b]) => dateISO >= a && dateISO <= b);
  return { meridian: era.meridian, utcOffsetMinutes: era.offsetMinutes, dstApplied };
}

/**
 * 균시차(equation of time), 단위 분.
 * 실제 태양시와 평균 태양시의 차이로, 연중 −14분 ~ +16분 범위로 변한다.
 * 절기 경계나 시주 경계 근처 출생자에게는 이 값이 결과를 바꿀 수 있다.
 */
export function equationOfTime(jd: number): number {
  const t = (jd - 2451545) / 36525;
  const DEG = Math.PI / 180;

  const l0 = 280.4664567 + 360007.6982779 * (t / 10) + 0.03032028 * (t / 10) ** 2;
  const m = 357.52911 + 35999.05029 * t - 0.0001537 * t * t;
  const e = 0.016708634 - 0.000042037 * t - 0.0000001267 * t * t;
  const eps = 23.439291 - 0.0130042 * t;
  const y = Math.tan((eps / 2) * DEG) ** 2;

  const l0r = l0 * DEG;
  const mr = m * DEG;

  const eq =
    y * Math.sin(2 * l0r) -
    2 * e * Math.sin(mr) +
    4 * e * y * Math.sin(mr) * Math.cos(2 * l0r) -
    0.5 * y * y * Math.sin(4 * l0r) -
    1.25 * e * e * Math.sin(2 * mr);

  return (eq / DEG) * 4; // 도 → 분
}

/**
 * 시계 시각 → 진태양시 보정 성분을 분 단위로 분해해서 돌려준다.
 *
 * 성분을 나눠 반환하는 이유: 사용자가 진태양시 보정을 끄더라도
 * 서머타임 보정은 반드시 적용돼야 하기 때문이다. 둘은 성격이 다르다.
 *   - dst: 시계가 1시간 앞당겨져 있던 기간의 되돌림 (선택 불가, 항상 적용)
 *   - meridian: 표준자오선과 출생지 경도의 차이 (진태양시 보정)
 *   - eot: 균시차, 실제 태양과 평균 태양의 차이 (진태양시 보정)
 */
export function correctionComponents(
  ctx: TimeContext,
  longitude: number,
  jd: number,
  useEquationOfTime: boolean,
): { dst: number; meridian: number; eot: number } {
  return {
    dst: ctx.dstApplied ? -60 : 0,
    meridian: (longitude - ctx.meridian) * 4,
    eot: useEquationOfTime ? equationOfTime(jd) : 0,
  };
}
