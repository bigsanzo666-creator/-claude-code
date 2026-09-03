/**
 * 상품·가격 안내.
 *
 * PG 심사의 「상품 등록 유무」 항목을 위한 것이다. 심사는 **첫 화면만** 본다 —
 * 생년월일을 넣고 스크롤해야 나오는 가격은 없는 것과 같다.
 *
 * 그래서 이 화면은 세 가지를 지킨다.
 *
 * 1. **서버가 HTML로 직접 그린다.** 자바스크립트로 만들면 자동 검사기가 못 본다.
 * 2. **결제가 꺼져 있어도 나온다.** 심사를 통과해야 결제가 켜지는데,
 *    결제가 켜져야 가격이 보이면 영원히 통과 못 한다.
 * 3. **가격은 카탈로그 한 곳에서만 온다.** 화면에 적힌 값과 서버가 대조하는 값이
 *    다르면 그 자체가 사고다.
 */

import { CATALOG, CATEGORIES, productsIn, type Product } from '../../commerce/src/catalog.ts';
import { PACKAGES, bundleMath, type BundlePackage } from '../../commerce/src/packages.ts';
import { WITHDRAWAL_WINDOW_DAYS } from '../../commerce/src/refund.ts';
import { type BusinessInfo, show } from './business.ts';
import {
  spiritOf, renderSpiritHead, renderSpiritPitch, SPIRITS_CSS,
  type SpiritImages,
} from './spirits.ts';
import { renderSocialHead } from './social.ts';

/** 얼굴 그림이 아직 하나도 없을 때. 도장 한 글자로 자리를 지킨다 */
const NO_FACES: SpiritImages = new Set();

function esc(value: string): string {
  return value.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));
}

const won = (n: number) => `${n.toLocaleString('ko-KR')}원`;

/**
 * 그림이 있는 상품의 아이디 모음.
 *
 * 서버가 기동할 때 실제로 있는 파일을 세어 넘겨준다. 여기서 파일을 뒤지지 않는
 * 이유는, 이 패키지가 어느 서버의 어느 폴더에 붙을지 몰라야 하기 때문이다.
 *
 * **없으면 아무것도 그리지 않는다.** 빈 네모를 남기면 그림이 없느니만 못하다.
 * 그래서 21장이 다 나오기 전에도 나온 것만 먼저 붙일 수 있다.
 */
export type ProductImages = ReadonlySet<string>;

const NO_IMAGES: ProductImages = new Set();

/** 갈래 맨 앞에 크게 거는 상품 */
const FEATURED = 'cross-report';

/** 확장자를 URL에 넣지 않는다 — 서버가 실제 파일을 알고 있다. */
export const imageUrl = (id: string) => `/img/products/${encodeURIComponent(id)}`;

/**
 * 상품마다 "무엇을 받는지"를 못 박는다.
 *
 * 카탈로그의 한 줄 설명만으로는 부족하다 — 손님도 심사자도
 * 결제 버튼을 누르기 전에 받을 것을 알아야 한다.
 *
 * 주제별 상품은 여기 없다. 그쪽은 카탈로그의 `hook`과 `description`이
 * 이미 그 일을 한다. 없는 상품은 목록 없이 설명만 나간다.
 */
const CONTENTS: Record<string, string[]> = {
  'saju-report': [
    '사주 여덟 글자와 지장간까지 펼친 명식',
    '일간의 강약과 용신 — 어느 기운을 써야 하는지',
    '십신 분포로 본 성향과 비어 있는 자리',
    '10년 대운과 올해 세운의 흐름',
  ],
  'compat-report': [
    '두 사람의 명식을 다섯 축으로 대조',
    '잘 맞는 지점과 부딪히는 지점을 함께',
    '합·충·형 관계와 그것이 실제로 뜻하는 바',
    '관계를 오래 끌고 가려면 무엇을 조심해야 하는지',
  ],
  'cross-report': [
    '사주·관상·손금을 같은 여덟 축으로 환산',
    '**세 갈래가 일치하는 것** — 가장 믿을 만한 성향',
    '**엇갈리는 것** — 겉과 속이 다른 지점',
    '**하나만 말하는 것** — 아직 드러나지 않은 면',
    '각 결론이 어느 글자·어느 부위에서 나왔는지 표시',
  ],
  'newyear-report': [
    '올해 세운이 내 명식과 만나는 지점',
    '달별로 나뉜 흐름',
    '올해 특히 조심할 것과 밀어붙일 것',
  ],
};

