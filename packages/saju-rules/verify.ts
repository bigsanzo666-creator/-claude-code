/**
 * 해석 룰 엔진 검증.
 *
 * 명리 규칙은 표로 정해져 있어서 정답이 있다. 여기서 검증하는 것은
 * "우리 구현이 그 표대로 동작하는가"다. 해석의 타당성은 별개 문제이며,
 * 그건 감수를 받아야 한다.
 */

import { calculate, makePillar, STEMS, BRANCHES } from '../manseryeok/src/index.ts';
import type { Myeongsik } from '../manseryeok/src/index.ts';
import {
  analyze, formatAnalysis, tenGodOf, twelveStage, HIDDEN_STEMS,
  findRelations, findSinsal, elementWeights,
  calculateDaeun, currentDaeun, annualLuck, dailyLuck, dailyLuckRange,
} from './src/index.ts';

let passed = 0, failed = 0;
const failures: string[] = [];

function check(label: string, ok: boolean, detail = '') {
  if (ok) { passed++; console.log(`  ✓ ${label}${detail ? `  ${detail}` : ''}`); }
  else { failed++; failures.push(label); console.log(`  ✗ ${label}${detail ? `  ${detail}` : ''}`); }
}
function section(t: string) { console.log(`\n${t}\n${'─'.repeat(60)}`); }

/** 간지 네 개로 가짜 명식을 만든다. 합충 규칙을 직접 겨냥해 테스트하기 위한 것. */
function fakeMyeongsik(year: string, month: string, day: string, hour: string | null): Myeongsik {
  const mk = (gz: string) =>
    makePillar(STEMS.indexOf(gz[0] as never), BRANCHES.indexOf(gz[1] as never));
  return {
    year: mk(year), month: mk(month), day: mk(day), hour: hour ? mk(hour) : null,
    meta: {} as never,
  };
}

// ── A. 십신 ────────────────────────────────────────────────────
section('A. 십신 — 표대로 나오는가');

const GAP_EXPECTED: Record<string, string> = {
  갑: '비견', 을: '겁재', 병: '식신', 정: '상관', 무: '편재',
  기: '정재', 경: '편관', 신: '정관', 임: '편인', 계: '정인',
};
let gapOk = true;
for (const [stem, expected] of Object.entries(GAP_EXPECTED)) {
  const got = tenGodOf('갑', stem);
  if (got !== expected) { gapOk = false; console.log(`    ! 갑→${stem}: ${got} (기대 ${expected})`); }
}
check('갑 일간의 십신 10종', gapOk);

// 음간은 음양이 뒤집히므로 결과도 달라야 한다
const EUL_EXPECTED: Record<string, string> = {
  을: '비견', 갑: '겁재', 정: '식신', 병: '상관', 기: '편재',
  무: '정재', 신: '편관', 경: '정관', 계: '편인', 임: '정인',
};
let eulOk = true;
for (const [stem, expected] of Object.entries(EUL_EXPECTED)) {
  if (tenGodOf('을', stem) !== expected) {
    eulOk = false; console.log(`    ! 을→${stem}: ${tenGodOf('을', stem)} (기대 ${expected})`);
  }
}
check('을 일간의 십신 10종 (음간)', eulOk);

// 어느 일간에서 보든 십신 10종이 모두 한 번씩 나와야 한다
let coverageOk = true;
for (const day of STEMS) {
  const gods = new Set(STEMS.map((s) => tenGodOf(day, s)));
  if (gods.size !== 10) { coverageOk = false; console.log(`    ! ${day} 일간: ${gods.size}종`); }
}
check('10개 일간 전부 십신 10종을 빠짐없이 생성', coverageOk);

// ── B. 십이운성 ────────────────────────────────────────────────
section('B. 십이운성');

const STAGE_CASES: [string, string, string][] = [
  ['갑', '해', '장생'], ['갑', '인', '건록'], ['갑', '묘', '제왕'],
  ['병', '인', '장생'], ['병', '사', '건록'], ['병', '오', '제왕'],
  ['경', '사', '장생'], ['경', '신', '건록'], ['경', '유', '제왕'],
  ['임', '신', '장생'], ['임', '해', '건록'], ['임', '자', '제왕'],
  ['을', '오', '장생'], ['을', '묘', '건록'], ['을', '인', '제왕'],
  ['정', '유', '장생'], ['정', '오', '건록'],
  ['신', '자', '장생'], ['신', '유', '건록'],
  ['계', '묘', '장생'], ['계', '자', '건록'],
  ['기', '유', '장생'], ['기', '오', '건록'],
];
let stageOk = true;
for (const [stem, branch, expected] of STAGE_CASES) {
  const got = twelveStage(stem, branch);
  if (got !== expected) { stageOk = false; console.log(`    ! ${stem}${branch}: ${got} (기대 ${expected})`); }
}
check(`장생·건록·제왕 ${STAGE_CASES.length}건`, stageOk);

