import type { Product, BusinessInfo } from '../../commerce/src/index.ts';
import { PLACES, buildMonthPreviewData, parseInputTime, type MonthPreviewData } from '../../saju-rules/src/index.ts';
import { WITHDRAWAL_WINDOW_DAYS } from '../../commerce/src/refund.ts';
import { show } from './business.ts';
import { spiritOf } from './spirits.ts';
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

export function renderMonthReportProductPage(
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

  let initialPreviewData: MonthPreviewData | null = null;
  if (initialQuery?.date) {
    try {
      initialPreviewData = buildMonthPreviewData({
        date: initialQuery.date,
        time: initialQuery.time,
        place: initialQuery.place,
        gender: initialQuery.gender,
      });
    } catch {
      initialPreviewData = null;
    }
  }

  const placeOptions = PLACES.map((p) => {
    const selected = initialQuery?.place === p.name ? ' selected' : (p.name === '서울' && !initialQuery?.place ? ' selected' : '');
    return `<option value="${esc(p.name)}"${selected}>${esc(p.name)}</option>`;
  }).join('');

  const isInitialTimeUnknown = initialQuery?.time === '모름' || initialQuery?.time === 'unknown';
  const initialTimeVal = (initialQuery?.time && !isInitialTimeUnknown && /^\d{1,2}:\d{2}$/.test(initialQuery.time)) ? initialQuery.time : '';
  const initialTimeSlotVal = isInitialTimeUnknown ? (initialQuery?.time || 'unknown') : 'unknown';

  const initialResultHtml = initialPreviewData ? renderMonthPreviewHtml(initialPreviewData, product) : '';

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
p, li, label, h1, h2, h3, h4, h5,
.sub-desc-original, .co-pricenote, .pd-launch-bar, .pd-guarantee-note,
.form-hint, .spirits-menu-desc, .nb-launch-banner-text{
  text-wrap:pretty;
  word-break:keep-all;
  overflow-wrap:anywhere;
}
${PRODUCTS_CSS}

/* ── 월운세 전용 스타일 ───────────────────────── */
.mp-page {
  padding-bottom: 90px;
}

.mp-form-card {
  background: var(--nb-paper-2);
  border: 1px solid var(--nb-line);
  border-radius: 16px;
  padding: 22px 18px;
  margin: 0 0 32px 0;
  box-shadow: 0 8px 24px rgba(0,0,0,0.6);
}

.mp-form-title {
  font-family: var(--nb-sans);
  font-size: 1.15rem;
  color: var(--nb-gold-2);
  margin: 0 0 16px 0;
  text-align: center;
}

.mp-form-row {
  margin-bottom: 15px;
}

.mp-label {
  display: block;
  font-size: 0.94rem;
  font-weight: 600;
  color: var(--nb-ink-2);
  margin-bottom: 6px;
}

.mp-input, .mp-select {
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

.mp-input:focus, .mp-select:focus {
  border-color: var(--nb-gold);
}

.mp-field-helper {
  font-size: 0.88rem;
  color: var(--nb-ink-3);
  margin: 5px 0 0 0;
  line-height: 1.5;
}

.mp-gender-group {
  display: flex;
  gap: 16px;
  padding-top: 4px;
}

.mp-radio {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 0.95rem;
  color: var(--nb-ink);
  cursor: pointer;
}

.mp-btn-submit {
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

.mp-btn-submit:active {
  transform: scale(0.98);
}

.mp-free-notice {
  text-align: center;
  margin: 10px 0 0 0;
  font-size: 0.94rem;
  font-weight: 700;
  color: var(--nb-gold-2);
  letter-spacing: -0.01em;
}

/* 명식판 */
.mp-myeongsik-card {
  background: linear-gradient(180deg, #12121e 0%, #0d0c15 100%);
  border: 1.5px solid var(--nb-gold);
  border-radius: 16px;
  padding: 24px 16px;
  margin-bottom: 28px;
  box-shadow: 0 10px 30px rgba(0,0,0,0.8), 0 0 18px rgba(212,175,55,0.15);
  text-align: center;
}

.mp-pillars-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 8px;
  margin-bottom: 20px;
}

.mp-pillar-col {
  display: flex;
  flex-direction: column;
  align-items: center;
  background: rgba(255,255,255,0.02);
  border-radius: 8px;
  padding: 10px 2px;
}

.mp-pillar-hanja {
  font-family: var(--nb-serif);
  font-size: 2.15rem;
  font-weight: 700;
  line-height: 1.25;
  color: #f3e0a3;
  text-shadow: 0 0 12px rgba(243, 224, 163, 0.45);
}

.mp-pillar-hangul {
  font-size: 0.92rem;
  color: var(--nb-ink-2);
  margin-top: 6px;
}

.mp-pillar-line {
  width: 70%;
  height: 1px;
  background: rgba(212,175,55,0.4);
  margin: 8px 0;
}

.mp-pillar-label {
  font-family: var(--nb-sans);
  font-size: 0.92rem;
  color: var(--nb-gold);
  font-weight: 600;
}

.mp-calc-note {
  font-size: 0.92rem;
  color: var(--nb-ink-2);
  line-height: 1.85;
  border-top: 1px solid rgba(255,255,255,0.08);
  padding-top: 14px;
  word-break: keep-all;
}

.mp-calc-solar {
  color: var(--nb-gold-2);
  font-weight: 600;
}

.mp-reset-box {
  margin-top: 14px;
  font-size: 0.88rem;
  color: var(--nb-ink-3);
}

.mp-reset-link {
  background: none;
  border: none;
  padding: 0;
  color: var(--nb-gold);
  text-decoration: underline;
  cursor: pointer;
  font-size: inherit;
  font-family: inherit;
}

/* 1번 칸: 이번 달 자리 (전체 공개) */
.mp-section {
  margin-bottom: 30px;
}

.mp-month-headline {
  font-family: var(--nb-sans);
  font-size: 1.35rem;
  font-weight: 700;
  color: #ffffff;
  line-height: 1.45;
  margin: 0 0 12px 0;
  word-break: keep-all;
}

.mp-month-reading {
  font-size: 1rem;
  line-height: 1.85;
  color: var(--nb-ink-2);
  margin: 0 0 16px 0;
  word-break: keep-all;
}

.mp-why-box {
  background: var(--nb-paper-2);
  border: 1px dashed rgba(212,175,55,0.4);
  border-radius: 8px;
  padding: 14px 16px;
  font-size: 0.92rem;
  line-height: 1.85;
  color: var(--nb-ink-2);
  word-break: keep-all;
}

.mp-why-box-title {
  color: var(--nb-gold);
  font-family: var(--nb-sans);
  font-size: 0.88rem;
  margin-bottom: 6px;
  font-weight: 600;
}

/* 2, 3, 4번 칸: 돈·일·사람 (두 줄 공개 + 안개) */
.mp-topics-grid {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.mp-topic-card {
  background: var(--nb-paper-2);
  border: 1px solid var(--nb-line-soft);
  border-radius: 14px;
  padding: 18px 16px;
}

.mp-topic-header {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  margin-bottom: 10px;
}

.mp-topic-title {
  font-family: var(--nb-sans);
  font-size: 1.15rem;
  font-weight: 700;
  color: var(--nb-gold-2);
  margin: 0;
}

.mp-topic-ask {
  font-size: 0.88rem;
  color: var(--nb-ink-3);
}

.mp-topic-revealed {
  font-size: 0.95rem;
  line-height: 1.85;
  color: var(--nb-ink);
  margin: 0 0 8px 0;
  word-break: keep-all;
}

.mp-topic-mist-container {
  position: relative;
  overflow: hidden;
  margin-top: 6px;
}

.mp-topic-foggy {
  font-size: 0.95rem;
  line-height: 1.85;
  color: rgba(255,255,255,0.25);
  filter: blur(4px);
  user-select: none;
}

.mp-mist-scrim {
  position: absolute;
  top: 0; left: 0; right: 0; bottom: 0;
  background: linear-gradient(
    to bottom,
    rgba(18, 18, 28, 0.05) 0%,
    rgba(18, 18, 28, 0.4) 30%,
    rgba(18, 18, 28, 0.85) 75%,
    var(--nb-paper-2) 100%
  );
  pointer-events: none;
}

/* 5번 칸: 날 (좋은 날 하나 공개 + 나머지 다섯 안개) */
.mp-days-card {
  background: var(--nb-paper-2);
  border: 1px solid var(--nb-line);
  border-radius: 16px;
  padding: 20px 16px;
}

.mp-subhead {
  font-family: var(--nb-sans);
  font-size: 1.25rem;
  color: #ffffff;
  margin: 0 0 12px 0;
}

.mp-days-lead {
  font-size: 0.95rem;
  line-height: 1.85;
  color: var(--nb-ink-2);
  margin: 0 0 16px 0;
  word-break: keep-all;
}

.mp-day-revealed-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 14px;
  border-radius: 8px;
  background: rgba(126,245,160,0.08);
  border: 1px solid rgba(126,245,160,0.3);
  margin-bottom: 12px;
}

.mp-day-left {
  display: flex;
  flex-direction: column;
}

.mp-day-date {
  font-family: var(--nb-sans);
  font-size: 1.05rem;
  font-weight: 700;
  color: #ffffff;
}

.mp-day-pillar {
  font-size: 0.9rem;
  color: var(--nb-ink-2);
  margin-top: 2px;
}

.mp-day-badge {
  font-size: 0.88rem;
  font-weight: 700;
  color: #7ef5a0;
  background: rgba(126,245,160,0.15);
  padding: 4px 8px;
  border-radius: 4px;
}

.mp-days-foggy-container {
  position: relative;
  overflow: hidden;
  margin-top: 8px;
}

.mp-day-foggy-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 14px;
  border-bottom: 1px solid rgba(255,255,255,0.04);
}

.mp-day-fog-blur {
  letter-spacing: 2px;
  color: rgba(255,255,255,0.2);
  font-family: monospace;
  filter: blur(4px);
  user-select: none;
}

.mp-days-notice {
  text-align: center;
  margin-top: 14px;
  font-size: 0.92rem;
  color: var(--nb-ink-2);
}

.mp-warn-highlight {
  color: #ffb8b8;
}

/* 6번 칸: 액션 */
.mp-action-card {
  background: var(--nb-paper-2);
  border: 1px solid var(--nb-line-soft);
  border-radius: 14px;
  padding: 18px 16px;
  border-left: 3px solid var(--nb-gold);
}

.mp-action-title {
  font-family: var(--nb-sans);
  font-size: 1.05rem;
  font-weight: 700;
  color: var(--nb-gold-2);
  margin: 0 0 6px 0;
}

.mp-action-desc {
  font-size: 0.92rem;
  color: var(--nb-ink-2);
  margin: 0;
  line-height: 1.85;
}

/* 맨 아래 값 카드 */
.mp-price-card {
  background: linear-gradient(135deg, rgba(30, 24, 40, 0.95) 0%, rgba(16, 12, 22, 0.98) 100%);
  border: 1.5px solid var(--nb-gold);
  border-radius: 16px;
  padding: 24px 18px;
  text-align: center;
  box-shadow: 0 10px 28px rgba(0,0,0,0.6);
  margin-top: 30px;
}

.mp-price-amount {
  font-family: var(--nb-sans);
  font-size: 2.1rem;
  font-weight: 700;
  color: var(--nb-gold-2);
}

.mp-price-vat {
  font-size: 0.88rem;
  color: var(--nb-ink-3);
}

.mp-btn-buy {
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

.mp-btn-buy:active {
  transform: scale(0.98);
}

.mp-guarantee-text {
  font-size: 0.9rem;
  color: var(--nb-ink-2);
  line-height: 1.85;
  letter-spacing: 0.2px;
  margin: 0;
}
</style>
</head>
<body>
<section class="pr mp-page">
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
  <form id="mpForm" class="mp-form-card" onsubmit="return false;">
    <h3 class="mp-form-title">내 사주로 한 달 운세 풀기</h3>
    <div class="mp-form-row">
      <label for="mpName" class="mp-label">성함</label>
      <input type="text" id="mpName" class="mp-input" placeholder="성함 (선택)">
    </div>
    <div class="mp-form-row">
      <label for="mpDate" class="mp-label">생년월일</label>
      <input type="date" id="mpDate" class="mp-input" required value="${initialQuery?.date || ''}">
    </div>
    <div class="mp-form-row">
      <label for="mpTime" class="mp-label" style="white-space:nowrap;">태어난 시간 (시:분)</label>
      <div style="display:flex;gap:8px;align-items:center;">
        <input type="time" id="mpTime" class="mp-input" style="flex:1 1 auto;" value="${initialTimeVal}"${isInitialTimeUnknown ? ' disabled' : ''}>
        <label for="mpTimeUnknown" style="display:flex;align-items:center;gap:4px;font-size:12px;color:#c8c2d4;cursor:pointer;white-space:nowrap;margin-bottom:0;">
          <input type="checkbox" id="mpTimeUnknown" style="width:auto;margin:0;"${isInitialTimeUnknown ? ' checked' : ''}> 모름
        </label>
      </div>
      <select id="mpTimeSlot" class="mp-select" style="display:${isInitialTimeUnknown ? 'block' : 'none'};margin-top:6px;">
        <option value="unknown"${initialTimeSlotVal === 'unknown' ? ' selected' : ''}>시간 모름 (낮 12시로 계산)</option>
        <option value="ja"${initialTimeSlotVal === 'ja' ? ' selected' : ''}>자시 (23:30~01:29)</option>
        <option value="chuk"${initialTimeSlotVal === 'chuk' ? ' selected' : ''}>축시 (01:30~03:29)</option>
        <option value="in"${initialTimeSlotVal === 'in' ? ' selected' : ''}>인시 (03:30~05:29)</option>
        <option value="myo"${initialTimeSlotVal === 'myo' ? ' selected' : ''}>묘시 (05:30~07:29)</option>
        <option value="jin"${initialTimeSlotVal === 'jin' ? ' selected' : ''}>진시 (07:30~09:29)</option>
        <option value="sa"${initialTimeSlotVal === 'sa' ? ' selected' : ''}>사시 (09:30~11:29)</option>
        <option value="o"${initialTimeSlotVal === 'o' ? ' selected' : ''}>오시 (11:30~13:29)</option>
        <option value="mi"${initialTimeSlotVal === 'mi' ? ' selected' : ''}>미시 (13:30~15:29)</option>
        <option value="sin"${initialTimeSlotVal === 'sin' ? ' selected' : ''}>신시 (15:30~17:29)</option>
        <option value="yu"${initialTimeSlotVal === 'yu' ? ' selected' : ''}>유시 (17:30~19:29)</option>
        <option value="sul"${initialTimeSlotVal === 'sul' ? ' selected' : ''}>술시 (19:30~21:29)</option>
        <option value="hae"${initialTimeSlotVal === 'hae' ? ' selected' : ''}>해시 (21:30~23:29)</option>
      </select>
    </div>
    <div class="mp-form-row">
      <label for="mpPlace" class="mp-label">태어난 곳</label>
      <select id="mpPlace" class="mp-select">
        ${placeOptions}
      </select>
      <p class="mp-field-helper">태어난 곳에 따라 시(時)가 갈릴 수 있어 여쭙습니다</p>
    </div>
    <div class="mp-form-row">
      <label class="mp-label">성별</label>
      <div class="mp-gender-group">
        <label class="mp-radio"><input type="radio" name="mpGender" value="남"${initialQuery?.gender === '여' ? '' : ' checked'}> <span>남</span></label>
        <label class="mp-radio"><input type="radio" name="mpGender" value="여"${initialQuery?.gender === '여' ? ' checked' : ''}> <span>여</span></label>
      </div>
    </div>
    <button type="submit" id="mpSubmit" class="mp-btn-submit">▶ 내 이번 달 보기</button>
    <p class="mp-free-notice">값 안 받습니다</p>
  </form>

  <!-- 결과 영역 -->
  <div id="mpResult">
    ${initialResultHtml}
  </div>

  <!-- 설명 영역 -->
  <div id="mpExplanations">
    ${renderWhy()}
    ${renderFit(product.id)}
  </div>

</section>
<div style="height:24px"></div>
${footer}

<!-- 화면 아래에 붙어 따라다니는 사는 자리 -->
<aside class="pd-sticky">
  <a class="pd-sticky-go" href="/checkout?product=${encodeURIComponent(product.id)}">더욱 자세한 내용 받기</a>
</aside>

<script>
(function() {
  const form = document.getElementById('mpForm');
  const resultDiv = document.getElementById('mpResult');
  const submitBtn = document.getElementById('mpSubmit');

  function updateCheckoutLinks(){
    try {
      var sp = new URLSearchParams(location.search);
      var qEmail = sp.get('email');
      var qReward = sp.get('invite_reward');
      if (qEmail || qReward) {
        document.querySelectorAll('#mpBuyBtn, .pd-sticky-go').forEach(function(a){
          var href = a.getAttribute('href');
          if (href && href.indexOf('/checkout') !== -1) {
            var sep = href.indexOf('?') === -1 ? '?' : '&';
            if (qEmail && href.indexOf('email=') === -1) href += sep + 'email=' + encodeURIComponent(qEmail), sep = '&';
            if (qReward && href.indexOf('invite_reward=') === -1) href += sep + 'invite_reward=' + encodeURIComponent(qReward);
            a.setAttribute('href', href);
          }
        });
        if (qReward === '5') {
          document.querySelectorAll('.mp-price-amount').forEach(function(el){ el.textContent = '0원 (이용권)'; });
          var buyBtn = document.getElementById('mpBuyBtn');
          if (buyBtn) buyBtn.textContent = '▶ 무료로 한 달 운세 보기 (이용권)';
        }
      }
    } catch(e){}
  }
  updateCheckoutLinks();

  const TIME_MAP = {
    'ja': '00:30', 'chuk': '02:30', 'in': '04:30', 'myo': '06:30',
    'jin': '08:30', 'sa': '10:30', 'o': '12:30', 'mi': '14:30',
    'sin': '16:30', 'yu': '18:30', 'sul': '20:30', 'hae': '22:30',
    'unknown': '12:00'
  };

  const timeInput = document.getElementById('mpTime');
  const timeUnknown = document.getElementById('mpTimeUnknown');
  const timeSlot = document.getElementById('mpTimeSlot');

  if (timeUnknown) {
    timeUnknown.addEventListener('change', function() {
      const unk = timeUnknown.checked;
      if (timeSlot) timeSlot.style.display = unk ? 'block' : 'none';
      if (timeInput) {
        timeInput.disabled = unk;
        if (unk) timeInput.value = '';
      }
    });
  }

  try {
    const saved = JSON.parse(sessionStorage.getItem('nb_reading') || '{}');
    if (saved && saved.birth) {
      if (saved.birth.name && document.getElementById('mpName')) document.getElementById('mpName').value = saved.birth.name;
      if (saved.birth.date && document.getElementById('mpDate') && !document.getElementById('mpDate').value) document.getElementById('mpDate').value = saved.birth.date;
      if (timeInput) {
        const b = saved.birth;
        if (b.timeKnown === false || b.time === '모름' || b.time === 'unknown' || !b.time) {
          if (timeUnknown) {
            timeUnknown.checked = true;
            if (timeSlot) {
              timeSlot.style.display = 'block';
              let matched = false;
              for (const [k, v] of Object.entries(TIME_MAP)) {
                if (v === b.time || k === b.time) {
                  timeSlot.value = k;
                  matched = true;
                  break;
                }
              }
              if (!matched) timeSlot.value = 'unknown';
            }
            timeInput.disabled = true;
            timeInput.value = '';
          }
        } else {
          if (timeUnknown) timeUnknown.checked = false;
          if (timeSlot) timeSlot.style.display = 'none';
          timeInput.disabled = false;
          timeInput.value = b.time;
        }
      }
      if (saved.birth.place && document.getElementById('mpPlace')) document.getElementById('mpPlace').value = saved.birth.place;
      if (saved.birth.gender) {
        const rad = document.querySelector('input[name="mpGender"][value="' + saved.birth.gender + '"]');
        if (rad) rad.checked = true;
      }
    }
  } catch (e) {}

  function handleReset() {
    form.scrollIntoView({ behavior: 'smooth', block: 'start' });
    const dateInput = document.getElementById('mpDate');
    if (dateInput) dateInput.focus();
  }

  document.addEventListener('click', function(e) {
    if (e.target && (e.target.id === 'mpResetBtn' || e.target.classList.contains('mp-reset-link'))) {
      handleReset();
    }
  });

  form.addEventListener('submit', async function(e) {
    e.preventDefault();
    const name = (document.getElementById('mpName').value || '').trim();
    const date = (document.getElementById('mpDate').value || '').trim();
    const isUnk = timeUnknown ? timeUnknown.checked : false;
    let finalTime = '12:00';
    let timeKnown = true;

    if (isUnk) {
      timeKnown = false;
      const slot = (timeSlot && timeSlot.value) || 'unknown';
      finalTime = TIME_MAP[slot] || '12:00';
    } else if (timeInput && timeInput.value) {
      finalTime = timeInput.value;
      timeKnown = true;
    } else {
      timeKnown = false;
      finalTime = '12:00';
    }

    const place = document.getElementById('mpPlace').value;
    const genderRad = document.querySelector('input[name="mpGender"]:checked');
    const gender = genderRad ? genderRad.value : '남';

    if (!date) {
      alert('생년월일을 입력해 주십시오.');
      document.getElementById('mpDate').focus();
      return;
    }

    const readingData = {
      productId: 'month-report',
      birth: { name, date, time: finalTime, timeKnown, place, gender }
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
          productId: 'month-report',
          birth: { date, time: finalTime, timeKnown, place, gender }
        })
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || '미리보기를 불러오지 못했습니다.');
      }

      const data = await res.json();
      if (data.monthPreview) {
        resultDiv.innerHTML = renderMonthPreviewHtmlClient(data.monthPreview, data.product || { priceKrw: 9900 });
        resultDiv.scrollIntoView({ behavior: 'smooth', block: 'start' });
      } else {
        const qs = new URLSearchParams({ date, time: finalTime, place, gender }).toString();
        window.location.search = qs;
      }
    } catch (err) {
      alert(err.message || '계산에 실패했습니다. 다시 시도해 주십시오.');
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = '▶ 내 이번 달 보기';
    }
  });

  function renderMonthPreviewHtmlClient(p, prod) {
    var noticeText = p.notice || (p.targetYear ? p.targetYear + '년 ' + p.targetMonth + '월 운세입니다' : '한 달 운세입니다');
    var noticeHtml = '<div class="mp-month-target-badge" style="text-align:center;font-size:1.15rem;font-weight:700;color:var(--nb-gold-2);margin-bottom:14px;letter-spacing:-0.01em;">' + noticeText + '</div>';

    const pillarsHtml = p.myeongsik.pillars.map(function(col) {
      return '<div class="mp-pillar-col">' +
        '<div class="mp-pillar-hanja">' + col.stemHanja + '</div>' +
        '<div class="mp-pillar-hanja">' + col.branchHanja + '</div>' +
        '<div class="mp-pillar-hangul">' + col.hangul + '</div>' +
        '<div class="mp-pillar-line"></div>' +
        '<div class="mp-pillar-label">' + col.label + '</div>' +
      '</div>';
    }).join('');

    const corrLines = (p.myeongsik.correctionText || '').split('\\n');
    const corrHtml = '<p>' + (corrLines[0] || '') + '</p>' +
      (corrLines[1] ? '<p class="mp-calc-solar">' + corrLines[1] + '</p>' : '');

    function renderTopicClient(topic) {
      const revHtml = topic.revealedLines.map(function(l) { return '<p class="mp-topic-revealed">' + l + '</p>'; }).join('');
      const fogHtml = topic.foggyLines.map(function(l) { return '<p>' + l + '</p>'; }).join('');
      return '<div class="mp-topic-card">' +
        '<div class="mp-topic-header">' +
          '<h4 class="mp-topic-title">' + topic.name + '</h4>' +
          '<span class="mp-topic-ask">' + topic.ask + '</span>' +
        '</div>' +
        revHtml +
        '<div class="mp-topic-mist-container">' +
          '<div class="mp-topic-foggy">' + fogHtml + '</div>' +
          '<div class="mp-mist-scrim"></div>' +
        '</div>' +
      '</div>';
    }

    const goodRevealed = p.days.goodRevealed;
    const goodHtml = '<div class="mp-day-revealed-item">' +
      '<div class="mp-day-left">' +
        '<span class="mp-day-date">' + goodRevealed.date + '</span>' +
        '<span class="mp-day-pillar">' + goodRevealed.pillar + ' · ' + goodRevealed.stemGod + '/' + goodRevealed.branchGod + '</span>' +
      '</div>' +
      '<span class="mp-day-badge">길일 (유리)</span>' +
    '</div>';

    const foggyDays = [...(p.days.goodFoggy || []), ...(p.days.badFoggy || [])];
    const foggyDaysHtml = foggyDays.map(function(d, idx) {
      return '<div class="mp-day-foggy-item">' +
        '<span class="mp-day-date">' + d.date + '</span>' +
        '<span class="mp-day-fog-blur">▒▒▒▒▒▒▒▒ ' + (idx < 2 ? '길일' : '조심') + ' ▒▒</span>' +
      '</div>';
    }).join('');

    const priceWon = Number(prod.priceKrw || 9900).toLocaleString() + '원';

    return noticeHtml + '<section class="mp-myeongsik-card">' +
      '<div class="mp-pillars-grid">' + pillarsHtml + '</div>' +
      '<div class="mp-calc-note">' + corrHtml + '</div>' +
      '<div class="mp-reset-box">' +
        '<span>잘못 넣으셨나요?</span> <button type="button" id="mpResetBtn" class="mp-reset-link">[다시 넣기]</button>' +
      '</div>' +
    '</section>' +

    '<section class="mp-section">' +
      '<h2 class="mp-month-headline">1. 이번 달, 그대는 어떤 자리에 있는가</h2>' +
      '<p class="mp-month-reading">' + p.thisMonth.fullDescription + '</p>' +
      '<div class="mp-why-box">' +
        '<div class="mp-why-box-title">┌ 계산 근거 ───────────────────┐</div>' +
        '<div class="mp-why-box-body">' + p.thisMonth.whyBox + '</div>' +
      '</div>' +
    '</section>' +

    '<section class="mp-section">' +
      '<h3 class="mp-subhead">2~4. 돈 · 일 · 사람의 흐름</h3>' +
      '<div class="mp-topics-grid">' +
        renderTopicClient(p.topics.money) +
        renderTopicClient(p.topics.career) +
        renderTopicClient(p.topics.people) +
      '</div>' +
    '</section>' +

    '<section class="mp-section mp-days-card">' +
      '<h3 class="mp-subhead">5. 이번 달의 날들 — 좋은 날 셋 · 조심할 날 셋</h3>' +
      '<p class="mp-days-lead">이번 달 남은 날 중 <strong>가장 좋은 날 하나</strong>를 먼저 짚어 드립니다.</p>' +
      goodHtml +
      '<div class="mp-days-foggy-container">' +
        foggyDaysHtml +
        '<div class="mp-mist-scrim"></div>' +
      '</div>' +
      '<div class="mp-days-notice">' +
        '<p>나머지 다섯 날(좋은 날 둘 + <span class="mp-warn-highlight">조심할 날 셋</span>)은 리포트에서 확인하실 수 있습니다</p>' +
      '</div>' +
    '</section>' +

    '<section class="mp-section mp-action-card">' +
      '<h4 class="mp-action-title">6. ' + p.actionNotice.title + '</h4>' +
      '<p class="mp-action-desc">' + p.actionNotice.desc + '</p>' +
    '</section>' +

    '<section class="mp-section mp-price-card">' +
      '<div class="mp-price-tag">' +
        '<span class="mp-price-amount">' + priceWon + '</span>' +
        '<span class="mp-price-vat"> (부가세 포함)</span>' +
      '</div>' +
      '<a id="mpBuyBtn" href="/checkout?product=month-report" class="mp-btn-buy">' +
        '▶ 한 달 운세 전부 보기' +
      '</a>' +
      '<p class="mp-guarantee-text">' +
        '결제하시면 바로 보실 수 있습니다.<br>' +
        '${WITHDRAWAL_WINDOW_DAYS}일 안에 열람하지 않으셨으면 전액 돌려드립니다.' +
      '</p>' +
    '</section>';
    updateCheckoutLinks();
  }
})();
</script>
</body>
</html>`;
}

function renderMonthPreviewHtml(p: MonthPreviewData, prod: Product): string {
  const pillarsHtml = p.myeongsik.pillars.map((col) => {
    return `<div class="mp-pillar-col">
      <div class="mp-pillar-hanja">${col.stemHanja}</div>
      <div class="mp-pillar-hanja">${col.branchHanja}</div>
      <div class="mp-pillar-hangul">${col.hangul}</div>
      <div class="mp-pillar-line"></div>
      <div class="mp-pillar-label">${col.label}</div>
    </div>`;
  }).join('');

  const corrLines = (p.myeongsik.correctionText || '').split('\n');
  const corrHtml = `<p>${corrLines[0] || ''}</p>` +
    (corrLines[1] ? `<p class="mp-calc-solar">${corrLines[1]}</p>` : '');

  function renderTopic(topic: typeof p.topics.money) {
    const revHtml = topic.revealedLines.map((l) => `<p class="mp-topic-revealed">${l}</p>`).join('');
    const fogHtml = topic.foggyLines.map((l) => `<p>${l}</p>`).join('');
    return `<div class="mp-topic-card">
      <div class="mp-topic-header">
        <h4 class="mp-topic-title">${topic.name}</h4>
        <span class="mp-topic-ask">${topic.ask}</span>
      </div>
      ${revHtml}
      <div class="mp-topic-mist-container">
        <div class="mp-topic-foggy">${fogHtml}</div>
        <div class="mp-mist-scrim"></div>
      </div>
    </div>`;
  }

  const goodRevealed = p.days.goodRevealed;
  const goodHtml = `<div class="mp-day-revealed-item">
    <div class="mp-day-left">
      <span class="mp-day-date">${goodRevealed.date}</span>
      <span class="mp-day-pillar">${goodRevealed.pillar} · ${goodRevealed.stemGod}/${goodRevealed.branchGod}</span>
    </div>
    <span class="mp-day-badge">길일 (유리)</span>
  </div>`;

  const foggyDays = [...(p.days.goodFoggy || []), ...(p.days.badFoggy || [])];
  const foggyDaysHtml = foggyDays.map((d, idx) => {
    return `<div class="mp-day-foggy-item">
      <span class="mp-day-date">${d.date}</span>
      <span class="mp-day-fog-blur">▒▒▒▒▒▒▒▒ ${idx < 2 ? '길일' : '조심'} ▒▒</span>
    </div>`;
  }).join('');

  const priceWon = Number(prod.priceKrw || 9900).toLocaleString() + '원';
  const noticeText = p.notice || (p.targetYear ? `${p.targetYear}년 ${p.targetMonth}월 운세입니다` : '한 달 운세입니다');
  const noticeHtml = `<div class="mp-month-target-badge" style="text-align:center;font-size:1.15rem;font-weight:700;color:var(--nb-gold-2);margin-bottom:14px;letter-spacing:-0.01em;">${esc(noticeText)}</div>`;

  return `${noticeHtml}
  <section class="mp-myeongsik-card">
    <div class="mp-pillars-grid">${pillarsHtml}</div>
    <div class="mp-calc-note">${corrHtml}</div>
    <div class="mp-reset-box">
      <span>잘못 넣으셨나요?</span> <button type="button" id="mpResetBtn" class="mp-reset-link">[다시 넣기]</button>
    </div>
  </section>

  <section class="mp-section">
    <h2 class="mp-month-headline">1. 이번 달, 그대는 어떤 자리에 있는가</h2>
    <p class="mp-month-reading">${p.thisMonth.fullDescription}</p>
    <div class="mp-why-box">
      <div class="mp-why-box-title">┌ 계산 근거 ───────────────────┐</div>
      <div class="mp-why-box-body">${p.thisMonth.whyBox}</div>
    </div>
  </section>

  <section class="mp-section">
    <h3 class="mp-subhead">2~4. 돈 · 일 · 사람의 흐름</h3>
    <div class="mp-topics-grid">
      ${renderTopic(p.topics.money)}
      ${renderTopic(p.topics.career)}
      ${renderTopic(p.topics.people)}
    </div>
  </section>

  <section class="mp-section mp-days-card">
    <h3 class="mp-subhead">5. 이번 달의 날들 — 좋은 날 셋 · 조심할 날 셋</h3>
    <p class="mp-days-lead">이번 달 남은 날 중 <strong>가장 좋은 날 하나</strong>를 먼저 짚어 드립니다.</p>
    ${goodHtml}
    <div class="mp-days-foggy-container">
      ${foggyDaysHtml}
      <div class="mp-mist-scrim"></div>
    </div>
    <div class="mp-days-notice">
      <p>나머지 다섯 날(좋은 날 둘 + <span class="mp-warn-highlight">조심할 날 셋</span>)은 리포트에서 확인하실 수 있습니다</p>
    </div>
  </section>

  <section class="mp-section mp-action-card">
    <h4 class="mp-action-title">6. ${p.actionNotice.title}</h4>
    <p class="mp-action-desc">${p.actionNotice.desc}</p>
  </section>

  <section class="mp-section mp-price-card">
    <a id="mpBuyBtn" href="/checkout?product=month-report" class="mp-btn-buy">
      더욱 자세한 내용 받기
    </a>
    <p class="mp-guarantee-text">
      결제하시면 바로 보실 수 있습니다.<br>
      ${WITHDRAWAL_WINDOW_DAYS}일 안에 열람하지 않으셨으면 전액 돌려드립니다.
    </p>
  </section>`;
}