function bold(text: string): string {
  // 설명 안의 **강조**만 살리고 나머지는 escape 한다
  return esc(text).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
}

function productCard(
  product: Product, ready: boolean, images: ProductImages, groupQuestion = '', prices = true,
): string {
  // 21개를 낱장으로 늘어놓으면 아무도 끝까지 못 본다. 그래서 목록은 **그림 격자**다 —
  // 후킹 질문·이름·값만 싣고, 설명과 담기는 내용은 상세 페이지가 맡는다.
  // alt 를 비우는 것은 장식이기 때문이다. 바로 아래에 상품 이름이 글자로 있다.
  const shot = images.has(product.id)
    ? `<span class="pr-shot"><img class="pr-thumb" src="${imageUrl(product.id)}" alt="" width="480" height="640" loading="lazy" decoding="async"></span>`
    : '';
  return `<article class="pr-card">
  <a class="pr-link" href="/products/${esc(product.id)}">
    ${shot}
    ${product.hook === groupQuestion ? '' : `<span class="pr-hook">${esc(product.hook)}</span>`}
    <h3>${esc(product.name)}</h3>
  </a>
  ${prices ? `<p class="pr-foot"><span class="pr-price">${won(product.priceKrw)}</span><span class="pr-vat"> (부가세 포함)</span>${
    ready ? '' : '<span class="pr-soon">결제 준비 중</span>'}</p>` : ''}
</article>`;
}

/**
 * 크게 거는 카드.
 *
 * 삼합 리포트는 제일 비싸고 우리만 하는 것인데, 다른 스무 개와 똑같이 생겨 있으면
 * 아무도 그것부터 보지 않는다. 갈래 맨 앞에 한 칸을 다 쓰고, 설명과 담기는 내용까지
 * 여기서 보여 준다.
 */
function featureCard(product: Product, ready: boolean, images: ProductImages, prices = true): string {
  const items = (CONTENTS[product.id] ?? []).map((t) => `<li>${bold(t)}</li>`).join('');
  const shot = images.has(product.id)
    ? `<span class="pr-shot"><img class="pr-thumb" src="${imageUrl(product.id)}" alt="" width="480" height="640" loading="lazy" decoding="async"></span>`
    : '';
  return `<article class="pr-card pr-wide">
  <a class="pr-link" href="/products/${esc(product.id)}">
    ${shot}
    <span class="pr-body">
      <span class="pr-tag">가장 깊이 봅니다</span>
      <span class="pr-hook">${esc(product.hook)}</span>
      <h3>${esc(product.name)}</h3>
      <span class="pr-desc">${esc(product.description)}</span>
      ${items ? `<ul class="pr-list">${items}</ul>` : ''}
      ${prices ? `<span class="pr-foot"><span class="pr-price">${won(product.priceKrw)}</span><span class="pr-vat"> (부가세 포함)</span>${
        ready ? '' : '<span class="pr-soon">결제 준비 중</span>'}</span>` : ''}
    </span>
  </a>
</article>`;
}

/**
 * 묶음 카드.
 *
 * 정가를 지어내지 않는다. 경쟁사들이 쓰는 "정가 128,000원 → 61% 할인"은
 * 그 가격에 실제로 판 적이 없으면 표시광고법상 거짓·과장광고가 된다.
 * 우리는 구성 상품이 전부 실재하므로 **그 합계를 그대로 쓴다.**
 */
