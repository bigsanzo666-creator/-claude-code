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
    products: [
      {
        id: "1-1",
        title: "매력 삼합 (사주 × 관상 × 손금)",
        hook: "남들은 네 어디에 홀릴까. 얼굴이냐, 손이냐, 아니면 네가 모르는 그 한 점이야?",
        packaging: "네 얼굴과 손금만 보고, 네가 숨긴 매력의 발원지를 내가 먼저 짚어줄게.",
        priceOriginal: 89000,
        priceSale: 35600,
        priceCross: 25000,
        stages: [
          { num: "1단계", title: "남들이 너한테 먼저 다가오는 진짜 이유", preview: "사주 일지에 숨겨진 도화살의 파동이 강하여, 가만히 있어도 타인이 시선을 떼지 못하는 강한 자석의 기운을 타고났습니다." },
          { num: "2단계", title: "네가 스스로도 모르는 매력의 색깔", locked: "눈꼬리와 입술 선에서 뿜어져 나오는 붉은 도화의 기운으로, 상대방의 이성을 마비시키고 감성을 자극하는 치명적 흡인력 분석." },
          { num: "3단계", title: "그 매력이 켜지는 사람과 꺼지는 사람", locked: "네 도화의 불꽃에 불나방처럼 뛰어들 궁합의 띠와, 반대로 네 매력을 시기하여 깎아내릴 위험한 인연의 감별법." },
          { num: "4단계", title: "지금부터 그 불을 어디에 둬야 하는지", locked: "도화 기운을 흘리지 않고 네가 원하는 단 한 사람을 완전히 사로잡는 구체적인 행동 및 시선 처리 비기." }
        ]
      },
      {
        id: "1-2",
        title: "솔로 탈출 비기",
        hook: "이번에도 '인연이 없나 봐'로 넘길 거야? 들어오는 달과 장소를 네가 몰라서 그런 거 아니야?",
        packaging: "인연이 네 앞에 서는 정확한 달과, 네가 있어야 할 자리를 찍어줄게.",
        priceOriginal: 59000,
        priceSale: 23600,
        priceCross: 18000,
        stages: [
          { num: "1단계", title: "지금까지 솔로가 길어졌던 사주 속 진짜 원인", preview: "인연이 없던 것이 아니라, 본인의 관성(官星) 기운을 가로막고 있던 식상의 과다로 인해 다가오던 인연을 스스로 밀어냈던 형국." },
          { num: "2단계", title: "새로운 인연의 파동이 가장 강하게 들어오는 3개월", locked: "올해 하반기 중 천을귀인이 들어와 심장을 뛰게 만들 결정적 3개 월수와 주의해야 할 날짜." },
          { num: "3단계", title: "그 사람이 나타날 구체적인 장소와 상황 묘사", locked: "동북 방향의 물가나 배움의 공간에서 마주치게 될 상대방의 직업군과 첫 만남의 분위기." },
          { num: "4단계", title: "첫 만남에서 놓치지 않고 낚아채는 매력 발산법", locked: "상대방의 사주 기운을 단숨에 녹여 먼저 고백하게 만드는 맞춤형 대화법." }
        ]
      },
      {
        id: "1-3",
        title: "결혼 시기 확정",
        hook: "서른 전에 갈까, 서른다섯 넘겨야 풀릴까? 네 사주에서 식장 문 열리는 해는 이미 정해져 있는데.",
        packaging: "일찍 가면 깨지는지, 늦게 갈수록 대박 나는지 네 혼인 도장을 확인해 준다.",
        priceOriginal: 79000,
        priceSale: 31600,
        priceCross: 24000,
        stages: [
          { num: "1단계", title: "사주 명식에 찍힌 천생 배필과의 혼인 적기", preview: "대운의 흐름상 일지와 합을 이루는 정관 대운이 도래하여 결혼의 기운이 무르익는 시점입니다." },
          { num: "2단계", title: "일찍 결혼했을 때 겪게 되는 위험과 액땜법", locked: "사주 내 원진살이나 삼형살이 작동하여 초혼에 풍파를 겪지 않도록 피해 가는 지혜." },
          { num: "3단계", title: "가장 축복받으며 재물운이 함께 터지는 골든 타임", locked: "두 사람의 재백궁이 결합하여 부를 일구어낼 최상의 결혼 연도와 계절." },
          { num: "4단계", title: "평생 해로하기 위해 지켜야 할 배우자와의 서약", locked: "가정의 주도권을 어떻게 분배해야 평생 다툼 없이 화목할 수 있는지에 대한 신령의 가르침." }
        ]
      }
    ]
  },
  {
    id: "wol",
    name: "월신령",
    domain: "재회 · 이별 치유",
    group: "entrance",
    groupName: "1그룹: 입구 3대장",
    img: "assets/신령들/월신령.jpeg",
    video: "assets/대면상담/월신령대면상담.mp4",
    opener: "떠난 사람은 물에 비친 달 같아. 그래도 하늘에 달은 남아 있지.",
    products: [
      {
        id: "2-1",
        title: "재회 가능성 측정",
        hook: "프로필 사진은 왜 자꾸 바꿔? 그 사람, 진짜 너 잊었을까? 아니면 밤마다 네 생각에 뒤척일까?",
        packaging: "그 사람이 지금 후회하는지, 먼저 연락 올 날이 있는지 달빛 아래서 짚어줄게.",
        priceOriginal: 79000,
        priceSale: 31600,
        priceCross: 24000,
        stages: [
          { num: "1단계", title: "그 사람이 지금 느끼는 감정의 진짜 실체", preview: "겉으로는 태연한 척 일상을 살아가지만, 밤이 되면 일지의 합으로 인해 당신의 빈자리를 실감하고 있는 상태입니다." },
          { num: "2단계", title: "먼저 연락이 올 확률(%)과 가장 유력한 날짜", locked: "상대방의 마음이 가장 약해지고 자존심을 꺾게 되는 구체적인 날짜와 연락 확률." },
          { num: "3단계", title: "지금 먼저 연락하면 망하는 이유와 대처법", locked: "지금 성급히 연락하면 차단당할 위험이 높으므로 상대방이 먼저 다가오게 만드는 심리적 역공 타이밍." },
          { num: "4단계", title: "다시 만났을 때 같은 이유로 헤어지지 않는 비기", locked: "과거의 상처를 되풀이하지 않고 관계의 주도권을 쥐는 실전 재회 가이드." }
        ]
      },
      {
        id: "2-2",
        title: "마음 정리 치유 리포트",
        hook: "미련인 거 알면서 왜 못 놓아? 그 사람 팔자가 네 인생의 복을 갉아먹고 있었던 거라면?",
        packaging: "잡고 있을수록 네 운이 새는 인연인지, 깨끗이 털어내야 새 복이 오는지 명쾌하게 갈라준다.",
        priceOriginal: 49000,
        priceSale: 19600,
        priceCross: 15000,
        stages: [
          { num: "1단계", title: "이 이별이 네 사주에 미치는 운명적 의미", preview: "단순한 실연이 아니라, 네 팔자에 더 큰 귀인이 들어오기 위해 썩은 고리를 끊어내는 천우신조의 액땜." },
          { num: "2단계", title: "그 사람이 네게 남기고 간 운명의 빚과 교훈", locked: "그 관계를 통해 네 영혼이 배운 것과, 앞으로 피해야 할 이성의 사주적 특징." },
          { num: "3단계", title: "가슴의 응어리를 씻어내고 운을 회복하는 기간", locked: "마음의 상처가 아물고 새로운 기운이 솟아나는 정확한 회복 주기." },
          { num: "4단계", title: "다음 인연이 찾아오는 시기와 그 인연의 그릇", locked: "과거를 털어낸 자리에 들어올 진짜 배필의 특징과 만남의 순간." }
        ]
      }
    ]
  },
  {
    id: "yeon",
    name: "실신령",
    domain: "인연 · 궁합 · 썸",
    group: "entrance",
    groupName: "1그룹: 입구 3대장",
    img: "assets/신령들/연신령.jpeg",
    video: "assets/대면상담/실신령대면상담.mp4",
    opener: "붉은 실은 끊어지기 전까지는 얽혀 있는지 이어진 건지 몰라.",
    products: [
      {
        id: "3-1",
        title: "궁합 리포트 프리미엄",
        hook: "우리가 천생연분일까, 아니면 전생의 빚쟁이일까? 같이 살수록 돈이 붙는 합인지, 밑 빠진 독인지 알아?",
        packaging: "두 사람 사주를 맞물려, 살면서 돈이 모이는 자리와 칼자루 쥔 사람을 가려준다.",
        priceOriginal: 99000,
        priceSale: 39600,
        priceCross: 31000,
        stages: [
          { num: "1단계", title: "두 사람의 타고난 성향과 첫눈의 끌림 분석", preview: "상대방의 강한 금(金) 기운과 당신의 부드러운 수(水) 기운이 만나 서로에게 본능적인 안식처가 되어주는 형국입니다." },
          { num: "2단계", title: "함께 살면 재물이 불어나는지 새어나가는지", locked: "두 사람의 재물운이 합을 이루어 시너지를 내는지, 아니면 충돌하여 낭비가 심해지는지 재물 궁합 정밀 진단." },
          { num: "3단계", title: "실이 단단해지는 황금기와 얇아지는 권태 위기", locked: "함께 가정을 꾸리기에 가장 복된 해와, 권태기로 인해 밖으로 눈 돌릴 수 있는 위기의 해." },
          { num: "4단계", title: "끝까지 해로하기 위해 둘 중 누가 양보해야 하는지", locked: "다툼이 일어났을 때 실이 끊어지지 않도록 먼저 손을 내밀어야 하는 운명적 칼자루의 주인 지정." }
        ]
      },
      {
        id: "3-2",
        title: "썸 궁합",
        hook: "답장은 달콤한데, 왜 만날 약속은 늘 네가 잡아? 이 사람, 진짜 너한테 반한 거야? 아니면 너만 어장에 빠진 거야?",
        packaging: "반함인지 어장인지, 그 사람의 말 뒤에 숨은 진짜 온도를 재준다.",
        priceOriginal: 69000,
        priceSale: 27600,
        priceCross: 22000,
        stages: [
          { num: "1단계", title: "그 사람이 너한테 쓰는 말과 진짜 계산 속마음", preview: "겉으로는 세상 다정하게 굴지만, 사주 속 편재 성향으로 인해 여러 선택지를 저울질하고 있는 심리 상태." },
          { num: "2단계", title: "네가 착각하기 쉬운 가짜 호감 신호 구별법", locked: "단순한 예의와 매너인지, 아니면 진짜 심장이 뛰어서 밤잠을 설치고 있는 것인지 명확히 선을 긋습니다." },
          { num: "3단계", title: "이 썸이 연인으로 발전할 확률(%)과 소요 시간", locked: "사주 기운의 합을 측정하여 정식 교제로 이어질 실제 확률과 최적의 고백 타이밍." },
          { num: "4단계", title: "지금 멈춰서 간을 볼지, 한 발 더 당길지 결단", locked: "주도권을 단숨에 빼앗아와 상대방이 애가 타서 먼저 매달리게 만드는 실전 밀당 전략." }
        ]
      }
    ]
  },
  {
    id: "samhap",
    name: "삼합신령",
    domain: "사주 × 관상 × 손금 삼합",
    group: "premium",
    groupName: "2그룹: 삼합 독점",
    img: "assets/신령들/삼합신령.jpeg",
    video: "assets/대면상담/삼합신령대면상담.mp4",
    opener: "셋이 겹치는 자리에만 진짜 네 운명이 숨어 있지.",
    products: [
      {
        id: "4-1",
        title: "삼합 리포트",
        hook: "남들이 보는 너랑, 네가 밤에 혼자 있는 너랑, 같은 사람이야? 세 가지 눈이 겹치는 운명의 대박 구간을 확인해볼까?",
        packaging: "겉의 나와 속의 내가 어디서 갈라지고 어디서 대박이 터지는지 세 줄로 맞춰주는 프리미엄 리포트.",
        priceOriginal: 189000,
        priceSale: 75600,
        priceCross: 60400,
        stages: [
          { num: "1단계", title: "사주로 본 타고난 팔자의 원형과 가면", preview: "생년월일시에 새겨진 그릇은 장군의 기개이나, 세상의 기준에 맞추느라 온순한 양의 탈을 쓰고 버텨온 모습." },
          { num: "2단계", title: "관상으로 읽어낸 첫인상과 숨겨둔 본모습", locked: "눈썹 뼈와 코끝의 재백궁이 가리키는, 타인에게 드러나는 카리스마와 뒤에 감춘 외로움의 실체." },
          { num: "3단계", title: "손금으로 추적한 네가 직접 바꾼 운명의 흔적", locked: "운명선과 두뇌선이 갈라지는 지점을 통해, 본래의 팔자를 딛고 스스로 일궈낸 자수성가의 흉터 추적." },
          { num: "4단계", title: "세 가지가 일치하여 대박이 터지는 운명의 구간", locked: "사주·관상·손금 3대 기운이 하나로 겹쳐 거대한 부와 명예가 쏟아지는 인생 최대 황금기 포착." }
        ]
      }
    ]
  },
  {
    id: "jakmyeong",
    name: "작명신령",
    domain: "평생 이름 작명",
    group: "premium",
    groupName: "2그룹: 삼합 독점",
    img: "assets/신령들/작명신령.jpeg",
    video: "assets/대면상담/작명신령대면상담.mp4",
    opener: "이름은 부를 때마다 그 사람 머리 위로 떨어지는 종소리야.",
    products: [
      {
        id: "5-2",
        title: "아이 이름 짓기 프리미엄",
        hook: "같은 반에 같은 이름이 세 명이야. 그래도 네 아이 이름은 그냥 '흔하고 예쁜 글자'면 돼?",
        packaging: "대법원 통계로 흔한 이름을 싹 걸러내고, 마음에 들 때까지 무제한으로 맞춰주는 단 하나의 이름.",
        priceOriginal: 199000,
        priceSale: 79600,
        priceCross: 63600,
        stages: [
          { num: "1단계", title: "아이의 사주 원판과 독창적인 품격 설계", preview: "남들과 똑같은 길을 걷지 않고 스스로 한 분야의 최고 지도자가 될 수 있는 유일무이한 기운 설계." },
          { num: "2단계", title: "대법원 출생신고 빅데이터 기반 상위 100위 배제", locked: "최근 5년간 가장 많이 쓰인 흔한 이름을 철저히 필터링하여 학교나 사회에서 겹치지 않도록 보장." },
          { num: "3단계", title: "희소성과 4격 수리가 완벽한 맞춤 이름 무제한 제안", locked: "부모님의 마음에 100% 찰 때까지 수정 횟수 제한 없이 품격 높은 고유의 이름을 끝까지 추출." },
          { num: "4단계", title: "부를수록 아이의 그릇이 커지고 세상에 각인되는 이름", locked: "국내뿐 아니라 글로벌 사회에서도 발음하기 쉽고 영원히 빛날 평생의 보물 이름 완결." }
        ]
      }
    ]
  },
  {
    id: "samsin",
    name: "삼신할매",
    domain: "출산 · 잉태 · 택일",
    group: "premium",
    groupName: "2그룹: 삼합 독점",
    img: "assets/신령들/삼신할매.jpeg",
    video: "assets/대면상담/삼신할매대면상담.mp4",
    freezeAt: 6.9,
    opener: "세상에 올 때 첫 숨을 어느 시간에 들이마실지, 내가 지켜보고 있다.",
    products: [
      {
        id: "6-1",
        title: "제왕절개 택일 리포트",
        hook: "의사가 '이 날짜들 중에요' 한 그 안에서, 아이 숨이 가장 고르게 열리는 두 시간이 어딘지 알아? 단 2시간으로 아이 팔자가 갈리는데 놓칠 거야?",
        packaging: "수술 가능한 날짜 안에서, 아이와 산모가 가장 덜 흔들리고 기운이 폭발하는 2시간 최적 일시를 짚어준다.",
        priceOriginal: 229000,
        priceSale: 91600,
        priceCross: 73200,
        stages: [
          { num: "1단계", title: "의사 지정 일정 중 흉살이 낀 날짜 원천 배제", preview: "수술 가능 범위 중에서 백호대살이나 일지 충이 걸려 산모와 아이 모두 피를 많이 흘릴 수 있는 날짜를 걸러냅니다." },
          { num: "2단계", title: "같은 날 안에서도 사주가 갈리는 2시간 단위 최적 시각", locked: "12개 시진 중 아이에게 평생 무병장수와 천을귀인의 복을 안겨줄 2시간 추출." },
          { num: "3단계", title: "그 시간에 태어난 아이가 쥐게 될 천부적 사주 명식", locked: "부모와의 궁합이 환상적으로 맞아떨어져 집안의 가세를 일으켜 세울 아이의 대운 흐름 풀이." },
          { num: "4단계", title: "병원 상황을 고려한 안심 수술 1, 2순위 확정표", locked: "의료진의 수술 일정 변경 등에 유연하게 대처할 수 있는 완벽한 대체 시각 포트폴리오 제공." }
        ]
      }
    ]
  },
  {
    id: "myeonggyeong",
    name: "명경신령",
    domain: "사주 종합 · 본판 거울",
    group: "reality",
    groupName: "3그룹: 현실 4대장",
    img: "assets/신령들/명경신령.jpeg",
    video: "assets/대면상담/명경신령대면상담.mp4",
    freezeAt: 7.75,
    opener: "거울은 거짓말을 안 해. 네가 보기 싫은 구석까지 비추지.",
    products: [
      {
        id: "7-1",
        title: "사주 원판 정밀 판독",
        hook: "네 인생의 큰 틀을 한 번이라도 제대로 들여다본 적 있어? 네가 왜 그 자리에서 고생했는지, 거울에 다 비치는데.",
        packaging: "남들이 말하는 그럴싸한 풀이 말고, 네 사주의 뼈대와 결핍을 가감 없이 비춰주는 진짜 거울.",
        priceOriginal: 99000,
        priceSale: 39600,
        priceCross: 31000,
        stages: [
          { num: "1단계", title: "타고난 오행의 불균형과 결핍된 에너지", preview: "사주에 수(水) 기운이 부족하고 화(火)가 치솟아 늘 조급하고 가슴에 열이 차기 쉬운 체질적 특성 분석." },
          { num: "2단계", title: "평생을 지배하는 용신(用神)과 기신(忌神)", locked: "네 인생의 운을 단숨에 끌어올려 줄 핵심 기운과, 반대로 곁에 두면 운을 깎아먹는 기운." },
          { num: "3단계", title: "10년 주기로 바뀌는 대운(大運)의 변곡점", locked: "과거 고난의 터널이 끝나고 인생의 판도가 뒤집어지는 가장 중요한 대운 진입 시기." },
          { num: "4단계", title: "결핍을 채워 평생 평온을 유지하는 개운 처방", locked: "부족한 오행을 일상에서 채워 넣는 색상, 방위, 직업적 보완책." }
        ]
      }
    ]
  },
  {
    id: "jae",
    name: "재신령",
    domain: "돈그릇 · 곳간 · 재물운",
    group: "reality",
    groupName: "3그룹: 현실 4대장",
    img: "assets/신령들/재신령.jpeg",
    video: "assets/대면상담/재신령대면상담.mp4",
    opener: "밑 빠진 독에 물 붓기였는지, 그릇이 커서 늦게 차는 건지 내가 봐주마.",
    products: [
      {
        id: "8-1",
        title: "돈그릇 크기 & 누수 진단",
        hook: "남들처럼 버는데 왜 통장은 늘 비어 있을까? 네 돈그릇에 금이 갔는지, 아니면 아직 뚜껑이 안 열렸는지 알아?",
        packaging: "네 사주에 들어온 재물이 어디서 새어나가고 있는지, 언제 곳간 문이 활짝 열리는지 낱낱이 밝힌다.",
        priceOriginal: 89000,
        priceSale: 35600,
        priceCross: 28000,
        stages: [
          { num: "1단계", title: "타고난 사주 속 재물창고(財庫)의 형태", preview: "돈을 버는 재주는 탁월하나, 겁재의 작용으로 인해 주변 사람이나 가족으로 인해 돈이 흩어지기 쉬운 구조입니다." },
          { num: "2단계", title: "돈이 줄줄 새어나가는 3대 누수 구멍 포착", locked: "충동적인 투자나 거절하지 못하는 부탁으로 인해 평생 잃어버릴 수 있는 손실의 원천 차단." },
          { num: "3단계", title: "평생 중 가장 거대한 재물이 쏟아지는 시기", locked: "부동산이나 사업, 문서운을 통해 일생일대의 큰 목돈을 쥐게 될 황금기." },
          { num: "4단계", title: "새는 돈을 막고 금고를 꽉 채우는 부자 비기", locked: "네 팔자에 맞는 돈 관리 방식과 절대로 동업하면 안 되는 사람의 유형." }
        ]
      }
    ]
  },
  {
    id: "san",
    name: "산신령",
    domain: "자녀 · 건강 · 가문 노후",
    group: "reality",
    groupName: "3그룹: 현실 4대장",
    img: "assets/신령들/산신령.jpeg",
    video: "assets/대면상담/산신령대면상담.mp4",
    opener: "산처럼 묵직하게 버텨온 네 세월, 그 뿌리와 열매를 내가 굽어보고 있다.",
    products: [
      {
        id: "9-1",
        title: "우리 아이 진로 & 적성",
        hook: "학원 열 개 보내면 뭐해? 아이 사주 속 칼자루가 문과인지 이과인지, 예술인지 쥐어줬어?",
        packaging: "아이 팔자에 새겨진 독보적 무기와, 부모가 밀어줘야 할 진짜 길을 산신의 지혜로 짚어준다.",
        priceOriginal: 99000,
        priceSale: 39600,
        priceCross: 31000,
        stages: [
          { num: "1단계", title: "아이의 타고난 천재성과 사주 속 벼슬길", preview: "틀에 박힌 암기식 공부보다는 직관과 창의력이 번뜩여, 남들이 가지 않은 길에서 일찍 두각을 나타낼 기운." },
          { num: "2단계", title: "아이의 기를 살려주는 학업 환경과 멘토 궁합", locked: "아이를 억압하지 않고 스스로 책상에 앉게 만드는 방위와 부모의 화법 가이드." },
          { num: "3단계", title: "평생 밥벌이를 책임질 최적의 전공과 직업군", locked: "의약, 법조, IT, 글로벌 비즈니스 중 아이가 최고 지위에 오를 수 있는 핵심 분야." },
          { num: "4단계", title: "사춘기 방황을 액땜하고 대입 시험에서 대박 나는 비기", locked: "시험 운이 가장 폭발하는 연도와 결정적인 시험 당일 컨디션 관리법." }
        ]
      }
    ]
  },
  {
    id: "pung",
    name: "풍신령",
    domain: "시기 · 타이밍 풍향계",
    group: "reality",
    groupName: "3그룹: 현실 4대장",
    img: "assets/신령들/풍신령.jpeg",
    video: "assets/대면상담/풍신령대면상담.mp4",
    freezeAt: 7.1,
    opener: "바람을 등지면 뛰어가고, 바람을 마주 보면 넘어져. 바람의 방향을 알아야지.",
    products: [
      {
        id: "10-2",
        title: "신년운세 (연간 종합)",
        hook: "작년에도 '내년엔 다르겠지' 했지? 올해 고생, 진짜 끝일까? 열두 달 바람이 어디서 너를 밀어주고 어디서 꺾으려 하는지 알아?",
        packaging: "올해 열두 달, 네가 잔뜩 웅크리고 숙여야 할 달과 고개를 번쩍 들고 휘몰아쳐야 할 달을 나눠준다.",
        priceOriginal: 139000,
        priceSale: 55600,
        priceCross: 44400,
        stages: [
          { num: "1단계", title: "올 한 해 전체를 관통하는 핵심 테마와 짓누르는 달", preview: "전반기는 오래된 껍질을 벗는 탈피의 고통이 따르나, 후반기로 갈수록 탄탄한 도약대가 마련되는 해입니다." },
          { num: "2단계", title: "고통이 잦아들고 숨통이 트이며 기운이 도는 환승 구간", locked: "금전적 압박이나 연인과의 갈등이 극적으로 해결되며 웃음을 되찾는 결정적 시기." },
          { num: "3단계", title: "단 한 번의 기회로 판 전체가 뒤집히는 대박의 달", locked: "투자, 이직, 시험 등 인생의 승부수를 던졌을 때 100전 100승을 거둘 천운의 달." },
          { num: "4단계", title: "연말에 웃으며 손에 쥐고 있어야 할 결실과 점검표", locked: "열두 달 동안 길흉화복을 피해 가며 최상의 결과만을 수확하는 월별 액땜 가이드북." }
        ]
      }
    ]
  }
];

