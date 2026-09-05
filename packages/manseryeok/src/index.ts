/**
 * 만세력 엔진 — 생년월일시로부터 사주 명식(네 기둥)을 계산한다.
 *
 * 설계 원칙:
 *  1. 계산은 전부 결정론적이다. LLM은 이 결과를 문장으로 옮기는 데만 쓴다.
 *  2. 계산 근거(meta)를 반드시 함께 반환한다. 서비스마다 명식이 다른 것이
 *     사용자 불신의 원인이므로, 우리는 왜 이렇게 나왔는지 화면에 공개한다.
 *  3. 유파에 따라 갈리는 지점(자시 처리)은 임의로 정하지 않고 옵션으로 노출한다.
 */

import { toJulianDay, fromJulianDay, apparentSolarLongitude, deltaT, solveSolarLongitude } from './astro.ts';
import { timeContextFor, correctionComponents } from './timezone.ts';
import { monthTermFor } from './solarTerms.ts';
import { yearPillar, monthPillar, dayPillar, hourPillar, hourBranchIndexOf } from './ganzhi.ts';
import type { BirthInput, Myeongsik } from './types.ts';

export * from './ganzhi.ts';
export * from './solarTerms.ts';
export * from './astro.ts';
export type { BirthInput, Myeongsik, MyeongsikMeta, YajaMode } from './types.ts';

const SEOUL_LONGITUDE = 126.978;

function parseDate(iso: string): { y: number; m: number; d: number } {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!match) throw new Error(`날짜 형식이 올바르지 않습니다: ${iso} (YYYY-MM-DD)`);
  return { y: +match[1], m: +match[2], d: +match[3] };
}

function parseTime(hhmm: string): number {
  const match = /^(\d{1,2}):(\d{2})$/.exec(hhmm);
  if (!match) throw new Error(`시각 형식이 올바르지 않습니다: ${hhmm} (HH:mm)`);
  const h = +match[1];
  const min = +match[2];
  if (h > 23 || min > 59) throw new Error(`시각 범위를 벗어났습니다: ${hhmm}`);
  return h * 60 + min;
}

const pad = (n: number, width = 2) => String(Math.floor(n)).padStart(width, '0');

function formatMinutes(totalMin: number): string {
  const m = ((totalMin % 1440) + 1440) % 1440;
  return `${pad(m / 60)}:${pad(m % 60)}`;
}

function formatDate(y: number, m: number, d: number): string {
  return `${pad(y, 4)}-${pad(m)}-${pad(d)}`;
}

/** UT 기준 JD를 그 시대의 한국 시계 시각 문자열로 변환한다. */
function formatAsLocalClock(jdUt: number): string {
  // 대략적인 현지 날짜를 먼저 구해 그 시대의 오프셋을 찾는다
  const rough = fromJulianDay(jdUt + 9 / 24);
  const ctx = timeContextFor(formatDate(rough.y, rough.m, Math.floor(rough.d)));
  const offsetMin = ctx.utcOffsetMinutes + (ctx.dstApplied ? 60 : 0);

  const local = fromJulianDay(jdUt + offsetMin / 1440);
  const day = Math.floor(local.d);
  const minutesOfDay = Math.round((local.d - day) * 1440);
  // 반올림으로 24:00이 되면 다음날로 넘긴다
  if (minutesOfDay >= 1440) {
    const next = fromJulianDay(jdUt + offsetMin / 1440 + 1 / 1440);
    return `${formatDate(next.y, next.m, Math.floor(next.d))} 00:00`;
  }
  return `${formatDate(local.y, local.m, day)} ${formatMinutes(minutesOfDay)}`;
}

/** UT 기준 JD에서의 태양 겉보기 황경. */
function solarLongitudeAtUT(jdUt: number): number {
  const { y, m } = fromJulianDay(jdUt);
  return apparentSolarLongitude(jdUt + deltaT(y, m) / 86400);
}