function packageCard(pack: BundlePackage, ready: boolean): string {
  const m = bundleMath(pack.id);
  const names = pack.members.map((id) => CATALOG[id].name).join(' + ');
  return `<article class="pr-card pr-wide pr-pack${pack.recommended ? ' pr-rec' : ''}">
  <span class="pr-body">
    ${pack.recommended ? '<span class="pr-badge">추천</span>' : ''}
    <span class="pr-hook">${esc(pack.hook)}</span>
    <h3>${esc(pack.name)}</h3>
    <span class="pr-desc">${esc(names)}</span>
    <span class="pr-foot">
      <span class="pr-price">${won(m.bundleKrw)}</span><span class="pr-vat"> (부가세 포함)</span>
      <span class="pr-save">따로 사면 ${won(m.individualKrw)} · ${m.percent}% 절약</span>
      ${ready ? '' : '<span class="pr-soon">결제 준비 중</span>'}
    </span>
  </span>
</article>`;
}

/**
 * 화면 전체의 색과 글자.
 *
 * **색은 상품 그림에서 가져왔다.** 짙은 남색 먹, 한지 바탕, 은은한 금 —
 * 21장이 전부 그 세 가지로 그려져 있다. 화면이 다른 색이면 그림이 겉돈다.
 *
 * 값을 여기 한 곳에만 두는 이유는, 이 CSS 가 첫 화면·상품 목록·상품 상세
 * 세 군데에 모두 실리는 유일한 조각이기 때문이다. 첫 화면 스타일은 여기의
 * `--ink` 를 가져다 쓴다.
 */
export const FONT_LINK = `<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Nanum+Myeongjo:wght@400;700;800&family=IBM+Plex+Sans+KR:wght@300;400;500;600&display=swap">`;

