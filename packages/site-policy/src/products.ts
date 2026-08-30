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

import { CATALOG, type Product } from '../../commerce/src/catalog.ts';
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
};

function bold(text: string): string {
  // 설명 안의 **강조**만 살리고 나머지는 escape 한다
  return esc(text).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
}

function productCard(product: Product, ready: boolean): string {
  const items = (CONTENTS[product.id] ?? []).map((t) => `<li>${bold(t)}</li>`).join('');
  const action = ready
    ? `<span class="pr-buy">위에서 정보를 입력하시면 구매하실 수 있습니다</span>`
    : `<span class="pr-soon">결제 준비 중 — 무료 풀이는 지금 이용하실 수 있습니다</span>`;
  return `<article class="pr-card">
  <h3>${esc(product.name)}</h3>
  <p class="pr-desc">${esc(product.description)}</p>
  <ul class="pr-list">${items}</ul>
  <div class="pr-foot">
    <span class="pr-price">${won(product.priceKrw)}<span class="pr-vat"> (부가세 포함)</span></span>
    ${action}
  </div>
</article>`;
}

/**
 * 묶음 할인의 근거.
 *
 * 경쟁사들이 쓰는 "정가 36,740원 → 46% 할인" 같은 표시는, 그 가격에 실제로
 * 판 적이 없으면 표시광고법상 거짓·과장광고가 된다. 우리는 개별 상품이
 * 실재하므로 그 합계를 쓴다 — 같은 효과를 사실만으로 낸다.
 */
export function bundleSaving(): { individual: number; bundle: number; percent: number } {
  const individual = CATALOG['saju-report'].priceKrw + CATALOG['compat-report'].priceKrw;
  const bundle = CATALOG['cross-report'].priceKrw;
  return { individual, bundle, percent: Math.round((1 - bundle / individual) * 100) };
}

export const PRODUCTS_CSS = `
.pr{max-width:760px;margin:0 auto;padding:28px 20px 8px;font:15px/1.7 -apple-system,BlinkMacSystemFont,"Apple SD Gothic Neo","Malgun Gothic",system-ui,sans-serif;color:#1b1b1f}
.pr h2{font-size:20px;margin:0 0 6px}
.pr-intro{color:#5c5c66;margin:0 0 18px;font-size:14px}
.pr-card{border:1px solid #e3e3ea;border-radius:12px;padding:18px 20px;margin-bottom:14px;background:#fff}
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
.pr-intro,.pr-desc,.pr-vat,.pr-buy,.pr-note{color:#a0a0ad}
.pr-card{background:#1e1e24;border-color:#33333d}
.pr-foot{border-top-color:#2c2c35}
.pr-note{background:#1e1e24}
.pr-note a{color:#b9a4f0}
.pr-soon{color:#e0b34d}
}`;

/** 상품 목록 한 덩어리. 화면에도 붙이고 전용 페이지에도 쓴다 */
export function renderProducts(ready: boolean): string {
  const cards = Object.values(CATALOG).map((p) => productCard(p, ready)).join('\n');
  const { individual, bundle, percent } = bundleSaving();
  return `<section class="pr" id="products">
<h2>판매 상품과 가격</h2>
<p class="pr-intro">아래는 유료 리포트입니다. 사주 명식·궁합·관상·손금 풀이 자체는 무료이며,
결제 없이 이용하실 수 있습니다.</p>
${cards}
<p class="pr-note">
<strong>사주 종합(${won(CATALOG['saju-report'].priceKrw)})과 궁합(${won(CATALOG['compat-report'].priceKrw)})을
따로 구매하면 ${won(individual)}</strong>입니다.
교차검증 리포트는 ${won(bundle)}으로, 약 ${percent}% 절약됩니다.<br>
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
