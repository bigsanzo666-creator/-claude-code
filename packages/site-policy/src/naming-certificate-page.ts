/**
 * 늘봄사주 작명서 (세로 A4 두 장짜리 화면).
 *
 * 근거와 원칙:
 * 1. 세로 A4 규격으로 인쇄 시 단정하게 두 장으로 나뉜다.
 * 2. 오행 다섯 색(목=초록, 화=적, 토=황금, 금=회색, 수=파랑)만을 뜻에 맞게 사용한다.
 * 3. 쇠(금) 막대에는 빗금을 넣어 옅은 색만으로 가려지지 않게 한다.
 * 4. 모든 막대와 칸에 이름과 숫자를 글자로 함께 적는다.
 * 5. 상호와 대표자는 BIZ 환경변수(BusinessInfo)에서 직접 가져온다.
 * 6. 날짜 없이 지은 작명서(dateUnknown)는 사주 칸을 비우고 안내문을 크게 적으며,
 *    명식·대운·용신 글자가 일절 포함되지 않는다.
 * 7. 「지키면 복이 오고 어기면 해롭다」는 말을 배제하고 편히 기울이면 되는 쪽으로만 쓴다.
 */

import type { BusinessInfo } from './business.ts';
import { solarToLunar, calculate, type Myeongsik } from '../../manseryeok/src/index.ts';
import {
  analyze,
  elementWeights,
  calculateDaeun,
  elementCorrespondence,
  groupElement,
  sajuToTraits,
  type Analysis,
  type Element,
} from '../../saju-rules/src/index.ts';
import {
  koreanHanjaMeaning,
  hanja,
  readSurname,
  byReading,
  readFrames,
  type FrameRead,
} from '../../naming/src/index.ts';

function esc(value: unknown): string {
  if (value === null || value === undefined) return '';
  return String(value).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));
}

const CHOSUNG = [
  'ㄱ', 'ㄲ', 'ㄴ', 'ㄷ', 'ㄸ', 'ㄹ', 'ㅁ', 'ㅂ', 'ㅃ', 'ㅅ',
  'ㅆ', 'ㅇ', 'ㅈ', 'ㅉ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ',
];

/** 초성 기준 발음오행 */
export function getPronunciationElement(hangulChar: string): '목' | '화' | '토' | '금' | '수' {
  const code = hangulChar.charCodeAt(0) - 0xac00;
  if (code < 0 || code > 11171) return '토';
  const chosungIdx = Math.floor(code / 588);
  const cho = CHOSUNG[chosungIdx];
  if (cho === 'ㄱ' || cho === 'ㄲ' || cho === 'ㅋ') return '목';
  if (cho === 'ㄴ' || cho === 'ㄷ' || cho === 'ㄸ' || cho === 'ㄹ' || cho === 'ㅌ') return '화';
  if (cho === 'ㅇ' || cho === 'ㅎ') return '토';
  if (cho === 'ㅅ' || cho === 'ㅆ' || cho === 'ㅈ' || cho === 'ㅉ' || cho === 'ㅊ') return '금';
  if (cho === 'ㅁ' || cho === 'ㅂ' || cho === 'ㅃ' || cho === 'ㅍ') return '수';
  return '토';
}

/** 획수 기준 음양 */
export function getYinYang(strokes: number): '음' | '양' {
  return strokes % 2 === 1 ? '양' : '음';
}

export interface NamingCertificateParams {
  business: BusinessInfo;
  orderId: string;
  orderDate?: string;
  buyerName?: string;
  childName: string;
  childHanja?: string;
  gender?: '남' | '여';
  birthDate?: string;
  birthTime?: string | null;
  birthPlace?: string;
  dateUnknown?: boolean;
  oneLineSummary?: string;
  myeongsik?: Myeongsik;
  analysis?: Analysis;
}

export interface NameCharDetail {
  role: string;
  hangul: string;
  hanja: string;
  meaning: string;
  strokes: number;
  resourceElement: string;
  pronounceElement: string;
  yinYang: string;
}

