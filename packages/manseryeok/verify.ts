/**
 * 만세력 엔진 검증.
 *
 * 두 종류의 테스트가 있다:
 *  A. 천문 정확도 — 계산한 절기 시각이 공표된 값과 맞는가
 *  B. 경계 동작   — 절입/자시/서머타임 경계에서 명식이 규칙대로 바뀌는가
 *
 * B가 통과해도 A가 틀리면 전체가 무의미하므로 A를 먼저 돌린다.
 */

import { calculate, formatMyeongsik, solveSolarLongitude, toJulianDay, fromJulianDay } from './src/index.ts';

let passed = 0;
let failed = 0;
const failures: string[] = [];

function check(label: string, ok: boolean, detail = '') {
  if (ok) {
    passed++;
    console.log(`  ✓ ${label}${detail ? `  ${detail}` : ''}`);
  } else {
    failed++;
    failures.push(label);
    console.log(`  ✗ ${label}${detail ? `  ${detail}` : ''}`);
  }
}

function section(title: string) {
  console.log(`\n${title}`);
  console.log('─'.repeat(60));
}

/** UT 기준 JD를 'YYYY-MM-DD HH:mm' UTC 문자열로 */
function utcString(jd: number): string {
  const { y, m, d } = fromJulianDay(jd);
  const day = Math.floor(d);
  const mins = Math.round((d - day) * 1440);
  const p = (n: number, w = 2) => String(n).padStart(w, '0');
  return `${p(y, 4)}-${p(m)}-${p(day)} ${p(Math.floor(mins / 60))}:${p(mins % 60)}`;
}

// ── A. 천문 정확도 ─────────────────────────────────────────────
// 분점·지점은 공표값이 가장 잘 알려져 있어 기준으로 삼기 좋다. (UTC)
section('A. 절기 시각 정확도 — 분점/지점 공표값 대조 (UTC, 허용오차 3분)');

const ASTRO_CASES: { name: string; lonDeg: number; guess: [number, number, number]; expected: string }[] = [
  { name: '2000 춘분', lonDeg: 0,   guess: [2000, 3, 20],  expected: '2000-03-20 07:35' },
  { name: '2020 춘분', lonDeg: 0,   guess: [2020, 3, 20],  expected: '2020-03-20 03:50' },
  { name: '2024 춘분', lonDeg: 0,   guess: [2024, 3, 20],  expected: '2024-03-20 03:06' },
  { name: '2024 하지', lonDeg: 90,  guess: [2024, 6, 20],  expected: '2024-06-20 20:51' },
  { name: '2024 추분', lonDeg: 180, guess: [2024, 9, 22],  expected: '2024-09-22 12:44' },
  { name: '2024 동지', lonDeg: 270, guess: [2024, 12, 21], expected: '2024-12-21 09:21' },
  { name: '2025 춘분', lonDeg: 0,   guess: [2025, 3, 20],  expected: '2025-03-20 09:01' },
];

for (const c of ASTRO_CASES) {
  const jd = solveSolarLongitude(c.lonDeg, toJulianDay(...c.guess));
  const got = utcString(jd);
  const diffMin = Math.abs(
    (jd - (toJulianDay(+c.expected.slice(0, 4), +c.expected.slice(5, 7), +c.expected.slice(8, 10)) +
      (+c.expected.slice(11, 13) * 60 + +c.expected.slice(14, 16)) / 1440)) * 1440,
  );
  check(c.name, diffMin <= 3, `계산 ${got} / 공표 ${c.expected} (차 ${diffMin.toFixed(1)}분)`);
}

// ── B1. 일주 기준점 ────────────────────────────────────────────
section('B1. 일주 60갑자 기준점');

const day2000 = calculate({ date: '2000-01-01', time: '12:00' });
check('2000-01-01은 무오일', day2000.day.stem === '무' && day2000.day.branch === '오',
  `→ ${day2000.day.stem}${day2000.day.branch}`);

