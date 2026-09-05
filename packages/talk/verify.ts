/**
 * 신령 상담 검증.
 *
 * 이 조각이 지켜야 하는 것은 세 가지다.
 *
 * 1. **넘지 않는 선을 넘지 않는다.** 병·죽음·투자·법을 물으면 답하지 않는다.
 *    이건 모델을 부르기 **전에** 막혀야 한다 — 부르고 나서 막으면 이미 돈이
 *    나갔고, 답이 새어 나올 수도 있다.
 * 2. **열쇠가 없어도 답이 나온다.** 지금 이 집에는 모델 열쇠가 없다.
 *    그래도 손님은 빈 화면을 보면 안 된다.
 * 3. **답만 하지 않고 되묻는다.** 되묻지 않으면 상담이 아니라 안내문이다.
 */

import {
  talk, opening, FREE_TURNS, blockOf, cleanAsk, cleanFacts, MAX_ASK,
  scriptedReply, intentOf, buildSystem, splitAsk, TALK_MODEL, TALK_MAX_TOKENS,
  PERSONAS, missingPersonas, plainGod, plainElement, type TalkFacts,
  taste, chooseAsk, EMPTY_FACTS,
} from './src/index.ts';
import { SPIRITS } from '../site-policy/src/spirits.ts';
import { readFileSync } from 'node:fs';

let passed = 0, failed = 0;
const failures: string[] = [];
function check(label: string, ok: boolean, detail = '') {
  if (ok) { passed++; console.log(`  ✓ ${label}${detail ? `  ${detail}` : ''}`); }
  else { failed++; failures.push(label); console.log(`  ✗ ${label}${detail ? `  ${detail}` : ''}`); }
}
function section(t: string) { console.log(`\n${t}\n${'─'.repeat(60)}`); }

const F: TalkFacts = {
  name: '민수', dayStem: '갑', dayElement: '목', eight: '갑자 을축 병인 정묘',
  strong: true, topGod: '식상', lackGod: '관성', topElement: '목', lackElement: '금',
  timeKnown: true,
};

section('1. 신령마다 사람이 하나씩 있다');
{
  check('빠진 신령이 없다', missingPersonas().length === 0, missingPersonas().join(','));
  check('말투가 신령마다 다르다',
    new Set(Object.values(PERSONAS).map((p) => p.voice)).size === SPIRITS.length);
  check('첫 물음도 신령마다 다르다',
    new Set(Object.values(PERSONAS).map((p) => p.opener)).size === SPIRITS.length);
  // 신령을 새로 앉히면 여기서 걸린다
  check('신령 수와 사람 수가 같다', Object.keys(PERSONAS).length === SPIRITS.length);
}

section('2. 넘지 않는 선');
{
  const cases: [string, string][] = [
    ['암 수술 받아야 할까요', 'medical'],
    ['제가 언제 죽나요', 'death'],
    ['비트코인 사도 되나요', 'invest'],
    ['소송 걸어도 이길까요', 'legal'],
    ['죽고 싶어요', 'harm'],
  ];
  for (const [ask, kind] of cases) {
    check(`「${ask}」는 ${kind} 로 막는다`, blockOf(ask).kind === kind);
  }
  check('보통 물음은 안 막는다', blockOf('그 사람이 왜 연락을 안 할까요').kind === null);
  // 목숨 이야기는 막는 것으로 끝내면 안 된다. 갈 곳을 알려 줘야 한다
  check('목숨 이야기에는 갈 곳을 알려 준다', blockOf('죽고 싶어요').say.includes('109'));
  check('몸 이야기는 의사에게 보낸다', blockOf('암 수술 받아야 할까요').say.includes('의사'));
}

section('3. 열쇠가 없어도 답이 나온다');
{
  const r = await talk({ spiritId: 'mountain', facts: F, ask: '엄마랑 계속 부딪혀요', history: [], turn: 0 });
  check('답이 비어 있지 않다', r.text.length > 20, `${r.text.length}자`);
  check('모델을 안 불렀다', r.byModel === false);
  check('되묻는 말이 붙는다', r.ask.length > 0, r.ask);
  check('공짜가 아직 남았다고 알려 준다', r.left === FREE_TURNS - 1);
  check('아직 상품으로 넘기지 않는다', r.close === '');
}

