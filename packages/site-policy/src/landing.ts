/**
 * 첫 화면.
 *
 * 지금까지의 첫 화면은 **개발자가 계산을 확인하려고 만든 것**이었다.
 * 제목이 「만세력 · 명식 해석」이고 설명이 "VSOP87 절단 급수로 계산하며
 * 표준자오선 변천을 보정합니다" 였다. 손님은 그게 뭔지 모르고, 알 필요도 없다.
 *
 * 세 가지를 지킨다.
 *
 * **1. 서버가 HTML로 그린다.** 자바스크립트가 만들면 검색엔진과 심사 검사기가
 *    못 본다. 첫 화면은 그 둘이 제일 먼저 보는 곳이다.
 *
 * **2. 모바일이 기준이다.** 사주·운세 손님은 거의 다 폰으로 온다.
 *    데스크톱에서도 폰 폭의 세로 칸으로 보이는 편이, 넓게 퍼뜨리는 것보다 낫다.
 *
 * **3. 없는 실적을 만들지 않는다.** 경쟁사는 「누적 30,000명」「97% 만족」을
 *    내건다. 우리는 손님이 0명이다. 대신 **실제로 가진 것**을 내건다 —
 *    절기를 천문 계산으로 직접 구한다는 것, 모든 결론에 근거를 단다는 것,
 *    세 갈래를 대조하는 곳이 우리뿐이라는 것. 셋 다 사실이다.
 */

import { type BusinessInfo, show } from './business.ts';

function esc(value: string): string {
  return value.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));
}

/** 내세울 것. 전부 코드로 확인 가능한 사실이어야 한다 */
const BADGES: { icon: string; title: string; body: string }[] = [
  {
    icon: '☰',
    title: '사주 · 관상 · 손금을 한 자리에서',
    body: '세 갈래를 같은 여덟 개 축으로 환산해 맞춰 봅니다. 하나만 보면 놓치는 것이 있습니다.',
  },
  {
    icon: '◷',
    title: '절기를 직접 계산합니다',
    body: '표를 베끼지 않고 천문 계산으로 구합니다. 진태양시·서머타임·표준자오선 변천까지 보정합니다.',
  },
  {
    icon: '⁂',
    title: '모든 결론에 근거를 답니다',
    body: '어느 글자에서 나온 말인지 함께 적습니다. 용어는 쉬운 말로 옮기고 옆에 원래 이름을 답니다.',
  },
];

/** 갈래마다 붙일 한자 숫자. 장식이 아니라 「하나, 둘, 셋」을 명리 화면답게 세는 것 */
const NUMERALS = ['壹', '貳', '參'];

/**
 * 첫 화면 스타일.
 *
 * 색은 **상품 그림에서 가져온다.** 그림은 짙은 남색 먹과 한지 바탕에 은은한
 * 금이다. 화면이 보라색이면 21장이 아무리 좋아도 남의 옷을 입은 것처럼 뜬다.
 * 색 값 자체는 `PRODUCTS_CSS` 의 `:root` 한 곳에 있다 — 여기서 다시 적지 않는다.
 *
 * 글자는 제목만 명조로 간다. 본문까지 명조로 하면 폰에서 읽기 힘들다.
 */
