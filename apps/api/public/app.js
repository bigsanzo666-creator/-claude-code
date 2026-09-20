// ==========================================================================
// 늘봄사주 10대 신령 성지: 비디오 정지 제어 & 16:9 와이드 파노라마 드래그 로직
// ==========================================================================

const SPIRITS_DATA = [
  {
    id: "dohwa",
    name: "도화신령",
    domain: "연애 · 매력 · 이성운",
    group: "entrance",
    groupName: "1그룹: 입구 3대장",
    img: "assets/신령들/도화신령.jpeg",
    video: "assets/대면상담/도화신령대면상담.mp4",
    opener: "누구한테 마음이 가는지, 내가 연못 위 연꽃잎으로 짚어 줄게.",
    productIds: ["charm-report", "single-report", "marriage-timing-report"]
  },
  {
    id: "wol",
    name: "월신령",
    domain: "재회 · 이별 치유 · 그리움",
    group: "entrance",
    groupName: "1그룹: 입구 3대장",
    img: "assets/신령들/월신령.jpeg",
    video: "assets/대면상담/월신령대면상담.mp4",
    opener: "떠나간 사람 때문에 밤잠 설치고 있지? 그 마음 이리 내봐.",
    productIds: ["reunion-report", "letgo-report"]
  },
  {
    id: "yeon",
    name: "실신령",
    domain: "궁합 · 인연의 끈 · 결혼",
    group: "entrance",
    groupName: "1그룹: 입구 3대장",
    img: "assets/신령들/연신령.jpeg",
    video: "assets/대면상담/실신령대면상담.mp4",
    opener: "너와 그 사람 사이에 붉은 실이 닿아 있는지 짚어 줄게.",
    productIds: ["compat-report", "crush-compat-report"]
  },
  {
    id: "samhap",
    name: "삼합신령",
    domain: "사주 × 관상 × 손금 삼합 종합",
    group: "courtyard",
    groupName: "2그룹: 마당 중앙 영험 4대장",
    img: "assets/신령들/삼합신령.jpeg",
    video: "assets/대면상담/삼합신령대면상담.mp4",
    opener: "사주와 얼굴, 손금을 셋 다 겹쳐봐야 진짜 네 운명의 축이 보여.",
    productIds: ["cross-report", "face-palm-report"]
  },
  {
    id: "jakmyeong",
    name: "작명신령",
    domain: "작명 · 개명 · 호(號)",
    group: "courtyard",
    groupName: "2그룹: 마당 중앙 영험 4대장",
    img: "assets/신령들/작명신령.jpeg",
    video: "assets/대면상담/작명신령대면상담.mp4",
    opener: "평생 불릴 이름이다. 사주의 빈 곳을 채우는 귀한 글자를 지어주마.",
    productIds: ["naming-plus-report", "naming-report"]
  },
  {
    id: "samsin",
    name: "삼신할매",
    domain: "출산택일 · 자녀운 · 생명",
    group: "courtyard",
    groupName: "2그룹: 마당 중앙 영험 4대장",
    freezeAt: 7.0,
    img: "assets/신령들/삼신할매.jpeg",
    video: "assets/대면상담/삼신할매대면상담.mp4",
    opener: "아가야 어서 오너라. 복되고 귀한 때를 골라 점지해 주마.",
    productIds: ["pick-report", "child-report"]
  },
  {
    id: "myeonggyeong",
    name: "명경신령",
    domain: "사주 원판 정밀 판독 · 오행 결핍",
    group: "courtyard",
    groupName: "2그룹: 마당 중앙 영험 4대장",
    freezeAt: 7.0,
    img: "assets/신령들/명경신령.jpeg",
    video: "assets/대면상담/명경신령대면상담.mp4",
    opener: "거울은 속이지 않는다. 타고난 네 사주 원판의 뼈대를 비춰 주마.",
    productIds: ["saju-report"]
  },
  {
    id: "jae",
    name: "재신령",
    domain: "재물창고 · 금전운 · 누수 차단",
    group: "sanctum",
    groupName: "3그룹: 안쪽 깊은 처소 3대장",
    img: "assets/신령들/재신령.jpeg",
    video: "assets/대면상담/재신령대면상담.mp4",
    opener: "돈이 새는 곳간을 막아야 금전이 차오른다. 네 돈줄을 점검해 줄게.",
    productIds: ["wealth-report"]
  },
  {
    id: "san",
    name: "산신령",
    domain: "자녀 진로 · 학업 · 성공운",
    group: "sanctum",
    groupName: "3그룹: 안쪽 깊은 처소 3대장",
    img: "assets/신령들/산신령.jpeg",
    video: "assets/대면상담/산신령대면상담.mp4",
    opener: "아이가 벼슬길에 오를지 큰 재목이 될지 그 바탕을 내가 짚어주마.",
    productIds: ["child-aptitude-report", "exam-report"]
  },
  {
    id: "pung",
    name: "풍신령",
    domain: "신년운세 · 연간 흐름 · 액땜",
    group: "sanctum",
    groupName: "3그룹: 안쪽 깊은 처소 3대장",
    freezeAt: 6.8,
    img: "assets/신령들/풍신령.jpeg",
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

let userState = { name: "", birthDate: "", birthTime: "" };
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
  const stageCourtyard = document.getElementById('stageCourtyard');
  const btnKnockGate = document.getElementById('btnKnockGate');
  const userInfoDisplay = document.getElementById('userInfoDisplay');

  const sajuInputModal = document.getElementById('sajuInputModal');
  const inputName = document.getElementById('inputName');
  const inputBirth = document.getElementById('inputBirth');
  const inputTime = document.getElementById('inputTime');
  const btnSubmitSaju = document.getElementById('btnSubmitSaju');
  const genderButtons = document.querySelectorAll('.gender-btn');
  let selectedGender = 'male';

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
    gateVideo.addEventListener('ended', () => {
      gateVideo.pause();
    });
  }

  // ================= 2. 신령계 문 두드리기 ➡️ 사주 신상 정보 입력 모달(Checkpoint) 오픈 =================
  btnKnockGate.addEventListener('click', () => {
    if (sajuInputModal) sajuInputModal.classList.add('active');
  });

  // 성별 선택 토글
  genderButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      genderButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      selectedGender = btn.getAttribute('data-gender');
    });
  });

  // ================= 3. 입장 연출 영상 1회 재생 후 마당 파노라마 고정! =================
  function enterSpiritWorld() {
    setSound(true);

    // 1) 앞선 문 영상 정지
    if (gateVideo) gateVideo.pause();

    // 2) 문 -> 입장 연출 스테이지 전환
    stageGate.classList.remove('active');
    stageEnter.classList.add('active');

    if (enterVideo) {
      enterVideo.currentTime = 0;
      enterVideo.muted = !isAudioActive;
      if (isAudioActive) enterVideo.volume = 1.0;

      enterVideo.play().catch((err) => console.log("Video play:", err));

      // 비디오가 끝나면(ended) 다시 재생되지 않고, 즉시 16:9 와이드 파노라마 마당으로 전환!
      const onEnterEnd = () => {
        enterVideo.removeEventListener('ended', onEnterEnd);
        stageEnter.classList.remove('active');
        enterCourtyardPanorama();
      };

      enterVideo.addEventListener('ended', onEnterEnd);

      // 영상이 너무 길거나 에러 날 때를 대비한 안전 타임아웃
      setTimeout(() => {
        if (stageEnter.classList.contains('active')) {
          onEnterEnd();
        }
      }, 5500);
    } else {
      stageEnter.classList.remove('active');
      enterCourtyardPanorama();
    }
  }

  // ================= 4. 사주 정보 제출 ➡️ 명식 봉인 해제 후 입장 =================
  if (btnSubmitSaju) {
    btnSubmitSaju.addEventListener('click', () => {
      userState.name = (inputName && inputName.value.trim()) || "";
      userState.birthDate = inputBirth ? inputBirth.value : userState.birthDate;
      userState.birthTime = inputTime ? inputTime.value : userState.birthTime;
      userState.gender = selectedGender;

      if (userInfoDisplay) {
        userInfoDisplay.innerHTML = userState.name
          ? `<span class="user-icon">🏮</span><span class="user-name-text"><strong>${userState.name}</strong> 님의 명식 봉인 해제</span>`
          : `<span class="user-icon">🏮</span><span class="user-name-text">명식 봉인 해제</span>`;
      }

      if (sajuInputModal) sajuInputModal.classList.remove('active');

      enterSpiritWorld();
    });
  }

  // ================= 5. 16:9 와이드 파노라마 마당 진입 =================
  function enterCourtyardPanorama() {
    stageCourtyard.classList.add('active');

    // 파노라마 뷰포트를 정중앙(본당, 보름달, 월신령)으로 자동 스크롤
    requestAnimationFrame(() => {
      if (panoramaViewport) {
        const scrollMax = panoramaViewport.scrollWidth - panoramaViewport.clientWidth;
        panoramaViewport.scrollLeft = scrollMax * 0.52; // 중앙 본당/달 중심으로 포커스
      }
    });

    // 마우스 드래그 지원 (PC 브라우저에서도 모바일처럼 드래그 가능)
    setupPanoramaDrag();
  }

  // ================= 6. 파노라마 터치 및 마우스 드래그 상호작용 =================
  function setupPanoramaDrag() {
    let isDown = false;
    let startX = 0;
    let scrollLeft = 0;

    panoramaViewport.addEventListener('mousedown', (e) => {
      isDown = true;
      startX = e.pageX - panoramaViewport.offsetLeft;
      scrollLeft = panoramaViewport.scrollLeft;
    });

    window.addEventListener('mouseup', () => {
      isDown = false;
    });

    panoramaViewport.addEventListener('mousemove', (e) => {
      if (!isDown) return;
      e.preventDefault();
      const x = e.pageX - panoramaViewport.offsetLeft;
      const walk = (x - startX) * 1.5; // 드래그 감도
      panoramaViewport.scrollLeft = scrollLeft - walk;
    });

    // 핫스팟 클릭 연결
    document.querySelectorAll('.spirit-hotspot').forEach(spot => {
      spot.addEventListener('click', (e) => {
        e.stopPropagation();
        const spiritId = spot.getAttribute('data-spirit');
        const found = SPIRITS_DATA.find(s => s.id === spiritId);
        if (found) openChamber(found);
      });
    });
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
            sajuInputModal.classList.add('show');
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
        consultFields.innerHTML = '<div style="text-align:center;padding:16px;color:#a0a0b2;font-size:13.5px;line-height:1.6;">출산택일은 의사 선생님과 상의된 수술 가능 일시가 필요합니다.</div>';
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
          consultFields.innerHTML = '<div style="text-align:center;padding:16px;color:#a0a0b2;font-size:13.5px;line-height:1.6;">상대방의 생년월일을 먼저 알려주세요.</div>';
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

        // 신령 대사: 서버에서 계산된 실제 preview.text
        consultSay.textContent = `“${data.preview.text}”`;

        // 화면 구성: 단일 정가(부가세 포함), 미리보기 내용 목록, 청약철회 고지
        consultFields.innerHTML = `
          <div style="background:rgba(18,18,28,0.95);border:1px solid rgba(212,175,55,0.35);border-radius:8px;padding:14px;margin-top:8px;text-align:left;">
            <div style="font-size:15px;font-weight:700;color:#f3e5ab;margin-bottom:4px;">${pInfo.name}</div>
            <div style="font-size:14px;color:#d4af37;font-weight:700;margin-bottom:12px;">${Number(pInfo.priceKrw).toLocaleString()}원 (부가세 포함)</div>
            <div style="font-size:12.5px;color:#ddd;margin-bottom:10px;line-height:1.6;">
              <strong style="color:#fff;display:block;margin-bottom:4px;">📜 리포트에 담기는 내용:</strong>
              <ul style="margin:0;padding-left:18px;">
                ${(data.preview.contents || []).map(c => `<li style="margin-bottom:3px;">${c}</li>`).join('')}
              </ul>
            </div>
            <div style="font-size:11px;color:#888;border-top:1px solid rgba(255,255,255,0.08);padding-top:8px;line-height:1.5;">
              ${data.notice}
            </div>
          </div>
        `;

        consultCta.textContent = `${pInfo.name} 신청하기 (${Number(pInfo.priceKrw).toLocaleString()}원)`;
        consultCta.disabled = false;
        consultCta.onclick = () => {
          location.href = `/products/${encodeURIComponent(targetProductId)}`;
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

    // 3) 9:16 모바일 마당 전환 (깜빡임 없이 즉시 활성화)
    if (stageCourtyard) stageCourtyard.classList.remove('active');
    if (stageChamber) stageChamber.classList.add('active');
  }

  // 마당으로 복귀
  if (btnExitChamber) {
    btnExitChamber.addEventListener('click', () => {
      if (stageChamber) stageChamber.classList.remove('active');
      if (stageCourtyard) stageCourtyard.classList.add('active');
      if (chamberSpiritVideo) chamberSpiritVideo.pause();
      stopChamberParticles();
      hideConsult();
    });
  }
});