let cycleOk = true;
for (const stem of STEMS) {
  const stages = new Set(BRANCHES.map((b) => twelveStage(stem, b)));
  if (stages.size !== 12) { cycleOk = false; console.log(`    ! ${stem}: ${stages.size}단계`); }
}
check('모든 천간이 12단계를 전부 순회', cycleOk);

// ── C. 지장간 ──────────────────────────────────────────────────
section('C. 지장간');

let daysOk = true, mainOk = true;
const MAIN_STEM: Record<string, string> = {
  자: '계', 축: '기', 인: '갑', 묘: '을', 진: '무', 사: '병',
  오: '정', 미: '기', 신: '경', 유: '신', 술: '무', 해: '임',
};
for (const b of BRANCHES) {
  const hidden = HIDDEN_STEMS[b];
  const sum = hidden.reduce((a, h) => a + h.days, 0);
  if (sum !== 30) { daysOk = false; console.log(`    ! ${b}: 합 ${sum}일`); }
  if (hidden.at(-1)!.stem !== MAIN_STEM[b]) {
    mainOk = false; console.log(`    ! ${b} 정기: ${hidden.at(-1)!.stem} (기대 ${MAIN_STEM[b]})`);
  }
}
check('12지지 전부 지장간 합이 30일', daysOk);
check('12지지의 정기가 표와 일치', mainOk);

// ── D. 합·충·형 ────────────────────────────────────────────────
section('D. 합·충·형');

const clash = findRelations(fakeMyeongsik('갑자', '병인', '무오', '경신'));
check('자오충 검출', clash.some((r) => r.kind === '지지충' && r.name === '자오충'),
  clash.map((r) => r.name).join(', ') || '(없음)');
check('인신충 검출', clash.some((r) => r.name === '인신충'));

const stemCombo = findRelations(fakeMyeongsik('갑자', '기사', '무오', '병인'));
check('갑기합토 검출', stemCombo.some((r) => r.kind === '천간합' && r.name === '갑기합토'));

const triple = findRelations(fakeMyeongsik('임신', '갑자', '병진', '무술'));
const tri = triple.find((r) => r.kind === '삼합');
check('신자진 수국 삼합 검출', !!tri && tri.becomes === '수', tri?.name ?? '(없음)');

const half = findRelations(fakeMyeongsik('갑자', '병인', '무신', '경오'));
check('반합은 왕지가 있을 때만 인정', half.some((r) => r.kind === '반합'),
  half.filter((r) => r.kind === '반합').map((r) => r.name).join(', ') || '(없음)');

const punish = findRelations(fakeMyeongsik('갑인', '을사', '무신', '경오'));
check('인사신 삼형 검출', punish.some((r) => r.kind === '형' && r.name === '인사신 삼형'));

const clean = findRelations(fakeMyeongsik('갑자', '을축', '병인', '정묘'));
check('충이 없는 명식은 충을 만들지 않음', !clean.some((r) => r.kind === '지지충'),
  clean.map((r) => r.name).join(', ') || '(관계 없음)');

// ── E. 신살 ────────────────────────────────────────────────────
section('E. 신살');

// 갑 일간의 천을귀인은 축·미
const gwiin = findSinsal(fakeMyeongsik('을축', '병인', '갑오', '정묘'));
check('천을귀인 (갑 일간 → 축)', gwiin.some((s) => s.name === '천을귀인'),
  gwiin.map((s) => s.name).join(', ') || '(없음)');

// 갑 일간의 양인은 묘
const yangin = findSinsal(fakeMyeongsik('갑묘', '병인', '갑오', '정사'));
check('양인 (갑 일간 → 묘)', yangin.some((s) => s.name === '양인'));

const goegang = findSinsal(fakeMyeongsik('갑자', '병인', '경진', '정묘'));
check('괴강 (일주 경진)', goegang.some((s) => s.name === '괴강'));

// ── F. 오행 가중 ───────────────────────────────────────────────
section('F. 오행 가중치');

const w = elementWeights(fakeMyeongsik('갑자', '병인', '무오', '경신'));
const total = w.reduce((a, e) => a + e.weight, 0);
check('오행 비율 합이 100%', Math.abs(total - 100) < 0.5, `→ ${total.toFixed(1)}%`);
check('지장간이 반영돼 0인 오행이 줄어듦', w.filter((e) => e.weight > 0).length === 5,
  w.map((e) => `${e.element} ${e.weight}%`).join('  '));

