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
import { renderSocialHead } from './social.ts';
import { FONT_LINK, PRODUCTS_CSS } from './products.ts';
import type { Product } from '../../commerce/src/catalog.ts';
import { WITHDRAWAL_WINDOW_DAYS, DELIVERY_DUE_DAYS } from '../../commerce/src/refund.ts';

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
const HOURS: readonly [string, string][] = [
  ['', '모름 (낮 12시로 봅니다)'],
  ['00:30', '자시 — 밤 11:30 ~ 01:30'],
  ['02:30', '축시 — 새벽 01:30 ~ 03:30'],
  ['04:30', '인시 — 새벽 03:30 ~ 05:30'],
  ['06:30', '묘시 — 아침 05:30 ~ 07:30'],
  ['08:30', '진시 — 아침 07:30 ~ 09:30'],
  ['10:30', '사시 — 오전 09:30 ~ 11:30'],
  ['12:30', '오시 — 낮 11:30 ~ 13:30'],
  ['14:30', '미시 — 낮 13:30 ~ 15:30'],
  ['16:30', '신시 — 오후 15:30 ~ 17:30'],
  ['18:30', '유시 — 저녁 17:30 ~ 19:30'],
  ['20:30', '술시 — 밤 19:30 ~ 21:30'],
  ['22:30', '해시 — 밤 21:30 ~ 23:30'],
];

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
.co-name{font-size:19px;font-weight:800;color:#f3e5ab;margin:0 0 4px}
.co-hook{font-size:13.5px;color:#c8c2d4;margin:0 0 12px;line-height:1.6}
.co-price{display:flex;align-items:baseline;justify-content:space-between;
  border-top:1px solid rgba(255,255,255,.1);padding-top:12px}
.co-price b{font-size:22px;color:#d4af37;font-weight:800}
.co-price span{font-size:12px;color:#9a93a6}
.co-sec{margin:0 0 10px;font-size:14px;font-weight:700;color:#efe9f5}
.co-f{display:block;margin-bottom:12px}
.co-f label{display:block;font-size:13px;color:#c8c2d4;margin-bottom:5px}
.co-f input,.co-f select{width:100%;box-sizing:border-box;padding:11px 12px;font-size:16px;
  border-radius:8px;border:1px solid rgba(255,255,255,.16);background:rgba(12,10,18,.92);
  color:#f4f1f8;font-family:inherit}
.co-f input:focus,.co-f select:focus{outline:none;border-color:rgba(212,175,55,.7)}
.co-two{display:flex;gap:10px}
.co-two>*{flex:1 1 0;min-width:0}
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
      ${surname}
      ${partner}
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
      <p class="co-msg" id="coMsg"></p>
      <div id="coDone"></div>
    </form>`;

  const script = keys === null ? '' : `
<script src="https://cdn.portone.io/v2/browser-sdk.js"></script>
<script>
(function(){
  var PRODUCT = ${JSON.stringify(product.id)};
  var KEYS = ${JSON.stringify(keys)};
  var f = document.getElementById('coForm');
  var pay = document.getElementById('coPay');
  var agree = document.getElementById('coAgree');
  var msg = document.getElementById('coMsg');
  var done = document.getElementById('coDone');
  if(!f) return;

  agree.addEventListener('change', function(){ pay.disabled = !agree.checked; });

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
      set('gender', saved.birth && saved.birth.gender);
      set('surname', saved.name && saved.name.surname);
      set('partnerDate', saved.partner && saved.partner.date);
      set('partnerTime', saved.partner && saved.partner.time);
      window.__nbFace = saved.face; window.__nbPalm = saved.palm;
    }
  }catch(e){}

  var say=function(t,ok){ msg.textContent=t; msg.className='co-msg'+(ok?' ok':''); };
  var val=function(id){ var el=document.getElementById(id); return el ? el.value.trim() : ''; };

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
      birth: { date: date, time: val('birthTime') || '12:00', gender: val('gender'), name: name }
    };
    ${product.needsName ? "reading.name = { surname: val('surname') };" : ''}
    ${product.needsPartner ? "reading.partner = { date: val('partnerDate'), time: val('partnerTime') || '12:00' };" : ''}
    if(window.__nbFace) reading.face = window.__nbFace;
    if(window.__nbPalm) reading.palm = window.__nbPalm;

    pay.disabled = true;
    say('주문을 만들고 있습니다…');

    var post = async function(url, body){
      var r = await fetch(url, {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: body === undefined ? undefined : JSON.stringify(body)
      });
      var j = await r.json().catch(function(){ return {}; });
      if(!r.ok) throw new Error(j.error || ('요청이 실패했습니다 (' + r.status + ')'));
      return j;
    };

    var orderId = '';
    try{
      var created = await post('/api/orders',
        Object.assign({}, reading, { acknowledgedNotice:true, previewShown:true }));
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
      await post('/api/orders/' + orderId + '/confirm', { paymentId: (res && res.paymentId) || orderId });

      say('풀이를 짓고 있습니다. 잠시만 기다려 주십시오…');
      var r = await fetch('/api/orders/' + orderId + '/report');
      var report = await r.json();
      if(!r.ok) throw new Error(report.error || '리포트를 불러오지 못했습니다.');

      say('결제가 끝났습니다. 주문번호 ' + orderId, true);
      done.innerHTML = '<div class="co-done"></div>';
      done.firstChild.textContent = report.text || '';
      pay.style.display = 'none';
    }catch(err){
      say((err && err.message) || '결제에 실패했습니다.'
        + (orderId ? ' 주문번호 ' + orderId + ' 로 문의해 주십시오.' : ''));
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
</style>
</head>
<body>
<main class="co">
  <a class="co-back" href="/products/${encodeURIComponent(product.id)}">← 상품 설명 다시 보기</a>

  <section class="co-what">
    <h1 class="co-name">${esc(product.name)}</h1>
    <p class="co-hook">${esc(product.description)}</p>
    <div class="co-price"><b>${price}원</b><span>부가세 포함</span></div>
  </section>

  ${form}
</main>
${footer}
${script}
</body>
</html>`;
}