export function parseNameDetails(childName: string, childHanja?: string): NameCharDetail[] {
  const cleanHangul = childName.replace(/\s+/g, '');
  const cleanHanja = (childHanja || '').replace(/\s+/g, '');
  const details: NameCharDetail[] = [];

  for (let i = 0; i < cleanHangul.length; i++) {
    const hChar = cleanHangul[i]!;
    let hanjaChar = cleanHanja[i] || '';

    // 한자가 지정되지 않은 경우 후보 찾기
    if (!hanjaChar) {
      if (i === 0) {
        const sFound = readSurname(hChar);
        hanjaChar = sFound?.chars[0] || '';
      }
      if (!hanjaChar) {
        const candidates = byReading(hChar);
        hanjaChar = candidates[0]?.char || '';
      }
    }

    const hInfo = hanjaChar ? hanja(hanjaChar) : null;
    const strokes = hInfo?.strokes || 8;
    const resourceElement = hInfo?.element || '토';
    const pronounceElement = getPronunciationElement(hChar);
    const yinYang = getYinYang(strokes);
    const kMeaning = hanjaChar ? (koreanHanjaMeaning(hanjaChar) || hInfo?.meaning || '') : '';

    const role = i === 0 ? '성(姓)' : (i === 1 ? '이름(첫째)' : (i === 2 ? '이름(둘째)' : `이름(${i + 1})`));
    details.push({
      role,
      hangul: hChar,
      hanja: hanjaChar || '-',
      meaning: kMeaning || '-',
      strokes,
      resourceElement,
      pronounceElement,
      yinYang,
    });
  }

  return details;
}

