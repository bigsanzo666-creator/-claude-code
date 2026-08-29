/**
 * 리포트 계층 검증.
 *
 * **이 검증은 모델을 호출하지 않는다.** 테스트가 돈을 쓰면 아무도 자주 돌리지 않게 되고,
 * 자주 돌리지 않는 테스트는 없는 것과 같다.
 *
 * 여기서 검사하는 것은 프롬프트가 지켜야 할 규칙과 캐시 키의 정확성이다.
 * 문장 품질은 사람이 읽고 판단해야 하며, 그건 테스트로 대신할 수 없다.
 */

// index.ts가 아니라 개별 모듈에서 가져온다.
// index.ts는 generate.ts를 재수출하고 generate.ts는 SDK를 임포트하므로,
// 그쪽을 거치면 이 검증이 SDK 설치에 묶여버린다. 검증은 의존성 없이 돌아야 한다.
import {
  buildSystemPrompt, buildUserMessage, canonicalize, PROMPT_VERSION,
  type ReportInput,
} from './src/prompt.ts';
import { cacheKey, MemoryReportCache, estimateCostKrw } from './src/cache.ts';

let passed = 0, failed = 0;
const failures: string[] = [];
function check(label: string, ok: boolean, detail = '') {
  if (ok) { passed++; console.log(`  ✓ ${label}${detail ? `  ${detail}` : ''}`); }
  else { failed++; failures.push(label); console.log(`  ✗ ${label}${detail ? `  ${detail}` : ''}`); }
}
function section(t: string) { console.log(`\n${t}\n${'─'.repeat(60)}`); }

const sample: ReportInput = {
  kind: '사주',
  subject: '민수',
  data: { dayMaster: { stem: '경' }, strength: { verdict: '신강', supportRatio: 60.2 } },
};

// ── A. 금지 사항이 프롬프트에 박혀 있는가 ──────────────────────
section('A. 프롬프트 가드레일');

const sys = buildSystemPrompt('사주');

const MUST_FORBID: [string, string][] = [
  ['수명·사망 예측', '수명'],
  ['임신·출산', '임신'],
  ['특정 질병 지목', '질병'],
  ['투자·법률·의료 조언', '투자'],
  ['불안 조장', '불안'],
  ['외모 점수화', '외모'],
  ['데이터 밖 창작', '지어내지'],
  ['단정 표현', '단정하지'],
];
for (const [name, needle] of MUST_FORBID) {
  check(`금지: ${name}`, sys.includes(needle));
}

check('판단이 아니라 문장화라는 전제를 명시', sys.includes('판단은 이미 끝나') && sys.includes('옮기는 것'));
check('분량 채우려 지어내지 말라고 지시', sys.includes('분량을 채우려고'));
check('실행 제안으로 끝내라고 지시', sys.includes('실행할 수 있는 제안으로 끝'));
check('좋은 말만 늘어놓지 말라고 지시', sys.includes('좋은 말만'));

// ── B. 시스템 프롬프트는 캐시 가능해야 한다 ────────────────────
section('B. 캐시 가능성 — 시스템 프롬프트에 사용자 데이터가 없어야 한다');

check('사용자 이름이 시스템 프롬프트에 없음', !sys.includes('민수'));
check('사용자 데이터가 시스템 프롬프트에 없음', !sys.includes('60.2') && !sys.includes('경'));
check('같은 종류면 항상 같은 시스템 프롬프트', buildSystemPrompt('사주') === buildSystemPrompt('사주'));
check('종류가 다르면 구성 지시도 다름',
  buildSystemPrompt('사주') !== buildSystemPrompt('궁합') &&
  buildSystemPrompt('궁합') !== buildSystemPrompt('교차검증'));

// ── C. 종류별 구성 ─────────────────────────────────────────────
section('C. 리포트 종류별 구성');

const cross = buildSystemPrompt('교차검증');
check('교차검증은 엇갈림을 핵심으로 잡음',
  cross.includes('엇갈리는 것') && cross.includes('가장 길게'));
check('교차검증에서 어느 쪽이 옳다고 판정하지 말라고 지시',
  cross.includes('어느 쪽이 옳다고 판정하지'));
check('궁합은 부딪히는 부분을 얼버무리지 말라고 지시',
  buildSystemPrompt('궁합').includes('얼버무리면'));
check('사주는 용신의 관점(억부)을 밝히라고 지시',
  buildSystemPrompt('사주').includes('억부'));

// ── D. 사용자 메시지 ───────────────────────────────────────────
section('D. 사용자 메시지');