// ── G. 신강·신약 ───────────────────────────────────────────────
section('G. 신강 / 신약');

// 여름 화 일간, 화 기운이 겹친 명식 → 신강 쪽
const hot = analyze(fakeMyeongsik('병오', '갑오', '병오', '정사'));
check('화 일간 + 여름 + 화 중첩 → 신강', hot.strength.verdict === '신강',
  `${hot.strength.verdict} (${hot.strength.supportRatio}%)`);
check('그 경우 득령 성립', hot.strength.deukryeong);

// 금 일간이 화에 둘러싸임 → 신약 쪽
const weak = analyze(fakeMyeongsik('병오', '갑오', '경오', '정사'));
check('금 일간 + 화 중첩 → 신약', weak.strength.verdict === '신약',
  `${weak.strength.verdict} (${weak.strength.supportRatio}%)`);
check('그 경우 실령', !weak.strength.deukryeong);

check('신강이면 용신은 설기 쪽', hot.yongsin.primary.includes('식상'), hot.yongsin.primary.join('·'));
check('신약이면 용신은 보강 쪽', weak.yongsin.primary.includes('인성'), weak.yongsin.primary.join('·'));
check('신강/신약의 용신이 서로 반대',
  !hot.yongsin.primary.some((g) => weak.yongsin.primary.includes(g)));

// ── H. 결정론 ──────────────────────────────────────────────────
section('H. 결정론 — 같은 입력이면 같은 결과');

const ms = calculate({ date: '1990-05-15', time: '14:30' });
const a1 = JSON.stringify(analyze(ms));
const a2 = JSON.stringify(analyze(calculate({ date: '1990-05-15', time: '14:30' })));
check('같은 생년월일시 → 동일한 분석 결과', a1 === a2);

const noTime = analyze(calculate({ date: '1990-05-15', time: null }));
check('시각 미상이어도 분석됨', noTime.pillars.length === 3, `${noTime.pillars.length}주`);

// ── J. 대운 ────────────────────────────────────────────────────
section('J. 대운 — 방향과 대운수');

const base1990 = calculate({ date: '1990-05-15', time: '14:30' });
const an1990 = analyze(base1990);

const male = calculateDaeun(base1990, '남', an1990.yongsin);
const female = calculateDaeun(base1990, '여', an1990.yongsin);

check('연간 경(양) + 남 → 순행', male.direction === '순행', male.direction);
check('연간 경(양) + 여 → 역행', female.direction === '역행', female.direction);

// 음간 해로 뒤집어 확인 (1985년 을축년 — 을은 음간)
const base1985 = calculate({ date: '1985-05-15', time: '14:30' });
const an1985 = analyze(base1985);
check('연간 을(음) + 남 → 역행',
  calculateDaeun(base1985, '남', an1985.yongsin).direction === '역행');
check('연간 을(음) + 여 → 순행',
  calculateDaeun(base1985, '여', an1985.yongsin).direction === '순행');

// 대운수: 순행은 다음 절까지, 역행은 이전 절부터
const toNext = base1990.meta.minutesToNextTerm / 1440;
const fromPrev = base1990.meta.minutesFromMonthTerm / 1440;
check('순행 대운수는 다음 절까지 / 3',
  Math.abs(male.startAgeExact - toNext / 3) < 1e-9,
  `${male.startAgeExact.toFixed(2)}년 → 대운수 ${male.startAge}`);
check('역행 대운수는 이전 절부터 / 3',
  Math.abs(female.startAgeExact - fromPrev / 3) < 1e-9,
  `${female.startAgeExact.toFixed(2)}년 → 대운수 ${female.startAge}`);
check('두 방향의 대운수가 서로 다름', male.startAge !== female.startAge);

// 간지 진행
check('순행 첫 대운은 월주 다음 간지',
  male.periods[0].pillar.sexagenary === (base1990.month.sexagenary + 1) % 60,
  `월주 ${base1990.month.stem}${base1990.month.branch} → ${male.periods[0].pillar.stem}${male.periods[0].pillar.branch}`);
check('역행 첫 대운은 월주 이전 간지',
  female.periods[0].pillar.sexagenary === (base1990.month.sexagenary + 59) % 60,
  `월주 ${base1990.month.stem}${base1990.month.branch} → ${female.periods[0].pillar.stem}${female.periods[0].pillar.branch}`);

let seqOk = true;
for (let i = 1; i < male.periods.length; i++) {
  if (male.periods[i].pillar.sexagenary !== (male.periods[i - 1].pillar.sexagenary + 1) % 60) seqOk = false;
  if (male.periods[i].startAge !== male.periods[i - 1].startAge + 10) seqOk = false;
}
check('대운이 10년 간격으로 1갑자씩 진행', seqOk);
check('대운 10개 생성', male.periods.length === 10);

