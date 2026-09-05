/**
 * 문 — 신령계로 들어가는 곳.
 *
 * 지금까지 첫 화면의 단추는 「내 사주 무료로 보기」였다. 틀린 말은 아니지만
 * 그건 **계산기 앞에 선 사람에게 하는 말**이다. 우리 집은 계산기가 아니다.
 *
 * 여기는 신령이 사는 곳이고, 손님은 **문 앞에서 이름을 밝히고** 들어온다.
 * 받는 것은 똑같다 — 이름, 태어난 날, 태어난 시. 그런데
 * 「정보를 입력하세요」와 「이름을 밝히시오」는 다른 화면이다.
 *
 * 세 가지를 지킨다.
 *
 * **1. 문을 잠그지 않는다.** 밝히지 않아도 아래로 내려갈 수 있다.
 *    카드사 심사가 상품과 가격을 봐야 하고, 검색엔진도 마찬가지다.
 *    막아 두면 심사가 안을 못 본다.
 *
 * **2. 밝힌 것은 이 자리에서만 쓴다.** 서버로 보내지 않는다. 계산은 전부
 *    브라우저 안에서 끝난다. 그래서 「어디에도 남기지 않습니다」가 빈말이 아니다.
 *
 * **3. 자바스크립트가 없어도 화면은 뜬다.** 문이 안 열릴 뿐, 아래 신령들과
 *    상품은 그대로 보인다.
 */

import { type BusinessInfo } from './business.ts';

function esc(value: string): string {
  return value.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));
}

/** 태어난 시. 12지지를 시각과 함께 보여 준다 — 「인시」만 쓰면 아무도 모른다 */
const HOURS: { value: string; label: string }[] = [
  { value: '', label: '모름 — 시간을 몰라도 됩니다' },
  { value: '00:30', label: '자시 (밤 11시 30분 ~ 새벽 1시 30분)' },
  { value: '02:30', label: '축시 (새벽 1시 30분 ~ 3시 30분)' },
  { value: '04:30', label: '인시 (새벽 3시 30분 ~ 5시 30분)' },
  { value: '06:30', label: '묘시 (아침 5시 30분 ~ 7시 30분)' },
  { value: '08:30', label: '진시 (아침 7시 30분 ~ 9시 30분)' },
  { value: '10:30', label: '사시 (오전 9시 30분 ~ 11시 30분)' },
  { value: '12:30', label: '오시 (낮 11시 30분 ~ 오후 1시 30분)' },
  { value: '14:30', label: '미시 (오후 1시 30분 ~ 3시 30분)' },
  { value: '16:30', label: '신시 (오후 3시 30분 ~ 5시 30분)' },
  { value: '18:30', label: '유시 (저녁 5시 30분 ~ 7시 30분)' },
  { value: '20:30', label: '술시 (저녁 7시 30분 ~ 9시 30분)' },
  { value: '22:30', label: '해시 (밤 9시 30분 ~ 11시 30분)' },
];

/** 배경 그림이 실제로 있는 장소의 아이디 모음. 서버가 기동할 때 세어 넘겨준다 */
export type SceneImages = ReadonlySet<string>;

export const NO_SCENES: SceneImages = new Set();

export const sceneUrl = (id: string) => `/img/scene/${encodeURIComponent(id)}`;

/**
 * 문 화면.
 *
 * 그림이 없으면 종이색 바탕으로 뜬다. 빈 네모를 남기지 않는다 —
 * 상품 그림·신령 얼굴에서 지킨 규칙과 같다.
 */
