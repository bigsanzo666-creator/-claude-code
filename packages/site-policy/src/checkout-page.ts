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

import { type BusinessInfo, show } from './business.ts';
import { PLACES } from '../../saju-rules/src/index.ts';
import { renderSocialHead } from './social.ts';
import { FONT_LINK, PRODUCTS_CSS } from './products.ts';
import { renderInviteBadge, REFERRAL_BADGE_CSS } from './referral-badge.ts';
import type { Product } from '../../commerce/src/catalog.ts';
import { WITHDRAWAL_WINDOW_DAYS, DELIVERY_DUE_DAYS } from '../../commerce/src/refund.ts';
import {
  HOLIDAY_INCLUDED_MEMBERS, HOLIDAY_EXTRA_MEMBER_KRW, HOLIDAY_MAX_MEMBERS,
} from '../../commerce/src/catalog.ts';

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
.co{max-width:560px;margin:0 auto;padding:22px 18px 60px}
.co-back{display:inline-block;color:#b9b2c6;text-decoration:none;font-size:13px;margin-bottom:14px}
.co-what{background:rgba(255,255,255,.04);border:1px solid rgba(212,175,55,.32);
  border-radius:12px;padding:16px 16px 14px;margin-bottom:18px}
.co-what-head{display:flex;gap:14px;align-items:flex-start;margin-bottom:12px}
.co-img{width:64px;height:80px;object-fit:cover;border-radius:6px;flex:0 0 64px;background:rgba(255,255,255,.05)}
.co-what-info{flex:1 1 auto;min-width:0}
.co-saved-link{margin:18px 0;padding:16px 18px;background:rgba(212,175,55,.08);border:1px solid rgba(212,175,55,.3);border-radius:10px}
.co-saved-title{font-size:14px;font-weight:700;color:#f3e5ab;margin:0 0 10px}
.co-copy-box{display:flex;gap:8px}
.co-copy-box input{flex:1 1 auto;background:rgba(0,0,0,.3);border:1px solid rgba(255,255,255,.15);border-radius:6px;padding:8px 12px;color:#fff;font-size:13px}
.co-copy-box button{flex:0 0 auto;background:#d4af37;color:#18151f;border:none;border-radius:6px;padding:8px 14px;font-size:13px;font-weight:700;cursor:pointer}
.co-copy-done{font-size:12px;color:#4ade80;margin:6px 0 0}
  border-radius:12px;padding:16px 16px 14px;margin-bottom:18px}
.co-name{font-size:19px;font-weight:800;color:#f3e5ab;margin:0 0 4px}
.co-hook{font-size:13.5px;color:#c8c2d4;margin:0 0 12px;line-height:1.6}
.co-price{display:flex;align-items:baseline;justify-content:space-between;
  border-top:1px solid rgba(255,255,255,.1);padding-top:12px}
.co-price b{font-size:22px;color:#d4af37;font-weight:800}
.co-price span{font-size:12px;color:#9a93a6}
.co-pricenote{margin:10px 0 0;font-size:12.5px;color:#c9a34a;line-height:1.55}
.co-pricenote b{color:#e8c86a}
.co-sec{margin:0 0 10px;font-size:14px;font-weight:700;color:#efe9f5}
.co-f{display:block;margin-bottom:12px}
.co-f label{display:block;font-size:13px;color:#c8c2d4;margin-bottom:5px}
.co-hint{display:block;font-size:12px;color:#b9b2c6;margin-top:6px;line-height:1.5}
.co-f input,.co-f select{width:100%;box-sizing:border-box;padding:11px 12px;font-size:16px;
  border-radius:8px;border:1px solid rgba(255,255,255,.16);background:rgba(12,10,18,.92);
  color:#f4f1f8;font-family:inherit}
.co-f input:focus,.co-f select:focus{outline:none;border-color:rgba(212,175,55,.7)}
.co-two{display:flex;gap:10px}
.co-two>*{flex:1 1 0;min-width:0}
.co-addkin{display:block;width:100%;padding:11px;margin:0 0 14px;font-size:14px;
  border-radius:8px;border:1px dashed rgba(212,175,55,.5);background:transparent;
  color:#d4af37;cursor:pointer;font-family:inherit}
.co-addkin:disabled{opacity:.4;cursor:not-allowed}
.co-kin{border:1px solid rgba(255,255,255,.12);border-radius:10px;padding:12px;margin-bottom:10px}
.co-kin-top{display:flex;justify-content:space-between;align-items:center;margin-bottom:8px}
.co-kin-top b{font-size:13px;color:#e4dfea}
.co-kin-del{background:none;border:none;color:#9a93a6;font-size:13px;cursor:pointer;font-family:inherit}
.co-note{background:rgba(12,10,18,.6);border:1px solid rgba(255,255,255,.1);
  border-radius:10px;padding:13px 14px;margin:18px 0 14px}
.co-note p{margin:0 0 7px;font-size:12.5px;color:#bdb6c8;line-height:1.65}
.co-note p:last-child{margin-bottom:0}
.co-agree{display:flex;gap:9px;align-items:flex-start;margin:0 0 16px;cursor:pointer}
.co-agree input{width:19px;height:19px;flex:0 0 auto;margin:1px 0 0;accent-color:#d4af37}
.co-agree span{font-size:13px;color:#e4dfea;line-height:1.55}
.co-pay{display:block;width:100%;padding:16px;font-size:17px;font-weight:800;
  border:none;border-radius:10px;background:linear-gradient(135deg,#d4af37,#f0d478);
  color:#1a1208;cursor:pointer;font-family:inherit}
.co-pay:disabled{background:rgba(255,255,255,.12);color:#8b8496;cursor:not-allowed}
.co-msg{margin:14px 0 0;font-size:13.5px;line-height:1.6;color:#e8b4b4;min-height:1em}
.co-msg.ok{color:#9fd8a8}
.co-soon{background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.14);
  border-radius:10px;padding:16px;font-size:14px;color:#d8d3e0;line-height:1.7}
.co-done{white-space:pre-wrap;background:rgba(12,10,18,.75);border:1px solid rgba(212,175,55,.3);
  border-radius:10px;padding:16px;margin-top:16px;font-size:14px;line-height:1.85;color:#efeaf4}
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
  if (product.id !== 'family-holiday-report') return '';
  return `<p class="co-pricenote">오픈 기념 · 추석 한정가입니다.
    <b>${HOLIDAY_REGULAR_KRW.toLocaleString('ko-KR')}원</b>으로 올라갑니다 — ${HOLIDAY_RAISE_ON}부터</p>`;
}

/** 연휴가 끝나면 올릴 값. 실제로 이 값으로 올려야 한다 */
export const HOLIDAY_REGULAR_KRW = 39900;
/** 값을 올리는 날 */
export const HOLIDAY_RAISE_ON = '9월 28일';

export interface CheckoutKeys { storeId: string; channelKey: string }

/**
 * @param product 살 상품. 값과 이름은 여기서만 온다
 * @param keys 결제사 열쇠. 결제가 아직 안 켜졌으면 `null`
 */
export function renderCheckoutPage(
  info: BusinessInfo, footer: string, product: Product, keys: CheckoutKeys | null,
): string {
  const site = show(info, 'serviceName', '서비스 이름');
  const price = product.priceKrw.toLocaleString('ko-KR');

  const partner = product.needsPartner ? `
    <p class="co-sec">상대의 생년월일</p>
    <div class="co-f"><label for="partnerDate">상대 생년월일</label>
      <input type="date" name="partnerDate" id="partnerDate" required></div>
    <div class="co-f"><label for="partnerTime">상대가 태어난 시간</label>
      ${hourOptions('partnerTime')}</div>` : '';

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
      <input type="text" name="surname" id="surname" maxlength="4" required></div>` : '';

  const faceNote = product.needsFace ? `
    <p class="co-sec">얼굴·손 사진</p>
    <div class="co-note"><p>이 상품은 얼굴과 손 사진에서 읽은 특징이 함께 들어갑니다.
    신령 처소에서 사진을 올리고 오시면 그 특징이 그대로 실립니다.
    사진 없이 결제하시면 사주 부분만 담겨 나갑니다.</p></div>` : '';

  const form = keys === null ? `
    <div class="co-soon"><b>결제 준비 중입니다.</b><br>
    사주 명식·궁합·관상·손금 풀이는 지금도 값 없이 보실 수 있습니다.</div>` : `
    <form id="coForm" novalidate>
      <div id="coFields">
      <p class="co-sec">누가 보시는 것인가</p>
      <div class="co-f"><label for="buyerName">성함</label>
        <input type="text" name="buyerName" id="buyerName" autocomplete="name" required></div>
      <div class="co-two">
        <div class="co-f"><label for="birthDate">생년월일</label>
          <input type="date" name="birthDate" id="birthDate" required></div>
        <div class="co-f"><label for="gender">성별</label>
          <select name="gender" id="gender"><option value="남">남</option><option value="여">여</option></select></div>
      </div>
      <div class="co-f"><label for="birthTime">태어난 시간</label>${hourOptions('birthTime')}</div>
      <div class="co-f"><label for="birthPlace">태어난 곳</label>${placeOptions('birthPlace')}
        <span class="co-hint">태어난 곳에 따라 시(時)가 갈릴 수 있어 여쭙습니다</span></div>
      ${surname}
      ${partner}
      ${family}
      ${faceNote}

      <p class="co-sec">받으실 곳</p>
      <div class="co-f"><label for="email">이메일</label>
        <input type="email" name="email" id="email" autocomplete="email" required></div>
      <div class="co-f"><label for="phone">휴대전화</label>
        <input type="tel" name="phone" id="phone" autocomplete="tel" placeholder="01012345678" required></div>

      <div class="co-note">
        <p>이 상품은 디지털콘텐츠입니다. 결제하시면 <b>바로</b> 보실 수 있고,
        늦어도 ${DELIVERY_DUE_DAYS}일 이내에 드립니다.</p>
        <p>결제 후 ${WITHDRAWAL_WINDOW_DAYS}일 이내이고 리포트를 열람하지 않으셨다면
        전액 돌려드립니다. <b>리포트 전문을 열람하신 뒤에는 청약철회가 제한됩니다.</b></p>
        <p>이름·생년월일·이메일·휴대전화는 리포트를 만들어 보내 드리는 데에만 씁니다.</p>
      </div>

      <label class="co-agree">
        <input type="checkbox" id="coAgree">
        <span>위 안내를 읽었고, 리포트 전문을 열람하면 청약철회가 제한된다는 점에 동의합니다.</span>
      </label>

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
  var BASE_KRW = ${product.priceKrw};
  var FREE_UPTO = ${HOLIDAY_INCLUDED_MEMBERS};
  var EXTRA_KRW = ${HOLIDAY_EXTRA_MEMBER_KRW};
  var MAX_MEMBERS = ${HOLIDAY_MAX_MEMBERS};
  var NEEDS_FAMILY = ${product.needsFamily === true};
  var HOUR_OPTIONS = ${JSON.stringify(HOURS)};
  var KEYS = ${JSON.stringify(keys)};
  var f = document.getElementById('coForm');
  var pay = document.getElementById('coPay');
  var agree = document.getElementById('coAgree');
  var msg = document.getElementById('coMsg');
  var done = document.getElementById('coDone');
  if(!f) return;

  function say(t, ok){
    if(msg){
      msg.textContent = t;
      msg.className = 'co-msg' + (ok ? ' ok' : '');
    }
  }
  function val(id){
    var el = document.getElementById(id);
    return el ? el.value.trim() : '';
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

  agree.addEventListener('change', function(){ pay.disabled = !agree.checked; });

  
  /* invite tracking */
  try{
    var mi = location.search.match(/[?&]invite=([a-zA-Z0-9]+)/);
    if(mi && mi[1]){
      sessionStorage.setItem('nb_invite', mi[1].toLowerCase().slice(0, 12));
    }
  }catch(e){}

  /* ref tracking */
  try{
    var m = location.search.match(/[?&]ref=([a-zA-Z0-9_-]+)/);
    if(m && m[1] && !sessionStorage.getItem('nb_ref')){
      sessionStorage.setItem('nb_ref', m[1].toLowerCase().slice(0, 20));
    }
  }catch(e){}

  function showReport(oid, reportText, inviteCode){
    say('결제가 끝났습니다. 주문번호 ' + oid, true);
    var link = location.origin + '/order/' + oid;
    var inviteHtml = inviteCode ? (
      '<div class="nb-invite-box">' +
        '<div class="nb-invite-head">벗에게 알려주게</div>' +
        '<div class="nb-invite-code">그대의 증표 — <b>' + inviteCode + '</b></div>' +
        '<p class="nb-invite-desc">이 증표로 들어온 벗은 3,000원을 덜 낸다네.<br>벗이 첫 점사를 받으면, 그대에게도 보답이 있을 것이야.</p>' +
        '<div class="nb-invite-actions">' +
          '<button type="button" class="nb-invite-btn" id="nbCopyInviteBtn" data-code="' + inviteCode + '">증표 복사하기</button>' +
          '<button type="button" class="nb-invite-btn kakao" id="nbKakaoInviteBtn" data-code="' + inviteCode + '">카톡으로 보내기</button>' +
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
    '<div class="co-done">' + (reportText || '') + '</div>' + inviteHtml;
    done.innerHTML = html;

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
          var text = [
            '벗에게 알려주게',
            '그대의 증표 — ' + inviteCode,
            '이 증표로 들어온 벗은 3,000원을 덜 낸다네.',
            '벗이 첫 점사를 받으면, 그대에게도 보답이 있을 것이야.',
            invLink
          ].join(String.fromCharCode(10));
          if(navigator.share){ navigator.share({ title: '늘봄사주 벗의 증표', text: text, url: invLink }).catch(function(){}); }
          else { invCopyBtn.click(); }
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
            try{
              say('결제를 확인하고 있습니다…');
              var pid = q.get('paymentId') || resumeId;
              await post('/api/orders/' + encodeURIComponent(resumeId) + '/confirm', { paymentId: pid });
              say('풀이를 짓고 있습니다. 잠시만 기다려 주십시오…');
              var r = await fetch('/api/orders/' + encodeURIComponent(resumeId) + '/report');
              var report = await r.json();
              if(!r.ok) throw new Error(report.error || '리포트를 불러오지 못했습니다.');
              showReport(resumeId, report.text, report.inviteCode || (report.order && report.order.inviteCode));
            }catch(err){
              console.log('[결제 확인 실패]', err);
              say('결제 확인에 실패했습니다. 주문번호 ' + resumeId + ' 로 문의해 주십시오. 결제는 완료되었을 수 있습니다.');
              var retry = document.getElementById('coRetry');
              if(retry) retry.style.display = 'block';
            }
          })();
        }
      }
    }catch(e){}
  })();


  /*
   * 신령 처소에서 이미 적은 것이 있으면 그대로 채운다.
   * 사겠다고 누른 손님에게 같은 것을 두 번 묻지 않는다.
   */
  try{
    var saved = JSON.parse(sessionStorage.getItem('nb_reading')||'null');
    if(saved && saved.productId === PRODUCT){
      var set=function(id,v){ var el=document.getElementById(id); if(el&&v) el.value=v; };
      set('buyerName', saved.birth && saved.birth.name);
      set('birthDate', saved.birth && saved.birth.date);
      set('birthTime', saved.birth && saved.birth.time);
      set('birthPlace', saved.birth && saved.birth.place);
      set('gender', saved.birth && saved.birth.gender);
      set('surname', saved.name && saved.name.surname);
      set('partnerDate', saved.partner && saved.partner.date);
      set('partnerTime', saved.partner && saved.partner.time);
      window.__nbFace = saved.face; window.__nbPalm = saved.palm;
    }
  }catch(e){}

  /*
   * 한 상에 앉는 사람을 넣고 빼는 자리.
   *
   * 사람이 늘 때마다 **결제 단추의 값이 그 자리에서 바뀐다.** 다 적고 나서
   * 값이 올라 있으면 손님은 속았다고 느낀다. 화면이 계산한 값은 보여 주기만
   * 하고, 실제로 받는 값은 서버가 사람 수를 직접 세어 다시 정한다.
   */
  var kinBox = document.getElementById('coFamily');
  var addKin = document.getElementById('coAddKin');
  var won = function(n){ return n.toLocaleString('ko-KR'); };

  function kinCount(){ return kinBox ? kinBox.querySelectorAll('.co-kin').length : 0; }
  function priceNow(){
    var people = Math.min(1 + kinCount(), MAX_MEMBERS);
    return BASE_KRW + Math.max(0, people - FREE_UPTO) * EXTRA_KRW;
  }
  function refreshPrice(){
    var p = priceNow();
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
      if(p >= 20000){
        discount = 3000;
        noteEl.style.color = '#9fd8a8';
        noteEl.textContent = '깎는 이유: 벗의 증표 (-3,000원)';
      }else{
        discount = 0;
        noteEl.style.color = '#f0c080';
        noteEl.textContent = '2만원 이상 점사에 쓸 수 있는 증표입니다';
      }
    }
    var finalP = Math.max(0, p - discount);
    pay.textContent = won(finalP) + '원 결제하기';
    var tag = document.querySelector('.co-price b');
    if(tag) tag.textContent = won(finalP) + '원';
    if(addKin && NEEDS_FAMILY) addKin.disabled = (1 + kinCount()) >= MAX_MEMBERS;
  }
  refreshPrice();
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
    if(!kinBox) return [];
    return [].map.call(kinBox.querySelectorAll('.co-kin'), function(r){
      return {
        relation: r.querySelector('.kin-rel').value.trim() || '가족',
        date: r.querySelector('.kin-date').value,
        time: r.querySelector('.kin-time').value || '12:00'
      };
    }).filter(function(f){ return !!f.date; });
  }
  if(addKin) addKin.addEventListener('click', function(){ addRow(null); });
  if(NEEDS_FAMILY && kinBox && !kinCount()) addRow(null);



  f.addEventListener('submit', async function(ev){
    ev.preventDefault();
    if(!agree.checked) return;

    var name = val('buyerName'), date = val('birthDate');
    var email = val('email'), phone = val('phone').replace(/[^0-9]/g,'');
    if(!name) return say('성함을 적어 주십시오.');
    if(!date) return say('생년월일을 적어 주십시오.');
    if(!/^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$/.test(email)) return say('이메일을 다시 확인해 주십시오.');
    if(phone.length < 10) return say('휴대전화 번호를 다시 확인해 주십시오.');
    ${product.needsName ? "if(!val('surname')) return say('아이의 성을 적어 주십시오.');" : ''}
    ${product.needsPartner ? "if(!val('partnerDate')) return say('상대의 생년월일을 적어 주십시오.');" : ''}

    var reading = {
      productId: PRODUCT,
      birth: { date: date, time: val('birthTime') || '12:00', place: val('birthPlace') || '서울', gender: val('gender'), name: name }
    };
    ${product.needsName ? "reading.name = { surname: val('surname') };" : ''}
    ${product.needsPartner ? "reading.partner = { date: val('partnerDate'), time: val('partnerTime') || '12:00' };" : ''}
    if(NEEDS_FAMILY){
      var kin = readFamily();
      if(!kin.length) return say('같이 보실 분을 한 분 이상 넣어 주십시오.');
      reading.family = kin;
    }
    if(window.__nbFace) reading.face = window.__nbFace;
    if(window.__nbPalm) reading.palm = window.__nbPalm;

    pay.disabled = true;
    say('주문을 만들고 있습니다…');



    var orderId = '';
    try{
      var adRef = (function(){
        try { return sessionStorage.getItem('nb_ref') || undefined; } catch(e){ return undefined; }
      })();
      var userInvite = (function(){ try { return sessionStorage.getItem('nb_invite') || undefined; } catch(e){ return undefined; } })();
      var created = await post('/api/orders',
        Object.assign({}, reading, { acknowledgedNotice:true, previewShown:true, ref: adRef, email: email, invite: userInvite }));
      orderId = created.order.id;

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
        /*
         * 결제사가 내미는 말을 손님에게 그대로 보이지 않는다.
         * 「5 NOT_FOUND: {"code":"RECORD_NOT_FOUND"...}」 같은 글을 받은 손님은
         * 자기가 뭘 잘못한 줄 안다. 자세한 것은 개발자 창에만 남긴다.
         */
        console.log('[결제창]', e);
        throw new Error('결제창을 여는 데 실패했습니다. 잠시 뒤 다시 눌러 주십시오.');
      }
      if(res && res.code !== undefined){
        console.log('[결제 결과]', res);
        throw new Error('결제가 완료되지 않았습니다. 다시 눌러 주십시오.');
      }

      say('결제를 확인하고 있습니다…');
      var cf = await post('/api/orders/' + orderId + '/confirm', { paymentId: (res && res.paymentId) || orderId });

      say('풀이를 짓고 있습니다. 잠시만 기다려 주십시오…');
      var r = await fetch('/api/orders/' + orderId + '/report');
      var report = await r.json();
      if(!r.ok) throw new Error(report.error || '리포트를 불러오지 못했습니다.');

      showReport(orderId, report.text, (cf && cf.inviteCode) || (report.order && report.order.inviteCode));
      pay.style.display = 'none';
    }catch(err){
      console.log('[결제 실패]', err);
      if(err && (err.message === '결제가 완료되지 않았습니다. 다시 눌러 주십시오.' || err.message === '결제창을 여는 데 실패했습니다. 잠시 뒤 다시 눌러 주십시오.')){
        say(err.message);
      }else if(orderId){
        say('결제 확인에 실패했습니다. 주문번호 ' + orderId + ' 로 문의해 주십시오. 결제는 완료되었을 수 있습니다.');
      }else{
        say('결제에 실패했습니다. 잠시 뒤 다시 시도해 주십시오.');
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
</style>
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
</body>
</html>`;
}
