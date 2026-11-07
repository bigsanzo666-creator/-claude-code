/**
 * 관리자용 퍼널 숫자 화면 (GET /admin/funnel).
 *
 * 검색 금지 (noindex, nofollow).
 * ADMIN_TOKEN 또는 OWNER_PASS 로만 접근 가능하며 불일치 시 404 처리.
 * 기간(시작일·끝일, 한국 시각 KST)을 고르고 「보기」를 누르면 그때만 계산한다.
 * 자동 갱신이나 주기 계산(setInterval, meta refresh 등)은 일절 두지 않는다.
 * 개인정보(이름·생년월일·이메일)는 이 화면에 절대 나오지 않고 오직 집계 숫자만 보여준다.
 */

import { type Order } from '../../commerce/src/index.ts';
import { type BusinessInfo, show } from './business.ts';
import { FONT_LINK, PRODUCTS_CSS } from './products.ts';

export interface FreeReadingLogItem {
  id: string;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  utmContent: string | null;
  fbclid: string | null;
  utmFirstSeenAt: string | null;
  createdAt: string;
}

export interface FunnelRowMetrics {
  key: string;
  freeReadings: number;
  firstOrders: number;
  firstRevenueKrw: number;
  upsellWithin12h: number;
  upsellAfter12h: number;
  monthPassOrders: number;
  inviteUsedOrders: number;
  totalRevenueKrw: number;
}

export interface FunnelReportData {
  startKst: string;
  endKst: string;
  dbUnavailable?: boolean;
  dbNotice?: string;
  total: FunnelRowMetrics;
  byContent: FunnelRowMetrics[];
  byCampaign: FunnelRowMetrics[];
}

function emptyRow(key: string): FunnelRowMetrics {
  return {
    key,
    freeReadings: 0,
    firstOrders: 0,
    firstRevenueKrw: 0,
    upsellWithin12h: 0,
    upsellAfter12h: 0,
    monthPassOrders: 0,
    inviteUsedOrders: 0,
    totalRevenueKrw: 0,
  };
}

/**
 * 한국 시각(KST, UTC+9) 날짜 문자열 `YYYY-MM-DD` 를 UTC 타임스탬프 범위로 바꾼다.
 */