section('4. 같은 말을 세 번 하지 않는다');
{
  const said: string[] = [];
  for (let t = 0; t < FREE_TURNS; t++) {
    const r = await talk({ spiritId: 'flower', facts: F, ask: '왜 연락이 없을까요', history: [], turn: t });
    said.push(r.text);
  }
  check('세 번 다 다르게 말한다', new Set(said).size === FREE_TURNS);
  const asks = [0, 1, 2].map((t) => scriptedReply('flower', F, '왜 연락이 없을까요', t).ask);
  check('되묻는 말도 세 번 다 다르다', new Set(asks).size === 3);
}

section('5. 공짜가 끝나면 제대로 보라고 한다');
{
  const r = await talk({ spiritId: 'jar', facts: F, ask: '이직할까요', history: [], turn: FREE_TURNS - 1 });
  check('남은 횟수가 0이다', r.left === 0);
  check('상품으로 넘기는 말이 붙는다', r.close.length > 0);
  // 값을 신령이 부르면 그때부터 상담이 아니라 호객이다
  check('신령이 값을 부르지 않는다', !/원|₩|\d{4,}/.test(r.close + r.text));
}

section('6. 이름을 틀리게 부르지 않는다');
{
  const a = scriptedReply('mirror', { ...F, name: '민수' }, '나는 어떤 사람이야', 0).text;
  const b = scriptedReply('mirror', { ...F, name: '민혁' }, '나는 어떤 사람이야', 0).text;
  check('받침 없는 이름에는 「야」', a.startsWith('민수야,'), a.slice(0, 6));
  check('받침 있는 이름에는 「아」', b.startsWith('민혁아,'), b.slice(0, 6));
  const c = scriptedReply('mirror', { ...F, name: '' }, '나는 어떤 사람이야', 0).text;
  check('이름이 없으면 이름 없이 말한다', !c.startsWith(','));
}

section('7. 손님이 보낸 것을 그대로 믿지 않는다');
{
  check('긴 글은 자른다', cleanAsk('가'.repeat(1000)).length === MAX_ASK);
  check('태그 글자는 지운다', !cleanAsk('<script>나쁜 것</script>').includes('<'));
  check('글자가 아니면 빈 값', cleanAsk({ a: 1 }) === '');
  const f = cleanFacts({ name: '<b>홍길동홍길동홍길동</b>', strong: 'yes', eight: 1 });
  check('이름 길이를 자른다', f.name.length <= 10, f.name);
  check('참이 아니면 거짓으로 둔다', f.strong === false);
  check('글자가 아닌 값은 빈 값', f.eight === '');
}

section('8. 첫 인사');
{
  const o = opening('mountain', F);
  check('여덟 글자를 짚어 준다', o.text.includes(F.eight));
  check('이름을 부른다', o.text.includes('민수'));
  check('신령이 먼저 묻는다', o.text.includes(PERSONAS.mountain!.opener));
  const noName = opening('mountain', { ...F, name: '', eight: '' });
  check('아는 게 없어도 말은 나온다', noName.text.length > 10, noName.text);
}

section('9. 모델에게 주는 지시');
{
  const sys = buildSystem('mountain', F);
  check('신령 이름이 들어간다', sys.includes('산신령'));
  check('말투가 들어간다', sys.includes(PERSONAS.mountain!.voice));
  check('여덟 글자가 들어간다', sys.includes(F.eight));
  check('쉬운 말로 바꾼 것도 같이 준다', sys.includes(plainGod('식상')) && sys.includes(plainElement('금')));
  // 모델이 넘지 말아야 할 선은 지시에도 있어야 한다. 막는 것만으로는 부족하다
  check('지어내지 말라고 못 박는다', sys.includes('지어내지 않는다'));
  check('값을 말하지 말라고 못 박는다', sys.includes('값이나 상품 이름을 말하지 않는다'));
  check('되물으라고 못 박는다', sys.includes('되묻는다'));
  check('태어난 시를 모르면 그렇다고 알려 준다',
    buildSystem('mountain', { ...F, timeKnown: false }).includes('시주 이야기는 하지 않는다'));
  // 상담은 짧고 여러 번이다. 리포트처럼 길게 쓸 일이 없다
  check('상담은 값싼 모델로 한다', TALK_MODEL === 'claude-sonnet-5');
  check('답 길이를 묶어 둔다', TALK_MAX_TOKENS <= 600);
}

section('10. 모델 답에서 되묻는 말을 떼어 낸다');
{
  const r = splitAsk('그렇구나. 오래 참았네.\n되묻기: 언제부터 그랬니?');
  check('본문만 남는다', r.text === '그렇구나. 오래 참았네.');
  check('되묻는 말이 따로 나온다', r.ask === '언제부터 그랬니?');
  const plain = splitAsk('되묻기 없이 온 답');
  check('되묻기가 없어도 답은 나온다', plain.text === '되묻기 없이 온 답' && plain.ask === '');
}

