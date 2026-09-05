/**
 * 수리성명학 검증.
 *
 * 이 표가 맞는지 가리는 기준은 **실제 작명소가 발행한 작명서**다. 2024년에
 * 인천의 한 작명원이 낸 종이에 이(李)7 · 준(俊)9 · 희(熹)16 로 네 격이
 * 25·16·23·32 이고 각각 안전격·덕망격·공명격·요행격이라고 적혀 있다.
 * 우리 계산과 표가 그것과 어긋나면 여기서 걸린다.
 */

import {
  EIGHTY_ONE, number81, fourFrames, readFrames, middleStrokeCandidates,
} from './src/index.ts';

let passed = 0, failed = 0;
const failures: string[] = [];
function check(label: string, ok: boolean, detail = '') {
  if (ok) { passed++; console.log(`  ✓ ${label}${detail ? `  ${detail}` : ''}`); }
  else { failed++; failures.push(label); console.log(`  ✗ ${label}${detail ? `  ${detail}` : ''}`); }
}
function section(t: string) { console.log(`\n${t}\n${'─'.repeat(60)}`); }

section('81수 표');

check('여든한 수가 다 있다', EIGHTY_ONE.length === 81);
check('1부터 81까지 빠짐없이', EIGHTY_ONE.every((x, i) => x.n === i + 1));
check('모든 수에 이름이 붙는다', EIGHTY_ONE.every((x) => x.name.length >= 3));
check('모든 수를 한 줄로 말한다', EIGHTY_ONE.every((x) => x.say.length > 5));
// 유파가 갈리는 수는 갈린다고 적는다. 한쪽을 골라 단정하지 않는다
check('갈리는 수를 따로 둔다', EIGHTY_ONE.some((x) => x.verdict === '중'));
check('갈리는 수는 그렇다고 밝힌다',
  EIGHTY_ONE.filter((x) => x.verdict === '중').every((x) => x.say.includes('갈린다')));

// 81을 넘으면 한 바퀴 돌아온다
check('82는 1로 돌아온다', number81(82).n === 1);
check('100은 19가 된다', number81(100).n === 19);
check('81은 그대로 81', number81(81).n === 81);
let threw = 0;
for (const bad of [0, -3, 2.5]) { try { number81(bad); } catch { threw++; } }
check('0이나 소수는 던진다', threw === 3);

section('네 격 — 작명소 종이와 대조');

// 이(李)7 · 준(俊)9 · 희(熹)16
const f = fourFrames([7], [9, 16]);
check('원격 25', f.won === 25, `${f.won}`);
check('형격 16', f.hyeong === 16, `${f.hyeong}`);
check('이격 23', f.i === 23, `${f.i}`);
check('정격 32', f.jeong === 32, `${f.jeong}`);

const r = readFrames([7], [9, 16]);
check('25는 안전격', r.wonN.name === '안전격', r.wonN.name);
check('16은 덕망격', r.hyeongN.name === '덕망격', r.hyeongN.name);
check('23은 공명격', r.iN.name === '공명격', r.iN.name);
check('32는 요행격', r.jeongN.name === '요행격', r.jeongN.name);
check('네 격이 모두 길하다', r.allGood);
// 7(양) 9(양) 16(음) — 종이에도 그렇게 적혀 있다
check('음양이 섞였다', r.yinYangMixed);

section('네 격 — 셈법');

check('정격은 전부의 합', fourFrames([7], [9, 16]).jeong === 7 + 9 + 16);
check('두 자 성도 센다', fourFrames([9, 12], [9, 16]).jeong === 9 + 12 + 9 + 16);
check('두 자 성의 형격은 성 합에 이름 첫 자',
  fourFrames([9, 12], [9, 16]).hyeong === 9 + 12 + 9);

// 이름이 한 자면 빈자리에 가성수 1을 넣는다
const one = fourFrames([7], [9]);
check('외자 이름은 원격에 가성수를 넣는다', one.won === 9 + 1, `${one.won}`);
check('외자 이름의 정격에는 가성수를 넣지 않는다', one.jeong === 7 + 9, `${one.jeong}`);
check('외자 이름의 형격과 이격이 같다', one.hyeong === 7 + 9 && one.i === 7 + 1,
  `형 ${one.hyeong} · 이 ${one.i}`);

let threw2 = 0;
try { fourFrames([], [9, 16]); } catch { threw2++; }
try { fourFrames([7], []); } catch { threw2++; }
check('성이나 이름이 비면 던진다', threw2 === 2);

// 다 홀수거나 다 짝수면 치우친 것으로 본다
check('다 홀수면 안 섞인 것', !readFrames([7], [9, 15]).yinYangMixed);
check('다 짝수면 안 섞인 것', !readFrames([8], [10, 16]).yinYangMixed);

section('돌림자를 쓸 때 — 가운데 획수 좁히기');

// 형이 「이준희」면 동생도 「이○희」. 고를 수 있는 것은 가운데 획수뿐이다
const cands = middleStrokeCandidates([7], 16);
check('후보가 나온다', cands.length > 0, `${cands.map((c) => c.stroke).join(', ')}획`);
check('후보는 전부 네 격이 길하다', cands.every((c) => c.frames.allGood));
check('형이 쓴 9획도 후보에 있다', cands.some((c) => c.stroke === 9));
// 후보에 없는 획수는 어딘가 흉해야 한다 — 그래야 좁힌 것이 의미가 있다
const picked = new Set(cands.map((c) => c.stroke));
check('후보에서 빠진 획수는 흉한 격이 있다',
  [...Array(30)].every((_, i) => picked.has(i + 1) || !readFrames([7], [i + 1, 16]).allGood));
check('찾는 범위를 정할 수 있다',
  middleStrokeCandidates([7], 16, 10).every((c) => c.stroke <= 10));

console.log(`\n${'═'.repeat(60)}`);
console.log(`통과 ${passed} / 실패 ${failed}`);
if (failed) { console.log('\n실패 항목:'); for (const x of failures) console.log(`  - ${x}`); process.exit(1); }
console.log('전부 통과.');