export function parseKstDateRange(startKst?: string | null, endKst?: string | null, now = new Date()): {
  startStr: string;
  endStr: string;
  startMs: number;
  endMs: number;
} {
  const kstNow = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  const todayStr = kstNow.toISOString().slice(0, 10);
  const sevenDaysAgo = new Date(kstNow.getTime() - 6 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const validDate = (s?: string | null) => (s && /^\d{4}-\d{2}-\d{2}$/.test(s.trim()) ? s.trim() : null);
  let s = validDate(startKst) ?? sevenDaysAgo;
  let e = validDate(endKst) ?? todayStr;
  if (s > e) {
    const tmp = s;
    s = e;
    e = tmp;
  }

  const startMs = Date.parse(`${s}T00:00:00+09:00`);
  const endMs = Date.parse(`${e}T23:59:59.999+09:00`);
  return { startStr: s, endStr: e, startMs, endMs };
}

const PAID_STATUSES = new Set(['paid', 'fulfilled', 'viewed']);

export function computeFunnelMetrics(
  orders: Order[],
  freeReadings: FreeReadingLogItem[],
  startKst?: string | null,
  endKst?: string | null,
  options?: { dbUnavailable?: boolean; dbNotice?: string },
): FunnelReportData {
  const { startStr, endStr, startMs, endMs } = parseKstDateRange(startKst, endKst);
  const total = emptyRow('전체');
  const contentMap = new Map<string, FunnelRowMetrics>();
  const campaignMap = new Map<string, FunnelRowMetrics>();

  const getContentRow = (raw?: string | null) => {
    const k = (raw && raw.trim()) ? raw.trim() : '(미지정)';
    let row = contentMap.get(k);
    if (!row) {
      row = emptyRow(k);
      contentMap.set(k, row);
    }
    return row;
  };

  const getCampaignRow = (raw?: string | null) => {
    const k = (raw && raw.trim()) ? raw.trim() : '(미지정)';
    let row = campaignMap.get(k);
    if (!row) {
      row = emptyRow(k);
      campaignMap.set(k, row);
    }
    return row;
  };

  for (const fr of freeReadings) {
    const ts = Date.parse(fr.createdAt);
    if (Number.isNaN(ts) || ts < startMs || ts > endMs) continue;
    total.freeReadings++;
    getContentRow(fr.utmContent).freeReadings++;
    getCampaignRow(fr.utmCampaign).freeReadings++;
  }

  for (const ord of orders) {
    if (!PAID_STATUSES.has(ord.status)) continue;
    // 주인 통과(0원 테스트 열람)는 실제 손님 결제가 아니므로 매출·결제 수에서 제외한다
    if (ord.rewardUsed === '주인 통과') continue;

    const paidTimeStr = ord.paidAt || ord.createdAt;
    const ts = Date.parse(paidTimeStr);
    if (Number.isNaN(ts) || ts < startMs || ts > endMs) continue;

    const amt = Math.max(0, Number(ord.amountKrw) || 0);
    const reward = String(ord.rewardUsed ?? '');
    const isUpsell12h = reward === '12시간 한정 이어사기';
    const isUpsellAfter = reward === '이어사기 특별 할인' || reward === '이어사기 묶음 차액';
    const isUpsell = isUpsell12h || isUpsellAfter;
    const isMonthPass = ord.productId === 'month-report';
    const hasInvite = Boolean(ord.inviteCode && ord.inviteCode.trim());

    const applyToRow = (row: FunnelRowMetrics) => {
      if (isUpsell12h) {
        row.upsellWithin12h++;
      } else if (isUpsellAfter) {
        row.upsellAfter12h++;
      } else {
        row.firstOrders++;
        row.firstRevenueKrw += amt;
      }
      if (isMonthPass) {
        row.monthPassOrders++;
      }
      if (hasInvite) {
        row.inviteUsedOrders++;
      }
      row.totalRevenueKrw += amt;
    };

    applyToRow(total);
    applyToRow(getContentRow(ord.utmContent));
    applyToRow(getCampaignRow(ord.utmCampaign));
  }

  const sortRows = (rows: FunnelRowMetrics[]) =>
    rows.sort((a, b) => {
      if (a.key === '(미지정)' && b.key !== '(미지정)') return 1;
      if (b.key === '(미지정)' && a.key !== '(미지정)') return -1;
      return b.totalRevenueKrw - a.totalRevenueKrw || b.freeReadings - a.freeReadings || a.key.localeCompare(b.key);
    });

  return {
    startKst: startStr,
    endKst: endStr,
    dbUnavailable: options?.dbUnavailable,
    dbNotice: options?.dbNotice,
    total,
    byContent: sortRows(Array.from(contentMap.values())),
    byCampaign: sortRows(Array.from(campaignMap.values())),
  };
}

function esc(s: string): string {
  return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));
}

function won(n: number): string {
  return `${Number(n || 0).toLocaleString('ko-KR')}원`;
}

function buildMarkdownSection(title: string, labelHeader: string, rows: FunnelRowMetrics[]): string {
  const lines = [
    `### ${title}`,
    `| ${labelHeader} | 무료 사주 명식 본 수 | 첫 결제 수 | 첫 결제 금액 합 | 이어사기(12시간 안) | 이어사기(12시간 뒤) | 월운세 이용권 결제 수 | 소개 코드 사용 수 | 총 매출 |`,
    `|---|---:|---:|---:|---:|---:|---:|---:|---:|`,
  ];
  if (rows.length === 0) {
    lines.push(`| (기록 없음) | 0 | 0 | 0원 | 0 | 0 | 0 | 0 | 0원 |`);
  } else {
    for (const r of rows) {
      lines.push(
        `| ${r.key} | ${r.freeReadings} | ${r.firstOrders} | ${won(r.firstRevenueKrw)} | ${r.upsellWithin12h} | ${r.upsellAfter12h} | ${r.monthPassOrders} | ${r.inviteUsedOrders} | ${won(r.totalRevenueKrw)} |`,
      );
    }
  }
  return lines.join('\n');
}

