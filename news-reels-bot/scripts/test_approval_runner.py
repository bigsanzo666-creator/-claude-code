#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""approval_runner 의 검증 로직 테스트.

네트워크도 시크릿도 필요 없다. 로컬 PC에서도 돌아간다.
게시 가드를 손대면 먼저 이걸 돌릴 것:

    python scripts/test_approval_runner.py
"""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

import approval_runner as ar  # noqa: E402

# 실제로 저장소에 있는 카드 5장 (게시 완료된 KBO 건). 파일 존재 검사에 쓴다.
REAL = [
    "state/media/kbo_race_20260817/1_cover.png",
    "state/media/kbo_race_20260817/2_gap.png",
    "state/media/kbo_race_20260817/3_standings.png",
    "state/media/kbo_race_20260817/4_samsung.png",
    "state/media/kbo_race_20260817/5_closing.png",
]


def item(**over) -> dict:
    base = {
        "id": "test000000",
        "post_type": "carousel",
        "media_paths": list(REAL),
        "media_path": REAL[0],
        "caption": "캡션 본문",
        "posted_at": None,
        "instagram_media_id": None,
        "status": "approved",
    }
    base.update(over)
    return base


def expect_stop(fn, it, hint: str) -> None:
    try:
        fn(it)
    except ar.Stop as exc:
        assert hint in str(exc), f"다른 이유로 막힘: {exc}"
        print(f"OK   | 차단됨 ({hint})")
        return
    raise AssertionError(f"막혔어야 하는데 통과함: {hint}")


def expect_pass(fn, it, label: str) -> None:
    fn(it)
    print(f"OK   | 통과 ({label})")


def main() -> int:
    # 정상 케이스
    expect_pass(ar.validate_for_publish, item(), "5장 + 캡션 있음")
    expect_pass(ar.validate_for_send, item(media_paths=REAL * 2), "10장 상한")

    # 카드 수 규칙 (운영 규칙 5~10장)
    expect_stop(ar.validate_for_send, item(media_paths=REAL[:4]), "5~10장")
    expect_stop(ar.validate_for_send, item(media_paths=REAL * 2 + REAL[:1]), "5~10장")

    # 캐러셀이 아닌 것
    expect_stop(ar.validate_for_send, item(post_type="reels"), "캐러셀만")

    # 파일이 없는 경로
    expect_stop(
        ar.validate_for_send,
        item(media_paths=REAL[:4] + ["state/media/없는파일.png"]),
        "파일이 없습니다",
    )

    # 캡션 가드 — caption 이 null 이면 절대 게시 금지 (CLAUDE.md 규칙)
    expect_stop(ar.validate_for_publish, item(caption=None), "캡션이 비어")
    expect_stop(ar.validate_for_publish, item(caption="   "), "캡션이 비어")

    # 이미 게시된 건 중복 게시 방지
    expect_stop(
        ar.validate_for_publish,
        item(posted_at="2026-08-17T03:22:12Z", instagram_media_id="1813"),
        "이미 게시된",
    )

    # raw URL 은 브랜치에서 만들어지고, 한글/공백 경로도 퍼센트 인코딩된다
    base = ar.raw_base()
    assert base.startswith("https://raw.githubusercontent.com/"), base
    assert base.endswith("/news-reels-bot/"), base
    assert ar.media_url("state/media/카드 1.png").endswith(
        "state/media/%EC%B9%B4%EB%93%9C%201.png"
    ), ar.media_url("state/media/카드 1.png")
    print(f"OK   | raw URL 생성 ({base})")

    print("\n모든 케이스 통과")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
