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
  compatibility, sajuToTraits, crossValidate,
  allTopics, extractTopic, ALL_TOPICS, TOPIC_LABELS,
  freeReading, GOD_PLAIN, ELEMENT_PLAIN,
} from './src/index.ts';
import { readFace, NEUTRAL_FEATURES } from '../physiognomy/src/index.ts';
import { readPalm, NEUTRAL_PALM_FEATURES } from '../palmistry/src/index.ts';
import { TRAIT_AXES } from '../traits/src/index.ts';

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

// ── M. 궁합 ────────────────────────────────────────────────────
section('M. 궁합');

// 일간 갑 vs 기 = 갑기합. 일지 자 vs 축 = 자축합. 둘 다 합이므로 높게 나와야 한다
const goodA = fakeMyeongsik('임인', '계묘', '갑자', '병인');
const goodB = fakeMyeongsik('무진', '경신', '기축', '을해');
const good = compatibility(goodA, goodB, '가', '나');

// 일간 갑 vs 경 = 충. 일지 자 vs 오 = 충. 둘 다 충
const badA = fakeMyeongsik('임인', '계묘', '갑자', '병인');
const badB = fakeMyeongsik('무진', '병오', '경오', '을해');
const bad = compatibility(badA, badB, '가', '나');

check('일간·일지 모두 합 → 두 축이 높음',
  good.axes[0].score >= 90 && good.axes[1].score >= 90,
  `일간 ${good.axes[0].score} / 일지 ${good.axes[1].score}`);
check('일간·일지 모두 충 → 두 축이 낮음',
  bad.axes[0].score <= 45 && bad.axes[1].score <= 45,
  `일간 ${bad.axes[0].score} / 일지 ${bad.axes[1].score}`);
check('합 조합이 충 조합보다 종합 점수가 높음', good.score > bad.score,
  `${good.score} (${good.grade}) vs ${bad.score} (${bad.grade})`);

check('점수는 0~100 범위', [good, bad].every((c) => c.score >= 0 && c.score <= 100));
check('모든 축이 0~100 범위',
  [good, bad].every((c) => c.axes.every((x) => x.score >= 0 && x.score <= 100)));
check('축 가중치 합이 100', good.axes.reduce((s, x) => s + x.weight, 0) === 100);
check('축이 5개', good.axes.length === 5, good.axes.map((x) => x.name).join(', '));

// 순서를 바꿔도 같은 결과여야 한다
const fwd = compatibility(goodA, goodB, '가', '나');
const rev = compatibility(goodB, goodA, '나', '가');
check('A·B 순서를 바꿔도 점수가 같음', fwd.score === rev.score, `${fwd.score} = ${rev.score}`);

// 결과는 반드시 행동 제안으로 끝난다 — 낮은 점수라도
check('좋은 궁합에도 조언이 있음', good.advice.length > 0);
check('낮은 궁합에도 조언이 있음 (단정으로 끝내지 않음)', bad.advice.length > 0,
  `${bad.advice.length}건`);
check('두 사람 모두의 배우자 자리를 짚음',
  bad.advice.filter((a) => a.includes('배우자 자리')).length === 2);
check('면책 문구가 붙음', good.disclaimer.includes('참고'));
check('낮은 점수에서 주의 항목이 나옴', bad.cautions.length > 0, `${bad.cautions.length}건`);
check('높은 점수에서 강점 항목이 나옴', good.strengths.length > 0, `${good.strengths.length}건`);

// 용신 보완이 가장 큰 비중
check('용신 보완이 최대 가중치', good.axes.find((x) => x.name === '용신 보완')!.weight === 30);

// 실제 생년월일로도 동작하는가
const p1 = calculate({ date: '1990-05-15', time: '14:30' });
const p2 = calculate({ date: '1993-11-03', time: '09:20' });
const real = compatibility(p1, p2, '민수', '지영');
check('실제 두 명식으로 계산됨', real.score > 0 && real.axes.length === 5,
  `${real.score}점 ${real.grade}`);
