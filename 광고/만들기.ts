/**
 * 광고 영상을 찍어내는 틀.
 *
 * ## 쓰는 법
 *
 *   node --experimental-strip-types 광고/만들기.ts            ← 대본에 있는 것 전부
 *   node --experimental-strip-types 광고/만들기.ts A_dasi      ← 한 편만
 *   node --experimental-strip-types 광고/만들기.ts --길이 30    ← 쇼츠용으로 늘려서
 *
 * 나온 것은 `광고/완성/` 아래에 떨어진다.
 *
 * ## 글씨를 왜 크롬으로 찍는가
 *
 * ffmpeg 에도 글씨 얹는 기능이 있지만 이 기계에는 **한글 글꼴이 없다.**
 * 깨진 네모가 나온다. 크롬은 한글을 제대로 그리므로, 글씨만 투명한 그림으로
 * 찍어서 영상 위에 얹는다. 덤으로 사이트와 같은 글꼴·같은 금색을 쓸 수 있다.
 *
 * ## 원본 오른쪽 아래를 왜 잘라내는가
 *
 * 신령 영상 구석에 **만든 도구 이름이 찍혀 있다.** 광고에 그게 보이면 안 된다.
 * 6% 당겨서 위쪽 기준으로 자른다. 새 영상을 넣을 때도 이 구석을 먼저 봐라.
 */

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { 대본, 끝화면, type 광고, type 컷 } from './대본.ts';

const 여기 = dirname(fileURLToPath(import.meta.url));
const 뿌리 = join(여기, '..');
const 자산 = join(뿌리, 'apps/api/public/assets');
const 완성 = join(여기, '완성');
const 임시 = join(여기, '.임시');

const 크롬 = [
  process.env.CHROME_BIN,
  '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium-browser',
].filter(Boolean).find((p) => existsSync(p as string)) as string | undefined;

const 플레이라이트 = '/opt/node22/lib/node_modules/playwright/index.js';

function 달린다(명령: string, 인자: string[]): void {
  execFileSync(명령, 인자, { stdio: ['ignore', 'ignore', 'pipe'] });
}

/** 글씨 한 장을 그리는 html */
function 글씨판(c: 컷): string {
  const 가운데 = c.가운데 === true;
  return `<!doctype html><html><head><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Noto+Serif+KR:wght@700;900&family=Noto+Sans+KR:wght@500;700&display=swap" rel="stylesheet">
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{width:1080px;height:1920px;background:transparent;position:relative;overflow:hidden}
.scrim{position:absolute;left:0;right:0;bottom:0;height:${가운데 ? '1920px' : '980px'};
  background:${가운데
    ? 'radial-gradient(130% 48% at 50% 50%, rgba(8,6,12,.86) 0%, rgba(8,6,12,.62) 46%, rgba(8,6,12,.18) 78%, rgba(8,6,12,0) 100%)'
    : 'linear-gradient(to top, rgba(8,6,12,.93) 0%, rgba(8,6,12,.82) 34%, rgba(8,6,12,0) 100%)'}}
.wrap{position:absolute;left:0;right:0;${가운데 ? 'top:50%;transform:translateY(-50%);' : 'bottom:260px;'}
  padding:0 ${가운데 ? '54px' : '86px'};text-align:center}
.big{font-family:"Noto Serif KR",serif;font-weight:900;
  font-size:${가운데 ? '104px' : '96px'};line-height:1.32;letter-spacing:-.02em;
  color:#fff;word-break:keep-all;text-wrap:pretty;
  text-shadow:0 6px 34px rgba(0,0,0,.95), 0 2px 10px rgba(0,0,0,.9)}
.big em{font-style:normal;color:#f0cf5e;
  text-shadow:0 0 42px rgba(212,175,55,.75), 0 6px 34px rgba(0,0,0,.95)}
.sub{margin-top:34px;font-family:"Noto Sans KR",sans-serif;font-weight:500;
  font-size:46px;line-height:1.6;color:#ded7ea;word-break:keep-all;
  text-shadow:0 3px 18px rgba(0,0,0,.95)}
.rule{width:92px;height:3px;margin:40px auto 0;
  background:linear-gradient(90deg,transparent,#d4af37,transparent)}
</style></head><body>
<div class="scrim"></div>
<div class="wrap"><div class="big">${c.큰글씨}</div>
${c.작은글씨 ? `<div class="sub">${c.작은글씨}</div>` : ''}<div class="rule"></div></div>
</body></html>`;
}