export const LANDING_CSS = `
/* 폰에서는 그림을 통째로 보여 준다. 배경으로 깔고 베일을 씌우면 폰 폭에서는
   그림이 거의 남지 않는다 — 브랜드가 첫 화면에서 사라지는 것과 같다 */
.lp-hero{position:relative;overflow:hidden}
.lp-top{padding:24px 0 16px}
.lp-shot{position:relative;width:100%;aspect-ratio:3/4;
  background:var(--nb-paper) center bottom/cover no-repeat;background-image:var(--nb-hero,none)}
.lp-vid{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:center bottom;
  opacity:0;transition:opacity .6s ease}
.lp-vid.on{opacity:1}
.lp-shot::after{content:"";position:absolute;inset:auto 0 -1px 0;height:34%;
  background:linear-gradient(to bottom,var(--nb-veil-0),var(--nb-paper) 92%)}
.lp-lead{padding:20px 0 52px}
.lp-brand{display:flex;align-items:center;gap:10px}
.lp-seal{width:26px;height:26px;flex:0 0 auto;display:grid;place-items:center;
  border:1px solid var(--nb-gold);color:var(--nb-gold);font-family:var(--nb-serif);font-size:13px}
.lp-name{font-family:var(--nb-serif);font-size:20px;letter-spacing:.06em}
.lp-hero h1{font-family:var(--nb-serif);font-weight:500;font-size:29px;line-height:1.55;
  letter-spacing:-.01em;word-break:keep-all;margin:0 0 14px}
.lp-hero h1 em{font-style:normal;color:var(--nb-gold)}
.lp-sub{margin:0 0 26px;font-size:15.5px;color:var(--nb-ink-2);max-width:30em;word-break:keep-all}
.lp-cta{display:inline-block;padding:15px 34px;border:1px solid var(--nb-ink);background:var(--nb-ink);
  color:var(--nb-paper-2);text-decoration:none;font-size:15.5px;font-weight:500;letter-spacing:.02em;
  transition:background .15s,color .15s}
.lp-cta:hover,.lp-cta:focus{background:transparent;color:var(--nb-ink)}
.lp-free{display:block;margin-top:14px;font-size:13px;color:var(--nb-ink-3)}
.lp-pledge{padding:56px 0 0}
.lp-row{display:grid;gap:0}
.lp-item{padding:26px 0;border-top:1px solid var(--nb-line-soft)}
.lp-item:last-child{border-bottom:1px solid var(--nb-line-soft)}
.lp-num{display:block;margin-bottom:8px;font-family:var(--nb-serif);font-size:13px;
  letter-spacing:.22em;color:var(--nb-gold)}
.lp-bt{font-family:var(--nb-serif);font-weight:500;font-size:19px;margin:0 0 6px}
.lp-bb{margin:0;font-size:14.5px;line-height:1.8;color:var(--nb-ink-2);word-break:keep-all}
.lp-try{padding:64px 0 0}
.lp-try h2{font-family:var(--nb-serif);font-weight:500;font-size:23px;margin:0 0 8px}
@media (min-width:760px){
  /* 폭이 넓어지면 3:4 그대로는 화면 하나를 다 잡아먹는다. 높이를 잡아 두고
     그림은 잘리지 않게 안에 담는다 — 위로는 산, 아래로는 물결까지 다 남는다 */
  .lp-shot{aspect-ratio:auto;height:64vh;min-height:420px;background-size:contain}
  .lp-vid{object-fit:contain}
  .lp-hero h1{font-size:44px}
  .lp-row{grid-template-columns:repeat(3,1fr);gap:0 40px}
  .lp-item,.lp-item:last-child{border-top:1px solid var(--nb-line-soft);border-bottom:1px solid var(--nb-line-soft)}
}
@media (min-width:1024px){
  /* 여기서부터 글을 그림 위에 얹는다. 베일은 글이 앉는 아래쪽에만 두어
     산이 형체로 남게 한다. 그림도 영상도 세로라, 이 폭에서만 잘라 쓴다 */
  .lp-hero{display:flex;flex-direction:column;justify-content:space-between;min-height:86vh}
  .lp-shot{position:absolute;inset:0;aspect-ratio:auto;height:auto;min-height:0;
    background-size:cover;background-position:center 38%}
  .lp-vid{object-fit:cover}
  .lp-shot::after{inset:0;height:auto;
    background:linear-gradient(to bottom,var(--nb-veil-0) 46%,var(--nb-veil-1) 86%,var(--nb-paper) 100%)}
  .lp-top,.lp-lead{position:relative;z-index:1;width:100%}
  .lp-lead{padding-bottom:76px}
  .lp-hero h1{font-size:52px}
}
@media (prefers-color-scheme:dark){
  .lp-cta{background:var(--nb-gold);border-color:var(--nb-gold);color:#131A26}
  .lp-cta:hover,.lp-cta:focus{background:transparent;color:var(--nb-gold)}
}`;

/**
 * 첫 화면 머리.
 *
 * 그림이 있으면 배경으로 깔고, 없으면 종이색 그대로 둔다. **없는 그림 자리에
 * 회색 네모를 남기지 않는다** — 상품 그림에서 지킨 규칙과 같다.
 */