export function renderNamingCertificatePage(params: NamingCertificateParams): string {
  const {
    business,
    orderId,
    orderDate,
    buyerName = '부모님',
    childName,
    childHanja,
    gender = '남',
    birthDate,
    birthTime,
    birthPlace = '대한민국',
    dateUnknown = false,
    oneLineSummary,
  } = params;

  const site = business.serviceName || '늘봄사주';
  const company = business.companyName || '늘봄사주';
  const representative = business.representative || '대표자';

  const details = parseNameDetails(childName, childHanja);
  const surnameStrokes = details.length > 0 ? [details[0]!.strokes] : [8];
  const givenStrokes = details.slice(1).map((d) => d.strokes);
  const frames: FrameRead = readFrames(surnameStrokes, givenStrokes.length > 0 ? givenStrokes : [8, 8]);

  // 사주 계산 (dateUnknown이 아닐 때만)
  let ms: Myeongsik | null = null;
  let an: Analysis | null = null;
  let weights: Array<{ element: Element; weight: number; visibleCount: number }> = [];
  let daeunData: ReturnType<typeof calculateDaeun> | null = null;
  let wantElements: Element[] = [];
  let avoidElements: Element[] = [];
  let lunarText = '';
  let primaryGuide = { element: '토', direction: '중앙', color: '황', numbers: '5·10', guide: '고를 일이 있을 때 마음을 편히 기울이면 되는 쪽입니다.' };

  if (!dateUnknown && birthDate) {
    try {
      ms = params.myeongsik ?? calculate({ date: birthDate, time: birthTime ?? null });
      an = params.analysis ?? analyze(ms, gender);
      weights = elementWeights(ms);
      daeunData = calculateDaeun(ms, gender, an.yongsin);
      const me = ms.day.element.stem;
      wantElements = an.yongsin.primary.map((g) => groupElement(me, g));
      avoidElements = an.yongsin.avoid.map((g) => groupElement(me, g));
      const lunar = solarToLunar(birthDate);
      lunarText = lunar.text;
      const primaryEl = wantElements[0] || '토';
      primaryGuide = elementCorrespondence(primaryEl);
    } catch {
      // 계산 불가 시 안전 처리
    }
  }

  const defaultSummary = `${details.map((d) => `${d.hangul}(${d.meaning})`).join(' ')}의 좋은 뜻과 ` +
    `네 격의 반듯한 수리(원·형·이·정)를 고루 갖추어 평생 귀하고 복되기를 기원하는 이름입니다.`;
  const finalSummary = oneLineSummary || defaultSummary;

  const formattedOrderDate = orderDate || (() => {
    const now = new Date();
    return `${now.getFullYear()}년 ${now.getMonth() + 1}월 ${now.getDate()}일`;
  })();

  const html = `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>작명서 - ${esc(childName)} | ${esc(site)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Noto+Serif+KR:wght@400;600;700&display=swap" rel="stylesheet">
<style>
/* ── 기본 레이아웃 ── */
* {
  box-sizing: border-box;
}
html, body {
  margin: 0;
  padding: 0;
  background-color: #f7f7f8;
  color: #1a1a1a;
  font-family: -apple-system, BlinkMacSystemFont, 'Pretendard', sans-serif;
  -webkit-font-smoothing: antialiased;
  overflow-x: hidden;
}
.cert-action-bar {
  max-width: 820px;
  margin: 16px auto 0 auto;
  padding: 0 16px;
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
.cert-print-btn {
  background: #2e7d32;
  color: #fff;
  border: none;
  padding: 8px 16px;
  font-size: 14px;
  border-radius: 6px;
  cursor: pointer;
  font-weight: 600;
}
.cert-print-btn:hover {
  background: #1b5e20;
}
.cert-container {
  width: 100%;
  max-width: 820px;
  margin: 12px auto 40px auto;
  padding: 0 16px;
  box-sizing: border-box;
}
/* ── 세로 A4 페이지 규격 ── */
.cert-page {
  width: 100%;
  max-width: 800px;
  min-height: 1130px;
  background: #ffffff;
  margin: 0 auto 36px auto;
  padding: 44px 38px;
  box-sizing: border-box;
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.07);
  border: 1px solid #e0ded9;
  position: relative;
  page-break-after: always;
  break-after: page;
}
.cert-border {
  border: 2px solid #b78103;
  padding: 28px 24px;
  min-height: 1040px;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
}
.cert-header {
  text-align: center;
  border-bottom: 2px solid #b78103;
  padding-bottom: 16px;
  margin-bottom: 20px;
}
.cert-title-hanja {
  font-family: 'Noto Serif KR', serif;
  font-size: 34px;
  letter-spacing: 12px;
  margin: 0;
  color: #2c2523;
  font-weight: 700;
}
.cert-title-ko {
  font-size: 16px;
  letter-spacing: 6px;
  color: #665c54;
  margin: 6px 0 0 0;
  font-weight: 600;
}
/* ── 아이 정보 ── */
.cert-info-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 8px 16px;
  background: #faf9f6;
  padding: 12px 16px;
  border: 1px solid #eae7e1;
  border-radius: 4px;
  margin-bottom: 18px;
  font-size: 13px;
  line-height: 1.6;
}
.cert-info-item strong {
  color: #554d45;
  margin-right: 6px;
}
/* ── 오행 색상 토큰 ── */
.col-wood { color: #1b5e20; }
.col-fire { color: #b71c1c; }
.col-earth { color: #825e00; }
.col-metal { color: #37474f; }
.col-water { color: #0d47a1; }

.bg-wood { background: #e8f5e9; border: 1px solid #2e7d32; color: #1b5e20; }
.bg-fire { background: #ffebee; border: 1px solid #c62828; color: #b71c1c; }
.bg-earth { background: #fff8e1; border: 1px solid #d4a017; color: #825e00; }
.bg-metal { background: #eceff1; border: 1px solid #78909c; color: #263238; }
.bg-water { background: #e3f2fd; border: 1px solid #1976d2; color: #0d47a1; }

/* ── 사주 기둥 표 ── */
.cert-saju-table {
  width: 100%;
  border-collapse: collapse;
  margin-bottom: 16px;
  text-align: center;
}
.cert-saju-table th, .cert-saju-table td {
  border: 1px solid #dcd7ce;
  padding: 6px 4px;
  font-size: 12px;
}
.cert-saju-table th {
  background: #f4f1ea;
  color: #49423b;
  font-weight: 600;
}
.cert-pillar-char {
  font-family: 'Noto Serif KR', serif;
  font-size: 18px;
  font-weight: 700;
  display: block;
  margin-bottom: 2px;
}
.cert-pillar-label {
  font-size: 11px;
  display: block;
}

/* ── 오행 비중 막대 (금: 빗금 필수) ── */
.cert-weight-section {
  margin-bottom: 18px;
}
.cert-weight-title {
  font-size: 13px;
  font-weight: 700;
  margin: 0 0 8px 0;
  color: #3b352f;
}
.cert-weight-bars {
  display: flex;
  flex-direction: column;
  gap: 5px;
}
.cert-bar-row {
  display: flex;
  align-items: center;
  font-size: 12px;
  gap: 8px;
}
.cert-bar-name {
  width: 90px;
  font-weight: 600;
  flex-shrink: 0;
}
.cert-bar-track {
  flex: 1;
  background: #f0eee9;
  height: 18px;
  border-radius: 3px;
  overflow: hidden;
  position: relative;
}
.cert-bar-fill {
  height: 100%;
  border-radius: 3px;
  display: flex;
  align-items: center;
  padding-left: 6px;
  font-size: 11px;
  font-weight: 700;
  white-space: nowrap;
}
.fill-wood { background-color: #2e7d32; color: #fff; }
.fill-fire { background-color: #c62828; color: #fff; }
.fill-earth { background-color: #d4a017; color: #fff; }
.fill-metal {
  background-color: #78909c;
  background-image: repeating-linear-gradient(45deg, #78909c, #78909c 4px, #cfd8dc 4px, #cfd8dc 8px);
  color: #212121;
}
.fill-water { background-color: #1976d2; color: #fff; }

.cert-bar-num {
  width: 50px;
  text-align: right;
  font-weight: 700;
  flex-shrink: 0;
}

/* ── 이름 세 글자 표 ── */
.cert-name-table {
  width: 100%;
  border-collapse: collapse;
  margin-bottom: 16px;
  text-align: center;
}
.cert-name-table th, .cert-name-table td {
  border: 1px solid #dcd7ce;
  padding: 6px 4px;
  font-size: 12px;
}
.cert-name-table th {
  background: #f4f1ea;
  color: #49423b;
  font-weight: 600;
}
.name-hanja-cell {
  font-family: 'Noto Serif KR', serif;
  font-size: 20px;
  font-weight: 700;
  color: #1f1b18;
}

/* ── 수리 4격 ── */
.cert-suri-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 8px;
  margin-bottom: 16px;
}
.cert-suri-box {
  border: 1px solid #e2ded5;
  background: #fcfbf9;
  padding: 8px 10px;
  border-radius: 4px;
  font-size: 12px;
}
.cert-suri-header {
  display: flex;
  justify-content: space-between;
  margin-bottom: 4px;
  font-weight: 700;
  color: #2e2823;
}
.cert-verdict {
  display: inline-block;
  padding: 1px 6px;
  border-radius: 3px;
  font-size: 11px;
}
.v-gil { background: #e8f5e9; color: #2e7d32; }
.v-jung { background: #fff8e1; color: #f57f17; }
.v-hyung { background: #ffebee; color: #c62828; }

/* ── 기운 분석 ── */
.cert-energy-box {
  background: #faf9f6;
  border: 1px solid #eae6de;
  padding: 10px 12px;
  border-radius: 4px;
  font-size: 12px;
  line-height: 1.6;
  margin-bottom: 14px;
}

/* ── 한 줄 풀이 ── */
.cert-summary-box {
  border: 1px dashed #b78103;
  background: #fffdf7;
  padding: 10px 14px;
  text-align: center;
  font-size: 13px;
  font-weight: 600;
  color: #3b332b;
  border-radius: 4px;
  margin-bottom: 18px;
  line-height: 1.5;
}

/* ── 날짜 없는 작명서 전용 배너 ── */
.cert-unknown-banner {
  border: 2px solid #825e00;
  background: #fffdf5;
  padding: 24px 18px;
  text-align: center;
  border-radius: 6px;
  margin: 20px 0;
}
.cert-unknown-banner h2 {
  font-size: 20px;
  font-weight: 700;
  color: #825e00;
  margin: 0 0 10px 0;
}
.cert-unknown-banner p {
  font-size: 13px;
  color: #554d45;
  margin: 0;
  line-height: 1.6;
}

/* ── 하단 날짜·상호·도장 ── */
.cert-footer {
  margin-top: auto;
  padding-top: 16px;
  border-top: 1px solid #eae5db;
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
}
.cert-footer-text {
  font-size: 12px;
  color: #5c534b;
  line-height: 1.7;
}
.cert-stamp-area {
  position: relative;
  width: 90px;
  height: 90px;
  display: flex;
  align-items: center;
  justify-content: center;
}
.cert-stamp-img {
  width: 80px;
  height: 80px;
  object-fit: contain;
}

/* ── 둘째 장 전용 ── */
.cert-sec-title {
  font-size: 15px;
  font-weight: 700;
  color: #2e2823;
  border-left: 4px solid #b78103;
  padding-left: 8px;
  margin: 16px 0 8px 0;
}
.cert-sec-text {
  font-size: 12.5px;
  line-height: 1.7;
  color: #3a342f;
  background: #faf9f6;
  padding: 10px 14px;
  border: 1px solid #eae6de;
  border-radius: 4px;
  margin-bottom: 14px;
}
.cert-guide-table, .cert-daeun-table {
  width: 100%;
  border-collapse: collapse;
  margin-bottom: 16px;
  text-align: center;
}
.cert-guide-table th, .cert-guide-table td,
.cert-daeun-table th, .cert-daeun-table td {
  border: 1px solid #dcd7ce;
  padding: 6px 4px;
  font-size: 12px;
}
.cert-guide-table th, .cert-daeun-table th {
  background: #f4f1ea;
  color: #49423b;
  font-weight: 600;
}

/* ── 모바일 반응형 ── */
@media (max-width: 480px) {
  .cert-container {
    padding: 0 4px;
  }
  .cert-page {
    padding: 20px 12px;
    margin-bottom: 16px;
    min-height: auto;
  }
  .cert-border {
    padding: 16px 10px;
    min-height: auto;
  }
  .cert-title-hanja {
    font-size: 26px;
    letter-spacing: 6px;
  }
  .cert-info-grid {
    grid-template-columns: 1fr;
    font-size: 12px;
  }
  .cert-suri-grid {
    grid-template-columns: 1fr;
  }
  .cert-saju-table th, .cert-saju-table td,
  .cert-name-table th, .cert-name-table td,
  .cert-guide-table th, .cert-guide-table td,
  .cert-daeun-table th, .cert-daeun-table td {
    font-size: 10.5px;
    padding: 4px 2px;
  }
  .cert-bar-name {
    width: 75px;
    font-size: 11px;
  }
  .cert-bar-num {
    width: 40px;
    font-size: 11px;
  }
}

/* ── 인쇄 전용 (세로 A4 2장 분리) ── */
@media print {
  @page {
    size: A4 portrait;
    margin: 0;
  }
  body {
    background: #ffffff;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .no-print {
    display: none !important;
  }
  .cert-container {
    padding: 0;
    max-width: none;
    margin: 0;
  }
  .cert-page {
    width: 210mm;
    height: 297mm;
    min-height: 297mm;
    max-width: 210mm;
    margin: 0;
    padding: 16mm 14mm;
    border: none;
    box-shadow: none;
    page-break-after: always;
    break-after: page;
  }
  .cert-border {
    min-height: 265mm;
  }
}
</style>
</head>
<body>

<div class="cert-action-bar no-print">
  <button type="button" class="cert-print-btn" onclick="window.print()">인쇄 / PDF 저장</button>
</div>

<div class="cert-container">

  <!-- ════════════════ 첫째 장 ════════════════ -->
  <div class="cert-page" id="certPage1">
    <div class="cert-border">
      <div>
        <div class="cert-header">
          <h1 class="cert-title-hanja">作名書</h1>
          <p class="cert-title-ko">늘봄사주 작명서</p>
        </div>

        <div class="cert-info-grid">
          <div class="cert-info-item"><strong>이름</strong> ${esc(childName)} (${esc(childHanja || details.map((d) => d.hanja).join(''))})</div>
          <div class="cert-info-item"><strong>성별</strong> ${esc(gender)}아</div>
          ${dateUnknown ? `
          <div class="cert-info-item"><strong>태어난 날</strong> 생년월일 미상</div>
          <div class="cert-info-item"><strong>태어난 시각</strong> 시각 미상</div>
          ` : `
          <div class="cert-info-item"><strong>태어난 날</strong> ${esc(birthDate || '-')} (양력) / ${esc(lunarText || '-')}</div>
          <div class="cert-info-item"><strong>태어난 시각</strong> ${esc(birthTime || '시각 미상')}</div>
          `}
          <div class="cert-info-item"><strong>태어난 곳</strong> ${esc(birthPlace)}</div>
          <div class="cert-info-item"><strong>맡기신 분</strong> ${esc(buyerName)}</div>
        </div>

        ${dateUnknown ? `
        <!-- 날짜 없는 작명서 사주 영역 -->
        <div class="cert-unknown-banner">
          <h2>이 이름은 아이의 사주를 보지 않고 지었습니다</h2>
          <p>아이의 생년월일과 시각을 살피지 않고, 부모님의 귀한 뜻과 이름 글자의 훈음, 그리고 81수리의 반듯한 균형만을 오롯이 헤아려 정성으로 지었습니다.</p>
        </div>
        ` : `
        <!-- 사주 네 기둥 표 -->
        ${renderFourPillarsTable(ms)}

        <!-- 오행 비중 막대 -->
        <div class="cert-weight-section">
          <div class="cert-weight-title">오행 비중 분석 (실제 비율)</div>
          <div class="cert-weight-bars">
            ${weights.map((w) => {
              const elClass = w.element === '목' ? 'fill-wood' :
                              (w.element === '화' ? 'fill-fire' :
                              (w.element === '토' ? 'fill-earth' :
                              (w.element === '금' ? 'fill-metal' : 'fill-water')));
              const colName = w.element === '목' ? '초록' :
                              (w.element === '화' ? '적' :
                              (w.element === '토' ? '황금' :
                              (w.element === '금' ? '회색·빗금' : '파랑')));
              return `
              <div class="cert-bar-row">
                <span class="cert-bar-name">${w.element} (${colName})</span>
                <div class="cert-bar-track">
                  <div class="cert-bar-fill ${elClass}" style="width: ${Math.min(100, Math.max(8, w.weight))}%">
                    ${w.element} ${w.weight}%
                  </div>
                </div>
                <span class="cert-bar-num">${w.weight}%</span>
              </div>`;
            }).join('')}
          </div>
        </div>

        <!-- 필요한 기운과 덜어낼 기운 -->
        <div class="cert-energy-box">
          <div><strong>필요한 기운:</strong> ${wantElements.map((e) => `${e}(${elementNameText(e)})`).join(', ')} [${an?.yongsin.primary.join(', ')}]</div>
          <div><strong>덜어낼 기운:</strong> ${avoidElements.map((e) => `${e}(${elementNameText(e)})`).join(', ')} [${an?.yongsin.avoid.join(', ')}]</div>
          <div><strong>판단 까닭:</strong> ${esc(an?.yongsin.reasoning || '-')}</div>
          <div><strong>유파 관점:</strong> ${esc(an?.yongsin.school || '-')}</div>
        </div>
        `}

        <!-- 이름 세 글자 표 -->
        <table class="cert-name-table">
          <thead>
            <tr>
              <th>구분</th>
              <th>한글</th>
              <th>한자</th>
              <th>뜻(훈음)</th>
              <th>획수</th>
              <th>자원오행</th>
              <th>발음오행</th>
              <th>음양</th>
            </tr>
          </thead>
          <tbody>
            ${details.map((d) => `
            <tr>
              <td>${esc(d.role)}</td>
              <td style="font-weight:700;">${esc(d.hangul)}</td>
              <td class="name-hanja-cell">${esc(d.hanja)}</td>
              <td>${esc(d.meaning)}</td>
              <td>${d.strokes}획</td>
              <td class="${elementBgClass(d.resourceElement)}">${d.resourceElement} (${elementNameText(d.resourceElement)})</td>
              <td class="${elementBgClass(d.pronounceElement)}">${d.pronounceElement} (${elementNameText(d.pronounceElement)})</td>
              <td>${esc(d.yinYang)}</td>
            </tr>`).join('')}
          </tbody>
        </table>

        <!-- 수리 4격 -->
        <div class="cert-suri-grid">
          <div class="cert-suri-box">
            <div class="cert-suri-header">
              <span>원격(元格) 초년운 [${frames.won}획]</span>
              <span class="cert-verdict ${verdictClass(frames.wonN.verdict)}">${frames.wonN.verdict} · ${frames.wonN.name}</span>
            </div>
            <div>${esc(frames.wonN.say)}</div>
          </div>
          <div class="cert-suri-box">
            <div class="cert-suri-header">
              <span>형격(亨格) 청년운 [${frames.hyeong}획]</span>
              <span class="cert-verdict ${verdictClass(frames.hyeongN.verdict)}">${frames.hyeongN.verdict} · ${frames.hyeongN.name}</span>
            </div>
            <div>${esc(frames.hyeongN.say)}</div>
          </div>
          <div class="cert-suri-box">
            <div class="cert-suri-header">
              <span>이격(利格) 장년운 [${frames.i}획]</span>
              <span class="cert-verdict ${verdictClass(frames.iN.verdict)}">${frames.iN.verdict} · ${frames.iN.name}</span>
            </div>
            <div>${esc(frames.iN.say)}</div>
          </div>
          <div class="cert-suri-box">
            <div class="cert-suri-header">
              <span>정격(貞格) 전체운 [${frames.jeong}획]</span>
              <span class="cert-verdict ${verdictClass(frames.jeongN.verdict)}">${frames.jeongN.verdict} · ${frames.jeongN.name}</span>
            </div>
            <div>${esc(frames.jeongN.say)}</div>
          </div>
        </div>

        <!-- 이름을 한 줄로 푼 글 -->
        <div class="cert-summary-box">
          ${esc(finalSummary)}
        </div>
      </div>

      <!-- 하단 정보 -->
      <div class="cert-footer">
        <div class="cert-footer-text">
          <div>발행일자: ${esc(formattedOrderDate)} (주문번호: ${esc(orderId)})</div>
          <div>${esc(site)} | ${esc(company)} · 대표자 ${esc(representative)}</div>
        </div>
        <div class="cert-stamp-area">
          <img src="/assets/늘봄도장누끼.png" alt="늘봄도장" class="cert-stamp-img" onerror="this.style.display='none'">
        </div>
      </div>
    </div>
  </div>

  <!-- ════════════════ 둘째 장 ════════════════ -->
  <div class="cert-page" id="certPage2">
    <div class="cert-border">
      <div>
        <div class="cert-header">
          <h2 class="cert-title-hanja" style="font-size:26px;">作名 解說</h2>
          <p class="cert-title-ko">작명 상세 해설서</p>
        </div>

        ${dateUnknown ? `
        <!-- 날짜 없는 작명서 둘째 장: 수리와 글자 뜻만 남김 -->
        <div class="cert-sec-title">이름 글자의 깊은 뜻과 상생(相生)</div>
        <div class="cert-sec-text">
          ${details.map((d) => `• <strong>${esc(d.hangul)} (${esc(d.hanja)})</strong>: ${esc(d.meaning)} — ${d.strokes}획의 정갈한 기운으로 자원오행 ${d.resourceElement}의 성품을 북돋웁니다.`).join('<br>')}
        </div>

        <div class="cert-sec-title">수리성명학 원형이정(元亨利貞) 길흉 상세</div>
        <div class="cert-sec-text">
          • <strong>초년운 (원격 ${frames.won}획 · ${frames.wonN.name})</strong>: ${esc(frames.wonN.say)}<br>
          • <strong>청년운 (형격 ${frames.hyeong}획 · ${frames.hyeongN.name})</strong>: ${esc(frames.hyeongN.say)}<br>
          • <strong>장년운 (이격 ${frames.i}획 · ${frames.iN.name})</strong>: ${esc(frames.iN.say)}<br>
          • <strong>전체운 (정격 ${frames.jeong}획 · ${frames.jeongN.name})</strong>: ${esc(frames.jeongN.say)}<br>
          • <strong>음양 조화</strong>: 이름 석 자의 획수가 ${frames.yinYangMixed ? '음과 양이 고르게 어우러져 치우침 없이 반듯합니다.' : '한쪽으로 기울지 않도록 단단하게 자리를 잡았습니다.'}
        </div>

        <div class="cert-sec-title">아이를 위한 늘봄의 축복 덕담</div>
        <div class="cert-sec-text">
          이름은 평생을 불리며 스스로의 길을 밝히는 등불이 됩니다. 맑은 소리와 높은 뜻, 반듯한 숫자의 조화 속에서 아이가 건강하고 지혜롭게 자라 세상에 이로움을 전하는 큰 사람으로 피어나길 온 마음으로 축원합니다.
        </div>
        ` : `
        <!-- 타고난 바탕과 그 근거 -->
        <div class="cert-sec-title">타고난 바탕과 그 근거</div>
        <div class="cert-sec-text">
          ${an ? renderTraitsAndBasis(an) : '사주 분석 정보를 정리 중입니다.'}
        </div>

        <!-- 10년 단위 흐름 표 -->
        <div class="cert-sec-title">10년 단위 기운의 흐름 표</div>
        <table class="cert-daeun-table">
          <thead>
            <tr>
              <th>나이</th>
              <th>해(연도)</th>
              <th>간지</th>
              <th>기운 흐름</th>
              <th>까닭 및 작용</th>
            </tr>
          </thead>
          <tbody>
            ${daeunData ? daeunData.periods.slice(0, 8).map((p) => {
              const flowText = p.favor === '유리' ? '좋음' : (p.favor === '불리' ? '조심' : '보통');
              const flowClass = p.favor === '유리' ? 'v-gil' : (p.favor === '불리' ? 'v-hyung' : 'v-jung');
              const reason = `${p.stemGod}·${p.branchGod}${p.interactions.length ? ` (${p.interactions.join(', ')})` : ''}`;
              return `
              <tr>
                <td>${p.startAge}~${p.endAge}세</td>
                <td>${p.startYear}~${p.endYear}년</td>
                <td style="font-weight:700;">${p.pillar.stemHanja}${p.pillar.branchHanja} (${p.pillar.stem}${p.pillar.branch})</td>
                <td><span class="cert-verdict ${flowClass}">${flowText}</span></td>
                <td style="text-align:left; padding-left:8px;">${esc(reason)}</td>
              </tr>`;
            }).join('') : '<tr><td colspan="5">계산된 정보가 없습니다.</td></tr>'}
          </tbody>
        </table>

        <!-- 맞는 방향·색·숫자 -->
        <div class="cert-sec-title">기운을 돕는 맞는 방향·색·숫자 안내</div>
        <table class="cert-guide-table">
          <thead>
            <tr>
              <th>구분</th>
              <th>기운</th>
              <th>맞는 방향</th>
              <th>맞는 색</th>
              <th>맞는 숫자</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style="font-weight:700;">보탬이 되는 기운</td>
              <td class="${elementBgClass(primaryGuide.element)}">${primaryGuide.element} (${elementNameText(primaryGuide.element)})</td>
              <td>${esc(primaryGuide.direction)}방</td>
              <td>${esc(primaryGuide.color)}</td>
              <td>${esc(primaryGuide.numbers)}</td>
            </tr>
          </tbody>
        </table>
        <div class="cert-sec-text" style="font-size:12px;">
          안내: ${esc(primaryGuide.guide)}
        </div>
        `}
      </div>

      <div class="cert-footer">
        <div class="cert-footer-text">
          <div>발행일자: ${esc(formattedOrderDate)} (주문번호: ${esc(orderId)})</div>
          <div>${esc(site)} | ${esc(company)} · 대표자 ${esc(representative)}</div>
        </div>
        <div class="cert-stamp-area">
          <img src="/assets/늘봄도장누끼.png" alt="늘봄도장" class="cert-stamp-img" onerror="this.style.display='none'">
        </div>
      </div>
    </div>
  </div>

</div>

</body>
</html>`;

  // 날짜 없는 작명서 검증: 명식, 대운, 용신 단어 일절 배제
  if (dateUnknown) {
    if (html.includes('명식') || html.includes('대운') || html.includes('용신')) {
      throw new Error('날짜 없는 작명서에 명식·대운·용신 글자가 포함되어 있습니다.');
    }
  }

  return html;
}

