/**
 * 결제 화면.
 *
 * ## 왜 따로 한 장을 두는가
 *
 * 전에는 상세페이지의 「생년월일 넣고 받기」가 첫 화면(`/?buy=...`)으로
 * 돌려보냈다. 첫 화면은 신령계 대문이다. 손님은 **사겠다고 누른 뒤에**
 * 다시 이름과 생년월일을 적고, 문을 두드리고, 영상을 보고, 메뉴판에서
 * 자기가 고른 것을 다시 찾아야 했다. 찾아도 살 자리는 열리지 않았다.
 * 사장님이 「오늘의 운세」에서 실제로 그 길에 갇혔다 (2026-09-23).
 *
 * 사겠다고 누른 손님에게는 **살 자리**를 내놓는다. 그게 이 화면이다.
 *
 * ## 여기서 지키는 것
 *
 * - 값은 `packages/commerce/src/catalog.ts` 에서만 온다. 여기에 숫자를 적지 않는다
 * - 청약철회 고지를 결제 단추 **위에** 둔다. 확인 표를 안 하면 단추가 안 눌린다
 * - 광고 수신 동의는 두지 않는다. 결과를 받는 데 필요 없는 것을 결제 자리에서
 *   받으면 정보통신망법 제50조 문제가 된다
 * - 거짓 급함("지금만")을 쓰지 않는다. 2024년 개정 전자상거래법
 */

import { INVITE_DISCOUNT_KRW, INVITE_MIN_ORDER_KRW, INVITE_REWARD_DAYS, INVITE_REWARD_NAME } from '../../commerce/src/referral.ts';
import { type BusinessInfo, show } from './business.ts';
import { PLACES } from '../../saju-rules/src/index.ts';
import { renderSocialHead } from './social.ts';
import { FONT_LINK, PRODUCTS_CSS } from './products.ts';
import { renderInviteBadge, REFERRAL_BADGE_CSS } from './referral-badge.ts';
import { isLaunchSale, type Product } from '../../commerce/src/catalog.ts';
import { WITHDRAWAL_WINDOW_DAYS, DELIVERY_DUE_DAYS } from '../../commerce/src/refund.ts';
import {
  HOLIDAY_INCLUDED_MEMBERS, HOLIDAY_EXTRA_MEMBER_KRW, HOLIDAY_MAX_MEMBERS,
} from '../../commerce/src/catalog.ts';
import { PACKAGES } from '../../commerce/src/packages.ts';
import { NAMING_FIELD_RATIO, NAMING_POPULAR_TOP_RANK } from '../../naming/src/index.ts';
import { REPORT_CSS } from './report-render.ts';
import { UPSELL_CSS } from './upsell-section.ts';

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/**
 * 태어난 시간 고르개.
 *
 * 값은 각 시(時)의 **한가운데**다. 신령 처소에서 쓰는 표(`TIME_MAP`)와 같은 값이라야
 * 처소에서 적은 것이 여기 그대로 채워진다. 다르면 조용히 「모름」으로 떨어진다.
 * 모르는 사람이 많으므로 「모름」이 맨 위에 있다.
 */
export const HOURS: readonly [string, string][] = [
  ['', '모름 (낮 12시로 봅니다)'],
  ['00:30', '자시 — 밤 11:30 ~ 1:30'],
  ['02:30', '축시 — 새벽 1:30 ~ 3:30'],
  ['04:30', '인시 — 새벽 3:30 ~ 5:30'],
  ['06:30', '묘시 — 아침 5:30 ~ 7:30'],
  ['08:30', '진시 — 아침 7:30 ~ 9:30'],
  ['10:30', '사시 — 오전 9:30 ~ 11:30'],
  ['12:30', '오시 — 낮 11:30 ~ 1:30'],
  ['14:30', '미시 — 낮 1:30 ~ 3:30'],
  ['16:30', '신시 — 오후 3:30 ~ 5:30'],
  ['18:30', '유시 — 저녁 5:30 ~ 7:30'],
  ['20:30', '술시 — 밤 7:30 ~ 9:30'],
  ['22:30', '해시 — 밤 9:30 ~ 11:30'],
];


function placeOptions(name: string): string {
  return `<select name="${name}" id="${name}">`
    + PLACES.map((p) => `<option value="${esc(p.name)}"${p.name === '서울' ? ' selected' : ''}>${esc(p.name)}</option>`).join('')
    + '</select>';
}

function hourOptions(name: string): string {
  return `<select name="${name}" id="${name}">`
    + HOURS.map(([v, l]) => `<option value="${v}">${esc(l)}</option>`).join('')
    + '</select>';
}

export const CHECKOUT_CSS = `
p, li, label, h1, h2, h3, h4, h5,
.sub-desc-original, .co-pricenote, .pd-launch-bar, .pd-guarantee-note,
.form-hint, .spirits-menu-desc, .nb-launch-banner-text{
  text-wrap:pretty;
  word-break:keep-all;
  overflow-wrap:anywhere;
}
${REPORT_CSS}
${UPSELL_CSS}
.co{max-width:560px;margin:0 auto;padding:22px 18px 60px}
.co-back{display:inline-block;color:#b9b2c6;text-decoration:none;font-size:15px;letter-spacing:0.2px;margin-bottom:14px}
.co-what{background:rgba(255,255,255,.04);border:1px solid rgba(212,175,55,.32);
  border-radius:12px;padding:16px 16px 14px;margin-bottom:18px}
.co-what-head{display:flex;gap:14px;align-items:flex-start;margin-bottom:12px}
.co-img{width:64px;height:80px;object-fit:cover;border-radius:6px;flex:0 0 64px;background:rgba(255,255,255,.05)}
.co-what-info{flex:1 1 auto;min-width:0}
.co-saved-link{margin:18px 0;padding:16px 18px;background:rgba(212,175,55,.08);border:1px solid rgba(212,175,55,.3);border-radius:10px}
.co-saved-title{font-size:15px;font-weight:700;color:#f3e5ab;margin:0 0 10px}
.co-copy-box{display:flex;gap:8px}
.co-copy-box input{flex:1 1 auto;background:rgba(0,0,0,.3);border:1px solid rgba(255,255,255,.15);border-radius:6px;padding:8px 12px;color:#fff;font-size:14px}
.co-copy-box button{flex:0 0 auto;background:#d4af37;color:#18151f;border:none;border-radius:6px;padding:8px 14px;font-size:14px;font-weight:700;cursor:pointer}
.co-copy-done{font-size:14px;color:#4ade80;margin:6px 0 0}
  border-radius:12px;padding:16px 16px 14px;margin-bottom:18px}
.co-name{font-size:19px;font-weight:800;color:#f3e5ab;margin:0 0 4px}
.co-hook{font-size:15px;color:#c8c2d4;margin:0 0 12px;line-height:1.85}
.co-price{display:flex;align-items:baseline;justify-content:space-between;
  border-top:1px solid rgba(255,255,255,.1);padding-top:12px}
.co-price b{font-size:22px;color:#d4af37;font-weight:800}
.co-price b del{font-size:17px;color:#9a93a6;margin-right:6px;font-weight:400;text-decoration:line-through}
.co-price span{font-size:14px;color:#9a93a6}
.co-pricenote{margin:10px 0 0;font-size:14px;color:#c9a34a;line-height:1.85}
.co-pricenote b{color:#e8c86a}
.co-invite-entry{margin:10px 0 14px}
.co-invite-toggle{background:none;border:none;color:#f0d77a;font-size:16px;cursor:pointer;
  padding:4px 0;text-decoration:underline;font-family:inherit;display:inline-block}
.co-invite-toggle:hover{color:#ffe494}
.co-invite-remove-btn{background:none;border:none;color:#ffdd88;text-decoration:underline;cursor:pointer;font-size:14px;padding:4px 0;font-family:inherit}
.co-invite-remove-btn:hover{color:#fff}
.co-invite-fold{margin-top:8px;background:rgba(12,10,18,.8);border:1px solid rgba(212,175,55,.3);
  border-radius:8px;padding:10px 12px}
.co-invite-input-row{display:flex;gap:8px}
.co-invite-input-row input{flex:1 1 auto;background:rgba(0,0,0,.5);border:1px solid rgba(255,255,255,.2);
  border-radius:6px;padding:8px 10px;font-size:14px;color:#fff;font-family:inherit}
.co-invite-input-row button{background:#d4af37;color:#18151f;border:none;border-radius:6px;
  padding:8px 14px;font-size:14px;font-weight:700;cursor:pointer;font-family:inherit;white-space:nowrap}
.co-invite-msg{font-size:13px;margin:6px 0 0;line-height:1.5;color:#c8c2d4}
.co-invite-msg.ok{color:#9fd8a8;font-weight:600}
.co-invite-msg.warn{color:#f0c080}
.co-invite-msg.err{color:#e8b4b4}
.co-sec{margin:0 0 10px;font-size:15px;font-weight:700;color:#efe9f5}
.co-f{display:block;margin-bottom:12px}
.co-f label{display:block;font-size:14px;color:#c8c2d4;margin-bottom:5px}
.co-hint{display:block;font-size:14px;color:#b9b2c6;margin-top:6px;line-height:1.5}
.co-f input,.co-f select{width:100%;box-sizing:border-box;padding:11px 12px;font-size:16px;
  border-radius:8px;border:1px solid rgba(255,255,255,.16);background:rgba(12,10,18,.92);
  color:#f4f1f8;font-family:inherit}
.co-f input:focus,.co-f select:focus{outline:none;border-color:rgba(212,175,55,.7)}
.co-two{display:flex;gap:10px}
.co-two>*{flex:1 1 0;min-width:0}
.co-time-row{display:flex;gap:10px;align-items:center}
.co-time-row>input{flex:1 1 auto;min-width:0}
.co-time-unknown{display:flex;align-items:center;gap:6px;font-size:13px;color:#c8c2d4;cursor:pointer;white-space:nowrap;user-select:none;margin-bottom:0 !important}
.co-time-unknown input{width:auto !important;margin:0}
.co-btn-unknown{padding:10px 14px;border-radius:8px;background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.2);color:#c8c2d4;font-size:13px;white-space:nowrap;cursor:pointer;transition:all .15s ease}
.co-btn-unknown:hover{background:rgba(255,255,255,.14);color:#f4f1f8;border-color:#d4af37}
.co-addkin{display:block;width:100%;padding:11px;margin:0 0 14px;font-size:14px;
  border-radius:8px;border:1px dashed rgba(212,175,55,.5);background:transparent;
  color:#d4af37;cursor:pointer;font-family:inherit}
.co-addkin:disabled{opacity:.4;cursor:not-allowed}
.co-kin{border:1px solid rgba(255,255,255,.12);border-radius:10px;padding:12px;margin-bottom:10px}
.co-kin-top{display:flex;justify-content:space-between;align-items:center;margin-bottom:8px}
.co-kin-top b{font-size:14px;color:#e4dfea}
.co-kin-del{background:none;border:none;color:#9a93a6;font-size:14px;cursor:pointer;font-family:inherit}
.co-opt-block{background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.1);border-radius:8px;padding:10px 12px;margin-bottom:12px}
.co-hanja-pick{margin:10px 0 4px;padding:10px 12px;border:1px solid var(--nb-line-soft);border-radius:10px;background:rgba(255,255,255,.03)}
.co-hanja-head{margin:0 0 8px;font-size:13px;color:var(--nb-ink-3);line-height:1.6}
.co-hanja-grid{display:flex;flex-wrap:wrap;gap:7px}
.co-hanja-btn{display:flex;flex-direction:column;align-items:center;gap:1px;min-width:76px;padding:7px 8px;
  border:1px solid var(--nb-line-soft);border-radius:9px;background:rgba(255,255,255,.04);color:var(--nb-ink);cursor:pointer}
.co-hanja-btn .co-hanja-ja{font-size:22px;line-height:1.1;font-family:var(--nb-serif,serif)}
.co-hanja-btn .co-hanja-sub{font-size:13px;color:var(--nb-ink-3)}
.co-hanja-btn.on{border-color:#d4af37;background:rgba(212,175,55,.22);box-shadow:0 0 0 2px rgba(212,175,55,.45)}
.co-hanja-btn.on .co-hanja-ja{color:#f0d77a}
.co-hanja-btn.on .co-hanja-sub::after{content:' ✓';color:#d4af37}
.co-shape .co-shape-pick{color:#f0d77a;font-weight:600}
.co-shape .co-shape-name.dim{opacity:.75;font-size:17px}
.co-shape .co-shape-or{font-size:12px;color:var(--nb-ink-3)}
.co-hanja-btn.off{opacity:.38}
.co-hanja-note{margin:8px 0 0;font-size:12px;color:var(--nb-ink-3);line-height:1.6}
.co-shape{margin:8px 0 0;font-size:13px;color:var(--nb-ink-2);line-height:1.8}
.co-shape .co-shape-name{font-size:19px;letter-spacing:2px}
.co-shape .co-shape-name b{color:#d4af37}
.co-shape .co-shape-note{font-size:12px;color:var(--nb-ink-3)}

.co-opt-block summary{font-size:14px;color:#d4af37;cursor:pointer;font-weight:600;outline:none}
.co-opt-content{margin-top:10px}
.co-note{background:rgba(12,10,18,.6);border:1px solid rgba(255,255,255,.1);
  border-radius:10px;padding:13px 14px;margin:18px 0 14px}
.co-note p{margin:0 0 7px;font-size:14px;color:#bdb6c8;line-height:1.85}
.co-note p:last-child{margin-bottom:0}
.co-agree{display:flex;gap:9px;align-items:flex-start;margin:0 0 16px;cursor:pointer}
.co-agree input{width:19px;height:19px;flex:0 0 auto;margin:1px 0 0;accent-color:#d4af37}
.co-agree span{font-size:14px;color:#e4dfea;line-height:1.6}
.co-pay{display:block;width:100%;padding:16px;font-size:17px;font-weight:800;
  border:none;border-radius:10px;background:linear-gradient(135deg,#d4af37,#f0d478);
  color:#1a1208;cursor:pointer;font-family:inherit}
.co-pay:disabled{background:rgba(255,255,255,.12);color:#8b8496;cursor:not-allowed}
.co-msg{margin:14px 0 0;font-size:15px;line-height:1.85;color:#e8b4b4;min-height:1em}
.co-msg.ok{color:#9fd8a8}
.co-soon{background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.14);
  border-radius:10px;padding:16px;font-size:15px;color:#d8d3e0;line-height:1.85}
.co-done{background:rgba(12,10,18,.8);border:1px solid rgba(212,175,55,.3);
  border-radius:12px;padding:22px 20px;margin-top:20px;font-size:16px;line-height:1.9;color:#efeaf4}

/* 대기 카드 및 점 3개 애니메이션 */
.co-wait-card{background:rgba(18,14,24,.92);border:1.5px solid rgba(212,175,55,.4);
  border-radius:14px;padding:24px 20px;margin-top:16px;text-align:center;box-shadow:0 8px 32px rgba(0,0,0,.5)}
.co-wait-spinner{display:flex;justify-content:center;align-items:center;gap:8px;margin-bottom:18px}
.co-dot{width:10px;height:10px;border-radius:50%;background:#d4af37;opacity:.2;
  animation:coDotPulse 1.4s infinite ease-in-out both}
.co-dot:nth-child(1){animation-delay:-0.32s}
.co-dot:nth-child(2){animation-delay:-0.16s}
.co-dot:nth-child(3){animation-delay:0s}
@keyframes coDotPulse{
  0%,80%,100%{transform:scale(0.8);opacity:.2}
  40%{transform:scale(1.2);opacity:1;box-shadow:0 0 10px rgba(212,175,55,.6)}
}
.co-wait-title{font-size:18px;font-weight:700;color:#f3e5ab;margin:0 0 10px}
.co-wait-main{font-size:15.5px;color:#efeaf4;line-height:1.75;margin:0 0 14px}
.co-wait-main strong{color:#f3e5ab}
.co-wait-sub{font-size:14.5px;color:#d8d2e5;min-height:1.4em;margin:0 0 18px;font-weight:600}
.co-wait-safe{border-top:1px solid rgba(255,255,255,.1);padding-top:16px;margin-top:16px;text-align:left}
.co-wait-safe-txt{font-size:13.5px;color:#b9b2c6;margin:0 0 10px;line-height:1.6}
.co-wait-link-box{display:flex;gap:8px}
.co-wait-link-box input{flex:1 1 auto;background:rgba(0,0,0,.4);border:1px solid rgba(255,255,255,.15);border-radius:6px;padding:8px 12px;color:#fff;font-size:13px}
.co-wait-link-box button{flex:0 0 auto;background:#d4af37;color:#18151f;border:none;border-radius:6px;padding:8px 14px;font-size:13px;font-weight:700;cursor:pointer}

/* 상단 사주 정보 요약 카드 및 [고치기] */
.co-user-card{background:rgba(18,14,24,.85);border:1.5px solid rgba(212,175,55,.45);
  border-radius:12px;padding:16px 18px;margin-bottom:18px;box-shadow:0 4px 18px rgba(0,0,0,.4)}
.co-user-card-head{display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;
  padding-bottom:8px;border-bottom:1px solid rgba(255,255,255,.08)}
.co-user-card-title{font-size:14px;font-weight:700;color:#c8c2d4}
.co-user-edit-btn{background:none;border:none;color:#d4af37;font-size:13px;cursor:pointer;
  text-decoration:underline;padding:2px 4px;font-family:inherit}
.co-user-summary{line-height:1.7;font-size:15px;color:#efeaf4}
.co-user-line.name-gender{font-size:17px;font-weight:800;color:#f3e5ab;margin-bottom:3px}
.co-user-line.birth-time{color:#ddd}
.co-user-line.place{font-size:14px;color:#aaa}
.co-user-edit-form{background:rgba(10,8,14,.9);border:1px dashed rgba(212,175,55,.4);
  border-radius:10px;padding:14px;margin-bottom:18px}
.co-user-done-btn{display:block;width:100%;margin-top:10px;padding:10px;
  background:rgba(212,175,55,.2);border:1px solid #d4af37;border-radius:6px;
  color:#f3e5ab;font-size:14px;font-weight:700;cursor:pointer;font-family:inherit}
.co-pay-block-reason{color:#f97316;font-size:14px;margin:0 0 12px;font-weight:600;text-align:center;line-height:1.5}
`;

