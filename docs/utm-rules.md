# 늘봄사주 플랫폼별 링크 꼬리표(UTM) 규칙 (`BIG-32`)

> **공유 기준서 준수**:
> 1. 광고·업로드 링크를 누르면 **대문 화면(`/`)부터** 시작합니다 (`/?free=1` 바로가기 사용 금지, 2026-11-08 사장님 결정).
> 2. 처음 들어온 손님의 꼬리표(`utm_source`, `utm_medium`, `utm_campaign`, `utm_content`, `fbclid`)는 브라우저 쿠키·저장소에 **7일 동안 처음 방문 기준(First-touch)으로 유지**되며, 무료 사주 명식 열람과 실제 주문에 함께 기록됩니다.
> 3. 관리자 퍼널 숫자 화면(`/admin/funnel`)에서 플랫폼별(`utm_source`) · 소재별(`utm_content`) · 캠페인별(`utm_campaign`)로 자동 분류됩니다.

---

## 1. 꼬리표(UTM) 항목 규칙

| 항목 | 허용 값 | 설명 |
| :--- | :--- | :--- |
| `utm_source` | `meta` / `tiktok` / `naver_clip` / `youtube` | 유입 플랫폼 4종 (메타 인스타그램·페이스북, 틱톡, 네이버 클립, 유튜브 쇼츠) |
| `utm_medium` | `paid` / `organic` / `profile` | 유입 경로 구분 (`paid`: 유료 광고, `organic`: 일반 게시물/댓글 고정 링크, `profile`: 채널 프로필 링크) |
| `utm_campaign` | 예: `2026-11-launch` | 캠페인 묶음 코드 (소문자 영문·숫자·하이픈) |
| `utm_content` | `nabi-love-01` / `nabi-money-01` / `nabi-career-01` / `nabi-match-01` | 광고·쇼츠 소재 코드 (우선 제작 4개 및 이후 추가 소재) |

---

## 2. 4개 플랫폼 × 우선 소재 4개 = 16개 완성 링크 표

> 사이트 기본 도메인이 정해지면 앞의 `{SITE_URL}` 자리에 그대로 붙이거나, 현재 운영 도메인(`https://neulbomsaju.com` 등) 뒤에 아래 경로(`/?utm_source=...`)를 그대로 붙여 사용합니다.
> 아래 표는 GPT(`BIG-27`) 업로드 글의 `{링크}` 자리에 바로 넣어 쓸 수 있도록 **유료 광고(`paid`)** 및 **일반 업로드(`organic`)** 링크를 함께 정리한 표입니다.

### A. 일반 게시물·고정 댓글·설명란 링크 (`utm_medium=organic`, 16개)

