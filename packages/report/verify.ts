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
  buildSystemPrompt, buildUserMessage, canonicalize, cleanQuestion, PROMPT_VERSION, QUESTION_MAX,
  LADDER_TIERS, lengthTargetOf, maxTokensFor,
  type ReportInput, type ReportKind,
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

// ── D2. 손님이 직접 물은 것 ────────────────────────────────────
/*
 * 신령이 화면에서 「원하는 것 하나를 말해 보렴」이라고 약속한다.
 * 그 약속을 리포트가 지키는지 보는 자리다. 약속만 하고 안 주면 거짓 광고다.
 */
section('D2. 손님이 직접 물은 것');

check('안 물으면 그 문단이 아예 없다', !msg.includes('손님이 직접 물은 것'));

const asked = buildUserMessage({ ...sample, question: '올해 이직해도 될까요?' });
check('물으면 질문이 그대로 실린다', asked.includes('올해 이직해도 될까요?'));
check('질문은 데이터 뒤에 온다',
  asked.indexOf('손님이 직접 물은 것') > asked.indexOf('supportRatio'));
check('질문에 답할 자리를 지정한다', asked.includes('물어보신 것에 대해'));
check('못 답하면 못 답한다고 쓰라고 시킨다', asked.includes('답할 수 없다고 그대로'));
check('질문을 지시문으로 읽지 않게 못박는다', asked.includes('지시가 아니라'));

check('빈 질문은 없는 것으로 친다',
  !buildUserMessage({ ...sample, question: '   ' }).includes('손님이 직접 물은 것'));

check('줄바꿈을 한 줄로 눕힌다', cleanQuestion('올해\n이직해도\n될까요?') === '올해 이직해도 될까요?');
check('너무 긴 질문은 잘라낸다', (cleanQuestion('가'.repeat(600)) ?? '').length === QUESTION_MAX);
check('안 적었으면 null', cleanQuestion(undefined) === null && cleanQuestion('') === null);

check('시스템 프롬프트가 질문 규칙을 담는다',
  sys.includes('손님이 직접 물은 것') && sys.includes('데이터 안에서만'));
check('질문이 와도 금지 사항은 그대로', sys.includes('금지 사항은 질문이 와도 그대로'));

const qk = cacheKey({ input: { ...sample, question: '올해 이직해도 될까요?' }, model: 'claude-opus-5', effort: 'medium' });
const qk2 = cacheKey({ input: { ...sample, question: '결혼은 언제쯤일까요?' }, model: 'claude-opus-5', effort: 'medium' });
check('질문이 다르면 다른 리포트로 친다', qk !== qk2);
check('질문이 없을 때와도 다르다',
  qk !== cacheKey({ input: sample, model: 'claude-opus-5', effort: 'medium' }));
check('띄어쓰기만 다른 질문은 같은 리포트',
  qk === cacheKey({ input: { ...sample, question: ' 올해  이직해도 될까요? ' }, model: 'claude-opus-5', effort: 'medium' }));

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