function buildCsvText(report: FunnelReportData): string {
  const header = '구분,분류값,무료 사주 명식 본 수,첫 결제 수,첫 결제 금액 합(원),이어사기 결제 수(12시간 안),이어사기 결제 수(12시간 뒤),월운세 이용권 결제 수,소개 코드 사용 수,총 매출(원)';
  const toCsvLine = (group: string, r: FunnelRowMetrics) => {
    const safeKey = `"${String(r.key).replace(/"/g, '""')}"`;
    return [
      group,
      safeKey,
      r.freeReadings,
      r.firstOrders,
      r.firstRevenueKrw,
      r.upsellWithin12h,
      r.upsellAfter12h,
      r.monthPassOrders,
      r.inviteUsedOrders,
      r.totalRevenueKrw,
    ].join(',');
  };
  const lines = [header, toCsvLine('전체', report.total)];
  for (const r of report.byContent) lines.push(toCsvLine('utm_content(소재)', r));
  for (const r of report.byCampaign) lines.push(toCsvLine('utm_campaign(캠페인)', r));
  return lines.join('\n');
}

const FUNNEL_CSS = `
.fn-wrap { max-width: 1080px; margin: 0 auto; padding: 32px 20px 80px; font-family: -apple-system, BlinkMacSystemFont, "Apple SD Gothic Neo", "Pretendard", "Noto Sans KR", sans-serif; }
.fn-brand { display: inline-block; font-size: 14px; color: #b9b2c6; text-decoration: none; margin-bottom: 16px; }
.fn-title { font-size: 26px; font-weight: 800; color: #f3e5ab; margin: 0 0 6px; }
.fn-sub { font-size: 14px; color: #b5adc4; margin: 0 0 24px; line-height: 1.6; }
.fn-alert { background: rgba(249, 115, 22, 0.14); border: 1px solid rgba(249, 115, 22, 0.45); color: #fed7aa; padding: 14px 18px; border-radius: 10px; margin-bottom: 22px; font-size: 14px; font-weight: 600; }
.fn-filter { display: flex; flex-wrap: wrap; gap: 12px; align-items: flex-end; background: rgba(255, 255, 255, 0.04); border: 1px solid rgba(255, 255, 255, 0.12); padding: 16px 18px; border-radius: 12px; margin-bottom: 28px; }
.fn-field { display: flex; flex-direction: column; gap: 6px; }
.fn-field label { font-size: 13px; color: #c8c2d4; font-weight: 600; }
.fn-field input[type="date"] { background: #14111d; border: 1px solid rgba(255, 255, 255, 0.2); color: #f5f5f7; padding: 9px 12px; border-radius: 8px; font-size: 14px; min-height: 40px; }
.fn-btn { background: #d4af37; color: #18151f; border: none; border-radius: 8px; padding: 10px 20px; font-size: 14px; font-weight: 800; cursor: pointer; min-height: 40px; }
.fn-btn.secondary { background: rgba(212, 175, 55, 0.16); color: #f3e5ab; border: 1px solid rgba(212, 175, 55, 0.4); }
.fn-sec { font-size: 18px; font-weight: 800; color: #f3e5ab; margin: 30px 0 12px; }
.fn-card { background: rgba(255, 255, 255, 0.03); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 12px; overflow-x: auto; margin-bottom: 24px; }
.fn-tbl { width: 100%; border-collapse: collapse; text-align: right; font-size: 14px; }
.fn-tbl th, .fn-tbl td { padding: 12px 14px; border-bottom: 1px solid rgba(255, 255, 255, 0.07); white-space: nowrap; }
.fn-tbl th { background: rgba(255, 255, 255, 0.05); color: #d4af37; font-weight: 700; }
.fn-tbl th:first-child, .fn-tbl td:first-child { text-align: left; font-weight: 700; color: #f3e5ab; }
.fn-tbl tr:last-child td { border-bottom: none; }
.fn-empty { text-align: center !important; color: #8a8296 !important; padding: 24px !important; font-weight: 400 !important; }
.fn-copy-area { width: 100%; min-height: 220px; background: #120f1a; color: #e5e0f0; border: 1px solid rgba(255, 255, 255, 0.16); border-radius: 10px; padding: 14px; font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: 13px; line-height: 1.55; box-sizing: border-box; }
.fn-actions { display: flex; gap: 10px; align-items: center; margin-bottom: 10px; flex-wrap: wrap; }
.fn-toast { font-size: 13px; color: #4ade80; font-weight: 600; display: none; }
`;