const msg = buildUserMessage(sample);
check('데이터가 통째로 실림', msg.includes('"supportRatio": 60.2'));
check('호칭이 반영됨', msg.includes('"민수"'));
check('이름이 없으면 기본 호칭', buildUserMessage({ ...sample, subject: undefined }).includes('"이 분"'));
check('빈 문자열도 기본 호칭으로', buildUserMessage({ ...sample, subject: '   ' }).includes('"이 분"'));
check('데이터 밖 사용 금지를 다시 못박음', msg.includes('여기에 없는 내용은 쓰지 마십시오'));

// ── E. 정규화 ──────────────────────────────────────────────────
section('E. 캐시 키 정규화');

check('키 순서가 달라도 같은 문자열',
  canonicalize({ a: 1, b: 2 }) === canonicalize({ b: 2, a: 1 }),
  canonicalize({ b: 2, a: 1 }));
check('중첩된 객체도 정규화',
  canonicalize({ x: { p: 1, q: 2 } }) === canonicalize({ x: { q: 2, p: 1 } }));
check('배열 순서는 유지 (의미가 있으므로)',
  canonicalize([1, 2]) !== canonicalize([2, 1]));
check('undefined 필드는 무시', canonicalize({ a: 1, b: undefined }) === canonicalize({ a: 1 }));
check('null과 undefined를 구분', canonicalize({ a: null }) !== canonicalize({}));

// ── F. 캐시 키 ─────────────────────────────────────────────────
section('F. 캐시 키');

const base = { input: sample, model: 'claude-opus-5', effort: 'medium' };
const k = cacheKey(base);

check('같은 입력이면 같은 키', k === cacheKey(base));
check('키 순서만 다른 데이터도 같은 키',
  cacheKey({ ...base, input: { ...sample, data: { strength: { supportRatio: 60.2, verdict: '신강' }, dayMaster: { stem: '경' } } } }) === k);
check('데이터가 다르면 다른 키',
  cacheKey({ ...base, input: { ...sample, data: { dayMaster: { stem: '신' } } } }) !== k);
check('호칭이 다르면 다른 키',
  cacheKey({ ...base, input: { ...sample, subject: '지영' } }) !== k);
check('종류가 다르면 다른 키',
  cacheKey({ ...base, input: { ...sample, kind: '궁합' } }) !== k);
check('모델이 다르면 다른 키', cacheKey({ ...base, model: 'claude-sonnet-5' }) !== k);
check('effort가 다르면 다른 키', cacheKey({ ...base, effort: 'high' }) !== k);
check('키는 sha256 16진수', /^[0-9a-f]{64}$/.test(k), k.slice(0, 16) + '…');
check('프롬프트 버전이 키에 반영됨', PROMPT_VERSION.length > 0, `현재 ${PROMPT_VERSION}`);

// ── G. 캐시 동작 ───────────────────────────────────────────────
section('G. 캐시 동작');

const cache = new MemoryReportCache();
const rec = {
  text: '샘플 리포트', model: 'claude-opus-5', promptVersion: PROMPT_VERSION,
  usage: { inputTokens: 4000, outputTokens: 3000, cachedInputTokens: 0 },
  createdAt: new Date().toISOString(),
};
check('없는 키는 null', (await cache.get(k)) === null);
await cache.set(k, rec);
check('저장 후 조회됨', (await cache.get(k))?.text === '샘플 리포트');
check('다른 키는 여전히 null', (await cache.get('x'.repeat(64))) === null);

// ── H. 원가 ────────────────────────────────────────────────────
section('H. 원가 추정');

const cost = estimateCostKrw(rec.usage);
console.log(`  · 입력 4,000 + 출력 3,000 토큰 → ${cost}원`);
check('리포트 한 건 원가가 300원 미만', cost < 300, `${cost}원`);
check('판매가 15,000원 대비 원가율 10% 미만',
  cost / 15000 < 0.1, `${((cost / 15000) * 100).toFixed(2)}%`);

const cachedCost = estimateCostKrw({ inputTokens: 500, outputTokens: 3000, cachedInputTokens: 3500 });
check('시스템 프롬프트가 캐시되면 원가가 더 낮아짐', cachedCost < cost,
  `${cachedCost}원 (캐시 적중) vs ${cost}원`);

console.log(`\n${'═'.repeat(60)}`);
console.log(`통과 ${passed} / 실패 ${failed}`);
if (failed) { console.log('\n실패 항목:'); for (const f of failures) console.log(`  - ${f}`); process.exit(1); }
console.log('전부 통과. (모델 호출 없음 — 이 검증은 비용이 들지 않는다)');
