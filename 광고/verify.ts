/**
 * 광고 대본 검사.
 *
 *   node --experimental-strip-types 광고/verify.ts
 *
 * **영상을 만들기 전에 돌린다.** 영상은 한 번 올리면 주워 담기 어렵다.
 * 특히 값에 관한 말은 틀리면 그 자체가 법 위반이다.
 */

import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { 대본, 끝화면 } from './대본.ts';
import { CATALOG } from '../packages/commerce/src/catalog.ts';

const 여기 = dirname(fileURLToPath(import.meta.url));
const 자산 = join(여기, '../apps/api/public/assets');

let 통과 = 0;
const 실패: string[] = [];
function 본다(무엇: string, 맞는가: boolean, 덧붙임 = ''): void {
  if (맞는가) { 통과++; console.log(`  ✓ ${무엇}`); }
  else { 실패.push(`${무엇}${덧붙임 ? ` — ${덧붙임}` : ''}`); console.log(`  ✗ ${무엇}${덧붙임 ? ` — ${덧붙임}` : ''}`); }
}

/**
 * 값을 받지 않는 것들.
 *
 * 「무료」·「0원」·「받지 않습니다」를 적어도 되는 자리는 여기뿐이다.
 * 사이트에서 실제로 공짜인 것과 한 글자도 어긋나면 안 된다.
 */
const 진짜무료 = ['여덟 글자', '오행', '대운', '꿈해몽', '꿈', '명식'];
const 공짜말 = /무료|0원|값은 받지 않|받지 않습니다|공짜/;
const 겁주는말 = /닥친다|닥칠|막혔|막힙|흉하|큰일|망한|위험합니다|지금 안 (보|하)면|놓치면/;
const 장담하는말 = /반드시|틀림없이|100%|확실히 바뀝|보장/;

console.log('\n광고 대본 검사\n' + '─'.repeat(50));

본다('대본이 한 편 이상 있다', 대본.length > 0, `${대본.length}편`);

const 겹친id = 대본.map((a) => a.id).filter((v, i, arr) => arr.indexOf(v) !== i);
본다('같은 id 가 두 번 나오지 않는다', 겹친id.length === 0, 겹친id.join(', '));

for (const ad of 대본) {
  console.log(`\n[${ad.이름}]`);

  본다('id 에 영문·숫자·밑줄만 있다', /^[A-Za-z0-9_]+$/.test(ad.id), ad.id);
  본다('겨냥할 사람을 적어 두었다', ad.겨냥.trim().length > 0);
  본다('보낼 곳이 실제로 있는 상품이거나 무료 화면이다',
    ad.보낼곳 === 'free' || Object.prototype.hasOwnProperty.call(CATALOG, ad.보낼곳), ad.보낼곳);
  본다('컷이 셋 이상이다', ad.컷.length >= 3, `${ad.컷.length}컷`);

  const 없는영상 = ad.컷.filter((c) => !existsSync(join(자산, c.영상))).map((c) => c.영상);
  본다('쓰는 영상이 전부 있다', 없는영상.length === 0, 없는영상.join(', '));

  본다('첫 컷만 글씨가 한가운데에 온다',
    ad.컷.every((c, i) => (i === 0 ? true : c.가운데 !== true)));

  const 전체 = ad.컷.reduce((s, c) => s + c.길이, 0) + 끝화면.길이;
  본다('길이가 12초에서 35초 사이다', 전체 >= 12 && 전체 <= 35, `${전체.toFixed(1)}초`);

  const 첫줄 = ad.컷[0]!.큰글씨.replace(/<[^>]+>/g, ' ');
  본다('첫 문장이 25자 아래다 (길면 안 읽힌다)', 첫줄.length <= 25, `${첫줄.length}자 · ${첫줄.trim()}`);
  본다('첫 문장이 물음표로 끝나지 않는다 (혼잣말이어야 손이 멈춘다)',
    !첫줄.trim().endsWith('?'), 첫줄.trim());

  /*
   * 여기가 제일 중요하다.
   *
   * 「무료」라고 적은 컷은 **값을 받지 않는 것**을 가리켜야 한다.
   * 유료 상품 옆에 공짜라고 적으면 표시광고법상 거짓·과장광고다.
   */
  for (const [i, c] of ad.컷.entries()) {
    const 글 = `${c.큰글씨} ${c.작은글씨 ?? ''}`.replace(/<[^>]+>/g, ' ');
    if (공짜말.test(글)) {
      본다(`${i + 1}번 컷 — 공짜라고 적은 것이 실제로 공짜인 것을 가리킨다`,
        진짜무료.some((w) => 글.includes(w)), 글.trim().slice(0, 60));
    }
    본다(`${i + 1}번 컷 — 겁주는 말이 없다`, !겁주는말.test(글), 글.trim().slice(0, 60));
    본다(`${i + 1}번 컷 — 장담하는 말이 없다`, !장담하는말.test(글), 글.trim().slice(0, 60));
  }

  // 값을 광고 글에 직접 적지 않는다. 값은 카탈로그 한 곳에서만 온다
  const 값적힘 = ad.컷.some((c) => /[0-9]{1,3},[0-9]{3}\s*원/.test(`${c.큰글씨} ${c.작은글씨 ?? ''}`));
  본다('광고 글에 값을 직접 적지 않았다', !값적힘);

  본다('마지막 컷이 무료로 들어오는 길을 가리킨다',
    공짜말.test(`${ad.컷.at(-1)!.큰글씨} ${ad.컷.at(-1)!.작은글씨 ?? ''}`));
}

console.log('\n' + '─'.repeat(50));
console.log(`통과 ${통과} / 실패 ${실패.length}`);
if (실패.length) {
  console.log('\n고칠 것:');
  for (const f of 실패) console.log(`  - ${f}`);
  process.exit(1);
}
console.log('전부 통과. 영상을 만들어도 됩니다.');