export const PRODUCTS_CSS = `
:root{
  --nb-paper:#EBE3D3; --nb-paper-2:#F6F1E5; --nb-line:#D5C9B2; --nb-line-soft:#E0D7C4;
  --nb-ink:#182640; --nb-ink-2:#4C566B; --nb-ink-3:#8B8674; --nb-gold:#9C7C42;
  --nb-veil-0:rgba(235,227,211,0); --nb-veil-1:rgba(235,227,211,.72);
  /* 글씨는 두 벌만 쓴다. 아래 무료 만세력 조각이 이미 이 둘을 받아 오므로
     새로 받지 않는다 — 한 페이지에 명조 두 벌, 고딕 두 벌이 도는 것을 막는다 */
  --nb-serif:"Nanum Myeongjo",AppleMyungjo,Batang,serif;
  --nb-sans:"IBM Plex Sans KR","Apple SD Gothic Neo","Malgun Gothic",system-ui,sans-serif;
}
body{background:var(--nb-paper)}
.pr,.lp{width:100%;max-width:1080px;margin:0 auto;padding:0 22px;box-sizing:border-box;
  font:16px/1.75 var(--nb-sans);color:var(--nb-ink);-webkit-font-smoothing:antialiased}
.pr img,.lp img{max-width:100%;display:block}
.pr h2,.pr h3,.pr h4{font-family:var(--nb-serif);font-weight:500;letter-spacing:-.01em}

/* 목록 머리 */
.pr-top{text-align:center;padding:74px 0 10px}
.pr-kicker{margin:0 0 12px;font-size:12.5px;letter-spacing:.28em;color:var(--nb-gold)}
.pr-top h2{font-size:27px;margin:0 0 10px}
.pr-intro{margin:0 auto;max-width:34em;font-size:14.5px;color:var(--nb-ink-2);word-break:keep-all}
.pr-rule{width:38px;height:1px;background:var(--nb-gold);margin:26px auto 0}

/* 갈래 */
.pr-group{padding:46px 0 0}
.pr-cat{margin:0 0 7px;font-size:12px;letter-spacing:.24em;color:var(--nb-gold)}
.pr-q{font-size:22px;margin:0 0 22px}

/* 격자 */
.pr-grid{display:grid;grid-template-columns:1fr 1fr;gap:26px 18px}
.pr-grid>*{min-width:0}
.pr-card{margin:0}
.pr-link{display:block;color:inherit;text-decoration:none}
.pr-shot{display:block;aspect-ratio:3/4;overflow:hidden;
  background:var(--nb-paper-2);border:1px solid var(--nb-line-soft)}
.pr-thumb{width:100%;height:100%;object-fit:cover}
/* 확대는 쇼핑몰 몸짓이다. 수묵 그림에는 테두리 한 줄이면 된다 */
.pr-shot{transition:border-color .15s}
.pr-link:hover .pr-shot,.pr-link:focus .pr-shot{border-color:var(--nb-gold)}
.pr-hook{display:block;margin:14px 0 3px;font-size:12.5px;line-height:1.5;color:var(--nb-gold);word-break:keep-all}
.pr-card h3{font-size:16.5px;margin:0;line-height:1.5;word-break:keep-all}
.pr-link:hover h3,.pr-link:focus h3{text-decoration:underline;text-underline-offset:3px}
.pr-foot{display:block;margin:7px 0 0;font-size:14px;color:var(--nb-ink-2);font-variant-numeric:tabular-nums}
.pr-price{font-size:15px;color:var(--nb-ink)}
.pr-vat{font-size:12px;color:var(--nb-ink-3)}
.pr-soon{display:block;margin:2px 0 0;font-size:11.5px;color:var(--nb-ink-3)}
.pr-save{display:block;margin-top:4px;font-size:13px;color:var(--nb-ink-3)}

/* 크게 거는 카드 · 묶음 */
.pr-wide{grid-column:1/-1;border:1px solid var(--nb-line);background:var(--nb-paper-2)}
.pr-wide>.pr-link,.pr-pack{display:block}
.pr-wide .pr-shot{border:0;border-bottom:1px solid var(--nb-line);aspect-ratio:16/11}
.pr-body{display:block;padding:26px 24px 28px}
.pr-tag{display:inline-block;margin-bottom:14px;padding:3px 10px;border:1px solid var(--nb-gold);
  font-size:11.5px;letter-spacing:.18em;color:var(--nb-gold)}
.pr-wide h3{font-size:22px;margin:0 0 8px}
.pr-desc{display:block;margin:0 0 14px;font-size:14.5px;color:var(--nb-ink-2);word-break:keep-all}
.pr-wide .pr-price{font-family:var(--nb-serif);font-size:22px}
.pr-list{margin:0 0 16px;padding-left:19px}
.pr-list li{margin:4px 0;font-size:14px;color:var(--nb-ink-2)}
.pr-link .pr-soon{display:inline;margin:0 0 0 10px}
.pr-rec{border-color:var(--nb-gold)}
.pr-badge{display:inline-block;margin-bottom:12px;padding:3px 10px;background:var(--nb-gold);
  color:var(--nb-paper-2);font-size:11.5px;font-weight:700;letter-spacing:.06em}
.pr-note{margin:56px 0 0;padding:22px 0 0;border-top:1px solid var(--nb-line-soft);
  font-size:13px;line-height:1.85;color:var(--nb-ink-3)}
.pr-note a{color:var(--nb-gold)}

/* 상품 하나짜리 페이지 */
.pd-back{display:inline-block;margin-bottom:18px;font-size:13.5px;color:var(--nb-gold);text-decoration:none}
.pd-hero{width:100%;max-width:300px;aspect-ratio:3/4;object-fit:cover;margin:0 0 22px;
  background:var(--nb-paper-2);border:1px solid var(--nb-line-soft)}
.pd-term{margin:0 0 14px;font-size:13.5px;color:var(--nb-ink-2)}
.pd-term b{color:var(--nb-ink)}
.pd-buy{margin:22px 0;padding:20px 22px;border:1px solid var(--nb-line);background:var(--nb-paper-2)}
.pd-price{font-family:var(--nb-serif);font-size:27px}
.pd-also{margin:8px 0 0;font-size:14px;color:var(--nb-ink-2)}
/* 언제·어떻게 받고 어떻게 무르는지. 카드사 심사가 상세페이지에서 이걸 본다 */
.pd-terms{margin:22px 0 0;padding:20px 22px;border:1px solid var(--nb-line-soft);background:var(--nb-paper-2)}
.pd-terms dt{font-family:var(--nb-serif);font-size:14.5px;color:var(--nb-gold);margin:14px 0 4px}
.pd-terms dt:first-child{margin-top:0}
.pd-terms dd{margin:0;font-size:14.5px;line-height:1.8;color:var(--nb-ink-2);word-break:keep-all}
.pd-terms dd b{color:var(--nb-ink)}
.pd-terms a{color:var(--nb-gold)}
.pr-body>h3,.pr-card>h3{font-family:var(--nb-serif)}

@media (min-width:760px){
  .pr-top h2{font-size:34px}
  .pr-grid{grid-template-columns:repeat(3,1fr);gap:40px 28px}
  .pr-wide>.pr-link{display:grid;grid-template-columns:1.15fr 1fr}
  .pr-wide>.pr-link>*{min-width:0}
  .pr-wide .pr-shot{aspect-ratio:auto;height:100%;border-bottom:0;border-right:1px solid var(--nb-line)}
  .pr-body{align-self:center;padding:40px 38px}
}
@media (prefers-color-scheme:dark){
  :root{
    --nb-paper:#131A26; --nb-paper-2:#1A2231; --nb-line:#2E3A4D; --nb-line-soft:#25303F;
    --nb-ink:#E9E3D6; --nb-ink-2:#A6AFC0; --nb-ink-3:#7B8394; --nb-gold:#C2A063;
    --nb-veil-0:rgba(19,26,38,0); --nb-veil-1:rgba(19,26,38,.78);
  }
  .pr-badge{color:#131A26}
}
${SPIRITS_CSS}`;