const cur = currentDaeun(male, 35);
check('35세의 대운을 찾음', !!cur && 35 >= cur.startAge && 35 <= cur.endAge,
  cur ? `${cur.index}운 ${cur.pillar.stem}${cur.pillar.branch} (${cur.startAge}~${cur.endAge}세)` : '(없음)');
check('대운수 이전 나이는 대운 없음', currentDaeun(male, male.startAge - 1) === null);

// ── K. 세운 · 일진 ─────────────────────────────────────────────
section('K. 세운 · 일진');

const years = annualLuck(base1990, an1990.yongsin, 2024, 5);
check('세운 5년 생성', years.length === 5);
check('2024년은 갑진년', years[0].pillar.stem === '갑' && years[0].pillar.branch === '진',
  `→ ${years[0].pillar.stem}${years[0].pillar.branch}`);
check('세운 간지가 해마다 1갑자씩',
  years.every((y, i) => i === 0 || y.pillar.sexagenary === (years[i - 1].pillar.sexagenary + 1) % 60));
check('나이 계산이 입춘 기준 연도와 맞음', years[0].age === 2024 - base1990.meta.solarYear,
  `2024년에 ${years[0].age}세`);

const today = dailyLuck(base1990, an1990.yongsin, '2000-01-01');
check('일진이 만세력 일주와 일치 (2000-01-01 무오)',
  today.pillar.stem === '무' && today.pillar.branch === '오',
  `→ ${today.pillar.stem}${today.pillar.branch}`);

const week = dailyLuckRange(base1990, an1990.yongsin, '2024-03-01', 7);
check('일진 7일 생성', week.length === 7);
check('일진이 하루 1갑자씩',
  week.every((d, i) => i === 0 || d.pillar.sexagenary === (week[i - 1].pillar.sexagenary + 1) % 60));

// 유불리 판정이 용신과 일관되는가
const favors = new Set(male.periods.map((p) => p.favor));
check('대운마다 유불리가 갈림 (전부 같지 않음)', favors.size > 1,
  male.periods.map((p) => `${p.pillar.stem}${p.pillar.branch}:${p.favor}`).join(' '));

// 충 검출
const anyClash = male.periods.some((p) => p.interactions.some((i) => i.includes('충')));
check('대운 중 명식과 충하는 구간을 짚어냄', anyClash,
  male.periods.filter((p) => p.interactions.length).map((p) => `${p.pillar.stem}${p.pillar.branch}(${p.interactions.length})`).join(' ') || '(없음)');

// ── L. 대운 출력 미리보기 ──────────────────────────────────────
section('L. 대운 출력 (1990-05-15 14:30 남)');
console.log(`  ${male.directionReason}`);
console.log(`  ${male.basis}\n`);
for (const p of male.periods.slice(0, 6)) {
  const mark = p.favor === '유리' ? '+' : p.favor === '불리' ? '−' : ' ';
  console.log(`  ${mark} ${String(p.startAge).padStart(2)}~${p.endAge}세  ${p.pillar.stem}${p.pillar.branch}  ` +
    `${p.stemGod}/${p.branchGod}  ${p.favor}` + (p.interactions.length ? `  · ${p.interactions[0]}` : ''));
}
console.log('\n  세운:');
for (const y of years) {
  const mark = y.favor === '유리' ? '+' : y.favor === '불리' ? '−' : ' ';
  console.log(`  ${mark} ${y.year}년 (${y.age}세)  ${y.pillar.stem}${y.pillar.branch}  ${y.stemGod}/${y.branchGod}  ${y.favor}` +
    (y.interactions.length ? `  · ${y.interactions[0]}` : ''));
}

// ── I. 결과 미리보기 ───────────────────────────────────────────
section('I. 실제 출력 (1990-05-15 14:30 서울)');
const full = analyze(ms);
console.log(formatAnalysis(full).split('\n').map((l) => '  ' + l).join('\n'));
console.log('\n  두드러진 특징:');
for (const h of full.highlights) console.log(`    · ${h}`);
console.log('\n  판정 근거:');
for (const r of full.strength.reasoning) console.log(`    · ${r}`);
console.log(`    · ${full.yongsin.reasoning}`);

console.log(`\n${'═'.repeat(60)}`);
console.log(`통과 ${passed} / 실패 ${failed}`);
if (failed) {
  console.log('\n실패 항목:');
  for (const f of failures) console.log(`  - ${f}`);
  process.exit(1);
}
console.log('전부 통과.');