export function renderGate(
  info: BusinessInfo, scenes: SceneImages = NO_SCENES, video = false,
): string {
  const hours = HOURS.map((h) =>
    `<option value="${esc(h.value)}">${esc(h.label)}</option>`).join('\n      ');
  const shot = scenes.has('gate')
    ? ` style="--nb-gate:url(${sceneUrl('gate')})"` : '';

  // 문이 열리는 장면. 손님이 이름을 밝힌 뒤에만 튼다
  const open = video ? `
  <div class="gate-open" id="gateOpen" hidden aria-hidden="true">
    <video id="gateOpenVid" muted playsinline preload="none"></video>
  </div>` : '';

  return `<section class="gate"${shot} id="gate">
  <div class="gate-bg" aria-hidden="true"></div>${open}
  <div class="gate-veil"></div>
  <div class="lp gate-in">
    <p class="gate-kicker nb-rise">신령계 들어가는 문</p>
    <h2 class="gate-h nb-rise">문을 열려면<br><em>이름을 밝히셔야</em> 합니다</h2>
    <p class="gate-sub nb-rise">밝히신 것은 이 자리에서만 씁니다.
    어디로도 보내지 않고, 저장하지도 않습니다.</p>

    <form class="gate-form nb-rise" id="gateForm" novalidate>
      <label class="gate-f">
        <span class="gate-l">이름</span>
        <input type="text" id="gateName" maxlength="10" autocomplete="name" placeholder="홍길동">
      </label>
      <label class="gate-f">
        <span class="gate-l">태어난 날</span>
        <input type="date" id="gateDate" min="1900-01-01" max="2100-12-31" required>
      </label>
      <label class="gate-f gate-wide">
        <span class="gate-l">태어난 시</span>
        <select id="gateHour">
      ${hours}
        </select>
      </label>
      <div class="gate-bar">
        <button type="submit" class="gate-go">문을 엽니다</button>
        <span class="gate-msg" id="gateMsg" role="status"></span>
      </div>
    </form>

    <p class="gate-skip nb-rise">밝히지 않고 <a href="#products">둘러보기</a>도 됩니다.</p>
  </div>
</section>`;
}

/**
 * 문을 여는 손놀림.
 *
 * 밝힌 것을 아래 만세력 조각의 칸에 그대로 옮겨 담고, 조각이 알아서 다시
 * 그리도록 `change` 를 던진다. **여기서 계산하지 않는다** — 계산은 이미
 * 조각 안에 있고, 두 곳에서 계산하면 언젠가 두 값이 달라진다.
 *
 * 조각이 아직 안 떴으면 그냥 아래로 데려다만 준다. 손님은 문이 안 열린 줄
 * 모르고 넘어가는 것이 아니라, 원래 있던 화면을 그대로 만난다.
 */