export function renderHero(info: BusinessInfo, ready: boolean, hero = false, video = false): string {
  const name = esc(show(info, 'serviceName', '서비스 이름'));
  const items = BADGES.map((b, i) => `    <div class="lp-item">
      <span class="lp-num" aria-hidden="true">${NUMERALS[i] ?? ''}</span>
      <p class="lp-bt">${esc(b.title)}</p>
      <p class="lp-bb">${esc(b.body)}</p>
    </div>`).join('\n');

  return `<header class="lp-hero">
  <div class="lp lp-top">
    <div class="lp-brand">
      <span class="lp-seal" aria-hidden="true">命</span>
      <span class="lp-name">${name}</span>
    </div>
  </div>
${hero ? `  <div class="lp-shot" style="--nb-hero:url(/img/hero)">${video ? HERO_VIDEO : ''}</div>` : ''}
  <div class="lp lp-lead">
    <h1>사주 하나로는<br>안 보이는 것이 <em>있습니다</em></h1>
    <p class="lp-sub">사주와 관상과 손금, 세 갈래를 맞춰 봅니다.
    같은 말을 하는 곳은 확신을 갖고, 엇갈리는 곳은 왜 엇갈리는지 짚어 드립니다.</p>
    <a class="lp-cta" href="#try">내 사주 무료로 보기</a>
    <span class="lp-free">생년월일만 있으면 됩니다. ${ready ? '결제 없이' : '지금은 결제 없이'} 명식·궁합·관상·손금을 보실 수 있습니다.</span>
  </div>
</header>

<section class="lp lp-pledge">
  <div class="lp-row">
${items}
  </div>
</section>`;
}

/**
 * 첫 화면 영상.
 *
 * **그림이 먼저 뜨고, 영상은 그 뒤에서 받는다.** 손님은 기다리지 않는다 —
 * 산 그림이 이미 떠 있고, 영상은 다 받아졌을 때 조용히 겹쳐진다.
 * 자바스크립트가 꺼져 있으면 그림만 남는다. 잃는 것이 없다.
 *
 * 세 경우에는 아예 받지 않는다.
 * - **데이터 절약 모드** — 손님 요금을 우리가 쓰면 안 된다.
 * - **느린 연결(2G·3G)** — 받는 동안 다른 것까지 느려진다.
 * - **움직임 줄이기를 켜 둔 손님** — 어지럼증 때문에 꺼 둔 사람이 있다.
 *
 * 영상은 세로다. 세로로 세운 틀(3:4)에 그대로 들어가야 아래쪽 물결까지 보인다 —
 * 가로 틀에 넣으면 위아래가 잘려 꽃잎만 떨어지고 물결이 사라진다.
 * 1024 이상에서는 글을 그림 위에 얹느라 좌우를 잘라 쓰므로 영상을 받지 않는다.
 */
const HERO_VIDEO = `<video class="lp-vid" muted loop playsinline preload="none" aria-hidden="true"></video>
<script>(function(){
  var v=document.currentScript.previousElementSibling;
  if(!v)return;
  if(window.innerWidth>=1024)return;
  if(matchMedia('(prefers-reduced-motion: reduce)').matches)return;
  var c=navigator.connection;
  if(c&&(c.saveData||/2g/.test(c.effectiveType||'')))return;
  var go=function(){
    v.src='/video/hero';
    v.addEventListener('canplaythrough',function(){v.classList.add('on');v.play().catch(function(){});},{once:true});
    v.load();
  };
  if('requestIdleCallback' in window)requestIdleCallback(go,{timeout:3000});
  else addEventListener('load',function(){setTimeout(go,600);});
})();</script>`;

/**
 * 무료 구간 앞에 붙일 안내.
 *
 * 상품 목록을 지나 아래로 내려온 사람에게, 여기부터는 돈이 들지 않는다는 것을
 * 분명히 알린다. 유료 화면과 무료 화면이 섞여 보이면 손님은 뒤로 나간다.
 */
export function renderTryHeading(): string {
  return `<section class="lp lp-try" id="try">
  <h2>무료로 직접 해보기</h2>
  <p class="lp-sub" style="margin-bottom:0">생년월일시를 넣으면 사주 여덟 글자와 십신·용신·대운까지
  바로 나옵니다. 궁합과 관상·손금도 결제 없이 보실 수 있습니다.</p>
</section>`;
}
