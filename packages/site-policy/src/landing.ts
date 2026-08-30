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

export const LANDING_CSS = `
.lp{max-width:560px;margin:0 auto;padding:34px 20px 8px;
  font:16px/1.75 -apple-system,BlinkMacSystemFont,"Apple SD Gothic Neo","Malgun Gothic",system-ui,sans-serif;
  color:#1b1b1f}
.lp-brand{display:flex;align-items:center;gap:9px;margin:0 0 22px}
.lp-seal{width:30px;height:30px;border-radius:8px;background:#5b3fa8;color:#fff;
  display:grid;place-items:center;font-size:16px;font-weight:700;flex:0 0 auto}
.lp-name{font-size:17px;font-weight:700;letter-spacing:-.01em}
.lp h1{font-size:30px;line-height:1.35;font-weight:800;letter-spacing:-.02em;margin:0 0 12px}
.lp h1 em{font-style:normal;color:#5b3fa8}
.lp-sub{font-size:15.5px;color:#4a4a55;margin:0 0 24px}
.lp-cta{display:inline-block;background:#5b3fa8;color:#fff;text-decoration:none;
  font-size:16px;font-weight:700;padding:14px 26px;border-radius:999px}
.lp-free{display:block;font-size:13px;color:#5c5c66;margin-top:10px}
.lp-badges{margin:30px 0 4px;display:grid;gap:12px}
.lp-badge{display:flex;gap:12px;align-items:flex-start;border:1px solid #e3e3ea;
  border-radius:12px;padding:14px 16px;background:#fff}
.lp-icon{font-size:17px;color:#5b3fa8;line-height:1.5;flex:0 0 auto}
.lp-bt{font-size:15px;font-weight:700;margin:0 0 3px}
.lp-bb{font-size:13.5px;color:#5c5c66;margin:0}
.lp-hr{border:0;border-top:1px solid #e3e3ea;margin:30px 0 0}
@media (prefers-color-scheme:dark){
.lp{color:#e8e8ee}
.lp-sub{color:#b4b4c0}
.lp h1 em,.lp-icon{color:#b9a4f0}
.lp-cta{background:#b9a4f0;color:#16161a}
.lp-badge{background:#1e1e24;border-color:#33333d}
.lp-bb,.lp-free{color:#a0a0ad}
.lp-hr{border-top-color:#33333d}
}`;

export function renderHero(info: BusinessInfo, ready: boolean): string {
  const name = esc(show(info, 'serviceName', '서비스 이름'));
  const badges = BADGES.map((b) => `  <div class="lp-badge">
    <span class="lp-icon" aria-hidden="true">${b.icon}</span>
    <div><p class="lp-bt">${esc(b.title)}</p><p class="lp-bb">${esc(b.body)}</p></div>
  </div>`).join('\n');

  return `<section class="lp">
  <div class="lp-brand">
    <span class="lp-seal" aria-hidden="true">命</span>
    <span class="lp-name">${name}</span>
  </div>

  <h1>사주 하나로는<br>안 보이는 것이 있습니다</h1>
  <p class="lp-sub">사주와 관상과 손금, <em>세 갈래를 맞춰</em> 봅니다.
  같은 말을 하는 곳은 확신을 갖고, 엇갈리는 곳은 왜 엇갈리는지 짚어 드립니다.</p>

  <a class="lp-cta" href="#try">내 사주 무료로 보기</a>
  <span class="lp-free">생년월일만 있으면 됩니다. ${ready ? '결제 없이' : '지금은 결제 없이'} 명식·궁합·관상·손금을 보실 수 있습니다.</span>

  <div class="lp-badges">
${badges}
  </div>
  <hr class="lp-hr">
</section>`;
}

/**
 * 무료 구간 앞에 붙일 안내.
 *
 * 상품 목록을 지나 아래로 내려온 사람에게, 여기부터는 돈이 들지 않는다는 것을
 * 분명히 알린다. 유료 화면과 무료 화면이 섞여 보이면 손님은 뒤로 나간다.
 */
export function renderTryHeading(): string {
  return `<section class="lp" id="try">
  <h1 style="font-size:22px;margin-bottom:8px">무료로 직접 해보기</h1>
  <p class="lp-sub" style="margin-bottom:0">생년월일시를 넣으면 사주 여덟 글자와 십신·용신·대운까지
  바로 나옵니다. 궁합과 관상·손금도 결제 없이 보실 수 있습니다.</p>
</section>`;
}
