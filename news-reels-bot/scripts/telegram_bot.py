#!/usr/bin/env python3
"""
텔레그램 봇으로 릴스 미리보기를 보내고, 승인/거부 버튼 응답을 받아온다.

필요 환경변수:
  TELEGRAM_BOT_TOKEN   (@BotFather 에서 발급)
  TELEGRAM_CHAT_ID     (본인에게 보낼 chat id - @userinfobot 등으로 확인)

사용 흐름:
  1. daily_generation 러너가 send_preview() 로 각 아이템을 전송 (승인/거부 인라인 버튼 포함)
  2. approval_check 러너가 poll_callback_responses() 를 호출해 새로 눌린 버튼을 가져오고
     state_manager.mark_responded() 로 반영한다.
"""
from __future__ import annotations

import json
import os
import urllib.request
from pathlib import Path
from typing import Optional

STATE_DIR = Path(__file__).resolve().parent.parent / "state"
OFFSET_FILE = STATE_DIR / "telegram_offset.json"

API_BASE = "https://api.telegram.org/bot{token}"


def _token() -> str:
    return os.environ["TELEGRAM_BOT_TOKEN"]


def _chat_id() -> str:
    return os.environ["TELEGRAM_CHAT_ID"]


def _call(method: str, payload: Optional[dict] = None, files: Optional[dict] = None) -> dict:
    url = f"{API_BASE.format(token=_token())}/{method}"
    if files:
        # multipart/form-data (사진/영상 업로드용)
        import mimetypes
        import uuid as _uuid

        boundary = _uuid.uuid4().hex
        body = b""
        payload = payload or {}
        for key, val in payload.items():
            body += (
                f"--{boundary}\r\nContent-Disposition: form-data; name=\"{key}\"\r\n\r\n{val}\r\n"
            ).encode("utf-8")
        for key, filepath in files.items():
            filename = os.path.basename(filepath)
            mime = mimetypes.guess_type(filename)[0] or "application/octet-stream"
            body += (
                f"--{boundary}\r\nContent-Disposition: form-data; name=\"{key}\"; "
                f"filename=\"{filename}\"\r\nContent-Type: {mime}\r\n\r\n"
            ).encode("utf-8")
            body += Path(filepath).read_bytes() + b"\r\n"
        body += f"--{boundary}--\r\n".encode("utf-8")
        req = urllib.request.Request(
            url, data=body, headers={"Content-Type": f"multipart/form-data; boundary={boundary}"}
        )
    else:
        req = urllib.request.Request(
            url,
            data=json.dumps(payload or {}).encode("utf-8"),
            headers={"Content-Type": "application/json"},
        )
    with urllib.request.urlopen(req, timeout=30) as resp:
        return json.loads(resp.read().decode("utf-8"))


def send_preview(item: dict, media_path: str) -> int:
    """영상/이미지 미리보기 + 승인/거부 버튼 전송. 성공 시 telegram message_id 반환."""
    caption = (
        f"[{item['category']}] {item['headline']}\n\n"
        f"{item['summary']}\n\n"
        f"출처: {item['source']}\n"
        f"ID: {item['id']}"
    )
    keyboard = {
        "inline_keyboard": [
            [
                {"text": "✅ 승인(게시)", "callback_data": f"approve:{item['id']}"},
                {"text": "❌ 거부", "callback_data": f"reject:{item['id']}"},
            ]
        ]
    }
    is_video = media_path.lower().endswith((".mp4", ".mov"))
    method = "sendVideo" if is_video else "sendPhoto"
    field = "video" if is_video else "photo"
    resp = _call(
        method,
        payload={
            "chat_id": _chat_id(),
            "caption": caption,
            "reply_markup": json.dumps(keyboard),
        },
        files={field: media_path},
    )
    if not resp.get("ok"):
        raise RuntimeError(f"텔레그램 전송 실패: {resp}")
    return resp["result"]["message_id"]


def send_text(text: str) -> None:
    resp = _call("sendMessage", payload={"chat_id": _chat_id(), "text": text})
    if not resp.get("ok"):
        raise RuntimeError(f"텔레그램 전송 실패: {resp}")


def send_reminder(item: dict) -> None:
    send_text(
        f"⏰ [{item['category']}] \"{item['headline']}\"\n"
        f"게시 여부를 아직 확인 안 하셨어요 (생성 후 2일 경과).\n"
        f"5일이 지나면 자동 삭제됩니다. (ID: {item['id']})"
    )


def send_deletion_notice(item: dict) -> None:
    send_text(
        f"\U0001f5d1️ [{item['category']}] \"{item['headline']}\" 게시물을 "
        f"5일간 응답이 없어 자동 삭제했습니다. (ID: {item['id']})"
    )


def _load_offset() -> int:
    if OFFSET_FILE.exists():
        return json.loads(OFFSET_FILE.read_text(encoding="utf-8")).get("offset", 0)
    return 0


def _save_offset(offset: int) -> None:
    STATE_DIR.mkdir(parents=True, exist_ok=True)
    OFFSET_FILE.write_text(json.dumps({"offset": offset}), encoding="utf-8")


def poll_callback_responses() -> list[dict]:
    """새로 눌린 승인/거부 버튼들을 [{'item_id':..,'approved': bool}] 형태로 반환.
    getUpdates 는 long-poll 없이 즉시 반환되는 것만 가져온다 (하루 몇 번 주기 실행 전제).
    """
    offset = _load_offset()
    resp = _call("getUpdates", payload={"offset": offset, "timeout": 0})
    if not resp.get("ok"):
        raise RuntimeError(f"getUpdates 실패: {resp}")

    results = []
    max_update_id = offset - 1
    for update in resp["result"]:
        max_update_id = max(max_update_id, update["update_id"])
        cq = update.get("callback_query")
        if not cq:
            continue
        data = cq.get("data", "")
        if ":" not in data:
            continue
        action, item_id = data.split(":", 1)
        if action in ("approve", "reject"):
            results.append({"item_id": item_id, "approved": action == "approve"})
            _call(
                "answerCallbackQuery",
                payload={
                    "callback_query_id": cq["id"],
                    "text": "승인 처리됨" if action == "approve" else "거부 처리됨",
                },
            )

    if max_update_id >= offset:
        _save_offset(max_update_id + 1)
    return results


if __name__ == "__main__":
    for r in poll_callback_responses():
        print(r)