check('결정론 — 같은 두 명식이면 같은 결과',
  JSON.stringify(compatibility(p1, p2, '민수', '지영')) === JSON.stringify(real));

// ── N. 궁합 출력 미리보기 ──────────────────────────────────────
section('N. 궁합 출력 (1990-05-15 · 1993-11-03)');
console.log(`  종합 ${real.score}점 — ${real.grade}\n`);
for (const x of real.axes) {
  console.log(`  [${String(x.weight).padStart(2)}%] ${x.name} ${String(x.score).padStart(5)}  ${x.verdict}`);
  console.log(`         ${x.reasoning}`);
}
if (real.strengths.length) { console.log('\n  강점:'); for (const t of real.strengths) console.log(`    + ${t.split(' — ')[0]}`); }
if (real.cautions.length) { console.log('\n  주의:'); for (const t of real.cautions) console.log(`    − ${t.split(' — ')[0]}`); }
console.log('\n  조언:');
for (const t of real.advice) console.log(`    · ${t}`);

// ── O. 교차검증 ────────────────────────────────────────────────
section('O. 교차검증 — 사주 × 관상');

const msX = calculate({ date: '1990-05-15', time: '14:30' });
const anX = analyze(msX);
const sajuTraits = sajuToTraits(anX);

check('사주가 성향 신호를 생성', sajuTraits.signals.length > 0, `${sajuTraits.signals.length}개 신호`);
check('신호 점수가 −2~+2 범위', sajuTraits.signals.every((s) => s.score >= -2 && s.score <= 2));
check('모든 신호에 근거가 붙음', sajuTraits.signals.every((s) => s.evidence.length > 0));

// 한 갈래만 있으면 교차검증이 성립하지 않는다
const solo = crossValidate(sajuTraits);
check('한 갈래만으로는 대조 불가 안내', solo.summary.includes('두 가지 이상'), solo.summary.slice(0, 30) + '…');
check('한 갈래면 일치 항목이 없음', solo.agreed.length === 0);

// 사주와 같은 방향을 말하는 얼굴 / 반대를 말하는 얼굴
const richFace = readFace({ ...NEUTRAL_FEATURES, noseWing: 'high', mouthSize: 'high' });
const poorFace = readFace({ ...NEUTRAL_FEATURES, noseWing: 'low', mouthSize: 'low' });

check('관상이 성향 신호를 생성', richFace.profile.signals.length > 0, `${richFace.profile.signals.length}개`);
check('중립 얼굴은 얼굴형 신호만 남음',
  readFace(NEUTRAL_FEATURES).profile.signals.every((s) => s.evidence.includes('얼굴형')));

// 사주는 재성 0 → 재물 약함. 콧방울 큰 얼굴 → 재물 강함. 엇갈려야 한다
const cvConflict = crossValidate(sajuTraits, richFace.profile);
const wealth = cvConflict.comparisons.find((c) => c.axis === '재물')!;
check('재물 축에서 사주와 관상이 엇갈림을 잡아냄', wealth.verdict === '엇갈림',
  `${wealth.verdict} — 사주 ${wealth.readings[0].score} / 관상 ${wealth.readings[1].score}`);
check('엇갈림을 감추지 않고 목록에 올림', cvConflict.conflicted.some((c) => c.axis === '재물'));
check('엇갈림 문구가 "노력"의 여지로 안내',
  wealth.text.includes('노력'), wealth.text.slice(0, 40) + '…');

// 같은 방향이면 일치로 잡아야 한다
const cvAgree = crossValidate(sajuTraits, poorFace.profile);
const wealth2 = cvAgree.comparisons.find((c) => c.axis === '재물')!;
check('둘 다 약하다고 보면 일치로 판정', wealth2.verdict === '일치',
  `${wealth2.verdict} (합의 방향 ${wealth2.consensus})`);
check('일치 항목은 확신 문구를 씀', wealth2.text.includes('확신'));

check('모든 축이 판정을 받음', cvAgree.comparisons.length === TRAIT_AXES.length,
  `${cvAgree.comparisons.length}/${TRAIT_AXES.length}축`);
