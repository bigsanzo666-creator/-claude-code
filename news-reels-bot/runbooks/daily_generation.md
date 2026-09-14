# 데일리 생성 러너 (매일 1회 실행)

이 문서는 예약된 Routine이 매일 실행시키는 Claude Code 세션이 그대로 따라야 할 작업 지시서다.
실행 주체는 이 지시서를 읽는 Claude 자신이다 (사람이 대신 실행하는 스크립트가 아니라, 매 단계에서
직접 도구를 호출해서 진행한다).

## 0. 준비
- 저장소 루트에서 `news-reels-bot/` 아래 스크립트를 사용한다.
- 필요한 환경변수(`NAVER_CLIENT_ID`, `NAVER_CLIENT_SECRET`, `TELEGRAM_BOT_TOKEN`,
  `TELEGRAM_CHAT_ID`)가 없으면 즉시 중단하고 텔레그램(또는 표준출력)으로
  "환경변수 누락: XXX" 를 알린다.

## 1. 오늘의 후보 뉴스 수집
```
python news-reels-bot/scripts/naver_news.py
```
- 정치/사회/경제/연예/스포츠 5개 카테고리별로 점수화된 후보 기사가 출력된다.
- 카테고리마다 점수가 임계치(예: 상위 40% 또는 트렌드 겹침이 있는 것) 이상인 것만
  1~2개씩 선택한다. 하루 총 5~10개 사이가 되도록 조절한다 (너무 약한 소재는
  억지로 채우지 말고 스킵해도 된다).

## 2. 릴스 대본 작성 (직접 작성, 원문 복사 금지)
선택된 기사마다:
- 기사 원문 문장을 그대로 베끼지 말고, 제목/요약을 참고해서 **직접 재구성**한 짧은
  릴스 대본을 작성한다: 후킹 한 줄 → 핵심 팩트 2~4개 → 마무리 한 줄.
- 언론사명은 출처로 표기하되 기사 본문 전문이나 사진을 그대로 쓰지 않는다.

## 3. 세로형(9:16) 릴스 영상 생성
- 뉴스 원본 사진은 쓰지 않고 AI로 새로 생성한 이미지/영상을 쓴다.
- 템플릿형 워크플로우가 있는지 먼저 `get_workflow_instructions` (인자 없이)로
  카탈로그를 확인하고, 뉴스 설명/숏폼 성격에 맞는 워크플로우가 있으면 그것을 따른다.
  없으면 `generate_video` (또는 이미지 여러 장 + `generate_audio` 내레이션 조합)로
  직접 제작한다.
- 결과 영상을 `news-reels-bot/state/media/<item_id>.mp4` 로 저장한다
  (`item_id`는 `state_manager.new_id()`로 생성).

## 4. 상태 등록
```python
from scripts.state_manager import ReelItem, add_item, new_id

item = ReelItem(
    id=new_id(),
    category="정치",
    headline="...",
    summary="...",
    source="네이버뉴스 - OOO일보",
    media_path="state/media/<item_id>.mp4",
)
add_item(item)
```

## 5. 텔레그램으로 미리보기 전송
```python
from scripts.telegram_bot import send_preview
from scripts.state_manager import set_telegram_message_id

msg_id = send_preview(item.__dict__, "news-reels-bot/state/media/<item_id>.mp4")
set_telegram_message_id(item.id, msg_id)
```
- 캡션에 카테고리/헤드라인/요약/출처/ID가 포함되고, "✅ 승인" / "❌ 거부" 인라인
  버튼이 붙는다.

## 6. 커밋 & 푸시
생성된 영상과 `state/pending.json` 변경분을 커밋해서, 다음에 실행되는
approval_check 러너(별도 Routine)가 같은 상태를 볼 수 있게 한다.
```
git add news-reels-bot/state
git commit -m "chore: 오늘의 릴스 후보 N건 생성"
git push
```

## 7. 마무리
몇 건을 만들어서 전송했는지 요약을 남기고 세션을 종료한다. 실제 게시 여부 결정은
사용자가 텔레그램 버튼으로 응답하면 approval_check 러너가 처리한다.