/**
 * 값 밑에 붙는 한 줄.
 *
 * ## 취소선 정가를 쓰지 않는 이유
 *
 * 「39,900원 ~~25,900원~~ 35% 할인」은 **직전에 그 값으로 판 적이 있어야**
 * 쓸 수 있다. 새로 낸 상품은 판 적이 없으므로 그건 지어낸 정가이고,
 * 표시광고법상 거짓·과장광고다.
 *
 * 대신 **앞으로 올릴 값을 미리 밝힌다.** 이건 지어낸 과거가 아니라 약속한
 * 미래라 적어도 된다. 다만 약속이므로 **연휴가 끝나면 실제로 올려야 한다.**
 * 안 올리면 그 순간 거짓말이 된다.
 */
function priceNote(product: Product): string {
  if (isLaunchSale() && product.regularKrw && product.regularKrw !== product.priceKrw) {
    return `<p class="co-pricenote">서버 오픈 기념가입니다. 11월 1일부터 <b>${product.regularKrw.toLocaleString('ko-KR')}원</b>으로 올라갑니다.</p>`;
  }
  if ((product as any).isPackage || (product.id in PACKAGES)) {
    return `<p class="co-pricenote">묶음 가격 옆의 「따로 사면」은 <strong>구성 상품을 실제로 낱개 판매하는 가격의 합계</strong>입니다.
    판매한 적 없는 정가를 지어내 할인율을 부풀리지 않습니다.</p>`;
  }
  return '';
}

export interface CheckoutKeys { storeId: string; channelKey: string }

/**
 * @param product 살 상품. 값과 이름은 여기서만 온다
 * @param keys 결제사 열쇠. 결제가 아직 안 켜졌으면 `null`
 */
