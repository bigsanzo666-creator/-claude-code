/**
 * 벗의 증표 (친구 추천) 배지 및 공유 UI.
 */

export const REFERRAL_BADGE_CSS = `
.nb-invite-box {
  margin: 28px 0 20px;
  padding: 22px 20px;
  background: rgba(212, 175, 55, 0.07);
  border: 1px solid rgba(212, 175, 55, 0.35);
  border-radius: 12px;
  text-align: center;
}
.nb-invite-head {
  font-size: 16px;
  font-weight: 800;
  color: #f3e5ab;
  margin-bottom: 6px;
  letter-spacing: -0.02em;
}
.nb-invite-code {
  font-size: 15px;
  color: #e8e2f0;
  margin-bottom: 10px;
}
.nb-invite-code b {
  color: #f6d878;
  font-size: 18px;
  letter-spacing: 0.05em;
  padding: 2px 8px;
  background: rgba(0, 0, 0, 0.3);
  border-radius: 6px;
}
.nb-invite-desc {
  font-size: 13.5px;
  color: #c8c2d4;
  line-height: 1.6;
  margin: 0 0 16px;
}
.nb-invite-actions {
  display: flex;
  gap: 10px;
  justify-content: center;
}
.nb-invite-btn {
  padding: 10px 18px;
  font-size: 13.5px;
  font-weight: 700;
  border-radius: 8px;
  border: 1px solid rgba(212, 175, 55, 0.5);
  background: #d4af37;
  color: #18151f;
  cursor: pointer;
  font-family: inherit;
  transition: opacity .15s;
}
.nb-invite-btn:hover {
  opacity: .9;
}
.nb-invite-btn.kakao {
  background: #fee500;
  border-color: #e5cc00;
  color: #191919;
}
.nb-invite-toast {
  font-size: 12.5px;
  color: #4ade80;
  margin: 10px 0 0;
}
`;

export function renderInviteBadge(code: string): string {
  const safeCode = (code || '').trim().toLowerCase();
  return `
<div class="nb-invite-box">
  <div class="nb-invite-head">벗에게 알려주게</div>
  <div class="nb-invite-code">그대의 증표 — <b>${safeCode}</b></div>
  <p class="nb-invite-desc">이 증표로 들어온 벗은 3,000원을 덜 낸다네.<br>벗이 첫 점사를 받으면, 그대에게도 보답이 있을 것이야.</p>
  <div class="nb-invite-actions">
    <button type="button" class="nb-invite-btn" id="nbCopyInviteBtn" data-code="${safeCode}">증표 복사하기</button>
    <button type="button" class="nb-invite-btn kakao" id="nbKakaoInviteBtn" data-code="${safeCode}">카톡으로 보내기</button>
  </div>
  <p class="nb-invite-toast" id="nbInviteToast" style="display:none">증표 주소가 복사되었습니다.</p>
</div>
`;
}

export const REFERRAL_BADGE_SCRIPT = `
(function(){
  function setupInviteShare(){
    var copyBtn = document.getElementById('nbCopyInviteBtn');
    var kakaoBtn = document.getElementById('nbKakaoInviteBtn');
    var toast = document.getElementById('nbInviteToast');
    if(!copyBtn) return;
    var code = copyBtn.getAttribute('data-code');
    var link = location.origin + '/?invite=' + encodeURIComponent(code);

    copyBtn.onclick = function(){
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
        if(toast) {
          toast.textContent = '증표 주소가 복사되었습니다: ' + link;
          toast.style.display = 'block';
        }
      }catch(e){
        alert('복사하지 못했습니다. 주소: ' + link);
      }
    };

    if(kakaoBtn){
      kakaoBtn.onclick = function(){
        var text = [
          '벗에게 알려주게',
          '그대의 증표 — ' + code,
          '이 증표로 들어온 벗은 3,000원을 덜 낸다네.',
          '벗이 첫 점사를 받으면, 그대에게도 보답이 있을 것이야.',
          link
        ].join(String.fromCharCode(10));
        if(navigator.share){
          navigator.share({ title: '늘봄사주 벗의 증표', text: text, url: link }).catch(function(){});
        }else{
          copyBtn.click();
          alert('카톡에 붙여넣으실 수 있도록 주소가 복사되었습니다!');
        }
      };
    }
  }
  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', setupInviteShare);
  }else{
    setupInviteShare();
  }
})();
`;
