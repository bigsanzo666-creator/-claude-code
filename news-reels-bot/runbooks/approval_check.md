# 승인 체크 러너 (하루 여러 번, 예: 매시 정각 실행)

이 문서는 예약된 Routine이 주기적으로 실행시키는 Claude Code 세션이 그대로 따라야 할
작업 지시서다. 목적: 텔레그램 버튼 응답 반영 → 승인건 게시 → 리마인드 → 만료 삭제.

## 1. 텔레그램 응답 수집
```python
from scripts.telegram_bot import poll_callback_responses
from scripts.state_manager import mark_responded

for r in poll_callback_responses():
    mark_responded(r["item_id"], r["approved"])
```

## 2. 승인된 건 게시
`state/pending.json`에서 `status == "approved"` 이고 아직 `posted_at`이 없는 항목마다:

1. 영상 파일을 공개 URL로 접근 가능하게 만든다. 저장소가 public이면
   `https://raw.githubusercontent.com/<owner>/<repo>/<branch>/news-reels-bot/state/media/<id>.mp4`
   를 그대로 쓸 수 있다 (직전 단계에서 이미 git push 되어 있어야 함). private 저장소이거나
   다른 호스팅을 쓰기로 했다면 README의 "미디어 호스팅" 절차를 따른다.
2. 캡션은 헤드라인 + 요약 + 해시태그(카테고리 기반) 정도로 구성한다.
3. 게시:
```python
from scripts.instagram_publish import publish_reel
from scripts.state_manager import mark_posted

media_id = publish_reel(video_url, caption)
mark_posted(item["id"], media_id)
```
4. 거부(`status == "rejected"`)된 건은 게시하지 않고 그대로 둔다 (5일 규칙에 따라
   자연히 삭제 대상이 된다).

## 3. 2일 경과 리마인드
```python
from scripts.state_manager import items_needing_reminder, mark_reminded
from scripts.telegram_bot import send_reminder

for item in items_needing_reminder():
    send_reminder(item)
    mark_reminded(item["id"])
```

## 4. 5일 경과 자동 삭제
확인 여부와 무관하게, 생성된 지 5일이 지났고 아직 게시되지 않은 건은 삭제한다.
```python
from scripts.state_manager import items_to_delete, mark_deleted
from scripts.telegram_bot import send_deletion_notice

for item in items_to_delete():
    send_deletion_notice(item)
    mark_deleted(item["id"])  # 미디어 파일 삭제 + 상태만 'deleted'로 보관
```

## 5. 커밋 & 푸시
```
git add news-reels-bot/state
git commit -m "chore: 승인 처리/리마인드/만료 정리"
git push
```

## 6. 오류 처리
- 인스타그램 게시 API가 실패하면(토큰 만료 등) 텔레그램으로 즉시 오류 내용을 한글로
  알리고, 해당 아이템은 `approved` 상태로 남겨서 다음 실행에 재시도한다.
- 반복 실패(3회 이상)하는 아이템은 사람이 볼 수 있게 텔레그램에 명시적으로 보고한다.
