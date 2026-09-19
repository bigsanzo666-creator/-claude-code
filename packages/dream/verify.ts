/**
 * 꿈해몽 검증.
 *
 * 값을 받지 않는 판이라고 대충 두면, 제일 많은 사람이 보는 자리에 제일 허술한
 * 것이 걸린다. 여기서 보는 것은 셋이다.
 *
 * 1. **엉뚱한 데 걸리지 않는가** — 한 글자 낱말을 넣으면 「소」가 「소식」에 걸린다
 * 2. **지어내지 않는가** — 모르는 꿈은 모른다고 해야 한다
 * 3. **겁주지 않는가** — 놀라기 쉬운 꿈일수록 먼저 안심시켜야 한다
 */

import { SYMBOLS, TONE_LABEL, readDream, symbolCount, sampleWords } from './src/index.ts';

let passed = 0, failed = 0;
const failures: string[] = [];
function check(label: string, ok: boolean, detail = ''): void {
  if (ok) { passed++; console.log(`  ✓ ${label}${detail ? `  ${detail}` : ''}`); }
  else { failed++; failures.push(label); console.log(`  ✗ ${label}${detail ? `  ${detail}` : ''}`); }
}
const head = (t: string) => console.log(`\n${t}\n${'─'.repeat(60)}`);

// ── 표 자체 ────────────────────────────────────────────────
head('표');

check('낱말이 넉넉히 있다', symbolCount() >= 30, `${symbolCount()}가지`);

const ids = SYMBOLS.map((s) => s.id);
check('같은 이름이 두 번 나오지 않는다', new Set(ids).size === ids.length);

const shortWords = SYMBOLS.flatMap((s) => s.words.filter((w) => w.replace(/\s/g, '').length < 2)
  .map((w) => `${s.id}:${w}`));
check('한 글자짜리 낱말이 없다', shortWords.length === 0,
  shortWords.length ? shortWords.join(', ') : '「소」 한 글자면 「소식」에도 걸린다');

const emptyish = SYMBOLS.filter((s) => !s.say.trim() || !s.more.trim() || !s.words.length);
check('빈 칸으로 둔 낱말이 없다', emptyish.length === 0, emptyish.map((s) => s.id).join(', '));

check('좋고 나쁨에 이름표가 다 있다',
  SYMBOLS.every((s) => Boolean(TONE_LABEL[s.tone])));

// ── 엉뚱한 데 걸리지 않는가 ────────────────────────────────
head('엉뚱한 데 걸리지 않는가');

const decoys: [string, string][] = [
  ['소식을 기다리고 있어요', '소'],
  ['평소에 잘 안 꾸는데요', '소'],
  ['용기를 냈어요', '용'],
  ['범위가 넓었어요', '호랑이'],
  ['개인적인 일이에요', '개'],
  ['쥐고 있었어요', '쥐'],
];
for (const [text, mustNot] of decoys) {
  const got = readDream(text).hits.map((h) => h.id);
  check(`「${text}」 → ${mustNot} 으로 잘못 걸리지 않는다`, !got.includes(mustNot),
    got.length ? `걸린 것: ${got.join(', ')}` : '아무것도 안 걸림');
}

// ── 제대로 걸리는가 ────────────────────────────────────────
head('제대로 걸리는가');

const cases: [string, string[]][] = [
  ['커다란 돼지가 집으로 들어왔어요', ['돼지', '집']],
  ['이가 빠지는 꿈을 꿨어요', ['이빨']],
  ['구렁이가 품에 안겼어요', ['뱀']],
  ['돌아가신 할머니가 나오셨어요', ['죽음', '돌아가신 분']],
  ['전 남자친구가 나왔어요', ['헤어진 사람']],
  ['똥을 밟았어요', ['똥']],
  ['하늘을 날았어요', ['나는 꿈']],
];
for (const [text, want] of cases) {
  const got = readDream(text).hits.map((h) => h.id);
  const ok = want.every((w) => got.includes(w));
  check(`「${text}」`, ok, `걸린 것: ${got.join(', ') || '없음'}`);
}

// ── 지어내지 않는가 ────────────────────────────────────────
head('지어내지 않는가');

for (const text of ['그냥 회사에 갔어요', '아무것도 기억 안 나요', '', '   ']) {
  const r = readDream(text);
  check(`「${text || '(빈 글)'}」 → 모른다고 말한다`, r.hits.length === 0 && Boolean(r.miss));
}

const known = readDream('돼지꿈을 꿨어요');
check('찾았을 때는 지어낸 말을 붙이지 않는다', known.miss === null);

// ── 근거를 다는가 ──────────────────────────────────────────
head('근거를 다는가');

const withBasis = readDream('돼지가 나오고 이가 빠졌어요');
check('풀이마다 어느 낱말에서 나왔는지 적는다',
  withBasis.hits.length > 0 && withBasis.hits.every((h) => Boolean(h.found)),
  withBasis.hits.map((h) => `${h.id}←${h.found}`).join(', '));

check('근거로 적은 낱말이 실제로 손님 글에 있다',
  withBasis.hits.every((h) => '돼지가 나오고 이가 빠졌어요'.replace(/\s/g, '').includes(h.found.replace(/\s/g, ''))));

// ── 겁주지 않는가 ──────────────────────────────────────────
head('겁주지 않는가');

/** 이런 말이 화면에 나가면 안 된다 */
const SCARY = ['흉몽', '불행', '재앙', '화를 입', '죽게', '큰일 납', '부적', '액운을 막', '반드시 나쁜'];
const scaryFound = SYMBOLS.flatMap((s) =>
  SCARY.filter((w) => (s.say + s.more).includes(w)).map((w) => `${s.id}:${w}`));
check('겁주는 말을 쓰지 않는다', scaryFound.length === 0, scaryFound.join(', '));

// 놀라기 쉬운 꿈은 전통 해몽대로 좋게 본다. 손님이 제일 무서워하는 자리다
for (const id of ['죽음', '피', '뱀', '불', '똥']) {
  const sym = SYMBOLS.find((s) => s.id === id)!;
  check(`${id} 은 좋게 보는 꿈으로 둔다`, sym.tone === '길', sym.say.slice(0, 32));
}

const scared = readDream('사람이 죽고 피가 났어요');
check('놀랄 꿈이라도 먼저 안심시킨다',
  scared.hits.length > 0 && scared.hits[0].tone === '길',
  `맨 앞: ${scared.hits[0]?.id}`);

// ── 늘어놓지 않는가 ────────────────────────────────────────
head('늘어놓지 않는가');

const many = readDream('돼지 뱀 용 호랑이 물고기 소 돈 불 아기 똥이 다 나왔어요');
check('한 번에 넉 줄까지만 보여 준다', many.hits.length <= 4, `${many.hits.length}줄`);
check('좋게 보는 것을 앞에 둔다',
  many.hits.every((h, i) => i === 0 || !(many.hits[i - 1].tone !== '길' && h.tone === '길')));

check('예시 낱말을 내놓는다', sampleWords(5).length === 5, sampleWords(5).join(', '));

// ── 맺음 ───────────────────────────────────────────────────
console.log(`\n${'═'.repeat(60)}`);
console.log(`통과 ${passed} · 실패 ${failed}`);
if (failed) {
  console.log('\n실패한 것:');
  for (const f of failures) console.log(`  · ${f}`);
  process.exit(1);
}
