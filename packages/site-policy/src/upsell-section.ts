/**
 * 이어사기(Upsell) UI 컴포넌트 및 클라이언트 스크립트.
 *
 * 결제 직후 화면(checkout-page.ts)과 주문 조회 화면(order-page.ts)에서 공용으로 사용한다.
 *
 * ## 규칙
 * 1. 값 셋(단품가, 정가 추가비용, 12시간 특가)은 catalog.ts / calculateUpsellPrice 에서 온다.
 * 2. 12시간 판정은 서버가 정한 expiresAt / viewedAt 을 기준으로 작동한다.
 * 3. 두 단추(이어보기 / 나중에 보기)는 동일한 시각적 무게를 갖는다.
 */

import { esc } from './report-render.ts';

export interface UpsellItemViewData {
  info: {
    nextProduct?: { id: string; name: string; priceKrw?: number };
    singlePriceKrw: number;
    currentPriceKrw: number;
    regularUpgradeKrw: number;
    isPromo: boolean;
    expiresAt: string;
    remainingFormatted: string;
    isMatched?: boolean;
  };
  reason?: string;
  checkoutUrl: string;
}

export interface UpsellViewData {
  items?: UpsellItemViewData[];
  info?: UpsellItemViewData['info'];
  reason?: string;
  checkoutUrl?: string;
}

/**
 * 이어사기(추천 3개) 섹션 HTML을 반환한다.
 */
export function renderUpsellSection(upsellData?: UpsellViewData | null): string {
  if (!upsellData) return '';

  const items: UpsellItemViewData[] = (upsellData.items && upsellData.items.length > 0)
    ? upsellData.items
    : (upsellData.info && upsellData.info.nextProduct)
      ? [{ info: upsellData.info, reason: upsellData.reason, checkoutUrl: upsellData.checkoutUrl || '' }]
      : [];

  if (items.length === 0) return '';

  const first = items[0];
  const expiresAt = first.info.expiresAt;
  const isPromo = first.info.isPromo;
  const remainingFormatted = first.info.remainingFormatted || '12:00:00';

  const cardsHtml = items.map((item, idx) => {
    const info = item.info;
    const nextName = info.nextProduct?.name || '다음 점사';
    const singlePriceStr = info.singlePriceKrw.toLocaleString('ko-KR');
    const currentPriceStr = info.currentPriceKrw.toLocaleString('ko-KR');
    const regularPriceStr = info.regularUpgradeKrw.toLocaleString('ko-KR');
    /*
     * 터진 뒤에 적은 것 (2026-10-02): 「30% 할인」이라고 손으로 적어 두었는데
     * 값이 끝자리 900원으로 내려가느라 실제로는 30~34%였다. 적은 숫자와 실제가
     * 다르면 그 자체가 위반이다. **카드마다 실제 비율을 계산해서 적는다.**
     * 내림한다 — 31.7%를 32%로 올려 적으면 그만큼이 과장이다.
     */
    const discountRate = info.singlePriceKrw > 0
      ? `${Math.floor((1 - info.currentPriceKrw / info.singlePriceKrw) * 100)}%`
      : '';
    const reason = item.reason || '';
    const checkoutUrl = item.checkoutUrl || '#';

    return `
    <div class="od-upsell-card" data-single="${info.singlePriceKrw}" data-promo="${info.currentPriceKrw}" data-reg="${info.regularUpgradeKrw}">
      <div class="od-upsell-circle-badge">${discountRate}<br>할인</div>
      ${info.isMatched ? '<div class="od-upsell-match-tag">손님 물음에 맞춘 것</div>' : ''}
      <h3 class="od-upsell-card-title">${esc(nextName)}</h3>
      ${reason ? `<p class="od-upsell-reason">${esc(reason)}</p>` : ''}
      ${!info.isPromo ? `<p class="od-upsell-expired-note" style="font-size:13px;color:#f0c080;margin:0 0 8px">할인 시간이 지났습니다</p>` : ''}
      <div class="od-upsell-pricing">
        <b class="od-upsell-price-gold">${currentPriceStr}원</b>
        <span class="od-upsell-price-orig">원래 ${singlePriceStr}원 (따로 사면 ${singlePriceStr}원)</span>
      </div>
      <div class="od-upsell-actions">
        <a class="od-upsell-btn" href="${esc(checkoutUrl)}">${esc(nextName)} 이어보기</a>
      </div>
    </div>`;
  }).join('');

  return `
  <section class="od-upsell-box" id="odUpsellSection">
    <div class="od-upsell-header">
      <span class="od-upsell-badge">${isPromo ? '다음 이야기 이어보기 · 12시간 안에만 이 값입니다' : '다음 이야기 이어보기 · 할인 시간이 지났습니다'}</span>
      <span class="od-upsell-timer" id="odUpsellTimer" data-expires="${esc(expiresAt)}">${isPromo ? `남은 시간 ${esc(remainingFormatted)}` : '할인 시간이 지났습니다'}</span>
    </div>
    <div class="od-upsell-cards">
      ${cardsHtml}
    </div>
    <div class="od-upsell-bottom-action" style="margin-top:16px;text-align:center">
      <button type="button" class="od-later-btn" onclick="var el=document.getElementById('odUpsellSection');if(el)el.style.display='none'">나중에 보기</button>
    </div>
  </section>
  <script>
  (function(){
    var timerEl = document.getElementById('odUpsellTimer');
    if(!timerEl) return;
    var expStr = timerEl.getAttribute('data-expires');
    if(!expStr) return;
    var expTime = new Date(expStr).getTime();
    var cards = document.querySelectorAll('.od-upsell-card');

    var uTimer = setInterval(function(){
      var diff = expTime - Date.now();
      if(diff <= 0){
        clearInterval(uTimer);
        timerEl.textContent = '할인 시간이 지났습니다';
        cards.forEach(function(card){
          var badge = card.querySelector('.od-upsell-circle-badge');
          var goldPrice = card.querySelector('.od-upsell-price-gold');
          var regVal = card.getAttribute('data-reg');
          var singleVal = card.getAttribute('data-single');
          if(badge && regVal && singleVal && Number(singleVal) > 0){
            badge.innerHTML = Math.floor((1 - Number(regVal) / Number(singleVal)) * 100) + '%<br>할인';
          }
          if(goldPrice && regVal) goldPrice.textContent = Number(regVal).toLocaleString('ko-KR') + '원';
        });
        return;
      }
      var h = Math.floor(diff / 3600000);
      var m = Math.floor((diff % 3600000) / 60000);
      var s = Math.floor((diff % 60000) / 1000);
      var pad = function(n){ return (n < 10 ? '0' : '') + n; };
      timerEl.textContent = '남은 시간 ' + pad(h) + ':' + pad(m) + ':' + pad(s);
    }, 1000);
  })();
  </script>`;
}

