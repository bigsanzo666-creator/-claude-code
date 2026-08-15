# 인수인계 — news-reels-bot 진행 상황 (2026-08-14 기준)

다음 세션이 이어받을 때 이 문서부터 읽을 것. 브랜치: `claude/news-reels-bot-progress-test-8kyo5c`
(PR #2, open: https://github.com/bigsanzo666-creator/-claude-code/pull/2)

## 0. 가장 먼저 알아야 할 것 — 세션 환경은 매번 새로 시작됨

- 이 컨테이너는 세션마다 완전히 새로 뜬다. **환경변수는 매 세션 새로 주입**되지만(아래 6번 참고),
  **apt/pip로 설치한 것들은 세션이 끝나면 사라진다.** 아래 셋은 이번 세션에서 직접 설치했고,
  `make_carousel_html.py` / `make_blog_header.py` (Playwright 렌더링) 또는 ffmpeg 영상 실험을
  다시 돌리려면 새 세션에서 재설치 필요:
  ```
  apt-get update && apt-get install -y ffmpeg fonts-noto-cjk
  pip install playwright
  ```
  (Chromium 바이너리 자체는 `/opt/pw-browsers/chromium-1194/chrome-linux/chrome` 에 이미 있음 —
  `playwright install`은 하지 말 것, 이미 있는 걸 씀. pip playwright 패키지만 새로 설치하면 됨)
- 이전 세션에서 이미 겪은 문제: 세션 도중 시크릿을 새로 발급/교체해도 **그 세션은 예전 값을 계속
  캐싱**한다. 새 값 확인은 반드시 **새 세션**에서 해야 함 (필요하면
  `mcp__Claude_Code_Remote__create_session` 으로 같은 브랜치의 자식 세션을 띄워서 확인 가능,
  단 자식 세션과는 메시지를 주고받을 방법이 마땅치 않아서 결과를 못 읽어오는 경우가 있었음 —
  이럴 땐 사용자에게 새 세션 열어서 직접 확인해달라고 부탁하는 게 제일 빠름).

## 1. 지금까지 정한 것 (의사결정)

- **영상(릴스) 대신 캐러셀(이미지 여러 장)로 방향 전환.** 이유: Higgsfield MCP의
  `generate_video`가 "plus plan 이상 필요" 에러로 막힘 (무료 플랜 한계). 사용자가 보내준
  실제 인스타 계정 참고 예시(`prompt_what`)도 캐러셀 형식이었음.
- **이미지 생성 방식 3단계 발전:**
  1. Higgsfield AI 이미지 (`generate_image`) → 크레딧 소모, 지금은 잔액 0.6개로 사실상 고갈됨
  2. PIL(Pillow)로 직접 그리기 (`make_carousel.py`) → 크레딧 불필요하지만 "라디오/백지 느낌"
     이라는 피드백
  3. **HTML/CSS + Playwright 헤드리스 브라우저 스크린샷** (`make_carousel_html.py`) →
     최종 채택. CSS 블러/그라디언트가 PIL 수작업보다 훨씬 자연스러움. 카드 상단 58%에
     사진(기존에 만들어둔 AI 이미지 재활용), 하단 42%는 흰 패널에 텍스트.
  4. 블로그용 배너는 `make_blog_header.py` — AI 이미지 대신 SVG로 직접 그린 야구공
     일러스트 사용 (크레딧 불필요, 저작권 이슈 없음).
- **저작권/초상권 정책**: 뉴스 원문 사진 절대 사용 금지, AI 이미지에도 "실제 식별 가능한
  얼굴 없음" 조건을 프롬프트에 항상 넣음.
- **인스타그램 게시는 릴스(영상) + 캐러셀(이미지) 둘 다 지원하도록 `instagram_publish.py`
  확장 완료.** `state_manager.ReelItem`에 `post_type`("reels"|"carousel")과
  `media_paths`(캐러셀 전체 슬라이드 목록) 필드 추가함.
- **네이버 블로그는 공식 글쓰기 API가 2020년에 폐지됨** (확인 완료, 웹검색 근거 있음).
  브라우저 자동화는 계정 정지 리스크로 배제 → **사용자가 직접 복붙하는 수동 워크플로우로 결정.**
  아직 블로그 글 포맷/프롬프트 템플릿은 확정 안 됨 — 내일 사용자가 오늘 실제로 올린 글을
  같이 보고 스타일 분석부터 시작하기로 함.
- **기사 선정 이슈 (미해결, 중요)**: 오늘 테스트에 계속 쓴 기사(우에다 아야세, 일본 축구
  선수 이적설)는 사용자가 "한국 독자 대상 계정인데 일본 선수 기사는 관심도가 낮다"고
  지적함. 대안으로 국내 소재(KBO 프로야구, 삼성 구자욱 5안타 2홈런)를 찾아서 블로그
  포스트 초안 하나는 이걸로 새로 만듦. **`naver_news.py`의 카테고리별 검색 키워드나
  스코어링 로직에 "국내 인물/팀 우선" 필터링을 추가하는 게 다음 개선 포인트.**
  (해외 선수/이슈를 걸러내는 로직은 아직 없음)

## 2. 만든/수정한 파일

```
news-reels-bot/
  scripts/
    naver_news.py          NAVER API HUB 엔드포인트/인증 재검증 완료 (문서와 일치 확인)
    telegram_bot.py         send_preview(단일) + send_carousel_preview(앨범, 신규) 지원.
                             콜백 쿼리 만료 시 크래시하던 버그 수정함 (answerCallbackQuery
                             실패해도 상태 반영은 계속되도록 try/except 처리)
    state_manager.py        ReelItem에 post_type, media_paths 필드 추가
    instagram_publish.py    캐러셀 게시 함수 추가: create_carousel_item_container,
                             create_carousel_container, publish_carousel
                             (실계정 없이 mock으로 호출 순서/페이로드만 검증함, 실게시는 안 해봄)
    make_carousel.py        PIL 버전 캐러셀 생성 (구버전, 참고용으로 남겨둠)
    make_carousel_html.py   최종 채택 버전. HTML/CSS + Playwright 스크린샷.
                             사진은 함수 인자로 넘긴 로컬 이미지 파일 경로를 base64 data URI로 삽입.
    make_blog_header.py     블로그 헤더 배너 생성 (16:9, SVG 야구공 일러스트)
  runbooks/
    approval_check.md       post_type별로 publish_reel/publish_carousel 분기하도록 갱신함
  state/
    pending.json            테스트 아이템 3건 (아래 3번 참고)
    media/
      e37a85248a.png/.mp4, scene2/3/4.png   초반 실험용 AI 생성 이미지+영상 (재사용 가능)
      carousel_e37a85248a/          PIL 버전 카드 5장
      carousel_e37a85248a_html/     최종 HTML/CSS 버전 카드 5장 (사진 포함)
      blog_kbo_20260814/header.png  블로그용 KBO 헤더 배너
```

## 3. `state/pending.json` 현재 상태 (전부 테스트용 우에다 아야세 기사 기반)

| id | post_type | status | 비고 |
|---|---|---|---|
| `e37a85248a` | reels(이미지 1장, mp4도 있음) | **approved** | 가장 초기 테스트. 실게시는 안 함 |
| `78a37a2a7e` | carousel (PIL 버전) | **approved** | 텔레그램 승인까지 완료, 실게시는 안 함 |
| `ca82c8a121` | carousel (HTML/CSS 최종 버전) | **pending** | 텔레그램에 전송은 했으나 **사용자가 아직 승인/거부 버튼을 안 눌렀음** |

→ 셋 다 인스타그램에 실제로 게시된 적은 없음 (`posted_at: null`, `instagram_media_id: null`).
→ 세 항목 모두 **테스트용 더미 데이터**이고, 기사 자체도 오늘 지적받은 대로 "한국 독자
  관심사 아님" 이슈가 있어서 **실제 운영 게시물로 쓸 건 아님.** 다음 세션에서 실게시
  여부를 다시 논의할 것.

## 4. 환경변수 상태

`NAVER_CLIENT_ID/SECRET`, `TELEGRAM_BOT_TOKEN/CHAT_ID`, `IG_ACCESS_TOKEN`,
`IG_BUSINESS_ACCOUNT_ID` 전부 Claude Code 환경 설정에 등록 완료.
- 인스타그램: `IG_BUSINESS_ACCOUNT_ID=17841439122652165` (@neulbomlife), 토큰은
  장기 사용자 토큰에서 파생된 Page 토큰이라 사실상 만료 안 됨.
- 네이버: NAVER API HUB 경유, 문서와 인증 방식 일치 검증 완료.
- ⚠️ 이 값들이 실제로 살아있는지는 **새 세션에서** 확인해야 함 (0번 항목 참고).

## 5. 알려진 버그 (수정 완료)

1. `telegram_bot.poll_callback_responses()` — 콜백 쿼리가 만료된 상태에서
   `answerCallbackQuery`가 400을 반환하면 함수 전체가 죽어서 offset 저장도 안 되고
   결과도 유실되던 버그. try/except로 감싸서 해결 (커밋 `5f35ec9`).
2. `make_carousel.py`의 `add_glow()` — 실제로 GaussianBlur를 적용 안 하는 no-op
   버그였음. 수정 후 표지/클로징 카드가 훨씬 자연스러워짐 (커밋 `6d6f68f`).
3. `wrap_text()` — 글자 단위로만 줄바꿈해서 영어 단어("SPOTV NEWS")가 중간에
   끊기던 문제. 단어(공백) 단위 줄바꿈으로 변경.

## 6. 내일 할 일 (사용자가 명시한 순서)

1. **인스타그램 게시 마무리** — 위 pending.json 항목들 실게시 여부 결정 (단, 기사
   자체를 국내 관심사로 바꾸는 게 먼저일 수도 있음 — 사용자와 확인)
2. **블로그 포스팅 스타일/프롬프트 설계** — 오늘 사용자가 직접 올린 블로그 글을
   같이 보고 분석해서, 반복 가능한 템플릿/프롬프트로 정리
3. **수익화 방향 논의**

## 7. 열린 질문 / 다음 세션이 먼저 확인해야 할 것

- `naver_news.py` 카테고리 검색 키워드에 "해외 인물/팀" 필터링 로직이 없음 —
  국내 관심사 기사만 고르도록 개선 필요 (1번 항목 연결)
- AI 이미지 의존도에 대한 사용자의 유보적 반응 있었음 ("이런 AI를 많이 써야
  될까 싶기도 하고") — 이미지 스타일 방향 재확인 필요할 수 있음
- 캐러셀 방식이 최종 확정인지, 아니면 릴스(영상)도 병행할지 재확인 필요
  (영상은 Higgsfield 유료 플랜 없이는 ffmpeg+TTS 조합밖에 방법 없음, 커밋
  `0c76708`/`874ec43`에 그 실험 결과 남아있음 — 이것도 "라디오 같다"는
  피드백을 받았던 버전이라 그대로 쓰긴 어려움)