/**
 * 상품 목록 한 덩어리. 화면에도 붙이고 전용 페이지에도 쓴다.
 *
 * 열셋을 그냥 늘어놓으면 아무도 못 고른다. 그래서 갈래로 묶고,
 * 갈래 제목을 **질문으로** 단다 — 「연애」라고만 쓰면 안 눌리고
 * 「이 사람, 괜찮을까?」라고 쓰면 눌린다.
 */
/**
 * 상품 목록.
 *
 * `prices` 를 끄면 값과 묶음이 빠진다. **첫 화면에서 값부터 보이면 손님이
 * 물러선다** — 아직 뭘 봐 주는지도 모르는 사람에게 계산부터 시키는 셈이다.
 * 그래서 첫 화면은 무엇을 봐 주는지만 보여 주고, 값은 가격표 페이지에서 본다.
 *
 * 값을 아주 없애지는 않는다. 카드사 등록심사가 「상품과 가격이 홈페이지에
 * 있는가」를 보기 때문에, `/products` 와 상품별 페이지에는 그대로 남는다.
 */
export function renderProducts(
  ready: boolean, images: ProductImages = NO_IMAGES, faces: SpiritImages = NO_FACES,
  prices = true,
): string {
  const groups = CATEGORIES.map((c) => {
    const all = productsIn(c.key);
    // 삼합 리포트는 갈래 맨 앞에 한 칸을 다 쓴다. 제일 비싸고 우리만 하는 것이다
    const star = all.find((p) => p.id === FEATURED);
    const cards = [
      ...(star ? [featureCard(star, ready, images, prices)] : []),
      ...all.filter((p) => p !== star).map((p) => productCard(p, ready, images, c.question, prices)),
    ].join('\n');
    // 갈래마다 주인이 있다. 신령이 질문을 던지고, 그 아래에 그 신령의 물건이 놓인다
    const spirit = spiritOf(c.key);
    const head = spirit
      ? renderSpiritHead(spirit, c.question, faces)
      : `<h3 class="pr-q">${esc(c.question)}</h3>`;
    return `<section class="pr-group">
<p class="pr-cat">${esc(c.key)}</p>
${head}
<div class="pr-grid">
${cards}
</div>
</section>`;
  }).join('\n');

  const packs = Object.values(PACKAGES)
    .sort((a, b) => a.priceKrw - b.priceKrw)
    .map((p) => packageCard(p, ready)).join('\n');

  return `<section class="pr" id="products">
<div class="pr-top">
<h2>${prices ? '판매 상품과 가격' : '무엇을 봐 드리나'}</h2>
<p class="pr-intro">${prices
    ? `사주 명식·궁합·관상·손금 풀이 자체는 무료이며, 결제 없이 이용하실 수 있습니다.
아래는 그보다 깊이 들어가는 유료 리포트입니다.`
    : `사주 명식·궁합·관상·손금 풀이는 결제 없이 보실 수 있습니다.
아래는 신령이 한 갈래씩 깊이 들여다보는 것들입니다.`}</p>
<div class="pr-rule"></div>
</div>
${groups}
${prices ? `<section class="pr-group">
<p class="pr-cat">묶음</p>
<h3 class="pr-q">여러 개를 함께 보시려면</h3>
<div class="pr-grid">
${packs}
</div>
</section>` : ''}
${prices ? `<p class="pr-note">
묶음 가격 옆의 「따로 사면」은 <strong>구성 상품을 실제로 낱개 판매하는 가격의 합계</strong>입니다.
판매한 적 없는 정가를 지어내 할인율을 부풀리지 않습니다.<br>
결제 전에 리포트 일부를 미리 보실 수 있으며, 결제일부터 ${WITHDRAWAL_WINDOW_DAYS}일 이내에
청약철회가 가능합니다. 자세한 내용은 <a href="/refund">취소·환불 정책</a>을 참고해 주세요.
</p>` : `<p class="pr-note">
값은 상품마다 다릅니다. <a href="/products">판매 상품과 가격 전체 보기</a><br>
결제 전에 리포트 일부를 미리 보실 수 있으며, 결제일부터 ${WITHDRAWAL_WINDOW_DAYS}일 이내에
청약철회가 가능합니다.
</p>`}
</section>`;
}