| 번호 | 플랫폼 (`utm_source`) | 소재 코드 (`utm_content`) | 소재 주제 | 완성 링크 (대문 `/` 시작) |
| :---: | :--- | :--- | :--- | :--- |
| 1 | `meta` (릴스/피드) | `nabi-love-01` | 연애·인연 | `/?utm_source=meta&utm_medium=organic&utm_campaign=2026-11-launch&utm_content=nabi-love-01` |
| 2 | `meta` (릴스/피드) | `nabi-money-01` | 재물·금전 | `/?utm_source=meta&utm_medium=organic&utm_campaign=2026-11-launch&utm_content=nabi-money-01` |
| 3 | `meta` (릴스/피드) | `nabi-career-01` | 직장·이직 | `/?utm_source=meta&utm_medium=organic&utm_campaign=2026-11-launch&utm_content=nabi-career-01` |
| 4 | `meta` (릴스/피드) | `nabi-match-01` | 궁합·속마음 | `/?utm_source=meta&utm_medium=organic&utm_campaign=2026-11-launch&utm_content=nabi-match-01` |
| 5 | `tiktok` (틱톡) | `nabi-love-01` | 연애·인연 | `/?utm_source=tiktok&utm_medium=organic&utm_campaign=2026-11-launch&utm_content=nabi-love-01` |
| 6 | `tiktok` (틱톡) | `nabi-money-01` | 재물·금전 | `/?utm_source=tiktok&utm_medium=organic&utm_campaign=2026-11-launch&utm_content=nabi-money-01` |
| 7 | `tiktok` (틱톡) | `nabi-career-01` | 직장·이직 | `/?utm_source=tiktok&utm_medium=organic&utm_campaign=2026-11-launch&utm_content=nabi-career-01` |
| 8 | `tiktok` (틱톡) | `nabi-match-01` | 궁합·속마음 | `/?utm_source=tiktok&utm_medium=organic&utm_campaign=2026-11-launch&utm_content=nabi-match-01` |
| 9 | `naver_clip` (네이버 클립) | `nabi-love-01` | 연애·인연 | `/?utm_source=naver_clip&utm_medium=organic&utm_campaign=2026-11-launch&utm_content=nabi-love-01` |
| 10 | `naver_clip` (네이버 클립) | `nabi-money-01` | 재물·금전 | `/?utm_source=naver_clip&utm_medium=organic&utm_campaign=2026-11-launch&utm_content=nabi-money-01` |
| 11 | `naver_clip` (네이버 클립) | `nabi-career-01` | 직장·이직 | `/?utm_source=naver_clip&utm_medium=organic&utm_campaign=2026-11-launch&utm_content=nabi-career-01` |
| 12 | `naver_clip` (네이버 클립) | `nabi-match-01` | 궁합·속마음 | `/?utm_source=naver_clip&utm_medium=organic&utm_campaign=2026-11-launch&utm_content=nabi-match-01` |
| 13 | `youtube` (유튜브 쇼츠) | `nabi-love-01` | 연애·인연 | `/?utm_source=youtube&utm_medium=organic&utm_campaign=2026-11-launch&utm_content=nabi-love-01` |
| 14 | `youtube` (유튜브 쇼츠) | `nabi-money-01` | 재물·금전 | `/?utm_source=youtube&utm_medium=organic&utm_campaign=2026-11-launch&utm_content=nabi-money-01` |
| 15 | `youtube` (유튜브 쇼츠) | `nabi-career-01` | 직장·이직 | `/?utm_source=youtube&utm_medium=organic&utm_campaign=2026-11-launch&utm_content=nabi-career-01` |
| 16 | `youtube` (유튜브 쇼츠) | `nabi-match-01` | 궁합·속마음 | `/?utm_source=youtube&utm_medium=organic&utm_campaign=2026-11-launch&utm_content=nabi-match-01` |

### B. 유료 광고 집행용 링크 (`utm_medium=paid`, 16개)

