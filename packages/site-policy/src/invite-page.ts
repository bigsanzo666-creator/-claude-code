/**
 * 내 소개 현황 화면 (GET /invite).
 *
 * 검색에 걸리지 않는다 (noindex, nofollow).
 * 로그인은 없으며, 이메일과 생년월일로 연다.
 */

import {
  INVITE_DISCOUNT_KRW, INVITE_MIN_ORDER_KRW, INVITE_REWARD_DAYS, INVITE_REWARD_NAME, REWARD_TIERS,
} from '../../commerce/src/referral.ts';
import { type BusinessInfo, show } from './business.ts';
import { renderSocialHead } from './social.ts';
import { FONT_LINK, PRODUCTS_CSS } from './products.ts';
import { PLACES } from '../../saju-rules/src/index.ts';

const INVITE_PAGE_CSS = `
.iv-wrap { max-width: 680px; margin: 0 auto; padding: 24px 18px 80px; font-family: "Pretendard", "Noto Sans KR", -apple-system, BlinkMacSystemFont, "Apple SD Gothic Neo", sans-serif; }
.iv-brand { display: inline-block; font-size: 14px; color: #b9b2c6; text-decoration: none; margin-bottom: 18px; }
.iv-title { font-size: 24px; font-weight: 800; color: #f3e5ab; margin: 0 0 8px; }
.iv-desc { font-size: 16px; color: #c8c2d4; margin: 0 0 24px; line-height: 1.85; }
.iv-card { background: rgba(255, 255, 255, 0.04); border: 1px solid rgba(255, 255, 255, 0.12); border-radius: 12px; padding: 20px; margin-bottom: 24px; }
.iv-f { margin-bottom: 14px; }
.iv-f label { display: block; font-size: 14px; color: #c8c2d4; margin-bottom: 6px; }
.iv-f input, .iv-f select { width: 100%; box-sizing: border-box; padding: 11px 12px; font-size: 16px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.16); background: rgba(12,10,18,0.92); color: #f4f1f8; font-family: inherit; }
.iv-two { display: flex; gap: 10px; }
.iv-two > * { flex: 1 1 0; min-width: 0; }
.iv-btn { display: block; width: 100%; padding: 14px; font-size: 16px; font-weight: 800; border: none; border-radius: 8px; background: linear-gradient(135deg, #d4af37, #f0d478); color: #1a1208; cursor: pointer; font-family: inherit; }
.iv-btn:disabled { opacity: 0.5; cursor: not-allowed; }
.iv-summary { background: rgba(212, 175, 55, 0.08); border: 1.5px solid rgba(212, 175, 55, 0.42); border-radius: 14px; padding: 22px 20px; margin-bottom: 24px; text-align: center; }
.iv-summary.highlight { border-color: #f0d478; box-shadow: 0 0 28px rgba(212, 175, 55, 0.25); animation: ivPopIn 0.45s cubic-bezier(0.22, 1, 0.36, 1) both; }
@keyframes ivPopIn { from { opacity: 0; transform: translateY(14px) scale(0.985); } to { opacity: 1; transform: translateY(0) scale(1); } }
@media (prefers-reduced-motion: reduce) { .iv-summary.highlight { animation: none !important; transition: none !important; } }
.iv-hero-benefit { font-size: 19px; font-weight: 800; color: #f6d878; margin: 0 0 12px; line-height: 1.45; word-break: keep-all; }
.iv-badge-head { font-size: 14px; color: #c8c2d4; margin-bottom: 4px; }
.iv-badge-code { font-size: 22px; font-weight: 800; color: #f6d878; margin-bottom: 14px; letter-spacing: 0.06em; }
.iv-badge-actions { display: flex; flex-direction: column; gap: 10px; align-items: stretch; margin-bottom: 14px; }
.iv-badge-btn { padding: 10px 14px; font-size: 14px; font-weight: 700; border-radius: 8px; border: 1px solid rgba(255,255,255,0.22); background: transparent; color: #dcdce6; cursor: pointer; font-family: inherit; }
.iv-badge-btn.kakao { padding: 15px 18px; font-size: 16.5px; font-weight: 800; background: #fee500; border-color: #e5cc00; color: #191919; box-shadow: 0 4px 14px rgba(254, 229, 0, 0.22); }
.iv-progress-wrap { margin-top: 16px; padding-top: 14px; border-top: 1px solid rgba(255,255,255,0.1); text-align: left; }
.iv-progress-head { display: flex; justify-content: space-between; font-size: 13.5px; color: #e4dfea; margin-bottom: 8px; font-weight: 700; }
.iv-progress-track { position: relative; height: 10px; background: rgba(255,255,255,0.1); border-radius: 999px; overflow: hidden; }
.iv-progress-fill { height: 100%; background: linear-gradient(90deg, #d4af37, #f6d878); border-radius: 999px; transition: width 0.35s ease; }
.iv-progress-ticks { display: flex; justify-content: space-between; margin-top: 6px; font-size: 12px; color: #8f889c; }
.iv-progress-tick.reached { color: #f6d878; font-weight: 800; }
.iv-progress-tick.current { color: #4ade80; font-weight: 800; }
.iv-stats { display: flex; justify-content: space-around; border-top: 1px solid rgba(255,255,255,0.1); padding-top: 14px; margin-top: 14px; }
.iv-stat-num { font-size: 22px; font-weight: 800; color: #f3e5ab; }
.iv-stat-label { font-size: 14px; color: #a49cb2; margin-top: 2px; }
.iv-ladder-title { font-size: 18px; font-weight: 800; color: #f3e5ab; margin: 28px 0 14px; }
.iv-ladder-item { display: flex; justify-content: space-between; align-items: center; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); border-radius: 10px; padding: 16px; margin-bottom: 10px; gap: 12px; }
.iv-ladder-item.active { border-color: rgba(212, 175, 55, 0.4); background: rgba(212, 175, 55, 0.05); }
.iv-ladder-item.next-target { border: 1.5px solid #f0d478; background: rgba(212, 175, 55, 0.11); box-shadow: 0 0 16px rgba(212, 175, 55, 0.14); }
.iv-tier-badge { display: inline-block; margin-left: 6px; padding: 2px 7px; border-radius: 999px; font-size: 12px; font-weight: 800; vertical-align: middle; }
.iv-tier-badge.done { background: rgba(74, 222, 128, 0.18); color: #4ade80; }
.iv-tier-badge.next { background: #d4af37; color: #18151f; }
.iv-ladder-item.done { opacity: 0.7; }
.iv-ladder-info { flex: 1; }
.iv-ladder-tier { font-size: 14px; font-weight: 700; color: #d4af37; margin-bottom: 2px; }
.iv-ladder-name { font-size: 15px; font-weight: 700; color: #efeaf4; margin-bottom: 4px; }
.iv-ladder-desc { font-size: 14px; color: #a49cb2; line-height: 1.6; }
.iv-ladder-status { font-size: 14px; color: #9fd8a8; margin-top: 4px; }
.iv-act-btn { padding: 9px 16px; font-size: 15px; font-weight: 700; border-radius: 6px; border: 1px solid #d4af37; background: #d4af37; color: #18151f; cursor: pointer; white-space: nowrap; }
.iv-act-btn:disabled { background: rgba(255,255,255,0.1); border-color: transparent; color: #6b6478; cursor: not-allowed; }
.iv-act-btn.applied { background: transparent; border-color: rgba(255,255,255,0.2); color: #c8c2d4; cursor: default; }
.iv-law-note { margin-top: 32px; padding: 16px; background: rgba(0,0,0,0.3); border-radius: 8px; font-size: 14px; color: #8f889c; line-height: 1.85; }
.iv-lucky-box { margin-top: 14px; padding: 14px; background: rgba(0,0,0,0.4); border-radius: 8px; text-align: center; }
.iv-lucky-balls { display: flex; gap: 8px; justify-content: center; margin: 10px 0; }
.iv-ball { width: 34px; height: 34px; border-radius: 50%; background: #d4af37; color: #18151f; font-weight: 800; display: flex; align-items: center; justify-content: center; font-size: 14px; }
.iv-lucky-reason { font-size: 14px; color: #e4dfea; line-height: 1.85; white-space: pre-line; margin-top: 8px; }
.iv-disclaimer { font-size: 14px; color: #e8b4b4; margin-top: 10px; }
`;

