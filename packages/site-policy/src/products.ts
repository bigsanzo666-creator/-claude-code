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

function esc(value: string): string {
  return value.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));
}

const won = (n: number) => `${n.toLocaleString('ko-KR')}원`;

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

function productCard(product: Product, ready: boolean): string {
  const items = (CONTENTS[product.id] ?? []).map((t) => `<li>${bold(t)}</li>`).join('');
  const action = ready
    ? '<span class="pr-buy">위에서 정보를 입력하시면 구매하실 수 있습니다</span>'
    : '<span class="pr-soon">결제 준비 중</span>';
  return `<article class="pr-card">
  <p class="pr-hook">${esc(product.hook)}</p>
  <h3><a class="pr-link" href="/products/${esc(product.id)}">${esc(product.name)}</a></h3>
  <p class="pr-desc">${esc(product.description)}</p>
  ${items ? `<ul class="pr-list">${items}</ul>` : ''}
  <div class="pr-foot">
    <span class="pr-price">${won(product.priceKrw)}<span class="pr-vat"> (부가세 포함)</span></span>
    ${action}
  </div>
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
  return `<article class="pr-card${pack.recommended ? ' pr-rec' : ''}">
  ${pack.recommended ? '<span class="pr-badge">추천</span>' : ''}
  <p class="pr-hook">${esc(pack.hook)}</p>
  <h3>${esc(pack.name)}</h3>
  <p class="pr-desc">${esc(names)}</p>
  <div class="pr-foot">
    <span class="pr-price">${won(m.bundleKrw)}<span class="pr-vat"> (부가세 포함)</span></span>
    <span class="pr-save">따로 사면 ${won(m.individualKrw)} · ${m.percent}% 절약</span>
    ${ready ? '' : '<span class="pr-soon">결제 준비 중</span>'}
  </div>
</article>`;
}

export const PRODUCTS_CSS = `
.pr{max-width:760px;margin:0 auto;padding:28px 20px 8px;font:15px/1.7 -apple-system,BlinkMacSystemFont,"Apple SD Gothic Neo","Malgun Gothic",system-ui,sans-serif;color:#1b1b1f}
.pr h2{font-size:20px;margin:0 0 6px}
.pr-intro{color:#5c5c66;margin:0 0 18px;font-size:14px}
.pr-group{margin:26px 0}
.pr-q{font-size:17px;margin:0 0 2px}
.pr-cat{font-size:12px;color:#5c5c66;margin:0 0 12px;letter-spacing:.02em}
.pr-card{position:relative;border:1px solid #e3e3ea;border-radius:12px;padding:18px 20px;margin-bottom:14px;background:#fff}
.pr-rec{border-color:#5b3fa8;border-width:2px}
.pr-badge{position:absolute;top:-10px;left:18px;background:#5b3fa8;color:#fff;font-size:11.5px;font-weight:700;padding:3px 9px;border-radius:999px}
.pr-hook{margin:0 0 4px;font-size:13.5px;color:#5b3fa8;font-weight:600}
.pr-link{color:inherit;text-decoration:none}
.pr-link:hover,.pr-link:focus{text-decoration:underline}
.pd-back{display:inline-block;font-size:13.5px;color:#5b3fa8;text-decoration:none;margin-bottom:16px}
.pd-term{font-size:13.5px;color:#5c5c66;margin:0 0 14px}
.pd-term b{color:#1b1b1f}
.pd-buy{border:1px solid #e3e3ea;border-radius:12px;padding:16px 18px;margin:20px 0;background:#fff}
.pd-price{font-size:26px;font-weight:800}
.pd-also{font-size:14px;color:#5c5c66;margin:6px 0 0}
.pr-save{font-size:13px;color:#5c5c66}
.pr-card h3{font-size:16.5px;margin:0 0 4px}
.pr-desc{color:#5c5c66;margin:0 0 12px;font-size:14px}
.pr-list{margin:0 0 14px;padding-left:20px}
.pr-list li{margin:4px 0;font-size:14px}
.pr-foot{display:flex;flex-wrap:wrap;align-items:baseline;gap:6px 14px;border-top:1px solid #eeeef3;padding-top:12px}
.pr-price{font-size:19px;font-weight:700}
.pr-vat{font-size:12.5px;font-weight:400;color:#5c5c66}
.pr-buy,.pr-soon{font-size:13px;color:#5c5c66}
.pr-soon{color:#9a6b00}
.pr-note{font-size:13px;color:#5c5c66;background:#f6f6fa;border-radius:10px;padding:12px 14px;margin:4px 0 0}
.pr-note a{color:#5b3fa8}
@media (prefers-color-scheme:dark){
.pr{color:#e8e8ee}
.pr-intro,.pr-desc,.pr-vat,.pr-buy,.pr-note,.pr-cat,.pr-save{color:#a0a0ad}
.pr-hook{color:#b9a4f0}
.pr-rec{border-color:#b9a4f0}
.pr-badge{background:#b9a4f0;color:#16161a}
.pr-card{background:#1e1e24;border-color:#33333d}
.pr-foot{border-top-color:#2c2c35}
.pr-note{background:#1e1e24}
.pr-note a{color:#b9a4f0}
.pd-back{color:#b9a4f0}
.pd-term,.pd-also{color:#a0a0ad}
.pd-term b{color:#e8e8ee}
.pd-buy{background:#1e1e24;border-color:#33333d}
.pr-soon{color:#e0b34d}
}`;

/**
 * 상품 목록 한 덩어리. 화면에도 붙이고 전용 페이지에도 쓴다.
 *
 * 열셋을 그냥 늘어놓으면 아무도 못 고른다. 그래서 갈래로 묶고,
 * 갈래 제목을 **질문으로** 단다 — 「연애」라고만 쓰면 안 눌리고
 * 「이 사람, 괜찮을까?」라고 쓰면 눌린다.
 */
export function renderProducts(ready: boolean): string {
  const groups = CATEGORIES.map((c) => {
    const cards = productsIn(c.key).map((p) => productCard(p, ready)).join('\n');
    return `<section class="pr-group">
<h3 class="pr-q">${esc(c.question)}</h3>
<p class="pr-cat">${esc(c.key)}</p>
${cards}
</section>`;
  }).join('\n');

  const packs = Object.values(PACKAGES)
    .sort((a, b) => a.priceKrw - b.priceKrw)
    .map((p) => packageCard(p, ready)).join('\n');

  return `<section class="pr" id="products">
<h2>판매 상품과 가격</h2>
<p class="pr-intro">아래는 유료 리포트입니다. 사주 명식·궁합·관상·손금 풀이 자체는 무료이며,
결제 없이 이용하실 수 있습니다.</p>
${groups}
<section class="pr-group">
<h3 class="pr-q">여러 개를 함께 보시려면</h3>
<p class="pr-cat">묶음</p>
${packs}
</section>
<p class="pr-note">
묶음 가격 옆의 「따로 사면」은 <strong>구성 상품을 실제로 낱개 판매하는 가격의 합계</strong>입니다.
판매한 적 없는 정가를 지어내 할인율을 부풀리지 않습니다.<br>
결제 전에 리포트 일부를 미리 보실 수 있으며, 결제일부터 ${WITHDRAWAL_WINDOW_DAYS}일 이내에
청약철회가 가능합니다. 자세한 내용은 <a href="/refund">취소·환불 정책</a>을 참고해 주세요.
</p>
</section>`;
}

/** 상품만 담은 독립 페이지. 심사가 곧바로 열어볼 수 있는 주소를 만든다 */
export function renderProductsPage(info: BusinessInfo, ready: boolean, footer: string): string {
  const site = show(info, 'serviceName', '서비스 이름');
  return `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>판매 상품과 가격 · ${esc(site)}</title>
<style>
:root{color-scheme:light dark}
body{margin:0;background:#fbfbfd}
@media (prefers-color-scheme:dark){body{background:#16161a}}
${PRODUCTS_CSS}
</style>
</head>
<body>
${renderProducts(ready)}
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
): string {
  const site = show(info, 'serviceName', '서비스 이름');
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
<title>${esc(product.name)} · ${esc(site)}</title>
<meta name="description" content="${esc(product.hook)} ${esc(product.description)}">
<style>
:root{color-scheme:light dark}
body{margin:0;background:#fbfbfd}
@media (prefers-color-scheme:dark){body{background:#16161a}}
${PRODUCTS_CSS}
</style>
</head>
<body>
<section class="pr">
  <a class="pd-back" href="/products">← 판매 상품 전체 보기</a>
  <p class="pr-hook">${esc(product.hook)}</p>
  <h2>${esc(product.name)}</h2>
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