/** 끝 화면 html */
function 끝판(): string {
  const 도장 = join(자산, '늘봄붓글씨_골드누끼.png');
  return `<!doctype html><html><head><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Noto+Serif+KR:wght@900&family=Noto+Sans+KR:wght@500;700&display=swap" rel="stylesheet">
<style>*{margin:0;padding:0;box-sizing:border-box}
body{width:1080px;height:1920px;background:#0a0810;display:flex;flex-direction:column;
 align-items:center;justify-content:center}
.seal{width:430px;margin-bottom:46px;mix-blend-mode:screen;filter:brightness(1.12)}
.name{font-family:"Noto Serif KR",serif;font-weight:900;font-size:96px;color:#f3e5ab;letter-spacing:.06em}
.line{width:160px;height:2px;margin:44px 0 40px;background:linear-gradient(90deg,transparent,#d4af37,transparent)}
.url{font-family:"Noto Sans KR",sans-serif;font-weight:700;font-size:52px;color:#fff}
.free{margin-top:56px;font-family:"Noto Sans KR",sans-serif;font-weight:700;font-size:44px;
 color:#0f0c16;background:#e8c24a;padding:22px 48px;border-radius:999px}
</style></head><body>
<img class="seal" src="file://${도장}">
<div class="name">${끝화면.이름}</div>
<div class="line"></div>
<div class="url">${끝화면.주소}</div>
<div class="free">${끝화면.띠}</div>
</body></html>`;
}

