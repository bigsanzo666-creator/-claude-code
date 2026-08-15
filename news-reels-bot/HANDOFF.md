# 인수인계 — news-reels-bot (2026-08-15 작업 종료 기준)

새 세션은 이 문서부터 읽을 것. 브랜치: `claude/news-reels-bot-progress-test-8kyo5c`
(PR #2: https://github.com/bigsanzo666-creator/-claude-code/pull/2)
**2026-08-15 작업분까지 전부 푸시 완료됐다.** 최신 커밋 `e8ab0b9`.

---

# 0. 내일 바로 할 일 — 이 순서대로

## ① 백인천 추모 캐러셀 인스타 게시 (미완료, 최우선)

블로그는 이미 게시했다. **인스타만 남았다.** 카드도 다 만들어져 있고 공개 URL도 확인됐다.
막힌 건 딱 하나 — **토큰이 로컬 PC에 없다.**

**클라우드 세션(claude.ai/code)에서 새 세션을 열고 아래를 그대로 붙여넣을 것:**

```
news-reels-bot/HANDOFF.md 읽고, 최신 커밋 pull 해줘.

백인천 전 감독 추모 캐러셀을 인스타그램에 게시해줘.
- 카드 5장: news-reels-bot/state/media/memorial_baek_20260815/
  1_cover, 2_average, 3_1982, 4_japan, 5_closing (1080x1350)
- raw URL 베이스:
  https://raw.githubusercontent.com/bigsanzo666-creator/-claude-code/claude/news-reels-bot-progress-test-8kyo5c/news-reels-bot/state/media/memorial_baek_20260815/
- post_type: carousel
- 텔레그램 승인 거쳐서 진행해줘.

부고라 자극적 표현 쓰지 말 것.
```

캡션 전문은 아래 5번에 있다.

⚠️ **인스타 실게시는 이 프로젝트에서 아직 한 번도 성공한 적이 없다.**
권한(`instagram_content_publish`)이나 토큰 만료 문제가 나올 가능성이 있다.
에러가 나면 그 메시지를 그대로 들고 오면 된다.

## ② Higgsfield 결제 → 수채화 톤 확정

- 현재 **잔액 0.6 크레딧, 무료 플랜** → 아무것도 생성 못 한다
- 여유자금이 없다고 하셨으므로 **연간 결제는 하지 말 것.** 연간은 12개월치가
  한 번에 청구된다 (Plus 연간 = $468 ≈ 66만 원 일시불)
- 월간으로 시작하거나 3일 무료 체험으로 톤만 확인하는 쪽을 권함
  (체험은 3일 뒤 $49 자동 청구되니 안 쓸 거면 그 전에 취소)
- 결제 후 할 일: 수채화 이미지 3~4장 뽑아 톤 확정 → `runbooks/brand_direction.md`의
  프롬프트 초안 검증

## ③ `make_carousel_html.py` 비율 수정 (9:16 → 4:5)

기존 캐러셀 렌더러는 아직 1080x1920이라 **인스타 피드에서 잘린다.**
어제 만든 `make_cards_memorial.py`가 이미 1080x1350으로 돌아가니 그걸 참고하면 된다.
비율을 바꾸면 폰트 크기와 58%/40% 영역도 같이 조정해야 한다.

## ④ 그 외

- 블로그 미확정 항목 없음 (8/15에 전부 확정)
- 수익화 방향 논의 (아직 시작 안 함)
- Supabase 용도 결정 — 키만 등록돼 있고 코드는 없다. 안 쓸 거면 명시적으로 접을 것

---

# 1. 작업 환경 — 두 곳이 별개다

이걸 몰라서 8/15에 시간을 많이 썼다. **반드시 먼저 확인할 것.**

| | 로컬 PC (데스크톱 앱) | 클라우드 세션 (claude.ai/code) |
|---|---|---|
| 어디서 도는가 | 사용자 윈도우 PC | 인터넷 서버 |
| PC 파일 | 볼 수 있음 | 못 봄 |
| **시크릿(토큰)** | **❌ 없음** | **✅ 있음** |
| 할 수 있는 것 | 코드·문서·테스트·카드 렌더링·커밋 | 네이버 API, 텔레그램, 인스타 게시 |

- 로컬 저장소: `C:\Users\PC\Documents\news-reels-bot-repo`
- 로컬 설치됨: Python 3.12.10 (`C:\Program Files\Python312\python.exe`),
  Node.js 24.19, Claude Code CLI 2.1.233, **Playwright + Chromium**
- **Playwright가 로컬에 깔려 있으므로 카드 PNG 렌더링은 이제 로컬에서 된다.**
  클라우드처럼 매번 재설치할 필요 없다.

### 클라우드 세션 주의사항
- 컨테이너가 매 세션 새로 뜬다. 환경변수는 주입되지만 **apt/pip 설치물은 사라진다**:
  ```
  apt-get update && apt-get install -y ffmpeg fonts-noto-cjk
  pip install playwright
  ```
  (Chromium은 `/opt/pw-browsers/chromium-1194/chrome-linux/chrome`에 이미 있음.
   `playwright install` 하지 말 것)
- **시크릿 캐싱 함정**: 세션 도중 시크릿을 바꿔도 그 세션은 예전 값을 계속 쓴다.
  새 값 확인은 반드시 **새 세션**에서.

---

# 2. 브랜드 이름 — 채널마다 다르다 (헷갈리기 쉬움)

| 채널 | 이름 |
|---|---|
| 유튜브 | **늘봄이야기** |
| 카드뉴스 하단 표기 | **늘봄이야기** ← 사용자 확정 |
| 네이버 블로그 | 늘봄라이프 (NEULBOM LIFE) |
| 인스타그램 | @neulbomlife |

블로그 이름과 카드 표기가 다르지만 **사용자가 늘봄이야기로 확정했다.** 바꾸지 말 것.

---

# 3. 의사결정 (누적)

- **릴스(영상) 대신 캐러셀.** Higgsfield `generate_video`가 "plus plan 이상 필요"로 막혔고,
  사용자가 보내준 **참고 인스타 계정(`prompt_what`)**도 캐러셀이었다.
  → 이 계정이 캐러셀 방향의 근거다. 카드 규격 정할 때 먼저 볼 것.
- **카드 렌더링은 HTML/CSS + Playwright 스크린샷.** PIL 직접 그리기는 "라디오/백지 느낌"
  이라는 피드백을 받아 폐기.
- **카드 비율 1080×1350 (4:5).** 인스타 피드와 블로그 본문에 같은 카드를 그대로 쓴다.
- **뉴스 사진은 쓰지 않는다.** 8/15에 길게 논의했고 근거는 `runbooks/brand_direction.md` 5번에
  정리돼 있다. 요점: 사진 권리자는 연예인이 아니라 언론사이고, 실질 리스크는 벌금이 아니라
  **계정 정지**다. 브라우저 자동화를 배제한 것과 같은 기준.
- **네이버 블로그는 수동 워크플로우.** 공식 API가 2020년 폐지됨. 글·이미지를 만들어 주면
  사람이 직접 복붙한다.
- **유튜브 방향 전환: 수채화 + 가슴 뭉클한 따뜻한 이야기.** 블랙/반전 드라마 배제.
  상세는 `runbooks/brand_direction.md`.
- **블로그는 스포츠만.** 정치·사회·경제·연예는 올리지 않는다 (4문단 골격이 경기 결과 전용).
  인스타 캐러셀은 5개 카테고리 유지.
- **기사 선정에 국내 관심사 필터 적용.** 단, 오타니·메시급 해외 스타는 예외로 통과시킨다.

---

# 4. 파일 지도

```
news-reels-bot/
  runbooks/
    brand_direction.md      [8/15 신규] 수채화·따뜻한 이야기 방향, 사진 정책 결론,
                             카드 규격, Higgsfield 상태. Cowork 등 외부 환경에 넘길 문서.
    blog_post.md            [8/15 신규] 블로그 스타일 가이드 + 복붙용 생성 프롬프트.
                             제목 공식, 5문단 구조, 카드뉴스 섹션까지 확정본.
    daily_generation.md / approval_check.md   기존 러너 지시서
  scripts/
    naver_news.py           [8/15 수정] 국내 관심사 필터
                             - domestic_affinity() / GLOBAL_STARS(해외 스타 예외)
                             - pick_top_per_category(exclude_foreign_only=True)
    test_domestic_filter.py [8/15 신규] 필터 검증 13케이스. 시크릿·네트워크 불필요.
                             필터 손대면 먼저 돌릴 것:
                               python scripts/test_domestic_filter.py
    make_cards_memorial.py  [8/15 신규] 부고용 카드 렌더러. 1080x1350.
                             cover / big_number / stat_list 세 가지 함수로 재사용 가능.
                             다음 부고엔 CARDS 내용만 갈아끼우면 된다.
    make_carousel_html.py   기존 캐러셀 렌더러. ⚠️ 아직 9:16이라 수정 필요(위 ③번)
    make_carousel.py        PIL 구버전 (참고용)
    make_blog_header.py     블로그 헤더 배너 (SVG 야구공)
    telegram_bot.py / state_manager.py / instagram_publish.py
  state/
    pending.json            테스트 아이템 3건 (아래 6번)
    media/
      memorial_baek_20260815/   [8/15 신규] 백인천 추모 카드 5장 ← 인스타 게시 대기
      carousel_e37a85248a_html/ 우에다 아야세 테스트 카드 (폐기 예정)
      blog_kbo_20260814/header.png
```

---

# 5. 백인천 추모 건 — 현재 상태

- **블로그: 게시 완료** (2026-08-15). 카드 4장 삽입, 카드 순서 오류도 수정 완료.
- **인스타: 미게시** ← 내일 ①번
- 카드 공개 URL 확인됨 (HTTP 200):
  `https://raw.githubusercontent.com/bigsanzo666-creator/-claude-code/claude/news-reels-bot-progress-test-8kyo5c/news-reels-bot/state/media/memorial_baek_20260815/1_cover.png`

### 확인된 사실 (여러 매체 교차)
2026-08-15 오전 6시 41분 천안 단국대병원 별세, 향년 83세, 뇌출혈.
1982년 MBC 청룡 감독 겸 선수로 250타수 103안타 **타율 .412**, 19홈런 64타점.
일본 19년간 1,969경기 1,831안타 209홈런, 1975년 타격왕. KBO장(역대 두 번째).
※ 1982년 출장 경기 수는 매체마다 71/72로 엇갈려 본문에서 뺐다.

### 인스타 캡션 (그대로 사용)
```
한국 프로야구 유일의 4할 타자,
백인천 전 감독이 8월 15일 세상을 떠났습니다. 향년 83세.

1982년, 프로야구가 처음 시작된 해였습니다.
그는 MBC 청룡에서 감독과 선수를 함께 맡으며
250타수 103안타, 타율 0.412를 남겼습니다.

44년이 지났지만 아직 아무도 그 숫자를 넘지 못했습니다.

일본에서 보낸 열아홉 해도 있었습니다.
1,831안타와 209홈런, 그리고 1975년 타격왕.
한국인 선수가 드물던 시절의 기록입니다.

KBO는 고인의 공적을 기려
역대 두 번째 KBO장으로 장례를 치릅니다.

삼가 고인의 명복을 빕니다.

#백인천 #KBO #프로야구 #MBC청룡 #4할타자 #프로야구원년 #늘봄이야기
```

---

# 6. `state/pending.json` — 정리 필요

| id | post_type | status | 비고 |
|---|---|---|---|
| `e37a85248a` | reels | approved | 실게시 안 함 |
| `78a37a2a7e` | carousel (PIL) | approved | 실게시 안 함 |
| `ca82c8a121` | carousel (HTML) | pending | 승인 버튼 안 누름 |

셋 다 **우에다 아야세(일본 선수) 기사 기반**이고, 새 필터라면 애초에 걸러졌을 소재다.
운영 게시물로 쓸 것이 아니므로 **정리하는 쪽을 권한다.**

---

# 7. 환경변수

`NAVER_CLIENT_ID/SECRET`, `TELEGRAM_BOT_TOKEN/CHAT_ID`, `IG_ACCESS_TOKEN`,
`IG_BUSINESS_ACCOUNT_ID`, Supabase 키가 **Claude Code 클라우드 환경 설정**에 등록돼 있다.
**로컬 윈도우 PC에는 없다** (확인함).

- 인스타: `IG_BUSINESS_ACCOUNT_ID=17841439122652165` (@neulbomlife)
- Supabase: `https://bmwqquunpuntyqdhrave.supabase.co` (서울, 무료 나노).
  ⚠️ 대시보드에 "106 요청 / 성공률 0.0%"로 표시됐었다. 쓰기 시작하면 확인할 것
- 네이버: NAVER API HUB 경유, 인증 방식 검증 완료

---

# 8. 알려진 버그 (수정 완료)

1. `telegram_bot.poll_callback_responses()` — 만료된 콜백에서 함수 전체가 죽던 버그 (`5f35ec9`)
2. `make_carousel.py`의 `add_glow()` — GaussianBlur 미적용 no-op (`6d6f68f`)
3. `wrap_text()` — 영어 단어가 중간에 끊기던 문제 → 단어 단위 줄바꿈
4. **[8/15]** 필터가 `"일본 축구대표팀"`을 국내 기사로 오분류. `축구대표팀`/`국가대표`가
   국적을 알 수 없는 일반 명사라서. 해외 국가명이 앞에 붙으면 제외하도록 수정.
   substring 오탐도 제거: `정부`("일본 정부"), `대전`("맨유-리버풀 대전"), `한신`("대한신문")
5. **[8/15]** 필터에 `토론토 블루제이스`가 없어 해외 기사가 통과. MLB 구단 목록 보강.
   **이 목록은 완전할 수 없다** — 실제 API 응답 돌려보다 빠진 팀이 보이면 추가할 것

---

# 9. 열린 질문

- **필터를 실제 네이버 API 응답으로 검증하지 못했다.** 오프라인 13케이스만 통과.
  클라우드에서 `python scripts/naver_news.py`를 돌려 실제 기사에 어떻게 걸리는지
  확인하고 키워드를 다듬어야 한다. 정치·사회·경제 카테고리는 케이스가 아예 없다.
- 수채화 프롬프트가 아직 검증 전이다. 특히 ① 번짐 위에 글자가 읽히는지
  ② 여러 장 뽑았을 때 톤이 일정한지
- 대본 스킬 `neulbom-story-script`에 반전 드라마 전제가 있는지 미확인.
  있으면 따뜻한 이야기 방향으로 같이 고쳐야 한다.
- 늘봄이야기 소개 랜딩 페이지(아티팩트)에 유튜브·블로그 주소가 비어 있다:
  https://claude.ai/code/artifact/4e74d4d9-67e9-4275-bd32-3ef0ecc443f9
