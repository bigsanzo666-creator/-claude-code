# 인수인계 — news-reels-bot 진행 상황 (2026-08-15 기준)

다음 세션이 이어받을 때 이 문서부터 읽을 것. 브랜치: `claude/news-reels-bot-progress-test-8kyo5c`
(PR #2, open: https://github.com/bigsanzo666-creator/-claude-code/pull/2)

---

## 0. 가장 먼저 알아야 할 것 — 작업 환경이 두 가지다

이제 **로컬 PC**와 **클라우드 세션** 두 곳에서 작업할 수 있고, 할 수 있는 일이 서로 다르다.

### 로컬 PC (2026-08-15에 새로 세팅함)
- 저장소 클론 위치: `C:\Users\PC\Documents\news-reels-bot-repo`
- 설치된 것: Node.js 24.19 / Python 3.12.10 (`C:\Program Files\Python312\python.exe`) /
  Claude Code CLI 2.1.233 (`C:\Users\PC\AppData\Roaming\npm\claude.cmd`)
- **할 수 있는 것**: 코드 작성·수정, 오프라인 테스트, 문서 작업, 커밋
- **할 수 없는 것**: 네이버 API 호출, 텔레그램 폴링, 인스타 게시, Playwright 렌더링
  → **시크릿(NAVER/TELEGRAM/IG)이 로컬에 없다.** Windows 환경변수에도 없음을 확인함.

### 클라우드 세션
- 시크릿이 자동 주입되고, 실제 API 호출/게시가 가능한 쪽
- 컨테이너가 세션마다 새로 뜬다. **환경변수는 매번 주입되지만 apt/pip 설치물은 사라진다.**
  `make_carousel_html.py` / `make_blog_header.py`(Playwright) 나 ffmpeg 실험을 돌리려면 재설치:
  ```
  apt-get update && apt-get install -y ffmpeg fonts-noto-cjk
  pip install playwright
  ```
  (Chromium은 `/opt/pw-browsers/chromium-1194/chrome-linux/chrome` 에 이미 있음.
   `playwright install` 하지 말 것 — pip 패키지만 새로 깔면 됨)
- **시크릿 캐싱 함정**: 세션 도중 시크릿을 새로 발급/교체해도 그 세션은 예전 값을 계속 쓴다.
  새 값 확인은 반드시 **새 세션**에서. (자식 세션을 띄워도 결과를 읽어오기 어려웠음 —
  사용자에게 새 세션을 열어 직접 확인해달라고 하는 게 제일 빠르다)

---

## 1. 지금까지 정한 것 (의사결정)

- **영상(릴스) 대신 캐러셀(이미지 여러 장)로 방향 전환.** Higgsfield MCP의 `generate_video`가
  "plus plan 이상 필요"로 막혔고(무료 플랜 한계), 사용자가 보내준 실제 참고 계정도 캐러셀이었음.
- **이미지 생성 방식은 HTML/CSS + Playwright 스크린샷으로 확정** (`make_carousel_html.py`).
  경위: ① Higgsfield AI 이미지 → 크레딧 고갈(잔액 0.6) ② PIL 직접 그리기 → "라디오/백지 느낌"
  피드백 ③ **HTML/CSS 렌더링 → 채택.** CSS 블러/그라디언트가 훨씬 자연스럽다.
  카드 상단 58% 사진(기존 AI 이미지 재활용), 하단 42% 흰 패널 + 텍스트.
- **블로그 헤더는 SVG 일러스트** (`make_blog_header.py`). AI 이미지 대신 직접 그려서
  크레딧·저작권 문제를 피한다.
- **저작권/초상권**: 뉴스 원문 사진 절대 사용 금지. AI 이미지 프롬프트에 항상
  "실제 식별 가능한 얼굴 없음" 조건을 넣는다.
- **네이버 블로그는 수동 워크플로우로 확정.** 공식 글쓰기 API가 2020년 폐지(확인 완료),
  브라우저 자동화는 계정 정지 리스크로 배제. **글과 이미지를 만들어 주면 사람이 직접 복붙한다.**
- **인스타그램은 릴스 + 캐러셀 둘 다 지원.** `state_manager.ReelItem`에 `post_type`
  ("reels"|"carousel")과 `media_paths` 필드 추가 완료.

### 2026-08-15에 새로 정한 것

- **기사 선정에 "국내 관심사" 필터를 넣기로 하고 구현 완료.** (어제 지적받은 이슈 해결)
  판정 규칙: 국내 신호가 하나라도 있으면 해외 신호가 같이 있어도 채택,
  국내 신호가 전혀 없고 해외 신호만 있으면 제외.
  → "이정후, MLB 데뷔 홈런"은 채택 / "우에다 아야세 페예노르트 이적설"은 제외.
  해당 카테고리에 국내 기사가 없으면 **그날은 그 카테고리를 건너뛴다**(빈 리스트). 의도된 동작.
- **블로그 글 스타일을 문서로 확정** → `runbooks/blog_post.md` (아래 2번 참고).
- **Supabase는 보류.** 사용자가 프로젝트를 만들고 키를 Claude Code 환경변수에 등록까지 했으나,
  **무엇에 쓸지 용도가 정해지지 않았다.** 연동 코드는 한 줄도 없다. 다음 세션에서 용도부터 정할 것.
  (후보: 사연 접수 폼 / 구독자 명단 / `pending.json`을 DB로 이관)

---

## 2. 만든/수정한 파일

```
news-reels-bot/
  scripts/
    naver_news.py             [2026-08-15 수정] 국내 관심사 필터링 추가
                               - DOMESTIC_MARKERS / FOREIGN_MARKERS / FOREIGN_NATIONS
                               - domestic_affinity() 판정 함수
                               - Article에 foreign_only, matched_markers 필드
                               - pick_top_per_category(exclude_foreign_only=True)
                               - 스포츠 검색어를 국내 위주로 변경(KBO/K리그/축구 국가대표)
    test_domestic_filter.py   [2026-08-15 신규] 위 필터 검증 10케이스.
                               네트워크·시크릿 불필요. 필터 손보면 먼저 돌릴 것:
                                 python scripts/test_domestic_filter.py
    telegram_bot.py            send_preview(단일) + send_carousel_preview(앨범)
    state_manager.py           ReelItem에 post_type, media_paths
    instagram_publish.py       캐러셀 게시 함수 (mock 검증만, 실게시 안 해봄)
    make_carousel.py           PIL 버전 (구버전, 참고용)
    make_carousel_html.py      최종 채택. HTML/CSS + Playwright
    make_blog_header.py        블로그 헤더 배너 (16:9, SVG 야구공)
  runbooks/
    daily_generation.md
    approval_check.md          post_type별 publish_reel/publish_carousel 분기
    blog_post.md              [2026-08-15 신규] 블로그 스타일 가이드 + 생성 프롬프트
  state/
    pending.json               테스트 아이템 3건 (아래 3번)
    media/
      e37a85248a.png/.mp4, scene2/3/4.png    초반 실험용 AI 이미지+영상
      carousel_e37a85248a/                   PIL 버전 카드 5장
      carousel_e37a85248a_html/              최종 HTML/CSS 버전 카드 5장
      blog_kbo_20260814/header.png           블로그용 KBO 헤더 배너
```

**저장소 밖 산출물**: 늘봄이야기 소개 랜딩 페이지(아티팩트)
https://claude.ai/code/artifact/4e74d4d9-67e9-4275-bd32-3ef0ecc443f9
→ 유튜브·네이버 블로그 링크가 비어 있다(주소를 몰라서). 인스타는 채워져 있음.

### `runbooks/blog_post.md` 요약
실제 게시된 글 1편(구자욱 5안타 2홈런)을 분석한 것.
- 제목: `[인물 + 숫자기록], [팀 결과]한 이유` (30~40자, 숫자를 앞에)
- 본문 4문단: 리드 / 주인공 / **상대편** / 마무리
  - 3번 문단(진 쪽도 선수 이름까지 구체적으로)이 이 스타일의 핵심
- 합니다체 통일, 한 문장 40~70자, 이모지 없음
- 해시태그 6개 + 출처 고지 한 줄(저작권상 필수)
- **한계 명시**: 표본 1편이고 그것도 봇이 만든 초안. 글이 더 쌓이면 재검증 필요.

---

## 3. `state/pending.json` 현재 상태 (2026-08-14 이후 변동 없음)

| id | post_type | status | 비고 |
|---|---|---|---|
| `e37a85248a` | reels | **approved** | 가장 초기 테스트. 실게시 안 함 |
| `78a37a2a7e` | carousel (PIL) | **approved** | 텔레그램 승인 완료, 실게시 안 함 |
| `ca82c8a121` | carousel (HTML/CSS) | **pending** | 텔레그램 전송했으나 승인/거부 버튼 안 누름 |

- 셋 다 인스타 실게시 이력 없음 (`posted_at: null`, `instagram_media_id: null`)
- **셋 다 우에다 아야세(일본 선수) 기사 기반** — 이제 새 필터라면 애초에 걸러졌을 소재다.
  실제 운영 게시물로 쓸 것이 아니므로, **정리하고 국내 소재로 새로 만드는 쪽을 권한다.**

---

## 4. 환경변수 상태

`NAVER_CLIENT_ID/SECRET`, `TELEGRAM_BOT_TOKEN/CHAT_ID`, `IG_ACCESS_TOKEN`,
`IG_BUSINESS_ACCOUNT_ID`, 그리고 2026-08-15에 추가된 Supabase 키까지
Claude Code 환경 설정에 등록되어 있다.
- 인스타: `IG_BUSINESS_ACCOUNT_ID=17841439122652165` (@neulbomlife).
  토큰은 장기 사용자 토큰에서 파생된 Page 토큰이라 사실상 만료 안 됨.
- 네이버: NAVER API HUB 경유, 문서와 인증 방식 일치 검증 완료.
- Supabase: 프로젝트 URL `https://bmwqquunpuntyqdhrave.supabase.co` (서울 리전, 무료 나노).
  ⚠️ 대시보드에 "106 요청 / 성공률 0.0%"로 표시되고 있었다. 쓰기 시작하면 이것부터 확인할 것.
- ⚠️ 값이 실제로 살아있는지는 **새 클라우드 세션**에서 확인해야 한다 (0번 참고).

---

## 5. 알려진 버그 (수정 완료)

1. `telegram_bot.poll_callback_responses()` — 만료된 콜백에서 `answerCallbackQuery`가 400을
   반환하면 함수 전체가 죽어 offset 저장도 결과도 유실되던 버그. try/except로 해결 (`5f35ec9`).
2. `make_carousel.py`의 `add_glow()` — GaussianBlur를 실제로 적용 안 하는 no-op 버그 (`6d6f68f`).
3. `wrap_text()` — 글자 단위 줄바꿈이라 영어 단어가 중간에 끊기던 문제 → 단어 단위로 변경.
4. **[2026-08-15]** 국내 필터 초기 구현에서 `"일본 축구대표팀"`이 국내 기사로 잘못 분류됐다.
   `축구대표팀`/`국가대표`가 국적을 알 수 없는 일반 명사이기 때문. 앞에 해외 국가명이
   붙으면 국내 신호로 치지 않도록 수정. substring 오탐도 함께 제거:
   `정부`("일본 정부"), `대전`("맨유-리버풀 대전"), `한신`("대한신문").

---

## 6. 다음에 할 일

1. **인스타그램 게시 마무리** ← 여전히 1순위, 아직 미착수
   - 시크릿이 필요하므로 **클라우드 세션에서** 해야 한다
   - 먼저 결정할 것: pending.json의 테스트 3건을 지울지, 그중 하나로 실게시를 해볼지
   - 권장 순서: 기존 3건 정리 → 새 필터로 국내 기사 1건 뽑기 → 캐러셀 생성 →
     텔레그램 승인 → **실게시 1회 성공**시키기 (아직 한 번도 성공한 적 없다)
2. **블로그 미확정 4항목 결정** (`runbooks/blog_post.md` 4번 체크리스트)
   - 분량을 1,000자 이상으로 늘릴지 / 소제목 넣을지 / 본문 이미지 수 /
     정치·경제 기사에도 같은 4문단 골격을 쓸지
3. **수익화 방향 논의** (아직 시작 안 함)
4. **Supabase 용도 결정** — 정하거나, 안 쓸 거면 명시적으로 접자

---

## 7. 열린 질문

- **국내 필터를 실제 네이버 API 응답으로 검증 못 했다.** 오프라인 10케이스만 통과한 상태.
  클라우드 세션에서 `python scripts/naver_news.py`를 돌려 실제 기사에 어떻게 걸리는지
  보고 키워드 목록을 다듬어야 한다. 특히 정치·사회·경제 카테고리는 케이스가 없다.
- AI 이미지 의존도에 대한 사용자의 유보적 반응 있었음 ("이런 AI를 많이 써야 될까 싶기도 하고").
  이미지 스타일 방향 재확인 필요할 수 있다.
- 캐러셀이 최종인지, 릴스(영상)도 병행할지 재확인 필요. 영상은 유료 플랜 없이는
  ffmpeg+TTS 조합뿐인데(`0c76708`/`874ec43`), "라디오 같다"는 피드백을 받은 버전이다.
- 랜딩 페이지의 유튜브 채널·네이버 블로그 주소를 못 받았다. (네이버 블로그는
  `https://blog.naver.com/neulbomlife` — 다만 도구로는 접근이 차단되어 내용을 못 읽는다)