export const GATE_SCRIPT = `<script>(function(){
  // 글자가 화면에 들어올 때 한 번만 올라온다.
  // 한 번 올라온 것은 다시 안 내려간다 — 스크롤을 오르내릴 때마다 깜빡이면 피곤하다
  var rise=document.querySelectorAll('.nb-rise');
  if(rise.length){
    if(!('IntersectionObserver' in window)||
       matchMedia('(prefers-reduced-motion: reduce)').matches){
      for(var i=0;i<rise.length;i++)rise[i].classList.add('nb-up');
    }else{
      var io=new IntersectionObserver(function(rows){
        rows.forEach(function(r){
          if(r.isIntersecting){ r.target.classList.add('nb-up'); io.unobserve(r.target); }
        });
      },{rootMargin:'0px 0px -12% 0px',threshold:.05});
      for(var j=0;j<rise.length;j++)io.observe(rise[j]);
    }
  }

  var f=document.getElementById('gateForm');
  if(!f)return;
  var msg=document.getElementById('gateMsg');

  // 문 여는 장면은 손님이 이름을 치는 동안 뒤에서 받아 둔다.
  // 첫 화면이 뜨는 것을 늦추지 않으면서, 누를 때는 이미 준비되어 있다
  var ready=false, gv=document.getElementById('gateOpenVid');
  if(gv){
    var c=navigator.connection;
    var slow=(c&&(c.saveData||/2g/.test(c.effectiveType||'')));
    if(!slow&&!matchMedia('(prefers-reduced-motion: reduce)').matches){
      var pull=function(){
        gv.src='/video/gate-open';
        gv.addEventListener('canplaythrough',function(){ready=true;},{once:true});
        gv.load();
      };
      if('requestIdleCallback' in window)requestIdleCallback(pull,{timeout:2500});
      else addEventListener('load',function(){setTimeout(pull,500);});
    }
  }
  var put=function(id,v){
    var el=document.getElementById(id);
    if(!el)return false;
    el.value=v;
    el.dispatchEvent(new Event('input',{bubbles:true}));
    el.dispatchEvent(new Event('change',{bubbles:true}));
    return true;
  };
  f.addEventListener('submit',function(e){
    e.preventDefault();
    var name=document.getElementById('gateName').value.trim();
    var date=document.getElementById('gateDate').value;
    var hour=document.getElementById('gateHour').value;
    if(!date){ msg.textContent='태어난 날을 알려 주세요.'; return; }
    var ok=put('date',date);
    if(name)put('name',name);
    var noTime=document.getElementById('notime');
    if(hour){ put('time',hour); if(noTime&&noTime.checked){noTime.checked=false;
      noTime.dispatchEvent(new Event('change',{bubbles:true}));} }
    else if(noTime&&!noTime.checked){ noTime.checked=true;
      noTime.dispatchEvent(new Event('change',{bubbles:true})); }
    msg.textContent = ok ? (name?name+'님, 문이 열렸습니다.':'문이 열렸습니다.') : '';
    var enter=function(){
      // 아래 조각이 「하나씩 물어보는 화면」으로 떠 있으면 걷어 준다.
      // 문에서 이미 밝혔는데 또 물으면 손님은 같은 일을 두 번 하게 된다
      if(typeof window.NB_SKIP_WIZARD==='function')window.NB_SKIP_WIZARD();
      var go=document.getElementById('out')||document.getElementById('try');
      if(go)setTimeout(function(){go.scrollIntoView({behavior:'smooth',block:'start'});},60);
    };
    // 문이 열리는 장면이 있으면 그것부터 보여 준다.
    // 못 틀거나 오래 걸리면 기다리지 않고 그냥 들어간다 — 손님을 문 앞에 세워 두지 않는다
    var box=document.getElementById('gateOpen');
    var vid=document.getElementById('gateOpenVid');
    if(!box||!vid||!ready||matchMedia('(prefers-reduced-motion: reduce)').matches){enter();return;}
    var went=false, once=function(){ if(went)return; went=true; box.hidden=true; enter(); };
    box.hidden=false;
    vid.addEventListener('ended',once,{once:true});
    vid.addEventListener('error',once,{once:true});
    setTimeout(once,6000);
    var playing=vid.play();
    if(playing&&playing.catch)playing.catch(once);
  });
})();</script>`;

/**
 * 문 스타일.
 *
 * 색은 새로 만들지 않는다. 상품 화면이 정해 둔 `--nb-*` 를 그대로 쓴다.
 * 그림 위에 글자가 올라가므로 **베일을 한 겹 깐다** — 안 깔면 그림이 밝은
 * 사진일 때 글자가 안 읽힌다.
 */
