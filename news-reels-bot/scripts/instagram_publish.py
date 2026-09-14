#!/usr/bin/env python3
"""
Instagram Graph API로 릴스를 게시한다.

중요한 제약: Graph API는 로컬 파일을 업로드받지 않고, 공개적으로 접근 가능한
video_url(HTTPS)을 요구한다. 즉 게시 전에 영상 파일을 어딘가 공개 URL로
호스팅해둬야 한다 (예: public GitHub repo raw URL, 또는 무료 오브젝트 스토리지).
자세한 옵션은 README의 "미디어 호스팅" 항목 참고.

필요 환경변수:
  IG_ACCESS_TOKEN        (Meta 개발자 앱에서 발급한 장기 액세스 토�큰,
                           instagram_content_publish 권한 필요)
  IG_BUSINESS_ACCOUNT_ID (연결된 인스타그램 프로페셔널 계정의 ID)
"""
from __future__ import annotations

import json
import os
import time
import urllib.parse
import urllib.request

GRAPH_VERSION = "v19.0"
GRAPH_BASE = f"https://graph.facebook.com/{GRAPH_VERSION}"


def _access_token() -> str:
    return os.environ["IG_ACCESS_TOKEN"]


def _ig_user_id() -> str:
    return os.environ["IG_BUSINESS_ACCOUNT_ID"]


def _post(path: str, params: dict) -> dict:
    url = f"{GRAPH_BASE}/{path}"
    data = urllib.parse.urlencode({**params, "access_token": _access_token()}).encode("utf-8")
    req = urllib.request.Request(url, data=data, method="POST")
    with urllib.request.urlopen(req, timeout=30) as resp:
        return json.loads(resp.read().decode("utf-8"))


def _get(path: str, params: dict) -> dict:
    query = urllib.parse.urlencode({**params, "access_token": _access_token()})
    req = urllib.request.Request(f"{GRAPH_BASE}/{path}?{query}", method="GET")
    with urllib.request.urlopen(req, timeout=30) as resp:
        return json.loads(resp.read().decode("utf-8"))


def create_reel_container(video_url: str, caption: str) -> str:
    resp = _post(
        f"{_ig_user_id()}/media",
        {"media_type": "REELS", "video_url": video_url, "caption": caption, "share_to_feed": "true"},
    )
    if "id" not in resp:
        raise RuntimeError(f"릴스 컨테이너 생성 실패: {resp}")
    return resp["id"]


def wait_until_ready(creation_id: str, timeout_sec: int = 300, interval_sec: int = 10) -> None:
    """영상 인코딩 처리가 끝날 때까지 대기 (FINISHED 상태가 되어야 발행 가능)."""
    elapsed = 0
    while elapsed < timeout_sec:
        status = _get(creation_id, {"fields": "status_code"}).get("status_code")
        if status == "FINISHED":
            return
        if status == "ERROR":
            raise RuntimeError(f"미디어 처리 실패 (creation_id={creation_id})")
        time.sleep(interval_sec)
        elapsed += interval_sec
    raise TimeoutError(f"미디어 처리 대기 시간 초과 (creation_id={creation_id})")


def publish(creation_id: str) -> str:
    resp = _post(f"{_ig_user_id()}/media_publish", {"creation_id": creation_id})
    if "id" not in resp:
        raise RuntimeError(f"게시 실패: {resp}")
    return resp["id"]


def publish_reel(video_url: str, caption: str) -> str:
    """전체 흐름: 컨테이너 생성 -> 처리 대기 -> 발행. 발행된 미디어 id를 반환."""
    creation_id = create_reel_container(video_url, caption)
    wait_until_ready(creation_id)
    return publish(creation_id)


if __name__ == "__main__":
    import sys

    if len(sys.argv) != 3:
        print("사용법: python instagram_publish.py <public_video_url> <caption>")
        raise SystemExit(1)
    media_id = publish_reel(sys.argv[1], sys.argv[2])
    print(f"게시 완료. media_id={media_id}")