export function calculate(input: BirthInput): Myeongsik {
  const {
    date,
    time,
    longitude = SEOUL_LONGITUDE,
    yajaMode = 'midnight',
    applyTrueSolarTime = true,
    applyEquationOfTime = true,
  } = input;

  const { y, m, d } = parseDate(date);
  const timeKnown = time !== null && time !== undefined;
  // 시각을 모르면 정오로 가정한다 (연·월·일주는 그대로 유효, 시주만 생략)
  const clockMinutes = timeKnown ? parseTime(time) : 12 * 60;

  const ctx = timeContextFor(date);
  const clockOffsetFromUtc = ctx.utcOffsetMinutes + (ctx.dstApplied ? 60 : 0);

  const jdAtMidnight = toJulianDay(y, m, d);
  const jdUt = jdAtMidnight + (clockMinutes - clockOffsetFromUtc) / 1440;

  // ── 시각 보정 ────────────────────────────────────────────────
  const parts = correctionComponents(ctx, longitude, jdUt, applyEquationOfTime);
  // 서머타임 되돌림은 진태양시 옵션과 무관하게 항상 적용한다
  const totalOffset = parts.dst + (applyTrueSolarTime ? parts.meridian + parts.eot : 0);

  const shiftedMinutes = clockMinutes + totalOffset;
  const dayShift = Math.floor(shiftedMinutes / 1440);
  const trueSolarMinutes = shiftedMinutes - dayShift * 1440;

  // ── 절기 ─────────────────────────────────────────────────────
  const lambda = solarLongitudeAtUT(jdUt);
  const term = monthTermFor(lambda);

  const daysSinceTerm = (((lambda - term.longitude) % 360) + 360) % 360 / 0.9856473;
  const termEnteredJd = solveSolarLongitude(term.longitude, jdUt - daysSinceTerm);

  // 다음 절까지의 거리도 구한다 — 대운수(大運數) 계산에 필요하다.
  // 순행 대운은 다음 절까지, 역행 대운은 이전 절부터의 시간을 쓴다.
  const nextLongitude = (term.longitude + 30) % 360;
  const nextTerm = monthTermFor(nextLongitude);
  const nextTermJd = solveSolarLongitude(nextLongitude, termEnteredJd + 30.44);

  // ── 연주: 입춘 기준 ──────────────────────────────────────────
  const ipchunJd = solveSolarLongitude(315, toJulianDay(y, 2, 4));
  const solarYear = jdUt < ipchunJd ? y - 1 : y;

  const yPillar = yearPillar(solarYear);
  const mPillar = monthPillar(yPillar.stemIndex, term.monthOrdinal!);

  // ── 일주 ─────────────────────────────────────────────────────
  // JDN은 해당 날짜 정오의 율리우스일수(정수)
  let jdn = jdAtMidnight + 0.5 + dayShift;
  const isYajaHour = trueSolarMinutes >= 23 * 60;
  if (yajaMode === 'yaja' && isYajaHour) jdn += 1;

  const dPillar = dayPillar(jdn);

  // ── 시주 ─────────────────────────────────────────────────────
  const hPillar = timeKnown
    ? hourPillar(
        dPillar.stemIndex,
        hourBranchIndexOf(Math.floor(trueSolarMinutes / 60), trueSolarMinutes % 60),
      )
    : null;

  const corrected = fromJulianDay(jdAtMidnight + 0.5 + dayShift);

  return {
    year: yPillar,
    month: mPillar,
    day: dPillar,
    hour: hPillar,
    meta: {
      inputTime: timeKnown ? time : null,
      correctedTime: timeKnown ? formatMinutes(trueSolarMinutes) : null,
      correctedDate: formatDate(corrected.y, corrected.m, Math.floor(corrected.d)),
      solarTimeOffsetMin: Math.round(totalOffset * 100) / 100,
      standardMeridian: ctx.meridian,
      dstApplied: ctx.dstApplied,
      monthTermName: term.name,
      monthTermHanja: term.hanja,
      monthTermEnteredAt: formatAsLocalClock(termEnteredJd),
      minutesFromMonthTerm: Math.round((jdUt - termEnteredJd) * 1440),
      nextTermName: nextTerm.name,
      nextTermEnteredAt: formatAsLocalClock(nextTermJd),
      minutesToNextTerm: Math.round((nextTermJd - jdUt) * 1440),
      solarYear,
      ipchunAt: formatAsLocalClock(ipchunJd),
      solarLongitude: Math.round(lambda * 1e6) / 1e6,
      yajaMode,
      isYajaHour,
    },
  };
}

/** 명식을 사람이 읽는 한 줄로. 디버깅과 검증 출력용. */
export function formatMyeongsik(ms: Myeongsik): string {
  const cell = (p: { stem: string; branch: string } | null) =>
    p ? `${p.stem}${p.branch}` : '—';
  return `${cell(ms.year)} ${cell(ms.month)} ${cell(ms.day)} ${cell(ms.hour)}`;
}
