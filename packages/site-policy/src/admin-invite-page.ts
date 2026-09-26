/**
 * 사장님 관리 화면 (GET /admin/invite).
 *
 * 검색 금지 (noindex, nofollow).
 * ADMIN_TOKEN 으로만 접근 가능하며 토큰이 없거나 불일치 시 404 처리.
 */

import { type BusinessInfo, show } from './business.ts';
import { FONT_LINK, PRODUCTS_CSS } from './products.ts';

const ADMIN_CSS = `
.ad-wrap { max-width: 860px; margin: 0 auto; padding: 32px 20px 80px; font-family: -apple-system, BlinkMacSystemFont, "Apple SD Gothic Neo", "Pretendard", "Noto Sans KR", sans-serif; }
.ad-brand { display: inline-block; font-size: 14px; color: #b9b2c6; text-decoration: none; margin-bottom: 18px; }
.ad-title { font-size: 24px; font-weight: 800; color: #f3e5ab; margin: 0 0 6px; }
.ad-sub { font-size: 14px; color: #a49cb2; margin: 0 0 28px; }
.ad-sec { font-size: 18px; font-weight: 800; color: #f3e5ab; margin: 32px 0 14px; }
.ad-card { background: rgba(255, 255, 255, 0.03); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 12px; overflow-x: auto; margin-bottom: 24px; }
.ad-tbl { width: 100%; border-collapse: collapse; text-align: left; font-size: 13.5px; }
.ad-tbl th { background: rgba(255, 255, 255, 0.05); padding: 12px 16px; color: #d4af37; font-weight: 700; border-bottom: 1px solid rgba(255, 255, 255, 0.1); }
.ad-tbl td { padding: 14px 16px; border-bottom: 1px solid rgba(255, 255, 255, 0.06); color: #efeaf4; }
.ad-tbl tr:last-child td { border-bottom: none; }
.ad-btn { padding: 6px 12px; font-size: 12.5px; font-weight: 700; border-radius: 6px; cursor: pointer; border: none; font-family: inherit; margin-right: 6px; }
.ad-btn.grant { background: #9fd8a8; color: #0f2d14; }
.ad-btn.reject { background: #e8b4b4; color: #3b1111; }
.ad-empty { padding: 32px; text-align: center; color: #8a8296; font-size: 14px; }
`;

export interface RewardRequestView {
  id: string;
  ownerEmail: string;
  referralCount: number;
  tier: number;
  kind: string;
  createdAt: string;
}

export interface ReferrerRankView {
  email: string;
  count: number;
}

export function renderAdminInvitePage(
  info: BusinessInfo,
  footer: string,
  token: string,
  requests: RewardRequestView[],
  topReferrers: ReferrerRankView[],
): string {
  const site = show(info, 'serviceName', '늘봄사주');

  const reqRows = requests.length === 0
    ? '<tr><td colspan="5" class="ad-empty">신청이 들어온 보답이 없습니다.</td></tr>'
    : requests.map((r) => `
      <tr id="req-${r.id}">
        <td><b>${r.ownerEmail}</b></td>
        <td>${r.referralCount}명</td>
        <td><span style="color:#f6d878;font-weight:700">${r.kind}</span> (${r.tier}명 보답)</td>
        <td>${r.createdAt.slice(0, 16).replace('T', ' ')}</td>
        <td>
          <button type="button" class="ad-btn grant" onclick="reviewReward('${r.id}', '내줌')">내줬음</button>
          <button type="button" class="ad-btn reject" onclick="reviewReward('${r.id}', '거절')">거절</button>
        </td>
      </tr>
    `).join('');

  const rankRows = topReferrers.length === 0
    ? '<tr><td colspan="3" class="ad-empty">아직 집계된 소개 내역이 없습니다.</td></tr>'
    : topReferrers.map((ref, idx) => `
      <tr>
        <td style="color:#d4af37;font-weight:700">${idx + 1}위</td>
        <td>${ref.email}</td>
        <td><b>${ref.count}명</b></td>
      </tr>
    `).join('');

  return `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>소개 보답 관리 — ${site}</title>
${FONT_LINK}
<style>
:root { color-scheme: dark; }
body { margin: 0; background: #0b0912; color: #efeaf4; }
${PRODUCTS_CSS}
${ADMIN_CSS}
</style>
</head>
<body>
<main class="ad-wrap">
  <a class="ad-brand" href="/">← ${site} 첫 화면</a>
  <h1 class="ad-title">소개 보답 관리 (사장님)</h1>
  <p class="ad-sub">신청된 보답을 확인하고 처리합니다.</p>

  <h2 class="ad-sec">신청이 들어온 보답 목록 (${requests.length}건)</h2>
  <div class="ad-card">
    <table class="ad-tbl">
      <thead>
        <tr>
          <th>신청자</th>
          <th>소개 실적</th>
          <th>신청 보답</th>
          <th>신청 일시</th>
          <th>처리</th>
        </tr>
      </thead>
      <tbody>
        ${reqRows}
      </tbody>
    </table>
  </div>

  <h2 class="ad-sec">소개 많이 한 분들</h2>
  <div class="ad-card">
    <table class="ad-tbl">
      <thead>
        <tr>
          <th style="width:70px">순위</th>
          <th>이메일</th>
          <th style="width:120px">유효 소개수</th>
        </tr>
      </thead>
      <tbody>
        ${rankRows}
      </tbody>
    </table>
  </div>
</main>
${footer}

<script>
var TOKEN = ${JSON.stringify(token)};
async function reviewReward(id, status){
  if(!confirm(status + ' 처리하시겠습니까?')) return;
  try {
    var r = await fetch('/api/admin/invite/reward/review', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: id, status: status, token: TOKEN })
    });
    var j = await r.json().catch(function(){ return {}; });
    if(!r.ok) throw new Error(j.error || '처리 실패');
    alert(status + ' 처리 완료되었습니다.');
    var row = document.getElementById('req-' + id);
    if(row) row.remove();
  } catch(e) {
    alert(e.message);
  }
}
</script>
</body>
</html>`;
}