section('11. 물음의 갈래');
{
  check('때를 묻는 것을 알아본다', intentOf('언제쯤 될까요') === '언제');
  check('되냐고 묻는 것을 알아본다', intentOf('해도 괜찮을까요') === '될까');
  check('까닭을 묻는 것을 알아본다', intentOf('왜 그럴까요') === '왜');
  check('사람 이야기를 알아본다', intentOf('그 사람이 어떤가요') === '사람');
  check('못 알아들어도 답은 한다', intentOf('음') === '기타');
}

section('12. 모델이 막혀도 손님은 답을 받는다');
{
  const broken = {
    messages: { create: async () => { throw new Error('네트워크 끊김'); } },
  } as any;
  const r = await talk(
    { spiritId: 'wind', facts: F, ask: '이사 언제 갈까요', history: [], turn: 0 },
    { useModel: true, client: broken },
  );
  check('빈 화면을 주지 않는다', r.text.length > 20);
  check('대본이 받았다', r.byModel === false);
}

section('13. 모델 꾸러미가 없어도 서버는 뜬다');
{
  // 맨 위에서 불러오면 꾸러미가 빠진 날 서버가 아예 안 뜬다.
  // 상담 하나 때문에 약관 페이지까지 같이 죽는다 — 전에 pg 로 같은 사고를 냈다
  const src = readFileSync(new URL('./src/model.ts', import.meta.url), 'utf8');
  check('모델 꾸러미는 쓸 때 불러온다',
    !/^import Anthropic from/m.test(src) && src.includes("await import('@anthropic-ai/sdk')"));
  check('타입만 맨 위에서 가져온다', /^import type Anthropic from/m.test(src));
}

section('14. 한도를 넘으면 모델을 안 부른다');
{
  let called = 0;
  const spy = { messages: { create: async () => { called++; return { content: [] }; } } } as any;
  await talk({ spiritId: 'wind', facts: F, ask: '이사 갈까요', history: [], turn: 0 },
    { useModel: true, overBudget: true, client: spy });
  check('한도를 넘으면 안 부른다', called === 0);
  // 막히는 물음은 모델을 부르기 전에 막혀야 한다
  await talk({ spiritId: 'wind', facts: F, ask: '주식 사도 되나요', history: [], turn: 0 },
    { useModel: true, client: spy });
  check('막히는 물음은 부르기 전에 막는다', called === 0);
}

section('15. 고르면 그 자리에서 한 조각 봐 준다');
{
  const t = taste('child-report', F);
  check('풀이가 두 줄 이상 나온다', t.lines.length >= 2, `${t.lines.length}줄`);
  check('그 손님 사주에서 나온 말이다',
    t.lines.some((l) => l.includes('제 힘으로 미는')) && t.lines.some((l) => l.includes(plainGod(F.topGod))));
  check('끊는 자리를 신령이 직접 말한다', t.more.length > 10);
  // 값을 신령이 부르면 그때부터 상담이 아니라 호객이다
  check('값이나 상품 이름을 말하지 않는다',
    !/원|₩/.test(t.lines.join(' ') + t.more) && !t.lines.join(' ').includes('리포트'));

  // 갈래마다 다른 말을 해야 한다. 같으면 여덟 신령이 한 명이다
  const said = ['child-report', 'reunion-report', 'wealth-report', 'cross-report']
    .map((id) => taste(id, F).lines[0]);
  check('갈래마다 다르게 말한다', new Set(said).size === 4);

  // 신강·신약이 뒤집히면 말도 뒤집혀야 한다
  const weak = taste('child-report', { ...F, strong: false });
  check('힘의 방향이 바뀌면 말도 바뀐다', weak.lines[0] !== t.lines[0]);

  // 아는 게 없어도 빈 화면을 주지 않는다
  const bare = taste('child-report', { ...EMPTY_FACTS });
  check('아는 게 없어도 말은 나온다', bare.lines.length >= 1);

  check('모르는 상품은 거절한다', (() => {
    try { taste('없는상품', F); return false; } catch { return true; }
  })());

  const ask = chooseAsk(F);
  check('무엇부터 보고 싶은지 묻는다', ask.includes('무엇부터'));
}

console.log(`\n${'═'.repeat(60)}`);
console.log(`통과 ${passed} · 실패 ${failed}`);
if (failed) { console.log('\n실패 항목:'); for (const f of failures) console.log(`  - ${f}`); process.exit(1); }