check('네 가지 판정만 사용',
  cvAgree.comparisons.every((c) => ['일치', '엇갈림', '단독', '해당 없음'].includes(c.verdict)));
check('요약에 대조한 갈래 수가 들어감', cvAgree.summary.includes('2가지'));
check('면책 문구가 붙음', cvAgree.disclaimer.includes('참고'));

check('결정론 — 같은 입력이면 같은 교차검증',
  JSON.stringify(crossValidate(sajuTraits, poorFace.profile)) === JSON.stringify(cvAgree));

// ── P. 교차검증 출력 미리보기 ──────────────────────────────────
section('P. 교차검증 출력 (1990-05-15 사주 × 콧방울·입 큰 얼굴)');
console.log(`  ${cvConflict.summary}\n`);
for (const c of cvConflict.comparisons) {
  const mark = c.verdict === '일치' ? '=' : c.verdict === '엇갈림' ? '≠' : c.verdict === '단독' ? '·' : ' ';
  const scores = c.readings.map((r) => `${r.source} ${r.score > 0 ? '+' : ''}${r.score}`).join('  ');
  console.log(`  ${mark} ${c.axis.padEnd(6)} ${scores.padEnd(20)} ${c.verdict}`);
}
console.log('\n  엇갈리는 항목 상세:');
for (const c of cvConflict.conflicted) console.log(`    · ${c.text}`);
console.log('\n  일치하는 항목 상세:');
for (const c of cvConflict.agreed.slice(0, 2)) console.log(`    · ${c.text}`);

// ── Q. 손금 ────────────────────────────────────────────────────
section('Q. 손금');

const neutralPalm = readPalm(NEUTRAL_PALM_FEATURES);
check('중립 손은 손 모양 신호만 남음',
  neutralPalm.profile.signals.every((s) => s.evidence.includes('손 모양')),
  `${neutralPalm.profile.signals.length}개`);

const strongPalm = readPalm({
  ...NEUTRAL_PALM_FEATURES,
  lifeLength: 'high', lifeDepth: 'high', headLength: 'high',
  heartLength: 'low', fateClarity: 'high', handShape: '토형',
});
check('특징 있는 손은 여러 축에 신호', strongPalm.profile.signals.length >= 8,
  `${strongPalm.profile.signals.length}개 신호`);
check('모든 신호에 근거가 붙음', strongPalm.profile.signals.every((s) => s.evidence.length > 0));
check('점수가 −2~+2 범위', strongPalm.profile.signals.every((s) => s.score >= -2 && s.score <= 2));

// 생명선을 수명과 엮지 않는다 — 이건 규칙이다
const lifeNote = strongPalm.notes.find((n) => n.domain === '생명선')!;
check('생명선을 체력으로만 읽고 수명 예측을 하지 않음',
  lifeNote.text.includes('수명이 아니라') && !/수명이 (길|짧)/.test(lifeNote.text),
  lifeNote.text.slice(0, 34) + '…');

// 운명선이 없는 것을 나쁘게 말하지 않는다
const faintFate = readPalm({ ...NEUTRAL_PALM_FEATURES, fateClarity: 'low' });
const fateNote = faintFate.notes.find((n) => n.domain === '운명선')!;
check('운명선이 흐린 것을 결함으로 말하지 않음',
  fateNote.text.includes('나쁜 것이 아닙니다'), fateNote.text.slice(0, 30) + '…');

// 막쥔손금
const simian = readPalm({ ...NEUTRAL_PALM_FEATURES, simianLine: true });
check('막쥔손금이 추진력 신호를 냄',
  simian.profile.signals.some((s) => s.axis === '추진력' && s.score === 2 && s.evidence.includes('막쥔손금')));

// 손 모양 5종
let shapeOk = true;
for (const shape of ['목형', '화형', '토형', '금형', '수형'] as const) {
  const r = readPalm({ ...NEUTRAL_PALM_FEATURES, handShape: shape });
  if (!r.profile.signals.some((s) => s.evidence.includes(shape))) shapeOk = false;
}
check('오행 손 모양 5종 모두 신호 생성', shapeOk);

