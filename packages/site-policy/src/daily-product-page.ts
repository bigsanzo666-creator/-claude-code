import type { Product, BusinessInfo } from '../../commerce/src/index.ts';
import { CATALOG, WITHDRAWAL_WINDOW_DAYS } from '../../commerce/src/index.ts';
import { PLACES, buildDailyPreviewData, parseInputTime, type DailyPreviewData } from '../../saju-rules/src/index.ts';
import { show } from './business.ts';
import { spiritOf, renderSpiritPitch } from './spirits.ts';
import { renderSocialHead } from './social.ts';
import { renderWhy } from './why.ts';
import {
  renderFit,
  FONT_LINK,
  PRODUCTS_CSS,
  type ProductImages,
  type SpiritImages,
} from './products.ts';

function esc(value: string): string {
  return (value || '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));
}
const won = (n: number) => `${n.toLocaleString('ko-KR')}원`;
const imageUrl = (id: string) => `/img/products/${encodeURIComponent(id)}`;

const NO_IMAGES: ProductImages = new Set();
const NO_FACES: SpiritImages = new Set();

export function renderDailyReportProductPage(
  product: Product,
  info: BusinessInfo,
  ready: boolean,
  footer: string,
  images: ProductImages = NO_IMAGES,
  faces: SpiritImages = NO_FACES,
  sample: { text: string; notice: string } | null = null,
  initialQuery?: { date?: string; time?: string; place?: string; gender?: string },
): string {
  const site = show(info, 'serviceName', '늘봄사주');
  const spirit = spiritOf(product.category);
  const cleanHook = (product.hook || '').replace(/^[\"\'\s]+|[\"\'\s]+$/g, '');

  let initialPreviewData: DailyPreviewData | null = null;
  if (initialQuery?.date) {
    try {
      initialPreviewData = buildDailyPreviewData({
        date: initialQuery.date,
        time: initialQuery.time,
        place: initialQuery.place,
        gender: initialQuery.gender,
      });
    } catch {
      initialPreviewData = null;
    }
  }

  // 12개 출생지 목록 옵션
  const placeOptions = PLACES.map((p) => {
    const selected = initialQuery?.place === p.name ? ' selected' : (p.name === '서울' && !initialQuery?.place ? ' selected' : '');
    return `<option value="${esc(p.name)}"${selected}>${esc(p.name)}</option>`;
  }).join('');

  // 12개 시진 시간 옵션
  const timeOptions = [
    { val: '모름', label: '모름' },
    { val: '23:30', label: '자시 (밤 11:30 ~ 새벽 1:30)' },
    { val: '01:30', label: '축시 (새벽 1:30 ~ 3:30)' },
    { val: '03:30', label: '인시 (새벽 3:30 ~ 5:30)' },
    { val: '05:30', label: '묘시 (아침 5:30 ~ 7:30)' },
    { val: '07:30', label: '진시 (아침 7:30 ~ 9:30)' },
    { val: '09:30', label: '사시 (오전 9:30 ~ 11:30)' },
    { val: '11:30', label: '오시 (낮 11:30 ~ 1:30)' },
    { val: '13:30', label: '미시 (낮 1:30 ~ 3:30)' },
    { val: '15:30', label: '신시 (오후 3:30 ~ 5:30)' },
    { val: '17:30', label: '유시 (저녁 5:30 ~ 7:30)' },
    { val: '19:30', label: '술시 (저녁 7:30 ~ 9:30)' },
    { val: '21:30', label: '해시 (밤 9:30 ~ 11:30)' },
  ].map((t) => {
    const sel = initialQuery?.time === t.val ? ' selected' : '';
    return `<option value="${t.val}"${sel}>${t.label}</option>`;
  }).join('');

  // SSR 결과 HTML (만약 쿼리가 들어왔을 때)
  const initialResultHtml = initialPreviewData ? renderDailyPreviewHtml(initialPreviewData, product) : '';

  return `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
${renderSocialHead(info, {
    title: product.name,
    description: `${product.hook} ${product.description}`,
    path: `/products/${encodeURIComponent(product.id)}`,
  })}
${FONT_LINK}
<style>
:root{color-scheme:dark}
body{margin:0;background:var(--nb-paper)}
${PRODUCTS_CSS}

/* ── 오늘의 운세 전용 스타일 ───────────────────────── */
.dp-page {
  padding-bottom: 90px;
}

/* 0단계: 바로 밑에 오는 입력칸 */
.dp-form-card {
  background: var(--nb-paper-2);
  border: 1px solid var(--nb-line);
  border-radius: 16px;
  padding: 22px 18px;
  margin: 0 0 32px 0;
  box-shadow: 0 8px 24px rgba(0,0,0,0.6);
}

.dp-form-title {
  font-family: var(--nb-serif);
  font-size: 1.15rem;
  color: var(--nb-gold-2);
  margin: 0 0 16px 0;
  text-align: center;
}

.dp-form-row {
  margin-bottom: 15px;
}

.dp-label {
  display: block;
  font-size: 0.86rem;
  font-weight: 600;
  color: var(--nb-ink-2);
  margin-bottom: 6px;
}

.dp-input, .dp-select {
  width: 100%;
  box-sizing: border-box;
  padding: 12px 14px;
  font-size: 0.95rem;
  font-family: inherit;
  color: var(--nb-ink);
  background: var(--nb-paper-3);
  border: 1px solid rgba(212,175,55,0.3);
  border-radius: 8px;
  outline: none;
  transition: border-color 0.2s;
}

.dp-input:focus, .dp-select:focus {
  border-color: var(--nb-gold);
}

.dp-field-helper {
  font-size: 0.78rem;
  color: var(--nb-ink-3);
  margin: 5px 0 0 0;
  line-height: 1.4;
}

.dp-gender-group {
  display: flex;
  gap: 16px;
  padding-top: 4px;
}

.dp-radio {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 0.95rem;
  color: var(--nb-ink);
  cursor: pointer;
}

.dp-btn-submit {
  display: block;
  width: 100%;
  padding: 14px 20px;
  margin-top: 18px;
  background: linear-gradient(135deg, #d4af37, #f0d478);
  color: #1a1208;
  font-size: 1.08rem;
  font-weight: 800;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  box-shadow: 0 4px 14px rgba(212,175,55,0.3);
  transition: opacity 0.2s, transform 0.1s;
}

.dp-btn-submit:active {
  transform: scale(0.98);
}

.dp-free-notice {
  text-align: center;
  margin: 10px 0 0 0;
  font-size: 0.92rem;
  font-weight: 700;
  color: var(--nb-gold-2);
  letter-spacing: -0.01em;
}

/* 1단계: 명식판 */
.dp-myeongsik-card {
  background: linear-gradient(180deg, #12121e 0%, #0d0c15 100%);
  border: 1.5px solid var(--nb-gold);
  border-radius: 16px;
  padding: 24px 16px;
  margin-bottom: 28px;
  box-shadow: 0 10px 30px rgba(0,0,0,0.8), 0 0 18px rgba(212,175,55,0.15);
  text-align: center;
}

.dp-pillars-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 8px;
  margin-bottom: 20px;
}

.dp-pillar-col {
  display: flex;
  flex-direction: column;
  align-items: center;
  background: rgba(255,255,255,0.02);
  border-radius: 8px;
  padding: 10px 2px;
}

.dp-pillar-hanja {
  font-family: var(--nb-serif);
  font-size: 2.15rem;
  font-weight: 700;
  line-height: 1.25;
  color: #f3e0a3;
  text-shadow: 0 0 12px rgba(243, 224, 163, 0.45);
}

.dp-pillar-hangul {
  font-size: 0.88rem;
  color: var(--nb-ink-2);
  margin-top: 6px;
}

.dp-pillar-line {
  width: 70%;
  height: 1px;
  background: rgba(212,175,55,0.4);
  margin: 8px 0;
}

.dp-pillar-label {
  font-family: var(--nb-serif);
  font-size: 0.85rem;
  color: var(--nb-gold);
  font-weight: 600;
}

.dp-calc-note {
  font-size: 0.84rem;
  color: var(--nb-ink-2);
  line-height: 1.6;
  border-top: 1px solid rgba(255,255,255,0.08);
  padding-top: 14px;
  word-break: keep-all;
}

.dp-calc-solar {
  color: var(--nb-gold-2);
  font-weight: 600;
}

.dp-reset-box {
  margin-top: 14px;
  font-size: 0.82rem;
  color: var(--nb-ink-3);
}

.dp-reset-link {
  background: none;
  border: none;
  padding: 0;
  color: var(--nb-gold);
  text-decoration: underline;
  cursor: pointer;
  font-size: inherit;
  font-family: inherit;
}

/* 2단계: 오늘 한 줄 */
.dp-section {
  margin-bottom: 30px;
}

.dp-today-date {
  font-family: var(--nb-serif);
  font-size: 0.94rem;
  color: var(--nb-gold);
  margin: 0 0 6px 0;
}

.dp-today-headline {
  font-family: var(--nb-serif);
  font-size: 1.48rem;
  font-weight: 700;
  color: #ffffff;
  line-height: 1.35;
  margin: 0 0 12px 0;
  word-break: keep-all;
}

.dp-today-reading {
  font-size: 0.95rem;
  line-height: 1.7;
  color: var(--nb-ink-2);
  margin: 0 0 16px 0;
  word-break: keep-all;
}

.dp-stamp-box {
  display: inline-block;
  background: rgba(158, 27, 50, 0.25);
  border: 1px solid var(--nb-crimson);
  border-radius: 6px;
  padding: 6px 12px;
  margin-bottom: 16px;
}

.dp-stamp-tag {
  font-family: var(--nb-serif);
  font-size: 0.92rem;
  color: #ff9da8;
  font-weight: 600;
}

.dp-why-box {
  background: var(--nb-paper-2);
  border: 1px dashed rgba(212,175,55,0.4);
  border-radius: 8px;
  padding: 14px 16px;
  font-size: 0.88rem;
  line-height: 1.65;
  color: var(--nb-ink-2);
  word-break: keep-all;
}

.dp-why-box-title {
  color: var(--nb-gold);
  font-family: monospace;
  font-size: 0.8rem;
  margin-bottom: 6px;
}

.dp-why-box-bottom {
  color: var(--nb-gold);
  font-family: monospace;
  font-size: 0.8rem;
  margin-top: 6px;
  text-align: right;
}

/* 3단계: 이 손님은 어떤 사람인가 */
.dp-person-card {
  background: var(--nb-paper-2);
  border: 1px solid var(--nb-line-soft);
  border-radius: 14px;
  padding: 18px 16px;
}

.dp-subhead {
  font-family: var(--nb-serif);
  font-size: 1.25rem;
  color: #ffffff;
  margin: 0 0 16px 0;
}

.dp-person-item {
  margin-bottom: 14px;
  font-size: 0.9rem;
  line-height: 1.6;
}

.dp-person-item:last-child {
  margin-bottom: 0;
}

.dp-person-item strong {
  display: block;
  font-size: 0.82rem;
  color: var(--nb-gold);
  margin-bottom: 4px;
}

.dp-person-item p {
  margin: 0;
  color: var(--nb-ink-2);
  word-break: keep-all;
}

.dp-elements-row {
  font-family: var(--nb-sans);
  color: var(--nb-ink);
  font-weight: 500;
}

.dp-sinsal-stamps {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-top: 6px;
}

.dp-sinsal-badge {
  display: inline-block;
  background: rgba(212,175,55,0.1);
  border: 1px solid rgba(212,175,55,0.3);
  border-radius: 6px;
  padding: 6px 10px;
  font-size: 0.84rem;
  color: var(--nb-gold-2);
  word-break: keep-all;
}

/* 4단계: 열두 시진, 둘만 엽니다 */
.dp-hours-card {
  background: var(--nb-paper-2);
  border: 1px solid var(--nb-line);
  border-radius: 16px;
  padding: 20px 16px;
}

.dp-hours-lead {
  font-size: 0.92rem;
  line-height: 1.6;
  color: var(--nb-ink-2);
  margin: 0 0 16px 0;
  word-break: keep-all;
}

.dp-hour-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 12px;
  border-radius: 8px;
  margin-bottom: 8px;
}

.dp-hour-open {
  background: rgba(255,255,255,0.04);
  border: 1px solid rgba(212,175,55,0.35);
}

.dp-hour-left {
  display: flex;
  align-items: baseline;
  gap: 6px;
  width: 55px;
}

.dp-hour-hanja {
  font-family: var(--nb-serif);
  font-size: 1.15rem;
  color: var(--nb-gold-2);
  font-weight: 700;
}

.dp-hour-name {
  font-size: 0.85rem;
  color: var(--nb-ink);
}

.dp-hour-mid {
  display: flex;
  flex-direction: column;
  flex: 1;
  padding: 0 8px;
}

.dp-hour-time {
  font-size: 0.82rem;
  color: var(--nb-ink-2);
}

.dp-hour-gods {
  font-size: 0.8rem;
  color: var(--nb-ink-3);
}

.dp-hour-badge {
  font-size: 0.78rem;
  color: #7ef5a0;
  background: rgba(126,245,160,0.12);
  border: 1px solid rgba(126,245,160,0.3);
  border-radius: 4px;
  padding: 4px 8px;
  white-space: nowrap;
}

.dp-mist-divider {
  font-family: monospace;
  font-size: 0.8rem;
  color: var(--nb-gold);
  opacity: 0.7;
  text-align: center;
  margin: 18px 0 10px 0;
}

.dp-hours-mist-container {
  position: relative;
  overflow: hidden;
  max-height: 180px;
}

.dp-hour-fog {
  background: transparent;
  border-bottom: 1px solid rgba(255,255,255,0.03);
  padding: 8px 12px;
}

.dp-hour-blur {
  letter-spacing: 2px;
  color: rgba(255,255,255,0.18);
  font-family: monospace;
  user-select: none;
}

/* 안개 가림막: 배경색으로 잠기게 */
.dp-mist-scrim {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: linear-gradient(to bottom, rgba(18,18,28,0.1) 0%, rgba(18,18,28,0.7) 40%, rgba(18,18,28,0.98) 85%, var(--nb-paper-2) 100%);
  pointer-events: none;
}

.dp-hours-notice {
  text-align: center;
  margin-top: 14px;
  font-size: 0.9rem;
  line-height: 1.55;
  color: var(--nb-ink-2);
}

.dp-warn-highlight {
  color: #ffb8b8;
}

/* 5단계: 나머지 가림막 */
.dp-locked-card {
  background: var(--nb-paper-2);
  border: 1px solid var(--nb-line-soft);
  border-radius: 14px;
  padding: 20px 16px;
}

.dp-locked-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.dp-locked-item {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 10px 12px;
  background: rgba(255,255,255,0.02);
  border-radius: 8px;
  border-left: 2px solid var(--nb-gold);
}

.dp-locked-badge {
  font-family: var(--nb-serif);
  font-size: 1.05rem;
  font-weight: 700;
  color: var(--nb-gold);
  width: 24px;
  flex-shrink: 0;
  text-align: center;
}

.dp-locked-desc strong {
  display: block;
  font-size: 0.92rem;
  color: #ffffff;
  margin-bottom: 2px;
}

.dp-locked-desc p {
  margin: 0;
  font-size: 0.82rem;
  color: var(--nb-ink-3);
  line-height: 1.4;
}

/* 6단계: 값 */
.dp-price-card {
  background: linear-gradient(135deg, rgba(30, 24, 40, 0.95) 0%, rgba(16, 12, 22, 0.98) 100%);
  border: 1.5px solid var(--nb-gold);
  border-radius: 16px;
  padding: 24px 18px;
  text-align: center;
  box-shadow: 0 10px 28px rgba(0,0,0,0.6);
}

.dp-price-amount {
  font-family: var(--nb-serif);
  font-size: 2.1rem;
  font-weight: 700;
  color: var(--nb-gold-2);
}

.dp-price-vat {
  font-size: 0.85rem;
  color: var(--nb-ink-3);
}

.dp-btn-buy {
  display: block;
  width: 100%;
  box-sizing: border-box;
  padding: 15px 20px;
  margin: 16px 0 12px 0;
  background: linear-gradient(135deg, #d4af37, #f0d478);
  color: #1a1208;
  font-size: 1.12rem;
  font-weight: 800;
  text-decoration: none;
  border-radius: 8px;
  box-shadow: 0 4px 16px rgba(212,175,55,0.35);
  transition: opacity 0.2s, transform 0.1s;
}

.dp-btn-buy:active {
  transform: scale(0.98);
}

.dp-guarantee-text {
  font-size: 0.84rem;
  color: var(--nb-ink-2);
  line-height: 1.6;
  margin: 0;
}
</style>
</head>
<body>
<section class="pr dp-page">
  <div class="pd-top-nav">
    <a class="pd-back" href="/products">← 판매 상품 전체 보기</a>
  </div>

  ${images.has(product.id)
    ? `<div class="pd-hero-box">
        <img class="pd-hero" src="${imageUrl(product.id)}" alt="" width="390" height="520" loading="eager" decoding="async">
        <div class="pd-hero-scrim"></div>
        <div class="pd-hero-overlay">
          ${spirit ? `<div class="pd-hero-spirit">${esc(spirit.name)}</div>` : ''}
          <h1 class="pd-hero-title">${esc(product.name)}</h1>
          <p class="pd-hero-hook">"${esc(cleanHook)}"</p>
        </div>
      </div>`
    : `<div style="margin-bottom: 24px;">
        <p class="pr-hook">${esc(product.hook)}</p>
        <h2>${esc(product.name)}</h2>
      </div>`}

  <!-- 0단계: 바로 밑에 오는 입력칸 -->
  <form id="dpForm" class="dp-form-card" onsubmit="return false;">
    <h3 class="dp-form-title">내 사주로 오늘 운세 풀기</h3>
    <div class="dp-form-row">
      <label for="dpName" class="dp-label">성함</label>
      <input type="text" id="dpName" class="dp-input" placeholder="성함 (선택)">
    </div>
    <div class="dp-form-row">
      <label for="dpDate" class="dp-label">생년월일</label>
      <input type="date" id="dpDate" class="dp-input" required value="${initialQuery?.date || ''}">
    </div>
    <div class="dp-form-row">
      <label for="dpTime" class="dp-label">태어난 시간</label>
      <input type="text" id="dpTime" list="dpTimeList" class="dp-input" placeholder="모름 / 자시 … 해시 또는 직접 입력 (예: 낮 2시 40분)" value="${initialQuery?.time || ''}">
      <datalist id="dpTimeList">
        <option value="모름">모름</option>
        <option value="낮 2시 40분">낮 2시 40분 (14:40)</option>
        <option value="자시">자시 (밤 11:30 ~ 01:30)</option>
        <option value="축시">축시 (새벽 01:30 ~ 03:30)</option>
        <option value="인시">인시 (새벽 03:30 ~ 05:30)</option>
        <option value="묘시">묘시 (아침 05:30 ~ 07:30)</option>
        <option value="진시">진시 (아침 07:30 ~ 09:30)</option>
        <option value="사시">사시 (오전 09:30 ~ 11:30)</option>
        <option value="오시">오시 (낮 11:30 ~ 13:30)</option>
        <option value="미시">미시 (낮 13:30 ~ 15:30)</option>
        <option value="신시">신시 (오후 15:30 ~ 17:30)</option>
        <option value="유시">유시 (저녁 17:30 ~ 19:30)</option>
        <option value="술시">술시 (밤 19:30 ~ 21:30)</option>
        <option value="해시">해시 (밤 21:30 ~ 23:30)</option>
      </datalist>
    </div>
    <div class="dp-form-row">
      <label for="dpPlace" class="dp-label">태어난 곳</label>
      <select id="dpPlace" class="dp-select">
        ${placeOptions}
      </select>
      <p class="dp-field-helper">태어난 곳에 따라 시(時)가 갈릴 수 있어 여쭙습니다</p>
    </div>
    <div class="dp-form-row">
      <label class="dp-label">성별</label>
      <div class="dp-gender-group">
        <label class="dp-radio"><input type="radio" name="dpGender" value="남"${initialQuery?.gender === '여' ? '' : ' checked'}> <span>남</span></label>
        <label class="dp-radio"><input type="radio" name="dpGender" value="여"${initialQuery?.gender === '여' ? ' checked' : ''}> <span>여</span></label>
      </div>
    </div>
    <button type="submit" id="dpSubmit" class="dp-btn-submit">▶ 내 오늘 보기</button>
    <p class="dp-free-notice">값 안 받습니다</p>
  </form>

  <!-- 1단계 ~ 6단계 결과 영역 -->
  <div id="dpResult">
    ${initialResultHtml}
  </div>

  <!-- 7단계: 지금 있는 설명들을 여기로 내립니다 -->
  <div id="dpExplanations">
    ${renderWhy()}
    ${renderFit(product.id)}
  </div>

  <!-- 화면 아래에 붙어 따라다니는 사는 자리 -->
  <aside class="pd-sticky">
    <span class="pd-sticky-price">${won(product.priceKrw)}<small>부가세 포함</small></span>
    <a class="pd-sticky-go" href="/checkout?product=${encodeURIComponent(product.id)}">받기</a>
  </aside>

</section>
${footer}

<script>
(function() {
  const form = document.getElementById('dpForm');
  const resultDiv = document.getElementById('dpResult');
  const submitBtn = document.getElementById('dpSubmit');

  // 저장된 세션 읽기
  try {
    const saved = JSON.parse(sessionStorage.getItem('nb_reading') || '{}');
    if (saved && saved.birth) {
      if (saved.birth.name && document.getElementById('dpName')) document.getElementById('dpName').value = saved.birth.name;
      if (saved.birth.date && document.getElementById('dpDate') && !document.getElementById('dpDate').value) document.getElementById('dpDate').value = saved.birth.date;
      if (saved.birth.time && document.getElementById('dpTime')) document.getElementById('dpTime').value = saved.birth.time;
      if (saved.birth.place && document.getElementById('dpPlace')) document.getElementById('dpPlace').value = saved.birth.place;
      if (saved.birth.gender) {
        const rad = document.querySelector('input[name="dpGender"][value="' + saved.birth.gender + '"]');
        if (rad) rad.checked = true;
      }
    }
  } catch (e) {}

  function handleReset() {
    form.scrollIntoView({ behavior: 'smooth', block: 'start' });
    const dateInput = document.getElementById('dpDate');
    if (dateInput) dateInput.focus();
  }

  // 다시 넣기 버튼 위임
  document.addEventListener('click', function(e) {
    if (e.target && (e.target.id === 'dpResetBtn' || e.target.classList.contains('dp-reset-link'))) {
      handleReset();
    }
  });

  form.addEventListener('submit', async function(e) {
    e.preventDefault();
    const name = (document.getElementById('dpName').value || '').trim();
    const date = (document.getElementById('dpDate').value || '').trim();
    const rawTime = (document.getElementById('dpTime').value || '').trim();
    function parseClientTime(val) {
      if (!val || val === '모름') return null;
      val = val.trim();
      if (/^\\d{1,2}:\\d{2}$/.test(val)) return val;
      const matchKorean = val.match(/(오전|오후|낮|새벽|저녁|밤)?\\s*(\\d{1,2})시\\s*(\\d{1,2})?분?/);
      if (matchKorean) {
        const prefix = matchKorean[1];
        let h = parseInt(matchKorean[2], 10);
        const m = matchKorean[3] ? parseInt(matchKorean[3], 10) : 0;
        if ((prefix === '오후' || prefix === '낮' || prefix === '저녁' || prefix === '밤') && h < 12) {
          h += 12;
        } else if ((prefix === '새벽' || prefix === '자정') && h === 12) {
          h = 0;
        }
        return String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0');
      }
      const SIJIN_MAP = {
        자시: '00:30', 축시: '02:30', 인시: '04:30', 묘시: '06:30',
        진시: '08:30', 사시: '10:30', 오시: '12:30', 미시: '14:30',
        신시: '16:30', 유시: '18:30', 술시: '20:30', 해시: '22:30',
      };
      for (const k in SIJIN_MAP) {
        if (val.includes(k)) return SIJIN_MAP[k];
      }
      return val;
    }
    const time = parseClientTime(rawTime);
    const place = document.getElementById('dpPlace').value;
    const genderRad = document.querySelector('input[name="dpGender"]:checked');
    const gender = genderRad ? genderRad.value : '남';

    if (!date) {
      alert('생년월일을 입력해 주십시오.');
      document.getElementById('dpDate').focus();
      return;
    }

    // 이름은 세션 스토리지에만 저장하고 서버 미리보기로는 생년월일/시간/장소/성별만 보낸다
    const readingData = {
      productId: 'daily-report',
      birth: { name, date, time: time === '모름' ? null : time, place, gender }
    };
    try {
      sessionStorage.setItem('nb_reading', JSON.stringify(readingData));
    } catch(err) {}

    submitBtn.disabled = true;
    submitBtn.textContent = '계산하고 있습니다…';

    try {
      const res = await fetch('/api/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId: 'daily-report',
          birth: { date, time: time === '모름' ? null : time, place, gender }
        })
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || '미리보기를 불러오지 못했습니다.');
      }

      const data = await res.json();
      if (data.dailyPreview) {
        resultDiv.innerHTML = renderDailyPreviewHtmlClient(data.dailyPreview, data.product || { priceKrw: 1900 });
        resultDiv.scrollIntoView({ behavior: 'smooth', block: 'start' });
      } else {
        // 백업: SSR 파라미터로 이동
        const qs = new URLSearchParams({ date, time, place, gender }).toString();
        window.location.search = qs;
      }
    } catch (err) {
      alert(err.message || '계산에 실패했습니다. 다시 시도해 주십시오.');
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = '▶ 내 오늘 보기';
    }
  });

  function renderDailyPreviewHtmlClient(p, prod) {
    const pillarsHtml = p.myeongsik.pillars.map(function(col) {
      return '<div class="dp-pillar-col">' +
        '<div class="dp-pillar-hanja">' + col.stemHanja + '</div>' +
        '<div class="dp-pillar-hanja">' + col.branchHanja + '</div>' +
        '<div class="dp-pillar-hangul">' + col.hangul + '</div>' +
        '<div class="dp-pillar-line"></div>' +
        '<div class="dp-pillar-label">' + col.label + '</div>' +
      '</div>';
    }).join('');

    const corrLines = (p.myeongsik.correctionText || '').split('\\n');
    const corrHtml = '<p>' + (corrLines[0] || '') + '</p>' +
      (corrLines[1] ? '<p class="dp-calc-solar">' + corrLines[1] + '</p>' : '');

    const elementsHtml = p.person.elements.map(function(e) {
      return '<span>' + e.element + ' ' + e.weight + '%</span>';
    }).join(' · ');

    const sinsalHtml = p.person.sinsalStamps.map(function(s) {
      return '<span class="dp-sinsal-badge">[' + s.name + '] ' + s.desc + '</span>';
    }).join('');

    const hoursRevealedHtml = p.hours.revealed.map(function(h) {
      return '<div class="dp-hour-item dp-hour-open">' +
        '<div class="dp-hour-left">' +
          '<span class="dp-hour-hanja">' + h.hanja + '</span>' +
          '<span class="dp-hour-name">' + h.시진 + '</span>' +
        '</div>' +
        '<div class="dp-hour-mid">' +
          '<span class="dp-hour-time">' + h.시각 + '</span>' +
          '<span class="dp-hour-gods">' + h.천간십신 + '/' + h.지지십신 + '</span>' +
        '</div>' +
        '<div class="dp-hour-badge">' + h.label + '</div>' +
      '</div>';
    }).join('');

    const hoursFoggyHtml = p.hours.foggy.map(function(f) {
      return '<div class="dp-hour-item dp-hour-fog">' +
        '<div class="dp-hour-left">' +
          '<span class="dp-hour-hanja">' + f.hanja + '</span>' +
          '<span class="dp-hour-name">' + f.시진 + '</span>' +
        '</div>' +
        '<div class="dp-hour-blur">▒▒▒▒▒▒▒▒▒▒▒▒▒▒</div>' +
      '</div>';
    }).join('');

    const lockedListHtml = p.lockedList.map(function(l) {
      return '<div class="dp-locked-item">' +
        '<span class="dp-locked-badge">' + l.badge + '</span>' +
        '<div class="dp-locked-desc">' +
          '<strong>' + l.title + '</strong>' +
          '<p>' + l.desc + '</p>' +
        '</div>' +
      '</div>';
    }).join('');

    const priceWon = Number(prod.priceKrw || 1900).toLocaleString() + '원';

    return '<section class="dp-myeongsik-card">' +
      '<div class="dp-pillars-grid">' + pillarsHtml + '</div>' +
      '<div class="dp-calc-note">' + corrHtml + '</div>' +
      '<div class="dp-reset-box">' +
        '<span>잘못 넣으셨나요?</span> <button type="button" id="dpResetBtn" class="dp-reset-link">[다시 넣기]</button>' +
      '</div>' +
    '</section>' +

    '<section class="dp-section">' +
      '<p class="dp-today-date">' + p.today.dateKorean + '</p>' +
      '<h2 class="dp-today-headline">' + p.today.headline + '</h2>' +
      '<p class="dp-today-reading">' + p.today.reading + '</p>' +
      '<div class="dp-stamp-box">' +
        '<span class="dp-stamp-tag">' + p.today.stampText + '</span>' +
      '</div>' +
      '<div class="dp-why-box">' +
        '<div class="dp-why-box-title">┌ 왜 그렇게 봅니까 ─────────────┐</div>' +
        '<div class="dp-why-box-body">' + p.today.whyBox + '</div>' +
        '<div class="dp-why-box-bottom">└────────────────────────────┘</div>' +
      '</div>' +
    '</section>' +

    '<section class="dp-section dp-person-card">' +
      '<h3 class="dp-subhead">이 손님은 어떤 사람인가</h3>' +
      '<div class="dp-person-item">' +
        '<strong>일간의 기운</strong>' +
        '<p>' + p.person.dayMaster.nature + '</p>' +
      '</div>' +
      '<div class="dp-person-item">' +
        '<strong>오행의 쏠림 (숫자 그대로)</strong>' +
        '<div class="dp-elements-row">' + elementsHtml + '</div>' +
      '</div>' +
      '<div class="dp-person-item">' +
        '<strong>없는 기운</strong>' +
        '<p>' + p.person.missingText + '</p>' +
      '</div>' +
      '<div class="dp-person-item">' +
        '<strong>눈에 띄는 신살</strong>' +
        '<div class="dp-sinsal-stamps">' + sinsalHtml + '</div>' +
      '</div>' +
    '</section>' +

    '<section class="dp-section dp-hours-card">' +
      '<h3 class="dp-subhead">열두 시진, 둘만 엽니다</h3>' +
      '<p class="dp-hours-lead">' +
        '열두 시진을 하나씩 다 쟀습니다. 그중 <strong>유리하면서 부딪힘까지 없는</strong> 두 시간을 먼저 보여드립니다.' +
      '</p>' +
      '<div class="dp-hours-revealed">' + hoursRevealedHtml + '</div>' +
      '<div class="dp-mist-divider">── 여기서부터 안개 ──────────────────</div>' +
      '<div class="dp-hours-mist-container">' +
        '<div class="dp-hours-foggy">' + hoursFoggyHtml + '</div>' +
        '<div class="dp-mist-scrim"></div>' +
      '</div>' +
      '<div class="dp-hours-notice">' +
        '<p>나머지 열 시진은 가려 두었습니다</p>' +
        '<p class="dp-warn-highlight">그 안에 <strong>오늘 제일 조심할 두 시간</strong>이 있습니다</p>' +
      '</div>' +
    '</section>' +

    '<section class="dp-section dp-locked-card">' +
      '<h3 class="dp-subhead">나머지 리포트에 담긴 것</h3>' +
      '<div class="dp-locked-list">' + lockedListHtml + '</div>' +
    '</section>' +

    '<section class="dp-section dp-price-card">' +
      '<div class="dp-price-tag">' +
        '<span class="dp-price-amount">' + priceWon + '</span>' +
        '<span class="dp-price-vat"> (부가세 포함)</span>' +
      '</div>' +
      '<a id="dpBuyBtn" href="/checkout?product=daily-report" class="dp-btn-buy">' +
        '▶ 오늘 전부 보기' +
      '</a>' +
      '<p class="dp-guarantee-text">' +
        '결제하시면 바로 보실 수 있습니다.<br>' +
        '7일 안에 열람하지 않으셨으면 전액 돌려드립니다.' +
      '</p>' +
    '</section>';
  }
})();
</script>
</body>
</html>`;
}

export function renderDailyPreviewHtml(p: DailyPreviewData, product: Product): string {
  const pillarsHtml = p.myeongsik.pillars.map((col) => {
    return `<div class="dp-pillar-col">
      <div class="dp-pillar-hanja">${col.stemHanja}</div>
      <div class="dp-pillar-hanja">${col.branchHanja}</div>
      <div class="dp-pillar-hangul">${col.hangul}</div>
      <div class="dp-pillar-line"></div>
      <div class="dp-pillar-label">${col.label}</div>
    </div>`;
  }).join('');

  const corrLines = p.myeongsik.correctionText.split('\n');
  const corrHtml = `<p>${esc(corrLines[0] || '')}</p>`
    + (corrLines[1] ? `<p class="dp-calc-solar">${esc(corrLines[1])}</p>` : '');

  const elementsHtml = p.person.elements.map((e) => `<span>${e.element} ${e.weight}%</span>`).join(' · ');
  const sinsalHtml = p.person.sinsalStamps.map((s) => `<span class="dp-sinsal-badge">[${esc(s.name)}] ${esc(s.desc)}</span>`).join('');

  const hoursRevealedHtml = p.hours.revealed.map((h) => {
    return `<div class="dp-hour-item dp-hour-open">
      <div class="dp-hour-left">
        <span class="dp-hour-hanja">${esc(h.hanja)}</span>
        <span class="dp-hour-name">${esc(h.시진)}</span>
      </div>
      <div class="dp-hour-mid">
        <span class="dp-hour-time">${esc(h.시각)}</span>
        <span class="dp-hour-gods">${esc(h.천간십신)}/${esc(h.지지십신)}</span>
      </div>
      <div class="dp-hour-badge">${esc(h.label)}</div>
    </div>`;
  }).join('');

  const hoursFoggyHtml = p.hours.foggy.map((f) => {
    return `<div class="dp-hour-item dp-hour-fog">
      <div class="dp-hour-left">
        <span class="dp-hour-hanja">${esc(f.hanja)}</span>
        <span class="dp-hour-name">${esc(f.시진)}</span>
      </div>
      <div class="dp-hour-blur">▒▒▒▒▒▒▒▒▒▒▒▒▒▒</div>
    </div>`;
  }).join('');

  const lockedListHtml = p.lockedList.map((l) => {
    return `<div class="dp-locked-item">
      <span class="dp-locked-badge">${esc(l.badge)}</span>
      <div class="dp-locked-desc">
        <strong>${esc(l.title)}</strong>
        <p>${esc(l.desc)}</p>
      </div>
    </div>`;
  }).join('');

  return `<section class="dp-myeongsik-card">
    <div class="dp-pillars-grid">
      ${pillarsHtml}
    </div>
    <div class="dp-calc-note">
      ${corrHtml}
    </div>
    <div class="dp-reset-box">
      <span>잘못 넣으셨나요?</span> <button type="button" id="dpResetBtn" class="dp-reset-link">[다시 넣기]</button>
    </div>
  </section>

  <section class="dp-section">
    <p class="dp-today-date">${esc(p.today.dateKorean)}</p>
    <h2 class="dp-today-headline">${esc(p.today.headline)}</h2>
    <p class="dp-today-reading">${esc(p.today.reading)}</p>
    <div class="dp-stamp-box">
      <span class="dp-stamp-tag">${esc(p.today.stampText)}</span>
    </div>
    <div class="dp-why-box">
      <div class="dp-why-box-title">┌ 왜 그렇게 봅니까 ─────────────┐</div>
      <div class="dp-why-box-body">
        ${esc(p.today.whyBox)}
      </div>
      <div class="dp-why-box-bottom">└────────────────────────────┘</div>
    </div>
  </section>

  <section class="dp-section dp-person-card">
    <h3 class="dp-subhead">이 손님은 어떤 사람인가</h3>
    <div class="dp-person-item">
      <strong>일간의 기운</strong>
      <p>${esc(p.person.dayMaster.nature)}</p>
    </div>
    <div class="dp-person-item">
      <strong>오행의 쏠림 (숫자 그대로)</strong>
      <div class="dp-elements-row">
        ${elementsHtml}
      </div>
    </div>
    <div class="dp-person-item">
      <strong>없는 기운</strong>
      <p>${esc(p.person.missingText)}</p>
    </div>
    <div class="dp-person-item">
      <strong>눈에 띄는 신살</strong>
      <div class="dp-sinsal-stamps">
        ${sinsalHtml}
      </div>
    </div>
  </section>

  <section class="dp-section dp-hours-card">
    <h3 class="dp-subhead">열두 시진, 둘만 엽니다</h3>
    <p class="dp-hours-lead">
      열두 시진을 하나씩 다 쟀습니다. 그중 <strong>유리하면서 부딪힘까지 없는</strong> 두 시간을 먼저 보여드립니다.
    </p>
    <div class="dp-hours-revealed">
      ${hoursRevealedHtml}
    </div>
    <div class="dp-mist-divider">── 여기서부터 안개 ──────────────────</div>
    <div class="dp-hours-mist-container">
      <div class="dp-hours-foggy">
        ${hoursFoggyHtml}
      </div>
      <div class="dp-mist-scrim"></div>
    </div>
    <div class="dp-hours-notice">
      <p>나머지 열 시진은 가려 두었습니다</p>
      <p class="dp-warn-highlight">그 안에 <strong>오늘 제일 조심할 두 시간</strong>이 있습니다</p>
    </div>
  </section>

  <section class="dp-section dp-locked-card">
    <h3 class="dp-subhead">나머지 리포트에 담긴 것</h3>
    <div class="dp-locked-list">
      ${lockedListHtml}
    </div>
  </section>

  <section class="dp-section dp-price-card">
    <div class="dp-price-tag">
      <span class="dp-price-amount">${won(product.priceKrw)}</span>
      <span class="dp-price-vat"> (부가세 포함)</span>
    </div>
    <a id="dpBuyBtn" href="/checkout?product=daily-report" class="dp-btn-buy">
      ▶ 오늘 전부 보기
    </a>
    <p class="dp-guarantee-text">
      결제하시면 바로 보실 수 있습니다.<br>
      ${WITHDRAWAL_WINDOW_DAYS}일 안에 열람하지 않으셨으면 전액 돌려드립니다.
    </p>
  </section>`;
}
