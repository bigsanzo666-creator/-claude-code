#!/usr/bin/env python3
"""
릴스 게시물의 승인 대기 상태를 관리한다.

상태 파일: state/pending.json (아이템 리스트)
각 아이템 상태(status): pending -> approved|rejected -> posted|deleted

이 모듈은 daily_generation / approval_check 러너 스크립트에서 임포트해서 쓰거나,
CLI로 직접 호출할 수 있다 (`python state_manager.py <command> ...`).
"""
from __future__ import annotations

import json
import sys
import uuid
from dataclasses import dataclass, field, asdict
from datetime import datetime, timezone, timedelta
from pathlib import Path
from typing import Optional

STATE_DIR = Path(__file__).resolve().parent.parent / "state"
STATE_FILE = STATE_DIR / "pending.json"
MEDIA_DIR = STATE_DIR / "media"

REMIND_AFTER = timedelta(days=2)
DELETE_AFTER = timedelta(days=5)


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _iso(dt: datetime) -> str:
    return dt.isoformat()


def _parse(dt_str: str) -> datetime:
    return datetime.fromisoformat(dt_str)


@dataclass
class ReelItem:
    id: str
    category: str          # 정치 | 사회 | 경제 | 연예 | 스포츠
    headline: str
    summary: str
    source: str             # 예: "네이버뉴스 - OOO일보"
    media_path: str         # state/media/<id>.mp4 (repo 상대경로). 캐러셀이면 표지(첫 장) 경로
    post_type: str = "reels"  # reels(영상 1개) | carousel(이미지 여러 장)
    media_paths: Optional[list[str]] = None  # post_type == "carousel"일 때 전체 슬라이드 경로 (순서대로)
    caption: Optional[str] = None  # 인스타 게시용 캡션. None이면 게시 단계에서 headline+summary로 자동 생성

    created_at: str = field(default_factory=lambda: _iso(_now()))
    status: str = "pending"  # pending|approved|rejected|posted|deleted
    telegram_message_id: Optional[int] = None
    reminded_at: Optional[str] = None
    responded_at: Optional[str] = None
    posted_at: Optional[str] = None
    instagram_media_id: Optional[str] = None


def load() -> list[dict]:
    if not STATE_FILE.exists():
        return []
    return json.loads(STATE_FILE.read_text(encoding="utf-8"))


def save(items: list[dict]) -> None:
    STATE_DIR.mkdir(parents=True, exist_ok=True)
    STATE_FILE.write_text(
        json.dumps(items, ensure_ascii=False, indent=2), encoding="utf-8"
    )


def add_item(item: ReelItem) -> None:
    items = load()
    items.append(asdict(item))
    save(items)


def new_id() -> str:
    return uuid.uuid4().hex[:10]


def find(item_id: str) -> Optional[dict]:
    return next((i for i in load() if i["id"] == item_id), None)


def update(item_id: str, **fields) -> Optional[dict]:
    items = load()
    for i in items:
        if i["id"] == item_id:
            i.update(fields)
            save(items)
            return i
    return None


def set_telegram_message_id(item_id: str, message_id: int) -> None:
    update(item_id, telegram_message_id=message_id)


def mark_responded(item_id: str, approved: bool) -> Optional[dict]:
    return update(
        item_id,
        status="approved" if approved else "rejected",
        responded_at=_iso(_now()),
    )


def mark_posted(item_id: str, instagram_media_id: str) -> Optional[dict]:
    return update(
        item_id,
        status="posted",
        posted_at=_iso(_now()),
        instagram_media_id=instagram_media_id,
    )


def items_needing_reminder() -> list[dict]:
    """생성된 지 2일이 지났고 아직 응답이 없고 리마인드도 안 보낸 pending 아이템."""
    out = []
    now = _now()
    for i in load():
        if i["status"] != "pending" or i["reminded_at"]:
            continue
        if now - _parse(i["created_at"]) >= REMIND_AFTER:
            out.append(i)
    return out


def items_to_delete() -> list[dict]:
    """생성된 지 5일이 지난 pending/rejected 아이템 (확인 여부 무관하게 삭제 대상)."""
    out = []
    now = _now()
    for i in load():
        if i["status"] in ("posted", "deleted"):
            continue
        if now - _parse(i["created_at"]) >= DELETE_AFTER:
            out.append(i)
    return out


def mark_deleted(item_id: str) -> Optional[dict]:
    """미디어 파일도 함께 지우고 상태만 deleted로 남긴다 (레코드 자체는 보관, 감사용)."""
    item = find(item_id)
    if item:
        media_file = STATE_DIR.parent / item["media_path"]
        if media_file.exists():
            media_file.unlink()
    return update(item_id, status="deleted")


def mark_reminded(item_id: str) -> None:
    update(item_id, reminded_at=_iso(_now()))


def _cli() -> None:
    if len(sys.argv) < 2:
        print(__doc__)
        return
    cmd = sys.argv[1]
    if cmd == "list":
        for i in load():
            print(f"{i['id']}  [{i['status']:8}]  {i['category']}  {i['headline']}")
    elif cmd == "reminders":
        for i in items_needing_reminder():
            print(i["id"], i["headline"])
    elif cmd == "expired":
        for i in items_to_delete():
            print(i["id"], i["headline"])
    else:
        print(f"알 수 없는 명령: {cmd}")


if __name__ == "__main__":
    _cli()