// 일주는 하루에 정확히 하나씩 진행해야 한다
const d1 = calculate({ date: '2024-03-01', time: '12:00' }).day.sexagenary;
const d2 = calculate({ date: '2024-03-02', time: '12:00' }).day.sexagenary;
check('일주는 하루 1갑자씩 진행', (d1 + 1) % 60 === d2, `${d1} → ${d2}`);

// 60일 뒤 같은 일주
const d3 = calculate({ date: '2024-04-30', time: '12:00' }).day.sexagenary;
check('60일 주기 순환', d1 === d3, `3/1=${d1}, 4/30=${d3}`);

// ── B2. 연주 기준점 ────────────────────────────────────────────
section('B2. 연주 — 1984년은 갑자년');

const y1984 = calculate({ date: '1984-06-01', time: '12:00' });
check('1984-06-01 → 갑자년', y1984.year.stem === '갑' && y1984.year.branch === '자',
  `→ ${y1984.year.stem}${y1984.year.branch}`);

const y2024 = calculate({ date: '2024-06-01', time: '12:00' });
check('2024-06-01 → 갑진년', y2024.year.stem === '갑' && y2024.year.branch === '진',
  `→ ${y2024.year.stem}${y2024.year.branch}`);

// ── B3. 입춘 경계 ──────────────────────────────────────────────
section('B3. 입춘 경계 — 연주가 바뀌는 순간');

const probe = calculate({ date: '2024-02-04', time: '12:00', applyTrueSolarTime: false });
const ipchun = probe.meta.ipchunAt; // 'YYYY-MM-DD HH:mm'
console.log(`  · 2024 입춘: ${ipchun} (KST)`);

