/**
 * 메타 픽셀(Meta Pixel) 및 전환 이벤트 도우미.
 *
 * 1) 환경 변수 `META_PIXEL_ID` 가 비어 있으면 아무 코드도 내보내지 않는다 (꺼진 상태가 기본).
 * 2) 보내는 이벤트는 오직 3개뿐이다:
 *    - 무료 사주 명식 결과를 봤을 때: `Lead`
 *    - 결제 화면에 들어갔을 때: `InitiateCheckout` (`content_name`, `value`, `currency: 'KRW'`)
 *    - 결제가 끝났을 때: `Purchase` (`value`, `currency: 'KRW'`, `{ eventID: order.id }`)
 * 3) 금액은 서버가 계산한 실제 금액만 쓰며, 손으로 적지 않는다.
 * 4) 개인정보(이름·생년월일·태어난 시각·성별·이메일·전화번호)는 절대 메타로 보내지 않는다.
 * 5) 같은 주문 번호(`order.id`)에 대해서는 새로고침해도 `Purchase` 가 한 번만 나가도록
 *    브라우저 저장소(`localStorage` / `sessionStorage`)와 인메모리 가드로 중복을 막는다.
 */

export function getMetaPixelId(env: NodeJS.ProcessEnv = process.env): string {
  const raw = (env.META_PIXEL_ID ?? '').trim();
  // 픽셀 ID는 숫자나 안전한 영숫자 식별자만 허용한다
  if (!raw || !/^[a-zA-Z0-9_-]{3,40}$/.test(raw)) return '';
  return raw;
}

/**
 * `<head>` 에 꽂는 메타 픽셀 기본 코드와 안전한 전환 호출 도우미(`window.__NB_META_TRACK__`).
 * `META_PIXEL_ID` 가 없으면 빈 문자열(`""`)을 돌려준다.
 */
export function renderMetaPixelHead(env: NodeJS.ProcessEnv = process.env): string {
  const pixelId = getMetaPixelId(env);
  if (!pixelId) return '';

  return `<script>
!function(f,b,e,v,n,t,s)
{if(f.fbq)return;n=f.fbq=function(){n.callMethod?
n.callMethod.apply(n,arguments):n.queue.push(arguments)};
if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
n.queue=[];t=b.createElement(e);t.async=!0;
t.src=v;s=b.getElementsByTagName(e)[0];
s.parentNode.insertBefore(t,s)}(window, document,'script',
'https://connect.facebook.net/en_US/fbevents.js');
fbq('init', ${JSON.stringify(pixelId)});
fbq('track', 'PageView');
(function(){
  var sentMap = {};
  function hasOnceKey(k){
    if(sentMap[k]) return true;
    try{ if(localStorage.getItem(k) === '1') return true; }catch(e){}
    try{ if(sessionStorage.getItem(k) === '1') return true; }catch(e){}
    return false;
  }
  function markOnceKey(k){
    sentMap[k] = true;
    try{ localStorage.setItem(k, '1'); }catch(e){}
    try{ sessionStorage.setItem(k, '1'); }catch(e){}
  }
  window.__NB_META_LEAD__ = function(){
    if(typeof window.fbq !== 'function') return false;
    window.fbq('track', 'Lead');
    return true;
  };
  window.__NB_META_CHECKOUT__ = function(contentName, valueKrw){
    if(typeof window.fbq !== 'function') return false;
    window.fbq('track', 'InitiateCheckout', {
      content_name: String(contentName || ''),
      value: Number(valueKrw) || 0,
      currency: 'KRW'
    });
    return true;
  };
  window.__NB_META_PURCHASE__ = function(orderId, valueKrw){
    if(!orderId || typeof window.fbq !== 'function') return false;
    var key = 'nb_pixel_purchase_' + String(orderId);
    if(hasOnceKey(key)) return false;
    markOnceKey(key);
    window.fbq('track', 'Purchase', {
      value: Number(valueKrw) || 0,
      currency: 'KRW'
    }, { eventID: String(orderId) });
    return true;
  };
})();
</script>`;
}

/**
 * 결제 화면(`/checkout`) 진입 시 `InitiateCheckout` 을 쏘는 스크립트 조각.
 * `META_PIXEL_ID` 가 없으면 빈 문자열(`""`)을 돌려준다.
 */
export function renderMetaInitiateCheckoutScript(
  productName: string,
  amountKrw: number,
  env: NodeJS.ProcessEnv = process.env,
): string {
  const pixelId = getMetaPixelId(env);
  if (!pixelId) return '';
  return `<script>
(function(){
  try {
    var q = new URLSearchParams(location.search);
    if (q.get('resume')) return;
    if (typeof window.__NB_META_CHECKOUT__ === 'function') {
      window.__NB_META_CHECKOUT__(${JSON.stringify(productName)}, ${Number(amountKrw) || 0});
    } else if (typeof window.fbq === 'function') {
      window.fbq('track', 'InitiateCheckout', {
        content_name: ${JSON.stringify(productName)},
        value: ${Number(amountKrw) || 0},
        currency: 'KRW'
      });
    }
  } catch(e) {}
})();
</script>`;
}

/**
 * 주문 완료/리포트 화면(`/order/:id`)에서 `Purchase` 를 중복 없이 한 번만 쏘는 스크립트 조각.
 * `META_PIXEL_ID` 가 없으면 빈 문자열(`""`)을 돌려준다.
 */
export function renderMetaPurchaseScript(
  orderId: string,
  amountKrw: number,
  env: NodeJS.ProcessEnv = process.env,
): string {
  const pixelId = getMetaPixelId(env);
  if (!pixelId) return '';
  return `<script>
(function(){
  try {
    if (typeof window.__NB_META_PURCHASE__ === 'function') {
      window.__NB_META_PURCHASE__(${JSON.stringify(orderId)}, ${Number(amountKrw) || 0});
    }
  } catch(e) {}
})();
</script>`;
}
