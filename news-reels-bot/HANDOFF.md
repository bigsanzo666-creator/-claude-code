# 인수인계 문서 (뉴스 릴스 자동화 프로젝트)

새 세션은 이 문서부터 읽고 시작할 것. 이 문서 + `README.md` + `runbooks/` 를 보면
지금까지 뭘 결정했고 뭘 만들었고 뭐가 남았는지 전부 파악됨.

## 브랜치 / PR
- 작업 브랜치: `claude/task-implementation-capability-qnp37q`
- PR: https://github.com/bigsanzo666-creator/-claude-code/pull/1 (draft)
- 저장소는 **public 유지로 확정** (인스타그램 게시 시 raw.githubusercontent.com URL을
  그대로 영상 호스팅에 쓰기 위함. private으로 바꾸면 별도 스토리지가 또 필요해짐)

## 지금까지 정한 것 (재논의 불필요, 확정 사항)
1. **콘텐츠**: 네이버 뉴스에서 정치/사회/경제/연예/스포츠 5개 분야, 하루 1~2건씩
   (하루 총 5~10건) 릴스 제작
2. **원문 그대로 쓰지 않음**: 기사 제목/요약만 참고해서 대본은 새로 작성, 이미지/영상도
   AI로 새로 생성 (저작권 문제 회피). 뉴스 원본 사진 절대 사용 금지.
3. **승인 채널**: 텔레그램 봇 (카카오 알림톡은 사업자등록 필요해서 제외). 승인/거부는
   텔레그램 인라인 버튼으로 처리 — Claude 대화창으로 돌아올 필요 없음.
4. **운영 방식**: 별도 서버 없이 Claude Code의 예약 세션(Routine, create_trigger)으로
   운영. "데일리 생성"(매일 1회) + "승인 체크"(하루 여러 번, 예: 매시 정각) 두 개의
   Routine을 나중에 등록할 예정 (아직 등록 안 함).
5. **상태 저장**: 서버 DB 없이 `state/pending.json` + `state/media/` 를 이 저장소에
   커밋하는 방식으로 세션 간 상태를 이어감.
6. **2일 리마인드 / 5일 자동삭제**: 확인 여부와 무관하게 5일 지나면 삭제.
7. **네이버 API**: 기존 개발자센터(developers.naver.com)는 2026-07-31부로 검색/데이터랩
   신규 발급 중단됨. **NAVER API HUB**(NCP, 네이버클라우드플랫폼)로 이관되어 거기서
   신청해야 함. 인증은 HMAC 서명이 아니라 단순 헤더 방식
   (`X-NCP-APIGW-API-KEY-ID`, `X-NCP-APIGW-API-KEY`).
8. **크리덴셜은 절대 이 레포에 커밋하지 않음** (public 저장소라서 더욱 중요). 전부
   Claude Code 환경(claude.ai/code → "☁️ Default" 환경 설정 → "환경 변수" 칸)에
   등록해서 씀.

## 발급 완료된 것
- **네이버 API HUB Client ID / Client Secret**: 발급 완료. 사용자가 Claude Code
  "Default" 환경의 환경 변수에 `NAVER_CLIENT_ID`, `NAVER_CLIENT_SECRET` 로 등록
  시도함 — **저장이 실제로 반영됐는지, 그리고 이 값이 주입된 새 세션에서
  `scripts/naver_news.py` 실행이 되는지는 아직 검증 전.** 이게 최우선 확인 사항.
- 환경(Default)의 **네트워크 액세스는 "전체"로 변경 완료** (원래 "신뢰됨"이라
  naverapihub.apigw.ntruss.com 등 외부 API가 다 막혀 있었음).

## 만들어진 파일 (전부 이 브랜치에 커밋/푸시 완료)
```
news-reels-bot/
  README.md              준비 체크리스트 + 아키텍처 설명 (사람이 읽을 문서)
  HANDOFF.md              이 문서
  .env.example            필요한 환경변수 전체 목록
  scripts/
    naver_news.py          NAVER API HUB 연동 완료 (엔드포인트/헤더 실제 스펙 반영됨)
    telegram_bot.py         텔레그램 미리보기 전송 + 버튼 응답 폴링 (토큰 미발급, 미검증)
    instagram_publish.py    인스타그램 Graph API 릴스 게시 (크리덴셜 미발급, 미검증)
    state_manager.py        상태 관리, 2일/5일 규칙 (로직 완성, 실사용 전)
  runbooks/
    daily_generation.md     매일 실행 세션이 따를 작업 지시서
    approval_check.md       주기적 실행 세션이 따를 작업 지시서
  state/
    pending.json             빈 배열 (아직 실제 데이터 없음)
    media/.gitkeep
```
루트에 `.gitignore` 추가함 (`.env`, `__pycache__/` 등 제외).

## 다음에 할 일 (순서대로)
1. **[최우선]** 네이버 크리덴셜이 새 세션에 실제로 주입되는지 확인 →
   `python news-reels-bot/scripts/naver_news.py` 실행해서 카테고리별 후보 기사가
   실제로 출력되는지 검증
2. 텔레그램 봇 생성 (`@BotFather` → `/newbot`) → `TELEGRAM_BOT_TOKEN` 발급,
   `@userinfobot` 으로 `TELEGRAM_CHAT_ID` 확인 → 환경변수 등록 → `telegram_bot.py`
   로 미리보기 전송 테스트
3. 인스타그램 프로페셔널 계정 전환 + Meta 개발자 앱 등록 + `IG_ACCESS_TOKEN` /
   `IG_BUSINESS_ACCOUNT_ID` 발급 (README의 "3. 인스타그램 + Meta 개발자 앱" 절 참고 —
   본인 계정에만 게시하는 용도라 App Review 없이 개발 모드로 충분함). 아직 미착수.
4. 위 세 크리덴셜이 다 갖춰지면, `daily_generation.md` runbook 그대로 따라서
   전체 파이프라인 1회 수동 실행 테스트 (뉴스 수집 → 대본/영상 생성 → 텔레그램 전송 →
   승인 → 인스타 게시까지 end-to-end)
5. 문제 없으면 `daily_generation`, `approval_check` 두 Routine을 `create_trigger` 로
   등록 (cron 스케줄)
6. PR #1 을 review-ready로 전환하고 머지할지 논의

## 주의사항
- 두 세션이 동시에 같은 브랜치에 push하면 충돌 남 — 작업은 한 번에 한 세션에서만
- 크리덴셜 값을 대화창에 붙여넣는 건 최소화 (이미 노출된 값이 있다면 나중에
  재발급 권장)
- 뉴스 원문 문장/사진 그대로 쓰지 않기 (저작권), 승인 없는 자동 게시 없음