function renderFourPillarsTable(ms: Myeongsik | null): string {
  if (!ms) return '';
  const pillars = [
    { title: '시주(時柱)', p: ms.hour },
    { title: '일주(日柱)', p: ms.day },
    { title: '월주(月柱)', p: ms.month },
    { title: '연주(年柱)', p: ms.year },
  ];

  return `
  <table class="cert-saju-table">
    <thead>
      <tr>
        ${pillars.map((pi) => `<th>${pi.title}</th>`).join('')}
      </tr>
    </thead>
    <tbody>
      <tr>
        ${pillars.map((pi) => {
          if (!pi.p) return `<td>시각 미상</td>`;
          const sEl = pi.p.element.stem;
          return `
          <td class="${elementBgClass(sEl)}">
            <span class="cert-pillar-char">${pi.p.stemHanja}</span>
            <span class="cert-pillar-label">${pi.p.stem} (${sEl}·${elementNameText(sEl)})</span>
          </td>`;
        }).join('')}
      </tr>
      <tr>
        ${pillars.map((pi) => {
          if (!pi.p) return `<td>시각 미상</td>`;
          const bEl = pi.p.element.branch;
          return `
          <td class="${elementBgClass(bEl)}">
            <span class="cert-pillar-char">${pi.p.branchHanja}</span>
            <span class="cert-pillar-label">${pi.p.branch} (${bEl}·${elementNameText(bEl)})</span>
          </td>`;
        }).join('')}
      </tr>
    </tbody>
  </table>`;
}

