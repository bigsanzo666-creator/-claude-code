# 인수인계 — news-reels-bot 진행 상황 (2026-08-17 기준)

다음 세션이 이어받을 때 이 문서부터 읽을 것.
브랜치: `claude/baek-incheon-carousel-post-e4bmi2` ← 최신 작업은 여기
그 이전 브랜치: `claude/baek-memorial-carousel-approval-nz8t6z` (PR #3),
`claude/news-reels-bot-progress-test-8kyo5c` (PR #2, open)

⚠️ **답변 방식은 저장소 루트 `CLAUDE.md`를 먼저 읽고 그대로 따를 것.**
사용자는 개발 전문가가 아니다. 길게 설명하지 말고 된다/안 된다 + 방법만 말한다.

---

## ⛔ 지금 막힌 것 하나 — 백인천 캐러셀 게시 (캡션 하나만 남음)

**2026-08-17 확인: 토큰은 살아났다. 이제 막고 있는 건 캡션 하나뿐이다.**

| 필요한 것 | 누가 | 상태 |
|---|---|---|
| 새 `IG_ACCESS_TOKEN` | 사용자가 환경변수에 등록 | ✅ **2026-08-17 확인 완료 — 살아있음** |
| 캡션 | 사용자가 채팅으로 준다 | ⛔ **아직 못 받음** |

### 캡션 관련 주의 (2026-08-17에 실제로 겪은 일)

사용자가 "캡션은 이거야: **(캡션 내용)**" 이라고 보냈는데,
`(캡션 내용)`이 **글자 그대로 자리표시자**였다. 실제 문구가 아니다.
→ 캡션을 받았다고 넘겨짚지 말 것. **괄호로 감싼 자리표시자처럼 보이면 실제 캡션이 아니다.**
부고라서 임의 작성 금지. 반드시 사용자에게 실제 문구를 다시 받아서 넣는다.

### 이 세션에서 할 일 (순서대로)

**1단계 — 토큰 확인. ✅ 2026-08-17 통과함.**
```bash
cd news-reels-bot && python3 -c "import sys; sys.path.insert(0,'scripts'); \
  from instagram_publish import _get, _ig_user_id; \
  print(_get(_ig_user_id(), {'fields':'id,username'}))"
```
- 2026-08-17 실제 출력: `{'id': '17841439122652165', 'username': 'neulbomlife'}` → **통과.**
- `Cannot call API for app ...` 나오면 → 토큰이 다시 죽은 것이다.
  사용자에게 "토큰이 아직 반영이 안 됐습니다. 환경변수에 새로 넣으셨나요?"라고 묻는다.
  **이미 넣었다고 하면, 이 세션이 옛날 값을 쓰는 것이니 새 세션을 열어달라고 한다** (0번 캐싱 함정).

**2단계 — 캡션을 pending.json에 넣는다.** ← ⛔ **여기서 막혀 있다**
```bash
cd news-reels-bot && python3 -c "import sys; sys.path.insert(0,'scripts'); \
  from state_manager import update; update('8fe9ef30b7', caption='''(사용자가 준 캡션)''')"
```

**3단계 — 텔레그램 승인 여부 확인.** ✅ 2026-08-17 실행함 (응답 0건 — 버튼 안 눌렀음).
```bash
cd news-reels-bot && python3 -c "import sys; sys.path.insert(0,'scripts'); \
  from telegram_bot import poll_callback_responses; from state_manager import mark_responded; \
  [mark_responded(r['item_id'], r['approved']) for r in poll_callback_responses()] "
```
사용자가 "게시해줘"라고 직접 말하면 그것도 승인으로 친다. 버튼을 굳이 기다리지 말 것.
→ **2026-08-17에 사용자가 "게시할 차례야"라고 직접 말했다. 승인은 이미 받은 것으로 친다.**

**4단계 — 게시.** (BASE를 현재 브랜치로 바꿔둠. ✅ 5장 전부 raw URL 200 + 바이트 일치 확인 2026-08-17)
```bash
cd news-reels-bot && python3 -c "
import sys; sys.path.insert(0,'scripts')
from state_manager import find, mark_posted
from instagram_publish import publish_carousel
BASE='https://raw.githubusercontent.com/bigsanzo666-creator/-claude-code/claude/baek-incheon-carousel-post-e4bmi2/news-reels-bot/'
it=find('8fe9ef30b7')
assert it['caption'], '캡션 없음 - 게시 금지'
urls=[BASE+p for p in it['media_paths']]
mid=publish_carousel(urls, it['caption'])
mark_posted(it['id'], mid); print('게시 완료:', mid)
"
```
**5단계 — 커밋/푸시하고, 사용자에게 한 줄로 "게시 완료됐습니다" + 인스타 링크를 준다.**

### 이미 검증 끝난 것 (다시 확인하지 말 것 — 시간 낭비다)
- **IG 토큰 살아있음** (2026-08-17, `neulbomlife` 응답 확인)
- raw URL 5장 전부 200, 바이트 수 로컬과 일치
  (2026-08-17에 `claude/baek-incheon-carousel-post-e4bmi2` 브랜치 기준으로 다시 확인함)
- 1080x1350, 비율 0.800 (IG 허용 0.8~1.91), PNG, 최대 14K (8MB 제한 여유), 5장 (허용 2~10)
- 텔레그램 전송 정상 (앨범 + 버튼 메시지 ID 22 발송 완료)
- 카드에 적힌 기록(타율 .412, 250타수 103안타 19홈런 64타점, 일본 19년 1,831안타 209홈런,
  1975년 퍼시픽리그 타격왕, 역대 두 번째 KBO장, 향년 83세)은 네이버 뉴스로 전부 대조 완료
- **즉, 토큰과 캡션 말고는 막힌 게 없다.**

### 주의
- 부고다. 자극적 표현·낚시성 문구 금지. 캡션을 임의로 지어내지 말 것 — 사용자가 준다.
- `caption`이 `null`이면 절대 게시하지 말 것.

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
  "plus plan 이상 필요"로 막혔고(무료 플랜 한계), 사용자가 보내준
  **실제 인스타 계정 참고 예시(`prompt_what`)**도 캐러셀 형식이었음.
  → 이 계정이 캐러셀 방향을 정한 근거다. 카드 규격/스타일을 정할 때 먼저 볼 것.
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
  ~~토큰은 장기 사용자 토큰에서 파생된 Page 토큰이라 사실상 만료 안 됨.~~
  🔴 **2026-08-15 정정: 이 가정은 틀렸다. 그날 `IG_ACCESS_TOKEN`은 죽어 있었다.**
  만료가 아니라 앱 단위 거부(OAuthException code 200)였다. 6번 1항 참고.
  **앱 자체는 정상이다** — 대시보드에서 확인함: 앱 `늘봄라이프`(1555194369405575) 존재,
  모드 `개발 중`, 사용자 역할 `관리자`. 즉 앱을 다시 만들 필요는 없고 **토큰만 새로 발급**하면 된다.
  발급 경로: Graph API Explorer → 앱 `늘봄라이프` 선택 → 페이지 액세스 토큰 →
  권한 `instagram_basic`, `instagram_content_publish`, `pages_show_list`,
  `pages_read_engagement` → 액세스 토큰 생성.
  **2026-08-15 진행 상황**: 사용자가 새 토큰을 발급받아 클라우드 환경 변수에 저장했다고 말했다.
  단, 이 세션에서는 **검증하지 못했다** (세션은 계속 옛날 값을 씀 — 0번 캐싱 함정).
  저장 직전 환경 변수 칸에 들어있던 값은 옛날 죽은 토큰과 동일했음을 끝 8글자(`c91xijio`)로 확인했고,
  사용자가 그 뒤에 새 값으로 교체했다. → **새 값이 실제로 살아있는지는 확인 안 됨.**
  새 세션에서 맨 위 "지금 막힌 것" 1단계로 반드시 먼저 검증할 것.
  ⚠️ 이 항목의 다른 키들도 "등록돼 있다"는 것만 확인됐지, 실제로 살아있는지는
  호출해봐야 안다. 인스타 토큰이 정확히 그렇게 죽어 있었다.
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

1. ~~**🔴 인스타그램 토큰부터 살려야 한다** ← 새로운 1순위 (2026-08-15 확인)~~
   ✅ **2026-08-17 해결됨. 사용자가 재발급한 토큰이 새 세션에서 정상 동작했다.**
   (`{'id': '17841439122652165', 'username': 'neulbomlife'}`)
   아래는 다시 죽었을 때를 위한 기록으로 남긴다.

   ~~**`IG_ACCESS_TOKEN`이 현재 죽어 있다. 이걸 고치기 전에는 실게시가 불가능하다.**~~

   증상 — 모든 호출이 동일하게 실패한다:
   ```
   Cannot call API for app 1555194369405575 on behalf of user 122100245055439538
   (OAuthException, code 200)
   ```
   `/me`, `debug_token`, `/{ig_business_account_id}` 전부 같은 에러다.
   v19.0 / v21.0 / v23.0 모두 동일하고, `graph.instagram.com`으로 바꿔도 마찬가지다.
   → **코드 문제도, API 버전 문제도 아니다.** Meta가 앱 단위로 호출을 거부하고 있다.
   토큰 형식 자체는 정상이다 (`EAAW...` 206자, Facebook Graph 토큰이 맞음).

   확인할 것 (앱 대시보드, App ID `1555194369405575`):
   1. 앱이 **개발 모드**인데 계정의 역할(관리자/개발자/테스터)이 빠졌는지
   2. 앱이 Meta에 의해 **제한/비활성화**됐는지 (미사용·App Review 미완료로 흔히 걸린다)
   3. `instagram_content_publish` **고급 액세스가 만료**됐는지
   4. 인스타 계정과 페이지 연결이 끊겼는지

   ⚠️ **토큰을 새로 발급해도 그 세션에서는 확인이 안 된다** (0번 캐싱 함정).
   발급 후 반드시 **새 세션**을 열어서 아래로 먼저 검증할 것:
   ```
   python3 -c "import sys; sys.path.insert(0,'scripts'); \
     from instagram_publish import _get, _ig_user_id; \
     print(_get(_ig_user_id(), {'fields':'id,username'}))"
   ```
   `{'id': ..., 'username': 'neulbomlife'}` 가 나오면 게시 가능한 상태다.

2. **인스타그램 실게시 1회 성공시키기** (아직 한 번도 성공한 적 없다)
   - 2026-08-17 기준 **캡션 하나만 받으면 바로 게시된다.** 토큰·이미지·승인 전부 통과.
   - 토큰만 살아나면 나머지는 준비 끝이다. 2026-08-15에 전부 검증해뒀다:
     raw URL 5개 200 + 바이트 일치 / 1080x1350 (비율 0.800, IG 허용 0.8~1.91) /
     PNG 최대 14K (8MB 제한 여유) / 5장 (허용 2~10) / 텔레그램 정상
   - 대기 중인 건: **백인천 전 감독 추모 캐러셀** (id `8fe9ef30b7`, `status: pending`)
     - `state/media/memorial_baek_20260815/` 5장, PR #3
     - **캡션은 사용자가 직접 준다.** `pending.json`의 `caption`이 `null`이면 게시하지 말 것
     - 부고라서 자극적 표현·낚시성 문구 금지. 카드 문구의 기록은 네이버 뉴스로 대조 완료
   - 기존 테스트 3건(우에다 아야세)은 여전히 정리 대상
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