/** 상품만 담은 독립 페이지. 심사가 곧바로 열어볼 수 있는 주소를 만든다 */
export function renderProductsPage(
  info: BusinessInfo, ready: boolean, footer: string, images: ProductImages = NO_IMAGES,
  faces: SpiritImages = NO_FACES,
): string {
  const site = show(info, 'serviceName', '서비스 이름');
  return `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
${renderSocialHead(info, {
    title: '판매 상품과 가격',
    description: '사주 명식·궁합·관상·손금 풀이는 결제 없이 보실 수 있습니다. 더 깊이 보는 리포트의 값을 여기에 모두 적어 두었습니다.',
    path: '/products',
  })}
${FONT_LINK}
<style>
:root{color-scheme:light dark}
body{margin:0}
${PRODUCTS_CSS}
</style>
</head>
<body>
${renderProducts(ready, images, faces)}
<div style="height:24px"></div>
${footer}
</body>
</html>`;
}


/**
 * 상품 하나짜리 페이지.
 *
 * 카드사 등록심사가 **"상품을 클릭했을 때 상세페이지에 상품 설명이 제대로
 * 되어 있는가"** 를 본다. 목록에 설명이 다 있어도 클릭해서 들어갈 곳이 없으면
 * 걸린다. 그래서 상품마다 고유한 주소를 준다.
 *
 * 검색에도 같은 이유로 유리하다 — 사람들은 「사주」가 아니라 「재물운 사주」로
 * 검색하고, 그 검색어에 대응하는 페이지가 있어야 걸린다.
 */