const ipchunDate = ipchun.slice(0, 10);
const ipchunMin = +ipchun.slice(11, 13) * 60 + +ipchun.slice(14, 16);
const fmt = (min: number) => `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;

const before = calculate({ date: ipchunDate, time: fmt(ipchunMin - 2), applyTrueSolarTime: false });
const after = calculate({ date: ipchunDate, time: fmt(ipchunMin + 2), applyTrueSolarTime: false });

check('입춘 직전은 전년(계묘)', before.year.stem === '계' && before.year.branch === '묘',
  `→ ${before.year.stem}${before.year.branch}`);
check('입춘 직후는 당년(갑진)', after.year.stem === '갑' && after.year.branch === '진',
  `→ ${after.year.stem}${after.year.branch}`);
check('입춘 경계에서 월주도 축→인', before.month.branch === '축' && after.month.branch === '인',
  `${before.month.stem}${before.month.branch} → ${after.month.stem}${after.month.branch}`);
check('입춘 직전 일주는 그대로', before.day.sexagenary === after.day.sexagenary);

// ── B4. 12개 절 모두 월지가 규칙대로 배정되는가 ────────────────
section('B4. 12절 → 월지 배정');

const EXPECTED_BRANCH: Record<string, string> = {
  입춘: '인', 경칩: '묘', 청명: '진', 입하: '사', 망종: '오', 소서: '미',
  입추: '신', 백로: '유', 한로: '술', 입동: '해', 대설: '자', 소한: '축',
};
let branchOk = true;
const seen = new Set<string>();
for (let month = 1; month <= 12; month++) {
  for (const day of [8, 23]) {
    const r = calculate({ date: `2024-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`, time: '12:00' });
    seen.add(r.meta.monthTermName);
    if (EXPECTED_BRANCH[r.meta.monthTermName] !== r.month.branch) {
      branchOk = false;
      console.log(`    ! 2024-${month}-${day}: ${r.meta.monthTermName}인데 월지가 ${r.month.branch}`);
    }
  }
}
check('24개 표본 전부 절기-월지 일치', branchOk);
check('12절이 모두 등장', seen.size === 12, `${seen.size}개 관측`);

// ── B5. 자시 처리 ──────────────────────────────────────────────
section('B5. 야자시 / 조자시');

const base = { date: '2024-06-15', longitude: 126.978, applyTrueSolarTime: false } as const;
const at2259 = calculate({ ...base, time: '22:59' });
const at2300 = calculate({ ...base, time: '23:00' });
const at2300y = calculate({ ...base, time: '23:00', yajaMode: 'yaja' });
const at0030 = calculate({ ...base, time: '00:30' });

check('22:59는 해시', at2259.hour!.branch === '해', `→ ${at2259.hour!.stem}${at2259.hour!.branch}`);
check('23:00은 자시', at2300.hour!.branch === '자', `→ ${at2300.hour!.stem}${at2300.hour!.branch}`);
check('00:30도 자시', at0030.hour!.branch === '자', `→ ${at0030.hour!.stem}${at0030.hour!.branch}`);
check('midnight 모드: 23시대 일주는 당일 유지',
  at2300.day.sexagenary === at2259.day.sexagenary,
  `${at2259.day.stem}${at2259.day.branch} = ${at2300.day.stem}${at2300.day.branch}`);
check('yaja 모드: 23시대 일주는 익일로 넘어감',
  at2300y.day.sexagenary === (at2300.day.sexagenary + 1) % 60,
  `${at2300.day.stem}${at2300.day.branch} → ${at2300y.day.stem}${at2300y.day.branch}`);
check('yaja 모드에서 시간도 익일 기준으로 재계산',
  at2300y.hour!.stem !== at2300.hour!.stem,
  `${at2300.hour!.stem}${at2300.hour!.branch} → ${at2300y.hour!.stem}${at2300y.hour!.branch}`);
check('야자시 구간 플래그', at2300.meta.isYajaHour && !at2259.meta.isYajaHour);

// 12시진이 모두 순서대로 나오는가
let hourOk = true;
const HOUR_ORDER = ['자','축','인','묘','진','사','오','미','신','유','술','해'];
for (let h = 0; h < 24; h++) {
  const r = calculate({ ...base, time: `${String(h).padStart(2, '0')}:30` });
  const expected = HOUR_ORDER[Math.floor(((h * 60 + 30 + 60) % 1440) / 120)];
  if (r.hour!.branch !== expected) {
    hourOk = false;
    console.log(`    ! ${h}:30 → ${r.hour!.branch} (기대 ${expected})`);
  }
}
check('24시간 전부 시지가 올바름', hourOk);

// ── B6. 서머타임 ───────────────────────────────────────────────
section('B6. 서머타임 (1987-1988, 1948-1960)');

const dst1987 = calculate({ date: '1987-07-15', time: '12:00' });
const nonDst1987 = calculate({ date: '1987-11-15', time: '12:00' });
check('1987-07-15는 서머타임 구간', dst1987.meta.dstApplied);
check('1987-11-15는 아님', !nonDst1987.meta.dstApplied);
check('서머타임 보정이 −60분 포함',
  Math.abs(dst1987.meta.solarTimeOffsetMin - (nonDst1987.meta.solarTimeOffsetMin)) > 55,
  `${dst1987.meta.solarTimeOffsetMin.toFixed(1)}분 vs ${nonDst1987.meta.solarTimeOffsetMin.toFixed(1)}분`);

const dst1988 = calculate({ date: '1988-08-01', time: '12:00' });
check('1988-08-01도 서머타임', dst1988.meta.dstApplied);
const dst1955 = calculate({ date: '1955-07-01', time: '12:00' });
check('1955-07-01도 서머타임', dst1955.meta.dstApplied);

// 서머타임 적용 시 12:00 출생자의 진태양시가 11시대로 내려가는지
check('서머타임 12:00 → 진태양시 11시대',
  dst1987.meta.correctedTime!.startsWith('10:') || dst1987.meta.correctedTime!.startsWith('11:'),
  `→ ${dst1987.meta.correctedTime}`);

// ── B7. 표준자오선 변천 (1954-1961 UTC+8:30) ───────────────────
section('B7. 표준자오선 변천');

const m1950 = calculate({ date: '1950-11-01', time: '12:00' });
const m1958 = calculate({ date: '1958-11-01', time: '12:00' });
const m1970 = calculate({ date: '1970-11-01', time: '12:00' });
check('1950년은 135도 기준', m1950.meta.standardMeridian === 135, `→ ${m1950.meta.standardMeridian}`);
check('1958년은 127.5도 기준', m1958.meta.standardMeridian === 127.5, `→ ${m1958.meta.standardMeridian}`);
check('1970년은 135도 복귀', m1970.meta.standardMeridian === 135, `→ ${m1970.meta.standardMeridian}`);
check('127.5도 시기엔 경도보정이 거의 0',
  Math.abs(m1958.meta.solarTimeOffsetMin) < 20,
  `1958: ${m1958.meta.solarTimeOffsetMin.toFixed(1)}분 / 1970: ${m1970.meta.solarTimeOffsetMin.toFixed(1)}분`);

// ── B8. 진태양시 보정량 ────────────────────────────────────────
section('B8. 진태양시 경도 보정');

const seoul = calculate({ date: '2024-06-15', time: '12:00', longitude: 126.978, applyEquationOfTime: false });
check('서울은 약 −32분', Math.abs(seoul.meta.solarTimeOffsetMin + 32.1) < 0.5,
  `→ ${seoul.meta.solarTimeOffsetMin.toFixed(2)}분`);

const dokdo = calculate({ date: '2024-06-15', time: '12:00', longitude: 131.87, applyEquationOfTime: false });
check('독도는 약 −12분', Math.abs(dokdo.meta.solarTimeOffsetMin + 12.5) < 0.5,
  `→ ${dokdo.meta.solarTimeOffsetMin.toFixed(2)}분`);

check('보정을 끄면 0분', calculate({ date: '2024-06-15', time: '12:00', applyTrueSolarTime: false }).meta.solarTimeOffsetMin === 0);

// ── B9. 날짜 경계를 넘는 보정 ──────────────────────────────────
section('B9. 보정으로 날짜가 넘어가는 경우');

const justAfterMidnight = calculate({ date: '2024-06-15', time: '00:10', longitude: 126.978 });
check('00:10 서울 → 전날 23시대로 이동',
  justAfterMidnight.meta.correctedDate === '2024-06-14',
  `${justAfterMidnight.meta.correctedDate} ${justAfterMidnight.meta.correctedTime}`);
check('그 경우 일주도 전날 것',
  justAfterMidnight.day.sexagenary ===
    calculate({ date: '2024-06-14', time: '12:00' }).day.sexagenary);

// ── B10. 윤년 및 기타 ──────────────────────────────────────────
section('B10. 윤년 · 시각 미상');

const leap = calculate({ date: '2024-02-29', time: '12:00' });
check('2024-02-29 계산됨', leap.day.stem.length === 1, `→ ${formatMyeongsik(leap)}`);
check('윤일 다음날과 1갑자 차',
  (leap.day.sexagenary + 1) % 60 === calculate({ date: '2024-03-01', time: '12:00' }).day.sexagenary);

const noTime = calculate({ date: '2024-06-15', time: null });
check('시각 미상이면 시주 없음', noTime.hour === null);
check('시각 미상이어도 나머지 3주는 나옴',
  !!(noTime.year && noTime.month && noTime.day), `→ ${formatMyeongsik(noTime)}`);

// ── 요약 ───────────────────────────────────────────────────────
console.log(`\n${'═'.repeat(60)}`);
console.log(`통과 ${passed} / 실패 ${failed}`);
if (failed) {
  console.log(`\n실패 항목:`);
  for (const f of failures) console.log(`  - ${f}`);
  process.exit(1);
}
console.log('전부 통과.');