// 두뇌선 길이는 방향이 갈려야 한다 (길면 신중, 짧으면 결단)
const longHead = readPalm({ ...NEUTRAL_PALM_FEATURES, headLength: 'high' });
const shortHead = readPalm({ ...NEUTRAL_PALM_FEATURES, headLength: 'low' });
check('두뇌선 길면 학습, 짧으면 추진으로 갈림',
  longHead.profile.signals.some((s) => s.axis === '학습·직관' && s.score > 0) &&
  shortHead.profile.signals.some((s) => s.axis === '추진력' && s.score > 0));

// ── R. 3갈래 교차검증 ──────────────────────────────────────────
section('R. 사주 × 관상 × 손금');

const face3 = readFace({ ...NEUTRAL_FEATURES, foreheadWidth: 'high', noseWing: 'high', jawDevelopment: 'low', eyeSize: 'high' });
const palm3 = readPalm({ ...NEUTRAL_PALM_FEATURES, lifeLength: 'high', headLength: 'high', heartLength: 'high', fateClarity: 'high', handShape: '토형' });
const cv3 = crossValidate(sajuTraits, face3.profile, palm3.profile);

check('세 갈래를 모두 인식', cv3.sourceCount === 3);
check('요약에 3가지로 표기', cv3.summary.includes('3가지'), cv3.summary.slice(0, 40) + '…');
check('각 축이 세 갈래의 판정을 모두 담음',
  cv3.comparisons.every((c) => c.readings.length === 3));
check('갈래가 늘어 단독 항목이 줄어듦',
  cv3.soloOnly.length < crossValidate(sajuTraits, face3.profile).soloOnly.length,
  `2갈래 ${crossValidate(sajuTraits, face3.profile).soloOnly.length}개 → 3갈래 ${cv3.soloOnly.length}개`);

// 셋 다 같은 방향이면 일치, 하나라도 반대면 엇갈림
const allAgree = crossValidate(
  { source: '사주', signals: [{ axis: '재물', score: 2, evidence: '재성이 많다' }] },
  { source: '관상', signals: [{ axis: '재물', score: 1, evidence: '콧방울이 크다' }] },
  { source: '손금', signals: [{ axis: '재물', score: 1, evidence: '운명선이 뚜렷하다' }] },
);
const w3 = allAgree.comparisons.find((c) => c.axis === '재물')!;
check('셋 다 같은 방향 → 일치', w3.verdict === '일치');
check('일치 문구가 세 갈래를 모두 호명', w3.text.includes('사주') && w3.text.includes('관상') && w3.text.includes('손금'),
  w3.text.slice(0, 40) + '…');

const twoVsOne = crossValidate(
  { source: '사주', signals: [{ axis: '재물', score: 2, evidence: '재성이 많다' }] },
  { source: '관상', signals: [{ axis: '재물', score: 1, evidence: '콧방울이 크다' }] },
  { source: '손금', signals: [{ axis: '재물', score: -2, evidence: '운명선이 흐리다' }] },
);
const w4 = twoVsOne.comparisons.find((c) => c.axis === '재물')!;
check('2대1로 갈리면 엇갈림으로 처리', w4.verdict === '엇갈림');
check('어느 쪽이 어느 편인지 문구에 드러남',
  w4.text.includes('사주·관상') && w4.text.includes('손금'), w4.text.slice(0, 50) + '…');

check('결정론 — 3갈래도 같은 입력이면 같은 결과',
  JSON.stringify(crossValidate(sajuTraits, face3.profile, palm3.profile)) === JSON.stringify(cv3));

// ── S. 3갈래 출력 미리보기 ─────────────────────────────────────
section('S. 3갈래 교차검증 출력');
console.log(`  ${cv3.summary}\n`);
for (const c of cv3.comparisons) {
  const mark = c.verdict === '일치' ? '=' : c.verdict === '엇갈림' ? '≠' : c.verdict === '단독' ? '·' : ' ';
  const scores = c.readings.map((r) => `${r.source} ${r.score > 0 ? '+' : ''}${r.score}`).join('  ');
  console.log(`  ${mark} ${c.axis.padEnd(6)} ${scores.padEnd(32)} ${c.verdict}`);
}
console.log('\n  손금 풀이:');
for (const n of palm3.notes) console.log(`    · [${n.domain}] ${n.text}`);

