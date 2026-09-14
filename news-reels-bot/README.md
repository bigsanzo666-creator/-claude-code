# 뉴스 릴스 자동화 (정치·사회·경제·연예·스포츠)

네이버 뉴스에서 카테고리별 헤드라인을 골라 인스타그램 릴스용 숏폼 콘텐츠를 만들고,
텔레그램으로 승인을 받은 뒤 게시까지 자동화하는 파이프라인입니다.

## 전체 흐름

```
[매일 1회, Routine A: 데일리 생성]
  네이버 검색/데이터랩 API로 카테고리별 후보 수집
    → 5개 분야(정치/사회/경제/연예/스포츠)에서 1~2건씩 선정
    → AI로 대본/이미지/영상 새로 생성 (원문 그대로 쓰지 않음)
    → 텔레그램으로 미리보기 + [승인]/[거부] 버튼 전송
    → state/pending.json 에 "대기중"으로 기록, 저장소에 커밋

[하루 여러 번, Routine B: 승인 체크]
  텔레그램 버튼 응답 수집
    → 승인 → 인스타그램 릴스로 게시
    → 거부 → 보관만 함
    → 무응답 2일 경과 → 리마인드 알림 1회
    → 무응답/미게시 5일 경과 → 확인 여부와 무관하게 자동 삭제
```

두 Routine 모두 이 저장소를 소스로 하는 예약 세션(스케줄 트리거)으로 동작합니다.
별도 서버 없이, Claude Code의 예약 실행 기능만으로 돌아갑니다. 상태(승인 대기 목록 등)는
서버 DB 대신 이 저장소의 `state/pending.json` 과 `state/media/` 에 커밋되는 방식으로
세션 간에 이어집니다.

## 디렉터리 구조

```
news-reels-bot/
  README.md              이 문서
  .env.example           필요한 환경변수 목록
  scripts/
    naver_news.py         네이버 검색/데이터랩 API로 후보 기사 수집·점수화
    telegram_bot.py        텔레그램 미리보기 전송 + 버튼 응답 폴링
    instagram_publish.py   인스타그램 Graph API로 릴스 게시
    state_manager.py       승인 대기 상태(state/pending.json) 관리, 2일/5일 규칙
  runbooks/
    daily_generation.md    "데일리 생성" 세션이 따라야 할 작업 지시서
    approval_check.md      "승인 체크" 세션이 따라야 할 작업 지시서
  state/
    pending.json            현재 대기/승인/거부/게시 상태 (자동 갱신됨)
    media/                   생성된 영상 파일
```

## 시작 전 준비 체크리스트

### 1. 네이버 API 키 (NAVER API HUB 경유, 무료)
2026-06-29부로 검색/데이터랩(검색어트렌드) API가 기존 개발자센터에서
**NAVER API HUB(네이버클라우드플랫폼, NCP)** 로 이관되었고, 2026-07-31부터
기존 개발자센터에서는 신규 신청이 막혔습니다. 아래 경로로 진행하세요.
1. https://www.ncloud.com 에서 NCP 계정 가입 (기존 네이버 계정과 별개일 수 있음)
2. **NAVER API HUB** 포털에서 Search API, Search Trend API 이용 신청 → Client ID/Key 발급
3. 발급된 값을 `.env` 의 `NAVER_CLIENT_ID`, `NAVER_CLIENT_SECRET` 에 입력
4. ⚠️ 인증 방식이 예전 개발자센터(단순 헤더)와 동일한지 확인 필요 — NCP 계열 API는
   보통 액세스키/시크릿키 서명(HMAC) 방식을 쓰기도 합니다. API HUB의 Search API
   사용 가이드 페이지를 확인해서 `scripts/naver_news.py` 의 인증 로직을 그에 맞게
   업데이트해야 할 수 있습니다 (현재 스크립트는 기존 개발자센터 방식 기준으로 작성됨).
5. 현재는 무료 요금제만 제공되지만 추후 유료 요금제가 도입될 예정이라고 공지되어
   있으니, 나중에 사용량/과금 여부를 한 번씩 확인하세요.

