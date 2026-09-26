import { CATALOG, type Order } from '../../../packages/commerce/src/index.ts';
import { type BusinessInfo } from './business.ts';
import { renderInviteBadge, REFERRAL_BADGE_CSS, REFERRAL_BADGE_SCRIPT } from './referral-badge.ts';

function esc(s: unknown): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const ORDER_CSS = `
body{margin:0;padding:0;background:#18151f;color:#f0eaf7;font-family:-apple-system,BlinkMacSystemFont,"Apple SD Gothic Neo","Pretendard","Noto Sans KR",sans-serif;line-height:1.6}
.od-main{max-width:680px;margin:0 auto;padding:24px 18px 80px}
.od-brand{display:inline-block;font-size:14px;color:#b9b2c6;text-decoration:none;margin-bottom:18px}
.od-title{font-size:22px;font-weight:800;color:#f3e5ab;margin:0 0 10px}
.od-desc{font-size:14.5px;color:#c8c2d4;margin:0 0 20px;line-height:1.65}
.od-btn{display:inline-block;padding:12px 24px;background:#d4af37;color:#18151f;text-decoration:none;font-weight:700;border-radius:8px;font-size:14px}
.od-saved-link{margin:18px 0 24px;padding:16px 18px;background:rgba(212,175,55,.08);border:1px solid rgba(212,175,55,.3);border-radius:10px}
.od-saved-title{font-size:14px;font-weight:700;color:#f3e5ab;margin:0 0 8px}
.od-copy-box{display:flex;gap:8px}
.od-copy-box input{flex:1 1 auto;background:rgba(0,0,0,.35);border:1px solid rgba(255,255,255,.15);border-radius:6px;padding:9px 12px;color:#fff;font-size:13px}
.od-copy-box button{flex:0 0 auto;background:#d4af37;color:#18151f;border:none;border-radius:6px;padding:9px 16px;font-size:13px;font-weight:700;cursor:pointer}
.od-copy-done{font-size:12.5px;color:#4ade80;margin:6px 0 0}
.od-report-box{background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.1);border-radius:12px;padding:24px 20px;margin-top:16px;white-space:pre-wrap;word-break:break-word;font-size:15px;line-height:1.8;color:#e8e2f0}
.od-order-info{font-size:12.5px;color:#9a93a6;margin-top:8px}
`;

export function renderOrderNotFoundPage(business: BusinessInfo, footer: string): string {
  const site = business.SITE_NAME || '늘봄사주';
  return `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>주문을 찾을 수 없습니다 — ${esc(site)}</title>
<style>${ORDER_CSS}
${REFERRAL_BADGE_CSS}</style>
</head>
<body>
<main class="od-main">
  <a class="od-brand" href="/">← ${esc(site)} 첫 화면</a>
  <h1 class="od-title">그런 주문이 없습니다</h1>
  <p class="od-desc">주문번호를 다시 확인해 주시거나 고객센터로 문의해 주십시오.</p>
  <a class="od-btn" href="/">첫 화면으로 가기</a>
</main>
${footer}
</body>
</html>`;
}

export function renderOrderUnpaidPage(business: BusinessInfo, footer: string, order: Order): string {
  const site = business.SITE_NAME || '늘봄사주';
  const product = CATALOG[order.productId as keyof typeof CATALOG];
  const name = product ? product.name : order.productId;
  return `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>결제 대기 — ${esc(site)}</title>
<style>${ORDER_CSS}</style>
</head>
<body>
<main class="od-main">
  <a class="od-brand" href="/">← ${esc(site)} 첫 화면</a>
  <h1 class="od-title">아직 결제가 끝나지 않았습니다</h1>
  <p class="od-desc"><b>${esc(name)}</b> 주문은 만들어졌으나, 아직 결제가 완료되지 않았습니다. 결제를 진행하시면 바로 풀이를 보실 수 있습니다.</p>
  <a class="od-btn" href="/checkout?product=${encodeURIComponent(order.productId)}">결제 화면으로 가기</a>
  <p class="od-order-info">주문번호: ${esc(order.id)}</p>
</main>
${footer}
</body>
</html>`;
}

export function renderOrderPendingReportPage(business: BusinessInfo, footer: string, order: Order): string {
  const site = business.SITE_NAME || '늘봄사주';
  return `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<meta http-equiv="refresh" content="3">
<title>풀이 작성 중 — ${esc(site)}</title>
<style>${ORDER_CSS}</style>
</head>
<body>
<main class="od-main">
  <a class="od-brand" href="/">← ${esc(site)} 첫 화면</a>
  <h1 class="od-title">풀이를 짓는 중입니다</h1>
  <p class="od-desc">결제가 정상 확인되었습니다. 리포트를 정성껏 작성하고 있으니 잠시만 기다려 주십시오. (3초마다 자동으로 확인합니다)</p>
  <p class="od-order-info">주문번호: ${esc(order.id)}</p>
</main>
${footer}
</body>
</html>`;
}

export function renderOrderReportPage(
  business: BusinessInfo,
  footer: string,
  order: Order,
  reportText: string,
  inviteCode?: string | null,
): string {
  const site = business.SITE_NAME || '늘봄사주';
  const siteUrl = (business.SITE_URL || 'https://neulbomsaju.co.kr').replace(/\/+$/, '');
  const permalink = `${siteUrl}/order/${order.id}`;
  const product = CATALOG[order.productId as keyof typeof CATALOG];
  const title = product ? product.name : '사주 리포트';

  return `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>${esc(title)} — ${esc(site)}</title>
<style>${ORDER_CSS}</style>
</head>
<body>
<main class="od-main">
  <a class="od-brand" href="/">← ${esc(site)} 첫 화면</a>
  <h1 class="od-title">${esc(title)}</h1>
  <p class="od-order-info">주문번호: ${esc(order.id)}</p>

  <div class="od-saved-link">
    <p class="od-saved-title">이 주소를 저장해 두시면 언제든 다시 보실 수 있습니다</p>
    <div class="od-copy-box">
      <input type="text" readonly value="${esc(permalink)}" id="odSavedInput">
      <button type="button" id="odCopyBtn">주소 복사</button>
    </div>
    <p class="od-copy-done" id="odCopyDone" style="display:none">주소가 복사되었습니다.</p>
  </div>

  <article class="od-report-box">${esc(reportText)}</article>
  ${inviteCode ? renderInviteBadge(inviteCode) : ''}
</main>
${footer}
<script>
(function(){
  var btn = document.getElementById('odCopyBtn');
  var inp = document.getElementById('odSavedInput');
  var msg = document.getElementById('odCopyDone');
  if(btn && inp){
    btn.onclick = function(){
      try{
        if(navigator.clipboard && navigator.clipboard.writeText){
          navigator.clipboard.writeText(inp.value);
        }else{
          inp.select();
          document.execCommand('copy');
        }
        if(msg) msg.style.display = 'block';
      }catch(e){}
    };
  }
})();
</script>
</body>
</html>`;
}