let userState = { name: "김늘봄", birthDate: "1996-05-18", birthTime: "묘시" };
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

  // ================= 🔊 사운드 컨트롤 (A 가야금 + B 대금/물소리 합체 신령음) =================
  const bgmAudio = new Audio();
  bgmAudio.src = 'assets/bgm.mp3';
  bgmAudio.loop = true;
  bgmAudio.volume = 0.65;
  bgmAudio.preload = 'auto';

  function playBgm() {
    const playPromise = bgmAudio.play();
    if (playPromise !== undefined) {
      playPromise.then(() => {
        console.log('[BGM] 재생 성공');
      }).catch(err => {
        console.warn('[BGM] 자동재생 차단됨 또는 대기 중:', err);
      });
    }
  }

  function setSound(enable) {
    isAudioActive = enable;
    if (enable) {
      playBgm();
      if (stageGate && stageGate.classList.contains('active') && gateVideo) {
        gateVideo.muted = false;
        gateVideo.volume = 0.6;
        gateVideo.play().catch(()=>{});
      }
      if (enterVideo) {
        enterVideo.muted = false;
        enterVideo.volume = 0.6;
      }
      soundControl.classList.add('active');
      soundIcon.textContent = '🔊';
      soundText.textContent = '신령음 ON';
    } else {
      bgmAudio.pause();
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

  // 사용자 첫 터치/클릭 시 자동 신령음 ON 시작 (브라우저 Autoplay 정책 대응)
  const triggerAudioOnInteraction = () => {
    if (!isAudioActive) {
      setSound(true);
    } else {
      playBgm();
    }
  };
  window.addEventListener('click', triggerAudioOnInteraction, { once: true });
  window.addEventListener('touchstart', triggerAudioOnInteraction, { once: true });

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
      userState.name = (inputName && inputName.value.trim()) || "김늘봄";
      userState.birthDate = inputBirth ? inputBirth.value : userState.birthDate;
      userState.birthTime = inputTime ? inputTime.value : userState.birthTime;
      userState.gender = selectedGender;

      if (userInfoDisplay) {
        userInfoDisplay.innerHTML = `<span class="user-icon">🏮</span><span class="user-name-text"><strong>${userState.name}</strong> 님의 명식 봉인 해제</span>`;
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

  // 8초 줌인 영상이 끝나면: 마지막 프레임에서 정지 유지 + 그 위로 파티클 시작 (사진은 완전 정지, 파티클만 움직임)
  // 풍신령·명경신령·삼신할매는 영상 맨 끝(8.00초)이 하필 눈 감는 타이밍이라, freezeAt에 지정된
  // "눈 뜬 직전 시점"으로 되감아서 그 프레임으로 멈춘다. 나머지 7명은 원래대로 끝에서 멈춘다.
  if (chamberSpiritVideo) {
    chamberSpiritVideo.addEventListener('ended', () => {
      chamberSpiritVideo.pause();
      const freezeAt = currentSpirit && currentSpirit.freezeAt;
      if (freezeAt) {
        chamberSpiritVideo.currentTime = freezeAt;
      }
      startChamberParticles();
    });
  }

  function openChamber(spirit) {
    if (!spirit) return;
    currentSpirit = spirit;
    currentProduct = spirit.products ? spirit.products[0] : null;

    // 새 신령 처소를 열 때는 이전 파티클을 즉시 정지 (새 8초 영상이 끝난 뒤에만 다시 시작)
    stopChamberParticles();

    // 1) 정지 포스터 사진 없이, 아래 2)에서 영상이 검은 화면 위로 바로 페이드인
    if (chamberSpiritName) chamberSpiritName.textContent = spirit.name;
    if (chamberSpiritDomain) chamberSpiritDomain.textContent = spirit.domain;

    // 2) 1080p 대면 영상 로드 후, 포스터 위로 서서히 페이드인
    if (chamberSpiritVideo) {
      chamberSpiritVideo.classList.remove('is-ready');
      chamberSpiritVideo.removeEventListener('playing', chamberSpiritVideo._onReady || (() => {}));

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
    });
  }
});