export const UPSELL_CSS = `
/* ── 이어사기 칸 (3개 카드 세로 배치) ───────────────────────── */
.od-upsell-box{margin-top:28px;margin-bottom:28px;padding:24px 20px;background:rgba(212,175,55,.05);border:1px solid rgba(212,175,55,.28);border-radius:12px;box-shadow:0 6px 24px rgba(0,0,0,.35)}
.od-upsell-header{display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;margin-bottom:18px;border-bottom:1px solid rgba(212,175,55,.15);padding-bottom:12px}
.od-upsell-badge{display:inline-block;padding:5px 11px;background:rgba(212,175,55,.2);color:#f3e5ab;font-size:13px;font-weight:700;border-radius:5px}
.od-upsell-timer{font-size:14px;color:#f3e5ab;font-family:monospace;font-weight:600}
.od-upsell-cards{display:flex;flex-direction:column;gap:16px}
.od-upsell-card{position:relative;background:rgba(255,255,255,.03);border:1px solid rgba(212,175,55,.22);border-radius:10px;padding:20px 18px 18px}
.od-upsell-circle-badge{position:absolute;top:16px;right:16px;width:48px;height:48px;border-radius:50%;background:#dc2626;color:#fff;display:flex;align-items:center;justify-content:center;text-align:center;font-size:11.5px;font-weight:800;line-height:1.15;box-shadow:0 3px 8px rgba(220,38,38,.4)}
.od-upsell-match-tag{display:inline-block;padding:3px 8px;background:rgba(212,175,55,.18);color:#f3e5ab;font-size:11.5px;font-weight:700;border-radius:4px;margin-bottom:8px;border:1px solid rgba(212,175,55,.35)}
.od-upsell-card-title{font-size:18px;font-weight:800;color:#fff;margin:0 0 6px;padding-right:54px}
.od-upsell-reason{font-size:14px;color:#c8c2d4;margin:0 0 14px;line-height:1.6;word-break:keep-all}
.od-upsell-pricing{display:flex;align-items:baseline;gap:8px;margin-bottom:16px}
.od-upsell-price-gold{font-size:20px;font-weight:800;color:#d4af37}
.od-upsell-price-orig{font-size:13.5px;color:#8e889b}
.od-upsell-actions{display:flex;gap:12px}
.od-upsell-btn, .od-later-btn{flex:1 1 50%;padding:14px 16px;font-size:15px;font-weight:700;text-align:center;border-radius:8px;text-decoration:none;box-sizing:border-box;display:inline-block;cursor:pointer;border:1px solid rgba(212,175,55,.6);line-height:1.3;font-family:inherit}
.od-upsell-btn{background:#d4af37;color:#18151f;flex:1 1 auto}
.od-later-btn{background:rgba(212,175,55,.15);color:#f3e5ab}
`;
