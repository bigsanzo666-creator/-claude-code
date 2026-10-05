// ==========================================================================
// 늘봄사주 10대 신령 성지: 비디오 정지 제어 & 16:9 와이드 파노라마 드래그 로직
// ==========================================================================

const SPIRITS_DATA = [
  {
    id: "dohwa",
    name: "도화신령",
    question: "이 사람, 어떨까?",
    domain: "연애 · 매력 · 이성운",
    img: "/img/spirits/flower",
    video: "assets/대면상담/도화신령대면상담.mp4",
    opener: "누구한테 마음이 가는지, 내가 연못 위 연꽃잎으로 짚어 줄게.",
    productIds: ["charm-report", "single-report", "marriage-timing-report"]
  },
  {
    id: "wol",
    name: "월신령",
    question: "다시 만날 수 있을까?",
    domain: "재회 · 이별 치유 · 그리움",
    img: "/img/spirits/moon",
    video: "assets/대면상담/월신령대면상담.mp4",
    opener: "떠나간 사람 때문에 밤잠 설치고 있지? 그 마음 이리 내봐.",
    productIds: ["reunion-report", "letgo-report"]
  },
  {
    id: "yeon",
    name: "실신령",
    question: "우리, 잘 맞을까?",
    domain: "궁합 · 인연의 끈 · 결혼",
    img: "/img/spirits/thread",
    video: "assets/대면상담/실신령대면상담.mp4",
    opener: "너와 그 사람 사이에 붉은 실이 닿아 있는지 짚어 줄게.",
    productIds: ["compat-report", "crush-compat-report"]
  },
  {
    id: "san",
    name: "산신령",
    question: "우리 아이는 어떤 아이일까?",
    domain: "자녀 진로 · 학업 · 성공운",
    img: "/img/spirits/mountain",
    video: "assets/대면상담/산신령대면상담.mp4",
    opener: "아이가 벼슬길에 오를지 큰 재목이 될지 그 바탕을 내가 짚어주마.",
    productIds: ["child-aptitude-report", "exam-report"]
  },
  {
    id: "jakmyeong",
    name: "작명신령",
    question: "우리 아이 이름, 뭐로 지을까?",
    domain: "작명 · 개명 · 호(號)",
    img: "/img/spirits/name",
    video: "assets/대면상담/작명신령대면상담.mp4",
    opener: "평생 불릴 이름이다. 사주의 빈 곳을 채우는 귀한 글자를 지어주마.",
    productIds: ["naming-plus-report", "naming-report"]
  },
  {
    id: "samsin",
    name: "삼신할매",
    question: "언제 낳는 게 좋을까?",
    domain: "출산택일 · 자녀운 · 생명",
    freezeAt: 7.0,
    img: "/img/spirits/birth",
    video: "assets/대면상담/삼신할매대면상담.mp4",
    opener: "아가야 어서 오너라. 복되고 귀한 때를 골라 점지해 주마.",
    productIds: ["pick-report", "child-report"]
  },
  {
    id: "myeonggyeong",
    name: "명경신령",
    question: "나는 어떤 사람일까?",
    domain: "사주 원판 정밀 판독 · 오행 결핍",
    freezeAt: 7.0,
    img: "/img/spirits/mirror",
    video: "assets/대면상담/명경신령대면상담.mp4",
    opener: "거울은 속이지 않는다. 타고난 네 사주 원판의 뼈대를 비춰 주마.",
    productIds: ["saju-report"]
  },
  {
    id: "samhap",
    name: "삼합신령",
    question: "셋이 같은 말을 할까?",
    domain: "사주 × 관상 × 손금 삼합 종합",
    img: "/img/spirits/cross",
    video: "assets/대면상담/삼합신령대면상담.mp4",
    opener: "사주와 얼굴, 손금을 셋 다 겹쳐봐야 진짜 네 운명의 축이 보여.",
    productIds: ["cross-report", "face-palm-report"]
  },
  {
    id: "jae",
    name: "재신령",
    question: "먹고사는 일은 풀릴까?",
    domain: "재물창고 · 금전운 · 누수 차단",
    img: "/img/spirits/jar",
    video: "assets/대면상담/재신령대면상담.mp4",
    opener: "돈이 새는 곳간을 막아야 금전이 차오른다. 네 돈줄을 점검해 줄게.",
    productIds: ["wealth-report"]
  },
  {
    id: "pung",
    name: "풍신령",
    question: "지금 움직여도 될까?",
    domain: "신년운세 · 연간 흐름 · 액땜",
    freezeAt: 6.8,
    img: "/img/spirits/wind",
    video: "assets/대면상담/풍신령대면상담.mp4",
    opener: "올 한 해 불어닥칠 바람의 길목을 미리 알려주마.",
    productIds: ["newyear-report", "career-report"]
  }
];

const BIRTH_TIME_OPTIONS = [
  "시간 모름",
  "자시 (23:30~01:29)", "축시 (01:30~03:29)", "인시 (03:30~05:29)",
  "묘시 (05:30~07:29)", "진시 (07:30~09:29)", "사시 (09:30~11:29)",
  "오시 (11:30~13:29)", "미시 (13:30~15:29)", "신시 (15:30~17:29)",
  "유시 (17:30~19:29)", "술시 (19:30~21:29)", "해시 (21:30~23:29)"
];

const FREE_TEXT_FIELD = {
  type: "text", id: "worry",
  placeholder: "궁금한 점을 자유롭게 입력해 주세요. (200자 이내)",
  maxLength: 200
};

const CHAMBER_FLOWS = {
  // 1. 도화신령 — 연애 · 매력
  dohwa: [
    {
      say: "네 매력이 어디서 터지는지 보려면,\n지금 네 자리부터 알아야겠다.",
      fields: [
        {
          type: "select", id: "marital", before: "지금은", after: "이에요.", placeholder: "선택",
          options: ["미혼", "썸 타는 중", "연애 중", "기혼", "이혼·사별"]
        }
      ]
    },
    {
      say: "뭐가 제일 궁금해서 나를 찾아왔지?",
      fields: [
        {
          type: "select", id: "want", before: "제일 궁금한 건", after: "예요.", placeholder: "선택",
          options: ["내 매력이 뭔지", "인연이 언제 오는지", "이 사람과 잘 될지"]
        }
      ]
    },
    { say: "마지막으로, 속에 담아둔 말이 있으면 풀어놔.", fields: [FREE_TEXT_FIELD] }
  ],

  // 2. 월신령 — 재회 · 이별 치유
  wol: [
    {
      say: "떠난 지 얼마나 됐지?",
      fields: [
        {
          type: "select", id: "since", before: "헤어진 지", after: "됐어요.", placeholder: "선택",
          options: ["한 달 안", "1~6개월", "6개월~1년", "1년 넘음"]
        }
      ]
    },
    {
      say: "밤마다 너를 붙잡는 게 뭐야?",
      fields: [
        {
          type: "select", id: "pain", before: "제일 힘든 건", after: "이에요.", placeholder: "선택",
          options: ["그 사람이 그립다", "연락이 올지 모르겠다", "마음 정리가 안 된다"]
        }
      ]
    },
    { say: "마지막으로, 그 사람에게 못 한 말이 있다면.", fields: [FREE_TEXT_FIELD] }
  ],

  // 3. 실신령 — 궁합 · 인연
  yeon: [
    {
      say: "그 사람과 지금 어디까지 왔지?",
      fields: [
        {
          type: "select", id: "stage", before: "우리는", after: "사이예요.", placeholder: "선택",
          options: ["짝사랑", "썸", "연애 중", "결혼 준비", "부부"]
        }
      ]
    },
    {
      say: "붉은 실은 두 사람 것을 겹쳐야 보인다.\n그 사람이 태어난 날을 알려줘.",
      fields: [
        { type: "date", id: "partnerBirth", before: "그 사람은", after: "에 태어났어요." },
        { type: "birthtime", id: "partnerTime", before: "태어난 시간은", after: "예요." }
      ]
    },
    { say: "마지막으로, 그 사람에 대해 더 할 말이 있다면.", fields: [FREE_TEXT_FIELD] }
  ],

  // 4. 삼합신령 — 사주 × 관상 × 손금
  samhap: [
    {
      say: "사주는 이미 받았다.\n이제 네 얼굴과 손을 보자.",
      fields: [
        { type: "photo", id: "facePhoto", label: "얼굴 사진 올리기" },
        { type: "photo", id: "palmPhoto", label: "손바닥 사진 올리기" }
      ]
    },
    {
      say: "셋을 겹쳐서 무엇을 보고 싶은 거지?",
      fields: [
        {
          type: "select", id: "want", before: "알고 싶은 건", after: "예요.", placeholder: "선택",
          options: ["겉의 나와 속의 나 차이", "대박이 터지는 구간", "타고난 것과 내가 바꾼 것"]
        }
      ]
    },
    { say: "마지막으로, 남들이 모르는 네 이야기가 있다면.", fields: [FREE_TEXT_FIELD] }
  ],

  // 5. 작명신령 — 평생 이름
  jakmyeong: [
    {
      say: "이름은 평생 불릴 소리다.\n아이 성씨부터 알려다오.",
      fields: [
        { type: "shorttext", id: "surname", before: "아이 성은", after: "이에요.", placeholder: "예: 김", maxLength: 4 },
        {
          type: "select", id: "gender", before: "아이는", after: "예요.", placeholder: "선택",
          options: ["아들", "딸", "아직 모름"]
        }
      ]
    },
    {
      say: "아이가 세상에 나온 날을 알아야\n소리를 고를 수 있다.",
      fields: [
        { type: "date", id: "childBirth", before: "아이는", after: "에 태어났어요." },
        { type: "birthtime", id: "childTime", before: "태어난 시간은", after: "예요." }
      ]
    },
    { say: "마지막으로, 아이에게 바라는 것이 있다면.", fields: [FREE_TEXT_FIELD] }
  ],

  // 6. 삼신할매 — 출산 · 택일
  samsin: [
    {
      say: "의사가 가능하다고 한 날짜부터\n말해보렴.",
      fields: [
        { type: "daterange", id: "surgeryRange", before: "수술 가능한 날은", after: "사이예요." }
      ]
    },
    {
      say: "산모는 지금 어떤 상태냐.",
      fields: [
        {
          type: "select", id: "order", before: "이번이", after: "예요.", placeholder: "선택",
          options: ["첫 아이", "둘째 이상"]
        }
      ]
    },
    { say: "마지막으로, 병원에서 들은 말이 있으면 적어두렴.", fields: [FREE_TEXT_FIELD] }
  ],

  // 7. 명경신령 — 나의 본질 · 재능
  myeonggyeong: [
    {
      say: "거울 앞에 서기 전에,\n지금 뭘 하고 사는지부터.",
      fields: [
        {
          type: "select", id: "job", before: "직업은", after: "이에요.", placeholder: "선택",
          options: ["직장인", "자영업", "프리랜서", "학생", "주부", "구직 중", "기타"]
        }
      ]
    },
    {
      say: "요즘 제일 답답한 게 뭐야?",
      fields: [
        {
          type: "select", id: "pain", before: "요즘은", after: "예요.", placeholder: "선택",
          options: ["내가 뭘 잘하는지 모르겠다", "이 길이 맞는지 모르겠다", "사람한테 지친다"]
        }
      ]
    },
    { say: "마지막으로, 거울에 비추고 싶은 게 있다면.", fields: [FREE_TEXT_FIELD] }
  ],

  // 8. 재신령 — 돈그릇 · 재물
  jae: [
    {
      say: "네 곳간은 지금 어떤 상태지?",
      fields: [
        {
          type: "select", id: "money", before: "지금은", after: "이에요.", placeholder: "선택",
          options: ["모으는 중", "빚 갚는 중", "투자 중", "사업 중", "늘 모자란다"]
        }
      ]
    },
    {
      say: "제일 알고 싶은 게 뭐야?",
      fields: [
        {
          type: "select", id: "want", before: "알고 싶은 건", after: "예요.", placeholder: "선택",
          options: ["언제 돈이 들어오는지", "왜 안 모이는지", "지금 투자해도 되는지"]
        }
      ]
    },
    { say: "마지막으로, 돈 때문에 걸리는 일이 있다면.", fields: [FREE_TEXT_FIELD] }
  ],

  // 9. 산신령 — 자녀 · 가족 · 노후
  san: [
    {
      say: "누구 이야기를 들으러 왔느냐.",
      fields: [
        {
          type: "select", id: "who", before: "여쭤볼 사람은", after: "예요.", placeholder: "선택",
          options: ["내 아이", "부모님", "내 노후"]
        }
      ]
    },
    {
      say: "그 사람과 요즘은 어떠냐.",
      fields: [
        {
          type: "select", id: "state", before: "요즘은", after: "예요.", placeholder: "선택",
          options: ["자주 부딪힌다", "걱정된다", "앞날이 궁금하다"]
        }
      ]
    },
    { say: "마지막으로, 가슴에 얹힌 것이 있으면 내려놓거라.", fields: [FREE_TEXT_FIELD] }
  ],

  // 10. 풍신령 — 시기 · 타이밍
  pung: [
    {
      say: "바람이 어디서 불어오는지 보려면,\n네 자리부터 알아야겠다.",
      fields: [
        {
          type: "select", id: "marital", before: "지금은", after: "이에요.", placeholder: "선택",
          options: ["미혼", "연애 중", "기혼", "이혼·사별"]
        },
        {
          type: "select", id: "job", before: "직업은", after: "이에요.", placeholder: "선택",
          options: ["직장인", "자영업", "프리랜서", "학생", "주부", "구직 중", "기타"]
        }
      ]
    },
    {
      say: "곧 결정해야 할 일이 뭐지?",
      fields: [
        {
          type: "select", id: "decision", before: "곧 정해야 할 일은", after: "이에요.", placeholder: "선택",
          options: ["이직", "이사·이민", "시험", "투자", "고백·결혼", "딱히 없다"]
        }
      ]
    },
    { say: "마지막으로, 지금 망설이는 게 있다면.", fields: [FREE_TEXT_FIELD] }
  ]
};


