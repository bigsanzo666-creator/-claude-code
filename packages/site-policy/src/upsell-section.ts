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

export interface UpsellViewData {
  info: {
    nextProduct?: { id: string; name: string };
    singlePriceKrw: number;
    currentPriceKrw: number;
    regularUpgradeKrw: number;
    isPromo: boolean;
    expiresAt: string;
    remainingFormatted: string;
  };
  reason: string;
  checkoutUrl: string;
}

/**
 * 이어사기 섹션 HTML을 반환한다.
 */
export function renderUpsellSection(upsellData?: UpsellViewData | null): string {
  if (!upsellData || !upsellData.info || !upsellData.info.nextProduct) {
    return '';
  }

  const { info, reason, checkoutUrl } = upsellData;
  const nextName = info.nextProduct.name;
  const singlePriceStr = info.singlePriceKrw.toLocaleString('ko-KR');
  const promoPriceStr = info.currentPriceKrw.toLocaleString('ko-KR');
  const regularPriceStr = info.regularUpgradeKrw.toLocaleString('ko-KR');

  return `
  <section class="od-upsell-box" id="odUpsellSection">
    <div class="od-upsell-header">
      <span class="od-upsell-badge">다음 이야기 이어보기</span>
      <span class="od-upsell-timer" id="odUpsellTimer" ${!info.isPromo ? 'style="display:none"' : ''}>남은 시간 ${esc(info.remainingFormatted)}</span>
    </div>
    <h2 class="od-upsell-title">${esc(nextName)}</h2>
    ${reason ? `<p class="od-upsell-reason">${esc(reason)}</p>` : ''}

    <div id="odUpsellPromoArea" ${!info.isPromo ? 'style="display:none"' : ''}>
      <p class="od-upsell-pricing">
        따로 사면 ${singlePriceStr}원 → <span class="od-price-now">12시간 한정 ${promoPriceStr}원</span>
      </p>
    </div>

    <div id="odUpsellExpiredArea" ${info.isPromo ? 'style="display:none"' : ''}>
      <p class="od-upsell-expired">
        할인 시간이 지났습니다. ${regularPriceStr}원에 이어 보실 수 있습니다.
      </p>
    </div>

    <div class="od-upsell-actions">
      <a class="od-upsell-btn" id="odUpsellBtn" href="${esc(checkoutUrl)}">${esc(nextName)} 이어보기 (<span id="odUpsellBtnPrice">${info.isPromo ? promoPriceStr : regularPriceStr}</span>원)</a>
      <button type="button" class="od-later-btn" id="odLaterBtn" onclick="var el=document.getElementById('odUpsellSection');if(el)el.style.display='none'">나중에 보기</button>
    </div>
  </section>`;
}

export const UPSELL_CSS = `
/* ── 이어사기 칸 ────────────────────────────────────────────── */
.od-upsell-box{margin-top:28px;margin-bottom:28px;padding:24px 20px;background:rgba(212,175,55,.05);border:1px solid rgba(212,175,55,.28);border-radius:12px;box-shadow:0 6px 24px rgba(0,0,0,.35)}
.od-upsell-header{display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;margin-bottom:12px}
.od-upsell-badge{display:inline-block;padding:4px 10px;background:rgba(212,175,55,.2);color:#f3e5ab;font-size:12px;font-weight:700;border-radius:4px}
.od-upsell-timer{font-size:14px;color:#f3e5ab;font-family:monospace;font-weight:600}
.od-upsell-title{font-size:19px;font-weight:800;color:#fff;margin:0 0 8px}
.od-upsell-reason{font-size:14.5px;color:#d8d2e5;margin:0 0 16px;line-height:1.65;word-break:keep-all}
.od-upsell-pricing{margin:0 0 18px;font-size:15px;color:#b9b2c6}
.od-price-now{font-size:17.5px;font-weight:800;color:#f3e5ab}
.od-upsell-expired{font-size:14px;color:#b9b2c6;margin-bottom:16px}
.od-upsell-actions{display:flex;gap:12px;margin-top:16px}
.od-upsell-btn, .od-later-btn{flex:1 1 50%;padding:14px 16px;font-size:15px;font-weight:700;text-align:center;border-radius:8px;text-decoration:none;box-sizing:border-box;display:inline-block;cursor:pointer;border:1px solid rgba(212,175,55,.6);line-height:1.3;font-family:inherit}
.od-upsell-btn{background:#d4af37;color:#18151f}
.od-later-btn{background:rgba(212,175,55,.15);color:#f3e5ab}
`;