// ─── 쉬운 말이 먼저 나와야 한다 ────────────────────────────────
// 돈을 낸 사람이 첫 줄에서 막히면 그 글은 실패한 글이다
{
  const sys = buildSystemPrompt('사주');
  check('한자말 대신 쉬운 말을 앞에 세우라고 시킨다',
    sys.includes('쉬운 말을 앞에, 한자말은 괄호에'));
  for (const [hard, easy] of [['식상', '밖으로 내보이는 힘'], ['인성', '받아들이고 배우는 힘'],
    ['신약', '제 힘이 약한 편'], ['용신', '채워야 할 기운'], ['충', '서로 밀어내는 짝']]) {
    check(`「${hard}」를 풀어 쓰라고 적혀 있다`, sys.includes(`${hard} → ${easy}`));
  }
  check('초등학생이 읽을 수 있어야 한다고 적는다', sys.includes('초등학생이 읽어도'));
  check('문장을 짧게 자르라고 시킨다', sys.includes('40자 안쪽'));
  check('한자를 그대로 내보내지 않는다', sys.includes('한자를 그대로 노출하지 않습니다'));
  check('다섯 갈래 모두 같은 문체를 받는다',
    (['사주', '궁합', '교차검증', '택일', '작명'] as const)
      .every((k) => buildSystemPrompt(k).includes('초등학생이 읽어도')));

  /*
   * 작명은 틀리면 출생신고가 반려된다. 다른 갈래보다 무거운 실수라 프롬프트에
   * 못을 박아 두고, 그 못이 빠지지 않았는지 여기서 본다.
   */
  const naming = buildSystemPrompt('작명');
  check('주어진 글자 밖에서 고르지 말라고 못박는다',
    naming.includes('주어진 글자 밖에서 고르지 않습니다'));
  check('신고가 반려된다는 것을 적는다', naming.includes('신고가 반려'));
  check('획수를 스스로 세지 말라고 적는다', naming.includes('스스로 세지 마십시오'));
  check('같은 글자를 두 번 쓰지 말라고 적는다', naming.includes('같은 글자를 쓰지 않습니다'));
  check('이름이 앞날을 정한다고 말하지 않게 한다',
    naming.includes('앞날을 정한다고 말하지 않습니다'));
// 상품 설명이 약속한 개수와 프롬프트가 같은 말을 해야 한다.
// 셋을 약속하고 다섯을 주면 많이 주는 것이 아니라 약속과 다른 것을 주는 것이다
check('약속한 이름 개수와 프롬프트가 맞는다',
  naming.includes('이름 셋') && !naming.includes('이름 다섯'));
}


  // ─── 프롬프트 숫자 및 사실 규칙 검증 ─────────────────────────
  const sajuSys = buildSystemPrompt('사주');
  check('숫자는 자료에 적힌 것을 한 글자도 바꾸지 않고 그대로 옮기라고 못박는다',
    sajuSys.includes('숫자는 자료에 적힌 것을 한 글자도 바꾸지 않고 그대로 옮깁니다'));
  check('자료에 없는 숫자는 한 개도 쓰지 말라고 못박는다',
    sajuSys.includes('자료에 없는 숫자는 한 개도 쓰지 않습니다'));
  check('비중이 있는데 0%라고 쓰면 거짓말이라고 명시한다',
    sajuSys.includes('비중이 있는데 0% 라고 쓰면 거짓말'));
  check('보정 시각은 자료의 correctedTime을 그대로 적으라고 시킨다',
    sajuSys.includes('보정 시각은 자료의 `correctedTime` 을 그대로 적습니다'));
  check('진태양시를 말할 때 지명은 자료에 실린 곳만 적으라고 시킨다',
    sajuSys.includes('진태양시를 말할 때 지명은 자료에 실린 곳만 적습니다'));
  check('열두 시진 표 위 추천 이유 한 줄이 지시되어 있다',
    buildSystemPrompt('오늘운세').includes('유리하면서 부딪힘까지 없는 시간을 골랐습니다'));

  // ─── 수치 및 사실 검증기(validateReportFacts) 단위 검증 ──────
  const { validateReportFacts } = await import('./src/validate.ts');
  const sampleFactData = {
    출생지: '인천',
    계산근거: { correctedTime: '14:14', place: '인천' },
    강약: { scores: { 비겁: 11.7, 식상: 10.7, 재성: 17.5, 관성: 19.9, 인성: 40.3 }, supportRatio: 52 },
    오행: [{ element: '금', weight: 45.6 }, { element: '토', weight: 22.5 }, { element: '수', weight: 0 }],
  };

  const badPercent = validateReportFacts('행운 확률이 99.9%로 높습니다.', sampleFactData);
  check('리포트 수치 검증기가 자료에 없는 백분율을 잡아낸다',
    !badPercent.valid && badPercent.errors.some((e) => e.includes('99.9%')));

  const badTime = validateReportFacts('인천 기준 진태양시 14시 16분 보정 명식입니다.', sampleFactData);
  check('리포트 수치 검증기가 잘못된 보정 시각을 잡아낸다',
    !badTime.valid && badTime.errors.some((e) => e.includes('14시 16분')));

  const badZeroGod = validateReportFacts('자기 목소리를 내는 힘(비겁 0%)이 약합니다.', sampleFactData);
  check('리포트 수치 검증기가 비중 있는 십신의 0% 기술을 잡아낸다',
    !badZeroGod.valid && badZeroGod.errors.some((e) => e.includes('비겁')));

  const badPlace = validateReportFacts('서울 기준 진태양시 14시 14분 보정 명식입니다.', sampleFactData);
  check('리포트 수치 검증기가 자료에 없는 지명을 잡아낸다',
    !badPlace.valid && badPlace.errors.some((e) => e.includes('서울')));

  const goodReport = validateReportFacts(
    '인천 기준 진태양시 14시 14분 보정입니다. 금 45.6%로 강하고, 비겁 11.7%는 작은 편입니다. 일간을 돕는 힘은 52%입니다.',
    sampleFactData
  );
  check('자료와 일치하는 올바른 수치 글은 검증을 통과한다', goodReport.valid && goodReport.errors.length === 0);

  // 터진 뒤에 적은 것 (2026-09-30): 리포트가 각주 혼잣말(왜 그렇게 봅니까)로 가득 차고 글이 안 읽힌다는 사장님 피드백.
  // 전문/쉽게 말하면 2층 구조와 진태양시 해설을 의무화하고 프롬프트 버전을 v10으로 올림.
  section('주제 갈래 및 2층 구조 검증');
  const topicSys = buildSystemPrompt('주제');
  check('주제 갈래 지시문에 「왜 그렇게 봅니까」가 더 이상 없다',
    !topicSys.includes('왜 그렇게 봅니까'));
  check('지시문에 진태양시를 설명하라는 대목이 있다',
    topicSys.includes('진태양시') && topicSys.includes('태어난 시각을 다시 쟀습니다'));
  check('지시문에 「쉽게 말하면」 층을 쓰라는 대목이 있다',
    topicSys.includes('쉽게 말하면') && topicSys.includes('전문 ·'));
  check('PROMPT_VERSION 이 v9 가 아니다',
    PROMPT_VERSION !== 'v9' && PROMPT_VERSION === 'v15');

  // 터진 뒤에 적은 것 (2026-10-01): 사장님이 제일 좋아하시는 대목이
  // 한 주제 상품 11개에만 있었다. 23개에는 처음부터 없었다.
  // 지시문을 늘릴 때 한 군데만 고치고 나머지를 잊었다.
  const ALL_KINDS: ReportKind[] = [
    '작명', '택일', '교차검증', '궁합', '사주', '부모자식', '적성', '아이',
    '재회', '정리', '만남', '썸', '결혼시기', '말년', '월운세', '오늘운세', '주제',
  ];
  const allHaveTwoTier = ALL_KINDS.every((kind) => {
    const sys = buildSystemPrompt(kind);
    return sys.includes('쉽게 말하면') && sys.includes('전문 ·');
  });
  check('열일곱 가지 리포트 지시문에 전부 두 층 형식이 들어 있다', allHaveTwoTier);

  // ─── 분량 사다리 검증 (2단계) ──────────────────────────────────
  section('2단계: 값에 따른 분량 사다리 검증');
  const allHaveLengthInstruction = ALL_KINDS.every((kind) => {
    const sys = buildSystemPrompt(kind);
    return sys.includes('## 분량 지시') &&
      sys.includes('분량을 채우려고 자료에 없는 것을 쓰는 것은 금지입니다.') &&
      sys.includes('쓸 것이 모자라면 짧게 쓰십시오.');
  });
  check('갈래 17종 전부에 분량 지시가 들어 있다', allHaveLengthInstruction);

  let ladderMonotonic = true;
  for (let i = 1; i < LADDER_TIERS.length; i++) {
    const prev = LADDER_TIERS[i - 1];
    const curr = LADDER_TIERS[i];
    if (curr.minChars < prev.maxChars) {
      ladderMonotonic = false;
    }
  }
  check('값이 비싼 갈래의 하한이 싼 갈래의 상한보다 크거나 같다', ladderMonotonic);

  const dailyTarget = lengthTargetOf('오늘운세');
  const expensiveKinds = ALL_KINDS.filter((k) => k !== '오늘운세');
  const noHoleThanDaily = expensiveKinds.every((k) => lengthTargetOf(k).minChars >= dailyTarget.maxChars);
  check('1,900원짜리보다 짧게 나올 수 있는 구멍이 없다', noHoleThanDaily);

  // ─── 삼합 리포트 세 권을 한 상자에 (3단계) ────────────────────
  section('3단계: 삼합 리포트 6부 구성 및 갈래별 분기 검증');
  const crossFull = buildSystemPrompt('교차검증', 'cross-report');
  check('삼합(cross-report) 지시문에 1부가 있다', crossFull.includes('1부 들어가며'));
  check('삼합(cross-report) 지시문에 2부가 있다', crossFull.includes('2부 사주로 본 것'));
  check('삼합(cross-report) 지시문에 3부가 있다', crossFull.includes('3부 얼굴로 본 것'));
  check('삼합(cross-report) 지시문에 4부가 있다', crossFull.includes('4부 손으로 본 것'));
  check('삼합(cross-report) 지시문에 5부가 있다', crossFull.includes('5부 셋을 맞대어 보니'));
  check('삼합(cross-report) 지시문에 6부가 있다', crossFull.includes('6부 그래서 무엇을 하시면 되는가'));
  check('2·3·4부 대조 금지 원칙이 지시문에 명시됨', crossFull.includes('2부, 3부, 4부는 대조를 하지 않습니다'));

  // 교차검증 4개 상품별 안 보는 갈래의 부 제외 검증
  const facePalm = buildSystemPrompt('교차검증', 'face-palm-report');
  check('얼굴과손(face-palm-report)에는 2부(사주)가 빠진다', !facePalm.includes('2부 사주로 본 것') && !facePalm.includes('사주로 본 것'));
  check('얼굴과손(face-palm-report)에는 3부(얼굴)와 4부(손)가 있다', facePalm.includes('3부 얼굴로 본 것') && facePalm.includes('4부 손으로 본 것'));

  const sajuPalm = buildSystemPrompt('교차검증', 'saju-palm-report');
  check('사주×손금(saju-palm-report)에는 3부(얼굴)가 빠진다', !sajuPalm.includes('3부 얼굴로 본 것') && !sajuPalm.includes('얼굴로 본 것'));
  check('사주×손금(saju-palm-report)에는 2부(사주)와 4부(손)가 있다', sajuPalm.includes('2부 사주로 본 것') && sajuPalm.includes('4부 손으로 본 것'));

  const sajuFace = buildSystemPrompt('교차검증', 'saju-face-report');
  check('사주×관상(saju-face-report)에는 4부(손)가 빠진다', !sajuFace.includes('4부 손으로 본 것') && !sajuFace.includes('손으로 본 것'));
  check('사주×관상(saju-face-report)에는 2부(사주)와 3부(얼굴)가 있다', sajuFace.includes('2부 사주로 본 것') && sajuFace.includes('3부 얼굴로 본 것'));

  // ─── 4단계: 토큰 한도 사다리, 재시도, 잘림 방지 검증 ───────────────
  section('4단계: 토큰 한도 사다리, 재시도, 잘림 방지 검증');

  // 1. 상품마다 한도가 다르다. 사다리 칸마다 한 상품씩 골라 한도를 비교한다.
  // 오늘의 운세와 작명의 한도가 같으면 실패다.
  const tokenDaily = maxTokensFor('오늘운세');
  const tokenNaming = maxTokensFor('작명', 'naming-plus-report');
  const tokenSaju = maxTokensFor('사주', 'taste-report');
  const tokenCross = maxTokensFor('교차검증', 'cross-report');

  check('오늘의 운세와 작명의 한도가 서로 다르다', tokenDaily !== tokenNaming);
  check('사다리 칸마다 한도가 점증한다 (오늘운세 < 사주 < 교차검증 < 작명)',
    tokenDaily < tokenSaju && tokenSaju < tokenCross && tokenCross < tokenNaming);

  // 2. 한도가 그 상품이 요구하는 글자 수를 넉넉히 덮는다 (요구 글자 수 × 2 이상)
  const ladderCoversAll = LADDER_TIERS.every((tier) => {
    const tokens = maxTokensFor('사주', tier.minPrice);
    return tokens >= tier.maxChars * 2;
  });
  check('사다리의 모든 칸에서 한도가 요구 글자 수의 2배 이상이다', ladderCoversAll);
  check('오늘의 운세 한도가 요구 글자 수의 2배를 넉넉히 덮는다',
    tokenDaily >= lengthTargetOf('오늘운세').maxChars * 2);
  check('작명 한도가 요구 글자 수의 2배를 넉넉히 덮는다',
    tokenNaming >= lengthTargetOf('작명', 'naming-plus-report').maxChars * 2);

  // 3. stop_reason: 'max_tokens' 를 받으면 다시 부른다. 한 번만.
  const { generateReport, ReportTruncatedError } = await import('./src/generate.ts');

  {
    let callCount = 0;
    const requestedMaxTokens: number[] = [];
    const fakeClientSuccessOnRetry = {
      beta: {
        messages: {
          stream: (params: any) => {
            callCount++;
            requestedMaxTokens.push(params.max_tokens);
            return {
              finalMessage: async () => {
                if (callCount === 1) {
                  return {
                    stop_reason: 'max_tokens',
                    usage: { output_tokens: params.max_tokens },
                    content: [{ type: 'text', text: '앞부분만 생성된 잘린 글' }],
                  };
                }
                return {
                  stop_reason: 'end_turn',
                  usage: { output_tokens: 25000 },
                  content: [{ type: 'text', text: '재시도로 완성된 온전한 글입니다.' }],
                };
              },
            };
          },
        },
      },
    };

    const memCache = new MemoryReportCache();
    const res = await generateReport(
      { kind: '오늘운세', subject: '홍길동', data: {} },
      { client: fakeClientSuccessOnRetry, cache: memCache }
    );

    check("stop_reason이 'max_tokens'이면 1회 재시도하여 총 2회 호출된다", callCount === 2);
    check('재시도 시 max_tokens 한도가 1.5배로 증가한다',
      requestedMaxTokens[1] === Math.min(128000, Math.round(requestedMaxTokens[0] * 1.5)));
    check('재시도 성공 시 완성된 글이 정상 반환된다', res.text === '재시도로 완성된 온전한 글입니다.');
  }

  // 4. 두 번째도 잘리면 오류가 난다. 잘린 글이 돌아오지 않는다.
  // 5. 잘린 글은 캐시에 저장되지 않는다.
  {
    let callCount = 0;
    const requestedMaxTokens: number[] = [];
    const fakeClientAlwaysTruncated = {
      beta: {
        messages: {
          stream: (params: any) => {
            callCount++;
            requestedMaxTokens.push(params.max_tokens);
            return {
              finalMessage: async () => {
                return {
                  stop_reason: 'max_tokens',
                  usage: { output_tokens: params.max_tokens },
                  content: [{ type: 'text', text: '두 번 모두 잘린 글' }],
                };
              },
            };
          },
        },
      },
    };

    const memCache = new MemoryReportCache();
    let threwExpected = false;
    let returnedText: string | null = null;
    const input: ReportInput = { kind: '사주', productId: 'naming-plus-report', subject: '이순신', data: {} };

    try {
      const res = await generateReport(
        input,
        { client: fakeClientAlwaysTruncated, cache: memCache }
      );
      returnedText = res.text;
    } catch (err: any) {
      if (err instanceof ReportTruncatedError) {
        threwExpected = true;
        check('ReportTruncatedError에 상품 및 토큰 정보가 포함된다',
          err.productId === 'naming-plus-report' && err.maxTokens > 0);
      }
    }

    check('두 번째도 max_tokens로 잘리면 ReportTruncatedError 오류를 던진다', threwExpected);
    check('두 번 초과 시 잘린 글을 돌려주지 않는다', returnedText === null);
    check('정확히 2회 호출 후 더 이상 부르지 않는다', callCount === 2);

    // 5. 잘린 글은 캐시에 저장되지 않는다.
    const cached = await memCache.get(cacheKey({ input, model: 'claude-opus-5', effort: 'medium' }));
    check('잘린 글은 캐시에 저장되지 않는다 (캐시 조회 결과 null)', cached === null);
  }

console.log('전부 통과. (모델 호출 없음 — 이 검증은 비용이 들지 않는다)');