function renderTableRows(rows: FunnelRowMetrics[]): string {
  if (rows.length === 0) {
    return `<tr><td colspan="9" class="fn-empty">선택한 기간에 해당하는 기록이 없습니다.</td></tr>`;
  }
  return rows.map((r) => `
    <tr>
      <td>${esc(r.key)}</td>
      <td>${r.freeReadings.toLocaleString('ko-KR')}건</td>
      <td>${r.firstOrders.toLocaleString('ko-KR')}건</td>
      <td>${won(r.firstRevenueKrw)}</td>
      <td>${r.upsellWithin12h.toLocaleString('ko-KR')}건</td>
      <td>${r.upsellAfter12h.toLocaleString('ko-KR')}건</td>
      <td>${r.monthPassOrders.toLocaleString('ko-KR')}건</td>
      <td>${r.inviteUsedOrders.toLocaleString('ko-KR')}건</td>
      <td><b>${won(r.totalRevenueKrw)}</b></td>
    </tr>
  `).join('');
}

export function renderAdminFunnelPage(
  info: BusinessInfo,
  footer: string,
  authParam: { key: 'token' | 'pass'; value: string },
  report: FunnelReportData,
): string {
  const site = show(info, 'serviceName', '늘봄사주');

  const mdFull = [
    `# 늘봄사주 퍼널 숫자 (${report.startKst} ~ ${report.endKst}, 한국 시각 KST)`,
    '',
    buildMarkdownSection('1. 전체 합계', '구분', [report.total]),
    '',
    buildMarkdownSection('2. 소재별 (utm_content)', 'utm_content', report.byContent),
    '',
    buildMarkdownSection('3. 캠페인별 (utm_campaign)', 'utm_campaign', report.byCampaign),
  ].join('\n');

  const csvFull = buildCsvText(report);

  const dbBanner = report.dbUnavailable
    ? `<div class="fn-alert" id="fnDbNotice">데이터베이스 없음 — ${esc(report.dbNotice || '현재 데이터베이스에 연결되지 않아 집계할 저장소가 없거나 메모리 모드로 동작 중입니다.')}</div>`
    : (report.dbNotice ? `<div class="fn-alert" id="fnDbNotice">${esc(report.dbNotice)}</div>` : '');

  return `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>퍼널 숫자 관리 — ${esc(site)}</title>
${FONT_LINK}
<style>
:root { color-scheme: dark; }
body { margin: 0; background: #0b0912; color: #efeaf4; }
${PRODUCTS_CSS}
${FUNNEL_CSS}
</style>
</head>
<body>
<main class="fn-wrap">
  <a class="fn-brand" href="/">← ${esc(site)} 첫 화면</a>
  <h1 class="fn-title">광고·결제 퍼널 숫자 (관리자 전용)</h1>
  <p class="fn-sub">한국 시각(KST) 기준으로 기간을 고르고 <b>보기</b>를 누르시면 단계별·소재별·캠페인별 숫자를 한 번에 계산합니다. (이름·생년월일·이메일 등 개인정보는 표시하지 않습니다)</p>

  ${dbBanner}

  <form class="fn-filter" method="GET" action="/admin/funnel">
    <input type="hidden" name="${esc(authParam.key)}" value="${esc(authParam.value)}">
    <div class="fn-field">
      <label for="fnStart">시작일 (한국 시각)</label>
      <input type="date" id="fnStart" name="start" value="${esc(report.startKst)}" required>
    </div>
    <div class="fn-field">
      <label for="fnEnd">끝일 (한국 시각)</label>
      <input type="date" id="fnEnd" name="end" value="${esc(report.endKst)}" required>
    </div>
    <button type="submit" class="fn-btn" id="fnSubmitBtn">보기</button>
  </form>

  <h2 class="fn-sec">1. 전체 합계 (${esc(report.startKst)} ~ ${esc(report.endKst)})</h2>
  <div class="fn-card">
    <table class="fn-tbl" id="fnTableTotal">
      <thead>
        <tr>
          <th>구분</th>
          <th>무료 사주 명식 본 수</th>
          <th>첫 결제 수</th>
          <th>첫 결제 금액 합</th>
          <th>이어사기 (12시간 안)</th>
          <th>이어사기 (지난 뒤)</th>
          <th>월운세 이용권 결제 수</th>
          <th>소개 코드 사용 수</th>
          <th>총 매출</th>
        </tr>
      </thead>
      <tbody>
        ${renderTableRows([report.total])}
      </tbody>
    </table>
  </div>

  <h2 class="fn-sec">2. 소재별 숫자 (utm_content)</h2>
  <div class="fn-card">
    <table class="fn-tbl" id="fnTableContent">
      <thead>
        <tr>
          <th>소재 (utm_content)</th>
          <th>무료 사주 명식 본 수</th>
          <th>첫 결제 수</th>
          <th>첫 결제 금액 합</th>
          <th>이어사기 (12시간 안)</th>
          <th>이어사기 (지난 뒤)</th>
          <th>월운세 이용권 결제 수</th>
          <th>소개 코드 사용 수</th>
          <th>총 매출</th>
        </tr>
      </thead>
      <tbody>
        ${renderTableRows(report.byContent)}
      </tbody>
    </table>
  </div>

  <h2 class="fn-sec">3. 캠페인별 숫자 (utm_campaign)</h2>
  <div class="fn-card">
    <table class="fn-tbl" id="fnTableCampaign">
      <thead>
        <tr>
          <th>캠페인 (utm_campaign)</th>
          <th>무료 사주 명식 본 수</th>
          <th>첫 결제 수</th>
          <th>첫 결제 금액 합</th>
          <th>이어사기 (12시간 안)</th>
          <th>이어사기 (지난 뒤)</th>
          <th>월운세 이용권 결제 수</th>
          <th>소개 코드 사용 수</th>
          <th>총 매출</th>
        </tr>
      </thead>
      <tbody>
        ${renderTableRows(report.byCampaign)}
      </tbody>
    </table>
  </div>

  <h2 class="fn-sec">4. 복사하기 쉬운 표 (마크다운 · CSV 내려받기)</h2>
  <div class="fn-actions">
    <button type="button" class="fn-btn" id="fnCopyMdBtn">마크다운 표 복사하기</button>
    <button type="button" class="fn-btn secondary" id="fnDownloadCsvBtn">CSV 파일 내려받기</button>
    <span class="fn-toast" id="fnCopyToast">복사되었습니다! GPT에 그대로 붙여넣으시면 됩니다.</span>
  </div>
  <textarea class="fn-copy-area" id="fnMarkdownBox" readonly>${esc(mdFull)}</textarea>
  <textarea id="fnCsvBox" style="display:none" readonly>${esc(csvFull)}</textarea>
</main>
${footer}
<script>
(function(){
  var copyBtn = document.getElementById('fnCopyMdBtn');
  var mdBox = document.getElementById('fnMarkdownBox');
  var csvBtn = document.getElementById('fnDownloadCsvBtn');
  var csvBox = document.getElementById('fnCsvBox');
  var toast = document.getElementById('fnCopyToast');

  if (copyBtn && mdBox) {
    copyBtn.onclick = function() {
      try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(mdBox.value);
        } else {
          mdBox.select();
          document.execCommand('copy');
        }
        if (toast) toast.style.display = 'inline';
      } catch(e) {}
    };
  }
  if (csvBtn && csvBox) {
    csvBtn.onclick = function() {
      try {
        var blob = new Blob(['\\uFEFF' + csvBox.value], { type: 'text/csv;charset=utf-8;' });
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url;
        a.download = 'neulbomsaju-funnel-${esc(report.startKst)}-${esc(report.endKst)}.csv';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      } catch(e) {}
    };
  }
})();
</script>
</body>
</html>`;
}
