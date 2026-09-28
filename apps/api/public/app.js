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

const TIME_MAP = {
  'ja': '00:30', 'chuk': '02:30', 'in': '04:30', 'myo': '06:30',
  'jin': '08:30', 'sa': '10:30', 'o': '12:30', 'mi': '14:30',
  'sin': '16:30', 'yu': '18:30', 'sul': '20:30', 'hae': '22:30',
  'unknown': '12:00'
};

let userState = { name: "", birthDate: "", birthTime: "", birthPlace: "서울" };
let currentSpirit = null;
let currentProduct = null;
let isAudioActive = false;

document.addEventListener('DOMContentLoaded', () => {
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
  const inputPlace = document.getElementById('inputPlace');
  const btnSubmitSaju = document.getElementById('btnSubmitSaju');
  const genderButtons = document.querySelectorAll('.gender-btn');
  let selectedGender = 'male';

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
      if (b.time && inputTime) {
        for (const [k, v] of Object.entries(TIME_MAP)) {
          if (v === b.time || k === b.time) {
            inputTime.value = k;
            break;
          }
        }
      }
      userState.name = (inputName && inputName.value.trim()) || (b.name || "");
      userState.birthDate = inputBirth ? inputBirth.value : (b.date || b.birthDate || "");
      userState.birthTime = inputTime ? inputTime.value : (b.time || "");
      userState.birthPlace = (inputPlace && inputPlace.value) || (b.place || "서울");
      userState.gender = selectedGender;
      if (userInfoDisplay && userState.name) {
        userInfoDisplay.innerHTML = `<span class="user-icon">🏮</span><span class="user-name-text"><strong>${userState.name}</strong> 님의 명식 봉인 해제</span>`;
      }
    }
  } catch (e) {}

  const panoramaViewport = document.getElementById('panoramaViewport');

  // ================= 🔊 사운드 컨트롤 =================
  function setSound(enable) {
    isAudioActive = enable;
    if (enable) {
      if (stageGate.classList.contains('active') && gateVideo) {
        gateVideo.muted = false;
        gateVideo.volume = 1.0;
        gateVideo.play().catch(() => { });
      }
      if (enterVideo) {
        enterVideo.muted = false;
        enterVideo.volume = 1.0;
      }
      soundControl.classList.add('active');
      soundIcon.textContent = '🔊';
      soundText.textContent = '신령음 ON';
    } else {
      if (gateVideo) gateVideo.muted = true;
      if (enterVideo) enterVideo.muted = true;
      soundControl.classList.remove('active');
      soundIcon.textContent = '🔇';
      soundText.textContent = '신령음 OFF';
    }
  }

  soundControl.addEventListener('click', (e) => {
    e.stopPropagation();
    setSound(!isAudioActive);
  });

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
      userState.birthTime = inputTime ? inputTime.value : userState.birthTime;
      userState.birthPlace = (inputPlace && inputPlace.value) || "서울";
      userState.gender = selectedGender;

      const mappedTime = TIME_MAP[userState.birthTime] || userState.birthTime || '12:00';
      const mappedGender = (userState.gender === 'female' || userState.gender === '여') ? '여' : '남';

      saveReading({
        birth: {
          name: userState.name,
          date: userState.birthDate,
          time: mappedTime,
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

  // 트랙에 클릭 이벤트 위임 (카드 클릭 시 상세페이지 이동)
  if (productCarouselTrack && !productCarouselTrack._hasClickBound) {
    productCarouselTrack._hasClickBound = true;
    productCarouselTrack.addEventListener('click', (e) => {
      const card = e.target.closest('.product-card');
      if (!card) return;
      const productId = card.getAttribute('data-product-id');
      if (productId) {
        location.href = '/products/' + encodeURIComponent(productId);
      }
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
              + (i === 0 ? ' fetchpriority="high">' : ' loading="lazy">'),
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

    // 최초 진입 시 전체 탭 렌더링
    renderCategory('전체');
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

        input.addEventListener('change', () => {
          const file = input.files && input.files[0];
          if (!file) return;
          consultAnswers[field.id] = file.name;
          thumb.src = URL.createObjectURL(file);
          thumb.hidden = false;
          label.textContent = '사진 바꾸기';
          box.classList.add('has-photo');
        });

        box.appendChild(input);
        box.appendChild(thumb);
        box.appendChild(label);
        consultFields.appendChild(box);
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
            <div style="font-size:14px;color:#d4af37;font-weight:700;margin-bottom:12px;">${Number(pInfo.priceKrw).toLocaleString()}원 (부가세 포함)</div>
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
            <div style="font-size:14px;color:#d4af37;font-weight:700;margin-bottom:10px;">${Number(pInfo.priceKrw).toLocaleString()}원 (부가세 포함)</div>
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

  // 신령 메뉴판으로 복귀
  if (btnExitChamber) {
    btnExitChamber.addEventListener('click', () => {
      if (stageChamber) stageChamber.classList.remove('active');
      if (stageSpirits) stageSpirits.classList.add('active');
      if (chamberSpiritVideo) chamberSpiritVideo.pause();
      stopChamberParticles();
      hideConsult();
    });
  }
});