export function renderCheckoutPage(
  info: BusinessInfo, footer: string, product: Product, keys: CheckoutKeys | null,
  mailEnabled = false, embedded = false,
): string {
  const site = show(info, 'serviceName', '서비스 이름');
  const price = product.priceKrw.toLocaleString('ko-KR');

  const PHOTO_PRODUCTS = new Set(['cross-report', 'face-palm-report', 'saju-palm-report', 'saju-face-report']);
  const isPhotoProduct = PHOTO_PRODUCTS.has(product.id);
  const needsFace = product.id === 'cross-report' || product.id === 'face-palm-report' || product.id === 'saju-face-report';
  const needsPalm = product.id === 'cross-report' || product.id === 'face-palm-report' || product.id === 'saju-palm-report';

  const partner = product.needsPartner ? `
    <p class="co-sec">상대의 생년월일</p>
    <div class="co-f"><label for="partnerDate">상대 생년월일</label>
      <input type="date" name="partnerDate" id="partnerDate" required></div>
    <div class="co-f"><label for="partnerTime">상대가 태어난 시간</label>
      ${hourOptions('partnerTime')}</div>` : '';

  const range = product.needsRange ? `
    <p class="co-sec">언제부터 언제 사이에서 고를까요?</p>
    <div class="co-two">
      <div class="co-f"><label for="rangeFrom">시작 날짜</label>
        <input type="date" name="rangeFrom" id="rangeFrom" required></div>
      <div class="co-f"><label for="rangeTo">끝 날짜</label>
        <input type="date" name="rangeTo" id="rangeTo" required></div>
    </div>
    <div class="co-f"><label for="rangeAvoid">피하고 싶은 날이 있으면 적어 주세요</label>
      <input type="text" name="rangeAvoid" id="rangeAvoid" placeholder="예: 2026-10-05, 2026-10-15 (선택)">
      <span class="co-hint">없으시면 비워 두셔도 됩니다</span></div>` : '';

  /*
   * 한 상에 앉는 사람들.
   *
   * 넷까지는 값이 같다. 다섯째부터 한 명당 더 붙는다 — 그 말을 **칸 바로 위에**
   * 적는다. 다 적고 나서 값이 올라 있으면 손님은 속았다고 느낀다.
   */
  const family = product.needsFamily ? `
    <p class="co-sec">한 상에 앉는 사람</p>
    <div class="co-note"><p>본인을 포함해 <b>${HOLIDAY_INCLUDED_MEMBERS}명까지 같은 값</b>입니다.
    ${HOLIDAY_INCLUDED_MEMBERS + 1}번째 분부터 한 분당 ${HOLIDAY_EXTRA_MEMBER_KRW.toLocaleString('ko-KR')}원이 더 붙습니다.
    최대 ${HOLIDAY_MAX_MEMBERS}명까지 넣으실 수 있습니다.</p></div>
    <div id="coFamily"></div>
    <button type="button" class="co-addkin" id="coAddKin">+ 한 분 더 넣기</button>` : '';

  const surname = product.needsName ? `
    <div class="co-f"><label for="surname">아이의 성 (예: 김)</label>
      <input type="text" name="surname" id="surname" maxlength="4" required></div>
    <div class="co-note" style="margin:4px 0 12px;padding:9px 12px;">
      <p style="margin:0;font-size:13px;color:#c8bfd6;line-height:1.7;">
        ${product.id === 'naming-plus-report'
          ? `이 상품은 고르는 글자밭이 <b>${NAMING_FIELD_RATIO}배</b>로 넓고, 대법원 출생신고 통계를 대조해 <b>최근 ${NAMING_POPULAR_TOP_RANK}위 안의 흔한 이름을 피해서</b> 짓습니다.`
          : '대법원 출생신고 통계를 대조해 흔한 이름인지까지는 보지 않습니다.'}
      </p>
    </div>
    <details class="co-opt-block" id="coFixedDetails">
      <summary>꼭 넣고 싶은 글자가 있으십니까?</summary>
      <div class="co-opt-content">
        <div class="co-f">
          <label for="fixedChar">꼭 넣을 글자 (한 글자)</label>
          <input type="text" name="fixedChar" id="fixedChar" maxlength="1" placeholder="한글로 적으셔도 되고 한자로 적으셔도 됩니다">
          <span class="co-hint">형·누나와 같은 글자를 쓰실 때 적습니다. 한글로 적으시면 그 소리로 쓸 수 있는 한자를 보여 드립니다.</span>
        </div>
        <div class="co-hanja-pick" id="coHanjaPick" style="display:none">
          <p class="co-hanja-head" id="coHanjaHead"></p>
          <div class="co-hanja-grid" id="coHanjaGrid"></div>
          <p class="co-hanja-note">글자를 누르면 그 한자로 지어 드립니다. 고르지 않으시면 저희가 아이 사주에 맞는 것으로 고릅니다.</p>
        </div>
        <div class="co-f">
          <label for="fixedAt">그 글자를 어디에 넣을까요?</label>
          <select name="fixedAt" id="fixedAt">
            <option value="" selected>— 고르지 않음 —</option>
            <option value="앞">먼저 (성 바로 뒤)</option>
            <option value="뒤">나중 (이름 끝)</option>
          </select>
          <p class="co-shape" id="coFixedShape" style="display:none"></p>
        </div>
      </div>
    </details>
    <details class="co-opt-block" id="coAvoidDetails">
      <summary>쓰고 싶지 않은 글자가 있으십니까?</summary>
      <div class="co-opt-content">
        <div class="co-f">
          <label for="avoidChars">피하고 싶은 글자</label>
          <input type="text" name="avoidChars" id="avoidChars" placeholder="예: 철, 영, 수">
          <span class="co-hint">집안 어른 이름자처럼 피해야 할 글자가 있으면 적어 주십시오</span>
        </div>
      </div>
    </details>` : '';

  /*
   * 얼굴·손은 **첫 화면에서 잰 값**을 가져다 쓴다.
   *
   * 터진 뒤에 적은 것 (2026-10-02): 여기에도 사진 올리는 칸이 있었는데,
   * 그 칸은 사진을 받아 보여만 주고 **아무것도 재지 않았다.** 값은 전부
   * 「보통」으로 채워져서, 어떤 사진을 올려도 리포트가 똑같이 나왔다.
   * 사진을 본다고 해 놓고 안 보는 것은 손님을 속이는 것이다.
   *
   * 첫 화면(/#panelF, /#panelP)은 실제로 재고, 못 재는 것은 못 잰다고 밝히고
   * 손님이 직접 고르게 한다. 그 값만 쓴다.
   */
  /*
   * 결제 화면은 얼굴·손을 **묻지 않는다.**
   *
   * 터진 뒤에 적은 것 (2026-10-03): 여기서 사진을 받고 있었다. 손님은 값을
   * 치르기로 마음먹은 뒤에야 사진을 요구받았고, 그나마 그 칸은 아무것도 재지
   * 않았다. 그 뒤에는 「재러 가기」로 내보냈는데 문 앞에 세워 두기만 했다.
   *
   * **보여 주는 것이 먼저고 값은 나중이다.** 사진은 상품 상세페이지에서 받아
   * 거기서 잰다. 여기서는 그 값을 조용히 가져다 쓰기만 하고, 사진 이야기를
   * 한 글자도 꺼내지 않는다.
   */
  const childSection = product.needsChild ? `
    <div class="co-child-card" id="coChildCard" style="margin:16px 0;padding:16px;background:rgba(255,255,255,0.03);border:1px solid rgba(212,175,55,0.25);border-radius:12px;">
      <p class="co-sec" style="margin-top:0;color:#ffdd88;font-size:16px;font-weight:700;">아이 사주</p>
      <div class="co-note" style="margin:4px 0 14px;padding:9px 12px;background:rgba(212,175,55,0.08);border-radius:8px;">
        <p style="margin:0;font-size:13px;color:#c8bfd6;line-height:1.7;">
          어른의 사주가 아니라 <b>아이의 명식으로</b> 풀이를 적습니다.
        </p>
      </div>
      <div class="co-f">
        <label for="childName">아이 이름 또는 태명</label>
        <input type="text" name="childName" id="childName" maxlength="10" placeholder="예: 도윤, 튼튼이 (선택)">
      </div>
      <div class="co-f" style="margin-bottom:10px;">
        <label class="co-time-unknown" for="childIsDueDate" style="font-size:14px;color:#ffdd88;display:inline-flex;align-items:center;gap:6px;cursor:pointer;">
          <input type="checkbox" id="childIsDueDate" name="childIsDueDate"> 아직 태어나지 않았습니다 — 예정일로 봅니다
        </label>
      </div>
      <div class="co-two">
        <div class="co-f">
          <label for="childDate" id="childDateLabel">아이 생년월일</label>
          <input type="date" name="childDate" id="childDate" required>
        </div>
        <div class="co-f">
          <label for="childGender">아이 성별</label>
          <select name="childGender" id="childGender" required>
            <option value="" selected>— 고르지 않음 —</option>
            <option value="남">남아</option>
            <option value="여">여아</option>
          </select>
          <span class="co-hint">대운이 가는 방향이 달라져서 여쭙습니다</span>
        </div>
      </div>
      <div class="co-f">
        <label for="childTime">태어난 시간 (시:분 직접 입력)</label>
        <div class="co-time-row">
          <input type="text" name="childTime" id="childTime" placeholder="예: 14:40 또는 1440" maxlength="5" autocomplete="off" inputmode="numeric">
          <button type="button" class="co-btn-unknown" id="childBtnUnknown">시간을 모릅니다</button>
        </div>
        <div id="childTimeSlotWrap" style="display:none;margin-top:8px;">
          <label for="childTimeSlot" style="font-size:13px;color:#c8c2d4;margin-bottom:4px;display:block;">대략적인 시간대 선택 (해당 시간의 한가운데로 봅니다)</label>
          ${hourOptions('childTimeSlot')}
        </div>
      </div>
      <div class="co-f">
        <label for="childPlace">태어난 곳</label>
        ${placeOptions('childPlace')}
        <span class="co-hint">태어난 곳에 따라 시(時)가 갈릴 수 있어 여쭙습니다</span>
      </div>
    </div>` : '';

  const photoSection = '';

  const form = keys === null ? `
    <div class="co-soon"><b>결제 준비 중입니다.</b><br>
    사주 명식·궁합·관상·손금 풀이는 지금도 값 없이 보실 수 있습니다.</div>` : `
    <form id="coForm" novalidate>
      <div id="coFields">

      ${embedded ? '' : `<!-- 1. 사주 정보 요약 카드 (맨 위 노출) -->
      <div class="co-user-card" id="coUserCard">
        <div class="co-user-card-head">
          <span class="co-user-card-title">${product.needsChild ? '손님(부모) 사주' : '사주 정보'}</span>
          <button type="button" class="co-user-edit-btn" id="coEditUserBtn">[고치기]</button>
        </div>
        <div class="co-user-summary" id="coUserSummary">
          <div class="co-user-line name-gender">
            <strong id="dispName">-</strong> · <span id="dispGender">-</span>
          </div>
          <div class="co-user-line birth-time">
            <span id="dispDate">-</span> <span id="dispTime">-</span>
          </div>
          <div class="co-user-line place">
            <span id="dispPlace">서울</span>에서 태어남
          </div>
        </div>
      </div>

      <!-- 1-B. 사주 정보 입력·수정 폼 (기본 숨김, 고치기 누르거나 비어 있는 칸이 있을 때만 노출) -->
      <div class="co-user-edit-form" id="coUserEditForm" style="display:none;">
        <p class="co-sec">${product.needsChild ? '손님(부모) 사주 수정' : '사주 정보 수정'}</p>
        <div class="co-f"><label for="buyerName">성함</label>
          <input type="text" name="buyerName" id="buyerName" autocomplete="name" required placeholder="성함"></div>
        <div class="co-two">
          <div class="co-f"><label for="birthDate">생년월일</label>
            <input type="date" name="birthDate" id="birthDate" required></div>
          <div class="co-f"><label for="gender">성별</label>
            <select name="gender" id="gender"><option value="남">남</option><option value="여">여</option></select></div>
        </div>
        <div class="co-f">
          <label for="birthTime">태어난 시간 (시:분 직접 입력)</label>
          <div class="co-time-row">
            <input type="text" name="birthTime" id="birthTime" placeholder="예: 14:40 또는 1440" maxlength="5" autocomplete="off" inputmode="numeric">
            <button type="button" class="co-btn-unknown" id="birthBtnUnknown">시간을 모릅니다</button>
            <input type="checkbox" id="birthTimeUnknown" style="display:none;" aria-hidden="true">
          </div>
          <div id="birthTimeSlotWrap" style="display:none;margin-top:8px;">
            <label for="birthTimeSlot" style="font-size:13px;color:#c8c2d4;margin-bottom:4px;display:block;">대략적인 시간대 선택 (해당 시간의 한가운데로 봅니다)</label>
            ${hourOptions('birthTimeSlot')}
          </div>
        </div>
        <div class="co-f"><label for="birthPlace">태어난 곳</label>${placeOptions('birthPlace')}
          <span class="co-hint">태어난 곳에 따라 시(時)가 갈릴 수 있어 여쭙습니다</span></div>
        <button type="button" class="co-user-done-btn" id="coUserDoneBtn">입력 완료</button>
      </div>`}

      ${childSection}
      ${embedded ? '' : `<div class="co-reading-fields">
      ${surname}
      ${partner}
      ${range}
      ${family}
      ${photoSection}
      </div>`}

      <p class="co-sec">연락받으실 곳</p>
      <div class="co-f"><label for="email">이메일</label>
        <input type="email" name="email" id="email" autocomplete="email" placeholder="example@email.com" required>
        <span class="co-hint">${mailEnabled ? '리포트 주소를 보내 드릴 주소입니다' : '주문 확인과 문의 응대에 씁니다'}</span></div>
      <div class="co-f"><label for="phone">휴대전화</label>
        <input type="tel" name="phone" id="phone" autocomplete="tel" placeholder="01012345678" required>
        <span class="co-hint">결제 확인 및 안내에 필요합니다</span></div>

      <div class="co-note">
        <p>이 상품은 디지털콘텐츠입니다. 결제하시면 <b>이 화면에서 바로</b> 보실 수 있고,
        늦어도 ${DELIVERY_DUE_DAYS}일 이내에 드립니다.
        결제가 끝나면 <b>다시 볼 수 있는 주소</b>를 함께 드립니다 — 그 주소를 저장해 두시면
        언제든 다시 보실 수 있습니다.${mailEnabled ? ' 결제하시면 그 주소를, 리포트를 여시면 <b>글 전문</b>을 이메일로 보내 드립니다.' : ''}</p>
        <p>결제 후 ${WITHDRAWAL_WINDOW_DAYS}일 이내이고 리포트를 열람하지 않으셨다면
        전액 돌려드립니다. <b>리포트 전문을 열람하신 뒤에는 청약철회가 제한됩니다.</b></p>
        <p>이름·생년월일은 리포트를 만드는 데에만 쓰고, 이메일·휴대전화는
        주문 확인과 문의 응대에만 씁니다.</p>
      </div>

      <label class="co-agree">
        <input type="checkbox" id="coAgree">
        <span><b>[필수]</b> 위 안내를 읽었고, 리포트 전문을 열람하면 청약철회가 제한된다는 점에 동의합니다.</span>
      </label>
      <label class="co-agree optional">
        <input type="checkbox" id="coAgreeMarketing">
        <span><b>[선택]</b> 할인 혜택 및 절기 운세 알림을 이메일·문자로 받는 것에 동의합니다.</span>
      </label>

      <p class="co-pay-block-reason" id="coPayBlockReason" style="display:none;color:#f97316;font-size:14px;margin:0 0 12px;font-weight:600;text-align:center;line-height:1.5;"></p>
      <button type="submit" class="co-pay" id="coPay" disabled>${price}원 결제하기</button>
      </div>
      <p class="co-msg" id="coMsg"></p>
      <div id="coDone"></div>
      <div id="coRetry" style="display:none;margin-top:16px">
        <a class="co-pay" href="/checkout?product=${encodeURIComponent(product.id)}" style="display:block;text-align:center;text-decoration:none;line-height:48px;">다시 결제하기</a>
      </div>
    </form>`;

  const script = keys === null ? '' : `
<script src="https://cdn.portone.io/v2/browser-sdk.js"></script>
<script>
(function(){
  var PRODUCT = ${JSON.stringify(product.id)};
  var EMBEDDED = ${embedded};
  var NEEDS_PICK = ${product.needsPick === true};
  var BASE_KRW = ${product.priceKrw};
  var FREE_UPTO = ${HOLIDAY_INCLUDED_MEMBERS};
  var EXTRA_KRW = ${HOLIDAY_EXTRA_MEMBER_KRW};
  var MAX_MEMBERS = ${HOLIDAY_MAX_MEMBERS};
  var NEEDS_FAMILY = ${product.needsFamily === true};
  var NEEDS_CHILD = ${product.needsChild === true};
  var NEEDS_NAME = ${product.needsName === true};
  var NEEDS_FACE = ${needsFace ? 'true' : 'false'};
  var NEEDS_PALM = ${needsPalm ? 'true' : 'false'};
  var IS_PHOTO = ${isPhotoProduct ? 'true' : 'false'};
  /* 값이 없으면 상세페이지로 보낸다 */
  if (IS_PHOTO) {
    try {
      var s = JSON.parse(sessionStorage.getItem('nb_reading') || '{}') || {};
      var b = s.보여줌 || {};
      var hasFace = !NEEDS_FACE || Boolean(s.face || b.face);
      var hasPalm = !NEEDS_PALM || Boolean(s.palm || b.palm);
      if (!hasFace || !hasPalm) {
        var target = '/products/' + encodeURIComponent(PRODUCT) + (location.search || '');
        if (window.history && window.history.replaceState) {
          try { history.replaceState(null, '', target); } catch(e){}
        }
        location.replace(target);
        return;
      }
    } catch(e) {
      location.replace('/products/' + encodeURIComponent(PRODUCT) + (location.search || ''));
      return;
    }
  }
  var HOUR_OPTIONS = ${JSON.stringify(HOURS)};
  var KEYS = ${JSON.stringify(keys)};
  var f = document.getElementById('coForm');
  var pay = document.getElementById('coPay');
  var agree = document.getElementById('coAgree');
  var agreeMarketing = document.getElementById('coAgreeMarketing');
  var msg = document.getElementById('coMsg');
  var done = document.getElementById('coDone');
  /*
   * 입력칸 틀.
   *
   * 터진 뒤에 적은 것 (2026-10-02): 결과·기다림 카드가 들어가는 #coDone 이
   * <form id="coForm"> **안에** 있다. 그래서 결제 뒤에 form 을 숨기면 카드까지
   * 같이 사라져, 손님은 아무것도 없는 화면을 봤다. 0원 주문에서 결과가 안
   * 나온다는 신고가 이것이었다. **숨길 것은 form 이 아니라 입력칸뿐이다.**
   */
  var fieldsBox = document.getElementById('coFields');
  function 입력칸을숨긴다(){
    if(fieldsBox) fieldsBox.style.display = 'none';
  }
  if(!f) return;

  function say(t, ok){
    if(msg){
      msg.textContent = t;
      msg.className = 'co-msg' + (ok ? ' ok' : '');
    }
  }
  function val(id){
    var el = document.getElementById(id);
    if(el) return el.value.trim();
    if(!EMBEDDED) return '';
    var saved = loadReading() || {};
    var birth = saved.birth || saved;
    var fields = {
      buyerName: birth.name, birthDate: birth.date, birthTime: birth.time,
      birthPlace: birth.place, gender: birth.gender,
      surname: saved.name && saved.name.surname,
      fixedChar: saved.name && saved.name.fixed && saved.name.fixed.char,
      fixedAt: saved.name && saved.name.fixed && saved.name.fixed.at,
      avoidChars: saved.name && saved.name.avoid && saved.name.avoid.join(', '),
      partnerDate: saved.partner && saved.partner.date,
      partnerTime: saved.partner && saved.partner.time,
      rangeFrom: saved.range && saved.range.from,
      rangeTo: saved.range && saved.range.to,
      rangeAvoid: saved.range && saved.range.avoid && saved.range.avoid.join(', '),
    };
    return String(fields[id] || '').trim();
  }
  async function post(url, body){
    var r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body)
    });
    var j = await r.json().catch(function(){ return {}; });
    if(!r.ok) throw new Error(j.error || ('요청이 실패했습니다 (' + r.status + ')'));
    return j;
  }

  /* sessionStorage nb_reading 입출력 단일화 */
  function loadReading(){
    try { return JSON.parse(sessionStorage.getItem('nb_reading') || 'null'); } catch(e){ return null; }
  }
  function saveReading(data){
    try {
      var cur = loadReading() || {};
      var merged = Object.assign({}, cur, data);
      sessionStorage.setItem('nb_reading', JSON.stringify(merged));
    } catch(e){}
  }

  function formatKoreanDate(dStr){
    if(!dStr) return '';
    var p = dStr.split('-');
    if(p.length === 3) return p[0] + '년 ' + parseInt(p[1], 10) + '월 ' + parseInt(p[2], 10) + '일';
    return dStr;
  }

  function hourToKorean(hStr, isUnk){
    if(isUnk || !hStr || hStr === '12:00') return '시간 모름 (낮 12시로 계산)';
    for(var i=0; i<HOUR_OPTIONS.length; i++){
      if(HOUR_OPTIONS[i][0] === hStr){
        return HOUR_OPTIONS[i][1].split('—')[0].trim();
      }
    }
    return hStr;
  }

  function parseTimeInput(val){
    if(!val) return null;
    var trimmed = val.trim();
    var m = /^(\d{1,2}):?(\d{2})$/.exec(trimmed);
    if(!m) return null;
    var h = parseInt(m[1], 10);
    var min = parseInt(m[2], 10);
    if(h >= 0 && h <= 23 && min >= 0 && min <= 59){
      var hh = (h < 10 ? '0' : '') + h;
      var mm = (min < 10 ? '0' : '') + min;
      return hh + ':' + mm;
    }
    return null;
  }

  function updateSummaryDisplay(){
    var name = val('buyerName');
    var date = val('birthDate');
    var gender = val('gender') || '남';
    var unkEl = document.getElementById('birthTimeUnknown');
    var isUnk = Boolean(window.__birthTimeUnknown || (unkEl && unkEl.checked));
    var rawT = val('birthTime');
    var parsedT = parseTimeInput(rawT);
    var time = isUnk ? (val('birthTimeSlot') || '12:00') : (parsedT || rawT || '12:00');
    var place = val('birthPlace') || '서울';

    var dName = document.getElementById('dispName');
    var dGender = document.getElementById('dispGender');
    var dDate = document.getElementById('dispDate');
    var dTime = document.getElementById('dispTime');
    var dPlace = document.getElementById('dispPlace');

    if(dName) dName.textContent = name || '(성함 없음)';
    if(dGender) dGender.textContent = gender;
    if(dDate) dDate.textContent = formatKoreanDate(date) || '(생년월일 미입력)';
    if(dTime) dTime.textContent = hourToKorean(time, isUnk);
    if(dPlace) dPlace.textContent = place;

    var editForm = document.getElementById('coUserEditForm');
    if(editForm && !date){
      editForm.style.display = 'block';
    }
  }

  var faceUploaded = false;
  var palmUploaded = false;

  function checkCanPay(){
    var reason = '';
    var dateVal = val('birthDate');
    // 사진은 여기서 묻지 않는다. 막지도 않는다
    if(!NEEDS_PICK && !dateVal && document.getElementById('birthDate')){
      reason = EMBEDDED ? '상품 화면에서 생년월일을 먼저 적어 주십시오' : '생년월일을 적으셔야 결제하실 수 있습니다';
    } else if(NEEDS_CHILD && !val('childDate') && document.getElementById('childDate')){
      reason = '아이의 생년월일(또는 예정일)을 적으셔야 결제하실 수 있습니다';
    } else if(NEEDS_CHILD && !val('childGender') && document.getElementById('childGender')){
      reason = '아이가 아들인지 딸인지 골라 주십시오';
    }
    if(!reason && NEEDS_NAME){
      var fChar = (typeof 고른한자 !== 'undefined' ? 고른한자 : '') || val('fixedChar');
      if(fChar && !val('fixedAt')){
        reason = '꼭 넣을 글자를 어디에 넣을지 골라 주십시오';
      }
    }
    if(!reason && !agree.checked){
      reason = '위 안내에 동의하셔야 결제하실 수 있습니다';
    }

    var reasonEl = document.getElementById('coPayBlockReason');
    if(reasonEl){
      if(reason){
        reasonEl.textContent = reason;
        reasonEl.style.display = 'block';
      } else {
        reasonEl.textContent = '';
        reasonEl.style.display = 'none';
      }
    }

    pay.disabled = Boolean(reason);

  }

  agree.addEventListener('change', checkCanPay);


  /* invite tracking */
  try{
    var mi = location.search.match(/[?&]invite=([a-zA-Z0-9]+)/);
    if(mi && mi[1]){
      sessionStorage.setItem('nb_invite', mi[1].toLowerCase().slice(0, 12));
      var cleanInv = location.href.replace(/([?&])invite=[^&#]*(&|$)/, function(_, a, b){ return b ? a : ''; })
        .replace(/[?&]$/, '');
      history.replaceState(null, '', cleanInv);
    }
  }catch(e){}

  /*
   * 주인 통과 — 주소에 얹어 온 암호를 이 탭에만 담아 두고 주소창에서는 지운다.
   * 주소창에 남아 있으면 화면을 한 번만 찍혀도 남이 그대로 쓴다.
   * 화면이 뜰 때 /api/pass/check 로 확인하고, 맞을 때만 담고 0원으로 적는다.
   */
  var candidatePass = '';
  try{
    var mp = location.search.match(/[?&]pass=([^&#]+)/);
    if(mp && mp[1]){
      candidatePass = decodeURIComponent(mp[1]).slice(0, 128);
      var clean = location.href.replace(/([?&])pass=[^&#]*(&|$)/, function(_, a, b){ return b ? a : ''; })
        .replace(/[?&]$/, '');
      history.replaceState(null, '', clean);
    }
  }catch(e){}
  if(!candidatePass){
    try { candidatePass = sessionStorage.getItem('nb_pass') || ''; } catch(e){}
  }

  var passValid = false;
  var currentDisplayedAmount = ${product.priceKrw};

  if(candidatePass){
    post('/api/pass/check', { pass: candidatePass })
      .then(function(res){
        if(res && res.ok === true){
          passValid = true;
          try { sessionStorage.setItem('nb_pass', candidatePass); } catch(e){}
        }else{
          passValid = false;
          try { sessionStorage.removeItem('nb_pass'); } catch(e){}
        }
        refreshPrice();
      })
      .catch(function(){
        passValid = false;
        try { sessionStorage.removeItem('nb_pass'); } catch(e){}
        refreshPrice();
      });
  }

  /* ref tracking */
  try{
    var m = location.search.match(/[?&]ref=([a-zA-Z0-9_-]+)/);
    if(m && m[1] && !sessionStorage.getItem('nb_ref')){
      sessionStorage.setItem('nb_ref', m[1].toLowerCase().slice(0, 20));
    }
  }catch(e){}

  function escHtml(s){
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function formatInline(str){
    return str.replace(/\\*\\*(.+?)\\*\\*/g, '<strong>$1</strong>');
  }

  function parseReportMarkdown(rawText){
    if(!rawText) return '';
    // 1. 반드시 먼저 & < > 를 막는다 (XSS 원천 차단)
    var escaped = escHtml(rawText);
    var lines = escaped.split(/\\r?\\n/);
    var out = [];
    var inList = false;
    var inTable = false;
    var tableRows = [];

    function closeList(){
      if(inList){ out.push('</ul>'); inList = false; }
    }
    function closeTable(){
      if(inTable && tableRows.length > 0){
        var tHtml = '<table class="rp-table"><tbody>';
        for(var r=0; r<tableRows.length; r++){
          var row = tableRows[r];
          var isSep = true;
          for(var c=0; c<row.length; c++){
            if(!/^[-:\\s]+$/.test(row[c])){ isSep = false; break; }
          }
          if(isSep) continue;
          var tag = (r === 0) ? 'th' : 'td';
          tHtml += '<tr>' + row.map(function(col){ return '<' + tag + '>' + formatInline(col) + '</' + tag + '>'; }).join('') + '</tr>';
        }
        tHtml += '</tbody></table>';
        out.push(tHtml);
        inTable = false;
        tableRows = [];
      }
    }

    for(var i=0; i<lines.length; i++){
      var line = lines[i].trim();
      if(!line){
        closeList(); closeTable(); continue;
      }
      if(/^---[-]*$/.test(line)){
        closeList(); closeTable();
        out.push('<hr class="rp-rule">');
        continue;
      }
      if(line.charAt(0) === '|' && line.charAt(line.length - 1) === '|'){
        closeList();
        if(!inTable){ inTable = true; tableRows = []; }
        var cols = line.slice(1, -1).split('|').map(function(c){ return c.trim(); });
        tableRows.push(cols);
        continue;
      } else {
        closeTable();
      }

      if(line.indexOf('# ') === 0){
        closeList(); out.push('<h2 class="rp-h1">' + formatInline(line.slice(2)) + '</h2>'); continue;
      }
      if(line.indexOf('## ') === 0){
        closeList(); out.push('<h3 class="rp-h2">' + formatInline(line.slice(3)) + '</h3>'); continue;
      }
      if(line.indexOf('### ') === 0){
        closeList(); out.push('<h4 class="rp-h3">' + formatInline(line.slice(4)) + '</h4>'); continue;
      }
      if(line.indexOf('&gt;') === 0 || line.indexOf('>') === 0){
        closeList();
        var quoteContent = line.replace(/^(&gt;|>)\\s*/, '');
        var isExpert = quoteContent.indexOf('전문 ·') === 0 || quoteContent.indexOf('전문·') === 0;
        var cls = isExpert ? 'rp-quote rp-quote-expert' : 'rp-quote';
        out.push('<blockquote class="' + cls + '">' + formatInline(quoteContent) + '</blockquote>');
        continue;
      }
      if(line.indexOf('- ') === 0){
        if(!inList){ inList = true; out.push('<ul class="rp-list">'); }
        out.push('<li>' + formatInline(line.slice(2)) + '</li>');
        continue;
      } else {
        closeList();
      }
      if(line.indexOf('근거 ·') === 0 || line.indexOf('근거·') === 0){
        out.push('<p class="rp-evidence">' + formatInline(line) + '</p>');
        continue;
      }
      if(line.indexOf('쉽게 말하면') === 0){
        out.push('<p class="rp-plain rp-plain-lead">' + formatInline(line) + '</p>');
        continue;
      }
      out.push('<p class="rp-p">' + formatInline(line) + '</p>');
    }
    closeList(); closeTable();
    return out.join('\\n');
  }

  var waitTimer = null;
  function showWaiting(oid){
    var link = location.origin + '/order/' + oid;
    var waitHtml = '<div class="co-wait-card" id="coWaitCard">' +
      '<div class="co-wait-spinner"><span class="co-dot"></span><span class="co-dot"></span><span class="co-dot"></span></div>' +
      '<h3 class="co-wait-title">신령이 손님의 여덟 글자를 하나씩 짚고 있습니다.</h3>' +
      '<p class="co-wait-main"><strong>1분에서 3분쯤</strong> 걸립니다. <strong>이 창을 닫지 마시고</strong> 잠시만 기다려 주십시오.</p>' +
      '<p class="co-wait-sub" id="coWaitProgress"></p>' +
      '<div class="co-wait-safe">' +
        '<p class="co-wait-safe-txt">창을 닫아도 리포트는 만들어지고, 저장해 둔 주소로 다시 볼 수 있습니다.</p>' +
        '<div class="co-wait-link-box">' +
          '<input type="text" readonly value="' + link + '" id="coWaitLinkInp">' +
          '<button type="button" id="coWaitCopyBtn">주소 복사</button>' +
        '</div>' +
        '<p class="co-copy-done" id="coWaitCopyDone" style="display:none">주소가 복사되었습니다.</p>' +
      '</div>' +
    '</div>';

    if(done){
      done.style.display = 'block';
      done.innerHTML = waitHtml;
    }
    입력칸을숨긴다();

    var wCopyBtn = document.getElementById('coWaitCopyBtn');
    var wCopyInp = document.getElementById('coWaitLinkInp');
    var wCopyDone = document.getElementById('coWaitCopyDone');
    if(wCopyBtn && wCopyInp){
      wCopyBtn.onclick = function(){
        try{
          if(navigator.clipboard && navigator.clipboard.writeText){
            navigator.clipboard.writeText(wCopyInp.value);
          }else{
            wCopyInp.select(); document.execCommand('copy');
          }
          if(wCopyDone) wCopyDone.style.display = 'block';
        }catch(e){}
      };
    }

    if(waitTimer) clearInterval(waitTimer);
    var start = Date.now();
    waitTimer = setInterval(function(){
      var elapsed = Math.floor((Date.now() - start) / 1000);
      var pEl = document.getElementById('coWaitProgress');
      if(!pEl) return;
      var msg = elapsed + '초 지남 · ';
      if(elapsed >= 90){
        msg += '글이 길어 조금 더 걸리고 있습니다. 창을 닫지 않으셔도 됩니다.';
      }else if(elapsed >= 30){
        msg += '거의 다 됐습니다. 조금만 더 기다려 주십시오.';
      }else{
        msg += '풀이를 정성껏 짓고 있습니다.';
      }
      pEl.textContent = msg;
    }, 1000);
  }

  /*
   * 풀이 짓기가 막혔을 때 보여 줄 카드.
   *
   * 터진 뒤에 적은 것 (2026-10-02): 서버는 풀이가 막히면 500과 사유를 돌려주는데
   * 화면은 200만 보고 있었다. 그래서 손님은 「1분에서 3분쯤 걸립니다」를 5분 동안
   * 보다가 시간 초과 카드를 받았다. 0원 주문에서 결과가 안 나온다는 신고가
   * 전부 이것이었다. **막혔으면 막혔다고 말해야 한다.**
   */
  function showStuck(oid, reason, retry){
    if(waitTimer) clearInterval(waitTimer);
    var link = location.origin + '/order/' + oid;
    var 주인인가 = (function(){ try { return !!sessionStorage.getItem('nb_pass'); } catch(e){ return false; } })();
    var html = '<div class="co-wait-card" id="coStuckCard">' +
      '<h3 class="co-wait-title">풀이를 짓다가 막혔습니다.</h3>' +
      '<p class="co-wait-main">주문과 결제는 그대로 남아 있습니다. 아래 <strong>다시 짓기</strong>를 눌러 주십시오.</p>' +
      '<div style="margin-top:18px;"><button type="button" class="od-btn" id="coStuckRetry">다시 짓기</button></div>' +
      '<div class="co-wait-safe" style="margin-top:20px;">' +
        '<p class="co-wait-safe-txt">이 주소를 저장해 두시면 나중에 다시 열어 보실 수 있습니다.</p>' +
        '<div class="co-wait-link-box">' +
          '<input type="text" readonly value="' + link + '" id="coStuckLinkInp">' +
          '<button type="button" id="coStuckCopyBtn">주소 복사</button>' +
        '</div>' +
        '<p class="co-copy-done" id="coStuckCopyDone" style="display:none">주소가 복사되었습니다.</p>' +
      '</div>' +
      (주인인가 && reason && String(reason).trim() ? '<p class="co-wait-sub" style="margin-top:16px;opacity:.75">주인에게만 보입니다 — ' + String(reason).replace(/</g, '&lt;').slice(0, 300) + '</p>' : '') +
    '</div>';
    if(done){
      done.style.display = 'block';
      done.innerHTML = html;
    }
    입력칸을숨긴다();
    say('풀이를 짓다가 막혔습니다. 다시 짓기를 눌러 주십시오.');
    var sRetry = document.getElementById('coStuckRetry');
    if(sRetry && retry){
      sRetry.onclick = function(){ sRetry.disabled = true; retry(); };
    }
    var sCopyBtn = document.getElementById('coStuckCopyBtn');
    var sCopyInp = document.getElementById('coStuckLinkInp');
    var sCopyDone = document.getElementById('coStuckCopyDone');
    if(sCopyBtn && sCopyInp){
      sCopyBtn.onclick = function(){
        try{
          if(navigator.clipboard && navigator.clipboard.writeText){
            navigator.clipboard.writeText(sCopyInp.value);
          }else{
            sCopyInp.select(); document.execCommand('copy');
          }
          if(sCopyDone) sCopyDone.style.display = 'block';
        }catch(e){}
      };
    }
  }

  async function waitForReport(oid, cf){
    showWaiting(oid);
    say('신령이 손님의 여덟 글자를 하나씩 짚고 있습니다. 1분에서 3분쯤 걸립니다. 이 창을 닫지 마시고 잠시만 기다려 주십시오.');
    var pollStart = Date.now();
    var maxWaitMs = 5 * 60 * 1000; // 5분
    var 막힌횟수 = 0;
    var 막힌사유 = '';
    while(Date.now() - pollStart < maxWaitMs){
      try{
        var r = await fetch('/api/orders/' + encodeURIComponent(oid) + '/report');
        if(r.status === 200){
          var report = await r.json();
          if(report && report.text){
            showReport(oid, report.text, (cf && cf.inviteCode) || (report.order && report.order.inviteCode), (cf && cf.upsell) || report.upsell);
            return;
          }
        }else if(r.status >= 500){
          // 서버가 「막혔다」고 답한 것이다. 세 번 막히면 그대로 말한다.
          막힌횟수 = 막힌횟수 + 1;
          try{
            var 막힘 = await r.json();
            if(막힘 && 막힘.error) 막힌사유 = String(막힘.error);
          }catch(e){}
          if(막힌횟수 >= 3){
            showStuck(oid, 막힌사유, function(){ waitForReport(oid, cf); });
            return;
          }
        }
      }catch(e){
        console.log('[풀이 대기 중 일시적 오류]', e);
      }
      await new Promise(function(resolve){ setTimeout(resolve, 3000); });
    }

    if(waitTimer) clearInterval(waitTimer);
    var link = location.origin + '/order/' + oid;
    var timeoutHtml = '<div class="co-wait-card" id="coTimeoutCard">' +
      '<h3 class="co-wait-title">풀이가 아직 지어지는 중입니다.</h3>' +
      '<p class="co-wait-main">이 주소를 저장해 두셨다가 잠시 뒤 다시 열어 보십시오 — 풀이는 계속 지어집니다.</p>' +
      '<div class="co-wait-safe" style="margin-top:20px;">' +
        '<p class="co-wait-safe-txt" style="font-size:16px;font-weight:bold;color:#f6d28b;">손님의 주문 주소</p>' +
        '<div class="co-wait-link-box" style="margin:12px 0;">' +
          '<input type="text" readonly value="' + link + '" id="coTimeoutLinkInp" style="font-size:15px;padding:10px;">' +
          '<button type="button" id="coTimeoutCopyBtn" style="padding:10px 16px;">주소 복사</button>' +
        '</div>' +
        '<p class="co-copy-done" id="coTimeoutCopyDone" style="display:none">주소가 복사되었습니다.</p>' +
        '<div style="margin-top:16px;"><a href="' + link + '" class="od-btn" style="display:inline-block;text-decoration:none;">주문 페이지 바로 가기</a></div>' +
      '</div>' +
    '</div>';
    if(done){
      done.style.display = 'block';
      done.innerHTML = timeoutHtml;
    }
    var tCopyBtn = document.getElementById('coTimeoutCopyBtn');
    var tCopyInp = document.getElementById('coTimeoutLinkInp');
    var tCopyDone = document.getElementById('coTimeoutCopyDone');
    if(tCopyBtn && tCopyInp){
      tCopyBtn.onclick = function(){
        try{
          if(navigator.clipboard && navigator.clipboard.writeText){
            navigator.clipboard.writeText(tCopyInp.value);
          }else{
            tCopyInp.select(); document.execCommand('copy');
          }
          if(tCopyDone) tCopyDone.style.display = 'block';
        }catch(e){}
      };
    }
  }

  function showReport(oid, reportText, inviteCode, upsellData){
    if(waitTimer) clearInterval(waitTimer);
    say('결제가 끝났습니다. 주문번호 ' + oid, true);
    var link = location.origin + '/order/' + oid;
    var parsedReportHtml = parseReportMarkdown(reportText || '');

    var upsellHtml = '';
    var upsellItems = (upsellData && upsellData.items && upsellData.items.length > 0)
      ? upsellData.items
      : (upsellData && upsellData.info && upsellData.info.nextProduct)
        ? [{ info: upsellData.info, reason: upsellData.reason, checkoutUrl: upsellData.checkoutUrl }]
        : [];

    if(upsellItems.length > 0){
      var firstInfo = upsellItems[0].info;
      var cardsHtml = upsellItems.map(function(item){
        var uInfo = item.info;
        var nextName = escHtml((uInfo.nextProduct && uInfo.nextProduct.name) || '다음 점사');
        var singlePriceStr = Number(uInfo.singlePriceKrw).toLocaleString('ko-KR');
        var currentPriceStr = Number(uInfo.currentPriceKrw).toLocaleString('ko-KR');
        var regPriceStr = Number(uInfo.regularUpgradeKrw).toLocaleString('ko-KR');
        // 적는 숫자는 실제 값에서 만든다 (내림). 손으로 적으면 실제와 어긋난다
        var 깎인비율 = uInfo.singlePriceKrw > 0
          ? Math.floor((1 - uInfo.currentPriceKrw / uInfo.singlePriceKrw) * 100) : 0;
        var discountText = 깎인비율 + '%<br>할인';
        var cUrl = escHtml(item.checkoutUrl || ('/checkout?product=' + encodeURIComponent(uInfo.nextProduct ? uInfo.nextProduct.id : '') + '&fromOrder=' + encodeURIComponent(oid)));
        var matchTag = uInfo.isMatched ? '<div class="od-upsell-match-tag">손님 물음에 맞춘 것</div>' : '';
        var reasonHtml = item.reason ? ('<p class="od-upsell-reason">' + escHtml(item.reason) + '</p>') : '';

        return '<div class="od-upsell-card" data-single="' + uInfo.singlePriceKrw + '" data-promo="' + uInfo.currentPriceKrw + '" data-reg="' + uInfo.regularUpgradeKrw + '">' +
          '<div class="od-upsell-circle-badge">' + discountText + '</div>' +
          matchTag +
          '<h3 class="od-upsell-card-title">' + nextName + '</h3>' +
          reasonHtml +
          '<div class="od-upsell-pricing">' +
            '<b class="od-upsell-price-gold">' + currentPriceStr + '원</b>' +
            '<span class="od-upsell-price-orig">원래 ' + singlePriceStr + '원</span>' +
          '</div>' +
          '<div class="od-upsell-actions">' +
            '<a class="od-upsell-btn" href="' + cUrl + '">' + nextName + ' 이어보기</a>' +
          '</div>' +
        '</div>';
      }).join('');

      upsellHtml = '<section class="od-upsell-box" id="coUpsellSection">' +
        '<div class="od-upsell-header">' +
          '<span class="od-upsell-badge">다음 이야기 이어보기 · 12시간 안에만 이 값입니다</span>' +
          '<span class="od-upsell-timer" id="coUpsellTimer" data-expires="' + escHtml(firstInfo.expiresAt || '') + '">남은 시간 ' + escHtml(firstInfo.remainingFormatted || '12:00:00') + '</span>' +
        '</div>' +
        '<div class="od-upsell-cards">' + cardsHtml + '</div>' +
        '<div style="margin-top:16px;text-align:center">' +
          '<button type="button" class="od-later-btn" id="coLaterBtn" onclick="var el=document.getElementById(&quot;coUpsellSection&quot;);if(el)el.style.display=&quot;none&quot;;">나중에 보기</button>' +
        '</div>' +
      '</section>';
    }

    var inviteHtml = inviteCode ? (
      '<div class="nb-invite-box">' +
        '<div class="nb-invite-head">벗에게 알려주게</div>' +
        '<div class="nb-invite-code">그대의 증표 — <b>' + inviteCode + '</b></div>' +
        '<div class="nb-invite-reward-box">' +
          '<div class="nb-invite-reward-main">벗은 <b>${INVITE_DISCOUNT_KRW.toLocaleString('ko-KR')}원</b> 할인 · 그대는 <b>${INVITE_REWARD_NAME}</b> 무료</div>' +
        '</div>' +
        '<p class="nb-invite-desc">이 증표로 들어온 벗은 <b>${INVITE_DISCOUNT_KRW.toLocaleString('ko-KR')}원</b>을 덜 낸다네.<br>벗이 첫 점사(${(INVITE_MIN_ORDER_KRW / 10000)}만원 이상)를 받으면, 그대에게 <b>${INVITE_REWARD_NAME}</b> 보답을 드린다네.</p>' +
        '<div class="nb-invite-actions">' +
          '<button type="button" class="nb-invite-btn" id="nbCopyInviteBtn" data-code="' + inviteCode + '">증표 복사하기</button>' +
          '<button type="button" class="nb-invite-btn kakao" id="nbKakaoInviteBtn" data-code="' + inviteCode + '">카톡으로 보내기</button>' +
          '<a href="/invite" class="nb-invite-btn status" id="nbStatusInviteBtn">내 소개 현황 보기</a>' +
        '</div>' +
        '<p class="nb-invite-toast" id="nbInviteToast" style="display:none">증표 주소가 복사되었습니다.</p>' +
      '</div>'
    ) : '';

    var html = '<div class="co-saved-link">' +
      '<p class="co-saved-title">이 주소를 저장해 두시면 언제든 다시 보실 수 있습니다</p>' +
      '<div class="co-copy-box">' +
        '<input type="text" readonly value="' + link + '" id="coSavedInput">' +
        '<button type="button" id="coCopyBtn">주소 복사</button>' +
      '</div>' +
      '<p class="co-copy-done" id="coCopyDone" style="display:none">주소가 복사되었습니다.</p>' +
    '</div>' +
    '<div class="co-done rp-article">' + parsedReportHtml + '</div>' +
    upsellHtml +
    inviteHtml;

    done.style.display = 'block';
    done.innerHTML = html;

    if(upsellItems.length > 0 && upsellItems[0].info && upsellItems[0].info.expiresAt){
      var expTime = new Date(upsellItems[0].info.expiresAt).getTime();
      var tEl = document.getElementById('coUpsellTimer');
      var cards = document.querySelectorAll('#coUpsellSection .od-upsell-card');

      var uTimer = setInterval(function(){
        var diff = expTime - Date.now();
        if(diff <= 0){
          clearInterval(uTimer);
          if(tEl) tEl.textContent = '할인 시간이 지났습니다';
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
        if(tEl) tEl.textContent = '남은 시간 ' + pad(h) + ':' + pad(m) + ':' + pad(s);
      }, 1000);
    }

    var invCopyBtn = document.getElementById('nbCopyInviteBtn');
    var invKakaoBtn = document.getElementById('nbKakaoInviteBtn');
    if(invCopyBtn && inviteCode){
      var invLink = location.origin + '/?invite=' + encodeURIComponent(inviteCode);
      invCopyBtn.onclick = function(){
        try{
          if(navigator.clipboard && navigator.clipboard.writeText){
            navigator.clipboard.writeText(invLink);
          }else{
            var t = document.createElement('textarea'); t.value = invLink; document.body.appendChild(t); t.select(); document.execCommand('copy'); document.body.removeChild(t);
          }
          var tst = document.getElementById('nbInviteToast');
          if(tst){ tst.textContent = '증표 주소가 복사되었습니다: ' + invLink; tst.style.display = 'block'; }
        }catch(e){ prompt('증표 주소를 복사하십시오:', invLink); }
      };
      if(invKakaoBtn){
        invKakaoBtn.onclick = function(){
          var kKey = (window.KAKAO_JS_KEY || '').trim();
          var kakaoShared = false;
          if(kKey && window.Kakao){
            try{
              if(!window.Kakao.isInitialized()){
                window.Kakao.init(kKey);
              }
              if(window.Kakao.Share && window.Kakao.Share.sendDefault){
                window.Kakao.Share.sendDefault({
                  objectType: 'feed',
                  content: {
                    title: '늘봄사주 — 벗의 증표',
                    description: '벗은 ${INVITE_DISCOUNT_KRW.toLocaleString('ko-KR')}원 할인, 그대는 ${INVITE_REWARD_NAME} 무료',
                    imageUrl: location.origin + '/assets/신령계문_첫장면.jpg',
                    link: {
                      mobileWebUrl: invLink,
                      webUrl: invLink
                    }
                  },
                  buttons: [
                    {
                      title: '증표 받고 사주 보기',
                      link: {
                        mobileWebUrl: invLink,
                        webUrl: invLink
                      }
                    }
                  ]
                });
                kakaoShared = true;
              }
            }catch(err){
              kakaoShared = false;
            }
          }
          if(!kakaoShared){
            var text = [
              '벗에게 알려주게',
              '그대의 증표 — ' + inviteCode,
              '이 증표로 들어온 벗은 ${INVITE_DISCOUNT_KRW.toLocaleString('ko-KR')}원을 덜 낸다네.',
              '벗이 첫 점사를 받으면, 그대에게 ${INVITE_REWARD_NAME} 보답이 주어진다네.',
              invLink
            ].join(String.fromCharCode(10));
            if(navigator.share){ navigator.share({ title: '늘봄사주 벗의 증표', text: text, url: invLink }).catch(function(){}); }
            else { invCopyBtn.click(); }
          }
        };
      }
    }
    var copyBtn = document.getElementById('coCopyBtn');
    var copyInp = document.getElementById('coSavedInput');
    var copyMsg = document.getElementById('coCopyDone');
    if(copyBtn && copyInp){
      copyBtn.onclick = function(){
        try{
          if(navigator.clipboard && navigator.clipboard.writeText){
            navigator.clipboard.writeText(copyInp.value);
          }else{
            copyInp.select();
            document.execCommand('copy');
          }
          if(copyMsg) copyMsg.style.display = 'block';
        }catch(e){}
      };
    }
  }

  /*
   * 빈 화면 파수꾼.
   *
   * 터진 뒤에 적은 것 (2026-10-02): 결제 화면이 **아무것도 없는 검은 화면**으로
   * 끝난 일이 있었다. 입력칸은 서버가 보낸 글에 멀쩡히 들어 있었는데 화면에서
   * 사라졌고, 그 자리에 아무 안내도 뜨지 않았다. 사는 길이 통째로 막힌다.
   *
   * 어디서 숨겼는지 따지지 않는다. **결과만 본다** — 살 수 있는 것도, 기다리는
   * 안내도, 풀이도 없으면 입력칸을 도로 꺼낸다. 2초마다, 1분 동안 지켜본다.
   * 빈 화면으로 끝나는 길이 하나라도 있으면 안 된다.
   */
  (function 빈화면파수꾼(){
    /*
     * 처음 쓴 것은 「안내 글 한 줄이라도 있으면 가만히 둔다」였다. 그런데 그
     * 한 줄은 늘 깔려 있어서 파수꾼이 한 번도 깨어나지 않았다.
     * 이제는 **손님이 실제로 볼 것**만 센다 — 풀이·기다림 카드·다시 시도 단추.
     * 그것이 없으면 입력칸을 힘으로 꺼낸다.
     */
    var 본횟수 = 0;
    var 지킴 = setInterval(function(){
      try{
        if(++본횟수 > 40){ clearInterval(지킴); return; }
        var r = document.getElementById('coRetry');
        /*
         * 터진 뒤에 적은 것 (2026-10-02): 전에는 카드가 **있기만 하면** 보이는
         * 것으로 세었다. 그런데 카드는 숨겨진 form 안에 있어서 높이가 0이었다.
         * 파수꾼이 그걸 보고 잠들어 빈 화면이 그대로 남았다.
         * **높이가 있어야 보이는 것이다.**
         */
        var 키있나 = function(e){ return e && e.offsetHeight > 0 ? e : null; };
        var 보일것 = 키있나(document.getElementById('coWaitCard'))
          || 키있나(document.getElementById('coTimeoutCard'))
          || 키있나(document.getElementById('coStuckCard'))
          || 키있나(document.querySelector('.co-done'))
          || 키있나(document.querySelector('.od-upsell-box'))
          || 키있나(r);
        if(보일것){ clearInterval(지킴); return; }
        var form = document.getElementById('coForm');
        var fields = document.getElementById('coFields');
        var 살수있나 = (form && form.offsetHeight > 40) || (fields && fields.offsetHeight > 40);
        if(살수있나){ clearInterval(지킴); return; }
        if(form){
          form.style.setProperty('display', 'block', 'important');
          form.style.setProperty('visibility', 'visible', 'important');
          form.removeAttribute('hidden');
        }
        if(fields){
          fields.style.setProperty('display', 'block', 'important');
          fields.style.setProperty('visibility', 'visible', 'important');
          fields.removeAttribute('hidden');
        }
        var payBtn = document.getElementById('coPay');
        if(payBtn) payBtn.style.setProperty('display', 'block', 'important');
      }catch(e){ clearInterval(지킴); }
    }, 1500);
  })();

  /* resume handling for mobile redirect */
  (function checkResume(){
    try{
      var q = new URLSearchParams(location.search);
      var resumeId = q.get('resume');
      var portoneCode = q.get('code');
      if(resumeId){
        var fields = document.getElementById('coFields');
        if(fields) fields.style.display = 'none';
        if(portoneCode){
          say('결제가 완료되지 않았습니다. 다시 시도해 주십시오.');
          var retry = document.getElementById('coRetry');
          if(retry) retry.style.display = 'block';
        }else{
          (async function(){
            var cf = null;
            try{
              say('결제를 확인하고 있습니다…');
              var pid = q.get('paymentId') || resumeId;
              cf = await post('/api/orders/' + encodeURIComponent(resumeId) + '/confirm', { paymentId: pid });
            }catch(confirmErr){
              console.log('[결제 확인 통신 오류, 풀이 확인 시도]', confirmErr);
            }
            await waitForReport(resumeId, cf);
          })();
        }
      }
    }catch(e){}
  })();

  /*
   * 신령 처소나 첫 화면에서 이미 적은 것이 있으면 그대로 채운다.
   * 사겠다고 누른 손님에게 같은 것을 두 번 묻지 않는다.
   */
  try{
    var saved = loadReading();
    if(saved){
      var b = saved.birth || saved;
      var set=function(id,v){ var el=document.getElementById(id); if(el&&v) el.value=v; };
      set('buyerName', b.name);
      set('birthDate', b.date || b.birthDate);
      if(b.timeKnown === false || !b.time || b.time === '12:00'){
        setBirthTimeUnknown(true);
        set('birthTimeSlot', b.time || '12:00');
      } else {
        setBirthTimeUnknown(false);
        var parsed = parseTimeInput(b.time || b.birthTime);
        set('birthTime', parsed || b.time || b.birthTime);
      }
      set('birthPlace', b.place || b.birthPlace);
      set('gender', b.gender);
      set('surname', saved.name && saved.name.surname);
      ${product.needsName ? `
      set('fixedChar', saved.name && saved.name.fixed && saved.name.fixed.char);
      set('fixedAt', saved.name && saved.name.fixed && saved.name.fixed.at);
      set('avoidChars', saved.name && saved.name.avoid && saved.name.avoid.join(', '));` : ''}
      ${product.needsPartner ? `
      set('partnerDate', saved.partner && saved.partner.date);
      set('partnerTime', saved.partner && saved.partner.time);` : ''}
      ${product.needsRange ? `
      set('rangeFrom', saved.range && saved.range.from);
      set('rangeTo', saved.range && saved.range.to);
      set('rangeAvoid', saved.range && saved.range.avoid && saved.range.avoid.join(', '));` : ''}

      if(saved.child){
        set('childName', saved.child.name);
        set('childDate', saved.child.date);
        set('childGender', saved.child.gender);
        set('childPlace', saved.child.place);
        if(saved.child.isDueDate){
          var dueEl = document.getElementById('childIsDueDate');
          if(dueEl){
            dueEl.checked = true;
            var lbl = document.getElementById('childDateLabel');
            if(lbl) lbl.textContent = '출산 예정일';
          }
        }
        if(saved.child.timeKnown === false){
          setChildTimeUnknown(true);
          set('childTimeSlot', saved.child.time || '12:00');
        } else {
          setChildTimeUnknown(false);
          var cParsed = parseTimeInput(saved.child.time);
          set('childTime', cParsed || saved.child.time);
        }
      }

      if(saved.face){ window.__nbFace = saved.face; faceUploaded = true; }
      else if(saved.보여줌 && saved.보여줌.face){ window.__nbFace = { shown: true }; faceUploaded = true; }
      if(saved.palm){ window.__nbPalm = saved.palm; palmUploaded = true; }
      else if(saved.보여줌 && saved.보여줌.palm){ window.__nbPalm = { shown: true }; palmUploaded = true; }
    }
  }catch(e){}

  var timeUnknownEl = document.getElementById('birthTimeUnknown');
  var timeSlotWrap = document.getElementById('birthTimeSlotWrap');
  var birthBtnUnk = document.getElementById('birthBtnUnknown');
  var timeUnknownEl = document.getElementById('birthTimeUnknown');
  var timeSlotWrap = document.getElementById('birthTimeSlotWrap');
  var timeInp = document.getElementById('birthTime');
  var timeSlot = document.getElementById('birthTimeSlot');

  function setBirthTimeUnknown(unk){
    window.__birthTimeUnknown = unk;
    if(timeUnknownEl) timeUnknownEl.checked = unk;
    if(birthBtnUnk){
      birthBtnUnk.style.borderColor = unk ? '#d4af37' : '';
      birthBtnUnk.style.color = unk ? '#d4af37' : '';
    }
    if(timeSlotWrap) timeSlotWrap.style.display = unk ? 'block' : 'none';
    if(timeInp){
      timeInp.disabled = unk;
      if(unk) timeInp.value = '';
    }
    updateSummaryDisplay();
    checkCanPay();
  }

  if(birthBtnUnk){
    birthBtnUnk.addEventListener('click', function(){
      setBirthTimeUnknown(!window.__birthTimeUnknown);
    });
  }
  if(timeUnknownEl){
    timeUnknownEl.addEventListener('change', function(){
      setBirthTimeUnknown(timeUnknownEl.checked);
    });
  }
  if(timeInp){
    timeInp.addEventListener('blur', function(){
      var p = parseTimeInput(timeInp.value);
      if(p) timeInp.value = p;
      updateSummaryDisplay();
    });
    timeInp.addEventListener('input', function(){
      var p = parseTimeInput(timeInp.value);
      if(p && timeInp.value.length >= 4){
        timeInp.value = p;
      }
      updateSummaryDisplay();
    });
  }
  if(timeSlot){
    timeSlot.addEventListener('change', updateSummaryDisplay);
  }

  var childDueEl = document.getElementById('childIsDueDate');
  if(childDueEl){
    childDueEl.addEventListener('change', function(){
      var lbl = document.getElementById('childDateLabel');
      if(lbl) lbl.textContent = childDueEl.checked ? '출산 예정일' : '아이 생년월일';
      checkCanPay();
    });
  }

  var childBtnUnk = document.getElementById('childBtnUnknown');
  var childTimeInp = document.getElementById('childTime');
  var childTimeSlotWrap = document.getElementById('childTimeSlotWrap');

  function setChildTimeUnknown(unk){
    window.__childTimeUnknown = unk;
    if(childBtnUnk){
      childBtnUnk.style.borderColor = unk ? '#d4af37' : '';
      childBtnUnk.style.color = unk ? '#d4af37' : '';
    }
    if(childTimeSlotWrap) childTimeSlotWrap.style.display = unk ? 'block' : 'none';
    if(childTimeInp){
      childTimeInp.disabled = unk;
      if(unk) childTimeInp.value = '';
    }
    checkCanPay();
  }

  if(childBtnUnk){
    childBtnUnk.addEventListener('click', function(){
      setChildTimeUnknown(!window.__childTimeUnknown);
    });
  }
  if(childTimeInp){
    childTimeInp.addEventListener('blur', function(){
      var p = parseTimeInput(childTimeInp.value);
      if(p) childTimeInp.value = p;
    });
    childTimeInp.addEventListener('input', function(){
      var p = parseTimeInput(childTimeInp.value);
      if(p && childTimeInp.value.length >= 4){
        childTimeInp.value = p;
      }
    });
  }

  ['childName', 'childDate', 'childGender', 'childTime', 'childTimeSlot', 'childPlace'].forEach(function(id){
    var el = document.getElementById(id);
    if(el){
      el.addEventListener('input', checkCanPay);
      el.addEventListener('change', checkCanPay);
    }
  });

  updateSummaryDisplay();
  checkCanPay();

  // [고치기] 버튼 및 [입력 완료] 버튼
  var editBtn = document.getElementById('coEditUserBtn');
  var editForm = document.getElementById('coUserEditForm');
  var doneBtn = document.getElementById('coUserDoneBtn');
  if(editBtn && editForm){
    editBtn.addEventListener('click', function(){
      var open = getComputedStyle(editForm).display !== 'none';
      editForm.style.display = open ? 'none' : 'block';
      if(!open) editForm.scrollIntoView({ behavior:'smooth', block:'nearest' });
    });
  }
  if(doneBtn && editForm){
    doneBtn.addEventListener('click', function(){
      var name = val('buyerName'), date = val('birthDate');
      var gender = val('gender'), place = val('birthPlace');
      var isUnk = Boolean(window.__birthTimeUnknown || (timeUnknownEl && timeUnknownEl.checked));
      var rawTime = val('birthTime');
      var parsedTime = parseTimeInput(rawTime);
      var time = isUnk ? (val('birthTimeSlot') || '12:00') : (parsedTime || rawTime || '12:00');
      var tKnown = !isUnk && Boolean(parsedTime || rawTime);
      saveReading({
        birth: { name: name, date: date, gender: gender, time: time, timeKnown: tKnown, place: place }
      });
      updateSummaryDisplay();
      editForm.style.display = 'none';
      checkCanPay();
    });
  }

  // 폼 입력 시 자동 세션 저장 및 요약 카드 동기화
  ['buyerName', 'birthDate', 'gender', 'birthTime', 'birthTimeSlot', 'birthPlace'].forEach(function(id){
    var el = document.getElementById(id);
    if(el){
      el.addEventListener('change', function(){
        var isUnk = Boolean(window.__birthTimeUnknown || (timeUnknownEl && timeUnknownEl.checked));
        var rawTime = val('birthTime');
        var parsedTime = parseTimeInput(rawTime);
        var time = isUnk ? (val('birthTimeSlot') || '12:00') : (parsedTime || rawTime || '12:00');
        var tKnown = !isUnk && Boolean(parsedTime || rawTime);
        saveReading({
          birth: {
            name: val('buyerName'),
            date: val('birthDate'),
            gender: val('gender'),
            time: time,
            timeKnown: tKnown,
            place: val('birthPlace')
          }
        });
        updateSummaryDisplay();
        checkCanPay();
      });
    }
  });

  try{
    var qParams = new URLSearchParams(location.search);
    var qEmail = qParams.get('email') || (function(){ try { return sessionStorage.getItem('nb_email'); } catch(e){ return null; } })();
    if(qEmail){
      var emEl = document.getElementById('email');
      if(emEl && !emEl.value) emEl.value = qEmail;
    }
  }catch(e){}

  /*
   * 한 상에 앉는 사람을 넣고 빼는 자리.
   */
  var kinBox = document.getElementById('coFamily');
  var addKin = document.getElementById('coAddKin');
  var won = function(n){ return n.toLocaleString('ko-KR'); };

  function kinCount(){ return kinBox ? kinBox.querySelectorAll('.co-kin').length : (EMBEDDED ? ((loadReading() || {}).family || []).length : 0); }
  function priceNow(){
    var people = Math.min(1 + kinCount(), MAX_MEMBERS);
    return BASE_KRW + Math.max(0, people - FREE_UPTO) * EXTRA_KRW;
  }
  function refreshPrice(){
    var p = priceNow();
    var qp = new URLSearchParams(location.search);
    var qRew = qp.get('invite_reward');
    if((PRODUCT === 'daily-report' && qRew === '1') || (PRODUCT === 'month-report' && qRew === '5')){
      pay.textContent = '0원 바로 받기 (이용권)';
      var tag = document.querySelector('.co-price b');
      if(tag) tag.textContent = '0원 (이용권)';
      var noteEl = document.getElementById('coInviteNote');
      if(!noteEl){
        noteEl = document.createElement('p');
        noteEl.id = 'coInviteNote';
        noteEl.style.fontSize = '13px';
        noteEl.style.margin = '4px 0 0';
        var prSec = document.querySelector('.co-price');
        if(prSec && prSec.parentNode) prSec.parentNode.insertBefore(noteEl, prSec.nextSibling);
      }
      noteEl.style.color = '#9fd8a8';
      noteEl.textContent = '소개 보답 이용권 적용 (0원)';
      return;
    }
    if(passValid){
      currentDisplayedAmount = 0;
      pay.textContent = '0원 바로 받기 (주인 통과)';
      var passTag = document.querySelector('.co-price b');
      if(passTag) passTag.textContent = '0원 (주인 통과)';
      return;
    }
    var inv = (function(){ try { return sessionStorage.getItem('nb_invite'); } catch(e){ return null; } })();
    var discount = 0;
    var noteEl = document.getElementById('coInviteNote');
    if(inv){
      if(!noteEl){
        noteEl = document.createElement('p');
        noteEl.id = 'coInviteNote';
        noteEl.style.fontSize = '13px';
        noteEl.style.margin = '4px 0 0';
        var prSec = document.querySelector('.co-price');
        if(prSec && prSec.parentNode) prSec.parentNode.insertBefore(noteEl, prSec.nextSibling);
      }
      if(p >= ${INVITE_MIN_ORDER_KRW}){
        discount = ${INVITE_DISCOUNT_KRW}; // discount = 3000
        noteEl.style.color = '#9fd8a8';
        noteEl.textContent = '벗의 증표 −${INVITE_DISCOUNT_KRW.toLocaleString('ko-KR')}원'; // 벗의 증표 −3,000원
      }else{
        discount = 0;
        noteEl.style.color = '#f0c080';
        noteEl.textContent = '이 증표는 ${(INVITE_MIN_ORDER_KRW / 10000)}만원 이상 점사에 쓰실 수 있습니다'; // 이 증표는 2만원 이상 점사에 쓰실 수 있습니다
      }
    } else if(noteEl){
      noteEl.textContent = '';
    }
    var finalP = Math.max(0, p - discount);
    currentDisplayedAmount = finalP;
    pay.textContent = won(finalP) + '원 결제하기';
    var tag = document.querySelector('.co-price b');
    if(tag){
      if(inv && p >= ${INVITE_MIN_ORDER_KRW}){
        tag.innerHTML = '<del>' + won(p) + '원</del> ' + won(finalP) + '원 <span class="co-invite-tag" style="font-size:14px;color:#9fd8a8;font-weight:600;margin-left:6px">(벗의 증표 −' + won(${INVITE_DISCOUNT_KRW}) + '원)</span>';
      }else{
        tag.textContent = won(finalP) + '원';
      }
    }
    if(addKin && NEEDS_FAMILY) addKin.disabled = (1 + kinCount()) >= MAX_MEMBERS;
  }
  refreshPrice();

  /*
   * 꼭 넣을 글자 — 한자를 **손님이 고르게** 한다.
   *
   * 터진 뒤에 적은 것 (2026-10-04): 「희」라고만 받고 획수에 맞는 한자를
   * 저희가 골랐다. 「희」로 쓸 수 있는 한자는 마흔 개가 넘고 뜻이 전부 다르다.
   * 밝을 희(熙)를 바란 손님이 바랄 희(希)를 받으면 그 이름은 못 쓴다.
   * 그리고 자리(앞/뒤)가 「앞」으로 미리 눌려 있어, 못 보고 지나간 손님은
   * 끝에 넣고 싶던 글자를 앞에 받았다. 149,000원짜리에서 이러면 분쟁이다.
   */
  ${product.needsName ? `
  var fxInput = document.getElementById('fixedChar');
  var fxAt    = document.getElementById('fixedAt');
  var fxPick  = document.getElementById('coHanjaPick');
  var fxGrid  = document.getElementById('coHanjaGrid');
  var fxHead  = document.getElementById('coHanjaHead');
  var fxShape = document.getElementById('coFixedShape');
  var 고른한자 = '';

  function 한글인가(c){ return /^[\uac00-\ud7a3]$/.test(c); }

  function 모양을그린다(){
    if(!fxShape) return;
    var 성 = (val('surname') || '').trim();
    var 글 = 고른한자 || (fxInput ? fxInput.value.trim() : '');
    var 자리 = fxAt ? fxAt.value : '';
    if(!글){ fxShape.style.display = 'none'; return; }
    var 성글 = 성 || '○';
    var 앞모양 = 성글 + ' <b>' + 글 + '</b> ○';
    var 뒷모양 = 성글 + ' ○ <b>' + 글 + '</b>';
    /*
     * 자리를 아직 안 골랐어도 **눌린 것이 보이게** 한다.
     *
     * 터진 뒤에 적은 것 (2026-10-04): 한자를 눌러도 자리를 고르기 전에는
     * 화면이 꿈쩍도 안 했다. 사장님이 「버튼이 안 눌리더만」이라고 하셨다.
     * 실제로는 눌렸는데 보여 주는 것이 없었다.
     */
    if(!자리){
      fxShape.innerHTML = '<span class="co-shape-pick">「' + 글 + '」 를 고르셨습니다.</span>'
        + ' 이제 <b>어디에 넣을지</b> 골라 주십시오.'
        + '<br><span class="co-shape-name dim">' + 앞모양 + '</span>'
        + ' <span class="co-shape-or">또는</span> '
        + '<span class="co-shape-name dim">' + 뒷모양 + '</span>';
      fxShape.style.display = 'block';
      return;
    }
    fxShape.innerHTML = '이렇게 지어 드립니다 &nbsp; <span class="co-shape-name">'
      + (자리 === '앞' ? 앞모양 : 뒷모양) + '</span>'
      + '<br><span class="co-shape-note">○ 는 저희가 지어 드릴 글자입니다</span>';
    fxShape.style.display = 'block';
  }

  function 한자를보여준다(){
    if(!fxGrid || !fxPick) return;
    var c = fxInput ? fxInput.value.trim() : '';
    if(!한글인가(c)){
      fxPick.style.display = 'none';
      fxGrid.innerHTML = '';
      고른한자 = '';
      모양을그린다();
      return;
    }
    var 성 = (val('surname') || '').trim();
    fetch('/api/naming/hanja?reading=' + encodeURIComponent(c) + (성 ? '&surname=' + encodeURIComponent(성) : ''))
      .then(function(r){ return r.json(); })
      .then(function(d){
        var 글자들 = (d && d.글자들) || [];
        if(!글자들.length){ fxPick.style.display='none'; return; }
        fxHead.textContent = '「' + c + '」 로 쓸 수 있는 한자 ' + 글자들.length + '개 — 아시는 글자가 있으면 눌러 주십시오';
        fxGrid.innerHTML = 글자들.map(function(h){
          var 쓸수없나 = (h.앞자리로_쓸_수_있나 === false && h.끝자리로_쓸_수_있나 === false);
          return '<button type="button" class="co-hanja-btn' + (쓸수없나 ? ' off' : '') + '" data-ja="' + h.자 + '"'
            + (쓸수없나 ? ' title="이 글자로는 길한 획수가 서지 않습니다"' : '')
            + '><span class="co-hanja-ja">' + h.자 + '</span><span class="co-hanja-sub">' + (h.뜻 ? h.뜻 + ' · ' : '') + h.획 + '획</span></button>';
        }).join('');
        fxPick.style.display = 'block';
      })
      .catch(function(){ fxPick.style.display='none'; });
  }

  if(fxGrid){
    fxGrid.addEventListener('click', function(e){
      var b = e.target.closest ? e.target.closest('.co-hanja-btn') : null;
      if(!b) return;
      var 이미 = b.classList.contains('on');
      Array.prototype.forEach.call(fxGrid.querySelectorAll('.co-hanja-btn'), function(x){ x.classList.remove('on'); });
      if(이미){ 고른한자 = ''; } else { b.classList.add('on'); 고른한자 = b.getAttribute('data-ja'); }
      모양을그린다();
      checkCanPay();
    });
  }
  if(fxInput){
    var 늦게 = null;
    fxInput.addEventListener('input', function(){
      고른한자 = '';
      모양을그린다();
      checkCanPay();
      clearTimeout(늦게);
      늦게 = setTimeout(한자를보여준다, 250);
    });
  }
  if(fxAt) fxAt.addEventListener('change', function(){
    모양을그린다();
    checkCanPay();
  });
  var 성칸 = document.getElementById('surname');
  if(성칸) 성칸.addEventListener('input', function(){
    모양을그린다();
    checkCanPay();
  });
  ` : ''}

  var invToggle = document.getElementById('coInviteToggle');
  var invRemoveBtn = document.getElementById('coInviteRemoveBtn');
  var invFold = document.getElementById('coInviteFold');
  var invInput = document.getElementById('coInviteInput');
  var invBtn = document.getElementById('coInviteApplyBtn');
  var invMsg = document.getElementById('coInviteMsg');
  var DEFAULT_INVITE_TEXT = ${JSON.stringify(product.priceKrw >= INVITE_MIN_ORDER_KRW ? '증표 있으십니까?' : '')};

  function updateInviteUI(code){
    var curP = priceNow();
    if(code && curP >= ${INVITE_MIN_ORDER_KRW}){
      if(invFold) invFold.style.display = 'none';
      if(invToggle){
        invToggle.textContent = '증표 적용 중 (' + code + ') · ' + won(${INVITE_DISCOUNT_KRW}) + '원 할인';
        invToggle.style.textDecoration = 'none';
        invToggle.style.cursor = 'default';
      }
      if(invRemoveBtn) invRemoveBtn.style.display = 'inline-block';
    } else {
      if(invToggle && DEFAULT_INVITE_TEXT){
        invToggle.textContent = DEFAULT_INVITE_TEXT;
        invToggle.style.textDecoration = 'underline';
        invToggle.style.cursor = 'pointer';
      }
      if(invRemoveBtn) invRemoveBtn.style.display = 'none';
    }
  }

  var existingInv = (function(){ try { return sessionStorage.getItem('nb_invite'); } catch(e){ return null; } })();
  if(existingInv && invInput){
    invInput.value = existingInv;
    updateInviteUI(existingInv);
  }

  if(invRemoveBtn){
    invRemoveBtn.onclick = function(e){
      e.preventDefault();
      try { sessionStorage.removeItem('nb_invite'); } catch(e){}
      if(invInput) invInput.value = '';
      if(invMsg) { invMsg.textContent = ''; invMsg.className = 'co-invite-msg'; }
      updateInviteUI(null);
      refreshPrice();
    };
  }

  if(invToggle && invFold){
    invToggle.onclick = function(){
      var invCur = (function(){ try { return sessionStorage.getItem('nb_invite'); } catch(e){ return null; } })();
      if(invCur) return;
      var isHidden = invFold.style.display === 'none';
      invFold.style.display = isHidden ? 'block' : 'none';
      if(isHidden && invInput) invInput.focus();
    };
  }

  if(invBtn && invInput){
    var clientFailCount = 0;
    var clientCooldownUntil = 0;

    var handleApplyInvite = function(){
      var now = Date.now();
      if(clientCooldownUntil > now){
        var rem = Math.ceil((clientCooldownUntil - now) / 1000);
        if(invMsg){
          invMsg.className = 'co-invite-msg err';
          invMsg.textContent = '증표 입력을 여러 번 실패하여 잠시 후(' + rem + '초 뒤) 다시 시도해 주세요.';
        }
        return;
      } else if(clientCooldownUntil > 0){
        clientFailCount = 0;
        clientCooldownUntil = 0;
      }

      var code = invInput.value.trim().toLowerCase();
      if(!code){
        if(invMsg){
          invMsg.className = 'co-invite-msg err';
          invMsg.textContent = '증표 코드를 입력해 주세요.';
        }
        return;
      }

      invBtn.disabled = true;
      var emailVal = (val('email') || '').trim();

      fetch('/api/invite/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: code, email: emailVal })
      })
      .then(function(res){
        return res.json().then(function(d){ return { status: res.status, data: d }; });
      })
      .then(function(result){
        invBtn.disabled = false;
        var data = result.data || {};
        if(result.status === 429){
          if(invMsg){
            invMsg.className = 'co-invite-msg err';
            invMsg.textContent = data.message || '증표 입력을 여러 번 실패하여 잠시 후 다시 시도해 주세요.';
          }
          return;
        }

        if(data.ok && data.valid){
          clientFailCount = 0;
          try { sessionStorage.setItem('nb_invite', data.code); } catch(e){}
          updateInviteUI(data.code);
          refreshPrice();

          if(invMsg){
            var curP = priceNow();
            if(curP >= ${INVITE_MIN_ORDER_KRW}){
              invMsg.className = 'co-invite-msg ok';
              invMsg.textContent = '증표가 적용되어 ' + won(${INVITE_DISCOUNT_KRW}) + '원 할인되었습니다.';
            } else {
              invMsg.className = 'co-invite-msg warn';
              invMsg.textContent = '이 증표는 ${(INVITE_MIN_ORDER_KRW / 10000)}만원 이상 점사에서만 사용하실 수 있습니다.';
            }
          }
        } else {
          clientFailCount++;
          if(clientFailCount >= 3){
            clientCooldownUntil = Date.now() + 60 * 1000;
            if(invMsg){
              invMsg.className = 'co-invite-msg err';
              invMsg.textContent = '증표 입력을 여러 번 실패하여 잠시 후 다시 시도해 주세요.';
            }
          } else {
            if(invMsg){
              invMsg.className = 'co-invite-msg err';
              invMsg.textContent = data.message || '그런 증표가 없습니다';
            }
          }
        }
      })
      .catch(function(){
        invBtn.disabled = false;
        if(invMsg){
          invMsg.className = 'co-invite-msg err';
          invMsg.textContent = '확인 중 오류가 발생했습니다.';
        }
      });
    };

    invBtn.onclick = handleApplyInvite;
    invInput.onkeydown = function(e){
      if(e.key === 'Enter'){
        e.preventDefault();
        handleApplyInvite();
      }
    };
  }
  function hourSelect(){
    return '<select class="kin-time">' + HOUR_OPTIONS.map(function(h){
      return '<option value="'+h[0]+'">'+h[1]+'</option>';
    }).join('') + '</select>';
  }
  function addRow(pre){
    if(!kinBox || (1 + kinCount()) >= MAX_MEMBERS) return;
    var wrap = document.createElement('div');
    wrap.className = 'co-kin';
    wrap.innerHTML =
      '<div class="co-kin-top"><b>' + (kinCount() + 2) + '번째 분</b>' +
      '<button type="button" class="co-kin-del">빼기</button></div>' +
      '<div class="co-f"><label>관계 (예: 어머니, 시아버지, 형)</label>' +
      '<input type="text" class="kin-rel" maxlength="12"></div>' +
      '<div class="co-f"><label>생년월일</label><input type="date" class="kin-date"></div>' +
      '<div class="co-f"><label>태어난 시간</label>' + hourSelect() + '</div>';
    wrap.querySelector('.co-kin-del').addEventListener('click', function(){
      wrap.remove(); renumber(); refreshPrice();
    });
    kinBox.appendChild(wrap);
    if(pre){
      wrap.querySelector('.kin-rel').value = pre.relation || '';
      wrap.querySelector('.kin-date').value = pre.date || '';
      if(pre.time) wrap.querySelector('.kin-time').value = pre.time;
    }
    refreshPrice();
  }
  function renumber(){
    if(!kinBox) return;
    var rows = kinBox.querySelectorAll('.co-kin');
    for(var i=0;i<rows.length;i++) rows[i].querySelector('b').textContent = (i+2) + '번째 분';
  }
  function readFamily(){
    if(!kinBox) return EMBEDDED ? ((loadReading() || {}).family || []) : [];
    return [].map.call(kinBox.querySelectorAll('.co-kin'), function(r){
      return {
        relation: r.querySelector('.kin-rel').value.trim() || '가족',
        date: r.querySelector('.kin-date').value,
        time: r.querySelector('.kin-time').value || '12:00'
      };
    }).filter(function(f){ return !!f.date; });
  }
  if(addKin) addKin.addEventListener('click', function(){ addRow(null); });
  if(NEEDS_FAMILY && kinBox && !kinCount()){
    var savedFamily = (loadReading() || {}).family || [];
    if(savedFamily.length) savedFamily.forEach(function(person){ addRow(person); });
    else addRow(null);
  }

  f.addEventListener('submit', async function(ev){
    ev.preventDefault();
    if(!agree.checked) return;

    var name = val('buyerName'), date = val('birthDate');
    var email = val('email'), phone = val('phone').replace(/[^0-9]/g,'');
    if(!name) return say('성함을 적어 주십시오.');
    if(!date && !NEEDS_PICK) return say('생년월일을 적어 주십시오.');
    if(!/^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$/.test(email)) return say('이메일을 다시 확인해 주십시오.');
    if(phone.length < 10) return say('휴대전화 번호를 다시 확인해 주십시오.');
    ${product.needsName ? "if(!val('surname')) return say('아이의 성을 적어 주십시오.');" : ''}
    ${product.needsPartner ? "if(!val('partnerDate')) return say('상대의 생년월일을 적어 주십시오.');" : ''}
    ${product.needsRange ? `
    var rFrom = val('rangeFrom');
    var rTo = val('rangeTo');
    if(!rFrom || !rTo) return say('보고 싶은 기간을 적어 주십시오.');
    if(rFrom > rTo) return say('끝 날짜가 시작 날짜보다 앞설 수 없습니다.');
    var diffDays = Math.round((new Date(rTo) - new Date(rFrom))/(1000*60*60*24)) + 1;
    if(diffDays > 180) return say('기간은 최대 180일(여섯 달) 안으로 잡아 주세요.');
    ` : ''}

    var isUnk = Boolean(window.__birthTimeUnknown || (timeUnknownEl && timeUnknownEl.checked));
    var finalTime = '12:00';
    var finalTimeKnown = false;
    var rawBirthTime = val('birthTime');
    var parsedBirthTime = parseTimeInput(rawBirthTime);
    if(EMBEDDED){
      var savedBirth = (loadReading() || {}).birth || {};
      finalTime = savedBirth.time || '12:00';
      finalTimeKnown = savedBirth.timeKnown !== false;
    } else if(isUnk){
      finalTime = val('birthTimeSlot') || '12:00';
      finalTimeKnown = false;
    } else if(parsedBirthTime){
      finalTime = parsedBirthTime;
      finalTimeKnown = true;
    } else if(rawBirthTime){
      finalTime = rawBirthTime;
      finalTimeKnown = true;
    } else if(val('birthTimeSlot')){
      finalTime = val('birthTimeSlot');
      finalTimeKnown = false;
    } else {
      finalTime = '12:00';
      finalTimeKnown = false;
    }

    var reading = {
      productId: PRODUCT,
      birth: { date: date, time: finalTime, timeKnown: finalTimeKnown, place: val('birthPlace') || '서울', gender: val('gender'), name: name }
    };
    if(NEEDS_PICK) reading.pick = (loadReading() || {}).pick;
    ${product.needsChild ? `
    var cDate = val('childDate');
    if(!cDate) return say('아이의 생년월일(또는 예정일)을 적어 주십시오.');
    /* 미리 골라 두지 않는다. 딸인데 넘어가면 대운이 거꾸로 나간다 */
    var cGender = val('childGender');
    if(!cGender) return say('아이가 아들인지 딸인지 골라 주십시오. 대운이 가는 방향이 달라집니다.');
    var isChildUnk = Boolean(window.__childTimeUnknown);
    var cTimeInp = val('childTime');
    var cParsed = parseTimeInput(cTimeInp);
    var cFinalTime = '12:00';
    var cTimeKnown = false;
    if(!isChildUnk && cParsed){
      cFinalTime = cParsed;
      cTimeKnown = true;
    } else if(!isChildUnk && cTimeInp){
      cFinalTime = cTimeInp;
      cTimeKnown = true;
    } else if(val('childTimeSlot')){
      cFinalTime = val('childTimeSlot');
      cTimeKnown = false;
    }
    reading.child = {
      date: cDate,
      time: cFinalTime,
      timeKnown: cTimeKnown,
      place: val('childPlace') || '서울',
      gender: cGender,
      name: val('childName') || '',
      isDueDate: Boolean(childDueEl && childDueEl.checked)
    };
    ` : ''}
    ${product.needsName ? `
    var nObj = { surname: val('surname') };
    var fChar = (고른한자 || val('fixedChar')).trim();
    if (fChar) {
      /*
       * 자리를 안 고르면 **보내지 않는다.**
       * 전에는 비었을 때 조용히 '앞' 으로 넣었다. 끝에 넣고 싶던 손님이
       * 그 칸을 못 보고 지나가면 앞에 박힌 이름을 받았다.
       */
      var fAt = val('fixedAt');
      if (!fAt) return say('꼭 넣을 글자를 어디에 넣을지 골라 주십시오.');
      nObj.fixed = { char: fChar, at: fAt };
    }
    var rawAvoid = val('avoidChars').trim();
    if (rawAvoid) {
      var avList = rawAvoid.split(/[,\\s]+/).map(function(s){ return s.trim(); }).filter(Boolean);
      if (avList.length) nObj.avoid = avList;
    }
    reading.name = nObj;
    ` : ''}
    ${product.needsPartner ? "reading.partner = { date: val('partnerDate'), time: val('partnerTime') || '12:00' };" : ''}
    ${product.needsRange ? `
    var rawAvoid = val('rangeAvoid');
    var avoidList = rawAvoid ? rawAvoid.split(/[,\\s]+/).map(function(s){ return s.trim(); }).filter(function(s){ return /^\\d{4}-\\d{2}-\\d{2}$/.test(s); }) : [];
    reading.range = { from: rFrom, to: rTo, avoid: avoidList };
    ` : ''}
    if(NEEDS_FAMILY){
      var kin = readFamily();
      if(!kin.length) return say('같이 보실 분을 한 분 이상 넣어 주십시오.');
      reading.family = kin;
    }
    var savedBeforeOrder = loadReading() || {};
    if(savedBeforeOrder.child) reading.child = savedBeforeOrder.child;
    if(window.__nbFace || savedBeforeOrder.face || (savedBeforeOrder.보여줌 && savedBeforeOrder.보여줌.face))
      reading.face = window.__nbFace || savedBeforeOrder.face || { shown: true };
    if(window.__nbPalm || savedBeforeOrder.palm || (savedBeforeOrder.보여줌 && savedBeforeOrder.보여줌.palm))
      reading.palm = window.__nbPalm || savedBeforeOrder.palm || { shown: true };

    saveReading(reading);

    pay.disabled = true;
    say('주문을 만들고 있습니다…');

    var orderId = '';
    try{
      var adRef = (function(){
        try { return sessionStorage.getItem('nb_ref') || undefined; } catch(e){ return undefined; }
      })();
      var userInvite = (function(){ try { return sessionStorage.getItem('nb_invite') || undefined; } catch(e){ return undefined; } })();
      var agreeMkt = document.getElementById('coAgreeMarketing');
      var marketingConsent = agreeMkt ? agreeMkt.checked : false;

      var ownerPass = (function(){ try { return sessionStorage.getItem('nb_pass') || undefined; } catch(e){ return undefined; } })();
      var fromOrderId = (function(){
        try {
          var m = location.search.match(/[?&]fromOrder=([a-zA-Z0-9_-]+)/);
          return m ? m[1] : undefined;
        } catch(e){ return undefined; }
      })();

      var created = await post('/api/orders',
        Object.assign({}, reading, { acknowledgedNotice:true, previewShown:true, ref: adRef, email: email, invite: userInvite, pass: ownerPass, marketingConsent: marketingConsent, fromOrderId: fromOrderId }));
      orderId = created.order.id;

      if(created.order.amountKrw !== currentDisplayedAmount){
        throw new Error('값이 맞지 않습니다. 새로고침한 뒤 다시 해 주십시오.');
      }

      if(created.order.amountKrw === 0){
        var cf = null;
        try{
          cf = await post('/api/orders/' + orderId + '/confirm', { paymentId: orderId });
        }catch(e){
          console.log('[무료 주문 확인 통신 오류, 풀이 확인 계속]', e);
        }
        await waitForReport(orderId, cf);
        if(pay) pay.style.display = 'none';
        return;
      }

      await post('/api/orders/' + orderId + '/pending').catch(function(){});

      say('결제창을 엽니다…');
      if(!window.PortOne || !window.PortOne.requestPayment){
        throw new Error('결제 모듈을 불러오지 못했습니다. 새로고침한 뒤 다시 눌러 주십시오.');
      }
      var res;
      try{
        res = await window.PortOne.requestPayment({
          storeId: KEYS.storeId,
          channelKey: KEYS.channelKey,
          paymentId: orderId,
          orderName: ${JSON.stringify(product.name)},
          totalAmount: created.order.amountKrw,
          currency: 'CURRENCY_KRW',
          payMethod: 'CARD',
          redirectUrl: location.origin + '/checkout?product=' +
            encodeURIComponent(PRODUCT) + '&resume=' + encodeURIComponent(orderId),
          customer: { fullName: name, email: email, phoneNumber: phone }
        });
      }catch(e){
        console.log('[결제창]', e);
        throw new Error('결제창을 여는 데 실패했습니다. 잠시 뒤 다시 눌러 주십시오.');
      }
      if(res && res.code !== undefined){
        console.log('[결제 결과]', res);
        throw new Error('결제가 완료되지 않았습니다. 다시 눌러 주십시오.');
      }

      say('결제를 확인하고 있습니다…');
      var cf = null;
      try{
        cf = await post('/api/orders/' + orderId + '/confirm', { paymentId: (res && res.paymentId) || orderId });
      }catch(confirmErr){
        console.log('[결제 확인 통신 오류, 풀이 확인 계속]', confirmErr);
      }

      await waitForReport(orderId, cf);
      if(pay) pay.style.display = 'none';
    }catch(err){
      console.log('[결제 실패]', err);
      if(err && (err.message === '결제가 완료되지 않았습니다. 다시 눌러 주십시오.' || err.message === '결제창을 여는 데 실패했습니다. 잠시 뒤 다시 눌러 주십시오.')){
        say(err.message);
      }else{
        say((err && err.message) || '결제에 실패했습니다. 잠시 뒤 다시 시도해 주십시오.');
      }
      pay.disabled = false;
    }
  });
})();
</script>`;

  return `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
${renderSocialHead(info, {
    title: `${product.name} 결제 — ${site}`,
    description: product.description,
    path: `/checkout?product=${encodeURIComponent(product.id)}`,
  })}
${FONT_LINK}
<style>
:root{color-scheme:dark}
body{margin:0;background:#0b0912;color:#efeaf4}
${PRODUCTS_CSS}
${CHECKOUT_CSS}
${REFERRAL_BADGE_CSS}
${embedded ? `.co-back,.co-user-card,.co-user-edit-form,.co-reading-fields{display:none!important}
.co{padding-top:16px}.co-invite-toggle{font-size:16px!important;min-height:44px}` : ''}
</style>
<script src="https://t1.kakaocdn.net/kakao_js_sdk/2.7.4/kakao.min.js" defer></script>
<script>
window.KAKAO_JS_KEY = ${JSON.stringify(process.env.KAKAO_JS_KEY ?? '')};
</script>
${isPhotoProduct ? `<script>
(function(){
  try {
    var s = JSON.parse(sessionStorage.getItem('nb_reading') || '{}') || {};
    var b = s.보여줌 || {};
    var hasFace = ${!needsFace} || Boolean(s.face || b.face);
    var hasPalm = ${!needsPalm} || Boolean(s.palm || b.palm);
    if (!hasFace || !hasPalm) {
      var target = '/products/${encodeURIComponent(product.id)}' + (location.search || '');
      if (window.history && window.history.replaceState) {
        try { history.replaceState(null, '', target); } catch(e){}
      }
      location.replace(target);
    }
  } catch(e) {
    location.replace('/products/${encodeURIComponent(product.id)}' + (location.search || ''));
  }
})();
</script>` : ''}
</head>
<body>
<main class="co">
  <a class="co-back" href="/products/${encodeURIComponent(product.id)}">← 상품 설명 다시 보기</a>

  <section class="co-what">
    <div class="co-what-head">
      <img class="co-img" src="/img/products/${encodeURIComponent(product.id)}" alt="" onerror="this.style.display='none'">
      <div class="co-what-info">
        <h1 class="co-name">${esc(product.name)}</h1>
        <p class="co-hook">${esc(product.description)}</p>
      </div>
    </div>
    <div class="co-price"><b>${price}원</b><span>부가세 포함</span></div>
    ${priceNote(product)}
    <div class="co-invite-entry" id="coInviteEntry">
      ${product.priceKrw < INVITE_MIN_ORDER_KRW ? `
      <button type="button" class="co-invite-toggle" id="coInviteToggle">증표는 ${Math.floor(INVITE_MIN_ORDER_KRW / 10000)}만원 이상 점사에서 쓰실 수 있습니다</button>
      <div class="co-invite-fold" id="coInviteFold" style="display:none">
        <p class="co-invite-msg" style="display:block;margin:0;color:#c2b6cf;font-size:14px;line-height:1.6">
          증표는 ${Math.floor(INVITE_MIN_ORDER_KRW / 10000)}만원 이상 점사에서 쓰실 수 있습니다.
        </p>
      </div>` : `
      <div class="co-invite-bar" id="coInviteBar" style="display:flex;align-items:center;gap:8px;">
        <button type="button" class="co-invite-toggle" id="coInviteToggle">증표 있으십니까?</button>
        <button type="button" class="co-invite-remove-btn" id="coInviteRemoveBtn" style="display:none">[빼기]</button>
      </div>
      <div class="co-invite-fold" id="coInviteFold" style="display:none">
        <div class="co-invite-input-row">
          <input type="text" id="coInviteInput" placeholder="증표 코드 입력" maxlength="16" autocomplete="off">
          <button type="button" id="coInviteApplyBtn">적용</button>
        </div>
        <p class="co-invite-msg" id="coInviteMsg"></p>
      </div>`}
    </div>
  </section>

  ${form}
</main>
${footer}
${script}
<script>
(function(){
  try{
    var m = location.search.match(/[?&]ref=([a-zA-Z0-9_-]+)/);
    if(m && m[1] && !sessionStorage.getItem('nb_ref')){
      sessionStorage.setItem('nb_ref', m[1].toLowerCase().slice(0, 20));
    }
  }catch(e){}
})();
</script>
<script src="/nalja.js"></script>
</body>
</html>`;
}
