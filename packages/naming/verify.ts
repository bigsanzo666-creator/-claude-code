import { readFileSync } from 'node:fs';
/**
 * 수리성명학 검증.
 *
 * 이 표가 맞는지 가리는 기준은 **실제 작명소가 발행한 작명서**다. 2024년에
 * 인천의 한 작명원이 낸 종이에 이(李)7 · 준(俊)9 · 희(熹)16 로 네 격이
 * 25·16·23·32 이고 각각 안전격·덕망격·공명격·요행격이라고 적혀 있다.
 * 우리 계산과 표가 그것과 어긋나면 여기서 걸린다.
 */

import {
  EIGHTY_ONE, number81, fourFrames, readFrames, middleStrokeCandidates, frameRows, FRAME_PLAIN,
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


// ─── 남이 낸 감명서와 맞춰 본다 ─────────────────────────────
// 청월당이 공개한 작명 리포트 「김리아 金漓妸」.
// 초년 23 공명격 · 청년 23 공명격 · 장년 16 덕망격 · 전체 31 융창격.
// 원획은 金 8, 漓 15(氵는 水 4획으로 센다), 妸 8.
{
  const rows = frameRows(readFrames([8], [15, 8]));
  const want = [
    ['초년운', 23, '공명격'], ['청년운', 23, '공명격'],
    ['장년운', 16, '덕망격'], ['전체운', 31, '융창격'],
  ] as const;
  check('남의 감명서와 네 격이 다 맞는다',
    rows.length === 4 && rows.every((r, i) =>
      r.when === want[i][0] && r.total === want[i][1] && r.read.name === want[i][2]),
    rows.map((r) => `${r.when} ${r.total} ${r.read.name}`).join(' · '));
  check('네 격이 다 길하다', rows.every((r) => r.read.verdict === '길'));
}

check('격마다 쉬운 이름이 붙는다',
  FRAME_PLAIN.length === 4 && FRAME_PLAIN.every((f) => f.when.endsWith('운') && f.frame.endsWith('격')));
check('줄 순서는 초년부터 전체까지',
  frameRows(readFrames([7], [9, 16])).map((r) => r.when).join() === '초년운,청년운,장년운,전체운');


// ─── 한자 낱글자 표 ───────────────────────────────────────────
{
  const { hanja, hanjaCount, byReading, hasReading, hanjaLegal,
          hanjaLegalReading, hanjaLegalCount, hanjaCommon, hanjaCommonCount } =
    await import('./src/hanja.ts');

  check('표에 글자가 들어 있다', hanjaCount() > 8000, `${hanjaCount()}자`);

  /*
   * 원획이 맞는지는 **남이 낸 감명서**로 본다.
   * 청월당이 공개한 「김리아 金漓妸」에서 네 격이 23·23·16·31 이었고,
   * 거기서 역산하면 金 8, 漓 15, 妸 8 이다.
   */
  for (const [ch, rad, st] of [
    ['金', 167, 8], ['漓', 85, 15], ['妸', 38, 8], ['渡', 85, 13],
    ['李', 39, 7], ['朴', 25, 6], ['崔', 46, 11], ['鄭', 163, 19], ['姜', 38, 9],
  ] as const) {
    const h = hanja(ch);
    check(`${ch} 부수 ${rad} · 원획 ${st}`, !!h && h.radical === rad && h.strokes === st,
      h ? `부수 ${h.radical} 원획 ${h.strokes}` : '표에 없음');
  }

  // 氵는 눈에 세 획이지만 水 네 획으로 센다. 옥편 획수와 다른 것이 정상이다
  check('물 부수는 네 획으로 센다', hanja('渡')!.strokes === 13);
  check('두 가지로 읽는 글자를 다 담는다',
    hanja('金')!.readings.includes('금') && hanja('金')!.readings.includes('김'));

  check('독음으로 찾는다', byReading('도').length > 10, `${byReading('도').length}자`);
  check('획수로 좁힌다', byReading('도', { strokes: 13 }).every((h) => h.strokes === 13));
  check('자원오행으로 좁힌다',
    byReading('도', { elements: ['수'] }).every((h) => h.element === '수'));
  check('둘을 겹쳐 좁힌다',
    byReading('도', { strokes: 13, elements: ['수'] }).some((h) => h.char === '渡'));
  check('없는 독음은 빈 손', byReading('쀍').length === 0 && !hasReading('쀍'));
  check('찾은 차례가 늘 같다',
    JSON.stringify(byReading('은').map((h) => h.char))
    === JSON.stringify(byReading('은').map((h) => h.char)));

  // 갈리는 것을 갈리지 않는 척하지 않는다
  const withEl = byReading('도').filter((h) => h.element !== null).length;
  check('자원오행은 분명한 부수에만 붙는다', withEl > 0 && withEl < byReading('도').length,
    `도 ${byReading('도').length}자 중 ${withEl}자`);

  /*
   * 인명용 한자표. 목록 밖 글자로 지은 이름은 출생신고가 반려된다.
   */
  check('인명용 목록이 들어 있다', hanjaLegalCount() > 7000, `${hanjaLegalCount()}자`);
  for (const ch of '金李朴崔鄭姜尹張林韓吳申徐權黃安宋柳洪') {
    check(`${ch} 는 쓸 수 있다`, hanjaLegal(ch));
  }
  // 목록 밖 글자는 거짓이어야 한다
  check('목록 밖 글자는 못 쓴다', !hanjaLegal('龘') && !hanjaLegal('㙊'));
  check('한자가 아닌 것도 못 쓴다', !hanjaLegal('가') && !hanjaLegal('A'));

  /*
   * 표는 「이 표에 적힌 발음으로만」 쓰라고 못박는다.
   * 다만 첫소리 ㄴ·ㄹ 은 소리 나는 대로 ㅇ·ㄴ 으로도 쓸 수 있다 (주 1).
   */
  check('金 은 금으로도 김으로도 쓴다',
    hanjaLegalReading('金', '금') && hanjaLegalReading('金', '김'));
  check('李 는 리로도 이로도 쓴다',
    hanjaLegalReading('李', '리') && hanjaLegalReading('李', '이'));
  check('柳 는 류로도 유로도 쓴다',
    hanjaLegalReading('柳', '류') && hanjaLegalReading('柳', '유'));
  check('羅 는 라로도 나로도 쓴다',
    hanjaLegalReading('羅', '라') && hanjaLegalReading('羅', '나'));
  check('엉뚱한 독음은 안 된다', !hanjaLegalReading('金', '도'));

  // 이름 후보를 고를 때는 신고되는 글자만 나와야 한다
  const all도 = byReading('도').length;
  const legal도 = byReading('도', { legal: true });
  check('신고되는 글자만 골라 준다',
    legal도.length > 0 && legal도.length <= all도 && legal도.every((h) => hanjaLegal(h.char)),
    `도 ${all도}자 중 ${legal도.length}자`);
  check('이로 찾아도 리 글자가 나온다',
    byReading('이', { legal: true }).some((h) => h.char === '李'));

  // 목록에 있는 글자는 모두 우리 낱글자 표에도 있어야 한다
  const outside = Object.values(
    JSON.parse(readFileSync(new URL('./data/ilmyeong.json', import.meta.url), 'utf8')) as Record<string, { c: string; x: string }>,
  ).flatMap((v) => [...v.c, ...v.x]).filter((c) => hanja(c) === null);
  check('목록 글자는 모두 획수를 안다', outside.length === 0, `모르는 글자 ${outside.length}자`);

  /*
   * 기초한자. 학교에서 가르치는 1,800자다. 이름은 남이 읽을 수 있어야 하므로
   * 이쪽을 먼저 쓴다.
   */
  check('기초한자가 천팔백 자쯤 된다',
    hanjaCommonCount() > 1700 && hanjaCommonCount() < 1900, `${hanjaCommonCount()}자`);
  check('흔한 글자는 기초한자다', '金李朴水火木日月山川大小天地人'.split('').every(hanjaCommon));
  check('인명용으로만 열어 준 글자는 기초한자가 아니다',
    !hanjaCommon('玧') && !hanjaCommon('琇') && hanjaLegal('玧') && hanjaLegal('琇'));
}


// ─── 이름 짓기 ────────────────────────────────────────────────
{
  const { readSurname, goodPairs, charsByStroke, nameField } = await import('./src/name.ts');
  const { surnamesByReading } = await import('./src/surname.ts');
  const { meaningBad, meaningGood } = await import('./src/fit.ts');
  const { hanja: h1, hanjaLegal: legal } = await import('./src/hanja.ts');

  // 뜻으로 거르기
  check('뜻이 나쁜 글자를 잡는다',
    ['calamity, disaster', 'illness, sickness', 'dried out, withered'].every(meaningBad));
  check('낱말 안쪽까지 잡지 않는다', !meaningBad('east, eastern, eastward'),
    '「eastward」가 「war」에 걸리면 안 된다');
  check('뜻이 좋은 글자를 앞세운다',
    ['beautiful, pretty', 'virtuous, worthy', 'bright, intelligent'].every(meaningGood));

  // 성 읽기
  const kim = readSurname('김');
  check('한글 성을 읽는다', kim?.chars.join('') === '金' && kim?.total === 8, JSON.stringify(kim));
  check('한자 성도 읽는다', readSurname('金')?.total === 8);
  const ng = readSurname('남궁');
  check('두 자 성을 읽는다', ng?.chars.length === 2 && ng?.total === 19, JSON.stringify(ng));
  /*
   * 「유」는 柳·劉·兪 가 다 있고 서로 다른 집안이다. 아무거나 집으면 남의 성이
   * 되므로 정하지 않고 물어 본다.
   */
  check('집안이 여럿인 성은 함부로 정하지 않는다', readSurname('유') === null);
  check('그럴 때는 골라 보여 준다', surnamesByReading('유').length >= 3,
    surnamesByReading('유').map((s) => s.char).join(''));
  check('모르는 성은 null', readSurname('쀍') === null);

  // 획수 짝
  const pairs = goodPairs(kim!);
  check('길한 획수 짝을 찾는다', pairs.length > 10, `${pairs.length}짝`);
  check('짝은 모두 네 격이 길하다', pairs.every((p) => p.frames.allGood));
  check('짝은 모두 음양이 섞였다', pairs.every((p) => p.frames.yinYangMixed));

  // 글자
  const c9 = charsByStroke(9, ['수']);
  check('획수로 글자를 찾는다', c9.length > 0 && c9.every((h) => h.strokes === 9));
  check('찾은 글자는 모두 신고된다', c9.every((h) => legal(h.char)));
  check('뜻이 나쁜 글자는 나오지 않는다', c9.every((h) => !meaningBad(h.meaning)));
  check('필요한 기운을 앞세운다', c9[0]!.element === '수' || c9.slice(0, 5).some((h) => h.element === '수'),
    c9.slice(0, 5).map((h) => `${h.char}${h.element ?? '-'}`).join(' '));

  // 밭
  const field = nameField({ surname: '김', elements: ['수', '목'] });
  check('밭을 만든다', field.후보.length > 5, `${field.후보.length}짝`);
  check('밭에 성이 든다', field.성.한자 === '金' && field.성.획수.join() === '8');
  check('자리마다 글자가 있다', field.후보.every((p) => p.firstChars.length && p.lastChars.length));
  check('성씨 글자는 이름에 넣지 않는다',
    field.후보.every((p) => ![...p.firstChars, ...p.lastChars].some((h) => h.char === '金')));

  // 돌림자
  const dol = nameField({ surname: '김', fixed: { char: '珉', at: '뒤' } });
  check('돌림자를 넣으면 그 자리가 고정된다',
    dol.후보.length > 0 && dol.후보.every((p) => p.lastChars.length === 1 && p.lastChars[0]!.char === '珉'),
    `${dol.후보.length}짝`);
  check('돌림자 획수에 맞는 짝만 남는다',
    dol.후보.every((p) => p.last === h1('珉')!.strokes));

  // 신고 안 되는 글자로는 못 짓는다
  let threw = false;
  try { nameField({ surname: '김', fixed: { char: '龘', at: '뒤' } }); } catch { threw = true; }
  check('신고 안 되는 돌림자는 막는다', threw);

  let threw2 = false;
  try { nameField({ surname: '쀍' }); } catch { threw2 = true; }
  check('모르는 성은 막는다', threw2);
}

console.log(`\n${'═'.repeat(60)}`);
console.log(`통과 ${passed} / 실패 ${failed}`);
if (failed) { console.log('\n실패 항목:'); for (const x of failures) console.log(`  - ${x}`); process.exit(1); }
console.log('전부 통과.');