export function renderInvitePage(info: BusinessInfo, footer: string): string {
  const site = show(info, 'serviceName', '늘봄사주');
  const placesOptions = PLACES.map((p) => `<option value="${p.name}">${p.name}</option>`).join('');

  return `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>내 소개 현황 — ${site}</title>
${FONT_LINK}
<style>
:root { color-scheme: dark; }
body { margin: 0; background: #0b0912; color: #efeaf4; }
${PRODUCTS_CSS}
${INVITE_PAGE_CSS}
</style>
<script src="https://t1.kakaocdn.net/kakao_js_sdk/2.7.4/kakao.min.js" defer></script>
<script>
window.KAKAO_JS_KEY = ${JSON.stringify(process.env.KAKAO_JS_KEY ?? '')};
</script>
</head>
<body>
<main class="iv-wrap">
  <a class="iv-brand" href="/">← ${site} 첫 화면</a>
  <h1 class="iv-title">내 소개 현황</h1>
  <p class="iv-desc">벗에게 내 증표를 전하고, 함께 복을 나누게.</p>

  <section class="iv-card" id="ivAuthCard">
    <form id="ivAuthForm">
      <div class="iv-f">
        <label for="authEmail">이메일 (결제 시 사용하신 이메일)</label>
        <input type="email" id="authEmail" name="email" autocomplete="email" required placeholder="your@email.com">
      </div>
      <div id="ivSavedBirthNote" style="display:none;font-size:13.5px;color:#c8c2d4;margin:-4px 0 14px;line-height:1.5;">
        <span id="ivSavedBirthLabel">저장된 명식으로 봅니다</span> · <button type="button" id="ivChangeBirthBtn" style="background:none;border:none;color:#f3e5ab;text-decoration:underline;cursor:pointer;font-size:13.5px;padding:0;font-family:inherit">바꾸기</button>
      </div>
      <div id="ivBirthFields">
        <div class="iv-two">
          <div class="iv-f">
            <label for="authDate">생년월일</label>
            <input type="date" id="authDate" name="birthDate" required>
          </div>
          <div class="iv-f">
            <label for="authGender">성별</label>
            <select id="authGender" name="gender">
              <option value="남">남</option>
              <option value="여">여</option>
            </select>
          </div>
        </div>
        <div class="iv-two">
          <div class="iv-f">
            <label for="authTime">태어난 시간</label>
            <input type="time" id="authTime" name="time" value="12:00">
          </div>
          <div class="iv-f">
            <label for="authPlace">태어난 곳</label>
            <select id="authPlace" name="place">${placesOptions}</select>
          </div>
        </div>
      </div>
      <button type="submit" class="iv-btn" id="ivAuthSubmit">내 증표와 보답 확인하기</button>
    </form>
  </section>

  <div id="ivContent" style="display:none">
    <section class="iv-summary" id="ivSummaryCard">
      <h2 class="iv-hero-benefit">벗은 ${INVITE_DISCOUNT_KRW.toLocaleString('ko-KR')}원 할인 · 그대는 ${INVITE_REWARD_NAME}</h2>
      <div class="iv-badge-head">그대의 고유 증표</div>
      <div class="iv-badge-code" id="ivMyCode">—</div>
      <p style="font-size:14.5px;color:#c8c2d4;margin:0 0 14px;line-height:1.85;">
        이 증표로 들어온 벗은 <b>${INVITE_DISCOUNT_KRW.toLocaleString('ko-KR')}원을 덜 낸다네.</b><br>
        벗이 첫 점사(${(INVITE_MIN_ORDER_KRW / 10000)}만원 이상)를 받으면 그대에게 <b>${INVITE_REWARD_NAME}</b> 무료 보답이 쌓인다네.
      </p>
      <div class="iv-badge-actions">
        <button type="button" class="iv-badge-btn kakao" id="ivKakaoBtn">카톡으로 벗에게 보내기</button>
        <button type="button" class="iv-badge-btn" id="ivCopyBtn">증표 주소 복사하기</button>
      </div>
      <p class="nb-invite-toast" id="ivCopyToast" style="display:none;color:#4ade80;font-size:14px;margin:8px 0 0">증표 주소가 복사되었습니다.</p>
      <div class="iv-stats">
        <div>
          <div class="iv-stat-num" id="ivCountVal">0명</div>
          <div class="iv-stat-label">소개 완료 (${(INVITE_MIN_ORDER_KRW / 10000)}만원 이상)</div>
        </div>
        <div>
          <div class="iv-stat-num" id="ivNextGoalVal">—</div>
          <div class="iv-stat-label" id="ivNextGoalLabel">다음 보답까지</div>
        </div>
      </div>
      <div class="iv-progress-wrap" id="ivProgressWrap">
        <div class="iv-progress-head">
          <span id="ivProgressLeft">지금 0명</span>
          <span id="ivProgressRight">다음 보답까지 1명</span>
        </div>
        <div class="iv-progress-track">
          <div class="iv-progress-fill" id="ivProgressFill" style="width:0%"></div>
        </div>
        <div class="iv-progress-ticks" id="ivProgressTicks"></div>
      </div>
    </section>

    <h2 class="iv-ladder-title">단계별 보답 사다리</h2>
    <div id="ivLadderList"></div>

    <div class="iv-law-note">
      <p style="margin:0 0 6px;font-weight:700;color:#e4dfea">보답 이용 안내</p>
      <ul style="margin:0;padding-left:18px">
        <li>소개받은 분이 ${(INVITE_MIN_ORDER_KRW / 10000)}만원 이상 결제를 완료해야 1명으로 집계됩니다.</li>
        <li>1명·3명·5명 보답은 달성 즉시 [바로 쓰기]로 이용하실 수 있습니다.</li>
        <li>7명 이상 보답은 [신청하기]를 누르시면 확인 후 정성껏 내어 드립니다.</li>
        <li>5명 월운세는 평생이 아니며 여섯 달 동안 제공됩니다.</li>
        <li>20명 보답은 평생이 아니며 1년 동안 제공됩니다.</li>
        <li>재미로 보시는 번호입니다. 돈을 거는 데 쓰지 마십시오.</li>
      </ul>
    </div>
  </div>
</main>
${footer}

<script>
(function(){
  var TIERS = ${JSON.stringify(REWARD_TIERS)};
  var authForm = document.getElementById('ivAuthForm');
  var authCard = document.getElementById('ivAuthCard');
  var content = document.getElementById('ivContent');
  var myCodeEl = document.getElementById('ivMyCode');
  var countValEl = document.getElementById('ivCountVal');
  var nextGoalValEl = document.getElementById('ivNextGoalVal');
  var nextGoalLabelEl = document.getElementById('ivNextGoalLabel');
  var ladderListEl = document.getElementById('ivLadderList');
  var copyBtn = document.getElementById('ivCopyBtn');
  var kakaoBtn = document.getElementById('ivKakaoBtn');

  var currentCode = '';
  var currentEmail = '';
  var currentBirth = {};

  function loadSavedReading(){
    try{
      var raw = sessionStorage.getItem('nb_reading');
      if(raw) return JSON.parse(raw);
    }catch(e){}
    return window.__nbReadingFallback || null;
  }

  (function prefillFromSession(){
    try{
      var savedEmail = '';
      try{
        savedEmail = sessionStorage.getItem('nb_email') || sessionStorage.getItem('nb_reward_email') || '';
      }catch(e){}
      var emailEl = document.getElementById('authEmail');
      if(savedEmail && emailEl && !emailEl.value) emailEl.value = savedEmail;

      var saved = loadSavedReading();
      var b = saved ? (saved.birth || saved) : null;
      var bDate = b && (b.date || b.birthDate);
      if(bDate){
        var dateEl = document.getElementById('authDate');
        var genderEl = document.getElementById('authGender');
        var timeEl = document.getElementById('authTime');
        var placeEl = document.getElementById('authPlace');
        if(dateEl) dateEl.value = bDate;
        if(genderEl && b.gender) genderEl.value = (b.gender === 'female' || b.gender === '여') ? '여' : '남';
        if(timeEl && b.time) timeEl.value = b.time;
        if(placeEl && b.place) placeEl.value = b.place;

        var birthFields = document.getElementById('ivBirthFields');
        var savedNote = document.getElementById('ivSavedBirthNote');
        var savedLabel = document.getElementById('ivSavedBirthLabel');
        var changeBtn = document.getElementById('ivChangeBirthBtn');
        var who = (b.name || '').trim();
        if(savedLabel) savedLabel.textContent = who ? (who + ' 님의 명식으로 봅니다') : '저장된 명식으로 봅니다';
        if(birthFields) birthFields.style.display = 'none';
        if(savedNote) savedNote.style.display = 'block';
        if(changeBtn){
          changeBtn.onclick = function(){
            if(birthFields) birthFields.style.display = 'block';
            if(savedNote) savedNote.style.display = 'none';
          };
        }
      }
    }catch(e){}
  })();

  async function postJson(url, body){
    var r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    var j = await r.json().catch(function(){ return {}; });
    if(!r.ok) throw new Error(j.error || ('오류가 발생했습니다 (' + r.status + ')'));
    return j;
  }

  function renderLadder(count, rewards){
    ladderListEl.innerHTML = '';
    var rewardMap = {};
    (rewards || []).forEach(function(r){ rewardMap[r.tier] = r; });

    var nextTier = null;
    TIERS.forEach(function(t){
      if(!nextTier && count < t.tier){
        nextTier = t;
      }
    });

    if(nextTier){
      nextGoalValEl.textContent = (nextTier.tier - count) + '명 남음';
      nextGoalLabelEl.textContent = nextTier.kind + '까지';
    }else{
      nextGoalValEl.textContent = '모두 달성';
      nextGoalLabelEl.textContent = '최고 단계 도달';
    }

    var pLeft = document.getElementById('ivProgressLeft');
    var pRight = document.getElementById('ivProgressRight');
    var pFill = document.getElementById('ivProgressFill');
    var pTicks = document.getElementById('ivProgressTicks');
    var maxTier = TIERS[TIERS.length - 1].tier;
    if(pLeft) pLeft.textContent = '지금 ' + count + '명';
    if(pRight) pRight.textContent = nextTier ? ('다음 보답까지 ' + (nextTier.tier - count) + '명') : '모든 단계 달성';
    if(pFill) pFill.style.width = Math.min(100, Math.round((count / maxTier) * 100)) + '%';
    if(pTicks){
      pTicks.innerHTML = TIERS.map(function(t){
        var cls = 'iv-progress-tick';
        if(count >= t.tier) cls += ' reached';
        else if(nextTier && t.tier === nextTier.tier) cls += ' current';
        return '<span class="' + cls + '">' + t.tier + '명</span>';
      }).join('');
    }

    TIERS.forEach(function(item){
      var achieved = count >= item.tier;
      var isNextTarget = Boolean(nextTier && item.tier === nextTier.tier);
      var rew = rewardMap[item.tier];
      var div = document.createElement('div');
      div.className = 'iv-ladder-item' + (achieved ? ' active' : '') + (isNextTarget ? ' next-target' : '');
      var badgeHtml = achieved
        ? '<span class="iv-tier-badge done">받음</span>'
        : (isNextTarget ? '<span class="iv-tier-badge next">다음 보답</span>' : '');

      if(item.tier === 1){
        var grantCount = (rew && rew.grantCount != null) ? rew.grantCount : (rew ? 1 : 0);
        var canGrantMore = count > grantCount;
        var expText = '';
        if(rew && rew.expiresAt){
          var expD = new Date(rew.expiresAt);
          expText = (expD.getMonth() + 1) + '월 ' + expD.getDate() + '일까지';
        }
        var statusText = '';
        if(grantCount > 0 && expText){
          statusText = '지금까지 ' + grantCount + '번 받음 · ' + expText;
        }

        var tier1Desc = '소개 한 분마다 오늘의 운세 30일이 더 붙습니다. 끊기지 않게 한 달에 한 분씩 소개해 주십시오.';

        var btnHtml = '';
        if(canGrantMore){
          btnHtml = '<button type="button" class="iv-act-btn" data-act="claim-daily" data-tier="1">30일 더 받기</button>';
        }else{
          btnHtml = '<button type="button" class="iv-act-btn" disabled>한 분 더 소개하시면 30일이 더 붙습니다</button>';
        }

        div.innerHTML =
          '<div class="iv-ladder-info">' +
            '<div class="iv-ladder-tier">' + item.tier + '명 달성 보답' + badgeHtml + '</div>' +
            '<div class="iv-ladder-name">' + item.kind + '</div>' +
            '<div class="iv-ladder-desc">' + tier1Desc + '</div>' +
            (statusText ? '<div class="iv-ladder-status">' + statusText + '</div>' : '') +
          '</div>' +
          '<div>' + btnHtml + '</div>';

        ladderListEl.appendChild(div);
        return;
      }

      var statusText = '';
      var isExpired = false;
      var isExhausted = false;

      if(rew && rew.expiresAt){
        isExpired = new Date(rew.expiresAt).getTime() <= Date.now();
      }
      if(rew && rew.maxUses != null){
        isExhausted = (rew.usedCount || 0) >= rew.maxUses;
      }

      var usedThisMonth = false;
      if(rew && rew.lastUsedAt){
        var nowD = new Date();
        var lastD = new Date(rew.lastUsedAt);
        var nowKst = new Date(nowD.getTime() + 9 * 3600000);
        var lastKst = new Date(lastD.getTime() + 9 * 3600000);
        usedThisMonth = (nowKst.getUTCFullYear() === lastKst.getUTCFullYear() && nowKst.getUTCMonth() === lastKst.getUTCMonth());
      }

      if(rew && (isExpired || isExhausted)){
        statusText = '기간이 지났네';
      }else if(rew && rew.status === '신청'){
        statusText = '신청이 들어갔네. 하루 안에 확인해 드리겠네.';
      }else if(rew && rew.status === '거절'){
        statusText = '신청이 반려되었습니다.';
      }else if(rew && rew.status === '내줌'){
        if(item.tier === 1){
          var msLeft = new Date(rew.expiresAt).getTime() - Date.now();
          var daysLeft = Math.max(0, Math.ceil(msLeft / (24 * 60 * 60 * 1000)));
          if(daysLeft <= 0){
            statusText = '기간이 지났네';
          }else{
            statusText = daysLeft + '일 남음';
          }
        }else if(item.tier === 5){
          var countNames = ['영', '한', '두', '세', '네', '다섯', '여섯'];
          var uc = rew.usedCount || 0;
          var countStr = countNames[uc] || (uc + '');
          if(uc === 0){
            statusText = '여섯 달 동안 이용 가능';
          }else if(usedThisMonth){
            var nextM = ((new Date().getMonth() + 1) % 12) + 1;
            statusText = '여섯 달 중 ' + countStr + ' 번 쓰심 · 다음은 ' + nextM + '월부터';
          }else{
            statusText = '여섯 달 중 ' + countStr + ' 번 쓰심 · 이번 달 이용 가능';
          }
        }else{
          statusText = '지급 완료 (' + (rew.expiresAt ? rew.expiresAt.slice(0,10) + '까지' : '이용 가능') + ')';
        }
      }else if(achieved && item.type === '자동'){
        statusText = '지금 바로 이용하실 수 있습니다.';
      }

      var btnHtml = '';
      if(item.type === '자동'){
        if(!achieved){
          btnHtml = '<button type="button" class="iv-act-btn" disabled>' + (item.tier - count) + '명 더</button>';
        }else if(rew && (isExpired || isExhausted)){
          btnHtml = '<button type="button" class="iv-act-btn" disabled>기간이 지났네</button>';
        }else{
          btnHtml = '<button type="button" class="iv-act-btn" data-act="use" data-tier="' + item.tier + '">바로 쓰기</button>';
        }
      }else{
        if(!achieved){
          btnHtml = '<button type="button" class="iv-act-btn" disabled>' + (item.tier - count) + '명 더</button>';
        }else if(rew && (isExpired || isExhausted)){
          btnHtml = '<button type="button" class="iv-act-btn" disabled>기간이 지났네</button>';
        }else if(rew && rew.status === '신청'){
          btnHtml = '<button type="button" class="iv-act-btn applied" disabled>신청 완료</button>';
        }else if(rew && rew.status === '내줌'){
          btnHtml = '<button type="button" class="iv-act-btn applied" disabled>내줌 완료</button>';
        }else{
          btnHtml = '<button type="button" class="iv-act-btn" data-act="apply" data-tier="' + item.tier + '">신청하기</button>';
        }
      }

      div.innerHTML =
        '<div class="iv-ladder-info">' +
          '<div class="iv-ladder-tier">' + item.tier + '명 달성 보답' + badgeHtml + '</div>' +
          '<div class="iv-ladder-name">' + item.kind + '</div>' +
          '<div class="iv-ladder-desc">' + item.description + '</div>' +
          (statusText ? '<div class="iv-ladder-status">' + statusText + '</div>' : '') +
          (item.tier === 3 ? '<div id="ivLuckyContainer" style="display:none"></div>' : '') +
        '</div>' +
        '<div>' + btnHtml + '</div>';

      ladderListEl.appendChild(div);
    });

    // Wire action buttons
    ladderListEl.querySelectorAll('[data-act="claim-daily"]').forEach(function(b){
      b.onclick = async function(){
        b.disabled = true;
        b.textContent = '받는 중…';
        try{
          var res = await postJson('/api/invite/reward/claim', { email: currentEmail, tier: 1 });
          try{
            sessionStorage.setItem('nb_reward_email', currentEmail);
            sessionStorage.setItem('nb_email', currentEmail);
          }catch(e){}
          if(res.message) alert(res.message);
          loadStatus(currentEmail, currentBirth);
        }catch(e){
          alert(e.message);
          b.disabled = false;
          b.textContent = '30일 더 받기';
        }
      };
    });

    ladderListEl.querySelectorAll('[data-act="apply"]').forEach(function(b){
      b.onclick = async function(){
        var tier = parseInt(b.getAttribute('data-tier'), 10);
        b.disabled = true;
        b.textContent = '신청 중…';
        try{
          await postJson('/api/invite/reward/apply', { email: currentEmail, tier: tier });
          alert('신청이 들어갔네. 하루 안에 확인해 드리겠네.');
          loadStatus(currentEmail, currentBirth);
        }catch(e){
          alert(e.message);
          b.disabled = false;
          b.textContent = '신청하기';
        }
      };
    });

    ladderListEl.querySelectorAll('[data-act="use"]').forEach(function(b){
      b.onclick = async function(){
        var tier = parseInt(b.getAttribute('data-tier'), 10);
        if(tier === 1 || tier === 5){
          var rew = rewardMap[tier];
          if(tier === 5 && rew && rew.lastUsedAt){
            var nowD = new Date();
            var lastD = new Date(rew.lastUsedAt);
            var nowKst = new Date(nowD.getTime() + 9 * 3600000);
            var lastKst = new Date(lastD.getTime() + 9 * 3600000);
            if(nowKst.getUTCFullYear() === lastKst.getUTCFullYear() && nowKst.getUTCMonth() === lastKst.getUTCMonth()){
              alert('이번 달 것은 이미 받으셨네.');
              return;
            }
          }
          b.disabled = true;
          b.textContent = '확인 중…';
          try{
            await postJson('/api/invite/reward/claim', { email: currentEmail, tier: tier });
            try{
              sessionStorage.setItem('nb_reward_email', currentEmail);
              sessionStorage.setItem('nb_email', currentEmail);
            }catch(e){}
            var target = tier === 1 ? '/products/daily-report' : '/products/month-report';
            location.href = target + '?email=' + encodeURIComponent(currentEmail) + '&invite_reward=' + tier;
          }catch(e){
            alert(e.message);
            b.disabled = false;
            b.textContent = '바로 쓰기';
          }
        }else if(tier === 3){
          b.disabled = true;
          b.textContent = '뽑는 중…';
          try{
            var res = await postJson('/api/invite/lucky-numbers', {
              email: currentEmail,
              birth: currentBirth
            });
            var luckyBox = document.getElementById('ivLuckyContainer');
            if(luckyBox){
              var balls = res.numbers.map(function(n){ return '<span class="iv-ball">' + n + '</span>'; }).join('');
              luckyBox.innerHTML =
                '<div class="iv-lucky-box">' +
                  '<div style="font-weight:700;color:#f3e5ab">이번 주 행운의 번호</div>' +
                  '<div class="iv-lucky-balls">' + balls + '</div>' +
                  '<div class="iv-lucky-reason">' + res.근거 + '</div>' +
                  '<div class="iv-disclaimer">재미로 보시는 번호입니다. 돈을 거는 데 쓰지 마십시오.</div>' +
                '</div>';
              luckyBox.style.display = 'block';
            }
            b.textContent = '확인 완료';
          }catch(e){
            alert(e.message);
            b.disabled = false;
            b.textContent = '바로 쓰기';
          }
        }
      };
    });
  }

  async function loadStatus(email, birth){
    var res = await postJson('/api/invite/status', { email: email, birth: birth });
    currentCode = res.code;
    currentEmail = email;
    currentBirth = birth;

    myCodeEl.textContent = res.code;
    countValEl.textContent = res.count + '명';
    renderLadder(res.count, res.rewards);

    content.style.display = 'block';
    var summaryCard = document.getElementById('ivSummaryCard');
    if(summaryCard){
      summaryCard.classList.remove('highlight');
      void summaryCard.offsetWidth;
      summaryCard.classList.add('highlight');
      var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      summaryCard.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });
    }
  }

  authForm.onsubmit = async function(e){
    e.preventDefault();
    var email = document.getElementById('authEmail').value.trim();
    var date = document.getElementById('authDate').value;
    var gender = document.getElementById('authGender').value;
    var time = document.getElementById('authTime').value || '12:00';
    var place = document.getElementById('authPlace').value || '서울';
    var submitBtn = document.getElementById('ivAuthSubmit');

    if(!email || !date) return alert('이메일과 생년월일을 적어 주십시오.');

    submitBtn.disabled = true;
    submitBtn.textContent = '불러오는 중…';
    try{
      try{ sessionStorage.setItem('nb_email', email); }catch(err){}
      await loadStatus(email, { date: date, gender: gender, time: time, place: place });
      authCard.style.display = 'none';
    }catch(err){
      alert(err.message || '정보를 불러오지 못했습니다.');
      submitBtn.disabled = false;
      submitBtn.textContent = '내 증표와 보답 확인하기';
    }
  };

  copyBtn.onclick = function(){
    var link = location.origin + '/?invite=' + encodeURIComponent(currentCode);
    try{
      if(navigator.clipboard && navigator.clipboard.writeText){
        navigator.clipboard.writeText(link);
      }else{
        var t = document.createElement('textarea');
        t.value = link;
        document.body.appendChild(t);
        t.select();
        document.execCommand('copy');
        document.body.removeChild(t);
      }
      var toast = document.getElementById('ivCopyToast');
      if(toast){
        toast.textContent = '증표 주소가 복사되었습니다: ' + link;
        toast.style.display = 'block';
      }
    }catch(e){
      prompt('증표 주소를 복사하십시오:', link);
    }
  };

  kakaoBtn.onclick = function(){
    var link = location.origin + '/?invite=' + encodeURIComponent(currentCode);
    var kKey = (window.KAKAO_JS_KEY || '').trim();
    var kakaoShared = false;
    if(kKey && window.Kakao){
      try{
        if(!window.Kakao.isInitialized()){
          window.Kakao.init(kKey);
        }
        if(window.Kakao.Share && window.Kakao.Share.sendDefault){
          window.Kakao.Share.sendDefault({
            objectType: 'feed',
            content: {
              title: '늘봄사주 — 벗의 증표',
              description: '벗은 ${INVITE_DISCOUNT_KRW.toLocaleString('ko-KR')}원 할인, 그대는 ${INVITE_REWARD_NAME} 무료',
              imageUrl: location.origin + '/assets/신령계문_첫장면.jpg',
              link: {
                mobileWebUrl: link,
                webUrl: link
              }
            },
            buttons: [
              {
                title: '증표 받고 사주 보기',
                link: {
                  mobileWebUrl: link,
                  webUrl: link
                }
              }
            ]
          });
          kakaoShared = true;
        }
      }catch(err){
        kakaoShared = false;
      }
    }
    if(!kakaoShared){
      var text = [
        '벗에게 알려주게',
        '그대의 증표 — ' + currentCode,
        '이 증표로 들어온 벗은 ${INVITE_DISCOUNT_KRW.toLocaleString('ko-KR')}원을 덜 낸다네.',
        '벗이 첫 점사를 받으면, 그대에게 ${INVITE_REWARD_NAME} 보답이 주어진다네.',
        link
      ].join(String.fromCharCode(10));
      if(navigator.share){
        navigator.share({ title: '늘봄사주 벗의 증표', text: text, url: link }).catch(function(){});
      }else{
        copyBtn.click();
      }
    }
  };
})();
</script>
</body>
</html>`;
}