export const GATE_CSS = `
.gate{position:relative;overflow:hidden;padding:0;
  background:var(--nb-paper) center top/cover no-repeat;background-image:var(--nb-gate,none)}
/* 문 그림은 빛이 세다. 글자를 그 위에 얹으면 안 읽힌다.
   그래서 그림은 **위쪽 띠로만** 쓰고, 글자가 앉는 자리부터는 종이색으로 덮는다 */
.gate-veil{position:absolute;inset:0;background:
  linear-gradient(to bottom,var(--nb-veil-0),var(--nb-veil-1) 16%,var(--nb-paper) 34%)}
.gate-in{position:relative;padding-top:168px;padding-bottom:56px}
.gate-kicker{margin:0 0 12px;font-size:12px;letter-spacing:.26em;color:var(--nb-gold)}
.gate-h{font-family:var(--nb-serif);font-weight:500;font-size:26px;line-height:1.55;
  letter-spacing:-.01em;word-break:keep-all;margin:0 0 12px}
.gate-h em{font-style:normal;color:var(--nb-gold)}
.gate-sub{margin:0 0 24px;font-size:14.5px;line-height:1.8;color:var(--nb-ink-2);
  max-width:26em;word-break:keep-all}
.gate-form{display:grid;grid-template-columns:1fr 1fr;gap:14px;max-width:520px}
.gate-f{display:block;min-width:0}
.gate-wide{grid-column:1/-1}
.gate-l{display:block;margin:0 0 6px;font-size:12px;letter-spacing:.16em;color:var(--nb-gold)}
.gate-f input,.gate-f select{width:100%;box-sizing:border-box;padding:12px 13px;
  font:15px/1.4 var(--nb-sans);color:var(--nb-ink);background:var(--nb-paper-2);
  border:1px solid var(--nb-line);border-radius:0;appearance:none}
.gate-f input:focus,.gate-f select:focus{outline:2px solid var(--nb-gold);outline-offset:-2px}
.gate-bar{grid-column:1/-1;display:flex;align-items:center;gap:14px;flex-wrap:wrap;margin-top:2px}
.gate-go{padding:14px 30px;border:1px solid var(--nb-ink);background:var(--nb-ink);
  color:var(--nb-paper-2);font:500 15.5px var(--nb-sans);letter-spacing:.02em;cursor:pointer;
  transition:background .15s,color .15s}
.gate-go:hover,.gate-go:focus{background:transparent;color:var(--nb-ink)}
.gate-msg{font-size:13.5px;color:var(--nb-gold)}
.gate-skip{margin:18px 0 0;font-size:13px;color:var(--nb-ink-3)}
.gate-skip a{color:var(--nb-gold)}
@media (min-width:760px){
  .gate-in{padding-top:250px;padding-bottom:80px}
  .gate-h{font-size:36px}
}
/* 문이 열리는 장면. 화면을 가득 덮고, 끝나면 사라진다 */
.gate-open{position:fixed;inset:0;z-index:60;background:var(--nb-paper);
  display:grid;place-items:center}
.gate-open video{width:100%;height:100%;object-fit:cover}

/* 그림이 아주 천천히 다가온다.
   영상이 아니라 그림 한 장이다 — 무게가 0이고, 폰이 버벅이지 않는다.
   30초에 걸쳐 4%. 눈으로 「움직인다」고 느끼기 직전까지만 준다 */
.gate-bg{position:absolute;inset:0;background:inherit;background-image:var(--nb-gate,none);
  transform:scale(1);animation:nbDrift 30s ease-in-out infinite alternate}
.gate{background-image:none}
@keyframes nbDrift{from{transform:scale(1)}to{transform:scale(1.04)}}

/* 글자가 아래에서 스멀스멀 올라온다. 화면에 들어올 때 한 번만 */
.nb-rise{opacity:0;transform:translateY(14px);
  transition:opacity .8s cubic-bezier(.2,.6,.2,1),transform .8s cubic-bezier(.2,.6,.2,1)}
.nb-rise.nb-up{opacity:1;transform:none}
/* 한 덩어리 안에서는 차례로 올라온다 */
.nb-rise:nth-child(2){transition-delay:.10s}
.nb-rise:nth-child(3){transition-delay:.20s}
.nb-rise:nth-child(4){transition-delay:.30s}
.nb-rise:nth-child(5){transition-delay:.40s}

/* 어지럼증 때문에 움직임을 꺼 둔 손님에게는 아무것도 움직이지 않는다.
   글자는 처음부터 보이게 둔다 — 안 그러면 글이 영영 안 나타난다 */
@media (prefers-reduced-motion:reduce){
  .gate-bg{animation:none}
  .nb-rise{opacity:1;transform:none;transition:none}
}`;