// 카탈로그 상품 캐시 (GET /api/products 에서 가져옴. 가격은 packages/commerce/src/catalog.ts 단일 출처)
let CATALOG_PRODUCTS = {};

function loadCatalogProducts() {
  if (window.SAJU_CONFIG && Array.isArray(window.SAJU_CONFIG.sellable)) {
    window.SAJU_CONFIG.sellable.forEach(p => {
      CATALOG_PRODUCTS[p.id] = p;
    });
  }
  fetch('/api/products')
    .then(r => r.json())
    .then(data => {
      if (Array.isArray(data.products)) {
        data.products.forEach(p => {
          CATALOG_PRODUCTS[p.id] = p;
        });
      }
    })
    .catch(err => console.log('[Catalog] Load failed:', err));
}
loadCatalogProducts();

/*
 * 주인 통과 — 주소에 얹어 온 암호를 이 탭에만 담아 두고 주소창에서는 지운다.
 *
 * 사장님이 손님과 똑같은 길을 걸어 리포트까지 실제로 받아 봐야 무엇이
 * 어긋났는지 안다. 첫 화면에서 받아 두면 사는 화면까지 따라간다.
 * 주소창에 남겨 두면 화면을 한 번만 찍혀도 남이 그대로 쓴다.
 */
try {
  const mp = location.search.match(/[?&]pass=([^&#]+)/);
  if (mp && mp[1]) {
    const rawPass = decodeURIComponent(mp[1]).slice(0, 128);
    const clean = location.href
      .replace(/([?&])pass=[^&#]*(&|$)/, (_, a, b) => (b ? a : ''))
      .replace(/[?&]$/, '');
    history.replaceState(null, '', clean);
    fetch('/api/pass/check', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ pass: rawPass }),
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((res) => {
        if (res && res.ok === true) {
          sessionStorage.setItem('nb_pass', rawPass);
        } else {
          sessionStorage.removeItem('nb_pass');
        }
      })
      .catch(() => {
        sessionStorage.removeItem('nb_pass');
      });
  }
} catch (e) { /* 저장을 막아 둔 브라우저면 그냥 손님과 같은 길로 간다 */ }

/*
 * 친구 소개 — 홈으로 들어온 손님의 소개 코드를 담아 두고 주소창에서는 지운다.
 * 결제 화면과 똑같이 맞춘다: nb_invite, 소문자 12자.
 */
try {
  const mi = location.search.match(/[?&]invite=([a-zA-Z0-9]+)/);
  if (mi && mi[1]) {
    sessionStorage.setItem('nb_invite', mi[1].toLowerCase().slice(0, 12));
    const clean = location.href
      .replace(/([?&])invite=[^&#]*(&|$)/, (_, a, b) => (b ? a : ''))
      .replace(/[?&]$/, '');
    history.replaceState(null, '', clean);
  }
} catch (e) {}

const TIME_MAP = {
  'ja': '00:30', 'chuk': '02:30', 'in': '04:30', 'myo': '06:30',
  'jin': '08:30', 'sa': '10:30', 'o': '12:30', 'mi': '14:30',
  'sin': '16:30', 'yu': '18:30', 'sul': '20:30', 'hae': '22:30',
  'unknown': '12:00'
};

function normalizeBirthTime(raw) {
  const digits = String(raw || '').replace(/[^0-9]/g, '');
  const padded = digits.padStart(4, '0');
  const value = /^\d{3,4}$/.test(digits) ? padded.slice(0, 2) + ':' + padded.slice(2) : String(raw || '').trim();
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(value) ? value : '';
}

let userState = { name: "", birthDate: "", birthTime: "", birthPlace: "서울" };
let currentSpirit = null;
let currentProduct = null;
let isAudioActive = false;

document.addEventListener('DOMContentLoaded', () => {
  const inviteBanner = document.getElementById('nbInviteBanner');
  if (inviteBanner) {
    try {
      if (sessionStorage.getItem('nb_invite')) {
        inviteBanner.style.display = 'block';
      }
    } catch (e) {}
  }

  // 벗의 증표(소개 코드) 수동 입력 위젯
  const btnOpenStageInvite = document.getElementById('btnOpenStageInvite');
  const stageInviteFold = document.getElementById('stageInviteFold');
  const stageInviteInput = document.getElementById('stageInviteInput');
  const stageInviteSubmit = document.getElementById('stageInviteSubmit');
  const stageInviteMsg = document.getElementById('stageInviteMsg');

  if (btnOpenStageInvite && stageInviteFold) {
    try {
      const storedInv = sessionStorage.getItem('nb_invite');
      if (storedInv) {
        btnOpenStageInvite.textContent = '벗의 증표 적용됨 (' + storedInv + ')';
      }
    } catch (e) {}

    btnOpenStageInvite.addEventListener('click', (e) => {
      e.stopPropagation();
      const isHidden = stageInviteFold.style.display === 'none';
      stageInviteFold.style.display = isHidden ? 'block' : 'none';
      if (isHidden && stageInviteInput) {
        stageInviteInput.focus();
        try {
          const inv = sessionStorage.getItem('nb_invite');
          if (inv) stageInviteInput.value = inv;
        } catch (e) {}
      }
    });

    if (stageInviteSubmit && stageInviteInput) {
      let failCount = 0;
      let cooldownUntil = 0;

      const submitInvite = async () => {
        const now = Date.now();
        if (cooldownUntil > now) {
          const remSec = Math.ceil((cooldownUntil - now) / 1000);
          if (stageInviteMsg) {
            stageInviteMsg.className = 'stage-invite-msg err';
            stageInviteMsg.textContent = `증표 입력을 여러 번 실패하여 잠시 후(${remSec}초 뒤) 다시 시도해 주세요.`;
          }
          return;
        }

        const code = stageInviteInput.value.trim().toLowerCase();
        if (!code) {
          if (stageInviteMsg) {
            stageInviteMsg.className = 'stage-invite-msg err';
            stageInviteMsg.textContent = '증표 코드를 입력해 주세요.';
          }
          return;
        }

        stageInviteSubmit.disabled = true;
        try {
          const res = await fetch('/api/invite/check', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code }),
          });
          const data = await res.json().catch(() => ({}));
          if (res.status === 429) {
            if (stageInviteMsg) {
              stageInviteMsg.className = 'stage-invite-msg err';
              stageInviteMsg.textContent = data.message || '증표 입력을 여러 번 실패하여 잠시 후 다시 시도해 주세요.';
            }
            return;
          }

          if (data.ok && data.valid) {
            failCount = 0;
            try { sessionStorage.setItem('nb_invite', data.code); } catch(e){}
            btnOpenStageInvite.textContent = '벗의 증표 적용됨 (' + data.code + ')';
            if (stageInviteMsg) {
              stageInviteMsg.className = 'stage-invite-msg ok';
              stageInviteMsg.textContent = data.message;
            }
            if (inviteBanner) inviteBanner.style.display = 'block';
          } else {
            failCount++;
            if (failCount >= 3) {
              cooldownUntil = Date.now() + 60 * 1000;
              if (stageInviteMsg) {
                stageInviteMsg.className = 'stage-invite-msg err';
                stageInviteMsg.textContent = '증표 입력을 여러 번 실패하여 잠시 후 다시 시도해 주세요.';
              }
            } else {
              if (stageInviteMsg) {
                stageInviteMsg.className = 'stage-invite-msg err';
                stageInviteMsg.textContent = data.message || '그런 증표가 없습니다';
              }
            }
          }
        } catch (err) {
          if (stageInviteMsg) {
            stageInviteMsg.className = 'stage-invite-msg err';
            stageInviteMsg.textContent = '확인 중 오류가 발생했습니다.';
          }
        } finally {
          stageInviteSubmit.disabled = false;
        }
      };

      stageInviteSubmit.addEventListener('click', submitInvite);
      stageInviteInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          submitInvite();
        }
      });
    }
  }

  const gateVideo = document.getElementById('gateVideo');
  const enterVideo = document.getElementById('enterVideo');
  const soundControl = document.getElementById('soundControl');
  const soundIcon = soundControl.querySelector('.sound-icon');
  const soundText = soundControl.querySelector('.sound-text');

  const stageGate = document.getElementById('stageGate');
  const stageEnter = document.getElementById('stageEnter');
  const stageSpirits = document.getElementById('stageSpirits') || document.getElementById('stageCourtyard');
  const stageCourtyard = stageSpirits;
  const btnKnockGate = document.getElementById('btnKnockGate');
  const userInfoDisplay = document.getElementById('userInfoDisplay');

  const sajuInputModal = document.getElementById('sajuInputModal');
  const inputName = document.getElementById('inputName');
  const inputBirth = document.getElementById('inputBirth');
  const inputTime = document.getElementById('inputTime');
  const inputTimeUnknown = document.getElementById('inputTimeUnknown');
  const inputTimeSlot = document.getElementById('inputTimeSlot');
  const inputPlace = document.getElementById('inputPlace');
  const btnSubmitSaju = document.getElementById('btnSubmitSaju');
  const genderButtons = document.querySelectorAll('.gender-btn');
  let selectedGender = 'male';

  if (inputTimeUnknown) {
    inputTimeUnknown.addEventListener('change', () => {
      const unk = inputTimeUnknown.checked;
      if (inputTimeSlot) inputTimeSlot.style.display = unk ? 'block' : 'none';
      if (inputTime) {
        inputTime.disabled = unk;
        if (unk) inputTime.value = '';
      }
    });
  }

  /*
   * 사주 정보를 담고 꺼내는 단일 함수 (sessionStorage 'nb_reading')
   */
  function loadReading() {
    try {
      return JSON.parse(sessionStorage.getItem('nb_reading') || 'null');
    } catch (e) { return null; }
  }

  function saveReading(data) {
    try {
      const cur = loadReading() || {};
      const merged = Object.assign({}, cur, data);
      sessionStorage.setItem('nb_reading', JSON.stringify(merged));
    } catch (err) { /* 저장이 막혀 있어도 결제 자리에서 다시 받으면 된다 */ }
  }

  try {
    const saved = loadReading();
    if (saved) {
      const b = saved.birth || saved;
      if (b.name && inputName) inputName.value = b.name;
      if ((b.date || b.birthDate) && inputBirth) inputBirth.value = b.date || b.birthDate;
      if (b.place && inputPlace) inputPlace.value = b.place;
      if (b.gender) {
        selectedGender = (b.gender === 'female' || b.gender === '여') ? 'female' : 'male';
        genderButtons.forEach(btn => {
          if (btn.getAttribute('data-gender') === selectedGender) btn.classList.add('active');
          else btn.classList.remove('active');
        });
      }
      if (inputTime) {
        if (b.timeKnown === false || b.time === '12:00' || !b.time) {
          if (inputTimeUnknown) {
            inputTimeUnknown.checked = true;
            if (inputTimeSlot) {
              inputTimeSlot.style.display = 'block';
              for (const [k, v] of Object.entries(TIME_MAP)) {
                if (v === b.time || k === b.time) {
                  inputTimeSlot.value = k;
                  break;
                }
              }
            }
            inputTime.disabled = true;
          }
        } else {
          inputTime.value = b.time;
        }
      }
      userState.name = (inputName && inputName.value.trim()) || (b.name || "");
      userState.birthDate = inputBirth ? inputBirth.value : (b.date || b.birthDate || "");
      userState.birthTime = b.time || "";
      userState.timeKnown = b.timeKnown !== false;
      userState.birthPlace = (inputPlace && inputPlace.value) || (b.place || "서울");
      userState.gender = selectedGender;
      if (userInfoDisplay && userState.name) {
        userInfoDisplay.innerHTML = `<span class="user-icon">🏮</span><span class="user-name-text"><strong>${userState.name}</strong> 님의 명식 봉인 해제</span>`;
      }
    }
  } catch (e) {}

  const panoramaViewport = document.getElementById('panoramaViewport');

  // ================= 🔊 사운드 컨트롤 & 배경음악(/audio/bgm) =================
  let bgmAudio = null;
  function getBgm() {
    if (!bgmAudio) {
      try {
        bgmAudio = new Audio('/audio/bgm');
        bgmAudio.loop = true;
        bgmAudio.volume = 0.15; // 0.2 안쪽 (신령 목소리와 겹칠 때 목소리가 이기도록)
      } catch (e) {
        bgmAudio = null;
      }
    }
    return bgmAudio;
  }

  function setSound(enable) {
    isAudioActive = enable;
    try {
      localStorage.setItem('nb_sound_active', enable ? '1' : '0');
    } catch (e) {}

    if (enable) {
      if (stageGate && stageGate.classList.contains('active') && gateVideo) {
        gateVideo.muted = false;
        gateVideo.volume = 1.0;
        gateVideo.play().catch(() => { });
      }
      if (enterVideo) {
        enterVideo.muted = false;
        enterVideo.volume = 1.0;
      }
      const bgm = getBgm();
      if (bgm) {
        bgm.play().catch(() => { });
      }
      if (soundControl) soundControl.classList.add('active');
      if (soundIcon) soundIcon.textContent = '🔊';
      if (soundText) soundText.textContent = '신령음 ON';
    } else {
      if (gateVideo) gateVideo.muted = true;
      if (enterVideo) enterVideo.muted = true;
      if (bgmAudio) {
        bgmAudio.pause();
      }
      if (soundControl) soundControl.classList.remove('active');
      if (soundIcon) soundIcon.textContent = '🔇';
      if (soundText) soundText.textContent = '신령음 OFF';
    }
  }

  if (soundControl) {
    soundControl.addEventListener('click', (e) => {
      e.stopPropagation();
      setSound(!isAudioActive);
    });
  }

  // 껐다 켠 상태 기억: 이전 방문에서 꺼뒀으면 OFF 상태로 복원
  try {
    const savedSound = localStorage.getItem('nb_sound_active');
    if (savedSound === '0') {
      setSound(false);
    }
  } catch (e) {}

  // 손님이 화면을 한 번 누른 다음에 틀기 시작한다 (브라우저 자동 재생 정책)
  const startBgmOnFirstClick = () => {
    document.removeEventListener('click', startBgmOnFirstClick);
    document.removeEventListener('touchstart', startBgmOnFirstClick);
    try {
      if (localStorage.getItem('nb_sound_active') === '0') return;
    } catch (e) {}
    const bgm = getBgm();
    if (bgm) {
      bgm.play().catch(() => { });
    }
  };
  document.addEventListener('click', startBgmOnFirstClick, { once: true });
  document.addEventListener('touchstart', startBgmOnFirstClick, { once: true });

  // ================= 1. 비디오 루프 금지 & 마지막 프레임 정지 =================
  if (gateVideo) {
    // 끝났을 때 다시 처음으로 돌아가지 않고 마지막 프레임에서 정지
    let gateDone = false;
    gateVideo.addEventListener('ended', () => {
      gateDone = true;
      gateVideo.pause();
    });

    /*
     * 저절로 안 돌 때가 있다. 몇 번 더 눌러 본다.
     *
     * 휴대폰 브라우저가 첫 화면 영상을 제 마음대로 안 틀어 주는 경우가 있다.
     * 그러면 첫 장면 그림만 덩그러니 남아 신령이 가만히 서 있는 것처럼 보인다.
     * 사장님 휴대폰에서 실제로 그랬다 (2026-09-23).
     *
     * 끝까지 다 돈 영상은 건드리지 않는다 — 다시 틀면 처음으로 되감겨
     * 같은 장면을 무한히 반복한다.
     */
    const kickGate = () => {
      if (gateDone || gateVideo.ended) return;
      if (!gateVideo.paused) return;
      if (!stageGate.classList.contains('active')) return;
      gateVideo.play().catch(() => { });
    };
    kickGate();
    setTimeout(kickGate, 400);
    setTimeout(kickGate, 1500);
    addEventListener('pointerdown', kickGate, { once: true });
    addEventListener('touchstart', kickGate, { once: true });
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) kickGate();
    });
  }

  // ================= 2. 신령계 문 두드리기 ➡️ 사주 신상 정보 입력 모달(Checkpoint) 오픈 =================
  btnKnockGate.addEventListener('click', () => {
    if (sajuInputModal) sajuInputModal.classList.add('active');
    primeEnterVideo();
  });

  /*
   * 입장 영상을 미리 받아 둔다.
   *
   * 문을 두드린 뒤에 받기 시작하면, 명식을 빨리 적는 손님은 영상이 다 오기 전에
   * 들어가 버린다. 그러면 받으면서 틀게 되어 뚝뚝 끊긴다 — 사장님 휴대폰에서
   * 실제로 그랬다 (2026-09-23).
   *
   * 그렇다고 첫 화면부터 받으면 대문 영상과 통신선을 나눠 쓴다. 그래서
   * **대문 영상을 다 받은 그때** 시작한다. 손님이 대문을 보고 있는 동안
   * 조용히 받아 두는 것이다. 대문이 늦으면 4초 뒤에 그냥 시작한다.
   */
  let enterPrimed = false;
  function primeEnterVideo() {
    if (enterPrimed || !enterVideo) return;
    if (enterVideo.getAttribute('src') || !enterVideo.dataset.src) return;
    enterPrimed = true;
    enterVideo.preload = 'auto';
    enterVideo.setAttribute('src', enterVideo.dataset.src);
    enterVideo.load();
  }
  if (gateVideo) {
    gateVideo.addEventListener('canplaythrough', primeEnterVideo, { once: true });
    gateVideo.addEventListener('ended', primeEnterVideo, { once: true });
  }
  setTimeout(primeEnterVideo, 4000);

  // 성별 선택 토글
  genderButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      genderButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      selectedGender = btn.getAttribute('data-gender');
    });
  });

  /*
   * 신령에게 적어 준 것을 결제 자리로 넘긴다.
   *
   * 전에는 「신청하기」가 상세페이지로 갔고, 상세페이지의 받기 단추는 첫 화면으로
   * 돌아갔다. 손님은 사겠다고 누른 뒤에 대문 앞에 다시 서서, 이름과 생년월일을
   * 처음부터 또 적어야 했다. 그러고도 살 자리는 열리지 않았다.
   *
   * 브라우저를 닫으면 지워지는 자리에만 둔다. 이 창에서 결제까지 가는 동안만 쓴다.
   */
  function rememberReading(productId, payload) {
    saveReading(Object.assign({}, payload, productId ? { productId: productId } : {}));
  }

  // ================= 3. 입장 연출 영상 1회 재생 후 마당 파노라마 고정! =================
  function enterSpiritWorld() {
    setSound(true);

    // 1) 앞선 문 영상 정지
    if (gateVideo) gateVideo.pause();

    // 2) 문 -> 입장 연출 스테이지 전환
    stageGate.classList.remove('active');
    stageEnter.classList.add('active');

    if (enterVideo) {
      primeEnterVideo();

      // 비디오가 끝나면(ended) 다시 재생되지 않고, 즉시 16:9 와이드 파노라마 마당으로 전환!
      const onEnterEnd = () => {
        enterVideo.removeEventListener('ended', onEnterEnd);
        stageEnter.classList.remove('active');
        enterSpiritsMenu();
      };
      enterVideo.addEventListener('ended', onEnterEnd);

      /*
       * 받아지기를 조금 기다렸다가 튼다.
       *
       * 받으면서 틀면 뚝뚝 끊긴다. 그래서 끊기지 않고 끝까지 갈 만큼 받아졌는지
       * 보고 시작한다. 안전 시계도 **튼 다음부터** 센다 — 기다린 시간까지
       * 같이 세면 영상이 채 돌기도 전에 잘린다.
       */
      let started = false;
      const begin = () => {
        if (started) return;
        started = true;
        enterVideo.currentTime = 0;
        enterVideo.muted = !isAudioActive;
        if (isAudioActive) enterVideo.volume = 1.0;
        enterVideo.play().catch((err) => console.log("Video play:", err));
        setTimeout(() => {
          if (stageEnter.classList.contains('active')) onEnterEnd();
        }, 5500);
      };

      if (enterVideo.readyState >= 4) {
        begin();
      } else {
        enterVideo.addEventListener('canplaythrough', begin, { once: true });
        // 아무리 늦어도 1.8초 뒤에는 시작한다. 손님을 까만 화면에 세워 두지 않는다
        setTimeout(begin, 1800);
      }
    } else {
      stageEnter.classList.remove('active');
      enterSpiritsMenu();
    }
  }

  // ================= 4. 사주 정보 제출 ➡️ 명식 봉인 해제 후 입장 =================
  if (btnSubmitSaju) {
    btnSubmitSaju.addEventListener('click', () => {
      userState.name = (inputName && inputName.value.trim()) || "";
      userState.birthDate = inputBirth ? inputBirth.value : userState.birthDate;
      userState.birthPlace = (inputPlace && inputPlace.value) || "서울";
      userState.gender = selectedGender;

      let finalTime = '12:00';
      let timeKnown = true;
      if (inputTimeUnknown && inputTimeUnknown.checked) {
        timeKnown = false;
        const slot = (inputTimeSlot && inputTimeSlot.value) || 'mi';
        finalTime = TIME_MAP[slot] || '12:00';
      } else if (inputTime && inputTime.value) {
        finalTime = normalizeBirthTime(inputTime.value);
        if (!finalTime) { inputTime.setCustomValidity('시간을 다시 적어 주십시오.'); inputTime.reportValidity(); return; }
        inputTime.setCustomValidity('');
        timeKnown = true;
      } else {
        timeKnown = false;
        finalTime = '12:00';
      }
      userState.birthTime = finalTime;
      userState.timeKnown = timeKnown;

      const mappedGender = (userState.gender === 'female' || userState.gender === '여') ? '여' : '남';

      saveReading({
        birth: {
          name: userState.name,
          date: userState.birthDate,
          time: finalTime,
          timeKnown: timeKnown,
          place: userState.birthPlace,
          gender: mappedGender,
        }
      });

      if (userInfoDisplay) {
        userInfoDisplay.innerHTML = userState.name
          ? `<span class="user-icon">🏮</span><span class="user-name-text"><strong>${userState.name}</strong> 님의 명식 봉인 해제</span>`
          : `<span class="user-icon">🏮</span><span class="user-name-text">명식 봉인 해제</span>`;
      }

      if (sajuInputModal) sajuInputModal.classList.remove('active');

      enterSpiritWorld();
    });
  }

  // ================= 5. 신령 열 분 메뉴판 (갈래 탭 10개 + 청월당 스타일 상품 카드 캐러셀) =================
  /*
   * 갈래 목록은 서버가 상품표에서 뽑아 넣어 준다.
   *
   * 터진 뒤에 적은 것 (2026-09-28): 「시험과 취업」 갈래를 새로 만들었는데 이
   * 목록이 손으로 적혀 있어서 급제신령과 그 상품 넷이 신령계 메뉴에 아예
   * 나오지 않았다. 「전체」도 이 목록을 돌기 때문에 거기서도 빠졌다.
   * 아래 목록은 서버가 값을 못 넣어 준 때를 위한 마지막 보루다.
   */
  const CATEGORIES = Array.isArray(window.__CATEGORIES__) && window.__CATEGORIES__.length
    ? window.__CATEGORIES__
    : [
    { name: '연애',    spirit: { id: 'flower',   name: '도화신령', question: '이 사람, 어떨까?' } },
    { name: '재회',    spirit: { id: 'moon',     name: '월신령',   question: '다시 만날 수 있을까?' } },
    { name: '궁합',    spirit: { id: 'thread',   name: '연신령',   question: '우리, 잘 맞을까?' } },
    { name: '가족',    spirit: { id: 'mountain', name: '산신령',   question: '우리 아이는 어떤 아이일까?' } },
    { name: '작명',    spirit: { id: 'name',     name: '작명신령', question: '우리 아이 이름, 뭐로 지을까?' } },
    { name: '출산',    spirit: { id: 'birth',    name: '삼신할매', question: '언제 낳는 게 좋을까?' } },
    { name: '나',      spirit: { id: 'mirror',   name: '명경신령', question: '나는 어떤 사람일까?' } },
    { name: '삼합',    spirit: { id: 'cross',    name: '삼합신령', question: '셋이 같은 말을 할까?' } },
    { name: '돈과 일', spirit: { id: 'jar',      name: '재신령',   question: '먹고사는 일은 풀릴까?' } },
    { name: '시험과 취업', spirit: { id: 'pass', name: '급제신령', question: '이번엔 붙을까?' } },
    { name: '시기',    spirit: { id: 'wind',     name: '풍신령',   question: '지금이 그때일까?' } },
  ];

  let currentCategory = '전체';
  let spiritsMenuRendered = false;
  let catalogProducts = (Array.isArray(window.__CATALOG_PRODUCTS__) && window.__CATALOG_PRODUCTS__.length > 0) ? window.__CATALOG_PRODUCTS__ : [];
  let isProductsLoading = false;

  async function fetchCatalogProducts() {
    if (Array.isArray(window.__CATALOG_PRODUCTS__) && window.__CATALOG_PRODUCTS__.length > 0) {
      catalogProducts = window.__CATALOG_PRODUCTS__;
      return catalogProducts;
    }
    if (catalogProducts.length > 0) return catalogProducts;
    if (isProductsLoading) return [];
    isProductsLoading = true;
    try {
      const res = await fetch('/api/products');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.products)) {
          catalogProducts = data.products;
        }
      }
    } catch (err) {
      console.error('Failed to fetch products:', err);
    } finally {
      isProductsLoading = false;
    }
    return catalogProducts;
  }

  const categoryTabsContainer = document.getElementById('spiritsCategoryTabs');
  const productCarouselTrack = document.getElementById('productCarouselTrack');

  /*
   * ── 맛보기 ─────────────────────────────────────────────────────────
   *
   * 카드를 누르면 상세페이지로 튕겨 보내지 않는다. **그 자리에서** 신령이
   * 손님의 진짜 사주를 조금 봐 준다. 값 얘기를 듣기 전에 손님이 받아 가는
   * 것이 하나 있어야 한다.
   *
   * 판단은 전부 룰 엔진이 한다 — 여덟 글자·힘의 방향·올해는 window.MS 가
   * 계산하고, 신령의 말은 /api/taste 가 그 계산 결과를 문장으로 옮긴다.
   * 모델을 부르지 않으므로 공짜로 줘도 값이 들지 않는다.
   */
  function tasteBirth() {
    const date = (userState.birthDate || '').trim();
    if (!date) return null;
    const raw = userState.birthTime || '';
    const time = TIME_MAP[raw] || normalizeBirthTime(raw) || null;
    const gender = (userState.gender === 'female' || userState.gender === '여') ? '여' : '남';
    return { date: date, time: time, gender: gender };
  }

  /** 신령이 말할 때 쓰는 재료. 못 재면 아는 것 없이 말한다 */
  function tasteFacts() {
    const out = {
      name: (userState.name || '').trim(), dayStem: '', dayElement: '', eight: '',
      strong: false, topGod: '', lackGod: '', topElement: '', lackElement: '', timeKnown: false,
    };
    const b = tasteBirth();
    if (!b || !window.MS || !MS.calculate || !MS.analyze) return out;
    out.timeKnown = b.timeKnown !== false && !!b.time;
    try {
      const ms = MS.calculate({ date: b.date, time: b.time || null });
      const an = MS.analyze(ms);
      out.eight = [ms.year, ms.month, ms.day, ms.hour]
        .filter(Boolean).map((x) => x.stem + x.branch).join(' ');
      out.dayStem = ms.day.stem;
      out.dayElement = an.dayMaster.element;
      out.strong = an.strength.verdict === '신강';
      const g = an.godCounts || {};
      const keys = Object.keys(g).sort((a, b2) => g[b2] - g[a]);
      out.topGod = keys[0] || '';
      out.lackGod = (an.missingGroups && an.missingGroups[0]) || keys[keys.length - 1] || '';
      const el = (an.elements || []).slice().sort((a, b2) => b2.weight - a.weight);
      out.topElement = (el[0] && el[0].element) || '';
      out.lackElement = (an.missingElements && an.missingElements[0]) || '';
    } catch (err) { /* 못 재도 칸은 열린다 */ }
    return out;
  }

  /** 근거로 함께 보여줄 풀이. 생년월일이 없으면 null */
  function tasteReading() {
    const b = tasteBirth();
    if (!b || !window.MS || !MS.calculate || !MS.analyze || !MS.freeReading) return null;
    try {
      const ms = MS.calculate({ date: b.date, time: b.time || null });
      return MS.freeReading(ms, MS.analyze(ms),
        { gender: b.gender, todayYear: new Date().getFullYear() });
    } catch (err) { return null; }
  }

  /* 손님 이름이 그대로 들어가는 자리가 있어 innerHTML 을 쓰지 않는다 */
  function tEl(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined && text !== null) e.textContent = text;
    return e;
  }

  // 상품표의 needs 항목만 보고 입력칸을 만든다. 새 항목이 생겨도 같은 길을 쓴다.
  function tasteNeeds(panel, product) {
    const box = tEl('section', 'taste-needs');
    box.appendChild(tEl('h4', 'taste-t', '이 상품에 필요한 것'));
    const saved = loadReading() || {};
    const own = saved.birth || tasteBirth() || {};
    const summary = tEl('p', 'taste-own',
      (own.name || userState.name || '손님') + ' · ' + (own.date || '생년월일 없음') + ' · ' + (own.timeKnown === false ? '시간을 모름' : (own.time || '시간을 모름')));
    box.appendChild(summary);
    const edit = tEl('button', 'taste-edit', '내 명식 고치기');
    edit.type = 'button';
    edit.addEventListener('click', () => { if (sajuInputModal) sajuInputModal.style.display = 'flex'; });
    box.appendChild(edit);
    const fields = {};
    function field(key, label, type, value) {
      const wrap = tEl('label', 'taste-field');
      wrap.appendChild(tEl('span', null, label));
      const input = tEl('input');
      input.type = type;
      input.value = value || '';
      input.dataset.tasteKey = key;
      wrap.appendChild(input);
      box.appendChild(wrap);
      fields[key] = input;
      return input;
    }
    /*
     * 고르는 칸.
     *
     * 터진 뒤에 적은 것 (2026-10-05): 아이 성별을 「남아」로 미리 골라 두었다.
     * 딸인데 그냥 지나치면 **대운이 거꾸로** 나간다 — 리포트 전체가 틀린다.
     * 그래서 아무것도 안 골라진 채로 두고, 고르셔야 넘어가게 한다.
     */
    function pickField(key, label, choices, value) {
      const wrap = tEl('label', 'taste-field');
      wrap.appendChild(tEl('span', null, label));
      const sel = tEl('select');
      sel.dataset.tasteKey = key;
      const blank = tEl('option', null, '— 고르지 않음 —');
      blank.value = '';
      sel.appendChild(blank);
      choices.forEach(([v, t]) => { const o = tEl('option', null, t); o.value = v; sel.appendChild(o); });
      sel.value = value || '';
      wrap.appendChild(sel);
      box.appendChild(wrap);
      fields[key] = sel;
      return sel;
    }
    function timeField(key, label, value) {
      const input = field(key, label, 'text', value);
      input.inputMode = 'numeric';
      input.placeholder = '예: 14:40, 1440, 905';
      const unknown = tEl('button', 'taste-time-unknown', '시간을 모릅니다');
      unknown.type = 'button';
      unknown.setAttribute('aria-pressed', 'false');
      unknown.addEventListener('click', () => {
        const on = unknown.getAttribute('aria-pressed') !== 'true';
        unknown.setAttribute('aria-pressed', on ? 'true' : 'false');
        input.disabled = on;
        if (on) input.value = '';
        box.dispatchEvent(new Event('input', { bubbles: true }));
      });
      input.parentNode.appendChild(unknown);
      fields[key + 'Unknown'] = unknown;
    }
    const needsChild = product.needsChild || product.needsChildBirth;
    if (needsChild) {
      field('childDate', '아이 생년월일', 'date', saved.child && saved.child.date);
      timeField('childTime', '아이가 태어난 시간', saved.child && saved.child.time);
      pickField('childGender', '아이 성별', [['남', '남아'], ['여', '여아']], saved.child && saved.child.gender);
    }
    if (product.needsPartner) {
      field('partnerDate', '상대 생년월일', 'date', saved.partner && saved.partner.date);
      timeField('partnerTime', '상대가 태어난 시간', saved.partner && saved.partner.time);
    }
    if (product.needsRange) {
      field('rangeFrom', '시작 날짜', 'date', saved.range && saved.range.from);
      field('rangeTo', '끝 날짜', 'date', saved.range && saved.range.to);
      field('rangeAvoid', '피하고 싶은 날짜 (선택)', 'text', saved.range && (saved.range.avoid || []).join(', '));
    }
    if (product.needsPick) {
      field('pickDates', '수술할 수 있는 날짜 (쉼표로 구분)', 'text', saved.pick && (saved.pick.dates || []).join(', ')).placeholder = '예: 2026-10-20, 2026-10-22';
      field('pickTimes', '수술할 수 있는 시각 (쉼표로 구분)', 'text', saved.pick && (saved.pick.times || []).join(', ')).placeholder = '예: 09:00, 14:00';
    }
    if (product.needsName) {
      field('surname', '아이의 성', 'text', saved.name && saved.name.surname);
      const fixedInput = field('fixedChar', '꼭 넣을 글자 (선택)', 'text', saved.name && saved.name.fixed && saved.name.fixed.char);
      const hanjaList = tEl('div', 'taste-hanja-list');
      box.appendChild(hanjaList);
      let hanjaTimer;
      fixedInput.addEventListener('input', () => {
        clearTimeout(hanjaTimer);
        hanjaList.textContent = '';
        const sound = fixedInput.value.trim();
        if (!/^[가-힣]$/.test(sound)) return;
        hanjaTimer = setTimeout(async () => {
          try {
            const url = '/api/naming/hanja?reading=' + encodeURIComponent(sound)
              + '&surname=' + encodeURIComponent(fields.surname.value.trim());
            const response = await fetch(url);
            if (!response.ok) return;
            const list = (await response.json()).글자들 || [];
            if (fixedInput.value.trim() !== sound) return;
            list.forEach((item) => {
              const choice = tEl('button', 'taste-hanja-choice',
                item.자 + '  ' + (item.뜻 ? item.뜻 + '  ' : '') + item.획 + '획');
              choice.type = 'button';
              choice.addEventListener('click', () => { fixedInput.value = item.자; box.dispatchEvent(new Event('input', { bubbles: true })); });
              hanjaList.appendChild(choice);
            });
          } catch (err) { /* 뜻 표가 안 열려도 글자는 손으로 적을 수 있다 */ }
        }, 250);
      });
      const at = tEl('select');
      at.innerHTML = '<option value="">글자 자리 고르기</option><option value="앞">성 뒤</option><option value="뒤">이름 끝</option>';
      at.value = saved.name && saved.name.fixed ? saved.name.fixed.at : '';
      box.appendChild(at);
      fields.fixedAt = at;
      field('avoidChars', '피할 글자 (선택)', 'text', saved.name && (saved.name.avoid || []).join(', '));
    }
    if (product.needsFamily) {
      const family = tEl('div', 'taste-family');
      const add = tEl('button', 'taste-edit', '+ 가족 한 분 더 넣기');
      add.type = 'button';
      const rows = [];
      function addRow(person) {
        const row = tEl('div', 'taste-family-row');
        const relation = tEl('input'); relation.placeholder = '관계'; relation.value = person && person.relation || '';
        const date = tEl('input'); date.type = 'date'; date.value = person && person.date || '';
        const time = tEl('input'); time.type = 'text'; time.placeholder = '태어난 시각'; time.value = person && person.time || '';
        const unknown = tEl('button', 'taste-time-unknown', '시간을 모릅니다'); unknown.type = 'button';
        unknown.addEventListener('click', () => { time.disabled = !time.disabled; if (time.disabled) time.value = ''; row.dispatchEvent(new Event('input', { bubbles: true })); });
        row.append(relation, date, time, unknown); family.appendChild(row);
        rows.push({ relation, date, time });
      }
      (saved.family && saved.family.length ? saved.family : [{}]).forEach(addRow);
      add.addEventListener('click', () => addRow({}));
      box.append(family, add);
      fields.familyRows = rows;
    }
    panel.appendChild(box);
    function normTime(input) {
      if (!input || input.disabled) return '12:00';
      return normalizeBirthTime(input.value);
    }
    function collect() {
      const missing = [];
      const data = { productId: product.id, birth: own };
      if (!product.needsPick && !own.date) missing.push('내 생년월일');
      if (needsChild) {
        if (!fields.childDate.value) missing.push('아이 생년월일');
        if (!normTime(fields.childTime)) missing.push('아이 태어난 시간');
        if (!fields.childGender.value) missing.push('아이 성별');
        data.child = { date: fields.childDate.value, time: normTime(fields.childTime),
          gender: fields.childGender.value };
      }
      if (product.needsPartner) {
        if (!fields.partnerDate.value) missing.push('상대 생년월일');
        if (!normTime(fields.partnerTime)) missing.push('상대 태어난 시간');
        data.partner = { date: fields.partnerDate.value, time: normTime(fields.partnerTime) };
      }
      if (product.needsRange) {
        if (!fields.rangeFrom.value || !fields.rangeTo.value) missing.push('보고 싶은 기간');
        data.range = { from: fields.rangeFrom.value, to: fields.rangeTo.value,
          avoid: fields.rangeAvoid.value.split(/[,\s]+/).filter(Boolean) };
      }
      if (product.needsPick) {
        data.pick = { dates: fields.pickDates.value.split(/[,\s]+/).filter(Boolean),
          times: fields.pickTimes.value.split(/[,\s]+/).filter(Boolean) };
        if (!data.pick.dates.length) missing.push('수술 후보 날짜');
        if (!data.pick.times.length) missing.push('수술 후보 시각');
      }
      if (product.needsName) {
        if (!fields.surname.value.trim()) missing.push('아이의 성');
        if (fields.fixedChar.value.trim() && !fields.fixedAt.value) missing.push('글자를 넣을 자리');
        data.name = { surname: fields.surname.value.trim(),
          avoid: fields.avoidChars.value.split(/[,\s]+/).filter(Boolean) };
        if (fields.fixedChar.value.trim()) data.name.fixed = { char: fields.fixedChar.value.trim(), at: fields.fixedAt.value };
      }
      if (product.needsFamily) {
        data.family = fields.familyRows.map((row) => ({ relation: row.relation.value.trim() || '가족',
          date: row.date.value, time: normTime(row.time) })).filter((row) => row.date);
        if (!data.family.length) missing.push('가족 생년월일');
      }
      const photos = (window.NB재기 && window.NB재기.담긴값) ? window.NB재기.담긴값() : (loadReading() || {});
      if (photos.face || (photos.보여줌 && photos.보여줌.face)) data.face = photos.face || { shown: true };
      if (photos.palm || (photos.보여줌 && photos.보여줌.palm)) data.palm = photos.palm || { shown: true };
      return { data, missing };
    }
    return { box, collect };
  }

  function drawTaste(panel, href, res) {
    panel.textContent = '';
    const heroSlot = tEl('div', 'taste-hero-slot');
    panel.appendChild(heroSlot);

    if (res && res.lines && res.lines.length) {
      const say = tEl('div', 'taste-say');
      res.lines.forEach((t) => say.appendChild(tEl('p', null, t)));
      panel.appendChild(say);
    }

    const r = tasteReading();
    if (r) {
      // 어느 글자에서 나온 말인지 보여준다. 근거 없는 결론은 두지 않는다
      const b1 = tEl('section', 'taste-b');
      b1.appendChild(tEl('h4', 'taste-t', '손님의 여덟 글자'));
      const tb = tEl('table', 'taste-tb');
      const thead = tEl('thead');
      const hr = tEl('tr');
      // 큰 글씨는 쉬운 말, 작은 글씨로 명리 용어. 용어를 던지고 끝내지 않는다
      [['자리', ''], ['위 글자', '천간'], ['아래 글자', '지지']].forEach((h) => {
        const th = tEl('th', null, h[0]);
        if (h[1]) th.appendChild(tEl('span', 'taste-term', h[1]));
        hr.appendChild(th);
      });
      thead.appendChild(hr);
      tb.appendChild(thead);
      const tbody = tEl('tbody');
      (r.eight || []).forEach((row) => {
        const tr = tEl('tr');
        tr.appendChild(tEl('td', 'taste-pos', row.position));
        [[row.stem, row.stemGod], [row.branch, row.branchGod]].forEach((pair) => {
          const td = tEl('td');
          td.appendChild(tEl('span', 'taste-ch', pair[0]));
          td.appendChild(tEl('span', 'taste-god', pair[1]));
          tr.appendChild(td);
        });
        tbody.appendChild(tr);
      });
      tb.appendChild(tbody);
      b1.appendChild(tb);
      panel.appendChild(b1);

      const b2 = tEl('section', 'taste-b');
      b2.appendChild(tEl('h4', 'taste-t', '힘은 어느 쪽인가'));
      /*
       * 앞 문장을 굵게 올리고 명리 용어는 옆에 작게 붙인다. 「신약」만
       * 덩그러니 띄우면 손님은 그게 나쁜 말인 줄 안다.
       */
      const say = r.strength.say || '';
      const dot = say.indexOf('. ');
      const lead = dot > 0 ? say.slice(0, dot + 1) : say;
      const rest = dot > 0 ? say.slice(dot + 2) : '';
      const verdict = tEl('p', 'taste-verdict', lead);
      const TERM = { 신강: '신강(身強)', 신약: '신약(身弱)', 중화: '중화(中和)' };
      const term = TERM[r.strength.verdict];
      if (term) verdict.appendChild(tEl('span', 'taste-term', term));
      b2.appendChild(verdict);
      if (rest) b2.appendChild(tEl('p', null, rest));
      panel.appendChild(b2);

      // 올해가 안 나오면 그 칸은 통째로 뺀다. 억지로 채우지 않는다
      const nowYear = (r.years || []).filter((y) => y.now)[0];
      if (nowYear) {
        const b3 = tEl('section', 'taste-b');
        b3.appendChild(tEl('h4', 'taste-t', '올해'));
        const y = tEl('p', 'taste-verdict', nowYear.year + '년');
        y.appendChild(tEl('span', 'taste-term', nowYear.ganzhi + '년'));
        b3.appendChild(y);
        b3.appendChild(tEl('p', null, nowYear.say));
        panel.appendChild(b3);
      }
    } else {
      panel.appendChild(tEl('p', 'taste-cut',
        '태어난 날을 밝히시면 손님의 여덟 글자까지 여기 펼쳐 드립니다.'));
    }

    // 끊는 자리를 신령이 직접 말한다. 그래야 손님이 속았다고 느끼지 않는다
    if (res && res.more) panel.appendChild(tEl('p', 'taste-cut', res.more));

    const productId = panel.dataset.of || '';
    const product = catalogProducts.find((item) => item.id === productId);
    if (!product) return;
    const needs = tasteNeeds(panel, product);
    const needsFace = (productId === 'cross-report' || productId === 'face-palm-report' || productId === 'saju-face-report');
    const needsPalm = (productId === 'cross-report' || productId === 'face-palm-report' || productId === 'saju-palm-report');
    const needsPhoto = needsFace || needsPalm;

    let jaegiSec = null;
    let updateGoLock = null;
    let faceDone = false;
    let palmDone = false;

    if (needsPhoto) {
      jaegiSec = tEl('section', 'taste-jaegi');
      const promiseP = tEl('p', 'taste-jaegi-promise', '🔒 사진은 손님 기기 안에서만 봅니다. 서버로 보내지 않고 저장하지도 않습니다.');
      /*
       * 터진 뒤에 적은 것 (2026-10-03): 어느 손을 올려야 하는지 안 적어 두니
       * 손님이 「왼손? 오른손?」 하고 멈춘다. 멈추면 그대로 나간다.
       * 유파마다 다르므로 우리가 정하지 않고, 흔히 쓰는 기준을 알려 준다.
       */
      jaegiSec.appendChild(promiseP);
      /* 도구를 미리 받아 둔다. 사진을 고를 때쯤이면 준비돼 있다 */
      if (window.NB재기 && window.NB재기.미리받는다) window.NB재기.미리받는다(needsFace, needsPalm);

      const savedReading = (window.NB재기 && window.NB재기.담긴값) ? window.NB재기.담긴값() : (loadReading() || {});
      const 보여줌 = (savedReading && savedReading.보여줌) || {};
      faceDone = !!((savedReading && savedReading.face) || 보여줌.face);
      palmDone = !!((savedReading && savedReading.palm) || 보여줌.palm);

      if (needsFace) {
        const box = tEl('div', 'taste-jaegi-box');
        const faceLabel = tEl('label', 'taste-jaegi-btn' + (faceDone ? ' done' : ''));
        const input = tEl('input', 'taste-jaegi-file');
        input.type = 'file';
        input.accept = 'image/*';
        /*
         * 터진 뒤에 적은 것 (2026-10-03): 관상용 얼굴 사진을 미리 찍어 둔 사람은 없다.
         * 앨범만 열리면 손님은 뒤로 나가 사진부터 찍고 다시 들어와야 한다.
         * 그 사이에 그냥 가 버린다. **그 자리에서 바로 찍게 한다.**
         */
        input.setAttribute('capture', 'user');
        const span = tEl('span', null, faceDone ? '✓ 📷 얼굴 사진 확인됨' : '📷 얼굴 사진 찍기 / 올리기');
        faceLabel.appendChild(input);
        faceLabel.appendChild(span);
        box.appendChild(faceLabel);

        const faceMsg = tEl('p', 'taste-jaegi-msg', faceDone ? '얼굴을 다 재었습니다. 풀이에 그대로 씁니다.' : '');
        box.appendChild(faceMsg);
        jaegiSec.appendChild(box);

        input.addEventListener('change', function() {
          const file = input.files && input.files[0];
          if (!file) return;
          faceMsg.textContent = '얼굴을 찾고 있습니다… 처음 한 번은 조금 걸립니다.';
          faceMsg.className = 'taste-jaegi-msg';
          if (!window.NB재기 || !window.NB재기.얼굴) {
            faceMsg.textContent = '사진은 받았습니다. 지금은 못 재었지만 풀이는 그대로 나옵니다.';
            if (window.NB재기 && window.NB재기.보여줬다) window.NB재기.보여줬다('face');
            faceDone = true;
            if (updateGoLock) updateGoLock();
            return;
          }
          window.NB재기.얼굴(file).then(function(val) {
            faceDone = true;
            faceLabel.classList.add('done');
            span.textContent = '✓ 📷 얼굴 사진 확인됨';
            faceMsg.textContent = '얼굴을 다 재었습니다. 풀이에 그대로 씁니다.';
            if (updateGoLock) updateGoLock();
          }).catch(function(err) {
            faceMsg.textContent = '사진은 받았습니다. 지금은 못 재었지만 풀이는 그대로 나옵니다.';
            if (window.NB재기 && window.NB재기.보여줬다) window.NB재기.보여줬다('face');
            faceLabel.classList.add('done');
            span.textContent = '✓ 📷 얼굴 사진 받음';
            faceDone = true;
            if (updateGoLock) updateGoLock();
          });
        });
      }

      if (needsPalm) {
        jaegiSec.appendChild(tEl('p', 'taste-jaegi-hand',
          '남자는 왼손, 여자는 오른손을 올려주십시오 (남좌여우).'));
        const box = tEl('div', 'taste-jaegi-box');
        const palmLabel = tEl('label', 'taste-jaegi-btn' + (palmDone ? ' done' : ''));
        const input = tEl('input', 'taste-jaegi-file');
        input.type = 'file';
        input.accept = 'image/*';
        input.setAttribute('capture', 'environment');
        const span = tEl('span', null, palmDone ? '✓ ✋ 손바닥 사진 확인됨' : '✋ 손바닥 사진 찍기 / 올리기');
        palmLabel.appendChild(input);
        palmLabel.appendChild(span);
        box.appendChild(palmLabel);

        const currentShape = (savedReading.palm && savedReading.palm.handShape) || '금형';
        const palmMsg = tEl('p', 'taste-jaegi-msg', palmDone ? ('손 모양을 다 재었습니다 — ' + currentShape + '. 풀이에 그대로 씁니다.') : '');
        box.appendChild(palmMsg);
        jaegiSec.appendChild(box);

        input.addEventListener('change', function() {
          const file = input.files && input.files[0];
          if (!file) return;
          palmMsg.textContent = '손을 찾고 있습니다… 처음 한 번은 조금 걸립니다.';
          palmMsg.className = 'taste-jaegi-msg';
          if (!window.NB재기 || !window.NB재기.손) {
            palmMsg.textContent = '사진은 받았습니다. 지금은 못 재었지만 풀이는 그대로 나옵니다.';
            if (window.NB재기 && window.NB재기.보여줬다) window.NB재기.보여줬다('palm');
            palmDone = true;
            if (updateGoLock) updateGoLock();
            return;
          }
          window.NB재기.손(file).then(function(val) {
            palmDone = true;
            palmLabel.classList.add('done');
            span.textContent = '✓ ✋ 손바닥 사진 확인됨';
            const shape = (val && val.handShape) || '금형';
            palmMsg.textContent = '손 모양을 다 재었습니다 — ' + shape + '. 풀이에 그대로 씁니다.';
            if (updateGoLock) updateGoLock();
          }).catch(function(err) {
            palmMsg.textContent = '사진은 받았습니다. 지금은 못 재었지만 풀이는 그대로 나옵니다.';
            if (window.NB재기 && window.NB재기.보여줬다) window.NB재기.보여줬다('palm');
            palmLabel.classList.add('done');
            span.textContent = '✓ ✋ 손바닥 사진 받음';
            palmDone = true;
            if (updateGoLock) updateGoLock();
          });
        });
      }

      panel.appendChild(jaegiSec);

    }

    const revealRow = tEl('div', 'taste-reveal-row');
    const reveal = tEl('button', 'taste-go', '신령께 보여 드리기');
    reveal.type = 'button';
    const missing = tEl('p', 'taste-missing');
    revealRow.append(reveal, missing);
    panel.appendChild(revealRow);
    const previewOne = tEl('section', 'taste-masked');
    const previewTwo = tEl('section', 'taste-masked');
    const previewThree = tEl('section', 'taste-masked');
    /*
     * 세 대목은 **한 덩어리로** 둔다.
     *
     * 전에는 상세 설명 사이사이에 하나씩 끼워 두었다. 손님이 첫 대목을 읽고
     * 다른 글을 지나야 둘째가 나왔다. 신령이 하는 말은 신령이 하는 말끼리
     * 붙어 있어야 한 사람이 말하는 것으로 들린다.
     */
    const 말함 = tEl('section', 'taste-say-block');
    말함.appendChild(tEl('h3', 'pd-h taste-say-head', '신령이 이렇게 말합니다'));
    말함.append(previewOne, previewTwo, previewThree);
    panel.appendChild(말함);
    const detail = tEl('div', 'taste-detail');
    panel.appendChild(detail);
    detail.addEventListener('click', (event) => {
      const link = event.target.closest && event.target.closest('a[href^="/products/"]');
      if (!link) return;
      const otherId = decodeURIComponent((link.getAttribute('href') || '').split('/').pop());
      const card = productCarouselTrack && productCarouselTrack.querySelector('[data-product-id="' + otherId + '"]');
      if (card) { event.preventDefault(); card.click(); }
    });
    let revealed = false;
    function lockState() {
      const check = needs.collect();
      if (needsFace && !faceDone && !check.data.face) check.missing.push('얼굴 사진');
      if (needsPalm && !palmDone && !check.data.palm) check.missing.push('손바닥 사진');
      reveal.disabled = check.missing.length > 0;
      missing.textContent = check.missing.length ? '먼저 적어 주세요: ' + check.missing.join(' · ') : '';
      return check;
    }
    updateGoLock = lockState;
    needs.box.addEventListener('input', lockState);
    needs.box.addEventListener('change', lockState);
    lockState();
    function fillMasked(target, section) {
      target.textContent = '';
      target.appendChild(tEl('h3', 'pd-h', section.title));
      // 큰 글씨는 쉬운 말, 작은 글씨로 명리 용어. 용어를 던지고 끝내지 않는다
      if (section.lead) {
        const lead = tEl('p', 'taste-masked-lead', section.lead);
        if (section.term) lead.appendChild(tEl('span', 'taste-term', section.term));
        target.appendChild(lead);
      }
      const p = tEl('p', 'taste-masked-line');
      section.parts.forEach((part) => {
        p.appendChild(tEl('span', part.hidden ? 'taste-mask-word' : '', part.hidden ? '▓'.repeat(Math.min([...part.text].length, 8)) : part.text));
        if (part.hidden) p.appendChild(tEl('span', 'taste-unlock', '🔒 리포트에서 풀어 드립니다'));
      });
      target.appendChild(p);
      // 모든 결론에 근거를 단다. 어느 글자에서 나온 말인지 밝힌다
      if (section.basis) target.appendChild(tEl('p', 'taste-masked-basis', '근거 · ' + section.basis));
    }
    reveal.addEventListener('click', async () => {
      const check = lockState();
      if (check.missing.length) return;
      saveReading(check.data);
      reveal.disabled = true;
      reveal.textContent = '손님의 자료를 살피고 있습니다…';
      try {
        const response = await fetch('/api/preview', { method: 'POST',
          headers: { 'content-type': 'application/json' }, body: JSON.stringify(check.data) });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || '맛보기를 만들지 못했습니다.');
        const sections = data.preview && data.preview.sections;
        if (!sections || sections.length !== 3) throw new Error('맛보기 세 대목을 만들지 못했습니다.');
        [previewOne, previewTwo, previewThree].forEach((target, i) => fillMasked(target, sections[i]));
        revealed = true;
        reveal.textContent = '다시 살펴보기';
        missing.textContent = '';
      } catch (err) {
        missing.textContent = err.message || '잠시 뒤 다시 해 주십시오.';
        reveal.textContent = '다시 보여 드리기';
      } finally { lockState(); }
    });
    fetch(href).then((response) => response.text()).then((html) => {
      if (!panel.isConnected) return;
      const doc = new DOMParser().parseFromString(html, 'text/html');
      const style = doc.querySelector('style');
      if (style && !document.getElementById('tasteProductStyle')) {
        const copied = tEl('style'); copied.id = 'tasteProductStyle'; copied.textContent = style.textContent;
        document.head.appendChild(copied);
      }
      const page = doc.querySelector('.pr');
      if (!page) return;
      ['.pd-hero-box', '.pd-pitch-box', '.pd-term', '.pr-desc'].forEach((selector) => {
        const el = page.querySelector(selector);
        if (el) heroSlot.appendChild(el);
      });
      function take(selector) { const el = page.querySelector(selector); if (el) detail.appendChild(el); }
      take('.pd-fit');
      const contents = page.querySelector('.pd-contents-list');
      if (contents) detail.appendChild(contents.closest('.pd-sec'));
      take('.pd-why');
      take('.pd-faq');
      const glossary = page.querySelector('.pd-gloss');
      if (glossary) { glossary.open = true; detail.appendChild(glossary); }
      const buy = page.querySelector('.pd-buy');
      if (buy) {
        buy.querySelectorAll('.pd-go, .pd-also').forEach((el) => {
          if (el.textContent.includes('결제 화면') || el.classList.contains('pd-go')) el.remove();
        });
        const button = tEl('button', 'taste-buy', '자세한 내용 받기');
        button.type = 'button';
        button.addEventListener('click', () => {
          if (!revealed) { reveal.scrollIntoView({ behavior: 'smooth', block: 'center' }); return; }
          openTasteCheckout(productId);
        });
        /*
         * 터진 뒤에 적은 것 (2026-10-05): 펼친 칸에 값을 적으면 손님이 값부터 재고
         * 나간다. **값은 결제 화면에서만 보인다.** 「11월 1일부터 얼마」 같은 띠도
         * 값이므로 같이 걷어 낸다.
         */
        buy.querySelectorAll('.pd-launch-bar').forEach((el) => el.remove());
        buy.appendChild(button);
        detail.appendChild(buy);
      } else {
        // 오늘·한 달 상품은 별도 상세 양식을 쓴다. 이 경우에도 홈 안에서 값을 보고 결제창을 연다.
        const special = page.querySelector('.dp-price-card, .mp-price-card');
        const specialBuy = special || tEl('section', 'taste-special-buy');
        specialBuy.querySelectorAll('a[href^="/checkout"], a[href^="/products"]').forEach((el) => el.remove());
        // 값이 적힌 조각은 전부 걷어 낸다. 값은 결제 화면에서만 보인다
        specialBuy.querySelectorAll('.pd-launch-bar, .dp-launch-bar, .mp-launch-bar, .dp-price-tag, .mp-price-tag, .dp-price-amount, .mp-price-amount').forEach((el) => el.remove());
        const button = tEl('button', 'taste-buy', '자세한 내용 받기');
        button.type = 'button';
        button.addEventListener('click', () => {
          if (!revealed) { reveal.scrollIntoView({ behavior: 'smooth', block: 'center' }); return; }
          openTasteCheckout(productId);
        });
        specialBuy.appendChild(button);
        detail.appendChild(specialBuy);
      }
      take('.pd-cross-box');
      take('.pd-terms');
      take('.pr-note');
      const footer = doc.querySelector('footer');
      if (footer) detail.appendChild(footer);
    }).catch(() => { detail.appendChild(tEl('p', 'taste-missing', '상품 설명을 불러오지 못했습니다. 다시 눌러 주십시오.')); });
    panel.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }

  function closeTasteCheckout() {
    const cover = document.getElementById('tasteCheckoutCover');
    if (cover) cover.remove();
  }

  function openTasteCheckout(productId) {
    closeTasteCheckout();
    const cover = tEl('div', 'taste-checkout-cover');
    cover.id = 'tasteCheckoutCover';
    cover.setAttribute('role', 'dialog');
    cover.setAttribute('aria-modal', 'true');
    cover.setAttribute('aria-label', '결제창');
    const close = tEl('button', 'taste-checkout-close', '← 상품으로 돌아가기');
    close.type = 'button';
    close.addEventListener('click', () => history.back());
    const frame = tEl('iframe', 'taste-checkout-frame');
    frame.title = '결제창';
    frame.src = '/checkout?product=' + encodeURIComponent(productId) + '&embedded=1';
    cover.append(close, frame);
    document.body.appendChild(cover);
    history.pushState({ stage: 'taste', productId: productId, nbCheckout: productId }, '', location.href);
  }

  /*
   * 결제 덮개만 맡는다. 펼침 칸을 여닫는 일은 stage 를 보는 아래쪽
   * popstate 가 맡는다 — 두 곳에서 같이 닫으면 뒤로 한 번에 두 칸이 닫힌다.
   */
  window.addEventListener('popstate', () => {
    if (document.getElementById('tasteCheckoutCover')) closeTasteCheckout();
  });

  // 트랙에 클릭 이벤트 위임 (카드를 누르면 그 자리에서 맛보기가 펼쳐진다)
  if (productCarouselTrack && !productCarouselTrack._hasClickBound) {
    productCarouselTrack._hasClickBound = true;
    productCarouselTrack.addEventListener('click', (e) => {
      const card = e.target.closest('.product-card');
      if (!card) return;
      const productId = card.getAttribute('data-product-id');
      if (!productId) return;
      const href = '/products/' + encodeURIComponent(productId);

      const open = productCarouselTrack.querySelector('.taste-panel');
      if (open && open.dataset.of === productId) {
        open.remove();
        if (history.state && (history.state.stage === 'select' || history.state.stage === 'taste')) {
          history.back();
        }
        return;
      }
      if (open) open.remove();

      // 기다리는 동안 빈 칸이면 손님은 고장 난 줄 안다
      try {
        if (!history.state || history.state.stage !== 'select' || history.state.productId !== productId) {
          history.pushState({ stage: 'select', productId: productId }, '');
        }
      } catch (err) {}
      const panel = tEl('div', 'taste-panel');
      panel.dataset.of = productId;
      panel.appendChild(tEl('p', 'taste-wait', '신령이 여덟 글자를 들여다보는 중…'));
      card.insertAdjacentElement('afterend', panel);
      panel.scrollIntoView({ block: 'nearest', behavior: 'smooth' });

      fetch('/api/taste', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ product: productId, facts: tasteFacts() }),
      })
        .then((r) => (r.ok ? r.json() : null))
        .then((res) => { if (panel.isConnected) drawTaste(panel, href, res); })
        .catch(() => { if (panel.isConnected) drawTaste(panel, href, null); });
    });
  }

  async function renderCategory(categoryName) {
    currentCategory = categoryName;

    // 1) 탭 버튼 활성화 및 중앙 정렬 스크롤
    if (categoryTabsContainer) {
      const tabs = categoryTabsContainer.querySelectorAll('.category-tab');
      tabs.forEach(tab => {
        if (tab.getAttribute('data-category') === categoryName) {
          tab.classList.add('active');
          tab.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
        } else {
          tab.classList.remove('active');
        }
      });
    }

    // 2) 상품 데이터 가져오기
    const products = (Array.isArray(window.__CATALOG_PRODUCTS__) && window.__CATALOG_PRODUCTS__.length > 0)
      ? window.__CATALOG_PRODUCTS__
      : await fetchCatalogProducts();

    let catProducts = [];
    if (categoryName === '전체') {
      // 10개 갈래 순서대로 이어 붙인다
      CATEGORIES.forEach(cat => {
        const inCat = products.filter(p => p.category === cat.name);
        catProducts.push(...inCat);
      });
      // 카테고리 미지정 상품이 있다면 뒤에 포함
      const addedIds = new Set(catProducts.map(p => p.id));
      products.forEach(p => {
        if (!addedIds.has(p.id)) catProducts.push(p);
      });
    } else {
      catProducts = products.filter(p => p.category === categoryName);
    }

    // 3) 카드 렌더링 (세로 목록)
    if (productCarouselTrack) {
      if (catProducts.length === 0) {
        productCarouselTrack.innerHTML = '<div class="carousel-empty">준비된 상품이 없습니다</div>';
      } else {
        productCarouselTrack.innerHTML = catProducts.map((p, i) => {
          const rawHook = p.hook || '';
          const hookText = rawHook.replace(/^[\"'\s]+|[\"'\s]+$/g, '');
          const prodCat = CATEGORIES.find(c => c.name === p.category) || CATEGORIES[0];
          const spiritName = prodCat.spirit.name;
          return [
            '<article class="product-card" data-product-id="' + p.id + '" tabindex="0" role="button" aria-label="' + p.name + '">',
            '  <img src="/img/products/' + p.id + '" alt="' + p.name + '" class="product-card-bg" decoding="async"'
              // 카드를 키웠으니 첫 화면에 걸치는 석 장은 미리 받는다. 까만 네모를 보여주지 않는다
              + (i < 3 ? ' fetchpriority="high">' : ' loading="lazy">'),
            '  <div class="product-card-scrim"></div>',
            '  <div class="product-card-info">',
            '    <div class="product-card-spirit">' + spiritName + '</div>',
            '    <h3 class="product-card-title">' + p.name + '</h3>',
            '    <p class="product-card-hook">"' + hookText + '"</p>',
            '  </div>',
            '</article>'
          ].join('\n');
        }).join('\n');
      }
    }
  }

  function setupSpiritsMenu() {
    if (categoryTabsContainer && !categoryTabsContainer._hasBound) {
      categoryTabsContainer._hasBound = true;
      categoryTabsContainer.addEventListener('click', (e) => {
        const tab = e.target.closest('.category-tab');
        if (!tab) return;
        const cat = tab.getAttribute('data-category');
        if (cat && cat !== currentCategory) {
          renderCategory(cat);
        }
      });
    }

    // 데스크탑 좌우 화살표 버튼
    const tabsArrowPrev = document.getElementById('tabsArrowPrev');
    const tabsArrowNext = document.getElementById('tabsArrowNext');
    if (tabsArrowPrev && !tabsArrowPrev._hasBound) {
      tabsArrowPrev._hasBound = true;
      tabsArrowPrev.addEventListener('click', () => {
        if (categoryTabsContainer) {
          categoryTabsContainer.scrollBy({ left: -160, behavior: 'smooth' });
        }
      });
    }
    if (tabsArrowNext && !tabsArrowNext._hasBound) {
      tabsArrowNext._hasBound = true;
      tabsArrowNext.addEventListener('click', () => {
        if (categoryTabsContainer) {
          categoryTabsContainer.scrollBy({ left: 160, behavior: 'smooth' });
        }
      });
    }

    /*
     * 최초 진입에만 그린다.
     *
     * 터진 뒤에 적은 것 (2026-09-28): 입장 영상의 안전 시계가 늦게 울려
     * setupSpiritsMenu() 가 한 번 더 돌면 목록을 통째로 다시 그렸다. 손님이
     * 펼쳐 둔 맛보기 칸도, 골라 둔 갈래도 그때 다 날아갔다.
     */
    if (!spiritsMenuRendered) {
      spiritsMenuRendered = true;
      renderCategory('전체');
    }
  }

  // DOMContentLoaded 시점에 미리 연애 탭 초기화
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupSpiritsMenu);
  } else {
    setupSpiritsMenu();
  }

  function enterSpiritsMenu() {
    if (stageEnter) stageEnter.classList.remove('active');
    if (stageSpirits) stageSpirits.classList.add('active');
    setupSpiritsMenu();
  }

  function enterCourtyardPanorama() {
    enterSpiritsMenu();
  }

  // ================= 7. 10대 신령 1:1 대면 처소 (1080p 영상 원샷) =================
  const stageChamber = document.getElementById('stageChamber');
  const chamberSpiritVideo = document.getElementById('chamberSpiritVideo');
  const chamberSpiritName = document.getElementById('chamberSpiritName');
  const chamberSpiritDomain = document.getElementById('chamberSpiritDomain');
  const btnExitChamber = document.getElementById('btnExitChamber');

  // ================= 7-1. 정지 화면 위 신령 기운 파티클 (8초 영상이 끝난 뒤부터 무한 루프) =================
  const chamberParticleCanvas = document.getElementById('chamberParticleCanvas');
  const particleCtx = chamberParticleCanvas ? chamberParticleCanvas.getContext('2d') : null;
  let particleAnimId = null;
  let particles = [];

  function resizeParticleCanvas() {
    if (!chamberParticleCanvas || !stageChamber) return;
    const rect = stageChamber.getBoundingClientRect();
    chamberParticleCanvas.width = rect.width;
    chamberParticleCanvas.height = rect.height;
  }

  function spawnParticle(w, h) {
    return {
      x: Math.random() * w,
      y: h + Math.random() * 40,
      r: 0.6 + Math.random() * 1.8,
      speed: 0.15 + Math.random() * 0.35,
      drift: (Math.random() - 0.5) * 0.3,
      alpha: 0,
      alphaMax: 0.25 + Math.random() * 0.45,
      fadeSpeed: 0.004 + Math.random() * 0.006,
      phase: Math.random() * Math.PI * 2
    };
  }

  function initParticles() {
    if (!chamberParticleCanvas) return;
    resizeParticleCanvas();
    const w = chamberParticleCanvas.width;
    const h = chamberParticleCanvas.height;
    particles = Array.from({ length: 34 }, () => {
      const p = spawnParticle(w, h);
      p.y = Math.random() * h;
      p.alpha = Math.random() * p.alphaMax;
      return p;
    });
  }

  function drawParticles() {
    if (!particleCtx || !chamberParticleCanvas) return;
    const w = chamberParticleCanvas.width;
    const h = chamberParticleCanvas.height;
    particleCtx.clearRect(0, 0, w, h);

    particles.forEach(p => {
      p.y -= p.speed;
      p.phase += 0.015;
      p.x += Math.sin(p.phase) * p.drift;
      if (p.alpha < p.alphaMax) p.alpha += p.fadeSpeed;

      if (p.y < -20) Object.assign(p, spawnParticle(w, h));

      const glow = particleCtx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r * 4);
      glow.addColorStop(0, `rgba(255, 224, 158, ${p.alpha})`);
      glow.addColorStop(1, 'rgba(255, 224, 158, 0)');
      particleCtx.fillStyle = glow;
      particleCtx.beginPath();
      particleCtx.arc(p.x, p.y, p.r * 4, 0, Math.PI * 2);
      particleCtx.fill();
    });

    particleAnimId = requestAnimationFrame(drawParticles);
  }

  function startChamberParticles() {
    stopChamberParticles();
    if (!chamberParticleCanvas) return;
    initParticles();
    particleAnimId = requestAnimationFrame(drawParticles);
  }

  function stopChamberParticles() {
    if (particleAnimId) {
      cancelAnimationFrame(particleAnimId);
      particleAnimId = null;
    }
    if (particleCtx && chamberParticleCanvas) {
      particleCtx.clearRect(0, 0, chamberParticleCanvas.width, chamberParticleCanvas.height);
    }
  }

  window.addEventListener('resize', () => {
    if (stageChamber && stageChamber.classList.contains('active')) resizeParticleCanvas();
  });

  // ================= 7-2. 신령 1:1 상담 대화 (영상이 멈춘 뒤 한 단계씩 진행) =================
  const chamberConsult = document.getElementById('chamberConsult');
  const consultSay = document.getElementById('consultSay');
  const consultFields = document.getElementById('consultFields');
  const consultCta = document.getElementById('consultCta');
  let consultSteps = [];
  let consultStepIndex = 0;
  let consultAnswers = {};

  function renderConsultStep() {
    const step = consultSteps[consultStepIndex];
    if (!step) return;

    /*
     * 버튼에 지난번 걸어 둔 일을 지운다.
     *
     * 미리보기를 한 번 보고 나면 이 버튼에 「그 상품으로 가기」가 박힌다.
     * 그런데 그것을 지우지 않아서, 다른 신령에게 가서 첫 물음에 답만 해도
     * 지난번 상품 화면이 튀어나왔다 — 작명신령에게 이름을 묻는 도중에
     * 매력 삼합 페이지가 뜨는 식이다.
     *
     * 단계를 그릴 때마다 비운다. 다음 단계로 넘기는 일은 addEventListener
     * 쪽이 맡고 있으니, 여기서 비워도 흐름은 그대로 간다.
     */
    consultCta.onclick = null;
    consultCta.disabled = false;

    consultSay.textContent = `“${step.say}”`;
    consultFields.innerHTML = '';

    (step.fields || []).forEach(field => {
      if (field.type === 'select') {
        const row = document.createElement('div');
        row.className = 'consult-row';

        const select = document.createElement('select');
        const head = document.createElement('option');
        head.value = '';
        head.textContent = field.placeholder || '선택';
        select.appendChild(head);
        (field.options || []).forEach(opt => {
          const o = document.createElement('option');
          o.value = opt;
          o.textContent = opt;
          select.appendChild(o);
        });
        select.value = consultAnswers[field.id] || '';
        select.addEventListener('change', () => { consultAnswers[field.id] = select.value; });

        if (field.before) row.appendChild(document.createTextNode(field.before));
        row.appendChild(select);
        if (field.after) row.appendChild(document.createTextNode(field.after));
        consultFields.appendChild(row);
      }

      if (field.type === 'shorttext') {
        const row = document.createElement('div');
        row.className = 'consult-row';

        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'consult-inline-input';
        input.placeholder = field.placeholder || '';
        if (field.maxLength) input.maxLength = field.maxLength;
        input.value = consultAnswers[field.id] || '';
        input.addEventListener('input', () => { consultAnswers[field.id] = input.value; });

        if (field.before) row.appendChild(document.createTextNode(field.before));
        row.appendChild(input);
        if (field.after) row.appendChild(document.createTextNode(field.after));
        consultFields.appendChild(row);
      }

      if (field.type === 'date') {
        const row = document.createElement('div');
        row.className = 'consult-row';

        const input = document.createElement('input');
        input.type = 'date';
        input.className = 'consult-inline-input';
        input.value = consultAnswers[field.id] || '';
        input.addEventListener('change', () => { consultAnswers[field.id] = input.value; });

        if (field.before) row.appendChild(document.createTextNode(field.before));
        row.appendChild(input);
        if (field.after) row.appendChild(document.createTextNode(field.after));
        consultFields.appendChild(row);
      }

      if (field.type === 'daterange') {
        const row = document.createElement('div');
        row.className = 'consult-row';
        const saved = consultAnswers[field.id] || { from: '', to: '' };

        const from = document.createElement('input');
        from.type = 'date';
        from.className = 'consult-inline-input';
        from.value = saved.from;

        const to = document.createElement('input');
        to.type = 'date';
        to.className = 'consult-inline-input';
        to.value = saved.to;

        const save = () => { consultAnswers[field.id] = { from: from.value, to: to.value }; };
        from.addEventListener('change', save);
        to.addEventListener('change', save);

        if (field.before) row.appendChild(document.createTextNode(field.before));
        row.appendChild(from);
        row.appendChild(document.createTextNode('~'));
        row.appendChild(to);
        if (field.after) row.appendChild(document.createTextNode(field.after));
        consultFields.appendChild(row);
      }

      if (field.type === 'birthtime') {
        const row = document.createElement('div');
        row.className = 'consult-row';

        const select = document.createElement('select');
        BIRTH_TIME_OPTIONS.forEach(opt => {
          const o = document.createElement('option');
          o.value = opt;
          o.textContent = opt;
          select.appendChild(o);
        });
        select.value = consultAnswers[field.id] || BIRTH_TIME_OPTIONS[0];
        select.addEventListener('change', () => { consultAnswers[field.id] = select.value; });

        if (field.before) row.appendChild(document.createTextNode(field.before));
        row.appendChild(select);
        if (field.after) row.appendChild(document.createTextNode(field.after));
        consultFields.appendChild(row);
      }

      if (field.type === 'photo') {
        const box = document.createElement('label');
        box.className = 'consult-photo';

        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.hidden = true;

        const thumb = document.createElement('img');
        thumb.className = 'consult-photo-thumb';
        thumb.hidden = true;

        const label = document.createElement('span');
        label.className = 'consult-photo-label';
        label.textContent = `＋ ${field.label || '사진 올리기'}`;

        /*
         * 사진을 **실제로 잰다.**
         *
         * 터진 뒤에 적은 것 (2026-10-03): 여기서 사진 이름만 적어 두고 아무것도
         * 재지 않았다. 그래서 맛보기가 누가 어떤 사진을 올려도 똑같이 나왔다 —
         * 손님은 「내 사진을 안 봤네」 하고 나간다. 재는 자리는 만세력 화면 하나뿐이라
         * 거기 함수를 부른다. 사진은 이 기기 밖으로 나가지 않는다.
         */
        const msg = document.createElement('span');
        msg.className = 'consult-photo-msg';
        msg.setAttribute('role', 'status');

        const 잰다 = field.id === 'facePhoto' ? 'NB_얼굴잰다'
          : field.id === 'palmPhoto' ? 'NB_손잰다' : null;

        input.addEventListener('change', () => {
          const file = input.files && input.files[0];
          if (!file) return;
          consultAnswers[field.id] = file.name;
          thumb.src = URL.createObjectURL(file);
          thumb.hidden = false;
          label.textContent = '사진 바꾸기';
          box.classList.add('has-photo');

          if (!잰다 || typeof window[잰다] !== 'function') return;
          msg.classList.remove('bad');
          msg.textContent = field.id === 'facePhoto'
            ? '얼굴을 찾고 있습니다… 처음 한 번은 조금 걸립니다.'
            : '손을 찾고 있습니다… 처음 한 번은 조금 걸립니다.';
          window[잰다](file).then((잰값) => {
            msg.classList.remove('bad');
            msg.textContent = field.id === 'facePhoto'
              ? '얼굴을 다 재었습니다. 풀이에 그대로 씁니다.'
              : `손 모양을 다 재었습니다 — ${(잰값 && 잰값.handShape) || ''}. 풀이에 그대로 씁니다.`;
          }).catch((err) => {
            // 못 재어도 막지 않는다. 재지 못했다고만 밝힌다
            msg.classList.add('bad');
            const t = (err && err.message) || '';
            msg.textContent = (!t || /import|fetch|network|Failed|module/i.test(t))
              ? '지금은 사진을 재지 못했습니다. 그대로 두셔도 풀이는 나옵니다.'
              : t;
          });
        });

        box.appendChild(input);
        box.appendChild(thumb);
        box.appendChild(label);
        consultFields.appendChild(box);
        consultFields.appendChild(msg);
      }

      if (field.type === 'text') {
        const wrap = document.createElement('div');
        wrap.className = 'consult-textwrap';

        const area = document.createElement('textarea');
        area.placeholder = field.placeholder || '';
        area.maxLength = field.maxLength || 200;
        area.value = consultAnswers[field.id] || '';

        const counter = document.createElement('span');
        counter.className = 'consult-counter';
        const paint = () => { counter.textContent = `${area.value.length}/${area.maxLength}`; };
        paint();

        area.addEventListener('input', () => {
          consultAnswers[field.id] = area.value;
          paint();
        });

        wrap.appendChild(area);
        wrap.appendChild(counter);
        consultFields.appendChild(wrap);
      }
    });

    const isLast = consultStepIndex === consultSteps.length - 1;
    consultCta.textContent = isLast ? '결과 받아보기' : '다음으로';
  }

  function startConsult(spirit) {
    if (!chamberConsult || !spirit) return;
    consultSteps = CHAMBER_FLOWS[spirit.id] || [];
    consultStepIndex = 0;
    consultAnswers = {};
    if (!consultSteps.length) {
      chamberConsult.hidden = true;
      return;
    }
    chamberConsult.hidden = false;
    consultCta.onclick = null;   // 신령을 바꿔도 지난 신령의 상품이 따라오지 않게
    consultCta.disabled = false;
    renderConsultStep();
  }

  function hideConsult() {
    if (!chamberConsult) return;
    chamberConsult.hidden = true;
    consultSteps = [];
    consultStepIndex = 0;
    consultAnswers = {};
  }

  if (consultCta) {
    consultCta.addEventListener('click', async () => {
      const isLast = consultStepIndex === consultSteps.length - 1;
      if (!isLast) {
        consultStepIndex += 1;
        renderConsultStep();
        return;
      }

      // ── 지시사항 ② & ③ & ④: 가짜 값 배제, 진짜 미리보기(/api/preview) 호출 및 정식 경로(/products/<id>) 연결 ──
      consultCta.disabled = true;
      consultSay.textContent = '“명식을 비추어 리포트를 준비하고 있네…”';
      consultFields.innerHTML = '<div class="consult-row" style="text-align:center;padding:20px;color:#d4af37;">잠시만 기다려 주세요...</div>';

      // 1. 타겟 상품 결정 (질문 답변 또는 신령의 주력 상품)
      let targetProductId = currentSpirit && currentSpirit.productIds ? currentSpirit.productIds[0] : 'saju-report';
      if (currentSpirit && currentSpirit.id === 'dohwa') {
        const want = consultAnswers['want'];
        if (want === '내 매력이 뭔지') targetProductId = 'charm-report';
        else if (want === '인연이 언제 오는지') targetProductId = 'single-report';
        else if (want === '이 사람과 잘 될지') targetProductId = 'marriage-timing-report';
      }

      // 2. 손님 본인 생년월일 확인 (비어 있으면 가짜 값으로 호출하지 않고 입력 안내)
      const hasBirth = userState && userState.birthDate && userState.birthDate.trim();
      if (!hasBirth) {
        consultSay.textContent = '“생년월일을 넣으시면 리포트 미리보기를 바로 확인하실 수 있습니다.”';
        consultFields.innerHTML = `
          <div style="text-align:center;padding:16px 0;">
            <p style="color:#a0a0b2;font-size:14px;margin-bottom:14px;">정확한 사주 명식을 먼저 입력해 주세요.</p>
            <button type="button" id="btnGoSajuInput" class="btn-primary" style="padding:10px 20px;font-size:14px;border-radius:6px;background:#d4af37;color:#000;border:none;cursor:pointer;font-weight:700;">생년월일 입력하기</button>
          </div>
        `;
        const btnGoSaju = document.getElementById('btnGoSajuInput');
        if (btnGoSaju && sajuInputModal) {
          btnGoSaju.addEventListener('click', () => {
            sajuInputModal.classList.add('active');
          });
        }
        consultCta.textContent = '상세 안내 보기';
        consultCta.disabled = false;
        consultCta.onclick = () => {
          location.href = `/products/${encodeURIComponent(targetProductId)}`;
        };
        return;
      }

      // 3. 상품별 필수 조건 검사 (가짜 날짜로 자리를 채우지 않음)
      // 3-1. 택일 상품: 후보 날짜가 없으면 /api/preview 를 부르지 않고 안내 후 /pick 화면으로 이동
      if (targetProductId === 'pick-report') {
        consultSay.textContent = '“의사 선생님께 받은 날짜를 넣으시면 점수를 내어 드릴게.”';
        consultFields.innerHTML = '<div style="text-align:center;padding:16px;color:#a0a0b2;font-size:15px;line-height:1.85;">출산택일은 의사 선생님과 상의된 수술 가능 일시가 필요합니다.</div>';
        consultCta.textContent = '택일 화면으로 이동';
        consultCta.disabled = false;
        consultCta.onclick = () => {
          location.href = '/pick';
        };
        return;
      }

      // 3-2. 궁합 상품: 상대 생년월일이 없으면 /api/preview 를 부르지 않고 안내
      if (targetProductId === 'compat-report' || targetProductId === 'crush-compat-report') {
        const partnerDate = consultAnswers['partnerBirth'] && consultAnswers['partnerBirth'].trim();
        if (!partnerDate) {
          consultSay.textContent = '“상대 생년월일을 알려 주면 맞물려 볼게.”';
          consultFields.innerHTML = '<div style="text-align:center;padding:16px;color:#a0a0b2;font-size:15px;line-height:1.85;">상대방의 생년월일을 먼저 알려주세요.</div>';
          consultCta.textContent = '상세 안내 보기';
          consultCta.disabled = false;
          consultCta.onclick = () => {
            location.href = `/products/${encodeURIComponent(targetProductId)}`;
          };
          return;
        }
      }

      // 4. 진짜 미리보기 요청 (POST /api/preview)
      try {
        const mappedTime = TIME_MAP[userState.birthTime] || (userState.birthTime && userState.birthTime.includes(':') ? userState.birthTime : '12:00');
        const payload = {
          productId: targetProductId,
          birth: {
            date: userState.birthDate,
            time: mappedTime,
            place: userState.birthPlace || '서울',
            gender: userState.gender === 'female' ? '여' : '남',
            name: userState.name
          }
        };

        // 궁합 상대 정보 (검증을 통과한 실제 입력값만 전달)
        if (targetProductId === 'compat-report' || targetProductId === 'crush-compat-report') {
          payload.partner = {
            date: consultAnswers['partnerBirth'].trim(),
            time: TIME_MAP[consultAnswers['partnerTime']] || '12:00'
          };
        }
        // 작명 성씨 (입력된 성씨가 있을 때만 전달)
        if (targetProductId === 'naming-report' || targetProductId === 'naming-plus-report') {
          const surname = (consultAnswers['surname'] || (userState.name ? userState.name.charAt(0) : '')).trim();
          if (surname) {
            payload.name = { surname };
          }
        }

        const res = await fetch('/api/preview', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        if (!res.ok) {
          throw new Error('미리보기 생성 실패: ' + res.status);
        }

        const data = await res.json();
        const pInfo = data.product || CATALOG_PRODUCTS[targetProductId] || null;
        if (!pInfo) {
          consultSay.textContent = '잠시 뒤에 다시 눌러 주시겠니.';
          consultFields.innerHTML = '';
          consultCta.textContent = '상세 보기';
          consultCta.disabled = false;
          consultCta.onclick = () => {
            location.href = `/products/${encodeURIComponent(targetProductId)}`;
          };
          return;
        }

        // 신령 대사: 서버에서 계산된 실제 손님 사주 기반 점사
        const fp = data.preview.fortunePoints || [];
        const userName = userState.name ? userState.name + ' 님' : '그대';
        const sayLine = fp.length > 0
          ? `“${userName}의 명식을 살펴보니, ${fp[0].title}의 결이 뚜렷하게 서 있네.”`
          : (data.preview.text ? `“${data.preview.text}”` : '그대의 명식이 품은 길을 정성껏 짚어 두었네.');
        consultSay.textContent = sayLine;

        // 맛보기 점사 HTML
        const fortuneHtml = fp.length > 0 ? `
          <div style="background:rgba(26,20,38,0.9);border:1px solid rgba(212,175,55,0.45);border-radius:8px;padding:14px;margin-bottom:12px;">
            <div style="font-size:14px;font-weight:700;color:#f3e5ab;display:flex;align-items:center;gap:6px;margin-bottom:10px;">
              <span>🔮</span> <span>${userName}의 명식으로 짚은 맛보기 점사</span>
            </div>
            <div style="display:flex;flex-direction:column;gap:12px;">
              ${fp.map((p, idx) => `
                <div style="border-bottom: ${idx < fp.length - 1 ? '1px solid rgba(255,255,255,0.08)' : 'none'}; padding-bottom: ${idx < fp.length - 1 ? '10px' : '0'};">
                  <div style="font-size:15.5px;font-weight:700;color:#ffd700;line-height:1.45;margin-bottom:4px;">
                    ${p.title}
                  </div>
                  <div style="font-size:13px;color:#cbd5e1;background:rgba(255,255,255,0.07);padding:3px 8px;border-radius:4px;display:inline-block;margin-bottom:6px;">
                    <b>${p.term}</b> — ${p.termDesc}
                  </div>
                  <div style="font-size:14px;color:#e2e8f0;line-height:1.7;margin-bottom:4px;word-break:keep-all;">
                    ${p.text}
                  </div>
                  <div style="font-size:12.5px;color:#94a3b8;">
                    근거: ${p.basis}
                  </div>
                </div>
              `).join('')}
            </div>
            <div style="font-size:13px;color:#a0aec0;margin-top:10px;padding-top:8px;border-top:1px dashed rgba(212,175,55,0.25);line-height:1.5;">
              ※ 10년 대운과 달마다의 상세 흐름, 구체적 현실 처방은 본 리포트에서 펼쳐집니다.
            </div>
          </div>
        ` : '';

        // 화면 구성: 단일 정가(부가세 포함), 맛보기 점사, 미리보기 내용 목록, 청약철회 고지
        consultFields.innerHTML = `
          <div style="background:rgba(18,18,28,0.95);border:1px solid rgba(212,175,55,0.35);border-radius:8px;padding:14px;margin-top:8px;text-align:left;">
            <div style="font-size:15px;font-weight:700;color:#f3e5ab;margin-bottom:4px;">${pInfo.name}</div>
            <div style="font-size:14px;color:#d4af37;font-weight:700;margin-bottom:12px;">
              ${Number(pInfo.priceKrw).toLocaleString()}원 (부가세 포함)
              ${(window.__IS_LAUNCH_SALE__ && pInfo.regularKrw && pInfo.regularKrw !== pInfo.priceKrw)
                ? `<span class="pr-badge-launch" style="display:inline-block;padding:2px 6px;margin-left:6px;font-size:11px;font-weight:700;color:#12121c;background:#d4af37;border-radius:4px;vertical-align:middle;">서버 오픈 기념가</span>
                   <div class="pr-regular-note" style="font-size:12px;color:rgba(243,229,171,0.7);margin-top:4px;font-weight:400;">11월 1일부터 ${Number(pInfo.regularKrw).toLocaleString()}원</div>`
                : ''}
            </div>
            ${fortuneHtml}
            <div style="font-size:14px;color:#ddd;margin-bottom:10px;line-height:1.85;">
              <strong style="color:#fff;display:block;margin-bottom:4px;">📜 리포트에 담기는 내용:</strong>
              <ul style="margin:0;padding-left:18px;">
                ${(data.preview.contents || []).map(c => `<li style="margin-bottom:3px;">${c}</li>`).join('')}
              </ul>
            </div>
            <div style="font-size:14px;color:#bebecc;border-top:1px solid rgba(255,255,255,0.08);padding-top:8px;line-height:1.6;">
              ${data.notice}
            </div>
          </div>
        `;

        consultCta.textContent = `${pInfo.name} 신청하기 (${Number(pInfo.priceKrw).toLocaleString()}원)`;
        consultCta.disabled = false;
        consultCta.onclick = () => {
          // 신령에게 적어 준 것을 그대로 들고 간다. 결제 자리에서 같은 것을 두 번 묻지 않는다
          rememberReading(targetProductId, payload);
          location.href = `/checkout?product=${encodeURIComponent(targetProductId)}`;
        };

      } catch (err) {
        console.log('[Preview Error]', err);
        const pInfo = CATALOG_PRODUCTS[targetProductId] || null;
        if (!pInfo) {
          consultSay.textContent = '잠시 뒤에 다시 눌러 주시겠니.';
          consultFields.innerHTML = '';
          consultCta.textContent = '상세 보기';
          consultCta.disabled = false;
          consultCta.onclick = () => {
            location.href = `/products/${encodeURIComponent(targetProductId)}`;
          };
          return;
        }

        consultSay.textContent = `“${pInfo.name}의 상세 풀이가 준비되어 있네.”`;
        consultFields.innerHTML = `
          <div style="text-align:center;padding:14px 0;">
            <div style="font-size:15px;color:#f3e5ab;font-weight:700;margin-bottom:6px;">${pInfo.name}</div>
            <div style="font-size:14px;color:#d4af37;font-weight:700;margin-bottom:10px;">
              ${Number(pInfo.priceKrw).toLocaleString()}원 (부가세 포함)
              ${(window.__IS_LAUNCH_SALE__ && pInfo.regularKrw && pInfo.regularKrw !== pInfo.priceKrw)
                ? `<span class="pr-badge-launch" style="display:inline-block;padding:2px 6px;margin-left:6px;font-size:11px;font-weight:700;color:#12121c;background:#d4af37;border-radius:4px;vertical-align:middle;">서버 오픈 기념가</span>
                   <div class="pr-regular-note" style="font-size:12px;color:rgba(243,229,171,0.7);margin-top:4px;font-weight:400;">11월 1일부터 ${Number(pInfo.regularKrw).toLocaleString()}원</div>`
                : ''}
            </div>
          </div>
        `;
        consultCta.textContent = `${pInfo.name} 상세 확인`;
        consultCta.disabled = false;
        consultCta.onclick = () => {
          location.href = `/products/${encodeURIComponent(targetProductId)}`;
        };
      }
    });
  }

  if (chamberSpiritVideo) {
    chamberSpiritVideo.addEventListener('ended', () => {
      chamberSpiritVideo.pause();
      const freezeAt = currentSpirit && currentSpirit.freezeAt;
      if (freezeAt) {
        chamberSpiritVideo.currentTime = freezeAt;
      }
      startChamberParticles();
      startConsult(currentSpirit);
    });
  }

  function openChamber(spirit) {
    if (!spirit) return;
    try {
      if (!history.state || history.state.stage !== 'chamber') {
        history.pushState({ stage: 'chamber', spirit: spirit.name }, '');
      }
    } catch (err) {}
    currentSpirit = spirit;
    currentProduct = spirit.productIds ? spirit.productIds[0] : null;

    // 새 신령 처소를 열 때는 이전 파티클·상담 대화를 즉시 정리 (새 8초 영상이 끝난 뒤에만 다시 시작)
    stopChamberParticles();
    hideConsult();

    // 1) 정지 포스터 사진 없이, 아래 2)에서 영상이 검은 화면 위로 바로 페이드인
    if (chamberSpiritName) chamberSpiritName.textContent = spirit.name;
    if (chamberSpiritDomain) chamberSpiritDomain.textContent = spirit.domain;

    // 2) 1080p 대면 영상 로드 후, 포스터 위로 서서히 페이드인
    if (chamberSpiritVideo) {
      chamberSpiritVideo.classList.remove('is-ready');
      chamberSpiritVideo.removeEventListener('playing', chamberSpiritVideo._onReady || (() => { }));

      if (spirit.video) {
        const onReady = () => {
          chamberSpiritVideo.classList.add('is-ready');
          chamberSpiritVideo.removeEventListener('playing', onReady);
        };
        chamberSpiritVideo._onReady = onReady;

        chamberSpiritVideo.src = spirit.video;
        chamberSpiritVideo.load();
        chamberSpiritVideo.addEventListener('playing', onReady);
        chamberSpiritVideo.play().catch((err) => console.log("Chamber video play:", err));
      } else {
        chamberSpiritVideo.removeAttribute('src');
        chamberSpiritVideo.load();
      }
    }

    // 3) 처소 스테이지 활성화 (메뉴판 비활성화)
    if (stageSpirits) stageSpirits.classList.remove('active');
    if (stageCourtyard) stageCourtyard.classList.remove('active');
    if (stageChamber) stageChamber.classList.add('active');
  }

  function closeChamber() {
    if (stageChamber) stageChamber.classList.remove('active');
    if (stageSpirits) stageSpirits.classList.add('active');
    if (chamberSpiritVideo) chamberSpiritVideo.pause();
    stopChamberParticles();
    hideConsult();
  }

  // 신령 메뉴판으로 복귀
  if (btnExitChamber) {
    btnExitChamber.addEventListener('click', () => {
      if (history.state && history.state.stage === 'chamber') {
        history.back();
      } else {
        closeChamber();
      }
    });
  }

  // ── 뒤로가기 제어 (8단계) ─────────────────────────────────────────
  window.addEventListener('popstate', (e) => {
    const state = e.state || {};
    const stage = state.stage;

    // 1) 만세력 뷰어가 열려 있고 새 상태가 viewer가 아니면 뷰어 닫기
    const leg = document.getElementById('manseStage');
    if (leg && leg.style.display !== 'none' && !leg.hasAttribute('hidden') && stage !== 'viewer') {
      if (typeof window.closeFreeSaju === 'function') {
        window.closeFreeSaju();
      } else {
        leg.setAttribute('hidden', '');
        leg.style.display = 'none';
      }
    }

    // 2) 신령 처소(상담)가 열려 있고 새 상태가 chamber가 아니면 처소 닫기
    if (stageChamber && stageChamber.classList.contains('active') && stage !== 'chamber') {
      closeChamber();
    }

    // 3) 맛보기(사주 선택) 패널이 열려 있고 새 상태가 select/taste가 아니면 닫기
    const openPanel = document.querySelector('.taste-panel');
    if (openPanel && stage !== 'select' && stage !== 'taste') {
      openPanel.remove();
    }

    // 4) 새 상태에 따른 화면 복원
    if (stage === 'viewer') {
      if (typeof window.openFreeSaju === 'function') {
        window.openFreeSaju();
      }
    } else if (stage === 'chamber' && state.spirit) {
      const s = SPIRITS_DATA.find((sp) => sp.name === state.spirit);
      if (s) openChamber(s);
    }
  });
});