// ── I. 결과 미리보기 ───────────────────────────────────────────
section('I. 실제 출력 (1990-05-15 14:30 서울)');
const full = analyze(ms);
console.log(formatAnalysis(full).split('\n').map((l) => '  ' + l).join('\n'));
console.log('\n  두드러진 특징:');
for (const h of full.highlights) console.log(`    · ${h}`);
console.log('\n  판정 근거:');
for (const r of full.strength.reasoning) console.log(`    · ${r}`);
console.log(`    · ${full.yongsin.reasoning}`);


// ── 주제별 분리 ────────────────────────────────────────────────
section('주제별 분리 (상품을 열 개로 나누기 위한 것)');
{
  const ms = calculate({ date: '1990-05-15', time: '14:30', longitude: 126.978, gender: '남' });
  const a = analyze(ms);
  const topics = allTopics(a);

  check('여덟 주제가 모두 나온다', topics.length === ALL_TOPICS.length, `${topics.length}개`);
  check('식별자가 겹치지 않는다', new Set(topics.map((t) => t.id)).size === topics.length);

  // 용어를 던지고 끝내지 않는다 — 이게 경쟁사와의 차이다
  for (const t of topics) {
    check(`${t.label}: 명리 용어와 한자를 함께 든다`, Boolean(t.term && t.termHanja));
    check(`${t.label}: 용어 뜻을 한 줄로 설명한다`, t.gloss.length > 5 && t.gloss.endsWith('뜻합니다'));
  }

  // 결론에는 근거가 붙어야 한다
  for (const t of topics.filter((x) => x.count > 0 || x.hiddenCount > 0)) {
    check(`${t.label}: 근거가 붙는다`, t.evidence.length > 0, `${t.evidence.length}건`);
    check(`${t.label}: 근거가 어느 글자인지 밝힌다`, t.evidence.every((e) => e.where.length > 0));
  }

  const wealth = extractTopic(a, 'wealth');
  check('겉과 속을 나눠 센다', wealth.count === 0 && wealth.hiddenCount === 2,
    `겉 ${wealth.count} · 숨은 ${wealth.hiddenCount}`);
  check('겉이 비었어도 "없다"고 말하지 않는다',
    wealth.notes.some((n) => n.includes('숨어 있습니다')) &&
    !wealth.notes.some((n) => n.includes('명식에 없습니다')));
  check('지장간 근거는 깊이를 표시한다', wealth.evidence.every((e) => e.depth === '지장간'));

  const career = extractTopic(a, 'career');
  check('겉으로 드러난 십신은 천간·지지로 잡힌다',
    career.evidence.some((e) => e.depth === '천간' || e.depth === '지지'));
  check('십신이 상징하는 영역을 함께 준다', career.aspects.length > 0, career.aspects[0]);

  // 용신은 "써야 할 기운"과 "덜어낼 기운"을 구분한다
  const favorables = topics.filter((t) => t.favorable === true).map((t) => t.term);
  const avoids = topics.filter((t) => t.favorable === false).map((t) => t.term);
  check('용신이 써야 할 기운을 짚는다', favorables.length > 0, favorables.join(','));
  check('덜어낼 기운도 짚는다 — 많다고 좋은 게 아니다', avoids.length > 0, avoids.join(','));
  check('써야 할 것과 덜어낼 것이 겹치지 않는다',
    favorables.every((f) => !avoids.includes(f)));

  // 없는 것을 있다고 하지 않는다
  const charm = extractTopic(a, 'charm');
  check('신살이 없으면 근거도 0건', charm.count > 0 || charm.evidence.length === 0);
  check('없을 때도 겁주지 않는다',
    charm.count > 0 || charm.notes.some((n) => n.includes('막혀 있다는 뜻이 아닙니다')));

  // 이름은 갈아끼울 수 있어야 한다 — 장사의 영역이라 자주 바뀐다
  check('이름표가 계산과 분리돼 있다',
    Object.keys(TOPIC_LABELS).length === ALL_TOPICS.length &&
    ALL_TOPICS.every((id) => TOPIC_LABELS[id].label.length > 0));

  // 신살이 있는 명식으로도 확인한다
  const other = analyze(calculate({ date: '1988-03-03', time: '09:00', longitude: 126.978, gender: '여' }));
  const withSinsal = allTopics(other).filter((t) => t.count > 0 && !t.favorable === false);
  check('다른 명식에서도 주제가 뽑힌다', withSinsal.length > 0, `${withSinsal.length}개 주제`);
  const helper = extractTopic(other, 'helper');
  check('신살 근거는 판정 기준을 밝힌다',
    helper.count === 0 || helper.evidence.every((e) => e.where.includes('—')));
}


