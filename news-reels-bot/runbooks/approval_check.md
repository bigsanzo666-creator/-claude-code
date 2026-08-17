# 승인 체크 러너

목적: 텔레그램 버튼 응답 반영 → 승인건 게시 → 리마인드 → 만료 삭제.

**2026-08-17부터 이 절차는 전부 `scripts/approval_runner.py`에 들어 있다.**
예전에는 이 문서에 파이썬 조각을 적어두고 세션마다 손으로 붙여넣었는데, 그러다
캡션을 빠뜨리거나 푸시 전에 게시해서 raw URL 404를 맞는 사고가 반복됐다.
이제는 아래 명령만 쓰면 된다.

## 하루 운영 순서

```bash
cd news-reels-bot

# 1. 지금 상태 확인
python scripts/approval_runner.py status

# 2. (캡션이 없으면) 캡션 넣기 — 셸에 직접 붙여넣지 말고 파일로 넘긴다
python scripts/approval_runner.py caption <아이템id> /tmp/caption.txt

# 3. 카드 이미지를 먼저 푸시한다 ← 이 순서를 지켜야 한다
git add -A && git commit -m "feat: 카드 생성" && git push -u origin <브랜치>

# 4. 텔레그램으로 승인 요청 전송
python scripts/approval_runner.py send <아이템id>

# 5. 버튼을 기다린다. 승인이 눌리면 그 자리에서 게시까지 한다
python scripts/approval_runner.py watch <아이템id> --minutes 25

# 6. 상태 파일 커밋
git add news-reels-bot/state && git commit -m "chore: 게시 상태 기록" && git push
```

`watch`는 오래 걸리므로 백그라운드로 돌리고 다른 일을 해도 된다.
시간이 초과돼도 상태는 안 잃는다 — 다시 실행하면 이어서 기다린다.

## 그 밖의 명령

| 명령 | 언제 쓰나 |
|---|---|
| `approve <id>` | 사용자가 버튼 대신 채팅으로 "게시해줘"라고 했을 때. 승인 + 게시까지 한다 |
| `reject <id>` | 채팅으로 거부했을 때 |
| `publish <id>` | 이미 승인된 건을 다시 게시 시도할 때 (API 실패 후 재시도) |
| `maintain` | 2일 리마인드 + 5일 만료 삭제. 주기 실행용 |

## 실행기가 대신 막아주는 것

게시 전에 아래를 자동으로 확인한다. 하나라도 걸리면 게시하지 않고 한국어로 이유를 찍는다.

1. **캡션이 비어 있으면 게시 금지** (CLAUDE.md 규칙). `(캡션 내용)` 같은 자리표시자도 거른다.
2. **카드 5~10장**인지 확인 (운영 규칙. 인스타 캐러셀 상한이 10장).
3. **카드 파일이 실제로 있는지** 확인.
4. **raw URL이 열리는지(200)** 확인 — 푸시를 안 했으면 여기서 잡힌다.
   Graph API는 로컬 파일을 안 받고 공개 HTTPS URL만 받는다.
5. **이미 게시된 건인지** 확인 (중복 게시 방지).
6. raw URL은 지금 체크아웃된 **브랜치에서 자동으로 만든다.** 브랜치명을 손으로 적지 않는다.

## 실패했을 때

- 게시 API가 실패하면 아이템은 `approved` 상태로 남고, 텔레그램으로 오류를 알린다.
  다음에 `publish <id>`로 재시도하면 된다.
- `approved` 상태는 5일 만료 삭제 대상에서 **제외**된다 (재시도를 기다리는 중이므로).
- 인스타 토큰이 죽으면 모든 호출이 `Cannot call API for app ...`으로 실패한다.
  → 토큰 재발급 후 **새 세션**에서 확인할 것 (세션은 옛 시크릿을 계속 쓴다).

## 코드를 손봤다면

```bash
python scripts/test_approval_runner.py     # 게시 가드 테스트 (네트워크·시크릿 불필요)
python scripts/test_domestic_filter.py     # 기사 필터 테스트
```