function renderTraitsAndBasis(an: Analysis): string {
  const lines: string[] = [];
  lines.push(`• <strong>일간의 기운</strong>: 일간은 ${an.dayMaster}이며, 기운의 강약은 ${an.strength.verdict}(${an.strength.supportRatio}%)입니다.`);
  for (const r of an.strength.reasoning) {
    lines.push(`• ${esc(r)}`);
  }
  const traits = sajuToTraits(an);
  for (const s of traits.signals.slice(0, 4)) {
    lines.push(`• <strong>성향 축 [${esc(s.axis)}]</strong>: ${esc(s.evidence)}`);
  }
  return lines.join('<br>');
}

function elementNameText(el: string): string {
  if (el === '목') return '초록';
  if (el === '화') return '적';
  if (el === '토') return '황금';
  if (el === '금') return '회색';
  if (el === '수') return '파랑';
  return '';
}

function elementBgClass(el: string): string {
  if (el === '목') return 'bg-wood';
  if (el === '화') return 'bg-fire';
  if (el === '토') return 'bg-earth';
  if (el === '금') return 'bg-metal';
  if (el === '수') return 'bg-water';
  return '';
}

function verdictClass(v: string): string {
  if (v === '길') return 'v-gil';
  if (v === '흉') return 'v-hyung';
  return 'v-jung';
}