export function renderProductPage(
  product: Product, info: BusinessInfo, ready: boolean, footer: string,
  images: ProductImages = NO_IMAGES, faces: SpiritImages = NO_FACES,
): string {
  const site = show(info, 'serviceName', '서비스 이름');
  // 이 상품을 파는 신령. 목록에서 이 상품을 누른 손님은 같은 얼굴을 다시 만난다
  const spirit = spiritOf(product.category);
  const items = (CONTENTS[product.id] ?? []).map((t) => `<li>${bold(t)}</li>`).join('');
  const packs = Object.values(PACKAGES)
    .filter((p) => p.members.includes(product.id))
    .sort((a, b) => a.priceKrw - b.priceKrw);
  const alsoIn = packs.length
    ? `<p class="pd-also">이 리포트는 ${packs.map((p) => `<b>${esc(p.name)}</b>(${won(bundleMath(p.id).bundleKrw)})`).join(', ')} 묶음에도 들어 있습니다.</p>`
    : '';

  return `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
${renderSocialHead(info, {
    title: product.name,
    description: `${product.hook} ${product.description}`,
    path: `/products/${encodeURIComponent(product.id)}`,
  })}
${FONT_LINK}
<style>
:root{color-scheme:light dark}
body{margin:0}
${PRODUCTS_CSS}
</style>
</head>
<body>
<section class="pr">
  <a class="pd-back" href="/products">← 판매 상품 전체 보기</a>
  ${images.has(product.id)
    ? `<img class="pd-hero" src="${imageUrl(product.id)}" alt="" width="280" height="373" decoding="async">`
    : ''}
  <p class="pr-hook">${esc(product.hook)}</p>
  <h2>${esc(product.name)}</h2>
  ${spirit ? renderSpiritPitch(spirit, product.id, faces) : ''}
  ${product.topic ? `<p class="pd-term">명리에서는 <b>${esc(TERM_OF[product.topic] ?? '')}</b>이라 부르는 자리입니다.</p>` : ''}
  <p class="pr-desc">${esc(product.description)}</p>
  ${items ? `<h3 style="font-size:15.5px;margin:18px 0 6px">이 리포트에 담기는 것</h3><ul class="pr-list">${items}</ul>` : ''}

  <div class="pd-buy">
    <span class="pd-price">${won(product.priceKrw)}</span><span class="pr-vat"> (부가세 포함)</span>
    ${product.needsPartner ? '<p class="pd-also">두 사람의 생년월일이 필요합니다.</p>' : ''}
    ${ready
      ? '<p class="pd-also">첫 화면에서 생년월일을 넣으시면 미리보기를 보신 뒤 구매하실 수 있습니다.</p>'
      : '<p class="pd-also"><b>결제 준비 중입니다.</b> 사주 명식·궁합·관상·손금 풀이는 지금도 결제 없이 이용하실 수 있습니다.</p>'}
    ${alsoIn}
  </div>

  <dl class="pd-terms">
    <dt>언제 받나요</dt>
    <dd>결제하시면 <b>바로</b> 보실 수 있습니다. 늦어도 ${WITHDRAWAL_WINDOW_DAYS}일 이내에 드립니다.</dd>
    <dt>어떻게 받나요</dt>
    <dd>화면으로 보여 드립니다. 택배로 보내는 물건이 아닙니다.</dd>
    <dt>무르고 싶으면</dt>
    <dd>결제일부터 ${WITHDRAWAL_WINDOW_DAYS}일 안에 말씀하시면 돌려드립니다.
    글로 된 것이라 바꿔 드리는 것(교환)은 없고, 돈으로 돌려드립니다.
    <a href="/refund">자세한 규정</a></dd>
  </dl>

  <p class="pr-note">
  결제 전에 리포트 일부를 미리 보실 수 있으며, 결제일부터 ${WITHDRAWAL_WINDOW_DAYS}일 이내에
  청약철회가 가능합니다. 자세한 내용은 <a href="/refund">취소·환불 정책</a>을 참고해 주세요.<br>
  이 해석은 전통 명리 이론에 근거한 참고 자료이며, 의료·법률·투자 판단의 근거가 아닙니다.
  </p>
  <p><a class="pd-back" href="/">← ${esc(site)} 첫 화면</a></p>
</section>
<div style="height:24px"></div>
${footer}
</body>
</html>`;
}

/** 주제별 상품에 붙일 명리 용어. `packages/saju-rules` 의 이름표와 같은 값이다 */
const TERM_OF: Record<string, string> = {
  wealth: '재성(財星)', career: '관성(官星)', expression: '식상(食傷)',
  learning: '인성(印星)', peers: '비겁(比劫)', charm: '도화·홍염(桃花·紅艶)',
  travel: '역마(驛馬)', helper: '천을귀인(天乙貴人)',
};
