/**
 * 내 소개 현황 화면 (GET /invite).
 *
 * 검색에 걸리지 않는다 (noindex, nofollow).
 * 로그인은 없으며, 이메일과 생년월일로 연다.
 */

import { type BusinessInfo, show } from './business.ts';
import { renderSocialHead } from './social.ts';
import { FONT_LINK, PRODUCTS_CSS } from './products.ts';
import { PLACES } from '../../saju-rules/src/index.ts';
import { REWARD_TIERS } from '../../commerce/src/referral.ts';

const INVITE_PAGE_CSS = `
.iv-wrap { max-width: 680px; margin: 0 auto; padding: 24px 18px 80px; font-family: -apple-system, BlinkMacSystemFont, "Apple SD Gothic Neo", "Pretendard", "Noto Sans KR", sans-serif; }
.iv-brand { display: inline-block; font-size: 14px; color: #b9b2c6; text-decoration: none; margin-bottom: 18px; }
.iv-title { font-size: 24px; font-weight: 800; color: #f3e5ab; margin: 0 0 8px; }
.iv-desc { font-size: 14.5px; color: #c8c2d4; margin: 0 0 24px; line-height: 1.6; }
.iv-card { background: rgba(255, 255, 255, 0.04); border: 1px solid rgba(255, 255, 255, 0.12); border-radius: 12px; padding: 20px; margin-bottom: 24px; }
.iv-f { margin-bottom: 14px; }
.iv-f label { display: block; font-size: 13px; color: #c8c2d4; margin-bottom: 6px; }
.iv-f input, .iv-f select { width: 100%; box-sizing: border-box; padding: 11px 12px; font-size: 15px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.16); background: rgba(12,10,18,0.92); color: #f4f1f8; font-family: inherit; }
.iv-two { display: flex; gap: 10px; }
.iv-two > * { flex: 1 1 0; min-width: 0; }
.iv-btn { display: block; width: 100%; padding: 14px; font-size: 16px; font-weight: 800; border: none; border-radius: 8px; background: linear-gradient(135deg, #d4af37, #f0d478); color: #1a1208; cursor: pointer; font-family: inherit; }
.iv-btn:disabled { opacity: 0.5; cursor: not-allowed; }
.iv-summary { background: rgba(212, 175, 55, 0.08); border: 1px solid rgba(212, 175, 55, 0.3); border-radius: 12px; padding: 20px; margin-bottom: 24px; text-align: center; }
.iv-badge-head { font-size: 14px; color: #c8c2d4; margin-bottom: 4px; }
.iv-badge-code { font-size: 20px; font-weight: 800; color: #f6d878; margin-bottom: 12px; letter-spacing: 0.05em; }
.iv-badge-actions { display: flex; gap: 8px; justify-content: center; margin-bottom: 12px; }
.iv-badge-btn { padding: 8px 14px; font-size: 13px; font-weight: 700; border-radius: 6px; border: 1px solid rgba(212,175,55,0.4); background: #d4af37; color: #18151f; cursor: pointer; }
.iv-badge-btn.kakao { background: #fee500; border-color: #e5cc00; color: #191919; }
.iv-stats { display: flex; justify-content: space-around; border-top: 1px solid rgba(255,255,255,0.1); padding-top: 14px; margin-top: 14px; }
.iv-stat-num { font-size: 22px; font-weight: 800; color: #f3e5ab; }
.iv-stat-label { font-size: 12.5px; color: #a49cb2; margin-top: 2px; }
.iv-ladder-title { font-size: 18px; font-weight: 800; color: #f3e5ab; margin: 28px 0 14px; }
.iv-ladder-item { display: flex; justify-content: space-between; align-items: center; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); border-radius: 10px; padding: 16px; margin-bottom: 10px; gap: 12px; }
.iv-ladder-item.active { border-color: rgba(212, 175, 55, 0.4); background: rgba(212, 175, 55, 0.05); }
.iv-ladder-item.done { opacity: 0.7; }
.iv-ladder-info { flex: 1; }
.iv-ladder-tier { font-size: 12.5px; font-weight: 700; color: #d4af37; margin-bottom: 2px; }
.iv-ladder-name { font-size: 15px; font-weight: 700; color: #efeaf4; margin-bottom: 4px; }
.iv-ladder-desc { font-size: 12.5px; color: #a49cb2; line-height: 1.45; }
.iv-ladder-status { font-size: 12px; color: #9fd8a8; margin-top: 4px; }
.iv-act-btn { padding: 9px 16px; font-size: 13.5px; font-weight: 700; border-radius: 6px; border: 1px solid #d4af37; background: #d4af37; color: #18151f; cursor: pointer; white-space: nowrap; }
.iv-act-btn:disabled { background: rgba(255,255,255,0.1); border-color: transparent; color: #6b6478; cursor: not-allowed; }
.iv-act-btn.applied { background: transparent; border-color: rgba(255,255,255,0.2); color: #c8c2d4; cursor: default; }
.iv-law-note { margin-top: 32px; padding: 16px; background: rgba(0,0,0,0.3); border-radius: 8px; font-size: 12.5px; color: #8f889c; line-height: 1.7; }
.iv-lucky-box { margin-top: 14px; padding: 14px; background: rgba(0,0,0,0.4); border-radius: 8px; text-align: center; }
.iv-lucky-balls { display: flex; gap: 8px; justify-content: center; margin: 10px 0; }
.iv-ball { width: 34px; height: 34px; border-radius: 50%; background: #d4af37; color: #18151f; font-weight: 800; display: flex; align-items: center; justify-content: center; font-size: 14px; }
.iv-lucky-reason { font-size: 13px; color: #e4dfea; line-height: 1.6; white-space: pre-line; margin-top: 8px; }
.iv-disclaimer { font-size: 12px; color: #e8b4b4; margin-top: 10px; }
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
      <button type="submit" class="iv-btn" id="ivAuthSubmit">내 증표와 보답 확인하기</button>
    </form>
  </section>

  <div id="ivContent" style="display:none">
    <section class="iv-summary">
      <div class="iv-badge-head">그대의 고유 증표</div>
      <div class="iv-badge-code" id="ivMyCode">—</div>
      <p style="font-size:13px;color:#c8c2d4;margin:0 0 12px;line-height:1.5;">
        이 증표로 들어온 벗은 <b>3,000원을 덜 낸다네.</b><br>
        벗이 첫 점사(2만원 이상)를 받으면 그대에게도 보답이 쌓인다네.
      </p>
      <div class="iv-badge-actions">
        <button type="button" class="iv-badge-btn" id="ivCopyBtn">증표 복사하기</button>
        <button type="button" class="iv-badge-btn kakao" id="ivKakaoBtn">카톡으로 보내기</button>
      </div>
      <p class="nb-invite-toast" id="ivCopyToast" style="display:none;color:#4ade80;font-size:12.5px;margin:8px 0 0">증표 주소가 복사되었습니다.</p>
      <div class="iv-stats">
        <div>
          <div class="iv-stat-num" id="ivCountVal">0명</div>
          <div class="iv-stat-label">소개 완료 (2만원 이상)</div>
        </div>
        <div>
          <div class="iv-stat-num" id="ivNextGoalVal">—</div>
          <div class="iv-stat-label" id="ivNextGoalLabel">다음 보답까지</div>
        </div>
      </div>
    </section>

    <h2 class="iv-ladder-title">단계별 보답 사다리</h2>
    <div id="ivLadderList"></div>

    <div class="iv-law-note">
      <p style="margin:0 0 6px;font-weight:700;color:#e4dfea">보답 이용 안내</p>
      <ul style="margin:0;padding-left:18px">
        <li>소개받은 분이 2만원 이상 결제를 완료해야 1명으로 집계됩니다.</li>
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

    TIERS.forEach(function(item){
      var achieved = count >= item.tier;
      var rew = rewardMap[item.tier];
      var div = document.createElement('div');
      div.className = 'iv-ladder-item' + (achieved ? ' active' : '');

      var statusText = '';
      if(rew && rew.status === '신청') statusText = '신청이 들어갔네. 하루 안에 확인해 드리겠네.';
      else if(rew && rew.status === '내줌') statusText = '지급 완료 (' + (rew.expiresAt ? rew.expiresAt.slice(0,10) + '까지' : '이용 가능') + ')';
      else if(rew && rew.status === '거절') statusText = '신청이 반려되었습니다.';
      else if(achieved && item.type === '자동') statusText = '지금 바로 이용하실 수 있습니다.';

      var btnHtml = '';
      if(item.type === '자동'){
        if(achieved){
          btnHtml = '<button type="button" class="iv-act-btn" data-act="use" data-tier="' + item.tier + '">바로 쓰기</button>';
        }else{
          btnHtml = '<button type="button" class="iv-act-btn" disabled>' + (item.tier - count) + '명 더</button>';
        }
      }else{
        if(!achieved){
          btnHtml = '<button type="button" class="iv-act-btn" disabled>' + (item.tier - count) + '명 더</button>';
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
          '<div class="iv-ladder-tier">' + item.tier + '명 달성 보답 (' + item.type + ')</div>' +
          '<div class="iv-ladder-name">' + item.kind + '</div>' +
          '<div class="iv-ladder-desc">' + item.description + '</div>' +
          (statusText ? '<div class="iv-ladder-status">' + statusText + '</div>' : '') +
          (item.tier === 3 ? '<div id="ivLuckyContainer" style="display:none"></div>' : '') +
        '</div>' +
        '<div>' + btnHtml + '</div>';

      ladderListEl.appendChild(div);
    });

    // Wire action buttons
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
        if(tier === 1){
          location.href = '/products/daily-report?invite_reward=1';
        }else if(tier === 5){
          location.href = '/products/month-report?invite_reward=5';
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
    var text = [
      '벗에게 알려주게',
      '그대의 증표 — ' + currentCode,
      '이 증표로 들어온 벗은 3,000원을 덜 낸다네.',
      '벗이 첫 점사를 받으면, 그대에게도 보답이 있을 것이야.',
      link
    ].join(String.fromCharCode(10));
    if(navigator.share){
      navigator.share({ title: '늘봄사주 벗의 증표', text: text, url: link }).catch(function(){});
    }else{
      copyBtn.click();
    }
  };
})();
</script>
</body>
</html>`;
}