/** 크롬을 한 번만 띄워서 글씨판을 전부 찍는다 */
async function 글씨를찍는다(판: { 이름: string; html: string; 투명: boolean }[]): Promise<void> {
  if (!크롬) throw new Error('크롬을 못 찾았습니다. CHROME_BIN 을 알려 주십시오.');
  const pw = (await import(플레이라이트)).default ?? (await import(플레이라이트));
  const b = await pw.chromium.launch({ executablePath: 크롬 });
  const ctx = await b.newContext({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
  for (const p of 판) {
    const html = join(임시, `${p.이름}.html`);
    writeFileSync(html, p.html);
    const page = await ctx.newPage();
    await page.goto(`file://${html}`);
    // 글꼴이 내려올 때까지 기다린다. 안 기다리면 다른 글꼴로 찍힌다
    await page.waitForTimeout(1600);
    await page.screenshot({ path: join(임시, `${p.이름}.png`), omitBackground: p.투명 });
    await page.close();
  }
  await b.close();
}

/** 한 편을 만든다 */
async function 한편(ad: 광고, 늘릴배수: number): Promise<string> {
  const 조각: string[] = [];

  // ① 글씨판을 한꺼번에 찍는다
  await 글씨를찍는다([
    ...ad.컷.map((c, i) => ({ 이름: `${ad.id}_c${i}`, html: 글씨판(c), 투명: true })),
    { 이름: `${ad.id}_end`, html: 끝판(), 투명: false },
  ]);

  // ② 컷마다 영상을 자르고 글씨를 얹는다
  ad.컷.forEach((c, i) => {
    const 원본 = join(자산, c.영상);
    if (!existsSync(원본)) throw new Error(`영상이 없습니다: ${c.영상}`);
    const 길이 = +(c.길이 * 늘릴배수).toFixed(2);
    const 민영상 = join(임시, `${ad.id}_v${i}.mp4`);
    달린다('ffmpeg', ['-y', '-v', 'error', '-stream_loop', '2',
      '-ss', String(c.시작), '-t', String(길이), '-i', 원본,
      // 6% 당겨 위쪽 기준으로 자른다 — 오른쪽 아래 도구 이름을 쳐낸다
      '-vf', 'scale=1145:2035:force_original_aspect_ratio=increase,crop=1080:1920:(iw-1080)/2:0,fps=24,format=yuv420p',
      '-an', 민영상]);

    const 얹은것 = join(임시, `${ad.id}_o${i}.mp4`);
    const 사라질때 = +(길이 - 0.35).toFixed(2);
    달린다('ffmpeg', ['-y', '-v', 'error', '-i', 민영상,
      '-loop', '1', '-framerate', '24', '-t', String(길이), '-i', join(임시, `${ad.id}_c${i}.png`),
      '-filter_complex',
      `[1:v]format=rgba,fade=in:st=0:d=0.35:alpha=1,fade=out:st=${사라질때}:d=0.3:alpha=1[t];`
      + '[0:v][t]overlay=0:0:shortest=1,format=yuv420p',
      '-c:v', 'libx264', '-preset', 'medium', '-crf', '20', '-r', '24', 얹은것]);
    조각.push(얹은것);
  });

  // ③ 끝 화면
  const 끝 = join(임시, `${ad.id}_end.mp4`);
  달린다('ffmpeg', ['-y', '-v', 'error', '-loop', '1', '-i', join(임시, `${ad.id}_end.png`),
    '-t', String(끝화면.길이), '-vf', 'fps=24,format=yuv420p',
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '20', 끝]);
  조각.push(끝);

  // ④ 이어 붙인다. 숏폼은 디졸브 없이 탁탁 끊는 쪽이 끝까지 본다
  const 목록 = join(임시, `${ad.id}.txt`);
  writeFileSync(목록, 조각.map((f) => `file '${f}'`).join('\n'));
  const 소리없음 = join(임시, `${ad.id}_silent.mp4`);
  달린다('ffmpeg', ['-y', '-v', 'error', '-f', 'concat', '-safe', '0', '-i', 목록, '-c', 'copy', 소리없음]);

  // ⑤ 소리 — 컷마다 다른 소리를 쓰면 툭툭 끊긴다. 한 가지를 쭉 깐다
  const 전체길이 = ad.컷.reduce((s, c) => s + c.길이 * 늘릴배수, 0) + 끝화면.길이;
  const 소리 = join(임시, `${ad.id}.m4a`);
  달린다('ffmpeg', ['-y', '-v', 'error', '-stream_loop', '6', '-i', join(자산, '신령계마당.mp4'),
    '-t', String(전체길이), '-vn',
    '-af', `afade=t=in:st=0:d=1.2,afade=t=out:st=${(전체길이 - 1.6).toFixed(2)}:d=1.6,`
      + 'volume=0.55,loudnorm=I=-16:TP=-1.5:LRA=11',
    '-c:a', 'aac', '-b:a', '128k', 소리]);

  const 초 = Math.round(전체길이);
  const 결과 = join(완성, `${ad.id}_${초}초.mp4`);
  달린다('ffmpeg', ['-y', '-v', 'error', '-i', 소리없음, '-i', 소리,
    '-c:v', 'copy', '-c:a', 'copy', '-shortest', 결과]);
  return 결과;
}

async function 시작(): Promise<void> {
  const 인자 = process.argv.slice(2);
  const 길이자리 = 인자.indexOf('--길이');
  const 바라는초 = 길이자리 >= 0 ? Number(인자[길이자리 + 1]) : 0;
  const 고른것 = 인자.filter((a, i) => !a.startsWith('--') && i !== 길이자리 + 1);

  const 만들것 = 고른것.length
    ? 대본.filter((a) => 고른것.includes(a.id))
    : 대본;
  if (!만들것.length) {
    console.log('그런 대본이 없습니다. 있는 것:', 대본.map((a) => a.id).join(', '));
    process.exit(1);
  }

  mkdirSync(완성, { recursive: true });
  mkdirSync(임시, { recursive: true });

  for (const ad of 만들것) {
    const 본래 = ad.컷.reduce((s, c) => s + c.길이, 0) + 끝화면.길이;
    const 배수 = 바라는초 > 0 ? (바라는초 - 끝화면.길이) / (본래 - 끝화면.길이) : 1;
    process.stdout.write(`${ad.이름} … `);
    const 난것 = await 한편(ad, 배수);
    console.log(`${난것.replace(뿌리 + '/', '')}`);
    console.log(`   겨냥: ${ad.겨냥}`);
    console.log(`   보낼 곳: ${ad.보낼곳 === 'free' ? '무료 사주 화면' : `/products/${ad.보낼곳}`}`);
  }

  rmSync(임시, { recursive: true, force: true });
  console.log(`\n${만들것.length}편 만들었습니다. 광고/완성/ 에 있습니다.`);
}

시작().catch((e) => { console.error('만들지 못했습니다:', e.message); process.exit(1); });