// ─── 무료로 펼치는 긴 풀이 ───────────────────────────────────
{
  section('무료 풀이');

  const ms = calculate({ date: '1990-09-25', time: '14:30', longitude: 126.978, gender: '남' });
  const an = analyze(ms);
  const r = freeReading(ms, an, { gender: '남', todayYear: 2026 });

  check('여덟 글자가 네 줄 나온다', r.eight.length === 4);
  check('일간 자리는 십신 대신 「나」', r.eight.some((row) => row.stemGod === '나'));
  check('오행 막대는 다섯 개', r.bars.length === 5);
  check('막대 무게 합이 100 언저리',
    Math.abs(r.bars.reduce((a, b) => a + b.pct, 0) - 100) <= 2,
    `${r.bars.reduce((a, b) => a + b.pct, 0)}`);
  check('막대에 쉬운 말이 붙는다', r.bars.every((b) => b.plain !== b.element));

  check('힘의 방향을 말한다', ['신강', '중화', '신약'].includes(r.strength.verdict));
  check('채워야 할 기운을 쉬운 말로', r.fill.say.length > 0);

  check('십 년 운이 나온다', r.luck.length === 10);
  check('지금 지나는 십 년은 하나뿐',
    r.luck.filter((l) => l.now).length <= 1);
  check('십 년 운마다 붙는지 부딪히는지 말한다',
    r.luck.every((l) => l.say.length > 0));
  check('올해부터 세 해', r.years.length === 3 && r.years[0].year === 2026 && r.years[0].now);

  // 성별을 모르면 대운의 방향을 정할 수 없다. 없는 값을 지어내지 않는다
  const noSex = freeReading(ms, an, { gender: null, todayYear: 2026 });
  check('성별을 모르면 십 년 운을 내지 않는다', noSex.luck.length === 0);
  check('그래도 나머지는 다 준다', noSex.eight.length === 4 && noSex.bars.length === 5);

  // 같은 명식이면 언제나 같은 풀이가 나와야 한다
  const again = freeReading(ms, an, { gender: '남', todayYear: 2026 });
  check('같은 명식이면 같은 풀이', JSON.stringify(again) === JSON.stringify(r));

  // 끊는 자리를 스스로 말한다 — 손님이 속았다고 느끼지 않게
  check('어디서 끊는지 밝힌다', r.cut.length > 20);

  // 시를 모르는 손님도 있다
  const noTime = calculate({ date: '1990-09-25', longitude: 126.978, gender: '여' });
  const rt = freeReading(noTime, analyze(noTime), { gender: '여', todayYear: 2026 });
  check('시를 몰라도 세 줄은 나온다', rt.eight.length === 3);

  check('쉬운 말 표가 다섯씩',
    Object.keys(GOD_PLAIN).length === 5 && Object.keys(ELEMENT_PLAIN).length === 5);
}

console.log(`\n${'═'.repeat(60)}`);
console.log(`통과 ${passed} / 실패 ${failed}`);
if (failed) {
  console.log('\n실패 항목:');
  for (const f of failures) console.log(`  - ${f}`);
  process.exit(1);
}
console.log('전부 통과.');