### 2. 텔레그램 봇 (10분, 무료, 사업자등록 불필요)
1. 텔레그램에서 `@BotFather` 검색 → `/newbot` → 이름 지정 → 토큰 발급받아
   `TELEGRAM_BOT_TOKEN` 에 입력
2. 새로 만든 봇과 대화를 한 번 시작(`/start` 등 아무 메시지나 전송)
3. `@userinfobot` 같은 봇에게 말을 걸어 본인 chat id를 확인 → `TELEGRAM_CHAT_ID` 에 입력

### 3. 인스타그램 + Meta 개발자 앱 (30~60분, 무료)
1. 인스타그램 앱에서 계정을 **프로페셔널(비즈니스 또는 크리에이터)** 계정으로 전환
2. 해당 인스타그램 계정에 연결된 **페이스북 페이지**가 있어야 함 (없으면 새로 생성)
3. https://developers.facebook.com 에서 앱 생성 (유형: 비즈니스)
4. 앱에 **Instagram Graph API** 제품 추가, 본인 계정을 테스터/관리자로 등록
   - 본인 계정에만 게시하는 용도이므로 Meta의 정식 앱 심사(App Review) 없이
     개발 모드로 충분합니다.
5. Graph API Explorer 등으로 다음 권한을 포함한 **장기 액세스 토큰** 발급:
   `instagram_basic`, `instagram_content_publish`, `pages_show_list`, `pages_read_engagement`
6. 연결된 Instagram 비즈니스 계정 ID 조회 → `IG_ACCESS_TOKEN`, `IG_BUSINESS_ACCOUNT_ID` 에 입력
   - 이 단계가 가장 까다로운 부분이라, 준비되면 알려주시면 단계별로 같이 진행하겠습니다.

### 4. 미디어 호스팅 (인스타그램 게시에 필요)
Instagram Graph API는 로컬 파일이 아니라 **공개 HTTPS URL**을 요구합니다.
- 이 저장소가 **public**이면: `daily_generation` 러너가 영상을 커밋/푸시한 뒤
  `https://raw.githubusercontent.com/<owner>/<repo>/<branch>/news-reels-bot/state/media/<id>.mp4`
  형태의 URL을 그대로 쓸 수 있습니다 (추가 설정 불필요).
- 저장소가 **private**이면 raw URL도 비공개라 Meta 서버가 못 읽습니다. 이 경우 별도
  공개 스토리지(예: 무료 티어의 Cloudflare R2, Firebase Storage 등)에 업로드하는 단계를
  추가해야 합니다. 어느 쪽인지 알려주시면 그에 맞게 스크립트를 조정하겠습니다.

### 5. 환경변수 등록
`.env.example` 을 참고해서 실제 값을 채운 뒤, 이 값들을 **Claude Code 환경(Environment)
설정의 환경변수**로 등록해야 합니다 (Routine이 실행될 때 자동으로 주입되도록). `.env`
파일 자체는 저장소에 커밋하지 않습니다 (`.gitignore` 처리됨).

## 준비 끝나면
아래 순서로 진행합니다.
1. 위 체크리스트의 값들을 알려주시면 환경변수로 등록
2. 저장소 공개/비공개 여부 확인 (미디어 호스팅 방식 확정)
3. `daily_generation` Routine(매일 1회)과 `approval_check` Routine(하루 여러 번, 예:
   매시 정각) 을 예약 등록
4. 하루 정도 테스트로 돌려보고 문구/이미지 스타일, 카테고리 배분, 리마인드 문구 등을
   실제 결과 보면서 다듬기

## 주의사항 (반드시 지켜야 하는 것들)
- 기사 원문 문장/사진을 그대로 복사하지 않습니다 (저작권). 제목·요약만 참고해서
  새로 요약하고, 이미지/영상은 AI로 새로 생성합니다.
- 네이버 페이지를 직접 크롤링하지 않고 공식 API만 사용합니다.
- 인스타그램은 공식 Graph API로만 게시합니다 (브라우저 자동화 방식은 계정 정지
  위험이 있어 사용하지 않습니다).
- 승인 없이 자동 게시되는 항목은 없습니다 — 텔레그램에서 [승인] 버튼을 누른 것만
  게시됩니다.
