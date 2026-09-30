/**
 * 리포트 마크다운 렌더러 및 스타일.
 *
 * 결제 직후 화면(checkout-page.ts)과 주문 상세 화면(order-page.ts)에서 공용으로 사용한다.
 *
 * ## 절대 원칙
 * 1. 반드시 먼저 & < > 를 막는다 (XSS 차단).
 * 2. 외부 마크다운 라이브러리(marked, markdown-it 등)를 일절 쓰지 않는다.
 * 3. 정해진 명리 리포트 마크다운 문법(#, ##, ###, **, >, -, |, ---)만 파싱한다.
 */

export function esc(s: unknown): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * 인라인 포맷팅 (**굵게** -> <strong>)
 */
function formatInline(str: string): string {
  return str.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
}

/**
 * 사주 리포트 마크다운을 안전한 HTML로 변환한다.
 */
export function renderReportMarkdown(rawText: string): string {
  if (!rawText) return '';

  // 1. 반드시 먼저 & < > 를 막는다 (XSS 원천 차단)
  const escaped = esc(rawText);

  const lines = escaped.split(/\r?\n/);
  const out: string[] = [];

  let inList = false;
  let inTable = false;
  let tableRows: string[][] = [];

  function closeList() {
    if (inList) {
      out.push('</ul>');
      inList = false;
    }
  }

  function closeTable() {
    if (inTable && tableRows.length > 0) {
      let tHtml = '<table class="rp-table"><tbody>';
      for (let r = 0; r < tableRows.length; r++) {
        const row = tableRows[r];
        // 마크다운 표 구분선 줄 (|---|---|) 은 건너뛴다
        if (row.every((c) => /^[-:\s]+$/.test(c))) continue;
        const tag = r === 0 ? 'th' : 'td';
        tHtml += '<tr>' + row.map((c) => `<${tag}>${formatInline(c)}</${tag}>`).join('') + '</tr>';
      }
      tHtml += '</tbody></table>';
      out.push(tHtml);
      inTable = false;
      tableRows = [];
    }
  }

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const line = rawLine.trim();

    // 빈 줄
    if (!line) {
      closeList();
      closeTable();
      continue;
    }

    // 구분선 ---
    if (/^---[-]*$/.test(line)) {
      closeList();
      closeTable();
      out.push('<hr class="rp-rule">');
      continue;
    }

    // 표 라인 (| col1 | col2 |)
    if (line.startsWith('|') && line.endsWith('|')) {
      closeList();
      if (!inTable) {
        inTable = true;
        tableRows = [];
      }
      const cols = line.slice(1, -1).split('|').map((c) => c.trim());
      tableRows.push(cols);
      continue;
    } else {
      closeTable();
    }

    // 헤딩 #, ##, ###
    if (line.startsWith('# ')) {
      closeList();
      out.push(`<h2 class="rp-h1">${formatInline(line.slice(2))}</h2>`);
      continue;
    }
    if (line.startsWith('## ')) {
      closeList();
      out.push(`<h3 class="rp-h2">${formatInline(line.slice(3))}</h3>`);
      continue;
    }
    if (line.startsWith('### ')) {
      closeList();
      out.push(`<h4 class="rp-h3">${formatInline(line.slice(4))}</h4>`);
      continue;
    }

    // 인용문 > ... (특히 > 전문 ·)
    if (line.startsWith('&gt;') || line.startsWith('>')) {
      closeList();
      const quoteContent = line.replace(/^(&gt;|>)\s*/, '');
      const isExpert = quoteContent.startsWith('전문 ·') || quoteContent.startsWith('전문·');
      const cls = isExpert ? 'rp-quote rp-quote-expert' : 'rp-quote';
      out.push(`<blockquote class="${cls}">${formatInline(quoteContent)}</blockquote>`);
      continue;
    }

    // 목록 - ...
    if (line.startsWith('- ')) {
      if (!inList) {
        inList = true;
        out.push('<ul class="rp-list">');
      }
      out.push(`<li>${formatInline(line.slice(2))}</li>`);
      continue;
    } else {
      closeList();
    }

    // 근거 줄: 근거 · ...
    if (line.startsWith('근거 ·') || line.startsWith('근거·')) {
      out.push(`<p class="rp-evidence">${formatInline(line)}</p>`);
      continue;
    }

    // 쉽게 말하면 대목
    if (line.startsWith('쉽게 말하면')) {
      out.push(`<p class="rp-plain rp-plain-lead">${formatInline(line)}</p>`);
      continue;
    }

    out.push(`<p class="rp-p">${formatInline(line)}</p>`);
  }

  closeList();
  closeTable();

  return out.join('\n');
}

/**
 * 리포트 마크다운 본문용 CSS
 */
export const REPORT_CSS = `
/* ── 리포트 본문 꾸밈 ────────────────────────────────────────── */
.rp-article{font-family:-apple-system,BlinkMacSystemFont,"Apple SD Gothic Neo","Pretendard","Noto Sans KR",sans-serif;word-break:keep-all;line-height:1.9}
.rp-h1{font-size:22px;font-weight:800;color:var(--gold-light,#f3e5ab);margin:32px 0 16px;border-bottom:1px solid rgba(212,175,55,.25);padding-bottom:8px}
.rp-h2{font-size:19px;font-weight:700;color:var(--gold-light,#f3e5ab);margin:28px 0 14px}
.rp-h3{font-size:17px;font-weight:700;color:#fff;margin:22px 0 10px}
.rp-p{font-size:17px;line-height:1.92;color:#f5f0e4;margin:0 0 16px}
.rp-plain{font-size:17.5px;line-height:1.95;color:#f5f0e4;margin:0 0 16px}
.rp-plain-lead{font-weight:600;color:#fff;border-left:3px solid var(--gold-primary,#d4af37);padding-left:12px;margin:18px 0 14px}
.rp-quote{margin:16px 0;padding:12px 16px;background:rgba(255,255,255,.03);border-left:3px solid rgba(212,175,55,.3);border-radius:0 8px 8px 0;color:#c8c2d4;font-size:15px;line-height:1.75}
.rp-quote-expert{margin:14px 0 18px;padding:9px 14px;background:rgba(212,175,55,.04);border-left:2.5px solid rgba(212,175,55,.5);border-radius:0 6px 6px 0;color:#b9b2c6;font-size:13.8px;line-height:1.68}
.rp-evidence{font-size:13px;color:#9a93a6;margin:4px 0 20px;line-height:1.55;font-variant-numeric:tabular-nums}
.rp-list{margin:12px 0 18px;padding-left:22px}
.rp-list li{margin:6px 0;font-size:16.5px;color:#f5f0e4;line-height:1.85}
.rp-rule{border:none;border-top:1px solid rgba(212,175,55,.2);margin:32px 0}
strong{color:var(--gold-light,#f3e5ab);font-weight:700}

/* 여덟 글자 표 — 폰(390px)에서도 옆으로 삐져나가지 않게 비율과 줄바꿈으로 처리 */
.rp-table{width:100%;border-collapse:collapse;table-layout:fixed;margin:20px 0;background:rgba(255,255,255,.02);border:1px solid rgba(212,175,55,.3);border-radius:8px;overflow:hidden}
.rp-table th,.rp-table td{padding:10px 4px;border:1px solid rgba(255,255,255,.08);text-align:center;word-break:break-all;font-size:13.5px;line-height:1.45}
.rp-table th{background:rgba(212,175,55,.14);color:var(--gold-light,#f3e5ab);font-weight:700}
.rp-table td{color:#efeaf4}
`;