| 번호 | 플랫폼 (`utm_source`) | 소재 코드 (`utm_content`) | 소재 주제 | 완성 링크 (대문 `/` 시작) |
| :---: | :--- | :--- | :--- | :--- |
| 1 | `meta` | `nabi-love-01` | 연애·인연 | `/?utm_source=meta&utm_medium=paid&utm_campaign=2026-11-launch&utm_content=nabi-love-01` |
| 2 | `meta` | `nabi-money-01` | 재물·금전 | `/?utm_source=meta&utm_medium=paid&utm_campaign=2026-11-launch&utm_content=nabi-money-01` |
| 3 | `meta` | `nabi-career-01` | 직장·이직 | `/?utm_source=meta&utm_medium=paid&utm_campaign=2026-11-launch&utm_content=nabi-career-01` |
| 4 | `meta` | `nabi-match-01` | 궁합·속마음 | `/?utm_source=meta&utm_medium=paid&utm_campaign=2026-11-launch&utm_content=nabi-match-01` |
| 5 | `tiktok` | `nabi-love-01` | 연애·인연 | `/?utm_source=tiktok&utm_medium=paid&utm_campaign=2026-11-launch&utm_content=nabi-love-01` |
| 6 | `tiktok` | `nabi-money-01` | 재물·금전 | `/?utm_source=tiktok&utm_medium=paid&utm_campaign=2026-11-launch&utm_content=nabi-money-01` |
| 7 | `tiktok` | `nabi-career-01` | 직장·이직 | `/?utm_source=tiktok&utm_medium=paid&utm_campaign=2026-11-launch&utm_content=nabi-career-01` |
| 8 | `tiktok` | `nabi-match-01` | 궁합·속마음 | `/?utm_source=tiktok&utm_medium=paid&utm_campaign=2026-11-launch&utm_content=nabi-match-01` |
| 9 | `naver_clip` | `nabi-love-01` | 연애·인연 | `/?utm_source=naver_clip&utm_medium=paid&utm_campaign=2026-11-launch&utm_content=nabi-love-01` |
| 10 | `naver_clip` | `nabi-money-01` | 재물·금전 | `/?utm_source=naver_clip&utm_medium=paid&utm_campaign=2026-11-launch&utm_content=nabi-money-01` |
| 11 | `naver_clip` | `nabi-career-01` | 직장·이직 | `/?utm_source=naver_clip&utm_medium=paid&utm_campaign=2026-11-launch&utm_content=nabi-career-01` |
| 12 | `naver_clip` | `nabi-match-01` | 궁합·속마음 | `/?utm_source=naver_clip&utm_medium=paid&utm_campaign=2026-11-launch&utm_content=nabi-match-01` |
| 13 | `youtube` | `nabi-love-01` | 연애·인연 | `/?utm_source=youtube&utm_medium=paid&utm_campaign=2026-11-launch&utm_content=nabi-love-01` |
| 14 | `youtube` | `nabi-money-01` | 재물·금전 | `/?utm_source=youtube&utm_medium=paid&utm_campaign=2026-11-launch&utm_content=nabi-money-01` |
| 15 | `youtube` | `nabi-career-01` | 직장·이직 | `/?utm_source=youtube&utm_medium=paid&utm_campaign=2026-11-launch&utm_content=nabi-career-01` |
| 16 | `youtube` | `nabi-match-01` | 궁합·속마음 | `/?utm_source=youtube&utm_medium=paid&utm_campaign=2026-11-launch&utm_content=nabi-match-01` |

### C. 각 플랫폼 프로필 고정 링크 (`utm_medium=profile`, 4개)

| 플랫폼 (`utm_source`) | 프로필 링크 (`utm_content=bio-link`) |
| :--- | :--- |
| `meta` | `/?utm_source=meta&utm_medium=profile&utm_campaign=2026-11-launch&utm_content=bio-link` |
| `tiktok` | `/?utm_source=tiktok&utm_medium=profile&utm_campaign=2026-11-launch&utm_content=bio-link` |
| `naver_clip` | `/?utm_source=naver_clip&utm_medium=profile&utm_campaign=2026-11-launch&utm_content=bio-link` |
| `youtube` | `/?utm_source=youtube&utm_medium=profile&utm_campaign=2026-11-launch&utm_content=bio-link` |

---

## 3. 플랫폼 도메인 소유확인 환경 변수 안내

사장님이 플랫폼 계정(`BIG-31`)에서 도메인 인증 코드를 받으시면 서버 환경 변수에 아래 이름으로 넣어 주시면 됩니다 (비어 있으면 태그·파일을 내보내지 않습니다).

| 환경 변수 이름 | 플랫폼 | 동작 방식 |
| :--- | :--- | :--- |
| `META_DOMAIN_VERIFICATION` | 메타 (Facebook / Instagram 비즈니스) | `<meta name="facebook-domain-verification" content="...">` 태그 출력 |
| `TIKTOK_SITE_VERIFICATION` | 틱톡 (TikTok Ads / Developers) | `<meta name="tiktok-developers-site-verification" content="...">`, `<meta name="tiktok-domain-verification" content="...">` 태그 및 `GET /tiktok-developers-site-verification.txt` 파일 동시 지원 |
| `NAVER_SITE_VERIFICATION` | 네이버 서치어드바이저 | `<meta name="naver-site-verification" content="...">` 태그 출력 |
| `GOOGLE_SITE_VERIFICATION` | 구글 서치 콘솔 (YouTube / Google) | `<meta name="google-site-verification" content="...">` 태그 출력 |
